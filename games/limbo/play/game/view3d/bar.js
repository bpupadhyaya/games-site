// The limbo bar and its two poles. Bamboo rounds, torch rounds (flame cups on the poles) and fire rounds (the bar itself burns).
// When the sim reports a touch the bar is released and falls with its own little physics (spin, bounce on the sand); visuals only.
import * as THREE from '../vendor3d/three.js';
import { bambooTexture, clamp, hash } from './fx.js';

export const BAR_HALF = 0.86;               // the poles stand this far either side of the dancer's line (z)
export const BAR_R = 0.0165;                // a real bamboo limbo bar is about 3 cm across
const POLE_R = 0.032;

function barTexture() {
  const W = 32, H = 512, c = globalThis.document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, '#b98a35'); gr.addColorStop(0.35, '#f6d88a'); gr.addColorStop(0.7, '#e0b655'); gr.addColorStop(1, '#a8782c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // coloured tape bands, like the real bars wrapped for the show
  const cols = ['#18b7a6', '#ff6a4d', '#fff2c2'];
  for (let i = 0; i < 12; i++) { g.fillStyle = cols[i % 3]; g.globalAlpha = 0.95; g.fillRect(0, (i / 12) * H + 8, W, 16); }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(90,50,8,0.4)'; for (let i = 0; i < 4; i++) g.fillRect(0, (i + 0.5) * (H / 4) - 2, W, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createBar({ flameTex, glowTex, particles, embers }) {
  const root = new THREE.Group();
  const bamboo = bambooTexture(6);
  const poleGeo = new THREE.CylinderGeometry(POLE_R * 0.85, POLE_R, 1, 10);
  const poles = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ map: bamboo, roughness: 0.55 }));
    p.castShadow = true; g.add(p);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(POLE_R * 1.5, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 0.85, roughness: 0.28 }));
    g.add(cap);
    // sand mound and a dark wet ring where the pole is planted
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.2, 0.09, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xcfa070, roughness: 1, side: THREE.DoubleSide }));
    mound.position.y = 0.045; g.add(mound);
    // bar rest: a small brass peg
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 8), new THREE.MeshStandardMaterial({ color: 0xd6a63a, metalness: 0.9, roughness: 0.3 }));
    peg.rotation.x = Math.PI / 2; peg.position.set(0, 0, -s * 0.05); g.add(peg);
    // flame cup on the top (torch rounds)
    const cup = new THREE.Group();
    const cupM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.035, 0.09, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2e28, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide }));
    cup.add(cupM);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    fl.scale.set(0.2, 0.42, 1); fl.center.set(0.5, 0.1); fl.position.y = 0.05; cup.add(fl);
    const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false }));
    hl.scale.set(1.3, 1.3, 1); hl.position.y = 0.2; cup.add(hl);
    g.add(cup);
    root.add(g);
    poles.push({ g, p, cap, cup, fl, hl, s });
  }
  // the bar itself
  const bar = new THREE.Group();
  const bm = new THREE.Mesh(new THREE.CylinderGeometry(BAR_R, BAR_R, 2 * BAR_HALF - 0.02, 12), new THREE.MeshStandardMaterial({ map: barTexture(), roughness: 0.45, metalness: 0.0, emissive: 0x000000 }));
  bm.rotation.x = Math.PI / 2; bm.castShadow = true; bar.add(bm);
  // flames along the bar (fire rounds)
  const NF = 15, flames = [];
  for (let i = 0; i < NF; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xff9a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.center.set(0.5, 0.08); s.position.set(0, 0.01, -BAR_HALF + 0.1 + (i / (NF - 1)) * (2 * BAR_HALF - 0.2));
    bar.add(s); flames.push(s);
  }
  const light = new THREE.PointLight(0xff9040, 0, 5, 1.7); bar.add(light);
  root.add(bar);

  const S = { fallen: false, y: 1, vy: 0, wx: 0, wz: 0, rx: 0, rz: 0, yaw: 0, wyaw: 0, ox: 0, vx: 0, t: 0, bounce: 0, variant: 'bamboo', fire: 0 };
  const B = { root, bar, poles, flames, light, S };

  B.variantFor = (round) => (round >= 9 ? 'fire' : round >= 6 ? 'torch' : 'bamboo');
  B.setVariant = (v) => { S.variant = v; };
  B.setHeight = (h) => { S.y = h; };
  B.reset = () => { S.fallen = false; S.vy = 0; S.rx = S.rz = S.yaw = S.ox = 0; S.wx = S.wz = S.wyaw = S.vx = 0; S.bounce = 0; };
  // the dancer hit the bar: release it, tipping away from the dancer
  B.release = (dir = 1, hitZ = 0) => {
    if (S.fallen) return;
    S.fallen = true; S.vy = 0.3; S.vx = 0.22 * dir; S.bounce = 0;
    S.rxT = (hitZ >= 0 ? 1 : -1) * (0.18 + hash(S.y * 91) * 0.2);       // one end drops first
    S.rx = 0; S.wx = (hitZ >= 0 ? 1 : -1) * 1.2; S.yaw = 0; S.wyaw = (hash(S.y * 13) - 0.5) * 0.9; S.wz = 0;
  };

  let T = 0;
  B.update = (dt, { calm = false, h = S.y, wind = 0 } = {}) => {
    T += dt;
    if (!S.fallen) S.y = h;
    // poles and bar placement
    const poleH = Math.max(S.y + 0.3, 1.0);
    for (const q of poles) {
      q.g.position.set(0, 0, q.s * BAR_HALF);
      q.p.scale.set(1, poleH, 1); q.p.position.y = poleH / 2;
      q.cap.position.y = poleH + POLE_R * 0.6;
      q.cup.position.y = poleH + POLE_R * 1.2 + 0.06;
      const on = S.variant === 'torch' ? 1 : 0;
      q.cup.visible = on > 0;
      if (on) {
        const f = 0.82 + 0.18 * Math.sin(T * 17 + q.s * 3) + 0.1 * Math.sin(T * 31 + q.s);
        q.fl.scale.set(0.16 * (0.9 + 0.2 * f), 0.4 * f, 1);
        q.hl.material.opacity = 0.35 + 0.25 * f;
      }
      q.peg_y = S.y;
    }
    const pegY = S.fallen ? null : S.y;
    for (const q of poles) q.g.children[3].position.y = pegY === null ? -5 : Math.max(0.1, pegY - BAR_R - 0.012);   // brass peg under the bar
    // bar state
    if (S.fallen) {
      S.vy -= 9.8 * dt; S.y += S.vy * dt; S.yaw += S.wyaw * dt; S.ox += S.vx * dt;
      S.rx += (S.rxT - S.rx) * Math.min(1, dt * 7);                  // tips, then lies flat as it lands
      S.vx *= Math.exp(-1.6 * dt); S.wyaw *= Math.exp(-2.0 * dt);
      if (S.y < BAR_R + 0.01) {
        S.y = BAR_R + 0.01;
        if (Math.abs(S.vy) > 0.5 && S.bounce < 3) { S.vy = -S.vy * 0.34; S.rxT *= 0.35; S.bounce++; if (particles && !calm) for (let i = 0; i < 6; i++) particles.emit(S.ox + (hash(i + T) - 0.5) * 0.6, 0.03, (hash(i * 7 + T) - 0.5) * 1.6, (hash(i) - 0.5) * 0.8, 0.5 + hash(i + 3) * 0.6, (hash(i + 5) - 0.5) * 0.6, 0.7, 0.12, 0.3, 0.85, 0.68, 0.45, 0.8); }
        else { S.vy = 0; S.rxT = 0; S.wyaw *= 0.6; }
      }
    }
    bar.position.set(S.ox, S.y, 0);
    bar.rotation.set(S.fallen ? S.rx : 0, S.fallen ? S.yaw : 0, 0);
    // fire
    const fireTarget = S.variant === 'fire' ? 1 : 0;
    S.fire += (fireTarget - S.fire) * Math.min(1, dt * 4);
    const calmK = calm ? 0.6 : 1;
    flames.forEach((f, i) => {
      const on = S.fire;
      f.visible = on > 0.02;
      if (!f.visible) return;
      const fl = 0.8 + 0.2 * Math.sin(T * (13 + i * 1.7) + i * 2.1) + 0.12 * Math.sin(T * 29 + i * 5.3);
      const gust = 1 + wind * 0.4;
      f.scale.set(0.26 * (0.9 + 0.2 * fl) * calmK, (0.3 + 0.1 * (i % 3)) * fl * on * gust, 1);
      f.material.opacity = on * (0.75 + 0.25 * fl);
    });
    light.intensity = S.fire * (3.2 + 0.9 * Math.sin(T * 21) + 0.5 * Math.sin(T * 37.3));
    light.position.set(0, 0.35, 0);
    // embers and soft smoke rising from the burning bar and the torch cups
    if (embers && !calm && (S.fire > 0.5 || S.variant === 'torch')) {
      const n = S.fire > 0.5 ? 2 : 0;
      for (let i = 0; i < n; i++) {
        if (hash(T * 91 + i) < 0.5) continue;
        const z = (hash(T * 13 + i) - 0.5) * 2 * (BAR_HALF - 0.1);
        embers.emit(bar.position.x + (hash(T * 7) - 0.5) * 0.05, bar.position.y + 0.1, z, (hash(T * 5 + i) - 0.5) * 0.2 + wind * 0.1, 0.7 + hash(T * 3 + i) * 0.9, (hash(T + i) - 0.5) * 0.2, 0.9 + hash(T * 17) * 0.8, 0.09, 0.02, 1.0, 0.55, 0.15, 0.9);
      }
    }
  };
  B.worldBar = () => bar.position;
  B.dispose = () => {};
  return B;
}
