"""The digest: the best new leads since the last one, emailed to you (or written to a file)."""

import html
import os
import smtplib
import ssl
from datetime import date
from email.message import EmailMessage

from .config import DATA_DIR, SERVICES
from .models import domain_of, now_iso


def pick(db, cfg, top=None):
    top = top or cfg["digest"]["top"]
    leads = db.leads("status = 'new' AND digested_at IS NULL AND best_score >= ?", (cfg["digest"]["min_score"],))
    # Leads you can email come first; "no cold email" ones still show, lower down.
    return sorted(leads, key=lambda lead: (bool(lead["no_solicit"]), -lead["best_score"]))[:top]


def render(leads, cfg):
    esc = html.escape
    d = date.today()
    today = f"{d:%B} {d.day}, {d.year}"
    rows_html, rows_text = [], []
    for lead in leads:
        service = lead["best_service"]
        fit = lead["scores"].get(service, {})
        draft = lead["drafts"].get(service, {})
        email = lead["emails"][0]["email"] if lead["emails"] else ""
        where = " · ".join(filter(None, [lead["category"], lead["city"]]))
        reasons = fit.get("reasons", [])[:3]
        link = lead["website"] or ""
        warn = ("<p style='margin:6px 0 0;font:14px/1.5 Inter,Arial,sans-serif;color:#b3261e'>Their site asks for no "
                "unsolicited email. Use their contact form or call instead.</p>") if lead["no_solicit"] else ""
        rows_html.append(f"""
<tr><td style="padding:16px 0;border-top:1px solid #e3ded3">
  <div style="font:600 12px/1.4 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a0561a">{esc(SERVICES.get(service, service))} · {lead['best_score']}</div>
  <div style="font:700 18px/1.3 Inter,Arial,sans-serif;color:#151412;margin-top:2px">{esc(lead['name'])}</div>
  <div style="font:14px/1.4 Inter,Arial,sans-serif;color:#6b665c">{esc(where)}{' · <a href="' + esc(link) + '" style="color:#6b665c">' + esc(domain_of(link)) + '</a>' if link else ''}</div>
  <ul style="margin:8px 0 0;padding-left:18px;font:14px/1.5 Inter,Arial,sans-serif;color:#2a2824">{''.join(f'<li>{esc(r)}</li>' for r in reasons)}</ul>
  <div style="font:14px/1.5 Inter,Arial,sans-serif;color:#2a2824;margin-top:6px"><b>Draft:</b> {esc(draft.get('subject', ''))}{' → ' + esc(email) if email else ' (no email found, see their site)'}</div>{warn}
</td></tr>""")
        rows_text.append(f"{lead['name']} ({where}) · {SERVICES.get(service, service)} {lead['best_score']}\n"
                         + "".join(f"  - {r}\n" for r in reasons)
                         + f"  Draft: {draft.get('subject', '')}{' -> ' + email if email else ''}\n")
    intro = f"{len(leads)} new lead{'s' if len(leads) != 1 else ''} worth a look. Open the dashboard (python -m contactsheet serve) to read the drafts, circle the keepers and send."
    body_html = f"""<!doctype html><html><body style="margin:0;background:#f3f0e8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0e8"><tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fffdf8;border:1px solid #e3ded3;border-radius:6px"><tr><td style="padding:24px">
  <div style="font:700 28px/1 'Bebas Neue',Impact,Arial Narrow,sans-serif;letter-spacing:.04em;color:#151412">CONTACT SHEET</div>
  <div style="font:14px/1.5 Inter,Arial,sans-serif;color:#6b665c;margin:6px 0 8px">{esc(today)} · {esc(intro)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{''.join(rows_html)}</table>
</td></tr></table></td></tr></table></body></html>"""
    body_text = f"CONTACT SHEET · {today}\n{intro}\n\n" + "\n".join(rows_text)
    return f"Contact Sheet: {len(leads)} new lead{'s' if len(leads) != 1 else ''}", body_html, body_text


def smtp_settings():
    env = os.environ
    settings = {
        "host": env.get("CONTACT_SHEET_SMTP_HOST", ""),
        "port": int(env.get("CONTACT_SHEET_SMTP_PORT") or 587),
        "user": env.get("CONTACT_SHEET_SMTP_USER", ""),
        "password": env.get("CONTACT_SHEET_SMTP_PASSWORD", ""),
        "to": env.get("CONTACT_SHEET_DIGEST_TO", ""),
    }
    settings["from"] = env.get("CONTACT_SHEET_DIGEST_FROM", settings["user"])
    return settings if settings["host"] and settings["to"] and settings["from"] else None


def send(subject, body_html, body_text, settings):
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings["from"]
    message["To"] = settings["to"]
    message.set_content(body_text)
    message.add_alternative(body_html, subtype="html")
    context = ssl.create_default_context()
    if settings["port"] == 465:
        with smtplib.SMTP_SSL(settings["host"], settings["port"], context=context, timeout=30) as smtp:
            if settings["user"]:
                smtp.login(settings["user"], settings["password"])
            smtp.send_message(message)
    else:
        with smtplib.SMTP(settings["host"], settings["port"], timeout=30) as smtp:
            smtp.starttls(context=context)
            if settings["user"]:
                smtp.login(settings["user"], settings["password"])
            smtp.send_message(message)


def run(db, cfg, deliver=False, top=None, log=print):
    leads = pick(db, cfg, top)
    if not leads:
        log("digest: nothing new above the score threshold")
        return None
    subject, body_html, body_text = render(leads, cfg)
    settings = smtp_settings() if deliver else None
    if deliver and not settings:
        log("digest: email isn't set up (see README, 'Weekly email digest'); writing a file instead")
    if settings:
        send(subject, body_html, body_text, settings)
        log(f"digest: emailed {len(leads)} leads")
        where = "email"
    else:
        DATA_DIR.mkdir(exist_ok=True)
        path = DATA_DIR / f"digest-{date.today().isoformat()}.html"
        path.write_text(body_html)
        log(f"digest: {len(leads)} leads written to {path}")
        where = str(path)
    stamp = now_iso()
    for lead in leads:
        db.update(lead["id"], {"digested_at": stamp})
    return where
