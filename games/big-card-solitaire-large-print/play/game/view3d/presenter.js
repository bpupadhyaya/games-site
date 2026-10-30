// Big Card Solitaire 3D presenter. READS what the 2D layer handed over this frame (src/v3.js: every card, in paint order, in screen units) and never
// writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas (HUD, buttons, hint rings, wells and text stay 2D and keep all input).
// The room: a card table of deep velvet under one warm lamp, a gilt ring inlaid in the cloth; every card is a real thick card (ivory edge, varnished face)
// that casts a soft shadow on whatever lies beneath it. Cards keep the large-print faces exactly (the 2D art is the texture): legibility first.
// Taps stay exact: the camera is orthographic and pitched, and the table plane is stretched by 1/sin(pitch), so a point of the table lands on screen at
// exactly the (x, y) the 2D layer computed (card tops are lifted into place so thickness never shifts a tap).
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { CARD_W, CARD_H } from '../src/layout.js';
import { TABLES, paintCardTexture, CARD_RADIUS, drawPip } from '../src/art.js';

const PITCH = 52 * Math.PI / 180, SIN = Math.sin(PITCH), COS = Math.cos(PITCH);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, tex: 2 }, { name: 'medium', dpr: 1.5, tex: 1.5 }, { name: 'low', dpr: 1, tex: 1 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const TH = 5;                     // card thickness in card design units
const CAP = 80;                   // cards on screen at once (52 + stock stack + title fan + spare)
const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c, rep, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
let rs = 3; const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function velvetCanvas(stops) {   // dense soft pile: fine fibres in two tones over the table colour
  rs = 5; const N = 512, c = cvs(N, N), g = c.getContext('2d'), [lr, lg, lb] = hex(stops[0]), [mr, mg, mb] = hex(stops[1]), [dr, dg, db] = hex(stops[2]);
  g.fillStyle = `rgb(${mr},${mg},${mb})`; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) { const x = rnd() * N, y = rnd() * N, l = 2 + rnd() * 5, a = rnd() * 6.3, hi = rnd() > 0.5; g.strokeStyle = hi ? `rgba(${lr},${lg},${lb},0.16)` : `rgba(${dr},${dg},${db},0.22)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return c;
}
function gildCanvas() {          // the inlaid ring and four suit pips (gold leaf over a dark engraved shadow)
  const N = 1024, c = cvs(N, N), g = c.getContext('2d'); g.translate(N / 2, N / 2); const s = N / 340;
  const gold = g.createLinearGradient(-170 * s, -170 * s, 170 * s, 170 * s); gold.addColorStop(0, '#ffe9a0'); gold.addColorStop(0.5, '#d9a43a'); gold.addColorStop(1, '#a8741c');
  const ring = (r, w) => { g.beginPath(); g.arc(0, 0, r * s, 0, 6.3); g.lineWidth = w * s; g.stroke(); };
  g.strokeStyle = 'rgba(10,0,4,0.55)'; ring(150.8, 4.5); ring(137.8, 2.5); g.strokeStyle = gold; ring(150, 3.2); ring(138, 1.8);
  const pips = ['S', 'H', 'D', 'C'], off = [[0, -72], [72, 0], [0, 72], [-72, 0]];
  g.save(); g.scale(s, s); pips.forEach((p, i) => { drawPip(g, p, off[i][0] + 1.2, off[i][1] + 1.6, 78, 'rgba(10,0,4,0.5)'); drawPip(g, p, off[i][0], off[i][1], 78, '#d9a43a'); }); g.restore();
  return c;
}
const soft = (c0, c1, n = 128) => { const c = cvs(n, n), g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, 0, n, n); return c; };
function shadowCanvas() { const P = 48, W = CARD_W + 2 * P, H = CARD_H + 2 * P, c = cvs(W, H), g = c.getContext('2d'); g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = 22; g.fillStyle = '#000'; g.beginPath(); g.roundRect(P, P, CARD_W, CARD_H, CARD_RADIUS); g.fill(); return c; }
function rounded(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2); s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5); return s; }

export async function createPresenter({ kitCanvas }) {
  if (typeof OffscreenCanvas === 'undefined') return { ok: false };
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x2a0c14, 1);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 9000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x4a1a24, 1.0); scene.add(hemi);
  const lamp = new THREE.PointLight(0xfff0dc, 0.8, 0, 0); scene.add(lamp);      // the one warm lamp over the middle of the table (decay 0: no falloff maths surprises)
  const G = new THREE.Group(); G.scale.set(1, 1, 1 / SIN); scene.add(G);       // z is the 2D layer's y, stretched so the pitched ortho view maps it 1:1
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  // ---- table: velvet cloth (colour from the chosen table), lamp pool + vignette, gilt inlay
  let tableIdx = -1;
  const table = new THREE.Mesh(flat, new THREE.MeshPhysicalMaterial({ roughness: 0.92, metalness: 0, sheen: 1, sheenColor: new THREE.Color(0xffb0b8), sheenRoughness: 0.45 })); table.renderOrder = -10; G.add(table);
  const mkOverlay = (c0, c1, blending) => new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: tex(soft(c0, c1, 256)), transparent: true, depthWrite: false, depthTest: false, toneMapped: false, blending: blending ?? THREE.NormalBlending }));
  const vign = mkOverlay('rgba(0,0,0,0)', 'rgba(8,0,3,0.82)'); vign.renderOrder = -8; G.add(vign);
  const glow = mkOverlay('rgba(255,214,150,0.30)', 'rgba(255,214,150,0)', THREE.AdditiveBlending); glow.renderOrder = -9; G.add(glow);
  const gild = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: tex(gildCanvas()), transparent: true, depthWrite: false, depthTest: false, opacity: 0.4 })); gild.renderOrder = -7; G.add(gild);
  function setTable(i) { if (i === tableIdx) return; tableIdx = i; const S = (TABLES[i] ?? TABLES[2]).stops; table.material.map?.dispose(); table.material.map = tex(velvetCanvas(S), [1, 1]); table.material.needsUpdate = true; hemi.groundColor.set(S[2]); }

  // ---- cards
  const bodyGeo = (() => { const g = new THREE.ExtrudeGeometry(rounded(CARD_W, CARD_H, CARD_RADIUS), { depth: TH, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.9, bevelSegments: 2, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g; })();
  const faceGeo = new THREE.PlaneGeometry(CARD_W, CARD_H).rotateX(-Math.PI / 2);
  const shGeo = new THREE.PlaneGeometry(CARD_W + 96, CARD_H + 96).rotateX(-Math.PI / 2);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0e6cc, emissive: 0x6a6048, roughness: 0.7, transparent: true, depthTest: false, depthWrite: false });
  const shMat = new THREE.MeshBasicMaterial({ map: tex(shadowCanvas(), null, false), color: 0x000000, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, toneMapped: false });
  const faceMats = new Map();
  const texScale = () => TIERS[tier].tex;
  function faceMat(card) {
    const key = card ? `${card.suit}${card.rank}${v3.four ? 'f' : 't'}` : `back-${v3.theme?.id}`;
    let m = faceMats.get(key); if (m) return m;
    const k = texScale(), c = cvs(Math.ceil(CARD_W * k), Math.ceil(CARD_H * k)), g = c.getContext('2d'); g.scale(k, k); paintCardTexture(g, card, v3.four, v3.theme);
    const t = tex(c); m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.52, roughness: 0.55, metalness: 0, transparent: true, depthTest: false, depthWrite: false }); m.userData.key = key;
    faceMats.set(key, m); return m;
  }
  const pool = [];
  const take = (n) => {
    let o = pool[n]; if (o) return o;
    o = new THREE.Group(); const sh = new THREE.Mesh(shGeo, shMat), body = new THREE.Mesh(bodyGeo, bodyMat), face = new THREE.Mesh(faceGeo, bodyMat); face.position.y = TH + 0.95;
    o.add(sh, body, face); o.userData = { sh, body, face }; G.add(o); pool[n] = o; return o;
  };

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, fadeIn = 0, shown = false, frameAvg = 16, slowFrames = 0, sizeKey = '';
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || Math.min(cssW(), cssH()) / 720;
  function applyTier() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr)); sizeKey = ''; for (const m of faceMats.values()) { m.map?.dispose(); m.dispose(); } faceMats.clear(); }
  applyTier();
  function render() {
    const W = cssW(), Hh = cssH(), c = cpu();
    const offX = (W - meta.width * c) / 2, offY = (Hh - meta.height * c) / 2, x0 = -offX / c, x1 = (W - offX) / c, y0 = -offY / c, y1 = (Hh - offY) / c, cx = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    const sk = `${W}x${Hh}|${c.toFixed(4)}|${tier}`; if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(W, Hh, false); }
    cam.left = -(x1 - x0) / 2; cam.right = (x1 - x0) / 2; cam.top = (y1 - y0) / 2; cam.bottom = -(y1 - y0) / 2; cam.updateProjectionMatrix();
    const tz = yc / SIN; cam.position.set(cx, SIN * 3000, tz + COS * 3000); cam.up.set(0, 1, 0); cam.lookAt(cx, 0, tz); cam.updateMatrixWorld(true);
    const tw = x1 - x0 + 200, th = (y1 - y0) / SIN + 200;
    setTable(v3.table);
    table.position.set(cx, 0, tz); table.scale.set(tw, 1, th); table.material.map.repeat.set(tw / 380, th / 380);
    vign.position.set(cx, 0.4, tz); vign.scale.set(tw, 1, th); glow.position.set(cx, 0.3, tz - th * 0.08); glow.scale.set(tw * 1.1, 1, th * 0.9);
    lamp.position.set(cx, 900, tz - th * 0.1);
    const E = v3.emblem; gild.visible = !!E; if (E) { gild.position.set(E.cx, 0.5, E.cy / SIN * 0 + E.cy); gild.scale.set(340 * E.k, 1, 340 * E.k); }
    let n = 0;
    for (const a of v3.cards) {
      if (n >= CAP) break;
      const o = take(n++), u = o.userData, sx = a.w / CARD_W, sz = a.h / CARD_H, el = a.elev || 0;
      o.visible = true; o.position.set(a.cx, 0, a.cy + TH * COS * sz * 0.0 + (TH + 1) * COS); o.rotation.y = -(a.rot || 0); o.scale.set(sx * (a.sx ?? 1), 1, sz);
      u.sh.position.set(3 / sx, 0.1, (5 + el * 0.9) / sz); u.sh.material = shMat;
      u.face.material = faceMat(a.card);
      const r = n * 4; u.sh.renderOrder = r; u.body.renderOrder = r + 1; u.face.renderOrder = r + 2;
    }
    for (let i = n; i < pool.length; i++) if (pool[i]) pool[i].visible = false;
    renderer.render(scene, cam);
  }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    if (!shown) { shown = true; canvas.style.visibility = 'visible'; }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.25); canvas.style.opacity = String(fadeIn); }
    render();
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; shown = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; fadeIn = 0; canvas.style.opacity = '0'; sizeKey = ''; tableIdx = -1; for (const m of [table.material, bodyMat, shMat, gild.material, vign.material, glow.material]) { if (m.map) m.map.needsUpdate = true; m.needsUpdate = true; } applyTier(); v3.on = true; });

  await tick();
  return { ok: true, renderer, scene, camera: cam, attach() { v3.on = true; fadeIn = 0; canvas.style.opacity = '0'; }, pre() {}, post, get tier() { return TIERS[tier].name; } };
}
