"""Business podcasts from the Apple Podcasts directory (free, no key), sized up for a Nomadic Pods pitch."""

import re
import statistics
from concurrent.futures import ThreadPoolExecutor
from datetime import timezone
from email.utils import parsedate_to_datetime

import requests

from ..extract import places_in_text
from ..models import Lead, Signal, clean_url, days_since, domain_of

SEARCH = "https://itunes.apple.com/search"

# Hosting platforms: a feed that links here instead of its own site is probably a hobby show.
HOSTING = (
    "anchor.fm", "spotify.com", "buzzsprout.com", "libsyn.com", "podbean.com", "substack.com", "transistor.fm",
    "simplecast.com", "megaphone.fm", "captivate.fm", "spreaker.com", "soundcloud.com", "apple.com", "iheart.com",
    "podomatic.com", "blubrry.com", "redcircle.com", "acast.com", "omny.fm", "audioboom.com", "art19.com",
    "pinecast.com", "fireside.fm", "castos.com", "riverside.fm", "podigee.io", "podcastics.com", "zencast.fm",
    "rss.com", "podpage.com", "linktr.ee", "youtube.com", "instagram.com", "facebook.com", "linkedin.com",
    "blubrry.net", "castbox.fm", "podcastpage.io", "podcasts.com", "audible.com", "amazon.com", "wordpress.com",
    "hubspot.com", "podetize.com", "lnk.to", "feeds.feedburner.com", "podcastics.com", "ivoox.com",
)
CANADA = re.compile(r"\b(?:Canada|Canadian|Toronto|Ontario|Vancouver|Montr[eé]al|Calgary|Ottawa|Edmonton|Winnipeg|Halifax|Waterloo|GTA)\b")
COMPANY_WORDS = re.compile(
    r"\b(inc|ltd|llc|llp|corp|group|capital|partners|ventures|media|labs|bank|law|legal|realty|properties|"
    r"consulting|agency|studio|studios|solutions|advisors|advisory|wealth|financial|technologies|tech|network|"
    r"institute|association|foundation|co|company|collective|hq|academy|club)\b",
    re.I,
)


def is_hosting(url):
    host = domain_of(url)
    return not host or any(host == h or host.endswith("." + h) for h in HOSTING)


def analyze_feed(xml):
    """Episode count, cadence, video and contact details from a podcast RSS feed.

    Uses regexes rather than an XML parser so a feed cut off at the size limit still yields something.
    """
    head = xml.split("<item", 1)[0]
    link = re.search(r"<link>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)", head)
    language = re.search(r"<language>\s*(?:<!\[CDATA\[)?\s*([A-Za-z-]+)", head)
    about = re.search(r"<(description|itunes:summary)>(.*?)</\1>", head, re.S)
    about_text = re.sub(r"<[^>]+>", " ", re.sub(r"<!\[CDATA\[|\]\]>", " ", about.group(2))) if about else ""
    about_text = re.sub(r"&[a-z#0-9]+;", " ", about_text)
    owner_email = re.search(r"<itunes:email>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)", head)
    owner_name = re.search(r"<itunes:name>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*</itunes:name>", head)
    items = xml.split("<item")[1:]
    dates = []
    video = False
    for item in items:
        pub = re.search(r"<pubDate>\s*([^<]+?)\s*</pubDate>", item)
        if pub:
            try:
                dates.append(parsedate_to_datetime(pub.group(1)))
            except (TypeError, ValueError):
                pass
        if re.search(r'<enclosure[^>]*type="video/', item) or re.search(r'<media:content[^>]*medium="video"', item):
            video = True
    dates = sorted((d if d.tzinfo else d.replace(tzinfo=timezone.utc) for d in dates), reverse=True)
    gaps = [(a - b).days for a, b in zip(dates[:11], dates[1:11])]
    return {
        "link": clean_url(link.group(1)) if link else "",
        "language": language.group(1).lower() if language else "",
        "about": re.sub(r"\s+", " ", about_text).strip()[:600],
        "head_text": re.sub(r"<[^>]+>", " ", head)[:6000],
        "owner_email": owner_email.group(1).strip().lower() if owner_email else "",
        "owner_name": owner_name.group(1).strip() if owner_name else "",
        "episodes": len(items),
        "last_episode": dates[0].isoformat() if dates else "",
        "cadence_days": int(statistics.median(gaps)) if gaps else None,
        "video": video,
    }


CREDENTIALS = re.compile(r",?\s+(?:CFP|CFA|CPA|CA|MBA|PhD|JD|Esq|CIM|FCSI|CLU|CHS|PFP|P\.?Eng|LLB)\b[®.]?", re.I)
PERSON = re.compile(r"^[A-Z][a-zA-Z'’\-]+(?: [A-Z]\.?)?(?: [A-Z][a-zA-Z'’\-]+){1,2}$")


def looks_like_company(name):
    return bool(COMPANY_WORDS.search(name or ""))


def split_publisher(publisher):
    """'CJ Stevens, CFP® at Philotimo Wealth' -> ('Philotimo Wealth', 'CJ Stevens');
    'Hawkeye Wealth | Canadian Private Real Estate' -> ('Hawkeye Wealth', '')."""
    text = CREDENTIALS.sub("", (publisher or "").strip()).strip(" ,")
    person, company = "", text
    left, _, right = text.partition(" at ")
    if right and PERSON.match(left.strip(" ,")):
        person, company = left.strip(" ,"), right.strip(" ,")
    elif re.search(r" [|-] |: ", text):
        first, rest = [part.strip() for part in re.split(r" [|-] |: ", text, maxsplit=1)]
        person, company = (first, rest) if PERSON.match(first) and looks_like_company(rest) else ("", first)
    if not person and PERSON.match(company) and not looks_like_company(company):
        person = company
    return company, person if PERSON.match(person or "") else ""


def collect(cfg, fetcher, db, log):
    settings = cfg["sources"]["podcasts"]
    genres = {g.lower() for g in settings["genres"]}
    skip = [p.lower() for p in settings["skip_publishers"]]
    seen, picks = set(), []
    for country in settings["countries"]:
        for term in settings["terms"]:
            try:
                results = fetcher.get_json(SEARCH, params={
                    "term": term, "media": "podcast", "entity": "podcast",
                    "country": country, "limit": settings["results_per_term"],
                }, delay=3).get("results", [])
            except (requests.RequestException, ValueError) as exc:
                log(f"  podcasts: search for {term!r} failed ({type(exc).__name__})")
                continue
            kept = 0
            for r in results:
                pid = r.get("collectionId")
                if not pid or pid in seen or not r.get("feedUrl"):
                    continue
                seen.add(pid)
                publisher = r.get("artistName", "")
                if any(s in publisher.lower() or s in r.get("collectionName", "").lower() for s in skip):
                    continue
                if genres and not genres & {g.lower() for g in r.get("genres", [])}:
                    continue
                age = days_since(r.get("releaseDate", "").replace("Z", "+00:00"))
                if age is None or age > settings["skip_after_days"]:
                    continue
                picks.append((r, country, term))
                kept += 1
            log(f"  podcasts: {kept} from {term!r} ({country})")
    log(f"  podcasts: reading {len(picks)} feeds")
    languages = tuple(l.lower() for l in settings.get("languages", []))
    home = [t for t in cfg["home"]["terms"] + [cfg["home"]["city"]] if t]
    with ThreadPoolExecutor(max_workers=cfg["bot"]["workers"]) as pool:
        for lead in pool.map(lambda pick: podcast_lead(*pick, fetcher=fetcher, home=home), picks):
            if not lead:
                continue
            language = lead.facts["podcast"]["language"]
            if languages and language and not language.startswith(languages):
                continue
            yield lead


def podcast_lead(result, country, term, fetcher, home=()):
    try:
        page = fetcher.get(result["feedUrl"], robots=False)
        feed = analyze_feed(page.text) if page.ok else {}
    except requests.RequestException:
        feed = {}
    show = result.get("collectionName", "").strip()
    publisher = result.get("artistName", "").strip()
    site = feed.get("link", "")
    owns_site = bool(site) and not is_hosting(site)
    last = feed.get("last_episode") or result.get("releaseDate", "").replace("Z", "+00:00")
    company, person = split_publisher(publisher)
    name = company if company and (looks_like_company(company) or owns_site) else show
    email = feed.get("owner_email", "")
    text = " ".join([show, publisher, feed.get("head_text", "")])
    canadian = bool(CANADA.search(text)) or domain_of(site).endswith(".ca") or email.endswith(".ca")
    local = places_in_text(text, home)
    podcast = {
        "name": show,
        "publisher": publisher,
        "host": person or feed.get("owner_name", ""),
        "episodes": feed.get("episodes") or result.get("trackCount") or 0,
        "last_episode": last,
        "days_since_last": days_since(last),
        "cadence_days": feed.get("cadence_days"),
        "video": feed.get("video", False),
        "owns_site": owns_site,
        "company_like": looks_like_company(publisher),
        "apple_url": result.get("collectionViewUrl", ""),
        "genre": result.get("primaryGenreName", ""),
        "language": feed.get("language", ""),
        "canadian": canadian,
        "local": local,
        "search_term": term,
    }
    return Lead(
        name=name or show,
        kind="podcast",
        source="podcasts",
        category=f"Podcast, {podcast['genre'] or 'Business'}",
        website=site if owns_site else "",
        description=feed.get("about", ""),
        country=country.upper(),
        emails=[{"email": email, "source": result["feedUrl"]}] if "@" in email and not is_hosting("https://" + email.split("@")[1]) else [],
        facts={"podcast": podcast},
        signals=[Signal(kind="podcast", title=f"Podcast: {show}", url=podcast["apple_url"], published=last,
                        data={"episodes": podcast["episodes"], "video": podcast["video"]})],
    )
