// The pieces: octagonal carved wooden tiles, as in a traditional Janggi set. Green (Cho) and red (Han), and, as on a real
// set, the pieces come in different SIZES: the general is the largest, then chariot, cannon, horse, elephant, guard and
// the small soldier. The traditional characters (Hanja) are the native mode; "English" shows Western letters.
// Painted ONCE per (piece, theme, size, language) into a sprite (an OffscreenCanvas), then drawn with drawImage.
// Never paint gradients per piece per frame.
// Characters come from the embedded Noto Serif KR Bold subset (fonts/, SIL OFL 1.1) declared in index.html.
export const CJK = '"Janggi Serif", "Noto Serif KR", "Noto Serif TC", "Songti SC", "Batang", serif';
export const LATIN = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
// Cho: 楚 士 象 馬 車 包 卒   Han: 漢 士 象 馬 車 包 兵
const CHO_G = ['', '楚', '士', '象', '馬', '車', '包', '卒'], HAN_G = ['', '漢', '士', '象', '馬', '車', '包', '兵'];
const EN_G = ['', 'K', 'G', 'E', 'H', 'R', 'C', 'S'];
export const glyph = (p, lang) => (lang === 'en' ? EN_G[Math.abs(p)] : p > 0 ? CHO_G[p] : HAN_G[-p]);
// Relative size of each kind of piece (the general is the biggest tile, the soldier the smallest).
export const SIZE_K = [0, 1.13, 0.84, 0.88, 0.93, 0.99, 0.95, 0.78];
export const PIECE_THEMES = ['boxwood', 'ebony'];
export const PIECE_THEME_NAMES = { boxwood: 'Boxwood', ebony: 'Ebony' };

const TH = {
  boxwood: {
    edge: ['#c9914f', '#8f5d2d', '#5e3a1a'], face: ['#fdf0c9', '#efd08f', '#d3a45e'], bevelHi: 'rgba(255,250,228,0.95)', bevelLo: 'rgba(96,52,20,0.6)',
    cho: ['#2fa86a', '#0e6b3d'], han: ['#e0392b', '#a1140d'], ringCho: '#14774a', ringHan: '#b3170f', carveLight: 'rgba(255,246,218,0.8)', carveDark: 'rgba(60,30,10,0.5)', grain: 'rgba(110,64,22,0.08)',
  },
  ebony: {
    edge: ['#3a2a24', '#1c110d', '#0a0504'], face: ['#5d483c', '#34251d', '#1a100c'], bevelHi: 'rgba(255,224,170,0.5)', bevelLo: 'rgba(0,0,0,0.7)',
    cho: ['#7df0ae', '#2cc47a'], han: ['#ff8a68', '#e8381f'], ringCho: '#3fd98d', ringHan: '#f2543a', carveLight: 'rgba(0,0,0,0.55)', carveDark: 'rgba(255,225,170,0.16)', grain: 'rgba(255,230,190,0.05)',
  },
};
const TAU = Math.PI * 2;
const sprites = new Map();
export function invalidatePieces() { sprites.clear(); }
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
function newCanvas(w, h) { return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null; }

// A regular octagon with flat top, softly rounded corners, "radius" = distance from the centre to an edge.
function octPath(ctx, cx, cy, r, round = 0.16) {
  const R = r / Math.cos(Math.PI / 8), pts = [];
  for (let i = 0; i < 8; i++) { const a = (i * 45 + 22.5) * Math.PI / 180; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  const rad = r * round;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const p0 = pts[(i + 7) % 8], p1 = pts[i], p2 = pts[(i + 1) % 8];
    const a = [p1[0] + (p0[0] - p1[0]) * 0.28, p1[1] + (p0[1] - p1[1]) * 0.28], b = [p1[0] + (p2[0] - p1[0]) * 0.28, p1[1] + (p2[1] - p1[1]) * 0.28];
    if (i === 0) ctx.moveTo(a[0], a[1]); else ctx.lineTo(a[0], a[1]);
    ctx.arcTo(p1[0], p1[1], b[0], b[1], rad);
  }
  ctx.closePath();
}

export function paintPiece(ctx, p, R0, themeName, lang = 'ko') {
  const T = TH[themeName] ?? TH.boxwood, cho = p > 0, t = Math.abs(p), R = R0 * SIZE_K[t], pad = R0 * 0.4, side = 2 * R0 + 2 * pad;
  const cx = side / 2, th = R * 0.2, cy = side / 2 - th * 0.5;
  // thickness: a stack of octagons so the rim reads as a turned wooden edge, shaded smoothly from the lit top to the dark base
  const mixc = (a, b, t) => { const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`; };
  for (let k = th; k >= 0; k -= 0.5) {
    const f = k / th;                                   // 1 = base, 0 = just under the face
    ctx.fillStyle = f > 0.5 ? mixc(T.edge[1], T.edge[2], (f - 0.5) * 2) : mixc(T.edge[0], T.edge[1], f * 2); octPath(ctx, cx, cy + k, R); ctx.fill();
  }
  // ambient occlusion where the base meets the board
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = R * 0.06; octPath(ctx, cx, cy + th, R * 0.985); ctx.stroke();
  // top face
  const fg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.1);
  fg.addColorStop(0, T.face[0]); fg.addColorStop(0.62, T.face[1]); fg.addColorStop(1, T.face[2]);
  ctx.fillStyle = fg; octPath(ctx, cx, cy, R); ctx.fill();
  // rim darkening toward the edge of the face (a gently domed top)
  { const vg = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.05); vg.addColorStop(0, 'rgba(60,30,8,0)'); vg.addColorStop(1, themeName === 'ebony' ? 'rgba(0,0,0,0.30)' : 'rgba(90,50,15,0.22)'); ctx.fillStyle = vg; octPath(ctx, cx, cy, R); ctx.fill(); }
  // grain
  ctx.save(); octPath(ctx, cx, cy, R * 0.98); ctx.clip();
  const rnd = lcg(p * 977 + 13); ctx.strokeStyle = T.grain; ctx.lineWidth = R * 0.03;
  for (let i = 0; i < 9; i++) { const y0 = cy - R + (i / 8) * 2 * R + (rnd() - 0.5) * R * 0.2; ctx.beginPath(); ctx.moveTo(cx - R, y0); ctx.bezierCurveTo(cx - R * 0.3, y0 + (rnd() - 0.5) * R * 0.5, cx + R * 0.3, y0 + (rnd() - 0.5) * R * 0.5, cx + R, y0 + (rnd() - 0.5) * R * 0.3); ctx.stroke(); }
  ctx.restore();
  // outer bevel
  const bg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); bg.addColorStop(0, T.bevelHi); bg.addColorStop(0.5, 'rgba(255,255,255,0)'); bg.addColorStop(1, T.bevelLo);
  ctx.strokeStyle = bg; ctx.lineWidth = R * 0.075; octPath(ctx, cx, cy, R * 0.965); ctx.stroke();
  // carved inner octagon (light lip below-right, coloured groove); the general gets a double ring
  const ringR = R * 0.8;
  ctx.strokeStyle = T.carveLight; ctx.lineWidth = R * 0.07; octPath(ctx, cx + R * 0.02, cy + R * 0.03, ringR); ctx.stroke();
  ctx.strokeStyle = cho ? T.ringCho : T.ringHan; ctx.lineWidth = R * 0.065; octPath(ctx, cx, cy, ringR); ctx.stroke();
  if (t === 1) { ctx.lineWidth = R * 0.035; octPath(ctx, cx, cy, ringR - R * 0.1); ctx.stroke(); }
  ctx.fillStyle = themeName === 'ebony' ? 'rgba(0,0,0,0.14)' : 'rgba(120,70,20,0.07)'; octPath(ctx, cx, cy, ringR - R * 0.04); ctx.fill();
  // the character, carved: light lip, dark shadow, then the colour
  const en = lang === 'en';
  const gs = en ? R * 1.0 : t === 1 ? R * 1.02 : R * 1.08;
  ctx.font = `700 ${gs.toFixed(1)}px ${en ? LATIN : CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ch = glyph(p, lang), ty = cy + R * 0.05, colors = cho ? T.cho : T.han;
  ctx.fillStyle = T.carveLight; ctx.fillText(ch, cx + R * 0.035, ty + R * 0.05);
  ctx.fillStyle = T.carveDark; ctx.fillText(ch, cx - R * 0.03, ty - R * 0.035);
  const tg = ctx.createLinearGradient(0, ty - R * 0.5, 0, ty + R * 0.5); tg.addColorStop(0, colors[0]); tg.addColorStop(1, colors[1]);
  ctx.fillStyle = tg; ctx.fillText(ch, cx, ty);
  // specular glint along the lit upper-left edge and a soft highlight patch
  ctx.save(); octPath(ctx, cx, cy, R * 0.97); ctx.clip();
  const sp = ctx.createLinearGradient(cx - R, cy - R, cx - R * 0.1, cy - R * 0.1); sp.addColorStop(0, 'rgba(255,255,255,0.75)'); sp.addColorStop(0.35, 'rgba(255,255,255,0.18)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = sp; ctx.lineWidth = R * 0.11; octPath(ctx, cx + R * 0.02, cy + R * 0.02, R * 0.93); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(cx - R * 0.42, cy - R * 0.55, R * 0.2, R * 0.075, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
  // gloss
  ctx.save(); octPath(ctx, cx, cy, R * 0.97); ctx.clip();
  const gl = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.5, 0, cx - R * 0.34, cy - R * 0.5, R * 0.85);
  gl.addColorStop(0, themeName === 'ebony' ? 'rgba(255,240,215,0.30)' : 'rgba(255,255,255,0.45)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
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
      const side = 2 * R + 2 * R * 0.4, c = newCanvas(Math.ceil(side * RES), Math.ceil(side * RES));
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

// Draw a piece with its face centred on (x, y). o: { theme, R, scale, alpha, lift (0..1: raised off the board) }
export function drawPiece(ctx, p, x, y, o = {}) {
  const R = o.R ?? 34, scale = o.scale ?? 1, theme = o.theme ?? 'boxwood', lang = o.lang ?? 'ko', lift = o.lift ?? 0, k = SIZE_K[Math.abs(p)];
  const sk = R * k * scale, al = o.alpha ?? 1;
  blob(ctx, x + 4 + lift * 10, y + 9 + lift * 15, sk * (1.3 + lift * 0.22), sk * (1.02 + lift * 0.16), '0,0,0', al * (0.42 - lift * 0.1));      // soft cast shadow
  blob(ctx, x + 1.5, y + 6 - lift * 2, sk * 0.98, sk * 0.72, '0,0,0', al * 0.55 * (1 - Math.min(1, lift) * 0.7));                                     // tight contact shadow
  const s = sprite(p, R, theme, lang), ly = y - lift * 12 * scale;
  ctx.save();
  if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha = Math.max(0, o.alpha);
  if (s) ctx.drawImage(s.c, x - s.cx * scale, ly - s.cy * scale, s.side * scale, s.side * scale);
  else { ctx.translate(x - (2 * R * 0.7) * scale, ly - (2 * R * 0.7) * scale); ctx.scale(scale, scale); paintPiece(ctx, p, R, theme, lang); }
  ctx.restore();
}
