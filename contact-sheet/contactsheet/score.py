"""Scores every lead against each of Kevin's services, with a plain-English reason for every point."""

from .config import SERVICES, home_terms
from .models import days_since


class Fit:
    def __init__(self):
        self.score = 0
        self._reasons = []

    def add(self, points, reason, baseline=False):
        """baseline reasons (true of most leads of a kind) are listed after the distinctive ones."""
        points = int(round(points))
        if points > 0:
            self.score += points
            self._reasons.append((baseline, -points, len(self._reasons), reason))

    @property
    def reasons(self):
        return [r[-1] for r in sorted(self._reasons)]


def freshness(published):
    """News goes stale: full weight for three weeks, fading to nothing after four months."""
    age = days_since(published)
    if age is None or age <= 21:
        return 1.0
    if age <= 60:
        return 0.6
    if age <= 120:
        return 0.3
    return 0.0


def money(data):
    parts = [data.get("amount"), data.get("round")]
    return " ".join(p for p in parts if p) or "a round"


def score_lead(lead, signals, cfg):
    fits = {service: Fit() for service in SERVICES}
    kind = lead["kind"]
    city = (lead.get("city") or "").lower()
    local = bool(city) and city in home_terms(cfg)
    tour_cities = {c["name"].lower() for c in cfg["cities"]}
    stale_after = cfg["sources"]["podcasts"]["stale_after_days"]

    # Several articles about the same news shouldn't stack: count each kind of signal once, at its freshest.
    strongest = {}
    for signal in signals:
        if signal["kind"] not in strongest or freshness(signal.get("published")) > freshness(strongest[signal["kind"]].get("published")):
            strongest[signal["kind"]] = signal
    for signal in strongest.values():
        weight = freshness(signal.get("published"))
        data = signal.get("data") or {}
        kind_of = signal["kind"]
        if kind_of == "funding":
            fits["headshots"].add(35 * weight, f"Just raised {money(data)}, so the team is about to grow")
            fits["nomadic_pods"].add(30 * weight, "New funding usually kicks off a content push")
        elif kind_of == "expansion":
            fits["headshots"].add(35 * weight, "Expanding or opening an office, so there are new faces to photograph")
            fits["experiential"].add(15 * weight, "An office opening is a natural moment for an activation")
        elif kind_of == "launch":
            fits["experiential"].add(40 * weight, "Launching or running pop-ups, where instant prints and same-day video fit")
            fits["nomadic_pods"].add(10 * weight, "A launch needs content")
        elif kind_of == "pet_brand":
            fits["off_leash"].add(35 * weight, "Pet brand in the news: a licensing or brand-shoot opening")
            fits["experiential"].add(25 * weight, "Pet brand activations are exactly what Off Leash has done for big brands")
            fits["pet_rescue"].add(20 * weight, "Could sponsor Pet Rescue Portraits")

    if kind == "podcast":
        pod = (lead.get("facts") or {}).get("podcast", {})
        episodes = pod.get("episodes") or 0
        show = pod.get("name") or lead["name"]
        if episodes > 250:
            fits["nomadic_pods"].add(10, f"Runs a large business podcast ({show}, {episodes} episodes), likely with a team already", baseline=True)
        else:
            fits["nomadic_pods"].add(25, f"Runs a business podcast ({show})", baseline=True)
        if pod.get("local") or local:
            fits["nomadic_pods"].add(30, f"{cfg['home']['city']}-area show, so an easy boardroom shoot")
        elif pod.get("canadian"):
            fits["nomadic_pods"].add(20, "Canadian show")
        age = pod.get("days_since_last")
        cadence = pod.get("cadence_days")
        if age is not None and stale_after < age <= 365:
            fits["nomadic_pods"].add(20, f"Last episode was {age} days ago, so the show may have stalled")
        elif age is not None and age > 365:
            fits["nomadic_pods"].add(5, "Quiet for over a year; a relaunch pitch")
        elif cadence and cadence > 21:
            fits["nomadic_pods"].add(10, f"Publishes only about every {cadence} days")
        if not pod.get("video"):
            fits["nomadic_pods"].add(10, "Audio only, with no video clips for LinkedIn or YouTube")
        if pod.get("owns_site") or pod.get("company_like"):
            fits["nomadic_pods"].add(10, "Looks like a company's show, not a hobby")
        if 0 < episodes < 30:
            fits["nomadic_pods"].add(5, f"Only {episodes} episodes so far")

    if kind == "shelter":
        fits["pet_rescue"].add(60, "Shelter or rescue: offer a free, sponsor-funded portrait day")
    elif kind == "pet_business":
        if city in tour_cities:
            fits["off_leash"].add(45, f"Independent pet business in a tour city ({lead['city']})")
        else:
            fits["off_leash"].add(25, "Independent pet business")
        fits["pet_rescue"].add(25, "Could sponsor Pet Rescue Portraits locally", baseline=True)
        fits["experiential"].add(10, "Could host a pet meetup pop-up")
        if (lead.get("socials") or {}).get("instagram"):
            fits["off_leash"].add(10, "Active on Instagram, so a shoot would get shared")

    team = lead.get("team_size")
    if team and team >= 8 and kind != "shelter":
        fits["headshots"].add(30 if team >= 25 else 20, f"Team page shows about {team} people")
    if lead.get("has_podcast") and kind != "podcast":
        fits["nomadic_pods"].add(15, "Already promotes a podcast on its website")
    if lead.get("has_video") is False and kind == "company":
        fits["nomadic_pods"].add(5, "No video on the website yet")
    if local and fits["headshots"].score:
        fits["headshots"].add(10, f"Based in {cfg['home']['city']}, so an easy on-site shoot")

    reachable = bool(lead.get("emails"))
    out = {}
    for service, fit in fits.items():
        if fit.score <= 0:
            continue
        if reachable:
            fit.add(10, "Has a published email address", baseline=True)
        out[service] = {"score": min(fit.score, 100), "reasons": fit.reasons}
    return out


def best(scores):
    if not scores:
        return "", 0
    service = max(scores, key=lambda s: scores[s]["score"])
    return service, scores[service]["score"]
