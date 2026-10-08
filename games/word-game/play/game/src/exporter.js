// Export and import of everything the player has on this device. Text only (JSON for a full backup, CSV for spreadsheets).
// The player triggers this; nothing is ever sent anywhere by the app itself.
import { FIELDS, stageOf } from './srs.js';

export const FORMAT = 'word-game-backup';
export const FORMAT_VERSION = 1;

export function buildBackup({ cfg, prefs, records, sessions, study, day, journey, ach, est, lists }) {
  return JSON.stringify({ format: FORMAT, version: FORMAT_VERSION, exportedDay: day, cfg, prefs, records, sessions, study, journey, ach, est, lists }, null, 0);
}
const q = (s) => { const t = String(s ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function wordsCsv(records) {
  const head = 'word,stage,box,right,wrong,avg_answer_ms,last_day,due_day,times_seen,dictionary_checks,marked_known';
  const rows = Object.keys(records).sort().map((w) => {
    const r = records[w];
    return [w, stageOf(r), r[FIELDS.box], r[FIELDS.right], r[FIELDS.wrong], r[FIELDS.ms], r[FIELDS.last], r[FIELDS.due], r[FIELDS.seen], r[FIELDS.chk], r[FIELDS.known]].map(q).join(',');
  });
  return [head, ...rows].join('\n') + '\n';
}
export function sessionsCsv(sessions) {
  const head = 'day,kind,preset,questions,right,score,best_streak,seconds,avg_answer_ms,types';
  const rows = sessions.map((s) => [s.day, s.kind ?? 'play', s.preset, s.n, s.right, s.score, s.streak, s.secs, s.ms, (s.types ?? []).join('+')].map(q).join(','));
  return [head, ...rows].join('\n') + '\n';
}
// Returns { ok, data } or { ok:false, error }. Accepts only a backup this app wrote.
export function parseBackup(text) {
  let d;
  try { d = JSON.parse(String(text).trim()); } catch { return { ok: false, error: 'That text is not a Word Game backup (it could not be read).' }; }
  if (!d || d.format !== FORMAT) return { ok: false, error: 'That is not a Word Game backup file.' };
  if (d.version > FORMAT_VERSION) return { ok: false, error: 'This backup was made by a newer version of the app.' };
  const records = {};
  if (d.records && typeof d.records === 'object') {
    for (const w of Object.keys(d.records)) {
      const r = d.records[w];
      if (/^[a-z]{1,20}$/.test(w) && Array.isArray(r) && r.length >= 8) records[w] = r.slice(0, 9).concat([0, 0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 9).map((x) => (Number.isFinite(x) ? x : 0));
    }
  }
  const sessions = Array.isArray(d.sessions) ? d.sessions.filter((s) => s && typeof s === 'object').slice(-500) : [];
  const lists = Array.isArray(d.lists) ? d.lists.filter((l) => l && typeof l.name === 'string' && Array.isArray(l.words)).slice(0, 20).map((l) => ({ id: String(l.id ?? l.name).slice(0, 20), name: l.name.slice(0, 40), words: l.words.filter((w) => /^[a-z]{2,20}$/.test(w)).slice(0, 500), defs: l.defs && typeof l.defs === 'object' ? l.defs : {} })) : [];
  return { ok: true, data: { cfg: d.cfg ?? null, prefs: d.prefs ?? null, records, sessions, study: d.study ?? null, journey: d.journey ?? null, ach: d.ach ?? null, est: d.est ?? null, lists } };
}
