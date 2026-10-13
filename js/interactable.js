// Обёртка над мешем (или несколькими / группой), делающая его интерактивным.
// Если передать массив или группу — интерактивными становятся ВСЕ их меши,
// иначе мелкие детали (ручка, панель) «перекрывали» бы основной объект.
//
// prompt — строка или функция (подпись может зависеть от состояния);
// enabled — необязательная функция: пока она ложна, объект — просто декор.

function collectMeshes(t, out = []) {
  if (!t) return out;
  if (Array.isArray(t)) { for (const x of t) collectMeshes(x, out); return out; }
  if (t.isMesh) out.push(t);
  if (t.children && t.children.length) for (const c of t.children) collectMeshes(c, out);
  return out;
}

export class Interactable {
  constructor(target, prompt, onInteract, { enabled = null } = {}) {
    this.targets = collectMeshes(target);
    this.mesh = this.targets[0] || null;
    this.prompt = prompt;
    this.onInteract = onInteract;
    this.enabled = enabled;
    for (const m of this.targets) m.userData.interactable = this;
  }

  get active() { return !this.enabled || this.enabled(); }

  getPrompt() {
    return typeof this.prompt === "function" ? this.prompt() : this.prompt;
  }

  interact() {
    if (this.onInteract) this.onInteract(this);
  }
}
