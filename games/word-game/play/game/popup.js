// An in-app dictionary sheet (about 85% of the screen, a Done button) so the player never has to leave the game to see a meaning.
// It shows the meaning from Wiktionary's open definition service (only the word is sent) and keeps a button for opening the
// dictionary the player chose in the browser. Used when the shell has no native in-app browser sheet (`link.sheet`).
// Browser-only; never imported by web/src.
const ENDPOINT = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text !== undefined) e.textContent = text; return e; };
const plain = (html) => { try { return (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch { return ''; } };

let open = null;
export function showDictionarySheet({ word, url, label = 'your dictionary', heightPct = 85, openBrowser }) {
  if (open) open.close();
  const prevFocus = document.activeElement;
  const shade = el('div', 'position:fixed;inset:0;z-index:2147483000;background:rgba(6,10,16,.6);display:flex;align-items:flex-end;justify-content:center');
  const sheet = el('div', `box-sizing:border-box;width:100%;max-width:760px;height:${heightPct}dvh;max-height:${heightPct}%;background:#f6f0e0;color:#1d2330;border-radius:22px 22px 0 0;display:flex;flex-direction:column;box-shadow:0 -10px 40px rgba(0,0,0,.45);font:17px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`);
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', `Dictionary: ${word}`);
  const bar = el('div', 'display:flex;align-items:center;gap:12px;padding:14px 16px 10px;border-bottom:1px solid rgba(0,0,0,.12)');
  const title = el('div', 'flex:1;min-width:0;font:700 22px Georgia,serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', word);
  const done = el('button', 'min-height:44px;min-width:84px;padding:0 18px;border:0;border-radius:12px;background:#1d2330;color:#fff;font:700 17px system-ui,sans-serif;cursor:pointer', 'Done');
  done.type = 'button';
  bar.append(title, done);
  const body = el('div', 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 18px');
  const foot = el('div', `padding:10px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(0,0,0,.12);display:flex;flex-wrap:wrap;gap:10px;align-items:center`);
  const credit = el('div', 'flex:1 1 200px;font-size:13px;color:#5a6270', 'Meanings from Wiktionary (CC BY-SA). Only the word is sent.');
  const browser = el('button', 'min-height:44px;padding:0 16px;border:1px solid rgba(0,0,0,.25);border-radius:12px;background:transparent;color:#1d2330;font:600 15px system-ui,sans-serif;cursor:pointer', `Open ${label} in the browser`);
  browser.type = 'button';
  foot.append(credit, browser); sheet.append(bar, body, foot); shade.append(sheet); document.body.append(shade);
  const status = el('div', 'color:#5a6270', 'Loading the meaning...'); body.append(status);

  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
  const render = (json) => {
    body.textContent = '';
    const entries = (json?.en ?? []).filter((e) => e.definitions?.length);
    if (!entries.length) { body.append(el('p', 'color:#5a6270', 'This word is not in the open dictionary. Try the button below.')); return; }
    for (const e of entries.slice(0, 6)) {
      body.append(el('div', 'margin:14px 0 4px;font:700 13px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a5b12', e.partOfSpeech || ''));
      const ol = el('ol', 'margin:0;padding-left:22px');
      for (const d of e.definitions.slice(0, 4)) {
        const t = plain(d.definition); if (!t) continue;
        const li = el('li', 'margin:6px 0', t); const ex = plain(d.examples?.[0] ?? '');
        if (ex) li.append(el('div', 'font-style:italic;color:#4a5260;font-size:15px;margin-top:2px', ex));
        ol.append(li);
      }
      body.append(ol);
    }
  };
  fetch(ENDPOINT + encodeURIComponent(word.toLowerCase()), { signal: ctl.signal, headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(render)
    .catch(() => { body.textContent = ''; body.append(el('p', 'color:#5a6270', 'The meaning could not be loaded here. Check your connection, or open the dictionary in the browser.')); })
    .finally(() => clearTimeout(timer));

  const close = () => { ctl.abort(); clearTimeout(timer); document.removeEventListener('keydown', onKey, true); shade.remove(); open = null; try { prevFocus?.focus?.(); } catch { /* ignore */ } };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  done.addEventListener('click', close);
  shade.addEventListener('pointerdown', (e) => { if (e.target === shade) close(); });
  browser.addEventListener('click', () => { try { openBrowser?.(url); } catch { /* ignore */ } });
  open = { close }; done.focus();
}
