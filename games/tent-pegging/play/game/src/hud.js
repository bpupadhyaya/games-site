// The play screen furniture drawn over the lane: scoreboard, run pips, pace buttons, hint and Watch & Learn panels, result banner.
// Pure drawing from the game state G; hit-testing uses the same rectangles (playLayout / watchRects).
import { live, host, MIN_FONT, playLayout, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, paintButton, wrapLines, panel, textShadow, fitPx } from './ui.js';
import { drawScene, makeCam, project } from './scene.js';
import { PACES, ROUNDS, RUNS_PER_ROUND, CHALLENGE_LIVES, DROP, REACH, PTS } from './consts.js';

const TAU = Math.PI * 2;
const PIP = { lift: '#ffd45a', strike: '#d9dee8', miss: '#d6453d' };
export const OUT_NAME = { lift: 'LIFT', strike: 'TOUCH', miss: 'MISS' };

export function watchRects(L) {
  const w = Math.min(700, L.xr - L.xl - 24), x0 = Math.round(L.cx - w / 2), bh = 84, y = L.yb - 14 - bh, g = 10;
  const bw = Math.floor((w - 3 * g) / 4);
  return [0, 1, 2, 3].map((k) => ({ x: x0 + k * (bw + g), y, w: bw, h: bh }));
}

const small = (ctx, px, wt = 400) => { ctx.font = `${wt} ${Math.max(MIN_FONT, Math.round(px))}px ${FONT}`; };
function pill(ctx, x, y, w, h, fill = null, stroke = 'rgba(232,196,110,0.8)') {
  // a carved slate plaque with a brass hairline
  const r = Math.min(24, h / 2);
  ctx.save();
  roundPath(ctx, x, y + 5, w, h, r); ctx.fillStyle = 'rgba(6,4,0,0.35)'; ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (fill) { g.addColorStop(0, fill); g.addColorStop(1, fill); } else { g.addColorStop(0, 'rgba(40,52,84,0.9)'); g.addColorStop(1, 'rgba(14,20,40,0.93)'); }
  roundPath(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; roundPath(ctx, x + 3.5, y + 3.5, w - 7, h - 7, Math.max(3, r - 3.5)); ctx.stroke();
  ctx.restore();
}

function pips(ctx, x, y, w, n, results, rivals, cur) {
  const gap = Math.min(54, w / n), r = Math.min(15, gap * 0.34);
  const x0 = x + w / 2 - gap * (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * gap, a = results[i];
    ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU);
    if (a) { ctx.fillStyle = PIP[a.outcome]; ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.lineWidth = i === cur ? 3 : 1.5; ctx.strokeStyle = i === cur ? '#fff' : 'rgba(255,255,255,0.35)'; ctx.stroke(); }
    if (rivals && rivals[i] && a) { ctx.beginPath(); ctx.arc(cx, y + r + 9, 4.5, 0, TAU); ctx.fillStyle = PIP[rivals[i].outcome]; ctx.fill(); }
  }
}

export function renderHud(ctx, G, sceneOnly = false) {
  const W = live.w, H = live.h;
  const L = playLayout(G.settings.textIdx);
  const c = makeCam(W, H); G.cam = c;
  const run = G.run, s = run ? run.s : null;
  ctx.clearRect(0, 0, W, H);
  const info = G.sceneState(run, c);
  const out = drawScene(ctx, c, info);
  if (sceneOnly) return;     // ?bare=1 (icon renders): the picture only, no scoreboard, labels or buttons

  // distance label above the peg gate
  if (s && s.phase !== 'after') {
    const p = out.p3 ? out.p3(s.pegX, 3.4, s.pegZ) : project(c, out.camX, out.camZ, s.pegX, 3.2, s.pegZ, out.bob);
    const d = s.pegZ - s.z;
    if (p && d > 4) {
      const label = `${Math.max(0, Math.round(d))} m`;
      small(ctx, 24, 700); const tw = ctx.measureText(label).width + 22;
      pill(ctx, p.x - tw / 2, p.y - 54, tw, 38, 'rgba(14,20,40,0.7)');
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, p.x, p.y - 35);
    }
  }

  const mode = G.mode;
  // scoreboard
  const B = L.board;
  pill(ctx, B.x, B.y, B.w, B.h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const R = G.round;
  let t1 = '', t2 = '';
  if (mode === 'cup' || mode === 'shot') { t1 = ROUNDS[R.idx].name; t2 = `You ${R.total}  ·  Rival ${R.rivalSoFar}`; }
  else if (mode === 'watch') { t1 = `Watch & Learn · ${ROUNDS[R.idx].name}`; t2 = `Rider ${R.total}  ·  Rival ${R.rivalSoFar}`; }
  else if (mode === 'challenge') { t1 = `Gallop Challenge · run ${R.runIdx + 1}`; t2 = `Score ${R.total}  ·  ${'♥'.repeat(Math.max(0, CHALLENGE_LIVES - R.misses))}${'♡'.repeat(Math.min(CHALLENGE_LIVES, R.misses))}`; }
  else if (mode === 'drill') { t1 = G.drill ? G.drill.title : 'Drill'; t2 = G.drill ? `Goal: ${G.drill.goal}` : ''; }
  else { t1 = 'Practice'; t2 = `${R.runIdx} runs · ${R.total} points`; }
  const bw = B.w - 24;
  const f1 = fitPx(ctx, t1, 700, 30, bw, MIN_FONT), f2 = fitPx(ctx, t2, 700, 36, bw, MIN_FONT);
  ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.font = `700 ${f1}px ${FONT}`; ctx.fillText(t1, B.x + B.w / 2, B.y + 12 + f1 * 0.85);
  ctx.fillStyle = '#fff'; ctx.font = `800 ${f2}px ${FONT}`; ctx.fillText(t2, B.x + B.w / 2, B.y + 16 + f1 + f2 * 0.82);
  if (mode === 'cup' || mode === 'watch' || mode === 'shot') {
    const py = B.y + B.h - 30;
    pips(ctx, B.x, py, B.w, RUNS_PER_ROUND, R.mine, R.rivalRuns, R.runIdx);
  }
  // pause and think buttons
  const showTop = mode !== 'watch';
  const btnIcon = (r, glyph) => {
    paintButton(ctx, r, { dark: true });
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.fillStyle = '#fff6e4'; ctx.strokeStyle = '#fff6e4'; ctx.lineCap = 'round';
    const k = r.w / 76;
    if (glyph === 'pause') { ctx.fillRect(-14 * k, -16 * k, 10 * k, 32 * k); ctx.fillRect(4 * k, -16 * k, 10 * k, 32 * k); }
    else { ctx.font = `800 ${Math.round(40 * k)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 2); }
    ctx.restore();
  };
  if (showTop) { btnIcon(L.pause, 'pause'); if (s && s.phase === 'ride' && !G.think) btnIcon(L.think, 'think'); }
  else btnIcon(L.pause, 'pause');

  // pace buttons while the rider waits
  if (s && s.phase === 'ready' && mode !== 'watch') {
    const minP = G.cfg.minPace | 0;
    small(ctx, 26, 700); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
    textShadow(ctx, 'Choose your pace to set off', L.cx, L.chips[0].y - 14, '#fff', 6);
    L.chips.forEach((r, k) => {
      const dis = k < minP;
      drawButton(ctx, r, PACES[k].name, { primary: !dis && k === G.pace, dark: !dis && k !== G.pace, disabled: dis, size: 28, sub: dis ? 'Too slow here' : k === 2 ? `+${PTS.fast} on a lift` : k === 1 ? 'Balanced' : 'Steady' });
    });
  }

  // result banner after contact
  if (s && s.phase === 'after' && s.outcome) {
    const f = Math.min(1, Math.max(0, (s.t - s.contactT) / 0.35)), e = 1 - Math.pow(1 - f, 3);
    const cy = L.bannerY;
    ctx.save(); ctx.translate(L.cx, cy); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.globalAlpha = Math.min(1, e * 1.4);
    const word = s.unfired ? 'TOO LATE' : OUT_NAME[s.outcome];
    const col = s.outcome === 'lift' ? '#ffd45a' : s.outcome === 'strike' ? '#e8edf5' : '#ff8a7a';
    const fs = Math.min(104, Math.floor((live.w - 60) / (word.length * 0.7)));
    ctx.font = `900 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(20,12,4,0.85)'; ctx.strokeText(word, 0, 0);
    ctx.fillStyle = col; ctx.fillText(word, 0, 0);
    ctx.font = `800 ${Math.round(fs * 0.55)}px ${FONT}`; ctx.lineWidth = 8;
    const shown = s.points - (G.hinted && s.perfect ? PTS.perfect : 0), pts = shown > 0 ? `+${shown}` : '0';
    ctx.strokeText(pts, 0, fs * 0.62); ctx.fillStyle = '#fff'; ctx.fillText(pts, 0, fs * 0.62);
    const tags = [];
    if (s.outcome === 'lift') { const sb = Math.min(PTS.streakMax, R.streak); if (s.perfect && !G.hinted) tags.push('Perfect'); if (s.fast) tags.push('Full gallop'); if (sb > 0) tags.push(`Streak +${sb}`); if (!tags.length) tags.push('Clean lift'); }
    else tags.push(missNote(s));
    small(ctx, 28, 700); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6;
    const tag = tags.join('  ·  ');
    if (tag) { ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,12,4,0.85)'; ctx.strokeText(tag, 0, fs * 0.62 + 42); ctx.fillText(tag, 0, fs * 0.62 + 42); }
    ctx.restore();
    const rvNow = R.rivalAll && R.rivalAll[R.runIdx];
    if (rvNow && (mode === 'cup' || mode === 'watch')) {
      const rv = rvNow; small(ctx, 24, 700); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      textShadow(ctx, `Rival this run: ${OUT_NAME[rv.outcome]}${rv.points ? ' +' + rv.points : ''}`, L.cx, cy + fs * 0.62 + 96, 'rgba(255,255,255,0.9)', 6);
    }
  }

  // Think hint
  if (G.think) renderThink(ctx, G, L);
  // Watch & Learn panels
  if (mode === 'watch') renderWatch(ctx, G, L);
  // first-run coaching
  if (s && s.phase === 'ride' && !G.think && mode !== 'watch' && mode !== 'shot' && G.progress.rounds === 0 && G.progress.best === 0 && R.runIdx < 2 && !G.hintMsg) {
    const txt = 'Slide to put the ring on the peg. Let go to strike!';
    small(ctx, 26, 800); const tw = Math.min(live.w - 40, ctx.measureText(txt).width + 40);
    pill(ctx, L.cx - tw / 2, L.noteY + 46, tw, 52, 'rgba(14,20,40,0.78)', 'rgba(255,212,90,0.8)');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9a0'; ctx.fillText(txt, L.cx, L.noteY + 72);
  }
  // practice / drill result note
  if (G.hintMsg && s && s.phase === 'ride') { small(ctx, 24, 700); ctx.textAlign = 'center'; textShadow(ctx, G.hintMsg, L.cx, L.noteY + 40, '#fff', 6); }
}

export function missNote(s) {
  if (s.unfired) return 'The lance never came down';
  if (s.note === 'early') return 'Too early: the point landed short of the peg';
  if (s.note === 'late') return 'Too late: the point landed beyond the peg';
  if (s.note === 'left') return 'Off to the left of the peg';
  if (s.note === 'right') return 'Off to the right of the peg';
  return '';
}

function noteBox(ctx, L, lines, y, title) {
  const w = Math.min(660, L.xr - L.xl - 28), x = Math.round(L.cx - w / 2);
  const fs = Math.max(MIN_FONT, 26);
  ctx.font = `400 ${fs}px ${FONT}`;
  const wrapped = lines.flatMap((l) => wrapLines(ctx, l, w - 40));
  const h = 28 + (title ? fs * 1.4 : 0) + wrapped.length * fs * 1.3 + 16;
  panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(14,20,40,0.88)', stroke: 'rgba(255,255,255,0.35)' });
  let yy = y + 20;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (title) { ctx.font = `800 ${Math.round(fs * 1.1)}px ${FONT}`; ctx.fillStyle = '#ffd45a'; yy += fs * 0.9; ctx.fillText(title, x + 20, yy); yy += fs * 0.5; }
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff';
  for (const l of wrapped) { yy += fs * 1.3; ctx.fillText(l, x + 20, yy - fs * 0.2); }
  return { x, y, w, h };
}

function renderThink(ctx, G, L) {
  const th = G.think;
  const box = noteBox(ctx, L, th.lines, L.noteY + 8, 'Think');
  const r = { x: box.x + box.w - 190, y: box.y + box.h + 12, w: 190, h: 76 };
  if (r.y + r.h > L.chips[0].y - 4 && !L.land) r.y = box.y + box.h + 12;
  drawButton(ctx, r, 'Carry on', { primary: true, size: 28 });
  G.thinkRects = { close: r };
}

function renderWatch(ctx, G, L) {
  const wt = G.watch, rects = watchRects(L), st = G.settings;
  const s = G.run ? G.run.s : null;
  // explanation panel under the scoreboard
  if (wt.lines && wt.lines.length && (wt.phase === 'think' || wt.phase === 'reveal') && s && !s.outcome) {
    const n = wt.phase === 'reveal' ? wt.lines.length : Math.max(1, Math.min(wt.lines.length, Math.ceil(wt.lines.length * (1 - wt.timer / Math.max(0.1, THINK_STEPS[st.thinkIdx])) + 0.001)));
    const title = wt.phase === 'think' ? `Thinking...  ${Math.ceil(wt.timer)}` : 'Reveal';
    noteBox(ctx, L, wt.lines.slice(0, n), L.noteY + 8, title);
  } else if (s && s.outcome && s.phase === 'after') {
    const ms = Math.round(Math.abs(s.dtc) * 1000), cmx = Math.round(Math.abs(s.dx) * 100);
    const early = s.dtc < 0 ? 'early' : 'late', side = s.dx < 0 ? 'left' : 'right';
    const lines = s.unfired ? ['The lance never came down, so the peg went by.']
      : [`The point met the ground ${ms} milliseconds ${early} and ${cmx} cm to the ${side} of the peg.`,
        s.outcome === 'lift' ? 'That is inside the lift window, so the peg comes up on the lance.' : s.outcome === 'strike' ? 'That is inside the touch window but outside the lift window: the peg is knocked away.' : 'That is outside both windows: a miss.'];
    noteBox(ctx, L, lines, L.noteY + 8, 'Result');
  } else if (wt.phase === 'act' && s && s.phase === 'ride') {
    noteBox(ctx, L, ['The rider lets the lance come down at the planned moment.'], L.noteY + 8, 'Act');
  }
  const labels = [wt.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Stop'];
  const subs = [wt.paused ? 'Paused' : '', `${THINK_STEPS[st.thinkIdx]} s`, `${THINK_STEPS[st.thinkIdx]} s`, ''];
  rects.forEach((r, i) => drawButton(ctx, r, labels[i], { primary: i === 0 && wt.paused, dark: !(i === 0 && wt.paused), size: 26, disabled: (i === 1 && st.thinkIdx === 0) || (i === 2 && st.thinkIdx === THINK_STEPS.length - 1), sub: i === 1 || i === 2 ? subs[i] : null }));
  if (wt.paused) {
    small(ctx, 30, 800); ctx.textAlign = 'center'; textShadow(ctx, 'PAUSED', L.cx, L.bannerY + 40, '#ffd45a', 8);
  }
}
