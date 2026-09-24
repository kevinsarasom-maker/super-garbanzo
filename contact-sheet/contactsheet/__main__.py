"""python -m contactsheet <command>. Run with --help to see everything."""

import argparse
import csv
import re
import sys
import webbrowser
from pathlib import Path

from . import config, digest, pipeline, web
from .db import DB
from .models import Lead, Signal, clean_url, domain_of
from .sources import SOURCES


def open_db(cfg, path=None):
    path = Path(path) if path else config.DATA_DIR / "leads.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    return DB(str(path))


def cmd_run(args, cfg, db, log):
    summary = pipeline.run(cfg, db, sources=args.source, do_enrich=not args.no_enrich, use_ai=args.ai, log=log)
    found = sum(s["found"] for s in summary["sources"].values())
    new = sum(s["new"] for s in summary["sources"].values())
    strong = len(db.leads("status = 'new' AND best_score >= ?", (cfg["digest"]["min_score"],)))
    print(f"Done: {found} leads found ({new} new), {summary['enriched']} websites checked, "
          f"{strong} strong leads waiting. Open them with: python -m contactsheet serve")


SHELTER_WORDS = re.compile(r"\b(?:humane society|spca|animal rescue|dog rescue|cat rescue|rescue|shelter|adopt(?:ion|able)?)\b", re.I)
PET_WORDS = re.compile(r"\b(?:pets?|dogs?|cats?|pupp(?:y|ies)|groom\w*|kennel|doggy|daycare|paws?|canine|feline)\b", re.I)


def classify(text):
    """Guess what kind of lead a website you added is, from its name and description."""
    if SHELTER_WORDS.search(text):
        return "shelter"
    if PET_WORDS.search(text):
        return "pet_business"
    return "company"


def cmd_add(args, cfg, db, log):
    urls = list(args.urls)
    if args.file:
        with open(args.file, newline="") as f:
            for row in csv.reader(f):
                urls += [cell for cell in row if "." in cell and " " not in cell.strip()][:1]
    ids = []
    for raw in urls:
        url = clean_url(raw)
        if not url:
            log(f"skipped {raw!r}: not a website")
            continue
        lead = Lead(name=domain_of(url), kind="company", source="manual", category="Added by you",
                    website=url, city=args.city or "", signals=[Signal(kind="manual", title="Added by hand", url=url)])
        key, _ = db.upsert(lead)
        ids.append(db.by_key(key)["id"])
    if not ids:
        return
    fetcher = pipeline.make_fetcher(cfg)
    pipeline.enrich_all(cfg, db, fetcher, log, lead_ids=set(ids))
    for lead_id in ids:
        lead = db.get(lead_id)
        kind = classify(f"{lead['name']} {lead['description']}")
        if lead["kind"] == "company" and kind != "company":
            db.update(lead_id, {"kind": kind, "category": "Shelter or rescue" if kind == "shelter" else "Pet business"})
    pipeline.rescore(cfg, db, log)
    for lead_id in ids:
        lead = db.get(lead_id)
        best = config.SERVICES.get(lead["best_service"], "no clear fit yet")
        log(f"#{lead['id']} {lead['name']}: {best} {lead['best_score'] or ''}".rstrip())


def cmd_serve(args, cfg, db, log):
    if args.open:
        webbrowser.open(f"http://localhost:{args.port}")
    web.serve(db, cfg, port=args.port, log=log)


def cmd_report(args, cfg, db, log):
    out = Path(args.output) if args.output else config.DATA_DIR / "contact-sheet.html"
    out.write_text(web.page(web.payload(db, cfg, static=True)))
    log(f"Wrote {out}")


def cmd_digest(args, cfg, db, log):
    digest.run(db, cfg, deliver=args.send, top=args.top, log=log)


def cmd_list(args, cfg, db, log):
    where, params = "status = ?", [args.status]
    if args.status == "all":
        where, params = "1=1", []
    leads = db.leads(where, tuple(params))
    if args.service:
        leads = sorted((l for l in leads if args.service in l["scores"]), key=lambda l: -l["scores"][args.service]["score"])
    for lead in leads[: args.top]:
        service = args.service or lead["best_service"]
        fit = lead["scores"].get(service, {"score": 0, "reasons": []})
        email = lead["emails"][0]["email"] if lead["emails"] else "-"
        print(f"#{lead['id']:<5} {fit['score']:>3}  {config.SERVICES.get(service, '?'):<21} {lead['name'][:34]:<34} {email}")
        if fit["reasons"]:
            print(f"{'':12}{fit['reasons'][0]}")


def cmd_export(args, cfg, db, log):
    out = Path(args.output) if args.output else config.DATA_DIR / "leads.csv"
    leads = db.leads("best_score >= ?", (args.min_score,))
    with open(out, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "name", "status", "best_service", "score", "why", "email", "phone", "website",
                         "city", "category", "instagram", "linkedin", "draft_subject", "draft_body", "notes"])
        for lead in leads:
            service = lead["best_service"]
            draft = lead["drafts"].get(service, {})
            writer.writerow([
                lead["id"], lead["name"], lead["status"], config.SERVICES.get(service, ""), lead["best_score"],
                "; ".join(lead["scores"].get(service, {}).get("reasons", [])),
                lead["emails"][0]["email"] if lead["emails"] else "", lead["phones"][0] if lead["phones"] else "",
                lead["website"], lead["city"], lead["category"], lead["socials"].get("instagram", ""),
                lead["socials"].get("linkedin", ""), draft.get("subject", ""), draft.get("body", ""), lead["notes"],
            ])
    log(f"Wrote {len(leads)} leads to {out}")


def cmd_mark(args, cfg, db, log):
    lead = db.get(args.id)
    if not lead:
        sys.exit(f"No lead #{args.id}")
    lead = db.set_status(args.id, status=args.status, notes=args.note)
    log(f"#{lead['id']} {lead['name']} is now {lead['status']}")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="contactsheet", description="Contact Sheet: find, score and draft leads for kevinsarasom.com.")
    parser.add_argument("--config", help="path to config.toml (default: the one next to this package)")
    parser.add_argument("--db", help="path to the SQLite database (default: data/leads.db)")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("run", help="find new leads, check their websites, score them and write drafts")
    p.add_argument("--source", nargs="+", choices=list(SOURCES), help="only these sources (default: all)")
    p.add_argument("--no-enrich", action="store_true", help="skip visiting websites")
    p.add_argument("--ai", action="store_true", help="have Claude personalize the best drafts (needs ANTHROPIC_API_KEY)")
    p.add_argument("--quiet", action="store_true", help="print totals only, no lead names (for public CI logs)")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("add", help="add companies you already have in mind, by website")
    p.add_argument("urls", nargs="*", help="websites, like acme.com")
    p.add_argument("--file", help="a text or CSV file with one website per line")
    p.add_argument("--city", help="city to file them under")
    p.set_defaults(func=cmd_add)

    p = sub.add_parser("serve", help="open the dashboard at http://localhost:8765")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--open", action="store_true", help="open it in your browser")
    p.set_defaults(func=cmd_serve)

    p = sub.add_parser("report", help="write the dashboard as a single HTML file you can open anywhere")
    p.add_argument("-o", "--output")
    p.set_defaults(func=cmd_report)

    p = sub.add_parser("digest", help="email yourself the best new leads (or write them to a file)")
    p.add_argument("--send", action="store_true", help="send by email if SMTP is set up")
    p.add_argument("--top", type=int)
    p.add_argument("--quiet", action="store_true")
    p.set_defaults(func=cmd_digest)

    p = sub.add_parser("list", help="print leads in the terminal")
    p.add_argument("--status", default="new", choices=config.STATUSES + ["all"])
    p.add_argument("--service", choices=list(config.SERVICES))
    p.add_argument("--top", type=int, default=20)
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("export", help="save leads and drafts as a CSV")
    p.add_argument("-o", "--output")
    p.add_argument("--min-score", type=int, default=0)
    p.set_defaults(func=cmd_export)

    p = sub.add_parser("mark", help="set a lead's status")
    p.add_argument("id", type=int)
    p.add_argument("status", choices=config.STATUSES)
    p.add_argument("--note")
    p.set_defaults(func=cmd_mark)

    args = parser.parse_args(argv)
    cfg = config.load(args.config)
    quiet = getattr(args, "quiet", False)
    log = (lambda *a, **k: None) if quiet else print
    db = open_db(cfg, args.db)
    try:
        args.func(args, cfg, db, log)
    finally:
        db.close()


if __name__ == "__main__":
    main()
