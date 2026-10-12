// K7: the screen-reader layer. The game is drawn on a canvas, which a screen reader cannot read. This keeps a plain DOM list of the same
// controls (headings, text, real <button>s) layered over the canvas: transparent, never drawn, never in the way of a finger (pointer-events: none),
// but present in the accessibility tree so VoiceOver and TalkBack can read, focus and activate every control. Activating one calls the game
// (game.a11yDo), the same action as a tap. The list is rebuilt only when the game reports that the screen changed.
// If the web view does not expose it, the game still works exactly as before: nothing else depends on this file.
export function installMirror({ canvas, game, meta }) {
  if (!game || typeof game.a11y !== 'function') return null;
  const doc = document, root = doc.createElement('div');
  root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Word Game, screen reader controls');
  root.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:3;';
  doc.body.appendChild(root);
  let key = '', scene = '';
  const place = (el, rect) => {
    const c = canvas.getBoundingClientRect(), k = meta.cssPerUnit || (c.width / (meta.width || 720));
    if (rect && rect.w > 0 && rect.h > 0) el.style.cssText += `position:absolute;left:${(c.left + rect.x * k).toFixed(1)}px;top:${(c.top + rect.y * k).toFixed(1)}px;width:${Math.max(24, rect.w * k).toFixed(1)}px;height:${Math.max(24, rect.h * k).toFixed(1)}px;`;
    else el.style.cssText += 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;';
  };
  const base = 'margin:0;padding:0;border:0;background:transparent;color:transparent;font:12px sans-serif;opacity:1;pointer-events:none;';
  const rebuild = () => {
    let k = ''; try { k = game.a11yKey(); } catch { return; }
    if (k === key) return; key = k;
    let items = []; try { items = game.a11y(); } catch { return; }
    const sc = k.split('|')[0], changed = sc !== scene; scene = sc;
    const keep = root.contains(doc.activeElement) ? doc.activeElement.getAttribute('data-id') : null;
    root.textContent = '';
    let first = null, again = null;
    for (const it of items) {
      let el;
      if (it.role === 'heading') { el = doc.createElement(`h${Math.min(6, (it.level ?? 2))}`); el.tabIndex = -1; }
      else if (it.role === 'button' || it.role === 'toggle') {
        el = doc.createElement('button'); el.type = 'button';
        if (it.role === 'toggle') el.setAttribute('aria-pressed', it.on ? 'true' : 'false');
        if (it.disabled) el.setAttribute('aria-disabled', 'true');
        el.addEventListener('click', (e) => { e.preventDefault(); if (!it.disabled) { try { game.a11yDo(it.id); } catch { /* the game keeps running */ } } });
        el.addEventListener('focus', () => { try { game.hitCenter?.(it.id.startsWith('hit:') ? it.id.slice(4) : it.id); } catch { /* not a form control */ } });
      } else { el = doc.createElement('p'); }
      el.textContent = it.label; el.setAttribute('data-id', it.id); el.style.cssText = base; place(el, it.rect); if (keep === it.id) again = el;
      root.appendChild(el); if (!first && it.role === 'heading') first = el;
    }
    if (!changed && again) { try { again.focus({ preventScroll: true }); } catch { /* ignore */ } }
    else if (changed && first && (doc.activeElement === doc.body || root.contains(doc.activeElement) || !doc.activeElement)) { try { first.focus({ preventScroll: true }); } catch { /* ignore */ } }
  };
  rebuild();
  const timer = setInterval(rebuild, 250);
  globalThis.addEventListener('resize', () => { key = ''; });
  return { rebuild, stop: () => { clearInterval(timer); root.remove(); } };
}
