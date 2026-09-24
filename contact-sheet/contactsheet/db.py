"""SQLite storage. One row per business, merged across sources, plus the dated signals that explain why each is a lead."""

import json
import sqlite3
from dataclasses import asdict

from .models import company_norm, lead_key, now_iso

JSON_FIELDS = {"emails": [], "phones": [], "socials": {}, "sources": [], "facts": {}, "scores": {}, "drafts": {}}
BOOL_FIELDS = ("website_guessed", "has_video", "has_podcast", "no_solicit")

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    category TEXT DEFAULT '',
    website TEXT DEFAULT '',
    website_guessed INTEGER DEFAULT 0,
    city TEXT DEFAULT '',
    country TEXT DEFAULT '',
    address TEXT DEFAULT '',
    lat REAL,
    lon REAL,
    emails TEXT DEFAULT '[]',
    phones TEXT DEFAULT '[]',
    socials TEXT DEFAULT '{}',
    description TEXT DEFAULT '',
    team_size INTEGER,
    has_video INTEGER,
    has_podcast INTEGER,
    no_solicit INTEGER DEFAULT 0,
    crawl_note TEXT DEFAULT '',
    sources TEXT DEFAULT '[]',
    facts TEXT DEFAULT '{}',
    scores TEXT DEFAULT '{}',
    best_service TEXT DEFAULT '',
    best_score INTEGER DEFAULT 0,
    drafts TEXT DEFAULT '{}',
    status TEXT DEFAULT 'new',
    status_at TEXT,
    notes TEXT DEFAULT '',
    first_seen TEXT,
    last_seen TEXT,
    enriched_at TEXT,
    digested_at TEXT
);
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY,
    lead_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT DEFAULT '',
    url TEXT DEFAULT '',
    published TEXT DEFAULT '',
    data TEXT DEFAULT '{}',
    seen_at TEXT,
    UNIQUE (lead_key, kind, url)
);
CREATE INDEX IF NOT EXISTS signals_by_lead ON signals (lead_key);
"""


class DB:
    def __init__(self, path):
        self.path = path
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)

    def close(self):
        self.conn.close()

    # reading

    def _row(self, row):
        if row is None:
            return None
        lead = dict(row)
        for field, empty in JSON_FIELDS.items():
            lead[field] = json.loads(lead[field]) if lead.get(field) else type(empty)()
        for field in BOOL_FIELDS:
            if lead[field] is not None:
                lead[field] = bool(lead[field])
        return lead

    def get(self, lead_id):
        return self._row(self.conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone())

    def by_key(self, key):
        return self._row(self.conn.execute("SELECT * FROM leads WHERE key = ?", (key,)).fetchone())

    def find_by_name(self, name, city=""):
        return self.by_key(lead_key(name, "", city))

    def find_company(self, name):
        """A company or podcast lead with the same name, whatever key it was filed under."""
        norm = company_norm(name)
        for row in self.conn.execute("SELECT * FROM leads WHERE kind IN ('company', 'podcast')").fetchall():
            if company_norm(row["name"]) == norm:
                return self._row(row)
        return None

    def leads(self, where="1=1", params=(), order="best_score DESC, id DESC"):
        rows = self.conn.execute(f"SELECT * FROM leads WHERE {where} ORDER BY {order}", params).fetchall()
        return [self._row(r) for r in rows]

    def signals(self, key):
        rows = self.conn.execute("SELECT * FROM signals WHERE lead_key = ? ORDER BY published DESC", (key,)).fetchall()
        return [dict(r, data=json.loads(r["data"] or "{}")) for r in rows]

    def all_signals(self):
        grouped = {}
        for r in self.conn.execute("SELECT * FROM signals ORDER BY published DESC").fetchall():
            grouped.setdefault(r["lead_key"], []).append(dict(r, data=json.loads(r["data"] or "{}")))
        return grouped

    # writing

    def upsert(self, lead):
        """Insert a new lead, or merge what a source found into the existing row. Returns (key, is_new)."""
        now = now_iso()
        key = lead.key
        # A lead first seen by name (no website yet) and later with a website keeps its original row.
        existing = self.by_key(key) or (self.find_company(lead.name) if lead.kind in ("company", "podcast") else None)
        data = asdict(lead)
        signals = data.pop("signals")
        source = data.pop("source")
        if existing is None:
            data.update(key=key, sources=[source], first_seen=now, last_seen=now)
            self._insert(data)
            is_new = True
        else:
            key = existing["key"]
            merged = {"last_seen": now, "sources": sorted(set(existing["sources"]) | {source})}
            for field in ("category", "website", "city", "country", "address", "lat", "lon", "description"):
                if not existing.get(field) and data.get(field):
                    merged[field] = data[field]
                    if field == "website":
                        merged["website_guessed"] = data["website_guessed"]
            known = {e["email"] for e in existing["emails"]}
            if any(e["email"] not in known for e in data["emails"]):
                merged["emails"] = existing["emails"] + [e for e in data["emails"] if e["email"] not in known]
            if any(p not in existing["phones"] for p in data["phones"]):
                merged["phones"] = existing["phones"] + [p for p in data["phones"] if p not in existing["phones"]]
            if data["socials"]:
                merged["socials"] = {**data["socials"], **existing["socials"]}
            if data["facts"]:
                merged["facts"] = {**existing["facts"], **data["facts"]}
            self.update(existing["id"], merged)
            is_new = False
        for signal in signals:
            self.conn.execute(
                "INSERT OR IGNORE INTO signals (lead_key, kind, title, url, published, data, seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (key, signal["kind"], signal["title"], signal["url"], signal["published"], json.dumps(signal["data"]), now),
            )
        self.conn.commit()
        return key, is_new

    def _insert(self, data):
        data = {k: self._encode(k, v) for k, v in data.items()}
        cols = ", ".join(data)
        marks = ", ".join("?" for _ in data)
        self.conn.execute(f"INSERT INTO leads ({cols}) VALUES ({marks})", tuple(data.values()))

    def update(self, lead_id, fields):
        if not fields:
            return
        fields = {k: self._encode(k, v) for k, v in fields.items()}
        assignments = ", ".join(f"{k} = ?" for k in fields)
        self.conn.execute(f"UPDATE leads SET {assignments} WHERE id = ?", (*fields.values(), lead_id))
        self.conn.commit()

    def set_status(self, lead_id, status=None, notes=None):
        fields = {}
        if status is not None:
            fields.update(status=status, status_at=now_iso())
        if notes is not None:
            fields["notes"] = notes
        self.update(lead_id, fields)
        return self.get(lead_id)

    @staticmethod
    def _encode(field, value):
        if field in JSON_FIELDS:
            return json.dumps(value)
        if field in BOOL_FIELDS and value is not None:
            return int(bool(value))
        return value
