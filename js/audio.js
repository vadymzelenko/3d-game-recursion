// Процедурные звуки через Web Audio API.
//
// «Клик» ЭВМ оставлен почти нетронутым (он и так хорошо читается как
// ретро-терминал). Остальные звуки (дверь, шаги, гул, глитч) стали более
// текстурными: добавлены фильтры, лёгкий реверб-хвост и посекундная
// случайность, чтобы одна и та же дверь не звучала как копипаста самой себя
// на каждом кадре. Плюс новый звук для зацикливания на лестнице.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.ambientNode = null;
    this.ambientGain = null;
    this._reverb = null;
    this._reverbSend = null;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  // Небольшой общий реверб-бас (convolver с сгенерированным импульсом) —
  // даёт ощущение бетонной лестничной клетки/пустой квартиры вместо
  // «сухих» звуков в вакууме. Ленивая инициализация.
  _getReverbSend() {
    const ctx = this.ensure();
    if (this._reverbSend) return this._reverbSend;

    const convolver = ctx.createConvolver();
    const duration = 1.6;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      }
    }
    convolver.buffer = impulse;

    const send = ctx.createGain();
    send.gain.value = 0.35;
    send.connect(convolver).connect(ctx.destination);

    this._reverb = convolver;
    this._reverbSend = send;
    return send;
  }

  // Низкочастотный гул подъезда: три расстроенных синуса + очень тихий
  // фильтрованный шум "воздуха" + медленная LFO-модуляция громкости,
  // чтобы гул слегка "дышал", а не гудел ровной линией.
  startAmbient() {
    const ctx = this.ensure();
    if (this.ambientNode) return;

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 50;

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 75.5;

    const osc3 = ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.value = 100.3;

    const gain = ctx.createGain();
    gain.gain.value = 0.05;

    // Медленное дыхание громкости (LFO)
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain).connect(gain.gain);

    // Очень тихий фильтрованный "воздух"
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 220;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.02;

    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    noise.connect(noiseFilter).connect(noiseGain).connect(gain);
    gain.connect(ctx.destination);

    osc1.start(); osc2.start(); osc3.start(); lfo.start(); noise.start();
    this.ambientNode = [osc1, osc2, osc3, lfo, noise];
    this.ambientGain = gain;
  }

  stopAmbient() {
    if (this.ambientNode) {
      this.ambientNode.forEach(o => { try { o.stop(); } catch {} });
      this.ambientNode = null;
    }
  }

  // Клик терминала ЭВМ — оставлен как есть.
  click() {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1200;
    osc.type = "square";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  // Глитч — тот же характер шумового "разряда", но с редким случайным
  // тональным "чирком" поверх, чтобы иногда звучало более цифровым/сломанным.
  glitch() {
    const ctx = this.ensure();
    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.7 ? 1 : 0) * 0.35;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    src.connect(gain).connect(ctx.destination);
    src.start();

    if (Math.random() > 0.55) {
      const chirp = ctx.createOscillator();
      const chirpGain = ctx.createGain();
      chirp.type = "square";
      const f0 = 300 + Math.random() * 900;
      chirp.frequency.setValueAtTime(f0, ctx.currentTime);
      chirp.frequency.exponentialRampToValueAtTime(f0 * (Math.random() > 0.5 ? 0.3 : 2.6), ctx.currentTime + 0.12);
      chirpGain.gain.setValueAtTime(0.06, ctx.currentTime);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      chirp.connect(chirpGain).connect(ctx.destination);
      chirp.start();
      chirp.stop(ctx.currentTime + 0.14);
    }
  }

  // Дверь: низкий "деревянный" свип + фильтрованный шумовой скрип поверх +
  // мягкий финальный стук/удар, всё с небольшим ревербом.
  door() {
    const ctx = this.ensure();
    const now = ctx.currentTime;
    const reverbSend = this._getReverbSend();

    // Тональный свип (несущая часть звука открытия)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.9);
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.1, now + 0.08);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = "lowpass";
    oscFilter.frequency.value = 900;
    osc.connect(oscFilter).connect(oscGain);
    oscGain.connect(ctx.destination);
    oscGain.connect(reverbSend);

    // Скрип петель: фильтрованный шум с "рваной" огибающей
    const creakBuf = ctx.createBuffer(1, ctx.sampleRate * 0.9, ctx.sampleRate);
    const cd = creakBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) {
      const t = i / cd.length;
      cd[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(t * Math.PI * 9)) * (1 - t);
    }
    const creak = ctx.createBufferSource();
    creak.buffer = creakBuf;
    const creakFilter = ctx.createBiquadFilter();
    creakFilter.type = "bandpass";
    creakFilter.frequency.value = 700;
    creakFilter.Q.value = 4;
    const creakGain = ctx.createGain();
    creakGain.gain.value = 0.22;
    creak.connect(creakFilter).connect(creakGain).connect(ctx.destination);
    creakGain.connect(reverbSend);

    osc.start(now); osc.stop(now + 1.0);
    creak.start(now);
  }

  // Шаги: у каждого шага своя случайная высота/длительность и мягкий
  // низкочастотный "вес" под шумом, вместо одинакового белого щелчка.
  step() {
    const ctx = this.ensure();
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.09;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const decayRate = 0.1 + Math.random() * 0.08;
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * decayRate)) * 0.22;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400 + Math.random() * 600;
    src.connect(filter).connect(ctx.destination);

    // Мягкий низкий "вес" шага
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.value = 60 + Math.random() * 20;
    thumpGain.gain.setValueAtTime(0.05, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    thump.connect(thumpGain).connect(ctx.destination);

    src.start(now);
    thump.start(now);
    thump.stop(now + 0.09);
  }

  // Зацикливание лестницы: нисходящий фильтрованный шумовой "свист падения"
  // и глухой удар в конце — момент, когда виток начинается заново.
  loopWhoosh() {
    const ctx = this.ensure();
    const now = ctx.currentTime;
    const reverbSend = this._getReverbSend();

    const bufferSize = ctx.sampleRate * 1.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 1.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    src.connect(filter).connect(gain).connect(ctx.destination);
    gain.connect(reverbSend);
    src.start(now);

    // Глухой удар о нижнюю площадку в конце
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = "sine";
    thud.frequency.setValueAtTime(90, now + 1.0);
    thud.frequency.exponentialRampToValueAtTime(40, now + 1.3);
    thudGain.gain.setValueAtTime(0.0001, now + 1.0);
    thudGain.gain.linearRampToValueAtTime(0.22, now + 1.02);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    thud.connect(thudGain).connect(ctx.destination);
    thud.start(now + 1.0);
    thud.stop(now + 1.4);
  }

  play(name) {
    switch (name) {
      case "click":      this.click(); break;
      case "glitch":     this.glitch(); break;
      case "door":       this.door(); break;
      case "step":       this.step(); break;
      case "hum":        this.startAmbient(); break;
      case "loopWhoosh": this.loopWhoosh(); break;
    }
  }
}
