// Free-preview gate shared by every game: the player gets `monetization.previewSeconds` of play
// (cumulative, persisted), then the game freezes behind an unlock screen until `unlock_game` is
// owned. Wraps a game object from the outside, so game code never sees it; boot() applies it
// whenever game.json declares previewSeconds. Time is counted from the fixed update step, so it
// is deterministic and pauses whenever the loop is stopped (background, app.pause).
//
// A game can exempt its own current scene from counting against the timer (e.g. an "Auto Play"
// teaching demo, meant to be free like the menu's own attract-mode preview, not gated like real
// play) by defining `isPreviewExempt()` on the object it returns from createGame - checked once
// per frame, no kit/boot.js changes needed. Games that don't define it are unaffected.
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

export function createPreviewGate({ game, meta, storage, monetization, manifest, demo = false, textScale: textScaleOf = null }) {
  const config = manifest.monetization ?? {};
  const limitMs = (config.previewSeconds ?? 0) * 1000;
  if (!(limitMs > 0)) return game;

  const product = (config.products ?? []).find((p) => p.id === PRODUCT_ID);
  // Geometry follows the live size: `meta.width/height` are updated by the view in fluid mode (kit 1.7.0), so the
  // unlock screen fills any screen shape, in portrait and in landscape. Kit 1.8.0: fonts and buttons also follow the live
  // css-px-per-unit (`meta.cssPerUnit`, set by the view) so text is never below ~11 css px and buttons never below 44 css px
  // tall, and the game's `env.config.textScale` (text zoom, default 1) scales the text. The overlay is English-only (future i18n).
  let w, h;
  let rects = null; // buy/restore rects as last DRAWN; hit-tests use exactly these
  const cssPerUnit = () => {
    const k = meta.cssPerUnit;
    if (k > 0) return k;
    const iw = globalThis.innerWidth, ih = globalThis.innerHeight;
    return iw && ih ? Math.min(iw / meta.width, ih / meta.height) : 1;
  };
  const textScale = () => {
    const t = Number(textScaleOf?.());
    return t > 0 ? Math.min(Math.max(t, 0.5), 3) : 1;
  };
  const sync = () => {
    w = meta.width;
    h = meta.height;
  };
  sync();

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

  const drawButton = (ctx, r, label, fill, textColor, fontPx) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(18, r.h / 3));
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  };

  // Lays the whole overlay out for the live size/zoom and returns it; drawing and hit-testing both use this result.
  // At text scale 1 on a normal phone the geometry is exactly the pre-1.8 one (panel 84% wide, Unlock button 80 units tall at
  // panel bottom - 250, Restore 60 tall at bottom - 150); it only grows when the 11 css px / 44 css px floors or text zoom need it.
  const layout = (ctx) => {
    const k = cssPerUnit();
    const u = textScale();
    const minPx = 11 / k; // 11 css px in virtual units
    const minBtn = 44 / k; // 44 css px
    const bodyText = demo
      ? `You've played the free preview of ${manifest.title}. Get the full game on iPhone and Android.`
      : `You've played the ${config.previewSeconds}-second preview of ${manifest.title}. Unlock it to keep playing.`;
    const buyLabel = busy ? 'Please wait…' : priceLabel(product, monetization.priceOf?.(PRODUCT_ID) ?? `$${product?.priceUsd?.toFixed(2)}`);
    const pw = Math.min(w * 0.84, 900 * Math.max(1, u));
    const oldPh = Math.min(Math.max(h * 0.52, 560), h * 0.94);
    const py0 = Math.max(h * 0.24 - Math.max(0, 560 - h * 0.52) / 2, h * 0.03);
    let L;
    for (const f of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
      const s = u * f;
      const fs = (base) => Math.max(base * s, minPx);
      const side = Math.min(40 * s, pw * 0.07);
      const textW = pw - side * 2;
      const tF = fs(44), bF = fs(26), btF = fs(30), mF = fs(24);
      ctx.font = `700 ${tF}px system-ui, sans-serif`;
      const titleLines = wrap(ctx, 'Free preview finished', textW);
      ctx.font = `400 ${bF}px system-ui, sans-serif`;
      const bodyLines = wrap(ctx, bodyText, textW);
      const lh = bF * 1.46;
      const titleC = tF * 1.59; // offsets from the panel top (70 / 140 units at the default sizes)
      const bodyC0 = tF * 3.18 + (titleLines.length - 1) * tF * 1.25;
      const textBottom = bodyC0 + (bodyLines.length - 1) * lh + bF * 0.8 + 20 * s;
      const buyH = demo ? 0 : Math.max(80 * s, minBtn);
      const restoreH = demo ? 0 : Math.max(60 * s, minBtn);
      ctx.font = `400 ${mF}px system-ui, sans-serif`;
      const msgLines = !demo && message ? wrap(ctx, message, textW) : [];
      const msgSpace = demo ? 30 * s : Math.max(90 * s, 25 * s + msgLines.length * mF * 1.3 + 15 * s);
      const needed = textBottom + (demo ? 0 : buyH + 20 * s + restoreH) + msgSpace;
      const ph = Math.min(Math.max(oldPh, needed), h * 0.96);
      L = { f, side, textW, tF, bF, btF, mF, lh, titleC, bodyC0, titleLines, bodyLines, msgLines, ph, pw, buyLabel, buyH, restoreH, msgSpace, s };
      if (needed <= h * 0.96) break;
    }
    L.px = (w - L.pw) / 2;
    L.py = Math.max(h * 0.02, Math.min(py0, h - L.ph - h * 0.03));
    if (!demo) {
      const bottom = L.py + L.ph;
      L.restore = { x: L.px + L.side, y: bottom - L.msgSpace - L.restoreH, w: L.textW, h: L.restoreH };
      L.buy = { x: L.px + L.side, y: L.restore.y - 20 * L.s - L.buyH, w: L.textW, h: L.buyH };
    }
    return L;
  };

  // Used only when a tap arrives before the first locked frame was drawn: approximate text metrics, no canvas needed.
  const measureOnly = { font: '', measureText(t) { return { width: String(t).length * (parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1]) || 20) * 0.5 }; } };

  const drawOverlay = (ctx) => {
    const L = layout(ctx);
    ctx.fillStyle = 'rgba(8, 8, 16, 0.88)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f2135';
    ctx.beginPath();
    ctx.roundRect(L.px, L.py, L.pw, L.ph, 28);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${L.tF}px system-ui, sans-serif`;
    L.titleLines.forEach((line, i) => ctx.fillText(line, w / 2, L.py + L.titleC + i * L.tF * 1.25));
    ctx.font = `400 ${L.bF}px system-ui, sans-serif`;
    ctx.fillStyle = '#c9cce0';
    L.bodyLines.forEach((line, i) => ctx.fillText(line, w / 2, L.py + L.bodyC0 + i * L.lh));
    rects = null;
    if (!demo) {
      const { buy, restore } = L;
      rects = { buy, restore };
      drawButton(ctx, buy, L.buyLabel, '#8b5cf6', '#ffffff', L.btF);
      drawButton(ctx, restore, 'Restore purchase', 'rgba(255,255,255,0.10)', '#e5e7f5', L.btF);
      if (L.msgLines.length) {
        ctx.font = `400 ${L.mF}px system-ui, sans-serif`;
        ctx.fillStyle = '#f9a8d4';
        L.msgLines.forEach((line, i) => ctx.fillText(line, w / 2, restore.y + restore.h + 30 * L.s + i * L.mF * 1.3));
      }
    }
  };

  // Small top-centre badge, kept below the device's top safe inset (notch / Dynamic Island) and never smaller than ~11 css px.
  // Opt out / relocate: `window.__previewBadge = {x, y, align}` or `meta.previewBadge` (virtual units; align 'left'|'center'|'right'
  // = which edge of the pill sits at x); hidden for `?shot=1` (store screenshots) and when `window.__noPreviewBadge` is true.
  const badgeHidden = () => {
    if (globalThis.__noPreviewBadge === true) return true;
    try { return new URLSearchParams(globalThis.location?.search ?? '').has('shot'); } catch { return false; }
  };
  const drawCountdown = (ctx) => {
    if (badgeHidden()) return;
    const k = cssPerUnit();
    const label = `Preview ${formatClock(limitMs - usedMs)}`;
    const fs = Math.max(16, 11.5 / k);
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    const ph = fs * 1.7;
    const pw = ctx.measureText(label).width + fs * 1.3;
    const custom = globalThis.__previewBadge ?? meta.previewBadge ?? null;
    const top = (globalThis.__safeInsets?.top || 0) / k;
    const ax = custom?.x ?? w / 2;
    const ay = custom?.y ?? top + 6 / k;
    const align = custom?.align ?? 'center';
    const x = align === 'left' ? ax : align === 'right' ? ax - pw : ax - pw / 2;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x, ay, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = '#e5e7f5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + pw / 2, ay + ph / 2);
  };

  return {
    ...game,
    update(dt, input) {
      sync();
      if (locked()) {
        if (!demo && input.pointer.pressed) {
          const { x, y } = input.pointer;
          if (!rects) rects = layout(measureOnly);
          if (inRect(x, y, rects.buy)) buy();
          else if (inRect(x, y, rects.restore)) restore();
        }
        return;
      }
      rects = null;
      game.update(dt, input);
      if (owned || game.isPreviewExempt?.()) return;
      usedMs += dt * 1000;
      unsavedMs += dt * 1000;
      if (unsavedMs >= SAVE_EVERY_MS || usedMs >= limitMs) persist();
    },
    render(ctx, view) {
      sync();
      game.render(ctx, view);
      ctx.save();
      if (locked()) drawOverlay(ctx);
      else if (!owned && !game.isPreviewExempt?.()) drawCountdown(ctx);
      ctx.restore();
    },
    flushPreview: persist,
    get previewMsLeft() {
      return owned ? Infinity : Math.max(0, limitMs - usedMs);
    },
  };
}
