// Every screen that is not the table: title, settings, How to play, About, lessons, daily challenge, pause, demo limit.
// `*Rects` functions are the single source for both drawing and tapping.
import { W, H, HAND_Y, handMetrics, handTileX, meldOrigin, inRect, TEXT_SCALES } from './layout.js';
import { DISPLAY, UI, CJKF, GOLD, IVORY, INK, TAU, tx, wrap, rr, btn, panel, drawTable, drawTileAt, tileByKind } from './draw.js';
import { LEVELS } from './ai.js';
import { HOW_PAGES, ABOUT_PAGES, RULE_PAGES } from './content.js';
import { LESSONS, stageTiles, NEED_COUNT, fakeState, withDraw, idFor, textOf } from './lessons.js';
import { STYLE_NAMES } from './tiles.js';
import { winInfo, pointsFor, kindName, fullHand, claimOptions } from './rules.js';
import { claimRects, claimList } from './view.js';

const big = (S) => (S.prefs.big ? 1.18 : 1);

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
// Below the how/about/settings row, spanning the same x=90..630 the main title buttons use.
export const titleLangRects = (y) => LANG_CHOICES.map((c, i) => ({ ...c, id: `lang-${c.lang}`, r: { x: 90 + i * 280, y, w: 260, h: 72 } }));

// ------------------------------------------------------------------------------------------------- title
export function titleRects(S) {
  const rows = [];
  if (S.saved) rows.push({ id: 'continue', label: 'Continue hand', kind: 'gold', sub: `${S.saved.match.mode === 'round' ? 'East round' : 'Single hand'} in progress` });
  rows.push({ id: 'round', label: 'East round', kind: S.saved ? 'jade' : 'gold', sub: 'Four deals, one game' });
  rows.push({ id: 'hand', label: 'Quick hand', kind: 'jade', sub: 'A single deal' });
  rows.push({ id: 'learn', label: 'Learn to play', kind: 'jade', sub: `${Object.keys(S.learned).length} of ${LESSONS.length} lessons done` });
  rows.push({ id: 'daily', label: 'Daily challenge', kind: 'jade', sub: S.daily.doneDay === S.daily.day ? 'Done today' : S.daily.streak ? `Streak ${S.daily.streak}` : 'Three tile puzzles' });
  const y0 = S.saved ? 852 : 900, pitch = S.saved ? 96 : 104, h = S.saved ? 82 : 88;
  const out = rows.map((r, i) => ({ ...r, r: { x: 90, y: y0 + i * pitch, w: 540, h } }));
  const yb = y0 + rows.length * pitch + 8;
  // Controls/About/Rules/Settings share one row; Auto Play is the addition (was 4 columns, now 5 -
  // same row, same total span x=40..680, so nothing below it (the Language row) moves).
  const small = [['how', 'How to play'], ['about', 'About'], ['rules', 'Rules'], ['auto', 'Auto Play'], ['settings', 'Settings']];
  const smallGap = 10, smallW = (640 - (small.length - 1) * smallGap) / small.length;
  small.forEach(([id, label], i) => out.push({ id, label, kind: 'wood', small: true, r: { x: 40 + i * (smallW + smallGap), y: yb, w: smallW, h: 72 } }));
  out.push({ id: 'lv0', chip: 0, r: { x: 40, y: y0 - 92, w: 210, h: 60 } }, { id: 'lv1', chip: 1, r: { x: 255, y: y0 - 92, w: 210, h: 60 } }, { id: 'lv2', chip: 2, r: { x: 470, y: y0 - 92, w: 210, h: 60 } });
  out.push(...titleLangRects(yb + 72 + 28));
  return out;
}
const HERO = [[18, 0.2, 545, 350, 150], [27, -0.2, 175, 350, 150], [31, 0, 360, 322, 190]];
export function renderTitle(ctx, S, rs) {
  drawTable(ctx);
  const t = S.prefs.calm ? 0 : S.t, style = S.prefs.style;
  // drifting tiles behind everything
  for (let i = 0; i < 18; i++) {
    const kind = (i * 11 + 5) % 34, w = 34 + (i % 4) * 12, sp = 10 + (i % 5) * 5;
    const y = ((i * 211 + t * sp) % 1700) - 100, x = (i * 97 + Math.sin(t * 0.3 + i) * 30) % 720;
    drawTileAt(ctx, -1, kind, x, y, w, Math.sin(t * 0.4 + i * 2) * 0.6, 1, style, { alpha: 0.13, shadow: false });
  }
  // glow
  const gl = ctx.createRadialGradient(360, 360, 20, 360, 380, 380); const pu = 0.5 + 0.5 * Math.sin(t * 1.4);
  gl.addColorStop(0, `rgba(255,226,140,${0.4 + 0.1 * pu})`); gl.addColorStop(0.5, 'rgba(120,230,180,0.12)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, 800);
  HERO.forEach(([k, rot, x, y, w], i) => drawTileAt(ctx, -1, k, x, y + Math.sin(t * 1.3 + i * 1.7) * 9, w, rot + Math.sin(t * 0.9 + i) * 0.03, 1, style, { ss: 4, lift: 0.35 }));
  tx(ctx, '麻將', 360, 572, 64, 'rgba(241,207,122,0.85)', { font: CJKF, shadow: true });
  const g = ctx.createLinearGradient(0, 570, 0, 690); g.addColorStop(0, '#fff2bd'); g.addColorStop(0.5, '#f1cf7a'); g.addColorStop(1, '#c48d2c');
  tx(ctx, 'Mahjong', 360, 682, 138, g, { font: DISPLAY, shadow: true });
  tx(ctx, 'The game of the four winds', 360, 736, 32, 'rgba(247,239,214,0.9)', { font: DISPLAY, weight: 600 });
  for (const b of titleRects(S)) {
    if (b.chip !== undefined) {
      const on = S.prefs.level === b.chip;
      btn(ctx, b.r, LEVELS[b.chip].name, { kind: on ? 'gold' : 'wood', size: 26, pressed: false, off: false });
      continue;
    }
    if (b.lang !== undefined) {
      const on = S.prefs.lang === b.lang;
      btn(ctx, b.r, b.label, { kind: on ? 'gold' : 'wood', size: 27, font: b.lang === 'zh' ? CJKF : DISPLAY, pressed: rs.ptr.down && inRect(b.r, rs.ptr.x, rs.ptr.y) });
      continue;
    }
    btn(ctx, b.r, b.label, { kind: b.kind, size: b.small ? 28 : 40, sub: b.sub, pressed: rs.ptr.down && inRect(b.r, rs.ptr.x, rs.ptr.y) });
  }
  tx(ctx, 'Opponents', 360, titleRects(S).find((b) => b.id === 'lv0').r.y - 8, 20, 'rgba(241,207,122,0.85)', { weight: 600 });
  tx(ctx, 'Language', 360, titleRects(S).find((b) => b.id === 'lang-zh').r.y - 8, 20, 'rgba(241,207,122,0.85)', { weight: 600 });
  const rows = titleRects(S), lastY = Math.max(...rows.map((b) => b.r.y + b.r.h));
  tx(ctx, 'Score only. No stakes. Works offline.', 360, lastY + 36, 20, 'rgba(247,239,214,0.6)', { weight: 600 });
  if (S.dev) tx(ctx, 'dev', 60, 70, 20, '#f88', {});
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
export const settingRect = (i) => ({ x: 40, y: 190 + i * 98, w: 640, h: 84 });
// The language choice sits right below the generic rows, as two named buttons — not a single toggle chip — so
// it reads exactly like the title screen's "Play (中文)" / "Play (English)" and like Shogi/Xiangqi's own settings.
const LANG_ROW_Y = 190 + SETTINGS.length * 98;
export const settingsLangRects = () => LANG_CHOICES.map((c, i) => ({ ...c, r: { x: 40 + i * 330, y: LANG_ROW_Y + 34, w: 300, h: 84 } }));
export const BACK = { x: 210, y: 1424, w: 300, h: 86 };
export function renderSettings(ctx, S, rs) {
  drawTable(ctx);
  tx(ctx, 'Settings', 360, 130, 84, GOLD, { font: DISPLAY, shadow: true });
  SETTINGS.forEach((s, i) => {
    const r = settingRect(i), on = rs.ptr.down && inRect(r, rs.ptr.x, rs.ptr.y);
    panel(ctx, r.x, r.y, r.w, r.h, { alpha: on ? 0.95 : 0.7, r: 22 });
    tx(ctx, s.label, r.x + 28, r.y + 54, 32 * big(S) * 0.9, IVORY, { align: 'left', font: DISPLAY });
    const v = s.get(S.prefs), onv = v === 'On' || v === 'Fast' || s.id === 'minFan' || s.id === 'style';
    const pr = { x: r.x + r.w - 250, y: r.y + 16, w: 226, h: 52 };
    ctx.fillStyle = onv ? 'rgba(241,207,122,0.22)' : 'rgba(0,0,0,0.3)'; rr(ctx, pr.x, pr.y, pr.w, pr.h, 26); ctx.fill();
    ctx.strokeStyle = onv ? GOLD : 'rgba(247,239,214,0.35)'; ctx.lineWidth = 2; rr(ctx, pr.x, pr.y, pr.w, pr.h, 26); ctx.stroke();
    const vFont = s.id === 'minFan' ? UI : DISPLAY;
    tx(ctx, v, pr.x + pr.w / 2, pr.y + 35, 25, onv ? GOLD : 'rgba(247,239,214,0.7)', { font: vFont });
  });
  tx(ctx, 'Language', 360, LANG_ROW_Y + 26, 20, 'rgba(241,207,122,0.85)', { weight: 600 });
  settingsLangRects().forEach((b) => {
    const on = S.prefs.lang === b.lang;
    btn(ctx, b.r, b.label, { kind: on ? 'gold' : 'wood', size: 27, font: b.lang === 'zh' ? CJKF : DISPLAY, pressed: rs.ptr.down && inRect(b.r, rs.ptr.x, rs.ptr.y) });
  });
  panel(ctx, 40, 1112, 640, 250, { alpha: 0.5, r: 22 });
  tx(ctx, 'Preview', 360, 1152, 20, 'rgba(241,207,122,0.85)', { weight: 600 });
  [4, 12, 18 + 4, 27, 31, 33, 36, 40].forEach((k, i) => tileByKind(ctx, k, 76 + i * 76.6, 1262, 62, S.prefs.style));
  btn(ctx, BACK, 'Back', { kind: 'gold', size: 38, pressed: rs.ptr.down && inRect(BACK, rs.ptr.x, rs.ptr.y) });
}

// ------------------------------------------------------------------------------------------------- how / about / rules
// The pager row always spans the same x=40..680 strip, but fills it with however many of
// Previous/Back/Next actually apply on the current page (Previous only once you're past page 1,
// Next only before the last page) - three equal pills, or two wider ones on the first/last page,
// never a lopsided pair pushed to one side with dead margin on the other.
export function pagerRects(hasPrev, hasNext) {
  const X0 = 40, SPAN = 640, GAP = 20, Y = 1400, H = 86;
  const n = 1 + (hasPrev ? 1 : 0) + (hasNext ? 1 : 0);
  const w = (SPAN - GAP * (n - 1)) / n;
  let x = X0, i = 0;
  const next = () => { const r = { x, y: Y, w, h: H }; x += w + GAP; i++; return r; };
  return { prev: hasPrev ? next() : null, back: next(), next: hasNext ? next() : null };
}
// Text-size stepper for these reference pages: a top header row, clear of the screen title below it
// and of the Previous/Back/Next pager in the footer. "A-"/"A+", same interaction on every one of
// How to play / About / Rules.
export const TEXT_STEPPER = { dec: { x: 40, y: 24, w: 120, h: 62 }, inc: { x: W - 160, y: 24, w: 120, h: 62 } };
// One row of real tiles (drawn with the game's own tileByKind - never a separate simplified icon), centred,
// with an optional caption underneath. Used by Rules pages that show the tile set. `y` tracks the next free
// top edge, so captions never overlap the tile art below or above them. Returns the y just below the rows.
const TILE_ASPECT = 4 / 3; // FH / FW from tiles.js, fixed for every style
function drawTileRows(ctx, rows, style, yStart) {
  let y = yStart;
  for (const row of rows) {
    const tiles = row.tiles, n = tiles.length, tw = row.tw || 56, gap = row.gap ?? 14, th = tw * TILE_ASPECT;
    const total = n * tw + (n - 1) * gap;
    let x = 360 - total / 2 + tw / 2;
    const cy = y + th / 2;
    for (const k of tiles) { tileByKind(ctx, k, x, cy, tw, style); x += tw + gap; }
    y += th + 8;
    if (row.caption) { tx(ctx, row.caption, 360, y, 18, 'rgba(247,239,214,0.72)', { weight: 600, base: 'top' }); y += 26; }
    y += 12;
  }
  return y + 8;
}
// Shrinks the page-title size only if it would overflow the panel (a no-op for every existing How/About
// title, which already fits at the base size) - needed once Rules introduced a few longer titles.
function fitTitleSize(ctx, str, base) {
  let size = base;
  ctx.save(); ctx.font = `700 ${size}px ${DISPLAY}`;
  while (ctx.measureText(str).width > 600 && size > 34) { size -= 2; ctx.font = `700 ${size}px ${DISPLAY}`; }
  ctx.restore();
  return size;
}
function pages(ctx, S, rs, list, page, title) {
  drawTable(ctx);
  // Text-size scale for this reference page only (independent of the gameplay "Large text" setting,
  // which affects hand-tile size during play, not this reading screen). Always guarded: an out-of-range
  // saved index (e.g. from a build with a shorter TEXT_SCALES array) must fall back to 1, never NaN.
  const scale = TEXT_SCALES[S.prefs.textScaleIdx] ?? 1;
  tx(ctx, title, 360, 170, Math.round(84 * Math.min(scale, 1.15)), GOLD, { font: DISPLAY, shadow: true });
  const p = list[page];
  panel(ctx, 40, 210, 640, 1120, { alpha: 0.7 });
  // The page's own sub-title only needs to stay comfortably legible, not grow 1:1 with body text -
  // past a modest cap it would collide with the header above and the divider below at high scale.
  tx(ctx, p.title, 360, 300, fitTitleSize(ctx, p.title, Math.round(60 * Math.min(scale, 1.15))), IVORY, { font: DISPLAY });
  ctx.strokeStyle = 'rgba(241,207,122,0.4)'; ctx.beginPath(); ctx.moveTo(120, 326); ctx.lineTo(600, 326); ctx.stroke();
  let y = p.tileRows ? drawTileRows(ctx, p.tileRows, S.prefs.style, 346) : 390;
  const fontPx = Math.round(28 * scale), lh = Math.round(38 * scale);
  // drawTileRows() ends with a small fixed gap sized for the base (28px) font. Body text is drawn on
  // its baseline, so a larger scaled font's own ascent can climb back up into the last row's caption
  // unless the gap grows with it too - add back the difference above the base font's assumed ascent.
  if (p.tileRows) y += Math.max(0, fontPx - 28);
  for (const line of p.lines) { const n = wrap(ctx, line, 84, y, fontPx, 552, IVORY, { align: 'left', lh }); y += n * lh + 26; }
  // A dot per page reads fine for a handful of pages, but some rulesets need many very short pages
  // once text is large - past a page count that would crowd or run the dots off the panel width,
  // show a plain "page X of N" label instead (still centred where the dots would sit).
  if (list.length <= 16) {
    list.forEach((_, i) => { ctx.fillStyle = i === page ? GOLD : 'rgba(247,239,214,0.3)'; ctx.beginPath(); ctx.arc(360 + (i - (list.length - 1) / 2) * 30, 1300, 7, 0, TAU); ctx.fill(); });
  } else {
    tx(ctx, `Page ${page + 1} of ${list.length}`, 360, 1306, 22, 'rgba(247,239,214,0.75)', { weight: 600 });
  }
  const hasPrev = page > 0, hasNext = page < list.length - 1;
  const P = pagerRects(hasPrev, hasNext);
  if (hasPrev) btn(ctx, P.prev, 'Previous', { kind: 'wood', size: 30, pressed: rs.ptr.down && inRect(P.prev, rs.ptr.x, rs.ptr.y) });
  btn(ctx, P.back, 'Back', { kind: hasNext ? 'wood' : 'gold', size: 32 });
  if (hasNext) btn(ctx, P.next, 'Next', { kind: 'gold', size: 30, pressed: rs.ptr.down && inRect(P.next, rs.ptr.x, rs.ptr.y) });
  const atMin = S.prefs.textScaleIdx === 0, atMax = S.prefs.textScaleIdx === TEXT_SCALES.length - 1;
  btn(ctx, TEXT_STEPPER.dec, 'A−', { kind: 'wood', size: 32, off: atMin, pressed: !atMin && rs.ptr.down && inRect(TEXT_STEPPER.dec, rs.ptr.x, rs.ptr.y) });
  btn(ctx, TEXT_STEPPER.inc, 'A+', { kind: 'wood', size: 32, off: atMax, pressed: !atMax && rs.ptr.down && inRect(TEXT_STEPPER.inc, rs.ptr.x, rs.ptr.y) });
}
export const renderHow = (ctx, S, rs) => pages(ctx, S, rs, HOW_PAGES, S.page, 'How to play');
export const renderAbout = (ctx, S, rs) => pages(ctx, S, rs, ABOUT_PAGES, S.page, 'About Mahjong');
export const renderRules = (ctx, S, rs) => pages(ctx, S, rs, RULE_PAGES, S.page, 'Rules');
export const pageCount = (scene) => (scene === 'how' ? HOW_PAGES.length : scene === 'rules' ? RULE_PAGES.length : ABOUT_PAGES.length);

// ------------------------------------------------------------------------------------------------- learn list, daily hub
export const lessonRect = (i) => ({ x: 40, y: 180 + i * 100, w: 640, h: 88 });
export const LEARN_BACK = { x: 210, y: 1408, w: 300, h: 80 };
export function renderLearn(ctx, S, rs) {
  drawTable(ctx);
  tx(ctx, 'Learn to play', 360, 120, 78, GOLD, { font: DISPLAY, shadow: true });
  LESSONS.forEach((l, i) => {
    const r = lessonRect(i), done = !!S.learned[i];
    panel(ctx, r.x, r.y, r.w, r.h, { alpha: rs.ptr.down && inRect(r, rs.ptr.x, rs.ptr.y) ? 0.95 : 0.7, r: 22, edge: done ? GOLD : 'rgba(241,207,122,0.4)' });
    tx(ctx, String(i + 1), r.x + 40, r.y + 58, 40, done ? GOLD : 'rgba(247,239,214,0.5)', { font: UI });
    tx(ctx, l.title, r.x + 84, r.y + 40, 31, IVORY, { align: 'left', font: DISPLAY });
    tx(ctx, l.blurb, r.x + 84, r.y + 68, 19, 'rgba(247,239,214,0.62)', { align: 'left', weight: 500 });
    if (done) { ctx.strokeStyle = '#9df0c4'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r.x + r.w - 62, r.y + 46); ctx.lineTo(r.x + r.w - 46, r.y + 62); ctx.lineTo(r.x + r.w - 20, r.y + 28); ctx.stroke(); }
  });
  btn(ctx, LEARN_BACK, 'Back', { kind: 'wood', size: 34 });
}

export const DAILY_RECTS = { play: { x: 110, y: 1040, w: 500, h: 92 }, back: { x: 210, y: 1408, w: 300, h: 80 } };
export function renderDailyHub(ctx, S, rs) {
  drawTable(ctx);
  const d = S.daily;
  tx(ctx, 'Daily challenge', 360, 130, 78, GOLD, { font: DISPLAY, shadow: true });
  tx(ctx, 'Three hands. Which tile would you discard?', 360, 190, 27, 'rgba(247,239,214,0.85)', { weight: 600 });
  panel(ctx, 60, 250, 600, 700, { alpha: 0.7 });
  for (let i = 0; i < 3; i++) {
    const y = 310 + i * 200, res = d.results[i];
    tx(ctx, `Puzzle ${i + 1}`, 120, y + 60, 38, IVORY, { align: 'left', font: UI });
    tx(ctx, ['Warm-up', 'Trickier', 'Toughest'][i], 120, y + 96, 22, 'rgba(247,239,214,0.6)', { align: 'left', weight: 600 });
    ctx.beginPath(); ctx.arc(560, y + 70, 42, 0, TAU); ctx.fillStyle = res === true ? 'rgba(157,240,196,0.25)' : res === false ? 'rgba(255,177,166,0.2)' : 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.strokeStyle = res === true ? '#9df0c4' : res === false ? '#ffb1a6' : 'rgba(247,239,214,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    tx(ctx, res === true ? 'Yes' : res === false ? 'No' : String(i + 1), 560, y + 82, 30, res === null ? 'rgba(247,239,214,0.6)' : ctx.strokeStyle, { font: DISPLAY });
  }
  tx(ctx, d.streak ? `Streak: ${d.streak} day${d.streak === 1 ? '' : 's'}` : 'Finish all three to start a streak', 360, 1000, 28, GOLD, { font: UI });
  const done = d.results.every((r) => r !== null);
  btn(ctx, DAILY_RECTS.play, done ? 'Play again' : d.results.some((r) => r !== null) ? 'Continue' : 'Start', { kind: 'gold', size: 38 });
  btn(ctx, DAILY_RECTS.back, 'Back', { kind: 'wood', size: 34 });
}

// ------------------------------------------------------------------------------------------------- lesson / daily puzzle scene
export const LESSON_BACK = { x: 24, y: 1452, w: 200, h: 84 };
export const LESSON_NEXT = { x: 470, y: 1452, w: 226, h: 84 };
export const LESSON_HINT = { x: 246, y: 1452, w: 200, h: 84 };

// Where every tile of the current step is. Used for drawing AND hit-testing.
export function lessonScene(S) {
  const L = S.lesson, st = L.step, out = { tiles: [], river: null, melds: [], buttons: [], hand: false };
  const type = st.type;
  if (type === 'tap' || type === 'pick') { out.tiles = stageTiles(st).map((t) => ({ ...t, sel: L.sel.includes(t.idx) })); }
  else if (type === 'info') {
    const show = st.show ?? [], n = show.length;
    if (st.grouped) {
      const tw = 44, pitch = tw + 2, gaps = 4, all = [...show, ...(st.pairShow ?? [])], total = all.length * pitch + gaps * 16; let x = 360 - total / 2 + pitch / 2;
      all.forEach((k, i) => { out.tiles.push({ kind: k, x, y: 640, w: tw, idx: i }); x += pitch; if ((i + 1) % 3 === 0 && i < 12 || i === 11) x += 16; });
    } else show.forEach((k, i) => out.tiles.push({ kind: k, x: 360 + (i - (n - 1) / 2) * 130, y: 640, w: 112, idx: i }));
  } else if (type === 'discard' || type === 'claim' || type === 'win' || type === 'score') {
    out.hand = true;
    const hand = L.hand, has = L.draw >= 0 && (type === 'discard' || type === 'win' || type === 'score'), n = hand.length, m = handMetrics(n, has, S.prefs.big);
    hand.forEach((k, i) => out.tiles.push({ kind: k, x: handTileX(m, i, has, n), y: HAND_Y - (L.sel.includes(i) ? 26 : 0), w: m.tw, idx: i, hand: true, sel: L.sel.includes(i) }));
    if (has) out.tiles.push({ kind: L.draw, x: handTileX(m, n, true, n), y: HAND_Y - (L.sel.includes(n) ? 26 : 0), w: m.tw, idx: n, hand: true, drawn: true, sel: L.sel.includes(n) });
    let used = 0;
    (st.melds || []).forEach((mm, mi) => { const o = meldOrigin(0, mi, used); for (let ti = 0; ti < 3; ti++) out.melds.push({ kind: mm.kind, x: o.x + o.dx * ti, y: o.y, w: o.w }); used += 3; });
    if (type === 'claim') out.river = { kind: st.river.kind, x: 360, y: 640, w: 118 };
    if (type === 'claim') {
      const fs = fakeState(hand), o = claimOptions(fs, 0, idFor(st.river.kind, 3), st.river.from);
      out.buttons = claimRects(claimList({ opts: [o] }));
      out.opts = o;
    }
    if (type === 'win') { const fs = fakeState(hand); withDraw(fs, L.draw); const w = winInfo(fs, 0, fullHand(fs, 0), true); out.buttons = claimRects([{ id: 'win', label: 'Win!', kind: 'gold' }]); out.info = w; }
  }
  return out;
}

function countLines(ctx, str, size, maxW) {
  ctx.save(); ctx.font = `600 ${size}px ${UI}`; let n = 1, cur = '';
  for (const w of String(str).split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { n++; cur = w; } else cur = t2; }
  ctx.restore(); return n;
}
export function renderLesson(ctx, S, rs) {
  drawTable(ctx);
  const L = S.lesson, st = L.step, b = big(S), sc = lessonScene(S), style = S.prefs.style, pulse = 0.5 + 0.5 * Math.sin(S.t * 4);
  const title = L.daily ? `Daily puzzle ${L.pi + 1} of 3` : LESSONS[L.i].title;
  tx(ctx, title, 360, 100, 52, GOLD, { font: L.daily ? UI : DISPLAY, shadow: true });
  const steps = L.daily ? 3 : LESSONS[L.i].steps.length;
  for (let i = 0; i < steps; i++) { ctx.fillStyle = i < L.si ? GOLD : i === L.si ? IVORY : 'rgba(247,239,214,0.28)'; ctx.beginPath(); ctx.arc(360 + (i - (steps - 1) / 2) * 24, 128, 6, 0, TAU); ctx.fill(); }
  const promptText = L.prompt ?? textOf(st.text, S.prefs.lang);
  const promptLines = countLines(ctx, promptText, 28 * b, 590), cardH = Math.max(120, promptLines * 37 * b + 50);
  panel(ctx, 30, 156, 660, cardH, { alpha: 0.86 });
  wrap(ctx, promptText, 360, 156 + 44 + 4, 28 * b, 590, IVORY, { lh: 37 * b });
  // stage
  if (st.type === 'tap' || st.type === 'pick') {
    const rows = st.stage;
    if (rows.length > 1 || rows[0].label) for (const row of rows) if (row.label) tx(ctx, row.label, 40, row.y - 62, 22, 'rgba(241,207,122,0.85)', { align: 'left' });
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
    tx(ctx, `${['', 'Mei', 'Lin', 'Jun'][st.river.from]} discards`, 360, 540, 28, 'rgba(247,239,214,0.85)', { font: DISPLAY, weight: 700 });
    drawTileAt(ctx, -1, sc.river.kind, sc.river.x, sc.river.y, sc.river.w, 0, 1, style, { glow: 0.4 + 0.3 * pulse, lift: 0.3 });
  }
  if (st.type === 'score' && L.info) {
    const info = L.info, y0 = 500;
    tx(ctx, 'HOW IT SCORED', 60, y0, 18, 'rgba(241,207,122,0.85)', { align: 'left' });
    info.patterns.forEach((p, i) => { tx(ctx, p.name, 60, y0 + 46 + i * 64, 30, IVORY, { align: 'left', font: DISPLAY }); tx(ctx, `${p.fan} fan`, 660, y0 + 44 + i * 64, 27, GOLD, { align: 'right', font: UI }); tx(ctx, p.why, 60, y0 + 72 + i * 64, 18, 'rgba(247,239,214,0.65)', { align: 'left', weight: 500 }); });
    const ty = y0 + 70 + info.patterns.length * 64;
    tx(ctx, `${info.fan} fan = ${pointsFor(info.fan)} points`, 360, ty + 30, 44, GOLD, { font: UI, shadow: true });
  }
  if (st.type === 'info' && !st.show?.length) tx(ctx, '牌', 360, 760, 260, 'rgba(241,207,122,0.09)', { font: CJKF });
  // claim / win buttons
  for (const o of sc.buttons) btn(ctx, o.r, o.label, { kind: o.kind, size: 36, pulse: o.kind === 'gold' ? pulse : 0, pressed: rs.ptr.down && inRect(o.r, rs.ptr.x, rs.ptr.y) });
  // message
  if (L.msg) {
    const lines = []; ctx.save(); ctx.font = `600 ${25 * b}px ${UI}`; let cur = ''; for (const w of L.msg.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 620 && cur) { lines.push(cur); cur = w; } else cur = t2; } lines.push(cur); ctx.restore();
    const lh = 31 * b, bh = lines.length * lh + 22, by = st.type === 'discard' || st.type === 'win' || st.type === 'claim' || st.type === 'score' ? 1226 : 1150;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, 30, by - 4, 660, bh, 20); ctx.fill(); ctx.strokeStyle = L.msgGood ? 'rgba(157,240,196,0.7)' : 'rgba(241,207,122,0.5)'; ctx.lineWidth = 1.5; rr(ctx, 30, by - 4, 660, bh, 20); ctx.stroke();
    lines.forEach((ln, i) => tx(ctx, ln, 360, by + 28 * b + i * lh - 4, 25 * b, L.msgGood ? '#c8ffe2' : IVORY, { weight: 600 }));
  }
  btn(ctx, LESSON_BACK, L.daily ? 'Exit' : 'Lessons', { kind: 'wood', size: 30, pressed: rs.ptr.down && inRect(LESSON_BACK, rs.ptr.x, rs.ptr.y) });
  if (L.canHint) btn(ctx, LESSON_HINT, 'Hint', { kind: 'gold', size: 30 });
  if (L.done || st.type === 'info' || st.type === 'score') btn(ctx, LESSON_NEXT, L.lastStep ? 'Finish' : 'Next', { kind: 'gold', size: 34, pulse, pressed: rs.ptr.down && inRect(LESSON_NEXT, rs.ptr.x, rs.ptr.y) });
}

// ------------------------------------------------------------------------------------------------- overlays
export const PAUSE_RECTS = { resume: { x: 130, y: 640, w: 460, h: 88 }, sound: { x: 130, y: 750, w: 460, h: 88 }, quit: { x: 130, y: 860, w: 460, h: 88 } };
export function renderPause(ctx, S, rs) {
  const auto = S.scene === 'auto';
  ctx.fillStyle = 'rgba(0,10,6,0.7)'; ctx.fillRect(0, 0, W, H);
  panel(ctx, 90, 540, 540, 520, { alpha: 0.95 });
  tx(ctx, 'Paused', 360, 610, 66, GOLD, { font: DISPLAY, shadow: true });
  btn(ctx, PAUSE_RECTS.resume, 'Resume', { kind: 'gold', size: 36 });
  btn(ctx, PAUSE_RECTS.sound, S.prefs.sound ? 'Sound: on' : 'Sound: off', { kind: 'jade', size: 32 });
  btn(ctx, PAUSE_RECTS.quit, auto ? 'Exit to menu' : 'Save and leave', { kind: 'wood', size: 32 });
  tx(ctx, auto ? 'This Auto Play demonstration is not saved.' : 'Your hand is saved when you leave.', 360, 1010, 20, 'rgba(247,239,214,0.65)', { weight: 600 });
}
export function renderDemoLimit(ctx, S) {
  drawTable(ctx);
  panel(ctx, 60, 400, 600, 640, { alpha: 0.92 });
  tx(ctx, '麻將', 360, 520, 110, 'rgba(241,207,122,0.9)', { font: CJKF });
  tx(ctx, 'That was the preview', 360, 620, 54, GOLD, { font: DISPLAY, shadow: true });
  wrap(ctx, 'The web preview ends here. Get the full game on iPhone and Android for unlimited hands, all lessons and the daily challenge.', 360, 690, 28, 500, IVORY, { lh: 38 });
  btn(ctx, { x: 160, y: 900, w: 400, h: 84 }, 'Main menu', { kind: 'wood', size: 34 });
}
export const DEMO_MENU = { x: 160, y: 900, w: 400, h: 84 };
