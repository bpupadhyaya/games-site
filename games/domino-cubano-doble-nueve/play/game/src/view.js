// Everything drawn each frame. Reads `state` (see game.js) and changes nothing.
// Art direction (design/GDD.md): Miami's Little Havana Domino Park — painted-concrete terracotta
// and turquoise, ivory bone tiles with black pips, never casino-green felt.
import { layoutLineRows, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawCredit, drawMoreLine, drawLockup } from './brand.js';
import { legalPlays } from './rules.js';

// Live screen size in virtual units (the short side is always 720); set at the top of every render().
let W = 720, H = 1560;
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DISPLAY = 'Georgia, "Times New Roman", serif';
const CREAM = '#f5ecd8';
const GOLD = '#e0b654';
// Frame/panel/ring borders use this cool platinum tone instead of GOLD (matching the store icon's
// silver ring) — GOLD stays reserved for text/badges/the Play button's fill, never for a stroke.
const SILVER = '#c7ccd1';
// Havana Domino Park at dusk (this file's own header comment, from design/GDD.md): a warm
// terracotta table under a sunset sky, with a rooftop skyline, the harbor lighthouse, palms and a
// string-light garland — replacing the flat solid colors tried right before this. Named per role
// since the exact palette has changed identity several times already this pass.
const SKY_TOP = '#241a3d';
const SKY_MID = '#5a2f4a';
const SKY_WARM = '#c0603f';
const SKY_GLOW = '#e8a355';
const TABLE_SHADOW_TOP = '#7a3a20';
const TABLE_MAIN = '#a5502c';
const TABLE_SHADOW_BOTTOM = '#6e321c';
const SKYLINE = '#2a1810';
const CORAL = '#e2794f';
const PEACH = '#f2b98a';
// Snow-white tiles + neutral charcoal pips, matching the store icon exactly (icon.svg's
// ivoryHero/pipGrad) — the old warm cream/brown read yellowish next to that icon.
const IVORY = '#f5f7f9';
const PIP = '#1d1f21';
const SAND = '#cdb994';

const PIP_LAYOUTS = [
  [], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8],
];

function text(ctx, str, x, y, size, color = CREAM, font = UI, weight = 600, align = 'center') {
  ctx.textAlign = align;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Single-line text that shrinks (never below 14 units) until it fits maxW.
function textFit(ctx, str, x, y, size, color, font, weight, align, maxW) {
  let sz = size;
  ctx.font = `${weight} ${sz}px ${font}`;
  while (sz > 14 && ctx.measureText(str).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${font}`; }
  text(ctx, str, x, y, sz, color, font, weight, align);
}

function wrapText(ctx, str, x, y, maxWidth, lineHeight, size, color = CREAM, font = UI, align = 'center', measureOnly = false) {
  ctx.font = `500 ${size}px ${font}`;
  let line = '', drawn = 0;
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (!measureOnly) text(ctx, line, x, y + drawn * lineHeight, size, color, font, 500, align);
      line = word; drawn += 1;
    } else line = test;
  }
  if (line && !measureOnly) text(ctx, line, x, y + drawn * lineHeight, size, color, font, 500, align);
  return drawn + 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function panel(ctx, x, y, w, h, fill = 'rgba(24,12,8,0.92)') {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 24); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(199,204,209,0.55)'; ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, w, h, 24); ctx.stroke();
}

function button(ctx, rect, label, opts = {}) {
  ctx.save();
  if (opts.disabled) ctx.globalAlpha = 0.35;
  if (opts.primary) {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#f3cf7c'); g.addColorStop(1, '#c9963a');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = opts.active ? 'rgba(63,191,160,0.9)' : 'rgba(24,12,8,0.55)';
  }
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(199,204,209,0.6)'; ctx.lineWidth = 2;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14); ctx.stroke();
  let size = opts.size ?? 18;
  ctx.font = `${opts.weight ?? 700} ${size}px ${opts.font ?? UI}`;
  while (size > 14 && ctx.measureText(label).width > rect.w - 20) { size -= 1; ctx.font = `${opts.weight ?? 700} ${size}px ${opts.font ?? UI}`; }
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + size * 0.34,
    size, opts.primary ? '#3a2410' : CREAM, opts.font ?? UI, opts.weight ?? 700);
  ctx.restore();
}

function drawPips(ctx, x, y, w, h, n) {
  // A square grid sized off the tighter dimension (never w/h independently) so the vertical rows
  // in a stacked half-tile never crowd its top/bottom edge even as pips get bolder.
  const cell = Math.min(w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const gx = cell / 3.5, gy = gx;
  const offsets = [[-gx, -gy], [0, -gy], [gx, -gy], [-gx, 0], [0, 0], [gx, 0], [-gx, gy], [0, gy], [gx, gy]];
  // Bold and high-contrast on purpose — a player reading their own rack at a glance (including
  // anyone with lower vision) needs to comfortably count the pips, not squint at faint dots.
  const r = Math.max(3, cell * 0.135);
  for (const idx of PIP_LAYOUTS[n] ?? []) {
    const [ox, oy] = offsets[idx];
    const px = cx + ox, py = cy + oy;
    const g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r);
    g.addColorStop(0, '#3c3f43');
    g.addColorStop(0.6, PIP);
    g.addColorStop(1, '#050506');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 2.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(px - r * 0.32, py - r * 0.36, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Draws one tile. `vertical` stacks a-over-b (used for the line and racks); doubles get a small
// gold accent so they still read as special without needing a different footprint. A real domino
// is a solid block, not a decal — a visible extruded side edge (below the top face) plus a glossy
// diagonal sheen is what actually reads as "3D" rather than a flat rounded rectangle.
function drawTile(ctx, x, y, w, h, a, b, opts = {}) {
  ctx.save();
  const r = 6;
  const depth = opts.flat ? 0 : Math.max(2.5, Math.min(w, h) * 0.16);
  if (!opts.flat) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = opts.lift ? 20 : 8; ctx.shadowOffsetY = opts.lift ? 12 : 4; }
  if (opts.faceDown) {
    if (depth > 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1c1108';
      roundRect(ctx, x, y + depth, w, h, r); ctx.fill();
    }
    ctx.fillStyle = '#3a2418';
    roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(199,204,209,0.35)'; ctx.lineWidth = 1.5;
    roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 4); ctx.stroke();
    ctx.restore();
    return;
  }

  // Extruded side edge (the tile's thickness), a shade darker than the top face, peeking out
  // below it — this alone is most of what makes a tile read as a solid block sitting on a table.
  if (depth > 0) {
    ctx.shadowBlur = 0;
    const side = ctx.createLinearGradient(x, y + h - 2, x, y + h + depth);
    side.addColorStop(0, '#b9bec4'); side.addColorStop(0.5, '#a0a6ad'); side.addColorStop(1, '#888e95');
    ctx.fillStyle = side;
    roundRect(ctx, x, y + depth, w, h, r); ctx.fill();
    if (!opts.flat) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = opts.lift ? 20 : 8; ctx.shadowOffsetY = opts.lift ? 12 : 4; }
  }

  const face = ctx.createLinearGradient(x, y, x, y + h);
  face.addColorStop(0, '#ffffff'); face.addColorStop(0.55, IVORY); face.addColorStop(1, '#d9dee3');
  ctx.fillStyle = face;
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.shadowBlur = 0;

  // Glossy diagonal sheen across the top face, clipped to the tile's own rounded shape.
  if (w > 18) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r); ctx.clip();
    const sheen = ctx.createLinearGradient(x, y, x + w * 0.7, y + h * 0.7);
    sheen.addColorStop(0, 'rgba(255,255,255,0.4)');
    sheen.addColorStop(0.4, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // GOLD, not SILVER — a hint ring needs to actually stand out against the tile's own snow-white
  // face; silver-on-white was so low-contrast it looked like Hint wasn't doing anything.
  ctx.strokeStyle = opts.highlight ? GOLD : 'rgba(60,35,15,0.4)';
  ctx.lineWidth = opts.highlight ? 3 : 1.4;
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
  if (w > 18) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x + 6, y + 2); ctx.lineTo(x + w - 6, y + 2); ctx.stroke();
  }

  const vertical = h >= w;
  // Engraved centre groove: a dark line with a thin bright line right beneath it, like a real
  // routed channel catching light on one edge instead of a flat pen stroke.
  ctx.strokeStyle = 'rgba(60,35,15,0.28)'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (vertical) { ctx.moveTo(x + 4, y + h / 2); ctx.lineTo(x + w - 4, y + h / 2); }
  else { ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y + h - 4); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath();
  if (vertical) { ctx.moveTo(x + 4, y + h / 2 + 1.2); ctx.lineTo(x + w - 4, y + h / 2 + 1.2); }
  else { ctx.moveTo(x + w / 2 + 1.2, y + 4); ctx.lineTo(x + w / 2 + 1.2, y + h - 4); }
  ctx.stroke();

  if (vertical) {
    drawPips(ctx, x, y, w, h / 2, a);
    drawPips(ctx, x, y + h / 2, w, h / 2, b);
  } else {
    drawPips(ctx, x, y, w / 2, h, a);
    drawPips(ctx, x + w / 2, y, w / 2, h, b);
  }
  if (a === b && w > 20) {
    // Gold, not silver — same low-contrast-on-white problem as the hint ring above.
    ctx.strokeStyle = 'rgba(224,182,84,0.5)'; ctx.lineWidth = 1.5;
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.stroke();
  }
  ctx.restore();
}

// A tier's "badge" for the lobby: a small ivory domino-end (same pip motif as the tiles) with an
// accent-colored ring, so difficulty visually reads as pip count (1/2/3) rather than plain text.
function drawTierBadge(ctx, cx, cy, radius, n, accent, selected) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  const g = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, cx, cy, radius);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9dee3');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = accent; ctx.lineWidth = selected ? 4 : 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  drawPips(ctx, cx - radius * 0.68, cy - radius * 0.68, radius * 1.36, radius * 1.36, n);
}

// A simple two-frond palm silhouette, planted at (x, groundY); dir flips it to lean left/right —
// used in the two upper corners, well clear of every screen's centered title/HUD text.
function drawPalm(ctx, x, groundY, dir, scale = 1) {
  ctx.save();
  ctx.strokeStyle = SKYLINE; ctx.lineWidth = 6 * scale; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.quadraticCurveTo(x + dir * 10 * scale, groundY - 40 * scale, x + dir * 4 * scale, groundY - 74 * scale);
  ctx.stroke();
  ctx.fillStyle = SKYLINE;
  const topX = x + dir * 4 * scale, topY = groundY - 74 * scale;
  for (let i = -2; i <= 2; i++) {
    const ang = i * 0.4 - dir * 0.3;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.sin(ang) * 30 * scale, topY - 14 * scale,
      topX + Math.sin(ang) * 46 * scale, topY + (Math.cos(ang) * 8 + 10) * scale);
    ctx.quadraticCurveTo(topX + Math.sin(ang) * 30 * scale, topY - 4 * scale, topX, topY);
    ctx.fill();
  }
  ctx.restore();
}

function backdrop(ctx, L) {
  const U = L.U, hz = L.horizon;
  ctx.fillStyle = '#170d10';
  ctx.fillRect(0, 0, W, H);

  const f = (y) => Math.min(0.999, Math.max(0.001, y / H));
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(f(hz * 0.62), SKY_MID);
  g.addColorStop(f(hz * 0.84), SKY_WARM);
  g.addColorStop(f(hz - 1), SKY_GLOW);
  g.addColorStop(f(hz + 40), TABLE_SHADOW_TOP);
  g.addColorStop(f(hz + (H - hz) * 0.2), TABLE_MAIN);
  g.addColorStop(1, TABLE_SHADOW_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Rooftop skyline right at the horizon — Little Havana's low colonial roofline.
  const widths = [38, 52, 30, 60, 34, 70, 26, 46, 56, 32, 48, 24, 40, 34];
  const heights = [7, 11, 5, 13, 6, 9, 12, 5, 10, 4, 8, 4, 9, 6];
  const scale = W / widths.reduce((a, b) => a + b, 0);
  ctx.fillStyle = SKYLINE;
  let bx = 0;
  widths.forEach((w0, i) => {
    const w = w0 * scale;
    ctx.fillRect(bx, hz - heights[i], w + 1, heights[i]);
    bx += w;
  });
  // The harbor lighthouse (El Morro), kept low so its tip stays below every title text band.
  const lhX = W * 0.85, lhBaseY = hz;
  ctx.fillRect(lhX - 4, lhBaseY - 22, 8, 22);
  ctx.beginPath();
  ctx.moveTo(lhX - 7, lhBaseY - 22); ctx.lineTo(lhX + 7, lhBaseY - 22); ctx.lineTo(lhX, lhBaseY - 32);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = SKY_GLOW;
  ctx.beginPath(); ctx.arc(lhX, lhBaseY - 25, 3, 0, Math.PI * 2); ctx.fill();

  // Small palms planted at the two edges of the horizon, well clear of the centred text.
  drawPalm(ctx, U.x0 + 16, hz + 4, -1, 0.5);
  drawPalm(ctx, U.x1 - 16, hz + 4, 1, 0.5);

  // String-light garland along the very top, sagging like a real wire.
  const wireY = U.y0 + 8, sagMax = 9, bulbCount = Math.max(9, Math.round(W / 52));
  const sx = U.x0 + 14, sw = U.w - 28;
  ctx.strokeStyle = 'rgba(20,12,10,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= bulbCount; i++) {
    const x = sx + (sw / bulbCount) * i;
    const sag = Math.sin((i / bulbCount) * Math.PI) * sagMax;
    if (i === 0) ctx.moveTo(x, wireY + sag); else ctx.lineTo(x, wireY + sag);
  }
  ctx.stroke();
  for (let i = 0; i <= bulbCount; i++) {
    const x = sx + (sw / bulbCount) * i;
    const sag = Math.sin((i / bulbCount) * Math.PI) * sagMax;
    const y = wireY + sag + 6;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
    glow.addColorStop(0, 'rgba(255,214,140,0.9)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffdf9a';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }

  ctx.strokeStyle = SILVER; ctx.lineWidth = 5;
  roundRect(ctx, U.x0 + 6, U.y0 + 6, U.w - 12, U.h - 12, 26); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5;
  roundRect(ctx, U.x0 + 14, U.y0 + 14, U.w - 28, U.h - 28, 20); ctx.stroke();
}

function seatLabel(seat) {
  if (seat === 0) return 'You';
  if (seat === 2) return 'Partner';
  return `Opp ${seat === 1 ? '1' : '2'}`;
}

function drawSeats(ctx, state, L) {
  const P = L.play;
  for (const seatStr of Object.keys(P.seats)) {
    const seat = Number(seatStr);
    const S = P.seats[seat];
    const count = state.hands[seat]?.length ?? 0;
    const trim = seat === 2 ? GOLD : SAND;
    text(ctx, seatLabel(seat), S.labelX, S.labelY, P.labelSize, trim, UI, 700);
    for (let i = 0; i < count; i++) {
      const x = S.vertical ? S.x - S.tw / 2 : S.x - (count * (S.tw + S.gap)) / 2 + i * (S.tw + S.gap);
      const y = S.vertical ? S.y - (count * (S.th + S.gap)) / 2 + i * (S.th + S.gap) : S.y - S.th / 2;
      drawTile(ctx, x, y, S.tw, S.th, 0, 0, { faceDown: true, flat: true });
    }
    if (state.turn === seat && state.scene === 'playing' && !state.handResult) {
      ctx.save();
      ctx.strokeStyle = SILVER; ctx.lineWidth = 2; ctx.globalAlpha = 0.7 + Math.sin(state.t * 6) * 0.25;
      ctx.beginPath(); ctx.arc(S.x, S.y, P.ringR, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawLine(ctx, state, L) {
  const P = L.play, bounds = P.line;
  const line = state.line;
  const { rows, perRow, w, h, gap, rowGap } = layoutLineRows(line.length, bounds);
  const blockH = rows * h + (rows - 1) * rowGap;
  const topY = bounds.y + Math.max(0, (bounds.h - blockH) / 2);
  const cx = bounds.x + bounds.w / 2;
  let idx = 0;
  for (let r = 0; r < rows && idx < line.length; r++) {
    const thisRowCount = Math.min(perRow, line.length - idx);
    const totalW = thisRowCount * (w + gap) - gap;
    let x = cx - totalW / 2;
    const y = topY + r * (h + rowGap);
    for (let c = 0; c < thisRowCount; c++) {
      const t = line[idx];
      drawTile(ctx, x, y, w, h, t.leftFace, t.rightFace, { flat: w < 30 });
      x += w + gap;
      idx++;
    }
  }
  if (!state.handResult && state.ends) {
    for (const [i, n] of [[0, state.ends.left], [1, state.ends.right]]) {
      text(ctx, String(n), bounds.x + bounds.w * (i ? 0.75 : 0.25), P.endNumY, P.endNumSize, 'rgba(245,236,216,0.7)', UI, 700);
    }
  }
}

function drawRack(ctx, state, L) {
  const hand = state.hands[0] ?? [];
  const legal = state.turn === 0 && !state.handResult ? legalPlays(hand, state.ends) : [];
  const legalIdx = new Set(legal.map((p) => p.index));
  for (let i = 0; i < hand.length; i++) {
    if (state.drag && state.drag.index === i) continue; // drawn floating instead
    const r = L.play.rackRect(i, hand.length);
    const canPlay = state.turn === 0 && legalIdx.has(i);
    const hinted = state.hint && state.hint.index === i;
    drawTile(ctx, r.x, r.y, r.w, r.h, hand[i].a, hand[i].b, { highlight: hinted, lift: canPlay });
  }
  if (state.drag) {
    const r = L.play.rackRect(state.drag.index, hand.length);
    const tile = hand[state.drag.index];
    if (tile) drawTile(ctx, state.drag.x - r.w / 2, state.drag.y - r.h / 2, r.w, r.h, tile.a, tile.b, { lift: true });
  }
}

function drawScoreAndStatus(ctx, state, L, statusText, statusColor) {
  const P = L.play;
  text(ctx, `A ${state.matchScore.A}`, P.scoreCx - 16, P.scoreY, P.scoreSize, '#ffe08a', DISPLAY, 800, 'right');
  text(ctx, `B ${state.matchScore.B}`, P.scoreCx + 16, P.scoreY, P.scoreSize, PEACH, DISPLAY, 800, 'left');
  const maxW = L.land ? (P.memory.x - (P.back.x + P.back.w)) - 24 : L.C.w;
  const cx = L.land ? P.scoreCx : W / 2;
  const size = state.toastT > 0 && state.scene === 'playing' ? P.toastSize : P.statusSize;
  textFit(ctx, statusText, cx, P.statusY, size, statusColor, UI, 600, 'center', maxW);
}

function drawMemory(ctx, state, L) {
  const P = L.play;
  button(ctx, P.memory, state.showMemory ? 'Hide memory' : 'Table memory', { active: state.showMemory, size: 18 });
  if (state.showMemory && state.missing) {
    const m = P.memPanel;
    panel(ctx, m.x, m.y, m.w, m.h, 'rgba(20,10,8,0.9)');
    ['You', 'Opp 1', 'Partner', 'Opp 2'].forEach((label, seat) => {
      const missing = Array.from(state.missing[seat]).sort((a, b) => a - b);
      const s = missing.length ? missing.join(',') : '—';
      text(ctx, `${label}: not ${s}`, m.x + 18, m.y + 22 + P.memFont + seat * (P.memFont + 18), P.memFont, 'rgba(245,236,216,0.9)', UI, 600, 'left');
    });
  }
}

function drawHud(ctx, state, L) {
  const P = L.play;
  button(ctx, P.back, 'Lobby', { size: 22 });
  if (state.toastT > 0) drawScoreAndStatus(ctx, state, L, state.toastMsg, GOLD);
  else drawScoreAndStatus(ctx, state, L, 'first to 100', 'rgba(245,236,216,0.6)');
  drawMemory(ctx, state, L);
  const canPass = state.turn === 0 && !state.handResult && legalPlays(state.hands[0], state.ends).length === 0;
  button(ctx, P.pass, 'Pass', { disabled: !canPass, primary: canPass, size: 42 });
  button(ctx, P.hint, 'Hint', { size: 33, disabled: state.turn !== 0 || Boolean(state.handResult) });
  button(ctx, P.undo, 'Undo', { size: 33, disabled: !state.undoSnapshot });
}

// Auto Play's HUD: same top row (Exit instead of Lobby), but the bottom controls become Faster / Pause / Slower since no
// seat is waiting on a real player. Pause is a real pause: the table stops exactly as it is.
function drawAutoHud(ctx, state, L) {
  const P = L.play;
  button(ctx, P.back, 'Exit', { size: 22 });
  drawScoreAndStatus(ctx, state, L, state.autoPaused ? 'AUTO PLAY — PAUSED · tap Resume' : 'AUTO PLAY — tap Pause anytime', 'rgba(245,236,216,0.6)');
  drawMemory(ctx, state, L);
  const seconds = AUTO_THINK_STEPS[state.autoThinkIdx] ?? 5;
  button(ctx, P.hint, 'Faster', { size: 28, disabled: state.autoThinkIdx === 0 });
  button(ctx, P.pass, state.autoPaused ? 'Resume' : `Pause · ${seconds}s`, { size: 30, primary: state.autoPaused });
  button(ctx, P.undo, 'Slower', { size: 28, disabled: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
}


// A circular badge for the hand/match result cards — a checkmark, dash, or cross drawn as a path
// (never a text glyph, which fonts render inconsistently), so a result reads at a glance before
// anyone has even read the headline.
function drawResultBadge(ctx, cx, cy, radius, kind, color) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  const sheen = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
  sheen.addColorStop(0, 'rgba(255,255,255,0.35)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,8,0.45)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#1c0f07'; ctx.lineWidth = radius * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'win') {
    ctx.moveTo(cx - radius * 0.42, cy + radius * 0.02);
    ctx.lineTo(cx - radius * 0.1, cy + radius * 0.34);
    ctx.lineTo(cx + radius * 0.46, cy - radius * 0.34);
  } else if (kind === 'loss') {
    ctx.moveTo(cx - radius * 0.32, cy - radius * 0.32); ctx.lineTo(cx + radius * 0.32, cy + radius * 0.32);
    ctx.moveTo(cx + radius * 0.32, cy - radius * 0.32); ctx.lineTo(cx - radius * 0.32, cy + radius * 0.32);
  } else {
    ctx.moveTo(cx - radius * 0.36, cy - radius * 0.13); ctx.lineTo(cx + radius * 0.36, cy - radius * 0.13);
    ctx.moveTo(cx - radius * 0.36, cy + radius * 0.13); ctx.lineTo(cx + radius * 0.36, cy + radius * 0.13);
  }
  ctx.stroke();
  ctx.restore();
}


function drawMoreLine2(ctx, L) {
  drawMoreLine(ctx, W / 2, L.overlay.moreY, Math.max(18, L.minFont));
}

function drawHandResult(ctx, state, L) {
  const r = state.handResult, O = L.overlay;
  panel(ctx, O.panel.x, O.panel.y, O.panel.w, O.panel.h);
  const cx = W / 2, badgeY = O.panel.y + 96;
  let bodyText;
  if (r.reason === 'push') {
    drawResultBadge(ctx, cx, badgeY, 48, 'push', SAND);
    textFit(ctx, 'BLOCKED — EVEN PIPS', cx, badgeY + 100, 32, GOLD, DISPLAY, 800, 'center', O.panel.w - 40);
    bodyText = 'Both teams held the same pip total. No points this hand.';
  } else {
    const won = r.winningTeam === 'A';
    const label = won ? 'Your team' : 'Opponents';
    const verb = r.reason === 'domino' ? 'went out' : 'blocked with fewer pips';
    drawResultBadge(ctx, cx, badgeY, 48, won ? 'win' : 'loss', won ? GOLD : SAND);
    textFit(ctx, `${label.toUpperCase()} SCORES ${r.points}`, cx, badgeY + 100, 32, won ? '#ffe08a' : PEACH, DISPLAY, 800, 'center', O.panel.w - 40);
    bodyText = `${label} ${verb}. Match score is now A ${state.matchScore.A} — B ${state.matchScore.B}.`;
  }
  wrapText(ctx, bodyText, cx, badgeY + 164, O.textW, 36, 24, 'rgba(245,236,216,0.9)');
  button(ctx, O.cont, 'Continue', { primary: true, size: 34 });
  drawMoreLine2(ctx, L);
}

function drawMatchResult(ctx, state, L) {
  const r = state.matchResult, O = L.overlay;
  panel(ctx, O.panel.x, O.panel.y, O.panel.w, O.panel.h);
  const cx = W / 2, badgeY = O.panel.y + 96;
  const won = r.winningTeam === 'A';
  drawResultBadge(ctx, cx, badgeY, 54, won ? 'win' : 'loss', won ? GOLD : '#c0524a');
  text(ctx, won ? 'MATCH WON' : 'MATCH LOST', cx, badgeY + 108, 42, won ? '#ffe08a' : CORAL, DISPLAY, 800);
  const bodyText = won
    ? 'You and your partner reached 100 first. The table resets for a new match whenever you are.'
    : 'The opponents reached 100 first. Read the passes a little closer next time.';
  wrapText(ctx, bodyText, cx, badgeY + 172, O.textW, 38, 26);
  text(ctx, `Record: ${state.matchRecord.wins}W – ${state.matchRecord.losses}L · best streak ${state.matchRecord.bestStreak}`,
    cx, O.cont.y - 22, Math.max(20, L.minFont), 'rgba(245,236,216,0.7)');
  button(ctx, O.cont, 'Back to Lobby', { primary: true, size: 32 });
  drawMoreLine2(ctx, L);
}

function drawTitle(ctx, state, manifest, L) {
  const T = L.title;
  const parts = manifest.title.toUpperCase().split(':').map((s) => s.trim());
  const maxW = L.land ? (W / 2 - L.C.x0 - 40) : L.C.w;
  if (parts.length > 1) {
    textFit(ctx, `${parts[0]}:`, T.titleX, T.titleY1, T.titleSize, GOLD, DISPLAY, 800, 'center', maxW);
    textFit(ctx, parts[1], T.titleX, T.titleY2, T.titleSize, GOLD, DISPLAY, 800, 'center', maxW);
  } else textFit(ctx, parts[0], T.titleX, T.titleY1, T.titleSize, GOLD, DISPLAY, 800, 'center', maxW);
  wrapText(ctx, manifest.tagline ?? '', T.tagline.x, T.tagline.y, T.tagline.w, T.tagline.lh, T.tagline.size, 'rgba(245,236,216,0.8)');
  const demo = [[6, 3], [9, 9], [4, 2]];
  const { dw, dh, gap: dgap } = T.tiles, dTotal = dw * 3 + dgap * 2, dStart = T.tiles.cx - dTotal / 2;
  demo.forEach(([a, b], i) => {
    const isNine = a === 9 && b === 9;
    drawTile(ctx, dStart + i * (dw + dgap), T.tiles.y + Math.sin(state.t * 1.2 + i) * 6, dw, dh, a, b, { lift: true, highlight: isNine });
  });
  button(ctx, T.play, 'Play', { primary: true, size: T.fonts[0] });
  button(ctx, T.howto, 'How to Play', { size: T.fonts[1] });
  button(ctx, T.rules, 'Rules Reference', { size: T.fonts[2] });
  button(ctx, T.auto, 'Auto Play — Watch & Learn', { size: T.fonts[3] });
  {
    const k = T.lock, dn = state.lkDown, kw = k.w * (dn ? 0.96 : 1);
    ctx.save(); ctx.fillStyle = 'rgba(20,8,2,0.6)'; ctx.beginPath(); ctx.roundRect(k.x - k.w / 2 - 10, k.bottom - k.h - 6, k.w + 20, k.h + 12, (k.h + 12) / 2); ctx.fill(); ctx.restore();
    if (!drawLockup(ctx, k.x, k.bottom - (dn ? 0 : 1), kw, dn ? 0.7 : 1)) drawCredit(ctx, T.credit.x, k.bottom - 4, T.credit.size, { dim: 0.9 });
  }
}

// Shared by How to Play and Rules Reference: draws paragraph(s) inside [top, bottom] and x0..x1, clipped to that band and offset
// upward by `scroll` once the zoomed-in text no longer fits. Returns nothing; the scroll state lives in game.js (it only ever
// stores a raw accumulator, this clamps it every frame against the measured overflow).
function drawScrollableBody(ctx, L, paragraphs, top, bottom, size, lineHeight, gap, scroll) {
  const F = L.ref, x0 = F.bodyX0, x1 = F.bodyX1, width = x1 - x0, cx = (x0 + x1) / 2;
  const available = bottom - top;
  let measured = 0;
  for (const para of paragraphs) {
    const lines = wrapText(ctx, para, cx, 0, width, lineHeight, size, undefined, undefined, undefined, true);
    measured += lines * lineHeight + gap;
  }
  measured -= gap;
  const overflow = Math.max(0, measured - available);
  const clamped = Math.min(Math.max(0, scroll), overflow);
  let y = (overflow > 0 ? top - clamped : top + Math.max(0, (available - measured) / 2)) + size * 0.85;
  ctx.save();
  roundRect(ctx, F.panel.x + 8, top - 2, F.panel.w - 16, available + 6, 10);
  ctx.clip();
  for (const para of paragraphs) {
    const lines = wrapText(ctx, para, cx, y, width, lineHeight, size, 'rgba(245,236,216,0.9)');
    y += lines * lineHeight + gap;
  }
  ctx.restore();
  if (overflow > 0) {
    const trackX = F.panel.x + F.panel.w - 18, trackW = 6;
    const thumbH = Math.max(36, available * available / measured);
    const thumbY = top + (clamped / overflow) * (available - thumbH);
    ctx.fillStyle = 'rgba(245,236,216,0.15)';
    roundRect(ctx, trackX, top, trackW, available, trackW / 2); ctx.fill();
    ctx.fillStyle = SILVER;
    roundRect(ctx, trackX, thumbY, trackW, thumbH, trackW / 2); ctx.fill();
  }
}

function refHeader(ctx, L, title, state) {
  const F = L.ref;
  button(ctx, F.back, 'Back', { size: 22 });
  button(ctx, F.dec, 'A-', { size: 28, disabled: state.textScaleIdx === 0 });
  button(ctx, F.inc, 'A+', { size: 28, disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
  textFit(ctx, title, F.titleX, F.titleY, L.fs(24), 'rgba(245,236,216,0.7)', UI, 700, 'center', F.titleW);
  panel(ctx, F.panel.x, F.panel.y, F.panel.w, F.panel.h);
}

// ONE continuous scrolling document for How to Play and the Rules Reference: every page in order (title, picture, text), the same words
// and illustrations, laid out in a single centred column. The scroll is clamped here against the measured height and written back.
const flowCache = new Map();
function drawFlow(ctx, state, L, key, entries, scrollKey, size, lineHeight, gap, headTitle) {
  const F = L.ref, P = F.panel, cx = P.x + P.w / 2, colW = Math.min(P.w - 90, 780), x0 = cx - colW / 2;
  const top = P.y + 20, bottom = F.bodyBottom, view = bottom - top;
  const fk = `${key}|${size}|${Math.round(colW)}`;
  let FL = flowCache.get(fk);
  if (!FL) {
    const secs = []; let y = 0;
    for (const e of entries) {
      const sc = Math.min(1, colW / 440), illH = e.illustration ? 222 * sc + 16 : 0;
      const paras = Array.isArray(e.body) ? e.body : [e.body];
      let bh = 0; for (const p of paras) bh += wrapText(ctx, p, cx, 0, colW, lineHeight, size, undefined, undefined, undefined, true) * lineHeight + gap;
      secs.push({ e, y, illH, sc, paras, h: 56 + illH + bh }); y += 56 + illH + bh + 30;
    }
    FL = { secs, total: y }; flowCache.set(fk, FL); if (flowCache.size > 24) flowCache.delete(flowCache.keys().next().value);
  }
  const max = Math.max(0, FL.total - view);
  const off = Math.min(Math.max(0, state[scrollKey] ?? 0), max); state[scrollKey] = off; state.readerMax = max;
  ctx.save(); roundRect(ctx, P.x + 8, top - 2, P.w - 16, view + 6, 10); ctx.clip();
  for (const s of FL.secs) {
    const y = top + s.y - off;
    if (y > bottom + 20 || y + s.h < top - 20) continue;
    textFit(ctx, s.e.title, cx, y + 36, 34, GOLD, DISPLAY, 800, 'center', P.w - 60);
    let yy = y + 56;
    if (s.e.illustration) { drawRulesIllustration(ctx, s.e.illustration, cx, yy, s.sc); yy += s.illH; }
    yy += size * 0.85;
    for (const p of s.paras) { const n = wrapText(ctx, p, cx, yy, colW, lineHeight, size, 'rgba(245,236,216,0.9)'); yy += n * lineHeight + gap; }
  }
  ctx.restore();
  if (max > 0) {
    const trackX = P.x + P.w - 18, trackW = 6, thumbH = Math.max(36, view * view / FL.total), thumbY = top + (off / max) * (view - thumbH);
    ctx.fillStyle = 'rgba(245,236,216,0.15)'; roundRect(ctx, trackX, top, trackW, view, trackW / 2); ctx.fill();
    ctx.fillStyle = SILVER; roundRect(ctx, trackX, thumbY, trackW, thumbH, trackW / 2); ctx.fill();
  }
  return { off, max };
}

function drawHowto(ctx, state, helpers, L) {
  const F = L.ref, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  refHeader(ctx, L, 'HOW TO PLAY', state);
  const { off } = drawFlow(ctx, state, L, 'howto', helpers.HOWTO_STEPS, 'howtoScroll', 26 * scale, 38 * scale, 0);
  button(ctx, F.prev, 'Top', { disabled: off < 4, size: 28 });
  button(ctx, F.next, 'Start Playing', { primary: true, size: 28 });
}

const TIER_ACCENTS = [SAND, GOLD, CORAL];

function drawLobby(ctx, state, helpers, L) {
  const B = L.lobby;
  button(ctx, B.menu, 'Menu', { size: 22 });
  textFit(ctx, 'DOMINÓ CUBANO', B.title.x, B.title.y, B.title.size, GOLD, DISPLAY, 800, 'center', 2 * (W / 2 - (B.menu.x + B.menu.w) - 12));
  textFit(ctx, `Record ${state.matchRecord.wins}W – ${state.matchRecord.losses}L · best streak ${state.matchRecord.bestStreak}`,
    B.record.x, B.record.y, B.record.size, 'rgba(245,236,216,0.8)', UI, 600, 'center', L.C.w);
  text(ctx, 'Choose your table', B.choose.x, B.choose.y, B.choose.size, CREAM, DISPLAY, 700);
  const dsz = Math.max(22, L.minFont);
  helpers.DIFFICULTIES.forEach((d, i) => {
    const r = B.cards[i];
    const selected = state.difficulty === i;
    const accent = TIER_ACCENTS[i] ?? GOLD;
    panel(ctx, r.x, r.y, r.w, r.h, selected ? 'rgba(224,182,84,0.16)' : 'rgba(24,12,8,0.62)');
    if (selected) {
      ctx.save();
      ctx.strokeStyle = accent; ctx.lineWidth = 3;
      roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 22); ctx.stroke();
      ctx.restore();
    }
    if (B.cardMode === 'row') {
      drawTierBadge(ctx, r.x + r.w / 2, r.y + 62, 38, i + 1, accent, selected);
      text(ctx, d.label, r.x + r.w / 2, r.y + 142, 34, GOLD, DISPLAY, 800);
      wrapText(ctx, d.desc, r.x + r.w / 2, r.y + 182, r.w - 44, dsz + 8, dsz, 'rgba(245,236,216,0.88)');
    } else {
      const badgeCx = r.x + 74, badgeCy = r.y + r.h / 2;
      drawTierBadge(ctx, badgeCx, badgeCy, 40, i + 1, accent, selected);
      const textX = badgeCx + 64;
      text(ctx, d.label, textX, r.y + r.h * 0.27, 34, GOLD, DISPLAY, 800, 'left');
      wrapText(ctx, d.desc, textX, r.y + r.h * 0.27 + dsz + 22, r.w - (textX - r.x) - 26, dsz + 8, dsz, 'rgba(245,236,216,0.88)', UI, 'left');
    }
  });
  button(ctx, B.start, 'Deal In', { primary: true, size: 45 });
}

// The exhaustive in-app Rules reference (docs/GAME-CATEGORIES.md). Illustrations reuse this file's `drawTile`, drawn in local
// coordinates (0,0 = top centre of the illustration, ~440 wide x 200 tall) and scaled to the room the layout gives them.
function drawRulesIllustration(ctx, name, cx0, top0, sc) {
  ctx.save();
  ctx.translate(cx0, top0); ctx.scale(sc, sc);
  const cx = 0, top = 0;
  if (name === 'set') {
    [[0, 0], [5, 3], [9, 9]].forEach(([a, b], i) => {
      drawTile(ctx, cx - 138 + i * 92, top, 64, 96, a, b, {});
    });
  } else if (name === 'opener') {
    drawTile(ctx, cx - 46, top, 92, 138, 9, 9, { highlight: true });
    text(ctx, 'highest double leads', cx, top + 138 + 24, 14, 'rgba(245,236,216,0.7)');
  } else if (name === 'match') {
    drawTile(ctx, cx - 140, top, 64, 96, 6, 3, {});
    drawTile(ctx, cx - 50, top, 64, 96, 3, 5, { highlight: true });
    wrapText(ctx, 'the shared 3 touches — the 5 becomes the new open end', cx + 40, top + 96 + 24, 240, 19, 14, 'rgba(245,236,216,0.7)', UI, 'left');
  } else if (name === 'seats') {
    const ecx = cx, ecy = top + 90, rx = 155, ry = 60;
    const bg = ctx.createRadialGradient(ecx, ecy, 10, ecx, ecy, rx);
    bg.addColorStop(0, 'rgba(224,182,84,0.18)'); bg.addColorStop(1, 'rgba(224,182,84,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(ecx, ecy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(224,182,84,0.55)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(ecx, ecy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    [
      { label: 'You', dx: 0, dy: 1, color: PEACH },
      { label: 'Opp 1', dx: -1, dy: 0, color: SAND },
      { label: 'Partner', dx: 0, dy: -1, color: GOLD },
      { label: 'Opp 2', dx: 1, dy: 0, color: SAND },
    ].forEach(({ label, dx, dy, color }) => {
      const px = ecx + dx * rx, py = ecy + dy * ry;
      ctx.strokeStyle = 'rgba(224,182,84,0.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ecx, ecy); ctx.lineTo(px, py); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = 'rgba(20,12,8,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
      const labelY = dy === -1 ? py - 18 : dy === 1 ? py + 24 : py - 16;
      text(ctx, label, px, labelY, 15, color, UI, 700);
    });
  }
  ctx.restore();
}

function drawRules(ctx, state, helpers, L) {
  const F = L.ref, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  refHeader(ctx, L, 'RULES REFERENCE', state);
  const { off, max } = drawFlow(ctx, state, L, 'rules', helpers.RULES_PAGES, 'rulesScroll', 24 * scale, 34 * scale, 17 * scale);
  button(ctx, F.prev, 'Top', { disabled: off < 4, size: 28 });
  button(ctx, F.next, 'More', { disabled: off >= max - 2, primary: off < max - 2, size: 28 });
}

function drawDemoLimit(ctx, manifest, L) {
  const cx = W / 2, y0 = L.demoTop;
  drawTile(ctx, cx - 46, y0, 92, 138, 9, 9, { highlight: true, lift: true });
  text(ctx, 'FREE PREVIEW FINISHED', cx, y0 + 202, 32, GOLD, DISPLAY, 800);
  const tw = Math.min(560, L.C.w);
  wrapText(ctx, `You’ve played the free preview matches of ${manifest?.title ?? 'this game'}.`, cx, y0 + 262, tw, 30, 22);
  wrapText(ctx, 'Get the full game on iPhone and Android to keep playing — same table, no limits.', cx, y0 + 320, tw, 30, 22);
  const pillW = 250, pillH = 62, gap = 24, pillY = y0 + 430;
  const startX = cx - pillW - gap / 2;
  [['iPhone', CREAM], ['Android', GOLD]].forEach(([label, accent], i) => {
    const x = startX + i * (pillW + gap);
    ctx.save();
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
    roundRect(ctx, x, pillY, pillW, pillH, 31); ctx.stroke();
    ctx.restore();
    text(ctx, label, x + pillW / 2, pillY + pillH / 2 + 7, 22, accent, UI, 700);
  });
}

export function render(ctx, state, manifest, helpers, L) {
  W = L.w; H = L.h;
  backdrop(ctx, L);
  if (state.scene === 'title') drawTitle(ctx, state, manifest, L);
  else if (state.scene === 'howto') drawHowto(ctx, state, helpers, L);
  else if (state.scene === 'rules') drawRules(ctx, state, helpers, L);
  else if (state.scene === 'lobby') drawLobby(ctx, state, helpers, L);
  else if (state.scene === 'playing') {
    drawSeats(ctx, state, L);
    drawLine(ctx, state, L);
    drawRack(ctx, state, L);
    drawHud(ctx, state, L);
    if (state.matchResult) drawMatchResult(ctx, state, L);
    else if (state.handResult) drawHandResult(ctx, state, L);
  } else if (state.scene === 'auto') {
    drawSeats(ctx, state, L);
    drawLine(ctx, state, L);
    drawRack(ctx, state, L);
    drawAutoHud(ctx, state, L);
    if (state.handResult) drawHandResult(ctx, state, L);
  } else if (state.scene === 'demo-limit') drawDemoLimit(ctx, manifest, L);
}
