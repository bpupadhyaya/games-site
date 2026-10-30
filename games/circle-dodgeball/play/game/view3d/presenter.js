// 3D presenter for Circle Dodgeball. It only READS game.getState() (the match, the demo match on the title, the event log) and draws the
// court, the people and the balls behind the transparent kit canvas. The kit canvas keeps the HUD, menus and input; this layer hands it
// the camera projection (view.gl) so rings, numbers and taps land on the right pixels, and turns taps back into court units.
// Without WebGL2, with ?nogl, or when the assets are slow (main.js waits at most 1.6 s) the 2D art plays and the 3D layer takes over
// the moment it is ready. Context loss falls back to 2D until the context is restored.
import { layoutFor } from '../src/layout.js';
import { heroAreaOf } from '../src/view.js';
import { VENUES, RIM } from '../src/engine.js';
import { buildScene, SPEC, SPEC_SCALE } from './scene.js';
import { Person } from './people.js';
import { S, wx, wz, hz, cx, cz, clamp } from './world.js';

const LIB = '../vendor3d/index.js';
const TAU = Math.PI * 2;
const BALL_R = 0.135;   // a real 21 cm dodgeball is 0.105 m radius; drawn 1.3x so it reads on a phone
const KIT = {   // team 0 (the player's) in orange, team 1 in blue; shorts the other way round
  0: { top: '#ff8a1c', bottoms: '#1b2230', socks: '#ffd9a0', shoes: '#f4efe4', trim: '#ffe2b8' },
  1: { top: '#2f66ff', bottoms: '#232a3a', socks: '#cfdcff', shoes: '#f4efe4', trim: '#cfe0ff' },
};
const FEMALE = new Set(['Ana', 'Bia', 'Lia', 'Marta', 'Nina', 'Anna', 'Lena', 'Mia', 'Emma', 'Hanna', 'Giulia', 'Sofia', 'Chiara', 'Elena', 'Sara']);
const SKIN = { '#f6d9c0': 'light', '#eec19a': 'light', '#d9a577': 'tan', '#b57d54': 'brown', '#8a5a3a': 'deep' };
const HAIR = { '#2a1a10': 'black', '#5a3a1e': 'brown', '#c9a14a': 'blond', '#1a1a1e': 'black', '#8a3a1e': 'ginger' };
// the instanced crowd round each place (authored metres, as SPEC): rows of people facing the circle, behind the skeleton spectators
const CROWD_ROWS = {
  patio: { culture: 'latin_american', kids: 0.35, rows: [[-16.4, -9, -16.4, 8, 9], [16.4, -9, 16.4, 8, 9], [-12, -14.6, 12, -14.6, 12]] },
  turnhalle: { culture: 'european_village', kids: 0.3, rows: [[-13, -12.9, 13, -12.9, 13], [-15.4, -10, -15.4, 8, 8], [15.4, -10, 15.4, 8, 8]] },
  piazza: { culture: 'mediterranean', kids: 0.2, rows: [[-14.7, -12, -14.7, 6, 9], [14.7, -12, 14.7, 6, 9], [-11, -13.9, 11, -13.9, 12]] },
  praia: { culture: 'latin_american', kids: 0.3, rows: [[-14.2, -9, -14.2, 9, 8], [14.2, -9, 14.2, 9, 8], [-12, -12.6, 12, -12.6, 10]] },
};
const POOL = { f: [0.97, 0.99, 1.0, 0.96, 0.98].map((x) => x * 1.1), m: [1.0, 1.02, 0.98, 1.03, 1.0].map((x) => x * 1.1) };
const POOL_LOOK = { f: [['tan', 'black'], ['light', 'brown'], ['brown', 'black'], ['light', 'blond'], ['deep', 'black']], m: [['brown', 'black'], ['tan', 'brown'], ['light', 'black'], ['tan', 'black'], ['deep', 'black']] };

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false), gl: { on: false } };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, createCrowd3d, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 9, preserveDrawingBuffer: /[?&]shot=/.test(globalThis.location.search) }); } catch (e) { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.setAutoLOD(true);
  const scene = buildScene(stage, THREE, { quality });
  scene.show(0);
  const blobs = quality === 'low' && stage.enableBlobShadows ? stage.enableBlobShadows(12, { radius: 0.42, opacity: 0.8 }) : null;

  const P = { stage, THREE, ready: false, lost: false, licenses: '', gl: { on: false, kind: '', marks: [], licenses: '' } };
  stage.onContextLost(() => { P.lost = true; P.gl.on = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); });

  // ---- the instanced crowd, one per place, built the first time the place is shown ------------------------------------------------------
  const crowds = new Map(); let venueCrowd = null;
  function crowdFor(venueIdx) {
    const id = VENUES[venueIdx].id;
    if (!crowds.has(id)) {
      let c = null;
      try {
        const sp = CROWD_ROWS[id], sc = SPEC_SCALE;
        if (createCrowd3d && sp) c = createCrowd3d(stage, { rows: sp.rows.map(([x0, z0, x1, z1, n]) => ({ from: [x0 * sc, 0, z0 * sc], to: [x1 * sc, 0, z1 * sc], count: n, face: [0, 0, 0] })), seed: 11 + venueIdx * 7, culture: sp.culture, kids: sp.kids, quality: quality === 'low' ? 'low' : 'medium', viewportHeight: 1400 });
      } catch (e) { console.warn('crowd3d', e); }
      if (c) c.group.visible = false;
      crowds.set(id, c);
    }
    return crowds.get(id);
  }
  function showCrowd(venueIdx) {
    for (const c of crowds.values()) if (c) c.group.visible = false;
    venueCrowd = crowdFor(venueIdx);
    if (venueCrowd) { venueCrowd.group.visible = true; venueCrowd.invalidate(); }
  }

  // ---- the pool of players (5 + 5 real skeletons, dressed per match) and the people watching ----------------------------------------------
  const pool = { f: [], m: [] }, crowd = [];
  async function build() {
    const mk = async (c, scale, [skin, hair]) => {
      const h = await loadHuman({ character: c, top: 'long', scale, kit: { ...KIT[0] }, skin, hair, lod: 'medium', quality });
      h.lodAuto = false;   // the light level has no sleeves: players stay at the medium level
      stage.add(h); stage.track(h); h.root.visible = false;
      if (quality === 'low') h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
      return new Person(h);
    };
    const jobs = [];
    for (const g of ['f', 'm']) POOL[g].forEach((sc, i) => jobs.push(mk(g === 'f' ? 'athlete_f' : 'athlete_m', sc, POOL_LOOK[g][i]).then((p) => { p.g = g; pool[g].push(p); })));
    await Promise.all(jobs);
    P.ready = true; stage.invalidate();
  }
  async function buildCrowd() {
    const hs = await Promise.all(Array.from({ length: 6 }, (_, i) => loadHuman({ character: i % 2 ? 'athlete_m' : 'athlete_f', scale: 0.9, lod: 2, kit: { ...KIT[0] }, quality })));
    hs.forEach((h, i) => {
      h.groundClamp = 'auto'; h.footPlanting = false; h.root.visible = false; stage.add(h); stage.track(h);
      crowd.push({ h, mode: '', ph: i * 1.3 });
    });
    if (bound) bindCrowd(bound.venueIdx);
  }
  P.ready_p = build().then(() => { buildCrowd().catch((e) => console.warn('spectators', e)); return true; }).catch((e) => { console.warn('view3d build failed', e); return false; });

  // ---- dust and scuff puffs (soft camera-facing discs that grow and fade) and the ball squash timers -----------------------------------------
  const puffTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.5, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const puffGeo = new THREE.PlaneGeometry(1, 1);
  const puffs = Array.from({ length: 36 }, () => {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.visible = false; m.renderOrder = 6; stage.add(m); return { m, age: 1, life: 1, vy: 0, vx: 0, vz: 0, size: 0, a0: 0 };
  });
  let puffI = 0;
  const squash = [0, 0], prevBz = [0, 0];
  function puff(x, y, z, n, size, color, life, lift = 1) {
    for (let k = 0; k < n; k++) {
      const q = puffs[puffI++ % puffs.length], a = (k / Math.max(1, n)) * TAU + puffI * 1.7;
      q.m.material.color.set(color); q.age = 0; q.life = life * (0.8 + 0.4 * ((k * 37 + puffI * 17) % 10) / 10); q.size = size * (0.8 + 0.4 * ((k * 53) % 7) / 7); q.a0 = 0.5;
      q.vx = Math.cos(a) * 0.5; q.vz = Math.sin(a) * 0.5; q.vy = 0.25 * lift;
      q.m.position.set(x + Math.cos(a) * 0.06, y, z + Math.sin(a) * 0.06); q.m.visible = true;
    }
  }
  function stepPuffs(dt) {
    for (const q of puffs) {
      if (!q.m.visible) continue;
      q.age += dt; const u = q.age / q.life;
      if (u >= 1) { q.m.visible = false; continue; }
      q.m.position.x += q.vx * dt; q.m.position.z += q.vz * dt; q.m.position.y += q.vy * dt;
      const s = q.size * (0.6 + 1.6 * u); q.m.scale.set(s, s, s); q.m.material.opacity = q.a0 * (1 - u) * (1 - u);
      q.m.quaternion.copy(stage.camera.quaternion);
    }
  }

  // ---- ground marks (rings and discs the 2D overlay asks for): in the scene, so people stand in front of them -------------------------------
  const ringGeo = new THREE.RingGeometry(0.88, 1, 64), discGeo = new THREE.CircleGeometry(1, 40);
  const mkMark = (geo) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 4; stage.add(m); return m;
  };
  const rings = Array.from({ length: 22 }, () => mkMark(ringGeo)), discs = Array.from({ length: 4 }, () => mkMark(discGeo));
  const colCache = new Map();
  const css = (str) => {
    let c = colCache.get(str);
    if (c) return c;
    const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?/.exec(str);
    if (m) c = { color: new THREE.Color(`rgb(${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])})`), a: m[4] === undefined ? 1 : +m[4] };
    else c = { color: new THREE.Color(str), a: 1 };
    if (colCache.size > 80) colCache.clear();
    colCache.set(str, c);
    return c;
  };

  // ---- adaptive quality: shadows go first, then the pixel ratio -----------------------------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 24 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false;
        else if (perfLevel === 2) stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        else stage.renderer.setPixelRatio(1);
        stage.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
        stage.invalidate();
      }
    }
  }

  // ---- camera: the whole circle (rim players and their heads included) fitted into the box the 2D layout gives it ------------------------------
  const map = { k: 1, left: 0, top: 0, cw: 720, ch: 1280 };
  const proj = V();
  const FOOT = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r = (RIM + 24) / S; FOOT.push(V(Math.cos(a) * r, 0, Math.sin(a) * r)); if (Math.sin(a) > 0.2) FOOT.push(V(Math.cos(a) * r, 1.95, Math.sin(a) * r)); }
  let pitchOverride = 0, zoomOverride = 0;
  try { const q = new URLSearchParams(globalThis.location.search); if (q.has('pitch')) pitchOverride = +q.get('pitch'); if (q.has('zoom')) zoomOverride = +q.get('zoom'); } catch { /* ignore */ }
  const toPx = (v) => { proj.copy(v).project(stage.camera); return { x: (proj.x * 0.5 + 0.5) * map.cw, y: (-proj.y * 0.5 + 0.5) * map.ch }; };

  function placeCamera(region, shakeX = 0) {
    const c = stage.camera;
    const bw = region.bw * map.k, bh = region.bh * map.k;
    const wantX = map.left + region.cx * map.k + shakeX * map.k, wantY = map.top + region.cy * map.k;
    const pitch = (pitchOverride || 42) * Math.PI / 180;
    c.fov = 26; c.aspect = map.cw / map.ch; c.clearViewOffset(); c.updateProjectionMatrix();
    let d = 60;
    const place = () => {
      c.position.set(0, d * Math.sin(pitch), d * Math.cos(pitch)); c.lookAt(0, 0.5, 0);
      c.near = Math.max(1, d * 0.3); c.far = d + 260; c.updateProjectionMatrix(); c.updateMatrixWorld(true);
    };
    const bbox = () => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const v of FOOT) { const p = toPx(v); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      return { x0, x1, y0, y1 };
    };
    for (let i = 0; i < 5; i++) {
      place(); const b = bbox();
      const r = Math.max((b.x1 - b.x0) / bw, (b.y1 - b.y0) / bh);
      d = clamp(d * r / (zoomOverride || 1), 8, 140);
    }
    place(); const b = bbox();
    if (stage.scene.fog) { stage.scene.fog.near = d * 1.5; stage.scene.fog.far = d * 4.6; }
    // slide the picture so the circle is centred in its box
    c.setViewOffset(map.cw, map.ch, (b.x0 + b.x1) / 2 - wantX, (b.y0 + b.y1) / 2 - wantY, map.cw, map.ch); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  }

  // ---- binding a simulated match to the pool ------------------------------------------------------------------------------------------------
  let bound = null, byId = [], lastEv = 0;
  const rel = [null, null];            // per ball: the offset between the hand and the simulated ball at release, easing away
  const holding = [null, null];        // per ball: the Person whose hand carries the mesh
  const release = (i) => {
    const mesh = scene.balls[i].mesh;
    if (holding[i]) { holding[i].h.detach(mesh); holding[i] = null; }
    if (mesh.parent !== scene.root) scene.root.add(mesh);
  };
  function bind(w) {
    bound = w; byId = []; lastEv = w.evN | 0;
    const free = { f: [...pool.f], m: [...pool.m] };
    for (const q of [...pool.f, ...pool.m]) { q.h.root.visible = false; q.pid = -1; q.wind = false; q.busyUntil = 0; q.yaw = null; q.gait = null; q.t = 0; q.prev.hit = 0; q.prev.catch = 0; q.bendUntil = 0; q.vx = q.vz = q.vs = 0; q.heading = null; q.scuffT = -9; q.h.setReach('L', null); q.h.setReach('R', null); q.setBend(0, 0); }
    for (let i = 0; i < 2; i++) { release(i); rel[i] = null; scene.balls[i].mesh.visible = false; scene.balls[i].shadow.visible = false; }
    for (const p of w.ps) {
      const g = FEMALE.has(p.name) ? 'f' : 'm';
      const pr = free[g].shift() ?? free[g === 'f' ? 'm' : 'f'].shift();
      if (!pr) continue;
      pr.pid = p.id; byId[p.id] = pr;
      pr.h.setKit(KIT[p.orig]);
      pr.h.setSkin(SKIN[p.skin] ?? 'tan'); pr.h.setHair(HAIR[p.hair] ?? 'black');
      pr.h.root.visible = true;
      pr.place(wx(p.x), wz(p.y));
      pr.setFacing(Math.atan2(Math.cos(p.a), Math.sin(p.a)), true);
      pr.h.play('ready_stance', { fade: 0 });
    }
    // the people on the sidelines
    bindCrowd(w.venueIdx);
    showCrowd(w.venueIdx);
  }
  function bindCrowd(venueIdx) {
    const sp = SPEC[VENUES[venueIdx].id] || [];
    crowd.forEach((c, i) => {
      const s = sp[i]; if (!s) { c.h.root.visible = false; return; }
      c.h.setKit({ top: s[4], bottoms: '#3a4a6a', socks: '#f2f2f2' }); c.h.setSkin(s[5]); c.h.setHair(s[6]);
      c.h.setPosition(s[0] * SPEC_SCALE, 0, s[1] * SPEC_SCALE); c.h.setFacing(Math.atan2(-s[0], -s[1]), { snap: true });
      c.h.root.scale.setScalar(s[2]); c.h.root.visible = true; c.mode = ''; c.h.play(i % 2 ? 'idle_relaxed' : 'idle', { fade: 0, startTime: i * 0.37 });
    });
    stage.invalidate();
  }

  // the world point where a held ball sits (at the chest, in front)
  const chestPt = (pr, out = V()) => out.set(pr.x + Math.sin(pr.yaw ?? 0) * 0.36, 1.1, pr.z + Math.cos(pr.yaw ?? 0) * 0.36);
  const handOf = (pr, out = V()) => pr.h.bonePosition('R_Hand', out);

  // ---- arm smoothing: clip changes and the abrupt end of a throw's swing would pop the arms; a short critically damped filter on the
  // upper arm / forearm rotations (time constant 30 ms) rounds those single-frame velocity jumps without changing the pose that is held
  const ARM = ['Bip01_L_UpperArm', 'Bip01_R_UpperArm', 'Bip01_L_Forearm', 'Bip01_R_Forearm'];
  const smoothArms = (dt) => {
    const k = dt > 0 ? 1 - Math.exp(-dt / 0.03) : 1;
    for (const pr of [...pool.f, ...pool.m]) {
      if (!pr.h.root.visible) { pr.sq = null; continue; }
      if (!pr.sq || dt <= 0) pr.sq = ARM.map((n) => pr.h.bones[n].quaternion.clone());
      else ARM.forEach((n, i) => { const b = pr.h.bones[n]; pr.sq[i].slerp(b.quaternion, k); b.quaternion.copy(pr.sq[i]); });
      pr.h.limbSanity?.();
    }
  };
  const step = (dt) => { stage.update(dt, { renderNow: false }); smoothArms(dt); };

  // ---- one frame of the match --------------------------------------------------------------------------------------------------------------
  let cheerUntil = 0;
  function director(t, w, dt) {
    const done = w.phase === 'over';
    const winTeam = w.done === 'won' ? 0 : w.done === 'lost' ? 1 : -1;
    const balls = w.balls;
    // ---- events: bodies react (the 2D overlay shows the words and sparks)
    for (const e of w.events) {
      if (e.n <= lastEv) continue;
      lastEv = e.n;
      const pr = e.p !== undefined && e.p !== null && e.p >= 0 ? byId[e.p] : null;
      if (e.kind === 'hit' && pr) { puff(pr.x, 0.9, pr.z, 5, 0.22, '#fff6e0', 0.5, 1.4); squash[0] = squash[1] = 0.16; }
      if (e.kind === 'throw' || e.kind === 'pass') {
        if (pr) {
          pr.wind = false;
          // the ball leaves the hand: it starts there and eases onto the simulated flight within a quarter second
          const bi = balls.findIndex((b) => b.thrower === e.p && b.holder === null && b.age < 0.3);
          if (bi >= 0 && bi < 2) {
            const b = balls[bi], hand = handOf(pr);
            release(bi);
            rel[bi] = { off: hand.sub(V(wx(b.x), hz(b.z) + BALL_R, wz(b.y))), age: 0 };
          }
        }
      } else if (e.kind === 'hit') {
        if (pr) pr.once('hit', { fade: 0.05, dur: 0.5 });
        cheerUntil = t + 2.2; if (venueCrowd) venueCrowd.react('cheer', { intensity: 0.8 });
      } else if (e.kind === 'burn' && e.how === 'catch') {
        if (pr) pr.once('hit', { fade: 0.05, dur: 0.5 });
      } else if (e.kind === 'catch') {
        cheerUntil = t + 2.2; if (venueCrowd) venueCrowd.react('cheer', { intensity: 1 });
      } else if (e.kind === 'pickup') {
        if (pr) { pr.setBend(0.85, 0.06); pr.bendUntil = pr.t + 0.35; }
      } else if (e.kind === 'end') { cheerUntil = t + 5; if (venueCrowd) venueCrowd.react(w.done === 'won' ? 'ovation' : 'groan', { intensity: 1 }); }
    }
    // ---- the balls: where each one is drawn (before the players, whose hands reach for it)
    const ballW = [];
    balls.forEach((b, i) => {
      if (i > 1) return;
      const w3 = V(wx(b.x), hz(b.z) + BALL_R, wz(b.y));
      if (rel[i] && b.holder === null) { rel[i].age += dt; w3.addScaledVector(rel[i].off, Math.exp(-rel[i].age * 8)); if (rel[i].age > 1) rel[i] = null; }
      else if (b.holder !== null) rel[i] = null;
      ballW[i] = w3;
    });
    // ---- the people
    const threats = balls.filter((b) => b.live && b.holder === null);
    for (const p of w.ps) {
      const pr = byId[p.id]; if (!pr) continue;
      pr.update(dt);
      // the displayed position follows the simulated one along a speed-limited path (a revived player glides in at a run, never teleports);
      // the legs are driven by the distance actually travelled on screen, and the body turns toward the way it actually moves
      const tx0 = wx(p.x), tz0 = wz(p.y);
      let x = tx0, z = tz0;
      const ex = tx0 - pr.x, ez = tz0 - pr.z, ed = Math.hypot(ex, ez), maxStep = 8.5 * dt;
      if (dt > 0 && ed > maxStep && ed > 0.3) { x = pr.x + ex / ed * maxStep; z = pr.z + ez / ed * maxStep; }
      if (dt > 0) {
        const mvx = (x - pr.x) / dt, mvz = (z - pr.z) / dt, k = 1 - Math.exp(-dt / 0.06);
        pr.vx += (mvx - pr.vx) * k; pr.vz += (mvz - pr.vz) * k;
        const nv = Math.hypot(pr.vx, pr.vz), dec = (pr.vs - nv) / dt;
        // shoes scuff the floor on a hard stop or a sharp turn from a run
        if (pr.vs > 2.4 && dec > 16 && pr.t - pr.scuffT > 0.45) { pr.scuffT = pr.t; puff(x, 0.04, z, 3, 0.16, '#e8e2d4', 0.45, 0.9); }
        pr.vs = nv;
      }
      pr.place(x, z);
      const speed = pr.vs;
      // facing: the way he runs (actual velocity), the aim while winding up a throw, the incoming ball while catching, else the sim's facing
      if (pr.vs > 0.7) pr.heading = Math.atan2(pr.vx, pr.vz);
      let yaw = pr.vs > 0.25 && pr.heading !== null ? pr.heading : Math.atan2(Math.cos(p.a), Math.sin(p.a));   // a turn-around keeps its heading while the speed passes through zero
      if (p.windT > 0 && p.aim) yaw = Math.atan2(Math.cos(p.a), Math.sin(p.a));
      if (p.catchT > 0 && threats.length) {
        let bd = 1e9, tb = null;
        for (const b of threats) if (b.team !== p.team) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; tb = b; } }
        if (tb && bd < 520) yaw = Math.atan2(wx(tb.x) - x, wz(tb.y) - z);
      }
      pr.setFacing(yaw, pr.yaw === null);
      // wind-up: the throw clip is timed so that its release is the simulated release
      if (p.windT > 0 && p.aim && !pr.wind) {
        pr.wind = true;
        pr.throwIn(p.aim.kind === 'pass' ? 'toss_underarm' : 'throw_overarm', p.windT, dt);
      }
      if (p.windT <= 0 && pr.wind && p.ball === null) pr.wind = false;
      // catch stance: the target follows the incoming ball (kept within arm's reach)
      if (p.catchT > 0) {
        if (pr.prev.catch <= 0) pr.catchIn(Math.min(0.32, p.catchT * 0.7), dt);
        let tx = x + Math.sin(yaw) * 0.55, ty = 1.2, tz = z + Math.cos(yaw) * 0.55;
        for (const b of threats) {
          if (b.team === p.team) continue;
          const bx = wx(b.x), bz = wz(b.y), by = hz(b.z) + BALL_R;
          if (Math.hypot(bx - x, bz - z) < 5.5) { const dx = bx - x, dy = by - 1.15, dz = bz - z, l = Math.hypot(dx, dy, dz) || 1, m = Math.min(l, 0.8); tx = x + dx / l * m; ty = 1.15 + dy / l * m; tz = z + dz / l * m; break; }
        }
        pr.h.setTarget('catch', V(tx, clamp(ty, 0.7, 1.7), tz));
      }
      pr.prev.catch = p.catchT; pr.prev.hit = p.hitT;
      if (pr.bendW > 0 && pr.t > pr.bendUntil) pr.setBend(0, 0.2);   // the scoop eases back up
      // the body
      if (pr.busy) { /* a one-shot (throw, catch, hit) owns the legs for a moment */ }
      else if (done) {
        const mine = winTeam >= 0 && p.orig === winTeam;
        if (mine) { pr.gait = null; pr.h.ensure(p.id % 2 ? 'celebrate_2' : 'cheer', { fade: 0.25, loop: true }); }
        else pr.still(winTeam >= 0 ? 'crouch_idle' : 'idle_relaxed');
      } else if (p.stun > 0) pr.still('crouch_idle');
      else if (speed > 0.35) pr.run(speed);
      else pr.still('ready_stance');
    }
    // ---- who carries which ball: at the chest, or in the hand through the wind-up
    balls.forEach((b, i) => {
      if (i > 1) return;
      const bo = scene.balls[i], mesh = bo.mesh, owner = b.holder !== null ? byId[b.holder] : null;
      mesh.visible = true;
      if (b.holder === null && prevBz[i] > 5 && b.z <= 2.5 && Math.hypot(b.vx, b.vy) > 40) { squash[i] = 0.14; puff(wx(b.x), 0.03, wz(b.y), 4, 0.2, '#e0d8c6', 0.5, 0.6); }
      prevBz[i] = b.z;
      if (owner) {
        if (owner.wind) {
          if (holding[i] !== owner) { release(i); owner.h.attach(mesh, 'R', 'ball'); holding[i] = owner; }
          owner.reachBoth(null, 0);
        } else {
          release(i);
          const pt = chestPt(owner), cur = owner.h.layers.base.current;
          owner.reachBoth(pt, owner.busy && cur && /catch|hit/.test(cur.clip.name) ? 0 : 1, 0.15);
          mesh.position.copy(pt);
        }
      } else {
        release(i);
        mesh.position.copy(ballW[i]);
        const sp = Math.hypot(b.vx, b.vy) / S;
        if (sp > 0.05) {   // roll / spin about the axis across the direction of travel
          const ax = V(b.vy, 0, -b.vx).normalize(), q = new THREE.Quaternion().setFromAxisAngle(ax, (sp / BALL_R) * dt * (b.live ? 0.5 : 1));
          mesh.quaternion.premultiply(q);
        }
      }
      // a rubber ball squashes along the floor normal for a moment on contact and springs back
      if (squash[i] > 0) {
        squash[i] = Math.max(0, squash[i] - dt);
        const k = Math.sin((squash[i] / 0.16) * Math.PI) * 0.22;
        const up = V(0, 1, 0).applyQuaternion(mesh.quaternion.clone().invert());
        mesh.scale.set(1 + 0.5 * k - k * 1.5 * up.x * up.x, 1 + 0.5 * k - k * 1.5 * up.y * up.y, 1 + 0.5 * k - k * 1.5 * up.z * up.z);
      } else if (mesh.scale.x !== 1) mesh.scale.set(1, 1, 1);
      // shadow disc on the floor
      const sh = bo.shadow, ph = holding[i] ? handOf(holding[i]) : mesh.position, hgt = Math.max(0, ph.y - BALL_R);
      sh.visible = true; sh.position.set(ph.x, 0.012, ph.z); const s2 = 1 + hgt * 0.25; sh.scale.set(s2, s2, 1); sh.material.opacity = clamp(0.4 - hgt * 0.1, 0.08, 0.4);
    });
    for (let i = balls.length; i < 2; i++) { scene.balls[i].mesh.visible = false; scene.balls[i].shadow.visible = false; }
    if (blobs) { let bi = 0; for (const p of w.ps) { const pr = byId[p.id]; if (pr) blobs.set(bi++, pr.x, pr.z, 0.42, 0.012); } blobs.mesh.count = bi; }
    stepPuffs(dt);
    // ---- the crowd: a cheer when something happens, otherwise they watch and clap now and then
    crowd.forEach((c) => {
      if (!c.h.root.visible) return;
      const want = t < cheerUntil ? (c.ph > 2.2 ? 'clap' : 'cheer') : ((t + c.ph * 3) % 13 < 3 ? 'clap' : (c.ph > 2.5 ? 'idle_relaxed' : 'idle'));
      if (c.mode !== want) { c.mode = want; c.h.play(want, { fade: 0.3, loop: true }); }
    });
  }

  // ---- the ground marks the overlay asked for last frame ------------------------------------------------------------------------------------
  function drawMarks(list) {
    let ri = 0, di = 0;
    for (const m of list) {
      const c = css(m.col), obj = m.fill ? discs[di++] : rings[ri++];
      if (!obj) continue;
      obj.visible = true; obj.position.set(wx(m.x), 0.03 + 0.004 * (ri + di), wz(m.y));
      const r = m.r / S; obj.scale.set(r, r, r);
      obj.material.color.copy(c.color); obj.material.opacity = c.a;
    }
    for (; ri < rings.length; ri++) rings[ri].visible = false;
    for (; di < discs.length; di++) discs[di].visible = false;
  }

  // ---- venue snapshots: one still of each place for the "choose a place" cards ----------------------------------------------------------------
  const snaps = new Map();   // key -> canvas
  const wanted = new Map();  // key -> { i, role, w }
  P.gl.snapshot = (i, role, w) => {
    const key = `${i}:${role}`;
    const s = snaps.get(key);
    if (s) return s;
    if (w && !wanted.has(key)) wanted.set(key, { i, role, w });
    return null;
  };
  let lastW = null, lastWt = 0, settle = 0;
  function measure(view) {
    const Wv = view?.width ?? kitCanvas.width;
    const rect = kitCanvas.getBoundingClientRect();
    const cw = kitCanvas.clientWidth || canvas.clientWidth || globalThis.innerWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || globalThis.innerHeight || 1280;
    if (cw !== map.cw || ch !== map.ch) { map.cw = cw; map.ch = ch; stage.resize(); }
    map.k = rect.width / (Wv || 720); map.left = rect.left; map.top = rect.top;
  }
  function takeSnapshot(view) {
    const [key, it] = wanted.entries().next().value;
    wanted.delete(key);
    const Wv = view?.width ?? kitCanvas.width, Hv = view?.height ?? kitCanvas.height, w = it.w;
    measure(view);
    scene.show(w.venueIdx);
    bind(w);
    const bwv = Math.min(Wv * 0.92, (Hv * 0.92) / 0.86), region = { cx: Wv / 2, cy: Hv / 2, bw: bwv, bh: bwv * 0.86 };
    stage.setVisible(true);
    placeCamera(region, 0);
    stage.setShadowTarget(0, 0, 0);
    for (let k = 0; k < 14; k++) { director(0, w, k === 0 ? 0 : 1 / 30); step(k === 0 ? 0 : 1 / 30); }   // everyone settles into the stance the simulation put them in
    stage.render();
    const pr = canvas.width / Math.max(1, map.cw);
    const sx = (map.left + (region.cx - region.bw / 2) * map.k) * pr, sy = (map.top + (region.cy - region.bh / 2) * map.k) * pr, sw = region.bw * map.k * pr, sh = region.bh * map.k * pr;
    const out = globalThis.document.createElement('canvas');
    out.width = Math.min(640, Math.round(sw)); out.height = Math.round((out.width * sh) / sw);
    out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    snaps.set(key, out);
    stage.setVisible(false);
    bound = null; lastW = null;
  }

  // ---- per-frame ------------------------------------------------------------------------------------------------------------------------------
  function frame(game, view) {
    const gl = P.gl;
    if (!P.ready || P.lost) { gl.on = false; return; }
    const G = game.getState(), sc = G.scene;
    const Wv = view?.width ?? kitCanvas.width, Hv = view?.height ?? kitCanvas.height;
    let w = null, region = null;
    if (sc === 'title' && G.titleWorld && G.titleWorld.w) {
      const hr = heroAreaOf(layoutFor(Wv, Hv)).heroArea;
      w = G.titleWorld.w; region = { cx: hr.x + hr.w / 2, cy: hr.y + hr.h / 2, bw: hr.w, bh: hr.h, kind: 'title' };
    } else if ((sc === 'play' || sc === 'result') && G.pl && G.pl.w) {
      const A = layoutFor(Wv, Hv).play.arena;
      w = G.pl.w; region = { cx: A.x + A.w / 2, cy: A.y + A.h / 2, bw: A.w, bh: A.h, kind: 'play' };
    }
    if (!w || !region) {
      gl.on = false; gl.marks.length = 0;
      if (sc === 'venues' && wanted.size) takeSnapshot(view); else stage.setVisible(false);
      return;
    }
    const now = globalThis.performance.now();
    measure(view);
    stage.setVisible(true);

    if (w !== bound) { scene.show(w.venueIdx); bind(w); lastW = null; settle = 14; }
    // animation clock: the match clock, so everything freezes with the match (pause, the coach's think time) and is reproducible
    let dt = lastW === null ? 0 : w.t - lastWt;
    lastW = w; lastWt = w.t;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);

    const shake = sc === 'play' && G.pl && G.pl.shake > 0 && !G.prefs.calm ? Math.sin(G.pl.shake * 70) * G.pl.shake * 7 : 0;
    placeCamera(region, shake);
    stage.setShadowTarget(0, 0, 0);
    drawMarks(gl.marks);        // what the 2D overlay asked for in the last render
    gl.marks.length = 0;
    if (settle > 0) { for (let i = 0; i < settle; i++) { director(G.t, w, i === 0 ? 0 : 1 / 30); step(i === 0 ? 0 : 1 / 30); } settle = 0; }
    else director(G.t, w, dt);

    // ---- the projection handed to the HUD and to the pointer mapping (the camera is fixed for this frame)
    gl.on = true; gl.kind = region.kind; gl.region = region; gl.licenses = P.licenses;
    gl.project = (X, Y, hu = 0) => { const p = toPx(V(wx(X), hz(hu), wz(Y))); return { x: (p.x - map.left) / map.k, y: (p.y - map.top) / map.k }; };
    const ray = V(), ray2 = V();
    gl.toCourt = (vx, vy) => {
      const nx = ((map.left + vx * map.k) / map.cw) * 2 - 1, ny = -(((map.top + vy * map.k) / map.ch) * 2 - 1);
      ray.set(nx, ny, -1).unproject(stage.camera); ray2.set(nx, ny, 1).unproject(stage.camera);
      const t = ray.y / (ray.y - ray2.y);
      return { x: cx(ray.x + (ray2.x - ray.x) * t), y: cz(ray.z + (ray2.z - ray.z) * t) };
    };
    gl.scaleAt = (X, Y) => { const a = gl.project(X, Y), b = gl.project(X + 40, Y); return Math.hypot(b.x - a.x, b.y - a.y) / 40; };   // virtual px per court unit
    // one skeleton update per frame, AFTER the director has set every clip, reach and target and BEFORE props are read from bones and rendered
    step(dt);
    if (venueCrowd) venueCrowd.update(dt);
    if (!P.noRender) { stage.render(); perfTick(now); }
  }
  P.frame = frame;
  P.debug = () => ({ byId, scene, holding, bound });   // read-only peek for the measurement scripts

  // the credits text for the About page
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { P.licenses = t; P.gl.licenses = t; }).catch(() => {}); } catch { /* ignore */ }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { frame(game, view); if (view) view.gl = P.gl; r(ctx, view); };
    return game;
  };
  return P;
}
