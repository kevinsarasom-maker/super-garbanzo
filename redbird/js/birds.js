// Procedural bird models (built from the species data) and their behavior.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIES, blend } from './species.js';
import { mulberry32, smoothstep, clamp, lerp } from './noise.js';

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const rand = mulberry32(90210);

// ---------------------------------------------------------------- materials

function featherNormalTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  // Overlapping feather tips drawn as soft arcs make a height field.
  const r = mulberry32(7);
  for (let row = -1; row < 18; row++) {
    for (let col = -1; col < 18; col++) {
      const x = col * 16 + (row % 2) * 8 + (r() - 0.5) * 4;
      const y = row * 15 + (r() - 0.5) * 3;
      const grad = g.createRadialGradient(x, y - 6, 2, x, y - 6, 14);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.75, 'rgba(160,160,160,0.6)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x, y, 9, 12, 0, 0, Math.PI);
      g.fill();
      g.strokeStyle = 'rgba(40,40,40,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y - 8);
      g.lineTo(x, y + 9);
      g.stroke();
    }
  }
  const src = g.getImageData(0, 0, S, S).data;
  const out = g.createImageData(S, S);
  const h = (x, y) => src[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 2.2;
      const dy = (h(x, y + 1) - h(x, y - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

let MATS = null;
export function birdMaterials() {
  if (MATS) return MATS;
  const normalMap = featherNormalTexture();
  const feather = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.74, metalness: 0,
    sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.3, 0.3, 0.3),
    normalMap, normalScale: new THREE.Vector2(0.2, 0.2),
  });
  const gloss = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0,
    iridescence: 0.55, iridescenceIOR: 1.35, iridescenceThicknessRange: [220, 480],
    sheen: 0.4, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.25, 0.25, 0.3),
    normalMap, normalScale: new THREE.Vector2(0.14, 0.14),
  });
  const eye = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });
  const blur = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const featherDS = feather.clone();
  featherDS.side = THREE.DoubleSide;
  const glossDS = gloss.clone();
  glossDS.side = THREE.DoubleSide;
  MATS = { feather, gloss, featherDS, glossDS, eye, blur };
  return MATS;
}

// ---------------------------------------------------------------- geometry

function colorize(geo, fn, jitter = 0.07) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    _c.setHex(fn(i));
    const k = 1 - jitter / 2 + rand() * jitter;
    col[i * 3] = _c.r * k;
    col[i * 3 + 1] = _c.g * k;
    col[i * 3 + 2] = _c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function solid(geo, hex, jitter = 0.04) {
  return colorize(geo, () => hex, jitter);
}

function gridGeometry(ns, nc, fn) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= ns; i++) {
    for (let j = 0; j <= nc; j++) {
      const p = fn(i / ns, j / nc);
      pos.push(p[0], p[1], p[2]);
      uv.push(p[3], p[4]);
    }
  }
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < nc; j++) {
      const a = i * (nc + 1) + j, b = a + nc + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const WING_STYLE = {
  passerine: { sweep: 0.45, tip: 0.16, fingers: 0 },
  dove: { sweep: 0.55, tip: 0.1, fingers: 0 },
  woodpecker: { sweep: 0.35, tip: 0.26, fingers: 0 },
  duck: { sweep: 0.55, tip: 0.1, fingers: 0 },
  heron: { sweep: 0.18, tip: 0.55, fingers: 4 },
  hawk: { sweep: 0.12, tip: 0.62, fingers: 5 },
  hummingbird: { sweep: 0.5, tip: 0.14, fingers: 0 },
  owl: { sweep: 0.2, tip: 0.55, fingers: 0 },
};

function buildParts(sp, variant) {
  const sh = sp.shape;
  const pal = variant.plumage;
  const P = {};

  // Body: an egg-shaped ellipsoid, long axis on Z.
  {
    const g = new THREE.SphereGeometry(1, 40, 28);
    g.rotateX(Math.PI / 2);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const tv = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const ws = 1 - 0.32 * smoothstep(0, 1, -z) + 0.05 * smoothstep(0, 1, z);
      const A = sh.bodyW * ws;
      const B = sh.bodyH * ws * (y < 0 ? 1.06 : 0.93);
      const C = sh.bodyL;
      const lift = smoothstep(-0.4, -1, z) * sh.bodyH * 0.25;
      pos.setXYZ(i, x * A, y * B + lift, z * C);
      _v.set(x / A, y / B, z / C).normalize();
      nor.setXYZ(i, _v.x, _v.y, _v.z);
      tv.push([z, y, x]);
    }
    P.body = colorize(g, (i) => pal.body(tv[i][0], tv[i][1], tv[i][2]));
  }

  // Head with bill, crest and ear tufts, centered on the head pivot.
  {
    const R = sh.headR;
    const g = new THREE.SphereGeometry(1, 32, 22);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const hv = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const sx = R * 0.92, sy = R * 0.96, sz = R * 1.06;
      pos.setXYZ(i, x * sx, y * sy, z * sz);
      _v.set(x / sx, y / sy, z / sz).normalize();
      nor.setXYZ(i, _v.x, _v.y, _v.z);
      hv.push([x, y, z]);
    }
    colorize(g, (i) => pal.head(hv[i][0], hv[i][1], hv[i][2]));
    const parts = [g];

    const bl = sh.beakL, br = sh.beakR;
    const beak = new THREE.ConeGeometry(br, bl, 12, 6);
    beak.rotateX(Math.PI / 2);
    beak.translate(0, 0, bl / 2);
    const bp = beak.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      let x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
      const f = z / bl;
      if (sh.beakFlat && sh.beakFlat < 1) { y *= sh.beakFlat; x *= 1.35 - f * 0.2; }
      if (sh.beakCurve) y -= sh.beakCurve * f * f * bl * 0.45;
      bp.setXYZ(i, x, y, z);
    }
    beak.computeVertexNormals();
    beak.translate(0, -R * 0.14, R * 0.8);
    solid(beak, pal.beak, 0.06);
    colorize(beak, (i) => blend(pal.beak, 0x1a1a1a, sp.id === 'mallard' || sp.id === 'woodduck' ? 0 : smoothstep(0.75, 1, (bp.getZ(i) - R * 0.8) / bl) * 0.35), 0.03);
    parts.push(beak);

    if (sh.crest) {
      const { h, r, angle } = sh.crest;
      const cr = new THREE.ConeGeometry(r, h, 10, 4);
      cr.translate(0, h / 2, 0);
      cr.rotateX(-angle);
      cr.scale(0.55, 1, 1);
      cr.translate(0, R * 0.7, -R * 0.08);
      const crc = pal.crest || (() => pal.head(0, 1, 0));
      solid(cr, crc(), 0.08);
      parts.push(cr);
    }
    if (sh.earTufts) {
      for (const sgn of [-1, 1]) {
        const t = new THREE.ConeGeometry(R * 0.2, R * 0.55, 8, 2);
        t.translate(0, R * 0.27, 0);
        t.rotateZ(-sgn * 0.35);
        t.rotateX(-0.25);
        t.scale(0.7, 1, 0.5);
        t.translate(sgn * R * 0.5, R * 0.72, R * 0.05);
        solid(t, 0x3B3026, 0.1);
        parts.push(t);
      }
    }
    P.head = mergeGeometries(parts);

    // Eyes (glossy, separate material).
    const eyes = [];
    const eyeCol = sp.eyeColor ?? 0x0b0908;
    for (const sgn of [-1, 1]) {
      const dir = sh.eyesForward ? _v.set(sgn * 0.42, 0.18, 0.89).normalize() : _v.set(sgn * 0.7, 0.28, 0.62).normalize();
      const e = new THREE.SphereGeometry(sh.eyeR, 14, 10);
      const c = dir.clone().multiply(new THREE.Vector3(R * 0.92, R * 0.96, R * 1.06)).multiplyScalar(0.97);
      e.translate(c.x, c.y, c.z);
      eyes.push(solid(e, eyeCol, 0));
      if (sp.eyeColor) {
        const p = new THREE.SphereGeometry(sh.eyeR * 0.55, 10, 8);
        const pc = c.clone().addScaledVector(dir, sh.eyeR * 0.62);
        p.translate(pc.x, pc.y, pc.z);
        eyes.push(solid(p, 0x050505, 0));
      }
    }
    P.eyes = mergeGeometries(eyes);
  }

  // Neck tube (ducks and herons).
  if (sh.neckL) {
    const start = new THREE.Vector3(0, sh.bodyH * 0.45, sh.bodyL * 0.72);
    const end = new THREE.Vector3(0, sh.headY, sh.headZ);
    const mid1 = start.clone().lerp(end, 0.33).add(new THREE.Vector3(0, 0, sh.neckL * (sp.id === 'heron' ? 0.35 : 0.05)));
    const mid2 = start.clone().lerp(end, 0.66).add(new THREE.Vector3(0, 0, sh.neckL * (sp.id === 'heron' ? -0.2 : 0)));
    const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, end]);
    const TS = 24, RS = 12;
    const g = new THREE.TubeGeometry(curve, TS, sh.neckR, RS, false);
    const pos = g.attributes.position;
    const nv = [];
    for (let i = 0; i < pos.count; i++) {
      const ti = Math.floor(i / (RS + 1)) / TS;
      const p = curve.getPointAt(ti);
      _v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(p);
      const scale = lerp(1.6, 0.9, ti);
      nv.push([ti, -_v.clone().normalize().z]);
      _v.multiplyScalar(scale).add(p);
      pos.setXYZ(i, _v.x, _v.y, _v.z);
    }
    g.computeVertexNormals();
    const neckFn = pal.neck || ((n, v) => blend(pal.body(1, v, 0), pal.head(0, v, 0.5), n));
    P.neck = colorize(g, (i) => neckFn(nv[i][0], nv[i][1]));
  }

  // Wing: a parametric surface; s along the span, c across the chord.
  {
    const st = WING_STYLE[sh.archetype] || WING_STYLE.passerine;
    const span = sh.wingSpan, chord = sh.wingChord;
    const g = gridGeometry(22, 8, (s, c) => {
      const lead = chord * (-0.05 * Math.sin(Math.PI * Math.min(1, s / 0.55)) + st.sweep * smoothstep(0.4, 1, s));
      let width = chord * lerp(1, st.tip, smoothstep(0.42, 1, s)) * (s < 0.08 ? lerp(0.8, 1, s / 0.08) : 1);
      if (st.fingers && s > 0.74) width *= 0.7 + 0.3 * Math.abs(Math.cos(st.fingers * Math.PI * (s - 0.74) / 0.26));
      const y = chord * 0.07 * Math.sin(Math.PI * c) * (1 - s * 0.6) - 0.05 * span * s * s;
      return [s * span, y, -(lead + c * width), s * 3, c * 1.5];
    });
    const sv = [];
    for (let i = 0; i <= 22; i++) for (let j = 0; j <= 8; j++) sv.push([i / 22, j / 8]);
    P.wing = colorize(g, (i) => pal.wing(sv[i][0], sv[i][1]));
  }

  // Tail: a fan pointing backward from the rump.
  {
    const L = sh.tailL, W = sh.tailW;
    const g = gridGeometry(10, 8, (l, wn) => {
      const w = wn * 2 - 1;
      const hw = W * 0.5 * (0.55 + 0.55 * l);
      let z = -l * L;
      if (l > 0.6) {
        const k = smoothstep(0.6, 1, l);
        if (sh.tailFork) z -= sh.tailFork * (Math.abs(w) - 0.5) * 0.3 * L * k;
        else z += 0.08 * L * w * w * k;
      }
      return [w * hw, 0.01 * L * (1 - w * w) + Math.abs(w) * hw * 0.7 * (1 - l * 0.4), z, l * 2, wn];
    });
    const tv = [];
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 8; j++) tv.push([i / 10, (j / 8) * 2 - 1]);
    P.tail = colorize(g, (i) => pal.tail(tv[i][0], tv[i][1]));
  }

  // Legs and toes, in root space (feet at the origin).
  {
    const legs = [];
    const lr = Math.max(0.009, sh.legL * 0.06);
    const hip = sh.legL + sh.bodyH * 0.35;
    for (const sgn of [-1, 1]) {
      const x = sgn * sh.bodyW * 0.32;
      const leg = new THREE.CylinderGeometry(lr * 0.85, lr, hip, 6, 1);
      leg.translate(x, hip / 2, -0.01);
      legs.push(leg);
      const toeL = Math.max(0.035, sh.legL * 0.35);
      for (const a of [-0.45, 0, 0.45, Math.PI]) {
        const t = new THREE.CylinderGeometry(lr * 0.6, lr * 0.7, toeL, 5, 1);
        t.rotateX(Math.PI / 2);
        t.translate(0, 0, toeL / 2);
        t.rotateY(a);
        t.translate(x, lr * 0.6, -0.01);
        legs.push(t);
      }
    }
    for (const g of legs) g.deleteAttribute('uv');
    P.legs = solid(mergeGeometries(legs), pal.legs, 0.05);
    P.legs.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P.legs.attributes.position.count * 2), 2));
    P.hipY = sh.legL + sh.bodyH * 0.72;
  }
  return P;
}

const GEO_CACHE = new Map();
export function birdGeometry(sp, variant) {
  const key = sp.id + ':' + variant.key;
  if (!GEO_CACHE.has(key)) GEO_CACHE.set(key, buildParts(sp, variant));
  return GEO_CACHE.get(key);
}

// ---------------------------------------------------------------- model

const Q_FOLD = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)),
)
  .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.55))
  .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.12));
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();

export class BirdModel {
  constructor(sp, variant, { castShadow = false } = {}) {
    this.sp = sp;
    this.variant = variant;
    const sh = sp.shape;
    const geo = birdGeometry(sp, variant);
    const M = birdMaterials();
    const glossy = !!variant.plumage.gloss;
    const skin = glossy ? M.gloss : M.feather;
    const skinDS = glossy ? M.glossDS : M.featherDS;

    this.root = new THREE.Object3D();
    this.posture = new THREE.Object3D();
    this.posture.position.y = geo.hipY;
    this.root.add(this.posture);

    const mk = (g, m) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = false;
      return mesh;
    };
    this.body = mk(geo.body, skin);
    this.posture.add(this.body);
    if (geo.neck) this.posture.add(mk(geo.neck, skin));

    this.headPivot = new THREE.Object3D();
    this.headPivot.position.set(0, sh.headY, sh.headZ);
    this.posture.add(this.headPivot);
    this.head = mk(geo.head, skin);
    this.headPivot.add(this.head);
    this.eyes = mk(geo.eyes, M.eye);
    this.headPivot.add(this.eyes);

    this.tailPivot = new THREE.Object3D();
    this.tailPivot.position.set(0, sh.bodyH * 0.2, -sh.bodyL * 0.86);
    this.posture.add(this.tailPivot);
    this.tail = mk(geo.tail, skinDS);
    this.tailPivot.add(this.tail);

    this.wings = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Object3D();
      pivot.position.set(side * sh.bodyW * 0.72, sh.bodyH * 0.5, sh.bodyL * 0.32);
      if (side < 0) pivot.scale.x = -1;
      const mesh = mk(geo.wing, skinDS);
      pivot.add(mesh);
      this.posture.add(pivot);
      this.wings.push({ side, pivot, mesh });
    }
    this.skinDS = skinDS;

    this.legs = mk(geo.legs, M.feather);
    this.root.add(this.legs);

    this.pose = { fold: 1, flap: 0, pitch: sh.posture, headYaw: 0, headPitch: 0, tailSpread: 0, bank: 0, blur: false, legs: true };
    this.apply();
  }

  apply() {
    const p = this.pose, sh = this.sp.shape;
    this.posture.rotation.set(-p.pitch, 0, p.bank, 'YXZ');
    this.headPivot.rotation.set(p.pitch * (sh.headLevel ?? 0.85) + p.headPitch, p.headYaw, 0, 'YXZ');
    this.tailPivot.rotation.x = sh.tailAngle;
    this.tail.scale.x = 1 + p.tailSpread * 0.9;
    const open = 1 - p.fold;
    _qb.setFromAxisAngle(Z_AXIS, p.flap + 0.08);
    for (const w of this.wings) {
      const q = _qa.copy(Q_FOLD).slerp(_qb, open);
      if (w.side < 0) q.set(q.x, -q.y, -q.z, q.w);
      w.pivot.quaternion.copy(q);
      w.mesh.scale.set(lerp(0.52, 1, open), 1, lerp(0.72, 1, open));
      w.pivot.position.x = w.side * sh.bodyW * lerp(0.42, 0.7, open);
      w.pivot.position.y = sh.bodyH * lerp(0.84, 0.5, open);
      w.mesh.material = p.blur ? birdMaterials().blur : this.skinDS;
    }
    this.legs.visible = p.legs;
  }
}

// ---------------------------------------------------------------- behavior

const FLIGHT_SPEED = { flap: 8, bound: 7, direct: 11, heron: 6, soar: 9, hover: 9 };
const TMP = new THREE.Vector3();

function bezier(out, p0, p1, p2, p3, t) {
  const u = 1 - t;
  return out.set(0, 0, 0)
    .addScaledVector(p0, u * u * u)
    .addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t)
    .addScaledVector(p3, t * t * t);
}

let NEXT_ID = 1;
export class Bird {
  constructor(sp, variant, world, opts = {}) {
    this.id = NEXT_ID++;
    this.sp = sp;
    this.variant = variant;
    this.world = world;
    this.model = new BirdModel(sp, variant, { castShadow: sp.size > 0.4 });
    this.root = this.model.root;
    this.scale = sp.size * (0.95 + rand() * 0.1);
    this.root.scale.setScalar(this.scale);
    this.rng = mulberry32(this.id * 7919);
    this.state = 'perched';
    this.perch = null;
    this.flight = null;
    this.heading = rand() * Math.PI * 2;
    this.t = 0;
    this.nextMove = 4 + this.rng() * 20;
    this.nextHead = 0;
    this.headTarget = 0;
    this.headPitchTarget = 0;
    this.singT = 0;
    this.nextSong = 1 + this.rng() * sp.songEvery * 1.5;
    this.peckT = 0;
    this.nextPeck = 2 + this.rng() * 4;
    this.hop = null;
    this.alarmT = 0;
    this.strikeT = 0;
    this.drumT = 0;
    this.dabbleT = 0;
    this.velocity = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.active = !sp.alertOnly;
    this.root.visible = this.active;
    this.leader = opts.leader || null;
  }

  get pos() { return this.root.position; }

  // Center of the bird's body in world space.
  center(out = new THREE.Vector3()) {
    return this.model.body.getWorldPosition(out);
  }

  headWorld(out = new THREE.Vector3()) {
    return this.model.head.getWorldPosition(out);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(0, 0, 1).applyQuaternion(this.model.posture.getWorldQuaternion(_q)).normalize();
  }

  behavior() {
    if (this.state === 'flying' || this.state === 'soaring') return 'In flight';
    if (this.state === 'hovering') return 'Hovering';
    if (this.strikeT > 0) return 'Hunting';
    if (this.drumT > 0) return 'Drumming';
    if (this.singT > 0) return 'Singing';
    if (this.dabbleT > 0) return 'Dabbling';
    if (this.peckT > 0) return 'Feeding';
    if (this.state === 'swimming') return 'Swimming';
    return null;
  }

  pickPerch(avoid) {
    const kinds = Object.entries(this.sp.habitats);
    const total = kinds.reduce((a, [, w]) => a + w, 0);
    for (let attempt = 0; attempt < 12; attempt++) {
      let r = this.rng() * total, kind = kinds[0][0];
      for (const [k, w] of kinds) { r -= w; if (r <= 0) { kind = k; break; } }
      if (kind === 'sky') return { kind: 'sky' };
      if (kind === 'water') return { kind: 'water', pos: this.world.randomWaterPoint(this.rng) };
      const list = this.world.perches[kind];
      if (!list || !list.length) continue;
      let pool = list;
      if (this.leader && this.leader.perch && this.leader.perch.pos) {
        const lp = this.leader.perch.pos;
        pool = list.filter((p) => !p.occupant && p.pos.distanceToSquared(lp) < 12 * 12);
        if (!pool.length) pool = list;
      }
      for (let k = 0; k < 8; k++) {
        const p = pool[Math.floor(this.rng() * pool.length)];
        if (p.occupant && p.occupant !== this) continue;
        if (avoid && p.pos.distanceTo(avoid) < 22) continue;
        return p;
      }
    }
    return null;
  }

  place(perch) {
    this.release();
    if (perch.kind === 'sky') { this.startSoar(); return; }
    if (perch.kind === 'water') { this.state = 'swimming'; this.perch = perch; this.pos.copy(perch.pos); this.swimTarget = null; this.poseSwim(); return; }
    if (perch.occupant !== undefined) perch.occupant = this;
    this.perch = perch;
    this.pos.copy(perch.pos);
    this.state = perch.kind === 'nectar' ? 'hovering' : perch.kind === 'shore' && this.sp.wades ? 'wading' : 'perched';
    if (perch.kind === 'trunk') this.state = 'trunk';
    if (perch.facing !== undefined) this.heading = perch.facing;
    this.nextMove = 10 + this.rng() * 35;
  }

  release() {
    if (this.perch && this.perch.occupant === this) this.perch.occupant = null;
    this.perch = null;
  }

  flyTo(target, fast = false) {
    if (!target) return;
    if (target.kind === 'sky') {
      const c = this.world.skyCenter;
      target = { kind: 'sky', pos: new THREE.Vector3(c.x + 30, 45, c.z) };
    }
    const from = this.pos.clone();
    if (this.state === 'swimming' || this.state === 'wading') from.y += 0.05;
    const to = target.pos.clone();
    const d = from.distanceTo(to);
    const lift = Math.min(10, d * 0.25) + 1;
    const dir = TMP.copy(to).sub(from).setY(0).normalize();
    this.release();
    if (target.occupant !== undefined && target.kind !== 'water') target.occupant = this;
    const speed = (FLIGHT_SPEED[this.sp.flight] || 8) * (fast ? 1.35 : 1);
    this.flight = {
      p0: from, p3: to, target,
      p1: from.clone().add(new THREE.Vector3(0, lift, 0)).addScaledVector(dir, d * 0.2),
      p2: to.clone().add(new THREE.Vector3(0, lift * 0.6 + (target.kind === 'water' ? 1 : 0), 0)).addScaledVector(dir, -d * 0.2),
      t: 0, dur: Math.max(0.8, d / speed), fast,
    };
    this.state = 'flying';
    this.singT = 0;
    this.peckT = 0;
  }

  startSoar() {
    this.state = 'soaring';
    this.perch = { kind: 'sky' };
    this.soarAngle = this.rng() * Math.PI * 2;
    this.soarR = 22 + this.rng() * 15;
    this.soarAlt = 38 + this.rng() * 18;
    this.nextMove = 50 + this.rng() * 60;
  }

  flush(playerPos) {
    const target = this.pickPerch(playerPos) || this.pickPerch(null);
    if (!target) return;
    if (target.kind === 'water') {
      const far = this.world.randomWaterPoint(this.rng, playerPos);
      this.flyTo({ kind: 'water', pos: far }, true);
    } else {
      this.flyTo(target, true);
    }
    this.alarmT = 6;
  }

  update(dt, ctx) {
    if (!this.active) return;
    this.t += dt;
    this.prevPos.copy(this.pos);
    const pose = this.model.pose;
    const sp = this.sp;
    const player = ctx.player;
    const distToPlayer = this.pos.distanceTo(player.pos);

    // Flush when the player gets too close or too loud.
    if (this.state !== 'flying' && this.state !== 'soaring' && ctx.playing) {
      const flushDist = sp.flush * player.noise * (this.alarmT > 0 ? 1.4 : 1);
      if (distToPlayer < flushDist) {
        this.flush(player.pos);
        ctx.onFlush?.(this);
      }
    }
    this.alarmT = Math.max(0, this.alarmT - dt);

    // Song.
    this.singT = Math.max(0, this.singT - dt);
    if (this.state !== 'flying' || sp.id === 'goldfinch') this.nextSong -= dt * ctx.activity * (sp.dawnOnly ? (ctx.dayFrac < 0.4 ? 1 : 0) : 1);
    if (this.nextSong <= 0 && distToPlayer < 140) {
      const dur = ctx.audio ? ctx.audio.song(sp.song, this.headWorld(TMP), this.id) : 1.5;
      this.singT = dur;
      this.nextSong = sp.songEvery * (0.6 + this.rng() * 0.9);
      ctx.onSong?.(this, dur);
    }

    switch (this.state) {
      case 'flying': this.updateFlight(dt, pose); break;
      case 'soaring': this.updateSoar(dt, pose); break;
      case 'swimming': this.updateSwim(dt, pose); break;
      case 'wading': this.updateWade(dt, pose); break;
      case 'hovering': this.updateHover(dt, pose); break;
      case 'trunk': this.updateTrunk(dt, pose, ctx); break;
      default: this.updatePerched(dt, pose); break;
    }

    // Wander to a new spot now and then.
    if (this.state !== 'flying') {
      this.nextMove -= dt;
      if (this.nextMove <= 0) {
        if (this.state === 'soaring' && this.world.perches.snag?.length && this.rng() < 0.6) {
          this.flyTo(this.world.perches.snag[0].occupant ? this.pickPerch() : this.world.perches.snag[0]);
        } else if (this.state === 'swimming' && this.rng() < 0.75) {
          this.nextMove = 20 + this.rng() * 30;
        } else {
          const target = this.pickPerch();
          if (target && target.kind === 'water' && this.state === 'swimming') this.nextMove = 20;
          else if (target) this.flyTo(target);
          else this.nextMove = 10;
        }
      }
    }

    this.root.rotation.set(0, this.heading, 0);
    this.model.apply();
    this.velocity.copy(this.pos).sub(this.prevPos).divideScalar(Math.max(dt, 1e-4));
    this.root.visible = distToPlayer < 170 || this.state === 'soaring';
  }

  lookAround(dt, pose, rate = 1) {
    this.nextHead -= dt * rate;
    if (this.nextHead <= 0) {
      this.headTarget = (this.rng() - 0.5) * 2.2;
      this.headPitchTarget = (this.rng() - 0.5) * 0.5;
      this.nextHead = 0.4 + this.rng() * 2.2;
    }
    const k = 1 - Math.exp(-dt * 18);
    pose.headYaw += (this.headTarget - pose.headYaw) * k;
    pose.headPitch += (this.headPitchTarget - pose.headPitch) * k;
  }

  updatePerched(dt, pose) {
    const sp = this.sp, sh = sp.shape;
    pose.fold = Math.min(1, pose.fold + dt * 4);
    pose.flap = 0;
    pose.legs = true;
    pose.blur = false;
    pose.bank = 0;
    pose.tailSpread = Math.max(0, pose.tailSpread - dt * 2);
    const kind = this.perch?.kind;
    const ground = kind === 'lawn' || kind === 'meadow' || kind === 'feederGround' || kind === 'shore';
    const feeding = ground || kind === 'feeder';
    pose.pitch = lerp(pose.pitch, ground ? sh.posture * 0.6 : sh.posture, 1 - Math.exp(-dt * 6));

    if (this.singT > 0) {
      pose.headPitch = lerp(pose.headPitch, -0.35, 1 - Math.exp(-dt * 10));
      pose.headYaw *= 0.9;
      if (sp.id === 'redwing') pose.fold = 0.75; // flashes the red shoulders
      pose.tailSpread = sp.id === 'redwing' ? 0.6 : pose.tailSpread;
      return;
    }

    if (feeding) {
      this.nextPeck -= dt;
      if (this.nextPeck <= 0) { this.peckT = 0.9 + this.rng() * 1.6; this.nextPeck = 1.5 + this.rng() * 4; }
    }
    if (this.peckT > 0) {
      this.peckT -= dt;
      const bob = Math.max(0, Math.sin(this.t * 14));
      pose.headPitch = 0.6 + bob * 0.5;
      pose.headYaw *= 0.9;
      pose.pitch = lerp(pose.pitch, 0.05, 0.2);
    } else {
      this.lookAround(dt, pose);
    }

    // Short hops or runs on the ground.
    if (ground) {
      if (!this.hop && this.rng() < dt * (sp.id === 'robin' ? 0.5 : 0.25)) {
        const a = this.heading + (this.rng() - 0.5) * 2.2;
        const len = sp.id === 'robin' ? 0.6 + this.rng() : 0.15 + this.rng() * 0.3;
        const to = this.pos.clone().add(new THREE.Vector3(Math.sin(a) * len, 0, Math.cos(a) * len));
        to.y = this.world.groundHeight(to.x, to.z);
        if (this.world.isGroundOk(to.x, to.z)) this.hop = { from: this.pos.clone(), to, t: 0, dur: sp.id === 'robin' ? len / 2.2 : 0.22, run: sp.id === 'robin' || sp.id === 'dove' };
        this.heading = a;
      }
      if (this.hop) {
        const h = this.hop;
        h.t += dt / h.dur;
        const t = Math.min(1, h.t);
        this.pos.lerpVectors(h.from, h.to, t);
        if (!h.run) this.pos.y += Math.sin(t * Math.PI) * 0.06;
        if (h.t >= 1) { this.hop = null; if (this.perch && this.perch.pos) this.perch.pos.copy(this.pos); }
      }
    }
  }

  updateFlight(dt, pose) {
    const f = this.flight;
    f.t += dt / f.dur;
    const t = Math.min(1, f.t);
    const sp = this.sp;
    bezier(this.pos, f.p0, f.p1, f.p2, f.p3, t);
    const ahead = bezier(TMP, f.p0, f.p1, f.p2, f.p3, Math.min(1, t + 0.02));
    const dx = ahead.x - this.pos.x, dz = ahead.z - this.pos.z, dy = ahead.y - this.pos.y;
    if (dx * dx + dz * dz > 1e-6) {
      const target = Math.atan2(dx, dz);
      let diff = target - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * (1 - Math.exp(-dt * 10));
      pose.bank = clamp(-diff * 2, -0.7, 0.7);
    }
    const climb = Math.atan2(dy, Math.hypot(dx, dz) + 1e-5);
    pose.legs = t > 0.9;
    pose.blur = false;
    pose.headYaw *= 0.8;
    pose.headPitch = lerp(pose.headPitch, 0, 0.2);
    const landing = smoothstep(0.82, 1, t);
    let freq = 13, amp = 0.9;
    if (sp.flight === 'heron') { freq = 2.6; amp = 0.75; }
    else if (sp.flight === 'soar') { freq = 3.5; amp = 0.6; }
    else if (sp.flight === 'direct') { freq = 9; amp = 0.8; }
    else if (sp.flight === 'hover') { freq = 45; amp = 1; pose.blur = true; }
    if (sp.size < 0.16 && sp.flight !== 'hover') freq = 18;
    let flapping = true;
    if (sp.flight === 'bound') {
      const cyc = (this.t * 2.2) % 1;
      flapping = cyc < 0.55 || landing > 0;
      this.pos.y += Math.sin(this.t * 2.2 * Math.PI * 2) * 0.25;
    }
    this.flapPhase = (this.flapPhase || 0) + dt * freq * Math.PI * 2;
    if (flapping) {
      pose.fold = lerp(pose.fold, 0, 1 - Math.exp(-dt * 20));
      pose.flap = Math.sin(this.flapPhase) * amp + 0.15;
    } else {
      pose.fold = lerp(pose.fold, 0.92, 1 - Math.exp(-dt * 20));
      pose.flap = 0;
    }
    pose.pitch = lerp(-climb * 0.8 + (sp.flight === 'heron' ? 0.1 : 0), 0.9, landing);
    pose.tailSpread = landing;
    if (f.t >= 1) {
      this.flight = null;
      pose.bank = 0;
      const tgt = f.target;
      if (tgt.kind === 'sky') { this.startSoar(); return; }
      if (tgt.kind === 'water') { this.state = 'swimming'; this.perch = tgt; this.nextMove = 20 + this.rng() * 30; return; }
      this.place(tgt);
    }
  }

  updateSoar(dt, pose) {
    const c = this.world.skyCenter;
    this.soarAngle += dt * 0.22;
    this.pos.set(c.x + Math.cos(this.soarAngle) * this.soarR, this.soarAlt + Math.sin(this.t * 0.3) * 3, c.z + Math.sin(this.soarAngle) * this.soarR);
    this.heading = Math.atan2(-Math.sin(this.soarAngle), Math.cos(this.soarAngle));
    pose.fold = lerp(pose.fold, 0, 0.1);
    pose.flap = 0.12 + Math.sin(this.t * 0.8) * 0.03;
    pose.bank = -0.35;
    pose.pitch = 0.02;
    pose.legs = false;
    pose.tailSpread = 0.9;
    pose.headYaw = Math.sin(this.t * 0.5) * 0.4;
  }

  poseSwim() {
    const pose = this.model.pose;
    pose.fold = 1; pose.legs = false; pose.pitch = 0; pose.flap = 0; pose.bank = 0;
    this.pos.y = this.world.waterLevel - 0.04 * this.scale / 0.58;
  }

  updateSwim(dt, pose) {
    this.poseSwim();
    if (!this.swimTarget || this.pos.distanceTo(this.swimTarget) < 0.5) this.swimTarget = this.world.randomWaterPoint(this.rng);
    const dir = TMP.copy(this.swimTarget).sub(this.pos).setY(0);
    const target = Math.atan2(dir.x, dir.z);
    let diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    this.heading += diff * (1 - Math.exp(-dt * 0.8));
    const speed = this.dabbleT > 0 ? 0 : 0.28;
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    this.pos.y += Math.sin(this.t * 2.1 + this.id) * 0.006;
    if (this.dabbleT > 0) {
      this.dabbleT -= dt;
      pose.pitch = -1.1;
      pose.headPitch = 0.4;
      this.pos.y -= 0.05;
    } else {
      pose.pitch = Math.sin(this.t * 1.7) * 0.03;
      this.lookAround(dt, pose, 0.6);
      if (this.rng() < dt * 0.05) this.dabbleT = 1.5 + this.rng() * 2;
    }
  }

  updateWade(dt, pose) {
    pose.fold = 1; pose.legs = true; pose.flap = 0; pose.bank = 0;
    pose.pitch = this.sp.shape.posture;
    if (this.strikeT > 0) {
      this.strikeT -= dt;
      const k = Math.sin(clamp(1 - this.strikeT / 1.2, 0, 1) * Math.PI);
      pose.headPitch = k * 1.3;
      pose.pitch = this.sp.shape.posture - k * 0.5;
    } else {
      this.lookAround(dt, pose, 0.25);
      pose.headPitch *= 0.95;
      if (this.rng() < dt * 0.04) this.strikeT = 1.2;
      if (!this.hop && this.rng() < dt * 0.05) {
        const a = this.heading + (this.rng() - 0.5) * 1.2;
        const to = this.pos.clone().add(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.8));
        if (this.world.isShore(to.x, to.z)) {
          to.y = Math.max(this.world.groundHeight(to.x, to.z), this.world.waterLevel - 0.25);
          this.hop = { from: this.pos.clone(), to, t: 0, dur: 2.5 };
          this.heading = a;
        }
      }
      if (this.hop) {
        this.hop.t += dt / this.hop.dur;
        this.pos.lerpVectors(this.hop.from, this.hop.to, Math.min(1, this.hop.t));
        if (this.hop.t >= 1) this.hop = null;
      }
    }
  }

  updateHover(dt, pose) {
    pose.fold = 0; pose.legs = false; pose.blur = true;
    this.flapPhase = (this.flapPhase || 0) + dt * 50 * Math.PI * 2;
    pose.flap = Math.sin(this.flapPhase) * 1.1;
    pose.pitch = 0.9;
    pose.bank = 0;
    const base = this.perch.pos;
    this.pos.set(base.x + Math.sin(this.t * 3.1) * 0.03, base.y + Math.sin(this.t * 4.7) * 0.03, base.z + Math.cos(this.t * 2.3) * 0.03);
    this.lookAround(dt, pose, 2);
    this.peckT = 0.5;
    if (this.nextMove > 4) this.nextMove = Math.min(this.nextMove, 3 + this.rng() * 5);
  }

  updateTrunk(dt, pose, ctx) {
    const p = this.perch;
    pose.fold = 1; pose.legs = true; pose.flap = 0; pose.bank = 0;
    pose.pitch = 1.35;
    this.heading = Math.atan2(-p.normal.x, -p.normal.z);
    if (this.drumT > 0) {
      this.drumT -= dt;
      pose.headPitch = Math.sin(this.t * 90) * 0.2 + 0.1;
    } else {
      this.lookAround(dt, pose, 0.8);
      pose.headYaw *= 0.5;
      if (this.rng() < dt * 0.12) {
        this.drumT = 1.1;
        if (ctx.audio && this.pos.distanceTo(ctx.player.pos) < 120) ctx.audio.drum(this.pos);
      }
      if (this.rng() < dt * 0.5 && this.pos.y < p.top) {
        this.pos.y += 0.08 + this.rng() * 0.08;
      }
    }
  }
}

// ---------------------------------------------------------------- flock manager

export class Flock {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.birds = [];
    for (const sp of SPECIES) {
      let leader = null;
      for (let i = 0; i < sp.count; i++) {
        const variant = pickVariant(sp, i);
        const b = new Bird(sp, variant, world, { leader });
        if (sp.flocks && !leader) leader = b;
        this.birds.push(b);
        scene.add(b.root);
        if (!b.active) continue;
        const start = b.pickPerch();
        if (start) b.place(start);
        else b.place({ kind: 'lawn', pos: world.randomGroundPoint(b.rng) });
      }
    }
  }

  byId(id) { return this.birds.find((b) => b.sp.id === id); }

  activateAlert(id) {
    const b = this.byId(id);
    if (!b) return null;
    b.active = true;
    b.root.visible = true;
    const p = b.pickPerch();
    if (p) b.place(p);
    return b;
  }

  update(dt, ctx) {
    for (const b of this.birds) b.update(dt, ctx);
  }
}

function pickVariant(sp, i) {
  if (sp.variants.length === 1) return sp.variants[0];
  return sp.variants[i % sp.variants.length];
}
