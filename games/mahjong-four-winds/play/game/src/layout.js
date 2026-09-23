// Geometry of the table (virtual canvas 720 x 1560). Pure functions: where every tile wants to be.
//
// Seats: 0 = you (bottom), 1 = right, 2 = across (top), 3 = left. Tile "w" is the face width in canvas units;
// a tile is 4:3 tall, so its footprint is w x 1.333w (rotated 90 degrees when it belongs to a side seat).
import { kindOf } from './rules.js';

export const W = 720, H = 1560;
export const RING = { cx: 360, cy: 700, half: 120 };
export const ROT = [0, -Math.PI / 2, Math.PI, Math.PI / 2];        // a tile's top points toward the centre of the table
export const HAND_Y = 1372, RIVER_W = 36, RIVER_PX = 37.5, RIVER_PY = 45;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Text-size steps for the reference pages (How to play / About / Rules). Index into this, never a
// raw float, so the stepper can cleanly disable at either end and a stale saved index always clamps.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// ---- slots in the wall ring: slot i (0..143) -> a position around the ring
export function wallPos(i) {
  const stack = i >> 1, level = i & 1, side = Math.floor(stack / 18), n = stack % 18, S = (RING.half * 2) / 18;
  const { cx, cy, half } = RING, lift = level * -3.2;
  let x, y, rot;
  if (side === 0) { x = cx - half + S * (n + 0.5); y = cy + half - 8; rot = 0; }                 // bottom, left to right
  else if (side === 1) { x = cx + half - 8; y = cy + half - S * (n + 0.5); rot = Math.PI / 2; }  // right, going up
  else if (side === 2) { x = cx + half - S * (n + 0.5); y = cy - half + 8; rot = 0; }            // top, right to left
  else { x = cx - half + 8; y = cy - half + S * (n + 0.5); rot = Math.PI / 2; }                  // left, going down
  return { x, y: y + lift, rot, w: 12.5 };
}

export function riverPos(seat, i) {
  const col = i % 6, row = Math.floor(i / 6), h = RIVER_PX * 2.5;
  switch (seat) {
    case 0: return { x: 360 - h + col * RIVER_PX, y: 862 + row * RIVER_PY, rot: 0 };
    case 2: return { x: 360 + h - col * RIVER_PX, y: 538 - row * RIVER_PY, rot: Math.PI };
    case 1: return { x: 512 + row * RIVER_PY, y: 700 + h - col * RIVER_PX, rot: ROT[1] };
    default: return { x: 208 - row * RIVER_PY, y: 700 - h + col * RIVER_PX, rot: ROT[3] };
  }
}

// ---- your hand
export function handMetrics(n, hasDrawn, big = false) {
  const gap = hasDrawn ? 18 : 0, count = n + (hasDrawn ? 1 : 0);
  const tw = Math.min(big ? 56 : 52, (694 - gap) / Math.max(1, count) - 1.5);
  const pitch = tw + 1.5, total = pitch * count + gap;
  return { tw, pitch, gap, x0: 360 - total / 2 + pitch / 2 };
}
export const handTileX = (m, idx, hasDrawn, n) => m.x0 + idx * m.pitch + (hasDrawn && idx >= n ? m.gap : 0);

const meldTileW = [34, 22, 26, 22];
// exposed sets and bonus tiles for each seat. Returns positions for one meld's tiles.
export function meldOrigin(seat, mi, prevTiles) {
  const w = meldTileW[seat] ?? 26, span = 3 * (w + 1.5) + 12;
  const off = prevTiles * (w + 1.5) + mi * 12;
  switch (seat) {
    case 0: return { x: 24 + w / 2 + off, y: 1066, rot: 0, w, dx: w + 1.5, dy: 0 };
    case 2: return { x: 690 - w / 2 - off, y: 306, rot: Math.PI, w, dx: -(w + 1.5), dy: 0 };
    case 1: return { x: 690, y: 880 + w / 2 + off, rot: ROT[1], w, dx: 0, dy: w + 1.5, _span: span };
    default: return { x: 30, y: 880 + w / 2 + off, rot: ROT[3], w, dx: 0, dy: w + 1.5, _span: span };
  }
}
export function flowerPos(seat, i) {
  switch (seat) {
    case 0: return { x: 696 - 13 - i * 27, y: 1068, rot: 0, w: 24 };
    case 2: return { x: 30 + i * 22, y: 300, rot: Math.PI, w: 20 };
    case 1: return { x: 690, y: 448 + 0, rot: ROT[1], w: 20, ox: -i * 22 };
    default: return { x: 30, y: 448, rot: ROT[3], w: 20, ox: i * 22 };
  }
}
// opponent hand slot idx (0..n-1), plus the extra drawn tile
export function oppHandPos(seat, idx, n, hasDrawn) {
  const gap = hasDrawn && idx >= n ? 14 : 0;
  if (seat === 2) return { x: 360 - (n + (hasDrawn ? 1 : 0)) * 15.5 + idx * 31 + 15.5 + gap / 2 + (hasDrawn ? 0 : 0), y: 238, rot: Math.PI, w: 30 };
  const y = 486 + idx * 26 + gap;
  return seat === 1 ? { x: 690, y, rot: ROT[1], w: 26 } : { x: 30, y, rot: ROT[3], w: 26 };
}

// ---- buttons and areas
export const BTN = {
  menu: { x: 616, y: 44, w: 76, h: 76 },
  hint: { x: 264, y: 1452, w: 200, h: 84 },
  pause: { x: 480, y: 1452, w: 216, h: 84 },
  pass: { x: 508, y: 1128, w: 188, h: 84 },
  claim: (i, n) => { const w = 176, gap = 12, total = n * w + (n - 1) * gap; return { x: 360 - total / 2 - 84 + i * (w + gap), y: 1128, w, h: 84 }; },
  next: { x: 110, y: 1240, w: 500, h: 92 },
};
export const CHIPS = [
  { x: 24, y: 1452, w: 220, h: 84 },      // you
  { x: 520, y: 470 - 96, w: 190, h: 60 },
  { x: 260, y: 132, w: 200, h: 60 },
  { x: 10, y: 470 - 96, w: 190, h: 60 },
];

// Auto Play (Watch & Learn): think-time steps in seconds, hard-capped at 10s. An index into this
// array (same pattern as TEXT_SCALES), never a raw float. The +/- stepper sits in the free top
// strip above the header text, clear of the Menu button (top-right) and the header's left-aligned
// round/hand text.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_STEP = { dec: { x: 180, y: 34, w: 92, h: 62 }, inc: { x: 448, y: 34, w: 92, h: 62 } };
export const AUTO_REVEAL_SECONDS = 2;

// Every tile's target on screen. `s` = rules state; `up` = set of seats shown face up (all at the end of a hand);
// opts = { reveal }. Returns Map(id -> { x, y, rot, w, f (0 back, 1 face), z, sel })
export function tileTargets(s, opts = {}) {
  const T = new Map(), { reveal = false, selected = -1, big = false } = opts;
  // wall ring
  for (let i = s.front; i < s.back; i++) { const t = s.deck[i]; const p = wallPos(i); T.set(t, { ...p, f: 0, z: 0, wall: true }); }
  // hands
  for (let p = 0; p < 4; p++) {
    const hand = s.hands[p], n = hand.length, drawn = s.turn === p && s.drawn >= 0 ? s.drawn : -1, has = drawn >= 0;
    if (p === 0) {
      const m = handMetrics(n, has, big);
      hand.forEach((t, i) => T.set(t, { x: handTileX(m, i, has, n), y: HAND_Y - (t === selected ? 26 : 0), rot: 0, w: m.tw, f: 1, z: 5, hand: true }));
      if (has) T.set(drawn, { x: handTileX(m, n, true, n), y: HAND_Y - (drawn === selected ? 26 : 0), rot: 0, w: m.tw, f: 1, z: 5, hand: true, drawnTile: true });
    } else {
      const f = reveal ? 1 : 0;
      hand.forEach((t, i) => { const q = oppHandPos(p, i, n, has); T.set(t, { ...q, f, z: 3 }); });
      if (has) { const q = oppHandPos(p, n, n, true); T.set(drawn, { ...q, f, z: 3 }); }
    }
    // rivers
    s.rivers[p].forEach((t, i) => { const q = riverPos(p, i); T.set(t, { ...q, w: RIVER_W, f: 1, z: 1 + i / 100, river: true }); });
    // melds
    let used = 0;
    s.melds[p].forEach((m, mi) => {
      const o = meldOrigin(p, mi, used);
      m.tiles.forEach((t, ti) => {
        const hidden = m.type === 'ckong' && (ti === 0 || ti === 3) && !(reveal || p === 0 && false);
        T.set(t, { x: o.x + o.dx * ti, y: o.y + o.dy * ti, rot: o.rot, w: o.w, f: hidden ? 0 : 1, z: 2, meld: true });
      });
      used += m.tiles.length;
    });
    // bonus tiles
    s.flowers[p].forEach((t, i) => { const q = flowerPos(p, i); T.set(t, { x: q.x + (q.ox ?? 0), y: q.y + (p === 1 || p === 3 ? 0 : 0), rot: q.rot, w: q.w, f: 1, z: 2, bonus: true }); });
  }
  return T;
}
export const kindAt = (s, t) => kindOf(t);
