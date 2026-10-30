// Sure Sweep 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a walnut tile tray on a navigator's chart desk under a warm lamp. The camera is fitted to the layout's
// board rectangle (play) or hero rectangle (title), so the 2D HUD and the taps line up with the tilted tray through v3.pick / v3.pt.
// All board motion runs on the game's own clock (state.pulse and the start times in state.fx), exactly like the flat art.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns.
import * as THREE from '../vendor3d/three.js';
import { meta } from '../src/game.js';
import { layoutFor, FRAME, v3 } from '../src/layout.js';
import { THEMES } from '../src/themes.js';
import { HERO_MINES, HERO_HIDDEN, HERO_FLAGGED } from '../src/render.js';
import { C, TILE_H, BAR_H, FRAME_H, BASE, outer, cellPos, tileGeo, tileMat, mineGeo, mineMat, brassMat, bandGeo, flagGeos, clothMat, digitAtlas, digitGeo, cellTex, ringTex, radialTex, buildTray, buildDesk, buildCompass, buildDividers, buildPencil, buildOrnament, buildLights } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 81;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (f) => 1 - (1 - f) ** 3;
const easeOutBack = (f) => 1 + 2.4 * (f - 1) ** 3 + 1.4 * (f - 1) ** 2;
const smooth = (f) => f * f * (3 - 2 * f);
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const BOARD_SCENES = new Set(['playing', 'won', 'lost']);
export const REVEAL_T = 0.42;   // a tile's lift-flip-and-vanish when it opens (seconds of game time)

// The opened tile: a small press (anticipation), then it springs up, tips toward the player and shrinks away.
export function revealPose(f) {
  if (f <= 0) return { y: 0, rx: 0, s: 1, sy: 1 };
  if (f < 0.18) { const a = f / 0.18; return { y: -0.18 * Math.sin(Math.PI * a), rx: 0, s: 1, sy: 1 - 0.08 * Math.sin(Math.PI * a) }; }
  const a = (f - 0.18) / 0.82, e = easeOut(a);
  return { y: 2.6 * Math.sin(Math.PI * Math.min(1, a * 1.15)), rx: -1.5 * e, s: Math.max(0.001, 1 - smooth(a)), sy: 1 };
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1214);
  scene.fog = new THREE.Fog(0x0b1214, 160, 520);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 2000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const desk = buildDesk(scene);
  await tick();
  const trays = { 9: buildTray(9), 5: buildTray(5) };
  scene.add(trays[9], trays[5]);
  await tick();
  // props on the desk
  const compass = buildCompass(), dividers = buildDividers(), pencil = buildPencil();
  const mGeo = mineGeo(), mMat = mineMat(), bGeo = bandGeo();
  const ornament = buildOrnament(mGeo, mMat, bGeo);
  scene.add(compass, dividers, pencil, ornament);
  await tick();

  // ---------------------------------------------------------------- instanced pieces
  const inst = (geo, mat, cap = CAP, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.castShadow = shadow; m.receiveShadow = shadow; m.count = 0; m.frustumCulled = false; scene.add(m); return m; };
  const tMat = tileMat();
  const tiles = inst(tileGeo(), tMat);
  tiles.setColorAt(0, new THREE.Color(1, 1, 1));
  const mines = inst(mGeo, mMat, 40), bands = inst(bGeo, brassMat(), 40, false);
  const fg = flagGeos(), flagMetal = inst(fg.metal, brassMat()), cloth = clothMat(), pennants = inst(fg.pen, cloth);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc84a, emissive: 0x7a5200, roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide });
  const pennantsGold = inst(fg.pen, gold);
  const atlas = digitAtlas();
  const digits = [];
  for (let d = 1; d <= 9; d++) {
    const mat = new THREE.MeshStandardMaterial({ map: atlas, transparent: true, roughness: 0.55, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = inst(digitGeo(d, d === 9 ? 2.6 : 3.0), mat, CAP, false); m.receiveShadow = true; m.renderOrder = 2; digits[d] = m;
  }
  digits[9].material.color.set(0xff3b30); digits[9].material.emissive = new THREE.Color(0x550000);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const additive = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  const rings = inst(flatQuad, new THREE.MeshBasicMaterial({ map: ringTex(false), transparent: true, depthWrite: false, fog: false, toneMapped: false }), CAP, false); rings.renderOrder = 5; rings.setColorAt(0, new THREE.Color());
  const chosen = inst(flatQuad, additive(ringTex(true)), 4, false); chosen.renderOrder = 5;
  const glows = inst(flatQuad, new THREE.MeshBasicMaterial({ map: cellTex(), transparent: true, depthWrite: false, opacity: 0.92 }), 12, false); glows.renderOrder = 1; glows.setColorAt(0, new THREE.Color());
  const shock = new THREE.Mesh(flatQuad, additive(ringTex(true))); shock.renderOrder = 6; shock.visible = false; scene.add(shock);
  // particles: paper flecks when a tile opens, smoke and sparks when a mine goes off, golden glints on a win
  const puffT = radialTex('255,248,230', 0.9), smokeT = radialTex('70,60,55', 0.85), sparkT = radialTex('255,190,90', 1);
  const parts = Array.from({ length: 90 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, transparent: true, depthWrite: false, fog: false })); s.visible = false; s.userData = { life: 0 }; s.renderOrder = 7; scene.add(s); return s; });
  let partI = 0;
  // dust motes drifting slowly through the lamp light (title and play)
  const MOTES = 46, moteSeed = Array.from({ length: MOTES }, (_, k) => [((k * 37) % 23) / 23, ((k * 53) % 29) / 29, ((k * 71) % 31) / 31, ((k * 13) % 17) / 17]);
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: radialTex('255,236,200', 1, 64), size: 0.55, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  motes.frustumCulled = false; motes.renderOrder = 8; scene.add(motes);
  const moveMotes = (t, span) => {
    const a = moteGeo.attributes.position;
    for (let k = 0; k < MOTES; k++) { const [u, v, w, q] = moteSeed[k]; a.setXYZ(k, (u - 0.5) * span + Math.sin(t * 0.13 + q * 9) * 3, 4 + w * 26 + Math.sin(t * 0.09 + u * 7) * 2.5, (v - 0.6) * span + Math.cos(t * 0.11 + w * 5) * 3); }
    a.needsUpdate = true;
  };
  const emit = (map, x, y, z, vx, vy, vz, size, life, grow = 1, add = false) => {
    const s = parts[partI++ % parts.length];
    if (s.material.map !== map || (s.material.blending === THREE.AdditiveBlending) !== add) { s.material.map = map; s.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending; s.material.needsUpdate = true; }
    s.userData = { life, age: 0, x, y, z, vx, vy, vz, size, grow, smoke: map === smokeT }; s.visible = true;
  };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lights.lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lights.lamp.shadow.map) { lights.lamp.shadow.map.dispose(); lights.lamp.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- theme colours
  let themeKey = -1;
  const col = new THREE.Color(), col2 = new THREE.Color();
  function applyTheme(i) {
    if (i === themeKey) return; themeKey = i;
    const T = THEMES[i] ?? THEMES[0];
    col.set(T.hidden[0]).lerp(col2.set(T.hidden[1]), 0.7); tMat.color.copy(col);
    for (const n of [9, 5]) trays[n].userData.floor.color.set(T.revealed[0]).lerp(col2.set(T.revealed[1]), 0.3);
    for (let d = 1; d <= 8; d++) digits[d].material.color.set(T.numbers[d] || '#222');
    // the leather follows the backdrop of the scheme (light schemes with dark text get a pale desk)
    if (T.ink) desk.leather.color.set(T.bg[0]).lerp(col2.set('#ffffff'), 0.25).multiplyScalar(1.2);
    else desk.leather.color.set(T.bg[1]).lerp(col2.set(T.bg[2]), 0.45).multiplyScalar(1.25);
    scene.background.set(T.bg[2]).multiplyScalar(0.5); scene.fog.color.copy(scene.background);
  }

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 120 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 8; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  // ---------------------------------------------------------------- v3 hooks for the 2D layer (only while the 9x9 tray is framed)
  let boardOn = false;
  const PICK_Y = TILE_H * 0.55;
  v3.pt = (i) => { const c = cellPos(9, i); return virt(toCss(camera, c.x, PICK_Y, c.z, { x: 0, y: 0 })); };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PICK_Y), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.pick = (vx, vy) => {
    if (!boardOn) return -1;
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const gx = Math.floor(hit.x / C + 4.5), gz = Math.floor(hit.z / C + 4.5);
    return gx < 0 || gz < 0 || gx >= 9 || gz >= 9 ? -1 : gz * 9 + gx;
  };

  // ---------------------------------------------------------------- per-frame board building
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const all = [tiles, mines, bands, flagMetal, pennants, pennantsGold, rings, chosen, glows, ...digits.slice(1)];
  const cnt = new Map();
  const begin = () => { for (const m of all) cnt.set(m, 0); };
  const put = (m, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, color = null) => {
    const k = cnt.get(m); if (k >= m.instanceMatrix.count) return;
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z);
    m.setMatrixAt(k, _m.compose(_p, _q, _s)); if (color && m.instanceColor) m.setColorAt(k, color);
    cnt.set(m, k + 1);
  };
  const end = () => { for (const [m, k] of cnt) { m.count = k; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
  const WHITE = new THREE.Color(1, 1, 1), SAFE = new THREE.Color(0.25, 1.0, 0.62), DANGER = new THREE.Color(1.0, 0.33, 0.27), HOT = new THREE.Color('#e2473f');
  const ringColor = (kind, t) => _c.copy(kind === 'mine' ? DANGER : SAFE).multiplyScalar(0.85 + 0.25 * Math.sin(t * 6));
  const yawOf = (i) => (((i * 2654435761) >>> 0) % 1000) / 1000 * 0.5 - 0.25;

  function flag(i, x, y, z, drop, isGold, t) {
    const f = clamp01(drop);
    if (f <= 0) return;
    const fall = (1 - easeOut(f)) * 5, sc = (0.55 + 0.45 * easeOutBack(f)) * 1.2;
    const ry = 0.55 + yawOf(i);
    put(flagMetal, x, y + fall, z, 0, ry, 0, sc);
    // pennant hinged on the pole, swaying a little on its own phase
    const px = x - Math.cos(ry) * 0.42 * sc, pz = z + Math.sin(ry) * 0.42 * sc;
    put(isGold ? pennantsGold : pennants, px, y + fall + 2.42 * sc, pz, 0, ry + Math.sin(t * 2.2 + i) * 0.12, 0, sc);
  }
  function mine(x, z, s, i) {
    if (s <= 0.01) return;
    const r = yawOf(i) * 4;
    put(mines, x, 1.3 * s, z, 0, r, 0, s); put(bands, x, 1.3 * s, z, 0, r, 0, s);
  }
  const tile = (x, z, y, rx, s, sy, tint) => put(tiles, x, y, z, rx, 0, 0, s, s * sy, s, tint || WHITE);

  let lastSceneAt = -1, lastBoardAt = -1;
  const puffed = new Uint8Array(CAP);
  function drawMain(state, t) {
    const fx = state.fx, lost = state.scene === 'lost', won = state.scene === 'won', since = t - fx.sceneAt;
    if (fx.boardAt !== lastBoardAt) { lastBoardAt = fx.boardAt; puffed.fill(0); }
    const fullReveal = lost && state.shieldOffered;
    const ex = state.exploded >= 0 ? state.exploded % 9 : 0, ez = state.exploded >= 0 ? Math.floor(state.exploded / 9) : 0;
    for (let i = 0; i < 81; i++) {
      const c = i % 9, r = (i - c) / 9, { x, z } = cellPos(9, i), num = state.numbers[i];
      const settle = fx.boardAt < 0 ? 1 : clamp01((t - fx.boardAt - (r + c) * 0.02) / 0.36);
      const p = state.revealed[i] ? (fx.revealAt[i] < 0 ? 1 : clamp01((t - fx.revealAt[i]) / REVEAL_T)) : 0;
      if (p > 0) {
        if (p < 1) {
          const P = revealPose(p); tile(x, z, P.y, P.rx, P.s, P.sy);
          if (p > 0.18 && !puffed[i]) { puffed[i] = 1; for (let k = 0; k < 3; k++) { const a = i * 7 + k * 2.1; emit(puffT, x + Math.cos(a) * 0.8, 0.8, z + Math.sin(a) * 0.8, Math.cos(a) * 3, 3 + k, Math.sin(a) * 3, 1.0, 0.45, 2.2); } }
        }
        const pop = easeOutBack(clamp01((p - 0.3) / 0.7));
        if (num === -1) mine(x, z, pop, i);
        else if (num > 0 && pop > 0.01) put(digits[num], x, 0.03, z + 0.05, 0, 0, 0, pop);
        if (state.exploded === i) put(glows, x, 0.02, z, 0, 0, 0, C, 1, C, _c.copy(HOT));
      } else {
        const q = fullReveal && num === -1 && !state.flagged[i] ? clamp01((since - 0.35 - Math.hypot(c - ex, r - ez) * 0.07) / 0.3) : 0;
        if (q > 0) {
          if (q < 1) { const P = revealPose(q); tile(x, z, P.y, P.rx, P.s, P.sy); }
          mine(x, z, easeOutBack(clamp01((q - 0.3) / 0.7)), i);
          continue;
        }
        if (settle <= 0) continue;
        const wave = won ? Math.sin(Math.PI * clamp01((since - ((r + c) / 16) * 0.7) / 0.4)) : 0;
        const e = easeOutBack(settle), drop = (1 - smooth(settle)) * 7;
        const tint = won && wave > 0 ? _c.setRGB(1 + wave * 0.6, 1 + wave * 0.6, 1 + wave * 0.5) : null;
        const lift = wave * 1.6 + drop;
        tile(x, z, lift, 0, Math.min(1.04, 0.7 + 0.3 * e), 1, tint);
        const top = TILE_H + lift;
        if (state.flagged[i]) {
          flag(i, x, top, z, fx.flagAt[i] < 0 ? 1 : (t - fx.flagAt[i]) / 0.3, won, t);
          if (fullReveal && num !== -1 && since > 0.6) put(digits[9], x, top + 0.02, z, 0, 0, 0, 1);
        } else if (won) {
          const d = (since - ((r + c) / 16) * 0.7 - 0.15) / 0.3;
          if (d > 0) flag(i, x, top, z, d, true, t);
        }
      }
    }
    // rings: hint, the loss's "you could have deduced this", Auto Play's sure moves and its chosen one
    const marks = [];
    if (state.hint && state.hint.kind) marks.push([state.hint.index, state.hint.kind]);
    if (lost && state.lossHint && state.lossHint.kind) marks.push([state.lossHint.index, state.lossHint.kind]);
    if (state.auto && state.autoPhase === 'reveal') for (const m of state.autoForced) if (m.kind) marks.push([m.index, m.kind]);
    for (const [i, kind] of marks) {
      const { x, z } = cellPos(9, i), y = state.revealed[i] ? BAR_H + 0.05 : TILE_H + 0.06;
      const s = C * (1.12 + 0.05 * Math.sin(t * 6));
      put(rings, x, y, z, 0, 0, 0, s, 1, s, ringColor(kind, t));
    }
    if (state.auto && state.autoPhase === 'reveal' && state.autoChosen) {
      const i = state.autoChosen.index, { x, z } = cellPos(9, i), s = C * (1.45 + 0.06 * Math.sin(t * 7));
      put(chosen, x, (state.revealed[i] ? BAR_H : TILE_H) + 0.1, z, 0, 0, 0, s);
    }
    // the blast: a flash of light, a shock ring across the tray, smoke and sparks (the tray itself never moves)
    if (lost && state.exploded >= 0) {
      const { x, z } = cellPos(9, state.exploded);
      if (fx.sceneAt !== lastSceneAt) {
        lastSceneAt = fx.sceneAt;
        if (since < 0.5) {
          for (let k = 0; k < 14; k++) { const a = k * 2.399, v = 6 + (k % 4) * 3; emit(sparkT, x, 1.5, z, Math.cos(a) * v, 8 + (k % 3) * 5, Math.sin(a) * v, 0.7, 0.55, 0.3, true); }
          for (let k = 0; k < 8; k++) { const a = k * 0.785; emit(smokeT, x + Math.cos(a), 1.5, z + Math.sin(a), Math.cos(a) * 2.2, 4 + (k % 3), Math.sin(a) * 2.2, 2.4, 1.6, 3.2); }
        }
      }
      const f = since / 0.7;
      lights.flash.position.set(x, 6, z); lights.flash.intensity = since < 0.6 ? 650 * (1 - since / 0.6) ** 2 : 0;
      if (f < 1) { shock.visible = true; const s = 3 + easeOut(f) * 40; shock.scale.set(s, 1, s); shock.position.set(x, BAR_H + 0.1, z); shock.material.color.setRGB(1, 0.55 * (1 - f) + 0.2, 0.4 * (1 - f)).multiplyScalar(0.55 * (1 - f)); } else shock.visible = false;
    } else { lights.flash.intensity = 0; shock.visible = false; if (!lost) lastSceneAt = fx.sceneAt; }
    // a win: golden glints rise off the tray
    if (won && since < 3) {
      const k = Math.floor(since * 20);
      if (k !== lastGlint) { lastGlint = k; const a = k * 2.399, rr = ((k * 37) % 17) / 17 * 16; emit(sparkT, Math.cos(a) * rr, 3, Math.sin(a) * rr, 0, 7 + (k % 5), 0, 0.6, 1.1, 0.4, true); }
    }
  }
  let lastGlint = -1;
  // the title's small board: the same idea as the flat hero (numbers, a sure mine being flagged, a sure safe tile)
  const heroNum = (i) => { let k = 0; for (const m of HERO_MINES) if (Math.abs((m % 5) - (i % 5)) <= 1 && Math.abs(Math.floor(m / 5) - Math.floor(i / 5)) <= 1) k++; return k; };
  function drawHero(t) {
    const cycle = t % 6;
    for (let i = 0; i < 25; i++) {
      const { x, z } = cellPos(5, i);
      if (!HERO_HIDDEN.has(i)) { const n = heroNum(i); if (n > 0) put(digits[n], x, 0.03, z + 0.05); continue; }
      const lift = 0.1 + Math.sin(t * 2 + i * 0.9) * 0.1;
      tile(x, z, lift, 0, 1, 1);
      const top = TILE_H + lift;
      if (HERO_FLAGGED.has(i)) flag(i, x, top, z, 1, false, t);
      else if (i === 20) {
        if (cycle < 2.2) put(rings, x, top + 0.06, z, 0, 0, 0, C * 1.12, 1, C * 1.12, ringColor('mine', t));
        else if (cycle < 5.6) flag(i, x, top, z, (cycle - 2.2) / 0.35, false, t);
      } else if (i === 4) put(rings, x, top + 0.06, z, 0, 0, 0, C * 1.12, 1, C * 1.12, ringColor('safe', t + 0.5));
    }
  }
  // pennant cloth ripples (one shared geometry; each pennant also sways on its own)
  const penPos = fg.pen.attributes.position, penBase = fg.pen.userData.base;
  function flutter(t) {
    for (let k = 0; k < penPos.count; k++) { const u = penBase[k * 3] / 2.6; penPos.setZ(k, Math.sin(u * 4 - t * 5) * 0.16 * u); }
    penPos.needsUpdate = true; fg.pen.computeVertexNormals();
  }

  // ---------------------------------------------------------------- framing and props per screen
  function framing(L, board, t) {
    if (board) {
      const B = L.board, F = FRAME, o = outer(9);
      const rc = rectCss({ x: B.x - F, y: B.y - F, w: B.size + 2 * F, h: B.size + 2 * F });
      const pts = [[-o, FRAME_H, -o], [o, FRAME_H, -o], [-o, -BASE, o], [o, -BASE, o], [-o, FRAME_H, o], [o, FRAME_H, o]];
      return fit(rc, pts, { yaw: 0, tilt: L.land ? 58 : 63, fov: 28, tx: 0, ty: 0, tz: 0 });
    }
    const o = outer(5);
    const base = { yaw: -12 + 7 * Math.sin(t * TAU / 26), tilt: 44 + 3 * Math.sin(t * TAU / 17), fov: 30, tx: 0, ty: 0, tz: 0 };
    const H = L.hero, w = H.cell * 5 + 40;
    const rc = rectCss({ x: H.x - w / 2, y: H.y - w / 2, w, h: w });
    const pts = [[-o, FRAME_H, -o], [o, FRAME_H, -o], [-o, -BASE, o], [o, -BASE, o]];
    return fit(rc, pts, base);
  }
  function placeProps(board) {
    const o = outer(board ? 9 : 5);
    compass.position.set(board ? -o - 9 : -o - 6.5, -BASE, board ? -o + 2 : o - 3); compass.rotation.y = board ? 0.3 : -0.4;
    dividers.position.set(board ? o + 4 : -o - 4, -BASE, board ? -o - 6 : -o - 2); dividers.rotation.y = board ? -0.5 : 0.9;
    pencil.position.set(board ? o + 5 : 4, -BASE, board ? o - 4 : o + 7); pencil.rotation.y = board ? 1.2 : 0.15;
    ornament.visible = !board; ornament.position.set(o + 7, -BASE, -o + 7); ornament.rotation.y = 0.5;
    trays[9].visible = board; trays[5].visible = !board;
    desk.chart.scale.setScalar(board ? 1 : 0.68); desk.chart.position.set(board ? 3 : 2, -BASE - 0.02, board ? -3 : -1);
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, wasBoard = null, lastT = 0;
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height), board = BOARD_SCENES.has(state.scene);
    if (wasBoard !== board) { wasBoard = board; placeProps(board); }
    boardOn = board;
    Object.assign(cur, framing(L, board, state.pulse));
    place(camera, cur);
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState(), board = BOARD_SCENES.has(state.scene), t = state.pulse, gdt = clamp(t - lastT, 0, 0.1); lastT = t;
    applyTheme(state.theme);
    begin();
    if (board) drawMain(state, t); else drawHero(t);
    end();
    flutter(t);
    moveMotes(t, board ? 60 : 40);
    // the flag-mode lip glows red while Flag is selected
    const fm = board && state.scene === 'playing' && state.flagMode && !state.auto ? 0.75 + 0.25 * Math.sin(t * 5) : 0;
    trays[9].userData.lip.opacity = fm; trays[9].userData.frameMat.emissive.setRGB(0.3 * fm, 0.03 * fm, 0.015 * fm);
    // the compass needle hunts a little and settles; the ornament mine turns slowly on its post
    compass.userData.needle.rotation.y = 0.35 + Math.sin(t * 1.3) * 0.06 + Math.sin(t * 0.37) * 0.04;
    ornament.userData.mine.rotation.y = t * 0.25; ornament.userData.band.rotation.y = t * 0.25;
    for (const s of parts) {
      if (!s.visible) continue;
      const u = s.userData; u.age += gdt; if (u.age >= u.life) { s.visible = false; continue; }
      const f = u.age / u.life; u.vy += (u.smoke ? 1.5 : -9) * gdt; u.x += u.vx * gdt; u.y = Math.max(0.2, u.y + u.vy * gdt); u.z += u.vz * gdt;
      s.position.set(u.x, u.y, u.z); const sz = u.size * (1 + f * u.grow); s.scale.set(sz, sz, 1); s.material.opacity = (1 - f) * (1 - f) * (u.smoke ? 0.75 : 1);
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); applyTier(); themeKey = -1; fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible';
  });

  await tick();
  placeProps(false);
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
