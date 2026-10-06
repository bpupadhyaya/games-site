// Pelota Vasca: the game shell. Scenes, input, persistence, preview wiring, Learn, Watch & Learn. The match itself lives in sim.js.
import { createSim } from './sim.js';
import { W, H, setSize, TEXT_SCALES, THINK_STEPS, readerLayout, setupPins, inRect } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ, ROLEGUIDE } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, hudRects, renderThink, watchHit } from './hud.js';
import { rayAt, camFor } from './camera.js';
import { HW, L, WALL_H, LEVELS, MATCH_POINTS, PACE_IDS } from './consts.js';
import { clamp } from './util.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen; the kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;
const STEP_MS = 1000 / 60;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, pace: 'normal', auto: true, autoAim: true, guide: true, thinkIdx: 1 },
    setup: { mode: '1v1', role: 'front', equip: 'hand', opp: 2, len: 'full', watch: false, watchA: 3, lastMode: 'ai' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', restoreMsg: '', setupMsg: '',
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null, tally: null },
    saved: null, record: { demoMatches: 0, wins: 0, played: 0 },
    sim: null, paused: false, pauseMenu: false, think: null, thinkRects: null, feedback: null, stick: { on: false, ox: 0, oy: 0, x: 0, y: 0 }, aimDrag: false,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0, alpha: 1, viewW: 720, viewH: 1280,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  // mouse wheel / trackpad: collected here, applied by whichever text screen is open (CSS px -> the 720-wide canvas space)
  let wheelDy = 0;
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('wheel', (e) => { wheelDy += e.deltaY * (e.deltaMode === 1 ? 32 : 1) * (720 / Math.max(240, Math.min(G.viewW || 720, G.viewH || 1280))); }, { passive: true });
  const takeWheel = () => { const d = wheelDy; wheelDy = 0; return d; };
  // wheel + keys (arrows, Page Up/Down, Space, Home, End) -> new scroll offset
  function navScroll(input, cur, max, page) {
    let v = cur + takeWheel();
    const k = input.keys;
    if (k.down.has('ArrowDown')) v += 14; if (k.down.has('ArrowUp')) v -= 14;
    if (k.pressed.has('PageDown') || k.pressed.has('Space')) v += page * 0.85;
    if (k.pressed.has('PageUp')) v -= page * 0.85;
    if (k.pressed.has('Home')) v = 0; if (k.pressed.has('End')) v = max;
    return clamp(v, 0, max);
  }
  let S = null, evSeen = 0, snap = null, simRng = rng.fork(), updAt = 0, stepped = false;
  const nowMs = () => (env.clock ? env.clock() : 0);

  // ---- persistence -------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); };
  const validSave = (d) => d && d.v === SAVE_VERSION && d.setup && d.match && Array.isArray(d.match.pts);
  const persistMatch = () => {
    if (!S || G.mode !== 'ai' || S.s.match.over) return;
    const d = { v: SAVE_VERSION, setup: { ...G.setup }, match: S.saveData() };
    snap = d; G.saved = { oppName: LEVELS[G.setup.opp - 1].name, pts: [...d.match.pts] };
    storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };
  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null)]).then(([s, l, r, mch]) => {
    if (s) Object.assign(G.settings, s);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (validSave(mch)) { snap = mch; G.saved = { oppName: LEVELS[clamp(mch.setup.opp, 1, 5) - 1].name, pts: [...mch.match.pts] }; }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!PACE_IDS.includes(G.settings.pace)) G.settings.pace = 'normal';
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    slap: (q, paddle) => { if (paddle) { tone({ freq: 520, to: 260, dur: 0.07, type: 'square', vol: 0.06 }); tone({ freq: 160, to: 90, dur: 0.1, type: 'sine', vol: 0.16 }); } else { tone({ freq: 240 + q * 120, to: 110, dur: 0.07, type: 'triangle', vol: 0.2 }); tone({ freq: 1500, to: 600, dur: 0.03, type: 'square', vol: 0.03 }); } },
    front: (v) => tone({ freq: 130, to: 70, dur: 0.12, type: 'sine', vol: Math.min(0.2, 0.05 + v * 0.01) }),
    side: (v) => tone({ freq: 170, to: 90, dur: 0.1, type: 'sine', vol: Math.min(0.14, 0.04 + v * 0.008) }),
    tin: () => { tone({ freq: 1250, to: 900, dur: 0.18, type: 'triangle', vol: 0.12 }); tone({ freq: 1870, to: 1400, dur: 0.14, type: 'sine', vol: 0.05 }); },
    floor: (v) => tone({ freq: 210, to: 120, dur: 0.07, type: 'sine', vol: Math.min(0.12, 0.03 + v * 0.01) }),
    whiff: () => tone({ freq: 400, to: 200, dur: 0.08, type: 'sawtooth', vol: 0.03 }),
    point: (win) => (win ? [0, 4, 7].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.18 + i * 0.04, type: 'triangle', vol: 0.09 })) : [0, -3].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22, type: 'triangle', vol: 0.07 }))),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.25, type: 'sine', vol: 0.05 }),
  };
  const delayed = [];
  const later = (f, t = 0.35) => delayed.push({ t, f });

  // ---- match lifecycle -------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim; evSeen = 0; G.feedback = null; G.think = null; G.stick = { on: false, ox: 0, oy: 0, x: 0, y: 0 }; G.aimDrag = false; };
  const levelOf = () => clamp(G.setup.opp, 1, 5);
  function startDemoBg() { setSim(createSim({ mode: '1v1', watch: true, watchLevels: [3, 3], points: 99, equip: 'hand', level: 3, pace: 'normal' }, simRng.fork())); G.mode = 'none'; }
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    const quick = st.len === 'quick' || demo;
    const base = { mode: st.mode, role: st.role, equip: demo ? 'hand' : st.equip, level: levelOf(), points: quick ? MATCH_POINTS.quick : MATCH_POINTS.full, pace: G.settings.pace };
    let cfg;
    if (kind === 'ai') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP && !opts.resume) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      cfg = { ...base };
    } else if (kind === 'watch') cfg = { ...base, watch: true, watchLevels: [st.watchA, levelOf()], points: MATCH_POINTS.quick, pace: 'normal', level: levelOf() };
    else if (kind === 'drill') cfg = { ...base, mode: '1v1', drill: opts.drill, level: 3, pace: 'normal' };
    if (opts.resume) cfg.resume = opts.resume;
    G.mode = kind;
    G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'ai') { if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
    S.setKind('drive', false);
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, d.setup);
    startMatch('ai', { resume: d.match, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; startDemoBg(); };

  // ---- learn --------------------------------------------------------------------------------------------
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    if (demo && G.learn.cur > 1) { G.setupMsg = 'The full game has every lesson.'; return; }
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.scene = 'quiz'; G.ui.scroll = 0; return; }
    G.learn.tally = { n: 0, ok: 0, left: false, kinds: new Set(), kindOk: new Set(), lastKind: null };
    startMatch('drill', { drill: { ...l.drill, n: l.n } });
    if (l.drill.kind === 'angle') S.setAim({ wall: 'left', z: 9, y: 2 });
  }
  function drillEvent(e) {
    const l = LESSONS[G.learn.cur], T = G.learn.tally;
    if (!T || !l) return;
    if (e.type === 'hit' && e.team === 0) { T.left = false; T.lastKind = e.kind; T.kinds.add(e.kind); }
    if (e.type === 'wall' && e.kind === 'left' && S.s.rally && !S.s.rally.frontHit) T.left = true;
    if (e.type === 'point') {
      let ok = e.winner === 0;
      if (l.id === 'angles') ok = ok && T.left;
      if (ok && T.lastKind) T.kindOk.add(T.lastKind);
      T.n++; if (ok) T.ok++;
      G.feedback = { t: S.s.t, text: ok ? 'Good' : 'Not this time', col: ok ? '#7fe8d6' : '#ffb59a' };
      T.left = false;
    }
    if (e.type === 'drillEnd') {
      let pass = T.ok >= l.need;
      if (l.id === 'dropLob') pass = pass && T.kindOk.has('drop') && T.kindOk.has('lob');
      G.learn.result = { score: T.ok, n: l.n, pass };
      if (pass) { G.learn.done[l.id] = true; saveSettings(); }
      G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; startDemoBg();
    }
  }

  // ---- events from the sim: sound, feedback, saving ------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.mode === 'drill') drillEvent(e);
      if (G.scene !== 'play' && G.mode !== 'none') continue;
      const hp = S.humanPlayer();
      if (e.type === 'hit') {
        sfx.slap(e.q, s.equip === 'paddle');
        if (hp && e.p === hp.id && G.mode !== 'watch') { const q = e.q; G.feedback = { t: s.t, text: q >= 0.85 ? 'PERFECT' : q >= 0.65 ? 'GOOD' : q >= 0.4 ? 'OK' : 'WEAK', col: q >= 0.85 ? '#7fe8d6' : q >= 0.65 ? '#ffe9a0' : q >= 0.4 ? '#fff6e4' : '#ff9a86' }; }
      } else if (e.type === 'whiff') {
        sfx.whiff();
        if (hp && e.p === hp.id && G.mode !== 'watch') { const w = e.why; G.feedback = { t: s.t, text: w === 'early' ? 'TOO EARLY' : w === 'late' ? 'TOO LATE' : w === 'reach' ? 'OUT OF REACH' : 'MISSED', col: '#ff9a86' }; }
      } else if (e.type === 'wall') {
        if (e.kind === 'front' || e.kind === 'high') sfx.front(e.speed);
        else if (e.kind === 'tin') sfx.tin();
        else if (e.kind === 'floor') sfx.floor(e.speed);
        else if (e.kind === 'left' || e.kind === 'back') sfx.side(e.speed);
      } else if (e.type === 'point') {
        sfx.whistle();
        const mine = e.winner === 0;
        later(() => sfx.point(mine));
        if (G.mode === 'ai') persistMatch();
      } else if (e.type === 'serveFault' || e.type === 'let') sfx.whistle();
      else if (e.type === 'matchEnd') {
        if (G.mode === 'ai' || G.mode === 'watch') {
          if (G.mode === 'ai') { clearSave(); G.record.played++; if (e.winner === 0) G.record.wins++; saveSettings(); }
          G.scene = 'result'; G.ui.scroll = 0;
        }
      }
    }
  }

  // ---- watch & learn ---------------------------------------------------------------------------------
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

  // ---- play input ------------------------------------------------------------------------------------
  function aimFromTap(x, y) {
    const r = rayAt(camFor(W / H), W, H, x, y);
    let best = null;
    if (r.d.z > 1e-4) { const t = (L - r.o.z) / r.d.z; const px = r.o.x + r.d.x * t, py = r.o.y + r.d.y * t; if (t > 0 && Math.abs(px) <= HW + 0.4 && py >= 0.3 && py <= WALL_H) best = { t, a: { wall: 'front', x: clamp(px, -HW + 0.2, HW - 0.2), y: clamp(py, 0.6, 4.0) } }; }
    if (r.d.x > 1e-4) { const t = (HW - r.o.x) / r.d.x; const pz = r.o.z + r.d.z * t, py = r.o.y + r.d.y * t; if (t > 0 && pz >= 2.5 && pz <= L - 0.3 && py >= 0.3 && py <= WALL_H && (!best || t < best.t)) best = { t, a: { wall: 'left', z: clamp(pz, 4, L - 0.8), y: clamp(py, 0.8, 4.0) } }; }
    return best ? best.a : null;
  }
  function openThink() {
    const sug = S.suggest();
    if (!sug) return;
    G.think = { kind: sug.kind, aim: sug.aim, reason: sug.reason, summary: sug.summary || '' };
  }
  function stickVec(px, py) {
    const st = G.stick;
    st.x = px; st.y = py;
    let dx = st.x - st.ox, dy = st.y - st.oy; const d = Math.hypot(dx, dy), R = 90;
    if (d > R) { st.x = st.ox + dx / d * R; st.y = st.oy + dy / d * R; dx = st.x - st.ox; dy = st.y - st.oy; }
    const k = Math.min(1, Math.hypot(dx, dy) / R);
    if (k < 0.16) return [0, 0, false];
    const l = Math.hypot(dx, dy) || 1;
    return [-dx / l * k, -dy / l * k, true];                      // screen right is world -x; screen down is toward the camera (-z)
  }
  let lastPtr = { x: 0, y: 0 };
  function updatePlay(dt, input) {
    const ptr = input.pointer, keys = input.keys;
    const s = S.s;
    if (G.mode === 'shot') { S.update(dt); stepped = true; processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.think) {
      if (ptr.pressed && G.thinkRects) {
        if (inRect(G.thinkRects.use, ptr.x, ptr.y)) { if (G.think.kind) { S.setKind(G.think.kind); S.setAim(G.think.aim); } G.think = null; sfx.tick(); }
        else if (inRect(G.thinkRects.close, ptr.x, ptr.y)) { G.think = null; sfx.tick(); }
        else if (G.thinkView && inRect(G.thinkView, ptr.x, ptr.y)) G.think.drag = { y0: ptr.y, s0: G.think.scroll || 0 };
      }
      if (G.think && G.thinkView) {
        const mx = G.thinkView.maxScroll;
        if (G.think.drag && ptr.down) G.think.scroll = clamp(G.think.drag.s0 - (ptr.y - G.think.drag.y0), 0, mx);
        if (ptr.released) G.think.drag = null;
        G.think.scroll = navScroll(input, G.think.scroll || 0, mx, G.thinkView.h);
        if (keys.pressed.has('Escape')) { G.think = null; sfx.tick(); }
      }
      return;
    }
    if (G.mode === 'watch') {
      if (ptr.pressed) {
        const i = watchHit(ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) { leaveMatch(); return; }
      }
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (!updateWatch(dt)) return;
      S.update(dt); stepped = true; processEvents();
      return;
    }
    const { lay, kinds, serving } = hudRects(G, S);
    if (ptr.pressed) {
      const x = ptr.x, y = ptr.y;
      lastPtr = { x, y };
      if (inRect(lay.util.pause, x, y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); return; }
      else if (inRect(lay.util.think, x, y)) { openThink(); return; }
      else if (inRect(lay.swing, x, y)) { if (serving) S.pressDrop(); else S.pressSwing(); }
      else {
        let hit = false;
        for (let i = 0; i < kinds.length; i++) if (inRect(lay.chips[i].rect, x, y)) { S.setKind(kinds[i]); sfx.tick(); hit = true; }
        if (!hit && inRect(lay.stickZone, x, y)) G.stick = { on: true, ox: x, oy: y, x, y };
        else if (!hit && y > lay.topH && y < lay.aimBottom) { const a = aimFromTap(x, y); if (a) { S.setAim(a); G.aimDrag = true; } }
      }
    }
    if (ptr.down) {
      const jump = Math.hypot(ptr.x - lastPtr.x, ptr.y - lastPtr.y);
      if (!(jump > 260 && (G.stick.on || G.aimDrag))) {            // a jump of the single pointer is a stray second finger: ignore it
        lastPtr = { x: ptr.x, y: ptr.y };
        if (G.aimDrag) { const a = aimFromTap(ptr.x, ptr.y); if (a) S.setAim(a); }
      }
    }
    if (!ptr.down && (G.stick.on || G.aimDrag)) { G.stick.on = false; G.aimDrag = false; }
    let sx = 0, sz = 0, on = false;
    if (G.stick.on) [sx, sz, on] = stickVec(lastPtr.x, lastPtr.y);
    const kd = keys.down;
    const kx = (kd.has('ArrowLeft') || kd.has('KeyA') ? 1 : 0) - (kd.has('ArrowRight') || kd.has('KeyD') ? 1 : 0);
    const kz = (kd.has('ArrowUp') || kd.has('KeyW') ? 1 : 0) - (kd.has('ArrowDown') || kd.has('KeyS') ? 1 : 0);
    if (kx || kz) { const l = Math.hypot(kx, kz); sx = kx / l; sz = kz / l; on = true; }
    S.setStick(sx, sz, on);
    S.s.ctl.auto = G.settings.auto; S.s.ctl.autoAim = G.settings.autoAim;
    if (keys.pressed.has('Space')) { if (serving) S.pressDrop(); else S.pressSwing(); }
    kinds.forEach((k, i) => { if (keys.pressed.has(`Digit${i + 1}`)) S.setKind(k); });
    if (keys.pressed.has('KeyT')) { openThink(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); return; }
    if (!kinds.includes(s.ctl.kind)) S.setKind(kinds[0], false);
    S.update(dt); stepped = true;
    processEvents();
  }

  // ---- menus -----------------------------------------------------------------------------------------------
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
    G.ui.scroll = navScroll(input, G.ui.scroll, max, mt.bottom - mt.top);
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    const st = G.setup;
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { st.watch = false; st.len = demo ? 'quick' : 'full'; go('setup'); G.setupMsg = ''; }
    else if (id === 'quick') { st.watch = false; st.len = 'quick'; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { st.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'learn') go('learn');
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
    if (id === 'mode-1') st.mode = '1v1';
    else if (id === 'mode-2') st.mode = '2v2';
    else if (id === 'role-front') st.role = 'front';
    else if (id === 'role-back') st.role = 'back';
    else if (id === 'role-guide') { G.back = 'setup'; go('roleguide'); }
    else if (id === 'eq-hand') st.equip = 'hand';
    else if (id === 'eq-paddle') { if (demo) { G.setupMsg = 'The paddle is in the full game.'; return; } st.equip = 'paddle'; }
    else if (id.startsWith('opp')) st.opp = +id.slice(3);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id.startsWith('wb')) st.opp = +id.slice(2);
    else if (id === 'len-full') { if (demo) { G.setupMsg = 'The full length match is in the full game.'; return; } st.len = 'full'; }
    else if (id === 'len-quick') st.len = 'quick';
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.watch) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
      startMatch(st.watch ? 'watch' : 'ai');
    } else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id.startsWith('pace-')) st.pace = id.slice(5);
    else if (id === 'set-auto') st.auto = !st.auto;
    else if (id === 'set-guide') st.guide = !st.guide;
    else if (id === 'set-autoaim') st.autoAim = !st.autoAim;
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveSettings();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastMode === 'watch' ? 'watch' : 'ai');
    else if (id === 'new') { if (G.setup.lastMode === 'watch') startMatch('watch'); else go('setup'); }
    else if (id === 'menu') { go('title'); startDemoBg(); }
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id === 'role-tut') { G.back = 'learn'; go('roleguide'); }
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learn.cur = +id.slice(6); go('lesson'); }
  }
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go('learn'); }
  function handleQuiz(id) {
    if (!id) return;
    sfx.tick();
    const i = +id.slice(3);
    if (i === QUIZ[G.learn.qi].ok) G.learn.qscore++;
    G.learn.qi++;
    if (G.learn.qi >= QUIZ.length) {
      const l = LESSONS[G.learn.cur];
      G.learn.result = { score: G.learn.qscore, n: QUIZ.length, pass: G.learn.qscore >= l.need };
      if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
      go('lessonresult');
    } else G.ui.scroll = 0;
  }
  function handleLessonResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'lr-again') startLesson();
    else if (id === 'lr-next') { G.learn.cur = Math.min(LESSONS.length - 1, G.learn.cur + 1); go('lesson'); }
    else if (id === 'lr-list') go('learn');
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
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const list = G.scene === 'howto' ? HOWTO : G.scene === 'about' ? aboutList : G.scene === 'rules' ? RULES : ROLEGUIDE;
    MN.ensureReader(G, list, G.scene === 'howto' ? 'How to Play' : G.scene === 'about' ? 'About' : G.scene === 'rules' ? 'Rules' : 'Role guide');
    const rd = MN.readerMeta(), RL = readerLayout(), V = RL.view;
    const max = Math.max(0, rd.contentH - rd.viewH);
    const close = () => { G.scene = G.back === 'play' ? 'play' : G.back === 'setup' ? 'setup' : G.back === 'learn' ? 'learn' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; };
    const next = () => { if (max <= 0) close(); else if (G.ui.scroll >= max - 4) G.ui.scroll = 0; else G.ui.scroll = clamp(G.ui.scroll + V.h * 0.85, 0, max); };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y)) next();
      else if (inRect(RL.back, ptr.x, ptr.y)) close();
      else if (inRect(RL.dec, ptr.x, ptr.y)) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); }
      else if (inRect({ x: V.x - 6, y: V.y, w: V.w + 12, h: V.h }, ptr.x, ptr.y)) G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) G.ui.scroll = clamp(G.ui.drag.s0 - (ptr.y - G.ui.drag.y0), 0, max);
    if (ptr.released) G.ui.drag = null;
    G.ui.scroll = navScroll(input, G.ui.scroll, max, V.h);
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft') || keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = setupPins();
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ?shot=1 (store screenshots): a real match played by a coached side, frozen after N ticks, with the full HUD
  function startShot() {
    G.mode = 'shot'; G.setup.lastMode = 'shot';
    const q = config.shotOpts || {};
    setSim(createSim({ mode: q.mode || '1v1', role: q.role || 'back', equip: q.equip || 'hand', level: 4, bot: true, points: 22, pace: 'normal' }, simRng.fork()));
    G.scene = 'play';
  }
  // The live screen size (fluid viewport). When it changes (rotation, window resize) the thumb-stick and aim drags are dropped (their
  // coordinates belong to the old layout); the match itself, its scores and its clock are untouched.
  let sizeKey = '';
  function syncSize() {
    setSize(meta.width, meta.height);
    const k = `${W}x${H}`;
    if (k !== sizeKey) { if (sizeKey) { G.stick = { on: false, ox: 0, oy: 0, x: 0, y: 0 }; G.aimDrag = false; G.ui.drag = null; if (G.think) G.think.drag = null; } sizeKey = k; G.size = k; }
  }
  syncSize();
  function startup() { if (config.shot) startShot(); else startDemoBg(); }
  startup();

  return {
    // Menus, Rules, About, settings, Learn text and Watch & Learn are free; only real play counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'ai' || G.mode === 'drill')) || G.paused || G.pauseMenu || !!G.think || (S && (S.s.phase === 'dead' || S.s.phase === 'over' || S.s.phase === 'ready' || S.s.phase === 'serve')),
    update(dt, input) {
      syncSize();
      setPress(input.pointer);
      G.t += dt;
      stepped = false;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play' && S && G.mode === 'none') { if (S.s.hold) S.release(); S.update(dt); stepped = true; }
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'lesson': updateFlowScene(dt, input, handleLesson, 'lesson'); break;
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': case 'roleguide': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      if (stepped) updAt = nowMs();
    },
    render(ctx, view) {
      syncSize();
      G.viewW = (view && view.cssW) || 720; G.viewH = (view && view.cssH) || 1280;
      G.alpha = stepped && env.clock ? clamp((nowMs() - updAt) / STEP_MS, 0, 1) : 1;
      ctx.clearRect(0, 0, W, H);
      if (view && view.noGL) renderFallback(ctx, G, view);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'learn': MN.renderLearn(ctx, G); break;
        case 'lesson': MN.renderLesson(ctx, G); break;
        case 'quiz': MN.renderQuiz(ctx, G); break;
        case 'lessonresult': MN.renderLessonResult(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'roleguide': MN.renderPages(ctx, G, ROLEGUIDE, 'Role guide'); break;
        case 'play':
          renderHud(ctx, G, S, { cssW: G.viewW, cssH: G.viewH });
          if (G.think) renderThink(ctx, G);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
}
