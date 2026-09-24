"""Optional: Claude rewrites a draft's subject and opening lines from the facts gathered about the lead.

Needs `pip install anthropic` and an ANTHROPIC_API_KEY (or an `ant auth login` profile).
"""

import json

from .config import SERVICES

PITCHES = {
    "headshots": "Corporate headshots with an editorial eye: 20 years shooting fashion and lifestyle brands, on-site or studio, consistent style across large teams, fast turnaround.",
    "nomadic_pods": "Nomadic Pods: a turnkey video and podcast studio that travels to the client's boardroom. One film day produces 6 episodes and 90+ ready-to-post assets for LinkedIn, YouTube and Spotify.",
    "experiential": "Experiential pop-up activations: photographing everyone who stops by, instant 4x6 prints on the spot, same-day video to social. Past clients: Mercedes-Benz, Saks Fifth Avenue, The Body Shop.",
    "off_leash": "Off Leash Studio: bespoke dog portraits, 15,000+ dogs photographed, same-day galleries, a World Tour (Toronto, Vancouver, NYC, Chicago, SF, LA, Austin) looking for local pet businesses to partner with.",
    "pet_rescue": "Pet Rescue Portraits: free professional portraits for shelter and rescue animals, funded entirely by sponsors, never billed to the rescue. Pitch shelters a free portrait day; pitch pet businesses and brands on sponsoring one.",
}

SYSTEM = """You write the opening of cold emails for Kevin Sarasom, a Toronto photographer, cinematographer and producer.

Write a subject line and an opener of one or two sentences that shows Kevin noticed something specific and true about this lead and connects it to the service being pitched. The rest of the email (the pitch, the ask, the sign-off) already exists, so do not repeat the pitch, add a greeting or sign off.

Use only facts present in the lead data. Never invent details, praise things you cannot see, or claim Kevin listened to, visited or used anything. Plain, warm and direct: no hype, no exclamation marks, no emojis. Subject under 60 characters."""

SCHEMA = {
    "type": "object",
    "properties": {
        "subject": {"type": "string"},
        "opener": {"type": "string"},
    },
    "required": ["subject", "opener"],
    "additionalProperties": False,
}


class AIUnavailable(Exception):
    pass


def make_client():
    try:
        import anthropic
    except ImportError as exc:
        raise AIUnavailable("the anthropic package isn't installed (pip install anthropic)") from exc
    return anthropic.Anthropic()


def lead_brief(service, lead, signals):
    facts = {
        "name": lead["name"],
        "type": lead["kind"],
        "category": lead.get("category"),
        "city": lead.get("city"),
        "website_description": lead.get("description"),
        "team_size_estimate": lead.get("team_size"),
        "has_video_on_site": lead.get("has_video"),
        "podcast": (lead.get("facts") or {}).get("podcast"),
        "news": [{"headline": s["title"], "published": s["published"], **(s.get("data") or {})}
                 for s in signals if s["kind"] not in ("map", "podcast")][:3],
        "why_it_fits": lead["scores"].get(service, {}).get("reasons", []),
    }
    return json.dumps({"service": SERVICES[service], "service_pitch": PITCHES[service],
                       "lead": {k: v for k, v in facts.items() if v not in (None, "", [], {})}}, indent=2)


def personalize(client, cfg, service, lead, signals):
    """Returns {"subject", "opener"} or None if Claude declined. Raises anthropic errors to the caller."""
    response = client.beta.messages.create(
        model=cfg["ai"]["model"],
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": cfg["ai"]["effort"], "format": {"type": "json_schema", "schema": SCHEMA}},
        system=SYSTEM,
        messages=[{"role": "user", "content": lead_brief(service, lead, signals)}],
    )
    if response.stop_reason == "refusal":
        return None
    text = next((block.text for block in response.content if block.type == "text"), "")
    if not text:
        return None
    data = json.loads(text)
    if not data.get("opener", "").strip():
        return None
    return {"subject": data["subject"].strip(), "opener": data["opener"].strip()}
