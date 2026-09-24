"""The Contact Sheet dashboard: a live local server, or a static snapshot file."""

import json
import re
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from ..config import SERVICES, STATUSES
from ..models import now_iso

TEMPLATE = Path(__file__).with_name("dashboard.html")
PUBLIC_FIELDS = (
    "id", "name", "kind", "category", "website", "website_guessed", "city", "country", "address", "emails",
    "phones", "socials", "description", "team_size", "has_video", "has_podcast", "no_solicit", "crawl_note",
    "facts", "scores", "best_service", "best_score", "drafts", "status", "status_at", "notes", "first_seen",
    "last_seen", "enriched_at",
)


def public(lead, signals):
    out = {field: lead.get(field) for field in PUBLIC_FIELDS}
    out["signals"] = [{k: s[k] for k in ("kind", "title", "url", "published", "data")}
                      for s in signals if s["kind"] != "map"]
    return out


def payload(db, cfg, static=False):
    signals = db.all_signals()
    return {
        "generated_at": now_iso(),
        "static": static,
        "services": SERVICES,
        "home": cfg["home"]["city"],
        "leads": [public(lead, signals.get(lead["key"], [])) for lead in db.leads("best_score > 0")],
    }


def page(data=None):
    """The dashboard HTML. With data it's a self-contained snapshot; without, it loads from the API."""
    blob = "null" if data is None else json.dumps(data)
    # Lead data comes from the open web, so make sure nothing in it can close the script tag.
    blob = blob.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return TEMPLATE.read_text().replace("__CONTACT_SHEET_DATA__", blob)


def serve(db, cfg, port=8765, log=print):
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        server_version = "ContactSheet"

        def log_message(self, *args):
            pass

        def _local(self):
            host = self.headers.get("Host", "").rsplit(":", 1)[0].strip("[]")
            return host in ("127.0.0.1", "localhost", "::1")

        def _send(self, status, body, content_type="application/json"):
            data = body.encode() if isinstance(body, str) else body
            self.send_response(status)
            self.send_header("Content-Type", f"{content_type}; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)

        def _json(self, status, obj):
            self._send(status, json.dumps(obj))

        def do_GET(self):
            if not self._local():
                return self._json(HTTPStatus.FORBIDDEN, {"error": "local access only"})
            path = self.path.split("?")[0]
            if path in ("/", "/index.html"):
                return self._send(HTTPStatus.OK, page(), "text/html")
            if path == "/api/leads":
                with lock:
                    return self._json(HTTPStatus.OK, payload(db, cfg))
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

        def do_POST(self):
            # JSON-only plus a Host check keeps other websites from changing your leads through the browser.
            if not self._local() or not self.headers.get("Content-Type", "").startswith("application/json"):
                return self._json(HTTPStatus.FORBIDDEN, {"error": "forbidden"})
            match = re.fullmatch(r"/api/leads/(\d+)", self.path)
            if not match:
                return self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            try:
                length = min(int(self.headers.get("Content-Length", 0)), 200_000)
                body = json.loads(self.rfile.read(length) or b"{}")
            except ValueError:
                return self._json(HTTPStatus.BAD_REQUEST, {"error": "bad json"})
            with lock:
                lead = db.get(int(match.group(1)))
                if not lead:
                    return self._json(HTTPStatus.NOT_FOUND, {"error": "no such lead"})
                status = body.get("status")
                if status is not None and status not in STATUSES:
                    return self._json(HTTPStatus.BAD_REQUEST, {"error": "unknown status"})
                notes = body.get("notes")
                if notes is not None:
                    notes = str(notes)[:5000]
                draft = body.get("draft")
                if isinstance(draft, dict) and draft.get("service") in lead["drafts"]:
                    service = draft["service"]
                    lead["drafts"][service] = {
                        **lead["drafts"][service],
                        "to": str(draft.get("to", ""))[:320],
                        "subject": str(draft.get("subject", ""))[:300],
                        "body": str(draft.get("body", ""))[:20000],
                        "edited": True,
                    }
                    db.update(lead["id"], {"drafts": lead["drafts"]})
                lead = db.set_status(lead["id"], status=status, notes=notes)
                return self._json(HTTPStatus.OK, public(lead, db.signals(lead["key"])))

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    log(f"Contact Sheet is running at http://localhost:{port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
