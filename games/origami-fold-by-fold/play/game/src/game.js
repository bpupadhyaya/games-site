// GAME CONTRACT (docs/GAME-CONTRACT.md). Origami: Fold by Fold, see design/GDD.md.
import { meta, inRect } from './layout.js';
import { MODELS, CHAPTERS, stateAt, applyStep } from './models.js';
import { newSheet, planFold, commitFold, revert, lastFold, withCreases, toward, reflectPt, side, bounds, turnSheet } from './paper.js';
import { unproject, project, getPaper, PAPER_IDS } from './paperview.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, totalDone, doneCount, modelLocked, demoLocked, paperOf } from './screens.js';
import { rectsFor, camOf, fitTarget, stepOf } from './playcommon.js';
import { addBurst, stepParticles } from './art.js';
import { render } from './view.js';

export { meta };
export const wheelInput = { dy: 0 };

const VERSION = '1.0.0';
const COMMIT_ANGLE = 1.75;          // radians turned (about 100 degrees) after which a released flap falls shut
const NEAT_TOL = 0.15;              // sheet widths: a finger this far from the landing ring scores 0
const AUTO_MODELS = ['kite', 'puppy'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, textIdx: 0, thinkIdx: 1,
    progress: { done: {} }, paperSel: {}, modelIdx: 0, scroll: {}, scrollVel: {}, press: null,
    play: null, auto: null, particles: [], toast: null, toastT: 0, winInfo: null,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: VERSION, shot: false,
    lastPtr: { x: 0, y: 0 }, drag: false, swipe: null, studioPaper: 'waves',
  };

  const [prog, set] = await Promise.all([storage.get('og.progress', null), storage.get('og.settings', null)]);
  if (prog && prog.done) S.progress = { done: prog.done };
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (Number.isInteger(set.textIdx)) S.textIdx = clamp(set.textIdx, 0, TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = clamp(set.thinkIdx, 0, THINK_STEPS.length - 1);
    if (set.paperSel && typeof set.paperSel === 'object') S.paperSel = set.paperSel;
  }
  audio.setMuted(!S.sound);
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);
  const saveSettings = () => storage.set('og.settings', { sound: S.sound, textIdx: S.textIdx, thinkIdx: S.thinkIdx, paperSel: S.paperSel });
  const saveProgress = () => storage.set('og.progress', S.progress);

  // ------------------------------------------------------------------------------ sound (synthesised paper)
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    lift: () => sfx({ freq: 520, to: 300, dur: 0.07, type: 'triangle', vol: 0.05 }),
    rustle: () => { sfx({ freq: 2200, to: 900, dur: 0.09, type: 'sawtooth', vol: 0.03 }); sfx({ freq: 1500, to: 600, dur: 0.12, type: 'triangle', vol: 0.035 }); },
    land: (q = 0.7) => { sfx({ freq: 260, to: 120, dur: 0.07, type: 'triangle', vol: 0.2 }); sfx({ freq: 1500 + q * 800, to: 900, dur: 0.05, type: 'square', vol: 0.035 }); },
    chime: (q) => sfx({ freq: 700 + q * 500, to: 900 + q * 600, dur: 0.18, type: 'sine', vol: 0.07 }),
    spring: () => sfx({ freq: 360, to: 240, dur: 0.08, type: 'triangle', vol: 0.07 }),
    turn: () => { sfx({ freq: 1800, to: 700, dur: 0.18, type: 'sawtooth', vol: 0.025 }); sfx({ freq: 300, to: 180, dur: 0.12, type: 'triangle', vol: 0.06 }); },
    hint: () => sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }),
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.07 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.08 }),
  };
  const WIN_NOTES = [523, 587, 659, 784, 880, 1047];

  // ------------------------------------------------------------------------------ play objects
  const newPlay = (mi, opts = {}) => {
    const m = MODELS[mi];
    return {
      mi, k: 0, st: newSheet(m.rot ?? 0), plan: null, phase: 'idle', theta: 0, thetaF: 0, thetaT: 0, drag: null, anim: null,
      neat: [], hints: 0, hintT: 0, glow: 0, cam: { S: 300, cx: 0, cy: 0, tilt: 0.42, yaw: 0 }, camT: null, bnd: null, after: null,
      pops: [], flash: null, revT: 0, poseK: 0, decalK: 0, paperId: opts.paperId ?? paperOf(S, m), studio: Boolean(opts.studio), last: false, topOnly: false, snapCam: true,
      winSeq: null, pendingNeat: null, autoNeat: null, result: null,
    };
  };

  function makePlan(P) {
    const m = MODELS[P.mi], step = m.steps[P.k];
    P.plan = null; P.after = null;
    if (!step) return;
    if (step.type === 'fold') {
      const pl = planFold(P.st, step.spec); pl.dir = 1; pl.creasesAll = withCreases(P.st.creases, pl); P.plan = pl;
      P.after = applyStep(P.st, step);
    } else if (step.type === 'unfold') {
      const h = lastFold(P.st);
      if (h) { const pl = planFold(h.before, h.spec); pl.dir = -1; pl.creasesAll = P.st.creases; P.plan = pl; }
      P.after = applyStep(P.st, step);
    }
  }

  function enterStep(P) {
    P.phase = 'idle'; P.drag = null; P.anim = null; P.hintT = 0;
    makePlan(P);
    P.theta = P.plan && P.plan.dir < 0 ? Math.PI : 0;
    P.glow = 4;
    const b = bounds(P.st.polys), a = P.after ? bounds(P.after.polys) : b;
    P.bnd = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
    P.bnd.w = P.bnd.x1 - P.bnd.x0; P.bnd.h = P.bnd.y1 - P.bnd.y0; P.bnd.cx = (P.bnd.x0 + P.bnd.x1) / 2; P.bnd.cy = (P.bnd.y0 + P.bnd.y1) / 2;
  }

  function beginModel(mi, paperId) {
    const m = MODELS[mi];
    S.modelIdx = mi;
    const P = newPlay(mi, { paperId });
    getPaper(P.paperId, m.back);
    S.play = P; S.scene = 'play'; S.overlay = null; S.winInfo = null; S.drag = false; S.press = null; S.particles.length = 0;
    enterStep(P);
  }

  function beginStudio() {
    if (S.demo) { S.scene = 'demo-limit'; return; }
    const P = newPlay(0, { studio: true, paperId: S.studioPaper });
    getPaper(P.paperId);
    P.st = newSheet(0);
    P.bnd = { x0: -0.5, y0: -0.5, x1: 0.5, y1: 0.5, w: 1, h: 1, cx: 0, cy: 0 };
    S.play = P; S.scene = 'studio'; S.overlay = null; S.drag = false; S.press = null; S.particles.length = 0;
  }

  // ------------------------------------------------------------------------------ camera
  function updateCam(P, dt, snap) {
    const { R } = rectsFor(S, P);
    let tgt;
    if (P.phase === 'reveal') {
      const m = MODELS[P.mi], b = m.reveal ?? bounds(P.st.polys);
      tgt = fitTarget(R.board, { w: b.w + 0.2, h: b.h + 0.2, cx: b.cx, cy: b.cy }, 0.1);
    } else tgt = fitTarget(R.board, P.studio ? bounds(P.st.polys) : P.bnd);
    P.camT = tgt;
    const tilt = P.phase === 'reveal' && MODELS[P.mi].pose ? 0.56 : 0.42;
    const k = snap ? 1 : 1 - Math.exp(-dt * (P.phase === 'drag' ? 1.5 : 4.5));
    P.cam.S += (tgt.S - P.cam.S) * k; P.cam.cx += (tgt.cx - P.cam.cx) * k; P.cam.cy += (tgt.cy - P.cam.cy) * k;
    P.cam.tilt += (tilt - P.cam.tilt) * (snap ? 1 : 1 - Math.exp(-dt * 3));
    const yawT = P.phase === 'reveal' ? 0.42 * Math.sin(P.revT * 0.9) * Math.min(1, P.revT * 0.6) : 0;
    P.cam.yaw += (yawT - P.cam.yaw) * (snap ? 1 : 1 - Math.exp(-dt * 5));
  }

  // ------------------------------------------------------------------------------ gestures
  const flatPts = (plan) => (plan.dir > 0 ? plan.moving.map((q) => q.pts) : plan.moving.map((q) => q.pts.map((p) => reflectPt(p, plan.spec.a, plan.spec.n))));
  const distToPoly = (p, poly) => {
    let inside = false, best = 1e9;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
      best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
    }
    return inside ? 0 : best;
  };

  const toFlat = (P, x, y) => unproject(camOf(P, rectsFor(S, P).R.board), x, y);

  function beginDrag(P, x, y) {
    const f = toFlat(P, x, y), px = 1 / Math.max(P.cam.S, 1);
    if (P.studio) return beginStudioDrag(P, f);
    const pl = P.plan;
    if (!pl || P.phase !== 'idle') return false;
    let near = flatPts(pl).some((poly) => distToPoly(f, poly) <= 46 * px);
    const hpos = pl.dir > 0 ? pl.handle : pl.target;
    if (!near && hpos && Math.hypot(f[0] - hpos[0], f[1] - hpos[1]) <= 110 * px) near = true;
    if (!near) { toast('Grab the glowing corner and drag it to the ring.'); return false; }
    const { a, n } = pl.spec;
    const dRef = clamp(Math.abs(side(f, a, n)), 0.45 * pl.D, pl.D);
    P.drag = { g: f, dRef, gt: reflectPt(f, a, n), f, studio: false };
    P.thetaF = Math.acos(clamp(side(f, a, n) / dRef, -1, 1));
    P.phase = 'drag'; P.hintT = 0;
    SOUNDS.lift();
    return true;
  }

  function dragTo(P, x, y) {
    const d = P.drag; if (!d) return;
    const f = toFlat(P, x, y);
    d.f = f;
    if (P.studio) { updateStudioDrag(P, f); return; }
    const pl = P.plan, { a, n } = pl.spec;
    P.thetaF = Math.acos(clamp(side(f, a, n) / d.dRef, -1, 1));
  }

  function releaseDrag(P, x, y) {
    const d = P.drag; if (!d) return;
    dragTo(P, x, y);
    if (P.studio) { releaseStudio(P); return; }
    const pl = P.plan;
    const commit = pl.dir > 0 ? P.thetaF >= COMMIT_ANGLE : P.thetaF <= Math.PI - COMMIT_ANGLE;
    if (commit) {
      const dist = Math.hypot(d.f[0] - d.gt[0], d.f[1] - d.gt[1]);
      P.pendingNeat = clamp(1 - dist / NEAT_TOL, 0, 1);
      P.thetaT = pl.dir > 0 ? Math.PI : 0;
    } else { P.pendingNeat = null; P.thetaT = pl.dir > 0 ? 0 : Math.PI; SOUNDS.spring(); }
    P.phase = 'settle';
  }

  // Studio: the grabbed point is carried to the finger; the crease is the bisector between them.
  function beginStudioDrag(P, f) {
    if (P.phase !== 'idle') return false;
    const under = P.st.polys.filter((q) => distToPoly(f, q.pts) <= 0.02).sort((u, v) => v.z - u.z);
    if (!under.length) return false;
    P.drag = { g: f, f, studio: true, top: under[0].id, spec: null };
    P.phase = 'drag'; P.plan = null; P.theta = 0; P.thetaF = 0;
    SOUNDS.lift();
    return true;
  }
  function updateStudioDrag(P, f) {
    const d = P.drag, dist = Math.hypot(f[0] - d.g[0], f[1] - d.g[1]);
    if (dist < 0.035) { P.plan = null; P.thetaF = 0; d.spec = null; return; }
    const spec = toward(d.g, f, { pick: P.topOnly ? { ids: [d.top] } : 'all' });
    const pl = planFold(P.st, spec);
    if (!pl.ok) { P.plan = null; P.thetaF = 0; d.spec = null; return; }
    pl.dir = 1; pl.creasesAll = withCreases(P.st.creases, pl);
    P.plan = pl; d.spec = spec;
    P.thetaF = Math.PI * (1 - Math.exp(-dist * 8));
  }
  function releaseStudio(P) {
    const d = P.drag;
    if (P.plan && d.spec && Math.hypot(d.f[0] - d.g[0], d.f[1] - d.g[1]) > 0.1) { P.thetaT = Math.PI; P.pendingNeat = null; }
    else { P.thetaT = 0; SOUNDS.spring(); }
    P.phase = 'settle';
  }

  function landStep(P) {
    const pl = P.plan, m = MODELS[P.mi];
    P.drag = null;
    if (P.studio) {
      if (P.thetaT >= Math.PI - 0.01 && pl) { P.st = commitFold(P.st, pl); P.last = true; effectsAtCrease(P, pl, 0.8); }
      P.plan = null; P.theta = 0; P.phase = 'idle';
      return;
    }
    if (P.thetaT === (pl.dir > 0 ? 0 : Math.PI)) { P.theta = P.thetaT; P.phase = 'idle'; return; }   // sprang back
    const step = m.steps[P.k];
    const neat = P.autoNeat ?? P.pendingNeat ?? 0.9;
    P.neat[P.k] = neat;
    P.st = applyStep(P.st, step);
    P.k += 1;
    effectsAtCrease(P, pl, neat);
    if (P.k >= m.steps.length) beginReveal(P); else enterStep(P);
  }

  function effectsAtCrease(P, pl, neat) {
    const { R } = rectsFor(S, P), cam = camOf(P, R.board);
    const a = pl.spec.a, n = pl.spec.n, t = [-n[1], n[0]], ext = 0.45;
    const p0 = project(cam, [a[0] - t[0] * ext, a[1] - t[1] * ext, 0]), p1 = project(cam, [a[0] + t[0] * ext, a[1] + t[1] * ext, 0]);
    P.flash = { x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1], t: 0 };
    const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    addBurst(S.particles, rng, mid[0], mid[1], neat > 0.8 ? 16 : 8, ['#fff5d0', '#ffe3a0', '#ffffff'], { min: 40, max: 220, life: 0.7, size0: 3, size1: 6, g: 120, shape: 'dot' });
    SOUNDS.land(neat);
    if (!P.studio && !P.autoMode) {
      SOUNDS.chime(neat);
      const txt = neat >= 0.85 ? 'Crisp!' : neat >= 0.6 ? 'Neat' : 'Folded';
      P.pops.push({ x: mid[0], y: mid[1] - 30, t: 0, text: `${txt} ${Math.round(neat * 100)}%`, c: neat >= 0.85 ? '#2f7a4d' : neat >= 0.6 ? '#27406b' : '#8a6a3a' });
    }
    P.autoNeat = null;
  }

  // ------------------------------------------------------------------------------ steps that are not folds
  function startTurn(P) {
    if (P.phase !== 'idle') return;
    P.phase = 'turn'; P.anim = { kind: 'turn', t: 0, dur: 0.85 };
    SOUNDS.turn();
  }
  function startHint(P) {
    if (P.phase !== 'idle' || P.studio || !stepOf(P)) return;
    P.hints += 1; P.hintT = 0; P.phase = 'hint'; SOUNDS.hint();
  }
  function startUndo(P) {
    if (P.phase !== 'idle') return;
    if (P.studio) {
      if (!P.st.hist.length) { toast('Nothing to undo'); return; }
      P.st = revert(P.st); P.last = false; SOUNDS.undo(); return;
    }
    if (P.k <= 0) { toast('Nothing to undo'); return; }
    const m = MODELS[P.mi], prev = stateAt(m, P.k - 1), step = m.steps[P.k - 1];
    SOUNDS.undo();
    P.neat.length = P.k - 1;
    if (step.type === 'turn') P.anim = { kind: 'turn', t: 0, dur: 0.6, prev };
    else if (step.type === 'fold') {
      const pl = planFold(prev, step.spec); pl.creasesAll = withCreases(prev.creases, pl);
      P.anim = { kind: 'fold', t: 0, dur: 0.6, prev, plan: pl, from: Math.PI, to: 0 };
    } else {
      const h = lastFold(prev), pl = planFold(P.st, h.spec); pl.creasesAll = P.st.creases;
      P.anim = { kind: 'fold', t: 0, dur: 0.6, prev, plan: pl, from: 0, to: Math.PI };
    }
    P.k -= 1; P.plan = null; P.phase = 'undo'; P.theta = P.anim.from ?? 0;
  }
  function restart(P) {
    if (P.studio) { P.st = newSheet(0); P.last = false; P.plan = null; P.phase = 'idle'; P.theta = 0; P.snapCam = true; return; }
    Object.assign(P, newPlay(P.mi, { paperId: P.paperId }));
    enterStep(P); P.snapCam = true; S.overlay = null;
  }

  function beginReveal(P) {
    const m = MODELS[P.mi];
    P.phase = 'reveal'; P.revT = 0; P.poseK = 0; P.decalK = 0; P.plan = null; P.theta = 0;
    const v = P.neat.filter((x) => typeof x === 'number');
    const avg = v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0.9;
    const stars = avg >= 0.7 && P.hints === 0 ? 3 : avg >= 0.45 && P.hints <= 2 ? 2 : 1;
    P.result = { stars, neat: avg, hints: P.hints };
    if (!P.autoMode) {
      const old = S.progress.done[m.id];
      const before = doneCount(S, m.chapter);
      S.progress.done[m.id] = { stars: Math.max(old?.stars ?? 0, stars), neat: Math.max(old?.neat ?? 0, avg), hints: old ? Math.min(old.hints, P.hints) : P.hints };
      saveProgress();
      const nc = m.chapter + 1;
      const opened = nc < CHAPTERS.length && before < 2 && doneCount(S, m.chapter) >= 2 ? nc : null;
      S.winInfo = { ...P.result, newChapter: opened };
    }
    const { R } = rectsFor(S, P), cam = camOf(P, R.board);
    for (let i = 0; i < 3; i++) addBurst(S.particles, rng, cam.x + (i - 1) * R.board.w * 0.3, cam.y - R.board.h * 0.25, 22, ['#d9482b', '#e98fa0', '#c79a2e', '#27406b', '#3a7a58'], { min: 80, max: 360, up: 240, life: 1.8, size0: 6, size1: 12, g: 520 });
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  function startAuto() {
    const ids = AUTO_MODELS.map((id) => MODELS.findIndex((m) => m.id === id)).filter((i) => i >= 0);
    S.auto = { ids, k: 0, phase: 'intro', t: 0, paused: false, cands: [] };
    S.scene = 'auto'; S.overlay = null; S.drag = false; S.particles.length = 0;
    startAutoModel();
  }
  function startAutoModel() {
    const a = S.auto, mi = a.ids[a.k], m = MODELS[mi];
    const P = newPlay(mi, { paperId: m.paper });
    P.autoMode = true; getPaper(P.paperId, m.back);
    S.play = P; enterStep(P);
    a.phase = 'intro'; a.t = 0;
  }
  // The candidate crease lines shown while the game "thinks": the real one hidden among two plausible others.
  function autoCandidates(P) {
    const step = stepOf(P);
    if (!step || step.type !== 'fold') return [];
    const b = bounds(P.st.polys), real = step.spec, r2 = Math.SQRT1_2;
    const lines = [
      { a: [b.cx, b.cy], n: [1, 0] }, { a: [b.cx, b.cy], n: [0, 1] }, { a: [b.cx, b.cy], n: [r2, r2] }, { a: [b.cx, b.cy], n: [r2, -r2] },
      { a: [b.x0 + b.w * 0.25, b.cy], n: [1, 0] }, { a: [b.cx, b.y0 + b.h * 0.25], n: [0, 1] },
    ].filter((l) => !(Math.abs(l.n[0] * real.n[0] + l.n[1] * real.n[1]) > 0.985 && Math.abs(side(l.a, real.a, real.n)) < 0.08));
    const out = rng.shuffle(lines).slice(0, 2);
    out.splice(rng.int(3), 0, { a: real.a, n: real.n, real: true });
    return out;
  }
  function updateAuto(dt) {
    const a = S.auto, P = S.play;
    if (a.paused || !P) return;
    a.t += dt;
    if (P.phase === 'reveal') {
      if (a.phase !== 'celebrate') { a.phase = 'celebrate'; a.t = 0; }
      if (a.t >= 3.4) {
        if (a.k + 1 < a.ids.length) { a.k += 1; startAutoModel(); } else { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
      }
      return;
    }
    if (a.phase === 'intro') { if (a.t >= 1.3) { a.phase = 'think'; a.t = 0; a.cands = autoCandidates(P); } return; }
    const step = stepOf(P);
    if (!step) return;
    if (a.phase === 'think') {
      if (a.t >= THINK_STEPS[S.thinkIdx]) { a.phase = 'reveal'; a.t = 0; }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2) {
        a.phase = 'act'; a.t = 0;
        if (step.type === 'turn') { P.phase = 'turn'; P.anim = { kind: 'turn', t: 0, dur: 1.0 }; SOUNDS.turn(); }
        else { P.phase = 'auto'; P.thetaT = P.plan.dir > 0 ? Math.PI : 0; P.anim = { t: 0, dur: 1.3, from: P.plan.dir > 0 ? 0 : Math.PI }; SOUNDS.rustle(); }
      }
    } else if (a.phase === 'act' && P.phase === 'idle') { a.phase = 'think'; a.t = 0; a.cands = autoCandidates(P); }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N; seeds 900001..900009 stage a real moment of play instead of random input.
  function stageShot(n) {
    const mIdx = (id) => MODELS.findIndex((m) => m.id === id);
    S.shot = true;
    ['kite', 'envelope', 'house', 'puppy'].forEach((id, i) => { S.progress.done[id] = { stars: [3, 2, 3, 2][i], neat: 0.8, hints: 0 }; });
    const goStep = (P, k) => { P.k = k; P.st = stateAt(MODELS[P.mi], k); enterStep(P); P.snapCam = true; };
    const finish = (P) => { const m = MODELS[P.mi]; P.st = stateAt(m, m.steps.length); P.k = m.steps.length; P.neat = m.steps.map(() => 0.9); beginReveal(P); S.overlay = null; S.winInfo = null; };
    if (n >= 1 && n <= 3) { // mid fold, held by a finger
      beginModel(mIdx(['kite', 'helmet', 'envelope'][n - 1]));
      const P = S.play;
      goStep(P, [2, 0, 1][n - 1]);
      P.phase = 'drag'; P.drag = { g: P.plan.handle, f: P.plan.handle, dRef: P.plan.D, gt: P.plan.target };
      P.thetaF = [1.25, 1.5, 1.1][n - 1]; P.theta = P.thetaF;
    } else if (n === 4) { beginModel(mIdx('puppy')); finish(S.play); S.play.revT = 1.6; S.play.poseK = 1; S.play.decalK = 1; }
    else if (n === 5) S.scene = 'models';
    else if (n === 6) { startAuto(); S.thinkIdx = 0; const a = S.auto; goStep(S.play, 2); a.phase = 'think'; a.t = 1.0; a.cands = autoCandidates(S.play); }
    else if (n === 7) { beginModel(mIdx('dart')); finish(S.play); S.play.revT = 1.8; S.play.poseK = 1; S.play.decalK = 1; }
    else if (n === 8) { beginStudio(); const P = S.play; P.st = commitFold(P.st, planFold(P.st, toward([-0.5, -0.5], [0, 0.1]))); P.st = commitFold(P.st, planFold(P.st, toward([0.5, 0.5], [0.05, 0]))); }
    else if (n === 9) { beginModel(mIdx('helmet')); goStep(S.play, 3); S.play.hintT = 0.6; S.play.phase = 'hint'; S.play.hints = 1; }
    if (S.play) { updateCam(S.play, 1, true); S.play.snapCam = false; }
  }

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };
  function toast(msg) { S.toast = msg; S.toastT = 2.4; }

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {}; S.scroll = {}; S.drag = false; S.swipe = null;
    if (scene === 'title' || scene === 'models') { S.play = null; S.auto = null; }
    SOUNDS.ui();
  }
  function setText(d) {
    const n = clamp(S.textIdx + d, 0, TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }
  function openModel(i) {
    if (demoLocked(S, i)) { S.scene = 'demo-limit'; return; }
    if (modelLocked(S, i)) return;
    S.modelIdx = i; S.scroll = {}; S.scene = 'model'; SOUNDS.ui();
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('mdl:')) { openModel(Number(id.slice(4))); return; }
    if (id.startsWith('paper:')) { S.paperSel[MODELS[S.modelIdx].id] = id.slice(6); saveSettings(); SOUNDS.ui(); return; }
    switch (id) {
      case 'play':
        if (totalDone(S) === 0 && !modelLocked(S, 0)) { beginModel(0); return; }
        gotoScene('models'); return;
      case 'fold': beginModel(S.modelIdx, paperOf(S, MODELS[S.modelIdx])); return;
      case 'studio': beginStudio(); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': gotoScene(S.scene === 'model' ? 'models' : 'title'); return;
      case 'menu': gotoScene('title'); return;
      case 'set:sound': S.sound = !S.sound; audio.setMuted(!S.sound); saveSettings(); if (S.sound) SOUNDS.ui(); return;
      case 'set:think-': S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); return;
      case 'set:think+': S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); return;
      case 'set:restore': Promise.resolve(env.monetization?.restore?.()).then(refreshOwns); return;
      case 'set:unlock': Promise.resolve(env.monetization?.purchase?.('unlock_game')).then(refreshOwns); return;
      case 'set:reset':
        if (!S.resetArm) { S.resetArm = true; return; }
        S.progress = { done: {} }; saveProgress(); S.resetArm = false; return;
      case 'ov:resume': S.overlay = null; return;
      case 'ov:restart': case 'ov:again': S.overlay = null; restart(S.play); return;
      case 'ov:models': { const st = S.scene === 'studio'; S.overlay = null; S.play = null; gotoScene(st ? 'title' : 'models'); return; }
      case 'ov:next': {
        const n = S.play.mi + 1;
        S.overlay = null;
        if (n >= MODELS.length) { gotoScene('models'); return; }
        if (demoLocked(S, n)) { S.play = null; S.scene = 'demo-limit'; return; }
        if (modelLocked(S, n)) { gotoScene('models'); return; }
        beginModel(n, paperOf(S, MODELS[n])); return;
      }
      case 'ov:devsolve': devSolve(); return;
      case 'ov:autoagain': S.overlay = null; startAuto(); return;
      case 'ov:autoexit': S.overlay = null; S.auto = null; S.play = null; gotoScene('title'); return;
      default:
    }
  }

  function devSolve() {
    const P = S.play;
    S.overlay = null;
    if (!P || P.studio || P.phase === 'reveal') return;
    const m = MODELS[P.mi];
    while (P.k < m.steps.length) { P.st = applyStep(P.st, m.steps[P.k]); P.neat[P.k] = 0.9; P.k += 1; }
    beginReveal(P);
  }

  // ------------------------------------------------------------------------------ pointer handling
  const fixedHit = (ui, x, y) => ui.fixed.find((f) => f.id != null && !f.disabled && inRect(x, y, f.rect)) ?? null;

  function onDown(x, y) {
    S.toast = null;
    if ((S.scene === 'play' || S.scene === 'studio') && !S.overlay) { playDown(x, y); return; }
    if (S.scene === 'auto' && !S.overlay) { autoDown(x, y); return; }
    const ui = buildUi(S);
    if (!ui.layout) return;
    const f = fixedHit(ui, x, y);
    if (f) { S.press = { id: f.id, active: true, kind: 'fixed', rect: f.rect }; return; }
    const reg = ui.region;
    if (inRect(x, y, { x: reg.x - 6, y: reg.y - 4, w: reg.w + 12, h: reg.h + 8 })) {
      const hit = hitDoc(ui.layout, x - reg.x, y - reg.y - (ui.offY || 0) + getScroll(ui));
      const ok = Boolean(hit && !hit.disabled);
      S.press = { id: ok ? hit.id : null, active: ok, kind: 'doc', x0: x, y0: y, scroll0: getScroll(ui), scrolling: false, lastY: y, vel: 0 };
      S.scrollVel = {};
    } else S.press = null;
  }

  function onMove(x, y, dt) {
    if (S.drag && S.play) { dragTo(S.play, x, y); return; }
    if (S.swipe) {
      const P = S.play;
      if (Math.abs(x - S.swipe.x0) > 90 && P && P.phase === 'idle') { S.swipe = null; if (P.studio || stepOf(P)?.type === 'turn') startTurn(P); }
      return;
    }
    const pr = S.press;
    if (!pr) return;
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) { S.press = null; return; }
      if (!pr.scrolling && Math.abs(y - pr.y0) > 10) { pr.scrolling = true; pr.active = false; }
      if (pr.scrolling) {
        setScroll(ui, pr.scroll0 - (y - pr.y0));
        pr.vel = pr.vel * 0.6 + (-(y - pr.lastY) / Math.max(dt, 1e-3)) * 0.4;
        pr.lastY = y;
      }
    } else if (pr.rect) pr.active = inRect(x, y, pr.rect);
  }

  function onUp(x, y) {
    if (S.drag && S.play) { S.drag = false; releaseDrag(S.play, x, y); return; }
    S.swipe = null;
    const pr = S.press;
    S.press = null;
    if (!pr) return;
    if (pr.kind === 'doc') {
      const ui = buildUi(S);
      if (!ui.layout || !ui.region) return;
      if (pr.scrolling) { S.scrollVel[ui.scrollKey] = pr.vel; return; }
      const hit = hitDoc(ui.layout, x - ui.region.x, y - ui.region.y - (ui.offY || 0) + getScroll(ui));
      if (hit && hit.id === pr.id && !hit.disabled) activate(hit.id);
    } else if (pr.kind === 'fixed') { if (inRect(x, y, pr.rect)) activate(pr.id); }
    else if (pr.kind === 'hud') { if (inRect(x, y, pr.rect)) hudAction(pr.id); }
    else if (pr.kind === 'auto') { if (inRect(x, y, pr.rect)) autoAction(pr.id); }
  }

  // ---- play
  function swatchRects(P) {
    const { R } = rectsFor(S, P);
    const n = PAPER_IDS.length, gap = 10, sz = Math.min(56, (R.card.w - 32 - gap * (n - 1)) / n), total = n * sz + (n - 1) * gap, x0 = R.card.x + (R.card.w - total) / 2, y = R.card.y + R.card.h - sz - 14;
    return PAPER_IDS.map((_, i) => ({ x: x0 + i * (sz + gap), y, w: sz, h: sz }));
  }
  function playDown(x, y) {
    const P = S.play; if (!P) return;
    const { L, R } = rectsFor(S, P);
    if (inRect(x, y, L.back)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: L.back }; return; }
    if (inRect(x, y, L.pause)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: L.pause }; return; }
    for (let i = 0; i < 4; i++) if (inRect(x, y, R.tools[i])) { S.press = { id: `tool:${i}`, active: true, kind: 'hud', rect: R.tools[i] }; return; }
    if (P.studio) for (const [i, r] of swatchRects(P).entries()) if (inRect(x, y, r)) { S.press = { id: `paper:${i}`, active: true, kind: 'hud', rect: r }; return; }
    if (P.phase === 'reveal' || inRect(x, y, R.card) || (R.panel && inRect(x, y, R.panel))) return;
    const st = !P.studio ? stepOf(P) : null;
    if (st && st.type === 'turn') { S.swipe = { x0: x, y0: y }; return; }
    if (beginDrag(P, x, y)) S.drag = true; else if (P.studio) S.swipe = { x0: x, y0: y };
  }
  function hudAction(id) {
    const P = S.play;
    if (!P) return;
    if (id === 'hud:back') { const st = P.studio; S.overlay = null; S.play = null; gotoScene(st ? 'title' : 'models'); return; }
    if (id === 'hud:pause') { S.overlay = 'pause'; S.ovT = 0; return; }
    if (id.startsWith('paper:')) { const pid = PAPER_IDS[Number(id.slice(6))]; P.paperId = pid; S.studioPaper = pid; getPaper(pid); SOUNDS.ui(); return; }
    const i = Number(id.slice(5));
    if (P.phase !== 'idle') return;
    if (P.studio) {
      if (i === 0) { P.topOnly = !P.topOnly; SOUNDS.ui(); } else if (i === 1) startUndo(P); else if (i === 2) restart(P); else startTurn(P);
      return;
    }
    if (i === 0) startHint(P);
    else if (i === 1) startUndo(P);
    else if (i === 2) restart(P);
    else if (stepOf(P)?.type === 'turn') startTurn(P); else toast('Nothing to turn over yet.');
  }

  // ---- auto
  function autoDown(x, y) {
    const P = S.play; if (!P) return;
    const { L, auto } = rectsFor(S, P);
    if (inRect(x, y, L.back)) { S.press = { id: 'auto:exit', active: true, kind: 'auto', rect: L.back }; return; }
    for (const id of ['slower', 'pause', 'faster']) if (inRect(x, y, auto[id])) { S.press = { id: `auto:${id}`, active: true, kind: 'auto', rect: auto[id] }; return; }
  }
  function autoAction(id) {
    if (id === 'auto:exit') { S.auto = null; S.play = null; gotoScene('title'); }
    else if (id === 'auto:pause') S.auto.paused = !S.auto.paused;
    else if (id === 'auto:slower') { S.thinkIdx = Math.max(0, S.thinkIdx - 1); saveSettings(); }
    else if (id === 'auto:faster') { S.thinkIdx = Math.min(THINK_STEPS.length - 1, S.thinkIdx + 1); saveSettings(); }
  }

  // ---- keyboard
  function onKeys(keys) {
    const has = (c) => keys.pressed.has(c);
    if ((S.scene === 'play' || S.scene === 'studio') && !S.overlay && S.play) {
      if (has('KeyH')) hudAction('tool:0');
      if (has('KeyU')) hudAction('tool:1');
      if (has('KeyR')) hudAction('tool:2');
      if (has('KeyT')) hudAction('tool:3');
      if (has('Escape') || has('KeyP') || has('Space')) { S.overlay = 'pause'; S.ovT = 0; }
      return;
    }
    if (S.overlay === 'pause' && (has('Escape') || has('KeyP') || has('Space'))) { S.overlay = null; return; }
    if (S.scene === 'auto' && S.auto) {
      if (has('Space') || has('KeyP')) S.auto.paused = !S.auto.paused;
      if (has('Escape') && !S.overlay) autoAction('auto:exit');
      return;
    }
    const ui = buildUi(S);
    if (ui.layout && ui.region) {
      if (keys.down.has('ArrowDown')) setScroll(ui, getScroll(ui) + 18);
      if (keys.down.has('ArrowUp')) setScroll(ui, getScroll(ui) - 18);
      if (keys.pressed.has('PageDown')) setScroll(ui, getScroll(ui) + ui.region.h * 0.85);
      if (keys.pressed.has('PageUp')) setScroll(ui, getScroll(ui) - ui.region.h * 0.85);
      if (keys.pressed.has('Home')) setScroll(ui, 0);
      if (keys.pressed.has('End')) setScroll(ui, 1e9);
    }
    if (has('Escape') && ['models', 'model', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) activate('back');
  }

  // ------------------------------------------------------------------------------ the per-frame paper
  function updatePlay(dt) {
    const P = S.play;
    if (!P) return;
    updateCam(P, dt, P.snapCam); P.snapCam = false;
    if (P.glow > 0) P.glow = Math.max(0, P.glow - dt);
    if (P.flash) { P.flash.t += dt; if (P.flash.t > 0.7) P.flash = null; }
    for (const p of P.pops) p.t += dt;
    P.pops = P.pops.filter((p) => p.t < 1.6);
    switch (P.phase) {
      case 'drag': P.theta += (P.thetaF - P.theta) * Math.min(1, dt * 26); break;
      case 'settle': {
        const diff = P.thetaT - P.theta;
        const stepA = Math.max(Math.abs(diff) * Math.min(1, dt * 12), 2.4 * dt);
        P.theta += Math.sign(diff) * Math.min(stepA, Math.abs(diff));
        if (Math.abs(P.thetaT - P.theta) < 1e-3) { P.theta = P.thetaT; landStep(P); }
        break;
      }
      case 'hint': {
        P.hintT += dt;
        const T = P.hintT, wave = T < 0.9 ? ease(T / 0.9) : T < 1.2 ? 1 : T < 1.9 ? 1 - ease((T - 1.2) / 0.7) : 0;
        if (P.plan) P.theta = (P.plan.dir > 0 ? 0 : Math.PI) + (P.plan.dir > 0 ? 1 : -1) * Math.PI * wave * 0.94;
        if (T >= 1.9) { P.phase = 'idle'; P.theta = P.plan && P.plan.dir < 0 ? Math.PI : 0; P.glow = 3.5; }
        break;
      }
      case 'turn':
        P.anim.t += dt;
        if (P.anim.t >= P.anim.dur) {
          P.st = turnSheet(P.st); SOUNDS.land(0.5);
          if (P.studio) { P.phase = 'idle'; P.anim = null; } else { P.k += 1; if (P.k >= MODELS[P.mi].steps.length) beginReveal(P); else enterStep(P); }
        }
        break;
      case 'undo': {
        P.anim.t += dt;
        if (P.anim.kind === 'fold') P.theta = P.anim.from + (P.anim.to - P.anim.from) * ease(Math.min(1, P.anim.t / P.anim.dur));
        if (P.anim.t >= P.anim.dur) { P.st = P.anim.prev; enterStep(P); }
        break;
      }
      case 'auto': {
        P.anim.t += dt;
        P.theta = P.anim.from + (P.thetaT - P.anim.from) * ease(Math.min(1, P.anim.t / P.anim.dur));
        if (P.anim.t >= P.anim.dur) { P.theta = P.thetaT; P.autoNeat = 0.95; landStep(P); }
        break;
      }
      case 'reveal':
        P.revT += dt;
        P.poseK = clamp(P.poseK + dt * 0.75, 0, 1.2);
        P.decalK = clamp((P.revT - 0.9) / 1.5, 0, 1);
        if (!P.autoMode && !S.overlay && P.revT > 3.0) { S.overlay = 'win'; S.ovT = 0; }
        stepWin(P, dt);
        break;
      default:
    }
  }
  function stepWin(P, dt) {
    if (!P.winSeq) P.winSeq = { t: 0, i: 0 };
    const w = P.winSeq;
    w.t += dt;
    while (w.i < WIN_NOTES.length && w.t >= w.i * 0.13) { sfx({ freq: WIN_NOTES[w.i], dur: 0.35, type: 'sine', vol: P.autoMode ? 0.06 : 0.12 }); w.i++; }
  }

  // ------------------------------------------------------------------------------ main loop
  const shotSeed = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search) && config?.seed >= 900001 && config.seed <= 900009 ? config.seed - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  return {
    update(dt, input) {
      if (wheelInput.dy) {
        const dy = wheelInput.dy; wheelInput.dy = 0;
        if (!['play', 'studio', 'auto'].includes(S.scene) || S.overlay) { const ui = buildUi(S); if (ui.layout && ui.region) { setScroll(ui, getScroll(ui) + dy); delete S.scrollVel[ui.scrollKey]; } }
      }
      const frozen = S.scene === 'auto' && S.auto && S.auto.paused;
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.drag && !ptr.down && !ptr.pressed && S.play && !S.shot) { S.drag = false; releaseDrag(S.play, S.lastPtr.x, S.lastPtr.y); }  // the release never reached us
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);

      for (const k of Object.keys(S.scrollVel)) {
        const v = S.scrollVel[k];
        if (Math.abs(v) < 8) { delete S.scrollVel[k]; continue; }
        const ui = buildUi(S);
        if (ui.scrollKey === k && ui.layout && ui.region) setScroll(ui, (S.scroll[k] ?? 0) + v * dt);
        S.scrollVel[k] = v * Math.exp(-dt * 5);
      }

      const inPlay = S.play && (S.scene === 'play' || S.scene === 'studio' || S.scene === 'auto');
      if (!inPlay) { stepParticles(S.particles, dt); return; }
      // Pause (the pause card or Watch & Learn's own Pause) freezes the whole loop: timers, the paper, particles; resume carries on exactly.
      if (S.overlay === 'pause' || frozen) return;
      if (S.scene === 'auto') updateAuto(dt);
      updatePlay(dt);
      stepParticles(S.particles, dt);
    },

    render(ctx) {
      render(ctx, S, buildUi(S), { swatchRects });
    },

    getState() {
      const P = S.play;
      const r3 = (v) => Math.round(v * 1000) / 1000;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, modelIdx: S.modelIdx,
        done: Object.fromEntries(Object.entries(S.progress.done).map(([k, v]) => [k, [v.stars, r3(v.neat), v.hints]])), scroll: S.scroll,
        auto: S.auto ? { k: S.auto.k, phase: S.auto.phase, t: r3(S.auto.t), paused: S.auto.paused } : null,
        play: P ? {
          mi: P.mi, k: P.k, phase: P.phase, theta: r3(P.theta), hints: P.hints, neat: P.neat.map((v) => (typeof v === 'number' ? r3(v) : null)), studio: P.studio,
          layers: P.st.polys.length, creases: P.st.creases.length, turned: P.st.turned, result: P.result ?? null, revT: r3(P.revT), paper: P.paperId,
          cam: [r3(P.cam.S), r3(P.cam.cx), r3(P.cam.cy)], handle: P.plan?.handle ? P.plan.handle.map(r3) : null, target: P.plan?.target ? P.plan.target.map(r3) : null,
        } : null,
      };
    },

    // Dev tools only (?dev=1): the check scripts drive screens and read layout rects through this.
    dbg: config?.dev ? { S, buildUi: () => buildUi(S), goto: gotoScene, activate, beginModel, startAuto, devSolve, rectsFor: () => rectsFor(S, S.play), toFlat: (x, y) => toFlat(S.play, x, y) } : undefined,

    // The preview clock counts real folding only. Menus, model screens, Rules / How to Play / About, Settings, every overlay, the
    // finished-model reveal and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || !(S.scene === 'play' || S.scene === 'studio') || Boolean(S.overlay) || Boolean(S.play && S.play.phase === 'reveal'),
  };
}
