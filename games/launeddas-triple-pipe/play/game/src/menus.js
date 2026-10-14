// Every screen that is not the play screen: title, setup, settings, result, pause, the reason reader, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own pipe and lane art). Pure drawing; game.js owns state.
import { W, H, LAND, SAFE, PANEL, host, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, flowGeom, modalGeom, lockSize, minTap, playLayout, fieldLayout } from './layout.js';
import { drawCredit, drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, SERIF, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, FLOOR } from './ui.js';
import { PROFILES, createDriver } from './ai.js';
import { drawBackdrop, drawPipes, drawField, drawAirGauge, drawParts } from './view.js';
import { newTune, stepTune, STEP, PACES, accuracy, rating, FALL } from './sim.js';
import { TUNES } from './tunes.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { v3, active } from './v3.js';

const TAU = Math.PI * 2;

// ---- the performance behind the menus ---------------------------------------------------------------------------------------
// A computer piper plays the tunes in a loop behind the menus: real simulation, no input.
export function newAttract(rng) {
  const a = { rng, S: null, d: null, k: 0, wait: 0, parts: [] };
  restartAttract(a);
  return a;
}
function restartAttract(a) {
  a.k++;
  a.S = newTune(a.k % TUNES.length, 1);
  a.S.t = 1.5;
  a.d = createDriver(PROFILES[2], a.rng.fork());
  a.wait = 0;
}
export function stepAttract(a, dt) {
  const S = a.S;
  if (S.over) { a.wait += dt; if (a.wait > 1.8) restartAttract(a); return; }
  stepTune(S, dt, a.d.cmd(S));
}
function drawAttract(ctx, state, o = {}) {
  const a = state.att; if (!a) return;
  const lay = playLayout(1, false, false);
  const full = { x: 0, y: 0, w: W, h: H };
  drawBackdrop(ctx, full, state.t, { dim: 0.1 });
  const S = a.S;
  const lit = [0, 1, 2, 3, 4].map((l) => S.t - S.lastPress[l] < 0.14);
  if (o.sky) return;
  drawPipes(ctx, lay.pic, { t: state.t, air: S.air, squeeze: S.squeeze, drone: S.over ? 0 : 1, lit });
  ctx.save(); ctx.globalAlpha = 0.3;
  drawField(ctx, lay, { S, t: state.t, pressed: [S.squeeze, ...lit], hint: null, parts: null, pops: null });
  ctx.restore();
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


let HERO_T = 0;
// The title block: the name, then the three pipes (animated, speaking) under it. `w` x `h` is the box; the name takes the top 200 units.
function drawHero(ctx, cx, y0, scale = 1, w = 640, h = 560) {
  ctx.save(); ctx.translate(cx, y0); ctx.scale(scale, scale); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 26px ${SERIF}`; textShadow(ctx, 'THE SARDINIAN TRIPLE PIPE', 0, 34, '#ffd9a0', 8);
  ctx.font = `italic 800 112px ${SERIF}`;
  if (v3.on) {
    // embossed gold lettering: dark drop, outline, brass gradient, a lit upper half
    ctx.save(); ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.strokeStyle = '#2a1204'; ctx.lineWidth = 12; ctx.strokeText('Launeddas', 0, 140);
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#5a3208'; ctx.lineWidth = 6; ctx.strokeText('Launeddas', 0, 140);
    const gg = ctx.createLinearGradient(0, 56, 0, 150); gg.addColorStop(0, '#fff6d8'); gg.addColorStop(0.42, '#ffd86a'); gg.addColorStop(0.55, '#e0a030'); gg.addColorStop(1, '#a8661a');
    ctx.fillStyle = gg; ctx.fillText('Launeddas', 0, 140);
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 1.2; ctx.strokeText('Launeddas', 0, 138); ctx.restore();
  } else textShadow(ctx, 'Launeddas', 0, 140, '#fff2d6', 16);
  ctx.font = `500 28px ${FONT}`; textShadow(ctx, 'Play the notes. Keep the drone alive.', 0, 192, '#fff2d6', 7);
  drawPipes(ctx, { x: -w / 2, y: 206, w, h: Math.max(120, h - 206) }, { t: HERO_T, air: 0.75 + 0.2 * Math.sin(HERO_T * 0.7), squeeze: false, drone: 1, lit: [0, 1, 2, 3, 4].map((l) => Math.sin(HERO_T * 3.1 + l * 1.9) > 0.8) });
  ctx.restore();
}
const heroArt = (h = 560, hs = 1) => ({ t: 'art', h, draw(ctx, w) { drawHero(ctx, w / 2, 0, hs, w / hs, h / hs); } });

export function titleWidgets(state, split = false) {
  const sound = state.settings.sound;
  const tall = H >= 1180;
  const wd = split ? [{ t: 'gap', h: 18 }] : H < 1120 ? [heroArt(430, 0.8), { t: 'gap', h: 10 }] : [heroArt(tall ? 700 : 520), { t: 'gap', h: tall ? 30 : 16 }];
  wd.push({ t: 'btn', id: 'play', label: 'Play', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  wd.push({ t: 'gap', h: split ? 10 : 20 });
  return wd;
}

const stars = (n) => '★'.repeat(n) + '☆'.repeat(4 - n);
export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Choose a tune', size: 48 }];
  TUNES.forEach((tn, i) => {
    const locked = demo && i > 1, best = (rec.best ?? [])[i] | 0;
    wd.push({ t: 'btn', id: `tune${i}`, label: tn.name, sub: locked ? 'In the full game' : `${tn.form} · ${tn.bpm} bpm · ${stars(tn.stars)}${best ? ` · best ${best}` : ''}`, active: s.tune === i && !locked, dark: s.tune !== i, disabled: locked, hitDisabled: true, h: 92 });
  });
  wd.push({ t: 'p', label: TUNES[s.tune].blurb, size: 24, color: '#ffe9b8' });
  wd.push({ t: 'p', label: 'Pace', bold: true, color: '#ffd24a', size: 26 });
  PACES.forEach((pc, i) => wd.push({ t: 'btn', id: `pace${i}`, label: pc.name, sub: pc.blurb, active: s.pace === i, dark: s.pace !== i, h: 84 }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffd24a', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'set-cues', label: st.cues ? 'Coach rings: Show' : 'Coach rings: Hide', sub: 'The white ring on the next note and on the breath pad when Think or Watch & Learn explains' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffd24a', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffd24a' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const S = state.S, o = S.over, tn = TUNES[S.tune];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const dry = o.how === 'dry', watch = state.mode === 'watch';
  const wd = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: dry ? 'The drone fell silent' : 'Tune complete', size: 56, cap: big ? 1.2 : 1.5 }];
  wd.push({ t: 'p', label: `${tn.name} · ${PACES[S.pace].name}${watch ? ' · Watch & Learn' : ''}`, size: 26, color: '#ffe9b8', cap: big ? 2 : 3 });
  wd.push({ t: 'h', label: String(S.score), size: 76, cap: big ? 1.1 : 1.3, color: '#ffd24a' });
  wd.push({ t: 'p', label: `${rating(S)} · ${Math.round(accuracy(S) * 100)}% accuracy`, bold: true, size: 30, color: '#b9f0d8', cap: big ? 2 : 3 });
  const pr = Math.round(((S.t - 3.2) / Math.max(1, S.end - 3.2)) * 100);
  wd.push({ t: 'p', label: dry ? `You reached ${Math.max(0, Math.min(99, pr))}% of the tune before the air ran out.` : 'You played every phrase to the end.', size: 25, cap: big ? 2 : 3 });
  wd.push({ t: 'p', label: `Perfect ${S.grades[0]} · Good ${S.grades[1]} · Late ${S.grades[2]} · Missed ${S.missed}`, size: 25, cap: big ? 2 : 3 });
  wd.push({ t: 'p', label: `Longest run ${S.maxCombo} · Breaths ${S.breaths} · Taps lost to breathing ${S.ignored}`, size: 25, cap: big ? 2 : 3 });
  if (state.newBest && !watch) wd.push({ t: 'p', label: 'A new best for this tune!', bold: true, color: '#ffd24a', size: 28 });
  wd.push({ t: 'gap', h: 20 });
  wd.push({ t: 'btn', id: 'again', label: watch ? 'Watch again' : 'Play again', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: watch ? 'Play a tune' : 'Choose a tune', row: 6 });
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
    { t: 'btn', id: 'p-cues', label: st.cues ? 'Rings: Show' : 'Rings: Hide', row: 8 },
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
    { t: 'gap', h: big ? 30 : 160 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free tunes of the web demo. The full game on iPhone and Android has all four tunes, both paces and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  if (v3.on && !v3.modal && !v3.force2d) a *= 0.62;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(16,8,12,${a * 0.75})`); g.addColorStop(0.5, `rgba(16,8,12,${a})`); g.addColorStop(1, `rgba(16,8,12,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(16,8,12,0)'); g.addColorStop(1, 'rgba(16,8,12,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(250,240,218,0.94)'; ctx.fill();
    ctx.fillStyle = '#2a1608'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(250,240,218,0.94)'; ctx.fill();
    ctx.fillStyle = '#2a1608'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
    roundPath(ctx, SAFE.x1 - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(250,240,218,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, f.c.x, f.c.w);
  }
  return { scroll, maxScroll, lay };
}
const drawFlowScreen = (ctx, state, key, widgets) => drawPrepared(ctx, state, prepFlow(ctx, state, key, widgets));

function brandFooter(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(16,8,12,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  if (!drawLockupImage(ctx, k.cx, k.y + k.h + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1)) drawCredit(ctx, k.cx, k.y + k.h - 6, 13);
}

export function renderTitle(ctx, state) {
  HERO_T = state.t;
  const g = flowGeom('title'), split = g.split;
  const f = prepFlow(ctx, state, 'title', titleWidgets(state, split));
  drawAttract(ctx, state, { sky: true });
  if (split) {
    scrim(ctx, 0.5);
    const hx = (SAFE.x0 + f.c.x - 12) / 2;
    const rg = ctx.createRadialGradient(hx, H * 0.3, 40, hx, H * 0.3, 420);
    rg.addColorStop(0, 'rgba(16,8,12,0.7)'); rg.addColorStop(1, 'rgba(16,8,12,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, f.c.x, H);
    const hs = Math.min(1, (f.c.x - SAFE.x0 - 24) / 640, (H - SAFE.y0 - 60) / 560);
    drawHero(ctx, hx, Math.max(SAFE.y0 + 24, (H - 560 * hs) / 2), hs, 640, 560);
  } else {
    scrim(ctx, 0.5);
    const rg = ctx.createRadialGradient(W / 2, 170 + f.off, 40, W / 2, 170 + f.off, 420);
    rg.addColorStop(0, 'rgba(16,8,12,0.7)'); rg.addColorStop(1, 'rgba(16,8,12,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, 700 + f.off);
  }
  drawPrepared(ctx, state, f);
  brandFooter(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,215,0.6)';
  if (state.demo) ctx.fillText('Web demo', split ? (SAFE.x0 + f.c.x - 12) / 2 : W / 2, SAFE.y1 - 10);
}
export function renderSetup(ctx, state) {
  drawAttract(ctx, state, { sky: true }); scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state));
  const y0 = SETUP_PINS.start.y - 56;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(16,8,12,0)'); g.addColorStop(0.2, 'rgba(16,8,12,0.88)'); g.addColorStop(1, 'rgba(16,8,12,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  drawButton(ctx, SETUP_PINS.start, 'Start the tune', { primary: true, size: LAND ? 28 : 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: LAND ? 26 : 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, SETUP_PINS.start.y - 16); }
}
export function renderSettings(ctx, state) { drawAttract(ctx, state, { sky: true }); scrim(ctx, 0.74); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state)); }
export function renderResult(ctx, state) {
  drawAttract(ctx, state, { sky: true }); scrim(ctx, 0.8);
  const r = drawFlowScreen(ctx, state, 'result', resultWidgets(state));
  const room = r.maxScroll <= 0 && LAID.top + r.lay.contentH < SAFE.y1 - 30;
  if (room) drawMoreLine(ctx, W / 2, SAFE.y1 - 14, 15);
}
export function renderDemoLimit(ctx, state) { drawAttract(ctx, state, { sky: true }); scrim(ctx, 0.76); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(state)); }

function modal(ctx, state, key, widgets) {
  scrim(ctx, 0.62);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const mg = modalGeom();
  const lay = flowLayout(ctx, widgets, sc, { x: mg.x + 30, w: mg.w - 60, minH: minTap() });
  const top = mg.top, bottom = mg.bottom;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, mg.x, y0 - 20, mg.w, ch + 40, { r: 30, fill: 'rgba(26,13,10,0.97)', stroke: 'rgba(255,205,130,0.6)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,240,218,0.98)', stroke: 'rgba(120,60,20,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.delftDark; ctx.font = `italic 700 ${Math.round(44 * Math.min(sc, 1.15))}px ${SERIF}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(120,60,20,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  const cy0 = PANEL.y + 112, cy1 = PANEL.y + PANEL.h - 62;
  READER.max = Math.max(0, Math.ceil(pg.total - (cy1 - cy0 - 8))); READER.view = cy1 - cy0; READER.y0 = cy0; READER.y1 = cy1;
  state.ui.scroll = Math.max(0, Math.min(READER.max, state.ui.scroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 4, cy0, PANEL.w - 8, cy1 - cy0); ctx.clip();
  let y = PANEL.y + 120 - state.ui.scroll;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(120,60,20,0.22)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
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
    roundPath(ctx, PANEL.x + PANEL.w - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(120,60,20,0.45)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(90,42,20,0.75)';
    ctx.fillText(state.ui.scroll < READER.max - 4 ? '▼' : '▲', pcx, PANEL.y + PANEL.h - 28);
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f8edd0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(sc * 100)}%`, TEXT_DEC.x - 14, TEXT_DEC.y + TEXT_DEC.h / 2 + 8);
  drawButton(ctx, refCloseRect(), 'Close', { primary: true, size: LAND ? 28 : 32 });
}

// ---- illustrations: the real pipe and lane art in a small frame -----------------------------------------------------------
function fakeTune(air, notes, squeeze = false) {
  return { t: 0, air, squeeze, cur: 0, notes: notes.map(([at, lane]) => ({ at, lane, st: 0, g: 0 })), lastPress: [-9, -9, -9, -9, -9], over: null };
}
export function drawArt(key, ctx, x, y, w, h, state) {
  const was = v3.force2d; v3.force2d = true;
  try { drawArtInner(key, ctx, x, y, w, h, state); } finally { v3.force2d = was; }
}
function drawArtInner(key, ctx, x, y, w, h, state) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const box = { x, y, w, h };
  drawBackdrop(ctx, box, state.t, { dim: 0.15 });
  if (key === 'pipes') {
    drawPipes(ctx, box, { t: state.t, air: 0.8, squeeze: false, drone: 1, lit: [false, true, false, true, false] });
  } else if (key === 'lanes') {
    const lab = Math.max(FLOOR, 14), f = { x: x + 6, y: y + 4, w: w - 12, h: h - 8 };
    const lay = Object.assign({ lab, fs: 20 }, fieldLayout(f, true, lab));
    const S = fakeTune(0.7, [[0.25, 2], [0.6, 3], [0.9, 0], [1.2, 4], [1.5, 1], [1.62, 2]]);
    drawField(ctx, lay, { S, t: state.t, pressed: [], hint: null, parts: null, pops: null });
  } else {
    // breath: the gauge and the reservoir side by side, a squeeze in progress
    const gx = x + w * 0.1, gw = Math.min(70, w * 0.2);
    drawAirGauge(ctx, { x: gx, y: y + 10, w: gw, h: h - 20 }, 0.3 + 0.25 * Math.sin(state.t * 0.9), state.t, true, Math.max(FLOOR, 13));
    drawPipes(ctx, { x: gx + gw + 10, y, w: w - gw - gx + x - 20, h }, { t: state.t, air: 0.3 + 0.25 * Math.sin(state.t * 0.9), squeeze: true, drone: 1, lit: [false, false, false, false, false] });
  }
  ctx.restore();
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.strokeStyle = 'rgba(255,205,130,0.8)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}
