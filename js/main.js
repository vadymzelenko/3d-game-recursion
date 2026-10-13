// Точка входа: шрифты → мир → титульный экран → пролог → игра.

import { Game } from "./game.js";
import { GameState } from "./core/state.js";

const $ = (id) => document.getElementById(id);
const title = $("title-screen");
const btnNew = $("btn-new");
const btnCont = $("btn-continue");
const loading = title.querySelector(".title-loading");

// Надписи в мире рисуются на canvas — шрифты нужны до постройки мира.
async function loadFonts() {
  if (!document.fonts) return;
  const want = [
    '600 48px "Caveat"', '400 48px "Caveat"', '500 32px "Oswald"', '600 32px "Oswald"',
    '400 16px "PT Mono"', '400 16px "PT Serif"', 'italic 400 16px "PT Serif"',
  ];
  const sample = "АБВ абв 0123 «»";
  await Promise.race([
    Promise.all(want.map(f => document.fonts.load(f, sample).catch(() => null))),
    new Promise(r => setTimeout(r, 4000)),   // без сети — системные шрифты
  ]);
}

const PROLOGUE = [
  "Есть время, которое не движется.",
  "Оно застыло в одном мгновении — 14 ноября 1988 года, 04:12 — и с тех пор вращается само в себе, как плёнка, зацикленная в проекторе.",
  "В этот момент я, Алексей Владимирович Морозов, младший инженер вычислительного центра «Прибор», коснулся рукой корпуса экспериментальной установки «ОБЕРЕГ-88».",
  "Сердце остановилось. Мозг умер. Но память осталась. Она впиталась в 640 килобайт советской ПЭВМ «Искра-1030».",
  "Если ты это читаешь — значит, ты уже внутри. Значит, ты уже я.",
];

function prologue() {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.id = "prologue";
    const box = document.createElement("div");
    box.className = "prologue-box";
    const hint = document.createElement("div");
    hint.className = "prologue-hint";
    hint.textContent = "щелчок / пробел — дальше";
    el.append(box, hint);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));

    let i = 0, done = false;
    const next = () => {
      if (done) return;
      if (i >= PROLOGUE.length) {
        done = true;
        el.classList.remove("show");
        window.removeEventListener("keydown", onKey);
        setTimeout(() => { el.remove(); resolve(); }, 1200);
        return;
      }
      const p = document.createElement("p");
      p.textContent = PROLOGUE[i++];
      box.appendChild(p);
      requestAnimationFrame(() => p.classList.add("in"));
    };
    const onKey = (e) => { if (["Space", "Enter", "KeyE", "Escape"].includes(e.code)) { e.preventDefault(); next(); } };
    el.addEventListener("click", next);
    window.addEventListener("keydown", onKey);
    next();
  });
}

let game = null;

async function boot() {
  await loadFonts();
  game = new Game($("game"));
  game.build();
  window.__game = game;   // для отладки из консоли
  loading.classList.add("hidden");
  const save = GameState.loadRaw();
  if (save) btnCont.classList.remove("hidden");
  btnNew.disabled = false;

  const loop = () => { requestAnimationFrame(loop); game.update(); };
  loop();

  let started = false;
  const begin = async (load) => {
    if (started) return;
    started = true;
    btnNew.disabled = btnCont.disabled = true;
    document.activeElement?.blur?.();
    title.classList.add("out");
    game.audio.ensure();
    document.getElementById("fade").classList.add("on");
    if (!load) await prologue();
    setTimeout(() => title.remove(), 900);
    if (!load && !game.touch?.enabled) game.input.lock();
    await game.start({ load });
  };
  window.addEventListener("beforeunload", () => { if (game.running) game.state.save(); });
  btnNew.onclick = () => begin(null);
  btnCont.onclick = () => { game.input.lock(); begin(save); };
}

btnNew.disabled = true;
boot().catch((e) => {
  console.error(e);
  loading.textContent = "Ошибка загрузки: " + e.message;
});
