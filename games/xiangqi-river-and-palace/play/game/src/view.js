// Everything drawn each frame. Reads `state` (see game.js) and changes nothing. Static art and pieces are cached sprites.
// Positions come from the layout (layout.js `layoutFor(w, h)`), never from fixed numbers: the screen can be portrait or landscape.
// The board and everything that lives on it is drawn in canonical board space under one transform (L.board(kind): s, ox, oy).
import { pointXY, D, GY, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { drawTable, drawBoard, drawLantern } from './art.js';
import { drawPiece, blob, CJK } from './pieces.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { HOW, ABOUT, RULES } from './content.js';
import { SIDE_NAME, kingSquare, inCheckBoard, RED, BLACK } from './rules.js';
import { drawCredit, drawMoreLine, drawLockup } from './brand.js';

const TITLE = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, GOLD = '#f2d27a', CREAM = '#fbeccb';
const START_COUNT = [0, 1, 2, 2, 2, 2, 2, 5];
const GY_MID = GY + 4.5 * D;
// The reader card publishes how tall its content is, so game.js can clamp scrolling (render never changes `state`).
export const readerMetrics = { contentH: 0, viewH: 0, max: 0 };

export function capturedBy(g, side) {              // pieces of the other colour that `side` has taken
  const have = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 90; s++) { const p = g.board[s]; if (p && (p > 0) !== (side > 0)) have[Math.abs(p)]++; }
  const out = [];
  for (const t of [5, 6, 4, 3, 2, 7, 1]) for (let k = have[t]; k < START_COUNT[t]; k++) out.push(-side * t);
  return out;
}

export function render(ctx, state, L) {
  const scene = state.scene, big = state.big, calm = state.calm;
  const theme = state.set, lang = state.lang === 'en' ? 'en' : 'zh', flip = state.human === BLACK && !state.two && (scene === 'play');
  const T = state.t, SW = L.w, SH = L.h;
  drawTable(ctx, SW, SH);
  const piece = (p, x, y, o = {}) => drawPiece(ctx, p, x, y, { theme, lang, ...o });

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fit = (str, maxW, size, font = UI, weight = 700, min = 20) => { ctx.font = `${weight} ${size}px ${font}`; const w = ctx.measureText(str).width; return w <= maxW ? size : Math.max(min, Math.floor(size * maxW / w)); };
  const lines = (str, size, maxW, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center', weight = 600) => {
    const ls = lines(str, size, maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length;
  };
  // Wrap text into a box, shrinking the font (down to `min`) until it fits the height. Returns the font size used.
  const fitWrap = (str, r, size, color, { min = 20, lhK = 1.3, align = 'center', weight = 600 } = {}) => {
    let sz = size, ls = lines(str, sz, r.w, weight);
    while (sz > min && ls.length * sz * lhK > r.h) { sz -= 1; ls = lines(str, sz, r.w, weight); }
    const lh = sz * lhK, x = align === 'center' ? r.x + r.w / 2 : r.x;
    ls.forEach((ln, i) => text(ln, x, r.y + sz + i * lh, sz, color, UI, weight, align)); return sz;
  };
  const panel = (r, alpha = 0.55, glow = 0) => {
    ctx.save(); ctx.fillStyle = `rgba(20,8,6,${alpha})`; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 20); ctx.fill();
    ctx.strokeStyle = glow ? `rgba(255,214,120,${0.55 + glow * 0.45})` : 'rgba(226,182,97,0.38)'; ctx.lineWidth = glow ? 3 : 1.6; ctx.stroke(); ctx.restore();
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    const press = o.press ? 3 : 0, rad = Math.min(18, r.h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffdc88'); gr.addColorStop(1, '#cf9430'); } else if (o.on) { gr.addColorStop(0, '#b3382a'); gr.addColorStop(1, '#6f1610'); } else { gr.addColorStop(0, '#6a2f1c'); gr.addColorStop(1, '#36150c'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,245,200,0.8)' : 'rgba(255,214,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    let sz = Math.min(o.size ?? (r.h > 70 ? 32 : 28), Math.round(r.h * 0.46));
    sz = fit(label, r.w - 22, sz, o.font ?? UI, 700, 20);
    text(label, r.x + r.w / 2, r.y + press + r.h / 2 + sz * 0.35, sz, o.primary ? '#2a1204' : CREAM, o.font ?? UI, 700);
    ctx.restore();
  };
  const lantern = (x, scale) => drawLantern(ctx, x, -6, T, x < SW / 2 ? 0 : 2.1, scale);
  const stepper = (st, dec, inc, label) => {
    button(st.dec, '−', { dim: dec, size: 30 }); button(st.inc, '+', { dim: inc, size: 30 });
    text(label, st.label.x, st.label.y, st.label.size, 'rgba(251,236,203,0.9)', UI, 700);
  };

  // ================================ title ==========================================================================
  if (scene === 'title') {
    const TL = L.title(!!state.saved), hr = TL.hero;
    ctx.save(); ctx.translate(hr.x, hr.y); ctx.scale(hr.s, hr.s);
    drawLantern(ctx, TL.lanternX[0], -6, T, 0, 1); drawLantern(ctx, TL.lanternX[1], -6, T, 2.1, 1);
    const bob = calm ? 0 : Math.sin(T * 1.4) * 5;
    blob(ctx, 360, 380, 330, 190, '255,150,70', 0.28);
    piece(1, 226, 372 + bob, { R: 32, scale: 2.75 });
    piece(-1, 494, 372 - bob, { R: 32, scale: 2.75 });
    if (lang === 'en') {
      ctx.save(); ctx.strokeStyle = 'rgba(242,210,122,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(300, 372); ctx.lineTo(420, 372); ctx.stroke();
      ctx.font = `italic 700 22px ${TITLE}`; ctx.fillStyle = 'rgba(242,210,122,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('English', 360, 336); ctx.restore();
    } else {
      ctx.save(); ctx.strokeStyle = 'rgba(242,210,122,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(316, 372); ctx.lineTo(404, 372); ctx.stroke();
      ctx.font = `700 34px ${CJK}`; ctx.fillStyle = 'rgba(242,210,122,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('象棋', 360, 336); ctx.restore();
    }
    ctx.save(); ctx.shadowColor = 'rgba(255,170,80,0.55)'; ctx.shadowBlur = 24; text('Xiangqi', 360, 586, 104, GOLD, TITLE, 700); ctx.restore();
    text('The game of the river and the palace', 360, 648, 26, 'rgba(251,236,203,0.9)', UI, 600);
    ctx.restore();
    const nr = TL.narrow;
    if (state.saved) button(TL.resume, 'Resume game', { primary: true });
    button(TL.learn, state.learnedAll ? 'Lessons' : 'Learn to play', { primary: !state.saved });
    button(TL.red, nr ? 'Play Red' : 'Play Red (you move first)', { size: 27 }); button(TL.black, 'Play Black', {}); button(TL.two, 'Two players', {});
    button(TL.daily, state.daily.solvedToday ? (nr ? 'Puzzle: solved' : 'Daily puzzle: solved') : `Daily puzzle${state.daily.streak && !nr ? ' (streak ' + state.daily.streak + ')' : ''}`, { size: 27 });
    // Auto Play ("Watch & Learn"): free, untimed, both sides play automatically - a teaching demo,
    // never counted as a real game (see startAutoplay()/isPreviewExempt() in game.js).
    button(TL.autoplay, nr ? 'Auto Play' : 'Auto Play (Watch & Learn)', { size: 24 });
    // Language: a real, named, tappable choice right here on the title screen (not only in Settings).
    button(TL.langZh, 'Play (象棋)', { on: lang !== 'en', size: 27, font: CJK });
    button(TL.langEn, 'Play (English)', { on: lang === 'en', size: 24 });
    button(TL.level, `Computer: ${LEVELS[state.level].name}`, { size: 24 }); button(TL.sound, `Sound: ${state.sound ? 'on' : 'off'}`, { size: 24 });
    button(TL.how, 'How to play', { size: 22 }); button(TL.about, TL.how.w < 190 ? 'About' : 'About Xiangqi', { size: 22 }); button(TL.rules, 'Rules', { size: 24 }); button(TL.look, 'Board, pieces and settings', { size: 24 });
    if (state.progress.played) text(`Games ${state.progress.played}   Wins ${state.progress.wins}`, TL.stats.x, TL.stats.y, 22, 'rgba(251,236,203,0.6)', UI, 600);
    { const c = TL.credit, lh = c.w * 0.2725, pad = lh * 0.12; ctx.save(); ctx.globalAlpha = state.lockPress > 0 ? 0.7 : 1; ctx.fillStyle = 'rgba(10,8,24,0.55)'; ctx.beginPath(); ctx.roundRect(c.x - c.w / 2 - pad, c.top - pad, c.w + 2 * pad, lh + 2 * pad, (lh + 2 * pad) * 0.3); ctx.fill(); ctx.restore(); }
    if (!drawLockup(ctx, TL.credit.x, TL.credit.top + TL.credit.w * 0.2725, TL.credit.w, state.lockPress > 0 ? 0.7 : 1)) drawCredit(ctx, TL.credit.x, TL.credit.y, 20);
    return;
  }
  if (scene === 'demo-limit') {
    const DL = L.demo();
    lantern(L.lanternX[0], 1); lantern(L.lanternX[1], 1); blob(ctx, DL.hero.x, DL.hero.y + 40, 300, 200, '255,150,70', 0.25);
    piece(1, DL.hero.x, DL.hero.y, { R: 32, scale: 3 });
    const al = L.wide ? 'center' : 'center';
    text('Enjoying Xiangqi?', DL.title.x, DL.title.y, 60, GOLD, TITLE, 700, al);
    wrap('The free web version stops here. Get the full game on iPhone and Android: every lesson, unlimited games against five computer levels, a new puzzle every day, and it works offline.', DL.body.x, DL.body.y, 30, DL.body.w, CREAM, 42);
    button(DL.back, 'Back to menu', { primary: true }); return;
  }
  if (scene === 'look') {
    const LK = L.look();
    if (!L.wide) { lantern(L.lanternX[0] + 40, 0.62); lantern(SW - L.lanternX[0] - 40, 0.62); }
    text('Settings', LK.head.x, LK.head.y, LK.head.size, GOLD, TITLE, 700, LK.head.align);
    if (LK.showPieces) { const py = LK.pieces.y + 20; [[1, -170], [-1, -60], [5, 60], [-6, 170]].forEach(([p, dx]) => piece(p, SW / 2 + dx, py, { R: 32, scale: 1.6 })); }
    const names = { lang: ['Play (象棋)', 'Play (English)'], boards: ['Paper', 'Night'], sets: ['Boxwood', 'Ebony'], text: ['Normal', 'Large'], calm: ['Full', 'Reduced'], sound: ['On', 'Off'] };
    const labels = { lang: 'Language', boards: 'Board', sets: 'Pieces', text: 'Text size', calm: 'Motion', sound: 'Sound' };
    const cur = { lang: lang === 'en' ? 1 : 0, boards: state.board === 'night' ? 1 : 0, sets: state.set === 'ebony' ? 1 : 0, text: big ? 1 : 0, calm: calm ? 1 : 0, sound: state.sound ? 0 : 1 };
    for (const g of LK.groups) {
      text(labels[g.key], g.label.x, g.label.y, g.label.size, 'rgba(251,236,203,0.8)', UI, 600);
      g.rects.forEach((r, k) => button(r, names[g.key][k], { on: cur[g.key] === k, size: 25, font: g.key === 'lang' && k === 0 ? CJK : UI }));
    }
    button(LK.back, 'Back', { primary: true }); return;
  }
  if (scene === 'howto' || scene === 'about' || scene === 'rules') {
    const RF = L.ref();
    const pages = scene === 'howto' ? HOW : scene === 'about' ? ABOUT : RULES;
    const sceneTitle = scene === 'howto' ? 'How to play' : scene === 'about' ? 'About this game' : 'Rules';
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const tsz = fit(sceneTitle, RF.title.align === 'center' ? RF.card.w - 40 : RF.dec.x - RF.title.x - 20, RF.title.size, TITLE, 700);
    text(sceneTitle, RF.title.x, RF.title.y, tsz, GOLD, TITLE, 700, RF.title.align);

    // The reader card: one framed panel holding ONE continuous scrolling document: every section in order (heading, the piece
    // portraits where the section has them, then its bullets). Drag, wheel, keys and the scroll bar move it; Next moves a screenful.
    const rp = RF.card;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(rp.x, rp.y, rp.w, rp.h, 26);
    const rg = ctx.createLinearGradient(0, rp.y, 0, rp.y + rp.h);
    rg.addColorStop(0, 'rgba(40,14,10,0.6)'); rg.addColorStop(1, 'rgba(16,6,4,0.72)');
    ctx.fillStyle = rg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(242,210,122,0.32)'; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(rp.x + 6, rp.y + 6, rp.w - 12, rp.h - 12, 20);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(242,210,122,0.12)'; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(rp.x + 3, rp.y + 3, rp.w - 6, rp.h - 6, 23); ctx.clip();
    const scroll = Math.max(0, Math.min(state.scroll || 0, readerMetrics.max));
    const tx = rp.x + 54, vis = (y0, y1) => y1 >= rp.y - 80 && y0 <= rp.y + rp.h + 80;
    // Body font grows a lot more than the (capped) title as the text-size step rises, so the gap below the title (and the
    // piece labels) grows with it, sized from the body font's own cap-height.
    const sz = Math.round(28 * scale), lh = Math.round(sz * 1.4), gap = Math.round(18 * scale);
    const bulletR = Math.round(5 * scale), bulletDy = Math.round(9 * scale), titlePx = Math.round(46 * Math.min(scale, 1.15));
    let top = 0;                                   // document y (0 = top of the card), screen y = rp.y + top - scroll
    pages.forEach((pg, pi) => {
      if (pi) top += Math.round(6 * scale) - 24;
      const y0 = rp.y + top - scroll;
      if (vis(y0, y0 + titlePx * 1.6)) text(pg.title, rp.x + rp.w / 2, y0 + 62, fit(pg.title, rp.w - 40, titlePx, TITLE, 700), GOLD, TITLE);
      let y = y0 + 90 + Math.round(sz * 0.75);
      // A Rules section about one piece shows that piece's own real in-game sprite, Red and Black side by side.
      if (pg.type) {
        const py = y0 + 148, dx = 120, pr = 50, cxp = rp.x + rp.w / 2;
        if (vis(py - 70, py + 100)) {
          piece(pg.type, cxp - dx, py, { R: pr }); piece(-pg.type, cxp + dx, py, { R: pr });
          text('Red', cxp - dx, py + 78, 22, 'rgba(251,236,203,0.7)', UI, 600);
          text('Black', cxp + dx, py + 78, 22, 'rgba(251,236,203,0.7)', UI, 600);
        }
        y = py + 98 + Math.round(sz * 0.75);
      }
      for (const it of pg.items) {
        const n = lines(it, sz, rp.w - 90, 500).length;
        if (vis(y - lh, y + n * lh)) {
          ctx.fillStyle = '#e2b661'; ctx.beginPath(); ctx.arc(rp.x + 32, y - bulletDy, bulletR, 0, TAU); ctx.fill();
          wrap(it, tx, y, sz, rp.w - 90, CREAM, lh, 'left', 500);
        }
        y += n * lh + gap;
      }
      top = y - rp.y + scroll;
    });
    readerMetrics.contentH = top + 12; readerMetrics.viewH = rp.h; readerMetrics.max = Math.max(0, readerMetrics.contentH - rp.h);
    if (readerMetrics.max > 0) {
      const bh = Math.max(36, rp.h * rp.h / readerMetrics.contentH), by = rp.y + (rp.h - bh) * (scroll / readerMetrics.max);
      ctx.fillStyle = 'rgba(242,210,122,0.5)'; ctx.beginPath(); ctx.roundRect(rp.x + rp.w - 11, by + 4, 5, bh - 8, 3); ctx.fill();
    }
    ctx.restore();
    button(RF.prev, 'Back', {}); button(RF.page, (state.scroll || 0) >= readerMetrics.max - 2 ? 'Done' : 'Next', { primary: true });
    button(RF.dec, 'A−', { dim: state.textScaleIdx === 0, size: 30 });
    button(RF.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 30 });
    return;
  }

  // ================================ board scenes ===================================================================
  const inLesson = scene === 'lesson', inPuzzle = scene === 'puzzle', inAuto = scene === 'autoplay';
  const BL = L.board(inLesson ? 'lesson' : inPuzzle ? 'puzzle' : inAuto ? 'auto' : 'play');
  // No lanterns on Auto Play (its think-time stepper sits where they hang) or in the landscape layout (the cards use that space).
  if (BL.lanterns && !inAuto) { const x0 = Math.max(150, L.backZone + 60); lantern(x0, BL.lanternScale); lantern(SW - 150, BL.lanternScale); }
  const g = state.g, a = state.anim;
  const hd = BL.head;
  const headTitle = inAuto ? 'Auto Play' : inLesson ? 'Lesson ' + (state.lesson.i + 1) + ' of ' + LESSONS.length : inPuzzle ? 'Daily puzzle' : 'Xiangqi';
  text(headTitle, hd.x, hd.y, hd.align === 'left' ? fit(headTitle, hd.w, hd.size, TITLE, 700) : hd.size, GOLD, TITLE, 700, hd.align);
  if (inAuto && hd.sub) text('Both sides play automatically', hd.sub.x, hd.sub.y, 22, 'rgba(251,236,203,0.75)', UI, 600, hd.align);
  const own = state.human;

  // ---- plates (play only) and lesson / puzzle header
  const plate = (r, side, name, sub, active) => {
    panel(r, 0.6, active ? 0.5 + 0.5 * (calm ? 1 : Math.sin(T * 4) * 0.5 + 0.5) : 0);
    const inline = r.w >= 560, k = Math.min(1, r.h / 88), cap = capturedBy(g, side), maxN = 16;
    piece(side * 1, r.x + (inline ? r.h * 0.59 : 54), r.y + (inline ? r.h / 2 : 46), { R: 32, scale: 0.9 * (inline ? k : 1) });
    const nx = r.x + (inline ? r.h * 1.14 : 100), ny = inline ? r.y + r.h * 0.48 : r.y + 42;
    text(name, nx, ny, Math.round((inline ? 30 * k : 28)), CREAM, UI, 700, 'left'); text(sub, nx, ny + (inline ? 30 * k : 28), fit(sub, r.x + r.w - nx - (inline ? 340 * k : 12), 22, UI, 500, 20), 'rgba(251,236,203,0.7)', UI, 500, 'left');
    if (inline) { const x0 = r.x + 312 * k + (1 - k) * 0, pitch = 20.5 * k; cap.slice(0, maxN).forEach((p, i) => piece(p, x0 + i * pitch, r.y + r.h * 0.52, { R: 32, scale: 0.4 * k, alpha: 0.95 })); }
    else { const pitch = Math.min(20.5, (r.w - 40) / maxN); cap.slice(0, maxN).forEach((p, i) => piece(p, r.x + 26 + i * pitch, r.y + r.h - 24, { R: 32, scale: pitch < 18 ? 0.34 : 0.4, alpha: 0.95 })); }
  };
  if (inAuto) {
    plate(BL.top, BLACK, 'Black', `${LEVELS[state.level].name} computer`, !g.result && g.turn === BLACK);
    plate(BL.bot, RED, 'Red', `${LEVELS[state.level].name} computer`, !g.result && g.turn === RED);
  } else if (inLesson) {
    const l = LESSONS[state.lesson.i], st = l.steps[state.lesson.s], r = BL.top;
    panel(r, 0.5);
    text(l.title, r.x + r.w / 2, r.y + 44, fit(l.title, r.w - 30, 42, TITLE, 700), GOLD, TITLE);
    text(`Step ${state.lesson.s + 1} of ${l.steps.length}`, r.x + r.w / 2, r.y + 74, 22, 'rgba(242,210,122,0.85)', UI, 600);
    fitWrap(state.lesson.done ? st.done : st.text, { x: r.x + 22, y: r.y + 86, w: r.w - 44, h: r.h - 98 }, big ? 27 : 24, state.lesson.done ? '#c9f7c0' : '#ffffff', { min: 20, lhK: 1.2 });
  } else if (inPuzzle) {
    const pz = state.pz, r = BL.top;
    panel(r, 0.5);
    const t1 = `Red to move: checkmate in ${pz.n}`;
    text(t1, r.x + r.w / 2, r.y + 44, fit(t1, r.w - 30, 38, TITLE, 700), CREAM, TITLE);
    fitWrap(pz.status === 'solved' ? `Solved${pz.tries ? ' after ' + pz.tries + ' wrong tr' + (pz.tries === 1 ? 'y' : 'ies') : ' first time'}. A new puzzle comes tomorrow.` : (pz.n === 3 ? 'Weekend puzzle: three moves. The opponent will defend best.' : 'Find the move that forces checkmate. The opponent will defend.'), { x: r.x + 22, y: r.y + 62, w: r.w - 44, h: r.h - 62 - (pz.daily ? 34 : 10) }, big ? 27 : 24, '#fff3d6', { min: 20, lhK: 1.2, weight: 500 });
    if (pz.daily) text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, r.x + r.w / 2, r.y + r.h - 14, 22, 'rgba(242,210,122,0.9)', UI, 600);
  } else {
    const topSide = flip ? RED : BLACK, botSide = flip ? BLACK : RED;
    const nm = (side) => state.two ? SIDE_NAME[side] : (side === own ? 'You' : 'Computer');
    const sd = (side) => `${SIDE_NAME[side]} · ${!state.two && side !== own ? LEVELS[state.level].name : side === RED ? 'moves first' : 'second'}`;
    plate(BL.top, topSide, nm(topSide), sd(topSide), !g.result && g.turn === topSide);
    plate(BL.bot, botSide, nm(botSide), sd(botSide), !g.result && g.turn === botSide);
  }

  // ---- the board and everything on it, in canonical board space
  ctx.save(); ctx.translate(BL.ox, BL.oy); ctx.scale(BL.s, BL.s);
  drawBoard(ctx, state.board, lang);
  const pos = (s) => pointXY(s, flip);
  const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(T * 4.2);
  if (state.last && !inLesson) for (const s of [state.last.f, state.last.t]) { const p = pos(s); blob(ctx, p.x, p.y, 54, 54, '255,205,90', 0.5); }
  if (state.last && inLesson) for (const s of [state.last.f, state.last.t]) { const p = pos(s); blob(ctx, p.x, p.y, 54, 54, '255,205,90', 0.4); }
  const inChk = !g.result && inCheckBoard(g.board, g.turn);
  if (inChk || (g.result && g.result.why === 'checkmate')) { const k = kingSquare(g.board, g.turn); if (k >= 0) { const p = pos(k); blob(ctx, p.x, p.y, 78 + pulse * 10, 78 + pulse * 10, '255,50,30', 0.6 + pulse * 0.3); } }
  if (state.sel >= 0) { const p = pos(state.sel); blob(ctx, p.x, p.y, 66, 66, '255,214,110', 0.7); }
  if (state.hint) for (const s of [state.hint.from, state.hint.to]) { const p = pos(s); blob(ctx, p.x, p.y, 62 + pulse * 8, 62 + pulse * 8, '90,255,160', 0.55 + pulse * 0.25); }
  for (const s of state.targets) {
    const p = pos(s), cap = g.board[s] !== 0;
    if (cap) { blob(ctx, p.x, p.y, 62, 62, '255,60,40', 0.4 + pulse * 0.25); }
    else { blob(ctx, p.x, p.y, 34 + pulse * 5, 34 + pulse * 5, '70,220,140', 0.65 + pulse * 0.25); ctx.fillStyle = 'rgba(214,255,226,0.95)'; ctx.beginPath(); ctx.arc(p.x, p.y, 7.5, 0, TAU); ctx.fill(); }
  }
  if (inLesson && !state.lesson.done && state.lesson.showSol) { const st = LESSONS[state.lesson.i].steps[state.lesson.s]; for (const pt of st.sol) { const p = pos(pt[1] * 9 + pt[0]); blob(ctx, p.x, p.y, 62, 62, '90,255,160', 0.5 + pulse * 0.3); } }
  // Auto Play REVEAL: a bold gold ring around the destination of the move about to be played.
  if (inAuto && state.autoPhase === 'reveal' && state.hint) {
    const p = pos(state.hint.to);
    ctx.save(); ctx.strokeStyle = `rgba(255,214,80,${0.75 + pulse * 0.25})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 30 + pulse * 6, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // pieces (top to bottom so lower ones overlap upper ones' shadows naturally)
  const moving = a && (a.type === 'move' || a.type === 'refuse') ? a : null, dragSq = state.drag && state.drag.moved ? state.drag.sq : -1;
  const drawAt = (p, s, o = {}) => { const q = pos(s); piece(p, q.x + (o.dx ?? 0), q.y + (o.dy ?? 0), o); };
  for (let s = 0; s < 90; s++) {
    const p = g.board[s]; if (!p) continue;
    if (moving && a.type === 'move' && s === a.to) continue;
    if (moving && a.type === 'refuse' && s === a.from) continue;
    if (s === dragSq) continue;
    const lift = s === state.sel ? 1 : 0, bob = lift && !calm ? Math.sin(T * 5) * 1.5 : 0;
    drawAt(p, s, { lift, dy: bob, scale: lift ? 1.06 : 1 });
  }
  if (moving && a.type === 'move' && a.cap) { const f = Math.min(1, a.t / a.dur); if (f < 0.98) drawAt(a.cap, a.to, { alpha: 1 - Math.max(0, (f - 0.7) / 0.28), scale: 1 - Math.max(0, (f - 0.7)) * 0.6 }); }
  if (moving) {
    const f = Math.min(1, a.t / a.dur), from = pos(a.from), to = pos(a.to);
    if (a.type === 'move') {
      const e = f * f * (3 - 2 * f), x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e, lift = Math.sin(Math.PI * f) * 1.25;
      piece(a.p, x, y, { lift, scale: 1 + lift * 0.06 });
    } else {
      const reach = 0.55, out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = calm ? 0 : f >= 0.38 && f < 0.64 ? Math.sin(f * 110) * 5 : 0;
      piece(a.p, from.x + (to.x - from.x) * e + shake, from.y + (to.y - from.y) * e, { lift: 0.5 * Math.sin(Math.PI * Math.min(1, f * 1.1)) });
      if (f > 0.34 && f < 0.7) { ctx.save(); ctx.strokeStyle = `rgba(255,90,60,${0.8 * (1 - Math.abs(f - 0.5) * 4)})`; ctx.lineWidth = 4; const q = pos(a.to); ctx.beginPath(); ctx.moveTo(q.x - 16, q.y - 16); ctx.lineTo(q.x + 16, q.y + 16); ctx.moveTo(q.x + 16, q.y - 16); ctx.lineTo(q.x - 16, q.y + 16); ctx.stroke(); ctx.restore(); }
    }
  }
  if (dragSq >= 0) piece(g.board[dragSq], state.drag.x, state.drag.y - 46, { lift: 1.2, scale: 1.12 });
  if (state.kb && !moving) { const p = pos(state.cursor); ctx.save(); ctx.strokeStyle = '#7fffc0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(p.x - 38, p.y - 38, 76, 76, 12); ctx.stroke(); ctx.restore(); }
  for (const r of state.rings) { const f = r.t / 0.5; if (f < 1) { ctx.save(); ctx.strokeStyle = `rgba(255,220,130,${1 - f})`; ctx.lineWidth = 6 * (1 - f) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, 20 + f * 60, 0, TAU); ctx.stroke(); ctx.restore(); } }
  for (const q of state.parts) { const f = q.t / q.max; if (f < 1) { ctx.fillStyle = `rgba(${q.c},${1 - f})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - f * 0.6), 0, TAU); ctx.fill(); } }
  if (state.banner && state.banner.t < 1.4) {
    const f = state.banner.t / 1.4, sc = 1 + Math.max(0, 0.4 - f * 2), al = f < 0.75 ? 1 : 1 - (f - 0.75) * 4;
    ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(360, GY_MID); ctx.scale(sc, sc); ctx.rotate(-0.05);
    ctx.fillStyle = 'rgba(160,20,14,0.9)'; ctx.beginPath(); ctx.roundRect(-190, -56, 380, 112, 20); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();
    text(state.banner.text, 0, 24, state.banner.text.length > 8 ? 54 : 72, '#fff2cf', TITLE, 700); ctx.restore();
  }
  ctx.restore();

  // ---- message panel
  const mr = BL.msg;
  panel(mr, 0.5);
  const m = state.msg;
  const line = inAuto ? autoMessage(state) : m ? m.text : defaultMessage(state);
  const col = m ? (m.kind === 'warn' ? '#ffcf8a' : m.kind === 'good' ? '#c9f7c0' : CREAM) : CREAM;
  const tip = ((inLesson && !state.lesson.done) || (inPuzzle && state.pz.status !== 'solved')) && (mr.w >= 420 || mr.h >= 200);
  const dots = inLesson ? 26 : 0, tipH = tip ? (mr.w < 420 ? 62 : 36) : 0;
  const box = { x: mr.x + 20, y: mr.y + 12, w: mr.w - 40, h: Math.max(30, mr.h - 24 - tipH - dots) };
  fitWrap(line, box, big ? 34 : 29, inAuto && state.autoPhase === 'reveal' ? '#8de08a' : col, { min: 20, lhK: big ? 1.3 : 1.31, weight: 600 });
  if (tip) { const tr = { x: mr.x + 20, y: mr.y + mr.h - dots - tipH - 4, w: mr.w - 40, h: tipH }; fitWrap('TAP a piece, then TAP a glowing point. Or DRAG it there.', tr, 22, 'rgba(242,210,122,0.85)', { min: 20, lhK: 1.2 }); }
  if (inLesson) { const l = LESSONS[state.lesson.i]; l.steps.forEach((_, k) => { ctx.fillStyle = k < state.lesson.s || (k === state.lesson.s && state.lesson.done) ? '#8de08a' : k === state.lesson.s ? GOLD : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(mr.x + mr.w / 2 + (k - (l.steps.length - 1) / 2) * 26, mr.y + mr.h - 14, 7, 0, TAU); ctx.fill(); }); }

  // ---- buttons
  if (inAuto) {
    // Think-time stepper: an index into THINK_STEPS (never a raw float).
    stepper(BL.stepper, state.autoThinkIdx === 0, state.autoThinkIdx === THINK_STEPS.length - 1, `Think: ${THINK_STEPS[state.autoThinkIdx]}s`);
    button(BL.btnSingle, 'Exit', {});
  } else if (inLesson) {
    button(BL.btn.menu, 'Lessons', {}); button(BL.btn.undo, 'Hint', { dim: state.lesson.done }); button(BL.btn.hint, state.lesson.done ? (state.lesson.s + 1 < LESSONS[state.lesson.i].steps.length ? 'Next step' : state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish') : 'Restart step', { primary: state.lesson.done });
  } else if (inPuzzle) {
    button(BL.btn.menu, 'Menu', {}); button(BL.btn.undo, 'Reset', { dim: state.pz.status === 'solved' }); button(BL.btn.hint, 'Hint', { dim: state.pz.status === 'solved' });
  } else {
    button(BL.btn.menu, 'Menu', {}); button(BL.btn.undo, 'Undo', { dim: g.log.length === 0 }); button(BL.btn.hint, g.result ? 'New game' : `Hint (${state.hintsLeft})`, { dim: !g.result && (state.hintsLeft <= 0 || state.thinking), primary: !!g.result });
  }

  // ---- result panel
  if (state.overOpen && g.result) {
    const RS = L.res();
    ctx.fillStyle = 'rgba(8,3,2,0.66)'; ctx.fillRect(0, 0, SW, SH);
    panel(RS.panel, 0.92, 0.6);
    const r = g.result, humanWon = !state.two && !inAuto && r.winner === own, drew = r.winner === 0;
    const title = drew ? 'A draw' : (state.two || inAuto) ? `${SIDE_NAME[r.winner]} wins` : humanWon ? 'You win!' : 'The computer wins';
    const why = { checkmate: 'Checkmate.', stalemate: 'No legal move left: a loss in Xiangqi.', perpetual: 'Perpetual check is not allowed: the checking side loses.', repetition: 'The same position three times: a draw.', quiet: 'Sixty moves each without a capture: a draw.' }[r.why];
    piece(drew ? 1 : r.winner, RS.piece.x, RS.piece.y, { R: 32, scale: RS.piece.scale, lift: 0.5 + (calm ? 0 : Math.sin(T * 3) * 0.3) });
    if (inAuto) text('AUTO-PLAY DEMO — not saved', RS.tag.x, RS.tag.y, fit('AUTO-PLAY DEMO — not saved', RS.title.max, 22, UI, 700), 'rgba(242,210,122,0.85)', UI, 700);
    text(title, RS.title.x, RS.title.y, fit(title, RS.title.max, 62, TITLE, 700), GOLD, TITLE);
    wrap(why, RS.why.x, RS.why.y, 26, RS.why.max, CREAM, 32);
    if (inAuto) { button(RS.again, 'Watch again', { primary: true }); button(RS.look, 'Look at the board', {}); button(RS.menu, 'Exit to menu', {}); }
    else { button(RS.again, 'Play again', { primary: true }); button(RS.look, 'Look at the board', {}); button(RS.menu, 'Menu', {}); }
    drawMoreLine(ctx, RS.more.x, RS.more.y, 21);
  }
}

// The THINK/REVEAL phase, shown in the message panel instead of the usual default/status message.
function autoMessage(state) {
  if (state.g.result) return 'Game over — see the result below.';
  if (state.autoPhase === 'reveal') return 'Here is the move about to be played (highlighted in green).';
  const side = state.g.turn === RED ? 'Red' : 'Black';
  return `${side} is thinking… try to guess the move before it is revealed.`;
}

function defaultMessage(state) {
  const g = state.g, scene = state.scene;
  if (scene === 'lesson') return state.lesson.done ? LESSONS[state.lesson.i].steps[state.lesson.s].done : 'Follow the step above. Ask for a Hint if you are stuck.';
  if (scene === 'puzzle') return state.pz.status === 'solved' ? 'Solved!' : 'Tap a piece, then tap where it should go.';
  if (g.result) { const r = g.result; return r.winner === 0 ? 'The game is drawn.' : `${SIDE_NAME[r.winner]} wins${r.why === 'checkmate' ? ' by checkmate' : ''}.`; }
  if (state.sel >= 0 && !state.thinking) return 'Green points: where it can go. A red glow: a piece you can capture. Tap a point to move, or tap the piece again to put it down.';
  if (state.thinking) return `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
  if (state.two) return `${SIDE_NAME[g.turn]} to move. TAP a piece, then TAP a glowing point.`;
  return g.log.length === 0 && state.human === RED ? 'Your move. TAP one of your red pieces, then TAP a glowing point (or DRAG it).' : 'Your move.';
}
