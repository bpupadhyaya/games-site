// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// All motion is a function of state.pulse (the fixed-step clock) and the start times in state.fx.
import { W, H, COLS, ROWS, CELL, FRAME, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, HUD, MODE_SWITCH, HINT_BTN, COLOR_BTN, NEW_BTN, RESULT_CARD, SHIELD_BTN, AGAIN_BTN, AGAIN_BTN_WIDE, PLAY_BTN, TITLE_COLOR_BTN, HERO } from './layout.js';
import { palette, alpha } from './themes.js';

const FONT = '"Fredoka", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const LIGHT = '#f4fbfa';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (f) => 1 - (1 - f) ** 3;
const easeOutBack = (f) => 1 + 2.4 * (f - 1) ** 3 + 1.4 * (f - 1) ** 2;
// A press dips the button, then it springs back with a small overshoot.
const spring = (tau) => (tau < 0 || tau > 0.6 ? 0 : Math.exp(-tau * 9) * Math.cos(tau * 20));

const setFont = (ctx, size, weight = 700) => {
  ctx.font = `${weight} ${size}px ${FONT}`;
};
const text = (ctx, str, x, y, size, color, weight = 700, align = 'center') => {
  setFont(ctx, size, weight);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
};
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};
const formatTime = (s) => (s < 100 ? s.toFixed(1) : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

// ---- backdrop ---------------------------------------------------------------------------------
function drawBackground(ctx, pal, t) {
  const g = ctx.createRadialGradient(W * 0.8, -80, 40, W * 0.8, -80, H * 1.05);
  g.addColorStop(0, pal.bg[0]);
  g.addColorStop(0.5, pal.bg[1]);
  g.addColorStop(1, pal.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Sea-chart graticule.
  ctx.strokeStyle = alpha(pal.ink, 0.05);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 60; x < W; x += 120) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 60; y < H; y += 120) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // Slow swell: contour lines that drift sideways and breathe.
  ctx.lineWidth = 3;
  for (let k = 0; k < 10; k++) {
    const y0 = 90 + k * 160;
    const amp = 16 + 6 * Math.sin(t * 0.5 + k);
    ctx.strokeStyle = alpha(pal.ink, 0.05 + 0.025 * Math.sin(t * 0.7 + k * 1.3));
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 20) {
      const y = y0 + Math.sin(x * 0.011 + t * 0.45 + k * 1.9) * amp + Math.sin(x * 0.023 - t * 0.3 + k) * amp * 0.4;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Drifting specks of light.
  for (let k = 0; k < 22; k++) {
    const ph = (t * (0.018 + (k % 5) * 0.004) + k * 0.173) % 1;
    const x = ((k * 97) % W) + Math.sin(t * 0.6 + k) * 18;
    const y = H - ph * H;
    ctx.fillStyle = alpha(pal.ink, 0.22 * Math.sin(Math.PI * ph));
    ctx.beginPath();
    ctx.arc(x, y, 2 + (k % 3), 0, TAU);
    ctx.fill();
  }

  const v = ctx.createLinearGradient(0, H * 0.55, 0, H);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, pal.lightInk ? 'rgba(0,0,0,0.38)' : 'rgba(40,20,80,0.18)');
  ctx.fillStyle = v;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
}

function drawCompass(ctx, pal, cx, cy, r, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 0.25) * 0.18);
  ctx.strokeStyle = alpha(pal.ink, 0.13);
  ctx.fillStyle = alpha(pal.ink, 0.1);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, TAU);
  ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const len = k % 2 === 0 ? r * 0.98 : r * 0.55;
    ctx.save();
    ctx.rotate((k * TAU) / 8);
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(r * 0.13, 0);
    ctx.lineTo(-r * 0.13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// A moored mine bobbing on its chain, low in the corner of the title.
function drawBuoyMine(ctx, pal, cx, cy, t) {
  const bob = Math.sin(t * 1.1) * 10;
  const sway = Math.sin(t * 0.8 + 1) * 8;
  ctx.strokeStyle = alpha(pal.ink, 0.28);
  ctx.lineWidth = 5;
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(cx + sway, cy + bob + 40);
  ctx.quadraticCurveTo(cx + sway * 0.4, cy + 110, cx - 6, H + 10);
  ctx.stroke();
  ctx.setLineDash([]);
  const halo = ctx.createRadialGradient(cx + sway, cy + bob, 20, cx + sway, cy + bob, 150);
  halo.addColorStop(0, alpha(pal.ink, 0.3));
  halo.addColorStop(1, alpha(pal.ink, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx + sway, cy + bob, 150, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(cx + sway, cy + bob);
  ctx.rotate(Math.sin(t * 0.9) * 0.12);
  drawMine(ctx, 0, 0, 210);
  ctx.restore();
}

// ---- tiles, flags, mines -------------------------------------------------------------------------
// An unopened tile: a raised, bevelled block with a darker lip along its lower edge.
function drawTile(ctx, pal, x, y, s, o = {}) {
  const scale = o.scale ?? 1;
  if (scale <= 0.02) return;
  const half = s / 2 - s * 0.035;
  const lip = s * 0.1;
  const r = s * 0.17;
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2 - (o.lift ?? 0));
  ctx.scale(scale, scale);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  rr(ctx, -half, -half, half * 2, half * 2, r);
  ctx.fillStyle = pal.tileLip;
  ctx.fill();
  const g = ctx.createLinearGradient(0, -half, 0, half - lip);
  g.addColorStop(0, pal.tileTop);
  g.addColorStop(1, pal.tileBottom);
  rr(ctx, -half, -half, half * 2, half * 2 - lip, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = alpha('#ffffff', 0.22);
  ctx.lineWidth = Math.max(1.5, s * 0.025);
  ctx.stroke();
  // soft gloss across the upper half
  rr(ctx, -half + s * 0.07, -half + s * 0.06, half * 2 - s * 0.14, (half * 2 - lip) * 0.42, r * 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.fill();
  ctx.restore();
}

// An opened cell: a shallow recess in the chart paper.
function drawCell(ctx, pal, x, y, s, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  if (o.danger) {
    g.addColorStop(0, '#ff8f7d');
    g.addColorStop(1, '#e2473f');
  } else {
    g.addColorStop(0, pal.cellTop);
    g.addColorStop(1, pal.cellBottom);
  }
  rr(ctx, 1.5, 1.5, s - 3, s - 3, s * 0.1);
  ctx.fillStyle = g;
  ctx.fill();
  // inner shadow under the top edge sells the recess
  rr(ctx, 1.5, 1.5, s - 3, s * 0.09, [s * 0.1, s * 0.1, 0, 0]);
  ctx.fillStyle = 'rgba(0,0,0,0.11)';
  ctx.fill();
  ctx.restore();
}

function drawNumber(ctx, pal, n, cx, cy, s, scale = 1) {
  if (scale <= 0.02) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  setFont(ctx, s * 0.66, 700);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(String(n), 0, s * 0.235 + 2);
  ctx.fillStyle = pal.numbers[n];
  ctx.fillText(String(n), 0, s * 0.235);
  ctx.restore();
}

// A little marker flag on a brass foot. `drop` 0..1 plays the plant-in bounce.
function drawFlag(ctx, cx, cy, s, o = {}) {
  const f = clamp01(o.drop ?? 1);
  const sc = (o.scale ?? 1) * (0.4 + 0.6 * easeOutBack(f));
  const wave = Math.sin((o.t ?? 0) * 4 + cx * 0.05) * 0.08;
  ctx.save();
  ctx.translate(cx, cy - (1 - easeOut(f)) * s * 0.5);
  ctx.scale(sc, sc);
  ctx.globalAlpha *= Math.min(1, f * 4);
  // foot
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.27, s * 0.24, s * 0.07, 0, 0, TAU);
  ctx.fill();
  const foot = ctx.createLinearGradient(0, s * 0.16, 0, s * 0.28);
  foot.addColorStop(0, '#ffe08a');
  foot.addColorStop(1, '#b57a1c');
  ctx.fillStyle = foot;
  rr(ctx, -s * 0.17, s * 0.17, s * 0.34, s * 0.09, s * 0.04);
  ctx.fill();
  // pole
  ctx.strokeStyle = '#2b1d12';
  ctx.lineWidth = s * 0.075;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, s * 0.18);
  ctx.lineTo(-s * 0.06, -s * 0.28);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.moveTo(-s * 0.075, s * 0.14);
  ctx.lineTo(-s * 0.075, -s * 0.26);
  ctx.stroke();
  // pennant
  const g = ctx.createLinearGradient(-s * 0.06, -s * 0.3, s * 0.3, 0);
  g.addColorStop(0, o.gold ? '#fff0a8' : '#ff7a66');
  g.addColorStop(1, o.gold ? '#f0a51e' : '#d3262f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 0.04, -s * 0.3);
  ctx.quadraticCurveTo(s * 0.12, -s * (0.3 + wave), s * 0.3, -s * (0.17 - wave * 0.5));
  ctx.quadraticCurveTo(s * 0.12, -s * (0.1 - wave), -s * 0.04, -s * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,10,10,0.45)';
  ctx.lineWidth = s * 0.02;
  ctx.stroke();
  ctx.restore();
}

// A sea mine: dark iron ball, stubby horns, one glint.
function drawMine(ctx, cx, cy, s, scale = 1) {
  if (scale <= 0.02) return;
  const r = s * 0.22;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, r * 1.35, r * 1.05, r * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#1a222b';
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.1;
  for (let k = 0; k < 8; k++) {
    const a = (k * TAU) / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#6d7c8a');
  g.addColorStop(0.55, '#2c3742');
  g.addColorStop(1, '#10161c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.13, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawRing(ctx, x, y, s, kind, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  const color = kind === 'mine' ? '#ff5a4d' : '#4dffa6';
  rr(ctx, x + 4, y + 4, s - 8, s - 8, s * 0.14);
  ctx.strokeStyle = alpha(color, 0.35);
  ctx.lineWidth = s * 0.16 + pulse * s * 0.06;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.06 + pulse * s * 0.03;
  ctx.stroke();
}

// The frame and the dark well the tiles sit in.
function drawFrame(ctx, pal, x, y, w, h, o = {}) {
  const f = o.frame ?? FRAME;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, x - f + 2, y - f + 12, w + f * 2 - 4, h + f * 2, f + 12);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y - f, 0, y + h + f);
  g.addColorStop(0, pal.frameTop);
  g.addColorStop(1, pal.frameBottom);
  rr(ctx, x - f, y - f, w + f * 2, h + f * 2, f + 10);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = o.glow ?? 'rgba(255,255,255,0.28)';
  ctx.lineWidth = o.glow ? 5 : 2.5;
  ctx.stroke();
  rr(ctx, x - 3, y - 3, w + 6, h + 6, 10);
  ctx.fillStyle = pal.well;
  ctx.fill();
}

// ---- UI chrome -------------------------------------------------------------------------------------
function glassPanel(ctx, r, radius = 28) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, r.x + 2, r.y + 8, r.w - 4, r.h, radius);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(10,34,42,0.86)');
  g.addColorStop(1, 'rgba(4,16,22,0.9)');
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

const BUTTON_KINDS = {
  primary: { top: '#ffd96b', bottom: '#f39a1d', lip: '#9a5608', ink: '#3a1d02', rim: 'rgba(255,250,220,0.8)' },
  go: { top: '#5ff0c0', bottom: '#15a783', lip: '#0a5c47', ink: '#03281e', rim: 'rgba(230,255,245,0.75)' },
  glass: { top: 'rgba(30,62,72,0.95)', bottom: 'rgba(8,26,34,0.95)', lip: 'rgba(0,0,0,0.55)', ink: LIGHT, rim: 'rgba(255,255,255,0.3)' },
};

// icon(ctx, cx, cy, size, ink) draws at the given centre.
function drawButton(ctx, r, label, o = {}) {
  const k = o.kind && o.kind !== 'glass' ? BUTTON_KINDS[o.kind] : { ...BUTTON_KINDS.glass, top: o.pal.glassTop, bottom: o.pal.glassBottom };
  const dip = spring(o.pressTau ?? -1);
  const sc = 1 - 0.07 * dip + (o.breathe ?? 0);
  const radius = Math.min(30, r.h * 0.3);
  const lip = 9;
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(sc, sc);
  const x = -r.w / 2;
  const y = -r.h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, x + 3, y + 10, r.w - 6, r.h, radius);
  ctx.fill();
  rr(ctx, x, y, r.w, r.h, radius);
  ctx.fillStyle = k.lip;
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + r.h - lip);
  g.addColorStop(0, k.top);
  g.addColorStop(1, k.bottom);
  rr(ctx, x, y, r.w, r.h - lip, radius);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = k.rim;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  rr(ctx, x + 8, y + 6, r.w - 16, (r.h - lip) * 0.4, radius * 0.7);
  ctx.fillStyle = o.kind === 'glass' || !o.kind ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.22)';
  ctx.fill();

  const size = o.size ?? 30;
  const cy = -lip / 2;
  if (o.icon && o.stacked) {
    o.icon(ctx, 0, cy - 17, o.iconSize ?? 44, k.ink);
    text(ctx, label, 0, cy + 40, size, k.ink, 600);
  } else if (o.icon) {
    setFont(ctx, size, 700);
    const tw = ctx.measureText(label).width;
    const iw = size * (o.iconScale ?? 1.15);
    const x0 = -(tw + iw + 14) / 2;
    o.icon(ctx, x0 + iw / 2, cy, iw, k.ink);
    text(ctx, label, x0 + iw + 14, cy + size * 0.35, size, k.ink, 700, 'left');
  } else {
    text(ctx, label, 0, cy + size * 0.35, size, k.ink, 700);
  }
  ctx.restore();
}

const iconPlay = (ctx, cx, cy, s, ink) => {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy - s * 0.42);
  ctx.lineTo(cx + s * 0.45, cy);
  ctx.lineTo(cx - s * 0.3, cy + s * 0.42);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.14;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.fill();
};
const iconBulb = (ctx, cx, cy, s) => {
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(cx - s * 0.11, cy - s * 0.22, s * 0.09, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c9d6db';
  rr(ctx, cx - s * 0.16, cy + s * 0.2, s * 0.32, s * 0.2, s * 0.06);
  ctx.fill();
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  for (const a of [-2.4, -1.57, -0.74]) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * s * 0.46, cy - s * 0.12 + Math.sin(a) * s * 0.46);
    ctx.lineTo(cx + Math.cos(a) * s * 0.58, cy - s * 0.12 + Math.sin(a) * s * 0.58);
    ctx.stroke();
  }
};
const iconNew = (ctx, cx, cy, s, ink) => {
  ctx.strokeStyle = ink;
  ctx.lineWidth = s * 0.13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.36, -0.9, TAU - 2.1);
  ctx.stroke();
  const a = -0.9;
  const px = cx + Math.cos(a) * s * 0.36;
  const py = cy + Math.sin(a) * s * 0.36;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(px + s * 0.2, py + s * 0.12);
  ctx.lineTo(px - s * 0.2, py + s * 0.04);
  ctx.lineTo(px + s * 0.06, py - s * 0.26);
  ctx.closePath();
  ctx.fill();
};
const iconUndo = (ctx, cx, cy, s, ink) => {
  ctx.strokeStyle = ink;
  ctx.lineWidth = s * 0.13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.12, cy - s * 0.1);
  ctx.arc(cx + s * 0.12, cy + s * 0.12, s * 0.22, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(cx - s * 0.12, cy + s * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.14, cy - s * 0.3);
  ctx.lineTo(cx - s * 0.36, cy - s * 0.1);
  ctx.lineTo(cx - s * 0.14, cy + s * 0.1);
  ctx.stroke();
};
const iconSwatches = (pal) => (ctx, cx, cy, s) => {
  const colors = [pal.tileTop, pal.cellTop, pal.bg[0]];
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx + (i - 1) * s * 0.3, cy + (i === 1 ? -s * 0.1 : s * 0.08), s * 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
};
const iconMiniCell = (pal) => (ctx, cx, cy, s) => {
  drawCell(ctx, pal, cx - s / 2, cy - s / 2, s);
  drawNumber(ctx, pal, 1, cx, cy, s);
};

// ---- scenes ----------------------------------------------------------------------------------------
function drawLogo(ctx, pal, cx, y, size, t, intro) {
  const f = easeOutBack(clamp01(intro / 0.6));
  ctx.save();
  ctx.translate(cx, y + Math.sin(t * 1.3) * 5 - (1 - f) * 70);
  ctx.globalAlpha *= clamp01(intro / 0.25);
  ctx.rotate(-0.035);
  setFont(ctx, size, 700);
  const tw = ctx.measureText('Sure Sweep').width;
  if (tw > 640) ctx.scale(640 / tw, 640 / tw);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  // extruded shadow, then outline, then the lit face
  ctx.fillStyle = 'rgba(2,20,26,0.55)';
  ctx.strokeStyle = 'rgba(2,20,26,0.55)';
  ctx.lineWidth = 16;
  ctx.strokeText('Sure Sweep', 0, 14);
  ctx.strokeStyle = '#06323a';
  ctx.lineWidth = 16;
  for (let d = 8; d >= 0; d -= 2) ctx.strokeText('Sure Sweep', 0, d);
  const g = ctx.createLinearGradient(0, -size * 0.75, 0, size * 0.1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#e9fffb');
  g.addColorStop(1, '#8ff0e2');
  ctx.fillStyle = g;
  ctx.fillText('Sure Sweep', 0, 0);
  ctx.restore();
}

// The small solved-looking corner of a board on the title: it shows the whole idea of the game
// (numbers, a sure mine being flagged, a sure safe tile) and never stops moving.
const HERO_MINES = [3, 15, 20, 24];
const HERO_HIDDEN = new Set([3, 4, 15, 20, 24]);
const HERO_FLAGGED = new Set([3, 15, 24]);
function heroNumber(i) {
  const n = HERO.n;
  let c = 0;
  for (const m of HERO_MINES) if (Math.abs((m % n) - (i % n)) <= 1 && Math.abs(Math.floor(m / n) - Math.floor(i / n)) <= 1) c++;
  return c;
}

function drawHero(ctx, pal, t, intro) {
  const { n, cell } = HERO;
  const size = n * cell;
  const f = easeOutBack(clamp01((intro - 0.15) / 0.6));
  if (f <= 0) return;
  ctx.save();
  ctx.translate(HERO.x, HERO.y + Math.sin(t * 0.9) * 6);
  ctx.rotate(-0.06 + Math.sin(t * 0.5) * 0.008);
  ctx.scale(f, f);
  const x0 = -size / 2;
  const y0 = -size / 2;
  drawFrame(ctx, pal, x0, y0, size, size, { frame: 18 });
  const cycle = t % 6; // ring -> flag drops -> holds -> clears
  for (let i = 0; i < n * n; i++) {
    const x = x0 + (i % n) * cell;
    const y = y0 + Math.floor(i / n) * cell;
    if (!HERO_HIDDEN.has(i)) {
      drawCell(ctx, pal, x, y, cell);
      const num = heroNumber(i);
      if (num > 0) drawNumber(ctx, pal, num, x + cell / 2, y + cell / 2, cell);
      continue;
    }
    const lift = 2 + Math.sin(t * 2 + i * 0.9) * 2;
    drawTile(ctx, pal, x, y, cell, { lift });
    if (HERO_FLAGGED.has(i)) drawFlag(ctx, x + cell / 2, y + cell / 2 - lift, cell, { t });
    else if (i === 20) {
      if (cycle < 2.2) drawRing(ctx, x, y - lift, cell, 'mine', t);
      else if (cycle < 5.6) drawFlag(ctx, x + cell / 2, y + cell / 2 - lift, cell, { t, drop: (cycle - 2.2) / 0.35 });
    } else if (i === 4) drawRing(ctx, x, y - lift, cell, 'safe', t + 0.5);
  }
  // a band of light sweeps across now and then
  const sweep = ((t + 1.5) % 4.5) / 1.1;
  if (sweep < 1) {
    ctx.save();
    rr(ctx, x0, y0, size, size, 10);
    ctx.clip();
    const sx = x0 - 160 + (size + 320) * sweep;
    const g = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.transform(1, 0, -0.35, 1, 0, 0);
    ctx.fillRect(sx - 90 + y0 * 0.35 - 200, y0, 180 + 400, size);
    ctx.restore();
  }
  ctx.restore();
}

function drawPill(ctx, cx, y, label, o = {}) {
  setFont(ctx, o.size ?? 26, 600);
  const w = ctx.measureText(label).width + 56;
  const h = o.h ?? 56;
  rr(ctx, cx - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(4,18,24,0.62)';
  ctx.fill();
  ctx.strokeStyle = o.rim ?? 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, label, cx, y + (o.size ?? 26) * 0.35, o.size ?? 26, o.color ?? LIGHT, 600);
}

function drawTitle(ctx, state, pal, extra) {
  const t = state.pulse;
  const fx = state.fx;
  const intro = 10; // the front door is complete on the very first frame; idle motion carries it
  drawCompass(ctx, pal, 610, 1430, 170, t);
  drawBuoyMine(ctx, pal, 96, 1440, t);
  drawLogo(ctx, pal, 360, 300, 112, t, intro);
  const a = clamp01((intro - 0.3) / 0.4);
  ctx.save();
  ctx.globalAlpha = a;
  text(ctx, 'No-guess minesweeper', 360, 372, 34, pal.ink, 600);
  text(ctx, 'Every board solves by logic alone.', 360, 414, 25, pal.inkSoft, 500);
  ctx.restore();

  drawHero(ctx, pal, t, intro);

  const b = easeOut(clamp01((intro - 0.45) / 0.45));
  ctx.save();
  ctx.globalAlpha = b;
  ctx.translate(0, (1 - b) * 50);
  drawButton(ctx, PLAY_BTN, 'Play', { kind: 'primary', size: 58, icon: iconPlay, breathe: Math.sin(t * 2.4) * 0.012, pressTau: fx.btn === 'play' ? t - fx.btnAt : -1 });
  drawButton(ctx, TITLE_COLOR_BTN, `Colours: ${pal.name}`, { pal, size: 32, iconScale: 1.7, icon: iconSwatches(pal), pressTau: fx.btn === 'colors' ? t - fx.btnAt : -1 });
  if (state.bestTime !== null) drawPill(ctx, 360, 1378, `Best time  ${formatTime(state.bestTime)}s`, { color: '#ffe08a', rim: 'rgba(255,224,138,0.5)', size: 28 });
  else drawPill(ctx, 360, 1378, 'No best time yet - set one', { size: 24, color: 'rgba(244,251,250,0.8)' });
  if (state.demo) drawPill(ctx, 360, 1450, `Free preview: ${extra.demoLeft} board${extra.demoLeft === 1 ? '' : 's'} left`, { size: 22, h: 46 });
  ctx.restore();
}

function drawDemoLimit(ctx, state, pal) {
  const t = state.pulse;
  drawCompass(ctx, pal, 610, 1430, 170, t);
  drawLogo(ctx, pal, 360, 300, 112, t, 10);
  const card = { x: 40, y: 560, w: 640, h: 360 };
  glassPanel(ctx, card, 34);
  text(ctx, "That's the free preview!", 360, 650, 44, '#ffe08a', 700);
  wrapText(ctx, 'Get the full game on iPhone and Android for unlimited boards, hints and no interruptions.', 360, 725, 540, 42, 29, LIGHT, 500);
}

function wrapText(ctx, str, cx, y, maxWidth, lineHeight, size, color, weight = 500) {
  setFont(ctx, size, weight);
  const words = str.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      text(ctx, line, cx, y, size, color, weight);
      line = word;
      y += lineHeight;
    } else line = test;
  }
  if (line) text(ctx, line, cx, y, size, color, weight);
}

function drawHud(ctx, state, pal, extra) {
  glassPanel(ctx, HUD, 30);
  const { x, y, w, h } = HUD;
  const mid = y + h / 2;
  // mines left
  drawCell(ctx, pal, x + 22, mid - 40, 80);
  drawMine(ctx, x + 62, mid - 2, 80);
  text(ctx, 'MINES', x + 122, y + 40, 19, 'rgba(244,251,250,0.6)', 600, 'left');
  text(ctx, String(state.scene === 'won' ? 0 : Math.max(extra.remainingFlags, 0)).padStart(2, '0'), x + 120, y + 98, 58, LIGHT, 700, 'left');
  // progress ring
  let opened = 0;
  let safe = 0;
  for (let i = 0; i < state.numbers.length; i++) {
    if (state.numbers[i] === -1) continue;
    safe++;
    if (state.revealed[i]) opened++;
  }
  const frac = safe ? opened / safe : 0;
  const cx = x + w / 2;
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(cx, mid, 42, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = state.scene === 'lost' ? '#ff7a66' : '#4dffc3';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, mid, 42, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(frac, 0.001));
  ctx.stroke();
  ctx.lineCap = 'butt';
  text(ctx, `${Math.round(frac * 100)}%`, cx, mid + 9, 26, LIGHT, 700);
  // timer
  text(ctx, 'TIME', x + w - 30, y + 40, 19, 'rgba(244,251,250,0.6)', 600, 'right');
  setFont(ctx, 30, 600);
  const sw = ctx.measureText('s').width;
  text(ctx, 's', x + w - 30, y + 98, 30, 'rgba(244,251,250,0.7)', 600, 'right');
  text(ctx, formatTime(state.time), x + w - 34 - sw, y + 98, 58, LIGHT, 700, 'right');
}

function drawBoard(ctx, state, pal) {
  const t = state.pulse;
  const fx = state.fx;
  const lost = state.scene === 'lost';
  const won = state.scene === 'won';
  const since = t - fx.sceneAt;
  const flagGlow = state.scene === 'playing' && state.flagMode ? alpha('#ff6b5e', 0.65 + 0.3 * Math.sin(t * 5)) : undefined;

  ctx.save();
  if (lost && since < 0.6) ctx.translate(Math.sin(since * 55) * 5 * Math.exp(-since * 7), 0);
  drawFrame(ctx, pal, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, { glow: flagGlow });

  const fullReveal = lost && state.shieldOffered; // no undo left, so nothing is given away
  const ex = state.exploded >= 0 ? state.exploded % COLS : 0;
  const ey = state.exploded >= 0 ? Math.floor(state.exploded / COLS) : 0;

  for (let i = 0; i < COLS * ROWS; i++) {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const x = BOARD_X + c * CELL;
    const y = BOARD_Y + r * CELL;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const num = state.numbers[i];
    const settle = fx.boardAt < 0 ? 1 : clamp01((t - fx.boardAt - (r + c) * 0.02) / 0.32);
    const tileScale = easeOutBack(settle);
    const p = state.revealed[i] ? (fx.revealAt[i] < 0 ? 1 : clamp01((t - fx.revealAt[i]) / 0.26)) : 0;

    if (p > 0) {
      const exploded = state.exploded === i;
      drawCell(ctx, pal, x, y, CELL, { danger: exploded, alpha: Math.min(1, p * 3) });
      const pop = easeOutBack(clamp01((p - 0.25) / 0.75));
      if (num === -1) drawMine(ctx, cx, cy, CELL, pop);
      else if (num > 0) drawNumber(ctx, pal, num, cx, cy, CELL, pop);
      if (p < 1) drawTile(ctx, pal, x, y, CELL, { scale: 1 - easeOut(p) * 0.55, alpha: 1 - p, lift: p * 16 });
    } else {
      // on a final loss the remaining mines surface one by one, outward from the blast
      const q = fullReveal && num === -1 && !state.flagged[i] ? clamp01((since - 0.35 - Math.hypot(c - ex, r - ey) * 0.07) / 0.3) : 0;
      if (q > 0) {
        drawCell(ctx, pal, x, y, CELL, { alpha: Math.min(1, q * 3) });
        drawMine(ctx, cx, cy, CELL, easeOutBack(q));
        if (q < 1) drawTile(ctx, pal, x, y, CELL, { scale: 1 - easeOut(q) * 0.55, alpha: 1 - q, lift: q * 16 });
      } else {
        const wave = won ? Math.sin(Math.PI * clamp01((since - ((r + c) / 16) * 0.7) / 0.4)) : 0;
        drawTile(ctx, pal, x, y, CELL, { scale: tileScale, lift: wave * 8 });
        if (state.flagged[i]) {
          drawFlag(ctx, cx, cy - wave * 8, CELL, { t, drop: fx.flagAt[i] < 0 ? 1 : (t - fx.flagAt[i]) / 0.3, gold: won });
          if (fullReveal && num !== -1 && since > 0.6) {
            ctx.strokeStyle = '#ff3b30';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x + 16, y + 16);
            ctx.lineTo(x + CELL - 16, y + CELL - 16);
            ctx.moveTo(x + CELL - 16, y + 16);
            ctx.lineTo(x + 16, y + CELL - 16);
            ctx.stroke();
          }
        } else if (won) {
          // every tile still closed at a win is a mine: they flag themselves as the sweep passes
          const d = (since - ((r + c) / 16) * 0.7 - 0.15) / 0.3;
          if (d > 0) drawFlag(ctx, cx, cy - wave * 8, CELL, { t, drop: d, gold: true });
        }
      }
    }

    if (won) {
      const lt = clamp01((since - ((r + c) / 16) * 0.7) / 0.4);
      if (lt > 0 && lt < 1) {
        rr(ctx, x + 1.5, y + 1.5, CELL - 3, CELL - 3, 8);
        ctx.fillStyle = `rgba(255,255,255,${0.5 * Math.sin(Math.PI * lt)})`;
        ctx.fill();
      }
    }

    const hinted = (state.hint && state.hint.index === i && state.hint.kind) || (lost && state.lossHint && state.lossHint.index === i && state.lossHint.kind);
    if (hinted) drawRing(ctx, x, y, CELL, hinted, t);
  }

  if (lost && state.exploded >= 0 && since < 0.7) {
    const f = since / 0.7;
    ctx.save();
    rr(ctx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 10);
    ctx.clip();
    ctx.strokeStyle = `rgba(255,140,110,${0.7 * (1 - f)})`;
    ctx.lineWidth = 14 * (1 - f) + 2;
    ctx.beginPath();
    ctx.arc(BOARD_X + ex * CELL + CELL / 2, BOARD_Y + ey * CELL + CELL / 2, 24 + easeOut(f) * 380, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawModeSwitch(ctx, state, pal) {
  const t = state.pulse;
  const fx = state.fx;
  const r = MODE_SWITCH;
  rr(ctx, r.x, r.y, r.w, r.h, 34);
  ctx.fillStyle = 'rgba(3,14,20,0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();
  rr(ctx, r.x + 3, r.y + 3, r.w - 6, 12, [30, 30, 0, 0]);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  const f = fx.modeAt < 0 ? 1 : easeOutBack(clamp01((t - fx.modeAt) / 0.24));
  const pos = state.flagMode ? f : 1 - f;
  const tw = r.w / 2 - 10;
  const tx = r.x + 8 + pos * (r.w / 2 - 6);
  const thumb = { x: tx, y: r.y + 8, w: tw, h: r.h - 16 };
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, thumb.x + 2, thumb.y + 6, thumb.w - 4, thumb.h, 28);
  ctx.fill();
  const g = ctx.createLinearGradient(0, thumb.y, 0, thumb.y + thumb.h);
  if (state.flagMode) {
    g.addColorStop(0, '#ff8571');
    g.addColorStop(1, '#d4332f');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#cfeee9');
  }
  rr(ctx, thumb.x, thumb.y, thumb.w, thumb.h, 28);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const cy = r.y + r.h / 2;
  const leftInk = state.flagMode ? 'rgba(244,251,250,0.78)' : '#0b3a40';
  const rightInk = state.flagMode ? '#ffffff' : 'rgba(244,251,250,0.78)';
  const lx = r.x + r.w * 0.25;
  const rx = r.x + r.w * 0.75;
  iconMiniCell(pal)(ctx, lx - 78, cy, 50);
  text(ctx, 'Reveal', lx + 28, cy + 14, 40, leftInk, 700);
  drawFlag(ctx, rx - 62, cy + 2, 66, { t });
  text(ctx, 'Flag', rx + 24, cy + 14, 40, rightInk, 700);
}

function drawControls(ctx, state, pal) {
  const t = state.pulse;
  const fx = state.fx;
  let tip = 'Tap a tile to open it. Tap a number to clear around it.';
  if (state.hint) tip = state.hint.kind === 'mine' ? 'Sure move: the ringed tile is a mine - flag it.' : 'Sure move: the ringed tile is safe to open.';
  else if (state.flagMode) tip = 'Flag mode: tap a tile to plant or lift a flag.';
  text(ctx, tip, W / 2, 1090, 25, state.hint ? pal.ink : pal.inkSoft, 500);

  drawModeSwitch(ctx, state, pal);
  const tau = (id) => (fx.btn === id ? t - fx.btnAt : -1);
  drawButton(ctx, HINT_BTN, 'Hint', { pal, icon: iconBulb, stacked: true, size: 28, pressTau: tau('hint') });
  drawButton(ctx, COLOR_BTN, 'Colours', { pal, icon: iconSwatches(pal), iconSize: 62, stacked: true, size: 28, pressTau: tau('colors') });
  drawButton(ctx, NEW_BTN, 'New board', { pal, icon: iconNew, stacked: true, size: 28, pressTau: tau('new') });

  const best = state.bestTime !== null ? `Best ${formatTime(state.bestTime)}s   ·   ` : '';
  text(ctx, `${best}Colours: ${pal.name}`, W / 2, 1436, 24, pal.inkSoft, 500);
}

function drawResult(ctx, state, pal, a) {
  const t = state.pulse;
  const fx = state.fx;
  const won = state.scene === 'won';
  const c = RESULT_CARD;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, (1 - a) * 70);
  glassPanel(ctx, c, 36);
  const tau = (id) => (fx.btn === id ? t - fx.btnAt : -1);
  if (won) {
    text(ctx, 'Cleared!', W / 2, c.y + 84, 66, '#6dffc9', 700);
    text(ctx, `Time ${formatTime(state.time)}s`, W / 2, c.y + 140, 34, LIGHT, 600);
    if (fx.newBest) drawPill(ctx, W / 2, c.y + 194, 'New best time!', { color: '#ffe08a', rim: 'rgba(255,224,138,0.6)', size: 24, h: 46 });
    else if (state.bestTime !== null) text(ctx, `Best ${formatTime(state.bestTime)}s`, W / 2, c.y + 200, 26, 'rgba(244,251,250,0.7)', 500);
    drawButton(ctx, AGAIN_BTN_WIDE, 'New board', { kind: 'primary', size: 38, icon: iconNew, pressTau: tau('again') });
  } else {
    text(ctx, 'Boom.', W / 2, c.y + 78, 62, '#ff8571', 700);
    wrapText(ctx, 'That mine was avoidable by logic - see the ringed tile.', W / 2, c.y + 130, 580, 36, 27, 'rgba(244,251,250,0.88)', 500);
    if (!state.shieldOffered) {
      drawButton(ctx, SHIELD_BTN, 'Undo', { kind: 'go', size: 36, icon: iconUndo, pressTau: tau('shield') });
      drawButton(ctx, AGAIN_BTN, 'New board', { kind: 'primary', size: 32, pressTau: tau('again') });
    } else drawButton(ctx, AGAIN_BTN_WIDE, 'New board', { kind: 'primary', size: 38, icon: iconNew, pressTau: tau('again') });
  }
  ctx.restore();

  if (won) {
    for (let k = 0; k < 18; k++) {
      const ph = (t * 0.3 + k * 0.131) % 1;
      const x = 360 + Math.sin(k * 2.4) * (190 + 110 * ph);
      const y = BOARD_Y + BOARD_H - ph * (BOARD_H + 60);
      ctx.fillStyle = `rgba(255,228,140,${0.85 * (1 - ph) * a})`;
      ctx.beginPath();
      ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU);
      ctx.fill();
    }
  }
}

function drawPlay(ctx, state, pal, extra) {
  const t = state.pulse;
  const fx = state.fx;
  const intro = easeOut(clamp01((t - fx.boardAt) / 0.4));
  text(ctx, 'Sure Sweep', W / 2 + 40, 162, 54, pal.ink, 700);

  ctx.save();
  if (state.runs <= 1 && state.scene === 'playing') {
    ctx.globalAlpha = intro;
    ctx.translate(0, (1 - intro) * -30);
  }
  drawHud(ctx, state, pal, extra);
  ctx.restore();

  drawBoard(ctx, state, pal);

  const over = state.scene === 'won' || state.scene === 'lost';
  const a = over ? easeOut(clamp01((t - fx.sceneAt - (state.scene === 'won' ? 0.7 : 0.35)) / 0.4)) : 0;
  if (a < 1) {
    ctx.save();
    ctx.globalAlpha = (1 - a) * (state.runs <= 1 && !over ? intro : 1);
    drawControls(ctx, state, pal);
    ctx.restore();
  }
  if (a > 0) drawResult(ctx, state, pal, a);
  if (state.demo && !over) text(ctx, `Free preview: ${extra.demoLeft} more board${extra.demoLeft === 1 ? '' : 's'}`, W / 2, 1476, 21, pal.inkFaint, 500);
}

export function draw(ctx, state, extra) {
  const pal = palette(state.theme);
  drawBackground(ctx, pal, state.pulse);
  if (state.scene === 'title') drawTitle(ctx, state, pal, extra);
  else if (state.scene === 'demo-limit') drawDemoLimit(ctx, state, pal);
  else drawPlay(ctx, state, pal, extra);
}
