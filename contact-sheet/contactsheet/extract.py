"""Pulls contact details and buying signals out of a business's web pages."""

import re
from urllib.parse import unquote, urljoin, urlparse

from bs4 import BeautifulSoup

from .models import domain_of, social_kind

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}")
JUNK_EMAIL_DOMAINS = {
    "example.com", "domain.com", "email.com", "yourdomain.com", "yoursite.com", "sentry.io",
    "wixpress.com", "sentry-next.wixpress.com", "godaddy.com", "squarespace.com", "shopify.com",
}
JUNK_EMAIL_SUFFIXES = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".css", ".js")
FREEMAIL = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "live.com", "me.com", "aol.com", "protonmail.com"}
PREFERRED_INBOXES = ["hello", "hi", "info", "contact", "studio", "team", "partnerships", "marketing", "events", "press", "media", "admin", "office"]
LAST_RESORT = re.compile(r"^(careers?|jobs|hr|recruit\w*|hiring|support|help|billing|accounts?|invoices?|privacy|legal|abuse|webmaster|security|orders?|returns)$")

PAGE_HINTS = re.compile(r"contact|about|team|people|staff|leadership|our-story|who-we-are|meet|crew|partners|sponsor|volunteer", re.I)
TEAM_HINTS = re.compile(r"team|people|staff|leadership|meet|crew|who-we-are|about", re.I)
NO_SOLICIT = re.compile(
    r"(no|not accept|do not (send|want)|don'?t (send|want))[^.]{0,60}(unsolicited|solicitation)"
    r"|unsolicited (commercial )?(e-?mails?|messages|solicitations?) (are|is) not|no solicit",
    re.I,
)
PERSON_NAME = re.compile(r"^[A-Z][a-zA-Z'’\-]+(?: [A-Z]\.?)?(?: [A-Z][a-zA-Z'’\-]+){1,2}$")
NOT_NAMES = re.compile(
    r"^(About|Our|Meet|Contact|The|Get|Book|Learn|Read|View|Join|Home|Services|Team|Leadership|Privacy|Terms|"
    r"Follow|Sign|Log|Shop|Visit|More|Latest|Recent|All|Case|Customer|Client|Board|Why|How|What|New|Open)\b"
)


def soup_of(html):
    return BeautifulSoup(html, "html.parser")


def decode_cfemail(hex_string):
    """Cloudflare hides emails as hex XOR-ed with the first byte."""
    try:
        key = int(hex_string[:2], 16)
        return "".join(chr(int(hex_string[i:i + 2], 16) ^ key) for i in range(2, len(hex_string), 2))
    except ValueError:
        return ""


def valid_email(email):
    email = email.strip().strip(".").lower()
    if not EMAIL_RE.fullmatch(email):
        return ""
    local, domain = email.rsplit("@", 1)
    if domain in JUNK_EMAIL_DOMAINS or email.endswith(JUNK_EMAIL_SUFFIXES):
        return ""
    if re.fullmatch(r"[0-9a-f]{16,}", local) or local in ("user", "name", "email", "you", "your", "firstname", "noreply", "no-reply"):
        return ""
    return email


def emails_in(soup, page_url):
    found = []
    for a in soup.select('a[href^="mailto:" i]'):
        found.append(unquote(a["href"].split(":", 1)[1].split("?")[0]))
    for a in soup.select('a[href*="/cdn-cgi/l/email-protection#"]'):
        found.append(decode_cfemail(a["href"].split("#", 1)[1]).split("?")[0])
    for el in soup.select("[data-cfemail]"):
        found.append(decode_cfemail(el["data-cfemail"]))
    text = soup.get_text(" ", strip=True)
    found += EMAIL_RE.findall(text)
    found += [re.sub(r" ?(?:\[at\]|\(at\)) ?", "@", m) for m in
              re.findall(r"[A-Za-z0-9._%+-]+ ?(?:\[at\]|\(at\)) ?[A-Za-z0-9-]+\.[A-Za-z]{2,}", text)]
    out = []
    for raw in found:
        for part in raw.split(","):
            email = valid_email(part.replace(" ", ""))
            if email and email not in [e["email"] for e in out]:
                out.append({"email": email, "source": page_url})
    return out


def rank_emails(emails, website):
    """Emails on the business's own domain first, then named inboxes we prefer, then everything else."""
    site = domain_of(website)

    def rank(entry):
        local, domain = entry["email"].split("@")
        own = 0 if site and (domain == site or domain.endswith("." + site) or site.endswith("." + domain)) else (1 if domain not in FREEMAIL else 2)
        pref = PREFERRED_INBOXES.index(local) if local in PREFERRED_INBOXES else len(PREFERRED_INBOXES)
        return (bool(LAST_RESORT.match(local)), own, pref, entry["email"])

    return sorted(emails, key=rank)


def phones_in(soup):
    phones = []
    for a in soup.select('a[href^="tel:" i]'):
        number = unquote(a["href"].split(":", 1)[1]).strip()
        digits = re.sub(r"\D", "", number)
        if 7 <= len(digits) <= 15 and number not in phones:
            phones.append(number)
    return phones


def socials_in(soup, page_url):
    out = {}
    for a in soup.select("a[href]"):
        href = urljoin(page_url, a["href"])
        kind = social_kind(href)
        if not kind or kind in out:
            continue
        path = urlparse(href).path.strip("/")
        if not path or re.search(r"share|sharer|intent|dialog|plugins|embed|hashtag|explore|/p/|/reel/|/watch", href, re.I):
            continue
        out[kind] = href.split("?")[0]
    return out


def candidate_pages(soup, page_url, limit):
    """Same-site links that look like contact, about or team pages, best first."""
    site = domain_of(page_url)
    scored = []
    for a in soup.select("a[href]"):
        href = urljoin(page_url, a["href"]).split("#")[0]
        if domain_of(href) != site or href.rstrip("/") == page_url.rstrip("/"):
            continue
        if re.search(r"\.(pdf|jpe?g|png|gif|zip|mp4)$", href, re.I):
            continue
        label = f"{urlparse(href).path} {a.get_text(' ', strip=True)}"
        if PAGE_HINTS.search(label):
            weight = 0 if re.search(r"contact", label, re.I) else (1 if TEAM_HINTS.search(label) else 2)
            if href not in [h for _, h in scored]:
                scored.append((weight, href))
    return [href for _, href in sorted(scored, key=lambda item: item[0])[:limit]]


def team_size(soup):
    """Rough headcount from a team page: headings or photo captions that look like people's names."""
    heading_names, alt_names = set(), set()
    for el in soup.select("h2, h3, h4, h5, h6, strong, b, .name, [class*=name]"):
        text = el.get_text(" ", strip=True)
        if len(text) <= 32 and PERSON_NAME.match(text) and not NOT_NAMES.match(text):
            heading_names.add(text)
    for img in soup.select("img[alt]"):
        alt = img["alt"].strip()
        if len(alt) <= 32 and PERSON_NAME.match(alt) and not NOT_NAMES.match(alt):
            alt_names.add(alt)
    count = max(len(heading_names), len(alt_names))
    return count if count >= 3 else None


def has_video(soup):
    if soup.find("video"):
        return True
    return any(re.search(r"youtube\.com|youtube-nocookie|vimeo\.com|wistia|vidyard|loom\.com", el.get("src", ""), re.I)
               for el in soup.find_all("iframe"))


def has_podcast(soup):
    for a in soup.select("a[href]"):
        href = a["href"]
        if re.search(r"podcasts\.apple\.com|open\.spotify\.com/show|/podcast", href, re.I):
            return True
    return False


def forbids_solicitation(soup):
    return bool(NO_SOLICIT.search(soup.get_text(" ", strip=True)))


def description_of(soup):
    for selector in ('meta[property="og:description"]', 'meta[name="description"]'):
        el = soup.select_one(selector)
        if el and el.get("content", "").strip():
            return re.sub(r"\s+", " ", el["content"]).strip()[:400]
    return ""


def site_name(soup):
    el = soup.select_one('meta[property="og:site_name"]')
    if el and el.get("content", "").strip():
        return el["content"].strip()
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    return re.split(r"\s+[|\-–—:·]\s+", title)[0].strip() if title else ""


def mentions_place(soup, places):
    """True when the page places the business there: an address like 'Toronto, ON M5V 2T6' or
    'based in Toronto'. A passing mention (an event, a client list) doesn't count."""
    return places_in_text(soup.get_text(" ", strip=True), places)


def places_in_text(text, places):
    if not places or not text:
        return False
    names = "|".join(re.escape(p) for p in places)
    patterns = (
        rf"\b(?:{names}),?\s+(?:ON|Ontario|Canada)\b",
        rf"\b(?:{names}),?\s+(?:ON\s+)?[A-Z]\d[A-Z]\s?\d[A-Z]\d\b",
        rf"\b(?:based|located|headquartered|offices?|studio)\s+(?:is\s+|are\s+)?in\s+(?:downtown\s+|midtown\s+|the\s+)?(?:{names})\b",
        rf"\b(?:{names})[-\s]based\b",
    )
    return any(re.search(p, text, re.I) for p in patterns)
