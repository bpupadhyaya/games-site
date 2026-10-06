// Everything drawn each frame. Reads `state` (game.js) and the live layout `L` (layout.js); changes nothing but the reader's scroll
// clamp. Static art is cached (art.js, pieces.js). The board, men and racks are drawn in stage coordinates inside L.stage's transform;
// every other element (HUD, buttons, menus, reference pages) is drawn in screen units from the layout's rects.
import { host, pointAt, PIECE_R, UNIT, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawRoom, drawBoard, drawCandleBody, CANDLE_TOP, WOOD_NAMES } from './art.js';
import { drawMan, blob, SET_NAMES } from './pieces.js';
import { unlocked } from './unlocks.js';
import { legalMoves, MILLS, MILL_IDX, NONE, NAMES, bit, pop, placing, flying, openTwos, takeable, mvFrom, mvTo } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { puzzleText } from './puzzles.js';
import { ABOUT, HOW, RULES, flow } from './text.js';
import { drawCredit, drawTitleLockup, drawLockup, drawMoreLine } from './brand.js';

const TITLEF = 'Cinzel, "Trajan Pro", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const ORDER = Array.from({ length: 24 }, (_, i) => i).sort((a, b) => pointAt(a).y - pointAt(b).y);

// the position as the player sees it right now (a chosen-but-not-finished mill move is already on the board)
export function shown(state) {
  const g = state.game, p = g.p.slice(), hand = g.hand.slice(), pd = state.pend;
  if (pd) { const me = g.turn; if (pd.from === NONE) hand[me]--; else p[me] &= ~bit(pd.from); p[me] |= bit(pd.to); }
  return { p, hand };
}

// Reader layout cache (wrapped lines + total height). readerStats.layouts counts rebuilds (tests read it).
const readerCache = { key: '', list: null, items: [], endY: 0 };
export const readerStats = { layouts: 0 };

export function render(ctx, state, L) {
  const t = state.t, scene = state.scene, calm = state.calm, set = state.look.set, w = L.w, h = L.h;
  // Falls back to 1 for any out-of-range index (e.g. a save from a build with more/fewer steps).
  const textScale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = state.textScaleIdx > 0;
  const auto = scene === 'auto', D = state.auto;
  const g = auto ? D.game : state.game, a = auto ? D.anim : state.anim;
  const minS = Math.min(26, 11 / Math.max(0.3, host.px));      // ~11 css px, in virtual units
  const text = (str, x, y, size, color = '#f6e3b4', font = TITLEF, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${Math.max(size, minS)}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const widthOf = (str, size, font, weight) => { ctx.font = `${weight} ${size}px ${font}`; return ctx.measureText(str).width; };
  // a one-line text shrunk (never below ~minS) until it fits maxW
  const fitText = (str, x, y, size, maxW, color, font = TITLEF, weight = 700, align = 'center') => {
    let sz = Math.max(size, minS); while (sz > Math.max(minS * 0.8, 14) && widthOf(str, sz, font, weight) > maxW) sz -= 1;
    text(str, x, y, sz, color, font, weight, align);
  };
  const wrapLines = (str, size, maxW, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), lines = []; let cur = '';
    for (const wd of words) { const t2 = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t2; }
    lines.push(cur); return lines;
  };
  const wrap = (str, x, y, size, maxW, color = '#f6e3b4', lh = size * 1.32, align = 'center', weight = 600) => { size = Math.max(size, minS); lh = Math.max(lh, size * 1.2); const ls = wrapLines(str, size, maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  // text fitted into the box [y0, y1] by shrinking the font (never below ~minS); returns nothing
  const fitWrap = (str, x, y0, y1, maxW, fs0, color = '#f6e3b4', weight = 600) => {
    const fsMin = Math.max(minS, 18); let fs = Math.max(fs0, fsMin), ls = wrapLines(str, fs, maxW, weight);
    while (fs > fsMin && ls.length * fs * 1.25 > y1 - y0) { fs -= 1; ls = wrapLines(str, fs, maxW, weight); }
    ls.forEach((ln, i) => text(ln, x, y0 + fs * 0.92 + i * fs * 1.25, fs, color, UI, weight));
  };
  const plaque = (x, y, pw, ph, alpha = 0.78) => {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(x + 4, y + 8, pw, ph, 20); ctx.fill();
    const gr = ctx.createLinearGradient(0, y, 0, y + ph); gr.addColorStop(0, `rgba(58,36,20,${alpha + 0.15})`); gr.addColorStop(1, `rgba(28,16,8,${alpha + 0.15})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(232,190,110,0.55)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  };
  const plaqueR = (r, alpha) => plaque(r.x, r.y, r.w, r.h, alpha);
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 7, r.w, r.h, 16); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    gr.addColorStop(0, o.primary ? '#f6d888' : '#8a5a2c'); gr.addColorStop(0.55, o.primary ? '#d6a442' : '#5e3a1a'); gr.addColorStop(1, o.primary ? '#a8741c' : '#3a2010');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.8)' : 'rgba(240,200,130,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const size = Math.min(o.size ?? (r.h > 70 ? 28 : 24), r.h * 0.5);
    fitText(label, r.x + r.w / 2, r.y + r.h / 2 + Math.max(size, minS) * 0.34, size, r.w - 18, o.primary ? '#2a1606' : '#f6e3b4', TITLEF, 700);
    ctx.restore();
  };
  // a candlestick on the table with its flame, glow and a little drifting dust
  const candle = (c) => {
    drawCandleBody(ctx, c.x, c.y, c.s);
    const k = c.s, ci = c.x < w / 2 ? 0 : 1, fl = calm ? 0 : Math.sin(t * 9.1 + ci * 2) * 0.5 + Math.sin(t * 15.7 + ci) * 0.5, sway = calm ? 0 : Math.sin(t * 3.3 + ci) * 1.6;
    const topY = c.y + CANDLE_TOP * k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    blob(ctx, c.x, topY - 20 * k, (340 + fl * 14) * k, (300 + fl * 12) * k, '255,170,80', 0.34 + fl * 0.04);
    blob(ctx, c.x, topY - 16 * k, 90 * k, 90 * k, '255,210,130', 0.5 + fl * 0.06);
    ctx.restore();
    const fx = c.x + sway * k, fy = topY - 8 * k, fh = (38 + fl * 4) * k;
    const fg = ctx.createRadialGradient(fx, fy - 10 * k, 1, fx, fy - 12 * k, 22 * k); fg.addColorStop(0, '#fffbe0'); fg.addColorStop(0.35, '#ffd66a'); fg.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(fx, fy - fh); ctx.bezierCurveTo(fx + 15 * k, fy - fh * 0.45, fx + 12 * k, fy, fx, fy + 2 * k); ctx.bezierCurveTo(fx - 12 * k, fy, fx - 15 * k, fy - fh * 0.45, fx, fy - fh); ctx.fill();
  };
  const room = (tt, cx, candles) => {
    drawRoom(ctx, w, h, tt, cx);
    for (const c of candles) candle(c);
    if (!calm) for (let i = 0; i < 16; i++) {        // dust drifting in the candle light
      const x = (60 + ((i * 97 + t * (6 + (i % 5))) % 600)) * (w / 720), y = (250 + ((i * 53 + Math.sin(t * 0.6 + i) * 30) % 760)) * (h / 1560);
      ctx.fillStyle = `rgba(255,220,160,${0.10 + 0.08 * Math.sin(t * 2 + i)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3) * 0.7, 0, TAU); ctx.fill();
    }
  };
  const vignette = () => { const dg = Math.hypot(w, h), v = ctx.createRadialGradient(w / 2, h / 2, dg * 0.2, w / 2, h / 2, dg * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,2,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); };
  const inStage = (fn) => { const { s, tx, ty } = L.stage; ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s); fn(); ctx.restore(); };

  // ---- scenes that show the tavern menu ---------------------------------------------------------------------------------------
  if (scene === 'title' || scene === 'look' || scene === 'demo-limit') { const T = L.title(!!state.saved); room(T.tt, T.archCx, scene === 'title' ? T.candles : []); vignette(); drawTitleLike(T); return; }
  if (scene === 'about' || scene === 'how' || scene === 'rules') {
    const T = L.title(!!state.saved); room(T.tt, T.archCx, []); vignette();
    if (scene === 'about') drawRefPage(ABOUT, "About Nine Men's Morris"); else if (scene === 'how') drawRefPage(HOW, 'How to play'); else drawRefPage(RULES, 'Rules');
    return;
  }

  // ---- board scenes -----------------------------------------------------------------------------------------------------------
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'auto' || (scene === 'puzzle' && state.pz.status !== 'making');
  room(L.tt, L.archCx, L.candles);
  if (!boardScene) { text('Setting the puzzle…', w / 2, h * 0.45, 40); vignette(); return; }
  // Auto Play draws its own separate game object through the exact same drawPieces() as every other board scene, plus a REVEAL-phase
  // overlay showing every legal destination and the one about to be played. `two: true` forces the plain Light/Dark rack labels.
  const pieceState = auto ? { ...state, game: D.game, anim: D.anim, pend: null, sel: -1, hint: null, drag: null, show: null, kb: false, scene: 'auto', two: true, autoReveal: D.phase === 'reveal' ? { legal: D.moves, chosen: D.chosen } : null } : state;
  inStage(() => { drawBoard(ctx, state.look.wood); drawPieces(ctx, pieceState, L, { hidden: a && a.mv && a.t < a.moveDur ? a.to : -1, minS }); });
  vignette();
  if (L.hud.style === 'panel') plaqueR(L.panel);
  drawHud();
  drawBottom();
  return;

  // ==========================================================================================
  function drawTitleLike(T) {
    if (scene === 'title') {
      const lvl = LEVELS[state.level], R = T.rows;
      if (T.board) {
        const b = T.board;
        ctx.save(); ctx.translate(b.cx, b.cy); ctx.scale(b.k, b.k); ctx.translate(-360, -1040);
        drawBoard(ctx, state.look.wood);
        drawPieces(ctx, { ...state, game: state.demo.g, pend: null, anim: null, sel: -1, hint: null, take: null, kb: false, scene: 'title', demo: state.demo }, L, { pop: state.demo, minS });
        ctx.restore();
      }
      // title block (drawn in its phone coordinates, scaled by the layout)
      const H0 = T.hero, bob = calm ? 0 : Math.sin(t * 1.4) * 3;
      ctx.save(); ctx.translate(H0.cx, H0.y0 - 90 * H0.ts); ctx.scale(H0.ts, H0.ts);
      text("NINE MEN'S", 0, 150 + bob, 78, '#f9e6b0'); text('MORRIS', 0, 250 + bob, 104, '#f2c766');
      ctx.fillStyle = '#c99a44'; ctx.fillRect(-200, 282, 400, 3); ctx.fillStyle = '#f2c766'; ctx.beginPath(); ctx.moveTo(0, 274); ctx.lineTo(10, 283.5); ctx.lineTo(0, 293); ctx.lineTo(-10, 283.5); ctx.fill();
      text('THE MILL GAME OF EUROPE', 0, 336, Math.max(24, minS / H0.ts), '#e6c98c', UI, 600);
      ctx.restore();
      if (T.card) plaqueR(T.card, 0.7);
      if (T.lock) drawTitleLockup(ctx, T.lock, state.lockPress > 0);
      if (R.resume) button(R.resume, 'Resume game', { primary: true });
      button(R.learn, 'Learn to play', { primary: !R.resume && !state.learned });
      button(R.play, 'Play the computer', { primary: !R.resume && state.learned });
      button(R.two, 'Two players');
      button(R.daily, state.daily.solvedDay === state.daily.day ? `Puzzle of the day  ✓  ${state.daily.streak}` : 'Puzzle of the day', {});
      button(R.level, lvl.name, { size: 22 }); button(R.side, state.humanSide === 1 ? 'You: Dark' : 'You: Light', { size: 22 });
      button(R.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 22 }); button(R.calm, state.calm ? 'Calm: on' : 'Calm: off', { size: 22 });
      button(R.look, 'Board & men', { size: 22 }); button(R.auto, 'Auto Play', { size: 22 });
      button(R.about, 'About', { size: 22 }); button(R.how, 'How to play', { size: 22 }); button(R.rules, 'Rules', { size: 22 });
      if (state.msg) { plaqueR(T.msg); wrap(state.msg.text, T.msg.x + T.msg.w / 2, T.msg.y + 42, 26, T.msg.w - 40, '#f6e3b4'); }
      text(lvl.note, T.note.x, T.note.y, 18, 'rgba(240,215,160,0.7)', UI, 500);
    } else if (scene === 'look') {
      const K = L.look;
      plaqueR(K.card);
      fitText('Board and men', K.cx, K.title.y, K.title.size, K.card.w - 60, '#f6e3b4');
      text(K.labels[0].t, K.cx, K.labels[0].y, 26, '#e6c98c', UI, 600);
      ['oak', 'walnut', 'ash'].forEach((wd, i) => { const r = K.woods[i], ok = unlocked(state, 'wood', wd); button(r, WOOD_NAMES[wd], { primary: state.look.wood === wd, dim: !ok, size: 22 }); if (!ok) text('locked', r.x + r.w / 2, K.lockedY[0], 20, '#b89a68', UI, 600); });
      text(K.labels[1].t, K.cx, K.labels[1].y, 26, '#e6c98c', UI, 600);
      ['boxwood', 'ivory'].forEach((st, i) => { const r = K.sets[i], ok = unlocked(state, 'set', st); button(r, SET_NAMES[st].split(' and ')[0] + ' & ' + SET_NAMES[st].split(' and ')[1], { primary: state.look.set === st, dim: !ok, size: 20 }); if (!ok) text('locked', r.x + r.w / 2, K.lockedY[1], 20, '#b89a68', UI, 600); });
      for (let i = 0; i < 2; i++) drawMan(ctx, K.cx - 110 + i * 220, K.men.y, 34, i, state.look.set, {});
      button(K.marks, state.marks ? 'Warnings: on' : 'Warnings: off', { size: 22 });
      if (state.msg) wrap(state.msg.text, K.cx, K.note.y, 22, K.card.w - 50, '#f6e3b4');
      else fitText('Warnings ring the point where the enemy could make a mill.', K.cx, K.note.y, 19, K.card.w - 40, '#cfae74', UI, 500);
      button(K.back, 'Back', { primary: true });
    } else {
      const Dm = L.demo, c = Dm.card;
      plaqueR(c);
      fitText('Free preview finished', Dm.cx, c.y + 90, 42, c.w - 50, '#f6e3b4');
      wrap('You have played the two games of the web preview. The full game, with every level, all ten lessons and the daily puzzle, is on iPhone and Android.', Dm.cx, c.y + 160, 28, c.w - 80);
      button(Dm.back, 'Back');
    }
  }

  // About, How to play and Rules share this reader: a framed panel (text-size stepper on top, Back/Next below), a body that scrolls
  // when the text (up to 300%) is taller than the panel, and a page counter.
  function drawRefPage(list, headerTitle) {
    const Rf = L.ref, secs = flow(list), vp = Rf.viewport, cx = Rf.cx, ts = Math.min(textScale, 1.15);
    plaqueR(Rf.panel, 0.85);
    button(Rf.dec, 'A−', { dim: state.textScaleIdx === 0, size: 26 });
    button(Rf.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 26 });
    const titleW = Rf.panel.w - 2 * 150;
    fitText(headerTitle, cx, Rf.headY + (ts - 1) * 10, Math.round(Rf.headSize * ts), titleW, '#f6e3b4');
    const fs = Math.round(29 * textScale), lh = Math.round(fs * 1.42), hs = Math.round(Rf.secSize * ts * 1.15), gap = Math.round(18 * textScale);
    const scrollY = state.refScroll || 0;
    // The wrapped document is laid out once per (screen, text size, geometry, font) and reused; a frame draws only the visible slice.
    ctx.font = `800 40px ${UI}`; const fk1 = ctx.measureText('Hamburgefonstiv').width;   // changes when a web font finishes loading
    ctx.font = `800 40px ${TITLEF}`; const fk2 = ctx.measureText('Hamburgefonstiv').width;
    const key = [headerTitle, textScale, vp.x, vp.y, vp.w, Rf.panel.w, Rf.textW, Rf.secSize, minS, fk1, fk2].join('|');
    if (readerCache.key !== key || readerCache.list !== list) {
      readerStats.layouts++;
      const items = []; let y = vp.y + 10;
      secs.forEach((sec, i) => {
        if (i > 0) y += Math.round(hs * 0.8);
        y += hs;
        let tsz = Math.max(hs, minS); while (tsz > Math.max(minS * 0.8, 14) && widthOf(sec.title.toUpperCase(), tsz, TITLEF, 700) > Rf.panel.w - 90) tsz -= 1;
        items.push({ k: 't', str: sec.title.toUpperCase(), y, size: tsz });
        y += Math.round(hs * 0.7);
        if (sec.piece) {
          const r = Math.max(8, Math.round(46 * ts)), py = y + r + 6;
          items.push({ k: 'piece', r, py, top: py - r - 10, h: 2 * r + 60 });
          y = py + r + Math.round(50 * textScale);
        }
        y += Math.round(fs * 0.9);
        for (const para of sec.paras) {
          const size = Math.max(fs, minS), lhh = Math.max(lh, size * 1.2), ls = wrapLines(para, size, Rf.textW, 500);
          items.push({ k: 'l', ls, y, size, lh: lhh }); y += ls.length * lhh + gap;
        }
        y -= lh;
      });
      readerCache.key = key; readerCache.list = list; readerCache.items = items; readerCache.endY = y;
    }
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip(); ctx.translate(0, -scrollY);
    const vtop = vp.y + scrollY - 80, vbot = vp.y + vp.h + scrollY + 80;
    for (const it of readerCache.items) {
      if (it.k === 't') { if (it.y > vtop - it.size && it.y - it.size < vbot) text(it.str, cx, it.y, it.size, '#f2c766', TITLEF, 700, 'center'); }
      else if (it.k === 'l') {
        if (it.y + it.ls.length * it.lh < vtop || it.y - it.size > vbot) continue;
        it.ls.forEach((ln, i) => { const ly = it.y + i * it.lh; if (ly > vtop - it.size && ly - it.size < vbot) text(ln, cx, ly, it.size, '#f0dcae', UI, 500, 'center'); });
      } else if (it.top + it.h >= vtop && it.top <= vbot) {
        const r = it.r, dx = 110, py = it.py;
        drawMan(ctx, cx - dx, py, r, 0, set, {});
        drawMan(ctx, cx + dx, py, r, 1, set, {});
        text('Light', cx - dx, py + r + 26, 17, 'rgba(240,220,180,0.75)', UI, 600);
        text('Dark', cx + dx, py + r + 26, 17, 'rgba(240,220,180,0.75)', UI, 600);
      }
    }
    const y = readerCache.endY, top = vp.y;
    const contentH = y - top + Math.round(fs * 0.9) + 30;
    state.refMax = Math.max(0, Math.round(contentH - vp.h));
    // a small pair of men on the table, only where there is clear room below the text
    const sy = vp.y + vp.h - 52;
    if (state.refMax === 0 && y + 70 < sy - 34) { drawMan(ctx, cx - 84, sy, 38, 0, set, {}); drawMan(ctx, cx + 84, sy, 38, 1, set, {}); }
    ctx.restore();
    if (state.refMax > 0) {      // scrollbar
      const tr = { x: Rf.panel.x + Rf.panel.w - 22, y: vp.y, w: 8, h: vp.h }, th = Math.max(44, vp.h * (vp.h / (vp.h + state.refMax))), tp = tr.y + (tr.h - th) * ((state.refScroll || 0) / state.refMax);
      ctx.fillStyle = 'rgba(240,200,130,0.18)'; ctx.beginPath(); ctx.roundRect(tr.x, tr.y, tr.w, tr.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(246,216,136,0.8)'; ctx.beginPath(); ctx.roundRect(tr.x, tp, tr.w, th, 4); ctx.fill();
    }
    const atEnd = (state.refScroll || 0) >= state.refMax - 1;
    text(state.refMax > 0 ? (atEnd ? 'End' : 'Scroll or tap Next for more') : '', cx, Rf.counterY, 18, 'rgba(240,215,160,0.7)', UI, 500);
    // Back always leaves to the title; Next moves one screenful and reads "Done" at the end.
    button(Rf.back, 'Back', { primary: false });
    button(Rf.next, atEnd ? 'Done' : 'Next', { primary: true });
  }

  function drawHud() {
    if (scene === 'over') { drawOver(false); return; }
    if (scene === 'auto' && D.phase === 'over') { drawOver(true); return; }
    const S = L.hud;
    const who = (s) => NAMES[s];
    let head = '', sub = '', phase = '';
    const me = g.turn, human = state.two || me === state.human;
    if (scene === 'auto') {
      const phaseWord = D.phase === 'think' ? 'thinking' : D.phase === 'reveal' ? 'about to act' : 'playing';
      head = D.paused ? 'Paused' : `${NAMES[g.turn]} is ${phaseWord}`;
      sub = D.phase === 'think' ? 'THINK: work out your own answer before it is revealed.' : D.phase === 'reveal' ? 'REVEAL: the highlighted move is the one about to be played.' : 'ACT: watch it play out.';
    } else if (scene === 'lesson') {
      head = `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`; sub = state.lesson.done ? 'Well done. TAP Next.' : LESSONS[state.lesson.i].text;
    } else if (scene === 'puzzle') {
      sub = state.msg?.text ?? (state.pz.status === 'solved' ? 'Solved. Come back tomorrow for the next one.' : puzzleText(state.pz.puzzle));
    } else {
      phase = placing(g) ? 'Placing men' : flying(g, g.turn) ? 'Flying' : 'Sliding men';
      head = state.two ? `${who(me)} to move` : human ? 'Your move' : `${who(me)} is thinking`;
      head += state.thinking && !calm ? '.'.repeat(1 + Math.floor(t * 3) % 3) : '';
      sub = state.msg?.text ?? defaultLine();
    }
    const thinkS = AUTO_THINK_STEPS[state.autoThinkIdx], stepBtns = () => { button(L.think.dec, '−', { dim: state.autoThinkIdx === 0, size: 26 }); button(L.think.inc, '+', { dim: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1, size: 26 }); };
    if (S.style === 'big') {
      const top = S.y, Y = (v) => v - 120 + top;
      if (scene === 'auto') {
        const fs = big ? 30 : 26, n = wrapLines(sub, fs, 600).length;
        plaque(24, top, 672, 250 + n * fs * 1.32);
        stepBtns();
        text('Auto Play · Watch & Learn', w / 2, Y(232), 24, '#c9a35a', UI, 600);
        fitText(head, w / 2, Y(284), 42, 640, '#fff0c4');
        text(`Think time: ${thinkS}s (max 10s)`, w / 2, Y(320), 19, '#c9a35a', UI, 600);
        wrap(sub, w / 2, Y(366), fs, 600, '#f6e3b4', fs * 1.32);
      } else if (scene === 'lesson') {
        const l = LESSONS[state.lesson.i], fs = big ? 30 : 26, n = wrapLines(sub, fs, 600).length; plaque(24, top, 672, 200 + n * fs * 1.32);
        text(head, w / 2, Y(186), 32, '#f2c766'); fitText(l.title, w / 2, Y(244), 46, 640); wrap(sub, w / 2, Y(296), fs, 600, '#f6e3b4', fs * 1.32);
      } else if (scene === 'puzzle') {
        const fs = big ? 32 : 28, n = wrapLines(sub, fs, 600).length;
        plaque(24, top, 672, 170 + n * fs * 1.32); text('Puzzle of the day', w / 2, Y(192), 44); wrap(sub, w / 2, Y(248), fs, 600, '#f6e3b4');
        if (state.pz.status !== 'solved') text(`Streak ${state.daily.streak}`, w / 2, top + 170 + n * fs * 1.32 - 22, 20, '#c9a35a', UI, 600);
      } else {
        const fs = big ? 32 : 27, n = wrapLines(sub, fs, 610).length;
        plaque(24, top, 672, 190 + n * fs * 1.32);
        fitText(head, w / 2, Y(190), 52, 640, me === 0 ? '#fff0c4' : '#c7a58a');
        text(phase.toUpperCase(), w / 2, Y(232), 21, '#c9a35a', UI, 600);
        wrap(sub, w / 2, Y(292), fs, 610, '#f6e3b4', fs * 1.32);
      }
      return;
    }
    // compact / landscape panel: a fixed box, the text fitted into it
    const r = S.rect, cx = r.x + r.w / 2, iw = r.w - 36, bottom = r.y + r.h - 8, top = r.y;
    if (S.style === 'small') plaqueR(r);
    if (scene === 'auto') {
      stepBtns();
      fitText('Auto Play · Watch & Learn', cx, top + 40, 22, r.w - 2 * 130, '#c9a35a', UI, 600);
      fitText(head, cx, top + 90, 38, iw, '#fff0c4');
      text(`Think time: ${thinkS}s (max 10s)`, cx, top + 118, 20, '#c9a35a', UI, 600);
      fitWrap(sub, cx, top + 132, bottom, iw, 24);
    } else if (scene === 'lesson') {
      text(head, cx, top + 38, 26, '#f2c766'); fitText(LESSONS[state.lesson.i].title, cx, top + 86, 40, iw);
      fitWrap(sub, cx, top + 102, bottom, iw, 26);
    } else if (scene === 'puzzle') {
      fitText('Puzzle of the day', cx, top + 52, 40, iw);
      fitWrap(sub, cx, top + 70, bottom - (state.pz.status !== 'solved' ? 30 : 0), iw, 26);
      if (state.pz.status !== 'solved') text(`Streak ${state.daily.streak}`, cx, bottom - 6, 20, '#c9a35a', UI, 600);
    } else {
      fitText(head, cx, top + 56, 46, iw, me === 0 ? '#fff0c4' : '#c7a58a');
      text(phase.toUpperCase(), cx, top + 86, 20, '#c9a35a', UI, 600);
      fitWrap(sub, cx, top + 100, bottom, iw, 27);
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
  // The result screens (a played game, and Auto Play's own end screen). Phone: a plaque over the board with the buttons below it.
  // Landscape: the side panel itself carries the result and the same three button slots.
  function drawOver(isAuto) {
    const O = L.over, w0 = g.winner, humanWon = w0 === state.human && !state.two;
    const head = w0 === 'draw' ? 'A draw' : isAuto || state.two ? (isAuto ? `${NAMES[w0]} wins` : `${NAMES[w0]} wins`) : humanWon ? 'You win' : `${NAMES[w0]} wins`;
    const line = isAuto ? 'A full Auto Play demonstration just finished. Nothing here was saved.' : w0 === 'draw' ? 'Perfect play from both sides is a draw, so this is a good result.' : humanWon ? 'Well played. A stronger level awaits.' : 'Try again, or ask for a Hint.';
    const lineColor = isAuto ? '#f2c766' : '#cfae74';
    if (!O.panel) {
      const p = isAuto ? O.plaqueAuto : O.plaque, py = p.y;
      ctx.fillStyle = 'rgba(10,5,0,0.6)'; ctx.fillRect(0, 0, w, h);
      plaqueR(p);
      fitText(head, w / 2, py + 110, 78, p.w - 40, w0 === 'draw' ? '#e6c98c' : '#f2c766'); ctx.fillStyle = '#c99a44'; ctx.fillRect(w / 2 - 160, py + 134, 320, 3);
      wrap(g.reason, w / 2, py + 200, 28, 500); wrap(line, w / 2, py + 300, isAuto ? 22 : 24, 500, lineColor);
      button(O.again, isAuto ? 'Play again (auto)' : 'Play again', { primary: true }); button(O.back, isAuto ? 'Exit to menu' : 'Menu'); if (!isAuto) button(O.share, 'Share');
      drawMoreLine(ctx, w / 2, isAuto ? O.again.y + 96 + 84 + 46 : O.brandY, Math.max(22, minS));
      return;
    }
    const r = O.rect, cx = O.cx, iw = r.w - 36, stackTop = L.BTN.again.y, ph = stackTop - r.y;
    const hs = Math.min(64, ph * 0.16);
    fitText(head, cx, r.y + 22 + hs, hs + 4, iw, w0 === 'draw' ? '#e6c98c' : '#f2c766'); ctx.fillStyle = '#c99a44'; ctx.fillRect(cx - 110, r.y + 36 + hs, 220, 3);
    fitWrap(g.reason, cx, r.y + 54 + hs, r.y + 54 + hs + (ph - 54 - hs - 36) * 0.5, iw, 26);
    fitWrap(line, cx, r.y + 54 + hs + (ph - 54 - hs - 36) * 0.5 + 6, stackTop - 40, iw, 22, lineColor);
    button(L.BTN.again, isAuto ? 'Play again (auto)' : 'Play again', { primary: true }); button(L.BTN.back, isAuto ? 'Exit to menu' : 'Menu'); if (!isAuto) button(L.BTN.share, 'Share');
    drawMoreLine(ctx, cx, stackTop - 12, Math.max(20, minS));
  }
  function drawBottom() {
    const B = L.BTN;
    if (scene === 'over') return;
    if (scene === 'auto') {
      if (D.phase === 'over') return;
      button(B.menu, 'Exit'); button(B.undo, 'Skip wait', { dim: D.phase === 'act' || D.paused }); button(B.hint, D.paused ? 'Resume' : 'Pause', { primary: D.paused });
      return;
    }
    if (scene === 'lesson') {
      button(B.menu, 'Menu');
      if (state.lesson.done) button(B.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true }); else button(B.show, 'Show me');
      return;
    }
    if (scene === 'puzzle') {
      button(B.menu, 'Menu'); if (state.pz.status === 'solved') button(B.pshare, 'Share', {}); return;
    }
    button(B.menu, 'Menu'); button(B.undo, 'Undo', { dim: !state.undo.length }); button(B.hint, `Hint ${state.hintsLeft}`, { dim: state.hintsLeft <= 0 });
  }
}

// ==========================================================================================
// The men, racks and marks on the board, in STAGE coordinates. opts.hidden = a point whose man is drawn by the moving animation instead.
function drawPieces(ctx, state, L, opts = {}) {
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
  // Auto Play's REVEAL phase: every legal destination this turn (gold ring), then the ONE move about to be played much more strongly (green).
  if (scene === 'auto' && state.autoReveal) {
    const AR = state.autoReveal, isChosen = (m) => AR.chosen && mvFrom(m) === mvFrom(AR.chosen) && mvTo(m) === mvTo(AR.chosen);
    for (const m of AR.legal || []) {
      const to = mvTo(m), chosen = isChosen(m);
      ring(to, chosen ? '120,255,170' : '255,224,140', chosen ? 0.95 : 0.62 + pulse * 0.18, chosen ? 30 : 25, false, chosen ? 4.5 : 3.2);
      if (chosen) glow(to, '120,255,170', 0.55 + pulse * 0.3);
    }
    if (AR.chosen && mvFrom(AR.chosen) !== NONE) { glow(mvFrom(AR.chosen), '120,255,170', 0.4 + pulse * 0.2); ring(mvFrom(AR.chosen), '120,255,170', 0.9, 30, false, 4); }
  }
  // last move marker
  if (!onTitle && g.plies && state.lastTo >= 0 && !state.pend) ring(state.lastTo, '255,255,255', 0.28, 33, false, 2);

  // racks: carved trays with the men still to place (a row above / below the board, or a column beside it in landscape)
  if (!onTitle) {
    const vert = L.racks === 'v', lblSize = Math.max(21, (opts.minS ?? 20) / L.stage.s);
    for (const [which, side] of [['top', topSide], ['bottom', bottomSide]]) {
      const b = L.rackBox(which), gr = vert ? ctx.createLinearGradient(b.x, 0, b.x + b.w, 0) : ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      gr.addColorStop(0, 'rgba(24,12,4,0.85)'); gr.addColorStop(1, 'rgba(70,40,18,0.85)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 34); ctx.fill(); ctx.strokeStyle = 'rgba(240,200,130,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      for (let k = 0; k < 9; k++) { const q = L.rackPos(which, k); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + 8, 24, 19, 0, 0, TAU); ctx.fill(); }
      for (let k = 0; k < hand[side]; k++) { const q = L.rackPos(which, k); drawMan(ctx, q.x, q.y + 6, 27, side, set, {}); }
      const onBoard = pop(p[side]), lb = L.rackLabel(which);
      ctx.textAlign = 'center'; ctx.font = `600 ${lblSize}px ${UI}`; ctx.fillStyle = 'rgba(246,227,180,0.85)';
      const named = state.two || scene === 'lesson' || scene === 'puzzle', who = named ? NAMES[side] : side === state.human ? 'You' : 'Computer';
      if (lb.two) { ctx.fillText(named ? who : `${who} (${NAMES[side]})`, lb.x, lb.y); ctx.fillText(`${hand[side] + onBoard} men`, lb.x, lb.y + lblSize * 1.2); }
      else ctx.fillText(`${named ? who : who + ` (${NAMES[side]})`}: ${hand[side] + onBoard} men`, lb.x, lb.y);
    }
  }
  // the men on the board, far to near
  const dm = opts.pop;
  for (const i of ORDER) {
    if (i === opts.hidden) continue;
    const side = p[0] & bit(i) ? 0 : p[1] & bit(i) ? 1 : -1; if (side < 0) continue;
    const q = pointAt(i);
    let o = {}; const sel = state.sel === i && !onTitle;
    if (sel) { o.lift = 0.5 + (calm ? 0 : 0.06 * Math.sin(t * 6)); o.selected = true; }
    if (dm && dm.last === i) { const f = Math.min(1, dm.since / 0.3); o.scale = 0.6 + 0.4 * f * (2 - f); o.lift = (1 - f) * 0.9; }
    if (state.drag && state.drag.i === i && state.drag.moved) continue;
    drawMan(ctx, q.x, q.y, R * q.s, side, set, o);
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
      const from = a.from === NONE ? L.rackPos(a.rack, 0) : pointAt(a.from), fs = a.from === NONE ? from.s * 0.62 : from.s;
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
