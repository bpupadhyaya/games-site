// Device services for the game, all with graceful fallbacks (this file is the only place that touches browser APIs for them):
//   store       one storage module: IndexedDB first, mirrored to the kit's storage (native app storage / localStorage)
//   speak       the phone's built-in voice (speechSynthesis), canSpeak() says whether it is there
//   exportFile  share sheet with a file, else the kit's text share, else a download, else the clipboard
//   importText  a file picker (a backup the player chose)
//   openLink    the browser (window.open); askText a simple prompt; haptic a short vibration where supported
import { showDictionarySheet } from './popup.js';
import { installPack, installPacks, installLexicon, setCredits, applyWordText, all as allEntries } from './src/lexicon.js';
import * as deck from './src/deck.js';
import * as kb from './src/kb.js';
import * as era from './src/era.js';
import { installExtras, addPassages, addCommonSets } from './src/quiz.js';

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

  // ---- native bridge (docs/BRIDGE.md transport) used only when the shell offers the method; every call has a web fallback.
  // Replies come back through window.__arcforgeReceive, which the kit installed first; this wrapper only claims its own ids.
  const nativeKind = globalThis.webkit?.messageHandlers?.arcforge ? 'ios' : globalThis.ArcforgeAndroid ? 'android' : null;
  const pend = new Map(); let seq = 1000000;
  if (nativeKind) {
    const prev = globalThis.__arcforgeReceive;
    globalThis.__arcforgeReceive = (payload) => {
      let msg = null; try { msg = typeof payload === 'string' ? JSON.parse(payload) : payload; } catch { /* not ours */ }
      if (msg && msg.id >= 1000000 && pend.has(msg.id)) { const e = pend.get(msg.id); pend.delete(msg.id); clearTimeout(e.t); if (msg.ok) e.res(msg.result ?? {}); else e.rej(new Error(msg.error || 'bridge error')); return; }
      prev?.(payload);
    };
  }
  const nativeCall = (method, params = {}, timeout = 15000) => new Promise((res, rej) => {
    if (!nativeKind) { rej(new Error('no native bridge')); return; }
    const id = ++seq, t = setTimeout(() => { pend.delete(id); rej(new Error('timeout')); }, timeout);
    pend.set(id, { res, rej, t });
    try { const m = { id, method, params }; if (globalThis.webkit?.messageHandlers?.arcforge) globalThis.webkit.messageHandlers.arcforge.postMessage(m); else globalThis.ArcforgeAndroid.postMessage(JSON.stringify(m)); } catch (e) { pend.delete(id); clearTimeout(t); rej(e); }
  });
  const supported = new Map();                        // method -> true/false after the first try (a shell without the method answers with an error once)
  const tryNative = async (method, params, timeout) => {
    if (!nativeKind || supported.get(method) === false) return null;
    try { const r = await nativeCall(method, params, timeout); supported.set(method, true); return r; } catch (e) { if (!supported.has(method)) supported.set(method, false); return null; }
  };

  // ---- speech: the phone's built-in voices (browser speechSynthesis), else the shell's speech.say; accents by language tag
  const synth = globalThis.speechSynthesis;
  const RATES = [0.6, 0.92, 1.2];
  const ACCENTS = { us: 'en-US', uk: 'en-GB', au: 'en-AU', in: 'en-IN' };
  let nativeSay = null, nativeRec = null;
  if (nativeKind) { tryNative('speech.available', {}, 3000).then((r) => { nativeSay = r ? Boolean(r.say) : false; nativeRec = r ? Boolean(r.recognize) : false; }); }
  const voiceFor = (lang) => { try { const vs = synth.getVoices(); return vs.find((v) => v.lang === lang) ?? vs.find((v) => v.lang.replace('_', '-').startsWith(lang.slice(0, 2)) && v.lang.replace('_', '-').slice(3) === lang.slice(3)) ?? null; } catch { return null; } };
  const liveRegion = (() => { try { const d = globalThis.document, el = d.createElement('div'); el.setAttribute('aria-live', 'polite'); el.setAttribute('role', 'status'); el.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden'; d.body.appendChild(el); return el; } catch { return null; } })();
  const platform = {
    loading: false,
    store,
    native: nativeKind,
    canSpeak: () => {
      try { if (nativeSay) return true; return Boolean(synth && typeof globalThis.SpeechSynthesisUtterance === 'function' && (synth.getVoices().length > 0 || /iPhone|iPad|Mac/.test(globalThis.navigator?.userAgent ?? ''))); } catch { return false; }
    },
    // which accents the phone has a voice for (the first, American, is always offered)
    accents: () => { try { return Object.entries(ACCENTS).filter(([k, l]) => k === 'us' || Boolean(voiceFor(l))).map(([k]) => k); } catch { return ['us']; } },
    speak(text, rateIdx = 1, accent = 'us', onWord = null, onEnd = null) {
      const lang = ACCENTS[accent] ?? 'en-US';
      try {
        if (synth && typeof globalThis.SpeechSynthesisUtterance === 'function') {
          synth.cancel();
          const u = new globalThis.SpeechSynthesisUtterance(text);
          u.lang = lang; u.rate = RATES[rateIdx] ?? 0.92; const v = voiceFor(lang); if (v) u.voice = v;
          if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
          if (onWord) u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) onWord(e.charIndex); };
          synth.speak(u); return true;
        }
      } catch { /* try the shell */ }
      if (nativeSay) { tryNative('speech.say', { text, rate: RATES[rateIdx] ?? 0.92, lang }); return true; }
      return false;
    },
    stopSpeaking() { try { synth?.cancel(); } catch { /* ignore */ } },
    // on-device speech recognition for "Say it": browser SpeechRecognition, else the shell's speech.recognize; null = not available here
    canRecognize: () => Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition) || Boolean(nativeRec),
    async recognize(accent = 'us') {
      const lang = ACCENTS[accent] ?? 'en-US', SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
      if (nativeRec) { const r = await tryNative('speech.recognize', { lang, maxSeconds: 6 }, 12000); if (r && typeof r.transcript === 'string') return { transcript: r.transcript, confidence: r.confidence ?? 0 }; }
      if (SR) {
        return new Promise((resolve) => {
          try { const rec = new SR(); rec.lang = lang; rec.maxAlternatives = 3; rec.interimResults = false; rec.onresult = (e) => { const a = e.results[0][0]; resolve({ transcript: a.transcript, confidence: a.confidence }); }; rec.onerror = () => resolve(null); rec.onend = () => resolve(null); rec.start(); } catch { resolve(null); }
        });
      }
      return null;
    },
    // short feedback: the shell's window.__haptic(kind) or haptic bridge method, else the browser vibration
    haptic(kind) {
      try { if (typeof globalThis.__haptic === 'function') { globalThis.__haptic(kind); return; } } catch { /* fall through */ }
      if (nativeKind && supported.get('haptic') !== false) { tryNative('haptic', { kind }, 2000); return; }
      try { globalThis.navigator?.vibrate?.(kind === 'good' ? 12 : 28); } catch { /* not supported */ }
    },
    // paste: the clipboard text where the browser/shell allows reading it, else null
    async readClipboard() { try { return await globalThis.navigator.clipboard.readText(); } catch { return (await tryNative('clipboard.read', {}, 4000))?.text ?? null; } },
    // screen-reader announcements (a polite live region)
    announce(text) { try { if (liveRegion) liveRegion.textContent = text; } catch { /* ignore */ } },
    // opts.sheet: show the page in an in-app sheet (heightPct of the screen, a Done button) so the player never leaves the app. Shells that
    // implement the `link.sheet` bridge call do this; the others fall back to `link.open` (the system browser), then window.open.
    async openLink(url, opts = {}) {
      if (opts.sheet) { const r = await tryNative('link.sheet', { url, heightPct: opts.heightPct ?? 85, title: opts.title ?? '' }, 4000); if (r && r.ok !== false) return; }
      const toBrowser = async (u) => {
        if (await tryNative('link.open', { url: u }, 4000)) return;
        try { const w = globalThis.open(u, '_blank', 'noopener'); if (!w) env.share?.(u); } catch { /* blocked */ }
      };
      // No native in-app browser: show the meaning in an in-app sheet with a Done button (the player stays in the game).
      if (opts.sheet && opts.word) { showDictionarySheet({ word: opts.word, url, label: opts.label, heightPct: opts.heightPct ?? 85, openBrowser: toBrowser }); return; }
      await toBrowser(url);
    },
    askText(message, initial) { try { return Promise.resolve(globalThis.prompt(message, initial ?? '')); } catch { return Promise.resolve(null); } },
    async exportFile(name, mime, text) {
      const n = await tryNative('file.export', { name, mime, text }, 60000); if (n && n.ok !== false) return { ok: true, how: 'native-file' };
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
    async importText() {
      const n = await tryNative('file.import', { types: ['text/plain', 'text/csv', 'application/json'] }, 120000); if (n && typeof n.text === 'string') return n.text;
      return new Promise((resolve) => {
        try {
          const input = globalThis.document.createElement('input');
          input.type = 'file'; input.accept = '.json,.csv,.txt,application/json,text/plain,text/csv'; input.style.display = 'none';
          input.addEventListener('change', async () => { const f = input.files?.[0]; input.remove(); resolve(f ? await f.text() : null); });
          input.addEventListener('cancel', () => { input.remove(); resolve(null); });
          globalThis.document.body.appendChild(input); input.click();
        } catch { resolve(null); }
      });
    },
    // local daily reminder: only the shell can schedule one; resolves true when it did
    async scheduleReminder(on, hour) { const r = await tryNative('notify.schedule', { on, hour, title: 'Word Game', body: 'A few minutes of words today?' }, 8000); return Boolean(r && r.ok !== false); },
    canRemind: () => Boolean(nativeKind) && supported.get('notify.schedule') !== false,
  };
  return platform;
}

// Fetch the word data after the first frame; the game plays with its built-in notebook list until this finishes.
const fetchText = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.text(); }).catch(() => new Promise((resolve, reject) => {
  const x = new globalThis.XMLHttpRequest(); x.open('GET', url); x.onload = () => (x.status === 0 || x.status === 200 ? resolve(x.responseText) : reject(new Error(url))); x.onerror = () => reject(new Error(url)); x.send();
}));
const fetchBuf = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); }).catch(() => new Promise((resolve, reject) => {
  const x = new globalThis.XMLHttpRequest(); x.open('GET', url); x.responseType = 'arraybuffer'; x.onload = () => (x.status === 0 || x.status === 200 ? resolve(x.response) : reject(new Error(url))); x.onerror = () => reject(new Error(url)); x.send();
}));
// The relations knowledge base (web/data/kb): manifest and the two hot shards first, then the thesaurus shards (thes, thesmore) in parallel with the rest.
// Registered with kb.setLoader (armKb) before the first frame: the dictionary sheet awaits kb.ensure() and shows Loading / an error with Retry;
// a failure of a required shard rejects here. Not used by the demo.
export async function loadKbData() {
  const man = JSON.parse(await fetchText('./data/kb/manifest.json')); kb.installManifest(man);
  for (const n of man.hot) kb.installRel(n, await fetchBuf(`./data/kb/${n}.bin`));
  const thesP = fetchText('./data/kb/thes.txt').then((t) => { if (!t || !t.startsWith('#THES1')) throw new Error('thes'); return t; });
  const moreP = fetchText('./data/kb/thesmore.txt').catch(() => null);   // optional: "More ways to say it" stays hidden
  thesP.catch(() => {});
  kb.installBytes('rows', await fetchBuf('./data/kb/rows.bin')); kb.installBytes('cols', await fetchBuf('./data/kb/cols.bin')); kb.installBytes('spell', await fetchBuf('./data/kb/spell.bin'));
  kb.installText('thes', await thesP);
  const more = await moreP; if (more) kb.installText('thesmore', more);
  for (const n of man.lazy) kb.installRel(n, await fetchBuf(`./data/kb/${n}.bin`));
  try { installExtras(JSON.parse(await fetchText('./data/kb/extras.json'))); } catch { /* optional */ }
  try { kb.installText('analogies', await fetchText('./data/kb/analogies.txt')); } catch { /* optional: analogy puzzles stay hidden */ }
  for (const n of ['phrases', 'plain', 'variants']) kb.installText(n, await fetchText(`./data/kb/${n}.txt`));
  try { deck.install(JSON.parse(await fetchText('./data/kb/content.json'))); addPassages(deck.get('passages').map((x) => ({ id: `x${x.id}`, level: x.level, title: x.title, text: x.text, qs: x.qs, k: x.k }))); } catch { /* the decks are optional */ }
  try { installPacks(JSON.parse(await fetchText('./data/kb/packs.json'))); } catch { /* optional */ }
  try { era.install(JSON.parse(await fetchText('./data/kb/era.json'))); } catch { /* optional */ }
  try { applyWordText(await fetchText('./data/kb/wordtext.txt')); } catch { /* examples stay as they were */ }
  try { addCommonSets(allEntries()); } catch { /* optional */ }
}
export const armKb = (demo = false) => kb.setLoader(demo ? null : loadKbData);
export async function loadWordData(platform, demo = false) {
  platform.loading = true;
  try {
    const [lexText, packText] = await Promise.all([fetchText(demo ? './data/lex-demo.fc' : './data/lex.fc'), fetchText(demo ? './data/pack-demo.txt' : './data/pack.txt')]);
    installLexicon(lexText); installPack(packText);
  } catch { /* offline file missing: keep the built-in list */ }
  try { setCredits(await fetchText('./data/credits.txt')); } catch { /* credits stay empty */ }
  platform.loading = false;
  if (!demo) { armKb(false); await kb.ensure(); }
}
