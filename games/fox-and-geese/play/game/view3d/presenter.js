// Fox and Geese 3D presenter. READS the game state (getState) and the 2D view's hand-off (src/v3.js); never writes the sim.
// One WebGL canvas behind the kit's transparent 2D canvas: the cross lattice board on a granite plinth in a frozen pine clearing, the carved
// fox and the flock of geese. The camera is fitted to the layout's board rectangle (play), the title's hero rectangle (menus) or the result
// portrait (result), so the 2D HUD and taps line up with the tilted board through v3.pt.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { layoutFor, BB } from '../src/layout.js';
import { meta } from '../src/game.js';
import { STEPS } from '../src/rules.js';
import { SP, TOP, SLAB_Y, R_ARM, R_END, FRAME, PTS, pointW, THEMES, buildBoard, buildClearing, buildLights, applyTheme, foxGeos, gooseGeos, makePiece, pieceMats, radialTex, ringTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, step: 0.1 }, { name: 'medium', dpr: 1.5, shadow: 1024, step: 0.12 }, { name: 'low', dpr: 1, shadow: 0, step: 0.15 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const angTo = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const NGEESE = 17;
// the menu tableau: the fox in the middle of the cross, a ring of geese closing in
export const HERO_BOARD = (() => { const b = Array(49).fill(''); b[24] = 'F'; for (const i of [17, 23, 25, 30, 31, 32, 37, 38, 39, 29, 33, 16, 18]) b[i] = 'G'; return b; })();

export async function createPresenter({ kitCanvas, getState }) {
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
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene, 'frost');
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.4; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // snow / fireflies drifting through the scene, and the puff of snow when a piece lands
  const DOTS = 200, dotsGeo = new THREE.BufferGeometry(), dotsP = new Float32Array(DOTS * 3); dotsGeo.setAttribute('position', new THREE.BufferAttribute(dotsP, 3));
  const dots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({ map: radialTex('255,255,255', 1, 32), size: 1.1, transparent: true, depthWrite: false, sizeAttenuation: true })); dots.frustumCulled = false; scene.add(dots);
  let fallKind = 'snow';

  // the clearing + board are cached per theme (frost / slate / moss)
  const worlds = new Map(); let wld = null, themeKey = '', T = THEMES.frost;
  function setTheme(name) {
    if (name === themeKey) return; themeKey = name;
    let c = worlds.get(name); if (!c) { const th = THEMES[name]; const grp = new THREE.Group(); const cl = buildClearing(new THREE.Scene(), name, tier < 2 ? 1 : 0); grp.add(cl, buildBoard(th, 1024)); grp.userData = cl.userData; c = grp; worlds.set(name, c); }
    if (wld) scene.remove(wld); wld = c; scene.add(c);
    T = applyTheme(scene, lights, name); renderer.toneMappingExposure = T.exposure;
    fallKind = T.fall; dots.material.color.setHex(fallKind === 'snow' ? 0xffffff : 0xd8ff8a); dots.material.blending = fallKind === 'snow' ? THREE.NormalBlending : THREE.AdditiveBlending; dots.material.size = fallKind === 'snow' ? 0.8 : 1.8; dots.material.needsUpdate = true;
  }

  // pieces: the fox and 17 geese, sculpted once per piece set
  const mats = pieceMats();
  const geoCache = new Map(); let setKey = '';
  const pieces = [];                       // { kind, obj, at: point, pos, yaw, lift, land, wag, ghost }
  let building = null;
  function buildSet(set) {
    if (set === setKey || building) return;
    const G = geoCache.get(set);
    if (!G) { building = (async () => { const F = await foxGeos(set, TIERS[tier].step), Go = await gooseGeos(set, TIERS[tier].step * 0.85); geoCache.set(set, { F, G: Go }); building = null; buildSet(set); })(); return; }
    setKey = set;
    const keep = pieces.map((p) => ({ kind: p.kind, at: p.at, pos: p.pos.clone(), yaw: p.yaw, used: false }));
    for (const p of pieces) scene.remove(p.obj); pieces.length = 0;
    const mk = (kind, i) => {
      const obj = makePiece(kind, G[kind], mats); scene.add(obj);
      const old = keep.find((k) => k.kind === kind && !k.used); if (old) old.used = true;
      pieces.push({ kind, obj, at: old ? old.at : -1, pos: old ? old.pos : new THREE.Vector3(), yaw: old ? old.yaw : 0, lift: 0, land: -9, wag: hash(i) * 6, ghost: -9, gx: 0, gz: 0, hon: -9 });
    };
    mk('F', 0); for (let i = 0; i < NGEESE; i++) mk('G', i + 1);
  }
  // contact shadows under the pieces + marks lying on the field
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.45 });
  const blobs = Array.from({ length: NGEESE + 1 }, () => { const m = new THREE.Mesh(flat, blobMat); m.renderOrder = 1; scene.add(m); return m; });
  const rT = ringTex(), dT = radialTex('255,255,255', 1);
  const pool = (tex, n, order) => Array.from({ length: n }, () => { const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = order; m.visible = false; scene.add(m); return m; });
  const rings = pool(rT, 26, 3), fills = pool(dT, 26, 2);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function updateFall(t) {
    const fire = fallKind === 'firefly';
    for (let i = 0; i < DOTS; i++) {
      if (fire) { const a = hash(i, 4) * TAU + t * 0.05 * (hash(i, 7) - 0.5), r = 30 + hash(i, 3) * 150; dotsP[i * 3] = Math.cos(a) * r + Math.sin(t * 0.5 + i) * 4; dotsP[i * 3 + 1] = SLAB_Y + 4 + hash(i, 2) * 60 + Math.sin(t * 0.8 + i * 1.3) * 3; dotsP[i * 3 + 2] = Math.sin(a) * r + Math.cos(t * 0.4 + i) * 4; }
      else { const sp = 6 + hash(i, 1) * 5, life = 150 / sp, ph = ((t + hash(i, 2) * life) % life) / life, r = 8 + hash(i, 3) * 140, a = hash(i, 4) * TAU; dotsP[i * 3] = Math.cos(a) * r + Math.sin(t * 0.7 + i) * 3; dotsP[i * 3 + 1] = 120 - ph * 122; dotsP[i * 3 + 2] = Math.sin(a) * r - 10; }
    }
    dotsGeo.attributes.position.needsUpdate = true;
    if (fire) dots.material.opacity = 0.6 + 0.4 * Math.sin(t * 3);
  }
  const PUFF_N = 40, puff = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 7, 5), new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.9 }), PUFF_N); puff.frustumCulled = false; scene.add(puff);
  const puffs = Array.from({ length: PUFF_N }, () => ({ t: 9, x: 0, z: 0, vx: 0, vz: 0, vy: 0 })); let puffI = 0;
  function kick(x, z, n, strong) {
    for (let k = 0; k < n; k++) { const i = puffI++ % PUFF_N, p = puffs[i], a = hash(puffI, 3) * TAU, v = (strong ? 11 : 7) * (0.5 + hash(puffI, 4)); Object.assign(p, { t: 0, x: x + Math.cos(a) * 2.2, z: z + Math.sin(a) * 2.2, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 6 + hash(puffI, 5) * 7 }); }
  }
  function updatePuff(dt) {
    for (let i = 0; i < PUFF_N; i++) {
      const p = puffs[i]; p.t += dt;
      if (p.t > 0.9) { _s.set(0, 0, 0); puff.setMatrixAt(i, _m.compose(_p.set(0, -50, 0), _q.identity(), _s)); continue; }
      p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= 0.94; p.vz *= 0.94;
      const y = TOP + 0.3 + Math.max(0, p.vy * p.t - 20 * p.t * p.t);
      const s = (1 - p.t / 0.9) * (0.7 + 0.5 * hash(i, 8)); _s.set(s, s, s); puff.setMatrixAt(i, _m.compose(_p.set(p.x, y, p.z), _q.identity(), _s));
    }
    puff.instanceMatrix.needsUpdate = true;
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 56, fov: 26, dist: 160, ox: 0, oy: 0, tx: 0, ty: TOP, tz: 0 };
  let snap = true, viewKey = '';
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
    const p = { ...base, ox: 0, oy: 0, dist: 160 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 9; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => Math.min(cssW(), cssH()) / 720;
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });

  // the screen point of board point i (virtual units) with a scale matching the flat board (point spacing 100 units at s = 1)
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 }, ph = { x: 0, y: 0 };
  const ptOn = (i) => {
    const w = pointW(i), p = virt(toCss(camera, w.x, TOP, w.z, { x: 0, y: 0 }));
    toCss(camera, w.x - SP / 2, TOP, w.z, pa); toCss(camera, w.x + SP / 2, TOP, w.z, pb); toCss(camera, w.x, TOP + 6, w.z, ph);
    p.s = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu() / 100; p.hy = virt(ph).y; return p;
  };

  // ---------------------------------------------------------------- framing per screen
  const boardScene = (S) => S.scene === 'play' || S.scene === 'lesson' || S.scene === 'autoplay' || (S.scene === 'puzzle' && S.pz && S.pz.status !== 'making');
  const OUT = (() => { const a = R_ARM + FRAME, b = R_END + FRAME; return [[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]]; })();
  const BOX = [...OUT.map(([x, z]) => [x, TOP + 0.5, z]), [-13, TOP + 13, -3 * SP], [13, TOP + 13, -3 * SP]];
  function framing(S, L, t) {
    const drift = S.calm ? 0 : 1;
    if (boardScene(S)) {
      const B = L.board, rc = rectCss({ x: B.tx + BB.x0 * B.s, y: B.ty + BB.y0 * B.s, w: BB.w * B.s, h: BB.h * B.s });
      return fit(rc, BOX, { yaw: 0, tilt: 54, fov: 26, tx: 0, ty: TOP, tz: 0 });
    }
    if (S.scene === 'over' && v3.over) {
      const g = S.game, f = Math.max(0, g.board.indexOf('F')), fp = pointW(f), pts = [[fp.x - 4, TOP, fp.z - 4], [fp.x + 4, TOP, fp.z + 4], [fp.x, TOP + 12, fp.z]];
      if (g.winner === 'G') for (const i of STEPS[f]) if (g.board[i] === 'G') { const w = pointW(i); pts.push([w.x, TOP + 9, w.z], [w.x, TOP, w.z]); }
      let gl = 0, gr = 0; for (let i = 0; i < 49; i++) if (g.board[i] === 'G') { if (i % 7 > f % 7) gr++; else if (i % 7 < f % 7) gl++; }
      return fit(rectCss(v3.over), pts, { yaw: (gr > gl ? -90 : 90) + 14 * Math.sin(t * TAU / 30) * drift, tilt: 26, fov: 30, tx: fp.x, ty: TOP + 3, tz: fp.z });
    }
    const r = v3.hero || { x: 0, y: L.h * 0.08, w: L.w, h: L.h * 0.5 };
    const pts = [...OUT.map(([x, z]) => [x, TOP, z]), [0, TOP + 14, 0]];
    const rr = { x: r.x - r.w * 0.12, y: r.y - r.h * 0.1, w: r.w * 1.24, h: r.h * 1.2 };
    return fit(rectCss(rr), pts, { yaw: 128 + 12 * Math.sin(t * TAU / 40) * drift, tilt: 30 + 2 * Math.sin(t * TAU / 27) * drift, fov: 30, tx: 0, ty: TOP, tz: 0 });
  }

  // ---------------------------------------------------------------- pieces: who stands where, motion, facing, idle life
  let clock = 0, lastAnim = null;
  function assign(board, a) {
    for (const kind of ['F', 'G']) {
      const want = []; for (let i = 0; i < 49; i++) if (board[i] === kind) want.push(i);
      const ps = pieces.filter((p) => p.kind === kind), stay = new Set();
      for (const i of want) { const p = ps.find((q) => q.at === i && !stay.has(q)); if (p) stay.add(p); }
      const free = ps.filter((p) => !stay.has(p)), open = want.filter((i) => ![...stay].some((p) => p.at === i));
      for (const i of open) {
        const w = pointW(i); let best = null, bd = 1e9;
        for (const p of free) { const d = p.at < 0 ? 999 : Math.hypot(p.pos.x - w.x, p.pos.z - w.z); if (d < bd) { bd = d; best = p; } }
        if (best) { free.splice(free.indexOf(best), 1); if (best.at < 0) best.pos.set(w.x, TOP, w.z); best.at = i; }
      }
      for (const p of free) {
        if (kind === 'G' && p.at >= 0 && a && a.type === 'jump' && p.at === a.over) { const w = pointW(p.at); p.ghost = clock; p.gx = w.x; p.gz = w.z; }   // captured: it tumbles away
        p.at = -1;
      }
    }
  }
  const animAt = (a, g) => {
    const f = Math.min(1, a.t / a.dur), from = pointW(a.from), to = pointW(a.to);
    if (a.type === 'refuse') {
      const reach = a.to === a.from ? 0 : g.board[a.to] ? 0.55 : 0.92;
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 0.5 : 0;
      return { x: from.x + (to.x - from.x) * e + shake, z: from.z + (to.z - from.z) * e, y: 0.9 * Math.sin(Math.PI * Math.min(1, f * 1.1)), f, dx: to.x - from.x, dz: to.z - from.z };
    }
    const ease = f * f * (3 - 2 * f), jump = a.type === 'jump';
    const hop = a.kind === 'F' ? Math.sin(Math.PI * f) * (jump ? 7 : 3) : Math.abs(Math.sin(Math.PI * 2 * f)) * 0.9 + Math.sin(Math.PI * f) * 0.5;
    return { x: from.x + (to.x - from.x) * ease, z: from.z + (to.z - from.z) * ease, y: hop, f, dx: to.x - from.x, dz: to.z - from.z, jump };
  };
  function updatePieces(S, dt, hero) {
    const g = S.game, board = hero ? HERO_BOARD : g.board, a = hero ? null : S.anim, calm = S.calm;
    // a move just finished: settle with a squash and kick the snow
    if (lastAnim && lastAnim !== a && lastAnim.type !== 'refuse' && !hero) { const p = pieces.find((q) => q.kind === lastAnim.kind && q.at === lastAnim.to); if (p) { p.land = clock; const w = pointW(lastAnim.to); if (!calm) kick(w.x, w.z, lastAnim.type === 'jump' ? 12 : 5, lastAnim.type === 'jump'); } }
    lastAnim = a;
    assign(board, a);
    const fox = pieces.find((p) => p.kind === 'F' && p.at >= 0);
    const geeseWin = S.scene === 'over' && g.winner === 'G', foxWin = S.scene === 'over' && g.winner === 'F', foxTurn = !hero && !g.winner && g.turn === 'F';
    let nb = 0;
    for (const p of pieces) {
      const o = p.obj, ud = o.userData;
      if (p.at < 0) {
        const gt = clock - p.ghost;
        if (gt >= 0 && gt < 0.9 && p.kind === 'G') {          // the captured goose is knocked over, sinks into the snow and is gone
          o.visible = true; const f = gt / 0.9;
          o.position.set(p.gx + f * 3, TOP + 0.05 - Math.max(0, f - 0.5) * 6, p.gz + f * 2); o.rotation.set(0, p.yaw, f * 1.35 * (1 + (hash(p.wag * 100) - 0.5)));
          const sc = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4; o.scale.setScalar(Math.max(0.01, sc));
          if (nb < blobs.length) { const b = blobs[nb++]; b.visible = true; b.position.set(p.gx, TOP + 0.04, p.gz); b.scale.set(6 * sc, 1, 6 * sc); }
        } else { o.visible = false; o.scale.setScalar(1); o.rotation.z = 0; }
        continue;
      }
      o.visible = true; o.scale.setScalar(1); o.rotation.set(0, 0, 0);
      const w = pointW(p.at); let x = w.x, z = w.z, y = 0, moving = null;
      if (a && p.kind === a.kind && (((a.type === 'move' || a.type === 'jump') && a.to === p.at) || (a.type === 'refuse' && a.from === p.at))) { moving = animAt(a, g); x = moving.x; z = moving.z; y = moving.y; }
      else { const k = 1 - Math.exp(-dt * 14); x = p.pos.x + (x - p.pos.x) * k; z = p.pos.z + (z - p.pos.z) * k; }
      p.pos.set(x, TOP, z);
      // selected: lifted a little and breathing up and down
      const sel = !hero && S.sel === p.at && !a, lt = sel ? 1.4 + (calm ? 0 : Math.sin(clock * 3) * 0.25) : 0; p.lift += (lt - p.lift) * (1 - Math.exp(-dt * 12));
      o.position.set(x, TOP + 0.05 + y + p.lift, z);
      // facing: along the travel while moving; geese watch the fox; the fox watches the nearest goose
      let yaw = p.yaw;
      if (moving && Math.hypot(moving.dx, moving.dz) > 0.1) yaw = Math.atan2(moving.dx, moving.dz);
      else if (p.kind === 'G' && fox && !foxWin) yaw = Math.atan2(fox.pos.x - x, fox.pos.z - z);
      else if (p.kind === 'G' && foxWin) yaw = Math.atan2(-x, 60 - z) + 0.4 * Math.sin(p.wag);
      else if (p.kind === 'F') { let nd = 1e9, t2 = null; for (const q of pieces) if (q.kind === 'G' && q.at >= 0) { const d = Math.hypot(q.pos.x - x, q.pos.z - z); if (d < nd) { nd = d; t2 = q; } } yaw = t2 && nd < SP * 2.3 && !geeseWin ? Math.atan2(t2.pos.x - x, t2.pos.z - z) : 0.25; }
      p.yaw += angTo(p.yaw, yaw) * (1 - Math.exp(-dt * (moving ? 16 : 6)));
      o.rotation.y = p.yaw;
      // body: lean into a bound, squash on landing, breathing
      const lt2 = clock - p.land, sq = calm || lt2 > 0.6 ? 0 : Math.exp(-lt2 * 9) * Math.cos(lt2 * 26) * (p.kind === 'F' ? 0.12 : 0.07);
      const breathe = calm ? 0 : Math.sin(clock * (p.kind === 'F' ? 2.6 : 2.0) + p.wag) * 0.012;
      const bs = ud.body.userData.s0 ?? (ud.body.userData.s0 = ud.body.scale.x);
      ud.body.scale.set(bs * (1 + sq * 0.5), bs * (1 - sq + breathe), bs * (1 + sq * 0.5));
      ud.body.rotation.x = moving ? Math.sin(Math.PI * moving.f) * (p.kind === 'F' ? (moving.jump ? 0.42 : 0.2) : 0.06) : 0;
      if (p.kind === 'G') {
        // the waddle: a roll side to side while walking; the neck stretches forward when it moves, watches the fox otherwise
        ud.body.rotation.z = moving ? Math.sin(moving.f * TAU * 2) * 0.12 : 0;
        const nk = ud.neck; if (nk) { nk.rotation.x = moving ? 0.35 * Math.sin(Math.PI * moving.f) : (calm ? 0 : Math.sin(clock * 1.3 + p.wag) * 0.05) + (foxWin ? 0 : 0); nk.rotation.y = calm ? 0 : Math.sin(clock * 0.8 + p.wag * 2) * 0.25; if (geeseWin || foxWin) nk.rotation.x = -0.15 + 0.12 * Math.sin(clock * 6 + p.wag); }
      } else if (ud.tail) {
        // the brush: a slow sway, quick flicks while it hunts
        const fast = foxTurn || foxWin, sp = calm ? 0 : fast ? 7 : 1.6, amp = calm ? 0 : fast ? 0.4 : 0.14;
        p.wag += dt * sp; ud.tail.rotation.y = Math.sin(p.wag) * amp; ud.tail.rotation.x = -0.2 + (moving ? -0.35 * Math.sin(Math.PI * moving.f) : 0);
      }
      // a soft shadow that stays on the board while the piece is in the air
      const air = y + p.lift, b = blobs[nb++]; if (b) { const s = (p.kind === 'F' ? 7.8 : 6.2) + air * 0.5; b.visible = true; b.position.set(x + air * 0.25, TOP + 0.04, z + air * 0.2); b.scale.set(s, 1, s); b.material.opacity = 0.45; }
    }
    for (; nb < blobs.length; nb++) blobs[nb].visible = false;
  }
  function drawMarks(marks, t) {
    let r = 0, f = 0;
    for (const mk of marks) {
      if (mk.i < 0 || mk.i > 48) continue;
      const w = pointW(mk.i), ring = rings[r++], fill = fills[f++]; if (!ring || !fill) continue;
      const [cr, cg, cb] = mk.rgb.split(',').map((v) => Number(v) / 255);
      ring.visible = fill.visible = true;
      fill.position.set(w.x, TOP + 0.06, w.z); fill.scale.set(6.4, 1, 6.4); fill.material.color.setRGB(cr, cg, cb); fill.material.opacity = clamp(mk.a * 0.9, 0, 1);
      const s = 7.0 + Math.sin(t * 4) * 0.25; ring.position.set(w.x, TOP + 0.09, w.z); ring.scale.set(s, 1, s); ring.material.color.setRGB(cr, cg, cb); ring.material.opacity = clamp(mk.a + 0.25, 0, 1);
    }
    for (; r < rings.length; r++) rings[r].visible = false;
    for (; f < fills.length; f++) fills[f].visible = false;
  }

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, attached = false;
  const heroScene = (S) => !boardScene(S) && S.scene !== 'over';
  function pre() {
    if (!attached || lost) return;
    const S = getState(); if (!S) return;
    const L = layoutFor(meta.width, meta.height);
    const vk = `${cssW()}x${cssH()}|${L.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(S, L, clock + dt);
    const k = snap ? 1 : 1 - Math.exp(-dt * 4.5);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.marks.length = 0;
  }
  function post() {
    if (!attached || lost) return;
    const S = getState(); if (!S) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    setTheme(S.look.board in THEMES ? S.look.board : 'frost'); buildSet(S.look.set === 'dusk' ? 'dusk' : 'classic');
    updatePieces(S, dt, heroScene(S));
    drawMarks(heroScene(S) ? [] : v3.marks, clock);
    updateFall(clock); updatePuff(dt);
    if (wld?.userData.lantern) { const f = 0.92 + 0.08 * Math.sin(clock * 13) * Math.sin(clock * 7.3); wld.userData.lantern.intensity = 900 * f; wld.userData.halo.lookAt(camera.position); wld.userData.halo.material.opacity = 0.5 * f; }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) for (const kk of ['map', 'bumpMap']) if (m[kk]) m[kk].needsUpdate = true; });
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  setTheme('frost'); await tick();
  buildSet('classic'); await building;
  applyTier();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, pieces,
    attach() { attached = true; v3.pt = ptOn; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post, place, cur,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
    restoreContext(ext) { ext?.restoreContext(); },
  };
}
