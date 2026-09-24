// The Big Day map: a backyard, meadow, pond and woods at the edge of an
// eastern North American town in May. Everything is generated at load.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise2D, fbm, mulberry32, smoothstep, clamp, lerp } from './noise.js';

const TAU = Math.PI * 2;
const noiseA = makeNoise2D(11);
const noiseB = makeNoise2D(23);
const noiseC = makeNoise2D(37);

export const WATER_LEVEL = 0.0;
const POND = { x: 40, z: -32, r: 14 };
const YARD = { x: -6, z: 6, r: 24 };
const MEADOW = { x: 26, z: -4, r: 34 };
const PINES = { x: -52, z: -46, r: 15 };
const HOUSE = { x: -21, z: 10, w: 10, d: 8, rot: 0 };
const FEEDER = { x: -6, z: 3 };
const BIRDBATH = { x: -1, z: 12 };
const SNAG = { x: 14, z: -42 };
const PATH = [[-15.5, 9], [-9, 5], [-2, -1], [5, -8], [9, -14], [16, -20], [25, -25], [28, -24]];
const PATH2 = [[16, -20], [8, -34], [-4, -52], [-18, -70], [-30, -92]];

export const WIND = { uTime: { value: 0 }, uWind: { value: 1 } };
export const SUN_UNIFORMS = { uSunView: { value: new THREE.Vector3(0, 0, 1) }, uSunColor: { value: new THREE.Color(1, 0.8, 0.6) } };

// ---------------------------------------------------------------- helpers

function pondRadius(angle) {
  return POND.r + 2.5 * Math.sin(3 * angle + 1) + 1.5 * Math.sin(5 * angle + 2);
}

function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

function pathDist(x, z) {
  return Math.min(distToPolyline(x, z, PATH), distToPolyline(x, z, PATH2));
}

function baseHeight(x, z) {
  let h = 1.6 * fbm(noiseA, x / 70, z / 70, 4) + 0.3 * fbm(noiseB, x / 14, z / 14, 3) + 0.55;
  const r = Math.hypot(x, z);
  h += Math.max(0, r - 100) * 0.09 + Math.max(0, r - 150) * 0.12;
  const yd = Math.hypot(x - YARD.x, z - YARD.z);
  h = lerp(h, 0.55 + 0.05 * noiseC(x / 9, z / 9), 1 - smoothstep(16, 34, yd));
  const hd = Math.hypot(x - HOUSE.x, z - HOUSE.z);
  h = lerp(h, 0.6, 1 - smoothstep(6, 12, hd));
  return h;
}

export function terrainHeight(x, z) {
  let h = baseHeight(x, z);
  const dx = x - POND.x, dz = z - POND.z;
  const d = Math.hypot(dx, dz);
  const rr = pondRadius(Math.atan2(dz, dx));
  if (d < rr + 8) {
    const inner = clamp(1 - d / rr, 0, 1);
    const bottom = WATER_LEVEL - 0.12 - 1.5 * Math.pow(inner, 0.7);
    const edge = smoothstep(rr, rr + 8, d);
    h = lerp(Math.min(bottom, WATER_LEVEL - 0.12), Math.max(h, WATER_LEVEL + 0.15), edge);
    if (d < rr) h = bottom;
  }
  return h;
}

function zones(x, z) {
  const yd = Math.hypot(x - YARD.x, z - YARD.z);
  const md = Math.hypot(x - MEADOW.x, z - MEADOW.z);
  const r = Math.hypot(x, z + 5);
  const pd = Math.hypot(x - POND.x, z - POND.z);
  const pineD = Math.hypot(x - PINES.x, z - PINES.z);
  const lawn = 1 - smoothstep(YARD.r - 4, YARD.r + 2, yd);
  let woods = smoothstep(56, 66, r);
  woods = Math.max(woods, 1 - smoothstep(PINES.r, PINES.r + 6, pineD));
  woods = Math.max(woods, 1 - smoothstep(12, 18, Math.hypot(x + 40, z + 14)));
  woods *= 1 - lawn;
  const meadow = (1 - lawn) * (1 - woods) * (1 - smoothstep(MEADOW.r + 10, MEADOW.r + 24, md) * 0.3);
  const path = 1 - smoothstep(0.5, 1.3, pathDist(x, z));
  const pond = 1 - smoothstep(pondRadius(Math.atan2(z - POND.z, x - POND.x)) - 1, pondRadius(Math.atan2(z - POND.z, x - POND.x)) + 2.5, pd);
  return { lawn, woods, meadow, path, pond };
}

function canvasTex(w, h, draw, { repeat = null, color = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function heightToNormal(srcCanvas, strength = 2) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const src = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  const out = g.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function noiseCanvas(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = clamp(fn(x, y), 0, 1) * 255;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// Value noise on a wrapping lattice, so tiled textures have no seams.
function hash2(i, j, seed) {
  let h = (i * 374761393 + j * 668265263 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function tileNoise(seed, x, y, w, h, cellsX, cellsY = cellsX) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    const cx = cellsX << o, cy = cellsY << o;
    const fx = (x / w) * cx, fy = (y / h) * cy;
    const i = Math.floor(fx), j = Math.floor(fy);
    let u = fx - i, v = fy - j;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    const s = seed + o * 17;
    const a = hash2(i % cx, j % cy, s), b = hash2((i + 1) % cx, j % cy, s);
    const c = hash2(i % cx, (j + 1) % cy, s), d = hash2((i + 1) % cx, (j + 1) % cy, s);
    sum += amp * ((a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v);
    norm += amp;
    amp *= 0.5;
  }
  return (sum / norm) * 2 - 1;
}

// Wind sway for instanced foliage and grass, driven by a per-vertex weight.
function addWind(material, attr, amp) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = WIND.uTime;
    shader.uniforms.uWind = WIND.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uWind;\nattribute float ${attr};`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wpW = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 wpW = modelMatrix * vec4(position, 1.0);
        #endif
        float wk = ${attr} * ${attr} * uWind;
        float gust = 0.6 + 0.4 * sin(uTime * 0.35 + wpW.x * 0.02);
        transformed.x += sin(uTime * 1.7 + wpW.x * 0.35 + wpW.z * 0.21) * ${amp.toFixed(3)} * wk * gust;
        transformed.z += cos(uTime * 1.3 + wpW.x * 0.18 + wpW.z * 0.37) * ${(amp * 0.7).toFixed(3)} * wk * gust;
        transformed.y += sin(uTime * 2.3 + wpW.z * 0.5) * ${(amp * 0.2).toFixed(3)} * wk;`);
  };
}

// Leaves glow when the sun is behind them.
function addTranslucency(material, strength = 0.55) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    shader.uniforms.uSunView = SUN_UNIFORMS.uSunView;
    shader.uniforms.uSunColor = SUN_UNIFORMS.uSunColor;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunView;\nuniform vec3 uSunColor;')
      .replace('#include <opaque_fragment>', `
        float trans = pow(max(dot(-normalize(vViewPosition), uSunView), 0.0), 5.0);
        outgoingLight += diffuseColor.rgb * uSunColor * trans * ${strength.toFixed(2)};
        #include <opaque_fragment>`);
  };
}

// ---------------------------------------------------------------- foliage atlas

const ATLAS_COLS = 4, ATLAS_ROWS = 2, TILE = 512;
const TILES = { oak: 0, fresh: 1, dogwood: 2, redbud: 3, pine: 4, cedar: 5, viburnum: 6, shrub: 7 };

function leafShape(g, x, y, len, wid, ang, fill, rib) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(wid, len * 0.35, 0, len);
  g.quadraticCurveTo(-wid, len * 0.35, 0, 0);
  g.fillStyle = fill;
  g.fill();
  if (rib) {
    g.strokeStyle = rib;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, len * 0.9);
    g.stroke();
  }
  g.restore();
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return '#' + c.getHexString();
}

function drawSpray(g, ox, oy, rnd, opt) {
  const cx = ox + TILE / 2, base = oy + TILE * 0.95;
  const twigs = [];
  const twigCount = opt.twigs || 5;
  for (let t = 0; t < twigCount; t++) {
    const a = -Math.PI / 2 + (t / (twigCount - 1) - 0.5) * 1.7 + (rnd() - 0.5) * 0.3;
    const len = TILE * (0.35 + rnd() * 0.25);
    const sx = cx + (rnd() - 0.5) * 40;
    const sy = base - rnd() * 60;
    twigs.push({ sx, sy, ex: sx + Math.cos(a) * len, ey: sy + Math.sin(a) * len });
  }
  g.lineCap = 'round';
  for (const tw of twigs) {
    g.strokeStyle = opt.twig || '#4d3b2a';
    g.lineWidth = opt.twigWidth || 3;
    g.beginPath();
    g.moveTo(tw.sx, tw.sy);
    g.quadraticCurveTo((tw.sx + tw.ex) / 2 + (rnd() - 0.5) * 40, (tw.sy + tw.ey) / 2, tw.ex, tw.ey);
    g.stroke();
  }
  const inTile = (x, y, m = 26) => x > ox + m && x < ox + TILE - m && y > oy + m && y < oy + TILE - m;
  for (const tw of twigs) {
    const n = opt.perTwig || 14;
    for (let i = 0; i < n; i++) {
      const t = 0.15 + (i / n) * 0.9;
      const x = lerp(tw.sx, tw.ex, t) + (rnd() - 0.5) * 16;
      const y = lerp(tw.sy, tw.ey, t) + (rnd() - 0.5) * 16;
      opt.leaf(g, x, y, rnd, inTile, Math.atan2(tw.ey - tw.sy, tw.ex - tw.sx));
    }
  }
}

function buildFoliageAtlas() {
  const W = TILE * ATLAS_COLS, H = TILE * ATLAS_ROWS;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const rnd = mulberry32(4242);
  const tileOrigin = (i) => [(i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE];
  const avg = {};

  const broadleaf = (greens, lenR, widR) => (gg, x, y, r, inTile, dirA) => {
    for (let k = 0; k < 3; k++) {
      const a = dirA + Math.PI / 2 + (r() - 0.5) * 2.6 + (k - 1) * 0.9 - Math.PI / 2;
      const len = lenR[0] + r() * (lenR[1] - lenR[0]);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      if (!inTile(x, y) || !inTile(ex, ey)) continue;
      const base = greens[Math.floor(r() * greens.length)];
      leafShape(gg, x, y, len, len * widR, a - Math.PI / 2, shade(base, (r() - 0.5) * 0.08), shade(base, -0.1));
    }
  };

  // oak / maple: deep green
  {
    const [ox, oy] = tileOrigin(TILES.oak);
    drawSpray(g, ox, oy, rnd, { twigs: 6, perTwig: 16, leaf: broadleaf(['#3f6a2c', '#4b7a32', '#355c26', '#58843a'], [34, 52], 0.55) });
    avg.oak = '#44702f';
  }
  // fresh spring green (young leaves)
  {
    const [ox, oy] = tileOrigin(TILES.fresh);
    drawSpray(g, ox, oy, rnd, { twigs: 6, perTwig: 16, leaf: broadleaf(['#7aa743', '#8db84f', '#6c9a3a', '#9dc25c'], [30, 46], 0.6) });
    avg.fresh = '#82ae48';
  }
  // flowering dogwood: leaves plus four-bract white blossoms
  {
    const [ox, oy] = tileOrigin(TILES.dogwood);
    drawSpray(g, ox, oy, rnd, {
      twigs: 5, perTwig: 12, twig: '#5a4a3c',
      leaf: (gg, x, y, r, inTile, dirA) => {
        broadleaf(['#5f8d3e', '#6f9a45'], [26, 36], 0.6)(gg, x, y, r, inTile, dirA);
        if (r() < 0.55 && inTile(x, y, 50)) {
          const rot = r() * TAU;
          for (let p = 0; p < 4; p++) {
            const a = rot + p * Math.PI / 2;
            gg.save();
            gg.translate(x, y);
            gg.rotate(a);
            gg.fillStyle = shade('#f4f1e6', (r() - 0.5) * 0.04);
            gg.beginPath();
            gg.ellipse(0, 15, 11, 16, 0, 0, TAU);
            gg.fill();
            gg.fillStyle = '#b9837a';
            gg.beginPath();
            gg.ellipse(0, 29, 3, 2, 0, 0, TAU);
            gg.fill();
            gg.restore();
          }
          gg.fillStyle = '#a8b04a';
          gg.beginPath();
          gg.arc(x, y, 5, 0, TAU);
          gg.fill();
        }
      },
    });
    avg.dogwood = '#9fb07a';
  }
  // redbud: magenta blossoms along bare twigs
  {
    const [ox, oy] = tileOrigin(TILES.redbud);
    drawSpray(g, ox, oy, rnd, {
      twigs: 7, perTwig: 22, twig: '#3e2f28', twigWidth: 2.5,
      leaf: (gg, x, y, r, inTile) => {
        for (let k = 0; k < 4; k++) {
          const px = x + (r() - 0.5) * 22, py = y + (r() - 0.5) * 22;
          if (!inTile(px, py)) continue;
          gg.fillStyle = ['#c24d8c', '#d9679f', '#b23f7c', '#e38ab8'][Math.floor(r() * 4)];
          gg.beginPath();
          gg.ellipse(px, py, 5 + r() * 3, 4 + r() * 2, r() * TAU, 0, TAU);
          gg.fill();
        }
        if (r() < 0.12 && inTile(x, y, 40)) {
          gg.fillStyle = '#8fae52';
          gg.beginPath();
          gg.arc(x - 6, y, 11, 0, TAU);
          gg.arc(x + 6, y, 11, 0, TAU);
          gg.fill();
        }
      },
    });
    avg.redbud = '#c55a92';
  }
  // white pine: soft bundles of long blue-green needles
  {
    const [ox, oy] = tileOrigin(TILES.pine);
    drawSpray(g, ox, oy, rnd, {
      twigs: 7, perTwig: 16, twig: '#4a3a2c', twigWidth: 3,
      leaf: (gg, x, y, r, inTile, dirA) => {
        const greens = ['#355a4a', '#3f6655', '#2d4d40', '#4d7563'];
        for (let n = 0; n < 7; n++) {
          const a = dirA + (r() - 0.5) * 1.6;
          const len = 34 + r() * 26;
          const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
          if (!inTile(ex, ey, 18) || !inTile(x, y, 18)) continue;
          gg.strokeStyle = greens[Math.floor(r() * greens.length)];
          gg.lineWidth = 1.6;
          gg.beginPath();
          gg.moveTo(x, y);
          gg.quadraticCurveTo((x + ex) / 2 + (r() - 0.5) * 6, (y + ey) / 2, ex, ey);
          gg.stroke();
        }
      },
    });
    avg.pine = '#3a604f';
  }
  // eastern red cedar: dense scaly sprays
  {
    const [ox, oy] = tileOrigin(TILES.cedar);
    drawSpray(g, ox, oy, rnd, {
      twigs: 8, perTwig: 26, twig: '#3b3226', twigWidth: 2,
      leaf: (gg, x, y, r, inTile, dirA) => {
        for (let k = 0; k < 5; k++) {
          const a = dirA + (r() - 0.5) * 1.2;
          const px = x + Math.cos(a) * k * 5, py = y + Math.sin(a) * k * 5;
          if (!inTile(px, py)) continue;
          gg.fillStyle = ['#2e4a30', '#36563a', '#28422b', '#415f3e'][Math.floor(r() * 4)];
          gg.beginPath();
          gg.ellipse(px, py, 7, 4, a, 0, TAU);
          gg.fill();
        }
      },
    });
    avg.cedar = '#324f34';
  }
  // viburnum shrub with white flower clusters
  {
    const [ox, oy] = tileOrigin(TILES.viburnum);
    drawSpray(g, ox, oy, rnd, {
      twigs: 6, perTwig: 16,
      leaf: (gg, x, y, r, inTile, dirA) => {
        broadleaf(['#4f7a36', '#5c8a3e', '#46702f'], [24, 34], 0.7)(gg, x, y, r, inTile, dirA);
        if (r() < 0.2 && inTile(x, y, 40)) {
          for (let k = 0; k < 16; k++) {
            gg.fillStyle = shade('#f2efe0', (r() - 0.5) * 0.06);
            gg.beginPath();
            gg.arc(x + (r() - 0.5) * 26, y + (r() - 0.5) * 20, 4, 0, TAU);
            gg.fill();
          }
        }
      },
    });
    avg.viburnum = '#6f8d56';
  }
  // generic dark shrub
  {
    const [ox, oy] = tileOrigin(TILES.shrub);
    drawSpray(g, ox, oy, rnd, { twigs: 7, perTwig: 20, leaf: broadleaf(['#2f5426', '#3a622c', '#284a21', '#46703a'], [20, 30], 0.6) });
    avg.shrub = '#355d29';
  }

  // Bleed leaf colors into transparent pixels so mipmaps don't get dark halos.
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const avgKeys = Object.keys(TILES);
  for (let ty = 0; ty < ATLAS_ROWS; ty++) {
    for (let tx = 0; tx < ATLAS_COLS; tx++) {
      const key = avgKeys[ty * ATLAS_COLS + tx];
      const c = new THREE.Color(avg[key]);
      const r = Math.round(c.r * 255), gg = Math.round(c.g * 255), b = Math.round(c.b * 255);
      for (let y = ty * TILE; y < (ty + 1) * TILE; y++) {
        for (let x = tx * TILE; x < (tx + 1) * TILE; x++) {
          const i = (y * W + x) * 4;
          if (d[i + 3] < 128) { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 0; }
          else d[i + 3] = 255;
        }
      }
    }
  }
  const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  tex.flipY = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function tileUV(tile) {
  const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
  const u0 = col / ATLAS_COLS, u1 = (col + 1) / ATLAS_COLS;
  const v1 = 1 - row / ATLAS_ROWS, v0 = 1 - (row + 1) / ATLAS_ROWS;
  return [u0, v0, u1, v1];
}

// ---------------------------------------------------------------- tree generator

class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.w = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  build(withColor = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(this.w, 1));
    if (withColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// Tapered branch as a ring-segmented tube along a list of points.
function addTube(B, pts, r0, r1, windW0, windW1, radial = 7) {
  const n = pts.length;
  const base = B.count;
  const up = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3(), side = new THREE.Vector3(), bin = new THREE.Vector3();
  let vAcc = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (i < n - 1) tan.subVectors(pts[i + 1], p).normalize();
    else tan.subVectors(p, pts[i - 1]).normalize();
    side.crossVectors(tan, Math.abs(tan.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up).normalize();
    bin.crossVectors(side, tan).normalize();
    const t = i / (n - 1);
    const r = lerp(r0, r1, t);
    if (i > 0) vAcc += pts[i].distanceTo(pts[i - 1]);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const nx = side.x * Math.cos(a) + bin.x * Math.sin(a);
      const ny = side.y * Math.cos(a) + bin.y * Math.sin(a);
      const nz = side.z * Math.cos(a) + bin.z * Math.sin(a);
      B.pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      B.nor.push(nx, ny, nz);
      B.uv.push((j / radial) * Math.max(1, Math.round(r * 8)), vAcc / 1.2);
      B.w.push(lerp(windW0, windW1, t));
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = base + i * (radial + 1) + j, b = a + radial + 1;
      B.idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
}

function addCard(B, center, size, normal, spin, tile, crownCenter, windW, rnd, stretch = 1) {
  const [u0, v0, u1, v1] = tileUV(tile);
  const nrm = normal.clone().normalize();
  const t1 = new THREE.Vector3().crossVectors(nrm, Math.abs(nrm.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
  const t2 = new THREE.Vector3().crossVectors(nrm, t1).normalize();
  const c = Math.cos(spin), s = Math.sin(spin);
  const ax = t1.clone().multiplyScalar(c).addScaledVector(t2, s).multiplyScalar(size * 0.5 * stretch);
  const ay = t2.clone().multiplyScalar(c).addScaledVector(t1, -s).multiplyScalar(size * 0.5);
  const base = B.count;
  const corners = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]];
  for (const [x, y, u, v] of corners) {
    const p = center.clone().addScaledVector(ax, x).addScaledVector(ay, y);
    const sn = p.clone().sub(crownCenter).normalize().multiplyScalar(0.75).addScaledVector(nrm, 0.25).normalize();
    B.pos.push(p.x, p.y, p.z);
    B.nor.push(sn.x, sn.y, sn.z);
    B.uv.push(u, v);
    B.w.push(windW);
    const k = 0.85 + rnd() * 0.3;
    B.col.push(k, k, k);
  }
  B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function randomDir(rnd) {
  const u = rnd() * 2 - 1, a = rnd() * TAU;
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a));
}

function makeTree(type, seed) {
  const rnd = mulberry32(seed);
  const bark = new GeoBuilder();
  const leaf = new GeoBuilder();
  const perches = [];
  const clusters = [];
  let trunkR = 0.3, height = 10;

  const branch = (start, dir, len, r, depth, opts) => {
    const pts = [start.clone()];
    const segs = Math.max(2, Math.round(len / 0.9));
    const d = dir.clone();
    let p = start.clone();
    for (let i = 1; i <= segs; i++) {
      d.add(new THREE.Vector3((rnd() - 0.5) * 0.25, opts.gravity * 0.1 + (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.25)).normalize();
      p = p.clone().addScaledVector(d, len / segs);
      pts.push(p);
    }
    const r1 = r * opts.taper;
    addTube(bark, pts, r, r1, opts.windBase + depth * 0, opts.windBase + 0.3, depth > 1 ? 6 : 5);
    if (depth <= 0 || r1 < opts.minR) {
      clusters.push({ c: p.clone(), s: opts.clusterSize * (0.8 + rnd() * 0.4) });
      return;
    }
    const kids = opts.kids[0] + Math.floor(rnd() * (opts.kids[1] - opts.kids[0] + 1));
    for (let k = 0; k < kids; k++) {
      const t = k === 0 ? 1 : 0.45 + rnd() * 0.5;
      const idx = Math.min(pts.length - 1, Math.round(t * (pts.length - 1)));
      const from = pts[idx];
      const nd = dir.clone().add(randomDir(rnd).multiplyScalar(opts.spread)).add(new THREE.Vector3(0, opts.rise, 0)).normalize();
      branch(from, nd, len * (opts.lenK[0] + rnd() * (opts.lenK[1] - opts.lenK[0])), r1 * (0.75 + rnd() * 0.2), depth - 1, opts);
    }
  };

  const crownCenter = new THREE.Vector3();
  let tile = TILES.oak;
  let cardsPerCluster = 7, cardSize = 1.25;

  if (type === 'oak' || type === 'maple' || type === 'dogwood' || type === 'redbud') {
    const big = type === 'oak' || type === 'maple';
    trunkR = big ? 0.32 + rnd() * 0.18 : 0.12 + rnd() * 0.05;
    const trunkH = big ? 3 + rnd() * 2.5 : 1.1 + rnd() * 0.5;
    tile = type === 'oak' ? TILES.oak : type === 'maple' ? TILES.fresh : type === 'dogwood' ? TILES.dogwood : TILES.redbud;
    const lean = new THREE.Vector3((rnd() - 0.5) * 0.15, 1, (rnd() - 0.5) * 0.15).normalize();
    const top = lean.clone().multiplyScalar(trunkH);
    addTube(bark, [new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, trunkH * 0.5, 0).addScaledVector(lean, 0.1), top], trunkR * 1.15, trunkR * 0.8, 0, 0.05, 9);
    const limbs = big ? 4 + Math.floor(rnd() * 2) : 4;
    const opts = big
      ? { gravity: -0.05, taper: 0.6, minR: 0.035, kids: [2, 3], spread: 0.75, rise: 0.25, lenK: [0.6, 0.78], clusterSize: 1.5, windBase: 0.1 }
      : { gravity: -0.1, taper: 0.55, minR: 0.02, kids: [2, 3], spread: 0.8, rise: 0.05, lenK: [0.6, 0.8], clusterSize: 1.1, windBase: 0.15 };
    for (let i = 0; i < limbs; i++) {
      const a = (i / limbs) * TAU + rnd() * 0.6;
      const dir = new THREE.Vector3(Math.cos(a) * (big ? 0.6 : 0.9), big ? 0.85 : 0.45, Math.sin(a) * (big ? 0.6 : 0.9)).normalize();
      branch(top.clone().addScaledVector(lean, -rnd() * trunkH * 0.25), dir, big ? 3.2 + rnd() * 1.5 : 1.4 + rnd() * 0.6, trunkR * 0.6, big ? 3 : 2, opts);
    }
    cardsPerCluster = big ? 8 : 6;
    cardSize = big ? 1.5 : 1.05;
  } else if (type === 'pine') {
    trunkR = 0.3 + rnd() * 0.12;
    height = 15 + rnd() * 6;
    tile = TILES.pine;
    addTube(bark, [new THREE.Vector3(0, -0.3, 0), new THREE.Vector3((rnd() - 0.5) * 0.3, height * 0.5, 0), new THREE.Vector3((rnd() - 0.5) * 0.5, height, (rnd() - 0.5) * 0.5)], trunkR, 0.05, 0, 0.3, 8);
    for (let y = 3.5 + rnd(); y < height - 0.5; y += 1.0 + rnd() * 0.6) {
      const whorl = 4 + Math.floor(rnd() * 2);
      const k = 1 - (y / height);
      const bl = 1 + k * 4.2 + rnd() * 0.8;
      for (let i = 0; i < whorl; i++) {
        if (rnd() < 0.2) continue;
        const a = (i / whorl) * TAU + rnd();
        const dir = new THREE.Vector3(Math.cos(a), 0.12 + rnd() * 0.15, Math.sin(a)).normalize();
        const start = new THREE.Vector3(0, y, 0);
        const end = start.clone().addScaledVector(dir, bl);
        addTube(bark, [start, start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, -0.1, 0)), end], 0.07 * (0.5 + k), 0.02, 0.1, 0.6, 5);
        for (let c = 0.35; c <= 1.0; c += 0.3) {
          clusters.push({ c: start.clone().lerp(end, c).add(new THREE.Vector3(0, 0.15, 0)), s: 1.3, flat: true });
        }
        if (y > 5 && y < 11 && rnd() < 0.3) perches.push({ kind: 'pine', pos: start.clone().addScaledVector(dir, 0.5 + rnd() * 0.5).add(new THREE.Vector3(0, 0.06, 0)) });
      }
    }
    clusters.push({ c: new THREE.Vector3(0, height, 0), s: 1.2 });
    cardsPerCluster = 5;
    cardSize = 1.5;
  } else if (type === 'cedar') {
    trunkR = 0.16;
    height = 5 + rnd() * 3;
    tile = TILES.cedar;
    addTube(bark, [new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, height, 0)], trunkR, 0.03, 0, 0.3, 6);
    for (let y = 0.6; y < height; y += 0.45) {
      const k = 1 - y / height;
      const rad = 0.3 + k * 1.6;
      const n = 3 + Math.floor(k * 4);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU;
        clusters.push({ c: new THREE.Vector3(Math.cos(a) * rad * 0.6, y, Math.sin(a) * rad * 0.6), s: 0.8 + k * 0.6 });
      }
    }
    cardsPerCluster = 4;
    cardSize = 1.0;
  } else if (type === 'snag') {
    trunkR = 0.38;
    height = 10.5;
    addTube(bark, [new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.1, 4, 0), new THREE.Vector3(-0.2, 8, 0.1), new THREE.Vector3(-0.1, height, 0.2)], trunkR, 0.14, 0, 0, 9);
    const stubs = [[3.4, 0.4, 1.6], [5.5, 2.4, 2.2], [7.2, 4.2, 1.5], [8.6, 1.2, 1.1]];
    for (const [y, a, len] of stubs) {
      const dir = new THREE.Vector3(Math.cos(a), 0.35, Math.sin(a)).normalize();
      const s = new THREE.Vector3(0, y, 0);
      const e = s.clone().addScaledVector(dir, len);
      addTube(bark, [s, e], 0.09, 0.04, 0, 0, 6);
      perches.push({ kind: 'snag', pos: e.clone().add(new THREE.Vector3(0, 0.04, 0)) });
    }
    perches.push({ kind: 'snag', pos: new THREE.Vector3(-0.1, height + 0.02, 0.2) });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.3;
      const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      perches.push({ kind: 'trunk', pos: new THREE.Vector3(0, 2 + i * 0.9, 0).addScaledVector(n, trunkR * 0.75), normal: n, top: 8 });
    }
  } else if (type === 'shrub' || type === 'viburnum') {
    tile = type === 'shrub' ? TILES.shrub : TILES.viburnum;
    trunkR = 0;
    const R = 1.1 + rnd() * 0.7;
    height = R * 1.5;
    for (let i = 0; i < 6; i++) {
      const a = rnd() * TAU;
      const dir = new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize();
      addTube(bark, [new THREE.Vector3(0, -0.1, 0), dir.clone().multiplyScalar(R * 0.7), dir.clone().multiplyScalar(R * 1.2)], 0.035, 0.012, 0, 0.4, 4);
    }
    for (let i = 0; i < 16; i++) {
      const d = randomDir(rnd);
      d.y = Math.abs(d.y) * 0.9 + 0.1;
      clusters.push({ c: new THREE.Vector3(d.x * R * 0.75, d.y * R * 0.9 + 0.2, d.z * R * 0.75), s: 0.9 });
    }
    for (let i = 0; i < 6; i++) {
      const a = rnd() * TAU, h = R * (0.5 + rnd() * 0.6);
      const p = new THREE.Vector3(Math.cos(a) * R * 1.12, h, Math.sin(a) * R * 1.12);
      addTube(bark, [new THREE.Vector3(0, h * 0.5, 0), p, p.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3))], 0.02, 0.006, 0.05, 0.1, 4);
      perches.push({ kind: 'shrub', pos: p.clone().add(new THREE.Vector3(0, 0.015, 0)) });
    }
    crownCenter.set(0, R * 0.5, 0);
    cardsPerCluster = 7;
    cardSize = 0.85;
  }

  // Leaf cards.
  if (clusters.length) {
    if (type !== 'shrub' && type !== 'viburnum') {
      for (const c of clusters) crownCenter.add(c.c);
      crownCenter.divideScalar(clusters.length);
    }
    let maxY = 0;
    for (const cl of clusters) {
      maxY = Math.max(maxY, cl.c.y);
      for (let k = 0; k < cardsPerCluster; k++) {
        const off = randomDir(rnd).multiplyScalar(cl.s * 0.45);
        if (cl.flat) off.y *= 0.3;
        const center = cl.c.clone().add(off);
        const n = cl.flat ? new THREE.Vector3((rnd() - 0.5) * 0.8, 1, (rnd() - 0.5) * 0.8) : randomDir(rnd);
        addCard(leaf, center, cardSize * (0.8 + rnd() * 0.4) * (cl.s / 1.3 + 0.3), n, rnd() * TAU, tile, crownCenter, 0.6 + (center.y / Math.max(4, height)) * 0.4, rnd, cl.flat ? 1.3 : 1);
      }
    }
    height = Math.max(height, maxY + 0.8);
    if (type !== 'pine' && type !== 'cedar' && type !== 'shrub' && type !== 'viburnum') {
      // Exposed perches on bare twigs: one poking above the crown (a song
      // perch) and several hanging below the outer clusters.
      const sorted = clusters.slice().sort((a, b) => b.c.y - a.c.y);
      const top = sorted[0];
      const tp = top.c.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.4, top.s * 0.5 + 0.9, (rnd() - 0.5) * 0.4));
      addTube(bark, [top.c.clone(), top.c.clone().lerp(tp, 0.5).add(new THREE.Vector3(0.1, 0, 0.05)), tp, tp.clone().add(new THREE.Vector3(0.05, 0.3, 0))], 0.035, 0.006, 0.05, 0.1, 4);
      perches.push({ kind: 'treetop', pos: tp.clone().add(new THREE.Vector3(0, 0.02, 0)) });
      for (let i = 0; i < clusters.length; i += 3) {
        const cl = clusters[i];
        const out = cl.c.clone().sub(crownCenter).setY(0).normalize();
        const p = cl.c.clone().addScaledVector(out, 0.7).add(new THREE.Vector3(0, -(cl.s * 0.5 + 0.75), 0));
        if (p.y < 1.4) continue;
        const end = p.clone().addScaledVector(out, 0.4).add(new THREE.Vector3(0, 0.05, 0));
        addTube(bark, [cl.c.clone(), cl.c.clone().lerp(p, 0.6), p, end], 0.03, 0.006, 0.05, 0.1, 4);
        perches.push({ kind: 'canopy', pos: p.clone().add(new THREE.Vector3(0, 0.02, 0)) });
      }
      if (trunkR > 0.25) {
        for (let i = 0; i < 2; i++) {
          const a = rnd() * TAU;
          const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
          perches.push({ kind: 'trunk', pos: new THREE.Vector3(0, 1.6 + rnd() * 1.2, 0).addScaledVector(n, trunkR * 0.9), normal: n, top: 3.6 });
        }
      }
    }
    if (type === 'cedar') {
      for (let i = 0; i < 3; i++) {
        const a = rnd() * TAU, y = 1.5 + rnd() * (height - 2.5);
        const rad = (0.3 + (1 - y / height) * 1.6) * 0.95 + 0.3;
        const p = new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
        addTube(bark, [new THREE.Vector3(0, y - 0.2, 0), p, p.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3))], 0.025, 0.006, 0.05, 0.1, 4);
        perches.push({ kind: 'canopy', pos: p.clone().add(new THREE.Vector3(0, 0.015, 0)) });
      }
    }
    if (type === 'pine') perches.push({ kind: 'treetop', pos: new THREE.Vector3(0, height - 0.3, 0) });
  }

  return {
    barkGeo: bark.build(false),
    leafGeo: clusters.length ? leaf.build(true) : null,
    perches, clusters, trunkR, height, type,
  };
}

// ---------------------------------------------------------------- world

export class World {
  constructor(scene, renderer, { grassCount = 20000 } = {}) {
    this.grassCount = grassCount;
    this.scene = scene;
    this.renderer = renderer;
    this.waterLevel = WATER_LEVEL;
    this.pond = POND;
    this.skyCenter = new THREE.Vector3(10, 0, -20);
    this.perches = {};
    this.trunks = [];
    this.leafClusters = [];
    this.solids = [];
    this.rng = mulberry32(1234);
    this.landmarks = [
      { name: 'House', pos: new THREE.Vector3(HOUSE.x, 0, HOUSE.z) },
      { name: 'Feeders', pos: new THREE.Vector3(FEEDER.x, 0, FEEDER.z) },
      { name: 'Pond', pos: new THREE.Vector3(POND.x, 0, POND.z) },
      { name: 'Meadow', pos: new THREE.Vector3(MEADOW.x, 0, MEADOW.z + 6) },
      { name: 'Pines', pos: new THREE.Vector3(PINES.x, 0, PINES.z) },
      { name: 'Snag', pos: new THREE.Vector3(SNAG.x, 0, SNAG.z) },
    ];

    this.buildTextures();
    this.buildSky();
    this.buildTerrain();
    this.buildWater();
    this.buildTrees();
    this.buildGrass();
    this.buildFlowers();
    this.buildCattails();
    this.buildHouse();
    this.buildFeeders();
    this.buildFence();
    this.buildRocks();
    this.buildTreeline();
    this.buildAtmosphere();
    this.buildGroundPerches();
    this.buildHeroBranch();
  }

  addPerch(p) {
    p.occupant = null;
    (this.perches[p.kind] ||= []).push(p);
  }

  // ---------------------------------------------------------- textures
  buildTextures() {
    const barkH = noiseCanvas(256, 512, (x, y) => {
      const v = tileNoise(1, x, y, 256, 512, 16, 4) * 0.5 + 0.5;
      const ridge = Math.abs(tileNoise(2, x, y, 256, 512, 10, 2));
      return 0.25 + v * 0.35 + (1 - ridge) * 0.4;
    });
    const tint = (cv, dark, light) => {
      const c2 = document.createElement('canvas');
      c2.width = cv.width;
      c2.height = cv.height;
      const g = c2.getContext('2d');
      const src = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
      const a = new THREE.Color(dark), b = new THREE.Color(light);
      for (let i = 0; i < src.data.length; i += 4) {
        const t = src.data[i] / 255;
        src.data[i] = lerp(a.r, b.r, t) * 255;
        src.data[i + 1] = lerp(a.g, b.g, t) * 255;
        src.data[i + 2] = lerp(a.b, b.b, t) * 255;
      }
      g.putImageData(src, 0, 0);
      const tex = new THREE.CanvasTexture(c2);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    };
    this.barkMat = new THREE.MeshStandardMaterial({ map: tint(barkH, '#2a2119', '#7a6a58'), normalMap: heightToNormal(barkH, 5), roughness: 0.95 });
    this.snagMat = new THREE.MeshStandardMaterial({ map: tint(barkH, '#4d4842', '#b3aca2'), normalMap: this.barkMat.normalMap, roughness: 0.9 });
    this.pineBarkMat = new THREE.MeshStandardMaterial({ map: tint(barkH, '#2a1e18', '#6e5242'), normalMap: this.barkMat.normalMap, roughness: 0.95 });
    for (const m of [this.barkMat, this.snagMat, this.pineBarkMat]) addWind(m, 'aW', 0.05);

    this.atlas = buildFoliageAtlas();
    this.leafMat = new THREE.MeshStandardMaterial({ map: this.atlas, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.78, vertexColors: true });
    addWind(this.leafMat, 'aW', 0.09);
    addTranslucency(this.leafMat, 0.7);
    this.leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.atlas, alphaTest: 0.5 });

    const groundH = noiseCanvas(512, 512, (x, y) => 0.5 + 0.3 * tileNoise(3, x, y, 512, 512, 8) + 0.25 * tileNoise(4, x, y, 512, 512, 32));
    this.groundDetail = tint(groundH, '#8a8a8a', '#ffffff');
    this.groundDetail.repeat.set(90, 90);
    this.groundNormal = heightToNormal(groundH, 3);
    this.groundNormal.repeat.set(90, 90);
  }

  // ---------------------------------------------------------- sky
  buildSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(1800);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 5.5;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.86;
    this.scene.add(this.sky);

    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(50);
    Object.assign(this.envSky.material.uniforms.turbidity, { value: 5.5 });
    this.envSky.material.uniforms.rayleigh.value = 1.6;
    this.envSky.material.uniforms.mieCoefficient.value = 0.005;
    this.envSky.material.uniforms.mieDirectionalG.value = 0.86;
    this.envScene.add(this.envSky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2e3a22 }));
    ground.position.y = -2;
    this.envScene.add(ground);
    this.envGround = ground;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = null;

    this.sun = new THREE.DirectionalLight(0xffd8a8, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xa8c2dd, 0x3d4a2c, 0.35);
    this.scene.add(this.hemi);

    this.scene.fog = new THREE.FogExp2(0xc8b9a8, 0.011);
    this.sunDir = new THREE.Vector3();
    this.lastEnvElevation = -99;
  }

  setTimeOfDay(frac, force = false) {
    // May sunrise over the woods: low in the east-northeast, climbing south.
    const elevation = lerp(4, 36, frac);
    const azimuth = lerp(68, 118, frac);
    const el = THREE.MathUtils.degToRad(elevation), az = THREE.MathUtils.degToRad(azimuth);
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.envSky.material.uniforms.sunPosition.value.copy(this.sunDir);
    const warm = 1 - smoothstep(0, 0.6, frac);
    this.sun.color.setRGB(1, lerp(0.95, 0.74, warm), lerp(0.88, 0.52, warm));
    this.sun.intensity = lerp(3.4, 2.4, warm);
    SUN_UNIFORMS.uSunColor.value.copy(this.sun.color).multiplyScalar(lerp(1, 1.3, warm));
    this.hemi.intensity = lerp(0.3, 0.22, warm);
    this.scene.fog.color.setRGB(lerp(0.72, 0.8, warm), lerp(0.79, 0.72, warm), lerp(0.86, 0.64, warm));
    this.scene.fog.density = lerp(0.0055, 0.0115, warm);
    if (this.mist) for (const m of this.mist) m.material.opacity = m.userData.base * lerp(0.15, 1, warm);
    if (force || Math.abs(elevation - this.lastEnvElevation) > 1.5) {
      this.lastEnvElevation = elevation;
      const rt = this.pmrem.fromScene(this.envScene, 0.02);
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = 0.85;
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
    }
  }

  // ---------------------------------------------------------- terrain
  buildTerrain() {
    const S = 340, N = 240;
    this.tS = S;
    this.tN = N;
    const step = S / N;
    this.tStep = step;
    const heights = new Float32Array((N + 1) * (N + 1));
    const pos = [], nor = [], uv = [], col = [], idx = [];
    const cLawn = new THREE.Color(0x4d7a2c), cLawn2 = new THREE.Color(0x5f8a34);
    const cMeadow = new THREE.Color(0x7c8a3c), cMeadow2 = new THREE.Color(0x96934a);
    const cWoods = new THREE.Color(0x4a3a26), cMoss = new THREE.Color(0x46592a);
    const cPath = new THREE.Color(0x7a644a), cMud = new THREE.Color(0x3b3325);
    const c = new THREE.Color(), c2 = new THREE.Color();
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const x = -S / 2 + i * step, z = -S / 2 + j * step;
        const h = terrainHeight(x, z);
        heights[j * (N + 1) + i] = h;
        pos.push(x, h, z);
        uv.push(x / S, z / S);
        const zn = zones(x, z);
        const n1 = noiseB(x / 7, z / 7) * 0.5 + 0.5;
        const n2 = noiseC(x / 23, z / 23) * 0.5 + 0.5;
        c.copy(cMeadow).lerp(cMeadow2, n1);
        c2.copy(cLawn).lerp(cLawn2, n2);
        c.lerp(c2, zn.lawn);
        c2.copy(cWoods).lerp(cMoss, n1 * 0.7);
        c.lerp(c2, zn.woods);
        c.lerp(cPath, zn.path * 0.85);
        const wet = 1 - smoothstep(WATER_LEVEL - 0.2, WATER_LEVEL + 0.5, h);
        c.lerp(cMud, wet * 0.85);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, b = a + 1, d = a + N + 1, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    this.heights = heights;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: this.groundDetail, normalMap: this.groundNormal, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.96 });
    this.terrain = new THREE.Mesh(g, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  groundHeight(x, z) {
    const S = this.tS, N = this.tN, step = this.tStep;
    const fx = (x + S / 2) / step, fz = (z + S / 2) / step;
    const i = clamp(Math.floor(fx), 0, N - 1), j = clamp(Math.floor(fz), 0, N - 1);
    const u = fx - i, v = fz - j;
    const H = this.heights, W = N + 1;
    const h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
    if (u + v < 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  inPond(x, z, margin = 0) {
    const dx = x - POND.x, dz = z - POND.z;
    return Math.hypot(dx, dz) < pondRadius(Math.atan2(dz, dx)) + margin;
  }

  inHouse(x, z, margin = 0) {
    return Math.abs(x - HOUSE.x) < HOUSE.w / 2 + margin && Math.abs(z - HOUSE.z) < HOUSE.d / 2 + margin;
  }

  isGroundOk(x, z) {
    return !this.inPond(x, z, 0.5) && !this.inHouse(x, z, 0.5) && Math.hypot(x, z) < 120;
  }

  isShore(x, z) {
    const h = this.groundHeight(x, z);
    return h > WATER_LEVEL - 0.3 && h < WATER_LEVEL + 0.08;
  }

  randomWaterPoint(rng, avoid) {
    for (let i = 0; i < 30; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * (pondRadius(a) - 3);
      const p = new THREE.Vector3(POND.x + Math.cos(a) * r, WATER_LEVEL, POND.z + Math.sin(a) * r);
      if (this.groundHeight(p.x, p.z) > WATER_LEVEL - 0.25) continue;
      if (avoid && p.distanceTo(avoid) < 12) continue;
      return p;
    }
    return new THREE.Vector3(POND.x, WATER_LEVEL, POND.z);
  }

  randomGroundPoint(rng) {
    for (let i = 0; i < 50; i++) {
      const x = YARD.x + (rng() - 0.5) * 30, z = YARD.z + (rng() - 0.5) * 30;
      if (this.isGroundOk(x, z)) return new THREE.Vector3(x, this.groundHeight(x, z), z);
    }
    return new THREE.Vector3(0, this.groundHeight(0, 0), 0);
  }

  // ---------------------------------------------------------- water
  buildWater() {
    const cv = noiseCanvas(256, 256, (x, y) => 0.5 + 0.35 * tileNoise(5, x, y, 256, 256, 4) + 0.15 * tileNoise(6, x, y, 256, 256, 16));
    this.waterNormal = heightToNormal(cv, 3);
    this.waterNormal.repeat.set(6, 6);
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU;
      const r = pondRadius(a) + 3.5;
      // Negated y so the outline matches the basin once rotated flat.
      pts.push(new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r));
    }
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts), 12);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 30, uv.getY(i) / 30);
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x1f2c28, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.9,
      normalMap: this.waterNormal, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 1.2,
    });
    this.water = new THREE.Mesh(geo, this.waterMat);
    this.water.position.set(POND.x, WATER_LEVEL, POND.z);
    this.water.receiveShadow = true;
    this.water.renderOrder = 1;
    this.scene.add(this.water);

    // Lily pads.
    const pad = new THREE.CircleGeometry(0.28, 14, 0.25, TAU - 0.5).rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x3f6b2e, roughness: 0.55 });
    const pads = new THREE.InstancedMesh(pad, padMat, 60);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    let k = 0;
    const rnd = mulberry32(77);
    while (k < 60) {
      const a = rnd() * TAU, r = pondRadius(a) - 1 - rnd() * 4;
      const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
      if (a > 0.5 && a < 2.4) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * TAU);
      s.setScalar(0.6 + rnd() * 0.8);
      m.compose(new THREE.Vector3(x, WATER_LEVEL + 0.01, z), q, s);
      pads.setMatrixAt(k++, m);
    }
    pads.receiveShadow = true;
    this.scene.add(pads);
  }

  // ---------------------------------------------------------- trees
  buildTrees() {
    const rnd = mulberry32(99);
    const templates = {
      oak: [makeTree('oak', 1), makeTree('oak', 2), makeTree('oak', 3)],
      maple: [makeTree('maple', 4), makeTree('maple', 5)],
      pine: [makeTree('pine', 6), makeTree('pine', 7)],
      cedar: [makeTree('cedar', 8)],
      dogwood: [makeTree('dogwood', 9)],
      redbud: [makeTree('redbud', 10)],
      snag: [makeTree('snag', 11)],
      shrub: [makeTree('shrub', 12), makeTree('shrub', 13)],
      viburnum: [makeTree('viburnum', 14)],
    };
    const placements = new Map();
    const place = (tpl, x, z, rot = rnd() * TAU, scale = 0.85 + rnd() * 0.3) => {
      if (!placements.has(tpl)) placements.set(tpl, []);
      const y = this.groundHeight(x, z);
      placements.get(tpl).push({ x, y, z, rot, scale });
    };
    const occupied = [];
    const free = (x, z, r) => occupied.every((o) => Math.hypot(o[0] - x, o[1] - z) > o[2] + r);
    const reserve = (x, z, r) => occupied.push([x, z, r]);

    // Hand-placed yard trees.
    const yardTrees = [
      ['oak', -30, -8], ['maple', 8, 24], ['dogwood', -9.5, -1.5], ['redbud', 5, 15], ['cedar', -24, -13],
      ['cedar', 17, -15], ['maple', -34, 22], ['oak', 26, 22], ['dogwood', -26, 24], ['cedar', -12, 24],
    ];
    for (const [t, x, z] of yardTrees) {
      const list = templates[t];
      place(list[Math.floor(rnd() * list.length)], x, z);
      reserve(x, z, t === 'oak' || t === 'maple' ? 6 : 3);
    }
    place(templates.snag[0], SNAG.x, SNAG.z, 0.4, 1);
    reserve(SNAG.x, SNAG.z, 3);
    reserve(HOUSE.x, HOUSE.z, 8);
    reserve(FEEDER.x, FEEDER.z, 2.5);
    reserve(BIRDBATH.x, BIRDBATH.z, 2);

    // Pine grove.
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * PINES.r;
      const x = PINES.x + Math.cos(a) * r, z = PINES.z + Math.sin(a) * r;
      if (!free(x, z, 3.5)) continue;
      place(templates.pine[i % 2], x, z);
      reserve(x, z, 3.5);
    }
    // Woods ring and woodlots.
    let tries = 0;
    while (tries++ < 6000) {
      const a = rnd() * TAU, r = 58 + rnd() * 90;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 5;
      const zn = zones(x, z);
      if (zn.woods < 0.5 || this.inPond(x, z, 6) || zn.path > 0.2) continue;
      if (Math.hypot(x, z) > 165) continue;
      const nearPines = Math.hypot(x - PINES.x, z - PINES.z) < PINES.r + 10;
      const pick = nearPines ? 'pine' : rnd() < 0.08 ? 'cedar' : rnd() < 0.08 ? 'pine' : rnd() < 0.55 ? 'oak' : 'maple';
      const rad = pick === 'cedar' ? 2.5 : 4.4;
      if (!free(x, z, rad)) continue;
      const list = templates[pick];
      place(list[Math.floor(rnd() * list.length)], x, z);
      reserve(x, z, rad);
    }
    // Small woodlot west of the meadow.
    for (let i = 0; i < 40; i++) {
      const x = -40 + (rnd() - 0.5) * 22, z = -14 + (rnd() - 0.5) * 22;
      if (!free(x, z, 4)) continue;
      place(templates[rnd() < 0.5 ? 'oak' : 'maple'][Math.floor(rnd() * 2)], x, z);
      reserve(x, z, 4);
    }
    // Shrubs along the yard edge, fence line and meadow.
    const shrubSpots = [[-11, -4], [-3, -5.5], [1.5, -3], [-13, 1.5], [3, 7], [-16, -9], [12, -10], [-6, 18], [6, 20], [-19, 3], [20, 4], [30, -18], [33, 8], [10, -24], [22, -34]];
    for (const [x, z] of shrubSpots) {
      const t = rnd() < 0.35 ? templates.viburnum[0] : templates.shrub[Math.floor(rnd() * 2)];
      place(t, x, z);
      reserve(x, z, 1.8);
    }
    for (let i = 0; i < 70; i++) {
      const a = rnd() * TAU, r = 50 + rnd() * 20;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 5;
      if (this.inPond(x, z, 3) || !free(x, z, 1.5) || zones(x, z).path > 0.1) continue;
      place(templates.shrub[i % 2], x, z);
      reserve(x, z, 1.5);
    }

    // Build instanced meshes and world-space perches, trunks and clusters.
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color();
    for (const [tpl, list] of placements) {
      const barkMat = tpl.type === 'snag' ? this.snagMat : tpl.type === 'pine' ? this.pineBarkMat : this.barkMat;
      const bark = new THREE.InstancedMesh(tpl.barkGeo, barkMat, list.length);
      bark.castShadow = true;
      bark.receiveShadow = true;
      let leaves = null;
      if (tpl.leafGeo) {
        leaves = new THREE.InstancedMesh(tpl.leafGeo, this.leafMat, list.length);
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        leaves.customDepthMaterial = this.leafDepth;
      }
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.rot);
        sv.setScalar(p.scale);
        pv.set(p.x, p.y, p.z);
        m4.compose(pv, q, sv);
        bark.setMatrixAt(i, m4);
        if (leaves) {
          leaves.setMatrixAt(i, m4);
          tint.setHSL(0.25 + (rnd() - 0.5) * 0.04, 0.35 + rnd() * 0.2, 0.5 + (rnd() - 0.5) * 0.12);
          leaves.setColorAt(i, tint.setRGB(0.9 + rnd() * 0.2, 0.9 + rnd() * 0.2, 0.85 + rnd() * 0.2));
        }
        const near = Math.hypot(p.x, p.z) < 66;
        if (tpl.trunkR > 0) this.trunks.push({ x: p.x, z: p.z, r: tpl.trunkR * p.scale, h: tpl.height * p.scale });
        for (const c of tpl.clusters) {
          const w = c.c.clone().applyMatrix4(m4);
          this.leafClusters.push(w.x, w.y, w.z, c.s * p.scale * 0.55);
        }
        if (near || tpl.type === 'pine') {
          for (const pr of tpl.perches) {
            const wp = pr.pos.clone().applyMatrix4(m4);
            const perch = { kind: pr.kind, pos: wp };
            if (pr.normal) {
              perch.normal = pr.normal.clone().applyQuaternion(q);
              perch.top = p.y + pr.top * p.scale;
            }
            this.addPerch(perch);
          }
        }
      });
      this.scene.add(bark);
      if (leaves) this.scene.add(leaves);
    }
  }

  // ---------------------------------------------------------- grass
  buildGrass() {
    const rnd = mulberry32(5);
    const B = { pos: [], nor: [], col: [], h: [], idx: [] };
    const cBase = new THREE.Color(0x34521f), cTip = new THREE.Color(0x7f9848);
    for (let b = 0; b < 5; b++) {
      const bx = (rnd() - 0.5) * 0.2, bz = (rnd() - 0.5) * 0.2;
      const lean = (rnd() - 0.5) * 0.3, leanA = rnd() * TAU;
      const h = 0.65 + rnd() * 0.4, w = 0.011 + rnd() * 0.008;
      const face = rnd() * TAU;
      const fx = Math.cos(face), fz = Math.sin(face);
      const base = B.pos.length / 3;
      const L = 3;
      for (let k = 0; k <= L; k++) {
        const t = k / L;
        const off = lean * t * t;
        const cx = bx + Math.cos(leanA) * off, cz = bz + Math.sin(leanA) * off;
        const ww = w * (1 - t * 0.92);
        for (const sgn of [-1, 1]) {
          B.pos.push(cx + fx * ww * sgn, t * h, cz + fz * ww * sgn);
          B.nor.push(Math.cos(leanA) * 0.25, 0.95, Math.sin(leanA) * 0.25);
          const c = cBase.clone().lerp(cTip, Math.pow(t, 0.8));
          B.col.push(c.r, c.g, c.b);
          B.h.push(t);
        }
      }
      for (let k = 0; k < L; k++) {
        const a = base + k * 2;
        B.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    geo.setAttribute('aH', new THREE.Float32BufferAttribute(B.h, 1));
    geo.setIndex(B.idx);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
    addWind(mat, 'aH', 0.09);
    addTranslucency(mat, 0.45);

    const items = [];
    const center = new THREE.Vector3(8, 0, -6);
    let tries = 0;
    while (items.length < this.grassCount && tries++ < 200000) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * 92;
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      if (this.inHouse(x, z, 0.3)) continue;
      const h = this.groundHeight(x, z);
      if (h < WATER_LEVEL + 0.03) continue;
      const zn = zones(x, z);
      let density = zn.lawn * 0.9 + zn.meadow * 1.0 + zn.woods * 0.12;
      density *= 1 - zn.path * 0.95;
      if (Math.hypot(x - FEEDER.x, z - FEEDER.z) < 1.8) density *= 0.2;
      if (rnd() > density) continue;
      const tall = zn.meadow * (0.9 + 0.3 * noiseC(x / 8, z / 8));
      const sy = lerp(0.2, 1.15, clamp(tall, 0, 1)) * (0.8 + rnd() * 0.4) * (1 - zn.path * 0.6);
      items.push({ x, y: h - 0.02, z, sy, sxz: 0.9 + rnd() * 0.5, rot: rnd() * TAU, lawn: zn.lawn, dry: noiseB(x / 15, z / 15) });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
      s.set(it.sxz, it.sy, it.sxz);
      p.set(it.x, it.y, it.z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      c.setRGB(lerp(1.05, 0.85, it.lawn) + it.dry * 0.12, lerp(1.0, 1.0, it.lawn), lerp(0.85, 0.8, it.lawn));
      mesh.setColorAt(i, c);
    });
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.grass = mesh;
  }

  // ---------------------------------------------------------- flowers
  buildFlowers() {
    const rnd = mulberry32(31);
    const stem = new THREE.CylinderGeometry(0.004, 0.006, 1, 4, 1).translate(0, 0.5, 0);
    const head = new THREE.CircleGeometry(0.035, 8).rotateX(-Math.PI / 2).translate(0, 1.0, 0);
    const center = new THREE.SphereGeometry(0.012, 6, 4).translate(0, 1.005, 0);
    const paint = (g, hex) => {
      const c = new THREE.Color(hex);
      const arr = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      const h = new Float32Array(g.attributes.position.count);
      const pos = g.attributes.position;
      for (let i = 0; i < h.length; i++) h[i] = pos.getY(i);
      g.setAttribute('aH', new THREE.BufferAttribute(h, 1));
      return g;
    };
    const geo = mergeGeometries([paint(stem.clone(), 0x4d6b2f), paint(head.clone(), 0xffffff), paint(center.clone(), 0xd8a92a)]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    addWind(mat, 'aH', 0.06);
    const palette = [0xf4f1e6, 0xf2d33a, 0xb18ad8, 0xf4f1e6, 0xe9c43a, 0xeae4f2];
    const items = [];
    let tries = 0;
    while (items.length < 3200 && tries++ < 50000) {
      const x = MEADOW.x + (rnd() - 0.5) * 90, z = MEADOW.z + (rnd() - 0.5) * 90;
      const zn = zones(x, z);
      const h = this.groundHeight(x, z);
      if (h < WATER_LEVEL + 0.1 || zn.path > 0.3) continue;
      const w = zn.meadow * 0.9 + zn.lawn * 0.25;
      if (rnd() > w * (0.4 + 0.6 * (noiseA(x / 10, z / 10) * 0.5 + 0.5))) continue;
      const lawnFlower = zn.lawn > 0.5;
      items.push({ x, y: h, z, sy: lawnFlower ? 0.1 + rnd() * 0.05 : 0.35 + rnd() * 0.45, col: lawnFlower ? (rnd() < 0.8 ? 0xf2c21e : 0x8a6cc8) : palette[Math.floor(rnd() * palette.length)] });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.3, rnd() * TAU, (rnd() - 0.5) * 0.3));
      s.set(1, it.sy, 1);
      p.set(it.x, it.y, it.z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.setHex(it.col));
      if (i % 40 === 0 && it.sy > 0.5) this.addPerch({ kind: 'flowers', pos: new THREE.Vector3(it.x, it.y + it.sy * 1.0 + 0.01, it.z) });
    });
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // ---------------------------------------------------------- cattails
  buildCattails() {
    const rnd = mulberry32(8);
    const parts = [];
    const paint = (g, hex, hMax) => {
      const c = new THREE.Color(hex);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3), h = new Float32Array(n);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; h[i] = g.attributes.position.getY(i) / hMax; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      g.setAttribute('aH', new THREE.BufferAttribute(h, 1));
      g.deleteAttribute('uv');
      return g;
    };
    parts.push(paint(new THREE.CylinderGeometry(0.008, 0.012, 1.9, 5).translate(0, 0.95, 0), 0x6d7a3a, 2.1));
    parts.push(paint(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 8).translate(0, 1.72, 0), 0x5a3a22, 2.1));
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.PlaneGeometry(0.035, 1.6, 1, 4).translate(0, 0.8, 0);
      const pos = blade.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const y = pos.getY(k);
        pos.setZ(k, (y / 1.6) ** 2 * 0.35);
      }
      blade.rotateY((i / 4) * TAU + 0.3);
      blade.computeVertexNormals();
      parts.push(paint(blade, 0x5f7a34, 2.1));
    }
    const geo = mergeGeometries(parts);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    addWind(mat, 'aH', 0.12);
    const items = [];
    for (let i = 0; i < 4000 && items.length < 420; i++) {
      const a = rnd() * TAU, r = pondRadius(a) + (rnd() - 0.65) * 4.5;
      const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
      if (a > 3.9 && a < 5.2) continue;
      const h = this.groundHeight(x, z);
      if (h < WATER_LEVEL - 0.45 || h > WATER_LEVEL + 0.35) continue;
      items.push({ x, y: h, z, s: 0.8 + rnd() * 0.45, a: rnd() * TAU });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.12, it.a, (rnd() - 0.5) * 0.12));
      s.setScalar(it.s);
      p.set(it.x, it.y, it.z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      if (i % 12 === 0) this.addPerch({ kind: 'cattail', pos: new THREE.Vector3(it.x, it.y + 1.84 * it.s, it.z) });
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // ---------------------------------------------------------- house
  buildHouse() {
    const group = new THREE.Group();
    const siding = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#8d9ca3';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        const grad = g.createLinearGradient(0, y, 0, y + 16);
        grad.addColorStop(0, '#9fadb3');
        grad.addColorStop(0.85, '#8a989f');
        grad.addColorStop(1, '#5d6a70');
        g.fillStyle = grad;
        g.fillRect(0, y, w, 16);
      }
    }, { repeat: [3, 1.2] });
    const shingles = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#34302e';
      g.fillRect(0, 0, w, h);
      const r = mulberry32(3);
      for (let y = 0; y < h; y += 20) {
        for (let x = -(y % 40 ? 16 : 0); x < w; x += 32) {
          const v = 40 + r() * 30;
          g.fillStyle = `rgb(${v + 6},${v},${v - 4})`;
          g.fillRect(x + 1, y + 1, 30, 18);
        }
      }
    }, { repeat: [4, 3] });
    const wallMat = new THREE.MeshStandardMaterial({ map: siding, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ map: shingles, roughness: 0.9 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4c, roughness: 0.85 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2226, roughness: 0.05, metalness: 0.3, emissive: 0xffb45a, emissiveIntensity: 0.0 });
    const litMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, emissive: 0xffa84c, emissiveIntensity: 1.4, roughness: 0.5 });

    const W = HOUSE.w, D = HOUSE.d, H = 3.2, base = 0.6;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
    walls.position.y = base + H / 2;
    group.add(walls);
    const found = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, base + 0.4, D + 0.2), new THREE.MeshStandardMaterial({ color: 0x77726a, roughness: 0.95 }));
    found.position.y = (base + 0.4) / 2 - 0.4;
    group.add(found);
    // Gable roof running along x.
    const pitchH = 2.4, over = 0.5;
    const slope = Math.hypot(D / 2 + over, pitchH);
    const ang = Math.atan2(pitchH, D / 2 + over);
    for (const s of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + over * 2, 0.14, slope), roofMat);
      roof.position.set(0, base + H + pitchH / 2, s * (D / 4 + over / 2));
      roof.rotation.x = s * ang;
      roof.castShadow = true;
      group.add(roof);
    }
    const gableShape = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, pitchH)]);
    for (const s of [-1, 1]) {
      const gable = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), wallMat);
      gable.rotation.y = s * Math.PI / 2;
      gable.position.set(s * W / 2, base + H, 0);
      group.add(gable);
    }
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.9), new THREE.MeshStandardMaterial({ color: 0x7c4a3a, roughness: 0.9 }));
    chimney.position.set(-W / 2 + 1.4, base + H + 1.7, -1);
    group.add(chimney);
    // Windows and door on the east (+x) wall facing the yard, and the south wall.
    const addWindow = (x, y, z, rotY, lit) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.1), trimMat);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), lit ? litMat : glassMat);
      pane.position.z = 0.06;
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.04), trimMat);
      bar1.position.z = 0.08;
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.04), trimMat);
      bar2.position.z = 0.08;
      g.add(frame, pane, bar1, bar2);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      group.add(g);
    };
    addWindow(W / 2 + 0.01, base + 1.8, -2.2, Math.PI / 2, true);
    addWindow(W / 2 + 0.01, base + 1.8, 2.4, Math.PI / 2, false);
    addWindow(-2, base + 1.8, D / 2 + 0.01, 0, true);
    addWindow(2, base + 1.8, D / 2 + 0.01, 0, false);
    addWindow(-2.5, base + 1.8, -D / 2 - 0.01, Math.PI, false);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x5b2b22, roughness: 0.6 }));
    door.position.set(W / 2 + 0.03, base + 1.1, 0.2);
    group.add(door);
    // Back deck with steps and railing posts.
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 6), deckMat);
    deck.position.set(W / 2 + 1.7, base - 0.05, 0);
    group.add(deck);
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 1.6), deckMat);
      step.position.set(W / 2 + 3.6 + i * 0.4, base - 0.2 - i * 0.18, 0.2);
      group.add(step);
    }
    for (const z of [-2.9, -1, 1.4, 2.9]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), trimMat);
      post.position.set(W / 2 + 3.3, base + 0.45, z);
      group.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 6), trimMat);
    rail.position.set(W / 2 + 3.3, base + 0.95, 0);
    group.add(rail);
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.position.set(HOUSE.x, this.groundHeight(HOUSE.x, HOUSE.z) - 0.1, HOUSE.z);
    this.scene.add(group);
    this.solids.push({ min: new THREE.Vector3(HOUSE.x - W / 2, -5, HOUSE.z - D / 2), max: new THREE.Vector3(HOUSE.x + W / 2, 8, HOUSE.z + D / 2) });
    this.deckTop = new THREE.Vector3(HOUSE.x + W / 2 + 1.7, group.position.y + base + 0.05, HOUSE.z);

    // Red hummingbird feeder hanging from the eave, plus a bed of bee balm.
    const hx = HOUSE.x + W / 2 + 0.7, hz = HOUSE.z - 2.6, hy = group.position.y + base + H - 0.6;
    const hf = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12), new THREE.MeshPhysicalMaterial({ color: 0xffd9d9, transmission: 0.6, roughness: 0.1, thickness: 0.05 }));
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4 }));
    base2.position.y = -0.12;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    wire.position.y = 0.4;
    hf.add(bottle, base2, wire);
    hf.position.set(hx, hy, hz);
    this.scene.add(hf);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      this.addPerch({ kind: 'nectar', pos: new THREE.Vector3(hx + Math.cos(a) * 0.3, hy - 0.1, hz + Math.sin(a) * 0.3) });
    }
    const rnd = mulberry32(55);
    const bloom = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc81e3a, roughness: 0.7 }), 80);
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.01, 1, 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x3f5f2a }), 80);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 80; i++) {
      const x = HOUSE.x + W / 2 + 3.9 + rnd() * 1.4, z = HOUSE.z + 3.2 + rnd() * 3.4;
      const y = this.groundHeight(x, z);
      const h = 0.6 + rnd() * 0.35;
      m4.makeScale(1, h, 1).setPosition(x, y, z);
      stems.setMatrixAt(i, m4);
      m4.makeScale(1, 0.8, 1).setPosition(x, y + h, z);
      bloom.setMatrixAt(i, m4);
      if (i % 10 === 0) this.addPerch({ kind: 'nectar', pos: new THREE.Vector3(x + 0.18, y + h + 0.05, z) });
    }
    bloom.castShadow = true;
    this.scene.add(bloom, stems);
  }

  // ---------------------------------------------------------- feeders & birdbath
  buildFeeders() {
    const metal = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.45, metalness: 0.6 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x7b5b3e, roughness: 0.85 });
    const seedMat = new THREE.MeshStandardMaterial({ color: 0x3e342a, roughness: 1 });
    const tubeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.85, roughness: 0.05, thickness: 0.02, transparent: true });
    const gy = this.groundHeight(FEEDER.x, FEEDER.z);
    const g = new THREE.Group();
    g.position.set(FEEDER.x, gy, FEEDER.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 2.3, 8), metal);
    pole.position.y = 1.15;
    g.add(pole);
    // Two shepherd's hook arms.
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 16, Math.PI), metal);
      arm.position.set(s * 0.22, 2.2, 0);
      arm.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(arm);
    }
    // Tube feeder on the right hook.
    const tube = new THREE.Group();
    const tubeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 16), tubeMat);
    const seeds = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 12), seedMat);
    seeds.position.y = -0.06;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.062, 0.05, 16), metal);
    cap.position.y = 0.27;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.05, 16), metal);
    bottom.position.y = -0.27;
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25, 4), metal);
    hang.position.y = 0.4;
    tube.add(tubeBody, seeds, cap, bottom, hang);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const y = i < 2 ? -0.18 : 0.02;
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 4), metal);
      peg.rotation.z = Math.PI / 2;
      peg.rotation.y = a;
      peg.position.set(Math.cos(a) * 0.08, y, -Math.sin(a) * 0.08);
      tube.add(peg);
      this.addPerch({ kind: 'feeder', pos: new THREE.Vector3(FEEDER.x + 0.44 + Math.cos(a) * 0.14, gy + 1.62 + y, FEEDER.z - Math.sin(a) * 0.14), facing: Math.atan2(-Math.cos(a), Math.sin(a)) });
    }
    tube.position.set(0.44, 1.62, 0);
    g.add(tube);
    // Suet cage on the left hook.
    const suet = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: 0xcfbf8e, roughness: 0.9 }));
    suet.position.set(-0.44, 1.85, 0);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, wireframe: true }));
    cage.position.copy(suet.position);
    g.add(suet, cage);
    this.addPerch({ kind: 'trunk', pos: new THREE.Vector3(FEEDER.x - 0.44, gy + 1.78, FEEDER.z + 0.04), normal: new THREE.Vector3(0, 0, 1), top: gy + 1.8 });
    // Platform feeder on its own post.
    const tray = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), wood);
    post.position.y = 0.65;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.4), wood);
    plate.position.y = 1.31;
    const seed2 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.015, 0.34), seedMat);
    seed2.position.y = 1.33;
    tray.add(post, plate, seed2);
    for (const [x, z, w, d] of [[0, 0.2, 0.5, 0.02], [0, -0.2, 0.5, 0.02], [0.25, 0, 0.02, 0.4], [-0.25, 0, 0.02, 0.4]]) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), wood);
      rim.position.set(x, 1.35, z);
      tray.add(rim);
    }
    tray.position.set(1.6, 0, 0.8);
    g.add(tray);
    const tpos = new THREE.Vector3(FEEDER.x + 1.6, gy, FEEDER.z + 0.8);
    for (const [x, z, f] of [[0.18, 0.2, 0], [-0.18, 0.2, 0], [0.25, 0.05, -Math.PI / 2], [-0.25, -0.05, Math.PI / 2], [0.1, -0.2, Math.PI], [-0.12, -0.2, Math.PI], [0, 0, 0.5]]) {
      this.addPerch({ kind: 'feeder', pos: new THREE.Vector3(tpos.x + x, gy + 1.36, tpos.z + z), facing: f });
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
    // Spilled seed under the feeders.
    const spill = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a3e30, roughness: 1, transparent: true, opacity: 0.75 }));
    spill.position.set(FEEDER.x + 0.6, gy + 0.02, FEEDER.z + 0.3);
    spill.receiveShadow = true;
    this.scene.add(spill);
    this.feederPos = new THREE.Vector3(FEEDER.x, gy, FEEDER.z);

    // Birdbath.
    const by = this.groundHeight(BIRDBATH.x, BIRDBATH.z);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9c978d, roughness: 0.9 });
    const prof = [[0, 0], [0.22, 0], [0.18, 0.08], [0.09, 0.2], [0.08, 0.7], [0.12, 0.78], [0.42, 0.86], [0.46, 0.92], [0.4, 0.93], [0.36, 0.88], [0, 0.84]].map(([x, y]) => new THREE.Vector2(x, y));
    const bath = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), concrete);
    bath.position.set(BIRDBATH.x, by, BIRDBATH.z);
    bath.castShadow = true;
    bath.receiveShadow = true;
    const bw = new THREE.Mesh(new THREE.CircleGeometry(0.37, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x46606a, roughness: 0.03, metalness: 0.1 }));
    bw.position.set(BIRDBATH.x, by + 0.9, BIRDBATH.z);
    this.scene.add(bath, bw);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      this.addPerch({ kind: 'birdbath', pos: new THREE.Vector3(BIRDBATH.x + Math.cos(a) * 0.43, by + 0.93, BIRDBATH.z + Math.sin(a) * 0.43), facing: Math.atan2(-Math.cos(a), -Math.sin(a)) });
    }
  }

  // ---------------------------------------------------------- fence and nest boxes
  buildFence() {
    const weathered = new THREE.MeshStandardMaterial({ map: this.snagMat.map, normalMap: this.barkMat.normalMap, color: 0xb8ae9f, roughness: 0.95 });
    const posts = [], rails = [];
    const line = [[-24, -14], [-8, -13.5], [5, -13], [10, -12.5], [13, -2], [14.5, 10], [14, 24]];
    const rnd = mulberry32(21);
    const m4 = new THREE.Matrix4();
    const postPts = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 3));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        postPts.push([lerp(ax, bx, t), lerp(az, bz, t)]);
      }
    }
    postPts.push(line[line.length - 1]);
    for (let i = 0; i < postPts.length; i++) {
      const [x, z] = postPts[i];
      if (pathDist(x, z) < 1.2) { postPts[i].gate = true; continue; }
      const y = this.groundHeight(x, z);
      posts.push({ x, y, z });
      this.addPerch({ kind: 'fence', pos: new THREE.Vector3(x, y + 1.22, z) });
    }
    const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1.3, 0.16).translate(0, 0.6, 0), weathered, posts.length);
    posts.forEach((p, i) => { m4.makeRotationY(rnd() * 0.3).setPosition(p.x, p.y - 0.05, p.z); postMesh.setMatrixAt(i, m4); });
    for (let i = 0; i < postPts.length - 1; i++) {
      const a = postPts[i], b = postPts[i + 1];
      if (a.gate || b.gate) continue;
      for (const hgt of [0.55, 1.0]) {
        const ya = this.groundHeight(a[0], a[1]) + hgt, yb = this.groundHeight(b[0], b[1]) + hgt;
        rails.push({ a: new THREE.Vector3(a[0], ya, a[1]), b: new THREE.Vector3(b[0], yb, b[1]) });
      }
      if (i % 2 === 0) {
        const mid = new THREE.Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
        mid.y = this.groundHeight(mid.x, mid.z) + 1.07;
        this.addPerch({ kind: 'fence', pos: mid });
      }
    }
    const railGeo = new THREE.CylinderGeometry(0.055, 0.06, 1, 6).rotateZ(Math.PI / 2);
    const railMesh = new THREE.InstancedMesh(railGeo, weathered, rails.length);
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    rails.forEach((r, i) => {
      const dir = r.b.clone().sub(r.a);
      const len = dir.length();
      q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
      s.set(len + 0.25, 1, 1);
      p.copy(r.a).add(r.b).multiplyScalar(0.5);
      m4.compose(p, q, s);
      railMesh.setMatrixAt(i, m4);
    });
    for (const m of [postMesh, railMesh]) { m.castShadow = true; m.receiveShadow = true; this.scene.add(m); }

    // Bluebird nest boxes on posts in the meadow.
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x9a7b58, roughness: 0.85 });
    for (const [x, z] of [[24, 6], [32, -12], [20, -26]]) {
      const y = this.groundHeight(x, z);
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5, roughness: 0.5 }));
      post.position.y = 0.75;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), boxMat);
      box.position.y = 1.65;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.24), boxMat);
      roof.position.y = 1.82;
      roof.rotation.x = -0.2;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
      hole.position.set(0, 1.7, 0.081);
      g.add(post, box, roof, hole);
      g.position.set(x, y, z);
      g.rotation.y = -Math.PI / 2;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(g);
      this.addPerch({ kind: 'nestbox', pos: new THREE.Vector3(x, y + 1.85, z) });
    }
    // Bench by the pond.
    const bench = new THREE.Group();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.4), boxMat);
    plank.position.y = 0.45;
    bench.add(plank);
    for (const x of [-0.65, 0.65]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.35), boxMat);
      leg.position.set(x, 0.22, 0);
      bench.add(leg);
    }
    bench.position.set(24, this.groundHeight(24, -22), -22);
    bench.rotation.y = -0.9;
    bench.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(bench);
  }

  // ---------------------------------------------------------- rocks and logs
  buildRocks() {
    const rnd = mulberry32(17);
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const n = 1 + 0.25 * noiseA(v.x * 1.7 + 3, v.z * 1.7 + v.y);
      v.multiplyScalar(n);
      v.y *= 0.6;
      pos.setXYZ(i, v.x, v.y, v.z);
      const moss = smoothstep(0.2, 0.7, v.y) * 0.6;
      const g = 0.45 + 0.1 * noiseB(v.x * 3, v.z * 3);
      col[i * 3] = lerp(g, 0.28, moss);
      col[i * 3 + 1] = lerp(g * 0.98, 0.36, moss);
      col[i * 3 + 2] = lerp(g * 0.94, 0.18, moss);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, normalMap: this.groundNormal, normalScale: new THREE.Vector2(1.2, 1.2) });
    const items = [];
    for (let i = 0; i < 400 && items.length < 60; i++) {
      const pondSide = i % 3 === 0;
      let x, z;
      if (pondSide) {
        const a = rnd() * TAU, r = pondRadius(a) + 1 + rnd() * 5;
        x = POND.x + Math.cos(a) * r; z = POND.z + Math.sin(a) * r;
      } else {
        const a = rnd() * TAU, r = 40 + rnd() * 80;
        x = Math.cos(a) * r; z = Math.sin(a) * r;
      }
      if (zones(x, z).path > 0.2 || this.inHouse(x, z, 2)) continue;
      items.push({ x, z, s: 0.25 + rnd() * rnd() * 1.4 });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(rnd() * 0.3, rnd() * TAU, rnd() * 0.3));
      s.set(it.s * (0.8 + rnd() * 0.5), it.s, it.s * (0.8 + rnd() * 0.5));
      p.set(it.x, this.groundHeight(it.x, it.z) - it.s * 0.15, it.z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Fallen logs in the woods.
    for (const [x, z, a, l] of [[-36, -22, 0.4, 5], [52, -60, 1.3, 6], [-6, -58, 2.2, 4.5], [60, 10, 0.8, 5]]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, l, 10).rotateZ(Math.PI / 2), this.barkMat);
      log.position.set(x, this.groundHeight(x, z) + 0.22, z);
      log.rotation.y = a;
      log.castShadow = true;
      log.receiveShadow = true;
      this.scene.add(log);
    }
  }

  // ---------------------------------------------------------- distant treeline
  buildTreeline() {
    const tex = canvasTex(2048, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const r = mulberry32(5);
      for (let layer = 0; layer < 2; layer++) {
        g.fillStyle = layer ? '#2f3d2e' : '#415041';
        for (let x = -40; x < w + 40; x += 10 + r() * 16) {
          const top = h * (layer ? 0.3 : 0.18) + r() * h * 0.25;
          const rad = 18 + r() * 30;
          g.beginPath();
          g.arc(x, top + rad, rad, 0, TAU);
          g.fill();
          g.fillRect(x - rad, top + rad, rad * 2, h);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    const geo = new THREE.CylinderGeometry(215, 215, 55, 64, 1, true);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.BackSide, roughness: 1, color: 0x9aa597 });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.y = 16;
    this.scene.add(ring);
  }

  // ---------------------------------------------------------- mist, clouds, motes
  buildAtmosphere() {
    const puff = canvasTex(128, 128, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
    this.mist = [];
    const rnd = mulberry32(12);
    for (let i = 0; i < 34; i++) {
      const overPond = i < 16;
      const a = rnd() * TAU, r = rnd() * (overPond ? POND.r : 30);
      const x = (overPond ? POND.x : MEADOW.x) + Math.cos(a) * r, z = (overPond ? POND.z : MEADOW.z) + Math.sin(a) * r;
      const mat = new THREE.SpriteMaterial({ map: puff, color: 0xfff3e4, transparent: true, depthWrite: false, opacity: 0.2 });
      const s = new THREE.Sprite(mat);
      s.position.set(x, this.groundHeight(x, z) + 0.8 + rnd() * 1.2, z);
      s.position.y = Math.max(s.position.y, WATER_LEVEL + 0.7);
      s.scale.set(14 + rnd() * 10, 3 + rnd() * 2, 1);
      s.userData.base = overPond ? 0.26 : 0.14;
      s.userData.drift = rnd() * TAU;
      this.mist.push(s);
      this.scene.add(s);
    }

    // High thin clouds on a dome.
    const cloudMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: { uTime: WIND.uTime, uSun: { value: new THREE.Vector3() }, uSunColor: SUN_UNIFORMS.uSunColor },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir; uniform float uTime; uniform vec3 uSun; uniform vec3 uSunColor;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
        void main(){
          if (vDir.y < 0.02) discard;
          vec2 uv = vDir.xz / (vDir.y + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
          float c = fbm(uv * vec2(1.0, 2.6));
          float a = smoothstep(0.52, 0.8, c) * smoothstep(0.02, 0.25, vDir.y) * 0.75;
          float toward = pow(max(dot(vDir, normalize(uSun)), 0.0), 6.0);
          vec3 col = mix(vec3(0.82, 0.8, 0.82), vec3(1.0, 0.92, 0.85), 0.5) * mix(vec3(1.0), uSunColor, 0.35) + toward * uSunColor * 0.6;
          gl_FragColor = vec4(col * 1.6, a);
        }`,
    });
    this.cloudMat = cloudMat;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), cloudMat);
    dome.renderOrder = -1;
    dome.frustumCulled = false;
    this.scene.add(dome);

    // Pollen and dust drifting in the light.
    const N = 400;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (rnd() - 0.5) * 24; pos[i * 3 + 1] = rnd() * 5; pos[i * 3 + 2] = (rnd() - 0.5) * 24; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1d0, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  // ---------------------------------------------------------- ground perches
  buildGroundPerches() {
    const rnd = mulberry32(64);
    const addGround = (kind, n, sample) => {
      let made = 0, tries = 0;
      while (made < n && tries++ < n * 40) {
        const [x, z] = sample();
        if (!this.isGroundOk(x, z)) continue;
        this.addPerch({ kind, pos: new THREE.Vector3(x, this.groundHeight(x, z), z) });
        made++;
      }
    };
    addGround('lawn', 60, () => [YARD.x + (rnd() - 0.5) * 40, YARD.z + (rnd() - 0.5) * 36]);
    addGround('meadow', 40, () => [MEADOW.x + (rnd() - 0.5) * 50, MEADOW.z + (rnd() - 0.5) * 50]);
    addGround('feederGround', 14, () => [FEEDER.x + 0.6 + (rnd() - 0.5) * 3.2, FEEDER.z + 0.3 + (rnd() - 0.5) * 3.2]);
    let made = 0;
    for (let i = 0; i < 3000 && made < 30; i++) {
      const a = rnd() * TAU, r = pondRadius(a) + (rnd() - 0.6) * 3;
      const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
      const h = this.groundHeight(x, z);
      if (h < WATER_LEVEL - 0.28 || h > WATER_LEVEL + 0.05) continue;
      this.addPerch({ kind: 'shore', pos: new THREE.Vector3(x, Math.max(h, WATER_LEVEL - 0.25), z), facing: Math.atan2(POND.x - x, POND.z - z) + (rnd() - 0.5) });
      made++;
    }
  }

  // ---------------------------------------------------------- title screen branch
  buildHeroBranch() {
    const base = new THREE.Vector3(-14.5, 0, -6.5);
    base.y = this.groundHeight(base.x, base.z);
    const pts = [
      base.clone().add(new THREE.Vector3(0, -0.1, 0)),
      base.clone().add(new THREE.Vector3(0.05, 0.9, 0)),
      base.clone().add(new THREE.Vector3(0.5, 1.35, 0.6)),
      base.clone().add(new THREE.Vector3(1.1, 1.62, 1.25)),
      base.clone().add(new THREE.Vector3(1.6, 1.7, 1.7)),
      base.clone().add(new THREE.Vector3(1.95, 1.78, 2.0)),
    ];
    const B = new GeoBuilder();
    const curve = new THREE.CatmullRomCurve3(pts);
    addTube(B, curve.getPoints(20), 0.045, 0.012, 0, 0.05, 8);
    const tw = [curve.getPoint(0.55), curve.getPoint(0.55).add(new THREE.Vector3(0.1, 0.35, -0.2)), curve.getPoint(0.55).add(new THREE.Vector3(0.15, 0.55, -0.25))];
    addTube(B, tw, 0.012, 0.004, 0, 0.1, 5);
    const geo = B.build(false);
    const mesh = new THREE.Mesh(geo, this.barkMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const L = new GeoBuilder();
    const rnd = mulberry32(3);
    const tip = curve.getPoint(1);
    for (let i = 0; i < 9; i++) {
      const c = tip.clone().add(new THREE.Vector3((rnd() - 0.2) * 0.5, (rnd() - 0.3) * 0.4, (rnd() - 0.2) * 0.5));
      addCard(L, c, 0.55, randomDir(rnd), rnd() * TAU, TILES.dogwood, tip.clone().add(new THREE.Vector3(0, -0.3, 0)), 0.3, rnd);
    }
    const tw2 = tw[2];
    for (let i = 0; i < 5; i++) {
      addCard(L, tw2.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.3, rnd() * 0.2, (rnd() - 0.5) * 0.3)), 0.45, randomDir(rnd), rnd() * TAU, TILES.dogwood, tw2, 0.3, rnd);
    }
    const leaves = new THREE.Mesh(L.build(true), this.leafMat);
    leaves.customDepthMaterial = this.leafDepth;
    leaves.castShadow = true;
    this.scene.add(leaves);
    const perchPoint = curve.getPoint(0.72);
    const tangent = curve.getTangent(0.72);
    this.hero = {
      perch: { kind: 'hero', pos: perchPoint.clone().add(new THREE.Vector3(0, 0.035, 0)), facing: Math.atan2(tangent.z, -tangent.x) },
      tangent,
    };
  }

  // ---------------------------------------------------------- per-frame
  update(dt, time, camera) {
    WIND.uTime.value = time;
    // Keep the shadow map centered on the viewer, snapped to texels.
    const cam = camera.position;
    const texel = 84 / 2048;
    const cx = Math.round(cam.x / texel) * texel, cz = Math.round(cam.z / texel) * texel;
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx, 0, cz).addScaledVector(this.sunDir, 120);
    this.sun.target.updateMatrixWorld();
    SUN_UNIFORMS.uSunView.value.copy(this.sunDir).transformDirection(camera.matrixWorldInverse);
    this.cloudMat.uniforms.uSun.value.copy(this.sunDir);
    this.waterNormal.offset.set(time * 0.006, time * 0.004);
    this.motes.position.set(cam.x, cam.y - 1.5, cam.z);
    const mp = this.motes.geometry.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      let y = mp.getY(i) + dt * 0.05;
      if (y > 5) y = 0;
      mp.setY(i, y);
      mp.setX(i, mp.getX(i) + Math.sin(time * 0.3 + i) * dt * 0.05);
    }
    mp.needsUpdate = true;
    const towardSun = Math.max(0, camera.getWorldDirection(new THREE.Vector3()).dot(this.sunDir));
    this.motes.material.opacity = 0.15 + towardSun * 0.6;
    for (const m of this.mist) m.position.x += Math.sin(time * 0.05 + m.userData.drift) * dt * 0.08;
  }

  // Blocks the player from walking through the house, trunks and the pond.
  collide(pos, radius = 0.35) {
    for (const s of this.solids) {
      if (pos.x > s.min.x - radius && pos.x < s.max.x + radius && pos.z > s.min.z - radius && pos.z < s.max.z + radius) {
        const dx1 = pos.x - (s.min.x - radius), dx2 = (s.max.x + radius) - pos.x;
        const dz1 = pos.z - (s.min.z - radius), dz2 = (s.max.z + radius) - pos.z;
        const m = Math.min(dx1, dx2, dz1, dz2);
        if (m === dx1) pos.x = s.min.x - radius;
        else if (m === dx2) pos.x = s.max.x + radius;
        else if (m === dz1) pos.z = s.min.z - radius;
        else pos.z = s.max.z + radius;
      }
    }
    for (const t of this.trunks) {
      const dx = pos.x - t.x, dz = pos.z - t.z;
      const d = Math.hypot(dx, dz), min = t.r + radius;
      if (d < min && d > 1e-4) { pos.x = t.x + (dx / d) * min; pos.z = t.z + (dz / d) * min; }
    }
    const pd = Math.hypot(pos.x - POND.x, pos.z - POND.z);
    const a = Math.atan2(pos.z - POND.z, pos.x - POND.x);
    const lim = pondRadius(a) - 1.0;
    if (pd < lim) { pos.x = POND.x + Math.cos(a) * lim; pos.z = POND.z + Math.sin(a) * lim; }
    const r = Math.hypot(pos.x, pos.z);
    if (r > 118) { pos.x *= 118 / r; pos.z *= 118 / r; }
  }

  // Fraction of the sightline from `from` to `to` blocked by terrain, trunks,
  // the house or leaves. Used to score photos.
  occlusion(from, to, ignoreRadius = 0.6) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    dir.divideScalar(len);
    for (let i = 1; i < 24; i++) {
      const p = from.clone().addScaledVector(dir, (len * i) / 24);
      if (this.groundHeight(p.x, p.z) > p.y + 0.05) return 1;
    }
    const ray = new THREE.Ray(from, dir);
    const hit = new THREE.Vector3();
    for (const s of this.solids) {
      if (ray.intersectBox(new THREE.Box3(s.min, s.max), hit) && hit.distanceTo(from) < len) return 1;
    }
    for (const t of this.trunks) {
      const dx = t.x - from.x, dz = t.z - from.z;
      const along = dx * dir.x + dz * dir.z;
      const horiz = Math.hypot(dir.x, dir.z);
      if (along <= 0 || horiz < 1e-4) continue;
      const tAlong = along / (horiz * horiz);
      if (tAlong > len - 0.3) continue;
      const px = from.x + dir.x * tAlong, pz = from.z + dir.z * tAlong;
      const y = from.y + dir.y * tAlong;
      if (Math.hypot(px - t.x, pz - t.z) < t.r * 0.9 && y < t.h * 0.6) return 1;
    }
    let leaf = 0;
    const C = this.leafClusters;
    const v = new THREE.Vector3();
    for (let i = 0; i < C.length; i += 4) {
      v.set(C[i], C[i + 1], C[i + 2]);
      if (v.distanceTo(to) < C[i + 3] + ignoreRadius) continue;
      const t = v.clone().sub(from).dot(dir);
      if (t < 0 || t > len) continue;
      const d = from.clone().addScaledVector(dir, t).distanceTo(v);
      if (d < C[i + 3]) leaf += 0.35 * (1 - d / C[i + 3]);
    }
    return clamp(leaf, 0, 1);
  }
}
