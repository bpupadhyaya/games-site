// Kilikiti: the game shell. Scenes, input, persistence, preview wiring, Learn, Watch & Learn, sound. The match itself lives in sim.js; drawing in hud.js / screens.js.
// This file is the only one that mutates `G` (what getState() returns); the 3D layer only reads it.
import { W, H, DT, DEG, clamp, lerp, ROLE_KEYS } from './core.js';
import { createSim, viewOf } from './sim.js';
import { makeBot } from './bot.js';
import { unproject } from './camera.js';
import { SPEED, BOUNCE, DELIVERY_KEYS } from './ball.js';
import { TEXT_SCALES, inRect, setPress } from './ui.js';
import { R, THINK_STEPS, renderPlay, THINK_OK, PAUSE_BTNS } from './hud.js';
import { renderScreen, Z } from './screens.js';
import { LESSONS, ROLE_INFO } from './content.js';

export const meta = { width: W, height: H };
const DEMO_MATCHES = 2;
const SAVE_VERSION = 1;
const hid = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true });
const IDLE_SPEEDS = [3, 6, 40];

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const nowMs = () => (env.clock ? env.clock() : 0);
  const demo = !!config.demo;
  const G = {
    scene: 'title', back: 'title', t: 0, tick: 0, paused: false,
    settings: { sound: true, assist: 1, thinkIdx: 1, textIdx: 0 },
    prefs: { coach: 0 },
    ui: { scroll: 0, drag: null, pageIdx: 0, pageN: 1 },
    records: {}, learn: { done: {} }, demoPlayed: 0,
    setup: { role: 'bat', level: 2, mode: 'quick', watchA: 3, watchB: 3 },
    sim: null, show3d: true, alpha: 1, watch: false, practice: null, think: null, auto: { phase: 'think', timer: 0, total: 0, lines: [], revealing: false, speed: 1, key: -1 },
    touch: { down: false, path: [], committed: false, fired: false, aimDeg: null },
    aim: { type: 'straight', bx: 0.2, bz: 4.5, speed: 16 }, bowlPreview: null, idleSpeed: 3,
    saved: null, result: null, breakInfo: null, restoreMsg: '', credits: null, loaded: false, viewOverride: null, lastSeq: -1, breakShown: false, shot: false,
  };
  hid(G, 'env', env);
  hid(G, '_ui', { hits: [], footer: [], view: { x: 0, y: 0, w: W, h: H }, pages: null, maxS: 0 });
  // mouse wheel / trackpad scrolls the text screens (the kit input has no wheel event); consumed in uiInput
  try { globalThis.addEventListener?.('wheel', (e) => { if (G.scene !== 'play') { G.wheel = (G.wheel || 0) + Math.max(-400, Math.min(400, e.deltaY)); e.preventDefault?.(); } }, { passive: false }); } catch { /* no DOM */ }
  let S = null;                  // the running sim API (not part of the serializable state)
  let lastPt = null, ghost = null;
  let attract = null, bot = null, evSeen = 0, snap = null, updAt = 0, stepped = false;
  const simRng = rng.fork();
  const sfxq = [];

  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) G.credits = [{ t: 'h', text: 'Credits and licences' }, ...paras.map((x) => ({ t: 'para', text: x }))];
    }).catch(() => {});
  }

  // ---- persistence ------------------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('prefs', G.prefs); storage.set('records', G.records); storage.set('learn', G.learn); storage.set('demoPlayed', G.demoPlayed); };
  const roleName = (r) => ROLE_INFO[r].title;
  const validSave = (d) => d && d.v === SAVE_VERSION && d.cfg && d.snap && ROLE_KEYS.includes(d.cfg.role) && d.snap.inn && Array.isArray(d.snap.innings);
  const lineOf = (d) => `${d.snap.inn.runs}/${d.snap.inn.wk}`;
  const persistMatch = () => {
    if (!S || G.watch || G.practice || G.shot || S.s.over || !S.s.role || S === attract) return;
    const d = { v: SAVE_VERSION, cfg: { role: S.s.cfg.role, level: S.s.cfg.level, mode: S.s.cfg.mode, assist: S.s.cfg.assist }, snap: S.snapshot() };
    snap = d; G.saved = { roleName: roleName(d.cfg.role), innNo: d.snap.innNo, line: lineOf(d) };
    storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };

  Promise.all([storage.get('settings', null), storage.get('prefs', null), storage.get('records', null), storage.get('learn', null), storage.get('demoPlayed', 0), storage.get('match', null)]).then(([s, p, r, l, dp, m]) => {
    if (s) Object.assign(G.settings, s);
    if (p) Object.assign(G.prefs, p);
    if (r && typeof r === 'object') G.records = r;
    if (l && l.done) G.learn = l;
    G.demoPlayed = Math.max(G.demoPlayed, Number(dp) || 0);
    if (validSave(m) && !demo) { snap = m; G.saved = { roleName: roleName(m.cfg.role), innNo: m.snap.innNo, line: lineOf(m) }; }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.assist = clamp(G.settings.assist | 0, 0, 2);
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound --------------------------------------------------------------------------------------------------------------------------------------
  const tone = (o, delay = 0) => { if (!G.settings.sound) return; if (delay > 0) sfxq.push({ at: G.t + delay, o }); else audio.tone(o); };
  const sfx = (name, q = 1) => {
    switch (name) {
      case 'ui': tone({ freq: 520, to: 700, dur: 0.07, type: 'triangle', vol: 0.12 }); break;
      case 'release': tone({ freq: 300, to: 180, dur: 0.12, type: 'sine', vol: 0.1 }); break;
      case 'bounce': tone({ freq: 190, to: 90, dur: 0.07, type: 'triangle', vol: 0.2 }); break;
      case 'swish': tone({ freq: 900, to: 260, dur: 0.14, type: 'sawtooth', vol: 0.06 }); break;
      case 'crack': tone({ freq: 1500, to: 260, dur: 0.06, type: 'square', vol: 0.18 * (0.4 + q * 0.6) }); tone({ freq: 120, to: 60, dur: 0.12, type: 'triangle', vol: 0.3 }); break;
      case 'thud': tone({ freq: 200, to: 110, dur: 0.1, type: 'triangle', vol: 0.22 }); break;
      case 'stumps': for (let k = 0; k < 5; k++) tone({ freq: 640 + k * 210, to: 240, dur: 0.1, type: 'square', vol: 0.06 }, k * 0.025); tone({ freq: 110, to: 60, dur: 0.25, type: 'triangle', vol: 0.28 }); break;
      case 'run': tone({ freq: 440, to: 520, dur: 0.06, type: 'triangle', vol: 0.09 }); break;
      case 'throw': tone({ freq: 700, to: 300, dur: 0.1, type: 'sine', vol: 0.09 }); break;
      case 'catch': tone({ freq: 320, to: 200, dur: 0.1, type: 'triangle', vol: 0.22 }); break;
      case 'cheer': for (let k = 0; k < 5; k++) tone({ freq: 150 + k * 60, to: 200 + k * 50, dur: 0.7, type: 'sawtooth', vol: 0.018 }, k * 0.03); break;
      case 'roar': for (let k = 0; k < 7; k++) tone({ freq: 130 + k * 47, to: 170 + k * 40, dur: 1.1, type: 'sawtooth', vol: 0.02 }, k * 0.03); break;
      case 'groan': tone({ freq: 220, to: 120, dur: 0.6, type: 'sawtooth', vol: 0.03 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, k) => tone({ freq: f, dur: 0.3, type: 'sine', vol: 0.16 }, k * 0.14)); break;
      case 'lose': [392, 330, 262].forEach((f, k) => tone({ freq: f, dur: 0.34, type: 'triangle', vol: 0.16 }, k * 0.18)); break;
      default: break;
    }
  };
  const playSfxQueue = () => { for (let i = sfxq.length - 1; i >= 0; i--) if (sfxq[i].at <= G.t) { audio.tone(sfxq[i].o); sfxq.splice(i, 1); } };

  // ---- starting things ------------------------------------------------------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = 0; G.think = null; G.paused = false; G.touch = { down: false, path: [], committed: false, fired: false, aimDeg: null }; G.bowlPreview = null; G.lastSeq = -1; G.breakShown = false; hid(G, 'S', sim); };
  const startAttract = () => { attract = createSim({ role: null, mode: 'quick', levels: [3, 3], level: 3 }, simRng.fork()); S = attract; G.sim = attract.s; hid(G, 'S', attract); G.watch = false; G.practice = null; evSeen = attract.s.evId; bot = null; };

  function go(scene, back) { G.scene = scene; if (back) G.back = back; G.ui.scroll = 0; G.ui.pageIdx = 0; G.paused = false; G.think = null; }
  const toTitle = () => { go('title'); G.show3d = true; startAttract(); };

  function startMatch(role, level, mode, opts = {}) {
    if (demo && !opts.resume && G.demoPlayed >= DEMO_MATCHES) { go('demolimit'); G.show3d = false; return; }
    if (demo && !opts.resume) { G.demoPlayed++; saveSettings(); }
    const cfg = { role, level, mode: demo ? 'quick' : mode, assist: G.settings.assist };
    const sim = createSim(cfg, simRng.fork(), opts.resume ?? null);
    setSim(sim);
    G.watch = false; G.practice = null; G.idleSpeed = 3; bot = null;
    G.scene = 'play'; G.show3d = true; G.paused = !!opts.paused;
    if (!opts.resume) persistMatch();
  }
  function startPractice(role) {
    const L = LESSONS[role];
    const sim = createSim({ role, level: 1, mode: 'quick', assist: Math.max(1, G.settings.assist), practice: { balls: L.balls } }, simRng.fork());
    setSim(sim);
    G.watch = false; G.practice = { role, goalText: L.goal, need: L.need, progress: 0, balls: 0 }; bot = null;
    G.scene = 'play'; G.show3d = true;
  }
  function startWatch() {
    const su = G.setup;
    const sim = createSim({ role: null, watch: true, mode: 'quick', levels: [su.watchA, su.watchB], level: su.watchB, assist: 1 }, simRng.fork());
    setSim(sim);
    G.watch = true; G.practice = null; bot = null;
    G.auto = { phase: 'think', timer: 0, total: 0, lines: [], revealing: false, speed: 1, key: -1 };
    G.scene = 'play'; G.show3d = true;
  }
  function resumeMatch() {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    G.setup.role = d.cfg.role; G.setup.level = d.cfg.level; G.setup.mode = d.cfg.mode;
    startMatch(d.cfg.role, d.cfg.level, d.cfg.mode, { resume: d.snap, paused: true });
  }

  // ---- results ----------------------------------------------------------------------------------------------------------------------------------------
  function cardsOf(s) {
    return s.innings.map((inn) => ({ title: `${s.teams[inn.bat].name}: ${inn.runs}/${inn.wk} (${inn.balls} balls)`, rows: inn.batters.filter((b) => b.balls > 0 || b.out || b.runs > 0).map((b) => ({ name: b.name, out: !!b.out, line: `${b.runs} (${b.balls})${b.out ? `  ${b.out}` : '  not out'}` })) }));
  }
  function finishMatch() {
    const s = S.s;
    if (G.watch) {
      const a = s.innings.find((i) => i.bat === 0), b = s.innings.find((i) => i.bat === 1);
      G.result = { headline: 'Watch & Learn finished', sub: s.result && !s.result.tied ? `${s.teams[s.result.winner].name} won.` : 'A tie.', lines: [['Home side', `${a.runs}/${a.wk}`, '#fff4dc'], ['Visitors', `${b.runs}/${b.wk}`, '#fff4dc']], cards: cardsOf(s), practice: false };
      go('result'); G.show3d = false; return;
    }
    if (G.practice) {
      const pr = G.practice, ok = pr.progress >= pr.need;
      if (ok) { G.learn.done[pr.role] = true; saveSettings(); }
      G.result = { headline: ok ? 'Practice complete' : 'Not yet', sub: ok ? `Goal reached: ${pr.goalText}.` : `Goal: ${pr.goalText}. You reached ${pr.progress}. Try again.`, lines: [['Goal', pr.goalText, '#fff4dc'], ['Your result', `${pr.progress} of ${pr.need}`, ok ? '#8be07a' : '#ffb347']], cards: [], practice: true };
      sfx(ok ? 'win' : 'lose'); go('result'); G.show3d = false; return;
    }
    const r = s.result, key = s.role;
    const won = r.winner === 0, tied = r.winner === -1;
    const rec = G.records[key] ?? { played: 0, wins: 0 };
    rec.played++; if (won) rec.wins++;
    G.records[key] = rec; saveSettings(); clearSave();
    const a = s.innings[0], b = s.innings[1];
    let sub;
    if (tied) sub = 'The scores finished level.';
    else if (r.byWickets) sub = `${s.teams[r.winner].name} chased ${a.runs + 1} with ${s.inn.maxBalls - b.balls} ball${s.inn.maxBalls - b.balls === 1 ? '' : 's'} to spare.`;
    else sub = `${s.teams[r.winner].name} won by ${r.margin} run${r.margin === 1 ? '' : 's'}.`;
    G.result = { headline: tied ? 'A tie!' : won ? 'You won!' : 'Not this time', sub, lines: [[s.teams[a.bat].name, `${a.runs}/${a.wk}`, '#fff4dc'], [s.teams[b.bat].name, `${b.runs}/${b.wk}`, '#fff4dc'], ['Your role', roleName(key), '#fff4dc'], ['Opponent', `Level ${s.cfg.level}`, '#fff4dc'], ['Role record', `Won ${rec.wins} of ${rec.played}`, '#8be07a']], cards: cardsOf(s), practice: false };
    sfx(won ? 'win' : 'lose'); go('result'); G.show3d = false;
  }
  function inningsBreak() {
    const s = S.s, i = s.innings[0];
    const youBat2 = s.role && s.role !== 'bat';
    G.breakInfo = { team: s.teams[i.bat].name, runs: i.runs, wk: i.wk, balls: i.balls, f4: i.f4, f6: i.f6, target: i.runs + 1, sub: `${s.teams[1 - i.bat].name} need ${i.runs + 1} to win.`, next: youBat2 ? 'Now your side bats. The computer plays your team mates; you play your role.' : s.role ? 'Now your side fields. You play your role while the computer bats.' : 'The second innings starts.', cta: 'Start second innings' };
    if (G.watch) { S.nextInnings(); return; }
    go('break'); G.show3d = true;
  }

  // ---- events -> sound ------------------------------------------------------------------------------------------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.ev) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.scene === 'title') continue;
      switch (e.type) {
        case 'release': sfx('release'); break;
        case 'bounce': case 'ground': sfx('bounce'); break;
        case 'swing': if (!e.contact) sfx('swish'); break;
        case 'crack': sfx('crack', e.q); break;
        case 'throw': sfx('throw'); break;
        case 'catch': sfx('catch'); break;
        case 'pick': sfx('thud'); break;
        case 'runstart': case 'run': sfx('run'); break;
        case 'stumps': sfx('stumps'); break;
        case 'boundary': sfx(e.kind === 6 ? 'roar' : 'cheer'); break;
        case 'wicket': sfx('groan'); break;
        case 'result': practiceResult(e); break;
        default: break;
      }
    }
  }
  function practiceResult(e) {
    const pr = G.practice; if (!pr) return;
    const s = S.s;
    pr.balls++;
    if (pr.role === 'bat') pr.progress += e.runs ?? 0;
    else if (pr.role === 'bowl') { const d = s.d; if (d && d.bounced && !e.wide && d.spec.bz >= 3.4 && d.spec.bz <= 6.0) pr.progress++; }
    else { const uf = s.field.find((f) => f.ctl); if (uf && s.ev.some((x) => x.id > (G.lastBallEv ?? -1) && (x.type === 'pick' || x.type === 'catch') && x.by === uf.id)) pr.progress++; G.lastBallEv = s.evId; }
  }

  // ---- batting input ------------------------------------------------------------------------------------------------------------------------------------------
  const aimAngle = (dx, dy) => Math.atan2(dx, -dy) / DEG;
  function batInput(input) {
    const p = input.pointer, tc = G.touch, s = S.s, tick = G.tick;
    const flight = s.phase === 'flight';
    const kd = input.keys.down;
    if (input.keys.pressed.size) {
      const k = input.keys.pressed;
      if (flight && !s.sw) {
        const dirx = (kd.has('ArrowRight') ? 1 : 0) - (kd.has('ArrowLeft') ? 1 : 0), diry = (kd.has('ArrowUp') ? 1 : 0) - (kd.has('ArrowDown') ? 1 : 0);
        if ([...k].some((c) => c.startsWith('Arrow'))) S.swing({ kind: 'swing', angle: Math.atan2(dirx, diry) / DEG, power: kd.has('ShiftLeft') || kd.has('ShiftRight') ? 0.95 : 0.55, t: s.ft });
        else if (k.has('Space')) S.swing({ kind: 'block', angle: 0, power: 0, t: s.ft });
      }
      if (k.has('Space') && s.phase === 'live') S.callRun();
    }
    if (p.pressed) {
      tc.down = true; tc.sx = p.x; tc.sy = p.y; tc.path = [[p.x, p.y]]; tc.committed = false; tc.fired = false; tc.t0 = tick; tc.mv = -1; tc.ok = false;
      tc.consumed = inRect(R.pause, p.x, p.y) || inRect(R.think, p.x, p.y) || (s.phase === 'live' && inRect(R.run, p.x, p.y));
      tc.aimDeg = null;
      if (s.phase === 'live' && inRect(R.run, p.x, p.y)) S.callRun();
    }
    if (tc.down) {
      if (!p.pressed) tc.path.push([p.x, p.y]);
      if (tc.path.length > 40) tc.path.shift();
      const dx = p.x - tc.sx, dy = p.y - tc.sy, dist = Math.hypot(dx, dy);
      if (tc.mv < 0 && dist >= 6) tc.mv = tick;
      tc.aimDeg = !tc.consumed && dist > 16 ? aimAngle(dx, dy) : null;
      if (!tc.consumed && !tc.committed && dist >= 40) { tc.committed = true; tc.commitTick = tick; tc.ok = flight && !s.sw; tc.commitFt = s.ft; }
      if (tc.committed && tc.ok && !tc.fired && (tick - tc.commitTick >= 3 || p.released)) {
        tc.fired = true;
        const secs = Math.max(2, tick - tc.mv + 1) / 60;
        let len = 0; for (let k = 1; k < tc.path.length; k++) len += Math.hypot(tc.path[k][0] - tc.path[k - 1][0], tc.path[k][1] - tc.path[k - 1][1]);
        const speed = Math.max(len, dist) / secs;
        S.swing({ kind: 'swing', angle: aimAngle(dx, dy), power: clamp((speed - 700) / 3600, 0.06, 1), t: tc.commitFt });
        G.prefs.coach = (G.prefs.coach ?? 0) + 0.34;
      }
    }
    if (p.released) {
      if (tc.down && !tc.consumed && !tc.committed && flight && !s.sw && tick - tc.t0 < 26 && Math.hypot(p.x - tc.sx, p.y - tc.sy) < 36) S.swing({ kind: 'block', angle: 0, power: 0, t: s.ft });
      tc.down = false; tc.aimDeg = null; tc.path = [];
    }
  }

  // ---- bowling input -----------------------------------------------------------------------------------------------------------------------------------------------
  const paceOf = (path) => {
    const n = path.length; if (n < 2) return 0;
    const a = path[Math.max(0, n - 5)], b = path[n - 1];
    const v = Math.hypot(b[0] - a[0], b[1] - a[1]) * 60 / Math.max(1, Math.min(4, n - 1));
    return clamp((v - 900) / 3400, 0, 1);
  };
  const aimOf = (tc, p) => { const dy = tc.sy - p.y, dx = p.x - tc.sx; return { dy, dx, bx: clamp(dx * 0.006, -BOUNCE.xMax, BOUNCE.xMax), bz: lerp(9.6, 1.0, clamp((dy - 60) / 520, 0, 1)) }; };
  function bowlInput(input) {
    const p = input.pointer, tc = G.touch, s = S.s, tick = G.tick;
    if (s.phase !== 'aim') { tc.down = false; tc.path = []; G.bowlPreview = null; return; }
    const A = G.aim;
    for (const k of input.keys.pressed) {
      if (k === 'ArrowLeft') A.bx = clamp(A.bx - 0.1, -BOUNCE.xMax, BOUNCE.xMax);
      if (k === 'ArrowRight') A.bx = clamp(A.bx + 0.1, -BOUNCE.xMax, BOUNCE.xMax);
      if (k === 'ArrowUp') A.bz = clamp(A.bz - 0.35, BOUNCE.zMin, BOUNCE.zMax);
      if (k === 'ArrowDown') A.bz = clamp(A.bz + 0.35, BOUNCE.zMin, BOUNCE.zMax);
      if (/^Digit[1-3]$/.test(k)) { A.type = DELIVERY_KEYS[Number(k.slice(5)) - 1]; sfx('ui'); }
      if (k === 'Space') { A.speed = 16; S.bowl({ ...A }); sfx('release'); }
    }
    if (p.pressed) {
      tc.down = true; tc.sx = p.x; tc.sy = p.y; tc.path = [[p.x, p.y]]; tc.t0 = tick; tc.mode = null;
      const chip = R.chips.find((c) => inRect(c.rect, p.x, p.y));
      if (chip) { A.type = chip.k; tc.mode = 'chip'; sfx('ui'); }
      else if (inRect(R.pause, p.x, p.y) || inRect(R.think, p.x, p.y)) tc.mode = 'hud';
      else tc.mode = 'flick';
    }
    if (tc.down && tc.mode === 'flick') {
      if (!p.pressed) tc.path.push([p.x, p.y]);
      if (tc.path.length > 40) tc.path.shift();
      const a = aimOf(tc, p);
      G.bowlPreview = { bx: a.bx, bz: a.bz, speed: lerp(SPEED.min, SPEED.max, paceOf(tc.path)) };
    }
    if (p.released) {
      if (tc.down && tc.mode === 'flick') {
        const a = aimOf(tc, p);
        if (a.dy > 100 && Math.hypot(a.dx, a.dy) > 120) {
          A.speed = lerp(SPEED.min, SPEED.max, paceOf(tc.path)); A.bx = a.bx; A.bz = a.bz;
          S.bowl({ ...A }); sfx('release');
        }
      }
      tc.down = false; tc.path = []; tc.mode = null; G.bowlPreview = null;
    }
  }

  // ---- fielding input ------------------------------------------------------------------------------------------------------------------------------------------------
  function fieldInput(input) {
    const p = input.pointer, tc = G.touch, s = S.s, tick = G.tick;
    const live = s.live && !s.live.dead;
    for (const k of input.keys.pressed) { if (k === 'Space') S.tap(); if (k === 'Enter') S.ready(); if (k === 'Digit1') S.throwTo(0); if (k === 'Digit2') S.throwTo(1); }
    if (p.pressed) {
      tc.down = true; tc.sx = p.x; tc.sy = p.y; tc.t0 = tick; tc.moved = false; tc.mode = null;
      if (s.phase === 'ready' && s.waitReady && inRect(R.ready, p.x, p.y)) { S.ready(); tc.mode = 'btn'; sfx('ui'); }
      else if (inRect(R.pause, p.x, p.y) || inRect(R.think, p.x, p.y)) tc.mode = 'hud';
      else if (live && s.live.bs === 'held' && inRect(R.throwA, p.x, p.y)) { S.throwTo(0); tc.mode = 'btn'; }
      else if (live && s.live.bs === 'held' && inRect(R.throwB, p.x, p.y)) { S.throwTo(1); tc.mode = 'btn'; }
      else if (live && inRect(R.catchBtn, p.x, p.y)) { S.tap(); tc.mode = 'btn'; }
      else if (viewOf(s) === 'field') tc.mode = 'field';
    }
    if (tc.down && tc.mode === 'field') {
      const q = unproject('field', p.x, p.y, 0);
      if (q && (live || (s.phase === 'ready' && s.waitReady))) { S.setTarget(q.x, q.z); tc.mine = true; }
    }
    if (p.released) {
      // lifting the finger keeps the fielder running to the last touched spot (so the other thumb-free tap on CATCH is possible); in the READY phase the spot becomes his place
      if (tc.down && tc.mode === 'field' && s.phase === 'ready') S.setTarget(null);
      tc.down = false; tc.mode = null;
    }
  }

  // ---- think -------------------------------------------------------------------------------------------------------------------------------------------------------------
  function openThink() {
    if (G.think || G.watch) return;
    const th = S.think();
    if (!th) { sfx('lose'); return; }
    G.think = th; sfx('ui');
  }

  // ---- Watch & Learn ---------------------------------------------------------------------------------------------------------------------------------------------------
  function updateWatch(input) {
    const s = S.s, a = G.auto, p = input.pointer;
    if (p.pressed) {
      if (inRect(R.exit, p.x, p.y)) { toTitle(); return; }
      if (inRect(R.autoPause, p.x, p.y) || inRect(R.pause, p.x, p.y)) { G.paused = !G.paused; sfx('ui'); return; }
      if (inRect(R.autoSpeed, p.x, p.y)) { a.speed = a.speed >= 4 ? 1 : a.speed * 2; sfx('ui'); }
      else if (inRect(R.autoDec, p.x, p.y)) { G.settings.thinkIdx = clamp(G.settings.thinkIdx - 1, 0, 3); saveSettings(); sfx('ui'); }
      else if (inRect(R.autoInc, p.x, p.y)) { G.settings.thinkIdx = clamp(G.settings.thinkIdx + 1, 0, 3); saveSettings(); sfx('ui'); }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Space')) G.paused = !G.paused;
    if (G.paused) return;
    for (let k = 0; k < a.speed; k++) {
      if (s.hold) {
        const h = s.hold;
        if (a.key !== h.id) { a.key = h.id; a.phase = 'think'; a.total = THINK_STEPS[G.settings.thinkIdx]; a.timer = a.total; a.revealing = false; a.full = h.lines; a.lines = h.lines.slice(0, 1); }
        a.timer -= DT;
        if (a.phase === 'think') { const frac = clamp(1 - a.timer / a.total, 0, 1); const n = Math.max(1, Math.min(a.full.length, Math.ceil(frac * a.full.length * 1.05))); a.lines = a.full.slice(0, n); }
        if (a.timer <= 0) {
          if (a.phase === 'think') { a.phase = 'reveal'; a.revealing = true; a.total = 2; a.timer = 2; a.lines = a.full.concat([h.decision]); }
          else { a.phase = 'act'; a.revealing = false; S.releaseHold(); }
        }
        continue;
      }
      stepSim(DT);
      if (G.scene !== 'play') return;
    }
  }

  // ---- the sim step with scene hand-offs -----------------------------------------------------------------------------------------------------------------------------------
  function stepSim(dt) {
    const s = S.s;
    if (bot) bot();
    S.update(dt);
    stepped = true;
    processEvents();
    if (s.phase === 'ready' && s.pt < dt * 1.5 && s.ballSeq !== G.lastSeq) { G.lastSeq = s.ballSeq; persistMatch(); }
    if (s.phase === 'break') { if (!G.breakShown) { G.breakShown = true; inningsBreak(); } } else G.breakShown = false;
    if (s.phase === 'matchEnd' && G.scene === 'play') finishMatch();
  }

  function idleSpeedNow() {
    const s = S.s;
    const userActive = s.api.humanBats() || s.api.humanBowls() || s.api.humanFields();
    return (G.watch || userActive || G.practice) ? 1 : G.idleSpeed;
  }

  function updatePlay(dt, input) {
    const s = S.s, p = input.pointer;
    if (G.watch) { updateWatch(input); return; }
    if (G.paused) {
      if (p.pressed) {
        const B = PAUSE_BTNS;
        if (inRect(B.resume, p.x, p.y) || inRect(R.pause, p.x, p.y)) { G.paused = false; sfx('ui'); }
        else if (inRect(B.sound, p.x, p.y)) { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
        else if (inRect(B.textDec, p.x, p.y)) { G.settings.textIdx = clamp(G.settings.textIdx - 1, 0, TEXT_SCALES.length - 1); saveSettings(); }
        else if (inRect(B.textInc, p.x, p.y)) { G.settings.textIdx = clamp(G.settings.textIdx + 1, 0, TEXT_SCALES.length - 1); saveSettings(); }
        else if (inRect(B.rules, p.x, p.y)) { go('rules', 'play'); G.paused = true; G.show3d = false; return; }
        else if (inRect(B.quit, p.x, p.y)) { persistMatch(); toTitle(); return; }
      }
      if (input.keys.pressed.has('KeyP')) G.paused = false;
      return;
    }
    if (G.think) {
      if (p.pressed && inRect(THINK_OK, p.x, p.y)) { G.think = null; sfx('ui'); }
      if (input.keys.pressed.has('KeyT') || input.keys.pressed.has('Escape')) G.think = null;
      return;
    }
    if (p.pressed && inRect(R.pause, p.x, p.y)) { G.paused = true; sfx('ui'); persistMatch(); return; }
    if (p.pressed && inRect(R.think, p.x, p.y)) { openThink(); return; }
    if (input.keys.pressed.has('KeyP')) { G.paused = true; persistMatch(); return; }
    if (input.keys.pressed.has('KeyT')) openThink();
    const active = s.api.humanBats() || s.api.humanBowls() || s.api.humanFields();
    if (!active && !G.practice) {
      if (p.pressed && inRect(R.speed, p.x, p.y)) { const i = IDLE_SPEEDS.indexOf(G.idleSpeed); G.idleSpeed = IDLE_SPEEDS[(i + 1) % IDLE_SPEEDS.length]; sfx('ui'); }
      if (p.pressed && inRect(R.skip, p.x, p.y)) { G.idleSpeed = 40; sfx('ui'); }
    } else if (G.idleSpeed === 40) G.idleSpeed = 3;
    if (s.phase === 'break' || s.phase === 'matchEnd') return;
    if (s.api.humanBats()) batInput(input);
    else if (s.api.humanBowls()) bowlInput(input);
    else if (s.api.humanFields()) fieldInput(input);
    const n = idleSpeedNow();
    for (let k = 0; k < n; k++) { stepSim(dt); if (G.scene !== 'play') break; if (s.hold) break; }
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------------------------------------------------------
  function uiInput(input) {
    const p = input.pointer, ui = G.ui, U = G._ui;
    if (p.pressed) ui.drag = { y0: p.y, s0: ui.scroll, moved: false, x0: p.x };
    if (ui.drag && p.down) {
      const dy = p.y - ui.drag.y0;
      if (Math.abs(dy) > 12) ui.drag.moved = true;
      if (ui.drag.moved) ui.scroll = clamp(ui.drag.s0 - dy, 0, U.maxS);
    }
    if (G.wheel) { ui.scroll = clamp(ui.scroll + G.wheel, 0, U.maxS); G.wheel = 0; }
    for (const k of input.keys.pressed) {
      if (k === 'PageDown') ui.scroll = clamp(ui.scroll + U.view.h * 0.85, 0, U.maxS);
      if (k === 'PageUp') ui.scroll = clamp(ui.scroll - U.view.h * 0.85, 0, U.maxS);
      if (k === 'ArrowDown') ui.scroll = clamp(ui.scroll + 80, 0, U.maxS);
      if (k === 'ArrowUp') ui.scroll = clamp(ui.scroll - 80, 0, U.maxS);
      if (k === 'Escape') uiTap('back');
      if (k === 'Enter' || k === 'Space') { const prim = U.footer.find((f) => ['start', 'next', 'again', 'go'].includes(f.id)); if (prim) uiTap(prim.id); }
      if (k === 'Equal' || k === 'NumpadAdd') { G.settings.textIdx = clamp(G.settings.textIdx + 1, 0, TEXT_SCALES.length - 1); saveSettings(); }
      if (k === 'Minus' || k === 'NumpadSubtract') { G.settings.textIdx = clamp(G.settings.textIdx - 1, 0, TEXT_SCALES.length - 1); saveSettings(); }
    }
    if (p.released && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (d.moved) {
        return;
      }
      const x = p.x, y = p.y;
      if (inRect(Z.zoomDec, x, y)) { G.settings.textIdx = clamp(G.settings.textIdx - 1, 0, TEXT_SCALES.length - 1); saveSettings(); return; }
      if (inRect(Z.zoomInc, x, y)) { G.settings.textIdx = clamp(G.settings.textIdx + 1, 0, TEXT_SCALES.length - 1); saveSettings(); return; }
      for (const f of U.footer) if (inRect(f.rect, x, y)) { uiTap(f.id); return; }
      if (y >= U.view.y && y <= U.view.y + U.view.h) for (const h of U.hits) if (inRect(h.rect, x, y)) { uiTap(h.id); return; }
    }
  }

  function uiTap(id) {
    const sc = G.scene, st = G.settings, su = G.setup;
    sfx('ui');
    if (id === 'back') {
      if (sc === 'setup') go('role'); else if (sc === 'roleinfo') go('setup'); else if (sc === 'role' || sc === 'learn' || sc === 'watchsetup' || sc === 'settings') toTitle();
      else if (sc === 'howto' || sc === 'about' || sc === 'rules') uiTap('prev');
      return;
    }
    switch (sc) {
      case 'title':
        if (id === 'continue') resumeMatch();
        else if (id === 'play') { go('role'); G.show3d = false; }
        else if (id === 'learn') { go('learn'); G.show3d = false; }
        else if (id === 'watch') { go('watchsetup'); G.show3d = false; }
        else if (id === 'howto' || id === 'rules' || id === 'about' || id === 'settings') { go(id, 'title'); G.show3d = false; }
        break;
      case 'role': if (id.startsWith('role:')) { su.role = id.slice(5); go('setup'); } break;
      case 'setup':
        if (id.startsWith('mode:')) su.mode = id.slice(5);
        else if (id.startsWith('level:')) su.level = Number(id.slice(6));
        else if (id === 'roleinfo') go('roleinfo');
        else if (id === 'start') startMatch(su.role, su.level, su.mode);
        break;
      case 'learn': if (id.startsWith('learn:')) startPractice(id.slice(6)); break;
      case 'watchsetup':
        if (id.startsWith('wa:')) su.watchA = Number(id.slice(3)); else if (id.startsWith('wb:')) su.watchB = Number(id.slice(3)); else if (id === 'start') startWatch();
        break;
      case 'settings':
        if (id === 'set:sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
        else if (id === 'set:assist') st.assist = (st.assist + 1) % 3;
        else if (id === 'set:think') st.thinkIdx = (st.thinkIdx + 1) % 4;
        else if (id === 'set:restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
        else if (id === 'set:dev') clearSave();
        saveSettings();
        break;
      case 'howto': case 'about': case 'rules': {
        const U = G._ui, pages = U.pages ?? [0], idx = G.ui.pageIdx;
        const close = () => { if (G.back === 'play') { G.scene = 'play'; G.show3d = true; G.ui.scroll = 0; } else toTitle(); };
        if (id === 'next') { if (idx >= pages.length - 1) close(); else G.ui.scroll = clamp(pages[idx + 1], 0, U.maxS); }
        else if (id === 'prev') { if (idx <= 0) close(); else G.ui.scroll = clamp(pages[idx - 1], 0, U.maxS); }
        break;
      }
      case 'break': if (id === 'go') { S.nextInnings(); G.scene = 'play'; G.paused = false; G.breakShown = false; evSeen = S.s.evId; persistMatch(); } break;
      case 'result':
        if (id === 'again') { if (G.practice) startPractice(G.practice.role); else if (G.watch) startWatch(); else startMatch(su.role, su.level, su.mode); }
        else if (id === 'learn') go('learn');
        else if (id === 'menu') toTitle();
        break;
      case 'demolimit': if (id === 'learn') go('learn'); else if (id === 'menu') toTitle(); break;
      default: break;
    }
  }

  // ---- store screenshots / headless showcase ---------------------------------------------------------------------------------------------------------------------------------
  function startShot() {
    const seed = config.seed >>> 0;
    const role = ROLE_KEYS[seed % 4];
    const sim = createSim({ role, level: 2 + (seed % 3), mode: 'quick', assist: 1 }, simRng.fork());
    setSim(sim); bot = makeBot(sim, { skill: 0.75, seed, aimWait: 1.6 });
    G.scene = 'play'; G.show3d = true; G.shot = true;
  }

  startAttract();
  if (config.shot) startShot();

  return {
    // Menus, Rules, About, settings, Learn practice, Watch & Learn, pause, Think and the computer's own innings are free; only real play counts against the preview.
    isPreviewExempt: () => {
      if (config.dev) return true;   // the developer toggle unlocks everything
      if (G.scene !== 'play' || G.watch || G.practice || G.paused || G.think || !S) return true;
      const s = S.s;
      if (s.phase === 'break' || s.phase === 'matchEnd') return true;
      return !(s.api.humanBats() || s.api.humanBowls() || s.api.humanFields());
    },
    update(dt, input) {
      G.tick++;
      // The kit has ONE pointer: a second finger landing makes it jump, and a second finger lifting reports "released" for the first finger too.
      // The game works on its own copy: a jump of more than 260 px in one tick is ignored (the position stays), and a release that comes with such a jump
      // is a stray finger lifting: the first finger is kept as "still down" (a ghost touch) while it keeps moving, and let go 0.25 s after it stops.
      {
        const kp = input.pointer, pp = { x: kp.x, y: kp.y, down: kp.down, pressed: kp.pressed, released: kp.released };
        const jump = lastPt ? Math.hypot(pp.x - lastPt.x, pp.y - lastPt.y) : 0;
        if (pp.pressed) ghost = null;
        if (ghost) {
          if (!pp.released && jump > 0 && jump <= 260 && jump > 1.5) { ghost.still = 0; lastPt = { x: pp.x, y: pp.y }; } else { ghost.still += dt; pp.x = lastPt.x; pp.y = lastPt.y; }
          if (ghost.still > 0.25 || kp.pressed) { pp.down = false; pp.released = true; ghost = null; lastPt = null; } else { pp.down = true; pp.released = false; }
        } else if (pp.released && lastPt && jump > 260 && G.scene === 'play') {
          ghost = { still: 0 }; pp.x = lastPt.x; pp.y = lastPt.y; pp.down = true; pp.released = false;
        } else {
          if (pp.down && !pp.pressed && lastPt && jump > 260) { pp.x = lastPt.x; pp.y = lastPt.y; }
          lastPt = pp.down ? { x: pp.x, y: pp.y } : null;
        }
        input = { pointer: pp, keys: input.keys };
      }
      setPress(input.pointer.down ? input.pointer.x : null, input.pointer.y);
      if (!G.paused) G.t += dt;
      stepped = false;
      playSfxQueue();
      if (G.shot) { if (S.s.phase === 'break') S.nextInnings(); if (!S.s.over) { bot(); S.update(dt); stepped = true; } updAt = nowMs(); return; }
      switch (G.scene) {
        case 'title': { const s = attract.s; S.update(dt); stepped = true; if (s.phase === 'break') attract.nextInnings(); if (s.over) startAttract(); uiInput(input); break; }
        case 'play': updatePlay(dt, input); break;
        default: uiInput(input); break;
      }
      if (stepped) updAt = nowMs();
    },
    render(ctx) {
      G.shade = G.scene === 'title';
      G.alpha = (stepped || G.shot) && env.clock ? clamp((nowMs() - updAt) / (DT * 1000), 0, 1) : 1;
      ctx.clearRect(0, 0, W, H);
      if (G.scene === 'play') renderPlay(ctx, G);
      else renderScreen(ctx, G);
    },
    getState: () => G,
    debug: { G, S: () => S, start: startMatch, go },
  };
}
