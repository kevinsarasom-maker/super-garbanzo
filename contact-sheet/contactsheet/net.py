"""A polite HTTP client: identifies itself, obeys robots.txt, and never hits one site twice in a row without a pause."""

import json
import re
import threading
import time
from dataclasses import dataclass
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

MAX_BYTES = 3_000_000


class Blocked(Exception):
    """robots.txt disallows this URL for our user agent."""


@dataclass
class Page:
    url: str
    status: int
    content_type: str
    content: bytes
    encoding: str

    @property
    def ok(self):
        return 200 <= self.status < 300

    @property
    def text(self):
        try:
            return self.content.decode(self.encoding or "utf-8", errors="replace")
        except LookupError:  # a charset name Python doesn't know
            return self.content.decode("utf-8", errors="replace")

    @property
    def is_html(self):
        return "html" in self.content_type or (not self.content_type and b"<html" in self.content[:2000].lower())


class Fetcher:
    def __init__(self, user_agent, delay=1.5, timeout=15):
        self.user_agent = user_agent
        self.delay = delay
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent, "Accept-Language": "en-CA,en;q=0.8"})
        # Retry busy servers, but give up at once on hosts that don't answer (dead or guessed domains).
        retry = Retry(total=2, connect=0, read=1, other=0, status=2, backoff_factor=2,
                      status_forcelist=(429, 500, 502, 503, 504),
                      allowed_methods=("GET", "POST"), respect_retry_after_header=True)
        adapter = HTTPAdapter(max_retries=retry, pool_maxsize=16)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self._lock = threading.Lock()
        self._host_locks = {}
        self._last_hit = {}
        self._robots = {}
        self._unreachable = set()

    def get(self, url, *, params=None, robots=True, delay=None):
        if urlparse(url).netloc.lower() in self._unreachable:
            raise requests.ConnectionError(f"{urlparse(url).netloc} was unreachable earlier in this run")
        if robots and not self.allowed(url):
            raise Blocked(url)
        return self._request("GET", url, params=params, delay=delay)

    def post(self, url, *, data=None, delay=None, timeout=None):
        return self._request("POST", url, data=data, delay=delay, timeout=timeout)

    def get_json(self, url, *, params=None, delay=None):
        page = self.get(url, params=params, robots=False, delay=delay)
        if not page.ok:
            raise requests.HTTPError(f"{page.status} from {url}")
        return json.loads(page.text)

    def allowed(self, url):
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        with self._lock:
            parser = self._robots.get(base)
        if parser is None:
            parser = RobotFileParser()
            try:
                page = self._request("GET", base + "/robots.txt")
                if page.status in (401, 403):
                    parser.disallow_all = True
                elif page.status >= 400 or not page.ok:
                    parser.allow_all = True
                else:
                    parser.parse(page.text.splitlines())
            except (requests.ConnectionError, requests.Timeout):
                with self._lock:
                    self._unreachable.add(parsed.netloc.lower())
                raise
            except requests.RequestException:
                parser.allow_all = True
            with self._lock:
                self._robots[base] = parser
        return parser.can_fetch(self.user_agent, url)

    def _request(self, method, url, *, params=None, data=None, delay=None, timeout=None):
        host = urlparse(url).netloc.lower()
        with self._lock:
            host_lock = self._host_locks.setdefault(host, threading.Lock())
        with host_lock:
            wait = self._last_hit.get(host, 0) + (self.delay if delay is None else delay) - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            try:
                response = self.session.request(method, url, params=params, data=data,
                                                timeout=(10, timeout or self.timeout), stream=True)
            finally:
                self._last_hit[host] = time.monotonic()
        with response:
            chunks, size = [], 0
            for chunk in response.iter_content(65536):
                chunks.append(chunk)
                size += len(chunk)
                if size >= MAX_BYTES:
                    break
            content_type = response.headers.get("Content-Type", "").lower()
            charset = re.search(r"charset=([\w-]+)", content_type)
            return Page(url=response.url, status=response.status_code, content_type=content_type,
                        content=b"".join(chunks), encoding=charset.group(1) if charset else "utf-8")
