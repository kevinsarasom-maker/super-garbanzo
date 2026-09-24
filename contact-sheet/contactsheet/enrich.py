"""Visits a lead's website (homepage plus a few contact, about or team pages) and records what it finds."""

import requests

from . import extract
from .models import clean_url, domain_of
from .net import Blocked


def enrich(lead, fetcher, max_pages=4, home_city="", home_terms=()):
    """Returns a dict of fields to update on the lead. Never raises for network trouble."""
    website = clean_url(lead["website"])
    updates = {"crawl_note": ""}
    if not website:
        updates["crawl_note"] = "no website"
        return updates
    try:
        home = fetcher.get(website)
    except Blocked:
        updates["crawl_note"] = "robots.txt asks bots not to crawl this site"
        return updates
    except requests.RequestException as exc:
        updates["crawl_note"] = f"site unreachable ({type(exc).__name__})"
        return updates
    if not home.ok or not home.is_html:
        updates["crawl_note"] = f"site returned {home.status}"
        return updates

    home_soup = extract.soup_of(home.text)
    pages = [(home.url, home_soup)]
    for url in extract.candidate_pages(home_soup, home.url, max_pages - 1):
        try:
            page = fetcher.get(url)
        except (Blocked, requests.RequestException):
            continue
        if page.ok and page.is_html and domain_of(page.url) == domain_of(home.url):
            pages.append((page.url, extract.soup_of(page.text)))

    emails, phones, socials = list(lead.get("emails") or []), list(lead.get("phones") or []), dict(lead.get("socials") or {})
    team, video, podcast, no_solicit, local = None, False, False, False, False
    for url, soup in pages:
        for entry in extract.emails_in(soup, url):
            if entry["email"] not in [e["email"] for e in emails]:
                emails.append(entry)
        phones += [p for p in extract.phones_in(soup) if p not in phones]
        for kind, link in extract.socials_in(soup, url).items():
            socials.setdefault(kind, link)
        if url != home.url and extract.TEAM_HINTS.search(url):  # homepages list clients and speakers too
            size = extract.team_size(soup)
            team = max(team or 0, size or 0) or None
        video = video or extract.has_video(soup)
        podcast = podcast or extract.has_podcast(soup)
        no_solicit = no_solicit or extract.forbids_solicitation(soup)
        local = local or extract.mentions_place(soup, home_terms)

    updates.update(
        emails=extract.rank_emails(emails, home.url)[:6],
        phones=phones[:4],
        socials=socials,
        team_size=team,
        has_video=video,
        has_podcast=podcast,
        no_solicit=no_solicit,
    )
    if local and home_city and not lead.get("city"):
        updates["city"] = home_city
    description = extract.description_of(home_soup)
    if description:
        updates["description"] = description
    name = extract.site_name(home_soup)
    if name and lead["name"] == domain_of(website):
        updates["name"] = name[:80]
    if domain_of(home.url) != domain_of(website):
        updates["website"] = home.url
    return updates
