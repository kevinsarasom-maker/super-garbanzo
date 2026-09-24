"""Companies in the news with a reason to hire a photographer now: funding, new offices, launches, pet brands."""

import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from email.utils import parsedate_to_datetime

import requests

from .. import extract
from ..models import Lead, Signal
from ..net import Blocked

GOOGLE_NEWS = "https://news.google.com/rss/search"

VERBS = (r"raises|raised|secures|closes|lands|nabs|bags|snags|scores|announces|opens|launches|expands|unveils|"
         r"debuts|hosts|acquires|hires|appoints|partners|brings|celebrates")
DESCRIPTORS = (r"startup|start-up|company|firm|platform|maker|provider|brand|fintech|proptech|agency|developer|"
               r"retailer|studio|app|scaleup|scale-up|unicorn|leader|specialist|chain|label|business")
LOWER_OK = {"&", "and", "of", "the", "de", "for", "x"}
# "raises" and "opens" in headlines that aren't about a company growing.
NOT_GROWTH = re.compile(
    r"\b(?:raises|raised)\s+(?:the\s+)?(?:price target|target|stake|concerns?|questions?|alarm|awareness|prices?|rates?|"
    r"forecast|guidance|dividend|outlook|funds? for|money for|bar|eyebrows|flags?|doubts?|hopes?|fears?|ceiling|limit)\b"
    r"|\b(?:raises|raised)\b(?:\s+\S+){0,4}?\s+(?:stake|price target|target price|dividend|guidance|forecast|outlook)\b"
    r"|\bopens?\s+(?:up|fire|probe|investigation|inquiry|the door|door)\b",
    re.I,
)
PET_WORDS = re.compile(r"\b(?:pets?|dogs?|cats?|pupp(?:y|ies)|canine|feline|animal|vet|veterinary|kibble|treats)\b", re.I)
FUNDING_WORDS = re.compile(r"\$|\b(?:seed|series|round|funding|financing|fund|investment|capital)\b", re.I)
KEYWORD_STOP = {
    "raises", "raised", "million", "billion", "series", "funding", "round", "startup", "company", "based",
    "toronto", "canadian", "canada", "ontario", "secures", "closes", "launches", "opens", "expands", "office",
    "with", "from", "into", "this", "that", "their", "after", "about", "seed", "back", "backed", "announces",
    "brand", "firm", "global", "growth", "investment", "investors", "led", "new", "plans", "scale", "help",
}


def headline_of(title, publisher):
    if publisher and title.endswith(" - " + publisher):
        return title[: -len(publisher) - 3].strip()
    return re.sub(r"\s+-\s+[^-]+$", "", title).strip()


def company_from_headline(headline):
    """'Cement decarbonization startup CURA raises $10M' -> 'CURA'. Returns '' when unsure."""
    match = re.match(rf"^(?P<subject>.+?),?\s+(?:{VERBS})\b", headline, re.I)
    if not match:
        return ""
    if NOT_GROWTH.search(headline):
        return ""
    subject = match.group("subject")
    subject = re.sub(r"^\s*[\[{(][^\]})]*[\]})]\s*", "", subject)  # "{Funding Alert} Acme" -> "Acme"
    subject = subject.rsplit(": ", 1)[-1]  # "Exclusive: Acme" -> "Acme"
    subject = re.split(rf"\b(?:{DESCRIPTORS})\b", subject, flags=re.I)[-1]
    subject = re.sub(r"^(?:[\w-]+-based|[\w.]+['’]s)\s+", "", subject.strip(" ,:;'\"‘’“”"))
    subject = subject.strip(" ,:;'\"‘’“”")
    words = subject.split()
    if not 1 <= len(words) <= 5 or len(subject) > 40:
        return ""
    for word in words:
        if word.lower() in LOWER_OK:
            continue
        if not (word[0].isupper() or word[0].isdigit()):
            return ""
    return subject


def funding_details(headline):
    amount = re.search(r"((?:US|CA|C)?\$\s?[\d.,]+(?:\s?-?\s?(?:million|billion|thousand|[MBK])\b)?)", headline, re.I)
    stage = re.search(r"\b(pre-seed|seed|series [a-h]|growth round|bridge round)\b", headline, re.I)
    tidy = None
    if amount:
        tidy = re.sub(r"\s?-?\s?million", "M", amount.group(1), flags=re.I)
        tidy = re.sub(r"\s?-?\s?billion", "B", tidy, flags=re.I).replace(" ", "")
    stage_text = stage.group(1).lower() if stage else None
    if stage_text and stage_text.startswith("series"):
        stage_text = "Series " + stage_text[-1].upper()
    return tidy, stage_text


def parse_feed(xml_text):
    items = []
    root = ET.fromstring(xml_text)
    for item in root.iter("item"):
        source = item.find("source")
        publisher = source.text.strip() if source is not None and source.text else ""
        published = ""
        try:
            published = parsedate_to_datetime(item.findtext("pubDate", "")).isoformat()
        except (TypeError, ValueError):
            pass
        items.append({
            "title": headline_of(item.findtext("title", ""), publisher),
            "url": item.findtext("link", ""),
            "publisher": publisher,
            "published": published,
        })
    return items


def excluded(headline, word):
    if re.fullmatch(r"\w+", word):
        return bool(re.search(rf"\b{re.escape(word)}\b", headline, re.I))
    return word.lower() in headline.lower()  # symbols like £ sit right next to numbers


def keywords(headline, name):
    name_words = {w.lower() for w in re.findall(r"[A-Za-z]+", name)}
    return {w.lower() for w in re.findall(r"[A-Za-z]{5,}", headline)} - KEYWORD_STOP - name_words


def mentions(text, words):
    return any(re.search(rf"\b{re.escape(w)}", text) for w in words)


def guess_website(name, headline, fetcher):
    """Try the obvious domains for a company name and keep one only if the page backs it up."""
    base = re.sub(r"[^a-z0-9]", "", name.lower().replace("&", "and"))
    if len(base) < 4:
        return ""
    hints = keywords(headline, name)
    name_bits = [w.lower() for w in re.findall(r"[A-Za-z0-9]{2,}", name)]
    for tld in (".com", ".ca", ".io", ".ai"):
        url = f"https://{base}{tld}"
        try:
            page = fetcher.get(url)
        except (Blocked, requests.RequestException):
            continue
        if not page.ok or not page.is_html:
            continue
        soup = extract.soup_of(page.text)
        title = f"{extract.site_name(soup)} {soup.title.get_text(' ') if soup.title else ''}".lower()
        if re.search(r"for sale|domain|parked|buy this|coming soon|under construction", title):
            continue
        if not all(bit in title for bit in name_bits):
            continue
        body = soup.get_text(" ", strip=True).lower()
        if hints and not mentions(body, hints):
            continue
        return page.url
    return ""


def collect(cfg, fetcher, db, log):
    settings = cfg["sources"]["news"]
    skip = {s.lower() for s in settings["skip_names"]}
    exclude = [w for w in settings.get("exclude_words", []) if w]
    home = [t.lower() for t in cfg["home"]["terms"]] + [cfg["home"]["city"].lower()]
    places = [p for p in home + [c["name"].lower() for c in cfg["cities"]] if p]
    hits, seen = [], set()
    for query in settings["queries"]:
        params = {"q": f"{query['q']} when:{settings['days']}d", "hl": "en-CA", "gl": "CA", "ceid": "CA:en"}
        try:
            page = fetcher.get(GOOGLE_NEWS, params=params, robots=False, delay=3)
            items = parse_feed(page.text) if page.ok else []
        except (requests.RequestException, ET.ParseError) as exc:
            log(f"  news: {query['q']!r} failed ({type(exc).__name__})")
            continue
        kept = 0
        for item in items:
            name = company_from_headline(item["title"])
            if not name or name.lower() in skip or (name.lower(), item["title"]) in seen:
                continue
            if any(excluded(item["title"], w) for w in exclude):
                continue
            if query["signal"] == "funding" and not FUNDING_WORDS.search(item["title"]):
                continue
            if query["signal"] == "pet_brand" and not PET_WORDS.search(item["title"]):
                continue
            if query.get("local") and not any(re.search(rf"\b{re.escape(p)}\b", item["title"], re.I) for p in places):
                continue
            seen.add((name.lower(), item["title"]))
            hits.append((query, item, name))
            kept += 1
        log(f"  news: {kept} from {query['q']!r}")

    # Look up websites for new names in parallel; the fetcher still spaces out hits to any one site.
    websites = {}
    for _, _, name in hits:
        known = db.find_company(name)
        if known and known["website"]:
            websites[name] = (known["website"], known["website_guessed"])
    todo = {}
    for _, item, name in hits:
        if name not in websites:
            todo.setdefault(name, item["title"])
    if todo and settings["guess_websites"]:
        log(f"  news: looking up websites for {len(todo)} companies")
        with ThreadPoolExecutor(max_workers=cfg["bot"]["workers"]) as pool:
            futures = {pool.submit(guess_website, name, title, fetcher): name for name, title in todo.items()}
            for future in as_completed(futures):
                url = future.result()
                if url and futures[future] not in websites:
                    websites[futures[future]] = (url, True)

    for query, item, name in hits:
        amount, stage = funding_details(item["title"])
        website, guessed = websites.get(name, ("", False))
        local = any(re.search(rf"\b{re.escape(t)}\b", item["title"], re.I) for t in home if t)
        yield Lead(
            name=name,
            kind="company",
            source="news",
            category={"funding": "Just raised", "expansion": "Expanding", "launch": "Launching",
                      "pet_brand": "Pet brand"}.get(query["signal"], "In the news"),
            website=website,
            website_guessed=bool(guessed),
            city=cfg["home"]["city"] if local else "",
            signals=[Signal(kind=query["signal"], title=item["title"], url=item["url"], published=item["published"],
                            data={"publisher": item["publisher"], "amount": amount, "round": stage, "query": query["q"]})],
        )
