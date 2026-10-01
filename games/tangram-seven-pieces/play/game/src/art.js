// Drawing helpers: background, lacquered pieces, silhouette cut-out, panels, buttons, icons.
// Everything is plain canvas 2D; nothing here changes game state.

export const W = 720, H = 1560;
export const UI = '-apple-system, "SF Pro Text", "PingFang SC", "Noto Sans SC", "Segoe UI", Roboto, system-ui, sans-serif';
export const DISPLAY = '"Songti SC", "Noto Serif SC", "STSong", "Palatino Linotype", Georgia, "Times New Roman", serif';

export const PIECE_COLORS = ['#cf3f36', '#2f84c6', '#34a367', '#e8ae2e', '#8758cc', '#e5659a', '#27b3ac'];
export const GOLD = '#e8c46a';
export const PAPER = '#f4ead3';
export const INK = '#0e1127';

const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function mix(h, o, t) {
  const a = hexRgb(h), b = hexRgb(o);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
export const light = (h, t) => mix(h, '#ffffff', t);
export const dark = (h, t) => mix(h, '#000000', t);
export const alpha = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function text(ctx, str, x, y, size, color = PAPER, o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur ?? 6; ctx.shadowOffsetY = o.dy ?? 2; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  if (o.shadow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
}

export function polyPath(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// ---- background: ink-wash mountains under a pale moon ------------------------------------------------
const STARS = Array.from({ length: 46 }, (_, i) => [((i * 97) % 211) / 211 * W, ((i * 53) % 173) / 173 * 620, 0.6 + ((i * 31) % 7) / 7]);

export function background(ctx, t, mood = 0, moon = [590, 170]) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0e24');
  g.addColorStop(0.45, '#1d1a45');
  g.addColorStop(0.8, '#34254d');
  g.addColorStop(1, '#46304f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, s] of STARS) {
    ctx.fillStyle = `rgba(255,240,210,${0.18 + 0.2 * Math.sin(t * 0.8 + x) * s + 0.12})`;
    ctx.fillRect(x, y, 2.2, 2.2);
  }
  // moon
  const mg = ctx.createRadialGradient(moon[0], moon[1], 10, moon[0], moon[1], 170);
  mg.addColorStop(0, 'rgba(255,236,190,0.55)');
  mg.addColorStop(0.3, 'rgba(255,214,150,0.16)');
  mg.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(moon[0] - 230, moon[1] - 190, 460, 400);
  ctx.fillStyle = 'rgba(255,238,200,0.9)';
  ctx.beginPath(); ctx.arc(moon[0], moon[1], 40, 0, Math.PI * 2); ctx.fill();
  // far-to-near mountain ridges
  const layers = [
    { base: 1000, amp: 160, col: 'rgba(63,48,92,0.55)', f: 0.011, sp: 0.04 },
    { base: 1130, amp: 130, col: 'rgba(40,32,74,0.7)', f: 0.016, sp: 0.07 },
    { base: 1280, amp: 110, col: 'rgba(24,20,52,0.85)', f: 0.021, sp: 0.1 },
  ];
  layers.forEach((L, li) => {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) {
      const y = L.base - L.amp * (0.5 + 0.5 * Math.sin(x * L.f + li * 2.1 + t * L.sp * 0)) * (0.55 + 0.45 * Math.sin(x * L.f * 2.3 + li));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = L.col;
    ctx.fill();
  });
  // drifting mist
  for (let i = 0; i < 3; i++) {
    const x = ((t * (8 + i * 5) + i * 300) % (W + 500)) - 250;
    const y = 880 + i * 150;
    const mg2 = ctx.createRadialGradient(x, y, 10, x, y, 260);
    mg2.addColorStop(0, 'rgba(200,190,230,0.09)');
    mg2.addColorStop(1, 'rgba(200,190,230,0)');
    ctx.fillStyle = mg2;
    ctx.fillRect(x - 260, y - 90, 520, 180);
  }
  void mood;
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, 520, W / 2, H / 2, 1000);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.blur ?? 28; ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, o.top ?? 'rgba(34,30,66,0.94)');
  g.addColorStop(1, o.bottom ?? 'rgba(20,18,44,0.96)');
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, o.r ?? 26); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = o.stroke ?? 'rgba(232,196,106,0.55)';
  ctx.lineWidth = o.lw ?? 2;
  rr(ctx, x, y, w, h, o.r ?? 26); ctx.stroke();
  if (o.inner === true) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    rr(ctx, x + 6, y + 6, w - 12, h - 12, (o.r ?? 26) - 5); ctx.stroke();
  }
}

// kind: primary | normal | on | danger | ghost
export function button(ctx, r, lines, kind = 'normal', o = {}) {
  ctx.save();
  if (o.disabled) ctx.globalAlpha = 0.38;
  const press = o.pressed ? 1 : 0;
  const y = r.y + press * 3;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = press ? 4 : 14; ctx.shadowOffsetY = press ? 1 : 5;
  const g = ctx.createLinearGradient(0, y, 0, y + r.h);
  if (kind === 'primary') { g.addColorStop(0, '#f2cf72'); g.addColorStop(1, '#d9a443'); }
  else if (kind === 'on') { g.addColorStop(0, '#3fb596'); g.addColorStop(1, '#217a68'); }
  else if (kind === 'danger') { g.addColorStop(0, '#d65a4c'); g.addColorStop(1, '#8e2b27'); }
  else if (kind === 'ghost') { g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0.02)'); }
  else { g.addColorStop(0, '#3c3777'); g.addColorStop(1, '#2d2961'); }
  ctx.fillStyle = g;
  rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = kind === 'primary' ? 'rgba(255,236,170,0.85)' : 'rgba(232,196,106,0.45)';
  ctx.lineWidth = 1.5;
  rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.stroke();
  if (press) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.fill(); }
  const color = kind === 'primary' ? '#3a2410' : PAPER;
  const size = o.size ?? 28;
  const line = o.line ?? size * 1.22;
  const subs = o.sub ?? [];
  const total = lines.length * line + (subs.length ? subs.length * size * 0.78 + 4 : 0);
  let ty = y + (r.h - total) / 2 + size * 0.9;
  for (const ln of lines) { text(ctx, ln, r.x + r.w / 2, ty, size, color, { weight: 700 }); ty += line; }
  for (const ln of subs) { ty += size * 0.04; text(ctx, ln, r.x + r.w / 2, ty, size * 0.62, kind === 'primary' ? '#5a3c1a' : 'rgba(244,234,211,0.7)', { weight: 500 }); ty += size * 0.78; }
  ctx.restore();
}

export function star(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.46 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

// ---- lacquered piece ---------------------------------------------------------------------------------------
export function pieceCentre(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

export function drawPiece(ctx, poly, kind, o = {}) {
  const col = PIECE_COLORS[kind];
  const lift = o.lift ?? 0;
  ctx.save();
  const sx = o.sx ?? o.scale ?? 1, sy = o.sy ?? o.scale ?? 1;
  if (sx !== 1 || sy !== 1) {
    const [cx, cy] = pieceCentre(poly);
    ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-cx, -cy);
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (!o.noShadow) {
    ctx.shadowColor = `rgba(0,0,0,${0.32 + 0.22 * lift})`;
    ctx.shadowBlur = 7 + 24 * lift;
    ctx.shadowOffsetY = 3 + 15 * lift;
  }
  const g = ctx.createLinearGradient(minX, minY, maxX, maxY);
  g.addColorStop(0, light(col, 0.28));
  g.addColorStop(0.55, col);
  g.addColorStop(1, dark(col, 0.28));
  polyPath(ctx, poly);
  ctx.fillStyle = o.flat ? col : g;
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (!o.flat) {
    ctx.save();
    polyPath(ctx, poly); ctx.clip();
    // bevel: light rim top-left, dark rim bottom-right
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.translate(-2, -2); polyPath(ctx, poly); ctx.stroke(); ctx.translate(2, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.translate(3, 3); polyPath(ctx, poly); ctx.stroke(); ctx.translate(-3, -3);
    // gloss
    const gl = ctx.createLinearGradient(minX, minY, minX + (maxX - minX) * 0.5, minY + (maxY - minY) * 0.9);
    gl.addColorStop(0, 'rgba(255,255,255,0.34)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
    ctx.restore();
  }
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = o.edge ?? 'rgba(255,232,170,0.7)';
  ctx.lineWidth = o.edgeW ?? 1.6;
  polyPath(ctx, poly); ctx.stroke();
  if (o.glow) {
    ctx.strokeStyle = `rgba(255,236,160,${0.9 * o.glow})`;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = `rgba(255,224,130,${0.9 * o.glow})`; ctx.shadowBlur = 16;
    polyPath(ctx, poly); ctx.stroke();
  }
  ctx.restore();
}

// ---- silhouette cut-out --------------------------------------------------------------------------------------
export function outlinePath(ctx, loopsPx) {
  ctx.beginPath();
  for (const loop of loopsPx) {
    loop.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
}

export function drawCutout(ctx, loopsPx, o = {}) {
  ctx.save();
  // soft gold halo outside the cut-out
  ctx.shadowColor = `rgba(232,196,106,${o.halo ?? 0.35})`; ctx.shadowBlur = 22;
  outlinePath(ctx, loopsPx);
  ctx.fillStyle = '#05060f';
  ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, o.top ?? 150, 0, o.bottom ?? 850);
  g.addColorStop(0, '#171a36'); g.addColorStop(1, '#0a0c1d');
  outlinePath(ctx, loopsPx);
  ctx.fillStyle = g; ctx.fill();
  // inner shadow
  ctx.save();
  outlinePath(ctx, loopsPx); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 26; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  outlinePath(ctx, loopsPx); ctx.stroke();
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(232,196,106,${o.rim ?? 0.75})`; ctx.lineWidth = 2.4;
  outlinePath(ctx, loopsPx); ctx.stroke();
  ctx.restore();
}

// ---- icons (centered at x,y, size s) -----------------------------------------------------------------------------
export function icon(ctx, name, x, y, s, color = PAPER) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s / 2;
  const arrowHead = (px, py, ang) => {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang + 2.5) * s * 0.28, py + Math.sin(ang + 2.5) * s * 0.28);
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang - 2.5) * s * 0.28, py + Math.sin(ang - 2.5) * s * 0.28);
    ctx.stroke();
  };
  const arcArrow = (R, a0, a1) => {
    ctx.beginPath(); ctx.arc(0, 0, R, a0, a1, a1 < a0); ctx.stroke();
    const dir = a1 > a0 ? 1 : -1;
    const tipx = Math.cos(a1) * R, tipy = Math.sin(a1) * R;
    const tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, nx = Math.cos(a1), ny = Math.sin(a1);
    const L = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(tipx + tx * L * 1.1, tipy + ty * L * 1.1);
    ctx.lineTo(tipx + nx * L * 0.85, tipy + ny * L * 0.85);
    ctx.lineTo(tipx - nx * L * 0.85, tipy - ny * L * 0.85);
    ctx.closePath(); ctx.fill();
  };
  if (name === 'rotR' || name === 'handle') {
    arcArrow(r * 0.62, -2.5, 0.75);
  } else if (name === 'rotL') {
    arcArrow(r * 0.62, -0.64, -3.89);
  } else if (name === 'flip') {
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.55); ctx.lineTo(-r * 0.85, r * 0.6); ctx.lineTo(-r * 0.2, r * 0.6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.55); ctx.lineTo(r * 0.85, r * 0.6); ctx.lineTo(r * 0.2, r * 0.6); ctx.closePath(); ctx.stroke();
  } else if (name === 'undo') {
    ctx.beginPath(); ctx.arc(r * 0.05, r * 0.1, r * 0.62, Math.PI * 1.15, Math.PI * 2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.72, -r * 0.15); ctx.lineTo(-r * 0.48, -r * 0.62); ctx.moveTo(-r * 0.72, -r * 0.15); ctx.lineTo(-r * 0.16, -r * 0.1); ctx.stroke();
  } else if (name === 'hint') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.28, r * 0.52); ctx.lineTo(r * 0.28, r * 0.52); ctx.moveTo(-r * 0.2, r * 0.8); ctx.lineTo(r * 0.2, r * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, -r * 0.05); ctx.stroke();
  } else if (name === 'reset') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, Math.PI * 0.3, Math.PI * 2.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.78, -r * 0.55); ctx.lineTo(r * 0.78, -r * 0.05); ctx.lineTo(r * 0.28, -r * 0.1); ctx.stroke();
  } else if (name === 'pause') {
    ctx.fillRect(-r * 0.5, -r * 0.62, r * 0.36, r * 1.24); ctx.fillRect(r * 0.14, -r * 0.62, r * 0.36, r * 1.24);
  } else if (name === 'play') {
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.65); ctx.lineTo(r * 0.7, 0); ctx.lineTo(-r * 0.4, r * 0.65); ctx.closePath(); ctx.fill();
  } else if (name === 'back') {
    ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.7); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(r * 0.45, r * 0.7); ctx.stroke();
  } else if (name === 'menu') {
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.65, i * r * 0.5); ctx.lineTo(r * 0.65, i * r * 0.5); ctx.stroke(); }
  } else if (name === 'minus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
  } else if (name === 'plus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke();
  } else if (name === 'lock') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.38, Math.PI, 0); ctx.stroke();
    rr(ctx, -r * 0.6, -r * 0.2, r * 1.2, r * 0.95, 5); ctx.fill();
  }
  ctx.restore();
}

// Confetti / sparks drawn from puzzle particles
export function drawParticles(ctx, parts) {
  for (const q of parts) {
    const a = Math.max(0, Math.min(1, q.life / (q.max * 0.6)));
    ctx.globalAlpha = a;
    ctx.fillStyle = q.color;
    if (q.shape === 'petal') {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, q.size * 1.3, q.size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (q.shape === 'tile') {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.fillRect(-q.size, -q.size * 0.6, q.size * 2, q.size * 1.2);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
