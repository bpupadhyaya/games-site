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
