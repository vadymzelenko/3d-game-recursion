// Точка входа.

import { Game } from "./game.js";

const canvas = document.getElementById("game");
const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");

let game = null;

function boot() {
  game = new Game(canvas);
  game.start();
  requestAnimationFrame(loop);
}

function loop() {
  requestAnimationFrame(loop);
  if (game) game.update();
}

startBtn.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  boot();
});
