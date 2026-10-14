// The theatre courtyard: lacquered wooden stage on a stone yard, red pillars with gold, strings of paper lanterns, a painted night backdrop, drifting
// dust in the footlight, and a standing audience (crowd3d) around the open side. Presentation only.
import * as THREE from '../vendor3d/three.js';
import { createLantern, glowTexture, hash, TAU } from './models.js';

function canvasTex(w, h, paint, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function plankTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const rows = 12, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const base = 120 + hash(r + 3) * 40;
      g.fillStyle = `rgb(${base + 40},${base * 0.55 + 8},${base * 0.28})`; g.fillRect(0, r * rh, w, rh);
      for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(40,12,4,${0.05 + hash(r * 60 + k) * 0.1})`; g.lineWidth = 1 + hash(k + r) * 2; g.beginPath(); const y = r * rh + hash(r * 91 + k * 7) * rh; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (hash(k) - 0.5) * 6, w * 0.6, y + (hash(k + 5) - 0.5) * 6, w, y + (hash(k + 9) - 0.5) * 4); g.stroke(); }
      g.fillStyle = 'rgba(20,6,2,0.8)'; g.fillRect(0, r * rh, w, 3);
      const cut = hash(r + 40) * w; g.fillRect(cut, r * rh, 3, rh);                        // butt joint
      g.fillStyle = 'rgba(255,200,150,0.07)'; g.fillRect(0, r * rh + 3, w, 2);
    }
  }, { repeat: [2.2, 1.6] });
}
function stoneTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2a2428'; g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const l = 48 + hash(i * 9 + j) * 22; g.fillStyle = `rgb(${l},${l - 4},${l + 2})`; g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${hash(k + i) > 0.5 ? 255 : 0},${hash(k + j) > 0.5 ? 240 : 0},${200},0.05)`; g.fillRect(i * s + hash(k * 3 + i) * s, j * s + hash(k * 7 + j) * s, 2 + hash(k) * 10, 2 + hash(k + 1) * 6); }
    }
  }, { repeat: [14, 14] });
}
function carpetTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7a0f1c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${hash(i) > 0.5 ? 255 : 0},0,0,${0.03 + hash(i + 1) * 0.05})`; g.fillRect(hash(i + 2) * w, hash(i + 3) * h, 2, 2); }
    g.strokeStyle = '#e9c45c'; g.lineWidth = 8; g.strokeRect(22, 22, w - 44, h - 44);
    g.lineWidth = 3; g.strokeRect(40, 40, w - 80, h - 80);
    g.strokeStyle = 'rgba(233,196,92,0.55)'; g.lineWidth = 2.5;
    for (let k = 0; k < 6; k++) { const x = 70 + k * 74; g.beginPath(); g.arc(x, 70, 22, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, h - 70, 22, 0, TAU); g.stroke(); }
    g.beginPath(); g.arc(w / 2, h / 2, 110, 0, TAU); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 76, 0, TAU); g.stroke();
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 76, h / 2 + Math.sin(a) * 76); g.lineTo(w / 2 + Math.cos(a) * 110, h / 2 + Math.sin(a) * 110); g.stroke(); }
  });
}

// painted night backdrop: moon, ink-wash hills, a pagoda and a tiled roofline with lit windows
function backdropTexture() {
  return canvasTex(2048, 1024, (g, w, h) => {
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b0a1e'); gr.addColorStop(0.5, '#3a1630'); gr.addColorStop(0.8, '#8a3a34'); gr.addColorStop(1, '#3a1220');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const mx = w * 0.5, my = h * 0.42, mr = h * 0.12;
    gr = g.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 4.5); gr.addColorStop(0, 'rgba(255,225,180,0.55)'); gr.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffeccb'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    const ridge = (base, amp, seed, col) => { g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) { const u = x / w; g.lineTo(x, base - amp * (0.5 + 0.3 * Math.sin(u * 7 + seed) + 0.2 * Math.sin(u * 19 + seed * 2) + 0.1 * Math.sin(u * 41 + seed * 3))); } g.lineTo(w, h); g.closePath(); g.fillStyle = col; g.fill(); };
    ridge(h * 0.62, h * 0.2, 1.3, 'rgba(110,50,80,0.75)');
    gr = g.createLinearGradient(0, h * 0.5, 0, h * 0.75); gr.addColorStop(0, 'rgba(255,190,160,0)'); gr.addColorStop(0.5, 'rgba(255,200,170,0.2)'); gr.addColorStop(1, 'rgba(255,190,160,0)'); g.fillStyle = gr; g.fillRect(0, h * 0.5, w, h * 0.25);
    ridge(h * 0.78, h * 0.16, 4.1, 'rgba(60,22,46,0.9)');
    // pagoda
    const pagoda = (x, y, s, col) => { g.fillStyle = col; let yy = y, ww = s; for (let i = 0; i < 5; i++) { const bh = s * 0.17, rh = s * 0.09, bw = ww * 0.6; g.fillRect(x - bw / 2, yy - bh, bw, bh); const ry = yy - bh; g.beginPath(); g.moveTo(x - ww * 0.62, ry - rh); g.quadraticCurveTo(x - ww * 0.42, ry + rh * 0.2, x - ww * 0.3, ry); g.lineTo(x + ww * 0.3, ry); g.quadraticCurveTo(x + ww * 0.42, ry + rh * 0.2, x + ww * 0.62, ry - rh); g.quadraticCurveTo(x, ry - rh * 1.3, x - ww * 0.62, ry - rh); g.fill(); yy -= bh + rh * 0.8; ww *= 0.82; } g.fillRect(x - 3, yy - s * 0.2, 6, s * 0.2); };
    pagoda(w * 0.5, h * 0.9, h * 0.42, 'rgba(26,8,22,0.9)'); pagoda(w * 0.36, h * 0.92, h * 0.26, 'rgba(26,8,22,0.85)'); pagoda(w * 0.64, h * 0.92, h * 0.26, 'rgba(26,8,22,0.85)');
    ridge(h * 0.93, h * 0.1, 7.7, 'rgba(24,8,18,0.96)');
    // distant tiled roofline with lit windows
    g.fillStyle = 'rgba(18,6,14,0.95)';
    for (let k = 0; k < 7; k++) { const x = (k / 7) * w + hash(k) * 60, bw = w / 7 * 0.8, y = h * 0.86 - hash(k + 2) * h * 0.04; g.fillRect(x, y, bw, h - y); g.beginPath(); g.moveTo(x - 24, y); g.quadraticCurveTo(x + bw * 0.5, y - h * 0.07, x + bw + 24, y); g.fill(); for (let wI = 0; wI < 4; wI++) { g.fillStyle = `rgba(255,${170 + hash(k * 5 + wI) * 60},90,${0.55 + hash(wI + k) * 0.4})`; g.fillRect(x + 22 + wI * (bw - 30) / 4, y + 22, 18, 26); } g.fillStyle = 'rgba(18,6,14,0.95)'; }
  });
}

export function buildWorld({ quality = 'high' } = {}) {
  const group = new THREE.Group();
  const U = { group, lanterns: [], motes: null, lights: {}, quality };
  const q = quality === 'high' ? 1 : quality === 'medium' ? 0.7 : 0.45;

  // ground (stone yard)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.92, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; ground.receiveShadow = true; group.add(ground);

  // stage platform with a lacquered fascia
  const PW = 15, PD = 10.5, PH = 0.2, PZ = -1.4;
  const wood = new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.42, metalness: 0.02 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), wood); top.rotation.x = -Math.PI / 2; top.position.set(0, 0, PZ); top.receiveShadow = true; group.add(top);
  const lac = new THREE.MeshPhysicalMaterial({ color: '#6e0f1a', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.9 });
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, 0.2), lac); fascia.position.set(0, -PH / 2, PZ + PD / 2 + 0.1); fascia.castShadow = true; fascia.receiveShadow = true; group.add(fascia);
  const gold = new THREE.MeshStandardMaterial({ color: '#e7bd5a', roughness: 0.3, metalness: 0.85, envMapIntensity: 1.4 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.1, 0.035, 0.24), gold); trim.position.set(0, 0.012, PZ + PD / 2 + 0.1); group.add(trim);
  // the carpet
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 7.2), new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.95 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.006, -1.9); carpet.receiveShadow = true; group.add(carpet);

  // backdrop
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), new THREE.MeshBasicMaterial({ map: backdropTexture(), fog: false }));
  bd.position.set(0, 2.2, -11.5); group.add(bd); U.backdrop = bd;

  // pillars + beam with hanging lantern strings
  const pillarM = new THREE.MeshPhysicalMaterial({ color: '#8a1220', roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 0.9 });
  const mkPillar = (x, z, h = 6.4) => {
    const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, h, 20), pillarM); col.position.y = h / 2; col.castShadow = true; g.add(col);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.28, 20), new THREE.MeshStandardMaterial({ color: '#2a2024', roughness: 0.8 })); base.position.y = 0.14; g.add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.3, 20), gold); cap.position.y = h - 0.15; g.add(cap);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 8, 24), gold); band.rotation.x = Math.PI / 2; band.position.y = h * 0.78; g.add(band);
    g.position.set(x, 0, z); return g;
  };
  const PIL = [[-6.2, -5.4], [6.2, -5.4], [-6.2, 1.2], [6.2, 1.2]];
  for (const [x, z] of PIL) group.add(mkPillar(x, z));
  const beam = (z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.38, 0.4), pillarM); m.position.set(0, 6.3, z); m.castShadow = true; group.add(m); const t = new THREE.Mesh(new THREE.BoxGeometry(13.3, 0.05, 0.44), gold); t.position.set(0, 6.14, z); group.add(t); };
  beam(-5.4); beam(1.2);

  // lantern strings: a sagging catenary between the two pillars of each beam, lanterns every 1.4 m, plus a few on long ropes
  const nL = quality === 'low' ? 5 : 9;
  const mkString = (z, y0, sag, n) => {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = -6.2 + 12.4 * u, y = y0 - sag * 4 * u * (1 - u);
      const colr = i % 3 === 1 ? '#f4b030' : '#e63a22', s = 0.3 + 0.05 * (i % 2);
      const lan = createLantern(colr, s); lan.position.set(x, y - s * 1.1, z); group.add(lan); U.lanterns.push({ obj: lan, x, y: y - s * 1.1, z, ph: i * 1.7 + z });
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, s * 1.1 + 0.05, 5), new THREE.MeshBasicMaterial({ color: '#2a1008' })); rope.position.set(x, y - s * 0.5, z); group.add(rope);
    }
  };
  mkString(-5.4, 6.0, 0.9, nL); mkString(1.2, 6.0, 0.9, nL);
  mkString(-2.1, 5.2, 0.5, Math.max(4, nL - 3));

  // dust motes in the light
  const NM = quality === 'low' ? 0 : 70;
  if (NM) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(NM * 3);
    for (let i = 0; i < NM; i++) { p[i * 3] = (hash(i) - 0.5) * 9; p[i * 3 + 1] = 0.4 + hash(i + 7) * 5; p[i * 3 + 2] = -5 + hash(i + 13) * 8; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTexture(), color: '#ffd9a0', size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
    pts.frustumCulled = false; group.add(pts); U.motes = pts;
  }

  // lights: key spot from the upper left front with shadows, cool fill from the right, warm rim from behind, two lantern fills
  const hemi = new THREE.HemisphereLight(0x8fa6ff, 0x2a1210, 0.55);
  const key = new THREE.SpotLight(0xffe2b0, 90, 40, 0.55, 0.5, 1.4); key.position.set(-3.5, 9, 7); key.target.position.set(0, 0.8, -1.2);
  const fill = new THREE.DirectionalLight(0x9fb6ff, 0.55); fill.position.set(6, 3, 5);
  const rim = new THREE.DirectionalLight(0xffa060, 1.5); rim.position.set(3, 4.5, -7);
  const warmL = new THREE.PointLight(0xff7a3a, 14, 14, 1.6); warmL.position.set(-3.8, 4.4, -1.5);
  const warmR = new THREE.PointLight(0xff7a3a, 14, 14, 1.6); warmR.position.set(3.8, 4.4, -1.5);
  group.add(hemi, key, key.target, fill, rim, warmL, warmR);
  U.lights = { hemi, key, fill, rim, warmL, warmR };
  U.setShadows = (size) => {
    key.castShadow = size > 0;
    if (size > 0) { key.shadow.mapSize.set(size, size); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03; key.shadow.camera.near = 4; key.shadow.camera.far = 30; key.shadow.radius = 3; if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  };

  U.update = (t, calm, dt) => {
    for (const L of U.lanterns) {
      const sw = calm ? 0.01 : 0.05;
      L.obj.rotation.z = Math.sin(t * 0.9 + L.ph) * sw; L.obj.rotation.x = Math.cos(t * 0.7 + L.ph * 1.3) * sw * 0.7;
      const fl = 0.9 + 0.1 * Math.sin(t * 7.3 + L.ph * 3) * (calm ? 0.2 : 1);
      L.obj.userData.bodyM.emissiveIntensity = 1.05 * fl; L.obj.userData.halo.material.opacity = 0.7 * fl;
    }
    if (U.motes) {
      const a = U.motes.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * (0.04 + hash(i) * 0.06); if (y > 5.6) y = 0.3; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.05); }
      a.needsUpdate = true;
    }
  };
  U.lanternFlare = (k) => { warmL.intensity = 14 + k * 26; warmR.intensity = 14 + k * 26; };
  U.PW = PW; U.PD = PD;
  return U;
}
