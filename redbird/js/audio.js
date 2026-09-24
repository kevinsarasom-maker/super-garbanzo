// Synthesized birdsong, ambience and camera sounds (Web Audio, no samples).
// Each species' song is modeled on its real pattern: pitch contour, rhythm
// and timbre, played through a 3D panner at the bird's head.

import { mulberry32 } from './noise.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.rng = mulberry32(31337);
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4);
    const rvGain = ctx.createGain();
    rvGain.gain.value = 0.35;
    this.reverb.connect(rvGain).connect(this.master);

    this.birdBus = ctx.createGain();
    this.birdBus.gain.value = 1;
    this.birdBus.connect(this.master);
    this.birdSend = ctx.createGain();
    this.birdSend.gain.value = 0.5;
    this.birdBus.connect(this.birdSend).connect(this.reverb);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(this.master);

    this.noiseBuf = this.makeNoise(3);
    this.startAmbience();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  impulse(seconds) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        lp = lp * 0.7 + (Math.random() * 2 - 1) * 0.3;
        const early = t > 0.03 && t < 0.2 ? 1.6 : 1;
        d[i] = lp * Math.pow(1 - i / len, 3.2) * early * (t < 0.012 ? 0 : 1);
      }
    }
    return buf;
  }

  // ------------------------------------------------------------ ambience
  startAmbience() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    src.connect(lp).connect(this.windGain).connect(this.master);
    src.start();

    const src2 = ctx.createBufferSource();
    src2.buffer = this.noiseBuf;
    src2.loop = true;
    src2.playbackRate.value = 0.93;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4200;
    bp.Q.value = 0.6;
    this.leafGain = ctx.createGain();
    this.leafGain.gain.value = 0.008;
    src2.connect(bp).connect(this.leafGain).connect(this.master);
    src2.start();
    this.nextPeep = 0;
  }

  updateAmbience(time, dayFrac, pondPos) {
    if (!this.ctx) return;
    const gust = 0.5 + 0.5 * Math.sin(time * 0.21) * Math.sin(time * 0.087 + 1);
    this.windGain.gain.setTargetAtTime(0.03 + gust * 0.05, this.ctx.currentTime, 0.4);
    this.leafGain.gain.setTargetAtTime(0.004 + gust * 0.014, this.ctx.currentTime, 0.3);
    // Spring peepers call from the pond before the sun gets high.
    const chorus = Math.max(0, 1 - dayFrac * 1.6);
    if (pondPos && chorus > 0 && time > this.nextPeep) {
      this.nextPeep = time + (0.15 + this.rng() * 0.5) / chorus;
      const p = { x: pondPos.x + (this.rng() - 0.5) * 24, y: pondPos.y + 0.2, z: pondPos.z + (this.rng() - 0.5) * 24 };
      const v = this.voice(p, 0.5 * chorus);
      const t = this.now + 0.01;
      this.tone(v, t, 0.1, [[0, 2750], [1, 3150]], 0.35);
    }
  }

  setListener(camera) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    const p = camera.position;
    const f = camera.getWorldDirection(this._fwd || (this._fwd = camera.position.clone()));
    const t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, t, 0.02);
      L.positionY.setTargetAtTime(p.y, t, 0.02);
      L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02);
      L.forwardY.setTargetAtTime(f.y, t, 0.02);
      L.forwardZ.setTargetAtTime(f.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  // ------------------------------------------------------------ primitives
  voice(pos, gain = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = gain;
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 5;
    pan.rolloffFactor = 1.15;
    pan.maxDistance = 250;
    if (pan.positionX) {
      pan.positionX.value = pos.x;
      pan.positionY.value = pos.y;
      pan.positionZ.value = pos.z;
    } else pan.setPosition(pos.x, pos.y, pos.z);
    g.connect(pan).connect(this.birdBus);
    setTimeout(() => { try { g.disconnect(); pan.disconnect(); } catch (e) { /* already gone */ } }, 12000);
    return g;
  }

  // A pure tone following a pitch path of [fraction, Hz] points.
  tone(dest, t0, dur, path, amp = 0.3, { harm = 0.12, type = 'sine', attack = 0.012, release = 0.03, vib = 0 } = {}) {
    const ctx = this.ctx;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(amp, t0 + Math.min(attack, dur * 0.3));
    env.gain.setValueAtTime(amp, t0 + Math.max(attack, dur - release));
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    env.connect(dest);
    const oscs = [];
    const mk = (mult, g) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(path[0][1] * mult, t0);
      for (const [f, hz] of path.slice(1)) o.frequency.linearRampToValueAtTime(hz * mult, t0 + f * dur);
      if (g < 1) {
        const hg = ctx.createGain();
        hg.gain.value = g;
        o.connect(hg).connect(env);
      } else o.connect(env);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
      oscs.push(o);
      return o;
    };
    const main = mk(1, 1);
    if (harm > 0) mk(2, harm);
    if (vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = vib;
      const lg = ctx.createGain();
      lg.gain.value = path[0][1] * 0.02;
      lfo.connect(lg).connect(main.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur);
    }
    return oscs;
  }

  // Tone with fast amplitude modulation, for buzzes and trills.
  buzz(dest, t0, dur, path, rate, amp = 0.25, depth = 0.9) {
    const ctx = this.ctx;
    const am = ctx.createGain();
    am.gain.value = 1 - depth;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const lg = ctx.createGain();
    lg.gain.value = depth;
    lfo.connect(lg).connect(am.gain);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.02);
    am.connect(dest);
    this.tone(am, t0, dur, path, amp, { harm: 0.25 });
  }

  noise(dest, t0, dur, freq, q, amp, { type = 'bandpass', decay = true } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(amp, t0 + 0.004);
    if (decay) env.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    else { env.gain.setValueAtTime(amp, t0 + dur - 0.02); env.gain.linearRampToValueAtTime(0, t0 + dur); }
    src.connect(f).connect(env).connect(dest);
    src.start(t0, Math.random() * 2);
    src.stop(t0 + dur + 0.02);
  }

  harsh(dest, t0, dur, f0, f1, amp, center = 2600) {
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = center;
    bp.Q.value = 1.4;
    bp.connect(dest);
    this.tone(bp, t0, dur, [[0, f0], [0.3, f0 * 1.05], [1, f1]], amp, { type: 'sawtooth', harm: 0.5, attack: 0.02 });
    this.noise(dest, t0, dur, center * 1.2, 1.2, amp * 0.5, { decay: false });
  }

  // ------------------------------------------------------------ songs
  song(key, pos, seed = 1) {
    if (!this.ctx || !this.enabled) return 1.5;
    const fn = SONGS[key];
    if (!fn) return 1;
    const r = mulberry32(seed * 131 + Math.floor(this.ctx.currentTime * 10));
    const v = this.voice(pos, 1);
    return fn(this, v, this.now + 0.03, r, seed);
  }

  drum(pos) {
    if (!this.ctx || !this.enabled) return;
    const v = this.voice(pos, 1);
    const t = this.now + 0.02;
    for (let i = 0; i < 17; i++) this.noise(v, t + i * 0.058, 0.03, 900, 1.2, 0.5 * (1 - i / 22));
  }

  shutter() {
    if (!this.ctx) return;
    const t = this.now + 0.005;
    this.noise(this.sfx, t, 0.03, 3200, 0.8, 0.5, { type: 'highpass' });
    this.tone(this.sfx, t, 0.03, [[0, 160], [1, 90]], 0.25, { harm: 0 });
    this.noise(this.sfx, t + 0.07, 0.035, 2600, 0.8, 0.4, { type: 'highpass' });
  }

  step(run) {
    if (!this.ctx) return;
    const t = this.now + 0.005;
    this.noise(this.sfx, t, run ? 0.12 : 0.09, 2200 + Math.random() * 1400, 0.7, run ? 0.07 : 0.03);
  }

  chime(kind = 'new') {
    if (!this.ctx) return;
    const t = this.now + 0.01;
    const notes = kind === 'alert' ? [1760, 0, 1760, 0, 1760] : kind === 'rare' ? [659, 880, 1109, 1319] : kind === 'wrong' ? [330, 262] : [784, 988, 1175];
    notes.forEach((f, i) => {
      if (!f) return;
      this.tone(this.sfx, t + i * (kind === 'alert' ? 0.09 : 0.11), kind === 'alert' ? 0.07 : 0.35, [[0, f], [1, f]], kind === 'alert' ? 0.08 : 0.12, { harm: 0.3, attack: 0.005, release: 0.3 });
    });
  }
}

// Each returns its duration in seconds.
const SONGS = {
  cardinal(a, v, t, r, seed) {
    const type = seed % 3;
    let time = t;
    if (type === 0) {
      for (let i = 0; i < 3; i++) { a.tone(v, time, 0.26, [[0, 3900], [0.7, 2300], [1, 1900]], 0.45); time += 0.36; }
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) { a.tone(v, time, 0.12, [[0, 2200], [0.45, 3500], [1, 2500]], 0.4); time += 0.15; }
    } else if (type === 1) {
      for (let i = 0; i < 3; i++) {
        a.tone(v, time, 0.16, [[0, 1700], [1, 3400]], 0.35);
        a.tone(v, time + 0.18, 0.24, [[0, 3900], [1, 2100]], 0.45);
        time += 0.62;
      }
    } else {
      const n = 5 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) { a.tone(v, time, 0.13, [[0, 2600], [0.5, 3800], [1, 3000]], 0.4); time += 0.19; }
    }
    return time - t;
  },
  robin(a, v, t, r) {
    let time = t;
    const phrases = 2 + Math.floor(r() * 3);
    for (let p = 0; p < phrases; p++) {
      const notes = 2 + Math.floor(r() * 3);
      for (let i = 0; i < notes; i++) {
        const f = 2000 + r() * 900, d = 0.12 + r() * 0.1;
        a.tone(v, time, d, [[0, f], [0.4, f * (1.1 + r() * 0.15)], [1, f * (0.9 + r() * 0.1)]], 0.33, { harm: 0.2, vib: 25 });
        time += d + 0.06;
      }
      time += 0.35 + r() * 0.25;
    }
    return time - t;
  },
  chickadee(a, v, t, r) {
    if (r() < 0.5) {
      a.tone(v, t, 0.36, [[0, 3950], [1, 3850]], 0.35, { harm: 0.05 });
      a.tone(v, t + 0.46, 0.42, [[0, 3350], [0.5, 3250], [1, 3300]], 0.33, { harm: 0.05 });
      return 0.9;
    }
    a.noise(v, t, 0.05, 5200, 2, 0.25);
    a.tone(v, t, 0.05, [[0, 4600], [1, 3600]], 0.25);
    a.tone(v, t + 0.08, 0.04, [[0, 4200], [1, 3900]], 0.2);
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) a.buzz(v, t + 0.16 + i * 0.22, 0.18, [[0, 3300], [1, 3150]], 95, 0.22);
    return 0.2 + n * 0.22;
  },
  titmouse(a, v, t, r) {
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.3;
      a.tone(v, s, 0.1, [[0, 2900], [1, 3500]], 0.4);
      a.tone(v, s + 0.12, 0.13, [[0, 2500], [1, 2200]], 0.4);
    }
    return n * 0.3;
  },
  goldfinch(a, v, t, r) {
    if (r() < 0.5) {
      const notes = [[3200, 2800], [3700, 3000], [3400, 2900], [4300, 3600]];
      notes.forEach(([f0, f1], i) => a.tone(v, t + i * 0.12, 0.07, [[0, f0], [1, f1]], 0.3));
      return 0.5;
    }
    let time = t;
    const n = 14 + Math.floor(r() * 8);
    for (let i = 0; i < n; i++) {
      const f = 2600 + r() * 3000, d = 0.05 + r() * 0.07;
      if (r() < 0.2) a.buzz(v, time, d * 1.6, [[0, f], [1, f * 0.9]], 70, 0.18);
      else a.tone(v, time, d, [[0, f], [1, f * (0.8 + r() * 0.5)]], 0.25);
      time += d + 0.03;
    }
    return time - t;
  },
  dove(a, v, t) {
    const o = { harm: 0.08, attack: 0.08, release: 0.15 };
    a.tone(v, t, 0.35, [[0, 480], [1, 560]], 0.5, o);
    a.tone(v, t + 0.42, 0.6, [[0, 600], [0.3, 640], [1, 500]], 0.55, o);
    a.tone(v, t + 1.4, 0.5, [[0, 500], [1, 470]], 0.5, o);
    a.tone(v, t + 2.15, 0.5, [[0, 500], [1, 470]], 0.48, o);
    a.tone(v, t + 2.9, 0.5, [[0, 495], [1, 465]], 0.45, o);
    a.noise(v, t, 3.4, 600, 0.8, 0.03, { decay: false });
    return 3.4;
  },
  redwing(a, v, t) {
    a.harsh(v, t, 0.12, 1100, 1350, 0.35, 1800);
    a.tone(v, t + 0.16, 0.08, [[0, 2600], [1, 3000]], 0.3);
    a.buzz(v, t + 0.28, 0.85, [[0, 3700], [1, 3300]], 58, 0.32);
    return 1.15;
  },
  bluejay(a, v, t, r) {
    if (r() < 0.25) {
      for (let i = 0; i < 4; i++) {
        a.tone(v, t + i * 0.3, 0.12, [[0, 1800], [1, 1900]], 0.35, { harm: 0.3 });
        a.tone(v, t + i * 0.3 + 0.13, 0.12, [[0, 2500], [1, 2400]], 0.35, { harm: 0.3 });
      }
      return 1.2;
    }
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) a.harsh(v, t + i * 0.42, 0.3, 1500, 1050, 0.5, 2700);
    return n * 0.42;
  },
  downy(a, v, t, r) {
    if (r() < 0.5) {
      a.tone(v, t, 0.03, [[0, 4600], [1, 4300]], 0.4, { harm: 0.4 });
      return 0.2;
    }
    let time = t;
    for (let i = 0; i < 12; i++) {
      const f = 5000 - i * 90;
      a.tone(v, time, 0.035, [[0, f], [1, f * 0.93]], 0.3, { harm: 0.4 });
      time += 0.1 - i * 0.004;
    }
    return time - t;
  },
  mockingbird(a, v, t, r) {
    const repertoire = ['cardinal', 'robin', 'titmouse', 'chickadee', 'bluejay', 'goldfinch', 'hawkLite', 'bluebird'];
    let time = t;
    const count = 3 + Math.floor(r() * 2);
    for (let k = 0; k < count; k++) {
      const pick = repertoire[Math.floor(r() * repertoire.length)];
      const seed = Math.floor(r() * 1000);
      for (let rep = 0; rep < 3; rep++) {
        const d = SONGS[pick](a, v, time, mulberry32(seed), seed);
        time += Math.min(d, 1.4) + 0.12;
      }
      time += 0.3;
    }
    return time - t;
  },
  hawkLite(a, v, t) {
    a.tone(v, t, 0.9, [[0, 3100], [1, 2300]], 0.3, { harm: 0.4 });
    a.noise(v, t, 0.9, 2600, 1.5, 0.12, { decay: false });
    return 0.9;
  },
  bluebird(a, v, t, r) {
    let time = t;
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const f = 2100 + r() * 700;
      a.tone(v, time, 0.2, [[0, f], [0.5, f * 1.2], [1, f * 1.05]], 0.25, { vib: 18, harm: 0.15 });
      time += 0.26;
    }
    return time - t;
  },
  mallard(a, v, t, r) {
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.32;
      const f = 360 - i * 12;
      const bp = a.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 1.2;
      bp.connect(v);
      a.tone(bp, s, 0.2, [[0, f], [0.3, f * 1.05], [1, f * 0.85]], 0.9, { type: 'sawtooth', harm: 0.3, attack: 0.01 });
    }
    return n * 0.32;
  },
  heron(a, v, t) {
    a.harsh(v, t, 0.55, 190, 150, 0.7, 700);
    return 0.6;
  },
  hawk(a, v, t) {
    a.tone(v, t, 2.1, [[0, 3300], [0.2, 3000], [1, 2100]], 0.5, { harm: 0.5, attack: 0.1, release: 0.5 });
    a.noise(v, t, 2.1, 2700, 1.4, 0.35, { decay: false });
    return 2.2;
  },
  hummingbird(a, v, t, r) {
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) a.tone(v, t + i * 0.13, 0.025, [[0, 6800], [1, 6200]], 0.2, { harm: 0 });
    a.buzz(v, t, n * 0.13 + 0.2, [[0, 210], [1, 205]], 53, 0.1, 0.6);
    return n * 0.13 + 0.2;
  },
  oriole(a, v, t, r) {
    let time = t;
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const f = 1600 + r() * 1000, d = 0.14 + r() * 0.12;
      a.tone(v, time, d, [[0, f], [0.5, f * (0.85 + r() * 0.35)], [1, f * (0.9 + r() * 0.2)]], 0.4, { harm: 0.22 });
      time += d + 0.05 + r() * 0.08;
    }
    return time - t;
  },
  waxwing(a, v, t, r) {
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) a.buzz(v, t + i * 0.55, 0.42, [[0, 7100], [1, 7400]], 240, 0.14, 0.7);
    return n * 0.55;
  },
  woodduck(a, v, t) {
    for (let i = 0; i < 2; i++) {
      a.tone(v, t + i * 0.55, 0.4, [[0, 900], [0.7, 2000], [1, 2200]], 0.4, { harm: 0.3 });
      a.noise(v, t + i * 0.55, 0.4, 2000, 1, 0.08, { decay: false });
    }
    return 1.1;
  },
  owl(a, v, t) {
    const o = { harm: 0.05, attack: 0.07, release: 0.12 };
    const seq = [[0, 0.32, 310], [0.5, 0.12, 300], [0.66, 0.5, 320], [1.45, 0.42, 300], [2.05, 0.42, 295]];
    for (const [s, d, f] of seq) a.tone(v, t + s, d, [[0, f], [1, f * 0.94]], 0.9, o);
    return 2.6;
  },
  bunting(a, v, t, r) {
    let time = t;
    const n = 10 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const f = 3000 + r() * 3200, d = 0.06 + r() * 0.05;
      a.tone(v, time, d, [[0, f], [1, f * (0.75 + r() * 0.5)]], 0.3);
      time += d + 0.025;
    }
    return time - t;
  },
};
