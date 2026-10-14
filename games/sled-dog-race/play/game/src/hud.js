// The play screen furniture drawn over the trail: board, route strip, dog chips, pace lever, Haw / Brake / Gee, the checkpoint panel, notes,
// Watch & Learn controls and the finish banner. Pure drawing from the game state G; hit-testing uses the same rectangles (playLayout / stopLayout).
import { live, MIN_FONT, playLayout, stopLayout, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, paintButton, wrapLines, panel, textShadow, fitPx, plaque } from './ui.js';
import { drawScene, makeCam } from './scene.js';
import { GAITS, gaitOf, elev, wellbeing, windowOf, slopeAt, careScore, rivalAt } from './sim.js';
import { DOGS, CARE, LAYOVER, RIVALS, STAR_CARE, VIS, STEEP, HINT_COST } from './consts.js';

const TAU = Math.PI * 2;
export const fmtClock = (v) => { v = Math.max(0, v); const m = Math.floor(v / 60), s = v - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
export const fmtS = (v) => `${(Math.round(v * 10) / 10).toFixed(1)} s`;
const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || `${n}th`;

export function watchRects(L) {
  // landscape: the driving controls are idle while the computer drives, so the four buttons take their places and the team strip stays clear
  if (L.land) return [L.brake, L.haw, L.gee, { x: L.pace.x, y: L.gee.y, w: L.pace.w, h: L.gee.h }];
  const w = Math.min(700, L.land ? L.scene.w - 40 : L.xr - L.xl - 24), x0 = Math.round(L.cx - w / 2), bh = 84, y = L.yb - 14 - bh, g = 10;
  const bw = Math.floor((w - 3 * g) / 4);
  return [0, 1, 2, 3].map((k) => ({ x: x0 + k * (bw + g), y, w: bw, h: bh }));
}
export function goRect(L) {
  const w = 300, h = 100;
  const cx = L.land ? L.scene.x + L.scene.w / 2 : L.cx;
  return { x: Math.round(cx - w / 2), y: Math.round(L.land ? L.top + 56 : L.team.y - h - 30), w, h };
}

const small = (ctx, px, wt = 400) => { ctx.font = `${wt} ${Math.max(MIN_FONT, Math.round(px))}px ${FONT}`; };
function pill(ctx, x, y, w, h, fill = 'rgba(10,20,48,0.78)', stroke = 'rgba(190,220,255,0.28)') {
  const warm = /255,\s*(2\d\d|1\d\d)/.test(String(stroke)) && /255,\s*2\d\d,\s*[0-9]{1,2}\b|212,\s*90/.test(String(stroke));
  plaque(ctx, x, y, w, h - 4, { tone: warm ? 'sel' : 'slate', r: Math.min(22, h / 2), lip: Math.min(5, h * 0.1), alpha: fill === 'rgba(10,20,48,0.72)' ? 0.9 : 1 });
}
const barCol = (v) => (v > 0.5 ? '#5ed39a' : v > 0.25 ? '#f5b94a' : '#ee6a5c');
function bar(ctx, x, y, w, h, v, col) {
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
  if (v > 0.01) { roundPath(ctx, x, y, Math.max(h, w * Math.min(1, v)), h, h / 2); ctx.fillStyle = col; ctx.fill(); }
}

// one dog card / chip. big: the checkpoint card with four labelled bars
function dogCard(ctx, r, d, o = {}) {
  const def = d.def, sel = o.sel, big = o.big;
  plaque(ctx, r.x, r.y, r.w, r.h - 4, { tone: sel ? 'sel' : 'slate', r: 16, lip: 4, rimW: sel ? 3 : 1.6 });
  const pad = 8, rad = Math.min(15, r.h * 0.17);
  // coat swatch
  ctx.fillStyle = def.coat[0]; ctx.beginPath(); ctx.arc(r.x + pad + rad, r.y + pad + rad + 1, rad, 0, TAU); ctx.fill();
  ctx.fillStyle = def.coat[1]; ctx.beginPath(); ctx.arc(r.x + pad + rad, r.y + pad + rad + 1, rad, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
  ctx.fillStyle = def.coat[2]; ctx.beginPath(); ctx.arc(r.x + pad + rad, r.y + pad + rad + 1, rad * 0.45, 0, TAU); ctx.fill();
  const tx = r.x + pad + rad * 2 + 8, tw = r.w - (tx - r.x) - pad;
  const nameFs = Math.max(MIN_FONT, Math.min(big ? 30 : 24, Math.round(r.h * 0.27)));
  ctx.font = `800 ${nameFs}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let nm = def.name;
  while (ctx.measureText(nm).width > tw && nm.length > 3) nm = nm.slice(0, -1);
  ctx.fillText(nm, tx, r.y + pad + rad + 1);
  const bx = r.x + pad, bw = r.w - 2 * pad;
  if (d.riding) {
    ctx.fillStyle = '#ffd54a'; small(ctx, big ? 24 : 22, 700); ctx.textAlign = 'left';
    ctx.fillText('in the bag', bx, r.y + r.h - pad - (big ? 40 : 22));
  }
  const by = r.y + pad + rad * 2 + 10;
  if (!big) {
    bar(ctx, bx, by, bw, 10, d.e, barCol(d.e));
    const w3 = (bw - 8) / 3;
    bar(ctx, bx, by + 16, w3, 6, d.w, '#6bb8ec'); bar(ctx, bx + w3 + 4, by + 16, w3, 6, d.pw, '#d9b070'); bar(ctx, bx + 2 * (w3 + 4), by + 16, w3, 6, d.m, '#f09aa0');
  } else {
    const rows = [['Energy', d.e, barCol(d.e)], ['Water', d.w, '#6bb8ec'], ['Paws', d.pw, '#d9b070'], ['Mood', d.m, '#f09aa0']];
    const rh = Math.max(7, Math.min(12, (r.h - (by - r.y) - pad) / 4 - 4));
    rows.forEach(([lab, v, col], k) => {
      const yy = by + k * (rh + 4);
      bar(ctx, bx, yy, bw, rh, v, col);
    });
    if (d.booties) { ctx.fillStyle = '#e0683a'; ctx.beginPath(); ctx.arc(r.x + r.w - pad - 8, r.y + pad + 10, 7, 0, TAU); ctx.fill(); }
  }
  ctx.textBaseline = 'alphabetic';
}

function paceLever(ctx, L, pace, lit) {
  const r = L.pace, vert = r.vertical;
  pill(ctx, r.x, r.y, r.w, r.h, 'rgba(10,20,48,0.8)');
  const pad = 14;
  const tx = vert ? r.x + r.w - 44 : r.x + pad + 20, ty = vert ? r.y + pad + 20 : r.y + r.h / 2 - 10;
  const len = vert ? r.h - 2 * pad - 40 : r.w - 2 * pad - 40;
  // zones
  GAITS.forEach(([name, v], i) => {
    const next = i < GAITS.length - 1 ? GAITS[i + 1][1] : 1;
    const a = v, b = next;
    const col = ['#4aa3d9', '#4fc59a', '#f0b84a', '#ee6a5c'][i];
    roundPath(ctx, vert ? tx : tx + a * len, vert ? ty + (1 - b) * len : ty, vert ? 20 : (b - a) * len, vert ? (b - a) * len : 20, 6);
    ctx.fillStyle = col; ctx.globalAlpha = pace >= a ? 0.95 : 0.35; ctx.fill(); ctx.globalAlpha = 1;
    // labels
    ctx.fillStyle = pace >= a && pace < (i < GAITS.length - 1 ? next : 1.01) ? '#fff' : 'rgba(255,255,255,0.65)';
    small(ctx, 22, 700);
    if (vert) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(name, r.x + 16, ty + (1 - (a + b) / 2) * len); }
    else { ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(name, tx + ((a + b) / 2) * len, ty + 20 + 28); }
  });
  // knob
  const kx = vert ? tx + 10 : tx + pace * len, ky = vert ? ty + (1 - pace) * len : ty + 10;
  { // a turned metal knob: soft shadow, copper ring, bright dome with a specular highlight
    ctx.fillStyle = 'rgba(4,8,22,0.45)'; ctx.beginPath(); ctx.ellipse(kx + 2, ky + 7, 22, 18, 0, 0, TAU); ctx.fill();
    const rg = ctx.createLinearGradient(kx - 20, ky - 20, kx + 20, ky + 20); rg.addColorStop(0, '#ffd8b0'); rg.addColorStop(0.5, '#e0683a'); rg.addColorStop(1, '#8f3414');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(kx, ky, 23, 0, TAU); ctx.fill();
    const dg = ctx.createRadialGradient(kx - 6, ky - 7, 2, kx, ky, 17); dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.6, '#e8eef8'); dg.addColorStop(1, '#a8b6cc');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(kx, ky, 17, 0, TAU); ctx.fill();
  }
  ctx.textBaseline = 'alphabetic';
}

// the profile of the leg ahead with the junctions, steep parts, rough ice and every team on it
function routeStrip(ctx, L, G) {
  const r = L.route, s = G.run.s, leg = s.L;
  pill(ctx, r.x, r.y, r.w, r.h, 'rgba(10,20,48,0.72)');
  const x0 = r.x + 18, x1 = r.x + r.w - 18, y0 = r.y + 10, y1 = r.y + r.h - 10;
  const len = leg.len + 20;
  const X = (m) => x0 + (m / len) * (x1 - x0);
  let mn = 1e9, mx = -1e9;
  for (let m = 0; m <= len; m += 10) { const e = elev(leg, m); mn = Math.min(mn, e); mx = Math.max(mx, e); }
  const Y = (m) => y1 - 4 - (elev(leg, m) - mn) / Math.max(1, mx - mn) * (y1 - y0 - 10);
  // rough ice and steep
  leg.rough.forEach(([a, b]) => { ctx.fillStyle = 'rgba(130,200,255,0.5)'; ctx.fillRect(X(a), y0, X(b) - X(a), y1 - y0); });
  leg.steep.forEach(([a, b]) => { ctx.fillStyle = 'rgba(255,100,80,0.4)'; ctx.fillRect(X(a), y0, X(b) - X(a), y1 - y0); });
  ctx.beginPath(); ctx.moveTo(x0, y1);
  for (let m = 0; m <= len; m += 6) ctx.lineTo(X(m), Y(m));
  ctx.lineTo(x1, y1); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
  ctx.beginPath(); for (let m = 0; m <= len; m += 6) { if (m === 0) ctx.moveTo(X(m), Y(m)); else ctx.lineTo(X(m), Y(m)); }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
  // junctions
  leg.jx.forEach((j) => {
    const px = X(j.x), py = Y(j.x);
    ctx.fillStyle = j.state === 'ok' ? '#5be08a' : j.state === 'missed' ? '#ff7a6a' : '#ffb13a';
    ctx.beginPath(); ctx.moveTo(px, py - 14); ctx.lineTo(px + (j.dir === 'R' ? 9 : -9), py - 8); ctx.lineTo(px, py - 2); ctx.closePath(); ctx.fill();
    ctx.fillRect(px - 1.5, py - 2, 3, 6);
  });
  // flag at the end
  ctx.fillStyle = '#fff'; ctx.fillRect(x1 - 1, y0, 2, y1 - y0);
  // rivals and the player
  const rv = G.rivals || [];
  rv.forEach((q) => { const p = rivalAt(q.ideal, G.legs, q.skill, s.clock); if (p.leg === leg.idx || p.done) { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(X(Math.min(len, p.x)), y1 - 6, 6, 0, TAU); ctx.fill(); } });
  const px = X(Math.min(len, s.x));
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, Y(s.x) - 6, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = '#e0683a'; ctx.lineWidth = 4; ctx.stroke();
}

export function renderHud(ctx, G) {
  const W = live.w, H = live.h;
  const L = playLayout(G.settings.textIdx);
  const cam = makeCam(W, H, L.scene, L.land); G.cam = cam;
  const run = G.run, s = run ? run.s : null;
  if (!(s.phase === 'stop' && G.mode !== 'watch' && L.land)) {
    // keep the whole team and the sled in view: portrait spans the width, landscape stays to the left of the pace lever
    const left = L.xl + 12, right = (L.land ? L.pace.x : L.xr) - 14, fit = (right - left) / 14.7;
    if (fit < cam.ppm) cam.ppm = Math.max(18, fit);
    cam.focus = left + Math.max(0, (right - left - 14.7 * cam.ppm) / 2) + 2.7 * cam.ppm + 4.9 * cam.ppm;
  }
  if (s.phase === 'stop' && G.mode !== 'watch' && L.land) { const SLf = stopLayout(G.settings.textIdx); cam.focus = (L.xl + SLf.panel.x) / 2 + 40; }
  if (s.phase === 'stop' && G.mode !== 'watch' && !L.land) { const SLp = stopLayout(G.settings.textIdx); cam.gyMax = SLp.panel.y - 14; }
  ctx.clearRect(0, 0, W, H);
  drawScene(ctx, cam, G.sceneState(run));
  const mode = G.mode, R = G.round;
  const stop = s.phase === 'stop', watching = mode === 'watch';
  // landscape checkpoint: the panel stands at the right, so the board and the route strip give way to it
  if (stop && L.land && !watching) {
    const SLb = stopLayout(G.settings.textIdx), lim = SLb.panel.x - 12, x0 = L.pause.x + L.pause.w + 10;
    const wdt = Math.max(240, Math.min(L.board.w, lim - x0));
    L.board = { ...L.board, x: x0, w: wdt }; L.route = { ...L.route, x: x0, w: wdt };
  }
  // board
  const B = L.board;
  pill(ctx, B.x, B.y, B.w, B.h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const legTxt = s.legCount === Infinity ? `Trail Run · leg ${s.leg + 1}` : `${R.name} · leg ${s.leg + 1} of ${s.legCount}`;
  const bw = B.w - 24;
  if (B.h >= 100 || !L.land) {
    const f1 = fitPx(ctx, legTxt, 700, 26, bw, MIN_FONT);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `700 ${f1}px ${FONT}`; ctx.fillText(legTxt, B.x + B.w / 2, B.y + 8 + f1 * 0.9);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.min(52, Math.round(B.h * 0.4))}px ${FONT}`;
    const t = fmtClock(s.clock);
    ctx.fillText(t, B.x + B.w * 0.36, B.y + B.h - 12);
    // place or score
    small(ctx, 26, 800); ctx.textAlign = 'right';
    let right = '';
    if (mode === 'trail') right = `Score ${R.score}  ${'♥'.repeat(Math.max(0, 3 - R.strikes))}${'♡'.repeat(Math.min(3, R.strikes))}`;
    else if (mode === 'drill') right = G.drill ? G.drill.title : 'Drill';
    else right = G.place ? `${ord(G.place)} of ${G.rivals.length + 1}` : '';
    ctx.fillStyle = '#ffd54a'; ctx.fillText(right, B.x + B.w - 16, B.y + B.h - 16);
  } else {
    const t = `${fmtClock(s.clock)}   ${legTxt}`;
    const f1 = fitPx(ctx, t, 800, 30, bw, MIN_FONT);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${f1}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(t, B.x + B.w / 2, B.y + B.h / 2 + 1); ctx.textBaseline = 'alphabetic';
  }
  routeStrip(ctx, L, G);
  // pause / think
  const icon = (r, glyph, off) => {
    paintButton(ctx, r, { dark: true });
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.fillStyle = '#f4f8ff'; const k = r.w / 76;
    if (glyph === 'pause') { ctx.fillRect(-14 * k, -16 * k, 10 * k, 32 * k); ctx.fillRect(4 * k, -16 * k, 10 * k, 32 * k); }
    else { ctx.font = `800 ${Math.round(40 * k)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 2); }
    ctx.restore();
  };
  icon(L.pause, 'pause');
  if (!watching && s.phase !== 'finished') icon(L.think, 'think');

  // team chips
  if (!stop) {
    const T = L.team, g = 8, cw = (T.w - 5 * g) / 6;
    s.dogs.forEach((d, i) => dogCard(ctx, { x: T.x + i * (cw + g), y: T.y, w: cw, h: T.h }, d));
  }

  // cues
  const cue = G.cue;
  if (cue && s.phase === 'run' && !G.think) {
    const fs = fitPx(ctx, cue.text, 800, 28, Math.min(L.land ? L.noteW : L.xr - L.xl - 28, 640) - 40, MIN_FONT);
    ctx.font = `800 ${fs}px ${FONT}`;
    const tw = Math.min(L.noteW, ctx.measureText(cue.text).width + 44), cx = L.land ? L.noteX + L.noteW / 2 : L.cx, py = L.noteY + 4;
    const blink = cue.urgent ? (Math.sin(G.t * 10) > -0.3 ? 1 : 0.55) : 1;
    ctx.globalAlpha = blink; pill(ctx, cx - tw / 2, py, tw, fs + 24, 'rgba(10,20,48,0.86)', cue.col || '#ffd54a');
    ctx.globalAlpha = 1; ctx.fillStyle = cue.col || '#ffd54a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cue.text, cx, py + (fs + 24) / 2 + 1); ctx.textBaseline = 'alphabetic';
  }

  // controls
  if (!watching && !stop && s.phase !== 'finished') {
    paceLever(ctx, L, s.pace, false);
    const lit = G.callLit;
    const cmdBtn = (r, label, glyph, litNow) => {
      paintButton(ctx, r, { primary: litNow, dark: !litNow });
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      small(ctx, Math.min(38, r.h * 0.34), 800); ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 - 12);
      small(ctx, Math.min(30, r.h * 0.28), 700); ctx.fillText(glyph, r.x + r.w / 2, r.y + r.h / 2 + r.h * 0.2);
    };
    cmdBtn(L.haw, 'Haw', '◀ left', lit === 'L' && Math.sin(G.t * 10) > -0.2);
    cmdBtn(L.gee, 'Gee', 'right ▶', lit === 'R' && Math.sin(G.t * 10) > -0.2);
    const bk = L.brake, on = s.brake;
    paintButton(ctx, bk, { active: on, dark: !on });
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    small(ctx, Math.min(36, bk.h * 0.32), 800); ctx.fillText('Brake', bk.x + bk.w / 2, bk.y + bk.h / 2 - 12);
    small(ctx, 26, 700); ctx.fillText(on ? 'DOWN' : 'tap', bk.x + bk.w / 2, bk.y + bk.h / 2 + bk.h * 0.2);
    ctx.textBaseline = 'alphabetic';
  }

  // set-off prompt
  if (s.phase === 'ready' && !watching) {
    const gr = goRect(L);
    const leg = s.L;
    const info = [`${Math.round(leg.len)} m`, leg.hill > 6 ? 'big hills' : leg.hill > 3.5 ? 'rolling hills' : 'gentle hills', leg.weather === 'whiteout' ? 'whiteout' : leg.weather === 'snow' ? 'snowfall' : 'clear', leg.rough.length ? 'rough ice' : null, leg.jx.length ? `${leg.jx.length} junction${leg.jx.length > 1 ? 's' : ''}` : null].filter(Boolean).join('  ·  ');
    const fs = fitPx(ctx, info, 700, 26, Math.min(L.xr - L.xl - 30, 680), MIN_FONT);
    ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    textShadow(ctx, info, gr.x + gr.w / 2, gr.y - 18, '#fff', 6);
    drawButton(ctx, gr, 'Go!', { primary: true, size: 44 });
    legend(ctx, L.team.x + 4, L.team.y - 14, L.team.w);
  }

  // checkpoint panel
  if (stop && !watching) renderStop(ctx, G, L);
  else if (stop && watching) {
    // Watch & Learn at a checkpoint: show the cards only
    const SL = stopLayout(G.settings.textIdx);
    panel(ctx, SL.panel.x, SL.panel.y, SL.panel.w, SL.cards[3].y + SL.cards[3].h + 14 - SL.panel.y, { r: 22, fill: 'rgba(10,20,48,0.86)', stroke: 'rgba(190,220,255,0.35)' });
    renderStopHead(ctx, G, SL);
    s.dogs.forEach((d, i) => dogCard(ctx, SL.cards[i], d, { big: true }));
  }

  // finish banner
  if (s.phase === 'finished') {
    const f = Math.min(1, Math.max(0, s.afterT / 0.4)), e = 1 - Math.pow(1 - f, 3);
    const cy = L.land ? L.scene.y + L.scene.h * 0.3 : L.scene.y + L.scene.h * 0.28, cx = L.land ? L.scene.x + L.scene.w / 2 : L.cx;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.globalAlpha = Math.min(1, e * 1.4);
    const word = fmtClock(s.clock);
    const fs = Math.min(110, Math.floor((live.w - 60) / (word.length * 0.6)));
    ctx.font = `900 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(10,20,48,0.85)'; ctx.strokeText(word, 0, 0);
    ctx.fillStyle = '#ffd54a'; ctx.fillText(word, 0, 0);
    ctx.font = `800 34px ${FONT}`; ctx.lineWidth = 6; ctx.fillStyle = '#fff';
    const tag = `Care ${Math.round(careScore(s) * 100)}%`;
    ctx.strokeText(tag, 0, 52); ctx.fillText(tag, 0, 52);
    ctx.restore();
  }

  if (G.think) renderThink(ctx, G, L);
  if (watching) renderWatch(ctx, G, L);
  if (G.hintMsg && s.phase === 'run') { small(ctx, 24, 700); ctx.textAlign = 'center'; textShadow(ctx, G.hintMsg, L.cx, L.noteY + 70, '#fff', 6); }
  // first-run coaching
  if (s.phase === 'run' && !G.think && !watching && mode !== 'shot' && G.progress.cups === 0 && G.progress.best === 0 && G.t < 40 + G.coachFrom && !G.cue) {
    const txt = 'Slide the lever to set the pace';
    const aw = (L.land ? L.noteW : L.xr - L.xl) - 40;
    const fs = fitPx(ctx, txt, 800, 26, aw - 40, MIN_FONT);
    ctx.font = `800 ${fs}px ${FONT}`; const tw = Math.min(aw, ctx.measureText(txt).width + 40);
    const cxp = L.land ? L.noteX + L.noteW / 2 : L.cx, py = L.noteY + 4;
    pill(ctx, cxp - tw / 2, py, tw, fs + 26, 'rgba(10,20,48,0.85)', 'rgba(255,212,90,0.8)');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9a0'; ctx.fillText(txt, cxp, py + (fs + 26) / 2); ctx.textBaseline = 'alphabetic';
  }
}

function renderStopHead(ctx, G, SL) {
  const s = G.run.s, h = SL.head;
  const v = s.vet;
  const worst = v ? v.flags.filter((f) => f.need.length).length : 0;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  small(ctx, 30, 800); ctx.fillStyle = '#fff';
  ctx.fillText(`Checkpoint ${s.leg + 1}`, h.x + 4, h.y + 28);
  small(ctx, 24, 400); ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const vet = v ? (worst === 0 ? `Vet: every dog looks well (${Math.round(v.mean * 100)}%)` : `Vet: ${worst} ${worst === 1 ? 'dog needs' : 'dogs need'} care (${Math.round(v.mean * 100)}%)`) : '';
  const f = fitPx(ctx, vet, 400, 24, h.w - 8, MIN_FONT); ctx.font = `400 ${f}px ${FONT}`;
  ctx.fillText(vet, h.x + 4, h.y + 28 + f * 1.35);
  ctx.textAlign = 'right'; small(ctx, 34, 800); ctx.fillStyle = '#ffd54a';
  ctx.fillText(fmtClock(s.clock), h.x + h.w - 4, h.y + 30);
  small(ctx, 22, 700); ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`stop ${fmtS(s.stop.elapsed)}${G.place ? ` · ${ord(G.place)}` : ''}`, h.x + h.w - 4, h.y + 30 + 26);
  legend(ctx, h.x + 4, h.y + h.h - 14, h.w);
}
function legend(ctx, x, y, w) {
  const items = [['Energy', '#5ed39a'], ['Water', '#6bb8ec'], ['Paws', '#d9b070'], ['Mood', '#f09aa0']];
  small(ctx, 22, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const gap = Math.min(150, w / 4);
  items.forEach(([n, c], i) => {
    const px = x + i * gap;
    ctx.fillStyle = c; roundPath(ctx, px, y - 5, 22, 10, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillText(n, px + 28, y + 1);
  });
  ctx.textBaseline = 'alphabetic';
}
export const ACTIONS = ['water', 'snack', 'paws', 'rest', 'praise', 'bag'];
function renderStop(ctx, G, L) {
  const SL = stopLayout(G.settings.textIdx), s = G.run.s;
  panel(ctx, SL.panel.x, SL.panel.y, SL.panel.w, SL.panel.h, { r: 24, fill: 'rgba(10,20,48,0.9)', stroke: 'rgba(190,220,255,0.4)' });
  renderStopHead(ctx, G, SL);
  s.dogs.forEach((d, i) => dogCard(ctx, SL.cards[i], d, { big: true, sel: G.selDog === i }));
  const sel = G.selDog;
  ctx.textAlign = 'center'; small(ctx, 22, 700); ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const midTxt = G.stopMsgT > 0 && G.stopMsg ? G.stopMsg : sel >= 0 ? `Care for ${s.dogs[sel].def.name} (tap the card again for the whole team)` : 'Care for the whole team (tap a dog to choose one)';
  if (G.stopMsgT > 0 && G.stopMsg) ctx.fillStyle = '#ffd54a';
  const mf = fitPx(ctx, midTxt, 700, 22, SL.mid.w - 8, MIN_FONT); ctx.font = `700 ${mf}px ${FONT}`;
  ctx.fillText(midTxt, SL.mid.x + SL.mid.w / 2, SL.mid.y + 19);
  ACTIONS.forEach((a, k) => {
    const r = SL.actions[k], C = CARE[a];
    let cost, label = C.name, disabled = false, sub;
    if (a === 'bag') {
      if (sel < 0) { disabled = true; sub = 'choose a dog'; label = 'Bag'; }
      else { const d = s.dogs[sel]; label = d.riding ? 'Harness' : 'Bag'; cost = C.one; sub = `${fmtS(cost)}`; if (d.riding && d.e < 0.45) { disabled = true; sub = 'too tired'; } }
    } else if (a === 'rest') { cost = C.all; sub = `${fmtS(cost)} · team`; }
    else { cost = sel >= 0 ? C.one : C.all; sub = fmtS(cost); }
    drawButton(ctx, r, label, { dark: true, size: 28, sub, disabled });
  });
  const ready = true;
  drawButton(ctx, SL.leave, G.hasNextLeg ? 'Leave the checkpoint' : 'Leave', { primary: ready, size: 32, sub: G.hasNextLeg ? `next leg: ${Math.round(G.nextLen)} m` : '' });
}

function noteBox(ctx, L, lines, y, title) {
  const avail = L.land ? L.noteW : L.xr - L.xl - 28;
  const w = Math.min(660, avail), x = Math.round((L.land ? L.noteX + L.noteW / 2 : L.cx) - w / 2);
  const fs = Math.max(MIN_FONT, 26);
  ctx.font = `400 ${fs}px ${FONT}`;
  const wrapped = lines.flatMap((l) => wrapLines(ctx, l, w - 40));
  const h = 28 + (title ? fs * 1.4 : 0) + wrapped.length * fs * 1.3 + 16;
  panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(10,20,48,0.92)', stroke: 'rgba(190,220,255,0.4)' });
  let yy = y + 20;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (title) { ctx.font = `800 ${Math.round(fs * 1.1)}px ${FONT}`; ctx.fillStyle = '#ffd54a'; yy += fs * 0.9; ctx.fillText(title, x + 20, yy); yy += fs * 0.5; }
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
  const lines = wt.lines || [];
  if (lines.length && (wt.phase === 'think' || wt.phase === 'reveal' || wt.phase === 'care')) {
    const total = Math.max(0.1, wt.total || 1);
    const n = wt.phase === 'think' ? Math.max(1, Math.min(lines.length, Math.ceil(lines.length * (1 - wt.timer / total) + 0.001))) : lines.length;
    const title = wt.phase === 'think' ? `Thinking...  ${Math.ceil(wt.timer)}` : wt.phase === 'care' ? 'Caring for the team' : 'Reveal';
    noteBox(ctx, L, lines.slice(0, n), L.noteY + 8, title);
  } else if (s && s.finished) {
    noteBox(ctx, L, [`The team finished in ${fmtClock(s.clock)} with a care score of ${Math.round(careScore(s) * 100)}%.`], L.noteY + 8, 'Result');
  } else if (wt.phase === 'act' && s && s.phase === 'run') {
    noteBox(ctx, L, ['The driver follows the plan.'], L.noteY + 8, 'Act');
  }
  const labels = [wt.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Stop'];
  const subs = [wt.paused ? 'Paused' : '', `${THINK_STEPS[st.thinkIdx]} s`, `${THINK_STEPS[st.thinkIdx]} s`, ''];
  rects.forEach((r, i) => drawButton(ctx, r, labels[i], { primary: i === 0 && wt.paused, dark: !(i === 0 && wt.paused), size: 26, disabled: (i === 1 && st.thinkIdx === 0) || (i === 2 && st.thinkIdx === THINK_STEPS.length - 1), sub: i === 1 || i === 2 ? subs[i] : (i === 0 ? subs[0] : '') }));
  if (wt.paused) { small(ctx, 30, 800); ctx.textAlign = 'center'; textShadow(ctx, 'PAUSED', L.land ? L.scene.x + L.scene.w / 2 : L.cx, L.scene.y + L.scene.h * 0.4, '#ffd54a', 8); }
}
