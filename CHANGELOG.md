# Changelog

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
