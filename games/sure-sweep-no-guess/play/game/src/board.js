// Pure grid helpers shared by the game, the solver and the no-guess generator.
// No randomness and no time here — everything is a plain function of its inputs.

export function indexOf(r, c, w) {
  return r * w + c;
}

export function neighbors(i, w, h) {
  const r = Math.floor(i / w);
  const c = i % w;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < h && nc >= 0 && nc < w) out.push(indexOf(nr, nc, w));
    }
  }
  return out;
}

// numbers[i] is -1 for a mine, otherwise the count of mines in its 8 neighbours.
export function computeNumbers(mines, w, h) {
  const total = w * h;
  const numbers = new Array(total).fill(0);
  for (let i = 0; i < total; i++) {
    if (mines.has(i)) {
      numbers[i] = -1;
      continue;
    }
    let count = 0;
    for (const n of neighbors(i, w, h)) if (mines.has(n)) count++;
    numbers[i] = count;
  }
  return numbers;
}

// Classic flood fill: reveals `start`, and if it is a blank (0) cell, keeps opening
// connected blank cells and the single ring of numbered cells bordering them.
// Mutates `revealed` in place. Never reveals a mine itself (caller decides that).
export function floodReveal(revealed, numbers, start, w, h) {
  if (revealed[start]) return;
  const stack = [start];
  while (stack.length) {
    const i = stack.pop();
    if (revealed[i]) continue;
    revealed[i] = true;
    if (numbers[i] === 0) {
      for (const n of neighbors(i, w, h)) if (!revealed[n]) stack.push(n);
    }
  }
}
