# Changelog

## 1.1.0

Twenty-seven new games, which makes forty-two.

### New

Rhythm

- **Circles of Hell**, played with the pointer: circles appear to the music, each one is clicked as its
  ring closes on it, and sliders are followed to their end.
- **Soul Catcher**, a rhythm game without a single click: squares fly at you down a tunnel, and the cursor
  has to be on the right cell of the grid when each one arrives. Every note of the tune has a square of its
  own, and quick notes come as snakes of squares that wind across the grid.
- A fourth level, **Hell**, in all three rhythm games, with a tune at 172 beats a minute. Hard itself is
  harder in Circles of Hell and Soul Catcher: streams of circles, leaps across the grid, less time to see
  them coming.

Board and cards

- **Chess**, the whole game: against the computer on three levels, or two players at one board. Moves can
  be taken back, the board can be turned, and a game that is left unfinished is still there next time.
- **Durak**, the card game of the fool, against the devil.
- **Rock Paper Scissors** against a devil who learns your habits.

Arcade

- **Hell Run**: a little devil runs through hell, faster and faster, jumping flames and ducking fireballs.
- **Brimstone**: catch the souls that rain down and keep out of the way of the burning rocks.
- **Hell Pong**: first to seven, against the computer on three levels or against a friend on the same screen.

Puzzles

- **Hellgems**, a match-three with chains, for thirty moves or sixty seconds.
- **Mahjong** solitaire with two layouts, hints, shuffle and undo. Every deal can be won.
- **Lava Pipes**: turn the pieces of pipe until the lava reaches every one of them.
- **Labyrinth**: a new maze every time, and a devil that runs on to the next fork at one push.
- **Untangle**: drag the knots of a web until no line crosses another.

Words

- **Hellword**: guess a five-letter word in six tries, in English or in Russian. Each language has a winning
  streak of its own, a round that was left unfinished is still there the next time, and a word of your own
  can be sent to a friend as a link.

Skill

- **Hold the Angle**, for players of tactical shooters: somebody leans out of cover, and whoever fires first
  wins the duel.
- **One Tap**, for the same players: the sights hold a gap at head height and do not move, somebody runs
  across, and one click at the right moment is a headshot. The gap can be narrow, medium or wide, and the
  runners have one of four speeds or, with Random, each a speed of its own. Every combination keeps a
  best score of its own.
- **Last Hit**, for players of MOBAs: strike the blow that finishes a creep, with a sword or with a bow.
- **Stroop Test**: the word says one colour, the ink is another, and the ink is what counts.
- **Odd One Out**: one tile of the field is not like the others.
- **Sens Converter** carries a mouse sensitivity from one shooter to another. It knows 45 games, from
  Valorant, Counter-Strike 2, Apex Legends and Fortnite to Marvel Rivals, Deadlock and THE FINALS, finds
  them through a search box, and takes its numbers from sensitivitymatch.com.

Casino

- A casino for play money. Everybody gets 1,000 souls, and whoever runs out gets 1,000 more; souls cannot be
  bought or cashed out. **Soul Slots** has three reels, **Soul Dice** lets you choose your own odds, in
  **Soul Mines** every tile you open raises the prize until a skull takes it, and **Blackjack** is played
  against a dealer who stands on 17.

Creative

- **Beat Maker**: switch on squares to build a loop of drums, bass and melody. The beat is saved in the
  browser.
- **Sandbox**: pour sand, water, oil and lava, build with stone and wood, and set it on fire.
- **Name Forge** makes up nicknames, fantasy names and words that only sound real, in English and Russian.

The site

- Buttons above the list of games show one kind of game at a time, and the new games wear a "New" badge.
- The scores can be saved to a file and loaded from one, at the bottom of the home page: the way to take
  them to another device, since the site has no accounts.

### Changed

- The games are in a new order and have new kinds: Skill, Rhythm, Words, Puzzle, Arcade, Tabletop, Casino,
  Creative.
- The addresses in the page point to the repository under its new name, HELLGAMES.

### Fixed

- On a narrow phone the name of a game is no longer cut short in the header: a long one gets smaller letters.
- Helltype: the hint about the wrong keyboard layout also shows up when the words being typed are short.

### For developers

- `js/synth.js` is the synthesizer that used to live inside Key Mania; `js/rhythm.js`, `js/casino.js` and
  `js/cards.js` hold what the rhythm games, the casino games and the card games share; `js/chess.js` is the
  rules of chess and the computer that plays it.
- A game can now declare `bestLabel`, `since`, `noRestart` and `defaultVariant()`, save a best score in the
  middle of a round with `api.record()`, read what follows a question mark in its address from `api.query`,
  and read the character that was really typed from `char` in a key event.
- The word lists of Hellword are in `js/data/hellword.js`, with their licences beside them. They are loaded
  when the game is first opened and kept for offline use from the first visit.
- The unit tests are split into one file for each kind of game, and every new game has a test that plays it
  in a real browser.

## 1.0.0

The first release.

### New

- **Helltype**, a typing-speed test: 15, 30 or 60 seconds of English or Russian words, scored in words per
  minute, with accuracy and a count of the words that went wrong. It works with the keyboard of a phone too.
- **Offline support.** After the first visit the site opens without a connection, and it can be installed as
  an app from the browser.
- A link to the source code in the header and in the footer of the home page.
- A title, a description and a picture for links shared in messengers and on social networks.
- The version of the site is shown at the bottom of the home page.

### Changed

- **A new look.** The whole site is darker and lit from below by fire, and it has a new icon: a horned
  gamepad.
- Three games have new names: **Helltris**, **Hell-Man** and **Helly Bird**. Best scores saved under the
  old names carry over, and links to the old addresses still open the right game.
- **Helly Bird** is redrawn: a little devil flies between pillars of rock over a lake of lava.
- **Whack-a-Mole** is redrawn: little devils look out of lava pits.
- The maze of **Hell-Man** glows red instead of blue.

### For developers

- The project is under the MIT licence.
- `tools/` holds a local server, tests for the rules of the games and for the site in a real browser, and
  the scripts that render the icon, the sharing picture and the screenshots.
- `tailwind.css` is generated with `npm run css` and no longer contains rules that nothing uses.
