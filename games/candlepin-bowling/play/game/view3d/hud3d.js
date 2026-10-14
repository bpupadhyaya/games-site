// The HUD in 3D: every panel and button the 2D layer recorded (src/v3.js) becomes a lit slab: chrome-rimmed enamel plates, paper
// cards and glossy buttons that sink when pressed. The text stays 2D on top. Drawn with an orthographic camera in virtual units
// after the lane scene, once per scroll clip so lists never bleed past their frame.
import { board3d as B } from '../vendor3d/index.js';
import { cvs, tex, pinGeometry, ballMaterial } from './models.js';

export function createHud({ THREE, renderer }) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera();
  const key = new THREE.DirectionalLight(0xfff4e0, 2.2); key.position.set(-500, 800, 1000);
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.5); fill.position.set(700, -300, 600);
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x2a2438, 0.6), key, fill);
  const ROT = Math.PI / 2;
  let projW = 0, projH = 0;
  const setProj = (Wp, Hp) => {
    const n = 1, f = 2400, m = cam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    cam.projectionMatrixInverse.copy(m).invert();
  };
  const flat = new THREE.PlaneGeometry(1, 1);

  // materials
  const M = {};
  const phys = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, metalness: 0, ...o });
  M.chrome = new THREE.MeshStandardMaterial({ color: '#e4e8f2', metalness: 1, roughness: 0.2, envMapIntensity: 1.2 });
  M.brass = new THREE.MeshStandardMaterial({ color: '#d9a339', metalness: 0.9, roughness: 0.3, envMapIntensity: 1.1 });
  M.teal = new THREE.MeshStandardMaterial({ color: '#2fd3c4', metalness: 0.8, roughness: 0.3, envMapIntensity: 1.1 });
  const felt = tex(cvs(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1c2c4e'); gr.addColorStop(1, '#101b36'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h); let s = 7;
    for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.1; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }), { repeat: [3, 3] });
  M.plate = phys('#ffffff', { map: felt, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  M.plateOn = phys('#ffffff', { map: felt, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.25, emissive: '#16305c', emissiveIntensity: 0.6 });
  M.paper = new THREE.MeshStandardMaterial({ color: '#f6efd9', roughness: 0.92, metalness: 0 });
  M.cell = phys('#fffdf4', { roughness: 0.5, clearcoat: 0.3 });
  M.cellOn = phys('#fff0c2', { roughness: 0.45, clearcoat: 0.4, emissive: '#ffcf70', emissiveIntensity: 0.25 });
  M.cellEdge = new THREE.MeshStandardMaterial({ color: '#2b3558', roughness: 0.6 });
  M.chip = phys('#0d1731', { roughness: 0.4, clearcoat: 0.8, emissive: '#0b2a3a', emissiveIntensity: 0.6 });
  M.gold = phys('#ffc24a', { roughness: 0.3, clearcoat: 1, emissive: '#7a4a00', emissiveIntensity: 0.4 });
  const btn = {
    primary: phys('#e0301f', { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
    active: phys('#17a99d', { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }),
    plain: phys('#25457a', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    dark: phys('#222638', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }),
    disabled: phys('#9aa1b3', { roughness: 0.6, clearcoat: 0.2 }),
  };
  const accents = new Map();
  const accentMat = (c) => { let m = accents.get(c); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.1 }); accents.set(c, m); } return m; };

  // geometry cache
  const geoCache = new Map();
  const slab = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`;
    let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = ROT; return m; };

  // pools
  const pool = { panels: [], buttons: [], shades: new Map() };
  function panelAt(i) {
    let p = pool.panels[i];
    if (!p) { const g = new THREE.Group(), a = mesh(flat, M.chrome), b = mesh(flat, M.plate); g.add(a, b); scene.add(g); p = { g, a, b }; pool.panels.push(p); }
    return p;
  }
  function buttonAt(i) {
    let p = pool.buttons[i];
    if (!p) { const g = new THREE.Group(), a = mesh(flat, M.chrome), b = mesh(flat, btn.plain); g.add(a, b); scene.add(g); p = { g, a, b }; pool.buttons.push(p); }
    return p;
  }
  function placePanel(p, it, z) {
    const r = it.r, cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = it.rad;
    const k = it.kind;
    let dep = 14, ins = 6, rim = M.chrome, body = M.plate;
    if (k === 'plateOn') { rim = it.accent ? accentMat(it.accent) : M.brass; body = M.plateOn; }
    else if (k === 'paper') { rim = M.chrome; body = M.paper; ins = 7; }
    else if (k === 'cell' || k === 'cellOn') { rim = M.cellEdge; body = k === 'cell' ? M.cell : M.cellOn; dep = 5; ins = 2.4; }
    else if (k === 'chip') { rim = M.teal; body = M.chip; dep = 8; ins = 3; }
    else if (k === 'gold') { rim = M.brass; body = M.gold; dep = 8; ins = 2.5; }
    p.g.visible = true;
    const small = Math.min(r.w, r.h);
    ins = Math.min(ins, small * 0.3);
    p.a.material = rim; p.b.material = body;
    p.a.geometry = slab(r.w, r.h, dep, rad, Math.min(5, small * 0.2));
    p.b.geometry = slab(r.w - ins * 2, r.h - ins * 2, dep + 2.2, Math.max(2, rad - ins), Math.min(2.5, small * 0.15));
    p.a.position.set(cx, cy, z); p.b.position.set(cx, cy, z);
  }
  function placeButton(p, it, z) {
    const r = it.r, cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3);
    const dep = it.pressed ? 7 : 17;
    p.g.visible = true;
    p.a.material = M.chrome; p.b.material = btn[it.kind] || btn.plain;
    p.a.geometry = slab(r.w, r.h, dep - 4, rad, 4);
    p.b.geometry = slab(r.w - 8, r.h - 8, dep, Math.max(3, rad - 3), 6);
    p.a.position.set(cx, cy, z); p.b.position.set(cx, cy, z);
    p.g.position.y = it.pressed ? -3 : 0;
  }
  function shadePlane(it, L) {
    const key = `${it.key}|${Math.round(it.r.w)}x${Math.round(it.r.h)}`;
    let s = pool.shades.get(key);
    if (!s) {
      const sc = 0.5, c = cvs(Math.max(2, Math.round(it.r.w * sc)), Math.max(2, Math.round(it.r.h * sc)));
      const g = c.getContext('2d'); g.scale(sc, sc); it.draw(g, it.r.w, it.r.h);
      const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: true, depthTest: true }));
      m.material.map.colorSpace = THREE.SRGBColorSpace;
      scene.add(m); s = { m, used: 0 };
      pool.shades.set(key, s);
      if (pool.shades.size > 24) { const first = pool.shades.keys().next().value; const f = pool.shades.get(first); scene.remove(f.m); f.m.material.map.dispose(); f.m.material.dispose(); pool.shades.delete(first); }
    }
    return s;
  }

  // result trophy: three gold candlepins on a walnut plinth with the ball, turning slowly
  const trophy = new THREE.Group(); trophy.visible = false; scene.add(trophy);
  {
    const gold = new THREE.MeshStandardMaterial({ color: '#f3b933', metalness: 1, roughness: 0.22, envMapIntensity: 1.6 });
    const silver = new THREE.MeshStandardMaterial({ color: '#cfd6e4', metalness: 1, roughness: 0.25, envMapIntensity: 1.5 });
    trophy.userData.mats = { gold, silver };
    const mk = (x, sc, mat) => { const m = new THREE.Mesh(pinGeometry(), mat); m.position.set(x, 0.19 * sc + 0.07, 0); m.scale.setScalar(sc); return m; };
    trophy.userData.pins = [mk(-0.1, 0.8, gold), mk(0, 1.05, gold), mk(0.1, 0.8, gold)];
    trophy.add(...trophy.userData.pins);
    const base = new THREE.Mesh(B.slab(0.4, 0.2, 0.07, 0.04, 0.02), new THREE.MeshPhysicalMaterial({ color: '#4a2c14', roughness: 0.35, clearcoat: 1 }));
    base.position.y = 0; trophy.add(base);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.057, 28, 20), ballMaterial()); ball.position.set(0.2, 0.127, 0.06); trophy.add(ball);
  }
  let spin = 0;
  let pressed = null;
  const clipKey = (c) => (c ? `${Math.round(c.x)},${Math.round(c.y)},${Math.round(c.w)},${Math.round(c.h)}` : 'full');
  return {
    setPressed(p) { pressed = p; },
    setEnv(t) { scene.environment = t; scene.environmentIntensity = 0.55; },
    render(L, W, H, items, dt = 0.016) {
      const hero = items.hero;
      trophy.visible = !!hero && items.scene === 'result';
      if (trophy.visible) {
        spin += dt;
        const sc = hero.h * 1.15 / 0.5;
        trophy.scale.setScalar(sc);
        trophy.position.set(hero.x + hero.w / 2, -(hero.y + hero.h * 0.97), -900);
        trophy.rotation.set(0.12, Math.sin(spin * 0.8) * 0.5, 0);
        const g = hero.good !== false;
        trophy.userData.pins.forEach((m) => { m.material = g ? trophy.userData.mats.gold : trophy.userData.mats.silver; });
      }
      if (projW !== L.w || projH !== L.h) { projW = L.w; projH = L.h; setProj(L.w, L.h); }
      const s = W / L.w;
      for (const p of pool.panels) p.g.visible = false;
      for (const p of pool.buttons) p.g.visible = false;
      for (const sp of pool.shades.values()) sp.m.visible = false;
      const groups = new Map();
      const add = (it, kind) => { const k = clipKey(it.clip); if (!groups.has(k)) groups.set(k, { clip: it.clip, items: [] }); groups.get(k).items.push({ it, kind }); };
      let pi = 0, bi = 0;
      const placed = [];
      for (const it of items.panels) { const p = panelAt(pi++); placePanel(p, it, -1900 + it.o * 3); placed.push({ g: p.g, clip: it.clip }); }
      for (const it of items.buttons) { const p = buttonAt(bi++); placeButton(p, it, -1900 + it.o * 3 + 1); placed.push({ g: p.g, clip: it.clip }); }
      for (const it of items.shades) {
        const sp = shadePlane(it, L); sp.m.visible = true;
        sp.m.scale.set(it.r.w, it.r.h, 1); sp.m.position.set(it.r.x + it.r.w / 2, -(it.r.y + it.r.h / 2), -1900 + it.o * 3 - 1);
        placed.push({ g: sp.m, clip: null });
      }
      if (!placed.length && !trophy.visible) return;
      // render each distinct clip with its own scissor: toggle visibility per group
      const keys = new Map();
      for (const pl of placed) { const k = clipKey(pl.clip); if (!keys.has(k)) keys.set(k, { clip: pl.clip, list: [] }); keys.get(k).list.push(pl.g); }
      const all = placed.map((p) => p.g);
      for (const grp of keys.values()) {
        for (const g of all) g.visible = false;
        for (const g of grp.list) g.visible = true;
        if (grp.clip) {
          const c = grp.clip, x0 = Math.max(0, c.x), x1 = Math.min(L.w, c.x + c.w);
          renderer.setScissorTest(true);
          renderer.setScissor(Math.floor(x0 * s), Math.floor(H - (c.y + c.h) * s), Math.ceil((x1 - x0) * s), Math.ceil(c.h * s));
        } else renderer.setScissorTest(false);
        renderer.clearDepth();
        renderer.render(scene, cam);
      }
      renderer.setScissorTest(false);
    },
  };
}
