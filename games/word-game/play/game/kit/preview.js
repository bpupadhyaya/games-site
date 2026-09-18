// Free-preview gate shared by every game: the player gets `monetization.previewSeconds` of play
// (cumulative, persisted), then the game freezes behind an unlock screen until `unlock_game` is
// owned. Wraps a game object from the outside, so game code never sees it; boot() applies it
// whenever game.json declares previewSeconds. Time is counted from the fixed update step, so it
// is deterministic and pauses whenever the loop is stopped (background, app.pause).
const PRODUCT_ID = 'unlock_game';
const STORAGE_KEY = '__previewMs';
const SAVE_EVERY_MS = 1000;

const formatClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const priceLabel = (product, price) => {
  if (!product) return 'Unlock';
  if (product.type === 'subscription') return `Subscribe — ${price}/${product.period ?? 'month'}`;
  return `Unlock full game — ${price}`;
};

export function createPreviewGate({ game, meta, storage, monetization, manifest, demo = false }) {
  const config = manifest.monetization ?? {};
  const limitMs = (config.previewSeconds ?? 0) * 1000;
  if (!(limitMs > 0)) return game;

  const product = (config.products ?? []).find((p) => p.id === PRODUCT_ID);
  const w = meta.width;
  const h = meta.height;
  const panel = { x: w * 0.08, y: h * 0.24, w: w * 0.84, h: h * 0.52 };
  const buyBtn = { x: panel.x + 40, y: panel.y + panel.h - 250, w: panel.w - 80, h: 80 };
  const restoreBtn = { x: panel.x + 40, y: panel.y + panel.h - 150, w: panel.w - 80, h: 60 };
  const textW = panel.w - 80;

  // Greedy word wrap so no line ever runs past the panel.
  const wrap = (ctx, text, maxW) => {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  let usedMs = 0;
  let unsavedMs = 0;
  let loaded = false;
  let busy = false;
  let message = '';
  let owned = monetization.owns(PRODUCT_ID);
  monetization.onChange(() => {
    owned = monetization.owns(PRODUCT_ID);
  });
  // The game never waits on this read: play (and the timer) start immediately, and the saved
  // total is merged in whenever it arrives. `loaded` only gates the overlay.
  storage.get(STORAGE_KEY, 0).then((v) => {
    usedMs = Math.max(usedMs, Number(v) || 0);
  }).catch(() => {}).finally(() => {
    loaded = true;
  });

  const locked = () => !owned && usedMs >= limitMs;
  const persist = () => {
    unsavedMs = 0;
    storage.set(STORAGE_KEY, usedMs);
  };
  const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  const buy = async () => {
    if (busy) return;
    busy = true;
    message = '';
    const res = await monetization.purchase(PRODUCT_ID).catch(() => ({ ok: false }));
    busy = false;
    if (res.ok) owned = true;
    else if (res.reason === 'pending') message = 'Payment pending approval. It unlocks once approved.';
    else if (res.reason && res.reason !== 'cancelled') {
      message = /^(not-configured|billing-unavailable)/.test(res.reason)
        ? 'The store is not available right now. Try again later.'
        : 'Purchase did not complete. Please try again.';
    }
  };
  const restore = async () => {
    if (busy) return;
    busy = true;
    message = '';
    await monetization.restore().catch(() => {});
    busy = false;
    owned = monetization.owns(PRODUCT_ID);
    if (!owned) message = 'No previous purchase found.';
  };

  const drawButton = (ctx, r, label, fill, textColor) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 18);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  };

  const drawOverlay = (ctx) => {
    ctx.fillStyle = 'rgba(8, 8, 16, 0.88)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f2135';
    ctx.beginPath();
    ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 28);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.fillText('Free preview finished', w / 2, panel.y + 70);
    ctx.font = '400 26px system-ui, sans-serif';
    ctx.fillStyle = '#c9cce0';
    const body = demo
      ? `You've played the free preview of ${manifest.title}. Get the full game on iPhone and Android.`
      : `You've played the ${config.previewSeconds}-second preview of ${manifest.title}. Unlock it to keep playing.`;
    wrap(ctx, body, textW).forEach((line, i) => ctx.fillText(line, w / 2, panel.y + 140 + i * 38));
    if (!demo) {
      drawButton(ctx, buyBtn, busy ? 'Please wait…' : priceLabel(product, monetization.priceOf?.(PRODUCT_ID) ?? `$${product?.priceUsd?.toFixed(2)}`), '#8b5cf6', '#ffffff');
      drawButton(ctx, restoreBtn, 'Restore purchase', 'rgba(255,255,255,0.10)', '#e5e7f5');
      if (message) {
        ctx.font = '400 24px system-ui, sans-serif';
        ctx.fillStyle = '#f9a8d4';
        wrap(ctx, message, textW).forEach((line, i) => ctx.fillText(line, w / 2, restoreBtn.y + restoreBtn.h + 30 + i * 30));
      }
    }
  };

  const drawCountdown = (ctx) => {
    const label = `Preview ${formatClock(limitMs - usedMs)}`;
    ctx.font = '600 20px system-ui, sans-serif';
    const pw = ctx.measureText(label).width + 28;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(w - pw - 10, 8, pw, 32, 16);
    ctx.fill();
    ctx.fillStyle = '#e5e7f5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w - pw / 2 - 10, 24);
  };

  return {
    ...game,
    update(dt, input) {
      if (locked()) {
        if (!demo && input.pointer.pressed) {
          const { x, y } = input.pointer;
          if (inRect(x, y, buyBtn)) buy();
          else if (inRect(x, y, restoreBtn)) restore();
        }
        return;
      }
      game.update(dt, input);
      if (owned) return;
      usedMs += dt * 1000;
      unsavedMs += dt * 1000;
      if (unsavedMs >= SAVE_EVERY_MS || usedMs >= limitMs) persist();
    },
    render(ctx, view) {
      game.render(ctx, view);
      ctx.save();
      if (locked()) drawOverlay(ctx);
      else if (!owned) drawCountdown(ctx);
      ctx.restore();
    },
    flushPreview: persist,
    get previewMsLeft() {
      return owned ? Infinity : Math.max(0, limitMs - usedMs);
    },
  };
}
