// Tile art. Every tile face is drawn in code (vector shapes; the Chinese characters use the bundled Noto Serif SC
// subset) into a cached sprite ONCE per kind, style and resolution. Never paint a face per frame: use tileSprite().
//
// Geometry (tile units): face FW x FH, plus DEPTH of visible thickness under it. Sprites carry PAD units of margin.
export const FW = 60, FH = 80, DEPTH = 10, PAD = 3, RAD = 9;
export const SPRITE_W = FW + PAD * 2, SPRITE_H = FH + DEPTH + PAD * 2;
export const STYLES = ['traditional', 'contrast', 'index'];
export const STYLE_NAMES = { traditional: 'Traditional', contrast: 'High contrast', index: 'Simple index' };

// Tile language: 'zh' draws the native Chinese characters (Characters suit, winds, dragons, flowers/seasons).
// 'en' draws the Western-set convention instead: a number + suit letter, E/S/W/N, R/G for the dragons.
// Read by tileSprite() at draw time; set once per frame from game.js's render() before any tile is painted.
let LANG = 'zh';
export const setLang = (l) => { LANG = l === 'en' ? 'en' : 'zh'; };
export const getLang = () => LANG;

const CJK = '"Noto Serif SC", "Songti SC", "STSong", serif';
const NUM = '"Cormorant Garamond", Georgia, serif';
const HAN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

const PAL = {
  traditional: { face1: '#fffdf3', face2: '#efe4c6', ink: '#22201a', red: '#c22d2a', green: '#1c7a3f', blue: '#1f4f9e', edge: 'rgba(96,74,32,0.45)', line: 1 },
  contrast: { face1: '#ffffff', face2: '#f4f4ee', ink: '#000000', red: '#d1001c', green: '#00752f', blue: '#0033cc', edge: 'rgba(0,0,0,0.75)', line: 1.5 },
};
PAL.index = PAL.traditional;

const cache = new Map();
const make = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null);

export function tileSprite(kind, style = 'traditional', ss = 2) {
  const lang = LANG, key = `${style}|${lang}|${kind}|${ss}`;
  if (cache.has(key)) return cache.get(key);
  let c = null;
  try {
    c = make(Math.ceil(SPRITE_W * ss), Math.ceil(SPRITE_H * ss));
    if (c) { const g = c.getContext('2d'); g.scale(ss, ss); g.translate(PAD, PAD); body(g, style, false); g.save(); g.beginPath(); g.roundRect(3, 3, FW - 6, FH - 6, 5); g.clip(); face(g, kind, style, lang); g.restore(); }
  } catch { c = null; }
  cache.set(key, c);
  return c;
}
export function backSprite(ss = 2) {
  const key = `back|${ss}`;
  if (cache.has(key)) return cache.get(key);
  let c = null;
  try { c = make(Math.ceil(SPRITE_W * ss), Math.ceil(SPRITE_H * ss)); if (c) { const g = c.getContext('2d'); g.scale(ss, ss); g.translate(PAD, PAD); body(g, 'traditional', true); } } catch { c = null; }
  cache.set(key, c);
  return c;
}

// The slab: the thick side (jade under an ivory face; ivory under a jade back) and the bevelled top.
function body(g, style, back) {
  const hi = back ? ['#45b18b', '#1d7a5a'] : [PAL[style].face1, PAL[style].face2];
  const side = back ? ['#efe3c3', '#c9b98d'] : ['#2fb48a', '#137055'];
  // side / thickness
  let gr = g.createLinearGradient(0, DEPTH, 0, FH + DEPTH);
  gr.addColorStop(0, side[0]); gr.addColorStop(1, side[1]);
  g.fillStyle = gr; g.beginPath(); g.roundRect(0, DEPTH * 0.55, FW, FH + DEPTH * 0.45, RAD); g.fill();
  // a lit line along the bottom of the thickness
  g.strokeStyle = back ? 'rgba(255,255,255,0.5)' : 'rgba(150,240,200,0.35)'; g.lineWidth = 1.2;
  g.beginPath(); g.roundRect(0.8, DEPTH * 0.55 + 1, FW - 1.6, FH + DEPTH * 0.45 - 2, RAD); g.stroke();
  // top plate
  gr = g.createLinearGradient(0, 0, FW * 0.7, FH);
  gr.addColorStop(0, hi[0]); gr.addColorStop(1, hi[1]);
  g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, FW, FH, RAD); g.fill();
  // bevel: light top-left, shade bottom-right
  g.lineWidth = 2;
  g.strokeStyle = back ? 'rgba(220,255,240,0.55)' : 'rgba(255,255,255,0.9)';
  g.beginPath(); g.moveTo(RAD, 1); g.lineTo(FW - RAD, 1); g.moveTo(1, RAD); g.lineTo(1, FH - RAD); g.stroke();
  g.strokeStyle = back ? 'rgba(0,50,35,0.4)' : 'rgba(120,96,48,0.35)';
  g.beginPath(); g.moveTo(RAD, FH - 1); g.lineTo(FW - RAD, FH - 1); g.moveTo(FW - 1, RAD); g.lineTo(FW - 1, FH - RAD); g.stroke();
  g.strokeStyle = back ? 'rgba(0,60,42,0.55)' : PAL[style].edge; g.lineWidth = 1;
  g.beginPath(); g.roundRect(0.5, 0.5, FW - 1, FH - 1, RAD); g.stroke();
  if (back) {
    // an inset lozenge pattern so backs read as carved bamboo
    g.save(); g.beginPath(); g.roundRect(6, 6, FW - 12, FH - 12, 5); g.clip();
    g.fillStyle = 'rgba(8,70,50,0.28)'; g.fillRect(0, 0, FW, FH);
    g.strokeStyle = 'rgba(150,240,200,0.28)'; g.lineWidth = 1;
    for (let i = -FH; i < FW + FH; i += 9) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + FH, FH); g.moveTo(i + FH, 0); g.lineTo(i, FH); g.stroke(); }
    g.restore();
    g.strokeStyle = 'rgba(210,255,235,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.roundRect(6, 6, FW - 12, FH - 12, 5); g.stroke();
  }
}

// ---------------------------------------------------------------------------------------------------------------
function face(g, k, style, lang) {
  const P = PAL[style];
  const col = (n) => (n === 'R' ? P.red : n === 'G' ? P.green : P.blue);
  if (k < 9) return characters(g, k, P, style, lang);
  if (k < 18) return bamboo(g, k - 9, P, col);
  if (k < 27) return dots(g, k - 18, P, col);
  if (k < 31) return wind(g, k - 27, P, lang);
  if (k < 34) return dragon(g, k - 31, P, lang);
  return bonus(g, k - 34, P, lang);
}
const text = (g, str, x, y, size, color, font = CJK, weight = 700, outline = 0) => {
  g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (outline) { g.lineWidth = outline; g.strokeStyle = color; g.lineJoin = 'round'; g.strokeText(str, x, y); }
  g.fillStyle = color; g.fillText(str, x, y);
};
const indexMark = (g, style, lang, label, sub, color) => {
  // Skip in English mode: the main face is already a number + suit letter, so the corner mark would be redundant.
  if (style !== 'index' || lang === 'en') return;
  g.save(); g.fillStyle = 'rgba(255,255,255,0.86)'; g.beginPath(); g.roundRect(3.5, 3.5, 20, sub ? 28 : 20, 4); g.fill(); g.restore();
  text(g, label, 13.5, 20, 17, color, NUM, 700);
  if (sub) text(g, sub, 13.5, 30, 9, color, NUM, 700);
};

function characters(g, r, P, style, lang) {
  const o = P.line > 1 ? 0.8 : 0;
  if (lang === 'en') {
    // Western-set convention: an Arabic numeral over the suit letter (mahjong's "Characters"/"Wan" suit is C).
    text(g, String(r + 1), 30, 40, 36, P.ink, NUM, 700, o);
    text(g, 'C', 30, 71, 30, P.red, NUM, 700, o);
  } else {
    text(g, HAN[r], 30, 38, 33, P.ink, CJK, 700, o);
    text(g, '萬', 30, 71, 31, P.red, CJK, 700, o);
  }
  // a hairline between the two glyphs, like a printed tile
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(16, 43); g.lineTo(44, 43); g.stroke();
  indexMark(g, style, lang, String(r + 1), 'C', P.ink);
}

function dot(g, x, y, r, c, P) {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, c); gr.addColorStop(1, c);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.9 * P.line; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 0.66, 0, 6.2832); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x, y, r * 0.24, 0, 6.2832); g.fill();
  g.fillStyle = c; g.beginPath(); g.arc(x, y, r * 0.11, 0, 6.2832); g.fill();
}
const DOT_LAYOUT = [
  null,
  { r: 0, p: [] },
  { r: 11.5, p: [[30, 22, 'G'], [30, 58, 'R']] },
  { r: 10, p: [[16, 17, 'B'], [30, 40, 'R'], [44, 63, 'G']] },
  { r: 10.5, p: [[19, 22, 'B'], [41, 22, 'G'], [19, 58, 'G'], [41, 58, 'B']] },
  { r: 9.5, p: [[17, 19, 'B'], [43, 19, 'G'], [30, 40, 'R'], [17, 61, 'G'], [43, 61, 'B']] },
  { r: 9.2, p: [[19, 16, 'G'], [41, 16, 'G'], [19, 40, 'R'], [41, 40, 'R'], [19, 64, 'R'], [41, 64, 'R']] },
  { r: 8.2, p: [[14, 13, 'G'], [30, 20, 'G'], [46, 27, 'G'], [19, 47, 'R'], [41, 47, 'R'], [19, 66, 'R'], [41, 66, 'R']] },
  { r: 8.6, p: [[19, 13, 'B'], [41, 13, 'B'], [19, 32, 'B'], [41, 32, 'B'], [19, 51, 'B'], [41, 51, 'B'], [19, 69, 'B'], [41, 69, 'B']] },
  { r: 8.2, p: [[13, 14, 'G'], [30, 14, 'G'], [47, 14, 'G'], [13, 40, 'R'], [30, 40, 'R'], [47, 40, 'R'], [13, 66, 'B'], [30, 66, 'B'], [47, 66, 'B']] },
];
function dots(g, n, P, col) {
  if (n === 0) {   // the big single dot: layered rings in the three colours
    const x = 30, y = 40;
    g.fillStyle = P.red; g.beginPath(); g.arc(x, y, 22, 0, 6.2832); g.fill();
    g.fillStyle = '#fbf6e6'; g.beginPath(); g.arc(x, y, 18.5, 0, 6.2832); g.fill();
    g.fillStyle = P.green; g.beginPath(); g.arc(x, y, 16, 0, 6.2832); g.fill();
    for (let i = 0; i < 12; i++) { const a = i * 0.5236; g.fillStyle = '#fbf6e6'; g.beginPath(); g.arc(x + Math.cos(a) * 11.5, y + Math.sin(a) * 11.5, 2.1, 0, 6.2832); g.fill(); }
    g.fillStyle = P.red; g.beginPath(); g.arc(x, y, 9, 0, 6.2832); g.fill();
    g.fillStyle = '#fbf6e6'; g.beginPath(); g.arc(x, y, 5.6, 0, 6.2832); g.fill();
    g.fillStyle = P.blue; g.beginPath(); g.arc(x, y, 3.4, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = P.line; g.beginPath(); g.arc(x, y, 22, 0, 6.2832); g.stroke();
    const gr = g.createRadialGradient(x - 8, y - 9, 1, x, y, 24); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 22, 0, 6.2832); g.fill();
    return;
  }
  const L = DOT_LAYOUT[n + 1];
  for (const [x, y, c] of L.p) dot(g, x, y, L.r, col(c), P);
}

function stick(g, x, y, w, h, c, P, kink = true) {
  const x0 = x - w / 2, y0 = y - h / 2;
  const gr = g.createLinearGradient(x0, 0, x0 + w, 0);
  gr.addColorStop(0, shade(c, -0.35)); gr.addColorStop(0.35, shade(c, 0.35)); gr.addColorStop(1, shade(c, -0.25));
  g.fillStyle = gr; g.beginPath(); g.roundRect(x0, y0, w, h, w * 0.42); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.8 * P.line; g.stroke();
  if (kink) { // the node in the middle and light ends
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x0 + 0.5, y - 0.9, w - 1, 1.8);
    g.strokeStyle = 'rgba(0,0,0,0.42)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x0, y + 1.4); g.lineTo(x0 + w, y + 1.4); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x0 + w * 0.22, y0 + 2, w * 0.18, h - 4);
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(r)},${f(gg)},${f(b)})`;
}
const BAM = [
  null, null,
  { w: 9, h: 28, p: [[30, 22, 'G'], [30, 58, 'B']] },
  { w: 9, h: 27, p: [[30, 22, 'G'], [20, 58, 'G'], [40, 58, 'G']] },
  { w: 9, h: 27, p: [[19, 22, 'G'], [41, 22, 'B'], [19, 58, 'B'], [41, 58, 'G']] },
  { w: 8.5, h: 25, p: [[16, 20, 'G'], [44, 20, 'G'], [30, 40, 'R'], [16, 60, 'G'], [44, 60, 'G']] },
  { w: 8, h: 27, p: [[15, 22, 'G'], [30, 22, 'B'], [45, 22, 'G'], [15, 58, 'G'], [30, 58, 'B'], [45, 58, 'G']] },
  { w: 8, h: 24, p: [[30, 14, 'R'], [15, 40, 'G'], [30, 40, 'B'], [45, 40, 'G'], [15, 66, 'G'], [30, 66, 'B'], [45, 66, 'G']] },
  { w: 7.5, h: 27, p: [[13, 22, 'G'], [26, 22, 'B'], [39, 22, 'B'], [52, 22, 'G'], [13, 58, 'G'], [26, 58, 'B'], [39, 58, 'B'], [52, 58, 'G']] },
  { w: 8, h: 21, p: [[14, 14, 'G'], [30, 14, 'G'], [46, 14, 'G'], [14, 40, 'R'], [30, 40, 'R'], [46, 40, 'R'], [14, 66, 'B'], [30, 66, 'B'], [46, 66, 'B']] },
];
function bamboo(g, n, P, col) {
  if (n === 0) return sparrow(g, P);
  const L = BAM[n + 1];
  for (const [x, y, c] of L.p) stick(g, x, y, L.w, L.h, col(c), P);
}
function sparrow(g, P) {
  // a small bird on a bamboo stalk
  stick(g, 30, 66, 8, 30, P.green, P);
  g.save(); g.translate(30, 36);
  g.fillStyle = P.red; g.beginPath(); g.moveTo(-3, -22); g.quadraticCurveTo(-11, -34, -4, -35); g.quadraticCurveTo(0, -30, 1, -22); g.fill();
  const tail = [[-17, 22, P.green], [-8, 26, P.blue], [0, 24, P.green]];
  for (const [dx, dy, c] of tail) { g.fillStyle = c; g.beginPath(); g.moveTo(-2, 12); g.quadraticCurveTo(dx - 3, dy - 4, dx + 2, dy + 6); g.quadraticCurveTo(dx + 9, dy - 2, 5, 10); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.7; g.stroke(); }
  const bg = g.createLinearGradient(-16, -18, 12, 14); bg.addColorStop(0, '#39b36a'); bg.addColorStop(1, '#0f5f3a');
  g.fillStyle = bg; g.beginPath(); g.ellipse(0, 0, 15, 19, 0.15, 0, 6.2832); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.9; g.stroke();
  g.fillStyle = P.blue; g.beginPath(); g.ellipse(4, 3, 8, 12, 0.35, 0, 6.2832); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = '#39b36a'; g.beginPath(); g.arc(-3, -17, 9, 0, 6.2832); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.stroke();
  g.fillStyle = '#e9a824'; g.beginPath(); g.moveTo(-10, -17); g.lineTo(-19, -14); g.lineTo(-10, -13); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-5.5, -19, 2.6, 0, 6.2832); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(-6, -19, 1.3, 0, 6.2832); g.fill();
  g.restore();
}

function wind(g, i, P, lang) {
  if (lang === 'en') text(g, ['E', 'S', 'W', 'N'][i], 30, 56, 46, P.ink, NUM, 700, P.line > 1 ? 1 : 0.4);
  else text(g, ['東', '南', '西', '北'][i], 30, 58, 50, P.ink, CJK, 700, P.line > 1 ? 1 : 0.4);
}
function dragon(g, i, P, lang) {
  const en = lang === 'en';
  if (i === 0) text(g, en ? 'R' : '中', 30, en ? 56 : 58, en ? 46 : 52, P.red, en ? NUM : CJK, 700, 0.5);
  else if (i === 1) text(g, en ? 'G' : '發', 30, 57, en ? 44 : 46, P.green, en ? NUM : CJK, 700, 0.5);
  else {   // White Dragon: an empty double frame (already language-neutral: no glyph in either mode)
    g.strokeStyle = P.blue; g.lineWidth = 3.2; g.beginPath(); g.roundRect(9, 9, 42, 62, 5); g.stroke();
    g.lineWidth = 1.4; g.beginPath(); g.roundRect(15, 15, 30, 50, 3); g.stroke();
  }
}

function petals(g, x, y, n, len, wid, c1, c2, rot = 0) {
  for (let i = 0; i < n; i++) {
    g.save(); g.translate(x, y); g.rotate(rot + (i * 6.2832) / n);
    const gr = g.createLinearGradient(0, 0, 0, -len); gr.addColorStop(0, c2); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(wid, -len * 0.55, 0, -len); g.quadraticCurveTo(-wid, -len * 0.55, 0, 0); g.fill();
    g.strokeStyle = 'rgba(90,20,30,0.35)'; g.lineWidth = 0.6; g.stroke(); g.restore();
  }
}
function bonus(g, i, P, lang) {
  const en = lang === 'en';
  const seasonal = i >= 4, j = i % 4;
  // painted panel behind the motif
  g.fillStyle = seasonal ? 'rgba(31,79,158,0.09)' : 'rgba(194,45,42,0.07)'; g.beginPath(); g.roundRect(7, 7, 46, 66, 6); g.fill();
  g.strokeStyle = seasonal ? P.blue : P.red; g.lineWidth = 1.4; g.beginPath(); g.roundRect(7, 7, 46, 66, 6); g.stroke();
  const cx = 30, cy = 33;
  if (!seasonal) {
    if (j === 0) { petals(g, cx, cy, 5, 15, 9, '#f6a6b8', '#d9506f', -1.57); g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(cx, cy, 3.4, 0, 6.2832); g.fill(); }
    else if (j === 1) { petals(g, cx, cy + 4, 3, 22, 5.5, '#b08be0', '#6d3fb0', 3.14); petals(g, cx, cy + 4, 2, 14, 4, '#d9c4f5', '#8b5fd0', 1.57); g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(cx, cy + 4, 2.4, 0, 6.2832); g.fill(); }
    else if (j === 2) { petals(g, cx, cy, 16, 16, 3.6, '#f6d34e', '#d98a1c', 0); petals(g, cx, cy, 10, 9, 3, '#ffe98a', '#e09c26', 0.3); g.fillStyle = '#b25a12'; g.beginPath(); g.arc(cx, cy, 3, 0, 6.2832); g.fill(); }
    else { stick(g, cx - 8, cy + 2, 7, 36, P.green, P); stick(g, cx + 6, cy + 5, 7, 30, P.green, P); g.fillStyle = '#2fa15c'; g.beginPath(); g.moveTo(cx + 2, cy - 8); g.quadraticCurveTo(cx + 16, cy - 16, cx + 20, cy - 6); g.quadraticCurveTo(cx + 10, cy - 6, cx + 2, cy - 8); g.fill(); }
    text(g, en ? ['Pl', 'Or', 'Ch', 'Bm'][j] : ['梅', '蘭', '菊', '竹'][j], 30, 66, en ? 17 : 22, P.red, en ? NUM : CJK, 700, 0.3);
  } else {
    const glyph = en ? ['Sp', 'Su', 'Au', 'Wi'][j] : ['春', '夏', '秋', '冬'][j], sc = ['#5fb85a', '#e3a21a', '#c8632a', '#6aa6d8'][j];
    const gr = g.createRadialGradient(cx - 6, 30, 2, cx, 38, 24); gr.addColorStop(0, shade(sc, 0.45)); gr.addColorStop(1, sc);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, 40, 22, 0, 6.2832); g.fill();
    g.strokeStyle = P.blue; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, 40, 22, 0, 6.2832); g.stroke();
    text(g, glyph, cx, en ? 48 : 52, en ? 22 : 36, '#ffffff', en ? NUM : CJK, 700, 0);
    g.fillStyle = P.blue; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx - 8 + i * 8, 68, 2, 0, 6.2832); g.fill(); }
  }
  g.fillStyle = seasonal ? P.blue : P.red; g.font = `700 12px ${NUM}`; g.textAlign = 'left'; g.fillText(String(j + 1), 11, 20);
}

// Draw a sprite so its face rectangle's centre lands on (x, y); `w` = face width on screen. rot in radians.
// Returns nothing. Falls back to a plain rectangle when sprites are unavailable (headless).
export function drawSprite(ctx, spr, x, y, w, rot = 0, alpha = 1) {
  if (!spr) return;
  const sc = w / FW;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(spr, -(FW / 2 + PAD) * sc, -(FH / 2 + PAD) * sc, SPRITE_W * sc, SPRITE_H * sc);
  ctx.restore();
}
