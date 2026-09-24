import unittest

from contactsheet.sources import map as osm
from contactsheet.sources import news, podcasts

NEWS_RSS = """<?xml version="1.0"?><rss><channel>
<item><title>Altis Labs raises $25 million USD Series A to expand AI for cancer trials - BetaKit</title>
<link>https://news.google.com/rss/articles/abc</link><pubDate>Mon, 21 Sep 2026 13:33:28 GMT</pubDate>
<source url="https://betakit.com">BetaKit</source></item>
<item><title>Ten things to do this weekend - Toronto Life</title>
<link>https://news.google.com/rss/articles/def</link><pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate>
<source url="https://torontolife.com">Toronto Life</source></item>
</channel></rss>"""

PODCAST_RSS = """<?xml version="1.0"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>The Deal Room</title><link>https://www.northcapital.ca/podcast</link><language>en-ca</language>
<description><![CDATA[Conversations with Toronto founders.]]></description>
<atom:link href="https://feeds.example.com/deal" rel="self"/>
<itunes:owner><itunes:name>Jane Doe</itunes:name><itunes:email>podcast@northcapital.ca</itunes:email></itunes:owner>
<item><title>Ep 3</title><pubDate>Tue, 01 Sep 2026 10:00:00 +0000</pubDate><enclosure url="https://x/3.mp3" type="audio/mpeg"/></item>
<item><title>Ep 2</title><pubDate>Sat, 01 Aug 2026 10:00:00 +0000</pubDate><enclosure url="https://x/2.mp3" type="audio/mpeg"/></item>
<item><title>Ep 1</title><pubDate>Wed, 01 Jul 2026 10:00:00 +0000</pubDate><enclosure url="https://x/1.mp3" type="audio/mpeg"/></item>
</channel></rss>"""


class NewsTests(unittest.TestCase):
    def test_company_from_headline(self):
        cases = {
            "Bird&Be raises $13-million USD Series A for fertility support platform": "Bird&Be",
            "Cement decarbonization startup CURA raises $10M for pilot project": "CURA",
            "AI Benchmarking Startup Vals Raises $40M Series A": "Vals",
            "Toronto-based Wealthsimple opens new office": "Wealthsimple",
            "Toronto's Acme Robotics launches new line": "Acme Robotics",
            "Exclusive: Spearhead Bio lands oversubscribed seed round": "Spearhead Bio",
            "{Funding Alert} Sustainable Home Care Brand Ecosys Raises Funding": "Ecosys",
            "Loblaw Digital alums raise US$5.4M for retail AI startup": "",
            "Kawhi Leonard opens up about son pushing for Toronto return": "",
            "National Bank raises price target on Tecsys to $41.00": "",
            "Michael Wekerle Raises Orion Digital Corp Stake to 12.38%": "",
            "BowWow PowWow raises funds for the Kiwanis Club": "",
            "Unicorn startups in Canada (Sep, 2026)": "",
        }
        for headline, expected in cases.items():
            with self.subTest(headline=headline):
                self.assertEqual(news.company_from_headline(headline), expected)

    def test_funding_details(self):
        self.assertEqual(news.funding_details("Bird&Be raises $13-million USD Series A"), ("$13M", "Series A"))
        self.assertEqual(news.funding_details("Thri5 raises $5.4 million to scale"), ("$5.4M", None))
        self.assertEqual(news.funding_details("Kiddo raises pre-seed round"), (None, "pre-seed"))

    def test_parse_feed_strips_publisher(self):
        items = news.parse_feed(NEWS_RSS)
        self.assertEqual(items[0]["title"], "Altis Labs raises $25 million USD Series A to expand AI for cancer trials")
        self.assertEqual(items[0]["publisher"], "BetaKit")
        self.assertTrue(items[0]["published"].startswith("2026-09-21T13:33:28"))

    def test_excluded_words(self):
        self.assertTrue(news.excluded("Rituals launches £46 pet set", "£"))
        self.assertTrue(news.excluded("Ramp launches in the UK", "UK"))
        self.assertFalse(news.excluded("Ukulele maker raises seed", "UK"))


class PodcastTests(unittest.TestCase):
    def test_analyze_feed(self):
        feed = podcasts.analyze_feed(PODCAST_RSS)
        self.assertEqual(feed["link"], "https://www.northcapital.ca/podcast")
        self.assertEqual(feed["owner_email"], "podcast@northcapital.ca")
        self.assertEqual(feed["owner_name"], "Jane Doe")
        self.assertEqual(feed["episodes"], 3)
        self.assertEqual(feed["cadence_days"], 31)
        self.assertEqual(feed["language"], "en-ca")
        self.assertFalse(feed["video"])
        self.assertIn("Toronto founders", feed["about"])
        self.assertTrue(feed["last_episode"].startswith("2026-09-01"))

    def test_truncated_feed_still_parses(self):
        feed = podcasts.analyze_feed(PODCAST_RSS[: PODCAST_RSS.index("Ep 1") + 40])
        self.assertEqual(feed["episodes"], 3)

    def test_hosting_and_company_detection(self):
        self.assertTrue(podcasts.is_hosting("https://anchor.fm/show"))
        self.assertTrue(podcasts.is_hosting("https://feeds.buzzsprout.com/1.rss"))
        self.assertFalse(podcasts.is_hosting("https://northcapital.ca"))
        self.assertTrue(podcasts.looks_like_company("North Capital Partners"))
        self.assertFalse(podcasts.looks_like_company("Jane Doe"))

    def test_split_publisher(self):
        self.assertEqual(podcasts.split_publisher("CJ Stevens, CFP® at Philotimo Wealth Management"),
                         ("Philotimo Wealth Management", "CJ Stevens"))
        self.assertEqual(podcasts.split_publisher("Hawkeye Wealth | Canadian Private Real Estate for LPs"),
                         ("Hawkeye Wealth", ""))
        self.assertEqual(podcasts.split_publisher("Jane Doe | Doe Law Group"), ("Doe Law Group", "Jane Doe"))
        self.assertEqual(podcasts.split_publisher("Mark Lyda"), ("Mark Lyda", "Mark Lyda"))
        self.assertEqual(podcasts.split_publisher("Bain & Company"), ("Bain & Company", ""))
        self.assertEqual(podcasts.split_publisher("Kornel Szrejber: Investor"), ("Kornel Szrejber", "Kornel Szrejber"))
        self.assertEqual(podcasts.split_publisher("Leaders at Work"), ("Leaders at Work", ""))


class MapTests(unittest.TestCase):
    def test_lead_from_element(self):
        element = {"type": "node", "id": 42, "lat": 43.65, "lon": -79.4, "tags": {
            "name": "Bark & Bath", "shop": "pet_grooming", "website": "barkandbath.ca;https://other.ca",
            "contact:instagram": "@barkandbath", "phone": "+1 416 555 0199", "email": "Hi@BarkAndBath.ca",
            "addr:housenumber": "12", "addr:street": "Ossington Ave", "addr:city": "Toronto"}}
        lead = osm.lead_from_element(element, "Toronto")
        self.assertEqual(lead.kind, "pet_business")
        self.assertEqual(lead.category, "Groomer")
        self.assertEqual(lead.website, "https://barkandbath.ca")
        self.assertEqual(lead.socials["instagram"], "https://www.instagram.com/barkandbath")
        self.assertEqual(lead.emails[0]["email"], "hi@barkandbath.ca")
        self.assertEqual(lead.address, "12 Ossington Ave, Toronto")
        self.assertFalse(lead.facts["chain"])

    def test_social_website_and_shelter(self):
        element = {"type": "way", "id": 7, "center": {"lat": 1, "lon": 2}, "tags": {
            "name": "Second Chance Rescue", "amenity": "animal_shelter", "website": "https://facebook.com/secondchance"}}
        lead = osm.lead_from_element(element, "Austin")
        self.assertEqual(lead.kind, "shelter")
        self.assertEqual(lead.website, "")
        self.assertEqual(lead.socials["facebook"], "https://facebook.com/secondchance")
        self.assertEqual((lead.lat, lead.lon), (1, 2))

    def test_query_and_unknown_elements(self):
        query = osm.build_query({"lat": 1, "lon": 2, "radius_km": 3}, "shelter")
        self.assertIn('nwr["amenity"="animal_shelter"]["name"](around:3000,1,2)', query)
        self.assertIsNone(osm.lead_from_element({"type": "node", "id": 1, "tags": {"name": "Cafe", "amenity": "cafe"}}, "X"))


if __name__ == "__main__":
    unittest.main()
