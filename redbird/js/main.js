import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { World } from './world.js';
import { Flock, BirdModel } from './birds.js';
import { SPECIES, SPECIES_BY_ID, RARITY } from './species.js';
import { AudioEngine } from './audio.js';
import { clamp, lerp, smoothstep, mulberry32 } from './noise.js';

const BIG_DAY_SECONDS = 600;
const DAY_START_MIN = 5 * 60 + 30;
const DAY_SPAN_MIN = 6 * 60;
const ALERT_AT = 0.42;
const STORE_KEY = 'redbird.lifelist.v1';
const SETTINGS_KEY = 'redbird.settings.v1';
const $ = (s) => document.querySelector(s);

// ------------------------------------------------------------------ storage

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
function saveLife(life) {
  if (save(STORE_KEY, life)) return;
  // Out of room: keep the list, drop the oldest photos.
  const slim = JSON.parse(JSON.stringify(life));
  for (const id of Object.keys(slim)) if (slim[id].photo) { slim[id].photo = null; if (save(STORE_KEY, slim)) return; }
}

const settings = Object.assign({ quality: 'high', sound: true, sensitivity: 1 }, load(SETTINGS_KEY, {}));
let life = load(STORE_KEY, {});

// ------------------------------------------------------------------ renderer

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 2600);
camera.rotation.order = 'YXZ';

// Depth of field that reads the scene's own depth, so leaves keep their shape.
class DOFPass extends Pass {
  constructor(cam) {
    super();
    this.camera = cam;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null },
        uFocus: { value: 5 }, uAperture: { value: 1 }, uMaxBlur: { value: 10 },
        uNear: { value: cam.near }, uFar: { value: cam.far }, uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth;
        uniform float uFocus, uAperture, uMaxBlur, uNear, uFar; uniform vec2 uRes;
        varying vec2 vUv;
        float linZ(float d){ float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
        float coc(float z){ return clamp(uAperture * abs(z - uFocus) / max(z, 0.001), 0.0, 1.0) * uMaxBlur; }
        void main(){
          vec4 base = texture2D(tColor, vUv);
          float z = linZ(texture2D(tDepth, vUv).x);
          float c = coc(z);
          if (c < 0.6) { gl_FragColor = base; return; }
          vec3 acc = base.rgb; float wsum = 1.0;
          for (int i = 1; i < 48; i++) {
            float t = float(i) / 48.0;
            float r = sqrt(t) * c;
            float a = float(i) * 2.39996323;
            vec2 uv2 = vUv + vec2(cos(a), sin(a)) * r / uRes;
            float sz = linZ(texture2D(tDepth, uv2).x);
            float sc = coc(sz);
            float w = sz < z ? smoothstep(r - 1.0, r + 1.0, sc) : smoothstep(r - 1.0, r + 1.0, min(sc, c));
            vec3 s = texture2D(tColor, uv2).rgb;
            float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
            w *= 1.0 + smoothstep(0.9, 3.0, lum) * 3.0;
            acc += s * w; wsum += w;
          }
          gl_FragColor = vec4(acc / wsum, base.a);
        }`,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  setSize(w, h) { this.material.uniforms.uRes.value.set(w, h); }
  render(r, writeBuffer, readBuffer) {
    const u = this.material.uniforms;
    u.tColor.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    r.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(r);
  }
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.35 }, uGrain: { value: 0.018 }, uRes: { value: new THREE.Vector2(1, 1) }, uWarm: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uWarm; uniform vec2 uRes;
    varying vec2 vUv;
    float rnd(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= vec3(1.0 + uWarm * 0.035, 1.0 + uWarm * 0.005, 1.0 - uWarm * 0.045);
      vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
      c.rgb *= mix(1.0, smoothstep(1.05, 0.3, length(d)), uVignette);
      c.rgb += (rnd(vUv * uRes + fract(uTime)) - 0.5) * uGrain * (0.4 + c.rgb);
      gl_FragColor = c;
    }`,
};

const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(1, 1) });
const composer = new EffectComposer(renderer, sceneTarget);
composer.addPass(new RenderPass(scene, camera));
const dof = new DOFPass(camera);
composer.addPass(dof);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.55, 0.92);
composer.addPass(bloom);
const grade = new ShaderPass(GradeShader);
composer.addPass(grade);
composer.addPass(new OutputPass());

function applyQuality() {
  const q = settings.quality;
  const pr = Math.min(devicePixelRatio || 1, q === 'high' ? 1.5 : q === 'medium' ? 1 : 0.75);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  renderer.shadowMap.enabled = q !== 'low';
  bloom.enabled = q !== 'low';
  resize();
  $('#quality').textContent = 'Graphics: ' + q[0].toUpperCase() + q.slice(1);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pr = renderer.getPixelRatio();
  grade.uniforms.uRes.value.set(w * pr, h * pr);
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ world

const audio = new AudioEngine();
audio.enabled = settings.sound;
let world, flock, heroBird, portraits = {};

function setLoading(text) { $('#loading-text').textContent = text; }

async function boot() {
  await new Promise((r) => setTimeout(r, 30));
  setLoading('Growing the woods');
  await new Promise((r) => setTimeout(r, 20));
  world = new World(scene, renderer, { grassCount: { low: 9000, medium: 22000, high: 34000 }[settings.quality] || 22000 });
  setLoading('Filling the feeders');
  await new Promise((r) => setTimeout(r, 20));
  flock = new Flock(world, scene);
  heroBird = new BirdModel(SPECIES_BY_ID.cardinal, SPECIES_BY_ID.cardinal.variants[0], { castShadow: true });
  heroBird.root.scale.setScalar(0.23);
  heroBird.root.position.copy(world.hero.perch.pos);
  scene.add(heroBird.root);
  setLoading('Painting the field guide');
  await new Promise((r) => setTimeout(r, 20));
  applyQuality();
  renderPortraits();
  world.setTimeOfDay(0.06, true);
  resetPlayer();
  state = 'title';
  showScreen('title');
  $('#loading').hidden = true;
  updateTitleStats();
  last = performance.now();
  requestAnimationFrame(loop);
}

// Portraits and silhouettes for the field guide and the song quiz.
function renderPortraits() {
  const ps = new THREE.Scene();
  ps.background = new THREE.Color(0x1a2620);
  ps.add(new THREE.HemisphereLight(0xdfe8f0, 0x3a4630, 1.4));
  const key = new THREE.DirectionalLight(0xfff0e0, 3.2);
  key.position.set(2, 3, 3);
  ps.add(key);
  const rim = new THREE.DirectionalLight(0xbcd4ff, 1.6);
  rim.position.set(-3, 2, -2);
  ps.add(rim);
  const pc = new THREE.PerspectiveCamera(28, 4 / 3, 0.01, 20);
  const W = 320, H = 240;
  const prevPR = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');
  const black = new THREE.MeshBasicMaterial({ color: 0x0a0f0c });
  for (const sp of SPECIES) {
    const m = new BirdModel(sp, sp.variants[0]);
    m.pose.headYaw = 0.35;
    if (sp.shape.archetype === 'duck') m.pose.legs = false;
    m.apply();
    m.root.rotation.y = -Math.PI / 2 + 0.35;
    ps.add(m.root);
    const box = new THREE.Box3().setFromObject(m.root);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    pc.position.set(c.x + size * 0.35, c.y + size * 0.25, c.z + size * 2.1);
    pc.lookAt(c);
    const res = {};
    for (const mode of ['photo', 'shadow']) {
      ps.overrideMaterial = mode === 'shadow' ? black : null;
      ps.background.setHex(mode === 'shadow' ? 0x2a3830 : 0x1a2620);
      renderer.render(ps, pc);
      g.clearRect(0, 0, W, H);
      g.drawImage(renderer.domElement, 0, 0, W, H, 0, 0, W, H);
      res[mode] = out.toDataURL('image/jpeg', 0.86);
    }
    ps.overrideMaterial = null;
    ps.remove(m.root);
    portraits[sp.id] = res;
  }
  renderer.setPixelRatio(prevPR);
  resize();
}

// ------------------------------------------------------------------ player & input

const player = {
  pos: new THREE.Vector3(), yaw: -Math.PI / 2, pitch: 0, eye: 1.62, crouch: false,
  noise: 0.4, stepAcc: 0, bob: 0, raise: 0, raiseHeld: false, raiseToggle: false,
  zoom: 5, focus: 20, focusTarget: 20, af: null, angVel: 0, speed: 0,
};
const keys = new Set();
let pointerLocked = false;
let dragLook = false;
let lastMouse = null;

function resetPlayer() {
  player.pos.set(world.deckTop.x + 3.4, 0, world.deckTop.z + 0.5);
  player.pos.y = world.groundHeight(player.pos.x, player.pos.z);
  player.yaw = -0.62;
  player.pitch = 0.02;
  player.crouch = false;
  player.raise = 0;
  player.raiseHeld = false;
  player.raiseToggle = false;
  player.zoom = 5;
}

function requestLock() {
  const el = renderer.domElement;
  try {
    const p = el.requestPointerLock?.();
    if (p && p.catch) p.catch(() => { dragLook = true; });
  } catch (e) { dragLook = true; }
}

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if (pointerLocked) dragLook = false;
  if (!pointerLocked && state === 'playing' && !idPrompt && !dragLook) pause();
});
document.addEventListener('pointerlockerror', () => { dragLook = true; });

addEventListener('mousemove', (e) => {
  if (state !== 'playing') return;
  let dx = 0, dy = 0;
  if (pointerLocked) { dx = e.movementX; dy = e.movementY; }
  else if (dragLook && lastMouse && (e.buttons & 1 || e.buttons & 2)) { dx = e.clientX - lastMouse[0]; dy = e.clientY - lastMouse[1]; }
  lastMouse = [e.clientX, e.clientY];
  const k = 0.0022 * settings.sensitivity * (camera.fov / 70);
  player.yaw -= dx * k;
  player.pitch = clamp(player.pitch - dy * k, -1.45, 1.45);
  player.angVel += Math.hypot(dx, dy) * k;
});

renderer.domElement.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  lastMouse = [e.clientX, e.clientY];
  if (!pointerLocked) {
    requestLock();
    if (!dragLook) return;
  }
  if (e.button === 2) player.raiseHeld = true;
  if (e.button === 0 && player.raise > 0.6) shutter();
});
addEventListener('mouseup', (e) => { if (e.button === 2) player.raiseHeld = false; });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (state !== 'playing' || player.raise < 0.3) return;
  player.zoom = clamp(player.zoom * (e.deltaY > 0 ? 0.88 : 1.14), 2, 16);
}, { passive: true });

addEventListener('keydown', (e) => {
  if (state === 'playing' && ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (state !== 'playing') {
    if (e.code === 'Escape') closeOverlays();
    return;
  }
  if (idPrompt && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) { answerId(Number(e.code.slice(-1)) - 1); return; }
  switch (e.code) {
    case 'KeyC': player.crouch = !player.crouch; break;
    case 'KeyQ': case 'KeyZ': player.raiseToggle = !player.raiseToggle; break;
    case 'Space': if (player.raise > 0.6) shutter(); break;
    case 'KeyE': identifySong(); break;
    case 'BracketRight': case 'Equal': player.zoom = clamp(player.zoom * 1.2, 2, 16); break;
    case 'BracketLeft': case 'Minus': player.zoom = clamp(player.zoom / 1.2, 2, 16); break;
    case 'KeyG': pause('guide'); break;
    case 'Escape': if (dragLook) pause(); break;
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); player.raiseHeld = false; });

function updatePlayer(dt) {
  const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const str = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
  player.yaw += turn * dt * 1.6;
  const running = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !player.crouch && player.raise < 0.5;
  const raised = player.raiseHeld || player.raiseToggle;
  const moving = fwd !== 0 || str !== 0;
  let speed = player.crouch ? 1.2 : running ? 5.2 : 2.3;
  if (player.raise > 0.5) speed *= 0.45;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const vx = (-sin * fwd + cos * str), vz = (-cos * fwd - sin * str);
  const len = Math.hypot(vx, vz) || 1;
  const target = moving ? speed : 0;
  player.speed = lerp(player.speed, target, 1 - Math.exp(-dt * 10));
  player.pos.x += (vx / len) * player.speed * dt * (moving ? 1 : 0);
  player.pos.z += (vz / len) * player.speed * dt * (moving ? 1 : 0);
  world.collide(player.pos);
  player.pos.y = world.groundHeight(player.pos.x, player.pos.z);

  // How far away birds notice you.
  const noiseTarget = !moving ? (player.crouch ? 0.3 : 0.45) : player.crouch ? 0.55 : running ? 2.1 : 1.0;
  player.noise = lerp(player.noise, noiseTarget, 1 - Math.exp(-dt * (noiseTarget > player.noise ? 8 : 1.5)));

  if (moving) {
    player.stepAcc += player.speed * dt;
    player.bob += player.speed * dt * 2.1;
    const stride = running ? 0.95 : 0.7;
    if (player.stepAcc > stride) { player.stepAcc = 0; audio.step(running); }
  }
  player.eye = lerp(player.eye, player.crouch ? 1.0 : 1.62, 1 - Math.exp(-dt * 8));
  player.raise = clamp(player.raise + (raised ? dt : -dt) * 4.5, 0, 1);

  // Handheld sway grows with zoom; sneaking and standing still steady it.
  const t = clock.elapsedTime;
  const steady = player.crouch ? 0.45 : 1;
  const sway = player.raise * (0.0006 + player.zoom * 0.00018) * steady * (moving ? 2.5 : 1);
  const swayYaw = Math.sin(t * 1.3) * sway + Math.sin(t * 2.9) * sway * 0.5;
  const swayPitch = Math.cos(t * 1.1) * sway + Math.sin(t * 3.7) * sway * 0.4;
  const bobY = moving ? Math.sin(player.bob * 2) * 0.025 * (running ? 1.8 : 1) : 0;
  camera.position.set(player.pos.x, player.pos.y + player.eye + bobY, player.pos.z);
  camera.rotation.set(player.pitch + swayPitch, player.yaw + swayYaw, 0);
  const fov = lerp(70, 70 / player.zoom, smoothstep(0, 1, player.raise));
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  player.angVel *= Math.exp(-dt * 12);
  player.angVel += (Math.abs(turn) * 1.6 + (moving ? 0.2 : 0)) * dt;
  player.running = running;
  player.moving = moving;
}

// ------------------------------------------------------------------ session

let session = null;
let state = 'loading';
let prevState = null;
const clock = new THREE.Clock(false);
let last = 0;
let elapsed = 0;
let alertFired = false;

function newSession() {
  session = { species: {}, order: [], score: 0, photos: [], flushes: 0, lastFlushMsg: -99, heardAttempts: {}, songs: [] };
  elapsed = 0;
  alertFired = false;
}

function speciesKnown(id) {
  return !!(life[id]?.seen || life[id]?.heard || session?.species[id]);
}

function logEvent(html, kind = '') {
  const el = document.createElement('li');
  el.className = kind;
  el.innerHTML = html;
  const list = $('#log');
  list.prepend(el);
  while (list.children.length > 5) list.lastChild.remove();
  setTimeout(() => el.classList.add('fade'), 9000);
  setTimeout(() => el.remove(), 10500);
}

function clockLabel(frac) {
  const mins = DAY_START_MIN + frac * DAY_SPAN_MIN;
  const h = Math.floor(mins / 60), m = Math.floor(mins % 60);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function award(id, { seen = false, heard = false, stars = 0, behavior = null, photo = null, variant = null }) {
  const sp = SPECIES_BY_ID[id];
  const base = RARITY[sp.rarity].points;
  let rec = session.species[id];
  let pts = 0;
  const events = [];
  if (!rec) {
    rec = session.species[id] = { seen: false, heard: false, stars: 0, behaviors: [], time: clockLabel(elapsed / BIG_DAY_SECONDS), photo: null };
    session.order.push(id);
    events.push('new');
  }
  if (seen && !rec.seen) { pts += rec.heard ? base * 0.5 : base; rec.seen = true; }
  if (heard && !rec.heard && !rec.seen) { pts += base * 0.5; rec.heard = true; }
  if (stars > rec.stars) { pts += (stars - rec.stars) * base * 0.25; rec.stars = stars; if (photo) rec.photo = photo; }
  if (behavior && !rec.behaviors.includes(behavior)) { rec.behaviors.push(behavior); pts += 50; }
  session.score += Math.round(pts);

  // Life list.
  const L = life[id] || (life[id] = { seen: false, heard: false, stars: 0, photo: null, first: null, variants: [] });
  let lifer = false;
  if (!L.seen && !L.heard) { lifer = true; L.first = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); rec.lifer = true; }
  if (seen) L.seen = true;
  if (heard) L.heard = true;
  if (variant && !L.variants.includes(variant)) L.variants.push(variant);
  if (stars > (L.stars || 0) || (stars && !L.photo)) { L.stars = Math.max(stars, L.stars || 0); if (photo) L.photo = photo; }
  saveLife(life);
  return { pts: Math.round(pts), isNew: events.includes('new'), lifer };
}

// ------------------------------------------------------------------ camera & photos

let pendingShot = false;
let lastShot = 0;

function shutter() {
  const now = performance.now();
  if (now - lastShot < 350) return;
  lastShot = now;
  pendingShot = true;
  audio.shutter();
  const flash = $('#flash');
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function birdCenterFast(b, out) {
  const s = b.root.scale.x;
  return out.copy(b.root.position).add(_v2.set(0, b.model.posture.position.y * s, 0));
}

// Autofocus: the bird nearest the middle of the frame.
function findFocusBird() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  let best = null, bestAng = fovRad * 0.09;
  for (const b of flock.birds) {
    if (!b.active || !b.root.visible) continue;
    birdCenterFast(b, _v).sub(camera.position);
    const d = _v.length();
    if (d > 220) continue;
    const ang = Math.acos(clamp(_v.dot(dir) / d, -1, 1));
    const tol = bestAng + Math.atan(b.scale * 0.5 / d);
    if (ang < tol) { best = b; bestAng = ang; }
  }
  return best;
}

function groundFocusDistance() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  for (let d = 1; d < 120; d *= 1.15) {
    const p = _v.copy(camera.position).addScaledVector(dir, d);
    if (world.groundHeight(p.x, p.z) > p.y) return d;
  }
  return 80;
}

function capture() {
  const src = renderer.domElement;
  const W = 960, H = 540;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const sa = src.width / src.height, da = W / H;
  let sw = src.width, sh = src.height, sx = 0, sy = 0;
  if (sa > da) { sw = sh * da; sx = (src.width - sw) / 2; } else { sh = sw / da; sy = (src.height - sh) / 2; }
  g.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
  const thumb = document.createElement('canvas');
  thumb.width = 320;
  thumb.height = 180;
  thumb.getContext('2d').drawImage(cv, 0, 0, 320, 180);
  return { full: cv.toDataURL('image/jpeg', 0.86), thumb: thumb.toDataURL('image/jpeg', 0.8) };
}

function evaluatePhoto(img) {
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const viewDir = camera.getWorldDirection(new THREE.Vector3());
  const results = [];
  for (const b of flock.birds) {
    if (!b.active || !b.root.visible) continue;
    const center = b.center(new THREE.Vector3());
    const dist = center.distanceTo(camera.position);
    if (dist > 250) continue;
    const ndc = center.clone().project(camera);
    if (ndc.z > 1 || Math.abs(ndc.x) > 1.02 || Math.abs(ndc.y) > 1.02) continue;
    const frac = b.scale / (2 * dist * Math.tan(fovRad / 2));
    if (frac < 0.018) continue;
    const occ = world.occlusion(camera.position, center, b.scale * 0.9);
    const vis = 1 - occ;
    if (vis < 0.3) continue;
    const notes = [];
    const size = smoothstep(0.04, 0.26, frac) * (1 - 0.4 * smoothstep(0.8, 1.3, frac));
    if (frac < 0.1) notes.push('Too far away');
    if (frac > 0.9) notes.push('Cropped too tight');
    const off = Math.hypot(ndc.x * camera.aspect, ndc.y) / camera.aspect;
    let comp = 1 - smoothstep(0.35, 0.95, off);
    if (Math.abs(Math.abs(ndc.x) - 0.33) < 0.1 && Math.abs(ndc.y) < 0.45) comp = Math.min(1, comp + 0.15);
    if (off > 0.8) notes.push('Near the edge of the frame');
    const focusErr = Math.abs(player.focus - dist) / dist;
    const focus = 1 - smoothstep(0.04, 0.25, focusErr);
    if (focus < 0.6) notes.push('Out of focus');
    const camBlur = player.angVel / fovRad;
    const birdBlur = b.velocity.length() / dist / fovRad;
    const sharp = clamp(1 - smoothstep(0.02, 0.35, camBlur) - smoothstep(0.15, 1.2, birdBlur) * 0.5, 0, 1);
    if (camBlur > 0.12) notes.push('Camera shake');
    if (birdBlur > 0.5) notes.push('Motion blur');
    const toCam = camera.position.clone().sub(center).normalize();
    const facingDot = b.forward(new THREE.Vector3()).dot(toCam);
    const facing = facingDot < -0.55 ? 0.45 : facingDot > 0.6 ? 0.9 : 1;
    if (facingDot < -0.55) notes.push('Mostly tail');
    const backlit = smoothstep(0.55, 0.9, viewDir.dot(world.sunDir));
    if (backlit > 0.4) notes.push('Backlit');
    if (vis < 0.75) notes.push('Branches in the way');
    const light = 1 - backlit * 0.2;
    const q = 100 * (0.3 * size + 0.16 * comp + 0.22 * focus + 0.2 * sharp + 0.12 * facing) * Math.pow(vis, 0.7) * light;
    results.push({ bird: b, q: Math.round(q), notes, behavior: b.behavior(), dist });
  }
  results.sort((a, b) => b.q - a.q);
  const main = results[0];
  const shot = { img, time: clockLabel(elapsed / BIG_DAY_SECONDS), subject: null, q: 0, stars: 0 };
  if (!main || main.q < 25) {
    showPhotoCard({ img: img.thumb, title: main ? 'Not enough to ID' : 'No bird in the frame', detail: main ? main.notes.slice(0, 2).join(' · ') || 'Get closer or zoom in' : 'Aim the focus square at a bird', stars: 0 });
    session.photos.push(shot);
    return;
  }
  const stars = main.q >= 82 ? 3 : main.q >= 58 ? 2 : 1;
  const sp = main.bird.sp;
  shot.subject = sp.id;
  shot.q = main.q;
  shot.stars = stars;
  shot.behavior = main.behavior;
  session.photos.push(shot);
  const res = award(sp.id, { seen: true, stars, behavior: main.behavior, photo: img.thumb, variant: main.bird.variant.key });
  for (const r of results.slice(1)) {
    if (r.q >= 30 && r.bird.sp.id !== sp.id) {
      const extra = award(r.bird.sp.id, { seen: true, stars: r.q >= 82 ? 3 : r.q >= 58 ? 2 : 1, behavior: r.behavior, variant: r.bird.variant.key });
      if (extra.isNew) logEvent(`<b>${r.bird.sp.name}</b> also in frame <span>+${extra.pts}</span>`, 'new');
    }
  }
  const variantLabel = sp.variants.length > 1 ? main.bird.variant.label : null;
  showPhotoCard({
    img: img.thumb, title: sp.name, stars,
    detail: [main.behavior, variantLabel].filter(Boolean).join(' · ') || main.notes.slice(0, 2).join(' · ') || 'Clean shot',
    tip: main.behavior ? main.notes[0] : main.notes[1],
    pts: res.pts, isNew: res.isNew, lifer: res.lifer, rarity: sp.rarity,
  });
  if (res.isNew) {
    audio.chime(sp.rarity === 'rare' || sp.rarity === 'vagrant' ? 'rare' : 'new');
    logEvent(`<b>${sp.name}</b> ${res.lifer ? 'lifer!' : 'new for the day'} <span>+${res.pts}</span>`, 'new');
  } else if (res.pts > 0) {
    logEvent(`Better shot of <b>${sp.name}</b> <span>+${res.pts}</span>`);
  }
}

function starString(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

let cardTimer = null;
function showPhotoCard({ img, title, detail, tip, stars, pts, isNew, lifer, rarity }) {
  const c = $('#photo-card');
  c.querySelector('img').src = img;
  c.querySelector('.pc-title').textContent = title;
  c.querySelector('.pc-stars').textContent = stars ? starString(stars) : '';
  c.querySelector('.pc-detail').textContent = detail || '';
  c.querySelector('.pc-tip').textContent = tip ? 'Tip: ' + tipFor(tip) : '';
  const badge = c.querySelector('.pc-badge');
  badge.hidden = !isNew;
  badge.textContent = lifer ? 'Lifer' : 'New today';
  c.querySelector('.pc-pts').textContent = pts ? `+${pts}` : '';
  c.dataset.rarity = rarity || '';
  c.hidden = false;
  c.classList.remove('in');
  void c.offsetWidth;
  c.classList.add('in');
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => c.classList.remove('in'), 4200);
}

function tipFor(note) {
  return {
    'Too far away': 'zoom in with the scroll wheel, or sneak closer (C).',
    'Out of focus': 'hold the focus square on the bird until it turns green.',
    'Camera shake': 'stop moving the mouse just before you press the shutter.',
    'Motion blur': 'birds in flight are hard. Pan with them or wait for a landing.',
    'Mostly tail': 'wait for the bird to turn side-on.',
    'Backlit': 'circle around so the sun is behind you.',
    'Branches in the way': 'step sideways for a clear line of sight.',
    'Near the edge of the frame': 'put the bird closer to the middle or on a third.',
    'Cropped too tight': 'zoom out a little.',
  }[note] || note;
}

// ------------------------------------------------------------------ birding by ear

let idPrompt = null;

function onSong(bird, dur) {
  if (state !== 'playing') return;
  const d = bird.pos.distanceTo(camera.position);
  if (d > 70) return;
  session.songs = session.songs.filter((s) => s.until > elapsed && s.bird !== bird);
  session.songs.push({ bird, until: elapsed + dur + 5, dist: d });
}

function identifySong() {
  if (idPrompt) return;
  const candidates = session.songs.filter((s) => s.until > elapsed && !session.species[s.bird.sp.id]);
  if (!candidates.length) {
    const any = session.songs.find((s) => s.until > elapsed);
    logEvent(any ? `That's a <b>${any.bird.sp.name}</b>. Already on today's list.` : 'Listen for a song first, then press E.');
    return;
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const target = candidates[0];
  const sp = target.bird.sp;
  const cool = session.heardAttempts[sp.id];
  if (cool && elapsed - cool < 15) { logEvent(`Give it a moment and listen again.`); return; }
  const rng = mulberry32(Math.floor(elapsed * 1000));
  const pool = SPECIES.filter((s) => s.id !== sp.id && !s.alertOnly);
  const decoys = [];
  while (decoys.length < 2) {
    const d = pool[Math.floor(rng() * pool.length)];
    if (!decoys.includes(d)) decoys.push(d);
  }
  const options = [sp, ...decoys].sort(() => rng() - 0.5);
  idPrompt = { sp, options, until: elapsed + 9 };
  const box = $('#id-prompt');
  const list = box.querySelector('.id-options');
  list.innerHTML = '';
  options.forEach((o, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'id-option';
    btn.innerHTML = `<img alt="" src="${portraits[o.id].photo}"><span class="k">${i + 1}</span><span class="n">${o.name}</span>`;
    btn.addEventListener('click', () => answerId(i));
    list.appendChild(btn);
  });
  box.hidden = false;
}

function answerId(i) {
  if (!idPrompt) return;
  const pick = idPrompt.options[i];
  const sp = idPrompt.sp;
  $('#id-prompt').hidden = true;
  if (pick.id === sp.id) {
    const res = award(sp.id, { heard: true });
    audio.chime('new');
    logEvent(`Heard <b>${sp.name}</b>${res.lifer ? ' · lifer!' : ''} <span>+${res.pts}</span>`, 'new');
  } else {
    audio.chime('wrong');
    session.heardAttempts[sp.id] = elapsed;
    logEvent(`Not a ${pick.name}. That song was a <b>${sp.name}</b>.`, 'miss');
  }
  idPrompt = null;
}

// ------------------------------------------------------------------ flow

function showScreen(name) {
  for (const id of ['title', 'hud', 'pause', 'results']) $('#' + id).hidden = id !== name && !(name === 'pause' && id === 'hud');
}

function startGame() {
  audio.unlock();
  newSession();
  resetPlayer();
  for (const b of flock.birds) if (b.sp.alertOnly) { b.active = false; b.root.visible = false; }
  heroBird.root.visible = false;
  $('#log').innerHTML = '';
  $('#photo-card').hidden = true;
  $('#alert').hidden = true;
  $('#id-prompt').hidden = true;
  idPrompt = null;
  intro = { t: 0, fromPos: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov };
  state = 'intro';
  showScreen('hud');
  requestLock();
}

let intro = null;

function pause(open) {
  if (state !== 'playing') return;
  state = 'paused';
  player.raiseHeld = false;
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen('pause');
  if (open === 'guide') openGuide();
}

function resume() {
  closeOverlays();
  state = 'playing';
  showScreen('hud');
  requestLock();
}

function endGame() {
  state = 'results';
  if (document.pointerLockElement) document.exitPointerLock();
  $('#id-prompt').hidden = true;
  idPrompt = null;
  renderResults();
  showScreen('results');
}

function toTitle() {
  closeOverlays();
  state = 'title';
  heroBird.root.visible = true;
  world.setTimeOfDay(0.06, true);
  showScreen('title');
  updateTitleStats();
}

function closeOverlays() {
  $('#guide').hidden = true;
  $('#help').hidden = true;
}

function updateTitleStats() {
  const n = Object.values(life).filter((l) => l.seen || l.heard).length;
  $('#guide-count').textContent = `${n}/${SPECIES.length}`;
  $('#best-score').textContent = life._best ? `Best Big Day: ${life._best.species} species, ${life._best.score.toLocaleString()} pts` : 'No Big Days logged yet';
}

// ------------------------------------------------------------------ field guide

function openGuide() {
  const grid = $('#guide-grid');
  grid.innerHTML = '';
  let count = 0;
  for (const sp of SPECIES) {
    const L = life[sp.id];
    const known = L && (L.seen || L.heard);
    if (known) count++;
    const card = document.createElement('article');
    card.className = 'g-card' + (known ? '' : ' unknown');
    const img = L?.photo || (known ? portraits[sp.id].photo : portraits[sp.id].shadow);
    const status = L?.seen ? `Seen ${starString(L.stars || 0)}` : L?.heard ? 'Heard only' : 'Not yet recorded';
    const plumages = sp.variants.length > 1 ? `<p class="g-plum">${sp.variants.map((v) => `<span class="${L?.variants?.includes(v.key) ? 'got' : ''}">${v.label}</span>`).join('')}</p>` : '';
    card.innerHTML = `
      <div class="g-img"><img alt="" src="${img}"><span class="g-rarity r-${sp.rarity}">${RARITY[sp.rarity].label}</span></div>
      <div class="g-body">
        <h3>${known ? sp.name : '? ? ?'}</h3>
        <p class="latin">${known ? sp.latin : 'Keep looking and listening'}</p>
        <p class="g-status">${status}${L?.first ? ` · first ${L.first}` : ''}</p>
        ${known ? `<p class="g-marks">${sp.fieldMarks}</p><p class="g-fact">${sp.fact}</p>` : `<p class="g-marks">${hintFor(sp)}</p>`}
        ${plumages}
      </div>`;
    grid.appendChild(card);
  }
  $('#guide-total').textContent = `${count} of ${SPECIES.length} species on your life list`;
  $('#guide').hidden = false;
}

function hintFor(sp) {
  const where = { feeder: 'the feeders', feederGround: 'under the feeders', shrub: 'thickets', canopy: 'the treetops', treetop: 'high perches', lawn: 'the lawn', meadow: 'the meadow', fence: 'fence posts', cattail: 'the cattails', water: 'the pond', shore: 'the pond edge', trunk: 'tree trunks', snag: 'the dead snag', pine: 'the pine grove', flowers: 'meadow flowers', nectar: 'red flowers by the house', birdbath: 'the birdbath', sky: 'the sky', nestbox: 'nest boxes' };
  const top = Object.entries(sp.habitats).sort((a, b) => b[1] - a[1])[0][0];
  if (sp.alertOnly) return 'Only turns up when a rare bird alert goes out.';
  return `Hint: try ${where[top] || 'around the yard'}.${sp.dawnOnly ? ' Calls only around dawn.' : ''}`;
}

// ------------------------------------------------------------------ results

function renderResults() {
  const recs = session.order.map((id) => ({ id, ...session.species[id], sp: SPECIES_BY_ID[id] }));
  const seen = recs.filter((r) => r.seen).length;
  const heard = recs.filter((r) => !r.seen && r.heard).length;
  const lifers = recs.filter((r) => r.lifer).length;
  $('#r-species').textContent = recs.length;
  $('#r-seen').textContent = seen;
  $('#r-heard').textContent = heard;
  $('#r-lifers').textContent = lifers;
  $('#r-score').textContent = session.score.toLocaleString();
  const best = session.photos.filter((p) => p.subject).sort((a, b) => b.q - a.q)[0];
  const hero = $('#r-best');
  if (best) {
    hero.hidden = false;
    hero.querySelector('img').src = best.img.full;
    hero.querySelector('figcaption').textContent = `Best shot: ${SPECIES_BY_ID[best.subject].name} · ${starString(best.stars)}${best.behavior ? ' · ' + best.behavior : ''} · ${best.time}`;
  } else hero.hidden = true;
  $('#r-nophoto').hidden = !!best;
  const list = $('#r-list');
  list.innerHTML = recs.length ? '' : '<li class="empty">No species logged. Try the feeders first, and sneak (C) as you get close.</li>';
  for (const r of recs) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="t">${r.time}</span><span class="n">${r.sp.name}${r.lifer ? ' <em>lifer</em>' : ''}</span><span class="h">${r.seen ? starString(r.stars) : 'heard'}</span>`;
    list.appendChild(li);
  }
  const strip = $('#r-strip');
  strip.innerHTML = '';
  for (const p of session.photos.filter((p) => p.subject).slice(-12)) {
    const img = document.createElement('img');
    img.src = p.img.thumb;
    img.alt = SPECIES_BY_ID[p.subject].name;
    strip.appendChild(img);
  }
  if (!life._best || session.order.length > life._best.species || (session.order.length === life._best.species && session.score > life._best.score)) {
    life._best = { species: session.order.length, score: session.score };
    saveLife(life);
    $('#r-record').hidden = session.order.length === 0;
  } else $('#r-record').hidden = true;
  const bestName = best ? `${SPECIES_BY_ID[best.subject].name} ${starString(best.stars)}` : 'none';
  $('#r-share').textContent = 'Copy result';
  $('#r-share-text').hidden = true;
  $('#r-share').dataset.text = `Redbird Big Day: ${recs.length} species (${seen} seen, ${heard} heard), ${session.score.toLocaleString()} pts. Best shot: ${bestName}.`;
}

// ------------------------------------------------------------------ HUD

const hudCache = {};
function setText(sel, text) {
  if (hudCache[sel] === text) return;
  hudCache[sel] = text;
  $(sel).textContent = text;
}

const compassEls = [];
function updateHUD() {
  const frac = elapsed / BIG_DAY_SECONDS;
  setText('#clock', clockLabel(frac));
  const left = Math.max(0, BIG_DAY_SECONDS - elapsed);
  setText('#timer', `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} left`);
  $('#time-bar').style.transform = `scaleX(${1 - frac})`;
  const n = session.order.length;
  setText('#count', String(n));
  setText('#score', session.score.toLocaleString() + ' pts');
  const stance = player.running ? 'Running · loud' : player.crouch ? (player.moving ? 'Sneaking · quiet' : 'Crouched · still') : player.moving ? 'Walking' : 'Standing still';
  setText('#stance', stance);
  $('#noise-bar').style.transform = `scaleX(${clamp(player.noise / 2.1, 0.05, 1)})`;
  $('#noise-bar').dataset.level = player.noise > 1.5 ? 'loud' : player.noise > 0.8 ? 'mid' : 'low';

  // Compass.
  const fwd = camera.getWorldDirection(_v);
  const heading = Math.atan2(fwd.x, -fwd.z);
  const strip = $('#compass');
  const W = strip.clientWidth;
  const items = [];
  for (const [label, deg] of [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]]) items.push({ label, bearing: THREE.MathUtils.degToRad(deg), cls: label.length === 1 ? 'cardinal-pt' : 'minor-pt' });
  // Landmarks, nearest first, dropping any label that would overlap a closer one.
  const lms = world.landmarks.map((lm) => ({ lm, d: lm.pos.distanceTo(camera.position) })).sort((a, b) => a.d - b.d);
  const placed = [];
  for (const { lm } of lms) {
    let rel = Math.atan2(lm.pos.x - camera.position.x, -(lm.pos.z - camera.position.z)) - heading;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const x = (rel / (Math.PI / 2)) * (W / 2);
    if (placed.some((px) => Math.abs(px - x) < 64)) continue;
    placed.push(x);
    items.push({ label: lm.name, bearing: rel + heading, cls: 'landmark' + (alertFired && lm.name === 'Feeders' ? ' alerting' : '') });
  }
  for (const s of session.songs) {
    if (s.until < elapsed) continue;
    const p = s.bird.pos;
    const known = speciesKnown(s.bird.sp.id) && life[s.bird.sp.id] && (life[s.bird.sp.id].seen || life[s.bird.sp.id].heard);
    const logged = !!session.species[s.bird.sp.id];
    items.push({ label: '♪ ' + (known ? s.bird.sp.name : 'unknown song'), bearing: Math.atan2(p.x - camera.position.x, -(p.z - camera.position.z)), cls: 'song' + (logged ? ' logged' : ''), fade: clamp((s.until - elapsed) / 3, 0, 1) });
  }
  while (compassEls.length < items.length) {
    const el = document.createElement('span');
    strip.appendChild(el);
    compassEls.push(el);
  }
  compassEls.forEach((el, i) => {
    const it = items[i];
    if (!it) { el.hidden = true; return; }
    let rel = it.bearing - heading;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const x = (rel / (Math.PI / 2)) * (W / 2);
    const isSong = it.cls.startsWith('song');
    if (Math.abs(rel) > Math.PI / 2 && !isSong) { el.hidden = true; return; }
    el.hidden = false;
    el.className = it.cls;
    const cx = isSong ? clamp(x, -W / 2 + 40, W / 2 - 40) : x;
    el.textContent = isSong && Math.abs(rel) > Math.PI / 2 ? (rel < 0 ? '◂ ' : '') + it.label + (rel > 0 ? ' ▸' : '') : it.label;
    el.style.transform = `translateX(${cx}px) translateX(-50%)`;
    el.style.opacity = it.fade ?? '';
  });
  const pendingSong = session.songs.some((s) => s.until > elapsed && !session.species[s.bird.sp.id]);
  $('#hint-listen').hidden = !pendingSong || !!idPrompt;

  // Viewfinder.
  const vf = $('#viewfinder');
  const r = player.raise;
  vf.style.opacity = smoothstep(0.3, 1, r);
  $('#crosshair').style.opacity = 1 - r;
  if (r > 0.3) {
    setText('#vf-zoom', player.zoom.toFixed(1) + '×');
    setText('#vf-dist', player.af ? player.focus.toFixed(1) + ' m' : '—');
    setText('#vf-mm', Math.round(24 * player.zoom) + 'mm');
    const locked = player.af && Math.abs(player.focus - player.focusTarget) / player.focusTarget < 0.05;
    vf.classList.toggle('locked', !!locked);
    const b = player.af;
    setText('#vf-id', b ? (speciesKnown(b.sp.id) ? b.sp.name : 'Unidentified bird') + (b.behavior() ? ' · ' + b.behavior().toLowerCase() : '') : '');
  }
}

// ------------------------------------------------------------------ main loop

const titleCam = { t: 0 };
function updateTitleCamera(dt) {
  titleCam.t += dt;
  const hero = world.hero.perch.pos;
  const center = hero.clone().add(new THREE.Vector3(0, 0.12, 0));
  const sunAz = Math.atan2(world.sunDir.x, world.sunDir.z);
  const ang = sunAz - 0.75 + Math.sin(titleCam.t * 0.07) * 0.3;
  const r = 0.95 + Math.sin(titleCam.t * 0.11) * 0.08;
  camera.position.set(center.x + Math.sin(ang) * r, center.y - 0.06 + Math.sin(titleCam.t * 0.13) * 0.04, center.z + Math.cos(ang) * r);
  camera.lookAt(center);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const narrow = camera.aspect < 0.9;
  camera.lookAt(center.clone().addScaledVector(right, narrow ? 0 : -0.24).add(new THREE.Vector3(0, narrow ? -0.12 : 0, 0)));
  if (camera.fov !== 38) { camera.fov = 38; camera.updateProjectionMatrix(); }

  // The cardinal faces into the frame and sings now and then.
  const m = heroBird;
  m.root.position.copy(hero);
  m.root.rotation.y = Math.atan2(-right.x, -right.z);
  heroSing.t -= dt;
  if (heroSing.t <= 0) {
    heroSing.t = 7 + Math.random() * 4;
    heroSing.singing = audio.song('cardinal', center, 3 + Math.floor(Math.random() * 3));
  }
  heroSing.singing = Math.max(0, heroSing.singing - dt);
  heroSing.look -= dt;
  if (heroSing.look <= 0) { heroSing.look = 0.6 + Math.random() * 2.2; heroSing.yaw = 0.05 + Math.random() * 0.75; heroSing.pitch = (Math.random() - 0.5) * 0.4; }
  const k = 1 - Math.exp(-dt * 16);
  m.pose.headYaw += ((heroSing.singing > 0 ? 0.2 : heroSing.yaw) - m.pose.headYaw) * k;
  m.pose.headPitch += ((heroSing.singing > 0 ? -0.4 : heroSing.pitch) - m.pose.headPitch) * k;
  m.pose.tailSpread = Math.max(0, m.pose.tailSpread - dt * 3);
  if (Math.random() < dt * 0.3) m.pose.tailSpread = 0.5;
  m.apply();

  const dist = camera.position.distanceTo(center);
  const u = dof.material.uniforms;
  u.uFocus.value = dist;
  u.uAperture.value = 3.2;
  u.uMaxBlur.value = 16 * (innerHeight * renderer.getPixelRatio()) / 1080;
  dof.enabled = true;
}
const heroSing = { t: 2, singing: 0, look: 0, yaw: 0, pitch: 0 };

function updateIntro(dt) {
  intro.t += dt / 1.6;
  const t = smoothstep(0, 1, Math.min(1, intro.t));
  camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const toPos = camera.position.clone(), toQuat = camera.quaternion.clone();
  camera.position.lerpVectors(intro.fromPos, toPos, t);
  camera.quaternion.slerpQuaternions(intro.fromQuat, toQuat, t);
  camera.fov = lerp(intro.fromFov, 70, t);
  camera.updateProjectionMatrix();
  dof.material.uniforms.uAperture.value = lerp(3.2, 0, t);
  dof.enabled = t < 0.98;
  if (intro.t >= 1) {
    camera.rotation.set(player.pitch, player.yaw, 0);
    state = 'playing';
    clock.start();
    logEvent('Big Day started. Birds sing most at dawn, so listen first.');
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;
  clock.elapsedTime = time;

  if (state === 'playing') {
    elapsed += dt;
    const frac = elapsed / BIG_DAY_SECONDS;
    world.setTimeOfDay(frac);
    updatePlayer(dt);
    if (!alertFired && frac > ALERT_AT) {
      alertFired = true;
      flock.activateAlert('bunting');
      $('#alert').hidden = false;
      audio.chime('alert');
      setTimeout(() => { $('#alert').hidden = true; }, 12000);
    }
    if (idPrompt && elapsed > idPrompt.until) { $('#id-prompt').hidden = true; idPrompt = null; }
    if (elapsed >= BIG_DAY_SECONDS) endGame();

    // Autofocus.
    const target = player.raise > 0.3 ? findFocusBird() : null;
    player.af = target;
    player.focusTarget = target ? birdCenterFast(target, _v).distanceTo(camera.position) : groundFocusDistance();
    player.focus = lerp(player.focus, player.focusTarget, 1 - Math.exp(-dt * 9));
    const u = dof.material.uniforms;
    u.uFocus.value = player.focus;
    u.uAperture.value = 0.9 * smoothstep(3, 12, player.zoom) + 0.15;
    u.uMaxBlur.value = 10 * player.raise * (innerHeight * renderer.getPixelRatio()) / 1080;
    dof.enabled = player.raise > 0.05;
  } else if (state === 'intro') {
    updateIntro(dt);
  } else if (state === 'title') {
    updateTitleCamera(dt);
  } else if (state === 'results' || state === 'paused') {
    if (state === 'results') {
      titleCam.t += dt;
      camera.rotation.y += dt * 0.03;
    }
    dof.enabled = false;
  }

  const ctx = {
    player: { pos: camera.position, noise: player.noise },
    audio: state === 'paused' ? null : audio,
    activity: state === 'playing' ? lerp(1.6, 0.6, elapsed / BIG_DAY_SECONDS) : 0.5,
    dayFrac: state === 'playing' ? elapsed / BIG_DAY_SECONDS : 0.06,
    playing: state === 'playing',
    onSong,
    onFlush: (b) => {
      session.flushes++;
      if (b.pos.distanceTo(camera.position) < 30 && elapsed - session.lastFlushMsg > 20) {
        session.lastFlushMsg = elapsed;
        logEvent(`You flushed a <b>${speciesKnown(b.sp.id) ? b.sp.name : 'bird'}</b>. ${player.running ? 'Running scares birds.' : 'Sneak with C to get closer.'}`, 'miss');
      }
    },
  };
  if (state !== 'paused') flock.update(dt, ctx);
  world.update(dt, time, camera);
  audio.setListener(camera);
  audio.updateAmbience(time, ctx.dayFrac, world.pond && new THREE.Vector3(world.pond.x, world.waterLevel, world.pond.z));
  grade.uniforms.uTime.value = time;
  grade.uniforms.uVignette.value = state === 'playing' ? lerp(0.3, 0.55, player.raise) : 0.45;
  if (state === 'playing') updateHUD();
  if (state === 'title') autoQuality(dt);

  composer.render(dt);
  if (pendingShot) {
    pendingShot = false;
    evaluatePhoto(capture());
  }
}

// Drop the resolution once if the title screen runs slowly on this machine.
const perf = { t: 0, frames: 0, warm: 0, done: !!settings.manualQuality };
function autoQuality(dt) {
  if (perf.done) return;
  // Skip the first seconds, when shaders are still compiling.
  if (perf.warm < 1.5) { perf.warm += dt; return; }
  perf.t += dt;
  perf.frames++;
  if (perf.t < 3) return;
  perf.done = true;
  const avg = perf.t / perf.frames;
  const next = avg > 0.045 ? 'low' : avg > 0.03 && settings.quality === 'high' ? 'medium' : null;
  if (next && next !== settings.quality) {
    settings.quality = next;
    save(SETTINGS_KEY, settings);
    applyQuality();
  }
}

// ------------------------------------------------------------------ UI wiring

$('#start').addEventListener('click', startGame);
$('#open-guide').addEventListener('click', () => { audio.unlock(); openGuide(); });
$('#open-help').addEventListener('click', () => { audio.unlock(); $('#help').hidden = false; });
$('#guide-close').addEventListener('click', () => { $('#guide').hidden = true; });
$('#help-close').addEventListener('click', () => { $('#help').hidden = true; });
$('#resume').addEventListener('click', resume);
$('#pause-guide').addEventListener('click', openGuide);
$('#end-day').addEventListener('click', () => { state = 'playing'; endGame(); });
$('#quit').addEventListener('click', toTitle);
$('#again').addEventListener('click', startGame);
$('#r-guide').addEventListener('click', openGuide);
$('#r-title').addEventListener('click', toTitle);
$('#quality').addEventListener('click', () => {
  settings.quality = settings.quality === 'high' ? 'medium' : settings.quality === 'medium' ? 'low' : 'high';
  settings.manualQuality = true;
  perf.done = true;
  save(SETTINGS_KEY, settings);
  applyQuality();
});
const soundBtn = $('#sound');
function syncSound() { soundBtn.textContent = settings.sound ? 'Sound: On' : 'Sound: Off'; soundBtn.setAttribute('aria-pressed', String(settings.sound)); }
soundBtn.addEventListener('click', () => {
  settings.sound = !settings.sound;
  save(SETTINGS_KEY, settings);
  audio.unlock();
  audio.setEnabled(settings.sound);
  syncSound();
});
syncSound();
$('#r-share').addEventListener('click', async (e) => {
  const text = e.currentTarget.dataset.text || '';
  const out = $('#r-share-text');
  try {
    await navigator.clipboard.writeText(text);
    e.currentTarget.textContent = 'Copied';
  } catch (err) {
    out.hidden = false;
    out.value = text;
    out.select();
  }
});
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('#touch-note').hidden = false;

// Small hook for automated checks and curious players.
window.redbird = {
  get state() { return state; },
  get session() { return session; },
  get player() { return player; },
  get flock() { return flock; },
  teleport(x, z, yaw = player.yaw, pitch = 0) { player.pos.set(x, world.groundHeight(x, z), z); player.yaw = yaw; player.pitch = pitch; },
  skipIntro() { if (intro) intro.t = 1; },
  advance(seconds) { elapsed = Math.min(BIG_DAY_SECONDS - 0.5, elapsed + seconds); },
  end() { if (state === 'playing') endGame(); },
  hear(id) {
    const b = flock.birds.filter((x) => x.sp.id === id && x.active).sort((a, c) => a.pos.distanceTo(camera.position) - c.pos.distanceTo(camera.position))[0];
    if (b) onSong(b, 2);
  },
};

boot().catch((err) => {
  console.error(err);
  setLoading('Could not start: ' + err.message);
});
