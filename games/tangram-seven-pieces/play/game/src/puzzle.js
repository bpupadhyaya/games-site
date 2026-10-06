// One puzzle in progress: pieces, dragging, rotating, flipping, snapping, undo, hints, completion.
// Pure logic + spring animation; no drawing here (view.js). All randomness comes from the rng passed in.
import {
  KINDS, KIND_COUNT, sameType, polyOfPiece, polyFree, poseOfPiece, decodeSolution, polyOfPose, centroid,
  centroidOfPose, validateSolution, evaluate, snapPose, anchorsFor, overlapArea, polyArea, pointInPoly, bbox, mod8,
} from './geom.js';

import { layout } from './layout.js';

// The live view: pixels per puzzle unit, where the silhouette centre sits, the tray panel and the play bounds. It is a pure
// function of the screen layout (layout.js); the game calls applyView(layout()) whenever the size changes. Pieces are stored in
// puzzle units, so rotating the device never moves a piece relative to the silhouette.
export const VIEW = { key: '', s: 112, bx: 360, by: 492, tray: { x: 24, y: 904, w: 672, h: 484 }, bounds: { x0: 20, y0: 148, x1: 700, y1: 1396 }, slots: [] };
export function applyView(L) {
  if (VIEW.key === L.key) return false;
  Object.assign(VIEW, { key: L.key, s: L.s, bx: L.boardC.x, by: L.boardC.y, tray: L.tray, bounds: L.bounds, slots: L.slots });
  return true;
}
export const viewSnapshot = () => ({ s: VIEW.s, bx: VIEW.bx, by: VIEW.by, tray: { ...VIEW.tray }, bounds: { ...VIEW.bounds }, slots: VIEW.slots.map((q) => q.slice()) });
applyView(layout());
// Thumb ergonomics (virtual px; 720 wide = about 360-430 pt, so 1 px is roughly 0.5-0.6 pt):
// snapR() 0.5 units = 56 px (about 28 pt, 4-5 mm): a drop that lands within a fingertip's width of a
// corner still clicks in; snapPose only accepts a move that fits better, so a wide radius cannot misplace.
// LIFT_PX: a held piece rides 58 px (about 31 pt) above the finger so the fingertip never hides it.
// HANDLE_R / HANDLE_HIT: the rotate handle is a 72 px disc with a 52 px touch radius (about 28 pt).
const snapR = () => Math.min(0.75, Math.max(0.5, 56 / VIEW.s));   // about 56 virtual px whatever the scale
export const LIFT_PX = 58;
const HANDLE_R = 36, HANDLE_HIT = 52;
const MOVE_SLOP = 14; // px of travel before a press becomes a drag (a shaky tap must not move a piece)
const SPRING_K = 620, SPRING_C = 40;

const geoCache = new Map();
// Everything derived from a level once: slot polygons, outline, anchors, world<->pixel mapping.
export function levelGeo(level) {
  let g = geoCache.get(level.id);
  if (g) return g;
  const poses = decodeSolution(level.sol);
  const v = validateSolution(level.sol);
  const slots = v.polys;
  const box = v.box;
  const ctr = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
  g = {
    poses, slots, loops: v.loops, box, ctr,
    anchors: anchorsFor(slots, v.loops, []),
    slotAreas: slots.map((p) => Math.abs(polyArea(p))),
    size: { w: box.x1 - box.x0, h: box.y1 - box.y0 },
    toPx: ([x, y]) => [(x - ctr.x) * VIEW.s + VIEW.bx, (y - ctr.y) * VIEW.s + VIEW.by],
    fromPx: ([x, y]) => [(x - VIEW.bx) / VIEW.s + ctr.x, (y - VIEW.by) / VIEW.s + ctr.y],
  };
  geoCache.set(level.id, g);
  return g;
}
export const pxPoly = (g, poly) => poly.map((p) => g.toPx(p));


const ZERO = (kind) => ({ kind, f: 0, rot: 0, cx: 0, cy: 0 });

// Initial tray arrangement. mix: 0 = default orientations, 1 = quarter turns, 2 = quarter turns + flips
export function trayState(level, rng, mix) {
  const g = levelGeo(level);
  const out = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    let rot = 0, f = 0;
    if (mix >= 1) rot = k === 6 ? (rng.chance(0.5) ? 4 : 0) : rng.int(4) * 2;
    if (mix >= 2 && (k === 6 || k === 5 || rng.chance(0.4))) f = rng.chance(0.5) ? 1 : 0;
    if (mix >= 2 && k === 6) f = rng.chance(0.5) ? 1 : 0;
    const p = { ...ZERO(k), rot, f };
    // centre the piece's bounding box on the slot
    const poly = polyFree(k, f, rot, 0, 0);
    const b = bbox([poly]);
    const [sx, sy] = VIEW.slots[k];
    const [wx, wy] = g.fromPx([sx, sy]);
    p.cx = wx - (b.x0 + b.x1) / 2;
    p.cy = wy - (b.y0 + b.y1) / 2;
    out.push(p);
  }
  return out;
}

export function createPuzzle(level, rng, opts = {}) {
  const g = levelGeo(level);
  const tray = trayState(level, rng, opts.mix ?? 0);
  const pieces = tray.map((t, i) => makePiece(t, i));
  const puz = {
    level, g,
    pieces,
    order: pieces.map((_, i) => i), // draw order, last = on top
    home: tray.map((t) => ({ ...t })),
    selected: -1,
    drag: null,
    history: [],
    moves: 0,
    hints: 0,
    hint: null,
    done: false,
    doneT: 0,
    t: 0,
    fits: pieces.map(() => false),
    parts: [],
    events: [], // { type, ... } consumed by the game (sounds)
    stars: 0,
    blind: Boolean(opts.blind),
    snapStrength: opts.snapStrength ?? 1,
    glide: false,
  };
  refresh(puz);
  return puz;
}

function makePiece(t, i) {
  return {
    i, kind: t.kind, f: t.f, rot: t.rot, cx: t.cx, cy: t.cy, // logical (target)
    dx: t.cx, dy: t.cy, drot: t.rot, vx: 0, vy: 0, vrot: 0, // displayed
    lift: 0, flipT: 0, mirror: 0,
    glow: 0, pop: 0,
  };
}

const clampWorld = (puz, cx, cy) => {
  const [px, py] = puz.g.toPx([cx, cy]);
  const m = 0.3 * VIEW.s, B = VIEW.bounds;
  const x = Math.min(Math.max(px, B.x0 + m), B.x1 - m), y = Math.min(Math.max(py, B.y0 + m), B.y1 - m);
  return puz.g.fromPx([x, y]);
};

export const logicalPoly = (p) => polyOfPiece(p);
export const displayPolyPx = (puz, p) => pxPoly(puz.g, polyFree(p.kind, p.f, p.drot, p.dx, p.dy));
export const logicalPolyPx = (puz, p) => pxPoly(puz.g, polyOfPiece(p));

function snapshot(puz) {
  return puz.pieces.map((p) => ({ cx: p.cx, cy: p.cy, rot: p.rot, f: p.f }));
}
function pushHistory(puz) {
  puz.history.push(snapshot(puz));
  if (puz.history.length > 120) puz.history.shift();
}

function bringToTop(puz, i) {
  puz.order = puz.order.filter((k) => k !== i);
  puz.order.push(i);
}

export function pieceAt(puz, x, y) {
  for (let n = puz.order.length - 1; n >= 0; n--) {
    const p = puz.pieces[puz.order[n]];
    const poly = displayPolyPx(puz, p);
    if (pointInPoly([x, y], poly) || nearPoly(poly, x, y, 16)) return p.i;
  }
  return -1;
}
function nearPoly(poly, x, y, r) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t)) <= r) return true;
  }
  return false;
}

export function handlePos(puz) {
  if (puz.selected < 0) return null;
  const p = puz.pieces[puz.selected];
  const poly = displayPolyPx(puz, p);
  const [pcx, pcy] = puz.g.toPx([p.dx, p.dy]);
  let r = 0;
  for (const q of poly) r = Math.max(r, Math.hypot(q[0] - pcx, q[1] - pcy));
  const B = VIEW.bounds, lo = B.y0 + 22, hi = B.y1 - 30;
  let hy = pcy - r - 64;
  if (hy < lo) hy = pcy + r + 64;
  return { x: Math.min(Math.max(pcx, B.x0 + 30), B.x1 - 30), y: Math.min(Math.max(hy, lo), hi), cx: pcx, cy: pcy, r: HANDLE_R };
}

export function pointerDown(puz, x, y) {
  if (puz.done) return false;
  const h = handlePos(puz);
  if (h && Math.hypot(x - h.x, y - h.y) <= HANDLE_HIT) {
    const p = puz.pieces[puz.selected];
    puz.drag = { mode: 'rot', i: puz.selected, a0: Math.atan2(y - h.cy, x - h.cx), rot0: p.drot, moved: false, before: snapshot(puz) };
    return true;
  }
  const i = pieceAt(puz, x, y);
  if (i < 0) {
    puz.selected = -1;
    puz.drag = null;
    return false;
  }
  const p = puz.pieces[i];
  const [gx, gy] = puz.g.fromPx([x, y]);
  puz.drag = { mode: 'move', i, gx: gx - p.dx, gy: gy - p.dy, sx: x, sy: y, moved: false, wasSelected: puz.selected === i, before: snapshot(puz) };
  puz.selected = i;
  bringToTop(puz, i);
  return true;
}

export function pointerMove(puz, x, y) {
  const d = puz.drag;
  if (!d) return;
  const p = puz.pieces[d.i];
  if (d.mode === 'rot') {
    const h = handlePos(puz);
    const a = Math.atan2(y - (h?.cy ?? 0), x - (h?.cx ?? 0));
    let delta = a - d.a0;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (!d.moved && Math.abs(delta) > 0.14) { d.moved = true; puz.events.push({ type: 'lift' }); puz.hint = null; }
    if (d.moved) { p.drot = d.rot0 + delta / (Math.PI / 4); p.vrot = 0; }
    return;
  }
  if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > MOVE_SLOP) {
    d.moved = true;
    puz.events.push({ type: 'lift' });
    puz.hint = null;
  }
  if (d.moved) {
    const [gx, gy] = puz.g.fromPx([x, y - LIFT_PX * p.lift]);
    const [cx, cy] = clampWorld(puz, gx - d.gx, gy - d.gy);
    p.cx = cx; p.cy = cy;
  }
}

function settleSnap(puz, p, radius) {
  const others = puz.pieces.filter((q) => q.i !== p.i).map((q) => polyOfPiece(q));
  const pose = poseOfPiece(p);
  const anchors = anchorsFor(puz.g.slots, puz.g.loops, others);
  const snapped = snapPose(pose, puz.g.slots, others, anchors, radius * puz.snapStrength);
  if (snapped !== pose) {
    const c = centroidOfPose(snapped);
    p.cx = c[0]; p.cy = c[1];
    return true;
  }
  return false;
}

// Where would this piece land if released now? (preview ring while dragging)
export function snapPreview(puz) {
  const d = puz.drag;
  if (!d || d.mode !== 'move' || !d.moved) return null;
  const p = puz.pieces[d.i];
  const others = puz.pieces.filter((q) => q.i !== p.i).map((q) => polyOfPiece(q));
  const probe = { ...p, rot: Math.round(p.rot) };
  const pose = poseOfPiece(probe);
  const anchors = anchorsFor(puz.g.slots, puz.g.loops, others);
  const snapped = snapPose(pose, puz.g.slots, others, anchors, snapR() * puz.snapStrength);
  if (snapped === pose) return null;
  return pxPoly(puz.g, polyOfPose(snapped));
}

export function pointerUp(puz, x, y) {
  const d = puz.drag;
  puz.drag = null;
  if (!d) return;
  const p = puz.pieces[d.i];
  if (d.mode === 'rot') {
    if (!d.moved) { rotatePiece(puz, d.i, 1); return; } // a tap on the handle turns one step
    puz.history.push(d.before);
    p.rot = Math.round(p.drot); // the displayed angle keeps going and the spring settles it
    settleSnap(puz, p, snapR());
    puz.events.push({ type: 'rotate', i: p.i });
    puz.moves += 1;
    afterChange(puz, p);
    return;
  }
  if (!d.moved) {
    // a tap: select, or rotate when it was already selected
    if (d.wasSelected) rotatePiece(puz, d.i, 1);
    return;
  }
  puz.history.push(d.before);
  if (puz.history.length > 120) puz.history.shift();
  p.rot = Math.round(p.rot);
  const snapped = settleSnap(puz, p, snapR());
  puz.events.push({ type: snapped ? 'snap' : 'drop', i: p.i });
  puz.moves += 1;
  afterChange(puz, p);
}

export function rotatePiece(puz, i, dir) {
  const p = puz.pieces[i];
  pushHistory(puz);
  p.rot = Math.round(p.rot) + dir;
  settleSnap(puz, p, snapR() * 0.8);
  puz.events.push({ type: 'rotate', i: p.i });
  puz.moves += 1;
  bringToTop(puz, i);
  afterChange(puz, p);
}

export function flipPiece(puz, i) {
  const p = puz.pieces[i];
  pushHistory(puz);
  p.f = p.f ? 0 : 1;
  p.rot = -Math.round(p.rot);
  p.drot = -p.drot; p.vrot = -p.vrot; // the mirror image keeps its look; only the squash animates
  p.flipT = 1;
  settleSnap(puz, p, snapR() * 0.8);
  puz.events.push({ type: 'flip', i: p.i });
  puz.moves += 1;
  bringToTop(puz, i);
  afterChange(puz, p);
}

export function selectNext(puz) {
  puz.selected = (puz.selected + 1) % KIND_COUNT;
  bringToTop(puz, puz.selected);
}

export function undo(puz) {
  if (puz.done) return false;
  const s = puz.history.pop();
  if (!s) return false;
  s.forEach((q, i) => {
    const p = puz.pieces[i];
    p.cx = q.cx; p.cy = q.cy; p.rot = q.rot;
    if (p.f !== q.f) { p.flipT = 1; p.drot = q.rot; p.vrot = 0; }
    p.f = q.f;
    normRot(p);
  });
  puz.hint = null;
  puz.events.push({ type: 'undo' });
  refresh(puz);
  return true;
}

export function resetPieces(puz) {
  if (puz.done) return;
  pushHistory(puz);
  puz.home.forEach((h, i) => {
    const p = puz.pieces[i];
    if (p.f !== h.f) { p.flipT = 1; p.drot = h.rot; p.vrot = 0; }
    p.cx = h.cx; p.cy = h.cy; p.rot = h.rot; p.f = h.f;
    normRot(p);
  });
  puz.selected = -1;
  puz.hint = null;
  puz.events.push({ type: 'reset' });
  refresh(puz);
}

// keep the logical rotation in 0..7 without changing what is drawn (shift the displayed angle too)
function normRot(p) {
  const m = mod8(p.rot);
  p.drot -= p.rot - m;
  p.rot = m;
}

function afterChange(puz, p) {
  puz.hint = null;
  normRot(p);
  const wasFits = puz.fits.slice();
  refresh(puz);
  if (puz.fits[p.i] && !wasFits[p.i]) { p.pop = 1; puz.events.push({ type: 'fit', i: p.i }); }
}

export function refresh(puz) {
  const polys = puz.pieces.map((p) => polyOfPiece(p));
  const ev = evaluate(puz.g.slots, polys);
  puz.fits = ev.fits;
  puz.eval = ev;
  if (ev.complete && !puz.done) {
    puz.done = true;
    puz.doneT = 0;
    puz.selected = -1;
    puz.stars = puz.hints === 0 ? 3 : puz.hints <= 2 ? 2 : 1;
    puz.events.push({ type: 'win' });
    // exact lattice alignment so the merged silhouette is crisp
    puz.pieces.forEach((p) => normRot(p));
  }
}

// ---- hints -----------------------------------------------------------------------------------------------
function matchState(puz) {
  const polys = puz.pieces.map((p) => polyOfPiece(p));
  const slotOwner = puz.g.slots.map(() => -1);
  const pieceSlot = puz.pieces.map(() => -1);
  puz.g.slots.forEach((s, si) => {
    for (const p of puz.pieces) {
      if (pieceSlot[p.i] >= 0 || !sameType(p.kind, puz.g.poses[si].kind)) continue;
      if (overlapArea(polys[p.i], s) >= puz.g.slotAreas[si] * 0.985) { slotOwner[si] = p.i; pieceSlot[p.i] = si; break; }
    }
  });
  return { slotOwner, pieceSlot, polys };
}

export function openSlots(puz) {
  const { slotOwner } = matchState(puz);
  const out = [];
  slotOwner.forEach((o, si) => { if (o < 0) out.push(si); });
  return out;
}

// Pick the next slot to fill: largest open slot touching the filled area first.
export function nextTarget(puz) {
  const { slotOwner, pieceSlot } = matchState(puz);
  const open = [];
  slotOwner.forEach((o, si) => { if (o < 0) open.push(si); });
  if (!open.length) return null;
  const filled = slotOwner.map((o, si) => (o >= 0 ? si : -1)).filter((x) => x >= 0);
  const touch = (a, b) => {
    const pa = puz.g.slots[a], pb = puz.g.slots[b];
    for (const v of pa) for (const w of pb) if (Math.hypot(v[0] - w[0], v[1] - w[1]) < 1e-6) return true;
    return false;
  };
  open.sort((a, b) => {
    const ta = filled.some((f) => touch(a, f)) ? 1 : 0, tb = filled.some((f) => touch(b, f)) ? 1 : 0;
    if (filled.length && ta !== tb) return tb - ta;
    return puz.g.slotAreas[b] - puz.g.slotAreas[a];
  });
  const slot = open[0];
  const kind = puz.g.poses[slot].kind;
  const free = puz.pieces.filter((p) => pieceSlot[p.i] < 0 && sameType(p.kind, kind));
  if (!free.length) return null;
  free.sort((a, b) => (a.i === puz.selected ? -1 : 0) - (b.i === puz.selected ? -1 : 0) || a.i - b.i);
  return { slot, piece: free[0].i };
}

export function requestHint(puz) {
  if (puz.done) return null;
  if (puz.hint && puz.hint.stage === 1) {
    // second press: show the move
    const h = puz.hint;
    placeAtSlot(puz, h.piece, h.slot);
    puz.hints += 1;
    puz.hint = null;
    return { placed: true };
  }
  const t = nextTarget(puz);
  if (!t) return null;
  puz.hint = { ...t, stage: 1, t: 0 };
  puz.selected = t.piece;
  puz.hints += 1;
  puz.events.push({ type: 'hint' });
  return { placed: false, ...t };
}

export function placeAtSlot(puz, pieceIdx, slotIdx) {
  const p = puz.pieces[pieceIdx];
  const pose = { ...puz.g.poses[slotIdx], kind: p.kind };
  const c = centroidOfPose(pose);
  pushHistory(puz);
  p.cx = c[0]; p.cy = c[1]; p.rot = pose.r; p.f = pose.f;
  // keep the displayed rotation on the shortest path
  const cur = p.drot, tgt = p.rot;
  p.drot = tgt + Math.round((cur - tgt) / 8) * 8;
  p.flipT = 1;
  bringToTop(puz, pieceIdx);
  puz.moves += 1;
  puz.events.push({ type: 'snap', i: p.i });
  afterChange(puz, p);
}

// Shortest rotation tween for logical rot changes (rot is an integer; display wraps by 8).
function springPiece(p, dt, glide) {
  const K = glide ? 150 : SPRING_K, C = glide ? 21 : SPRING_C;
  p.vx += ((p.cx - p.dx) * K - p.vx * C) * dt;
  p.vy += ((p.cy - p.dy) * K - p.vy * C) * dt;
  p.dx += p.vx * dt; p.dy += p.vy * dt;
  p.vrot += ((p.rot - p.drot) * K * 1.2 - p.vrot * C) * dt;
  p.drot += p.vrot * dt;
}

export function updatePuzzle(puz, dt) {
  puz.t += dt;
  const dragIdx = puz.drag && puz.drag.mode === 'move' && puz.drag.moved ? puz.drag.i : -1;
  const rotIdx = puz.drag && puz.drag.mode === 'rot' ? puz.drag.i : -1;
  for (const p of puz.pieces) {
    if (p.i === dragIdx) {
      // follow the finger tightly
      const k = 1 - Math.exp(-dt * 38);
      p.dx += (p.cx - p.dx) * k; p.dy += (p.cy - p.dy) * k;
      p.vx = 0; p.vy = 0;
      p.drot += (p.rot - p.drot) * (1 - Math.exp(-dt * 20));
      p.lift = Math.min(1, p.lift + dt * 9);
    } else if (p.i === rotIdx) {
      p.dx += (p.cx - p.dx) * (1 - Math.exp(-dt * 30));
      p.dy += (p.cy - p.dy) * (1 - Math.exp(-dt * 30));
      p.lift = Math.min(1, p.lift + dt * 9);
    } else {
      springPiece(p, dt, puz.glide);
      p.lift = Math.max(0, p.lift - dt * 5);
    }
    if (p.flipT > 0) p.flipT = Math.max(0, p.flipT - dt * 4.2);
    if (p.pop > 0) p.pop = Math.max(0, p.pop - dt * 3.2);
    const target = puz.fits[p.i] && !puz.blind && !puz.done ? 1 : 0;
    p.glow += (target - p.glow) * (1 - Math.exp(-dt * 8));
  }
  if (puz.hint) puz.hint.t += dt;
  if (puz.done) puz.doneT += dt;
  // particles
  for (const q of puz.parts) {
    q.life -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vy += (q.g ?? 600) * dt;
    q.vx *= Math.exp(-dt * (q.drag ?? 0.8));
    q.rot = (q.rot ?? 0) + (q.spin ?? 0) * dt;
  }
  puz.parts = puz.parts.filter((q) => q.life > 0);
}

export function isSettled(puz) {
  return puz.pieces.every((p) => Math.abs(p.cx - p.dx) < 0.012 && Math.abs(p.cy - p.dy) < 0.012 && Math.abs(p.rot - p.drot) < 0.03 && Math.abs(p.vx) + Math.abs(p.vy) < 0.4);
}

export function burst(puz, x, y, rng, n, colors, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), s = rng.range(opts.min ?? 60, opts.max ?? 260);
    puz.parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up ?? 80), life: rng.range(0.5, opts.life ?? 1.1), max: opts.life ?? 1.1,
      size: rng.range(opts.size0 ?? 3, opts.size1 ?? 7), color: rng.pick(colors), g: opts.g ?? 520, drag: opts.drag ?? 1.2,
      shape: opts.shape ?? 'dot', rot: rng.range(0, 6), spin: rng.range(-8, 8),
    });
  }
}

// ---- the screen changed shape (rotation, split screen, a new window size) ---------------------------------------------------------
// Pieces are stored in puzzle units relative to the silhouette, so everything on or near the board keeps its place in the puzzle.
// Pieces resting in the tray move to the matching slot of the NEW tray (the tray may now be a column instead of a strip), and
// anything else is kept in the puzzle and nudged inside the new play area. `o` is the view before (viewSnapshot()), the live VIEW is the new one.
export function relayoutPuzzle(puz, o) {
  const g = puz.g, n = VIEW;
  const toOld = ([x, y]) => [(x - g.ctr.x) * o.s + o.bx, (y - g.ctr.y) * o.s + o.by];
  const inOldTray = (px, py) => px >= o.tray.x - 0.3 * o.s && px <= o.tray.x + o.tray.w + 0.3 * o.s && py >= o.tray.y - 0.3 * o.s && py <= o.tray.y + o.tray.h + 0.3 * o.s;
  const slotWorld = (kind, f, rot) => {
    const bb = bbox([polyFree(kind, f, rot, 0, 0)]);
    const [wx, wy] = g.fromPx(n.slots[kind]);
    return [wx - (bb.x0 + bb.x1) / 2, wy - (bb.y0 + bb.y1) / 2];
  };
  const mapOne = (kind, f, rot, cx, cy) => {
    const [px, py] = toOld([cx, cy]);
    if (inOldTray(px, py)) return slotWorld(kind, f, rot);
    const [qx, qy] = g.toPx([cx, cy]);
    const m = 0.3 * n.s, B = n.bounds;
    const x = Math.min(Math.max(qx, B.x0 + m), B.x1 - m), y = Math.min(Math.max(qy, B.y0 + m), B.y1 - m);
    return x === qx && y === qy ? [cx, cy] : g.fromPx([x, y]);
  };
  puz.drag = null;
  for (const p of puz.pieces) {
    const [cx, cy] = mapOne(p.kind, p.f, p.rot, p.cx, p.cy);
    p.cx = cx; p.cy = cy; p.dx = cx; p.dy = cy; p.vx = 0; p.vy = 0; p.lift = 0;
  }
  for (const snap of puz.history) snap.forEach((q, i) => { const [cx, cy] = mapOne(puz.pieces[i].kind, q.f, q.rot, q.cx, q.cy); q.cx = cx; q.cy = cy; });
  puz.home.forEach((h) => { const [cx, cy] = slotWorld(h.kind, h.f, h.rot); h.cx = cx; h.cy = cy; });
  puz.parts.length = 0;
  return puz;
}

export { KINDS, polyArea, centroid };
