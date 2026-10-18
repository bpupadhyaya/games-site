// The pieces: carved wooden discs, either with the traditional characters ("Play in 中文", the native/authentic
// mode) or with Western letters ("Play in English", so a player who cannot read the script can still play).
// Painted ONCE per (piece, theme, size, language) into a sprite (an OffscreenCanvas), then drawn with drawImage.
// Never paint gradients per piece per frame.
// Chinese characters come from the embedded Noto Serif TC Bold subset (fonts/, SIL OFL 1.1) declared in index.html.
// English letters reuse the embedded Cormorant Garamond Bold (also declared in index.html) for the same carved look.
export const CJK = '"Noto Serif XQ", "Noto Serif TC", "Songti TC", "PMingLiU", "Songti SC", serif';
export const LATIN = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const RED_G = ['', '帥', '仕', '相', '傌', '俥', '炮', '兵'], BLK_G = ['', '將', '士', '象', '馬', '車', '砲', '卒'];
// Standard Western Xiangqi notation letters, same letter for both colours (colour alone tells the side apart,
// exactly as it already does for the carved characters): General, Advisor, Elephant, Horse, cHariot, Cannon, Soldier.
const EN_G = ['', 'K', 'A', 'E', 'H', 'R', 'C', 'S'];
export const glyph = (p, lang) => (lang === 'en' ? EN_G[Math.abs(p)] : p > 0 ? RED_G[p] : BLK_G[-p]);
export const PIECE_THEMES = ['boxwood', 'ebony'];
export const PIECE_THEME_NAMES = { boxwood: 'Boxwood', ebony: 'Ebony' };

const TH = {
  boxwood: {
    edge: ['#c48a48', '#8a5a2c', '#5e3a1a'], face: ['#fbebc0', '#ecc987', '#cf9f58'], bevelHi: 'rgba(255,248,222,0.95)', bevelLo: 'rgba(96,52,20,0.6)',
    red: ['#e2392a', '#a5150f'], blk: ['#3a2a23', '#0d0706'], ringRed: '#b3170f', ringBlk: '#22150f', carveLight: 'rgba(255,244,214,0.75)', carveDark: 'rgba(70,30,10,0.55)', grain: 'rgba(110,64,22,0.08)',
  },
  ebony: {
    edge: ['#3a2a24', '#1c110d', '#0a0504'], face: ['#5a463b', '#33241d', '#1a100c'], bevelHi: 'rgba(255,224,170,0.5)', bevelLo: 'rgba(0,0,0,0.7)',
    red: ['#ff7a5c', '#e0301c'], blk: ['#f8dc8e', '#c8983a'], ringRed: '#e8452e', ringBlk: '#d9aa48', carveLight: 'rgba(0,0,0,0.55)', carveDark: 'rgba(255,225,170,0.18)', grain: 'rgba(255,230,190,0.05)',
  },
};
const TAU = Math.PI * 2;
const sprites = new Map();
export function invalidatePieces() { sprites.clear(); }
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

function newCanvas(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null; }

export function paintPiece(ctx, p, R, themeName, lang = 'zh') {
  const T = TH[themeName] ?? TH.boxwood, red = p > 0, pad = R * 0.34, side = 2 * R + 2 * pad;
  const cx = side / 2, th = R * 0.15, cy = side / 2 - th * 0.5;
  // thickness: a stack of discs so the rim reads as a turned wooden edge
  for (let k = th; k >= 0; k -= 0.5) {
    const f = k / th, gr = f > 0.5 ? T.edge[2] : f > 0.2 ? T.edge[1] : T.edge[0];
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy + k, R, 0, TAU); ctx.fill();
  }
  // top face
  const fg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
  fg.addColorStop(0, T.face[0]); fg.addColorStop(0.62, T.face[1]); fg.addColorStop(1, T.face[2]);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  // grain
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 0, TAU); ctx.clip();
  const rnd = lcg(p * 977 + 13); ctx.strokeStyle = T.grain; ctx.lineWidth = R * 0.03;
  for (let i = 0; i < 9; i++) { const y0 = cy - R + (i / 8) * 2 * R + (rnd() - 0.5) * R * 0.2; ctx.beginPath(); ctx.moveTo(cx - R, y0); ctx.bezierCurveTo(cx - R * 0.3, y0 + (rnd() - 0.5) * R * 0.5, cx + R * 0.3, y0 + (rnd() - 0.5) * R * 0.5, cx + R, y0 + (rnd() - 0.5) * R * 0.3); ctx.stroke(); }
  ctx.restore();
  // outer bevel
  const bg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); bg.addColorStop(0, T.bevelHi); bg.addColorStop(0.5, 'rgba(255,255,255,0)'); bg.addColorStop(1, T.bevelLo);
  ctx.strokeStyle = bg; ctx.lineWidth = R * 0.075; ctx.beginPath(); ctx.arc(cx, cy, R * 0.965, 0, TAU); ctx.stroke();
  // carved ring (light lip below-right, coloured groove)
  const ringR = R * 0.79;
  ctx.strokeStyle = T.carveLight; ctx.lineWidth = R * 0.075; ctx.beginPath(); ctx.arc(cx + R * 0.02, cy + R * 0.03, ringR, 0, TAU); ctx.stroke();
  ctx.strokeStyle = red ? T.ringRed : T.ringBlk; ctx.lineWidth = R * 0.07; ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, TAU); ctx.stroke();
  // inner face: a touch deeper than the rim
  ctx.fillStyle = themeName === 'ebony' ? 'rgba(0,0,0,0.14)' : 'rgba(120,70,20,0.07)'; ctx.beginPath(); ctx.arc(cx, cy, ringR - R * 0.04, 0, TAU); ctx.fill();
  // the character, carved: light lip, dark shadow, then the colour
  const en = lang === 'en';
  ctx.font = `700 ${(en ? R * 0.94 : R * 1.08).toFixed(1)}px ${en ? LATIN : CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ch = glyph(p, lang), ty = cy + R * 0.05, colors = red ? T.red : T.blk;
  ctx.fillStyle = T.carveLight; ctx.fillText(ch, cx + R * 0.035, ty + R * 0.05);
  ctx.fillStyle = T.carveDark; ctx.fillText(ch, cx - R * 0.03, ty - R * 0.035);
  const tg = ctx.createLinearGradient(0, ty - R * 0.5, 0, ty + R * 0.5); tg.addColorStop(0, colors[0]); tg.addColorStop(1, colors[1]);
  ctx.fillStyle = tg; ctx.fillText(ch, cx, ty);
  // gloss
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.97, 0, TAU); ctx.clip();
  const gl = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.5, 0, cx - R * 0.34, cy - R * 0.5, R * 0.85);
  gl.addColorStop(0, themeName === 'ebony' ? 'rgba(255,240,215,0.30)' : 'rgba(255,255,255,0.42)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  ctx.restore();
  return { side, cx, cy };
}

const RES = 2;
function sprite(p, R, theme, lang) {
  const key = `${p}|${R}|${theme}|${lang}`;
  let s = sprites.get(key);
  if (s === undefined) {
    s = null;
    try {
      const side = 2 * R + 2 * R * 0.34, c = newCanvas(Math.ceil(side * RES), Math.ceil(side * RES));
      if (c) { const sctx = c.getContext('2d'); sctx.scale(RES, RES); const m = paintPiece(sctx, p, R, theme, lang); s = { c, side: m.side, cx: m.cx, cy: m.cy }; }
    } catch { s = null; }
    sprites.set(key, s);
  }
  return s;
}
export const hasSprite = (p, R, theme, lang) => sprites.has(`${p}|${R}|${theme}|${lang}`);
export function warmPiece(p, R, theme, lang) { sprite(p, R, theme, lang); }

// soft blob (shadow / glow), cached per colour
const blobs = new Map();
export function blob(ctx, x, y, rx, ry, rgb, alpha) {
  let c = blobs.get(rgb);
  if (c === undefined) {
    c = null;
    try { const cv = newCanvas(128, 128); if (cv) { const b = cv.getContext('2d'), g = b.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.5, `rgba(${rgb},0.45)`); g.addColorStop(1, `rgba(${rgb},0)`); b.fillStyle = g; b.fillRect(0, 0, 128, 128); c = cv; } } catch { c = null; }
    blobs.set(rgb, c);
  }
  ctx.save(); ctx.globalAlpha = alpha;
  if (c) ctx.drawImage(c, x - rx, y - ry, rx * 2, ry * 2);
  else { ctx.fillStyle = `rgba(${rgb},0.5)`; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Draw a piece with its face centred on (x, y). o: { theme, R, scale, alpha, lift (0..1: raised off the board), dark }
export function drawPiece(ctx, p, x, y, o = {}) {
  const R = o.R ?? 34, scale = o.scale ?? 1, theme = o.theme ?? 'boxwood', lang = o.lang ?? 'zh', lift = o.lift ?? 0;
  blob(ctx, x + 3 + lift * 9, y + 8 + lift * 14, R * scale * (1.25 + lift * 0.2), R * scale * (1.0 + lift * 0.15), '0,0,0', (o.alpha ?? 1) * (0.5 - lift * 0.12));
  const s = sprite(p, R, theme, lang), ly = y - lift * 12 * scale;
  ctx.save();
  if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha = Math.max(0, o.alpha);
  if (s) ctx.drawImage(s.c, x - s.cx * scale, ly - s.cy * scale, s.side * scale, s.side * scale);
  else { ctx.translate(x - (2 * R * 0.67) * scale, ly - (2 * R * 0.67) * scale); ctx.scale(scale, scale); paintPiece(ctx, p, R, theme, lang); }
  ctx.restore();
}
