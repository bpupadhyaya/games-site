// Every non-play screen: title, role choice, setup, role tutorial, Learn, settings, How to Play / Rules / About (paged), innings break, results, demo limit.
// They share the ui.js column kit (text zoom 100-300%, paging, scrolling). Reads G; the only thing it writes is G._ui (hit rectangles for the update step).
import { W, H, PITCH, FIELD, clamp, lerp, ease, LEVELS, MODES, ROLE_KEYS } from './core.js';
import { PAL, FONT, SANS, rr, textFill, wrapLines, vGrad, glow } from './art.js';
import { TEXT_SCALES, drawButton, drawPill, panel, layoutColumn, drawColumn, pageStarts, pageClip, maxScroll, scrollbar } from './ui.js';
import { ABOUT, HOWTO, RULES, ROLE_INFO, LESSONS } from './content.js';
import { WINDOWS } from './ball.js';
import { SLOTS } from './field.js';

export const Z = {
  zoomDec: { x: 16, y: 14, w: 100, h: 58 }, zoomInc: { x: 604, y: 14, w: 100, h: 58 },
};
export const scaleOf = (G) => TEXT_SCALES[clamp(G.settings.textIdx, 0, TEXT_SCALES.length - 1)];
const hidden = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); };
function setUi(G, ui) { if (!('_ui' in G)) hidden(G, '_ui', ui); else G._ui = ui; }

export function drawBackdrop(ctx, G, transparentTop = false) {
  if (transparentTop) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(2,24,32,0.15)'); g.addColorStop(0.45, 'rgba(2,24,32,0.55)'); g.addColorStop(1, 'rgba(2,24,32,0.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
  }
  ctx.fillStyle = vGrad(ctx, 0, H, [[0, '#0c4a5e'], [0.5, '#0a3a4c'], [1, '#062a38']]); ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.07; ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 3;
  for (let k = 0; k < 14; k++) { const y = 80 + k * 90 + Math.sin(G.t * 0.6 + k) * 4; ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + k + G.t * 0.8) * 8); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

function zoomPills(ctx, G) {
  const s = G.settings.textIdx;
  drawPill(ctx, Z.zoomDec, 'A−', { disabled: s === 0 });
  drawPill(ctx, Z.zoomInc, 'A+', { disabled: s === TEXT_SCALES.length - 1 });
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = 'rgba(255,244,220,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(TEXT_SCALES[s] * 100)}%`, W / 2, 43);
}

function footerLayout(ctx, btns, s) {
  if (!btns.length) return { top: H - 30, buttons: [] };
  const m = 24, gapx = 14;
  const stack = s >= 2 && btns.length > 1;
  const size = 30 * s;
  const out = [];
  let top;
  ctx.font = `700 ${size}px ${FONT}`;
  if (stack) {
    const hs = btns.map((b) => Math.max(88, wrapLines(ctx, b.label, W - m * 2 - 28).length * size * 1.2 + 44));
    const total = hs.reduce((a, b) => a + b + gapx, 0);
    top = H - 24 - total + gapx;
    let y = top;
    btns.forEach((b, i) => { out.push({ ...b, size, rect: { x: m, y, w: W - m * 2, h: hs[i] } }); y += hs[i] + gapx; });
  } else {
    const n = btns.length, bw = (W - m * 2 - gapx * (n - 1)) / n;
    const hs = btns.map((b) => Math.max(92, wrapLines(ctx, b.label, bw - 28).length * size * 1.2 + 44));
    const hh = Math.max(...hs);
    top = H - 24 - hh;
    btns.forEach((b, i) => out.push({ ...b, size, rect: { x: m + i * (bw + gapx), y: top, w: bw, h: hh } }));
  }
  return { top, buttons: out };
}

function columnScreen(ctx, G, spec) {
  const s = scaleOf(G);
  if (!spec.over3d) drawBackdrop(ctx, G, false);
  zoomPills(ctx, G);
  const fy = footerLayout(ctx, spec.footer ?? [], s);
  const top = 90, bottom = fy.top - 10 - (spec.paged ? 34 : 0);
  const view = { x: 34, y: top, w: W - 68, h: bottom - top };
  const lay = layoutColumn(ctx, spec.items, view.w - 10, s);
  const pages = spec.paged ? pageStarts(lay, view.h) : null;
  let sc = clamp(G.ui.scroll, 0, maxScroll(lay, view.h));
  let pi = 0, clipH = null;
  if (pages) {
    for (let i = 0; i < pages.length; i++) if (sc >= pages[i] - 2) pi = i;
    sc = pages[pi];
    clipH = pageClip(lay, sc, view.h);
  }
  G.ui.scroll = sc;
  const hits = drawColumn(ctx, lay, view, sc, s, G, clipH);
  if (!pages) scrollbar(ctx, view, sc, lay.total);
  for (const b of fy.buttons) drawButton(ctx, b.rect, b.label, { primary: b.primary, disabled: b.disabled, size: b.size, sub: b.sub, active: b.active, danger: b.danger });
  setUi(G, { hits, footer: fy.buttons.filter((b) => !b.disabled).map((b) => ({ id: b.id, rect: b.rect })), view, lay, pages, maxS: maxScroll(lay, view.h) });
  if (pages) {
    ctx.font = `600 22px ${SANS}`; ctx.fillStyle = 'rgba(255,244,220,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Page ${pi + 1} of ${pages.length}`, W / 2, fy.top - 14);
    G.ui.pageIdx = pi; G.ui.pageN = pages.length;
  }
}

// ---- figures (the game's own art: field dots, the swipe, the catch ring) -----------------------------------------------------------------------------
function figSwipe(ctx, w, h) {
  const cx = w / 2;
  panel(ctx, { x: cx - 250, y: 4, w: 500, h: h - 8 }, { radius: 24 });
  const gx = cx - 90, gy = h - 40;
  for (const [a, col, lab] of [[-0.9, '#7ad7c5', 'leg'], [0, '#ffe08a', 'straight'], [0.9, '#ff9a8a', 'off']]) {
    const ex = gx + Math.sin(a) * 150, ey = gy - Math.cos(a) * (h - 90);
    ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ex, ey, 12, 0, 7); ctx.fill();
    ctx.font = `600 20px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(lab, ex, ey - 20);
  }
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('Swipe up and', cx + 70, h / 2 - 8); ctx.fillText('sideways to aim', cx + 70, h / 2 + 22);
}
function figFlick(ctx, w, h) {
  const cx = w / 2;
  panel(ctx, { x: cx - 250, y: 4, w: 500, h: h - 8 }, { radius: 24 });
  ctx.fillStyle = '#d9cdb0'; ctx.beginPath(); ctx.moveTo(cx - 40, 24); ctx.lineTo(cx + 40, 24); ctx.lineTo(cx + 120, h - 24); ctx.lineTo(cx - 120, h - 24); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.ellipse(cx + 10, h * 0.42, 34, 14, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 170, h - 30); ctx.lineTo(cx - 150, 40); ctx.stroke();
  ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(cx - 150, 40, 14, 0, 7); ctx.fill();
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('flick up', cx - 140, h / 2); ctx.fillText('the ring shows', cx + 90, h * 0.42 - 8); ctx.fillText('where it lands', cx + 90, h * 0.42 + 20);
}
function figCatch(ctx, w, h) {
  const cx = w / 2, cy = h / 2 + 10;
  panel(ctx, { x: cx - 250, y: 4, w: 500, h: h - 8 }, { radius: 24 });
  ctx.fillStyle = '#4c9a48'; ctx.beginPath(); ctx.ellipse(cx, cy, 220, h / 2 - 20, 0, 0, 7); ctx.fill();
  for (const [r, col] of [[90, 'rgba(255,225,120,0.6)'], [60, '#ffd36b'], [34, '#7dff9d']]) { ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(cx + 150, cy - 70, 9, 0, 7); ctx.fill();
  ctx.setLineDash([6, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 150, cy - 70); ctx.lineTo(cx + 20, cy - 8); ctx.stroke(); ctx.setLineDash([]);
  textFill(ctx, 'CATCH!', cx, cy - 112, 34, { font: SANS, weight: 800, color: '#7dff9d', stroke: 'rgba(0,30,20,0.8)' });
}
function figGround(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  const sx = (Math.min(w - 60, 420) / 2) / FIELD.ax, sz = (h / 2 - 12) / FIELD.az;
  ctx.fillStyle = '#4c9a48'; ctx.beginPath(); ctx.ellipse(cx, cy, FIELD.ax * sx, FIELD.az * sz, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 3; ctx.stroke();
  const P = (x, z) => [cx + (x - FIELD.cx) * sx, cy - (z - FIELD.cz) * sz];
  const [a0, b0] = P(-1.3, 0), [a1, b1] = P(1.3, PITCH);
  ctx.fillStyle = '#d9cdb0'; ctx.fillRect(a0, b1, a1 - a0, b0 - b1);
  const slots = SLOTS.map((q) => [q.x, q.z, q.role === 'bowler' ? 'bowler' : q.role === 'wk' ? 'keeper' : '']);
  for (const [x, z, lab] of slots) { const [px, py] = P(x, z); ctx.fillStyle = '#ec6b2d'; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill(); if (lab) { ctx.font = `600 16px ${SANS}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(lab, px + 9, py + 5); } }
  for (const [x, z] of [[0.55, 0.3], [-0.55, PITCH - 0.3]]) { const [px, py] = P(x, z); ctx.fillStyle = '#16a39a'; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill(); }
  ctx.font = `600 18px ${SANS}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('rope', cx, cy + FIELD.az * sz - 4);
}
function figTiming(ctx, w, h) {
  const cx = w / 2, bw = Math.min(560, w - 40), x0 = cx - bw / 2, y = h / 2 - 16;
  const span = WINDOWS.poor * 1.1;
  const X = (e) => x0 + bw / 2 + (e / span) * (bw / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, x0, y, bw, 32, 10); ctx.fill();
  for (const [k, col] of [['poor', '#ff9a8a'], ['ok', '#ffb347'], ['good', '#8be07a'], ['perfect', '#ffd34d']]) { const e = WINDOWS[k]; ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(X(-e), y, X(e) - X(-e), 32); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#fff'; ctx.fillRect(cx - 2, y - 10, 4, 52);
  ctx.font = `600 20px ${SANS}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('early', x0 + 36, y + 70); ctx.fillText('the ball reaches the bat', cx, y + 70); ctx.fillText('late', x0 + bw - 28, y + 70);
}
export const FIGS = { swipe: figSwipe, flick: figFlick, catch: figCatch, ground: figGround, timing: figTiming };

// ---- screen specs -----------------------------------------------------------------------------------------------------------------------------------------
function heroFig(ctx, w, h, G) {
  const cx = w / 2, t = G.t;
  textFill(ctx, 'KILIKITI', cx, h * 0.52, Math.min(w * 0.2, h * 0.5), { italic: true, grad: [[0, '#fff3c2'], [0.6, '#ffc54d'], [1, '#ff8a3d']], stroke: 'rgba(70,24,10,0.65)' });
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.textAlign = 'center';
  const tag = 'A village match: swipe, flick, run and catch.';
  let sz = Math.min(26, w * 0.04) * Math.min(scaleOf(G), 2); ctx.font = `600 ${sz}px ${SANS}`; while (sz > 12 && ctx.measureText(tag).width > w - 30) { sz -= 1; ctx.font = `600 ${sz}px ${SANS}`; }
  ctx.fillText(tag, cx, h * 0.9);
  const u = (t * 0.4) % 1;
  glow(ctx, lerp(w * 0.1, w * 0.9, u), h * 0.8 - Math.sin(u * Math.PI) * h * 0.3, 18, 'rgba(255,170,90,A)', 0.5);
}

export function sceneSpec(G) {
  const s = scaleOf(G), pf = G.settings;
  const demo = G.env.config.demo;
  switch (G.scene) {
    case 'title': {
      const items = [{ t: 'fig', h: s >= 2 ? 250 : 340, draw: (ctx, w, h) => heroFig(ctx, w, h, G) }];
      if (G.saved) items.push({ t: 'btn', id: 'continue', label: 'Continue', sub: `${G.saved.roleName}, innings ${G.saved.innNo + 1}: ${G.saved.line}`, primary: true });
      items.push({ t: 'btn', id: 'play', label: 'Play', sub: 'Pick a role and play a match', primary: !G.saved });
      items.push({ t: 'btn', id: 'learn', label: 'Learn', sub: 'A short practice for each role' });
      items.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The computer plays and explains' });
      items.push({ t: 'btn', id: 'howto', label: 'How to Play' }, { t: 'btn', id: 'rules', label: 'Rules' }, { t: 'btn', id: 'about', label: 'About' }, { t: 'btn', id: 'settings', label: 'Settings' });
      return { items, footer: [], over3d: true };
    }
    case 'role': {
      const items = [{ t: 'title', text: 'Choose your role', size: 40, sub: 'You play one player in your team. The computer plays everyone else. You can change role between matches.' }];
      for (const k of ROLE_KEYS) items.push({ t: 'card', id: `role:${k}`, title: ROLE_INFO[k].title, text: ROLE_INFO[k].short, tag: G.records[k] ? `Played ${G.records[k].played}, won ${G.records[k].wins}` : 'Not played yet', accent: { bat: '#2ec4b6', bowl: '#ffcf6b', inner: '#ff9a6a', deep: '#8be07a' }[k] });
      return { items, footer: [{ id: 'back', label: 'Back' }], over3d: false };
    }
    case 'setup': {
      const su = G.setup, info = ROLE_INFO[su.role];
      const lvl = LEVELS[su.level - 1];
      const items = [
        { t: 'title', text: `Role: ${info.title}`, size: 38, sub: info.short },
        { t: 'chips', id: 'mode', label: 'Match length', value: su.mode, options: [{ v: 'quick', label: `Quick: ${MODES.quick.balls} balls` }, { v: 'match', label: `Full: ${MODES.match.balls} balls`, disabled: demo }] },
        { t: 'chips', id: 'level', label: 'Opponent', value: su.level, options: LEVELS.map((l) => ({ v: l.key, label: `${l.key}`, disabled: demo && l.key > 3 })) },
        { t: 'para', text: `${lvl.name}: ${lvl.who}. ${lvl.blurb}`, color: PAL.peach },
        { t: 'fig', h: 250, draw: (ctx, w, h) => FIGS[info.fig](ctx, w, h) },
        { t: 'h', text: 'What you do' },
        ...info.steps.slice(0, 2).map((x, i) => ({ t: 'para', text: `${i + 1}. ${x}` })),
        { t: 'btn', id: 'roleinfo', label: 'The full tutorial', sub: 'All the steps, with a picture' },
        { t: 'para', text: su.role === 'bat' ? 'Your side bats first, then fields.' : 'The visitors bat first and your side chases. You play your role while your side fields.' },
        { t: 'para', text: `Your team mates are the computer at level 3. ${su.mode === 'quick' ? MODES.quick.blurb : MODES.match.blurb}` },
      ];
      return { items, footer: [{ id: 'back', label: 'Back' }, { id: 'start', label: 'Start', primary: true }] };
    }
    case 'roleinfo': {
      const info = ROLE_INFO[G.setup.role];
      const items = [{ t: 'title', text: info.title, size: 40, sub: info.short }, { t: 'fig', h: 280, draw: (ctx, w, h) => FIGS[info.fig](ctx, w, h) }];
      info.steps.forEach((x, i) => items.push({ t: 'para', text: `${i + 1}. ${x}` }));
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }] };
    }
    case 'learn': {
      const items = [{ t: 'title', text: 'Learn', size: 42, sub: 'Pick a role. Each practice is six balls with a goal and unlimited hints.' }];
      for (const k of ROLE_KEYS) { const L = LESSONS[k]; items.push({ t: 'card', id: `learn:${k}`, title: L.title, text: `${L.text} Goal: ${L.goal}.`, tag: G.learn.done[k] ? 'Done' : 'Not done yet', accent: G.learn.done[k] ? '#8be07a' : '#ffcf6b' }); }
      return { items, footer: [{ id: 'back', label: 'Back' }] };
    }
    case 'watchsetup': {
      const ws = G.setup;
      const items = [
        { t: 'title', text: 'Watch & Learn', size: 40, sub: 'The computer plays both sides and explains each choice: THINK, REVEAL, ACT.' },
        { t: 'chips', id: 'wa', label: 'Home side level', value: ws.watchA, options: LEVELS.map((l) => ({ v: l.key, label: `${l.key}` })) },
        { t: 'chips', id: 'wb', label: 'Visitors level', value: ws.watchB, options: LEVELS.map((l) => ({ v: l.key, label: `${l.key}` })) },
        { t: 'para', text: 'A quick match of 12 balls. You can pause at any time, change the thinking time and the speed.' },
      ];
      return { items, footer: [{ id: 'back', label: 'Back' }, { id: 'start', label: 'Watch', primary: true }] };
    }
    case 'settings': {
      const items = [
        { t: 'title', text: 'Settings', size: 42 },
        { t: 'row', id: 'set:sound', label: 'Sound', value: pf.sound ? 'On' : 'Off' },
        { t: 'row', id: 'set:assist', label: 'Timing window', value: ['Sharp', 'Standard', 'Relaxed'][pf.assist] },
        { t: 'row', id: 'set:think', label: 'Watch & Learn thinking time', value: `${[2, 5, 8, 10][pf.thinkIdx]} s` },
        { t: 'para', text: 'Tap a row to change it. Use A− and A+ at the top of any screen to change the text size from 100% to 300%.' },
        { t: 'btn', id: 'set:restore', label: 'Restore purchase', sub: G.restoreMsg || '' },
      ];
      if (G.env.config.dev) items.push({ t: 'btn', id: 'set:dev', label: 'Developer: reset saved match' });
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }] };
    }
    case 'howto': case 'about': case 'rules': {
      const doc = G.scene === 'howto' ? HOWTO : G.scene === 'about' ? ABOUT.concat(G.credits ?? []) : RULES;
      const items = doc.map((it) => (it.t === 'fig' ? { ...it, draw: (ctx, w, h) => FIGS[it.key](ctx, w, h) } : it));
      return { items, paged: true, footer: [{ id: 'prev', label: 'Back' }, { id: 'next', label: G.ui.pageIdx >= G.ui.pageN - 1 ? 'Done' : 'Next', primary: true }] };
    }
    case 'break': {
      const r = G.breakInfo;
      const items = [
        { t: 'title', text: 'Innings break', size: 42, sub: r.sub },
        { t: 'stat', label: `${r.team} scored`, value: `${r.runs}/${r.wk}`, color: PAL.cream },
        { t: 'stat', label: 'Balls', value: String(r.balls) },
        { t: 'stat', label: 'Fours and sixes', value: `${r.f4} and ${r.f6}` },
        { t: 'stat', label: 'Target to chase', value: String(r.target), color: PAL.teal },
        { t: 'para', text: r.next },
      ];
      return { items, footer: [{ id: 'go', label: r.cta, primary: true }] };
    }
    case 'result': {
      const r = G.result;
      const items = [
        { t: 'title', text: r.headline, size: 44, sub: r.sub },
        ...r.lines.map((l) => ({ t: 'stat', label: l[0], value: l[1], color: l[2] })),
        { t: 'rule' }, { t: 'h', text: 'Scorecards' },
        ...r.cards.flatMap((c) => [{ t: 'para', text: c.title, color: PAL.gold }, ...c.rows.map((x) => ({ t: 'stat', label: x.name, value: x.line, color: x.out ? '#ff9a8a' : PAL.cream }))]),
      ];
      const footer = [{ id: 'again', label: 'Play again', primary: true }];
      if (r.practice) footer.push({ id: 'learn', label: 'Learn' });
      footer.push({ id: 'menu', label: 'Menu' });
      return { items, footer };
    }
    case 'demolimit': {
      const items = [
        { t: 'title', text: 'That was the free taste', size: 40 },
        { t: 'para', text: 'You have played the free matches in this web preview. The full game, with full matches, all five levels and unlimited play, is on iPhone and Android.' },
        { t: 'para', text: 'Learn and Watch & Learn are still free here.' },
      ];
      return { items, footer: [{ id: 'learn', label: 'Learn' }, { id: 'menu', label: 'Menu', primary: true }] };
    }
    default: return { items: [], footer: [] };
  }
}

export function renderScreen(ctx, G) {
  columnScreen(ctx, G, sceneSpec(G));
}
