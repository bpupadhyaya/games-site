// Every screen that is not the play screen: title, setup, settings, result, pause, the reason reader, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own bout art). Pure drawing; game.js owns state.
import { W, H, LAND, SAFE, PANEL, host, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, flowGeom, modalGeom, lockSize, minTap } from './layout.js';
import { drawCredit, drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, SERIF, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, FLOOR } from './ui.js';
import { PROFILES, createDriver } from './ai.js';
import { RINGS, drawStage, drawDisc, newPose, stepPose, SASH } from './view.js';
import { newFall, resolve, POW_NAMES } from './sim.js';
import { TIMERS } from './content.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;

// ---- the attract fall behind the menus -----------------------------------------------------------------------------------
// Two strong computer wrestlers play real beats in a loop behind the menus: real engine, no input.
export function newAttract(rng) {
  const a = { rng, F: null, d: [null, null], pose: newPose(), ring: 0, wait: 0, k: 0, looks: [0, 1], builds: [1, 1], disp: [{ x: 0, y: 0 }, { x: 0, y: 0 }], beatT: 0, clock: 0 };
  restartAttract(a);
  return a;
}
function restartAttract(a) {
  a.F = newFall(); a.k++;
  const pa = PROFILES[2 + (a.k % 3)], pb = PROFILES[1 + ((a.k + 1) % 4)];
  a.d = [createDriver(pa, a.rng.fork()), createDriver(pb, a.rng.fork())];
  a.ring = a.k % 3; a.looks = [0, 1 + (a.k % 5)]; a.builds = [pa.build, pb.build]; a.wait = 0; a.beatT = 0.8;
  a.disp = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
}
export function stepAttract(a, dt) {
  const F = a.F;
  if (F.over) {
    a.wait += dt;
    for (let i = 0; i < 2; i++) { a.disp[i].x += (F.p[i].x - a.disp[i].x) * Math.min(1, dt * 8); a.disp[i].y += (F.p[i].y - a.disp[i].y) * Math.min(1, dt * 8); }
    stepPose(a.pose, a.disp, dt, F.over, null, -1);
    if (a.wait > 2.6) restartAttract(a);
    return;
  }
  a.beatT -= dt;
  if (a.beatT <= 0) { resolve(F, [a.d[0].choose(F, 0), a.d[1].choose(F, 1)]); a.beatT = 1.7; for (let i = 0; i < 2; i++) a.pose.s[i].act = 1; }
  for (let i = 0; i < 2; i++) { a.disp[i].x += (F.p[i].x - a.disp[i].x) * Math.min(1, dt * 5); a.disp[i].y += (F.p[i].y - a.disp[i].y) * Math.min(1, dt * 5); }
  stepPose(a.pose, a.disp, dt, null, null, -1);
}
export function drawAttract(ctx, state) {
  const a = state.att; if (!a) return;
  drawStage(ctx, { x: 0, y: 0, w: W, h: H }, { ring: RINGS[a.ring].id, t: state.t, pose: a.pose, looks: a.looks, builds: a.builds, parts: [], pops: [], cheer: 0.3 });
}

// ---- flow screens ------------------------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H, sz: '' };
export const flowMeta = () => LAID;
export function resetMenus() { LAID = { key: '', lay: null, top: 0, bottom: H, sz: '' }; }
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.55 }; } };
const MODALS = new Set(['pause', 'reason']);
const BUILD = { title: titleWidgets, setup: setupWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets, pause: pauseWidgets, reason: reasonWidgets };
function colOf(key) {
  if (MODALS.has(key)) { const m = modalGeom(); return { x: m.x + 30, w: m.w - 60, top: m.top, bottom: m.bottom, split: false }; }
  const g = flowGeom(key);
  return { x: g.x, w: g.w, top: g.top, bottom: g.bottom, split: g.split };
}
const vOffset = (key, contentH, top, bottom) => (MODALS.has(key) || key === 'setup' ? 0 : Math.max(0, (bottom - top - contentH) * (key === 'title' ? 0.3 : 0.12)));
export function ensureLayout(state, key) {
  const sz = `${W}x${H}|${state.settings.textIdx}`;
  if (LAID.key === key && LAID.lay && LAID.sz === sz) return;
  const c = colOf(key);
  const lay = flowLayout(estCtx, BUILD[key](state, c.split), TEXT_SCALES[state.settings.textIdx], { x: c.x, w: c.w, minH: minTap() });
  const off = vOffset(key, lay.contentH, c.top, c.bottom);
  LAID = { key, lay, top: c.top + off, bottom: c.bottom, h: lay.contentH, sz, lock: lockFor(key, c, c.top + off, lay) };
}
function lockFor(key, c, top, lay) {
  if (key !== 'title') return null;
  const ls = lockSize(c.w), cx = c.x + c.w / 2, pinned = SAFE.y1 - ls.h - 12, y = Math.min(top + lay.contentH + 12, pinned);
  const m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
  return { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function hitScreen(x, y, scroll) {
  { const t = LAID.key === 'title' && LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null;
}

function drawHero(ctx, cx, y0, scale = 1) {
  ctx.save(); ctx.translate(cx, y0); ctx.scale(scale, scale); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 28px ${SERIF}`; textShadow(ctx, 'THE SASH WRESTLING OF KOREA', 0, 66, '#ffe9bd', 8);
  ctx.font = `italic 800 150px ${SERIF}`; textShadow(ctx, 'Ssireum', 0, 200, '#fff3d6', 16);
  // the painter's seal
  ctx.save(); ctx.translate(0, 244); ctx.rotate(0.05);
  ctx.fillStyle = '#c8312f'; roundPath(ctx, -26, -26, 52, 52, 7); ctx.fill();
  ctx.fillStyle = '#fbe8d0'; ctx.font = `800 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('씨름', 0, 8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,200,120,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-230, 244); ctx.lineTo(-30, 244); ctx.moveTo(30, 244); ctx.lineTo(230, 244); ctx.stroke();
  ctx.font = `500 29px ${FONT}`; textShadow(ctx, 'Read their balance. Hook the sash.', 0, 296, '#fff3dc', 7);
  ctx.restore();
}
const heroArt = (h = 330, hs = 1) => ({ t: 'art', h, draw(ctx, w) { drawHero(ctx, w / 2, 0, hs); } });

export function titleWidgets(state, split = false) {
  const sound = state.settings.sound;
  const tall = H >= 1180;
  const wd = split ? [{ t: 'gap', h: 18 }] : H < 1120 ? [heroArt(250, 0.8), { t: 'gap', h: 14 }] : [heroArt(tall ? 330 : 310), { t: 'gap', h: tall ? 100 : 40 }];
  wd.push({ t: 'btn', id: 'play', label: 'Play', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  wd.push({ t: 'gap', h: split ? 10 : 70 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'New Match', size: 48 }];
  wd.push({ t: 'p', label: 'Who is playing', bold: true, color: '#ffd24a', size: 26 });
  wd.push({ t: 'btn', id: 'mode-ai', label: 'Against the computer', active: s.mode === 'ai', dark: s.mode !== 'ai', h: 80 });
  wd.push({ t: 'btn', id: 'mode-two', label: 'Two players, pass the phone', active: s.mode === 'two', dark: s.mode !== 'two', h: 80 });
  if (s.mode === 'ai') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffd24a', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: `${pf.name} · ${pf.cls}`, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, dark: s.opp !== i, disabled: locked, hitDisabled: true, h: 88 });
    });
  }
  wd.push({ t: 'p', label: 'Ring', bold: true, color: '#ffd24a', size: 26 });
  for (const v of RINGS) {
    const locked = demo && v.id !== 'danoh';
    wd.push({ t: 'btn', id: `hall-${v.id}`, label: v.name, sub: locked ? 'In the full game' : v.blurb, active: s.hall === v.id && !locked, dark: s.hall !== v.id, disabled: locked, hitDisabled: true, h: 88 });
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

const monetization_owned = (state) => !!state.owned?.();
export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffd24a', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Choosing time: ${TIMERS[st.timerIdx].label}`, bold: true, color: '#ffd24a', size: 26 },
    { t: 'btn', id: 'timer-dec', label: 'Shorter', row: 9, disabled: st.timerIdx === 0 },
    { t: 'btn', id: 'timer-inc', label: 'Longer', row: 9, disabled: st.timerIdx === TIMERS.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffd24a', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: monetization_owned(state) ? 'Full game unlocked' : 'Restore purchase', dark: true, disabled: monetization_owned(state) }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffd24a' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.m, o = m.over, names = m.players.map((p) => p.name);
  const watch = m.cfg.mode === 'watch';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  let title;
  if (watch) title = 'Match finished';
  else if (names[o.win] === 'You') title = 'You win the match!';
  else title = `${names[o.win]} wins the match`;
  const wd = [{ t: 'gap', h: big ? 24 : 60 }, { t: 'h', label: title, size: 60, cap: big ? 1.2 : 1.5 }];
  wd.push({ t: 'h', label: `${m.wins[0]} - ${m.wins[1]}`, size: 54, cap: big ? 1.1 : 1.3, color: '#ffd24a' });
  m.results.forEach((r, i) => {
    const who = names[r.win];
    wd.push({ t: 'p', label: `Fall ${i + 1}: ${who} won with ${r.name} on beat ${r.beats}`, size: 26, cap: big ? 2 : 3 });
  });
  if (o.record) wd.push({ t: 'p', label: o.record, bold: true, color: '#b9f0d8', size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 20 });
  wd.push({ t: 'btn', id: 'again', label: watch ? 'Watch again' : 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: watch ? 'Play a match' : 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-timer', label: `Timer: ${TIMERS[st.timerIdx].label}`, row: 8 },
    { t: 'btn', id: 'p-txtdec', label: 'A−', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txtinc', label: 'A+', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function reasonWidgets(state) {
  const k = state.card ?? { title: '', text: '' };
  return [{ t: 'h', label: k.title, size: 40, color: '#ffd24a' }, { t: 'p', label: k.text, size: 26, align: 'left', pad: 4 }, { t: 'btn', id: 'reason-close', label: 'Close', primary: true, h: 84 }];
}
export function demoLimitWidgets(state) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: big ? 30 : 160 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free falls of the web demo. The full game on iPhone and Android has all five rivals, all three rings, two-player matches and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(24,14,8,${a * 0.75})`); g.addColorStop(0.5, `rgba(24,14,8,${a})`); g.addColorStop(1, `rgba(24,14,8,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(24,14,8,0)'); g.addColorStop(1, 'rgba(24,14,8,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(244,247,238,0.94)'; ctx.fill();
    ctx.fillStyle = '#0d2224'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(244,247,238,0.94)'; ctx.fill();
    ctx.fillStyle = '#0d2224'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function prepFlow(ctx, state, key, widgets) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const c = colOf(key);
  const lay = flowLayout(ctx, widgets, sc, { x: c.x, w: c.w, minH: minTap() });
  const off = vOffset(key, lay.contentH, c.top, c.bottom);
  const top = c.top + off, bottom = c.bottom;
  LAID = { key, lay, top, bottom, h: lay.contentH, sz: `${W}x${H}|${state.settings.textIdx}`, lock: lockFor(key, c, top, lay) };
  return { lay, c, off, top, bottom };
}
function drawPrepared(ctx, state, f) {
  const { lay, top, bottom } = f;
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, SAFE.x1 - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(244,247,238,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, f.c.x, f.c.w);
  }
  return { scroll, maxScroll, lay };
}
const drawFlowScreen = (ctx, state, key, widgets) => drawPrepared(ctx, state, prepFlow(ctx, state, key, widgets));

function brandFooter(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(24,14,8,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  if (!drawLockupImage(ctx, k.cx, k.y + k.h + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1)) drawCredit(ctx, k.cx, k.y + k.h - 6, 13);
}

export function renderTitle(ctx, state) {
  const g = flowGeom('title'), split = g.split;
  const f = prepFlow(ctx, state, 'title', titleWidgets(state, split));
  drawAttract(ctx, state);
  if (split) {
    scrim(ctx, 0.46);
    const hx = (SAFE.x0 + f.c.x - 12) / 2;
    const rg = ctx.createRadialGradient(hx, H * 0.3, 40, hx, H * 0.3, 420);
    rg.addColorStop(0, 'rgba(24,14,8,0.7)'); rg.addColorStop(1, 'rgba(24,14,8,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, f.c.x, H);
    const hs = Math.min(1, (f.c.x - SAFE.x0 - 24) / 640);
    drawHero(ctx, hx, Math.max(SAFE.y0 + 24, H * 0.5 - 336 * hs * 0.62 - 40), hs);
  } else {
    scrim(ctx, 0.46);
    const rg = ctx.createRadialGradient(W / 2, 200 + f.off, 40, W / 2, 200 + f.off, 420);
    rg.addColorStop(0, 'rgba(24,14,8,0.7)'); rg.addColorStop(1, 'rgba(24,14,8,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, 700 + f.off);
    // a soft dark band behind the Arcforge lockup so the wrestlers' heads do not fight with it
    const by = SAFE.y1 - lockSize(f.c.w).strip - 60, bg = ctx.createLinearGradient(0, by, 0, SAFE.y1);
    bg.addColorStop(0, 'rgba(20,11,5,0)'); bg.addColorStop(0.45, 'rgba(20,11,5,0.62)'); bg.addColorStop(1, 'rgba(20,11,5,0.78)');
    ctx.fillStyle = bg; ctx.fillRect(0, by, W, H - by);
  }
  drawPrepared(ctx, state, f);
  brandFooter(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(244,247,238,0.6)';
  if (state.demo) ctx.fillText('Web demo', split ? (SAFE.x0 + f.c.x - 12) / 2 : W / 2, SAFE.y1 - 10);
}
export function renderSetup(ctx, state) {
  drawAttract(ctx, state); scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state));
  const y0 = SETUP_PINS.start.y - 56;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(24,14,8,0)'); g.addColorStop(0.2, 'rgba(24,14,8,0.88)'); g.addColorStop(1, 'rgba(24,14,8,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: LAND ? 28 : 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: LAND ? 26 : 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, SETUP_PINS.start.y - 16); }
}
export function renderSettings(ctx, state) { drawAttract(ctx, state); scrim(ctx, 0.74); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state)); }
export function renderResult(ctx, state) {
  drawAttract(ctx, state); scrim(ctx, 0.66);
  const r = drawFlowScreen(ctx, state, 'result', resultWidgets(state));
  const room = r.maxScroll <= 0 && LAID.top + r.lay.contentH < SAFE.y1 - 30;
  if (room) drawMoreLine(ctx, W / 2, SAFE.y1 - 14, 15);
}
export function renderDemoLimit(ctx, state) { drawAttract(ctx, state); scrim(ctx, 0.76); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(state)); }

function modal(ctx, state, key, widgets) {
  scrim(ctx, 0.62);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const mg = modalGeom();
  const lay = flowLayout(ctx, widgets, sc, { x: mg.x + 30, w: mg.w - 60, minH: minTap() });
  const top = mg.top, bottom = mg.bottom;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, mg.x, y0 - 20, mg.w, ch + 40, { r: 30, fill: 'rgba(34,20,12,0.97)', stroke: 'rgba(214,170,96,0.6)' });
  LAID = { key, lay, top: y0, bottom: y0 + ch, h: lay.contentH, sz: `${W}x${H}|${state.settings.textIdx}` };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, mg.x, mg.w);
}
export const renderPause = (ctx, state) => modal(ctx, state, 'pause', pauseWidgets(state));
export const renderReason = (ctx, state) => modal(ctx, state, 'reason', reasonWidgets(state));

// ---- reference pages ---------------------------------------------------------------------------------------------
export const READER = { max: 0, view: 0, y0: 0, y1: 0 };
export const refCloseRect = () => ({ x: REF_BACK.x, y: REF_BACK.y, w: REF_NEXT.x + REF_NEXT.w - REF_BACK.x, h: REF_BACK.h });

function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const viewH = Math.max(0, PANEL.h - 190);
  const blocks = [];
  let total = 0;
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const artH = sec.art ? Math.min(250, Math.max(130, Math.round(viewH * 0.4))) : 0;
    let h = titleH + artH + 26;
    lines.forEach((l, k) => { h += lh + (l.gapBefore && k > 0 ? lh * 0.45 : 0); });
    blocks.push({ title: sec.title, tl, titleH, art: sec.art, artH, lines });
    total += h;
  });
  return { blocks, fs, lh, secFs, total };
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  drawAttract(ctx, state); scrim(ctx, 0.76);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${PANEL.w}x${PANEL.h}`;
  let pg = pageCache.get(pkey);
  if (!pg) { pg = buildPages(ctx, list, sc); pageCache.set(pkey, pg); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,243,226,0.98)', stroke: 'rgba(120,78,30,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.delftDark; ctx.font = `italic 700 ${Math.round(44 * Math.min(sc, 1.15))}px ${SERIF}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(30,95,98,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  const cy0 = PANEL.y + 112, cy1 = PANEL.y + PANEL.h - 62;
  READER.max = Math.max(0, Math.ceil(pg.total - (cy1 - cy0 - 8))); READER.view = cy1 - cy0; READER.y0 = cy0; READER.y1 = cy1;
  state.ui.scroll = Math.max(0, Math.min(READER.max, state.ui.scroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 4, cy0, PANEL.w - 8, cy1 - cy0); ctx.clip();
  let y = PANEL.y + 120 - state.ui.scroll;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(30,95,98,0.22)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.terraDark; ctx.font = `700 ${pg.secFs}px ${SERIF}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, pcx, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { if (y < cy1 && y + blk.artH > cy0) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12, state); ctx.restore(); } y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.restore();
  if (READER.max > 0) {
    const th = Math.max(50, (cy1 - cy0) * ((cy1 - cy0) / pg.total)), ty = cy0 + (state.ui.scroll / READER.max) * (cy1 - cy0 - th);
    roundPath(ctx, PANEL.x + PANEL.w - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(30,95,98,0.45)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(20,60,62,0.7)';
    ctx.fillText(state.ui.scroll < READER.max - 4 ? '▼' : '▲', pcx, PANEL.y + PANEL.h - 28);
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f8edd0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(sc * 100)}%`, TEXT_DEC.x - 14, TEXT_DEC.y + TEXT_DEC.h / 2 + 8);
  drawButton(ctx, refCloseRect(), 'Close', { primary: true, size: LAND ? 28 : 32 });
}

// ---- illustrations: the real discs and wrestlers in a small frame -----------------------------------------------------------
function demoFall(p0, p1) {
  const pose = newPose(), disp = [{ ...p0 }, { ...p1 }];
  for (let i = 0; i < 40; i++) stepPose(pose, disp, 1 / 30, null, null, -1);
  return { pose, disp };
}
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const panelBg = () => { ctx.fillStyle = '#2a1a10'; ctx.fillRect(x, y, w, h); };
  if (key === 'disc') {
    panelBg();
    const r = Math.min(h * 0.4, w * 0.2), cy = y + h / 2;
    drawDisc(ctx, x + w * 0.27, cy, r, { p: { x: 0.15, y: 0.55 }, active: false, sel: 0, moves: [], color: SASH[0].sash, t: 0 });
    drawDisc(ctx, x + w * 0.73, cy, r, { p: { x: -0.4, y: -0.25 }, active: true, sel: 6, aim: 'send', pow: 2, moves: [], color: SASH[1].sash, t: 0, hint: null });
    ctx.fillStyle = '#fbe8c8'; ctx.font = `700 ${Math.max(13, Math.round(h * 0.075))}px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('Your balance', x + w * 0.27, y + h - 6); ctx.fillText('Their balance', x + w * 0.73, y + h - 6);
  } else if (key === 'moves') {
    panelBg();
    const r = Math.min(h * 0.36, w * 0.14), cy = y + h * 0.5;
    [['Pull', 'pull', 0], ['Hook', 'hook', 2], ['Root', 'brace', 5]].forEach(([label, kind, dir], i) => {
      const cx = x + w * (0.18 + 0.32 * i);
      drawDisc(ctx, cx, cy, r, { p: { x: 0.1, y: 0.2 }, active: false, moves: [{ kind, dir, pow: 2 }], color: SASH[i === 1 ? 1 : 0].sash, t: 0 });
      ctx.fillStyle = '#fbe8c8'; ctx.font = `700 ${Math.max(13, Math.round(h * 0.08))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(label, cx, y + h - 6);
    });
  } else if (key === 'grip') {
    panelBg();
    const bh = Math.max(18, Math.round(h * 0.18)), bx = x + 20, bw = w - 40;
    [['GRIP 4 of 5', 4 / 5, '#c8312f'], ['Light move: free', 1, '#8aa070'], ['Firm: 1 grip, Full: 2 grip, Hooks +1', 0.6, '#d9a43a']].forEach((b, i) => {
      const by = y + 16 + i * (bh + 12);
      roundPath(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
      roundPath(ctx, bx, by, Math.max(bh, bw * b[1]), bh, bh / 2); ctx.fillStyle = b[2]; ctx.fill();
      ctx.fillStyle = '#fff6e0'; ctx.font = `800 ${Math.round(bh * 0.6)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(b[0], bx + 12, by + bh / 2 + 1);
    });
  } else {
    const d = key === 'fall' ? demoFall({ x: 0.5, y: 0.7 }, { x: -0.3, y: -0.1 }) : demoFall({ x: 0, y: 0.2 }, { x: 0.1, y: -0.3 });
    drawStage(ctx, { x, y, w, h }, { ring: 'danoh', t: state.t, pose: d.pose, looks: [0, 1], builds: [1, 1], parts: [], pops: [], cheer: 0 });
  }
  ctx.restore();
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.strokeStyle = 'rgba(214,170,96,0.95)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}
