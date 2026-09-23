// Everything drawn each frame. Reads `state` (see game.js) and changes nothing. Static art and pieces are cached sprites.
import { W, H, D, PIECE_R, pointXY, BTN, LOOK, RES, LOOKLABEL, PLATE, MSG, titleRows, TEXT_SCALES, TEXTSTEP } from './layout.js';
import { drawTable, drawBoard, drawLantern, BOARD_THEME_NAMES } from './art.js';
import { drawPiece, blob, CJK, PIECE_THEME_NAMES } from './pieces.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { HOW, ABOUT, RULES } from './content.js';
import { SIDE_NAME, kingSquare, inCheckBoard, RED, BLACK } from './rules.js';

const TITLE = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, GOLD = '#f2d27a', CREAM = '#fbeccb';
const START_COUNT = [0, 1, 2, 2, 2, 2, 2, 5];

export function capturedBy(g, side) {              // pieces of the other colour that `side` has taken
  const have = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 90; s++) { const p = g.board[s]; if (p && (p > 0) !== (side > 0)) have[Math.abs(p)]++; }
  const out = [];
  for (const t of [5, 6, 4, 3, 2, 7, 1]) for (let k = have[t]; k < START_COUNT[t]; k++) out.push(-side * t);
  return out;
}

export function render(ctx, state) {
  const scene = state.scene, big = state.big, calm = state.calm;
  const theme = state.set, lang = state.lang === 'en' ? 'en' : 'zh', flip = state.human === BLACK && !state.two && (scene === 'play');
  const T = state.t;
  drawTable(ctx);
  const piece = (p, x, y, o = {}) => drawPiece(ctx, p, x, y, { theme, lang, ...o });

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center', weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return lines.length;
  };
  const panel = (r, alpha = 0.55, glow = 0) => {
    ctx.save(); ctx.fillStyle = `rgba(20,8,6,${alpha})`; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 20); ctx.fill();
    ctx.strokeStyle = glow ? `rgba(255,214,120,${0.55 + glow * 0.45})` : 'rgba(226,182,97,0.38)'; ctx.lineWidth = glow ? 3 : 1.6; ctx.stroke(); ctx.restore();
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    const press = o.press ? 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 6, r.w, r.h, 18); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffdc88'); gr.addColorStop(1, '#cf9430'); } else if (o.on) { gr.addColorStop(0, '#b3382a'); gr.addColorStop(1, '#6f1610'); } else { gr.addColorStop(0, '#6a2f1c'); gr.addColorStop(1, '#36150c'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, 18); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,245,200,0.8)' : 'rgba(255,214,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, 18); ctx.clip(); const sh = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, r.h * 0.5); ctx.restore();
    const sz = o.size ?? (r.h > 70 ? 32 : 28);
    text(label, r.x + r.w / 2, r.y + press + r.h / 2 + sz * 0.35, sz, o.primary ? '#2a1204' : CREAM, o.font ?? UI, 700);
    ctx.restore();
  };
  const lanterns = (s = 1, y = -8) => { drawLantern(ctx, s === 1 ? 110 : 150, y, T, 0, s); drawLantern(ctx, s === 1 ? 610 : 570, y, T, 2.1, s); };
  const heading = (str, sub) => { text(str, 360, 96, str.length > 12 ? 46 : 58, GOLD, TITLE, 700); if (sub) text(sub, 360, 128, 22, 'rgba(251,236,203,0.75)', UI, 600); };

  // ================================ title ==========================================================================
  if (scene === 'title') {
    lanterns(1, -6);
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
    text('The game of the river and the palace', 360, 632, 26, 'rgba(251,236,203,0.9)', UI, 600);
    const rows = titleRows(!!state.saved);
    if (state.saved) button(rows.resume, 'Resume game', { primary: true });
    button(rows.learn, state.learnedAll ? 'Lessons' : 'Learn to play', { primary: !state.saved });
    button(rows.red, `Play Red (you move first)`, { size: 27 }); button(rows.black, 'Play Black', {}); button(rows.two, 'Two players', {});
    button(rows.daily, state.daily.solvedToday ? 'Daily puzzle: solved' : `Daily puzzle${state.daily.streak ? ' (streak ' + state.daily.streak + ')' : ''}`, { size: 27 });
    // Language: a real, named, tappable choice right here on the title screen (not only in Settings), matching
    // Shogi's "Play (X)" pattern so the choice is the first thing a player sees.
    button(rows.langZh, 'Play (象棋)', { on: lang !== 'en', size: 27, font: CJK });
    button(rows.langEn, 'Play (English)', { on: lang === 'en', size: 24 });
    button(rows.level, `Computer: ${LEVELS[state.level].name}`, { size: 24 }); button(rows.sound, `Sound: ${state.sound ? 'on' : 'off'}`, { size: 24 });
    button(rows.how, 'How to play', { size: 19 }); button(rows.about, 'About Xiangqi', { size: 19 }); button(rows.rules, 'Rules', { size: 24 }); button(rows.look, 'Board, pieces and settings', { size: 24 });
    if (state.progress.played) text(`Games ${state.progress.played}   Wins ${state.progress.wins}`, 360, rows.look.y + rows.look.h + 46, 22, 'rgba(251,236,203,0.6)', UI, 600);
    return;
  }
  if (scene === 'demo-limit') {
    lanterns(1, -6); blob(ctx, 360, 520, 300, 200, '255,150,70', 0.25);
    piece(1, 360, 470, { R: 32, scale: 3 });
    text('Enjoying Xiangqi?', 360, 760, 60, GOLD, TITLE); wrap('The free web version stops here. Get the full game on iPhone and Android: every lesson, unlimited games against five computer levels, a new puzzle every day, and it works offline.', 360, 830, 30, 560, CREAM, 42);
    button({ x: 140, y: 1200, w: 440, h: 84 }, 'Back to menu', { primary: true }); return;
  }
  if (scene === 'look') {
    lanterns(0.62, -8); heading('Settings');
    piece(1, 190, 300, { R: 32, scale: 1.6 }); piece(-1, 300, 300, { R: 32, scale: 1.6 }); piece(5, 420, 300, { R: 32, scale: 1.6 }); piece(-6, 530, 300, { R: 32, scale: 1.6 });
    const grp = (i, label, rects, names, cur) => { text(label, 360, LOOKLABEL[i], 26, 'rgba(251,236,203,0.8)', UI, 600); rects.forEach((r, k) => button(r, names[k], { on: cur === k, size: 25 })); };
    // Language: the two full presentations (native characters, or English letters throughout) — a real, visible,
    // named choice, never blended. The Chinese label is set in the embedded CJK font so it always renders correctly.
    text('Language', 360, LOOKLABEL[0], 26, 'rgba(251,236,203,0.8)', UI, 600);
    button(LOOK.lang[0], 'Play (象棋)', { on: lang !== 'en', size: 25, font: CJK });
    button(LOOK.lang[1], 'Play (English)', { on: lang === 'en', size: 22 });
    grp(1, 'Board', LOOK.boards, ['Paper', 'Night'], state.board === 'night' ? 1 : 0);
    grp(2, 'Pieces', LOOK.sets, ['Boxwood', 'Ebony'], state.set === 'ebony' ? 1 : 0);
    grp(3, 'Text size', LOOK.text, ['Normal', 'Large'], big ? 1 : 0);
    grp(4, 'Motion', LOOK.calm, ['Full', 'Reduced'], calm ? 1 : 0);
    grp(5, 'Sound', LOOK.sound, ['On', 'Off'], state.sound ? 0 : 1);
    button(LOOK.back, 'Back', { primary: true }); return;
  }
  if (scene === 'howto' || scene === 'about' || scene === 'rules') {
    lanterns(0.62, -8);
    const pages = scene === 'howto' ? HOW : scene === 'about' ? ABOUT : RULES, pg = pages[state.page % pages.length];
    const sceneTitle = scene === 'howto' ? 'How to play' : scene === 'about' ? 'About this game' : 'Rules';
    // Falls back to 1 for any out-of-range index (e.g. a save from a build with a different-length array).
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    heading(sceneTitle, `${state.page % pages.length + 1} of ${pages.length}`);

    // The reader card: one framed panel holding the page title, the piece portraits (if any) and the
    // body text, so the page reads as a designed reference sheet rather than text floating loose over
    // the lanterns/table backdrop.
    const rp = { x: 34, y: 150, w: W - 68, h: 1430 - 150 };
    ctx.save();
    ctx.beginPath(); ctx.roundRect(rp.x, rp.y, rp.w, rp.h, 26);
    const rg = ctx.createLinearGradient(0, rp.y, 0, rp.y + rp.h);
    rg.addColorStop(0, 'rgba(40,14,10,0.6)'); rg.addColorStop(1, 'rgba(16,6,4,0.72)');
    ctx.fillStyle = rg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(242,210,122,0.32)'; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(rp.x + 6, rp.y + 6, rp.w - 12, rp.h - 12, 20);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(242,210,122,0.12)'; ctx.stroke();
    ctx.restore();

    text(pg.title, 360, rp.y + 62, Math.round(46 * Math.min(scale, 1.15)), GOLD, TITLE);
    let y = rp.y + 106;
    // A Rules page about one piece shows that piece's own real in-game sprite, Red and Black side by
    // side, using the same drawPiece() the board itself uses - never a separate simplified icon.
    if (pg.type) {
      const py = rp.y + 148, dx = 120, pr = 50;
      piece(pg.type, 360 - dx, py, { R: pr }); piece(-pg.type, 360 + dx, py, { R: pr });
      text('Red', 360 - dx, py + 78, 20, 'rgba(251,236,203,0.7)', UI, 600);
      text('Black', 360 + dx, py + 78, 20, 'rgba(251,236,203,0.7)', UI, 600);
      y = py + 118;
    }
    const sz = Math.round(28 * scale), lh = Math.round(sz * 1.4), gap = Math.round(18 * scale);
    for (const it of pg.items) {
      ctx.fillStyle = '#e2b661'; ctx.beginPath(); ctx.arc(66, y - 9, 5, 0, TAU); ctx.fill();
      const n = wrap(it, 88, y, sz, rp.w - 90, CREAM, lh, 'left', 500); y += n * lh + gap;
    }
    button(BTN.prev, 'Back', {}); button(BTN.page, 'Next page', { primary: true });
    button(TEXTSTEP.dec, 'A−', { dim: state.textScaleIdx === 0, size: 30 });
    button(TEXTSTEP.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 30 });
    return;
  }

  // ================================ board scenes ===================================================================
  lanterns(0.62, -6);
  const g = state.g, a = state.anim;
  const inLesson = scene === 'lesson', inPuzzle = scene === 'puzzle';
  if (!inLesson && !inPuzzle) heading('Xiangqi'); else heading(inLesson ? 'Lesson ' + (state.lesson.i + 1) + ' of ' + LESSONS.length : 'Daily puzzle');
  const pos = (s) => pointXY(s, flip);
  const own = state.human;

  // ---- plates (play only) and lesson / puzzle header
  const plate = (r, side, name, sub, active) => {
    panel(r, 0.6, active ? 0.5 + 0.5 * (calm ? 1 : Math.sin(T * 4) * 0.5 + 0.5) : 0);
    piece(side * 1, r.x + 52, r.y + 44, { R: 32, scale: 0.9 });
    text(name, r.x + 100, r.y + 42, 30, CREAM, UI, 700, 'left'); text(sub, r.x + 100, r.y + 72, 21, 'rgba(251,236,203,0.7)', UI, 500, 'left');
    const cap = capturedBy(g, side), maxN = 16; cap.slice(0, maxN).forEach((p, k) => piece(p, r.x + 312 + k * 20.5, r.y + 46, { R: 32, scale: 0.4, alpha: 0.95 }));
  };
  if (inLesson) {
    const l = LESSONS[state.lesson.i], st = l.steps[state.lesson.s];
    panel({ x: 40, y: 146, w: 640, h: 176 }, 0.5);
    text(l.title, 360, 190, 42, GOLD, TITLE);
    text(`Step ${state.lesson.s + 1} of ${l.steps.length}`, 360, 214, 19, 'rgba(242,210,122,0.85)', UI, 600);
    wrap(state.lesson.done ? st.done : st.text, 360, 248, big ? 27 : 24, 596, state.lesson.done ? '#c9f7c0' : '#ffffff', big ? 31 : 29, 'center', 600);
  } else if (inPuzzle) {
    const pz = state.pz;
    panel({ x: 40, y: 152, w: 640, h: 172 }, 0.5);
    text(`Red to move: checkmate in ${pz.n}`, 360, 196, 38, CREAM, TITLE);
    wrap(pz.status === 'solved' ? `Solved${pz.tries ? ' after ' + pz.tries + ' wrong tr' + (pz.tries === 1 ? 'y' : 'ies') : ' first time'}. A new puzzle comes tomorrow.` : (pz.n === 3 ? 'Weekend puzzle: three moves. The opponent will defend best.' : 'Find the move that forces checkmate. The opponent will defend.'), 360, 236, big ? 27 : 24, 590, '#fff3d6', 30, 'center', 500);
    if (pz.daily) text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 360, 300, 22, 'rgba(242,210,122,0.9)', UI, 600);
  } else {
    const opp = state.two ? 'Black' : LEVELS[state.level].name + ' computer', me = state.two ? 'Red' : 'You';
    const topSide = flip ? RED : BLACK, botSide = flip ? BLACK : RED;
    const nm = (side) => state.two ? SIDE_NAME[side] : (side === own ? 'You' : 'Computer');
    const sd = (side) => `${SIDE_NAME[side]} · ${!state.two && side !== own ? LEVELS[state.level].name : side === RED ? 'moves first' : 'second'}`;
    plate(PLATE.top, topSide, nm(topSide), sd(topSide), !g.result && g.turn === topSide);
    plate(PLATE.bottom, botSide, nm(botSide), sd(botSide), !g.result && g.turn === botSide);
    void opp; void me;
  }

  drawBoard(ctx, state.board, lang);

  // ---- highlights under the pieces
  const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(T * 4.2);
  if (state.last && !inLesson) for (const s of [state.last.f, state.last.t]) { const p = pos(s); blob(ctx, p.x, p.y, 54, 54, '255,205,90', 0.5); }
  if (state.last && inLesson) for (const s of [state.last.f, state.last.t]) { const p = pos(s); blob(ctx, p.x, p.y, 54, 54, '255,205,90', 0.4); }
  if (!g.result || g.result.why !== 'checkmate') { /* nothing */ }
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

  // ---- pieces (top to bottom so lower ones overlap upper ones' shadows naturally)
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
  // capture flourish
  for (const r of state.rings) { const f = r.t / 0.5; if (f < 1) { ctx.save(); ctx.strokeStyle = `rgba(255,220,130,${1 - f})`; ctx.lineWidth = 6 * (1 - f) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, 20 + f * 60, 0, TAU); ctx.stroke(); ctx.restore(); } }
  for (const q of state.parts) { const f = q.t / q.max; if (f < 1) { ctx.fillStyle = `rgba(${q.c},${1 - f})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - f * 0.6), 0, TAU); ctx.fill(); } }
  // river is drawn in the board layer; check banner
  if (state.banner && state.banner.t < 1.4) {
    const f = state.banner.t / 1.4, sc = 1 + Math.max(0, 0.4 - f * 2), al = f < 0.75 ? 1 : 1 - (f - 0.75) * 4;
    ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(360, GY_MID); ctx.scale(sc, sc); ctx.rotate(-0.05);
    ctx.fillStyle = 'rgba(160,20,14,0.9)'; ctx.beginPath(); ctx.roundRect(-190, -56, 380, 112, 20); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();
    text(state.banner.text, 0, 24, state.banner.text.length > 8 ? 54 : 72, '#fff2cf', TITLE, 700); ctx.restore();
  }

  // ---- message panel
  const bottom = inLesson ? { x: 40, y: 1146, w: 640, h: 290 } : inPuzzle ? { x: 40, y: 1146, w: 640, h: 290 } : MSG;
  if (!inLesson && !inPuzzle) { panel(MSG, 0.5); }
  else panel(bottom, 0.5);
  const m = state.msg;
  let line = m ? m.text : defaultMessage(state);
  const col = m ? (m.kind === 'warn' ? '#ffcf8a' : m.kind === 'good' ? '#c9f7c0' : CREAM) : CREAM;
  const mr = (inLesson || inPuzzle) ? bottom : MSG;
  wrap(line, 360, mr.y + 48, big ? 34 : 29, 590, col, big ? 44 : 38, 'center', 600);
  if ((inLesson && !state.lesson.done) || (inPuzzle && state.pz.status !== 'solved')) wrap('TAP a piece, then TAP a glowing point. Or DRAG it there.', 360, mr.y + mr.h - 50, 22, 560, 'rgba(242,210,122,0.85)', 28, 'center', 600);
  if (inLesson) { const l = LESSONS[state.lesson.i]; l.steps.forEach((_, k) => { ctx.fillStyle = k < state.lesson.s || (k === state.lesson.s && state.lesson.done) ? '#8de08a' : k === state.lesson.s ? GOLD : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(360 + (k - (l.steps.length - 1) / 2) * 26, mr.y + mr.h - 16, 7, 0, TAU); ctx.fill(); }); }

  // ---- buttons
  if (inLesson) {
    button(BTN.menu, 'Lessons', {}); button(BTN.undo, 'Hint', { dim: state.lesson.done }); button(BTN.hint, state.lesson.done ? (state.lesson.s + 1 < LESSONS[state.lesson.i].steps.length ? 'Next step' : state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish') : 'Restart step', { primary: state.lesson.done });
  } else if (inPuzzle) {
    button(BTN.menu, 'Menu', {}); button(BTN.undo, 'Reset', { dim: state.pz.status === 'solved' }); button(BTN.hint, 'Hint', { dim: state.pz.status === 'solved' });
  } else {
    button(BTN.menu, 'Menu', {}); button(BTN.undo, 'Undo', { dim: g.log.length === 0 }); button(BTN.hint, g.result ? 'New game' : `Hint (${state.hintsLeft})`, { dim: !g.result && (state.hintsLeft <= 0 || state.thinking), primary: !!g.result });
  }

  // ---- result panel
  if (state.overOpen && g.result) {
    ctx.fillStyle = 'rgba(8,3,2,0.66)'; ctx.fillRect(0, 300, W, 840);
    panel(RES.panel, 0.9, 0.6);
    const r = g.result, humanWon = !state.two && r.winner === own, drew = r.winner === 0;
    const title = drew ? 'A draw' : state.two ? `${SIDE_NAME[r.winner]} wins` : humanWon ? 'You win!' : 'The computer wins';
    const why = { checkmate: 'Checkmate.', stalemate: 'No legal move left: a loss in Xiangqi.', perpetual: 'Perpetual check is not allowed: the checking side loses.', repetition: 'The same position three times: a draw.', quiet: 'Sixty moves each without a capture: a draw.' }[r.why];
    piece(drew ? 1 : r.winner, 360, 560, { R: 32, scale: 1.8, lift: 0.5 + (calm ? 0 : Math.sin(T * 3) * 0.3) });
    text(title, 360, 690, 62, GOLD, TITLE); wrap(why, 360, 736, 26, 500, CREAM, 32);
    button(RES.again, 'Play again', { primary: true }); button(RES.look, 'Look at the board', {}); button(RES.menu, 'Menu', {});
  }
}
const GY_MID = 372 + 4.5 * D;

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
