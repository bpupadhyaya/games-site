// GAME CONTRACT (docs/GAME-CONTRACT.md) — every game exports exactly these two things:
//   meta                      virtual resolution the game draws in
//   createGame(env) -> { update(dt, input), render(ctx, view), getState() }
// Rules: no DOM/window access in web/src, no Math.random / Date.now (use env.rng and dt).
//
// WORD GAME: a target word is shown at the top; three candidate words drift freely (own speed,
// own vertical bounce within a band) across the screen from right to left. The player taps the
// one that correctly matches the target (synonym or antonym, chosen before the session and
// locked for its whole 90 seconds). See design/GDD.md for the full design.
import { STANDARD_PACK, ADVANCED_PACK } from './words.js';

export const meta = { width: 720, height: 1280 };

const SESSION_SECONDS = 90;
// Web preview (env.config.demo) is marketing for the full iOS/Android game, not a substitute
// for it — cap how many full sessions are playable for free. See docs/GAME-CONTRACT.md's
// "Web preview" section and design/GDD.md's "Demo cut".
const DEMO_SESSION_LIMIT = 2;
// Interstitial shown only when leaving the session-end screen, and only every Nth completed
// session (never mid-round) — see design/GDD.md "Monetization".
const INTERSTITIAL_EVERY = 2;
const RECENT_WORDS_MAX = 6;

// Vertical band the three candidate words drift within — deliberately tall (most of the screen
// height) and split into three independent slices so reading a round moves the eyes across a
// wide vertical + horizontal range instead of one fixed point. See design/GDD.md's
// "Wellness-by-design fit" — never described to players as a health benefit.
const BAND_TOP = 300;
const BAND_BOTTOM = 1000;
const SLICE_H = (BAND_BOTTOM - BAND_TOP) / 3;
const SLICE_MARGIN = 30;

const SPEED_BASE = 140;
const SPEED_PER_POINT = 18;
const SPEED_CAP_BONUS = 260;
const SPEED_JITTER = 40;

const CHAR_W = 21; // approximate px/char at the word-chip font size, used for both hit-testing and drawing
const CHIP_PAD_X = 26;
const CHIP_H = 68;

const KEY_CODES = ['Digit1', 'Digit2', 'Digit3'];
const SLOT_COLORS = ['#8b5cf6', '#22d3ee', '#f472b6'];

const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const wordChipWidth = (text) => text.length * CHAR_W + CHIP_PAD_X * 2;

// Title-screen / gameover-screen button rects (virtual units).
const MODE_SYN_BTN = { x: 70, y: 480, w: 270, h: 90 };
const MODE_ANT_BTN = { x: 380, y: 480, w: 270, h: 90 };
const PLAY_BTN = { x: 160, y: 610, w: 400, h: 110 };
const TRIAL_BTN = { x: 110, y: 760, w: 500, h: 78 };
const ADV_BUY_BTN = { x: 110, y: 856, w: 500, h: 78 };
const REMOVE_ADS_BTN = { x: 110, y: 952, w: 500, h: 78 };

const PLAY_AGAIN_BTN = { x: 160, y: 620, w: 400, h: 110 };
const CHANGE_MODE_BTN = { x: 160, y: 750, w: 400, h: 78 };
const GO_TRIAL_BTN = { x: 110, y: 848, w: 500, h: 70 };
const GO_ADV_BUY_BTN = { x: 110, y: 928, w: 500, h: 70 };
const GO_REMOVE_ADS_BTN = { x: 110, y: 1008, w: 500, h: 70 };

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const demo = Boolean(config?.demo);

  const state = {
    scene: 'title',
    selectedMode: 'synonym', // pending choice on the title screen
    mode: 'synonym', // locked for the whole session once Play is tapped
    score: 0,
    bestSynonym: 0,
    bestAntonym: 0,
    newBest: false,
    timeLeft: SESSION_SECONDS,
    sessionsCompleted: 0,
    ownsRemoveAds: monetization.owns('remove_ads'),
    ownsAdvancedPack: monetization.owns('advanced_pack'),
    advancedTrialPending: false, // granted by a rewarded ad, consumed by the next session
    advancedTrialActive: false, // true for the duration of a trial session
    adBusy: false,
    demo,
    demoSessions: 0,
    demoLimitReached: false,
    round: null, // { targetWord, mode, words: [{ text, correct, slot, w, x, y, vy, speed }] }
  };

  let recentWords = [];

  storage.get('bestSynonym', 0).then((v) => (state.bestSynonym = v));
  storage.get('bestAntonym', 0).then((v) => (state.bestAntonym = v));
  if (demo) {
    storage.get('demoSessions', 0).then((v) => {
      state.demoSessions = v;
      if (v >= DEMO_SESSION_LIMIT) state.demoLimitReached = true;
    });
  }
  monetization.onChange(() => {
    state.ownsRemoveAds = monetization.owns('remove_ads');
    state.ownsAdvancedPack = monetization.owns('advanced_pack');
  });

  const activePack = () => {
    if (state.ownsAdvancedPack || state.advancedTrialActive) return STANDARD_PACK.concat(ADVANCED_PACK);
    return STANDARD_PACK;
  };

  const pickEntry = () => {
    const pack = activePack();
    let entry;
    let guard = 0;
    do {
      entry = pack[rng.int(pack.length)];
      guard += 1;
    } while (recentWords.includes(entry[0]) && recentWords.length < pack.length && guard < 50);
    recentWords.push(entry[0]);
    if (recentWords.length > RECENT_WORDS_MAX) recentWords.shift();
    return entry;
  };

  const spawnRound = () => {
    const [word, synonym, antonym, d1, d2] = pickEntry();
    const correctText = state.mode === 'synonym' ? synonym : antonym;
    const options = rng.shuffle([
      { text: correctText, correct: true },
      { text: d1, correct: false },
      { text: d2, correct: false },
    ]);
    const speed = SPEED_BASE + Math.min(SPEED_CAP_BONUS, state.score * SPEED_PER_POINT);
    state.round = {
      targetWord: word,
      mode: state.mode,
      words: options.map((o, slot) => {
        const sliceTop = BAND_TOP + slot * SLICE_H + SLICE_MARGIN;
        const sliceBottom = BAND_TOP + (slot + 1) * SLICE_H - SLICE_MARGIN;
        return {
          text: o.text,
          correct: o.correct,
          slot,
          w: wordChipWidth(o.text),
          x: meta.width + 20 + rng.range(0, 140),
          y: rng.range(sliceTop, sliceBottom),
          vy: rng.range(-30, 30),
          sliceTop,
          sliceBottom,
          speed: speed + rng.range(0, SPEED_JITTER),
        };
      }),
    };
  };

  const startSession = () => {
    if (demo) {
      if (state.demoLimitReached) {
        state.scene = 'demo-limit';
        return;
      }
      state.demoSessions += 1;
      storage.set('demoSessions', state.demoSessions);
      if (state.demoSessions >= DEMO_SESSION_LIMIT) state.demoLimitReached = true;
    }
    state.mode = state.selectedMode;
    state.advancedTrialActive = state.ownsAdvancedPack ? false : state.advancedTrialPending;
    state.advancedTrialPending = false;
    state.score = 0;
    state.timeLeft = SESSION_SECONDS;
    state.newBest = false;
    recentWords = [];
    state.scene = 'playing';
    spawnRound();
  };

  const bestKey = () => (state.mode === 'synonym' ? 'bestSynonym' : 'bestAntonym');

  const endSession = () => {
    state.scene = 'gameover';
    state.round = null;
    const key = bestKey();
    if (state.score > state[key]) {
      state[key] = state.score;
      state.newBest = true;
      storage.set(key, state.score);
    }
    state.sessionsCompleted += 1;
    monetization.track('session_end', { mode: state.mode, score: state.score });
    // Brief descending tone marks the session ending (design/GDD.md > Art and audio). A single
    // glide (not two separately-scheduled notes) since env.audio.tone() has no delay parameter
    // and web/src cannot use setTimeout (see docs/GAME-CONTRACT.md's determinism rule).
    audio.tone({ freq: 560, to: 300, dur: 0.32, type: 'sine', vol: 0.22 });
  };

  // Called whenever the player leaves the session-end screen (Play Again or Change Mode) —
  // the one natural pause point between sessions. See design/GDD.md "Monetization".
  const maybeShowInterstitial = async () => {
    if (demo || state.ownsRemoveAds || state.adBusy) return;
    if (state.sessionsCompleted % INTERSTITIAL_EVERY !== 0) return;
    state.adBusy = true;
    await monetization.showInterstitial('session_end').catch(() => ({ shown: false }));
    state.adBusy = false;
  };

  const resolveRound = (hit) => {
    if (hit) {
      state.score += 1;
      audio.tone({ freq: 620, to: 900, dur: 0.1, type: 'triangle', vol: 0.22 });
    } else {
      audio.tone({ freq: 220, to: 140, dur: 0.16, type: 'sawtooth', vol: 0.18 });
    }
    spawnRound();
  };

  const tryBuyAdvanced = async () => {
    if (demo || state.ownsAdvancedPack || state.adBusy) return;
    state.adBusy = true;
    await monetization.purchase('advanced_pack').catch(() => ({ ok: false }));
    state.adBusy = false;
  };

  const tryBuyRemoveAds = async () => {
    if (demo || state.ownsRemoveAds || state.adBusy) return;
    state.adBusy = true;
    await monetization.purchase('remove_ads').catch(() => ({ ok: false }));
    state.adBusy = false;
  };

  const tryTrial = async () => {
    if (demo || state.ownsAdvancedPack || state.adBusy) return;
    state.adBusy = true;
    const { rewarded } = await monetization.showRewarded('advanced_trial').catch(() => ({ rewarded: false }));
    if (rewarded) state.advancedTrialPending = true;
    state.adBusy = false;
  };

  const updateTitle = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer;
    if (inRect(x, y, MODE_SYN_BTN)) state.selectedMode = 'synonym';
    else if (inRect(x, y, MODE_ANT_BTN)) state.selectedMode = 'antonym';
    else if (inRect(x, y, PLAY_BTN)) startSession();
    else if (!demo && !state.ownsAdvancedPack && inRect(x, y, TRIAL_BTN)) tryTrial();
    else if (!demo && !state.ownsAdvancedPack && inRect(x, y, ADV_BUY_BTN)) tryBuyAdvanced();
    else if (!demo && !state.ownsRemoveAds && inRect(x, y, REMOVE_ADS_BTN)) tryBuyRemoveAds();
  };

  const updatePlaying = (dt, input) => {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endSession();
      return;
    }
    const round = state.round;
    if (!round) return;
    for (const w of round.words) {
      w.x -= w.speed * dt;
      w.y += w.vy * dt;
      if (w.y < w.sliceTop || w.y > w.sliceBottom) {
        w.vy *= -1;
        w.y = Math.min(w.sliceBottom, Math.max(w.sliceTop, w.y));
      }
    }

    // Resolve at most one action per tick against this same `round` reference — resolveRound()
    // spawns a fresh round synchronously, so re-using a stale reference after that would let a
    // second input in the same tick (e.g. a key alongside a tap) score twice on words that no
    // longer exist.
    if (input.pointer.pressed) {
      const hit = round.words.find((w) => input.pointer.x >= w.x - w.w / 2 && input.pointer.x <= w.x + w.w / 2 && input.pointer.y >= w.y - CHIP_H / 2 && input.pointer.y <= w.y + CHIP_H / 2);
      if (hit) {
        resolveRound(hit.correct);
        return;
      }
    }
    for (const code of KEY_CODES) {
      if (input.keys.pressed.has(code)) {
        const slot = KEY_CODES.indexOf(code);
        const w = round.words.find((rw) => rw.slot === slot);
        if (w) {
          resolveRound(w.correct);
          return;
        }
      }
    }

    const correctWord = round.words.find((w) => w.correct);
    if (correctWord && correctWord.x + correctWord.w / 2 < 0) resolveRound(false);
  };

  const updateGameover = async (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer;
    if (inRect(x, y, PLAY_AGAIN_BTN)) {
      await maybeShowInterstitial();
      startSession();
    } else if (inRect(x, y, CHANGE_MODE_BTN)) {
      await maybeShowInterstitial();
      state.scene = 'title';
    } else if (!demo && !state.ownsAdvancedPack && inRect(x, y, GO_TRIAL_BTN)) tryTrial();
    else if (!demo && !state.ownsAdvancedPack && inRect(x, y, GO_ADV_BUY_BTN)) tryBuyAdvanced();
    else if (!demo && !state.ownsRemoveAds && inRect(x, y, GO_REMOVE_ADS_BTN)) tryBuyRemoveAds();
  };

  return {
    update(dt, input) {
      if (state.scene === 'title') updateTitle(input);
      else if (state.scene === 'playing') updatePlaying(dt, input);
      else if (state.scene === 'gameover') updateGameover(input);
      // 'demo-limit': input is a deliberate no-op — see design/GDD.md "Demo cut".
    },

    render(ctx) {
      const g = ctx.createRadialGradient(
        meta.width / 2, meta.height * 0.18, meta.height * 0.08,
        meta.width / 2, meta.height * 0.5, meta.height * 0.85
      );
      g.addColorStop(0, '#3a3560');
      g.addColorStop(0.55, '#262a42');
      g.addColorStop(1, '#181a26');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, meta.width, meta.height);

      ctx.textAlign = 'center';

      if (state.scene === 'title') {
        ctx.fillStyle = '#eef0fb';
        ctx.font = 'bold 60px system-ui, sans-serif';
        ctx.fillText(env.manifest.title, meta.width / 2, 160);
        ctx.font = '28px system-ui, sans-serif';
        ctx.fillStyle = '#9aa0c0';
        ctx.fillText('Tap the word that matches — before it drifts away', meta.width / 2, 210);

        drawButton(ctx, MODE_SYN_BTN, 'Synonym', state.selectedMode === 'synonym' ? 'active' : undefined);
        drawButton(ctx, MODE_ANT_BTN, 'Antonym', state.selectedMode === 'antonym' ? 'active' : undefined);

        const bestNow = state.selectedMode === 'synonym' ? state.bestSynonym : state.bestAntonym;
        ctx.fillStyle = '#eef0fb';
        ctx.font = '600 26px system-ui, sans-serif';
        ctx.fillText(`Best (${state.selectedMode}): ${bestNow}`, meta.width / 2, 440);

        drawButton(ctx, PLAY_BTN, 'Play', 'primary');

        // Purchase/reward buttons stay visible in the web demo (consistent with the full app's
        // UI) but are disabled: env.monetization.purchase() is blocked in demo mode, so tapping
        // them is guarded to a no-op rather than promising an unlock the demo can't grant.
        if (!state.ownsAdvancedPack) {
          drawButton(ctx, TRIAL_BTN, 'Watch an ad: try Advanced pack for 1 session', undefined, demo);
          drawButton(ctx, ADV_BUY_BTN, 'Unlock Advanced Pack — $1.99', undefined, demo);
        } else {
          ctx.fillStyle = '#9aa0c0';
          ctx.font = '600 24px system-ui, sans-serif';
          ctx.fillText('Advanced Pack unlocked', meta.width / 2, TRIAL_BTN.y + TRIAL_BTN.h / 2 + 8);
        }
        if (!state.ownsRemoveAds) drawButton(ctx, REMOVE_ADS_BTN, 'Remove Ads — $2.99', undefined, demo);

        if (demo) {
          ctx.fillStyle = '#9aa0c0';
          ctx.font = '600 22px system-ui, sans-serif';
          const left = Math.max(0, DEMO_SESSION_LIMIT - state.demoSessions);
          ctx.fillText(`Free preview — ${left} session(s) left`, meta.width / 2, 470);
        }
        return;
      }

      if (state.scene === 'demo-limit') {
        ctx.fillStyle = '#eef0fb';
        ctx.font = 'bold 44px system-ui, sans-serif';
        ctx.fillText("You've played the free demo", meta.width / 2, meta.height * 0.42);
        ctx.font = '28px system-ui, sans-serif';
        ctx.fillStyle = '#9aa0c0';
        ctx.fillText('Get Word Game on iPhone and Android', meta.width / 2, meta.height * 0.48);
        ctx.fillText('for unlimited sessions.', meta.width / 2, meta.height * 0.52);
        return;
      }

      // Score (top-left) + timer (top-right) — small, out of the way.
      ctx.textAlign = 'left';
      ctx.fillStyle = '#eef0fb';
      ctx.font = '600 34px system-ui, sans-serif';
      ctx.fillText(String(state.score), 40, 60);
      ctx.textAlign = 'right';
      const t = Math.max(0, state.timeLeft);
      const mm = Math.floor(t / 60);
      const ss = Math.floor(t % 60);
      ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, meta.width - 40, 60);
      ctx.textAlign = 'center';

      if (state.round) {
        ctx.fillStyle = '#9aa0c0';
        ctx.font = '600 22px system-ui, sans-serif';
        ctx.fillText(`TAP THE ${state.round.mode.toUpperCase()} OF`, meta.width / 2, 140);
        ctx.fillStyle = '#eef0fb';
        ctx.font = 'bold 52px system-ui, sans-serif';
        ctx.fillText(state.round.targetWord, meta.width / 2, 210);

        for (const w of state.round.words) {
          const cx = w.x - w.w / 2, cy = w.y - CHIP_H / 2;
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.4)';
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 5;
          const chipGrad = ctx.createLinearGradient(cx, cy, cx, cy + CHIP_H);
          chipGrad.addColorStop(0, 'rgba(255,255,255,0.14)');
          chipGrad.addColorStop(1, 'rgba(255,255,255,0.04)');
          ctx.fillStyle = chipGrad;
          roundRect(ctx, cx, cy, w.w, CHIP_H, 16);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1.5;
          roundRect(ctx, cx, cy, w.w, CHIP_H, 16);
          ctx.stroke();
          ctx.fillStyle = SLOT_COLORS[w.slot % SLOT_COLORS.length];
          ctx.font = '600 30px system-ui, sans-serif';
          ctx.fillText(w.text, w.x, w.y + 10);
        }
      }

      if (state.scene === 'gameover') {
        ctx.fillStyle = 'rgba(6,7,13,0.72)';
        ctx.fillRect(0, 0, meta.width, meta.height);
        ctx.fillStyle = '#eef0fb';
        ctx.font = 'bold 56px system-ui, sans-serif';
        ctx.fillText("Time's up!", meta.width / 2, 300);
        ctx.font = '600 36px system-ui, sans-serif';
        ctx.fillText(`Score: ${state.score}`, meta.width / 2, 370);
        ctx.font = '28px system-ui, sans-serif';
        ctx.fillStyle = state.newBest ? '#22d3ee' : '#9aa0c0';
        const bestNow = state.mode === 'synonym' ? state.bestSynonym : state.bestAntonym;
        ctx.fillText(state.newBest ? `New best! (${state.mode}: ${bestNow})` : `Best (${state.mode}): ${bestNow}`, meta.width / 2, 420);

        drawButton(ctx, PLAY_AGAIN_BTN, 'Play Again', 'primary');
        drawButton(ctx, CHANGE_MODE_BTN, 'Change Mode');

        if (!state.ownsAdvancedPack) {
          drawButton(ctx, GO_TRIAL_BTN, 'Watch an ad: try Advanced pack', undefined, demo);
          drawButton(ctx, GO_ADV_BUY_BTN, 'Unlock Advanced Pack — $1.99', undefined, demo);
        }
        if (!state.ownsRemoveAds) drawButton(ctx, GO_REMOVE_ADS_BTN, 'Remove Ads — $2.99', undefined, demo);
      }
    },

    getState() {
      return state;
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// style: 'active' (violet-cyan gradient, used for the selected mode toggle), 'primary' (cyan-lean
// gradient, used for Play / Play Again), or undefined (flat secondary button).
function drawButton(ctx, r, label, style, disabled) {
  ctx.globalAlpha = disabled ? 0.35 : 1;
  roundRect(ctx, r.x, r.y, r.w, r.h, 16);
  if (style === 'active' || style === 'primary') {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    const grad = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y);
    if (style === 'primary') {
      grad.addColorStop(0, '#22d3ee');
      grad.addColorStop(1, '#8b5cf6');
    } else {
      grad.addColorStop(0, '#8b5cf6');
      grad.addColorStop(1, '#22d3ee');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.stroke();
  }
  ctx.fillStyle = (style === 'active' || style === 'primary') ? '#0b0d16' : '#eef0fb';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 9);
  ctx.globalAlpha = 1;
}
