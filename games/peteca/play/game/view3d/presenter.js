// The 3D presenter for Peteca. It READS the game state (the run, the attract rally, the effects list) and never writes back.
//
// A WebGL canvas sits behind the transparent kit canvas: the beach (scenery3d + props), the court and net, four real athletes (view3d), the
// peteca with trail and shadow, the crowd (crowd3d), sand spray and footprints. The kit canvas keeps the HUD, menus and input.
// Without WebGL, or while the context is lost, FX.gl.active is false and the 2D scene in art.js / view.js / figure.js draws instead.
//
// Camera: a perspective camera solved so that the point (camX, 0, 0) lands exactly where the 2D layout expects the court ground line, at the
// same pixels-per-metre; the 2D overlays (floating words, the gauge, the marker above you) use the same projection (P.cam.pr).
import { predictAt, NET } from '../src/sim.js';
import { FX, PETECAS } from '../src/art.js';
import { meta } from '../src/layout.js';
import { createAthleteKit, BALL_DELAY } from './athlete.js';
import { buildWorld, halo } from './world.js';
import { createPeteca, createTrail, createParticles, hex } from './fx3d.js';
import { LOOKS } from '../src/figure.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const mid = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'low' : mid ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, ready: Promise.resolve(false), wrap: (g) => g };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, THREE, loadHuman, createCrowd3d } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 7.5, autoLOD: false });
  if (!stage.supported || !stage.renderer) { canvas.remove(); return none; }
  stage.scene.fog = null; stage.scene.background = new THREE.Color('#9fd0f2');

  const { Athlete } = createAthleteKit(V3);
  const P = { dbg: /[?&]dbg=1/.test(location.search), stage, THREE, ready: false, quality, tier: quality, active: false, lost: false, courtId: -1, humans: null };
  FX.gl = P;

  function setLights(style) {
    stage.setLighting('day', { hemiSky: style.hemiSky, hemiGround: style.hemiGround, hemi: style.hemi, key: style.key, keyI: style.keyI, rim: style.rim, rimI: style.rimI, exposure: style.exposure });
    stage.scene.fog = null;
    stage._shadowOffset.set(-5.5, 9.5, 7);
    stage.setShadowTarget(0, 0, 0);
  }

  // ---- shared objects ----
  const particles = createParticles(560); stage.add(particles.points);
  const trail = createTrail(22); stage.add(trail.mesh);
  const peteca = createPeteca(PETECAS[0]); stage.add(peteca);
  let petecaDesign = 0;
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(20,12,4,0.85)'); gr.addColorStop(1, 'rgba(20,12,4,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const blobMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat); ballShadow.rotation.x = -Math.PI / 2; ballShadow.renderOrder = 2; stage.add(ballShadow);
  const ringGeo = new THREE.RingGeometry(0.82, 1, 48); ringGeo.rotateX(-Math.PI / 2);
  const mkRing = (color) => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; m.renderOrder = 4; stage.add(m); return m; };
  const landRing = mkRing('#ffffff'), thinkRing = mkRing('#ffe36a');
  const guideHalo = halo('#ffd23c', 0.9); guideHalo.visible = false; stage.add(guideHalo);

  // ---- athletes (one human per look) ----
  const humans = new Map();           // look -> { h, ath }
  P.humans = humans;
  const loading = new Set();
  async function loadLook(i) {
    if (humans.has(i) || loading.has(i)) return;
    loading.add(i);
    try {
      const L = LOOKS[i];
      const h = await loadHuman({ character: L.fem ? 'athlete_f' : 'athlete_m', kit: { top: L.shirt, bottoms: L.shorts, socks: '#f4f4f0' }, skin: L.skin, hair: L.hair });
      h.setFingers('L', 'relaxed'); h.setFingers('R', 'relaxed');
      stage.add(h);
      h.root.visible = false;
      h.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
      const ent = { h, ath: new Athlete(h, i), hooked: false, wasAir: false };
      ent.h.on('footL', () => footFx(ent, 'L')); ent.h.on('footR', () => footFx(ent, 'R'));
      humans.set(i, ent);
    } catch (e) { console.warn('player load failed', i, e); } finally { loading.delete(i); }
  }

  // ---- world + crowd per court ----
  let world = null, crowd = null;
  function disposeWorld() {
    if (crowd) { try { crowd.dispose(); } catch { /* ignore */ } crowd = null; }
    if (world) { stage.scene.remove(world.group); try { world.scenery && world.scenery.dispose(); } catch { /* ignore */ } world = null; }
  }
  function buildCourt(id) {
    disposeWorld();
    P.courtId = id;
    world = buildWorld({ courtId: id, quality: P.tier, wind: 0.6 });
    stage.scene.add(world.group);
    P.world = world;
    setLights(world.style);
    try {
      const q = P.tier;
      const cult = id === 1 ? ['latin_american', 'mediterranean'] : ['latin_american', 'mediterranean', 'african'];
      const avoid = (x, z) => (Math.abs(x + 8.5) < 1.3 && Math.abs(z + 5) < 1.2) || (Math.abs(x - 8.8) < 1.3 && Math.abs(z + 5.6) < 1.2);
      crowd = createCrowd3d(stage, {
        free: { area: [-13, -13, 13, -7.2], y: 0, count: 40, walkers: 0.18, walkDir: [1, 0, 0], walkLength: 16, avoid, face: [0, 1.3, 4] },
        count: q === 'high' ? 22 : q === 'medium' ? 15 : 8, seed: 41 + id, culture: cult, quality: q,
        excitement: 0.25, props: { phone: id === 2 ? 0.2 : 0.08, flag: 0.03, child: 0.06 }, flagColors: ['#1fa84a', '#f6cf55', '#2a62d9'],
      });
      P.crowd = crowd;
    } catch (e) { console.warn('crowd3d failed', e); crowd = null; }
    stage.invalidate();
  }

  // ---- context loss: the 2D scene takes over until the context is back (environment is rebuilt by the stage) ----
  stage.onContextLost(() => { P.lost = true; P.active = false; });
  stage.onContextRestored(() => { P.lost = false; P.active = P.ready; stage.invalidate(); });

  // ---- camera ----
  const cam = stage.camera;
  const proj = new THREE.Vector3();
  P.cam = null;
  P.solve = function solve(c2, { yaw = -9, pitch = 7, fov = 28, camX = null, zoom = 1 } = {}) {
    const W = meta.width || 720, H = meta.height || 1280;
    const s = c2.s * zoom, cx3 = camX ?? c2.camX;
    const fpx = (H / 2) / Math.tan((fov * D2R) / 2);
    const dist = fpx / s;
    const yw = yaw * D2R, pt = pitch * D2R;
    const px = cx3 - 6;
    cam.position.set(px + Math.sin(yw) * Math.cos(pt) * dist, Math.sin(pt) * dist, Math.cos(yw) * Math.cos(pt) * dist);
    cam.up.set(0, 1, 0); cam.lookAt(px, 0, 0);
    cam.fov = fov; cam.aspect = W / H; cam.near = Math.max(1, dist - 28); cam.far = dist + 520;
    cam.setViewOffset(W, H, -(c2.cx - W / 2), -(c2.gy - H / 2), W, H);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const pr = (x, y = 0, z = 0) => { proj.set(x - 6, y, z).project(cam); return [(proj.x * 0.5 + 0.5) * W, (-proj.y * 0.5 + 0.5) * H]; };
    P.cam = { W, H, s, gy: c2.gy, cx: c2.cx, camX: cx3, pr, dist, fov };
    const pxPerUnit = (canvas.height || H) / (2 * Math.tan((fov * D2R) / 2));
    particles.setScale(pxPerUnit);
    P.focusX = px;
    return P.cam;
  };

  // ---- run display state ----
  const R = { run: null, buf: [], snapped: false, lastEv: -1 };
  function ballAt(tShow) {
    const b = R.buf;
    if (!b.length) return null;
    if (tShow <= b[0].t) return b[0];
    for (let i = b.length - 1; i >= 0; i--) {
      if (b[i].t <= tShow) {
        const a = b[i], c = b[Math.min(b.length - 1, i + 1)];
        if (c === a || c.t === a.t) return a;
        if (a.alive !== c.alive || a.held !== c.held || Math.abs(c.vz - a.vz) > 6 || Math.abs(c.vx - a.vx) > 6) return a;
        const u = (tShow - a.t) / (c.t - a.t);
        return { ...a, x: lerp(a.x, c.x, u), z: lerp(a.z, c.z, u), vx: lerp(a.vx, c.vx, u), vz: lerp(a.vz, c.vz, u) };
      }
    }
    return b[0];
  }

  const tmpV = new THREE.Vector3();
  let tPrevSim = null, clockReal = performance.now(), simT = 0, frameMs = 16, slowCount = 0;

  function footFx(ent, side) {
    const ath = ent.ath, h = ent.h, sp = ath.speed;
    if (sp < 1.6 || !h.root.visible) return;
    const leg = h.legs.find((l) => l.side === side); if (!leg) return;
    leg.foot.getWorldPosition(tmpV);
    const n = sp > 4 ? 3 : 2, back = -Math.sign(ath.vel || 1);
    for (let i = 0; i < n; i++) particles.spawn({ kind: 0, x: tmpV.x + (Math.random() - 0.5) * 0.1, y: 0.03, z: tmpV.z + (Math.random() - 0.5) * 0.1, vx: back * (0.4 + Math.random() * 0.9) * (sp / 4), vy: 0.5 + Math.random() * 0.9, vz: (Math.random() - 0.5) * 0.5, g: 5.5, drag: 1.6, max: 0.5 + Math.random() * 0.3, size: 0.06 + Math.random() * 0.05, grow: 1.4, col: [0.93, 0.8, 0.55], a: 0.55 });
    particles.spawn({ kind: 5, x: tmpV.x, y: 0.012, z: tmpV.z, size: 0.3, max: 18, col: [0.36, 0.26, 0.14], a: 0.45, floor: false });
  }
  function burst(x, z, n, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.6 + Math.random() * 1.6) * power;
      particles.spawn({ kind: 0, x: x + Math.cos(a) * 0.12, y: 0.04, z: z + Math.sin(a) * 0.12, vx: Math.cos(a) * v, vy: 0.8 + Math.random() * 1.8 * power, vz: Math.sin(a) * v * 0.7, g: 7, drag: 1.2, max: 0.45 + Math.random() * 0.45, size: 0.07 + Math.random() * 0.07, grow: 1.3, col: [0.94, 0.82, 0.58], a: 0.7 });
    }
  }

  const fxCols = {};
  const colOf = (s) => (fxCols[s] || (fxCols[s] = hex(s)));
  const transient = [];
  function mirrorFx(list) {
    transient.length = 0;
    if (!list) return;
    for (const q of list) {
      const k = q.t / q.max, a = 1 - k, hash = Math.sin(q.x * 12.9 + q.size * 78.2) * 0.5;
      const o = { raw: true, t: 0, max: 9, kind: q.kind, x: q.x - 6, y: q.z, z: hash * 0.4, size: 0.1, grow: 0, a, col: [1, 1, 1], rot: q.rot || 0 };
      if (q.kind === 0) { o.size = q.size * 1.6 * (1 + k * 1.6); o.col = [0.92, 0.78, 0.55]; o.a = 0.5 * a; }
      else if (q.kind === 1) { o.size = Math.max(0.03, q.size * 1.2); o.col = colOf(q.col || '#fff3b0'); }
      else if (q.kind === 2) { o.size = q.size * (0.5 + k * 1.1); o.col = colOf(q.col || '#fff3b0'); o.a = 0.9 * a; }
      else if (q.kind === 3) { o.size = q.size * 1.7; o.col = colOf(q.col || '#ffffff'); o.a = Math.min(1, a * 1.6); }
      else if (q.kind === 4) { o.size = q.size * 1.5; o.col = colOf(q.col || '#ffffff'); o.a = Math.min(1, a * 2); }
      transient.push(o);
    }
  }

  // ---- title hero: a scripted, looping exchange of palm strikes (presentation only; the sim is not touched) ----
  // Two players trade high lobs over the net: each one winds up, the open palm meets the peteca (feathers up, base to the hand), follows through.
  const HERO = { T: 2.8, F: 1.4, xa: -1.55, xb: 1.75, za: 2.2, zb: 1.95, apex: 3.7 };
  function heroBall(u) {
    const k = u < HERO.F ? 0 : 1, f = (k === 0 ? u : u - HERO.F) / HERO.F;
    const x0 = k === 0 ? HERO.xa : HERO.xb, x1 = k === 0 ? HERO.xb : HERO.xa, z0 = k === 0 ? HERO.za : HERO.zb, z1 = k === 0 ? HERO.zb : HERO.za;
    const zAt = (g) => z0 + (z1 - z0) * g + 4 * (HERO.apex - Math.max(z0, z1)) * g * (1 - g);
    const e = 0.01, g0 = clamp(f - e, 0, 1), g1 = clamp(f + e, 0, 1);
    const dx = (x1 - x0), vx = dx / HERO.F, vz = (zAt(g1) - zAt(g0)) / ((g1 - g0) * HERO.F || 1);
    return { x: x0 + dx * f + 6, z: zAt(f), vx, vz, alive: true, held: false, spin: 0, tumble: 0, ang: 0 };
  }
  function heroPlayer(v, isA) {
    const cx = isA ? HERO.xa : HERO.xb, cz = isA ? HERO.za : HERO.zb, dir = isA ? 1 : -1, shot = isA ? 'smash' : 'drive';
    const x = cx + 6 - dir * 0.35;
    const S = { x, depth: 0, dir, ready: 1, anim: null, mine: false, tcd: null, plan: null, ball: null, mood: null, jumpSim: 0, held: false };
    if (v < 0.6) { S.anim = { t: v, kind: 'strike', shot, cx: cx + 6, cz, perfect: true, power: false, dir }; S.jumpSim = shot === 'smash' ? Math.max(0, Math.sin(Math.min(1, v / 0.5) * Math.PI)) * 0.34 : 0; }
    else if (v > HERO.T - 1.15) { S.mine = true; S.tcd = HERO.T - v; S.plan = { shot, zHit: cz, xw: cx }; }
    return S;
  }

  // ---- the per-frame update ----
  function frame(game) {
    if (!P.ready || P.lost) { try { document.body.setAttribute('data-p3d-state', `ready=${P.ready} lost=${P.lost}`); } catch { /* ignore */ } return; }
    const G = game.getState();
    const run = (G.scene === 'play' || G.scene === 'result') && G.run ? G.run : G.att;
    if (!run) return;
    const playing = G.scene === 'play' && G.run === run;
    const tReal = performance.now(), dtReal = Math.min(0.1, (tReal - clockReal) / 1000); clockReal = tReal;
    frameMs = frameMs * 0.95 + dtReal * 1000 * 0.05;
    if (frameMs > 26) slowCount++; else slowCount = 0;
    if (slowCount > 90 && P.tier !== 'low') { setTier(P.tier === 'high' ? 'medium' : 'low'); slowCount = 0; frameMs = 16; }

    const courtWanted = run.court ?? (G.record ? G.record.courtSel : 0) ?? 0;
    if (P.courtId !== courtWanted) buildCourt(courtWanted);
    if (G.record && G.record.petecaSel !== petecaDesign) { petecaDesign = G.record.petecaSel; peteca.userData.setDesign(PETECAS[petecaDesign] || PETECAS[0]); }

    const dt = tPrevSim === null ? 0 : clamp(G.t - tPrevSim, 0, 0.1); tPrevSim = G.t;
    simT += dt;
    if (R.run !== run) {
      R.run = run; R.buf.length = 0; R.snapped = false; R.lastEv = run.seq - 1;
      for (const e of humans.values()) { e.ath.x = null; e.ath.hand = null; e.ath.off = null; }
      trail.clear(); particles.clear();
    }

    const b = run.ball;
    const last = R.buf[R.buf.length - 1];
    if (!last || last.t !== run.t) { R.buf.push({ t: run.t, x: b.x, z: b.z, vx: b.vx, vz: b.vz, alive: b.alive, held: b.held, spin: b.spin, tumble: b.tumble, ang: b.ang }); if (R.buf.length > 48) R.buf.shift(); }
    const hero = G.scene === 'title' && run.players.length >= 2;
    const heroU = simT % HERO.T;
    const bd = hero ? heroBall(heroU) : (ballAt(run.t - BALL_DELAY) || R.buf[R.buf.length - 1]);

    // players
    const winner = run.over && run.over.winner !== undefined ? run.over.winner : (run.phase === 'point' ? run.lastWinner : null);
    const seen = new Set();
    for (let i = 0; i < run.players.length; i++) {
      const p = run.players[i];
      const ent = humans.get(p.prof.look);
      if (!ent) { loadLook(p.prof.look); continue; }
      seen.add(p.prof.look);
      const mine = run.recv === i && b.alive && run.phase === 'rally';
      let tcd = null, plan = null;
      if (mine && p.plan && !p.anim) {
        const pr = predictAt(b, run.wind, p.plan.zHit);
        plan = { shot: p.plan.shot, zHit: p.plan.zHit, xw: p.plan.x - 6 };
        if (!pr.ground) tcd = pr.t;
      }
      const depth = run.format === 'doubles' ? (p.k === 0 ? 0.55 : -0.55) : 0;
      const ballV = (b.alive || b.held) ? { x: bd.x - 6, y: bd.z, z: depth } : null;
      const mood = winner === null || winner === undefined ? null : (p.team === winner ? 'win' : 'lose');
      let S = { x: p.x, depth, dir: p.dir, ready: p.ready, anim: p.anim, mine, tcd, plan, ball: ballV, mood, jumpSim: p.z, held: b.held && run.recv === i };
      if (hero) {
        if (i > 1) { ent.h.root.visible = false; continue; }
        S = heroPlayer(i === 0 ? heroU : (heroU + HERO.F) % HERO.T, i === 0);
        S.ball = { x: bd.x - 6, y: bd.z, z: 0 };
      }
      ent.h.root.visible = true;
      if (!R.snapped) for (let k = 0; k < 18; k++) ent.ath.update(1 / 60, S);
      ent.ath.update(dt, S);
    }
    R.snapped = true;
    for (const [i, ent] of humans) if (!seen.has(i)) ent.h.root.visible = false;

    // events -> effects
    for (const e of run.events) {
      if (e.seq <= R.lastEv) continue;
      R.lastEv = e.seq;
      if (e.type === 'strike') {
        const pl = run.players[e.who];
        const depth = run.format === 'doubles' ? (pl.k === 0 ? 0.55 : -0.55) : 0;
        if (e.shot === 'smash') burst(pl.x - 6, depth, 8, 0.9);
        if (crowd) {
          if (e.power) crowd.react('cheer', { origin: [pl.x - 6, 0, -6], radius: 30, intensity: 1 });
          else if (e.perfect && e.human) crowd.react('cheer', { origin: [pl.x - 6, 0, -6], radius: 30, intensity: 0.5 });
          crowd.setExcitement(clamp(0.2 + run.rally * 0.04, 0.2, 0.9));
        }
        for (const q of run.players) if (q.team !== pl.team) { const ent = humans.get(q.prof.look); if (ent) ent.ath.splitT = 0; }
      } else if (e.type === 'net') {
        if (world) world.net.hit(1, 0);
      } else if (e.type === 'floor') {
        burst(e.x - 6, 0, 6, 0.8);
      } else if (e.type === 'point' && crowd) {
        crowd.react(e.winner === 0 ? 'cheer' : 'groan', { origin: [0, 0, -6], radius: 40, intensity: 0.9 });
      } else if (e.type === 'game' && crowd) crowd.react('ovation', { origin: [0, 0, -6], radius: 60, intensity: 1 });
    }
    if (world && b.alive && last && ((last.x - NET) * (b.x - NET) <= 0) && b.z < 2.3 && b.z > 1.15) world.net.hit(0.6, 0);

    // landing from a jump: a puff of sand
    for (const ent of humans.values()) {
      const air = ent.ath.jumpY > 0.05;
      if (ent.wasAir && !air) burst(ent.h.root.position.x, ent.h.root.position.z, 7, 0.7);
      ent.wasAir = air;
    }

    // the peteca
    const sb = bd;
    const onGround = !sb.alive && !sb.held && sb.z < 0.2;
    peteca.position.set(sb.x - 6, Math.max(sb.z, onGround ? 0.05 : 0.0), 0);
    let ang = Math.atan2(sb.vz, sb.vx);
    if (sb.held) ang = Math.PI / 2;
    else if (onGround || !sb.alive) ang = -Math.PI / 2 + 0.38;
    else if (sb.tumble > 0) ang = sb.ang;
    const U = peteca.userData;
    if (U.angS === undefined) U.angS = ang;
    let da = ang - U.angS; da = Math.atan2(Math.sin(da), Math.cos(da));
    U.angS += da * (1 - Math.exp(-dt / 0.045));
    peteca.rotation.set(0, 0, U.angS);
    const spd = Math.hypot(sb.vx, sb.vz), spin = sb.alive && sb.spin ? 1 : 0;
    U.roll = (U.roll || 0) + dt * (spin ? 18 : 4) * (spd > 3 ? 1 : 0.3);
    peteca.children[0].rotation.x = U.roll;
    const prevSpd = U.pspd ?? spd; U.pspd = spd;
    U.animate(simT, sb.alive ? spd : 0, spin, onGround ? 1 : sb.held ? 0.5 : 0, clamp((prevSpd - spd) * 0.1, 0, 1));
    ballShadow.position.set(sb.x - 6, 0.02, 0);
    const shS = 0.15 + clamp(sb.z, 0, 4) * 0.015;
    ballShadow.scale.set(shS * 2.4, shS * 1.5, 1); blobMat.opacity = clamp(0.6 - sb.z * 0.1, 0.12, 0.6);
    if (sb.alive && !sb.held) trail.push(sb.x - 6, sb.z, 0); else trail.clear();
    trail.update(sb.spin ? '#ffe9a0' : '#ffffff', sb.spin ? 0.75 : 0.5, sb.spin ? 0.06 : 0.045);
    const guide = playing && run.power && run.recv >= 0 && run.players[run.recv] && run.players[run.recv].human;
    guideHalo.visible = !!guide; if (guide) { guideHalo.position.set(sb.x - 6, sb.z, 0.1); const k = 0.9 + 0.12 * Math.sin(simT * 10); guideHalo.scale.set(1.3 * k, 1.3 * k, 1); }

    // landing marker + Think ring on the sand
    const mk = playing ? G.land : null;
    if (mk && mk.t < 1.3) { const a = 1 - mk.t / 1.3; landRing.visible = true; landRing.position.set(mk.x - 6, 0.025, 0); const s = 0.42 * (1 + (1 - a) * 0.25); landRing.scale.set(s, 1, s * 0.9); landRing.material.opacity = 0.9 * a; landRing.material.color.set(mk.col || '#ffffff'); } else landRing.visible = false;
    const th = playing && G.think && G.think.adv && G.think.adv.landX !== undefined ? G.think.adv.landX : null;
    if (th !== null) { thinkRing.visible = true; thinkRing.position.set(th - 6, 0.03, 0); thinkRing.scale.set(0.55, 1, 0.5); thinkRing.material.opacity = 0.5 + 0.5 * (0.8 + 0.2 * Math.sin(G.t * 8)); } else thinkRing.visible = false;

    // the game's own particle list (puffs, sparks, rings, feathers, confetti) drawn as 3D sprites
    mirrorFx(playing ? G.fx : G.attFx);
    particles.update(dt, transient);

    if (world) world.update(simT, dt, 0.35 + Math.abs(run.wind || 0) * 0.5);
    if (world && world.scenery) world.scenery.update(dtReal, cam);
    if (crowd) crowd.update(dtReal);
    stage.setShadowTarget(P.focusX || 0, 0, 0);
    stage.render();
    P.frames = (P.frames || 0) + 1;
    if ((P.frames & 7) === 1) { try { document.body.setAttribute('data-p3d', `frames=${P.frames} tier=${P.tier} court=${P.courtId} calls=${stage.renderer.info.render.calls} lost=${P.lost}`); } catch { /* ignore */ } }
  }

  function setTier(t) {
    P.tier = t;
    try { stage.setQuality(t); } catch { /* ignore */ }
    if (crowd) { try { crowd.setQuality(t); } catch { /* ignore */ } }
    if (t === 'low') stage.renderer.shadowMap.enabled = false;
  }
  P.setTier = setTier;

  // ---- boot: load assets, then activate ----
  P.ready_p = (async () => {
    P.tStart = Math.round(performance.now());
    buildCourt(0);
    P.tCourt = Math.round(performance.now());
    await Promise.all([5, 6, 0, 2, 1, 3, 4].map((i) => loadLook(i)));
    if (humans.size < 4) throw new Error('players did not load');
    if (P.aborted) return;
    P.tReady = Math.round(performance.now());
    P.ready = true; P.active = true;
    stage.invalidate();
  })();
  P.abort = () => { P.aborted = true; P.ready = false; P.active = false; FX.gl = null; try { canvas.remove(); } catch { /* ignore */ } };
  P.ready_p.catch((e) => { console.warn('presenter failed', e); P.ready = false; P.active = false; FX.gl = null; try { canvas.remove(); } catch { /* ignore */ } });

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      r(ctx, view);
      if (P.dbg) { ctx.save(); ctx.fillStyle = '#f33'; ctx.font = '22px monospace'; ctx.fillText(`act=${P.active} rdy=${P.ready} lost=${P.lost} fr=${P.frames} err=${P.errMsg}`, 8, 300); ctx.restore(); }
      if (P.active) { try { frame(game); } catch (e) { P.errMsg = String(e && e.message || e).slice(0, 80); if (!P.warned) { console.warn('presenter frame error', e); P.warned = true; try { document.body.setAttribute('data-p3d-err', String(e && e.stack || e).slice(0, 400)); } catch { /* ignore */ } } } }
    };
    return game;
  };
  return P;
}
