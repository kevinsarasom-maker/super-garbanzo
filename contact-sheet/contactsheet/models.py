"""The shapes sources produce, plus small helpers for URLs, names and dates."""

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlparse

# Hosts that are profiles, not a business's own website.
SOCIAL_HOSTS = {
    "instagram.com": "instagram",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "linkedin.com": "linkedin",
    "tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "twitter.com": "x",
    "x.com": "x",
    "linktr.ee": "linktree",
}


@dataclass
class Signal:
    kind: str  # funding | expansion | launch | pet_brand | podcast | map | manual
    title: str = ""
    url: str = ""
    published: str = ""  # ISO 8601
    data: dict = field(default_factory=dict)


@dataclass
class Lead:
    name: str
    kind: str  # company | pet_business | shelter | podcast
    source: str
    category: str = ""
    website: str = ""
    website_guessed: bool = False
    city: str = ""
    country: str = ""
    address: str = ""
    lat: float | None = None
    lon: float | None = None
    emails: list = field(default_factory=list)  # [{"email": ..., "source": url}]
    phones: list = field(default_factory=list)
    socials: dict = field(default_factory=dict)
    description: str = ""
    facts: dict = field(default_factory=dict)
    signals: list = field(default_factory=list)

    @property
    def key(self):
        return lead_key(self.name, self.website, self.city if self.kind in ("pet_business", "shelter") else "")


def lead_key(name, website="", city=""):
    if website:
        return "site:" + domain_of(website)
    return "name:" + slug(name) + (("@" + slug(city)) if city else "")


def company_norm(name):
    """'Robinhood Canada Inc.' and 'Robinhood' are the same company for our purposes."""
    base = re.sub(r"(?:[\s,]+(?:inc|ltd|llc|llp|corp|corporation|co|canada|usa|us|group|holdings))+\.?$", "", (name or "").strip(), flags=re.I)
    return slug(base or name)


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_iso(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def days_since(value, now=None):
    dt = parse_iso(value)
    if dt is None:
        return None
    now = now or datetime.now(timezone.utc)
    return max(0, (now - dt).days)


def slug(text):
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", " and ")).strip("-")


def clean_url(url):
    """Return an http(s) URL with a scheme, or "" for anything else (javascript:, mailto:, junk)."""
    url = re.split(r"[\s;,]+", (url or "").strip())[0]  # OSM sometimes lists several
    if not url:
        return ""
    if not re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I):
        url = "https://" + url.lstrip("/")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or "." not in parsed.netloc:
        return ""
    return url


def domain_of(url):
    host = urlparse(clean_url(url)).netloc.lower().split("@")[-1].split(":")[0]
    for prefix in ("www.", "m."):
        if host.startswith(prefix):
            host = host[len(prefix):]
    return host


def social_kind(url):
    host = domain_of(url)
    for social_host, kind in SOCIAL_HOSTS.items():
        if host == social_host or host.endswith("." + social_host):
            return kind
    return None
