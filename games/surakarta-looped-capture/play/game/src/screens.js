// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi()
// with the same state, so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { HOWTO, RULES, ABOUT, tr } from './content.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { THEMES } from './art.js';
import { layoutFor } from './layout.js';

export const DEMO_GAMES = 3;
export const THINK_STEPS = [2, 5, 8, 10];

export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const recOf = (S, level) => S.stats[level] ?? [0, 0, 0];
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S, d) {
  return [
    { id: 'back', rect: d.back, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: d.dec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: d.inc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: d.pct, label: pctLabel(S), size: 28, static: true },
  ];
}

export function levelLabel(S) {
  if (S.setup.level === 'two') return tr('twoPlayers');
  return LEVELS.find((l) => l.id === S.setup.level)?.name ?? '';
}

export function buildUi(S, L = S.L ?? layoutFor()) {
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale, L);
  const dP = L.doc.plain, dN = L.doc.nav, dS = L.doc.start, ik = dP.imgK;

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.region = L.menu.region;
      const k = L.menu.k, z = (n) => n * k;
      const b = [];
      if (S.save) b.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: z(32), sub: S.save.two ? tr('twoPlayers') : LEVELS.find((l) => l.id === S.save.level)?.name ?? '', minH: z(104) });
      const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
      b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.save ? 'normal' : 'primary', size: z(36), sub: playSub, minH: z(S.save ? 92 : 118) });
      b.push({ t: 'btn', id: 'learn', label: tr('learnBtn'), size: z(30), sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: z(96) });
      b.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: z(30), minH: z(92) });
      b.push({ t: 'row', size: z(28), minH: z(92), items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] });
      b.push({ t: 'row', size: z(28), minH: z(92), items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] });
      ui.blocks = b;
      break;
    }
    case 'setup': {
      ui.panel = dS.panel; ui.region = dS.body;
      ui.fixed = [...fixedBar(S, dS), { id: 'start', rect: dS.start, kind: 'primary', label: tr('startGame'), size: 34 }];
      const b = [];
      const lv = S.setup.level;
      b.push({ t: 'h', text: tr('opponentTitle'), size: 34 });
      const rows = [[LEVELS[0], LEVELS[1]], [LEVELS[2], LEVELS[3]], [LEVELS[4], { id: 'two', name: tr('twoPlayers') }]];
      for (const r of rows) {
        b.push({ t: 'row', size: 28, minH: 84, items: r.map((l) => ({ id: `lv:${l.id}`, label: l.name, kind: lv === l.id ? 'on' : 'normal' })) });
      }
      const lvInfo = lv === 'two' ? 'Two players share the phone. Light moves first from the bottom.' : LEVELS.find((l) => l.id === lv).blurb;
      b.push({ t: 'p', text: lvInfo, size: 24, gap: 10 });
      if (lv !== 'two') {
        b.push({ t: 'h', text: tr('sideTitle'), size: 34 });
        b.push({ t: 'row', size: 28, minH: 84, items: [{ id: 'side:1', label: tr('playLight'), kind: S.setup.side === 1 ? 'on' : 'normal' }, { id: 'side:2', label: tr('playDark'), kind: S.setup.side === 2 ? 'on' : 'normal' }] });
        const rec = recOf(S, lv);
        b.push({ t: 'p', text: `${tr('record')} (${levelLabel(S)}): ${rec[0]}${tr('wins')} ${rec[1]}${tr('draws')} ${rec[2]}${tr('losses')}`, size: 22, gap: 12 });
      }
      b.push({ t: 'img', name: 'setupart', h: Math.round(330 * ik) });
      ui.blocks = b;
      break;
    }
    case 'learn': {
      ui.panel = dP.panel; ui.region = dP.body;
      ui.fixed = fixedBar(S, dP);
      const b = [{ t: 'h', text: tr('lessonsTitle'), size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSONS.length}`, size: 24, gap: 10 }];
      LESSONS.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${l.title}`, kind: S.lessons[l.id] ? 'on' : 'normal', size: 28, sub: locked ? tr('locked') : S.lessons[l.id] ? tr('lessonDone') : undefined, disabled: locked, minH: 92 });
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
      ui.panel = dP.panel; ui.region = dP.body;
      ui.fixed = fixedBar(S, dP);
      ui.scrollKey = S.scene;
      const b = [];
      pages.forEach((pg, i) => {
        b.push({ t: 'h', text: pg.title, size: i === 0 ? 40 : 34 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: Math.round((isRules ? 400 : 420) * ik) });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
        else b.push({ t: 'p', text: pg.body, size: 32 });
      });
      if (!isRules) b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: 'primary', size: 28, minH: 90 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = dP.panel; ui.region = dP.body;
      ui.fixed = fixedBar(S, dP);
      const b = [{ t: 'img', name: 'logo', h: Math.round(330 * ik) }];
      ABOUT.forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = dP.panel; ui.region = dP.body;
      ui.fixed = fixedBar(S, dP);
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: tr('theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: th.name, kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:threats', label: S.threats ? tr('threatsOn') : tr('threatsOff'), kind: S.threats ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: `${tr('thinkTime')}: ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}`, size: 24, gap: 6 });
      b.push({ t: 'row', size: 30, items: [{ id: 'set:think-', label: '-', disabled: S.thinkIdx === 0 }, { id: 'set:think+', label: '+', disabled: S.thinkIdx === THINK_STEPS.length - 1 }] });
      b.push({ t: 'p', text: tr('language'), size: 24, gap: 6 });
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
        { t: 'img', name: 'lock', h: scale >= 2 || L.overlay.kc < 1 ? 90 : 180 },
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
  // the title menu sits flush above the lockup (no gap between the last button row and the lockup)
  ui.offY = ui.kind === 'menu' ? Math.max(0, ui.region.h - ui.layout.height - 4) : 0;
  return ui;
}

function overlayUi(S, scale, L) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
  const b = [];
  const kc = L.overlay.kc, kk = 0.5 + 0.5 * kc;   // short (landscape) screens: a little smaller text, shorter buttons
  const hs = (n) => (scale >= 2 ? n * 0.72 : n) * kk;
  const ps = (n) => Math.max(20, (scale >= 2 ? n * 0.62 : n) * kk);
  const bs = (n) => Math.max(20, (scale >= 2 ? n * 0.7 : n) * kk);
  const bmin = (scale >= 2 ? 56 : 84) * kc;
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
    if (S.match && S.match.lesson) {
      if (e.lessonOk) b.push({ t: 'btn', id: 'ov:lessonnext', label: tr('lessonNext'), kind: 'primary', size: bs(30), minH: bmin });
      else b.push({ t: 'btn', id: 'ov:lessonagain', label: tr('lessonRetry'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: tr('lessonList'), size: bs(28), minH: bmin });
    } else {
      b.push({ t: 'btn', id: 'ov:again', label: tr('again'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:setup', label: tr('newSetup'), size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
      ui.foot = true;
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
  const ov = L.overlay, innerW = ov.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const body = layoutDoc(bodyBlocks, scale, innerW);
  // short screens at big text: shrink the buttons (never below the 100% size) so every one stays inside the card
  let act = layoutDoc(actBlocks, scale, innerW);
  for (let sc = scale; sc > 1 && act.height > ov.maxH - 72 - Math.min(body.height, 150); ) { sc = Math.max(1, sc - 0.25); act = layoutDoc(actBlocks, sc, innerW); }
  const foot = ui.foot ? 40 : 0;
  const h = Math.min(ov.maxH, Math.max(420 * ov.kc, body.height + act.height + 72 + foot));
  const y = Math.round(ov.cy - h / 2);
  const x0 = Math.round(ov.cx - ov.w / 2) + 24;
  const actTop = y + h - 28 - foot - act.height;
  ui.panel = { x: x0 - 24, y, w: ov.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(100, h - 56 - foot - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  })));
}
