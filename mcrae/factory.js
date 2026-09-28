/* Factory / process / interview frames + camera-move overlays. Uses MC.h helpers. */
(function () {
  const { rng, commonDefs, dofDef, W, H, artDefs } = MC.h, CAST = MC.CAST, fig = MC.fig, bust = MC.bust;
  let UID = 5000;

  /* ---------- camera-move vocabulary ---------- */
  const MOVE = {
    static:  { tag: 'LOCKED OFF' },
    slider:  { tag: 'SLIDER →' },
    sliderV: { tag: 'SLIDER ↑' },
    follow:  { tag: 'GIMBAL FOLLOW' },
    orbit:   { tag: '360° ORBIT' },
    push:    { tag: 'PUSH-IN' },
    pull:    { tag: 'PULL-OUT' },
    jib:     { tag: 'JIB / CRANE UP' },
    over:    { tag: 'OVERHEAD' },
    hand:    { tag: 'HANDHELD' },
    reveal:  { tag: 'SLOW REVEAL' },
    rack:    { tag: 'RACK FOCUS' }
  };
  const OR = '#ffb35c';
  function moveOverlay(k) {
    let s = '';
    const ln = 'stroke="' + OR + '" stroke-width="2.6" stroke-dasharray="8 6" fill="none"';
    const ah = (x, y, a) => `<path d="M0,-9 L16,0 L0,9Z" transform="translate(${x},${y}) rotate(${a})" fill="${OR}"/>`;
    if (k === 'slider') s = `<path d="M70,318 H540" ${ln}/>` + ah(548, 318, 0);
    if (k === 'sliderV') s = `<path d="M590,300 V70" ${ln}/>` + ah(590, 62, -90);
    if (k === 'follow') s = `<path d="M60,326 C170,262 250,350 360,300 S520,250 580,300" ${ln}/>` + ah(584, 302, -20) + `<circle cx="60" cy="326" r="6" fill="${OR}"/><path d="M440,120 L500,120" stroke="${OR}" stroke-width="2"/>`;
    if (k === 'orbit') s = `<ellipse cx="320" cy="250" rx="250" ry="80" ${ln}/>` + ah(560, 226, -60) + `<circle cx="320" cy="170" r="4" fill="${OR}"/>`;
    if (k === 'push') s = `<g fill="none" stroke="${OR}" stroke-width="2.2"><rect x="120" y="70" width="400" height="220" stroke-dasharray="6 5" opacity=".6"/><rect x="210" y="118" width="220" height="124" stroke-dasharray="6 5" opacity=".85"/><rect x="270" y="150" width="100" height="60"/></g><path d="M80,330 L270,210 M560,330 L370,210 M80,30 L270,150 M560,30 L370,150" stroke="${OR}" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="5 5"/>`;
    if (k === 'pull') s = `<g fill="none" stroke="${OR}" stroke-width="2.2"><rect x="270" y="150" width="100" height="60" opacity=".9"/><rect x="210" y="118" width="220" height="124" stroke-dasharray="6 5" opacity=".85"/><rect x="120" y="70" width="400" height="220" stroke-dasharray="6 5" opacity=".6"/></g><path d="M270,210 L80,330 M370,210 L560,330 M270,150 L80,30 M370,150 L560,30" stroke="${OR}" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="5 5"/>`;
    if (k === 'jib') s = `<path d="M70,330 Q90,200 330,110" ${ln}/>` + ah(336, 108, -30);
    if (k === 'over') s = `<circle cx="320" cy="180" r="118" ${ln}/><path d="M320,62 v-10 M320,308 v10 M202,180 h-10 M438,180 h10" stroke="${OR}" stroke-width="2"/>`;
    if (k === 'hand') s = `<path d="M70,310 q20,-14 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0" ${ln}/>`;
    if (k === 'reveal') s = `<path d="M60,318 Q320,260 580,318" ${ln}/>` + ah(584, 318, 8) + `<rect x="200" y="100" width="240" height="130" fill="none" stroke="${OR}" stroke-width="2" stroke-dasharray="4 4" opacity=".7"/>`;
    if (k === 'rack') s = `<circle cx="210" cy="190" r="34" fill="none" stroke="${OR}" stroke-width="2.4"/><circle cx="440" cy="190" r="34" fill="none" stroke="${OR}" stroke-width="2.4" stroke-dasharray="4 4"/><path d="M250,190 H400" stroke="${OR}" stroke-width="2.4"/>` + ah(404, 190, 0);
    const t = MOVE[k].tag, w = 22 + t.length * 8.6;
    s += `<rect x="${W / 2 - w / 2}" y="14" width="${w}" height="24" rx="12" fill="${OR}"/><text x="${W / 2}" y="30" text-anchor="middle" font-family="DM Mono,monospace" font-size="12" font-weight="600" fill="#1a1206" letter-spacing="1.2">${t}</text>`;
    return s;
  }

  function chrome(id, label) {
    let s = `<rect width="${W}" height="${H}" fill="url(#${id}vig)"/><g stroke="#fff" stroke-opacity=".55" stroke-width="1.4" fill="none"><path d="M14,30V14H30M${W - 30},14H${W - 14}V30M14,${H - 30}V${H - 14}H30M${W - 30},${H - 14}H${W - 14}V${H - 30}"/></g>`;
    s += `<g stroke="#fff" stroke-opacity=".1"><path d="M${W / 3},0V${H}M${2 * W / 3},0V${H}M0,${H / 3}H${W}M0,${2 * H / 3}H${W}"/></g>`;
    return s + `<circle cx="28" cy="28" r="4" fill="#ff4d3d"><animate attributeName="opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite"/></circle><text x="38" y="32" font-family="DM Mono,monospace" font-size="11" fill="#fff" fill-opacity=".85" letter-spacing="1.4">${label}</text>`;
  }
  function wrap(id, defs, body, label, mv, extraDefs) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><defs>${defs}${dofDef(id)}${extraDefs || ''}</defs>${body}${mv ? moveOverlay(mv) : ''}${chrome(id, label)}</svg>`;
  }

  /* ---------- stations (drawn in 640x360 base coords) ---------- */
  const FOCUS = { // [focus x,y for medium, tight x,y]
    floor: [[320, 210], [320, 215]], design: [[330, 220], [300, 200]], print: [[340, 230], [400, 250]], cut: [[330, 235], [320, 240]],
    sew: [[300, 225], [300, 235]], led: [[330, 215], [340, 235]], frame: [[320, 230], [300, 250]], assembly: [[320, 235], [300, 245]],
    pack: [[330, 235], [330, 250]], reveal: [[320, 205], [320, 190]]
  };
  const LABEL = { floor: 'FACILITY', design: 'DESIGN', print: 'PRINT', cut: 'CUT', sew: 'SEW', led: 'LIGHTING', frame: 'FABRICATION', assembly: 'ASSEMBLY', pack: 'PACK & SHIP', reveal: 'REVEAL' };

  function backdrop(id, R, warm) {
    let g = `<rect width="${W}" height="${H}" fill="${warm ? '#c9c4b8' : '#c3cacb'}"/>`;
    for (let i = 0; i < 9; i++) g += `<rect x="${-20 + i * 82}" y="0" width="6" height="44" fill="#6c7378"/>`;
    g += `<rect y="30" width="${W}" height="6" fill="#737b80"/>`;
    for (let i = 0; i < 6; i++) g += `<circle cx="${40 + i * 112}" cy="14" r="52" fill="url(#${id}spot)"/>`;
    // far racking
    for (let i = 0; i < 14; i++) g += `<rect x="${i * 48}" y="${92 + (i % 3) * 6}" width="44" height="52" fill="${['#8a97a3', '#9aa5ad', '#7d8b96'][i % 3]}"/><rect x="${i * 48 + 4}" y="${100 + (i % 3) * 6}" width="${16 + (i % 4) * 6}" height="12" fill="${['#c98a3c', '#d9d2c0', '#5c86c6'][i % 3]}"/>`;
    g += `<rect y="196" width="${W}" height="164" fill="url(#${id}floor)"/><rect y="196" width="${W}" height="3" fill="#fff" opacity=".3"/>`;
    g += `<path d="M0,318 H${W}" stroke="#e0c235" stroke-width="3" stroke-dasharray="20 14" opacity=".55"/>`;
    return g;
  }
  function machine(x, y, w, h, c, id) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height="6" fill="#fff" opacity=".22"/><rect x="${x}" y="${y + h - 6}" width="${w}" height="6" fill="#000" opacity=".18"/>`; }

  function station(id, kind, R, cast) {
    const a = id + 'a'; let g = '', people = '';
    const c = n => CAST[cast[n % cast.length]];
    if (kind === 'floor') {
      g += machine(30, 120, 170, 84, '#dfe3e5') + machine(40, 132, 150, 22, '#3f4f5c') + `<rect x="60" y="104" width="120" height="20" rx="3" fill="#9aa4ab"/><rect x="60" y="204" width="130" height="10" fill="#666"/>`;
      g += `<path d="M42,138 H188" stroke="#d64c3a" stroke-width="5"/>`;
      g += machine(230, 150, 150, 46, '#cfd6d9') + `<rect x="240" y="160" width="130" height="22" fill="#5c86c6" opacity=".9"/>`;
      g += `<rect x="410" y="170" width="200" height="24" fill="#8a7a62"/><rect x="420" y="194" width="6" height="40" fill="#444"/><rect x="594" y="194" width="6" height="40" fill="#444"/>`;
      g += `<svg x="440" y="152" width="120" height="20" viewBox="0 0 1000 170" preserveAspectRatio="none"><use href="#${a}"/></svg>`;
      // big centre table with printed fabrics
      g += `<polygon points="150,262 490,262 560,330 90,330" fill="#8f7d63"/><polygon points="150,262 490,262 490,270 150,270" fill="#6e5e48"/>`;
      [['#2f6fd6', 175], ['#e4a12a', 245], ['#c93c3c', 315], ['#2f9a6e', 385]].forEach(([col, x]) => g += `<polygon points="${x},276 ${x + 62},276 ${x + 70},304 ${x - 8},304" fill="${col}"/>`);
      people += fig(120, 322, 108, c(0)) + fig(510, 314, 96, c(1)) + fig(330, 226, 60, c(2)) + fig(590, 232, 50, c(3));
    }
    if (kind === 'design') {
      g += `<rect x="60" y="180" width="520" height="16" fill="#9d8b6e"/><rect x="70" y="196" width="8" height="90" fill="#555"/><rect x="562" y="196" width="8" height="90" fill="#555"/>`;
      g += `<rect x="130" y="96" width="170" height="94" rx="6" fill="#111"/><svg x="136" y="102" width="158" height="82" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${a}"/></svg><rect x="206" y="190" width="18" height="10" fill="#333"/>`;
      g += `<rect x="330" y="104" width="150" height="86" rx="6" fill="#111"/><svg x="336" y="110" width="138" height="74" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${a}"/></svg><rect x="396" y="190" width="18" height="10" fill="#333"/>`;
      g += `<rect x="500" y="150" width="70" height="30" fill="#f4f1e6" transform="rotate(-6 535 165)"/><svg x="506" y="154" width="58" height="22" viewBox="0 0 1000 600" preserveAspectRatio="none" transform="rotate(-6 535 165)"><use href="#${a}"/></svg>`;
      people += fig(250, 300, 190, c(0)) + fig(400, 304, 176, c(1));
    }
    if (kind === 'print') {
      g += machine(40, 110, 560, 100, '#e3e7e9') + machine(60, 126, 520, 26, '#3f4f5c') + `<rect x="60" y="118" width="520" height="8" fill="#d64c3a"/>`;
      for (let i = 0; i < 14; i++) g += `<circle cx="${80 + i * 36}" cy="139" r="3" fill="#8fc7ff" opacity="${.4 + R() * .6}"/>`;
      g += `<rect x="30" y="150" width="34" height="74" rx="6" fill="#fff"/><ellipse cx="47" cy="187" rx="16" ry="37" fill="#eee" stroke="#ccc"/>`;
      g += `<polygon points="70,212 590,212 630,330 40,330" fill="#8f7d63"/>`;
      g += `<polygon points="120,222 560,222 590,320 90,320" fill="#fff"/><svg x="120" y="222" width="440" height="98" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${a}"/></svg>`;
      g += `<rect x="420" y="150" width="8" height="70" fill="#ffd27a" opacity=".85"/>`;
      people += fig(80, 318, 172, c(0)) + fig(560, 300, 150, c(1));
    }
    if (kind === 'cut') {
      g += `<polygon points="60,230 580,230 630,330 20,330" fill="#9a8868"/><polygon points="90,238 550,238 590,320 50,320" fill="#fff" opacity=".92"/><svg x="90" y="238" width="460" height="82" viewBox="0 0 1000 600" preserveAspectRatio="none" opacity=".95"><use href="#${a}"/></svg>`;
      g += `<rect x="40" y="86" width="560" height="14" fill="#5c6a72"/><rect x="40" y="86" width="14" height="150" fill="#5c6a72"/><rect x="586" y="86" width="14" height="150" fill="#5c6a72"/>`;
      g += `<rect x="300" y="100" width="60" height="70" rx="4" fill="#d64c3a"/><rect x="326" y="170" width="8" height="70" fill="#dfe6e9"/><circle cx="330" cy="240" r="6" fill="#fff"/>`;
      people += fig(150, 312, 168, c(0)) + fig(500, 316, 150, c(1));
    }
    if (kind === 'sew') {
      g += `<rect x="40" y="200" width="560" height="14" fill="#8f7d63"/><rect x="60" y="214" width="8" height="90" fill="#444"/><rect x="572" y="214" width="8" height="90" fill="#444"/>`;
      g += `<path d="M180,200 v-52 q0,-24 26,-24 h100 v14 h-96 q-8,0 -8,8 v54z" fill="#e6ebee"/><rect x="290" y="128" width="16" height="50" fill="#c9d0d4"/><rect x="296" y="176" width="3" height="24" fill="#fff"/>`;
      g += `<rect x="200" y="186" width="160" height="14" fill="#dde3e6"/><rect x="216" y="176" width="40" height="10" fill="#2f6fd6"/>`;
      [['#d64c3a', 350], ['#2f6fd6', 372], ['#e4a12a', 394]].forEach(([col, x]) => g += `<rect x="${x}" y="100" width="12" height="26" rx="2" fill="${col}"/><rect x="${x + 5}" y="88" width="2" height="14" fill="#ddd"/>`);
      g += `<polygon points="120,214 470,214 500,262 90,262" fill="#fff" opacity=".9"/><svg x="120" y="214" width="340" height="46" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${a}"/></svg>`;
      people += fig(250, 320, 186, c(0)) + fig(520, 300, 130, c(1));
    }
    if (kind === 'led') {
      g += `<rect x="40" y="190" width="560" height="18" fill="#3b4d63"/><rect x="60" y="208" width="8" height="86" fill="#444"/><rect x="572" y="208" width="8" height="86" fill="#444"/>`;
      g += `<rect x="150" y="90" width="340" height="96" rx="4" fill="#dfe6ee"/><svg x="156" y="96" width="328" height="84" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${a}"/></svg><rect x="150" y="90" width="340" height="96" fill="#fff" opacity=".25" filter="url(#${id}blur4)"/>`;
      for (let i = 0; i < 12; i++) g += `<rect x="${170 + i * 26}" y="196" width="14" height="6" fill="#fff8d0"/><circle cx="${177 + i * 26}" cy="199" r="10" fill="#ffe89a" opacity=".22"/>`;
      g += `<rect x="70" y="150" width="60" height="40" rx="3" fill="#20272d"/><path d="M76,160 h48 M76,170 h34" stroke="#68f0a0" stroke-width="2"/>`;
      people += fig(530, 314, 160, c(0)) + fig(110, 320, 120, c(1));
    }
    if (kind === 'frame') {
      for (let i = 0; i < 5; i++) g += `<rect x="${500 + i * 20}" y="60" width="10" height="190" fill="url(#${id}metal)"/>`;
      g += `<rect x="150" y="150" width="280" height="8" fill="url(#${id}metalv)"/><rect x="150" y="150" width="8" height="140" fill="url(#${id}metal)"/><rect x="422" y="150" width="8" height="140" fill="url(#${id}metal)"/><rect x="150" y="282" width="280" height="8" fill="url(#${id}metalv)"/>`;
      g += `<rect x="60" y="292" width="520" height="14" fill="#7a6a52"/><rect x="70" y="306" width="8" height="30" fill="#444"/><rect x="562" y="306" width="8" height="30" fill="#444"/>`;
      g += `<rect x="90" y="220" width="40" height="70" fill="#d64c3a"/><circle cx="110" cy="210" r="14" fill="#c9d0d4"/>`;
      people += fig(200, 326, 164, c(0)) + fig(400, 326, 178, c(1));
    }
    if (kind === 'assembly') {
      g += `<rect x="90" y="120" width="380" height="8" fill="url(#${id}metalv)"/><rect x="90" y="120" width="8" height="150" fill="url(#${id}metal)"/><rect x="462" y="120" width="8" height="150" fill="url(#${id}metal)"/><rect x="90" y="262" width="380" height="8" fill="url(#${id}metalv)"/>`;
      g += `<svg x="98" y="128" width="364" height="134" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${a}"/></svg><rect x="98" y="128" width="364" height="134" fill="#fff" opacity=".14"/>`;
      g += `<polygon points="70,280 520,280 570,332 30,332" fill="#8f7d63"/>`;
      people += fig(520, 322, 176, c(0)) + fig(60, 326, 150, c(1)) + fig(300, 106, 40, c(2));
    }
    if (kind === 'pack') {
      g += `<rect x="30" y="90" width="150" height="150" fill="#5e6a74"/><rect x="40" y="100" width="130" height="140" fill="#d9e4ea" opacity=".9"/><path d="M40,120 h130 M40,140 h130 M40,160 h130" stroke="#8b97a0"/>`;
      [[230, 230], [300, 230], [265, 176], [400, 246]].forEach(([x, y]) => g += `<rect x="${x}" y="${y}" width="64" height="${y === 246 ? 64 : 54}" fill="#c9a26a"/><rect x="${x}" y="${y + 20}" width="64" height="5" fill="#a67f45"/><rect x="${x + 22}" y="${y}" width="20" height="8" fill="#f0e2c0"/>`);
      g += `<rect x="470" y="264" width="140" height="10" fill="#e0c235"/><rect x="480" y="274" width="10" height="42" fill="#555"/><rect x="590" y="274" width="10" height="42" fill="#555"/><rect x="474" y="200" width="130" height="64" fill="#c9a26a"/><rect x="480" y="206" width="118" height="52" fill="#f2f2ee"/><svg x="484" y="210" width="110" height="44" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${a}"/></svg>`;
      people += fig(160, 326, 170, c(0)) + fig(380, 326, 128, c(1));
    }
    if (kind === 'reveal') {
      g += `<polygon points="60,110 580,110 610,300 30,300" fill="#101514"/><svg x="70" y="114" width="500" height="182" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${a}"/></svg>`;
      g += `<rect x="60" y="110" width="520" height="190" fill="none" stroke="#dfe6ea" stroke-width="7"/><rect x="40" y="90" width="560" height="250" fill="#cfe2ff" opacity=".28" filter="url(#${id}blur)"/>`;
      people += fig(120, 330, 150, c(0)) + fig(180, 334, 128, c(1)) + fig(520, 332, 160, c(2)) + fig(450, 336, 176, c(3)) + fig(570, 336, 118, c(4));
    }
    return { g, people };
  }

  const CASTSETS = [['priya', 'diego', 'mei', 'amara', 'olu'], ['marcus', 'rosa', 'harpreet', 'lena', 'kenji'], ['mei', 'kenji', 'amara', 'olu', 'diego'], ['harpreet', 'lena', 'marcus', 'rosa', 'priya'], ['bob', 'amara', 'olu', 'kenji', 'rosa']];

  /* size: wide | medium | tight | macro */
  function factory(kind, size, mv, opts) {
    opts = opts || {};
    const id = 'f' + (++UID), R = rng(kind.length * 131 + size.length * 17 + (opts.seed || 0));
    const cast = CASTSETS[(opts.cast != null ? opts.cast : (kind.length + size.length)) % CASTSETS.length];
    const label = opts.label || `${LABEL[kind] || kind.toUpperCase()} · ${size.toUpperCase()}`;
    const defs = commonDefs(id, { kind: 'aisle' }) + artDefs(id + 'a', opts.art || 'A');
    if (size === 'macro') return wrap(id, defs, macro(id, kind, R), label, mv);
    let s = backdrop(id, R, kind === 'floor' || kind === 'pack');
    const st = station(id, kind, R, cast);
    let inner = st.g + st.people;
    if (kind === 'reveal') s = `<rect width="${W}" height="${H}" fill="#0d1210"/><rect y="230" width="${W}" height="130" fill="url(#${id}floor)" opacity=".5"/>`;
    const z = size === 'wide' ? 1 : size === 'medium' ? 1.6 : 2.5;
    const f = [FOCUS[kind][size === 'tight' ? 1 : 0][0], size === 'tight' ? 190 : 205];
    let body = s + (size === 'wide' ? inner : `<g transform="translate(320,190) scale(${z}) translate(${-f[0]},${-f[1]})">${inner}</g>`);
    if (size !== 'wide') body += `<rect width="${W}" height="${H}" fill="url(#${id}dof)" opacity="${size === 'tight' ? .9 : .5}"/>`;
    return wrap(id, defs, body, label, mv);
  }

  function macro(id, kind, R) {
    const bk = (hue) => { let s = `<rect width="${W}" height="${H}" fill="#12181a"/>`; for (let i = 0; i < 18; i++) s += `<circle cx="${R() * W}" cy="${R() * H}" r="${14 + R() * 32}" fill="hsl(${hue + R() * 40},60%,${40 + R() * 30}%)" opacity="${.08 + R() * .2}" filter="url(#${id}blur4)"/>`; return s; };
    let g = '';
    const a = id + 'a';
    if (kind === 'print' || kind === 'design' || kind === 'floor') {
      g = bk(210) + `<svg width="${W}" height="${H}" viewBox="560 180 160 90" preserveAspectRatio="xMidYMid slice"><use href="#${a}"/></svg><rect width="${W}" height="${H}" fill="url(#${id}weave)"/>`;
      for (let i = 0; i < 40; i++) g += `<circle cx="${R() * W}" cy="${R() * H}" r="${1 + R() * 2.4}" fill="${['#20c4ff', '#ff3ea5', '#ffe14a', '#111'][i % 4]}" opacity=".5"/>`;
      g += `<rect x="0" y="110" width="${W}" height="12" fill="#fff" opacity=".12"/>`;
    } else if (kind === 'cut') {
      g = bk(30) + `<rect width="${W}" height="${H}" fill="#e9eef7"/><svg width="${W}" height="${H}" viewBox="480 200 220 124" preserveAspectRatio="xMidYMid slice"><use href="#${a}"/></svg><rect width="${W}" height="${H}" fill="url(#${id}weave)"/>`;
      g += `<polygon points="340,0 430,0 470,360 300,360" fill="#1a1e21"/><path d="M340,0 L300,360" stroke="#dfe6e9" stroke-width="5"/><path d="M300,360 L340,0" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`;
      for (let i = 0; i < 12; i++) g += `<path d="M${330 - i * 3},${30 + i * 28} l-${14 + R() * 20},${R() * 6}" stroke="#fff" stroke-opacity=".5"/>`;
    } else if (kind === 'sew') {
      g = bk(30) + `<rect width="${W}" height="${H}" fill="#0f1b3d"/><svg width="${W}" height="${H}" viewBox="480 200 220 124" preserveAspectRatio="xMidYMid slice"><use href="#${a}"/></svg><rect width="${W}" height="${H}" fill="url(#${id}weave)"/>`;
      g += `<rect x="0" y="230" width="${W}" height="22" fill="#f4f5f0"/><rect x="0" y="230" width="${W}" height="5" fill="#000" opacity=".2"/><path d="M0,244 H${W}" stroke="#2f6fd6" stroke-width="2.4" stroke-dasharray="10 6"/>`;
      g += `<rect x="318" y="20" width="9" height="200" rx="3" fill="url(#${id}metal)"/><polygon points="318,220 327,220 322,246" fill="#e8ecee"/><path d="M340,10 C360,80 330,140 324,224" stroke="#d64c3a" stroke-width="2.4" fill="none"/>`;
    } else if (kind === 'led') {
      g = bk(45) + `<rect x="0" y="180" width="${W}" height="180" fill="#1b232a"/>`;
      for (let i = 0; i < 6; i++) g += `<rect x="${40 + i * 100}" y="172" width="40" height="26" rx="4" fill="#fff8d6"/><circle cx="${60 + i * 100}" cy="185" r="60" fill="#ffe28a" opacity=".2" filter="url(#${id}blur4)"/><circle cx="${60 + i * 100}" cy="185" r="8" fill="#fff"/>`;
      g += `<rect x="0" y="200" width="${W}" height="8" fill="#c27a2a"/><rect x="520" y="206" width="90" height="70" rx="6" fill="#e9ecee"/><rect x="530" y="216" width="14" height="30" fill="#c9a437"/><rect x="552" y="216" width="14" height="30" fill="#c9a437"/>`;
    } else if (kind === 'frame') {
      g = bk(200) + `<rect x="0" y="0" width="${W}" height="150" fill="url(#${id}metalv)"/><rect x="0" y="150" width="200" height="210" fill="url(#${id}metal)"/><path d="M0,150 H200 M200,150 V360" stroke="#000" stroke-opacity=".3" stroke-width="3"/>`;
      g += `<rect x="200" y="150" width="440" height="210" fill="#0d1113"/>`;
      [[100, 250], [140, 300], [100, 320]].forEach(([x, y]) => g += `<circle cx="${x}" cy="${y}" r="13" fill="#2a3033"/><circle cx="${x - 2}" cy="${y - 2}" r="9" fill="#aab4b9"/><path d="M${x - 7},${y} H${x + 5}" stroke="#333" stroke-width="2"/>`);
      g += `<path d="M240,230 h300 M240,260 h240" stroke="#fff" stroke-opacity=".12" stroke-width="6"/><circle cx="470" cy="80" r="16" fill="#d0d6da"/><circle cx="470" cy="80" r="7" fill="#31383c"/>`;
    } else if (kind === 'assembly') {
      g = bk(210) + `<svg width="${W}" height="${H}" viewBox="600 240 160 90" preserveAspectRatio="xMidYMid slice"><use href="#${a}"/></svg><rect width="${W}" height="${H}" fill="url(#${id}weave)"/>`;
      g += `<rect x="0" y="240" width="${W}" height="120" fill="url(#${id}metalv)"/><rect x="0" y="228" width="${W}" height="16" rx="8" fill="#f5f6f2"/><rect x="0" y="228" width="${W}" height="5" fill="#000" opacity=".15"/>`;
      g += `<path d="M230,80 Q250,190 300,222 L330,222 L340,205 Q300,160 290,80Z" fill="#c78a62"/><rect x="286" y="210" width="60" height="20" rx="9" fill="#c78a62"/>`;
    } else if (kind === 'pack') {
      g = bk(35) + `<rect x="60" y="80" width="520" height="230" rx="6" fill="#c9a26a"/><rect x="60" y="80" width="520" height="14" fill="#fff" opacity=".2"/><rect x="290" y="80" width="60" height="230" fill="#e9dcc0"/><rect x="90" y="140" width="140" height="70" fill="#f4f1e6"/><path d="M100,158 h100 M100,174 h70 M100,190 h90" stroke="#333" stroke-width="3"/>`;
      g += `<rect x="410" y="150" width="80" height="80" fill="#fff"/>` + [0, 1, 2, 3, 4, 5].map(i => `<rect x="${418 + i * 12}" y="158" width="6" height="64" fill="#111"/>`).join('');
    } else if (kind === 'reveal') {
      g = `<rect width="${W}" height="${H}" fill="#0a0e0d"/><svg width="${W}" height="${H}" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"><use href="#${a}"/></svg><rect width="${W}" height="${H}" fill="url(#${id}weave)"/><rect width="${W}" height="${H}" fill="#fff" opacity=".08"/>`;
    }
    g += `<rect width="${W}" height="${H}" fill="url(#${id}dof)"/>`;
    return g;
  }

  /* ---------- interviews: wide, medium, follow, hands ---------- */
  const PEOPLE = [
    { id: 'bob', who: 'bob', name: 'Bob', role: 'Owner · company philosophy' },
    { id: 'l1', who: 'priya', name: 'Priya', role: 'Department lead 1' },
    { id: 'l2', who: 'marcus', name: 'Marcus', role: 'Department lead 2' },
    { id: 'l3', who: 'mei', name: 'Mei', role: 'Department lead 3' }
  ];
  function interview(personId, size, mv, opts) {
    opts = opts || {};
    const pe = PEOPLE.find(p => p.id === personId), p = CAST[pe.who], id = 'f' + (++UID), R = rng(personId.length * 71 + size.length * 5);
    const label = `${pe.name.toUpperCase()} · ${size.toUpperCase()}`;
    const defs = commonDefs(id, { kind: 'aisle' }) + artDefs(id + 'a', 'A') + `<radialGradient id="${id}key" cx=".28" cy=".4" r=".8"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".5"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>`;
    let body = '';
    const bokeh = (hues, n) => { let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${R() * W}" cy="${R() * H * .8}" r="${10 + R() * 30}" fill="hsl(${hues[Math.floor(R() * hues.length)]},70%,${45 + R() * 25}%)" opacity="${.12 + R() * .3}" filter="url(#${id}blur4)"/>`; return s; };
    if (size === 'wide') {
      // two-camera wide: whole interview corner with lights, stand, camera and interviewer for context
      body += `<rect width="${W}" height="${H}" fill="#cfd5d3"/><rect y="228" width="${W}" height="132" fill="url(#${id}floor)"/>`;
      body += `<rect x="330" y="40" width="270" height="170" fill="#1d2a3a"/><svg x="336" y="46" width="258" height="158" viewBox="0 0 1000 600" preserveAspectRatio="none"><use href="#${id}a"/></svg><rect x="330" y="40" width="270" height="170" fill="none" stroke="#c4cbcf" stroke-width="5"/><rect x="330" y="40" width="270" height="170" fill="#cfe2ff" opacity=".2" filter="url(#${id}blur4)"/>`;
      body += `<rect x="20" y="70" width="10" height="200" fill="#333"/><rect x="0" y="60" width="52" height="34" rx="3" fill="#f3f0e8"/><circle cx="26" cy="77" r="60" fill="#ffd9a0" opacity=".25" filter="url(#${id}blur4)"/>`;
      body += `<rect x="560" y="80" width="8" height="190" fill="#333"/><rect x="540" y="70" width="46" height="30" rx="3" fill="#f3f0e8"/>`;
      body += fig(220, 320, 200, p) + fig(90, 338, 168, CAST.olu) + `<rect x="24" y="250" width="16" height="72" fill="#222"/><rect x="10" y="240" width="44" height="26" rx="3" fill="#222"/><circle cx="32" cy="253" r="7" fill="#7aa0c8"/>`;
      body += `<rect x="520" y="248" width="16" height="72" fill="#222"/><rect x="506" y="238" width="44" height="26" rx="3" fill="#222"/><circle cx="528" cy="251" r="7" fill="#7aa0c8"/>`;
      body += `<path d="M46,258 L182,270 M514,258 L290,270" stroke="#d4ff5a" stroke-opacity=".45" stroke-dasharray="4 5"/>`;
    } else if (size === 'medium') {
      body += `<rect width="${W}" height="${H}" fill="#1f2a2a"/>` + bokeh([32, 40, 200, 150], 16);
      body += `<rect x="440" y="20" width="180" height="250" fill="#233a55" opacity=".5" filter="url(#${id}blur4)"/>`;
      body += bust(230, 126, 3.1, p) + `<rect width="${W}" height="${H}" fill="url(#${id}key)"/>`;
      body += `<rect width="${W}" height="${H}" fill="url(#${id}dof)" opacity=".4"/>`;
    } else if (size === 'follow') {
      body += backdrop(id, R, false);
      body += `<polygon points="0,300 640,290 640,360 0,360" fill="#000" opacity=".08"/>`;
      body += fig(470, 330, 66, CAST.diego) + fig(80, 312, 40, CAST.rosa);
      body += fig(310, 348, 250, p) + fig(160, 344, 200, CAST[['harpreet', 'kenji', 'lena', 'amara'][personId.length % 4]]);
      body += `<path d="M310,80 l-60,-12" stroke="${OR}" stroke-width="1"/>`;
    } else {
      body += `<rect width="${W}" height="${H}" fill="#14110e"/>` + bokeh([30, 45, 210], 20);
      const hand = (x, y, rot, fl) => { let h = `<g transform="translate(${x},${y}) rotate(${rot}) scale(${fl},1)"><path d="M-52,130 Q-64,20 -32,-10 L32,-10 Q64,20 52,130Z" fill="${p.skin}"/>`; [[-32, -46], [-11, -58], [10, -56], [30, -42]].forEach(([fx, fy], i) => h += `<rect x="${fx - 9}" y="${fy}" width="18" height="${62 - i % 2 * 6}" rx="9" fill="${p.skin}"/>`); return h + `<path d="M-32,20 Q0,34 32,20" stroke="#000" stroke-opacity=".15" fill="none" stroke-width="3"/><rect x="-54" y="100" width="108" height="40" fill="${p.top}"/></g>`; };
      body += `<path d="M0,250 Q320,190 640,250 L640,360 L0,360Z" fill="#e9ecee"/><rect width="640" height="360" fill="url(#${id}weave)" opacity=".5"/><path d="M0,250 Q320,190 640,250" stroke="#fff" stroke-width="5" fill="none" opacity=".5"/>`;
      body += hand(230, 200, 12, 1) + hand(410, 200, -12, -1) + `<rect x="300" y="120" width="5" height="150" rx="2" fill="#dfe5e8" transform="rotate(20 302 190)"/><circle cx="320" cy="238" r="46" fill="#ffd27a" opacity=".22" filter="url(#${id}blur4)"/><circle cx="320" cy="238" r="6" fill="#fff4c9"/>`;
      body += `<rect width="${W}" height="${H}" fill="url(#${id}dof)"/>`;
    }
    return wrap(id, defs, body, label, mv);
  }

  /* ---------- finished product in the wild (uses venue scenes) ---------- */
  window.MCF = { factory, interview, PEOPLE, MOVE, LABEL, moveOverlay };
})();
