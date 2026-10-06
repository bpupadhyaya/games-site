// Everything drawn each frame. Reads `state` (game.js) and the live layout `L` (layout.js, a pure function of the screen size).
// The only things it writes back are layout caches that the next update needs: `state.maxScroll` (how far a page can scroll)
// and `state.hits` (settings tap rectangles).
import { CW, CH, TEXT_SCALES, AUTO_THINK_STEPS, titleFor, largeTitle, badgeRect, seatRects } from './layout.js';
import { drawBackground, drawTable, drawCard, button, plaque, rr, drawGesture, bunting, FONT, UI, GOLD, CREAM, GREEN, fontMin } from './art.js';
import * as RL from './rules.js';
import { levelOf } from './ai.js';
import { RULES, ABOUT, HOWTO } from './rulesContent.js';
import { drawCredit, drawMoreLine, drawLockup } from './brand.js';

const TAU = Math.PI * 2;
const NAMES4 = ['You', 'Right', 'Partner', 'Left'];
const DIM = 'rgba(255,246,221,0.78)';

// ---- text helpers -----------------------------------------------------------------------------------------------
function makeV(ctx, mf) {
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${Math.max(size, mf)}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; text(str, x, y, size, color, font, weight, align); ctx.restore(); };
  // greedy word wrap that also breaks over-long hyphenated words; returns lines
  const lines = (str, size, maxW, weight = 600, font = UI) => {
    ctx.font = `${weight} ${Math.max(size, mf)}px ${font}`;
    const words = [];
    for (const rw of String(str).split(' ')) {
      if (ctx.measureText(rw).width > maxW && rw.includes('-')) { const parts = rw.split('-'); parts.forEach((p, i) => words.push(i < parts.length - 1 ? p + '-' : p)); } else words.push(rw);
    }
    const out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.32, align = 'center', weight = 600, font = UI) => {
    const ls = lines(str, size, maxW, weight, font); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align)); return ls.length;
  };
  // the largest size <= `size` (never below the readable minimum) at which `str` fits `maxW`
  const fit = (str, maxW, size, weight = 700, font = UI) => { let s = Math.max(size, mf); ctx.font = `${weight} ${s}px ${font}`; while (s > mf && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; } return s; };
  const fitText = (str, x, y, maxW, size, color = CREAM, font = UI, weight = 700, align = 'center') => text(str, x, y, fit(str, maxW, size, weight, font), color, font, weight, align);
  return { text, shadowText, lines, wrap, fit, fitText, mf };
}
// A vertical flow inside a clipped, scrollable region. Draws as it measures; returns the content height.
// Wrapped-line cache for flowed pages: wrapping depends only on (text, size, weight, font, width, minimum font), so it is measured once
// and reused every frame; readerStats.wraps counts real (uncached) wraps (tests read it).
export const readerStats = { wraps: 0 };
const wrapMemo = new Map(); let memoEpoch = '';
function flow(ctx, V, state, region, build) {
  ctx.font = `800 40px ${FONT}`; const e1 = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`;
  const epoch = `${e1}|${ctx.measureText('Hamburgefonstiv').width}`; if (epoch !== memoEpoch) { memoEpoch = epoch; wrapMemo.clear(); }   // a web font finishing loading drops it
  ctx.save(); ctx.beginPath(); ctx.rect(region.x, region.y, region.w, region.h); ctx.clip();
  const pad = Math.min(34, region.w * 0.05);
  const F = { y: region.y - state.scroll, x0: region.x + pad, w: region.w - 2 * pad, cx: region.x + region.w / 2, top: region.y, bottom: region.y + region.h };
  F.gap = (n) => { F.y += n; };
  F.p = (str, size, color = CREAM, weight = 600, align = 'left', gap = 0.55, font = UI) => {
    const lh = Math.round(Math.max(size, V.mf) * 1.36), mk = `${weight}|${font}|${Math.max(size, V.mf)}|${Math.round(F.w * 100)}|${str}`;
    let ls = wrapMemo.get(mk); if (!ls) { readerStats.wraps++; ls = V.lines(str, size, F.w, weight, font); wrapMemo.set(mk, ls); }
    const x = align === 'center' ? F.cx : align === 'right' ? F.x0 + F.w : F.x0;
    ls.forEach((ln, i) => { const ly = F.y + size + i * lh; if (ly > F.top - lh && ly - size < F.bottom + lh) V.text(ln, x, ly, size, color, font, weight, align); });   // visible slice only
    F.y += ls.length * lh + Math.round(size * gap);
  };
  F.line = () => { ctx.strokeStyle = 'rgba(255,210,63,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(F.x0 + 20, F.y); ctx.lineTo(F.x0 + F.w - 20, F.y); ctx.stroke(); F.y += 22; };
  build(F);
  const total = F.y + state.scroll - region.y + 30;
  ctx.restore();
  state.maxScroll = Math.max(0, total - region.h);
  if (state.maxScroll > 0) {
    const th = Math.max(50, region.h * region.h / total), ty = region.y + (region.h - th) * (state.scroll / state.maxScroll);
    ctx.fillStyle = 'rgba(255,210,63,0.55)'; rr(ctx, region.x + region.w - 8, ty, 5, th, 3); ctx.fill();
  }
  return total;
}

export function render(ctx, state, L) {
  const sc = state.scene, t = state.t, V = makeV(ctx, L.minFont);
  fontMin.v = L.minFont;
  ctx.save();
  drawBackground(ctx, t, L.w, L.h);
  if (sc === 'title') title(ctx, state, V, L);
  else if (sc === 'settings') settingsPage(ctx, state, V, L);
  else if (sc === 'about') refPage(ctx, state, V, L, ABOUT, state.aboutPage, 'About');
  else if (sc === 'how') refPage(ctx, state, V, L, HOWTO, state.howPage, 'How to Play');
  else if (sc === 'rules') refPage(ctx, state, V, L, RULES, state.page, 'Game Rules');
  else if (sc === 'over') overPage(ctx, state, V, L);
  else if (sc === 'demo-limit') demoPage(ctx, state, V, L);
  else if (state.H) table(ctx, state, V, L);
  ctx.restore();
}

// ---- the title ----------------------------------------------------------------------------------------------------
function fanCards(variant) {
  // Paulista: a vira of 6 turns the four 7s into manilhas. Mineiro: the four fixed manilhas.
  if (variant === 'mineiro') return [RL.card(0, 3), RL.card(1, 7), RL.card(2, 3), RL.card(3, 0)];
  return [RL.card(0, 3), RL.card(1, 3), RL.card(2, 3), RL.card(3, 3)];
}
function zoomPills(ctx, state, V, L) {
  plaque(ctx, L.dec, 0.95); plaque(ctx, L.inc, 0.95);
  button(ctx, L.dec, 'A−', { size: 26, dim: state.textScaleIdx === 0 }); button(ctx, L.inc, 'A+', { size: 26, dim: state.textScaleIdx >= TEXT_SCALES.length - 1 });
  V.text(`${Math.round(TEXT_SCALES[state.textScaleIdx] * 100)}%`, L.pct.x, L.pct.y, 22, DIM, UI, 700, 'right');
}
function titleHeader(ctx, state, V, L, o) {
  const t = state.t, hd = o.hd, cx = hd.cx;
  bunting(ctx, t, 0, 1, L.w);
  const g = ctx.createRadialGradient(cx, hd.fanY, 20, cx, hd.fanY, Math.min(360, hd.aw * 0.5)); g.addColorStop(0, 'rgba(255,210,63,0.22)'); g.addColorStop(1, 'rgba(255,210,63,0)'); ctx.fillStyle = g; ctx.fillRect(cx - hd.aw / 2, hd.fanY - 380, hd.aw, 760);
  const cards = fanCards(state.variant), s = hd.fanS;
  cards.forEach((c, i) => {
    const a = (i - 1.5) * 0.2 + Math.sin(t * 0.8 + i) * 0.015, x = cx + (i - 1.5) * hd.fanGap, y = hd.fanY + Math.abs(i - 1.5) * 24 * s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    drawCard(ctx, c, -CW * s / 2, -CH * s / 2, s, { big: state.set.big, four: state.set.four, man: true, t: t + i * 0.3 }); ctx.restore();
  });
  ctx.save(); ctx.shadowColor = 'rgba(255,200,40,0.7)'; ctx.shadowBlur = 30;
  const gr = ctx.createLinearGradient(0, hd.titleY - hd.titleSize * 0.75, 0, hd.titleY + 8); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#f2b705');
  V.text('Truco', cx, hd.titleY, hd.titleSize, gr, FONT, 800); ctx.restore();
  ctx.save(); ctx.translate(cx, hd.ribbonY); ctx.fillStyle = GREEN; rr(ctx, -hd.ribbonW / 2, -hd.ribbonH / 2, hd.ribbonW, hd.ribbonH, 10); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  V.fitText('BRASILEIRO  ·  MANILHA', cx, hd.ribbonY + Math.max(hd.ribbonH * 0.5, V.mf) * 0.35, hd.ribbonW - 24, hd.ribbonH * 0.5, '#fff2a0', UI, 800);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; V.fitText('Shout it. Bluff it. Win with the manilha.', cx, hd.tagY, hd.aw - 30, 26, '#fff6dd', UI, 600); ctx.restore();
  const sub = state.variant === 'mineiro' ? 'Zap · Copas · Espadilha · Pica-fumo: always the same four' : 'The vira turns four manilhas: Zap · Copas · Espadilha · Pica-fumo';
  V.wrap(sub, cx, hd.subY, 20, hd.aw - 40, DIM, 26, 'center', 700);
}
function brandMark(ctx, o, state) {
  const k = o.lockup, dn = state && state.lkDown, kw = k.w ?? k.h * 1200 / 327;
  ctx.save(); ctx.fillStyle = 'rgba(2,24,18,0.62)'; rr(ctx, k.cx - kw / 2 - 10, k.y - 5, kw + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  if (!drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1)) drawCredit(ctx, k.cx, k.y + k.h * 0.6, 20, { dim: 0.85 });
}
function title(ctx, state, V, L) {
  if (state.textScaleIdx > 0) return titleLarge(ctx, state, V, L);
  const R = titleFor(L, !!state.saved), V0 = RL.VARIANTS;
  titleHeader(ctx, state, V, L, R);
  const sz = (r, base) => Math.min(base, r.h * 0.5);
  if (R.resume) button(ctx, R.resume, 'Resume match', { primary: true, size: Math.min(34, R.resume.h * 0.4), sub: `You ${state.saved.match.scores[0]}, Them ${state.saved.match.scores[1]}` });
  button(ctx, R.play, 'Play a match', { primary: !R.resume, size: Math.min(38, R.play.h * 0.4), sub: `${V0[state.variant].name}, ${state.n === 4 ? 'with a partner' : 'head to head'}, to ${RL.TARGET}` });
  const seg = (rects, labels, active) => rects.forEach((r, i) => button(ctx, r, labels[i], { size: sz(r, 26), on: i === active, dim: false }));
  seg(R.variant, ['Paulista', 'Mineiro'], state.variant === 'paulista' ? 0 : 1);
  seg(R.players, ['2 players', '4 players'], state.n === 2 ? 0 : 1);
  seg(R.level, ['Rookie', 'Regular', 'Master'], state.level - 1);
  button(ctx, R.how, 'How to Play', { size: sz(R.how, 28) }); button(ctx, R.rules, 'Rules', { size: sz(R.rules, 28) });
  button(ctx, R.about, 'About', { size: sz(R.about, 24) }); button(ctx, R.settings, 'Settings', { size: sz(R.settings, 24) }); button(ctx, R.auto, 'Auto Play', { size: sz(R.auto, 24) });
  V.fitText(levelOf(state.level).blurb, R.blurbX, R.blurbY, R.blurbW, 21, DIM, UI, 600);
  brandMark(ctx, R, state);
  zoomPills(ctx, state, V, L);
}
function titleLarge(ctx, state, V, L) {
  const k = TEXT_SCALES[state.textScaleIdx], LT = largeTitle(L.w, k, !!state.saved), sy = state.scroll, cx = L.w / 2;
  ctx.save(); ctx.translate(0, -sy);
  bunting(ctx, state.t, 0, 1, L.w);
  ctx.save(); ctx.shadowColor = 'rgba(255,200,40,0.7)'; ctx.shadowBlur = 20;
  const gr = ctx.createLinearGradient(0, 120, 0, 230); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#f2b705');
  V.text('Truco', cx, 220, 140, gr, FONT, 800); ctx.restore();
  V.text('BRASILEIRO  ·  MANILHA', cx, 280, 26, '#fff2a0', UI, 800);
  const label = { resume: 'Resume match', play: 'Play a match', variant: `Style: ${RL.VARIANTS[state.variant].name}`, players: `Players: ${state.n}`, level: `Level: ${levelOf(state.level).name}`, how: 'How to Play', rules: 'Rules', about: 'About', settings: 'Settings', auto: 'Auto Play' };
  const sub = { variant: 'tap to switch', players: 'tap to switch', level: 'tap to change' };
  for (const [id, r] of Object.entries(LT.rows)) button(ctx, r, label[id], { size: Math.round(30 * k), primary: id === 'play', sub: sub[id] });
  brandMark(ctx, { lockup: { ...LT.lock, y: LT.lock.y + 6 } }, state);
  ctx.restore();
  state.maxScroll = Math.max(0, LT.contentH + 70 - L.h);
  zoomPills(ctx, state, V, L);
}

// ---- simple pages -------------------------------------------------------------------------------------------------
function pageFrame(ctx, V, L, titleText) {
  ctx.fillStyle = 'rgba(3,20,17,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  V.text(titleText, L.w / 2, L.settings.titleY + 26, 60, CREAM, FONT, 800); button(ctx, L.back, 'Back', { size: 28 });
}
function toggle(ctx, x, y, on) {
  const p = { x, y, w: 104, h: 52 };
  ctx.fillStyle = on ? '#ffd23f' : 'rgba(0,0,0,0.5)'; rr(ctx, p.x, p.y, p.w, p.h, 26); ctx.fill();
  ctx.fillStyle = on ? '#2a1606' : '#fff6dd'; ctx.beginPath(); ctx.arc(on ? p.x + p.w - 26 : p.x + 26, p.y + 26, 20, 0, TAU); ctx.fill();
}
function settingsPage(ctx, state, V, L) {
  pageFrame(ctx, V, L, 'Settings');
  const k = TEXT_SCALES[state.textScaleIdx] ?? 1, hits = [];
  const rows = [['sound', 'Sound', 'Card slaps, shouts and chimes'], ['calm', 'Reduced motion', 'Quicker, calmer animation and fewer particles'], ['big', 'Large-print cards', 'Bigger ranks and suits on every card'], ['four', 'Four-colour suits', 'Easier to tell the suits apart']];
  flow(ctx, V, state, L.settings.region, (F) => {
    const lsz = Math.round(30 * k), ssz = Math.round(21 * k), tw = 130, tx = F.x0 + F.w - tw;
    for (const [key, label, sub] of rows) {
      const ll = V.lines(label, lsz, F.w - tw - 50, 800), sl = V.lines(sub, ssz, F.w - tw - 50, 600), sh = Math.round(Math.max(ssz, V.mf) * 1.3), lh = Math.round(lsz * 1.25);
      const h = 40 + ll.length * lh + sl.length * sh + 14;
      const r = { x: F.x0, y: F.y, w: F.w, h }; button(ctx, r, '', {});
      ll.forEach((ln, i) => V.text(ln, r.x + 26, r.y + 26 + lsz + i * lh, lsz, CREAM, UI, 800, 'left'));
      const y2 = r.y + 26 + ll.length * lh + 6;
      sl.forEach((ln, i) => V.text(ln, r.x + 26, y2 + ssz + i * sh, ssz, DIM, UI, 600, 'left'));
      toggle(ctx, tx, r.y + h / 2 - 26, state.set[key]);
      hits.push({ key, r });
      F.y += h + 18;
    }
    const lsz2 = Math.round(30 * k), ll = V.lines('Text size', lsz2, F.w - 60, 800), sl = V.lines(`${Math.round(k * 100)}% on the rules, about and menu pages`, Math.round(21 * k), F.w - 60, 600);
    const sh = Math.round(Math.max(21 * k, V.mf) * 1.3), lh = Math.round(lsz2 * 1.25);
    const h = 40 + ll.length * lh + sl.length * sh + 110;
    const r = { x: F.x0, y: F.y, w: F.w, h }; button(ctx, r, '', {});
    ll.forEach((ln, i) => V.text(ln, r.x + 26, r.y + 26 + lsz2 + i * lh, lsz2, CREAM, UI, 800, 'left'));
    const y2 = r.y + 26 + ll.length * lh + 6;
    sl.forEach((ln, i) => V.text(ln, r.x + 26, y2 + Math.round(21 * k) + i * sh, Math.round(21 * k), DIM, UI, 600, 'left'));
    const by = r.y + h - 90, dec = { x: r.x + 26, y: by, w: 130, h: 68 }, inc = { x: r.x + r.w - 156, y: by, w: 130, h: 68 };
    button(ctx, dec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(ctx, inc, 'A+', { size: 28, dim: state.textScaleIdx >= TEXT_SCALES.length - 1 });
    hits.push({ key: 'dec', r: dec }, { key: 'inc', r: inc });
    F.y += h + 24;
    F.p('Preview', 24, DIM, 700, 'center', 0.4);
    const py = F.y, cs = Math.min(0.8, (F.w - 30) / (4 * CW)), pitch = CW * cs + 8, x0 = F.cx - (pitch * 3 + CW * cs) / 2;
    [RL.card(1, 7), RL.card(2, 3), RL.card(3, 0), RL.card(0, 9)].forEach((c, i) => drawCard(ctx, c, x0 + i * pitch, py, cs, { big: state.set.big, four: state.set.four, man: i === 2, t: state.t }));
    F.y += CH * cs + 30;
    F.p('Your choices are saved on this device.', 22, DIM, 600, 'center');
  });
  state.hits = hits;
}
function drawRuleCards(ctx, state, V, F, list) {
  const n = list.length, gap = 14, maxW = F.w;
  const sc = Math.min(0.62, (maxW - (n - 1) * gap) / (n * CW)), w = CW * sc, h = CH * sc;
  let x = F.cx - (n * w + (n - 1) * gap) / 2; const y0 = F.y + 6;
  const seen = F.y + h + 50 > F.top && F.y < F.bottom;   // cards and labels only when on screen
  for (const it of list) {
    if (!seen) { x += w + gap; continue; }
    drawCard(ctx, it.c, x, y0, sc, { four: state.set.four, big: state.set.big, man: !!it.man, t: state.t });
    V.text(it.label, x + w / 2, y0 + h + 24, 17, CREAM, UI, 700);
    x += w + gap;
  }
  F.y += h + 50;
}
function refPage(ctx, state, V, L, list, page, header) {
  ctx.fillStyle = 'rgba(2,14,12,0.88)'; ctx.fillRect(0, 0, L.w, L.h);
  const P = L.refPanel, k = TEXT_SCALES[state.textScaleIdx] ?? 1;
  plaque(ctx, P, 0.62);
  ctx.save(); ctx.strokeStyle = 'rgba(255,210,63,0.28)'; ctx.lineWidth = 1; rr(ctx, P.x + 8, P.y + 8, P.w - 16, P.h - 16, 14); ctx.stroke(); ctx.restore();
  const region = { x: P.x + 4, y: P.y + 96, w: P.w - 8, h: P.h - 150 };
  const hs = Math.min(Math.round(36 * k), 46), ts = Math.round(33 * k), bs = Math.round(30 * k);
  const hl = V.lines(header, hs, P.w - 60, 800, FONT);
  ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, 100); ctx.clip();
  hl.forEach((ln, i) => V.text(ln, P.x + P.w / 2, P.y + 22 + hs + i * Math.round(hs * 1.1), hs, CREAM, FONT, 800));
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 50, P.y + 92); ctx.lineTo(P.x + P.w - 50, P.y + 92); ctx.stroke();
  flow(ctx, V, state, region, (F) => {
    // One continuous reader: every section in order, separated by a thin rule.
    list.forEach((item, idx) => {
      if (idx > 0) { F.gap(Math.round(bs * 0.3)); F.line(); F.gap(Math.round(bs * 0.2)); }
      F.p(item.title, ts, GOLD, 800, 'center', 0.5, FONT);
      if (item.cards && item.cards.length) drawRuleCards(ctx, state, V, F, item.cards);
      for (const line of item.lines) F.p(line, bs, CREAM, 600, 'left', 0.7);
    });
  });
  button(ctx, L.refBack, 'Back', { size: 34 });
  button(ctx, L.refNext, 'Done', { size: 34, primary: true });
  zoomPills(ctx, state, V, L);
}
function demoPage(ctx, state, V, L) {
  ctx.fillStyle = 'rgba(3,20,17,0.6)'; ctx.fillRect(0, 0, L.w, L.h);
  bunting(ctx, state.t, 0, 1, L.w);
  const cx = L.ov.cx, y0 = L.land ? 170 : L.h * 0.32, mw = Math.min(560, L.ov.content.w - 40);
  V.text('That was the preview', cx, y0, 60, CREAM, FONT, 800);
  V.wrap('Get the full game on iPhone or Android: unlimited matches, both Paulista and Mineiro, 2 or 4 players, and all three computer levels.', cx, y0 + 90, 30, mw, CREAM, 42);
  button(ctx, L.ov.btn, 'Back to title', { primary: true, size: 30 });
}
function overPage(ctx, state, V, L) {
  const won = state.match.winner === 0, m = state.match, k = TEXT_SCALES[state.textScaleIdx] ?? 1, t = state.t, st = state.stats;
  ctx.fillStyle = 'rgba(3,20,17,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const reg = L.land ? { ...L.ov.content, y: L.ov.content.y + 40, h: L.ov.content.h - 40 } : { ...L.ov.content, y: L.U.y0 + 96, h: L.ov.btn2.y - 12 - (L.U.y0 + 96) };
  flow(ctx, V, state, reg, (F) => {
    F.p(won ? 'You win the match!' : 'They win the match', Math.round(54 * k), CREAM, 800, 'center', 0.4, FONT);
    F.p(`Us ${m.scores[0]}   Them ${m.scores[1]}`, Math.round(50 * k), GOLD, 800, 'center', 0.4);
    F.p(`${m.hands} hand${m.hands === 1 ? '' : 's'} to ${RL.TARGET}. ${RL.VARIANTS[state.variant].name}, ${state.n} players, ${levelOf(state.level).name}.`, Math.round(25 * k), DIM, 600, 'center', 0.5);
    F.p(won ? 'Well played. The table is yours.' : 'A close match is good practice. Try Hint, or watch Auto Play.', Math.round(27 * k), CREAM, 600, 'center', 0.6);
    const y0 = F.y + 10, cards = [RL.card(0, 3), RL.card(1, 7), RL.card(2, 3), RL.card(3, 0)], cs = Math.min(0.8, F.w / 520), gp = 110 * cs / 0.8;
    cards.forEach((c, i) => { const a = (i - 1.5) * 0.2 + Math.sin(t * 0.8 + i) * 0.015; ctx.save(); ctx.translate(F.cx + (i - 1.5) * gp, y0 + 150 * cs / 0.8); ctx.rotate(a); drawCard(ctx, c, -CW * cs / 2, -CH * cs / 2, cs, { big: state.set.big, four: state.set.four, man: true, t: t + i * 0.3 }); ctx.restore(); });
    F.y = y0 + 300 * cs / 0.8;
    F.line();
    F.p(`Matches played ${st.played}, won ${st.wins}`, Math.round(26 * k), CREAM, 700, 'center', 0.4);
    F.p(`Hands won ${st.handsWon} of ${st.hands}`, Math.round(26 * k), CREAM, 700, 'center', 0.4);
    F.p(`Shouts made ${st.trucos}, runs forced ${st.runsFromMe}`, Math.round(26 * k), CREAM, 700, 'center', 0.4);
    F.y += 16; drawMoreLine(ctx, F.cx, F.y + 22, 22); F.y += 40;
  });
  button(ctx, L.ov.btn2, 'Play again', { size: 30 }); button(ctx, L.ov.btn, 'Back to title', { primary: true, size: 30 });
  zoomPills(ctx, state, V, L);
}

// ---- the table ----------------------------------------------------------------------------------------------------
const seatAtPos = (n, p) => (n === 4 ? p : p === 0 ? 0 : p === 2 ? 1 : -1);
function actorSeat(H) {
  if (H.phase === 'play') return H.turn;
  if (H.phase === 'raise') return H.answerSeat;
  if (H.phase === 'special') return H.teamOf.findIndex((x) => x === H.specialTeam);
  return -1;
}
const back = (x) => { const c1 = 1.70158, c3 = c1 + 1, u = Math.min(1, Math.max(0, x)); return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };

function scorePlate(ctx, V, r, label, score, target, gold) {
  plaque(ctx, r, 0.8);
  V.text(label, r.x + 16, r.y + r.h * 0.36, 20, DIM, UI, 800, 'left');
  V.text(`of ${target}`, r.x + 16, r.y + r.h * 0.76, 20, DIM, UI, 600, 'left');
  V.text(String(score), r.x + r.w - 16, r.y + r.h * 0.78, Math.min(54, r.h * 0.66), gold ? GOLD : CREAM, UI, 800, 'right');
}
function viraPlaque(ctx, V, r, H, big, four) {
  plaque(ctx, r, 0.8);
  const narrow = r.w < 300;
  if (H.vira < 0) {
    const names = ['Zap', 'Copas', 'Espadilha', 'Pica-fumo'];
    if (!narrow) {
      V.fitText('Fixed manilhas, best first', r.x + 14, r.y + r.h * 0.26, r.w - 24, 20, DIM, UI, 700, 'left');
      names.forEach((n, i) => V.fitText(`${i + 1}  ${n}`, r.x + 18 + (i % 2) * (r.w - 24) / 2, r.y + r.h * (0.56 + 0.26 * Math.floor(i / 2)), (r.w - 24) / 2 - 8, 22, CREAM, UI, 700, 'left'));
    } else {
      V.text('Manilhas', r.x + 12, r.y + 24, 20, DIM, UI, 700, 'left');
      const step = Math.max(V.mf * 1.2, (r.h - 36) / 4);
      names.forEach((n, i) => V.fitText(`${i + 1}  ${n}`, r.x + 14, r.y + 24 + step * (i + 1), r.w - 24, 22, CREAM, UI, 700, 'left'));
    }
    return;
  }
  const suits = ['♣', '♥', '♠', '♦'];
  if (!narrow) {
    const s = Math.min(0.4, (r.h - 16) / CH), cw = CW * s, tx = r.x + 14 + cw + 12, tw = r.x + r.w - 10 - tx;
    drawCard(ctx, H.vira, r.x + 12, r.y + (r.h - CH * s) / 2, s, { big, four });
    V.text('Vira', tx, r.y + r.h * 0.27, 20, DIM, UI, 700, 'left');
    V.fitText(`Manilha: ${RL.RANKS[H.manRank]}`, tx, r.y + r.h * 0.6, tw, 30, GOLD, UI, 800, 'left');
    suits.forEach((su, i) => V.text(su, tx + i * 30 + 6, r.y + r.h * 0.9, 22, i === 1 || i === 3 ? '#ff7a7a' : CREAM, UI, 800, 'center'));
    if (tw >= 230) V.text('best first', tx + 132, r.y + r.h * 0.9, 20, DIM, UI, 600, 'left');
  } else {
    const s = Math.min(0.4, (r.h - 44) / CH), cw = CW * s, tx = r.x + 12 + cw + 10, tw = r.x + r.w - 8 - tx;
    drawCard(ctx, H.vira, r.x + 10, r.y + 8, s, { big, four });
    V.fitText('Vira · Manilha', tx, r.y + 26, tw, 20, DIM, UI, 700, 'left');
    V.fitText(RL.RANKS[H.manRank], tx, r.y + 26 + 12 + Math.max(36, V.mf * 1.7) + 2, tw, 40, GOLD, UI, 800, 'left');
    suits.forEach((su, i) => V.text(su, r.x + r.w * (0.2 + 0.2 * i), r.y + r.h - 12, 22, i === 1 || i === 3 ? '#ff7a7a' : CREAM, UI, 800, 'center'));
  }
}
function tricksPlaque(ctx, V, r, H) {
  plaque(ctx, r, 0.8);
  const narrow = r.w < 260, labelY = narrow ? r.y + r.h * 0.3 : r.y + r.h / 2 + 7;
  V.text('TRICKS', r.x + 16, labelY, 20, DIM, UI, 800, 'left');
  const x0 = narrow ? r.x + 8 : r.x + 112, pitch = (r.x + r.w - 10 - x0) / 3, cy = narrow ? r.y + r.h * 0.68 : r.y + r.h / 2, rad = Math.min(26, pitch / 2 - 3, narrow ? (r.h * 0.5 - 4) : r.h / 2 - 8);
  for (let i = 0; i < 3; i++) {
    const cx = x0 + pitch * (i + 0.5), tr = H.tricks[i];
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU);
    if (tr) {
      ctx.fillStyle = tr.winTeam === 0 ? '#ffd23f' : tr.winTeam === 1 ? '#e8452c' : '#8a9a92'; ctx.fill();
      const lab = tr.winTeam === 0 ? 'US' : tr.winTeam === 1 ? 'THEM' : '=';
      V.fitText(lab, cx, cy + Math.max(V.mf, 14) * 0.35, rad * 2 - 4, 22, '#2a1606', UI, 800);
    } else { ctx.strokeStyle = 'rgba(255,246,221,0.4)'; ctx.lineWidth = 2.5; ctx.stroke(); }
  }
}


// ---- landscape speech bubbles: placed in free table space ------------------------------------------------------------------
// The bubble lands on the free spot (no card stack, trick slot, name tag, hand or HUD plaque underneath) nearest the speaker's tag,
// shrinking its text step by step on short screens; it never leaves the table column. Cached per layout + text + size.
const bubCache = new Map(), bubPlace = new Map();
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
export function bubbleObstacles(L, n) {
  const T = L.t, key = `${L.key}|${n}`, c = bubCache.get(key); if (c) return c;
  const obs = [], sr = [seatRects(T, n, 3, true), seatRects(T, n, 3, false)];
  for (const o of sr) { for (const k of Object.keys(o.stacks)) obs.push(grow(o.stacks[k], 4)); for (const k of Object.keys(o.tags)) obs.push(grow(o.tags[k], 4)); for (const k of Object.keys(o.badges)) obs.push(o.badges[k]); }
  const tw = CW * T.tsc, th = CH * T.tsc;
  for (const q of T.trick) obs.push(grow(R4(q.x - tw / 2, q.y - th / 2, tw, th), 4));
  obs.push(R4(T.hcx - T.handW / 2, T.handY - T.LIFT - 2, T.handW, CH * T.hs + T.LIFT + 2));
  obs.push(R4(T.cx - 130, T.winY - 36, 260, 48), R4(T.cx - 40, T.thinkY - 12, 80, 24));
  obs.push(R4(T.cx - 100, T.auto.pausedY - 30, 200, 40));
  if (T.previewBadge) obs.push(R4(T.previewBadge.x - 150, T.previewBadge.y, 156, 36));
  bubCache.set(key, obs); if (bubCache.size > 60) bubCache.delete(bubCache.keys().next().value);
  return obs;
}
const R4 = (x, y, w, h) => ({ x, y, w, h });
export function placeBubble(L, n, p, fontMins, measure, gesture, others) {
  const T = L.t, SD = T.side, obs = bubbleObstacles(L, n);
  const tag = p === 2 ? T.plateN : p === 3 ? SD.w : p === 1 ? SD.e : null;
  const pref = tag ? { x: tag.x + tag.w / 2, y: tag.y + tag.h / 2 } : { x: T.hcx, y: T.handY - T.LIFT - 30 };
  const zone = T.C ? { x0: T.C.x0 - 14, x1: T.C.x1 + 14, y0: L.U.y0 + 4, y1: T.handY + CH * T.hs - 4 } : { x0: 8, x1: L.w - 8, y0: T.auto.bar.y + T.auto.bar.h + 2, y1: T.panel.y - 2 };
  let best = null;
  for (const fs of fontMins) {
    const w = measure(fs) + 36 * (fs / 26) + (gesture ? 52 * (fs / 26) : 0), h = Math.max(fs * 1.75, Math.min(54, 54 * fs / 26)), mid = { w, h, fs };
    for (let y = zone.y0; y + h <= zone.y1; y += 6) for (let x = zone.x0; x + w <= zone.x1; x += 6) {
      const r = R4(x, y, w, h);
      if (obs.some((o) => hit(r, o)) || others.some((o) => hit(grow(r, 6), o))) continue;
      const d = Math.hypot(x + w / 2 - pref.x, y + h / 2 - pref.y);
      if (!best || d < best.d) best = { ...mid, x, y, d };
    }
    if (best) return best;
  }
  const fs = fontMins[fontMins.length - 1], w = measure(fs) + 36 * (fs / 26) + (gesture ? 52 * (fs / 26) : 0), h = Math.max(fs * 1.75, 30);
  return { w, h, fs, x: Math.min(zone.x1 - w, Math.max(zone.x0, pref.x - w / 2)), y: Math.max(zone.y0, pref.y - h / 2), d: 0 };
}
function table(ctx, state, V, L) {
  const { text, shadowText } = V, H = state.H, t = state.t, ui = state.ui, sc = state.scene, n = H.n, T = L.t;
  const big = state.set.big, four = state.set.four, calm = state.set.calm, isAuto = sc === 'auto', A = isAuto ? state.auto : null;
  const VR = RL.VARIANTS[H.variant];
  drawTable(ctx, t, T.felt);
  globalThis.__previewBadge = T.previewBadge ?? null;
  const names = n === 4 ? NAMES4 : ['You', 'Opponent'];
  const scores = isAuto ? state.autoMatch.scores : state.match.scores;
  const revealPlan = A && A.phase === 'reveal' ? A.plan : null;
  const acting = actorSeat(H);

  // ---- scoreboard and stake
  scorePlate(ctx, V, T.usPlate, n === 4 ? 'US' : 'YOU', scores[0], RL.TARGET, true);
  scorePlate(ctx, V, T.themPlate, 'THEM', scores[1], RL.TARGET, false);
  const S = T.stake; plaque(ctx, S, 0.85);
  const val = RL.value(H), pend = H.pending;
  const label = H.special === 'iron' ? 'IRON HAND' : H.special === 'eleven' ? VR.specialName.toUpperCase() : pend ? RL.shoutName(H, pend.idx).toUpperCase() + '?' : H.stakeIdx > 0 ? RL.shoutName(H, H.stakeIdx).toUpperCase() : 'HAND WORTH';
  V.fitText(label, S.x + S.w / 2, S.y + S.h * 0.3, S.w - 16, 20, pend ? '#ffb08a' : DIM, UI, 800);
  const pulse = state.banner ? 1 + 0.08 * Math.sin(t * 14) : 1;
  ctx.save(); ctx.translate(S.x + S.w / 2, S.y + S.h * 0.76); ctx.scale(pulse, pulse); text(String(pend ? VR.vals[pend.idx] : val), 0, 0, Math.min(52, S.h * 0.56), GOLD, FONT, 800); ctx.restore();
  viraPlaque(ctx, V, T.vira, H, big, four);
  tricksPlaque(ctx, V, T.tricks, H);

  // ---- seats: hands (backs or face-up), name plates, gesture chips
  const faceUpSeat = (s) => isAuto || (n === 4 && s === 2 && (H.consulted[0] || (H.phase === 'special' && H.specialTeam === 0)));
  const ns = T.nsc, SD = T.side;
  const drawFaceHand = (s, x0, y0, dx, dy, sc2) => {
    const rv = revealPlan && revealPlan.kind === 'turn' && revealPlan.seat === s ? revealPlan : null;
    H.hands[s].forEach((c, k) => {
      const chosen = rv && rv.type === 'play' && rv.card === c, dim = rv && rv.type === 'play' && !chosen;
      drawCard(ctx, c, x0 + k * dx, y0 + k * dy, sc2, { four, big, dim, glow: chosen ? '#ffe08a' : null, man: H.pow[c] >= 100, t });
    });
  };
  const nCW = CW * ns, ssc = SD.sCW / CW;
  for (let p = 1; p <= 3; p++) {
    const s = seatAtPos(n, p); if (s < 0) continue;
    const cnt = Math.floor(state.shown[s] + 0.001);
    if (faceUpSeat(s)) {
      if (p === 2) { const m = H.hands[s].length, sp = m > 1 ? Math.min(nCW * 1.12, 260 * (ns / 0.5) / (m - 1)) : 0; drawFaceHand(s, T.cx - (nCW + sp * (m - 1)) / 2, T.nTop, sp, 0, ns); }
      else if (p === 1) drawFaceHand(s, SD.cxE - SD.sCW / 2, SD.yc0 - SD.sCH / 2, 0, SD.step, ssc); else drawFaceHand(s, SD.cxW - SD.sCW / 2, SD.yc0 - SD.sCH / 2, 0, SD.step, ssc);
    } else if (p === 2) { for (let k = 0; k < cnt; k++) drawCard(ctx, -1, T.cx - (nCW + T.nStep * 2) / 2 + k * T.nStep, T.nTop, ns, {}); }
    else if (p === 3) { for (let k = 0; k < cnt; k++) drawCard(ctx, -1, SD.cxW - SD.sCW / 2, SD.yc0 - SD.sCH / 2 + k * SD.step, ssc, { rot: Math.PI / 2 }); }
    else { for (let k = 0; k < cnt; k++) drawCard(ctx, -1, SD.cxE - SD.sCW / 2, SD.yc0 - SD.sCH / 2 + k * SD.step, ssc, { rot: -Math.PI / 2 }); }
  }
  const plate = (s, r) => {
    const turn = acting === s && !state.show && !ui.summary && H.phase !== 'done';
    plaque(ctx, r, turn ? 0.95 : 0.65);
    if (turn) { ctx.save(); ctx.strokeStyle = `rgba(255,224,138,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 14; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.stroke(); ctx.restore(); }
    const sig = state.vis[s] && H.signals[s];
    V.fitText(names[s], r.x + r.w / 2 + (sig ? 12 : 0), r.y + r.h * 0.7, r.w - 24 - (sig ? 24 : 0), 22, turn ? '#ffe08a' : CREAM, UI, 800);
    if (sig) drawGesture(ctx, H.signals[s], r.x + 20, r.y + r.h / 2, Math.min(14, r.h * 0.36));
    if (H.dealer === s) { const b = badgeRect(r); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(b.x + 10, b.y + 10, 10, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a1606'; ctx.lineWidth = 1.5; ctx.stroke(); text('D', b.x + 10, b.y + 14.5, 13, '#2a1606', UI, 800); }
  };
  plate(seatAtPos(n, 2), T.plateN);
  if (n === 4) { plate(3, SD.w); plate(1, SD.e); }
  // speech bubbles and gesture bubbles
  state.bubRects = {};
  const bub = (s, p) => {
    const b = state.says[s]; if (!b) return;
    const a = Math.min(1, b.t * 6) * (b.t > 2.8 ? Math.max(0, 1 - (b.t - 2.8) * 4) : 1); if (a <= 0) return;
    const rise = (1 - Math.min(1, b.t * 5)) * 10;
    ctx.save(); ctx.globalAlpha = a;
    {
      const base = Math.max(26, V.mf), fl = Math.max(V.mf, 16), steps = [base, base * 0.85, base * 0.72, base * 0.6].map((v) => Math.max(fl, v)).filter((v, i, ar) => ar.indexOf(v) === i);
      const ck = `${L.key}|${n}|${p}|${b.text}|${b.gesture ? 1 : 0}|${steps[0]}`;
      let pl = bubPlace.get(ck);
      if (!pl) {
        const others = Object.values(state.bubRects || {});
        pl = placeBubble(L, n, p, steps, (fs) => { ctx.font = `800 ${fs}px ${UI}`; return ctx.measureText(b.text).width; }, !!b.gesture, others);
        bubPlace.set(ck, pl); if (bubPlace.size > 80) bubPlace.delete(bubPlace.keys().next().value);
      }
      const yy = pl.y + rise;
      state.bubRects[s] = { x: pl.x, y: yy, w: pl.w, h: pl.h };
      ctx.fillStyle = '#fff6dd'; rr(ctx, pl.x, yy, pl.w, pl.h, pl.h * 0.44); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
      const k = pl.fs / 26;
      if (b.gesture) drawGesture(ctx, b.gesture, pl.x + 30 * k, yy + pl.h / 2, 20 * k);
      ctx.font = `800 ${pl.fs}px ${UI}`; ctx.fillStyle = '#2a1606'; ctx.textAlign = 'center'; ctx.fillText(b.text, pl.x + pl.w / 2 + (b.gesture ? 22 * k : 0), yy + pl.h / 2 + pl.fs * 0.27);
      ctx.restore(); return;
    }
  };
  for (let s = 0; s < n; s++) bub(s, RL.posOf(n, s));

  // ---- cards: your hand, then the table, then the raised card on top
  const hand = H.hands[0], blind = H.special === 'iron' && !isAuto;
  const drawHandCard = (c, i) => {
    const p = state.pos[c]; if (!p) return; if (p.born && p.born > t) return;
    const hint = ui.hint && ui.hint.kind === 'card' && ui.hint.card === c;
    const cur = ui.kb && ui.cursor === i && H.phase === 'play';
    const rv = revealPlan && revealPlan.kind === 'turn' && revealPlan.seat === 0 ? revealPlan : null;
    const chosen = rv && rv.type === 'play' && rv.card === c, dim = rv && rv.type === 'play' && !chosen;
    if (blind) { drawCard(ctx, -1, p.x, p.y, p.sc, { glow: cur ? '#9fe0ff' : null }); return; }
    drawCard(ctx, c, p.x, p.y - ((hint || chosen) && !calm ? Math.abs(Math.sin(t * 5)) * 10 : 0), p.sc, { big, four, dim, glow: hint || chosen ? '#ffe08a' : cur ? '#9fe0ff' : null, man: H.pow[c] >= 100, t });
  };
  hand.forEach((c, i) => { if (c !== ui.sel && !(ui.drag && ui.drag.card === c && ui.drag.moved)) drawHandCard(c, i); });
  const tt = state.show ? state.show.plays : H.plays;
  for (const pl of tt) {
    const p = state.pos[pl.card]; if (!p) continue;
    const win = state.show && state.show.t > 0.15 && state.show.winner === pl.seat && state.show.t < 1.3;
    drawCard(ctx, pl.card, p.x, p.y, p.sc, { big, four, glow: win ? '#ffe08a' : null, man: H.pow[pl.card] >= 100, t });
  }
  if (ui.sel >= 0 && hand.includes(ui.sel)) drawHandCard(ui.sel, hand.indexOf(ui.sel));
  if (ui.drag && ui.drag.moved && hand.includes(ui.drag.card)) drawHandCard(ui.drag.card, hand.indexOf(ui.drag.card));
  if (state.show && state.show.t > 0.2 && state.show.t < 1.3) {
    const w = state.show.winner;
    shadowText(w < 0 ? 'Tie: empate' : w === 0 ? 'You take it' : w === 2 && n === 4 ? 'Partner takes it' : `${names[w]} takes it`, T.cx, T.winY, 32, state.show.team === 0 ? '#ffe08a' : state.show.team === 1 ? '#ffb0a0' : CREAM, UI, 800);
  }

  // ---- toast, panel, truco button, buttons
  if (ui.msg && !isAuto) toast(ctx, ui.msg, V, T);
  if (isAuto && A) autoBar(ctx, state, V, A, names, T);
  panel(ctx, state, V, L);
  const canTruco = !isAuto && H.phase === 'play' && H.turn === 0 && RL.canRaise(H, 0) && !state.show && ui.delay <= 0 && !ui.summary && !ui.sig;
  if (canTruco) button(ctx, T.truco, `${RL.shoutName(H, H.stakeIdx + 1).toUpperCase()}!`, { primary: true, size: 38, sub: `worth ${VR.vals[H.stakeIdx + 1]}`, glow: ui.hint && ui.hint.kind === 'truco', pulse: t });
  if (revealPlan && revealPlan.kind === 'turn') button(ctx, T.truco, `${RL.shoutName(H, H.stakeIdx + 1).toUpperCase()}!`, { primary: revealPlan.type === 'raise', size: 36, sub: `${names[revealPlan.seat]} could shout`, glow: revealPlan.type === 'raise', pulse: t, dim: revealPlan.type !== 'raise' || !RL.canRaise(H, revealPlan.seat) && revealPlan.type !== 'raise' });
  if (!isAuto && H.phase === 'play' && H.turn === 0 && !state.show && !state.panel.length && ui.delay <= 0 && !ui.summary && !ui.sig) {
    const line = blind ? 'Blind hand: TAP a card twice to play it' : ui.sel >= 0 ? 'TAP the card again to play it, or DRAG it up' : H.plays.length ? 'Your turn: TAP a card' : 'You lead: TAP a card';
    const P = T.prompt;
    if (P.wrap) { const ls = V.lines(line, P.size, P.w, 700), base = P.y - (canTruco ? 0 : 0); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ls.forEach((ln, i) => text(ln, P.x, base - (ls.length - 1 - i) * P.size * 1.25, P.size, '#ffe9b0', UI, 700)); ctx.restore(); }
    else shadowText(line, P.x, canTruco ? P.y : P.yNoTruco, 24, '#ffe9b0', UI, 700);
  }
  if (!isAuto && ui.thinking) { ctx.fillStyle = 'rgba(255,224,138,0.9)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(T.cx - 22 + i * 22, T.thinkY + Math.sin(t * 8 + i) * 4, 5, 0, TAU); ctx.fill(); } }
  const B = T.btn, bs = Math.min(30, B.menu.h * 0.4);
  if (isAuto) {
    button(ctx, B.hint, 'Skip', { size: bs, sub: 'this pause' }); button(ctx, B.sig, A && A.paused ? 'Resume' : 'Pause', { size: bs, primary: A && A.paused }); button(ctx, B.menu, 'Exit', { size: bs });
  } else {
    button(ctx, B.hint, 'Hint', { size: bs, sub: `${ui.hintsLeft} left` });
    button(ctx, B.sig, 'Signal', { size: bs, sub: n === 4 ? (H.signalled[0] ? 'sent' : 'tell partner') : 'needs a partner', dim: n !== 4 || H.signalled[0] || H.special === 'iron' });
    button(ctx, B.menu, 'Menu', { size: bs });
  }
  // particles and the shout banner
  for (const f of state.fx) { ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.5)); ctx.fillStyle = f.col; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.life * 6); ctx.fillRect(-f.size / 2, -f.size / 3, f.size, f.size * 0.66); ctx.restore(); }
  ctx.globalAlpha = 1;
  if (state.banner) banner(ctx, state, V, T);
  if (ui.summary) summary(ctx, state, V, L);
}
function banner(ctx, state, V, T) {
  const b = state.banner, k = (b.t < 0.3 ? back(b.t / 0.3) : 1) * T.banner.s, a = b.t > b.dur - 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(T.banner.x, T.banner.y); ctx.scale(k, k); ctx.rotate(-0.04);
  ctx.fillStyle = 'rgba(2,20,16,0.94)'; rr(ctx, -330, -92, 660, 184, 28); ctx.fill(); ctx.strokeStyle = b.col; ctx.lineWidth = 5; ctx.shadowColor = b.col; ctx.shadowBlur = 22; ctx.stroke(); ctx.shadowBlur = 0;
  let size = 96; ctx.font = `800 ${size}px ${FONT}`; while (size > 30 && ctx.measureText(b.text).width > 600) { size -= 4; ctx.font = `800 ${size}px ${FONT}`; }
  V.text(b.text, 0, 18, size, b.col, FONT, 800);
  if (b.sub) V.text(b.sub, 0, 66, Math.max(26, V.mf / Math.max(0.01, T.banner.s)), CREAM, UI, 700);
  ctx.restore();
}
function toast(ctx, m, V, T) {
  const a = Math.min(1, m.t * 5) * Math.min(1, (m.hold - m.t) * 3 + 0.01), R = T.toast;
  ctx.save(); ctx.globalAlpha = Math.max(0, a); plaque(ctx, R, 0.92);
  let size = 24, ls = V.lines(m.text, size, R.w - 40, 700);
  while (ls.length > 2 && size > V.mf) { size -= 2; ls = V.lines(m.text, size, R.w - 40, 700); }
  const sz = Math.max(size, V.mf), lh = sz * 1.22, y0 = R.y + R.h / 2 - (ls.length - 1) * lh / 2 + sz * 0.35;
  ls.forEach((ln, i) => V.text(ln, R.x + R.w / 2, y0 + i * lh, size, CREAM, UI, 700));
  ctx.restore();
}
function autoBar(ctx, state, V, A, names, T) {
  const H = state.H, B = T.auto.bar; plaque(ctx, B, 0.86);
  const phase = A.phase === 'think' ? 'Thinking...' : A.phase === 'reveal' ? 'About to act' : A.phase === 'summary' ? 'Hand done' : A.phase === 'ended' ? 'Match complete' : 'Playing';
  const seat = A.plan ? A.plan.seat : actorSeat(H);
  const who = seat >= 0 && (A.phase === 'think' || A.phase === 'reveal') ? names[seat] : '';
  const p = A.plan; let what = '';
  if (A.phase === 'reveal' && p) what = p.kind === 'special' ? (p.play ? 'plays the hand' : 'runs') : p.kind === 'answer' ? { accept: 'accepts', fold: 'runs', raise: 'raises' }[p.action] : p.type === 'raise' ? `shouts ${RL.shoutName(H, H.stakeIdx + 1)}` : `plays ${RL.cardName(H, p.card)}`;
  const second = what || (A.phase === 'think' ? 'weighing the options' : '');
  const tl = `Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`;
  if (!T.auto.narrow) {
    V.text(who ? `${who}: ${phase}` : phase, B.x + 16, B.y + B.h * 0.42, 22, '#ffe08a', UI, 800, 'left');
    V.text(second, B.x + 16, B.y + B.h * 0.82, 20, DIM, UI, 600, 'left');
    V.text(tl, T.auto.dec.x - 14, B.y + B.h * 0.42, 20, CREAM, UI, 700, 'right');
  } else {
    V.fitText(who ? `${who}: ${phase}` : phase, B.x + 12, B.y + 26, B.w - 20, 22, '#ffe08a', UI, 800, 'left');
    V.fitText(second, B.x + 12, B.y + 26 + Math.max(26, V.mf * 1.3), B.w - 20, 20, DIM, UI, 600, 'left');
    V.text(tl, B.x + 12, T.auto.dec.y + T.auto.dec.h * 0.72, 20, CREAM, UI, 700, 'left');
  }
  button(ctx, T.auto.dec, '-', { size: 24 }); button(ctx, T.auto.inc, '+', { size: 24 });
  if (A.paused) V.shadowText('PAUSED', T.auto.pausedX, T.auto.pausedY, 22, '#ffd0a8', UI, 800);
}
function panel(ctx, state, V, L) {
  const H = state.H, ui = state.ui, A = state.auto, isAuto = state.scene === 'auto', T = L.t;
  let P = state.panel, texts = state.panelText;
  const rp = isAuto && A && A.phase === 'reveal' ? A.plan : null;
  const VR = RL.VARIANTS[H.variant];
  if (rp && rp.kind !== 'turn') {
    // Auto Play: show the real option buttons of whoever is deciding, exactly like a human would see them
    P = [];
    if (rp.kind === 'special') { P.push({ r: T.act.a, kind: 'special', play: true, label: `Play for ${VR.specialVal}`, primary: true }); P.push({ r: T.act.b, kind: 'special', play: false, label: 'Run' }); texts = [`${VR.specialName}: ${rp.seat === 0 ? 'You decide' : 'the team decides'}`]; }
    else { const Pd = H.pending, up = Pd.idx < 4; P.push({ r: T.ans[0], kind: 'answer', action: 'accept', label: 'Accept', sub: `worth ${VR.vals[Pd.idx]}`, primary: true }); P.push({ r: T.ans[1], kind: 'answer', action: 'fold', label: 'Run', sub: `they score ${VR.vals[Pd.idx - 1]}` }); if (up) P.push({ r: T.ans[2], kind: 'answer', action: 'raise', label: VR.shouts[Pd.idx + 1] + '!', sub: `worth ${VR.vals[Pd.idx + 1]}`, danger: true }); texts = [`${VR.shouts[Pd.idx].toUpperCase()} is called: worth ${VR.vals[Pd.idx]}`]; }
  }
  if (!P.length) return;
  const PR = T.panel;
  ctx.save(); ctx.fillStyle = 'rgba(2,22,18,0.74)'; rr(ctx, PR.x, PR.y, PR.w, PR.h, 26); ctx.fill(); ctx.strokeStyle = 'rgba(255,210,63,0.7)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  const pt = T.panelText;
  texts.flatMap((s) => V.lines(s, pt.size, pt.w, 700)).forEach((ln, i) => V.text(ln, pt.x, pt.y + i * pt.lh, pt.size, CREAM, UI, 700));
  const hint = ui.hint;
  P.forEach((b, i) => {
    const hinted = hint && ((hint.kind === 'answer' && b.kind === 'answer' && b.action === hint.action) || (hint.kind === 'special' && b.kind === 'special' && b.play === hint.play));
    const cur = ui.kb && ui.cursor === i && !isAuto;
    if (b.kind === 'sigclose') { button(ctx, b.r, 'Close', { size: 22 }); return; }
    if (b.kind === 'signal') {
      button(ctx, b.r, '', { glow: cur });
      const ir = Math.min(30, b.r.h * 0.4), lx = b.r.x + ir * 2 + 18, mw = b.r.x + b.r.w - 10 - lx;
      drawGesture(ctx, b.gesture, b.r.x + ir + 12, b.r.y + b.r.h / 2, ir);
      V.fitText(b.label, lx, b.r.y + b.r.h * 0.45, mw, Math.min(28, b.r.h * 0.42), CREAM, UI, 800, 'left'); V.fitText(b.sub, lx, b.r.y + b.r.h * 0.8, mw, 19, DIM, UI, 600, 'left'); return;
    }
    button(ctx, b.r, b.label, { primary: b.primary, danger: b.danger, size: Math.min(b.r.h > 100 ? 32 : 28, b.r.h * 0.4), sub: b.sub, glow: hinted || cur, pulse: state.t, dim: rp && !hinted });
  });
}

function recap(ctx, V, state, F, H, names) {
  const sc = Math.min(0.3, (F.w - 110) / (4 * CW + 3 * 10)), w = CW * sc, h = CH * sc, gap = 10;
  H.tricks.forEach((tr, i) => {
    const m = tr.plays.length, total = m * w + (m - 1) * gap, x0 = Math.max(F.x0 + 86, F.cx - total / 2 + 40), y0 = F.y;
    V.text(`Trick ${i + 1}`, F.x0, y0 + h / 2 + 8, Math.round(22 * (TEXT_SCALES[state.textScaleIdx] ?? 1) * 0.8), CREAM, UI, 800, 'left');
    tr.plays.forEach((p, k) => {
      const x = x0 + k * (w + gap), win = p.seat === tr.winSeat;
      drawCard(ctx, p.card, x, y0, sc, { big: state.set.big, four: state.set.four, glow: win ? '#ffe08a' : null, man: H.pow[p.card] >= 100, t: state.t });
      V.fitText(names[p.seat], x + w / 2, y0 + h + 19, w + gap, 14, win ? '#ffe08a' : DIM, UI, 700);
    });
    F.y += h + 36;
  });
}
function summary(ctx, state, V, L) {
  const S = state.ui.summary, k = TEXT_SCALES[state.textScaleIdx] ?? 1, H = state.H, r = S.result, n = H.n, O = L.ov;
  ctx.fillStyle = 'rgba(2,12,10,0.76)'; ctx.fillRect(0, 0, L.w, L.h);
  const ended = S.auto && S.mw >= 0, bottom = ended ? O.boxBottom2 : O.boxBottom;
  const box = { x: O.box.x, y: O.box.y, w: O.box.w, h: Math.min(bottom - O.box.y, S.h || 760) }; plaque(ctx, box, 0.95);
  const names = n === 4 ? NAMES4 : ['You', 'Opponent'];
  const us = n === 4 ? 'Us' : 'You', them = 'Them';
  const winName = r.winner === 0 ? us : r.winner === 1 ? them : '';
  const tot = flow(ctx, V, state, { x: box.x, y: box.y + 10, w: box.w, h: box.h - 20 }, (F) => {
    const head = r.winner < 0 ? 'Hand tied' : r.winner === 0 ? 'You win the hand' : 'They win the hand';
    F.p(head, Math.round(46 * k), r.winner === 1 ? '#ffb0a0' : CREAM, 800, 'center', 0.4, FONT);
    let why;
    if (r.why === 'run') why = S.ranTeam === 0 ? 'Your side ran.' : `${n === 4 ? 'The other side' : 'Your opponent'} ran.`;
    else if (r.why === 'void') why = 'All three tricks tied. Nobody scores.';
    else why = `Won ${r.tricks.filter((x) => x === r.winner).length} trick${r.tricks.filter((x) => x === r.winner).length === 1 ? '' : 's'}${r.tricks.includes(-1) ? ' (with a tie)' : ''}.`;
    F.p(why, Math.round(26 * k), DIM, 600, 'center', 0.5);
    if (r.winner >= 0) F.p(`${winName} +${r.points}`, Math.round(64 * k), GOLD, 800, 'center', 0.4, FONT);
    const trow = r.tricks.map((x) => (x === 0 ? 'Us' : x === 1 ? 'Them' : 'Tie')).join('  ·  ');
    if (r.tricks.length) F.p(`Tricks: ${trow}`, Math.round(24 * k), CREAM, 600, 'center', 0.5);
    F.line();
    recap(ctx, V, state, F, H, names);
    F.line();
    F.p(`Match score`, Math.round(22 * k), DIM, 700, 'center', 0.2);
    F.p(`Us ${S.before[0]} → ${S.after[0]}      Them ${S.before[1]} → ${S.after[1]}`, Math.round(32 * k), CREAM, 800, 'center', 0.5);
    if (S.bluff) {
      const who = S.bluff.seat >= 0 ? names[S.bluff.seat] : 'They';
      F.p(`It was a bluff! ${who} shouted with a weak hand and you ran. Their cards:`, Math.round(24 * k), '#ffd0a8', 700, 'center', 0.4);
      const cards = []; for (let s = 0; s < n; s++) if (H.teamOf[s] === S.bluff.team) for (const c of S.bluff.hands[s]) cards.push({ c, label: names[s] });
      if (cards.length) { const m = cards.length, gap = 12, sc = Math.min(0.5, (F.w - (m - 1) * gap) / (m * CW)), w = CW * sc, h = CH * sc; let x = F.cx - (m * w + (m - 1) * gap) / 2; const y0 = F.y + 4; cards.forEach((it) => { drawCard(ctx, it.c, x, y0, sc, { big: state.set.big, four: state.set.four, man: H.pow[it.c] >= 100, t: state.t }); V.fitText(it.label, x + w / 2, y0 + h + 20, w + gap, 15, DIM, UI, 700); x += w + gap; }); F.y += h + 40; }
    }
    if (S.mw >= 0) F.p(S.mw === 0 ? 'That wins the match!' : 'That decides the match.', Math.round(30 * k), GOLD, 800, 'center', 0.4);
    if (r.special) F.p(r.special === 'iron' ? 'Mão de Ferro: a blind hand.' : `${RL.VARIANTS[H.variant].specialName}.`, Math.round(22 * k), DIM, 600, 'center', 0.4);
  });
  S.h = Math.max(520, Math.round(tot + 30));
  if (S.auto) { if (!ended) V.text('Auto-continuing to the next hand...', O.btn.x + O.btn.w / 2, L.land ? O.btn.y + 20 : O.btn.y - 18, 22, DIM, UI, 600); if (ended) { button(ctx, O.btn, 'Play again', { primary: true, size: 30 }); button(ctx, O.btn2, 'Exit to menu', { size: 28 }); } }
  else button(ctx, O.btn, S.mw >= 0 ? 'See result' : 'Next hand', { primary: true, size: 32, glow: true, pulse: state.t });
  if (!S.auto) zoomPills(ctx, state, V, L);
}
