// The language choice: "Play in English", "Jugar en español" or "العب بالعربية". One module-level value, set by the game when it loads
// and when the player picks a language. The three are complete, separate presentations; they are never mixed on a screen.
export const LANGS = ['en', 'es', 'ar'];
let current = 'en';
export const setLang = (l) => { current = LANGS.includes(l) ? l : 'en'; };
export const getLang = () => current;
export const langIndex = () => LANGS.indexOf(current);
export const isAr = () => current === 'ar';
export const hasArabic = (str) => /[؀-ۿ]/.test(String(str));
