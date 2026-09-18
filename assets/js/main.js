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

// --- Tech-preview mini game #2: "Eye Trainer" — orbs fall from above AND arc in from
// both sides in a curving parabola, so catching them keeps the eyes moving in every
// direction (vertical, diagonal, side-to-side) instead of just up-and-down tracking.
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
