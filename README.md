# Sarasom Greenhouse

A CRM for kevinsarasom.com where every contact is a houseplant.

- **Water** a contact to log a touchpoint (a meme, a late "haha", occasionally an actual coffee).
- Skip a contact's watering schedule and they go Thriving → Thirsty → Wilting → **Composted** (they're a LinkedIn connection now).
- Move people through the **Friendship Funnel**, from "Met at a Thing" to "Would Help Me Move a Couch Up Stairs".
- Track net **coffees owed**, fast-forward a week of neglect, water everyone at once in panic mode, and generate excuses for not texting.

It's a single static file: open `index.html` in a browser or deploy it to any static host. Data is saved in your browser's localStorage.

# Off Leash Studio redesign

`offleash/` is a full redesign of offleashstudio.com: one static page plus the photos in `offleash/media/`. Open `offleash/index.html` in a browser or upload the folder to any static host.

Interactive pieces: a stretchy wordmark, a light table of prints you can drag and toss, a shutter button that develops new prints, the Head Tilt Machine (squeaky toy plus head tilts), a gallery you filter by backdrop color and heart like the real picking process, a session builder with an engraved dog tag and a spinning coffee table book, the tour as a gig poster with a bark-for-your-city meter, and a dachshund scroll bar that gets longer as you scroll. Type "treat" or "squirrel" on the page for easter eggs. All sounds are synthesized in the browser, and there's a sound toggle in the nav.

# Contact Sheet

`contact-sheet/` is an automatic lead generator for kevinsarasom.com. It watches the news for companies that just raised money, opened a Toronto office or launched something, finds business podcasts that could use Nomadic Pods, and maps independent pet businesses and shelters in every Off Leash tour city. It checks each lead's website for contact details, scores it against headshots, Nomadic Pods, experiential, Off Leash Studio and Pet Rescue Portraits, and writes a ready-to-edit email draft. You triage the leads on a contact-sheet dashboard (circle the keepers, cross out the rest), and a twice-weekly digest can land in your inbox. Nothing is sent without you. Setup is in [`contact-sheet/README.md`](contact-sheet/README.md).
