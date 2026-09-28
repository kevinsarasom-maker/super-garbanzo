/* McRae storyboard frame generator — every shot is drawn as its own SVG frame.
   window.MC = { scene(venueId, shotId), motion(venueId, moveId), interview(personId, shotId), topdown(...) } */
(function () {
  let UID = 0;
  const W = 640, H = 360;

  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const { CAST, fig, bust } = window.MCC;
  const CROWD = ['priya', 'marcus', 'mei', 'diego', 'harpreet', 'amara', 'lena', 'kenji', 'olu', 'rosa'];

  /* ---------- artwork on the printed graphic ---------- */
  function art(id, variant) {
    if (variant === 'B') {
      return `<g id="${id}"><rect width="1000" height="600" fill="#1c55b0"/><rect y="380" width="1000" height="220" fill="#153f88"/>
      <polygon points="180,600 470,80 640,80 350,600" fill="#f2a03d"/><polygon points="420,600 640,180 760,180 540,600" fill="#f7c65e"/>
      <polygon points="640,80 1000,80 1000,150 620,150" fill="#2b6fd6"/><polygon points="90,600 260,360 330,360 180,600" fill="#e5892b"/></g>`;
    }
    return `<g id="${id}"><rect width="1000" height="600" fill="url(#${id}bg)"/>
    <polygon points="0,330 130,200 210,270 340,120 470,300 560,210 700,90 820,260 900,170 1000,270 1000,600 0,600" fill="#a9c6f4"/>
    <polygon points="0,420 90,330 200,400 320,250 430,380 560,300 700,190 830,370 930,300 1000,360 1000,600 0,600" fill="#4f82df"/>
    <polygon points="0,520 140,410 250,480 400,360 520,470 650,380 780,470 900,400 1000,450 1000,600 0,600" fill="#1c48ad"/>
    <path d="M0,330 130,200 210,270 340,120 470,300 560,210 700,90 820,260 900,170 1000,270" fill="none" stroke="#e8c46a" stroke-width="3" opacity=".9"/>
    <path d="M0,420 90,330 200,400 320,250 430,380 560,300 700,190 830,370 930,300 1000,360" fill="none" stroke="#f0d283" stroke-width="2.4" opacity=".85"/>
    <rect y="440" width="1000" height="160" fill="url(#${id}mist)"/></g>`;
  }
  function artDefs(id, variant) {
    return `<linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7faff"/><stop offset="1" stop-color="#cbdcfb"/></linearGradient>
    <linearGradient id="${id}mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".5"/></linearGradient>` + art(id, variant);
  }

  /* projective panel: quad with true-ish perspective, drawn with skewed strips */
  function panel(id, cx, cy, w, h, yaw, glow) {
    const a = Math.abs(yaw), near = h * (1 + 0.15 * a), far = h * (1 - 0.15 * a);
    const hL = yaw > 0 ? far : (yaw < 0 ? near : h), hR = yaw > 0 ? near : (yaw < 0 ? far : h);
    const wp = w * (1 - 0.14 * a), x0 = cx - wp / 2, n = 18;
    const sf = t => (hR === hL ? t : (t * hR) / ((1 - t) * hL + t * hR));
    const hAt = s => hL + (hR - hL) * s, top = s => cy - hAt(s) / 2;
    let out = '';
    if (glow) out += `<g filter="url(#${id}blur)" opacity="${glow}"><polygon points="${x0 - 8},${top(0) - 8} ${x0 + wp + 8},${top(1) - 8} ${x0 + wp + 8},${top(1) + hR + 8} ${x0 - 8},${top(0) + hL + 8}" fill="#cfe2ff"/></g>`;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, s0 = sf(t0), s1 = sf(t1);
      const xa = x0 + s0 * wp, xb = x0 + s1 * wp + 0.7, ya = top(s0), yb = top(s1), hm = hAt((s0 + s1) / 2);
      const m = (yb - ya) / (xb - xa);
      out += `<g transform="translate(${xa.toFixed(2)},${ya.toFixed(2)}) matrix(1,${m.toFixed(4)},0,1,0,0)"><svg width="${(xb - xa).toFixed(2)}" height="${hm.toFixed(2)}" viewBox="${t0 * 1000} 0 ${(t1 - t0) * 1000} 600" preserveAspectRatio="none"><use href="#${id}"/></svg></g>`;
    }
    const pts = `${x0},${top(0)} ${x0 + wp},${top(1)} ${x0 + wp},${top(1) + hR} ${x0},${top(0) + hL}`;
    out += `<polygon points="${pts}" fill="none" stroke="#c4cbcf" stroke-width="${Math.max(2, w / 90)}" stroke-linejoin="miter"/><polygon points="${pts}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>`;
    return { svg: out, x0, wp, hL, hR, yTop0: top(0), yTop1: top(1), cy };
  }

  /* ---------- environments ---------- */
  function floorShine(id, hy, tint) {
    return `<rect y="${hy}" width="${W}" height="${H - hy}" fill="url(#${id}floor)"/><ellipse cx="320" cy="${hy + 55}" rx="230" ry="26" fill="${tint}" opacity=".18" filter="url(#${id}blur)"/>`;
  }
  function car(x, y, s, col, suv) {
    const t = suv ? 'M0,46 C0,34 8,30 24,28 L44,10 C62,2 118,2 138,10 L160,28 C182,31 196,36 196,48 L196,56 L0,56 Z' : 'M0,44 C0,34 10,30 32,27 L58,9 C74,1 112,1 130,9 L156,27 C178,30 192,34 192,46 L192,54 L0,54 Z';
    return `<g transform="translate(${x},${y}) scale(${s})"><ellipse cx="96" cy="58" rx="100" ry="6" fill="#000" opacity=".4"/><path d="${t}" fill="${col}"/><path d="${suv ? 'M46,12 L64,4 L120,4 L138,12 L154,28 L40,28Z' : 'M60,11 L76,3 L112,3 L128,11 L146,27 L48,27Z'}" fill="#0b1214" opacity=".75"/><path d="M8,40 L188,40" stroke="#fff" stroke-opacity=".25"/><circle cx="40" cy="54" r="14" fill="#0a0a0a"/><circle cx="40" cy="54" r="7" fill="#8b9296"/><circle cx="154" cy="54" r="14" fill="#0a0a0a"/><circle cx="154" cy="54" r="7" fill="#8b9296"/></g>`;
  }
  const VENUES = [
    { id: 'bmw', name: 'BMW', kind: 'showroom', type: 'Showroom installation', note: 'Keep the car and showroom secondary to the graphic. Use the large installation as the anchor.', day: 1, art: 'A', wall: ['#1d2624', '#0c1311'], car: ['#8fa3b8', false] },
    { id: 'volvo', name: 'Volvo', kind: 'showroom', type: 'Showroom installation', note: 'Repeat the same front-on proportion and paired side angles, managing glass and floor reflections.', day: 1, art: 'A', wall: ['#222a2c', '#0d1315'], car: ['#c9cfd2', true] },
    { id: 'lambo', name: 'Lamborghini', kind: 'showroom', type: 'Premium showroom', note: 'Premium feel and close-up material details. Keep the light low and moody, and let the fabric and edge finish do the talking.', day: 2, art: 'A', wall: ['#1a1a14', '#0a0a07'], car: ['#e0b71c', false] },
    { id: 'mazda', name: 'Mazda', kind: 'showroom', type: 'Showroom installation', note: 'Match the BMW and Volvo treatment while adapting to the actual display and clear floor space.', day: 2, art: 'A', wall: ['#2a2224', '#120c0e'], car: ['#a3242c', false] },
    { id: 'walmart', name: 'Walmart', kind: 'bigbox', type: 'Retail installation', note: 'Use the same eight compositions on the approved graphic or structure. For overhead work, choose an accessible parallel viewpoint where possible and correct verticals.', day: 3, art: 'B' },
    { id: 'bestbuy', name: 'Best Buy', kind: 'techwall', type: 'Retail display / lightbox', note: 'Keep adjacent screens from dominating the frame. Match the displayed graphic’s colour and the common visual proportions.', day: 3, art: 'A' },
    { id: 'freedom', name: 'Freedom Mobile', kind: 'phone', type: 'In-store graphic / compact lightbox', note: 'Use the display centre as the camera-height reference. Preserve the same clean proportions in a smaller retail footprint.', day: 4, art: 'B' },
    { id: 'hisense', name: 'Hisense', kind: 'tvarea', type: 'Display area / approved installation', note: 'Apply the same framing and detail scale to the confirmed display. Final access and installation type are checked in pre-production.', day: 4, art: 'A' }
  ];
  const V = Object.fromEntries(VENUES.map(v => [v.id, v]));

  function env(id, v, ox, hy) {
    let g = `<g transform="translate(${ox},0)">`;
    const R = rng(v.id.length * 977 + 13);
    if (v.kind === 'showroom') {
      g += `<rect x="-60" width="${W + 120}" height="${hy}" fill="url(#${id}wall)"/>`;
      for (let i = 0; i < 6; i++) g += `<circle cx="${20 + i * 120}" cy="6" r="60" fill="url(#${id}spot)"/>`;
      g += `<rect x="-60" y="${hy - 4}" width="${W + 120}" height="4" fill="#fff" opacity=".08"/>`;
      g += `<rect x="24" y="30" width="16" height="${hy - 30}" fill="#0a0f0e"/><rect x="${W - 60}" y="30" width="16" height="${hy - 30}" fill="#0a0f0e"/>`;
      g += floorShine(id, hy, '#dfe9ff');
      g += car(-70, hy - 26, 1.05, v.car[0], v.car[1]);
      g += `<g transform="translate(0,${2 * hy + 28}) scale(1,-1)" opacity=".18">${car(-70, hy - 26, 1.05, v.car[0], v.car[1])}</g>`;
    } else if (v.kind === 'techwall') {
      g += `<rect x="-60" width="${W + 120}" height="${hy}" fill="#0e1418"/>`;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) {
        const hue = Math.floor(R() * 360);
        g += `<rect x="${-30 + c * 72}" y="${18 + r * 52}" width="66" height="40" rx="2" fill="hsl(${hue},55%,${18 + R() * 16}%)" stroke="#05080a" stroke-width="2"/>`;
      }
      g += `<rect x="-60" width="${W + 120}" height="${hy}" fill="#000" opacity=".25"/>`;
      g += floorShine(id, hy, '#7fb0ff');
    } else if (v.kind === 'phone') {
      g += `<rect x="-60" width="${W + 120}" height="${hy}" fill="#d9d3c8"/><rect x="-60" width="${W + 120}" height="${hy}" fill="url(#${id}warm)"/>`;
      for (let r = 0; r < 4; r++) {
        g += `<rect x="-60" y="${28 + r * 46}" width="${W + 120}" height="3" fill="#8b7d68"/>`;
        for (let c = 0; c < 22; c++) g += `<rect x="${-40 + c * 32}" y="${6 + r * 46}" width="14" height="22" rx="2" fill="#${['1c1f24', '2b3138', 'e7e7e7', '3c4a5c'][Math.floor(R() * 4)]}"/>`;
      }
      g += floorShine(id, hy, '#fff');
    } else if (v.kind === 'tvarea') {
      g += `<rect x="-60" width="${W + 120}" height="${hy}" fill="#c9ced0"/><rect x="-60" width="${W + 120}" height="${hy}" fill="url(#${id}warm)" opacity=".6"/>`;
      g += `<rect x="24" y="40" width="130" height="78" fill="#0a1214"/><rect x="28" y="44" width="122" height="70" fill="url(#${id}tv)"/>`;
      g += `<rect x="${W - 170}" y="52" width="110" height="66" fill="#0a1214"/><rect x="${W - 166}" y="56" width="102" height="58" fill="url(#${id}tv2)"/>`;
      g += `<rect x="${W - 46}" y="70" width="64" height="${hy - 70}" rx="4" fill="#dfe3e4"/><rect x="${W - 42}" y="76" width="56" height="70" fill="#c3c9cb"/>`;
      g += floorShine(id, hy, '#fff');
    } else { /* aisle + bigbox: one-point perspective shelving */
      const big = v.kind === 'bigbox', vx = 320 - ox * 0.0;
      g += `<rect x="-60" width="${W + 120}" height="${hy}" fill="${big ? '#dfe4e8' : '#e3e0d6'}"/>`;
      g += `<rect x="-60" width="${W + 120}" height="${hy}" fill="url(#${id}warm)" opacity=".45"/>`;
      if (big) {
        for (let i = 0; i < 9; i++) g += `<rect x="${-40 + i * 84}" y="0" width="5" height="34" fill="#6d747a"/>`;
        g += `<rect x="-60" y="28" width="${W + 120}" height="5" fill="#7a8288"/>`;
        [[120, 46, 110], [330, 46, 150], [520, 46, 100]].forEach(([x, y, w]) => g += `<rect x="${x}" y="${y}" width="${w}" height="28" fill="#f4f4f0" stroke="#aab" /><rect x="${x + 6}" y="${y + 6}" width="${w * 0.5}" height="7" fill="#c9ccd2"/>`);
      }
      const shelf = (side) => {
        const x0 = side < 0 ? -60 : W + 60, x1 = side < 0 ? 208 : W - 208;
        let s = `<polygon points="${x0},0 ${x1},${hy - 92} ${x1},${hy + 40} ${x0},${H}" fill="${big ? '#5b6d84' : '#3c4a5c'}"/>`;
        for (let r = 0; r < 7; r++) {
          const t = r / 7, y0 = t * (H) + 10, y1 = (hy - 92) + t * 132;
          s += `<polygon points="${x0},${y0} ${x1},${y1} ${x1},${y1 + 4} ${x0},${y0 + 8}" fill="#e2b13c"/>`;
          for (let c = 0; c < 5; c++) {
            const u = c / 5, xx = x0 + (x1 - x0) * u, yy = y0 + (y1 - y0) * u, sc = 1 - u * 0.75;
            s += `<rect x="${xx - 16 * sc}" y="${yy - 30 * sc}" width="${26 * sc}" height="${30 * sc}" fill="${['#2c6fd1', '#e4a12a', '#e6e8ea', '#2f9a6e', '#c93c3c'][Math.floor(R() * 5)]}" opacity=".9"/>`;
          }
        }
        return s;
      };
      g += shelf(-1) + shelf(1);
      g += `<rect x="208" y="${hy - 92}" width="${W - 416}" height="132" fill="${big ? '#eef1f3' : '#f0ece2'}" opacity=".85"/>`;
      g += `<rect y="${hy}" x="-60" width="${W + 120}" height="${H - hy}" fill="url(#${id}floor)"/>`;
      for (let i = -6; i <= 6; i++) g += `<line x1="${320 + i * 18}" y1="${hy + 2}" x2="${320 + i * 130}" y2="${H}" stroke="#fff" stroke-opacity=".12"/>`;
      g += `<ellipse cx="320" cy="${hy + 45}" rx="200" ry="22" fill="#fff" opacity=".22" filter="url(#${id}blur)"/>`;
      g += `<polygon points="${-60},0 208,${hy - 92} 232,${hy - 92} -60,-10" fill="#fff" opacity=".0"/>`;
    }
    return g + '</g>';
  }
  function commonDefs(id, v) {
    const w = v.wall || ['#2a3230', '#0f1614'];
    return `<filter id="${id}blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="${id}blur4" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="${id}blur9" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>
    <linearGradient id="${id}wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w[0]}"/><stop offset="1" stop-color="${w[1]}"/></linearGradient>
    <radialGradient id="${id}spot"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.kind === 'showroom' || v.kind === 'techwall' ? '#2e3937' : '#c6c9c8'}"/><stop offset="1" stop-color="${v.kind === 'showroom' || v.kind === 'techwall' ? '#080c0b' : '#8b908f'}"/></linearGradient>
    <linearGradient id="${id}warm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9c0" stop-opacity=".5"/><stop offset="1" stop-color="#cfe0ff" stop-opacity=".2"/></linearGradient>
    <linearGradient id="${id}tv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a3c"/><stop offset=".5" stop-color="#7a3cff"/><stop offset="1" stop-color="#20c4ff"/></linearGradient>
    <linearGradient id="${id}tv2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#20ffb0"/><stop offset="1" stop-color="#2050ff"/></linearGradient>
    <linearGradient id="${id}metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b959a"/><stop offset=".3" stop-color="#f3f6f7"/><stop offset=".55" stop-color="#a5aeb3"/><stop offset="1" stop-color="#e7ecee"/></linearGradient>
    <linearGradient id="${id}metalv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b959a"/><stop offset=".3" stop-color="#f3f6f7"/><stop offset=".55" stop-color="#a5aeb3"/><stop offset="1" stop-color="#e7ecee"/></linearGradient>
    <radialGradient id="${id}vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
    <pattern id="${id}weave" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0,3.5H7M3.5,0V7" stroke="#000" stroke-opacity=".16" stroke-width="1.6"/><path d="M0,1.7H7M1.7,0V7" stroke="#fff" stroke-opacity=".12" stroke-width=".8"/></pattern>`;
  }

  /* ---------- top-down camera diagram ---------- */
  const CAM = {
    context: { c: [45, 62], fov: 62 }, hero: { c: [45, 47], fov: 42 }, left: { c: [22, 50], fov: 42 }, right: { c: [68, 50], fov: 42 },
    tight: { c: [45, 38], fov: 26 }, macroF: { c: [45, 29], fov: 12 }, macroC: { c: [66, 30], fov: 12 }, inuse: { c: [45, 47], fov: 42 }
  };
  function topdown(camKey, path) {
    const d = CAM[camKey], tx = camKey === 'left' ? 34 : camKey === 'right' ? 56 : camKey === 'macroC' ? 64 : 45, ty = 16;
    const [cx, cy] = d.c, ang = Math.atan2(ty - cy, tx - cx), half = d.fov * Math.PI / 360, L = 30;
    const p1 = [cx + Math.cos(ang - half) * L, cy + Math.sin(ang - half) * L], p2 = [cx + Math.cos(ang + half) * L, cy + Math.sin(ang + half) * L];
    let s = `<g class="td"><rect x="2" y="2" width="86" height="76" rx="6" fill="#050a08" fill-opacity=".72" stroke="#fff" stroke-opacity=".18"/>`;
    s += `<polygon points="${cx},${cy} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}" fill="#d4ff5a" fill-opacity=".22" stroke="#d4ff5a" stroke-opacity=".7" stroke-width=".7"/>`;
    s += `<rect x="24" y="12" width="42" height="5" rx="1.5" fill="#dfe8f5"/><rect x="24" y="12" width="42" height="5" rx="1.5" fill="none" stroke="#fff" stroke-opacity=".4"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="4" fill="#d4ff5a"/>`;
    if (path === 'slide') s += `<path d="M14,66 H76" stroke="#ffb35c" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M76,66 l-5,-3 v6z" fill="#ffb35c"/>`;
    if (path === 'push') s += `<path d="M45,72 V44" stroke="#ffb35c" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M45,42 l-3,6 h6z" fill="#ffb35c"/>`;
    if (path === 'orbit') s += `<path d="M18,60 Q45,78 72,60" fill="none" stroke="#ffb35c" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M73,59 l-6,-1 l3,6z" fill="#ffb35c"/>`;
    if (path === 'edge') s += `<path d="M28,28 H62" stroke="#ffb35c" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M63,28 l-5,-3 v6z" fill="#ffb35c"/>`;
    if (camKey === 'inuse') s += `<circle cx="72" cy="30" r="3" fill="#ffb35c"/>`;
    if (camKey === 'left' || camKey === 'right') s += `<text x="45" y="76" font-size="8" fill="#fff" fill-opacity=".8" text-anchor="middle" font-family="DM Mono,monospace">30°</text>`;
    return s + `</g>`;
  }

  /* ---------- viewfinder chrome ---------- */
  function chrome(id, label, camKey, path) {
    let s = `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/><g stroke="#fff" stroke-opacity=".55" stroke-width="1.4" fill="none"><path d="M14,30V14H30M${W - 30},14H${W - 14}V30M14,${H - 30}V${H - 14}H30M${W - 30},${H - 14}H${W - 14}V${H - 30}"/></g>`;
    s += `<g stroke="#fff" stroke-opacity=".12"><path d="M${W / 3},0V${H}M${2 * W / 3},0V${H}M0,${H / 3}H${W}M0,${2 * H / 3}H${W}"/></g>`;
    s += `<circle cx="28" cy="28" r="4" fill="#ff4d3d"><animate attributeName="opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite"/></circle><text x="38" y="32" font-family="DM Mono,monospace" font-size="11" fill="#fff" fill-opacity=".85" letter-spacing="1.4">${label}</text>`;
    s += `<g transform="translate(${W - 100},${H - 90})">${topdown(camKey, path)}</g>`;
    return s;
  }

  /* ---------- location shots ---------- */
  const SHOTS = [
    { id: 1, key: 'context', name: 'Front-on / context', lens: '24–35mm', cam: 'level camera', t: 'Camera square to the display plane; show the installation and enough of its setting to locate it.' },
    { id: 2, key: 'hero', name: 'Front-on / hero', lens: '35–50mm', cam: 'straight verticals', t: 'Move closer without changing the axis. Centre the graphic and keep edges parallel; match its proportion in the frame.' },
    { id: 3, key: 'left', name: 'Left / 30°', lens: '35–50mm', cam: 'repeatable oblique', t: 'Repeat a modest left-side angle to reveal depth. Keep the horizon level and the graphic fully readable.' },
    { id: 4, key: 'right', name: 'Right / 30°', lens: '35–50mm', cam: 'paired perspective', t: 'Mirror the left-side angle from a comparable distance and height. Preserve the same amount of surrounding context.' },
    { id: 5, key: 'tight', name: 'Front-on / tight', lens: '50–85mm', cam: 'controlled crop', t: 'A square, closer view isolates the image and a small border of frame. Preserve colour and visible texture.' },
    { id: 6, key: 'macroF', name: 'Macro / fabric', lens: '90–105mm macro', cam: 'surface plane', t: 'Show print detail and the fabric surface without stretching perspective. Match the detail scale across locations.' },
    { id: 7, key: 'macroC', name: 'Macro / construction', lens: '90–105mm macro', cam: 'edge detail', t: 'Frame the edge, corner or mounting junction to show the finish. Use the same diagonal direction and detail scale.' },
    { id: 8, key: 'inuse', name: 'Front-on / in use', lens: 'Hero lens / height', cam: 'people for scale', t: 'Return to the hero axis and include a person for scale where permitted. Keep the display as the sharp visual anchor.' }
  ];
  const MOVES = [
    { id: 'M1', key: 'slider', name: 'Front-on slider pass', lens: '35–50mm', cam: 'horizontal + vertical', t: 'A slow lateral slide, then a vertical one, square to the display. Repeat the same speed at every site.', tag: 'SLIDER →' },
    { id: 'M2', key: 'push', name: 'Gimbal push-in', lens: '24–35mm', cam: 'gentle gimbal', t: 'Start on the wide context and glide toward the hero framing. Clean starts and ends, 5–10 second usable holds.', tag: 'PUSH-IN' },
    { id: 'M3', key: 'edge', name: 'Detail slide', lens: '90–105mm macro', cam: 'along edge or fabric', t: 'A short slider move along the fabric weave or frame edge, direction matched to the still detail shots.', tag: 'DETAIL SLIDE' },
    { id: 'M4', key: 'orbit', name: 'Contextual move', lens: '24–35mm', cam: 'display in the space', t: 'A move that shows the display in the space with a person passing through. Short slider where an aisle is too tight for a gimbal.', tag: 'CONTEXT MOVE' }
  ];

  function personAt(id, v, x, by, hpx, who, o) { return fig(x, by, hpx, CAST[who], o); }

  function scene(venueId, shotKey, opts) {
    const v = V[venueId], id = 'u' + (++UID), sh = SHOTS.find(s => s.key === shotKey) || SHOTS[0];
    opts = opts || {};
    const hy = v.kind === 'aisle' || v.kind === 'bigbox' ? 232 : 228;
    const scale = v.kind === 'aisle' || v.kind === 'phone' ? 0.72 : v.kind === 'showroom' ? 1.02 : 0.9; // compact vs large graphics
    let body = '';
    const defs = commonDefs(id, v) + artDefs(id + 'a', v.art);
    const P = (cx, cy, w, h, yaw, glow) => panel(id + 'a', cx, cy, w * scale, h * scale, yaw, glow).svg;
    const glowId = id + 'a';
    const yawOf = { left: -1, right: 1 };
    if (['context', 'hero', 'left', 'right', 'inuse'].includes(shotKey)) {
      const yaw = yawOf[shotKey] || 0, ox = -yaw * 26;
      body += env(id, v, ox, hy);
      const big = shotKey === 'context' ? [250, 150] : shotKey === 'hero' || shotKey === 'inuse' ? [410, 246] : [380, 240];
      const cy = v.kind === 'aisle' || v.kind === 'phone' ? hy - 34 : hy - 42;
      const px = 320 + (shotKey === 'inuse' ? -34 : 0);
      body += `<g>${panelWithBlur(glowId, id, px, cy, big[0] * scale, big[1] * scale, yaw)}</g>`;
      if (shotKey === 'context') {
        const base = hy + 74;
        body += fig(150, base, 96, CAST[v.id === 'bmw' ? 'diego' : 'priya']) + fig(492, base - 8, 84, CAST[v.id === 'lambo' ? 'olu' : 'harpreet']);
      }
      if (shotKey === 'inuse') {
        const by = hy + 92, order = [['bob', 590, 168], ['amara', 520, 150]];
        body += fig(478, by, 176, CAST.bob) + fig(548, by + 6, 162, CAST.amara);
      }
      if (shotKey === 'left' || shotKey === 'right') body += fig(shotKey === 'left' ? 566 : 74, hy + 78, 92, CAST[['lena', 'kenji'][(venueId.length) % 2]]);
    } else if (shotKey === 'tight') {
      body += env(id, v, 0, hy) + `<rect width="${W}" height="${H}" fill="#0a0e0d" opacity=".5"/>`;
      body += panelWithBlur(glowId, id, 320, 180, 610, 346, 0);
    } else if (shotKey === 'macroF') {
      const seedA = id + 'a';
      body += `<rect width="${W}" height="${H}" fill="#0a0f0d"/>`;
      body += `<svg x="0" y="0" width="${W}" height="${H}" viewBox="${v.art === 'B' ? '360 120 200 112' : '520 140 200 112'}" preserveAspectRatio="xMidYMid slice"><use href="#${seedA}"/></svg>`;
      body += `<rect width="${W}" height="${H}" fill="url(#${id}weave)"/>`;
      const R = rng(v.id.length * 31);
      for (let i = 0; i < 26; i++) body += `<circle cx="${R() * W}" cy="${R() * H}" r="${1 + R() * 2}" fill="#fff" opacity="${0.05 + R() * .12}"/>`;
      body += `<rect width="${W}" height="${H}" fill="url(#${id}dof)"/>`;
    } else if (shotKey === 'macroC') {
      body += macroCorner(id, v, glowId);
    }
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${v.name} — ${sh.name}"><defs>${defs}${dofDef(id)}</defs>`;
    svg += body;
    if (opts.motion) svg += opts.motion(id);
    svg += chrome(id, opts.label || `${v.name.toUpperCase()} · ${String(sh.id).padStart(2, '0')}`, opts.cam || sh.key, opts.path);
    return svg + '</svg>';
  }
  function dofDef(id) {
    return `<radialGradient id="${id}dof" cx=".5" cy=".5" r=".7"><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>`;
  }
  function panelWithBlur(glowId, id, cx, cy, w, h, yaw) {
    // panel() needs its blur filter id to be `${glowId}blur`; provide alias filter on the fly
    return `<defs><filter id="${glowId}blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter></defs>` + panel(glowId, cx, cy, w, h, yaw, 0.55).svg +
      `<ellipse cx="${cx}" cy="${cy + h / 2 + 34}" rx="${w * 0.46}" ry="10" fill="#cfe2ff" opacity=".22" filter="url(#${glowId}blur)"/>`;
  }
  function macroCorner(id, v, glowId) {
    const R = rng(v.id.length * 57);
    let g = `<rect width="${W}" height="${H}" fill="#101614"/>`;
    for (let i = 0; i < 16; i++) g += `<circle cx="${R() * W}" cy="${R() * H}" r="${14 + R() * 30}" fill="hsl(${v.art === 'B' ? 32 : 215},60%,${40 + R() * 30}%)" opacity="${0.08 + R() * .16}" filter="url(#${id}blur4)"/>`;
    g += `<svg x="0" y="0" width="420" height="250" viewBox="${v.art === 'B' ? '380 90 300 180' : '560 220 300 180'}" preserveAspectRatio="xMidYMid slice"><use href="#${glowId}"/></svg>`;
    g += `<rect x="0" y="0" width="420" height="250" fill="url(#${id}weave)"/>`;
    g += `<rect x="0" y="236" width="432" height="16" fill="#f5f6f2"/><rect x="0" y="236" width="432" height="4" fill="#000" opacity=".2"/>`; // silicone bead
    g += `<rect x="408" y="0" width="16" height="252" fill="#f5f6f2"/>`;
    g += `<rect x="424" y="0" width="120" height="360" fill="url(#${id}metal)"/><rect x="0" y="252" width="640" height="108" fill="url(#${id}metalv)"/>`;
    g += `<path d="M424,252 L544,360 M424,252 L544,252" stroke="#000" stroke-opacity=".28" stroke-width="2"/><path d="M544,0V252H640" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="3"/>`;
    g += `<rect x="544" y="0" width="96" height="252" fill="#0c1110"/><rect x="0" y="252" width="640" height="2" fill="#fff" opacity=".5"/>`;
    [[470, 300], [500, 310], [470, 330]].forEach(([x, y]) => g += `<circle cx="${x}" cy="${y}" r="7" fill="#2a3033"/><circle cx="${x - 1}" cy="${y - 1}" r="5" fill="#a4aeb3"/><path d="M${x - 4},${y}H${x + 3}" stroke="#333" stroke-width="1.2"/>`);
    g += `<rect width="${W}" height="${H}" fill="url(#${id}dof)"/>`;
    return g;
  }

  function motion(venueId, moveKey) {
    const mv = MOVES.find(m => m.key === moveKey);
    const baseKey = { slider: 'hero', push: 'context', edge: 'macroF', orbit: 'left' }[moveKey];
    const m = id => {
      let s = '';
      if (moveKey === 'slider') s = `<g stroke="#ffb35c" fill="none" stroke-width="2.4"><rect x="120" y="110" width="200" height="118" stroke-dasharray="6 5" opacity=".7"/><rect x="330" y="110" width="200" height="118" stroke-dasharray="6 5" opacity=".7"/><path d="M60,300 H560" stroke-dasharray="8 6"/></g><path d="M572,300 l-16,-9 v18z" fill="#ffb35c"/><g stroke="#ffb35c" fill="none" stroke-width="2.4"><path d="M84,110 V260" stroke-dasharray="8 6" opacity=".9"/></g><path d="M84,272 l-8,-15 h16z" fill="#ffb35c"/>`;
      if (moveKey === 'push') s = `<g fill="none" stroke="#ffb35c" stroke-width="2.4"><rect x="150" y="95" width="340" height="190" stroke-dasharray="6 5" opacity=".65"/><rect x="200" y="122" width="240" height="136" stroke-dasharray="6 5" opacity=".8"/><rect x="250" y="148" width="140" height="84" /></g><path d="M105,320 L262,232 M535,320 L378,232 M105,60 L262,148 M535,60 L378,148" stroke="#ffb35c" stroke-opacity=".7" stroke-width="1.6" stroke-dasharray="5 5"/>`;
      if (moveKey === 'edge') s = `<path d="M70,300 H540" stroke="#ffb35c" stroke-width="2.6" stroke-dasharray="8 6"/><path d="M556,300 l-16,-9 v18z" fill="#ffb35c"/><rect x="70" y="120" width="180" height="110" fill="none" stroke="#ffb35c" stroke-width="2" stroke-dasharray="5 4"/>`;
      if (moveKey === 'orbit') s = `<path d="M70,310 C200,340 440,340 570,300" fill="none" stroke="#ffb35c" stroke-width="2.6" stroke-dasharray="8 6"/><path d="M576,298 l-17,-2 l8,15z" fill="#ffb35c"/>`;
      s += `<rect x="${W / 2 - 62}" y="14" width="124" height="24" rx="12" fill="#ffb35c"/><text x="${W / 2}" y="30" text-anchor="middle" font-family="DM Mono,monospace" font-size="12" font-weight="600" fill="#1a1206" letter-spacing="1.2">${mv.tag}</text>`;
      return s;
    };
    return scene(venueId, baseKey, { motion: m, label: `${V[venueId].name.toUpperCase()} · ${mv.id}`, cam: { slider: 'hero', push: 'context', edge: 'macroF', orbit: 'left' }[moveKey], path: { slider: 'slide', push: 'push', edge: 'edge', orbit: 'orbit' }[moveKey] });
  }


  window.MC = { VENUES, SHOTS, MOVES, CAST, CROWD, scene, motion, fig, bust, h: { rng, commonDefs, dofDef, topdown, W, H, artDefs, panel, env, chrome } };
})();
