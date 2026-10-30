// Gamelan 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a gendèr-style metallophone and the gongs in a lamp-lit pendopo. On the playing screens the camera is solved from the
// layout's rack (the bar centres project exactly onto the 2D lanes, so taps, falling notes and the hit test are unchanged); gongs are
// placed on the ray through their layout centre, standing on the floor. Menus show the instrument as a slowly drifting hero.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { TUNINGS } from '../src/music.js';
import { CELL, KEY_Y, GONG_R, materials, buildGender, buildGong, buildGayor, buildKenongBox, buildMallet, buildHall, buildLights, radialTex, numeralTex, warmEnvScene } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const GONG_KIND = { 7: 'kenong', 8: 'kempul', 9: 'gong' };
const WARM = new THREE.Color(0xff9a40), JADE = new THREE.Color(0x5fe0c0);

// Mallet height above the key (cm) after a strike: a quick rebound with a small overshoot, settling at a hover of 6 cm.
export function rebound(since) {
  if (since < 0) return 6;
  return 6 * (1 - Math.exp(-since * 11) * Math.cos(since * 9));
}
// Wind-up before an expected strike, u 0..1 over the last 0.36 s: raise to 10 cm, then come down to the key at u = 1.
export function windup(u) {
  if (u < 0.62) return 6 + 4 * smooth(u / 0.62);
  const k = (u - 0.62) / 0.38; return 10 * (1 - k * k);
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0c0504);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0504);
  scene.fog = new THREE.Fog(0x0c0403, 300, 1050);
  const camera = new THREE.PerspectiveCamera(32, 1, 4, 4000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(warmEnvScene(), 0.03).texture; pm.dispose(); scene.environmentIntensity = 1; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const M = materials();
  const hall = buildHall(scene, M, { quality: tier < 2 ? 1 : 0 });
  await tick();

  // ---------------------------------------------------------------- instruments (cached per bar count), gongs, mallets
  const glowT = radialTex('255,190,110', 1);
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  const gend = new Map();
  function gender(n) {
    let g = gend.get(n);
    if (!g) {
      g = buildGender(n, M);
      for (const k of g.keys) { const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false })); m.position.set(k.x, KEY_Y + 0.6, 0); m.scale.set(16, 1, k.len * 1.25); m.renderOrder = 3; g.group.add(m); k.glow = m; }
      g.group.visible = false; scene.add(g.group); gend.set(n, g);
    }
    return g;
  }
  gender(5); await tick(); gender(7); await tick();
  // live gongs (the player's): kenong in its box, kempul and gong on their stands
  const live = {};
  for (const id of [7, 8, 9]) {
    const kind = GONG_KIND[id], gg = buildGong(kind, M), root = new THREE.Group();
    let stand, pivot = null;
    if (kind === 'kenong') { stand = buildKenongBox(M); root.add(stand.group); gg.group.position.y = stand.topY; root.add(gg.group); }
    else { stand = buildGayor(GONG_R[kind], M); root.add(stand.group); pivot = stand.pivot; gg.group.position.y = stand.hangY - stand.pivot.position.y; pivot.add(gg.group); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
    glow.scale.setScalar(GONG_R[kind] * 3.2); glow.position.y = kind === 'kenong' ? stand.topY + GONG_R.kenong * 0.7 : stand.hangY; root.add(glow);
    root.visible = false; scene.add(root);
    live[id] = { kind, root, gong: gg, pivot, glow, baseY: gg.group.position.y, centerY: kind === 'kenong' ? stand.topY + GONG_R.kenong * 0.62 : stand.hangY, r: GONG_R[kind] };
  }
  await tick();
  // the hall's own ensemble behind the player (decoration): a big gong and a kempul on stands, a kenong row
  const deco = new THREE.Group(); scene.add(deco);
  const dG = (kind, x, z, ry) => { const s = buildGayor(GONG_R[kind], M), g = buildGong(kind, M); g.group.position.y = s.hangY - s.pivot.position.y; s.pivot.add(g.group); s.group.position.set(x, 0, z); s.group.rotation.y = ry; deco.add(s.group); return { pivot: s.pivot, mat: g.mat }; };
  const decoGong = dG('gong', -100, -125, 0.3); dG('kempul', 120, -175, -0.3);
  { const b = buildKenongBox(M), g = buildGong('kenong', M); g.group.position.y = b.topY; b.group.add(g.group); b.group.position.set(-205, 0, -95); b.group.rotation.y = 0.4; deco.add(b.group); }
  const mallets = [buildMallet(M), buildMallet(M)];
  for (const m of mallets) { m.group.visible = false; scene.add(m.group); }
  const shadowT = radialTex('0,0,0', 1);
  const malletShadow = mallets.map(() => { const s = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: shadowT, transparent: true, depthWrite: false, opacity: 0.5 })); s.renderOrder = 2; s.visible = false; scene.add(s); return s; });
  await tick();

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    for (const l of hall.lamps) l.light.visible = tier < 2 || l.group.position.z > -200;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const toCssX = (x) => x * cpu() + offX(), toCssY = (y) => y * cpu() + offY();
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const focal = (fov) => (cssH() / 2) / Math.tan(fov * D2R / 2);
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  // fit a set of world points into a css rectangle (distance + off-axis shift)
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 300 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 7; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  // exact solve for a bar rack: bar centres (equal depth) land on the layout's bar centres
  const BAR_VIEW = { yaw: 0, tilt: 60, fov: 30 };
  function barCam(rack) {
    const items = rack.items.filter((q) => q.kind === 'bar'), n = items.length, a = items[0], b = items[n - 1];
    const spanPx = (b.cx - a.cx) * cpu(), dist = focal(BAR_VIEW.fov) * ((n - 1) * CELL) / Math.max(1, spanPx);
    const px = toCssX((a.cx + b.cx) / 2), py = toCssY(a.cy);
    return { ...BAR_VIEW, tx: 0, ty: KEY_Y, tz: 0, dist, ox: cssW() / 2 - px, oy: cssH() / 2 - py };
  }
  // gong-only rack: the big gong at its real size on its layout circle, the camera low and frontal
  const COLO_VIEW = { yaw: 0, tilt: 14, fov: 30 };
  function coloCam(rack) {
    const g = rack.items.find((q) => q.inst === 9), dist = focal(COLO_VIEW.fov) * GONG_R.gong / Math.max(1, g.r * cpu());
    return { ...COLO_VIEW, tx: 0, ty: live[9].centerY, tz: 0, dist, ox: cssW() / 2 - toCssX(g.cx), oy: cssH() / 2 - toCssY(g.cy) };
  }
  // put a gong so that its centre sits on the ray through the layout point, its stand on the floor, sized to the layout radius
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  function placeGong(g, it) {
    ndc.set((toCssX(it.cx) / cssW()) * 2 - 1, 1 - (toCssY(it.cy) / cssH()) * 2);
    ray.setFromCamera(ndc, camera); camera.getWorldDirection(fwd);
    let s = 1;
    for (let k = 0; k < 6; k++) {
      const yc = g.centerY * s, d = ray.ray.direction; if (Math.abs(d.y) < 1e-4) break;
      const tt = (yc - ray.ray.origin.y) / d.y; if (tt <= 0) break;
      hit.copy(ray.ray.origin).addScaledVector(d, tt);
      const depth = tmp.copy(hit).sub(camera.position).dot(fwd);
      s = clamp((it.r * cpu()) * depth / focal(camera.fov) / g.r * 0.85, 0.15, 4);
    }
    g.root.position.set(hit.x, 0, hit.z); g.root.scale.setScalar(s);
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, clock = 0, viewKey = '', snap = true, F = null;
  const cur = { yaw: 0, tilt: 30, fov: 30, dist: 300, ox: 0, oy: 0, tx: 0, ty: 40, tz: 0 };
  const mal = [0, 1].map(() => ({ x: 0, z: 0, y: 6, vx: 0, vz: 0, qx: 0, qz: 0, inst: -1 }));
  const heroIns = Array.from({ length: 10 }, () => ({ flash: 0, ring: 0, age: 9, ens: false }));
  const heroHand = [{ inst: -1, t: -9 }, { inst: -1, t: -9 }];
  let heroHot = -1, heroTurn = 0;
  // the title's instrument plays a slow phrase by itself, hands alternating
  const PHRASE = [2, 1, 2, 0, 1, 3, 4, 3, 2, 1, 0, 1];
  function stepHero(t, dt) {
    for (const s of heroIns) { s.flash = Math.max(0, s.flash - dt * 5); s.ring = Math.max(0, s.ring - dt * 0.55); s.age += dt; }
    const beat = Math.floor(t * 1.5);
    if (beat !== heroHot) { heroHot = beat; const inst = PHRASE[beat % PHRASE.length]; heroHand[heroTurn] = { inst, t }; heroTurn = 1 - heroTurn; const s = heroIns[inst]; s.flash = 1; s.ring = 1; s.age = 0; }
    const next = (beat + 1) / 1.5;
    return { t, hand: heroHand, hturn: heroTurn, lanes: [0, 1, 2, 3, 4], nd: null, next: { t: next, inst: PHRASE[(beat + 1) % PHRASE.length] } };
  }

  function setKey(k, s, inc, dim, labels, label, t) {
    const shimmer = s.ring > 0.02 ? s.ring * (0.55 + 0.45 * Math.sin(t * TAU * 4.5)) : 0;           // the beating of a paired tuning (ombak)
    const e = Math.max(s.flash * 1.6, shimmer * 0.45, inc * 0.22);
    k.mat.emissive.copy(s.ens ? JADE : WARM); k.mat.emissiveIntensity = e;
    const c = 1 - dim * 0.62; k.mat.color.setRGB(c, c, c);
    k.glow.material.opacity = clamp(s.flash * 0.85 + inc * 0.35 + shimmer * 0.25, 0, 1); k.glow.material.color.copy(s.ens ? JADE : WARM);
    if (labels && label != null) { k.num.visible = true; if (k.num.userData.l !== label) { k.num.material.map = numeralTex(label); k.num.material.needsUpdate = true; k.num.userData.l = label; } k.num.material.opacity = 1 - dim * 0.6; } else k.num.visible = false;
    // the struck key trembles for a moment (a fraction of a millimetre, exaggerated a little so it reads)
    const v = s.age < 0.25 ? Math.sin(s.age * 140) * 0.12 * (1 - s.age / 0.25) : 0;
    k.mesh.position.y = (KEY_Y - 0.7) + v; k.ridge.position.y = KEY_Y + 0.12 + v;
  }
  function setGong(g, s, inc, dim, calm) {
    const ring = s.ring || 0, flash = s.flash || 0, age = s.age ?? 9;
    g.gong.mat.emissive.copy(s.ens ? JADE : WARM); g.gong.mat.emissiveIntensity = Math.max(flash * 1.2, ring * 0.18, inc * 0.2);
    const c = 1 - (dim || 0) * 0.55; g.gong.mat.color.setRGB(c, c, c);
    if (g.glow) g.glow.material.opacity = clamp(flash * 0.7 + inc * 0.3, 0, 1);
    if (g.pivot) { const A = calm ? 0 : 0.07 * Math.min(1, ring + flash * 0.5); g.pivot.rotation.x = A * Math.exp(-age * 0.9) * Math.sin(age * TAU * (g.kind === 'gong' ? 0.55 : 0.8)); }
    else { const b = !calm && age < 0.4 ? Math.sin(age * 60) * 0.25 * (1 - age / 0.4) : 0; g.gong.group.position.y = g.baseY + b; }
  }

  // which bar the next hand is about to strike (perform / auto: the next note on the player's lanes; title: the next phrase note)
  function nextNote(sess) {
    if (sess.next) return sess.next;
    const ev = sess.ev; if (!ev) return null;
    let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t < sess.t - 0.01) lo = m + 1; else hi = m; }
    for (let i = lo; i < ev.length && ev[i].t < sess.t + 0.5; i++) {
      const e = ev[i]; if (e.inst < 0 || e.inst > 6) continue;
      if (e.who === 'note' ? e.j : e.who === 'click' || (e.who === 'ens' && e.on === false)) continue;
      return { t: e.t, inst: e.inst };
    }
    return null;
  }
  function drawMallets(g, sess, dt, calm) {
    const nn = nextNote(sess), t = sess.t, lastT = Math.max(sess.hand[0].t, sess.hand[1].t);
    for (let k = 0; k < 2; k++) {
      const m = mallets[k], hd = sess.hand[k], mm = mal[k], o = mal[1 - k];
      const dir = Math.abs(mm.x - o.x) > 0.5 ? (mm.x > o.x ? 1 : -1) : k === 0 ? 1 : -1;          // the right-hand mallet is the one further right: sticks never cross
      m.group.visible = true;
      const key = hd.inst >= 0 ? g.keys[hd.inst] : null;
      let tx, tz;
      if (key) { tx = key.x + dir * 0.6; tz = key.len * 0.12; } else { tx = dir * CELL * 0.9; tz = 6; }
      let ty = rebound(t - hd.t);
      if (nn && (sess.hturn ?? 0) === k && nn.t > lastT && nn.t - t < 0.36 && g.keys[nn.inst]) {
        const u = 1 - (nn.t - t) / 0.36, nk = g.keys[nn.inst], mv = smooth(u / 0.45);
        tx += (nk.x + dir * 0.6 - tx) * mv; tz += (nk.len * 0.12 - tz) * mv;
        ty = Math.min(ty, windup(u));
      }
      if (calm) ty = Math.max(ty, 2);
      // critically damped spring toward the target (no velocity jumps); sub-stepped so a slow frame stays stable
      const kq = 1 - Math.exp(-dt * 24); mm.qx += (tx - mm.qx) * kq; mm.qz += (tz - mm.qz) * kq;     // a pre-filtered target: the hand eases in, never jerks
      for (let n = 0, h = dt / 2; n < 2; n++) {
        const W = 30;
        mm.vx += (W * W * (mm.qx - mm.x) - 2 * W * mm.vx) * h; mm.vz += (W * W * (mm.qz - mm.z) - 2 * W * mm.vz) * h;
        mm.x += mm.vx * h; mm.z += mm.vz * h;
      }
      mm.y = ty < mm.y ? ty : mm.y + (ty - mm.y) * (1 - Math.exp(-dt * 24)); mm.inst = hd.inst;
      m.group.position.set(mm.x, KEY_Y + 0.55 + mm.y, mm.z);
      m.head.rotation.set(1.0 + mm.y * 0.02, dir * 0.22, 0, 'YXZ');
      const sh = malletShadow[k]; sh.visible = true; const sp = 7 + mm.y * 0.6;
      sh.position.set(mm.x + 1.5, KEY_Y + 0.45, mm.z + 2.5); sh.scale.set(sp, 1, sp * 0.8); sh.material.opacity = 0.45 * (1 - mm.y / 16);
    }
  }

  function framing(state, L) {
    const t = state.t, calm = state.prefs?.calm, drift = calm ? 0 : 1;
    if (state.scene === 'play' && state.pl) {
      const pl = state.pl, bars = pl.piece.rack === 'bars', rack = L.rackFor('play', pl.piece.rack, bars ? pl.piece.tun.n : 3);
      return { kind: bars ? 'bars' : 'colo', rack, cam: bars ? barCam(rack) : coloCam(rack), sess: pl, n: pl.piece.tun.n, tuning: pl.piece.tuning };
    }
    if (state.scene === 'free' && state.free) {
      const f = state.free, rack = L.rackFor('free', 'free', TUNINGS[f.tuning].n);
      return { kind: 'free', rack, cam: barCam(rack), sess: f, n: TUNINGS[f.tuning].n, tuning: f.tuning };
    }
    // title hero / ambient: the 5-key instrument with the hall's gongs behind, slow drift
    const base = { yaw: -14 + 7 * Math.sin(t * TAU / 34) * drift, tilt: 24 + 3 * Math.sin(t * TAU / 23) * drift, fov: 30, tx: 0, ty: KEY_Y * 0.9, tz: 0 };
    const pts = [[-34, KEY_Y + 14, -8], [34, KEY_Y + 14, -8], [-34, 0, 14], [34, 0, 14], [-34, 0, -14], [34, 0, -14]];
    let rc;
    if (state.scene === 'title') {
      const T = L.title, S = L.S, wide = L.mode === 'wide', y0 = T.titleY + T.size * 1.5 + 34;
      const x0 = S.x + 24, x1 = wide ? T.col.x - 24 : S.x + S.w - 24, y1 = wide ? S.y + S.h - 90 : T.play.y - 16;
      rc = { x: toCssX(x0), y: toCssY(y0), w: (x1 - x0) * cpu(), h: Math.max(40, y1 - y0) * cpu() };
    } else {
      const S = L.S; rc = { x: toCssX(S.x + S.w * 0.2), y: toCssY(S.y + S.h * 0.42), w: S.w * 0.6 * cpu(), h: S.h * 0.3 * cpu() };
    }
    return { kind: 'hero', cam: fit(rc, pts, base), sess: null, n: 5, tuning: 'slendro' };
  }

  function pre() {
    if (!game || lost) return;
    const state = game.getState(), L = layoutFor(meta.width, meta.height);
    const vk = `${cssW()}x${cssH()}|${state.scene}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    F = framing(state, L);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const k = snap || F.kind !== 'hero' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(F.cam)) cur[key] += (F.cam[key] - cur[key]) * k;
    snap = false;
    const shake = F.sess && !state.prefs?.calm ? F.sess.shake || 0 : 0;            // the big gong shakes the floor a little
    if (shake > 0.01) { const o = { ...cur, ox: cur.ox + Math.sin(state.t * 90) * shake * 3, oy: cur.oy + Math.cos(state.t * 80) * shake * 2 }; place(camera, o); } else place(camera, cur);
    scene.fog.near = cur.dist * 0.75 + 150; scene.fog.far = scene.fog.near + 800;      // the hall fades into the dark at the same distance behind the subject
  }
  function post() {
    if (!game || lost || !F) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), calm = !!state.prefs?.calm, labels = !!state.prefs?.labels;
    if (state.scene === 'calib') { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    for (const g of gend.values()) g.group.visible = false;
    for (const id of [7, 8, 9]) live[id].root.visible = false;
    for (const m of mallets) m.group.visible = false;
    for (const s of malletShadow) s.visible = false;
    const tun = TUNINGS[F.tuning];
    if (F.kind === 'hero') {
      const hs = stepHero(clock, dt), g = gender(5);
      g.group.visible = true;
      g.keys.forEach((kk, i) => setKey(kk, heroIns[i], 0, 0, false, null, clock));
      drawMallets(g, hs, dt, calm);
      deco.visible = true;
      const gp = Math.max(0, Math.sin(clock * 0.8)) ** 12;
      setGong({ gong: { mat: decoGong.mat }, pivot: decoGong.pivot, kind: 'gong' }, { ring: gp, flash: gp * 0.3, age: ((clock * 0.8 - Math.PI / 2) % TAU + TAU) % TAU / 0.8 }, 0, 0, calm);
    } else {
      const sess = F.sess, isPl = state.scene === 'play', lanes = isPl ? sess.lanes : null;
      const nextIn = new Map();
      if (isPl) for (const inst of sess.lanes) { const arr = sess.nd[inst]; for (let i = sess.np[inst]; i < arr.length && i < sess.np[inst] + 4; i++) { const n = arr[i]; if (n.j) continue; const u = n.t - sess.t; if (u < 0.5 && u > -0.15) nextIn.set(inst, 1 - Math.max(0, u) / 0.5); break; } }
      deco.visible = F.kind === 'bars';
      if (F.kind === 'bars' || F.kind === 'free') {
        const g = gender(F.n); g.group.visible = true;
        g.keys.forEach((kk, i) => setKey(kk, sess.ins[i], nextIn.get(i) || 0, lanes && !lanes.includes(i) ? 0.5 : 0, labels, tun.numerals[i], state.t));
        drawMallets(g, isPl ? sess : { t: sess.t, hand: sess.hand, hturn: sess.hturn }, dt, calm);
      }
      if (F.kind === 'colo' || F.kind === 'free') {
        for (const it of F.rack.items) {
          if (it.kind === 'bar') continue;
          const gg = live[it.inst]; gg.root.visible = true; placeGong(gg, it);
          setGong(gg, sess.ins[it.inst], nextIn.get(it.inst) || 0, lanes && !lanes.includes(it.inst) ? 0.35 : 0, calm);
        }
      }
    }
    // lanterns breathe a little
    for (const l of hall.lamps) { const f = calm ? 1 : 1 + 0.05 * Math.sin(clock * 7.3 + l.ph) + 0.03 * Math.sin(clock * 13.1 + l.ph * 2); l.light.intensity = l.base * f; l.halo.material.opacity = 0.5 * f; }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; });

  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    get mallets() { return mal; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
    project(x, y, z) { const q = toCss(camera, x, y, z); return { x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() }; },
  };
}
