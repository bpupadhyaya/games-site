// The heritage page: short, factual, respectful. Anything not certain is left out.
// A continuous scrolling reader (view.js `scene === 'about'`), the same pattern as the Rules page (content.js).
export const ABOUT = {
  title: 'About Songo',
  pages: [
    { title: 'A family of games', lines: ['Songo belongs to the mancala family: sowing games played by moving seeds or pebbles round rows of houses.', 'Mancala games are among the oldest and most widespread board games in Africa.'] },
    { title: 'Where it is played', lines: ['Songo is played by the Ekang peoples, including the Ewondo, Fang and Bulu, in Cameroon, Gabon, Equatorial Guinea and the north-west of the Democratic Republic of the Congo.', 'In Cameroon it is also known as Songo’o. The word is said to mean a pebble.'] },
    { title: 'A game for talking', lines: ['Songo has long been a social game: elders gathered at the homes of chiefs and respected neighbours to play while they talked over the affairs of the community.', 'Today there are clubs and championships in Cameroon and Gabon, and players of all ages.'] },
    { title: 'Made from almost nothing', lines: ['A board can be carved from wood, but two rows of seven holes scooped in the earth and a handful of seeds or pebbles are enough.'] },
    { title: 'The name mancala', lines: ['The word mancala comes from an Arabic word meaning “to move”. It is now used for the whole family of sowing games.'] },
    { title: 'These rules', lines: ['This game follows the Songo rules taught by clubs in Cameroon and Gabon (Club Awalé), with the Ekang rule summary in mancala reference works. Songo has local variants, and the Rules page says which choices this game makes.', 'Fourteen houses, five seeds in each, sown clockwise.', 'A last seed that brings an opponent’s house to two, three or four captures it, and the houses before it that also hold two to four. Each row’s first house is safe from a single landing seed, and its leftmost house may not be sown thin.', 'The first player to capture forty of the seventy seeds wins; if nobody reaches forty, the game is a draw.'] },
    { title: 'Try the others', lines: ['Other mancala games use the same idea with different rules. Oware, Bao and Gabata are in Arcforge too.'] },
  ],
};

import { docOf } from './content.js';
export const ABOUT_DOC = docOf(ABOUT.pages);
