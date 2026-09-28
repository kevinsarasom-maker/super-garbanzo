(function () {
  const D = MCD, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SZ = D.SZ;

  /* ---------- lazy frame registry ---------- */
  let K = 0; const REG = {};
  const fr = (fn, cls, extra) => { const k = 'r' + (K++); REG[k] = fn; return `<div class="fr ${cls || 'h'}" data-k="${k}" ${extra || ''}></div>`; };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const el = e.target; io.unobserve(el); if (!el.dataset.done) { el.innerHTML = REG[el.dataset.k](); el.dataset.done = 1; } } }), { rootMargin: '300px' });
  const hydrate = root => $$('.fr[data-k]:not([data-done])', root).forEach(el => io.observe(el));

  /* ---------- data ---------- */
  const DATA = {};
  const get = id => DATA[id] || (DATA[id] = ({ photo: D.photoShots, loop: D.loopShots, case: D.caseShots })[id]());
  const siteOf = id => D.SITES.find(s => s.id === id);
  const CTX = {};
  const chips = s => `${s.size ? `<span class="sz ${s.size}">${SZ[s.size]}</span>` : ''}${s.move ? `<span class="mv">${esc(MCF.MOVE[s.move].tag)}</span>` : ''}`;

  /* ---------- landing ---------- */
  function landing() {
    const ph = get('photo'), lp = get('loop'), cs = get('case');
    const total = ph.length + lp.length + cs.length;
    $('#stats').innerHTML = [[total, 'storyboarded shots'], [8, 'installation sites'], [3, 'core deliverables'], [D.SOCIAL.length, 'social & ad cuts'], ['$14,800', 'CAD + HST']].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
    // reel
    const mk = (n, o) => {
      const r = MC.h.rng(n * 7 + 3), ids = ['bmw', 'volvo', 'lambo', 'mazda', 'walmart', 'bestbuy', 'freedom', 'hisense'], ks = ['context', 'hero', 'left', 'right', 'inuse', 'tight'], st = ['floor', 'print', 'cut', 'sew', 'led', 'frame', 'assembly', 'pack', 'reveal', 'design'];
      const t = Math.floor(r() * 3);
      if (t === 0) return () => MC.scene(ids[Math.floor(r() * 8)], ks[Math.floor(r() * 6)]);
      if (t === 1) return () => MCF.factory(st[(n + o) % 10], ['wide', 'medium', 'tight', 'macro'][(n + o) % 4], 'static', { cast: n });
      return () => MCF.interview(['bob', 'l1', 'l2', 'l3'][n % 4], ['wide', 'medium', 'follow'][n % 3], 'static');
    };
    $('#reel').innerHTML = [0, 1, 2].map(row => { const one = Array.from({ length: 8 }, (_, i) => fr(mk(row * 8 + i, row), 'h')).join(''); return `<div class="row">${one}${one.replace(/data-k="(r\d+)"/g, (m, k) => { const nk = 'r' + (K++); REG[nk] = REG[k]; return `data-k="${nk}"`; })}</div>`; }).join('');
    $$('#reel .fr').forEach(f => f.classList.add('f'));
    hydrate($('#reel'));

    // tiles
    const tile = (id, cls, num, title, desc, meta, frames, open) => `<button class="tile ${cls} rev" data-open="${id}"><span class="open">${open || 'Open shot list →'}</span><div class="pv">${frames.map((f, i) => `<div class="cy ${i ? '' : 'on'}" data-cyc>${fr(() => D.vert(f()), 'h', 'style="height:100%;aspect-ratio:auto"')}</div>`).join('')}</div><div class="tx"><div class="num">${num}</div><h3>${title}</h3><p>${desc}</p><div class="meta">${meta.map((m, i) => `<span class="chip ${i === 0 ? 'hl' : ''}">${m}</span>`).join('')}</div></div></button>`;
    $('#tiles').innerHTML =
      tile('photo', 'big', '01', 'Installation Photography', 'Eight sites, one look. Wide, medium, tight and macro at every location, plus slider, gimbal, 360° and vertical passes on the same visit.', [`${ph.length} shots`, '8 sites', '~120 photos', '56 clips'], ['bmw', 'lambo', 'walmart', 'bestbuy'].map((v, i) => () => MC.scene(v, ['hero', 'tight', 'hero', 'inuse'][i]))) +
      tile('loop', 'big', '02', 'The Homepage Loop', 'A silent, slow-motion, cinematic loop of the factory. Machines running, prints coming off the printer, cutting, sewing, building and lightboxes switching on.', [`${lp.length} shots`, '15–30 s', 'Silent · loops', 'Landscape + vertical'], [() => MCF.factory('print', 'wide', 'slider'), () => MCF.factory('cut', 'macro', 'static'), () => MCF.factory('frame', 'wide', 'jib'), () => MCF.factory('led', 'wide', 'reveal')]) +
      tile('case', 'big', '03', 'How We Make It', 'The interview-led case study. Bob and the team explain how a file becomes a finished piece, intercut with factory floor and finished installs in stores.', [`${cs.length} shots`, '1.5–2 min', 'Interview-led', '12 scenes'], [() => MCF.interview('bob', 'medium', 'static'), () => MCF.factory('print', 'medium', 'orbit'), () => MC.scene('mazda', 'hero', { motion: () => MCF.moveOverlay('orbit'), label: 'MAZDA · IN STORE', cam: 'hero', path: 'orbit' }), () => MCF.factory('reveal', 'wide', 'pull')]) +
      tile('social', 'big', '04', 'Social &amp; Ad Cuts', 'Bumpers, 15-second clips and 30-second ad masters cut in every format from the same shoot.', [`${D.SOCIAL.length} cuts`, '9:16', '1:1', '4:5', '16:9'], [() => MCF.factory('print', 'wide', 'slider'), () => MCF.factory('reveal', 'wide', 'pull')]);
    // devices in "what you get"
    const loopF = () => MCF.factory('led', 'wide', 'reveal');
    $('#devs').innerHTML = `<div class="dev" style="width:min(360px,58%)">${fr(loopF, 'h')}<span class="tag">16:9 · 4K</span></div><div class="dev ph" style="width:min(104px,20%)">${fr(() => D.vert(loopF()), 'v')}<span class="tag">9:16</span></div><div class="dev sq" style="width:min(120px,24%)">${fr(() => D.vert(MCF.factory('print', 'wide', 'slider')), 'sq')}<span class="tag">1:1</span></div>`;
    $('#mosaic').innerHTML = D.SITES.map((s, i) => `<div>${fr(() => MC.scene(s.id, ['hero', 'left', 'right', 'tight', 'macroF', 'macroC', 'inuse', 'context'][i]), 'h')}</div>`).join('');
    const rt = (w, ar, cls, lbl, fn) => `<div class="rt" style="width:${w}px;aspect-ratio:${ar}"><span class="lbl">${lbl}</span>${fr(fn, cls, 'style="position:absolute;inset:0;aspect-ratio:auto"')}</div>`;
    const bf = () => MCF.factory('reveal', 'wide', 'static');
    $('#ratios').innerHTML = rt(250, '16/9', 'h', '16:9', bf) + rt(120, '9/16', 'v', '9:16', () => D.vert(bf())) + rt(150, '1/1', 'sq', '1:1', () => D.vert(bf())) + rt(130, '4/5', 'p45', '4:5', () => D.vert(bf()));
    $('#manifest').innerHTML = [['~120', 'colour-corrected photographs'], [56, 'site motion clips, horizontal + vertical'], [2, 'finished films + poster stills'], [D.SOCIAL.length, 'social & ad cuts in 4 formats']].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
    $('#siteGrid').innerHTML = D.SITES.map(s => { const day = D.DAYS.find(d => d.sites.includes(s.id)).n; return `<button class="site rev" data-open="photo" data-tab="sites" data-site="${s.id}"><div class="th">${fr(() => MC.scene(s.id, 'hero'), 'h', 'style="height:100%;aspect-ratio:auto"')}</div><div class="t"><span class="day">PHOTO DAY ${day}</span><b>${s.name}</b><span>${s.focus}</span></div></button>`; }).join('');
    $('#days').innerHTML = D.DAYS.map(d => `<div class="sheet"><span class="mono lime">Photo day ${d.n}</span><h3>${d.sites.map(x => siteOf(x).name).join(' · ')}</h3><p class="mut" style="margin:0;font-size:14.5px">${d.focus}</p></div>`).join('') + `<p class="mut" style="grid-column:1/-1;margin:0;font-size:13.5px">Proposed locations, subject to permission and access. Final days are grouped by actual addresses and opening hours; this pairing is a planning starting point. Early-morning or after-hours starts are planned where a site is busy.</p>`;
    $('#voiceGrid').innerHTML = D.PEOPLE_INFO.map(p => `<button class="voice rev" data-open="case" data-tab="interviews"><div class="th">${fr(() => MCF.interview(p.id, 'medium', 'static'), 'h', 'style="position:absolute;inset:0;aspect-ratio:auto;width:220%;left:-29%"')}</div><div class="t"><b>${p.id === 'bob' ? 'Bob' : p.name}</b><span>${p.role}</span></div></button>`).join('');
    hydrate(document);
    // tile crossfade
    $$('.tile').forEach(t => { const f = $$('[data-cyc]', t); if (f.length < 2) return; let i = 0; setInterval(() => { f[i].classList.remove('on'); i = (i + 1) % f.length; f[i].classList.add('on'); }, 2600 + Math.random() * 800); });
    // reveal
    const ro = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } }), { threshold: .08 });
    $$('.rev').forEach(el => ro.observe(el));
  }

  /* ---------- project overlay ---------- */
  const PROJ = {
    photo: { title: 'Installation Photography', tabs: [['overview', 'Overview'], ['sites', 'Site by site'], ['compare', 'Compare all 8'], ['list', 'Full shot list'], ['specs', 'Specs & delivery']] },
    loop: { title: 'The Homepage Loop', tabs: [['overview', 'Overview'], ['storyboard', 'Storyboard'], ['list', 'Full shot list'], ['specs', 'Specs & delivery']] },
    case: { title: 'How We Make It', tabs: [['overview', 'Overview'], ['storyboard', 'Storyboard'], ['interviews', 'Interviews'], ['stores', 'Finished products in stores'], ['list', 'Full shot list'], ['specs', 'Specs & delivery']] },
    social: { title: 'Social & Ad Cuts', tabs: [['overview', 'All cuts'], ['formats', 'Formats & safe zones'], ['specs', 'Specs & delivery']] }
  };
  let cur = null, curTab = null, curSite = 'bmw', filt = { size: 'all', move: 'all', group: 'all', q: '' };
  const proj = $('#proj');

  function openProject(id, tab, site, noHash) {
    cur = id; curTab = tab || 'overview'; if (site) curSite = site; filt = { size: 'all', move: 'all', group: 'all', q: '' };
    const P = PROJ[id];
    proj.innerHTML = `<div class="ph-head"><div class="ph-top"><div><div class="mono lime">Project ${['photo', 'loop', 'case', 'social'].indexOf(id) + 1} of 4</div><h2>${P.title}</h2></div><div style="display:flex;gap:10px;align-items:center">${id !== 'social' ? `<button class="pill" id="csv">Copy shot list</button>` : ''}<button class="x" id="closeP" aria-label="Close">×</button></div></div><div class="tabs" id="tabs">${P.tabs.map(([k, l]) => `<button class="tab ${k === curTab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div></div><div class="pbody" id="pb"></div>`;
    proj.classList.add('on'); document.body.style.overflow = 'hidden'; proj.scrollTop = 0;
    renderTab();
    if (!noHash) try { history.replaceState(null, '', `#${id}-${curTab}`); } catch (e) {}
  }
  function closeProject() { proj.classList.remove('on'); document.body.style.overflow = ''; cur = null; try { history.replaceState(null, '', location.pathname); } catch (e) {} }
  function setTab(t) { curTab = t; $$('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); proj.scrollTop = 0; renderTab(); try { history.replaceState(null, '', `#${cur}-${t}`); } catch (e) {} }

  function renderTab() {
    const pb = $('#pb'); const v = VIEWS[cur][curTab]; pb.innerHTML = v(); hydrate(pb); afterRender(pb);
  }

  /* ---------- shared view helpers ---------- */
  function card(s, ctx, i, opts) {
    opts = opts || {};
    return `<button class="card" data-lb="${ctx}" data-i="${i}">${fr(s.render, s.vertical ? 'v' : 'h')}<div class="cap"><b>${esc(s.title)}</b><span class="mono" style="font-size:10.5px;color:var(--lime)">${s.id}${s.dur && s.dur !== 'still' ? ' · ' + esc(s.dur) : ''}</span><div class="row">${chips(s)}</div></div></button>`;
  }
  function rowItem(s, ctx, i) {
    return `<div class="rowitem" id="${s.id}"><div data-lb="${ctx}" data-i="${i}">${fr(s.render, s.vertical ? 'v' : 'h')}</div><div><div class="id">${s.id}${s.time ? ' · ' + s.time : ''}</div><h5>${esc(s.title)}</h5><div class="meta">${chips(s)}<span class="spc">${esc(s.lens || '')} · ${esc(s.fps || '')} · ${esc(s.dur || '')}</span></div><p>${esc(s.note)}</p>${s.sound ? `<div class="snd">♪ ${esc(s.sound)}</div>` : ''}</div></div>`;
  }
  function shotList(shots, ctx, o) {
    o = o || {};
    CTX[ctx] = shots;
    const groups = [...new Set(shots.map(s => s.group))], moves = [...new Set(shots.map(s => s.move))];
    const html = `<h3 class="sec">Every shot, in order.</h3><p class="sub">${shots.length} shots. Filter by shot size, camera move or section, or search for anything.</p>
    <div class="filters"><div class="grp">${['all', 'wide', 'medium', 'tight', 'macro'].map(x => `<button class="fb ${filt.size === x ? 'on' : ''}" data-f="size" data-v="${x}">${x === 'all' ? 'All sizes' : SZ[x]}</button>`).join('')}</div>
    <select data-f="move" aria-label="Camera move"><option value="all">All camera moves</option>${moves.map(m => `<option value="${m}" ${filt.move === m ? 'selected' : ''}>${MCF.MOVE[m].tag}</option>`).join('')}</select>
    <select data-f="group" aria-label="Section"><option value="all">All sections</option>${groups.map(g => `<option ${filt.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
    <input data-f="q" placeholder="Search shots…" value="${esc(filt.q)}"><span class="cnt" id="cnt"></span></div><div id="rows"></div>`;
    setTimeout(() => paintRows(ctx), 0);
    return html;
  }
  function paintRows(ctx) {
    const shots = CTX[ctx], q = filt.q.toLowerCase(), box = $('#rows'); if (!box) return;
    const f = shots.map((s, i) => [s, i]).filter(([s]) => (filt.size === 'all' || s.size === filt.size) && (filt.move === 'all' || s.move === filt.move) && (filt.group === 'all' || s.group === filt.group) && (!q || (s.id + ' ' + s.title + ' ' + s.note + ' ' + s.group + ' ' + (s.sound || '')).toLowerCase().includes(q)));
    let last = '', out = '';
    f.forEach(([s, i]) => { if (s.group !== last) { last = s.group; out += `<div class="grouphd">${esc(s.group)}<small>${f.filter(([x]) => x.group === last).length} shots</small></div>`; } out += rowItem(s, ctx, i); });
    box.innerHTML = out || '<p class="mut">No shots match those filters.</p>'; $('#cnt').textContent = `${f.length} of ${shots.length}`; hydrate(box);
  }
  function afterRender(pb) { const p = $('#pbplayer', pb); if (p) startPlayer(p); }

  /* ---------- lightbox ---------- */
  let lbCtx = null, lbI = 0; const lb = $('#lb');
  function openLB(ctx, i) { lbCtx = CTX[ctx]; lbI = i; paintLB(); lb.classList.add('on'); }
  function paintLB() {
    const s = lbCtx[lbI];
    lb.innerHTML = `<div class="lbtop"><span class="mono">${lbI + 1} / ${lbCtx.length}</span><button class="x" id="lbx" aria-label="Close">×</button></div><div class="lbi"><div>${fr(s.render, s.vertical ? 'v' : 'h')}</div><div><div class="mono lime">${esc(s.id)}${s.time ? ' · ' + s.time : ''}</div><h3>${esc(s.title)}</h3><div class="meta" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${chips(s)}</div><dl class="kv">${s.group ? `<dt>Section</dt><dd>${esc(s.group)}</dd>` : ''}${s.lens ? `<dt>Lens</dt><dd>${esc(s.lens)}</dd>` : ''}${s.fps ? `<dt>Capture</dt><dd>${esc(s.fps)}</dd>` : ''}${s.dur ? `<dt>Length</dt><dd>${esc(s.dur)}</dd>` : ''}${s.note ? `<dt>Direction</dt><dd>${esc(s.note)}</dd>` : ''}${s.sound ? `<dt>Sound / story</dt><dd>${esc(s.sound)}</dd>` : ''}</dl><div class="lbn"><button id="lbp">← Prev</button><button id="lbn">Next →</button></div></div></div>`;
    hydrate(lb);
  }
  const lbStep = d => { lbI = (lbI + d + lbCtx.length) % lbCtx.length; paintLB(); };
  const closeLB = () => lb.classList.remove('on');

  /* ---------- player (loop preview) ---------- */
  let ptimer = null;
  function startPlayer(p) {
    clearInterval(ptimer);
    const frames = $$('.lay .fr', p), bar = $('.bar i', p), cap = $('.cap', p); let i = 0, t = 0;
    const per = 2400; const names = D.LOOP.map(b => b.name);
    const show = n => { frames.forEach((f, j) => f.classList.toggle('on', j === n)); cap.textContent = `${String(n + 1).padStart(2, '0')} · ${names[n]}`; };
    show(0); hydrate(p);
    ptimer = setInterval(() => { if (!document.body.contains(p)) return clearInterval(ptimer); if (p.dataset.paused) return; t += 60; bar.style.width = (t / per * 100) + '%'; if (t >= per) { t = 0; i = (i + 1) % frames.length; show(i); } }, 60);
    p.onclick = () => { p.dataset.paused = p.dataset.paused ? '' : '1'; };
  }

  /* ---------- views ---------- */
  const ratioBox = (w, ar, cls, lbl, fn, safe) => `<div class="rt" style="width:${w}px;aspect-ratio:${ar}"><span class="lbl">${lbl}</span>${safe ? '<div class="safe"></div>' : ''}${fr(fn, cls, 'style="position:absolute;inset:0;aspect-ratio:auto"')}</div>`;
  const kv = rows => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

  function beatsView(B, shots, ctx, big) {
    CTX[ctx] = shots;
    const first = i => shots.findIndex(s => s.beat === i);
    return `<div class="ribbon">${B.map((b, i) => `<button class="rb" data-jump="beat-${ctx}-${i}"><div class="fr h" data-k="${(() => { const k = 'r' + (K++); REG[k] = shots[first(i)].render; return k; })()}"></div><small>${b.t.split('–')[0]}</small><b>${esc(b.name)}</b></button>`).join('')}</div>` +
      B.map((b, i) => { const ss = shots.map((s, j) => [s, j]).filter(([s]) => s.beat === i); return `<div class="beat" id="beat-${ctx}-${i}"><div class="bm" data-lb="${ctx}" data-i="${ss[0][1]}">${fr(ss[0][0].render, 'h')}</div><div><div class="bt">${String(i + 1).padStart(2, '0')} · ${b.t}</div><h4>${esc(b.name)}</h4><p class="story">${esc(b.story)}</p><div class="minis" style="grid-template-columns:repeat(${Math.min(ss.length, 4)},1fr)">${ss.map(([s, j]) => `<button class="mini" data-lb="${ctx}" data-i="${j}">${fr(s.render, 'h')}<div class="m"><span class="sz ${s.size}">${SZ[s.size]}</span><span class="mv">${MCF.MOVE[s.move].tag}</span><span style="font-size:12px;color:#c9d5cd;line-height:1.3">${esc(s.title)}</span></div></button>`).join('')}</div></div></div>`; }).join('');
  }

  const VIEWS = {
    photo: {
      overview() {
        const sh = get('photo'), ctx = 'photo-bmw'; const bmw = sh.filter(s => s.site === 'bmw'); CTX[ctx] = bmw;
        return `<div class="two"><div><h3 class="sec">One shot list. Eight sites.</h3><p class="sub">Every site is photographed with the same eight compositions (wide, medium, tight and macro), then repeated as motion: slider, gimbal, 360° orbit and follow, in both horizontal and vertical. The result reads like one body of work, whatever the scale of the space.</p>
        <div class="grid g4">${bmw.slice(0, 8).map((s, i) => card(s, ctx, i)).join('')}</div></div>
        <div class="panel"><h4>At a glance</h4>${kv([['Sites', 'Freedom Mobile, BMW, Volvo, Lamborghini, Mazda, Walmart, Best Buy, Hisense'], ['Per site', '8 stills + 7 motion passes = 15 shots'], ['Total', `${sh.length} planned shots, ~120 selected photos`], ['Days', '4 photography days, grouped by route'], ['Timing', 'Avoid peak hours; early-morning or after-hours starts where needed'], ['Permissions', 'McRae’s marketing team confirms shooting permission with each client, especially the auto brands'], ['Use', 'Website page, sales materials, social and ads']])}</div></div>
        <div class="sect">The seven motion passes at every site</div><div class="grid g4">${bmw.slice(8).map((s, i) => card(s, ctx, i + 8)).join('')}</div>
        <div class="sect">Where each site puts its focus</div><div class="grid g4">${D.SITES.map(s => `<button class="card" data-open="photo" data-tab="sites" data-site="${s.id}">${fr(() => MC.scene(s.id, 'hero'), 'h')}<div class="cap"><b>${s.name}</b><span>${s.focus}</span></div></button>`).join('')}</div>`;
      },
      sites() {
        const sh = get('photo'), s = siteOf(curSite), ss = sh.filter(x => x.site === s.id), ctx = 'photo-' + s.id; CTX[ctx] = ss;
        const day = D.DAYS.find(d => d.sites.includes(s.id)).n;
        return `<div class="pick" id="sitePick">${D.SITES.map(x => `<button class="pk ${x.id === s.id ? 'on' : ''}" data-site="${x.id}"><span class="th">${fr(() => MC.scene(x.id, 'tight'), 'h', 'style="height:100%;aspect-ratio:auto"')}</span>${x.name}</button>`).join('')}</div>
        <div class="sitehead"><div><div class="mono lime">Photo day ${day}</div><h3 class="sec">${s.name}</h3><p>${s.focus}. ${esc(s.note)}</p></div><div class="chips" style="display:flex;gap:8px"><span class="chip hl">${ss.length} shots</span><span class="chip">8 stills</span><span class="chip">7 motion</span></div></div>
        <div class="sect">Stills · wide → medium → tight → macro</div><div class="grid g4">${ss.slice(0, 8).map((x, i) => card(x, ctx, i)).join('')}</div>
        <div class="sect">Motion · horizontal</div><div class="grid g3">${ss.slice(8, 13).map((x, i) => card(x, ctx, i + 8)).join('')}</div>
        <div class="sect">Motion · vertical 9:16 for social &amp; ads</div><div class="grid g6" style="grid-template-columns:repeat(4,1fr)">${ss.slice(13).map((x, i) => card(x, ctx, i + 13)).join('')}</div>`;
      },
      compare() {
        const sh = get('photo'), ctx = 'photo-compare'; CTX[ctx] = sh.filter(s => s.kind === 'still');
        return `<h3 class="sec">The same eight compositions, eight places.</h3><p class="sub">Read across a row and the framing, angle and lens family never change. Only the space does. Tap any frame to enlarge it.</p>
        <div class="matrix"><div class="mx"><div class="h"></div>${D.SITES.map(s => `<div class="h">${s.name}</div>`).join('')}${MC.SHOTS.map((sh0, r) => `<div class="rl">${String(sh0.id).padStart(2, '0')} · ${sh0.name}</div>${D.SITES.map((s, c) => { const i = c * 8 + r; return `<button data-lb="${ctx}" data-i="${i}">${fr(CTX[ctx][i].render, 'h')}</button>`; }).join('')}`).join('')}</div></div>`;
      },
      list() { return shotList(get('photo'), 'photo-all'); },
      specs() {
        return `<div class="two"><div class="panel"><h4>Photography deliverables</h4>${kv([['Selects', '~15 per site, ~120 in total, colour-corrected to a common target'], ['Formats', 'High-resolution and web-ready JPEGs'], ['Crops', '16:9, 4:5 and 1:1 crops of every site hero for sales decks and social'], ['Delivery', 'In batches by route so McRae can start using the work early'], ['Usage', 'Perpetual, worldwide: website, advertising, social and sales. Client permission is confirmed by McRae before each shoot']])}</div>
        <div class="panel"><h4>Captured on the same visit</h4>${kv([['Clips', 'Slider (H + V), gimbal push-in, detail slide, 360° orbit, follow, plus two dedicated 9:16 passes'], ['Codec', '4K, consistent picture profile, locked white balance'], ['Frame rate', '29.97/30 fps at ~1/60; detail slow-motion at 59.94/60 at ~1/120'], ['Flicker', 'Tested at each display before rolling']])}</div></div>
        <div class="panel" style="margin-top:20px"><h4>Photography baseline</h4><p class="mut" style="margin:0">Tripod, RAW, manual exposure, ISO 100 and f/8 as a starting point, 1/60 s for illuminated displays. Grey card at every site with a custom white balance per lighting set-up. Bracket static installations to keep both graphic and room. Record exceptions so the collection stays consistent.</p></div>`;
      }
    },
    loop: {
      overview() {
        const shots = get('loop');
        return `<div class="two"><div><div class="player" id="pbplayer"><div class="lay">${D.LOOP.map((b, i) => fr(shots.find(s => s.beat === i).render, 'h')).join('')}</div><div class="hd">Made together.<br>Seen in a moment.</div><div class="cap"></div><div class="bar"><i></i></div></div><p class="mut" style="margin-top:10px;font-size:13px">Tap to pause · a taste of the 28-second loop rhythm</p></div>
        <div><div class="vphone">${fr(() => D.vert(MCF.factory('led', 'wide', 'reveal', { label: 'LOOP · 9:16' })), 'v')}</div><p class="mut" style="text-align:center;margin-top:10px;font-size:13px">Dedicated vertical version for mobile</p></div></div>
        <div class="two" style="margin-top:34px"><div class="panel"><h4>The idea</h4><p class="mut" style="margin:0">A seamless 15–30 second silent loop that replaces the still image behind the white headline on the homepage. Slow motion, cinematic, high frame rate and slightly under-exposed, so the type always reads. The rhythm comes from movement, colour and collaboration; no captions or audio are needed. The final image reconnects to the opening, with no fade to black.</p></div>
        <div class="panel"><h4>At a glance</h4>${kv([['Length', '15–30 s (proposed 28 s), silent, loops'], ['Use', 'Full-screen homepage background, autoplay'], ['Formats', 'Landscape 4K + dedicated vertical version'], ['Shots', `${shots.length} shots across 8 beats`], ['Style', 'High-frame-rate slow motion, darker exposure, headline space upper-left'], ['Content', 'Machines running, prints off the printer, cutting and sewing, structures built, LED lightboxes switching on']])}</div></div>
        <div class="sect">The eight beats</div>${beatsView(D.LOOP, shots, 'loop', true)}`;
      },
      storyboard() { return `<h3 class="sec">28 seconds, eight beats, ${get('loop').length} shots.</h3><p class="sub">Each beat is shot as a wide, a medium and a macro, so the edit has options and every transition has a match.</p>` + beatsView(D.LOOP, get('loop'), 'loop2'); },
      list() { return shotList(get('loop'), 'loop-all'); },
      specs() {
        return `<div class="two"><div class="panel"><h4>Delivery</h4>${kv([['Masters', '4K landscape master + web-compressed file'], ['Vertical', 'Dedicated 9:16 loop for mobile'], ['Poster', 'High-resolution poster still for the page'], ['Loop', 'Seamless: last frame matches the first in colour, speed and direction'], ['Audio', 'None (silent autoplay)']])}</div>
        <div class="panel"><h4>Capture</h4>${kv([['Frame rate', '120 fps and 240 fps for slow motion (flicker-tested first); 59.94/60 fps where lighting allows'], ['Exposure', 'About a stop under, so the white headline stands out'], ['Composition', 'Top-left third kept clear for the headline; key action inside the vertical safe area'], ['Movement', 'Slider, gimbal, jib and orbit with matched screen direction between shots']])}</div></div>`;
      }
    },
    case: {
      overview() {
        const shots = get('case');
        return `<div class="two"><div>${fr(shots[0].render, 'h')}<div class="ribbon" style="margin-top:14px">${D.CASE.slice(0, 6).map((b, i) => `<div class="rb" style="pointer-events:none"><div class="fr h" data-k="${(() => { const k = 'r' + (K++); REG[k] = shots.find(s => s.beat === i).render; return k; })()}"></div><small>${b.t.split('–')[0]}</small></div>`).join('')}</div></div>
        <div class="panel"><h4>The film</h4><p class="mut" style="margin-top:0">Bob and three department leads explain, in their own words, how a file becomes a finished piece. Their voices carry the film; the factory floor and finished installations in stores carry the picture.</p>${kv([['Length', '1.5–2 minutes, ~2:00 storyboarded'], ['Format', 'Interview / talking head + B-roll, clean audio, subtitles'], ['Interviews', 'Bob + up to three leads, wide + medium, two cameras'], ['B-roll', '12 scenes across every station, plus 8 in-store finished-product shots'], ['Shots', `${shots.length} planned shots`]])}<div class="ptags" style="margin-top:14px"><span class="chip hl">Six decades of experience</span><span class="chip">Photo-real colour</span><span class="chip">Edge-to-edge printing</span><span class="chip">Sharp detail up close</span></div></div></div>
        <div class="sect">Three acts</div><div class="grid g3"><div class="panel"><h4>1 · The result</h4><p class="mut" style="margin:0">Open on a finished installation in a store. Then meet Bob and the people behind it (scenes 1–2).</p></div><div class="panel"><h4>2 · The process</h4><p class="mut" style="margin:0">File to finished piece: design, print, cut, sew, light, build, assemble (scenes 3–9).</p></div><div class="panel"><h4>3 · The payoff</h4><p class="mut" style="margin:0">The reveal, the shipment and the finished piece in a store, then the team (scenes 10–12).</p></div></div>`;
      },
      storyboard() { return `<h3 class="sec">Twelve scenes, ~2:00.</h3><p class="sub">Each scene mixes wide, medium, tight and macro with a specific camera move, and cuts between the factory floor, interviews and finished products in stores.</p>` + beatsView(D.CASE, get('case').filter(s => s.beat != null), 'case-sb'); },
      interviews() {
        const shots = get('case'); const ivs = shots.filter(s => s.person); CTX['case-iv'] = ivs;
        return `<h3 class="sec">Let the team tell the story.</h3><p class="sub">Relaxed conversations, not scripts. Every person is covered in a wide and a medium (two cameras), plus a walk-and-talk and a hands close-up. Plan on 35–45 minutes each, with time for lighting adjustments.</p>` +
          D.PEOPLE_INFO.map(p => { const mine = ivs.map((s, i) => [s, i]).filter(([s]) => s.person === p.id); return `<div class="pcard"><div data-lb="case-iv" data-i="${mine[1][1]}">${fr(mine[1][0].render, 'h')}</div><div><h4>${p.id === 'bob' ? 'Bob' : p.name}</h4><div class="mono lime">${p.role}</div><div class="ptags">${p.tags.map(t => `<span class="chip">${t}</span>`).join('')}</div><ul class="qs">${p.qs.map(q => `<li>“${q}”</li>`).join('')}</ul><div class="ivframes">${mine.map(([s, i]) => `<button class="mini" data-lb="case-iv" data-i="${i}">${fr(s.render, 'h')}<div class="m"><span class="sz ${s.size}">${SZ[s.size]}</span><span class="mv">${MCF.MOVE[s.move].tag}</span></div></button>`).join('')}</div></div></div>`; }).join('') +
          `<div class="panel" style="margin-top:20px"><h4>The interview set-up</h4><p class="mut" style="margin:0">Two complementary camera angles, controlled lighting, a quiet space and dedicated dialogue recording with backup audio. Each lead is also filmed at their station with close details of their work. Any short connecting narration is written and recorded by Kevin after the story is assembled. If McRae prefers two or three voices, the same themes can be combined.</p></div>`;
      },
      stores() {
        const st = get('case').filter(s => s.group === 'Finished products in stores'); CTX['case-store'] = st;
        return `<h3 class="sec">The finished product, out in the wild.</h3><p class="sub">The case study doesn’t stop at the factory door. One coverage shot per site shows the finished piece where customers see it, captured during the photography days and cut into the film and the ads.</p><div class="grid g4">${st.map((s, i) => card(s, 'case-store', i)).join('')}</div>`;
      },
      list() { return shotList(get('case'), 'case-all'); },
      specs() {
        return `<div class="two"><div class="panel"><h4>Delivery</h4>${kv([['Masters', '4K landscape master + web-compressed file'], ['Length', '1.5–2 minutes'], ['Captions', 'Caption / subtitle files (subtitles recommended for web)'], ['Poster', 'Poster still for the play button'], ['Music', 'Licensed music, subject to its licence'], ['Revisions', 'Two consolidated rounds included']])}</div>
        <div class="panel"><h4>Capture</h4>${kv([['Frame rate', '29.97/30 fps standard; 59.94/60 fps for follow and orbit moves; 120 fps for macro'], ['Audio', 'Dedicated dialogue recorder with backup audio, lavalier on each speaker'], ['Interview days', 'Day 1 from 08:00 (interviews and workplace portraits), Day 2 from 07:30 (production journey)'], ['Safety', 'PPE stays on; camera stays clear of moving gantries and blades']])}</div></div>`;
      }
    },
    social: {
      overview() {
        CTX['social'] = D.SOCIAL.map(c => ({ id: c.id, title: c.title, group: c.use, dur: c.len, note: `Built from ${c.from}. Beats: ` + c.beats.join(' → '), lens: c.fmts.join(' · '), render: c.src, size: null, move: null }));
        return `<h3 class="sec">${D.SOCIAL.length} ready-to-post cuts.</h3><p class="sub">Cut from the same shoot, delivered in every ratio: 9:16 for Reels, Shorts and TikTok; 1:1 and 4:5 for feeds; 16:9 for the web, YouTube and LinkedIn. All with captions.</p>
        <div class="grid g4">${D.SOCIAL.map((c, i) => `<button class="card" data-lb="social" data-i="${i}">${fr(c.src, 'h')}<div class="cap"><b>${esc(c.title)}</b><span class="mono" style="font-size:10.5px;color:var(--lime)">${c.id} · ${c.len}</span><span>${esc(c.use)}</span><div class="row">${c.fmts.map(f => `<span class="mv">${f}</span>`).join('')}</div></div></button>`).join('')}</div>`;
      },
      formats() {
        const bf = () => MCF.factory('reveal', 'wide', 'static', { label: 'SAFE ZONES' });
        return `<h3 class="sec">One shoot, every format.</h3><p class="sub">Horizontal and vertical passes are recorded separately, with the action kept inside each format’s safe zone (dashed) so nothing is lost behind platform buttons.</p>
        <div class="ratios">${ratioBox(330, '16/9', 'h', '16:9', bf, true)}${ratioBox(150, '9/16', 'v', '9:16', () => D.vert(bf()), true)}${ratioBox(200, '1/1', 'sq', '1:1', () => D.vert(bf()), true)}${ratioBox(170, '4/5', 'p45', '4:5', () => D.vert(bf()), true)}</div>
        <div class="panel" style="overflow-x:auto"><table class="fmt"><tr><th>Format</th><th>Master size</th><th>Where it goes</th><th>Lengths</th></tr>
        <tr><td><b>16:9</b> horizontal</td><td>3840 × 2160 (4K) + web file</td><td>Website, YouTube, LinkedIn, Meta and Google video ads, sales decks</td><td>6 s · 15 s · 30 s · full films</td></tr>
        <tr><td><b>9:16</b> vertical</td><td>2160 × 3840 + web file</td><td>Reels, Shorts, TikTok, Stories, mobile homepage loop</td><td>6 s · 15 s · 30 s</td></tr>
        <tr><td><b>1:1</b> square</td><td>2160 × 2160 + web file</td><td>Feed posts, carousels, LinkedIn</td><td>6 s · 15 s</td></tr>
        <tr><td><b>4:5</b> portrait</td><td>1728 × 2160 + web file</td><td>Instagram and Facebook feed (video and stills)</td><td>15 s · stills</td></tr></table></div>`;
      },
      specs() {
        return `<div class="two"><div class="panel"><h4>Delivery</h4>${kv([['Cuts', `${D.SOCIAL.length} cuts: bumpers, 15 s clips, 30 s ad masters, stills`], ['Files', 'Web-ready files for every cut, plus 4K masters for the ad masters'], ['Captions', 'Burned-in caption versions and separate caption files'], ['End cards', 'McRae approved logo and website; client tags on site spotlights only where approved'], ['Stills', 'Site hero crops in 4:5 and 1:1, two poster stills, team portraits']])}</div>
        <div class="panel"><h4>What’s built in</h4>${kv([['Sound', 'Licensed music; every cut works with sound off'], ['Hooks', 'First three seconds always show the strongest frame'], ['Reuse', 'Each cut lists the source shots it is built from (see the shot lists)']])}</div></div>`;
      }
    }
  };

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    let t = e.target.closest('[data-open]'); if (t) { openProject(t.dataset.open, t.dataset.tab, t.dataset.site); return; }
    if ((t = e.target.closest('#closeP'))) return closeProject();
    if ((t = e.target.closest('#tabs .tab'))) return setTab(t.dataset.tab);
    if ((t = e.target.closest('#sitePick .pk'))) { curSite = t.dataset.site; renderTab(); return; }
    if ((t = e.target.closest('[data-jump]'))) { const el = document.getElementById(t.dataset.jump); if (el) proj.scrollTo({ top: el.offsetTop - 130, behavior: 'smooth' }); return; }
    if ((t = e.target.closest('[data-lb]'))) return openLB(t.dataset.lb, +t.dataset.i);
    if ((t = e.target.closest('.fb'))) { filt[t.dataset.f] = t.dataset.v; $$('.fb').forEach(b => b.classList.toggle('on', b.dataset.v === filt.size)); return paintRows(currentCtx()); }
    if (e.target.closest('#lbx') || e.target === lb) return closeLB();
    if (e.target.closest('#lbp')) return lbStep(-1);
    if (e.target.closest('#lbn')) return lbStep(1);
    if (e.target.closest('#csv')) return csv();
  });
  document.addEventListener('input', e => { const t = e.target.closest('[data-f]'); if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT') && $('#rows')) { filt[t.dataset.f] = t.value; paintRows(currentCtx()); } });
  const currentCtx = () => ({ photo: 'photo-all', loop: 'loop-all', case: 'case-all' })[cur];
  document.addEventListener('keydown', e => {
    if (lb.classList.contains('on')) { if (e.key === 'Escape') closeLB(); if (e.key === 'ArrowRight') lbStep(1); if (e.key === 'ArrowLeft') lbStep(-1); return; }
    if (e.key === 'Escape' && cur) closeProject();
  });
  function csv() {
    const s = get(cur), rows = [['ID', 'Section', 'Shot', 'Size', 'Camera move', 'Lens', 'Capture', 'Length', 'Direction', 'Sound / story']].concat(s.map(x => [x.id, x.group, x.title, SZ[x.size], MCF.MOVE[x.move].tag, x.lens, x.fps, x.dur, x.note, x.sound || '']));
    const text = rows.map(r => r.map(c => String(c == null ? '' : c).replace(/\t|\n/g, ' ')).join('\t')).join('\n'), btn = $('#csv');
    const done = m => { btn.textContent = m; setTimeout(() => { btn.textContent = 'Copy shot list'; }, 2200); };
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('aria-label', 'Shot list, ready to copy'); ta.style.cssText = 'width:100%;height:220px;margin-bottom:18px;background:var(--card);color:var(--tx);border:1px solid var(--line2);border-radius:12px;padding:12px;font:12px var(--mono)'; const pb = $('#pb'); pb.insertBefore(ta, pb.firstChild); ta.focus(); ta.select(); done('Select and copy'); };
    try { navigator.clipboard.writeText(text).then(() => done('Copied. Paste into a sheet'), fallback); } catch (e) { fallback(); }
  }
  function route() { const m = location.hash.match(/^#(photo|loop|case|social)(?:-(\w+))?$/); if (m && PROJ[m[1]].tabs.some(t => t[0] === (m[2] || 'overview'))) openProject(m[1], m[2] || 'overview', null, true); }

  landing(); route();
  window.addEventListener('hashchange', () => { if (!location.hash) return; route(); });
})();
