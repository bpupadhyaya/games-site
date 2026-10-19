// Contract exports, scene manager, saves and input routing. Chapters live in ./chapters/, all
// story text in ./text.js, the shared look in ./stage.js + ./puppets.js + ./ui.js.
import { T } from './text.js';
import { W, H, PAL, clamp, sky, sun, sea, clouds, stars, skyline, motes, finish, filigree, light, fillView } from './stage.js';
import { FR, host, mode, DOC, screenFrame, fitFrame, pinFrame, useFrame, toDesign, PLAY_S } from './frame.js';
import { drawLockup, drawMoreLine, setLogo, setLockup } from './brand.js';
import { figure, poses, tenCrowned } from './puppets.js';
import { bindCanvas } from './paint/kit.js';
import { warmFigureParts } from './paint/rig.js';
import { warmBody as warmRavanBody, warmHead as warmRavanHead, HEAD_COUNT as RAVAN_HEADS } from './paint/ravan.js';
import * as ui from './ui.js';
import { renderCast, renderIcon, renderSheet } from './cast.js';
import { warmBustParts } from './portraits.js';
import { worldArt } from './art.js';
import { createRng } from '../kit/rng.js';
import { DEMOS, COACH, createDriver, IDLE } from './demos.js';
import { AP_THINK_STEPS, AP_REVEAL_TIME, createApDriver, AP_SCRIPTS } from './autoplay.js';
import { renderDemoBar, renderDemoCaption, renderDemoWorld, renderCoach, renderPause, renderControls, DEMO_SKIP } from './teach.js';
import { renderRules } from './rules.js';
import * as c01 from './chapters/01-bow.js';
import * as c02 from './chapters/02-exile.js';
import * as c03 from './chapters/03-forest.js';
import * as c04 from './chapters/04-regency.js';
import * as c05 from './chapters/05-deer.js';
import * as c06 from './chapters/06-allies.js';
import * as c07 from './chapters/07-flight.js';
import * as c08 from './chapters/08-night.js';
import * as c09 from './chapters/09-burn.js';
import * as c10 from './chapters/10-bridge.js';
import * as c11 from './chapters/11-war.js';
import * as c12 from './chapters/12-duel.js';
import * as c13 from './chapters/13-return.js';

// Fluid viewport (kit 1.7): the short side is always 720 units, the long side follows the screen. See frame.js.
export const meta = { width: W, height: H, fluid: { short: 720 } };
// Mouse wheel (main.js adds CSS px converted to screen units) scrolls the reading pages and the road.
export const wheelInput = { dy: 0 };

const CHAPTERS = [c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12, c13];
const N = CHAPTERS.length;
const DEMO_CHAPTERS = 3;          // the public web demo stops after this chapter
const SHOWCASE_BASE = 9000;       // seeds 9001..9013 open straight into that chapter (screenshots, tests)
const AP_MAX_TRIES = 6;           // Auto Play: retries "the path is lost" this many times before moving on regardless

const SFX = {
  tap: { freq: 520, dur: 0.06, type: 'triangle', vol: 0.08 },
  good: { freq: 660, to: 990, dur: 0.16, type: 'sine', vol: 0.12 },
  bad: { freq: 220, to: 140, dur: 0.22, type: 'sine', vol: 0.12 },
  star: { freq: 880, to: 1320, dur: 0.3, type: 'sine', vol: 0.12 },
  arrow: { freq: 900, to: 300, dur: 0.12, type: 'triangle', vol: 0.08 },
  thud: { freq: 120, to: 60, dur: 0.2, type: 'sine', vol: 0.18 },
  whoosh: { freq: 300, to: 700, dur: 0.25, type: 'sine', vol: 0.06 },
  chime: { freq: 1180, to: 1570, dur: 0.22, type: 'sine', vol: 0.08 },
  horn: { freq: 196, to: 262, dur: 0.5, type: 'sawtooth', vol: 0.07 },
  fire: { freq: 160, to: 420, dur: 0.18, type: 'sawtooth', vol: 0.05 },
  splash: { freq: 500, to: 120, dur: 0.2, type: 'triangle', vol: 0.07 },
};

export function createGame(env) {
  const { storage, audio, config } = env;
  const dev = config.dev === true;
  const demo = config.demo === true;
  const showKeys = env.monetization?.mode !== 'native';     // key names are only taught where a keyboard exists
  const testN = !demo && config.seed > 9200 && config.seed <= 9200 + N ? config.seed - 9200 : 0;   // tests: open chapter n's card with the road unlocked
  const showcaseN = !demo && config.seed > SHOWCASE_BASE && config.seed <= SHOWCASE_BASE + N ? config.seed - SHOWCASE_BASE : 0;

  const state = {
    scene: 'title', t: 0, sceneT: 0, fade: 0,
    chapter: 0, ch: null, stars: 0,
    progress: { unlocked: 1, stars: {}, last: 0 },
    muted: false, rm: false, ally: null,
    roadScroll: 0, roadVel: 0, drag: null, worldPage: 0, worldScroll: 0,
    tut: { seen: {} }, keepT: 0, demo: null, ctrlScroll: 0, ctrlFrom: 'title', ctrlH: 4000, coach: null,
    rulesScroll: 0, rulesFrom: 'title', rulesH: 4000,
    textScaleIdx: 0, // index into ui.TEXT_SCALES - the About/Controls/Rules text-size stepper. Some
    // players wear glasses, some don't; this lets each pick their own comfortable size.
    refBottom: 1140, // last-rendered bottom of the about/end/demo-limit story card; see simpleBack()
    worldBottom: 1140, // last-rendered bottom of the world (Story & Its World) card; see worldButtons()
    // Auto Play: a free, silent, whole-journey THINK -> REVEAL -> ACT demonstration (STATUS.md).
    // apThinkIdx is an index into AP_THINK_STEPS (never a raw float); apAlly/apTotalStars are this
    // session's own throwaway equivalents of state.ally/totalStars() - the real ones are never read
    // or written by Auto Play.
    apThinkIdx: 1, ap: null, apAlly: null, apTotalStars: 0,
  };
  let demoInst = null, driver = null, ctrlDrag = null, rulesDrag = null, worldDrag = null, scrollBar = null;
  // Reading pages: a thin scroll bar on the right screen edge (drag it, or drag the page, wheel, arrows, PageUp/PageDown, Home/End).
  const barGeom = (max, docH) => {
    const sw = F.sw, sh = F.sh, x = sw - Math.max(8, host.r + 4) - 10, y0 = ui.HUD.back.y + ui.HUD.back.h + 16, y1 = sh - Math.max(14, host.b + 10);
    const h = y1 - y0, th = clamp(h * (F.doc.h / Math.max(docH, 1)), 44, h);
    return { x, y0, h, th, max };
  };
  const barHit = (ps, max, docH) => { if (max <= 0) return false; const g = barGeom(max, docH); return ps.x >= g.x - 34 && ps.y >= g.y0 - 10 && ps.y <= g.y0 + g.h + 10; };
  const barScroll = (ps, max, docH) => { const g = barGeom(max, docH); return clamp((ps.y - g.y0 - g.th / 2) / Math.max(1, g.h - g.th), 0, 1) * max; };
  const pageKeys = (name, maxFn, keys) => {
    const m = maxFn();
    if (keys.pressed.has('PageDown')) state[name] = clamp(state[name] + F.doc.h * 0.85, 0, m);
    if (keys.pressed.has('PageUp')) state[name] = clamp(state[name] - F.doc.h * 0.85, 0, m);
    if (keys.pressed.has('Home')) state[name] = 0;
    if (keys.pressed.has('End')) state[name] = m;
  };
  function drawScrollBar(ctx, scroll, max, docH) {
    if (max <= 0) return;
    const g = barGeom(max, docH), top = g.y0 + (g.h - g.th) * clamp(scroll / max, 0, 1);
    ctx.save(); ctx.fillStyle = 'rgba(8,2,8,0.45)'; ctx.beginPath(); ctx.roundRect(g.x, g.y0, 8, g.h, 4); ctx.fill();
    ctx.fillStyle = 'rgba(242,196,106,0.85)'; ctx.beginPath(); ctx.roundRect(g.x, top, 8, g.th, 4); ctx.fill(); ctx.restore();
  }
  let cur = null, apInst = null, apDriver = null;

  const sfx = (name) => { const s = SFX[name]; if (s) audio.tone(s); };
  const saveProgress = () => storage.set('progress', state.progress);
  const saveTextScale = () => storage.set('textScaleIdx', state.textScaleIdx);
  const growText = () => { if (state.textScaleIdx < ui.TEXT_SCALES.length - 1) { state.textScaleIdx++; saveTextScale(); sfx('tap'); } };
  const shrinkText = () => { if (state.textScaleIdx > 0) { state.textScaleIdx--; saveTextScale(); sfx('tap'); } };
  const textScale = () => ui.TEXT_SCALES[state.textScaleIdx] ?? 1;
  const saveApThink = () => storage.set('apThinkIdx', state.apThinkIdx);

  Promise.all([storage.get('progress', null), storage.get('muted', false), storage.get('reducedMotion', false), storage.get('ally', null), storage.get('tutorial', null), storage.get('textScaleIdx', 0), storage.get('apThinkIdx', 1)]).then(([p, m, rm, ally, tut, tsi, apti]) => {
    if (tut && typeof tut.seen === 'object' && tut.seen) state.tut = { seen: { ...tut.seen, ...state.tut.seen } };
    if (p && typeof p.unlocked === 'number') {
      state.progress = { unlocked: clamp(Math.max(Math.floor(p.unlocked), state.progress.unlocked), 1, N), stars: { ...(p.stars ?? {}), ...state.progress.stars }, last: state.progress.last || (p.last ?? 0) };
    }
    state.muted = m === true; audio.setMuted(state.muted);
    state.rm = rm === true;
    if (ally && !state.ally) state.ally = ally;
    // Guarded and clamped: a stale saved index from a build with a shorter/longer scale array must
    // never produce a NaN or out-of-range size (this exact bug once broke every font on a reference
    // page down to the browser's default tiny font).
    state.textScaleIdx = Math.min(Math.max(Math.floor(Number(tsi) || 0), 0), ui.TEXT_SCALES.length - 1);
    state.apThinkIdx = Math.min(Math.max(Math.floor(Number(apti) || 0), 0), AP_THINK_STEPS.length - 1);
  });

  const go = (scene) => { state.scene = scene; state.sceneT = 0; state.fade = 1; };
  const resetCoach = () => { state.coach = { taps: 0, hold: 0, drag: 0, rel: 0, sx: 0, sy: 0, done: false, doneT: 0, keys: 0 }; };
  const tutSave = () => storage.set('tutorial', state.tut);

  // ---- the teaching demo: the chapter's real update/render on a separate, scripted instance ----
  function startDemo(n, from) {
    const spec = DEMOS[n];
    if (!spec) { finishDemo(from, n); return; }
    const denv = { ...env, rng: createRng(0x5eed00 + n) };       // its own dice: the real chapter's rng is never touched
    demoInst = CHAPTERS[n - 1].create(denv, {
      T, text: T.chapters[n - 1], sfx, rm: () => state.rm, ally: () => null, setAlly: () => {}, showcase: !!spec.showcase, dev: false,
    });
    spec.setup?.(demoInst.state);
    for (let i = 0; i < Math.round((spec.pre ?? 0) * 60); i++) demoInst.update(1 / 60, IDLE);
    driver = createDriver(demoInst);
    state.demo = { n, from, t: 0, dur: spec.dur, cuts: [] };
    go('demo'); state.fade = 0.6;
  }
  function finishDemo(from, n) {
    state.tut.seen[String(n)] = true; tutSave();
    demoInst = null; driver = null; state.demo = null;
    if (from === 'play') { go('play'); state.fade = 0.8; resetCoach(); }
    else if (from === 'pause') { state.scene = 'pause'; state.sceneT = state.keepT ?? 0; state.fade = 0.4; }
    else go('card');
  }

  // ---- Auto Play: a free, silent, whole-journey THINK -> REVEAL -> ACT demonstration --------------
  // Decision-point unit: one WHOLE CHAPTER (not one tap/drag inside it). This game has 13 different
  // verbs and no single move-by-move shape a THINK/REVEAL pause could sit inside without breaking
  // every one of them differently; its own top-level loop already treats a chapter as one unit
  // (road -> story card -> scene -> result -> Onward), so that unit is reused here rather than
  // invented. THINK reuses that same story-card pause (now timed by the stepper instead of a tap);
  // REVEAL is a short confirmation; ACT plays the whole chapter for real, using autoplay.js's
  // per-chapter scripts (built on top of demos.js's own targeting techniques - see its header) and
  // the chapter's own real update/render/result(), on an entirely separate instance exactly like
  // startDemo()'s demoInst above - the real state.progress/state.ch/state.stars are never touched.
  function apOpenChapter(n, tries) {
    apInst = CHAPTERS[n - 1].create({ ...env, rng: createRng(0xA10000 + n * 977 + tries) }, {
      T, text: T.chapters[n - 1], sfx: () => {}, rm: () => state.rm, ally: () => state.apAlly, setAlly: (v) => { state.apAlly = v; }, showcase: false, dev: false,
    });
    apDriver = createApDriver();
  }
  function startAutoplay() {
    state.apAlly = null; state.apTotalStars = 0;
    state.ap = { n: 1, phase: 'think', t: 0, tries: 0, paused: false, stars: 0, forced: false };
    apOpenChapter(1, 0);
    go('autoplay');
  }
  function exitAutoplay() { apInst = null; apDriver = null; go('title'); }
  function updateAutoplay(dt, input, ps, pu) {
    const A = state.ap;
    if (A.phase === 'finished') {
      if (pu.pressed) { if (ui.hit(apEnd().again, pu)) startAutoplay(); else if (ui.hit(apEnd().exit, pu)) exitAutoplay(); }
      return;
    }
    if (ps.pressed) {
      if (ui.hit(AP.exit, ps)) { exitAutoplay(); return; }
      if (ui.hit(AP.dec, ps) && state.apThinkIdx > 0) { state.apThinkIdx--; saveApThink(); }
      else if (ui.hit(AP.inc, ps) && state.apThinkIdx < AP_THINK_STEPS.length - 1) { state.apThinkIdx++; saveApThink(); }
      else if (ui.hit(AP.pause, ps)) A.paused = !A.paused;
    }
    if (A.paused) return;
    const skip = ps.pressed && ui.hit(AP.skip, ps);
    if (A.phase === 'think') {
      A.t += dt; if (skip) A.t = AP_THINK_STEPS[state.apThinkIdx];
      if (A.t >= AP_THINK_STEPS[state.apThinkIdx]) { A.phase = 'reveal'; A.t = 0; }
    } else if (A.phase === 'reveal') {
      A.t += dt; if (skip) A.t = AP_REVEAL_TIME;
      if (A.t >= AP_REVEAL_TIME) A.phase = 'act';
    } else if (A.phase === 'act') {
      const steps = skip ? 45 : 1;    // Skip fast-forwards the simulation itself, never a fake result
      for (let i = 0; i < steps; i++) {
        useFrame(F.world); mode.hud = true;
        apDriver.beginTick(1 / 60);
        AP_SCRIPTS[A.n](apDriver, apInst.state);
        apInst.update(1 / 60, apDriver.input);
        mode.hud = false;
        const r = apInst.result();
        if (r) {
          if (r.lost) {
            A.tries += 1;
            // The path is lost -> try again, exactly like real play, up to a bounded number of times
            // (a genuinely unlucky seed should never hang Auto Play forever).
            if (A.tries >= AP_MAX_TRIES) { A.stars = 1; A.forced = true; A.phase = 'result'; A.t = 0; state.apTotalStars += 1; }
            else apOpenChapter(A.n, A.tries);
          } else { A.stars = r.stars; A.forced = false; A.phase = 'result'; A.t = 0; state.apTotalStars += r.stars; }
          break;
        }
      }
    } else if (A.phase === 'result') {
      A.t += dt; if (skip) A.t = 1.8;
      if (A.t >= 1.8) {
        if (A.n >= N) { A.phase = 'finished'; A.t = 0; }
        else { A.n += 1; A.tries = 0; apOpenChapter(A.n, 0); A.phase = 'think'; A.t = 0; }
      }
    }
  }

  function leaveControls() {
    ctrlDrag = null; state.fade = 0.4;
    if (state.ctrlFrom === 'pause') { state.scene = 'pause'; state.sceneT = state.keepT ?? 0; } else go(state.ctrlFrom);
  }
  function leaveRules() {
    rulesDrag = null; state.fade = 0.4;
    if (state.rulesFrom === 'pause') { state.scene = 'pause'; state.sceneT = state.keepT ?? 0; } else go(state.rulesFrom);
  }
  const beginPlay = () => {
    sfx('good');
    if (!state.tut.seen[String(state.chapter)] && DEMOS[state.chapter]) startDemo(state.chapter, 'play');
    else { go('play'); state.fade = 0; resetCoach(); }
  };
  const totalStars = () => Object.values(state.progress.stars).reduce((a, b) => a + b, 0);
  const isOpen = (n) => dev || n <= state.progress.unlocked;
  const roadMax = () => Math.max(0, ui.roadHeight(N) - (F ? vh() : H));
  const focusRoad = (n) => { state.roadScroll = clamp(ui.roadNode(n - 1, N).y - (F ? vh() : H) * 0.55, 0, roadMax()); state.roadVel = 0; };

  // Which character looks each chapter uses: their sprites are built one look per frame while the
  // story card is read, so playing the chapter never re-triggers their first-use cost.
  const WARM = [null, ['prince', 'princess', 'king', 'citizen', 'woman'], ['prince', 'princess', 'brother', 'citizen', 'woman'], ['prince_f', 'princess_f', 'brother_f', 'raider'], ['bharat', 'citizen'], ['prince_f'], ['vanara', 'leaper'], ['leaper'], ['raider', 'leaper', 'leaper_c', 'princess_f'], ['leaper'], ['vanara', 'leaper'], ['vanara', 'raider', 'leaper', 'vking'], ['prince', 'vanara', 'vibhishan', 'ravan'], ['leaper_c', 'brother', 'prince', 'princess', 'king', 'bharat', 'citizen', 'woman']];
  let warm = [];

  // PERF: a shared queue-drainer. Each queued entry is one GROUP of `sprite()` builds (paint/kit.js) -
  // one look's whole rig, or one effigy part - run together, so a group never straddles two frames.
  // web/src must stay deterministic (no wall-clock reads), so this can't adapt to how slow a group
  // actually was; it only bounds how much unbuilt work can pile into any one frame to "one group",
  // instead of a whole chapter's cast (or the title effigy's ten heads) landing on a single frame.
  function drainGroup(queue) {
    if (queue.length) for (const fn of queue.shift()) fn();
  }

  // PERF: the title screen's cast (Ram, Hanuman, the ten-crowned effigy - see titleBackdrop below)
  // used to be built the first time it was drawn: one huge synchronous frame (measured ~4.6s-6.9s of
  // main-thread block under 4x-6x CPU throttling, almost entirely the ten fan heads' per-pixel relief
  // lighting - see STATUS.md). `titleReady` gates what titleBackdrop() draws, so a character/the
  // effigy simply doesn't appear until its own group has been built, instead of the whole screen
  // waiting on all three. Drained from render() (see below), one group per frame, only while the
  // title is the visible scene.
  const titleReady = { leaper: false, prince: false, ravan: false };
  const bootQueue = [];
  const pushBoot = (tasks, onDone) => bootQueue.push([...tasks, onDone]);
  pushBoot(warmFigureParts('leaper', 0, 'calm'), () => { titleReady.leaper = true; });
  pushBoot(warmFigureParts('prince', 0, 'calm'), () => { titleReady.prince = true; });
  pushBoot([...warmRavanBody(), ...Array.from({ length: RAVAN_HEADS }, (_, i) => warmRavanHead(i)).flat()], () => { titleReady.ravan = true; });
  function openChapter(n, scene = 'card') {
    warm = [];
    for (const kind of WARM[n] || []) warm.push(warmFigureParts(kind, 0, 'calm'));
    // Some chapters tint a warmed kind with their own accent colours (crowds/rosters/unit icons -
    // see e.g. 06-allies.js, 11-war.js `WARM_LOOKS`), which is a distinct sprite-cache entry per
    // colour that the plain kind list above never touches.
    for (const [kind, gold] of CHAPTERS[n - 1].WARM_LOOKS || []) warm.push(warmFigureParts(kind, 0, 'calm', gold));
    warm.push(warmBustParts(T.chapters[n - 1].portrait));   // the story card's own portrait (see ui.storyCard `who`)
    if (demo && n > DEMO_CHAPTERS) { cur = null; state.ch = null; go('demo-limit'); return; }
    state.chapter = n;
    cur = CHAPTERS[n - 1].create(env, {
      T, text: T.chapters[n - 1], sfx, rm: () => state.rm, ally: () => state.ally,
      setAlly: (v) => { state.ally = v; storage.set('ally', v); }, showcase: showcaseN === n && state.t === 0, dev,
    });
    state.ch = cur.state;
    resetCoach();
    go(scene);
    env.monetization.track('chapter_start', { chapter: n });
  }

  function win(starsWon) {
    const n = state.chapter, key = String(n);
    state.stars = clamp(Math.round(starsWon), 1, 3);
    state.progress.stars[key] = Math.max(state.progress.stars[key] ?? 0, state.stars);
    state.progress.unlocked = Math.max(state.progress.unlocked, Math.min(N, n + 1));
    state.progress.last = n;
    saveProgress();
    env.monetization.track('chapter_complete', { chapter: n, stars: state.stars });
    sfx('star');
    go('result');
    state.fade = 0;
  }

  // ---- frames (see frame.js) ----
  // F.scr   screen units: HUD icons, A-/A+ stepper, Auto Play row, scroll bar          F.world  a chapter's world and its HUD
  // F.ui    the 720 column of menus and cards                                           F.title  the title column (right of the art)
  // F.doc   the reading column of Rules / Controls                                      F.bg     the backdrop art (title, reading pages)
  // Portrait: one frame for everything (the design column fitted to the height). Landscape: re-laid out, see the layouts below.
  let F = null, fKey = '';
  const ART_S = 0.85;
  const AP = { dec: ui.TEXT_STEP.dec, inc: ui.TEXT_STEP.inc, exit: { x: 20, y: 1462, w: 200, h: 76 }, pause: { x: 260, y: 1462, w: 200, h: 76 }, skip: { x: 500, y: 1462, w: 200, h: 76 } };
  function refreshFrames() {
    const sw = Math.round(meta.width), sh = Math.round(meta.height);
    // a chapter may choose its landscape window: LAND_Y1 = design y at the bottom edge, LAND_S = scale (numbers, or functions of its state)
    const mod = CHAPTERS[state.chapter - 1], pick = (v, d) => (typeof v === 'function' ? v(cur?.state) : v ?? d);
    const ly1 = pick(mod?.LAND_Y1, H), ls = pick(mod?.LAND_S, PLAY_S);
    const key = `${sw}x${sh}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${ly1}|${ls}`;
    if (F && key === fKey) return F;
    fKey = key;
    const scr = screenFrame(sw, sh);
    if (sw <= sh) {
      const f = fitFrame(sw, sh);
      F = { scr, world: f, ui: f, title: f, doc: f, bg: f, land: false, sw, sh };
      DOC.w = W;
    } else {
      const world = pinFrame(sw, sh, ls, W / 2, ly1, sw / 2, sh);
      const ui0 = pinFrame(sw, sh, 1, W / 2, 0, sw / 2, 0);
      const tcx = Math.max(W / 2 + 16, Math.min(sw * 0.72, sw - W / 2 - 16));
      DOC.w = clamp(sw - 120, W, 980);
      F = {
        scr, world, ui: ui0, land: true, sw, sh,
        title: pinFrame(sw, sh, 1, W / 2, 0, tcx, 0),
        doc: pinFrame(sw, sh, 1, DOC.w / 2, 0, sw / 2, 0),
        bg: pinFrame(sw, sh, ART_S, 360, 900, Math.min(sw * 0.3, tcx - 330), sh * 0.62),
      };
    }
    ui.layoutScreen(sw, sh);
    // Auto Play row (screen units): bottom of the screen, three even buttons centred on the screen
    const ax = (sw - W) / 2, ay = sh - Math.max(0, host.b) - 98;
    Object.assign(AP.exit, { x: ax + 20, y: ay }); Object.assign(AP.pause, { x: ax + 260, y: ay }); Object.assign(AP.skip, { x: ax + 500, y: ay });
    Object.assign(DEMO_SKIP, { x: sw - Math.max(30, host.r + 12) - 196, y: ui.HUD.mute.y + 2, w: 196, h: 68 });
    return F;
  }
  const LAND = () => !!F && F.land;
  const vh = () => F.ui.h;                                   // visible height of the ui column (1560 in portrait at the design size, 720 in landscape)
  const topPad = () => Math.max(0, host.t / F.ui.s);
  // landscape card + button column: the card (portrait, text) on the left, the buttons stacked on the right, both centred
  const COLS = () => { const bw = 330, gap = 26, cw = clamp(F.ui.w - 90 - bw - gap, 520, 900), x0 = W / 2 - (cw + gap + bw) / 2; return { bw, cw, cx: x0, bx: x0 + cw + gap }; };

  let lockPress = 0;   // frames left of the dimmed look after a tap on the lockup
  const titleButtons = () => {
    const cont = state.progress.last > 0 || state.progress.unlocked > 1;
    const playLabel = cont ? `${T.ui.continue}: ${T.ui.chapterWord} ${state.progress.unlocked}` : T.ui.begin;
    const sound = state.muted ? T.ui.soundOff : T.ui.soundOn, motion = state.rm ? T.ui.motionReduced : T.ui.motionFull;
    if (LAND()) {
      const y0 = 250 + topPad();
      return [
        { id: 'play', x: 90, y: y0, w: 540, h: 92, label: playLabel, primary: true },
        { id: 'road', x: 90, y: y0 + 106, w: 262, h: 76, label: T.ui.road, size: 28 },
        { id: 'howto', x: 368, y: y0 + 106, w: 262, h: 76, label: T.howto.controls, size: 28 },
        { id: 'sound', x: 90, y: y0 + 194, w: 262, h: 76, label: sound, size: 26 },
        { id: 'motion', x: 368, y: y0 + 194, w: 262, h: 76, label: motion, size: 26 },
        { id: 'world', x: 90, y: y0 + 280, w: 169, h: 78, label: 'World', size: 24 },
        { id: 'rules', x: 275, y: y0 + 280, w: 169, h: 78, label: T.rules.title, size: 24 },
        { id: 'auto', x: 460, y: y0 + 280, w: 170, h: 78, label: 'Auto Play', size: 24 },
      ];
    }
    return [
      { id: 'play', x: 90, y: 846, w: 540, h: 104, label: playLabel, primary: true },
      { id: 'road', x: 90, y: 966, w: 540, h: 84, label: T.ui.road },
      { id: 'howto', x: 90, y: 1064, w: 540, h: 84, label: T.howto.controls },
      { id: 'sound', x: 90, y: 1164, w: 262, h: 76, label: sound, size: 28 },
      { id: 'motion', x: 368, y: 1164, w: 262, h: 76, label: motion, size: 28 },
      // World/Chapter Guide/Auto Play share one row, three even columns at the same y and overall
      // span (90..630) the row has always had - was 2 columns (World, Chapter Guide), widened to 3
      // for the Auto Play addition; both older labels sized down a step to stay comfortable at the
      // narrower width (short button-only labels, not the full title used elsewhere for these two).
      { id: 'world', x: 90, y: 1256, w: 169, h: 82, label: 'World', size: 24 },
      { id: 'rules', x: 275, y: 1256, w: 169, h: 82, label: T.rules.title, size: 24 },
      { id: 'auto', x: 460, y: 1256, w: 170, h: 82, label: 'Auto Play', size: 24 },
    ];
  };
  // The Arcforge lockup directly under the last title button (tap: the Arcforge home); drawn in the title frame.
  const lockupBtn = () => {
    const tb = titleButtons(), last = tb[tb.length - 1], w = LAND() ? 250 : 330, h = Math.round(w * 327 / 1200);
    const y = LAND() ? Math.min(last.y + last.h + 10, vh() - h - 8 - Math.max(0, host.b / F.title.s)) : last.y + last.h + 10;
    const m = Math.ceil(44 / ((host.px || 0.6))), pw = Math.max(w, m), ph = Math.max(h, m);
    return { id: 'arcforge', x: 360 - pw / 2, y: y + h / 2 - ph / 2, w: pw, h: ph, art: { x: 360, y, w, h } };
  };
  const cardButton = () => (LAND() ? { x: COLS().bx, y: vh() / 2 - 112, w: COLS().bw, h: 104, label: T.ui.play } : { x: 160, y: 1240, w: 400, h: 104, label: T.ui.play });
  const cardHowTo = () => (LAND() ? { x: COLS().bx, y: vh() / 2 + 10, w: COLS().bw, h: 78, label: T.howto.replayDemo, size: 28 } : { x: 160, y: 1362, w: 400, h: 78, label: T.howto.replayDemo, size: 32 });
  // Pause panel + buttons (ui column). Portrait keeps its exact original positions.
  const pauseBox = () => (LAND() ? { x: 70, y: Math.max(topPad() + 20, (vh() - 540) / 2), w: W - 140, h: 540, titleY: 0 } : { x: 70, y: 420, w: W - 140, h: 792, titleY: 520 });
  const pauseButtons = () => {
    const sound = state.muted ? T.ui.soundOff : T.ui.soundOn;
    if (LAND()) {
      const b = pauseBox(), y0 = b.y + 92, x0 = b.x + 44, w2 = (b.w - 88 - 16) / 2;
      return [
        { id: 'resume', x: x0, y: y0, w: b.w - 88, h: 88, label: T.howto.resume, primary: true, size: 34 },
        { id: 'howto', x: x0, y: y0 + 102, w: w2, h: 76, label: T.howto.replayDemo, size: 26 },
        { id: 'controls', x: x0 + w2 + 16, y: y0 + 102, w: w2, h: 76, label: T.howto.controls, size: 26 },
        { id: 'sound', x: x0, y: y0 + 192, w: w2, h: 76, label: sound, size: 26 },
        { id: 'rules', x: x0 + w2 + 16, y: y0 + 192, w: w2, h: 76, label: T.rules.title, size: 26 },
        { id: 'leave', x: x0, y: y0 + 282, w: b.w - 88, h: 80, label: T.howto.leave, size: 30 },
      ];
    }
    return [
      { id: 'resume', x: 130, y: 560, w: 460, h: 96, label: T.howto.resume, primary: true },
      { id: 'howto', x: 130, y: 674, w: 460, h: 84, label: T.howto.replayDemo },
      { id: 'controls', x: 130, y: 776, w: 460, h: 84, label: T.howto.controls },
      { id: 'sound', x: 130, y: 878, w: 460, h: 80, label: sound, size: 30 },
      { id: 'leave', x: 130, y: 976, w: 460, h: 84, label: T.howto.leave },
      { id: 'rules', x: 130, y: 1078, w: 460, h: 84, label: T.rules.title },
    ];
  };
  // a short dip to black around a scripted jump (the demo skipping ahead to the chapter's later phase)
  const cutAlpha = () => { let a = 0; for (const c of DEMOS[state.demo.n].cuts ?? []) a = Math.max(a, 1 - Math.abs(state.demo.t - c.t) / 0.28); return clamp(a, 0, 1); };
  const skipBtn = () => ({ ...DEMO_SKIP, label: T.howto.skip });
  // Reading pages scroll a document of height ctrlH / rulesH inside the visible height of the reading frame.
  const ctrlMax = () => Math.max(0, state.ctrlH - F.doc.h);
  const rulesMax = () => Math.max(0, state.rulesH - F.doc.h);
  const resultButtons = () => {
    if (LAND()) { const c = COLS(), y = vh() / 2;
      return [
        { id: 'next', x: c.bx, y: y - 124, w: c.bw, h: 104, label: T.ui.next, primary: true },
        { id: 'again', x: c.bx, y: y - 4, w: c.bw, h: 76, label: T.ui.replay, size: 28 },
        { id: 'road', x: c.bx, y: y + 84, w: c.bw, h: 76, label: T.ui.toRoad, size: 28 },
      ]; }
    return [
      { id: 'next', x: 110, y: 1130, w: 500, h: 104, label: T.ui.next, primary: true },
      { id: 'again', x: 110, y: 1254, w: 242, h: 80, label: T.ui.replay, size: 28 },
      { id: 'road', x: 368, y: 1254, w: 242, h: 80, label: T.ui.toRoad, size: 28 },
    ];
  };
  const lostButtons = () => {
    if (LAND()) { const c = COLS(), y = vh() / 2;
      return [
        { id: 'again', x: c.bx, y: y - 108, w: c.bw, h: 104, label: T.ui.retry, primary: true },
        { id: 'road', x: c.bx, y: y + 14, w: c.bw, h: 84, label: T.ui.toRoad },
      ]; }
    return [
      { id: 'again', x: 110, y: 900, w: 500, h: 104, label: T.ui.retry, primary: true },
      { id: 'road', x: 110, y: 1024, w: 500, h: 84, label: T.ui.toRoad },
    ];
  };
  // Fixed screen position - unlike the About page's story card (`simpleBack()` below), the world
  // card now scrolls (`state.worldScroll`/`worldMax()`) instead of growing the button row's own y,
  // so a tall card at a big text-size step slides up under this fixed row rather than pushing it
  // off the bottom of the canvas.
  const worldButtons = () => {
    if (LAND()) { const y = vh() - Math.max(0, host.b / F.ui.s) - 96; return { prev: { x: W / 2 - 350, y, w: 220, h: 80, label: T.ui.worldPrev }, next: { x: W / 2 + 130, y, w: 220, h: 80, label: T.ui.worldNext, primary: true }, back: { x: W / 2 - 110, y, w: 220, h: 80, label: T.ui.back } }; }
    return { prev: { x: 60, y: 1290, w: 250, h: 84, label: T.ui.worldPrev }, next: { x: 410, y: 1290, w: 250, h: 84, label: T.ui.worldNext, primary: true }, back: { x: 210, y: 1400, w: 300, h: 84, label: T.ui.back } };
  };
  // The world card's scrollable area ends here (WORLD_CLIP_Y), leaving a 60px band above the fixed
  // button row (y=1290) for the fade + "scroll for more" hint - shared by the render clip, the fade
  // and this scroll-max math so they can never drift apart.
  const worldClipY = () => (LAND() ? worldButtons().prev.y - 12 : 1230);
  // b is the card's own last-rendered bottom in its UNtranslated content space (state.worldBottom).
  // Leaves a real margin above the clip so scrolling all the way down still shows a sliver of
  // clearance, not the last line of text touching the fade.
  const worldMax = () => Math.max(0, state.worldBottom - worldClipY() + 30);
  const endWorld = () => (LAND() ? { x: COLS().bx, y: vh() / 2 - 100, w: COLS().bw, h: 80, label: T.ui.world, size: 30 } : { x: 130, y: 1290, w: 460, h: 80, label: T.ui.world });
  // y is normally the fixed 1180 this was always tuned for (demo-limit/end never scale their card),
  // but the About page's story card grows with the text-size stepper (`state.refBottom`, set from
  // the card's own real bottom each render) - a fixed y here let this button sit on top of the
  // card's own body text once it grew taller at the top text-size step. Read from state, not a
  // parameter, so the render call and this click hit-test always agree on the same position.
  const simpleBack = () => (LAND() ? { x: COLS().bx, y: vh() / 2 + (state.scene === 'end' ? 12 : -44), w: COLS().bw, h: 90, label: T.ui.back } : { x: 210, y: Math.max(1180, state.refBottom + 40), w: 300, h: 90, label: T.ui.back });
  const apEnd = () => (LAND() ? { again: { x: COLS().bx, y: vh() / 2 - 100, w: COLS().bw, h: 100 }, exit: { x: COLS().bx, y: vh() / 2 + 20, w: COLS().bw, h: 84 } } : { again: { x: 110, y: 1250, w: 500, h: 100 }, exit: { x: 110, y: 1370, w: 500, h: 84 } });

  const toggleMute = () => { state.muted = !state.muted; audio.setMuted(state.muted); storage.set('muted', state.muted); sfx('tap'); };

  function pressButtons(list, p, handler) {
    for (const b of list) if (ui.hit(b, p)) { sfx('tap'); handler(b.id); return true; }
    return false;
  }

  // "performed the action once": counted from the real input, only to fade the coaching hand.
  function trackCoach(dt, p, keys) {
    const c = state.coach, spec = COACH[state.chapter];
    if (!c || !spec) return;
    if (c.done) { c.doneT += dt; return; }
    if (p.pressed && p.y > 120) { c.taps += 1; c.sx = p.x; c.sy = p.y; c.cur = 0; }
    if (p.down) { c.cur = (c.cur ?? 0) + dt; c.hold = Math.max(c.hold, c.cur); c.drag = Math.max(c.drag, Math.hypot(p.x - c.sx, p.y - c.sy)); }
    if (p.released) c.rel += 1;
    if (keys.pressed.size > 0) c.keys += 1;
    const n = spec.need;
    if (c.keys > 0 || ((n.taps ?? 0) <= c.taps && (n.hold ?? 0) <= c.hold && (n.drag ?? 0) <= c.drag && (n.rel ?? 0) <= c.rel && (c.taps > 0))) c.done = true;
  }

  function update(dt, input) {
    refreshFrames();
    const keys = input.keys, ps = input.pointer;           // ps: screen units (HUD icons, steppers)
    const map = (f) => { const d = toDesign(f, ps.x, ps.y); return { ...ps, x: d.x, y: d.y }; };
    const pu = map(F.ui);                                  // pu: the ui column (menus, cards)
    let p = pu;
    const wheel = wheelInput.dy; wheelInput.dy = 0;
    const enter = keys.pressed.has('Enter') || keys.pressed.has('Space');
    state.t += dt; state.sceneT += dt;
    state.fade = Math.max(0, state.fade - dt * 2.5);

    if (state.scene === 'title') {
      p = map(F.title);
      if (p.pressed) pressButtons([...titleButtons(), lockupBtn()], p, (id) => {
        if (id === 'arcforge') { lockPress = 10; env.openArcforgeHome?.(); return; }
        if (id === 'play') openChapter(clamp(state.progress.unlocked, 1, N));
        else if (id === 'road') { focusRoad(state.progress.unlocked); go('road'); }
        else if (id === 'sound') toggleMute();
        else if (id === 'motion') { state.rm = !state.rm; storage.set('reducedMotion', state.rm); }
        else if (id === 'world') { state.worldPage = 0; state.worldScroll = 0; state.worldFrom = 'title'; go('world'); }
        else if (id === 'howto') { state.ctrlScroll = 0; state.ctrlFrom = 'title'; go('controls'); }
        else if (id === 'rules') { state.rulesScroll = 0; state.rulesFrom = 'title'; go('rules'); }
        else if (id === 'auto') startAutoplay();
      });
      else if (enter) openChapter(clamp(state.progress.unlocked, 1, N));
    } else if (state.scene === 'world') {
      const last = T.world.length - 1;
      if (p.pressed) {
        if (ui.hit(ui.TEXT_STEP.dec, ps)) { shrinkText(); return; }
        else if (ui.hit(ui.TEXT_STEP.inc, ps)) { growText(); return; }
        else if (ui.hit(worldButtons().prev, p) && state.worldPage > 0) { sfx('tap'); state.worldPage -= 1; state.sceneT = 0; state.worldScroll = 0; return; }
        else if (ui.hit(worldButtons().next, p) && state.worldPage < last) { sfx('tap'); state.worldPage += 1; state.sceneT = 0; state.worldScroll = 0; return; }
        else if (ui.hit(worldButtons().back, p)) { sfx('tap'); go(state.worldFrom ?? 'title'); return; }
        // A long entry's card can grow taller than the screen at a big text-size step (unlike
        // Controls/Rules, which are single scrolling documents, `world` is a handful of short
        // paginated topics) - this drag scrolls the current page's own card, the same way
        // Controls/Rules scroll theirs (ctrlDrag/rulesDrag above).
        worldDrag = { y: p.y, scroll: state.worldScroll };
      }
      if (worldDrag && p.down) state.worldScroll = clamp(worldDrag.scroll - (p.y - worldDrag.y), 0, worldMax());
      if (p.released) worldDrag = null;
      if (wheel) state.worldScroll = clamp(state.worldScroll + wheel / F.ui.s, 0, worldMax());
      if (keys.down.has('ArrowUp')) state.worldScroll = clamp(state.worldScroll - 900 * dt, 0, worldMax());
      if (keys.down.has('ArrowDown')) state.worldScroll = clamp(state.worldScroll + 900 * dt, 0, worldMax());
      if (keys.pressed.has('ArrowRight') && state.worldPage < last) { state.worldPage += 1; state.worldScroll = 0; }
      else if (keys.pressed.has('ArrowLeft') && state.worldPage > 0) { state.worldPage -= 1; state.worldScroll = 0; }
      else if (keys.pressed.has('Escape') || enter) go(state.worldFrom ?? 'title');
    } else if (state.scene === 'about' || state.scene === 'demo-limit' || state.scene === 'end') {
      // The text-size stepper only applies to About (the reference page proper) - demo-limit and end
      // are short, incidental flow screens, not something a player sits and reads like About/Controls/
      // Rules, so they keep their own fixed size, same as before.
      if (state.scene === 'about' && p.pressed && ui.hit(ui.TEXT_STEP.dec, ps)) shrinkText();
      else if (state.scene === 'about' && p.pressed && ui.hit(ui.TEXT_STEP.inc, ps)) growText();
      else if (state.scene === 'end' && p.pressed && ui.hit(endWorld(), p)) { sfx('tap'); state.worldPage = 0; state.worldFrom = 'end'; go('world'); }
      else if ((p.pressed && ui.hit(simpleBack(), p)) || enter) { sfx('tap'); if (state.scene === 'about') go('title'); else { focusRoad(state.progress.unlocked); go('road'); } }
    } else if (state.scene === 'road') {
      if (p.pressed) {
        if (ui.hit(ui.HUD.back, ps)) { sfx('tap'); go('title'); return; }
        if (ui.hit(ui.HUD.mute, ps)) { toggleMute(); return; }
        state.drag = { y: p.y, scroll: state.roadScroll, moved: 0, last: p.y };
      }
      if (state.drag && p.down) {
        state.drag.moved = Math.max(state.drag.moved, Math.abs(p.y - state.drag.y));
        state.roadVel = (state.drag.last - p.y) / dt; state.drag.last = p.y;
        state.roadScroll = clamp(state.drag.scroll - (p.y - state.drag.y), 0, roadMax());
      }
      if (state.drag && p.released) {
        if (state.drag.moved < 16) {
          state.roadVel = 0;
          for (let i = 0; i < N; i++) {
            const node = ui.roadNode(i, N);
            if (Math.hypot(p.x - node.x, p.y + state.roadScroll - node.y) < 110) { if (isOpen(i + 1)) { sfx('tap'); openChapter(i + 1); } else sfx('bad'); break; }
          }
        }
        state.drag = null;
      }
      if (!state.drag) { state.roadScroll = clamp(state.roadScroll + state.roadVel * dt, 0, roadMax()); state.roadVel *= 0.92; }
      if (wheel) { state.roadScroll = clamp(state.roadScroll + wheel / F.ui.s, 0, roadMax()); state.roadVel = 0; }
      if (keys.down.has('ArrowUp')) state.roadScroll = clamp(state.roadScroll - 900 * dt, 0, roadMax());
      if (keys.down.has('ArrowDown')) state.roadScroll = clamp(state.roadScroll + 900 * dt, 0, roadMax());
    } else if (state.scene === 'card') {
      cur.state.t += dt;
      if (p.pressed && ui.hit(ui.HUD.back, ps)) { sfx('tap'); focusRoad(state.chapter); go('road'); }
      else if (p.pressed && ui.hit(cardHowTo(), p)) { sfx('tap'); startDemo(state.chapter, 'card'); }
      else if ((p.pressed && ui.hit(cardButton(), p, 20)) || enter) beginPlay();
    } else if (state.scene === 'play') {
      let consumed = false;
      if (keys.pressed.has('Escape') && !cur.showcase) { sfx('tap'); state.scene = 'pause'; return; }
      if (ps.pressed && !cur.showcase) {
        if (ui.hit(ui.HUD.back, ps)) { sfx('tap'); state.scene = 'pause'; return; }
        if (ui.hit(ui.HUD.mute, ps)) { toggleMute(); consumed = true; }
        if (dev && ui.hit(ui.HUD.skip, ps)) { win(1); return; }
      }
      const pw = map(F.world);                              // pw: the chapter's world (design units of its frame)
      if (!consumed) trackCoach(dt, pw, keys);
      useFrame(F.world); mode.hud = true;
      cur.update(dt, consumed ? { pointer: { ...pw, pressed: false }, keys } : { pointer: pw, keys });
      mode.hud = false;
      const r = cur.result();
      if (r) { if (r.lost) { sfx('bad'); go('lost'); state.fade = 0; } else win(r.stars); }
    } else if (state.scene === 'demo') {
      const dm = state.demo, spec = DEMOS[dm.n];
      dm.t += dt;
      for (const [i, c] of (spec.cuts ?? []).entries()) if (dm.t >= c.t && !dm.cuts.includes(i)) { dm.cuts.push(i); c.fn(demoInst.state); driver.release(); driver.mem.cut = dm.t; }   // a scripted jump to the chapter's later phase
      useFrame(F.world); mode.hud = true;
      driver.tick(dt); spec.script(driver); driver.record(); demoInst.update(dt, driver.input);
      mode.hud = false;
      if ((ps.pressed && ui.hit(skipBtn(), ps, 14)) || keys.pressed.has('Enter') || keys.pressed.has('Escape') || dm.t >= dm.dur) { sfx('tap'); finishDemo(dm.from, dm.n); }
    } else if (state.scene === 'autoplay') {
      updateAutoplay(dt, input, ps, pu);
    } else if (state.scene === 'pause') {
      const back = () => { state.scene = 'play'; };
      if (keys.pressed.has('Escape')) back();
      else if (p.pressed) pressButtons(pauseButtons(), p, (id) => {
        if (id === 'resume') back();
        else if (id === 'howto') { state.keepT = state.sceneT; startDemo(state.chapter, 'pause'); }
        else if (id === 'controls') { state.keepT = state.sceneT; state.ctrlScroll = 0; state.ctrlFrom = 'pause'; go('controls'); }
        else if (id === 'sound') toggleMute();
        else if (id === 'rules') { state.keepT = state.sceneT; state.rulesScroll = 0; state.rulesFrom = 'pause'; go('rules'); }
        else { focusRoad(state.chapter); go('road'); }
      });
    } else if (state.scene === 'controls') {
      p = map(F.doc);
      if (p.pressed) {
        if (ui.hit(ui.HUD.back, ps)) { sfx('tap'); leaveControls(); return; }
        if (ui.hit(ui.HUD.mute, ps)) { toggleMute(); return; }
        if (ui.hit(ui.TEXT_STEP.dec, ps)) { shrinkText(); return; }
        if (ui.hit(ui.TEXT_STEP.inc, ps)) { growText(); return; }
        if (barHit(ps, ctrlMax(), state.ctrlH)) scrollBar = { which: 'ctrl' };
        else ctrlDrag = { y: p.y, scroll: state.ctrlScroll };
      }
      if (scrollBar?.which === 'ctrl' && ps.down) state.ctrlScroll = barScroll(ps, ctrlMax(), state.ctrlH);
      if (ctrlDrag && p.down) state.ctrlScroll = clamp(ctrlDrag.scroll - (p.y - ctrlDrag.y), 0, ctrlMax());
      if (p.released) { ctrlDrag = null; scrollBar = null; }
      if (wheel) state.ctrlScroll = clamp(state.ctrlScroll + wheel / F.doc.s, 0, ctrlMax());
      pageKeys('ctrlScroll', ctrlMax, keys);
      if (keys.down.has('ArrowUp')) state.ctrlScroll = clamp(state.ctrlScroll - 900 * dt, 0, ctrlMax());
      if (keys.down.has('ArrowDown')) state.ctrlScroll = clamp(state.ctrlScroll + 900 * dt, 0, ctrlMax());
      if (keys.pressed.has('Escape')) leaveControls();
    } else if (state.scene === 'rules') {
      p = map(F.doc);
      if (p.pressed) {
        if (ui.hit(ui.HUD.back, ps)) { sfx('tap'); leaveRules(); return; }
        if (ui.hit(ui.HUD.mute, ps)) { toggleMute(); return; }
        if (ui.hit(ui.TEXT_STEP.dec, ps)) { shrinkText(); return; }
        if (ui.hit(ui.TEXT_STEP.inc, ps)) { growText(); return; }
        if (barHit(ps, rulesMax(), state.rulesH)) scrollBar = { which: 'rules' };
        else rulesDrag = { y: p.y, scroll: state.rulesScroll };
      }
      if (scrollBar?.which === 'rules' && ps.down) state.rulesScroll = barScroll(ps, rulesMax(), state.rulesH);
      if (rulesDrag && p.down) state.rulesScroll = clamp(rulesDrag.scroll - (p.y - rulesDrag.y), 0, rulesMax());
      if (p.released) { rulesDrag = null; scrollBar = null; }
      if (wheel) state.rulesScroll = clamp(state.rulesScroll + wheel / F.doc.s, 0, rulesMax());
      pageKeys('rulesScroll', rulesMax, keys);
      if (keys.down.has('ArrowUp')) state.rulesScroll = clamp(state.rulesScroll - 900 * dt, 0, rulesMax());
      if (keys.down.has('ArrowDown')) state.rulesScroll = clamp(state.rulesScroll + 900 * dt, 0, rulesMax());
      if (keys.pressed.has('Escape')) leaveRules();
    } else if (state.scene === 'result') {
      cur.state.t += dt;
      if (state.sceneT < 0.6) return;
      const act = (id) => {
        if (id === 'next') { if (state.chapter >= N) go('end'); else openChapter(state.chapter + 1); }
        else if (id === 'again') openChapter(state.chapter);
        else { focusRoad(Math.min(N, state.chapter + 1)); go('road'); }
      };
      if (p.pressed) pressButtons(resultButtons(), p, act); else if (enter) act('next');
    } else if (state.scene === 'lost') {
      cur.state.t += dt;
      if (state.sceneT < 0.6) return;
      const act = (id) => { if (id === 'again') openChapter(state.chapter, 'play'); else { focusRoad(state.chapter); go('road'); } };
      if (p.pressed) pressButtons(lostButtons(), p, act); else if (enter) act('again');
    }
  }

  // ---- rendering ----
  // Key art: Ram with the fire-tipped bow raised, Hanuman flying beside him, Ravan's crowns looming in the smoke, Lanka glowing.
  function titleBackdrop(ctx) {
    const t = state.t, P = PAL.dusk, rm = state.rm;
    sky(ctx, P.sky, null);
    stars(ctx, 0.7, t, 0, 500);
    sun(ctx, 500, 880, 84, '255,206,130');
    clouds(ctx, { y: 380, h: 330, scroll: t * 14, color: 'rgba(90,40,90,0.55)', n: 6, seed: 3 });
    // the ten-crowned king, half hidden in smoke (heads fade in as their own build finishes - see titleReady)
    if (titleReady.ravan) { ctx.save(); ctx.globalAlpha = 0.62; tenCrowned(ctx, { x: 360, y: 900, s: 1.28, t, showArms: false }); ctx.restore(); }
    const sm = ctx.createLinearGradient(0, 380, 0, 980); sm.addColorStop(0, 'rgba(50,14,30,0.55)'); sm.addColorStop(0.5, 'rgba(120,40,30,0.5)'); sm.addColorStop(1, 'rgba(255,150,80,0.15)');
    ctx.fillStyle = sm; ctx.fillRect(FR.x0 - 1, 380, FR.w + 2, 600);
    light(ctx, 360, 640, 420, '255,120,50', 0.28);
    skyline(ctx, { base: 990, scroll: 40 + t * 3, color: '#2a1438', seed: 5, h: 230, gap: 130, kind: 'lanka', lit: '255,200,110', t });
    sea(ctx, { y: 980, t, scroll: t * 60, colors: ['#3a2a5e', '#2a1f4e', '#1d163e', '#140f2e', '#0c0920'], crest: '255,190,130' });
    light(ctx, 500, 1040, 330, '255,170,100', 0.35);
    const fy = 770 + Math.sin(t * 1.1) * (rm ? 0 : 18);
    light(ctx, 520, fy - 40, 260, '255,200,130', 0.4);
    if (titleReady.leaper) figure(ctx, { x: 525, y: fy, s: 1.15, kind: 'leaper', prop: 'mace', cape: '#2b8a62', pose: poses.fly(t) });
    // Ram, bow raised, the arrow burning
    ctx.save(); ctx.fillStyle = '#12081a'; ctx.beginPath(); ctx.moveTo(0, 1010); ctx.quadraticCurveTo(120, 930, 330, 990); ctx.lineTo(330, 1100); ctx.lineTo(0, 1100); ctx.fill(); ctx.restore();
    light(ctx, 250, 700, 300, '255,140,50', 0.34);
    if (titleReady.prince) figure(ctx, { x: 190, y: 985, s: 1.75, kind: 'prince', prop: 'bow', pose: { ...poses.drawBow(t, 0.92, -0.62), fireArrow: true } });
    motes(ctx, { n: 34, t, rgb: '255,170,90', kind: 'ember', top: 300, bottom: 1100, rm });
  }

  function drawButtons(ctx, list) { for (const b of list) ui.button(ctx, b, { primary: b.primary, size: b.size ?? 38 }); }

  function render(ctx) {
    bindCanvas(ctx);
    refreshFrames();
    // Drained here, not from update(): the fixed-timestep loop (kit/loop.js) can call update() several
    // times to catch up after one slow/throttled frame, which would stack several budgets' worth of
    // building into that same frame. render() always runs exactly once per real frame (and, in `?shot`
    // mode, is the ONLY thing that keeps running - see kit/boot.js `present()`), so draining here keeps
    // the "at most ~1 relief-part-heavy budget per frame" guarantee real.
    if (state.scene === 'title') drainGroup(bootQueue);
    if (state.scene === 'card') drainGroup(warm);
    const t = state.t, sc = state.scene;
    // `at(frame, fn)`: draw fn in that frame's coordinates (the kit's own screen transform is the starting point every time).
    const base = ctx.getTransform ? ctx.getTransform() : null;
    const at = (f, fn) => { ctx.save(); if (base) ctx.setTransform(base); ctx.translate(f.ox, f.oy); ctx.scale(f.s, f.s); useFrame(f); try { fn(); } finally { ctx.restore(); } };
    const world = (fn) => at(F.world, () => { mode.hud = true; try { fn(); } finally { mode.hud = false; } });
    const dim = (a, rgb = '8,2,8') => { ctx.fillStyle = `rgba(${rgb},${a})`; fillView(ctx); };
    const icons = (o) => at(F.scr, () => ui.hud(ctx, o));
    if (sc === 'cast') { at(F.ui, () => renderCast(ctx, t)); return; }
    if (sc.startsWith('sheet:')) { at(F.ui, () => renderSheet(ctx, t, sc.slice(6))); return; }
    if (sc === 'icon') { at(F.ui, () => renderIcon(ctx, 1)); return; }
    if (sc === 'world') {
      at(F.bg, () => { titleBackdrop(ctx); finish(ctx, 0.85); });
      at(F.ui, () => {
        const N0 = T.world[state.worldPage], a = state.t < 0.01 ? 1 : Math.min(1, 0.3 + state.sceneT * 4), clipY = worldClipY();
        // The card (and its art) scroll together at a big text-size step, same mechanism Controls/
        // Rules use (ctx.translate by -scroll); the nav row and stepper below are drawn AFTER restore
        // so they stay fixed on screen regardless of how tall the current page's card grows. Clipped
        // to end just above the fixed nav row (unlike Controls/Rules, which have no fixed bottom bar
        // for content to visually run under) so an unscrolled tall card never peeks out from behind
        // Previous/Next/Back - caught by an actual render, not assumed.
        ctx.save();
        ctx.beginPath(); ctx.rect(FR.x0, FR.y0, FR.w, clipY - FR.y0); ctx.clip();
        ctx.translate(0, -state.worldScroll);
        worldArt(ctx, N0.art, 40, 150, t, state.rm);
        const b = ui.storyCard(ctx, { kicker: `${T.ui.world}  ·  ${state.worldPage + 1} / ${T.world.length}`, title: N0.title, text: N0.text, y: 480, appear: a, t, scale: textScale(), tall: true });
        let worldBottom = b;
        if (state.worldPage === T.world.length - 1) {
          // Pre-existing bug, found by actually rendering this page (not visible at a glance in the
          // source): this whole sentence was drawn with the single-line, non-wrapping `ui.label()`,
          // so it already ran off both edges of the canvas even at the default 1x text size - the
          // title screen's own copy of this exact same byline correctly uses the wrapping
          // `ui.paragraph()` two screens away. Switched to the same wrapping call here, sized off the
          // shared stepper like the rest of this card (capped at 1.3x growth - it is a closing credit
          // line, not primary reading text) and its own height folded into `worldBottom` so the scroll
          // range and the top-fade calculation both know it is there.
          const scale = textScale(), bylineSize = Math.round(20 * Math.min(scale, 1.3)), bylineLh = Math.round(bylineSize * 1.32);
          ctx.font = ui.font(bylineSize, ui.SANS, 600); ctx.fillStyle = '#f2c46a';
          const bylineH = ui.paragraph(ctx, T.about, W / 2, b + 40 + bylineSize, W - 120, bylineLh);
          worldBottom = b + 40 + bylineH;
        }
        state.worldBottom = worldBottom;
        ctx.restore();
        // Scrolling down far enough can bring the card's own art up under the fixed A-/A+ stepper at
        // the top (nothing clips the TOP edge, only the bottom one above) - same top fade Controls/
        // Rules already use ahead of their own fixed HUD, drawn after the scroll is restored so it
        // sits on top of whatever content scrolled up into this band.
        { const g = ctx.createLinearGradient(0, 0, 0, 130); g.addColorStop(0, 'rgba(20,8,18,0.96)'); g.addColorStop(1, 'rgba(20,8,18,0)'); ctx.fillStyle = g; ctx.fillRect(FR.x0, 0, FR.w, 130); }
        // A card too tall for one screen (a bigger text-size step) still needs to tell the player it
        // scrolls - same "more below" affordance idea as elsewhere, just a bottom fade + arrow here
        // since this page's own nav row already sits fixed right below it.
        if (worldMax() > 0 && state.worldScroll < worldMax() - 4) {
          const g = ctx.createLinearGradient(0, clipY - 110, 0, clipY); g.addColorStop(0, 'rgba(20,8,18,0)'); g.addColorStop(0.55, 'rgba(20,8,18,0.92)'); g.addColorStop(1, 'rgba(20,8,18,0.96)');
          ctx.fillStyle = g; ctx.fillRect(FR.x0, clipY - 110, FR.w, 110);
          ui.label(ctx, '↓ scroll for more', W / 2, clipY - 16, 20, 'center', 'rgba(246,227,180,0.9)');
        }
        const wb = worldButtons(); ui.button(ctx, wb.prev, { size: 30, disabled: state.worldPage === 0 }); ui.button(ctx, wb.next, { size: 30, primary: true, disabled: state.worldPage === T.world.length - 1 }); ui.button(ctx, wb.back, { size: 30 });
      });
      at(F.scr, () => ui.textStepper(ctx, state.textScaleIdx));
    } else if (sc === 'title') {
      at(F.bg, () => { titleBackdrop(ctx); finish(ctx, 0.8); });
      at(F.title, () => {
        const L = LAND(), tp = topPad();
        const fy = L ? 50 + tp : 130, fh = L ? 190 : 290, by = L ? fy + 82 : 258;
        filigree(ctx, 44, fy, W - 88, fh, 0.85);
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = ui.font(74); ctx.fillText(T.title, W / 2 + 2, by + 4);
        ctx.fillStyle = '#ffe9b8'; ctx.fillText(T.title, W / 2, by);
        ctx.fillStyle = '#f2c46a'; ctx.font = ui.font(L ? 28 : 31); ui.paragraph(ctx, T.tagline, W / 2, by + (L ? 56 : 68), W - 190, L ? 36 : 40);
        drawButtons(ctx, titleButtons());
        { const lb = lockupBtn(), a = lb.art; ctx.save(); ctx.fillStyle = 'rgba(14,6,16,0.5)'; ctx.beginPath(); ctx.roundRect(a.x - a.w / 2 - 10, a.y - 4, a.w + 20, a.h + 8, 14); ctx.fill(); ctx.restore(); drawLockup(ctx, a.x, a.y, a.h, lockPress > 0 ? 0.5 : 0.95); if (lockPress > 0) lockPress--; }
        const tb = titleButtons(), lastY = tb[tb.length - 1].y + tb[tb.length - 1].h + (L ? 0 : 0);
        if (totalStars() > 0) { const sy = L ? lastY + 38 : 1450; ui.star(ctx, W / 2 - 50, sy, 17, true, t); ui.label(ctx, `${totalStars()} / ${N * 3}`, W / 2 - 20, sy + 10, 30, 'left', '#ffe9b8'); }
        // Bumped from 21px: this byline is the only "About" text most players ever see (the full,
        // framed About page below is reachable only once a menu entry points to it), so it gets the
        // same legibility floor as the rest of the reference text even though it keeps its own fixed
        // size here (a stepper would be one too many controls on the busiest screen in the game).
        if (!L) { ctx.fillStyle = 'rgba(242,196,106,0.85)'; ctx.font = ui.font(24, ui.SERIF, 600); ui.paragraph(ctx, T.about, W / 2, 1486, W - 120, 28); }
      });
      at(F.scr, () => {
        if (LAND()) { ctx.fillStyle = 'rgba(242,196,106,0.85)'; ctx.font = ui.font(22, ui.SERIF, 600); ui.paragraph(ctx, T.about, 24 + Math.max(0, host.l), F.sh - 86 - Math.max(0, host.b), Math.min(F.sw * 0.34, 480), 27, 'left'); }
        if (dev) ui.label(ctx, T.ui.devNote, F.sw - Math.max(16, host.r + 8), F.sh - 12 - Math.max(0, host.b), 20, 'right', '#9fe0a0');
      });
    } else if (sc === 'about' || sc === 'demo-limit' || sc === 'end') {
      at(F.bg, () => { titleBackdrop(ctx); finish(ctx, 0.8); });
      at(F.ui, () => {
        const about = sc === 'about', end = sc === 'end', L = LAND(), c = L ? COLS() : null;
        const bottom = ui.storyCard(ctx, { kicker: about ? T.ui.about : end ? T.places.ayodhya : T.title, title: about ? T.title : end ? T.ui.endTitle : T.ui.demoTitle, text: about ? T.about : end ? T.ui.endText : T.ui.demoText, y: 330, stars: -1, t, scale: about ? textScale() : 1, x: c?.cx, w: c?.cw });
        state.refBottom = bottom;
        if (end) {
          const sx = L ? ui.lastCard.x + ui.lastCard.w / 2 : W / 2, sy = L ? Math.min(bottom + 60, vh() - 30) : bottom + 70;
          ui.star(ctx, sx - 60, sy, 26, true, t); ui.label(ctx, `${totalStars()} / ${N * 3}`, sx - 20, sy + 14, 44, 'left', '#ffe9b8', ui.SERIF, 700); if (!L) ui.label(ctx, T.ui.totalStars, W / 2, bottom + 136, 24, 'center', '#f2c46a');
        }
        if (end) ui.button(ctx, endWorld(), { size: 30 });
        ui.button(ctx, simpleBack(), { primary: true });
      });
      if (sc === 'about') at(F.scr, () => ui.textStepper(ctx, state.textScaleIdx));
    } else if (sc === 'road') {
      at(F.ui, () => ui.road(ctx, { chapters: T.chapters, progress: state.progress, scroll: state.roadScroll, t, dev, rm: state.rm }));
      icons({ title: T.ui.road, muted: state.muted });
      if (dev) at(F.scr, () => ui.label(ctx, T.ui.devNote, F.sw / 2, ui.HUD.back.y + 96, 22, 'center', '#9fe0a0'));
    } else if (sc === 'controls' || sc === 'rules') {
      at(F.bg, () => { titleBackdrop(ctx); finish(ctx, 0.85); });
      at(F.doc, () => {
        dim(0.6);
        if (sc === 'controls') state.ctrlH = renderControls(ctx, { T, scroll: state.ctrlScroll, showKeys, scale: textScale() });
        else state.rulesH = renderRules(ctx, { T, scroll: state.rulesScroll, t, scale: textScale() });
        const g = ctx.createLinearGradient(0, 0, 0, 130); g.addColorStop(0, 'rgba(8,2,8,0.96)'); g.addColorStop(1, 'rgba(8,2,8,0)'); ctx.fillStyle = g; ctx.fillRect(FR.x0, 0, FR.w, 130);
      });
      icons({ title: '', muted: state.muted });
      at(F.scr, () => { ui.textStepper(ctx, state.textScaleIdx); if (sc === 'controls') drawScrollBar(ctx, state.ctrlScroll, ctrlMax(), state.ctrlH); else drawScrollBar(ctx, state.rulesScroll, rulesMax(), state.rulesH); });
    } else if (sc === 'demo' && demoInst) {
      world(() => demoInst.render(ctx));
      const dm = state.demo, spec = DEMOS[dm.n];
      const side = LAND() && F.sw >= 1180;               // wide screens: the caption sits in the free space left of the world
      let cap = null;
      at(F.ui, () => {
        if (!LAND()) { cap = renderDemoCaption(ctx, { T, n: dm.n, d: driver, spec, showKeys }); return; }
        const sideW = Math.min(500, (F.sw - 612) / 2 - 24);
        const box = side ? { x: FR.x0 + 20 + Math.max(0, host.l), w: sideW } : { x: W / 2 - Math.min(FR.w - 60, 820) / 2, w: Math.min(FR.w - 60, 820) };
        renderDemoCaption(ctx, { T, n: dm.n, d: driver, spec, showKeys, box, y: side ? Math.max(100, topPad() + 90) : topPad() + 90, bottomY: vh() - Math.max(0, host.b / F.ui.s) - 20 });
      });
      world(() => renderDemoWorld(ctx, { T, n: dm.n, d: driver, spec, cap, cutAlpha: cutAlpha(), wide: LAND() }));
      at(F.scr, () => { renderDemoBar(ctx, { d: driver, dur: dm.dur, sw: F.sw }); ui.button(ctx, skipBtn(), { size: 30 }); });
      if (!LAND()) { /* portrait: caption drawn above in the same frame; nothing more */ }
    } else if (sc === 'autoplay' && apInst) {
      const A = state.ap, C = T.chapters[A.n - 1];
      if (A.phase === 'finished') {
        at(F.bg, () => { titleBackdrop(ctx); finish(ctx, 0.8); });
        at(F.ui, () => {
          const L = LAND(), c = L ? COLS() : null, ae = apEnd();
          const bottom = ui.storyCard(ctx, { kicker: T.places.ayodhya, title: T.ui.endTitle, text: T.ui.endText, y: 330, stars: -1, t, x: c?.cx, w: c?.cw });
          const sx = L ? ui.lastCard.x + ui.lastCard.w / 2 : W / 2, sy = L ? Math.min(bottom + 60, vh() - 30) : bottom + 70;
          ui.star(ctx, sx - 60, sy, 26, true, t);
          ui.label(ctx, `${state.apTotalStars} / ${N * 3}`, sx - 20, sy + 14, 44, 'left', '#ffe9b8', ui.SERIF, 700);
          if (!L) ui.label(ctx, T.ui.totalStars, W / 2, bottom + 136, 24, 'center', '#f2c46a');
          ui.button(ctx, { ...ae.again, label: T.ui.replay }, { primary: true, size: 40 });
          ui.button(ctx, { ...ae.exit, label: T.ui.autoExitMenu }, { size: 30 });
        });
      } else {
        world(() => apInst.render(ctx));
        at(F.ui, () => {
          const L = LAND(), c = L ? COLS() : null;
          if (A.phase === 'think' || A.phase === 'reveal') {
            dim(0.35);
            ui.storyCard(ctx, { kicker: `${T.ui.chapterWord} ${A.n}  ·  ${C.place}`, title: C.title, text: C.card, y: 190, t, who: C.portrait, x: c ? W / 2 - c.cw / 2 : undefined, w: c?.cw, top: L ? 130 : undefined });
          } else if (A.phase === 'result') {
            dim(clamp(A.t * 1.6, 0, 1) * 0.4);
            ui.storyCard(ctx, { kicker: `${T.ui.chapterWord} ${A.n}  ·  ${C.place}`, title: C.title, text: A.forced ? T.ui.lostSub : C.outro, y: 190, stars: A.stars, t, who: C.portrait, note: A.forced ? null : C.fact, x: c ? W / 2 - c.cw / 2 : undefined, w: c?.cw, top: L ? 130 : undefined });
          }
        });
        at(F.scr, () => {
          // A translucent band keeps the stepper/status legible over live chapter art during 'act' too.
          { const g = ctx.createLinearGradient(0, 0, 0, 152); g.addColorStop(0, 'rgba(8,2,8,0.85)'); g.addColorStop(1, 'rgba(8,2,8,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, F.sw, 152); }
          ui.button(ctx, { ...AP.dec, label: '−' }, { size: 34, disabled: state.apThinkIdx <= 0 });
          ui.button(ctx, { ...AP.inc, label: '+' }, { size: 34, disabled: state.apThinkIdx >= AP_THINK_STEPS.length - 1 });
          // Sits BELOW the dec/inc buttons (which end at y=88): centred between them would have to
          // span the narrow gap between the two and instead ran straight across both.
          const ty = AP.dec.y + AP.dec.h;
          ui.label(ctx, `Think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, F.sw / 2, ty + 24, 22, 'center', '#f8e2b0', ui.SERIF, 700);
          const phaseLabel = A.phase === 'think' ? `${T.ui.autoThink}  (${Math.max(0, AP_THINK_STEPS[state.apThinkIdx] - A.t).toFixed(0)}s)` : A.phase === 'reveal' ? T.ui.autoReveal : A.phase === 'act' ? `${T.ui.autoPlay}  ·  ${T.ui.chapterWord} ${A.n}: ${C.title}` : '';
          ui.label(ctx, phaseLabel, F.sw / 2, ty + 54, 21, 'center', 'rgba(246,227,180,0.92)', ui.SANS, 600);
          ui.button(ctx, { ...AP.exit, label: T.ui.autoExit }, { size: 28 });
          ui.button(ctx, { ...AP.pause, label: A.paused ? T.ui.autoResume : T.ui.autoPause }, { primary: A.paused, size: 28 });
          ui.button(ctx, { ...AP.skip, label: T.ui.autoSkip }, { size: 28 });
        });
      }
    } else if (cur) {
      // PERF: a chapter's own render() draws its full backdrop + cast unconditionally, which (before
      // `warm` finishes - see the WARM/warmFigureParts/warmBustParts warmup above) can still hit a
      // first-use sprite-cache build the same way the title screen used to. While the card is up and
      // still warming, show a plain backdrop instead of the real one (buttons/text below are already
      // interactive either way) rather than pay for the chapter's whole cast/scenery on one frame.
      const cardWarming = sc === 'card' && warm.length > 0;
      world(() => { if (cardWarming) { ctx.fillStyle = PAL.dusk.near; fillView(ctx); finish(ctx, 0.6); } else cur.render(ctx); });
      const C = T.chapters[state.chapter - 1];
      if (sc === 'card') {
        at(F.ui, () => {
          dim(0.35);
          const L = LAND(), c = L ? COLS() : null;
          ui.storyCard(ctx, { kicker: `${T.ui.chapterWord} ${state.chapter}  ·  ${C.place}`, title: C.title, text: C.card, y: 190, appear: state.t < 0.01 ? 1 : state.sceneT * 2.5, t, who: C.portrait, x: c?.cx, w: c?.cw });
          ui.button(ctx, cardButton(), { primary: true, size: 44 });
          if (DEMOS[state.chapter]) ui.button(ctx, cardHowTo(), { size: cardHowTo().size });
        });
        icons({ title: '', muted: state.muted });
      } else if (sc === 'pause') {
        at(F.ui, () => renderPause(ctx, { T, buttons: pauseButtons(), muted: state.muted, box: pauseBox() }));
      } else if (sc === 'play') {
        if (!cur.showcase) icons({ title: C.title, muted: state.muted, dev, skipLabel: T.ui.skip, pause: true });
        const a = clamp(Math.min(state.sceneT * 2, 7 - state.sceneT), 0, 1);
        world(() => {
          if (!cur.state.noHint && !cur.showcase) ui.caption(ctx, C.hint, dev ? 230 : 190, a, 28);
          const cs = COACH[state.chapter];
          if (cs && !cur.showcase && state.coach && state.progress.stars[String(state.chapter)] === undefined && state.coach.doneT < 1) renderCoach(ctx, { T, n: state.chapter, coach: cs, s: cur.state, sceneT: state.sceneT, t: state.t, doneFade: state.coach.done ? state.coach.doneT : 0, cs: state.coach });
        });
      } else if (sc === 'result') {
        at(F.ui, () => {
          dim(clamp(state.sceneT, 0, 1) * 0.4);
          const L = LAND(), c = L ? COLS() : null;
          ui.storyCard(ctx, { kicker: `${T.ui.chapterWord} ${state.chapter}  ·  ${C.place}`, title: C.title, text: C.outro, y: 190, appear: state.sceneT * 2, stars: Math.min(state.stars, Math.floor(state.sceneT * 2.5)), t, who: C.portrait, note: C.fact, x: c?.cx, w: c?.cw });
          if (state.sceneT > 0.6) {
            drawButtons(ctx, resultButtons());
            // quiet brand line under the buttons (never over play)
            const rb = resultButtons(), last = rb[rb.length - 1];
            drawMoreLine(ctx, LAND() ? last.x + last.w / 2 : W / 2, last.y + last.h + 44, 21);
          }
        });
      } else if (sc === 'lost') {
        at(F.ui, () => {
          dim(clamp(state.sceneT * 1.5, 0, 1) * 0.72, '6,2,8');
          const L = LAND(), c = L ? COLS() : null;
          ui.storyCard(ctx, { kicker: C.title, title: T.ui.lost, text: T.ui.lostSub, y: 520, appear: state.sceneT * 2, t, x: c?.cx, w: c?.cw });
          if (state.sceneT > 0.6) drawButtons(ctx, lostButtons());
        });
      }
    }
    if (state.fade > 0) at(F.scr, () => dim(state.fade, '6,2,8'));
  }

  if (!demo && config.seed === SHOWCASE_BASE + 100) { state.progress = { unlocked: 8, stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 2, 6: 3, 7: 3 }, last: 7 }; focusRoad(6); state.scene = 'road'; }
  if (!demo && config.seed === SHOWCASE_BASE + 101) state.scene = 'cast';
  if (!demo && config.seed === SHOWCASE_BASE + 106) state.scene = 'icon';
  if (!demo && config.seed >= SHOWCASE_BASE + 107 && config.seed <= SHOWCASE_BASE + 113) state.scene = 'sheet:' + ['hanuman', 'pair', 'men', 'throne', 'faces', 'walk', 'hands'][config.seed - SHOWCASE_BASE - 107];
  if (!demo && config.seed === SHOWCASE_BASE + 102) { state.worldPage = 0; state.scene = 'world'; }
  if (!demo && config.seed === SHOWCASE_BASE + 103) { state.worldPage = 5; state.scene = 'world'; }
  if (!demo && config.seed === SHOWCASE_BASE + 104) openChapter(12, 'card');
  if (!demo && config.seed === SHOWCASE_BASE + 105) { openChapter(7, 'card'); win(3); state.sceneT = 2; }
  if (testN) { state.progress = { unlocked: N, stars: {}, last: 0 }; openChapter(testN, 'card'); }
  if (showcaseN) { openChapter(showcaseN, 'play'); cur.showcase = true; state.fade = 0; }

  return {
    update, render, getState: () => state,
    // Test/debug hook: the live frames and every button rect of the current scene (design units of the frame that scene uses).
    getLayout: () => { refreshFrames(); return { F, title: titleButtons(), lockup: lockupBtn(), card: [cardButton(), cardHowTo()], pause: pauseButtons(), result: resultButtons(), lost: lostButtons(), world: worldButtons(), back: simpleBack(), endWorld: endWorld(), ap: AP, apEnd: apEnd(), hud: ui.HUD, step: ui.TEXT_STEP, skip: DEMO_SKIP }; }, getDemo: () => (demoInst ? { inst: demoInst, driver } : null),
    // Test/debug hook mirroring getDemo() above: exposes the throwaway per-chapter instance Auto
    // Play is currently driving, so a test can confirm Pause genuinely freezes a chapter's own
    // internal simulation state (whatever shape that chapter's 13-different-mechanics state takes)
    // and not just the outer THINK/REVEAL/ACT phase machinery.
    getAutoplayChapter: () => (apInst ? { inst: apInst, driver: apDriver } : null),
    // Only a player actually playing inside a chapter counts against the free preview (kit 1.6.1+). Title, Road, World,
    // Chapter Guide, About, story cards, the how-to demo, Pause, Auto Play, result/lost screens and a chapter's own
    // finished/celebration beat are exempt.
    isPreviewExempt: () => !(state.scene === 'play' && cur && !cur.showcase && !cur.state?.done && cur.state?.phase !== 'celebrate' && cur.state?.phase !== 'snap'),
  };
}
