# Changelog

## 1.1.0

Twenty-two new games, which makes thirty-seven.

### New

- **Circles of Hell**, a rhythm game played with the pointer: circles appear to the music, each one is
  clicked as its ring closes on it, and sliders are followed to their end.
- **Soul Catcher**, a rhythm game without a single click: squares fly at you down a tunnel, and the cursor
  has to be on the right cell of the grid when each one arrives.
- **Hellword**: guess a five-letter word in six tries, in English or in Russian. Each language has a winning
  streak of its own, and a round that was left unfinished is still there the next time.
- **Mahjong** solitaire with two layouts, hints, shuffle and undo. Every deal can be won.
- **Hell Pong**: first to seven, against the computer on three levels or against a friend on the same screen.
- A casino for play money. Everybody gets 1,000 souls, and whoever runs out gets 1,000 more; souls cannot be
  bought or cashed out. **Soul Slots** has three reels, **Soul Dice** lets you choose your own odds, and in
  **Soul Mines** every tile you open raises the prize until a skull takes it.
- **Beat Maker**: switch on squares to build a loop of drums, bass and melody. The beat is saved in the
  browser.
- **Sandbox**: pour sand, water, oil and lava, build with stone and wood, and set it on fire.
- **Name Forge** makes up nicknames, fantasy names and words that only sound real, in English and Russian.
- Buttons above the list of games show one kind of game at a time, and the new games wear a "New" badge.

### Changed

- The games are in a new order and have new kinds: Skill, Rhythm, Words, Puzzle, Arcade, Casino, Creative.
- The addresses in the page point to the repository under its new name, HELLGAMES.

### Fixed

- On a narrow phone the name of a game is no longer cut short in the header ("Memory Match", "Whack-a-Mole").
- Helltype: the hint about the wrong keyboard layout also shows up when the words being typed are short.

### For developers

- `js/synth.js` is the synthesizer that used to live inside Key Mania; `js/rhythm.js` and `js/casino.js`
  hold what the rhythm games and the casino games share.
- A game can now declare `bestLabel`, `since` and `defaultVariant()`, save a best score in the middle of a
  round with `api.record()`, and read the character that was really typed from `char` in a key event.
- The word lists of Hellword are in `js/data/hellword.js`, with their licences beside them. They are loaded
  when the game is first opened and kept for offline use from the first visit.
- The unit tests are split into one file for each kind of game.

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
