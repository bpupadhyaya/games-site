// Hub audit waves 7 and 8, the part that needs the running game: reports and printables (O4 P3 Y4 Y6), parent PIN and parent view (K12),
// caregiver setup (T3), turn-taking (T5), era words, reminiscence and the journal (T1 T6 T11), the adaptive vocabulary-size test (N5),
// word knowledge and balance (X1 X3 X6 N1), and voice (T4). game.js creates one of these with the pieces it already owns (`a`) and calls
// tap() for the button ids below, snap() for the screens, and the voice hooks around each question. Everything saves through game.js.
import * as facets from './facets.js';
import * as srs from './srs.js';
import * as era from './era.js';
import * as vtest from './vocabtest.js';
import * as voice from './voice.js';
import * as rep from './reports.js';
import { makePin, checkPin, validPin } from './pin.js';
import { RELATIONS, STRANDS } from './screens7.js';
import { isoDate } from './pdf.js';

const TAPS = new Set(['cx', 'rp', 'pn', 'pv', 'cg', 'tn', 'tnrel', 'er', 'erdec', 'rm', 'jr', 'vt', 'vc', 'vf', 'kn', 'rpsrc']);
const GO7 = new Set(['reports', 'parent', 'caregiver', 'turns', 'era', 'reminisce', 'journal', 'vtest', 'knowledge', 'voicecmd']);
const TURN_KINDS = ['definition', 'synonym', 'spelling', 'cloze', 'antonym', 'sense'];

export function createExtras(a) {
  const { state, wg, rng, lex, adapt, store } = a;
  const X = {
    msg: '', pinset: { step: 1, a: '', b: '', msg: '' }, confirmPin: false, parent: Object.create(null), repSrc: 'study',
    turns: null, rel: 'gc', eq: null, remi: null, jdel: 0, vt: null, voice: { heard: '', msg: '', listening: false }, comfort: false,
  };
  state.pin = null; state.x7 = X;                                      // the extension state is part of the game state (tests and the screen-reader layer read it)
  Promise.resolve(store.get('pin', null)).then((v) => { if (v && typeof v.h === 'string' && typeof v.s === 'string') state.pin = v; }).catch(() => {});

  // ------------------------------------------------------------------ data for reports
  const stageName = (k) => k;
  // Everything a report needs about one player, from a bundle { name, type, prefs, records, facets, sessions, study, est }.
  const reportData = (B) => {
    const d = a.day(), rec = B.records, fct = B.facets, P = B.prefs;
    const sm = srs.summary(rec, (w) => facets.stageCtx(fct, rec, w)), st = sm.stages;
    const weekDays = new Set(B.sessions.filter((s) => s.day > d - 7).map((s) => s.day));
    const fs = facets.summary(fct, d), bandSize = [0, 0, 0, 0, 0, 0], bandKnown = [0, 0, 0, 0, 0, 0];
    for (const e of lex.all()) { if (e.band < 0) continue; bandSize[e.band] += 1; const r = rec[e.w]; if (r && (r[8] || r[0] >= 3)) bandKnown[e.band] += 1; }
    const week = [0, 0, 0, 0]; for (const k of Object.keys(P.strands ?? {})) if (Number(k) > d - 7) (P.strands[k]).forEach((v, i) => { week[i] += v; });
    const plan = adapt.plan(P, B.type === 'child');
    const stages = ['seen', 'learning', 'familiar', 'mastered', 'maintained'].map((k) => ({ k, n: st[k] ?? 0 }));
    const vs = P.vsize ?? null, est = vs ?? B.est ?? null;
    const logMap = new Map(); for (const s of B.sessions) if (s.day > d - 30) { const o = logMap.get(s.day) ?? { day: s.day, secs: 0, n: 0, right: 0, nw: 0 }; o.secs += s.secs ?? 0; o.n += s.n ?? 0; o.right += s.right ?? 0; o.nw += s.nw ?? 0; logMap.set(s.day, o); }
    const logDays = [...logMap.values()].sort((x, y) => x.day - y.day).map((o) => ({ ...o, mins: Math.max(1, Math.round(o.secs / 60)) }));
    return {
      name: B.name, day: d, levelLine: plan.driver, goal: P.goal ?? 20, listName: B.listName ?? '',
      stats: { met: sm.met, reliable: st.familiar + st.mastered + st.maintained, right: sm.right, wrong: sm.wrong, acc: sm.accuracy, avgMs: sm.avgMs, daysWeek: weekDays.size, streak: P.streak?.last >= d - 1 ? P.streak.n : 0, due: srs.dueCount(rec, d) },
      stages, stageMax: Math.max(1, ...stages.map((s) => s.n)),
      facets: facets.FACETS.map((f) => ({ name: f.name, ...fs[f.k] })),
      bands: BAND_LABELS7().map((label, i) => ({ label, known: bandKnown[i], size: bandSize[i] })).slice(0, 5),
      strands: STRANDS.map((s, i) => ({ name: s.name, n: week[i] })), strandMax: Math.max(1, ...week),
      sessions: B.sessions, weak: srs.weakList(rec, 24), est: est ? { total: est.total, lo: est.lo, hi: est.hi } : null,
      logDays, journal: P.journal ?? [], set: [],
    };
  };
  const BAND_LABELS7 = () => lex.BAND_LABELS ?? ['Elementary', 'Middle school', 'High school', 'Undergraduate', 'Graduate', 'Professional'];
  const curBundle = () => {
    const me = state.profiles.find((p) => p.id === state.profile);
    return { name: me?.name ?? 'Player', type: me?.type ?? 'adult', prefs: state.prefs, records: state.records, facets: state.facets, sessions: state.sessions, study: state.study, est: state.est };
  };
  const loadBundle = async (p) => {
    if (p.id === state.profile) return curBundle();
    const g = (k) => Promise.resolve(store.get(a.pkey(p.id, k), null)).catch(() => null);
    const [prefs, rec, sess, fct, est] = await Promise.all([g('prefs'), g('rec'), g('sess'), g('facets'), g('est')]);
    return { name: p.name, type: p.type, prefs: a.mergePrefs(prefs ?? {}), records: Object.assign(Object.create(null), rec && typeof rec === 'object' ? rec : {}), facets: facets.clean(fct), sessions: Array.isArray(sess) ? sess : [], study: { words: [] }, est: est ?? null };
  };
  // The words for a lesson plan or worksheet: the study set, or a chosen list of the player's own.
  const repWords = () => {
    const src = X.repSrc, words = src === 'study' ? state.study.words : (state.lists.find((l) => l.id === src)?.words ?? state.study.words);
    return { words, listName: src === 'study' ? 'My study set' : (state.lists.find((l) => l.id === src)?.name ?? '') };
  };
  const wordRows = () => {
    const { words, listName } = repWords();
    return { listName, set: words.map((w) => lex.entry(w)).filter((e) => e && e.gloss).slice(0, 24).map((e) => ({ w: e.w, gloss: e.gloss, ex: e.ex || '' })) };
  };
  const fileName = (s) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const doReport = async (kind, profile = null) => {
    const P = profile ? state.profiles.find((p) => p.id === profile) : state.profiles.find((p) => p.id === state.profile);
    const B = P ? await loadBundle(P) : curBundle();
    const R = reportData(B); Object.assign(R, profile && profile !== state.profile ? {} : wordRows());
    const nm = fileName(B.name) || 'player', title = { report: 'Progress report', sheet: 'Weekly progress sheet', work: 'Word worksheet', lesson: 'Lesson plan', log: 'Learning log', journal: 'My life in words' }[kind];
    const pdf = (blocks) => rep.renderBlocks(blocks, { title: `${title} - ${B.name}`, day: R.day });
    switch (kind) {
      case 'report': return a.exportNow(`word-game-report-${nm}.pdf`, 'application/pdf', pdf(rep.reportBlocks(R)));
      case 'cert': { const c = rep.certificateFor(R); return a.exportNow(`word-game-certificate-${nm}.pdf`, 'application/pdf', rep.certificatePdf({ name: B.name, ...c, day: R.day })); }
      case 'sheet': return a.exportNow(`word-game-week-${nm}.pdf`, 'application/pdf', pdf(rep.sheetBlocks(R)));
      case 'work': return a.exportNow('word-game-worksheet.pdf', 'application/pdf', pdf(rep.worksheetBlocks(R)));
      case 'lesson': return a.exportNow('word-game-lesson-plan.pdf', 'application/pdf', pdf(rep.lessonBlocks(R)));
      case 'lessontxt': return a.exportNow('word-game-lesson-plan.txt', 'text/plain', rep.blocksText(rep.lessonBlocks(R)));
      case 'log': return a.exportNow(`word-game-learning-log-${nm}.pdf`, 'application/pdf', pdf(rep.homeschoolBlocks(R)));
      case 'logcsv': return a.exportNow(`word-game-learning-log-${nm}.csv`, 'text/csv', rep.homeschoolCsv(R));
      case 'journal': return a.exportNow('word-game-life-story.pdf', 'application/pdf', pdf(rep.journalBlocks(R)));
      default: return null;
    }
  };

  // ------------------------------------------------------------------ PIN and parent view (K12)
  const sums = () => { const x = 6 + rng.int(8), y = 4 + rng.int(7), ans = x + y, opts = new Set([ans]); while (opts.size < 4) opts.add(ans + rng.int(9) - 4 || ans + 5); return { a: x, b: y, ans, opts: rng.shuffle([...opts]), wrong: false }; };
  const openPinGate = (next) => { state.gate = { pin: true, entry: '', wrong: 0, lockUntil: 0, chain: 0 }; state.gateNext = next; a.go('gate'); return true; };
  const gateDone = () => { state.parentUntil = state.t + 300; const next = state.gateNext; state.gate = null; state.back.pop(); if (next === 'parent') refreshParent(); a.go(next); };
  const pinTap = (b) => {
    const G = state.gate;
    if (state.scene === 'pinset') {
      const P = X.pinset, key = P.step === 1 ? 'a' : 'b';
      if (b === 'cancel') { a.goBack(); return; }
      if (b === 'clr') P[key] = '';
      else if (/^d\d$/.test(b) && P[key].length < 4) P[key] += b[1];
      else if (b === 'ok') {
        if (!validPin(P[key])) { P.msg = 'Use exactly four digits.'; }
        else if (P.step === 1) { P.step = 2; P.msg = ''; }
        else if (P.a !== P.b) { P.step = 1; P.a = ''; P.b = ''; P.msg = 'Those did not match. Start again.'; }
        else { state.pin = makePin(P.a, `s${rng.int(1e9)}`); store.set('pin', state.pin); X.pinset = { step: 1, a: '', b: '', msg: '' }; state.parentUntil = state.t + 300; a.goBack(); }
      }
      a.touch(); return;
    }
    if (b === 'set') { X.pinset = { step: 1, a: '', b: '', msg: '' }; a.go('pinset'); return; }
    if (b === 'clear') { if (!X.confirmPin) { X.confirmPin = true; a.touch(); return; } state.pin = null; store.remove('pin'); X.confirmPin = false; a.touch(); return; }
    if (!G?.pin) return;
    if (b === 'forgot') { G.chain = 3; Object.assign(G, sums()); a.touch(); return; }
    if (G.lockUntil > state.t) return;
    if (b === 'clr') G.entry = '';
    else if (/^d\d$/.test(b) && G.entry.length < 4) { G.entry += b[1]; if (G.entry.length === 4) { if (checkPin(state.pin, G.entry)) { gateDone(); return; } G.wrong += 1; G.entry = ''; if (G.wrong >= 5) { G.lockUntil = state.t + 60; G.wrong = 0; } } }
    else if (b === 'ok') { if (checkPin(state.pin, G.entry)) { gateDone(); return; } G.wrong += 1; G.entry = ''; }
    a.touch();
  };
  // The sums that clear a forgotten PIN: three right in a row, each one new.
  const chainTap = (n) => {
    const G = state.gate; if (!G?.pin || !(G.chain > 0)) return false;
    if (Number(n) === G.ans) { G.chain -= 1; if (G.chain === 0) { state.pin = null; store.remove('pin'); gateDone(); return true; } Object.assign(G, sums()); }
    else { G.wrong = true; G.opts = rng.shuffle(G.opts); }
    a.touch(); return true;
  };
  const refreshParent = async () => {
    X.parent = Object.create(null);
    for (const p of state.profiles) {
      const B = await loadBundle(p), d = a.day(), sm = srs.summary(B.records);
      X.parent[p.id] = { met: sm.met, n: sm.right + sm.wrong, acc: sm.accuracy, streak: B.prefs.streak?.last >= d - 1 ? B.prefs.streak.n : 0, todaySecs: B.prefs.today?.day === d ? B.prefs.today.secs : 0, limit: B.prefs.limitMin ?? 0, last: B.sessions.length ? B.sessions[B.sessions.length - 1].day : 0 };
      a.touch();
    }
  };
  const openParent = () => { if (state.pin && state.parentUntil <= state.t) { openPinGate('parent'); return; } refreshParent(); a.go('parent'); };

  // ------------------------------------------------------------------ caregiver setup (T3)
  const comfortPack = () => {
    const P = state.prefs;
    P.calm = true; P.reduce = true; P.voice = 0; if (!P.ageGroup) a.setAge('later', true); P.senior = true; P.ageSenior = P.ageSenior || P.ageGroup === 'later';
    a.setTextIdx(3); a.save.prefs(); X.comfort = true; state.msg = 'Comfort pack applied: larger text, a calm look, a slow voice and no clock.'; a.touch();
  };

  // ------------------------------------------------------------------ turn-taking (T5)
  const askable = (e) => TURN_KINDS.some((k) => a.canAsk(e, k, { canSpeak: false }));
  const turnQuestion = (age) => {
    const plan = adapt.plan({ ageGroup: age, level: null }, age === 'child');
    lex.setKidMode(plan.kid);
    try {
      const pool = adapt.pick({ attrs: [], topics: [], combine: 'any', minLen: 4, maxLen: 12 }, plan).pool.filter(askable);
      for (let i = 0; i < 40 && pool.length; i += 1) {
        const e = pool[rng.int(pool.length)], kind = a.chooseKind(e, TURN_KINDS, rng, { canSpeak: false });
        const q = kind && a.build(kind, e, rng, new Set([e.w, ...e.syn, ...e.ant]));
        if (q && q.options?.some((o) => o.correct)) return { ...q, label: adapt.plainLabel(q.kind, q.label, { plain: true }) };
      }
      return null;
    } finally { a.syncKid(); }
  };
  const turnNext = () => {
    const T = X.turns; if (!T) return;
    if (T.n >= T.total) { T.done = true; a.touch(); return; }
    T.turn = T.n % 2; const q = turnQuestion(T.ages[T.turn]);
    if (!q) { T.done = true; a.touch(); return; }
    T.q = q; T.pick = -1; T.right = false; a.touch();
  };
  const turnStart = () => {
    const R = RELATIONS.find((r) => r.k === X.rel) ?? RELATIONS[0];
    X.turns = { rel: R.k, names: R.names.slice(), ages: R.ages.slice(), scores: [0, 0], n: 0, total: 10, turn: 0, q: null, pick: -1, right: false, done: false };
    turnNext();
  };

  // ------------------------------------------------------------------ era words, reminiscence, journal (T1 T6 T11)
  const pickedDecades = () => state.prefs.era.decades.filter((id) => era.decade(id));
  const eraPool = () => { const ids = pickedDecades(); return (ids.length ? ids : era.decades().map((d) => d.id)).flatMap((id) => era.decade(id).words.map((w) => ({ ...w, era: era.decade(id).label }))); };
  const eraQuiz = () => {
    const pool = eraPool(); if (pool.length < 3) { X.eq = null; a.touch(); return; }
    const it = rng.pick(pool), others = rng.shuffle(pool.filter((x) => x.w !== it.w && x.m !== it.m)).slice(0, 2);
    const opts = rng.shuffle([it.m, ...others.map((x) => x.m)]);
    X.eq = { w: it.w, opts, right: opts.indexOf(it.m), pick: -1 }; a.touch();
  };
  const remiNext = () => { const pool = eraPool(); X.remi = pool.length ? { item: rng.pick(pool) } : null; X.msg = ''; a.touch(); };
  const addJournal = (text, w = '', prompt = '') => {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 600); if (!t) return false;
    const J = state.prefs.journal, id = (J.reduce((m, e) => Math.max(m, e.id | 0), 0)) + 1;
    J.push({ id, day: a.day(), w, prompt: prompt.slice(0, 160), text: t }); if (J.length > 300) J.splice(0, J.length - 300);
    a.bumpStrand('out', 3); a.save.prefs(); a.touch(); return true;
  };
  // Writing with the game's own on-screen keyboard: the phone's text box is not available to the game on every device, and this works the same everywhere.
  const KEYCHAR = { comma: ',', dot: '.', ques: '?', bang: '!', apos: "'", dash: '-', slash: '/', colon: ':', semi: ';', lp: '(', rp: ')', amp: '&', at: '@', quote: '"', space: ' ' };
  const composeKey = (k) => {
    const C = X.compose; if (!C) return;
    if (k === 'del') { C.text = C.text.slice(0, -1); }
    else if (k === 'shift') C.shift = !C.shift;
    else if (k === 'sym') C.sym = true; else if (k === 'abc') C.sym = false;
    else if (k === 'clear') C.text = '';
    else if (C.text.length < 400) {
      const ch = KEYCHAR[k] ?? (/^[a-z0-9]$/.test(k) ? k : '');
      if (ch) { const cap = (C.shift || C.text === '' || /[.!?]\s$/.test(C.text)) && /[a-z]/.test(ch); C.text += cap ? ch.toUpperCase() : ch; C.shift = false; }
    }
    a.touch();
  };
  const openCompose = (opts) => { X.compose = { text: '', shift: true, sym: false, ...opts }; a.go('compose'); };
  const composeSave = () => {
    const C = X.compose; if (!C || !C.text.trim()) return;
    const ok = C.purpose === 'journal' ? addJournal(C.text, C.w ?? '', C.prompt ?? '') : false;
    X.compose = null; a.goBack(); X.msg = ok ? 'Saved to your journal.' : 'Nothing was added.'; a.touch();
  };
  const journalWrite = (w = '', prompt = '') => {
    openCompose({ purpose: 'journal', title: w ? `A memory of "${w}"` : 'Write an entry', prompt: prompt || 'Write a few lines. Use the keys below.', w, prompt });
  };
  const composeKeys = (keys) => {
    for (const c of keys) {
      if (/^Key[A-Z]$/.test(c)) composeKey(c[3].toLowerCase()); else if (/^Digit\d$/.test(c)) composeKey(c[5]); else if (c === 'Space') composeKey('space'); else if (c === 'Backspace') composeKey('del');
      else if (c === 'Comma') composeKey('comma'); else if (c === 'Period') composeKey('dot'); else if (c === 'Quote') composeKey('apos');
    }
  };

  // ------------------------------------------------------------------ adaptive vocabulary-size test (N5)
  const ranked = () => lex.all();
  const bandRanks = () => { const out = [[], [], [], [], [], []]; for (const e of ranked()) if (e.band >= 0) out[e.band].push(e.rank); return out; };
  const vtNext = () => {
    const V = X.vt, all = ranked();
    for (let tries = 0; tries < 30; tries += 1) {
      const target = vtest.nextRank(V.t, rng.range(-0.3, 0.3));
      for (let step = 0; step < 600; step += 1) {
        const i = target + (step % 2 ? -1 : 1) * Math.ceil(step / 2), e = all[i];
        if (!e || e.rank !== i || V.t.asked.includes(i) || !a.canAsk(e, 'definition', { canSpeak: false }) || !lex.kidOk(e)) continue;
        const q = a.build('definition', e, rng, new Set([e.w, ...e.syn, ...e.ant]));
        if (q && q.options?.length >= 3) { V.q = { ...q, rank: i }; a.touch(); return true; }
      }
    }
    return false;
  };
  const vtFinish = () => {
    const V = X.vt, R = vtest.result(V.t, bandRanks()), lvl = R.per.reduce((best, p, i) => (p >= 0.5 && i <= 4 ? i : best), -1);
    const rec = { day: a.day(), total: R.total, lo: R.lo, hi: R.hi, sure: R.sure, n: R.n, right: R.right, per: R.per, level: lvl >= 0 ? lvl : null, listSize: ranked().length };
    state.prefs.vsize = rec; state.prefs.vhist = [...state.prefs.vhist, { day: rec.day, total: rec.total, lo: rec.lo, hi: rec.hi }].slice(-12);
    a.save.prefs(); X.vt = null; a.setScene('vtresult'); a.touch(); a.checkAch?.();
  };
  const vtAnswer = (correct) => {
    const V = X.vt; if (!V?.q) return;
    vtest.record(V.t, V.q.rank, correct); V.n = V.t.n;
    if (vtest.done(V.t) || !vtNext()) vtFinish(); else a.touch();
  };

  // ------------------------------------------------------------------ word knowledge and balance (X1 X3 X6 N1)
  const weekStrands = () => {
    const d = a.day(), L = state.prefs.strands ?? {}, tot = [0, 0, 0, 0];
    for (const k of Object.keys(L)) if (Number(k) > d - 7) L[k].forEach((v, i) => { tot[i] += v; });
    const sum = tot.reduce((x, y) => x + y, 0), mx = Math.max(1, ...tot);
    const rows = STRANDS.map((s, i) => ({ ...s, n: tot[i], frac: tot[i] / mx, share: sum ? tot[i] / sum : 0 }));
    const suggest = sum ? rows.slice().sort((p, q) => p.share / p.target - q.share / q.target)[0] : rows[0];
    return { rows, suggest: sum || true ? suggest : null };
  };

  // ------------------------------------------------------------------ voice (T4)
  const canListen = () => Boolean(wg.canRecognize?.()), canTalk = () => Boolean(wg.canSpeak?.());
  const voiceOn = () => Boolean(state.prefs.voiceFirst && canListen() && canTalk() && !state.autoPlay);
  let vgen = 0;                                                       // bumps whenever a spoken question is replaced, so old listeners stop
  const optsOf = (round) => round.words.filter((w) => w.slot !== round.hinted).slice().sort((p, q) => p.slot - q.slot);
  const say = (text, onEnd) => { if (!wg.speak || wg.speak(text, state.prefs.voice, state.prefs.accent, null, onEnd) === false) onEnd?.(); };
  const voiceListen = async (round, gen, tries = 0) => {
    if (gen !== vgen || state.round !== round || state.scene !== 'playing') return;
    X.voice.listening = true; a.touch();
    let r = null; try { r = await wg.recognize(state.prefs.accent); } catch { r = null; }
    X.voice.listening = false;
    if (gen !== vgen || state.round !== round || state.scene !== 'playing') return;
    const opts = optsOf(round), c = voice.parseCommand(r?.transcript ?? '', state.paused ? [] : opts.map((o) => o.text));
    if (state.paused) { if (c.cmd === 'resume') { state.paused = false; voiceAsk(round); } else if (tries < 3) voiceListen(round, gen, tries + 1); return; }
    switch (c.cmd) {
      case 'answer': a.resolveRound(opts[c.index].text); return;
      case 'hint': a.hintNow(); voiceAsk(round); return;
      case 'repeat': voiceAsk(round); return;
      case 'pause': state.paused = true; say('Paused. Say resume to carry on.', () => voiceListen(round, gen, 0)); return;
      case 'stop': a.endSession('stop'); return;
      default:
        if (tries >= 2) { state.paused = true; say('I could not hear you, so the game is paused. Say resume, or tap the screen.', () => voiceListen(round, gen, 0)); return; }
        say(voice.HELP_SPEECH, () => voiceListen(round, gen, tries + 1));
    }
  };
  const voiceAsk = (round) => {
    if (!voiceOn() || state.round !== round) return;
    vgen += 1; const gen = vgen;
    say(voice.questionSpeech(round), () => voiceListen(round, gen, 0));
  };
  const voiceCmd = async () => {
    const V = X.voice; if (V.listening || !canListen()) return;
    V.listening = true; V.msg = ''; a.touch();
    let r = null; try { r = await wg.recognize(state.prefs.accent); } catch { r = null; }
    V.listening = false; V.heard = r?.transcript ?? '';
    const c = voice.parseCommand(V.heard);
    if (!V.heard) V.msg = 'I could not hear anything. Try again a little closer.';
    else if (c.cmd === 'go') { V.msg = `Opening ${c.to}.`; a.runVoiceTarget(c.to); }
    else if (c.cmd === 'back') { a.goBack(); }
    else if (c.cmd === 'help') V.msg = 'Say: play, study, review, progress, more, settings, journey or back.';
    else V.msg = 'I did not understand that. Say help to hear the commands.';
    if (V.msg) wg.announce?.(V.msg);
    a.touch();
  };

  // ------------------------------------------------------------------ button taps
  const tap = (id) => {
    const parts = id.split(':'), p = parts[0], b = parts[1], c = parts[2];
    if (p === 'go' && GO7.has(b)) {
      if (b === 'parent') { openParent(); return true; }
      if (b === 'reports' || b === 'caregiver') { if (a.needGate(b)) return true; }
      if (b === 'era') { a.go('era'); return true; }
      if (b === 'journal' || b === 'reminisce') { X.msg = ''; if (b === 'reminisce') remiNext(); a.go(b); return true; }
      if (b === 'turns') { X.turns = null; a.go('turns'); return true; }
      if (b === 'vtest') { X.vt = null; a.go('vtest'); return true; }
      a.go(b); return true;
    }
    if (p === 'gate' && chainTap(b)) return true;
    if (!TAPS.has(p)) return false;
    switch (p) {
      case 'rp': if (b === 'facets') a.exportNow('word-game-ways-of-knowing.csv', 'text/csv', facets.csv(state.facets)); else doReport(b); return true;
      case 'rpsrc': X.repSrc = b; a.touch(); return true;
      case 'cx': if (b === 'save') composeSave(); else if (b === 'cancel') { X.compose = null; a.goBack(); } else composeKey(b); return true;
      case 'pn': pinTap(b); return true;
      case 'pv': if (b === 'switch') a.switchProfile(c); else if (b === 'report') doReport('report', c); return true;
      case 'cg': if (b === 'comfort') comfortPack(); else if (b === 'hear') a.sayWord('hello'); else if (b === 'later') { a.setAge('later', true); a.save.prefs(); a.touch(); } return true;
      case 'tnrel': X.rel = b; a.touch(); return true;
      case 'tn':
        if (b === 'start') turnStart();
        else if (b === 'ans') { const T = X.turns; if (T && T.q && T.pick < 0) { T.pick = Number(c); T.right = Boolean(T.q.options[T.pick]?.correct); if (T.right) T.scores[T.turn] += 1; T.n += 1; a.touch(); } }
        else if (b === 'next') turnNext();
        else if (b === 'hear') { const T = X.turns; if (T?.q) a.sayWord(T.q.speak || (T.q.kind === 'definition' ? T.q.answer : T.q.prompt)); }
        else if (b === 'end') { X.turns = null; a.goBack(); }
        return true;
      case 'erdec': { const D = state.prefs.era.decades; state.prefs.era.decades = D.includes(b) ? D.filter((x) => x !== b) : [...D, b]; a.save.prefs(); X.eq = null; a.touch(); return true; }
      case 'er':
        if (b === 'quiz') eraQuiz();
        else if (b === 'ans') { if (X.eq && X.eq.pick < 0) { X.eq.pick = Number(c); a.touch(); } }
        else if (b === 'talk') { remiNext(); a.go('reminisce'); }
        else if (b === 'study') { const ws = eraPool().map((x) => x.w).filter((w) => lex.entry(w)); if (ws.length) a.setStudy([...new Set(ws)].slice(0, 60)); }
        return true;
      case 'rm':
        if (b === 'next') remiNext();
        else if (b === 'hear' && X.remi?.item) a.sayWord(`${X.remi.item.w}. ${X.remi.item.m}. ${X.remi.item.p}`);
        else if (b === 'write' && X.remi?.item) journalWrite(X.remi.item.w, X.remi.item.p);
        return true;
      case 'jr':
        if (b === 'new') journalWrite();
        else if (b === 'word') { const it = rng.pick(eraPool()); if (it) journalWrite(it.w, it.p); else journalWrite(); }
        else if (b === 'del') { const id = Number(c); if (X.jdel !== id) { X.jdel = id; } else { state.prefs.journal = state.prefs.journal.filter((e) => e.id !== id); a.save.prefs(); X.jdel = 0; } a.touch(); }
        return true;
      case 'vt':
        if (b === 'start') {
          const n = ranked().length; if (n < 500) { state.msg = 'The word list is still loading.'; a.touch(); return true; }
          X.vt = { t: vtest.createTest(n), q: null, n: 0, about: 20, res: false }; if (vtNext()) { if (state.scene !== 'vtest') a.go('vtest'); a.touch(); } else X.vt = null;
        } else if (b === 'ans') { const V = X.vt; if (V?.q) vtAnswer(Boolean(V.q.options[Number(c)]?.correct)); }
        else if (b === 'skip') vtAnswer(false);
        else if (b === 'quit') { if (X.vt && X.vt.t.n >= 6) vtFinish(); else { X.vt = null; a.touch(); } }
        else if (b === 'last') a.setScene('vtresult');
        else if (b === 'setlevel') { const R = state.prefs.vsize; if (R && R.level !== null && R.level !== undefined) a.setLevel(Math.min(4, R.level)); }
        return true;
      case 'vc': if (b === 'listen') voiceCmd(); return true;
      case 'vf': state.prefs.voiceFirst = b === 'on' && canListen() && canTalk(); a.save.prefs(); a.touch(); return true;
      case 'kn':
        if (b === 'due') a.startSession({ source: 'due' });
        else if (b === 'do') { if (c === 'in') a.go('read'); else if (c === 'out') { a.openWrite('use'); a.go('write'); } else if (c === 'study') a.openStudy(); else a.startFluency(); }
        return true;
      default: return false;
    }
  };

  // ------------------------------------------------------------------ snapshot for the screens
  const snap = () => {
    const sc = state.scene, o = { msg: X.msg, pinSet: Boolean(state.pin), confirmPin: X.confirmPin, parent: X.parent, repSrc: X.repSrc, lists: state.lists, studyN: state.study.words.length, repWords: 0, journal: state.prefs.journal, jdel: X.jdel, me: state.profiles.find((p) => p.id === state.profile)?.name ?? 'this player', comfort: X.comfort, rel: X.rel, turns: X.turns, pinset: X.pinset, vhist: state.prefs.vhist };
    if (sc === 'reports') o.repWords = repWords().words.filter((w) => lex.entry(w)?.gloss).length;
    if (sc === 'gate' && state.gate?.pin) o.gate = { ...state.gate, lock: Math.max(0, Math.ceil((state.gate.lockUntil ?? 0) - state.t)) };
    if (sc === 'era') { const ws = eraPool(); o.era = { data: era.decades(), picked: pickedDecades(), eq: X.eq, studyable: new Set(ws.map((x) => x.w).filter((w) => lex.entry(w))).size }; }
    if (sc === 'reminisce') o.remi = X.remi;
    if (sc === 'compose') o.compose = X.compose;
    o.vt = X.vt; o.vlast = state.prefs.vsize;
    if (sc === 'knowledge') { const W = weekStrands(); o.facetSum = facets.summary(state.facets, a.day()); o.learned = facets.learnedCount(state.facets, state.records); o.strands = W.rows; o.suggest = W.suggest; o.dueN = a.dueCountAll(); }
    if (sc === 'voicecmd') o.voice = { ...X.voice, canListen: canListen(), canSpeak: canTalk(), on: Boolean(state.prefs.voiceFirst) };
    if (sc === 'settings') o.voiceFirst = { on: Boolean(state.prefs.voiceFirst), canListen: canListen() && canTalk() };
    return o;
  };
  void stageName; void isoDate;
  return {
    X, tap, snap, openPinGate, composeKeys, voiceOn, voiceAsk, weekStrands,
    hold: () => voiceOn() && Boolean(state.round),                    // words hold still while the game talks and listens
    onRound: () => {},                                                   // never speaks by itself: the player taps the speaker on the question plaque
    voiceStop: () => { vgen += 1; },
  };
}
