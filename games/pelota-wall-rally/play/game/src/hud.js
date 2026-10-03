// In-play HUD: scoreboard, prompts, aim marker and shot guide, stick, timing ring, shot chips, Think and Pause. Everything follows the text
// size (through PLAY_M) and is laid out by layout.hudLayout so hit-testing and drawing agree.
import { W, H, PLAY_M, hudLayout, inRect } from './layout.js';
import { FONT, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { SHOTS, SHOT_IDS, SERVE_SHOT_IDS, HW, L, BR, LEVELS, SWING_DELAY } from './consts.js';
import { projectV } from './camera.js';
import { LESSONS } from './content.js';

const TAU = Math.PI * 2;

export const kindsFor = (s) => (s.phase === 'serve' || (s.rally && s.rally.serve && !s.rally.struck) ? SERVE_SHOT_IDS : SHOT_IDS);

export function hudRects(G, sim) {
  const s = sim.s;
  const kinds = kindsFor(s);
  const lay = hudLayout(G.settings.textIdx, kinds.length);
  const hp = sim.humanPlayer();
  const serving = s.phase === 'serve' && hp && s.serve && s.serve.server === hp.id;
  return { lay, kinds, hp, serving };
}

const proj = (G, x, y, z) => { const c = G.sim.s.cam; return projectV(c, G.viewW || 720, G.viewH || 1280, x, y, z); };

function aimPos(G, a) {
  if (!a) return null;
  return a.wall === 'left' ? proj(G, HW, a.y, a.z) : proj(G, a.x, a.y, L);
}

function marker(ctx, G, a, col = '#ffd54a', lbl) {
  const p = aimPos(G, a);
  if (!p) return;
  const q = a.wall === 'left' ? proj(G, HW, a.y + 0.4, a.z) : proj(G, a.x, a.y + 0.4, L);
  const r = Math.max(14, q ? Math.abs(q.y - p.y) : 18);
  ctx.save();
  ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(255,213,74,0.22)';
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x - r * 1.4, p.y); ctx.lineTo(p.x - r * 0.45, p.y); ctx.moveTo(p.x + r * 0.45, p.y); ctx.lineTo(p.x + r * 1.4, p.y); ctx.moveTo(p.x, p.y - r * 1.4); ctx.lineTo(p.x, p.y - r * 0.45); ctx.moveTo(p.x, p.y + r * 0.45); ctx.lineTo(p.x, p.y + r * 1.4); ctx.stroke();
  if (lbl) { ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.fillText(lbl, p.x, p.y - r - 8); }
  ctx.restore();
}

function scoreboard(ctx, G, s, m) {
  const mt = s.match;
  const th = hudLayout(G.settings.textIdx, 3).topH;
  const g = ctx.createLinearGradient(0, -240, 0, th + 30); g.addColorStop(0, 'rgba(14,22,20,0.9)'); g.addColorStop(0.7, 'rgba(14,22,20,0.8)'); g.addColorStop(1, 'rgba(14,22,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, -240, W, th + 270);
  const colw = 250, cx = W / 2;
  const nm = (i) => {
    if (G.mode === 'watch') return i === 0 ? LEVELS[G.setup.watchA - 1].name : LEVELS[G.setup.opp - 1].name;
    if (i === 0) return s.cfg.mode === '2v2' ? 'You and partner' : 'You';
    return LEVELS[s.cfg.level - 1].name;
  };
  for (const i of [0, 1]) {
    const left = i === 0, x0 = left ? 18 : W - 18 - colw;
    ctx.fillStyle = i === 0 ? '#e0443a' : '#2a79d4';
    roundPath(ctx, x0, 14, 10, th - 44, 5); ctx.fill();
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    const ax = left ? x0 + 22 : x0 + colw - 22;
    let n = nm(i); ctx.font = `700 ${Math.round(24 * m)}px ${FONT}`;
    if (m > 1.4 && n.includes(' ')) n = n.split(' ')[0];
    while (ctx.measureText(n).width > colw - 60 && n.length > 3) n = n.slice(0, -2);
    ctx.fillStyle = '#fff6e4'; ctx.fillText(n, ax, 14 + 26 * m);
    ctx.font = `800 ${Math.round(58 * m)}px ${FONT}`; ctx.fillText(String(mt.pts[i]), ax, 14 + 26 * m + 56 * m);
    if (mt.serving === i && !s.cfg.drill) { ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(left ? x0 + colw - 20 : x0 + 20, 14 + 16 * m, 7 * Math.min(m, 1.4), 0, TAU); ctx.fill(); }
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${Math.round(22 * m)}px ${FONT}`;
  ctx.fillText(s.cfg.drill ? 'Practice' : `To ${mt.target}`, cx, 14 + 26 * m + 4 * m);
  if (s.rally && s.rally.serve && s.rally.faults > 0 && !s.cfg.drill) { ctx.font = `700 ${Math.round(18 * m)}px ${FONT}`; ctx.fillStyle = '#ff9a86'; ctx.fillText('Second serve', cx, 14 + 26 * m + 30 * m); }
}

function banner(ctx, text, big, col) {
  ctx.font = `800 ${big}px ${FONT}`;
  const lines = wrapLines(ctx, text, W - 90);
  const ph = lines.length * big * 1.2 + 26, py = Math.round(H * 0.3 - ph / 2);
  roundPath(ctx, 40, py, W - 80, ph, 20); ctx.fillStyle = 'rgba(14,22,20,0.82)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, W / 2, py + 14 + big * (0.95 + i * 1.2)));
}

function promptText(G, s, hp, serving) {
  if (G.mode === 'watch') return 'Watch & Learn';
  if (G.mode === 'drill' && G.learn.tally) return `${LESSONS[G.learn.cur].title.replace(/^\d+\. /, '')}: ${G.learn.tally.ok} good of ${G.learn.tally.n}`;
  if (serving) return 'Tap the wall to aim, press SERVE to bounce the ball, then SWING on the ring';
  if (s.phase === 'ready') return 'Get ready';
  if (s.cue && s.cue.claim && s.phase === 'live') return 'Press SWING when the ring closes';
  return '';
}

function ringOverlay(ctx, s, r, cue) {
  const dt = cue.tPress - s.t;
  if (dt > 0.9 || dt < -0.12) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = r.w * 0.36;
  const outer = rad + Math.max(0, dt / 0.9) * r.w * 0.5;
  ctx.save();
  const good = Math.abs(dt) < 0.07;
  ctx.lineWidth = 8; ctx.strokeStyle = good ? '#7fe8d6' : dt < 0 ? '#ff8a6a' : '#ffd54a';
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(rad, outer), 0, TAU); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
  ctx.restore();
}

export function renderHud(ctx, G, sim, view) {
  const s = sim.s;
  const { lay, kinds, hp, serving } = hudRects(G, sim);
  const m = lay.m;
  scoreboard(ctx, G, s, m);
  // bottom block backdrop
  const bg = ctx.createLinearGradient(0, lay.blockTop - 60, 0, H); bg.addColorStop(0, 'rgba(14,22,20,0)'); bg.addColorStop(0.35, 'rgba(14,22,20,0.55)'); bg.addColorStop(1, 'rgba(14,22,20,0.85)');
  ctx.fillStyle = bg; ctx.fillRect(0, lay.blockTop - 60, W, H - lay.blockTop + 60);
  const human = G.mode !== 'watch' && hp;
  // the player marker
  if (human) {
    const p = proj(G, hp.x, 2.0, hp.z);
    if (p) { ctx.save(); ctx.fillStyle = '#ffd54a'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 13, p.y - 22); ctx.lineTo(p.x + 13, p.y - 22); ctx.lineTo(p.x, p.y - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.font = `800 ${Math.round(18 * Math.min(m, 1.5))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.fillText('YOU', p.x, p.y - 28); ctx.restore(); }
  }
  // aim marker, shot guide
  if (human && (s.phase === 'live' || s.phase === 'serve' || s.phase === 'ready')) {
    marker(ctx, G, sim.currentAim(), '#ffd54a', s.ctl.aimSet || !s.ctl.autoAim ? 'Aim' : 'Auto aim');
    if (G.settings.guide && s.cue && (s.cue.claim || s.cue.serve) && s.phase === 'live') {
      const pv = sim.shotPreview(hp, sim.currentAim(), s.ctl.kind);
      if (pv) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,246,228,0.75)'; ctx.lineWidth = 3; ctx.setLineDash([3, 9]); ctx.lineCap = 'round'; ctx.beginPath();
        let on = false;
        for (let k = 0; k <= pv.f.n; k += 8) { const q = proj(G, pv.f.xs[k], pv.f.ys[k], pv.f.zs[k]); if (!q) continue; if (!on) { ctx.moveTo(q.x, q.y); on = true; } else ctx.lineTo(q.x, q.y); }
        ctx.stroke(); ctx.restore();
      }
    }
  }
  if (G.mode === 'watch' && s.hold && s.hold.decision && G.watch.phase !== 'think') marker(ctx, G, s.hold.decision.aim, '#7fe8d6', 'Plan');
  // ball readability: a faint trail of its recent screen positions, a ring on the floor under it, and a thin ring when it is small
  if (s.ball.vis && !s.ball.held) {
    const tr = G.ballTrail || (G.ballTrail = []);
    const bp0 = proj(G, s.ball.x, s.ball.y, s.ball.z);
    if (bp0) { tr.push({ x: bp0.x, y: bp0.y, r: Math.abs((proj(G, s.ball.x + BR, s.ball.y, s.ball.z) || bp0).x - bp0.x), t: s.t }); while (tr.length > 9 || (tr.length && s.t - tr[0].t > 0.16)) tr.shift(); }
    ctx.save();
    for (let i = 0; i < tr.length - 1; i++) { const k = (i + 1) / tr.length; ctx.fillStyle = `rgba(255,246,228,${0.16 * k})`; ctx.beginPath(); ctx.arc(tr[i].x, tr[i].y, Math.max(3, tr[i].r * (0.45 + 0.4 * k)), 0, TAU); ctx.fill(); }
    const g0 = proj(G, s.ball.x, 0, s.ball.z), g1 = proj(G, s.ball.x + BR * 1.6, 0, s.ball.z), g2 = proj(G, s.ball.x, 0, s.ball.z + BR * 1.6);
    if (g0 && g1 && g2 && s.ball.y > 0.25) { ctx.strokeStyle = 'rgba(255,246,228,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(g0.x, g0.y, Math.max(6, Math.abs(g1.x - g0.x)), Math.max(3, Math.abs(g2.y - g0.y)), 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  } else if (G.ballTrail) G.ballTrail.length = 0;
  // keep a far ball readable: a thin ring when it is small on screen
  if (s.ball.vis && !s.ball.held) {
    const p = proj(G, s.ball.x, s.ball.y, s.ball.z), q = proj(G, s.ball.x + BR, s.ball.y, s.ball.z);
    if (p && q) { const r = Math.abs(q.x - p.x); if (r < 17) { ctx.save(); ctx.strokeStyle = 'rgba(255,246,228,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, TAU); ctx.stroke(); ctx.restore(); } }
  }
  // prompt line
  const pt = promptText(G, s, hp, serving);
  if (pt) {
    const pw = W - 60, ps = Math.round(22 * Math.min(m, 1.6));
    ctx.font = `700 ${ps}px ${FONT}`; const lines = wrapLines(ctx, pt, pw - 36);
    const ph = lines.length * ps * 1.25 + 16, py = lay.blockTop - ph - 16;
    roundPath(ctx, 30, py, pw, ph, 16); ctx.fillStyle = 'rgba(14,22,20,0.7)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, W / 2, py + 10 + ps * (0.95 + i * 1.25)));
  }
  // point banner and feedback
  if (s.last && s.phase === 'dead' && s.t - s.last.t < 2.2) banner(ctx, s.last.text, Math.round(40 * Math.min(m, 1.5)), s.last.winner === 0 ? '#e0443a' : s.last.winner === 1 ? '#2a79d4' : '#ffd54a');
  else if (G.feedback && s.t - G.feedback.t < 1.1) { const f = G.feedback, big = Math.round(46 * Math.min(m, 1.5)); ctx.font = `800 ${big}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = f.col; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.fillText(f.text, W / 2, Math.round(H * 0.3)); ctx.shadowBlur = 0; }
  if (G.mode === 'watch') return renderWatchButtons(ctx, G, s, lay, m);
  // stick
  if (G.stick && G.stick.on) {
    ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,246,228,0.6)'; ctx.fillStyle = 'rgba(255,246,228,0.12)';
    ctx.beginPath(); ctx.arc(G.stick.ox, G.stick.oy, 70, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,246,228,0.7)'; ctx.beginPath(); ctx.arc(G.stick.x, G.stick.y, 28, 0, TAU); ctx.fill(); ctx.restore();
  }
  // chips and buttons
  kinds.forEach((k, i) => drawButton(ctx, lay.chips[i].rect, SHOTS[k].short, { active: s.ctl.kind === k, size: Math.round(26 * Math.min(m, 1.7)) }));
  const label = serving ? 'SERVE' : 'SWING';
  drawButton(ctx, lay.swing, label, { primary: true, size: Math.round(36 * Math.min(m, 1.6)) });
  if (s.cue && hp && s.cue.team === hp.team && !serving) ringOverlay(ctx, s, lay.swing, s.cue);
  drawButton(ctx, lay.util.think, 'Think', { dark: true, size: Math.round(26 * Math.min(m, 1.7)) });
  drawButton(ctx, lay.util.pause, 'Pause', { dark: true, size: Math.round(26 * Math.min(m, 1.7)) });
}

function renderWatchButtons(ctx, G, s, lay, m) {
  const w = G.watch;
  const sz = Math.round(24 * Math.min(m, 1.7));
  let msg = '';
  if (s.hold) {
    const d = s.hold.decision, tn = s.hold.team === 0 ? LEVELS[G.setup.watchA - 1].name : LEVELS[G.setup.opp - 1].name;
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)}s: ${tn} is weighing the shot.`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${tn}: ${d.summary}. ${d.reason}`;
    else msg = `ACT: ${d.summary}`;
  } else msg = 'ACT: the play continues.';
  const u = lay.util;
  const ps = Math.round(22 * Math.min(m, 1.5)), pw = W - 40;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pw - 30);
  const big = m >= 1.5;
  const bh = u.think.h, y1 = u.think.y;
  const ph = Math.min(lines.length, 9) * ps * 1.25 + 20, py = y1 - ph - 12 - (big ? bh + 10 : 0);
  roundPath(ctx, 20, py, pw, ph, 16); ctx.fillStyle = 'rgba(14,22,20,0.88)'; ctx.fill();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left';
  lines.slice(0, 9).forEach((l, i) => ctx.fillText(l, 36, py + 10 + ps * (0.95 + i * 1.25)));
  const rects = big ? [[14, y1 - bh - 10, 345, bh], [361, y1 - bh - 10, 345, bh], [14, y1, 345, bh], [361, y1, 345, bh]] : [[14, y1, 170, bh], [194, y1, 170, bh], [374, y1, 170, bh], [554, y1, 152, bh]];
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  W_RECTS.length = 0;
  rects.forEach((r, i) => { const rc = { x: r[0], y: r[1], w: r[2], h: r[3] }; W_RECTS.push(rc); drawButton(ctx, rc, labels[i], { primary: i === 0, dark: i > 0, size: sz }); });
}
export const W_RECTS = [];
export function watchHit(x, y) { return W_RECTS.findIndex((r) => inRect(r, x, y)); }

// Think panel (modal)
export function renderThink(ctx, G) {
  const t = G.think;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const m = PLAY_M[G.settings.textIdx];
  const x = 30, w = W - 60;
  const size = Math.round(26 * Math.min(m, 2));
  const k = Math.min(m, 1.6);
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.reason, w - 80);
  ctx.font = `700 ${Math.round(28 * k)}px ${FONT}`;
  const sm = wrapLines(ctx, t.summary, w - 50);
  const bh = Math.round(84 * Math.min(m, 1.5));
  const head = 108 + sm.length * 34 * k + 6;                 // title + summary
  const bodyH = size * 1.3 * lines.length + 24;
  const foot = bh * 2 + 40 + 14;
  const maxTotal = H - 80;
  const total = Math.min(maxTotal, head + bodyH + foot);
  const y = Math.max(40, (H - total) / 2);
  panel(ctx, x, y, w, total, { r: 26, fill: 'rgba(24,38,34,0.96)', stroke: 'rgba(255,246,228,0.5)' });
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${Math.round(34 * k)}px ${FONT}`; ctx.fillText('Coach says', W / 2, y + 56);
  ctx.fillStyle = '#7fe8d6'; ctx.font = `700 ${Math.round(28 * k)}px ${FONT}`;
  sm.forEach((l, i) => ctx.fillText(l, W / 2, y + 108 + i * 34 * k));
  const vy = y + head, vh = total - head - foot;
  const maxScroll = Math.max(0, bodyH - vh);
  const sc = Math.min(Math.max(0, t.scroll || 0), maxScroll); t.scroll = sc;
  G.thinkView = { x: x + 10, y: vy, w: w - 20, h: vh, maxScroll };
  ctx.save(); ctx.beginPath(); ctx.rect(x + 10, vy, w - 20, vh); ctx.clip();
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 30, vy - sc + size * (1 + i * 1.3)));
  ctx.restore();
  if (maxScroll > 0) {
    const th = Math.max(40, vh * (vh / bodyH)), ty = vy + (sc / maxScroll) * (vh - th);
    roundPath(ctx, x + w - 16, vy, 6, vh, 3); ctx.fillStyle = 'rgba(255,246,228,0.15)'; ctx.fill();
    roundPath(ctx, x + w - 16, ty, 6, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.7)'; ctx.fill();
    ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0';
    ctx.fillText(sc < maxScroll - 4 ? '▼ drag for more' : '▲ drag up', W / 2, vy + vh + 22);
  }
  const by = y + total - bh * 2 - 40;
  G.thinkRects = { use: { x: x + 24, y: by, w: w - 48, h: bh }, close: { x: x + 24, y: by + bh + 14, w: w - 48, h: bh } };
  drawButton(ctx, G.thinkRects.use, t.kind ? 'Use it' : 'OK', { primary: true, size: Math.round(30 * Math.min(m, 1.5)) });
  drawButton(ctx, G.thinkRects.close, 'Close', { dark: true, size: Math.round(28 * Math.min(m, 1.5)) });
}

// 2D fallback when WebGL is missing: the court and players drawn through the same camera maths.
export function renderFallback(ctx, G, view) {
  const sim = G.sim; if (!sim) return;
  const s = sim.s ? sim.s : sim;
  const P = (x, y, z) => proj(G, x, y, z);
  ctx.save();
  ctx.fillStyle = '#1b242c'; ctx.fillRect(0, 0, W, H);
  const corners = [[-HW, 0], [HW, 0], [HW, L], [-HW, L]].map(([x, z]) => P(x, 0, z));
  if (corners.every(Boolean)) { ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); ctx.fillStyle = '#cbbd9c'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a8322a'; ctx.stroke(); }
  const w0 = P(-HW, 0, L), w1 = P(HW, 0, L), t0 = P(-HW, 6.2, L), t1 = P(HW, 6.2, L);
  if (w0 && w1 && t0 && t1) { ctx.fillStyle = '#d8cdb6'; ctx.beginPath(); ctx.moveTo(w0.x, w0.y); ctx.lineTo(w1.x, w1.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t0.x, t0.y); ctx.closePath(); ctx.fill(); }
  const l0 = P(HW, 0, 0), l1 = P(HW, 6.2, 0), l2 = P(HW, 6.2, L);
  if (l0 && l1 && l2 && w1) { ctx.fillStyle = '#c9bd9f'; ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.lineTo(l2.x, l2.y); ctx.lineTo(w1.x, w1.y); ctx.closePath(); ctx.fill(); }
  const list = s.players.map((p) => ({ p, a: P(p.x, 0, p.z), b: P(p.x, 1.75, p.z) })).filter((o) => o.a && o.b).sort((u, v) => v.a.depth - u.a.depth);
  for (const { p, a, b } of list) { ctx.strokeStyle = p.team === 0 ? '#e0443a' : '#2a79d4'; ctx.lineWidth = Math.max(8, (a.y - b.y) * 0.22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(b.x, b.y - 6, Math.max(6, (a.y - b.y) * 0.1), 0, TAU); ctx.fill(); }
  if (s.ball.vis) { const bp = P(s.ball.x, s.ball.y, s.ball.z); const sh = P(s.ball.x, 0, s.ball.z); if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 12, 6, 0, 0, TAU); ctx.fill(); } if (bp) { ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(8, 150 / bp.depth), 0, TAU); ctx.fill(); } }
  ctx.restore();
}
