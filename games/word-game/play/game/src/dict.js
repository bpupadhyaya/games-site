// "Look it up in a dictionary of your choice": names and address patterns only. We never embed or copy their content; the word
// is the only thing sent, and only when the player taps Look up (never during play).
export const DICTS = [
  { k: 'oxford', label: 'Oxford', url: 'https://www.oxfordlearnersdictionaries.com/definition/english/{word}' },
  { k: 'cambridge', label: 'Cambridge', url: 'https://dictionary.cambridge.org/dictionary/english/{word}' },
  { k: 'mw', label: 'Merriam-Webster', url: 'https://www.merriam-webster.com/dictionary/{word}' },
  { k: 'collins', label: 'Collins', url: 'https://www.collinsdictionary.com/dictionary/english/{word}' },
  { k: 'longman', label: 'Longman', url: 'https://www.ldoceonline.com/dictionary/english/{word}' },
  { k: 'macmillan', label: 'Macmillan', url: 'https://www.macmillandictionary.com/dictionary/british/{word}' },
  { k: 'dictcom', label: 'Dictionary.com', url: 'https://www.dictionary.com/browse/{word}' },
  { k: 'wiktionary', label: 'Wiktionary', url: 'https://en.wiktionary.org/wiki/{word}' },
];
export const DICT_MODES = [{ v: 'ask', label: 'Ask each time' }, { v: 'always', label: 'Always open' }, { v: 'never', label: 'Never (hide the button)' }];
export function lookupUrl(dict, word) {
  const w = encodeURIComponent(word);
  if (dict.choice === 'custom') {
    const pat = String(dict.custom ?? '');
    if (!/^https:\/\/[^\s{}]+\{word\}[^\s]*$|^https:\/\/[^\s{}]+$/.test(pat)) return null;
    return pat.includes('{word}') ? pat.replace('{word}', w) : null;
  }
  const d = DICTS.find((x) => x.k === dict.choice) ?? DICTS[0];
  return d.url.replace('{word}', w);
}
export const dictLabel = (dict) => (dict.choice === 'custom' ? 'your own address' : (DICTS.find((x) => x.k === dict.choice) ?? DICTS[0]).label);

// Optional "More online" panels, by tab. Names and address patterns only; the word is the only thing sent.
export const ONLINE_MEANING = [
  { k: 'oxford', label: "Oxford Learner's" }, { k: 'cambridge', label: 'Cambridge' }, { k: 'mw', label: 'Merriam-Webster' }, { k: 'collins', label: 'Collins' }, { k: 'dictcom', label: 'Dictionary.com' },
];
export const ONLINE_THES = [
  { k: 'thesaurus', label: 'Thesaurus.com', url: 'https://www.thesaurus.com/browse/{word}' },
  { k: 'mwthes', label: 'Merriam-Webster', url: 'https://www.merriam-webster.com/thesaurus/{word}' },
  { k: 'cambthes', label: 'Cambridge', url: 'https://dictionary.cambridge.org/thesaurus/{word}' },
  { k: 'power', label: 'Power Thesaurus', url: 'https://www.powerthesaurus.org/{word}/synonyms' },
];
export function onlineUrl(key, word) {
  const w = encodeURIComponent(word), t = ONLINE_THES.find((x) => x.k === key);
  if (t) return { url: t.url.replace('{word}', w), label: t.label };
  const d = DICTS.find((x) => x.k === key); return d ? { url: d.url.replace('{word}', w), label: d.label } : null;
}
