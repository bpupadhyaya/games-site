// Everything drawn each frame. Reads `state` (see game.js) and changes nothing.
// Art direction (design/GDD.md): Miami's Little Havana Domino Park — painted-concrete terracotta
// and turquoise, ivory bone tiles with black pips, never casino-green felt.
import { SCREEN, BACK_BUTTON, PASS_BUTTON, HINT_BUTTON, UNDO_BUTTON, MEMORY_TOGGLE, rackTileRect,
  LINE_BOUNDS, layoutLineRows, SEAT_POS, difficultyCardRect, START_BUTTON, TITLE_PLAY_BUTTON,
  TITLE_HOWTO_BUTTON, TITLE_RULES_BUTTON, TITLE_AUTO_BUTTON, OVERLAY_PANEL,
  OVERLAY_CONTINUE_BUTTON, RULES_BACK_BUTTON, RULES_PREV_BUTTON, RULES_NEXT_BUTTON,
  TEXT_DEC, TEXT_INC, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { legalPlays } from './rules.js';

const W = SCREEN.width, H = SCREEN.height;
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
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + (opts.size ?? 18) * 0.34,
    opts.size ?? 18, opts.primary ? '#3a2410' : CREAM, opts.font ?? UI, opts.weight ?? 700);
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

function backdrop(ctx) {
  ctx.fillStyle = '#170d10';
  ctx.fillRect(0, 0, W, H);

  const frameX = 40, frameY = 40, frameW = W - 80, frameH = H - 80;
  const horizonY = 430;

  ctx.save();
  roundRect(ctx, frameX, frameY, frameW, frameH, 36);
  ctx.clip();

  const g = ctx.createLinearGradient(0, frameY, 0, frameY + frameH);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(0.16, SKY_MID);
  g.addColorStop(0.22, SKY_WARM);
  g.addColorStop(0.263, SKY_GLOW);
  g.addColorStop(0.29, TABLE_SHADOW_TOP);
  g.addColorStop(0.45, TABLE_MAIN);
  g.addColorStop(1, TABLE_SHADOW_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(frameX, frameY, frameW, frameH);

  // Rooftop skyline right at the horizon — Little Havana's low colonial roofline, not a real
  // skyline photo (this file only ever draws with canvas primitives — see the header comment).
  const widths = [38, 52, 30, 60, 34, 70, 26, 46, 56, 32, 48, 24, 40, 34];
  const heights = [7, 11, 5, 13, 6, 9, 12, 5, 10, 4, 8, 4, 9, 6];
  const scale = frameW / widths.reduce((a, b) => a + b, 0);
  ctx.fillStyle = SKYLINE;
  let bx = frameX;
  widths.forEach((w0, i) => {
    const w = w0 * scale;
    ctx.fillRect(bx, horizonY - heights[i], w, heights[i]);
    bx += w;
  });

  // The harbor lighthouse (El Morro), kept low (like the rest of the skyline) so its tip stays
  // below every screen's title/tagline text band.
  const lhX = frameX + frameW * 0.85, lhBaseY = horizonY;
  ctx.fillRect(lhX - 4, lhBaseY - 22, 8, 22);
  ctx.beginPath();
  ctx.moveTo(lhX - 7, lhBaseY - 22); ctx.lineTo(lhX + 7, lhBaseY - 22); ctx.lineTo(lhX, lhBaseY - 32);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = SKY_GLOW;
  ctx.beginPath(); ctx.arc(lhX, lhBaseY - 25, 3, 0, Math.PI * 2); ctx.fill();

  // Small palms tucked in the two top corners (planted near the string lights, not the horizon —
  // full-size ones growing up from the horizon reached right into the Opponent 1/2 labels further
  // down every gameplay screen). Scaled down and kept off to the sides, clear of every screen's
  // centered title/HUD text column.
  drawPalm(ctx, frameX + 20, 122, -1, 0.42);
  drawPalm(ctx, frameX + frameW - 20, 122, 1, 0.42);

  // String-light garland along the top of the frame — the park's real after-dark lighting,
  // strung like a real wire (it sags toward the middle, never straight).
  // Kept close to the frame's own top border (66) on purpose — every screen's HUD text starts
  // clearing space from y~90 down, so the deepest sag must stay well above that, not drift into it.
  const wireY = 48, sagMax = 9, bulbCount = 13;
  ctx.strokeStyle = 'rgba(20,12,10,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= bulbCount; i++) {
    const x = frameX + (frameW / bulbCount) * i;
    const sag = Math.sin((i / bulbCount) * Math.PI) * sagMax;
    if (i === 0) ctx.moveTo(x, wireY + sag); else ctx.lineTo(x, wireY + sag);
  }
  ctx.stroke();
  for (let i = 0; i <= bulbCount; i++) {
    const x = frameX + (frameW / bulbCount) * i;
    const sag = Math.sin((i / bulbCount) * Math.PI) * sagMax;
    const y = wireY + sag + 6;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
    glow.addColorStop(0, 'rgba(255,214,140,0.9)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffdf9a';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = SILVER; ctx.lineWidth = 10;
  roundRect(ctx, 52, 52, W - 104, H - 104, 30); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2;
  roundRect(ctx, 66, 66, W - 132, H - 132, 24); ctx.stroke();
}

function seatLabel(seat, difficulty) {
  if (seat === 0) return 'You';
  if (seat === 2) return 'Partner';
  return `Opponent ${seat === 1 ? '1' : '2'}`;
}

function drawSeats(ctx, state) {
  for (const seatStr of Object.keys(SEAT_POS)) {
    const seat = Number(seatStr);
    const pos = SEAT_POS[seat];
    const count = state.hands[seat]?.length ?? 0;
    const vertical = seat === 1 || seat === 3;
    const trim = seat === 2 ? GOLD : SAND;
    const w = 26, h = 40;
    // The label is pinned to where the fan starts at a FULL 10-tile hand, not the live count —
    // a vertical fan shrinks toward its own center as tiles are played, and a label tracking that
    // would migrate down through the whole hand until it collided with the line-end number above
    // the table (and eventually the fan's own tiles). It only ever needs to clear the tallest the
    // fan can ever be, so it can just stay there.
    const stackHalf = vertical ? (10 * (h + 3)) / 2 : h / 2;
    // Opponent 1/2 need extra lift so their own line-end number (drawn further down, right at the
    // skyline horizon) has room to sit above that horizon too — Partner's own label doesn't need
    // it, so only the vertical opponent seats get the bigger offset.
    const labelY = pos.y - stackHalf - (vertical ? 72 : 22);
    // Opponent 1/2 sit right next to the table's left/right rail, so centering their (now much
    // bigger) label on the fan ran the text past the frame — anchor to the rail's inner edge and
    // grow inward instead, same idea as anchoring Prev/Next off the panel edge.
    if (seat === 1) text(ctx, seatLabel(seat), 76, labelY, 36, trim, UI, 700, 'left');
    else if (seat === 3) text(ctx, seatLabel(seat), 644, labelY, 36, trim, UI, 700, 'right');
    else text(ctx, seatLabel(seat), pos.x, labelY, 36, trim, UI, 700);
    for (let i = 0; i < count; i++) {
      const x = vertical ? pos.x - w / 2 : pos.x - (count * (w + 4)) / 2 + i * (w + 4);
      const y = vertical ? pos.y - (count * (h + 3)) / 2 + i * (h + 3) : pos.y - h / 2;
      drawTile(ctx, x, y, w, h, 0, 0, { faceDown: true, flat: true });
    }
    if (state.turn === seat && state.scene === 'playing' && !state.handResult) {
      ctx.save();
      ctx.strokeStyle = SILVER; ctx.lineWidth = 2; ctx.globalAlpha = 0.7 + Math.sin(state.t * 6) * 0.25;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 46, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawLine(ctx, state) {
  const line = state.line;
  const { rows, perRow, w, h, gap, rowGap } = layoutLineRows(line.length);
  const blockH = rows * h + (rows - 1) * rowGap;
  const topY = LINE_BOUNDS.y + Math.max(0, (LINE_BOUNDS.h - blockH) / 2);
  let idx = 0;
  for (let r = 0; r < rows && idx < line.length; r++) {
    const thisRowCount = Math.min(perRow, line.length - idx);
    const totalW = thisRowCount * (w + gap) - gap;
    let x = W / 2 - totalW / 2;
    const y = topY + r * (h + rowGap);
    for (let c = 0; c < thisRowCount; c++) {
      const t = line[idx];
      drawTile(ctx, x, y, w, h, t.leftFace, t.rightFace, { flat: w < 30 });
      x += w + gap;
      idx++;
    }
  }
  if (!state.handResult && state.ends) {
    const leftZone = { x: LINE_BOUNDS.x, y: LINE_BOUNDS.y, w: LINE_BOUNDS.w / 2, h: LINE_BOUNDS.h };
    const rightZone = { x: LINE_BOUNDS.x + LINE_BOUNDS.w / 2, y: LINE_BOUNDS.y, w: LINE_BOUNDS.w / 2, h: LINE_BOUNDS.h };
    for (const [zone, n] of [[leftZone, state.ends.left], [rightZone, state.ends.right]]) {
      // Lifted well clear of the skyline horizon below the Opponent labels (see drawSeats) — at
      // the old -22 offset the number's own ascender crossed right through the skyline silhouette.
      text(ctx, String(n), zone.x + zone.w / 2, LINE_BOUNDS.y - 72, 44, 'rgba(245,236,216,0.7)', UI, 700);
    }
  }
}

function drawRack(ctx, state) {
  const hand = state.hands[0] ?? [];
  const legal = state.turn === 0 && !state.handResult ? legalPlays(hand, state.ends) : [];
  const legalIdx = new Set(legal.map((p) => p.index));
  for (let i = 0; i < hand.length; i++) {
    if (state.drag && state.drag.index === i) continue; // drawn floating instead
    const r = rackTileRect(i, hand.length);
    const canPlay = state.turn === 0 && legalIdx.has(i);
    const hinted = state.hint && state.hint.index === i;
    // A legal tile only ever gets the plain "lift" (raised, bigger shadow) — the pulsing gold ring
    // this used to also draw on every legal tile read as an unrequested hint on its own, once that
    // ring became clearly visible against the white tiles. The gold ring is reserved for an actual
    // tapped Hint now (highlight below), so it always means the same specific thing.
    drawTile(ctx, r.x, r.y, r.w, r.h, hand[i].a, hand[i].b, { highlight: hinted, lift: canPlay });
  }
  if (state.drag) {
    const r = rackTileRect(state.drag.index, hand.length);
    const tile = hand[state.drag.index];
    if (tile) drawTile(ctx, state.drag.x - r.w / 2, state.drag.y - r.h / 2, r.w, r.h, tile.a, tile.b, { lift: true });
  }
}

function drawHud(ctx, state) {
  button(ctx, BACK_BUTTON, 'Lobby', { size: 22 });
  text(ctx, `A ${state.matchScore.A}`, W / 2 - 16, 100, 30, '#ffe08a', DISPLAY, 800, 'right');
  text(ctx, `B ${state.matchScore.B}`, W / 2 + 16, 100, 30, PEACH, DISPLAY, 800, 'left');
  // A tap on Hint/Pass/Undo that couldn't do anything shows why here — this row never has any
  // other content in it (rack size and line length never reach up this far), so a message here
  // can never overlap the rack, the line, or anything else regardless of how full the table is.
  if (state.toastT > 0) {
    text(ctx, state.toastMsg, W / 2, 138, 18, GOLD, UI, 700);
  } else {
    text(ctx, `first to 100`, W / 2, 138, 36, 'rgba(245,236,216,0.6)', UI, 600);
  }

  const showMemory = state.showMemory;
  button(ctx, MEMORY_TOGGLE, showMemory ? 'Hide memory' : 'Table memory', { active: showMemory, size: 18 });
  if (showMemory && state.missing) {
    // A real backing panel, not floating text — a core mechanic (the whole partner-inference
    // differentiator) deserves to actually be legible against the terracotta, not blend into it.
    const px = 404, py = 80, pw = 300, ph = 170;
    panel(ctx, px, py, pw, ph, 'rgba(20,10,8,0.9)');
    ['You', 'Opp 1', 'Partner', 'Opp 2'].forEach((label, seat) => {
      const missing = Array.from(state.missing[seat]).sort((a, b) => a - b);
      const s = missing.length ? missing.join(',') : '—';
      text(ctx, `${label}: not ${s}`, px + 18, py + 33 + seat * 34, 17, 'rgba(245,236,216,0.9)', UI, 600, 'left');
    });
  }

  const canPass = state.turn === 0 && !state.handResult && legalPlays(state.hands[0], state.ends).length === 0;
  button(ctx, PASS_BUTTON, 'Pass', { disabled: !canPass, primary: canPass, size: 42 });
  button(ctx, HINT_BUTTON, 'Hint', { size: 33, disabled: state.turn !== 0 || Boolean(state.handResult) });
  button(ctx, UNDO_BUTTON, 'Undo', { size: 33, disabled: !state.undoSnapshot });
}

// Auto Play's HUD: same top row (Exit instead of Lobby, Table memory unchanged — watching what the
// AI has deduced is part of the demo), but the bottom row becomes a think-time stepper instead of
// Pass/Hint/Undo, since no seat is waiting on a real player.
function drawAutoHud(ctx, state) {
  button(ctx, BACK_BUTTON, 'Exit', { size: 22 });
  text(ctx, `A ${state.matchScore.A}`, W / 2 - 16, 100, 30, '#ffe08a', DISPLAY, 800, 'right');
  text(ctx, `B ${state.matchScore.B}`, W / 2 + 16, 100, 30, PEACH, DISPLAY, 800, 'left');
  text(ctx, state.autoPaused ? 'AUTO PLAY — PAUSED' : 'AUTO PLAY — WATCH & LEARN', W / 2, 128, 18, 'rgba(245,236,216,0.6)', UI, 600);

  const showMemory = state.showMemory;
  button(ctx, MEMORY_TOGGLE, showMemory ? 'Hide memory' : 'Table memory', { active: showMemory, size: 18 });
  if (showMemory && state.missing) {
    const px = 404, py = 80, pw = 300, ph = 170;
    panel(ctx, px, py, pw, ph, 'rgba(20,10,8,0.9)');
    ['You', 'Opp 1', 'Partner', 'Opp 2'].forEach((label, seat) => {
      const missing = Array.from(state.missing[seat]).sort((a, b) => a - b);
      const s = missing.length ? missing.join(',') : '—';
      text(ctx, `${label}: not ${s}`, px + 18, py + 33 + seat * 34, 17, 'rgba(245,236,216,0.9)', UI, 600, 'left');
    });
  }

  // "Resume" only appears once Pace has already been tapped once — nothing before that tap told
  // a player it does anything besides show the current pace, so this caption is the only thing
  // that makes the Pause behavior discoverable up front rather than by accident.
  if (!state.autoPaused) {
    text(ctx, 'Tap Pace to pause anytime', W / 2, HINT_BUTTON.y - 16, 16, 'rgba(245,236,216,0.55)', UI, 600);
  }
  const seconds = AUTO_THINK_STEPS[state.autoThinkIdx] ?? 5;
  button(ctx, HINT_BUTTON, 'Faster', { size: 20, disabled: state.autoThinkIdx === 0 });
  // Doubles as Pause/Resume (game.js's handleAutoDown) — a player who needs longer than even the
  // slowest pace to study a move can just stop the table entirely instead.
  button(ctx, PASS_BUTTON, state.autoPaused ? 'Resume' : `Pace: ${seconds}s`,
    { size: 28, primary: state.autoPaused });
  button(ctx, UNDO_BUTTON, 'Slower', { size: 20, disabled: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
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

// Body copy varies in length (win/loss/push, and the live match score baked into the sentence),
// so its line count is measured rather than assumed — a fixed offset below it would risk the
// record line or the Continue button overlapping a message that happens to wrap one line longer.
function drawHandResult(ctx, state) {
  const r = state.handResult;
  panel(ctx, OVERLAY_PANEL.x, OVERLAY_PANEL.y, OVERLAY_PANEL.w, OVERLAY_PANEL.h);
  const cx = W / 2, badgeY = OVERLAY_PANEL.y + 96;
  let bodyText;
  if (r.reason === 'push') {
    drawResultBadge(ctx, cx, badgeY, 48, 'push', SAND);
    text(ctx, 'BLOCKED — EVEN PIPS', cx, badgeY + 100, 32, GOLD, DISPLAY, 800);
    bodyText = 'Both teams held the same pip total. No points this hand.';
  } else {
    const won = r.winningTeam === 'A';
    const label = won ? 'Your team' : 'Opponents';
    const verb = r.reason === 'domino' ? 'went out' : 'blocked with fewer pips';
    drawResultBadge(ctx, cx, badgeY, 48, won ? 'win' : 'loss', won ? GOLD : SAND);
    text(ctx, `${label.toUpperCase()} SCORES ${r.points}`, cx, badgeY + 100, 32, won ? '#ffe08a' : PEACH, DISPLAY, 800);
    bodyText = `${label} ${verb}. Match score is now A ${state.matchScore.A} — B ${state.matchScore.B}.`;
  }
  const bodyY = badgeY + 164, bodySize = 24, bodyLineHeight = 36;
  const lines = wrapText(ctx, bodyText, cx, 0, 460, bodyLineHeight, bodySize, undefined, undefined, undefined, true);
  wrapText(ctx, bodyText, cx, bodyY, 460, bodyLineHeight, bodySize, 'rgba(245,236,216,0.9)');
  const buttonY = Math.max(OVERLAY_CONTINUE_BUTTON.y, bodyY + lines * bodyLineHeight + 26);
  button(ctx, { ...OVERLAY_CONTINUE_BUTTON, y: buttonY }, 'Continue', { primary: true, size: 34 });
}

function drawMatchResult(ctx, state) {
  const r = state.matchResult;
  panel(ctx, OVERLAY_PANEL.x, OVERLAY_PANEL.y, OVERLAY_PANEL.w, OVERLAY_PANEL.h);
  const cx = W / 2, badgeY = OVERLAY_PANEL.y + 96;
  const won = r.winningTeam === 'A';
  drawResultBadge(ctx, cx, badgeY, 54, won ? 'win' : 'loss', won ? GOLD : '#c0524a');
  text(ctx, won ? 'MATCH WON' : 'MATCH LOST', cx, badgeY + 108, 42, won ? '#ffe08a' : CORAL, DISPLAY, 800);
  const bodyText = won
    ? 'You and your partner reached 100 first. The table resets for a new match whenever you are.'
    : 'The opponents reached 100 first. Read the passes a little closer next time.';
  const bodyY = badgeY + 172, bodySize = 26, bodyLineHeight = 38;
  const lines = wrapText(ctx, bodyText, cx, 0, 460, bodyLineHeight, bodySize, undefined, undefined, undefined, true);
  wrapText(ctx, bodyText, cx, bodyY, 460, bodyLineHeight, bodySize);
  const recordY = bodyY + lines * bodyLineHeight + 34;
  text(ctx, `Record: ${state.matchRecord.wins}W – ${state.matchRecord.losses}L · best streak ${state.matchRecord.bestStreak}`,
    cx, recordY, 20, 'rgba(245,236,216,0.7)');
  const buttonY = Math.max(OVERLAY_CONTINUE_BUTTON.y, recordY + 40);
  button(ctx, { ...OVERLAY_CONTINUE_BUTTON, y: buttonY }, 'Back to Lobby', { primary: true, size: 32 });
}

function drawTitle(ctx, state, manifest) {
  // The full title doesn't fit one line at this canvas width — split on its colon (this game's
  // title always has one: "Dominó Cubano: Doble Nueve") rather than letting it run off-screen.
  const parts = manifest.title.toUpperCase().split(':').map((s) => s.trim());
  if (parts.length > 1) {
    text(ctx, `${parts[0]}:`, W / 2, 234, 34, GOLD, DISPLAY, 800);
    text(ctx, parts[1], W / 2, 276, 34, GOLD, DISPLAY, 800);
  } else {
    text(ctx, parts[0], W / 2, 260, 34, GOLD, DISPLAY, 800);
  }
  wrapText(ctx, manifest.tagline ?? '', W / 2, 334, 560, 48, 36, 'rgba(245,236,216,0.8)');
  const demo = [[6, 3], [9, 9], [4, 2]];
  const dw = 96, dh = 146, dgap = 14, dTotal = dw * 3 + dgap * 2, dStart = W / 2 - dTotal / 2;
  demo.forEach(([a, b], i) => {
    const isNine = a === 9 && b === 9;
    drawTile(ctx, dStart + i * (dw + dgap), 452 + Math.sin(state.t * 1.2 + i) * 6, dw, dh, a, b, { lift: true, highlight: isNine });
  });
  button(ctx, TITLE_PLAY_BUTTON, 'Play', { primary: true, size: 45 });
  button(ctx, TITLE_HOWTO_BUTTON, 'How to Play', { size: 44 });
  button(ctx, TITLE_RULES_BUTTON, 'Rules Reference', { size: 40 });
  button(ctx, TITLE_AUTO_BUTTON, 'Auto Play — Watch & Learn', { size: 36 });
}

// Shared by How to Play and Rules Reference: draws paragraph(s) inside [contentTop, bottomLimit],
// clipped to that band and offset upward by `scroll` px once the zoomed-in text no longer fits —
// otherwise a long step at a high text-size setting ran past the panel and sat on top of the
// Prev/Next row (state.howtoScroll/rulesScroll + the scrollDrag gesture live in game.js; this
// only ever reads/clamps them, never writes back, same "changes nothing" contract as the rest of
// this file). Returns the clamped scroll so the caller can draw a matching scrollbar thumb.
function drawScrollableBody(ctx, paragraphs, contentTop, bottomLimit, size, lineHeight, gap, width, scroll) {
  const available = bottomLimit - contentTop;
  let measured = 0;
  for (const para of paragraphs) {
    const lines = wrapText(ctx, para, W / 2, 0, width, lineHeight, size, undefined, undefined, undefined, true);
    measured += lines * lineHeight + gap;
  }
  measured -= gap;
  const overflow = Math.max(0, measured - available);
  const clamped = Math.min(Math.max(0, scroll), overflow);
  let y = overflow > 0 ? contentTop - clamped : contentTop + Math.max(0, (available - measured) / 2);

  // Asymmetric padding on purpose: generous above (a big font's own ascenders on the very first
  // line would otherwise get clipped even at scroll 0 — nothing is scrolled past yet, so there's
  // nothing above the first line this could wrongly reveal) and minimal below, so an overflowing
  // last line is actually cut at the boundary instead of peeking out just above the Prev/Next row.
  ctx.save();
  roundRect(ctx, 40, contentTop - 46, 640, available + 46 + 4, 10);
  ctx.clip();
  for (const para of paragraphs) {
    const lines = wrapText(ctx, para, W / 2, y, width, lineHeight, size, 'rgba(245,236,216,0.9)');
    y += lines * lineHeight + gap;
  }
  ctx.restore();

  if (overflow > 0) {
    const trackX = 664, trackW = 6;
    const thumbH = Math.max(36, available * available / measured);
    const thumbY = contentTop + (overflow > 0 ? (clamped / overflow) * (available - thumbH) : 0);
    ctx.fillStyle = 'rgba(245,236,216,0.15)';
    roundRect(ctx, trackX, contentTop, trackW, available, trackW / 2); ctx.fill();
    ctx.fillStyle = SILVER;
    roundRect(ctx, trackX, thumbY, trackW, thumbH, trackW / 2); ctx.fill();
  }
  return clamped;
}

// Same structure and navigation as Rules Reference (Back top-left, Prev/Next bottom row, the
// same big panel) — How to Play is a reference screen too, not a separate one-off flow.
function drawHowto(ctx, state, helpers) {
  const steps = helpers.HOWTO_STEPS;
  const step = steps[state.howtoStep];
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  button(ctx, RULES_BACK_BUTTON, 'Back', { size: 20 });
  button(ctx, TEXT_DEC, 'A-', { size: 26, disabled: state.textScaleIdx === 0 });
  button(ctx, TEXT_INC, 'A+', { size: 26, disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
  text(ctx, `HOW TO PLAY (${state.howtoStep + 1}/${steps.length})`, W / 2, 92, 24, 'rgba(245,236,216,0.55)', UI, 700);
  panel(ctx, 40, 108, 640, 1372);
  text(ctx, step.title, W / 2, 168, 34, GOLD, DISPLAY, 800);

  const contentTop = 248, bottomLimit = 1370;
  const size = 26 * scale, lineHeight = 38 * scale;
  drawScrollableBody(ctx, [step.body], contentTop, bottomLimit, size, lineHeight, 0, 540, state.howtoScroll ?? 0);

  button(ctx, RULES_PREV_BUTTON, 'Prev', { disabled: state.howtoStep === 0, size: 26 });
  button(ctx, RULES_NEXT_BUTTON, state.howtoStep < steps.length - 1 ? 'Next' : 'Start Playing', { primary: true, size: 26 });
}

const TIER_ACCENTS = [SAND, GOLD, CORAL];

function drawLobby(ctx, state, helpers) {
  text(ctx, 'DOMINÓ CUBANO', W / 2, 142, 40, GOLD, DISPLAY, 800);
  text(ctx, `Record ${state.matchRecord.wins}W – ${state.matchRecord.losses}L · best streak ${state.matchRecord.bestStreak}`,
    W / 2, 188, 26, 'rgba(245,236,216,0.8)');
  text(ctx, 'Choose your table', W / 2, 278, 32, CREAM, DISPLAY, 700);
  helpers.DIFFICULTIES.forEach((d, i) => {
    const r = difficultyCardRect(i);
    const selected = state.difficulty === i;
    const accent = TIER_ACCENTS[i] ?? GOLD;
    panel(ctx, r.x, r.y, r.w, r.h, selected ? 'rgba(224,182,84,0.16)' : 'rgba(24,12,8,0.62)');
    if (selected) {
      ctx.save();
      ctx.strokeStyle = accent; ctx.lineWidth = 3;
      roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 22); ctx.stroke();
      ctx.restore();
    }
    const badgeCx = r.x + 74, badgeCy = r.y + r.h / 2;
    drawTierBadge(ctx, badgeCx, badgeCy, 40, i + 1, accent, selected);
    const textX = badgeCx + 64;
    text(ctx, d.label, textX, r.y + 70, 34, GOLD, DISPLAY, 800, 'left');
    wrapText(ctx, d.desc, textX, r.y + 118, r.w - (textX - r.x) - 30, 32, 24, 'rgba(245,236,216,0.88)', UI, 'left');
  });
  button(ctx, START_BUTTON, 'Deal In', { primary: true, size: 45 });
}

// The exhaustive in-app Rules reference (docs/GAME-CATEGORIES.md). Content lives in
// content.js's RULES_PAGES; illustrations here reuse the exact same `drawTile` this whole game
// draws with, per that doc's "never a separate icon set" rule.
// Every illustration (tiles + any caption) is drawn to stay within [ILLUS_TOP, ILLUS_BOTTOM];
// body text always starts at BODY_START, well clear of the tallest illustration's caption.
const ILLUS_TOP = 210;
const ILLUS_BOTTOM = 400;
const BODY_START = 440;

function drawRulesIllustration(ctx, name) {
  const cx = W / 2, top = ILLUS_TOP;
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
    ctx.save();
    const bg = ctx.createRadialGradient(ecx, ecy, 10, ecx, ecy, rx);
    bg.addColorStop(0, 'rgba(224,182,84,0.18)'); bg.addColorStop(1, 'rgba(224,182,84,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(ecx, ecy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(224,182,84,0.55)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(ecx, ecy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    [
      { label: 'You', dx: 0, dy: 1, color: PEACH },
      { label: 'Opp 1', dx: -1, dy: 0, color: SAND },
      { label: 'Partner', dx: 0, dy: -1, color: GOLD },
      { label: 'Opp 2', dx: 1, dy: 0, color: SAND },
    ].forEach(({ label, dx, dy, color }) => {
      const px = ecx + dx * rx, py = ecy + dy * ry;
      ctx.save();
      ctx.strokeStyle = 'rgba(224,182,84,0.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ecx, ecy); ctx.lineTo(px, py); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = 'rgba(20,12,8,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
      const labelY = dy === -1 ? py - 18 : dy === 1 ? py + 24 : py - 16;
      text(ctx, label, px, labelY, 15, color, UI, 700);
    });
  }
}

function drawRules(ctx, state, helpers) {
  const pages = helpers.RULES_PAGES;
  const page = pages[state.rulesPage];
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  button(ctx, RULES_BACK_BUTTON, 'Back', { size: 20 });
  button(ctx, TEXT_DEC, 'A-', { size: 26, disabled: state.textScaleIdx === 0 });
  button(ctx, TEXT_INC, 'A+', { size: 26, disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
  text(ctx, `RULES REFERENCE (${state.rulesPage + 1}/${pages.length})`, W / 2, 92, 24, 'rgba(245,236,216,0.55)', UI, 700);
  panel(ctx, 40, 108, 640, 1372);
  text(ctx, page.title, W / 2, 168, 34, GOLD, DISPLAY, 800);
  if (page.illustration) drawRulesIllustration(ctx, page.illustration);
  const contentTop = page.illustration ? BODY_START : 248;
  const bottomLimit = 1370; // stay clear of the Prev/Next row at y=1390
  const size = 24 * scale, lineHeight = 34 * scale, gap = 17 * scale;
  // A short page's text centers in the space below the title/illustration (never hugging the top
  // and leaving one big empty gap at the bottom of this very tall panel); a long one — especially
  // at a high text-size setting — scrolls instead of overlapping the Prev/Next row below it.
  drawScrollableBody(ctx, page.body, contentTop, bottomLimit, size, lineHeight, gap, 520, state.rulesScroll ?? 0);
  button(ctx, RULES_PREV_BUTTON, 'Prev', { disabled: state.rulesPage === 0, size: 26 });
  button(ctx, RULES_NEXT_BUTTON, 'Next', { disabled: state.rulesPage === pages.length - 1, primary: state.rulesPage < pages.length - 1, size: 26 });
}

function drawDemoLimit(ctx, manifest) {
  const cx = W / 2;
  drawTile(ctx, cx - 46, 560, 92, 138, 9, 9, { highlight: true, lift: true });
  text(ctx, 'FREE PREVIEW FINISHED', cx, 762, 32, GOLD, DISPLAY, 800);
  wrapText(ctx, `You’ve played the free preview matches of ${manifest?.title ?? 'this game'}.`, cx, 822, 560, 30, 20);
  wrapText(ctx, 'Get the full game on iPhone and Android to keep playing — same table, no limits.', cx, 880, 560, 30, 20);

  // Purely decorative — the shell's own store links live outside this canvas.
  const pillW = 250, pillH = 62, gap = 24, pillY = 990;
  const startX = cx - pillW - gap / 2;
  [['iPhone', CREAM], ['Android', GOLD]].forEach(([label, accent], i) => {
    const x = startX + i * (pillW + gap);
    ctx.save();
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
    roundRect(ctx, x, pillY, pillW, pillH, 31); ctx.stroke();
    ctx.restore();
    text(ctx, label, x + pillW / 2, pillY + pillH / 2 + 7, 20, accent, UI, 700);
  });
}

export function render(ctx, state, manifest, helpers) {
  backdrop(ctx);
  if (state.scene === 'title') drawTitle(ctx, state, manifest);
  else if (state.scene === 'howto') drawHowto(ctx, state, helpers);
  else if (state.scene === 'rules') drawRules(ctx, state, helpers);
  else if (state.scene === 'lobby') drawLobby(ctx, state, helpers);
  else if (state.scene === 'playing') {
    drawSeats(ctx, state);
    drawLine(ctx, state);
    drawRack(ctx, state);
    drawHud(ctx, state);
    if (state.matchResult) drawMatchResult(ctx, state);
    else if (state.handResult) drawHandResult(ctx, state);
  } else if (state.scene === 'auto') {
    drawSeats(ctx, state);
    drawLine(ctx, state);
    drawRack(ctx, state);
    drawAutoHud(ctx, state);
    if (state.handResult) drawHandResult(ctx, state);
  } else if (state.scene === 'demo-limit') drawDemoLimit(ctx, manifest);
}
