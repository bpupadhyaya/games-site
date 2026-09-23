// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The table, the stands, the board and
// every piece are cached sprites/layers (art.js, pieces.js), so a frame is cheap.
import { W, H, sqCenter, standSlot, STAND, STAND_ORDER, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { drawTable, drawBoard, drawStands } from './art.js';
import { drawPiece, fontReady, JP } from './pieces.js';
import { LETTER, NAME, base, mFrom, mTo, isDrop, mDrop, inCheck } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { ABOUT_PAGES, HOWTO_PAGES, RULES_PAGES, titleListBottom, TITLE_AUTO_GAP, TITLE_AUTO_H } from './ui.js';

const DISPLAY = '"Cormorant Garamond", "Noto Serif JP", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Serif JP", sans-serif';
const TAU = Math.PI * 2, GOLD = '#f2d590', PAPER = '#f7ecd2', VERMILION = '#c0392b';
const RANKS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PIECE_SCALE = 0.48;          // master sprite scale on a 68-point cell
const ease = (f) => f * f * (3 - 2 * f);

const wrapCache = new Map();
export function render(ctx, state, h) {
  const { G, flip, bottomSide, buttons } = h;
  const t = state.t, calm = state.prefs.calm, big = state.prefs.big ? 1.16 : 1;
  const T = calm ? 0 : t;                       // ambient time (frozen when motion is reduced)
  const lang = state.prefs.lang === 'en' ? 'en' : 'jp';
  // In English mode the piece already shows the Western letter as its primary glyph, so the small helper
  // overlay ("Western letters on pieces") only applies in 日本語 mode, where it sits under the kanji.
  const pieceOpts = (tt) => ({ label: lang === 'jp' && state.prefs.labels ? LETTER[tt] : undefined, lang });
  fontReady(ctx);

  const text = (str, x, y, size, color = PAPER, font = UI, weight = 600, align = 'center') => { ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrapLines = (str, maxW, size, font, weight) => {
    const key = `${str}|${maxW}|${size}|${font}`;
    let r = wrapCache.get(key);
    if (r) return r;
    ctx.font = `${weight} ${size}px ${font}`;
    const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); wrapCache.set(key, lines); if (wrapCache.size > 400) wrapCache.clear();
    return lines;
  };
  // wrap into a box, shrinking the type until it fits
  const fitText = (str, x, y, maxW, maxH, size, color = PAPER, align = 'center', font = UI, weight = 500) => {
    let s = size, lines = wrapLines(str, maxW, s, font, weight);
    while (lines.length * s * 1.28 > maxH && s > 15) { s -= 1; lines = wrapLines(str, maxW, s, font, weight); }
    lines.forEach((ln, i) => text(ln, x, y + s + i * s * 1.28, s, color, font, weight, align));
    return lines.length * s * 1.28;
  };
  const panel = (x, y, w, hh, alpha = 0.78, r = 20) => {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.beginPath(); ctx.roundRect(x, y, w, hh, r); ctx.fillStyle = `rgba(22,13,7,${alpha})`; ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(242,213,144,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(x + 0.8, y + 0.8, w - 1.6, hh - 1.6, r); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,200,0.10)'; ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, hh - 10, r - 4); ctx.stroke();
  };
  const button = (b) => {
    ctx.save();
    if (b.dim) ctx.globalAlpha = 0.45;
    const press = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(b.x + 2, b.y + 7 - press, b.w, b.h, 18); ctx.fill();
    const primary = b.primary, sel = b.toggle || b.pill;
    const gr = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (primary) { gr.addColorStop(0, '#d7473a'); gr.addColorStop(1, '#8b1a12'); }
    else if (sel) { gr.addColorStop(0, '#9a6a2c'); gr.addColorStop(1, '#5e3c14'); }
    else { gr.addColorStop(0, '#5f4127'); gr.addColorStop(1, '#33200f'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 18); ctx.fill();
    // gloss
    const gl = ctx.createLinearGradient(0, b.y, 0, b.y + b.h * 0.55); gl.addColorStop(0, 'rgba(255,240,210,0.30)'); gl.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.roundRect(b.x + 3, b.y + 3, b.w - 6, b.h * 0.5, 15); ctx.fill();
    ctx.strokeStyle = primary ? 'rgba(255,214,150,0.85)' : sel ? 'rgba(255,224,150,0.9)' : 'rgba(242,213,144,0.45)'; ctx.lineWidth = primary || sel ? 2.4 : 1.6;
    ctx.beginPath(); ctx.roundRect(b.x + 0.8, b.y + 0.8, b.w - 1.6, b.h - 1.6, 17); ctx.stroke();
    const size = (b.small ? 26 : b.tile ? 27 : 34) * (b.tile ? 1 : big > 1 ? 1.08 : 1);
    let label = b.label;
    ctx.font = `700 ${size}px ${DISPLAY}`;
    let sz = size; while (ctx.measureText(label).width > b.w - 34 && sz > 16) { sz -= 1; ctx.font = `700 ${sz}px ${DISPLAY}`; }
    text(label, b.x + b.w / 2 + (b.pill !== undefined ? -50 : 0), b.y + b.h / 2 + sz * 0.3, sz, primary ? '#fff2d8' : PAPER, DISPLAY, 700, 'center');
    if (b.pill !== undefined) {
      const px = b.x + b.w - 116, py = b.y + b.h / 2 - 20;
      ctx.fillStyle = b.pill ? '#2f7a45' : '#3a2a1a'; ctx.beginPath(); ctx.roundRect(px, py, 84, 40, 20); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,170,0.6)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = b.pill ? '#e9ffd8' : '#a98d68'; ctx.beginPath(); ctx.arc(b.pill ? px + 62 : px + 22, py + 20, 15, 0, TAU); ctx.fill();
    }
    if (b.stars) { for (let i = 0; i < b.stars; i++) { ctx.fillStyle = b.toggle ? '#ffe9a8' : 'rgba(242,213,144,0.55)'; ctx.beginPath(); ctx.arc(b.x + 40 + i * 22, b.y + b.h - 18, 6, 0, TAU); ctx.fill(); } }
    if (b.done) { ctx.strokeStyle = '#9be27a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x + b.w - 40, b.y + 22); ctx.lineTo(b.x + b.w - 30, b.y + 34); ctx.lineTo(b.x + b.w - 14, b.y + 12); ctx.stroke(); }
    ctx.restore();
  };
  const drawButtons = (filter) => { for (const b of buttons) if (!filter || filter(b)) button(b); };

  // ---- background: table, petals, lantern glow ---------------------------------------------------------------------
  drawTable(ctx);
  petals(ctx, T);

  const scene = state.scene;
  const onBoard = scene === 'play' || scene === 'lesson' || scene === 'puzzle' || scene === 'auto';

  if (onBoard) drawBoardScene();
  else if (scene === 'title') drawTitle();
  else drawPages();

  // ---- overlays -----------------------------------------------------------------------------------------------------
  if (state.promo) drawPromo();
  else if (state.menu) { dim(0.62); text('Paused', 360, 350, 64, GOLD, DISPLAY, 700); }
  if (!state.promo || true) drawButtons((b) => b.kind !== 'promo');

  // =====================================================================================================================
  function dim(a) { ctx.fillStyle = `rgba(6,3,1,${a})`; ctx.fillRect(0, 0, W, H); }

  function drawTitle() {
    lantern(ctx, 96, 60, 1, T, 0); lantern(ctx, 624, 84, 0.84, T, 1.7);
    // the mark
    ctx.save(); ctx.shadowColor = 'rgba(255,150,70,0.55)'; ctx.shadowBlur = 40;
    ctx.textAlign = 'center'; ctx.font = `700 190px ${JP}`; ctx.lineWidth = 8; ctx.strokeStyle = '#3a1608'; ctx.strokeText('将棋', 360, 300);
    const g = ctx.createLinearGradient(0, 140, 0, 300); g.addColorStop(0, '#f0604c'); g.addColorStop(1, '#a4241a'); ctx.fillStyle = g; ctx.fillText('将棋', 360, 300);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.55; ctx.font = `700 190px ${JP}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,220,180,0.35)'; ctx.fillText('将棋', 358, 296); ctx.restore();
    text('Shogi', 360, 400, 104, GOLD, DISPLAY, 700);
    text('Japan\'s game of generals and drops', 360, 452, 29, PAPER, UI, 500);
    // three koma that float
    const parade = [[7, 15, -200], [8, 8, 0], [1, 9, 200]];
    parade.forEach(([a, b2, dx], i) => {
      const bob = Math.sin(T * 1.3 + i * 2.1) * 6, tilt = Math.sin(T * 0.9 + i) * 0.05 + (i === 0 ? -0.1 : i === 2 ? 0.1 : 0);
      const flipT = ((T * 0.35 + i * 0.33) % 1);
      const pc = flipT < 0.5 ? a : b2;
      ctx.save(); ctx.translate(360 + dx, 560 + bob); ctx.rotate(tilt);
      drawPiece(ctx, pc, 0, 0, 0, 0, 0.78, { lang });
      ctx.restore();
    });
    // Every one of these positions is computed off titleListBottom(), not a fixed number, because
    // the button list above grows by one row ("Continue game") whenever there is a saved game -
    // a fixed number here would either overlap that taller list or leave an odd gap for the shorter
    // one. The Auto Play button itself lives in ui.js at exactly titleListBottom() + TITLE_AUTO_GAP.
    const listBottom = titleListBottom({ saved: !!state.saved }), langRowY = listBottom - 92;
    text('Language', 360, langRowY - 26, 22, 'rgba(247,236,210,0.55)', UI, 600);
    // stats/streak line: only drawn if it clears the canvas with room to spare - on the tallest
    // shape of this list (a saved game plus the Auto Play row) there is no safe room left below for
    // it, and a flourish line is worth skipping rather than ever risking it clipping or overlapping.
    const afterAuto = listBottom + TITLE_AUTO_GAP + TITLE_AUTO_H + 40;
    const bits = [];
    if (state.stats.played > 0) bits.push(`Played ${state.stats.played} · Won ${state.stats.wins}`);
    if (state.daily.streak > 0) bits.push(`Streak ${state.daily.streak}d`);
    if (bits.length && afterAuto + 20 <= H - 14) text(bits.join('   '), 360, afterAuto, 25, 'rgba(247,236,210,0.7)', UI, 500);
  }

  function drawPages() {
    panel(30, 60, 660, 1440, 0.55, 26);
    if (scene === 'setup') {
      text(state.variant === 'mini' ? 'Mini shogi' : 'New game', 360, 160, 74, GOLD, DISPLAY, 700);
      text(state.variant === 'mini' ? 'A quick 5x5 game: the gentlest way in' : 'Choose your opponent', 360, 220, 28, PAPER, UI, 500);
      const lv = LEVELS[state.level];
      fitText(lv.blurb, 360, 806, 560, 120, 27 * big, PAPER, 'center');
      text('Your side', 360, 946, 26, 'rgba(242,213,144,0.85)', UI, 600);
    } else if (scene === 'settings') {
      text('Settings', 360, 190, 74, GOLD, DISPLAY, 700);
      text('Language', 360, 772, 26, 'rgba(242,213,144,0.85)', UI, 600);
      fitText('Reduced motion stops bobbing and shortens moves. Large text makes messages bigger. Western letters print P, R, B under the pieces to help while you learn the characters in 日本語 mode. Play (日本語) shows the real kanji; Play (English) relabels every piece in English.', 360, 1060, 560, 220, 25 * big, 'rgba(247,236,210,0.8)');
    } else if (scene === 'learn') {
      text('Learn to play', 360, 170, 70, GOLD, DISPLAY, 700);
      text('Twelve short lessons: you make every move yourself', 360, 222, 27, PAPER, UI, 500);
      const done = state.lessonsDone.filter(Boolean).length;
      text(`${done} of ${LESSONS.length} complete`, 360, 1200, 28, 'rgba(242,213,144,0.85)', UI, 600);
    } else if (scene === 'about' || scene === 'howto' || scene === 'rules') {
      const pages = scene === 'about' ? ABOUT : scene === 'howto' ? HOWTO : RULES;
      const pg = pages[Math.min(state.page, pages.length - 1)];
      // Text-size stepper (A-/A+, drawn as ordinary buttons up in the header row by ui.js/drawButtons).
      // Falls back to 1 for any out-of-range index (e.g. a save from a build with more steps) - the
      // clamp-on-load in game.js should already prevent this, but the lookup guard costs nothing.
      const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
      // The screen title sits in the header row alongside the A-/A+ buttons, so - like the page title
      // below it - it is capped at a gentler growth than the body text, keeping it clear of the buttons
      // at the top step instead of ballooning past them.
      text(scene === 'about' ? 'About shogi' : scene === 'howto' ? 'How to play' : 'Rules', 360, 224, Math.round(56 * Math.min(scale, 1.15)), GOLD, DISPLAY, 700);
      // A thin rule under the screen title, so the reference sheet reads as one designed card (matching
      // this game's own gold-on-dark palette) rather than a title just floating over the body text.
      ctx.strokeStyle = 'rgba(242,213,144,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(120, 250); ctx.lineTo(600, 250); ctx.stroke();
      // Page/section title: some run long ("Why captured pieces come back"), so - same idiom the button
      // label drawer already uses below - shrink it until it clears the panel margins instead of letting
      // a centred, unwrapped fillText touch or cross the panel edge at the top text-size step. Its growth
      // is also capped (like the screen title above it): an uncapped page title at 3x grew tall enough to
      // collide with "Rules"/"About shogi"/"How to play" sitting right above it - a real, visible overlap
      // caught by rendering the actual pages at 300%, not assumed from the code.
      const titleScale = Math.min(scale, 1.3);
      let titleSz = Math.round(40 * titleScale); ctx.font = `700 ${titleSz}px ${DISPLAY}`;
      while (ctx.measureText(pg.title).width > 620 && titleSz > 24) { titleSz -= 1; ctx.font = `700 ${titleSz}px ${DISPLAY}`; }
      // The title's own baseline and the content that follows both key off its measured size, so growing
      // or shrinking the title (long title vs short, low scale vs high) can never crowd or gap unevenly.
      const titleBaseline = 270 + Math.round(titleSz * 0.82);
      text(pg.title, 360, titleBaseline, titleSz, PAPER, DISPLAY, 700);
      let y = titleBaseline + Math.round(titleSz * 0.38) + 20;
      // Rules pages that cover one piece type show the real in-game sprite, Sente and Gote side by side,
      // using the same drawPiece() the board itself uses - never a separate simplified icon. The portrait
      // itself is always drawn at a fixed size (it must match the real board art), only its vertical
      // position follows the now scale-aware `y` above it.
      if (pg.piece !== undefined) {
        const footY = y + 74, dx = 110, ps2 = 0.92;
        drawPiece(ctx, pg.piece, 0, 0, 360 - dx, footY, ps2, { lang });
        drawPiece(ctx, pg.piece, 1, 1, 360 + dx, footY, ps2, { lang });
        text('Sente', 360 - dx, footY + 82, Math.round(21 * Math.min(scale, 1.15)), 'rgba(247,236,210,0.6)', UI, 600);
        text('Gote', 360 + dx, footY + 82, Math.round(21 * Math.min(scale, 1.15)), 'rgba(247,236,210,0.6)', UI, 600);
        y = footY + 120;
      }
      // Real base sizes (~28-30px on this 720-wide canvas), then the A-/A+ scale multiplies on top.
      // Rules pages tend to have more/longer lines than About/How to play ever did, so Rules keeps a
      // touch smaller base and tighter paragraph gap; content.js paces every page to a single short
      // sentence so this rarely needs to shrink even at the 3x top step.
      const lnSize = scene === 'rules' ? 28 : 30, lnGap = Math.round((scene === 'rules' ? 16 : 20) * scale);
      // Left-anchored column inside the panel, matching Rules' original correct anchor: fitText is
      // called with align 'left', so x must be the column's LEFT edge (360 - 570/2), not the panel's
      // horizontal centre. About/How to play used to pass x=360 here, which ran their lines off the
      // right edge of the panel/canvas - fixed by using the same anchor as Rules for all three.
      const lnX = 75;
      // maxH is the REAL remaining room before the page indicator, not a flat guess: a flat constant
      // here let a diagram page's text run past the indicator at 3x (measured on an actual screenshot),
      // because it had no idea a portrait above it had already spent part of the panel's height. Using
      // the room actually left guarantees fitText's own safety-shrink can never be reached this way.
      for (const ln of pg.lines) { const room = Math.max(60, 1260 - y); const hh = fitText(ln, lnX, y, 570, room, lnSize * scale, 'rgba(247,236,210,0.94)', 'left', UI, 500); y += hh + lnGap; }
      const total = scene === 'about' ? ABOUT_PAGES : scene === 'howto' ? HOWTO_PAGES : RULES_PAGES;
      // A plain "Page X of Y" caption reads clearly at any page count - Rules alone runs to 48 pages
      // (splitting piece/drop rules into single-concept pages for the 300% text-size step), where a
      // dot row would shrink to unreadable slivers. Text also keeps About/How to play/Rules visually
      // consistent with each other instead of switching indicator styles by page count.
      text(`Page ${state.page + 1} of ${total}`, 360, 1290, 24, 'rgba(247,236,210,0.65)', UI, 600);
    } else if (scene === 'demo-limit') {
      text('Preview complete', 360, 340, 74, GOLD, DISPLAY, 700);
      fitText('You have used the free web preview. The full game for iPhone and Android has every lesson, all five computer levels, unlimited games and a new puzzle every day.', 360, 420, 540, 420, 32, PAPER);
    }
  }

  // ---- the board scenes ------------------------------------------------------------------------------------------------
  function drawBoardScene() {
    const g = G, n = g.n, pos = state.game, bs = bottomSide, cell = g.cell, ps = (cell / 68) * PIECE_SCALE;
    const topSide = 1 - bs;
    const lessonScene = scene === 'lesson', puzzleScene = scene === 'puzzle', autoScene = scene === 'auto';
    // header
    ctx.textAlign = 'center';
    if (autoScene) text('Auto Play', 360, 88, 56, GOLD, DISPLAY, 700);
    else if (!lessonScene && !puzzleScene) { text('将棋', 300, 88, 46, VERMILION, JP, 700); text('Shogi', 420, 88, 62, GOLD, DISPLAY, 700); }
    else if (lessonScene) text(LESSONS[state.lesson.i].title, 360, 98, 52, GOLD, DISPLAY, 700);
    else text(`Puzzle of the day: mate in ${state.pz.pz.n}`, 360, 98, 50, GOLD, DISPLAY, 700);
    const sub = autoScene ? `Watch & Learn  ·  think time ${THINK_STEPS[state.autoThinkIdx]}s` : lessonScene ? `Lesson ${state.lesson.i + 1} of ${LESSONS.length}` : puzzleScene ? (state.pz.extra ? 'Practice puzzle' : `Same puzzle for everyone today${state.daily.streak ? '   ·   streak ' + state.daily.streak : ''}`) : state.two ? 'Two players on one phone' : `${state.variant === 'mini' ? 'Mini shogi   ·   ' : ''}${LEVELS[state.level].name}   ·   you are ${state.human === 0 ? 'Sente (first)' : 'Gote (second)'}`;
    text(sub, 360, 140, 25, 'rgba(247,236,210,0.8)', UI, 500);

    drawStands(ctx);
    const flying = state.anim && state.anim.cap ? state.anim : null;
    const drawStand = (which, owner) => {
      const hand = pos.hand[owner], rot = which === 'top' ? 1 : 0;
      STAND_ORDER.forEach((tt, i) => {
        let cnt = hand[tt] - (flying && flying.by === owner && base(flying.cap & 15) === tt ? 1 : 0);
        if (cnt <= 0) return;
        const p = standSlot(which, i), sel = state.sel && state.sel.drop === tt && pos.turn === owner;
        const hinted = state.hint && isDrop(state.hint.m) && mDrop(state.hint.m) === tt && pos.turn === owner;
        if (sel || hinted) { const gl = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 54); gl.addColorStop(0, `rgba(255,220,120,${0.55 + (calm ? 0 : 0.2 * Math.sin(t * 6))})`); gl.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = gl; ctx.fillRect(p.x - 60, p.y - 60, 120, 120); }
        drawPiece(ctx, tt, owner, rot, p.x, p.y - (sel ? 8 : 0), 0.42 * (sel ? 1.08 : 1), pieceOpts(tt));
        if (cnt > 1) {
          const bx = p.x + (rot ? -24 : 24), by = p.y + (rot ? -26 : 26);
          ctx.fillStyle = '#7d1a12'; ctx.beginPath(); ctx.arc(bx, by, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8; ctx.stroke();
          text(String(cnt), bx, by + 7, 20, '#fff2d8', UI, 700);
        }
      });
    };
    // in a lesson or puzzle the opponent's tray is covered by the teaching card
    if (!lessonScene && !puzzleScene) {
      drawStand('top', topSide);
      const nameTop = autoScene ? 'Computer (Gote)' : state.two ? 'Gote' : `Computer  ·  ${LEVELS[state.level].name}`;
      const nameBot = autoScene ? 'Computer (Sente)' : state.two ? 'Sente' : 'You';
      text(nameTop, 44, 186, 27, 'rgba(247,236,210,0.85)', UI, 600, 'left'); text(nameBot, 44, 1080, 27, 'rgba(247,236,210,0.85)', UI, 600, 'left');
      const turnSide = state.result ? -1 : pos.turn;
      const dotY = turnSide === topSide ? 178 : 1072;
      if (turnSide >= 0) { ctx.fillStyle = `rgba(255,214,120,${0.7 + (calm ? 0 : 0.3 * Math.sin(t * 5))})`; ctx.beginPath(); ctx.arc(28, dotY, 6, 0, TAU); ctx.fill(); }
      if (state.thinking) {
        const dots = calm ? 3 : 1 + (Math.floor(t * 3) % 3);
        text('Thinking' + '.'.repeat(dots), 676, 186, 26, GOLD, UI, 600, 'right');
      } else if (autoScene && state.autoPhase) {
        const dots = calm ? 3 : 1 + (Math.floor(t * 3) % 3);
        text(state.autoPhase === 'think' ? 'Thinking' + '.'.repeat(dots) : 'This is the move', 676, 186, 26, GOLD, UI, 600, 'right');
      }
    } else {
      panel(30, 152, 660, 186, 0.9, 20);
      if (lessonScene) fitText(LESSONS[state.lesson.i].text, 360, 164, 600, 164, 27 * big, PAPER);
      else fitText(state.pz.status === 'solved' ? 'Solved! You found the mate. A new puzzle arrives tomorrow; practice with "Another puzzle".' : `You play the bottom pieces and must give checkmate in ${state.pz.pz.n === 1 ? 'one move' : 'three moves'}. Every attacking move is a check. Pieces on your stand can be dropped.`, 360, 164, 600, 164, 27 * big, PAPER);
    }
    drawStand('bot', bs);

    // the board
    drawBoard(ctx, n);
    // coordinates on the margin of the slab
    ctx.fillStyle = 'rgba(48,28,8,0.75)';
    for (let i = 0; i < n; i++) {
      const cx = g.gx + (i + 0.5) * g.cell, r = flip ? n - 1 - i : i, c = flip ? i + 1 : n - i;
      text(String(c), cx, g.gy - 9, 21, 'rgba(48,28,8,0.72)', DISPLAY, 700);
      // rank letters: the kanji numerals 一..九 in 日本語 mode, plain 1..9 in English (a board label, so it
      // follows the language choice too; the file numbers above are already plain digits in both modes).
      text(lang === 'en' ? String(r + 1) : RANKS[r], g.gx + g.gw + 15, g.gy + (i + 0.5) * g.cell + 8, 20, 'rgba(48,28,8,0.72)', lang === 'en' ? DISPLAY : JP, 700);
    }
    const sq = (i) => sqCenter(g, i, flip);
    const rect = (i, inset = 2) => { const p = sq(i); return [p.x - cell / 2 + inset, p.y - cell / 2 + inset, cell - inset * 2, cell - inset * 2]; };

    // last move
    if (state.lastMove !== null && scene === 'play') {
      const m = state.lastMove;
      ctx.fillStyle = 'rgba(200,100,30,0.26)';
      if (!isDrop(m)) { const r = rect(mFrom(m)); ctx.fillRect(...r); }
      const r2 = rect(mTo(m)); ctx.fillRect(...r2); ctx.strokeStyle = 'rgba(190,80,20,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(...r2);
    }
    // lesson marks
    if (lessonScene && !state.lesson.done) for (const [r, c] of LESSONS[state.lesson.i].mark) {
      const p = sq(r * n + c), pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 4);
      ctx.strokeStyle = `rgba(192,57,43,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6, 8); ctx.stroke();
      ctx.fillStyle = `rgba(192,57,43,${0.10 + 0.14 * pulse})`; ctx.fill();
    }
    // check
    for (const s of [0, 1]) if (pos.kings[s] >= 0 && !state.result && inCheck(pos, s)) {
      const p = sq(pos.kings[s]), pulse = calm ? 0.6 : 0.6 + 0.4 * Math.sin(t * 7);
      const gl = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, cell * 0.85); gl.addColorStop(0, `rgba(230,50,30,${0.55 * pulse + 0.15})`); gl.addColorStop(1, 'rgba(230,50,30,0)');
      ctx.fillStyle = gl; ctx.fillRect(p.x - cell, p.y - cell, cell * 2, cell * 2);
    }
    // selection
    if (state.sel && state.sel.sq !== undefined) {
      const r = rect(state.sel.sq); ctx.fillStyle = 'rgba(255,214,110,0.5)'; ctx.fillRect(...r); ctx.strokeStyle = 'rgba(255,190,60,0.95)'; ctx.lineWidth = 3; ctx.strokeRect(...r);
    }
    // legal points
    for (const to of state.targets) {
      const p = sq(to), c = pos.b[to], pulse = calm ? 0.6 : 0.6 + 0.4 * Math.sin(t * 5 + to);
      if (c) {
        ctx.strokeStyle = `rgba(226,70,40,${0.65 + 0.3 * pulse})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6, 8); ctx.stroke();
        ctx.fillStyle = 'rgba(226,70,40,0.22)'; ctx.fill();
      } else {
        const gl = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, cell * 0.3); gl.addColorStop(0, `rgba(255,236,150,${0.95 * pulse})`); gl.addColorStop(0.55, `rgba(240,170,50,${0.55 * pulse})`); gl.addColorStop(1, 'rgba(240,170,50,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.3, 0, TAU); ctx.fill();
      }
    }
    // Auto Play's REVEAL phase: every legal destination for the piece about to move is drawn above
    // (the loop just before this one, same as a normal selection) - this ring marks the ONE the
    // engine is actually about to play, distinctly (bright cyan-white, not the gold/red of the rest),
    // so the viewer can compare their own guess against the real move before it happens.
    if (autoScene && state.autoPhase === 'reveal' && state.autoChosenTo >= 0) {
      const p = sq(state.autoChosenTo), pulse = calm ? 0.75 : 0.65 + 0.35 * Math.sin(t * 7);
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(120,220,255,${0.55 * pulse})`; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.85 + 0.15 * pulse})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // hint
    if (state.hint) {
      const m = state.hint.m, pulse = calm ? 0.7 : 0.6 + 0.4 * Math.sin(t * 6), tt = sq(mTo(m));
      ctx.strokeStyle = `rgba(255,224,110,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(tt.x - cell / 2 + 2, tt.y - cell / 2 + 2, cell - 4, cell - 4, 8); ctx.stroke();
      if (!isDrop(m)) {
        const ff = sq(mFrom(m)); ctx.beginPath(); ctx.roundRect(ff.x - cell / 2 + 2, ff.y - cell / 2 + 2, cell - 4, cell - 4, 8); ctx.stroke();
        ctx.setLineDash([10, 9]); ctx.lineDashOffset = -T * 30; ctx.beginPath(); ctx.moveTo(ff.x, ff.y); ctx.lineTo(tt.x, tt.y); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // keyboard cursor
    if (state.kb) { const r = rect(state.cursor, 5); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2.5; ctx.strokeRect(...r); ctx.setLineDash([]); }

    // pieces
    const a = state.anim;
    for (let i = 0; i < pos.b.length; i++) {
      const c = pos.b[i];
      if (!c) continue;
      if (a && a.kind !== 'refuse' && a.to === i) continue;          // drawn by the animation
      if (a && a.kind === 'refuse' && a.from === i) continue;
      const p = sq(i), owner = c >> 4, tt = c & 15, lifted = state.sel && state.sel.sq === i;
      if (lifted) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 24, cell * 0.3, cell * 0.11, 0, 0, TAU); ctx.fill(); }
      drawPiece(ctx, tt, owner, owner === bs ? 0 : 1, p.x, p.y - 1 - (lifted ? 8 : 0), ps * (lifted ? 1.08 : 1), pieceOpts(tt));
    }
    if (a) drawAnim(a, ps);
    // a thin veil where the board is not yours to touch (computer thinking) is unnecessary: the dots say it

    // message panel
    drawMessage();
  }

  function drawAnim(a, ps) {
    const g = G, pos = state.game, bs = bottomSide, n = g.n;
    const lab = state.prefs.labels ? LETTER[a.cell & 15] : undefined;
    const mdur = a.cap ? 0.22 : a.dur, f = Math.min(1, a.t / mdur), e = ease(f);
    const to = sqCenter(g, a.to, flip);
    if (a.kind === 'refuse') {
      const from = a.from >= 0 ? sqCenter(g, a.from, flip) : standSlot(a.by === bs ? 'bot' : 'top', Math.max(0, STAND_ORDER.indexOf(a.cell & 15)));
      const ff = Math.min(1, a.t / a.dur), out = ff < 0.38 ? ff / 0.38 : ff < 0.62 ? 1 : 1 - (ff - 0.62) / 0.38, oe = ease(out) * 0.62;
      const shake = calm ? 0 : ff >= 0.34 && ff < 0.66 ? Math.sin(ff * 100) * 5 : 0;
      const x = from.x + (to.x - from.x) * oe + shake, y = from.y + (to.y - from.y) * oe;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 22, g.cell * 0.28, g.cell * 0.1, 0, 0, TAU); ctx.fill();
      drawPiece(ctx, a.cell & 15, a.by, a.by === bs ? 0 : 1, x, y - 8, ps * (a.from >= 0 ? 1.06 : 0.9), { label: lab, lang });
      // a small red x at the refused point
      ctx.strokeStyle = `rgba(226,70,40,${0.9 * (1 - Math.abs(ff - 0.5) * 1.4)})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(to.x - 14, to.y - 14); ctx.lineTo(to.x + 14, to.y + 14); ctx.moveTo(to.x + 14, to.y - 14); ctx.lineTo(to.x - 14, to.y + 14); ctx.stroke();
      return;
    }
    let from, scale0 = ps;
    if (a.kind === 'drop') { from = standSlot(a.by === bs ? 'bot' : 'top', Math.max(0, STAND_ORDER.indexOf(a.cell & 15))); scale0 = 0.42; } else from = sqCenter(g, a.from, flip);
    const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e, lift = Math.sin(Math.PI * f) * 12 * (calm ? 0.4 : 1);
    ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - Math.abs(f - 0.5) * 0.6)})`; ctx.beginPath(); ctx.ellipse(x + 4, y + 22, g.cell * 0.3, g.cell * 0.11, 0, 0, TAU); ctx.fill();
    const settle = f >= 1 && !calm ? 1 + 0.06 * Math.sin(Math.min(1, (a.t - mdur) / 0.14) * Math.PI) : 1;
    const tt = a.promo && f > 0.75 ? (a.cell & 15) + 8 : a.cell & 15;
    drawPiece(ctx, tt, a.by, a.by === bs ? 0 : 1, x, y - 1 - lift, (scale0 + (ps - scale0) * e) * (1 + 0.06 * Math.sin(Math.PI * f)) * settle, { label: lab, lang });
    if (a.promo && f > 0.75 && !calm) { ctx.strokeStyle = `rgba(255,120,80,${1 - (f - 0.75) * 4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(to.x, to.y, g.cell * (0.35 + (f - 0.75) * 1.2), 0, TAU); ctx.stroke(); }
    // the captured piece flies to the capturer's stand
    if (a.cap && a.t > 0.12) {
      const cf = Math.min(1, (a.t - 0.12) / (a.dur - 0.12)), ce = ease(cf), capT = base(a.cap & 15);
      const idx = STAND_ORDER.indexOf(capT), dst = standSlot(a.by === bs ? 'bot' : 'top', idx);
      const cx = to.x + (dst.x - to.x) * ce, cy = to.y + (dst.y - to.y) * ce - Math.sin(Math.PI * cf) * 40;
      drawPiece(ctx, capT, a.by, a.by === bs ? 0 : 1, cx, cy, ps + (0.42 - ps) * ce, { alpha: 1 - 0 * cf, lang });
    }
  }

  function drawMessage() {
    const y = 1206, hh = 128;
    panel(30, y, 660, hh, 0.72, 20);
    let s = state.msg && (state.msg.t < state.msg.hold + 0.001) ? state.msg.text : null;
    if (!s) {
      s = state.result ? '' : state.thinking ? 'The computer is thinking…' : scene === 'lesson' ? LESSONS[state.lesson.i].how : scene === 'puzzle' ? 'Your move: find the check that wins.' : state.two ? `${state.game.turn === 0 ? 'Sente' : 'Gote'} to move.` : 'Your move. TAP a piece.';
    }
    const a = state.msg && state.msg.t < 0.25 ? 0.6 + state.msg.t * 1.6 : 1;
    ctx.globalAlpha = a; fitText(s, 360, y + 12, 610, hh - 18, 30 * big, state.result ? GOLD : PAPER); ctx.globalAlpha = 1;
  }

  function drawPromo() {
    dim(0.7);
    const pr = state.promo, tt = pr.piece;
    text('Promote?', 360, 470, 84, GOLD, DISPLAY, 700);
    fitText(`Your ${NAME[tt].toLowerCase()} may promote and become a ${NAME[tt + 8].toLowerCase()}: stronger, and its character turns red. A promoted piece can never change back.`, 360, 500, 560, 120, 28, PAPER);
    for (const b of buttons) if (b.kind === 'promo') {
      panel(b.x, b.y, b.w, b.h, 0.9, 22);
      const yes = b.id === 'promoYes', pieceT = yes ? tt + 8 : tt;
      if (yes) { const gl = ctx.createRadialGradient(b.x + b.w / 2, b.y + 130, 10, b.x + b.w / 2, b.y + 130, 150); gl.addColorStop(0, 'rgba(255,120,80,0.35)'); gl.addColorStop(1, 'rgba(255,120,80,0)'); ctx.fillStyle = gl; ctx.fillRect(b.x, b.y, b.w, 260); }
      drawPiece(ctx, pieceT, pr.owner, pr.owner === bottomSide ? 0 : 1, b.x + b.w / 2, b.y + 132 + (calm ? 0 : Math.sin(t * 2 + (yes ? 0 : 2)) * 4), 1.1, pieceOpts(pieceT));
      text(yes ? 'Promote' : 'Keep', b.x + b.w / 2, b.y + 268, 40, yes ? '#ffb8a8' : PAPER, DISPLAY, 700);
      text(yes ? NAME[pieceT] : NAME[pieceT], b.x + b.w / 2, b.y + 302, 22, 'rgba(247,236,210,0.7)', UI, 500);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// ambient life
function petals(ctx, T) {
  for (let i = 0; i < 16; i++) {
    const sp = 22 + (i * 7) % 19, x0 = (i * 137) % W, ph = i * 1.7;
    const x = ((x0 + Math.sin(T * 0.5 + ph) * 34 + T * 8) % (W + 40) + (W + 40)) % (W + 40) - 20, y = ((i * 211 + T * sp) % (H + 80)) - 40;
    ctx.save(); ctx.translate(x, y); ctx.rotate(T * 0.6 + ph); ctx.scale(1, 0.62 + 0.38 * Math.sin(T * 1.4 + ph));
    ctx.fillStyle = `rgba(255,${176 + (i % 4) * 12},${190 + (i % 3) * 14},${0.34 + (i % 3) * 0.07})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 7 + (i % 3), 4, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
}
function lantern(ctx, x, y, s, T, ph) {
  const sw = Math.sin(T * 0.9 + ph) * 0.05, fl = 0.85 + 0.15 * Math.sin(T * 3.1 + ph * 2);
  ctx.save(); ctx.translate(x, 0);
  ctx.strokeStyle = 'rgba(30,18,8,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, y); ctx.stroke();
  ctx.translate(0, y); ctx.rotate(sw);
  const glow = ctx.createRadialGradient(0, 60 * s, 8, 0, 60 * s, 190 * s); glow.addColorStop(0, `rgba(255,190,100,${0.5 * fl})`); glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(-200 * s, -140 * s, 400 * s, 400 * s);
  const body = ctx.createRadialGradient(-8 * s, 56 * s, 6, 0, 60 * s, 52 * s); body.addColorStop(0, `rgba(255,${228 * fl | 0},150,1)`); body.addColorStop(0.65, '#f08a3a'); body.addColorStop(1, '#a8391a');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 62 * s, 40 * s, 52 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,40,10,0.55)'; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, 62 * s, Math.abs(i) * 16 * s + 1, 52 * s, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#20120a'; ctx.beginPath(); ctx.roundRect(-22 * s, 6 * s, 44 * s, 12 * s, 4); ctx.fill(); ctx.beginPath(); ctx.roundRect(-22 * s, 104 * s, 44 * s, 12 * s, 4); ctx.fill();
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 116 * s); ctx.lineTo(0, 150 * s + Math.sin(T * 2 + ph) * 3); ctx.stroke();
  ctx.restore();
}
