// Field guide data: 20 species of an eastern North American backyard in May.
// Plumage functions take normalized part coordinates and return a hex color.
//   body(t, v, s): t -1 rear..1 chest, v -1 belly..1 back, s -1..1 side
//   head(x, y, z): unit-sphere coords, z toward the bill, y up
//   wing(s, c):    s 0 shoulder..1 tip, c 0 leading..1 trailing edge
//   tail(l, w):    l 0 base..1 tip, w -1..1 across
//   neck(n, v):    n 0 body..1 head, v -1 front..1 back

import { smoothstep } from './noise.js';

export function blend(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
const band = (x, a, b, soft = 0.05) => smoothstep(a - soft, a + soft, x) * (1 - smoothstep(b - soft, b + soft, x));
const eyeDist = (x, y, z) => Math.hypot(Math.abs(x) - 0.7, y - 0.28, z - 0.62);
const bars = (s, freq, duty = 0.5) => (Math.sin(s * freq) * 0.5 + 0.5 > duty ? 1 : 0);

export const RARITY = {
  common: { label: 'Common', points: 100 },
  uncommon: { label: 'Uncommon', points: 200 },
  rare: { label: 'Rare', points: 400 },
  vagrant: { label: 'Vagrant', points: 1000 },
};

// Body archetypes, in units of total bird length (bill tip to tail tip).
const SHAPES = {
  passerine: { bodyL: 0.24, bodyW: 0.13, bodyH: 0.14, headR: 0.105, headY: 0.1, headZ: 0.22, beakL: 0.08, beakR: 0.03, beakFlat: 1, beakCurve: 0, tailL: 0.34, tailW: 0.15, tailAngle: -0.2, tailFork: 0, wingSpan: 0.72, wingChord: 0.24, legL: 0.09, neckL: 0, posture: 0.5, eyeR: 0.018, perchPosture: 0.5 },
  dove: { bodyL: 0.22, bodyW: 0.12, bodyH: 0.13, headR: 0.075, headY: 0.1, headZ: 0.22, beakL: 0.045, beakR: 0.013, tailL: 0.42, tailW: 0.1, tailAngle: -0.1, tailFork: -0.6, wingSpan: 0.78, wingChord: 0.22, legL: 0.05, posture: 0.2, eyeR: 0.013 },
  woodpecker: { bodyL: 0.23, bodyW: 0.12, bodyH: 0.13, headR: 0.1, headY: 0.1, headZ: 0.22, beakL: 0.09, beakR: 0.022, tailL: 0.3, tailW: 0.1, tailAngle: -0.35, tailFork: -0.4, wingSpan: 0.7, wingChord: 0.26, legL: 0.06, posture: 0.6, eyeR: 0.016 },
  duck: { bodyL: 0.3, bodyW: 0.17, bodyH: 0.13, headR: 0.08, headY: 0.2, headZ: 0.3, beakL: 0.1, beakR: 0.032, beakFlat: 0.45, tailL: 0.12, tailW: 0.1, tailAngle: 0.25, wingSpan: 0.72, wingChord: 0.2, legL: 0.05, neckL: 0.1, neckR: 0.045, posture: 0.0, eyeR: 0.011 },
  heron: { bodyL: 0.2, bodyW: 0.08, bodyH: 0.1, headR: 0.045, headY: 0.34, headZ: 0.3, beakL: 0.14, beakR: 0.016, tailL: 0.1, tailW: 0.06, tailAngle: -0.6, wingSpan: 0.85, wingChord: 0.28, legL: 0.42, neckL: 0.34, neckR: 0.028, posture: 0.55, eyeR: 0.008 },
  hawk: { bodyL: 0.24, bodyW: 0.14, bodyH: 0.15, headR: 0.1, headY: 0.1, headZ: 0.2, beakL: 0.06, beakR: 0.03, beakCurve: 0.9, tailL: 0.3, tailW: 0.13, tailAngle: -0.3, wingSpan: 1.05, wingChord: 0.34, fingers: true, legL: 0.08, posture: 1.0, eyeR: 0.016 },
  hummingbird: { bodyL: 0.2, bodyW: 0.1, bodyH: 0.11, headR: 0.095, headY: 0.08, headZ: 0.2, beakL: 0.24, beakR: 0.01, tailL: 0.22, tailW: 0.09, tailAngle: -0.2, tailFork: 0.3, wingSpan: 0.6, wingChord: 0.16, legL: 0.03, posture: 0.35, eyeR: 0.02 },
  owl: { bodyL: 0.22, bodyW: 0.17, bodyH: 0.17, headR: 0.15, headY: 0.03, headZ: 0.2, headLevel: 1, beakL: 0.045, beakR: 0.022, beakCurve: 1.2, tailL: 0.2, tailW: 0.14, tailAngle: -0.4, wingSpan: 1.1, wingChord: 0.36, legL: 0.07, posture: 1.25, eyeR: 0.036, eyesForward: true, earTufts: true },
};

const shape = (base, over = {}) => ({ ...SHAPES.passerine, ...SHAPES[base], ...over, archetype: base });

export const SPECIES = [
  {
    id: 'cardinal', name: 'Northern Cardinal', latin: 'Cardinalis cardinalis', rarity: 'common', size: 0.22,
    shape: shape('passerine', { beakL: 0.085, beakR: 0.045, crest: { h: 0.13, r: 0.05, angle: 0.75 }, tailL: 0.36 }),
    fieldMarks: 'Male: all red with a black mask and a thick coral bill. Female: warm buff with red wings, crest and tail.',
    fact: 'Both sexes sing, and pairs often trade phrases back and forth. Males feed females seed by seed during courtship.',
    habitats: { feeder: 3, feederGround: 2, shrub: 4, treetop: 2, canopy: 1, fence: 1, birdbath: 1 },
    count: 4, flush: 7, song: 'cardinal', songEvery: 9, flight: 'flap',
    variants: [
      { key: 'male', label: 'Adult male', weight: 1, plumage: {
        body: (t, v) => blend(0xC81D25, 0x9F141A, smoothstep(-0.2, 0.8, v)),
        head: (x, y, z) => {
          const mask = Math.max(smoothstep(0.3, 0.5, z) * (1 - smoothstep(0.3, 0.55, y)), smoothstep(0.1, 0.4, z) * (1 - smoothstep(-0.55, -0.35, y)));
          return blend(0xCC2027, 0x151010, mask);
        },
        crest: () => 0xC51E24,
        wing: (s, c) => blend(0x9A1A17, 0x5B1714, smoothstep(0.55, 0.85, s) * smoothstep(0.2, 0.6, c)),
        tail: (l) => blend(0x8C1715, 0x6D1512, l),
        beak: 0xF26B3C, legs: 0xA8786A,
      } },
      { key: 'female', label: 'Adult female', weight: 1, plumage: {
        body: (t, v) => blend(0xC9AE8C, 0x9E8466, smoothstep(-0.2, 0.8, v)),
        head: (x, y, z) => {
          const mask = smoothstep(0.35, 0.55, z) * (1 - smoothstep(0.2, 0.5, y));
          return blend(0xB39B7C, 0x4D4038, mask * 0.85);
        },
        crest: () => 0xB0503A,
        wing: (s, c) => blend(0xB6452E, 0x7C5A44, smoothstep(0.25, 0.6, c)),
        tail: () => 0xA7452F,
        beak: 0xF07A45, legs: 0xA8786A,
      } },
    ],
  },
  {
    id: 'bluejay', name: 'Blue Jay', latin: 'Cyanocitta cristata', rarity: 'common', size: 0.28,
    shape: shape('passerine', { beakL: 0.075, beakR: 0.028, crest: { h: 0.12, r: 0.045, angle: 0.9 }, tailL: 0.38 }),
    fieldMarks: 'Bright blue above, white below, a black necklace, and black bars on the wings and tail.',
    fact: 'Blue Jays can imitate Red-tailed Hawk calls, possibly to warn other jays or scare birds off a feeder.',
    habitats: { canopy: 3, treetop: 2, feeder: 2, feederGround: 1, pine: 1 },
    count: 3, flush: 12, song: 'bluejay', songEvery: 11, flight: 'flap',
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v) => {
        let c = blend(0xECEDEE, 0x5B84C2, smoothstep(-0.1, 0.35, v));
        c = blend(c, 0x141414, band(t, 0.72, 0.9, 0.04) * (1 - smoothstep(0.2, 0.5, v)));
        return c;
      },
      head: (x, y, z) => {
        const top = smoothstep(0.0, 0.3, y + (1 - z) * 0.25 - 0.1);
        let c = blend(0xF1F1F0, 0x5E8ACB, top);
        const collar = band(y, -0.55, -0.35, 0.06) * smoothstep(-0.6, 0.2, z);
        const line = band(y, 0.05, 0.2, 0.05) * smoothstep(-0.4, 0.2, -z) * (1 - smoothstep(0.1, 0.4, top));
        c = blend(c, 0x141414, Math.max(collar, line));
        return blend(c, 0x141414, smoothstep(0.85, 0.95, z) * (1 - smoothstep(0.2, 0.4, y)));
      },
      crest: () => 0x5A86C8,
      wing: (s, c) => {
        let col = blend(0x3F7CD8, 0x2A5FB4, s);
        col = blend(col, 0x111317, bars(s, 34, 0.72) * smoothstep(0.35, 0.5, c));
        return blend(col, 0xF4F4F4, smoothstep(0.82, 0.95, c) * (1 - smoothstep(0.55, 0.7, s)));
      },
      tail: (l, w) => blend(blend(0x3A73CE, 0x111317, bars(l, 30, 0.75)), 0xF5F5F5, smoothstep(0.85, 0.95, l) * smoothstep(0.3, 0.6, Math.abs(w))),
      beak: 0x1A1A1A, legs: 0x2A2A2E,
    } }],
  },
  {
    id: 'robin', name: 'American Robin', latin: 'Turdus migratorius', rarity: 'common', size: 0.25,
    shape: shape('passerine', { beakL: 0.07, beakR: 0.022, legL: 0.12, posture: 0.35 }),
    fieldMarks: 'Gray-brown back, brick-orange breast, a dark head with broken white eye arcs, and a yellow bill.',
    fact: 'Robins hunt earthworms by sight, not by hearing. Watch for the head tilt, then a quick lunge.',
    habitats: { lawn: 5, canopy: 2, treetop: 1, fence: 1, birdbath: 1 },
    count: 5, flush: 9, song: 'robin', songEvery: 8, flight: 'flap',
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v) => {
        const breast = (1 - smoothstep(0.0, 0.35, v)) * smoothstep(-0.75, -0.45, t);
        let c = blend(0x5E5650, 0xC4531F, breast);
        return blend(c, 0xF0EEEA, (1 - smoothstep(-0.8, -0.55, t)) * (1 - smoothstep(-0.3, 0.1, v)));
      },
      head: (x, y, z) => {
        let c = 0x2C2724;
        const d = eyeDist(x, y, z);
        c = blend(c, 0xF2EFEA, band(d, 0.1, 0.16, 0.02) * (Math.abs(y - 0.28) > 0.06 ? 1 : 0));
        const throat = (1 - smoothstep(-0.55, -0.35, y)) * smoothstep(0.1, 0.4, z);
        return blend(c, bars(x, 60, 0.5) ? 0xF1EEE8 : 0x2C2724, throat);
      },
      wing: (s, c) => blend(0x5A524B, 0x3A3632, smoothstep(0.5, 0.9, s)),
      tail: () => 0x2D2A28,
      beak: 0xE6B42C, legs: 0x5C4A3E,
    } }],
  },
  {
    id: 'chickadee', name: 'Black-capped Chickadee', latin: 'Poecile atricapillus', rarity: 'common', size: 0.135,
    shape: shape('passerine', { headR: 0.13, beakL: 0.05, beakR: 0.022, tailL: 0.38, bodyW: 0.14, bodyH: 0.15 }),
    fieldMarks: 'Black cap and bib, bright white cheeks, soft gray back and buffy flanks.',
    fact: 'The more "dee" notes a chickadee adds to its call, the more dangerous the predator it has spotted.',
    habitats: { feeder: 4, canopy: 3, shrub: 2, pine: 1 },
    count: 4, flush: 4, song: 'chickadee', songEvery: 10, flight: 'bound',
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v, s) => {
        let c = blend(0xEFEBE2, 0x8F8F8A, smoothstep(0.1, 0.45, v));
        return blend(c, 0xD8B98E, smoothstep(0.55, 0.85, Math.abs(s)) * (1 - smoothstep(0.1, 0.4, v)) * smoothstep(-0.8, -0.2, t));
      },
      head: (x, y, z) => {
        const cap = smoothstep(0.12, 0.25, y);
        const bib = (1 - smoothstep(-0.45, -0.3, y)) * smoothstep(-0.1, 0.2, z);
        return blend(0xF4F3EF, 0x121212, Math.max(cap, bib));
      },
      wing: (s, c) => blend(0x7D7E7C, 0xE2E2DE, smoothstep(0.7, 0.9, c) * (1 - smoothstep(0.6, 0.8, s))),
      tail: (l, w) => blend(0x6E6F6D, 0xDADAD6, smoothstep(0.75, 0.95, Math.abs(w))),
      beak: 0x151515, legs: 0x3A3F48,
    } }],
  },
  {
    id: 'titmouse', name: 'Tufted Titmouse', latin: 'Baeolophus bicolor', rarity: 'common', size: 0.155,
    shape: shape('passerine', { headR: 0.12, beakL: 0.05, beakR: 0.022, crest: { h: 0.11, r: 0.045, angle: 0.8 }, eyeR: 0.024 }),
    fieldMarks: 'Soft gray above, pale below, rusty flanks, a pointed crest and a black patch above the bill.',
    fact: 'Titmice pluck hair from sleeping raccoons, dogs and even people to line their nests.',
    habitats: { feeder: 4, canopy: 3, shrub: 1 },
    count: 2, flush: 5, song: 'titmouse', songEvery: 9, flight: 'bound',
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v, s) => {
        let c = blend(0xF1EFEA, 0x8C9098, smoothstep(0.05, 0.4, v));
        return blend(c, 0xD3895A, smoothstep(0.55, 0.85, Math.abs(s)) * (1 - smoothstep(0.0, 0.3, v)) * band(t, -0.6, 0.4, 0.2));
      },
      head: (x, y, z) => blend(blend(0xF2F0EC, 0x8C9098, smoothstep(-0.1, 0.25, y)), 0x151515, smoothstep(0.8, 0.9, z) * band(y, 0.05, 0.5, 0.08)),
      crest: () => 0x8A8E96,
      wing: () => 0x80848C, tail: () => 0x7A7E86,
      beak: 0x2A2A2A, legs: 0x5A6070,
    } }],
  },
  {
    id: 'goldfinch', name: 'American Goldfinch', latin: 'Spinus tristis', rarity: 'common', size: 0.125,
    shape: shape('passerine', { beakL: 0.07, beakR: 0.03, tailFork: 0.4, tailL: 0.33 }),
    fieldMarks: 'Breeding male: lemon yellow with a black forehead, black wings with white bars, and a pink-orange bill.',
    fact: 'Goldfinches wait until late summer to nest, when thistle down is ready to line the cup.',
    habitats: { flowers: 4, feeder: 3, meadow: 3, canopy: 1 },
    count: 4, flush: 5, song: 'goldfinch', songEvery: 7, flight: 'bound',
    variants: [{ key: 'male', label: 'Breeding male', plumage: {
      body: (t, v) => blend(0xF6D11C, 0xF0F0E8, (1 - smoothstep(-0.85, -0.6, t)) * (1 - smoothstep(-0.2, 0.2, v))),
      head: (x, y, z) => blend(0xF7D31E, 0x111111, smoothstep(0.3, 0.45, y) * smoothstep(0.0, 0.3, z)),
      wing: (s, c) => blend(0x141414, 0xF5F5F0, Math.max(band(c, 0.18, 0.3, 0.03), smoothstep(0.85, 0.95, c) * (1 - smoothstep(0.6, 0.75, s)))),
      tail: (l, w) => blend(0x151515, 0xEDEDE8, smoothstep(0.6, 0.8, Math.abs(w)) * band(l, 0.2, 0.7, 0.1)),
      beak: 0xF2A06B, legs: 0xC49C84,
    } }],
  },
  {
    id: 'dove', name: 'Mourning Dove', latin: 'Zenaida macroura', rarity: 'common', size: 0.3,
    shape: shape('dove'),
    fieldMarks: 'Slim and tan with a small head, black wing spots and a long pointed tail edged in white.',
    fact: 'The whistling you hear at takeoff comes from the wings, not the voice.',
    habitats: { feederGround: 4, fence: 3, lawn: 2, canopy: 1 },
    count: 4, flush: 8, song: 'dove', songEvery: 12, flight: 'direct',
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v) => blend(0xD9BFA2, 0xA2907A, smoothstep(-0.1, 0.5, v)),
      head: (x, y, z) => blend(0xC5AD93, 0x1A1614, Math.max(0, 1 - Math.hypot(Math.abs(x) - 0.62, y + 0.05, z - 0.45) / 0.1)),
      wing: (s, c) => blend(0xA29077, 0x181412, (Math.sin(s * 22) * Math.sin(c * 17) > 0.55 ? 1 : 0) * band(s, 0.2, 0.55, 0.05) * smoothstep(0.3, 0.5, c)),
      tail: (l, w) => blend(blend(0x958878, 0x2A2522, band(l, 0.7, 0.8, 0.03) * smoothstep(0.4, 0.6, Math.abs(w))), 0xF0EEE8, smoothstep(0.8, 0.9, l) * smoothstep(0.3, 0.6, Math.abs(w))),
      beak: 0x222222, legs: 0xD0807B,
    } }],
  },
  {
    id: 'redwing', name: 'Red-winged Blackbird', latin: 'Agelaius phoeniceus', rarity: 'common', size: 0.22,
    shape: shape('passerine', { beakL: 0.085, beakR: 0.026, tailL: 0.34 }),
    fieldMarks: 'Male: glossy black with red shoulder patches bordered in yellow. Flashes them while singing.',
    fact: 'One male may defend a marsh territory with up to 15 females nesting in it.',
    habitats: { cattail: 6, shore: 1, feederGround: 1 },
    count: 4, flush: 8, song: 'redwing', songEvery: 7, flight: 'flap',
    variants: [{ key: 'male', label: 'Adult male', plumage: {
      body: () => 0x111111, head: () => 0x121212,
      wing: (s, c) => {
        const ep = (1 - smoothstep(0.24, 0.3, s)) * (1 - smoothstep(0.3, 0.38, c));
        const bord = (1 - smoothstep(0.3, 0.36, s)) * (1 - smoothstep(0.42, 0.5, c));
        return blend(blend(0x101010, 0xE6C35A, bord), 0xE0231C, ep);
      },
      tail: () => 0x0F0F0F,
      beak: 0x121212, legs: 0x1C1C1C, gloss: true,
    } }],
  },
  {
    id: 'downy', name: 'Downy Woodpecker', latin: 'Dryobates pubescens', rarity: 'uncommon', size: 0.16,
    shape: shape('woodpecker', { beakL: 0.06 }),
    fieldMarks: 'Checkered black and white with a white back stripe and a tiny bill. Males have a red patch on the back of the head.',
    fact: 'The smallest woodpecker in North America. It drums on wood to claim territory, not only to find food.',
    habitats: { trunk: 4, snag: 3, feeder: 2 },
    count: 2, flush: 6, song: 'downy', songEvery: 10, flight: 'bound', onTrunk: true,
    variants: [{ key: 'male', label: 'Adult male', plumage: {
      body: (t, v, s) => blend(0xF2F1EE, blend(0x131313, 0xF4F4F2, (1 - smoothstep(0.25, 0.4, Math.abs(s)))), smoothstep(0.1, 0.35, v)),
      head: (x, y, z) => {
        let c = 0xF3F2EF;
        c = blend(c, 0x141414, smoothstep(0.35, 0.5, y));
        c = blend(c, 0x141414, band(y, 0.02, 0.18, 0.04) * (1 - smoothstep(0.55, 0.7, z)));
        c = blend(c, 0x141414, band(y, -0.35, -0.2, 0.04) * (1 - smoothstep(0.5, 0.7, z)) * smoothstep(0.3, 0.6, Math.abs(x)));
        return blend(c, 0xD8262A, smoothstep(-0.2, -0.45, z) * smoothstep(0.15, 0.35, y));
      },
      wing: (s, c) => blend(0x121212, 0xF2F2F0, (Math.sin(s * 30) > 0.3 && Math.sin(c * 16) > 0 ? 1 : 0) * smoothstep(0.2, 0.3, c)),
      tail: (l, w) => blend(0x121212, 0xF0F0EE, smoothstep(0.65, 0.85, Math.abs(w))),
      beak: 0x2A2A2A, legs: 0x4A4A4A,
    } }],
  },
  {
    id: 'mockingbird', name: 'Northern Mockingbird', latin: 'Mimus polyglottos', rarity: 'uncommon', size: 0.25,
    shape: shape('passerine', { beakL: 0.075, beakR: 0.02, tailL: 0.44, bodyW: 0.11 }),
    fieldMarks: 'Slim and gray with a long tail. Big white wing patches and white outer tail feathers flash in flight.',
    fact: 'A male can learn around 200 songs, copying other birds, frogs, car alarms and squeaky gates.',
    habitats: { treetop: 4, fence: 3, shrub: 2, lawn: 1 },
    count: 1, flush: 8, song: 'mockingbird', songEvery: 4, flight: 'flap',
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v) => blend(0xE7E6E1, 0x8A8A87, smoothstep(0.0, 0.4, v)),
      head: (x, y, z) => blend(blend(0xE8E7E2, 0x8B8B88, smoothstep(-0.1, 0.25, y)), 0x3A3A38, band(y, 0.18, 0.3, 0.04) * band(z, 0.2, 0.9, 0.1)),
      wing: (s, c) => blend(blend(0x3C3C3A, 0xF2F2EE, band(s, 0.45, 0.62, 0.02) * smoothstep(0.2, 0.3, c)), 0xEDEDE9, band(c, 0.15, 0.2, 0.02)),
      tail: (l, w) => blend(0x2F2F2E, 0xF3F3F0, smoothstep(0.7, 0.85, Math.abs(w))),
      beak: 0x1A1A1A, legs: 0x2E2E2E,
    } }],
  },
  {
    id: 'bluebird', name: 'Eastern Bluebird', latin: 'Sialia sialis', rarity: 'uncommon', size: 0.19,
    shape: shape('passerine', { beakL: 0.06, beakR: 0.022, bodyW: 0.14, bodyH: 0.15, posture: 0.4 }),
    fieldMarks: 'Male: vivid royal blue above, a rusty orange throat and breast, and a white belly.',
    fact: 'Bluebirds can spot a single caterpillar in the grass from 60 feet away.',
    habitats: { nestbox: 3, fence: 4, meadow: 1, snag: 1 },
    count: 2, flush: 9, song: 'bluebird', songEvery: 9, flight: 'flap',
    variants: [{ key: 'male', label: 'Adult male', plumage: {
      body: (t, v) => blend(blend(0xF1EFEA, 0xCF6F35, smoothstep(-0.5, -0.2, t)), 0x2E68D0, smoothstep(0.05, 0.35, v)),
      head: (x, y, z) => blend(0x3068CF, 0xCC6B34, (1 - smoothstep(-0.5, -0.35, y)) * smoothstep(0.0, 0.3, z)),
      wing: (s, c) => blend(0x2F6AD6, 0x1D3F84, smoothstep(0.6, 0.95, s) * smoothstep(0.4, 0.8, c)),
      tail: () => 0x2B62C8,
      beak: 0x1A1A1A, legs: 0x252525,
    } }],
  },
  {
    id: 'mallard', name: 'Mallard', latin: 'Anas platyrhynchos', rarity: 'common', size: 0.58,
    shape: shape('duck'),
    fieldMarks: 'Drake: glossy green head, white collar, chestnut chest and a yellow bill. Hen: mottled brown with an orange-and-black bill. Both show a blue wing patch.',
    fact: 'Only hen Mallards make the classic loud quack. Drakes give a quieter, raspy call.',
    habitats: { water: 6, shore: 1 },
    count: 4, flush: 14, song: 'mallard', songEvery: 14, flight: 'direct', swims: true,
    variants: [
      { key: 'drake', label: 'Drake', weight: 1, plumage: {
        body: (t, v) => {
          let c = blend(0xC6C4BE, 0x7B6A58, smoothstep(0.2, 0.6, v));
          c = blend(c, 0x5E3222, smoothstep(0.35, 0.6, t) * (1 - smoothstep(0.1, 0.5, v)));
          return blend(c, 0x141414, 1 - smoothstep(-0.9, -0.7, t));
        },
        neck: (n) => blend(0x6A3A24, blend(0xF4F4F2, 0x1E6A3A, smoothstep(0.35, 0.45, n)), smoothstep(0.15, 0.25, n)),
        head: () => 0x1D6638,
        wing: (s, c) => blend(0x8E8A84, 0x3048C0, band(s, 0.25, 0.5, 0.03) * smoothstep(0.65, 0.75, c)),
        tail: (l) => blend(0x1A1A1A, 0xE9E8E4, smoothstep(0.4, 0.7, l)),
        beak: 0xD9C63E, legs: 0xE68A2E, gloss: true,
      } },
      { key: 'hen', label: 'Hen', weight: 1, plumage: {
        body: (t, v, s) => blend(0xA07C54, 0x5C432C, (Math.sin(t * 40 + s * 9) * Math.sin(v * 30) > 0.2 ? 0.7 : 0.1) + smoothstep(0.3, 0.8, v) * 0.2),
        neck: () => 0x9E7F5C,
        head: (x, y, z) => blend(0xA88B69, 0x3D2E22, band(y, 0.1, 0.24, 0.04) + smoothstep(0.35, 0.5, y) * 0.6),
        wing: (s, c) => blend(0x7C5E40, 0x3048C0, band(s, 0.25, 0.5, 0.03) * smoothstep(0.65, 0.75, c)),
        tail: () => 0x8A6A48,
        beak: 0xD9822E, legs: 0xE68A2E,
      } },
    ],
  },
  {
    id: 'heron', name: 'Great Blue Heron', latin: 'Ardea herodias', rarity: 'uncommon', size: 1.15,
    shape: shape('heron'),
    fieldMarks: 'Very tall and blue-gray, with a white face, a black stripe over the eye, and a dagger-like yellow bill.',
    fact: 'Herons swallow fish whole and can stand motionless for many minutes before striking.',
    habitats: { shore: 5 },
    count: 1, flush: 26, song: 'heron', songEvery: 40, flight: 'heron', wades: true,
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v) => blend(0x8C9AA8, 0x6C7B8C, smoothstep(0, 0.6, v)),
      neck: (n, v) => blend(0xA39FA8, 0xECEAE6, smoothstep(0.3, 0.8, -v) * 0.8),
      head: (x, y, z) => blend(0xF1F0EC, 0x151515, band(y, 0.3, 0.6, 0.06) * (1 - smoothstep(0.5, 0.8, z))),
      wing: (s, c) => blend(0x6E7D8F, 0x2D343C, smoothstep(0.55, 0.8, s)),
      tail: () => 0x6A7888,
      beak: 0xD9A63A, legs: 0x8C8766,
    } }],
  },
  {
    id: 'hawk', name: 'Red-tailed Hawk', latin: 'Buteo jamaicensis', rarity: 'uncommon', size: 0.52,
    shape: shape('hawk'),
    fieldMarks: 'Chunky brown hawk with a pale chest, a streaky belly band and a brick-red tail.',
    fact: 'Its raspy scream is the "eagle" sound in almost every movie.',
    habitats: { sky: 6, snag: 2, treetop: 1 },
    count: 1, flush: 30, song: 'hawk', songEvery: 18, flight: 'soar',
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v, s) => {
        let c = blend(0xEFE3CA, 0x5C3F2B, smoothstep(0.05, 0.4, v));
        const bellyBand = band(t, -0.45, 0.0, 0.1) * (1 - smoothstep(0.0, 0.3, v));
        return blend(c, 0x4A3222, bellyBand * (Math.sin(s * 20 + t * 11) > 0 ? 0.9 : 0.3));
      },
      head: (x, y, z) => blend(0x5E4331, 0xEDE3CF, (1 - smoothstep(-0.45, -0.25, y)) * smoothstep(0.1, 0.5, z)),
      wing: (s, c) => blend(blend(0x5E412D, 0x3A2718, smoothstep(0.7, 0.95, s)), 0x8C6A4B, (Math.sin(s * 25 + c * 13) > 0.6 ? 0.5 : 0)),
      tail: (l) => blend(0xBF5A2E, 0x2A1E16, band(l, 0.88, 0.94, 0.02)),
      beak: 0x2A2622, legs: 0xE3BE3C,
    } }],
  },
  {
    id: 'hummingbird', name: 'Ruby-throated Hummingbird', latin: 'Archilochus colubris', rarity: 'rare', size: 0.09,
    shape: shape('hummingbird'),
    fieldMarks: 'Tiny and emerald green above, with a gorget that flashes ruby red only in the right light.',
    fact: 'Beats its wings about 53 times a second, and some cross the Gulf of Mexico in one nonstop flight.',
    habitats: { nectar: 5 },
    count: 1, flush: 3, song: 'hummingbird', songEvery: 6, flight: 'hover',
    variants: [{ key: 'male', label: 'Adult male', plumage: {
      body: (t, v) => blend(0xE9ECE4, 0x3E7D35, smoothstep(-0.3, 0.2, v)),
      head: (x, y, z) => blend(0x3A7A33, 0xC0102E, (1 - smoothstep(-0.25, -0.05, y)) * smoothstep(-0.1, 0.3, z)),
      wing: () => 0x3A3A3E, tail: () => 0x2A2E2A,
      beak: 0x121212, legs: 0x111111, gloss: true,
    } }],
  },
  {
    id: 'oriole', name: 'Baltimore Oriole', latin: 'Icterus galbula', rarity: 'uncommon', size: 0.2,
    shape: shape('passerine', { beakL: 0.08, beakR: 0.022, tailL: 0.34 }),
    fieldMarks: 'Male: flame orange with a black hood and back, and a white bar on black wings.',
    fact: 'Orioles weave hanging, sock-shaped nests high at the tips of elm and maple branches.',
    habitats: { treetop: 4, canopy: 3, flowers: 1 },
    count: 1, flush: 10, song: 'oriole', songEvery: 8, flight: 'flap',
    variants: [{ key: 'male', label: 'Adult male', plumage: {
      body: (t, v) => blend(0xF58A1C, 0x121212, smoothstep(0.25, 0.5, v) * smoothstep(-0.5, -0.2, t) + smoothstep(0.55, 0.8, t) * smoothstep(-0.2, 0.3, v)),
      head: () => 0x131313,
      wing: (s, c) => blend(blend(0x141414, 0xF58A1C, (1 - smoothstep(0.12, 0.18, s)) * (1 - smoothstep(0.3, 0.4, c))), 0xF1F0EC, band(c, 0.3, 0.38, 0.02) * (1 - smoothstep(0.55, 0.65, s))),
      tail: (l, w) => blend(0x141414, 0xF28B20, smoothstep(0.35, 0.6, Math.abs(w)) * smoothstep(0.3, 0.5, l)),
      beak: 0x7F8A99, legs: 0x5A6070,
    } }],
  },
  {
    id: 'waxwing', name: 'Cedar Waxwing', latin: 'Bombycilla cedrorum', rarity: 'uncommon', size: 0.17,
    shape: shape('passerine', { beakL: 0.05, beakR: 0.024, crest: { h: 0.1, r: 0.04, angle: 1.1 }, tailL: 0.3 }),
    fieldMarks: 'Silky tan-brown with a swept-back crest, a narrow black mask, and a tail tipped in bright yellow.',
    fact: 'Flocks pass berries beak to beak down a branch. The red wax tips on the wings grow brighter with age.',
    habitats: { canopy: 4, treetop: 3, pine: 2 },
    count: 5, flush: 7, song: 'waxwing', songEvery: 6, flight: 'flap', flocks: true,
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v) => {
        let c = blend(0xE3D28E, 0xB28E66, smoothstep(-0.3, 0.3, v) * smoothstep(-0.5, 0.2, t) + smoothstep(0.2, 0.6, t));
        return blend(c, 0x8D8A87, (1 - smoothstep(-0.8, -0.5, t)) * smoothstep(0.0, 0.3, v));
      },
      head: (x, y, z) => {
        let c = 0xB38D62;
        const mask = band(y, 0.12, 0.38, 0.04) * smoothstep(-0.3, 0.3, z);
        c = blend(c, 0xF6F4EE, band(y, 0.38, 0.44, 0.02) * smoothstep(-0.2, 0.3, z));
        c = blend(c, 0x121212, mask);
        return blend(c, 0x1A1714, (1 - smoothstep(-0.5, -0.35, y)) * smoothstep(0.3, 0.6, z));
      },
      crest: () => 0xAE885D,
      wing: (s, c) => blend(0x7B7672, 0xD0212A, smoothstep(0.93, 0.98, c) * band(s, 0.3, 0.5, 0.02)),
      tail: (l) => blend(0x6F6C6A, 0xF4D02C, smoothstep(0.84, 0.88, l)),
      beak: 0x151515, legs: 0x1E1E1E,
    } }],
  },
  {
    id: 'woodduck', name: 'Wood Duck', latin: 'Aix sponsa', rarity: 'rare', size: 0.5,
    shape: shape('duck', { crest: { h: 0.09, r: 0.05, angle: 1.8 }, beakL: 0.075 }),
    fieldMarks: 'Drake: iridescent green crest, white bridle lines on the face, a red eye, burgundy chest and buff flanks.',
    fact: 'Ducklings leap from nest holes as high as 50 feet on their first day and bounce unhurt.',
    habitats: { water: 3, shore: 2 },
    count: 1, flush: 18, song: 'woodduck', songEvery: 16, flight: 'direct', swims: true, eyeColor: 0xC6201C,
    variants: [{ key: 'drake', label: 'Drake', plumage: {
      body: (t, v, s) => {
        let c = blend(0xD7BD85, 0x2A2A24, smoothstep(0.2, 0.5, v));
        c = blend(c, 0x6E2426, smoothstep(0.35, 0.55, t) * (1 - smoothstep(0.1, 0.4, v)));
        c = blend(c, 0xF4F4F0, band(t, 0.3, 0.36, 0.015) * (1 - smoothstep(0.1, 0.4, v)));
        return blend(c, 0x141414, 1 - smoothstep(-0.9, -0.7, t));
      },
      neck: (n, v) => blend(0x6E2426, 0xF4F4F0, smoothstep(0.3, 0.7, -v) * (1 - smoothstep(0.6, 0.8, n))),
      head: (x, y, z) => {
        let c = blend(0x1E5B3E, 0x3A2A62, smoothstep(-0.5, 0.2, -z));
        c = blend(c, 0xF4F4F0, band(y, 0.38, 0.46, 0.02));
        c = blend(c, 0xF4F4F0, (1 - smoothstep(-0.55, -0.4, y)) * smoothstep(-0.2, 0.3, z));
        return blend(c, 0xF4F4F0, band(y, -0.15, -0.08, 0.02) * (1 - smoothstep(0.2, 0.5, z)));
      },
      crest: () => 0x2A5A45,
      wing: (s, c) => blend(0x2E2E32, 0x3656B8, band(s, 0.25, 0.5, 0.03) * smoothstep(0.65, 0.75, c)),
      tail: () => 0x1E1E1E,
      beak: 0xD23A2A, legs: 0xD8A23A, gloss: true,
    } }],
  },
  {
    id: 'owl', name: 'Great Horned Owl', latin: 'Bubo virginianus', rarity: 'rare', size: 0.55,
    shape: shape('owl'),
    fieldMarks: 'Huge, with feathered "horns", a rusty facial disk rimmed in black, a white throat and yellow eyes.',
    fact: 'Its grip needs about 28 pounds of force to open. It is one of the few predators that eats skunks.',
    habitats: { pine: 6 },
    count: 1, flush: 10, song: 'owl', songEvery: 14, flight: 'direct', eyeColor: 0xF2BE22, dawnOnly: true,
    variants: [{ key: 'adult', label: 'Adult', plumage: {
      body: (t, v, s) => blend(blend(0xB9A68A, 0x6A5846, smoothstep(0.0, 0.5, v)), 0x3C3128, (Math.sin(v * 38 + s * 6) > 0.55 ? 0.6 : 0) + (Math.sin(t * 50) > 0.8 ? 0.3 : 0)),
      head: (x, y, z) => {
        const disk = smoothstep(0.1, 0.4, z);
        let c = blend(0x6A5746, 0xC27B44, disk);
        c = blend(c, 0x1F1914, band(Math.hypot(x * 0.9, y - 0.05), 0.7, 0.8, 0.05) * disk);
        return blend(c, 0xF2EFE8, (1 - smoothstep(-0.6, -0.45, y)) * smoothstep(0.3, 0.6, z));
      },
      wing: (s, c) => blend(0x6E5A45, 0x2E261E, (Math.sin(s * 30) * Math.sin(c * 22) > 0.35 ? 0.8 : 0)),
      tail: (l) => blend(0x6D5A46, 0x2E261E, bars(l, 30, 0.7)),
      beak: 0x2D2A26, legs: 0xC8B79C,
    } }],
  },
  {
    id: 'bunting', name: 'Painted Bunting', latin: 'Passerina ciris', rarity: 'vagrant', size: 0.13,
    shape: shape('passerine', { beakL: 0.065, beakR: 0.03 }),
    fieldMarks: 'Male: a blue-violet head, lime-green back and bright red underparts, with a red eye ring.',
    fact: 'Normally a southern bird. A stray male in a northern backyard draws birders from hundreds of miles away.',
    habitats: { feeder: 5, shrub: 2 },
    count: 1, flush: 5, song: 'bunting', songEvery: 7, flight: 'bound', alertOnly: true,
    variants: [{ key: 'male', label: 'Adult male', plumage: {
      body: (t, v) => blend(0xE12A2E, 0x9FC43C, smoothstep(0.15, 0.4, v) * smoothstep(-0.4, -0.1, t) * (1 - smoothstep(0.6, 0.8, t))),
      head: (x, y, z) => blend(blend(0x3B4FD0, 0xE12A2E, (1 - smoothstep(-0.45, -0.3, y)) * smoothstep(0.1, 0.4, z)), 0xE12A2E, band(eyeDist(x, y, z), 0.1, 0.15, 0.015)),
      wing: (s, c) => blend(0x6E9A3A, 0x3E4A3A, smoothstep(0.5, 0.9, s)),
      tail: () => 0x4A3E52,
      beak: 0x8E949C, legs: 0x6A6A6E,
    } }],
  },
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
