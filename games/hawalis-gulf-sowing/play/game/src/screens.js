// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi()
// with the same state, so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc, tw } from './ui.js';
import { howtoPages, rulesPages, aboutSections, tr, levelName, levelBlurb } from './content.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonText } from './lessons.js';
import { THEMES } from './art.js';
import { layoutNow, host } from './layout.js';
import { BW, BH } from './art.js';

export const DEMO_GAMES = 3;
export const THINK_STEPS = [2, 5, 8, 10];

export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const recKey = (setup) => `${setup.level}`;
export const recOf = (S, key) => S.stats[key] ?? [0, 0, 0];
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S, L) {
  const D = L.doc;
  return [
    { id: 'back', rect: D.back, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: D.zoomDec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: D.zoomInc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: D.pct, label: pctLabel(S), size: 28, static: true },
  ];
}

export function levelLabel(S, level) {
  if (level === 'two') return tr('twoPlayers');
  return levelName(level);
}

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx], L = layoutNow(scale), D = L.doc;
  const ui = { scale, L, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale, L);

  switch (S.scene) {
    case 'title': {
      const G = titleGeom(S, L, scale, 'title');
      ui.kind = 'menu'; ui.title = G; ui.region = G.region; ui.blocks = G.blocks;
      break;
    }
    case 'setup': {
      ui.panel = D.panelStart; ui.region = D.bodyStart;
      ui.fixed = [...fixedBar(S, L), { id: 'start', rect: D.start, kind: 'primary', label: tr('startGame'), size: 34 }];
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
      if (st.level !== 'two') {
        const rec = recOf(S, recKey(st));
        b.push({ t: 'p', text: `${tr('record')}: ${rec[0]} ${tr('wins')}  ${rec[1]} ${tr('draws')}  ${rec[2]} ${tr('losses')}`, size: 22, gap: 12 });
      }
      if (!L.land && L.h >= 1000 && scale < 2) b.push({ t: 'img', name: 'board', h: 400 });
      ui.blocks = b;
      break;
    }
    case 'learn': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, L);
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
      ui.panel = D.panelNav; ui.region = D.bodyNav;
      ui.fixed = fixedBar(S, L);
      ui.nav = { label: `${pi + 1} / ${pages.length}`, labelX: L.w / 2, labelY: D.navLabelY, prev: { id: 'prev', rect: D.prev, label: tr('prev'), disabled: pi === 0, kind: 'normal', size: 26 }, next: { id: 'next', rect: D.next, label: isRules || pi < pages.length - 1 ? tr('next') : tr('playBtn'), disabled: isRules && pi === pages.length - 1, kind: 'primary', size: 26 } };
      ui.scrollKey = `${S.scene}:${pi}`;
      const b = [{ t: 'h', text: pg.title, size: 40 }];
      if (pg.art && L.land && L.w >= 900) {
        // landscape: the illustration stays on the left while the text scrolls on the right
        const B = ui.region, aw = Math.round(Math.min(B.w * 0.42, 460)), ah = Math.min(B.h, Math.round((aw - 36) * BH / BW) + 120);
        ui.art = { name: pg.art, x: B.x, y: Math.round(B.y + (B.h - ah) / 2), w: aw, h: ah };
        ui.region = { x: B.x + aw + 24, y: B.y, w: B.w - aw - 24, h: B.h };
      } else if (pg.art) b.push({ t: 'img', name: pg.art, h: 400 });
      if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
      else b.push({ t: 'p', text: pg.body, size: 32 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, L);
      const b = [{ t: 'img', name: 'logo', h: 300 }];
      aboutSections().forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
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

// ---- title / language screens: hero (name, tagline, Arcforge lockup) + the attract board + the menu card, for portrait and landscape.
const LOCKUP_AR = 327 / 1200;
function menuBlocks(S, mf) {
  const m = (n) => Math.round(n * mf);
  const b = [];
  if (S.save) b.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: 32, sub: `${levelLabel(S, S.save.two ? 'two' : S.save.level)}`, minH: m(104) });
  const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
  b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.save ? 'normal' : 'primary', size: 36, sub: playSub, minH: m(S.save ? 92 : 118) });
  b.push({ t: 'btn', id: 'learn', label: tr('learnBtn'), size: 30, sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: m(96) });
  b.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: m(92) });
  b.push({ t: 'row', size: 28, minH: m(92), items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] });
  b.push({ t: 'row', size: 28, minH: m(92), items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] });
  return b;
}
// Returns { hero, board, region, panel, blocks }. Everything is computed from the live size, so rotating just re-flows it.
export function titleGeom(S, L, scale, kind) {
  const { w, h, ins, land } = L, lang = false, pad = 0;
  const mk = menuBlocks;
  const fit = (str, size, maxW, min = 40) => { let s = size; while (s > min && tw(str, s) > maxW) s -= 2; return s; };
  let region, panel = null, hero, cx, leftW, bottomLimit, availTop, availBottom;
  if (!land) {
    const tall = h >= 1450, ns = fit(tr('appName'), tall ? 130 : 104, w - 40, 56);
    const base = Math.max(tall ? 200 : 150, ins.t + (tall ? 112 : 92));
    cx = w / 2; leftW = w - 40 - 2 * Math.max(ins.l, ins.r);
    hero = { cx, nameSize: ns, nameY: base, subSize: 38, subY: base + Math.round(ns * 0.48), tagSize: 24 };
    hero.tagY = hero.subY + 38; hero.tagW = Math.min(660, w - 60);
    availTop = null; availBottom = h - ins.b - 24;
    region = { x: L.doc.cx + (lang ? 24 : 0), w: L.doc.cw - (lang ? 48 : 0) };
    panel = lang ? { x: L.doc.cx, w: L.doc.cw } : null;
  } else {
    const menuW = Math.max(420, Math.min(600, Math.round(w * 0.4))), colX = w - ins.r - 20 - menuW;
    const u = ins.back ? ins.back / 56 : 0, x0 = ins.l + 16, x1 = colX - 16;
    cx = (x0 + x1) / 2; leftW = x1 - x0;
    let ns = fit(tr('appName'), 104, leftW - 30, 56);
    const base = ins.t + 14 + Math.round(ns * 0.78);
    if (ins.back) { const bkR = ins.l + 8 * u + ins.back + 10; if (base - ns * 0.85 < ins.t + 8 * u + ins.back + 6 && cx - leftW / 2 < bkR) { leftW = Math.max(200, x1 - bkR); cx = x1 - leftW / 2; ns = fit(tr('appName'), 104, leftW - 30, 40); } }
    hero = { cx, nameSize: ns, nameY: base, subSize: 34, subY: base + 46, tagSize: 22 };
    hero.tagY = hero.subY + 34; hero.tagW = leftW - 30;
    availTop = ins.t + 16; availBottom = h - ins.b - 16;
    region = { x: colX + (lang ? 24 : 0), w: menuW - (lang ? 48 : 0) };
    panel = lang ? { x: colX, w: menuW } : null;
  }
  // the Arcforge lockup sits bottom-centre directly under the menu / language card: reserve its strip first
  const lw = Math.min(region.w, Math.max((land ? 0.28 : 0.35) * 720, 120 / Math.max(host.px, 1e-6))), lh = lw * LOCKUP_AR;
  availBottom -= lh + 22;
  const heroBottom = hero.tagY + 52;
  if (!land) availTop = heroBottom;
  const room = availBottom - availTop - 2 * pad;
  let blocks = null, lay = null;
  for (const mf of [1, 0.9, 0.8, 0.72, 0.62, 0.52]) {
    blocks = mk(S, mf); lay = layoutDoc(blocks, scale, region.w);
    if (lay.height <= room) break;
  }
  const rh = Math.min(room, Math.ceil(lay.height) + 8);
  if (!land) region.y = availBottom - pad - rh; else region.y = Math.round(availTop + pad + (room - rh) / 2);
  region.h = rh;
  if (lang) { panel.y = region.y - pad; panel.h = rh + 2 * pad; }
  hero.lockup = { cx: region.x + region.w / 2, y: Math.round((lang ? panel.y + panel.h : region.y + region.h) + 16), w: lw, h: lh };
  // the attract board: whatever room the hero and the menu leave (hidden when too small to read)
  let board = null;
  const bTop = heroBottom + 2, bBottom = land ? h - ins.b - 16 : (lang ? panel.y : region.y) - 12;   // landscape: the board owns the whole left column
  const space = bBottom - bTop;
  if (space >= 170) {
    const bh = Math.min(space, land ? 440 : 430, (leftW - 30) * BH / BW), bw = bh * BW / BH;
    board = { x: Math.round(cx - bw / 2), y: Math.round(bTop + (space - bh) / 2), w: Math.round(bw) };
  }
  return { hero, board, region, panel, blocks, heroBottom };
}

function overlayUi(S, scale, L) {
  const ui = { scale, L, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
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
    if (!(S.match && S.match.lesson)) b.push({ t: 'img', name: 'more', h: 34 });
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
  const O = L.overlay, innerW = O.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const body = layoutDoc(bodyBlocks, scale, innerW);
  // the buttons keep room for the body above them: on a short screen at big text they step down a size to fit
  let act = layoutDoc(actBlocks, scale, innerW);
  for (const ts of [1.5, 1.25, 1, 0.85, 0.7]) if (act.height > O.maxH - 56 - 8 - Math.min(body.height, 150) && ts < scale) act = layoutDoc(actBlocks, ts, innerW);
  const h = Math.min(O.maxH, Math.max(Math.min(420, O.maxH), body.height + act.height + 72));
  const y = Math.round(O.cy - h / 2);
  const x0 = O.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: O.x, y, w: O.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(40, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  })));
}
