// Badminton Rally: the game shell. Scenes, swipe / keyboard controls, persistence, tournament, preview wiring, Watch & Learn.
// The match itself lives in sim.js; the 3D picture is drawn by view3d/ from the sim state.
import { createSim } from './sim.js';
import { W, H, TEXT_SCALES, THINK_STEPS, inRect, hudLayout, layoutFor, setViewport, fitFor } from './layout.js';
import { setPress, UI } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, renderThink, watchHit, guideInfo } from './hud.js';
import { LEVELS, LENGTHS, RIVALS, ROUND_NAMES, TOURNEY_TARGET, TOURNEY_CAP, KITS } from './consts.js';
import { classifySwipe, SWIPE } from './shots.js';
import { setMode, setAspect, fitCamera, setCamera, swipeToCourt, projectL } from './camera.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_GAME_CAP = 2;
const SAVE_VERSION = 1;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const QUICK_LOOKS = [null,
  { female: false, skin: 'light', hair: 'ginger', kit: { top: '#c2252b', bottoms: '#2a2a33', socks: '#f3f3f3' }, racket: 0xe8892f },
  { female: true, skin: 'tan', hair: 'black', kit: { top: '#e8892f', bottoms: '#ffffff', socks: '#f3f3f3' }, racket: 0xf2c230 },
  { female: false, skin: 'brown', hair: 'black', kit: { top: '#d6402f', bottoms: '#7a1d14', socks: '#f3f3f3' }, racket: 0xe8892f },
  { female: true, skin: 'light', hair: 'blond', kit: { top: '#b0182c', bottoms: '#f3f3f3', socks: '#f3f3f3' }, racket: 0xd6402f },
  { female: false, skin: 'deep', hair: 'black', kit: { top: '#7a45c2', bottoms: '#2a2036', socks: '#f3f3f3' }, racket: 0xc9356e }];

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false, layVer: 0,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, kitIdx: 0, female: false },
    setup: { opp: 3, len: 'to11', watch: false, watchA: 3, lastMode: 'ai' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    saved: null, record: { demoMatches: 0, matchWins: 0, rallyBest: 0 }, tour: null, tourMatch: false,
    sim: null, paused: false, pauseMenu: false, think: null, thinkRects: null, hintShow: null, names: ['You', 'Computer'], oppSub: '', roundName: '', gameLog: [], newBest: false,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0, trail: null, swipeLive: null, cfgAiNear: false, resultAt: 0,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, evSeen = 0, snap = null, simRng = rng.fork();

  // ---- persistence ----------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('record', G.record); storage.set('setup', { opp: G.setup.opp, len: G.setup.len, watchA: G.setup.watchA }); };
  const saveTour = () => storage.set('tour', G.tour);
  const metaOfSave = (d) => ({ oppName: d.oppName, score: d.score, gamesTotal: d.gamesTotal, gameNo: d.gameNo });
  const validSave = (d) => d && d.v === SAVE_VERSION && Array.isArray(d.score) && Array.isArray(d.games) && d.cfg && typeof d.gameNo === 'number';
  const persistMatch = () => {
    if (!S || G.mode !== 'ai' || S.s.phase === 'over') return;
    const s = S.s;
    const d = { v: SAVE_VERSION, cfg: G.curCfg, score: [...s.score], games: [...s.games], gameNo: s.gameNo, server: s.server, gamesTotal: s.gamesTotal, oppName: G.names[1], tour: G.tourMatch, gameLog: G.gameLog };
    snap = d; G.saved = metaOfSave(d); storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };

  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('match', null), storage.get('setup', null), storage.get('tour', null)]).then(([st, r, mch, su, tr]) => {
    if (st) Object.assign(G.settings, st);
    if (r) Object.assign(G.record, r);
    if (su) { if (su.opp >= 1 && su.opp <= 5) G.setup.opp = su.opp; if (LENGTHS[su.len]) G.setup.len = su.len; if (su.watchA >= 1 && su.watchA <= 5) G.setup.watchA = su.watchA; }
    if (validSave(mch)) { snap = mch; G.saved = metaOfSave(mch); }
    if (tr && Array.isArray(tr.slots)) G.tour = tr;
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.kitIdx = clamp(G.settings.kitIdx | 0, 0, KITS.length - 1);
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    hit: (shot, v) => {
      const p = Math.min(1, v / 60);
      tone({ freq: 880 + 500 * p, to: 360, dur: 0.06, type: 'square', vol: 0.05 + 0.05 * p });
      tone({ freq: 170, to: 90, dur: 0.07, type: 'sine', vol: 0.09 });
      if (shot === 'smash') { tone({ freq: 2400, to: 700, dur: 0.1, type: 'sawtooth', vol: 0.05 }); tone({ freq: 90, to: 50, dur: 0.18, type: 'sine', vol: 0.12 }); }
      if (shot === 'drop' || shot === 'net' || shot === 'serveShort' || shot === 'block') tone({ freq: 620, to: 520, dur: 0.05, type: 'triangle', vol: 0.05 });
    },
    whoosh: (v) => tone({ freq: 1400, to: 500, dur: 0.14, type: 'sawtooth', vol: Math.min(0.04, 0.012 + v * 0.0004) }),
    land: () => tone({ freq: 240, to: 160, dur: 0.05, type: 'sine', vol: 0.05 }),
    net: () => { tone({ freq: 300, to: 200, dur: 0.12, type: 'triangle', vol: 0.07 }); tone({ freq: 1200, to: 800, dur: 0.05, type: 'square', vol: 0.02 }); },
    cord: () => tone({ freq: 900, to: 700, dur: 0.08, type: 'square', vol: 0.04 }),
    point: (win) => (win ? [0, 4, 7].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.14 + i * 0.03, type: 'triangle', vol: 0.06 })) : [0, -4].forEach((n) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.2, type: 'triangle', vol: 0.045 }))),
    perfect: () => { tone({ freq: 1320, dur: 0.06, type: 'sine', vol: 0.05 }); tone({ freq: 1760, dur: 0.1, type: 'sine', vol: 0.04 }); },
    whistle: () => tone({ freq: 2500, to: 2200, dur: 0.26, type: 'sine', vol: 0.04 }),
    cheer: (win) => (win ? [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.16 + i * 0.03, type: 'triangle', vol: 0.07 })) : [0, -3].forEach((n) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.22, type: 'triangle', vol: 0.05 }))),
  };

  // ---- the hall: a soft crowd murmur and a low room hum, swelling with the rally length and after a point (all synthesized, very quiet)
  let ambT = 0, swell = 0;
  const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  function ambience(dt) {
    if (!G.settings.sound) return;
    ambT -= dt; swell = Math.max(0, swell - dt * 0.35);
    if (ambT > 0) return;
    ambT = 0.34;
    const rl = S && G.scene === 'play' ? Math.min(1, S.s.rally / 14) : 0.1, k = 0.5 + 0.9 * Math.max(rl, swell), n = Math.floor(G.t * 3);
    tone({ freq: 70 + hash(n) * 6, dur: 0.6, type: 'triangle', vol: 0.006 });
    for (let i = 0; i < 3; i++) tone({ freq: 150 + hash(n * 3 + i) * 190, to: 130 + hash(n * 5 + i) * 150, dur: 0.3 + hash(n + i) * 0.25, type: 'sawtooth', vol: 0.0035 * k });
    if (swell > 0.5 && hash(n) > 0.4) tone({ freq: 420 + hash(n + 9) * 260, dur: 0.18, type: 'triangle', vol: 0.006 * swell });
  }

  // ---- match lifecycle ------------------------------------------------------------------------------------------------------------------
  const lookOf = (k) => ({ female: k.female, skin: k.skin, hair: k.hair, kit: { top: k.kit.top, bottoms: k.kit.bottoms, socks: k.kit.socks || '#f3f3f3' }, racket: k.racket || 0xe8892f });
  const setLooks = (oppLook) => {
    const kit = KITS[G.settings.kitIdx | 0] || KITS[0];
    G.look = [{ female: !!G.settings.female, skin: G.settings.female ? 'tan' : 'tan', hair: 'black', kit: { top: kit.top, bottoms: kit.bottoms, socks: kit.socks }, racket: 0x2fb6a6 }, oppLook];
  };
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = 0; G.think = null; G.hintShow = null; G.trail = null; G.swipeLive = null; G.sw = null; G.resultAt = 0; };
  const startBg = () => { G.names = ['Near', 'Far']; setLooks(lookOf(QUICK_LOOKS[3])); setSim(createSim({ mode: 'match', aiNear: true, nearLevel: 3, level: 3, lengthId: 'to21', firstServer: 0 }, simRng.fork())); G.mode = 'none'; G.cfgAiNear = true; };
  const oppFor = () => {
    if (G.tourMatch && G.tour) { const rv = RIVALS[G.tour.rivalIds[G.tour.round]]; return { name: rv.name, level: rv.level, style: rv.style, sub: `${rv.country}` }; }
    const l = LEVELS[G.setup.opp]; return { name: l.name, level: G.setup.opp, style: ['allround', 'defender', 'attacker', 'net', 'counter'][G.setup.opp % 5], sub: '' };
  };
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    G.gameLog = [];
    G.newBest = false;
    if (kind === 'ai') {
      if (demo && G.record.demoMatches >= DEMO_GAME_CAP && !opts.resume) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      const rs = opts.resume;
      const o = rs ? { name: rs.oppName, level: rs.cfg.level, style: rs.cfg.style, sub: '' } : oppFor();
      if (G.tourMatch && G.tour) { cfg = { mode: 'match', level: o.level, style: o.style, target: TOURNEY_TARGET, cap: TOURNEY_CAP, games: 1, lengthId: 'to11', firstServer: simRng.next() < 0.5 ? 0 : 1 }; G.roundName = ROUND_NAMES[G.tour.round]; }
      else { cfg = { mode: 'match', level: o.level, style: o.style, lengthId: rs ? rs.cfg.lengthId : demo ? 'to11' : st.len, firstServer: simRng.next() < 0.5 ? 0 : 1 }; G.roundName = ''; }
      if (rs && rs.cfg.target) { cfg.target = rs.cfg.target; cfg.cap = rs.cfg.cap; cfg.games = rs.cfg.games; }
      G.names = ['You', o.name]; G.oppSub = o.sub || '';
      if (G.tourMatch && G.tour) { const rv = RIVALS[G.tour.rivalIds[G.tour.round]]; setLooks(lookOf({ female: rv.female, skin: rv.skin, hair: rv.hair, kit: rv.kit, racket: 0xe8892f })); } else setLooks(lookOf(QUICK_LOOKS[clamp(o.level, 1, 5)]));
    } else if (kind === 'watch') {
      cfg = { mode: 'match', aiNear: true, nearLevel: st.watchA, level: st.opp, watch: true, lengthId: 'to11', firstServer: 0, nearStyle: 'allround', style: 'allround' };
      G.names = ['Near player', 'Far player']; G.roundName = 'Watch & Learn'; G.oppSub = ''; setLooks(lookOf(QUICK_LOOKS[3]));
    } else {
      cfg = { mode: 'rally', level: 3, style: 'allround', lengthId: 'to21', firstServer: 1 };
      G.names = ['You', 'Feeder']; G.roundName = 'Rally Challenge'; G.oppSub = ''; setLooks(lookOf(QUICK_LOOKS[2]));
    }
    G.cfgAiNear = kind === 'watch';
    if (opts.resume) { cfg.resume = { score: opts.resume.score, games: opts.resume.games, gameNo: opts.resume.gameNo, server: opts.resume.server }; G.gameLog = opts.resume.gameLog || []; cfg.firstServer = opts.resume.server; }
    G.curCfg = { level: cfg.level, style: cfg.style, lengthId: cfg.lengthId, target: cfg.target, cap: cfg.cap, games: cfg.games, mode: cfg.mode };
    G.mode = kind;
    G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'ai') { if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    G.tourMatch = !!d.tour;
    if (G.tourMatch && !G.tour) { clearSave(); return; }
    startMatch('ai', { resume: d, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; G.tourMatch = false; startBg(); };

  // ---- tournament -----------------------------------------------------------------------------------------------------------------------
  function drawTournament() {
    const ids = RIVALS.map((r) => r.id);
    const order = simRng.shuffle(ids.slice(0, 7).concat(['you']));
    const lvOf = (id) => (id === 'you' ? 0 : RIVALS.find((r) => r.id === id).level);
    const pair = (a, b) => { const pa = Math.pow(lvOf(a) || 3, 2), pb = Math.pow(lvOf(b) || 3, 2); return simRng.next() < pa / (pa + pb) ? a : b; };
    const full = [order];
    let cur = order;
    const rivalIds = [];
    for (let r = 0; r < 3; r++) {
      const nxt = [];
      for (let i = 0; i < cur.length; i += 2) {
        const a = cur[i], b = cur[i + 1];
        if (a === 'you' || b === 'you') { const opp = a === 'you' ? b : a; rivalIds.push(RIVALS.findIndex((x) => x.id === opp)); nxt.push('you'); }
        else nxt.push(pair(a, b));
      }
      cur = nxt; full.push(nxt);
    }
    // the human only appears in a later round once he has won the earlier ones
    const shown = full.map((row, r) => (r === 0 ? row : row.map((x) => (x === 'you' ? null : x))));
    G.tour = { slots: order, bracket: shown, full, round: 0, rivalIds, over: false, champion: false, started: false };
    saveTour();
  }
  function tourResult(win) {
    const tr = G.tour; if (!tr) return;
    tr.started = true;
    if (win) {
      tr.round++;
      if (tr.round >= 3) { tr.over = true; tr.champion = true; tr.round = 2; tr.bracket[3] = ['you']; tr.bracket[2] = tr.bracket[2].map((x, i) => (tr.full[2][i] === 'you' ? 'you' : x)); G.record.tourWins = (G.record.tourWins | 0) + 1; }
      else tr.bracket[tr.round] = tr.bracket[tr.round].map((x, i) => (tr.full[tr.round][i] === 'you' ? 'you' : x));
    } else tr.over = true;
    saveTour(); saveSettings();
  }

  // ---- events from the sim: sound, saving --------------------------------------------------------------------------------------------------
  const delayed = [];
  const later = (f) => delayed.push({ t: 0.35, f });
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.scene !== 'play') continue;
      switch (e.type) {
        case 'hit': sfx.hit(e.shot, e.v); sfx.whoosh(e.v); if (e.who === 0 && e.grade === 'perfect') sfx.perfect(); break;
        case 'land': if (e.inside) sfx.land(); break;
        case 'net': sfx.net(); break;
        case 'cord': sfx.cord(); break;
        case 'point': {
          const mine = e.winner === 0;
          if (e.why === 'out' || e.why === 'fault') sfx.whistle();
          sfx.point(mine); later(() => sfx.cheer(mine)); swell = mine ? 1 : 0.7;
          if (G.mode === 'ai') persistMatch();
          break;
        }
        case 'game': G.gameLog.push(e.score || s.score.slice()); break;
        case 'match': G.resultAt = G.t + 2.4; break;
        default: break;
      }
    }
  }
  function finishMatch() {
    const s = S.s;
    if (G.mode === 'ai') {
      clearSave();
      if (s.winner === 0) G.record.matchWins = (G.record.matchWins | 0) + 1;
      if (G.tourMatch) tourResult(s.winner === 0);
      saveSettings();
    }
    if (G.mode === 'rally') { if (s.challenge.returns > (G.record.rallyBest | 0)) { G.record.rallyBest = s.challenge.returns; G.newBest = true; } saveSettings(); }
    G.scene = 'result'; G.ui.scroll = 0;
  }

  // ---- Watch & Learn ---------------------------------------------------------------------------------------------------------------------------
  function updateWatch(dt) {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.hold) {
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); return true; }
      return false;
    }
    return true;
  }

  // ---- swipes -----------------------------------------------------------------------------------------------------------------------------
  const KEYSW = { KeyJ: 110, KeyK: 250, KeyL: 450 };
  function readSwipe(input, lay) {
    const ptr = input.pointer, keys = input.keys, out = [];
    const cam = lay.cam;
    for (const code of Object.keys(KEYSW)) {
      if (keys.pressed.has(code)) {
        const aim = (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0) - (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? 1 : 0);
        const aimS = cam === 'S' ? (keys.down.has('ArrowDown') ? 1 : 0) - (keys.down.has('ArrowUp') ? 1 : 0) : aim;
        out.push({ F: KEYSW[code], Lx: aimS * KEYSW[code] * 0.9 });
      }
    }
    if (keys.pressed.has('Space')) out.push({ F: 0, Lx: 0, tap: true });
    if (ptr.pressed) {
      const onBtn = inRect(lay.hud.util.think, ptr.x, ptr.y) || inRect(lay.hud.util.pause, ptr.x, ptr.y);
      G.sw = onBtn ? null : { x0: ptr.x, y0: ptr.y, x: ptr.x, y: ptr.y, pts: [{ x: ptr.x, y: ptr.y }] };
    }
    if (G.sw && (ptr.down || ptr.released)) {
      if (ptr.down) { G.sw.x = ptr.x; G.sw.y = ptr.y; const l = G.sw.pts[G.sw.pts.length - 1]; if (Math.hypot(ptr.x - l.x, ptr.y - l.y) > 6) { G.sw.pts.push({ x: ptr.x, y: ptr.y }); if (G.sw.pts.length > 14) G.sw.pts.shift(); } }
      G.trail = G.sw.pts;
      const sw = swipeToCourt(G.sw.x - G.sw.x0, G.sw.y - G.sw.y0);
      const gi = S ? guideInfo(G, S.s) : null;
      if (gi && gi.active) {
        G.swipeLive = Math.hypot(sw.F, sw.Lx) < SWIPE.tap ? { kind: 'safe' } : gi.serve ? { kind: Math.max(sw.F, 0) >= 230 ? 'serveLong' : 'serveShort' } : classifySwipe(sw, gi.cls);
      } else G.swipeLive = null;
    }
    if (ptr.released && G.sw) {
      const sw = swipeToCourt(G.sw.x - G.sw.x0, G.sw.y - G.sw.y0);
      out.push(Math.hypot(sw.F, sw.Lx) < SWIPE.tap ? { F: 0, Lx: 0, tap: true } : sw);
      G.sw = null; G.trail = null; G.swipeLive = null;
    }
    return out;
  }
  function openThink() {
    if (!S || G.cfgAiNear) return;
    const sug = S.suggest(0);
    G.thinkSt = null;
    if (!sug) { G.think = { reason: 'Nothing to hit yet. Your player gets back to the middle of the court by himself. Watch where the shuttle goes: the ring will show where you meet it.', summary: 'Wait for the shuttle', target: null }; return; }
    const t = sug.type;
    const strokeSwipe = { smash: 'a long swipe', clear: 'a medium swipe', drop: 'a short swipe', drive: 'a long swipe (or sideways)', push: 'a short swipe', lift: 'a medium swipe', net: 'a short swipe', block: 'a swipe pulled back', serveShort: 'a short swipe', serveLong: 'a long swipe', safe: 'a tap' }[t] || 'a swipe';
    const p0 = S.s.players[0], a = projectL(p0.x, 0, p0.z), b = projectL(sug.landX, 0, sug.landZ);
    let lean = '';
    if (a && b) {
      const portrait = !layoutFor(W, H, G.settings.textIdx).land;
      const d = portrait ? b.x - a.x : b.y - a.y;
      lean = Math.abs(d) > 40 ? ` Lean it ${portrait ? (d > 0 ? 'to the right' : 'to the left') : (d > 0 ? 'downwards' : 'upwards')} on the screen.` : ' Keep it straight.';
    }
    G.think = { reason: `${sug.reason} Play it with ${strokeSwipe}.${lean}`, summary: sug.summary, target: { x: sug.landX, z: sug.landZ } };
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = G.ui.drag, mt = MN.flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); G.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) MN.ensureLayout(G, key);
    if (ptr.pressed) G.ui.drag = { y0: ptr.y, x0: ptr.x, s0: G.ui.scroll, moved: 0 };
    if (G.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && G.ui.drag) {
      const d = G.ui.drag; G.ui.drag = null;
      const lay = MN.flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(MN.hitScreen(ptr.x, ptr.y, G.ui.scroll));
      else if (!scrollable) handler(MN.hitScreen(d.x0, d.y0, G.ui.scroll));
    }
    const mt = MN.flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); saveSettings(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); saveSettings(); }
    { const k = input.keys, step = Math.max(40, mt.bottom - mt.top - 60), set = (v) => { G.ui.scroll = clamp(v, 0, max); };
      if (input.wheel && input.wheel.dy) set(G.ui.scroll + input.wheel.dy);
      if (k.down.has('ArrowDown')) set(G.ui.scroll + 14);
      if (k.down.has('ArrowUp')) set(G.ui.scroll - 14);
      if (k.pressed.has('PageDown') || k.pressed.has('Space')) set(G.ui.scroll + step);
      if (k.pressed.has('PageUp')) set(G.ui.scroll - step);
      if (k.pressed.has('Home')) set(0);
      if (k.pressed.has('End')) set(max); }
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.watch = false; G.tourMatch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; G.tourMatch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'tour') { if (demo) { go('demolimit'); return; } if (!G.tour) drawTournament(); go('tourney'); }
    else if (id === 'rally') { G.tourMatch = false; startMatch('rally'); }
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('opp')) st.opp = +id.slice(3);
    else if (id.startsWith('near')) st.watchA = +id.slice(4);
    else if (id.startsWith('len-')) { if (demo && id !== 'len-to11') { G.setupMsg = 'The free demo has the short game.'; return; } st.len = id.slice(4); }
    else if (id === 'start') {
      if (demo && st.opp > 3 && !st.watch) { G.setupMsg = 'The free demo has the first three levels.'; return; }
      saveSettings();
      startMatch(st.watch ? 'watch' : 'ai');
    } else if (id === 'back') go('title');
  }
  function handleTourney(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'tour-new') { drawTournament(); G.ui.scroll = 0; }
    else if (id === 'tour-play') { G.tourMatch = true; startMatch('ai'); }
    else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'kit-next') st.kitIdx = ((st.kitIdx | 0) + 1) % KITS.length;
    else if (id === 'who-next') st.female = !st.female;
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveSettings();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastMode === 'watch' ? 'watch' : G.setup.lastMode === 'rally' ? 'rally' : 'ai');
    else if (id === 'new') { if (G.setup.lastMode === 'watch') startMatch('watch'); else go('setup'); }
    else if (id === 'tour-cont') { G.tourMatch = false; go('tourney'); G.mode = 'none'; startBg(); }
    else if (id === 'menu') { go('title'); G.mode = 'none'; G.tourMatch = false; startBg(); }
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'quit') leaveMatch();
  }
  function scrollInput(input, st, max, view, rect) {
    const ptr = input.pointer, keys = input.keys;
    const set = (v) => { st.scroll = clamp(v, 0, max); };
    if (ptr.pressed) st.drag = rect && inRect(rect, ptr.x, ptr.y) ? { y0: ptr.y, s0: st.scroll, moved: 0 } : null;
    let used = false;
    if (st.drag && ptr.down) { st.drag.moved = Math.max(st.drag.moved, Math.abs(ptr.y - st.drag.y0)); if (st.drag.moved >= 10) { set(st.drag.s0 - (ptr.y - st.drag.y0)); used = true; } }
    if (ptr.released && st.drag) { used = used || st.drag.moved >= 10; st.drag = null; }
    if (input.wheel && input.wheel.dy) set(st.scroll + input.wheel.dy);
    const step = Math.max(40, view - 60);
    if (keys.down.has('ArrowDown')) set(st.scroll + 14);
    if (keys.down.has('ArrowUp')) set(st.scroll - 14);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(st.scroll + step);
    if (keys.pressed.has('PageUp')) set(st.scroll - step);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(max);
    return used;
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const mt = MN.readerMeta(), RD = layoutFor(W, H, G.settings.textIdx).reader;
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.ui.scroll = 0; G.ui.drag = null; };
    const down = () => { if (G.ui.scroll >= mt.max - 2) close(); else G.ui.scroll = clamp(G.ui.scroll + mt.view - 70, 0, mt.max); };
    const up = () => { if (G.ui.scroll <= 2) close(); else G.ui.scroll = clamp(G.ui.scroll - (mt.view - 70), 0, mt.max); };
    const zoom = (d) => { const old = G.settings.textIdx; G.settings.textIdx = clamp(old + d, 0, TEXT_SCALES.length - 1); if (G.settings.textIdx !== old) G.ui.keepFrac = mt.max > 0 ? G.ui.scroll / mt.max : 0; saveSettings(); };
    const used = scrollInput(input, G.ui, mt.max, mt.view, mt.rect);
    if (ptr.pressed && !used) {
      if (inRect(RD.next, ptr.x, ptr.y)) down();
      else if (inRect(RD.back, ptr.x, ptr.y)) close();
      else if (inRect(RD.dec, ptr.x, ptr.y)) zoom(-1);
      else if (inRect(RD.inc, ptr.x, ptr.y)) zoom(1);
    }
    if (keys.pressed.has('ArrowRight')) down();
    if (keys.pressed.has('ArrowLeft')) up();
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) zoom(1);
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) zoom(-1);
    if (keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const SP = layoutFor(W, H, G.settings.textIdx).setup;
    if (ptr.pressed && (inRect(SP.start, ptr.x, ptr.y) || inRect(SP.back, ptr.x, ptr.y))) { handleSetup(inRect(SP.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ---- the play update --------------------------------------------------------------------------------------------------------------------------
  function updatePlay(dt, input) {
    const ptr = input.pointer, keys = input.keys;
    const s = S.s;
    if (G.mode === 'shot') { S.update(dt, null); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    const lay = hudLayout(G.settings.textIdx);
    if (G.think) {
      const tm = G.thinkMeta, tused = tm && G.thinkSt ? scrollInput(input, G.thinkSt, tm.max, tm.view, tm.rect) : false;
      if (ptr.pressed && !tused && G.thinkRects) {
        if (inRect(G.thinkRects.show, ptr.x, ptr.y)) { if (G.think.target) G.hintShow = { until: s.t + 6, target: G.think.target }; G.think = null; sfx.tick(); }
        else if (inRect(G.thinkRects.close, ptr.x, ptr.y)) { G.think = null; sfx.tick(); }
      }
      if (keys.pressed.has('Escape') || keys.pressed.has('KeyT')) G.think = null;
      return;
    }
    if (G.mode === 'watch') {
      const wm = G.watchMeta, wused = wm && G.watchSt ? scrollInput(input, G.watchSt, wm.max, wm.view, wm.rect) : false;
      if (ptr.pressed && !wused) {
        const i = watchHit(ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) { leaveMatch(); return; }
      }
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (G.watch.paused) return;
      if (!updateWatch(dt)) { processEvents(); return; }
      S.update(dt, null);
      processEvents();
      if (G.resultAt && G.t >= G.resultAt) { G.resultAt = 0; finishMatch(); }
      return;
    }
    if (ptr.pressed) {
      if (inRect(lay.util.pause, ptr.x, ptr.y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); G.sw = null; G.trail = null; return; }
      if (inRect(lay.util.think, ptr.x, ptr.y)) { openThink(); G.sw = null; G.trail = null; return; }
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); return; }
    if (keys.pressed.has('KeyT')) { openThink(); return; }
    const swipes = readSwipe(input, layoutFor(W, H, G.settings.textIdx));
    S.update(dt, swipes.length ? { swipe: swipes[swipes.length - 1] } : null);
    processEvents();
    if (G.resultAt && G.t >= G.resultAt) { G.resultAt = 0; finishMatch(); }
  }

  function startShot() {
    G.mode = 'shot'; G.setup.lastMode = 'shot'; G.names = ['Mei Lin', 'Soren']; setLooks(lookOf(QUICK_LOOKS[5])); G.roundName = 'Final'; G.cfgAiNear = true;
    setSim(createSim({ mode: 'match', aiNear: true, nearLevel: 4, level: 4, lengthId: 'to21', firstServer: 0 }, simRng.fork()));
    G.scene = 'play';
  }
  let sizeKey = '';
  function syncSize(view) {
    const w = (view && view.width) || meta.width, h = (view && view.height) || meta.height;
    setViewport(w, h);
    const L = layoutFor(W, H, G.settings.textIdx);
    UI.minf = L.minf; UI.minb = L.minb;
    setMode(L.cam); setAspect(W / H);
    meta.previewBadge = L.land ? { x: L.hud.util.pause.x + L.hud.util.pause.w, y: L.hud.util.pause.y + L.hud.util.pause.h + 4, align: 'right' } : { x: W / 2, y: L.hud.util.think.y + (L.hud.util.think.h - 34) / 2, align: 'center' };
    if (sizeKey !== `${W}x${H}`) { if (sizeKey) { G.sw = null; G.trail = null; } sizeKey = `${W}x${H}`; }
    let rect;
    if (G.scene === 'play') rect = fitFor(L, G.mode === 'watch' ? 'watch' : 'play');
    else rect = { x0: L.U.x0, y0: L.U.y0, x1: L.U.x1, y1: L.U.y1 };
    setCamera(fitCamera(W, H, rect));
  }
  function startup() { if (config.shot) startShot(); else startBg(); }
  startup();
  if (config.dev) G.dev = { startMatch, go, openThink, resume: resumeMatch, quit: leaveMatch, persist: persistMatch, layout: () => layoutFor(W, H, G.settings.textIdx), sim: () => S, drawTournament, finishMatch };

  return {
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'ai' || G.mode === 'rally')) || G.paused || G.pauseMenu || !!G.think || (S && (S.s.phase === 'point' || S.s.phase === 'gamebreak' || S.s.phase === 'over')),
    update(dt, input) {
      syncSize();
      setPress(input.pointer);
      G.t += dt;
      ambience(dt);
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play') S.update(dt, null);
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updateSetup(dt, input); break;
        case 'tourney': updateFlowScene(dt, input, handleTourney, 'tourney'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      // the background rally on the menus restarts when its match ends
      if (G.scene !== 'play' && S.s.phase === 'over' && G.mode === 'none') startBg();
    },
    render(ctx, view) {
      syncSize(view);
      G.viewW = (view && view.cssW) || 720; G.viewH = (view && view.cssH) || 1280;
      ctx.clearRect(0, 0, W, H);
      if (view && view.noGL) renderFallback(ctx, G, view);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'tourney': MN.renderTourney(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G, S, { cssW: G.viewW, cssH: G.viewH });
          if (G.think && !G.think.silent) renderThink(ctx, G, view);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
}
