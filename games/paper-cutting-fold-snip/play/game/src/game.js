// GAME CONTRACT (docs/GAME-CONTRACT.md). Paper Cutting, see design/GDD.md.
import { meta, inRect } from './layout.js';
import { LEVELS, CHAPTERS, traditionOf } from './levels.js';
import {
  SHEETS, SHAPES, TURNS, cellMap, holesOf, overlap, holeFraction, pieces, cutPoly, punch, foldName, foldWords, viewRoll,
} from './shapes.js';
import { unproject, project, PAPERS } from './paperview.js';
import { TEXT_SCALES, hitDoc, clampScroll } from './ui.js';
import { buildUi, THINK_STEPS, totalDone, doneCount, levelLocked, demoLocked, GALLERY_MAX } from './screens.js';
import { rectsFor, camOf, fitTarget, pointsOf, planOf, stepsOf, levelOf, resultButtons, paperFor } from './playcommon.js';
import { addBurst, stepParticles } from './art.js';
import { render } from './view.js';
import { tr } from './content.js';

export { meta };
export const wheelInput = { dy: 0 };

const VERSION = '1.0.0';
const MAX_CUTS = 60;
const MIN_AREA = 0.0011;            // sheet units squared: a snip that encloses less is ignored
const STAR_MATCH = [0.75, 0.87, 0.94];
const AUTO_LEVELS = ['half', 'eighth', 'snow1'];
const FOLD_SECS = 0.8, UNFOLD_SECS = 0.95;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r4 = (v) => Math.round(v * 10000) / 10000;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Douglas-Peucker simplification of a drawn path
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let best = -1, bd = eps;
    const ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, l2 = dx * dx + dy * dy || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const t = clamp(((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2, 0, 1);
      const d = Math.hypot(pts[i][0] - ax - t * dx, pts[i][1] - ay - t * dy);
      if (d > bd) { bd = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; st.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const polyArea = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s) / 2; };

const targetCache = new Map();
export function targetOf(li) {
  let t = targetCache.get(li);
  if (!t) { const lv = LEVELS[li]; t = holesOf(cellMap(lv.sheet, lv.ref), lv.cuts); targetCache.set(li, t); }
  return t;
}
export const starsFor = (match, cuts, par, hints) => (match >= STAR_MATCH[2] && cuts <= par + 1 && hints === 0 ? 3 : match >= STAR_MATCH[1] ? 2 : match >= STAR_MATCH[0] ? 1 : 0);

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const S = {
    scene: 'title', overlay: null, t: 0, ovT: 0, sound: true, textIdx: 0, thinkIdx: 1,
    progress: { done: {} }, gallery: [], levelIdx: 0, scroll: {}, scrollVel: {}, press: null,
    play: null, auto: null, particles: [], toast: null, toastT: 0,
    demo: Boolean(config?.demo), dev: Boolean(config?.dev), owns: false, price: '', resetArm: false, version: VERSION, shot: false,
    lastPtr: { x: 0, y: 0 }, drag: false, studioSheet: 'square', studioPaper: 'red',
  };

  const [prog, set, gal] = await Promise.all([storage.get('pc.progress', null), storage.get('pc.settings', null), storage.get('pc.gallery', null)]);
  if (prog && prog.done) S.progress = { done: prog.done };
  if (Array.isArray(gal)) S.gallery = gal.filter((g) => g && SHEETS[g.sheet] && Array.isArray(g.cuts)).slice(0, GALLERY_MAX);
  if (set) {
    if (typeof set.sound === 'boolean') S.sound = set.sound;
    if (Number.isInteger(set.textIdx)) S.textIdx = clamp(set.textIdx, 0, TEXT_SCALES.length - 1);
    if (Number.isInteger(set.thinkIdx)) S.thinkIdx = clamp(set.thinkIdx, 0, THINK_STEPS.length - 1);
    if (SHEETS[set.studioSheet]) S.studioSheet = set.studioSheet;
    if (PAPERS[set.studioPaper]) S.studioPaper = set.studioPaper;
  }
  audio.setMuted(!S.sound);
  const refreshOwns = () => { S.owns = Boolean(env.monetization?.owns?.('unlock_game')); S.price = env.monetization?.priceOf?.('unlock_game') ?? ''; };
  refreshOwns();
  env.monetization?.onChange?.(refreshOwns);
  const saveSettings = () => storage.set('pc.settings', { sound: S.sound, textIdx: S.textIdx, thinkIdx: S.thinkIdx, studioSheet: S.studioSheet, studioPaper: S.studioPaper });
  const saveProgress = () => storage.set('pc.progress', S.progress);
  const saveGallery = () => storage.set('pc.gallery', S.gallery);

  // ------------------------------------------------------------------------------ sound (synthesised paper and scissors)
  const sfx = (o) => { if (S.sound) audio.tone(o); };
  const SOUNDS = {
    rustle: () => { sfx({ freq: 2200, to: 900, dur: 0.1, type: 'sawtooth', vol: 0.03 }); sfx({ freq: 1500, to: 600, dur: 0.14, type: 'triangle', vol: 0.035 }); },
    land: () => { sfx({ freq: 260, to: 120, dur: 0.07, type: 'triangle', vol: 0.18 }); sfx({ freq: 1500, to: 900, dur: 0.05, type: 'square', vol: 0.03 }); },
    snip: () => { sfx({ freq: 2600, to: 1500, dur: 0.05, type: 'square', vol: 0.05 }); sfx({ freq: 3100, to: 1700, dur: 0.06, type: 'square', vol: 0.04 }); },
    punch: () => { sfx({ freq: 190, to: 90, dur: 0.09, type: 'sine', vol: 0.22 }); sfx({ freq: 1800, to: 900, dur: 0.04, type: 'square', vol: 0.04 }); },
    chime: (q = 0.5) => sfx({ freq: 700 + q * 500, to: 900 + q * 600, dur: 0.2, type: 'sine', vol: 0.07 }),
    hint: () => sfx({ freq: 660, dur: 0.12, type: 'sine', vol: 0.1 }),
    ui: () => sfx({ freq: 560, to: 700, dur: 0.05, type: 'sine', vol: 0.07 }),
    undo: () => sfx({ freq: 520, to: 330, dur: 0.1, type: 'triangle', vol: 0.08 }),
    open: () => { sfx({ freq: 300, to: 520, dur: 0.14, type: 'triangle', vol: 0.06 }); sfx({ freq: 1900, to: 2600, dur: 0.12, type: 'sawtooth', vol: 0.02 }); },
  };
  const WIN_NOTES = [523, 587, 659, 784, 880, 1047];

  // ------------------------------------------------------------------------------ play objects
  const newPlay = (o) => ({
    mode: 'level', li: -1, sheet: 'square', paper: 'red', n: 0, cuts: [], phase: 'choose', fk: 0, uk: 0, theta: 0, anim: { t: 0, dur: FOLD_SECS }, speed: 1,
    tool: 'punch', shape: 'petal', size: 2, turn: 0, stroke: null, ghost: null, hints: 0, hintT: 99, hintCut: -1, hintLine: '', hintFold: false, confirmChange: false, confirmT: 0, wait: 0,
    cam: { S: 300, cx: 0, cy: 0, tilt: 0.42, yaw: 0, roll: 0 }, snapCam: true, result: null, holes: null, revT: 0, winSeq: null, flash: [], title: '', note: '', gi: null, savedFlag: false, ...o,
  });

  function beginLevel(li) {
    const lv = LEVELS[li];
    S.levelIdx = li;
    const P = newPlay({ mode: 'level', li, sheet: lv.sheet, paper: lv.paper });
    S.play = P; S.scene = 'play'; S.overlay = null; S.drag = false; S.press = null; S.particles.length = 0;
    if (lv.folds.length === 1) P.wait = 0.7;
  }
  function beginStudio() {
    if (S.demo) { S.scene = 'demo-limit'; return; }
    const P = newPlay({ mode: 'studio', sheet: S.studioSheet, paper: S.studioPaper });
    S.play = P; S.scene = 'play'; S.overlay = null; S.drag = false; S.press = null; S.particles.length = 0;
  }
  function beginView(item) {
    const P = newPlay({ mode: 'view', li: item.li ?? -1, sheet: item.sheet, paper: item.paper, n: item.n, cuts: item.cuts.map((c) => ({ ...c })), title: item.title, note: item.note, gi: item.gi ?? null, phase: 'result', snapCam: true });
    P.holes = holesOf(cellMap(P.sheet, P.n), P.cuts);
    S.play = P; S.scene = 'play'; S.overlay = null; S.drag = false; S.press = null; S.particles.length = 0;
    paperFor(P);
  }

  function startFold(P, n) {
    if (!SHEETS[P.sheet].folds.includes(n) || P.phase === 'folding') return;
    P.n = n; P.cuts = []; P.phase = 'folding'; P.fk = 0; P.theta = 0; P.anim = { t: 0, dur: FOLD_SECS }; P.stroke = null; P.ghost = null; P.hintLine = ''; P.confirmChange = false; P.hintFold = false;
    SOUNDS.rustle();
  }
  function enterCut(P) {
    P.phase = 'cut'; P.theta = 0;
    SOUNDS.land();
  }
  function startUnfold(P) {
    if (P.phase !== 'cut') return false;
    if (!P.cuts.length) { toast(tr('noCuts')); return false; }
    const M = cellMap(P.sheet, P.n);
    P.holes = holesOf(M, P.cuts);
    const hf = holeFraction(P.holes, M), pc = pieces(M, P.holes);
    const lv = levelOf(P);
    if (lv) {
      const match = overlap(P.holes, targetOf(P.li));
      P.result = { match, cuts: P.cuts.length, par: lv.par, pieces: pc.n, hole: hf, hints: P.hints, stars: starsFor(match, P.cuts.length, lv.par, P.hints) };
    } else P.result = { match: null, cuts: P.cuts.length, par: null, pieces: pc.n, hole: hf, hints: 0, stars: 0 };
    paperFor(P, true);
    P.phase = 'unfolding'; P.uk = stepsOf(P) - 1; P.theta = Math.PI; P.anim = { t: 0, dur: UNFOLD_SECS }; P.stroke = null; P.ghost = null; P.hintLine = ''; P.hintT = 99; P.hintCut = -1;
    SOUNDS.open();
    return true;
  }
  function startRefold(P) {
    if (P.phase !== 'result' || !P.n || P.mode === 'view') return;
    paperFor(P, true);
    P.phase = 'refolding'; P.uk = 0; P.theta = 0; P.anim = { t: 0, dur: FOLD_SECS }; S.particles.length = 0;
    SOUNDS.rustle();
  }

  // ------------------------------------------------------------------------------ camera
  function camTarget(P, board) {
    const sheetPts = SHEETS[P.sheet].pts;
    const plan = P.n ? planOf(P) : null;
    if (!plan || P.phase === 'choose') return { ...fitTarget(board, sheetPts, 0, 0.16), tilt: 0.42, roll: 0, yaw: 0 };
    const steps = plan.plans.length, st = plan.states;
    if (P.phase === 'folding') {
      const k = P.fk, b = [...pointsOf(st[k].polys), ...pointsOf(st[k + 1].polys)];
      return { ...fitTarget(board, b, 0, 0.18), tilt: 0.42, roll: 0, yaw: 0 };
    }
    if (P.phase === 'cut') return { ...fitTarget(board, plan.wedge, viewRoll(P.n), 0.12), tilt: 0.2, roll: viewRoll(P.n), yaw: 0 };
    if (P.phase === 'unfolding' || P.phase === 'refolding') {
      const k = P.uk, b = [...pointsOf(st[k].polys), ...pointsOf(st[k + 1].polys)];
      const frac = steps ? (P.phase === 'unfolding' ? k / steps : (steps - k) / steps) : 0;
      return { ...fitTarget(board, b, 0, 0.18), tilt: 0.42, roll: viewRoll(P.n) * clamp(frac, 0, 1), yaw: 0 };
    }
    return { ...fitTarget(board, sheetPts, 0, 0.16), tilt: 0.34, roll: 0, yaw: 0.16 * Math.sin(S.t * 0.7) };
  }
  function updateCam(P, dt) {
    const { R } = rectsFor(S, P);
    const tg = camTarget(P, R.board);
    const snap = P.snapCam;
    const k = snap ? 1 : 1 - Math.exp(-dt * (P.phase === 'cut' ? 6 : 4.5));
    for (const key of ['S', 'cx', 'cy', 'tilt', 'yaw']) P.cam[key] += (tg[key] - P.cam[key]) * k;
    P.cam.roll += (tg.roll - P.cam.roll) * (snap ? 1 : 1 - Math.exp(-dt * 5));
    P.snapCam = false;
  }

  // ------------------------------------------------------------------------------ cutting
  const toFlat = (P, x, y) => unproject(camOf(P, rectsFor(S, P).R.board), x, y);
  const screenOf = (P, x, y) => project(camOf(P, rectsFor(S, P).R.board), [x, y, 0]);

  function addCut(P, cut, fxKind) {
    if (P.cuts.length >= MAX_CUTS) { toast(tr('maxCuts')); return false; }
    const M = cellMap(P.sheet, P.n), holes = holesOf(M, [cut]);
    let any = 0; for (let i = 0; i < holes.length; i++) any += holes[i];
    if (any < 3) { toast(cut.k === 'p' ? tr('onPaper') : tr('tooSmall')); return false; }
    P.cuts.push(cut);
    P.hintLine = ''; P.hintT = 99; P.hintCut = -1;
    const poly = cutPoly(cut);
    const c = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]), sc = screenOf(P, c[0], c[1]);
    const def = PAPERS[P.paper];
    addBurst(S.particles, rng, sc[0], sc[1], fxKind === 'p' ? 10 : 16, [def.c0, def.c1, def.back], { min: 40, max: 200, life: 0.9, size0: 4, size1: 9, g: 520, shape: 'chip' });
    if (fxKind === 'p') SOUNDS.punch(); else SOUNDS.snip();
    P.flash = [{ cut, t: 0 }];
    return true;
  }

  function finishStroke(P) {
    const s = P.stroke; P.stroke = null;
    if (!s || s.pts.length < 3) { if (s) toast(tr('tooSmall')); return; }
    const pts = simplify(s.pts, 0.0035).slice(0, 160);
    if (pts.length < 3 || polyArea(pts) < MIN_AREA) { toast(tr('tooSmall')); return; }
    addCut(P, { k: 's', p: pts.flatMap((p) => [r4(p[0]), r4(p[1])]) }, 's');
  }

  function beginCut(P, x, y) {
    const f = toFlat(P, x, y);
    S.drag = true;
    if (P.tool === 'scissors') P.stroke = { pts: [f] }; else P.ghost = { x: f[0], y: f[1] };
  }
  function dragCut(P, x, y) {
    const f = toFlat(P, x, y);
    if (P.tool === 'scissors' && P.stroke) {
      const l = P.stroke.pts[P.stroke.pts.length - 1];
      if (Math.hypot(f[0] - l[0], f[1] - l[1]) > 0.005 && P.stroke.pts.length < 700) P.stroke.pts.push(f);
    } else if (P.ghost) { P.ghost.x = f[0]; P.ghost.y = f[1]; }
  }
  function releaseCut(P, x, y) {
    if (P.phase !== 'cut') { P.stroke = null; P.ghost = null; return; }
    dragCut(P, x, y);
    if (P.tool === 'scissors') finishStroke(P);
    else if (P.ghost) { const g = P.ghost; P.ghost = null; addCut(P, punch(P.shape, g.x, g.y, P.size, P.turn), 'p'); }
  }

  function undoCut(P) {
    if (P.phase !== 'cut') return;
    if (!P.cuts.length) { toast('Nothing to undo'); return; }
    P.cuts.pop(); P.hintLine = ''; SOUNDS.undo();
  }
  function clearCuts(P) {
    if (P.phase !== 'cut') return;
    if (!P.cuts.length) { toast('Nothing to clear'); return; }
    P.cuts.length = 0; P.hintLine = ''; SOUNDS.undo();
  }
  function changeFold(P) {
    if (P.phase !== 'cut') return;
    if (P.cuts.length && !P.confirmChange) { P.confirmChange = true; P.confirmT = 3; return; }
    P.cuts = []; P.n = 0; P.phase = 'choose'; P.fk = 0; P.stroke = null; P.ghost = null; P.confirmChange = false; P.hintLine = ''; SOUNDS.undo();
  }

  function startHint(P) {
    const lv = levelOf(P);
    if (!lv || P.mode !== 'level') return;
    if (P.phase === 'choose') { P.hints += 1; P.hintFold = true; P.hintT = 0; P.hintLine = tr('foldHint', { f: foldWords(lv.ref) }); SOUNDS.hint(); return; }
    if (P.phase !== 'cut') return;
    P.hints += 1; SOUNDS.hint();
    if (P.n !== lv.ref) { P.hintLine = tr('foldHint', { f: foldWords(lv.ref) }); P.hintT = 99; P.hintCut = -1; return; }
    // the first reference cut that has no matching cut of yours (same shape near the same place)
    let idx = lv.cuts.findIndex((c) => !P.cuts.some((u) => u.k === 'p' && u.s === c.s && Math.hypot(u.x - c.x, u.y - c.y) < 0.07));
    if (idx < 0) idx = 0;
    P.hintCut = idx; P.hintT = 0; P.hintLine = lv.why[idx] ?? '';
  }

  function finishResult(P) {
    P.phase = 'result'; P.revT = 0; P.winSeq = null;
    const r = P.result;
    const def = PAPERS[P.paper], { R } = rectsFor(S, P), cam = camOf(P, R.board);
    for (let i = 0; i < 3; i++) addBurst(S.particles, rng, cam.x + (i - 1) * R.board.w * 0.3, cam.y - R.board.h * 0.3, 18, [def.c0, def.c1, def.back, '#f6d27a'], { min: 80, max: 340, up: 220, life: 1.7, size0: 6, size1: 12, g: 520, shape: 'chip' });
    if (P.mode === 'level' && r) {
      const lv = levelOf(P), old = S.progress.done[lv.id];
      if (r.stars >= 1) {
        S.progress.done[lv.id] = { stars: Math.max(old?.stars ?? 0, r.stars), match: Math.max(old?.match ?? 0, r.match), cuts: old ? Math.min(old.cuts, r.cuts) : r.cuts, hints: old ? Math.min(old.hints, r.hints) : r.hints };
        saveProgress();
      }
      r.newChapter = null;
      const nc = lv.ch + 1;
      if (r.stars >= 1 && !old && nc < CHAPTERS.length && doneCount(S, lv.ch) === 3) r.newChapter = nc;
    }
    SOUNDS.chime(0.6);
  }

  // ------------------------------------------------------------------------------ Watch & Learn
  function startAuto() {
    const ids = AUTO_LEVELS.map((id) => LEVELS.findIndex((l) => l.id === id)).filter((i) => i >= 0);
    S.auto = { ids, k: 0, ci: 0, phase: 'intro', t: 0, paused: false, cands: [], line: '' };
    S.scene = 'auto'; S.overlay = null; S.drag = false; S.particles.length = 0;
    startAutoLevel();
  }
  function startAutoLevel() {
    const a = S.auto, li = a.ids[a.k], lv = LEVELS[li];
    const P = newPlay({ mode: 'auto', li, sheet: lv.sheet, paper: lv.paper });
    S.play = P; S.levelIdx = li;
    a.phase = 'intro'; a.t = 0; a.ci = 0; a.cands = [];
    a.line = `${lv.name}: ${tr('autoFold')} ${foldWords(lv.ref)} (${foldName(lv.ref)}).`;
  }
  // three candidate cuts: the real one hidden among two plausible others
  function autoCandidates(lv, ci) {
    const real = lv.cuts[ci];
    const decoy = (shape, dx, dy, turn) => ({ k: 'p', s: shape, x: real.x + dx, y: real.y + dy, z: clamp(real.z + (rng.next() < 0.5 ? -1 : 1), 0, 3), a: turn });
    const others = rng.shuffle([decoy(SHAPES[(SHAPES.indexOf(real.s) + 2) % SHAPES.length], 0.05, -0.04, (real.a + 2) % TURNS), decoy(SHAPES[(SHAPES.indexOf(real.s) + 4) % SHAPES.length], -0.06, 0.05, (real.a + 5) % TURNS), decoy(real.s, 0.07, 0.03, (real.a + 4) % TURNS)]).slice(0, 2);
    const out = [...others];
    out.splice(rng.int(3), 0, { ...real, real: true });
    return out;
  }
  function updateAuto(dt) {
    const a = S.auto, P = S.play;
    if (a.paused || !P) return;
    a.t += dt;
    const lv = LEVELS[a.ids[a.k]];
    if (a.phase === 'intro') { if (a.t >= 1.4) { startFold(P, lv.ref); a.phase = 'fold'; a.t = 0; } return; }
    if (a.phase === 'fold') {
      if (P.phase === 'cut') { a.phase = 'think'; a.t = 0; a.cands = autoCandidates(lv, a.ci); a.line = `${tr('autoThink')}...`; }
      return;
    }
    if (a.phase === 'think') {
      if (a.t >= THINK_STEPS[S.thinkIdx]) { a.phase = 'reveal'; a.t = 0; a.line = lv.why[a.ci] ?? ''; SOUNDS.hint(); }
    } else if (a.phase === 'reveal') {
      if (a.t >= 2.2) {
        a.phase = 'act'; a.t = 0;
        const c = lv.cuts[a.ci];
        P.cuts.push({ ...c });
        const poly = cutPoly(c), mid = poly.reduce((q, p) => [q[0] + p[0] / poly.length, q[1] + p[1] / poly.length], [0, 0]), sc = screenOf(P, mid[0], mid[1]), def = PAPERS[P.paper];
        addBurst(S.particles, rng, sc[0], sc[1], 12, [def.c0, def.c1, def.back], { min: 40, max: 200, life: 0.9, size0: 4, size1: 9, g: 520, shape: 'chip' });
        P.flash = [{ cut: c, t: 0 }]; SOUNDS.punch();
      }
    } else if (a.phase === 'act') {
      if (a.t >= 1.0) {
        a.ci += 1;
        if (a.ci < lv.cuts.length) { a.phase = 'think'; a.t = 0; a.cands = autoCandidates(lv, a.ci); a.line = `${tr('autoThink')}...`; }
        else { a.phase = 'unfold'; a.t = 0; a.line = `${tr('autoUnfold')}...`; startUnfold(P); }
      }
    } else if (a.phase === 'unfold') {
      if (P.phase === 'result') { a.phase = 'celebrate'; a.t = 0; a.line = `${lv.name}: ${Math.round((P.result?.match ?? 0) * 100)}% ${tr('match').toLowerCase()}.`; }
    } else if (a.phase === 'celebrate') {
      if (a.t >= 3.4) {
        if (a.k + 1 < a.ids.length) { a.k += 1; startAutoLevel(); } else { S.overlay = 'autosum'; S.ovT = 0; a.phase = 'summary'; }
      }
    }
  }

  // ------------------------------------------------------------------------------ store screenshots
  // `tools/arc shots` loads ?shot=1&seed=N; seeds 900001..900009 stage a real moment of play instead of random input.
  function stageShot(n) {
    S.shot = true;
    ['half', 'quarter', 'eighth', 'edge', 'lotus', 'lantern'].forEach((id, i) => { S.progress.done[id] = { stars: [3, 2, 3, 2, 3, 2][i], match: 0.9, cuts: 3, hints: 0 }; });
    const lvIdx = (id) => LEVELS.findIndex((l) => l.id === id);
    const prep = (id, nFold, cuts, phase = 'cut') => {
      beginLevel(lvIdx(id)); const P = S.play; P.wait = 0;
      P.n = nFold; P.cuts = cuts.map((c) => ({ ...c })); P.phase = phase; P.fk = stepsOf(P); P.snapCam = true;
      return P;
    };
    const solved = (id, result) => {
      const lv = LEVELS.find((l) => l.id === id), P = prep(id, lv.ref, lv.cuts, 'cut');
      if (result) { startUnfold(P); P.phase = 'result'; P.theta = 0; finishResult(P); S.particles.length = 0; P.revT = 2; }
      return P;
    };
    if (n === 1) { S.scene = 'title'; S.t = 4.6; }
    else if (n === 2) { const lv = LEVELS.find((l) => l.id === 'eighth'); prep('eighth', 4, lv.cuts.slice(0, 2)); }
    else if (n === 3) solved('lotus', true);
    else if (n === 4) { const lv = LEVELS.find((l) => l.id === 'lantern'), P = prep('lantern', 4, lv.cuts, 'cut'); startUnfold(P); P.uk = 1; P.theta = 1.45; P.anim.t = 0; }
    else if (n === 5) S.scene = 'levels';
    else if (n === 6) solved('butterfly', true);
    else if (n === 7) { beginLevel(lvIdx('choose')); S.play.wait = 0; }
    else if (n === 8) solved('snow1', true);
    else if (n === 9) {
      startAuto(); S.thinkIdx = 0; const a = S.auto, lv = LEVELS[a.ids[1]], P = S.play;
      a.k = 1; startAutoLevel(); const P2 = S.play; P2.n = lv.ref; P2.cuts = lv.cuts.slice(0, 2).map((c) => ({ ...c })); P2.phase = 'cut'; P2.fk = stepsOf(P2);
      a.ci = 2; a.phase = 'think'; a.t = 1.0; a.cands = autoCandidates(lv, 2); a.line = `${tr('autoThink')}...`; void P;
    }
    if (S.play) { S.play.snapCam = true; updateCam(S.play, 1); }
  }

  // ------------------------------------------------------------------------------ ui plumbing
  const getScroll = (ui) => S.scroll[ui.scrollKey] ?? 0;
  const setScroll = (ui, v) => { if (ui.layout && ui.region) S.scroll[ui.scrollKey] = clampScroll(v, ui.layout.height, ui.region.h); };
  function toast(msg) { S.toast = msg; S.toastT = 2.4; }

  function gotoScene(scene) {
    S.scene = scene; S.overlay = null; S.press = null; S.resetArm = false; S.scrollVel = {}; S.scroll = {}; S.drag = false;
    if (scene === 'title' || scene === 'levels' || scene === 'gallery') { S.play = null; S.auto = null; }
    SOUNDS.ui();
  }
  function setText(d) {
    const n = clamp(S.textIdx + d, 0, TEXT_SCALES.length - 1);
    if (n === S.textIdx) return;
    S.textIdx = n; saveSettings(); S.scroll = {};
  }
  function openLevel(i) {
    if (demoLocked(S, i)) { S.scene = 'demo-limit'; return; }
    if (levelLocked(S, i)) return;
    SOUNDS.ui(); beginLevel(i);
  }
  const viewOfLevel = (i) => { const lv = LEVELS[i]; return { li: i, sheet: lv.sheet, paper: lv.paper, n: lv.ref, cuts: lv.cuts, title: lv.name, note: `${traditionOf(lv.tradition)?.name ?? ''}: ${lv.why.join(' ')}` }; };

  function saveToGallery(P) {
    if (!P.cuts.length) return;
    if (S.gallery.length >= GALLERY_MAX) { toast(tr('galleryFull')); return; }
    S.gallery.push({ sheet: P.sheet, paper: P.paper, n: P.n, cuts: P.cuts.map((c) => ({ ...c })) });
    saveGallery(); toast(tr('saved')); SOUNDS.chime(0.8);
    P.savedFlag = true;
  }

  function nextLevelFrom(P) {
    const n = P.li + 1;
    if (n >= LEVELS.length) { S.play = null; gotoScene('levels'); return; }
    if (demoLocked(S, n)) { S.play = null; S.scene = 'demo-limit'; return; }
    if (levelLocked(S, n)) { S.play = null; gotoScene('levels'); return; }
    beginLevel(n);
  }

  function activate(id) {
    if (id == null) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    if (id === 'zoom-') { setText(-1); return; }
    if (id === 'zoom+') { setText(1); return; }
    if (id.startsWith('lvl:')) { openLevel(Number(id.slice(4))); return; }
    if (id.startsWith('gview:')) { SOUNDS.ui(); beginView(viewOfLevel(Number(id.slice(6)))); return; }
    if (id.startsWith('gal:')) { const gi = Number(id.slice(4)), g = S.gallery[gi]; if (g) { SOUNDS.ui(); beginView({ ...g, title: `Cut-out #${gi + 1}`, note: `${SHEETS[g.sheet].name}, folded ${foldWords(g.n)}. ${g.cuts.length} cuts.`, gi }); } return; }
    switch (id) {
      case 'play':
        if (totalDone(S) === 0 && !levelLocked(S, 0)) { beginLevel(0); return; }
        gotoScene('levels'); return;
      case 'studio': beginStudio(); return;
      case 'gallery': gotoScene('gallery'); return;
      case 'auto': startAuto(); return;
      case 'howto': case 'rules': case 'about': case 'settings': gotoScene(id); return;
      case 'back': gotoScene('title'); return;
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
      case 'ov:restart': S.overlay = null; { const P = S.play; if (P && P.mode === 'level') beginLevel(P.li); else if (P && P.mode === 'studio') beginStudio(); } return;
      case 'ov:levels': { const st = S.play && S.play.mode === 'studio'; S.overlay = null; S.play = null; gotoScene(st ? 'title' : 'levels'); return; }
      case 'ov:devsolve': devSolve(); return;
      case 'ov:autoagain': S.overlay = null; startAuto(); return;
      case 'ov:autoexit': S.overlay = null; S.auto = null; S.play = null; gotoScene('title'); return;
      default:
    }
  }

  function devSolve() {
    const P = S.play;
    S.overlay = null;
    if (!P || P.mode !== 'level') return;
    const lv = levelOf(P);
    if (P.phase === 'choose' || P.phase === 'folding') { P.n = lv.ref; P.fk = stepsOf(P); }
    P.n = lv.ref; P.cuts = lv.cuts.map((c) => ({ ...c })); P.phase = 'cut'; P.fk = stepsOf(P);
    startUnfold(P);
  }

  // ------------------------------------------------------------------------------ pointer handling
  const fixedHit = (ui, x, y) => ui.fixed.find((f) => f.id != null && !f.disabled && inRect(x, y, f.rect)) ?? null;

  function onDown(x, y) {
    S.toast = null;
    if (S.scene === 'play' && !S.overlay) { playDown(x, y); return; }
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
    if (S.drag && S.play) { dragCut(S.play, x, y); return; }
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
    if (S.drag && S.play) { S.drag = false; releaseCut(S.play, x, y); return; }
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
  function playDown(x, y) {
    const P = S.play; if (!P) return;
    const { L, R } = rectsFor(S, P);
    if (inRect(x, y, L.back)) { S.press = { id: 'hud:back', active: true, kind: 'hud', rect: L.back }; return; }
    if (inRect(x, y, L.pause)) { S.press = { id: 'hud:pause', active: true, kind: 'hud', rect: L.pause }; return; }
    for (const r of R.rects) if (r.id != null && !r.disabled && inRect(x, y, r)) { S.press = { id: `tool:${r.id}`, active: true, kind: 'hud', rect: r }; return; }
    if (P.phase === 'result' && P.mode !== 'view') {
      for (const b of resultButtons(S, P, R)) if (!b.disabled && inRect(x, y, b)) { S.press = { id: `res:${b.id}`, active: true, kind: 'hud', rect: b }; return; }
      return;
    }
    if (P.phase === 'cut' && inRect(x, y, { x: R.board.x - 6, y: R.board.y - 6, w: R.board.w + 12, h: R.board.h + 12 })) beginCut(P, x, y);
  }
  function hudAction(id) {
    const P = S.play;
    if (!P) return;
    if (id === 'hud:back') {
      S.overlay = null; const m = P.mode; S.play = null;
      gotoScene(m === 'studio' ? 'title' : m === 'view' ? 'gallery' : 'levels'); return;
    }
    if (id === 'hud:pause') { if (P.mode !== 'view') { S.overlay = 'pause'; S.ovT = 0; } return; }
    if (id.startsWith('res:')) { resultAction(P, id.slice(4)); return; }
    const t = id.slice(5);
    if (t.startsWith('fold:')) { startFold(P, Number(t.slice(5))); return; }
    if (t.startsWith('sheet:')) { const sh = t.slice(6); if (SHEETS[sh] && P.phase === 'choose') { P.sheet = sh; S.studioSheet = sh; saveSettings(); SOUNDS.ui(); } return; }
    if (t.startsWith('paper:')) { const pp = t.slice(6); if (PAPERS[pp]) { P.paper = pp; S.studioPaper = pp; saveSettings(); SOUNDS.ui(); } return; }
    if (t.startsWith('shape:')) { P.shape = t.slice(6); SOUNDS.ui(); return; }
    if (t.startsWith('size:')) { P.size = Number(t.slice(5)); SOUNDS.ui(); return; }
    switch (t) {
      case 'tool:scissors': P.tool = 'scissors'; SOUNDS.ui(); break;
      case 'tool:punch': P.tool = 'punch'; SOUNDS.ui(); break;
      case 'turn': P.turn = (P.turn + 1) % TURNS; SOUNDS.ui(); break;
      case 'undo': undoCut(P); break;
      case 'clear': clearCuts(P); break;
      case 'hint': startHint(P); break;
      case 'changefold': changeFold(P); break;
      case 'unfold': startUnfold(P); break;
      case 'skip': P.speed = 4; break;
      case 'view:replay': replayView(P); break;
      case 'view:delete': deleteView(P); break;
      default:
    }
  }
  function replayView(P) {
    P.result = null; P.phase = 'unfolding'; P.uk = stepsOf(P) - 1; P.theta = Math.PI; P.anim = { t: 0, dur: UNFOLD_SECS }; P.snapCam = true; SOUNDS.open();
    paperFor(P, true);
  }
  function deleteView(P) {
    if (P.gi == null) return;
    S.gallery.splice(P.gi, 1); saveGallery(); S.play = null; gotoScene('gallery');
  }
  function resultAction(P, id) {
    if (id === 'next') nextLevelFrom(P);
    else if (id === 'refold') startRefold(P);
    else if (id === 'levels') { S.play = null; gotoScene('levels'); }
    else if (id === 'menu') { S.play = null; gotoScene('title'); }
    else if (id === 'save') saveToGallery(P);
    else if (id === 'again') { if (P.mode === 'level') beginLevel(P.li); else beginStudio(); }
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
    const P = S.play;
    if (S.scene === 'play' && !S.overlay && P) {
      if (P.phase === 'cut') {
        if (has('KeyS')) hudAction('tool:tool:scissors');
        if (has('KeyP')) hudAction('tool:tool:punch');
        if (has('KeyU')) hudAction('tool:undo');
        if (has('KeyC')) hudAction('tool:clear');
        if (has('KeyH')) hudAction('tool:hint');
        if (has('KeyT')) hudAction('tool:turn');
        if (has('Enter')) hudAction('tool:unfold');
      } else if (P.phase === 'choose') {
        const folds = P.mode === 'studio' ? SHEETS[P.sheet].folds : levelOf(P).folds;
        if (has('KeyF')) startFold(P, folds[folds.length - 1]);
        if (has('KeyH')) startHint(P);
      } else if (P.phase === 'result') { if (has('Enter') && P.mode !== 'view') resultAction(P, 'refold'); }
      if (has('Escape')) { if (P.mode === 'view') hudAction('hud:back'); else { S.overlay = 'pause'; S.ovT = 0; } }
      if (has('Space') && P.mode !== 'view') { S.overlay = 'pause'; S.ovT = 0; }
      return;
    }
    if (S.overlay === 'pause' && (has('Escape') || has('Space'))) { S.overlay = null; return; }
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
    if (has('Escape') && ['levels', 'gallery', 'howto', 'rules', 'about', 'settings', 'demo-limit'].includes(S.scene)) activate('back');
  }

  // ------------------------------------------------------------------------------ the per-frame paper
  function updatePlay(dt) {
    const P = S.play;
    if (!P) return;
    updateCam(P, dt);
    P.hintT += dt;
    if (P.hintT > 4 && P.hintCut >= 0) P.hintCut = -1;
    if (P.hintT > 6 && P.hintFold) P.hintFold = false;
    if (P.confirmChange) { P.confirmT -= dt; if (P.confirmT <= 0) P.confirmChange = false; }
    for (const f of P.flash) f.t += dt;
    P.flash = P.flash.filter((f) => f.t < 0.8);
    if (P.wait > 0) { P.wait -= dt; if (P.wait <= 0 && P.phase === 'choose') startFold(P, levelOf(P).folds[0]); }
    const sp = P.speed;
    switch (P.phase) {
      case 'folding': {
        P.anim.t += dt * sp;
        P.theta = Math.PI * easeIO(Math.min(1, P.anim.t / P.anim.dur));
        if (P.anim.t >= P.anim.dur) {
          SOUNDS.land();
          P.fk += 1; P.theta = 0; P.anim.t = 0;
          if (P.fk >= stepsOf(P)) { P.speed = 1; enterCut(P); } else SOUNDS.rustle();
        }
        break;
      }
      case 'unfolding': {
        P.anim.t += dt * sp;
        P.theta = Math.PI * (1 - easeIO(Math.min(1, P.anim.t / P.anim.dur)));
        if (P.anim.t >= P.anim.dur) {
          P.uk -= 1; P.anim.t = 0; P.theta = Math.PI;
          sfx({ freq: 420 + (stepsOf(P) - P.uk) * 70, to: 300, dur: 0.07, type: 'triangle', vol: 0.12 });
          if (P.uk < 0) { P.speed = 1; P.theta = 0; if (P.mode === 'view') { P.phase = 'result'; P.revT = 0; } else finishResult(P); }
        }
        break;
      }
      case 'refolding': {
        P.anim.t += dt * sp;
        P.theta = Math.PI * easeIO(Math.min(1, P.anim.t / P.anim.dur));
        if (P.anim.t >= P.anim.dur) {
          P.uk += 1; P.anim.t = 0; P.theta = 0; SOUNDS.land();
          if (P.uk >= stepsOf(P)) { P.speed = 1; enterCut(P); }
        }
        break;
      }
      case 'result':
        P.revT += dt;
        stepWin(P, dt);
        break;
      default:
    }
  }
  function stepWin(P, dt) {
    if (P.mode === 'view' || !P.result) return;
    if (!P.winSeq) P.winSeq = { t: 0, i: 0 };
    const w = P.winSeq, n = Math.min(WIN_NOTES.length, 2 + P.result.stars * 2);
    w.t += dt;
    while (w.i < n && w.t >= 0.5 + w.i * 0.13) { sfx({ freq: WIN_NOTES[w.i], dur: 0.35, type: 'sine', vol: P.mode === 'auto' ? 0.06 : 0.12 }); w.i++; }
  }

  // ------------------------------------------------------------------------------ main loop
  const shotSeed = typeof location !== 'undefined' && /[?&]shot=1/.test(location.search) && config?.seed >= 900001 && config.seed <= 900009 ? config.seed - 900000 : 0;
  if (shotSeed) stageShot(shotSeed);

  return {
    update(dt, input) {
      if (wheelInput.dy) {
        const dy = wheelInput.dy; wheelInput.dy = 0;
        if (!['play', 'auto'].includes(S.scene) || S.overlay) { const ui = buildUi(S); if (ui.layout && ui.region) { setScroll(ui, getScroll(ui) + dy); delete S.scrollVel[ui.scrollKey]; } }
      }
      const frozen = S.scene === 'auto' && S.auto && S.auto.paused;
      if (!frozen) S.t += dt;
      if (S.overlay) S.ovT += dt;
      if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) S.toast = null; }
      const ptr = S.shot ? { pressed: false, down: false, released: false, x: 0, y: 0 } : input.pointer;
      if (ptr.pressed) onDown(ptr.x, ptr.y);
      else if (ptr.down) onMove(ptr.x, ptr.y, dt);
      if (ptr.released) onUp(ptr.x, ptr.y);
      else if (S.drag && !ptr.down && !ptr.pressed && S.play && !S.shot) { S.drag = false; releaseCut(S.play, S.lastPtr.x, S.lastPtr.y); }  // the release never reached us
      if (ptr.down || ptr.pressed) { S.lastPtr.x = ptr.x; S.lastPtr.y = ptr.y; }
      if (!S.shot && (input.keys.pressed.size || input.keys.down.size)) onKeys(input.keys);

      for (const k of Object.keys(S.scrollVel)) {
        const v = S.scrollVel[k];
        if (Math.abs(v) < 8) { delete S.scrollVel[k]; continue; }
        const ui = buildUi(S);
        if (ui.scrollKey === k && ui.layout && ui.region) setScroll(ui, (S.scroll[k] ?? 0) + v * dt);
        S.scrollVel[k] = v * Math.exp(-dt * 5);
      }

      const inPlay = S.play && (S.scene === 'play' || S.scene === 'auto');
      if (!inPlay) { stepParticles(S.particles, dt); return; }
      // Pause (the pause card or Watch & Learn's own Pause) freezes the whole loop: timers, the paper, particles; resume carries on exactly.
      if (S.overlay === 'pause' || frozen) return;
      if (S.scene === 'auto') updateAuto(dt);
      updatePlay(dt);
      stepParticles(S.particles, dt);
    },

    render(ctx) {
      render(ctx, S, buildUi(S));
    },

    getState() {
      const P = S.play;
      const r3 = (v) => Math.round(v * 1000) / 1000;
      return {
        scene: S.scene, overlay: S.overlay, textIdx: S.textIdx, thinkIdx: S.thinkIdx, sound: S.sound, levelIdx: S.levelIdx,
        done: Object.fromEntries(Object.entries(S.progress.done).map(([k, v]) => [k, [v.stars, r3(v.match), v.cuts, v.hints]])), scroll: S.scroll, gallery: S.gallery.length,
        auto: S.auto ? { k: S.auto.k, ci: S.auto.ci, phase: S.auto.phase, t: r3(S.auto.t), paused: S.auto.paused } : null,
        play: P ? {
          mode: P.mode, li: P.li, phase: P.phase, sheet: P.sheet, paper: P.paper, n: P.n, fk: P.fk, uk: P.uk, theta: r3(P.theta), tool: P.tool, shape: P.shape, size: P.size, turn: P.turn,
          cuts: P.cuts.map((c) => (c.k === 'p' ? [c.s, c.x, c.y, c.z, c.a] : ['s', c.p.length])), hints: P.hints, result: P.result ? { ...P.result, match: P.result.match == null ? null : r3(P.result.match), hole: r3(P.result.hole) } : null,
          cam: [r3(P.cam.S), r3(P.cam.cx), r3(P.cam.cy), r3(P.cam.roll)],
        } : null,
      };
    },

    // Dev tools only (?dev=1): the check scripts drive screens and read layout rects through this.
    dbg: config?.dev ? {
      S, buildUi: () => buildUi(S), goto: gotoScene, activate, beginLevel, beginStudio, startAuto, devSolve, startFold, startUnfold, startRefold, addCut, hudAction, targetOf,
      rectsFor: () => rectsFor(S, S.play), toFlat: (x, y) => toFlat(S.play, x, y), screenOf: (x, y) => screenOf(S.play, x, y), punch,
    } : undefined,

    // The preview clock counts real folding and cutting only. Menus, level screens, the Gallery, Rules / How to Play / About, Settings,
    // every overlay, the unfold and the result card and Watch & Learn are all free time.
    isPreviewExempt: () => S.shot || S.scene !== 'play' || Boolean(S.overlay) || !S.play || S.play.mode === 'view' || ['unfolding', 'refolding', 'result'].includes(S.play.phase),
  };
}
