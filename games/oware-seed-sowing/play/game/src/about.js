// The heritage page: short, factual, respectful. Anything not certain is left out.
// Paginated, one idea per page (view.js `scene === 'about'`), the same reader-card pattern as the
// Rules page (content.js) — this is what lets both screens hold a much bigger reading font
// (docs/GAME-CONTRACT.md-style reference text) without any page overflowing the panel.
export const ABOUT = {
  title: 'About Oware',
  pages: [
    { title: 'A family of games', lines: ['Oware belongs to the mancala family: sowing games played by moving seeds around rows of pits. Mancala games are among the oldest and most widespread board games in Africa.'] },
    { title: 'Where it is played', lines: ['Oware is especially popular in Ghana and across West Africa, and it is played by communities around the world. It is also known as Awale, Warri and, in related forms, Ayo.'] },
    { title: 'Made from almost nothing', lines: ['A board can be carved from wood, but people have long played by scooping pits in the ground and using seeds or pebbles. All you need is two rows of six pits.'] },
    { title: 'The name mancala', lines: ['The word mancala comes from an Arabic word meaning "to move", and is now used for the whole family of sowing games.'] },
    { title: 'These rules', lines: ['This game follows the widely played Abapa rules: four seeds in each of twelve pits, sowing counter-clockwise, capturing pits of two or three, and the first player to reach 25 seeds wins.'] },
    { title: 'Try the others', lines: ['Other mancala games use the same idea with different rules. Oware is a fine place to begin.'] },
  ],
};
