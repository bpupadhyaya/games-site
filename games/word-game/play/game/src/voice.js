// T4: voice-first operation. The phone listens for ONE short phrase at a time (the shells give one utterance per start), so the game asks a
// question aloud, listens, understands a small fixed set of commands and acts. Nothing here reaches the network: it only reads the text the
// phone's own recogniser returned. Pure: no DOM, no clock.
const NUM = { one: 1, won: 1, first: 1, two: 2, to: 2, too: 2, second: 2, three: 3, third: 3, tree: 3, four: 4, for: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6 };
const clean = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Spoken answer to a question with `options` (an array of option texts): "two", "number two", "the second one", or the word itself.
export function parseAnswer(text, options) {
  const t = clean(text); if (!t) return null;
  const words = t.split(' ');
  // the option's own words win over a number (a word like "one" can be an answer)
  const opts = options.map((o) => clean(o));
  const exact = opts.findIndex((o) => o === t);
  if (exact >= 0) return { cmd: 'answer', index: exact };
  const inside = opts.map((o, i) => [o, i]).filter(([o]) => o.length >= 3 && (` ${t} `).includes(` ${o} `));
  if (inside.length === 1) return { cmd: 'answer', index: inside[0][1] };
  for (const w of words) { const n = /^\d$/.test(w) ? Number(w) : NUM[w]; if (n && n >= 1 && n <= options.length) return { cmd: 'answer', index: n - 1 }; }
  return null;
}

const NAV = [
  ['play', /\b(play|start|begin)\b/], ['study', /\bstudy\b/], ['review', /\b(review|revise)\b/], ['progress', /\bprogress\b/],
  ['more', /\bmore\b/], ['settings', /\bsettings\b/], ['journey', /\bjourney\b/], ['help', /\b(help|commands)\b/],
];
// A command: hint, repeat, pause, resume, stop, back, or a screen to open. During a question pass `options` so answers are understood too.
export function parseCommand(text, options = []) {
  const t = clean(text); if (!t) return { cmd: 'none' };
  if (options.length) { const a = parseAnswer(t, options); if (a) return a; }
  if (/\b(hint|help me|clue)\b/.test(t)) return { cmd: 'hint' };
  if (/\b(repeat|again|say that|read it)\b/.test(t)) return { cmd: 'repeat' };
  if (/\b(pause|wait|hold on|stop the clock)\b/.test(t)) return { cmd: 'pause' };
  if (/\b(resume|continue|carry on|go on)\b/.test(t)) return { cmd: 'resume' };
  if (/\b(stop|quit|end|finish|enough)\b/.test(t)) return { cmd: 'stop' };
  if (/\b(back|go back|previous|leave)\b/.test(t)) return { cmd: 'back' };
  for (const [cmd, re] of NAV) if (re.test(t)) return { cmd: 'go', to: cmd };
  return { cmd: 'none' };
}
// What to say aloud for a question: the heading, the word, then the numbered choices.
export function questionSpeech(round) {
  const head = `${String(round.label ?? '').toLowerCase()} ${round.targetWord ?? ''}`.trim();
  const opts = round.words.filter((w) => w.slot !== round.hinted).slice().sort((a, b) => a.slot - b.slot);
  return `${head}. ${opts.map((w, i) => `${i + 1}: ${w.text}`).join('. ')}.`;
}
export const HELP_SPEECH = 'You can say a number to answer, or the answer itself. You can also say hint, repeat, pause or stop.';
