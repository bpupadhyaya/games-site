// The heritage page: short, factual, respectful. Anything not certain is left out.
// Paginated, one idea per page (view.js `scene === 'about'`), the same reader-card pattern as the
// Rules page (content.js) — this is what lets both screens hold a much bigger reading font
// (docs/GAME-CONTRACT.md-style reference text) without any page overflowing the panel.
//
// Split down to one short sentence (or clause) per page: at the top text-size step (layout.js
// TEXT_SCALES, now reaching 3x/300%) even a single two-sentence paragraph wraps to more lines than
// the panel holds, so topics that were one page at the 130%/200% ceilings are now several - verified
// by actually rendering every page at the top step (see the game's STATUS.md).
export const ABOUT = {
  title: 'About Oware',
  pages: [
    { title: 'A family of games', lines: ['Oware belongs to the mancala family: sowing games played by moving seeds around rows of pits.'] },
    { title: 'A family of games', lines: ['Mancala games are among the oldest and most widespread board games in Africa.'] },
    { title: 'Where it is played', lines: ['Oware is especially popular in Ghana and across West Africa.'] },
    { title: 'Where it is played', lines: ['It is also played by communities around the world.'] },
    { title: 'Where it is played', lines: ['It is also known as Awale, Warri and, in related forms, Ayo.'] },
    { title: 'Made from almost nothing', lines: ['A board can be carved from wood.'] },
    { title: 'Made from almost nothing', lines: ['But people have long played by scooping pits in the ground and using seeds or pebbles.'] },
    { title: 'Made from almost nothing', lines: ['All you need is two rows of six pits.'] },
    { title: 'The name mancala', lines: ['The word mancala comes from an Arabic word meaning "to move".'] },
    { title: 'The name mancala', lines: ['It is now used for the whole family of sowing games.'] },
    { title: 'These rules', lines: ['This game follows the widely played Abapa rules.'] },
    { title: 'These rules', lines: ['Four seeds in each of twelve pits, sowing counter- clockwise.'] },
    { title: 'These rules', lines: ['Capturing pits left at two or three seeds.'] },
    { title: 'These rules', lines: ['The first player to reach 25 seeds wins.'] },
    { title: 'Try the others', lines: ['Other mancala games use the same idea with different rules. Oware is a fine place to begin.'] },
  ],
};
