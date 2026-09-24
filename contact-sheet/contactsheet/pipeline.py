"""collect -> enrich -> score -> draft. Each step is safe to re-run; statuses and notes are never touched."""

from concurrent.futures import ThreadPoolExecutor, as_completed

from . import outreach, score
from .enrich import enrich
from .models import days_since, now_iso
from .net import Fetcher
from .sources import SOURCES

FROZEN = ("sent", "replied", "booked", "pass")  # drafts stop changing once you have acted on a lead


def make_fetcher(cfg):
    bot = cfg["bot"]
    return Fetcher(bot["user_agent"], delay=bot["delay_seconds"], timeout=bot["timeout_seconds"])


def collect(cfg, db, fetcher, names, log):
    totals = {}
    for name in names:
        module = SOURCES[name]
        if not cfg["sources"][name]["enabled"]:
            log(f"{name}: disabled in config")
            continue
        log(f"{name}: collecting")
        found = new = 0
        try:
            for lead in module.collect(cfg, fetcher, db, log):
                _, is_new = db.upsert(lead)
                found += 1
                new += is_new
        except Exception as exc:  # one broken source shouldn't sink the run
            log(f"{name}: stopped early ({type(exc).__name__}: {exc})")
        totals[name] = {"found": found, "new": new}
        log(f"{name}: {found} leads ({new} new)")
    return totals


def enrich_all(cfg, db, fetcher, log, lead_ids=None):
    refresh = cfg["bot"]["refresh_days"]
    candidates = [
        lead for lead in db.leads("status NOT IN ('booked', 'pass') AND website != ''")
        if (lead_ids is None or lead["id"] in lead_ids)
        and (lead["enriched_at"] is None or (days_since(lead["enriched_at"]) or 0) >= refresh)
    ]
    if not candidates:
        return 0
    log(f"enrich: visiting {len(candidates)} websites")
    done = 0
    with ThreadPoolExecutor(max_workers=cfg["bot"]["workers"]) as pool:
        home = [t for t in cfg["home"]["terms"] + [cfg["home"]["city"]] if t]
        futures = {pool.submit(enrich, lead, fetcher, cfg["bot"]["max_pages_per_site"], cfg["home"]["city"], home): lead
                   for lead in candidates}
        for future in as_completed(futures):
            lead = futures[future]
            try:
                updates = future.result()
            except Exception as exc:
                updates = {"crawl_note": f"crawl failed ({type(exc).__name__})"}
            updates["enriched_at"] = now_iso()
            db.update(lead["id"], updates)
            done += 1
            if done % 25 == 0:
                log(f"enrich: {done}/{len(candidates)}")
    return len(candidates)


def rescore(cfg, db, log):
    signals = db.all_signals()
    count = 0
    for lead in db.leads():
        lead_signals = signals.get(lead["key"], [])
        scores = score.score_lead(lead, lead_signals, cfg)
        best, best_score = score.best(scores)
        lead["scores"] = scores
        if lead["status"] in FROZEN:
            drafts = lead["drafts"]
        else:
            drafts = outreach.draft_all(lead, lead_signals, scores, cfg, keep=lead["drafts"])
        db.update(lead["id"], {"scores": scores, "best_service": best, "best_score": best_score, "drafts": drafts})
        count += 1
    return count


def personalize(cfg, db, log):
    from . import ai

    try:
        client = ai.make_client()
        import anthropic
    except ai.AIUnavailable as exc:
        log(f"ai: skipped, {exc}")
        return 0
    signals = db.all_signals()
    written = 0
    todo = db.leads("status IN ('new', 'circled') AND best_score >= ?", (cfg["ai"]["min_score"],))
    for lead in todo:
        if written >= cfg["ai"]["max_per_run"]:
            break
        service = lead["best_service"]
        current = lead["drafts"].get(service)
        if not service or not current or current.get("ai") or current.get("edited"):
            continue
        lead_signals = signals.get(lead["key"], [])
        try:
            result = ai.personalize(client, cfg, service, lead, lead_signals)
        except anthropic.AuthenticationError:
            log("ai: stopped, the API key was rejected")
            break
        except anthropic.RateLimitError:
            log("ai: stopped, rate limited; the rest keep their template drafts")
            break
        except anthropic.APIStatusError as exc:
            log(f"ai: skipped one lead (API error {exc.status_code})")
            continue
        except anthropic.APIConnectionError:
            log("ai: stopped, couldn't reach the API")
            break
        except ValueError:
            log("ai: skipped one lead (unreadable reply)")
            continue
        if not result:
            continue
        lead["drafts"][service] = outreach.draft(service, lead, lead_signals, cfg,
                                                 opener=result["opener"], subject=result["subject"])
        db.update(lead["id"], {"drafts": lead["drafts"]})
        written += 1
    log(f"ai: personalized {written} drafts")
    return written


def run(cfg, db, sources=None, do_enrich=True, use_ai=False, log=print):
    fetcher = make_fetcher(cfg)
    totals = collect(cfg, db, fetcher, sources or list(SOURCES), log)
    enriched = enrich_all(cfg, db, fetcher, log) if do_enrich else 0
    scored = rescore(cfg, db, log)
    written = personalize(cfg, db, log) if use_ai else 0
    return {"sources": totals, "enriched": enriched, "scored": scored, "ai_drafts": written}
