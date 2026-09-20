// Drawing primitives: everything on screen is vector-drawn here (no image files).
import { C, W, H, font, elementColor, alpha } from './theme.js';
import { CARDS, describe, ELEMENT_NAMES, BEATS } from '../data/cards.js';

const TAU = Math.PI * 2;

// Where the finger currently is (set once per frame by render.js) so buttons can look pressed.
let pressPoint = null;
export function setPress(pt) {
  pressPoint = pt;
}
const isPressed = (r) => !!pressPoint && pressPoint.x >= r.x && pressPoint.x <= r.x + r.w && pressPoint.y >= r.y && pressPoint.y <= r.y + r.h;

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function text(ctx, str, x, y, { size = 28, weight = 400, color = C.ink, align = 'center', alpha: a = 1, display = false, glow = null } = {}) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.font = font(size, weight, display);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.5;
  }
  ctx.fillText(String(str), x, y);
  ctx.restore();
}

// Capitals with extra letter spacing, drawn glyph by glyph so it works on every browser.
// `maxWidth` shrinks the whole line (type and spacing together) so it never runs past its space.
export function tracked(ctx, str, x, y, { size = 24, weight = 700, color = C.gold, spacing = 3, alpha: a = 1, display = true, glow = null, fill = null, maxWidth = 0 } = {}) {
  const s = String(str).toUpperCase();
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.font = font(size, weight, display);
  const widths = [];
  let total = 0;
  for (const ch of s) {
    const w = ctx.measureText(ch).width;
    widths.push(w);
    total += w + spacing;
  }
  total -= spacing;
  const k = maxWidth > 0 && total > maxWidth ? maxWidth / total : 1;
  if (k < 1) ctx.font = font(size * k, weight, display);
  ctx.fillStyle = fill ?? color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * k * 0.45;
  }
  let cx = x - (total * k) / 2;
  let i = 0;
  for (const ch of s) {
    ctx.fillText(ch, cx, y);
    cx += (widths[i] + spacing) * k;
    i += 1;
  }
  ctx.restore();
  return total * k;
}

export function wrap(ctx, str, maxW) {
  const lines = [];
  let line = '';
  for (const word of String(str).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function paragraph(ctx, str, x, y, maxW, { size = 26, weight = 400, color = C.ink, align = 'center', lineH = 1.3, alpha: a = 1, display = false } = {}) {
  ctx.save();
  ctx.font = font(size, weight, display);
  const lines = wrap(ctx, str, maxW);
  ctx.restore();
  lines.forEach((ln, i) => text(ctx, ln, x, y + i * size * lineH, { size, weight, color, align, alpha: a, display }));
  return lines.length * size * lineH;
}

export const goldFoil = (ctx, x0, y0, x1, y1) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, C.goldLight);
  g.addColorStop(0.3, C.gold);
  g.addColorStop(0.55, C.goldDeep);
  g.addColorStop(0.8, C.gold);
  g.addColorStop(1, C.goldLight);
  return g;
};
const steelFoil = (ctx, x0, y0, x1, y1) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#dbe6fb');
  g.addColorStop(0.35, C.steel);
  g.addColorStop(0.6, C.steelDeep);
  g.addColorStop(1, '#c4d2ee');
  return g;
};

function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

// ---------------------------------------------------------------- the night scene
export const HORIZON = 1120;

export function makeSky(rng) {
  const stars = [];
  for (let i = 0; i < 150; i++) stars.push({ x: rng.range(0, W), y: rng.range(0, HORIZON - 120), r: rng.range(0.5, 2.0), tw: rng.range(0, TAU), sp: rng.range(0.5, 1.8), big: rng.chance(0.06) });
  const nebula = [];
  for (let i = 0; i < 5; i++) nebula.push({ x: rng.range(60, W - 60), y: rng.range(140, HORIZON - 260), r: rng.range(220, 420), hue: rng.pick(['#5a3fb8', '#1f6d8f', '#7a2f7c', '#2a4fb0']) });
  const ridge = (base, rough, step) => {
    const pts = [];
    let y = base;
    for (let x = -40; x <= W + 40; x += step) {
      y += rng.range(-rough, rough);
      y = Math.max(base - rough * 3, Math.min(base + rough * 2, y));
      pts.push([x, y]);
    }
    return pts;
  };
  const ridges = [ridge(HORIZON - 150, 26, 46), ridge(HORIZON - 70, 20, 38), ridge(HORIZON + 10, 12, 30)];
  const towers = [];
  for (let i = 0; i < 4; i++) towers.push({ x: 90 + i * 180 + rng.range(-40, 40), h: rng.range(130, 210), ph: rng.range(0, TAU) });
  const motes = [];
  for (let i = 0; i < 26; i++) motes.push({ x: rng.range(0, W), ph: rng.range(0, 1), sp: rng.range(0.018, 0.05), sway: rng.range(8, 30), r: rng.range(1, 2.6) });
  return { stars, nebula, ridges, towers, motes, layer: null, layerTried: false };
}

function drawStaticScene(ctx, sky) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(0.45, C.skyMid);
  g.addColorStop(0.72, C.skyLow);
  g.addColorStop(0.73, '#0a0c22');
  g.addColorStop(1, '#05071a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (const n of sky.nebula) {
    const ng = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.r);
    ng.addColorStop(0, alpha(n.hue, 0.2));
    ng.addColorStop(1, alpha(n.hue, 0));
    ctx.fillStyle = ng;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }

  // horizon light
  const hl = ctx.createLinearGradient(0, HORIZON - 320, 0, HORIZON);
  hl.addColorStop(0, 'rgba(120, 90, 200, 0)');
  hl.addColorStop(1, 'rgba(226, 150, 120, 0.2)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, HORIZON - 320, W, 320);

  // three ridgelines, far to near
  const fills = ['#2a2a6a', '#1a1b52', '#0c0e2c'];
  sky.ridges.forEach((pts, i) => {
    ctx.beginPath();
    ctx.moveTo(-40, H);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(W + 40, H);
    ctx.closePath();
    ctx.fillStyle = fills[i];
    ctx.fill();
    ctx.strokeStyle = `rgba(240, 205, 140, ${0.28 + i * 0.08})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    const haze = ctx.createLinearGradient(0, pts[0][1] - 40, 0, pts[0][1] + 120);
    haze.addColorStop(0, 'rgba(150, 120, 220, 0)');
    haze.addColorStop(0.45, `rgba(150, 120, 220, ${0.16 - i * 0.04})`);
    haze.addColorStop(1, 'rgba(150, 120, 220, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, pts[0][1] - 40, W, 160);
    if (i === 1) {
      // wind-towers stand on the middle ridge
      for (const tw of sky.towers) {
        const baseY = HORIZON - 40;
        ctx.fillStyle = '#0b0d2b';
        ctx.beginPath();
        ctx.moveTo(tw.x - 17, baseY);
        ctx.lineTo(tw.x - 6, baseY - tw.h);
        ctx.lineTo(tw.x + 6, baseY - tw.h);
        ctx.lineTo(tw.x + 17, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 214, 140, 0.75)';
        for (let k = 1; k <= 3; k++) ctx.fillRect(tw.x - 1.5, baseY - tw.h + k * (tw.h / 4.5), 3, 5);
      }
    }
  });

  // ground sheen under the hand
  const gs = ctx.createLinearGradient(0, HORIZON, 0, H);
  gs.addColorStop(0, 'rgba(60, 50, 120, 0.22)');
  gs.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gs;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.48, H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// The moon: big beside the wordmark on the title, tucked into the corner everywhere else.
export function drawMoon(ctx, mx, my, r) {
  const halo = ctx.createRadialGradient(mx, my, r * 0.5, mx, my, r * 4.4);
  halo.addColorStop(0, 'rgba(255, 238, 200, 0.24)');
  halo.addColorStop(1, 'rgba(255, 238, 200, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(mx - r * 4.4, my - r * 4.4, r * 8.8, r * 8.8);
  const moon = ctx.createRadialGradient(mx - r * 0.3, my - r * 0.3, r * 0.1, mx, my, r);
  moon.addColorStop(0, '#fff7e2');
  moon.addColorStop(0.7, '#ecd9ad');
  moon.addColorStop(1, '#c9b27e');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 125, 80, 0.2)';
  for (const [dx, dy, cr] of [[-0.29, -0.16, 0.2], [0.26, 0.24, 0.28], [0.13, -0.42, 0.12], [-0.4, 0.37, 0.14]]) {
    ctx.beginPath();
    ctx.arc(mx + dx * r, my + dy * r, cr * r, 0, TAU);
    ctx.fill();
  }
}

export function drawSky(ctx, sky, t, tint = null, moonAt = null, calm = false) {
  // The static part of the scene is painted once into an off-screen layer where the platform allows it.
  if (!sky.layerTried) {
    sky.layerTried = true;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const layer = new OffscreenCanvas(W * 2, H * 2);
        const lctx = layer.getContext('2d');
        lctx.scale(2, 2);
        drawStaticScene(lctx, sky);
        sky.layer = layer;
      }
    } catch {
      sky.layer = null;
    }
  }
  if (sky.layer) ctx.drawImage(sky.layer, 0, 0, W, H);
  else drawStaticScene(ctx, sky);

  if (moonAt) drawMoon(ctx, moonAt.x, moonAt.y, moonAt.r);

  // twinkling stars
  ctx.save();
  for (const s of sky.stars) {
    const a = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.sp + s.tw));
    ctx.globalAlpha = a * (s.y > HORIZON - 320 ? 0.45 : 1);
    ctx.fillStyle = '#ffffff';
    if (s.r < 1.7 && !s.big) {
      // most stars are a pixel or two: a rectangle is far cheaper than a path
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    if (s.big) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - 7, s.y);
      ctx.lineTo(s.x + 7, s.y);
      ctx.moveTo(s.x, s.y - 7);
      ctx.lineTo(s.x, s.y + 7);
      ctx.stroke();
    }
  }
  ctx.restore();

  // a shooting star now and then
  const cycle = t % 11;
  if (!calm && cycle < 0.9) {
    const k = cycle / 0.9;
    const sx = 80 + ((Math.floor(t / 11) * 173) % 380);
    ctx.save();
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
    const x0 = sx + k * 260;
    const y0 = 120 + k * 150;
    const sg = ctx.createLinearGradient(x0 - 90, y0 - 52, x0, y0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(1, 'rgba(255,255,255,0.95)');
    ctx.strokeStyle = sg;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 - 90, y0 - 52);
    ctx.lineTo(x0, y0);
    ctx.stroke();
    ctx.restore();
  }

  // turning vanes
  ctx.save();
  ctx.strokeStyle = 'rgba(226, 189, 114, 0.5)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const tw of sky.towers) {
    const hy = HORIZON - 40 - tw.h;
    for (let k = 0; k < 3; k++) {
      const a = t * 0.5 + tw.ph + (k * TAU) / 3;
      ctx.beginPath();
      ctx.moveTo(tw.x, hy);
      ctx.lineTo(tw.x + Math.cos(a) * 34, hy + Math.sin(a) * 34);
      ctx.stroke();
    }
  }
  ctx.restore();

  // the horizon takes the colour of whatever you are fighting
  if (tint) {
    const glow = ctx.createRadialGradient(W / 2, HORIZON - 60, 30, W / 2, HORIZON - 60, 560);
    glow.addColorStop(0, alpha(tint, 0.3));
    glow.addColorStop(1, alpha(tint, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, HORIZON - 620, W, 1000);
  }

  // drifting motes
  ctx.save();
  for (const m of calm ? [] : sky.motes) {
    const k = (t * m.sp + m.ph) % 1;
    const y = H - 80 - k * (H * 0.62);
    const x = m.x + Math.sin(t * 0.6 + m.ph * 9) * m.sway;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.55;
    ctx.fillStyle = tint ?? C.gold;
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- element glyphs
export function glyph(ctx, element, x, y, s, { color = null, width = 3, alpha: a = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= a;
  ctx.strokeStyle = color ?? elementColor(element);
  ctx.fillStyle = color ?? elementColor(element);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const r = s / 2;
  if (element === 'ember') {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.8, r * 0.9, 0, r);
    ctx.bezierCurveTo(-r * 0.8, r * 0.9, -r * 0.9, -r * 0.2, 0, -r);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.15);
    ctx.bezierCurveTo(r * 0.4, r * 0.2, r * 0.3, r * 0.7, 0, r * 0.72);
    ctx.bezierCurveTo(-r * 0.3, r * 0.7, -r * 0.4, r * 0.2, 0, -r * 0.15);
    ctx.stroke();
  } else if (element === 'tide') {
    for (const dy of [-r * 0.45, r * 0.05, r * 0.55]) {
      ctx.beginPath();
      ctx.moveTo(-r, dy);
      ctx.bezierCurveTo(-r * 0.5, dy - r * 0.45, -r * 0.1, dy + r * 0.45, r * 0.3, dy);
      ctx.bezierCurveTo(r * 0.55, dy - r * 0.28, r * 0.8, dy - r * 0.2, r, dy);
      ctx.stroke();
    }
  } else if (element === 'flare') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const an = (i * TAU) / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(an) * r * 0.62, Math.sin(an) * r * 0.62);
      ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
      ctx.stroke();
    }
  } else if (element === 'storm') {
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.25, r * 0.38, Math.PI * 0.9, Math.PI * 1.9);
    ctx.arc(r * 0.2, -r * 0.4, r * 0.45, Math.PI * 1.15, Math.PI * 0.05);
    ctx.lineTo(-r * 0.7, -r * 0.02);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.15, 0);
    ctx.lineTo(-r * 0.2, r * 0.5);
    ctx.lineTo(r * 0.15, r * 0.5);
    ctx.lineTo(-r * 0.1, r);
    ctx.stroke();
  } else if (element === 'gale') {
    for (const [dy, len, curl] of [[-r * 0.5, 0.9, 0.3], [0, 1, 0.34], [r * 0.5, 0.7, 0.26]]) {
      ctx.beginPath();
      ctx.moveTo(-r, dy);
      ctx.lineTo(r * (len - 0.4), dy);
      ctx.arc(r * (len - 0.4), dy - r * curl, r * curl, Math.PI / 2, -Math.PI * 0.9, true);
      ctx.stroke();
    }
  } else if (element === 'stone') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const an = (i * TAU) / 6 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r);
      else ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, 0);
    ctx.lineTo(Math.cos(Math.PI / 6) * r, Math.sin(Math.PI / 6) * r);
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.cos(Math.PI / 6) * r, Math.sin(Math.PI / 6) * r);
    ctx.stroke();
  } else {
    // neutral: a single arrow
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(0, -r * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.42, -r * 0.35);
    ctx.lineTo(0, -r * 0.5);
    ctx.lineTo(-r * 0.42, -r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (const fy of [r * 0.55, r * 0.8]) {
      ctx.moveTo(-r * 0.32, fy + r * 0.18);
      ctx.lineTo(0, fy - r * 0.1);
      ctx.lineTo(r * 0.32, fy + r * 0.18);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- small vector icons
// Drawn, not typed: symbol characters turn into colour emoji on some phones.
export function icon(ctx, name, x, y, s, color = C.ink, width = 2.4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const r = s / 2;
  ctx.beginPath();
  if (name === 'dmg') {
    ctx.moveTo(-r, r);
    ctx.lineTo(r * 0.75, -r * 0.75);
    ctx.moveTo(r, -r);
    ctx.lineTo(r * 0.2, -r * 0.85);
    ctx.moveTo(r, -r);
    ctx.lineTo(r * 0.85, -r * 0.2);
    ctx.moveTo(-r, r);
    ctx.lineTo(-r * 0.45, r * 0.9);
    ctx.moveTo(-r, r);
    ctx.lineTo(-r * 0.9, r * 0.45);
    ctx.stroke();
  } else if (name === 'guard') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.85, -r * 0.6);
    ctx.lineTo(r * 0.85, r * 0.1);
    ctx.quadraticCurveTo(r * 0.7, r * 0.8, 0, r);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.8, -r * 0.85, r * 0.1);
    ctx.lineTo(-r * 0.85, -r * 0.6);
    ctx.closePath();
    ctx.stroke();
  } else if (name === 'draw') {
    roundRect(ctx, -r * 0.6, -r, r * 1.2, r * 2, r * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, 0);
    ctx.lineTo(r * 0.25, 0);
    ctx.moveTo(0, -r * 0.25);
    ctx.lineTo(0, r * 0.25);
    ctx.stroke();
  } else if (name === 'aim') {
    ctx.arc(0, 0, r * 0.7, 0, TAU);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, -r * 0.35);
    ctx.moveTo(0, r);
    ctx.lineTo(0, r * 0.35);
    ctx.moveTo(-r, 0);
    ctx.lineTo(-r * 0.35, 0);
    ctx.moveTo(r, 0);
    ctx.lineTo(r * 0.35, 0);
    ctx.stroke();
  } else if (name === 'focus') {
    ctx.arc(0, 0, r * 0.7, 0, TAU);
    ctx.fill();
  } else if (name === 'answer') {
    ctx.arc(0, 0, r * 0.85, Math.PI * 0.15, Math.PI * 1.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r);
    ctx.lineTo(r * 0.62, -r * 0.55);
    ctx.lineTo(r * 0.05, -r * 0.4);
    ctx.stroke();
  } else if (name === 'mark') {
    ctx.moveTo(-r * 0.6, -r * 0.6);
    ctx.lineTo(r * 0.6, r * 0.6);
    ctx.moveTo(r * 0.6, -r * 0.6);
    ctx.lineTo(-r * 0.6, r * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
  } else if (name === 'moon') {
    ctx.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65);
    ctx.quadraticCurveTo(-r * 0.15, 0, Math.cos(Math.PI * 0.35) * r, Math.sin(Math.PI * 0.35) * r);
    ctx.stroke();
  } else if (name === 'fork') {
    ctx.moveTo(-r * 0.45, -r);
    ctx.lineTo(-r * 0.45, -r * 0.1);
    ctx.quadraticCurveTo(-r * 0.45, r * 0.3, 0, r * 0.3);
    ctx.quadraticCurveTo(r * 0.45, r * 0.3, r * 0.45, -r * 0.1);
    ctx.lineTo(r * 0.45, -r);
    ctx.moveTo(0, r * 0.3);
    ctx.lineTo(0, r);
    ctx.stroke();
  } else if (name === 'letter') {
    roundRect(ctx, -r, -r * 0.65, r * 2, r * 1.3, r * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.6);
    ctx.lineTo(0, r * 0.1);
    ctx.lineTo(r, -r * 0.6);
    ctx.stroke();
  } else if (name === 'up') {
    ctx.moveTo(0, r);
    ctx.lineTo(0, -r);
    ctx.moveTo(-r * 0.6, -r * 0.35);
    ctx.lineTo(0, -r);
    ctx.lineTo(r * 0.6, -r * 0.35);
    ctx.stroke();
  } else if (name === 'menu') {
    for (const dy of [-r * 0.6, 0, r * 0.6]) {
      ctx.moveTo(-r, dy);
      ctx.lineTo(r, dy);
    }
    ctx.stroke();
  } else if (name === 'swords') {
    ctx.moveTo(-r, r);
    ctx.lineTo(r, -r);
    ctx.moveTo(r, r);
    ctx.lineTo(-r, -r);
    ctx.moveTo(-r * 0.95, r * 0.35);
    ctx.lineTo(-r * 0.35, r * 0.95);
    ctx.moveTo(r * 0.95, r * 0.35);
    ctx.lineTo(r * 0.35, r * 0.95);
    ctx.stroke();
  } else if (name === 'skull') {
    ctx.arc(0, -r * 0.15, r * 0.8, Math.PI * 0.9, Math.PI * 0.1);
    ctx.lineTo(r * 0.45, r * 0.85);
    ctx.lineTo(-r * 0.45, r * 0.85);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.1, r * 0.16, 0, TAU);
    ctx.arc(r * 0.32, -r * 0.1, r * 0.16, 0, TAU);
    ctx.fill();
  } else if (name === 'crown') {
    ctx.moveTo(-r, r * 0.6);
    ctx.lineTo(-r, -r * 0.4);
    ctx.lineTo(-r * 0.45, r * 0.05);
    ctx.lineTo(0, -r * 0.8);
    ctx.lineTo(r * 0.45, r * 0.05);
    ctx.lineTo(r, -r * 0.4);
    ctx.lineTo(r, r * 0.6);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

// The one number that matters most on a card, for the small hand-size face.
export function primaryStat(card) {
  const fx = card.fx;
  if (fx.ward) return { icon: 'answer', label: ELEMENT_NAMES[BEATS[card.element]] };
  if (fx.dmg) return { icon: 'dmg', label: `${fx.dmg}${fx.hits > 1 ? `×${fx.hits}` : ''}${fx.all ? ' all' : ''}` };
  if (fx.guard) return { icon: 'guard', label: String(fx.guard) };
  if (fx.aim) return { icon: 'aim', label: `+${fx.aim}` };
  if (fx.draw) return { icon: 'draw', label: `+${fx.draw}` };
  if (fx.focus) return { icon: 'focus', label: `+${fx.focus}` };
  if (fx.exposed) return { icon: 'mark', label: `Exp ${fx.exposed}` };
  return { icon: 'up', label: '' };
}

// ---------------------------------------------------------------- cards
const RARITY_PIPS = { starter: 0, common: 1, uncommon: 2, rare: 3 };

// Draws a card centred on (0,0) of the current transform. w x h is the full plaque.
export function drawCard(ctx, cardId, w, h, { t = 0, dim = false, lit = false, answers = false, unaffordable = false } = {}) {
  const card = CARDS[cardId];
  if (!card) return;
  const isArrow = card.kind === 'arrow';
  const col = elementColor(card.element);
  const x = -w / 2;
  const y = -h / 2;
  const k = w / 156;
  ctx.save();
  if (dim) ctx.globalAlpha *= 0.5;

  // drop shadow / glow
  ctx.shadowColor = answers ? C.good : lit ? col : 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = (answers || lit ? 34 : 18) * k;
  ctx.shadowOffsetY = lit || answers ? 0 : 8 * k;
  roundRect(ctx, x, y, w, h, 16 * k);
  const face = ctx.createLinearGradient(0, y, 0, y + h);
  face.addColorStop(0, isArrow ? '#262a62' : '#1b2148');
  face.addColorStop(0.55, isArrow ? '#151839' : '#11152f');
  face.addColorStop(1, '#0a0c20');
  ctx.fillStyle = face;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // inside the frame
  ctx.save();
  roundRect(ctx, x, y, w, h, 16 * k);
  ctx.clip();
  const medY = y + h * (w < 180 ? 0.36 : 0.265);
  const wash = ctx.createRadialGradient(0, medY, 4, 0, medY, w * 0.8);
  wash.addColorStop(0, alpha(col, isArrow ? 0.42 : 0.24));
  wash.addColorStop(0.6, alpha(col, 0.06));
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  if (isArrow) {
    // a slow foil sweep: the mark of a named Arrow
    const sweep = ((t * 0.3) % 2.6) - 0.8;
    const sx = x + sweep * w;
    const sh = ctx.createLinearGradient(sx, y, sx + w * 0.55, y + h * 0.4);
    sh.addColorStop(0, 'rgba(255,255,255,0)');
    sh.addColorStop(0.5, 'rgba(255,240,200,0.13)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  // frame: gold foil for Arrows, brushed steel for Techniques (material, not colour alone)
  const foil = isArrow ? goldFoil(ctx, x, y, x + w, y + h) : steelFoil(ctx, x, y, x + w, y + h);
  ctx.lineWidth = (isArrow ? 3.4 : 2.6) * k;
  ctx.strokeStyle = answers ? C.good : foil;
  roundRect(ctx, x + 1.5 * k, y + 1.5 * k, w - 3 * k, h - 3 * k, 15 * k);
  ctx.stroke();
  ctx.lineWidth = 1 * k;
  ctx.strokeStyle = alpha(isArrow ? C.gold : C.steel, 0.35);
  roundRect(ctx, x + 8 * k, y + 8 * k, w - 16 * k, h - 16 * k, 10 * k);
  ctx.stroke();

  // crest: an arrowhead for Arrows, a stud for Techniques
  ctx.fillStyle = foil;
  if (isArrow) {
    ctx.beginPath();
    ctx.moveTo(0, y - 9 * k);
    ctx.lineTo(11 * k, y + 8 * k);
    ctx.lineTo(0, y + 3 * k);
    ctx.lineTo(-11 * k, y + 8 * k);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, y + 1.5 * k, 5 * k, 0, TAU);
    ctx.fill();
  }

  // medallion behind the glyph
  const mr = (w < 180 ? 40 : 36) * k;
  ctx.beginPath();
  ctx.arc(0, medY, mr, 0, TAU);
  const mg = ctx.createRadialGradient(0, medY - mr * 0.3, 2, 0, medY, mr);
  mg.addColorStop(0, alpha(col, 0.35));
  mg.addColorStop(1, 'rgba(6, 8, 24, 0.85)');
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.lineWidth = 1.6 * k;
  ctx.strokeStyle = alpha(col, 0.9);
  ctx.stroke();
  ctx.lineWidth = 1 * k;
  ctx.strokeStyle = alpha(C.gold, 0.35);
  ctx.beginPath();
  ctx.arc(0, medY, mr + 5 * k, 0, TAU);
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur = 12 * k;
  glyph(ctx, card.element, 0, medY, mr * 1.18, { width: 3.2 * k, color: card.element ? null : C.goldLight });
  ctx.restore();

  // cost gem
  const gx = x + 27 * k;
  const gy = y + 29 * k;
  ctx.beginPath();
  ctx.arc(gx, gy, 19 * k, 0, TAU);
  const cg = ctx.createRadialGradient(gx - 6 * k, gy - 7 * k, 2, gx, gy, 19 * k);
  cg.addColorStop(0, unaffordable ? '#6a2a3c' : '#3a4a9c');
  cg.addColorStop(1, unaffordable ? '#2a0f18' : '#0c1030');
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.lineWidth = 2.2 * k;
  ctx.strokeStyle = unaffordable ? C.damage : foil;
  ctx.stroke();
  text(ctx, card.cost, gx, gy + 9 * k, { size: 25 * k, weight: 800, color: unaffordable ? '#ffb3c0' : '#ffffff' });

  // The frame material and the crest already say Arrow or Technique; a word would only collide
  // with the medallion, or be cut off by the next card in the hand's fan.

  const pips = RARITY_PIPS[card.rarity] ?? 0;
  const nameBand = (bandY) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(x + 8 * k, bandY, w - 16 * k, 44 * k);
    ctx.strokeStyle = alpha(isArrow ? C.gold : C.steel, 0.55);
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.moveTo(x + 8 * k, bandY);
    ctx.lineTo(x + w - 8 * k, bandY);
    ctx.moveTo(x + 8 * k, bandY + 44 * k);
    ctx.lineTo(x + w - 8 * k, bandY + 44 * k);
    ctx.stroke();
    // in the hand's fan the next card covers the right ~quarter, so the title lives in the visible left part
    const fan = w < 180;
    const avail = fan ? w * 0.7 : w - 22 * k;
    const nameX = fan ? -w * 0.13 : 0;
    ctx.save();
    ctx.font = font(15 * k, 700, true);
    let lines = wrap(ctx, card.name.toUpperCase(), avail).slice(0, 2);
    let size = lines.length > 1 ? 13 * k : 15 * k;
    // A single long word (HEARTHGUARD) cannot wrap, so shrink the type until it fits the plate.
    ctx.font = font(size, 700, true);
    const widest = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
    if (widest > avail) size *= avail / widest;
    ctx.restore();
    lines.forEach((ln, idx) => text(ctx, ln, nameX, bandY + (lines.length > 1 ? 18 : 28) * k + idx * 15 * k, { size, weight: 700, color: C.ink, display: true }));
  };

  if (w < 180) {
    // hand size: icon-led, readable at arm's length. Full text appears in the detail panel.
    const stat = primaryStat(card);
    let fs = 32 * k;
    ctx.save();
    ctx.font = font(fs, 800);
    let lw = stat.label ? ctx.measureText(stat.label).width : 0;
    const iw = 27 * k;
    // the next card in the fan covers the right of this one: keep the label in the visible left part
    const room = w * 0.68;
    const ox = stat.label ? -w * 0.08 : 0;
    if (stat.label && iw + 9 * k + lw > room) {
      fs *= (room - iw - 9 * k) / lw;
      lw = (room - iw - 9 * k);
    }
    ctx.restore();
    const total = iw + (stat.label ? 9 * k + lw : 0);
    const sy = y + h * 0.645;
    icon(ctx, stat.icon, ox - total / 2 + iw / 2, sy, iw, stat.icon === 'guard' ? C.guard : stat.icon === 'answer' ? C.good : C.goldLight, 2.8 * k);
    if (stat.label) text(ctx, stat.label, ox - total / 2 + iw + 9 * k, sy + fs * 0.36, { size: fs, weight: 800, align: 'left', color: '#ffffff' });
    nameBand(y + h * 0.745);
  } else {
    nameBand(y + h * 0.455);
    paragraph(ctx, describe(card), 0, y + h * 0.455 + 70 * k, w - 26 * k, { size: 14.5 * k, color: C.inkSoft, lineH: 1.2 });
  }

  // rarity pips
  for (let i = 0; i < pips; i++) {
    diamond(ctx, (i - (pips - 1) / 2) * 13 * k, y + h - 13 * k, 4.2 * k);
    ctx.fillStyle = foil;
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- enemies: faceted constructs
function polyPoints(sides, r, rot) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * TAU) / sides - Math.PI / 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r, a]);
  }
  return pts;
}

function tracePoly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
}

const SIDES = { tri: 3, diamond: 4, kite: 4, hex: 6, bolt: 5, sun: 10, wave: 8, colossus: 4, boss_lure: 8, lure: 4 };

// The Answering Storm: three broken rings around a small white core. It swells and flickers with
// every point of Strength, and the core shows how many turns it has left.
function drawStorm(ctx, enemy, x, y, r, t, flash) {
  const col = elementColor('storm');
  const grow = 1 + Math.min(enemy.strength, 24) * 0.022;
  const rr = r * grow;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 0.9) * 6);
  const aura = ctx.createRadialGradient(0, 0, rr * 0.15, 0, 0, rr * 2.2);
  aura.addColorStop(0, alpha(col, 0.5));
  aura.addColorStop(0.5, alpha(col, 0.16));
  aura.addColorStop(1, alpha(col, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, rr * 2.2, 0, TAU);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.shadowColor = col;
  ctx.shadowBlur = 18 + enemy.strength;
  [[1.0, 200, 0.55, 5], [0.76, 250, -0.85, 4], [0.52, 300, 1.25, 3]].forEach(([k, deg, speed, w], i) => {
    ctx.strokeStyle = i === 2 ? '#ffffff' : col;
    ctx.lineWidth = w;
    const a = t * speed + i * 2.1;
    ctx.beginPath();
    ctx.arc(0, 0, rr * k, a, a + (deg * Math.PI) / 180);
    ctx.stroke();
    ctx.strokeStyle = alpha(col, 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, rr * k, a + (deg * Math.PI) / 180 + 0.4, a + TAU - 0.4);
    ctx.stroke();
  });
  // one jagged spoke for every two points of Strength, flickering between core and outer ring
  const spokes = Math.min(12, Math.floor(enemy.strength / 2));
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.shadowBlur = 14;
  for (let i = 0; i < spokes; i++) {
    if (Math.sin(t * 17 + i * 5.3) < -0.35) continue;
    const a = (i * TAU) / Math.max(spokes, 1) + t * 0.2;
    const j = () => Math.sin(t * 23 + i * 9) * 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rr * 0.2, Math.sin(a) * rr * 0.2);
    ctx.lineTo(Math.cos(a + 0.09) * rr * 0.45 + j(), Math.sin(a + 0.09) * rr * 0.45 + j());
    ctx.lineTo(Math.cos(a - 0.07) * rr * 0.7 - j(), Math.sin(a - 0.07) * rr * 0.7 - j());
    ctx.lineTo(Math.cos(a) * rr * 1.0, Math.sin(a) * rr * 1.0);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // the core: a small white light with the turns it has left
  const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, rr * 0.24);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(1, alpha(col, 0.55));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, rr * 0.24, 0, TAU);
  ctx.fill();
  if (enemy.lasts) text(ctx, Math.max(0, enemy.lasts - enemy.idx), 0, rr * 0.09, { size: rr * 0.3, weight: 800, color: '#0a0c24', display: true });
  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash) * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, rr * 1.05, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawRival(ctx, enemy, x, y, r, t, flash) {
  const tint = '#b9a6ff';
  ctx.save();
  const aura = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2);
  aura.addColorStop(0, alpha(tint, 0.3));
  aura.addColorStop(1, alpha(tint, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x, y, r * 2, 0, TAU);
  ctx.fill();
  // The bow is drawn back while it is about to fire, relaxed while it guards.
  const drawing = enemy.intent?.type === 'attack' ? 0.85 : 0.15;
  drawArcher(ctx, x, y + r * 0.72, t, { floating: false, pull: drawing, scale: 1.0, tint, flip: true, aimDown: true });
  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash) * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.95, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawConstruct(ctx, enemy, x, y, r, t, { flash = 0, targeted = false } = {}) {
  if (enemy.shape === 'boss_rival') {
    drawRival(ctx, enemy, x, y, r, t, flash);
    if (targeted) drawTargetMarks(ctx, x, y, r * 1.62, t);
    return;
  }
  if (enemy.shape === 'boss_storm') {
    drawStorm(ctx, enemy, x, y, r, t, flash);
    if (targeted) drawTargetMarks(ctx, x, y, r * 1.62, t);
    return;
  }
  const col = enemy.decoy ? C.gold : elementColor(enemy.element);
  const sides = SIDES[enemy.shape] ?? 5;
  const bob = Math.sin(t * 1.1 + x * 0.013) * 7;
  const breathe = 1 + Math.sin(t * 1.7 + x) * 0.02;
  ctx.save();
  ctx.translate(x, y + bob);

  // aura
  const aura = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.9);
  aura.addColorStop(0, alpha(col, 0.4));
  aura.addColorStop(0.5, alpha(col, 0.12));
  aura.addColorStop(1, alpha(col, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.9, 0, TAU);
  ctx.fill();

  // instrument dial
  const dr = r * 1.34;
  ctx.strokeStyle = alpha(C.gold, 0.3);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, dr, 0, TAU);
  ctx.stroke();
  const ticks = enemy.decoy ? 12 : 36;
  for (let i = 0; i < ticks; i++) {
    const a = t * 0.12 + (i * TAU) / ticks;
    const long = i % 3 === 0;
    ctx.strokeStyle = alpha(C.gold, long ? 0.55 : 0.25);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * dr, Math.sin(a) * dr);
    ctx.lineTo(Math.cos(a) * (dr - (long ? 9 : 5)), Math.sin(a) * (dr - (long ? 9 : 5)));
    ctx.stroke();
  }
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = col;
  for (let i = 0; i < 3; i++) {
    const a = -t * 0.35 + (i * TAU) / 3;
    ctx.beginPath();
    ctx.arc(0, 0, dr + 7, a, a + 0.55);
    ctx.stroke();
  }
  if ((enemy.act ?? 1) >= 2) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha('#b9a6ff', 0.7);
    ctx.beginPath();
    ctx.arc(0, 0, dr + 16, 0, TAU);
    ctx.stroke();
  }
  if ((enemy.act ?? 1) >= 3) {
    ctx.strokeStyle = alpha(C.damage, 0.75);
    ctx.beginPath();
    ctx.arc(0, 0, dr + 24, 0, TAU);
    ctx.stroke();
  }
  if (enemy.boss || enemy.elite) {
    const n = enemy.boss ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const a = t * 0.3 + (i * TAU) / n;
      diamond(ctx, Math.cos(a) * (dr + 24), Math.sin(a) * (dr + 24), enemy.boss ? 7 : 6);
      ctx.fillStyle = goldFoil(ctx, -r, -r, r, r);
      ctx.fill();
    }
  }

  // the gem itself
  ctx.save();
  ctx.scale(breathe, breathe);
  if (enemy.shape === 'kite') ctx.scale(0.8, 1.2);
  if (enemy.shape === 'boss_lure') ctx.scale(0.82, 1.22);
  const rot = t * 0.18;
  draw3dGem(ctx, sides, r, col, t * 0.5 + x * 0.01);
  // a dark core keeps the element glyph readable whatever face is turned to you
  const core = ctx.createRadialGradient(-r * 0.1, -r * 0.14, 2, 0, 0, r * 0.52);
  core.addColorStop(0, alpha(col, 0.5));
  core.addColorStop(1, 'rgba(6, 8, 26, 0.9)');
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, TAU);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha('#ffffff', 0.7);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur = 14;
  glyph(ctx, enemy.decoy ? null : enemy.element, 0, 0, r * 0.62, { width: Math.max(2.4, r * 0.035), color: '#ffffff' });
  ctx.restore();

  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash);
    ctx.fillStyle = '#ffffff';
    tracePoly(ctx, polyPoints(sides, r * 1.04, rot));
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (targeted) drawTargetMarks(ctx, x, y + bob, r * 1.62, t);
}

function drawTargetMarks(ctx, x, y, rr, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.goldLight;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 + Math.PI / 4;
    ctx.beginPath();
    ctx.arc(0, 0, rr + Math.sin(t * 4) * 3, a - 0.32, a + 0.32);
    ctx.stroke();
  }
  ctx.restore();
}

export function bar(ctx, x, y, w, h, frac, color, { frame = true, colorTop = null } = {}) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(3, 4, 14, 0.85)';
  ctx.fill();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, colorTop ?? '#ffffff');
    g.addColorStop(0.25, color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * f, h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y + 1, w * f, h * 0.32);
    ctx.restore();
  }
  if (frame) {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = alpha(C.gold, 0.75);
    ctx.stroke();
  }
}

export function intentBadge(ctx, enemy, x, y, t) {
  const intent = enemy.intent;
  if (!intent) return;
  const isAttack = intent.type === 'attack';
  const col = isAttack ? elementColor(intent.element) : C.muted;
  const pulse = isAttack && !enemy.answered ? 1 + Math.sin(t * 4) * 0.035 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  const stunned = enemy.stunned || enemy.halve;
  // The badge is as wide as what it says: glyph, the number as measured, and the answer (or FOUL).
  const shownLabel = isAttack ? `${Math.round(intent.value + enemy.strength)}${intent.hits > 1 ? `×${intent.hits}` : ''}` : '';
  let labelW = 0;
  if (isAttack) {
    ctx.save();
    ctx.font = font(34, 800);
    labelW = ctx.measureText(shownLabel).width;
    ctx.restore();
  }
  const rightW = intent.foul ? 82 : 96;
  const w = stunned ? 168 : isAttack && intent.element ? Math.max(184, 64 + labelW + rightW) : isAttack ? Math.max(124, 84 + labelW + (intent.foul ? 66 : 0)) : 168;
  const h = 58;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, 'rgba(34, 40, 88, 0.97)');
  g.addColorStop(1, 'rgba(8, 10, 28, 0.97)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = enemy.answered ? C.good : col;
  ctx.stroke();
  // little pointer toward the enemy
  ctx.beginPath();
  ctx.moveTo(-9, h / 2 - 1);
  ctx.lineTo(0, h / 2 + 10);
  ctx.lineTo(9, h / 2 - 1);
  ctx.closePath();
  ctx.fillStyle = enemy.answered ? C.good : col;
  ctx.fill();

  if (stunned) {
    text(ctx, enemy.stunned ? 'Stunned' : 'Halved', 0, 8, { size: 22, weight: 700, color: C.good, display: true });
  } else if (isAttack) {
    const label = shownLabel;
    if (intent.element) {
      glyph(ctx, intent.element, -w / 2 + 32, 0, 32, { width: 2.6 });
      text(ctx, label, -w / 2 + 58, 12, { size: 34, weight: 800, color: enemy.answered ? C.muted : '#ffffff', align: 'left' });
      if (intent.foul) {
        // A FOUL attack cannot be answered: only Guard helps.
        text(ctx, 'FOUL', w / 2 - 44, 7, { size: 19, weight: 800, color: C.damage, display: true });
      } else {
        const answer = Object.keys(BEATS).find((k2) => BEATS[k2] === intent.element);
        text(ctx, 'vs', w / 2 - 62, 7, { size: 15, weight: 700, color: C.muted, display: true });
        glyph(ctx, answer, w / 2 - 30, 0, 26, { width: 2.2 });
      }
    } else {
      icon(ctx, 'dmg', intent.foul ? -46 : -30, 0, 26, C.ink, 2.8);
      text(ctx, label, intent.foul ? -2 : 18, 12, { size: 34, weight: 800, color: '#ffffff' });
      if (intent.foul) text(ctx, 'FOUL', 42, 7, { size: 17, weight: 800, color: C.damage, display: true });
    }
    if (enemy.answered) {
      ctx.strokeStyle = C.good;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 16, 0);
      ctx.lineTo(w / 2 - 16, 0);
      ctx.stroke();
    }
  } else {
    const labels = { guard: `Guard ${intent.value}`, guardAll: `Shields all ${intent.value}`, heal: `Heals ${intent.value}`, buff: 'Tuning up', debuff: 'Hindering', curse: 'Frays your string', summon: 'Raising allies', aim: 'Taking aim' };
    const label = labels[intent.type] ?? 'Raising lures';
    text(ctx, label, 0, 8, { size: 20, weight: 700, color: C.ink, display: true });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the element ring
export function drawRing(ctx, x, y, r, order, { from = null, against = null } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r + 30, 0, TAU);
  const bg = ctx.createRadialGradient(0, 0, 10, 0, 0, r + 30);
  bg.addColorStop(0, 'rgba(20, 24, 60, 0.75)');
  bg.addColorStop(1, 'rgba(8, 10, 28, 0.35)');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = alpha(C.gold, 0.45);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  order.forEach((el, i) => {
    const a = (i * TAU) / order.length - Math.PI / 2;
    const mid = a + TAU / order.length / 2;
    ctx.save();
    ctx.translate(Math.cos(mid) * r, Math.sin(mid) * r);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = alpha(C.gold, 0.75);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4.5);
    ctx.lineTo(-4, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  order.forEach((el, i) => {
    const a = (i * TAU) / order.length - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    const hot = el === from || el === against;
    const col = elementColor(el);
    ctx.beginPath();
    ctx.arc(px, py, hot ? 21 : 16, 0, TAU);
    const ng = ctx.createRadialGradient(px - 4, py - 5, 1, px, py, hot ? 21 : 16);
    ng.addColorStop(0, alpha(col, hot ? 0.75 : 0.3));
    ng.addColorStop(1, '#090b22');
    ctx.fillStyle = ng;
    if (hot) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 16;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hot ? col : alpha(C.gold, 0.5);
    ctx.lineWidth = hot ? 2.6 : 1.3;
    ctx.stroke();
    glyph(ctx, el, px, py, hot ? 24 : 18, { width: 1.9, color: hot ? '#ffffff' : null, alpha: hot ? 1 : 0.85 });
  });
  text(ctx, 'BEATS', 0, 5, { size: 12, weight: 700, color: C.muted, display: true });
  ctx.restore();
}

// ---------------------------------------------------------------- the archer
export function drawArcher(ctx, x, y, t, { floating = true, pull = 0, scale = 1.2, tint = null, flip = false, aimDown = false } = {}) {
  // `tint` recolours every gold detail (the Rival is steel-violet); `flip` mirrors the figure;
  // `aimDown` points the bow at the player instead of at the field.
  const rim = tint ?? C.gold;
  const rimLight = tint ? '#e6dcff' : C.goldLight;
  const foilOf = (a, b, c, d) => tint ?? goldFoil(ctx, a, b, c, d);
  ctx.save();
  const lift = floating ? 26 + Math.sin(t * 1.4) * 4 : 0;
  // ground shadow: the gap under the platform is what "Unblemished" looks like
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + 22 * scale, (floating ? 64 : 92) * scale, (floating ? 8 : 12) * scale, 0, 0, TAU);
  ctx.fill();

  ctx.translate(x, y - lift);
  ctx.scale(scale, scale);
  if (flip) ctx.scale(-1, 1);

  if (floating) {
    const gl = ctx.createRadialGradient(0, 22, 4, 0, 22, 96);
    gl.addColorStop(0, alpha(rimLight, 0.4));
    gl.addColorStop(1, alpha(rim, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(-100, -20, 200, 120);
    // the tuning crystal that holds it up
    ctx.beginPath();
    ctx.moveTo(-10, 18);
    ctx.lineTo(10, 18);
    ctx.lineTo(0, 46 + Math.sin(t * 2.2) * 2);
    ctx.closePath();
    ctx.fillStyle = foilOf(-10, 18, 10, 46);
    ctx.fill();
  }

  // platform: a worked disc
  ctx.beginPath();
  ctx.ellipse(0, 10, 82, 15, 0, 0, TAU);
  const pg = ctx.createLinearGradient(0, -5, 0, 25);
  pg.addColorStop(0, '#2a2f6a');
  pg.addColorStop(1, '#0a0c24');
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = foilOf(-82, 0, 82, 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 8, 60, 9.5, 0, 0, TAU);
  ctx.lineWidth = 1;
  ctx.strokeStyle = alpha(rim, 0.5);
  ctx.stroke();

  // cloak and body: one dark silhouette with a gold rim
  const sway = Math.sin(t * 1.3) * 5;
  ctx.beginPath();
  ctx.moveTo(-11, -118);
  ctx.bezierCurveTo(-30, -84, -46 + sway, -36, -42 + sway, 4);
  ctx.quadraticCurveTo(-8, 10, 27, 4);
  ctx.bezierCurveTo(25, -40, 19, -82, 14, -116);
  ctx.closePath();
  const cg = ctx.createLinearGradient(-40, 0, 30, 0);
  cg.addColorStop(0, '#070920');
  cg.addColorStop(1, '#1b2050');
  ctx.fillStyle = cg;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(rim, 0.9);
  ctx.stroke();
  // folds
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = alpha(rim, 0.35);
  ctx.beginPath();
  ctx.moveTo(-4, -96);
  ctx.bezierCurveTo(-14, -60, -22 + sway * 0.6, -30, -20 + sway * 0.8, 2);
  ctx.moveTo(8, -92);
  ctx.bezierCurveTo(6, -60, 8, -30, 10, 4);
  ctx.stroke();

  // hood
  ctx.beginPath();
  ctx.moveTo(-13, -116);
  ctx.quadraticCurveTo(-30, -130, -14, -146);
  ctx.quadraticCurveTo(0, -158, 15, -144);
  ctx.quadraticCurveTo(22, -130, 14, -116);
  ctx.closePath();
  ctx.fillStyle = '#0c0f30';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(rim, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(5, -132, 8, 10, 0.15, 0, TAU);
  ctx.fillStyle = '#03040f';
  ctx.fill();

  // the bow, aimed up at the field
  const ang = aimDown ? 1.26 : -1.26;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const pxn = -dy;
  const pyn = dx;
  const sh = [9, -106];
  const grip = [sh[0] + dx * 42, sh[1] + dy * 42];
  const nock = [grip[0] - dx * (12 + pull * 38), grip[1] - dy * (12 + pull * 38)];
  const back = 16 + pull * 16;
  const tipA = [grip[0] + pxn * 60 - dx * back, grip[1] + pyn * 60 - dy * back];
  const tipB = [grip[0] - pxn * 60 - dx * back, grip[1] - pyn * 60 - dy * back];
  ctx.lineCap = 'round';
  // arms
  ctx.strokeStyle = '#141848';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(sh[0], sh[1]);
  ctx.lineTo(grip[0], grip[1]);
  ctx.moveTo(-4, -104);
  ctx.lineTo(nock[0], nock[1]);
  ctx.stroke();
  ctx.strokeStyle = alpha(rim, 0.85);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // limbs
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = foilOf(tipB[0], tipB[1], tipA[0], tipA[1]);
  ctx.beginPath();
  ctx.moveTo(tipA[0], tipA[1]);
  ctx.quadraticCurveTo(grip[0] + pxn * 40 + dx * 5, grip[1] + pyn * 40 + dy * 5, grip[0], grip[1]);
  ctx.quadraticCurveTo(grip[0] - pxn * 40 + dx * 5, grip[1] - pyn * 40 + dy * 5, tipB[0], tipB[1]);
  ctx.stroke();
  // string
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = alpha('#ffffff', 0.85);
  ctx.beginPath();
  ctx.moveTo(tipA[0], tipA[1]);
  ctx.lineTo(nock[0], nock[1]);
  ctx.lineTo(tipB[0], tipB[1]);
  ctx.stroke();
  // nocked arrow
  const head = [nock[0] + dx * 96, nock[1] + dy * 96];
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = rimLight;
  ctx.shadowColor = rim;
  ctx.shadowBlur = 6 + pull * 14;
  ctx.beginPath();
  ctx.moveTo(nock[0], nock[1]);
  ctx.lineTo(head[0], head[1]);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(head[0] + dx * 10, head[1] + dy * 10);
  ctx.lineTo(head[0] + pxn * 6, head[1] + pyn * 6);
  ctx.lineTo(head[0] - pxn * 6, head[1] - pyn * 6);
  ctx.closePath();
  ctx.fillStyle = rimLight;
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- buttons and panels
export function button(ctx, rect, label, { primary = false, danger = false, quiet = false, size = 26, disabled = false, sub = null, display = true } = {}) {
  const down = !disabled && isPressed(rect);
  ctx.save();
  if (disabled) ctx.globalAlpha *= 0.38;
  const r = Math.min(20, rect.h / 2);
  const oy = down ? 3 : 0;
  ctx.shadowColor = primary ? alpha(C.gold, 0.5) : 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = primary ? 24 : 14;
  ctx.shadowOffsetY = down ? 1 : 6;
  roundRect(ctx, rect.x, rect.y + oy, rect.w, rect.h, r);
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  if (primary) {
    g.addColorStop(0, C.goldLight);
    g.addColorStop(0.5, C.gold);
    g.addColorStop(1, C.goldDeep);
  } else if (danger) {
    g.addColorStop(0, 'rgba(92, 26, 48, 0.96)');
    g.addColorStop(1, 'rgba(30, 8, 20, 0.97)');
  } else {
    g.addColorStop(0, quiet ? 'rgba(22, 27, 62, 0.9)' : 'rgba(44, 52, 112, 0.96)');
    g.addColorStop(1, 'rgba(10, 13, 34, 0.97)');
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = primary ? 2 : 2.2;
  ctx.strokeStyle = primary ? '#fff3cf' : danger ? C.damage : quiet ? alpha(C.gold, 0.45) : goldFoil(ctx, rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  ctx.stroke();
  // top highlight
  ctx.save();
  roundRect(ctx, rect.x, rect.y + oy, rect.w, rect.h, r);
  ctx.clip();
  ctx.fillStyle = primary ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)';
  ctx.fillRect(rect.x, rect.y + oy, rect.w, rect.h * 0.42);
  if (down) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h + 4);
  }
  ctx.restore();
  const ink = primary ? '#231804' : C.ink;
  const cy = rect.y + oy + rect.h / 2;
  if (sub) {
    text(ctx, label, rect.x + rect.w / 2, cy - 1, { size, weight: 700, color: ink, display });
    text(ctx, sub, rect.x + rect.w / 2, cy + size * 0.82, { size: Math.max(14, size * 0.58), color: primary ? '#4a3510' : C.muted });
  } else text(ctx, label, rect.x + rect.w / 2, cy + size * 0.36, { size, weight: 700, color: ink, display });
  ctx.restore();
}

export function panel(ctx, rect, { edge = null, r = 24, hot = false, ornaments = true } = {}) {
  ctx.save();
  ctx.shadowColor = hot ? alpha(C.gold, 0.45) : 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = hot ? 30 : 26;
  ctx.shadowOffsetY = hot ? 0 : 8;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, r);
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  g.addColorStop(0, hot ? 'rgba(52, 60, 128, 0.97)' : C.panelTop);
  g.addColorStop(1, C.panelBottom);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = hot ? 2.6 : 1.8;
  ctx.strokeStyle = edge ?? (hot ? goldFoil(ctx, rect.x, rect.y, rect.x + rect.w, rect.y + rect.h) : C.panelEdge);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = alpha(C.gold, 0.16);
  roundRect(ctx, rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14, Math.max(4, r - 6));
  ctx.stroke();
  if (ornaments && rect.h > 90) {
    ctx.fillStyle = alpha(C.gold, 0.8);
    for (const [ox, oy] of [[18, 18], [rect.w - 18, 18], [18, rect.h - 18], [rect.w - 18, rect.h - 18]]) {
      diamond(ctx, rect.x + ox, rect.y + oy, 3.4);
      ctx.fill();
    }
  }
  ctx.restore();
}

// A thin ornamental rule with a diamond in the middle.
export function rule(ctx, x, y, w, color = C.gold) {
  ctx.save();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, alpha(color, 0));
  g.addColorStop(0.5, alpha(color, 0.9));
  g.addColorStop(1, alpha(color, 0));
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - 12, y);
  ctx.moveTo(x + 12, y);
  ctx.lineTo(x + w / 2, y);
  ctx.stroke();
  ctx.fillStyle = color;
  diamond(ctx, x, y, 5);
  ctx.fill();
  ctx.restore();
}

export { ELEMENT_NAMES, diamond };

// A soft ground shadow (light comes from the upper left, like the moon): things float above the
// ground, so they cast an ellipse below them that shrinks and fades as they rise.
export function contactShadow(ctx, x, y, rx, ry, a = 0.5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,8,${a})`);
  g.addColorStop(1, 'rgba(0,0,8,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// A real 3D crystal: a bipyramid turning about its vertical axis, seen slightly from above.
// Vertices are rotated and projected; faces facing away are skipped, the rest are painted
// back to front and shaded by a light from the upper left (the same side as the moon).
const GEM_LIGHT = (() => {
  const l = [-0.5, -0.62, 0.6];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();
function draw3dGem(ctx, sides, r, col, yaw) {
  const pitch = 0.42;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const rot = (px, py, pz) => {
    const x1 = px * Math.cos(yaw) + pz * Math.sin(yaw);
    const z1 = -px * Math.sin(yaw) + pz * Math.cos(yaw);
    return [x1, py * cp - z1 * sp, py * sp + z1 * cp];
  };
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (i * TAU) / sides;
    ring.push(rot(Math.cos(a) * r * 0.92, 0, Math.sin(a) * r * 0.92));
  }
  const top = rot(0, -r * 0.98, 0);
  const bot = rot(0, r * 0.98, 0);
  const faces = [];
  for (let i = 0; i < sides; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % sides];
    for (const apex of [top, bot]) {
      const ux = p[0] - apex[0], uy = p[1] - apex[1], uz = p[2] - apex[2];
      const vx = q[0] - apex[0], vy = q[1] - apex[1], vz = q[2] - apex[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      // outward normal: away from the centre
      const cx = (p[0] + q[0] + apex[0]) / 3, cy = (p[1] + q[1] + apex[1]) / 3, cz = (p[2] + q[2] + apex[2]) / 3;
      if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      if (nz <= 0) continue;
      faces.push({ tri: [apex, p, q], z: cz, lit: Math.max(0, nx * GEM_LIGHT[0] + ny * GEM_LIGHT[1] + nz * GEM_LIGHT[2]) });
    }
  }
  faces.sort((f, g) => f.z - g.z);
  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur = 0;
  ctx.lineJoin = 'round';
  for (const f of faces) {
    ctx.beginPath();
    ctx.moveTo(f.tri[0][0], f.tri[0][1]);
    ctx.lineTo(f.tri[1][0], f.tri[1][1]);
    ctx.lineTo(f.tri[2][0], f.tri[2][1]);
    ctx.closePath();
    ctx.fillStyle = '#0a0d26';
    ctx.fill();
    ctx.fillStyle = alpha(col, 0.14 + f.lit * 0.62);
    ctx.fill();
    if (f.lit > 0.82) {
      ctx.fillStyle = alpha('#ffffff', (f.lit - 0.82) * 1.6);
      ctx.fill();
    }
    ctx.strokeStyle = alpha(col, 0.85);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}
