// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi() with the same state,
// so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { getHowto, getRules, getAbout, tr, lvName, lvBlurb, lenName, lenBlurb, themeName, seatColor } from './content.js';
import { LEVELS, LENGTHS, MIN_PLAYERS, MAX_PLAYERS } from './rules.js';
import { THEMES } from './art.js';
import { SCREEN, docFrame, titleFrame, overlayArea } from './layout.js';

export const DEMO_GAMES = 3;
export const THINK_STEPS = [2, 5, 8, 10];

export const demoLocked = (S, kind, id) => S.demo && ((kind === 'level' && (id === 'expert' || id === 'master')) || (kind === 'length' && id === 'long'));
export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const recKey = (level, n) => `${level}:${n}`;
export const recOf = (S, level) => {
  let w = 0, l = 0;
  for (const k of Object.keys(S.stats)) if (k.startsWith(`${level}:`)) { w += S.stats[k][0]; l += S.stats[k][1]; }
  return [w, l];
};

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;
const sizeOf = (S) => [S.w ?? SCREEN.width, S.h ?? SCREEN.height];

function fixedBar(S, F) {
  return [
    { id: 'back', rect: F.back, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: F.zoomDec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: F.zoomInc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: F.zoomPct, label: pctLabel(S), size: 28, static: true },
  ];
}

// the name shown for a seat in setup: a person or the computer
export function seatLabel(S, i) {
  const s = S.setup.seats[i];
  const humans = S.setup.seats.slice(0, S.setup.n).filter((q) => !q).length;
  if (s) return `${seatColor(i)}: ${tr('computer')}`;
  return `${seatColor(i)}: ${humans === 1 ? tr('you') : `${tr('human')} ${i + 1}`}`;
}

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const [w, h] = sizeOf(S);
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale, w, h);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      const T = titleFrame(w, h);
      ui.region = T.menu; ui.title = T;
      const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
      const full = [];
      if (S.save) full.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: 32, sub: `${S.save.seats.length} · ${lenName(S.save.length)}`, minH: 104 });
      full.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.save ? 'normal' : 'primary', size: 36, sub: playSub, minH: S.save ? 92 : 118 });
      full.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: 92 });
      const rowA = { t: 'row', size: 28, minH: 92, items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] };
      const rowB = { t: 'row', size: 28, minH: 92, items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] };
      full.push(rowA, rowB);
      const compact = [];
      if (S.save) compact.push(full[0]);
      compact.push({ ...full[S.save ? 1 : 0], minH: S.save ? 84 : 100 });
      compact.push({ ...full[S.save ? 2 : 1], minH: 84 });
      compact.push({ ...rowA, minH: 84 }, { ...rowB, minH: 84 });
      let b = T.compact ? compact : full;
      if (!T.compact && layoutDoc(b, scale, T.menu.w).height > T.menu.h) b = compact;
      ui.blocks = b;
      break;
    }
    case 'setup': {
      { const F = docFrame(w, h, false, true); ui.panel = F.panel; ui.region = F.region; ui.frame = F; ui.fixed = [...fixedBar(S, F), { id: 'start', rect: F.start, kind: 'primary', label: tr('startGame'), size: 34 }]; }
      const b = [];
      const su = S.setup;
      b.push({ t: 'img', name: 'setup', h: Math.min(250, Math.max(150, Math.round(ui.region.h * 0.3))) });
      b.push({ t: 'h', text: tr('playersTitle'), size: 32 });
      const nums = []; for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) nums.push({ id: `n:${n}`, label: String(n), kind: su.n === n ? 'on' : 'normal' });
      b.push({ t: 'row', size: 30, minH: 80, items: nums });
      b.push({ t: 'h', text: tr('seatsTitle'), size: 30 });
      for (let i = 0; i < su.n; i++) b.push({ t: 'btn', id: `seat:${i}`, label: seatLabel(S, i), kind: su.seats[i] ? 'normal' : 'on', size: 26, minH: 74, sub: undefined });
      b.push({ t: 'p', text: tr('tapToToggle'), size: 21, gap: 8, dim: true });
      if (su.seats.slice(0, su.n).some(Boolean)) {
        b.push({ t: 'h', text: tr('levelTitle'), size: 30 });
        b.push({ t: 'row', size: 26, minH: 78, items: LEVELS.slice(0, 2).map((l) => ({ id: `lv:${l.id}`, label: lvName(l.id), kind: su.level === l.id ? 'on' : 'normal', disabled: demoLocked(S, 'level', l.id) })) });
        b.push({ t: 'row', size: 26, minH: 78, items: LEVELS.slice(2).map((l) => ({ id: `lv:${l.id}`, label: lvName(l.id), kind: su.level === l.id ? 'on' : 'normal', disabled: demoLocked(S, 'level', l.id) })) });
        b.push({ t: 'p', text: lvBlurb(su.level), size: 22, gap: 10 });
      }
      b.push({ t: 'h', text: tr('lengthTitle'), size: 30 });
      b.push({ t: 'row', size: 24, minH: 78, items: LENGTHS.map((l) => ({ id: `len:${l.id}`, label: lenName(l.id), kind: su.length === l.id ? 'on' : 'normal', disabled: demoLocked(S, 'length', l.id) })) });
      b.push({ t: 'p', text: lenBlurb(su.length), size: 22, gap: 10 });
      const lvs = su.seats.slice(0, su.n).some(Boolean) ? su.level : null;
      if (lvs) { const r = recOf(S, lvs); b.push({ t: 'p', text: tr('recordLine', { label: tr('record'), level: lvName(lvs), w: r[0], l: r[1] }), size: 21, gap: 12 }); }
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? getRules() : getHowto();
      const F = docFrame(w, h, false, false);
      ui.panel = F.panel; ui.region = F.region; ui.frame = F;
      ui.fixed = fixedBar(S, F);
      ui.scrollKey = S.scene;
      const b = [];
      pages.forEach((pg, i) => {
        b.push({ t: 'h', text: pg.title, size: i === 0 ? 40 : 34 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: Math.min(isRules ? 400 : 420, Math.max(200, Math.round(F.region.h * 0.5))) });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
        else b.push({ t: 'p', text: pg.body, size: 32 });
      });
      if (!isRules) b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: 'primary', size: 28, minH: 90 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      { const F = docFrame(w, h, false, false); ui.panel = F.panel; ui.region = F.region; ui.frame = F; ui.fixed = fixedBar(S, F); }
      const b = [{ t: 'img', name: 'logo', h: Math.min(300, Math.max(180, Math.round(ui.region.h * 0.45))) }];
      getAbout().forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      { const F = docFrame(w, h, false, false); ui.panel = F.panel; ui.region = F.region; ui.frame = F; ui.fixed = fixedBar(S, F); }
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: tr('theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: themeName(th.id), kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: `${tr('paceTitle')}: ${tr(`pace_${S.pace}`)}`, size: 24, gap: 6 });
      b.push({ t: 'row', size: 24, minH: 76, items: [0, 1, 2, 3].map((i) => ({ id: `pace:${i}`, label: tr(`pace_${i}`), kind: S.pace === i ? 'on' : 'normal' })) });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: `${tr('thinkTime')}: ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}`, size: 24, gap: 6 });
      b.push({ t: 'row', size: 30, items: [{ id: 'set:think-', label: '-', disabled: S.thinkIdx === 0 }, { id: 'set:think+', label: '+', disabled: S.thinkIdx === THINK_STEPS.length - 1 }] });
      if (!S.demo) {
        if (S.owns) b.push({ t: 'p', text: tr('owned'), size: 24 });
        else b.push({ t: 'btn', id: 'set:unlock', label: S.price ? `${tr('unlock')} · ${S.price}` : tr('unlock'), kind: 'primary', size: 28 });
        b.push({ t: 'btn', id: 'set:restore', label: tr('restore'), size: 26 });
      }
      b.push({ t: 'btn', id: 'set:reset', label: S.resetArm ? tr('resetConfirm') : tr('resetProgress'), kind: 'danger', size: 26 });
      ui.blocks = b;
      break;
    }
    case 'demo-limit': {
      ui.kind = 'card';
      const zs = (n) => (scale >= 2 ? n * 0.5 : n);
      ui.blocks = [
        { t: 'img', name: 'lock', h: scale >= 2 ? 90 : 180 },
        { t: 'h', text: tr('demoLimitTitle'), size: zs(32) },
        { t: 'p', text: tr('demoLimitBody'), size: zs(26) },
        { t: 'btn', id: 'auto', label: tr('autoBtn'), kind: 'primary', size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : 84 },
        { t: 'btn', id: 'menu', label: tr('quitMenu'), size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : 84 },
      ];
      fitCard(ui, scale, w, h);
      return ui;
    }
    default:
      ui.kind = 'none';
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600);
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function overlayUi(S, scale, w, h) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.66 : n);
  const ps = (n) => (scale >= 2 ? n * 0.5 : n);
  const bs = (n) => (scale >= 2 ? n * 0.7 : n);
  const bmin = scale >= 2 ? 56 : 84;
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: tr('paused'), size: hs(40) });
    b.push({ t: 'p', text: `${tr('textSize')}: ${pctLabel(S)}`, size: ps(22), center: true, gap: 4 });
    b.push({ t: 'btn', id: 'ov:resume', label: tr('resume'), kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:restart', label: tr('restart'), size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: bs(26), minH: bmin });
    b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
    b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
  } else if (S.overlay === 'end') {
    const e = S.endInfo ?? { head: '', body: '', rec: '', lines: '' };
    b.push({ t: 'h', text: e.head, size: hs(40) });
    b.push({ t: 'img', name: 'endmark', h: scale >= 2 ? 100 : 150, data: e });
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (e.lines) b.push({ t: 'p', text: e.lines, size: ps(22), center: true, gap: 10 });
    if (e.rec) b.push({ t: 'p', text: e.rec, size: ps(22), center: true });
    b.push({ t: 'p', text: 'More heritage games in Arcforge', size: ps(20), center: true, dim: true, gap: 6 });
    b.push({ t: 'btn', id: 'ov:again', label: tr('again'), kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:setup', label: tr('newSetup'), size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: tr('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: tr('autoSummary'), size: ps(26) });
    b.push({ t: 'btn', id: 'ov:autoagain', label: tr('autoAgain'), kind: 'primary', size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'ov:autoexit', label: tr('quitMenu'), size: bs(28), minH: bmin });
  }
  ui.blocks = b;
  fitCard(ui, scale, w, h);
  return ui;
}

// Sizes the card to its content and splits it into the scrolling words (ui.region / ui.layout) and the fixed buttons (ui.fixed).
// Portrait: words on top, buttons below. Wide screens: words left, buttons right, so a short screen never runs out of height.
function fitCard(ui, scale, w, h) {
  const A = overlayArea(w, h);
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const mk = (bt, it, x, y) => ({
    id: bt.id, rect: { x: x + bt.x, y: y + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  });
  if (!A.wide) {
    const innerW = A.w - 48;
    const body = layoutDoc(bodyBlocks, scale, innerW);
    let as = scale, act = layoutDoc(actBlocks, as, innerW);
    while (as > 1 && act.height > A.maxH * 0.62) { as = Math.max(1, as - 0.25); act = layoutDoc(actBlocks, as, innerW); }
    const ch = Math.min(A.maxH, Math.max(420, body.height + act.height + 72));
    const y = Math.round(A.cy - ch / 2), x0 = Math.round(A.cx - A.w / 2) + 24;
    const actTop = y + ch - 28 - act.height;
    ui.panel = { x: x0 - 24, y, w: A.w, h: ch };
    ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(120, ch - 56 - act.height - 8) };
    ui.layout = body;
    ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => mk(bt, it, x0, actTop)));
    return;
  }
  const colW = Math.floor((A.w - 72) / 2);
  const body = layoutDoc(bodyBlocks, scale, colW);
  let as = scale, act = layoutDoc(actBlocks, as, colW);
  while (as > 1 && act.height > A.maxH - 64) { as = Math.max(1, as - 0.25); act = layoutDoc(actBlocks, as, colW); }
  const ch = Math.min(A.maxH, Math.max(340, Math.max(body.height, act.height) + 64));
  const y = Math.round(A.cy - ch / 2), x0 = Math.round(A.cx - A.w / 2) + 24;
  ui.panel = { x: x0 - 24, y, w: A.w, h: ch };
  ui.region = { x: x0, y: y + 32, w: colW, h: ch - 64 };
  ui.layout = body;
  ui.offY = body.height < ui.region.h ? (ui.region.h - body.height) / 2 : 0;
  const rx = x0 + colW + 24, actTop = y + (ch - act.height) / 2;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => mk(bt, it, rx, actTop)));
}
