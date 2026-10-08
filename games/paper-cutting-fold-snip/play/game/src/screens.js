// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi() with the same state,
// so layout and taps always agree at every text-zoom step.
import { LEVELS, CHAPTERS, TRADITIONS, levelsIn } from './levels.js';
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { HOWTO, RULES, ABOUT, tr } from './content.js';
import { layout } from './layout.js';

export const DEMO_CHAPTERS = 1;
export const UNLOCK_NEED = 3;
export const THINK_STEPS = [2, 5, 8, 10];
export const GALLERY_MAX = 12;

export const rec = (S, id) => S.progress.done[id] ?? null;
export const doneCount = (S, ch) => levelsIn(ch).filter((x) => rec(S, x.l.id)).length;
export const totalDone = (S) => LEVELS.filter((l) => rec(S, l.id)).length;
export const totalStars = (S) => LEVELS.reduce((s, l) => s + (rec(S, l.id)?.stars ?? 0), 0);
export const chapterOpen = (S, ch) => ch === 0 || S.dev || doneCount(S, ch - 1) >= Math.min(UNLOCK_NEED, levelsIn(ch - 1).length);
export const demoLocked = (S, idx) => S.demo && LEVELS[idx].ch >= DEMO_CHAPTERS;
export const levelLocked = (S, idx) => demoLocked(S, idx) || !chapterOpen(S, LEVELS[idx].ch);
export const traditionDone = (S, tid) => LEVELS.filter((l) => l.tradition === tid && rec(S, l.id)).length;
export function firstOpenLevel(S) {
  for (let i = 0; i < LEVELS.length; i++) if (!levelLocked(S, i) && !rec(S, LEVELS[i].id)) return i;
  return Math.min(S.levelIdx ?? 0, LEVELS.length - 1);
}

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S, D, backLabel = 'back') {
  const scale = TEXT_SCALES[S.textIdx];
  return [
    { id: 'back', rect: D.back, kind: 'normal', icon: 'back', label: tr(backLabel), size: 26 },
    { id: 'zoom-', rect: D.zoomDec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: D.zoomInc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: D.pct, label: pctLabel(S), size: 28, static: true, scale },
  ];
}

const levelCell = (S, i) => {
  const l = LEVELS[i], r = rec(S, l.id);
  return { id: `lvl:${i}`, label: l.name, idx: i, level: l, state: r ? 'done' : levelLocked(S, i) ? 'locked' : 'open', stars: r?.stars ?? 0 };
};

export function buildUi(S) {
  const T = tr;
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  const L = layout(), D = L.doc;

  if (S.overlay) return overlayUi(S, scale, L);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.region = L.title.menu;
      const b = [], th = Math.max(64, Math.min(92, L.tap));
      const playSub = S.demo ? T('demoLeft', { n: Math.max(0, levelsIn(0).length - totalDone(S)) }) : (totalDone(S) ? `${totalDone(S)} / ${LEVELS.length} · ${totalStars(S)} ★` : undefined);
      if (L.title.compact) {
        b.push({ t: 'btn', id: 'play', label: T('playBtn'), kind: 'primary', size: 34, sub: playSub, minH: th + 14 });
        b.push({ t: 'row', size: 26, minH: th, items: [{ id: 'studio', label: T('studioBtn'), disabled: S.demo }, { id: 'gallery', label: T('galleryBtn') }] });
        b.push({ t: 'row', size: 26, minH: th, items: [{ id: 'auto', label: T('autoBtn') }, { id: 'howto', label: T('howtoBtn') }] });
        b.push({ t: 'row', size: 26, minH: th, items: [{ id: 'rules', label: T('rulesBtn') }, { id: 'about', label: T('aboutBtn') }] });
        b.push({ t: 'btn', id: 'settings', label: T('settingsBtn'), size: 26, minH: th - 6 });
        b.push({ t: 'img', name: 'lockup', id: 'arcforge', h: 78, hitW: 250 });
      } else {
        b.push({ t: 'btn', id: 'play', label: T('playBtn'), kind: 'primary', size: 36, sub: playSub, minH: 118 });
        b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'studio', label: T('studioBtn'), disabled: S.demo }, { id: 'gallery', label: T('galleryBtn') }] });
        b.push({ t: 'btn', id: 'auto', label: T('autoBtn'), size: 30, minH: 92 });
        b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'howto', label: T('howtoBtn') }, { id: 'rules', label: T('rulesBtn') }] });
        b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'about', label: T('aboutBtn') }, { id: 'settings', label: T('settingsBtn') }] });
        b.push({ t: 'img', name: 'lockup', id: 'arcforge', h: 78, hitW: 250 });
      }
      ui.blocks = b;
      break;
    }
    case 'levels': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      const base = scale <= 1 ? 2 : 1;
      const cols = Math.max(1, Math.min(5, Math.round(base * D.body.w / 340)));
      const b = [];
      b.push({ t: 'p', text: `${T('finished')[0].toUpperCase()}${T('finished').slice(1)}: ${totalDone(S)} / ${LEVELS.length}    ${T('stars')}: ${totalStars(S)} / ${LEVELS.length * 3}`, size: 24, gap: 12 });
      CHAPTERS.forEach((c, ci) => {
        const items = levelsIn(ci);
        if (!items.length) return;
        const open = chapterOpen(S, ci) && !(S.demo && ci >= DEMO_CHAPTERS);
        b.push({ t: 'h', text: `${ci + 1}. ${c.name}`, size: 30 });
        b.push({ t: 'p', text: open ? `${c.blurb}  (${doneCount(S, ci)}/${items.length})` : (S.demo && ci >= DEMO_CHAPTERS ? 'Full game only.' : T('locked')), size: 22, gap: 10 });
        b.push({ t: 'grid', cols, aspect: 1.12, cells: items.map(({ i }) => levelCell(S, i)) });
        b.push({ t: 'gap', h: 14 });
      });
      ui.blocks = b;
      break;
    }
    case 'gallery': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      const base = scale <= 1 ? 2 : 1;
      const cols = Math.max(1, Math.min(5, Math.round(base * D.body.w / 340)));
      const b = [];
      b.push({ t: 'h', text: T('traditions'), size: 34 });
      for (const tr0 of TRADITIONS) {
        const ls = LEVELS.map((l, i) => ({ l, i })).filter((x) => x.l.tradition === tr0.id);
        if (!ls.length) continue;
        b.push({ t: 'h', text: `${tr0.name} · ${tr0.place}`, size: 28 });
        b.push({ t: 'p', text: tr0.blurb, size: 23, gap: 10 });
        if (!traditionDone(S, tr0.id)) b.push({ t: 'p', text: T('solveToSee'), size: 21, gap: 8 });
        const done = ls.filter(({ l }) => rec(S, l.id));
        if (done.length) b.push({ t: 'grid', cols, aspect: 1.08, cells: done.map(({ i }) => ({ ...levelCell(S, i), id: `gview:${i}`, state: 'done', stars: 0, noStars: true })) });
        b.push({ t: 'gap', h: 10 });
      }
      b.push({ t: 'h', text: `${T('myCutouts')} (${S.gallery.length}/${GALLERY_MAX})`, size: 34 });
      if (!S.gallery.length) b.push({ t: 'p', text: T('emptyGallery'), size: 23 });
      else b.push({ t: 'grid', cols, aspect: 1.08, cells: S.gallery.map((g, i) => ({ id: `gal:${i}`, label: `#${i + 1}`, saved: g, state: 'done', stars: 0, noStars: true })) });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES : HOWTO;
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      ui.scrollKey = S.scene;
      const b = [];
      pages.forEach((pg, pi) => {
        b.push({ t: 'h', text: isRules ? `${pi + 1}. ${pg.title}` : `${pi + 1} / ${pages.length}  ${pg.title}`, size: pi === 0 ? 38 : 34 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: isRules ? 300 : 330 });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 28 });
        else b.push({ t: 'p', text: pg.body, size: 31 });
        b.push({ t: 'gap', h: 26 });
      });
      if (!isRules) b.push({ t: 'btn', id: 'play', label: T('playBtn'), kind: 'primary', size: 30 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      const b = [{ t: 'img', name: 'logo', h: 250 }];
      ABOUT.forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 36 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      const b = [];
      b.push({ t: 'h', text: T('settings'), size: 36 });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? T('soundOn') : T('soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: `${T('thinkTime')}: ${THINK_STEPS[S.thinkIdx]}${T('seconds')}`, size: 24, gap: 6 });
      b.push({ t: 'row', size: 30, items: [{ id: 'set:think-', label: '-', disabled: S.thinkIdx === 0 }, { id: 'set:think+', label: '+', disabled: S.thinkIdx === THINK_STEPS.length - 1 }] });
      if (!S.demo) {
        if (S.owns) b.push({ t: 'p', text: T('owned'), size: 24 });
        else b.push({ t: 'btn', id: 'set:unlock', label: S.price ? `${T('unlock')} · ${S.price}` : T('unlock'), kind: 'primary', size: 28 });
        b.push({ t: 'btn', id: 'set:restore', label: T('restore'), size: 26 });
      }
      b.push({ t: 'btn', id: 'set:reset', label: S.resetArm ? T('resetConfirm') : T('resetProgress'), kind: 'danger', size: 26 });
      ui.blocks = b;
      break;
    }
    case 'demo-limit': {
      ui.kind = 'card';
      ui.blocks = [
        { t: 'img', name: 'lock', h: 180 },
        { t: 'h', text: T('demoLimitTitle'), size: 32 },
        { t: 'p', text: T('demoLimitBody'), size: 26 },
        { t: 'btn', id: 'auto', label: T('autoBtn'), kind: 'primary', size: 28 },
        { t: 'btn', id: 'menu', label: T('quitMenu'), size: 28 },
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

function overlayUi(S, scale, L) {
  const T = tr;
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.72 : n);
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: T('paused'), size: hs(40) });
    b.push({ t: 'btn', id: 'ov:resume', label: T('resume'), kind: 'primary', size: 30 });
    if (S.scene === 'play' && S.play && S.play.mode !== 'view') b.push({ t: 'btn', id: 'ov:restart', label: T('restartLevel'), size: 28 });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? T('soundOn') : T('soundOff'), kind: S.sound ? 'on' : 'normal', size: 26 });
    b.push({ t: 'btn', id: 'ov:levels', label: S.play && S.play.mode === 'studio' ? T('quitMenu') : T('levels'), size: 28 });
    if (S.dev && S.scene === 'play' && S.play && S.play.mode === 'level') b.push({ t: 'btn', id: 'ov:devsolve', label: 'Dev: solve now', size: 24 });
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: T('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: T('autoSummary'), size: 26 });
    b.push({ t: 'btn', id: 'ov:autoagain', label: T('autoAgain'), kind: 'primary', size: 28 });
    b.push({ t: 'btn', id: 'ov:autoexit', label: T('autoExit'), size: 28 });
  }
  ui.blocks = b;
  fitCard(ui, scale, L);
  return ui;
}

export function fitCard(ui, scale, L) {
  const O = L.overlay, innerW = O.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn');
  const body = layoutDoc(bodyBlocks, scale, innerW);
  const act = layoutDoc(actBlocks, scale, innerW);
  const h = Math.min(O.maxH, Math.max(Math.min(420, O.maxH), body.height + act.height + 72));
  const y = Math.round(O.cy - h / 2);
  const x0 = O.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: O.x, y, w: O.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(80, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: it.b.kind ?? 'normal', lines: it.lines, size: it.size, line: it.line, disabled: bt.disabled,
  })));
}
