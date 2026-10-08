// Tales (data only). Each tale: an intro card, four beats (a narration card, one puzzle, an after card) and a moral.
// Puzzle kinds (engine.js): choose (riddle / logic / outwit), order, match, trap. Every answer has a story reason shown to the player.
// Told as folk tales "inspired by" the Anansi stories of the Akan people of Ghana, which are passed on by spoken telling.

export const TALES = [
  {
    id: 'sky', title: 'Stories from the Sky', sub: 'Four tasks for the Sky Keeper', scene: 'sky', motif: 'sankofa', tint: '#e0a030',
    intro: "Long ago all the stories in the world belonged to the Sky Keeper, and no one else was allowed to tell them. Anansi the spider wanted them for the people. 'Name your price,' he said. 'Bring me Onini the python, Osebo the leopard, Mmoboro the hornets and Mmoatia the fairy,' said the Sky Keeper. Everyone laughed. Anansi did not.",
    beats: [
      {
        cast: ['python'], who: 'Onini the python',
        pre: "First, Onini the python: long, strong, and very proud of it. Anansi cannot wrestle him. But he can talk. He cuts a long palm branch and gathers strong vines. Now, how does a spider tie up a python?",
        puzzle: {
          kind: 'order', label: 'Sequence', ask: 'Put Anansi\'s trick in the right order.',
          steps: [
            { t: 'Cut a long palm branch and gather strong vines.', early: 'He needs the branch and the vines in hand before anything else.' },
            { t: 'Argue loudly with his wife: "Onini is shorter than this branch!"', early: 'Without a loud argument, the python has no reason to come near.' },
            { t: 'Onini overhears, and stretches himself along the branch to prove his length.', early: 'Onini will only lie down once he is proud and annoyed.' },
            { t: 'Tie the python to the branch with the vines.', early: 'Tie him too soon and he slides away. He must be lying still first.' },
          ],
          hint: 'Pride is a loose thread. What must Onini want to prove?',
          explain: 'A proud creature will lie still for its own praise. The branch was only a measuring stick, and the vines did the rest.',
        },
        post: "Onini stretched out along the branch. 'Longer!' he said, and Anansi wound the vines round him, snug as a bundle of cloth. The first task was done.",
      },
      {
        cast: ['leopard'], who: 'Osebo the leopard',
        pre: "Next, Osebo the leopard, fastest paws in the forest. Anansi cannot outrun him, so he will let the ground do the work.",
        puzzle: {
          kind: 'trap', label: 'Trap', ask: 'Choose Anansi\'s tools, one at a time, to catch Osebo.',
          facts: { pit: 'Pit dug', hidden: 'Pit hidden', lured: 'Osebo lured' }, goal: ['pit', 'hidden', 'lured'],
          tools: [
            { t: 'Dig a deep pit on the leopard\'s path.', needs: [], sets: ['pit'] },
            { t: 'Cover the pit with leaves and soil.', needs: ['pit'], sets: ['hidden'], fail: 'There is no pit to cover yet. Dig it first.' },
            { t: 'Leave a trail of yams leading over the pit.', needs: ['hidden'], sets: ['lured'], fail: 'A trail across an open pit? Osebo is hungry, not foolish. Hide the pit first.' },
            { t: 'Plant a bright red cloth beside the pit.', fail: 'A red cloth tells Osebo that something is wrong, and he walks around it.' },
            { t: 'Dig the pit on the stony hill.', fail: 'The hill is solid rock. A pit cannot be dug there.' },
            { t: 'Wait inside the pit himself.', fail: 'Osebo would land right on top of him. Anansi is clever, not brave.' },
          ],
          hint: 'A trap works in layers: first the hole, then the disguise, then the reason to step there.',
          explain: 'A pit only works when it is hidden, and a hidden pit only works when something draws the leopard onto it.',
        },
        post: "Osebo padded along the yams, sniffing and thinking of supper. The ground opened under his paws. Anansi tied him up and carried him away, grinning. Two tasks done.",
      },
      {
        cast: ['hornets'], who: 'Mmoboro the hornets',
        pre: "Now Mmoboro the hornets. A nest the size of a drum hangs in the tree, and the buzzing is like thunder. Anansi has only an empty gourd and a calabash of water. Think like a spider.",
        puzzle: {
          kind: 'choose', label: 'Riddle', ask: 'A cloud of angry hornets circles Anansi. He holds an empty gourd and a calabash of water. What does he do?',
          options: [
            { t: 'Hit the nest with a stick and run.', why: 'Hornets are faster than any spider, and now they are angrier.' },
            { t: 'Sprinkle water on everyone and cry "It is raining! Shelter in my dry gourd!"', ok: true, why: 'Hornets hate rain. Anansi made the rain himself, and offered the one dry place.' },
            { t: 'Hide under a leaf and hope.', why: 'Hornets do not give up on a leaf.' },
            { t: 'Give a long speech about peace.', why: 'Hornets do not listen to speeches, and this one would be long.' },
          ],
          hint: 'What do hornets want to get away from? Can Anansi supply it?',
          explain: 'Anansi made the rain himself, then offered the only dry place. Never run from a problem you can make into an invitation.',
        },
        post: "Buzz, buzz, buzz: into the gourd they flew, one after another, and Anansi stopped it with a plug of leaves. Another task done, and not a single sting.",
      },
      {
        cast: ['doll'], who: 'Mmoatia the fairy',
        pre: "Last, Mmoatia the fairy: small, quick and impossible to catch, unless she wants something. Anansi carves a wooden doll and covers it with sticky gum. He sets a bowl of mashed yams in its hands and hides in the tall grass.",
        puzzle: {
          kind: 'match', label: 'Match', ask: 'Match each part of the trap to its job.',
          pairs: [
            ['Wooden doll', 'Sits still and says nothing, however rude the fairy gets'],
            ['Sticky gum', 'Holds on to whatever touches it'],
            ['Bowl of mashed yams', 'Draws the hungry fairy close'],
            ['Anansi in the tall grass', 'Waits until she is stuck, then ties her up'],
          ],
          hint: 'Ask of each piece: what does it do that the others cannot?',
          explain: 'Each piece had exactly one job. Take any one away and the trap fails.',
        },
        post: "The fairy asked the doll to share the yams. The doll said nothing. She asked again, then slapped it, and her hand stuck fast. So did the other. Anansi gathered her up like the rest.",
      },
    ],
    moral: "The Sky Keeper laughed with delight and kept his word. From that day the stories were Anansi's to give away, and that is why we still call them spider stories. Wit, not strength, bought the stories.",
    retold: "Anansi asked the Sky Keeper for the stories of the world. The price was four impossible catches: the python, the leopard, the hornets and the fairy. Anansi caught each one with wit instead of strength: pride for the python, a hidden pit for the leopard, a shower and a gourd for the hornets, and a sticky doll for the fairy. The Sky Keeper gave him the stories, and Anansi shared them with everyone.",
  },
  {
    id: 'pot', title: 'The Pot of Wisdom', sub: 'All the wisdom in one clay pot', scene: 'pot', motif: 'akoma', tint: '#c8603a',
    intro: "Anansi had a plan. He would gather all the wisdom in the world into one clay pot, keep it all for himself, and be the cleverest creature alive. He went from door to door, collecting a little from each place.",
    beats: [
      {
        cast: ['pot'], who: 'The village',
        pre: "A little wisdom from the river bank, a little from the market, a little from the elders' circle. Each place gives a lesson, and each lesson goes into the pot with a soft clink.",
        puzzle: {
          kind: 'match', label: 'Match', ask: 'Pair each moment with the wise thing to do.',
          pairs: [
            ['The river is rising fast', 'Move the goods to higher ground'],
            ['A stranger offers a deal that is too good', 'Ask what it will cost him'],
            ['Two friends quarrel over a path', 'Hear both before judging'],
            ['The yam harvest is plentiful', 'Store some for the dry season'],
          ],
          hint: 'Read each moment and ask: what would a calm elder say?',
          explain: 'Wisdom is mostly knowing what to do in the moment, and to keep something for later.',
        },
        post: "Clink, clink, clink. The pot grew heavier with every lesson. By evening it was nearly full.",
      },
      {
        cast: ['pot', 'tree'], who: 'Ntikuma, Anansi\'s son',
        pre: "At last the pot was full. Anansi would hide it at the top of the tallest tree where no one could find it. He tied the pot in front of his belly and began to climb. Up he went, and slipped down. Up he went, and slid down. His son Ntikuma watched from the ground.",
        puzzle: {
          kind: 'choose', label: 'Outwit', ask: 'Why does Anansi keep slipping, and what should he try?',
          options: [
            { t: 'The tree is too tall. He should find a shorter tree.', why: 'Height is not the problem. At every step, the pot gets in his way.' },
            { t: 'The pot hangs in front, so he cannot hug the trunk. He should tie it on his back.', ok: true, why: 'With the pot behind him, his arms and legs can grip the trunk. His son saw it at once.' },
            { t: 'The pot is too heavy. He should drink the wisdom to make it lighter.', why: 'Wisdom is not a drink, and an empty pot would still be in the way.' },
            { t: 'Spiders cannot climb trees.', why: 'Spiders climb everything. That is rather the point of spiders.' },
          ],
          hint: 'Look at where the pot hangs. What does it bump into?',
          explain: 'The pot in front blocked his grip. Sometimes a small child sees what a clever grown spider cannot.',
        },
        post: "'Father,' said Ntikuma, 'tie it on your back, and your arms will be free.' Anansi stopped. He had gathered all the wisdom in the world, and still a child knew something he did not.",
      },
      {
        cast: ['pot'], who: 'The wisdom',
        pre: "Anansi was so ashamed and so angry that he threw the pot down. It crashed against a stone and broke into a hundred pieces.",
        puzzle: {
          kind: 'order', label: 'Sequence', ask: 'What happened next? Put it in order.',
          steps: [
            { t: 'The pot hits the stone and cracks open.', early: 'Nothing can spill before the pot breaks.' },
            { t: 'The wisdom spills out across the ground.', early: 'The wisdom must come out of the pot first.' },
            { t: 'Rain comes and washes it into the streams.', early: 'The rain needs wisdom on the ground to wash.' },
            { t: 'The streams carry a little to every village.', early: 'Streams can only carry what the rain has already washed in.' },
          ],
          hint: 'Follow the wisdom: from the pot, to the ground, to the water.',
          explain: 'Each step caused the next. Once the pot was broken, there was no way to put it all back.',
        },
        post: "And that is why everyone has a small piece of wisdom: some in the rivers, some on the road, some in the children. No one keeps it all.",
      },
      {
        cast: ['pot'], who: 'A listener',
        pre: "A little listener at the edge of the circle asks a riddle, as listeners sometimes do. 'I grow when I am shared, and shrink when I am locked in a pot. What am I?'",
        puzzle: {
          kind: 'choose', label: 'Riddle', ask: 'I grow when I am shared, and shrink when I am locked in a pot. What am I?',
          options: [
            { t: 'A yam.', why: 'A yam gets smaller each time it is shared.' },
            { t: 'A shadow.', why: 'A shadow grows with the evening sun, not with sharing.' },
            { t: 'Wisdom, or a story.', ok: true, why: 'Shared wisdom reaches more people, and every new listener adds a little. Locked away, it dies.' },
            { t: 'A river.', why: 'A river grows with rain, not with sharing.' },
          ],
          hint: 'What does everyone have a little of, thanks to a broken pot?',
          explain: 'Wisdom and stories are the only things that grow when you give them away.',
        },
        post: "The circle laughed and nodded. Anansi, hanging from a branch above them, nodded too.",
      },
    ],
    moral: "No one person holds all the wisdom, and the wisest ask the young. A story or a lesson locked in a pot is worth nothing; shared, it feeds a whole village.",
    retold: "Anansi gathered all the wisdom in the world into a single pot, planning to hide it at the top of the tallest tree. He tied the pot to his front and could not climb, until his small son told him to tie it on his back. Ashamed that a child knew what he did not, Anansi threw the pot down. It broke, and the rain washed the wisdom into the streams, to every village. That is why everyone has some, and nobody has all of it.",
  },
  {
    id: 'feast', title: 'Two Feasts', sub: 'A rope, a hill and a greedy spider', scene: 'feast', motif: 'dwennimmen', tint: '#2f9d62',
    intro: "Two villages, Bokor and Dede, each sent word to Anansi: a great feast tonight, and Anansi was the guest of honour. 'Come when the food is ready,' they said, both at the very same hour, on opposite sides of the hill. Anansi licked his lips. He wanted both.",
    beats: [
      {
        cast: ['huts'], who: 'Anansi',
        pre: "Bokor will cook all afternoon. So will Dede. If Anansi waits at one village, the other will have eaten all the best food before he can run over the hill.",
        puzzle: {
          kind: 'choose', label: 'Riddle', ask: 'How can Anansi be told the moment the food is ready, in both places at once?',
          options: [
            { t: 'Wait on top of the hill and listen for shouts.', why: 'The hill is wide. By the time a shout arrives, the best food is gone.' },
            { t: 'Tie a rope round his waist, and give one end to each village to tug when the food is ready.', ok: true, why: 'A tug on the rope reaches him at once, from either side. He only has to feel it.' },
            { t: 'Eat at Bokor and pretend to be sick for Dede.', why: 'He would miss one feast completely, and a clever spider does not lose.' },
            { t: 'Split into two Anansis.', why: 'Even a trickster cannot do that.' },
          ],
          hint: 'He needs a signal that travels faster than he can walk.',
          explain: 'A rope turns distance into a signal. It was a clever answer, as far as it went.',
        },
        post: "A tug for Bokor, a tug for Dede, and Anansi would know. He rubbed his eight hands together.",
      },
      {
        cast: ['huts', 'rope'], who: 'The two villages',
        pre: "Anansi finds a long, strong rope and sets about making a signal that both villages can use.",
        puzzle: {
          kind: 'trap', label: 'Trap', ask: 'Choose the steps for the rope plan, one at a time.',
          facts: { tied: 'Rope on Anansi', bokor: 'Bokor holds an end', dede: 'Dede holds an end' }, goal: ['tied', 'bokor', 'dede'],
          tools: [
            { t: 'Tie the middle of the rope round his own waist.', needs: [], sets: ['tied'] },
            { t: 'Give one end to Bokor: "Pull when the food is ready."', needs: ['tied'], sets: ['bokor'], fail: 'An end with nothing at the other side pulls on nobody. Tie the middle to Anansi first.' },
            { t: 'Give the other end to Dede with the same message.', needs: ['tied'], sets: ['dede'], fail: 'An end with nothing at the other side pulls on nobody. Tie the middle to Anansi first.' },
            { t: 'Ask both villages to beat their drums.', fail: 'A drum on one side of the hill is hardly heard on the other, and drums wake the whole forest.' },
            { t: 'Tie the rope to a tree and hope.', fail: 'A rope tied to a tree pulls on nothing. Anansi has to be on the rope.' },
          ],
          hint: 'The rope must start with Anansi in the middle. Then the two ends can go out.',
          explain: 'Anansi is the knot in the middle: both ends reach him, and nothing else does.',
        },
        post: "Everything was ready. Anansi sat in the middle of the hill with a pleased face, rope round his waist, and waited to feel the first tug.",
      },
      {
        cast: ['huts', 'rope'], who: 'Anansi',
        pre: "The food cooked all afternoon. Bokor cooked fast; Dede cooked fast too. Neither village knew how the other was getting on. Anansi had not thought about what happens if they finish together.",
        puzzle: {
          kind: 'order', label: 'Sequence', ask: 'What happens when both feasts are ready at once? Put it in order.',
          steps: [
            { t: 'Both feasts are ready at the very same moment.', early: 'Nothing can pull before the food is ready.' },
            { t: 'Both villages pull the rope with all their might.', early: 'The villages pull only once they know the food is ready.' },
            { t: 'Anansi is dragged left and right and cannot go either way.', early: 'He is only dragged after both villages have pulled.' },
            { t: 'His middle is stretched thin, and stays that way for ever.', early: 'The stretch comes last, after he has been pulled both ways.' },
          ],
          hint: 'Start with the moment that causes everything else, then follow the rope.',
          explain: 'Each village pulled as hard as it could, and Anansi was in the middle of both.',
        },
        post: "Anansi stretched and stretched. When the villages let go, he was as thin as a thread in the middle. That, they say, is why a spider's waist is so slender to this day.",
      },
      {
        cast: ['huts'], who: 'A passer-by',
        pre: "Thin and hungry, Anansi sits on the hill. A kind passer-by asks him what he has learned.",
        puzzle: {
          kind: 'choose', label: 'Outwit', ask: 'Which answer shows the most wisdom?',
          options: [
            { t: 'Next time I will trick three villages.', why: 'He would only be stretched three ways.' },
            { t: 'One feast enjoyed in one place is better than two hoped for.', ok: true, why: 'The rope worked perfectly. It was the greed that was the problem.' },
            { t: 'Rope is a bad idea.', why: 'The rope did its job. Greed was the problem, not rope.' },
            { t: 'Never accept an invitation again.', why: 'Feasts are good. The lesson is about greed, not about invitations.' },
          ],
          hint: 'The rope did exactly what it was meant to. What went wrong instead?',
          explain: 'A good plan for a greedy goal is still a greedy plan.',
        },
        post: "The passer-by smiled, shared a bowl of his own food with Anansi, and went on his way.",
      },
    ],
    moral: "Greed pulls in two directions at once, and the middle gets stretched. A feast shared in one place is worth two feasts that tear you apart.",
    retold: "Two villages invited Anansi to a feast on the same evening. Wanting both, he tied a rope round his waist and gave an end to each village, to tug when the food was ready. Both feasts were ready at the same time, both villages pulled, and Anansi was stretched thin in the middle. That is why the spider's waist is so slender. He learned that greed pulls two ways at once.",
  },
  {
    id: 'rock', title: 'The Moss-Covered Rock', sub: 'Magic words and a watchful deer', scene: 'rock', motif: 'nkyinkyim', tint: '#6a4fb8',
    intro: "One morning Anansi was walking in the forest when he tripped over a rock. 'What a strange moss-covered rock!' he said, and he fell down in a faint. When he woke, the sun had moved a hand's width across the sky. He had never fainted before.",
    beats: [
      {
        cast: ['rock', 'tortoise'], who: 'Anansi',
        pre: "Anansi was curious. Was it the rock, the moss, or the words? He asked three animals to walk past it, and watched from behind a tree.",
        puzzle: {
          kind: 'choose', label: 'Logic', ask: 'The Tortoise says "What a strange moss-covered rock!" and faints. The Monkey says "What a lovely rock!" and walks on. The Deer says "This is a strange rock," and stays on his feet. What makes a faint?',
          options: [
            { t: 'Looking at the rock.', why: 'All three looked at the rock, but only the Tortoise fainted.' },
            { t: 'Saying all the words: "What a strange moss-covered rock!"', ok: true, why: '"Lovely rock" and "strange rock" did nothing. Only the full words made the Tortoise faint.' },
            { t: 'Being a tortoise.', why: 'Anansi fainted too, and he is a spider.' },
            { t: 'Saying the word "rock".', why: 'The Monkey and the Deer both said "rock" and nothing happened.' },
          ],
          hint: 'Compare what the three said. What did only the one who fainted say?',
          explain: 'Only the exact words worked. Change a word and the spell does nothing.',
        },
        post: "Anansi grinned from ear to ear. It was the exact words. And he thought of all the animals' dinners.",
      },
      {
        cast: ['rock', 'tortoise'], who: 'Tortoise',
        pre: "Now Anansi is greedy, which is where the trouble begins. He wants Tortoise's bag of yams, and he knows how to get it.",
        puzzle: {
          kind: 'trap', label: 'Trap', ask: 'Choose Anansi\'s steps, one at a time.',
          facts: { led: 'Tortoise at the rock', faint: 'Tortoise fainted', stolen: 'Yams taken' }, goal: ['led', 'faint', 'stolen'],
          tools: [
            { t: 'Walk Tortoise towards the rock, chatting about nothing in particular.', needs: [], sets: ['led'] },
            { t: 'Ask him: "Tortoise, have you ever seen such a rock? Describe it for me!"', needs: ['led'], sets: ['faint'], fail: 'Tortoise is nowhere near the rock yet. There is nothing to describe.' },
            { t: 'Take the bag of yams while he lies still.', needs: ['faint'], sets: ['stolen'], fail: 'Tortoise is awake and holding his bag. He must be fainted first.' },
            { t: 'Say the magic words himself.', fail: 'Then Anansi would be the one on the ground, and Tortoise would eat the yams.' },
            { t: 'Splash Tortoise with water first.', fail: 'He would wake up before the bag was taken, and the trick would be lost.' },
          ],
          hint: 'First he must be at the rock. Then he must say the words. Then he can be robbed.',
          explain: 'Anansi never says the words himself; he makes someone else say them.',
        },
        post: "Tortoise said the words and dropped like a stone. Anansi tiptoed away with the yams. It was an unkind trick, and the forest soon noticed.",
      },
      {
        cast: ['rock', 'deer'], who: 'Little Bush Deer',
        pre: "Soon every animal's dinner was disappearing. Little Bush Deer was small, careful, and clever. 'Everyone who goes to that rock loses their dinner,' he thought. 'I will go, and I will watch.'",
        puzzle: {
          kind: 'choose', label: 'Outwit', ask: 'Deer walks to the rock, hears Anansi\'s question, and lies down. If Anansi is as clever as he claims, what should he notice?',
          options: [
            { t: 'Deer lay down a moment too late and too gently, and one eyelid is trembling.', ok: true, why: 'A truly fainted animal drops like a stone. Deer was acting, and Anansi missed it.' },
            { t: 'Deer said the words very loudly.', why: 'Loud or quiet, the words are the same.' },
            { t: 'Deer fell on the soft grass.', why: 'Anyone lands softly on grass, a real faint or a pretend one. It tells Anansi nothing.' },
            { t: 'Deer has no yams.', why: 'Having no yams says nothing about whether he is faking.' },
          ],
          hint: 'How does a really fainted animal fall, compared with one who is pretending?',
          explain: 'A real faint is sudden and heavy. A pretend faint is slow and soft.',
        },
        post: "Anansi did not notice. He was already reaching for Deer's bag. Little Bush Deer lay with one eye half-open, until Anansi was well and truly busy.",
      },
      {
        cast: ['rock', 'deer'], who: 'Little Bush Deer',
        pre: "Little Bush Deer was ready. Everything now happens in a quick and tidy order. Can you tell it the way the storyteller does?",
        puzzle: {
          kind: 'order', label: 'Sequence', ask: 'Put Deer\'s turnabout in order.',
          steps: [
            { t: 'Anansi takes the yams, sure that Deer is out cold.', early: 'The turnabout cannot start until Anansi is busy stealing.' },
            { t: 'Deer springs up: "Let me show you something, Anansi."', early: 'Deer waits until Anansi has the bag in his hands.' },
            { t: 'Deer leads Anansi to the rock and asks him to describe it.', early: 'Deer must be up and awake to lead Anansi anywhere.' },
            { t: 'Anansi says the words and faints; Deer carries every stolen yam home.', early: 'Anansi can only faint at the rock, after being led there.' },
          ],
          hint: 'The same trick, turned on its maker: who is at the rock at the end?',
          explain: 'Deer used Anansi\'s own trick in the same order, with Anansi in Tortoise\'s place.',
        },
        post: "Deer gave every animal's yams back, and the animals clapped. When Anansi woke, the sun had moved a hand's width across the sky, and his bag was empty.",
      },
    ],
    moral: "A trick is a coat that anyone can wear. Tricksters can be tricked, and the quiet, watchful one often wins.",
    retold: "Anansi found a rock that made anyone faint who said 'What a strange moss-covered rock!' He used it to rob Tortoise and others of their dinners. Little Bush Deer worked out the trick, pretended to faint, and then turned the rock on Anansi. Deer returned every yam, and Anansi learned that a trick can be used by anyone.",
  },
  {
    id: 'cloth', title: 'The Web Cloth', sub: 'What two hunters learned from a spider', scene: 'loom', motif: 'duafe', tint: '#d64a6a',
    intro: "In the town of Bonwire, say the old stories, two friends, Kofi and Ameyaw, went hunting. They found a great spider weaving a web between two trees, day after day, and they watched. Anansi knew they were there, and wove slowly, so they could learn.",
    beats: [
      {
        cast: ['web'], who: 'Anansi',
        pre: "Anansi started at the top. A web is a plan before it is a net, and every thread has its turn.",
        puzzle: {
          kind: 'order', label: 'Sequence', ask: 'Put the weaving of the web in order.',
          steps: [
            { t: 'Stretch a long, strong thread between two branches.', early: 'Everything hangs from this first thread.' },
            { t: 'Drop a thread from the middle to make a Y shape.', early: 'The Y needs the first thread to hang from.' },
            { t: 'Add spokes from the centre, like the rays of the sun.', early: 'Spokes grow out from the Y, once it is there.' },
            { t: 'Spin the spiral round and round to join the spokes.', early: 'The spiral joins the spokes, so the spokes must come first.' },
          ],
          hint: 'A web grows outward from one strong thread.',
          explain: 'Each thread has to hold up the next, from the frame to the spiral.',
        },
        post: "Kofi and Ameyaw whispered. 'Threads crossing threads. We could make cloth that way.' They hurried to town to try it with silk.",
      },
      {
        cast: ['loom'], who: 'The weavers',
        pre: "Soon the cloth had patterns, too: small signs woven or stamped into the cloth, each a short saying in picture form. Weavers pass them on from teacher to student. The patterns here are inspired by the Adinkra symbols of the Akan, used in this game only as decoration.",
        puzzle: {
          kind: 'match', label: 'Match', ask: 'Match each pattern to the saying people give it.',
          pairs: [
            ['pat:akoma', 'Patience and tolerance'],
            ['pat:sankofa', 'Learn from the past'],
            ['pat:dwennimmen', 'Humility together with strength'],
            ['pat:nkyinkyim', 'Adaptability to change'],
          ],
          hint: 'Look at each shape: a heart, a bird looking back, two horns, a twisting path.',
          explain: 'A heart for patience, a bird looking back for learning from the past, horns for humble strength, a twisting path for change.',
        },
        post: "A saying in a pattern can be read without words, and worn on the shoulder. People who wear the cloth carry the thought with them.",
      },
      {
        cast: ['loom'], who: 'A weaver',
        pre: "Weaving is counting. A good weaver sees the pattern before the cloth does. 'Stripe after stripe,' says the weaver, 'and the cloth tells you where it is going.'",
        puzzle: {
          kind: 'choose', label: 'Logic', ask: 'The stripes run: gold, green, gold, green, black, gold, green, gold, green, black, gold, green, ... What stripe comes next?',
          options: [
            { t: 'Gold.', ok: true, why: 'The group is gold, green, gold, green, black. We have started the third group, so gold is next, then green, gold, green, black.' },
            { t: 'Black.', why: 'Black ends each group of five. The third group has only had two stripes so far.' },
            { t: 'Green.', why: 'Green just came. The group always starts with gold.' },
            { t: 'Red.', why: 'Red is not in this cloth at all.' },
          ],
          hint: 'Find the group that repeats, then see how far into it you are.',
          explain: 'Five stripes, over and over, like a drumbeat you can see.',
        },
        post: "Gold, green, gold, green, black: like a drumbeat you can see. The weaver smiled and sent another strip along.",
      },
      {
        cast: ['loom'], who: 'Kofi and Ameyaw',
        pre: "Kofi and Ameyaw had learned a new craft. They could keep it secret and grow rich, sell it, or teach it. Anansi, who once let the stories go free, listens with interest.",
        puzzle: {
          kind: 'choose', label: 'Outwit', ask: 'What would Anansi, who let the stories go free, advise?',
          options: [
            { t: 'Keep the craft secret in a locked room.', why: 'A locked secret dies with its keeper.' },
            { t: 'Teach willing learners openly, so the cloth belongs to everyone.', ok: true, why: 'A craft shared grows. Many hands make more patterns, and the people who teach are remembered.' },
            { t: 'Sell the secret to the highest bidder.', why: 'It would belong to one buyer, and the weavers would be left with nothing.' },
            { t: 'Forget all about it.', why: 'It would be a waste of what the spider taught.' },
          ],
          hint: 'What happened to the stories and the wisdom when they were shared?',
          explain: 'Patterns, like stories, grow when they are shared.',
        },
        post: "They taught anyone willing to learn, and the cloth spread from town to town.",
      },
    ],
    moral: "Patterns, like stories, grow when they are shared. A craft kept in a locked room dies; taught openly, it keeps growing.",
    retold: "Two friends watched a spider weave her web and learned how to weave cloth. They added patterns that carry sayings, counted their stripes, and chose not to keep the craft secret. They taught everyone willing to learn, and woven cloth spread through the towns. A skill shared is a skill that grows.",
  },
];

// Four short pattern sayings used on the match puzzle and in the About credits (pure decoration; meanings as commonly given).
export const PATTERNS = {
  akoma: { name: 'Akoma', say: 'Patience and tolerance' },
  sankofa: { name: 'Sankofa', say: 'Learn from the past' },
  dwennimmen: { name: 'Dwennimmen', say: 'Humility together with strength' },
  nkyinkyim: { name: 'Nkyinkyim', say: 'Adaptability to change' },
  duafe: { name: 'Duafe', say: 'Care and good looks' },
};

export const TIPS = [
  'Every wrong pick tells you something: read what happens.',
  'In a trap, build in layers: the hole, the disguise, the reason to step there.',
  'In a riddle, test each answer against every detail in the question.',
  'Order puzzles run from cause to effect: ask what must already be true.',
];

// ---------------------------------------------------------------- About / How to Play / Rules (checked against engine.js and game.js)
export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Anansi Tales', fig: 'hero',
      body: [
        { p: 'Gather around the storyteller. Anansi the spider is the trickster of the folk tales told in Ghana, who wins with wit instead of strength, and sometimes loses to it too. In this game you help him through five tales, each a chain of small puzzles of wit.' },
        { li: ['Four beats in each tale: the storyteller tells, you solve one puzzle, the storyteller explains why the trick worked.', 'Five kinds of puzzle: sequence, match, riddle and logic, traps built with cause and effect, and outwitting a rival.', 'A Gallery of woven story-cloths, one for each tale you finish.', 'Watch and Learn plays a tale for you and explains each trick, with a real Pause.'] },
      ],
    },
    {
      title: 'Oral tradition, credits and the free preview',
      fig: 'patterns',
      body: [
        { p: 'These tales are inspired by Anansi stories of the Akan people of Ghana, which have been told aloud for generations and travel in many versions. This game retells them in its own words and puzzles, and is not a record of any one storyteller. If you know a different telling, that is the tradition working as it should.' },
        { p: 'The patterns on the cloth are inspired by Adinkra symbols of the Akan. Here they are used only as decoration, with the sayings commonly given for them: Akoma, patience and tolerance; Sankofa, learn from the past; Dwennimmen, humility together with strength; Nkyinkyim, adaptability to change; Duafe, care and good looks.' },
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions.' },
        { p: 'Titles are set in Cormorant Garamond and the interface in Fredoka, both used under the SIL Open Font License 1.1. All sounds and the music are synthesized on your device.' },
        { p: 'Anansi Tales is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Choose a tale', fig: 'gallery',
      body: [
        { p: 'Tap Begin a Tale and pick one of the five tales. Start with Stories from the Sky if you are new. A tale you leave is saved at the start of the beat you were on; tap Continue on the menu to pick it up.' },
        { p: 'Each tale has four beats. In each beat the storyteller speaks, you solve one puzzle, and the storyteller explains the trick. Tap the card to finish the line, then tap Continue.' },
      ],
    },
    {
      title: 'Sequence and match', fig: 'order',
      body: [
        { h: 'Sequence' },
        { p: 'Tap the cards in the order the trick happened. A right card slides into place. A wrong card shakes and tells you what has to happen first.' },
        { h: 'Match' },
        { p: 'Tap a card on the left, then the card on the right that goes with it. Pairs that fit stay joined. A pair that does not fit tells you why.' },
      ],
    },
    {
      title: 'Riddles, logic and outwitting', fig: 'choose',
      body: [
        { p: 'Read the question, then tap the answer that holds up against every detail. A wrong answer is crossed out and the storyteller says what would really happen. There is no failing: you can keep choosing until you get it.' },
        { p: 'Outwit puzzles put Anansi up against a rival, and the right answer is the one that turns the rival\'s own move around.' },
      ],
    },
    {
      title: 'Traps', fig: 'trap',
      body: [
        { p: 'A trap is built from tools. Tap a tool to use it. Some tools need something to be done first: you cannot hide a pit you have not dug. The chips at the top light up as each part is ready. Decoy tools fail, and say why.' },
        { p: 'Use as few wrong tools as you can: they cost your star bonus, not the tale.' },
      ],
    },
    {
      title: 'Hints, stars and the Gallery', fig: 'stars',
      body: [
        { p: 'Tap Hint for a nudge in the storyteller\'s voice. Tap again for a highlight on the right card, option or tool. A tale earns three stars for at most one wrong pick and no hints, two stars for at most five wrong picks and two hints, and one star otherwise.' },
        { p: 'Each tale you finish adds a woven story-cloth to the Gallery. Tap a finished cloth to read the tale as the storyteller would tell it again.' },
      ],
    },
    {
      title: 'Watch and Learn, keys and text size', fig: 'learn',
      body: [
        { p: 'Watch and Learn plays a tale for you. For each puzzle it shows the question and thinks for a few seconds (set the time with the minus and plus buttons), then highlights the answer and explains why. Pause freezes everything exactly where it is.' },
        { p: 'Keyboard: 1 to 6 pick the numbered card, option or tool; Enter or Space is Continue; H is Hint; P or Escape pauses; the arrow keys scroll.' },
        { p: 'A− and A+ in the top corner zoom the text up to 300% on every text screen.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The tale', fig: 'beats',
      body: [
        { p: 'There are five tales. Each has an intro card, four beats and a moral card. A beat has three steps: Tell (narration card), Solve (one puzzle), After (the explanation card). You cannot skip a puzzle; you can always solve it.' },
        { li: ['Stories from the Sky: order, trap, riddle, match.', 'The Pot of Wisdom: match, outwit, order, riddle.', 'Two Feasts: riddle, trap, order, outwit.', 'The Moss-Covered Rock: logic, trap, outwit, order.', 'The Web Cloth: order, match, logic, outwit.'] },
      ],
    },
    {
      title: 'Sequence', fig: 'order',
      body: [
        { p: 'The cards are shuffled each time you play. Tap the card that happens next. If it is the right one it takes the next numbered slot. If it is not, nothing is placed, the card shakes, and you are told what has to come first. After all cards are placed the beat is solved.' },
        { p: 'Every wrong tap counts as one miss. Misses only affect stars.' },
      ],
    },
    {
      title: 'Match', fig: 'match',
      body: [
        { p: 'Tap one card on the left, then one on the right. If they belong together the pair locks and turns green. If not, both are released and you are told why; that is one miss. The right-hand cards are shuffled each time. When all pairs are locked, the beat is solved.' },
      ],
    },
    {
      title: 'Riddle, logic and outwit', fig: 'choose',
      body: [
        { p: 'Four answers, shuffled each time. Exactly one holds up. A wrong answer is crossed out with its reason, and counts as one miss. The right one ends the puzzle. These three kinds play the same; the label tells you what sort of thinking the question wants.' },
      ],
    },
    {
      title: 'Trap', fig: 'trap',
      body: [
        { p: 'The tools are shuffled each time. Tapping a tool uses it, if what it needs has already been done. A tool that needs something not yet done, and every decoy tool, fails: it stays unused, the reason is shown, and it counts as one miss. When every chip at the top is lit, the trap is built and the beat is solved. Several orders can work as long as every need is met first.' },
      ],
    },
    {
      title: 'Hints', fig: 'hint',
      body: [
        { p: 'The Hint button has two steps. The first shows a nudge and counts as one hint. The second highlights the card, option, pair or tool to use next and counts as one more hint. Close the hint with the second button.' },
        { p: 'In Watch and Learn hints are not counted, because the game is the one playing.' },
      ],
    },
    {
      title: 'Stars, the Gallery and the preview', fig: 'stars',
      body: [
        { p: 'At the end of a tale: three stars for at most one miss and no hints; two stars for at most five misses and at most two hints; one star otherwise. Your best stars for each tale are kept. Every finished tale adds its cloth to the Gallery.' },
        { p: 'The free preview counts only time spent solving a puzzle or listening in a tale you are playing. Menus, Rules, the Gallery, Settings and Watch and Learn are free and never use it. Paused time is not counted.' },
      ],
    },
  ],
};

export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
