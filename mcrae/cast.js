/* Storybook-style cast: big round heads, big eyes, warm shading. Deliberately mixed age, height, build, background. */
(function () {
  const CAST = {
    bob:    { name: 'Bob',      skin: '#e2a382', hair: '#f4f4f2', hairStyle: 'baldtufts', beard: '#f7f7f5', brows: '#f0f0ee', top: '#c8642c', top2: '#8f3f18', bottom: '#3a4a63', h: 172, b: 1.16, age: 'old', cheeks: '#f0806a', nose: 1.35, plaid: true },
    priya:  { name: 'Priya',    skin: '#b57a52', hair: '#1b1411', hairStyle: 'long', top: '#1f9e96', top2: '#137670', bottom: '#242c3a', h: 160, b: 0.92, age: 'mid', cheeks: '#d5675b' },
    marcus: { name: 'Marcus',   skin: '#6a4430', hair: '#0d0b0a', hairStyle: 'fade', top: '#3268b8', top2: '#204a8c', bottom: '#2a2f38', h: 190, b: 1.1, age: 'young', cheeks: '#b0503f' },
    mei:    { name: 'Mei',      skin: '#efc7a0', hair: '#8b8b92', hairStyle: 'bob', glasses: true, top: '#2e3a3e', top2: '#1c2528', bottom: '#40495a', h: 156, b: 0.94, age: 'old', cheeks: '#eb8a78' },
    diego:  { name: 'Diego',    skin: '#c48a60', hair: '#1a1310', hairStyle: 'quiff', top: '#e2ddd0', top2: '#b9b3a4', bottom: '#3a4a63', h: 184, b: 1.0, age: 'young', cheeks: '#d1705a', stache: true },
    harpreet:{name: 'Harpreet', skin: '#a26b46', hair: '#26386a', hairStyle: 'turban', beard: '#211913', top: '#7c9558', top2: '#586e3c', bottom: '#2e3136', h: 178, b: 1.08, age: 'mid', cheeks: '#c96650' },
    amara:  { name: 'Amara',    skin: '#4a3024', hair: '#c9a24b', hairStyle: 'hijab', top: '#d99a3e', top2: '#a8731f', bottom: '#2c3140', h: 165, b: 0.9, age: 'young', cheeks: '#a4463a' },
    lena:   { name: 'Lena',     skin: '#f4d0b2', hair: '#e2b866', hairStyle: 'ponytail', top: '#8a4f78', top2: '#663857', bottom: '#2d3444', h: 168, b: 0.92, age: 'mid', cheeks: '#f0857a' },
    kenji:  { name: 'Kenji',    skin: '#ebbf95', hair: '#181818', hairStyle: 'quiff', glasses: true, top: '#a4423e', top2: '#7a2d2a', bottom: '#30363f', h: 168, b: 0.98, age: 'young', cheeks: '#e88a72' },
    sam:    { name: 'Sam',      skin: '#d3a07a', hair: '#5c4636', hairStyle: 'fade', top: '#5b8a52', top2: '#3f6438', bottom: '#3a3f4a', h: 132, b: 0.85, age: 'kid', cheeks: '#e0806a' },
    olu:    { name: 'Olu',      skin: '#3c261b', hair: '#0a0808', hairStyle: 'afro', top: '#e0b42c', top2: '#b0871a', bottom: '#2e3441', h: 176, b: 1.2, age: 'mid', cheeks: '#9a4133', stache: false, beard: '#0f0c0b' },
    rosa:   { name: 'Rosa',     skin: '#cf9268', hair: '#d6d6d8', hairStyle: 'bun', top: '#b74e6d', top2: '#8e3852', bottom: '#33394a', h: 150, b: 1.0, age: 'old', cheeks: '#dd7a66', glasses: true }
  };

  function hairBack(hs, p) {
    const c = p.hair;
    if (hs === 'long') return `<path d="M-17,-2 Q-19,-24 0,-24 Q19,-24 17,-2 L20,30 Q0,36 -20,30Z" fill="${c}"/>`;
    if (hs === 'ponytail') return `<path d="M10,-16 Q34,-14 30,14 Q26,30 18,34 Q26,10 12,2Z" fill="${c}"/>`;
    if (hs === 'hijab') return `<path d="M-19,-2 Q-21,-26 0,-26 Q21,-26 19,-2 Q22,24 30,40 L-30,40 Q-22,24 -19,-2Z" fill="${c}"/><path d="M-19,-2 Q-21,-26 0,-26 Q21,-26 19,-2 Q22,24 30,40 L0,40 L0,-26Z" fill="#000" opacity=".1"/>`;
    if (hs === 'afro') return `<circle cx="0" cy="-8" r="24" fill="${c}"/><circle cx="-14" cy="-2" r="12" fill="${c}"/><circle cx="14" cy="-2" r="12" fill="${c}"/>`;
    if (hs === 'bun') return `<circle cx="0" cy="-27" r="8" fill="${c}"/>`;
    return '';
  }
  function hairFront(hs, p) {
    const c = p.hair;
    const sheen = `<path d="M-8,-17 Q-2,-21 6,-18" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    switch (hs) {
      case 'fade': return `<path d="M-14,-4 Q-15,-21 0,-21 Q15,-21 14,-4 Q11,-13 0,-13 Q-11,-13 -14,-4Z" fill="${c}"/>` + sheen;
      case 'quiff': return `<path d="M-14,-3 Q-17,-22 -2,-24 Q14,-27 15,-8 Q16,-4 14,-3 Q10,-14 -2,-13 Q-10,-13 -14,-3Z" fill="${c}"/><path d="M-6,-22 Q4,-30 14,-20" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>` + sheen;
      case 'long': case 'ponytail': return `<path d="M-15,-2 Q-17,-22 0,-22 Q17,-22 15,-2 Q12,-12 3,-14 Q-6,-8 -15,-2Z" fill="${c}"/>` + sheen;
      case 'bob': return `<path d="M-16,10 Q-20,-22 0,-22 Q20,-22 16,10 L12,10 Q13,-9 0,-13 Q-13,-9 -12,10Z" fill="${c}"/>` + sheen;
      case 'hijab': return `<path d="M-15,-3 Q-16,-22 0,-22 Q16,-22 15,-3 Q10,-12 0,-12 Q-10,-12 -15,-3Z" fill="${c}"/><path d="M-15,-3 Q0,-16 15,-3" stroke="#fff" stroke-opacity=".18" fill="none"/>`;
      case 'turban': return `<path d="M-17,-2 Q-20,-28 0,-30 Q20,-28 17,-2 Q10,-10 0,-10 Q-10,-10 -17,-2Z" fill="${c}"/><path d="M-16,-9 Q0,-18 16,-9 M-16,-15 Q0,-24 16,-15 M-14,-21 Q0,-29 14,-21" stroke="#fff" stroke-opacity=".22" stroke-width="1.3" fill="none"/>`;
      case 'afro': return `<path d="M-14,-6 Q0,-16 14,-6" stroke="${c}" stroke-width="5" fill="none"/>`;
      case 'bun': return `<path d="M-14,-4 Q-15,-21 0,-21 Q15,-21 14,-4 Q10,-14 0,-14 Q-10,-14 -14,-4Z" fill="${c}"/>`;
      case 'baldtufts': return `<path d="M-14,2 Q-19,-6 -14,-14 Q-16,-4 -12,-2Z M14,2 Q19,-6 14,-14 Q16,-4 12,-2Z" fill="${c}"/><path d="M-13,-2 Q-17,-8 -14,-13 M13,-2 Q17,-8 14,-13" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="-5" cy="-13" rx="6" ry="3" fill="#fff" opacity=".28"/>`;
      default: return '';
    }
  }

  /* head centred on (0,0); face ~ 28 units wide. */
  function head(p, o) {
    o = o || {};
    const sk = p.skin, hs = p.hairStyle, old = p.age === 'old', kid = p.age === 'kid';
    let g = hairBack(hs, p);
    g += `<ellipse cx="-14.6" cy="2" rx="2.6" ry="4.2" fill="${sk}"/><ellipse cx="14.6" cy="2" rx="2.6" ry="4.2" fill="${sk}"/>`;
    g += `<ellipse cx="0" cy="0" rx="14" ry="${kid ? 14.5 : 15}" fill="${sk}"/>`;
    g += `<ellipse cx="-4" cy="-5" rx="9" ry="8" fill="#fff" opacity=".13"/><path d="M14,0 Q12,13 0,15 Q10,15 14,4Z" fill="#000" opacity=".1"/>`;
    g += `<ellipse cx="-8.4" cy="6.2" rx="3.6" ry="2.4" fill="${p.cheeks}" opacity=".38"/><ellipse cx="8.4" cy="6.2" rx="3.6" ry="2.4" fill="${p.cheeks}" opacity=".38"/>`;
    if (old) g += `<path d="M-11,-2 Q-9,-1 -8,-3 M8,-3 Q9,-1 11,-2 M-6,14 Q0,16 6,14" stroke="#000" stroke-opacity=".12" fill="none"/>`;
    // eyes
    const ey = (x) => `<ellipse cx="${x}" cy="0.4" rx="3.6" ry="4.3" fill="#fff"/><circle cx="${x + 0.3}" cy="0.9" r="2.5" fill="#5a3a24"/><circle cx="${x + 0.3}" cy="0.9" r="1.3" fill="#120c0a"/><circle cx="${x - 0.5}" cy="-0.5" r="0.95" fill="#fff"/>`;
    g += ey(-5.4) + ey(5.4);
    const bc = p.brows || p.hair;
    const bw = p.age === 'old' && p.brows ? 3 : 1.6;
    g += `<path d="M-9.4,-6 Q-5.4,-9 -1.8,-6.4 M1.8,-6.4 Q5.4,-9 9.4,-6" stroke="${bc}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>`;
    // nose
    g += `<ellipse cx="0" cy="5" rx="${1.9 * (p.nose || 1)}" ry="${1.5 * (p.nose || 1)}" fill="${p.cheeks}" opacity=".55"/>`;
    // mouth: open smile with teeth
    if (p.beard && (hs === 'baldtufts')) {
      g += `<path d="M-13,3 Q-16,20 0,25 Q16,20 13,3 Q9,12 0,12 Q-9,12 -13,3Z" fill="${p.beard}"/><path d="M-12,9 Q-6,4 0,8 Q6,4 12,9 Q6,12 0,11 Q-6,12 -12,9Z" fill="${p.beard}"/><path d="M-4,13 Q0,17 4,13Z" fill="#8a2f2f"/>`;
    } else if (p.beard) {
      g += `<path d="M-13,3 Q-14,20 0,23 Q14,20 13,3 Q9,10 0,10 Q-9,10 -13,3Z" fill="${p.beard}"/><path d="M-4.5,11 Q0,16 4.5,11Z" fill="#8a2f2f"/><path d="M-4,11 H4" stroke="#fff" stroke-width="1.6"/>`;
    } else {
      g += `<path d="M-5.2,9.4 Q0,15 5.2,9.4Z" fill="#8a2f2f"/><path d="M-4.4,9.4 H4.4 V10.8 H-4.4Z" fill="#fff"/><path d="M-5.6,9 Q0,11.6 5.6,9" stroke="#5c2222" stroke-width=".8" fill="none"/>`;
      if (p.stache) g += `<path d="M-7,7.4 Q-3,4.4 0,7 Q3,4.4 7,7.4 Q3,8.6 0,7.6 Q-3,8.6 -7,7.4Z" fill="${p.hair}"/>`;
    }
    if (p.glasses) g += `<rect x="-10.4" y="-4.6" width="9" height="8" rx="3.2" fill="#fff" fill-opacity=".14" stroke="#c7d0cc" stroke-width="1"/><rect x="1.4" y="-4.6" width="9" height="8" rx="3.2" fill="#fff" fill-opacity=".14" stroke="#c7d0cc" stroke-width="1"/><path d="M-1.4,-1.6 H1.4" stroke="#c7d0cc"/>`;
    g += hairFront(hs, p);
    return g;
  }

  /* full body, feet at 0,0. total ~195 units before scale. */
  function fig(x, by, hpx, p, o) {
    o = o || {};
    const s = hpx / 195, b = p.b || 1, sk = p.skin, kid = p.age === 'kid';
    const legH = kid ? 62 : 84;
    let g = `<g transform="translate(${x},${by}) scale(${s * (o.flip ? -1 : 1)},${s})">`;
    g += `<ellipse cx="0" cy="1" rx="${36 * b}" ry="5.5" fill="#000" opacity=".32"/>`;
    g += `<rect x="${-18 * b}" y="${-legH - 4}" width="${16 * b}" height="${legH + 2}" rx="6" fill="${p.bottom}"/><rect x="${2 * b}" y="${-legH - 4}" width="${16 * b}" height="${legH + 2}" rx="6" fill="${p.bottom}"/>`;
    g += `<rect x="${-18 * b}" y="${-legH - 4}" width="${36 * b}" height="16" rx="6" fill="${p.bottom}"/>`;
    g += `<path d="M${-20 * b},-2 Q${-20 * b},-11 ${-9 * b},-11 L${-2 * b},-11 L${-2 * b},-1 Q${-11 * b},4 ${-20 * b},-2Z" fill="#20242a"/><path d="M${20 * b},-2 Q${20 * b},-11 ${9 * b},-11 L${2 * b},-11 L${2 * b},-1 Q${11 * b},4 ${20 * b},-2Z" fill="#20242a"/>`;
    const th = -legH - 3, sh = th - (kid ? 44 : 56);
    if (!o.noArms) {
      g += `<rect x="${-31 * b}" y="${sh + 6}" width="${13 * b}" height="${kid ? 40 : 50}" rx="6.5" fill="${p.top2}"/><rect x="${18 * b}" y="${sh + 6}" width="${13 * b}" height="${kid ? 40 : 50}" rx="6.5" fill="${p.top2}"/>`;
      g += `<circle cx="${-24.5 * b}" cy="${sh + 58}" r="7" fill="${sk}"/><circle cx="${24.5 * b}" cy="${sh + 58}" r="7" fill="${sk}"/>`;
    }
    g += `<path d="M${-25 * b},${sh + 6} Q0,${sh - 6} ${25 * b},${sh + 6} L${23 * b},${th + 4} L${-23 * b},${th + 4}Z" fill="${p.top}"/>`;
    g += `<path d="M${-25 * b},${sh + 6} Q0,${sh - 6} ${25 * b},${sh + 6} L${23 * b},${th + 4} L0,${th + 4} L0,${sh - 2}Z" fill="#000" opacity=".1"/>`;
    if (p.plaid) { for (let i = -2; i <= 2; i++) g += `<path d="M${i * 9 * b},${sh + 2} V${th + 4}" stroke="${p.top2}" stroke-opacity=".55" stroke-width="2.4"/>`; for (let j = 0; j < 4; j++) g += `<path d="M${-24 * b},${sh + 12 + j * 12} H${24 * b}" stroke="${p.top2}" stroke-opacity=".4" stroke-width="2"/>`; }
    g += `<rect x="-5" y="${sh - 10}" width="10" height="14" rx="4" fill="${sk}"/>`;
    g += `<path d="M-8,${sh - 2} L0,${sh + 8} L8,${sh - 2}" fill="${p.top2}"/>`;
    const hs = kid ? 1.6 : 1.5;
    g += `<g transform="translate(0,${sh - 24 * hs + 4}) scale(${hs})">${head(p, o)}</g>`;
    g += '</g>';
    return g;
  }

  /* bust for interview frames: head+shoulders, `hpx` = head-to-frame scale; cx,cy = head centre in frame px */
  function bust(cx, cy, k, p, o) {
    o = o || {};
    const b = p.b || 1;
    let g = `<g transform="translate(${cx},${cy}) scale(${k})">`;
    g += `<path d="M${-70 * b},95 Q${-66 * b},32 ${-30 * b},26 L${30 * b},26 Q${66 * b},32 ${70 * b},95Z" fill="${p.top}"/><path d="M0,26 L${30 * b},26 Q${66 * b},32 ${70 * b},95 L0,95Z" fill="#000" opacity=".12"/>`;
    if (p.plaid) { for (let i = -3; i <= 3; i++) g += `<path d="M${i * 16 * b},30 V95" stroke="${p.top2}" stroke-opacity=".5" stroke-width="3"/>`; g += `<path d="M${-60 * b},52 H${60 * b}M${-64 * b},74 H${64 * b}" stroke="${p.top2}" stroke-opacity=".4" stroke-width="3"/>`; }
    g += `<rect x="-9" y="10" width="18" height="22" rx="7" fill="${p.skin}"/><path d="M-13,26 L0,44 L13,26Z" fill="${p.top2}"/>`;
    g += head(p, o) + '</g>';
    return g;
  }

  window.MCC = { CAST, head, fig, bust };
})();
