// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi()
// with the same state, so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { getHowto, getRules, getAbout, tr, lvName, lvBlurb, themeName } from './content.js';
import { getLang, LANGS } from './lang.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonTitle } from './lessons.js';
import { THEMES } from './art.js';
import {
  DOC_BACK, ZOOM_DEC, ZOOM_INC, DOC_PANEL, DOC_BODY, DOC_BODY_NAV, DOC_BODY_START, START_BTN, NAV_PREV, NAV_NEXT, MENU_REGION, OVERLAY, LANG_BTNS,
} from './layout.js';

export const DEMO_GAMES = 3;
export const THINK_STEPS = [2, 5, 8, 10];

export const demoLevelLocked = (S, level) => S.demo && (level === 'expert' || level === 'master');
export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const recKey = (level, side) => `${level}:${side}`;
export const recOf = (S, level) => { const a = S.stats[recKey(level, 1)] ?? [0, 0, 0], b = S.stats[recKey(level, 2)] ?? [0, 0, 0]; return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;
export const firstOpenLesson = (S) => { const i = LESSONS.findIndex((l) => !S.lessons[l.id]); return i < 0 ? 0 : i; };

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S) {
  return [
    { id: 'back', rect: DOC_BACK, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: ZOOM_DEC, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: ZOOM_INC, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: { x: 480, y: 20, w: 140, h: 76 }, label: pctLabel(S), size: 28, static: true },
  ];
}

export function levelLabel(S) {
  if (S.setup.level === 'two') return tr('twoPlayers');
  return lvName(S.setup.level);
}

// The two language buttons: each is written in its own language, always visible, never blended.
export const LANG_LABELS = ['Play in English', 'Jugar en español', 'العب بالعربية'];
export const langButtons = () => LANGS.map((l, i) => ({ id: `lang:${l}`, rect: LANG_BTNS[i], kind: getLang() === l ? 'on' : 'normal', label: LANG_LABELS[i], size: 21 }));

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.region = MENU_REGION;
      const b = [];
      if (S.save) b.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: 32, sub: S.save.two ? tr('twoPlayers') : `${tr('vsComputer')} · ${lvName(S.save.level)}`, minH: 104 });
      const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
      b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.save ? 'normal' : 'primary', size: 36, sub: playSub, minH: S.save ? 92 : 118 });
      b.push({ t: 'btn', id: 'learn', label: tr('learnBtn'), size: 30, sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: 96 });
      b.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: 92 });
      b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] });
      b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] });
      ui.blocks = b;
      ui.fixed = langButtons();
      break;
    }
    case 'setup': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY_START;
      ui.fixed = [...fixedBar(S), { id: 'start', rect: START_BTN, kind: 'primary', label: tr('startGame'), size: 34 }];
      const b = [];
      const lv = S.setup.level;
      if (scale <= 1.5) b.push({ t: 'img', name: 'setupart', h: 300 });
      b.push({ t: 'h', text: tr('opponentTitle'), size: 32 });
      const rows = [[LEVELS[0], LEVELS[1]], [LEVELS[2], LEVELS[3]], [LEVELS[4], { id: 'two', name: tr('twoPlayers') }]];
      for (const r of rows) {
        b.push({ t: 'row', size: 28, minH: 84, items: r.map((l) => ({ id: `lv:${l.id}`, label: l.id === 'two' ? l.name : lvName(l.id), kind: lv === l.id ? 'on' : 'normal', disabled: demoLevelLocked(S, l.id) })) });
      }
      const lvInfo = lv === 'two' ? tr('twoInfo') : lvBlurb(lv);
      b.push({ t: 'p', text: lvInfo, size: 24, gap: 10 });
      if (lv !== 'two') {
        b.push({ t: 'h', text: tr('sideTitle'), size: 32 });
        b.push({ t: 'btn', id: 'side:1', label: tr('playL'), kind: S.setup.side === 1 ? 'on' : 'normal', size: 26, minH: 84 });
        b.push({ t: 'btn', id: 'side:2', label: tr('playD'), kind: S.setup.side === 2 ? 'on' : 'normal', size: 26, minH: 84 });
        b.push({ t: 'p', text: S.setup.side === 1 ? tr('sideInfo1') : tr('sideInfo2'), size: 22, gap: 10 });
        const rec = recOf(S, lv);
        b.push({ t: 'p', text: tr('recordLine', { label: tr('record'), level: lvName(lv), w: rec[0], d: rec[1], l: rec[2] }), size: 22, gap: 12 });
      }
      ui.blocks = b;
      break;
    }
    case 'learn': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'h', text: tr('lessonsTitle'), size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSONS.length}`, size: 24, gap: 10 }];
      LESSONS.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${lessonTitle(l)}`, kind: S.lessons[l.id] ? 'on' : 'normal', size: 28, sub: locked ? tr('locked') : S.lessons[l.id] ? tr('lessonDone') : l.type === 'game' ? tr('lessonGame') : tr('lessonMove'), disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? getRules() : getHowto();
      const pi = Math.min(S.page[S.scene], pages.length - 1);
      const pg = pages[pi];
      ui.panel = DOC_PANEL; ui.region = DOC_BODY_NAV;
      ui.fixed = fixedBar(S);
      ui.nav = { label: `${pi + 1} / ${pages.length}`, prev: { id: 'prev', rect: NAV_PREV, label: tr('prev'), disabled: pi === 0, kind: 'normal', size: 26 }, next: { id: 'next', rect: NAV_NEXT, label: isRules || pi < pages.length - 1 ? tr('next') : tr('playBtn'), disabled: isRules && pi === pages.length - 1, kind: 'primary', size: 26 } };
      ui.scrollKey = `${S.scene}:${pi}`;
      const b = [{ t: 'h', text: pg.title, size: 40 }];
      if (pg.art) b.push({ t: 'img', name: pg.art, h: isRules ? 380 : 400 });
      if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
      else b.push({ t: 'p', text: pg.body, size: 32 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'img', name: 'logo', h: 280 }];
      getAbout().forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S);
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: tr('theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: themeName(th.id), kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: tr('language'), size: 24, gap: 6 });
      for (let i = 0; i < LANGS.length; i++) b.push({ t: 'btn', id: `lang:${LANGS[i]}`, label: LANG_LABELS[i], kind: getLang() === LANGS[i] ? 'on' : 'normal', size: 26 });
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
      fitCard(ui, scale);
      return ui;
    }
    default:
      ui.kind = 'none';
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600);
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function overlayUi(S, scale) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: OVERLAY, scrollKey: `ov:${S.overlay}`, overlay: true };
  ui.region = { x: OVERLAY.x + 24, y: OVERLAY.y + 24, w: OVERLAY.w - 48, h: OVERLAY.h - 48 };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.66 : n);
  const ps = (n) => (scale >= 2 ? n * 0.5 : n);
  const bs = (n) => (scale >= 2 ? n * 0.7 : n);
  const bmin = scale >= 2 ? 56 : 84;
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: tr('paused'), size: hs(40) });
    b.push({ t: 'p', text: getLang() === 'ar' ? `${tr('textSize')}: ${Math.round(TEXT_SCALES[S.textIdx] * 100)} بالمئة` : `${tr('textSize')}: ${pctLabel(S)}`, size: ps(22), center: true, gap: 4 });
    b.push({ t: 'btn', id: 'ov:resume', label: tr('resume'), kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:restart', label: tr('restart'), size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: bs(26), minH: bmin });
    b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
    b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
  } else if (S.overlay === 'end') {
    const e = S.endInfo ?? { head: '', body: '', rec: '' };
    b.push({ t: 'h', text: e.head, size: hs(40) });
    b.push({ t: 'img', name: 'endmark', h: scale >= 2 ? 100 : 150, data: e });
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (e.rec) b.push({ t: 'p', text: e.rec, size: ps(22), center: true });
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
  fitCard(ui, scale);
  return ui;
}

function fitCard(ui, scale) {
  const innerW = OVERLAY.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const body = layoutDoc(bodyBlocks, scale, innerW);
  const act = layoutDoc(actBlocks, scale, innerW);
  const h = Math.min(OVERLAY.h + 120, Math.max(420, body.height + act.height + 72));
  const y = Math.round(780 - h / 2);
  const x0 = OVERLAY.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: OVERLAY.x, y, w: OVERLAY.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(160, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  })));
}
