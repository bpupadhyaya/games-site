// The language choice: "Play in English" or "Play in Arabic". One module-level value, set by the game when it loads and when
// the player picks a language. English and Arabic are two complete, separate presentations; they are never mixed on a screen.
export const LANGS = ['en', 'ar'];
let current = 'en';
export const setLang = (l) => { current = l === 'ar' ? 'ar' : 'en'; };
export const getLang = () => current;
export const isAr = () => current === 'ar';
export const hasArabic = (str) => /[؀-ۿ]/.test(String(str));
