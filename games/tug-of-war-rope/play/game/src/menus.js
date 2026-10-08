// Every screen that is not the play screen: title, setup, settings, result, pause and the scrolling About / How to Play / Rules reader with its diagrams.
// Pure drawing; game.js owns state. All text follows the 100-300% size.
import { W, H, SW, OX, LAND, MENU, PANEL, host, minU, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_CLOSE, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { SETTINGS, KITS, teamById, settingById } from './teams.js';
import { LEVELS, LIMIT } from './sim.js';
import { ROUND_NAMES } from './match.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: 1280 };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  const sk = `${key}|${W}x${H}|${state.settings.textIdx}|${state.setup.kind}`;
  if (LAID.sk === sk && LAID.lay) return;
  const T = MENU.top, B = MENU.bottom, PB = MENU.pinBottom;
  const defs = { title: [titleWidgets, T, B], setup: [setupWidgets, T, PB], settings: [settingsWidgets, T, B], result: [resultWidgets, T, B], demolimit: [demoLimitWidgets, T, B] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, sk, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const GOLD = '#f2c14e', CREAM = '#fbf3e2', SKY = '#8fd3e6';
function drawHero(ctx, w, flat) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cx = w / 2, k = Math.min(1, (w - 20) / 640);
  ctx.fillStyle = flat ? 'rgba(30,14,6,0.5)' : 'rgba(30,14,6,0.62)'; roundPath(ctx, 2, 40, w - 4, 288, 30); ctx.fill();
  let px = Math.round(32 * k);
  ctx.font = `700 ${px}px ${FONT}`;
  const kick = 'A VILLAGE ROPE CONTEST';
  while (ctx.measureText(kick).width > w - 16 && px > 12) { px--; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillStyle = GOLD; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText(kick, cx, 96);
  let hp = Math.round(118 * Math.min(1, k * 1.1));
  ctx.font = `700 ${hp}px ${DISPLAY}`;
  while (ctx.measureText('Tug of War').width > w - 28 && hp > 24) { hp -= 2; ctx.font = `700 ${hp}px ${DISPLAY}`; }
  ctx.fillStyle = CREAM; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Tug of War', cx, 214);
  // a rope with a flag under the title
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const ry = 262, rx0 = w * 0.14, rx1 = w * 0.86;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(rx1, ry); ctx.stroke();
  ctx.strokeStyle = '#e0c28a'; ctx.lineWidth = 7; ctx.setLineDash([9, 7]); ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(rx1, ry); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.moveTo(cx - 12, ry + 4); ctx.lineTo(cx + 12, ry + 4); ctx.lineTo(cx + 12, ry + 38); ctx.lineTo(cx, ry + 30); ctx.lineTo(cx - 12, ry + 38); ctx.closePath(); ctx.fill();
  ctx.restore();
}
const heroArt = () => { const k = H < 1200 ? 0.75 : 1; return { t: 'art', h: Math.round(380 * k), draw(ctx, w) { ctx.save(); ctx.scale(k, k); drawHero(ctx, w / k); ctx.restore(); } }; };
const LOCK_W = 300;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
const brandArt = () => ({ t: 'art', h: 120, brand: true, draw(ctx, w) {
  const lw = Math.min(w - 40, LOCK_W), lh = Math.round(lw * 327 / 1200);
  ctx.save(); ctx.fillStyle = lockDownFlag ? 'rgba(242,193,78,0.5)' : 'rgba(30,14,6,0.55)'; roundPath(ctx, w / 2 - lw / 2 - 12, 60 - lh / 2 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockupImage(ctx, w / 2, 60, lw, 1);
} });
let lockDownFlag = false;
export const setLockDown = (v) => { lockDownFlag = v; };

export function titleWidgets(state) {
  const rec = state.record;
  return [
    ...(LAND ? [{ t: 'gap', h: 24 }] : [heroArt()]),
    { t: 'btn', id: 'bracket', label: 'Play the Bracket', sub: rec.titles ? `Three matches, three grounds  ·  ${rec.titles} title${rec.titles > 1 ? 's' : ''}` : 'Three matches on three grounds', primary: true, h: !LAND && H < 1200 ? 80 : 92 },
    { t: 'btn', id: 'quick', label: 'Quick Match', sub: 'Any ground, any rival', row: 1 },
    { t: 'btn', id: 'daily', label: 'Daily Pull', sub: "Today's rival and ground", row: 1 },
    { t: 'btn', id: 'versus', label: 'Two Players', sub: 'Split screen on one device' },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'A computer teammate explains the rhythm' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
    ...(LAND ? [{ t: 'gap', h: 8 }] : [brandArt()]),
  ];
}

const kitRows = (state, pre = 'kit') => {
  const out = [{ t: 'p', label: 'Your team colour', bold: true, color: '#ffd98a', size: 26 }];
  KITS.forEach((k, i) => out.push({ t: 'btn', id: `${pre}-${k.id}`, label: k.name, swatch: k.top, active: state.setup.kit === k.id, row: 20 + Math.floor(i / 3), h: 70 }));
  return out;
};
export function setupWidgets(state) {
  const s = state.setup, kind = s.kind;
  const title = { bracket: 'The Bracket', quick: 'Quick Match', versus: 'Two Players', watch: 'Watch & Learn' }[kind];
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 48 }];
  if (kind === 'bracket') {
    wd.push({ t: 'p', label: 'Win a quarter-final, a semi-final and the final, each first to two pulls, each on a different ground. Pick how hard the first rivals are; they get one level tougher every round.', size: 24 });
    wd.push({ t: 'p', label: 'Starting difficulty', bold: true, color: '#ffd98a', size: 26 });
    LEVELS.slice(0, 4).forEach((l) => wd.push({ t: 'btn', id: `lv${l.id}`, label: l.name, sub: l.blurb, active: s.level === l.id, h: 92 }));
    wd.push(...kitRows(state));
  } else if (kind === 'quick') {
    wd.push({ t: 'p', label: 'Choose the ground', bold: true, color: '#ffd98a', size: 26 });
    SETTINGS.forEach((g) => wd.push({ t: 'btn', id: `set-${g.id}`, label: g.name, sub: g.blurb, active: s.setting === g.id, h: 92 }));
    wd.push({ t: 'p', label: 'Rival strength', bold: true, color: '#ffd98a', size: 26 });
    LEVELS.forEach((l) => wd.push({ t: 'btn', id: `lvq${l.id}`, label: l.name, sub: l.blurb, active: s.qlevel === l.id, h: 92 }));
    wd.push(...kitRows(state));
  } else if (kind === 'versus') {
    wd.push({ t: 'p', label: 'One screen, two teams. Each player gets their own half with their own beat ring, stamina and calls. In portrait the second half faces the other way so you can sit face to face.', size: 24 });
    wd.push({ t: 'p', label: 'Choose the ground', bold: true, color: '#ffd98a', size: 26 });
    SETTINGS.forEach((g) => wd.push({ t: 'btn', id: `set-${g.id}`, label: g.name, sub: g.blurb, active: s.setting === g.id, h: 92 }));
    wd.push(...kitRows(state));
  } else {
    wd.push({ t: 'p', label: 'A computer teammate pulls for your side against a Local team and stops at the key moments to explain the rhythm, the brace, the anchor and the coach.', size: 24 });
    wd.push({ t: 'p', label: 'Choose the ground', bold: true, color: '#ffd98a', size: 26 });
    SETTINGS.forEach((g) => wd.push({ t: 'btn', id: `set-${g.id}`, label: g.name, sub: g.blurb, active: s.setting === g.id, h: 92 }));
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-chant', label: st.chant ? 'Chant beat sound: On' : 'Chant beat sound: Off', sub: 'A soft drum on every beat' },
    { t: 'btn', id: 'set-buzz', label: st.buzz === false ? 'Vibration: Off' : 'Vibration: On', sub: 'A short buzz on each heave (where the device allows)' },
    { t: 'btn', id: 'set-face', label: st.face ? 'Two players: face to face' : 'Two players: same way up', sub: 'Portrait: turn the second half round' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffd98a', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A\u2212  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffd98a', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffd98a' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const M = state.match, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big || LAND ? 24 : 70 }];
  if (!M) return [...wd, { t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const st = M.stats, versus = M.kind === 'versus';
  const rd = M.rounds[M.round];
  let head, sub;
  if (M.kind === 'bracket') { head = M.champion ? 'BRACKET CHAMPIONS' : `Out in the ${ROUND_NAMES[M.round].toLowerCase()}`; sub = M.champion ? 'Three matches, three grounds, one flag.' : `Beaten ${M.wins[1]} to ${M.wins[0]} by ${teamById(rd.rival).name}`; }
  else if (versus) { head = M.wins[0] > M.wins[1] ? 'TEAM A WINS' : 'TEAM B WINS'; sub = `${Math.max(...M.wins)} pulls to ${Math.min(...M.wins)}`; }
  else if (M.kind === 'daily') { head = M.wins[0] ? 'DAILY PULL WON' : 'DAILY PULL LOST'; sub = `Score ${state.dailyScore || 0}`; }
  else if (M.kind === 'watch') { head = M.wins[0] ? 'Pulled and won' : 'Pulled and lost'; sub = 'Now try it with your own finger.'; }
  else { head = M.champion ? 'MATCH WON' : 'MATCH LOST'; sub = `${M.wins[0]} pulls to ${M.wins[1]} against ${teamById(rd.rival).name}`; }
  wd.push({ t: 'h', label: head, size: 50, color: M.champion || (versus) ? GOLD : CREAM, cap: 1.3 });
  wd.push({ t: 'p', label: sub, size: 26, cap: big ? 2 : 3 });
  if (!versus) {
    const pct = st.heaves ? Math.round((100 * st.perfect) / st.heaves) : 0;
    wd.push({ t: 'p', label: `Perfect heaves ${pct}%  ·  best streak ${st.bestStreak}  ·  surges blocked ${st.blocked}`, size: 24, cap: big ? 2 : 2.5 });
    if (st.bestMargin) wd.push({ t: 'p', label: `Best flag lead ${st.bestMargin.toFixed(2)} m  ·  pulls played ${st.pulls}`, size: 24, cap: big ? 2 : 2.5 });
  }
  wd.push({ t: 'gap', h: 18 });
  wd.push({ t: 'btn', id: 'again', label: M.kind === 'bracket' ? 'New bracket' : 'Play again', primary: true, h: 88 });
  wd.push({ t: 'btn', id: 'new', label: 'Change setup', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'art', h: 56, draw: (ctx, w) => drawMoreLine(ctx, w / 2, 24, 19) });
  wd.push({ t: 'gap', h: 20 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffd98a', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A\u2212  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have used the free pulls of the web demo. The full game on iPhone and Android has the whole bracket, all six grounds, the Daily Pull, two-player split screen and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(24,12,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(24,12,6,${a})`); g.addColorStop(1, `rgba(24,12,6,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(24,12,6,0)'); g.addColorStop(1, 'rgba(24,12,6,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(251,243,226,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(251,243,226,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, sk: `${key}|${W}x${H}|${state.settings.textIdx}`, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 14, top, 8, bottom - top, 4); ctx.fillStyle = 'rgba(251,243,226,0.14)'; ctx.fill();
    roundPath(ctx, W - 14, ty, 8, th, 4); ctx.fillStyle = 'rgba(251,243,226,0.72)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, a); };


export function renderTitle(ctx, state) {
  ctx.clearRect(-OX, 0, SW, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); if (LAND) { g.addColorStop(0, 'rgba(24,12,6,0.0)'); g.addColorStop(0.6, 'rgba(24,12,6,0.12)'); g.addColorStop(1, 'rgba(24,12,6,0.45)'); } else { g.addColorStop(0, 'rgba(24,12,6,0.0)'); g.addColorStop(0.45, 'rgba(24,12,6,0.16)'); g.addColorStop(0.7, 'rgba(24,12,6,0.05)'); g.addColorStop(1, 'rgba(24,12,6,0.0)'); }
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
  if (LAND) {
    // landscape: a compact heading at the top left, the athlete below it in the open grass, the menu on the right
    const lw = OX - host.l - 24, k = Math.min(0.62, Math.max(0.4, (H - host.t) / 640));
    ctx.save(); ctx.translate(host.l - OX + 14, host.t + 2); ctx.scale(k, k); drawHero(ctx, lw / k, true); ctx.restore();
  }
  const fr = drawFlowScreen(ctx, state, 'title', titleWidgets(state), MENU.top, MENU.bottom);
  titleLockTap = null;
  if (LAND) {
    // landscape: the themed lockup sits quietly bottom left under the heading, always in view (never inside the scrolling menu)
    const aw = OX - host.l - 24, lw = Math.max(120, Math.min(aw - 28, LOCK_W)), lh = Math.round(lw * 327 / 1200);
    const cx = host.l - OX + 14 + aw / 2, cy = H - host.b - 16 - lh / 2 - 6;
    ctx.save(); ctx.fillStyle = lockDownFlag ? 'rgba(242,193,78,0.5)' : 'rgba(30,14,6,0.55)'; roundPath(ctx, cx - lw / 2 - 12, cy - lh / 2 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
    drawLockupImage(ctx, cx, cy, lw, 1);
    const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
    titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
  } else {
    const it = LAID.lay.items.find((i) => i.w.brand);
    if (it) {
      const lw = Math.min(it.wd - 40, LOCK_W), lh = Math.round(lw * 327 / 1200), cy = LAID.top + it.y - fr.scroll + 60, cx = it.x + it.wd / 2;
      const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
      if (cy - th / 2 >= MENU.top && cy + th / 2 <= MENU.bottom) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
    }
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 20px ${FONT}`; ctx.fillStyle = 'rgba(238,243,247,0.6)'; ctx.fillText('Web demo', LAND ? (host.l - OX) / 2 : W / 2, H - 14 - host.b - (LAND ? 64 : 0)); }
}
function pinned(ctx, state, key, widgets, label, back) {
  bg(ctx, 0.78);
  const pb = MENU.pinBottom;
  drawFlowScreen(ctx, state, key, widgets, MENU.top, pb);
  const g = ctx.createLinearGradient(0, pb - 30, 0, H);
  g.addColorStop(0, 'rgba(24,12,6,0)'); g.addColorStop(0.2, 'rgba(24,12,6,0.88)'); g.addColorStop(1, 'rgba(24,12,6,0.95)');
  ctx.fillStyle = g; ctx.fillRect(-OX, pb - 30, SW, H - pb + 30);
  drawButton(ctx, SETUP_PINS.start, label, { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, back, { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pb + 14); }
}
export const renderSetup = (ctx, state) => pinned(ctx, state, 'setup', setupWidgets(state), state.setup.kind === 'watch' ? 'Start Watch & Learn' : 'Start', 'Back');
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), MENU.top, MENU.bottom); };
export const renderResult = (ctx, state) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), MENU.top, MENU.bottom); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), MENU.top, MENU.bottom); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 40), px0 = (W - pw) / 2;
  const lay = flowLayout(ctx, wd, sc, { x: px0 + 30, w: pw - 60 });
  const top = LAND ? MENU.top + 34 : 70 + MENU.top, bottom = LAND ? MENU.bottom - 34 : H - 70 - host.b;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px0, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(40,22,12,0.96)', stroke: 'rgba(251,243,226,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  if (maxScroll > 0) {
    const th = Math.max(50, ch * (ch / lay.contentH)), ty = y0 + (sc0 / maxScroll) * (ch - th);
    roundPath(ctx, px0 + pw - 20, y0, 8, ch, 4); ctx.fillStyle = 'rgba(251,243,226,0.14)'; ctx.fill();
    roundPath(ctx, px0 + pw - 20, ty, 8, th, 4); ctx.fillStyle = 'rgba(251,243,226,0.72)'; ctx.fill();
  }
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px0, pw);
}

// ---- reference pages (Rules, How to Play, About): ONE continuous document that scrolls --------------------------------------
// Drag / swipe, mouse wheel, arrows, PageUp / PageDown, Space, Home / End all scroll it; a visible scroll bar shows where you are. The text size
// (100-300%) only changes how long the document is, never what is on screen being cut off.
export const READER = { h: 0, view: 0, max: 0 };
const hdrH = () => (LAND ? 64 : 84);
const viewT = () => PANEL.y + hdrH(), viewB = () => PANEL.y + PANEL.h - 14;
export const pageViewH = () => viewB() - viewT();

function buildDoc(ctx, list, scale) {
  const fs = Math.round(26 * scale), lh = fs * 1.2, tw = PANEL.w - 64;
  const secFs = Math.round(32 * Math.min(scale, 1.5));
  const items = []; let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y + 6 }); y += 22; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    tl.forEach((l) => { items.push({ k: 'title', y, text: l, fs: secFs }); y += secFs * 1.18; });
    y += 8;
    if (sec.art) { items.push({ k: 'art', y, art: sec.art, h: 210 }); y += 222; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l, fs }); y += lh; });
    });
    y += 10;
  });
  return { items, h: y + 12, fs };
}
const docCache = new Map();
export function docFor(ctx, list, header, scale) {
  const key = `${header}:${scale}:${list.length}:${PANEL.w}`;
  let d = docCache.get(key);
  if (!d) { d = buildDoc(ctx, list, scale); docCache.set(key, d); }
  return d;
}
export function readerMax(state, ctx, list, header) { return Math.max(0, docFor(ctx, list, header, TEXT_SCALES[state.settings.textIdx]).h - pageViewH()); }
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const VIEW_T = viewT(), VIEW_B = viewB(), HD = hdrH();
  const doc = docFor(ctx, list, header, sc);
  const viewH = pageViewH(), max = Math.max(0, doc.h - viewH);
  READER.h = doc.h; READER.view = viewH; READER.max = max;
  const scroll = Math.max(0, Math.min(state.ui.scroll, max));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(251,243,226,0.97)', stroke: 'rgba(60,34,16,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `700 ${Math.round((LAND ? 36 : 42) * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, PANEL.x + PANEL.w / 2, PANEL.y + HD * 0.6);
  ctx.strokeStyle = 'rgba(60,34,16,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 40, PANEL.y + HD - 18); ctx.lineTo(PANEL.x + PANEL.w - 40, PANEL.y + HD - 18); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL.x + 6, VIEW_T, PANEL.w - 12, viewH); ctx.clip();
  const top = VIEW_T - scroll;
  for (const it of doc.items) {
    const y = top + it.y;
    if (y > VIEW_B + 40 || y + (it.h || it.fs * 1.4 || 20) < VIEW_T - 40) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(60,34,16,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + PANEL.w / 2 - 8, y + it.fs * 0.9); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 52, it.h); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 30, y, PANEL.w - 72, it.h - 12); ctx.restore(); }
    else { ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + 22, y + it.fs * 0.85); }
  }
  ctx.restore();
  if (max > 0) {
    // scroll bar: track + thumb on the panel's right edge, and "more" / "up" cues
    const tx = PANEL.x + PANEL.w - 16;
    roundPath(ctx, tx, VIEW_T, 8, viewH, 4); ctx.fillStyle = 'rgba(60,34,16,0.16)'; ctx.fill();
    const th = Math.max(56, viewH * (viewH / doc.h)), ty = VIEW_T + (scroll / max) * (viewH - th);
    roundPath(ctx, tx, ty, 8, th, 4); ctx.fillStyle = 'rgba(60,34,16,0.62)'; ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, VIEW_B - 70, 0, VIEW_B); g.addColorStop(0, 'rgba(251,243,226,0)'); g.addColorStop(1, 'rgba(251,243,226,0.97)');
      ctx.fillStyle = g; ctx.fillRect(PANEL.x + 6, VIEW_B - 70, PANEL.w - 40, 70);
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 52, VIEW_B - 42, 104, 32, 16); ctx.fillStyle = 'rgba(60,34,16,0.82)'; ctx.fill();
      ctx.fillStyle = '#fbf3e2'; ctx.font = `700 21px ${FONT}`; ctx.fillText('▼ scroll', PANEL.x + PANEL.w / 2, VIEW_B - 25);
    } else if (scroll > 4) {
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 40, VIEW_T + 6, 80, 30, 15); ctx.fillStyle = 'rgba(60,34,16,0.82)'; ctx.fill();
      ctx.fillStyle = '#fbf3e2'; ctx.font = `700 21px ${FONT}`; ctx.fillText('▲ up', PANEL.x + PANEL.w / 2, VIEW_T + 21);
    }
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fbf3e2'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, (TEXT_DEC.x + TEXT_DEC.w + TEXT_INC.x) / 2, TEXT_DEC.y + TEXT_DEC.h / 2); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, REF_CLOSE, 'Close', { primary: true, size: 32 });
}


// ---- diagrams -------------------------------------------------------------------------------------
function arrow(ctx, x0, y0, x1, y1, col = '#f2c14e', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function label(ctx, t, x, y, size = 18, col = '#fbf3e2', align = 'center') {
  size = Math.max(size, minU());
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.fillText(t, x, y); ctx.restore();
}
// the same ring / bar / button look as the play screen
function ringDemo(ctx, cx, cy, r, f, hot, text) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = hot ? 'rgba(242,193,78,0.28)' : 'rgba(30,16,8,0.6)'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = hot ? '#f2c14e' : 'rgba(251,243,226,0.85)'; ctx.stroke();
  if (f > 0) { ctx.beginPath(); ctx.arc(cx, cy, r * (1 + 1.1 * f), 0, TAU); ctx.lineWidth = 7 - 3 * f; ctx.strokeStyle = hot ? '#f2c14e' : '#8fd3e6'; ctx.globalAlpha = 0.35 + 0.65 * (1 - f); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#fbf3e2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(r * 0.34)}px ${FONT}`; ctx.fillText(text, cx, cy + 1); ctx.textBaseline = 'alphabetic';
}
function meter(ctx, x, y, w, h, frac, c1, c2, name) {
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(30,16,8,0.8)'; ctx.fill();
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
  roundPath(ctx, x, y, Math.max(h, w * frac), h, h / 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(251,243,226,0.35)'; roundPath(ctx, x, y, w, h, h / 2); ctx.stroke();
  ctx.fillStyle = '#2a1a10'; ctx.font = `700 ${Math.max(minU(), Math.round(h * 0.7))}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(name, x + h * 0.5, y + h / 2 + 1); ctx.textBaseline = 'alphabetic';
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(40,22,12,0.95)'; ctx.fill();
  const cx = x + w / 2, cy = y + h / 2;
  const A = {
    ring() {
      const r = Math.min(h * 0.24, 54), c1 = x + w * 0.27, c2 = x + w * 0.73;
      ringDemo(ctx, c1, cy - 6, r, 0.9, false, 'TAP'); label(ctx, 'ring closing', c1, y + h - 12, 17);
      ringDemo(ctx, c2, cy - 6, r, 0.02, true, 'TAP'); label(ctx, 'tap NOW: perfect', c2, y + h - 12, 17, '#f2c14e');
    },
    bar() {
      const bx = x + 28, bw = w - 56, by = cy - 14, bh = 28;
      roundPath(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(30,16,8,0.9)'; ctx.fill();
      ctx.save(); roundPath(ctx, bx, by, bw, bh, bh / 2); ctx.clip(); ctx.fillStyle = '#c8352b'; ctx.fillRect(bx, by, bw * 0.16, bh); ctx.fillStyle = '#b5651d'; ctx.fillRect(bx + bw * 0.84, by, bw * 0.16, bh); ctx.restore();
      ctx.strokeStyle = 'rgba(251,243,226,0.45)'; ctx.lineWidth = 2; roundPath(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
      const fx = bx + bw * 0.38; ctx.fillStyle = '#d62828'; ctx.beginPath(); ctx.moveTo(fx, by - 22); ctx.lineTo(fx + 22, by - 12); ctx.lineTo(fx, by - 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, by - 22); ctx.lineTo(fx, by + bh * 0.6); ctx.stroke();
      arrow(ctx, fx - 10, by + bh + 30, fx - 90, by + bh + 30, '#f2c14e', 4);
      label(ctx, 'YOUR LINE', bx + bw * 0.08, by + bh + 22, 15); label(ctx, 'THEIR LINE', bx + bw * 0.92, by + bh + 22, 15);
      label(ctx, 'the flag moves toward the team that is winning', cx, y + h - 12, 16, '#f2c14e');
    },
    surge() {
      const px = x + w * 0.26, pr = Math.min(h * 0.2, 44);
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,90,70,0.85)'; ctx.beginPath(); ctx.arc(px, cy - 8, pr * 1.9, 0, TAU); ctx.stroke();
      label(ctx, 'RIVAL SURGE', px, cy - 2, 18, '#ff7a66'); label(ctx, 'warning ring', px, y + h - 12, 16);
      ringDemo(ctx, x + w * 0.72, cy - 8, pr * 1.2, 0, false, 'HOLD'); label(ctx, 'tap, then hold your finger', x + w * 0.72, y + h - 12, 16, '#f2c14e');
    },
    calls() {
      const bw = Math.min(150, w * 0.36), bh = 74, ax = x + w * 0.1, ay = cy - bh / 2 - 6;
      const btn = (bx, name, sub, col) => { roundPath(ctx, bx, ay, bw, bh, 16); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(251,243,226,0.4)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff8ea'; ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillText(name, bx + bw / 2, ay + 33); ctx.font = `400 ${minU() + 2}px ${FONT}`; ctx.fillText(sub, bx + bw / 2, ay + 58); };
      btn(ax, 'ANCHOR', '2 left', 'rgba(60,34,16,0.95)'); btn(x + w - w * 0.1 - bw, 'COACH', 'ready', '#d1561b');
      label(ctx, 'rivals halved', ax + bw / 2, y + h - 12, 16); label(ctx, 'wider windows', x + w - w * 0.1 - bw / 2, y + h - 12, 16, '#f2c14e');
    },
    stamina() {
      meter(ctx, x + 30, cy - 36, w - 60, 26, 0.82, '#58c28f', '#d6d86a', 'STAMINA'); meter(ctx, x + 30, cy + 4, w - 60, 26, 0.24, '#ff8f7a', '#c7452d', 'STAMINA: TIRED');
      label(ctx, 'heaves cost stamina; bracing gives it back', cx, y + h - 12, 16, '#f2c14e');
    },
    levels() { const n = LEVELS.length, cw = (w - 40) / n; LEVELS.forEach((l, i) => { const bx = x + 20 + i * cw; label(ctx, l.name, bx + cw / 2, cy - 8, Math.min(18, cw * 0.17)); label(ctx, `${l.T.toFixed(2)} s`, bx + cw / 2, cy + 20, 17, '#f2c14e'); }); label(ctx, 'chant tempo per level', cx, y + h - 12, 16); },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffd98a'], ['REVEAL', '#7fd6c2'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const bx = x + 10 + i * (cw + 10); roundPath(ctx, bx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, bx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.ring)();
  ctx.restore();
}
