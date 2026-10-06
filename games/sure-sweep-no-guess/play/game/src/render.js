// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// All motion is a function of state.pulse (the fixed-step clock) and the start times in state.fx.
import { V, POS, BOARD, FRAME, COLS, ROWS, HUD, MODE_SWITCH, HINT_BTN, COLOR_BTN, NEW_BTN, MENU_BTN, PAUSE_BTN, AUTO_EXIT_BTN, RESULT_CARD, SHIELD_BTN, RESULT_MENU_BTN, RESULT_MENU_BTN_WIDE, AGAIN_BTN, AGAIN_BTN_WIDE, PLAY_BTN, TITLE_COLOR_BTN, TITLE_RULES_BTN, TITLE_AUTO_BTN, HERO, RULES_PANEL, RULES_BACK_BTN, TEXT_DEC_BTN, TEXT_INC_BTN, SCROLLBAR, TEXT_SCALES, THINK_STEPS, SIBLINGS, host, chipRect, useLayout } from './layout.js';
import { drawLockup } from './brand.js';
import { palette, alpha, THEMES } from './themes.js';
import { RULES } from './content.js';

const FONT = '"Fredoka", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const LIGHT = '#f4fbfa';
// Nominal width of the Rules illustrations (they are drawn in a fixed 720-wide space and placed into the reader).
const W = 720;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (f) => 1 - (1 - f) ** 3;
const easeOutBack = (f) => 1 + 2.4 * (f - 1) ** 3 + 1.4 * (f - 1) ** 2;
// A press dips the button, then it springs back with a small overshoot.
const spring = (tau) => (tau < 0 || tau > 0.6 ? 0 : Math.exp(-tau * 9) * Math.cos(tau * 20));

// Text never renders below ~11 css px: host.px is css pixels per virtual unit (main.js keeps it current).
const minSize = () => 11.5 / Math.max(0.2, host.px);
const setFont = (ctx, size, weight = 700) => {
  ctx.font = `${weight} ${Math.max(size, minSize())}px ${FONT}`;
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
  const W = V.w;
  const H = V.h;
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
  for (let k = 0; k < Math.ceil(H / 160) + 1; k++) {
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
  for (let k = 0; k < Math.round(22 * Math.max(1, (W * H) / (720 * 1560))); k++) {
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
  ctx.quadraticCurveTo(cx + sway * 0.4, cy + 110, cx - 6, Math.max(V.h, cy + 160) + 10);
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

// The ONE cell Auto Play is actually about to act on, distinct from the plain green/red "sure
// move" rings drawn around it (drawRing above) - a bright white outer ring, same idiom used for
// chess-royal-sixty-four's own auto-play reveal highlight.
function drawChosenRing(ctx, x, y, s, t) {
  const pulse = 0.6 + 0.4 * Math.sin(t * 7);
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${0.85 + 0.15 * pulse})`;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2, s * 0.58, 0, TAU);
  ctx.stroke();
  ctx.restore();
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
  rr(ctx, x, y, r.w, r.h - lip, radius);
  ctx.fillStyle = k.bottom;   // flat face
  ctx.fill();
  ctx.strokeStyle = k.rim;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const cy = -lip / 2;
  // The label shrinks to fit the button (never below ~11 css px: see setFont).
  const fit = (str, sz, maxW, weight) => {
    let z = sz;
    setFont(ctx, z, weight);
    while (ctx.measureText(str).width > maxW && z > 12) {
      z -= 1;
      setFont(ctx, z, weight);
    }
    return z;
  };
  if (o.icon && o.stacked) {
    const size = fit(label, o.size ?? 30, r.w - 14, 600);
    o.icon(ctx, 0, cy - r.h * 0.15, Math.min(o.iconSize ?? 44, r.h * 0.44), k.ink);
    text(ctx, label, 0, cy + r.h * 0.33, size, k.ink, 600);
  } else if (o.icon) {
    let size = o.size ?? 30;
    const iconRoom = size * (o.iconScale ?? 1.15) + 14;
    size = fit(label, size, r.w - 24 - iconRoom, 700);
    setFont(ctx, size, 700);
    const tw = ctx.measureText(label).width;
    const iw = size * (o.iconScale ?? 1.15);
    const x0 = -(tw + iw + 14) / 2;
    o.icon(ctx, x0 + iw / 2, cy, iw, k.ink);
    text(ctx, label, x0 + iw + 14, cy + size * 0.35, size, k.ink, 700, 'left');
  } else {
    const size = fit(label, o.size ?? 30, r.w - 24, 700);
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
// A small reference page - three ruled lines on a rounded card - for the Rules button.
const iconRules = (ctx, cx, cy, s, ink) => {
  ctx.strokeStyle = ink;
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = 'round';
  rr(ctx, cx - s * 0.34, cy - s * 0.42, s * 0.68, s * 0.84, s * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.18, cy - s * 0.14);
  ctx.lineTo(cx + s * 0.18, cy - s * 0.14);
  ctx.moveTo(cx - s * 0.18, cy + s * 0.02);
  ctx.lineTo(cx + s * 0.18, cy + s * 0.02);
  ctx.moveTo(cx - s * 0.18, cy + s * 0.18);
  ctx.lineTo(cx + s * 0.04, cy + s * 0.18);
  ctx.stroke();
};

// ---- scenes ----------------------------------------------------------------------------------------
function drawLogo(ctx, pal, cx, y, size, t, intro, maxW = 640) {
  const f = easeOutBack(clamp01(intro / 0.6));
  ctx.save();
  ctx.translate(cx, y + Math.sin(t * 1.3) * 5 - (1 - f) * 70);
  ctx.globalAlpha *= clamp01(intro / 0.25);
  ctx.rotate(-0.035);
  setFont(ctx, size, 700);
  const tw = ctx.measureText('Sure Sweep').width;
  if (tw > maxW) ctx.scale(maxW / tw, maxW / tw);
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

function drawHero(ctx, pal, t, intro, geo = HERO) {
  const { n, cell } = geo;
  const size = n * cell;
  const f = easeOutBack(clamp01((intro - 0.15) / 0.6));
  if (f <= 0) return;
  ctx.save();
  ctx.translate(geo.x, geo.y + Math.sin(t * 0.9) * 6);
  ctx.rotate(-0.06 + Math.sin(t * 0.5) * 0.008);
  ctx.scale(f, f);
  const x0 = -size / 2;
  const y0 = -size / 2;
  drawFrame(ctx, pal, x0, y0, size, size, { frame: Math.round(10 + cell * 0.08) });
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
  const T = POS.title;
  const intro = 10; // the front door is complete on the very first frame; idle motion carries it
  drawCompass(ctx, pal, T.compass.x, T.compass.y, T.compass.r, t);
  drawBuoyMine(ctx, pal, T.buoy.x, T.buoy.y, t);
  drawLogo(ctx, pal, T.logo.x, T.logo.y, T.logo.size, t, intro, T.logo.maxW ?? 640);
  const a = clamp01((intro - 0.3) / 0.4);
  ctx.save();
  ctx.globalAlpha = a;
  text(ctx, 'No-guess minesweeper', T.tag1.x, T.tag1.y, T.tag1.size, pal.ink, 600);
  text(ctx, 'Every board solves by logic alone.', T.tag2.x, T.tag2.y, T.tag2.size, pal.inkSoft, 500);
  ctx.restore();

  drawHero(ctx, pal, t, intro);

  const b = easeOut(clamp01((intro - 0.45) / 0.45));
  ctx.save();
  ctx.globalAlpha = b;
  ctx.translate(0, (1 - b) * 50);
  drawButton(ctx, PLAY_BTN, 'Play', { kind: 'primary', size: 58, icon: iconPlay, breathe: Math.sin(t * 2.4) * 0.012, pressTau: fx.btn === 'play' ? t - fx.btnAt : -1 });
  const rowIcon = Math.min(40, TITLE_COLOR_BTN.h * 0.42);
  drawButton(ctx, TITLE_COLOR_BTN, 'Colours', { pal, icon: iconSwatches(pal), iconSize: rowIcon, stacked: true, size: 22, pressTau: fx.btn === 'colors' ? t - fx.btnAt : -1 });
  drawButton(ctx, TITLE_RULES_BTN, 'Rules', { pal, icon: iconRules, iconSize: rowIcon, stacked: true, size: 22, pressTau: fx.btn === 'rules' ? t - fx.btnAt : -1 });
  drawButton(ctx, TITLE_AUTO_BTN, 'Auto Play', { pal, icon: iconBulb, iconSize: rowIcon, stacked: true, size: 20, pressTau: fx.btn === 'autoplay' ? t - fx.btnAt : -1 });
  if (state.bestTime !== null) drawPill(ctx, T.best.x, T.best.y, `Best time  ${formatTime(state.bestTime)}s`, { color: '#ffe08a', rim: 'rgba(255,224,138,0.5)', size: T.best.size });
  else drawPill(ctx, T.best.x, T.best.y, 'No best time yet - set one', { size: T.best.size - 4, color: 'rgba(244,251,250,0.8)' });
  if (state.demo && T.demo) drawPill(ctx, T.demo.x, T.demo.y, `Free preview: ${extra.demoLeft} board${extra.demoLeft === 1 ? '' : 's'} left`, { size: T.demo.size, h: T.demo.h });
  ctx.restore();
  // the Arcforge lockup: small and quiet, never over the buttons or the game art
  if (T.lockup) {
    const lw = T.lockup.w, lh = (lw * 327) / 1200;
    ctx.save(); ctx.fillStyle = 'rgba(4,36,40,0.45)'; ctx.beginPath(); ctx.roundRect(T.lockup.x - lw / 2 - 10, T.lockup.y - lh / 2 - 5, lw + 20, lh + 10, 14); ctx.fill(); ctx.restore();
    drawLockup(ctx, T.lockup.x, T.lockup.y, lw, lockPress > 0 ? 0.5 : 0.95);
    if (lockPress > 0) lockPress--;
  }
}

function drawDemoLimit(ctx, state, pal) {
  const t = state.pulse;
  const T = POS.title;
  drawCompass(ctx, pal, T.compass.x, T.compass.y, T.compass.r, t);
  const cw = Math.min(640, V.w - 80);
  const card = { x: (V.w - cw) / 2, y: Math.min(T.logo.y + 130, V.h - 380), w: cw, h: 360 };
  drawLogo(ctx, pal, V.w / 2, T.logo.y, T.logo.size, t, 10, cw);
  glassPanel(ctx, card, 34);
  text(ctx, "That's the free preview!", V.w / 2, card.y + 90, 44, '#ffe08a', 700);
  wrapText(ctx, 'Get the full game on iPhone and Android for unlimited boards, hints and no interruptions.', V.w / 2, card.y + 165, cw - 100, 42, 29, LIGHT, 500);
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

function drawHud(ctx, state, pal, extra, rect = HUD, mode = POS.hudMode) {
  glassPanel(ctx, rect, 30);
  const { x, y, w, h } = rect;
  const mid = y + h / 2;
  const left = String(state.scene === 'won' ? 0 : Math.max(extra.remainingFlags, 0)).padStart(2, '0');
  let opened = 0;
  let safe = 0;
  for (let i = 0; i < state.numbers.length; i++) {
    if (state.numbers[i] === -1) continue;
    safe++;
    if (state.revealed[i]) opened++;
  }
  const frac = safe ? opened / safe : 0;
  const pct = `${Math.round(frac * 100)}%`;
  const LAB = 'rgba(244,251,250,0.6)';
  if (mode === 'stack') {
    // narrow side panel: mines (left) and time (right) on one row, a progress bar below
    const top = y + 8;
    const ic = 58;
    drawCell(ctx, pal, x + 14, top + 6, ic);
    drawMine(ctx, x + 14 + ic / 2, top + 6 + ic / 2 - 1, ic);
    text(ctx, 'MINES', x + 14 + ic + 8, top + 26, 19, LAB, 600, 'left');
    text(ctx, left, x + 14 + ic + 6, top + 72, 46, LIGHT, 700, 'left');
    text(ctx, 'TIME', x + w - 16, top + 26, 19, LAB, 600, 'right');
    setFont(ctx, 24, 600);
    const sw = ctx.measureText('s').width;
    text(ctx, 's', x + w - 16, top + 72, 24, 'rgba(244,251,250,0.7)', 600, 'right');
    text(ctx, formatTime(state.time), x + w - 20 - sw, top + 72, 46, LIGHT, 700, 'right');
    const by = y + h - 30;
    rr(ctx, x + 18, by, w - 36 - 56, 14, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    rr(ctx, x + 18, by, Math.max(14, (w - 36 - 56) * frac), 14, 7);
    ctx.fillStyle = state.scene === 'lost' ? '#ff7a66' : '#4dffc3';
    ctx.fill();
    text(ctx, pct, x + w - 18, by + 13, 24, LIGHT, 700, 'right');
    return;
  }
  const k = h / 124;
  // mines left
  drawCell(ctx, pal, x + 22, mid - 40 * k, 80 * k);
  drawMine(ctx, x + 22 + 40 * k, mid - 2 * k, 80 * k);
  text(ctx, 'MINES', x + 22 + 100 * k, y + 40 * k, 19, LAB, 600, 'left');
  text(ctx, left, x + 20 + 100 * k, y + 98 * k, 58 * k, LIGHT, 700, 'left');
  // progress ring
  const cx = x + w / 2;
  const rad = 42 * k;
  ctx.lineWidth = 10 * k;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(cx, mid, rad, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = state.scene === 'lost' ? '#ff7a66' : '#4dffc3';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, mid, rad, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(frac, 0.001));
  ctx.stroke();
  ctx.lineCap = 'butt';
  text(ctx, pct, cx, mid + 9 * k, 26 * k, LIGHT, 700);
  // timer
  text(ctx, 'TIME', x + w - 30, y + 40 * k, 19, LAB, 600, 'right');
  setFont(ctx, 30 * k, 600);
  const sw = ctx.measureText('s').width;
  text(ctx, 's', x + w - 30, y + 98 * k, 30 * k, 'rgba(244,251,250,0.7)', 600, 'right');
  text(ctx, formatTime(state.time), x + w - 34 - sw, y + 98 * k, 58 * k, LIGHT, 700, 'right');
}

function drawBoard(ctx, state, pal) {
  const t = state.pulse;
  const fx = state.fx;
  const lost = state.scene === 'lost';
  const won = state.scene === 'won';
  const since = t - fx.sceneAt;
  const flagGlow = state.scene === 'playing' && state.flagMode ? alpha('#ff6b5e', 0.65 + 0.3 * Math.sin(t * 5)) : undefined;

  const CELL = BOARD.cell;
  const BOARD_X = BOARD.x;
  const BOARD_Y = BOARD.y;
  const BOARD_W = BOARD.size;
  const BOARD_H = BOARD.size;
  const u = CELL / 74;
  ctx.save();
  drawFrame(ctx, pal, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, { glow: flagGlow, frame: FRAME });

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
      if (p < 1) drawTile(ctx, pal, x, y, CELL, { scale: 1 - easeOut(p) * 0.55, alpha: 1 - p, lift: p * 16 * u });
    } else {
      // on a final loss the remaining mines surface one by one, outward from the blast
      const q = fullReveal && num === -1 && !state.flagged[i] ? clamp01((since - 0.35 - Math.hypot(c - ex, r - ey) * 0.07) / 0.3) : 0;
      if (q > 0) {
        drawCell(ctx, pal, x, y, CELL, { alpha: Math.min(1, q * 3) });
        drawMine(ctx, cx, cy, CELL, easeOutBack(q));
        if (q < 1) drawTile(ctx, pal, x, y, CELL, { scale: 1 - easeOut(q) * 0.55, alpha: 1 - q, lift: q * 16 * u });
      } else {
        const wave = won ? Math.sin(Math.PI * clamp01((since - ((r + c) / 16) * 0.7) / 0.4)) : 0;
        drawTile(ctx, pal, x, y, CELL, { scale: tileScale, lift: wave * 8 * u });
        if (state.flagged[i]) {
          drawFlag(ctx, cx, cy - wave * 8 * u, CELL, { t, drop: fx.flagAt[i] < 0 ? 1 : (t - fx.flagAt[i]) / 0.3, gold: won });
          if (fullReveal && num !== -1 && since > 0.6) {
            ctx.strokeStyle = '#ff3b30';
            ctx.lineWidth = 7 * u;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x + 16 * u, y + 16 * u);
            ctx.lineTo(x + CELL - 16 * u, y + CELL - 16 * u);
            ctx.moveTo(x + CELL - 16 * u, y + 16 * u);
            ctx.lineTo(x + 16 * u, y + CELL - 16 * u);
            ctx.stroke();
          }
        } else if (won) {
          // every tile still closed at a win is a mine: they flag themselves as the sweep passes
          const d = (since - ((r + c) / 16) * 0.7 - 0.15) / 0.3;
          if (d > 0) drawFlag(ctx, cx, cy - wave * 8 * u, CELL, { t, drop: d, gold: true });
        }
      }
    }

    if (won) {
      const lt = clamp01((since - ((r + c) / 16) * 0.7) / 0.4);
      if (lt > 0 && lt < 1) {
        rr(ctx, x + 1.5, y + 1.5, CELL - 3, CELL - 3, 8 * u);
        ctx.fillStyle = `rgba(255,255,255,${0.5 * Math.sin(Math.PI * lt)})`;
        ctx.fill();
      }
    }

    // Auto Play's REVEAL phase: every cell the current logical pass can determine (the same
    // findForcedMoves() the Hint button already calls) glows with this same "sure move" ring -
    // safe cells green, mines red - and the one actually about to be acted on gets an extra bright
    // white ring on top, so the viewer can compare their own guess against the real move.
    const autoMove = state.auto && state.autoPhase === 'reveal' ? state.autoForced.find((m) => m.index === i) : null;
    const hinted = (state.hint && state.hint.index === i && state.hint.kind) || (lost && state.lossHint && state.lossHint.index === i && state.lossHint.kind) || (autoMove && autoMove.kind);
    if (hinted) drawRing(ctx, x, y, CELL, hinted, t);
    if (autoMove && state.autoChosen && state.autoChosen.index === i) drawChosenRing(ctx, x, y, CELL, t);
  }

  if (lost && state.exploded >= 0 && since < 0.7) {
    const f = since / 0.7;
    ctx.save();
    rr(ctx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 10);
    ctx.clip();
    ctx.strokeStyle = `rgba(255,140,110,${0.7 * (1 - f)})`;
    ctx.lineWidth = (14 * (1 - f) + 2) * u;
    ctx.beginPath();
    ctx.arc(BOARD_X + ex * CELL + CELL / 2, BOARD_Y + ey * CELL + CELL / 2, (24 + easeOut(f) * 380) * u, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawModeSwitch(ctx, state, pal, r = MODE_SWITCH) {
  const t = state.pulse;
  const fx = state.fx;
  const rad = Math.min(34, r.h * 0.34);
  const trad = Math.min(28, r.h * 0.28);
  rr(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.fillStyle = 'rgba(3,14,20,0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();
  rr(ctx, r.x + 3, r.y + 3, r.w - 6, 12, [rad - 4, rad - 4, 0, 0]);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  const f = fx.modeAt < 0 ? 1 : easeOutBack(clamp01((t - fx.modeAt) / 0.24));
  const pos = state.flagMode ? f : 1 - f;
  const tw = r.w / 2 - 10;
  const tx = r.x + 8 + pos * (r.w / 2 - 6);
  const thumb = { x: tx, y: r.y + 8, w: tw, h: r.h - 16 };
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, thumb.x + 2, thumb.y + 6, thumb.w - 4, thumb.h, trad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, thumb.y, 0, thumb.y + thumb.h);
  if (state.flagMode) {
    g.addColorStop(0, '#ff8571');
    g.addColorStop(1, '#d4332f');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#cfeee9');
  }
  rr(ctx, thumb.x, thumb.y, thumb.w, thumb.h, trad);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const cy = r.y + r.h / 2;
  const leftInk = state.flagMode ? 'rgba(244,251,250,0.78)' : '#0b3a40';
  const rightInk = state.flagMode ? '#ffffff' : 'rgba(244,251,250,0.78)';
  const half = r.w / 2;
  const iconS = Math.min(50, r.h * 0.56);
  let size = Math.min(40, r.h * 0.4);
  setFont(ctx, size, 700);
  while (size > 14 && Math.max(ctx.measureText('Reveal').width, ctx.measureText('Flag').width) + iconS + 22 > half - 12) {
    size -= 1;
    setFont(ctx, size, 700);
  }
  const group = (label, cx0) => {
    setFont(ctx, size, 700);
    const w = ctx.measureText(label).width + iconS + 10;
    return { x0: cx0 - w / 2, w };
  };
  const lg = group('Reveal', r.x + half / 2);
  iconMiniCell(pal)(ctx, lg.x0 + iconS / 2, cy, iconS);
  text(ctx, 'Reveal', lg.x0 + iconS + 10, cy + size * 0.35, size, leftInk, 700, 'left');
  const rg = group('Flag', r.x + half * 1.5);
  drawFlag(ctx, rg.x0 + iconS / 2, cy + 2, iconS * 1.3, { t });
  text(ctx, 'Flag', rg.x0 + iconS + 10, cy + size * 0.35, size, rightInk, 700, 'left');
}

const iconMenu = (ctx, cx, cy, s, ink) => {
  ctx.strokeStyle = ink;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  for (const dy of [-0.26, 0, 0.26]) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.34, cy + s * dy);
    ctx.lineTo(cx + s * 0.34, cy + s * dy);
    ctx.stroke();
  }
};

// Wraps `str` to fit a box, shrinking the font a little if the lines would not fit its height.
function fitWrap(ctx, str, box, size, color, weight = 500) {
  for (let z = size; z >= 14; z -= 1) {
    setFont(ctx, z, weight);
    const lines = wrapRulesParagraph(ctx, str, box.w);
    const lh = Math.round(z * 1.28);
    if (lines.length * lh <= box.h + z * 0.4 || z <= 15) {
      lines.forEach((ln, i) => text(ctx, ln, box.x + box.w / 2, box.y + z * 0.85 + i * lh, z, color, weight));
      return;
    }
  }
}

function drawTip(ctx, str, color) {
  const p = POS.tip;
  if (p.wrap) fitWrap(ctx, str, { x: p.x - p.maxW / 2, y: p.y - 22, w: p.maxW, h: 56 }, p.size, color, 500);
  else text(ctx, str, p.x, p.y, p.size, color, 500);
}

function drawControls(ctx, state, pal) {
  const t = state.pulse;
  const fx = state.fx;
  let tip = 'Tap a tile to open it. Tap a number to clear around it.';
  if (state.hint) tip = state.hint.kind === 'mine' ? 'Sure move: the ringed tile is a mine - flag it.' : 'Sure move: the ringed tile is safe to open.';
  else if (state.flagMode) tip = 'Flag mode: tap a tile to plant or lift a flag.';
  drawTip(ctx, tip, state.hint ? pal.ink : pal.inkSoft);

  drawModeSwitch(ctx, state, pal);
  const tau = (id) => (fx.btn === id ? t - fx.btnAt : -1);
  const ic = Math.min(62, HINT_BTN.h * 0.5);
  drawButton(ctx, HINT_BTN, 'Hint', { pal, icon: iconBulb, iconSize: ic, stacked: true, size: 26, pressTau: tau('hint') });
  drawButton(ctx, COLOR_BTN, 'Colours', { pal, icon: iconSwatches(pal), iconSize: ic, stacked: true, size: 26, pressTau: tau('colors') });
  drawButton(ctx, NEW_BTN, 'New board', { pal, icon: iconNew, iconSize: ic, stacked: true, size: 26, pressTau: tau('new') });
  drawButton(ctx, MENU_BTN, 'Menu', { pal, icon: iconMenu, iconSize: ic, stacked: true, size: 26, pressTau: tau('menu') });

  if (POS.caption) {
    const best = state.bestTime !== null ? `Best ${formatTime(state.bestTime)}s   ·   ` : '';
    text(ctx, `${best}Colours: ${pal.name}`, POS.caption.x, POS.caption.y, POS.caption.size, pal.inkSoft, 500);
  }
}

// Auto Play's own control row - replaces the Reveal/Flag switch (meaningless when nobody is
// tapping) with "Exit to menu" and "Pause" side by side, and the Hint/Colours/New-board row with a
// think-time stepper either side of the same Colours button (harmless, still lets the viewer cycle themes).
function drawAutoControls(ctx, state, pal) {
  const t = state.pulse;
  const fx = state.fx;
  const secs = THINK_STEPS[state.autoThinkIdx];
  const tip = state.autoPaused
    ? 'Paused. Tap Resume to carry on.'
    : state.autoPhase === 'reveal'
      ? 'This is the move - compare it with your own guess.'
      : state.autoPhase === 'think'
        ? `Thinking… work out your own answer first. (${Math.max(0, Math.ceil(state.autoTimer))}s)`
        : 'Auto Play: the computer solves this board by logic alone, one sure move at a time.';
  drawTip(ctx, tip, pal.ink);

  const tau = (id) => (fx.btn === id ? t - fx.btnAt : -1);
  drawButton(ctx, AUTO_EXIT_BTN, 'Exit', { pal, size: 32, pressTau: tau('autoExit') });
  drawButton(ctx, PAUSE_BTN, state.autoPaused ? 'Resume' : 'Pause', { kind: state.autoPaused ? 'go' : undefined, pal, size: 32, pressTau: tau('autoPause') });

  ctx.save();
  ctx.globalAlpha = state.autoThinkIdx <= 0 ? 0.4 : 1;
  drawButton(ctx, HINT_BTN, '− Think', { pal, size: 26, pressTau: tau('autoDec') });
  ctx.restore();
  drawButton(ctx, COLOR_BTN, 'Colours', { pal, icon: iconSwatches(pal), iconSize: Math.min(62, COLOR_BTN.h * 0.5), stacked: true, size: 26, pressTau: tau('colors') });
  ctx.save();
  ctx.globalAlpha = state.autoThinkIdx >= THINK_STEPS.length - 1 ? 0.4 : 1;
  drawButton(ctx, NEW_BTN, 'Think +', { pal, size: 26, pressTau: tau('autoInc') });
  ctx.restore();
  // the fourth slot only shows the current think time (not a button)
  const m = MENU_BTN;
  rr(ctx, m.x, m.y, m.w, m.h - 9, Math.min(30, m.h * 0.3));
  ctx.fillStyle = 'rgba(3,14,20,0.55)';
  ctx.fill();
  text(ctx, 'THINK TIME', m.x + m.w / 2, m.y + m.h * 0.34, 19, 'rgba(244,251,250,0.6)', 600);
  text(ctx, `${secs}s`, m.x + m.w / 2, m.y + m.h * 0.7, Math.min(40, m.h * 0.42), LIGHT, 700);

  if (POS.caption) text(ctx, `Think time: ${secs}s   ·   Colours: ${pal.name}`, POS.caption.x, POS.caption.y, POS.caption.size, pal.inkSoft, 500);
}

// Shrinks a chip's label to whatever size actually fits its chip rather than trusting a fixed size -
// "Tiger and Goat" is noticeably longer than "Go" or "Carrom".
function chipTextSize(ctx, label, maxWidth) {
  for (const size of [22, 20, 18, 16, 14]) {
    setFont(ctx, size, 700);
    if (ctx.measureText(label).width <= maxWidth) return size;
  }
  return 14;
}

function drawResult(ctx, state, pal, a) {
  const t = state.pulse;
  const fx = state.fx;
  const won = state.scene === 'won';
  const c = RESULT_CARD;
  const k = POS.resultK ?? 1;
  const head = POS.head;
  const tb = POS.text;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, (1 - a) * 70);
  glassPanel(ctx, c, 36);
  const tau = (id) => (fx.btn === id ? t - fx.btnAt : -1);
  const dim = 'rgba(244,251,250,0.88)';
  if (state.auto) {
    // Auto Play's own end-of-board card: same shape and place as a real result, but "Play again" starts another auto board and
    // there is always an explicit way out. Cross-promo chips belong here too: a viewer who just watched Auto Play is in the
    // same "what's next" moment a real player is - see SIBLINGS in layout.js.
    if (won) {
      text(ctx, 'Solved!', head.x, head.y, head.size, '#6dffc9', 700);
      fitWrap(ctx, `Every safe tile found by logic alone, in ${formatTime(state.time)}s`, tb, 26, dim);
    } else {
      text(ctx, 'Boom.', head.x, head.y, head.size, '#ff8571', 700);
      fitWrap(ctx, 'This rare fallback board could not be fully proven by logic - a real board never does this.', tb, POS.explainSize, dim);
    }
    drawButton(ctx, RESULT_MENU_BTN_WIDE, 'Exit to menu', { pal, size: 30, pressTau: tau('autoExit') });
    drawButton(ctx, AGAIN_BTN_WIDE, 'Play again', { kind: 'primary', size: 30, icon: iconNew, pressTau: tau('again') });
  } else if (won) {
    text(ctx, 'Cleared!', head.x, head.y, head.size, '#6dffc9', 700);
    const y1 = tb.y + 30 * k;
    text(ctx, `Time ${formatTime(state.time)}s`, head.x, y1, 34 * k, LIGHT, 600);
    if (fx.newBest) drawPill(ctx, head.x, y1 + 44 * k, 'New best time!', { color: '#ffe08a', rim: 'rgba(255,224,138,0.6)', size: 24 * k, h: 46 * k });
    else if (state.bestTime !== null) text(ctx, `Best ${formatTime(state.bestTime)}s`, head.x, y1 + 44 * k, 26 * k, 'rgba(244,251,250,0.7)', 500);
    drawButton(ctx, RESULT_MENU_BTN_WIDE, 'Menu', { pal, size: 32, pressTau: tau('menu') });
    drawButton(ctx, AGAIN_BTN_WIDE, 'New board', { kind: 'primary', size: 32, pressTau: tau('again') });
  } else {
    text(ctx, 'Boom.', head.x, head.y, head.size, '#ff8571', 700);
    fitWrap(ctx, 'That mine was avoidable by logic - see the ringed tile.', tb, POS.explainSize, dim);
    if (!state.shieldOffered) {
      drawButton(ctx, RESULT_MENU_BTN, 'Menu', { pal, size: 28, pressTau: tau('menu') });
      drawButton(ctx, SHIELD_BTN, 'Undo', { kind: 'go', size: 28, icon: iconUndo, pressTau: tau('shield') });
      drawButton(ctx, AGAIN_BTN, 'New board', { kind: 'primary', size: 28, pressTau: tau('again') });
    } else {
      drawButton(ctx, RESULT_MENU_BTN_WIDE, 'Menu', { pal, size: 32, pressTau: tau('menu') });
      drawButton(ctx, AGAIN_BTN_WIDE, 'New board', { kind: 'primary', size: 32, pressTau: tau('again') });
    }
  }
  // "More from Arcforge": a free game's one natural advertising moment. Paid games only - see SIBLINGS in layout.js.
  if (POS.chipLabelY !== null) text(ctx, 'More from Arcforge', POS.chipLabelX, POS.chipLabelY, 19, 'rgba(244,251,250,0.65)', 600);
  SIBLINGS.forEach((g, i) => {
    const r = chipRect(i);
    drawButton(ctx, r, g.title, { pal, size: chipTextSize(ctx, g.title, r.w - 18), pressTau: tau(`chip${i}`) });
  });
  ctx.restore();

  if (won) {
    for (let q = 0; q < 18; q++) {
      const ph = (t * 0.3 + q * 0.131) % 1;
      const x = POS.confetti.x + Math.sin(q * 2.4) * (POS.confetti.spread + 110 * ph);
      const y = BOARD.y + BOARD.size - ph * (BOARD.size + 60);
      ctx.fillStyle = `rgba(255,228,140,${0.85 * (1 - ph) * a})`;
      ctx.beginPath();
      ctx.arc(x, y, 4 + (q % 3) * 2, 0, TAU);
      ctx.fill();
    }
  }
}

function drawPlay(ctx, state, pal, extra) {
  const t = state.pulse;
  const fx = state.fx;
  const intro = easeOut(clamp01((t - fx.boardAt) / 0.4));
  if (POS.playTitle) text(ctx, 'Sure Sweep', POS.playTitle.x, POS.playTitle.y, POS.playTitle.size, pal.ink, 700);

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
    if (state.auto) drawAutoControls(ctx, state, pal);
    else drawControls(ctx, state, pal);
    ctx.restore();
  }
  if (a > 0) drawResult(ctx, state, pal, a);
  // Auto Play boards never count against the free-preview limit, so this line would be misleading while watching one.
  if (state.demo && !over && !state.auto && POS.demo) text(ctx, `Free preview: ${extra.demoLeft} more board${extra.demoLeft === 1 ? '' : 's'}`, POS.demo.x, POS.demo.y, POS.demo.size, pal.inkFaint, 500);
}

// ---- Rules reference page ----------------------------------------------------------------------
// Every illustration below reuses this file's own drawing functions - the exact tile/number/flag/mine/HUD/switch/button art the
// player sees in a real run - never a separate simplified icon set. The whole page is one scrolling reader.
// Greedy word wrap for the Rules reader. A single word wider than the column (at 300% text) is broken after a hyphen,
// else by characters, so nothing ever runs outside its panel.
export function wrapRulesParagraph(ctx, str, maxW) {
  const lines = [];
  let line = '';
  const put = (tok) => {
    const test = line ? `${line} ${tok}` : tok;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = tok; } else line = test;
  };
  for (const w of str.split(' ')) {
    if (ctx.measureText(w).width <= maxW) { put(w); continue; }
    let rest = w;
    while (ctx.measureText(rest).width > maxW) {
      let cut = 1;
      while (cut < rest.length && ctx.measureText(rest.slice(0, cut + 1)).width <= maxW) cut++;
      const h = rest.slice(0, cut).lastIndexOf('-');
      if (h >= 1) cut = h + 1;
      put(rest.slice(0, cut)); rest = rest.slice(cut);
      lines.push(line); line = '';
    }
    put(rest);
  }
  if (line) lines.push(line);
  return lines;
}

// Canvas fillText never honours embedded newlines - split and stack lines by hand.
function multilineText(ctx, str, cx, y, size, color, weight, lineHeight = size * 1.25) {
  str.split('\n').forEach((ln, i) => text(ctx, ln, cx, y + i * lineHeight, size, color, weight));
}

function drawMiniGrid(ctx, pal, cx, cy, cell, cells, t) {
  const n = 3;
  const size = n * cell;
  const x0 = cx - size / 2;
  const y0 = cy - size / 2;
  drawFrame(ctx, pal, x0, y0, size, size, { frame: 12 });
  for (let i = 0; i < n * n; i++) {
    const c = i % n;
    const r = Math.floor(i / n);
    const x = x0 + c * cell;
    const y = y0 + r * cell;
    const spec = cells[i] || { kind: 'hidden' };
    if (spec.kind === 'open') {
      drawCell(ctx, pal, x, y, cell);
      if (spec.n > 0) drawNumber(ctx, pal, spec.n, x + cell / 2, y + cell / 2, cell);
    } else if (spec.kind === 'flag') {
      drawTile(ctx, pal, x, y, cell);
      drawFlag(ctx, x + cell / 2, y + cell / 2, cell, { t });
    } else {
      drawTile(ctx, pal, x, y, cell);
      if (spec.ring) drawRing(ctx, x, y, cell, spec.ring, t);
    }
  }
}

function drawRulesArt(ctx, name, pal, t) {
  if (!name) return;
  if (name === 'hero') {
    drawHero(ctx, pal, t, 10, { x: 360, y: 700, cell: 100, n: 5 });
  } else if (name === 'cells') {
    const items = [
      { label: 'Hidden', draw: (x, y, s) => drawTile(ctx, pal, x, y, s) },
      { label: 'Open -\nblank', draw: (x, y, s) => drawCell(ctx, pal, x, y, s) },
      {
        label: 'Open -\nnumber',
        draw: (x, y, s) => {
          drawCell(ctx, pal, x, y, s);
          drawNumber(ctx, pal, 3, x + s / 2, y + s / 2, s);
        },
      },
      {
        label: 'Flagged',
        draw: (x, y, s) => {
          drawTile(ctx, pal, x, y, s);
          drawFlag(ctx, x + s / 2, y + s / 2, s, { t });
        },
      },
      {
        label: 'A mine\n(run over)',
        draw: (x, y, s) => {
          drawCell(ctx, pal, x, y, s, { danger: true });
          drawMine(ctx, x + s / 2, y + s / 2, s);
        },
      },
    ];
    const s = 110;
    const gap = 20;
    const totalW = items.length * s + (items.length - 1) * gap;
    let x = W / 2 - totalW / 2;
    const y = 420;
    for (const it of items) {
      it.draw(x, y, s);
      multilineText(ctx, it.label, x + s / 2, y + s + 34, 19, pal.inkSoft, 600, 24);
      x += s + gap;
    }
  } else if (name === 'neighbours') {
    drawMiniGrid(
      ctx,
      pal,
      W / 2,
      560,
      118,
      [
        { kind: 'hidden', ring: 'mine' },
        { kind: 'hidden', ring: 'mine' },
        { kind: 'hidden' },
        { kind: 'hidden' },
        { kind: 'open', n: 3 },
        { kind: 'hidden' },
        { kind: 'hidden' },
        { kind: 'hidden' },
        { kind: 'hidden', ring: 'mine' },
      ],
      t,
    );
    text(ctx, 'The centre tile counts 3 mines among its 8 neighbours', W / 2, 780, 22, pal.inkSoft, 600);
  } else if (name === 'flood') {
    const cell = 96;
    const grid = [0, 0, 1, -2, 0, 0, 1, -2, 1, 1, 2, -2, -2, -2, -2, -2];
    const n = 4;
    const size = n * cell;
    const x0 = W / 2 - size / 2;
    const y0 = 360;
    drawFrame(ctx, pal, x0, y0, size, size, { frame: 12 });
    for (let i = 0; i < grid.length; i++) {
      const c = i % n;
      const r = Math.floor(i / n);
      const x = x0 + c * cell;
      const y = y0 + r * cell;
      const v = grid[i];
      if (v === -2) drawTile(ctx, pal, x, y, cell);
      else {
        drawCell(ctx, pal, x, y, cell);
        if (v > 0) drawNumber(ctx, pal, v, x + cell / 2, y + cell / 2, cell);
      }
    }
    text(ctx, 'One tap on a blank tile opened this whole corner', W / 2, y0 + size + 40, 22, pal.inkSoft, 600);
  } else if (name === 'flags') {
    const fakeState = { pulse: t, flagMode: Math.floor(t / 2) % 2 === 1, fx: { modeAt: -1 } };
    drawModeSwitch(ctx, fakeState, pal, { x: 27, y: 460, w: 666, h: 116 });
  } else if (name === 'chord') {
    drawMiniGrid(
      ctx,
      pal,
      W / 2,
      560,
      118,
      [
        { kind: 'hidden', ring: 'safe' },
        { kind: 'flag' },
        { kind: 'hidden', ring: 'safe' },
        { kind: 'flag' },
        { kind: 'open', n: 2 },
        { kind: 'hidden', ring: 'safe' },
        { kind: 'hidden', ring: 'safe' },
        { kind: 'hidden', ring: 'safe' },
        { kind: 'hidden', ring: 'safe' },
      ],
      t,
    );
    text(ctx, 'Its 2 flags satisfy the "2" - chording opens the rest at once', W / 2, 780, 22, pal.inkSoft, 600);
  } else if (name === 'hud') {
    const total = 30;
    const numbers = new Array(total).fill(1);
    const revealed = new Array(total).fill(false);
    for (let i = 0; i < 18; i++) revealed[i] = true;
    numbers[3] = -1;
    numbers[9] = -1;
    drawHud(ctx, { scene: 'playing', numbers, revealed, time: 47.3 }, pal, { remainingFlags: 8 }, { x: 27, y: 460, w: 666, h: 124 }, 'row');
  } else if (name === 'winlose') {
    const s = 150;
    const gapX = 140;
    const y = 480;
    const lx = W / 2 - gapX / 2 - s;
    drawCell(ctx, pal, lx, y, s);
    drawNumber(ctx, pal, 2, lx + s / 2, y + s / 2, s);
    multilineText(ctx, 'Every non-mine tile open\n= Cleared!', lx + s / 2, y + s + 42, 21, pal.inkSoft, 600);
    const rx = W / 2 + gapX / 2;
    drawCell(ctx, pal, rx, y, s, { danger: true });
    drawMine(ctx, rx + s / 2, y + s / 2, s);
    multilineText(ctx, 'Any mine revealed\n= Boom.', rx + s / 2, y + s + 42, 21, pal.inkSoft, 600);
  } else if (name === 'losshint') {
    const s = 150;
    const gapX = 140;
    const y = 480;
    const lx = W / 2 - gapX / 2 - s;
    drawTile(ctx, pal, lx, y, s);
    drawRing(ctx, lx, y, s, 'safe', t);
    multilineText(ctx, 'Ringed green =\nhad to be safe', lx + s / 2, y + s + 42, 21, pal.inkSoft, 600);
    const rx = W / 2 + gapX / 2;
    drawTile(ctx, pal, rx, y, s);
    drawRing(ctx, rx, y, s, 'mine', t);
    multilineText(ctx, 'Ringed red =\nhad to be a mine', rx + s / 2, y + s + 42, 21, pal.inkSoft, 600);
  } else if (name === 'hintundo') {
    const hintR = { x: W / 2 - 300, y: 500, w: 260, h: 130 };
    const undoR = { x: W / 2 + 40, y: 500, w: 260, h: 130 };
    drawButton(ctx, hintR, 'Hint', { pal, icon: iconBulb, stacked: true, size: 30 });
    drawButton(ctx, undoR, 'Undo', { kind: 'go', size: 34, icon: iconUndo, stacked: true });
  } else if (name === 'colours') {
    const names = [0, 2, 3];
    const s = 150;
    const gap = 30;
    const totalW = names.length * s + (names.length - 1) * gap;
    let x = W / 2 - totalW / 2;
    const y = 380;
    for (const idx of names) {
      const p = palette(idx);
      drawCell(ctx, p, x, y, s);
      drawNumber(ctx, p, 3, x + s / 2, y + s / 2, s);
      text(ctx, THEMES[idx].name, x + s / 2, y + s + 34, 19, pal.inkSoft, 600);
      x += s + gap;
    }
    text(ctx, `${THEMES.length} colour schemes in total - purely cosmetic`, W / 2, y + s + 84, 22, pal.inkSoft, 600);
  }
}

// Nominal vertical extent of each illustration (they are drawn in a fixed 720-wide space), used to place it in the reader.
const ART_BOX = {
  hero: { top: 430, h: 560 },
  cells: { top: 400, h: 230 },
  neighbours: { top: 360, h: 450 },
  flood: { top: 340, h: 470 },
  flags: { top: 440, h: 150 },
  chord: { top: 360, h: 450 },
  hud: { top: 440, h: 160 },
  winlose: { top: 460, h: 290 },
  losshint: { top: 460, h: 290 },
  hintundo: { top: 480, h: 170 },
  colours: { top: 360, h: 290 },
};

// Scroll state shared with game.js (it clamps the scroll offset and handles drag / wheel / keys).
export const readerView = { contentH: 0, viewH: 0, max: 0 };
let readerCache = null;

// The whole Rules text as ONE scrolling document: a major section starts at each illustrated entry, the short entries that
// follow it become sub-headed paragraphs. Laid out once per (text size, column width, scene entry) and cached.
function readerLayout(ctx, scale, colW, stamp) {
  const key = `${scale}|${Math.round(colW)}|${stamp}`;
  if (readerCache && readerCache.key === key) return readerCache;
  const items = [];
  const bodySize = Math.round(28 * scale);
  const textW = colW - 24;
  let y = 16;
  RULES.forEach((e, i) => {
    if (e.art || i === 0) {
      if (i > 0) {
        y += 18;
        items.push({ kind: 'rule', y });
        y += 34;
      }
      const tsize = Math.round(38 * Math.min(scale, 2.2));
      setFont(ctx, tsize, 800);
      const tl = wrapRulesParagraph(ctx, e.title, textW);
      const lh = Math.round(tsize * 1.22);
      items.push({ kind: 'title', lines: tl, size: tsize, lh, y: y + tsize * 0.85 });
      y += tl.length * lh + 14;
      if (e.art) {
        const box = ART_BOX[e.art];
        const sc = Math.min(1, colW / 700);
        items.push({ kind: 'art', name: e.art, box, sc, y });
        y += box.h * sc + 18;
      }
    } else {
      const ssize = Math.round(26 * scale);
      setFont(ctx, ssize, 700);
      const sl = wrapRulesParagraph(ctx, e.title, textW);
      const lh = Math.round(ssize * 1.22);
      items.push({ kind: 'sub', lines: sl, size: ssize, lh, y: y + ssize * 0.85 });
      y += sl.length * lh + 6;
    }
    setFont(ctx, bodySize, 500);
    const lh = Math.round(bodySize * 1.3);
    for (const p of e.lines) {
      const pl = wrapRulesParagraph(ctx, p, textW);
      items.push({ kind: 'para', lines: pl, size: bodySize, lh, y: y + bodySize * 0.85 });
      y += pl.length * lh + Math.round(bodySize * 0.5);
    }
    y += 8;
  });
  readerCache = { key, items, height: y + 24 };
  return readerCache;
}

function drawRulesPage(ctx, state, pal) {
  const t = state.pulse;
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  const P = RULES_PANEL;
  glassPanel(ctx, P, 30);
  const lab = POS.rules.label;
  text(ctx, V.mode === 'wide' ? `RULES  ·  TEXT ${Math.round(scale * 100)}%` : `SURE SWEEP - RULES  ·  TEXT ${Math.round(scale * 100)}%`, lab.x, lab.y, lab.size, pal.inkFaint, 700);

  const colW = Math.min(P.w - 56, 700);
  const L = readerLayout(ctx, scale, colW, state.fx.sceneAt);
  readerView.contentH = L.height;
  readerView.viewH = P.h;
  readerView.max = Math.max(0, L.height - P.h);
  const scroll = clamp(state.rulesScroll ?? 0, 0, readerView.max);
  const cx = P.x + P.w / 2;
  const x0 = cx - colW / 2;

  ctx.save();
  rr(ctx, P.x + 2, P.y + 2, P.w - 4, P.h - 4, 28);
  ctx.clip();
  ctx.translate(0, P.y - scroll);
  const vis0 = scroll - 400;
  const vis1 = scroll + P.h + 100;
  for (const it of L.items) {
    if (it.kind === 'rule') {
      if (it.y < vis0 || it.y > vis1) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x0 + 40, it.y, colW - 80, 2);
    } else if (it.kind === 'art') {
      if (it.y + it.box.h * it.sc < vis0 || it.y > vis1) continue;
      ctx.save();
      ctx.translate(cx, it.y);
      ctx.scale(it.sc, it.sc);
      ctx.translate(-360, -it.box.top);
      drawRulesArt(ctx, it.name, pal, t);
      ctx.restore();
    } else {
      if (it.y + it.lines.length * it.lh < vis0 || it.y - it.size > vis1) continue;
      const col = it.kind === 'para' ? pal.inkSoft : pal.ink;
      const wt = it.kind === 'title' ? 800 : it.kind === 'sub' ? 700 : 500;
      it.lines.forEach((ln, i) => text(ctx, ln, cx, it.y + i * it.lh, it.size, col, wt));
    }
  }
  ctx.restore();

  // scroll bar
  if (readerView.max > 0) {
    const S = SCROLLBAR;
    rr(ctx, S.x, S.y, S.w, S.h, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    const th = Math.max(44, (S.h * P.h) / L.height);
    const ty = S.y + (scroll / readerView.max) * (S.h - th);
    rr(ctx, S.x, ty, S.w, th, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  }

  const tau = (id) => (state.fx.btn === id ? t - state.fx.btnAt : -1);
  drawButton(ctx, RULES_BACK_BTN, 'Back', { pal, size: 28, pressTau: tau('rulesBack') });
  ctx.save();
  ctx.globalAlpha = state.textScaleIdx === 0 ? 0.4 : 1;
  drawButton(ctx, TEXT_DEC_BTN, 'A−', { pal, size: 30, pressTau: tau('textDec') });
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = state.textScaleIdx === TEXT_SCALES.length - 1 ? 0.4 : 1;
  drawButton(ctx, TEXT_INC_BTN, 'A+', { pal, size: 30, pressTau: tau('textInc') });
  ctx.restore();
  if (V.mode === 'wide') {
    const y = TEXT_DEC_BTN.y + TEXT_DEC_BTN.h + 40;
    const x = RULES_BACK_BTN.x + RULES_BACK_BTN.w / 2;
    ['Drag, scroll or use', 'the arrow keys to read'].forEach((ln, i) => text(ctx, ln, x, y + i * 26, 19, pal.inkFaint, 500));
  }
}

export function draw(ctx, state, extra) {
  useLayout(extra.w, extra.h);
  const pal = palette(state.theme);
  drawBackground(ctx, pal, state.pulse);
  if (state.scene === 'title') drawTitle(ctx, state, pal, extra);
  else if (state.scene === 'demo-limit') drawDemoLimit(ctx, state, pal);
  else if (state.scene === 'rules') drawRulesPage(ctx, state, pal);
  else drawPlay(ctx, state, pal, extra);
}

let lockPress = 0;
// Press feedback for the tappable lockup: a brief dim after a tap (no sound, no popup).
export const pressLockup = () => { lockPress = 10; };
