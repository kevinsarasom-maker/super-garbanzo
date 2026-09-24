import unittest

from contactsheet import extract


def cf_encode(email, key=0x42):
    return f"{key:02x}" + "".join(f"{ord(c) ^ key:02x}" for c in email)


PAGE = f"""
<html><head><title>Acme Studio | Toronto</title>
<meta property="og:description" content="Brand strategy for climate companies.">
</head><body>
<nav><a href="/about-us">About</a> <a href="/team">Our Team</a> <a href="/contact">Contact</a>
<a href="https://elsewhere.com/contact">Partner</a> <a href="/brochure.pdf">Brochure</a></nav>
<p>Write to <a href="mailto:hello@acme.ca?subject=Hi">us</a> or press@acme.ca.</p>
<p>Protected: <a href="/cdn-cgi/l/email-protection#{cf_encode('jobs@acme.ca')}">[email protected]</a></p>
<span class="__cf_email__" data-cfemail="{cf_encode('events@acme.ca')}">[email protected]</span>
<p>Or jane [at] acme.ca, logo@2x.png, someone@example.com</p>
<a href="tel:+1 (416) 555-0100">Call</a>
<a href="https://www.instagram.com/acmestudio/">IG</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
<a href="https://www.linkedin.com/company/acme-studio">LinkedIn</a>
<iframe src="https://www.youtube.com/embed/abc"></iframe>
<a href="https://podcasts.apple.com/ca/podcast/acme/id1">Our podcast</a>
<p>123 Queen St W, Toronto, ON</p>
</body></html>
"""

TEAM = """
<h2>Meet the team</h2>
<div class="card"><h3>Jane Doe</h3><p>Founder</p></div>
<div class="card"><h3>John Q. Public</h3></div>
<div class="card"><h3>Mary-Kate O'Neil</h3></div>
<div class="card"><h3>Priya Shah</h3></div>
<h3>Our Values</h3><h3>Contact Us</h3>
"""


class ExtractTests(unittest.TestCase):
    def setUp(self):
        self.soup = extract.soup_of(PAGE)

    def test_cloudflare_decode(self):
        self.assertEqual(extract.decode_cfemail(cf_encode("kevin@example.org")), "kevin@example.org")
        self.assertEqual(extract.decode_cfemail("zz"), "")

    def test_emails_found_and_junk_dropped(self):
        emails = [e["email"] for e in extract.emails_in(self.soup, "https://acme.ca/")]
        for expected in ("hello@acme.ca", "press@acme.ca", "jobs@acme.ca", "events@acme.ca", "jane@acme.ca"):
            self.assertIn(expected, emails)
        self.assertNotIn("logo@2x.png", emails)
        self.assertNotIn("someone@example.com", emails)

    def test_rank_prefers_own_domain_and_named_inboxes(self):
        ranked = extract.rank_emails(
            [{"email": e, "source": ""} for e in ("zed@gmail.com", "press@acme.ca", "hello@acme.ca", "x@other.com")],
            "https://www.acme.ca",
        )
        self.assertEqual([e["email"] for e in ranked], ["hello@acme.ca", "press@acme.ca", "x@other.com", "zed@gmail.com"])
        ranked = extract.rank_emails([{"email": "careers@acme.ca", "source": ""}, {"email": "sam@gmail.com", "source": ""}], "https://acme.ca")
        self.assertEqual(ranked[0]["email"], "sam@gmail.com")

    def test_phones_socials_video_podcast(self):
        self.assertEqual(extract.phones_in(self.soup), ["+1 (416) 555-0100"])
        socials = extract.socials_in(self.soup, "https://acme.ca/")
        self.assertEqual(socials["instagram"], "https://www.instagram.com/acmestudio/")
        self.assertEqual(socials["linkedin"], "https://www.linkedin.com/company/acme-studio")
        self.assertNotIn("facebook", socials)  # a share button isn't their page
        self.assertTrue(extract.has_video(self.soup))
        self.assertTrue(extract.has_podcast(self.soup))

    def test_candidate_pages_same_site_contact_first(self):
        pages = extract.candidate_pages(self.soup, "https://acme.ca/", 3)
        self.assertEqual(pages[0], "https://acme.ca/contact")
        self.assertIn("https://acme.ca/team", pages)
        self.assertTrue(all(p.startswith("https://acme.ca/") for p in pages))
        self.assertNotIn("https://acme.ca/brochure.pdf", pages)

    def test_team_size(self):
        self.assertEqual(extract.team_size(extract.soup_of(TEAM)), 4)
        self.assertIsNone(extract.team_size(extract.soup_of("<h3>Jane Doe</h3>")))

    def test_description_site_name_and_place(self):
        self.assertEqual(extract.description_of(self.soup), "Brand strategy for climate companies.")
        self.assertEqual(extract.site_name(self.soup), "Acme Studio")
        self.assertTrue(extract.mentions_place(self.soup, ["Toronto"]))
        self.assertFalse(extract.mentions_place(self.soup, ["Vancouver"]))
        self.assertTrue(extract.mentions_place(extract.soup_of("<p>We're a studio based in Toronto.</p>"), ["Toronto"]))
        self.assertTrue(extract.mentions_place(extract.soup_of("<p>1 King St W, Toronto M5H 1A1</p>"), ["Toronto"]))
        self.assertFalse(extract.mentions_place(extract.soup_of("<p>Catch us at events in Toronto and Austin.</p>"), ["Toronto"]))

    def test_no_solicitation_notice(self):
        self.assertTrue(extract.forbids_solicitation(extract.soup_of("<p>We do not accept unsolicited sales emails.</p>")))
        self.assertTrue(extract.forbids_solicitation(extract.soup_of("<p>No solicitations please.</p>")))
        self.assertFalse(self.soup and extract.forbids_solicitation(self.soup))


if __name__ == "__main__":
    unittest.main()
