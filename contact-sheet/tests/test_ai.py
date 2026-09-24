import json
import unittest
from types import SimpleNamespace

from contactsheet import ai, config, outreach

CFG = config.load()
LEAD = {"name": "North Capital", "kind": "podcast", "category": "Podcast, Business", "city": "Toronto",
        "description": "Private credit for Canadian founders.", "team_size": None, "has_video": None,
        "facts": {"podcast": {"name": "The Deal Room", "episodes": 20, "days_since_last": 90}},
        "scores": {"nomadic_pods": {"score": 80, "reasons": ["Runs a business podcast (The Deal Room)"]}},
        "emails": [{"email": "podcast@northcapital.ca"}]}


class FakeMessages:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.response


def fake_client(text=None, stop_reason="end_turn"):
    content = [SimpleNamespace(type="text", text=text)] if text is not None else []
    messages = FakeMessages(SimpleNamespace(stop_reason=stop_reason, content=content))
    return SimpleNamespace(beta=SimpleNamespace(messages=messages)), messages


class AITests(unittest.TestCase):
    def test_request_shape_and_parsing(self):
        client, messages = fake_client(json.dumps({"subject": " The Deal Room on video ", "opener": " Saw The Deal Room. "}))
        result = ai.personalize(client, CFG, "nomadic_pods", LEAD, [])
        self.assertEqual(result, {"subject": "The Deal Room on video", "opener": "Saw The Deal Room."})
        call = messages.calls[0]
        self.assertEqual(call["model"], CFG["ai"]["model"])
        self.assertEqual(call["fallbacks"], "default")
        self.assertIn("server-side-fallback-2026-07-01", call["betas"])
        self.assertEqual(call["output_config"]["format"]["schema"]["required"], ["subject", "opener"])
        brief = json.loads(call["messages"][0]["content"])
        self.assertEqual(brief["lead"]["podcast"]["name"], "The Deal Room")
        self.assertEqual(brief["service"], "Nomadic Pods")

    def test_refusal_and_empty_replies_fall_back_to_template(self):
        client, _ = fake_client(stop_reason="refusal")
        self.assertIsNone(ai.personalize(client, CFG, "nomadic_pods", LEAD, []))
        client, _ = fake_client(json.dumps({"subject": "x", "opener": "  "}))
        self.assertIsNone(ai.personalize(client, CFG, "nomadic_pods", LEAD, []))

    def test_ai_opener_lands_in_the_draft(self):
        d = outreach.draft("nomadic_pods", LEAD, [], CFG, opener="Custom opener.", subject="Custom subject")
        self.assertTrue(d["ai"])
        self.assertEqual(d["subject"], "Custom subject")
        self.assertIn("Custom opener.", d["body"])


if __name__ == "__main__":
    unittest.main()
