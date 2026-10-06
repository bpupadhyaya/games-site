// Every screen that is not the table: title, settings, How to play, About, lessons, daily challenge, pause, demo limit.
// `*Rects` / `*Geo` functions are the single source for both drawing and tapping, and every one is a function of the LIVE screen size
// (kit 1.7.x fluid viewport: short side 720 units). Three shapes: "roomy" portrait (the approved phone layout, unchanged), "compact"
// portrait (shorter: tablets, SE, windows) and "wide" (landscape: two columns / art left + buttons right).
import { W, H, GEO, HAND_Y, handMetrics, handTileX, inRect, TEXT_SCALES, host } from './layout.js';
import { DISPLAY, UI, CJKF, GOLD, IVORY, TAU, tx, txFit, wrap, rr, btn, panel, drawTable, drawTileAt, tileByKind } from './draw.js';
import { LEVELS } from './ai.js';
import { HOW_PAGES, ABOUT_PAGES, RULE_PAGES } from './content.js';
import { LESSONS, fakeState, withDraw, idFor, textOf } from './lessons.js';
import { STYLE_NAMES } from './tiles.js';
import { winInfo, pointsFor, fullHand, claimOptions } from './rules.js';
import { claimList } from './view.js';
import { drawLockupImage } from './brand.js';

const big = (S) => (S.prefs.big ? 1.18 : 1);
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ins = () => ({ t: Math.max(0, host.t), b: Math.max(0, host.b), l: Math.max(0, host.l), r: Math.max(0, host.r) });
// "roomy" = a tall phone: the approved portrait layout, nudged to clear the notch / home indicator.
const roomy = () => !GEO.wide && H >= 1500;
const topClear = () => { const { t } = ins(); return host.back ? t + host.back + 12 : t + 8; };
const backClear = () => (host.back ? Math.max(0, host.l) + host.back + 14 : 0);
const pressed = (rs, r) => rs.ptr.down && inRect(r, rs.ptr.x, rs.ptr.y);

// The language choice (design principle: native + English as separate named choices, never blended, and
// discoverable without hunting through Settings). Shared data + rect layouts so the title screen AND the
// Settings screen show the same two named buttons and both write straight to prefs.lang. Native ("Play (中文)")
// keeps the built-in Chinese tile characters (Characters suit, winds, dragons, flowers/seasons); English swaps
// them for the Western number-and-letter convention. Menus and lessons are English either way (they always
// were), so only the tile faces and the wind marker change with this choice.
export const LANG_CHOICES = [
  { lang: 'zh', label: 'Play (中文)' },
  { lang: 'en', label: 'Play (English)' },
];

// ------------------------------------------------------------------------------------------------- title
// Everything on the title screen as one layout object: the button list, where the art goes (and at what scale), the little labels.
const ART_H = 812;                                              // the art's own height in its design units (720 wide)
export function titleLayout(S) {
  const { t, b, l, r } = ins(), rm = roomy(), wide = GEO.wide;
  // Arcforge lockup: bottom centre under the last row (>= ~125 css px wide, aspect 1200:327); LKH = its height in virtual units.
  const LKW = Math.max(260, 125 / Math.max(0.2, host.px || 0.6)), LKH = Math.round(LKW * 327 / 1200);
  const rows = [];
  if (S.saved) rows.push({ id: 'continue', label: 'Continue hand', kind: 'gold', sub: `${S.saved.match.mode === 'round' ? 'East round' : 'Single hand'} in progress` });
  rows.push({ id: 'round', label: 'East round', kind: S.saved ? 'jade' : 'gold', sub: 'Four deals, one game' });
  rows.push({ id: 'hand', label: 'Quick hand', kind: 'jade', sub: 'A single deal' });
  rows.push({ id: 'learn', label: 'Learn to play', kind: 'jade', sub: `${Object.keys(S.learned).length} of ${LESSONS.length} lessons done` });
  rows.push({ id: 'daily', label: 'Daily challenge', kind: 'jade', sub: S.daily.doneDay === S.daily.day ? 'Done today' : S.daily.streak ? `Streak ${S.daily.streak}` : 'Three tile puzzles' });
  const small = [['how', 'How to play'], ['about', 'About'], ['rules', 'Rules'], ['auto', 'Auto Play'], ['settings', 'Settings']];
  const out = [], v = { rects: out, size: { main: 40, small: 28, chip: 26, lang: 27 }, dev: { x: W - r - 14, y: t + 22 } };
  const smallRow = (x, y, w, h, gap) => { const sw = (w - (small.length - 1) * gap) / small.length; small.forEach(([id, label], i) => out.push({ id, label, kind: 'wood', small: true, r: R(x + i * (sw + gap), y, sw, h) })); };
  const langRow = (x, y, w, h) => LANG_CHOICES.forEach((c, i) => out.push({ ...c, id: `lang-${c.lang}`, r: R(x + i * (w / 2 + 5), y, w / 2 - 5, h) }));
  const chipRow = (x, y, w, h) => { const cw = (w - 20) / 3; for (let i = 0; i < 3; i++) out.push({ id: `lv${i}`, chip: i, r: R(x + i * (cw + 10), y, cw, h) }); };
  if (rm) {
    // the approved phone layout, centred if the screen is taller than 1560
    const px = (W - 720) / 2, pitch = S.saved ? 96 : 104, h = S.saved ? 82 : 88, last = (S.saved ? 852 : 900) + rows.length * pitch + 8 + 172 + 36 + LKH + 14;
    const dy = Math.max(0, (H - 1560) / 2) + Math.min(0, H - b - 10 - last), y0 = (S.saved ? 852 : 900) + dy;       // slid up if the home indicator would cover the footer
    rows.forEach((rw, i) => out.push({ ...rw, r: R(90 + px, y0 + i * pitch, 540, h) }));
    const yb = y0 + rows.length * pitch + 8;
    smallRow(40 + px, yb, 640, 72, 10);
    out.push({ id: 'lv0', chip: 0, r: R(40 + px, y0 - 92, 210, 60) }, { id: 'lv1', chip: 1, r: R(255 + px, y0 - 92, 210, 60) }, { id: 'lv2', chip: 2, r: R(470 + px, y0 - 92, 210, 60) });
    out.push({ ...LANG_CHOICES[0], id: 'lang-zh', r: R(90 + px, yb + 100, 260, 72) }, { ...LANG_CHOICES[1], id: 'lang-en', r: R(370 + px, yb + 100, 260, 72) });
    Object.assign(v, { lockup: { x: W / 2, y: yb + 172 + 36 + 12, h: LKH }, art: { x: px, y: dy, k: 1 }, oppLabel: { x: W / 2, y: y0 - 100 }, langLabel: { x: W / 2, y: yb + 92 }, foot: { x: W / 2, y: yb + 172 + 36 } });
  } else if (!wide) {
    const cw = Math.min(W - 32, 680), x0 = W / 2 - cw / 2, rowsN = Math.ceil(rows.length / 2), bh = 76, pitch = 84, gap = 12;
    const lockup = { x: W / 2, y: H - b - 12 - LKH, h: LKH }; let y = lockup.y - 6; const foot = { x: W / 2, y: y - 4 }; y -= 30;
    const langY = y - 64; const langLabel = { x: W / 2, y: langY - 8 }; y = langY - 8 - 22 - 8;
    const smallY = y - 64; y = smallY - 12;
    const mainTop = y - rowsN * pitch + (pitch - bh);
    rows.forEach((rw, i) => { const bw = (cw - gap) / 2, last = i === rows.length - 1 && rows.length % 2 === 1; out.push({ ...rw, r: R(last ? x0 : x0 + (i % 2) * (bw + gap), mainTop + Math.floor(i / 2) * pitch, last ? cw : bw, bh) }); });
    y = mainTop - 12;
    const chipY = y - 62; const oppLabel = { x: W / 2, y: chipY - 6 }; y = chipY - 6 - 22 - 4;
    chipRow(x0, chipY, cw, 62); smallRow(x0, smallY, cw, 64, 8); langRow(x0, langY, cw, 64);
    const aTop = t + 6 + 44, aH = Math.max(150, y - aTop), k = clamp(Math.min(aH / ART_H, W / 720), 0.3, 1);
    Object.assign(v, { lockup, art: { x: W / 2 - 360 * k, y: aTop + Math.max(0, (aH - ART_H * k) / 2), k }, oppLabel, langLabel, foot, size: { main: 32, small: 25, chip: 22, lang: 25 } });
  } else {
    const Rw = Math.min(560, Math.floor(W * 0.46)), rx = W - r - 22 - Rw, avail = H - t - b - 20, n = rows.length;
    const fixed = 96 + 74 + 96 + 26 + LKH + 14, pitch = clamp((avail - fixed) / n, 56, 78), bh = pitch - 8, total = fixed + n * pitch;
    let y = t + 10 + Math.max(0, (avail - total) / 2);
    const oppLabel = { x: rx + Rw / 2, y: y + 16 }; chipRow(rx, y + 24, Rw, 62); y += 96;
    rows.forEach((rw, i) => out.push({ ...rw, r: R(rx, y + i * pitch, Rw, bh) })); y += n * pitch + 4;
    smallRow(rx, y, Rw, 62, 8); y += 74;
    const langLabel = { x: rx + Rw / 2, y: y + 16 }; langRow(rx, y + 24, Rw, 62); y += 96;
    const aL = l + 16, aW = rx - 20 - aL, aTop = t + 6 + 44, aH = H - t - b - 12 - 44, k = clamp(Math.min(aW / 720, aH / ART_H), 0.3, 1);
    Object.assign(v, { lockup: { x: rx + Rw / 2, y: y + 28, h: LKH }, art: { x: aL + aW / 2 - 360 * k, y: aTop + Math.max(0, (aH - ART_H * k) / 2), k }, oppLabel, langLabel, foot: { x: rx + Rw / 2, y: y + 14 }, size: { main: 32, small: 24, chip: 22, lang: 24 } });
  }
  // tap zone of the lockup: padded to >= 44 css px, never over a button (it starts at the lockup's top edge, below the footer line)
  { const k = v.lockup, kw = k.h * 1200 / 327, m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(kw + 24, m), th = Math.max(k.h + 12, m), y0 = k.y - 4;
    v.lockTap = R(k.x - tw / 2, y0, tw, Math.max(k.h + 8, Math.min(th, H - y0))); }
  return v;
}
export const titleRects = (S) => titleLayout(S).rects;

const HERO = [[18, 0.2, 545, 350, 150], [27, -0.2, 175, 350, 150], [31, 0, 360, 322, 190]];
export function renderTitle(ctx, S, rs) {
  drawTable(ctx);
  const t = S.prefs.calm ? 0 : S.t, style = S.prefs.style, L = titleLayout(S), sz = L.size;
  // drifting tiles behind everything
  for (let i = 0; i < 18; i++) {
    const kind = (i * 11 + 5) % 34, w = 34 + (i % 4) * 12, sp = 10 + (i % 5) * 5;
    const y = ((i * 211 + t * sp) % (H + 140)) - 100, x = (i * 97 + Math.sin(t * 0.3 + i) * 30) % W;
    drawTileAt(ctx, -1, kind, x, y, w, Math.sin(t * 0.4 + i * 2) * 0.6, 1, style, { alpha: 0.13, shadow: false });
  }
  // the art: glow, the three hero tiles, the name
  ctx.save(); ctx.translate(L.art.x, L.art.y); ctx.scale(L.art.k, L.art.k);
  const gl = ctx.createRadialGradient(360, 360, 20, 360, 380, 380); const pu = 0.5 + 0.5 * Math.sin(t * 1.4);
  gl.addColorStop(0, `rgba(255,226,140,${0.4 + 0.1 * pu})`); gl.addColorStop(0.5, 'rgba(120,230,180,0.12)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, 720, 800);
  HERO.forEach(([k, rot, x, y, w], i) => drawTileAt(ctx, -1, k, x, y + Math.sin(t * 1.3 + i * 1.7) * 9, w, rot + Math.sin(t * 0.9 + i) * 0.03, 1, style, { ss: 4, lift: 0.35 }));
  tx(ctx, '麻將', 360, 572, 64, 'rgba(241,207,122,0.85)', { font: CJKF, shadow: true });
  const g = ctx.createLinearGradient(0, 570, 0, 690); g.addColorStop(0, '#fff2bd'); g.addColorStop(0.5, '#f1cf7a'); g.addColorStop(1, '#c48d2c');
  tx(ctx, 'Mahjong', 360, 682, 138, g, { font: DISPLAY, shadow: true });
  tx(ctx, 'The game of the four winds', 360, 736, 32, 'rgba(247,239,214,0.9)', { font: DISPLAY, weight: 600 });
  ctx.restore();
  { const k = L.lockup, kw = k.h * 1200 / 327, dn = pressed(rs, L.lockTap);      // the themed Arcforge lockup: bottom centre under the menu
    ctx.save(); ctx.fillStyle = 'rgba(4,28,20,0.6)'; ctx.beginPath(); ctx.roundRect(k.x - kw / 2 - 10, k.y - 5, kw + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockupImage(ctx, k.x, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1); }
  for (const b of L.rects) {
    if (b.chip !== undefined) {
      const on = S.prefs.level === b.chip;
      btn(ctx, b.r, LEVELS[b.chip].name, { kind: on ? 'gold' : 'wood', size: sz.chip, pressed: false, off: false });
      continue;
    }
    if (b.lang !== undefined) {
      const on = S.prefs.lang === b.lang;
      btn(ctx, b.r, b.label, { kind: on ? 'gold' : 'wood', size: sz.lang, font: b.lang === 'zh' ? CJKF : DISPLAY, pressed: pressed(rs, b.r) });
      continue;
    }
    btn(ctx, b.r, b.label, { kind: b.kind, size: b.small ? sz.small : sz.main, sub: b.sub, pressed: pressed(rs, b.r) });
  }
  tx(ctx, 'Opponents', L.oppLabel.x, L.oppLabel.y, 20, 'rgba(241,207,122,0.85)', { weight: 600 });
  tx(ctx, 'Language', L.langLabel.x, L.langLabel.y, 20, 'rgba(241,207,122,0.85)', { weight: 600 });
  tx(ctx, 'Score only. No stakes. Works offline.', L.foot.x, L.foot.y, 18, 'rgba(247,239,214,0.6)', { weight: 600 });
  if (S.dev) tx(ctx, 'dev', L.dev.x, L.dev.y, 18, '#f88', { align: 'right' });         // dev marker: top-right, never over a real button
}

// ------------------------------------------------------------------------------------------------- settings
export const SETTINGS = [
  { id: 'sound', label: 'Sound', get: (p) => (p.sound ? 'On' : 'Muted') },
  { id: 'calm', label: 'Reduced motion', get: (p) => (p.calm ? 'On' : 'Off') },
  { id: 'big', label: 'Large text', get: (p) => (p.big ? 'On' : 'Off') },
  { id: 'timer', label: 'Claim timer (9 s)', get: (p) => (p.timer ? 'On' : 'Off') },
  { id: 'hints', label: 'Why? hints', get: (p) => (p.hints ? 'On' : 'Off') },
  { id: 'pace', label: 'Computer speed', get: (p) => (p.pace === 'fast' ? 'Fast' : 'Relaxed') },
  { id: 'minFan', label: 'Fan needed to win', get: (p) => `${p.minFan} fan` },
  { id: 'style', label: 'Tile faces', get: (p) => STYLE_NAMES[p.style] },
];
export const BACK = R(210, 1424, 300, 86);
const settingsCache = { key: '', v: null };
function settingsGeo() {
  if (settingsCache.key === GEO.key) return settingsCache.v;
  const { t, b, l, r } = ins(), rm = roomy(), wide = GEO.wide, n = SETTINGS.length, v = {};
  if (rm) {
    const dy0 = Math.max(0, (H - 1560) / 2) + Math.min(0, H - b - 8 - 1510), px = (W - 720) / 2, ex = Math.max(0, topClear() - (190 + dy0)), dy = dy0 + ex, LY = 190 + n * 98 + dy;
    Object.assign(v, { title: { y: Math.max(130 + dy0, t + 66), size: 84 }, rows: SETTINGS.map((_, i) => R(40 + px, 190 + i * 98 + dy, 640, 84)), langLabel: LY + 26, langRects: LANG_CHOICES.map((c, i) => ({ ...c, r: R(40 + px + i * 330, LY + 34, 300, 84) })), preview: R(40 + px, 1112 + dy, 640, Math.max(190, 250 - ex)), back: R(210 + px, 1424 + dy0, 300, 86) });
  } else if (!wide) {
    const backH = 76, backY = H - b - 16 - backH, startY = Math.max(t + 112, topClear());
    const langH = 64, langBlock = 22 + 8 + langH + 14, pitch = clamp((backY - 14 - langBlock - startY) / n, 56, 98), rh = pitch - 10, LY = startY + n * pitch;
    const cw = Math.min(W - 40, 680), x0 = W / 2 - cw / 2;
    Object.assign(v, { title: { y: t + 80, size: 64 }, rows: SETTINGS.map((_, i) => R(x0, startY + i * pitch, cw, rh)), langLabel: LY + 18, langRects: LANG_CHOICES.map((c, i) => ({ ...c, r: R(x0 + i * (cw / 2 + 5), LY + 28, cw / 2 - 5, langH) })), preview: null, back: R(W / 2 - 150, backY, 300, backH) });
  } else {
    const colW = Math.min(520, (W - l - r - 60) / 2), x0 = W / 2 - colW - 10, startY = Math.max(t + 76, topClear()), backH = 64, backY = H - b - 12 - backH;
    const per = Math.ceil(n / 2), rh = 66, pitch = 74, LY = startY + per * pitch + 4;
    const rows = SETTINGS.map((_, i) => R(i < per ? x0 : W / 2 + 10, startY + (i % per) * pitch, colW, rh));
    const prevY = LY + 22 + 12 + 58 + 12;
    Object.assign(v, { title: { y: t + 52, size: 52 }, rows, langLabel: LY + 16, langRects: LANG_CHOICES.map((c, i) => ({ ...c, r: R(x0 + i * (colW + 20), LY + 26, colW, 62) })), preview: backY - 8 - prevY >= 96 ? R(x0, prevY, 2 * colW + 20, backY - 8 - prevY) : null, back: R(W / 2 - 150, backY, 300, backH) });
  }
  settingsCache.key = GEO.key; settingsCache.v = v;
  return v;
}
export const settingRect = (i) => settingsGeo().rows[i];
export const settingsLangRects = () => settingsGeo().langRects;
export function renderSettings(ctx, S, rs) {
  drawTable(ctx);
  const G = settingsGeo(), bk = G.back;
  Object.assign(BACK, bk);
  tx(ctx, 'Settings', W / 2, G.title.y, G.title.size, GOLD, { font: DISPLAY, shadow: true });
  SETTINGS.forEach((s, i) => {
    const r = G.rows[i], on = pressed(rs, r);
    panel(ctx, r.x, r.y, r.w, r.h, { alpha: on ? 0.95 : 0.7, r: 22 });
    const ph = Math.min(52, r.h - 20), pw = Math.min(226, r.w * 0.42), v = s.get(S.prefs), onv = v === 'On' || v === 'Fast' || s.id === 'minFan' || s.id === 'style';
    const pr = R(r.x + r.w - pw - 24, r.y + (r.h - ph) / 2, pw, ph);
    txFit(ctx, s.label, r.x + 28, r.y + r.h * 0.64, 32 * big(S) * 0.9 * clamp(r.h / 84, 0.82, 1), IVORY, r.w - pw - 56, { align: 'left', font: DISPLAY, min: 14 });
    ctx.fillStyle = onv ? 'rgba(241,207,122,0.22)' : 'rgba(0,0,0,0.3)'; rr(ctx, pr.x, pr.y, pr.w, pr.h, pr.h / 2); ctx.fill();
    ctx.strokeStyle = onv ? GOLD : 'rgba(247,239,214,0.35)'; ctx.lineWidth = 2; rr(ctx, pr.x, pr.y, pr.w, pr.h, pr.h / 2); ctx.stroke();
    txFit(ctx, v, pr.x + pr.w / 2, pr.y + pr.h / 2 + 8, 25, onv ? GOLD : 'rgba(247,239,214,0.7)', pr.w - 16, { font: s.id === 'minFan' ? UI : DISPLAY, min: 14 });
  });
  tx(ctx, 'Language', W / 2, G.langLabel, 20, 'rgba(241,207,122,0.85)', { weight: 600 });
  G.langRects.forEach((b) => {
    const on = S.prefs.lang === b.lang;
    btn(ctx, b.r, b.label, { kind: on ? 'gold' : 'wood', size: 27, font: b.lang === 'zh' ? CJKF : DISPLAY, pressed: pressed(rs, b.r) });
  });
  if (G.preview) {
    const pv = G.preview;
    panel(ctx, pv.x, pv.y, pv.w, pv.h, { alpha: 0.5, r: 22 });
    tx(ctx, 'Preview', W / 2, pv.y + 40, 20, 'rgba(241,207,122,0.85)', { weight: 600 });
    const tw = clamp(Math.min(62, (pv.w - 40) / 8 / 1.2, (pv.h - 70) / 1.34), 30, 62), pitch = Math.min(76.6, (pv.w - 40) / 8);
    [4, 12, 18 + 4, 27, 31, 33, 36, 40].forEach((k, i) => tileByKind(ctx, k, W / 2 - pitch * 3.5 + i * pitch, pv.y + pv.h - 14 - tw * 0.67 - 4, tw, S.prefs.style));
  }
  btn(ctx, bk, 'Back', { kind: 'gold', size: 38, pressed: pressed(rs, bk) });
}

// ------------------------------------------------------------------------------------------------- how / about / rules
const pagesCache = { key: '', v: null };
export function pagesGeo() {
  if (pagesCache.key === GEO.key) return pagesCache.v;
  const { t, b, l, r } = ins(), rm = roomy(), wide = GEO.wide, bc = backClear(), v = {};
  if (rm) {
    const dy = Math.max(0, (H - 1560) / 2), px = (W - 720) / 2, sy = Math.max(24 + dy, t + 10), shifted = sy > 24 + dy;
    const titleY = shifted ? Math.max(170 + dy, sy + 62 + 78) : 170 + dy, py = shifted ? titleY + 40 : 210 + dy, pagerY = Math.min(1400 + dy, H - b - 8 - 86);
    Object.assign(v, { title: { y: titleY, size: 84, x: W / 2, maxW: W - 40 }, panel: R(40 + px, py, 640, shifted || pagerY < 1400 + dy ? pagerY - 70 - py : 1120), pager: { x: 40 + px, span: 640, y: pagerY, h: 86, gap: 20 }, dec: R(Math.max(40 + px, bc), sy, 120, 62), inc: R(W - 160 - px, sy, 120, 62), sub: 60, body: 28 });
  } else if (!wide) {
    const pagerH = 76, pagerY = H - b - 16 - pagerH, pw = Math.min(W - 24, 680), px = W / 2 - pw / 2, py = t + 84, ph = pagerY - 14 - py, sy = t + 10;
    const dec = R(Math.max(16, bc), sy, 100, 66), inc = R(W - r - 16 - 100, sy, 100, 66);
    Object.assign(v, { title: { y: sy + 46, size: 52, x: (dec.x + dec.w + inc.x) / 2, maxW: inc.x - (dec.x + dec.w) - 16 }, panel: R(px, py, pw, ph), pager: { x: px, span: pw, y: pagerY, h: pagerH, gap: 14 }, dec, inc, sub: 46, body: 28 });
  } else {
    const pagerH = 66, pagerY = H - b - 10 - pagerH, pw = Math.min(W - l - r - 40, 980), px = W / 2 - pw / 2, py = t + 78, ph = pagerY - 10 - py, sy = t + 8;
    const dec = R(Math.max(16 + l, bc), sy, 100, 64), inc = R(W - r - 16 - 100, sy, 100, 64);
    Object.assign(v, { title: { y: sy + 40, size: 44, x: (dec.x + dec.w + inc.x) / 2, maxW: inc.x - (dec.x + dec.w) - 16 }, panel: R(px, py, pw, ph), pager: { x: px, span: pw, y: pagerY, h: pagerH, gap: 14 }, dec, inc, sub: 40, body: 26 });
  }
  pagesCache.key = GEO.key; pagesCache.v = v;
  return v;
}
// The pager row fills the panel's width with however many of Previous/Back/Next apply on this page.
export function pagerRects(hasPrev, hasNext) {
  const { x: X0, span: SPAN, gap: GAP, y: Y, h: H0 } = pagesGeo().pager;
  const n = 1 + (hasPrev ? 1 : 0) + (hasNext ? 1 : 0), w = (SPAN - GAP * (n - 1)) / n;
  let x = X0;
  const next = () => { const r = { x, y: Y, w, h: H0 }; x += w + GAP; return r; };
  return { prev: hasPrev ? next() : null, back: next(), next: hasNext ? next() : null };
}
// Text-size stepper for these reference pages ("A-"/"A+"): top corners, clear of the host back button.
export const TEXT_STEPPER = { dec: R(40, 24, 120, 62), inc: R(W - 160, 24, 120, 62) };
// Re-aim every fixed-name rect at the current screen (game.js calls this whenever the size changes).
export function syncScreens() {
  const G = pagesGeo(), P = pauseGeo(), lg = lessonNav();
  Object.assign(TEXT_STEPPER.dec, G.dec); Object.assign(TEXT_STEPPER.inc, G.inc);
  Object.assign(PAUSE_RECTS.resume, P.resume); Object.assign(PAUSE_RECTS.sound, P.sound); Object.assign(PAUSE_RECTS.quit, P.quit);
  Object.assign(LEARN_BACK, learnGeo().back);
  Object.assign(DAILY_RECTS.play, dailyGeo().play); Object.assign(DAILY_RECTS.back, dailyGeo().back);
  Object.assign(DEMO_MENU, demoGeo().menu);
  Object.assign(LESSON_BACK, lg.back); Object.assign(LESSON_HINT, lg.hint); Object.assign(LESSON_NEXT, lg.next);
  Object.assign(BACK, settingsGeo().back);
}

// One row of real tiles (drawn with the game's own tileByKind - never a separate simplified icon), centred,
// with an optional caption underneath. Used by Rules pages that show the tile set. `y` tracks the next free
// top edge, so captions never overlap the tile art below or above them. Returns the y just below the rows.
const TILE_ASPECT = 4 / 3; // FH / FW from tiles.js, fixed for every style
function drawTileRows(ctx, rows, style, yStart, cx, maxW) {
  let y = yStart;
  for (const row of rows) {
    const tiles = row.tiles, n = tiles.length, gap = row.gap ?? 14;
    const tw = Math.min(row.tw || 56, (maxW - (n - 1) * gap) / n), th = tw * TILE_ASPECT;
    const total = n * tw + (n - 1) * gap;
    let x = cx - total / 2 + tw / 2;
    const cy = y + th / 2;
    for (const k of tiles) { tileByKind(ctx, k, x, cy, tw, style); x += tw + gap; }
    y += th + 8;
    if (row.caption) { tx(ctx, row.caption, cx, y, 18, 'rgba(247,239,214,0.72)', { weight: 600, base: 'top' }); y += 26; }
    y += 12;
  }
  return y + 8;
}
// Shrinks the page-title size only if it would overflow the panel.
function fitTitleSize(ctx, str, base, maxW) {
  let size = base;
  ctx.save(); ctx.font = `700 ${size}px ${DISPLAY}`;
  while (ctx.measureText(str).width > maxW && size > 30) { size -= 2; ctx.font = `700 ${size}px ${DISPLAY}`; }
  ctx.restore();
  return size;
}
// ONE continuous scrolling document per reader. The page lists in content.js are cut into short pages ("... (cont. 2)", sentences split
// across pages); the reader groups pages of the same topic into one section and joins fragments that do not end a sentence.
const endsSentence = (s) => /[.!?:]["')\]]?$/.test(s.trim());
const groupsCache = new Map();
function groupsOf(list) {
  if (groupsCache.has(list)) return groupsCache.get(list);
  const groups = [];
  for (const p of list) {
    const base = p.title.replace(/\s*\(cont\. \d+\)\s*$/, '');
    let g = groups[groups.length - 1];
    if (!g || g.title !== base) { g = { title: base, items: [], open: false }; groups.push(g); }
    if (p.tileRows) { g.items.push({ tiles: p.tileRows }); g.open = false; }
    for (const ln of p.lines) {
      if (g.open) g.items[g.items.length - 1].t += ' ' + ln; else g.items.push({ t: ln });
      g.open = !endsSentence(g.items[g.items.length - 1].t);
    }
  }
  groupsCache.set(list, groups);
  return groups;
}
const flowCache = new Map();
function pages(ctx, S, rs, list, page, title) {
  drawTable(ctx);
  const G = pagesGeo(), pn = G.panel, scale = TEXT_SCALES[S.prefs.textScaleIdx] ?? 1, cx = pn.x + pn.w / 2;
  // Scroll position belongs to (scene, text size, screen size): any change starts at the top.
  const sk = `${S.scene}|${S.prefs.textScaleIdx}|${GEO.key}`;
  if (S.scrollKey !== sk) { S.scrollKey = sk; S.scroll = 0; S.scrollMax = 0; }
  S.scroll = clamp(S.scroll || 0, 0, S.scrollMax || 0);
  txFit(ctx, title, G.title.x, G.title.y, Math.round(G.title.size * Math.min(scale, 1.15)), GOLD, G.title.maxW, { font: DISPLAY, shadow: true, min: 28 });
  panel(ctx, pn.x, pn.y, pn.w, pn.h, { alpha: 0.7 });
  const clipTop = pn.y + 14, clipBot = pn.y + pn.h - 40, tx0 = pn.x + 44, tw = pn.w - 88;
  const fontPx = Math.round(G.body * scale), lh = Math.round(G.body * 1.357 * scale), subPx = Math.round(G.sub * Math.min(scale, 1.15));
  const style = S.prefs.style;
  // layout pass (once per scene / text size / panel size): every block gets its height; drawing is then culled to the viewport
  const fkey = `${S.scene}|${scale}|${Math.round(tw)}|${Math.round(G.sub)}|${Math.round(G.body)}|${style}`;
  let F = flowCache.get(fkey);
  if (!F) {
    const blocks = []; let y = 0;
    ctx.save(); ctx.globalAlpha = 0;
    for (const g of groupsOf(list)) {
      const sz = fitTitleSize(ctx, g.title, subPx, pn.w - 40), top = y;
      blocks.push({ k: 'head', y, text: g.title, size: sz });
      // the first paragraph's baseline sits clear of the heading's descenders and its rule, at any text size (tile rows are top-anchored and need less)
      y += sz + (g.items[0] && !g.items[0].tiles ? 30 + Math.round(fontPx * 0.85) : 34);
      for (const it of g.items) {
        if (it.tiles) { const e = drawTileRows(ctx, it.tiles, style, 0, cx, tw); blocks.push({ k: 'tiles', y, rows: it.tiles, h: e }); y += e + Math.max(0, fontPx - 28); }
        else { const n = wrap(ctx, it.t, tx0, 0, fontPx, tw, IVORY, { align: 'left', lh }); blocks.push({ k: 'para', y, text: it.t, h: n * lh }); y += n * lh + 26; }
      }
      y += 30; blocks[blocks.length - 1].end = true; void top;
    }
    ctx.restore();
    F = { blocks, total: y }; flowCache.set(fkey, F); if (flowCache.size > 24) flowCache.delete(flowCache.keys().next().value);
  }
  S.scrollMax = Math.max(0, Math.round(F.total - (clipBot - clipTop)));
  S.scroll = clamp(S.scroll, 0, S.scrollMax);
  ctx.save(); ctx.beginPath(); ctx.rect(pn.x + 4, clipTop, pn.w - 8, clipBot - clipTop); ctx.clip();
  const oy = clipTop - S.scroll;
  for (const b of F.blocks) {
    const by = oy + b.y, bh = b.h ?? 80;
    if (by > clipBot + 20 || by + bh < clipTop - 20) continue;
    if (b.k === 'head') {
      tx(ctx, b.text, cx, by + b.size, b.size, IVORY, { font: DISPLAY });
      ctx.strokeStyle = 'rgba(241,207,122,0.4)'; ctx.beginPath(); ctx.moveTo(pn.x + 80, by + b.size + 18); ctx.lineTo(pn.x + pn.w - 80, by + b.size + 18); ctx.stroke();
    } else if (b.k === 'tiles') drawTileRows(ctx, b.rows, style, by, cx, tw);
    else wrap(ctx, b.text, tx0, by, fontPx, tw, IVORY, { align: 'left', lh });
  }
  ctx.restore();
  if (S.scrollMax > 0) {                                           // a slim scroll bar on the panel's right edge
    const trackH = clipBot - clipTop - 8, thumb = Math.max(36, trackH * (clipBot - clipTop) / F.total);
    ctx.fillStyle = 'rgba(247,239,214,0.12)'; rr(ctx, pn.x + pn.w - 12, clipTop + 4, 5, trackH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(241,207,122,0.7)'; rr(ctx, pn.x + pn.w - 12, clipTop + 4 + (trackH - thumb) * (S.scroll / S.scrollMax), 5, thumb, 3); ctx.fill();
  }
  tx(ctx, S.scrollMax > 0 ? (S.scroll >= S.scrollMax - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', cx, pn.y + pn.h - 20, 20, 'rgba(247,239,214,0.7)', { weight: 600 });
  const P = pagerRects(true, true);
  btn(ctx, P.prev, 'Top', { kind: 'wood', size: 30, off: S.scroll < 4, pressed: S.scroll >= 4 && pressed(rs, P.prev) });
  btn(ctx, P.back, 'Back', { kind: 'gold', size: 32 });
  btn(ctx, P.next, 'More', { kind: 'wood', size: 30, off: S.scroll >= S.scrollMax - 2, pressed: pressed(rs, P.next) });
  const atMin = S.prefs.textScaleIdx === 0, atMax = S.prefs.textScaleIdx === TEXT_SCALES.length - 1;
  btn(ctx, TEXT_STEPPER.dec, 'A−', { kind: 'wood', size: 32, off: atMin, pressed: !atMin && pressed(rs, TEXT_STEPPER.dec) });
  btn(ctx, TEXT_STEPPER.inc, 'A+', { kind: 'wood', size: 32, off: atMax, pressed: !atMax && pressed(rs, TEXT_STEPPER.inc) });
}
export const renderHow = (ctx, S, rs) => pages(ctx, S, rs, HOW_PAGES, S.page, 'How to play');
export const renderAbout = (ctx, S, rs) => pages(ctx, S, rs, ABOUT_PAGES, S.page, 'About Mahjong');
export const renderRules = (ctx, S, rs) => pages(ctx, S, rs, RULE_PAGES, S.page, 'Rules');
export const pageCount = (scene) => (scene === 'how' ? HOW_PAGES.length : scene === 'rules' ? RULE_PAGES.length : ABOUT_PAGES.length);

// ------------------------------------------------------------------------------------------------- learn list, daily hub
export const LEARN_BACK = R(210, 1408, 300, 80);
const learnCache = { key: '', v: null };
function learnGeo() {
  if (learnCache.key === GEO.key) return learnCache.v;
  const { t, b, l, r } = ins(), rm = roomy(), wide = GEO.wide, n = LESSONS.length, v = {};
  if (rm) {
    const dy = Math.max(0, (H - 1560) / 2), px = (W - 720) / 2, ty = Math.max(120 + dy, t + 66), startY = ty + 60, backY = Math.min(1408 + dy, H - b - 8 - 80), pitch = Math.min(100, (backY - 14 - startY) / n);
    Object.assign(v, { title: { y: ty, size: 78 }, rows: LESSONS.map((_, i) => R(40 + px, startY + i * pitch, 640, pitch - 12)), back: R(210 + px, backY, 300, 80) });
  } else if (!wide) {
    const backH = 72, backY = H - b - 16 - backH, startY = Math.max(t + 108, topClear()), cw = Math.min(W - 32, 680), x0 = W / 2 - cw / 2, pitch = clamp((backY - 12 - startY) / n, 58, 100);
    Object.assign(v, { title: { y: t + 76, size: 62 }, rows: LESSONS.map((_, i) => R(x0, startY + i * pitch, cw, pitch - 10)), back: R(W / 2 - 150, backY, 300, backH) });
  } else {
    const backH = 62, backY = H - b - 10 - backH, startY = Math.max(t + 76, topClear()), colW = Math.min(580, (W - l - r - 56) / 2), per = Math.ceil(n / 2), pitch = clamp((backY - 10 - startY) / per, 62, 100);
    const x0 = W / 2 - colW - 8;
    Object.assign(v, { title: { y: t + 52, size: 52 }, rows: LESSONS.map((_, i) => R(i < per ? x0 : W / 2 + 8, startY + (i % per) * pitch, colW, pitch - 10)), back: R(W / 2 - 150, backY, 300, backH) });
  }
  learnCache.key = GEO.key; learnCache.v = v;
  return v;
}
export const lessonRect = (i) => learnGeo().rows[i];
export function renderLearn(ctx, S, rs) {
  drawTable(ctx);
  const G = learnGeo();
  tx(ctx, 'Learn to play', W / 2, G.title.y, G.title.size, GOLD, { font: DISPLAY, shadow: true });
  LESSONS.forEach((l, i) => {
    const r = G.rows[i], done = !!S.learned[i], k = clamp(r.h / 88, 0.72, 1), cy = r.y + r.h / 2;
    panel(ctx, r.x, r.y, r.w, r.h, { alpha: pressed(rs, r) ? 0.95 : 0.7, r: Math.min(22, r.h / 3), edge: done ? GOLD : 'rgba(241,207,122,0.4)' });
    tx(ctx, String(i + 1), r.x + 40, cy + 14 * k, 40 * k, done ? GOLD : 'rgba(247,239,214,0.5)', { font: UI });
    txFit(ctx, l.title, r.x + 84, cy - 4 * k, 31 * k, IVORY, r.w - 84 - 90, { align: 'left', font: DISPLAY, min: 16 });
    txFit(ctx, l.blurb, r.x + 84, cy + 24 * k, Math.max(13, 19 * k), 'rgba(247,239,214,0.62)', r.w - 84 - 90, { align: 'left', weight: 500, min: 12 });
    if (done) { ctx.strokeStyle = '#9df0c4'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r.x + r.w - 62 * k, cy + 2 * k); ctx.lineTo(r.x + r.w - 46 * k, cy + 18 * k); ctx.lineTo(r.x + r.w - 20 * k, cy - 16 * k); ctx.stroke(); }
  });
  btn(ctx, LEARN_BACK, 'Back', { kind: 'wood', size: 34, pressed: pressed(rs, LEARN_BACK) });
}

export const DAILY_RECTS = { play: R(110, 1040, 500, 92), back: R(210, 1408, 300, 80) };
const dailyCache = { key: '', v: null };
function dailyGeo() {
  if (dailyCache.key === GEO.key) return dailyCache.v;
  const { t, b, l, r } = ins(), rm = roomy(), wide = GEO.wide, v = {};
  if (rm) {
    const dy = Math.max(0, (H - 1560) / 2), px = (W - 720) / 2;
    Object.assign(v, { title: { y: 130 + dy, size: 78 }, sub: { y: 190 + dy, size: 27 }, panel: R(60 + px, 250 + dy, 600, 700), rowY: (i) => 310 + i * 200 + dy, k: 1, streak: { x: W / 2, y: 1000 + dy, w: 600 }, play: R(110 + px, 1040 + dy, 500, 92), back: R(210 + px, 1408 + dy, 300, 80) });
  } else if (!wide) {
    const backH = 72, backY = H - b - 16 - backH, playH = 84, playY = backY - 12 - playH, streakY = playY - 18, panelY = Math.max(t + 148, topClear() + 40), panelH = streakY - 40 - panelY, pitch = clamp((panelH - 20) / 3, 100, 200);
    const pw = Math.min(W - 40, 600), px = W / 2 - pw / 2;
    Object.assign(v, { title: { y: t + 80, size: 64 }, sub: { y: t + 122, size: 24 }, panel: R(px, panelY, pw, 3 * pitch + 20), rowY: (i) => panelY + 10 + i * pitch, k: clamp(pitch / 200, 0.6, 1), streak: { x: W / 2, y: streakY, w: Math.min(W - 40, 560) }, play: R(W / 2 - 220, playY, 440, playH), back: R(W / 2 - 150, backY, 300, backH) });
  } else {
    const pw = 560, px = Math.max(l + 12, W / 2 - pw - 16), panelY = t + 108, pitch = Math.min(150, (H - t - b - 108 - 40) / 3), cx = Math.max(px + pw + 40, W / 2 + 24), bw = Math.min(340, W - r - 20 - cx);
    Object.assign(v, { title: { y: t + 56, size: 52 }, sub: { y: t + 92, size: 23 }, panel: R(px, panelY, pw, 3 * pitch + 20), rowY: (i) => panelY + 10 + i * pitch, k: clamp(pitch / 200, 0.6, 1), streak: { x: cx + bw / 2, y: panelY + 70, w: bw }, play: R(cx, panelY + 110, bw, 80), back: R(cx, panelY + 210, bw, 72) });
  }
  dailyCache.key = GEO.key; dailyCache.v = v;
  return v;
}
export function renderDailyHub(ctx, S, rs) {
  drawTable(ctx);
  const d = S.daily, G = dailyGeo(), k = G.k, pn = G.panel;
  tx(ctx, 'Daily challenge', W / 2, G.title.y, G.title.size, GOLD, { font: DISPLAY, shadow: true });
  txFit(ctx, 'Three hands. Which tile would you discard?', W / 2, G.sub.y, G.sub.size, 'rgba(247,239,214,0.85)', W - 40, { weight: 600, min: 14 });
  panel(ctx, pn.x, pn.y, pn.w, pn.h, { alpha: 0.7 });
  for (let i = 0; i < 3; i++) {
    const y = G.rowY(i), res = d.results[i];
    tx(ctx, `Puzzle ${i + 1}`, pn.x + 60, y + 60 * k, 38 * Math.max(k, 0.75), IVORY, { align: 'left', font: UI });
    tx(ctx, ['Warm-up', 'Trickier', 'Toughest'][i], pn.x + 60, y + 96 * k, 22 * Math.max(k, 0.8), 'rgba(247,239,214,0.6)', { align: 'left', weight: 600 });
    ctx.beginPath(); ctx.arc(pn.x + pn.w - 100, y + 70 * k, 42 * k, 0, TAU); ctx.fillStyle = res === true ? 'rgba(157,240,196,0.25)' : res === false ? 'rgba(255,177,166,0.2)' : 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.strokeStyle = res === true ? '#9df0c4' : res === false ? '#ffb1a6' : 'rgba(247,239,214,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    tx(ctx, res === true ? 'Yes' : res === false ? 'No' : String(i + 1), pn.x + pn.w - 100, y + 82 * k, 30 * Math.max(k, 0.8), res === null ? 'rgba(247,239,214,0.6)' : ctx.strokeStyle, { font: DISPLAY });
  }
  txFit(ctx, d.streak ? `Streak: ${d.streak} day${d.streak === 1 ? '' : 's'}` : 'Finish all three to start a streak', G.streak.x, G.streak.y, 28, GOLD, G.streak.w, { font: UI, min: 14 });
  const done = d.results.every((r) => r !== null);
  btn(ctx, DAILY_RECTS.play, done ? 'Play again' : d.results.some((r) => r !== null) ? 'Continue' : 'Start', { kind: 'gold', size: 38, pressed: pressed(rs, DAILY_RECTS.play) });
  btn(ctx, DAILY_RECTS.back, 'Back', { kind: 'wood', size: 34, pressed: pressed(rs, DAILY_RECTS.back) });
}

// ------------------------------------------------------------------------------------------------- lesson / daily puzzle scene
export const LESSON_BACK = R(24, 1452, 200, 84);
export const LESSON_NEXT = R(470, 1452, 226, 84);
export const LESSON_HINT = R(246, 1452, 200, 84);
// The three navigation buttons: the bottom row in portrait (same place as the play screen's), a left/right column in landscape.
function lessonNav() {
  const { l, r } = ins();
  if (!GEO.wide) { const px = (W - 720) / 2, y = GEO.bottomY; return { back: R(24 + px, y, 200, 84), hint: R(246 + px, y, 200, 84), next: R(470 + px, y, 226, 84) }; }
  const w = 168, y = H / 2 - 36, h = 72;
  return { back: R(l + 12, y - 84, w, h), hint: R(l + 12, y, w, h), next: R(W - r - 12 - w, y, w, h) };
}
// Where everything sits on a lesson screen, from the bottom up: nav buttons, hand (+ claim row + message), the prompt card on top, the stage in between.
function lessonGeo(S) {
  const { t, b, l, r } = ins(), L = S.lesson, st = L.step, wide = GEO.wide, g = {};
  const handLesson = ['discard', 'claim', 'win', 'score'].includes(st.type);
  const rm = roomy(), compact = !wide && !rm;
  g.title = wide ? { y: t + 38, size: 36 } : compact ? { y: t + 62, size: 44 } : { y: Math.max(100, t + 58), size: 52 };
  g.dots = wide ? t + 60 : compact ? t + 86 : Math.max(128, t + 86);
  g.cardW = wide ? Math.min(900, W - l - r - 380) : Math.min(660, W - 30);
  g.cardX = W / 2 - g.cardW / 2;
  g.cardY = wide ? t + 76 : compact ? t + 104 : Math.max(156, t + 114);
  g.promptSize = wide ? 24 : compact ? 26 : 28; g.promptW = g.cardW - 70;
  g.navTop = wide ? H - b - 8 : GEO.bottomY;
  const tw = Math.min(GEO.handMax, 58), handTop = handLesson ? HAND_Y - tw * 0.667 - 26 : g.navTop - 6;
  g.msgH = 74; g.msgBottom = handTop - 6; g.msgTop = g.msgBottom - g.msgH;
  g.claimH = wide ? 70 : 84; g.claimY = g.msgTop - 8 - g.claimH;
  g.bandBottom = ((st.type === 'claim' || st.type === 'win') ? g.claimY : g.msgTop) - 10;
  g.stageW = wide ? Math.max(480, W - 2 * (Math.max(l, r) + 190)) : Math.min(690, W - 30);
  return g;
}
const lessonState = { S: null };
export function lessonClaimSlots(n) {
  const g = lessonGeo(lessonState.S), out = [], gap = 10, w = Math.min(176, (680 - gap * (n - 1)) / n), total = n * w + gap * (n - 1), x0 = W / 2 - total / 2;
  for (let i = 0; i < n; i++) out.push(R(x0 + i * (w + gap), g.claimY, w, g.claimH));
  return out;
}
const countLines = (ctx, str, size, maxW) => {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; let n = 1, cur = '';
  for (const w of String(str).split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { n++; cur = w; } else cur = t2; }
  ctx.restore(); return n;
};
// The prompt card needs a drawing context to measure its wrapped text; game.js hands it one on every render.
let measureCtx = null;
function cardBottom(S, g) {
  const L = S.lesson, st = L.step, b = big(S), text = L.prompt ?? textOf(st.text, S.prefs.lang);
  const lines = measureCtx ? countLines(measureCtx, text, g.promptSize * b, g.promptW) : Math.ceil(String(text).length / 45);
  const lh = (g.promptSize + 9) * b, cardH = Math.max(g.cardW > 700 ? 90 : 120, lines * lh + 50);
  return { lines, lh, cardH, bottom: g.cardY + cardH };
}

// Where every tile of the current step is. Used for drawing AND hit-testing.
export function lessonScene(S) {
  lessonState.S = S;
  const L = S.lesson, st = L.step, out = { tiles: [], river: null, melds: [], buttons: [], hand: false }, g = lessonGeo(S), card = cardBottom(S, g);
  const bandTop = card.bottom + 12, bandH = Math.max(120, g.bandBottom - bandTop), cy = bandTop + bandH / 2, cx = W / 2;
  out.card = card; out.geo = g; out.band = { top: bandTop, h: bandH, cy };
  const type = st.type;
  if (type === 'tap' || type === 'pick') {
    const rows = st.stage, nr = rows.length, pitch = clamp(bandH / nr, 118, 230); let idx = 0;
    rows.forEach((row, ri) => {
      const n = row.kinds.length, pp = Math.min(80, g.stageW / n), w = Math.min(66, pp - 6, bandH / nr / 1.9), y = cy + (ri - (nr - 1) / 2) * pitch;
      row.kinds.forEach((k, i) => out.tiles.push({ kind: k, x: cx - ((n - 1) * pp) / 2 + i * pp, y, w, idx: idx++, label: row.label }));
      row.y = y;
    });
  } else if (type === 'info') {
    const show = st.show ?? [], n = show.length, ty = cy - 20;
    if (st.grouped) {
      const all = [...show, ...(st.pairShow ?? [])], tw = Math.min(44, (g.stageW - 4 * 16) / all.length - 2), pitch = tw + 2, gaps = 4, total = all.length * pitch + gaps * 16; let x = cx - total / 2 + pitch / 2;
      all.forEach((k, i) => { out.tiles.push({ kind: k, x, y: ty, w: tw, idx: i }); x += pitch; if ((i + 1) % 3 === 0 && i < 12 || i === 11) x += 16; });
    } else { const w = Math.min(112, bandH * 0.62, g.stageW / Math.max(1, n) - 18); show.forEach((k, i) => out.tiles.push({ kind: k, x: cx + (i - (n - 1) / 2) * (w + 18), y: ty, w, idx: i })); }
  } else if (type === 'discard' || type === 'claim' || type === 'win' || type === 'score') {
    out.hand = true;
    const hand = L.hand, has = L.draw >= 0 && (type === 'discard' || type === 'win' || type === 'score'), n = hand.length, m = handMetrics(n, has, S.prefs.big);
    hand.forEach((k, i) => out.tiles.push({ kind: k, x: handTileX(m, i, has, n), y: HAND_Y - (L.sel.includes(i) ? 26 : 0), w: m.tw, idx: i, hand: true, sel: L.sel.includes(i) }));
    if (has) out.tiles.push({ kind: L.draw, x: handTileX(m, n, true, n), y: HAND_Y - (L.sel.includes(n) ? 26 : 0), w: m.tw, idx: n, hand: true, drawn: true, sel: L.sel.includes(n) });
    let used = 0;
    const mw = 34, my = HAND_Y - m.tw * 0.667 - 26 - 6 - mw * 0.667, mx0 = Math.max(24, Math.max(0, host.l) + 12);
    (st.melds || []).forEach((mm, mi) => { for (let ti = 0; ti < 3; ti++) out.melds.push({ kind: mm.kind, x: mx0 + mw / 2 + (used + ti) * (mw + 1.5) + mi * 12, y: my, w: mw }); used += 3; });
    if (type === 'claim') out.river = { kind: st.river.kind, x: cx, y: cy + 10, w: Math.min(118, bandH * 0.55), labelY: cy - Math.min(118, bandH * 0.55) * 0.67 - 14 };
    if (type === 'claim') {
      const fs = fakeState(hand), o = claimOptions(fs, 0, idFor(st.river.kind, 3), st.river.from), list = claimList({ opts: [o] }), slots = lessonClaimSlots(list.length);
      out.buttons = list.map((c, i) => ({ ...c, r: slots[i] }));
      out.opts = o;
    }
    if (type === 'win') { const fs = fakeState(hand); withDraw(fs, L.draw); const w = winInfo(fs, 0, fullHand(fs, 0), true); out.buttons = [{ id: 'win', label: 'Win!', kind: 'gold', r: lessonClaimSlots(1)[0] }]; out.info = w; }
  }
  return out;
}

export function renderLesson(ctx, S, rs) {
  measureCtx = ctx;
  drawTable(ctx);
  const L = S.lesson, st = L.step, b = big(S), sc = lessonScene(S), g = sc.geo, style = S.prefs.style, pulse = 0.5 + 0.5 * Math.sin(S.t * 4), card = sc.card;
  const title = L.daily ? `Daily puzzle ${L.pi + 1} of 3` : LESSONS[L.i].title;
  txFit(ctx, title, W / 2, g.title.y, g.title.size, GOLD, W - 2 * Math.max(200, backClear() + 20), { font: L.daily ? UI : DISPLAY, shadow: true, min: 22 });
  const steps = L.daily ? 3 : LESSONS[L.i].steps.length;
  for (let i = 0; i < steps; i++) { ctx.fillStyle = i < L.si ? GOLD : i === L.si ? IVORY : 'rgba(247,239,214,0.28)'; ctx.beginPath(); ctx.arc(W / 2 + (i - (steps - 1) / 2) * 24, g.dots, 6, 0, TAU); ctx.fill(); }
  const promptText = L.prompt ?? textOf(st.text, S.prefs.lang);
  panel(ctx, g.cardX, g.cardY, g.cardW, card.cardH, { alpha: 0.86 });
  wrap(ctx, promptText, g.cardX + g.cardW / 2, g.cardY + 44 + 4, g.promptSize * b, g.promptW, IVORY, { lh: card.lh });
  // stage
  if (st.type === 'tap' || st.type === 'pick') {
    const rows = st.stage, x0 = W / 2 - g.stageW / 2;
    if (rows.length > 1 || rows[0].label) for (const row of rows) if (row.label) tx(ctx, row.label, x0, row.y - 62, 22, 'rgba(241,207,122,0.85)', { align: 'left' });
  }
  const wrongK = L.wrongT > 0 ? L.wrongIdx : -1;
  for (const t of sc.tiles) {
    const lifted = t.sel;
    if (lifted) { ctx.save(); ctx.fillStyle = 'rgba(255,224,130,0.3)'; ctx.beginPath(); ctx.ellipse(t.x, t.y + t.w * 0.9, t.w * 0.62, t.w * 0.16, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    const glow = t.idx === wrongK ? 0.7 : L.locked && lifted ? 0.7 : lifted ? 0.4 : L.hintIdx === t.idx ? 0.5 + 0.4 * pulse : 0;
    drawTileAt(ctx, -1, t.kind, t.x, t.y - (st.type === 'pick' && lifted ? 20 : 0), t.w, 0, 1, style, { glow, lift: lifted ? 0.4 : 0 });
  }
  for (const m of sc.melds) drawTileAt(ctx, -1, m.kind, m.x, m.y, m.w, 0, 1, style, {});
  if (sc.river) {
    tx(ctx, `${['', 'Mei', 'Lin', 'Jun'][st.river.from]} discards`, W / 2, sc.river.labelY, 28, 'rgba(247,239,214,0.85)', { font: DISPLAY, weight: 700 });
    drawTileAt(ctx, -1, sc.river.kind, sc.river.x, sc.river.y, sc.river.w, 0, 1, style, { glow: 0.4 + 0.3 * pulse, lift: 0.3 });
  }
  if (st.type === 'score' && L.info) {
    const info = L.info, n = info.patterns.length, pitch = clamp((sc.band.h - 130) / Math.max(1, n), 40, 64), f = clamp(pitch / 64, 0.72, 1), y0 = sc.band.top + 28, x0 = W / 2 - Math.min(300, g.stageW / 2), x1 = W / 2 + Math.min(300, g.stageW / 2);
    tx(ctx, 'HOW IT SCORED', x0, y0, 18, 'rgba(241,207,122,0.85)', { align: 'left' });
    info.patterns.forEach((p, i) => { tx(ctx, p.name, x0, y0 + 46 * f + i * pitch, 30 * f, IVORY, { align: 'left', font: DISPLAY }); tx(ctx, `${p.fan} fan`, x1, y0 + 44 * f + i * pitch, 27 * f, GOLD, { align: 'right', font: UI }); txFit(ctx, p.why, x0, y0 + 72 * f + i * pitch, Math.max(13, 18 * f), 'rgba(247,239,214,0.65)', x1 - x0, { align: 'left', weight: 500, min: 11 }); });
    const ty = y0 + 70 * f + n * pitch;
    tx(ctx, `${info.fan} fan = ${pointsFor(info.fan)} points`, W / 2, ty + 30 * f, 44 * f, GOLD, { font: UI, shadow: true });
  }
  if (st.type === 'info' && !st.show?.length) tx(ctx, '牌', W / 2, sc.band.cy + 100, Math.min(260, sc.band.h * 0.8), 'rgba(241,207,122,0.09)', { font: CJKF });
  // claim / win buttons
  for (const o of sc.buttons) btn(ctx, o.r, o.label, { kind: o.kind, size: 36, pulse: o.kind === 'gold' ? pulse : 0, pressed: pressed(rs, o.r) });
  // message
  if (L.msg) {
    const fs = 25 * b * (GEO.wide ? 0.92 : 1), lines = []; ctx.save(); ctx.font = `600 ${fs}px ${UI}`; let cur = ''; const mw = Math.min(660, W - 40) - 40; for (const w of L.msg.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > mw && cur) { lines.push(cur); cur = w; } else cur = t2; } lines.push(cur); ctx.restore();
    if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].replace(/\s*\S*$/, '') + '...'; }
    const lh = fs * 1.24, bh = lines.length * lh + 22, bw = Math.min(660, W - 40), bx = W / 2 - bw / 2, by = g.msgBottom - bh;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, bx, by, bw, bh, 20); ctx.fill(); ctx.strokeStyle = L.msgGood ? 'rgba(157,240,196,0.7)' : 'rgba(241,207,122,0.5)'; ctx.lineWidth = 1.5; rr(ctx, bx, by, bw, bh, 20); ctx.stroke();
    lines.forEach((ln, i) => tx(ctx, ln, W / 2, by + 11 + fs * 0.85 + i * lh, fs, L.msgGood ? '#c8ffe2' : IVORY, { weight: 600 }));
  }
  btn(ctx, LESSON_BACK, L.daily ? 'Exit' : 'Lessons', { kind: 'wood', size: 30, pressed: pressed(rs, LESSON_BACK) });
  if (L.canHint) btn(ctx, LESSON_HINT, 'Hint', { kind: 'gold', size: 30, pressed: pressed(rs, LESSON_HINT) });
  if (L.done || st.type === 'info' || st.type === 'score') btn(ctx, LESSON_NEXT, L.lastStep ? 'Finish' : 'Next', { kind: 'gold', size: 34, pulse, pressed: pressed(rs, LESSON_NEXT) });
}

// ------------------------------------------------------------------------------------------------- overlays
export const PAUSE_RECTS = { resume: R(130, 640, 460, 88), sound: R(130, 750, 460, 88), quit: R(130, 860, 460, 88) };
const pauseCache = { key: '', v: null };
function pauseGeo() {
  if (pauseCache.key === GEO.key) return pauseCache.v;
  const rm = roomy(), pw = Math.min(540, W - 30), ph = rm ? 520 : 460, top = rm ? 540 + Math.max(0, (H - 1560) / 2) : (H - ph) / 2, bw = Math.min(460, pw - 60), bx = W / 2 - bw / 2;
  const d = rm ? { title: 70, y0: 100, pitch: 110, h: 88, note: 470 } : { title: 62, y0: 86, pitch: 96, h: 80, note: 424 };
  const v = { panel: R(W / 2 - pw / 2, top, pw, ph), title: top + d.title, note: top + d.note, resume: R(bx, top + d.y0, bw, d.h), sound: R(bx, top + d.y0 + d.pitch, bw, d.h), quit: R(bx, top + d.y0 + 2 * d.pitch, bw, d.h) };
  pauseCache.key = GEO.key; pauseCache.v = v;
  return v;
}
export function renderPause(ctx, S, rs) {
  const auto = S.scene === 'auto', G = pauseGeo(), pn = G.panel;
  ctx.fillStyle = 'rgba(0,10,6,0.7)'; ctx.fillRect(0, 0, W, H);
  panel(ctx, pn.x, pn.y, pn.w, pn.h, { alpha: 0.95 });
  tx(ctx, 'Paused', W / 2, G.title, 66, GOLD, { font: DISPLAY, shadow: true });
  btn(ctx, PAUSE_RECTS.resume, 'Resume', { kind: 'gold', size: 36, pressed: pressed(rs, PAUSE_RECTS.resume) });
  btn(ctx, PAUSE_RECTS.sound, S.prefs.sound ? 'Sound: on' : 'Sound: off', { kind: 'jade', size: 32, pressed: pressed(rs, PAUSE_RECTS.sound) });
  btn(ctx, PAUSE_RECTS.quit, auto ? 'Exit to menu' : 'Save and leave', { kind: 'wood', size: 32, pressed: pressed(rs, PAUSE_RECTS.quit) });
  txFit(ctx, auto ? 'This Auto Play demonstration is not saved.' : 'Your hand is saved when you leave.', W / 2, G.note, 20, 'rgba(247,239,214,0.65)', pn.w - 30, { weight: 600, min: 12 });
}
export const DEMO_MENU = R(160, 900, 400, 84);
const demoCache = { key: '', v: null };
function demoGeo() {
  if (demoCache.key === GEO.key) return demoCache.v;
  const rm = roomy(), top = rm ? 400 + Math.max(0, (H - 1560) / 2) : Math.max(8, (H - 640) / 2), pw = Math.min(600, W - 30);
  const v = { panel: R(W / 2 - pw / 2, top, pw, 640), menu: R(W / 2 - 200, top + 500, 400, 84), top };
  demoCache.key = GEO.key; demoCache.v = v;
  return v;
}
export function renderDemoLimit(ctx, S) {
  drawTable(ctx);
  const G = demoGeo(), pn = G.panel;
  panel(ctx, pn.x, pn.y, pn.w, pn.h, { alpha: 0.92 });
  tx(ctx, '麻將', W / 2, G.top + 120, 110, 'rgba(241,207,122,0.9)', { font: CJKF });
  tx(ctx, 'That was the preview', W / 2, G.top + 220, 54, GOLD, { font: DISPLAY, shadow: true });
  wrap(ctx, 'The web preview ends here. Get the full game on iPhone and Android for unlimited hands, all lessons and the daily challenge.', W / 2, G.top + 290, 28, Math.min(500, pn.w - 60), IVORY, { lh: 38 });
  btn(ctx, DEMO_MENU, 'Main menu', { kind: 'wood', size: 34 });
}
