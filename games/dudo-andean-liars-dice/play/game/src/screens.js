// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi() with the same state,
// so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { HOWTO, RULES, ABOUT, tr } from './content.js';
import { LEVELS } from './ai.js';
import { LESSONS, optLabel, lText } from './lessons.js';
import { THEMES } from './art.js';
import { docRects, menuArea, lockupSize, overlayRect, overlayMaxH, overlayCy, frame, host } from './layout.js';

export const DEMO_GAMES = 3;
export const THINK_STEPS = [2, 5, 8, 10];
export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;
export const MAX_PLAYERS = 6;

export const recKey = (lv) => `lv:${lv}`;
const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;
export const levelName = (i) => LEVELS[i]?.name ?? '';
export const setupLevelLabel = (S) => (S.setup.level === 'mixed' ? tr('mixed') : levelName(S.setup.level));

// Players for a match from the setup card. Computer names are the level names, numbered when two share a level.
export function specsFromSetup(setup, lang) {
  const out = [];
  for (let i = 0; i < setup.humans; i++) out.push({ name: setup.humans === 1 ? tr('youWord') : `${lang === 'es' ? 'Jugador' : 'Player'} ${i + 1}`, kind: 'human', level: 0 });
  const cnt = {};
  for (let i = 0; i < setup.cpus; i++) {
    const lv = setup.level === 'mixed' ? [2, 3, 1, 4, 0][i % 5] : setup.level;
    cnt[lv] = (cnt[lv] ?? 0) + 1;
    out.push({ name: levelName(lv), kind: 'cpu', level: lv });
  }
  const seen = {};
  for (const s of out) if (s.kind === 'cpu') { const total = out.filter((o) => o.name === s.name).length; seen[s.name] = (seen[s.name] ?? 0) + 1; if (total > 1) s.name = `${s.name} ${seen[s.name]}`; }
  return out;
}
export const AUTO_SPECS = [
  { name: 'Yachay', kind: 'cpu', level: 2 }, { name: 'Amauta', kind: 'cpu', level: 3 }, { name: 'Kuntur', kind: 'cpu', level: 4 },
];

function fixedBar(S, d) {
  return [
    { id: 'back', rect: d.back, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: d.dec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: d.inc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: d.pct, label: pctLabel(S), size: 28, static: true },
  ];
}
const langRow = (S, size = 26, minH = 80) => ({ t: 'row', size, minH, items: [{ id: 'lang:en', label: 'Play in English', kind: S.lang === 'en' ? 'on' : 'normal' }, { id: 'lang:es', label: 'Jugar en español', kind: S.lang === 'es' ? 'on' : 'normal' }] });

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      const A = menuArea(), F = frame();
      const mk = (m, paired) => {
        const b = [];
        if (S.save) b.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: 32, sub: saveLabel(S), minH: 104 * m });
        const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
        b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.save ? 'normal' : 'primary', size: 36, sub: playSub, minH: (S.save ? 92 : 118) * m });
        if (paired) b.push({ t: 'row', size: 28, minH: 92 * m, items: [{ id: 'learn', label: tr('learnBtn') }, { id: 'auto', label: tr('autoBtn') }] });
        else {
          b.push({ t: 'btn', id: 'learn', label: tr('learnBtn'), size: 30, sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: 96 * m });
          b.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: 92 * m });
        }
        b.push({ t: 'row', size: 28, minH: 92 * m, items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] });
        b.push({ t: 'row', size: 28, minH: 92 * m, items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] });
        b.push(langRow(S, 24, 80 * m));
        return b;
      };
      const availH = A.cols ? A.bottom - A.top : A.bottom - A.minTop;
      const tries = A.cols ? [[1, true], [0.9, true], [0.8, true], [0.7, true]] : [[1, false], [1, true], [0.85, true], [0.7, true], [0.6, true]];
      let pick = null;
      for (const [m, paired] of tries) {
        const blocks = mk(m, paired), lay = layoutDoc(blocks, scale, A.w);
        pick = { blocks, lay };
        if (lay.height <= availH) break;
      }
      ui.blocks = pick.blocks;
      if (A.cols) { ui.region = { x: A.x, y: A.top, w: A.w, h: A.bottom - A.top }; ui.art = A.art; }
      else {
        const h = Math.min(pick.lay.height, A.bottom - A.minTop);
        ui.region = { x: A.x, y: A.bottom - h, w: A.w, h };
        ui.art = { x: F.U.x0, y: F.U.y0, w: F.U.w, h: ui.region.y - F.U.y0 - 6 };
      }
      break;
    }
    case 'setup': {
      const d = docRects('start'); ui.panel = d.panel; ui.region = d.body;
      ui.fixed = [...fixedBar(S, d), { id: 'start', rect: d.start, kind: 'primary', label: tr('startGame'), size: 34 }];
      const b = [];
      const st = S.setup;
      b.push({ t: 'h', text: tr('humansTitle'), size: 32 });
      b.push({ t: 'row', size: 28, minH: 84, items: [1, 2, 3, 4].map((n) => ({ id: `hum:${n}`, label: String(n), kind: st.humans === n ? 'on' : 'normal' })) });
      b.push({ t: 'h', text: tr('cpusTitle'), size: 32 });
      const lo = st.humans === 1 ? 1 : 0, hi = MAX_PLAYERS - st.humans;
      const cpuItems = [0, 1, 2, 3, 4, 5].map((n) => ({ id: `cpu:${n}`, label: String(n), kind: st.cpus === n ? 'on' : 'normal', disabled: n < lo || n > hi }));
      if (ui.region.w >= 800) b.push({ t: 'row', size: 28, minH: 84, items: cpuItems });
      else { b.push({ t: 'row', size: 28, minH: 84, items: cpuItems.slice(0, 3) }); b.push({ t: 'row', size: 28, minH: 84, items: cpuItems.slice(3) }); }
      if (st.cpus > 0) {
        b.push({ t: 'h', text: tr('levelTitle'), size: 32 });
        const lvItems = [...LEVELS.map((l) => ({ id: `lv:${l.n}`, label: l.name, kind: st.level === l.n ? 'on' : 'normal' })), { id: 'lv:mixed', label: tr('mixed'), kind: st.level === 'mixed' ? 'on' : 'normal' }];
        const per = ui.region.w >= 800 ? 3 : 2;
        for (let i = 0; i < lvItems.length; i += per) b.push({ t: 'row', size: 28, minH: 84, items: lvItems.slice(i, i + per) });
        const info = st.level === 'mixed' ? LEVELS.map((l) => l.name).join(', ') : (S.lang === 'es' ? LEVELS[st.level].blurbEs : LEVELS[st.level].blurb);
        b.push({ t: 'p', text: info, size: 24, gap: 10 });
      }
      b.push({ t: 'p', text: tr('lvLine', { h: st.humans, c: st.cpus }), size: 24, gap: 6 });
      if (st.humans >= 2) b.push({ t: 'p', text: tr('passNote'), size: 22, gap: 10 });
      if (st.humans === 1 && st.cpus > 0 && st.level !== 'mixed') {
        const r = S.stats[recKey(st.level)] ?? [0, 0];
        b.push({ t: 'p', text: tr('stats', { name: levelName(st.level), w: r[0], l: r[1] }), size: 22, gap: 12 });
      }
      ui.blocks = b;
      break;
    }
    case 'learn': {
      { const d = docRects('plain'); ui.panel = d.panel; ui.region = d.body; ui.fixed = fixedBar(S, d); }
      const b = [{ t: 'h', text: tr('lessonsTitle'), size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSONS.length}`, size: 24, gap: 10 }];
      LESSONS.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${lText(l.title)}`, kind: S.lessons[l.id] ? 'on' : 'normal', size: 28, sub: locked ? tr('locked') : S.lessons[l.id] ? tr('lessonDone') : undefined, disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'lesson': {
      { const d = docRects('plain'); ui.panel = d.panel; ui.region = d.body; ui.fixed = fixedBar(S, d); }
      const L = LESSONS[S.lq.i], q = L.qs[S.lq.q], picked = S.lq.picked;
      const b = [{ t: 'h', text: lText(L.title), size: 34 }, { t: 'p', text: tr('lessonQ', { a: S.lq.q + 1, b: L.qs.length }), size: 22, gap: 8 }];
      if (q.hand || q.total) b.push({ t: 'img', name: 'quiz', h: q.hand && (q.prevB || q.total) ? 230 : 150, data: { hand: q.hand, prev: q.prevB, total: q.total, pal: q.pal } });
      b.push({ t: 'p', text: lText(q.ask), size: 28 });
      q.opts.forEach((o, i) => {
        let kind = 'normal';
        if (picked >= 0) kind = i === q.ans ? 'on' : i === picked ? 'danger' : 'normal';
        b.push({ t: 'btn', id: picked >= 0 ? null : `ans:${i}`, label: optLabel(o), kind, size: 28, minH: 84 });
      });
      if (picked >= 0) {
        b.push({ t: 'h', text: picked === q.ans ? tr('lessonRight') : tr('lessonWrong'), size: 30 });
        b.push({ t: 'p', text: lText(q.why), size: 26 });
        const last = S.lq.q + 1 >= L.qs.length;
        b.push({ t: 'btn', id: last ? 'lq:done' : 'lq:next', label: last ? tr('lessonFinish') : tr('next'), kind: 'primary', size: 30 });
      }
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES() : HOWTO();
      const d = docRects(isRules ? 'plain' : 'start'); ui.panel = d.panel; ui.region = d.body;
      ui.fixed = fixedBar(S, d);
      if (!isRules) ui.fixed.push({ id: 'play', rect: d.start, kind: 'primary', label: tr('playBtn'), size: 34 });
      // One continuous scrolling reader: every section in order, each with its title and illustration.
      const b = [];
      ui.pageStart = [];
      pages.forEach((pg, i) => {
        ui.pageStart.push(b.length);
        b.push({ t: 'h', text: pg.title, size: i === 0 ? 40 : 36 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: isRules ? 360 : 380 });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
        else b.push({ t: 'p', text: pg.body, size: 32, gap: 30 });
      });
      ui.blocks = b;
      break;
    }
    case 'about': {
      { const d = docRects('plain'); ui.panel = d.panel; ui.region = d.body; ui.fixed = fixedBar(S, d); }
      const b = [{ t: 'img', name: 'logo', h: 250 }];
      ABOUT().forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      { const d = docRects('plain'); ui.panel = d.panel; ui.region = d.body; ui.fixed = fixedBar(S, d); }
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: tr('language'), size: 24, gap: 6 });
      b.push(langRow(S, 26));
      b.push({ t: 'p', text: tr('theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: S.lang === 'es' ? th.es : th.name, kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
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
      const short = frame().U.h < 900;
      const zs = (n) => (scale >= 2 ? n * 0.5 : n);
      ui.blocks = [
        { t: 'img', name: 'lock', h: scale >= 2 || short ? 90 : 180 },
        { t: 'h', text: tr('demoLimitTitle'), size: zs(32) },
        { t: 'p', text: tr('demoLimitBody'), size: zs(26) },
        { t: 'btn', id: 'auto', label: tr('autoBtn'), kind: 'primary', size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : short ? 80 : 84 },
        { t: 'btn', id: 'menu', label: tr('quitMenu'), size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : short ? 80 : 84 },
      ];
      fitCard(ui, scale);
      return ui;
    }
    default:
      ui.kind = 'none';
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600);
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  if (ui.kind === 'menu') {
    // Arcforge lockup: bottom centre, directly under the last menu row; tapping it opens the Arcforge home (>= 44 css px zone).
    const lk = lockupSize(), r = ui.region, cx = r.x + r.w / 2, y = Math.min(r.y + ui.offY + ui.layout.height + 12, r.y + r.h + 8), pxs = Math.max(0.2, host.px || 0.6);
    const m = 44 / pxs, tw = Math.max(lk.w + 24, m), th = Math.max(lk.h + 12, m);
    ui.lock = { x: cx - lk.w / 2, y, w: lk.w, h: lk.h };
    ui.fixed = [...ui.fixed, { id: 'arcforge', rect: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, lk.h + 8) }, lockup: ui.lock }];
  }
  return ui;
}

function saveLabel(S) {
  const sv = S.save;
  const hum = sv.specs.filter((s) => s.kind === 'human').length, cpu = sv.specs.length - hum;
  return `${hum > 1 ? tr('nPeople', { n: hum }) : tr('onePerson')} + ${cpu} · ${tr('roundN', { n: sv.snap.round })}`;
}

function overlayUi(S, scale0) {
  const scale = frame().U.h < 900 ? Math.min(scale0, 1.5) : scale0;   // short screens: the card keeps room for its buttons
  const OV = overlayRect();
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: OV, scrollKey: `ov:${S.overlay}`, overlay: true };
  ui.region = { x: OV.x + 24, y: OV.y + 24, w: OV.w - 48, h: OV.h - 48 };
  const short = frame().U.h < 900;                 // landscape / squat screens: pair the buttons so the card fits
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.72 : n);
  const ps = (n) => (scale >= 2 ? n * 0.62 : n);
  const bs = (n) => (scale >= 2 ? n * 0.7 : n);
  const bmin = scale >= 2 ? 56 : short ? 80 : 84;
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: tr('paused'), size: hs(40) });
    b.push({ t: 'p', text: `${tr('textSize')}: ${pctLabel(S)}`, size: ps(22), center: true, gap: 4 });
    b.push({ t: 'btn', id: 'ov:resume', label: tr('resume'), kind: 'primary', size: bs(30), minH: bmin });
    const snd = { id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal' };
    if (short) b.push({ t: 'row', size: bs(26), minH: bmin, items: [{ id: 'ov:restart', label: tr('restart') }, snd] });
    else {
      b.push({ t: 'btn', id: 'ov:restart', label: tr('restart'), size: bs(28), minH: bmin });
      b.push({ t: 'btn', ...snd, size: bs(26), minH: bmin });
    }
    b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
    b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
  } else if (S.overlay === 'end') {
    const e = S.endInfo ?? { head: '', body: '', rec: '' };
    b.push({ t: 'h', text: e.head, size: hs(40) });
    b.push({ t: 'img', name: 'endmark', h: scale >= 2 || short ? 90 : 150, data: e });
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (e.rec) b.push({ t: 'p', text: e.rec, size: ps(22), center: true });
    b.push({ t: 'btn', id: 'ov:again', label: tr('again'), kind: 'primary', size: bs(30), minH: bmin });
    if (short) b.push({ t: 'row', size: bs(26), minH: bmin, items: [{ id: 'ov:setup', label: tr('newSetup') }, { id: 'ov:menu', label: tr('quitMenu') }] });
    else {
      b.push({ t: 'btn', id: 'ov:setup', label: tr('newSetup'), size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
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
  const OV = overlayRect(), innerW = OV.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const body = layoutDoc(bodyBlocks, scale, innerW);
  const act = layoutDoc(actBlocks, scale, innerW);
  const maxH = overlayMaxH();
  const h = Math.min(maxH, Math.max(Math.min(420, maxH), body.height + act.height + 72));
  const y = Math.round(overlayCy() - h / 2);
  const x0 = OV.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: OV.x, y, w: OV.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(160, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  })));
}
