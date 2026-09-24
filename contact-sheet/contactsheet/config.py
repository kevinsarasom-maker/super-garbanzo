"""Loads config.toml and fills in defaults for anything left out."""

import copy
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / "config.toml"
DATA_DIR = ROOT / "data"
TEMPLATES_DIR = ROOT / "templates"

SERVICES = {
    "headshots": "Corporate headshots",
    "nomadic_pods": "Nomadic Pods",
    "experiential": "Experiential",
    "off_leash": "Off Leash Studio",
    "pet_rescue": "Pet Rescue Portraits",
}

STATUSES = ["new", "circled", "sent", "replied", "booked", "pass"]

DEFAULTS = {
    "sender": {"name": "", "business": "", "email": "", "phone": "", "website": "", "mailing_address": ""},
    "home": {"city": "", "terms": []},
    "bot": {
        "user_agent": "ContactSheetBot/1.0",
        "delay_seconds": 1.5,
        "timeout_seconds": 15,
        "max_pages_per_site": 4,
        "workers": 6,
        "refresh_days": 30,
        "draft_min_score": 20,
    },
    "cities": [],
    "sources": {
        "news": {"enabled": True, "days": 14, "guess_websites": True, "queries": [], "skip_names": [], "exclude_words": []},
        "podcasts": {
            "enabled": True,
            "countries": ["ca"],
            "terms": [],
            "results_per_term": 25,
            "stale_after_days": 45,
            "skip_after_days": 540,
            "languages": ["en"],
            "genres": [],
            "skip_publishers": [],
        },
        "map": {"enabled": True, "categories": ["pet_shop", "groomer", "dog_daycare", "shelter"], "max_per_city": 40, "include_chains": False},
    },
    "ai": {"model": "claude-opus-5", "effort": "medium", "max_per_run": 25, "min_score": 50},
    "digest": {"top": 15, "min_score": 50},
}


def _merge(base, override):
    out = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def load(path=None):
    path = Path(path) if path else DEFAULT_CONFIG
    with open(path, "rb") as f:
        cfg = _merge(DEFAULTS, tomllib.load(f))
    cfg["_path"] = str(path)
    return cfg


def home_terms(cfg):
    terms = [t.lower() for t in cfg["home"]["terms"]]
    if cfg["home"]["city"]:
        terms.append(cfg["home"]["city"].lower())
    return terms
