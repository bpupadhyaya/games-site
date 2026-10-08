// Drawing every screen of Shut the Box from the game state. No game logic here (game.js owns it), no clock: animation values come from S.
import { DISPLAY, UI, rr, ease, mix, BOXES, drawTable, drawBoxFrame, drawTile, drawDie, drawTray, drawParticles } from './art.js';
import { drawCredit, drawMoreLine, brandGradient } from './brand.js';
import { DOCS, DUEL_ROUNDS, LEVELS } from './content.js';
import { TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { bit, tilesOf, hash32, sumMask, singleAllowed } from './rules.js';
import { board } from './layout.js';

export const docMetrics = { max: 0, view: 0 };
const GOLD = '#e9bd5a', CREAM = '#f6ead0', DIM = 'rgba(246,234,208,0.7)';

// ---- small helpers ---------------------------------------------------------------------------------------------------------------------
function text(ctx, str, x, y, size, color = CREAM, align = 'left', weight = 600, font = UI, base = 'alphabetic') {
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y);
}
function wrap(ctx, str, maxW) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
function fitText(ctx, str, maxW, size, weight = 600, font = UI, min = 0.6) {
  let s = size; ctx.font = `${weight} ${s}px ${font}`;
  while (ctx.measureText(str).width > maxW && s > size * min) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; }
  return s;
}
// One shared font size for a row of buttons: the largest size at which every label fits its own button (so labels never differ in size inside a bar).
function rowSize(ctx, items, size) {
  let s = size;
  for (const [r, label] of items) s = Math.min(s, fitText(ctx, label, Math.max(40, r.w - 20), size, 700, UI, 0.5));
  return s;
}
function button(ctx, r, label, { kind = 'plain', sub = '', disabled = false, size = 30, left = false } = {}) {
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, Math.min(18, r.h * 0.28));
  if (kind === 'primary') { ctx.fillStyle = disabled ? '#6f5a2c' : '#e2ae45'; ctx.fill(); }
  else if (kind === 'danger') { ctx.fillStyle = 'rgba(150,34,34,0.85)'; ctx.fill(); }
  else { ctx.fillStyle = disabled ? 'rgba(20,8,6,0.4)' : 'rgba(26,10,8,0.72)'; ctx.fill(); }
  ctx.lineWidth = 2; ctx.strokeStyle = kind === 'primary' ? 'rgba(255,236,170,0.8)' : disabled ? 'rgba(214,168,72,0.25)' : 'rgba(214,168,72,0.65)'; ctx.stroke();
  const col = kind === 'primary' ? '#2a1405' : disabled ? 'rgba(246,234,208,0.4)' : CREAM;
  const subW = sub ? (() => { ctx.font = `500 ${Math.round(size * 0.74)}px ${UI}`; return ctx.measureText(sub).width; })() : 0;
  const maxW = r.w - (r.w < 200 ? 20 : 32) - (sub ? subW + 14 : 0), s = fitText(ctx, label, Math.max(40, maxW), size, 700, UI, r.w < 200 ? 0.5 : 0.6);
  if (sub) { text(ctx, label, r.x + 20, r.y + r.h / 2, s, col, 'left', 700, UI, 'middle'); text(ctx, sub, r.x + r.w - 18, r.y + r.h / 2, Math.round(size * 0.74), kind === 'primary' ? 'rgba(42,20,5,0.75)' : DIM, 'right', 500, UI, 'middle'); }
  else if (left) text(ctx, label, r.x + 20, r.y + r.h / 2, s, col, 'left', 700, UI, 'middle');
  else text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, s, col, 'center', 700, UI, 'middle');
  ctx.restore();
}
function panel(ctx, r, alpha = 0.6) {
  rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = `rgba(20,7,6,${alpha})`; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(214,168,72,0.35)'; ctx.stroke();
}
function goldText(ctx, str, cx, y, size, maxW) {
  const s = fitText(ctx, str, maxW, size, 800, DISPLAY);
  ctx.font = `800 ${s}px ${DISPLAY}`; const w = ctx.measureText(str).width;
  const g = ctx.createLinearGradient(0, y - s, 0, y + s * 0.2); g.addColorStop(0, '#fff2b8'); g.addColorStop(0.5, '#e9bd5a'); g.addColorStop(1, '#a8741c');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = g; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(str, cx, y); ctx.restore();
  return w;
}

// ---- the box and dice ------------------------------------------------------------------------------------------------------------------
function drawBoxWithTiles(ctx, S, B, n, st) {
  drawBoxFrame(ctx, B.box, S.boxKey);
  for (let k = 1; k <= n; k++) {
    let r = B.tiles[k - 1];
    if (st.shake && st.shake.k === k) { const u = st.shake.t / 0.35; r = { ...r, x: r.x + Math.sin(u * 40) * 7 * (1 - u) }; }
    drawTile(ctx, r, k, { flip: st.flip[k - 1], lift: st.lift(k), glow: st.glow(k), dim: st.dim(k), style: S.tileKey, box: S.boxKey, t: S.t });
  }
}
function diceState(S, bx, tray) {
  const lab = bx.phase === 'roll' && !S.autoMode && bx.player === 0;   // 'TAP TO ROLL' is shown: lift the dice clear of it
  const size = Math.min(tray.h * (lab ? 0.5 : 0.6), tray.w * 0.25, 170), cy = tray.y + tray.h * (lab ? 0.4 : 0.5), single = bx.single && bx.dice;
  const xs = single ? [tray.x + tray.w * 0.34] : [tray.x + tray.w * 0.2, tray.x + tray.w * 0.2 + size * 1.32];
  return { size, cy, xs, single };
}
function drawDice(ctx, S, bx, tray) {
  const D = diceState(S, bx, tray), faces = bx.dice || [5, 2], a = S.dAnim, n = D.single ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const seed = hash32(bx.seed + bx.rollN, i + 3), ang0 = ((seed % 100) / 100 - 0.5) * 0.5, fy = D.cy + (i ? 6 : -4);
    let x = D.xs[i], y = fy, ang = ang0, air = 0, v = faces[i], fade = 1;
    if (a) {
      const u = Math.min(1, a.t / a.dur), e = 1 - Math.pow(1 - u, 3);
      x = mix(tray.x + 10 - D.size, D.xs[i], e) - (i ? 0 : 0); air = Math.abs(Math.sin(u * Math.PI * (3.2 + i * 0.6))) * (1 - u) * 0.9;
      ang = ang0 + (1 - e) * (i ? -1 : 1) * 6.28 * 2.2; v = u < 0.85 ? 1 + (hash32(Math.floor(u * 18) + i * 5, bx.rollN * 7 + 1) % 6) : faces[i];
    } else if (!bx.dice) fade = 0.85;
    drawDie(ctx, x, y, D.size, v, { ang, air, tint: i ? 'red' : 'ivory', fade });
  }
  if (D.single) { ctx.save(); ctx.globalAlpha = 0.18; drawDie(ctx, D.xs[0] + D.size * 1.32, D.cy, D.size * 0.82, 6, { ang: 0.2, tint: 'red' }); ctx.restore(); }
}
function odds(ctx, S, g, P) {
  const o = S.odds, bx = g.box; if (!o) return;
  const r = P.odds; ctx.save();
  const pct = Math.round(o.playable * 100), sh = (o.shut * 100);
  const shs = sh >= 10 ? Math.round(sh) : sh.toFixed(1), size = r.w < 520 ? 22 : 25;
  ctx.font = `600 ${size}px ${UI}`;
  let s1 = `Next roll playable ${pct}%`, s2 = `Chance to shut ${shs}%`;
  if (ctx.measureText(s1 + s2).width > r.w - 30) { s1 = `Playable ${pct}%`; s2 = `Shut chance ${shs}%`; }
  text(ctx, s1, r.x + 6, r.y + r.h / 2, size, DIM, 'left', 600, UI, 'middle'); text(ctx, s2, r.x + r.w - 6, r.y + r.h / 2, size, DIM, 'right', 600, UI, 'middle');
  ctx.restore(); void bx;
}

// ---- screens ---------------------------------------------------------------------------------------------------------------------------
function heroBoard(T) { const key = `${Math.round(T.hero.x)},${Math.round(T.hero.y)},${Math.round(T.hero.w)},${Math.round(T.hero.h)}`; return heroBoard.c?.key === key ? heroBoard.c.v : ((heroBoard.c = { key, v: board(9, { x: T.hero.x, y: T.hero.y + T.hero.h * 0.02, w: T.hero.w, h: T.hero.h * 0.84 }) }).v); }
function drawTitle(ctx, S, L) {
  const T = L.title(!!S.saved), R = T.rows;
  goldText(ctx, 'SHUT THE BOX', T.heroTitle.x + T.heroTitle.w / 2, T.heroTitle.y + T.heroTitle.h * 0.7, Math.min(92, T.heroTitle.h * 0.8), T.heroTitle.w);
  text(ctx, 'A TAVERN CLASSIC FROM ENGLAND AND FRANCE', T.heroTitle.x + T.heroTitle.w / 2, T.heroTitle.y + T.heroTitle.h * 0.7 + 34, fitText(ctx, 'A TAVERN CLASSIC FROM ENGLAND AND FRANCE', T.heroTitle.w, 20, 600), 'rgba(246,234,208,0.62)', 'center', 600, UI);
  // hero: the box with tiles that flip down one after another
  const B = heroBoard(T), h = S.hero;
  if (!h.f) h.f = new Array(9).fill(0);
  drawBoxFrame(ctx, B.box, S.boxKey);
  for (let k = 1; k <= 9; k++) drawTile(ctx, B.tiles[k - 1], k, { flip: h.f[k - 1], style: S.tileKey, box: S.boxKey, t: S.t });
  const ds = Math.min(B.tw * 0.95, 96);
  drawDie(ctx, B.box.x + B.box.w - ds * 0.7, B.box.y + B.box.h - ds * 0.05, ds, 4, { ang: 0.28 });
  drawDie(ctx, B.box.x + B.box.w - ds * 1.75, B.box.y + B.box.h + ds * 0.12, ds, 3, { ang: -0.2, tint: 'red' });
  const best = S.progress.best, dly = S.daily, lv = LEVELS[S.level];
  if (R.resume) button(ctx, R.resume, 'Resume box', { kind: 'primary', sub: 'saved' });
  button(ctx, R.classic, 'Classic Box', { kind: R.resume ? 'plain' : 'primary', sub: best.classic !== undefined ? `tiles 1-9 · best ${best.classic}` : 'tiles 1-9' });
  button(ctx, R.tall, 'Tall Box', { sub: best.tall !== undefined ? `tiles 1-12 · best ${best.tall}` : 'tiles 1-12' });
  button(ctx, R.duel, 'Duel', { sub: '', left: true });
  rr(ctx, R.chip.x, R.chip.y, R.chip.w, R.chip.h, R.chip.h / 2); ctx.fillStyle = 'rgba(233,189,90,0.18)'; ctx.fill(); ctx.strokeStyle = 'rgba(233,189,90,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, lv.name, R.chip.x + R.chip.w / 2, R.chip.y + R.chip.h / 2, Math.min(26, R.chip.h * 0.46), GOLD, 'center', 700, UI, 'middle');
  if (R.duel.w >= 640) text(ctx, 'vs the Innkeeper', R.duel.x + 20 + 100, R.duel.y + R.duel.h / 2, 22, DIM, 'left', 500, UI, 'middle');
  button(ctx, R.daily, 'Daily Box', { sub: dly.doneDay === dly.day ? `done · ${dly.score === 0 ? 'shut!' : dly.score} · streak ${dly.streak}` : dly.streak ? `streak ${dly.streak}` : 'same dice for all' });
  button(ctx, R.auto, 'Watch & Learn', { sub: 'solver plays' });
  const tz = rowSize(ctx, [[R.howto, 'How to Play'], [R.rules, 'Rules'], [R.about, 'About'], [R.settings, 'Settings']], 27);
  button(ctx, R.howto, 'How to Play', { size: tz }); button(ctx, R.rules, 'Rules', { size: tz }); button(ctx, R.about, 'About', { size: tz }); button(ctx, R.settings, 'Settings', { size: tz });
  drawMoreLine(ctx, T.lockup.x + T.lockup.w / 2, T.lockup.y + T.lockup.h * 0.62, 21);
}

function playStateFor(S, g) {
  const bx = g.box;
  return {
    flip: S.flip, shake: S.shake,
    lift: (k) => (bx.sel & bit(k) ? 1 : 0),
    glow: (k) => (S.hint ? (S.hint.mask & bit(k) ? 1 : S.hint.all && S.hint.all & bit(k) ? 0.35 : 0) : 0),
    dim: (k) => (bx.phase === 'pick' && bx.open & bit(k) && !((bx.viable | bx.sel) & bit(k)) ? 1 : 0),
  };
}
function drawPlay(ctx, S, L) {
  const g = S.g, bx = g.box, P = L.play, B = L.board(g.n), auto = S.autoMode;
  // header
  const modeName = auto ? 'Watch & Learn' : g.mode === 'duel' ? 'Duel' : g.mode === 'daily' ? 'Daily Box' : g.mode === 'tall' ? 'Tall Box' : 'Classic Box';
  const openStr = `Open ${sumMask(bx.open)}`, openSz = fitText(ctx, openStr, P.head.w * 0.42, Math.min(34, P.head.h * 0.58), 800, DISPLAY, 0.6);
  ctx.font = `800 ${openSz}px ${DISPLAY}`; const openW = ctx.measureText(openStr).width;
  const modeSz = fitText(ctx, modeName, Math.max(60, P.head.w - openW - 16), Math.min(38, P.head.h * 0.6), 800, DISPLAY, 0.5);
  text(ctx, modeName, P.head.x, P.head.y + P.head.h * 0.64, modeSz, GOLD, 'left', 800, DISPLAY);
  text(ctx, openStr, P.head.x + P.head.w, P.head.y + P.head.h * 0.64, openSz, CREAM, 'right', 800, DISPLAY);
  // score row
  let row;
  if (g.mode === 'duel') {
    const d = g.duel, you = d.totals[0] + (bx.player === 0 ? sumMask(bx.open) : 0) * 0, inn = d.totals[1];
    row = `You ${you}   ·   Innkeeper ${inn}   ·   Round ${Math.min(d.round, DUEL_ROUNDS)} of ${DUEL_ROUNDS}`;
    if (bx.player === 1) row = `Innkeeper's box   ·   You ${you}   ·   Innkeeper ${inn}   ·   Round ${d.round}`;
  } else if (auto) row = `Think ${THINK_STEPS[S.autoThinkIdx]} s   ·   box ${g.boxNo + 1}${S.autoPaused ? '   ·   paused' : ''}`;
  else if (g.mode === 'daily') row = S.daily.doneDay === S.daily.day ? `Daily: done (${S.daily.score === 0 ? 'shut' : S.daily.score})   ·   streak ${S.daily.streak}` : `Daily box   ·   streak ${S.daily.streak}`;
  else row = S.progress.best[g.mode] !== undefined ? `Best ${S.progress.best[g.mode]}   ·   low score wins` : 'Low score wins';
  const rs = fitText(ctx, row, P.score.w, 26, 600); text(ctx, row, P.score.x + P.score.w / 2, P.score.y + P.score.h / 2, rs, DIM, 'center', 600, UI, 'middle');
  // message
  panel(ctx, P.msg, 0.5);
  const dflt = g.phase !== 'play' ? '' : auto ? 'Watching the solver play.' : bx.player === 1 ? 'The Innkeeper is playing.' : bx.phase === 'roll' ? 'Tap the dice to roll.' : bx.phase === 'pick' ? `Make ${bx.total} with open tiles.` : '';
  const mtext = S.msg ? S.msg.text : dflt;
  if (mtext) {
    let size = 30, lines; ctx.font = `600 ${size}px ${UI}`;
    for (; size >= 22; size -= 2) { ctx.font = `600 ${size}px ${UI}`; lines = wrap(ctx, mtext, P.msg.w - 36); if (lines.length * size * 1.28 <= P.msg.h - 14) break; }
    lines.slice(0, Math.max(1, Math.floor((P.msg.h - 10) / (size * 1.28)))).forEach((ln, i, arr) => text(ctx, ln, P.msg.x + P.msg.w / 2, P.msg.y + P.msg.h / 2 + (i - (arr.length - 1) / 2) * size * 1.28, size, CREAM, 'center', 600, UI, 'middle'));
  }
  if (auto && S.plan && bx.phase === 'pick') {
    const label = S.plan.phase === 'think' ? `THINK ${Math.max(0, Math.ceil(S.plan.timer))}` : S.plan.phase === 'reveal' ? 'REVEAL' : 'ACT';
    text(ctx, label, P.msg.x + P.msg.w - 14, P.msg.y + 22, 19, GOLD, 'right', 800, UI, 'middle');
  }
  // tray + dice
  drawTray(ctx, P.tray); drawDice(ctx, S, bx, P.tray);
  const tr = P.tray;
  if (bx.phase === 'roll' && !(S.autoMode || bx.player === 1) && g.phase === 'play') {
    const pulse = 0.7 + 0.3 * Math.sin(S.t * 4);
    ctx.save(); ctx.globalAlpha = pulse; text(ctx, 'TAP TO ROLL', tr.x + tr.w / 2, tr.y + tr.h * 0.88, fitText(ctx, 'TAP TO ROLL', tr.w * 0.6, Math.min(36, tr.w * 0.06), 800, DISPLAY), '#ffe39a', 'center', 800, DISPLAY, 'middle'); ctx.restore();
  } else if (bx.total && bx.phase !== 'rolling') {
    const cx = tr.x + tr.w * 0.8;
    text(ctx, String(bx.total), cx, tr.y + tr.h * 0.58, Math.min(tr.h * 0.5, 96), '#ffe39a', 'center', 800, DISPLAY, 'middle');
    const sel = sumMask(bx.sel);
    text(ctx, bx.phase === 'pick' ? (sel ? `${sel} of ${bx.total}` : 'make this') : bx.phase === 'stuck' ? 'no move' : '', cx, tr.y + tr.h * 0.86, 22, DIM, 'center', 600, UI, 'middle');
  } else if (bx.phase === 'rolling') text(ctx, '...', tr.x + tr.w * 0.8, tr.y + tr.h * 0.55, 56, DIM, 'center', 800, DISPLAY, 'middle');
  odds(ctx, S, g, P);
  // the box
  const sh = S.gameShake > 0 ? Math.sin(S.t * 90) * S.gameShake * 14 : 0;
  ctx.save(); ctx.translate(sh, 0);
  drawBoxWithTiles(ctx, S, B, g.n, playStateFor(S, g));
  drawParticles(ctx, S.fx);
  ctx.restore();
  if (bx.phase === 'stuck' || (bx.phase === 'done' && bx.open)) {
    const b = B.box; rr(ctx, b.x + b.w * 0.15, b.y + b.h * 0.42, b.w * 0.7, 76, 16); ctx.fillStyle = 'rgba(30,8,8,0.82)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,120,100,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, `NO MOVE FOR ${bx.total}`, b.x + b.w / 2, b.y + b.h * 0.42 + 38, Math.min(34, b.w * 0.07), '#ffb4a0', 'center', 800, DISPLAY, 'middle');
  }
  if (S.banner) {
    const u = S.banner.t / S.banner.hold, a = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1, b = B.box;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a)); const sc = 1 + 0.06 * Math.sin(S.t * 6);
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(sc, sc); goldText(ctx, S.banner.text, 0, 0, Math.min(96, b.w * 0.14), Math.min(P.region.w, L.w) - 40); ctx.restore();
  }
  // buttons
  if (auto) {
    const pl = S.autoPaused ? 'Resume' : 'Pause', az = rowSize(ctx, [[P.autoBtn.exit, 'Exit'], [P.autoBtn.pause, pl], [P.autoBtn.dec, 'Think -'], [P.autoBtn.inc, 'Think +']], 28);
    button(ctx, P.autoBtn.exit, 'Exit', { size: az }); button(ctx, P.autoBtn.pause, pl, { kind: 'primary', size: az });
    button(ctx, P.autoBtn.dec, 'Think -', { size: az, disabled: S.autoThinkIdx === 0 }); button(ctx, P.autoBtn.inc, 'Think +', { size: az, disabled: S.autoThinkIdx === THINK_STEPS.length - 1 });
  } else {
    const human = bx.player === 0 && g.phase === 'play';
    const dl = (human && singleAllowed(bx.open)) ? (g.single ? '1 die' : '2 dice') : '2 dice', bz = rowSize(ctx, [[P.btn.menu, 'Menu'], [P.btn.hint, 'Hint'], [P.btn.clear, 'Clear'], [P.btn.dice, dl]], 28);
    button(ctx, P.btn.menu, 'Menu', { size: bz });
    button(ctx, P.btn.hint, 'Hint', { size: bz, disabled: !human || (bx.phase !== 'pick' && bx.phase !== 'roll') });
    button(ctx, P.btn.clear, 'Clear', { size: bz, disabled: !human || !(bx.phase === 'pick' && bx.sel) });
    const can = human && singleAllowed(bx.open);
    button(ctx, P.btn.dice, can ? (g.single ? '1 die' : '2 dice') : '2 dice', { size: bz, disabled: !can || bx.phase !== 'roll' });
  }
  // thin brand line at the very top (discreet)
  ctx.fillStyle = brandGradient(ctx, 0, 0, L.w, 0, 0.9); ctx.fillRect(0, 0, L.w, 3);
  if (g.phase !== 'play' && !auto) drawResult(ctx, S, L);
}
function drawResult(ctx, S, L) {
  const g = S.g, r = g.res, C = L.result, c = C.card; if (!r) return;
  ctx.fillStyle = 'rgba(8,2,2,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 30; rr(ctx, c.x, c.y, c.w, c.h, 26); ctx.fillStyle = '#2a0f10'; ctx.fill(); ctx.restore();
  rr(ctx, c.x, c.y, c.w, c.h, 26); ctx.strokeStyle = 'rgba(233,189,90,0.8)'; ctx.lineWidth = 3; ctx.stroke();
  const cx = c.x + c.w / 2; let title, big, l1, l2, primary = 'Next box';
  const bx = g.box;
  if (r.kind === 'match') {
    title = r.win === 'you' ? 'YOU WIN THE DUEL' : r.win === 'inn' ? 'THE INNKEEPER WINS' : 'A DRAW'; big = `${r.you}  :  ${r.inn}`; l1 = `Five boxes, lowest total wins. Last box: you ${r.mine}, Innkeeper ${r.theirs}.`; l2 = `${LEVELS[g.duel.level].name} level`; primary = 'Play again';
  } else if (r.kind === 'round') { title = `ROUND ${r.round} OF ${DUEL_ROUNDS}`; big = `${r.mine}  :  ${r.theirs}`; l1 = `You ${r.mine}, Innkeeper ${r.theirs} this round.`; l2 = `Totals: you ${r.you}, Innkeeper ${r.inn}`; primary = 'Next round'; }
  else if (r.kind === 'turn') { title = r.shut ? 'YOU SHUT THE BOX!' : 'YOUR BOX'; big = r.score === 0 ? 'Perfect 0' : `Score ${r.score}`; l1 = bx.open ? `Open tiles: ${tilesOf(bx.open).join(', ')}` : 'Every tile is down.'; l2 = `Now the Innkeeper plays the same dice.`; primary = "Innkeeper's turn"; }
  else {
    title = r.shut ? 'SHUT THE BOX!' : 'BOX OVER'; big = r.score === 0 ? 'Perfect 0' : `Score ${r.score}`;
    l1 = bx.open ? `Open tiles: ${tilesOf(bx.open).join(', ')}` : 'Every tile is down.';
    l2 = g.mode === 'daily' ? (r.first ? `Daily saved. Streak ${r.streak}.` : `Practice only. Today's saved score: ${r.best === 0 ? 'shut' : r.best}.`) : r.newBest ? `New best!` : r.best !== null ? `Best ${r.best}` : '';
    primary = g.mode === 'daily' ? 'Practice again' : 'Next box';
  }
  goldText(ctx, title, cx, c.y + 74, 46, c.w - 50);
  text(ctx, big, cx, c.y + 160, Math.min(86, c.w * 0.14), CREAM, 'center', 800, DISPLAY);
  ctx.font = `500 26px ${UI}`; wrap(ctx, l1, c.w - 60).slice(0, 2).forEach((ln, i) => text(ctx, ln, cx, c.y + 214 + i * 32, 26, DIM, 'center', 500, UI));
  if (l2) text(ctx, l2, cx, c.y + 292, 27, GOLD, 'center', 700, UI);
  button(ctx, C.primary, primary, { kind: 'primary' }); button(ctx, C.second, 'Share', { disabled: r.kind === 'turn' || r.kind === 'round' }); button(ctx, C.menu, 'Menu');
}

// ---- documents -------------------------------------------------------------------------------------------------------------------------
const docCache = new Map();
function layoutDoc(ctx, S, page, W, scale, key) {
  const hit = docCache.get(key); if (hit) return hit;
  const ops = []; let y = 0; const body = 30 * scale, lh = body * 1.34, gap = body * 0.55;
  ctx.font = `800 ${34 * scale}px ${DISPLAY}`; for (const ln of wrap(ctx, page.title, W)) { ops.push({ t: 'text', s: ln, x: 0, y: y + 34 * scale, size: 34 * scale, color: '#fff0c0', weight: 800, font: DISPLAY }); y += 34 * scale * 1.3; } y += gap * 0.6;
  for (const b of page.blocks) {
    if (b.gap) { y += gap * 2; continue; }
    if (b.h) { ctx.font = `800 ${38 * scale}px ${DISPLAY}`; const ls = wrap(ctx, b.h, W); for (const ln of ls) { ops.push({ t: 'text', s: ln, x: 0, y: y + 38 * scale, size: 38 * scale, color: GOLD, weight: 800, font: DISPLAY }); y += 38 * scale * 1.3; } y += gap * 0.4; continue; }
    if (b.p || b.li) {
      const ind = b.li ? 34 * scale : 0, str = b.p || b.li; ctx.font = `500 ${body}px ${UI}`; const ls = wrap(ctx, str, W - ind);
      if (b.li) ops.push({ t: 'dot', x: 10 * scale, y: y + body * 0.72, r: 5 * scale });
      for (const ln of ls) { ops.push({ t: 'text', s: ln, x: ind, y: y + body, size: body, color: CREAM, weight: 500, font: UI }); y += lh; }
      y += gap; continue;
    }
    if (b.tiles) { const n = b.tiles.n, tw = Math.min(88 * Math.min(scale, 1.7), (W - 6) / n), th = tw * 1.3; ops.push({ t: 'tiles', n, shut: b.tiles.shut, sel: b.tiles.sel, tw, th, x: 0, y: y + 6 }); y += th + gap * 1.6; continue; }
    if (b.dice) { const sz = 92 * Math.min(scale, 1.6); ops.push({ t: 'dice', faces: b.dice, size: sz, x: 0, y: y + 6 }); y += sz * 1.15 + gap * 1.6; continue; }
  }
  const v = { ops, height: y + 40 }; docCache.set(key, v); if (docCache.size > 60) docCache.delete(docCache.keys().next().value); return v;
}
function drawDoc(ctx, S, L) {
  const D = L.doc, doc = DOCS[S.docId], page = doc.pages[S.docPage], scale = TEXT_SCALES[S.textScaleIdx];
  text(ctx, doc.title, D.header.title.x, D.header.title.y + 36, 38, GOLD, 'left', 800, DISPLAY);
  const sub = `${page.title}   ·   ${S.docPage + 1}/${doc.pages.length}   ·   text ${Math.round(scale * 100)}%`;
  const ss = fitText(ctx, sub, D.header.title.w, 22, 500); text(ctx, sub, D.header.title.x, D.header.title.y + 64, ss, DIM, 'left', 500);
  button(ctx, D.header.dec, 'A-', { size: 26, disabled: S.textScaleIdx === 0 }); button(ctx, D.header.inc, 'A+', { size: 26, disabled: S.textScaleIdx === TEXT_SCALES.length - 1 });
  const vp = D.viewport; panel(ctx, vp, 0.55);
  const W = vp.w - D.pad * 2 - 14, key = `${S.docId}:${S.docPage}:${scale}:${Math.round(W)}`, lay = layoutDoc(ctx, S, page, W, scale, key);
  docMetrics.view = vp.h - 24; docMetrics.max = Math.max(0, lay.height - docMetrics.view);
  if (S.docScroll > docMetrics.max) S.docScroll = docMetrics.max;
  ctx.save(); rr(ctx, vp.x + 2, vp.y + 2, vp.w - 4, vp.h - 4, 16); ctx.clip();
  const ox = vp.x + D.pad, oy = vp.y + 14 - S.docScroll;
  for (const o of lay.ops) {
    const y = oy + o.y; if (y < vp.y - 400 || y > vp.y + vp.h + 400) continue;
    if (o.t === 'text') text(ctx, o.s, ox + o.x, y, o.size, o.color, 'left', o.weight, o.font);
    else if (o.t === 'dot') { ctx.beginPath(); ctx.arc(ox + o.x, y, o.r, 0, 6.2832); ctx.fillStyle = GOLD; ctx.fill(); }
    else if (o.t === 'tiles') { const total = o.tw * o.n, x0 = ox + Math.max(0, (W - total) / 2); for (let k = 1; k <= o.n; k++) drawTile(ctx, { x: x0 + (k - 1) * o.tw, y, w: o.tw, h: o.th }, k, { flip: o.shut.includes(k) ? 1 : 0, lift: o.sel.includes(k) ? 1 : 0, style: S.tileKey, box: S.boxKey, t: 0 }); }
    else if (o.t === 'dice') { const gap = o.size * 1.3; o.faces.forEach((f, i) => drawDie(ctx, ox + o.size / 2 + 8 + i * gap, y + o.size / 2, o.size, f, { ang: i ? -0.15 : 0.12, tint: i ? 'red' : 'ivory' })); }
  }
  if (S.docId === 'about' && S.docPage === doc.pages.length - 1) drawCredit(ctx, ox + W / 2, oy + lay.height - 10, 20);
  ctx.restore();
  if (docMetrics.max > 0) { const sb = D.scrollbar, th = Math.max(36, sb.h * (docMetrics.view / lay.height)), ty = sb.y + (sb.h - th) * (S.docScroll / docMetrics.max); rr(ctx, sb.x, ty, sb.w, th, 6); ctx.fillStyle = 'rgba(233,189,90,0.7)'; ctx.fill(); }
  const nz = rowSize(ctx, [[D.nav.back, 'Back'], [D.nav.prev, '‹  Prev'], [D.nav.next, 'Next  ›']], 28);
  button(ctx, D.nav.back, 'Back', { size: nz }); button(ctx, D.nav.prev, '‹  Prev', { size: nz, disabled: S.docPage === 0 });
  button(ctx, D.nav.next, S.docPage < doc.pages.length - 1 ? 'Next  ›' : 'Done', { kind: 'primary', size: nz });
}
function drawSettings(ctx, S, L) {
  const C = L.settings, R = C.rows;
  text(ctx, 'Settings', C.title.x, C.title.y + 44, 42, GOLD, 'left', 800, DISPLAY);
  const row = (k, label, val, kind = 'plain') => button(ctx, R[k], label, { sub: val, kind, size: 30 });
  row('sound', 'Sound', S.sound ? 'On' : 'Off'); row('calm', 'Calm motion', S.calm ? 'On' : 'Off');
  row('box', 'Box finish', BOXES[S.boxKey].name); row('tiles', 'Tile style', S.tileKey[0].toUpperCase() + S.tileKey.slice(1));
  row('single', 'One die when allowed', S.single ? 'Yes' : 'No'); row('level', 'Innkeeper level', LEVELS[S.level].name);
  row('text', 'Text size (guides)', `${Math.round(TEXT_SCALES[S.textScaleIdx] * 100)}%`);
  row('reset', S.confirmReset ? 'Tap again to erase records' : 'Erase records', '', S.confirmReset ? 'danger' : 'plain');
  button(ctx, C.back, 'Back', { kind: 'primary' });
}
function drawSimple(ctx, S, L) {
  const c = { x: L.U.x0 + 24, y: L.U.y0 + L.U.h * 0.25, w: L.U.w - 48, h: Math.min(420, L.U.h * 0.5) }; panel(ctx, c, 0.7);
  goldText(ctx, 'THAT WAS THE DEMO', c.x + c.w / 2, c.y + 90, 44, c.w - 40);
  ctx.font = `500 28px ${UI}`; wrap(ctx, 'You have played the three boxes of the web demo. The full game has Tall Box, the Duel, the Daily Box and Watch & Learn: get Shut the Box on iPhone and Android.', c.w - 60).forEach((ln, i) => text(ctx, ln, c.x + c.w / 2, c.y + 160 + i * 38, 28, CREAM, 'center', 500));
  button(ctx, L.simple.back, 'Back to menu', { kind: 'primary' });
}

export function render(ctx, S, L) {
  drawTable(ctx, L.w, L.h, S.t, S.calm);
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, L); break;
    case 'play': if (S.g) drawPlay(ctx, S, L); break;
    case 'doc': drawDoc(ctx, S, L); break;
    case 'settings': drawSettings(ctx, S, L); break;
    case 'demo-limit': drawSimple(ctx, S, L); break;
    default: break;
  }
  void inRect; void ease;
}
