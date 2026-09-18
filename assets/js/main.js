document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');
navToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
mainNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => mainNav.classList.remove('open'));
});

// --- Tech-preview mini game: catch the falling orbs ---
(function () {
  const canvas = document.getElementById('demoCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('demoScore');
  const bestEl = document.getElementById('demoBest');
  const startBtn = document.getElementById('demoStart');

  const W = canvas.width, H = canvas.height;
  const PADDLE_W = 70, PADDLE_H = 12;
  const colors = ['#8b5cf6', '#22d3ee', '#ec4899'];

  let paddleX = W / 2 - PADDLE_W / 2;
  let orbs = [];
  let score = 0;
  let misses = 0;
  let running = false;
  let rafId = null;
  let spawnTimer = 0;
  let best = Number(localStorage.getItem('arcforgeDemoBest') || 0);
  bestEl.textContent = best;

  function resetGame() {
    orbs = [];
    score = 0;
    misses = 0;
    spawnTimer = 0;
    scoreEl.textContent = '0';
  }

  function spawnOrb() {
    const r = 9 + Math.random() * 6;
    orbs.push({
      x: r + Math.random() * (W - r * 2),
      y: -r,
      r,
      speed: 1.6 + Math.random() * 1.8 + score * 0.02,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // floor line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, H - 18);
    ctx.lineTo(W, H - 18);
    ctx.stroke();

    // paddle
    const grad = ctx.createLinearGradient(paddleX, 0, paddleX + PADDLE_W, 0);
    grad.addColorStop(0, '#8b5cf6');
    grad.addColorStop(1, '#22d3ee');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(paddleX, H - 30, PADDLE_W, PADDLE_H, 6);
    ctx.fill();

    // orbs
    orbs.forEach(o => {
      ctx.beginPath();
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 14;
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function step() {
    spawnTimer++;
    const spawnRate = Math.max(22, 46 - Math.floor(score / 3));
    if (spawnTimer >= spawnRate) {
      spawnTimer = 0;
      spawnOrb();
    }

    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.y += o.speed;

      const paddleTop = H - 30;
      const hitPaddle =
        o.y + o.r >= paddleTop &&
        o.y - o.r <= paddleTop + PADDLE_H &&
        o.x >= paddleX - o.r &&
        o.x <= paddleX + PADDLE_W + o.r;

      if (hitPaddle) {
        orbs.splice(i, 1);
        score++;
        scoreEl.textContent = String(score);
      } else if (o.y - o.r > H) {
        orbs.splice(i, 1);
        misses++;
        if (misses >= 3) {
          endGame();
          return;
        }
      }
    }

    draw();
    rafId = requestAnimationFrame(step);
  }

  function endGame() {
    running = false;
    if (score > best) {
      best = score;
      localStorage.setItem('arcforgeDemoBest', String(best));
      bestEl.textContent = String(best);
    }
    startBtn.textContent = 'Play again';
    ctx.fillStyle = 'rgba(6,7,13,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#eef0fb';
    ctx.font = '600 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game over — score ' + score, W / 2, H / 2);
  }

  function startGame() {
    resetGame();
    running = true;
    startBtn.textContent = 'Restart';
    cancelAnimationFrame(rafId);
    step();
  }

  function movePaddleTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (clientX - rect.left) * scale;
    paddleX = Math.min(W - PADDLE_W, Math.max(0, x - PADDLE_W / 2));
    if (!running) draw();
  }

  canvas.addEventListener('mousemove', e => movePaddleTo(e.clientX));
  canvas.addEventListener('touchmove', e => {
    if (e.touches[0]) movePaddleTo(e.touches[0].clientX);
    e.preventDefault();
  }, { passive: false });

  startBtn.addEventListener('click', startGame);

  draw();
})();

// --- Tech-preview mini game #2: "Arc Catch" — orbs fall from above AND arc in from
// both sides in a curving parabola.
// Side-entry height starts high (easy, more reaction time) and lowers as the score grows,
// down to a floor of 25% canvas height — it never spawns lower than that.
(function () {
  const canvas = document.getElementById('demoCanvas2');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('demoScore2');
  const bestEl = document.getElementById('demoBest2');
  const startBtn = document.getElementById('demoStart2');

  const W = canvas.width, H = canvas.height;
  const PADDLE_W = 70, PADDLE_H = 12;
  const PADDLE_TOP = H - 30;
  const FLOOR_Y = H - 18;
  const colors = ['#8b5cf6', '#22d3ee', '#ec4899'];

  const START_MIN_HEIGHT_PCT = 50; // side orbs start no lower than the upper half
  const HARD_MIN_HEIGHT_PCT = 25;  // and never drop below a quarter of the canvas height

  let paddleX = W / 2 - PADDLE_W / 2;
  let orbs = [];
  let score = 0;
  let misses = 0;
  let rafId = null;
  let spawnTimer = 0;
  let best = Number(localStorage.getItem('arcforgeEyeTrainerBest') || 0);
  bestEl.textContent = best;

  function resetGame() {
    orbs = [];
    score = 0;
    misses = 0;
    spawnTimer = 0;
    scoreEl.textContent = '0';
  }

  // Height is measured from the floor upward as a % of canvas height — this is what
  // ramps down (toward the 25% floor) as score climbs, making side entries harder over time.
  function currentMinHeightPct() {
    return Math.max(HARD_MIN_HEIGHT_PCT, START_MIN_HEIGHT_PCT - Math.floor(score / 2));
  }

  function heightPctToY(pct) {
    return H - (pct / 100) * H;
  }

  function spawnOrb() {
    const r = 9 + Math.random() * 6;
    const color = colors[Math.floor(Math.random() * colors.length)];

    if (Math.random() < 0.5) {
      // Straight fall from the top, same feel as the original catch game.
      orbs.push({
        x: r + Math.random() * (W - r * 2),
        y: -r,
        r, color,
        vx: 0, vy: 1.6 + Math.random() * 1.8 + score * 0.02,
        gravity: 0,
      });
      return;
    }

    // Side entry: launches roughly horizontally from the left or right edge, then a
    // constant "gravity" pulls it down into a curving parabolic arc toward the paddle.
    const fromLeft = Math.random() < 0.5;
    const minPct = currentMinHeightPct();
    const entryPct = minPct + Math.random() * (95 - minPct);
    const entryY = heightPctToY(entryPct);
    const speed = 2.2 + Math.random() * 1.6 + score * 0.015;
    orbs.push({
      x: fromLeft ? -r : W + r,
      y: entryY,
      r, color,
      vx: fromLeft ? speed : -speed,
      vy: 0,
      gravity: 0.08 + score * 0.0006,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();

    const grad = ctx.createLinearGradient(paddleX, 0, paddleX + PADDLE_W, 0);
    grad.addColorStop(0, '#8b5cf6');
    grad.addColorStop(1, '#22d3ee');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(paddleX, PADDLE_TOP, PADDLE_W, PADDLE_H, 6);
    ctx.fill();

    orbs.forEach(o => {
      ctx.beginPath();
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 14;
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function step() {
    spawnTimer++;
    const spawnRate = Math.max(24, 52 - Math.floor(score / 3));
    if (spawnTimer >= spawnRate) {
      spawnTimer = 0;
      spawnOrb();
    }

    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.vy += o.gravity;
      o.x += o.vx;
      o.y += o.vy;

      const hitPaddle =
        o.y + o.r >= PADDLE_TOP &&
        o.y - o.r <= PADDLE_TOP + PADDLE_H &&
        o.x >= paddleX - o.r &&
        o.x <= paddleX + PADDLE_W + o.r;

      const outOfBounds = o.y - o.r > H || o.x < -o.r - 6 || o.x > W + o.r + 6;

      if (hitPaddle) {
        orbs.splice(i, 1);
        score++;
        scoreEl.textContent = String(score);
      } else if (outOfBounds) {
        orbs.splice(i, 1);
        misses++;
        if (misses >= 3) {
          endGame();
          return;
        }
      }
    }

    draw();
    rafId = requestAnimationFrame(step);
  }

  function endGame() {
    if (score > best) {
      best = score;
      localStorage.setItem('arcforgeEyeTrainerBest', String(best));
      bestEl.textContent = String(best);
    }
    startBtn.textContent = 'Play again';
    ctx.fillStyle = 'rgba(6,7,13,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#eef0fb';
    ctx.font = '600 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game over — score ' + score, W / 2, H / 2);
  }

  function startGame() {
    resetGame();
    startBtn.textContent = 'Restart';
    cancelAnimationFrame(rafId);
    step();
  }

  function movePaddleTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (clientX - rect.left) * scale;
    paddleX = Math.min(W - PADDLE_W, Math.max(0, x - PADDLE_W / 2));
    draw();
  }

  canvas.addEventListener('mousemove', e => movePaddleTo(e.clientX));
  canvas.addEventListener('touchmove', e => {
    if (e.touches[0]) movePaddleTo(e.touches[0].clientX);
    e.preventDefault();
  }, { passive: false });

  startBtn.addEventListener('click', startGame);

  draw();
})();

// --- Tech-preview mini game #3: "Word Game" — three candidate words drift in freely from
// the right (their own speed and gentle vertical float, not fixed lanes); the player taps
// whichever one is the correct synonym or antonym of the target word (shown at the top)
// before it drifts past. Timed like a real test section (90 seconds), not endless — a quick,
// focused vocabulary drill. Word bank is our own
// compilation, not copied from any test-prep publisher's list.
(function () {
  const canvas = document.getElementById('demoCanvas3');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('demoScore3');
  const bestEl = document.getElementById('demoBest3');
  const startBtn = document.getElementById('demoStart3');
  const modeBtnSynonym = document.getElementById('modeBtnSynonym');
  const modeBtnAntonym = document.getElementById('modeBtnAntonym');

  const W = canvas.width, H = canvas.height;
  const ROUND_SECONDS = 90;
  const WORD_TOP = 95, WORD_BOTTOM = 285; // vertical band the moving words drift within

  // Full word bank shared with the Word Game preview (games/word-game): rows are
  // [word, synonym, antonym | null, distractor, distractor, meaning]. A null antonym means the
  // word is only used in Synonym mode.
  let WORD_BANK = [];

  let state = 'idle'; // 'idle' | 'playing' | 'ended'
  let timeLeft = ROUND_SECONDS;
  let score = 0;
  let round = null; // { targetWord, mode, words: [{ text, x, y, vy, speed, correct }] }
  let selectedMode = 'synonym'; // player's choice via the toggle buttons, before starting
  let sessionMode = 'synonym'; // locked from selectedMode at startGame() — fixed for the whole session
  let recentWords = [];
  let rafId = null;
  let lastTs = 0;
  let best = Number(localStorage.getItem('arcforgeWordMatchBest') || 0);
  bestEl.textContent = best;

  function pickEntry() {
    const pool = sessionMode === 'synonym' ? WORD_BANK : WORD_BANK.filter(e => e[2] !== null);
    let entry;
    do {
      entry = pool[Math.floor(Math.random() * pool.length)];
    } while (recentWords.includes(entry[0]) && recentWords.length < pool.length);
    recentWords.push(entry[0]);
    if (recentWords.length > 6) recentWords.shift();
    return entry;
  }

  function spawnRound() {
    const [word, synonym, antonym, d1, d2] = pickEntry();
    const mode = sessionMode;
    const correctText = mode === 'synonym' ? synonym : antonym;
    const options = [{ text: correctText, correct: true }, { text: d1, correct: false }, { text: d2, correct: false }];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const speedBase = 55 + Math.min(60, score * 3);
    // Each word gets its own free-floating vertical band (not a fixed lane row), a random
    // drift velocity, and its own random horizontal speed and start offset.
    const bandH = (WORD_BOTTOM - WORD_TOP) / options.length;
    round = {
      targetWord: word,
      mode,
      words: options.map((o, i) => ({
        text: o.text,
        correct: o.correct,
        x: W + 20 + Math.random() * 140,
        y: WORD_TOP + i * bandH + 20 + Math.random() * (bandH - 40),
        vy: (Math.random() * 2 - 1) * 14,
        speed: speedBase + Math.random() * 20,
      })),
    };
  }

  function resolveRound(hit) {
    if (hit) {
      score++;
      scoreEl.textContent = String(score);
    }
    round = null;
    spawnRound();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#262a3f');
    g.addColorStop(1, '#181a26');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    drawBackground();

    if (state === 'idle') {
      ctx.fillStyle = '#eef0fb';
      ctx.textAlign = 'center';
      ctx.font = '600 20px Inter, sans-serif';
      ctx.fillText(`Tap Play to start a 90-second ${selectedMode} round`, W / 2, H / 2);
      return;
    }

    if (round) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9aa0c0';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText(`TAP THE ${round.mode.toUpperCase()} OF`, W / 2, 34);
      ctx.fillStyle = '#eef0fb';
      ctx.font = '700 26px Inter, sans-serif';
      ctx.fillText(round.targetWord, W / 2, 66);

      // Plain text, same size, weight and colour as the target word — no buttons, no colour cues.
      ctx.textAlign = 'left';
      ctx.fillStyle = '#eef0fb';
      ctx.font = '700 26px Inter, sans-serif';
      round.words.forEach((word) => ctx.fillText(word.text, word.x, word.y));
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#9aa0c0';
    ctx.font = '600 14px Inter, sans-serif';
    const mm = Math.floor(timeLeft / 60), ss = Math.floor(timeLeft % 60);
    ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, W - 14, 20);

    if (state === 'ended') {
      ctx.fillStyle = 'rgba(6,7,13,0.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#eef0fb';
      ctx.textAlign = 'center';
      ctx.font = '600 20px Inter, sans-serif';
      ctx.fillText("Time's up — score " + score, W / 2, H / 2);
    }
  }

  function step(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    if (state === 'playing') {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        endGame();
      } else if (round) {
        for (const word of round.words) {
          word.x -= word.speed * dt;
          word.y += word.vy * dt;
          if (word.y < WORD_TOP || word.y > WORD_BOTTOM) word.vy *= -1;
          word.y = Math.min(WORD_BOTTOM, Math.max(WORD_TOP, word.y));
        }
        const correctWord = round.words.find(w => w.correct);
        if (correctWord && correctWord.x < -80) resolveRound(false);
      }
    }

    draw();
    if (state === 'playing') rafId = requestAnimationFrame(step);
  }

  function endGame() {
    state = 'ended';
    round = null;
    if (score > best) {
      best = score;
      localStorage.setItem('arcforgeWordMatchBest', String(best));
      bestEl.textContent = String(best);
    }
    startBtn.textContent = 'Play again';
    setModeButtonsDisabled(false);
    draw();
  }

  function startGame() {
    state = 'playing';
    timeLeft = ROUND_SECONDS;
    score = 0;
    scoreEl.textContent = '0';
    recentWords = [];
    round = null;
    lastTs = 0;
    sessionMode = selectedMode; // locked in from the player's toggle choice for this whole session
    spawnRound();
    startBtn.textContent = 'Stop';
    setModeButtonsDisabled(true);
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(step);
  }

  // Ends the session early (before the 90s timer runs out) so the player can re-pick
  // synonym/antonym and start a fresh session, instead of waiting the round out.
  function stopGame() {
    cancelAnimationFrame(rafId);
    state = 'idle';
    round = null;
    if (score > best) {
      best = score;
      localStorage.setItem('arcforgeWordMatchBest', String(best));
      bestEl.textContent = String(best);
    }
    startBtn.textContent = 'Play';
    setModeButtonsDisabled(false);
    draw();
  }

  function setModeButtonsDisabled(disabled) {
    modeBtnSynonym.disabled = disabled;
    modeBtnAntonym.disabled = disabled;
  }

  function setSelectedMode(mode) {
    if (state === 'playing') return; // don't let the toggle change mid-session
    selectedMode = mode;
    modeBtnSynonym.classList.toggle('is-active', mode === 'synonym');
    modeBtnAntonym.classList.toggle('is-active', mode === 'antonym');
    if (state === 'idle') draw();
  }

  modeBtnSynonym.addEventListener('click', () => setSelectedMode('synonym'));
  modeBtnAntonym.addEventListener('click', () => setSelectedMode('antonym'));

  function handleTap(clientX, clientY) {
    if (state !== 'playing' || !round) return;
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    for (const word of round.words) {
      ctx.font = '700 26px Inter, sans-serif';
      const w = ctx.measureText(word.text).width;
      if (x >= word.x - 12 && x <= word.x + w + 12 && y >= word.y - 30 && y <= word.y + 12) {
        resolveRound(word.correct);
        return;
      }
    }
  }

  canvas.addEventListener('click', e => handleTap(e.clientX, e.clientY));
  canvas.addEventListener('touchstart', e => {
    if (e.touches[0]) handleTap(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });

  startBtn.addEventListener('click', () => {
    if (state === 'playing') stopGame();
    else if (WORD_BANK.length) startGame();
  });

  startBtn.disabled = true;
  import('../../games/word-game/play/game/src/words.js')
    .then((m) => { WORD_BANK = m.WORDS; startBtn.disabled = false; })
    .catch(() => { startBtn.textContent = 'Unavailable'; });

  draw();
})();
