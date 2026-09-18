// GAME CONTRACT (docs/GAME-CONTRACT.md) — every game exports exactly these two things:
//   meta                      virtual resolution the game draws in
//   createGame(env) -> { update(dt, input), render(ctx, view), getState() }
// Rules: no DOM/window access in web/src, no Math.random / Date.now (use env.rng and dt).
//
// WORD GAME: a target word is shown at the top; three candidate words drift freely (own speed,
// own vertical bounce within a band) across the screen from right to left. The player taps the
// one that correctly matches the target (synonym or antonym, chosen before the session and
// locked for its whole 90 seconds). See design/GDD.md for the full design.
import { WORDS } from './words.js';

export const meta = { width: 720, height: 1280 };

const SESSION_SECONDS = 90;
// Web preview (env.config.demo) is marketing for the full iOS/Android game, not a substitute
// for it — cap how many full sessions are playable for free. See docs/GAME-CONTRACT.md's
// "Web preview" section and design/GDD.md's "Demo cut".
const DEMO_SESSION_LIMIT = 2;
const RECENT_WORDS_MAX = 6;

// Vertical band the three candidate words drift within — deliberately tall (most of the screen
// height) and split into three independent slices so the words come in at varied heights.
const BAND_TOP = 300;
const BAND_BOTTOM = 1000;
const SLICE_H = (BAND_BOTTOM - BAND_TOP) / 3;
const SLICE_MARGIN = 30;

const SPEED_BASE = 140;
const SPEED_PER_POINT = 18;
const SPEED_CAP_BONUS = 260;
const SPEED_JITTER = 40;

const CHAR_W = 30; // approximate px/char at the candidate-word font size, used for both hit-testing and drawing
const CHIP_PAD_X = 20;
const CHIP_H = 84;

const KEY_CODES = ['Digit1', 'Digit2', 'Digit3'];

const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const wordChipWidth = (text) => text.length * CHAR_W + CHIP_PAD_X * 2;

// Title-screen / gameover-screen button rects (virtual units).
const MODE_SYN_BTN = { x: 70, y: 480, w: 270, h: 90 };
const MODE_ANT_BTN = { x: 380, y: 480, w: 270, h: 90 };
const PLAY_BTN = { x: 160, y: 610, w: 400, h: 110 };

// Ends the current session early (same effect as the 90s clock running out) so the player isn't
// forced to either finish the timer or fully exit the app via the OS back button to change mode.
const STOP_BTN = { x: 260, y: 1140, w: 200, h: 76 };
const COLOR_BTN = { x: 490, y: 1140, w: 200, h: 76 };
const TITLE_COLOR_BTN = { x: 160, y: 760, w: 400, h: 78 };

// Colour schemes. Index 0 is the original look and stays the default; players can cycle through
// the others on the title screen or while playing. All words share the scheme's one text colour.
const SCHEMES = [
  { name: 'Default', stops: ['#3a3560', '#262a42', '#181a26'], text: '#eef0fb' },
  { name: 'High contrast', stops: ['#000000', '#000000', '#000000'], text: '#ffffff' },
  { name: 'Ocean', stops: ['#1d4e7a', '#123556', '#0a1f36'], text: '#e8f4ff' },
  { name: 'Forest', stops: ['#1f5a44', '#153f30', '#0d2620'], text: '#eafaf1' },
  { name: 'Warm', stops: ['#6a3a2a', '#45261e', '#26150f'], text: '#fff1e6' },
];

// Session review screen: every answer from the session, mistakes first, paged.
const REVIEW_TOP = 250;
const REVIEW_ROW_H = 134;
const REVIEW_PER_PAGE = 5;
const PREV_BTN = { x: 40, y: 1010, w: 200, h: 70 };
const NEXT_BTN = { x: 480, y: 1010, w: 200, h: 70 };
const PLAY_AGAIN_BTN = { x: 40, y: 1120, w: 310, h: 90 };
const CHANGE_MODE_BTN = { x: 370, y: 1120, w: 310, h: 90 };

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
    history: [], // this session's answers: { word, mode, answer, picked (null = drifted past), correct }
    reviewPage: 0,
    scheme: 0,
    demo,
    demoSessions: 0,
    demoLimitReached: false,
    round: null, // { targetWord, mode, words: [{ text, correct, slot, w, x, y, vy, speed }] }
  };

  let recentWords = [];

  storage.get('scheme', 0).then((v) => (state.scheme = SCHEMES[v] ? v : 0));
  const cycleScheme = () => {
    state.scheme = (state.scheme + 1) % SCHEMES.length;
    storage.set('scheme', state.scheme);
  };
  storage.get('bestSynonym', 0).then((v) => (state.bestSynonym = v));
  storage.get('bestAntonym', 0).then((v) => (state.bestAntonym = v));
  if (demo) {
    storage.get('demoSessions', 0).then((v) => {
      state.demoSessions = v;
      if (v >= DEMO_SESSION_LIMIT) state.demoLimitReached = true;
    });
  }
  // Words without an antonym only appear in Synonym mode.
  const activePack = () => (state.mode === 'synonym' ? WORDS : WORDS.filter((e) => e[2] !== null));

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
    const [word, synonym, antonym, d1, d2, meaning] = pickEntry();
    const correctText = state.mode === 'synonym' ? synonym : antonym;
    const options = rng.shuffle([
      { text: correctText, correct: true },
      { text: d1, correct: false },
      { text: d2, correct: false },
    ]);
    const speed = SPEED_BASE + Math.min(SPEED_CAP_BONUS, state.score * SPEED_PER_POINT);
    state.round = {
      targetWord: word,
      meaning,
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
    state.history = [];
    state.reviewPage = 0;
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
    state.reviewPage = 0;
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

  const resolveRound = (picked) => {
    const round = state.round;
    const answer = round.words.find((w) => w.correct).text;
    const hit = picked !== null && picked === answer;
    state.history.push({ word: round.targetWord, meaning: round.meaning, mode: round.mode, answer, picked, correct: hit });
    if (hit) {
      state.score += 1;
      audio.tone({ freq: 620, to: 900, dur: 0.1, type: 'triangle', vol: 0.22 });
    } else {
      audio.tone({ freq: 220, to: 140, dur: 0.16, type: 'sawtooth', vol: 0.18 });
    }
    spawnRound();
  };

  const updateTitle = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer;
    if (inRect(x, y, MODE_SYN_BTN)) state.selectedMode = 'synonym';
    else if (inRect(x, y, MODE_ANT_BTN)) state.selectedMode = 'antonym';
    else if (inRect(x, y, PLAY_BTN)) startSession();
    else if (inRect(x, y, TITLE_COLOR_BTN)) cycleScheme();
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
      if (inRect(input.pointer.x, input.pointer.y, COLOR_BTN)) {
        cycleScheme();
        return;
      }
      if (inRect(input.pointer.x, input.pointer.y, STOP_BTN)) {
        endSession();
        return;
      }
      const hit = round.words.find((w) => input.pointer.x >= w.x - w.w / 2 && input.pointer.x <= w.x + w.w / 2 && input.pointer.y >= w.y - CHIP_H / 2 && input.pointer.y <= w.y + CHIP_H / 2);
      if (hit) {
        resolveRound(hit.text);
        return;
      }
    }
    for (const code of KEY_CODES) {
      if (input.keys.pressed.has(code)) {
        const slot = KEY_CODES.indexOf(code);
        const w = round.words.find((rw) => rw.slot === slot);
        if (w) {
          resolveRound(w.text);
          return;
        }
      }
    }

    const correctWord = round.words.find((w) => w.correct);
    if (correctWord && correctWord.x + correctWord.w / 2 < 0) resolveRound(null);
  };

  const reviewRows = () => {
    const wrong = state.history.filter((h) => !h.correct);
    return wrong.concat(state.history.filter((h) => h.correct));
  };
  const reviewPages = () => Math.max(1, Math.ceil(state.history.length / REVIEW_PER_PAGE));

  const updateGameover = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer;
    if (inRect(x, y, PLAY_AGAIN_BTN)) startSession();
    else if (inRect(x, y, CHANGE_MODE_BTN)) state.scene = 'title';
    else if (inRect(x, y, PREV_BTN)) state.reviewPage = Math.max(0, state.reviewPage - 1);
    else if (inRect(x, y, NEXT_BTN)) state.reviewPage = Math.min(reviewPages() - 1, state.reviewPage + 1);
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
      const scheme = SCHEMES[state.scheme];
      g.addColorStop(0, scheme.stops[0]);
      g.addColorStop(0.55, scheme.stops[1]);
      g.addColorStop(1, scheme.stops[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, meta.width, meta.height);

      ctx.textAlign = 'center';

      if (state.scene === 'title') {
        ctx.fillStyle = scheme.text;
        ctx.font = 'bold 60px system-ui, sans-serif';
        ctx.fillText(env.manifest.title, meta.width / 2, 160);
        ctx.font = '28px system-ui, sans-serif';
        ctx.fillStyle = '#9aa0c0';
        ctx.fillText('Tap the word that matches — before it drifts away', meta.width / 2, 210);
        ctx.fillText('Graduate-level vocabulary', meta.width / 2, 250);

        drawButton(ctx, MODE_SYN_BTN, 'Synonym', state.selectedMode === 'synonym' ? 'active' : undefined);
        drawButton(ctx, MODE_ANT_BTN, 'Antonym', state.selectedMode === 'antonym' ? 'active' : undefined);

        const bestNow = state.selectedMode === 'synonym' ? state.bestSynonym : state.bestAntonym;
        ctx.fillStyle = scheme.text;
        ctx.font = '600 26px system-ui, sans-serif';
        ctx.fillText(`Best (${state.selectedMode}): ${bestNow}`, meta.width / 2, 440);

        drawButton(ctx, PLAY_BTN, 'Play', 'primary');
        drawButton(ctx, TITLE_COLOR_BTN, `🎨 Colours: ${scheme.name}`);

        if (demo) {
          ctx.fillStyle = '#9aa0c0';
          ctx.font = '600 22px system-ui, sans-serif';
          const left = Math.max(0, DEMO_SESSION_LIMIT - state.demoSessions);
          ctx.fillText(`Free preview — ${left} session(s) left`, meta.width / 2, 470);
        }
        return;
      }

      if (state.scene === 'demo-limit') {
        ctx.fillStyle = scheme.text;
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
      ctx.fillStyle = scheme.text;
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
        ctx.fillStyle = scheme.text;
        ctx.font = 'bold 52px system-ui, sans-serif';
        ctx.fillText(state.round.targetWord, meta.width / 2, 210);

        // Words drift as plain text — no chip behind them and one shared colour, so nothing
        // pulls the eye toward a particular option.
        ctx.fillStyle = scheme.text;
        // Same size and weight as the target word so the two read as equals.
        ctx.font = 'bold 52px system-ui, sans-serif';
        for (const w of state.round.words) ctx.fillText(w.text, w.x, w.y + 18);

        if (state.scene === 'playing') {
          drawButton(ctx, STOP_BTN, 'Stop');
          drawButton(ctx, COLOR_BTN, '🎨 Colours');
        }
      }

      if (state.scene === 'gameover') {
        ctx.fillStyle = 'rgba(6,7,13,0.82)';
        ctx.fillRect(0, 0, meta.width, meta.height);
        ctx.fillStyle = scheme.text;
        ctx.font = 'bold 50px system-ui, sans-serif';
        ctx.fillText("Time's up! Review", meta.width / 2, 90);
        const right = state.history.filter((h) => h.correct).length;
        ctx.font = '600 32px system-ui, sans-serif';
        ctx.fillText(`Score ${state.score}  ·  ${right} right, ${state.history.length - right} missed`, meta.width / 2, 150);
        ctx.font = '26px system-ui, sans-serif';
        ctx.fillStyle = state.newBest ? '#22d3ee' : '#9aa0c0';
        const bestNow = state.mode === 'synonym' ? state.bestSynonym : state.bestAntonym;
        ctx.fillText(state.newBest ? `New best! (${state.mode}: ${bestNow})` : `Best (${state.mode}): ${bestNow}`, meta.width / 2, 195);

        const rows = reviewRows();
        if (!rows.length) {
          ctx.fillStyle = '#9aa0c0';
          ctx.font = '28px system-ui, sans-serif';
          ctx.fillText('No answers this session.', meta.width / 2, REVIEW_TOP + 60);
        } else if (rows.every((h) => h.correct)) {
          ctx.fillStyle = '#4ade80';
          ctx.font = '600 26px system-ui, sans-serif';
          ctx.fillText('No mistakes — every answer was right.', meta.width / 2, REVIEW_TOP - 8);
        }
        rows.slice(state.reviewPage * REVIEW_PER_PAGE, (state.reviewPage + 1) * REVIEW_PER_PAGE).forEach((h, i) => {
          const y = REVIEW_TOP + i * REVIEW_ROW_H;
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          roundRect(ctx, 30, y, meta.width - 60, REVIEW_ROW_H - 10, 14);
          ctx.fill();
          ctx.fillStyle = h.correct ? '#4ade80' : '#f87171';
          ctx.textAlign = 'left';
          ctx.font = 'bold 34px system-ui, sans-serif';
          ctx.fillText(h.correct ? '✓' : '✗', 48, y + 44);
          ctx.fillStyle = scheme.text;
          ctx.font = 'bold 32px system-ui, sans-serif';
          ctx.fillText(h.word, 96, y + 40);
          ctx.textAlign = 'right';
          ctx.fillStyle = '#9aa0c0';
          ctx.font = '22px system-ui, sans-serif';
          ctx.fillText(h.mode, meta.width - 48, y + 38);
          ctx.textAlign = 'left';
          ctx.font = '26px system-ui, sans-serif';
          ctx.fillStyle = '#22d3ee';
          ctx.fillText(`Answer: ${h.answer}`, 96, y + 76);
          ctx.fillStyle = '#9aa0c0';
          ctx.font = '22px system-ui, sans-serif';
          ctx.fillText(h.meaning.length > 52 ? `${h.meaning.slice(0, 51)}…` : h.meaning, 96, y + 108);
          ctx.font = '26px system-ui, sans-serif';
          if (!h.correct) {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#f87171';
            ctx.fillText(h.picked === null ? 'missed' : `You: ${h.picked}`, meta.width - 48, y + 76);
          }
          ctx.textAlign = 'center';
        });

        const pages = reviewPages();
        if (pages > 1) {
          drawButton(ctx, PREV_BTN, 'Prev', undefined, state.reviewPage === 0);
          drawButton(ctx, NEXT_BTN, 'Next', undefined, state.reviewPage >= pages - 1);
          ctx.fillStyle = '#9aa0c0';
          ctx.font = '600 26px system-ui, sans-serif';
          ctx.fillText(`${state.reviewPage + 1} / ${pages}`, meta.width / 2, PREV_BTN.y + 45);
        }
        drawButton(ctx, PLAY_AGAIN_BTN, 'Play Again', 'primary');
        drawButton(ctx, CHANGE_MODE_BTN, 'Change Mode');
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
