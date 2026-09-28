/* All shot data. Every shot = one storyboard frame. */
(function () {
  const SZ = { wide: 'WIDE', medium: 'MEDIUM', tight: 'TIGHT', macro: 'MACRO' };
  const MV = MCF.MOVE;
  const PMOVE = { slide: 'slider', push: 'push', orbit: 'orbit', edge: 'slider' };

  /* ---------- helpers to build render fns ---------- */
  const venueStill = (v, k) => () => MC.scene(v, k);
  const venueClip = (v, base, mv, label, extra) => () => MC.scene(v, base, Object.assign({ motion: () => MCF.moveOverlay(mv), label, cam: base, path: { slider: 'slide', sliderV: 'slide', push: 'push', orbit: 'orbit', follow: 'orbit', jib: 'push', rack: 'push', reveal: 'push', static: null, edge: 'edge' }[mv] }, extra || {}));
  const fac = (st, size, mv, o) => () => MCF.factory(st, size, mv, o);
  const intv = (who, size, mv) => () => MCF.interview(who, size, mv);
  const vert = svg => svg.replace('role="img"', 'preserveAspectRatio="xMidYMid slice" role="img"');

  const SITES = [
    { id: 'freedom', ab: 'FMB', name: 'Freedom Mobile', focus: 'Full store + lightbox / fabric graphic details', note: 'Use the display centre as the camera-height reference. Preserve the same clean proportions in a smaller retail footprint.' },
    { id: 'bmw', ab: 'BMW', name: 'BMW', focus: 'Showroom atmosphere + large-format graphics', note: 'Keep the car and showroom secondary to the graphic. Use the large installation as the anchor.' },
    { id: 'volvo', ab: 'VOL', name: 'Volvo', focus: 'Showroom atmosphere + large-format graphics', note: 'Repeat the same front-on proportion and paired side angles, managing glass and floor reflections.' },
    { id: 'lambo', ab: 'LAM', name: 'Lamborghini', focus: 'Premium feel, close-up material details', note: 'Low, moody light. Let the fabric and edge finish do the talking. Spend extra frames on materials.' },
    { id: 'mazda', ab: 'MAZ', name: 'Mazda', focus: 'Showroom atmosphere + large-format graphics', note: 'Match the BMW and Volvo treatment while adapting to the actual display and clear floor space.' },
    { id: 'walmart', ab: 'WMT', name: 'Walmart', focus: 'Sense of scale, hanging structures', note: 'Use the same eight compositions on the approved structure. For overhead work, choose an accessible parallel viewpoint where possible and correct verticals.' },
    { id: 'bestbuy', ab: 'BBY', name: 'Best Buy', focus: 'In-store displays + lightboxes', note: 'Keep adjacent screens from dominating the frame. Match the displayed graphic’s colour and the common visual proportions.' },
    { id: 'hisense', ab: 'HIS', name: 'Hisense', focus: 'Display area / trade-show structures', note: 'Apply the same framing and detail scale to the confirmed display. Final access and installation type are checked in pre-production.' }
  ];
  const DAYS = [
    { n: 1, sites: ['bmw', 'volvo'], focus: 'Showroom atmosphere, installation heroes and reflections.' },
    { n: 2, sites: ['lambo', 'mazda'], focus: 'Lamborghini: premium feel and material close-ups. Mazda: showroom context and installation details.' },
    { n: 3, sites: ['walmart', 'bestbuy'], focus: 'Scale, hanging structures, in-store displays and lightboxes.' },
    { n: 4, sites: ['freedom', 'hisense'], focus: 'Full store, lightbox and fabric detail, plus display area and trade-show structures.' }
  ];
  const STILL_SIZE = { context: 'wide', hero: 'medium', left: 'medium', right: 'medium', tight: 'tight', macroF: 'macro', macroC: 'macro', inuse: 'medium' };

  /* =========================================================
     PROJECT 1 · INSTALLATION PHOTOGRAPHY + site clips
     ========================================================= */
  function photoShots() {
    const out = [];
    SITES.forEach(s => {
      MC.SHOTS.forEach(sh => {
        out.push({
          id: `${s.ab}-S${sh.id}`, project: 'photo', site: s.id, group: s.name, kind: 'still',
          title: `${sh.name}`, size: STILL_SIZE[sh.key], move: 'static', lens: sh.lens, fps: 'RAW · ISO 100 · f/8', dur: 'still',
          note: sh.t + (sh.id === 1 ? ' ' + s.note : '') + (s.id === 'lambo' && [6, 7].includes(sh.id) ? ' Extra frames here: stitching, edge bead, brushed metal.' : ''),
          render: venueStill(s.id, sh.key)
        });
      });
      const clips = [
        ['M1', 'slider', 'medium', 'hero', 'Front-on slider pass', '35–50mm', '4K · 29.97 · 1/60', '10s', 'Slow lateral slide square to the display, then a vertical pass. Same speed at every site. 5–10 s clean hold at each end.'],
        ['M2', 'push', 'wide', 'context', 'Gimbal push-in', '24–35mm', '4K · 29.97 · 1/60', '8s', 'Start on the wide context and glide toward the hero framing. Clean start and end, level horizon.'],
        ['M3', 'slider', 'macro', 'macroF', 'Detail slide along the fabric', '90–105mm macro', '4K · 59.94 · 1/120', '6s', 'Short slider move across the weave and along the frame edge. Direction matches the still detail shots. Slow motion only if flicker-free.'],
        ['M4', 'orbit', 'medium', 'hero', '360° orbit of the display', '24–35mm', '4K · 29.97 · 1/60', '12s', 'Gimbal arc around the installation where floor space allows; where it doesn’t, a 120° arc. Watch reflections and keep the graphic sharp.'],
        ['M5', 'follow', 'wide', 'context', 'Gimbal follow: shopper walks up', '24–35mm', '4K · 59.94 · 1/120', '9s', 'Follow a person (with permission) as they walk into frame and stop at the display. A human moment for social and the case study.'],
        ['M6', 'slider', 'medium', 'hero', 'Vertical 9:16 · hero slider', '35–50mm', '4K vertical · 29.97', '8s', 'Social/ads: rotate the camera and shoot a dedicated 9:16 pass. Keep the graphic inside the safe zone.', true],
        ['M7', 'push', 'tight', 'tight', 'Vertical 9:16 · tight push-in', '50–85mm', '4K vertical · 29.97', '6s', 'Social/ads: a tight push to the graphic with room for a caption top and bottom.', true]
      ];
      clips.forEach(c => {
        const [n, mv, size, base, title, lens, fps, dur, note, v] = c;
        out.push({
          id: `${s.ab}-${n}`, project: 'photo', site: s.id, group: s.name, kind: 'clip', vertical: !!v,
          title, size, move: mv, lens, fps, dur, note,
          render: v ? () => vert(venueClip(s.id, base, mv, `${s.name.toUpperCase()} · ${n} · 9:16`)()) : venueClip(s.id, base, mv, `${s.name.toUpperCase()} · ${n}`)
        });
      });
    });
    return out;
  }

  /* =========================================================
     PROJECT 2 · HOMEPAGE LOOP (Video 1)
     [size, move, title, note, lens, fps, dur]
     ========================================================= */
  const LOOP = [
    { t: '00:00–00:04', name: 'Colour in motion', st: 'print', story: 'Machines running. A lateral slider move follows the printhead across fresh blue and gold. The same blue is framed to match the closing shot.', shots: [
      ['wide', 'static', 'The floor, machines running', 'Locked-off wide of the facility so the whole loop starts with scale. Keep the top-left third dark and clear for the white headline.', '24mm', '120fps', '3s', 'floor'],
      ['wide', 'slider', 'Printer bay, printhead pass', 'Slider left to right along the print line. Operators working, printhead mid-pass.', '24–35mm', '120fps', '4s', 'print'],
      ['medium', 'follow', 'Print comes off the printer', 'Gimbal follows the operator as the fresh print slides off the bed.', '35–50mm', '120fps', '3s', 'print'],
      ['macro', 'slider', 'Ink meets fabric', 'Macro slider along the weave as the colour settles. Frame a bold blue area to match the closing shot.', '90–105mm', '240fps', '2s', 'print']] },
    { t: '00:04–00:07', name: 'Two sets of eyes', st: 'design', story: 'Two coworkers compare the proof and printed fabric, pointing to a detail and checking it together.', shots: [
      ['medium', 'static', 'The proof check, two-shot', 'Locked medium two-shot. Two coworkers, natural interaction, no eye contact with camera.', '50mm', '120fps', '3s', 'design'],
      ['tight', 'push', 'Pointing to a detail', 'Over-the-shoulder push-in to a fingertip on the proof.', '85mm', '120fps', '2s', 'design']] },
    { t: '00:07–00:10', name: 'The precise cut', st: 'cut', story: 'Macro blade and fabric edge. Cut on the movement so the sequence feels musical even without sound.', shots: [
      ['wide', 'orbit', 'Gantry cutting table', 'Slow gimbal arc around the cutting table. Camera stays outside the safe zone.', '24mm', '60fps', '3s', 'cut'],
      ['macro', 'static', 'Blade through the edge', 'Locked macro of the blade and fabric edge, direction of travel matched to the next shot.', '100mm macro', '240fps', '2s', 'cut']] },
    { t: '00:10–00:13', name: 'The seam', st: 'sew', story: 'Thread, needle and fingers guiding the silicone edge. A clean, readable hand movement.', shots: [
      ['medium', 'push', 'Operator at the machine', 'Gentle push-in on the sewing operator, profile view.', '50mm', '120fps', '3s', 'sew'],
      ['macro', 'slider', 'Needle and silicone edge', 'Macro slider following the seam. Only high frame rate after a lighting test.', '100mm macro', '120fps', '2s', 'sew']] },
    { t: '00:13–00:17', name: 'Built together', st: 'frame', story: 'Two coworkers align and square the frame. One clear exchange and a shared check of the corner.', shots: [
      ['wide', 'jib', 'Frame on the bench, jib up', 'Jib or high gimbal lift reveals the structure and both coworkers.', '24–35mm', '60fps', '4s', 'frame'],
      ['medium', 'follow', 'Two coworkers square the frame', 'Gimbal moves with them as they carry and align the frame.', '35mm', '120fps', '3s', 'frame'],
      ['macro', 'slider', 'Corner joint tightening', 'Macro slider across the corner joint and fastener.', '100mm macro', '120fps', '2s', 'frame']] },
    { t: '00:17–00:20', name: 'The finishing touch', st: 'assembly', story: 'A fingertip seats the edge; the fabric becomes taut. A tiny action carries the transition to the reveal.', shots: [
      ['medium', 'push', 'Tensioning the graphic', 'Push-in as the graphic is pulled taut across the frame.', '50mm', '120fps', '3s', 'assembly'],
      ['macro', 'slider', 'Edge seated into the frame', 'Macro edge-to-surface move, screen direction matched to the next shot.', '100mm macro', '240fps', '2s', 'assembly'],
      ['tight', 'static', 'Hands smooth the face', 'Tight locked shot of hands checking the finished face.', '85mm', '120fps', '2s', 'assembly']] },
    { t: '00:20–00:24', name: 'The glow', st: 'led', story: 'The display illuminates. A natural shared look between coworkers makes the result feel human.', shots: [
      ['wide', 'reveal', 'The lightbox switches on', 'Locked exposure, slow pullback. Preserve graphic colour and expose for the LEDs.', '35mm', '60fps', '4s', 'reveal'],
      ['tight', 'rack', 'LED strip lights up', 'Rack focus from the connector to the glowing graphic.', '85mm', '120fps', '2s', 'led'],
      ['macro', 'slider', 'Diodes coming on', 'Macro slider along the LED strip. Test flicker before every setup.', '100mm macro', '120fps', '2s', 'led'],
      ['medium', 'static', 'The shared look', 'Two coworkers glance up at the glow. Honest reaction, no performance.', '50mm', '60fps', '2s', 'reveal']] },
    { t: '00:24–00:28', name: 'Back to the beginning', st: 'print', story: 'Blue printed fabric moving past the lens. Colour, speed and direction match shot one for a seamless return.', shots: [
      ['macro', 'slider', 'Blue fabric rolling past', 'Loop-match frame: same colour, same speed, same direction as the opening macro.', '100mm macro', '240fps', '2s', 'print'],
      ['wide', 'slider', 'Matching print-line pass', 'Second slider pass that resolves into the opening wide.', '24–35mm', '120fps', '2s', 'print']] }
  ];
  function loopShots() {
    const out = [];
    LOOP.forEach((b, i) => b.shots.forEach((s, j) => {
      const [size, mv, title, note, lens, fps, dur, st] = s;
      out.push({ id: `LP-${String(i + 1).padStart(2, '0')}${'abcdef'[j]}`, project: 'loop', group: `Beat ${i + 1} · ${b.name}`, beat: i, title, size, move: mv, lens, fps, dur, note, time: b.t,
        render: fac(st, size, mv, { cast: i + j, label: `LOOP ${i + 1}${'abcdef'[j]} · ${SZ[size]}` }) });
    }));
    return out;
  }

  /* =========================================================
     PROJECT 3 · HOW WE MAKE IT (Video 2, ~2:00)
     shot: [source, size, move, title, note, lens, fps, dur, sound]
     source: 'st:print' | 'v:bmw:hero' | 'i:bob:medium'
     ========================================================= */
  const CASE = [
    { t: '00:00–00:10', name: 'The result. Before the process.', story: 'A finished lightbox fills the frame. A person passes through the showroom, giving the installation scale. Cut from the glowing surface to the hands that made it.', shots: [
      ['v:bmw:hero', 'medium', 'slider', 'The finished installation', 'Slow slider toward the glowing surface. Subtle switch-on tone.', '35–50mm', '29.97', '4s', 'Room tone, a subtle switch-on. Bob’s strongest line begins over the image.'],
      ['v:bmw:inuse', 'wide', 'push', 'A person walks through', 'Gimbal push-in as a customer walks past. Gives scale.', '24–35mm', '59.94', '3s', ''],
      ['st:assembly', 'macro', 'slider', 'Cut to the hands', 'Match-cut from the glowing fabric to the seam at the bench.', '100mm macro', '120', '3s', '']] },
    { t: '00:10–00:20', name: 'Meet the person behind it.', story: 'Bob sits in a calm, beautifully lit corner of the facility. We cut to him walking the floor and talking naturally with the team.', shots: [
      ['i:bob:medium', 'medium', 'static', 'Bob, medium portrait (A-cam)', 'Medium portrait with soft key. Use his own words, not a memorised script.', '50–85mm', '29.97', '4s', '“What do you want people to feel when they work with McRae?”'],
      ['i:bob:follow', 'wide', 'follow', 'Bob walks the floor', 'Gimbal follow, eye level. Bob greets the team on the way.', '24–35mm', '59.94', '4s', 'Walk-and-talk, natural floor sound.'],
      ['i:bob:wide', 'wide', 'static', 'Interview set, B-cam wide', 'Wide two-camera coverage of the whole corner for the edit.', '24–35mm', '29.97', '2s', '']] },
    { t: '00:20–00:30', name: 'An idea becomes a plan.', story: 'A designer and department lead review artwork together, checking colour and the intended installation.', shots: [
      ['st:design', 'wide', 'slider', 'Design and prepress desks', 'Slider across the desks, monitors glowing with the artwork.', '24–35mm', '29.97', '3s', 'Department lead explains their role.'],
      ['st:design', 'medium', 'push', 'Two people, one proof', 'Over-the-shoulder push-in on the shared proof.', '50mm', '59.94', '4s', ''],
      ['st:design', 'tight', 'static', 'A hand marks the proof', 'Tight on a pen marking the colour proof.', '85mm', '29.97', '3s', '']] },
    { t: '00:30–00:40', name: 'Colour comes to life.', story: 'Begin wide, then move into extreme close-up: colour settling into the fabric weave, an operator checking the approved reference.', shots: [
      ['st:print', 'wide', 'slider', 'Print bay, wide', 'Wide establishing, lateral slider along the printer.', '24mm', '29.97', '3s', 'Layer printer rhythm under the music.'],
      ['st:print', 'medium', 'orbit', 'Operator portrait, 360° arc', 'Gimbal arc around the operator checking the print.', '35mm', '59.94', '3s', 'Interview theme: what quality looks like here.'],
      ['st:print', 'macro', 'slider', 'Colour in the weave', 'Macro slider, ink settling into the fabric. Sharp detail up close.', '100mm macro', '120', '4s', 'Callout: sharp detail up close.']] },
    { t: '00:40–00:50', name: 'Every edge matters.', story: 'An extreme close-up follows the cutting edge through the printed fabric. Pull out briefly for the craftsperson, then return to the fresh edge.', shots: [
      ['st:cut', 'wide', 'jib', 'Cutting table from above', 'High jib lift reveals the whole table. Camera stays clear of the gantry.', '24mm', '29.97', '3s', 'The cutting sound punctuates the edit.'],
      ['st:cut', 'medium', 'static', 'Craftsperson at the table', 'Locked medium, natural check of a cut edge.', '50mm', '29.97', '3s', 'Short phrase on care and consistency.'],
      ['st:cut', 'macro', 'static', 'Blade and edge', 'Locked macro from a safe position.', '100mm macro', '120', '4s', 'Callout: edge-to-edge printing.']] },
    { t: '00:50–01:00', name: 'Craft you can see.', story: 'Needle, thread and silicone edge fill the frame. Follow the seam being formed, then reveal the craftsperson guiding it.', shots: [
      ['st:sew', 'macro', 'slider', 'Needle and seam', 'Macro slider following the stitch line.', '100mm macro', '120', '3s', 'Natural sewing rhythm.'],
      ['st:sew', 'medium', 'orbit', 'Profile of the craftsperson', 'Medium gimbal arc as the seam runs through the machine.', '35–50mm', '59.94', '4s', 'What customers may never notice, but the team always checks.'],
      ['st:sew', 'tight', 'static', 'Hands inspect the finish', 'Tight locked shot of hands running along the finished seam.', '85mm', '29.97', '3s', '']] },
    { t: '01:00–01:10', name: 'Built for the right light.', story: 'Start inches from an LED diode and connector. A lighting specialist tests the assembly; a wider portrait connects the detail to the person.', shots: [
      ['st:led', 'macro', 'rack', 'Diode to connector', 'Rack focus across the connector and diodes.', '100mm macro', '59.94', '3s', 'Confirm the actual testing steps at the scout.'],
      ['st:led', 'medium', 'push', 'The lighting specialist', 'Push-in on the bench as the lightbox is tested.', '50mm', '29.97', '4s', 'Lighting lead explains their role.'],
      ['st:led', 'wide', 'static', 'Bench wide', 'Controlled lights-on frame, exposure held for the LEDs.', '24–35mm', '29.97', '3s', '']] },
    { t: '01:10–01:20', name: 'The structure takes shape.', story: 'Macro views of the corner joint, fastener and brushed aluminum establish precision. Two coworkers align the full frame together at the bench.', shots: [
      ['st:frame', 'macro', 'slider', 'Corner joint and fastener', 'Slider across brushed aluminum.', '100mm macro', '120', '3s', 'Tool sounds carry the transition.'],
      ['st:frame', 'wide', 'follow', 'Two coworkers align the frame', 'Gimbal follow as they carry the frame to the bench. PPE in frame where required.', '24–35mm', '59.94', '4s', 'Interview theme: how departments depend on each other.'],
      ['st:frame', 'medium', 'static', 'Measuring and tightening', 'Locked medium of hands measuring and tightening.', '50mm', '29.97', '3s', '']] },
    { t: '01:20–01:30', name: 'Everything comes together.', story: 'A worker seats the silicone edge into the frame. The graphic becomes taut; the team checks corners and the finished face.', shots: [
      ['st:assembly', 'macro', 'slider', 'Silicone edge insertion', 'Macro slider along the edge as it seats.', '100mm macro', '120', '3s', 'A quieter moment to build anticipation.'],
      ['st:assembly', 'medium', 'push', 'Graphic pulled taut', 'Medium push-in as the fabric tensions.', '50mm', '59.94', '4s', 'Department lead: the final check before a piece leaves.'],
      ['st:assembly', 'wide', 'reveal', 'Whole piece assembled', 'Slow reveal from the detail out to the full assembled piece.', '24–35mm', '29.97', '3s', '']] },
    { t: '01:30–01:40', name: 'The reveal.', story: 'The finished lightbox switches on. Hold the full result, then find an honest reaction from the people who made it.', shots: [
      ['st:reveal', 'wide', 'pull', 'Lights on, slow pullback', 'Locked before-and-after framing then a slow pull-out.', '35mm', '29.97', '4s', 'Switch click, a beat of room sound, then the music opens.'],
      ['st:reveal', 'medium', 'static', 'The team reacts', 'A natural reaction, not a staged celebration.', '50–85mm', '59.94', '3s', ''],
      ['st:reveal', 'macro', 'static', 'Glowing weave', 'Macro of the lit fabric, the colour at full saturation.', '100mm macro', '29.97', '3s', 'Callout: photo-real colour.']] },
    { t: '01:40–01:50', name: 'From our floor to yours.', story: 'Careful packing and a handoff at shipping connect the workshop to the finished installation. Match a frame edge in the factory to the same detail on site.', shots: [
      ['st:pack', 'medium', 'static', 'Careful packing', 'Locked medium of hands packing and taping a finished piece.', '50mm', '29.97', '3s', 'Bob or a lead: the care that goes into a piece leaving the building.'],
      ['st:pack', 'wide', 'follow', 'Dispatch wide', 'Gimbal follow as the pallet leaves toward the dock.', '24mm', '59.94', '3s', ''],
      ['v:hisense:context', 'wide', 'slider', 'Installed on site', 'Match-cut to the same piece installed in the store.', '24–35mm', '29.97', '4s', 'Capture live installs only if one is scheduled.']] },
    { t: '01:50–02:00', name: 'Leave them with the people.', story: 'Return to the finished display, then the team around their work. End with McRae’s approved logo and website.', shots: [
      ['v:mazda:hero', 'medium', 'reveal', 'Finished display, clean frame', 'Clean final installation frame with space for the end card.', '35–50mm', '29.97', '4s', 'Bob’s closing thought. Resolve the music.'],
      ['st:floor', 'wide', 'push', 'The team together', 'Wide team composition, a small candid moment or two.', '24–35mm', '29.97', '4s', 'Hold the end card for readability.'],
      ['i:l1:wide', 'wide', 'static', 'Smiles at the bench', 'A last quiet look at the people. Logo and website come up.', '35mm', '29.97', '2s', '']] }
  ];

  const PEOPLE_INFO = [
    { id: 'bob', who: 'bob', name: 'Bob', role: 'Owner · company philosophy', qs: ['What do you want McRae to stand for?', 'Why is keeping the work connected under one roof important to you?', 'What makes you proud when you walk the floor?', 'What should a client feel after working with your team?'], tags: ['Six decades of experience', 'One team from start to finish'] },
    { id: 'l1', who: 'priya', name: 'Department lead 1', role: 'People & craft', qs: ['What is your role, and where does your team make the difference?', 'What is one detail you refuse to overlook?'], tags: ['Photo-real colour'] },
    { id: 'l2', who: 'marcus', name: 'Department lead 2', role: 'People & craft', qs: ['Tell us about a challenge you solved with another department.', 'What is one detail you refuse to overlook?'], tags: ['Edge-to-edge printing'] },
    { id: 'l3', who: 'mei', name: 'Department lead 3', role: 'People & craft', qs: ['How does the company’s philosophy show up in your everyday work?', 'What is your role, and where does your team make the difference?'], tags: ['Sharp detail up close'] }
  ];
  const ISHOT = [
    ['wide', 'static', 'Wide · two-camera set', 'Both cameras visible in the wide so the edit always has a safe cutaway. Soft key, calm corner of the facility.', '24–35mm', '29.97', '35–45 min'],
    ['medium', 'static', 'Medium · A-cam portrait', 'Eye-level medium portrait, lens at 50–85mm. Dedicated dialogue recorder plus backup audio.', '50–85mm', '29.97', '35–45 min'],
    ['wide', 'follow', 'Walk-and-talk · gimbal follow', 'Wide gimbal follow at their station, then out onto the floor. Sound mic on the subject.', '24–35mm', '59.94', '3–4 min'],
    ['macro', 'slider', 'Hands & craft · slider', 'Macro slider over the hands and tools: the small details that make the work theirs.', '90–105mm macro', '120', '3–4 min']
  ];
  const INSTORE = [
    ['bmw', 'hero', 'slider', 'medium', 'BMW · showroom slider', 'Slider past the hero graphic, floor reflection in frame.'],
    ['volvo', 'context', 'push', 'wide', 'Volvo · gimbal push-in', 'Glide in from the showroom entrance to the installation.'],
    ['lambo', 'macroC', 'slider', 'macro', 'Lamborghini · edge slide', 'Low-light macro along the frame edge and silicone bead.'],
    ['mazda', 'hero', 'orbit', 'medium', 'Mazda · 360° orbit', 'A full gimbal arc around the finished display.'],
    ['walmart', 'context', 'jib', 'wide', 'Walmart · jib up to the structure', 'Lift to reveal the hanging structure and the scale of the aisle.'],
    ['bestbuy', 'context', 'follow', 'wide', 'Best Buy · follow the shopper', 'Gimbal follows a shopper to the lightbox between screens.'],
    ['freedom', 'tight', 'rack', 'tight', 'Freedom Mobile · rack focus', 'Rack from the glowing graphic to the product beside it.'],
    ['hisense', 'inuse', 'static', 'medium', 'Hisense · people for scale', 'Locked medium with people walking through the display area.']
  ];

  function caseShots() {
    const out = [];
    CASE.forEach((b, i) => b.shots.forEach((s, j) => {
      const [src, size, mv, title, note, lens, fps, dur, sound] = s, [kind, a, c] = src.split(':');
      let render;
      if (kind === 'st') render = fac(a, size, mv, { cast: i + j + 1, label: `${(MCF.LABEL[a] || a).toUpperCase()} · ${SZ[size]}` });
      else if (kind === 'v') render = venueClip(a, c, mv, `${SITES.find(x => x.id === a).name.toUpperCase()} · ${SZ[size]}`);
      else render = intv(a, c, mv);
      out.push({ id: `HW-${String(i + 1).padStart(2, '0')}${'abcdef'[j]}`, project: 'case', group: `Scene ${i + 1} · ${b.name}`, beat: i, title, size, move: mv, lens, fps: fps + (fps.includes('fps') ? '' : ' fps'), dur, note, sound, time: b.t, render });
    }));
    PEOPLE_INFO.forEach(p => ISHOT.forEach((s, j) => {
      const [size, mv, title, note, lens, fps, dur] = s, key = ['wide', 'medium', 'follow', 'hands'][j];
      out.push({ id: `IV-${p.id.toUpperCase()}-${'WMFH'[j]}`, project: 'case', group: `Interview · ${p.name}`, person: p.id, title: `${p.name} · ${title}`, size, move: mv, lens, fps: fps + ' fps', dur, note, render: intv(p.id, key, mv === 'static' ? 'static' : mv === 'follow' ? 'follow' : 'slider') });
    }));
    INSTORE.forEach((s, i) => {
      const [v, base, mv, size, title, note] = s;
      out.push({ id: `IS-${SITES.find(x => x.id === v).ab}`, project: 'case', group: 'Finished products in stores', title, size, move: mv, lens: size === 'macro' ? '100mm macro' : '24–50mm', fps: '59.94 fps', dur: '4–6s', note: note + ' Case-study coverage shot alongside the site photography.', render: venueClip(v, base, mv, `${SITES.find(x => x.id === v).name.toUpperCase()} · IN STORE`) });
    });
    return out;
  }

  /* =========================================================
     PROJECT 4 · SOCIAL & AD CUTS
     ========================================================= */
  const SOCIAL = [
    { id: 'SC-01', title: 'Colour in Motion', len: '6s', fmts: ['9:16', '1:1', '16:9'], use: 'Bumper · pre-roll', src: () => fac('print', 'wide', 'slider', { label: 'BUMPER · COLOUR' }), beats: ['0–2s printhead slider, colour hits the fabric', '2–5s macro weave', '5–6s logo / URL'], from: 'LP-01a–d' },
    { id: 'SC-02', title: 'The Reveal', len: '15s', fmts: ['9:16', '1:1', '16:9'], use: 'Paid social · Reels · Shorts', src: () => fac('reveal', 'wide', 'pull', { label: 'AD · THE REVEAL' }), beats: ['0–3s hook: the dark frame', '3–9s build the frame, edge seated', '9–13s lights on, team reacts', '13–15s logo + call to action'], from: 'LP-06, LP-07' },
    { id: 'SC-03', title: 'Meet Bob', len: '15s', fmts: ['9:16', '16:9'], use: 'LinkedIn · About page', src: () => intv('bob', 'medium', 'static'), beats: ['0–3s Bob walks the floor', '3–12s best soundbite, captions on', '12–15s logo'], from: 'IV-BOB-M, IV-BOB-F' },
    { id: 'SC-04', title: 'Six Decades', len: '15s', fmts: ['9:16', '1:1', '16:9'], use: 'Brand ad', src: () => intv('bob', 'wide', 'static'), beats: ['0–4s archive-feel wide of the floor', '4–12s Bob on experience', '12–15s end card'], from: 'IV-BOB-W' },
    { id: 'SC-05', title: 'Photo-real Colour', len: '6s', fmts: ['9:16', '1:1'], use: 'Proof-point bumper', src: () => fac('print', 'macro', 'slider', { label: 'PROOF · COLOUR' }), beats: ['Macro colour slide', 'Text: photo-real colour'], from: 'HW-04c' },
    { id: 'SC-06', title: 'Edge to Edge', len: '6s', fmts: ['9:16', '1:1'], use: 'Proof-point bumper', src: () => fac('cut', 'macro', 'static', { label: 'PROOF · EDGE' }), beats: ['Blade through the edge', 'Text: edge-to-edge printing'], from: 'HW-05c' },
    { id: 'SC-07', title: 'Sharp Up Close', len: '6s', fmts: ['9:16', '1:1'], use: 'Proof-point bumper', src: () => fac('assembly', 'macro', 'slider', { label: 'PROOF · DETAIL' }), beats: ['Macro on weave and seam', 'Text: sharp detail up close'], from: 'HW-09a' },
    { id: 'SC-08', title: 'How We Make It · 30s', len: '30s', fmts: ['16:9', '9:16'], use: 'Ad master · YouTube · Meta', src: () => fac('floor', 'wide', 'push', { label: 'AD · 30s MASTER' }), beats: ['0–5s the result', '5–22s six process beats', '22–27s the reveal', '27–30s end card'], from: 'HW-01 → HW-12' },
    { id: 'SC-09', title: 'Behind the Glow', len: '15s', fmts: ['9:16', '1:1', '16:9'], use: 'Paid social', src: () => fac('led', 'wide', 'reveal', { label: 'AD · BEHIND THE GLOW' }), beats: ['Fast process montage', 'Lights on'], from: 'LP montage' },
    { id: 'SC-10', title: 'Built Together', len: '15s', fmts: ['9:16', '1:1'], use: 'Culture · hiring', src: () => fac('frame', 'wide', 'jib', { label: 'AD · BUILT TOGETHER' }), beats: ['Two coworkers align the frame', 'Team faces'], from: 'LP-05a–c' },
    { id: 'SC-11', title: 'Team Portraits', len: '15s', fmts: ['9:16', '1:1'], use: 'Culture · hiring', src: () => intv('l1', 'medium', 'static'), beats: ['Four voices, four hands', 'Names and roles'], from: 'IV-*' },
    { id: 'SC-12', title: 'The Seam', len: '6s', fmts: ['9:16', '1:1'], use: 'Bumper', src: () => fac('sew', 'macro', 'slider', { label: 'BUMPER · THE SEAM' }), beats: ['Needle and edge'], from: 'LP-04b' },
    { id: 'SC-13', title: 'The Cut', len: '6s', fmts: ['9:16', '1:1'], use: 'Bumper', src: () => fac('cut', 'macro', 'static', { label: 'BUMPER · THE CUT', seed: 4 }), beats: ['Blade through the fabric'], from: 'LP-03b' }
  ];
  SITES.forEach((s, i) => SOCIAL.push({ id: `SC-${14 + i}`, title: `Site Spotlight · ${s.name}`, len: '15s', fmts: ['9:16', '16:9'], use: 'Sales · social · case study for this client', src: () => venueClip(s.id, 'hero', 'slider', `${s.name.toUpperCase()} · SPOTLIGHT`), beats: ['0–4s wide push-in', '4–9s hero slider', '9–13s macro material', '13–15s client-approved end tag'], from: `${s.ab}-M1, M2, M3` }));
  SOCIAL.push(
    { id: 'SC-22', title: 'Site Heroes · 4:5 + 1:1', len: 'stills', fmts: ['4:5', '1:1'], use: 'Instagram · LinkedIn · sales decks', src: () => MC.scene('bmw', 'hero'), beats: ['8 hero crops per ratio'], from: '*-S2' },
    { id: 'SC-23', title: 'Poster Stills', len: 'stills', fmts: ['16:9'], use: 'Video poster images · site', src: () => MC.scene('lambo', 'tight'), beats: ['One per film', 'Full-resolution'], from: 'HW / LP' },
    { id: 'SC-24', title: 'Team & Workplace Portraits', len: 'stills', fmts: ['4:5', '16:9'], use: 'About · careers · social', src: () => intv('bob', 'medium', 'static'), beats: ['Portraits captured on the interview day'], from: 'IV-*' }
  );

  window.MCD = { SITES, DAYS, LOOP, CASE, PEOPLE_INFO, INSTORE, SOCIAL, SZ, MV, vert, photoShots, loopShots, caseShots, fac, intv, venueClip };
})();
