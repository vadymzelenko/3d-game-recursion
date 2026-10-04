// Тач-управление для телефонов и планшетов.
//
// Раскладка:
//   • круглый джойстик — левый нижний угол (движение);
//   • правая часть экрана — драг = обзор;
//   • кнопки E и ESC — правый нижний угол.
//
// Все нажатия «E» и «ESC» транслируются в синтетические KeyboardEvent,
// чтобы не дублировать логику Game._bindEvents().

const LOOK_MULT = 1.8;     // чувствительность свайпа обзора
const STICK_RADIUS = 55;   // px, радиус хода ручки джойстика
const STICK_DEAD = 0.12;   // мёртвая зона

export class TouchControls {
    constructor(game) {
        this.game = game;
        this.enabled = (navigator.maxTouchPoints || 0) > 0 ||
            ("ontouchstart" in window);
        this._stickId = null;
        this._lookId = null;
        this._lookX = 0;
        this._lookY = 0;
        if (!this.enabled) return;
        this._build();
        this._bind();
    }

    show() { if (this.root) this.root.classList.remove("hidden"); }
    hide() { if (this.root) this.root.classList.add("hidden"); }

    _build() {
        this.root = document.createElement("div");
        this.root.id = "touch-controls";
        this.root.innerHTML = `
      <div class="tc-stick" id="tc-stick">
        <div class="tc-stick-ring"></div>
        <div class="tc-stick-knob" id="tc-knob"></div>
      </div>
      <div class="tc-btn tc-btn-e" id="tc-e">E</div>
      <div class="tc-btn tc-btn-esc" id="tc-esc">ESC</div>
    `;
        document.body.appendChild(this.root);
        this.stick = this.root.querySelector("#tc-stick");
        this.knob  = this.root.querySelector("#tc-knob");
        this.eBtn  = this.root.querySelector("#tc-e");
        this.escBtn= this.root.querySelector("#tc-esc");
        this.show();
    }

    _stickCenter() {
        const r = this.stick.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    _updateStick(x, y, cx, cy) {
        let dx = x - cx, dy = y - cy;
        const len = Math.hypot(dx, dy);
        const r = STICK_RADIUS;
        if (len > r) { dx *= r / len; dy *= r / len; }
        this.knob.style.transform =
            `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        const nx = dx / r, ny = dy / r;
        const nlen = Math.hypot(nx, ny);
        const scale = nlen > STICK_DEAD
            ? (nlen - STICK_DEAD) / (1 - STICK_DEAD) / nlen
            : 0;
        this.game.player.analogX = nx * scale;
        this.game.player.analogZ = ny * scale;
    }

    _resetStick() {
        this.game.player.analogX = 0;
        this.game.player.analogZ = 0;
        if (this.knob) this.knob.style.transform = "translate(-50%, -50%)";
    }

    _pressKey(code, key) {
        window.dispatchEvent(new KeyboardEvent("keydown", { code, key: key || code }));
    }
    _releaseKey(code, key) {
        window.dispatchEvent(new KeyboardEvent("keyup", { code, key: key || code }));
    }

    _bind() {
        const add = (el, type, fn, opts = {}) =>
            el.addEventListener(type, fn, { passive: false, ...opts });

        // ── Джойстик ──────────────────────────────────────────────
        add(this.stick, "touchstart", (ev) => {
            const t = ev.changedTouches[0];
            this._stickId = t.identifier;
            const c = this._stickCenter();
            this._updateStick(t.clientX, t.clientY, c.x, c.y);
            ev.preventDefault();
        });
        add(this.stick, "touchmove", (ev) => {
            for (const t of ev.changedTouches) {
                if (t.identifier !== this._stickId) continue;
                const c = this._stickCenter();
                this._updateStick(t.clientX, t.clientY, c.x, c.y);
            }
            ev.preventDefault();
        });
        const stickEnd = (ev) => {
            for (const t of ev.changedTouches) {
                if (t.identifier === this._stickId) {
                    this._stickId = null;
                    this._resetStick();
                }
            }
            ev.preventDefault();
        };
        add(this.stick, "touchend", stickEnd);
        add(this.stick, "touchcancel", stickEnd);

        // ── Кнопки E / ESC ────────────────────────────────────────
        const wireKey = (el, code, key) => {
            add(el, "touchstart", (ev) => { this._pressKey(code, key); ev.preventDefault(); });
            add(el, "touchend",   (ev) => { this._releaseKey(code, key); ev.preventDefault(); });
            add(el, "touchcancel",(ev) => { this._releaseKey(code, key); ev.preventDefault(); });
        };
        wireKey(this.eBtn,   "KeyE");
        wireKey(this.escBtn, "Escape", "Escape");

        // ── Обзор: драг по канвасу ────────────────────────────────
        const canvas = this.game.canvas;
        add(canvas, "touchstart", (ev) => {
            if (this._lookId != null) return;
            for (const t of ev.changedTouches) {
                this._lookId = t.identifier;
                this._lookX = t.clientX;
                this._lookY = t.clientY;
                break;
            }
            ev.preventDefault();
        });
        add(canvas, "touchmove", (ev) => {
            for (const t of ev.changedTouches) {
                if (t.identifier !== this._lookId) continue;
                const dx = t.clientX - this._lookX;
                const dy = t.clientY - this._lookY;
                this._lookX = t.clientX;
                this._lookY = t.clientY;
                this.game.player.onMouseMove(dx * LOOK_MULT, dy * LOOK_MULT);
            }
            ev.preventDefault();
        });
        const lookEnd = (ev) => {
            for (const t of ev.changedTouches) {
                if (t.identifier === this._lookId) this._lookId = null;
            }
            ev.preventDefault();
        };
        add(canvas, "touchend", lookEnd);
        add(canvas, "touchcancel", lookEnd);
    }
}