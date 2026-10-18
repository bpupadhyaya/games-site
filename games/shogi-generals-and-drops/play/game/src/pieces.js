// The koma (pieces): pentagonal boxwood wedges with the piece character in ink (vermilion when promoted).
// Each piece is painted ONCE into a cached sprite (never per frame). Light comes from the upper left, for both
// sides: the opponent's pieces are turned round, but their shading is not.
export const MASTER = { w: 120, h: 134, pad: 16 };
const TAU = Math.PI * 2;
export const JP = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
const LATIN = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
// Western piece letters (P L N S G B R K, +P/+L/+N/+S/+B/+R promoted): the same set already used by the
// "Western letters on pieces" helper overlay, reused here as the PRIMARY glyph for "Play (English)" mode.
const LETTER = ['', 'P', 'L', 'N', 'S', 'G', 'B', 'R', 'K', '+P', '+L', '+N', '+S', '', '+B', '+R'];

const KANJI = ['', '歩', '香', '桂', '銀', '金', '角', '飛', '玉', 'と', '杏', '圭', '全', '', '馬', '龍'];
const SIZE = [0, 0.84, 0.88, 0.91, 0.94, 0.94, 0.97, 0.97, 1.0];
export const kanjiOf = (t, side) => (t === 8 && side === 1 ? '王' : KANJI[t]);
export const sizeOf = (t) => SIZE[t >= 9 ? t - 8 : t] || 1;

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// Outline of the wedge, centred on (0,0), turned by `rot`. Returns points [x,y].
function wedgePts(w, h, rot) {
  const p = [[0, -h / 2], [w * 0.41, -h * 0.2], [w * 0.5, h / 2], [-w * 0.5, h / 2], [-w * 0.41, -h * 0.2]];
  return rot ? p.map(([x, y]) => [-x, -y]) : p;
}
function tracePath(ctx, pts, r) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const rr = Math.min(r, d1 / 2.2, d2 / 2.2);
    const p1 = [b[0] + (a[0] - b[0]) * rr / d1, b[1] + (a[1] - b[1]) * rr / d1], p2 = [b[0] + (c[0] - b[0]) * rr / d2, b[1] + (c[1] - b[1]) * rr / d2];
    if (i === 0) ctx.moveTo(p1[0], p1[1]); else ctx.lineTo(p1[0], p1[1]);
    ctx.quadraticCurveTo(b[0], b[1], p2[0], p2[1]);
  }
  ctx.closePath();
}

export function paintPiece(ctx, t, side, rot, label, lang = 'jp') {
  const f = sizeOf(t), w = MASTER.w * f, h = MASTER.h * f, cx = MASTER.w / 2 + MASTER.pad, cy = MASTER.h / 2 + MASTER.pad - 2;
  const pts = wedgePts(w, h, rot).map(([x, y]) => [x + cx, y + cy]);
  const promoted = t >= 9;
  // shadow + body
  ctx.save();
  ctx.shadowColor = 'rgba(20,8,0,0.5)'; ctx.shadowBlur = 11; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 8;
  tracePath(ctx, pts, 9); ctx.fillStyle = '#e3c07c'; ctx.fill();
  ctx.restore();
  const gr = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  gr.addColorStop(0, '#f8e6b8'); gr.addColorStop(0.45, '#efd39a'); gr.addColorStop(1, '#d6aa63');
  tracePath(ctx, pts, 9); ctx.fillStyle = gr; ctx.fill();
  // grain, clipped to the piece
  ctx.save(); tracePath(ctx, pts, 9); ctx.clip();
  const rnd = lcg(t * 977 + rot * 31 + 5);
  for (let i = 0; i < 9; i++) {
    const x0 = cx - w / 2 + rnd() * w, wob = (rnd() - 0.5) * 9;
    ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '130,86,32' : '255,246,215'},${0.07 + rnd() * 0.1})`; ctx.lineWidth = 0.8 + rnd() * 1.6;
    ctx.beginPath(); ctx.moveTo(x0, cy - h / 2); ctx.bezierCurveTo(x0 + wob, cy - h / 6, x0 - wob, cy + h / 6, x0 + wob * 0.4, cy + h / 2); ctx.stroke();
  }
  // bevel: light on the upper left edges, shade on the lower right
  ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(-2.6, -2.6); tracePath(ctx, pts, 9); ctx.strokeStyle = 'rgba(255,251,232,0.75)'; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(3, 3.4); tracePath(ctx, pts, 9); ctx.strokeStyle = 'rgba(96,56,12,0.5)'; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
  ctx.restore();
  tracePath(ctx, pts, 9); ctx.strokeStyle = '#5b3c16'; ctx.lineWidth = 2.6; ctx.stroke();
  // the engraved inner outline
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.83, cy + (y - cy) * 0.83 + (rot ? -2 : 2)]);
  tracePath(ctx, inner, 6); ctx.strokeStyle = 'rgba(90,58,18,0.28)'; ctx.lineWidth = 1.6; ctx.stroke();
  // the character: "Play (日本語)" shows the true kanji (as always); "Play (English)" shows the Western letter
  // (P L N S G B R K, +P/+L/+N/+S/+B/+R promoted) as the PRIMARY glyph instead, so the piece is fully readable
  // without kanji. The small helper overlay ("Western letters on pieces") only applies in 日本語 mode.
  const en = lang === 'en', ch = en ? LETTER[t] : kanjiOf(t, side), wide = en && ch.length > 1;
  const fs = (en ? 60 : 66) * Math.min(1.04, f + 0.06) * (wide ? 0.6 : 1), ink = promoted ? '#b0211a' : '#1d1509';
  ctx.save();
  // Kanji reads fine upside down (the traditional physical-piece convention: the opponent's pieces are turned
  // round). Latin letters do not — a rotated "R" or "G" stops looking like the letter — so in English mode the
  // wedge still turns to face the opponent, but the letter itself stays upright and readable.
  ctx.translate(cx, cy + (rot ? -1 : 1) * h * 0.075); if (rot && !en) ctx.rotate(Math.PI);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${fs}px ${en ? LATIN : JP}`;
  ctx.fillStyle = 'rgba(255,247,222,0.75)'; ctx.fillText(ch, 1.6, 2.2);
  ctx.fillStyle = ink; ctx.fillText(ch, 0, 0);
  if (label && !en) {
    ctx.font = '700 22px "Cormorant Garamond", Georgia, serif'; ctx.fillStyle = 'rgba(70,42,12,0.75)';
    ctx.fillText(label, 0, h * 0.40);
  }
  ctx.restore();
}

const cache = new Map();
let ready = false, frames = 0;
export function fontReady(ctx) {
  if (ready) return true;
  frames++;
  ctx.font = '700 40px "Noto Serif JP", monospace'; const a = ctx.measureText('0123').width;
  ctx.font = '700 40px monospace'; const b = ctx.measureText('0123').width;
  if (a !== b || frames > 300) ready = true;      // (in headless tests both widths match: fall back after a while)
  return ready;
}
const gen = () => (ready ? 1 : 0);
export function spriteOf(t, side, rot, label, lang = 'jp') {
  const key = `${gen()}|${t}|${side}|${rot}|${label || ''}|${lang}`;
  let s = cache.get(key);
  if (s === undefined) {
    s = null;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const c = new OffscreenCanvas(MASTER.w + MASTER.pad * 2, MASTER.h + MASTER.pad * 2 + 8), cctx = c.getContext('2d');
        paintPiece(cctx, t, side, rot, label, lang); s = c;
      }
    } catch { s = null; }
    cache.set(key, s);
  }
  return s;
}
// Draw a piece centred at (x,y). side = owner (0/1, picks the king's character); rot = 1 when it points down the
// screen (the opponent's). s = scale of the master; opts: alpha, label, lang ('jp' kanji primary, 'en' Western
// letter primary).
export function drawPiece(ctx, t, side, rot, x, y, s, opts = {}) {
  const spr = spriteOf(t, side, rot, opts.label, opts.lang);
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (spr) {
    const cxm = MASTER.w / 2 + MASTER.pad, cym = MASTER.h / 2 + MASTER.pad - 2;
    ctx.drawImage(spr, x - cxm * s, y - cym * s, spr.width * s, spr.height * s);
  } else {
    const w = MASTER.w * sizeOf(t) * s, h = MASTER.h * sizeOf(t) * s;      // no offscreen canvas (headless): a plain wedge
    ctx.fillStyle = '#e8c98a'; ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w * 0.45, y + h / 2); ctx.lineTo(x - w * 0.45, y + h / 2); ctx.closePath(); ctx.fill();
  }
  if (opts.alpha !== undefined) ctx.globalAlpha = 1;
}
export const PIECE_W = MASTER.w;
export { TAU };
