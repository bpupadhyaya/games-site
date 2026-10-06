// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi()
// with the same state, so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { howtoPages, rulesPages, aboutSections, tr, levelName, levelBlurb } from './content.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonText } from './lessons.js';
import { THEMES } from './art.js';
import {
  DOC_BACK, ZOOM_DEC, ZOOM_INC, ZOOM_LABEL, DOC_PANEL, DOC_PANEL_NAV, DOC_BODY, DOC_BODY_NAV, DOC_BODY_START, START_BTN, NAV_PREV, NAV_NEXT, OVERLAY, CARD, L,
  titleLayout, titleMenuW, setSize,
} from './layout.js';

export const DEMO_GAMES = 3;
export const THINK_STEPS = [2, 5, 8, 10];

export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const recKey = (setup) => `${setup.level}:${setup.qv}:${setup.young ? 1 : 0}`;
export const recOf = (S, key) => S.stats[key] ?? [0, 0, 0];
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;

// In landscape the text region is short: illustrations take at most about 60 percent of it.
const imgH = (h, region) => (L.wide ? Math.round(Math.min(h, Math.max(220, region.h * 0.62))) : h);

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S) {
  return [
    { id: 'back', rect: DOC_BACK, kind: 'normal', icon: 'back', label: tr('back'), size: S.lang === 'vi' ? 21 : 26 },
    { id: 'zoom-', rect: ZOOM_DEC, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: ZOOM_INC, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: ZOOM_LABEL, label: pctLabel(S), size: 28, static: true },
  ];
}

export function levelLabel(S, level) {
  if (level === 'two') return tr('twoPlayers');
  return levelName(level);
}

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale);

  switch (S.scene) {
    case 'lang': {
      ui.kind = 'card';
      ui.panel = null;
      ui.blocks = [
        { t: 'h', text: tr('langHead'), size: 36 },
        { t: 'btn', id: 'lang:en', label: 'Play in English', kind: 'primary', size: 34, minH: 112 },
        { t: 'btn', id: 'lang:vi', label: 'Chơi bằng tiếng Việt', kind: 'primary', size: 34, minH: 112 },
        { t: 'p', text: tr('langNote'), size: 22, center: true },
      ];
      {
        const rw = titleMenuW() - 48, lay = layoutDoc(ui.blocks, scale, rw);
        const tl = titleLayout(lay.height + 48);
        const ch = Math.min(lay.height + 48, tl.menu.h), cy = L.wide ? tl.menu.y + (tl.menu.h - ch) / 2 : tl.menu.y;
        ui.title = tl; ui.card = { x: tl.menu.x, y: cy, w: tl.menu.w, h: ch };
        ui.region = { x: tl.menu.x + 24, y: cy + 24, w: rw, h: ch - 48 };
      }
      break;
    }
    case 'title': {
      ui.kind = 'menu';
      const d = L.wide ? 0.72 : L.mode === 'compact' ? 0.8 : 1;
      const m = (n) => Math.round(n * d);
      const b = [];
      if (S.save) b.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: 32, sub: `${levelLabel(S, S.save.two ? 'two' : S.save.level)}`, minH: m(104) });
      const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
      b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.save ? 'normal' : 'primary', size: 36, sub: playSub, minH: m(S.save ? 92 : 118) });
      b.push({ t: 'btn', id: 'learn', label: tr('learnBtn'), size: 30, sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: m(96) });
      b.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: m(92) });
      b.push({ t: 'row', size: 28, minH: m(92), items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] });
      b.push({ t: 'row', size: 28, minH: m(92), items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] });
      b.push({ t: 'row', size: 26, minH: m(84), items: [{ id: 'lang:en', label: 'Play in English', kind: S.lang === 'en' ? 'on' : 'normal' }, { id: 'lang:vi', label: 'Chơi bằng tiếng Việt', kind: S.lang === 'vi' ? 'on' : 'normal' }] });
      ui.blocks = b;
      const lay = layoutDoc(b, scale, titleMenuW());
      ui.title = titleLayout(lay.height);
      ui.region = ui.title.menu;
      break;
    }
    case 'setup': {
      ui.panel = DOC_PANEL_NAV; ui.region = DOC_BODY_START;
      ui.fixed = [...fixedBar(S), { id: 'start', rect: START_BTN, kind: 'primary', label: tr('startGame'), size: 34 }];
      const b = [];
      const st = S.setup;
      b.push({ t: 'h', text: tr('opponentTitle'), size: 32 });
      const lvs = [...LEVELS.map((l) => ({ id: l.id, name: levelName(l.id) })), { id: 'two', name: tr('twoPlayers') }];
      for (let i = 0; i < lvs.length; i += 2) {
        b.push({ t: 'row', size: 28, minH: 84, items: lvs.slice(i, i + 2).map((l) => ({ id: `lv:${l.id}`, label: l.name, kind: st.level === l.id ? 'on' : 'normal' })) });
      }
      b.push({ t: 'p', text: st.level === 'two' ? tr('twoInfo') : levelBlurb(st.level), size: 24, gap: 10 });
      if (st.level !== 'two') {
        b.push({ t: 'h', text: tr('sideTitle'), size: 32 });
        b.push({ t: 'row', size: 26, minH: 84, items: [{ id: 'side:1', label: tr('first'), kind: st.side === 1 ? 'on' : 'normal' }, { id: 'side:2', label: tr('second'), kind: st.side === 2 ? 'on' : 'normal' }] });
      }
      b.push({ t: 'h', text: tr('rulesOptTitle'), size: 32 });
      b.push({ t: 'p', text: tr('mandValue'), size: 24, gap: 6 });
      b.push({ t: 'row', size: 28, minH: 84, items: [{ id: 'qv:10', label: tr('mandValueN', { n: 10 }), kind: st.qv === 10 ? 'on' : 'normal' }, { id: 'qv:5', label: tr('mandValueN', { n: 5 }), kind: st.qv === 5 ? 'on' : 'normal' }] });
      b.push({ t: 'p', text: tr('youngRule'), size: 24, gap: 6 });
      b.push({ t: 'row', size: 24, minH: 84, items: [{ id: 'young:1', label: tr('youngOn'), kind: st.young ? 'on' : 'normal' }, { id: 'young:0', label: tr('youngOff'), kind: !st.young ? 'on' : 'normal' }] });
      if (st.level !== 'two') {
        const rec = recOf(S, recKey(st));
        b.push({ t: 'p', text: `${tr('record')}: ${rec[0]} ${tr('wins')}  ${rec[1]} ${tr('draws')}  ${rec[2]} ${tr('losses')}`, size: 22, gap: 12 });
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
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${lessonText(l.id).title}`, kind: S.lessons[l.id] ? 'on' : 'normal', size: 28, sub: locked ? tr('locked') : S.lessons[l.id] ? tr('lessonDone') : undefined, disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? rulesPages() : howtoPages();
      const pi = Math.min(S.page[S.scene], pages.length - 1);
      const pg = pages[pi];
      ui.panel = DOC_PANEL_NAV; ui.region = DOC_BODY_NAV;
      ui.fixed = fixedBar(S);
      ui.nav = { label: `${pi + 1} / ${pages.length}`, prev: { id: 'prev', rect: NAV_PREV, label: tr('prev'), disabled: pi === 0, kind: 'normal', size: 26 }, next: { id: 'next', rect: NAV_NEXT, label: isRules || pi < pages.length - 1 ? tr('next') : tr('playBtn'), disabled: isRules && pi === pages.length - 1, kind: 'primary', size: 26 } };
      ui.scrollKey = `${S.scene}:${pi}`;
      const b = [{ t: 'h', text: pg.title, size: 40 }];
      if (pg.art) b.push({ t: 'img', name: pg.art, h: imgH(400, ui.region) });
      if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
      else b.push({ t: 'p', text: pg.body, size: 32 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'img', name: 'logo', h: imgH(300, ui.region) }];
      aboutSections().forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S);
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: tr('language'), size: 24, gap: 6 });
      b.push({ t: 'row', size: 26, items: [{ id: 'lang:en', label: 'Play in English', kind: S.lang === 'en' ? 'on' : 'normal' }, { id: 'lang:vi', label: 'Chơi bằng tiếng Việt', kind: S.lang === 'vi' ? 'on' : 'normal' }] });
      b.push({ t: 'p', text: tr('theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: th.id === 'lacquer' ? (S.lang === 'vi' ? 'Sơn mài và vàng' : th.name) : (S.lang === 'vi' ? 'Tre và ngọc' : th.name), kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
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
  if (ui.kind === 'card' && S.scene === 'lang') {
    ui.layout = layoutDoc(ui.blocks, scale, ui.region.w);
    ui.offY = 0;
    return ui;
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600);
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function overlayUi(S, scale) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: OVERLAY, scrollKey: `ov:${S.overlay}`, overlay: true };
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
    if (!(S.match && S.match.lesson)) b.push({ t: 'img', name: 'more', h: 44 });
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
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const x0 = OVERLAY.x + 24;
  if (L.wide) {
    // landscape: the message on the left, the buttons on the right
    const colW = Math.floor((OVERLAY.w - 72) / 2), ax = x0 + colW + 24;
    const body = layoutDoc(bodyBlocks, scale, colW);
    let sc = scale, act = layoutDoc(actBlocks, sc, colW);
    while (act.height > OVERLAY.h - 56 && sc > 0.55) { sc *= 0.9; act = layoutDoc(actBlocks, sc, colW); }
    const h = Math.min(OVERLAY.h, Math.max(300, Math.max(body.height, act.height) + 56));
    const y = Math.round(CARD.cy - h / 2);
    const actTop = y + Math.max(28, (h - act.height) / 2);
    ui.panel = { x: OVERLAY.x, y, w: OVERLAY.w, h };
    ui.region = { x: x0, y: y + 28, w: colW, h: h - 56 };
    ui.layout = body;
    ui.offY = Math.max(0, (ui.region.h - body.height) / 2);
    ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
      id: bt.id, rect: { x: ax + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
    })));
    return;
  }
  const innerW = OVERLAY.w - 48;
  const body = layoutDoc(bodyBlocks, scale, innerW);
  let sc = scale, act = layoutDoc(actBlocks, sc, innerW);
  while (act.height > OVERLAY.h * 0.62 && sc > 0.55) { sc *= 0.9; act = layoutDoc(actBlocks, sc, innerW); }
  const h = Math.min(OVERLAY.h, Math.max(Math.min(420, OVERLAY.h), body.height + act.height + 72));
  const y = Math.round(CARD.cy - h / 2);
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: OVERLAY.x, y, w: OVERLAY.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(Math.min(160, h - 80), h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  })));
}
