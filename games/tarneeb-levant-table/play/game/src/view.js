// Everything that is drawn each frame. Reads `state` (see game.js) and the live layout (layout.js) and changes nothing
// (except S.scrollMax, the reader's scroll limit, which only the renderer can measure).
import { TEXT_SCALES, THINK_STEPS, LIFT, handLayout } from './layout.js';
import { drawTable, drawLanterns, drawCard, suit, star8 } from './art.js';
import { SUIT_NAMES, SEAT_NAMES, legalPlays, teamOf, suitOf, rankOf, RANK_CH } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT } from './about.js';
import { RULES } from './rules-content.js';
import { drawLockupImage, drawMoreLine } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f2d48a';
const ease = (f) => f * f * (3 - 2 * f);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Reader layout cache (wrapped lines + total height); readerStats.layouts counts re-wraps (tests read it).
const readerCache = { list: null, key: '', items: [], endY: 0, total: 0 };
export const readerStats = { layouts: 0 };

export const seatPoint = (Lo, T, p) => (p === 0 ? { x: Lo.hand.cx, y: Lo.handY + Lo.hand.ch / 2 } : T.seat[p]);

export function render(ctx, S, Lo) {
  const tb = S.tb, t = S.t, W = Lo.w, H = Lo.h, ucx = (Lo.U.x0 + Lo.U.x1) / 2, minF = Lo.minFont;
  const scene = S.scene, onTable = scene === 'table' && tb;
  const T = onTable ? Lo.T[tb.mode] : Lo.T.play;
  // ---- background --------------------------------------------------------------------------------------------------
  const isTitle = scene === 'title' || scene === 'demo-limit', TG = Lo.title[S.saved ? 1 : 0];
  const readerLike = scene === 'about' || scene === 'rules' || scene === 'lessons';
  const star = isTitle ? { x: TG.art.cx, y: TG.art.h * 0.45, r: Math.min(250, TG.art.w / 2 - 20, TG.art.h * 0.3) } : readerLike ? { x: ucx, y: H * 0.5, r: Math.min(W, H) * 0.4 } : { x: T.ccx, y: T.ccy, r: 300 * T.k };
  drawTable(ctx, Lo, star, !Lo.wide && !isTitle && scene !== 'lessons' ? Lo.barY - 16 : 0);
  drawLanterns(ctx, t, S.calm, W);

  const fontOf = (size, font, weight) => `${weight} ${Math.max(size, font === FONT ? 14 : minF)}px ${font}`;
  const text = (str, x, y, size, color = GOLD, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.font = fontOf(size, font, weight); ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center', font = UI, weight = 600) => {
    ctx.font = fontOf(size, font, weight); const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align)); return lines.length;
  };
  const countLines = (str, size, maxW, font = UI, weight = 600) => {
    ctx.font = fontOf(size, font, weight); const words = str.split(' '); let cur = '', n = 0;
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { n++; cur = w; } else cur = t2; }
    return n + 1;
  };
  const wrapLinesOf = (str, size, maxW, font = UI, weight = 600) => {
    ctx.font = fontOf(size, font, weight); const out = []; let cur = '';
    for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const panel = (r, alpha = 0.82) => {
    const rad = Math.min(22, r.h / 4, r.w / 4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 7, r.w, r.h, rad); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, `rgba(58,36,18,${alpha})`); g.addColorStop(1, `rgba(28,16,8,${alpha})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.strokeStyle = 'rgba(232,195,119,0.75)'; ctx.lineWidth = 2.5; ctx.stroke();
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    const rad = Math.min(18, r.h / 3.2);
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#f6d888' : o.on ? '#2e7a5c' : '#7a4a24'); gr.addColorStop(1, o.primary ? '#c8922e' : o.on ? '#185038' : '#45260f');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.ring || 'rgba(255,230,170,0.55)'; ctx.lineWidth = o.ring ? 4 : 2; ctx.stroke();
    let sz = Math.min(o.size ?? 30, r.h * (o.sub ? 0.42 : 0.5)); const col = o.primary ? '#2a1606' : '#f6dfae';
    ctx.font = fontOf(sz, UI, 700); while (sz > minF && ctx.measureText(label).width > r.w - (o.margin ?? 16)) { sz -= 1; ctx.font = fontOf(sz, UI, 700); }
    if (o.sub) {
      text(label, r.x + r.w / 2, r.y + r.h / 2 - 2, sz, col, UI, 700);
      let ss = Math.max(minF, Math.round(sz * 0.62)); ctx.font = fontOf(ss, UI, 500); let sub = o.sub;
      while (ss > minF && ctx.measureText(sub).width > r.w - 14) { ss -= 1; ctx.font = fontOf(ss, UI, 500); }
      while (sub.length > 4 && ctx.measureText(sub).width > r.w - 14) sub = sub.slice(0, -2);
      text(sub, r.x + r.w / 2, r.y + r.h / 2 - 2 + Math.max(sz * 0.72, ss + 2), ss, o.primary ? '#5a3a10' : 'rgba(246,223,174,0.75)', UI, 500);
    } else text(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.35, sz, col, UI, 700);
    ctx.restore();
  };
  const pill = (x, y, w, h, fill, stroke) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } };
  const suitText = (s, x, y, r) => suit(ctx, s, x, y, r, s === 1 || s === 2 ? '#ff8a80' : '#f6efe0');
  const clipTo = (r, fn) => { ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.clip(); fn(); ctx.restore(); };
  // a modal card drawn in its own design box (see layout.js Lo.ov), scaled to fit the screen
  const modal = (o, alpha, fn) => { panel(o.panel, alpha); ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.f, o.f); fn(o.dw / 2); ctx.restore(); };

  // ------------------------------------------------------------------------------------------------ title
  if (isTitle) {
    const A = TG.art, wideT = Lo.wide;
    const sa = clamp(A.h / 700, 0.5, 1.05), cx = A.cx;
    const tagSz = Math.min(27 * sa + 2, (A.w - 24) / 20), tagY = wideT ? A.h - 96 * sa - 8 : A.h - 24 * sa, tsz = Math.min(132 * sa, (A.w - 40) / 4.1), titleY = tagY - Math.max(tagSz, minF) * 0.9 - tsz * 0.2 - 4;
    const lockY = Math.max(Lo.ins.t + 6, Lo.frameB + 8);
    const top = wideT ? Math.max(Lo.top0, 24) : lockY + 12, availH = titleY - tsz * 0.8 - top;
    const r = clamp(availH / 2, 60, Math.min(250 * sa, A.w / 2 - 10)), fs = r / 250, cy = top + availH / 2 + 6;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(S.calm ? 0 : t * 0.05); ctx.lineWidth = 2; ctx.globalAlpha = 0.6; star8(ctx, 0, 0, r, 'rgba(240,205,130,0.6)'); star8(ctx, 0, 0, r * 0.72, 'rgba(240,205,130,0.45)'); ctx.restore();
    const cards = [12, 24, 26 + 12, 39 + 11, 13 + 12];
    cards.forEach((c, i) => {
      const a = (i - 2) * 0.24 + (S.calm ? 0 : Math.sin(t * 0.9 + i) * 0.02), bob = S.calm ? 0 : Math.sin(t * 1.3 + i * 1.1) * 6 * fs;
      ctx.save(); ctx.translate(cx, cy + 210 * fs); ctx.rotate(a); drawCard(ctx, c, -84 * fs, (-330) * fs + bob, 168 * fs, 246 * fs); ctx.restore();
    });
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; text('Tarneeb', cx, titleY, tsz, '#f6dca0'); ctx.restore();
    text('The partnership card game of the Levant', cx, tagY, tagSz, 'rgba(246,223,174,0.9)', UI, 600);
    // discreet Arcforge credit: the themed lockup, small and quiet
    { const q = TG.lock, dn = S.lkDown;      // bottom centre, under the last menu row; a tap opens the Arcforge home
      ctx.save(); ctx.fillStyle = 'rgba(8,30,20,0.62)'; ctx.beginPath(); ctx.roundRect(q.x - 10, q.y - 5, q.w + 20, q.h + 10, (q.h + 10) / 2); ctx.fill(); ctx.restore();
      drawLockupImage(ctx, q.x + q.w / 2, q.y + (dn ? 1 : 0), q.h * (dn ? 0.96 : 1), dn ? 0.7 : 1); }
    if (scene === 'demo-limit') {
      const d = TG.demo; panel(d);
      wrap('You have played the two free matches of the web demo. Get Tarneeb for iPhone and Android for unlimited matches, all four levels, every lesson and a new Daily Deal.', d.x + d.w / 2, d.y + 64, 26, d.w - 50, '#f6dfae', 36);
      return;
    }
    const R = TG.rows, m = Math.max(TG.m, 0.8);
    if (R.resume) button(R.resume, 'Continue your match', { primary: true, sub: `Hand ${S.saved.handNo}: ${S.saved.scores[0]} to ${S.saved.scores[1]}`, size: 30 * m });
    button(R.learn, 'Learn to play', { primary: !R.resume && !S.learnedAll, sub: `${S.learned.filter(Boolean).length} of ${LESSONS.length} lessons done`, size: 30 * m });
    button(R.play, 'New match', { primary: !R.resume && S.learnedAll, sub: 'You and your partner against two computers', size: 30 * m });
    button(R.daily, 'Daily Deal', { sub: S.daily.solvedDay === S.daily.day ? `Solved today. Streak ${S.daily.streak}` : `Open-hand puzzle. Streak ${S.daily.streak}`, size: 30 * m });
    button(R.about, 'About', { size: 28 * m });
    button(R.rules, 'Rules', { size: 28 * m });
    button(R.level, `Computer: ${LEVELS[S.level].name}`, { size: 28 * m, sub: LEVELS[S.level].blurb });
    button(R.sound, S.sound ? 'Sound on' : 'Sound off', { size: 24 * m, on: S.sound });
    button(R.calm, S.calm ? 'Calm motion' : 'Full motion', { size: 24 * m, on: S.calm });
    button(R.big, S.big ? 'Large print' : 'Standard cards', { size: 24 * m, on: S.big });
    button(R.target, `Game to ${S.target}`, { size: 24 * m });
    button(R.auto, 'Auto Play', { size: 30 * m, sub: 'Watch & Learn - every seat computer-played, hands open' });
    return;
  }

  // ------------------------------------------------------------------------------------------------ about / rules (scrolling reader)
  if (scene === 'about' || scene === 'rules') {
    const isAbout = scene === 'about', list = isAbout ? ABOUT : RULES, Rd = Lo.reader;
    const scale = TEXT_SCALES[S.textScaleIdx] ?? 1, titleScale = Math.min(scale, 2);
    text(isAbout ? 'About Tarneeb' : 'Rules', ucx, Rd.titleY, Rd.titleSize * Math.min(scale, 1.12));
    const P = Rd.panel; panel(P);
    const titleSize = Math.round(30 * titleScale), bodySize = Math.round(28 * scale), lh = Math.round(bodySize * 1.4), paraGap = Math.round(11 * scale), titleLH = Math.round(titleSize * 1.15);
    const bodyW = Math.min(P.w - 60, 760), x0 = P.x + (P.w - bodyW) / 2;
    const sepH = Math.round(26 * scale);   // the thin rule between two sections
    const cardsHOf = (page) => (page.cards ? 134 + (page.cards.some((c) => c.label) ? 26 : 0) + Math.round(24 * scale) : 0);
    // One continuous reader: every section in order, so the total height is the sum of all sections.
    // The wrapped document is laid out once per (scene, text size, width, font) and reused; a frame only draws the visible slice.
    ctx.font = fontOf(40, FONT, 700); const probe = ctx.measureText('Hamburgefonstiv').width;   // changes when the web font finishes loading
    const key = [scene, titleSize, bodySize, bodyW, scale, minF, probe].join('|');
    if (readerCache.list !== list || readerCache.key !== key) {
      readerStats.layouts++;
      const items = []; let total = 24, yy = 0;   // yy: baseline offset from the panel's first title baseline
      list.forEach((page, k) => {
        if (k > 0) { items.push({ t: 'sep', y: yy - titleSize + sepH / 2 - 6 }); yy += sepH; total += sepH; }
        const tl = wrapLinesOf(page.title, titleSize, bodyW, FONT, 700);
        tl.forEach((ln, i) => items.push({ t: 'title', str: ln, y: yy + i * titleLH }));
        const adv = tl.length * titleLH + Math.round(14 * scale);
        yy += adv; total += adv + cardsHOf(page);
        if (page.cards) { items.push({ t: 'cards', page, y: yy }); yy += cardsHOf(page); }
        for (const l of page.lines) { const ll = wrapLinesOf(l, bodySize, bodyW, UI, 600); ll.forEach((ln, i) => items.push({ t: 'line', str: ln, y: yy + i * lh })); yy += ll.length * lh + paraGap; total += ll.length * lh + paraGap; }
      });
      total += 20;
      readerCache.list = list; readerCache.key = key; readerCache.items = items; readerCache.endY = yy; readerCache.total = total;
    }
    const total = readerCache.total;
    S.scrollMax = Math.max(0, total - P.h); S.scroll = clamp(S.scroll || 0, 0, S.scrollMax);
    clipTo(P, () => {
      const base = P.y + 24 + titleSize - S.scroll, vTop = P.y - 60, vBot = P.y + P.h + 60;
      for (const it of readerCache.items) {
        const y = base + it.y;
        if (y < vTop - 200 || y > vBot + 200) continue;
        if (it.t === 'sep') { ctx.save(); ctx.strokeStyle = 'rgba(246,223,174,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(P.x + 24, y); ctx.lineTo(P.x + P.w - 24, y); ctx.stroke(); ctx.restore(); }
        else if (it.t === 'title') text(it.str, x0, y, titleSize, GOLD, FONT, 700, 'left');
        else if (it.t === 'line') text(it.str, x0, y, bodySize, '#f0e2c4', UI, 600, 'left');
        else {
          const page = it.page, cw = 92, ch = 134, gap = 22, cn = page.cards.length, totalW = cn * cw + (cn - 1) * gap, cx0 = P.x + P.w / 2 - totalW / 2;
          page.cards.forEach((cd, i) => drawCard(ctx, cd.c, cx0 + i * (cw + gap), y, cw, ch));
          if (page.cards.some((c) => c.label)) page.cards.forEach((cd, i) => { if (cd.label) text(cd.label, cx0 + i * (cw + gap) + cw / 2, y + ch + 22, 16, 'rgba(246,223,174,0.75)', UI, 600); });
        }
      }
      const y = base + readerCache.endY, remaining = P.y + P.h - y;
      if (remaining > 200 && S.scrollMax === 0) {
        const cy = y + remaining / 2, gapX = 84, sx0 = ucx - gapX * 1.5;
        ctx.save(); ctx.globalAlpha = 0.3; [0, 1, 2, 3].forEach((s, i) => suit(ctx, s, sx0 + i * gapX, cy, 32, s === 1 || s === 2 ? '#ff8a80' : '#f6efe0')); ctx.restore();
      }
    });
    if (S.scrollMax > 0) { // a quiet scroll thumb on the panel's right edge
      const th = Math.max(40, P.h * P.h / (P.h + S.scrollMax)), ty = P.y + 8 + (P.h - 16 - th) * (S.scroll / S.scrollMax);
      ctx.fillStyle = 'rgba(246,223,174,0.45)'; ctx.beginPath(); ctx.roundRect(P.x + P.w - 12, ty, 6, th, 3); ctx.fill();
    }
    if (S.scrollMax > 0) text('drag to scroll', Rd.counter.x, Rd.counter.y, 20, 'rgba(246,223,174,0.65)', UI, 600);
    button(Rd.back, 'Back', { size: 28 }); button(Rd.next, 'Done', { primary: true, size: 28 });
    button(Rd.dec, 'A−', { size: 30, dim: S.textScaleIdx === 0 }); button(Rd.inc, 'A+', { size: 30, dim: S.textScaleIdx === TEXT_SCALES.length - 1 });
    return;
  }
  // ------------------------------------------------------------------------------------------------ lesson list
  if (scene === 'lessons') {
    const G = Lo.lessons;
    text('Learn to play', ucx, G.titleY, Lo.wide ? 56 : 68);
    text('Eight short lessons. You make every move yourself.', ucx, G.subY, 24, 'rgba(246,223,174,0.85)', UI, 600);
    G.rows.forEach((r, i) => {
      button(r, `${i + 1}. ${LESSONS[i].title}`, { size: 26, on: S.learned[i], margin: S.learned[i] ? 80 : 16 });
      if (S.learned[i]) text('✓', r.x + 24, r.y + r.h / 2 + 8, 24, '#bff0d2', UI, 700);
    });
    button(G.back, 'Back', { primary: true });
    return;
  }

  // ------------------------------------------------------------------------------------------------ the table
  if (!tb) return;
  const Hh = tb.H, open = tb.mode === 'puzzle' || tb.mode === 'auto', big = S.big, wide = Lo.wide;
  const dealing = tb.deal, dealSeq = dealing ? dealCounts(tb) : null;
  const hintC = tb.hint && tb.hint.c !== undefined ? tb.hint.c : -1;
  const kk = T.kk, BIDm = Lo.BIDs[tb.mode];
  const showTrump = tb.mode === 'play' ? Hh.phase !== 'bid' && Hh.trump >= 0 : tb.mode === 'puzzle' ? true : Hh.trump >= 0;
  const trumpLbl = tb.mode === 'puzzle' ? `Need ${S.puzTarget}` : Hh.trump >= 0 ? `Bid ${Hh.contract} · ${SEAT_NAMES[Hh.declarer] === 'You' ? 'you' : SEAT_NAMES[Hh.declarer].toLowerCase()}` : '';
  // one pill "Trump ♠  Bid 8 · west" where it fits; two stacked rows in a narrow side card
  const trumpLine = (cx, cy, wCh, sz) => {
    ctx.font = fontOf(sz, UI, 600); const w1 = ctx.measureText('Trump').width, w2 = ctx.measureText(trumpLbl).width, tot = w1 + 46 + w2;
    if (tot + 24 <= wCh) {
      pill(cx, cy, wCh, 40, 'rgba(0,0,0,0.42)', 'rgba(232,195,119,0.6)'); const x0 = cx - tot / 2;
      text('Trump', x0, cy + 8, sz, '#f6dfae', UI, 600, 'left'); suitText(Hh.trump, x0 + w1 + 24, cy, 12); text(trumpLbl, x0 + w1 + 46, cy + 8, sz, '#f6dfae', UI, 600, 'left'); return 40;
    }
    pill(cx, cy, Math.min(wCh, w1 + 56), 40, 'rgba(0,0,0,0.42)', 'rgba(232,195,119,0.6)'); text('Trump', cx - 18, cy + 8, sz, '#f6dfae', UI, 600); suitText(Hh.trump, cx + w1 / 2 + 6, cy, 12);
    text(trumpLbl, cx, cy + 40, sz, '#f6dfae', UI, 600); return 70;
  };

  // ---- header / info ------------------------------------------------------------------------------------------------------
  const lessonMsg = tb.mode === 'lesson' ? (tb.lessonMsg || LESSONS[S.lesson.i].text) : '';
  if (!wide) {
    const y0 = Lo.top0, hx0 = Lo.hx0, hx1 = Lo.hx1, rowW = hx1 - hx0;
    if (tb.mode === 'play') {
      const hh = Lo.hdr.play, pw = Math.min(210, (rowW - 150) / 2), sc = hh / 84;
      panel({ x: hx0, y: y0, w: pw, h: hh }, 0.7); panel({ x: hx1 - pw, y: y0, w: pw, h: hh }, 0.7);
      text('US', hx0 + pw / 2, y0 + 32 * sc, 22, '#9fe0b8', UI, 700); text(String(tb.scores[0]), hx0 + pw / 2, y0 + 72 * sc, 42 * sc, '#fff2cf');
      text('THEM', hx1 - pw / 2, y0 + 32 * sc, 22, '#f0a595', UI, 700); text(String(tb.scores[1]), hx1 - pw / 2, y0 + 72 * sc, 42 * sc, '#fff2cf');
      text(`First to ${tb.target}`, (hx0 + hx1) / 2, y0 + hh - 14, 22, 'rgba(246,223,174,0.8)', UI, 600);
    } else {
      const px = Lo.panelX, pr = { x: px, y: y0, w: W - 24 - px, h: Lo.hdr[tb.mode] }, cx = pr.x + pr.w / 2, tight = Lo.mode === 'compact';
      if (tb.mode === 'lesson') {
        const lines = countLines(lessonMsg, 20, pr.w - 36);
        pr.h = Math.min(pr.h, 62 + lines * 26 + 8); panel(pr, 0.86);
        text(`Lesson ${S.lesson.i + 1} of ${LESSONS.length}: ${LESSONS[S.lesson.i].title}`, cx, y0 + 36, tight ? 30 : 34);
        wrap(lessonMsg, cx, y0 + 68, 20, pr.w - 36, '#f6e8c8', 26);
      } else if (tb.mode === 'puzzle') {
        panel(pr, 0.86); text('Daily Deal', cx, y0 + 38, tight ? 32 : 36);
        wrap(S.puzText, cx, y0 + 72, 20, pr.w - 36, '#f6e8c8', 26);
      } else {
        panel(pr, 0.86); text('Auto Play', cx, y0 + 38, tight ? 32 : 36);
        text(`Watch & Learn  ·  think time ${THINK_STEPS[S.autoThinkIdx]}s${tb.paused ? '  ·  PAUSED' : ''}`, cx, y0 + (tight ? 68 : 74), 22, 'rgba(246,223,174,0.92)', UI, 600);
        text(`Us ${tb.scores[0]}   Them ${tb.scores[1]}   ·   First to ${tb.target}`, cx, y0 + (tight ? 98 : 108), 20, 'rgba(246,223,174,0.8)', UI, 600);
      }
    }
    if (showTrump) { const y = T.infoY + 26; trumpLine(W / 2, y, 330, 20); text(`Tricks   Us ${Hh.tricks[0]}   Them ${Hh.tricks[1]}`, W / 2, y + 46, 20, 'rgba(246,223,174,0.85)', UI, 600); }
  } else {
    const LP = Lo.LP; panel(LP, 0.8);
    clipTo(LP, () => {
      const cx = LP.x + LP.w / 2, iw = LP.w - 24; let y = LP.y + 12;
      if (tb.mode === 'play' || tb.mode === 'auto') {
        const bw = (iw - 10) / 2, bh = 74;
        if (tb.mode === 'auto') { text('Auto Play', cx, y + 28, 30); y += 40; }
        panel({ x: LP.x + 12, y, w: bw, h: bh }, 0.7); panel({ x: LP.x + 22 + bw, y, w: bw, h: bh }, 0.7);
        text('US', LP.x + 12 + bw / 2, y + 26, 20, '#9fe0b8', UI, 700); text(String(tb.scores[0]), LP.x + 12 + bw / 2, y + 64, 38, '#fff2cf');
        text('THEM', LP.x + 22 + bw * 1.5, y + 26, 20, '#f0a595', UI, 700); text(String(tb.scores[1]), LP.x + 22 + bw * 1.5, y + 64, 38, '#fff2cf');
        y += bh + 24; text(`First to ${tb.target}`, cx, y, 20, 'rgba(246,223,174,0.8)', UI, 600); y += 14;
        if (tb.mode === 'auto') { y += 20; y += wrap(`Watch & Learn. Think time ${THINK_STEPS[S.autoThinkIdx]}s${tb.paused ? ' (paused)' : ''}`, cx, y, 20, iw, 'rgba(246,223,174,0.92)', 26) * 26; y -= 6; }
      } else if (tb.mode === 'lesson') {
        text(`Lesson ${S.lesson.i + 1} of ${LESSONS.length}`, cx, y + 26, 26); y += 38;
        y += wrap(LESSONS[S.lesson.i].title, cx, y + 8, 22, iw, GOLD, 27, 'center', FONT, 700) * 27 + 6;
        let fz = 20; while (fz > 16 && countLines(lessonMsg, fz, iw) * (fz + 6) > LP.y + LP.h - y - 130) fz -= 2;
        y += wrap(lessonMsg, cx, y + 14, fz, iw, '#f6e8c8', fz + 6) * (fz + 6) + 14;
      } else {
        text('Daily Deal', cx, y + 30, 32); y += 44;
        let fz = 20; while (fz > 16 && countLines(S.puzText, fz, iw) * (fz + 6) > LP.y + LP.h - y - 100) fz -= 2;
        y += wrap(S.puzText, cx, y + 14, fz, iw, '#f6e8c8', fz + 6) * (fz + 6) + 12;
      }
      if (showTrump) { y += 22; y += trumpLine(cx, y, iw, 20) + 6; wrap(`Tricks: Us ${Hh.tricks[0]}, Them ${Hh.tricks[1]}`, cx, y, 20, iw, 'rgba(246,223,174,0.85)', 25); }
    });
    panel(Lo.RP, 0.8);   // right card: the buttons (below) and the running message
  }

  // ---- seats: name plates and the other three hands --------------------------------------------------------------------------------
  const flying = (c) => tb.flights.find((f) => f.c === c);
  for (let p = 1; p < 4; p++) {
    const n = Hh.hands[p].length, sh = dealing ? dealSeq[p] : n, pl = T.plate[p], seatXY = T.seat[p];
    const active = !Hh.winnerShown && ((Hh.phase === 'bid' && Hh.bid.turn === p) || (Hh.phase === 'play' && Hh.turn === p && !tb.collect) || (Hh.phase === 'trump' && Hh.declarer === p));
    const colH = T.colBot - T.colTop;
    if (open) {
      const cards = Hh.hands[p];
      const revealing = tb.mode === 'auto' && tb.autoPhase === 'reveal' && Hh.phase === 'play' && Hh.turn === p, legalHere = revealing ? legalPlays(Hh, p) : null;
      const optsFor = (c) => { const isChosen = revealing && c === hintC, isLegal = !legalHere || legalHere.includes(c); return { isChosen, big, dim: legalHere && !isLegal, glow: isChosen ? '#ffe28a' : (legalHere && isLegal && Hh.trick.length ? 'rgba(255,240,170,0.55)' : undefined) }; };
      if (p === 2) {
        const w = T.open.w, h = T.open.h, step = Math.min(74 * T.k, (T.nRow.w - w) / Math.max(1, cards.length - 1)), tot = step * (cards.length - 1) + w;
        cards.forEach((c, i) => { const o = optsFor(c); drawCard(ctx, c, T.nRow.cx - tot / 2 + i * step, T.nRow.y - h / 2 - (o.isChosen ? 10 : 0), w, h, o); });
      } else {
        // the side hands, face up, as a stack of index chips (rank + suit) so all thirteen stay readable in a short column
        const cw = Math.max(62, 66 * Math.max(T.k, 0.85)), chH = 30, step = cards.length > 1 ? Math.min(34, (colH - chH) / (cards.length - 1)) : 0, y0 = (T.colTop + T.colBot) / 2 - (step * (cards.length - 1) + chH) / 2;
        cards.forEach((c, i) => { const o = optsFor(c); chip(ctx, c, T.colX[p] - cw / 2 + (o.isChosen ? (p === 1 ? -10 : 10) : 0), y0 + i * step, cw, i === cards.length - 1 ? chH : step + 8, chH, o, text); });
      }
    } else {
      const bw = T.back.w, bh = T.back.h;
      for (let i = 0; i < sh; i++) {
        const off = (i - (sh - 1) / 2) * (sh > 8 ? 22 : 30) * T.k;
        if (p === 2) drawCard(ctx, -1, seatXY.x + off - bw / 2, seatXY.y - bh / 2, bw, bh, { back: S.back });
        else drawCard(ctx, -1, seatXY.x - bw / 2, seatXY.y + off - bh / 2, bw, bh, { back: S.back, rot: p === 1 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
    const status = Hh.phase === 'bid' ? (Hh.bid.log[p] === null ? '' : Hh.bid.log[p] === 0 ? 'Pass' : `Bid ${Hh.bid.log[p]}`) : (Hh.dealer === p ? 'Dealer' : '');
    const pw = T.plateW, ph = (status ? 64 : 44) * kk;
    if (active) { ctx.save(); ctx.shadowColor = '#ffd87a'; ctx.shadowBlur = 18 + (S.calm ? 0 : Math.sin(t * 6) * 5); }
    pill(pl.x, pl.y, pw, ph, active ? 'rgba(90,56,20,0.95)' : 'rgba(0,0,0,0.5)', active ? '#ffd87a' : 'rgba(232,195,119,0.5)');
    if (active) ctx.restore();
    text(SEAT_NAMES[p], pl.x, pl.y + (status ? -4 : 8) * kk, 24 * kk, teamOf(p) === 0 ? '#a8ecc4' : '#f6dfae', UI, 700);
    if (status) text(status, pl.x, pl.y + 20 * kk, 19 * kk, status === 'Pass' ? 'rgba(246,223,174,0.7)' : '#fff2cf', UI, 600);
  }

  // ---- trick area (cards on the table) -------------------------------------------------------------------------------------------
  const drawSlot = (p, c, alpha = 1, k = 1, dx = 0, dy = 0) => {
    const s = T.slot[p], w = T.trick.w * k, h = T.trick.h * k;
    ctx.save(); ctx.globalAlpha = alpha; drawCard(ctx, c, s.x - w / 2 + dx, s.y - h / 2 + dy, w, h, { rot: (((c * 7) % 9) - 4) * 0.013, big }); ctx.restore();
  };
  if (tb.collect) {
    const col = tb.collect, sw = clamp01((col.t - 0.7) / 0.4), to = seatPoint(Lo, T, col.winner);
    if (col.t > 0.15) { const wp = T.slot[col.winner], rw = T.trick.w * 1.12, rh = T.trick.h * 1.1; ctx.save(); ctx.strokeStyle = `rgba(255,216,122,${0.85 * (1 - sw)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(wp.x - rw / 2, wp.y - rh / 2, rw, rh, 12); ctx.stroke(); ctx.restore(); }
    for (const cd of col.cards) {
      if (flying(cd.c)) continue;
      const s = T.slot[cd.p], e = ease(sw);
      drawSlot(cd.p, cd.c, 1 - sw * 0.9, 1 - e * 0.45, (to.x - s.x) * e, (to.y - s.y) * e);
    }
  } else for (const cd of Hh.trick) if (!flying(cd.c)) drawSlot(cd.p, cd.c);

  // ---- bidding panel / trump picker ---------------------------------------------------------------------------------------------------
  const humanBid = Hh.phase === 'bid' && Hh.bid.turn === 0 && !tb.blocked && !tb.auto;
  const humanTrump = Hh.phase === 'trump' && Hh.declarer === 0 && !tb.blocked && !tb.auto;
  const showBidPicker = humanBid || (tb.auto && Hh.phase === 'bid' && !tb.blocked);
  const showTrumpPicker = humanTrump || (tb.auto && Hh.phase === 'trump' && !tb.blocked);
  const bp = BIDm.panel;
  if (!dealing && Hh.phase === 'bid') {
    panel(bp, 0.88);
    const b = Hh.bid, names = [1, 2, 3, 0].map((p) => `${SEAT_NAMES[p]} ${b.log[p] === null ? '·' : b.log[p] === 0 ? 'Pass' : b.log[p]}`).join('  ');
    const autoReveal = tb.auto && tb.autoPhase === 'reveal';
    const head = humanBid ? (b.high ? `Your bid (higher than ${b.high}), or pass` : 'Your bid: how many tricks will your side take?') : autoReveal ? 'This is the bid - compare it with your own guess.' : `${SEAT_NAMES[b.turn] === 'You' ? 'You are' : SEAT_NAMES[b.turn] + ' is'} thinking…`;
    wrap(head, bp.x + bp.w / 2, bp.y + 30, 20, bp.w - 28, '#f6dfae', 25, 'center', UI, 700);
    if (showBidPicker) {
      BIDm.nums.forEach((r) => button(r, String(r.n), { size: 32, dim: r.n <= b.high, ring: tb.hint && tb.hint.n === r.n ? '#ffe28a' : undefined, primary: tb.hint && tb.hint.n === r.n }));
      button(BIDm.pass, 'Pass', { size: 28, ring: tb.hint && tb.hint.n === 0 ? '#ffe28a' : undefined });
      text(names, bp.x + bp.w / 2, bp.y + bp.h - 10, 18, 'rgba(246,223,174,0.75)', UI, 500);
    } else wrap(names, bp.x + bp.w / 2, bp.y + 110, 22, bp.w - 28, 'rgba(246,223,174,0.9)', 28, 'center', UI, 600);
  }
  if (!dealing && showTrumpPicker) {
    const tp = { x: bp.x, y: bp.y, w: bp.w, h: 200 }; panel(tp, 0.9);
    wrap(humanTrump ? `You won the bid with ${Hh.contract}. Name trump:` : `${SEAT_NAMES[Hh.declarer]} won the bid with ${Hh.contract} and names trump:`, bp.x + bp.w / 2, bp.y + 30, 21, bp.w - 28, '#f6dfae', 25, 'center', UI, 700);
    BIDm.suits.forEach((r) => {
      button(r, '', { primary: tb.hint && tb.hint.s === r.s, ring: tb.hint && tb.hint.s === r.s ? '#ffe28a' : undefined });
      suit(ctx, r.s, r.x + r.w / 2, r.y + 44, Math.min(34, r.w * 0.3), r.s === 1 || r.s === 2 ? '#ff8a80' : '#f6efe0');
      text(SUIT_NAMES[r.s], r.x + r.w / 2, r.y + 100, Math.min(22, r.w * 0.2), '#f6dfae', UI, 700);
    });
  }
  if (!dealing && Hh.phase === 'trump' && !showTrumpPicker) {
    const pw = Math.min(bp.w + 20, W - 24); pill(T.ccx, T.ccy, pw, 56, 'rgba(0,0,0,0.5)', 'rgba(232,195,119,0.6)');
    wrap(`${SEAT_NAMES[Hh.declarer]} won the bid with ${Hh.contract} and names trump…`, T.ccx, T.ccy - 2, 20, pw - 24, '#f6dfae', 22, 'center', UI, 600);
  }
  if (tb.mode === 'auto' && tb.paused) { pill(T.ccx, T.ccy, 190, 52, 'rgba(0,0,0,0.6)', 'rgba(232,195,119,0.8)'); text('Paused', T.ccx, T.ccy + 9, 28, '#fff2cf', UI, 700); }

  // ---- message banner ------------------------------------------------------------------------------------------------------------------
  if (tb.msg && !(Hh.phase === 'bid' && !dealing) && !(Hh.phase === 'trump' && showTrumpPicker)) {
    const a = clamp01(Math.min(tb.msg.t / 0.15, (tb.msg.hold - tb.msg.t) / 0.5));
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a;
      if (wide) {
        const RP = Lo.RP, y0 = Lo.rpBottom + 6, iw = RP.w - 28; ctx.save(); ctx.beginPath(); ctx.rect(RP.x, RP.y, RP.w, RP.h); ctx.clip();
        wrap(tb.msg.text, RP.x + RP.w / 2, y0 + 24, 20, iw, '#fff2cf', 25); ctx.restore();
      } else {
        const bn = Lo.mode === 'tall' ? Lo.banner : { ...Lo.banner, y: T.infoY }, lines = countLines(tb.msg.text, 22, bn.w - 50), bh = Math.min(bn.h, 26 + lines * 27), by = Lo.mode === 'tall' ? bn.y + bn.h - bh : bn.y;
        panel({ x: bn.x, y: by, w: bn.w, h: bh }, 0.92);
        wrap(tb.msg.text, bn.x + bn.w / 2, by + 24 + (bh - 26 - lines * 27) / 2 + 10, 22, bn.w - 50, '#fff2cf', 27);
      }
      ctx.restore();
    }
  }

  // ---- your hand ---------------------------------------------------------------------------------------------------------------------------
  const hand = Hh.hands[0], shown = dealing ? dealSeq[0] : hand.length;
  const HL = handLayout(hand.length), turnNow = Hh.phase === 'play' && Hh.turn === 0 && !tb.collect && !tb.blocked, legal = turnNow ? legalPlays(Hh, 0) : [];
  for (let i = 0; i < shown; i++) {
    const c = hand[i], r = HL[i];
    if (tb.drag && tb.drag.i === i && tb.drag.moved) continue;
    const isSel = tb.sel === i, shake = tb.shake && tb.shake.i === i ? Math.sin(tb.shake.t * 55) * 7 * (1 - clamp01(tb.shake.t / 0.4)) : 0;
    const lift = (isSel ? LIFT : 0) + (c === hintC ? 26 + (S.calm ? 0 : Math.sin(t * 6) * 6) : 0);
    const ok = !turnNow || legal.includes(c);
    drawCard(ctx, c, r.x + shake, r.y - lift, r.w, r.h, { big, dim: turnNow && !ok, glow: c === hintC ? '#ffe28a' : isSel ? '#ffd87a' : (turnNow && ok && Hh.trick.length ? 'rgba(255,240,170,0.55)' : undefined) });
  }
  if (tb.drag && tb.drag.moved && hand[tb.drag.i] !== undefined) drawCard(ctx, hand[tb.drag.i], tb.drag.x - Lo.hand.cw / 2, tb.drag.y - Lo.hand.ch / 2, Lo.hand.cw * 1.05, Lo.hand.ch * 1.05, { big, glow: '#ffd87a' });
  if (turnNow && !tb.msg && tb.sel < 0 && tb.mode !== 'lesson') { pill(ucx, Lo.pillY, 270, 36, 'rgba(0,0,0,0.5)'); text(Hh.trick.length ? 'Your turn: follow suit' : 'Your turn: lead a card', ucx, Lo.pillY + 7, 20, '#ffe9b0', UI, 700); }

  // ---- flights (cards moving) and the deal -----------------------------------------------------------------------------------------------
  for (const f of tb.flights) {
    const e = ease(clamp01(f.t / f.dur)), k = f.k0 + (f.k1 - f.k0) * e, w = T.trick.w * k, h = T.trick.h * k, to = T.slot[f.p];
    let from;
    if (f.hand !== undefined) { const r = handLayout(f.n)[f.hand]; from = { x: r.x + r.w / 2, y: r.y + r.h / 2 - f.lift }; } else if (f.pos) from = f.pos; else from = seatPoint(Lo, T, f.p);
    const y = from.y + (to.y - from.y) * e - Math.sin(Math.PI * e) * 30 * T.k;
    drawCard(ctx, f.c, from.x + (to.x - from.x) * e - w / 2, y - h / 2, w, h, { big, rot: (((f.c * 7) % 9) - 4) * 0.013 * e });
  }
  if (dealing) {
    const dw = 52 * Math.max(T.k, 0.8), dh = 76 * Math.max(T.k, 0.8);
    for (let k = 0; k < 52; k++) {
      const st = k * 0.028, f = (dealing.t - st) / 0.32; if (f <= 0 || f >= 1) continue;
      const seat = (Hh.dealer + 1 + k) % 4, to = seatPoint(Lo, T, seat), e = ease(f);
      drawCard(ctx, -1, T.deck.x + (to.x - T.deck.x) * e - dw / 2, T.deck.y + (to.y - T.deck.y) * e - dh / 2 - Math.sin(Math.PI * e) * 24, dw, dh, { back: S.back, rot: e * (seat & 1 ? 1.4 : 0.2) * (seat === 1 ? -1 : 1) });
    }
    const left = 52 - Math.floor(dealing.t / 0.028); if (left > 0) for (let i = 0; i < 4; i++) drawCard(ctx, -1, T.deck.x - dw / 2 + i * 1.5, T.deck.y - dh / 2 - i * 1.5, dw, dh, { back: S.back });
  }

  // ---- button rail ---------------------------------------------------------------------------------------------------------------------------
  const B = Lo.BTN;
  if (tb.mode === 'auto') {
    button(B.autoExit, 'Exit', { size: 26 });
    button(B.autoPause, tb.paused ? 'Resume' : 'Pause', { size: 24, primary: tb.paused });
    button(B.autoDec, '− Think', { size: 22, dim: S.autoThinkIdx <= 0 });
    button(B.autoInc, 'Think +', { size: 22, dim: S.autoThinkIdx >= THINK_STEPS.length - 1 });
  } else {
    button(B.leave, tb.mode === 'lesson' ? 'Lessons' : 'Leave', { size: 26 });
    button(B.undo, 'Undo', { size: 26, dim: !tb.undo.length });
    button(B.hint, tb.hintsLeft < 90 ? `Hint (${tb.hintsLeft})` : 'Hint', { size: 26, dim: tb.hintsLeft <= 0 });
  }

  // ---- lesson result buttons ---------------------------------------------------------------------------------------------------------------
  if (tb.mode === 'lesson' && S.lesson.state === 'done') {
    const lc = Lo.lessonCard; panel(lc);
    text('Well done!', lc.x + lc.w / 2, lc.y + 62, 48, '#fff2cf'); button(B.lesson, S.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 });
  }
  if (tb.mode === 'lesson' && S.lesson.state === 'retry') button(B.lesson, 'Try again', { primary: true, size: 30 });

  // ---- puzzle result --------------------------------------------------------------------------------------------------------------------------
  if (tb.mode === 'puzzle' && S.puz.state !== 'play') {
    const o = Lo.ov.puz, won = S.puz.state === 'solved';
    modal(o, 0.92, (cx) => {
      text(won ? 'Solved!' : 'Not this time', cx, 96, 64, won ? '#fff2cf' : '#f0c0b0');
      wrap(won ? `You and your partner took ${Hh.tricks[0]} of 5 tricks. Streak: ${S.daily.streak} day${S.daily.streak === 1 ? '' : 's'}.` : `You needed ${S.puzTarget} tricks and took ${Hh.tricks[0]}. Take back a card with Undo and try another line, or leave for today.`, cx, 156, 26, 500, '#f6e8c8', 34);
    });
    button(o.done, won ? 'Done' : 'Leave', { primary: true, size: 30 });
    if (!won) button(o.sol, 'Show me the solution', { size: 26 });
  }

  // ---- hand summary and match result overlays ---------------------------------------------------------------------------------------------------
  if (tb.summary) {
    const sm = tb.summary, o = Lo.ov.sum;
    modal(o, 0.95, (cx) => {
      text(sm.sweep ? 'All thirteen tricks!' : sm.made ? 'Contract made' : 'Contract failed', cx, 84, 54, sm.made === (sm.declarerTeam === 0) ? '#fff2cf' : '#f0c0b0');
      wrap(sm.line1, cx, 146, 26, 560, '#f6e8c8', 34); wrap(sm.line2, cx, 254, 26, 560, '#f6e8c8', 34);
      text('MATCH SCORE', cx, 380, 22, 'rgba(246,223,174,0.75)', UI, 700);
      text(`US ${tb.scores[0]}      THEM ${tb.scores[1]}`, cx, 450, 56, '#fff2cf');
      text(`First to ${tb.target}`, cx, 492, 22, 'rgba(246,223,174,0.75)', UI, 600);
      if (tb.mode === 'lesson') wrap('That is how a hand is scored. Nicely played.', cx, 550, 24, 520, '#f6e8c8', 30);
    });
    button(o.next, tb.mode === 'lesson' ? 'Finish lesson' : tb.over ? 'See the result' : 'Next hand', { primary: true, size: 32 });
  }
  if (tb.over && !tb.summary) {
    const o = Lo.ov.over, win = tb.over.winner === 0, auto = tb.mode === 'auto';
    modal(o, 0.95, (cx) => {
      text(auto ? (win ? 'South & North win!' : 'East & West win!') : win ? 'You win!' : 'They win', cx, 112, 70, win ? '#fff2cf' : '#f0c0b0');
      text(`Final score   Us ${tb.scores[0]}   Them ${tb.scores[1]}`, cx, 180, 30, '#f6e8c8', UI, 700);
      if (tb.over.unlocked) text(`${LEVELS[tb.over.unlocked].name} level unlocked`, cx, 230, 26, '#a8ecc4', UI, 700);
      wrap(auto ? 'A full match, played entirely by the computer.' : win ? 'You and your partner took the match.' : 'A hard-fought match. Try a lower level or use Hint and Undo.', cx, 290, 26, 520, '#f6e8c8', 34);
      drawMoreLine(ctx, cx, 704, 22);
    });
    button(o.next, 'Play again', { primary: true, size: 32 }); button(o.back, auto ? 'Exit to menu' : 'Menu', { size: 30 });
  }
  if (tb.leaving) {
    const o = Lo.ov.leave;
    modal(o, 0.96, (cx) => {
      text(tb.mode === 'play' ? 'Leave the table?' : 'Leave?', cx, 90, 54, '#fff2cf');
      wrap(tb.mode === 'play' ? 'Your match is saved at the start of each trick. You can continue it from the menu.' : 'You can come back any time.', cx, 140, 24, 500, '#f6e8c8', 32);
    });
    button(o.keep, 'Keep playing', { primary: true, size: 30 }); button(o.out, 'Leave', { size: 28 });
  }
}

// a face-up card shown only as its index (rank + suit) in a short strip, for a crowded column
function chip(ctx, c, x, y, w, h, chH, o, text) {
  const s = suitOf(c), r = rankOf(c), red = s === 1 || s === 2, label = RANK_CH[r];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(x + 1, y + 2, w, h, 6); ctx.fill();
  ctx.fillStyle = '#f7efdc'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.strokeStyle = 'rgba(70,50,30,0.65)'; ctx.lineWidth = 1.5; ctx.stroke();
  const sz = Math.min(22, chH * 0.72, Math.max(12, (h - 8) * 0.95));
  text(label, x + w * 0.34, y + chH * 0.5 + sz * 0.34, sz, red ? '#b5202c' : '#1c1a22', '"Cormorant Garamond", Georgia, serif', 700);
  suit(ctx, s, x + w * 0.68, y + chH * 0.5, sz * 0.4, red ? '#b5202c' : '#1c1a22');
  if (o.dim) { ctx.fillStyle = 'rgba(30,22,10,0.42)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); }
  if (o.glow) { ctx.lineWidth = 3; ctx.strokeStyle = o.glow; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 6); ctx.stroke(); }
  ctx.restore();
}

// how many cards each seat has received at this moment of the deal
function dealCounts(tb) {
  const c = [0, 0, 0, 0];
  for (let k = 0; k < 52; k++) if (tb.deal.t >= k * 0.028 + 0.32) c[(tb.H.dealer + 1 + k) % 4]++;
  return c;
}
