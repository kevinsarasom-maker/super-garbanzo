"""Turns a scored lead into ready-to-review email drafts, one per service that fits."""

import re

from .config import TEMPLATES_DIR
from .score import freshness, money

TOUR_LIST = "Toronto, Vancouver, New York, Chicago, San Francisco, Los Angeles and Austin"
PERSON = re.compile(r"^[A-Z][a-z'’\-]+(?: [A-Z][a-z'’\-]+){1,2}$")


class _Blank(dict):
    def __missing__(self, key):
        return ""


def template(name):
    text = (TEMPLATES_DIR / f"{name}.txt").read_text()
    first, _, body = text.partition("\n")
    if first.lower().startswith("subject:"):
        return first.split(":", 1)[1].strip(), body.strip("\n")
    return "", text


def fresh_signal(signals, kind):
    for signal in signals:
        if signal["kind"] == kind and freshness(signal.get("published")) > 0:
            return signal
    return None


def ago(days):
    if days is None:
        return "a while ago"
    if days < 60:
        return f"{days} days ago"
    months = round(days / 30)
    return f"about {months} months ago" if months < 18 else "over a year ago"


def greeting(lead):
    pod = (lead.get("facts") or {}).get("podcast", {})
    host = pod.get("host") or (pod.get("publisher") if lead["kind"] == "podcast" else "")
    if host and PERSON.match(host) and not re.search(r"team|group|media|studio", host, re.I):
        return f"Hi {host.split()[0]},"
    return f"Hi {lead['name']} team,"


def hook(service, lead, signals, cfg):
    name = lead["name"]
    city = lead.get("city") or cfg["home"]["city"]
    funding = fresh_signal(signals, "funding")
    expansion = fresh_signal(signals, "expansion")
    launch = fresh_signal(signals, "launch")
    pet_brand = fresh_signal(signals, "pet_brand")
    pod = (lead.get("facts") or {}).get("podcast", {})
    team = lead.get("team_size")

    if service == "headshots":
        if funding:
            return (f"Congrats on the {money(funding['data'])} raise. When a team grows that fast, "
                    "the About page is usually the first thing to fall behind.")
        if expansion:
            return f"I saw the news about {name}'s expansion. Congratulations! New office, new faces."
        if team:
            return f"I was on your team page. With around {team} people, a matching set of portraits could be worth doing."
        return f"I came across {name} and wanted to reach out about headshots."

    if service == "nomadic_pods":
        if pod:
            age = pod.get("days_since_last")
            if age is not None and age > cfg["sources"]["podcasts"]["stale_after_days"]:
                return (f"I came across {pod['name']} and noticed the last episode went out {ago(age)}. "
                        "I know how hard it is to keep a show going on top of the day job.")
            if not pod.get("video"):
                return (f"I came across {pod['name']}. It's audio-only right now, which means no clips "
                        "to share on LinkedIn or YouTube.")
            return f"I came across {pod['name']} while looking at {pod.get('genre', 'business').lower()} podcasts."
        if funding:
            return (f"Congrats on the {money(funding['data'])} raise. That's usually when everyone wants to hear "
                    "the story: customers, candidates and the next round of investors.")
        if lead.get("has_podcast"):
            return f"I saw that {name} has a podcast."
        return f"I came across {name} and had an idea for your content."

    if service == "experiential":
        if launch:
            return f"I saw the news: {launch['title']}. Congratulations!"
        if pet_brand:
            return f"I saw {name} in the news recently ({pet_brand['title']})."
        if expansion:
            return "Congrats on the expansion. A new office is a great excuse for a party."
        if lead["kind"] == "pet_business":
            return f"{name} came up while I was looking for pet businesses in {city} that could host a pop-up."
        return f"I came across {name} and had an idea for your next event."

    if service == "off_leash":
        if pet_brand:
            return f"I saw {name} in the news recently ({pet_brand['title']}), and it got me thinking about a shoot."
        return f"{name} came up while I was planning Off Leash Studio's {city} stop."

    if service == "pet_rescue":
        if lead["kind"] == "shelter":
            return f"{name} came up while I was looking for rescues in {city} to work with."
        if pet_brand:
            return (f"I saw {name} in the news recently and wondered whether you'd want to support "
                    "rescue animals in a very visible way.")
        return f"{name} came up while I was looking for {city} pet businesses that care about rescue."
    return f"I came across {name}."


def signoff(cfg):
    sender = cfg["sender"]
    business = " · ".join(filter(None, [sender["business"] if sender["business"] != sender["name"] else "", sender["website"]]))
    contact = " · ".join(filter(None, [sender["email"], sender["phone"]]))
    address = sender["mailing_address"] or "[ADD YOUR MAILING ADDRESS IN config.toml: CASL REQUIRES IT]"
    _, body = template("signoff")
    values = _Blank(name=sender["name"], business_line=business, contact_line=contact, mailing_address=address)
    # Drop lines whose placeholder came out empty, but keep the template's own blank lines.
    lines = [line.format_map(values) for line in body.split("\n")]
    return "\n".join(out for raw, out in zip(body.split("\n"), lines) if out.strip() or not raw.strip()).strip()


def template_for(service, lead):
    if service == "pet_rescue" and lead["kind"] != "shelter":
        return "pet_rescue_sponsor"
    return service


def draft(service, lead, signals, cfg, opener=None, subject=None):
    tmpl_subject, body = template(template_for(service, lead))
    city = lead.get("city") or (TOUR_LIST if service == "off_leash" else cfg["home"]["city"])
    values = _Blank(
        company=lead["name"],
        city=city,
        greeting=greeting(lead),
        hook=opener or hook(service, lead, signals, cfg),
        signoff=signoff(cfg),
    )
    text = body.format_map(values)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return {
        "subject": subject or tmpl_subject.format_map(values),
        "body": text,
        "to": lead["emails"][0]["email"] if lead.get("emails") else "",
        "ai": bool(opener),
    }


def draft_all(lead, signals, scores, cfg, keep=None):
    """A draft for every service scoring at least draft_min_score. Drafts in `keep` that were
    written by Claude or edited by hand survive a re-run."""
    keep = keep or {}
    drafts = {}
    for service, fit in scores.items():
        if fit["score"] < cfg["bot"]["draft_min_score"]:
            continue
        previous = keep.get(service)
        if previous and (previous.get("ai") or previous.get("edited")):
            drafts[service] = previous
        else:
            drafts[service] = draft(service, lead, signals, cfg)
    return drafts
