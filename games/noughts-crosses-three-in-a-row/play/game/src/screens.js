// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi()
// with the same state, so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { host } from './layout.js';
import { HOWTO, RULES, ABOUT, tr } from './content.js';
import { MODE_IDS, MODE_NAMES } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { THEMES } from './art.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const HERO_H = 800;   // the title hero (name, tagline, credit, attract board) is drawn in a 720 x 790 box, scaled to fit

export const DEMO_GAMES = 3;
export const THINK_STEPS = [2, 5, 8, 10];
export const MODE_BLURB = {
  classic: 'The classic: three in a row on a 3x3 board.',
  terni: 'The Roman game: place three pieces, then slide them along the lines.',
  misere: 'Turned around: complete three in a row and you lose.',
  quad: 'A 4x4 board: four in a row, or a 2x2 square, wins.',
};

export const demoModeLocked = (S, mode) => S.demo && mode !== 'classic';
export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const recKey = (mode, level) => `${mode}:${level}`;
export const recOf = (S, mode, level) => S.stats[recKey(mode, level)] ?? [0, 0, 0];
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;
export const firstOpenLesson = (S) => { const i = LESSONS.findIndex((l) => !S.lessons[l.id]); return i < 0 ? 0 : i; };

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S, L) {
  const D = L.doc;
  return [
    { id: 'back', rect: D.back, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: D.dec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: D.inc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: D.pct, label: pctLabel(S), size: 28, static: true },
  ];
}

export function levelLabel(S) {
  if (S.setup.level === 'two') return tr('twoPlayers');
  return LEVELS.find((l) => l.id === S.setup.level)?.name ?? '';
}

export function buildUi(S, L) {
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale, L);
  const D = L.doc;

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.blocks = menuBlocks(S, 1);
      titleRegion(S, ui, L, scale);
      break;
    }
    case 'setup': {
      ui.panel = D.panel; ui.region = D.bodyStart;
      ui.fixed = [...fixedBar(S, L), { id: 'start', rect: D.start, kind: 'primary', label: tr('startGame'), size: L.wide ? 30 : 34 }];
      const b = [];
      const lv = S.setup.level;
      b.push({ t: 'h', text: tr('modeTitle'), size: 32 });
      b.push({
        t: 'grid', cols: L.wide ? (scale <= 1.5 ? 4 : 2) : scale <= 1 ? 2 : scale <= 2 ? 2 : 1, aspect: L.wide && scale <= 1.5 ? 1.0 : 0.82,
        cells: MODE_IDS.map((m) => ({ id: `mode:${m}`, label: MODE_NAMES[m], mode: m, state: S.setup.mode === m ? 'sel' : demoModeLocked(S, m) ? 'locked' : 'open' })),
      });
      b.push({ t: 'p', text: `${MODE_BLURB[S.setup.mode]}`, size: 24, gap: 10 });
      b.push({ t: 'h', text: tr('opponentTitle'), size: 32 });
      const rows = [[LEVELS[0], LEVELS[1]], [LEVELS[2], LEVELS[3]], [LEVELS[4], { id: 'two', name: tr('twoPlayers') }]];
      for (const r of rows) {
        b.push({ t: 'row', size: 28, minH: 84, items: r.map((l) => ({ id: `lv:${l.id}`, label: l.name, kind: lv === l.id ? 'on' : 'normal' })) });
      }
      const lvInfo = lv === 'two' ? 'Two players share the phone. X goes first.' : LEVELS.find((l) => l.id === lv).blurb;
      b.push({ t: 'p', text: lvInfo, size: 24, gap: 10 });
      if (lv !== 'two') {
        b.push({ t: 'h', text: tr('sideTitle'), size: 32 });
        b.push({ t: 'row', size: 28, minH: 84, items: [{ id: 'side:1', label: tr('playX'), kind: S.setup.side === 1 ? 'on' : 'normal' }, { id: 'side:2', label: tr('playO'), kind: S.setup.side === 2 ? 'on' : 'normal' }] });
        const rec = recOf(S, S.setup.mode, lv);
        b.push({ t: 'p', text: `${tr('record')} (${MODE_NAMES[S.setup.mode]}, ${levelLabel(S)}): ${rec[0]} ${tr('wins')}  ${rec[1]} ${tr('draws')}  ${rec[2]} ${tr('losses')}`, size: 22, gap: 12 });
      }
      ui.blocks = b;
      break;
    }
    case 'learn': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, L);
      const b = [{ t: 'h', text: tr('lessonsTitle'), size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSONS.length}`, size: 24, gap: 10 }];
      LESSONS.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${l.title}`, kind: S.lessons[l.id] ? 'on' : 'normal', size: 28, sub: locked ? tr('locked') : `${MODE_NAMES[l.mode]}${S.lessons[l.id] ? ` · ${tr('lessonDone')}` : ''}`, disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      // One continuous scrolling reader: every page of the old paginated reader is a section here, in the same order,
      // each with its own heading and illustration (drag, wheel, keys; 100-300 percent text).
      const pages = isRules ? RULES : HOWTO;
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, L);
      ui.scrollKey = S.scene;
      const b = [];
      pages.forEach((pg, i) => {
        b.push({ t: 'h', text: pg.title, size: i === 0 ? 40 : 34 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: isRules ? 380 : 400 });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
        else b.push({ t: 'p', text: pg.body, size: 32 });
      });
      if (!isRules) b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: 'primary', size: 28, minH: 90 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, L);
      const b = [{ t: 'img', name: 'logo', h: 280 }];
      ABOUT.forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, L);
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: tr('theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: th.name, kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
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
      fitCard(ui, scale, L);
      return ui;
    }
    default:
      ui.kind = 'none';
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600);
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function menuBlocks(S, mf) {
  const m = (v) => Math.round(v * mf), b = [];
  if (S.save) b.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: 32, sub: `${MODE_NAMES[S.save.mode]} · ${S.save.two ? tr('twoPlayers') : LEVELS.find((l) => l.id === S.save.level)?.name ?? ''}`, minH: m(104) });
  const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
  b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.save ? 'normal' : 'primary', size: 36, sub: playSub, minH: m(S.save ? 92 : 118) });
  b.push({ t: 'btn', id: 'learn', label: tr('learnBtn'), size: 30, sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: m(96) });
  b.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: m(92) });
  b.push({ t: 'row', size: 28, minH: m(92), items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] });
  b.push({ t: 'row', size: 28, minH: m(92), items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] });
  return b;
}

// The title screen: portrait = hero on top, menu below (the menu buttons and then the hero shrink only when the room runs out);
// landscape = hero on the left, menu on the right.
const LOCK_AR = 327 / 1200;
// Tap zone of the title lockup (>= 44 css px each way; sideways and downward only, never into the menu above).
export function lockHit(lock, L) {
  const m = 44 / Math.max(0.05, host.px), w = Math.max(lock.w, m), y = lock.y - 2;
  return { x: lock.x + lock.w / 2 - w / 2, y, w, h: Math.max(lock.h + 2, Math.min(m, L.h - y)) };
}
function titleRegion(S, ui, L, scale) {
  const { U } = L;
  const lw = Math.min(260, L.wide ? clamp(U.w * 0.4, 400, 600) - 40 : L.colR - L.colL - 80), lh = lw * LOCK_AR, LK = lh + 10;
  if (L.wide) {
    const mw = clamp(U.w * 0.4, 400, 600), mx = U.x1 - 20 - mw;
    ui.region = { x: mx, y: U.y0 + 12, w: mw, h: U.h - 24 - LK };
    ui.lock = { x: mx + mw / 2 - lw / 2, y: U.y0 + 12 + U.h - 24 - LK + 8, w: lw, h: lh };
    const hx0 = U.x0 + 16, hw = mx - 16 - hx0, s = clamp(Math.min(hw / 720, (U.h - 56) / HERO_H), 0.4, 1.15);
    ui.hero = { s, x: hx0 + (hw - 720 * s) / 2, y: U.y0 + (U.h - HERO_H * s) / 2 };
    if (U.h < 700) ui.blocks = menuBlocks(S, clamp(U.h / 700, 0.75, 1));
  } else {
    const t0 = Math.max(0, L.ins.t - 6), bm = Math.max(24, L.ins.b + 8) + LK, mw = L.colR - L.colL - 48;
    const hk = L.h < 1000 ? 0.45 : L.h < 1100 ? 0.5 : 0.72, heroMin = hk * HERO_H, room = L.h - bm - t0 - heroMin;
    let need = layoutDoc(ui.blocks, scale, mw).height + 12;
    if (need > room && scale <= 1) { ui.blocks = menuBlocks(S, clamp(room / need, 0.55, 1)); need = layoutDoc(ui.blocks, scale, mw).height + 12; }
    let y = HERO_H - 10 + t0, rh = L.h - bm - y, s = 1;
    if (need > rh) {
      rh = Math.min(need, room); y = L.h - bm - rh;
      s = clamp((y - t0 - 6) / HERO_H, hk, 1);
    }
    ui.region = { x: L.colL + 24, y, w: mw, h: rh };
    ui.lock = { x: (L.colL + L.colR) / 2 - lw / 2, y: y + rh + 8, w: lw, h: lh };
    ui.hero = { s, x: (L.colL + L.colR) / 2 - 360 * s, y: t0 };
  }
}

function overlayUi(S, scale, L) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.72 : n);
  const ps = (n) => (scale >= 2 ? n * 0.62 : n);
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
    const e = S.endInfo ?? { head: '', body: '', rec: '' };
    b.push({ t: 'h', text: e.head, size: hs(40) });
    b.push({ t: 'img', name: 'endmark', h: scale >= 2 ? 90 : 150, data: e });
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (e.rec) b.push({ t: 'p', text: e.rec, size: ps(22), center: true });
    if (!(S.match && S.match.lesson)) b.push({ t: 'more' });
    if (S.match && S.match.lesson) {
      if (e.lessonOk) b.push({ t: 'btn', id: 'ov:lessonnext', label: tr('lessonNext'), kind: 'primary', size: bs(30), minH: bmin });
      else b.push({ t: 'btn', id: 'ov:lessonagain', label: tr('lessonRetry'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: tr('lessonList'), size: bs(28), minH: bmin });
    } else {
      b.push({ t: 'btn', id: 'ov:again', label: tr('again'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:setup', label: tr('newSetup'), size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
    }
  } else if (S.overlay === 'lesson') {
    const e = S.lessonInfo ?? { ok: false, head: '', body: '' };
    b.push({ t: 'h', text: e.head, size: hs(38) });
    b.push({ t: 'p', text: e.body, size: ps(25) });
    if (e.ok) {
      b.push({ t: 'btn', id: 'ov:lessonnext', label: S.lessonIdx + 1 < LESSONS.length ? tr('lessonNext') : tr('lessonList'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: tr('lessonList'), size: bs(28), minH: bmin });
    } else {
      b.push({ t: 'btn', id: 'ov:lessonretry', label: tr('lessonRetry'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: tr('lessonList'), size: bs(28), minH: bmin });
    }
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: tr('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: tr('autoSummary'), size: ps(26) });
    b.push({ t: 'btn', id: 'ov:autoagain', label: tr('autoAgain'), kind: 'primary', size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'ov:autoexit', label: tr('autoExit'), size: bs(28), minH: bmin });
  }
  ui.blocks = b;
  fitCard(ui, scale, L);
  return ui;
}

function fitCard(ui, scale, L) {
  const C = L.card, wideCard = C.wide, innerW = C.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const actW = wideCard ? Math.min(340, Math.round(innerW * 0.38)) : innerW, bodyW = wideCard ? innerW - actW - 28 : innerW;
  const body = layoutDoc(bodyBlocks, scale, bodyW);
  const act = layoutDoc(actBlocks, scale, actW);
  const x = Math.round(C.cx - C.w / 2), x0 = x + 24;
  let h, y, region, actX, actTop;
  if (wideCard) {
    h = clamp(Math.max(body.height, act.height) + 72, 300, C.maxH);
    h = Math.max(h, Math.min(C.maxH, act.height + 56));
    y = Math.round(C.cy - h / 2);
    region = { x: x0, y: y + 28, w: bodyW, h: h - 56 };
    actX = x0 + bodyW + 28; actTop = y + (h - act.height) / 2;
  } else {
    h = Math.min(Math.min(1180, C.maxH), Math.max(Math.min(420, C.maxH), body.height + act.height + 72));
    y = Math.round(C.cy - h / 2);
    actX = x0; actTop = y + h - 28 - act.height;
    region = { x: x0, y: y + 28, w: innerW, h: Math.max(80, h - 56 - act.height - 8) };
  }
  ui.panel = { x, y, w: C.w, h };
  ui.region = region;
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: actX + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  })));
}
