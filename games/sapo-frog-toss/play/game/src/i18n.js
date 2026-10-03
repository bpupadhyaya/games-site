// Two full presentations, never blended: English and Spanish. The language is a visible, named choice (title screen and Settings).
let LANG = 'en';
export const setLang = (l) => { LANG = l === 'es' ? 'es' : 'en'; };
export const getLang = () => LANG;
// tr('English', 'Español') picks the current language. Content that is a list of sections uses { en, es } objects through pick().
export const tr = (en, es) => (LANG === 'es' ? es : en);
export const pick = (o) => (o && typeof o === 'object' && !Array.isArray(o) && 'en' in o ? (LANG === 'es' ? o.es : o.en) : o);
