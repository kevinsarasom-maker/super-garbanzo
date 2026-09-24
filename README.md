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

# Redbird

`redbird/` is a 3D birding game you play in the browser, starring the Northern Cardinal. It's a **Big Day**: you have one May morning (10 real minutes, 5:30 to 11:30 AM in the game) to record as many species as you can around a backyard, meadow, pond and woods.

- **20 species** of eastern North American birds, including cardinals, blue jays, chickadees, orioles, a Great Blue Heron wading at the pond, a Red-tailed Hawk soaring overhead and a Great Horned Owl hidden in the pines. Each is modeled and colored from its real field marks, and some come in male and female plumages to collect.
- **Photograph birds** with a zoom camera. Shots earn one to three stars for size in the frame, focus, sharpness, composition and a side-on view, plus bonuses for behavior shots (singing, in flight, feeding, hunting).
- **Identify birds by ear.** Every song is synthesized to match the real species' pattern, played in 3D space and marked on the compass. Press E and pick the singer.
- **Sneak.** Every bird has a comfort distance. Running flushes birds, and crouching lets you get close.
- **Rare bird alert.** Partway through the morning, a vagrant Painted Bunting shows up at the feeders.
- The **field guide** is your life list. It carries over between Big Days, with your best photo of each species and silhouettes of the ones you haven't found yet.

Everything, including terrain, trees, birds, textures and sound, is generated in code. The only download is three.js from a CDN. The game uses ES modules, so serve the repo over HTTP (for example `npx serve .`) and open `/redbird/` instead of opening the file directly. It needs a keyboard and mouse.

