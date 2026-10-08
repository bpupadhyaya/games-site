// Device services for the game, all with graceful fallbacks (this file is the only place that touches browser APIs for them):
//   store       one storage module: IndexedDB first, mirrored to the kit's storage (native app storage / localStorage)
//   speak       the phone's built-in voice (speechSynthesis), canSpeak() says whether it is there
//   exportFile  share sheet with a file, else the kit's text share, else a download, else the clipboard
//   importText  a file picker (a backup the player chose)
//   openLink    the browser (window.open); askText a simple prompt; haptic a short vibration where supported
import { installPack, installLexicon, setCredits } from './src/lexicon.js';
import * as kb from './src/kb.js';

const DB = 'word-game', STORE = 'kv';

function openDb() {
  return new Promise((resolve) => {
    try {
      const idb = globalThis.indexedDB;
      if (!idb) { resolve(null); return; }
      const req = idb.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}
const idbReq = (db, mode, fn) => new Promise((resolve, reject) => {
  try {
    const tx = db.transaction(STORE, mode), st = tx.objectStore(STORE), r = fn(st);
    tx.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  } catch (e) { reject(e); }
});

export function createPlatform(env) {
  const kit = env.storage;
  let dbp = null;
  const db = () => (dbp ??= openDb());
  const store = {
    async get(key, fallback = null) {
      try {
        const d = await db();
        if (d) { const v = await idbReq(d, 'readonly', (st) => st.get(key)); if (v !== undefined) return v; }
      } catch { /* fall through to the kit storage */ }
      return kit.get(key, fallback);
    },
    async set(key, value) {
      try { const d = await db(); if (d) await idbReq(d, 'readwrite', (st) => st.put(JSON.parse(JSON.stringify(value)), key)); } catch { /* mirrored below */ }
      try { await kit.set(key, value); } catch { /* storage full or blocked: the in-memory copy still works this session */ }
    },
    async remove(key) {
      try { const d = await db(); if (d) await idbReq(d, 'readwrite', (st) => st.delete(key)); } catch { /* ignore */ }
      try { await kit.remove(key); } catch { /* ignore */ }
    },
  };

  const synth = globalThis.speechSynthesis;
  const RATES = [0.6, 0.92, 1.2];
  const platform = {
    loading: false,
    store,
    canSpeak: () => {
      try { return Boolean(synth && typeof globalThis.SpeechSynthesisUtterance === 'function' && (synth.getVoices().length > 0 || /iPhone|iPad|Mac/.test(globalThis.navigator?.userAgent ?? ''))); } catch { return false; }
    },
    speak(text, rateIdx = 1) {
      try {
        if (!synth) return false;
        synth.cancel();
        const u = new globalThis.SpeechSynthesisUtterance(text);
        u.lang = 'en-US'; u.rate = RATES[rateIdx] ?? 0.92;
        synth.speak(u); return true;
      } catch { return false; }
    },
    haptic(kind) { try { globalThis.navigator?.vibrate?.(kind === 'good' ? 12 : 28); } catch { /* not supported */ } },
    openLink(url) {
      try { const w = globalThis.open(url, '_blank', 'noopener'); if (!w) env.share?.(url); } catch { /* blocked */ }
    },
    askText(message, initial) { try { return Promise.resolve(globalThis.prompt(message, initial ?? '')); } catch { return Promise.resolve(null); } },
    async exportFile(name, mime, text) {
      try {
        const nav = globalThis.navigator;
        const file = typeof globalThis.File === 'function' ? new globalThis.File([text], name, { type: mime }) : null;
        if (file && nav?.canShare?.({ files: [file] })) { await nav.share({ files: [file], title: name }); return { ok: true, how: 'share-file' }; }
      } catch (e) { if (e && e.name === 'AbortError') return { ok: false, how: 'cancelled' }; }
      try { const r = await env.share?.(text); if (r && r.shared && !r.copied) return { ok: true, how: 'share-text' }; } catch { /* next */ }
      try {
        const blob = new globalThis.Blob([text], { type: mime }), a = globalThis.document.createElement('a');
        a.href = globalThis.URL.createObjectURL(blob); a.download = name; globalThis.document.body.appendChild(a); a.click(); a.remove();
        return { ok: true, how: 'download' };
      } catch { /* next */ }
      try { await globalThis.navigator.clipboard.writeText(text); return { ok: true, how: 'clipboard' }; } catch { return { ok: false, how: 'none' }; }
    },
    importText() {
      return new Promise((resolve) => {
        try {
          const input = globalThis.document.createElement('input');
          input.type = 'file'; input.accept = '.json,application/json,text/plain'; input.style.display = 'none';
          input.addEventListener('change', async () => { const f = input.files?.[0]; input.remove(); resolve(f ? await f.text() : null); });
          input.addEventListener('cancel', () => { input.remove(); resolve(null); });
          globalThis.document.body.appendChild(input); input.click();
        } catch { resolve(null); }
      });
    },
  };
  return platform;
}

// Fetch the word data after the first frame; the game plays with its built-in notebook list until this finishes.
const fetchText = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.text(); }).catch(() => new Promise((resolve, reject) => {
  const x = new globalThis.XMLHttpRequest(); x.open('GET', url); x.onload = () => (x.status === 0 || x.status === 200 ? resolve(x.responseText) : reject(new Error(url))); x.onerror = () => reject(new Error(url)); x.send();
}));
const fetchBuf = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); });
// The relations knowledge base (web/data/kb): manifest and the two hot shards first, the rest in the background. Not used by the demo.
export async function loadKb() {
  try {
    const man = JSON.parse(await fetchText('./data/kb/manifest.json')); kb.installManifest(man);
    for (const n of man.hot) kb.installRel(n, await fetchBuf(`./data/kb/${n}.bin`));
    kb.installBytes('rows', await fetchBuf('./data/kb/rows.bin')); kb.installBytes('cols', await fetchBuf('./data/kb/cols.bin')); kb.installBytes('spell', await fetchBuf('./data/kb/spell.bin'));
    for (const n of man.lazy) kb.installRel(n, await fetchBuf(`./data/kb/${n}.bin`));
    for (const n of ['phrases', 'plain', 'variants']) kb.installText(n, await fetchText(`./data/kb/${n}.txt`));
  } catch { /* the game keeps using the study pack's own synonyms and antonyms */ }
}
export async function loadWordData(platform, demo = false) {
  platform.loading = true;
  try {
    const [lexText, packText] = await Promise.all([fetchText(demo ? './data/lex-demo.fc' : './data/lex.fc'), fetchText(demo ? './data/pack-demo.txt' : './data/pack.txt')]);
    installLexicon(lexText); installPack(packText);
  } catch { /* offline file missing: keep the built-in list */ }
  try { setCredits(await fetchText('./data/credits.txt')); } catch { /* credits stay empty */ }
  platform.loading = false;
  if (!demo) await loadKb();
}
