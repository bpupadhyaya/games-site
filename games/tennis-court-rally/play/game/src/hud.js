// In-play HUD: scoreboard, prompts, landing marker and shot guide, closing ring, stance / Think / Pause. Everything follows the text size (through
// PLAY_M) and is laid out by layout.hudLayout so hit-testing and drawing agree. The HUD projects court points through the same live camera the
// 3D presenter renders with.
import { W, H, PLAY_M, hudLayout, watchLayout, inRect, host, minFont, isWide } from './layout.js';
import { FONT, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { SHOTS, HW, HL, SL, BR, LEVELS, FORMATS, SURFACES } from './consts.js';
import { projectV, camFor } from './camera.js';
import { LESSONS } from './content.js';
import { shotFromDrag } from './sim.js';
import { pointText } from './score.js';

const TAU = Math.PI * 2;
const NEAR = '#f4f4ef', FAR = '#e8786a', LIME = '#d9f27a';

export function hudRects(G, sim) {
  const lay = hudLayout(G.settings.textIdx);
  const hp = sim.humanPlayer();
  const serving = sim.servingHuman();
  return { lay, hp, serving };
}
const proj = (x, y, z) => projectV(camFor(W / H), W, H, x, y, z);

// a circle on the floor around (x, z), projected
function floorRing(ctx, x, z, r, fill, stroke, lw = 4) {
  ctx.beginPath();
  let ok = true;
  for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU, p = proj(x + Math.cos(a) * r, 0.01, z + Math.sin(a) * r); if (!p) { ok = false; break; } if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  if (!ok) return null;
  ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  return proj(x, 0.01, z);
}

function marker(ctx, aim, col, lbl, a = 1) {
  if (!aim) return;
  ctx.save(); ctx.globalAlpha = a;
  const c = floorRing(ctx, aim.x, aim.z, 0.5, 'rgba(217,242,122,0.22)', col, 4);
  if (c) {
    const q = proj(aim.x, 0.01, aim.z + 0.5), r = Math.max(10, q ? Math.abs(q.y - c.y) : 14);
    ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(c.x - r * 1.6, c.y); ctx.lineTo(c.x - r * 0.4, c.y); ctx.moveTo(c.x + r * 0.4, c.y); ctx.lineTo(c.x + r * 1.6, c.y); ctx.stroke();
    if (lbl) { ctx.font = `800 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 5; ctx.fillText(lbl, c.x, c.y - r * 2.2 - 6); }
  }
  ctx.restore();
}

function scoreboard(ctx, G, s, lay) {
  const sc = s.sc, m = lay.sm, th = lay.topH, y0 = host.t;
  const g = ctx.createLinearGradient(0, -240, 0, th + 24); g.addColorStop(0, 'rgba(10,22,16,0.88)'); g.addColorStop(0.75, 'rgba(10,22,16,0.7)'); g.addColorStop(1, 'rgba(10,22,16,0)');
  ctx.fillStyle = g; ctx.fillRect(0, -240, W, th + 264);
  const nm = (i) => {
    if (G.mode === 'watch') return i === 0 ? LEVELS[G.setup.watchA - 1].name : LEVELS[G.setup.opp - 1].name;
    return i === 0 ? 'You' : LEVELS[s.cfg.level - 1].name;
  };
  const pw = Math.min(W - 40 - 2 * Math.max(host.l, host.r), Math.round((lay.wide ? 460 : 620) * Math.min(1.25, 0.8 + m * 0.2))), px = Math.round(lay.cx - pw / 2);
  const rowH = Math.round(54 * m), ph = rowH * 2 + 14, py = y0 + 12 + (lay.wide ? 0 : 6);
  roundPath(ctx, px, py, pw, ph, 18); ctx.fillStyle = 'rgba(8,18,14,0.78)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,244,239,0.28)'; ctx.stroke();
  const pts = pointText(sc), serving = G.sim.s.serve ? G.sim.s.rally.server : -1;
  const cur = serving >= 0 ? serving : sc.server;
  for (const i of [0, 1]) {
    const ry = py + 7 + i * rowH;
    ctx.fillStyle = i === 0 ? NEAR : FAR; roundPath(ctx, px + 12, ry + 6, 8, rowH - 12, 4); ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(minFont(26 * m))}px ${FONT}`; ctx.fillStyle = '#fbfaf2';
    let n = nm(i); while (ctx.measureText(n).width > pw * 0.4 && n.length > 3) n = n.slice(0, -2);
    ctx.fillText(n, px + 34, ry + rowH / 2);
    if (sc.server === i && !s.cfg.drill) { ctx.fillStyle = LIME; ctx.beginPath(); ctx.arc(px + 34 + ctx.measureText(n).width + 14, ry + rowH / 2, 6 * Math.min(m, 1.4), 0, TAU); ctx.fill(); }
    ctx.textAlign = 'right';
    ctx.font = `800 ${Math.round(40 * m)}px ${FONT}`; ctx.fillStyle = LIME; ctx.fillText(String(sc.games[i]), px + pw - 120 * Math.min(m, 1.3), ry + rowH / 2);
    ctx.font = `800 ${Math.round(36 * m)}px ${FONT}`; ctx.fillStyle = '#fbfaf2'; ctx.fillText(pts[i], px + pw - 22, ry + rowH / 2);
  }
  G.sbBottom = py + ph + Math.round(24 * Math.min(m, 1.3)) + 8;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(244,244,239,0.7)'; ctx.font = `700 ${Math.round(minFont(18 * m))}px ${FONT}`;
  const lab = s.cfg.drill ? 'Practice' : `${FORMATS[s.cfg.fmt].name}${sc.tb ? ' · Tiebreak' : ''} · ${SURFACES[s.cfg.surface].short}`;
  ctx.fillText(lab, lay.cx, py + ph + Math.round(24 * Math.min(m, 1.3)));
  if (s.rally && s.rally.serve && !s.rally.serveDone && s.rally.serveNo > 1 && !s.cfg.drill) { ctx.fillStyle = '#ffb59a'; ctx.fillText('Second serve', lay.cx, py + ph + Math.round(24 * Math.min(m, 1.3)) + Math.round(24 * Math.min(m, 1.3))); }
}

function banner(ctx, text, big, col, lay, sub) {
  ctx.font = `800 ${big}px ${FONT}`;
  const bw = lay.bannerW, lines = wrapLines(ctx, text, bw - 10);
  const ph = lines.length * big * 1.2 + 26 + (sub ? big * 0.7 : 0), py = Math.round(H * 0.34 - ph / 2);
  roundPath(ctx, lay.cx - bw / 2, py, bw, ph, 20); ctx.fillStyle = 'rgba(8,18,14,0.84)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fbfaf2'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, lay.cx, py + 14 + big * (0.95 + i * 1.2)));
  if (sub) { ctx.font = `700 ${Math.round(big * 0.6)}px ${FONT}`; ctx.fillStyle = LIME; ctx.fillText(sub, lay.cx, py + ph - 14); }
}

function promptText(G, s, serving) {
  if (G.mode === 'watch') return '';
  if (G.mode === 'drill' && G.learn.tally) return `${LESSONS[G.learn.cur].title.replace(/^\d+\. /, '')}: ${G.learn.tally.ok} good of ${G.learn.tally.n}`;
  if (serving && s.phase === 'serve' && !s.toss) return 'Press to toss, drag to aim, release as the ring closes';
  if (s.phase === 'ready') return 'Get ready';
  if (s.cue && s.cue.claim && s.phase === 'live') return 'Drag to aim, release when the ring closes';
  return '';
}

// the closing ring: around the ball's contact point, shrinking to the target size at the ideal release
function ringOverlay(ctx, s, cue) {
  const dt = cue.tPress - s.t;
  if (dt > 1.1 || dt < -0.14 || !cue.cp) return;
  const p = proj(cue.cp.x, cue.cp.y, cue.cp.z), q = proj(cue.cp.x + 0.5, cue.cp.y, cue.cp.z);
  if (!p) return;
  const base = Math.max(26, q ? Math.abs(q.x - p.x) * 0.9 : 30), outer = base + Math.max(0, dt / 1.1) * base * 3.2;
  const good = Math.abs(dt) < 0.07;
  ctx.save();
  ctx.lineWidth = 6; ctx.strokeStyle = good ? '#7fe8d6' : dt < 0 ? '#ff8a6a' : '#ffd54a';
  ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(base, outer), 0, TAU); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, base, 0, TAU); ctx.stroke();
  ctx.restore();
}

export function renderHud(ctx, G, sim, view) {
  const s = sim.s;
  const { lay, hp, serving } = hudRects(G, sim);
  const m = lay.m;
  G.dbg = { prompt: null };
  scoreboard(ctx, G, s, lay);
  if (!lay.wide) {
    const bg = ctx.createLinearGradient(0, lay.barTop - 50, 0, H); bg.addColorStop(0, 'rgba(10,22,16,0)'); bg.addColorStop(0.4, 'rgba(10,22,16,0.55)'); bg.addColorStop(1, 'rgba(10,22,16,0.85)');
    ctx.fillStyle = bg; ctx.fillRect(0, lay.barTop - 50, W, H - lay.barTop + 50);
  } else if (G.mode !== 'watch') {
    const lw = lay.util.think.x + lay.util.think.w + 70, gl = ctx.createLinearGradient(0, 0, lw, 0); gl.addColorStop(0, 'rgba(10,22,16,0.7)'); gl.addColorStop(0.5, 'rgba(10,22,16,0.5)'); gl.addColorStop(1, 'rgba(10,22,16,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, lay.topH, lw, H - lay.topH);
  }
  const human = G.mode !== 'watch' && hp;
  if (human) {
    const p = proj(hp.x, 2.0, hp.z);
    if (p) { ctx.save(); ctx.fillStyle = LIME; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 12, p.y - 20); ctx.lineTo(p.x + 12, p.y - 20); ctx.lineTo(p.x, p.y - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.font = `800 ${minFont(Math.round(17 * Math.min(m, 1.5)))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 4; ctx.fillText('YOU', p.x, p.y - 26); ctx.restore(); }
  }
  // landing marker from the current drag (or the auto aim / Think suggestion)
  const live = human && (s.phase === 'live' || s.phase === 'serve' || s.phase === 'ready');
  if (live) {
    let sh = null;
    const side = -1;
    if (G.assist) sh = { kind: G.assist.kind, aim: G.assist.aim, assist: true };
    else if (G.drag && G.drag.on) {
      const dx = G.drag.x - G.drag.x0, dy = G.drag.y - G.drag.y0;
      sh = shotFromDrag(dx, dy, side, serving, s.rally ? s.rally.boxSign : 1, s.rally ? s.rally.serveNo : 1);
      if (sh.tap) sh = s.autoAim && G.settings.autoAim ? { ...s.autoAim, auto: true } : null;
    } else if (serving && s.autoAim && G.settings.autoAim) sh = { ...s.autoAim, auto: true };
    if (sh && sh.aim) {
      const dragging = G.drag && G.drag.on && !sh.auto;
      marker(ctx, sh.aim, dragging || sh.assist ? LIME : 'rgba(217,242,122,0.7)', `${SHOTS[sh.kind].short}${sh.auto ? ' (auto)' : ''}`, dragging || sh.assist ? 1 : 0.75);
      if (G.settings.guide && dragging) {
        const cp = s.cue && s.cue.cp ? s.cue.cp : { x: hp.x, y: serving ? 2.7 : 1.0, z: hp.z + 0.5 };
        const pv = sim.previewShot(cp, sh.aim, sh.kind);
        if (pv) {
          ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([3, 9]); ctx.lineCap = 'round'; ctx.beginPath();
          let on = false;
          for (let k = 0; k <= pv.f.n; k += 10) { const q = proj(pv.f.xs[k], pv.f.ys[k], pv.f.zs[k]); if (!q) continue; if (!on) { ctx.moveTo(q.x, q.y); on = true; } else ctx.lineTo(q.x, q.y); }
          ctx.stroke(); ctx.restore();
        }
      }
    }
  }
  if (G.mode === 'watch' && s.hold && s.hold.decision && G.watch.phase !== 'think') marker(ctx, s.hold.decision.aim, '#7fe8d6', 'Plan');
  // the drag itself: where it started and where the finger is
  if (G.drag && G.drag.on) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(G.drag.x0, G.drag.y0, 18, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([2, 8]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(G.drag.x0, G.drag.y0); ctx.lineTo(G.drag.x, G.drag.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(G.drag.x, G.drag.y, 11, 0, TAU); ctx.fill(); ctx.restore();
  }
  // ball readability: a faint trail, and a ring when it is small
  if (s.ball.vis && !s.ball.held) {
    const tr = G.ballTrail || (G.ballTrail = []);
    const bp0 = proj(s.ball.x, s.ball.y, s.ball.z);
    if (bp0) { tr.push({ x: bp0.x, y: bp0.y, r: Math.abs((proj(s.ball.x + BR, s.ball.y, s.ball.z) || bp0).x - bp0.x), t: s.t }); while (tr.length > 9 || (tr.length && s.t - tr[0].t > 0.16)) tr.shift(); }
    ctx.save();
    for (let i = 0; i < tr.length - 1; i++) { const k = (i + 1) / tr.length; ctx.fillStyle = `rgba(240,248,170,${0.2 * k})`; ctx.beginPath(); ctx.arc(tr[i].x, tr[i].y, Math.max(2.5, tr[i].r * (0.45 + 0.4 * k)), 0, TAU); ctx.fill(); }
    if (bp0) { const r = Math.abs((proj(s.ball.x + BR, s.ball.y, s.ball.z) || bp0).x - bp0.x); if (r < 9) { ctx.strokeStyle = 'rgba(240,248,170,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bp0.x, bp0.y, 12, 0, TAU); ctx.stroke(); } }
    ctx.restore();
  } else if (G.ballTrail) G.ballTrail.length = 0;
  // ring cue for the human
  if (human && s.cue && s.cue.claim && (s.phase === 'live' || (s.phase === 'serve' && s.toss))) ringOverlay(ctx, s, s.cue);
  // prompt line
  const pt = promptText(G, s, serving);
  if (pt) {
    const pr = lay.prompt, pw = pr.w, ps = minFont(Math.round(22 * Math.min(m, 1.6)));
    ctx.font = `700 ${ps}px ${FONT}`; const lines = wrapLines(ctx, pt, pw - 36);
    const ph = lines.length * ps * 1.25 + 16, py = pr.bottom - ph;
    G.dbg.prompt = { x: pr.x, y: py, w: pw, h: ph };
    roundPath(ctx, pr.x, py, pw, ph, 16); ctx.fillStyle = 'rgba(10,22,16,0.7)'; ctx.fill();
    ctx.fillStyle = '#fbfaf2'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, pr.x + pw / 2, py + 10 + ps * (0.95 + i * 1.25)));
  }
  // point banner and feedback
  if (s.last && (s.phase === 'dead') && s.t - s.last.t < 2.0) {
    const L0 = s.last, col = L0.winner === 0 ? NEAR : L0.winner === 1 ? FAR : '#ffd54a';
    const sub = L0.kind === 'game' || L0.kind === 'set' ? `${s.sc.games[0]} – ${s.sc.games[1]}` : (L0.kind === 'point' ? pointText(s.sc).join(' – ') : null);
    const head = L0.kind === 'set' ? (G.mode === 'watch' ? 'Match' : L0.winner === 0 ? 'Game, set and match' : 'The rival wins the match') : L0.kind === 'game' ? (L0.winner === 0 ? 'Game: you' : 'Game: rival') : '';
    banner(ctx, head ? `${head}. ${L0.text}` : L0.text, Math.round(38 * Math.min(m, 1.5)), col, lay, sub);
  } else if (G.feedback && s.t - G.feedback.t < 1.1) { const f = G.feedback, big = Math.round(46 * Math.min(m, 1.5)); ctx.font = `800 ${big}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = f.col; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.fillText(f.text, lay.cx, Math.round(H * 0.34)); ctx.shadowBlur = 0; }
  if (G.mode === 'watch') return renderWatchButtons(ctx, G, s, lay, m);
  const bs = Math.round(26 * Math.min(m, 1.7));
  const stanceLab = s.ctl.stance === 'net' ? 'Net' : 'Back';
  drawButton(ctx, lay.util.stance, s.ctl.stance === 'net' ? 'At the net' : 'Baseline', { active: s.ctl.stance === 'net', dark: s.ctl.stance !== 'net', size: bs, sub: lay.wide ? null : 'tap to change' });
  drawButton(ctx, lay.util.think, 'Think', { dark: true, size: bs });
  drawButton(ctx, lay.util.pause, 'Pause', { dark: true, size: bs });
}

function renderWatchButtons(ctx, G, s, lay0, m0) {
  const w = G.watch, wl = watchLayout(G.settings.textIdx), m = wl.m;
  const sz = minFont(Math.round(24 * Math.min(m, 1.7)));
  let msg = '';
  if (s.hold) {
    const d = s.hold.decision, tn = s.hold.team === 0 ? LEVELS[G.setup.watchA - 1].name : LEVELS[G.setup.opp - 1].name;
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)}s: ${tn} is weighing the shot.`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${tn}: ${d.summary}. ${d.reason}`;
    else msg = `ACT: ${d.summary}`;
  } else msg = 'ACT: the play continues.';
  const ps = minFont(Math.round(22 * Math.min(m, 1.5))), pn = wl.panel;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pn.w - 30);
  const ph = Math.min(lines.length, 9) * ps * 1.25 + 20, py = pn.bottom - ph;
  roundPath(ctx, pn.x, py, pn.w, ph, 16); ctx.fillStyle = 'rgba(10,22,16,0.88)'; ctx.fill();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left';
  lines.slice(0, 9).forEach((l, i) => ctx.fillText(l, pn.x + 16, py + 10 + ps * (0.95 + i * 1.25)));
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  W_RECTS.length = 0;
  wl.rects.forEach((rc, i) => { W_RECTS.push(rc); drawButton(ctx, rc, labels[i], { primary: i === 0, dark: i > 0, size: sz }); });
  G.watchPanel = { x: pn.x, y: py, w: pn.w, h: ph };
}
export const W_RECTS = [];
export function watchHit(x, y) { return W_RECTS.findIndex((r) => inRect(r, x, y)); }

// Think panel (modal)
export function renderThink(ctx, G) {
  const t = G.think;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const m = PLAY_M[G.settings.textIdx], wide = isWide();
  const w = wide ? Math.min(W - 60 - 2 * Math.max(host.l, host.r), 760) : W - 60, x = Math.round((W - w) / 2);
  const size = Math.round(26 * Math.min(m, 2));
  const k = Math.min(m, 1.6);
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.reason, w - 80);
  ctx.font = `700 ${Math.round(28 * k)}px ${FONT}`;
  const sm = wrapLines(ctx, t.summary, w - 50);
  const bh = Math.round(84 * Math.min(m, wide ? 1.1 : 1.5));
  const head = 108 + sm.length * 34 * k + 6;
  const bodyH = size * 1.3 * lines.length + 24;
  const foot = (wide ? bh : bh * 2 + 14) + 40;
  const maxTotal = H - 40 - host.t - host.b;
  const total = Math.min(maxTotal, head + bodyH + foot);
  const y = Math.max(20 + host.t, (H - total) / 2);
  panel(ctx, x, y, w, total, { r: 26, fill: 'rgba(18,36,28,0.96)', stroke: 'rgba(255,246,228,0.5)' });
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${Math.round(34 * k)}px ${FONT}`; ctx.fillText('Coach says', W / 2, y + 56);
  ctx.fillStyle = '#7fe8d6'; ctx.font = `700 ${Math.round(28 * k)}px ${FONT}`;
  sm.forEach((l, i) => ctx.fillText(l, W / 2, y + 108 + i * 34 * k));
  const vy = y + head, vh = total - head - foot;
  const maxScroll = Math.max(0, bodyH - vh);
  const sc = Math.min(Math.max(0, t.scroll || 0), maxScroll); t.scroll = sc;
  G.thinkView = { x: x + 10, y: vy, w: w - 20, h: vh, maxScroll };
  ctx.save(); ctx.beginPath(); ctx.rect(x + 10, vy, w - 20, vh); ctx.clip();
  ctx.textAlign = 'left'; ctx.fillStyle = '#fbfaf2'; ctx.font = `400 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 30, vy - sc + size * (1 + i * 1.3)));
  ctx.restore();
  if (maxScroll > 0) {
    const th = Math.max(40, vh * (vh / bodyH)), ty = vy + (sc / maxScroll) * (vh - th);
    roundPath(ctx, x + w - 16, vy, 6, vh, 3); ctx.fillStyle = 'rgba(255,246,228,0.15)'; ctx.fill();
    roundPath(ctx, x + w - 16, ty, 6, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.7)'; ctx.fill();
    ctx.font = `700 ${minFont(20)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0';
    ctx.fillText(sc < maxScroll - 4 ? '▼ drag for more' : '▲ drag up', W / 2, vy + vh + 22);
  }
  const by = y + total - foot + 20;
  G.thinkRects = wide ? { use: { x: x + 24, y: by, w: (w - 48 - 14) / 2, h: bh }, close: { x: x + 24 + (w - 48 + 14) / 2, y: by, w: (w - 48 - 14) / 2, h: bh } }
    : { use: { x: x + 24, y: by, w: w - 48, h: bh }, close: { x: x + 24, y: by + bh + 14, w: w - 48, h: bh } };
  drawButton(ctx, G.thinkRects.use, t.kind ? 'Use it' : 'OK', { primary: true, size: Math.round(30 * Math.min(m, 1.5)) });
  drawButton(ctx, G.thinkRects.close, 'Close', { dark: true, size: Math.round(28 * Math.min(m, 1.5)) });
}

// 2D fallback when WebGL is missing: the court and players drawn through the same camera maths.
export function renderFallback(ctx, G, view) {
  const sim = G.sim; if (!sim) return;
  const s = sim.s ? sim.s : sim;
  const sf = SURFACES[s.surf] || SURFACES.lawn;
  const P = (x, y, z) => proj(x, y, z);
  ctx.save();
  ctx.fillStyle = sf.run; ctx.fillRect(0, 0, W, H);
  const poly = (pts, fill, stroke) => { const q = pts.map(([x, z]) => P(x, 0, z)); if (!q.every(Boolean)) return; ctx.beginPath(); q.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); } };
  poly([[-HW - 1, -HL], [HW + 1, -HL], [HW + 1, HL], [-HW - 1, HL]], sf.court, sf.line);
  poly([[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]], null, sf.line);
  poly([[-HW, -SL], [HW, -SL], [HW, SL], [-HW, SL]], null, sf.line);
  const n0 = P(-HW - 1, 0, 0), n1 = P(HW + 1, 0, 0), n2 = P(HW + 1, 0.95, 0), n3 = P(-HW - 1, 0.95, 0);
  if (n0 && n1 && n2 && n3) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.lineTo(n3.x, n3.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(n3.x, n3.y); ctx.lineTo(n2.x, n2.y); ctx.stroke(); }
  const list = s.players.map((p) => ({ p, a: P(p.x, 0, p.z), b: P(p.x, 1.75, p.z) })).filter((o) => o.a && o.b).sort((u, v) => v.a.depth - u.a.depth);
  for (const { p, a, b } of list) { ctx.strokeStyle = p.team === 0 ? NEAR : FAR; ctx.lineWidth = Math.max(8, (a.y - b.y) * 0.22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(b.x, b.y - 6, Math.max(6, (a.y - b.y) * 0.1), 0, TAU); ctx.fill(); }
  if (s.ball.vis) { const bp = P(s.ball.x, s.ball.y, s.ball.z); const sh = P(s.ball.x, 0, s.ball.z); if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 11, 5, 0, 0, TAU); ctx.fill(); } if (bp) { ctx.fillStyle = '#e4ee3a'; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(6, 70 / bp.depth), 0, TAU); ctx.fill(); } }
  ctx.restore();
}
export { SL as SERVICE_LINE };
