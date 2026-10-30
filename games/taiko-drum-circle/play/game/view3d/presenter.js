// Taiko Drum Circle 3D presenter: an open-air festival night. Unfinished-wood taiko (rope-laced shime and okedo, tacked chu and o-daiko),
// bachi sticks, a plank stage, a kohaku (red and white) curtain on a wooden frame, strings of paper lanterns, moon and stars.
// It READS what the 2D layer published this frame (src/v3.js) and never writes game state. The camera is ORTHOGRAPHIC and tilted so a
// drum head (a circle on a horizontal plane) projects to exactly the ellipse (rx, rx*0.62) the 2D layer hit-tests and draws its fx on:
// every tap, ripple and falling note lines up with what the 3D scene shows. Hit zones and notes stay in the 2D layer.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tick = () => new Promise((r) => setTimeout(r, 0));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, seg: 56 }, { name: 'medium', dpr: 1.5, shadow: 1024, seg: 40 }, { name: 'low', dpr: 1, shadow: 0, seg: 28 }];
const SIN = 0.62, COS = Math.sqrt(1 - SIN * SIN);          // camera elevation: a circle on the ground projects to rx x rx*0.62
const TALL = [0.9, 1.0, 1.15, 1.2];                        // shell height factor per drum kind (same as layout.js / art.js)
const BULGE = [0.02, 0.06, 0.05, 0.09];
const WOOD = ['#d2a870', '#b9733a', '#9a5628', '#a4502a'];
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function canvasTex(w, h, paint, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); paint(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
}
const woodTex = (base) => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 230; i++) { const px = rnd() * w, a = 0.04 + rnd() * 0.16; x.strokeStyle = rnd() < 0.5 ? `rgba(40,16,4,${a})` : `rgba(255,225,170,${a * 0.7})`; x.lineWidth = 0.6 + rnd() * 2.2; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + (rnd() - 0.5) * 14, h * 0.33, px + (rnd() - 0.5) * 14, h * 0.66, px + (rnd() - 0.5) * 8, h); x.stroke(); }
  for (let i = 0; i < 6; i++) { const px = rnd() * w, py = rnd() * h; x.strokeStyle = 'rgba(40,16,4,0.22)'; x.lineWidth = 1.2; for (let k = 1; k < 4; k++) { x.beginPath(); x.ellipse(px, py, 3 * k, 7 * k, 0, 0, 6.3); x.stroke(); } }
}, true);
const skinTex = () => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#4a2a14'; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(256, 256, 20, 256, 256, 230); g.addColorStop(0, '#d8c08a'); g.addColorStop(0.35, '#ecdcb4'); g.addColorStop(0.8, '#e2cf9f'); g.addColorStop(1, '#b89a64');
  x.fillStyle = g; x.beginPath(); x.arc(256, 256, 226, 0, 6.3); x.fill();
  for (let i = 0; i < 700; i++) { const a = rnd() * 6.3, r = rnd() * 220; x.fillStyle = `rgba(${rnd() < 0.5 ? '120,90,50' : '255,250,235'},${0.03 + rnd() * 0.07})`; x.fillRect(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 2 + rnd() * 5, 1 + rnd() * 2); }
  x.strokeStyle = 'rgba(110,70,30,0.35)'; x.lineWidth = 4; x.beginPath(); x.arc(256, 256, 176, 0, 6.3); x.stroke();
});
const plankTex = () => canvasTex(512, 512, (x, w, h) => {
  const n = 8, pw = w / n; for (let i = 0; i < n; i++) { const l = 30 + rnd() * 10; x.fillStyle = `hsl(24,42%,${l}%)`; x.fillRect(i * pw, 0, pw, h); for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(30,12,4,${0.05 + rnd() * 0.12})`; x.lineWidth = 0.8 + rnd(); const px = i * pw + rnd() * pw; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (rnd() - 0.5) * 6, h); x.stroke(); } x.fillStyle = 'rgba(15,6,2,0.8)'; x.fillRect(i * pw, 0, 2, h); }
}, true);
const curtainTex = () => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#9d1e2a'; x.fillRect(0, 0, w / 2, h); x.fillStyle = '#efe4cd'; x.fillRect(w / 2, 0, w / 2, h);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.05})`; x.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 6); }
  x.fillStyle = '#17204a'; x.fillRect(0, 0, w, h * 0.17); x.fillStyle = '#efe4cd'; x.beginPath(); x.arc(w / 2, h * 0.085, h * 0.05, 0, 6.3); x.fill(); x.fillStyle = '#17204a'; x.beginPath(); x.arc(w / 2, h * 0.085, h * 0.03, 0, 6.3); x.fill();
  x.fillStyle = '#c9a24a'; x.fillRect(0, h * 0.17, w, 4);
}, true);
const lanternTex = () => canvasTex(64, 256, (x, w, h) => {
  x.fillStyle = '#ff7a30'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(90,18,6,0.7)'; x.fillRect(0, 14 + i * 26, w, 4); }
  x.fillStyle = 'rgba(255,230,170,0.5)'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(110,22,8,0.75)'; x.fillRect(0, 14 + i * 26, w, 4); }
  x.fillStyle = 'rgba(120,20,10,0.55)'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
}, true);
function skyTex(aspect) {
  const W = 512, H = Math.round(512 / clamp(aspect, 0.4, 2.6));
  return canvasTex(W, H, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#070a24'); g.addColorStop(0.55, '#1a1445'); g.addColorStop(1, '#3a1d4a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) { x.fillStyle = `rgba(255,245,220,${0.25 + rnd() * 0.6})`; const s = rnd() < 0.1 ? 2 : 1; x.fillRect(rnd() * w, rnd() * h * 0.7, s, s); }
    const mx = w * 0.78, my = h * 0.16, mr = Math.min(w, h) * 0.07; const mg = x.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4); mg.addColorStop(0, 'rgba(255,240,200,0.35)'); mg.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = mg; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff3d2'; x.beginPath(); x.arc(mx, my, mr, 0, 6.3); x.fill(); x.fillStyle = 'rgba(210,190,150,0.5)'; x.beginPath(); x.arc(mx - mr * 0.3, my + mr * 0.1, mr * 0.25, 0, 6.3); x.fill();
    // distant roof ridges and pine silhouettes low on the horizon
    x.fillStyle = '#0e0b26'; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 40; i++) { const px = (i / 40) * w; x.lineTo(px, h * 0.8 - Math.abs(Math.sin(i * 1.7)) * h * 0.04 - (i % 7 === 0 ? h * 0.06 : 0)); } x.lineTo(w, h); x.fill();
  });
}

const prof = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));
function shellGeo(h1, bulge, seg) {
  const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([0.955 + (0.045 + bulge) * Math.sin(Math.PI * Math.pow(t, 0.9)) + 0.045 * t, t * h1]); }
  const g = new THREE.LatheGeometry(prof(pts), seg); g.computeVertexNormals(); return g;
}

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 50, 12000);
  scene.add(new THREE.HemisphereLight(0x7080c8, 0x3a2012, 0.45));
  const key = new THREE.DirectionalLight(0xffc990, 1.9); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x93a8ff, 0.9); rim.position.set(900, 900, -1400); scene.add(rim);
  const lampL = new THREE.PointLight(0xff9a50, 0, 0, 1.6), lampR = new THREE.PointLight(0xff9a50, 0, 0, 1.6); scene.add(lampL, lampR);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.45; } catch { /* no IBL */ } };
  buildEnv(); await tick();

  // ---- stage: floor, curtain, frame, lanterns
  const plankT = plankTex();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: plankT, roughness: 0.62, metalness: 0, color: 0x8a7a70 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const curT = curtainTex();
  const curGeo = new THREE.PlaneGeometry(1, 1, 120, 1);
  const curtain = new THREE.Mesh(curGeo, new THREE.MeshStandardMaterial({ map: curT, roughness: 0.9, side: THREE.DoubleSide, color: 0x6a5a5a })); curtain.receiveShadow = true; curtain.castShadow = false; scene.add(curtain);
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a2814, roughness: 0.6, map: woodTex('#6a3a1c') });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xe6bd5a, roughness: 0.3, metalness: 1 });
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), sph = new THREE.SphereGeometry(1, 14, 10);
  const rod = new THREE.Mesh(cyl, woodDark); rod.rotation.z = Math.PI / 2; rod.castShadow = true; scene.add(rod);
  const posts = [new THREE.Mesh(box, woodDark), new THREE.Mesh(box, woodDark)]; posts.forEach((p) => { p.castShadow = true; scene.add(p); });
  const fin = [new THREE.Mesh(sph, goldM), new THREE.Mesh(sph, goldM)]; fin.forEach((f) => scene.add(f));
  const rope = new THREE.Mesh(cyl, new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 })); rope.rotation.z = Math.PI / 2; scene.add(rope);
  const lanT = lanternTex();
  const lanGeo = (() => { const pts = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push([0.12 + 0.88 * Math.sin(a), -Math.cos(a)]); } const g = new THREE.LatheGeometry(prof(pts), 20); g.computeVertexNormals(); return g; })();
  const lanterns = Array.from({ length: 9 }, () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(lanGeo, new THREE.MeshStandardMaterial({ map: lanT, emissiveMap: lanT, emissive: 0xffa060, emissiveIntensity: 1.2, roughness: 0.7 }));
    const capT = new THREE.Mesh(cyl, new THREE.MeshStandardMaterial({ color: 0x1a0d0a, roughness: 0.6 })), capB = capT.clone();
    capT.scale.set(0.5, 0.12, 0.5); capT.position.y = 1.02; capB.scale.set(0.5, 0.12, 0.5); capB.position.y = -1.02;
    const str = new THREE.Mesh(cyl, new THREE.MeshBasicMaterial({ color: 0x1a0d0a })); str.scale.set(0.03, 1, 0.03);
    g.add(body, capT, capB, str); g.userData = { body, str }; g.visible = false; scene.add(g); return g;
  });
  const skyDummy = { tex: null, key: '' };

  // ---- drums: one rig per kind, built at unit radius (scaled to rx per frame)
  const skin = skinTex();
  const rigs = [0, 1, 2, 3].map((k) => {
    const h1 = 0.95 * TALL[k] / COS, g = new THREE.Group();
    const wt = woodTex(WOOD[k]); wt.repeat.set(2, 1);
    const shellM = new THREE.MeshStandardMaterial({ map: wt, bumpMap: wt, bumpScale: 1.2, roughness: k === 3 ? 0.42 : 0.55, metalness: 0 });
    const shell = new THREE.Mesh(shellGeo(h1, BULGE[k], TIERS[tier].seg), shellM); shell.castShadow = true; shell.receiveShadow = true; g.add(shell);
    const headM = new THREE.MeshStandardMaterial({ map: skin, roughness: 0.62, metalness: 0, emissive: 0xff7a30, emissiveIntensity: 0 });
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.93, 48), headM); head.rotation.x = -Math.PI / 2; head.position.y = h1 + 0.012; head.receiveShadow = true; g.add(head);
    const hoopM = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.55 });
    const lip = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.0, 56), hoopM); lip.rotation.x = -Math.PI / 2; lip.position.y = h1 + 0.004; g.add(lip);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.07, 10, 56), hoopM); hoop.rotation.x = Math.PI / 2; hoop.position.y = h1 + 0.005; hoop.castShadow = true; g.add(hoop);
    const hoop2 = hoop.clone(); hoop2.position.y = 0.04; hoop2.scale.set(0.97, 0.97, 0.7); g.add(hoop2);
    const mats = [shellM, headM, hoopM];
    if (k === 1 || k === 3) {       // brass tacks (byo) around the hoop; the o-daiko has a second row
      const rows = k === 3 ? [h1 - 0.1, h1 * 0.14] : [h1 - 0.1], n = k === 3 ? 36 : 28;
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 8, 6), goldM, n * rows.length); const m4 = new THREE.Matrix4();
      rows.forEach((ry, ri) => { for (let i = 0; i < n; i++) { const a = (i + ri * 0.5) / n * Math.PI * 2, tt = ry / h1, r = 0.955 + (0.045 + BULGE[k]) * Math.sin(Math.PI * Math.pow(tt, 0.9)) + 0.045 * tt; m4.makeTranslation(Math.cos(a) * r * 1.01, ry, Math.sin(a) * r * 1.01); im.setMatrixAt(ri * n + i, m4); } });
      im.castShadow = true; g.add(im);
    } else {                          // rope lacing in a zigzag around the shell
      const N = k === 0 ? 10 : 12, pts = [];
      for (let i = 0; i < 2 * N; i++) { const a = (i / (2 * N)) * Math.PI * 2, y = i % 2 ? h1 * 0.1 : h1 * 0.9, tt = y / h1, r = 0.955 + (0.045 + BULGE[k]) * Math.sin(Math.PI * Math.pow(tt, 0.9)) + 0.045 * tt + 0.03; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
      const rp = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.05), 6 * N * 2, k === 0 ? 0.032 : 0.04, 6, true), new THREE.MeshStandardMaterial({ color: 0xe2cf9c, roughness: 0.85 }));
      rp.castShadow = true; g.add(rp);
    }
    g.userData = { h1, mats, headM, base: mats.map((m) => m.color.clone()) }; g.visible = false; scene.add(g); return g;
  });

  // ---- bachi sticks
  const stickGeo = (() => { const g = new THREE.LatheGeometry(prof([[0.0, 0], [0.9, 0.0], [1, 0.04], [0.8, 0.6], [0.6, 0.96], [0.55, 1.0], [0, 1.0]].map(([r, y]) => [r * 1, y])), 12); g.computeVertexNormals(); return g; })();
  const sticks = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(stickGeo, new THREE.MeshStandardMaterial({ color: 0xe7c590, roughness: 0.5, map: woodTex('#e3bd86'), emissive: 0xffa050, emissiveIntensity: 0 })); m.castShadow = true; m.visible = false; scene.add(m); return m; });
  const stickPool = { used: 0 };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } key.shadow.bias = -0.0004; key.shadow.normalBias = 1.0; }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- mapping virtual screen units -> world (orthographic tilted camera)
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  let camKey = '', halfW = 360, halfH = 640;
  function placeCamera() {
    const k = `${cssW()}x${cssH()}|${cpu().toFixed(4)}`; if (k === camKey) return; camKey = k;
    halfW = cssW() / cpu() / 2; halfH = cssH() / cpu() / 2;
    camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
    camera.position.set(0, 4000 * SIN, 4000 * COS); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  const U = (vx) => vx - meta.width / 2, V = (vy) => meta.height / 2 - vy;
  const zOn = (v, Y) => (Y * COS - v) / SIN;          // z of a point at height Y whose screen height is v
  const yAt = (v, Z) => (v + Z * SIN) / COS;           // height of a point at depth Z whose screen height is v

  let lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, clock = 0, stageKey = '', curKey = '';
  function pre() { v3.drums = []; v3.mode = 'env'; v3.pulse = 0; }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    placeCamera();
    const t = clock, pulse = v3.pulse || 0, play = v3.mode === 'play';
    const rxMax = v3.drums.reduce((m, d) => Math.max(m, d.rx), 0) || Math.min(meta.width, meta.height) * 0.16;
    const vFt = V(v3.floorTop || meta.height * 0.72), Zb = -vFt / SIN;       // floor back edge: where the curtain stands
    // sky (screen-space backdrop)
    const sk = `${(cssW() / cssH()).toFixed(1)}`; if (skyDummy.key !== sk) { skyDummy.key = sk; skyDummy.tex?.dispose(); skyDummy.tex = skyTex(cssW() / cssH()); scene.background = skyDummy.tex; }
    // floor
    const Zf = zOn(-halfH - 120, 0), fw = halfW * 2 + 600, fd = Zf - Zb;
    floor.scale.set(fw, fd, 1); floor.position.set(0, 0, (Zf + Zb) / 2); plankT.repeat.set(fw / 360, fd / 360); plankT.needsUpdate = false;
    // curtain: a pleated kohaku wall hung from a wooden rod between two posts
    const csH = clamp(rxMax * 1.7, 90, Math.max(110, meta.height * 0.2)), Hc = csH / COS, Wc = halfW * 2 + 80, rodY = Hc;
    const ck = `${Math.round(Wc)}|${Math.round(rxMax)}`;
    if (curKey !== ck) {
      curKey = ck; const pa = curGeo.attributes.position, f = Math.max(7, Math.round(Wc / (rxMax * 1.4))) * Math.PI * 2;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) + 0.5) * f) * 7 + Math.sin((pa.getX(i) + 0.5) * f * 2.3) * 1.5); pa.needsUpdate = true; curGeo.computeVertexNormals();
      curT.repeat.set(Math.max(2, Math.round(Wc / (rxMax * 1.5))) / 1, 1); curT.needsUpdate = false;
    }
    curtain.scale.set(Wc, Hc, 1); curtain.position.set(0, Hc / 2, Zb);
    rod.scale.set(9, Wc * 0.5, 9); rod.position.set(0, rodY + 6, Zb + 6);
    const px = halfW + 30; posts.forEach((p, i) => { const s = i ? 1 : -1, ph = Hc + rxMax * 0.8; p.scale.set(28, ph, 28); p.position.set(s * (px - 10), ph / 2, Zb + 8); });
    fin.forEach((f, i) => { f.scale.set(22, 22, 22); f.position.set((i ? 1 : -1) * (px - 10), Hc + rxMax * 0.8 + 18, Zb + 8); });
    // lanterns on a string above the curtain
    const Rl = clamp(rxMax * 0.2, 16, 56), nL = clamp(Math.round(halfW * 2 / (Rl * 3.6)), 4, 9), topV = V(0) * 0 + (Hc * COS + vFt) + Rl * 2.4;     // screen height of the string
    const ZL = Zb + 90, sY = yAt(topV, ZL);
    rope.scale.set(2.2, Wc * 0.5, 2.2); rope.position.set(0, sY, ZL);
    const flick = (i) => 0.92 + 0.08 * Math.sin(t * 7 + i * 2.1);
    lanterns.forEach((g, i) => {
      g.visible = i < nL; if (i >= nL) return;
      const u = -halfW + (i + 0.5) * (halfW * 2 / nL), drop = Rl * (1.2 + 0.35 * Math.sin(i * 1.9)), r = Rl * (0.9 + 0.12 * ((i * 7) % 3) / 2);
      const swing = Math.sin(t * 0.9 + i) * 0.04;
      g.position.set(u, sY - drop - r, ZL); g.scale.set(r, r * 1.15, r); g.rotation.z = swing;
      g.userData.str.scale.set(0.03, drop / (r * 1.15) * 0.5, 0.03); g.userData.str.position.y = 1.02 + drop / (r * 1.15) * 0.5;
      g.userData.body.material.emissiveIntensity = (play ? 0.7 : 1.05) * flick(i) + pulse * 0.4;
    });
    lampL.position.set(-halfW * 0.8, sY - Rl * 2, ZL + 200); lampR.position.set(halfW * 0.8, sY - Rl * 2, ZL + 200);
    lampL.intensity = lampR.intensity = (play ? 14000 : 24000) * (1 + pulse * 0.3);
    // key light follows the drums, shadow box fits the stage
    const sc = key.shadow.camera, ext = Math.max(halfW, halfH) * 1.2; const kk = `${Math.round(ext)}`;
    if (kk !== stageKey) { stageKey = kk; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 100; sc.far = 9000; sc.updateProjectionMatrix(); }
    key.position.set(-ext * 0.9, ext * 1.7, ext * 1.1 + Zb * 0.2); key.target.position.set(0, 0, Zb * 0.2); key.target.updateMatrixWorld();

    // text screens (rules, settings...) keep only the night sky behind their panels, so reading stays calm
    const showStage = v3.mode !== 'env' || v3.drums.length > 0;
    for (const o of [floor, curtain, rod, rope, ...posts, ...fin]) o.visible = showStage;
    if (!showStage) lanterns.forEach((g) => { g.visible = false; });
    lampL.visible = lampR.visible = showStage;
    // drums
    const seen = [false, false, false, false]; let si = 0;
    for (const d of v3.drums) {
      const rig = rigs[d.kind]; if (!rig || seen[d.kind]) continue; seen[d.kind] = true;
      const R = d.rx, { h1, mats, headM, base } = rig.userData, Hd = h1 * R, v = V(d.cy);
      rig.visible = true; rig.scale.set(R, R, R); rig.position.set(U(d.cx), 0, zOn(v, Hd));
      const dim = 1 - (d.dim || 0) * 1.7, sh = clamp(dim, 0.12, 1);
      mats.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(sh));
      const fl = clamp(d.flash || 0, 0, 1); headM.emissive.set(d.zone === 'K' ? 0x4ab4ff : 0xff7a30); headM.emissiveIntensity = fl * 0.55;
      rig.position.y = (d.lift || 0) * 0;                         // the skin dents; the shell stays planted
      // sticks
      const th = Math.max(3.5, R * 0.075), len = R * 1.6;
      const place = (tip, grip, glow) => {
        if (si >= sticks.length) return; const m = sticks[si++]; m.visible = true;
        const dir = new THREE.Vector3().subVectors(tip, grip), L = dir.length(); dir.normalize();
        m.position.copy(grip); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.scale.set(th * 1.1, L, th * 1.1); m.material.emissiveIntensity = clamp(glow || 0, 0, 1) * 0.7;
      };
      if (d.raw) {
        for (const q of d.raw) { const tp = new THREE.Vector3(U(q.tx), Hd + 2, zOn(V(q.ty), Hd)); const gr = new THREE.Vector3(U(q.gx), tp.y + (V(q.gy) - V(q.ty)) / COS, tp.z); place(tp, gr, d.flash); }
      } else if (d.sticks) {
        d.sticks.forEach((s, h) => {
          const side = h === 0 ? -1 : 1, k = clamp(s.lift / 0.62, 0, 1.1);
          const tipX = d.cx + side * R * (0.26 + 0.42 * k), tip = new THREE.Vector3(U(tipX), Hd + 3 + k * R * 0.79, zOn(V(d.cy + R * SIN * 0.1), Hd));
          const grip = new THREE.Vector3(tip.x + side * len * 0.7, tip.y + len * 0.2, tip.z + len * 1.38); place(tip, grip, s.glow);
        });
      }
    }
    rigs.forEach((r, i) => { if (!seen[i]) r.visible = false; });
    for (; si < sticks.length; si++) sticks[si].visible = false;

    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  let loseExt = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; camKey = ''; stageKey = ''; });

  await tick();
  placeCamera(); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach() { v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
