// The 3D presenter: reads the sim (game.getState().sim: players, ball, events) and draws the pitch, twelve mannequins and the ball from ONE fixed
// camera. It never writes back: positions, contact times and outcomes belong to the sim; every contact clip is retimed (playTimed) so its
// contact frame lands on the sim's contact time, and the foot / hands are steered to the sim's ball so the picture meets the ball exactly.
// Rendering is interpolated between the sim's fixed steps so motion is smooth at 60 and 120 Hz.
import { buildField, buildBall, BALL_VIS } from './field.js';
import { addFootyClips } from './clips.js';
import { CAM, fovFor } from '../src/camera.js';
import { BR, KP, BS } from '../src/consts.js';

const LIB = '../vendor3d/index.js';
const frac = (n) => ((n * 2654435761) >>> 0) / 4294967296;      // deterministic per-player variation (no randomness, no clock)
const KITS = [
  { top: '#d9382c', bottoms: '#f2f2f2', socks: '#d9382c', shoes: '#f2f2f2', trim: '#ffffff' },
  { top: '#2a63cc', bottoms: '#f2f2f2', socks: '#2a63cc', shoes: '#f2f2f2', trim: '#ffffff' },
];
const SKINS = ['peach', 'clay', 'wood', 'tan', 'brown', 'deep', 'ivory', 'tan', 'clay', 'brown', 'peach', 'deep'];
const HAIRS = ['black', 'brown', 'black', 'blond', 'brown', 'black', 'ginger', 'black', 'brown', 'black', 'grey', 'black'];
export const BALL_R = 0.095 * BALL_VIS;
export const CD = BALL_R + 0.02;                       // palm-centre distance from the ball centre when a hand is on the ball
export const PL = 0.09;                                // wrist to palm-centre along the forearm direction (mannequin mitt)

function pickQuality(q) {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  if (q) return q;
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export async function createPresenter({ kitCanvas, quality }) {
  quality = pickQuality(quality);
  const fallback = { stage: null, wrap: (g) => g };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return fallback; }
  const { createStage, loadHuman, THREE, solveFootBall, footContactPoint, penetration, resolvePenetration, FINGER_POSES } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', shadows: false, mode: 'continuous' });
  if (!stage.supported) { canvas.remove(); return fallback; }
  let lost = false;
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; });
  stage.setLighting('day', { exposure: 1.0 });
  stage.setSky('#9fc6e6', '#b9d4e6', { near: 90, far: 230 });
  { const c = globalThis.document.createElement('canvas'); c.width = 4; c.height = 256; const g2 = c.getContext('2d'); const gr = g2.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#5f9bd6'); gr.addColorStop(0.7, '#a9cfea'); gr.addColorStop(1, '#d8e8f2'); g2.fillStyle = gr; g2.fillRect(0, 0, 4, 256); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; stage.scene.background = tx; }
  const camera = stage.camera; camera.near = 1; camera.far = 260; camera.updateProjectionMatrix();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  buildField(stage);
  const ballMesh = buildBall(); stage.add(ballMesh);
  const blobs = stage.enableBlobShadows(16, { radius: 0.5, opacity: 0.9 });

  // ---- the twelve players ------------------------------------------------------------------------------------------------------
  let ref = null;                                   // the umpire: a yellow-shirted figure who follows the play at a distance (drawn only; the sim has no umpire)
  let list = null, loading = false, ready = false, builtKind = '';
  async function loadPlayers(women) {
    if (loading) return; loading = true;
    try {
      const ch = women ? 'mannequin_f' : 'mannequin_m';
      const hs = await Promise.all(Array.from({ length: 12 }, (_, i) => loadHuman({ character: ch, kit: KITS[i < 6 ? 0 : 1], skin: SKINS[i], hair: HAIRS[i], quality })));
      if (list) for (const e of list) stage.remove(e.human);
      list = hs.map((h, i) => {
        addFootyClips(h);
        for (const sd of ['L', 'R']) solveFootBall(h, sd, new THREE.Vector3(), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1), 'instep', 0.1);   // caches the sole frame while the body is in its world-aligned rest pose (the library derives it lazily)
        h.addLayer('live', { mask: 'all', additive: true, weight: 1 });
        h.root.scale.setScalar(BS);                                   // 1.25x players: readable from the fixed whole-pitch camera
        h.root.visible = true; h.turnRate = 0; h.groundClamp = 'auto'; h.footPlanting = true;
        h.setKit(KITS[i < 6 ? 0 : 1]);
        h.play('f_stance_0', { fade: 0, loop: true, startTime: frac(i * 13 + 1) * 0.9 });
        h.play('f_live', { layer: 'live', fade: 0, loop: true, startTime: frac(i * 7 + 3) * 2.8, speed: 0.75 + frac(i * 11 + 5) * 0.6 });
        stage.add(h);
        return { human: h, id: i, ctrl: { mode: '', until: -1, act: -9, partner: -1, held: false }, prev: null, cur: null, jr: 0 };
      });
      if (ref) stage.remove(ref.human);
      { const rh = await loadHuman({ character: ch, kit: { top: '#f2c200', bottoms: '#1c1c1c', socks: '#1c1c1c', shoes: '#111111', trim: '#1c1c1c' }, skin: 'tan', hair: 'grey', quality }); rh.root.scale.setScalar(BS); rh.groundClamp = 'auto'; rh.footPlanting = true; rh.play('idle_relaxed', { fade: 0, loop: true }); stage.add(rh); ref = { human: rh, x: 0, z: -4 }; }
      builtKind = women ? 'f' : 'm'; ready = true;
      try { stage.renderer.compile?.(stage.scene, camera); } catch { /* optional */ }
      stage.invalidate();
    } catch (e) { console.warn('3D players failed to load; keeping the 2D pitch', e); }
    loading = false;
  }
  loadPlayers(false);

  // ---- interpolation between sim steps ---------------------------------------------------------------------------------------------
  const P = { camOverride: null, stage, THREE, ready: () => ready, list: () => list, ball: ballMesh, deterministic: false, noRender: false, alpha: 1, now: 0 };
  const catchAt = {}; let seenEv2 = 0;
  let lastTick = -1, lastTickMs = 0, lastFrameMs = 0, lastT = null, seenEv = 0, prevBall = null, curBall = null, tickGap = 1;
  const snapP = (p) => ({ x: p.x, z: p.z, vx: p.vx, vz: p.vz, face: p.face, jh: p.jh });
  const snapB = (b) => ({ x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAng = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };
  const iso = (e, t) => {
    const a = e.prev || e.cur, b = e.cur;
    return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), vx: b.vx, vz: b.vz, face: lerpAng(a.face, b.face, t), jh: lerp(a.jh, b.jh, t) };
  };

  // ---- clips -----------------------------------------------------------------------------------------------------------------------------------------
  const playLoop = (e, name, fade = 0.25, speedVar = true) => {
    const h = e.human, c = e.ctrl; if (c.mode === name) return;
    const clip = h.clips[name];
    h.play(name, { fade, loop: true, startTime: clip && clip.loop ? frac(e.id * 13 + 1) * clip.dur : 0, speed: speedVar ? 0.88 + frac(e.id * 17 + 2) * 0.26 : 1 });
    c.mode = name;
  };
  const ACT_CLIP = { kick: 'f_kick', handball: 'f_handball', jump: 'f_jump', tackle: 'f_tackle', gather: 'f_gather' };
  function startAct(e, a, now, dt, catching) {
    const h = e.human, c = e.ctrl, name = ACT_CLIP[a.kind];
    if (!name || !h.hasClip(name)) return;
    const clip = h.clips[name];
    const ev = clip.events.contact;
    const eta = a.tc - now;
    if (eta >= -0.001) h.playTimed(name, 'contact', Math.max(0.001, eta), { fade: catching ? 0 : 0.1, frameDt: dt });
    else h.play(name, { fade: 0, startTime: Math.min(clip.dur - 0.01, ev + (now - a.tc)), loop: false });
    c.mode = name; c.act = a.t0; c.until = Math.max(a.t1, a.tc + (clip.dur - ev)) + 0.0;
    c.kind = a.kind;
  }

  // ---- placing the picture --------------------------------------------------------------------------------------------------------------------------------
  let cssW = 0, cssH = 0, pillar = -1;
  function layoutCanvas() {
    const r = kitCanvas.getBoundingClientRect();
    const cw = r.width || globalThis.innerWidth, ch = r.height || globalThis.innerHeight;
    const want = cw / ch > 0.5625 ? Math.round(ch * 0.5625) : 0;       // wider than 9:16: pillarbox the picture to the HUD's rectangle
    if (want !== pillar) {
      pillar = want;
      canvas.style.cssText = want ? `position:fixed;top:0;left:50%;transform:translateX(-50%);width:${want}px;height:100dvh;display:block;pointer-events:none;z-index:0` : 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
      cssW = 0;
    }
    const w = want || cw;
    if (w !== cssW || ch !== cssH) { cssW = w; cssH = ch; stage.resize(); }
    return { w, h: ch };
  }
  function placeCamera(w, h) {
    const asp = w / h, fov = fovFor(asp);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const co = P.camOverride;
    if (co) { camera.position.set(co.x, co.y, co.z); camera.lookAt(co.lx, co.ly, co.lz); if (co.fov && Math.abs(camera.fov - co.fov) > 1e-3) { camera.fov = co.fov; camera.updateProjectionMatrix(); } return; }
    camera.position.set(CAM.x, CAM.y, CAM.z); camera.lookAt(CAM.lx, CAM.ly, CAM.lz);
  }

  // world-space helpers
  const ballWorld = () => V(curBall ? ballShown.x : 0, ballShown.y, ballShown.z);
  let ballShown = { x: 0, y: 1, z: 0 };

  // ---- one frame -----------------------------------------------------------------------------------------------------------------------------------------------
  function frame(game) {
    const G = game.getState();
    if (lost) return;
    if (!ready) { const L0 = layoutCanvas(); placeCamera(L0.w, L0.h); stage.setVisible(true); if (!P.noRender) stage.render(); return; }      // the pitch shows while the players are still loading
    const want = G.settings && G.settings.women ? 'f' : 'm';
    if (want !== builtKind && !loading) { loadPlayers(want === 'f'); }
    const s = G.sim;
    if (!s) { stage.setVisible(false); return; }
    stage.setVisible(true);
    const L = layoutCanvas(); placeCamera(L.w, L.h);
    const nowMs = globalThis.performance ? globalThis.performance.now() : 0;
    const catching = lastT === null || s.t < lastT - 1e-6 || Math.abs(s.t - lastT) > 0.5;      // first frame, or the sim was replaced / jumped
    // new tick?
    if (s.tick !== lastTick) {
      tickGap = Math.max(1, s.tick - lastTick);
      for (let i = 0; i < 12; i++) { const e = list[i], p = s.players[i]; e.prev = catching || !e.cur ? snapP(p) : e.cur; e.cur = snapP(p); }
      prevBall = catching || !curBall ? snapB(s.ball) : curBall; curBall = snapB(s.ball);
      lastTick = s.tick; lastTickMs = nowMs;
    }
    const sinceTick = nowMs - lastTickMs;
    const moving = P.deterministic ? true : sinceTick < 120;
    let alpha = P.deterministic ? 1 : Math.min(1, sinceTick / (16.667 * Math.min(tickGap, 2)));
    if (!moving) alpha = 1;
    P.alpha = alpha;
    let dt = P.deterministic ? (lastT === null ? 0 : s.t - lastT) : moving ? Math.min(0.05, Math.max(0, nowMs - lastFrameMs) / 1000) : 0;
    if (catching) dt = 0;
    dt = Math.min(Math.max(dt, 0), 0.1);
    lastT = s.t; lastFrameMs = nowMs;
    // the time the picture shows: sim time plus the interpolated fraction of one step
    const tNow = s.t + (P.deterministic ? 0 : (alpha - 1) * (1 / 60));
    if (catching) { seenEv = s.evId; for (const e of list) { e.ctrl.mode = ''; e.ctrl.until = -1; e.ctrl.act = -9; } }
    for (const e of s.events) if ((e.type === 'catch' || e.type === 'mark') && e.id >= seenEv2) { catchAt[e.pid] = { x: e.bx, y: e.by, z: e.bz, until: s.t + 0.14, vx: s.ball.vx, vz: s.ball.vz }; }
    seenEv2 = s.evId;
    // ball position (interpolated)
    const bi = { x: lerp(prevBall.x, curBall.x, alpha), y: lerp(prevBall.y, curBall.y, alpha), z: lerp(prevBall.z, curBall.z, alpha) };
    ballShown = bi;
    // players: placement, facing, clips
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const e = list[i], p = s.players[i], h = e.human, c = e.ctrl, q = iso(e, alpha);
      frames.push(q);
      h.root.position.x = q.x; h.root.position.z = q.z; h.root.position.y = q.jh;
      h.groundClamp = q.jh > 0.02 ? 'off' : 'auto';
      h.setFacing(q.face);
      const a = p.act;
      if (a && ACT_CLIP[a.kind] && a.t0 !== c.act) startAct(e, a, tNow, dt, catching);
      // tackle result: wrapped hold / carrier hold
      if (a && a.kind === 'wrap' && c.kind !== 'wrap') { playLoop(e, 'f_wrap', 0.08, false); c.kind = 'wrap'; c.until = a.t1; c.partner = a.tgt; }
      else if (a && a.kind === 'tackled' && c.kind !== 'tackled') { playLoop(e, 'f_held', 0.1, false); c.kind = 'tackled'; c.until = a.t1; c.partner = a.by; }
      else if (a && a.kind === 'stagger' && c.kind !== 'stagger') { h.play('f_miss', { fade: 0.08, loop: false }); c.mode = 'f_miss'; c.kind = 'stagger'; c.until = a.t1; c.partner = -1; }
      else if (a && a.kind === 'celebrate' && c.kind !== 'celebrate') { h.play(frac(i + 3) < 0.5 ? 'celebrate_2' : 'celebrate', { fade: 0.2, loop: false }); c.mode = 'celeb'; c.kind = 'celebrate'; c.until = a.t1; }
      const busy = a && (ACT_CLIP[a.kind] || a.kind === 'wrap' || a.kind === 'tackled' || a.kind === 'stagger' || a.kind === 'celebrate' || a.kind === 'wrapEnd');
      if (!busy && tNow >= c.until) {
        c.kind = ''; c.partner = -1;
        const carrying = s.ball.owner === i, sp = Math.hypot(q.vx, q.vz);
        if (sp > 0.45) { const set = carrying ? { jog: 'run_ball_jog', sprint: 'run_ball_sprint' } : null; h.locomote(Math.min(8, sp), set ? { set } : {}); c.mode = 'loco'; }
        else if (carrying) playLoop(e, 'f_held', 0.25, false);
        else playLoop(e, `f_stance_${(i * 5 + (p.slot * 3)) % 3}`, 0.3);
      }
      // life: the live layer is strong while idle and almost off during an action clip; heads follow the ball a little, each at his own pace
      h.layers.live.setWeight(c.kind ? 0.2 : 1, 0);
      if (c.kind === 'kick' || c.kind === 'handball' || c.kind === 'tackle' || c.kind === 'wrap') h.lookAt(null);
      else h.lookAt(V(bi.x, Math.max(0.5, bi.y), bi.z), { weight: 0.45 + 0.25 * frac(i * 5 + 1), maxYaw: 1.0, maxPitch: 0.5 });
    }
    // ---- targets: hands and feet meet the sim's ball -------------------------------------------------------------------------------------------------------
    const bw = V(bi.x, bi.y, bi.z);
    let heldBy = -1;
    for (let i = 0; i < 12; i++) {
      const e = list[i], p = s.players[i], h = e.human, a = p.act, q = frames[i], c = e.ctrl;
      h.setReach('L', null); h.setReach('R', null); h.setReachFoot('R', null); h.setReachFoot('L', null);
      h._rp = [];
      const RP = (side, pt, o) => { const d = (h._pd && h._pd[side]) || V(0, 0, 1); h.setReach(side, pt.clone().addScaledVector(d, -PL), o); h._rp.push([side, pt, o]); };      // steer the PALM (not the wrist) onto the ball
      h.setTarget('tL', null); h.setTarget('tR', null);
      const fx = Math.sin(q.face), fz = Math.cos(q.face), lx = Math.cos(q.face), lz = -Math.sin(q.face);
      // kicker
      if (a && a.kind === 'kick') {
        const kp = V(q.x + fx * KP.f - lx * KP.s, KP.y, q.z + fz * KP.f - lz * KP.s);
        const dirv = V(Math.sin(a.yaw) * Math.cos(a.elev), Math.sin(a.elev), Math.cos(a.yaw) * Math.cos(a.elev));
        if (tNow < a.tr + 0.02) {            // both hands hold the ball at the right hip until it is released
          const ballAt = V(bi.x, bi.y, bi.z), side = V(lx, 0, lz);
          const w = sstep(a.t0 - 0.02, a.t0 + 0.04, tNow);
          RP('L', ballAt.clone().addScaledVector(side, CD), { weight: w }); RP('R', ballAt.clone().addScaledVector(side, -CD), { weight: w });
        }
        if (tNow > a.tc - 0.16 && tNow < a.tc + 0.14) {
          const w = tNow <= a.tc ? sstep(a.tc - 0.16, a.tc - 0.02, tNow) : 1 - sstep(a.tc + 0.03, a.tc + 0.14, tNow);
          const fwd = V(fx, 0, fz);
          const after = Math.max(0, Math.min(tNow - a.tc, 0.03));              // the foot travels with the ball for the first instants after contact
          const kc = kp.clone().addScaledVector(dirv, a.speed * after);
          const k = solveFootBall(h, 'R', kc, dirv, fwd, 'instep', BALL_R);
          h.setReachFoot('R', k.ankle, w, k.quat);
        }
      }
      // handball
      if (a && a.kind === 'handball') {
        const ballAt = V(bi.x, bi.y, bi.z), side = V(lx, 0, lz);
        if (tNow < a.tc + 0.01) RP('L', ballAt.clone().addScaledVector(V(0, -1, 0), CD).addScaledVector(side, 0.0), { weight: 1 });
        h.setTarget('hold', ballAt); h.setTarget('strike', ballAt.clone().addScaledVector(side, -CD));
        if (tNow > a.tc - 0.1 && tNow < a.tc + 0.08) RP('R', ballAt.clone().addScaledVector(side, -CD), { weight: sstep(a.tc - 0.1, a.tc, tNow) });
        h.setFingers('R', 'fist');
      }
      // catching: both hands to the ball as it arrives (a mark, a chest-high take); one fist for a spoil or a tap
      const ca = catchAt[i];
      if (ca && s.t <= ca.until && s.ball.owner === i) {          // the catch itself: both palms stay on the ball where it was taken while the body settles
        const side = V(lx, 0, lz); const cpos = V(ca.x, ca.y, ca.z);
        RP('L', cpos.clone().addScaledVector(side, CD), { weight: 1 }); RP('R', cpos.clone().addScaledVector(side, -CD), { weight: 1 });
      } else if (s.ball.owner < 0 && s.ball.kind !== 'held' && s.ball.kind !== 'none' && (!a || a.kind === 'jump' || a.kind === 'celebrate') && bi.y > 0.3 && bi.y < 3.4) {
        const hd = Math.hypot(bi.x - q.x, bi.z - q.z), dy = bi.y - (q.jh + 1.45), d3 = Math.hypot(hd, dy);
        const bsp = Math.sqrt(s.ball.vx * s.ball.vx + s.ball.vy * s.ball.vy + s.ball.vz * s.ball.vz);
        if (d3 < 7 && bsp > 1.2) {
          const w = Math.max(d3 < 3.2 ? sstep(3.2, 1.3, d3) : 0, sstep(0.42, 0.12, d3 / Math.max(bsp, 3)));
          const vv = V(s.ball.vx, 0, s.ball.vz), sp = vv.length();
          const side = sp > 0.5 ? V(vv.z / sp, 0, -vv.x / sp) : V(lx, 0, lz);
          if (side.x * lx + side.z * lz < 0) side.multiplyScalar(-1);
          if ((a && a.spoil) || s.ball.kind === 'ballup') RP('R', bw.clone().addScaledVector(side, -CD), { weight: w });
          else { RP('L', bw.clone().addScaledVector(side, CD), { weight: w }); RP('R', bw.clone().addScaledVector(side, -CD), { weight: w }); h.setFingers('L', 'ballGrip'); h.setFingers('R', 'ballGrip'); }
        }
      }
      // gather: both hands to the ball on the ground
      if (a && a.kind === 'gather') {
        const side = V(lx, 0, lz);
        const w = tNow < a.tc ? sstep(a.tc - 0.12, a.tc - 0.005, tNow) : 1 - sstep(a.tc + 0.02, a.tc + 0.12, tNow);
        RP('L', bw.clone().addScaledVector(side, CD), { weight: w }); RP('R', bw.clone().addScaledVector(side, -CD), { weight: w });
      }
      // tackle: both hands round the carrier's waist
      const partner = (a && a.kind === 'tackle') ? a.tgt : (a && a.kind === 'wrap') ? a.tgt : -1;
      if (partner >= 0) {
        const o = list[partner].human, w = o.bonePosition('Spine', V());
        const dx = w.x - h.root.position.x, dz = w.z - h.root.position.z, dl = Math.hypot(dx, dz) || 1;
        const sx = lx, sz = lz;                                      // the tackler's left
        const near = V(-dx / dl * 0.02, 0, -dz / dl * 0.02);
        h.setTarget('tL', V(w.x + sx * 0.225 + near.x, w.y, w.z + sz * 0.225 + near.z)); h.setTarget('tR', V(w.x - sx * 0.225 + near.x, w.y, w.z - sz * 0.225 + near.z));
      }
      if (s.ball.owner === i) heldBy = i;
    }
    // humans advance, then the ball is placed from the final hand positions
    const setDirs = (hh) => { hh._pd = hh._pd || {}; for (const sd of ['L', 'R']) { const w = hh.bonePosition(sd + '_Hand', V()), f = hh.bonePosition(sd + '_Forearm', V()); hh._pd[sd] = w.sub(f).normalize(); } };
    for (const e of list) {
      const hh = e.human; hh.update(dt); setDirs(hh);
      if (hh._rp && hh._rp.length) { for (const [sd, pt, o] of hh._rp) hh.setReach(sd, pt.clone().addScaledVector(hh._pd[sd], -PL), o); hh.update(1e-5); setDirs(hh); for (const [sd, pt, o] of hh._rp) hh.setReach(sd, pt.clone().addScaledVector(hh._pd[sd], -PL), o); hh.update(1e-5); setDirs(hh); }     // second pass: the palm, not the wrist, lands on the ball
    }
    // keep two wrapped bodies apart (limbs never pass through each other)
    for (let i = 0; i < 12; i++) { const p = s.players[i], a = p.act; if (a && a.kind === 'wrap') { try { resolvePenetration(list[i].human, list[a.tgt].human, { move: 'a', tolerance: 0.004, iterations: 14, ignore: [['L hand', 'abdomen'], ['R hand', 'abdomen'], ['L hand', 'pelvis'], ['R hand', 'pelvis'], ['L forearm', 'abdomen'], ['R forearm', 'abdomen'], ['L hand', 'chest'], ['R hand', 'chest']] }); } catch { /* ignore */ } } }
    // ball
    const B = s.ball;
    let bp = bi;
    const owner = heldBy >= 0 ? s.players[heldBy] : null;
    const windup = owner && owner.act && (owner.act.kind === 'kick' && !owner.act.released || owner.act.kind === 'handball' && !owner.act.fired);
    if (owner && !windup) {
      const h = list[heldBy].human, hl = h.bonePosition('L_Hand', V()), hr = h.bonePosition('R_Hand', V());
      bp = { x: (hl.x + hr.x) / 2, y: (hl.y + hr.y) / 2 + 0.02, z: (hl.z + hr.z) / 2 };
    }
    ballMesh.position.set(bp.x, bp.y, bp.z);
    // orientation: held = long axis along the player's facing; in flight = long axis along the velocity, spinning about it and tumbling a little
    const spd = Math.hypot(B.vx, B.vy, B.vz);
    if (owner && !windup) { ballMesh.rotation.set(0.25, list[heldBy] ? frames[heldBy].face : 0, 0); }
    else if (B.owner < 0 && spd > 1.5 && B.kind !== 'drop') {
      const d = V(B.vx, B.vy, B.vz).normalize();
      ballMesh.quaternion.setFromUnitVectors(V(0, 0, 1), d);
      const spin = new THREE.Quaternion().setFromAxisAngle(d, B.spin * 1.0);
      ballMesh.quaternion.premultiply(spin);
    } else if (B.owner < 0) {
      ballMesh.rotation.set(0.3, B.spin * 0.2, B.spin * 0.3);
    }
    // the umpire: keeps about 8 m from the ball, walks or jogs, turns to watch; raises an arm for a goal
    if (ref) {
      const rh = ref.human, tx = Math.max(-12, Math.min(12, bi.x * 0.6 + 6)), tz = bi.z - Math.sign(bi.z || 1) * 7, k = Math.min(1, dt * 1.6);
      const ox = ref.x, oz = ref.z; ref.x += (tx - ref.x) * k; ref.z += (tz - ref.z) * k;
      const q2 = { x: ref.x * 0.9, z: ref.z * 0.9 }; const lim = Math.hypot(q2.x / 14, q2.z / 23); if (lim > 1) { q2.x /= lim; q2.z /= lim; }
      const spd = dt > 0 ? Math.hypot(q2.x - ref.px || 0, q2.z - ref.pz || 0) / dt : 0; ref.px = q2.x; ref.pz = q2.z;
      rh.root.position.set(q2.x, 0, q2.z); rh.setFacing(Math.atan2(bi.x - q2.x, bi.z - q2.z));
      if (dt > 0) { if (spd > 0.4) rh.locomote(Math.min(5, spd)); else if (rh.layers.base.current && rh.layers.base.current.clip.name !== 'idle_relaxed') rh.play('idle_relaxed', { fade: 0.3, loop: true }); }
      rh.lookAt(V(bi.x, 1, bi.z), { weight: 0.5 }); rh.update(dt); void ox; void oz;
      blobs.set(12, q2.x, q2.z, 0.55 * BS);
    }
    // shadows
    for (let i = 0; i < 12; i++) { const q = frames[i]; blobs.set(i, q.x, q.z, 0.55 * BS * (1 - Math.min(0.5, q.jh * 0.5))); }
    blobs.set(13, bp.x, bp.z, 0.35 * Math.max(0.35, 1 - Math.min(1, Math.max(0, bp.y - 0.2) / 6))); blobs.mesh.count = 14;
    if (!P.noRender) { stage.render(); }
    P.frames = frames;
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      const rr = kitCanvas.getBoundingClientRect();
      const cw = rr.width || kitCanvas.clientWidth || 720, ch = rr.height || kitCanvas.clientHeight || 1280;
      view.cssW = cw / ch > 0.5625 ? Math.round(ch * 0.5625) : cw; view.cssH = ch;
      r(ctx, view);
      try { frame(game); } catch (e) { console.warn('3D frame failed', e); }
    };
    return game;
  };
  P.frameFor = frame;
  P.solveFootBall = solveFootBall; P.footContactPoint = footContactPoint; P.penetration = penetration;
  void FINGER_POSES;
  void BR;
  return P;
}
