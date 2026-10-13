// Ночной город за окнами. Строится один раз — кольцом вокруг дома, на
// безопасном расстоянии: раньше у каждого окна был свой квартал, и дома
// соседних окон оказывались прямо в чужих квартирах.

import * as THREE from "three";

// Центр и «радиус» дома в мировых координатах (квартиры + подъезд).
const CX = -8, CZ = 0;

function rand(i) { const x = Math.sin(i * 91.7 + 13.3) * 43758.5453; return x - Math.floor(x); }

function facadeTexture(seed) {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 512;
  const c = cv.getContext("2d");
  c.fillStyle = "#16151a"; c.fillRect(0, 0, 256, 512);
  // панели
  c.fillStyle = "#1b1a20";
  for (let y = 0; y < 512; y += 32) c.fillRect(0, y, 256, 2);
  const cols = 8, rows = 16;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const lit = rand(seed * 977 + r * 31 + k * 7) < 0.22;
    const x = 8 + k * 31, y = 8 + r * 32;
    if (lit) {
      const warm = rand(seed + r * 13 + k) < 0.8;
      c.fillStyle = warm ? "#d8a858" : "#9ab0c8";
      c.globalAlpha = 0.65 + rand(seed + k * 3 + r) * 0.35;
    } else {
      c.fillStyle = "#24232a";
      c.globalAlpha = 1;
    }
    c.fillRect(x, y, 18, 20);
    c.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function skyTexture() {
  const cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 512;
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#04050a"); g.addColorStop(0.45, "#0b0e18"); g.addColorStop(0.62, "#1a1b24"); g.addColorStop(1, "#141318");
  c.fillStyle = g; c.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 700; i++) {
    const y = rand(i + 5) * 260;
    c.fillStyle = `rgba(230,230,210,${0.2 + rand(i + 9) * 0.7})`;
    c.fillRect(rand(i) * 1024, y, rand(i + 3) < 0.05 ? 2 : 1, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene) {
  const G = new THREE.Group();
  G.name = "city";
  scene.add(G);

  // Небо — изнутри большой сферы, туман на него не действует.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.position.set(CX, 0, CZ);
  sky.renderOrder = -10;
  G.add(sky);

  const textures = [0, 1, 2, 3].map(facadeTexture);
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rand(i) * 0.12;
    const r = 34 + rand(i + 40) * 16;
    const w = 9 + rand(i + 80) * 8, d = 8 + rand(i + 90) * 6;
    const h = 30 + rand(i + 60) * 30;
    const tex = textures[i % textures.length].clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 18)));
    const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, color: 0x9a9aa0 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(CX + Math.cos(a) * r, -26 + h / 2, CZ + Math.sin(a) * r);
    b.rotation.y = -a + Math.PI / 2;
    b.userData.noPick = true;
    G.add(b);
  }
  return G;
}
