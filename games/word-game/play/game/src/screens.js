// Rows for every form screen. Pure: takes a snapshot S built by game.js and returns { title, rows, primary }.
import { BAND_LABELS, ATTR_LIST, TOPICS, select, all, entry, isFull, posName } from './lexicon.js';
import { PRESETS, PRESET_ORDER, QTYPES, SPEEDS, SESSION_SECS, QUESTION_COUNTS, SET_SIZES, LIVES, fmtSecs, speedLabel } from './config.js';
import { STAGES, STAGE_BLURB, summary, FIELDS, isLeech } from './srs.js';
import { DICTS, DICT_MODES, dictLabel } from './dict.js';
import { SCHEMES } from './schemes.js';
import { ACH } from './ach.js';
import * as jny from './journey.js';

const chip = (v, label, on, extra = {}) => ({ v, label, on, ...extra });
const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;
export const SPEED_OPTS = [0, ...SPEEDS];

export function sumLine(cfg, name = '') {
  const lv = cfg.contexts.length ? cfg.contexts.map((c) => (c === 'first' ? 'First words' : BAND_LABELS[c])).join(' + ') : 'All words';
  const pace = cfg.secs === 0 ? 'Classic pace' : `${cfg.secs} s per word`;
  return `${name ? `${name}  ·  ` : ''}${lv}  ·  ${pace}`;
}

function wordRows(S, words, opts = {}) {
  const rows = [];
  for (const w of words) {
    const e = entry(w); if (!e) continue;
    const r = S.records[w];
    const lines = [];
    if (e.gloss2) lines.push(`Also: ${e.gloss2}`);
    if (e.syn.length) lines.push(`Same meaning: ${e.syn.join(', ')}`);
    if (e.ant.length) lines.push(`Opposite: ${e.ant.join(', ')}`);
    if (e.ex) lines.push(`Example: ${e.ex}`);
    rows.push({ k: 'word', w, pos: posName(e.pos), gloss: e.gloss || '(meaning not available)', lines, lookup: S.lookupOn, checked: !!(r && r[FIELDS.chk]), known: opts.known === false ? undefined : !!(r && r[FIELDS.known]) });
  }
  return rows;
}

export function screenRows(name, S) {
  const cfg = S.cfg, P = S.prefs;
  switch (name) {
    case 'setup': {
      const n = select(cfg).length;
      const rows = [
        { k: 'p', t: 'Choose what to learn and how fast the words move. Everything here can be changed any time, and you can just press Play.', small: true },
        { k: 'chips', id: 'preset', label: 'Pace preset', opts: [...PRESET_ORDER.map((k) => chip(k, PRESETS[k].label, cfg.preset === k)), ...(cfg.preset === 'custom' ? [chip('custom', 'Custom', true)] : [])], hint: PRESETS[cfg.preset]?.blurb ?? 'Your own settings' },
        { k: 'chips', id: 'ctx', label: 'Word levels (pick any)', opts: [chip('first', 'First words', cfg.contexts.includes('first')), ...BAND_LABELS.map((l, i) => chip(i, l, cfg.contexts.includes(i)))], hint: isFull() ? 'Levels are estimated from how common each word is.' : 'Loading the full word list...' },
        { k: 'chips', id: 'attr', label: 'Kinds of words (pick any)', opts: ATTR_LIST.map((a) => chip(a.k, a.label, cfg.attrs.includes(a.k))) },
        { k: 'chips', id: 'topic', label: 'Topic packs', opts: TOPICS.map((t) => chip(t.k, t.label, cfg.topics.includes(t.k))) },
        { k: 'chips', id: 'combine', label: 'When you pick several', opts: [chip('any', 'Any of them', cfg.combine === 'any'), chip('narrow', 'Must match all', cfg.combine === 'narrow')], hint: cfg.combine === 'any' ? 'Words that fit at least one choice.' : 'Words from your levels that also fit every kind you ticked.' },
        { k: 'step', id: 'minLen', label: 'Shortest word (letters)', value: String(cfg.minLen), decOff: cfg.minLen <= 3, incOff: cfg.minLen >= cfg.maxLen },
        { k: 'step', id: 'maxLen', label: 'Longest word (letters)', value: String(cfg.maxLen), decOff: cfg.maxLen <= cfg.minLen, incOff: cfg.maxLen >= 15 },
        { k: 'kv', l: 'Words that match', r: plural(n, 'word') },
        { k: 'rule' },
        { k: 'step', id: 'setSize', label: 'Study set size (words)', value: String(cfg.setSize), decOff: cfg.setSize <= SET_SIZES[0], incOff: cfg.setSize >= SET_SIZES[SET_SIZES.length - 1] },
        { k: 'btn2', a: { id: 'study', label: 'Study these words' }, b: { id: 'newset', label: S.study.length ? 'New study set' : 'Make a set', disabled: !n } },
        { k: 'chips', id: 'source', label: 'Play from', opts: [chip('whole', 'All matching words', cfg.source === 'whole'), chip('study', `My study set (${S.study.length})`, cfg.source === 'study', { disabled: !S.study.length }), chip('due', `Due for review (${S.dueN})`, cfg.source === 'due', { disabled: !S.dueN }), chip('weak', `Weak words (${S.weakN})`, cfg.source === 'weak', { disabled: !S.weakN })] },
        { k: 'chips', id: 'qt', label: 'Question types (pick any)', opts: QTYPES.map((q) => chip(q.k, q.label, cfg.qtypes.includes(q.k), { disabled: (q.k === 'listening' && !S.canSpeak) || S.kindOff.includes(q.k) })), hint: QTYPES.filter((q) => cfg.qtypes.includes(q.k)).map((q) => q.blurb).join('. ') + (S.canSpeak ? '' : '. Listening needs the phone voice, which is not available here.') },
        { k: 'rule' },
        { k: 'step', id: 'secs', label: 'Word speed (seconds for a word to cross)', value: cfg.secs === 0 ? 'Classic' : `${cfg.secs} s`, decOff: cfg.secs === 0, incOff: cfg.secs === SPEEDS[SPEEDS.length - 1] },
        { k: 'p', t: speedLabel(cfg.secs), small: true },
        { k: 'chips', id: 'endBy', label: 'Session ends', opts: [chip('time', 'After time', cfg.endBy === 'time'), chip('questions', 'After questions', cfg.endBy === 'questions')] },
        cfg.endBy === 'time'
          ? { k: 'step', id: 'sess', label: 'Session length', value: fmtSecs(SESSION_SECS[cfg.secsIdx]), decOff: cfg.secsIdx <= 0, incOff: cfg.secsIdx >= SESSION_SECS.length - 1 }
          : { k: 'step', id: 'sess', label: 'Session length', value: `${QUESTION_COUNTS[cfg.qIdx]} questions`, decOff: cfg.qIdx <= 0, incOff: cfg.qIdx >= QUESTION_COUNTS.length - 1 },
        { k: 'chips', id: 'lives', label: 'Lives', opts: LIVES.map((l) => chip(l, l ? `${l} lives` : 'No lives', cfg.lives === l)) },
        { k: 'chips', id: 'opts', label: 'Options', opts: [chip('hints', cfg.hints ? 'Hints on' : 'Hints off', cfg.hints), chip('skipKnown', 'Skip words I know', cfg.skipKnown)] },
        { k: 'gap', h: 10 },
        { k: 'btn', id: 'play', label: 'Play', style: 'primary', disabled: !n },
      ];
      return { title: 'Words and pace', rows, primary: { id: 'play', label: 'Play', disabled: !n } };
    }
    case 'studylist': {
      const rows = [{ k: 'h', t: `Study set: ${S.study.length} words` }];
      if (!S.study.length) rows.push({ k: 'p', t: 'No study set yet. Pick your word levels in Words and pace, then make a set.' }, { k: 'btn', id: 'newset', label: 'Make a study set', style: 'primary' });
      else {
        rows.push({ k: 'p', t: 'Read the words first, or use flashcards. When you are ready, play and you will be quizzed on exactly these words.', small: true },
          { k: 'btn2', a: { id: 'cards', label: 'Flashcards', style: 'primary' }, b: { id: 'newset', label: 'New set' } },
          { k: 'btn', id: 'quizset', label: 'Quiz me on these words' });
        rows.push({ k: 'rule' }, ...wordRows(S, S.study));
      }
      return { title: 'Study', rows, primary: S.study.length ? { id: 'quizset', label: 'Quiz me' } : null };
    }
    case 'more':
      return { title: 'More', rows: [
        { k: 'btn', id: 'go:achievements', label: 'Badges' }, { k: 'btn', id: 'go:trace', label: 'Trace the letters' }, { k: 'btn', id: 'go:place', label: 'Placement check', sub: 'about 3 minutes, finds your starting level' },
        { k: 'rule' },
        { k: 'btn', id: 'go:about', label: 'About' }, { k: 'btn', id: 'go:howto', label: 'How to play' }, { k: 'btn', id: 'go:rules', label: 'Rules' },
        { k: 'btn', id: 'go:settings', label: 'Settings and accessibility' }, { k: 'btn', id: 'go:profiles', label: 'Players and profiles' },
        { k: 'btn', id: 'go:data', label: 'Your data: export and import' }, { k: 'btn', id: 'go:privacy', label: 'Privacy' },
      ], primary: null };
    case 'age':
      return { title: 'Welcome', rows: [
        { k: 'h', t: 'Who is playing?' },
        { k: 'p', t: 'This only helps pick the right words and settings. It is not sent anywhere.' },
        { k: 'btn', id: 'age:child', label: 'A child (under 13)', sub: 'vetted words, grown-up settings' },
        { k: 'btn', id: 'age:teen', label: 'A teenager' },
        { k: 'btn', id: 'age:adult', label: 'An adult' },
        { k: 'p', t: 'You can add more players, such as family members, later in More > Players and profiles.', small: true },
      ], primary: null };
    case 'gate': {
      const g = S.gate ?? { a: 0, b: 0, opts: [] };
      return { title: 'Grown-ups only', rows: [
        { k: 'h', t: 'Ask a grown-up' },
        { k: 'p', t: `Settings, data and players are for grown-ups. What is ${g.a} + ${g.b}?` },
        { k: 'chips', id: 'gate', label: g.wrong ? 'Not quite. Try again.' : 'Pick the answer', opts: g.opts.map((o) => chip(o, String(o), false)) },
      ], primary: null };
    }
    case 'profiles': {
      const rows = [{ k: 'h', t: 'Players' }, { k: 'p', t: 'Each player has their own words, progress, journey and settings on this phone. Child players only see vetted words and never get dictionary look-ups.', small: true }];
      for (const p of S.profiles) {
        const me = p.id === S.profile;
        rows.push({ k: 'kv', l: p.name, r: `${p.type === 'child' ? 'Child' : 'Adult'}${me ? ' (playing)' : ''}` });
        rows.push({ k: 'btn2', a: { id: `pswitch:${p.id}`, label: me ? 'Playing now' : 'Switch to this player', disabled: me }, b: { id: `pdel:${p.id}`, label: S.confirmProfile === p.id ? 'Tap again to delete' : 'Delete', style: S.confirmProfile === p.id ? 'primary' : undefined } });
        if (S.canAsk) rows.push({ k: 'btn', id: `prename:${p.id}`, label: 'Rename' });
      }
      rows.push({ k: 'rule' }, { k: 'h', t: 'Add a player' }, { k: 'btn2', a: { id: 'padd:adult', label: 'Add an adult' }, b: { id: 'padd:child', label: 'Add a child' } }, { k: 'btn', id: 'padd:senior', label: 'Add a later-life calm player', sub: 'no clock, bigger text, gentle feedback' });
      return { title: 'Players', rows, primary: null };
    }
    case 'achievements': {
      const have = S.ach, rows = [{ k: 'h', t: `Badges: ${Object.keys(have).length} of ${ACH.length}` }, { k: 'p', t: 'Badges are for steady habits and exploring. Nothing is ever taken away.', small: true }];
      for (const a of ACH) rows.push({ k: 'bar', label: `${have[a.id] ? '✓ ' : ''}${a.name}`, frac: have[a.id] ? 1 : 0, text: a.desc });
      return { title: 'Badges', rows, primary: null };
    }
    case 'stageinfo': {
      const sel = S.sel; if (!sel) return { title: 'Journey', rows: [], primary: null };
      const W_ = jny.WORLDS[sel.world], J = S.journey, isCheck = sel.kind === 'check';
      const unlocked = isCheck ? jny.checkReady(J, sel.world) : jny.isStageUnlocked(J, sel.world, sel.stage);
      const stars = isCheck ? 0 : J.stars[jny.stageId(sel.world, sel.stage)] ?? 0;
      const rows = [{ k: 'h', t: isCheck ? `${W_.name} checkpoint` : `${W_.name}: ${jny.stageTitle(sel.world, sel.stage)}` }];
      if (isCheck) rows.push({ k: 'p', t: `${jny.CHECK_QUESTIONS} questions from the whole world, 3 lives, no hints. Score ${Math.round(jny.PASS_CHECK * 100)}% to open the next world.${J.checks[sel.world] ? ` Your best: ${J.checks[sel.world]}%.` : ''}` });
      else rows.push({ k: 'p', t: `${jny.STAGE_QUESTIONS} questions about ${W_.k === 'letters' ? 'these letters' : `${S.stageWords.length} words`}. Get at least half right for a star, 75% for two, 90% for three.${stars ? ` Your stars: ${stars} of 3.` : ''}` });
      if (!unlocked) rows.push({ k: 'p', t: isCheck ? 'Earn a star on every stage of this world first.' : 'Earn a star on the stage before this one first.' });
      if (W_.k === 'letters' && !isCheck) rows.push({ k: 'btn', id: 'go:trace', label: 'Trace these letters first' });
      if (!isCheck && W_.k !== 'letters') {
        rows.push({ k: 'rule' }, { k: 'h', t: 'Words in this stage' });
        for (const e of S.stageWords) {
          const r = S.records[e.w];
          rows.push({ k: 'word', w: e.w, pos: posName(e.pos), gloss: e.gloss, lines: [e.syn.length ? `Same meaning: ${e.syn.join(', ')}` : ''].filter(Boolean), lookup: S.lookupOn, checked: !!(r && r[7]) });
        }
      }
      return { title: 'Journey', rows, primary: { id: 'play', label: isCheck ? 'Start the test' : 'Play', disabled: !unlocked } };
    }
    case 'placeresult': {
      const est = S.est;
      if (!est) return { title: 'Placement', rows: [{ k: 'p', t: 'No result yet.' }], primary: null };
      const names = ['Elementary', 'Middle school', 'High school', 'Undergraduate', 'Graduate', 'Professional'];
      const rows = [{ k: 'h', t: 'Your starting level' },
        { k: 'p', t: `Start your Journey in ${jny.WORLDS[est.world].name}. The worlds before it are open for you.` },
        { k: 'kv', l: 'Words you may know', r: `about ${est.total.toLocaleString?.() ?? est.total}` }, { k: 'kv', l: 'Likely range', r: `${est.lo} to ${est.hi}` },
        { k: 'p', t: 'This is a rough guess from 18 questions, counted against the words in this app\'s list. Treat it as a starting point, not a test score.', small: true }, { k: 'rule' }, { k: 'h', t: 'By level' }];
      est.per.forEach(([r, n], b) => rows.push({ k: 'bar', label: `${names[b]}: ${r} of ${n} right`, frac: n ? r / n : 0 }));
      rows.push({ k: 'btn', id: 'jgo:map', label: 'Open the Journey map', style: 'primary' }, { k: 'btn', id: 'study', label: 'Study words at my level' });
      return { title: 'Placement', rows, primary: null };
    }
    case 'about':
      return { title: 'About', rows: [
        { k: 'h', t: 'Word Game' }, { k: 'p', t: `Version ${S.version}. Tap the matching word before it drifts away.` },
        { k: 'p', t: 'Learn English words by playing. Choose the words you want (by school level, how common they are, science, academic and everyday words, topic packs and more), choose how fast the words move from very slow practice to quick test pace, and play.' },
        { k: 'p', t: 'Study a set of words first if you like, then be quizzed on just those words. Words you miss come back for review on a schedule that helps them stick. Everything stays on your phone.' },
        { k: 'p', t: 'Questions use real word relationships: synonyms, opposites, meanings, odd one out, spelling and listening. Meanings and relations come from WordNet; the word list is open and described on the credits page.' },
        { k: 'btn', id: 'go:howto', label: 'How to play' }, { k: 'btn', id: 'go:privacy', label: 'Privacy' }, { k: 'btn', id: 'go:credits', label: 'Word list credits' },
      ], primary: null };
    case 'howto':
      return { title: 'How to play', rows: [
        { k: 'h', t: 'Quick start' }, { k: 'p', t: 'Press Play. A question appears at the top and three words drift across the screen. Tap the right one before it leaves.' },
        { k: 'h', t: 'Scoring' }, { k: 'p', t: 'Each right answer scores 10 points. Right answers in a row build a combo that multiplies your points up to x4. A wrong tap, a miss or a hint breaks the combo.' },
        { k: 'h', t: 'Set up your words' }, { k: 'p', t: 'Words and pace lets you choose levels, kinds of words, topics and word length, and the question types. Mix as many as you like.' },
        { k: 'h', t: 'Study first' }, { k: 'p', t: 'Study makes a set of 5 to 100 words with meanings, examples and flashcards. Then play, and the quiz uses only that set.' },
        { k: 'h', t: 'Speed' }, { k: 'p', t: 'Word speed is the time a word takes to cross the screen: very slow for practice, about 20 seconds for steady test practice, a few seconds for a sprint. Classic starts gently and speeds up as you score.' },
        { k: 'h', t: 'Review' }, { k: 'p', t: 'Missed words return sooner; words you get right return after longer gaps. Review shows what is due today.' },
        { k: 'h', t: 'Keys' }, { k: 'p', t: 'On a keyboard, press 1, 2 or 3 for the top, middle or bottom word, P to pause and H for a hint.' },
        { k: 'btn', id: 'go:rules', label: 'Full rules' },
      ], primary: null };
    case 'privacy':
      return { title: 'Privacy', rows: [
        { k: 'h', t: 'Your data stays with you' },
        { k: 'p', t: 'Word Game has no accounts, no ads, no tracking and no outside services. Your progress, settings and scores are stored only on this device.' },
        { k: 'p', t: 'Nothing leaves the app unless you choose to export it from Your data. Exports are files you control.' },
        { k: 'p', t: 'There is one optional exception. If you turn on Look up, tapping it opens a dictionary website of your choice in your browser; that sends only the word you tapped to that site. It is never used during play, and it is off if you choose Never.' },
        { k: 'p', t: 'You can delete everything at any time from Your data.' },
        { k: 'btn', id: 'go:data', label: 'Your data' }, { k: 'btn', id: 'go:settings', label: 'Look-up settings' },
      ], primary: null };
    case 'credits': {
      const rows = [{ k: 'h', t: 'Word list credits' }];
      if (!S.credits) rows.push({ k: 'p', t: S.loadingData ? 'Loading...' : 'The credits text is not available in this view.' });
      else {
        // the notices are hard-wrapped in their sources; join each block into one paragraph (same words, same order)
        const blocks = S.credits.split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean));
        for (const blk of blocks) {
          if (!blk.length || blk[0] === 'Word list credits') { if (blk.length > 1 && blk[0] === 'Word list credits') rows.push({ k: 'p', t: blk.slice(1).join(' ') }); continue; }
          if (blk.length >= 2 && /^=+$/.test(blk[1])) { rows.push({ k: 'sub', t: blk[0] }); if (blk.length > 2) rows.push({ k: 'pre', t: blk.slice(2).join(' ') }); }
          else rows.push({ k: 'pre', t: blk.join(' ') });
        }
      }
      return { title: 'Word list credits', rows, primary: null };
    }
    case 'notice': {
      const lbl = dictLabel(P.dict);
      return { title: 'Look it up', rows: [
        { k: 'h', t: `Look up "${S.pending}"` },
        { k: 'p', t: `This opens ${lbl} in your phone's browser. It leaves this app, and only the word is sent. The meaning shown in this app comes first and works without any connection.` },
        { k: 'btn', id: 'notice:open', label: 'Open it', style: 'primary' },
        { k: 'btn', id: 'notice:always', label: 'Open it, and do not ask again' },
        { k: 'btn', id: 'notice:cancel', label: 'Cancel' },
      ], primary: null };
    }
    case 'settings': {
      const dict = P.dict, R = P.remind;
      return { title: 'Settings', rows: [
        { k: 'h', t: 'Look and sound' },
        { k: 'chips', id: 'scheme', label: 'Colours', opts: SCHEMES.map((s, i) => chip(i, s.name, P.scheme === i)) },
        { k: 'chips', id: 'sound', label: 'Sound', opts: [chip('on', 'Sound on', P.sound), chip('off', 'Sound off', !P.sound)] },
        { k: 'chips', id: 'voice', label: 'Voice speed (listening)', opts: [chip(0, 'Slow', P.voice === 0), chip(1, 'Normal', P.voice === 1), chip(2, 'Fast', P.voice === 2)] },
        { k: 'chips', id: 'motion', label: 'Effects', opts: [chip('full', 'Full effects', !P.calm), chip('calm', 'Calm (fewer effects)', P.calm)] },
        { k: 'rule' },
        { k: 'h', t: 'Accessibility' },
        { k: 'chips', id: 'acc', label: 'Reading and seeing', opts: [chip('font', 'Dyslexia-friendly text', P.font === 'dys'), chip('cb', 'Colour-blind safe colours', P.cb), chip('reduce', 'Reduce motion', P.reduce)], hint: 'Text size: use A− and A+ at the top of any reading screen, up to 300%.' },
        { k: 'chips', id: 'acc', label: 'Hands and ears', opts: [chip('lefty', 'Left-handed layout', P.lefty), chip('captions', 'Captions for sounds', P.captions), chip('deaf', 'No audio-only questions', P.deaf)] },
        { k: 'chips', id: 'acc', label: 'Later-life calm mode', opts: [chip('senior', P.senior ? 'On: no clock, no lives, large text' : 'Off', P.senior)], hint: 'Gentle pace, no timers, no lives, softer sound and wording. Wellness wording only: this is for enjoyment, not treatment.' },
        { k: 'rule' },
        { k: 'h', t: 'Daily goal and reminder' },
        { k: 'step', id: 'goal', label: 'Answers per day', value: String(P.goal), decOff: P.goal <= 10, incOff: P.goal >= 100 },
        { k: 'chips', id: 'rem', label: 'Daily reminder', opts: [chip('on', R.on ? 'Reminder on' : 'Reminder off', R.on), ...[8, 12, 18, 20].map((h) => chip(`h${h}`, `${h}:00`, R.hour === h))], hint: 'The reminder is set on this phone only. It needs notification permission from the app, which arrives with a shell update.' },
        { k: 'rule' },
        { k: 'h', t: 'Dictionary look-up' },
        { k: 'p', t: 'Show a Look up button on word lists and review. It opens the dictionary you choose in your browser and sends only the word. Never shown during play or in a child profile. The meaning in this app always comes first.', small: true },
        { k: 'chips', id: 'dmode', label: 'Look-up button', opts: DICT_MODES.map((m) => chip(m.v, m.label, dict.mode === m.v)) },
        { k: 'chips', id: 'dict', label: 'Dictionary', opts: [...DICTS.map((d) => chip(d.k, d.label, dict.choice === d.k)), chip('custom', 'My own address', dict.choice === 'custom')], hint: dict.choice === 'custom' ? (dict.custom ? `Address: ${dict.custom}` : 'Use "Enter address" and put {word} where the word goes.') : '' },
        ...(dict.choice === 'custom' ? [{ k: 'btn', id: 'dcustom', label: 'Enter address', disabled: !S.canAsk }] : []),
      ], primary: null };
    }
    case 'data': {
      return { title: 'Your data', rows: [
        { k: 'h', t: 'Export' },
        { k: 'p', t: 'Everything is stored on this device only. Export makes a file or text you can keep or move to another phone. Nothing is sent anywhere by the app.', small: true },
        { k: 'btn', id: 'exp:json', label: 'Export full backup', sub: 'JSON: settings, progress, sessions, study set' },
        { k: 'btn2', a: { id: 'exp:words', label: 'Words (CSV)' }, b: { id: 'exp:sessions', label: 'Sessions (CSV)' } },
        { k: 'h', t: 'Import' },
        { k: 'p', t: 'Restore a backup made by this app. It replaces your progress with the backup.', small: true },
        { k: 'btn', id: 'imp', label: 'Import a backup' },
        ...(S.msg ? [{ k: 'p', t: S.msg }] : []),
        { k: 'rule' },
        { k: 'h', t: 'Delete everything' },
        { k: 'p', t: 'Removes your progress, sessions, study set and settings from this device.', small: true },
        { k: 'btn', id: S.confirmDel ? 'del:yes' : 'del:ask', label: S.confirmDel ? 'Tap again to delete everything' : 'Delete everything', style: S.confirmDel ? 'primary' : undefined },
        ...(S.confirmDel ? [{ k: 'btn', id: 'del:no', label: 'Keep my data' }] : []),
      ], primary: null };
    }
    case 'progress': {
      const sm = summary(S.records), st = sm.stages;
      const goal = Math.min(1, S.todayN / Math.max(1, P.goal));
      const rows = [
        { k: 'h', t: 'Your progress' },
        { k: 'bar', label: `Today: ${S.todayN} of ${P.goal} answers`, frac: goal, text: S.streakN ? `${plural(S.streakN, 'day')} in a row` : 'Answer at least 5 in a session to start a streak' },
        { k: 'kv', l: 'Words met', r: String(sm.met) }, { k: 'kv', l: 'Words you reliably know', r: String(st.familiar + st.mastered + st.maintained) },
        { k: 'kv', l: 'Answers right', r: sm.right + sm.wrong ? `${Math.round(sm.accuracy * 100)}% of ${sm.right + sm.wrong}` : 'none yet' },
        { k: 'kv', l: 'Average answer time', r: sm.avgMs ? `${(sm.avgMs / 1000).toFixed(1)} s` : 'none yet' },
        { k: 'kv', l: 'Due for review today', r: String(S.dueN) },
        { k: 'rule' }, { k: 'h', t: 'This week' },
        { k: 'kv', l: 'Days played', r: `${S.week.days} of 7` }, { k: 'kv', l: 'Answers', r: S.week.n ? `${S.week.right} right of ${S.week.n}` : 'none yet' }, { k: 'kv', l: 'New words learned', r: String(S.week.nw) },
        { k: 'p', t: S.week.n === 0 ? 'A short session today starts your week.' : S.week.days >= 5 ? 'A great week. Keep the habit going.' : S.week.n && S.week.right / S.week.n < 0.6 ? 'Try Relaxed pace or a smaller study set to build confidence.' : 'Steady progress. A little each day works best.', small: true },
        { k: 'kv', l: 'Journey stars', r: String(jny.totalStars(S.journey)) },
        { k: 'kv', l: 'Estimated words you know', r: S.est ? `about ${S.est.total} (${S.est.lo} to ${S.est.hi})` : 'take the placement check' },
        { k: 'btn2', a: { id: 'go:achievements', label: 'Badges' }, b: { id: 'go:place', label: 'Placement check' } },
        { k: 'rule' }, { k: 'h', t: 'Mastery stages' },
        ...STAGES.filter((s) => s !== 'new').map((s) => ({ k: 'bar', label: `${s[0].toUpperCase()}${s.slice(1)}: ${st[s]}`, frac: sm.met ? st[s] / sm.met : 0, text: STAGE_BLURB[s] })),
        { k: 'rule' }, { k: 'h', t: 'By level' },
        ...BAND_LABELS.map((l, i) => ({ k: 'bar', label: `${l}: ${S.bandKnown[i]} of ${S.bandSize[i]} known`, frac: S.bandSize[i] ? S.bandKnown[i] / S.bandSize[i] : 0 })),
      ];
      rows.push({ k: 'rule' }, { k: 'h', t: 'Recent sessions' });
      if (!S.sessions.length) rows.push({ k: 'p', t: 'No sessions yet.' });
      for (const s of S.sessions.slice(-8).reverse()) rows.push({ k: 'kv', l: `Day ${s.day}  ·  ${s.preset}`, r: `${s.right}/${s.n} right, score ${s.score}` });
      if (S.weak.length) {
        rows.push({ k: 'rule' }, { k: 'h', t: 'Words to practise' }, { k: 'btn', id: 'practiseweak', label: 'Practise these words', style: 'primary' }, ...wordRows(S, S.weak.slice(0, 15), { known: false }));
      }
      if (S.leeches.length) rows.push({ k: 'p', t: `Stubborn words (missed many times): ${S.leeches.slice(0, 12).join(', ')}. Try studying them as flashcards.`, small: true });
      return { title: 'Progress', rows, primary: null };
    }
    default: return { title: '', rows: [], primary: null };
  }
}
export const FORM_SCENES = new Set(['setup', 'studylist', 'more', 'about', 'howto', 'privacy', 'credits', 'notice', 'settings', 'data', 'progress', 'age', 'gate', 'profiles', 'achievements', 'stageinfo', 'placeresult']);
export { all, isLeech };
