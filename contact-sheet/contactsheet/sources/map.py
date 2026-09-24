"""Pet businesses and animal shelters near each tour city, from OpenStreetMap (free, no key)."""

import json
import time

import requests

from ..models import Lead, Signal, clean_url, social_kind

OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
BACKOFF = (0, 20, 45)  # seconds to wait before each attempt; the public servers are often busy

CATEGORIES = {  # name: (OSM tag, value, label, lead kind)
    "pet_shop": ("shop", "pet", "Pet shop", "pet_business"),
    "groomer": ("shop", "pet_grooming", "Groomer", "pet_business"),
    "dog_daycare": ("amenity", "animal_boarding", "Daycare and boarding", "pet_business"),
    "shelter": ("amenity", "animal_shelter", "Shelter or rescue", "shelter"),
    "vet": ("amenity", "veterinary", "Vet clinic", "pet_business"),
}


def build_query(city, category):
    tag, value = CATEGORIES[category][:2]
    radius = int(city.get("radius_km", 10) * 1000)
    return (f'[out:json][timeout:90];nwr["{tag}"="{value}"]["name"]'
            f'(around:{radius},{city["lat"]},{city["lon"]});out center tags;')


def category_of(tags):
    for key, (tag, value, label, kind) in CATEGORIES.items():
        if tags.get(tag) == value:
            return key, label, kind
    return None, "", ""


def lead_from_element(element, city_name):
    tags = element.get("tags", {})
    name = tags.get("name", "").strip()
    key, label, kind = category_of(tags)
    if not name or not key:
        return None
    socials = {}
    website = ""
    for tag in ("website", "contact:website", "url"):
        url = clean_url(tags.get(tag))
        if url:
            if social_kind(url):
                socials.setdefault(social_kind(url), url)
            elif not website:
                website = url
    for tag, kind_name in (("contact:instagram", "instagram"), ("contact:facebook", "facebook")):
        handle = (tags.get(tag) or "").strip()
        if handle:
            url = clean_url(handle) if "/" in handle or "." in handle else f"https://www.{kind_name}.com/{handle.lstrip('@')}"
            if url:
                socials.setdefault(kind_name, url)
    email = (tags.get("email") or tags.get("contact:email") or "").split(";")[0].strip().lower()
    phone = (tags.get("phone") or tags.get("contact:phone") or "").split(";")[0].strip()
    street = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
    address = ", ".join(filter(None, [street, tags.get("addr:city")]))
    lat = element.get("lat", element.get("center", {}).get("lat"))
    lon = element.get("lon", element.get("center", {}).get("lon"))
    osm_url = f"https://www.openstreetmap.org/{element['type']}/{element['id']}"
    return Lead(
        name=name,
        kind=kind,
        source="map",
        category=label,
        website=website,
        city=city_name,
        address=address,
        lat=lat,
        lon=lon,
        emails=[{"email": email, "source": osm_url}] if "@" in email else [],
        phones=[phone] if phone else [],
        socials=socials,
        facts={"chain": bool(tags.get("brand") or tags.get("brand:wikidata")), "osm": osm_url},
        signals=[Signal(kind="map", title=f"{label} in {city_name}", url=osm_url)],
    )


def overpass(fetcher, query, log, sleep=time.sleep):
    for wait in BACKOFF:
        sleep(wait)
        for url in OVERPASS:
            try:
                page = fetcher.post(url, data={"data": query}, delay=2, timeout=120)
                if page.ok:
                    return json.loads(page.text)
                reason = f"returned {page.status}"
            except (requests.RequestException, ValueError) as exc:
                reason = f"failed ({type(exc).__name__})"
            log(f"  map: {url.split('/')[2]} {reason}")
    raise RuntimeError("every Overpass server was busy; try again later")


def collect(cfg, fetcher, db, log):
    settings = cfg["sources"]["map"]
    for city in cfg["cities"]:
        elements = []
        for category in settings["categories"]:
            if category not in CATEGORIES:
                log(f"  map: unknown category {category!r} in config")
                continue
            try:
                elements += overpass(fetcher, build_query(city, category), log).get("elements", [])
            except RuntimeError as exc:
                log(f"  map: skipped {category} in {city['name']}: {exc}")
        leads = [lead for lead in (lead_from_element(e, city["name"]) for e in elements) if lead]
        if not settings["include_chains"]:
            leads = [lead for lead in leads if not lead.facts["chain"]]
        # Keep places we can actually reach, best-connected first: a website, then email, social, phone.
        leads = [lead for lead in leads if lead.website or lead.emails or lead.socials or lead.phones]
        leads.sort(key=lambda lead: (not lead.website, not lead.emails, not lead.socials, not lead.phones))
        seen, shelters, businesses = set(), [], []
        for lead in leads:
            if lead.key in seen:
                continue
            seen.add(lead.key)
            (shelters if lead.kind == "shelter" else businesses).append(lead)
        # Shelters are few and all worth a look; the cap applies to businesses.
        kept = shelters + businesses[: settings["max_per_city"]]
        log(f"  map: {len(businesses[: settings['max_per_city']])} pet businesses and {len(shelters)} shelters in {city['name']}")
        yield from kept
