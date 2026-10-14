// The county-fair lawn: two clay pits 40 ft apart, platforms, picnic tables, bunting, a picket fence and the scenery behind.
// World axes: x = sim x (the pitcher's right), y up, z = -(sim z), so the lane runs towards -Z and the scenery's front (-Z) is the far pit.
// Everything is procedural (canvas textures, primitives); the scenery kit supplies the far hills, sky and farmhouses.
import { PIT, LANE } from '../src/sim.js';

export const CLAY_Y = 0.05;            // top of the clay inside the frame
export const FRAME_H = 0.11;
export const STAKE_H = 0.36;           // above the clay, as the rules say (14 in)

const rngOf = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export function makeTextures(THREE, anisotropy = 4) {
  const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy; return t; };
  // lawn: mowed stripes along the lane and fine blades
  const lawn = (() => {
    const c = cv(512, 512), g = c.getContext('2d'), r = rngOf(11);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#4f8f33' : '#5c9c3a'; g.fillRect(i * 128, 0, 128, 512); }
    for (let i = 0; i < 9000; i++) {
      const x = r() * 512, y = r() * 512, l = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 0.9, k = r();
      g.strokeStyle = k > 0.66 ? 'rgba(160,214,96,0.35)' : k > 0.33 ? 'rgba(30,86,30,0.35)' : 'rgba(90,150,50,0.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 160; i++) { const x = r() * 512, y = r() * 512; g.fillStyle = r() > 0.5 ? 'rgba(255,240,150,0.55)' : 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x, y, 0.9 + r() * 0.8, 0, 6.3); g.fill(); }
    return tex(c, [1, 1]);
  })();
  // packed clay: neutral tan grain with pebbles and tamped streaks (the material colour tints it per pit surface)
  const clay = (() => {
    const c = cv(512, 1024), g = c.getContext('2d'), r = rngOf(5);
    g.fillStyle = '#b79a78'; g.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 30000; i++) {
      const x = r() * 512, y = r() * 1024, s = 0.6 + r() * 1.8, k = r();
      g.fillStyle = k > 0.7 ? 'rgba(240,222,190,0.32)' : k > 0.35 ? 'rgba(70,50,30,0.3)' : 'rgba(150,120,86,0.34)';
      g.fillRect(x, y, s * (1 + r() * 0.8), s);
    }
    for (let i = 0; i < 380; i++) { const x = r() * 512, y = r() * 1024, s = 1.2 + r() * 2.8; g.fillStyle = r() > 0.5 ? 'rgba(232,214,184,0.55)' : 'rgba(60,44,28,0.45)'; g.beginPath(); g.ellipse(x, y, s, s * 0.7, r() * 3, 0, 6.3); g.fill(); }
    for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(60,40,20,0.07)'; g.lineWidth = 8 + r() * 18; const y = r() * 1024; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + (r() - 0.5) * 50, 340, y + (r() - 0.5) * 50, 512, y + (r() - 0.5) * 20); g.stroke(); }
    return tex(c, [1, 1]);
  })();
  // red and white check tablecloth
  const cloth = (() => {
    const c = cv(128, 128), g = c.getContext('2d');
    g.fillStyle = '#f4efe4'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(200,40,40,0.9)'; for (let i = 0; i < 4; i++) g.fillRect(i * 32, 0, 16, 128);
    g.fillStyle = 'rgba(200,40,40,0.75)'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 32, 128, 16);
    return tex(c, [3, 1.2]);
  })();
  // soft round sprite for puffs and glows
  const puff = (() => {
    const c = cv(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  // weathered planks (boards run along the lane), nail heads, grain and a worn middle
  const planks = (() => {
    const c = cv(512, 1024), g = c.getContext('2d'), r = rngOf(31), n = 5, pw = 512 / n;
    for (let i = 0; i < n; i++) {
      const base = [[150, 124, 92], [138, 112, 82], [160, 133, 98], [128, 104, 76], [146, 120, 88]][i];
      g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(i * pw, 0, pw, 1024);
      for (let k = 0; k < 70; k++) { const x = i * pw + r() * pw; g.strokeStyle = `rgba(${40 + r() * 40 | 0},${28 + r() * 20 | 0},16,${0.1 + r() * 0.18})`; g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 8, 300, x + (r() - 0.5) * 10, 700, x + (r() - 0.5) * 6, 1024); g.stroke(); }
      g.fillStyle = 'rgba(20,12,6,0.85)'; g.fillRect(i * pw, 0, 3, 1024);          // seam
      g.fillStyle = 'rgba(255,240,210,0.12)'; g.fillRect(i * pw + 3, 0, 2, 1024);
      for (const y of [90, 520, 940]) for (const sx of [0.18, 0.82]) { g.fillStyle = 'rgba(30,24,20,0.8)'; g.beginPath(); g.arc(i * pw + pw * sx, y + (i % 2) * 40, 3.4, 0, 6.3); g.fill(); g.fillStyle = 'rgba(210,200,185,0.5)'; g.beginPath(); g.arc(i * pw + pw * sx - 0.8, y + (i % 2) * 40 - 0.8, 1.3, 0, 6.3); g.fill(); }
    }
    for (let k = 0; k < 900; k++) { g.fillStyle = r() > 0.5 ? 'rgba(255,245,220,0.07)' : 'rgba(30,20,10,0.1)'; g.fillRect(r() * 512, r() * 1024, 1 + r() * 2, 4 + r() * 14); }
    return tex(c, [1, 1]);
  })();
  // where people have stood and shoes have landed: boot prints near the pitcher's end, a worn ring round the stake, shoe dents and drag marks
  const prints = (() => {
    const c = cv(512, 1024), g = c.getContext('2d'), r = rngOf(77);
    // the clay is v from the pit front (bottom of the canvas, towards the pitcher) to the back board (top)
    g.lineCap = 'round';
    // raked ridges
    for (let i = 0; i < 40; i++) { const y = 20 + r() * 980; g.strokeStyle = 'rgba(255,236,200,0.10)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(10 + r() * 30, y); g.lineTo(480 - r() * 30, y + (r() - 0.5) * 10); g.stroke(); g.strokeStyle = 'rgba(40,20,8,0.10)'; g.beginPath(); g.moveTo(10 + r() * 30, y + 3); g.lineTo(480 - r() * 30, y + 3 + (r() - 0.5) * 10); g.stroke(); }
    const boot = (x, y, a, s) => {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
      g.fillStyle = 'rgba(40,20,8,0.34)'; g.beginPath(); g.ellipse(0, -26, 17, 26, 0, 0, 6.3); g.fill();   // ball of the foot
      g.beginPath(); g.ellipse(0, 24, 12, 15, 0, 0, 6.3); g.fill();                                          // heel
      g.strokeStyle = 'rgba(255,230,190,0.18)'; g.lineWidth = 1.4;
      for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(-14, -26 + k * 5); g.lineTo(14, -26 + k * 5); g.stroke(); }
      g.strokeStyle = 'rgba(255,230,190,0.2)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -26, 17, 26, 0, 0, 6.3); g.stroke();
      g.restore();
    };
    boot(160, 960, 0.08, 1.0); boot(330, 930, -0.1, 1.0); boot(215, 760, 0.3, 0.95); boot(300, 690, -0.2, 0.95); boot(120, 520, 0.5, 0.9);
    // shoe dents: a U with a rim (dark inner, bright lip)
    const dent = (x, y, a, s) => {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
      const path = () => { g.beginPath(); g.moveTo(-34, -40); g.lineTo(-34, 0); g.arc(0, 0, 34, Math.PI, 0, true); g.lineTo(34, -40); };
      g.strokeStyle = 'rgba(30,14,4,0.45)'; g.lineWidth = 17; g.lineJoin = 'round'; path(); g.stroke();
      g.strokeStyle = 'rgba(255,226,180,0.28)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-43, -40); g.lineTo(-43, 0); g.arc(0, 0, 43, Math.PI, 0, true); g.lineTo(43, -40); g.stroke();
      g.restore();
    };
    dent(110, 350, 0.5, 0.9); dent(410, 300, -0.8, 0.9); dent(150, 140, -0.3, 0.9); dent(380, 460, 2.6, 0.85);
    g.strokeStyle = 'rgba(40,20,8,0.22)'; g.lineWidth = 6; for (const [x0, y0, x1, y1] of [[330, 600, 290, 470], [140, 260, 170, 200]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    return tex(c, [1, 1]);
  })();
  return { lawn, clay, cloth, puff, planks, prints };
}

export function buildWorld({ THREE, B, quality = 'high' }) {
  const hi = quality !== 'low';
  const T = makeTextures(THREE, quality === 'high' ? 8 : 4);
  const group = new THREE.Group(); group.name = 'hs-world';
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o });
  const css = (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);
  const wood = (c, o = {}) => B.material('wood', { color: css(c), ...o });
  const W = { group, T, pits: [], tick: [], bunting: [] };

  // ---- the lawn: a big disc with mowed stripes (the scenery kit supplies hills and sky; it brings no ground of its own here)
  {
    const geo = new THREE.CircleGeometry(150, 48);
    const t = T.lawn; t.repeat.set(60, 60);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 1, metalness: 0, color: 0xdfe8c8 }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; group.add(m); W.lawn = m;
    // a lighter, closer-mown strip down the lane
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.6, LANE + 4), new THREE.MeshStandardMaterial({ color: 0x8dbf5a, roughness: 1, transparent: true, opacity: 0.2 }));
    strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.003, -LANE / 2); group.add(strip);
  }

  // ---- one pit (near = rotated half a turn, so its back board stands behind the pitcher)
  function pit(zs, flip) {
    const g = new THREE.Group(); g.position.set(0, 0, -zs); if (flip) g.rotation.y = Math.PI; group.add(g);
    const hw = PIT.halfW, len = PIT.back - PIT.front, cz = -(PIT.back + PIT.front) / 2;   // local: +v is -Z
    // clay (slightly lumpy), with its own material so the surface type can be tinted
    const geo = new THREE.PlaneGeometry(hw * 2, len, 2, 2);
    const clayM = new THREE.MeshStandardMaterial({ map: T.clay, bumpMap: T.clay, bumpScale: 2.2, roughness: 0.93, metalness: 0 });
    const clay = new THREE.Mesh(geo, clayM); clay.rotation.x = -Math.PI / 2; clay.position.set(0, CLAY_Y, cz); clay.receiveShadow = true; g.add(clay);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, len), new THREE.MeshStandardMaterial({ map: T.prints, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    pm.rotation.x = -Math.PI / 2; pm.position.set(0, CLAY_Y + 0.0012, cz); pm.receiveShadow = true; g.add(pm);
    // earth under it so there is no gap
    const base = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.02, CLAY_Y, len + 0.02), M(0x6b4423)); base.position.set(0, CLAY_Y / 2 - 0.001, cz); g.add(base);
    // frame boards
    const bw = 0.07, boardM = wood(0x8a6a44, { repeat: [3, 1] });
    const mk = (w, h, d, x, y, z, mat = boardM) => { const m = new THREE.Mesh(B.roundedBox(w, h, d, 0.012, 3), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    mk(bw, FRAME_H, len + 2 * bw, -(hw + bw / 2), FRAME_H / 2, cz);
    mk(bw, FRAME_H, len + 2 * bw, hw + bw / 2, FRAME_H / 2, cz);
    mk(hw * 2, FRAME_H, bw, 0, FRAME_H / 2, cz + len / 2 + bw / 2);          // front (towards the pitcher: +Z local)
    // back board: tall, painted
    const back = mk(hw * 2 + 2 * bw + 0.02, 0.38, 0.045, 0, 0.19, cz - len / 2 - 0.0225, wood(0x7c5a38, { repeat: [3, 1] }));
    back.castShadow = true; back.name = 'backboard';
    { // a painted stripe and four bolts on the backboard's face
      const zf = cz - len / 2 + 0.0008, stripe = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 - 0.06, 0.05), M(0xe9dfc6, { roughness: 0.6 }));
      stripe.rotation.y = Math.PI; stripe.position.set(0, 0.2, zf); g.add(stripe);
      for (const sx of [-1, 1]) { const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 12), new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.9, roughness: 0.3 })); bolt.rotation.x = Math.PI / 2; bolt.position.set(sx * (hw - 0.04), 0.3, zf - 0.004); g.add(bolt); }
    }
    // stake: steel, tilted towards the pitcher (12 degrees, as the rules require)
    const st = new THREE.Group(); st.position.set(0, CLAY_Y - 0.02, 0); g.add(st);
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0175, STAKE_H + 0.1, 24), new THREE.MeshStandardMaterial({ color: 0xe3e8ee, metalness: 0.95, roughness: 0.16, envMapIntensity: 2.4 }));
    stake.position.y = (STAKE_H + 0.1) / 2 - 0.05; stake.castShadow = true; st.add(stake);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), stake.material); cap.position.y = STAKE_H + 0.05; st.add(cap);
    // worn collar where the stake meets the clay: a ring of loosened clay and a dark crack
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 8, 28), new THREE.MeshStandardMaterial({ color: 0x8a5c36, roughness: 1 }));
    collar.rotation.x = Math.PI / 2; collar.position.set(0, CLAY_Y + 0.003, 0); collar.scale.z = 0.45; g.add(collar);
    const lean = 10 * Math.PI / 180;
    st.rotation.x = lean;      // top towards +Z local = towards the pitcher of this pit
    // compacted ring where shoes keep landing
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshBasicMaterial({ color: 0x4a2410, transparent: true, opacity: 0.1, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, CLAY_Y + 0.001, 0); g.add(ring);
    const rec = { group: g, clay, clayM, stakeGroup: st, lean, stakeBase: st.position.clone(), wobble: 0, wobT: 0, flip };
    W.pits.push(rec);
    return rec;
  }
  W.near = pit(0, true);
  W.far = pit(LANE, false);
  W.setClay = (tint) => { for (const p of W.pits) p.clayM.color.set(tint); };

  // ---- pitcher's platforms (weathered planks) either side of each pit
  for (const zs of [0, LANE]) for (const sx of [-1, 1]) {
    const px = sx * 1.02, p = new THREE.Mesh(B.roundedBox(1.15, 0.045, 1.9, 0.01, 2), wood(0x9b8a6e, { repeat: [1, 3] }));
    p.name = 'platform'; p.position.set(px, 0.0225, -zs); p.receiveShadow = true; p.castShadow = true; group.add(p);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.9), new THREE.MeshStandardMaterial({ map: T.planks, roughness: 0.88, metalness: 0 }));
    top.rotation.x = -Math.PI / 2; top.position.set(px, 0.0457, -zs); top.receiveShadow = true; group.add(top);
  }

  // ---- picket fence behind the far pit and along one side
  {
    const n = 150, pk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 1.0, 0.025), M(0xf3efe4, { roughness: 0.85 }), n);
    const o = new THREE.Object3D(); let i = 0;
    for (let k = 0; k < 90; k++) { o.position.set(-9 + k * 0.2, 0.5, -(LANE + 6)); o.rotation.set(0, 0, 0); o.updateMatrix(); pk.setMatrixAt(i++, o.matrix); }
    for (let k = 0; k < 60; k++) { o.position.set(9.0, 0.5, -(LANE + 6) + k * 0.2); o.updateMatrix(); pk.setMatrixAt(i++, o.matrix); }
    pk.count = i; pk.castShadow = hi; pk.receiveShadow = true; group.add(pk);
    for (const y of [0.3, 0.75]) {
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(18, 0.06, 0.04), M(0xe9e4d6)); r1.position.set(0, y, -(LANE + 6.03)); r1.castShadow = hi; group.add(r1);
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 12), M(0xe9e4d6)); r2.position.set(9.03, y, -(LANE + 6) + 6); group.add(r2);
    }
  }

  // ---- picnic tables with check cloths, benches, lemonade
  function table(x, zs, yaw) {
    const g = new THREE.Group(); g.position.set(x, 0, -zs); g.rotation.y = yaw; group.add(g);
    const tw = wood(0xa8794a, { repeat: [2, 1] });
    const top = new THREE.Mesh(B.roundedBox(1.9, 0.045, 0.78, 0.01, 2), tw); top.position.y = 0.74; top.castShadow = true; top.receiveShadow = true; g.add(top);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.66), new THREE.MeshStandardMaterial({ map: T.cloth, roughness: 0.95, side: THREE.DoubleSide }));
    cl.rotation.x = -Math.PI / 2; cl.position.y = 0.7655; cl.receiveShadow = true; g.add(cl);
    for (const sz of [-1, 1]) {
      const bench = new THREE.Mesh(B.roundedBox(1.9, 0.045, 0.26, 0.008, 2), tw); bench.position.set(0, 0.44, sz * 0.62); bench.castShadow = true; bench.receiveShadow = true; g.add(bench);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.05), tw); leg.position.set(sx * 0.7, 0.38, sz * 0.32); leg.rotation.z = sx * -0.0; leg.castShadow = true; g.add(leg);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.05), tw); b2.position.set(sx * 0.7, 0.22, sz * 0.62); b2.castShadow = true; g.add(b2);
    }
    // jug of lemonade, cups, a pie
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffe08a, roughness: 0.08, transmission: 0, transparent: true, opacity: 0.8, metalness: 0, clearcoat: 1 });
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.24, 20), glass); jug.position.set(-0.4, 0.77 + 0.12, 0.05); jug.castShadow = true; g.add(jug);
    for (let k = 0; k < 3; k++) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.09, 14), M(k % 2 ? 0xe74c3c : 0x2f80d6)); cup.position.set(-0.05 + k * 0.12, 0.81, -0.15 + (k % 2) * 0.1); cup.castShadow = true; g.add(cup); }
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.05, 24), M(0xd9a24b, { roughness: 0.9 })); pie.position.set(0.45, 0.79, 0); pie.castShadow = true; g.add(pie);
    return g;
  }
  W.tables = [table(-4.6, 2.4, 0.2), table(-6.2, 8.5, -0.15)];

  // ---- bunting between two posts behind the far pit, swaying in a light breeze
  {
    const mats = [0xd8362f, 0xf6eed8, 0x2f6fb4, 0xf0b52a, 0x3f9a58];
    const mk = (x0, z0, x1, z1, hgt, n, sag) => {
      const flags = [];
      for (const x of [x0, x1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, hgt + 0.6, 10), wood(0x7a5a38)); pole.position.set(x, (hgt + 0.6) / 2, z0 + (x === x0 ? 0 : z1 - z0)); pole.castShadow = true; group.add(pole); }
      const pts = [];
      for (let i = 0; i <= 80; i++) { const u = i / 80; pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, hgt - 4 * sag * u * (1 - u), z0 + (z1 - z0) * u)); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a3a2a })); group.add(line);
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3)); fg.setIndex([0, 1, 2]); fg.computeVertexNormals();
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, f = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: mats[i % mats.length], roughness: 0.85, side: THREE.DoubleSide }));
        f.position.set(x0 + (x1 - x0) * u, hgt - 4 * sag * u * (1 - u) - 0.02, z0 + (z1 - z0) * u);
        const slope = Math.atan2(-4 * sag * (1 - 2 * u), (x1 - x0)); f.rotation.z = -slope * 0.0; f.castShadow = false; group.add(f); flags.push({ f, ph: i * 0.9 + z0 });
      }
      return flags;
    };
    W.bunting.push(...mk(-9, -(LANE + 6), 9, -(LANE + 6), 2.9, 36, 0.55));
    W.bunting.push(...mk(-9, -(LANE + 6), -9, -4, 2.8, 20, 0.35));
    W.tick.push((t) => { for (const b of W.bunting) { b.f.rotation.x = Math.sin(t * 1.6 + b.ph) * 0.18; b.f.rotation.y = Math.sin(t * 1.1 + b.ph * 1.7) * 0.22; } });
  }

  // ---- hay bales and a cooler by the near platforms
  {
    const hay = new THREE.MeshStandardMaterial({ color: 0xd9bb62, roughness: 1 });
    for (const [x, zs, ry] of [[4.8, 1.2, 0.3], [5.6, -0.6, -0.5], [-3.4, -1.2, 0.8]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.45), hay); b.position.set(x, 0.225, -zs); b.rotation.y = ry; b.castShadow = true; b.receiveShadow = true; group.add(b);
    }
    const cooler = new THREE.Mesh(B.roundedBox(0.6, 0.36, 0.36, 0.04, 3), M(0xd8362f, { roughness: 0.55 })); cooler.position.set(-2.3, 0.18, 1.5); cooler.rotation.y = 0.5; cooler.castShadow = true; group.add(cooler);
    const lid = new THREE.Mesh(B.roundedBox(0.62, 0.05, 0.38, 0.02, 3), M(0xf2f2f2, { roughness: 0.5 })); lid.position.set(-2.3, 0.385, 1.5); lid.rotation.y = 0.5; group.add(lid);
  }

  W.update = (t) => { for (const f of W.tick) f(t); };
  W.dispose = () => { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); };
  return W;
}
