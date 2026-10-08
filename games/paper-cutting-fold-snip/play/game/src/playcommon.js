// Things the game logic (hit-testing) and the drawing code both need, so they can never disagree:
// the camera over the paper, the caption card, the tool buttons of each phase, the screen rectangles of the play screen and the faces of the paper now.
import { layout, playRects, autoRects, flowGroups } from './layout.js';
import { makeCam, getPaper, bakeCut, PAPER_IDS } from './paperview.js';
import { TEXT_SCALES, wrap } from './ui.js';
import { tr } from './content.js';
import { LEVELS } from './levels.js';
import { SHEETS, SHEET_IDS, SHAPES, SIZE_NAMES, foldName, foldWords, foldPlan, viewRoll, layersOf, cutPoly } from './shapes.js';
import { newSheet, flatFaces, foldFaces, bounds } from './paper.js';

export const textScaleCap = (S) => Math.min(TEXT_SCALES[S.textIdx], 2);
export const levelOf = (P) => (P.li >= 0 ? LEVELS[P.li] : null);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export { ease };

const sheetStates = new Map();
export const flatState = (sheet) => { let s = sheetStates.get(sheet); if (!s) { s = newSheet(SHEETS[sheet].pts); sheetStates.set(sheet, s); } return s; };
export const planOf = (P) => (P.n ? foldPlan(P.sheet, P.n) : null);
export const stepsOf = (P) => (P.n ? planOf(P).plans.length : 0);

// ---- caption --------------------------------------------------------------------------------------------------------------------------
export function captionText(S, P) {
  const lv = levelOf(P);
  if (P.mode === 'auto') return { label: lv.name, text: S.auto?.line ?? lv.text };
  if (P.mode === 'view') return { label: P.title ?? tr('gallery'), text: P.note ?? '' };
  const ph = P.phase;
  if (P.mode === 'studio') {
    if (ph === 'choose') return { label: tr('studioBtn'), text: tr('studioHint') };
    if (ph === 'result') return { label: tr('done'), text: '' };
    return { label: tr('studioBtn'), text: P.n ? `${SHEETS[P.sheet].name}, folded ${foldWords(P.n)} (${foldName(P.n)}). Snip the wedge, then Unfold.` : tr('studioHint') };
  }
  if (ph === 'choose') return { label: lv.name, text: `${lv.text}\n${tr('foldPick')}.` };
  if (P.hintLine) return { label: `${lv.name} · ${tr('hint')}`, text: P.hintLine };
  return { label: lv.name, text: lv.text };
}

export function captionOf(S, P) {
  const L = layout(), sc = textScaleCap(S);
  const { label, text } = captionText(S, P);
  const hasThumb = P.li >= 0 && P.mode !== 'view';
  const panelW = L.land ? Math.max(460, Math.min(640, (L.xr - L.xl) * 0.5)) : L.xr - L.xl;
  // portrait: the target card sits at the right of the text; landscape: it floats in the corner of the board instead
  const thumb = hasThumb && !L.land ? Math.min(150 * (0.7 + 0.3 * sc), 190) : 0;
  const innerW = panelW - 48 - (thumb ? thumb + 14 : 0);
  const maxH = L.land ? L.h * 0.5 : Math.max(150, L.h * 0.3);
  let size = Math.round(24 * sc * (L.land ? 0.96 : 1)), line, lines, h;
  for (;;) {
    line = size * 1.3; lines = wrap(text, size, innerW);
    const head = 22 + Math.round(size * 0.9) + 8, info = P.mode === 'level' && P.li >= 0 ? Math.round(size * 0.9) : 0;
    h = head + lines.length * line + 18 + info;
    if (thumb) h = Math.max(h, thumb + 52);
    if (h <= maxH || size <= 17) break;
    size -= 2;
  }
  return { label, text, lines, size, line, h: Math.round(Math.min(h, maxH)), w: panelW, thumb, innerW, boardThumb: hasThumb && L.land ? Math.min(190, 150 * (0.7 + 0.3 * sc)) : 0 };
}

// ---- tool groups ----------------------------------------------------------------------------------------------------------------------
export const SIZE_ICONS = SIZE_NAMES;
export function toolGroups(S, P, phase = P.phase) {
  const lv = levelOf(P), g = [], sh = Math.max(66, layout().tap - 4);
  if (P.mode === 'view') return [[{ id: 'view:replay', label: tr('replay'), minW: 150 }, ...(P.gi != null ? [{ id: 'view:delete', label: tr('del'), minW: 120 }] : [])]];
  if (P.mode === 'auto') return [];
  if (phase === 'choose') {
    const folds = P.mode === 'studio' ? SHEETS[P.sheet].folds : lv.folds;
    g.push(folds.map((n) => ({ id: `fold:${n}`, label: foldName(n), sub: foldWords(n), minW: 170 })));
    if (P.mode === 'studio') {
      g.push(SHEET_IDS.map((id) => ({ id: `sheet:${id}`, label: SHEETS[id].name, minW: 120, h: 62 })));
      g.push(PAPER_IDS.map((id) => ({ id: `paper:${id}`, label: '', minW: 50, h: 54 })));
    } else g.push([{ id: 'hint', label: tr('hint'), icon: 'hint', minW: 150 }]);
    return g;
  }
  if (phase === 'folding' || phase === 'unfolding' || phase === 'refolding') return [[{ id: 'skip', label: tr('skip'), icon: 'speed', minW: 150 }]];
  const cutRows = () => {
    const rows = [];
    rows.push([
      { id: 'tool:scissors', label: tr('scissors'), icon: 'scissors', minW: 96 }, { id: 'tool:punch', label: tr('punch'), icon: 'punch', minW: 96 },
      { id: 'undo', label: tr('undo'), icon: 'undo', minW: 96 }, { id: 'clear', label: tr('clear'), icon: 'clear', minW: 96 },
    ]);
    if (P.tool === 'punch') {
      rows.push(SHAPES.map((s) => ({ id: `shape:${s}`, shape: s, label: '', minW: 66, h: sh })));
      rows.push([...SIZE_NAMES.map((n, i) => ({ id: `size:${i}`, label: n, minW: 66, h: sh })), { id: 'turn', label: '', icon: 'turn', minW: 66, h: sh }]);
    } else rows.push([{ id: null, tip: true, minW: 400, h: sh * 2 + 8 }]);
    return rows;
  };
  if (phase === 'cut') {
    g.push(...cutRows());
    const last = [];
    if (P.mode === 'level') last.push({ id: 'hint', label: tr('hint'), icon: 'hint', minW: 110 });
    const canChange = P.mode === 'studio' || lv.folds.length > 1;
    if (canChange) last.push({ id: 'changefold', label: P.confirmChange ? 'Tap again' : tr('changeFold'), icon: 'fold', minW: 120 });
    last.push({ id: 'unfold', label: tr('unfold'), icon: 'unfold', kind: 'primary', minW: 120 });
    g.push(last);
    return g;
  }
  return g;   // result: shown as a card
}

// The rectangles of the play screen for the current phase. The board and the tool area keep one size from the first cut on, so nothing jumps.
export function rectsFor(S, P) {
  const L = layout(), cap = captionOf(S, P);
  const actual = toolGroups(S, P);
  const same = P.mode === 'view' || P.phase === 'choose' || P.phase === 'cut';
  const R = playRects(L, cap.h, same ? actual : toolGroups(S, P, 'cut'));
  let rects = R.rects;
  if (!same) rects = P.phase === 'result' || P.mode === 'auto' ? [] : flowGroups(actual, R.tools.x, R.tools.y, R.tools.w, L.tap, 8).rects;
  return { L, cap, R: { ...R, rects }, auto: S.scene === 'auto' ? autoRects(L, R) : null };
}

// ---- camera ---------------------------------------------------------------------------------------------------------------------------
export function camOf(P, board) {
  return makeCam({ x: board.x + board.w / 2, y: board.y + board.h / 2, S: P.cam.S, cx: P.cam.cx, cy: P.cam.cy, tilt: P.cam.tilt, yaw: P.cam.yaw, roll: P.cam.roll });
}

// Zoom so that the points `pts` (flat coordinates) turned by `roll` fit the board. Returns S and the world point for the screen centre.
export function fitTarget(board, pts, roll, extra = 0.14, maxS = 1e9) {
  const c = Math.cos(roll), s = Math.sin(roll);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { const x = p[0] * c - p[1] * s, y = p[0] * s + p[1] * c; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = x1 - x0, h = y1 - y0, rx = (x0 + x1) / 2, ry = (y0 + y1) / 2;
  const S = Math.min(board.w / (w + extra), board.h / (h * 0.95 + extra), maxS);
  return { S: Math.max(S, 40), cx: rx * c + ry * s, cy: -rx * s + ry * c };
}
export const pointsOf = (polys) => polys.flatMap((q) => q.pts);

// ---- the faces ------------------------------------------------------------------------------------------------------------------------
// What the paper looks like right now: { faces, creases, mode, baked } ready for drawFaces.
export function sceneOf(P) {
  const flatSt = P.n ? planOf(P).states : [flatState(P.sheet)];
  const steps = flatSt.length - 1;
  if (P.phase === 'choose' || !P.n) return { faces: flatFaces(flatSt[0]), creases: [], mode: {}, baked: false };
  if (P.phase === 'folding') {
    const k = P.fk, pl = planOf(P).plans[k];
    return { faces: foldFaces(flatSt[k], pl, P.theta), creases: P.theta > 0.04 ? pl.creasesAll : flatSt[k].creases, mode: { fold: true, theta: P.theta, kind: 'valley' }, baked: false };
  }
  if (P.phase === 'cut') {
    const faces = flatFaces(flatSt[steps]).sort((a, b) => b.z - a.z).map((F, i) => ({ ...F, pts3: F.pts3.map((p) => [p[0], p[1], -i * 0.006]), c3: [F.c3[0], F.c3[1], -i * 0.006] }));
    return { faces, creases: [], mode: {}, baked: false, stack: true };
  }
  if (P.phase === 'unfolding' || P.phase === 'refolding') {
    const k = P.uk, pl = planOf(P).plans[k];
    return { faces: foldFaces(flatSt[k], pl, P.theta), creases: [], mode: { fold: true, theta: P.theta, kind: 'valley' }, baked: true };
  }
  return { faces: flatFaces(flatSt[0]), creases: [], mode: {}, baked: true };   // result
}
export { bounds, SHEETS };
export const wedgeRoll = (P) => (P.n ? viewRoll(P.n) : 0);

// ---- the result card and the baked paper ----------------------------------------------------------------------------------------------
export function resultButtons(S, P, R) {
  const L = layout(), rr = R.result;
  const r = P.result;
  const items = P.mode === 'level'
    ? [{ id: 'next', label: tr('nextLevel'), kind: r && r.stars >= 1 ? 'primary' : 'normal', disabled: !(r && r.stars >= 1) }, { id: 'refold', label: tr('refold'), kind: r && r.stars >= 1 ? 'normal' : 'primary' }, { id: 'levels', label: tr('backLevels') }]
    : [{ id: 'save', label: P.savedFlag ? 'Saved' : tr('save'), kind: 'primary', disabled: P.savedFlag }, { id: 'refold', label: tr('refold') }, { id: 'menu', label: tr('quitMenu') }];
  const f = flowGroups([items.map((q) => ({ ...q, minW: 150 }))], rr.x + 14, 0, rr.w - 28, L.tap, 8);
  const y = rr.y + rr.h - 14 - f.h;
  return f.rects.map((q) => ({ ...q, y: q.y + y }));
}

const hashStr = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
export const cutsKey = (cuts) => hashStr(cuts.map((c) => (c.k === 'p' ? `${c.s}${c.x},${c.y},${c.z},${c.a}` : c.p.join(','))).join('|'));
// The paper to draw now: the plain sheet while folding, the sheet with every cut baked in as holes (and the creases) for unfold, refold and result.
export function paperFor(P, force = false) {
  const baked = force || P.phase === 'unfolding' || P.phase === 'refolding' || P.phase === 'result';
  if (!baked || !P.n) return getPaper(P.paper);
  return bakeCut(P.paper, `${P.sheet}:${P.n}:${P.cuts.length}:${cutsKey(P.cuts)}`, layersOf(P.sheet, P.n), P.cuts.map(cutPoly), SHEETS[P.sheet].pts, planOf(P).creases);
}
