// The play screen furniture drawn over the field: scoreboard, clock, Shield / Spur / Grab buttons, banners, hint and Watch & Learn panels.
// Pure drawing from the game state G; hit-testing uses the same rectangles (playLayout).
import { live, MIN_FONT, playLayout, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, paintButton, wrapLines, panel, textShadow, fitPx, paintMaterial } from './ui.js';
import { drawScene, makeCam } from './scene.js';
import { ROUNDS, GAUNTLET_TIME, SCOOP_REACH, STRIP_REACH, SCOOP_VMAX } from './consts.js';
import { fmtClock } from './sim.js';

const TAU = Math.PI * 2;
const TEAM_COL = ['#2a64bd', '#d4463c'];

const small = (ctx, px, wt = 400) => { ctx.font = `${wt} ${Math.max(MIN_FONT, Math.round(px))}px ${FONT}`; };
function pill(ctx, x, y, w, h, fill = 'rgba(10,16,30,0.8)', stroke = 'rgba(255,255,255,0.22)') {
  // a carved walnut plaque with a brass rim (the gold-rimmed variant is used for coaching notes)
  void fill;
  ctx.save(); roundPath(ctx, x, y + 4, w, h, Math.min(24, h / 2)); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
  paintMaterial(ctx, x, y, w, h, Math.min(24, h / 2), { top: '#4a2f1b', bot: '#26160b', rim: /255,212,90/.test(stroke) ? '#ffd45a' : '#cf9f45', brass: true, grain: true });
}

// what the Grab button can do right now
export function grabState(G) {
  const s = G.run.s, me = s.riders[0], sk = s.sack;
  const car = s.sack.h >= 0 ? s.riders[s.sack.h] : null;
  if (s.phase !== 'play' || s.resetT > 0) return { kind: 'none', label: 'Grab', sub: '' };
  if (car === me) return { kind: 'none', label: 'Carrying', sub: s.sack.rounded ? 'to the circle' : 'round the post' };
  if (!car) {
    const d = Math.hypot(me.x - sk.x, me.y - sk.y);
    if (me.scoopT > 0) return { kind: 'lean', label: 'Leaning', sub: '' };
    if (d <= SCOOP_REACH) return { kind: 'scoop', label: 'Scoop', sub: me.v > SCOOP_VMAX - 0.4 ? 'too fast' : 'now', ready: me.v <= SCOOP_VMAX };
    return { kind: 'none', label: 'Grab', sub: `${Math.round(d)} m` };
  }
  if (car.team !== me.team) {
    const d = Math.hypot(me.x - car.x, me.y - car.y);
    if (d <= STRIP_REACH) return { kind: 'strip', label: 'Strip', sub: me.stripCd > 0 ? 'wait' : 'now', ready: me.stripCd <= 0 };
    return { kind: 'none', label: 'Grab', sub: `${Math.round(d)} m` };
  }
  return { kind: 'none', label: 'Grab', sub: 'team mate has it' };
}

export function renderHud(ctx, G) {
  const W = live.w, H = live.h;
  const L = playLayout(G.settings.textIdx);
  const c = makeCam(W, H, L.arena, L.land, G.focus); G.cam = c;
  const run = G.run, s = run ? run.s : null;
  ctx.clearRect(0, 0, W, H);
  drawScene(ctx, c, G.sceneState(run));
  const mode = G.mode;
  const me = s ? s.riders[0] : null;

  // scoreboard
  const B = L.board;
  pill(ctx, B.x, B.y, B.w, B.h);
  if (s) {
    ctx.textBaseline = 'middle';
    const cy = B.y + B.h / 2;
    const f = fitPx(ctx, '88 - 88', 800, Math.min(44, B.h * 0.56), B.w * 0.34, MIN_FONT);
    // team colour dots and score
    ctx.textAlign = 'center';
    ctx.fillStyle = TEAM_COL[0]; ctx.beginPath(); ctx.arc(B.x + B.w * 0.12, cy, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = TEAM_COL[1]; ctx.beginPath(); ctx.arc(B.x + B.w * 0.52, cy, 11, 0, TAU); ctx.fill();
    ctx.font = `800 ${f}px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText(String(s.score[0]), B.x + B.w * 0.25, cy + 1);
    ctx.fillText(String(s.score[1]), B.x + B.w * 0.65, cy + 1);
    // the clock
    const sm = Math.max(MIN_FONT, Math.round(f * 0.9));
    ctx.font = `800 ${sm}px ${FONT}`; ctx.fillStyle = s.ot ? '#ffb48a' : s.clock < 15 && s.phase === 'play' ? '#ffd45a' : '#fff';
    ctx.fillText(fmtClock(s.clock), B.x + B.w * 0.87, cy + 1);
  }
  // pause and think buttons
  const btnIcon = (r, glyph) => {
    paintButton(ctx, r, { dark: true });
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.fillStyle = '#fff6e4';
    const k = r.w / 76;
    if (glyph === 'pause') { ctx.fillRect(-14 * k, -16 * k, 10 * k, 32 * k); ctx.fillRect(4 * k, -16 * k, 10 * k, 32 * k); }
    else { ctx.font = `800 ${Math.round(40 * k)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 2); }
    ctx.restore();
  };
  btnIcon(L.pause, 'pause');
  if (mode !== 'watch' && s && s.phase === 'play' && !G.think) btnIcon(L.think, 'think');

  // the three buttons
  if (mode !== 'watch' && s) {
    const gs = grabState(G), held = G.c.held || {};
    const lit = !!(gs.ready);
    const btn = (r, label, sub, o) => {
      paintButton(ctx, r, o);
      ctx.save(); ctx.fillStyle = o.primary || o.active ? '#fffaf0' : o.disabled ? 'rgba(255,255,255,0.45)' : '#fff6e4';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const f = Math.max(MIN_FONT + 4, Math.min(40, Math.round(r.h * 0.3)));
      ctx.font = `800 ${f}px ${FONT}`;
      let px = f; while (ctx.measureText(label).width > r.w - 20 && px > MIN_FONT) { px -= 1; ctx.font = `800 ${px}px ${FONT}`; }
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 - (sub ? r.h * 0.1 : 0));
      if (sub) { small(ctx, Math.round(22 * Math.min(1.3, (L.m || 1))), 700); ctx.globalAlpha = 0.85; ctx.fillText(sub, r.x + r.w / 2, r.y + r.h / 2 + r.h * 0.24); }
      ctx.restore();
    };
    const carrying = s.sack.h === 0;
    btn(L.shield, 'Shield', carrying ? (me.shield ? 'tucked in' : 'hold') : 'with the sack', { active: !!held.shield && carrying, dark: !(held.shield && carrying), disabled: !carrying });
    btn(L.spur, 'Spur', me.st < 0.12 ? 'blown' : `${Math.round(me.st * 100)}%`, { active: !!held.sprint, dark: !held.sprint });
    btn(L.grab, gs.label, gs.sub, { primary: lit || gs.kind === 'lean', dark: !(lit || gs.kind === 'lean') });
  }

  // banners from events
  const bn = G.banner;
  if (bn && bn.t > 0) {
    const f = Math.min(1, (bn.max - bn.t) / 0.25), e = 1 - Math.pow(1 - f, 3), fade = Math.min(1, bn.t / 0.4);
    const cx = L.arena.x + L.arena.w / 2, cy = L.bannerY;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.globalAlpha = Math.min(1, e * 1.4) * fade;
    const fs = Math.min(bn.size || 96, Math.floor((L.arena.w - 40) / (bn.text.length * 0.62)));
    ctx.font = `900 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(8,12,24,0.85)'; ctx.strokeText(bn.text, 0, 0);
    ctx.fillStyle = bn.color || '#ffd45a'; ctx.fillText(bn.text, 0, 0);
    if (bn.sub) { small(ctx, 28, 700); ctx.fillStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeText(bn.sub, 0, 46); ctx.fillText(bn.sub, 0, 46); }
    ctx.restore();
  }

  // the chukka has not started
  if (s && s.phase === 'ready' && mode !== 'watch' && !G.pauseMenu) {
    const lines = [];
    const r = G.round;
    const t1 = mode === 'cup' ? ROUNDS[r.idx].name : mode === 'challenge' ? 'Gauntlet' : mode === 'drill' ? G.drill.title : 'Practice';
    const w = Math.min(640, L.arena.w - 40), x = Math.round(L.arena.x + L.arena.w / 2 - w / 2), y = Math.round(L.arena.y + L.arena.h * 0.58);
    const fs = Math.max(MIN_FONT, 28);
    const msg = mode === 'drill' ? `Goal: ${G.drill.goal}` : mode === 'challenge' ? `${GAUNTLET_TIME} seconds, three rival carries end it` : `${s.riders.filter((q) => q.team === 0).length} against ${s.riders.filter((q) => q.team === 1).length} · ${fmtClock(s.clock)}`;
    ctx.font = `700 ${fs}px ${FONT}`;
    const ml = wrapLines(ctx, msg, w - 40);
    const h = 40 + fs * 1.2 + ml.length * fs * 1.25 + fs * 1.4 + 20;
    panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(10,16,30,0.9)', stroke: 'rgba(255,255,255,0.35)' });
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffd45a'; ctx.font = `800 ${Math.round(fs * 1.15)}px ${FONT}`; ctx.fillText(t1, x + w / 2, y + 20 + fs * 1.1);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${fs}px ${FONT}`; ml.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 28 + fs * 2.2 + i * fs * 1.25));
    ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${fs}px ${FONT}`; ctx.fillText('Tap the field to start', x + w / 2, y + h - 22);
  }

  // coaching for the first matches
  if (s && s.phase === 'play' && mode !== 'watch' && !G.think && G.progress.rounds === 0 && G.progress.best === 0 && s.t < 20 && s.score[0] + s.score[1] === 0 && !G.banner?.t) {
    const txt = s.sack.h === 0 ? (s.sack.rounded ? 'Ride into the white circle' : 'Carry it round the post') : s.sack.h < 0 ? 'Hold a finger where you want to ride' : 'Ride alongside, then Grab';
    const aw = L.arena.w - 40, fs = fitPx(ctx, txt, 800, 26, aw - 40, MIN_FONT);
    ctx.font = `800 ${fs}px ${FONT}`; const tw = Math.min(aw, ctx.measureText(txt).width + 40);
    const cxp = L.arena.x + L.arena.w / 2, py = L.land ? L.board.y + L.board.h + 8 : L.arena.y + 10;
    pill(ctx, cxp - tw / 2, py, tw, fs + 26, 'rgba(10,16,30,0.82)', 'rgba(255,212,90,0.8)');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9a0'; ctx.fillText(txt, cxp, py + (fs + 26) / 2);
  }

  if (G.think) renderThink(ctx, G, L);
  if (mode === 'watch') renderWatch(ctx, G, L);
}

function noteBox(ctx, L, lines, y, title) {
  const avail = L.arena.w - 20;
  const w = Math.min(660, avail), x = Math.round(L.arena.x + L.arena.w / 2 - w / 2);
  const fs = Math.max(MIN_FONT, Math.round(26 * (L.m || 1)));
  ctx.font = `400 ${fs}px ${FONT}`;
  const wrapped = lines.flatMap((l) => wrapLines(ctx, l, w - 40));
  const h = 28 + (title ? fs * 1.4 : 0) + wrapped.length * fs * 1.3 + 16;
  panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(10,16,30,0.92)', stroke: 'rgba(255,255,255,0.35)' });
  let yy = y + 20;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (title) { ctx.font = `800 ${Math.round(fs * 1.1)}px ${FONT}`; ctx.fillStyle = '#ffd45a'; yy += fs * 0.9; ctx.fillText(title, x + 20, yy); yy += fs * 0.5; }
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff';
  for (const l of wrapped) { yy += fs * 1.3; ctx.fillText(l, x + 20, yy - fs * 0.2); }
  return { x, y, w, h };
}

function renderThink(ctx, G, L) {
  const th = G.think;
  const box = noteBox(ctx, L, th.lines, L.noteY, 'Think');
  const r = { x: box.x + box.w - 190, y: box.y + box.h + 12, w: 190, h: 76 };
  drawButton(ctx, r, 'Carry on', { primary: true, size: 28 });
  G.thinkRects = { close: r };
}

function renderWatch(ctx, G, L) {
  const wt = G.watch, rects = L.watchBtns, st = G.settings;
  const s = G.run ? G.run.s : null;
  if (wt.lines && wt.lines.length && (wt.phase === 'think' || wt.phase === 'reveal') && s && !s.over) {
    const n = wt.phase === 'reveal' ? wt.lines.length : Math.max(1, Math.min(wt.lines.length, Math.ceil(wt.lines.length * (1 - wt.timer / Math.max(0.1, THINK_STEPS[st.thinkIdx])) + 0.001)));
    const title = wt.phase === 'think' ? `Thinking...  ${Math.ceil(wt.timer)}` : 'Reveal';
    noteBox(ctx, L, wt.lines.slice(0, n), L.noteY, title);
  } else if (wt.phase === 'act' && s && s.phase === 'play') {
    noteBox(ctx, L, ['The rider follows the plan.'], L.noteY, 'Act');
  } else if (s && s.phase === 'ready') {
    noteBox(ctx, L, ['The computer rides your rider and explains each decision. Pause freezes everything.'], L.noteY, 'Watch & Learn');
  }
  const labels = [wt.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Stop'];
  const subs = [wt.paused ? 'Paused' : '', `${THINK_STEPS[st.thinkIdx]} s`, `${THINK_STEPS[st.thinkIdx]} s`, ''];
  rects.forEach((r, i) => drawButton(ctx, r, labels[i], { primary: i === 0 && wt.paused, dark: !(i === 0 && wt.paused), size: 26, disabled: (i === 1 && st.thinkIdx === 0) || (i === 2 && st.thinkIdx === THINK_STEPS.length - 1), sub: i === 1 || i === 2 ? subs[i] : null }));
  if (wt.paused) {
    small(ctx, 30, 800); ctx.textAlign = 'center'; textShadow(ctx, 'PAUSED', L.arena.x + L.arena.w / 2, L.bannerY, '#ffd45a', 8);
  }
}
