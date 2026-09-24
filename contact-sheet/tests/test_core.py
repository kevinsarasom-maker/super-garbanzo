import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

from contactsheet import config, outreach, score, web
from contactsheet.db import DB
from contactsheet.models import Lead, Signal, clean_url, company_norm, domain_of, lead_key

CFG = config.load()


def days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def base_lead(**over):
    lead = {"name": "Acme", "kind": "company", "city": "", "emails": [], "phones": [], "socials": {}, "facts": {},
            "team_size": None, "has_video": None, "has_podcast": None, "no_solicit": False, "scores": {}}
    lead.update(over)
    return lead


class ModelTests(unittest.TestCase):
    def test_urls_and_keys(self):
        self.assertEqual(clean_url("acme.ca"), "https://acme.ca")
        self.assertEqual(clean_url("javascript:alert(1)"), "")
        self.assertEqual(clean_url("mailto:x@y.com"), "")
        self.assertEqual(domain_of("https://www.Acme.ca/about"), "acme.ca")
        self.assertEqual(lead_key("Acme", "https://www.acme.ca"), "site:acme.ca")
        self.assertEqual(lead_key("Bark & Bath", "", "Toronto"), "name:bark-and-bath@toronto")
        self.assertEqual(company_norm("Robinhood Canada Inc."), company_norm("Robinhood"))


class ScoreTests(unittest.TestCase):
    def test_duplicate_news_does_not_stack(self):
        signal = {"kind": "funding", "published": days_ago(2), "data": {"amount": "$13M", "round": "Series A"}}
        once = score.score_lead(base_lead(), [signal], CFG)
        thrice = score.score_lead(base_lead(), [signal, dict(signal), dict(signal)], CFG)
        self.assertEqual(once, thrice)
        self.assertIn("$13M Series A", once["headshots"]["reasons"][0])

    def test_old_news_fades(self):
        fresh = score.score_lead(base_lead(), [{"kind": "funding", "published": days_ago(3), "data": {}}], CFG)
        stale = score.score_lead(base_lead(), [{"kind": "funding", "published": days_ago(400), "data": {}}], CFG)
        self.assertGreater(fresh["headshots"]["score"], 0)
        self.assertNotIn("headshots", stale)

    def test_shelter_and_pet_business(self):
        shelter = score.score_lead(base_lead(kind="shelter", city="Austin"), [], CFG)
        self.assertEqual(score.best(shelter)[0], "pet_rescue")
        shop = score.score_lead(base_lead(kind="pet_business", city="Toronto", socials={"instagram": "x"},
                                          emails=[{"email": "a@b.ca"}]), [], CFG)
        self.assertEqual(score.best(shop)[0], "off_leash")
        self.assertIn("Has a published email address", shop["off_leash"]["reasons"])

    def test_podcast_scoring_prefers_local_stalled_company_shows(self):
        good = base_lead(kind="podcast", facts={"podcast": {"name": "Deal Room", "episodes": 20, "days_since_last": 90,
                                                            "video": False, "owns_site": True, "local": True}})
        big = base_lead(kind="podcast", facts={"podcast": {"name": "Huge Show", "episodes": 800, "days_since_last": 2,
                                                           "video": True, "cadence_days": 7}})
        self.assertGreater(score.score_lead(good, [], CFG)["nomadic_pods"]["score"],
                           score.score_lead(big, [], CFG)["nomadic_pods"]["score"] + 40)

    def test_scores_capped(self):
        lead = base_lead(team_size=40, city="Toronto", emails=[{"email": "a@b.ca"}])
        sigs = [{"kind": k, "published": days_ago(1), "data": {}} for k in ("funding", "expansion", "launch")]
        self.assertLessEqual(max(f["score"] for f in score.score_lead(lead, sigs, CFG).values()), 100)


class OutreachTests(unittest.TestCase):
    def test_every_draft_has_casl_footer_and_no_leftover_placeholders(self):
        lead = base_lead(name="Bark & Bath", kind="pet_business", city="Toronto", emails=[{"email": "hi@bb.ca"}])
        for service in config.SERVICES:
            with self.subTest(service=service):
                d = outreach.draft(service, lead, [], CFG)
                self.assertIn("won't email again", d["body"])
                self.assertIn(CFG["sender"]["name"], d["body"])
                self.assertNotIn("{", d["body"] + d["subject"])
                self.assertEqual(d["to"], "hi@bb.ca")

    def test_missing_address_is_flagged(self):
        cfg = json.loads(json.dumps(CFG))
        cfg["sender"]["mailing_address"] = ""
        self.assertIn("MAILING ADDRESS", outreach.signoff(cfg))
        cfg["sender"]["mailing_address"] = "1 King St W, Toronto"
        self.assertIn("1 King St W, Toronto", outreach.signoff(cfg))

    def test_podcast_hook_and_host_greeting(self):
        lead = base_lead(name="North Capital", kind="podcast", facts={"podcast": {
            "name": "The Deal Room", "host": "Jane Doe", "days_since_last": 120, "video": False}})
        d = outreach.draft("nomadic_pods", lead, [], CFG)
        self.assertTrue(d["body"].startswith("Hi Jane,"))
        self.assertIn("The Deal Room", d["body"])
        self.assertIn("about 4 months ago", d["body"])

    def test_rescue_sponsor_vs_shelter_template(self):
        self.assertEqual(outreach.template_for("pet_rescue", base_lead(kind="shelter")), "pet_rescue")
        self.assertEqual(outreach.template_for("pet_rescue", base_lead(kind="pet_business")), "pet_rescue_sponsor")

    def test_edited_and_ai_drafts_survive_rescoring(self):
        scores = {"headshots": {"score": 60, "reasons": []}, "nomadic_pods": {"score": 60, "reasons": []}}
        keep = {"headshots": {"subject": "mine", "body": "mine", "edited": True}}
        drafts = outreach.draft_all(base_lead(), [], scores, CFG, keep=keep)
        self.assertEqual(drafts["headshots"]["subject"], "mine")
        self.assertIn("nomadic_pods", drafts)


class DBTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = DB(os.path.join(self.tmp.name, "t.db"))

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_upsert_merges_sources_signals_and_contacts(self):
        key, new = self.db.upsert(Lead(name="Acme", kind="company", source="news",
                                       signals=[Signal(kind="funding", title="Acme raises", url="u1")]))
        self.assertTrue(new)
        key2, new2 = self.db.upsert(Lead(name="Acme Inc.", kind="company", source="manual", website="https://acme.ca",
                                         emails=[{"email": "hi@acme.ca", "source": "x"}],
                                         signals=[Signal(kind="funding", title="Acme raises", url="u1"),
                                                  Signal(kind="expansion", title="Acme opens", url="u2")]))
        self.assertFalse(new2)
        self.assertEqual(key, key2)
        lead = self.db.by_key(key)
        self.assertEqual(lead["website"], "https://acme.ca")
        self.assertEqual(lead["sources"], ["manual", "news"])
        self.assertEqual(lead["emails"][0]["email"], "hi@acme.ca")
        self.assertEqual(len(self.db.signals(key)), 2)

    def test_status_and_notes(self):
        key, _ = self.db.upsert(Lead(name="Acme", kind="company", source="news"))
        lead = self.db.by_key(key)
        lead = self.db.set_status(lead["id"], status="circled", notes="call Tuesday")
        self.assertEqual((lead["status"], lead["notes"]), ("circled", "call Tuesday"))
        self.assertIsNotNone(lead["status_at"])


class AddTests(unittest.TestCase):
    def test_classify_added_sites(self):
        from contactsheet.__main__ import classify
        self.assertEqual(classify("Toronto Humane Society. Adopt a pet today."), "shelter")
        self.assertEqual(classify("Bark & Bath: dog grooming on Ossington"), "pet_business")
        self.assertEqual(classify("Altis Labs: AI for clinical trials"), "company")


class WebTests(unittest.TestCase):
    def test_snapshot_cannot_break_out_of_script(self):
        html = web.page({"leads": [{"name": "</script><script>alert(1)</script>"}]})
        self.assertNotIn("</script><script>alert(1)", html)
        self.assertIn("\\u003c/script\\u003e", html)

    def test_live_page_has_no_embedded_data(self):
        self.assertIn('<script id="data" type="application/json">null</script>', web.page())


if __name__ == "__main__":
    unittest.main()
