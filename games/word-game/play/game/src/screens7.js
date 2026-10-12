// Rows for the screens added in hub audit waves 7 and 8: reports and printables, parent view and PIN, caregiver setup, turn-taking,
// memories (era words, reminiscence, life-story journal), the adaptive vocabulary-size test, word knowledge and balance, voice commands.
// Pure, like screens.js: takes the snapshot S (S.x = the extension state from game7.js) and returns { title, rows, primary }.
import { FACETS, CTX_NEEDED } from './facets.js';
import { BAND_LABELS } from './lexicon.js';
import { longDate } from './pdf.js';

const chip = (v, label, on, extra = {}) => ({ v, label, on, ...extra });
const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;
const pc = (f) => `${Math.round(f * 100)}%`;
export const RELATIONS = [
  { k: 'gc', label: 'Grandparent and grandchild', names: ['Grandparent', 'Grandchild'], ages: ['later', 'child'] },
  { k: 'pc', label: 'Parent and child', names: ['Parent', 'Child'], ages: ['adult', 'child'] },
  { k: 'aa', label: 'Two adults or friends', names: ['Player 1', 'Player 2'], ages: ['adult', 'adult'] },
];
export const STRANDS = [
  { k: 'in', name: 'Reading and listening', blurb: 'meaning-focused input: stories, passages, read-aloud', target: 0.25 },
  { k: 'out', name: 'Writing and speaking', blurb: 'meaning-focused output: Write it, spell it, say it, your journal', target: 0.2 },
  { k: 'study', name: 'Studying words', blurb: 'language-focused study: questions, decks and flashcards', target: 0.4 },
  { k: 'flu', name: 'Speed practice', blurb: 'fluency: the speed round on words you know', target: 0.15 },
];
const keypad = (id) => ({ k: 'grid', id, rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9], ['Clear', 0, 'OK']].map((r) => r.map((c) => ({ v: typeof c === 'number' ? `d${c}` : c === 'Clear' ? 'clr' : 'ok', label: String(c) }))), h: 84, sz: 36 });
const LETTERS = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'del'], ['sym', 'comma', 'space', 'dot', 'ques']];
const SYMS = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['dash', 'slash', 'colon', 'semi', 'lp', 'rp', 'amp', 'at', 'quote'], ['abc', 'dot', 'comma', 'ques', 'bang', 'apos', 'del'], ['space']];
const KLABEL = { shift: 'Shift', del: 'Delete', sym: '123', abc: 'abc', comma: ',', dot: '.', ques: '?', bang: '!', apos: "'", dash: '-', slash: '/', colon: ':', semi: ';', lp: '(', rp: ')', amp: '&', at: '@', quote: '"', space: 'Space' };
const keyboard = (C) => ({ k: 'grid', id: 'cx', h: 80, sz: 28, rows: (C.sym ? SYMS : LETTERS).map((r) => r.map((k) => ({ v: k, label: KLABEL[k] ?? (C.shift ? k.toUpperCase() : k), on: k === 'shift' && C.shift }))) });
const dots = (s, n = 4) => Array.from({ length: n }, (_, i) => (i < s.length ? '*' : '_')).join(' ');

export function screenRows7(name, S) {
  const X = S.x;
  switch (name) {
    case 'compose': {
      const C = X.compose ?? { text: '', title: 'Write', prompt: '' };
      return { title: 'Write', rows: [
        { k: 'h', t: C.title }, { k: 'p', t: C.prompt, small: true },
        { k: 'p', t: `${C.text}|` }, { k: 'p', t: `${C.text.length} of 400 letters`, small: true },
        keyboard(C),
        { k: 'btn2', a: { id: 'cx:cancel', label: 'Cancel' }, b: { id: 'cx:save', label: 'Save', style: 'primary', disabled: !C.text.trim() } },
        { k: 'btn', id: 'cx:clear', label: 'Clear everything', disabled: !C.text },
      ], primary: null };
    }
    case 'reports': {
      const src = X.repSrc, hasWords = X.repWords > 0;
      return { title: 'Reports and printables', rows: [
        { k: 'h', t: 'Reports and printables' },
        { k: 'p', t: 'Make a file you can print, keep or share. Everything is made on this device from your own practice, and nothing leaves it unless you share the file.', small: true },
        ...(S.msg ? [{ k: 'p', t: S.msg }] : []),
        { k: 'sub', t: 'Reports' },
        { k: 'btn', id: 'rp:report', label: 'Progress report (PDF)', sub: 'words, accuracy, ways of knowing, balance' },
        { k: 'btn', id: 'rp:cert', label: 'Certificate (PDF)', sub: 'worded from what you have really done' },
        { k: 'sub', t: 'Printable sheets' },
        { k: 'btn', id: 'rp:sheet', label: 'My word week (PDF)', sub: 'a weekly tracker to colour in' },
        { k: 'btn', id: 'rp:work', label: 'Word worksheet (PDF)', sub: hasWords ? 'match, cover-write-check and sentences' : 'make a study set first', disabled: !hasWords },
        { k: 'sub', t: 'For teachers and families' },
        ...(X.lists.length ? [{ k: 'chips', id: 'rpsrc', label: 'Words for the lesson plan and worksheet', opts: [chip('study', `My study set (${X.studyN})`, src === 'study'), ...X.lists.map((l) => chip(l.id, l.name, src === l.id))] }] : []),
        { k: 'btn', id: 'rp:lesson', label: 'Lesson plan (PDF)', sub: 'the word list and seven activities', disabled: !hasWords },
        { k: 'btn', id: 'rp:lessontxt', label: 'Lesson plan (text)', sub: 'a plain file you can edit', disabled: !hasWords },
        { k: 'btn', id: 'rp:log', label: 'Homeschool learning log (PDF)', sub: 'the last 30 days of practice, with blank lines' },
        { k: 'btn2', a: { id: 'rp:logcsv', label: 'Learning log (CSV)' }, b: { id: 'rp:facets', label: 'Ways of knowing (CSV)' } },
        { k: 'btn', id: 'rp:journal', label: 'Life-story book (PDF)', sub: `${plural(X.journal.length, 'journal entry')}`, disabled: !X.journal.length },
        { k: 'p', t: 'PDF files are plain pages with the standard fonts. Accents are written without their marks.', small: true },
      ], primary: null };
    }
    case 'parent': {
      const rows = [{ k: 'h', t: 'Parent view' }, { k: 'p', t: 'How each player on this phone is doing, with shortcuts for a grown-up. It is kept behind a PIN when you set one.', small: true }];
      for (const p of S.profiles) {
        const s = X.parent[p.id], me = p.id === S.profile;
        rows.push({ k: 'sub', t: `${p.name}${me ? '  (playing now)' : ''}` });
        if (!s) rows.push({ k: 'p', t: 'Loading...', small: true });
        else {
          rows.push({ k: 'kv', l: 'Words met', r: String(s.met) }, { k: 'kv', l: 'Answers right', r: s.n ? `${pc(s.acc)} of ${s.n}` : 'none yet' }, { k: 'kv', l: 'Streak', r: plural(s.streak, 'day') },
            { k: 'kv', l: 'Played today', r: `${Math.round(s.todaySecs / 60)} minutes` }, { k: 'kv', l: 'Daily limit', r: s.limit ? `${s.limit} minutes` : 'none' }, { k: 'kv', l: 'Last played', r: s.last ? longDate(s.last) : 'not yet' });
        }
        rows.push({ k: 'btn2', a: { id: `pv:switch:${p.id}`, label: me ? 'Playing now' : 'Switch to this player', disabled: me }, b: { id: `pv:report:${p.id}`, label: 'Report (PDF)' } });
      }
      rows.push({ k: 'rule' }, { k: 'h', t: 'Parent PIN' },
        { k: 'p', t: X.pinSet ? 'A PIN is set. A child profile asks for it before Settings, Your data, Players and Play together. It is stored on this phone only, scrambled.' : 'No PIN is set, so a child profile asks a sum instead. A four-digit PIN is a stronger lock.', small: true },
        { k: 'btn', id: 'pn:set', label: X.pinSet ? 'Change the PIN' : 'Set a PIN' }, ...(X.pinSet ? [{ k: 'btn', id: 'pn:clear', label: X.confirmPin ? 'Tap again to remove the PIN' : 'Remove the PIN', style: X.confirmPin ? 'primary' : undefined }] : []),
        { k: 'p', t: 'A PIN keeps young children out of settings. It is not a security system: anyone with the phone can still use the phone itself.', small: true },
        { k: 'rule' }, { k: 'btn', id: 'go:reports', label: 'Reports and printables' }, { k: 'btn', id: 'go:caregiver', label: 'Set up for someone else' });
      return { title: 'Parent view', rows, primary: null };
    }
    case 'pinset': {
      const P = X.pinset;
      return { title: 'Parent PIN', rows: [
        { k: 'h', t: P.step === 1 ? 'Choose a four-digit PIN' : 'Type it again' },
        { k: 'p', t: P.msg || (P.step === 1 ? 'Pick four digits you will remember. Write them somewhere safe.' : 'This makes sure you typed it as you meant to.') },
        { k: 'h', t: dots(P.step === 1 ? P.a : P.b) }, keypad('pn'),
        { k: 'btn', id: 'pn:cancel', label: 'Cancel' },
      ], primary: null };
    }
    case 'pingate': {
      const g = X.gate;
      const locked = g.lock > 0;
      return { title: 'Grown-ups only', rows: [
        { k: 'h', t: 'Enter the parent PIN' },
        { k: 'p', t: locked ? `Too many tries. Wait ${g.lock} seconds.` : g.wrong ? 'Not quite. Try again.' : 'Settings, data and players are for grown-ups.' },
        { k: 'h', t: dots(g.entry) }, keypad('pn'),
        { k: 'btn', id: 'pn:forgot', label: 'I forgot the PIN', sub: 'answer three sums to clear it' },
      ], primary: null };
    }
    case 'caregiver': {
      const P = S.prefs;
      return { title: 'Set up for someone else', rows: [
        { k: 'h', t: 'Set up for someone else' },
        { k: 'p', t: `A short guide for a family member or carer who is getting the game ready for someone. You are setting up: ${X.me}. Each step is optional and everything can be changed later.`, small: true },
        ...(S.msg ? [{ k: 'p', t: S.msg }] : []),
        { k: 'sub', t: '1. Who is it for?' },
        { k: 'btn2', a: { id: 'go:profiles', label: 'Switch or add a player' }, b: { id: 'cg:later', label: 'Make this a calm, later-life player' } },
        { k: 'sub', t: '2. Make it comfortable' },
        { k: 'btn', id: 'cg:comfort', label: 'Apply the comfort pack', sub: 'larger text, calm look, slow clear voice, no clock', style: X.comfort ? 'primary' : undefined },
        { k: 'chips', id: 'acc', label: 'Or choose', opts: [chip('font', 'Dyslexia-friendly text', P.font === 'dys'), chip('cb', 'Colour-blind safe colours', P.cb), chip('captions', 'Captions for sounds', P.captions)] },
        { k: 'sub', t: '3. Check the voice' },
        { k: 'btn', id: 'cg:hear', label: 'Hear a sample word', disabled: !S.canSpeak },
        { k: 'chips', id: 'voice', label: 'Voice speed', opts: [chip(0, 'Slow', P.voice === 0), chip(1, 'Normal', P.voice === 1), chip(2, 'Fast', P.voice === 2)] },
        { k: 'sub', t: '4. A daily reminder' },
        { k: 'chips', id: 'rem', label: 'Reminder', opts: [chip('on', P.remind.on ? 'Reminder on' : 'Reminder off', P.remind.on), ...[8, 12, 18, 20].map((h) => chip(`h${h}`, `${h}:00`, P.remind.hour === h))], hint: 'Set on this phone. The phone asks for permission the first time.' },
        { k: 'sub', t: '5. Time and breaks' },
        { k: 'chips', id: 'brk', label: 'Break reminder after', opts: [0, 15, 30, 45, 60].map((m) => chip(m, m ? `${m} min` : 'Off', P.breakMin === m)) },
        { k: 'sub', t: '6. Keep a copy or share progress' },
        { k: 'btn2', a: { id: 'exp:json', label: 'Save a backup' }, b: { id: 'rp:report', label: 'Progress report (PDF)' } },
        { k: 'p', t: 'Nothing is sent anywhere by the app. A backup or report is a file you choose to share.', small: true },
      ], primary: null };
    }
    case 'turns': {
      const T = X.turns;
      const head = [{ k: 'h', t: 'Take turns' }];
      if (!T) return { title: 'Take turns', rows: [...head,
        { k: 'p', t: 'Two players of any age share one phone and take turns. Each one gets words that suit them: a child gets child-safe words, a grown-up gets the usual level. No clock, nothing is saved, and the phone can read every word aloud.', small: true },
        { k: 'chips', id: 'tnrel', label: 'Who is playing?', opts: RELATIONS.map((r) => chip(r.k, r.label, X.rel === r.k)) },
        { k: 'btn', id: 'tn:start', label: 'Start', style: 'primary' },
      ], primary: null };
      if (T.done) return { title: 'Take turns', rows: [...head, { k: 'h', t: 'Well played' }, { k: 'kv', l: T.names[0], r: `${T.scores[0]} right` }, { k: 'kv', l: T.names[1], r: `${T.scores[1]} right` },
        { k: 'p', t: 'Both players learned something. Say your favourite new word to each other.' }, { k: 'btn', id: 'tn:start', label: 'Play again', style: 'primary' }, { k: 'btn', id: 'tn:end', label: 'Finish' }], primary: null };
      const q = T.q, rows = [...head, { k: 'kv', l: `Turn: ${T.names[T.turn]}`, r: `${T.n + 1} of ${T.total}` }, { k: 'p', t: `Pass the phone to ${T.names[T.turn]}.`, small: true },
        { k: 'sub', t: q.label }, { k: 'h', t: q.prompt }];
      if (T.pick < 0) { q.options.forEach((o, i) => rows.push({ k: 'btn', id: `tn:ans:${i}`, label: o.text })); rows.push({ k: 'btn', id: 'tn:hear', label: 'Hear the word', disabled: !S.canSpeak }); }
      else rows.push({ k: 'p', t: T.right ? 'Yes, that is right.' : `Not this time. It is "${q.answer}".` }, ...(q.meaning ? [{ k: 'p', t: q.meaning, small: true }] : []),
        { k: 'btn2', a: { id: 'tn:hear', label: 'Hear it', disabled: !S.canSpeak }, b: { id: 'tn:next', label: 'Next', style: 'primary' } });
      return { title: 'Take turns', rows, primary: null };
    }
    case 'era': {
      const E = X.era, rows = [{ k: 'h', t: 'Words from your youth' },
        { k: 'p', t: 'Pick the years when you were young. You will find the everyday words of those years, with a question to talk about. It is for enjoyment and conversation, not a test.', small: true },
        { k: 'chips', id: 'erdec', label: 'When were you young? (pick any)', opts: E.data.map((d) => chip(d.id, d.id, E.picked.includes(d.id))) }];
      if (!E.data.length) rows.push({ k: 'p', t: 'The era word lists are still loading.' });
      const shown = E.data.filter((d) => E.picked.includes(d.id));
      if (shown.length) {
        rows.push({ k: 'btn2', a: { id: 'er:talk', label: 'Talk about a word', style: 'primary' }, b: { id: 'er:quiz', label: 'Quiz me' } });
        if (E.eq) {
          const q = E.eq; rows.push({ k: 'rule' }, { k: 'h', t: `What does "${q.w}" mean?` });
          if (q.pick < 0) q.opts.forEach((o, i) => rows.push({ k: 'btn', id: `er:ans:${i}`, label: o }));
          else rows.push({ k: 'p', t: q.pick === q.right ? 'Yes, that is right.' : `Not quite. It means: ${q.opts[q.right]}` }, { k: 'btn', id: 'er:quiz', label: 'Another', style: 'primary' });
          rows.push({ k: 'rule' });
        }
        for (const d of shown) {
          rows.push({ k: 'h', t: d.label });
          for (const w of d.words) rows.push({ k: 'sub', t: w.w }, { k: 'p', t: w.m, small: true }, { k: 'p', t: `Talk about it: ${w.p}`, small: true });
        }
        rows.push({ k: 'btn', id: 'er:study', label: `Add the ${plural(E.studyable, 'word')} I can study to my study set`, disabled: !E.studyable });
      }
      return { title: 'Memories', rows, primary: null };
    }
    case 'reminisce': {
      const R = X.remi;
      if (!R?.item) return { title: 'Talk about it', rows: [{ k: 'h', t: 'Talk about it' }, { k: 'p', t: 'Pick some years in Words from your youth first.' }, { k: 'btn', id: 'go:era', label: 'Words from your youth' }], primary: null };
      return { title: 'Talk about it', rows: [
        { k: 'sub', t: R.item.era }, { k: 'h', t: R.item.w }, { k: 'p', t: R.item.m }, { k: 'p', t: R.item.p },
        { k: 'p', t: 'Take your time. There are no right answers. Tell someone, or write it down in your journal.', small: true },
        { k: 'btn2', a: { id: 'rm:hear', label: 'Read it aloud', disabled: !S.canSpeak }, b: { id: 'rm:next', label: 'Another word', style: 'primary' } },
        { k: 'btn', id: 'rm:write', label: 'Write a memory in my journal' },
        ...(X.msg ? [{ k: 'p', t: X.msg }] : []),
      ], primary: null };
    }
    case 'journal': {
      const rows = [{ k: 'h', t: 'My life in words' },
        { k: 'p', t: 'A private journal of short memories and stories. It stays on this phone and is part of your backup. Nothing is read or sent by the app.', small: true },
        ...(X.msg ? [{ k: 'p', t: X.msg }] : []),
        { k: 'btn2', a: { id: 'jr:new', label: 'Write an entry', style: 'primary' }, b: { id: 'jr:word', label: 'Write about a word' } },
        { k: 'btn', id: 'rp:journal', label: 'Make a life-story book (PDF)', disabled: !X.journal.length }];
      const list = X.journal.slice().reverse();
      if (!list.length) rows.push({ k: 'p', t: 'No entries yet.' });
      for (const e of list) {
        rows.push({ k: 'rule' }, { k: 'sub', t: `${longDate(e.day)}${e.w ? `  -  ${e.w}` : ''}` }, ...(e.prompt ? [{ k: 'p', t: e.prompt, small: true }] : []), { k: 'p', t: e.text },
          { k: 'btn', id: `jr:del:${e.id}`, label: X.jdel === e.id ? 'Tap again to delete this entry' : 'Delete this entry', style: X.jdel === e.id ? 'primary' : undefined });
      }
      return { title: 'Journal', rows, primary: null };
    }
    case 'vtest': {
      const V = X.vt;
      if (!V) return { title: 'Vocabulary size', rows: [
        { k: 'h', t: 'How many words do I know?' },
        { k: 'p', t: 'Answer about twenty meaning questions. Each one is chosen from your last answers: right answers lead to rarer words, wrong ones to commoner words. At the end you get an estimate of how many words you know, with a likely range.', small: true },
        { k: 'p', t: 'It is a rough guide counted against this app\'s own word list, not a score from any official test. There is no clock and nothing is saved except the result.', small: true },
        ...(X.vlast ? [{ k: 'p', t: `Last time (${longDate(X.vlast.day)}): about ${X.vlast.total} words, likely ${X.vlast.lo} to ${X.vlast.hi}.` }] : []),
        { k: 'btn', id: 'vt:start', label: X.vlast ? 'Take it again' : 'Start', style: 'primary' }, ...(X.vlast ? [{ k: 'btn', id: 'vt:last', label: 'See the last result' }] : []),
      ], primary: null };
      if (V.res) return { title: 'Vocabulary size', rows: [{ k: 'h', t: 'One moment' }], primary: null };
      const q = V.q;
      return { title: 'Vocabulary size', rows: [
        { k: 'kv', l: `Question ${V.n + 1}`, r: `of about ${V.about}` }, { k: 'sub', t: q.label }, { k: 'h', t: q.prompt },
        ...q.options.map((o, i) => ({ k: 'btn', id: `vt:ans:${i}`, label: o.text })),
        { k: 'btn', id: 'vt:skip', label: 'I do not know this one' }, { k: 'btn', id: 'vt:quit', label: 'Stop the test' },
      ], primary: null };
    }
    case 'vtresult': {
      const R = X.vlast;
      if (!R) return { title: 'Vocabulary size', rows: [{ k: 'p', t: 'No result yet.' }, { k: 'btn', id: 'go:vtest', label: 'Take the test' }], primary: null };
      const rows = [{ k: 'h', t: `About ${R.total.toLocaleString?.() ?? R.total} words` },
        { k: 'kv', l: 'Likely range (80%)', r: `${R.lo} to ${R.hi}` }, { k: 'kv', l: 'How sure', r: R.sure }, { k: 'kv', l: 'Questions', r: `${R.right} right of ${R.n}` }, { k: 'kv', l: 'Date', r: longDate(R.day) },
        { k: 'p', t: `Counted against the ${R.listSize?.toLocaleString?.() ?? R.listSize} words in this app's list. A longer test, taken again later, narrows the range.`, small: true },
        { k: 'rule' }, { k: 'h', t: 'Chance of knowing a typical word' }, ...R.per.map((p, i) => ({ k: 'bar', label: `${BAND_LABELS[i]}: ${pc(p)}`, frac: p }))];
      if (R.level !== null && R.level !== undefined) rows.push({ k: 'p', t: `You look comfortable with ${BAND_LABELS[R.level]} words.` }, { k: 'btn', id: 'vt:setlevel', label: `Use ${BAND_LABELS[Math.min(4, R.level)]} as my Learning level` });
      if ((X.vhist ?? []).length > 1) { rows.push({ k: 'rule' }, { k: 'h', t: 'Over time' }); for (const h of X.vhist.slice(-6).reverse()) rows.push({ k: 'kv', l: longDate(h.day), r: `${h.total} (${h.lo} to ${h.hi})` }); }
      rows.push({ k: 'btn', id: 'vt:start', label: 'Take it again' }, { k: 'btn', id: 'study', label: 'Study words at my level' });
      return { title: 'Vocabulary size', rows, primary: null };
    }
    case 'knowledge': {
      const F = X.facetSum, L = X.learned, rows = [{ k: 'h', t: 'Word knowledge' },
        { k: 'p', t: 'Knowing a word has several sides: telling it from others, finding it yourself, spelling it, hearing it, and using it. The game follows each side of each word separately and schedules each one for review on its own.', small: true },
        { k: 'sub', t: 'The sides of a word' }];
      for (const f of FACETS) {
        const o = F[f.k];
        rows.push({ k: 'bar', label: `${f.name}: ${plural(o.words, 'word')}${o.words ? `, ${pc(o.acc)} right${o.avgMs ? `, ${(o.avgMs / 1000).toFixed(1)} s` : ''}` : ''}`, frac: o.acc, text: `${f.cell}: ${f.blurb}${o.due ? `. ${o.due} due now` : ''}` });
      }
      rows.push({ k: 'p', t: 'Each side is a Leitner box of its own (the same 1, 2, 4, 8, 16, 32 and 64 day gaps). A side that is due is asked in its own way when you review. The list is grouped as form (spoken, written), meaning and use, each receiving or producing; it follows a standard idea in vocabulary research and has not yet had an expert review.', small: true },
        { k: 'rule' }, { k: 'sub', t: 'Met in many contexts' },
        { k: 'kv', l: 'Words met', r: String(L.met) }, { k: 'kv', l: `Known across ${CTX_NEEDED} or more kinds of question`, r: String(L.across) },
        { k: 'p', t: `A new word counts as Mastered only after right answers in at least ${CTX_NEEDED} different kinds of question (meaning, in a sentence, spelling, sound, grouping, your own writing). Words you already had before this rule, and words you marked known, are not held back.`, small: true },
        { k: 'rule' }, { k: 'sub', t: 'A balanced week' },
        { k: 'p', t: 'Good vocabulary learning mixes four strands. This shows your last seven days.', small: true });
      for (const s of X.strands) rows.push({ k: 'bar', label: `${s.name}: ${s.n}`, frac: s.frac, text: s.blurb });
      rows.push({ k: 'p', t: X.suggest ? `Suggested next: ${X.suggest.name}.` : 'Play a little to get a suggestion.' }, ...(X.suggest ? [{ k: 'btn', id: `kn:do:${X.suggest.k}`, label: `Do ${X.suggest.name.toLowerCase()}`, style: 'primary' }] : []),
        { k: 'rule' }, { k: 'btn', id: 'kn:due', label: `Review what is due (${X.dueN})`, disabled: !X.dueN }, { k: 'btn', id: 'rp:facets', label: 'Ways of knowing (CSV)' });
      return { title: 'Word knowledge', rows, primary: null };
    }
    case 'voicecmd': {
      const V = X.voice;
      return { title: 'Voice commands', rows: [
        { k: 'h', t: 'Voice commands' },
        { k: 'p', t: 'Speak instead of tapping. Press Listen, then say a short command. The phone listens on the device; the words are not kept or sent anywhere by the game.', small: true },
        ...(!V.canListen ? [{ k: 'p', t: 'This phone cannot listen on the device here, so voice commands are not available yet.' }] : []),
        { k: 'btn', id: 'vc:listen', label: V.listening ? 'Listening...' : 'Listen', style: 'primary', disabled: !V.canListen || V.listening },
        ...(V.heard ? [{ k: 'p', t: `Heard: "${V.heard}"` }] : []), ...(V.msg ? [{ k: 'p', t: V.msg }] : []),
        { k: 'p', t: 'You can say: play, study, review, progress, more, settings, journey, help, back.', small: true },
        { k: 'rule' }, { k: 'h', t: 'Voice-first play' },
        { k: 'p', t: 'With Voice-first play on, tap the speaker on a question to hear it read aloud with numbered choices; the words hold still, and the game then listens for "one", "two", "three", the word itself, hint, repeat, pause or stop. Nothing is read until you tap the speaker. It starts from Play. There is no clock and no lives.', small: true },
        { k: 'chips', id: 'vf', label: 'Voice-first play', opts: [chip('on', 'On', V.on, { disabled: !V.canListen || !V.canSpeak }), chip('off', 'Off', !V.on)], hint: !V.canListen || !V.canSpeak ? 'Needs the phone voice and on-device listening.' : '' },
      ], primary: null };
    }
    default: return null;
  }
}
export const SCENES7 = ['compose', 'reports', 'parent', 'pinset', 'caregiver', 'turns', 'era', 'reminisce', 'journal', 'vtest', 'vtresult', 'knowledge', 'voicecmd'];
