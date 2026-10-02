// Drawing helpers: lacquer background, carved blocks, panels, buttons, icons. Plain canvas 2D; nothing
// here changes game state. Palette: black-red lacquer, antique gold, jade, ivory.

export const W = 720, H = 1560;
export const UI = '-apple-system, "SF Pro Text", "PingFang SC", "Noto Sans SC", "Segoe UI", Roboto, system-ui, sans-serif';
export const DISPLAY = '"Songti SC", "Noto Serif SC", "STSong", "Palatino Linotype", Georgia, "Times New Roman", serif';
export const CARVE = '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", "Songti SC", "STSong", Georgia, serif';

export const GOLD = '#e4bd68';
export const GOLD_HI = '#fbe6a6';
export const GOLD_LO = '#b2842f';
export const PAPER = '#f6ead2';
export const INK = '#140808';
export const LACQUER = '#2a0e0e';

// block colours by role (the five generals, the Commander, the soldiers)
export const BLOCK = {
  C: { base: '#c7372c', ink: '#ffe7a8' },
  guan: { base: '#2c8a6a', ink: '#f4ecc9' },
  zhang: { base: '#33397a', ink: '#f2e3b0' },
  zhao: { base: '#d7cdb2', ink: '#5a1f1a' },
  ma: { base: '#c98a2b', ink: '#3a1a0a' },
  huang: { base: '#85386a', ink: '#f7e2b8' },
  S: { base: '#4b3128', ink: '#e4bd68' },
};
// Which script the block faces carry: 'en' engraves the English names, 'zh' the carved characters.
let BLOCK_LANG = 'en';
export const setBlockLang = (l) => { BLOCK_LANG = l === 'zh' ? 'zh' : 'en'; };
export const blockColors = (p) => {
  if (p.t === 'C') return BLOCK.C;
  if (p.t === 'S') return BLOCK.S;
  return { 关羽: BLOCK.guan, 张飞: BLOCK.zhang, 赵云: BLOCK.zhao, 马超: BLOCK.ma, 黄忠: BLOCK.huang }[p.name.zh];
};

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

// ---- background: lacquer, lattice window, drifting embers ---------------------------------------------------
const EMBERS = Array.from({ length: 26 }, (_, i) => [((i * 137) % 719) + 1, ((i * 89) % 1500) + 20, 0.5 + ((i * 31) % 9) / 9, 6 + ((i * 17) % 11)]);

function lattice(ctx, a) {
  // a square window lattice with a small diamond at every crossing
  ctx.strokeStyle = `rgba(228,189,104,${a})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 90) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 90) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.fillStyle = `rgba(228,189,104,${a * 1.6})`;
  for (let x = 0; x <= W; x += 90) {
    for (let y = 0; y <= H; y += 90) {
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
    }
  }
}

function cloudCorner(ctx, x, y, s, flipX, flipY) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.strokeStyle = 'rgba(228,189,104,0.2)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 150 * s); ctx.bezierCurveTo(0, 60 * s, 50 * s, 0, 150 * s, 0);
  ctx.moveTo(0, 100 * s); ctx.bezierCurveTo(0, 50 * s, 40 * s, 14 * s, 100 * s, 14 * s);
  ctx.moveTo(14 * s, 62 * s); ctx.bezierCurveTo(14 * s, 34 * s, 30 * s, 22 * s, 56 * s, 22 * s);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(34 * s, 34 * s, 7 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export function background(ctx, t, glowY = 640) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0f0606');
  g.addColorStop(0.35, '#220a0b');
  g.addColorStop(0.75, '#31100e');
  g.addColorStop(1, '#190807');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  lattice(ctx, 0.05);
  const rg = ctx.createRadialGradient(W / 2, glowY, 60, W / 2, glowY, 620);
  rg.addColorStop(0, 'rgba(200,60,40,0.30)');
  rg.addColorStop(0.5, 'rgba(120,30,24,0.12)');
  rg.addColorStop(1, 'rgba(120,30,24,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  cloudCorner(ctx, 0, 0, 1, false, false); cloudCorner(ctx, W, 0, 1, true, false);
  cloudCorner(ctx, 0, H, 1, false, true); cloudCorner(ctx, W, H, 1, true, true);
  for (const [x, y0, s, sp] of EMBERS) {
    const y = ((y0 - t * sp * 3) % H + H) % H;
    const xx = x + Math.sin(t * 0.5 + y0) * 10;
    ctx.fillStyle = `rgba(255,205,120,${0.1 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.3 + x)) * s * 0.7})`;
    ctx.beginPath(); ctx.arc(xx, y, 1.6 + s, 0, Math.PI * 2); ctx.fill();
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, 560, W / 2, H / 2, 1020);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = o.blur ?? 28; ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, o.top ?? 'rgba(44,16,16,0.95)');
  g.addColorStop(1, o.bottom ?? 'rgba(26,9,9,0.97)');
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, o.r ?? 26); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = o.stroke ?? 'rgba(228,189,104,0.6)';
  ctx.lineWidth = o.lw ?? 2;
  rr(ctx, x, y, w, h, o.r ?? 26); ctx.stroke();
  if (o.inner !== false) {
    ctx.strokeStyle = 'rgba(228,189,104,0.14)';
    ctx.lineWidth = 1;
    rr(ctx, x + 7, y + 7, w - 14, h - 14, (o.r ?? 26) - 6); ctx.stroke();
  }
}

// kind: primary | normal | on | danger | ghost. Flat fills, one thin border, no inner gloss shape.
export function button(ctx, r, lines, kind = 'normal', o = {}) {
  ctx.save();
  if (o.disabled) ctx.globalAlpha = 0.4;
  const press = o.pressed ? 1 : 0;
  const y = r.y + press * 3;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = press ? 4 : 14; ctx.shadowOffsetY = press ? 1 : 5;
  const g = ctx.createLinearGradient(0, y, 0, y + r.h);
  if (kind === 'primary') { g.addColorStop(0, '#ecc874'); g.addColorStop(1, '#d4a549'); }
  else if (kind === 'on') { g.addColorStop(0, '#2f9776'); g.addColorStop(1, '#1f6a55'); }
  else if (kind === 'danger') { g.addColorStop(0, '#b8392d'); g.addColorStop(1, '#7c231f'); }
  else if (kind === 'ghost') { g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0.02)'); }
  else { g.addColorStop(0, '#4c1a19'); g.addColorStop(1, '#3a1212'); }
  ctx.fillStyle = g;
  rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = kind === 'primary' ? 'rgba(255,238,184,0.9)' : 'rgba(228,189,104,0.5)';
  ctx.lineWidth = 1.5;
  rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.stroke();
  if (press) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(ctx, r.x, y, r.w, r.h, o.radius ?? 18); ctx.fill(); }
  const color = kind === 'primary' ? '#3a1a0a' : PAPER;
  const size = o.size ?? 28;
  const line = o.line ?? size * 1.22;
  const subs = o.sub ?? [];
  const total = lines.length * line + (subs.length ? subs.length * size * 0.78 + 4 : 0);
  let ty = y + (r.h - total) / 2 + size * 0.9;
  for (const ln of lines) { text(ctx, ln, r.x + r.w / 2, ty, size, color, { weight: 700 }); ty += line; }
  for (const ln of subs) { ty += size * 0.04; text(ctx, ln, r.x + r.w / 2, ty, size * 0.62, kind === 'primary' ? '#5e3a17' : 'rgba(246,234,210,0.72)', { weight: 500 }); ty += size * 0.78; }
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

// ---- carved lacquer block ---------------------------------------------------------------------------------------
// r is the block's full cell rectangle; the block is drawn a little inside it so neighbours never touch.
export function drawBlock(ctx, r, p, o = {}) {
  const col = blockColors(p);
  const lift = o.lift ?? 0;
  const gap = 5;
  const sc = o.scale ?? 1;
  const x = r.x + gap, y = r.y + gap, w = r.w - gap * 2, h = r.h - gap * 2;
  const rad = p.t === 'S' ? 18 : 22;
  ctx.save();
  if (sc !== 1 || o.dx || o.dy) {
    ctx.translate(r.x + r.w / 2 + (o.dx ?? 0), r.y + r.h / 2 + (o.dy ?? 0)); ctx.scale(sc, sc); ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  }
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.shadowColor = `rgba(0,0,0,${0.42 + 0.2 * lift})`;
  ctx.shadowBlur = 8 + 22 * lift; ctx.shadowOffsetY = 4 + 14 * lift;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, light(col.base, 0.18));
  g.addColorStop(0.5, col.base);
  g.addColorStop(1, dark(col.base, 0.3));
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, rad); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // outer rim
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = p.t === 'C' ? GOLD_HI : 'rgba(255,226,160,0.75)';
  rr(ctx, x, y, w, h, rad); ctx.stroke();
  // carved inner frame
  const ins = p.t === 'S' ? 12 : 14;
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = alpha(col.ink, 0.5);
  rr(ctx, x + ins, y + ins, w - ins * 2, h - ins * 2, Math.max(6, rad - ins + 4)); ctx.stroke();
  if (p.t === 'C') {
    ctx.strokeStyle = alpha(col.ink, 0.28);
    rr(ctx, x + ins + 7, y + ins + 7, w - (ins + 7) * 2, h - (ins + 7) * 2, 10); ctx.stroke();
    ctx.fillStyle = alpha(col.ink, 0.7);
    for (const [cx, cy] of [[x + ins, y + ins], [x + w - ins, y + ins], [x + ins, y + h - ins], [x + w - ins, y + h - ins]]) { ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill(); }
  }
  const cx = x + w / 2, cy = y + h / 2;
  const flat = (str, tx, ty, size, font, weight) => text(ctx, str, tx, ty, size, col.ink, { font, weight });
  const engrave = (str, tx, ty, size, font, weight) => {
    text(ctx, str, tx + 2, ty + 3, size, 'rgba(0,0,0,0.5)', { font, weight });
    text(ctx, str, tx - 1, ty - 1, size, 'rgba(255,255,255,0.18)', { font, weight });
    text(ctx, str, tx, ty, size, col.ink, { font, weight });
  };
  if (BLOCK_LANG === 'en') {
    // English names: one flat, crisp pass (no shadow or highlight copy), one word per line, fitted to the block's inner frame
    const words = (p.name.en ?? p.name.zh).split(' ');
    const lines = p.t === 'C' ? words : words.length > 1 ? words : [words[0]];
    const availW = w - (ins + 8) * 2, availH = h - (ins + 6) * 2;
    ctx.font = `900 100px ${DISPLAY}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width)) / 100;
    const cap = p.t === 'C' ? 92 : p.t === 'S' ? 40 : p.t === 'V' ? 62 : 56;
    const size = Math.min(cap, availW / widest, availH / (lines.length * 1.08));
    const lh = size * 1.08;
    lines.forEach((l, i) => flat(l, cx, cy + (i - (lines.length - 1) / 2) * lh + size * 0.34, size, DISPLAY, 900));
  } else {
    const chars = [...p.name.zh];
    let size, pos;
    if (p.t === 'C') { size = 118; pos = chars.map((c, i) => [cx + (i - 0.5) * size * 1.0, cy + size * 0.34, c]); }
    else if (p.t === 'V') { size = 84; pos = chars.map((c, i) => [cx, cy + (i - 0.5) * size * 1.06 + size * 0.34, c]); }
    else if (p.t === 'H') { size = 84; pos = chars.map((c, i) => [cx + (i - 0.5) * size * 1.0, cy + size * 0.34, c]); }
    else { size = 84; pos = [[cx, cy + size * 0.34, chars[0]]]; }
    for (const [tx, ty, c] of pos) engrave(c, tx, ty, size, CARVE, 900);
  }
  if (o.glow) {
    ctx.strokeStyle = `rgba(255,236,160,${0.95 * o.glow})`;
    ctx.lineWidth = 4;
    ctx.shadowColor = `rgba(255,224,130,${0.9 * o.glow})`; ctx.shadowBlur = 18;
    rr(ctx, x, y, w, h, rad); ctx.stroke();
  }
  ctx.restore();
}

// ---- icons (centered at x,y, size s) -------------------------------------------------------------------------------
export function icon(ctx, name, x, y, s, color = PAPER) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s / 2;
  if (name === 'undo') {
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
  } else if (name === 'minus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
  } else if (name === 'plus') {
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke();
  } else if (name === 'lock') {
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.38, Math.PI, 0); ctx.stroke();
    rr(ctx, -r * 0.6, -r * 0.2, r * 1.2, r * 0.95, 5); ctx.fill();
  } else if (name === 'arrow') {
    ctx.beginPath(); ctx.moveTo(-r * 0.7, 0); ctx.lineTo(r * 0.7, 0); ctx.moveTo(r * 0.2, -r * 0.5); ctx.lineTo(r * 0.7, 0); ctx.lineTo(r * 0.2, r * 0.5); ctx.stroke();
  }
  ctx.restore();
}

// Sparks / confetti drawn from puzzle particles
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
