// Шина событий. Единственный канал, по которому части игры узнают друг
// о друге: мир, сюжет, терминал и интерфейс не зовут друг друга напрямую,
// а подписываются на события.
//
//   bus.on("flag:power_on", fn)   — конкретный флаг
//   bus.on("flag", ({flag, value}) => …) — любой флаг
//   bus.emit("item:add", {id})

export class EventBus {
  constructor() {
    this._subs = new Map();
  }

  on(type, fn) {
    if (!this._subs.has(type)) this._subs.set(type, new Set());
    this._subs.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (p) => { off(); fn(p); });
    return off;
  }

  off(type, fn) {
    this._subs.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const set = this._subs.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); }
      catch (e) { console.error(`[bus] обработчик «${type}» упал:`, e); }
    }
  }
}
