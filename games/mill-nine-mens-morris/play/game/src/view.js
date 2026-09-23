// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js, pieces.js).
import { W, H, pointAt, PIECE_R, UNIT, BTN, LOOK, TITLE_BOARD, titleRows, rackPos, RACK } from './layout.js';
import { drawRoom, drawBoard, CANDLES, WOOD_NAMES } from './art.js';
import { drawMan, blob, SET_NAMES } from './pieces.js';
import { unlocked } from './unlocks.js';
import { legalMoves, MILLS, MILL_IDX, NONE, NAMES, bit, pop, placing, flying, openTwos, takeable, mvFrom, mvTo } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { puzzleText } from './puzzles.js';
import { ABOUT, HOW, RULES } from './text.js';

const TITLEF = 'Cinzel, "Trajan Pro", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const ORDER = Array.from({ length: 24 }, (_, i) => i).sort((a, b) => pointAt(a).y - pointAt(b).y);

// the position as the player sees it right now (a chosen-but-not-finished mill move is already on the board)
export function shown(state) {
  const g = state.game, p = g.p.slice(), hand = g.hand.slice(), pd = state.pend;
  if (pd) { const me = g.turn; if (pd.from === NONE) hand[me]--; else p[me] &= ~bit(pd.from); p[me] |= bit(pd.to); }
  return { p, hand };
}

export function render(ctx, state) {
  const t = state.t, scene = state.scene, calm = state.calm, set = state.look.set, big = state.look.big;
  const g = state.game, a = state.anim;
  const text = (str, x, y, size, color = '#f6e3b4', font = TITLEF, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrapLines = (str, size, maxW, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); return lines;
  };
  const wrap = (str, x, y, size, maxW, color = '#f6e3b4', lh = size * 1.32, align = 'center', weight = 600) => { const ls = wrapLines(str, size, maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  const plaque = (x, y, w, h, alpha = 0.78) => {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(x + 4, y + 8, w, h, 20); ctx.fill();
    const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, `rgba(58,36,20,${alpha + 0.15})`); gr.addColorStop(1, `rgba(28,16,8,${alpha + 0.15})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(232,190,110,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 15); ctx.stroke(); ctx.restore();
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 7, r.w, r.h, 16); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    gr.addColorStop(0, o.primary ? '#f6d888' : '#8a5a2c'); gr.addColorStop(0.55, o.primary ? '#d6a442' : '#5e3a1a'); gr.addColorStop(1, o.primary ? '#a8741c' : '#3a2010');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.8)' : 'rgba(240,200,130,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 11); ctx.stroke();
    const size = o.size ?? (r.h > 70 ? 28 : 24);
    text(label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.34, size, o.primary ? '#2a1606' : '#f6e3b4', TITLEF, 700);
    ctx.restore();
  };
  const candles = () => {
    // warm light from both candles, gently alive
    for (let k = 0; k < CANDLES.length; k++) {
      const c = CANDLES[k], fl = calm ? 0 : Math.sin(t * 9.1 + k * 2) * 0.5 + Math.sin(t * 15.7 + k) * 0.5, sway = calm ? 0 : Math.sin(t * 3.3 + k) * 1.6;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      blob(ctx, c.x, c.top - 20, 340 + fl * 14, 300 + fl * 12, '255,170,80', 0.34 + fl * 0.04);
      blob(ctx, c.x, c.top - 16, 90, 90, '255,210,130', 0.5 + fl * 0.06);
      ctx.restore();
      const fx = c.x + sway, fy = c.top - 8, fh = 38 + fl * 4;
      const fg = ctx.createRadialGradient(fx, fy - 10, 1, fx, fy - 12, 22); fg.addColorStop(0, '#fffbe0'); fg.addColorStop(0.35, '#ffd66a'); fg.addColorStop(1, 'rgba(255,120,20,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(fx, fy - fh); ctx.bezierCurveTo(fx + 15, fy - fh * 0.45, fx + 12, fy, fx, fy + 2); ctx.bezierCurveTo(fx - 12, fy, fx - 15, fy - fh * 0.45, fx, fy - fh); ctx.fill();
    }
    if (!calm) for (let i = 0; i < 16; i++) {        // dust drifting in the candle light
      const x = 60 + ((i * 97 + t * (6 + (i % 5))) % 600), y = 250 + ((i * 53 + Math.sin(t * 0.6 + i) * 30) % 760);
      ctx.fillStyle = `rgba(255,220,160,${0.10 + 0.08 * Math.sin(t * 2 + i)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3) * 0.7, 0, TAU); ctx.fill();
    }
  };
  const vignette = () => { const v = ctx.createRadialGradient(360, 780, 330, 360, 780, 980); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,2,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); };

  drawRoom(ctx);
  candles();

  // ---- scene that shows the whole tavern menu -----------------------------------------------------
  if (scene === 'title' || scene === 'look' || scene === 'demo-limit') { vignette(); drawTitleLike(); return; }
  if (scene === 'about' || scene === 'how') { vignette(); drawPage(); return; }
  if (scene === 'rules') { vignette(); drawRulesPage(); return; }

  // ---- board scenes -------------------------------------------------------------------------------
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making');
  if (!boardScene) { text('Setting the puzzle…', 360, 700, 40); vignette(); return; }
  drawBoard(ctx, state.look.wood);
  drawPieces(ctx, state, { hidden: a && a.mv && a.t < a.moveDur ? a.to : -1 });
  vignette();
  drawHud();
  drawBottom();
  return;

  // ==========================================================================================
  function drawTitleLike() {
    if (scene === 'title') {
      const T = TITLE_BOARD, k = T.k;
      // a demo game plays itself on a small board
      ctx.save(); ctx.translate(T.tx, T.ty); ctx.scale(k, k); ctx.translate(-T.cx, -T.cy);
      drawBoard(ctx, state.look.wood);
      drawPieces(ctx, { ...state, game: state.demo.g, pend: null, anim: null, sel: -1, hint: null, take: null, kb: false, scene: 'title', demo: state.demo }, { pop: state.demo });
      ctx.restore();
      // title block
      const bob = calm ? 0 : Math.sin(t * 1.4) * 3;
      text("NINE MEN'S", 360, 150 + bob, 78, '#f9e6b0'); text('MORRIS', 360, 250 + bob, 104, '#f2c766');
      ctx.fillStyle = '#c99a44'; ctx.fillRect(160, 282, 400, 3); ctx.fillStyle = '#f2c766'; ctx.beginPath(); ctx.moveTo(360, 274); ctx.lineTo(370, 283.5); ctx.lineTo(360, 293); ctx.lineTo(350, 283.5); ctx.fill();
      text('THE MILL GAME OF EUROPE', 360, 336, 24, '#e6c98c', UI, 600);
      const R = titleRows(!!state.saved), lvl = LEVELS[state.level];
      if (R.resume) button(R.resume, 'Resume game', { primary: true });
      button(R.learn, state.learned ? 'Learn to play' : 'Learn to play', { primary: !R.resume && !state.learned });
      button(R.play, `Play the computer`, { primary: !R.resume && state.learned });
      button(R.two, 'Two players');
      button(R.daily, state.daily.solvedDay === state.daily.day ? `Puzzle of the day  ✓  ${state.daily.streak}` : 'Puzzle of the day', { });
      button(R.level, lvl.name, { size: 21 }); button(R.side, state.humanSide === 1 ? 'You: Dark' : 'You: Light', { size: 21 });
      button(R.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 21 }); button(R.calm, state.calm ? 'Calm: on' : 'Calm: off', { size: 21 });
      button(R.look, 'Board & men', { size: 21 }); button(R.big, big ? 'Large text: on' : 'Large text', { size: 21 });
      // This row grew from 2 columns (About/How) to 3 (About/How/Rules) to fit the new Rules button,
      // so labels shrink to fit the narrower columns - same buttons, same destinations, just smaller text.
      button(R.about, 'About', { size: 17 }); button(R.how, 'How to play', { size: 15 }); button(R.rules, 'Rules', { size: 17 });
      if (state.msg) { plaque(60, 350, 600, 92); wrap(state.msg.text, 360, 392, 26, 540, '#f6e3b4'); }
      text(lvl.note, 360, 1546, 18, 'rgba(240,215,160,0.7)', UI, 500);
    } else if (scene === 'look') {
      plaque(50, 300, 620, 1120);
      text('Board and men', 360, 380, 50);
      text('Board wood', 360, 730, 26, '#e6c98c', UI, 600);
      ['oak', 'walnut', 'ash'].forEach((w, i) => { const r = LOOK.woods[i], ok = unlocked(state, 'wood', w); button(r, WOOD_NAMES[w], { primary: state.look.wood === w, dim: !ok, size: 21 }); if (!ok) text('locked', r.x + r.w / 2, r.y + r.h + 22, 17, '#b89a68', UI, 600); });
      text('Men', 360, 910, 26, '#e6c98c', UI, 600);
      ['boxwood', 'ivory'].forEach((s, i) => { const r = LOOK.sets[i], ok = unlocked(state, 'set', s); button(r, SET_NAMES[s].split(' and ')[0] + ' & ' + SET_NAMES[s].split(' and ')[1], { primary: state.look.set === s, dim: !ok, size: 18 }); if (!ok) text('locked', r.x + r.w / 2, r.y + r.h + 22, 17, '#b89a68', UI, 600); });
      for (let s = 0; s < 2; s++) for (let i = 0; i < 2; i++) drawMan(ctx, 250 + i * 220, 1130 + s * 0, 34, i, state.look.set, {});
      button(LOOK.marks, state.marks ? 'Warnings: on' : 'Warnings: off', { size: 21 });
      text('Warnings ring the point where the enemy could make a mill.', 360, 1352, 19, '#cfae74', UI, 500);
      if (state.msg) wrap(state.msg.text, 360, 1400, 22, 560, '#f6e3b4');
      button(LOOK.back, 'Back', { primary: true });
    } else {
      plaque(50, 480, 620, 500);
      text('Free preview finished', 360, 570, 42); wrap('You have played the two games of the web preview. The full game, with every level, all ten lessons and the daily puzzle, is on iPhone and Android.', 360, 640, 28, 540);
      button({ x: 140, y: 880, w: 440, h: 76 }, 'Back');
    }
  }
  function drawPage() {
    const rows = scene === 'about' ? ABOUT : HOW, title = scene === 'about' ? "About Nine Men's Morris" : 'How to play';
    plaque(30, 130, 660, 1330, 0.85);
    text(title, 360, 210, scene === 'about' ? 42 : 52);
    let y = 268; const fs = big ? 27 : 23, lh = fs * 1.34;
    for (const [head, body] of rows) {
      text(head.toUpperCase(), 66, y, 20, '#f2c766', TITLEF, 700, 'left'); y += 8 + lh * 0.85;
      const n = wrap(body, 66, y, fs, 590, '#f0dcae', lh, 'left'); y += n * lh + 20;
    }
    button(BTN.pageBack, 'Back', { primary: true });
  }
  // Rules: a small paginated reference (About/How are each one static page with only a Back button -
  // this game had no Back/Next pagination anywhere before Rules, since Rules needs to fit far more
  // content than either of those, this is the closest equivalent to the Back/Next/"Page N of M"
  // convention other games in this batch use).
  function drawRulesPage() {
    const page = RULES[state.rulesPage % RULES.length];
    plaque(30, 130, 660, 1330, 0.85);
    text('Rules', 360, 210, 44);
    text(page.title.toUpperCase(), 360, 268, 24, '#f2c766', TITLEF, 700);
    let y = 316;
    if (page.piece) {
      const py = y + 66, dx = 110, r = 46;
      drawMan(ctx, 360 - dx, py, r, 0, set, {});
      drawMan(ctx, 360 + dx, py, r, 1, set, {});
      text('Light', 360 - dx, py + r + 26, 17, 'rgba(240,220,180,0.75)', UI, 600);
      text('Dark', 360 + dx, py + r + 26, 17, 'rgba(240,220,180,0.75)', UI, 600);
      y = py + r + 56;
    }
    const fs = big ? 24 : 21, lh = fs * 1.34;
    for (const line of page.lines) { const n = wrap(line, 360, y, fs, 600, '#f0dcae', lh, 'center', 500); y += n * lh + 16; }
    text(`Page ${(state.rulesPage % RULES.length) + 1} of ${RULES.length}`, 360, 1372, 18, 'rgba(240,215,160,0.65)', UI, 500);
    button(BTN.rulesBack, 'Back', { primary: true });
    button(BTN.rulesNext, 'Next', { primary: true });
  }
  function drawHud() {
    if (scene === 'over') { drawOver(); return; }
    let head = '', sub = '';
    const who = (s) => NAMES[s];
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i];
      head = `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`; sub = state.lesson.done ? 'Well done. TAP Next.' : l.text;
      const fs = big ? 30 : 26, n = wrapLines(sub, fs, 600).length; plaque(24, 120, 672, 200 + n * fs * 1.32);
      text(head, 360, 186, 32, '#f2c766'); text(l.title, 360, 244, 46); wrap(sub, 360, 296, fs, 600, '#f6e3b4', fs * 1.32);
    } else if (scene === 'puzzle') {
      const fs = big ? 32 : 28, str = state.msg?.text ?? (state.pz.status === 'solved' ? 'Solved. Come back tomorrow for the next one.' : puzzleText(state.pz.puzzle)), n = wrapLines(str, fs, 600).length;
      plaque(24, 120, 672, 170 + n * fs * 1.32); text('Puzzle of the day', 360, 192, 44); wrap(str, 360, 248, fs, 600, '#f6e3b4');
      if (state.pz.status !== 'solved') text(`Streak ${state.daily.streak}`, 360, 120 + 170 + n * fs * 1.32 - 22, 20, '#c9a35a', UI, 600);
    } else {
      const phase = placing(g) ? 'Placing men' : flying(g, g.turn) ? 'Flying' : 'Sliding men';
      const me = g.turn, human = state.two || me === state.human;
      head = state.two ? `${who(me)} to move` : human ? 'Your move' : `${who(me)} is thinking`;
      const fs = big ? 32 : 27, str = state.msg?.text ?? defaultLine(), n = wrapLines(str, fs, 610).length;
      plaque(24, 120, 672, 190 + n * fs * 1.32);
      text(head + (state.thinking && !calm ? '.'.repeat(1 + Math.floor(t * 3) % 3) : ''), 360, 190, 52, me === 0 ? '#fff0c4' : '#c7a58a');
      text(phase.toUpperCase(), 360, 232, 21, '#c9a35a', UI, 600);
      wrap(str, 360, 292, fs, 610, '#f6e3b4', fs * 1.32);
    }
  }
  function defaultLine() {
    const me = g.turn, human = state.two || me === state.human;
    if (!human) return `${LEVELS[state.level].name} is choosing a move.`;
    if (state.pend) return 'A mill! TAP a glowing red man to take it.';
    if (placing(g)) { const n = g.hand[me]; return `TAP an empty point to place a man. ${n} ${n === 1 ? 'man' : 'men'} to place.`; }
    if (flying(g, me)) return 'You have three men: you can FLY. TAP a man, then TAP any empty point.';
    return state.sel >= 0 ? 'TAP a glowing point to slide the man there.' : 'TAP one of your men, then TAP a glowing point beside it.';
  }
  function drawOver() {
    plaque(60, 440, 600, 440);
    const w = g.winner, humanWon = w === state.human && !state.two;
    const head = w === 'draw' ? 'A draw' : state.two ? `${NAMES[w]} wins` : humanWon ? 'You win' : `${NAMES[w]} wins`;
    text(head, 360, 550, 78, w === 'draw' ? '#e6c98c' : '#f2c766'); ctx.fillStyle = '#c99a44'; ctx.fillRect(200, 574, 320, 3);
    wrap(g.reason, 360, 640, 28, 500); wrap(w === 'draw' ? 'Perfect play from both sides is a draw, so this is a good result.' : humanWon ? 'Well played. A stronger level awaits.' : 'Try again, or ask for a Hint.', 360, 740, 24, 500, '#cfae74');
    button(BTN.again, 'Play again', { primary: true }); button(BTN.back, 'Menu'); button(BTN.share, 'Share');
  }
  function drawBottom() {
    if (scene === 'over') return;
    if (scene === 'lesson') {
      button(BTN.menu, 'Menu');
      if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true }); else button(BTN.show, 'Show me');
      return;
    }
    if (scene === 'puzzle') {
      button(BTN.menu, 'Menu'); if (state.pz.status === 'solved') button(BTN.share, 'Share', { }); return;
    }
    button(BTN.menu, 'Menu'); button(BTN.undo, 'Undo', { dim: !state.undo.length }); button(BTN.hint, `Hint ${state.hintsLeft}`, { dim: state.hintsLeft <= 0 });
  }
}

// ==========================================================================================
// The men, racks and marks on the board. opts.hidden = a point whose man is drawn by the moving animation instead.
function drawPieces(ctx, state, opts = {}) {
  const t = state.t, calm = state.calm, set = state.look.set, g = state.game, a = state.anim, scene = state.scene;
  const { p, hand } = shown(state), me = g.turn, human = state.two || me === state.human;
  const R = PIECE_R;
  const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5);
  const onTitle = scene === 'title';
  const bottomSide = state.two ? 0 : state.human, topSide = 1 - bottomSide;
  const glow = (i, rgb, alpha) => { const q = pointAt(i); blob(ctx, q.x, q.y, 62 * q.s * UNIT, 50 * q.s * UNIT, rgb, Math.min(1, alpha + 0.15)); };
  const ring = (i, rgb, alpha, rad = 26, dash = false, lw = 3) => { const q = pointAt(i); ctx.save(); ctx.strokeStyle = `rgba(${rgb},${alpha})`; ctx.lineWidth = lw * q.s; if (dash) ctx.setLineDash?.([7, 6]); ctx.beginPath(); ctx.ellipse(q.x, q.y, rad * q.s * UNIT, rad * 0.86 * q.s * UNIT, 0, 0, TAU); ctx.stroke(); ctx.restore(); };

  // brass mill bars for the mills standing on the board
  for (let s = 0; s < 2; s++) for (let i = 0; i < 16; i++) if ((p[s] & MILLS[i]) === MILLS[i]) {
    const [x, y, z] = MILL_IDX[i], A = pointAt(x), C = pointAt(z);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,200,90,${0.16 + pulse * 0.12})`; ctx.lineWidth = 15 * A.s * UNIT; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,140,0.72)'; ctx.lineWidth = 4.2 * A.s * UNIT; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y); ctx.stroke(); ctx.restore();
  }

  const interactive = !onTitle && (scene === 'play' || scene === 'lesson' || scene === 'puzzle') && !a && human && g.winner === null;
  // legal destinations, take targets, hint, threats
  if (interactive) {
    if (state.pend) { /* the take targets are drawn over the men, below */ }
    else if (placing(g)) { for (let i = 0; i < 24; i++) if (!((p[0] | p[1]) & bit(i))) ring(i, '255,224,140', 0.32 + pulse * 0.22, 21, false, 2.6); }
    else if (state.sel >= 0) { for (const m of legalMoves(g, [])) if (mvFrom(m) === state.sel) { const i = mvTo(m); glow(i, '255,210,110', 0.55 + pulse * 0.3); ring(i, '255,238,170', 0.95, 24, false, 3.5); } }
    if (state.marks && !state.pend) for (const i of openTwos(g, 1 - me)) ring(i, '255,90,70', 0.35 + pulse * 0.45, 30, true, 3);
    if (state.hint) { const h = state.hint; for (const i of [h.from, h.to]) if (i >= 0 && i < 24) { glow(i, '120,230,255', 0.5 + pulse * 0.4); ring(i, '170,240,255', 0.95, 30, false, 4); } }
    if (state.show) for (const i of state.show) { glow(i, '120,230,255', 0.5 + pulse * 0.4); ring(i, '170,240,255', 0.95, 30, false, 4); }
  }
  // last move marker
  if (!onTitle && g.plies && state.lastTo >= 0 && !state.pend) ring(state.lastTo, '255,255,255', 0.28, 33, false, 2);

  // racks: carved trays with the men still to place
  if (!onTitle) {
    for (const [which, side] of [['top', topSide], ['bottom', bottomSide]]) {
      const y = RACK[which].y, gr = ctx.createLinearGradient(0, y - 34, 0, y + 34); gr.addColorStop(0, 'rgba(24,12,4,0.85)'); gr.addColorStop(1, 'rgba(70,40,18,0.85)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(112, y - 36, 496, 72, 34); ctx.fill(); ctx.strokeStyle = 'rgba(240,200,130,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      for (let k = 0; k < 9; k++) { const q = rackPos(which, k); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 8, 24, 19, 0, 0, TAU); ctx.fill(); }
      for (let k = 0; k < hand[side]; k++) { const q = rackPos(which, k); drawMan(ctx, q.x, q.y + 6, 27, side, set, {}); }
      const onBoard = pop(p[side]);
      ctx.textAlign = 'center'; ctx.font = `600 21px ${UI}`; ctx.fillStyle = 'rgba(246,227,180,0.85)';
      const nm = state.two || scene === 'lesson' || scene === 'puzzle' ? NAMES[side] : (side === state.human ? 'You' : 'Computer') + ` (${NAMES[side]})`;
      ctx.fillText(`${nm}: ${hand[side] + onBoard} men`, 360, which === 'top' ? y - 46 : y + 62);
    }
  }
  // the men on the board, far to near
  const dm = opts.pop;
  for (const i of ORDER) {
    if (i === opts.hidden) continue;
    const side = p[0] & bit(i) ? 0 : p[1] & bit(i) ? 1 : -1; if (side < 0) continue;
    const q = pointAt(i);
    let o = { }; const sel = state.sel === i && !onTitle;
    if (sel) { o.lift = 0.5 + (calm ? 0 : 0.06 * Math.sin(t * 6)); o.selected = true; }
    if (dm && dm.last === i) { const f = Math.min(1, dm.since / 0.3); o.scale = 0.6 + 0.4 * f * (2 - f); o.lift = (1 - f) * 0.9; }
    if (state.drag && state.drag.i === i && state.drag.moved) continue;
    drawMan(ctx, q.x, q.y, R * q.s, side, set, o);
    if (state.kb && state.cursor === i && !onTitle) { }
  }
  if (interactive && state.pend) {
    const tk = takeable(g, me);
    for (let i = 0; i < 24; i++) if (tk & bit(i)) {
      const q = pointAt(i); ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, q.x, q.y - 6, 62 * q.s, 52 * q.s, '255,50,30', 0.55 + pulse * 0.4); ctx.restore();
      ring(i, '255,120,100', 0.95, 40, false, 4);
    }
  }
  // the man being dragged follows the pointer
  if (state.drag && state.drag.moved) { const s = g.turn; drawMan(ctx, state.drag.x, state.drag.y + 6, R * 1.05, s, set, { lift: 1, selected: true }); }
  // the man that is moving, and the man being taken
  if (a) {
    const f = a.moveDur > 0 ? Math.min(1, a.t / a.moveDur) : 1, e = f * f * (3 - 2 * f), to = pointAt(a.to);
    if (a.mv && a.t < a.moveDur) {
      const from = a.from === NONE ? rackPos(a.rack, 0) : pointAt(a.from), fs = a.from === NONE ? from.s * 0.62 : from.s;
      const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e, s = fs + (to.s - fs) * e;
      const ty = a.from === NONE ? from.y + 6 : from.y;
      drawMan(ctx, x, ty + (to.y - ty) * e, R * s, a.side, set, { lift: Math.sin(Math.PI * f) * (a.fly ? 2.2 : 0.8), selected: false });
    }
    if (a.take >= 0) {
      const tf = Math.max(0, Math.min(1, (a.t - a.moveDur - 0.05) / 0.5)), tq = pointAt(a.take), sh = calm ? 0 : Math.sin(tf * 50) * 4 * (1 - tf);
      if (tf < 1) {
        if (tf > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, tq.x, tq.y, 90 * tq.s * (0.6 + tf), 70 * tq.s * (0.6 + tf), '255,120,60', 0.6 * (1 - tf)); ctx.restore(); }
        drawMan(ctx, tq.x + sh, tq.y, R * tq.s, a.takeSide, set, { lift: tf * 1.6, alpha: 1 - tf, scale: 1 - tf * 0.3 });
      }
    }
  }
  // a refused tap: a red ring that fades
  if (state.bad) { const q = pointAt(state.bad.i), k = state.bad.t / 0.7; ctx.strokeStyle = `rgba(255,70,50,${1 - k})`; ctx.lineWidth = 5 * q.s; ctx.beginPath(); ctx.ellipse(q.x, q.y, (24 + 18 * k) * q.s * UNIT, (21 + 15 * k) * q.s * UNIT, 0, 0, TAU); ctx.stroke(); }
  // keyboard cursor
  if (state.kb && !onTitle) { const q = pointAt(state.cursor); ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = 3; const r = 34 * q.s * UNIT; ctx.strokeRect(q.x - r, q.y - r * 0.86, r * 2, r * 1.72); }
  // mill flash: the line that was just made
  if (state.flash) { const f = state.flash, k = Math.min(1, f.t / 0.9); for (const i of f.pts) { const q = pointAt(i); ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, q.x, q.y, (60 + 120 * k) * q.s, (50 + 100 * k) * q.s, '255,210,110', 0.8 * (1 - k)); ctx.restore(); } }
}
