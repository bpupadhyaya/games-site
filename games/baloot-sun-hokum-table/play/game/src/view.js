// Everything drawn each frame. Reads `state` (game.js) and changes nothing except the reference-page scroll limit (`state.refMax`).
// Static art is cached (art.js). ALL positions come from layout.js (the current layout: LAY / TG and the live exports); this file has no
// screen-size numbers of its own except the design-space art on the title / result screens, which is scaled by the layout.
import { W, H as HH, CW, CH, TW, TH, BW, BH, HAND_Y, LIFT, HS, BTN, TRICK, SEAT, DECK, TOAST, CHIP, titleGeo, PANEL, ACT, OVERLAY_BTN, OVERLAY_BTN2, BACK, REF_BACK, REF_NEXT, TEXT_SCALES, TEXT_DEC, TEXT_INC, handSlot, AUTO_THINK_STEPS, AUTO_BAR, AUTO_DEC, AUTO_INC, LAY, TG } from './layout.js';
import { drawBackground, drawTable, drawCoffee, drawCard, button, plaque, rr, drawSuit, SUIT_INK, FONT, UI, BRASS, CREAM, star8, rosette, TABLE } from './art.js';
import { SUIT_NAMES, TARGETS, legalFor, cardShort, teamOf, DECL, declValue, SEAT_NAMES } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { RULES, ABOUT, HOWTO } from './rulesContent.js';
import { drawLockup, drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;
const NAMES = ['You', 'Right', 'Partner', 'Left'];
const TEAM = ['Us', 'Them'];
const autoThinkLabel = (state) => `${AUTO_THINK_STEPS[state.autoThinkIdx]}s`;

// Wrapped-line cache: a paragraph is measured once per (font, size, width, text) and reused every frame (the reference pages used to re-wrap
// their whole document each frame). Dropped when a web font finishes loading. readerStats.wraps counts misses (tests read it).
const wrapMemo = new Map(); let wrapFontsKey = '';
export const readerStats = { wraps: 0 };

export function render(ctx, state) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== wrapFontsKey || wrapMemo.size > 3000) { wrapMemo.clear(); wrapFontsKey = k; } }
  const sc = state.scene, t = state.t, mu = LAY.minU;
  drawBackground(ctx, t);
  // Smallest type is ~11 css px (mu units): small captions never fall below it on a landscape phone.
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size < mu && font === UI ? mu : size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; text(str, x, y, size, color, font, weight, align); ctx.restore(); };
  // one line, shrunk (never below 15) until it fits `maxW`
  const fit = (str, x, y, size, maxW, color = CREAM, weight = 700, align = 'center', font = UI) => {
    ctx.font = `${weight} ${size}px ${font}`; const w = ctx.measureText(str).width;
    text(str, x, y, w > maxW && maxW > 0 ? Math.max(15, Math.floor(size * maxW / w)) : size, color, font, weight, align);
  };
  const wrapLines = (str, size, maxW, weight = 600) => { const mk = `${weight}|${size < mu ? mu : size}|${maxW}|${str}`, hit = wrapMemo.get(mk); if (hit) return hit; readerStats.wraps++; const r = wrapLinesRaw(str, size, maxW, weight); wrapMemo.set(mk, r); return r; };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.32, align = 'center', weight = 600) => {
    const lines = wrapLines(str, size, maxW, weight);
    lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return lines.length;
  };
  const wrapLinesRaw = (str, size, maxW, weight) => {
    ctx.font = `${weight} ${size < mu ? mu : size}px ${UI}`;
    // At the largest text-size steps a single long hyphenated word (e.g. "counter-clockwise") can
    // be wider than the whole column by itself — split-on-space alone would then hand it straight
    // to fillText and it gets clipped at the panel edge. Pre-break any such word at its hyphens (a
    // normal typographic hyphenation point) so it still wraps like every other word.
    const rawWords = str.split(' '), words = [];
    for (const rw of rawWords) {
      if (rw.includes('-') && ctx.measureText(rw).width > maxW) {
        const parts = rw.split('-');
        parts.forEach((p, i) => words.push(i < parts.length - 1 ? p + '-' : p));
      } else words.push(rw);
    }
    const lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); return lines;
  };
  const lightSuit = (s, x, y, size) => drawSuit(ctx, s, x, y, size, s === 1 || s === 2 ? '#ff8a80' : '#f6ead0');
  const V = { text, shadowText, wrap, wrapLines, fit, lightSuit };

  if (sc === 'title') return title(ctx, state, V);
  if (sc === 'lessons') return lessonsPage(ctx, state, V);
  if (sc === 'settings') return settingsPage(ctx, state, V);
  if (sc === 'about') return aboutPage(ctx, state, V);
  if (sc === 'how') return howPage(ctx, state, V);
  if (sc === 'rules') return rulesPage(ctx, state, V);
  if (sc === 'over') return overPage(ctx, state, V);
  if (sc === 'demo-limit') return demoPage(ctx, state, V);
  if (sc === 'daily' && state.daily.status === 'making') { drawTable(ctx, t); text('Setting today\'s deal...', TG.cx, TG.cy - 50, 44, CREAM, FONT); button(ctx, BTN.menu, 'Menu', { size: 30 }); return; }
  table(ctx, state, V);
}

// ---- title ------------------------------------------------------------------------------------------------
function backButton(ctx, V, label = 'Back') { button(ctx, BACK, label, { size: 28 }); }
function title(ctx, state, V) {
  const t = state.t, { text, shadowText } = V, G = titleGeo(!!state.saved), R = G.rows;
  // The art (medallion, fan of cards, the word Baloot) is drawn in its design space (720 wide, centred on 360,450) and scaled to fit.
  ctx.save(); ctx.translate(G.art.cx, G.art.cy); ctx.scale(G.art.s, G.art.s); ctx.translate(-360, -450);
  // big slowly turning medallion behind the title
  ctx.save(); ctx.translate(360, 420); ctx.rotate(t * 0.05);
  ctx.strokeStyle = 'rgba(232,190,110,0.32)'; ctx.lineWidth = 2.5; rosette(ctx, 0, 0, 330, 'rgba(232,190,110,0.32)', 2.5);
  ctx.rotate(-t * 0.1); rosette(ctx, 0, 0, 240, 'rgba(232,190,110,0.24)', 2);
  ctx.restore();
  const g = ctx.createRadialGradient(360, 430, 20, 360, 430, 340); g.addColorStop(0, 'rgba(255,214,140,0.28)'); g.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g; ctx.fillRect(0, 100, 720, 660);
  // fan of cards
  const cards = [7 + 0 * 8 + 0, 4 + 8, 2 + 8, 6 + 16, 3 + 24];
  cards.forEach((c, i) => {
    const a = (i - 2) * 0.2 + Math.sin(t * 0.8 + i) * 0.015, cx = 360 + (i - 2) * 92, cy = 560 + Math.abs(i - 2) * 22;
    ctx.save(); ctx.translate(cx, cy + 150); ctx.rotate(a); ctx.translate(-CW * 0.5, -CH * 0.9 - 150 + 150); drawCard(ctx, c, 0, -CH * 0.15, 1.0, { big: state.set.big, four: state.set.four }); ctx.restore();
  });
  ctx.save(); ctx.shadowColor = 'rgba(255,190,90,0.7)'; ctx.shadowBlur = 30;
  const gr = ctx.createLinearGradient(0, 130, 0, 260); gr.addColorStop(0, '#fff1c2'); gr.addColorStop(1, '#d9a441');
  text('Baloot', 360, 250, 170, gr, FONT, 700); ctx.restore();
  ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; V.fit('The partnership card game of the Gulf', G.art.cx, G.tagY, 28, G.artW, '#f6dfae', 600); ctx.restore();
  if (G.coffee) drawCoffee(ctx, G.coffee.x, G.coffee.y, t, G.coffee.s);
  if (R.resume) button(ctx, R.resume, 'Resume match', { primary: true, size: 36, sub: `You ${state.saved.match.scores[0]}, Them ${state.saved.match.scores[1]}` });
  button(ctx, R.play, 'Play a match', { primary: !R.resume, size: 36, sub: `Race to ${TARGETS[state.targetIdx]} with Partner` });
  button(ctx, R.learn, 'Learn to play', { size: 34, sub: `${Object.keys(state.learned).length} of ${LESSONS.length} lessons done` });
  button(ctx, R.daily, 'Daily deal', { size: 34, sub: state.daily.solvedDay === state.daily.day ? `Solved today. Streak ${state.daily.streak}` : 'One puzzle a day' });
  // target + level chips
  const r = R.level; plaque(ctx, r, 0.7);
  ctx.strokeStyle = 'rgba(224,178,90,0.5)'; ctx.beginPath(); ctx.moveTo(r.x + r.w / 2, r.y + 10); ctx.lineTo(r.x + r.w / 2, r.y + r.h - 10); ctx.stroke();
  V.fit(`Match to ${TARGETS[state.targetIdx]}`, r.x + r.w / 4, r.y + r.h / 2 + 10, 28, r.w / 2 - 20, CREAM, 700);
  V.fit(`${LEVELS[state.level - 1].name}`, r.x + r.w * 0.75, r.y + r.h * 0.45, 28, r.w / 2 - 20, CREAM, 700);
  text('Tap to change', r.x + r.w * 0.75, r.y + r.h * 0.82, 18, 'rgba(246,234,208,0.7)', UI, 600);
  const sz = R.settings.h < 66 ? 20 : 21;
  button(ctx, R.settings, 'Settings', { size: sz }); button(ctx, R.about, 'About', { size: sz }); button(ctx, R.how, 'Controls', { size: sz }); button(ctx, R.rules, 'Rules', { size: sz }); button(ctx, R.auto, 'Auto', { size: sz });
  V.fit(LEVELS[state.level - 1].blurb, R.play.x + R.play.w / 2, G.blurbY, 22, Math.min(R.play.w + 40, (LAY.U.x1 - R.play.x + 10)), 'rgba(246,234,208,0.8)', 600);
  { const q = G.lockup, dn = !!state.lkDown;    // the themed Arcforge lockup under the menu: readable on a dark backing; a tap opens the Arcforge home
    ctx.save(); ctx.fillStyle = 'rgba(16,5,8,0.62)'; rr(ctx, q.cx - q.w / 2 - 10, q.y - 5, q.w + 20, q.h + 10, (q.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, q.cx, q.y + (dn ? 1 : 0), q.w * (dn ? 0.96 : 1), q.h * (dn ? 0.96 : 1), dn ? 0.7 : 1); }
}

// ---- simple pages ----------------------------------------------------------------------------------------------
function pageFrame(ctx, V, titleText) {
  const hd = LAY.hdr;
  ctx.fillStyle = 'rgba(12,4,6,0.55)'; ctx.fillRect(0, 0, W, HH);
  V.text(titleText, hd.cx, hd.base, hd.size, CREAM, FONT, 700); backButton(ctx, V);
  ctx.strokeStyle = 'rgba(224,178,90,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hd.cx - 220, hd.div); ctx.lineTo(hd.cx + 220, hd.div); ctx.stroke();
  V.text('♦', hd.cx, hd.div + 10, 22, BRASS, UI, 700);
}
function lessonsPage(ctx, state, V) {
  pageFrame(ctx, V, 'Learn to play');
  const A = LAY.lessons;
  LESSONS.forEach((L, i) => {
    const r = A.rows[i], done = state.learned[i], locked = false, k = r.h / 100;
    button(ctx, r, '', { dim: locked });
    ctx.fillStyle = done ? '#e0b25a' : 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(r.x + 52 * k, r.y + r.h / 2, 30 * k, 0, TAU); ctx.fill();
    V.text(done ? '✓' : String(i + 1), r.x + 52 * k, r.y + r.h / 2 + 12 * k, Math.max(22, 34 * k), done ? '#2a1606' : CREAM, UI, 800);
    const tx = r.x + 104 * k, room = r.w - 104 * k - 16;
    V.fit(L.title, tx, r.y + r.h * 0.46, Math.max(24, 32 * k), room, CREAM, 800, 'left');
    V.fit(L.blurb, tx, r.y + r.h * 0.79, Math.max(20, 22 * k), room, 'rgba(246,234,208,0.85)', 600, 'left');
  });
  if (A.note) V.text('Each lesson is a real position: you make every move yourself.', LAY.hdr.cx, A.noteY, 24, 'rgba(246,234,208,0.85)', UI, 600);
}
function settingsPage(ctx, state, V) {
  pageFrame(ctx, V, 'Settings');
  const S = LAY.settings, sub = { sound: 'Card slaps and soft chimes', calm: 'Quicker, calmer animations', big: 'Bigger ranks and suits on every card', four: 'Easier to tell suits apart at a glance' };
  const label = { sound: 'Sound', calm: 'Reduced motion', big: 'Large-print cards', four: 'Four-colour suits' };
  S.rows.forEach(({ key, r }) => {
    button(ctx, r, '', {});
    const k = r.h / 116, ph = Math.min(52, r.h * 0.46), pw = ph * 2;
    V.fit(label[key], r.x + 30, r.y + r.h * 0.45, Math.max(26, 34 * k), r.w - pw - 90, CREAM, 800, 'left');
    V.fit(sub[key], r.x + 30, r.y + r.h * 0.76, Math.max(20, 21 * k), r.w - pw - 90, 'rgba(246,234,208,0.8)', 600, 'left');
    const on = state.set[key], p = { x: r.x + r.w - pw - 30, y: r.y + (r.h - ph) / 2, w: pw, h: ph };
    ctx.fillStyle = on ? '#e0b25a' : 'rgba(0,0,0,0.5)'; rr(ctx, p.x, p.y, p.w, p.h, ph / 2); ctx.fill();
    ctx.fillStyle = on ? '#2a1606' : '#f6ead0'; ctx.beginPath(); ctx.arc(on ? p.x + p.w - ph / 2 : p.x + ph / 2, p.y + ph / 2, ph * 0.38, 0, TAU); ctx.fill();
  });
  const cx = LAY.hdr.cx;
  V.text('Preview', cx, S.previewLabelY, 26, 'rgba(246,234,208,0.8)', UI, 700);
  const x0 = cx - (3 * S.previewGap + CW * S.previewSc) / 2;
  [[7 + 8 * 1, 0], [3 + 8 * 2, 1], [6 + 8 * 3, 2], [4 + 8 * 0, 3]].forEach(([c], i) => drawCard(ctx, c, x0 + i * S.previewGap, S.previewY, S.previewSc, { big: state.set.big, four: state.set.four }));
  if (S.noteY + 8 < LAY.U.y1) V.wrap('Your choices are saved on this device.', cx, S.noteY, 22, 560, 'rgba(246,234,208,0.8)');
}
// Draws a centred row of real in-game cards (via the same drawCard() the table uses — never a
// separate simplified icon), each with a label under it, sized to always fit within the page's
// text margin. Returns the y just below the row, for the body text that follows. The card
// thumbnails and their small captions stay a fixed size at every text-size step (they are not the
// "text" the stepper scales, the same way the "Page N of M" footer only partly scales) — but the
// CLEARANCE after those captions, before the (fully scaled) body text starts, must grow with the
// body font size, or a large step's much taller first line visually collides with the caption
// right above it. `bodySize` is the caller's already-scaled body font size, used only for that gap.
function drawRuleCards(ctx, state, cards, y0, bodySize = 29, cx = W / 2, maxW = 640) {
  const n = cards.length, gap = 16;
  const scale = Math.min(0.62, (maxW - (n - 1) * gap) / (n * CW));
  const w = CW * scale, h = CH * scale;
  let x = cx - (n * w + (n - 1) * gap) / 2;
  const mu = LAY.minU;
  // Captions are wrapped to their own card slot (never wider than the card plus half the gap on each side), so neighbours cannot
  // overlap; every caption line is counted in the height returned, so the text below always starts under the tallest caption.
  const slotW = w + gap - 4, lab = Math.max(18, mu), sub = Math.max(14, mu), labLH = lab * 1.15, subLH = sub * 1.15;
  const wrapTo = (t, font, maxWidth) => {
    ctx.font = font; const words = String(t).split(' '), out = []; let line = '';
    for (const wd of words) { const tryL = line ? line + ' ' + wd : wd; if (line && ctx.measureText(tryL).width > maxWidth) { out.push(line); line = wd; } else line = tryL; }
    if (line) out.push(line); return out;
  };
  const labFont = `700 ${lab}px ${UI}`, subFont = `600 ${sub}px ${UI}`;
  let capH = 0;
  const lay = cards.map((item) => {
    const L1 = wrapTo(item.label, labFont, slotW), L2 = item.sub ? wrapTo(item.sub, subFont, slotW) : [];
    capH = Math.max(capH, 8 + L1.length * labLH + (L2.length ? 4 + L2.length * subLH : 0));
    return { L1, L2 };
  });
  cards.forEach((item, i) => {
    drawCard(ctx, item.c, x, y0, scale, { four: state.set.four, big: state.set.big });
    ctx.save(); ctx.textAlign = 'center';
    let ty = y0 + h + 6 + lab;
    ctx.font = labFont; ctx.fillStyle = CREAM;
    lay[i].L1.forEach((ln) => { ctx.fillText(ln, x + w / 2, ty); ty += labLH; });
    if (lay[i].L2.length) { ty += 2; ctx.font = subFont; ctx.globalAlpha = 0.82; lay[i].L2.forEach((ln) => { ctx.fillText(ln, x + w / 2, ty); ty += subLH; }); ctx.globalAlpha = 1; }
    ctx.restore();
    x += w + gap;
  });
  return y0 + h + capH + Math.round(bodySize * 0.75);
}
// A small closing flourish (a thin double rule with a diamond, then three real cards) for pages
// whose text ends well short of the panel's bottom — never drawn unless there is real, comfortable
// room left, so it never crowds the body text or the "Page N of M" footer below it. The Rules/
// Rank-order pages already show illustrative cards inline; this is only for pages that don't.
function footerMotif(ctx, state, V, y, cx) {
  ctx.save(); ctx.strokeStyle = 'rgba(224,178,90,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - 96, y); ctx.lineTo(cx - 26, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 26, y); ctx.lineTo(cx + 96, y); ctx.stroke();
  ctx.restore();
  V.text('♦', cx, y + 6, 16, BRASS, UI, 700);
  const cards = [7, 14, 21]; // Ace of Spades, King of Hearts, Queen of Diamonds: a small echo of the title screen's fan
  const sc = 0.5, w = CW * sc, gap = 18;
  let x = cx - (cards.length * w + (cards.length - 1) * gap) / 2;
  ctx.save(); ctx.globalAlpha = 0.92;
  for (const c of cards) { drawCard(ctx, c, x, y + 26, sc, { four: state.set.four, big: state.set.big }); x += w + gap; }
  ctx.restore();
}
// About, Controls (How to Play) and Rules all share this one reference-page renderer: a framed
// "reader card" panel (rr()/plaque()'s own dark-translucent, brass-bordered style — this game's
// own palette, not a new one) holds the header, an optional row of real in-game cards, and the
// body text, so the page reads as a designed reference sheet rather than text floating loose on
// the carpet backdrop. A text-size stepper (A-/A+, same button() style as every other button in
// this game) lets anyone go up to 300% — some players wear glasses, some don't. The panel's content
// SCROLLS (drag, wheel, arrow keys) when it is taller than the panel (small landscape screens, big
// text); `state.refScroll` is the offset and the limit is published back as `state.refMax`.
function refPage(ctx, state, V, list, page, headerLabel) {
  // A near-opaque scrim (darker than the 0.55 used elsewhere) so the ambient corner lanterns from
  // drawBackground() don't show through behind the corner text-size pills — this page reads as
  // its own clean reference sheet, not the gameplay backdrop bleeding through.
  ctx.fillStyle = 'rgba(10,4,5,0.9)'; ctx.fillRect(0, 0, W, HH);
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1; // guarded: a stale/out-of-range index must never yield NaN sizes
  const Rf = LAY.ref, panel = Rf.panel, pcx = panel.x + panel.w / 2;
  plaque(ctx, panel, 0.6);
  ctx.save(); ctx.strokeStyle = 'rgba(224,178,90,0.28)'; ctx.lineWidth = 1; rr(ctx, panel.x + 8, panel.y + 8, panel.w - 16, panel.h - 16, 14); ctx.stroke(); ctx.restore();

  const colW = Math.min(panel.w - 68, 880), textX = pcx - colW / 2, maxW = colW;
  const scroll = Math.max(0, state.refScroll || 0);
  ctx.save(); ctx.beginPath(); ctx.rect(panel.x + 4, panel.y + 6, panel.w - 8, panel.h - 12); ctx.clip();
  ctx.translate(0, -scroll);
  // Both the fixed header label ("About Baloot" etc.) and each page's own title are wrapped
  // (never shrunk) instead of drawn as one fixed-width line — at the 300% text step a short-looking
  // title like "About Baloot" is wider than the whole panel in one line.
  const headerSize = Math.round(37 * scale), headerLH = Math.round(headerSize * 1.08);
  let y = panel.y + headerSize + 12;
  const headerLines = V.wrap(headerLabel, pcx, y, headerSize, maxW, CREAM, headerLH, 'center', 700);
  y += (headerLines - 1) * headerLH;
  const dividerY = y + 24;
  ctx.strokeStyle = 'rgba(224,178,90,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pcx - colW / 2 + 16, dividerY); ctx.lineTo(pcx + colW / 2 - 16, dividerY); ctx.stroke();
  V.text('♦', pcx, dividerY + 10, 20, BRASS, UI, 700);

  // One continuous reader: every section in order (title, optional card row, body), separated by a thin rule.
  const titleSize = Math.round(31 * scale), titleLH = Math.round(titleSize * 1.1);
  const bodySize = Math.round(29 * scale), lh = Math.round(bodySize * 1.4), gap = Math.round(bodySize * 0.7);
  y = dividerY + 10; const visTop = panel.y + scroll - 120, visBot = panel.y + panel.h + scroll + 120;
  list.forEach((item, idx) => {
    if (idx > 0) {
      y += Math.round(bodySize * 0.5);
      ctx.save(); ctx.strokeStyle = 'rgba(224,178,90,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pcx - colW / 2 + 16, y); ctx.lineTo(pcx + colW / 2 - 16, y); ctx.stroke(); ctx.restore();
      y += Math.round(bodySize * 0.6);
    }
    y += titleSize + 24;
    const titleLines = V.wrap(item.title, pcx, y, titleSize, maxW, BRASS, titleLH, 'center', 800);
    y += (titleLines - 1) * titleLH;
    // Gap after the title must grow with BOTH the title's and the body's font size.
    y += Math.round(titleSize * 0.5 + bodySize * 0.55);
    if (item.cards && item.cards.length) y = drawRuleCards(ctx, state, item.cards, y, bodySize, pcx, Math.min(640, colW)) + 10;
    for (const line of item.lines) {
      const ls = V.wrapLines(line, bodySize, maxW, 600);
      if (y + ls.length * lh > visTop && y - bodySize < visBot) ls.forEach((ln, i) => V.text(ln, textX, y + i * lh, bodySize, CREAM, UI, 600, 'left'));   // only the visible slice is drawn
      y += ls.length * lh + gap;
    }
  });
  const contentBottom = y + 24 - (panel.y + panel.h - 14);
  ctx.restore();
  state.refMax = Math.max(0, Math.ceil(contentBottom));   // y is unscrolled (the translate does the shift), so the range is just the overflow
  if (state.refMax > 0) {   // a slim scroll thumb on the panel's right edge
    const trackY = panel.y + 18, trackH = panel.h - 36, th = Math.max(36, trackH * panel.h / (panel.h + state.refMax));
    ctx.fillStyle = 'rgba(224,178,90,0.18)'; rr(ctx, panel.x + panel.w - 14, trackY, 6, trackH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(224,178,90,0.8)'; rr(ctx, panel.x + panel.w - 14, trackY + (trackH - th) * Math.min(1, scroll / state.refMax), 6, th, 3); ctx.fill();
  }

  // Back is the neutral/secondary action (muted fill), Next the primary action (this game's own gold
  // accent gradient) - reads "Done" on the last page, where it exits to the title instead of wrapping.
  button(ctx, REF_BACK, 'Back', { size: 34 });
  button(ctx, REF_NEXT, 'Done', { size: 34, primary: true });
  button(ctx, TEXT_DEC, 'A−', { size: 24, dim: state.textScaleIdx === 0 });
  button(ctx, TEXT_INC, 'A+', { size: 24, dim: state.textScaleIdx >= TEXT_SCALES.length - 1 });
}
function aboutPage(ctx, state, V) { refPage(ctx, state, V, ABOUT, state.aboutPage, 'About Baloot'); }
function howPage(ctx, state, V) { refPage(ctx, state, V, HOWTO, state.howPage, 'How to Play'); }
function rulesPage(ctx, state, V) { refPage(ctx, state, V, RULES, state.page, 'Game Rules'); }
function demoPage(ctx, state, V) {
  ctx.fillStyle = 'rgba(12,4,6,0.6)'; ctx.fillRect(0, 0, W, HH);
  const U = LAY.U, cx = LAY.wide ? (U.x0 + OVERLAY_BTN.x) / 2 : (U.x0 + U.x1) / 2, cy = LAY.wide ? (U.y0 + U.y1) / 2 : (U.y0 + OVERLAY_BTN.y) / 2;
  const mw = LAY.wide ? Math.min(560, OVERLAY_BTN.x - U.x0 - 60) : 560;
  V.wrap('That was the preview', cx, cy - 80, 60, mw, CREAM, 64, 'center', 700);
  V.wrap('Get the full game on iPhone or Android: unlimited matches, all ten lessons and a new daily deal every day.', cx, cy + 10, 30, mw, CREAM, 42);
  button(ctx, OVERLAY_BTN, 'Back to title', { primary: true, size: 30 });
}
function overPage(ctx, state, V) {
  const won = state.match.winner === 0, m = state.match, t = state.t, O = LAY.over;
  ctx.fillStyle = 'rgba(12,4,6,0.6)'; ctx.fillRect(0, 0, W, HH);
  const stats = state.stats, cards = [7 + 24, 4 + 8, 6 + 16, 2 + 8, 3 + 24];
  const fan = (cx, cy, k) => cards.forEach((c, i) => {
    const a = (i - 2) * 0.2 + Math.sin(t * 0.8 + i) * 0.015, x = cx + (i - 2) * 92 * k, y = cy + Math.abs(i - 2) * 20 * k;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); drawCard(ctx, c, -CW * 0.5 * k, -CH * 0.5 * k, k, { big: state.set.big, four: state.set.four }); ctx.restore();
  });
  const lines = [won ? 'You win the match!' : 'They win the match', `Us ${m.scores[0]}   Them ${m.scores[1]}`, `${m.hands} hand${m.hands === 1 ? '' : 's'} played to ${TARGETS[state.targetIdx]}. Level: ${LEVELS[state.level - 1].name}`, won ? 'Well played, and well partnered.' : 'A close match is good practice. Try again, or use Hint.'];
  const statLine = `Matches played ${stats.played}  ·  Won ${stats.wins}  ·  Best score ${stats.best}`;
  if (!O.wide) {
    // design space 720 wide, y 140..1150, scaled to fit above the buttons
    ctx.save(); ctx.translate(O.cx, O.top); ctx.scale(O.s, O.s); ctx.translate(-360, -140);
    ctx.save(); ctx.translate(360, 400); ctx.rotate(t * 0.06); rosette(ctx, 0, 0, 260, 'rgba(232,190,110,0.35)', 2.5); ctx.restore();
    V.text(lines[0], 360, 400, 64, CREAM, FONT, 700);
    V.text(lines[1], 360, 500, 52, BRASS, UI, 800);
    V.text(lines[2], 360, 560, 26, 'rgba(246,234,208,0.85)', UI, 600);
    V.wrap(lines[3], 360, 630, 28, 520, CREAM);
    fan(360, 900, 1);
    const r = { x: 90, y: 1040, w: 540, h: 110 }; plaque(ctx, r, 0.7);
    V.fit(statLine, 360, r.y + r.h / 2 + 10, 26, 510, CREAM, 700);
    ctx.restore();
  } else {
    const Lr = O.left, cx = Lr.x + Lr.w / 2, mw = Math.min(620, Lr.w - 20);
    ctx.save(); ctx.translate(cx, Lr.y + 150); ctx.rotate(t * 0.06); rosette(ctx, 0, 0, 170, 'rgba(232,190,110,0.35)', 2.5); ctx.restore();
    V.fit(lines[0], cx, Lr.y + 92, 56, mw, CREAM, 700, 'center', FONT);
    V.fit(lines[1], cx, Lr.y + 168, 48, mw, BRASS, 800);
    V.fit(lines[2], cx, Lr.y + 214, 24, mw, 'rgba(246,234,208,0.85)', 600);
    V.fit(lines[3], cx, Lr.y + 252, 26, mw, CREAM, 600);
    fan(cx, Lr.y + Math.min(Lr.h - 150, 430), Math.min(0.8, (Lr.w - 40) / 620));
  }
  // stats (wide: a card above the buttons) + buttons
  if (O.wide) {
    const rc = O.rightCol, r = { x: rc.x, y: rc.y, w: rc.w, h: OVERLAY_BTN2.y - 14 - rc.y }; plaque(ctx, r, 0.7);
    const rows = [['Matches played', stats.played], ['Won', stats.wins], ['Best score', stats.best]], pitch = Math.min(110, (r.h - 20) / 3), y0 = r.y + (r.h - pitch * 3) / 2;
    rows.forEach(([k, v], i) => { const yy = y0 + i * pitch + pitch / 2; V.fit(k, r.x + r.w / 2, yy - 6, 22, r.w - 20, 'rgba(246,234,208,0.8)', 600); V.fit(String(v), r.x + r.w / 2, yy + 32, 34, r.w - 20, CREAM, 800); });
  }
  button(ctx, OVERLAY_BTN2, 'Play again', { size: 30 }); button(ctx, OVERLAY_BTN, 'Back to title', { primary: true, size: 30 });
  // quiet pointer to the rest of the collection
  const mx = O.wide ? O.left.x + O.left.w / 2 : (LAY.U.x0 + LAY.U.x1) / 2, my = O.wide ? LAY.U.y1 - 22 : Math.min(LAY.U.y1 - 14, OVERLAY_BTN.y + OVERLAY_BTN.h + 40);
  drawMoreLine(ctx, mx, my, Math.max(18, LAY.minU));
}

// ---- the table -----------------------------------------------------------------------------------------------
function table(ctx, state, V) {
  const { text, shadowText, wrap, fit, lightSuit } = V, H = state.H, t = state.t, ui = state.ui, sc = state.scene, T = TG, U = LAY.U;
  const big = state.set.big, four = state.set.four, calm = state.set.calm;
  drawTable(ctx, t);
  const isAuto = sc === 'auto';
  const study = sc === 'lesson' || sc === 'daily';
  if (!study && !isAuto && !LAY.wide) drawCoffee(ctx, U.x0 + 84, T.chip.y + 154, t, 0.46);
  const ct = H.contract;
  const A = isAuto ? state.auto : null;
  const autoReveal = A && A.phase === 'reveal' && A.chosen ? A : null;
  // ---- scores (Auto Play keeps its own running score, never the real match's)
  const inLesson = study;
  const scoreRow = isAuto ? state.autoMatch?.scores ?? [0, 0] : state.match.scores;
  for (let i = 0; i < (study ? 0 : 2); i++) {
    const r = T.sPl[i]; plaque(ctx, r, 0.78);
    text(i === 0 ? 'US' : 'THEM', r.x + 22, r.y + r.h * 0.37, 22, 'rgba(246,234,208,0.8)', UI, 800, 'left');
    text(inLesson ? '-' : String(scoreRow[i]), r.x + r.w - 22, r.y + r.h * 0.72, Math.min(54, r.h * 0.62), i === 0 ? '#ffe08a' : CREAM, UI, 800, 'right');
    if (!inLesson) text(`of ${TARGETS[state.targetIdx]}`, r.x + 22, r.y + r.h * 0.75, 20, 'rgba(246,234,208,0.7)', UI, 600, 'left');
  }
  // ---- contract chip
  if (!study) plaque(ctx, CHIP, 0.8);
  let chip;
  if (H.phase === 'bid' || H.phase === 'lessondone' && !ct) chip = `Bidding, round ${H.round}`;
  else if (H.phase === 'double') chip = 'Doubling';
  else chip = null;
  if (study) { /* header carries the contract */ } else if (chip) fit(chip, CHIP.x + CHIP.w / 2, CHIP.y + CHIP.h / 2 + 9, 26, CHIP.w - 16, CREAM, 700);
  else if (ct && !study) {
    const w = H.taken ? H.tricks : 0, label = ct.type === 'sun' ? 'SUN' : 'HOKUM', who = `${H.mult > 1 ? 'x' + H.mult + '  ' : ''}${ct.buyer === 0 ? 'You' : NAMES[ct.buyer]} bought`;
    if (CHIP.h < 70) {
      text(label, CHIP.x + 24, CHIP.y + CHIP.h / 2 + 9, 26, '#ffe08a', UI, 800, 'left');
      if (ct.type === 'hokum') lightSuit(ct.trump, CHIP.x + 148, CHIP.y + CHIP.h / 2 - 1, 30);
      text(who, CHIP.x + 190, CHIP.y + CHIP.h / 2 + 8, 22, CREAM, UI, 700, 'left');
      text(`${w}/8`, CHIP.x + CHIP.w - 20, CHIP.y + CHIP.h / 2 + 8, 22, 'rgba(246,234,208,0.8)', UI, 700, 'right');
    } else {   // a narrow column: two rows
      text(label, CHIP.x + 16, CHIP.y + 32, 26, '#ffe08a', UI, 800, 'left');
      if (ct.type === 'hokum') lightSuit(ct.trump, CHIP.x + CHIP.w - 34, CHIP.y + 22, 30);
      fit(who, CHIP.x + 16, CHIP.y + CHIP.h - 14, 22, CHIP.w - 90, CREAM, 700, 'left');
      text(`${w}/8`, CHIP.x + CHIP.w - 16, CHIP.y + CHIP.h - 14, 22, 'rgba(246,234,208,0.8)', UI, 700, 'right');
    }
  }
  // ---- Auto Play HUD: phase status + configurable think-time stepper
  if (isAuto && A) {
    plaque(ctx, AUTO_BAR, 0.82);
    const phaseLabel = A.phase === 'think' ? 'Thinking...' : A.phase === 'reveal' ? 'About to act:' : A.phase === 'summary' ? 'Hand done' : A.phase === 'ended' ? 'Match complete' : '...';
    let who = '';
    if (A.chosen) who = NAMES[A.chosen.seat] + (A.chosen.kind === 'bid' ? ' bids' : A.chosen.kind === 'double' ? ' answers' : ' plays');
    const msg = A.phase === 'reveal' && A.chosen ? `${phaseLabel} ${who}` : phaseLabel, at = T.autoText;
    if (at.wrap) wrap(msg, at.x, at.y, at.size, at.maxW, '#ffe08a', at.size * 1.25, 'left', 700); else fit(msg, at.x, at.y, at.size, at.maxW, '#ffe08a', 700, 'left');
    text(`Think ${autoThinkLabel(state)}`, T.autoLabel.x, T.autoLabel.y, T.autoLabel.size, CREAM, UI, 700, 'center');
    button(ctx, AUTO_DEC, '-', { size: 26 }); button(ctx, AUTO_INC, '+', { size: 26 });
    if (A.paused) shadowText('PAUSED', T.autoPaused.x, T.autoPaused.y, 22, '#ffd0a8', UI, 800);
  }
  // ---- opponents' hands (backs, or faces in study / Auto Play) and name plates
  const nb = (s) => Math.floor(state.shown[s] + 0.001);
  const P = T.partner, Sd = T.side, fw = CW * 0.5;
  if (study || isAuto) {
    const face = (seat, x0, y0, dx, dy) => {
      const rv = autoReveal && autoReveal.chosen.kind === 'play' && autoReveal.chosen.seat === seat ? autoReveal : null;
      const legalSetR = rv ? new Set(rv.legal) : null;
      H.hands[seat].forEach((c, k) => {
        const dim = rv ? !legalSetR.has(c) : false;
        const glow = rv && rv.chosen.action.card === c ? '#ffe08a' : null;
        drawCard(ctx, c, x0 + k * dx, y0 + k * dy, 0.5, { four, noShadow: false, dim, glow });
      });
    };
    const n2 = H.hands[2].length, sp = n2 > 1 ? Math.min(P.faces.step, P.faces.maxW / (n2 - 1)) : 0;
    face(2, P.faces.cx - (fw + sp * (n2 - 1)) / 2, P.faces.y, sp, 0);
    face(3, Sd.left.x - fw / 2, Sd.top, 0, Sd.pitch); face(1, Sd.right.x - fw / 2, Sd.top, 0, Sd.pitch);
  } else {
    const bs = P.backs.sc, bw = CW * bs, tot = bw + P.backs.pitch * 7;
    for (let k = 0; k < nb(2); k++) drawCard(ctx, -1, P.backs.cx - tot / 2 + k * P.backs.pitch, P.backs.y, bs, {});
    for (let k = 0; k < nb(3); k++) drawCard(ctx, -1, Sd.left.x - fw / 2, Sd.top + k * Sd.pitch, 0.5, { rot: Math.PI / 2 });
    for (let k = 0; k < nb(1); k++) drawCard(ctx, -1, Sd.right.x - fw / 2, Sd.top + k * Sd.pitch, 0.5, { rot: -Math.PI / 2 });
  }
  const plate = (s, x, y, w) => {
    const turn = H.turn === s && (H.phase === 'bid' || H.phase === 'play' || H.phase === 'double') && !state.show;
    const r = { x: x - w / 2, y, w, h: 40 }; plaque(ctx, r, turn ? 0.95 : 0.65);
    if (turn) { ctx.save(); ctx.strokeStyle = `rgba(255,224,138,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 14; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.stroke(); ctx.restore(); }
    text(NAMES[s], x, y + 28, 22, turn ? '#ffe08a' : CREAM, UI, 800);
    if (ct && ct.buyer === s) { ctx.fillStyle = '#e0b25a'; ctx.beginPath(); ctx.arc(r.x + r.w - 6, r.y + 6, 9, 0, TAU); ctx.fill(); text('B', r.x + r.w - 6, r.y + 11, 12, '#2a1606', UI, 800); }
  };
  plate(2, P.plate.x, P.plate.y, P.plate.w); plate(3, Sd.left.plateX, Sd.plateY, 104); plate(1, Sd.right.plateX, Sd.plateY, 104);
  // speech bubbles
  const bub = (s) => { const b = state.says[s]; if (!b) return; const a = Math.min(1, b.t * 6) * (b.t > 2.8 ? Math.max(0, 1 - (b.t - 2.8) * 4) : 1);
    if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.font = `800 26px ${UI}`; const w = ctx.measureText(b.text).width + 36; const yy = T.bubble[s].y - (1 - Math.min(1, b.t * 5)) * -10;
    const x = Math.max(U.x0 + 8 + w / 2, Math.min(U.x1 - 8 - w / 2, T.bubble[s].x));
    ctx.fillStyle = '#f6ead0'; rr(ctx, x - w / 2, yy - 28, w, 46, 22); ctx.fill(); ctx.strokeStyle = BRASS; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = '#2a1606'; ctx.textAlign = 'center'; ctx.fillText(b.text, x, yy + 6); ctx.restore(); };
  bub(2); bub(3); bub(1); bub(0);

  // ---- centre: turned-up card during bidding
  if (H.phase === 'bid' && H.floor >= 0) {
    const bob = calm ? 0 : Math.sin(t * 2) * 4, ds = T.deckSc;
    drawCard(ctx, H.floor, DECK.x - CW * ds / 2, DECK.y - CH * ds / 2 + bob, ds, { big, four });
    text('Turned-up card', DECK.x, DECK.y + CH * ds / 2 + 32, 24, 'rgba(255,240,200,0.9)', UI, 700);
  }

  // ---- cards: hand, then table, then the raised/dragged card on top
  const hand = H.hands[0], legalSet = new Set(H.phase === 'play' && H.turn === 0 && !state.show && (ui.delay <= 0) ? legalFor(hand, H.trick, ct, 0) : hand);
  const showLegal = H.phase === 'play' && H.turn === 0 && !state.show && H.trick.length > 0;
  const drawHandCard = (c, i) => {
    const p = state.pos[c]; if (!p) return; if (p.born && p.born > t) return;
    const dim = showLegal && !legalSet.has(c);
    const hint = ui.hint && ui.hint.kind === 'card' && ui.hint.card === c;
    const cur = ui.kb && ui.cursor === i && H.phase === 'play';
    const refused = ui.refuse && ui.refuse.card === c;
    const shake = refused ? Math.sin(ui.refuse.t * 60) * 7 * (1 - ui.refuse.t / 0.6) : 0;
    drawCard(ctx, c, p.x + shake, p.y - (hint && !calm ? Math.abs(Math.sin(t * 5)) * 10 : 0), p.sc, { big, four, dim, glow: hint ? '#ffe08a' : cur ? '#9fe0ff' : refused ? '#ff7070' : null });
  };
  hand.forEach((c, i) => { if (c !== ui.sel && !(ui.drag && ui.drag.card === c && ui.drag.moved)) drawHandCard(c, i); });
  const tt = state.show ? state.show.plays : H.trick;
  for (const pl of tt) { const p = state.pos[pl.card]; if (!p) continue; const winner = state.show && state.show.t > 0.15 && state.show.winner === pl.seat && state.show.t < 1.3;
    drawCard(ctx, pl.card, p.x, p.y, p.sc, { big, four, glow: winner ? '#ffe08a' : null }); }
  if (ui.sel >= 0 && hand.includes(ui.sel)) drawHandCard(ui.sel, hand.indexOf(ui.sel));
  if (ui.drag && ui.drag.moved) drawHandCard(ui.drag.card, hand.indexOf(ui.drag.card));
  // who won the trick
  if (state.show && state.show.t > 0.2 && state.show.t < 1.3) { const w = state.show.winner; shadowText(w === 0 ? 'You take it' : w === 2 ? 'Partner takes it' : `${NAMES[w]} takes it`, T.cx, T.takeY, 30, teamOf(w) === 0 ? '#ffe08a' : '#ffb0a0', UI, 800); }

  // ---- toast, lesson/daily header, panel, buttons
  if (sc === 'lesson') lessonHeader(ctx, state, V);
  else if (sc === 'daily') dailyHeader(ctx, state, V);
  else if (ui.msg) toast(ctx, ui.msg, V);
  panel(ctx, state, V);
  if (!isAuto && H.phase === 'play' && H.turn === 0 && !state.show && !state.panel.length && ui.delay <= 0 && !ui.summary) {
    const line = ui.sel >= 0 ? 'TAP the card again to play it, or DRAG it up' : H.trick.length ? 'Your turn: TAP a bright card' : 'You lead: TAP a card';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; fit(line, T.cx, T.promptY - (ui.sel >= 0 ? 8 : 0), 24, Math.min(T.handW, U.w - 40), '#ffe9b0', 700); ctx.restore();
  }
  if (ui.thinking && ui.thinking !== false && state.H.turn !== 0 && !state.show) { /* the computer is thinking */ ctx.fillStyle = 'rgba(255,224,138,0.9)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(T.cx - 22 + i * 22, T.takeY + Math.sin(t * 8 + i) * 4, 5, 0, TAU); ctx.fill(); } }
  if (isAuto) {
    button(ctx, BTN.hint, 'Skip', { size: 28, sub: 'this pause' });
    button(ctx, BTN.undo, A && A.paused ? 'Resume' : 'Pause', { size: 28 });
    button(ctx, BTN.menu, 'Exit', { size: 30 });
  } else {
    button(ctx, BTN.hint, 'Hint', { size: 30, sub: sc === 'lesson' ? 'repeat step' : `${ui.hintsLeft} left`, glow: false });
    button(ctx, BTN.undo, sc === 'daily' ? 'Try again' : 'Take back', { size: 28, dim: sc === 'lesson' });
    button(ctx, BTN.menu, 'Menu', { size: 30 });
  }
  if (ui.summary) summary(ctx, state, V);
}

function toast(ctx, m, V) {
  const a = Math.min(1, m.t * 5) * Math.min(1, (m.hold - m.t) * 3 + 0.01);
  ctx.save(); ctx.globalAlpha = Math.max(0, a);
  plaque(ctx, TOAST, 0.86);
  const mu = LAY.minU, base = Math.max(24, mu);
  ctx.font = `700 ${base}px ${UI}`;
  const words = m.text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > TOAST.w - 40 && cur) { lines.push(cur); cur = w; } else cur = t2; }
  lines.push(cur);
  const size = Math.max(mu, lines.length > 3 ? 19 : lines.length > 2 ? 21 : 24), lh = size * 1.22, y0 = TOAST.y + TOAST.h / 2 - (lines.length - 1) * lh / 2 + size * 0.35;
  lines.forEach((ln, i) => V.text(ln, TOAST.x + TOAST.w / 2, y0 + i * lh, size, CREAM, UI, 700));
  ctx.restore();
}
function lessonHeader(ctx, state, V) {
  const L = state.lesson, def = LESSONS[L.i], st = def.steps[L.s], ui = state.ui, r = TG.lessonHdr, narrow = r.w < 420;
  plaque(ctx, r, 0.92);
  const pad = narrow ? 16 : 24, tw = r.w - 2 * pad;
  if (narrow) V.wrap(`Lesson ${L.i + 1} of ${LESSONS.length}: ${def.title}`, r.x + pad, r.y + 34, 22, tw, '#ffe08a', 26, 'left', 800);
  else V.text(`Lesson ${L.i + 1} of ${LESSONS.length}: ${def.title}`, r.x + pad, r.y + 36, 25, '#ffe08a', UI, 800, 'left');
  const top = narrow ? r.y + 34 + 26 * 2 + 14 : r.y + 76;
  const body = L.done ? (L.after || 'Lesson complete.') : (st ? st.text : '');
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const fs = narrow ? (body.length > 150 ? 20 : 22) : (body.length > 150 ? 22 : 25); const nl = V.wrap(body, r.x + pad, top, fs, tw, CREAM, fs * 1.3, 'left', 700);
  const msg = ui.msg && ui.msg.text !== body ? ui.msg.text : null;
  if (msg) { ctx.strokeStyle = 'rgba(224,178,90,0.4)'; ctx.beginPath(); ctx.moveTo(r.x + pad, top + nl * fs * 1.3 - 6); ctx.lineTo(r.x + r.w - pad, top + nl * fs * 1.3 - 6); ctx.stroke(); V.wrap(msg, r.x + pad, top + nl * fs * 1.3 + 22, 20, tw, '#ffd9a0', 24, 'left', 600); }
  ctx.restore();
  if (L.done && state.H.phase !== 'done' && !(state.H.phase === 'play' && state.H.trick.length > 0 && state.H.turn !== 0)) button(ctx, OVERLAY_BTN, L.i + 1 < LESSONS.length ? 'Next lesson' : 'All lessons', { primary: true, size: 32, glow: true, pulse: state.t });
}
function dailyHeader(ctx, state, V) {
  const d = state.daily, p = d.puzzle, H = state.H, ui = state.ui, r = TG.lessonHdr, narrow = r.w < 420;
  plaque(ctx, r, 0.92);
  const pad = narrow ? 16 : 24, tw = r.w - 2 * pad;
  V.text('Daily deal', r.x + pad, r.y + 38, 26, '#ffe08a', UI, 800, 'left');
  V.text(`Streak ${d.streak}`, r.x + r.w - pad, r.y + 38, 24, CREAM, UI, 700, 'right');
  let yb = r.y + 74;
  if (p) {
    const nl = V.wrap(`${p.type === 'sun' ? 'Sun' : 'Hokum, ' + SUIT_NAMES[p.trump] + ' is trump'}. You lead; North is your partner. Your team needs ${p.target} of the ${p.total} points left (last trick +10). All hands are face up.`, r.x + pad, yb, narrow ? 20 : 22, tw, CREAM, narrow ? 25 : 28, 'left', 700);
    yb += nl * (narrow ? 25 : 28) + 8;
    const roomy = !narrow && r.w >= 620;      // roomy header: the running count sits in the title row, so the hint line below never collides with it
    V.text(`Your team so far: ${H.taken[0]} of ${p.target}`, narrow ? r.x + pad : roomy ? r.x + r.w / 2 : r.x + r.w - pad, narrow ? yb + 14 : roomy ? r.y + 38 : r.y + r.h - 16, 22, '#ffe08a', UI, 800, narrow ? 'left' : roomy ? 'center' : 'right');
    yb += narrow ? 44 : 0; if (roomy) yb -= 20;
  }
  if (ui.msg) { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); V.wrap(ui.msg.text, r.x + pad, narrow ? yb : Math.max(r.y + 150, yb + (r.w >= 620 ? 8 : 24)), 20, tw, '#ffd9a0', 24, 'left', 600); ctx.restore(); }
  if (d.wrong) button(ctx, OVERLAY_BTN, 'Try again', { primary: true, size: 32, glow: true, pulse: state.t });
}

function panel(ctx, state, V) {
  const P = state.panel; if (!P.length) return;
  const ui = state.ui;
  ctx.save(); ctx.fillStyle = 'rgba(14,6,8,0.66)'; rr(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 26); ctx.fill(); ctx.strokeStyle = 'rgba(224,178,90,0.65)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  const cx = PANEL.x + PANEL.w / 2;
  if (PANEL.col) { let yy = PANEL.y + 30; state.panelText.forEach((s) => { yy += V.wrap(s, cx, yy, 20, PANEL.w - 24, CREAM, 24, 'center', 700) * 24 + 4; }); }
  else if (state.panelText.length) state.panelText.forEach((s, i) => V.fit(s, cx, PANEL.y + 36 + i * 26, 22, PANEL.w - 28, CREAM, 700));
  const hintKey = ui.hint && ui.hint.kind === 'bid' ? ui.hint.a : null;
  const hintDbl = ui.hint && ui.hint.kind === 'dbl' ? ui.hint : null;
  P.forEach((b, i) => {
    const hinted = (hintKey && b.kind === 'bid' && b.a.t === hintKey.t && (b.a.suit ?? -1) === (hintKey.suit ?? -1)) || (hintDbl && b.kind === 'dbl' && b.raise === hintDbl.raise);
    const cur = ui.kb && ui.cursor === i;
    button(ctx, b.r, b.suit >= 0 ? '' : b.label, { primary: b.primary, size: b.r.h > 100 ? 34 : 30, sub: b.suit >= 0 && b.sub ? undefined : b.sub, glow: hinted || cur, pulse: state.t });
    if (b.suit >= 0) {
      const bx = b.r.x + b.r.w / 2, fs = Math.min(32, Math.max(20, Math.floor((b.r.w - 70) / 3.4)));
      ctx.font = `800 ${fs}px ${UI}`; const w = ctx.measureText(b.label).width;
      V.text(b.label, bx - 22 * fs / 32, b.r.y + b.r.h / 2 + fs * 0.38, fs, b.primary ? '#2a1606' : CREAM, UI, 800);
      drawSuit(ctx, b.suit, bx + w / 2 + 6 * fs / 32, b.r.y + b.r.h / 2 + 2, fs + 2, b.suit === 1 || b.suit === 2 ? '#c4171d' : '#15110f');
      void b.sub;
    }
  });
}

function summary(ctx, state, V) {
  const S = state.ui.summary, { text, wrap, fit } = V, M = LAY.summary;
  ctx.fillStyle = 'rgba(8,3,4,0.72)'; ctx.fillRect(0, 0, W, HH);
  const r = S.result, ct = S.contract;
  // ---- the daily deal result (short)
  if (S.daily) {
    const box = M.wide ? M.box : { x: 40, y: 200, w: 640, h: 1020 };
    ctx.save(); if (!M.wide) { ctx.translate(M.cx, M.top); ctx.scale(M.s, M.s); ctx.translate(-360, -200); }
    plaque(ctx, box, 0.94);
    const ox = box.x + box.w / 2, oy = M.wide ? box.y + box.h / 2 - 60 : 330;
    text(S.failed ? 'Not this time' : 'Solved!', ox, oy, 64, CREAM, FONT, 700);
    wrap(`Your team took ${S.got} points. The target was ${S.target}.${S.failed ? ' Every deal has an answer: try again and look at the first lead.' : ''}`, ox, oy + 90, 30, Math.min(540, box.w - 60), CREAM, 42);
    ctx.restore();
    button(ctx, OVERLAY_BTN, S.failed ? 'Try again' : 'Done', { primary: true, size: 32 }); return;
  }
  const buyer = ct.buyer, sun = ct.type === 'sun', won = r.buyerWon, bt = r.buyerTeam;
  const rows = [['', 'Us', 'Them'], ['Card points', r.taken[0], r.taken[1]], ['Game points', r.cardG[0], r.cardG[1]], ['Declarations', r.decl[0] ? '+' + r.decl[0] : '-', r.decl[1] ? '+' + r.decl[1] : '-'], ['Baloot', r.baloot[0] ? '+' + r.baloot[0] : '-', r.baloot[1] ? '+' + r.baloot[1] : '-'], ['Tricks won', r.wins[0], r.wins[1]]];
  let msg;
  if (r.kaboot >= 0) msg = `Kaboot: ${r.kaboot === 0 ? 'your team' : 'the other team'} won all eight tricks.`;
  else msg = won ? `${TEAM[bt]} made the contract.` : `${TEAM[bt]} failed the contract: every point goes to ${TEAM[1 - bt]}.`;
  const bought = `${buyer === 0 ? 'You' : NAMES[buyer]} bought ${sun ? 'Sun' : 'Hokum ' + SUIT_NAMES[ct.trump]}${S.mult > 1 ? ' (x' + S.mult + ')' : ''}`;
  const ms = S.auto ? (state.autoMatch?.scores ?? [0, 0]) : state.match.scores;
  const matchLine = `Match: Us ${ms[0]}, Them ${ms[1]}  (to ${TARGETS[state.targetIdx]})`;
  if (!M.wide) {
    // design space: the 640 x 1020 card at (40, 200), scaled to fit above the buttons
    ctx.save(); ctx.translate(M.cx, M.top); ctx.scale(M.s, M.s); ctx.translate(-360, -200);
    plaque(ctx, { x: 40, y: 200, w: 640, h: 1020 }, 0.94);
    text(S.lesson ? 'Hand tally' : 'Hand result', 360, 290, 62, CREAM, FONT, 700);
    text(bought, 360, 350, 28, 'rgba(246,234,208,0.9)', UI, 700);
    rows.forEach((row, i) => { const y = 430 + i * 62; if (i === 0) { text(row[1], 470, y, 28, '#ffe08a', UI, 800, 'center'); text(row[2], 600, y, 28, CREAM, UI, 800, 'center'); return; }
      text(row[0], 78, y, 27, CREAM, UI, 600, 'left'); text(String(row[1]), 470, y, 30, '#ffe08a', UI, 800); text(String(row[2]), 600, y, 30, CREAM, UI, 800);
      ctx.strokeStyle = 'rgba(224,178,90,0.25)'; ctx.beginPath(); ctx.moveTo(70, y + 18); ctx.lineTo(650, y + 18); ctx.stroke(); });
    wrap(msg, 360, 850, 27, 560, won ? CREAM : '#ffd0a8', 34);
    text('Points scored this hand', 360, 950, 24, 'rgba(246,234,208,0.8)', UI, 700);
    text(`Us +${r.delta[0]}      Them +${r.delta[1]}`, 360, 1010, 46, '#ffe08a', UI, 800);
    if (!S.lesson) { text(matchLine, 360, 1080, 26, CREAM, UI, 700); if (r.matchCall) text('Match call decided the match.', 360, 1120, 24, '#ffd0a8', UI, 700); }
    ctx.restore();
  } else {
    // two columns inside the box: the tally on the left, the outcome on the right
    const b = M.box; plaque(ctx, b, 0.94);
    const lw = b.w * 0.5 - 24, lx = b.x + 24, rx = b.x + b.w * 0.5 + 12, rw = b.w * 0.5 - 36;
    const pitch = Math.min(56, (b.h - 190) / 6);
    text(S.lesson ? 'Hand tally' : 'Hand result', lx + lw / 2, b.y + 60, 50, CREAM, FONT, 700);
    fit(bought, lx + lw / 2, b.y + 100, 24, lw, 'rgba(246,234,208,0.9)', 700);
    const c1 = lx + lw * 0.64, c2 = lx + lw * 0.9;
    rows.forEach((row, i) => { const y = b.y + 150 + i * pitch; if (i === 0) { text(row[1], c1, y, 26, '#ffe08a', UI, 800, 'center'); text(row[2], c2, y, 26, CREAM, UI, 800, 'center'); return; }
      fit(row[0], lx, y, 25, lw * 0.5, CREAM, 600, 'left'); text(String(row[1]), c1, y, 28, '#ffe08a', UI, 800); text(String(row[2]), c2, y, 28, CREAM, UI, 800);
      ctx.strokeStyle = 'rgba(224,178,90,0.25)'; ctx.beginPath(); ctx.moveTo(lx, y + 14); ctx.lineTo(lx + lw, y + 14); ctx.stroke(); });
    ctx.strokeStyle = 'rgba(224,178,90,0.35)'; ctx.beginPath(); ctx.moveTo(b.x + b.w * 0.5, b.y + 24); ctx.lineTo(b.x + b.w * 0.5, b.y + b.h - 24); ctx.stroke();
    let y = b.y + 80;
    y += wrap(msg, rx + rw / 2, y, 26, rw, won ? CREAM : '#ffd0a8', 32) * 32 + 22;
    text('Points scored this hand', rx + rw / 2, y, 22, 'rgba(246,234,208,0.8)', UI, 700); y += 52;
    fit(`Us +${r.delta[0]}   Them +${r.delta[1]}`, rx + rw / 2, y, 42, rw, '#ffe08a', 800); y += 54;
    if (!S.lesson) { wrap(matchLine, rx + rw / 2, y, 24, rw, CREAM, 30, 'center', 700); y += 70; if (r.matchCall) text('Match call decided the match.', rx + rw / 2, y, 22, '#ffd0a8', UI, 700); }
  }
  if (S.auto) {
    const ended = S.matchWinner >= 0;
    button(ctx, OVERLAY_BTN, ended ? 'Play again' : 'Watching...', { primary: true, size: 32, glow: ended, pulse: state.t, dim: !ended });
    if (ended) button(ctx, OVERLAY_BTN2, 'Exit to menu', { size: 28 });
    else wrap('Auto-continuing to the next hand...', OVERLAY_BTN2.x + OVERLAY_BTN2.w / 2, OVERLAY_BTN2.y + OVERLAY_BTN2.h / 2, 20, OVERLAY_BTN2.w, 'rgba(246,234,208,0.75)', 24);
    return;
  }
  button(ctx, OVERLAY_BTN, S.lesson ? 'Next lesson' : S.matchWinner >= 0 ? 'See result' : 'Next hand', { primary: true, size: 32, glow: true, pulse: state.t });
}
export { star8, DECL, declValue, SEAT_NAMES, TW, TH, BH, CH, HAND_Y, LIFT, TRICK, SEAT, TABLE, handSlot, cardShort };
