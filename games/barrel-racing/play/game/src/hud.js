// The play screen furniture drawn over the arena: scoreboard, clock, run cells, horse buttons, Burst, the steering knob, hint and Watch & Learn
// panels, result banner. Pure drawing from the game state G; hit-testing uses the same rectangles (playLayout / watchRects).
import { live, MIN_FONT, playLayout, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, paintButton, leatherPlate, wrapLines, panel, textShadow, fitPx } from './ui.js';
import { drawScene, makeCam } from './scene.js';
import { HORSES, ROUNDS, RUNS_PER_ROUND, CHALLENGE_LIVES, KNOCK_S, HINT_COST } from './consts.js';

const TAU = Math.PI * 2;
export const fmtT = (v, d = 2) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);

export function watchRects(L) {
  const w = Math.min(700, L.land ? L.arena.w - 20 : L.xr - L.xl - 24), x0 = Math.round(L.land ? L.arena.x + L.arena.w / 2 - w / 2 : L.cx - w / 2), bh = 84, y = L.yb - 14 - bh, g = 10;
  const bw = Math.floor((w - 3 * g) / 4);
  return [0, 1, 2, 3].map((k) => ({ x: x0 + k * (bw + g), y, w: bw, h: bh }));
}

const small = (ctx, px, wt = 400) => { ctx.font = `${wt} ${Math.max(MIN_FONT, Math.round(px))}px ${FONT}`; };
function pill(ctx, x, y, w, h, fill = 'rgba(30,16,6,0.78)', stroke = 'rgba(255,255,255,0.22)') {
  // a dark tooled-leather plaque with a brass edge and a row of stitches
  void fill; void stroke;
  const r = Math.min(24, h / 2);
  roundPath(ctx, x, y + 4, w, h, r); ctx.fillStyle = 'rgba(10,4,0,0.35)'; ctx.fill();
  leatherPlate(ctx, { x, y, w, h }, { look: { g: ['#4a3322', '#34210f', '#24160a'], edge: '#d6aa54', stitch: 'rgba(224,184,120,0.55)', hi: 0.16 }, r, stitch: h > 64 });
}

// the runs of a round as little cells showing the net time of each
function cells(ctx, x, y, w, n, results, cur) {
  const gap = Math.min(150, (w - 8) / n), cw = gap - 10, ch = 32;
  const x0 = x + w / 2 - gap * n / 2 + 5;
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * gap, a = results[i];
    roundPath(ctx, cx, y - ch / 2, cw, ch, 10);
    ctx.fillStyle = a ? (a.knocked ? 'rgba(214,69,61,0.55)' : 'rgba(255,214,90,0.5)') : 'rgba(255,255,255,0.1)'; ctx.fill();
    ctx.lineWidth = i === cur && !a ? 3 : 1.5; ctx.strokeStyle = i === cur && !a ? '#fff' : 'rgba(255,255,255,0.35)'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${MIN_FONT}px ${FONT}`;
    ctx.fillText(a ? fmtT(a.net, 1) : '-', cx + cw / 2, y + 1);
  }
}

export function renderHud(ctx, G) {
  const W = live.w, H = live.h;
  const L = playLayout(G.settings.textIdx);
  const gl = G.gl();
  const c = makeCam(W, H, L.arena, L.land, gl, G.focusFor()); G.cam = c;
  const run = G.run, s = run ? run.s : null;
  ctx.clearRect(0, 0, W, H);
  const info = G.sceneState(run);
  drawScene(ctx, c, info);
  // what the 3D presenter draws behind this canvas: the same camera, the run, the rival's ghost
  G.v3 = gl ? { rig: c.rig, run: s, barrels: null, ghost: info.ghost, look: info.look, horse: G.horse } : null;

  const mode = G.mode, R = G.round;
  // scoreboard
  const B = L.board;
  pill(ctx, B.x, B.y, B.w, B.h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let t1 = '', t2 = '';
  const so = (n) => fmtT(n, 1);
  if (mode === 'cup' || mode === 'shot') { t1 = `${ROUNDS[R.idx].name} · run ${Math.min(RUNS_PER_ROUND, R.runIdx + 1)}`; t2 = `You ${so(R.total)}  ·  Rival ${so(R.rivalSoFar)}`; }
  else if (mode === 'watch') { t1 = `Watch & Learn · ${ROUNDS[R.idx].name}`; t2 = `Rider ${so(R.total)}  ·  Rival ${so(R.rivalSoFar)}`; }
  else if (mode === 'challenge') { t1 = `Time Trial · run ${R.runIdx + 1} · target ${G.par ? fmtT(G.par, 1) : '-'} s`; t2 = `Score ${R.score}  ·  ${'♥'.repeat(Math.max(0, CHALLENGE_LIVES - R.strikes))}${'♡'.repeat(Math.min(CHALLENGE_LIVES, R.strikes))}`; }
  else if (mode === 'drill') { t1 = G.drill ? G.drill.title : 'Drill'; t2 = G.drill ? `Goal: ${G.drill.goal}` : ''; }
  else { t1 = 'Practice'; t2 = `${R.runIdx} runs · best ${R.bestRun < 900 ? so(R.bestRun) : '-'}`; }
  const bw = B.w - 24;
  // a narrow board (landscape phone) drops the long part of the title rather than overflowing
  { ctx.font = `700 ${MIN_FONT}px ${FONT}`; const wide = (t) => ctx.measureText(t).width > bw;
    if (wide(t1)) t1 = t1.split(' · ')[0] === t1 ? t1 : (wide(t1.split(' · ').slice(0, -1).join(' · ')) ? t1.split(' · ')[0] : t1.split(' · ').slice(0, -1).join(' · ')); }
  const f1 = fitPx(ctx, t1, 700, 28, bw, MIN_FONT), f2 = fitPx(ctx, t2, 700, 34, bw, MIN_FONT);
  ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.font = `700 ${f1}px ${FONT}`; ctx.fillText(t1, B.x + B.w / 2, B.y + 10 + f1 * 0.85);
  ctx.fillStyle = '#fff'; ctx.font = `800 ${f2}px ${FONT}`; ctx.fillText(t2, B.x + B.w / 2, B.y + 14 + f1 + f2 * 0.82);
  if ((mode === 'cup' || mode === 'watch' || mode === 'shot') && B.h > 100) cells(ctx, B.x, B.y + B.h - 26, B.w, RUNS_PER_ROUND, R.mine, R.runIdx);

  // the clock
  if (s) {
    const K = L.clock;
    pill(ctx, K.x, K.y, K.w, K.h, 'rgba(18,10,4,0.82)', 'rgba(255,214,90,0.5)');
    const shown = s.finished ? s.time : s.clock;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    small(ctx, Math.min(40, K.h * 0.72), 800); ctx.fillStyle = '#fff';
    ctx.fillText(`${fmtT(shown, 2)} s`, K.x + K.w * 0.42, K.y + K.h / 2 + 1);
    small(ctx, 24, 700); ctx.fillStyle = s.knocked ? '#ff9a8a' : 'rgba(255,255,255,0.75)';
    ctx.fillText(s.knocked ? `+${s.knocked * KNOCK_S}` : `${Math.min(3, s.stage)}/3`, K.x + K.w * 0.86, K.y + K.h / 2 + 1);
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
  if (showTop) { btnIcon(L.pause, 'pause'); if (s && s.phase === 'ride' && !G.think && !s.finished) btnIcon(L.think, 'think'); }
  else btnIcon(L.pause, 'pause');

  // horse buttons while the rider waits at the line
  if (s && s.phase === 'ready' && mode !== 'watch') {
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
    const ly = L.chips[0].y - 14, lbl = L.land ? 'Choose a horse' : 'Choose your horse to set off';
    const lf = fitPx(ctx, lbl, 700, 26, L.land ? L.chips[0].w : L.xr - L.xl - 20, MIN_FONT);
    ctx.font = `700 ${lf}px ${FONT}`;
    textShadow(ctx, lbl, L.land ? L.chips[0].x + L.chips[0].w / 2 : L.cx, ly, '#fff', 6);
    L.chips.forEach((r, k) => {
      drawButton(ctx, r, HORSES[k].name, { primary: k === G.horse, dark: k !== G.horse, size: 28, sub: HORSES[k].blurb });
    });
  }
  // Burst while riding
  if (s && s.phase === 'ride' && !s.finished && mode !== 'watch') {
    const r = L.burst, ready = !s.burstUsed;
    paintButton(ctx, r, { primary: ready, dark: !ready });
    ctx.save(); ctx.fillStyle = ready ? '#fffaf0' : 'rgba(255,255,255,0.45)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    small(ctx, Math.min(40, r.h * 0.3), 800); ctx.fillText(s.burstT > 0 ? 'GO!' : 'Burst', r.x + r.w / 2, r.y + r.h / 2 - 4);
    small(ctx, 22, 700); ctx.fillText(s.burstT > 0 ? '' : ready ? 'or flick up' : 'used', r.x + r.w / 2, r.y + r.h / 2 + r.h * 0.22);
    ctx.restore();
    // the steering knob under the thumb
    const gr = G.c.grab;
    if (gr) {
      ctx.save(); ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(gr.ax, gr.ay, 62, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,214,90,0.9)'; ctx.beginPath(); ctx.arc(gr.ax + Math.max(-1, Math.min(1, gr.steer)) * 62, gr.ay + gr.brake * 62, 26, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // result banner after the finish
  if (s && s.finished) {
    const f = Math.min(1, Math.max(0, s.afterT / 0.35)), e = 1 - Math.pow(1 - f, 3);
    const cy = L.bannerY;
    ctx.save(); ctx.translate(L.land ? L.arena.x + L.arena.w / 2 : L.cx, cy); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.globalAlpha = Math.min(1, e * 1.4);
    const word = s.dnf ? 'TOO SLOW' : `${fmtT(s.net, 2)} s`;
    const col = s.dnf ? '#ff8a7a' : s.knocked ? '#ffd0a0' : '#ffd45a';
    const fs = Math.min(104, Math.floor((live.w - 60) / (word.length * 0.62)));
    ctx.font = `900 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(20,12,4,0.85)'; ctx.strokeText(word, 0, 0);
    ctx.fillStyle = col; ctx.fillText(word, 0, 0);
    const tags = [];
    if (!s.dnf) tags.push(s.knocked ? `${s.knocked} ${s.knocked === 1 ? 'barrel' : 'barrels'} down +${s.knocked * KNOCK_S} s` : 'Clean run');
    if (s.hintCost) tags.push(`hint +${HINT_COST} s`);
    if (mode === 'challenge' && G.par) tags.push(s.net <= G.par ? `${fmtT(G.par - s.net, 1)} s under the target` : `${fmtT(s.net - G.par, 1)} s over the target`);
    small(ctx, 28, 700); ctx.fillStyle = '#fff';
    const tag = tags.join('  ·  ');
    if (tag) { ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,12,4,0.85)'; ctx.strokeText(tag, 0, 46); ctx.fillText(tag, 0, 46); }
    const rv = R.rivalAll && R.rivalAll[R.runIdx];
    if (rv && (mode === 'cup' || mode === 'watch')) {
      const t = `Rival this run: ${fmtT(rv.net, 2)} s`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,12,4,0.85)'; ctx.strokeText(t, 0, 90); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(t, 0, 90);
    }
    ctx.restore();
  }

  if (G.think) renderThink(ctx, G, L);
  if (mode === 'watch') renderWatch(ctx, G, L);
  // first-run coaching
  if (s && s.phase === 'ride' && !s.finished && !G.think && mode !== 'watch' && mode !== 'shot' && G.progress.rounds === 0 && G.progress.best === 0 && R.runIdx < 2 && !G.hintMsg) {
    const txt = 'Slide to steer, down to slow';
    const aw = (L.land ? L.arena.w : L.xr - L.xl) - 40;
    const fs = fitPx(ctx, txt, 800, 26, aw - 40, MIN_FONT);
    ctx.font = `800 ${fs}px ${FONT}`; const tw = Math.min(aw, ctx.measureText(txt).width + 40);
    const cxp = L.land ? L.arena.x + L.arena.w / 2 : L.cx, py = L.arena.y + 46;
    pill(ctx, cxp - tw / 2, py, tw, fs + 26, 'rgba(30,16,6,0.8)', 'rgba(255,212,90,0.8)');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9a0'; ctx.fillText(txt, cxp, py + (fs + 26) / 2);
  }
  if (G.hintMsg && s && s.phase === 'ride') { small(ctx, 24, 700); ctx.textAlign = 'center'; textShadow(ctx, G.hintMsg, L.cx, L.noteY + 40, '#fff', 6); }
}

function noteBox(ctx, L, lines, y, title) {
  const avail = L.land ? L.arena.w - 20 : L.xr - L.xl - 28;
  const w = Math.min(660, avail), x = Math.round((L.land ? L.arena.x + L.arena.w / 2 : L.cx) - w / 2);
  const fs = Math.max(MIN_FONT, 26);
  ctx.font = `400 ${fs}px ${FONT}`;
  const wrapped = lines.flatMap((l) => wrapLines(ctx, l, w - 40));
  const h = 28 + (title ? fs * 1.4 : 0) + wrapped.length * fs * 1.3 + 16;
  panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(30,16,6,0.9)', stroke: 'rgba(255,255,255,0.35)' });
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
  drawButton(ctx, r, 'Carry on', { primary: true, size: 28 });
  G.thinkRects = { close: r };
}

function renderWatch(ctx, G, L) {
  const wt = G.watch, rects = watchRects(L), st = G.settings;
  const s = G.run ? G.run.s : null;
  if (wt.lines && wt.lines.length && (wt.phase === 'think' || wt.phase === 'reveal') && s && !s.finished) {
    const n = wt.phase === 'reveal' ? wt.lines.length : Math.max(1, Math.min(wt.lines.length, Math.ceil(wt.lines.length * (1 - wt.timer / Math.max(0.1, THINK_STEPS[st.thinkIdx])) + 0.001)));
    const title = wt.phase === 'think' ? `Thinking...  ${Math.ceil(wt.timer)}` : 'Reveal';
    noteBox(ctx, L, wt.lines.slice(0, n), L.noteY + 8, title);
  } else if (s && s.finished) {
    const lines = s.dnf ? ['The run took too long and was stopped.']
      : [`Ridden time ${fmtT(s.time, 2)} s${s.knocked ? `, plus ${s.knocked * KNOCK_S} s for ${s.knocked} ${s.knocked === 1 ? 'barrel' : 'barrels'} knocked over` : ', with every barrel left standing'}: net time ${fmtT(s.net, 2)} s.`,
        `It crossed the line at ${s.lineSpeed.toFixed(1)} metres a second and its top speed was ${s.maxSpeed.toFixed(1)}.`];
    noteBox(ctx, L, lines, L.noteY + 8, 'Result');
  } else if (wt.phase === 'act' && s && s.phase === 'ride') {
    noteBox(ctx, L, ['The rider follows the planned line.'], L.noteY + 8, 'Act');
  }
  const labels = [wt.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Stop'];
  const subs = [wt.paused ? 'Paused' : '', `${THINK_STEPS[st.thinkIdx]} s`, `${THINK_STEPS[st.thinkIdx]} s`, ''];
  rects.forEach((r, i) => drawButton(ctx, r, labels[i], { primary: i === 0 && wt.paused, dark: !(i === 0 && wt.paused), size: 26, disabled: (i === 1 && st.thinkIdx === 0) || (i === 2 && st.thinkIdx === THINK_STEPS.length - 1), sub: i === 1 || i === 2 ? subs[i] : null }));
  if (wt.paused) {
    small(ctx, 30, 800); ctx.textAlign = 'center'; textShadow(ctx, 'PAUSED', L.land ? L.arena.x + L.arena.w / 2 : L.cx, L.bannerY + 40, '#ffd45a', 8);
  }
}
