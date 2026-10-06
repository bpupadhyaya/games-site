// The play screen: scoreboard, situation line, the buttons that suit what the user's player is doing, the result banner, the floating tags, and a flat 2D field
// for when WebGL is not available. The 3D scene is drawn behind this canvas by view3d/presenter.js. All text follows the text-size setting.
import { W, H, PLAY, LY, TEXT_SCALES, setPlayLayout, inRect, estLines } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, paintButton, textShadow, wrapLines } from './ui.js';
import { FIELD, NUMBERS, TEAM_FULL } from './consts.js';
import { TEAM_COL, fieldMap, drawField, drawLiveFlat, TAU } from './art.js';
import { receiverRead } from './sim.js';

const teamName = (t) => (t === 0 ? 'BLUE' : 'RED');

// ---- which buttons the user's player has right now ----------------------------------------------------------------------------------------------------------------------
export function controlButtons(E) {
  const P = E.P;
  if (!P || P.phase !== 'live' || P.dead || E.humanId < 0) return [];
  const a = P.actors[E.humanId];
  const cd = (k) => Math.max(0, Math.min(1, (a.cool[k] || 0) / 1.0));
  const burst = { id: 'burst', label: 'Burst', cd: a.burstCd > 0 ? Math.min(1, a.burstCd / 3.6) : 0 };
  if (a.slot === 'QB' && a.q && P.ball.holder === a.id && (a.q.mode === 'read' || a.q.mode === 'drop' || a.q.mode === 'got')) {
    const lab = { WA: 'WR left', TE: 'TE', WB: 'WR right', RB: 'Back' };
    return ['WA', 'TE', 'WB', 'RB'].map((s) => ({ id: `tgt-${s}`, label: lab[s], hold: true, slot: s })).concat([burst]);
  }
  if (a.hasBall) return [{ id: 'juke-l', label: 'Juke ◄', cd: cd('juke') }, { id: 'spin', label: 'Spin', cd: cd('spin') }, { id: 'juke-r', label: 'Juke ►', cd: cd('juke') }, burst];
  if (a.unit === 'off') return [{ id: 'hands', label: 'Hands' }, burst];
  if (a.slot === 'DL1' || a.slot === 'DL2') return [{ id: 'move', label: 'Move', cd: cd('rushmove'), on: !!a.eng }, { id: 'tackle', label: 'Tackle', cd: cd('lunge') }, burst];
  return [{ id: 'tackle', label: 'Tackle', cd: cd('lunge') }, { id: 'swat', label: 'Swat' }, burst];
}
export function ctlRects(buttons, scroll = 0) {
  const n = buttons.length || 1, cols = Math.max(1, Math.min(PLAY.cols, n)), g = PLAY.gap;
  const bw = (PLAY.scroll.w - g * (cols - 1)) / cols;
  return buttons.map((b, i) => ({ ...b, x: PLAY.scroll.x + (i % cols) * (bw + g), y: PLAY.scroll.y + Math.floor(i / cols) * (PLAY.btnH + g) - scroll, w: bw, h: PLAY.btnH }));
}
export function ctlHit(buttons, x, y, scroll = 0) {
  if (!inRect(PLAY.scroll, x, y)) return null;
  return ctlRects(buttons, scroll).find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h && y >= PLAY.scroll.y && y <= PLAY.scroll.y + PLAY.scroll.h) || null;
}

// ---- the situation line and the scoreboard -------------------------------------------------------------------------------------------------------------------------
export function situationText(E) {
  const M = E.m;
  const yl = M.try ? FIELD.TRY_YL : M.yl;
  const own = yl <= 20 ? `own ${yl}` : `opp ${FIELD.LEN - yl}`;
  const d = ['1st', '2nd', '3rd', '4th'][Math.min(3, M.down - 1)];
  return M.try ? 'Two-point try from the 3' : `${d} & ${M.toGo} · ${teamName(M.poss)} ball on ${own}`;
}
const clockText = (c) => `${Math.floor(c / 60)}:${String(Math.floor(c % 60)).padStart(2, '0')}`;
function drawScoreboard(ctx, state) {
  const E = state.E, M = E.m, f = PLAY.fonts, r = PLAY.sb;
  const colw = r.w / 3;
  ctx.save();
  const boxes = [{ x: r.x, w: colw - 6, t: 0 }, { x: r.x + colw + 3, w: colw - 6, t: -1 }, { x: r.x + 2 * colw + 6, w: colw - 6, t: 1 }];
  for (const b of boxes) {
    roundPath(ctx, b.x, r.y, b.w, r.h, 16);
    ctx.fillStyle = b.t < 0 ? 'rgba(14,26,32,0.92)' : TEAM_COL[b.t].dark; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = b.t < 0 ? 'rgba(242,180,65,0.6)' : (M.poss === b.t ? '#ffd24a' : 'rgba(255,255,255,0.35)'); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (b.t >= 0) {
      ctx.fillStyle = '#fff'; ctx.font = `800 ${f.score}px ${NUM}`; ctx.fillText(String(M.score[b.t]), b.x + b.w / 2, r.y + r.h - 10 - f.name * 0.2);
      ctx.font = `700 ${f.name}px ${FONT}`; ctx.fillStyle = TEAM_COL[b.t].light; ctx.fillText((M.poss === b.t ? '● ' : '') + (b.t === 0 ? (E.humanTeam < 0 || PLAY.hs > 1.25 ? 'BLUE' : 'BLUE · YOU') : 'RED'), b.x + b.w / 2, r.y + f.name + 6);
    } else {
      ctx.fillStyle = '#ffe9bf'; ctx.font = `800 ${f.clock}px ${NUM}`; ctx.fillText(clockText(M.clock), b.x + b.w / 2, r.y + r.h / 2 + f.clock * 0.1);
      ctx.font = `700 ${f.name}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(PLAY.hs > 1.25 ? `Q${M.q}` : `QUARTER ${M.q}`, b.x + b.w / 2, r.y + f.name + 4);
    }
  }
  ctx.restore();
  const ir = PLAY.info;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${f.info}px ${FONT}`;
  const lines = wrapLines(ctx, situationText(E), ir.w);
  lines.forEach((l, i) => textShadow(ctx, l, ir.x + ir.w / 2, ir.y + f.info * (1.0 + i * 1.3) + 2, '#fff3d6', 4));
}

// ---- 2D field (fallback when there is no WebGL) --------------------------------------------------------------------------------------------------------------------------
function fieldMapFor(state) {
  const r = PLAY.view;
  return fieldMap({ x: r.x + 20, y: r.y + 4, w: r.w - 40, h: r.h - 8 }, 0, FIELD.TOTAL, 0);
}
function drawFlatField(ctx, state) {
  const E = state.E, P = E.P, mp = fieldMapFor(state);
  const los = P ? P.losZ : null;
  drawField(ctx, mp, { los, first: P && !P.kick ? P.losZ + P.dir * Math.min(P.toGo, 40) : null });
  drawLiveFlat(ctx, mp, E);
  return mp;
}

// ---- floating tags over the 3D scene or the flat field ------------------------------------------------------------------------------------------------------------------
export function drawTags(ctx, state, proj) {
  const E = state.E, P = E.P;
  if (!P || E.humanId < 0) return;
  ctx.save();
  const hid = E.humanId, a = P.actors[hid];
  const p = proj.pos(hid), fp = proj.feet(hid);
  if (p && fp) {
    const r = Math.max(16, proj.scale(hid) * 0.55);
    ctx.lineWidth = 4; ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); ctx.ellipse(fp.x, fp.y, r * 0.9, r * 0.4, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x - 11, p.y - 22); ctx.lineTo(p.x + 11, p.y - 22); ctx.closePath(); ctx.fill();
  }
  // the quarterback's receiver tags, coloured by how open each one is
  if (a.slot === 'QB' && a.q && P.ball.holder === a.id && (a.q.mode === 'read' || a.q.mode === 'drop')) {
    const reads = receiverRead(P, a);
    const lab = { WA: 'L', TE: 'T', WB: 'R', RB: 'B' };
    for (const r of reads) {
      const q = proj.pos(r.id); if (!q) continue;
      const col = r.sep >= 2.6 ? '#4ade80' : r.sep >= 1.3 ? '#fbbf24' : '#f87171';
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y - 14, 15, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#102018'; ctx.stroke();
      ctx.fillStyle = '#102018'; ctx.font = `800 18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab[r.slot], q.x, q.y - 13);
    }
  }
  ctx.restore();
}

// ---- the banner ------------------------------------------------------------------------------------------------------------------------------------------------------------------
function drawBanner(ctx, state) {
  const E = state.E, bn = E.banner;
  if (!bn || E.phase !== 'result') return;
  const hs = TEXT_SCALES[state.settings.textIdx];
  const r = PLAY.cam, bcx = r.x + r.w / 2;
  const k = Math.min(1, E.timer / 0.25);
  const pw = Math.min(640, r.w - 24), fs = Math.round(52 * Math.min(hs, 1.8)), fs2 = Math.round(24 * Math.min(hs, 2.2));
  ctx.save(); ctx.font = `600 ${fs2}px ${FONT}`;
  const lines = wrapLines(ctx, bn.sub, pw - 40);
  const ph = fs * 1.3 + lines.length * fs2 * 1.3 + 34;
  const x = bcx - pw / 2, y = r.y + r.h * 0.38 - ph / 2 + (1 - k) * 30;
  ctx.globalAlpha = k;
  roundPath(ctx, x, y, pw, ph, 22); ctx.fillStyle = 'rgba(12,22,28,0.9)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = bn.tone === 'good' ? '#4ade80' : bn.tone === 'bad' ? '#f87171' : '#ffd24a'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${fs}px ${NUM}`; ctx.fillStyle = bn.tone === 'good' ? '#9fe8b4' : bn.tone === 'bad' ? '#ffb4a0' : '#fff3d6'; ctx.fillText(bn.title, bcx, y + fs * 1.05 + 10);
  ctx.font = `600 ${fs2}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.95)'; lines.forEach((l, i) => ctx.fillText(l, bcx, y + fs * 1.3 + 22 + fs2 * (1.05 + i * 1.3)));
  ctx.restore();
}

// ---- controls ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function drawControls(ctx, state, buttons) {
  const f = PLAY.fonts;
  ctx.save(); ctx.beginPath(); ctx.rect(PLAY.scroll.x - 4, PLAY.scroll.y - 4, PLAY.scroll.w + 8, PLAY.scroll.h + 8); ctx.clip();
  const rects = ctlRects(buttons, state.ui.cscroll || 0);
  const press = state.ui.press;
  for (const b of rects) {
    const dim = b.on === false || (b.id === 'move' && !b.on);
    drawButton(ctx, b, b.label, { dark: true, size: f.btn, disabled: false, active: press && press.id === b.id });
    if (b.cd > 0) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundPath(ctx, b.x, b.y + b.h * (1 - b.cd), b.w, b.h * b.cd, 14); ctx.fill(); }
    if (b.hold && press && press.id === b.id) { // power ring: the hold, with the mark for the distance
      const t = Math.min(1, (state.ui.holdT || 0) / 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; roundPath(ctx, b.x + 8, b.y + b.h - 18, (b.w - 16) * t, 8, 4); ctx.fill();
    }
    if (b.hold && b.mark !== undefined) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(b.x + 8 + (b.w - 16) * b.mark, b.y + b.h - 24, 4, 20); }
    void dim;
  }
  ctx.restore();
}
function drawStick(ctx, state) {
  const s = state.ui.stick;
  if (!s) return;
  ctx.save();
  ctx.globalAlpha = 0.5; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(s.ox, s.oy, 70, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(s.ox + s.dx, s.oy + s.dy, 26, 0, TAU); ctx.fill();
  ctx.restore();
}

export function playLayoutNow(state) {
  const n = Math.max(1, state.buttons ? state.buttons.length : 4);
  const fi = Math.round(21 * Math.min(LY.land ? Math.min(TEXT_SCALES[state.settings.textIdx], 1.5) : TEXT_SCALES[state.settings.textIdx], 2.4));
  const iw = LY.land ? Math.min(620, Math.max(440, Math.round(LY.U.w * 0.46))) : LY.U.w - 28;
  const lines = state.E ? estLines(situationText(state.E), fi, iw).length : 1;
  setPlayLayout(state.settings.textIdx, n, lines);
}

export function renderPlay(ctx, state) {
  const E = state.E;
  playLayoutNow(state);
  if (!state.v3) {
    ctx.fillStyle = '#0d1a14'; ctx.fillRect(0, 0, W, H);
    state.mp2d = drawFlatField(ctx, state);
  }
  drawScoreboard(ctx, state);
  drawBanner(ctx, state);
  if (state.mode === 'watch') {
    drawButton(ctx, PLAY.think, state.paused ? 'Resume' : 'Pause', { dark: true, size: PLAY.fonts.btn }); drawButton(ctx, PLAY.menu, 'Leave', { dark: true, size: PLAY.fonts.btn });
  } else {
    drawControls(ctx, state, state.buttons || []);
    drawButton(ctx, PLAY.think, 'Think', { dark: true, size: PLAY.fonts.btn }); drawButton(ctx, PLAY.menu, 'Menu', { dark: true, size: PLAY.fonts.btn });
    if (E.phase === 'play' && E.P && E.P.phase !== 'live' && E.humanId >= 0) {
      ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(PLAY.fonts.btn * 0.9)}px ${FONT}`; ctx.fillStyle = '#ffe9bf'; ctx.fillText(E.P.phase === 'lineup' ? 'Lining up...' : 'Set...', PLAY.land ? PLAY.cam.x + PLAY.cam.w / 2 : W / 2, PLAY.land ? LY.U.y1 - 40 : PLAY.scroll.y + PLAY.scroll.h / 2); ctx.restore();
    }
  }
  drawStick(ctx, state);
  if (!state.v3) drawTags(ctx, state, flatProj(state));
}
function flatProj(state) {
  const mp = state.mp2d, E = state.E;
  const acts = E.P ? E.P.actors : E.m.actors;
  const at = (id) => { const a = acts[id]; return { x: mp.sx(a.x), y: mp.sy(a.z) }; };
  return { pos: (id) => { const p = at(id); return { x: p.x, y: p.y - mp.s * 1.2 }; }, feet: (id) => at(id), scale: () => mp.s * 2.4 };
}
export const drawOverlayFor = (state) => (ctx, proj) => { if (state.scene === 'play' && state.E) drawTags(ctx, state, proj); };
void C; void paintButton; void estLines; void NUMBERS; void TEAM_FULL;
