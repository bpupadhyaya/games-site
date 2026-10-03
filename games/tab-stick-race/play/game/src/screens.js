// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi()
// with the same state, so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { HOWTO, RULES, ABOUT, LANGS, tr, pageOf } from './content.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonText } from './lessons.js';
import { THEMES } from './art.js';
import {
  DOC_BACK, ZOOM_DEC, ZOOM_INC, DOC_PANEL, DOC_BODY, DOC_BODY_NAV, DOC_BODY_START, START_BTN, NAV_PREV, NAV_NEXT, MENU_REGION, OVERLAY,
} from './layout.js';

export const DEMO_GAMES = 2;
export const THINK_STEPS = [2, 5, 8, 10];
export const PACES = [1, 1.5, 2];            // game speed: playback rate of throws, stone moves and the computer's waits
export const AUTO_SPEEDS = [1, 2, 4];          // Watch & Learn speed: everything, thinking included, runs this much faster
export const piecesLabel = (S, n) => (n === 3 ? T(S, 'pieces3') : n === 5 ? T(S, 'pieces5') : n === 7 ? T(S, 'pieces7') : n === 4 ? T(S, 'pieces4') : `${n}`);

export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const recOf = (S, level) => S.stats[level] ?? [0, 0];
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;
export const lvName = (S, l) => (S.lang === 'ar' ? l.ar : l.name);
const T = (S, k, v) => tr(k, v, S.lang);
const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;
const rtl = (S) => S.lang === 'ar';

function fixedBar(S) {
  return [
    { id: 'back', rect: DOC_BACK, kind: 'normal', icon: 'back', label: T(S, 'back'), size: 26 },
    { id: 'zoom-', rect: ZOOM_DEC, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: ZOOM_INC, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: { x: 480, y: 20, w: 140, h: 76 }, label: pctLabel(S), size: 28, static: true },
  ];
}

export function levelLabel(S) {
  if (S.setup.level === 'two') return T(S, 'twoPlayers');
  const l = LEVELS.find((x) => x.id === S.setup.level);
  return l ? lvName(S, l) : '';
}

const langRow = (S, size) => ({ t: 'row', size, minH: 84, items: LANGS.map((l) => ({ id: `lang:${l.id}`, label: l.label, kind: S.lang === l.id ? 'on' : 'normal' })) });

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene, rtl: rtl(S) };
  if (S.overlay) return overlayUi(S, scale);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.region = MENU_REGION;
      const b = [];
      if (S.save) b.push({ t: 'btn', id: 'continue', label: T(S, 'continueBtn'), kind: 'primary', size: 32, sub: S.save.two ? T(S, 'twoPlayers') : lvName(S, LEVELS.find((l) => l.id === S.save.level) ?? LEVELS[2]), minH: 104 });
      const playSub = S.demo ? T(S, 'demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
      b.push({ t: 'btn', id: 'play', label: T(S, 'playBtn'), kind: S.save ? 'normal' : 'primary', size: 36, sub: playSub, minH: S.save ? 92 : 118 });
      b.push({ t: 'btn', id: 'learn', label: T(S, 'learnBtn'), size: 30, sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: 92 });
      b.push({ t: 'btn', id: 'auto', label: T(S, 'autoBtn'), size: 30, minH: 88 });
      b.push({ t: 'row', size: 28, minH: 88, items: [{ id: 'howto', label: T(S, 'howtoBtn') }, { id: 'rules', label: T(S, 'rulesBtn') }] });
      b.push({ t: 'row', size: 28, minH: 88, items: [{ id: 'about', label: T(S, 'aboutBtn') }, { id: 'settings', label: T(S, 'settingsBtn') }] });
      b.push(langRow(S, 26));
      ui.blocks = b;
      break;
    }
    case 'setup': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY_START;
      ui.fixed = [...fixedBar(S), { id: 'start', rect: START_BTN, kind: 'primary', label: T(S, 'startGame'), size: 34 }];
      const b = [];
      const lv = S.setup.level;
      b.push({ t: 'h', text: T(S, 'opponentTitle'), size: 34 });
      const rows = [[LEVELS[0], LEVELS[1]], [LEVELS[2], LEVELS[3]], [LEVELS[4], { id: 'two', name: T(S, 'twoPlayers'), ar: T(S, 'twoPlayers') }]];
      for (const r of rows) b.push({ t: 'row', size: 28, minH: 84, items: r.map((l) => ({ id: `lv:${l.id}`, label: lvName(S, l), kind: lv === l.id ? 'on' : 'normal' })) });
      const lvInfo = lv === 'two' ? T(S, 'twoInfo') : (S.lang === 'ar' ? LEVEL_BLURB_AR[lv] : LEVELS.find((l) => l.id === lv).blurb);
      b.push({ t: 'p', text: lvInfo, size: 24, gap: 10 });
      if (lv !== 'two') {
        b.push({ t: 'h', text: T(S, 'sideTitle'), size: 34 });
        b.push({ t: 'row', size: 28, minH: 84, items: [{ id: 'side:0', label: T(S, 'sideFirst'), kind: S.setup.side === 0 ? 'on' : 'normal' }, { id: 'side:1', label: T(S, 'sideSecond'), kind: S.setup.side === 1 ? 'on' : 'normal' }] });
      }
      b.push({ t: 'h', text: T(S, 'piecesTitle'), size: 34 });
      b.push({ t: 'row', size: 28, minH: 84, items: [3, 5, 7].map((n) => ({ id: `pc:${n}`, label: piecesLabel(S, n), kind: S.setup.pieces === n ? 'on' : 'normal' })) });
      if (lv !== 'two') {
        const rec = recOf(S, lv);
        b.push({ t: 'p', text: `${T(S, 'record')} (${levelLabel(S)}): ${rec[0]}${T(S, 'wins')}  ${rec[1]}${T(S, 'losses')}`, size: 22, gap: 12 });
      }
      b.push({ t: 'img', name: 'setupart', h: 280 });
      ui.blocks = b;
      break;
    }
    case 'learn': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'h', text: T(S, 'lessonsTitle'), size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSONS.length}`, size: 24, gap: 10, align: 'center' }];
      LESSONS.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${lessonText(l, S.lang).title}`, kind: S.lessons[l.id] ? 'on' : 'normal', size: 28, sub: locked ? T(S, 'locked') : S.lessons[l.id] ? T(S, 'lessonDone') : undefined, disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES : HOWTO;
      const pi = Math.min(S.page[S.scene], pages.length - 1);
      const pg = pageOf(pages, pi, S.lang);
      ui.panel = DOC_PANEL; ui.region = DOC_BODY_NAV;
      ui.fixed = fixedBar(S);
      ui.nav = { label: `${pi + 1} / ${pages.length}`, prev: { id: 'prev', rect: NAV_PREV, label: T(S, 'prev'), disabled: pi === 0, kind: 'normal', size: 26 }, next: { id: 'next', rect: NAV_NEXT, label: isRules || pi < pages.length - 1 ? T(S, 'next') : T(S, 'playBtn'), disabled: isRules && pi === pages.length - 1, kind: 'primary', size: 26 } };
      ui.scrollKey = `${S.scene}:${pi}`;
      const b = [{ t: 'h', text: pg.title, size: 40 }];
      if (pg.art) b.push({ t: 'img', name: pg.art, h: isRules ? 400 : 420 });
      if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
      else b.push({ t: 'p', text: pg.body, size: 32 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'img', name: 'logo', h: 330 }];
      ABOUT.forEach((s, i) => { const pg = s[S.lang] ?? s.en; b.push({ t: 'h', text: pg.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: pg.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22, align: 'center' });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S);
      const b = [];
      b.push({ t: 'h', text: T(S, 'settingsBtn'), size: 36 });
      b.push({ t: 'p', text: T(S, 'language'), size: 24, gap: 6 });
      b.push(langRow(S, 26));
      b.push({ t: 'p', text: T(S, 'theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: S.lang === 'ar' ? th.ar : th.name, kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? T(S, 'soundOn') : T(S, 'soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: T(S, 'paceTitle'), size: 24, gap: 6 });
      b.push({ t: 'row', size: 26, items: PACES.map((_, i) => ({ id: `pace:${i}`, label: T(S, `pace${i + 1}`), kind: S.paceIdx === i ? 'on' : 'normal' })) });
      b.push({ t: 'btn', id: 'set:single', label: S.autoSingle ? T(S, 'singleOn') : T(S, 'singleOff'), kind: S.autoSingle ? 'on' : 'normal', size: 24 });
      b.push({ t: 'p', text: `${T(S, 'thinkTime')}: ${THINK_STEPS[S.thinkIdx]}${T(S, 'seconds')}`, size: 24, gap: 6 });
      b.push({ t: 'row', size: 30, items: [{ id: 'set:think-', label: '-', disabled: S.thinkIdx === 0 }, { id: 'set:think+', label: '+', disabled: S.thinkIdx === THINK_STEPS.length - 1 }] });
      if (!S.demo) {
        if (S.owns) b.push({ t: 'p', text: T(S, 'owned'), size: 24 });
        else b.push({ t: 'btn', id: 'set:unlock', label: S.price ? `${T(S, 'unlock')} · ${S.price}` : T(S, 'unlock'), kind: 'primary', size: 28 });
        b.push({ t: 'btn', id: 'set:restore', label: T(S, 'restore'), size: 26 });
      }
      b.push({ t: 'btn', id: 'set:reset', label: S.resetArm ? T(S, 'resetConfirm') : T(S, 'resetProgress'), kind: 'danger', size: 26 });
      ui.blocks = b;
      break;
    }
    case 'demo-limit': {
      ui.kind = 'card';
      const zs = (n) => (scale >= 2 ? n * 0.5 : n);
      ui.blocks = [
        { t: 'img', name: 'lock', h: scale >= 2 ? 90 : 180 },
        { t: 'h', text: T(S, 'demoLimitTitle'), size: zs(32) },
        { t: 'p', text: T(S, 'demoLimitBody'), size: zs(26) },
        { t: 'btn', id: 'auto', label: T(S, 'autoBtn'), kind: 'primary', size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : 84 },
        { t: 'btn', id: 'menu', label: T(S, 'quitMenu'), size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : 84 },
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

export const LEVEL_BLURB_AR = {
  beginner: 'يلعب أي نقلة مسموحة. سهل الفوز عليه، وهو بداية جيدة للتعلّم.',
  casual: 'يحب الأسر وإدخال الحجارة لكنه يتجاهل الخطر وقد يخطئ أحياناً.',
  skilled: 'يحسب احتمال الإصابة قبل كل نقلة.',
  expert: 'يخطط لترتيب كل أعداد الدور ويتجنب المربعات المكشوفة.',
  master: 'يلعب كل دور بأفضل طريقة يجدها، ويقدّر مربعات النجمة وإدخال الحجارة.',
};

function overlayUi(S, scale) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: OVERLAY, scrollKey: `ov:${S.overlay}`, overlay: true, rtl: rtl(S) };
  ui.region = { x: OVERLAY.x + 24, y: OVERLAY.y + 24, w: OVERLAY.w - 48, h: OVERLAY.h - 48 };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.72 : n);
  const ps = (n) => (scale >= 2 ? n * 0.62 : n);
  const bs = (n) => (scale >= 2 ? n * 0.7 : n);
  const bmin = scale >= 2 ? 56 : 84;
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: T(S, 'paused'), size: hs(40) });
    b.push({ t: 'p', text: `${T(S, 'textSize')}: ${pctLabel(S)}`, size: ps(22), center: true, gap: 4 });
    b.push({ t: 'btn', id: 'ov:resume', label: T(S, 'resume'), kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:restart', label: T(S, 'restart'), size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? T(S, 'soundOn') : T(S, 'soundOff'), kind: S.sound ? 'on' : 'normal', size: bs(26), minH: bmin });
    b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
    b.push({ t: 'btn', id: 'ov:menu', label: T(S, 'quitMenu'), size: bs(28), minH: bmin });
  } else if (S.overlay === 'end') {
    const e = S.endInfo ?? { head: '', body: '', rec: '' };
    b.push({ t: 'h', text: e.head, size: hs(40) });
    b.push({ t: 'img', name: 'endmark', h: scale >= 2 ? 90 : 150, data: e });
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (e.rec) b.push({ t: 'p', text: e.rec, size: ps(22), center: true });
    if (S.match && S.match.lesson) {
      if (e.lessonOk) b.push({ t: 'btn', id: 'ov:lessonnext', label: T(S, 'lessonNext'), kind: 'primary', size: bs(30), minH: bmin });
      else b.push({ t: 'btn', id: 'ov:lessonagain', label: T(S, 'lessonRetry'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: T(S, 'lessonList'), size: bs(28), minH: bmin });
    } else {
      b.push({ t: 'btn', id: 'ov:again', label: T(S, 'again'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:setup', label: T(S, 'newSetup'), size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'ov:menu', label: T(S, 'quitMenu'), size: bs(28), minH: bmin });
    }
  } else if (S.overlay === 'lesson') {
    const e = S.lessonInfo ?? { ok: false, head: '', body: '' };
    b.push({ t: 'h', text: e.head, size: hs(38) });
    b.push({ t: 'p', text: e.body, size: ps(25) });
    if (e.ok) {
      b.push({ t: 'btn', id: 'ov:lessonnext', label: S.lessonIdx + 1 < LESSONS.length ? T(S, 'lessonNext') : T(S, 'lessonList'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: T(S, 'lessonList'), size: bs(28), minH: bmin });
    } else {
      b.push({ t: 'btn', id: 'ov:lessonretry', label: T(S, 'lessonRetry'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: T(S, 'lessonList'), size: bs(28), minH: bmin });
    }
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: T(S, 'autoSession'), size: hs(38) });
    b.push({ t: 'p', text: T(S, 'autoSummary'), size: ps(26) });
    b.push({ t: 'btn', id: 'ov:autoagain', label: T(S, 'autoAgain'), kind: 'primary', size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'ov:autoexit', label: T(S, 'autoExit'), size: bs(28), minH: bmin });
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
