// The heritage page: short, factual, respectful. Anything not certain is left out.
// Paginated one concept per page (like the Rules reference) so each page stays comfortably short
// even at the largest text-size step - see view.js's `renderReference()`. Re-split again for the
// 300% top step (see STATUS.md): even a single-sentence page from the 200%-era version could run
// past a dozen lines at 300%, so most sentences are now their own page.
export const ABOUT = {
  title: 'About Toguz Kumalak',
  pages: [
    { title: 'The name', lines: ['Toguz means "nine" in Kazakh.'] },
    { title: 'What a kumalak is', lines: ['Kumalak is the name of the small round pieces the game is played with.'] },
    { title: 'Nine to start', lines: ['Each pit starts with nine. In Kyrgyzstan the game is known as Toguz Korgool.'] },
    { title: 'A game of the steppe', lines: ['It is a traditional game of Kazakhstan and Kyrgyzstan.'] },
    { title: 'A national game', lines: ['It is one of the best-known board games in the region, regarded as a national game of both countries.'] },
    { title: 'A mancala game', lines: ['It belongs to the mancala family of sowing games, found across Africa and Asia.'] },
    { title: 'What sets it apart', lines: ['What sets it apart is the tuz: one opponent pit a player wins for good, out of eighteen.'] },
    { title: 'Today', lines: ['Toguz Kumalak is played as a competitive mind sport.'] },
    { title: 'Championships and tournaments', lines: ['It is played with championships and tournaments in Kazakhstan, Kyrgyzstan and beyond.'] },
    { title: 'These rules', lines: ['This game follows the common tournament rules:'] },
    { title: 'The setup', lines: ['Nine pebbles start in each of eighteen pits, and sowing runs counter-clockwise.'] },
    { title: 'Capture and tuz', lines: ['Capture happens on an even count, and each player may win one tuz.'] },
    { title: 'Winning', lines: ['The first to collect 82 of the 162 pebbles wins.'] },
  ],
};
