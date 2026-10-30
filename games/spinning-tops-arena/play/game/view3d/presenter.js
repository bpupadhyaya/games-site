// Spinning Tops Arena 3D presenter. READS what the 2D layer asked for this frame (src/v3.js: arena, tops, looks, transform); never writes game
// state. One WebGL canvas sits behind the kit's transparent 2D canvas: a lacquered dish with a turned-maple floor, real lathed tops with
// painted bands, a lamp-lit walnut table. The camera is ORTHOGRAPHIC with sin(elevation) = ARENA.sy, so the ground plane maps to the screen
// exactly as the flat art did (x -> cx + x, y -> cy + y * sy): aim guides, trails, sparks and every tap line up with the 3D dish unchanged.
// No WebGL, ?flat=1 or a lost context: v3.on = false and the flat 2D art stays; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { ARENA } from '../src/sim.js';
import { VIEW } from '../src/layout.js';
import { PROFILE, BANDS, bodyDims, profAt, drawTable } from '../src/art.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 768 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const ELEV = Math.asin(ARENA.sy);
const R = ARENA.R, RIM = 34, RO = R + RIM;
// dish geometry per arena: rim height above the table, how far the floor sinks below the rim
const DISH = { shallow: { hr: 40, d: 26 }, bowl: { hr: 54, d: 40 }, plate: { hr: 26, d: 12 } };
const floorY = (id, r) => { const g = DISH[id] || DISH.shallow; return r <= R ? g.hr - g.d + g.d * (r / R) * (r / R) : r <= RO ? g.hr : 0; };

function canvasTex(w, h, paint, repeat = 0) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
// turned maple: warm base, fine concentric grain from the lathe, a few cut grooves, a painted centre mark
function paintFloor(x, w, h) {
  const g = x.createRadialGradient(w * 0.42, h * 0.4, 20, w / 2, h / 2, w * 0.55);
  g.addColorStop(0, '#f6e3b8'); g.addColorStop(0.6, '#e6c78e'); g.addColorStop(1, '#c79a5c');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { const r = rnd() * w * 0.5, a = rnd() * 6.28, sp = 0.2 + rnd() * 0.9; x.strokeStyle = rnd() < 0.5 ? 'rgba(120,70,24,0.10)' : 'rgba(255,240,200,0.12)'; x.lineWidth = 1 + rnd() * 1.6; x.beginPath(); x.arc(w / 2 + (rnd() - 0.5) * 18, h / 2 + (rnd() - 0.5) * 18, r, a, a + sp); x.stroke(); }
  for (const f of [0.3, 0.52, 0.72, 0.88]) { x.strokeStyle = 'rgba(96,52,18,0.34)'; x.lineWidth = 3.4; x.beginPath(); x.arc(w / 2, h / 2, w * 0.5 * f, 0, 6.2832); x.stroke(); x.strokeStyle = 'rgba(255,244,214,0.4)'; x.lineWidth = 1.6; x.beginPath(); x.arc(w / 2, h / 2, w * 0.5 * f + 3.2, 0, 6.2832); x.stroke(); }
  x.strokeStyle = 'rgba(166,58,34,0.7)'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, w * 0.5 * 26 / R, 0, 6.2832); x.stroke();
  x.fillStyle = 'rgba(166,58,34,0.55)'; x.beginPath(); x.arc(w / 2, h / 2, w * 0.5 * 8 / R, 0, 6.2832); x.fill();
}
const radialTex = (rgb, a) => canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });

// ---- the dish ------------------------------------------------------------------------------------------------------------------------
function buildDish(id, texSize) {
  const g = DISH[id] || DISH.shallow, grp = new THREE.Group(), own = [];
  const floorTex = canvasTex(texSize, texSize, paintFloor); own.push(floorTex);
  // floor: a polar grid whose height follows the same bowl the physics pulls toward
  const rings = 44, segs = 96, pos = [], uv = [], idx = [];
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) { const r = R * i / rings, a = j / segs * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a); pos.push(x, floorY(id, r), z); uv.push(0.5 + x / (2 * R), 0.5 - z / (2 * R)); }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx); fg.computeVertexNormals();
  const floor = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0, envMapIntensity: 0.5, side: THREE.DoubleSide })); floor.receiveShadow = true; grp.add(floor);
  // lacquered rim and outer wall (one lathe, profile from the inside edge over the rim and down to the foot)
  const hr = g.hr, P = [[R - 14, hr * 0.0 + 0], [RO - 14, 0], [RO - 12, 1.2], [RO - 6, hr * 0.2], [RO + 1.2, hr * 0.6], [RO, hr - 1.5], [RO - 2, hr + 1.8], [RO - 7, hr + 3], [R + 5, hr + 3], [R + 1.5, hr + 1.6], [R - 1, hr - 1.2]];
  const rimGeo = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)), 128);
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0xa8321c, roughness: 0.3, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.1, side: THREE.DoubleSide });
  const rim = new THREE.Mesh(rimGeo, lacquer); rim.castShadow = true; rim.receiveShadow = true; grp.add(rim);
  // gold inlay lines on the rim and round the wall, a dark foot ring
  const brass = new THREE.MeshStandardMaterial({ color: 0xf0c25a, roughness: 0.28, metalness: 1, envMapIntensity: 1.2 });
  const ring = (r, y, t) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 160), brass); m.rotation.x = Math.PI / 2; m.position.y = y; grp.add(m); };
  ring(R + RIM * 0.5, hr + 3, 1.5); ring(RO + 0.4, hr * 0.5, 1.9); ring(R + 3, hr + 1.2, 1.1);
  grp.userData.dispose = () => { own.forEach((t) => t.dispose()); grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose?.(); }); };
  return grp;
}

// ---- a top ---------------------------------------------------------------------------------------------------------------------------
const colOf = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
function buildTop(build, look) {
  const { r, H, tipLen } = bodyDims(build), prof = PROFILE[build.body], bands = BANDS[build.body];
  const wood = colOf('#c9965a'), c1 = colOf(look.c1), c2 = colOf(look.c2);
  const grp = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(); grp.add(tilt); tilt.add(spin);
  const mats = [];
  const mk = (m) => { mats.push(m); return m; };
  // body: lathe with vertex colours for the painted bands
  const N = 56, pts = [], cols = [];
  for (let i = 0; i <= N; i++) {
    const z = i / N, rho = profAt(prof, z) * r; pts.push(new THREE.Vector2(rho, tipLen + z * H));
    let col = wood; for (const [z0, z1, w] of bands) if (z >= z0 && z <= z1) col = w === 1 ? c1 : c2; cols.push(col);
  }
  const lg = new THREE.LatheGeometry(pts, 64);
  const ca = new Float32Array(lg.attributes.position.count * 3); const segs = 65;
  for (let j = 0; j < segs; j++) for (let i = 0; i <= N; i++) { const c = cols[i], k = (j * (N + 1) + i) * 3; ca[k] = c[0]; ca[k + 1] = c[1]; ca[k + 2] = c[2]; }
  lg.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  const body = new THREE.Mesh(lg, mk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.18, envMapIntensity: 0.9, side: THREE.DoubleSide }))); body.castShadow = true; spin.add(body);
  // steel / pebble / peg tip
  const tw = build.tip === 'steel' ? r * 0.2 : build.tip === 'pebble' ? r * 0.24 : r * 0.3;
  const tp = build.tip === 'steel' ? [[0, 0], [tw, tipLen + 0.5]] : build.tip === 'pebble' ? [[0, 0], [tw * 0.55, tipLen * 0.12], [tw * 0.95, tipLen * 0.45], [tw, tipLen + 0.5]] : [[0, 0], [tw * 0.95, 0], [tw, tipLen + 0.5]];
  const steel = mk(new THREE.MeshStandardMaterial({ color: 0xc8ced6, roughness: 0.2, metalness: 1, envMapIntensity: 1.3 }));
  const tip = new THREE.Mesh(new THREE.LatheGeometry(tp.map(([a, y]) => new THREE.Vector2(a, y)), 20), steel); tip.castShadow = true; spin.add(tip);
  // crown: handle stem and a turned knob
  const topR = prof[prof.length - 1][1] * r, yt = tipLen + H, stemH = build.body === 'spire' ? 24 : build.body === 'dome' ? 14 : 18;
  const woodM = mk(new THREE.MeshStandardMaterial({ color: 0xd9a868, roughness: 0.45, envMapIntensity: 0.6 }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(topR * 0.42, topR * 0.5, stemH, 14), woodM); stem.position.y = yt + stemH / 2; stem.castShadow = true; spin.add(stem);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(topR * 1.05, topR * 1.1, 3.2, 24), mk(new THREE.MeshPhysicalMaterial({ color: look.c1, roughness: 0.3, clearcoat: 0.8 }))); cap.position.y = yt + 1.2; cap.castShadow = true; spin.add(cap);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(topR * 0.62, 16, 12), woodM); knob.position.y = yt + stemH + topR * 0.25; knob.scale.y = 0.8; knob.castShadow = true; spin.add(knob);
  // a thin gold pinstripe between the colour bands, and the lead rim ring on a Rim Ring top
  const goldM = mk(new THREE.MeshStandardMaterial({ color: 0xf2c45e, roughness: 0.3, metalness: 1, envMapIntensity: 1.1 }));
  const zp = bands[1][1], pin = new THREE.Mesh(new THREE.TorusGeometry(profAt(prof, zp) * r + 0.2, 0.7, 6, 48), goldM); pin.rotation.x = Math.PI / 2; pin.position.y = tipLen + zp * H; spin.add(pin);
  if (build.ballast === 'heavy') { const zr = build.body === 'spire' ? 0.42 : 0.36, lead = new THREE.Mesh(new THREE.TorusGeometry(profAt(prof, zr) * r + 0.6, 3, 10, 48), mk(new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.3, metalness: 1 }))); lead.rotation.x = Math.PI / 2; lead.position.y = tipLen + zr * H; lead.castShadow = true; spin.add(lead); }
  if (build.ballast === 'light') { const zz = 0.4, rr = profAt(prof, zz) * r; for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), mk(new THREE.MeshBasicMaterial({ color: 0x2a1204 }))); const a = k * Math.PI / 2 + 0.4; s.scale.set(1, 1.5, 1); s.position.set(Math.cos(a) * rr, tipLen + zz * H, Math.sin(a) * rr); spin.add(s); } }
  // the painted mark that turns with the top (a clear dot when slow, a smear when fast)
  const markM = new THREE.MeshBasicMaterial({ color: 0xfffcf0, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
  const mark = new THREE.Mesh(new THREE.CircleGeometry(1, 16), markM);
  { const zz = 0.5, rr = profAt(prof, zz) * r; mark.scale.set(5, 8.5, 1); mark.rotation.y = Math.PI / 2; mark.position.set(rr + 0.5, tipLen + zz * H, 0); spin.add(mark); }
  // spin haze: a soft ring round the body at speed
  const hazeM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const haze = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, 3, 6, 40), hazeM); haze.rotation.x = Math.PI / 2; haze.position.y = tipLen + H * 0.4; spin.add(haze);
  spin.scale.set(1, 1.4, 1);   // the 53 degree camera foreshortens height: tops are drawn a little taller so they read as turned tops, not buttons
  grp.userData = { tilt, spin, markM, hazeM, mats, key: `${build.body}|${build.tip}|${build.ballast}|${look.c1}|${look.c2}`, r };
  return grp;
}
const disposeTop = (g) => g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c0f08);
  const camera = new THREE.OrthographicCamera(-360, 360, 640, -640, 1, 4000);
  // light: a warm key from the upper left (as the flat art was lit), a cool fill, a hemisphere for the table
  scene.add(new THREE.HemisphereLight(0xffe9cf, 0x3a2012, 0.22));
  const pool = new THREE.SpotLight(0xffc98a, 5.5, 0, 0.62, 0.95, 0); pool.position.set(-60, 1100, 700); pool.target.position.set(0, 0, 120); scene.add(pool, pool.target);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.2); sun.position.set(-330, 560, 250); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
  sun.shadow.camera.left = -360; sun.shadow.camera.right = 360; sun.shadow.camera.top = 360; sun.shadow.camera.bottom = -360; sun.shadow.camera.near = 100; sun.shadow.camera.far = 1400; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6; sun.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0x9fc0ff, 0.35); fill.position.set(300, 240, -200); scene.add(fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.45; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  // the walnut table, with the flat art's plank grain painted once
  const tableTex = canvasTex(1024, 1024, (x, w, h) => { x.save(); x.scale(w / 720, h / 1280); drawTable(x, 720, 1280); x.restore(); }, 3);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(4800, 4800), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.62, envMapIntensity: 0.4 })); table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  await tick();
  const blobT = radialTex('0,0,0', 0.75), flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const blobs = [0, 1].map(() => { const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity: 0.5 })); m.renderOrder = 1; m.visible = false; scene.add(m); return m; });
  // props on the table (seen below the dish on tall phones): a coil of launch cord and two spare tops
  const props = new THREE.Group(); scene.add(props);
  const buildProps = () => {
    while (props.children.length) { const c = props.children.pop(); disposeTop(c); }
    const cordM = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.9 });
    const coil = new THREE.Group();
    for (let k = 0; k < 5; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(30 - k * 1.2, 3.6, 8, 40), cordM); t.rotation.x = Math.PI / 2; t.position.y = 3.6 + k * 5.2; t.castShadow = true; t.receiveShadow = true; coil.add(t); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 70, 8), cordM); tail.rotation.z = Math.PI / 2; tail.rotation.y = 0.5; tail.position.set(46, 3.6, 18); tail.castShadow = true; coil.add(tail);
    coil.position.set(-170, 0, 462); props.add(coil);
    const mkSpare = (build, look, x, z, lean, rot) => { const g = buildTop(build, look); g.position.set(x, 0, z); const th = lean; g.userData.tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(th), Math.cos(th), 0)); g.userData.spin.rotation.y = rot; props.add(g); };
    mkSpare({ body: 'spire', tip: 'steel', ballast: 'std' }, { c1: '#6b3a8c', c2: '#f0c75e' }, 120, 448, 0, 0.4);
    mkSpare({ body: 'disc', tip: 'peg', ballast: 'light' }, { c1: '#d49a2a', c2: '#4a2a1a' }, 205, 482, 1.38, 1.1);
  };
  buildProps();
  const slots = [{ g: null, y: 0 }, { g: null, y: 0 }];
  const dishes = new Map(); let dish = null, dishKey = '';
  const setDish = (id) => {
    const k = `${id}|${TIERS[tier].tex}`; if (k === dishKey) return;
    let d = dishes.get(k); if (!d) { d = buildDish(id, TIERS[tier].tex); dishes.set(k, d); }
    if (dish) scene.remove(dish); dish = d; dishKey = k; scene.add(d);
  };
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
    dishKey = ''; if (dish) { scene.remove(dish); dish = null; }
  }
  applyTier();

  let lost = false, clock = 0, lastNow = 0, frameAvg = 16, slowFrames = 0, shown = false;
  const _q = new THREE.Quaternion(), _u = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  function placeCamera(xf) {
    const W = VIEW.w / xf.s, Hh = VIEW.h / xf.s;
    camera.left = -W / 2; camera.right = W / 2; camera.top = Hh / 2; camera.bottom = -Hh / 2; camera.updateProjectionMatrix();
    const x0 = (VIEW.w / 2 - xf.tx) / xf.s - ARENA.cx, z0 = ((VIEW.h / 2 - xf.ty) / xf.s - ARENA.cy) / ARENA.sy;
    camera.position.set(x0, Math.sin(ELEV) * 1800, z0 + Math.cos(ELEV) * 1800); camera.up.set(0, 1, 0); camera.lookAt(x0, 0, z0); camera.updateMatrixWorld(true);
  }
  const ensureTop = (i, t, look) => {
    const key = `${t.build.body}|${t.build.tip}|${t.build.ballast}|${look.c1}|${look.c2}`; const s = slots[i];
    if (s.g && s.g.userData.key === key) return s.g;
    if (s.g) { scene.remove(s.g); disposeTop(s.g); }
    s.g = buildTop(t.build, look); scene.add(s.g); return s.g;
  };
  function drawTops(F, dt) {
    F.tops.forEach((t, i) => {
      if (i > 1) return;
      const look = F.looks[i], g = ensureTop(i, t, look), U = g.userData, blob = blobs[i], s = slots[i];
      const spinF = t.st === 0 ? clamp(t.w / (t.w0 || 1), 0, 1) : 0;
      let X = t.x, Z = t.y, lift = 0, fade = 1, th = 0, ph = 0, sc = 1;
      if (t.st === 0) {
        if (F.age !== undefined && F.age < 0.3) lift = 70 * Math.pow(1 - F.age / 0.3, 2) * 0.8;
        th = Math.min(1.2, Math.hypot(t.tx, t.ty) * 1.05); ph = Math.atan2(t.ty, t.tx);
      } else {
        const k = t.st === 1 ? clamp(t.stT / 0.55, 0, 1) : 1;
        th = (1 - Math.pow(1 - k, 3)) * 1.45; ph = t.ang + (t.st === 1 ? 0 : t.stT * 2.2 * (t.sg || 1));
        if (t.st === 2) {
          const kk = clamp(t.stT / 1.1, 0, 1.4);
          lift = Math.sin(clamp(kk, 0, 1) * Math.PI) * 120 * 0.75; X += t.vx * 0.22 * Math.min(t.stT, 1.1); Z += t.vy * 0.2 * Math.min(t.stT, 1.1);
          fade = clamp(1.7 - t.stT, 0, 1); sc = 1 + lift / 300;
        }
      }
      const gy = floorY(F.arena, Math.hypot(X, Z));
      // out of the dish: follow the ground with a short lag so the drop to the table is a fall, not a jump
      s.y = t.st === 2 ? s.y + (gy - s.y) * Math.min(1, dt * 9) : gy;
      g.visible = fade > 0.01;
      g.position.set(X, s.y + lift, Z); g.scale.setScalar(sc);
      // lean about the tip toward (tx, ty): the top's axis tilts that way
      _u.set(Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).normalize(); _q.setFromUnitVectors(_y, _u); U.tilt.quaternion.copy(_q);
      const shake = t.st === 0 ? clamp(Math.hypot(t.tx, t.ty), 0, 1) * 0.02 * Math.sin(clock * 38) : 0;
      U.spin.rotation.set(shake, -(t.ang || 0), 0);
      U.markM.opacity = 1 - clamp(spinF * 1.5, 0, 0.88);
      U.hazeM.opacity = spinF > 0.35 ? 0.16 * spinF : 0;
      const tr = fade < 0.999;
      for (const m of U.mats) { if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = fade; }
      blob.visible = g.visible;
      if (g.visible) { const gs = clamp(1 - lift / 140, 0.25, 1) * fade; blob.position.set(X + 6, s.y + 0.4, Z + 3); blob.scale.set(U.r * 3.2, 1, U.r * 3.2); blob.material.opacity = (TIERS[tier].shadow ? 0.16 : 0.5) * gs; }
    });
    for (let i = F.tops.length; i < 2; i++) { if (slots[i].g) slots[i].g.visible = false; blobs[i].visible = false; }
  }

  function pre() { if (lost) return; v3.want = false; v3.frame = null; }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    if (!v3.want) { if (shown) { canvas.style.visibility = 'hidden'; shown = false; } return; }
    clock += dt;
    if (!shown) { canvas.style.visibility = 'visible'; shown = true; }
    const F = v3.frame;
    if (F) { props.visible = !F.title; setDish(F.arena); dish.visible = true; placeCamera(F.xf); drawTops(F, dt); }
    else {
      // a screen on the table without a dish (setup, settings...): table only
      if (dish) dish.visible = false; for (const s of slots) if (s.g) s.g.visible = false; blobs.forEach((b) => { b.visible = false; });
      placeCamera({ s: 1, tx: 0, ty: 0 });
    }
    renderer.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.want = false; canvas.style.visibility = 'hidden'; shown = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); for (const d of dishes.values()) { if (dish === d) scene.remove(d); d.userData.dispose(); } dishes.clear(); dish = null; dishKey = '';
    for (const s of slots) if (s.g) { scene.remove(s.g); disposeTop(s.g); s.g = null; }
    buildProps(); applyTier(); v3.on = true;
  });
  let loseExt = null;
  await tick();
  try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  return {
    ok: true, renderer, scene, camera,
    attach() { v3.on = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
