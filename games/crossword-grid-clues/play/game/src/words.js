// Answer words and their clues (original text). Line format: ANSWER|tier|category|clue. Parsed once at load.
export const CATEGORIES = ["Everyday words","Animals","Food and drink","Nature and weather","Home and everyday","People, body and feelings","Actions","People and body","Words and glue","Describing words","Places and travel","Arts and music","Science and tech","Sport and games","Long words"];
const RAW = `ACT|1|11|Part of a play
ADD|1|8|Total up
AGE|1|7|Years lived
AGO|1|0|Long, long ___
AIR|1|8|What we breathe
ALL|1|0|"Once and for ___"
AND|1|8|Plus
ANT|1|1|Tiny worker marching in a line
ANY|1|0|"Do you have ___ questions?"
APE|1|1|Gorilla or chimp, for one
ARE|1|8|Plural form of "is"
ARM|1|7|Limb with an elbow
ART|1|8|Painting or sculpture
ASH|1|3|Tree or fireplace leftover
ASK|1|8|Pose a question
ASP|1|1|Snake of ancient Egypt
BAD|1|8|Not good
BAG|1|4|Carrier for shopping
BAT|1|0|"Blind as a ___"
BAY|1|3|Curved inlet of the coast
BED|1|0|"Early to ___, early to rise"
BEE|1|0|"Busy as a ___"
BIG|1|0|"Think ___"
BIN|1|4|Place for rubbish
BOG|1|3|Soft, wet ground
BOX|1|4|Container with a lid
BRO|1|7|Sibling, informally
BUN|1|2|Small sweet bread roll
BUS|1|0|"Hop on the ___"
BUT|1|8|However
BUY|1|8|Purchase
CAB|1|8|Taxi
CAP|1|4|Hat with a peak
CAR|1|8|Vehicle with four wheels
CAT|1|0|"The ___ sat on the mat"
COD|1|1|Fish served with chips
COT|1|4|Baby's bed
COW|1|1|Farm animal that gives milk
CUB|1|1|Young bear or lion
CUE|1|8|Signal to an actor
CUP|1|4|Mug's cousin
DAD|1|7|Father, informally
DEN|1|0|Lion's ___
DEW|1|3|Morning droplets on the grass
DIP|1|2|Creamy party snack partner for chips
DOE|1|1|Female deer
DOG|1|1|Loyal pet that barks
DUO|1|8|Pair of performers
DYE|1|8|Colour for cloth
EAR|1|7|Organ for hearing
EAT|1|2|Have a meal
EEL|1|1|Slippery, snakelike fish
EGG|1|0|"Don't put all your ___s in one basket"
EGO|1|8|Sense of self
ELK|1|1|Large deer with broad antlers
ELM|1|3|Shade tree lost to a famous disease
EMU|1|1|Tall flightless bird from Australia
END|1|0|"The ___" on the last page
ERA|1|8|Period in history
EVE|1|8|The night before
EWE|1|1|Female sheep
EYE|1|7|Organ of sight
FAN|1|4|Keeps you cool
FEE|1|8|Charge for a service
FEN|1|3|Low, marshy land
FIG|1|2|Soft, sweet fruit full of tiny seeds
FIR|1|3|Evergreen tree
FOG|1|3|Thick low cloud that hides the view
FOR|1|8|On behalf of
FOX|1|0|"Quick brown ___"
FRY|1|2|Cook in hot fat
FUN|1|0|"Have some ___"
GAL|1|7|Girl, in old slang
GAS|1|8|Vapour, not a liquid or solid
GNU|1|1|African antelope, also called a wildebeest
GYM|1|8|Place to work out
HAD|1|8|Owned
HAM|1|2|Cured pork
HAS|1|8|Owns
HEN|1|1|Egg layer on the farm
HIP|1|7|Joint at the top of the leg
HOG|1|1|Pig, informally
HOP|1|8|Jump on one leg
HOT|1|8|Opposite of cold
HUG|1|6|Embrace
HUM|1|8|Sing without words
ICE|1|0|"Break the ___"
ICY|1|8|Frozen and slippery
INK|1|11|Printer's fluid
INN|1|8|Small country hotel
IVY|1|3|Climbing plant on old walls
JAM|1|0|Traffic ___
JAR|1|4|Glass container for jam
JAW|1|5|Chewing bone
JAY|1|1|Noisy blue bird
JET|1|8|Fast aircraft
JOY|1|8|Great happiness
KEY|1|4|Opens a lock
KID|1|1|Young goat
LAD|1|7|Young man
LAP|1|7|Place where a cat sits
LAW|1|8|Rule made by a government
LEG|1|7|Limb with a knee
LID|1|4|Pot's cover
LIP|1|7|Part of the mouth
LOG|1|3|Chunk of firewood
LOW|1|8|Not high
MAD|1|0|"Hopping ___"
MAN|1|7|Adult male
MAP|1|4|Guide to a place
MAT|1|4|Doormat, for example
MIX|1|6|Stir together
MUD|1|3|Wet earth
MUG|1|4|Big cup
MUM|1|7|British mother
NET|1|4|Fishing tool
NEW|1|8|Fresh
NOD|1|6|Bow the head in agreement
NOT|1|0|"To be or ___ to be"
NOW|1|0|"Right ___!"
NUT|1|2|Hard-shelled kernel
OAK|1|3|Tree that grows acorns
OAR|1|4|Rowing tool
OAT|1|2|Cereal grain in porridge
ODD|1|9|Not even
ODE|1|8|Poem of praise
OFF|1|0|"Day ___" from work
OHO|1|8|Exclamation of surprise
OLD|1|8|Not new
ONE|1|0|"___ for the road"
OUT|1|0|"Sold ___"
OWE|1|8|Be in debt
OWL|1|0|"Wise old ___"
PAD|1|4|Notebook
PAN|1|4|Frying vessel
PAY|1|8|Hand over money
PEA|1|2|Small green pod seed
PEN|1|0|"The ___ is mightier than the sword"
PIE|1|0|"Easy as ___"
PIG|1|1|Farm animal that oinks
POT|1|4|Cooking vessel
PRO|1|8|Opposite of amateur
PUB|1|8|British local where friends meet for a meal
PUP|1|1|Young dog
RAM|1|1|Male sheep
RAT|1|0|"Smell a ___"
RAY|1|3|Beam of light
RED|1|0|"Roses are ___"
RIB|1|7|Bone in the chest
ROW|1|13|Use oars
RUG|1|4|Floor covering
RUN|1|8|Move quickly on foot
RYE|1|2|Grain used for dark bread
SAP|1|2|Sticky liquid inside a tree
SAW|1|4|Cutting tool with teeth
SAY|1|8|Speak
SEA|1|3|Large body of salt water
SEE|1|0|"Long time no ___"
SET|1|0|"Ready, ___, go!"
SHY|1|9|Timid
SIP|1|2|Small drink
SIR|1|7|Polite address for a man
SIS|1|7|Sibling, for short
SIT|1|8|Take a chair
SIX|1|8|Half a dozen
SKI|1|8|Glide on snow
SKY|1|0|"Blue ___ thinking"
SOD|1|3|Turf
SON|1|7|Male child
SOW|1|1|Female pig
SPA|1|8|Health resort with hot baths
SUM|1|8|Total of an addition
SUN|1|0|"Here comes the ___"
TAN|1|8|Sun-bronzed shade
TAP|1|4|Faucet, in Britain
TAX|1|8|Government charge on income
TEA|1|0|"___ for two"
TEE|1|8|Golf peg
TEN|1|8|Number of fingers
THE|1|8|Most common word in English
TIN|1|4|Metal can
TOE|1|7|Digit on a foot
TOM|1|1|Male cat
TOO|1|0|"Me ___!"
TOP|1|0|"On ___ of the world"
TOY|1|4|Plaything
TRY|1|8|Make an attempt
TUB|1|4|Bath
TWO|1|8|A pair
UFO|1|8|Flying saucer, for short
URN|1|4|Vase for ashes or a tea dispenser
USE|1|8|Put to work
VAN|1|4|Delivery vehicle
WAR|1|8|Armed conflict
WAS|1|8|Past form of "is"
WET|1|9|Not dry
WIG|1|4|Fake hair
WIN|1|0|"Play to ___"
WOW|1|8|Exclamation of amazement
YAK|1|1|Shaggy mountain ox
YAM|1|2|Sweet orange root vegetable
YES|1|8|Opposite of no
ZOO|1|8|Place to see lions and tigers
ACID|1|12|Sour chemical, opposite of base
ALPS|1|10|European mountain range
ALTO|1|11|Voice lower than soprano
ARIA|1|11|Solo in an opera
ASIA|1|10|The largest continent
ATOM|1|12|Tiny building block of matter
AUNT|1|5|Sister of a parent
BABY|1|5|Newborn
BACK|1|5|Spine's location
BAKE|1|6|Cook in an oven
BALL|1|0|"Play ___!"
BAND|1|11|Group of musicians
BARK|1|3|Tree's outer layer, or a dog's cry
BASE|1|12|Opposite of acid
BASS|1|1|Fish that bites a lure
BATH|1|10|Roman spa city in Somerset
BEAK|1|1|Bird's mouth
BEAM|1|3|Ray of light
BEAN|1|2|Seed in a chili
BEAR|1|1|Honey-loving forest giant
BEAT|1|11|Pulse of the music
BELL|1|4|It rings
BERN|1|10|Swiss capital
BIRD|1|0|"Early ___ catches the worm"
BOAR|1|1|Wild pig
BODY|1|5|Torso
BOIL|1|2|Heat water to 100 degrees Celsius
BONE|1|5|Skeleton part
BOOK|1|0|"Don't judge a ___ by its cover"
BOOT|1|10|British car trunk
BOWL|1|4|Cereal holder
BRAN|1|2|Husk of wheat
BROW|1|5|Forehead
BUSH|1|3|Shrub
BUSY|1|0|"___ as a bee"
CAKE|1|0|"Piece of ___"
CALF|1|1|Young cow
CALM|1|5|Peaceful
CAMP|1|10|Pitch a tent
CARD|1|4|Birthday greeting
CARP|1|1|Pond fish, or to complain
CASE|1|4|Suitcase or lawsuit
CAST|1|11|Actors in a show
CAVE|1|3|Hollow in a hillside
CELL|1|12|Basic unit of life
CHEW|1|6|Munch
CHIN|1|7|Part of the face below the mouth
CHIP|1|2|British fried potato
CITY|1|10|Metropolis
CLAP|1|6|Applaud
CLAY|1|3|Potter's earth
CLEF|1|11|Symbol at the start of a stave
CLUB|1|13|Golfer's tool
COAL|1|3|Black fuel dug from the ground
COAT|1|4|Winter outerwear
CODE|1|12|Computer instructions
COPY|1|6|Duplicate
CORN|1|2|Maize
COSY|1|9|Warm and snug
CRAB|1|1|Sideways walker on the shore
CROW|1|1|Black bird with a harsh caw
CUBA|1|10|Caribbean island nation
CURB|1|10|American kerb
DATA|1|12|Facts and figures
DATE|1|2|Sweet fruit from a palm
DAWN|1|3|First light of day
DECK|1|13|Pack of cards
DEEP|1|9|Far down
DEER|1|1|Graceful forest grazer
DESK|1|4|Office furniture
DICE|1|13|Rolled in games
DISH|1|2|Plate of food
DISK|1|12|Computer storage platter
DIVE|1|6|Plunge headfirst
DOOR|1|4|Entrance to a room
DOVE|1|1|Symbol of peace
DRAW|1|6|Sketch with a pencil
DRIP|1|6|Fall in drops
DRUM|1|11|Instrument you beat
DUCK|1|1|Quacking pond swimmer
DUET|1|11|Piece for two
DUNE|1|3|Sandy hill in a desert
DUSK|1|3|Evening twilight
DUST|1|3|Fine household powder
EASY|1|9|Not hard
ECHO|1|3|Sound that bounces back
EPIC|1|11|Long heroic poem or film
FACE|1|5|Front of the head
FAIR|1|9|Just and reasonable
FARM|1|3|Land with crops and animals
FAST|1|9|Speedy
FERN|1|3|Feathery shade plant
FILM|1|11|Movie
FINS|1|1|Fish's swimming aids
FIRE|1|0|"Where there's smoke, there's ___"
FIRM|1|9|Not soft
FISH|1|0|"Plenty more ___ in the sea"
FIST|1|5|Clenched hand
FLAT|1|9|Level and smooth
FLIP|1|6|Turn over
FLOW|1|3|Run like a river
FOAL|1|1|Young horse
FOAM|1|3|Froth on the waves
FOLD|1|6|Bend paper over
FOLK|1|11|Traditional music of the people
FOOD|1|2|What we eat
FOOT|1|5|Ankle's neighbour
FORK|1|4|Dinner utensil with prongs
FROG|1|1|Pond hopper that croaks
FUEL|1|12|Petrol or coal
FULL|1|9|Unable to hold more
GALE|1|3|Very strong wind
GAME|1|13|Match
GATE|1|4|Garden entrance
GENE|1|12|Unit of heredity
GIRL|1|5|Young female
GLAD|1|9|Pleased
GLEN|1|3|Narrow valley in Scotland
GLUE|1|4|Sticky stuff
GOAL|1|13|Football score
GOAT|1|1|Mountain climber with a beard
GOLD|1|0|"All that glitters is not ___"
GOLF|1|13|Sport with holes and tees
GRIN|1|5|Broad smile
GULL|1|1|Seaside bird that steals chips
HAIL|1|3|Frozen rain
HAIR|1|5|Locks
HALL|1|4|Entrance room
HAND|1|0|"Many ___s make light work"
HARD|1|9|Difficult
HARE|1|1|Fast, long-eared sprinter
HARP|1|11|Large plucked string instrument with a triangular frame
HAWK|1|1|Bird of prey with sharp eyes
HAZE|1|3|Light mist
HEAD|1|5|Top of the body
HEAT|1|3|Warmth
HEEL|1|5|Back of the foot
HELP|1|6|Lend a hand
HERB|1|2|Basil or mint
HIDE|1|6|Go out of sight
HILL|1|3|Smaller than a mountain
HIVE|1|1|Where bees live
HOME|1|0|"There's no place like ___"
HOOF|1|1|Horse's foot
HOOK|1|4|Peg for a coat
HORN|1|11|Brass instrument
HOSE|1|4|Garden watering tube
HUGE|1|9|Very big
IBEX|1|1|Wild mountain goat with curved horns
IDOL|1|11|Pop star admired by fans
IOWA|1|10|Corn state
IRAN|1|10|Country once called Persia
IRAQ|1|10|Country between Syria and Iran
IRON|1|4|Presser of shirts
JAZZ|1|11|Music born in New Orleans
JOKE|1|11|Something funny to say
JUDO|1|13|Martial art of throws
JUMP|1|6|Spring off the ground
KALE|1|2|Leafy green health vegetable
KEEN|1|9|Eager
KICK|1|13|Strike with the foot
KIND|1|9|Considerate
KITE|1|4|Toy that flies on a string
KNEE|1|5|Joint in the leg
KNOB|1|4|Door handle
LAKE|1|3|Still body of fresh water
LAMB|1|0|"Mary had a little ___"
LAMP|1|4|Bedside light
LAND|1|3|Where you stand, not the sea
LANE|1|10|Narrow country road
LAOS|1|10|Southeast Asian country between Vietnam and Thailand
LARD|1|2|Cooking fat from a pig
LARK|1|1|Songbird that rises at dawn
LATE|1|9|Not on time
LEAF|1|3|Green part of a branch
LEAN|1|6|Tilt
LENS|1|12|Part of a camera or glasses
LIFT|1|6|Raise up
LIMA|1|10|Peruvian capital
LIMB|1|5|Arm or leg
LIME|1|2|Green citrus fruit
LION|1|1|King of the jungle, they say
LOCK|1|4|Opens with a key
LOUD|1|9|Noisy
LOVE|1|0|"All you need is ___"
LUTE|1|11|Old plucked instrument
LYNX|1|1|Wild cat with tufted ears
LYRE|1|11|Ancient harp-like instrument
MAIL|1|4|Post
MALI|1|10|West African country
MANE|1|1|Lion's long hair
MARE|1|1|Female horse
MARS|1|12|The red planet
MASH|1|2|Crush potatoes
MEAL|1|2|Breakfast, lunch or dinner
MILD|1|9|Gentle, as weather
MILK|1|2|Drink from a cow
MIME|1|11|Silent actor
MIND|1|5|Thinker
MINT|1|2|Sweet leaf for tea or a breath freshener
MIST|1|3|Light fog
MOLE|1|1|Tunnelling garden digger
MOOD|1|5|State of feeling
MOON|1|0|"Once in a blue ___"
MOOR|1|3|Open, windswept upland
MOSS|1|3|Soft green carpet on stones
MOTH|1|1|Night-time cousin of the butterfly
MULE|1|1|Cross between a horse and a donkey
NAIL|1|4|Hammer's target
NEAR|1|9|Close by
NEAT|1|9|Tidy
NECK|1|5|Between head and shoulders
NEON|1|12|Gas in glowing signs
NEST|1|0|"Empty ___ syndrome"
NEWT|1|1|Small salamander
NILE|1|10|Longest river in Africa
NOSE|1|5|Sniffer
NOTE|1|4|Short written message
OHIO|1|10|Midwest state with a buckeye tree
OKRA|1|2|Green pods used in gumbo
OMAN|1|10|Gulf country on the Arabian Sea
ONCE|1|0|"___ upon a time"
OPEN|1|6|Not shut
ORCA|1|1|Black-and-white whale with a tall fin
OSLO|1|10|Norwegian capital
OVEN|1|4|Kitchen baker
PAGE|1|4|One side of a leaf in a book
PAIL|1|4|Bucket
PALE|1|9|Light in colour
PALM|1|5|Inside of the hand
PARK|1|4|Green space in a town
PATH|1|4|Walking route
PAWS|1|1|Cat's feet
PEAK|1|3|Mountain's top
PEAR|1|2|Fruit shaped a little like a bell
PEAS|1|2|Little green pod seeds
PEEL|1|6|Remove the skin
PERU|1|10|Home of Machu Picchu
PINE|1|3|Evergreen with needles, or to long for
PLAN|1|4|Scheme
PLAY|1|6|Have fun
PLUM|1|2|Purple fruit
POEM|1|11|Verse
POET|1|11|Writer of verse
POKE|1|6|Prod
POND|1|3|Small garden pool
PONY|1|1|Small horse
POOL|1|13|Swimming place
POOR|1|9|Having little money
POST|1|4|British mail
POUR|1|6|Tip liquid from a jug
PULL|1|6|Tug
PURE|1|9|Not mixed
PUSH|1|6|Shove
QUIT|1|6|Give up
RACE|1|13|Run for the finish
RAIN|1|0|"Come ___ or shine"
RARE|1|9|Uncommon
READ|1|6|Look at the words in a book
REED|1|3|Tall water plant
REEF|1|3|Coral ridge under the sea
REST|1|6|Take a break
RICE|1|2|Grain served with curry
RICH|1|9|Wealthy
RIDE|1|6|Travel on a bike
RIGA|1|10|Latvian capital
ROAD|1|0|"Hit the ___"
ROCK|1|3|Stone
ROLE|1|11|Actor's part
ROLL|1|6|Turn over and over
ROME|1|10|Eternal City
ROOF|1|4|Top of a house
ROOM|1|4|Space in a house
ROOT|1|3|Part of a plant underground
ROPE|1|4|Thick cord
ROSE|1|0|"A ___ by any other name"
SACK|1|4|Large bag
SAFE|1|9|Free from danger
SAGE|1|2|Herb that can also mean wise
SALT|1|0|"Take it with a pinch of ___"
SAND|1|3|Beach material
SEAL|1|1|Flippered swimmer that barks
SEAT|1|4|Place to sit
SEED|1|2|Plant starter
SHED|1|4|Garden storage hut
SHIN|1|7|Front of the lower leg
SHIP|1|8|Large sea vessel
SHOP|1|4|Place to buy things
SHOW|1|6|Display
SIGH|1|6|Breathe out deeply
SING|1|6|Use your voice musically
SINK|1|4|Kitchen basin
SKIN|1|5|Body covering
SLAM|1|6|Shut loudly
SLOW|1|9|Not fast
SLUG|1|1|Garden pest with no shell
SNOW|1|0|"White as ___"
SOAP|1|4|Bath bar
SOCK|1|4|Foot covering
SOFA|1|4|Living-room seat for several
SOFT|1|9|Gentle to the touch
SOIL|1|3|Garden dirt
SOLO|1|11|Performed alone
SONG|1|11|It has a tune and words
SOUP|1|2|Tomato or chicken starter
SOUR|1|9|Sharp-tasting like lemon
SPIN|1|6|Twirl
STAG|1|1|Male deer
STAR|1|0|"Twinkle, twinkle, little ___"
STAY|1|6|Remain
STEW|1|2|Slow-cooked meal of meat and vegetables
STIR|1|6|Mix with a spoon
STOP|1|6|Halt
SWAN|1|1|Long-necked white bird
SWIM|1|6|Move through the water
TAIL|1|1|Dog's wagging part
TALL|1|9|Not short
TAPE|1|4|Sticky roll
TART|1|2|Sour, or a small open pie
TAXI|1|10|Cab
TEAM|1|13|Group playing together
TEAR|1|5|Drop from an eye
TEAS|1|2|Afternoon drinks
TENT|1|4|Camper's shelter
THAW|1|3|Melt after a frost
THIN|1|9|Not fat
TIDE|1|3|Rise and fall of the sea
TIDY|1|9|Neat
TILE|1|4|Bathroom floor square
TIME|1|0|"A stitch in ___ saves nine"
TINY|1|9|Very small
TOAD|1|1|Warty relative of the frog
TOFU|1|2|Soy curd
TOGO|1|10|Small West African nation
TOSS|1|6|Throw lightly
TOUR|1|10|Guided trip
TOWN|1|8|Bigger than a village
TRAM|1|10|Streetcar
TRAY|1|4|Serving platter
TREE|1|0|"Money doesn't grow on ___s"
TRIP|1|6|Stumble
TRUE|1|9|Not false
TUNA|1|1|Large fish found in sandwiches
TUNE|1|11|Melody
TWIG|1|3|Small branch
TWIN|1|5|One of a matching pair of siblings
TYNE|1|10|River through Newcastle
UTAH|1|10|Salt Lake state
VASE|1|4|Flower holder
VAST|1|9|Immense
VINE|1|3|Grape plant
VOLT|1|12|Unit of electric force
VOTE|1|6|Cast a ballot
WAIT|1|6|Stay until something happens
WAKE|1|6|Stop sleeping
WALK|1|6|Stroll
WALL|1|4|Brick barrier
WARM|1|9|Pleasantly hot
WASP|1|1|Stinging yellow-and-black insect
WATT|1|12|Unit of power
WAVE|1|6|Greet with a hand
WEAK|1|9|Feeble
WELL|1|4|Water source dug in the ground
WIDE|1|9|Broad
WIFE|1|5|Married woman
WILD|1|9|Not tame
WIND|1|3|Moving air
WING|1|1|Part a bird flaps
WINK|1|6|Flash an eye
WIRE|1|12|Thin metal thread carrying current
WISE|1|9|Having good judgement
WOLF|1|1|Howling wild canine
WOOD|1|3|Forest material
WORD|1|0|"Mum's the ___"
WORM|1|1|Wriggler in the soil
WREN|1|1|Tiny brown garden bird
YARD|1|4|Garden, in the US
YAWN|1|5|Sleepy gape
YELL|1|6|Shout
YORK|1|10|English city with a famous Minster
ZERO|1|4|Nothing
ZONE|1|12|Area
ACTOR|1|11|Performer on stage
ADDER|1|1|Venomous British snake
AGREE|1|0|Share the same opinion
ALARM|1|4|Warning bell
ANDES|1|10|South American mountain range
ANGRY|1|9|Cross
ANKLE|1|5|Joint above the foot
APPLE|1|2|Fruit that keeps the doctor away
ARGUE|1|6|Quarrel
ATOMS|1|12|Building blocks of matter
ATTIC|1|4|Room under the roof
BACON|1|2|Crispy breakfast rashers
BAGEL|1|2|Ring-shaped bread roll
BASIN|1|4|Washbowl
BEACH|1|10|Sandy shore
BEARD|1|5|Facial hair
BEGIN|1|6|Start
BELLS|1|11|Tower instruments that ring out
BELLY|1|5|Tummy
BENCH|1|4|Park seat
BERRY|1|2|Small juicy fruit
BISON|1|1|Shaggy American grassland giant
BLADE|1|4|Cutting edge
BLINK|1|6|Close and open the eyes fast
BLOOD|1|5|Red fluid in the veins
BRAID|1|6|Plait
BRAIN|1|5|Organ for thinking
BRAVE|1|9|Fearless
BREAD|1|2|Loaf
BREAK|1|6|Smash, or a rest
BRIEF|1|9|Short
BROAD|1|9|Wide
BROOK|1|3|Small stream
BROOM|1|4|Sweeper
BROTH|1|2|Thin soup
BRUSH|1|4|Painter's or tooth tool
BUGLE|1|11|Brass horn used by the army
BUILD|1|6|Put together
CABIN|1|4|Small wooden hut
CAIRO|1|10|Egypt's capital
CAMEL|1|1|Desert ship with a hump
CANDY|1|0|American sweets
CARRY|1|6|Bear in the arms
CARVE|1|11|Shape wood or stone
CATCH|1|6|Grab a ball
CELLO|1|11|Large string instrument held between the knees
CHAIN|1|4|Linked metal loops
CHAIR|1|4|Seat with a back
CHALK|1|11|Teacher's writing stick
CHASE|1|6|Run after
CHEAP|1|9|Low in price
CHEEK|1|5|Part of the face that blushes
CHESS|1|13|Game of kings and queens
CHEST|1|5|Where the heart sits
CHILD|1|5|Young person
CHILE|1|10|Long, thin South American country
CHINA|1|10|Land of the Great Wall
CHOIR|1|11|Group of singers
CHORD|1|11|Notes played together
CLEAN|1|6|Scrub until spotless
CLEAR|1|9|Easy to see through
CLIFF|1|3|Steep rock face
CLIMB|1|6|Go up a ladder
CLOCK|1|4|Wall timekeeper
CLOSE|1|6|Shut
CLOUD|1|3|Grey rain-bearer
CLOWN|1|11|Circus joker
COACH|1|13|Team trainer
COAST|1|3|Where the land meets the sea
COBRA|1|1|Hooded snake
COCOA|1|2|Hot chocolate powder
COLOR|1|11|Red or blue, American style
COMIC|1|11|Funny performer
CORAL|1|3|Reef builder
COUNT|1|6|Say one, two, three
CRAWL|1|6|Move on hands and knees
CREAM|1|2|Rich dairy topping
CREEK|1|3|Small stream, in America
CRISP|1|2|British potato snack
CROON|1|11|Sing softly
CROWD|1|5|Large gathering
CRUSH|1|6|Squash flat
CURLY|1|9|Not straight, as hair
DANCE|1|6|Move to music
DARTS|1|13|Game of throwing at a round board
DELHI|1|10|Indian capital region
DERBY|1|10|English city, also a horse race
DIARY|1|4|Daily journal
DONUT|1|2|Fried ring with a hole
DOVER|1|10|English port with white cliffs
DRAKE|1|1|Male duck
DRAMA|1|5|Theatre piece
DREAM|1|6|Sleeping vision
DRINK|1|6|Take a sip
DRIVE|1|6|Steer a car
DRYER|1|4|Machine for damp clothes
EAGLE|1|14|Soaring bird of prey
EARLY|1|9|Ahead of time
EARTH|1|12|Our planet
EASEL|1|11|Artist's stand
EGYPT|1|10|Land of the pyramids
ELBOW|1|5|Arm joint
EMPTY|1|9|Containing nothing
ENTER|1|6|Come in
EQUAL|1|9|The same in value
EXTRA|1|9|More than needed
FAINT|1|9|Barely noticeable
FANCY|1|9|Elaborate
FENCE|1|4|Garden boundary
FERRY|1|10|Boat that carries cars across water
FETCH|1|6|Go and bring back
FIELD|1|13|Pitch
FIGHT|1|6|Struggle against someone
FINAL|1|13|Last match of a tournament
FLOAT|1|6|Stay on top of the water
FLOOD|1|3|Overflow of water
FLOOR|1|4|What you walk on indoors
FLOUR|1|2|Ground wheat for baking
FLUTE|1|11|Woodwind you blow across
FORCE|1|12|Push or pull
FRAME|1|11|Border around a picture
FRESH|1|9|Newly made
FRONT|1|9|Opposite of back
FROST|1|3|Icy coating on a cold morning
GECKO|1|1|Small climbing lizard
GENRE|1|11|Category of art
GHANA|1|10|West African country on the Gulf of Guinea
GIANT|1|5|Very large being in a fairy tale
GLAZE|1|11|Shiny coating on pottery
GLIDE|1|6|Slide smoothly
GLOBE|1|12|Model of the Earth
GRAND|1|9|Impressive
GRAPE|1|2|Fruit that grows in bunches on a vine
GRASP|1|6|Take hold of
GRASS|1|3|Lawn cover
GRAVY|1|2|Roast dinner sauce
GREAT|1|9|Terrific
GREEN|1|9|Colour of grass
GREET|1|6|Say hello to
GRILL|1|2|Cook over direct heat
GROSS|1|9|Disgusting, or total before deductions
GROVE|1|3|Small wood
GUARD|1|6|Keep watch over
GUESS|1|6|Estimate without knowing
GUEST|1|5|Visitor
GULLY|1|3|Narrow channel cut by water
HAPPY|1|9|Joyful
HEART|1|0|"Home is where the ___ is"
HEAVY|1|9|Weighty
HERON|1|1|Tall wading bird
HOBBY|1|0|Pastime
HONEY|1|2|Sweet gold from the hive
HORSE|1|0|"Don't look a gift ___ in the mouth"
HOTEL|1|10|Place for guests to sleep
HUMAN|1|5|Person
HURRY|1|6|Rush
HYENA|1|1|Laughing scavenger of Africa
IDAHO|1|10|Potato state
INDIA|1|10|Country of the Taj Mahal
ISLET|1|3|Tiny island
ITALY|1|10|Boot-shaped country
JAPAN|1|10|Land of the rising sun
JELLY|1|2|Wobbly dessert
JEWEL|1|14|Gem
JOLLY|1|9|Cheerful
JUDGE|1|6|Referee in a courtroom
KENYA|1|10|East African safari country
KNEEL|1|6|Go down on one knee
KNOCK|1|6|Rap on a door
KOALA|1|1|Eucalyptus eater from Australia
LADLE|1|4|Soup spoon
LARGE|1|9|Big
LASER|1|12|Narrow beam of light
LAUGH|1|5|Chuckle
LEARN|1|6|Pick up knowledge
LEAVE|1|6|Depart
LEEDS|1|10|Yorkshire city
LEMON|1|2|Citrus fruit used in lemonade
LEMUR|1|1|Ring-tailed primate of Madagascar
LEVEL|1|9|Flat and even
LIGHT|1|6|Not heavy, or a lamp
LLAMA|1|1|Andean pack animal
LOCAL|1|9|Nearby
LORRY|1|10|British truck
LUCKY|1|9|Fortunate
LUNGS|1|5|Breathing organs
LYRIC|1|11|Words of a song
MAGIC|1|11|Tricks with a wand
MAINE|1|10|Lobster state
MAJOR|1|9|Important
MANGO|1|2|Sweet tropical fruit
MARCH|1|6|Walk in step, or a spring month
MARSH|1|3|Wetland
MATCH|1|13|Contest
MAYBE|1|0|Perhaps
MEDAL|1|13|Prize on a ribbon
MELON|1|2|Large juicy summer fruit
MERRY|1|9|Cheerful and festive
METAL|1|12|Iron or copper
METRO|1|10|Underground railway
MODEL|1|12|Miniature copy
MONTH|1|0|January or June
MOOSE|1|1|Largest deer
MOTOR|1|12|Engine
MOUTH|1|5|Where food goes in
MURAL|1|11|Wall painting
MUSIC|1|11|It's made of notes
NEPAL|1|10|Home of Mount Everest
NIECE|1|5|Sister's daughter
NOBLE|1|9|Of high rank or fine character
NOISY|1|9|Loud
NOVEL|1|0|Long work of fiction
OASIS|1|3|Desert watering place
OCEAN|1|3|Atlantic or Pacific
OFFER|1|6|Put forward
OLIVE|1|2|Small fruit in a martini
ONION|1|2|Layered bulb that brings tears
OPERA|1|11|Sung drama
ORBIT|1|12|Path around a planet
ORDER|1|6|Place a request at a restaurant
ORGAN|1|11|Instrument with pipes and pedals
OTHER|1|9|Different
OTTER|1|1|Playful river swimmer
PAINT|1|6|Cover a wall with colour
PANDA|1|1|Bamboo-munching bear
PARIS|1|10|City of Light
PASTA|1|2|Italian staple
PAUSE|1|6|Stop for a moment
PEACH|1|2|Fuzzy summer fruit
PERTH|1|10|Scottish city, or a city in Australia
PHONE|1|12|Handheld communicator
PIANO|1|11|Keys and hammers
PITCH|1|11|Highness or lowness of a note
PIZZA|1|2|Round Italian takeaway
PLACE|1|6|Put down
PLAIN|1|9|Simple
PLANE|1|10|Aircraft
PLANT|1|12|Living thing with roots
PLATE|1|4|Dinner dish
PLUCK|1|6|Pick a flower
POINT|1|13|Unit of score
PRAWN|1|2|Large shrimp
PRESS|1|6|Push on a button
PRIDE|1|5|Feeling of satisfaction
PRISM|1|12|Splitter of light into colours
PRIZE|1|13|Reward
PROSE|1|11|Ordinary writing, not verse
PROUD|1|9|Pleased with an achievement
PULSE|1|12|Throb of the heart
PUNCH|1|2|Fruity party drink
QUAIL|1|1|Small game bird
QUEUE|1|10|British line
QUICK|1|9|Fast
QUIET|1|9|Silent
QUILL|1|11|Old feather pen
RADAR|1|12|Detector of aircraft
RADIO|1|4|Wireless set
RAISE|1|6|Lift up
RAPID|1|9|Swift
RAVEN|1|1|Large black bird in a famous poem
RAZOR|1|4|Shaving tool
REACH|1|6|Stretch to get
READY|1|9|Prepared
RELAX|1|0|Take it easy
RELAY|1|13|Race passing a baton
RHYME|1|11|Poem's matching sounds
RIDGE|1|3|Long narrow hilltop
RIGHT|1|9|Correct
RINSE|1|6|Wash lightly with water
RIVER|1|3|Thames or Mississippi
ROAST|1|6|Cook in the oven, as a turkey
ROBIN|1|1|Red-breasted garden bird
ROBOT|1|12|Mechanical helper
ROUGH|1|9|Not smooth
ROUND|1|9|Like a ball
ROUTE|1|10|Way from A to B
ROYAL|1|9|Fit for a king or queen
RUGBY|1|13|Game with an oval ball
RUSTY|1|9|Corroded by wet
SALAD|1|2|Lettuce and tomato dish
SAUCE|1|2|Liquid dressing for food
SCARE|1|6|Give a fright
SCARF|1|4|Neck warmer
SCENE|1|11|Part of an act
SCONE|1|2|Teatime bake served with jam and cream
SCORE|1|11|Written music
SCRUB|1|6|Clean hard
SEINE|1|10|River through Paris
SEOUL|1|10|South Korean capital
SHAKE|1|6|Tremble, or mix a drink
SHARE|1|6|Give part of what you have
SHARP|1|9|Keen-edged
SHEEP|1|0|"Counting ___ to fall asleep"
SHELF|1|4|Board for books
SHIRT|1|14|Top with a collar
SHORE|1|3|Edge of the sea
SHORT|1|9|Not tall
SHOUT|1|6|Yell
SHRUG|1|6|Raise your shoulders
SKATE|1|6|Glide on ice
SKUNK|1|1|Black animal with a white stripe and a smell
SLEEP|1|6|Have a nap
SLEET|1|3|Half snow, half rain
SLICE|1|2|Cut piece of bread
SLIDE|1|6|Playground feature
SMALL|1|9|Little
SMART|1|9|Clever
SMELL|1|6|Use your nose
SMILE|1|6|Show happiness
SNEAK|1|6|Creep quietly
SOLAR|1|12|Of the sun
SOLID|1|9|Not hollow
SOLVE|1|6|Work out a puzzle
SORRY|1|9|Apologetic
SOUND|1|12|Something you hear
SPACE|1|12|The final frontier
SPAIN|1|10|Country of flamenco
SPARE|1|9|Extra
SPARK|1|12|Tiny flash of fire
SPEAK|1|6|Talk
SPEED|1|0|Rate of motion
SPEND|1|6|Use up money
SPINE|1|5|Backbone
SPLIT|1|6|Divide
SPOON|1|4|Soup utensil
SPORT|1|13|Physical competition
STAGE|1|11|Place for actors
STAIR|1|4|One step in a flight
STAND|1|6|Be on your feet
START|1|6|Begin
STEAL|1|6|Take without permission
STEAM|1|12|Hot water vapour
STEEP|1|9|Rising sharply
STEER|1|6|Guide a ship
STERN|1|9|Strict
STICK|1|6|Twig, or to glue
STILL|1|9|Not moving
STOOL|1|4|Seat with no back
STORK|1|1|Long-legged bird in baby stories
STORM|1|3|Thunder and lightning event
STORY|1|11|Tale
STOUT|1|9|Rather fat
STOVE|1|4|Cooker
STUDY|1|6|Revise for a test
SUGAR|1|0|Sweetener
SUNNY|1|9|Bright with sunshine
SWAMP|1|3|Boggy forest
SWEEP|1|6|Clean with a broom
SWEET|1|9|Sugary
SWIFT|1|9|Speedy
SWING|1|6|Move back and forth
SYRUP|1|2|Sweet topping for pancakes
TABLE|1|0|"Turn the ___s"
TASTE|1|6|Sample a flavour
TASTY|1|9|Delicious
TEACH|1|6|Educate
TEETH|1|5|Chompers
TEMPO|1|11|Speed of the music
TENOR|1|11|High male singing voice
TEXAS|1|10|Lone Star State
THEME|1|11|Main subject
THICK|1|9|Not thin
THINK|1|6|Use your brain
THROW|1|6|Toss
THUMB|1|5|Short, thick finger
TIGER|1|14|Striped big cat
TIGHT|1|9|Not loose
TIMER|1|12|Kitchen countdown device
TOAST|1|2|Browned bread
TOKYO|1|10|Japanese capital
TOUCH|1|6|Feel with the fingers
TOUGH|1|9|Hard to chew
TOWEL|1|4|Dries you after a bath
TRACK|1|6|Footprints to follow
TRADE|1|6|Swap goods
TRAIL|1|10|Hiking path
TRAIN|1|6|Locomotive with carriages
TREAD|1|6|Walk heavily
TREAT|1|2|Special goodie
TRUCK|1|10|American lorry
TWIST|1|6|Turn around
UNCLE|1|5|Brother of a parent
UNDER|1|0|Beneath
UNITE|1|6|Bring together
UPPER|1|9|Higher
VIOLA|1|11|Slightly larger cousin of the violin
VIPER|1|1|Poisonous snake
VISIT|1|6|Call on
VOCAL|1|11|Of the voice
VOICE|1|5|What you speak or sing with
WALES|1|10|Land of dragons and daffodils
WALTZ|1|11|Dance in three-four time
WATCH|1|6|Look at, or wristwatch
WATER|1|0|"Fish out of ___"
WEAVE|1|6|Make cloth on a loom
WHALE|1|1|Giant of the ocean
WHITE|1|9|Colour of snow
WORRY|1|0|Fret
WRIST|1|5|Joint below the hand
WRITE|1|6|Put pen to paper
YEAST|1|2|Makes dough rise
YIELD|1|6|Give way
YOUNG|1|9|Not old
ZEBRA|1|1|Horse in pyjamas
ABSENT|1|0|Not present
ACCEPT|1|0|Take what is offered
ACTION|1|14|Doing something
ACTIVE|1|0|Busy and lively
ADVICE|1|14|Counsel
AFFORD|1|0|Have enough money for
ALASKA|1|10|Largest US state
ALMOST|1|0|Nearly
ALWAYS|1|0|At all times
AMAZON|1|10|Giant South American river
AMOUNT|1|0|Quantity
ANIMAL|1|14|Creature
ANSWER|1|6|Reply to a question
ARCTIC|1|3|Very cold region at the top of the world
ARRIVE|1|0|Reach a destination
ARTIST|1|14|Painter or sculptor
ATHENS|1|10|Greek capital
ATTACH|1|0|Fasten to
ATTEND|1|0|Be present at
AUTUMN|1|3|Season of falling leaves
BADGER|1|1|Black-and-white burrower that comes out at night
BAKERY|1|0|Where bread is made
BALLET|1|11|Dance on tiptoe
BANANA|1|14|Curved yellow fruit
BARREL|1|14|Cask
BASKET|1|14|Woven carrier
BEAUTY|1|14|Loveliness
BECOME|1|0|Grow to be
BEETLE|1|1|Insect with hard wing cases
BEHAVE|1|0|Act politely
BERLIN|1|10|German capital
BESIDE|1|0|Next to
BETTER|1|14|Superior
BORROW|1|0|Take with the intention of returning
BOTTLE|1|14|Glass container for milk
BOTTOM|1|0|Lowest part
BOUNCE|1|6|Spring back
BREATH|1|5|Air in and out
BREEZE|1|3|Gentle wind
BRIDGE|1|10|Crossing over a river
BRIGHT|1|9|Shining
BROKEN|1|0|Smashed
BUBBLE|1|0|Soap film filled with air
BUCKET|1|14|Pail
BUCKLE|1|4|Belt fastener
BURGER|1|2|Patty in a bun
BUTTER|1|14|Spread for bread
BUTTON|1|14|Shirt fastener
CAMERA|1|14|Photographer's device
CANADA|1|10|Maple leaf country
CANDLE|1|4|Light made of wax
CANVAS|1|11|Painter's cloth
CANYON|1|3|Deep gorge cut by a river
CARPET|1|14|Fitted floor covering
CARROT|1|2|Orange root that rabbits love
CASTLE|1|14|Fortress with towers
CAVERN|1|14|Large cave
CELERY|1|2|Crunchy green stalk
CENTER|1|14|Middle, in America
CENTRE|1|14|Middle, in Britain
CEREAL|1|2|Breakfast bowl filler
CHANCE|1|0|Opportunity or luck
CHANGE|1|0|Coins returned after paying
CHEEKS|1|5|Rosy parts of the face
CHEESE|1|14|Cheddar or Brie
CHERRY|1|14|Small red stone fruit
CINEMA|1|14|Place to watch films
CIRCLE|1|14|Round shape
CIRCUS|1|11|Big top show
CLEVER|1|9|Smart
CLOSET|1|0|American wardrobe
COFFEE|1|14|Morning brew from beans
COLOUR|1|11|Red or blue, British style
COMMON|1|0|Ordinary or shared
COOKIE|1|2|American biscuit
CORNER|1|0|Where two walls meet
COUSIN|1|5|Aunt's or uncle's child
COYOTE|1|1|Prairie howler of North America
CRAYON|1|14|Waxy colouring stick
CREATE|1|0|Make something new
DANGER|1|14|Peril
DANUBE|1|10|River through Vienna and Budapest
DECADE|1|0|Ten years
DECIDE|1|14|Make up your mind
DEFEND|1|0|Protect from attack
DEPEND|1|0|Rely
DESERT|1|3|Dry sandy land
DESIGN|1|0|Plan for how something looks
DETAIL|1|14|Small point
DIMPLE|1|5|Small dent in the cheek
DINNER|1|14|Evening meal
DIRECT|1|0|Straight
DIVIDE|1|14|Split up
DOCTOR|1|14|One who treats the sick
DOLLAR|1|0|American currency unit
DONKEY|1|1|Sturdy grey beast of burden
DOUBLE|1|0|Twice as much
DRAGON|1|14|Fire-breathing beast
DRAWER|1|14|Sliding furniture compartment
DUBLIN|1|10|Irish capital
DURING|1|0|Throughout
ELEVEN|1|0|One more than ten
EMPIRE|1|0|Realm ruled by one power
ENERGY|1|14|Get-up-and-go
ENGINE|1|14|It powers a car
ENOUGH|1|14|As much as needed
ENTIRE|1|0|Whole
ESCAPE|1|0|Break free
EXETER|1|10|Devon cathedral city
EXPECT|1|0|Look forward to
FABRIC|1|0|Cloth
FAMILY|1|14|Parents and children
FAMOUS|1|0|Well known
FARMER|1|14|Grower of crops
FASTEN|1|14|Secure
FERRET|1|1|Long, lithe relative of the weasel
FINGER|1|5|Digit on a hand
FLIGHT|1|14|Journey by air
FLOWER|1|14|Bloom
FOLLOW|1|6|Go behind
FOREST|1|14|Large wood
FORGET|1|0|Fail to remember
FORMER|1|0|Previous
FOURTH|1|0|After the third
FRANCE|1|10|Country with the Eiffel Tower
FRIDAY|1|14|Last working day of the week
FRIDGE|1|4|Cold food store
FRIEND|1|5|Companion
GARAGE|1|4|Car shelter
GARDEN|1|14|Plot with flowers and vegetables
GARLIC|1|14|Pungent bulb used in cooking
GATHER|1|6|Collect
GENTLE|1|14|Mild and kind
GERBIL|1|1|Small desert pet rodent
GIFTED|1|0|Talented
GINGER|1|14|Spicy root, or red-haired
GLANCE|1|0|Quick look
GLOVES|1|14|Hand warmers
GOLDEN|1|14|Like the precious metal
GROUND|1|14|Earth's surface
GROWTH|1|0|Increase in size
GUITAR|1|11|Instrument with six strings
HAMMER|1|4|Nail driver
HANDLE|1|14|Part you grip
HANGER|1|4|Coat holder in a wardrobe
HAPPEN|1|0|Take place
HARBOR|1|10|Port, American style
HEALTH|1|14|Fitness
HELMET|1|14|Head protector
HIDDEN|1|0|Out of sight
HOCKEY|1|13|Stick sport on ice or grass
HONEST|1|0|Truthful
HUMBLE|1|9|Modest
HUNGRY|1|14|Wanting food
HUNTER|1|0|One who pursues game
IGUANA|1|1|Large tropical lizard
INSECT|1|14|Ant or beetle
INSIDE|1|14|Within
INVENT|1|14|Come up with something new
INVITE|1|0|Ask to a party
ISLAND|1|10|Land surrounded by water
JACKAL|1|1|Wild dog of Africa and Asia
JACKET|1|4|Short coat
JAGUAR|1|1|Spotted big cat of South America
JUNGLE|1|14|Dense tropical forest
JUNIOR|1|0|Younger
KETTLE|1|14|Tea boiler
KNIGHT|1|14|Medieval warrior on horseback
LADDER|1|14|Climbing aid
LAGOON|1|3|Shallow sea lake
LEADER|1|0|Head of a group
LEAGUE|1|13|Group of competing teams
LEAVES|1|3|Autumn carpet
LEGEND|1|14|Famous old story
LENGTH|1|0|How long something is
LENTIL|1|2|Small pulse used in soup
LESSON|1|14|Class period
LETTER|1|14|Written message, or A to Z character
LIKELY|1|0|Probable
LISBON|1|10|Portuguese capital
LISTEN|1|6|Pay attention to sounds
LITTLE|1|0|Small
LIVELY|1|9|Full of energy
LIZARD|1|1|Scaly sunbather
LOCATE|1|0|Find the position of
LOCKER|1|4|Storage cabinet at school
LONDON|1|10|Capital on the Thames
LOVELY|1|0|Delightful
MADRID|1|10|Spanish capital
MAGNET|1|12|It attracts iron
MAGPIE|1|1|Black-and-white bird that likes shiny things
MANAGE|1|0|Be in charge of
MANNER|1|0|Way of doing something
MARBLE|1|14|Polished stone, or a game ball
MARKET|1|14|Place with stalls
MATTER|1|12|Stuff that has mass
MEADOW|1|3|Grassy field
MELODY|1|0|Tune
MEMBER|1|0|Part of a club
MEMORY|1|14|Ability to recall
MIDDLE|1|14|Centre
MIGHTY|1|9|Powerful
MINNOW|1|1|Tiny freshwater fish
MINUTE|1|0|Sixty seconds
MIRROR|1|4|Glass that shows your face
MODERN|1|9|Up to date
MONKEY|1|14|Tree-swinging primate
MOTHER|1|14|Female parent
MUFFIN|1|2|Small cake baked in a cup
MUSEUM|1|14|Place to see exhibits
MUSSEL|1|1|Shellfish served in a pot
NAPKIN|1|14|Table cloth for your lap
NARROW|1|0|Not wide
NATURE|1|14|The outdoors
NEARBY|1|0|Close at hand
NEPHEW|1|5|Brother's son
NEVADA|1|10|State with Reno and Las Vegas
NINETY|1|0|Nine tens
NOODLE|1|2|Long strand of pasta
NOTICE|1|6|Spot
NUMBER|1|14|Digit
OBJECT|1|14|Thing
OBTAIN|1|0|Get
OFFICE|1|0|Place of work
OMELET|1|2|Folded eggs
ORANGE|1|14|Citrus fruit and colour
ORIGIN|1|0|Where something starts
OUTLET|1|4|Wall socket
OXFORD|1|10|University city on the Thames
OXYGEN|1|12|Gas we breathe
OYSTER|1|1|Shellfish that may hold a pearl
PALACE|1|14|Royal home
PARCEL|1|0|Package sent by post
PARENT|1|5|Mum or dad
PARROT|1|14|Talking bird
PEANUT|1|14|Legume often salted
PEBBLE|1|3|Small smooth stone
PENCIL|1|11|Graphite writer
PEOPLE|1|14|Humans
PEPPER|1|2|Bell or chili
PERSON|1|14|Individual
PETROL|1|10|British gasoline
PICKLE|1|2|Vegetable preserved in vinegar
PICNIC|1|14|Meal on the grass
PIGEON|1|1|City bird that coos
PILLOW|1|4|Place to rest your head
PLANET|1|12|Earth or Mars
PLAYER|1|13|Team member
PLEASE|1|0|Polite word
PLENTY|1|14|A lot
POCKET|1|14|Pouch in trousers
POLICE|1|14|Law enforcers
POLITE|1|9|Well-mannered
POSSUM|1|1|Marsupial that plays dead
POSTER|1|0|Large printed notice
POTATO|1|14|Chip's source
POWDER|1|0|Fine dust
PRETTY|1|14|Attractive
PRINCE|1|0|Son of a king
PROPER|1|0|Suitable and correct for the occasion
PUDDLE|1|3|Small pool of rain
PUFFIN|1|1|Colourful-beaked seabird
PUPPET|1|14|Doll on strings
PUZZLE|1|14|Brainteaser
RABBIT|1|14|Long-eared hopper
RACKET|1|13|Tennis tool
RAISIN|1|2|Dried grape
RAPIDS|1|3|Fast, rough water
RATHER|1|0|Somewhat
REALLY|1|0|Truly
REASON|1|0|Cause
RECENT|1|0|Not long ago
RECIPE|1|0|Cook's instructions
RECORD|1|0|Disc, or the best score
REFUSE|1|0|Say no
REGION|1|0|Part of a country
REMAIN|1|0|Stay behind
REPAIR|1|0|Fix
REPEAT|1|0|Say again
REPORT|1|0|Account of events
RESCUE|1|0|Save from danger
RESULT|1|0|Outcome
RETURN|1|0|Come back
REWARD|1|0|Prize for good work
RHYTHM|1|11|Regular beat
RIBBON|1|14|Narrow band of fabric
RIDDLE|1|0|Puzzling question
SADDLE|1|4|Seat on a horse
SAFETY|1|0|Freedom from harm
SAHARA|1|10|Giant desert
SAILOR|1|14|Sea traveller
SALMON|1|1|Fish that leaps up waterfalls
SAMPLE|1|0|Small taste
SCHOOL|1|14|Place of learning
SCRIPT|1|11|Written text of a play
SEARCH|1|14|Look for
SEASON|1|14|Spring, summer, autumn or winter
SECOND|1|14|Next after the first
SECRET|1|0|Not to be told
SELDOM|1|0|Rarely
SETTLE|1|0|Make a home
SHADOW|1|14|Dark shape cast by the sun
SHOVEL|1|4|Digging tool
SHRIMP|1|1|Small pink shellfish
SIGNAL|1|14|Warning light or sign
SILENT|1|9|Without noise
SILVER|1|14|Shiny grey metal
SIMPLE|1|9|Not complicated
SINGLE|1|0|Only one
SISTER|1|14|Female sibling
SKETCH|1|11|Quick drawing
SLEEPY|1|0|Ready for bed
SMOOTH|1|9|Not rough
SNEEZE|1|6|Achoo
SPIDER|1|14|Web spinner
SPIRIT|1|0|Pep and courage
SPOKEN|1|0|Said aloud
SPONGE|1|4|Absorbent bath item
SPRING|1|3|Season of blossom, or a water source
SQUARE|1|14|Shape with four equal sides
SQUASH|1|13|Racket game in a walled court
STAPLE|1|4|Paper fastener
STATUE|1|11|Sculpture of a figure
STEADY|1|0|Firm and stable
STREAM|1|3|Small river
STREET|1|10|Road with houses
STROLL|1|6|Walk for pleasure
STRONG|1|9|Mighty
STUDIO|1|11|Artist's workroom
SUDDEN|1|9|Unexpected
SUMMER|1|14|Warmest season
SUNDAY|1|14|Day of rest for many
SUNSET|1|3|End of the day
SUPPER|1|14|Evening snack
SUPPLY|1|0|Provide
SURELY|1|0|Without doubt
SYSTEM|1|0|Set of connected parts
TALENT|1|0|Natural gift
TEAPOT|1|4|Brewing vessel
TEMPER|1|5|Fit of anger
TEMPLE|1|14|Side of the forehead
TENNIS|1|13|Game with a racket and a net
THAMES|1|10|London's river
THIRTY|1|0|Three tens
THREAD|1|4|Sewing line
THROAT|1|5|Gullet
TICKET|1|4|Entry pass
TIPTOE|1|6|Walk quietly on your toes
TOMATO|1|14|Red salad fruit
TONGUE|1|5|Taster in the mouth
TRAVEL|1|6|Go on a journey
TROPHY|1|13|Cup for the winner
TUNDRA|1|3|Frozen treeless plain
TUNNEL|1|10|Passage through a hill
TURKEY|1|1|Big bird at a feast
TURTLE|1|14|Slow reptile with a shell
TWELVE|1|14|A dozen
TWENTY|1|0|Score
UMPIRE|1|13|Cricket official
UNIQUE|1|14|One of a kind
UNLESS|1|0|Except if
UPWARD|1|0|Toward the sky
USEFUL|1|9|Handy
VACUUM|1|4|Cleaner with suction
VALLEY|1|14|Low area between hills
VIENNA|1|10|Austrian capital
VIOLET|1|14|Purple flower
VIOLIN|1|11|Fiddle
VOYAGE|1|10|Long sea trip
WAFFLE|1|2|Grid-patterned breakfast cake
WAITER|1|14|Restaurant server
WALLET|1|4|Holder of notes and cards
WALRUS|1|1|Tusked seal-like giant of the Arctic
WANDER|1|6|Roam
WEALTH|1|0|Riches
WEASEL|1|1|Slender hunter that goes pop
WILLOW|1|3|Tree that weeps
WINDOW|1|4|Glass in a wall
WINTER|1|14|Coldest season
WIZARD|1|14|Spell caster
WONDER|1|14|Marvel
WRITER|1|14|Author
YELLOW|1|14|Colour of a lemon
YOGURT|1|2|Cultured milk dessert
ABANDON|1|0|Leave behind for good
ABILITY|1|0|Skill
ACADEMY|1|0|School for special training
ADMIRAL|1|0|Naval commander
ADVANCE|1|0|Move forward
ADVISER|1|0|Counsellor
AIRPORT|1|10|Place with runways
ANCIENT|1|14|Very old
ANOTHER|1|0|One more
ANTENNA|1|0|American aerial
APRICOT|1|2|Soft orange fruit
ARRANGE|1|0|Put in order
ARTICLE|1|0|Piece in a newspaper
ATHLETE|1|0|Sportsperson
AVERAGE|1|0|Typical amount
AVOCADO|1|2|Green fruit for guacamole
BALANCE|1|0|Even distribution of weight
BALLOON|1|14|Party item that floats
BARGAIN|1|0|Item sold cheaply
BEDROOM|1|14|Where you sleep
BELIEVE|1|0|Accept as true
BETWEEN|1|0|In the middle of two
BICYCLE|1|14|Two-wheeler you pedal
BISCUIT|1|14|British cookie
BLANKET|1|14|Bed cover
BLOSSOM|1|14|Spring flower on a tree
BROTHER|1|14|Male sibling
CABBAGE|1|14|Round leafy vegetable
CAPTAIN|1|0|Leader of a ship or team
CAREFUL|1|0|Taking care
CARTOON|1|0|Animated film
CEILING|1|14|Room's top surface
CENTURY|1|0|One hundred years
CHANNEL|1|14|Strait between England and France
CHAPTER|1|0|Section of a book
CHEETAH|1|1|Fastest land animal
CHICKEN|1|14|Roast dinner bird
CHIMNEY|1|0|Smoke outlet on a roof
CLASSIC|1|0|Timeless example
CLIMATE|1|14|Weather over many years
CLOTHES|1|4|What we wear
COLLEGE|1|0|School after school
COMFORT|1|0|Ease and relief
COMPANY|1|14|Business, or guests
COMPARE|1|0|Look at the similarities between
COMPASS|1|10|Needle that points north
CONCERT|1|0|Live music show
CONTENT|1|0|Satisfied
CONTROL|1|0|Power over something
COTTAGE|1|14|Small country home
COUNCIL|1|0|Local governing body
COUNTER|1|0|Shop worker's table
COUNTRY|1|14|Nation
COURAGE|1|0|Bravery
CRICKET|1|13|Game of bat, ball and wickets
CRYSTAL|1|14|Clear, glittering mineral
CURIOUS|1|0|Eager to know
CURRENT|1|0|Happening now
CURTAIN|1|4|Window covering
CUSHION|1|4|Soft seat pad
CUSTARD|1|2|Yellow sauce for pudding
DARLING|1|0|Dear one
DELIGHT|1|0|Great pleasure
DESSERT|1|14|Pudding course
DIAMOND|1|0|Hard sparkling gem
DISTANT|1|0|Far away
DOLPHIN|1|14|Clever sea mammal
DOORMAT|1|4|Welcome place for feet
DRIZZLE|1|3|Very fine rain
ENDLESS|1|0|Without end
ENGLISH|1|0|Language of Shakespeare
EVENING|1|14|Time after the afternoon
EXACTLY|1|0|Precisely
EXAMPLE|1|0|Instance
EXCITED|1|0|Thrilled
EXPLAIN|1|0|Make clear
EXPLORE|1|0|Travel to discover
EXTREME|1|0|Very great
EYEBROW|1|5|Hair above the eye
FASHION|1|0|Style in clothes
FEATHER|1|14|Light part of a bird's coat
FINALLY|1|0|At last
FLOWING|1|0|Moving like a stream
FOREIGN|1|0|From another country
FREEDOM|1|0|Liberty
FURTHER|1|0|Beyond
GALLERY|1|0|Place to see pictures
GARBAGE|1|0|American rubbish
GENUINE|1|0|Real
GIRAFFE|1|0|Tallest animal
GLACIER|1|0|River of ice
GORILLA|1|1|Largest of the apes
GRAVITY|1|12|What keeps us on the ground
GROCERY|1|0|Food shop
HAMSTER|1|1|Pet with cheek pouches
HARBOUR|1|10|Port, British style
HEADING|1|0|Title above a section
HEALTHY|1|0|Fit and well
HIGHWAY|1|0|Main road
HISTORY|1|0|The study of the past
HOLIDAY|1|14|Time off, British vacation
HORIZON|1|0|Where the sky meets the sea
HUNDRED|1|0|Ten times ten
IMAGINE|1|0|Picture in your mind
IMPROVE|1|0|Make better
INCLUDE|1|0|Contain as part
INSPIRE|1|0|Fill with the urge to create
INSTEAD|1|0|In place of
IRELAND|1|10|The Emerald Isle
JANUARY|1|0|First month
JOURNAL|1|0|Daily record
JOURNEY|1|10|Long trip
KETCHUP|1|2|Tomato sauce
KINGDOM|1|0|Realm of a monarch
KITCHEN|1|14|Where meals are cooked
KNUCKLE|1|5|Finger joint
LANTERN|1|14|Portable lamp
LARGEST|1|0|Biggest
LAUNDRY|1|4|Dirty clothes pile
LEISURE|1|0|Free time
LIBERTY|1|0|Freedom
LIBRARY|1|14|Place to borrow books
LIGHTER|1|0|Not so heavy
LOBSTER|1|1|Red shellfish with claws
LONGEST|1|0|Most lengthy
MACHINE|1|0|Mechanical device
MEANING|1|0|What a word expresses
MEASURE|1|6|Find the size of
MEDICAL|1|0|Of doctors
MESSAGE|1|0|Note sent to someone
MISTAKE|1|0|Error
MONSOON|1|3|Seasonal rain wind of Asia
MORNING|1|14|Time before noon
MYSTERY|1|0|Puzzling affair
NATURAL|1|0|Not artificial
NEITHER|1|0|Not one or the other
NOTHING|1|0|Not a thing
OCTOBER|1|0|Month of falling leaves
ORCHARD|1|0|Field of fruit trees
OSTRICH|1|1|Largest living bird
OUTDOOR|1|0|Done in the open air
OUTSIDE|1|14|Not indoors
PACKAGE|1|0|Parcel
PAINTER|1|0|Artist with a brush
PANCAKE|1|0|Flat breakfast treat
PATTERN|1|0|Repeated design
PELICAN|1|1|Bird with a large throat pouch
PENGUIN|1|0|Bird of the ice that cannot fly
PERFECT|1|0|Without fault
PERHAPS|1|0|Maybe
PICTURE|1|0|Image on a wall
PLUMBER|1|4|Pipe fixer
POPCORN|1|2|Cinema snack
POPULAR|1|0|Well liked
PORTION|1|0|Share of food
PRAIRIE|1|3|Grassland of the American Midwest
PRESENT|1|0|Gift
PRIVATE|1|0|Not public
PROBLEM|1|0|Difficulty
PROGRAM|1|0|American plan or show
PROMISE|1|6|Give your word
PROTECT|1|0|Keep safe
PROTEST|1|0|March against something
PROVIDE|1|0|Supply
PUDDING|1|14|British dessert
PUMPKIN|1|0|Large orange gourd
QUARTER|1|0|Fourth part
QUIETLY|1|0|In a hushed way
RACCOON|1|1|Masked bandit of the night
RAINBOW|1|14|Arc of colours after a shower
REALISE|1|0|Understand fully
RECEIVE|1|0|Be given
REFEREE|1|13|Match official
REFLECT|1|0|Mirror back
REGULAR|1|0|Normal
RESPECT|1|0|High regard
RESPOND|1|0|Answer
REVOLVE|1|0|Turn round
SAUSAGE|1|2|Banger
SAVANNA|1|3|African grassland
SCIENCE|1|0|Study of nature
SCRATCH|1|0|Rub with nails
SECTION|1|0|Part of a whole
SERIOUS|1|0|Not joking
SERVICE|1|0|Help given
SEVERAL|1|0|More than two
SHELTER|1|0|Place of safety
SILENCE|1|14|Total quiet
SIMILAR|1|0|Alike
SLIPPER|1|4|Soft house shoe
SMALLER|1|0|Not as big
SNOWMAN|1|0|Winter figure with a carrot nose
SOCIETY|1|0|People living together
SOLDIER|1|0|Army member
SOMEONE|1|0|A person
SPARROW|1|1|Small, common brown bird
SPEAKER|1|0|One who talks, or a loudspeaker
SPECIAL|1|0|Out of the ordinary
SPINACH|1|2|Leafy green that made a sailor strong
SQUEEZE|1|0|Press tightly
STADIUM|1|0|Large sports ground
STATION|1|10|Place where trains stop
STICKER|1|4|Adhesive label
STOMACH|1|5|Digesting organ
STORAGE|1|0|Place to keep things
STRANGE|1|14|Odd
STRETCH|1|6|Reach out
STUDENT|1|0|Learner
SUBJECT|1|0|Topic
SUCCESS|1|0|Winning result
SUPPORT|1|14|Hold up
SUPPOSE|1|0|Guess
SURFACE|1|14|Outer layer
SWEATER|1|14|Knitted pullover
TEACHER|1|14|Classroom leader
THEATER|1|0|American playhouse
THEATRE|1|0|British playhouse
THIRSTY|1|0|Needing a drink
THOUGHT|1|14|Idea
THROUGH|1|0|From one end to the other
THUNDER|1|14|Rumble after lightning
TOASTER|1|4|Bread browner
TONIGHT|1|14|This evening
TORNADO|1|3|Funnel of wind
TOURIST|1|0|Sightseer
TOWARDS|1|0|In the direction of
TRACTOR|1|0|Farm vehicle
TRAFFIC|1|0|Cars on the road
TRAILER|1|4|Towed vehicle
TREACLE|1|2|Dark, sticky syrup
TROUBLE|1|0|Bother or worry
TRUMPET|1|0|Brass horn
TUESDAY|1|14|Day after Monday
TURNING|1|0|Bend in the road
UNUSUAL|1|0|Rare
USUALLY|1|0|Most of the time
VARIETY|1|0|Range of types
VEHICLE|1|0|Car or bus
VERSION|1|0|Edition
VICTORY|1|0|Win
VILLAGE|1|10|Small country settlement
VINEGAR|1|2|Sour liquid for chips
VISITOR|1|0|Guest
VOLCANO|1|3|Mountain that erupts
WARNING|1|0|Notice of danger
WEATHER|1|14|Rain or shine
WEDDING|1|14|Marriage ceremony
WEEKEND|1|14|Saturday and Sunday
WELCOME|1|0|Greet gladly
WESTERN|1|0|Of the sun's setting side
WHISPER|1|5|Very soft speech
WHISTLE|1|14|Blow to call a dog
WILLING|1|0|Ready to help
WORKING|1|0|Not idle
WRINKLE|1|5|Line on the skin
WRITTEN|1|0|Put down on paper
ABUNDANT|1|0|Plentiful
ACTUALLY|1|0|In fact
ADDITION|1|0|Sum
ADEQUATE|1|0|Good enough
AIRPLANE|1|0|American aircraft
ALLIANCE|1|0|Union of partners
ALTHOUGH|1|0|Even though
ANCESTOR|1|0|Forebear
APPETITE|1|0|Desire for food
ATTITUDE|1|0|Outlook
AUDIENCE|1|0|People watching a show
BACKYARD|1|0|Garden behind the house
BAGPIPES|1|0|Scottish instrument
BARGAINS|1|0|Items sold cheaply
BEDSHEET|1|0|Cover for a mattress
BEGINNER|1|0|Novice
BIRTHDAY|1|0|Day for cake and candles
BLIZZARD|1|3|Heavy snowstorm
BLOSSOMS|1|0|Flowers on a tree
BOOKCASE|1|0|Shelves for novels
BRAINIAC|1|0|Very clever person
BRIGHTEN|1|0|Make more cheerful
BUILDING|1|0|Structure with walls and a roof
CALENDAR|1|0|Chart of the months
CAMPSITE|1|0|Place to pitch tents
CARDIGAN|1|0|Buttoned knitted jacket
CARNIVAL|1|0|Festival with parades
CHAMPION|1|0|Winner
CHARCOAL|1|0|Black drawing stick
CHEERFUL|1|0|In good spirits
CHEMICAL|1|0|Substance in a lab
CLEANING|1|0|Dusting and polishing
CLEVERLY|1|0|In a smart way
COMPLETE|1|0|Finished
COMPUTER|1|0|Laptop or desktop
CONTRACT|1|0|Signed agreement
COOKBOOK|1|0|Recipe collection
CORRIDOR|1|0|Hallway
COVERAGE|1|0|News reporting
CUPBOARD|1|0|Kitchen storage unit
DAUGHTER|1|14|Female child
DAYLIGHT|1|0|Light of the sun
DECEMBER|1|0|Last month
DESCRIBE|1|0|Tell what something is like
DICTATOR|1|0|Absolute ruler
DINOSAUR|1|0|Prehistoric giant reptile
DIRECTOR|1|0|Person who guides a film
DISASTER|1|0|Terrible event
DISCOVER|1|0|Find out
DOCUMENT|1|0|Official paper
DOMINOES|1|0|Spotted tiles
DOORBELL|1|0|Visitor's button
DOWNTOWN|1|0|City centre, in America
DRESSING|1|0|Salad topping
ELECTION|1|0|Time to vote
ELECTRIC|1|12|Powered by current
ELEPHANT|1|0|Large animal with a trunk
ELEVATOR|1|10|American lift
ENGINEER|1|0|Designer of machines
ENORMOUS|1|0|Huge
ENTRANCE|1|0|Way in
ENVELOPE|1|0|Letter's cover
EVERYDAY|1|0|Ordinary
EXCHANGE|1|0|Swap
EXERCISE|1|0|Physical training
EXPLORER|1|0|Traveller to unknown lands
FAIRNESS|1|0|Justice
FAMILIAR|1|0|Often seen before
FAVORITE|1|0|American best-loved
FEBRUARY|1|0|Shortest month
FOOTBALL|1|0|Game with a goal
FOOTPATH|1|0|Walkway
FORECAST|1|0|Weather prediction
FRACTION|1|0|Half or quarter
FRIENDLY|1|0|Warm and kind
GENEROUS|1|0|Giving freely
GOLDFISH|1|0|Pet in a bowl
GRADUATE|1|0|Finish university
GRANDSON|1|0|Child of your child
GRATEFUL|1|0|Thankful
GUARDIAN|1|0|Protector
HANDSOME|1|0|Good-looking
HARDWARE|1|0|Tools and fittings
HEADLINE|1|0|Newspaper title
HILLSIDE|1|3|Slope of a hill
HOMEWORK|1|0|Task for after school
HOSPITAL|1|0|Place for the sick
HUMANITY|1|0|All people
HUMOROUS|1|0|Funny
INDUSTRY|1|0|Manufacturing
INTEREST|1|0|Curiosity
INTERNET|1|0|Worldwide network
ISLANDER|1|0|Person from a small land in the sea
KEYBOARD|1|0|Piano or computer input
KINDNESS|1|0|Gentle care
LANDLORD|1|0|Owner of a rented house
LANGUAGE|1|0|English, French or Hindi
LAUGHING|1|0|Giggling
LAUGHTER|1|14|Sound of fun
LEMONADE|1|0|Sour-sweet fizzy drink
MACARONI|1|0|Tubes of pasta
MAGAZINE|1|0|Glossy periodical
MARATHON|1|0|Long running race
MATERIAL|1|0|Cloth or substance
MATTRESS|1|4|Bed cushion
MEDICINE|1|0|Remedy
MIDNIGHT|1|0|Twelve at night
MINISTER|1|0|Government official
MOUNTAIN|1|0|Very high hill
MUSICIAN|1|0|Player of a tune
NAVIGATE|1|0|Find the way
NECKLACE|1|0|Chain round the throat
NOTEBOOK|1|0|Pad for jottings
NOVEMBER|1|0|Month before December
NUMEROUS|1|0|Many
OFFICIAL|1|0|Authorised
OPPOSITE|1|0|Facing across
ORDINARY|1|0|Not special
ORGANISE|1|0|Arrange
OUTSIDER|1|0|Not part of the group
OVERCOAT|1|0|Warm outdoor garment
PAINTING|1|0|Picture in oils
PARADISE|1|0|Perfect place
PASSPORT|1|10|Document for crossing borders
PATIENCE|1|0|Calm waiting
PAVEMENT|1|0|British sidewalk
PEACEFUL|1|0|Calm
PERSONAL|1|0|Private
PHYSICAL|1|0|Of the body
PLEASANT|1|0|Enjoyable
PORTRAIT|1|11|Picture of a person
POSITION|1|0|Place
POSSIBLE|1|0|Able to happen
POSTCARD|1|0|Holiday message
PRACTICE|1|0|Training session
PRINCESS|1|0|Daughter of a queen
PROBABLY|1|0|Most likely
PRODUCER|1|0|Maker
PROGRESS|1|0|Forward movement
PROPERTY|1|0|Land and buildings
PURCHASE|1|0|Buy
QUESTION|1|0|Query
RAINCOAT|1|0|Waterproof jacket
RAINDROP|1|0|Single bead of a shower
RELATIVE|1|0|Family member
REMEMBER|1|0|Keep in mind
REPUBLIC|1|0|State without a monarch
RESEARCH|1|0|Careful study
ROMANTIC|1|0|Full of love
SANDWICH|1|0|Bread with a filling
SATURDAY|1|14|Weekend day
SCHEDULE|1|0|Timetable
SCISSORS|1|0|Cutters with two blades
SEASHORE|1|0|Beach
SENTENCE|1|0|Words that make a statement
SHOULDER|1|0|Joint beneath the neck
SIDEWALK|1|10|American pavement
SLIPPERS|1|0|Soft indoor shoes
SOLUTION|1|0|Answer to a puzzle
SOMEBODY|1|0|An unnamed individual
SOUTHERN|1|0|Of the south
SPLENDID|1|0|Magnificent
SPORTING|1|0|Fair-minded
SQUIRREL|1|14|Acorn collector
STANDARD|1|0|Normal level
STARTING|1|0|Beginning
STRAIGHT|1|0|Not curved
STRENGTH|1|0|Power
SUITABLE|1|0|Right for the purpose
SUITCASE|1|0|Luggage
SUNSHINE|1|0|Bright daylight
SURPRISE|1|0|Unexpected thing
SURROUND|1|0|Encircle
SWIMMING|1|0|Pool activity
SYMPHONY|1|0|Orchestral work
TEACHING|1|0|Giving lessons
TERRIFIC|1|0|Wonderful
THANKFUL|1|0|Grateful
THOUSAND|1|0|Ten hundred
TOGETHER|1|0|As one group
TOMORROW|1|0|The day after today
TRAVELER|1|0|One who journeys
TREASURE|1|0|Hidden riches
TRIANGLE|1|14|Three-sided shape
TROPICAL|1|0|Of the hot zone near the equator
TRUSTING|1|0|Believing in others
UMBRELLA|1|4|Rain shelter
UNIVERSE|1|0|All of space
UPSTAIRS|1|0|On a higher floor
VACATION|1|0|American holiday
VALUABLE|1|0|Worth a lot
VERTICAL|1|0|Straight up and down
VILLAGER|1|0|Country settler
WAITRESS|1|0|Female server
WARDROBE|1|0|Clothes cupboard
WHATEVER|1|0|No matter what
WHENEVER|1|0|At any time
WHEREVER|1|0|In any place
WILDLIFE|1|0|Animals in nature
WINDMILL|1|0|Tower with sails
WOODLAND|1|0|Area of trees
WORKSHOP|1|0|Place for making things
YOURSELF|1|0|You, reflexively
ASTRONAUT|1|0|Space traveller
BALLERINA|1|0|Dancer on tiptoe
BREAKFAST|1|0|Morning meal
BRILLIANT|1|0|Very bright or very clever
BUTTERFLY|1|0|Colourful insect with wings
CATALOGUE|1|0|Illustrated list of goods
CELEBRATE|1|0|Mark a happy day
CHOCOLATE|1|14|Sweet made from cocoa
CLASSROOM|1|0|Where pupils learn
COMMUNITY|1|0|People of one area
DELICIOUS|1|0|Tasty
DETECTIVE|1|0|Crime solver
DIFFERENT|1|0|Not the same
EDUCATION|1|0|Schooling
EMERGENCY|1|0|Urgent situation
EQUIPMENT|1|14|Gear
FAVOURITE|1|0|British best-loved
FIREWORKS|1|0|Night sky display
FURNITURE|1|0|Chairs and tables
GENTLEMAN|1|0|Polite man
GEOGRAPHY|1|0|Study of the Earth
GRASSLAND|1|0|Prairie
HAIRBRUSH|1|0|Tool for tidying locks
HAPPINESS|1|0|Joy
HOSPITALS|1|0|Places for the sick
HURRICANE|1|0|Violent tropical storm
IMPORTANT|1|0|Of great value
INVENTION|1|0|New creation
JEWELLERY|1|0|British gems and rings
KNOWLEDGE|1|0|What we learn
LANDSCAPE|1|0|Painting of the countryside
LANGUAGES|1|0|English, French and others
LIGHTNING|1|0|Flash in a storm
MARKETING|1|0|Promoting goods
MARMALADE|1|2|Orange preserve
MEANWHILE|1|0|At the same time
MOONLIGHT|1|0|Night glow
MOUNTAINS|1|0|Alps and Andes
NEIGHBOUR|1|0|Person next door
PARAGRAPH|1|0|Block of text
PASSENGER|1|0|Person on a bus
PINEAPPLE|1|0|Spiky tropical fruit
PRESIDENT|1|0|Elected leader
SATELLITE|1|0|Moon or space probe
SEPTEMBER|1|0|Month before October
SIGNATURE|1|0|Name written by hand
SNOWFLAKE|1|0|Winter crystal
SOMEWHERE|1|0|In some place
SPAGHETTI|1|0|Long pasta strands
STATEMENT|1|0|Declaration
STORYBOOK|1|0|Tales for bedtime
TELEPHONE|1|0|Landline device
TELESCOPE|1|0|Star-gazing tube
THEREFORE|1|0|For that reason
TRADITION|1|0|Custom
TRANSPORT|1|0|Moving people or goods
VEGETABLE|1|0|Carrot or pea
WATERFALL|1|0|Cascade
WEDNESDAY|1|0|Midweek day
WONDERFUL|1|0|Marvellous
YESTERDAY|1|0|The day before today
YOUNGSTER|1|0|Child
DRAWBRIDGE|1|0|Castle entrance that lifts
EARTHQUAKE|1|0|Violent shaking of the ground
FLASHLIGHT|1|0|American torch
FRIENDSHIP|1|0|Bond between pals
GREENHOUSE|1|0|Glass garden building
HELICOPTER|1|0|Aircraft with rotors
HORIZONTAL|1|0|Level with the ground
INCREDIBLE|1|0|Hard to believe
LIGHTHOUSE|1|0|Tower guiding ships
LITERATURE|1|0|Written works of art
PLAYGROUND|1|0|Place for swings
STRAWBERRY|1|0|Red summer fruit
TOOTHBRUSH|1|0|Cleaner for teeth
VOCABULARY|1|0|All the words you know
TEMPERATURE|1|0|How hot or cold
UNDERGROUND|1|0|British subway
WHEELBARROW|1|0|Garden cart with one wheel
THUNDERSTORM|1|0|Rain with lightning`;
export const WORDS = new Map();
for (const line of RAW.split('\n')) { const [w, tier, cat, ...c] = line.split('|'); WORDS.set(w, { w, tier: +tier, cat: +cat, clue: c.join('|') }); }
