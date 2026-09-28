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

# Stormwing

`stormwing/index.html` is a vertical-scrolling shooter in the spirit of 1994's Raptor: Call of the Shadows, rebuilt with pixel art, a bloom glow layer, CRT scanlines and synthesized chiptune audio. It's a single static file.

- Fly with the mouse, touch-drag or WASD. Guns fire automatically. Space triggers **Overdrive** (slows time, fires faster), B or right-click drops a **Mega Bomb**, P pauses, M toggles sound.
- Four sectors (Coral Strait, Dust Belt, Whiteout Shelf, Neon Sprawl), each with procedural terrain, air and ground enemies, and a multi-phase boss. After sector 4 the themes loop at higher threat levels.
- Collect credit chips and spend them in the hangar: Pulse Cannon (5 levels), Swarm Missiles, Plasma Lance, Arc Coil chain lightning, Wing Drones, Shield Capacitor, Nanite Reactor, Hull Plating, Tractor Field, Overdrive Core and Mega Bombs.
- Kill chains raise a credit multiplier, and grazing enemy bullets charges Overdrive. Progress saves in localStorage.
