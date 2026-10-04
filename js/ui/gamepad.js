// Поддержка геймпада через Gamepad API.
//
// Раскладка (Standard Gamepad Layout):
//   • левый стик   — движение;
//   • правый стик  — обзор;
//   • A / X        — взаимодействие (KeyE);
//   • B / Start    — Escape (закрыть меню / отпустить курсор).
//
// Кнопки транслируются в синтетические KeyboardEvent, чтобы переиспользовать
// существующий обработчик в Game._bindEvents().

const DEAD = 0.15;          // мёртвая зона стиков
const LOOK_SPEED = 2.6;     // рад/сек при полном отклонении

export class GamepadInput {
    constructor(game) {
        this.game = game;
        this.pad = null;
        this._prev = Object.create(null);

        window.addEventListener("gamepadconnected", (e) => {
            console.log("[gamepad] connected:", e.gamepad.id);
            this.game.hud?.showMessage(`Геймпад подключён: ${e.gamepad.id}`, 3500);
        });
        window.addEventListener("gamepaddisconnected", () => {
            this.pad = null;
            this.game.player.analogX = 0;
            this.game.player.analogZ = 0;
        });
    }

    _applyDead(v) {
        if (Math.abs(v) < DEAD) return 0;
        return Math.sign(v) * ((Math.abs(v) - DEAD) / (1 - DEAD));
    }

    poll(dt) {
        if (!navigator.getGamepads) return;
        let pad = null;
        for (const p of navigator.getGamepads()) {
            if (p && p.connected) { pad = p; break; }
        }
        this.pad = pad;
        if (!pad) return;

        // ── Левый стик → движение ────────────────────────────────
        const lx = this._applyDead(pad.axes[0] || 0);
        const ly = this._applyDead(pad.axes[1] || 0);
        this.game.player.analogX = lx;
        this.game.player.analogZ = ly;

        // ── Правый стик → обзор ───────────────────────────────────
        const rx = this._applyDead(pad.axes[2] || 0);
        const ry = this._applyDead(pad.axes[3] || 0);
        if (rx !== 0 || ry !== 0) {
            // rx>0 (вправо) → yaw уменьшается (как у мыши)
            // ry<0 (вверх)   → pitch увеличивается
            this.game.player.lookByRadians(-rx * LOOK_SPEED * dt,
                -ry * LOOK_SPEED * dt);
        }

        // ── Кнопки (edge-trigger) ─────────────────────────────────
        this._btnEdge(0, "KeyE");                       // A / ✕
        this._btnEdge(2, "KeyE");                       // X / □
        this._btnEdge(1, "Escape", "Escape");           // B / ○
        this._btnEdge(9, "Escape", "Escape");           // Start
    }

    _btnEdge(idx, code, key) {
        const pad = this.pad;
        if (!pad) return;
        const btn = pad.buttons[idx];
        const cur = !!(btn && btn.pressed);
        const prev = !!this._prev[idx];
        if (cur && !prev) {
            window.dispatchEvent(new KeyboardEvent("keydown", { code, key: key || code }));
        } else if (!cur && prev) {
            window.dispatchEvent(new KeyboardEvent("keyup", { code, key: key || code }));
        }
        this._prev[idx] = cur;
    }
}