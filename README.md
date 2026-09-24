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

# kevinsarasom.com redesign: The Light Table

`kevinsarasom/` is a full redesign of kevinsarasom.com: one static page plus optimized media in `kevinsarasom/media/` (about 5 MB, all WebP stills and short H.264 loops cut from Kevin's own films). Open `kevinsarasom/index.html` in a browser, or deploy the folder's contents as the site root.

The page is a working light table. The hero is a contact sheet of real C-41 color negatives made from Kevin's work, with china-marker notes; drag the loupe (or just move the mouse) to see the positive. Each section borrows a tool from the trade:

- **Headshots**: pick a seamless backdrop roll and the print swaps and "develops" on that color.
- **Nomadic Pods**: clap the slate to shoot an episode and watch one film day fill up to 6 episodes and 90+ assets.
- **Brand films**: Canadian Tire and The Working Group play as dailies with burnt-in timecode. The film strip under each one is a live shot index. "Watch the full film" streams the full cut from `kevinsarasom.com/reel/`.
- **Off Leash Studio**: the background is exactly 15,000 tally marks, one per dog, drawn around the content.
- **Activations**: press the shutter on the dye-sub printer and a 4×6 prints in yellow, magenta and cyan passes, then lands on the pile.
- **Pet Rescue Portraits**: prints hanging on a darkroom drying line.
- **Instagram**: a film strip that switches to the live `/api/instagram` feed when served from kevinsarasom.com.
- **Contact**: a production call sheet (with today's Toronto golden hour) that opens a pre-filled email to kevin@offleashstudio.com, or copies it as text.

The "Lights" switch in the nav toggles the room between lights on and a dark room (the light table stays lit), and "Sound" mutes the synthesized shutter, slate and printer sounds. The social share image is `media/og.jpg`, referenced as `https://kevinsarasom.com/media/og.jpg`.
