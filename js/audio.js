// Процедурный звук через Web Audio API. Ни одного аудиофайла: всё —
// осцилляторы, фильтрованный шум и огибающие. Всё идёт через общий
// master-канал, чтобы работала громкость из меню паузы.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._volume = 0.8;
    this._reverbSend = null;
    this._noise = null;
    this._loops = {};
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this._volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  fadeOut(sec) {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + sec);
    setTimeout(() => this.setVolume(this._volume), sec * 1000 + 4000);
  }

  // ── Кирпичики ────────────────────────────────────────────
  get out() { return this.master; }

  _reverb() {
    const ctx = this.ctx;
    if (this._reverbSend) return this._reverbSend;
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.8);
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    conv.buffer = imp;
    const send = ctx.createGain();
    send.gain.value = 0.3;
    send.connect(conv).connect(this.out);
    this._reverbSend = send;
    return send;
  }

  _noiseBuffer() {
    if (this._noise) return this._noise;
    const ctx = this.ctx;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this._noise = b;
    return b;
  }

  // Шумовой всплеск через фильтр.
  _burst({ dur = 0.2, gain = 0.2, type = "bandpass", freq = 1000, Q = 1, slideTo = null, attack = 0.005, at = 0, reverb = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = Q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; g.connect(s).connect(this._reverb()); }
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return g;
  }

  // Тон с огибающей.
  _tone({ freq = 440, type = "sine", dur = 0.2, gain = 0.1, slideTo = null, attack = 0.005, at = 0, filter = null, reverb = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = filter;
      node = o.connect(f);
    }
    node.connect(g).connect(this.out);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; g.connect(s).connect(this._reverb()); }
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  // «Голос»: пила через два форманта, слоги — случайная огибающая.
  _voice({ dur = 4, base = 110, gain = 0.12, radio = false } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(base, t);
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.Q.value = 8;
    const g = ctx.createGain(); g.gain.value = 0;
    const mix = ctx.createGain(); mix.gain.value = gain;
    o.connect(f1).connect(g); o.connect(f2).connect(g);
    g.connect(mix);
    if (radio) {
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 500;
      mix.connect(hp).connect(this.out);
    } else {
      mix.connect(this.out);
      const s = ctx.createGain(); s.gain.value = 0.25; mix.connect(s).connect(this._reverb());
    }
    const F1 = [300, 500, 700, 400, 650], F2 = [900, 1200, 2200, 1700, 1000];
    for (let x = 0; x < dur; x += 0.11) {
      const on = Math.random() < 0.72;
      g.gain.setTargetAtTime(on ? 1 : 0.03, t + x, 0.02);
      const k = (Math.random() * F1.length) | 0;
      f1.frequency.setTargetAtTime(F1[k], t + x, 0.03);
      f2.frequency.setTargetAtTime(F2[k], t + x, 0.03);
      o.frequency.setTargetAtTime(base * (0.9 + Math.random() * 0.25), t + x, 0.05);
    }
    g.gain.setTargetAtTime(0, t + dur, 0.05);
    o.start(t); o.stop(t + dur + 0.3);
    if (radio) this._burst({ dur, gain: 0.05, type: "bandpass", freq: 2500, Q: 0.6 });
  }

  // ── Фоновый гул ──────────────────────────────────────────
  startAmbient() {
    const ctx = this.ensure();
    if (!ctx || this._amb) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    const oscs = [50, 75.5, 100.3].map(f => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(gain); o.start(); return o;
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.016;
    lfo.connect(lg).connect(gain.gain); lfo.start();
    const n = ctx.createBufferSource(); n.buffer = this._noiseBuffer(); n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.value = 220;
    const ng = ctx.createGain(); ng.gain.value = 0.4;
    n.connect(nf).connect(ng).connect(gain); n.start();
    gain.connect(this.out);
    this._amb = { gain, oscs, lfo };
  }

  // Распад: гул расстраивается и «плывёт».
  decay() {
    if (!this._amb) return;
    const t = this.ctx.currentTime;
    this._amb.oscs.forEach((o, i) => o.frequency.linearRampToValueAtTime([47, 71, 113][i], t + 6));
    this._amb.lfo.frequency.linearRampToValueAtTime(0.9, t + 6);
    this._amb.gain.gain.linearRampToValueAtTime(0.07, t + 6);
  }

  // ── Постоянные источники ─────────────────────────────────
  _loop(name, build) {
    const ctx = this.ensure();
    if (!ctx) return null;
    if (!this._loops[name]) this._loops[name] = build(ctx);
    return this._loops[name];
  }

  // Радио поёт само: вальс сквозь шум. vol 0..1.
  setRadioIdle(vol) {
    if (!this.ctx) return;
    if (vol <= 0.001 && !this._loops.idle) return;
    const L = this._loop("idle", (ctx) => {
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = "bandpass"; lp.frequency.value = 900; lp.Q.value = 0.8;
      lp.connect(g); g.connect(this.out);
      const n = ctx.createBufferSource(); n.buffer = this._noiseBuffer(); n.loop = true;
      const ng = ctx.createGain(); ng.gain.value = 0.18; n.connect(ng).connect(lp); n.start();
      // «Амурские волны» не пропетые до конца: простая мелодия в 3/4.
      const notes = [392, 494, 587, 587, 523, 494, 440, 523, 494, 392, 440, 392];
      let i = 0;
      const tick = () => {
        if (!this._loops.idle) return;
        const t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = notes[i++ % notes.length] * (0.995 + Math.random() * 0.01);
        const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.5, t + 0.03); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(og).connect(lp); o.start(t); o.stop(t + 0.55);
        setTimeout(tick, i % 3 === 0 ? 620 : 420);
      };
      tick();
      return { g };
    });
    if (L) L.g.gain.setTargetAtTime(vol * 0.35, this.ctx.currentTime, 0.2);
  }

  // Настройка «ВЭФ-202»: шум и сигнал.
  radioStart() {
    const L = this._loop("tune", (ctx) => {
      const ng = ctx.createGain(); ng.gain.value = 0;
      const n = ctx.createBufferSource(); n.buffer = this._noiseBuffer(); n.loop = true;
      const bf = ctx.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = 1800; bf.Q.value = 0.5;
      n.connect(bf).connect(ng).connect(this.out); n.start();
      // Несущая с лёгкой амплитудной модуляцией. Модулятор подключён к
      // промежуточному узлу, а общий уровень sg может опускаться ровно до нуля
      // (раньше модулятор добавлялся к sg.gain, и тон звучал вечно).
      const sg = ctx.createGain(); sg.gain.value = 0;
      const mod = ctx.createGain(); mod.gain.value = 0.6;
      const car = ctx.createOscillator(); car.type = "sine"; car.frequency.value = 404 * 2;
      const am = ctx.createOscillator(); am.frequency.value = 3.1;
      const amg = ctx.createGain(); amg.gain.value = 0.4;
      am.connect(amg).connect(mod.gain);
      car.connect(mod).connect(sg).connect(this.out); car.start(); am.start();
      return { ng, sg, bf };
    });
    if (L) { L.ng.gain.value = 0.15; }
  }
  radioSet(noise, signal) {
    const L = this._loops.tune; if (!L) return;
    const t = this.ctx.currentTime;
    L.ng.gain.setTargetAtTime(0.16 * noise, t, 0.05);
    L.sg.gain.setTargetAtTime(0.03 * signal, t, 0.05);
    L.bf.frequency.setTargetAtTime(900 + noise * 1600, t, 0.05);
  }
  radioStop() {
    const L = this._loops.tune; if (!L) return;
    L.ng.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    L.sg.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  tapeMotor(on) {
    const L = this._loop("tape", (ctx) => {
      const g = ctx.createGain(); g.gain.value = 0;
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 96;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300;
      o.connect(lp).connect(g); o.start();
      const n = ctx.createBufferSource(); n.buffer = this._noiseBuffer(); n.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5000;
      const ng = ctx.createGain(); ng.gain.value = 0.5; n.connect(hp).connect(ng).connect(g); n.start();
      g.connect(this.out);
      return { g };
    });
    if (L) L.g.gain.setTargetAtTime(on ? 0.06 : 0, this.ctx.currentTime, 0.08);
  }

  computerHum(on) {
    const L = this._loop("crt", (ctx) => {
      const g = ctx.createGain(); g.gain.value = 0;
      // Мягкий гул трансформатора кинескопа (без пронзительного писка строчной развёртки).
      const h = ctx.createOscillator(); h.type = "sine"; h.frequency.value = 100;
      const h2 = ctx.createOscillator(); h2.type = "sine"; h2.frequency.value = 50;
      h.connect(g); h2.connect(g); h.start(); h2.start();
      g.connect(this.out);
      return { g };
    });
    if (L) L.g.gain.setTargetAtTime(on ? 0.03 : 0, this.ctx.currentTime, 0.3);
  }

  drone(level) {
    if (!this.ctx) return;
    if (level <= 0.001 && !this._loops.drone) return;
    const L = this._loop("drone", (ctx) => {
      const g = ctx.createGain(); g.gain.value = 0;
      for (const f of [41, 43.3, 61.7]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(g); o.start(); }
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
      g.connect(lp).connect(this.out);
      return { g };
    });
    if (L) L.g.gain.setTargetAtTime(level * 0.08, this.ctx.currentTime, 0.3);
  }

  // Заглушить все постоянные источники (смерть, финал, смена цикла).
  silenceLoops() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const L = this._loops;
    for (const key of ["tune", "tape", "crt", "drone", "idle"]) {
      const l = L[key]; if (!l) continue;
      for (const g of [l.g, l.ng, l.sg]) if (g) g.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  // ── Разовые звуки ────────────────────────────────────────
  play(name) {
    const ctx = this.ensure();
    if (!ctx) return;
    const fn = SOUNDS[name];
    if (fn) { try { fn.call(this); } catch (e) { console.warn("sound", name, e); } }
  }
}

const SOUNDS = {
  click() { this._tone({ freq: 1200, type: "square", dur: 0.05, gain: 0.05 }); },
  key() { this._tone({ freq: 1800 + Math.random() * 500, type: "square", dur: 0.018, gain: 0.018 }); this._burst({ dur: 0.03, gain: 0.04, freq: 3000, Q: 2 }); },
  glitch() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.25;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() > 0.7 ? 1 : 0) * 0.35;
    const s = ctx.createBufferSource(); s.buffer = b;
    const g = ctx.createGain(); g.gain.value = 0.35;
    s.connect(g).connect(this.out); s.start();
    if (Math.random() > 0.5) { const f0 = 300 + Math.random() * 900; this._tone({ freq: f0, type: "square", dur: 0.13, gain: 0.05, slideTo: f0 * (Math.random() > 0.5 ? 0.3 : 2.6) }); }
  },
  door() {
    this._tone({ freq: 140, type: "sawtooth", dur: 1.0, gain: 0.08, slideTo: 260, attack: 0.08, filter: 900, reverb: 0.5 });
    this._burst({ dur: 0.9, gain: 0.16, freq: 700, Q: 4, reverb: 0.4 });
  },
  locked() {
    this._burst({ dur: 0.08, gain: 0.3, freq: 1500, Q: 3 });
    this._burst({ dur: 0.08, gain: 0.25, freq: 1300, Q: 3, at: 0.12 });
    this._tone({ freq: 80, dur: 0.12, gain: 0.15, at: 0.02 });
  },
  step() {
    this._burst({ dur: 0.08, gain: 0.13, type: "lowpass", freq: 1300 + Math.random() * 600 });
    this._tone({ freq: 60 + Math.random() * 20, dur: 0.08, gain: 0.05 });
  },
  loopWhoosh() {
    this._burst({ dur: 1.1, gain: 0.25, freq: 2600, slideTo: 140, Q: 1.2, attack: 0.05, reverb: 0.5 });
    this._tone({ freq: 90, dur: 0.4, gain: 0.2, slideTo: 40, at: 1.0 });
  },
  actCard() {
    this._tone({ freq: 55, dur: 3.5, gain: 0.25, attack: 0.02, reverb: 0.6 });
    this._tone({ freq: 82.5, dur: 3, gain: 0.1, attack: 0.5 });
    this._burst({ dur: 2.5, gain: 0.08, type: "lowpass", freq: 400, attack: 1.2, reverb: 0.5 });
  },
  paper() { this._burst({ dur: 0.25, gain: 0.12, type: "highpass", freq: 2500, attack: 0.04 }); },
  item() { this._tone({ freq: 660, dur: 0.4, gain: 0.06 }); this._tone({ freq: 990, dur: 0.6, gain: 0.05, at: 0.12 }); },
  pencil() { for (let i = 0; i < 5; i++) this._burst({ dur: 0.07, gain: 0.05, freq: 4200, Q: 2, at: i * 0.08 }); },
  phone() {
    this._burst({ dur: 0.05, gain: 0.2, freq: 900, Q: 3 });
    this._tone({ freq: 425, dur: 2.2, gain: 0.05, at: 0.3, attack: 0.02 });   // советский гудок 425 Гц
    this._burst({ dur: 0.04, gain: 0.25, freq: 1200, Q: 4, at: 2.6 });
  },
  breath() {
    for (let i = 0; i < 2; i++) {
      this._burst({ dur: 1.4, gain: 0.12, type: "lowpass", freq: 700, attack: 0.9, at: i * 2.2 });
      this._burst({ dur: 1.0, gain: 0.07, type: "bandpass", freq: 1400, Q: 0.7, attack: 0.3, at: i * 2.2 + 1.2 });
    }
  },
  creak() { this._tone({ freq: 900, type: "triangle", dur: 0.35, gain: 0.04, slideTo: 760 }); this._tone({ freq: 1250, type: "triangle", dur: 0.25, gain: 0.03, at: 0.2, slideTo: 1100 }); },
  flatline() { this._tone({ freq: 1000, dur: 2.8, gain: 0.05, attack: 0.01 }); },
  static() { this._burst({ dur: 1.6, gain: 0.15, freq: 1800, Q: 0.4 }); this._voice({ dur: 2.5, base: 190, gain: 0.05, radio: true }); },
  drawer() { this._burst({ dur: 0.45, gain: 0.18, type: "lowpass", freq: 500, slideTo: 1200, attack: 0.05 }); this._tone({ freq: 120, dur: 0.1, gain: 0.12, at: 0.42 }); },
  typewriter() {
    for (let i = 0; i < 26; i++) {
      const at = i * 0.11 + Math.random() * 0.05;
      this._burst({ dur: 0.03, gain: 0.25, freq: 2500, Q: 2, at, reverb: 0.2 });
      this._tone({ freq: 140, dur: 0.03, gain: 0.08, at });
    }
    this._tone({ freq: 2093, dur: 1.2, gain: 0.05, at: 3.0, reverb: 0.4 });
  },
  whisper() {
    const ctx = this.ctx;
    const g = this._burst({ dur: 4.2, gain: 0.14, freq: 2200, Q: 1.4, attack: 0.4, reverb: 0.4 });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const lg = ctx.createGain(); lg.gain.value = 0.08; lfo.connect(lg).connect(g.gain);
    lfo.start(); lfo.stop(ctx.currentTime + 4.3);
  },
  scream() {
    for (const f of [220, 233, 311]) this._tone({ freq: f, type: "sawtooth", dur: 1.4, gain: 0.07, slideTo: f * 2.2, filter: 2400, reverb: 0.5 });
    this._burst({ dur: 1.2, gain: 0.2, freq: 1500, Q: 0.6 });
  },
  spark() {
    for (let i = 0; i < 12; i++) this._burst({ dur: 0.03, gain: 0.35, type: "highpass", freq: 3000, at: Math.random() * 0.45 });
    this._tone({ freq: 50, type: "sawtooth", dur: 0.5, gain: 0.12, filter: 900 });
  },
  fuse() { this._burst({ dur: 0.06, gain: 0.3, freq: 2000, Q: 2 }); this._tone({ freq: 180, dur: 0.12, gain: 0.15 }); },
  powerOn() {
    this._tone({ freq: 50, type: "sawtooth", dur: 3.5, gain: 0.16, slideTo: 100, attack: 0.3, filter: 600, reverb: 0.6 });
    this._tone({ freq: 100, type: "square", dur: 3.0, gain: 0.04, slideTo: 200, attack: 0.6, filter: 800 });
    this._burst({ dur: 2.6, gain: 0.2, type: "lowpass", freq: 160, attack: 0.1, reverb: 0.5 });
    this._burst({ dur: 0.07, gain: 0.4, freq: 1500, Q: 2 });
  },
  relay() { this._burst({ dur: 0.05, gain: 0.35, freq: 1700, Q: 3 }); this._tone({ freq: 95, dur: 0.15, gain: 0.2 }); },
  tapeScrape() { this._tone({ freq: 380, type: "sawtooth", dur: 0.45, gain: 0.08, slideTo: 40, filter: 1500 }); this._burst({ dur: 0.45, gain: 0.2, freq: 800, slideTo: 100, Q: 1 }); },
  tapeTear() { this._burst({ dur: 0.12, gain: 0.5, type: "highpass", freq: 1500 }); this._tone({ freq: 600, type: "sawtooth", dur: 0.4, gain: 0.08, slideTo: 60, filter: 2000 }); },
  voiceRadio() { this._voice({ dur: 7, base: 105, gain: 0.08, radio: true }); },
  voiceTape() { this._voice({ dur: 4, base: 120, gain: 0.1 }); setTimeout(() => this.ctx && this._voice({ dur: 4, base: 118, gain: 0.05 }), 1500); },
  ring() { for (let i = 0; i < 2; i++) { this._tone({ freq: 880, type: "square", dur: 0.35, gain: 0.04, at: i * 0.5, filter: 2500 }); this._tone({ freq: 660, type: "square", dur: 0.35, gain: 0.04, at: i * 0.5 + 0.17, filter: 2500 }); } },
  crtOn() { this._tone({ freq: 60, dur: 0.3, gain: 0.2 }); this._tone({ freq: 3000, dur: 0.6, gain: 0.02, slideTo: 7800, attack: 0.2 }); },
  error() { this._tone({ freq: 140, type: "square", dur: 0.35, gain: 0.06, filter: 900 }); },
  death() { this._tone({ freq: 45, dur: 3, gain: 0.35, slideTo: 25, reverb: 0.7 }); this._burst({ dur: 1.5, gain: 0.3, type: "lowpass", freq: 900, slideTo: 80 }); },
  whiteFlash() { this._burst({ dur: 2.5, gain: 0.25, type: "highpass", freq: 300, slideTo: 6000, attack: 2.2, reverb: 0.6 }); },
  stamp() { this._tone({ freq: 110, dur: 0.12, gain: 0.3 }); this._burst({ dur: 0.08, gain: 0.25, type: "lowpass", freq: 800 }); },
};
