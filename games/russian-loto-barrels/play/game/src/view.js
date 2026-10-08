// Russian Loto: Barrels. All drawing for every screen. Pure: reads the game state, never changes it (except the reader caches
// state.refMax / state.refView). The three play screens are drawn natively in screen units; every other screen is a DESIGN screen
// drawn at design size inside L.d's translate + scale.
import {
  THEMES, themeOf, roundPath, font, fitPx, wrapLines, drawButton, drawBackdrop, drawKeg, drawBag, drawTray, drawChip, drawCard, drawMini,
  drawParticles, fontFloor, ptr, mix, rgba, easeOutCubic, clamp01, NUMFONT, cardGeom,
} from './art.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { reached, claimable, activeStages, byId, GOALS, PACES, SKILLS, CPU_NAMES, NICKNAMES, numberWord, decadeLabel, colOf, KEGS, STAGE_POINTS, cardMarked, rowsDone, SCORE, HINTS_PER_ROUND } from './rules.js';
import { ABOUT, HOWTO, RULES, SAMPLE_CARD, SAMPLE_MARKS } from './content.js';
import { THEME_IDS } from './art.js';
import { meta } from './game.js';

const PI2 = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R2 = (x, y, w, h) => ({ x, y, w, h });
const scaleOf = (s) => TEXT_SCALES[s.textIdx] ?? 1;
const STAGE_LABEL = { row: 'ROW', two: 'TWO ROWS', loto: 'LOTO' };
const dropAt = (t) => t;

export function render(ctx, state, pointer, L) {
  const th = themeOf(state.theme), sc = state.scene, play = sc === 'play' || sc === 'duo' || sc === 'auto';
  drawBackdrop(ctx, th, state.t, L.w, L.h);
  // keep the kit's preview pill clear of the HUD: top centre on portrait play, stage foot in landscape, top-left in face to face
  meta.previewBadge = sc === 'duo' ? { x: L.U.x0 + (host.back ? host.back + 12 : 14), y: L.U.y0 + 6, align: 'left' }
    : (sc === 'play' || sc === 'auto') && L.land ? { x: L.play.stage.rect.x + L.play.stage.rect.w / 2, y: L.play.stage.rect.y + L.play.stage.rect.h - 52, align: 'center' } : null;
  const px = host.px || 0.6;
  if (play) {
    setPtr(pointer, null); fontFloor.u = clamp(11 / px, 10, 26);
    if (sc === 'duo') renderDuo(ctx, state, th, L); else renderPlay(ctx, state, th, L);
  } else {
    withDesign(ctx, L, pointer, (d) => {
      if (sc === 'menu') renderMenu(ctx, state, th, L, d);
      else if (sc === 'setup') renderSetup(ctx, state, th, d);
      else if (sc === 'about') renderPage(ctx, state, th, ABOUT, 'About', 'about', d);
      else if (sc === 'howto') renderPage(ctx, state, th, HOWTO, 'How to play', 'howto', d);
      else if (sc === 'rules') renderPage(ctx, state, th, RULES, 'Rules', 'rules', d);
      else if (sc === 'settings') renderSettings(ctx, state, th, d);
      else if (sc === 'demolimit') renderDemoLimit(ctx, state, th, d);
    });
  }
  drawParticles(ctx, state.parts);
  for (const f of state.floats) { const a = clamp01(1 - f.t / f.max); ctx.save(); ctx.globalAlpha = a; text(ctx, f.text, f.x, f.y, 26, { color: f.c, stroke: 4, weight: 800 }); ctx.restore(); }
}
function setPtr(pointer, d) {
  if (!pointer) { ptr.down = false; return; }
  ptr.down = pointer.down;
  if (d) { const q = d.to(pointer.x, pointer.y); ptr.x = q.x; ptr.y = q.y; } else { ptr.x = pointer.x; ptr.y = pointer.y; }
}
function withDesign(ctx, L, pointer, fn) {
  const d = L.d;
  ctx.save(); ctx.translate(d.dx, d.dy); ctx.scale(d.k, d.k);
  setPtr(pointer, d); fontFloor.u = clamp(11 / ((host.px || 0.6) * d.k), 10, 26);
  fn(d);
  ctx.restore(); setPtr(pointer, null);
}

// ---- small helpers ----------------------------------------------------------------------------------------------------------
function text(ctx, str, x, y, px, o = {}) {
  ctx.save();
  ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = o.color ?? '#fff';
  if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; }
  px = Math.max(px, fontFloor.u);
  const fam = o.num ? NUMFONT : undefined;
  const s = o.maxW ? fitPx(ctx, str, o.maxW, px, o.weight ?? 700, o.italic, o.min ?? fontFloor.u, fam) : px;
  ctx.font = font(s, o.weight ?? 700, o.italic, fam);
  if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = 'rgba(8,4,0,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillText(str, x, y);
  ctx.restore();
  return s;
}
function panel(ctx, r, th, rad = 22, a = 1, solid = false) {
  ctx.save(); ctx.globalAlpha = a;
  roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = solid ? mix(th.bg[2], th.bg[1], 0.25) : th.panel; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke();
  ctx.restore();
}
// brand-gradient hairline along the top of a panel (discreet; the game's own colours stay dominant)
function hairline(ctx, r) {
  ctx.save(); const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0); g.addColorStop(0, 'rgba(120,110,255,0)'); g.addColorStop(0.3, 'rgba(110,130,255,0.7)'); g.addColorStop(0.7, 'rgba(60,200,220,0.7)'); g.addColorStop(1, 'rgba(60,200,220,0)');
  ctx.fillStyle = g; ctx.fillRect(r.x + 18, r.y + 1, r.w - 36, 2); ctx.restore();
}
function toast(ctx, s, th, y, cx, w) {
  const k = s.toast; if (!k) return;
  const a = Math.min(1, k.t / 0.12, (k.max - k.t) / 0.25), h = 40;
  ctx.save(); ctx.globalAlpha = clamp01(a);
  roundPath(ctx, cx - w / 2, y - h / 2 + (1 - clamp01(a)) * 8, w, h, 20);
  ctx.fillStyle = k.kind === 'warn' ? 'rgba(190,40,40,0.94)' : k.kind === 'good' ? 'rgba(24,130,84,0.95)' : 'rgba(14,20,24,0.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke();
  text(ctx, k.text, cx, y + 1 + (1 - clamp01(a)) * 8, 22, { color: '#fff', maxW: w - 30, italic: true });
  ctx.restore();
}
const nameOf = (r, i) => (r.mode === 'duo' ? `Player ${i + 1}` : i === 0 ? 'You' : CPU_NAMES[r.players[i].name]);
const pill = (ctx, x, y, w, h, label, th, o = {}) => {
  ctx.save(); roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = o.fill ?? 'rgba(0,0,0,0.38)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(255,255,255,0.3)'; ctx.stroke();
  text(ctx, label, x + w / 2, y + h / 2 + 1, o.px ?? h * 0.5, { color: o.color ?? th.text, maxW: w - 16, weight: o.weight ?? 700 }); ctx.restore();
};

// ---- the kegs on the table -----------------------------------------------------------------------------------------------------
// A keg in motion: falls from the bag mouth to the tray centre with a bounce, tumbling and rolling.
function kegPose(r, P) {
  const tray = P.tray, tx = tray.x + tray.w / 2, ty = tray.y + tray.h / 2, k = P.kegBig;
  const bx = P.bag.cx + P.bag.size * 0.18, by = P.bag.cy - P.bag.size * 0.28;
  if (r.drop) {
    const t = clamp01(r.drop.t / 0.62), e = t * t, dir = r.drop.n % 2 ? 1 : -1;
    const x = bx + (tx - bx) * easeOutCubic(Math.min(1, t * 1.1)), y = by + (ty - by) * e - Math.sin(Math.min(1, t) * Math.PI) * k * 0.25;
    return { x, y, size: k * (0.55 + 0.45 * t), rot: dir * (1 - t) * 5.5, spin: t * 9 * dir, n: r.drop.n };
  }
  if (!r.last) return null;
  const c = r.callT, dec = Math.exp(-c * 5.5), dir = r.last % 2 ? 1 : -1;
  return { x: tx, y: ty - Math.abs(Math.sin(c * 16)) * dec * k * 0.12, size: k, rot: Math.sin(c * 17) * dec * 0.2 * dir, spin: Math.sin(c * 13) * dec * 0.9, n: r.last };
}
function drawRack(ctx, r, rect, kegS, th, wrap) {
  const gap = Math.max(5, kegS * 0.14), step = kegS * 1.18 + gap, perRow = Math.max(1, Math.floor((rect.w + gap) / step));
  const rows = wrap ? Math.max(1, Math.floor((rect.h + gap) / (kegS * 0.8 + gap))) : 1, cap = perRow * rows;
  const list = r.called.slice().reverse().slice(0, cap);
  list.forEach((n, i) => {
    const row = Math.floor(i / perRow), col = i % perRow, x = rect.x + kegS * 0.6 + col * step, y = rect.y + kegS * 0.4 + row * (kegS * 0.8 + gap);
    const open = i < r.window;
    drawKeg(ctx, x, y, kegS, n, { dim: open ? 0 : 0.42, glow: open && i < 3 ? 0.35 : 0, shadow: false });
  });
  return list.length;
}

// The stage: bag, tray with the current keg, the call, a progress bar to the next keg and the rack of recent kegs.
function drawStage(ctx, s, r, th, P, auto) {
  const S = P.rect;
  panel(ctx, S, th, 24, 0.9); hairline(ctx, S);
  drawBag(ctx, P.bag.cx, P.bag.cy, P.bag.size, s.t, r.drop ? 1 : r.timer < 0.4 ? 0.5 : 0, th);
  drawTray(ctx, P.tray, th);
  const kp = kegPose(r, P);
  if (kp) drawKeg(ctx, kp.x, kp.y, kp.size, kp.n, { rot: kp.rot, spin: kp.spin, glow: r.drop ? 0 : 0.28 });
  else text(ctx, 'Ready?', P.tray.x + P.tray.w / 2, P.tray.y + P.tray.h / 2, P.tray.h * 0.3, { color: th.sub, italic: true, maxW: P.tray.w - 20 });
  // progress to the next keg
  if (!auto && r.status === 'running' && r.drawn < KEGS) {
    const bw = P.tray.w * 0.8, bx = P.tray.x + (P.tray.w - bw) / 2, by = P.tray.y + P.tray.h + 6, k = clamp01(1 - r.timer / r.secs);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundPath(ctx, bx, by, bw, 6, 3); ctx.fill(); ctx.fillStyle = th.accent; roundPath(ctx, bx, by, Math.max(6, bw * k), 6, 3); ctx.fill();
  }
  // call text
  const T = P.text, cx = T.x + T.w / 2;
  if (auto) tutorText(ctx, s, r, th, T);
  else if (r.last) {
    const n = r.last, big = clamp(T.h * 0.4, 28, 60), word = numberWord(n);
    text(ctx, String(n), cx, T.y + T.h * 0.3, clamp(T.h * 0.62, 36, 112), { color: th.accent, weight: 800, num: true, stroke: 5, maxW: T.w });
    text(ctx, word, cx, T.y + T.h * 0.62, big * 0.52, { color: th.text, italic: true, maxW: T.w });
    text(ctx, NICKNAMES[n] ? `“${NICKNAMES[n]}”` : `Kegs left ${KEGS - r.drawn}`, cx, T.y + T.h * 0.86, big * 0.4, { color: th.sub, italic: !!NICKNAMES[n], weight: 400, maxW: T.w });
  } else text(ctx, 'Get ready', cx, T.y + T.h * 0.5, 34, { color: th.text, italic: true, maxW: T.w });
  drawRack(ctx, r, P.rack, P.kegS, th, P.mode === 'col');
  // the rack's legend
  if (P.mode === 'col') text(ctx, 'Open kegs are bright', S.x + S.w / 2, S.y + S.h - 12, 15, { color: th.sub, weight: 400, maxW: S.w - 20 });
}
function tutorText(ctx, s, r, th, T) {
  const a = r.auto, n = r.last; let l1 = '', l2 = '', big = true;
  const col = n ? colOf(n) : 0;
  if (a.phase === 'intro') { l1 = 'Watch & Learn'; l2 = 'Sit back: a whole round plays itself.'; big = false; }
  else if (a.phase === 'drop') { l1 = 'A keg is coming out of the bag…'; big = false; }
  else if (a.phase === 'think') { l1 = `${n}`; l2 = `Think: ${n} belongs in column ${col + 1} (${decadeLabel(col)}). Where is it on the cards? ${Math.max(1, Math.ceil(a.timer))}`; }
  else if (a.phase === 'reveal') { const t = a.targets[0]; l1 = `${n}`; l2 = t ? `Here it is: card ${t.ci + 1}, row ${Math.floor(t.cell / 9) + 1}.` : ''; }
  else if (a.phase === 'miss') { l1 = `${n}`; l2 = `Not on your cards. Column ${col + 1} (${decadeLabel(col)}) has nothing to cover.`; }
  else if (a.phase === 'claim') { l1 = 'Claim!'; const best = claimable(r.goal, r.players[a.who].cards, r.players[a.who].marks, r.claims); l2 = `${nameOf(r, a.who)}: ${best ? STAGE_LABEL[best] : ''}`; big = false; }
  else { l1 = n ? `${n}` : ''; l2 = n ? 'Chip it!' : ''; }
  const cx = T.x + T.w / 2;
  if (big && l1) text(ctx, l1, cx, T.y + T.h * 0.3, clamp(T.h * 0.5, 30, 92), { color: th.accent, weight: 800, num: true, stroke: 5, maxW: T.w });
  else if (l1) text(ctx, l1, cx, T.y + T.h * 0.3, clamp(T.h * 0.2, 18, 30), { color: th.text, italic: true, maxW: T.w });
  if (l2) {
    const px = clamp(T.h * 0.15, 15, 26); ctx.save(); ctx.font = font(px, 600); const lines = wrapLines(ctx, l2, T.w - 6); ctx.restore();
    lines.slice(0, 4).forEach((ln, i) => text(ctx, ln, cx, T.y + T.h * (big ? 0.62 : 0.55) + i * px * 1.25, px, { color: th.text, weight: 600, maxW: T.w }));
  }
}

// ---- HUD and opponents -----------------------------------------------------------------------------------------------------------
function drawHud(ctx, s, r, th, P, auto) {
  const me = r.players[0];
  pill(ctx, P.score.x, P.score.y, P.score.w, P.score.h, '', th);
  text(ctx, auto ? 'Lesson' : `${me.score}`, P.score.x + P.score.w * 0.36, P.score.y + P.score.h * 0.5, P.score.h * 0.55, { color: th.accent, weight: 800, num: true, maxW: P.score.w * 0.6 });
  if (!auto) {
    const mult = 1 + Math.min(SCORE.comboMax, Math.floor(me.streak / SCORE.comboStep)) * 0.25;
    text(ctx, me.streak >= 2 ? `×${mult.toFixed(2).replace(/0$/, '')}` : 'pts', P.score.x + P.score.w * 0.8, P.score.y + P.score.h * 0.36, P.score.h * 0.34, { color: me.streak >= 4 ? th.accent2 : th.sub, weight: 700, maxW: P.score.w * 0.36 });
    text(ctx, me.streak >= 2 ? `run ${me.streak}` : '', P.score.x + P.score.w * 0.8, P.score.y + P.score.h * 0.72, P.score.h * 0.28, { color: th.sub, weight: 400, maxW: P.score.w * 0.36 });
  }
  // ladder
  const st = activeStages(r.goal), lr = P.ladder, gap = 8, w = (lr.w - gap * (st.length - 1)) / st.length, rc = reached(me.cards, me.marks);
  st.forEach((sg, i) => {
    const x = lr.x + i * (w + gap), cl = r.claims[sg], ready = rc[sg] && !cl, pulse = ready ? 0.5 + 0.5 * Math.sin(s.t * 7) : 0;
    const fill = cl ? (cl.by === 0 || r.mode === 'duo' ? mix(th.accent, '#000000', 0.15) : 'rgba(150,40,40,0.8)') : ready ? mix(th.accent, '#ffffff', 0.2 * pulse) : 'rgba(0,0,0,0.38)';
    roundPath(ctx, x, lr.y, w, lr.h, lr.h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = ready ? '#fff' : 'rgba(255,255,255,0.3)'; ctx.stroke();
    const dark = cl ? cl.by === 0 || r.mode === 'duo' : ready;
    text(ctx, w < 130 ? STAGE_LABEL[sg].replace('TWO ROWS', '2 ROWS') : STAGE_LABEL[sg], x + w / 2, lr.y + lr.h * 0.36, lr.h * 0.34, { color: dark ? '#1c1004' : th.text, weight: 800, maxW: w - 12 });
    text(ctx, cl ? (r.mode === 'duo' ? `P${cl.by + 1}` : nameOf(r, cl.by)) : `${STAGE_POINTS[sg]}`, x + w / 2, lr.y + lr.h * 0.72, lr.h * 0.28, { color: dark ? '#1c1004' : th.sub, weight: 600, maxW: w - 12 });
  });
  if (P.pause) {
    drawButton(ctx, P.pause, '', th, {});
    const cx = P.pause.x + P.pause.w / 2, cy = P.pause.y + P.pause.h / 2; ctx.fillStyle = th.text;
    ctx.fillRect(cx - 12, cy - 13, 8, 26); ctx.fillRect(cx + 4, cy - 13, 8, 26);
  }
}
function drawOpps(ctx, s, r, th, rect) {
  const opp = r.players.slice(1); if (!opp.length || !rect) return;
  const gap = 10, w = (rect.w - gap * (opp.length - 1)) / opp.length;
  opp.forEach((p, k) => {
    const x = rect.x + k * (w + gap);
    roundPath(ctx, x, rect.y, w, rect.h, 14); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke();
    let best = 0, bi = 0; p.cards.forEach((c, ci) => { const m = cardMarked(c, p.marks[ci]); if (m > best) { best = m; bi = ci; } });
    const mw = Math.min(w * 0.42, 108), mh = mw * 0.8 * 3 / 9 * 1.0;
    const ox = x + 10, oy = rect.y + (rect.h - mw * (0.8 * 3 / 9)) / 2;
    const hot = rowsDone(p.cards[bi], p.marks[bi]).length > 0;
    drawMini(ctx, ox, oy, mw, p.cards[bi], p.marks[bi], th, hot);
    void mh;
    const tx = ox + mw + 12, tw = x + w - tx - 8;
    text(ctx, nameOf(r, k + 1), tx, rect.y + rect.h * 0.32, rect.h * 0.34, { align: 'left', color: th.text, maxW: tw });
    text(ctx, `${best}/15 · ${p.cards.length} card${p.cards.length > 1 ? 's' : ''}`, tx, rect.y + rect.h * 0.7, rect.h * 0.27, { align: 'left', color: th.sub, weight: 400, maxW: tw });
  });
}

// ---- cards and bar --------------------------------------------------------------------------------------------------------------------
function drawPlayerCards(ctx, s, r, pi, th, cards, reachedWin) {
  const p = r.players[pi];
  cards.rects.forEach((rect, ci) => {
    const hint = p.hint ? p.hint.cells.filter((h) => h.ci === ci).map((h) => h.cell) : null;
    const hintCol = hint && hint.length ? hint[0] % 9 : null;
    drawCard(ctx, rect, p.cards[ci], th, {
      marks: p.marks[ci], dead: p.dead[ci], chipT: p.chipT[ci], t: s.t, seed: ci * 31 + pi * 7, label: `№${ci + 1}`,
      hint, hintCol, flash: p.flash && p.flash.ci === ci ? p.flash : null, winRows: reachedWin && reachedWin.card === ci ? reachedWin.rows : null,
    });
  });
}
function claimLabel(r, p) {
  const best = claimable(r.goal, p.cards, p.marks, r.claims);
  return best ? STAGE_LABEL[best] + '!' : 'CLAIM';
}
function drawClaim(ctx, s, r, pi, th, rect) {
  const p = r.players[pi], best = claimable(r.goal, p.cards, p.marks, r.claims), locked = p.lock > 0;
  const pulse = best && !locked ? (s.t * 1.6) % 1 : 0;
  drawButton(ctx, rect, locked ? `Wait ${Math.ceil(p.lock)}s` : claimLabel(r, p), th, { primary: !!best && !locked, disabled: r.status !== 'running' || locked, scale: 1.1, pulse });
}

// ---- solo play and Watch & Learn ------------------------------------------------------------------------------------------------------
function renderPlay(ctx, s, th, L) {
  const r = s.round; if (!r) return;
  const auto = s.scene === 'auto', P = auto ? L.auto : L.play, me = r.players[0];
  drawHud(ctx, s, r, th, P, auto);
  if (P.opps) drawOpps(ctx, s, r, th, P.opps);
  drawStage(ctx, s, r, th, P.stage, auto);
  const win = r.status === 'won' && r.winner === 0 ? reached(me.cards, me.marks)[r.goal === 'row' ? 'row' : 'loto'] : null;
  drawPlayerCards(ctx, s, r, 0, th, P.cards, win);
  // bar
  const B = P.bar;
  if (!auto) {
    drawButton(ctx, B.hint, `Hint ${me.hints}`, th, { disabled: me.hints <= 0 || r.status !== 'running', scale: 0.9 });
    drawClaim(ctx, s, r, 0, th, B.claim);
    if (r.ff) pill(ctx, P.stage.rect.x + 8, P.stage.rect.y + 8, 190, 30, 'Fast-forward', th, { px: 15 });
  } else {
    drawButton(ctx, B.exit, 'Exit', th, { scale: 0.85 });
    drawButton(ctx, B.dec, `Think −`, th, { disabled: s.thinkIdx <= 0 || s.paused, scale: 0.75, sub: `${[2, 5, 8, 10][s.thinkIdx]}s`, subRatio: 0.9 });
    drawButton(ctx, B.pause, s.paused ? 'Resume' : 'Pause', th, { primary: true, scale: 0.95 });
    drawButton(ctx, B.inc, `Think +`, th, { disabled: s.thinkIdx >= 3 || s.paused, scale: 0.75 });
    drawButton(ctx, B.speed, 'Skip', th, { disabled: s.paused, scale: 0.85 });
  }
  if (!auto) toast(ctx, s, th, P.toastY, L.w / 2, Math.min(560, L.U.w - 40));
  else toast(ctx, s, th, P.toastY, L.w / 2, Math.min(560, L.U.w - 40));
  if (s.paused || r.status !== 'running') withDesign(ctx, L, null, (d) => overlay(ctx, s, r, th, d, auto));
}

// ---- face to face -------------------------------------------------------------------------------------------------------------------
function renderDuo(ctx, s, th, L) {
  const r = s.round; if (!r) return;
  const D = L.duo, band = D.band;
  // band
  ctx.save(); roundPath(ctx, 8, band.y, L.w - 16, band.h, 26); ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke(); ctx.restore();
  const tray = R2(D.kegC.x - D.keg * 0.78, D.kegC.y - D.keg * 0.5, D.keg * 1.56, D.keg), P = { tray, kegBig: D.keg * 0.9, bag: { cx: D.kegC.x - D.keg * 0.5, cy: D.kegC.y - D.keg * 0.9, size: D.keg * 0.9 } };
  drawTray(ctx, tray, th);
  const kp = kegPose(r, P); if (kp) drawKeg(ctx, kp.x, kp.y, kp.size, kp.n, { rot: kp.rot, spin: kp.spin, glow: r.drop ? 0 : 0.28 });
  if (r.status === 'running' && r.drawn < KEGS) { const bw = tray.w * 0.7, bx = tray.x + (tray.w - bw) / 2, by = tray.y + tray.h + 4, k = clamp01(1 - r.timer / r.secs); ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundPath(ctx, bx, by, bw, 5, 2.5); ctx.fill(); ctx.fillStyle = th.accent; roundPath(ctx, bx, by, Math.max(5, bw * k), 5, 2.5); ctx.fill(); }
  const ox = ptr.x, oy = ptr.y;
  const side = (pi, rot) => {
    ctx.save();
    if (rot) { ctx.translate(L.w, L.h); ctx.rotate(Math.PI); }
    ptr.x = rot ? L.w - ox : ox; ptr.y = rot ? L.h - oy : oy;
    // band half (below the centre line, in this player's own orientation)
    const hy = D.cy + 6, hh = band.h / 2 - 10, left = L.U.x0 + 100, right = tray.x - 14, rx = tray.x + tray.w + 14, rw = L.U.x1 - 110 - rx;
    if (r.last) {
      const n = r.last, big = clamp(hh * 0.66, 28, 84);
      text(ctx, String(n), (left + right) / 2 - 20, hy + hh * 0.5, big, { color: th.accent, weight: 800, num: true, stroke: 5, maxW: Math.max(60, right - left - 80) });
      text(ctx, numberWord(n), (left + right) / 2 - 20, hy + hh * 0.5 + big * 0.66, Math.max(13, big * 0.26), { color: th.text, italic: true, maxW: Math.max(60, right - left - 60) });
    }
    if (rw >= 150) drawRackStrip(ctx, r, R2(rx, hy, rw, hh), th);
    const p = r.players[pi], me = pi;
    // cards + claim
    void me;
    drawPlayerCards(ctx, s, r, pi, th, D.cards, r.status === 'won' && r.winner === pi ? reached(p.cards, p.marks)[r.goal === 'row' ? 'row' : 'loto'] : null);
    drawClaim(ctx, s, r, pi, th, D.claim);
    const cl = D.claim; text(ctx, `Player ${pi + 1}   ${p.score}`, cl.x - 20, cl.y + cl.h / 2, 24, { align: 'right', color: th.text, weight: 700, maxW: Math.max(80, cl.x - L.U.x0 - 30) });
    ctx.restore();
  };
  side(0, false); side(1, true); ptr.x = ox; ptr.y = oy;
  drawButton(ctx, D.pause, '', th, {}); { const cx = D.pause.x + D.pause.w / 2, cy = D.pause.y + D.pause.h / 2; ctx.fillStyle = th.text; ctx.fillRect(cx - 12, cy - 13, 8, 26); ctx.fillRect(cx + 4, cy - 13, 8, 26); }
  toast(ctx, s, th, D.cy, L.w / 2, Math.min(520, L.U.w - 200));
  if (s.paused || r.status !== 'running') withDesign(ctx, L, null, (d) => overlay(ctx, s, r, th, d, false));
}
function drawRackStrip(ctx, r, rect, th) {
  const kegS = clamp(rect.h * 0.8, 30, 58), step = kegS * 1.2, n = Math.max(1, Math.floor(rect.w / step));
  r.called.slice().reverse().slice(0, n).forEach((v, i) => drawKeg(ctx, rect.x + kegS * 0.6 + i * step, rect.y + rect.h * 0.5, kegS, v, { dim: i < r.window ? 0 : 0.42, shadow: false }));
}
function ladderStrip(ctx, s, r, pi, th, rect) {
  const st = activeStages(r.goal), p = r.players[pi], rc = reached(p.cards, p.marks), gap = 6, w = (rect.w - gap * (st.length - 1)) / st.length;
  st.forEach((sg, i) => {
    const x = rect.x + i * (w + gap), cl = r.claims[sg], ready = rc[sg] && !cl;
    roundPath(ctx, x, rect.y + rect.h * 0.1, w, rect.h * 0.8, rect.h * 0.4); ctx.fillStyle = cl ? (cl.by === pi ? th.accent : 'rgba(150,40,40,0.8)') : ready ? mix(th.accent, '#ffffff', 0.2) : 'rgba(0,0,0,0.38)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();
    text(ctx, STAGE_LABEL[sg].replace('TWO ROWS', '2 ROWS'), x + w / 2, rect.y + rect.h / 2, rect.h * 0.3, { color: cl && cl.by === pi || ready ? '#1c1004' : th.text, weight: 800, maxW: w - 8 });
  });
}

// ---- pause and result overlays (design screens over the play screens) ---------------------------------------------------------------
function overlay(ctx, s, r, th, d, auto) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.restore();
  const W = d.W, H = d.H;
  ctx.save(); ctx.fillStyle = 'rgba(4,8,6,0.66)'; ctx.fillRect(-d.dx / d.k - 10, -d.dy / d.k - 10, 4000, 4000); ctx.restore();
  if (s.paused) {
    const P = d.pause;
    panel(ctx, R2(P.resume.x - 40, P.titleY - 70, P.resume.w + 80, P.menu.y + P.menu.h - P.titleY + 110), th, 30, 1, true);
    text(ctx, 'Paused', W / 2, P.titleY, 64, { color: th.accent, italic: true, stroke: 6, shadow: true });
    drawButton(ctx, P.resume, 'Resume', th, { primary: true, solid: true });
    if (!auto) drawButton(ctx, P.rules, 'Rules', th, { solid: true });
    drawButton(ctx, P.menu, 'Menu', th, { solid: true });
    return;
  }
  const RS = d.result, me = r.players[0], res = r.result?.[0], cx = RS.cx;
  const won = r.status === 'won', mine = r.mode !== 'duo' && r.top >= 0 && r.players[r.top].kind === 'human', stand = !auto && r.mode !== 'duo' && r.ranks ? r.ranks.map((i) => `${nameOf(r, i)} ${r.players[i].score}`).join('  ·  ') : '';
  const rows = [];
  if (auto) {
    rows.push(['Kegs called', `${r.called.length}`]);
    const cs = Object.entries(r.claims).map(([k, v]) => `${STAGE_LABEL[k]}: ${nameOf(r, v.by)}`).join(', '); if (cs) rows.push(['Claimed', cs]);
    rows.push(['Chips on your cards', `${cardCount(me)}`]);
  } else if (r.mode === 'duo') {
    r.players.forEach((p, i) => rows.push([`Player ${i + 1}`, `${p.score}`]));
    rows.push(['Kegs called', `${r.called.length}`]);
  } else if (res) {
    rows.push(['Chips covered', `${res.marks}`], ['Quick chips', `${res.quick}`], ['Best run', `${res.best}`], ['Wrong taps', `${res.wrong}`], ['False claims', `${res.falses}`], ['Stage points', `${res.stagePts}`], ['Finishing bonus', `${res.bonus}`], ['Round total', `${res.total}`]);
    rows.push(r.daily ? ['Today\'s best', `${r.dailyInfo ? r.dailyInfo.best : res.total}`] : ['Best round', `${s.best}`]);
    if (r.daily && r.dailyInfo) rows.push(['Daily streak', `${r.dailyInfo.streak} day${r.dailyInfo.streak > 1 ? 's' : ''}`]);
  }
  const n = rows.length, availH = RS.bottom + 40 - (RS.titleY - 62), rh = Math.min(54, (availH - 148 - (stand ? 40 : 0)) / Math.max(n, 1)), contentH = 62 + 58 + (stand ? 40 : 0) + rh * n + 28, oy = Math.max(0, (availH - contentH) / 2);
  const area = R2(RS.x0 - 30, RS.titleY - 62 + oy, RS.x1 - RS.x0 + 60, contentH);
  panel(ctx, area, th, 30, 1, true); hairline(ctx, area);
  const title = auto ? 'Lesson complete' : r.mode === 'duo' ? (won ? `Player ${r.winner + 1} wins!` : 'No winner this time') : mine ? 'You win!' : r.top >= 0 ? `${nameOf(r, r.top)} wins` : 'No winner this time';
  text(ctx, title, cx, RS.titleY + oy, 64, { color: mine || r.mode === 'duo' ? th.accent : th.text, italic: true, stroke: 6, shadow: true, maxW: area.w - 40 });
  if (stand) text(ctx, stand, cx, RS.titleY + oy + 44, 24, { color: th.sub, weight: 600, maxW: area.w - 50 });
  const ys = RS.titleY + oy + 58 + (stand ? 40 : 0) + rh / 2;
  rows.forEach((row, i) => {
    const y = ys + i * rh, last = i === n - 1 && !auto && r.mode !== 'duo';
    text(ctx, row[0], RS.x0 + 10, y, rh * 0.55, { align: 'left', color: last ? th.text : th.sub, weight: last ? 800 : 400, maxW: (RS.x1 - RS.x0) * 0.55 });
    text(ctx, row[1], RS.x1 - 10, y, rh * 0.6, { align: 'right', color: last ? th.accent : th.text, weight: 800, num: true, maxW: (RS.x1 - RS.x0) * 0.45 });
  });
  if (r.endT > 1.2) {
    drawButton(ctx, RS.again, auto ? 'Watch again' : 'Play again', th, { primary: true });
    drawButton(ctx, RS.menu, 'Menu', th, { solid: true });
    if (!auto) drawButton(ctx, RS.rules, 'Rules', th, { scale: 0.8, solid: true });
    drawMoreLine(ctx, RS.more.x, RS.more.y, 18, th.sub);
  }
}
const cardCount = (p) => p.cards.reduce((a, c, ci) => a + cardMarked(c, p.marks[ci]), 0);

// ---- menu --------------------------------------------------------------------------------------------------------------------------------
function drawMenuArt(ctx, s, th, cx, cy, size) {
  const t = s.t;
  drawBag(ctx, cx, cy, size, t, 0.15 + 0.15 * Math.sin(t * 0.8), th);
  const nums = [7, 22, 47, 69, 90], span = size * 1.5;
  nums.forEach((n, i) => {
    const k = (i - 2) / 2, x = cx + k * span * 0.5, y = cy + size * 0.66 + Math.abs(k) * size * 0.08 + Math.sin(t * 1.3 + i) * 3;
    drawKeg(ctx, x, y, size * 0.4, n, { rot: k * 0.5 + Math.sin(t * 0.9 + i * 1.4) * 0.06, spin: Math.sin(t * 0.7 + i) * 0.25 });
  });
  // a keg tumbling out of the bag now and then
  const c = (t % 5) / 5;
  if (c < 0.26) { const u = c / 0.26, x = cx + size * 0.2 + u * size * 0.5, y = cy - size * 0.2 + u * u * size * 0.85; drawKeg(ctx, x, y, size * 0.34, 11, { rot: u * 7, spin: u * 10, alpha: 1 - u * 0.2 }); }
}
function renderMenu(ctx, s, th, L, d) {
  const sc = scaleOf(s), m = L.menuRows(sc), big = sc > 1.2;
  if (m.art) {
    drawMenuArt(ctx, s, th, d.land ? m.cxArt : d.W / 2, m.artY, d.land ? 240 : (m.artSize || 230));
  }
  const tcx = d.land ? m.cxArt : d.W / 2;
  text(ctx, 'RUSSIAN LOTO', tcx, m.titleY, d.land ? 78 : 92, { italic: true, color: th.accent, stroke: 9, shadow: true, maxW: d.land ? 560 : 660 });
  text(ctx, 'B A R R E L S', tcx, m.subY, 38, { color: th.text, stroke: 6, maxW: 520 });
  const sr = big ? 0.68 : 0.62, dd = s.daily;
  drawButton(ctx, m.play, 'Play', th, { primary: true, sub: 'against the computer', scale: sc, subRatio: sr });
  drawButton(ctx, m.duo, 'Face to face', th, { sub: 'two players, one device', scale: sc, subRatio: sr });
  const doneToday = dd.day === s.today && dd.plays > 0;
  drawButton(ctx, m.daily, 'Daily Challenge', th, { sub: doneToday ? `today's best ${dd.best} · streak ${dd.streak}` : dd.streak > 0 && dd.last === s.today - 1 ? `keep your ${dd.streak}-day streak` : 'the same kegs for everyone', scale: sc, subRatio: sr, pulse: doneToday ? 0 : (s.t * 0.7) % 1 });
  drawButton(ctx, m.watch, 'Watch & Learn', th, { sub: 'a whole round, explained', scale: sc, subRatio: sr });
  const ss = big ? 0.8 : sc * 0.62;
  drawButton(ctx, m.howto, 'How to play', th, { scale: ss });
  drawButton(ctx, m.rules, 'Rules', th, { scale: ss });
  drawButton(ctx, m.about, 'About', th, { scale: ss });
  drawButton(ctx, m.settings, 'Settings', th, { scale: big ? 1.1 : sc * 0.7 });
  drawSoundButton(ctx, s, th, d.sound);
  const q = m.lockup, dn = s.lkDown;
  ctx.save(); ctx.fillStyle = 'rgba(4,10,8,0.62)'; roundPath(ctx, q.x - 10, q.y - 5, q.w + 20, q.h + 10, (q.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, dn ? R2(q.x + q.w * 0.02, q.y + 1, q.w * 0.96, q.h * 0.96) : q, dn ? 0.7 : 1);
}
function drawSoundButton(ctx, s, th, r) {
  drawButton(ctx, r, '', th, {});
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.save(); ctx.fillStyle = th.text; ctx.strokeStyle = th.text; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 20, cy - 8); ctx.lineTo(cx - 10, cy - 8); ctx.lineTo(cx + 2, cy - 18); ctx.lineTo(cx + 2, cy + 18); ctx.lineTo(cx - 10, cy + 8); ctx.lineTo(cx - 20, cy + 8); ctx.closePath(); ctx.fill();
  if (s.sound) { ctx.beginPath(); ctx.arc(cx + 2, cy, 12, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 2, cy, 21, -0.9, 0.9); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(cx + 12, cy - 10); ctx.lineTo(cx + 28, cy + 10); ctx.moveTo(cx + 28, cy - 10); ctx.lineTo(cx + 12, cy + 10); ctx.stroke(); }
  ctx.restore();
}
function backButton(ctx, th, r) { drawButton(ctx, r, '‹', th, { scale: 1.3 }); }
function chevron(ctx, x, y, dir, th, off) {
  ctx.save(); ctx.globalAlpha = off ? 0.25 : 0.9; ctx.strokeStyle = th.text; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - dir * 9, y - 18); ctx.lineTo(x + dir * 9, y); ctx.lineTo(x - dir * 9, y + 18); ctx.stroke(); ctx.restore();
}

// ---- setup ----------------------------------------------------------------------------------------------------------------------------------
function renderSetup(ctx, s, th, d) {
  const sc = scaleOf(s), duo = s.mode === 'duo', keys = duo ? ['goal', 'pace', 'cards', 'look'] : ['goal', 'pace', 'cards', 'opps', 'skill', 'look'], rows = d.setupRows(keys), c = s.cfg;
  backButton(ctx, th, d.back);
  text(ctx, duo ? 'Face to face' : 'Set the table', d.W / 2, d.titleY, 46, { italic: true, color: th.accent, stroke: 5, maxW: 440, shadow: true });
  const info = {
    goal: ['Goal', byId(GOALS, c.goal).name, byId(GOALS, c.goal).blurb],
    pace: ['Pace', byId(PACES, c.pace).name, `a keg every ${byId(PACES, c.pace).secs} s · open for ${byId(PACES, c.pace).window} kegs`],
    cards: [duo ? 'Cards each' : 'Your cards', `${duo ? c.duoCards : c.cards}`, (duo ? c.duoCards : c.cards) === 6 ? 'every keg lands on one of your cards' : 'more cards, more to scan'],
    opps: ['Opponents', `${c.opps}`, 'computer players with their own cards'],
    skill: ['Skill', byId(SKILLS, c.skill).name, `react in ${byId(SKILLS, c.skill).react[0]}–${byId(SKILLS, c.skill).react[1]} s`],
    look: ['Look', THEMES[s.theme].name, 'table and card colours'],
  };
  for (const k of keys) {
    const r = rows[k], [label, value, sub] = info[k];
    panel(ctx, r, th, 24);
    text(ctx, label, r.x + 30, r.y + 26, 22 * Math.min(sc, 1.3), { align: 'left', color: th.sub, maxW: r.w - 60 });
    text(ctx, value, r.x + r.w / 2, r.y + r.h * 0.5, 40 * Math.min(sc, 1.4), { italic: true, color: th.accent, maxW: r.w - 190 });
    text(ctx, sub, r.x + r.w / 2, r.y + r.h * 0.5 + 34, 20 * Math.min(sc, 1.3), { color: th.sub, weight: 400, maxW: r.w - 120 });
    const off0 = (k === 'cards' && (duo ? c.duoCards : c.cards) <= 1) || (k === 'opps' && c.opps <= 1), off1 = (k === 'cards' && (duo ? c.duoCards >= 3 : c.cards >= 6)) || (k === 'opps' && c.opps >= 3);
    chevron(ctx, r.x + 34, r.y + r.h * 0.5, -1, th, off0); chevron(ctx, r.x + r.w - 34, r.y + r.h * 0.5, 1, th, off1);
  }
  drawButton(ctx, rows.start, 'Start', th, { primary: true, scale: Math.min(sc, 1.3), pulse: (s.t * 0.7) % 1 });
}

// ---- reference pages ------------------------------------------------------------------------------------------------------------------------
const flowCache = new Map();
function layoutFlow(ctx, list, key, scale, PANEL) {
  const ck = `${key}:${scale}:${PANEL.w}:${Math.round(fontFloor.u)}`;
  if (flowCache.has(ck)) return flowCache.get(ck);
  const textW = PANEL.w - 84;
  let px = Math.round(29 * scale), maxWord = 0;
  ctx.font = font(px, 400);
  for (const b of list) for (const w of String(b.p ?? b.h ?? (b.li || []).join(' ')).split(' ')) maxWord = Math.max(maxWord, ctx.measureText(w).width);
  if (maxWord > textW) px = Math.max(16, Math.floor(px * (textW / maxWord)));
  const LH = Math.round(px * 1.28), gap = Math.round(px * 0.5), hPx = Math.round(33 * Math.min(scale, 1.3));
  const items = []; let y = 8;
  for (const b of list) {
    if (b.h) { y += Math.round(px * 0.5); items.push({ t: 'h', text: b.h, y: y + hPx * 0.8 }); y += hPx + Math.round(px * 0.4); }
    else if (b.art) { const cw = Math.min(PANEL.w - 80, 600), ah = artHeight(b.art, cw); if (scale <= 2) { items.push({ t: 'art', art: b.art, y: y + ah / 2, ah }); y += ah + 10; } }
    else if (b.p) { ctx.font = font(px, 400); wrapLines(ctx, b.p, textW).forEach((ln) => { items.push({ t: 'line', text: ln, y }); y += LH; }); y += gap; }
    else if (b.li) {
      b.li.forEach((it) => { ctx.font = font(px, 400); wrapLines(ctx, it, textW - px).forEach((ln, i) => { items.push({ t: 'line', text: ln, y, bullet: i === 0, indent: px }); y += LH; }); y += Math.round(px * 0.18); });
      y += gap;
    }
  }
  const res = { items, px, LH, hPx, total: y + 20 };
  flowCache.set(ck, res);
  return res;
}
const artHeight = (art, cw) => (art === 'keg-row' ? 120 : art === 'chip' ? 100 : art === 'ladder' ? cw * 0.258 + 72 : cw * 0.43 + 16);
function pageArt(ctx, s, th, art, cx, cy, w, ah) {
  const top = cy - ah / 2, cw = Math.min(w, 600);
  if (art === 'keg-row') { [11, 22, 47, 69, 90].forEach((n, i) => drawKeg(ctx, cx + (i - 2) * Math.min(100, w / 5.4), cy + Math.sin(i) * 3, 88, n, { rot: (i - 2) * 0.12 })); }
  else if (art === 'card' || art === 'column') drawCard(ctx, R2(cx - cw / 2, top + 8, cw, cw * 0.43), SAMPLE_CARD, th, { marks: SAMPLE_MARKS, chipT: [], t: s.t, label: '№1', hintCol: art === 'column' ? 4 : null });
  else if (art === 'chip') { for (let i = 0; i < 3; i++) drawChip(ctx, cx + (i - 1) * 90, cy, 76, th, 1, i); }
  else if (art === 'ladder') {
    const card = SAMPLE_CARD, marks = card.map((v, i) => !!v && i < 18);
    drawCard(ctx, R2(cx - cw * 0.3, top + 4, cw * 0.6, cw * 0.258), card, th, { marks, chipT: [], t: s.t, winRows: [0, 1] });
    ['ROW', 'TWO ROWS', 'LOTO'].forEach((l, i) => pill(ctx, cx - cw / 2 + i * (cw / 3) + 6, top + cw * 0.258 + 22, cw / 3 - 12, 36, l, th, { px: 18 }));
  }
}
function renderPage(ctx, s, th, list, heading, key, d) {
  const scale = scaleOf(s), PANEL = d.panel, res = layoutFlow(ctx, list, key, scale, PANEL), P = R2(PANEL.x, PANEL.y, PANEL.w, PANEL.maxH), W = d.W;
  roundPath(ctx, P.x, P.y, P.w, P.h, 28);
  const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, 'rgba(8,30,22,0.78)'); g.addColorStop(1, 'rgba(4,16,12,0.84)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,243,220,0.3)'; ctx.stroke(); hairline(ctx, P);
  text(ctx, heading, W / 2, P.y + 52, 38 * Math.min(scale, 1.15), { color: th.text, maxW: P.w - 60 });
  ctx.strokeStyle = 'rgba(255,243,220,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 60, P.y + 82); ctx.lineTo(P.x + P.w - 60, P.y + 82); ctx.stroke();
  const top = P.y + 90, viewH = Math.max(40, P.h - 90 - 14);
  s.refMax = Math.max(0, Math.ceil(res.total - viewH)); s.refView = viewH; s.refScroll = Math.max(0, Math.min(s.refMax, s.refScroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 10, top, P.w - 20, viewH); ctx.clip();
  for (const it of res.items) {
    const y = top + it.y - s.refScroll;
    if (y < top - 260 || y > top + viewH + 60) continue;
    if (it.t === 'h') text(ctx, it.text, W / 2, y, res.hPx, { color: th.accent, italic: true, maxW: P.w - 60 });
    else if (it.t === 'art') pageArt(ctx, s, th, it.art, W / 2, y, P.w - 80, it.ah);
    else {
      ctx.save(); ctx.fillStyle = '#fbf2de'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = font(res.px, 400);
      if (it.bullet) { ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(P.x + 50, y + res.px * 0.55, res.px * 0.12, 0, PI2); ctx.fill(); ctx.fillStyle = '#fbf2de'; }
      ctx.fillText(it.text, P.x + 42 + (it.indent || 0), y); ctx.restore();
    }
  }
  ctx.restore();
  if (s.refMax > 0) {
    const th2 = Math.max(36, viewH * viewH / (viewH + s.refMax)), ty = top + (viewH - th2) * (s.refScroll / s.refMax);
    ctx.fillStyle = 'rgba(255,243,220,0.14)'; roundPath(ctx, P.x + P.w - 18, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,243,220,0.6)'; roundPath(ctx, P.x + P.w - 18, ty, 6, th2, 3); ctx.fill();
  }
  drawButton(ctx, d.textDec, 'A−', th, { disabled: s.textIdx <= 0, scale: 0.9 });
  drawButton(ctx, d.textInc, 'A+', th, { disabled: s.textIdx >= TEXT_SCALES.length - 1, scale: 0.9 });
  text(ctx, `${Math.round(scale * 100)}%`, W / 2, d.pctY, 26, { color: th.sub, weight: 400 });
  drawButton(ctx, d.refBack, 'Back', th, { scale: 0.85 });
  drawButton(ctx, d.refNext, 'Done', th, { primary: true, scale: 0.85 });
}

// ---- settings and demo limit -----------------------------------------------------------------------------------------------------------------
function renderSettings(ctx, s, th, d) {
  const sc = scaleOf(s), R = d.settings;
  backButton(ctx, th, d.back);
  text(ctx, 'Settings', d.W / 2, d.titleY, 46 * Math.min(sc, 1.3), { italic: true, color: th.accent, stroke: 5, maxW: 420, shadow: true });
  const row = (r, label, fn) => { panel(ctx, r, th, 24); text(ctx, label, r.x + 30, r.y + Math.min(30, r.h * 0.26), 22 * Math.min(sc, 1.3), { align: 'left', color: th.sub, maxW: r.w - 60 }); fn(r); };
  row(R.sound, 'Sound', (r) => text(ctx, s.sound ? 'On' : 'Off', r.x + r.w / 2, r.y + r.h * 0.66, Math.min(40 * Math.min(sc, 1.5), r.h * 0.36), { italic: true, color: s.sound ? th.accent : th.sub, maxW: r.w - 80 }));
  row(R.text, 'Text size', (r) => {
    text(ctx, `${Math.round(scaleOf(s) * 100)}%`, r.x + r.w / 2, r.y + r.h * 0.66, Math.min(40 * Math.min(sc, 1.5), r.h * 0.36), { italic: true, color: th.accent, maxW: r.w - 200 });
    chevron(ctx, r.x + 34, r.y + r.h * 0.66, -1, th, s.textIdx <= 0); chevron(ctx, r.x + r.w - 34, r.y + r.h * 0.66, 1, th, s.textIdx >= TEXT_SCALES.length - 1);
  });
  row(R.look, 'Look', (r) => {
    text(ctx, THEMES[s.theme].name, r.x + r.w / 2, r.y + r.h * 0.66, Math.min(40 * Math.min(sc, 1.5), r.h * 0.36), { italic: true, color: th.accent, maxW: r.w - 200 });
    chevron(ctx, r.x + 34, r.y + r.h * 0.66, -1, th); chevron(ctx, r.x + r.w - 34, r.y + r.h * 0.66, 1, th);
  });
  row(R.think, 'Watch & Learn: thinking time', (r) => {
    text(ctx, `${THINK_STEPS[s.thinkIdx]} seconds`, r.x + r.w / 2, r.y + r.h * 0.66, Math.min(40 * Math.min(sc, 1.5), r.h * 0.36), { italic: true, color: th.accent, maxW: r.w - 200 });
    chevron(ctx, r.x + 34, r.y + r.h * 0.66, -1, th, s.thinkIdx <= 0); chevron(ctx, r.x + r.w - 34, r.y + r.h * 0.66, 1, th, s.thinkIdx >= THINK_STEPS.length - 1);
  });
  row(R.stats, 'Your numbers', (r) => {
    const dd = s.daily, f = Math.min(sc, 1.4);
    text(ctx, `Best round ${s.best} · ${s.roundNo} rounds`, r.x + r.w / 2, r.y + r.h * 0.58, 24 * f, { color: th.text, maxW: r.w - 60, weight: 700 });
    text(ctx, `Daily streak ${dd.streak} · all-time points ${s.total}`, r.x + r.w / 2, r.y + r.h * 0.58 + 28 * f, 20 * f, { color: th.sub, weight: 400, maxW: r.w - 60 });
  });
  row(R.reset, 'Reset best score', (r) => text(ctx, s.resetDone > 0 ? 'Done' : `Best round: ${s.best}`, r.x + r.w / 2, r.y + r.h * 0.66, Math.min(34 * Math.min(sc, 1.4), r.h * 0.32), { italic: true, color: th.text, maxW: r.w - 80 }));
}
function renderDemoLimit(ctx, s, th, d) {
  const sc = scaleOf(s), M = d.demo, P = M.panel;
  panel(ctx, P, th, 30, 1);
  text(ctx, 'Demo finished', d.W / 2, M.titleY, 54 * Math.min(sc, 1.3), { italic: true, color: th.accent, stroke: 5, maxW: P.w - 40 });
  const px = 32 * Math.min(sc, 1.5); ctx.font = font(px, 400, true);
  wrapLines(ctx, 'Get the full game on iPhone and Android.', P.w - 70).forEach((l, i) => text(ctx, l, d.W / 2, M.msgY + i * px * 1.5, px, { weight: 400, italic: true, color: th.text, maxW: P.w - 60 }));
  drawButton(ctx, M.back, 'Menu', th, { primary: true, scale: sc });
}
void dropAt; void ladderStrip; void rgba; void THEME_IDS; void byId; void decadeLabel; void HINTS_PER_ROUND; void cardGeom; void drawChip;
