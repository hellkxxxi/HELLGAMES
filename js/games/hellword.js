import { copyText, drawIcons } from '../util.js';

// ---------------------------------------------------------------- rules
export const TRIES = 6, LENGTH = 5;
export const LANGS = {
  en: { name: 'English', rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] },
  ru: { name: 'Русский', rows: ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'] },
};

// Marks every letter of a guess: 'hit' is the right letter in the right place, 'near' a letter of the
// word in another place, 'miss' a letter the word does not have. A letter that the word has once is
// marked once, however many times the guess repeats it.
export function judge(guess, answer) {
  const g = [...guess], a = [...answer], marks = g.map(() => 'miss'), spare = {};
  a.forEach((ch, i) => { if (g[i] === ch) marks[i] = 'hit'; else spare[ch] = (spare[ch] || 0) + 1; });
  g.forEach((ch, i) => { if (marks[i] !== 'hit' && spare[ch] > 0) { marks[i] = 'near'; spare[ch]--; } });
  return marks;
}

// One round. `accepts(word)` says whether a word may be tried. Earlier guesses can be handed in to
// carry on with a round that was left unfinished.
export function createRound(answer, accepts, earlier = []) {
  const rank = { miss: 1, near: 2, hit: 3 };
  const r = { answer, guesses: [], typed: '', keys: {}, won: false, over: false };
  function take(word) {
    const marks = judge(word, answer);
    r.guesses.push({ word, marks });
    [...word].forEach((ch, i) => { if (!r.keys[ch] || rank[marks[i]] > rank[r.keys[ch]]) r.keys[ch] = marks[i]; });
    r.won = word === answer;
    r.over = r.won || r.guesses.length >= TRIES;
    return marks;
  }
  r.type = (ch) => { if (!r.over && r.typed.length < LENGTH) r.typed += ch; };
  r.erase = () => { r.typed = r.typed.slice(0, -1); };
  // Hands the typed word in. Answers 'short', 'unknown', or 'ok' when the word was taken.
  r.submit = () => {
    if (r.over) return 'over';
    if (r.typed.length < LENGTH) return 'short';
    if (!accepts(r.typed)) return 'unknown';
    take(r.typed); r.typed = '';
    return 'ok';
  };
  for (const word of earlier) if (!r.over && word.length === LENGTH) take(word);
  return r;
}

// ---------------------------------------------------------------- a word of one's own, sent as a link
const ALPHABET = { en: 'abcdefghijklmnopqrstuvwxyz', ru: 'абвгдежзийклмнопрстуфхцчшщъыьэюя' };
// What somebody typed, as a word the game can use: lower case, "ё" spelled "е". Null if it is not
// exactly five letters of the language.
export function ownWord(text, lang) {
  const word = String(text).trim().toLowerCase().replace(/ё/g, 'е');
  return [...word].length === LENGTH && [...word].every((ch) => ALPHABET[lang].includes(ch)) ? word : null;
}
// The word travels in the address, mixed up so that nobody reads it at a glance: a byte of chance, then
// the language, the letters and a check sum, each shifted by an amount that grows out of the first byte.
const shift = (salt, i) => (salt * (i + 3) + 91 * (i + 1)) & 255;
export function packWord(word, lang, salt = Math.floor(Math.random() * 256)) {
  const plain = [Object.keys(ALPHABET).indexOf(lang), ...[...word].map((ch) => ALPHABET[lang].indexOf(ch))];
  plain.push(plain.reduce((sum, b) => sum + b, 7) & 255);
  const bytes = [salt, ...plain.map((b, i) => (b + shift(salt, i)) & 255)];
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Reads such a code back: { word, lang }, or null if it is not one (cut short, mistyped, made up).
export function unpackWord(code) {
  let bytes;
  try { bytes = [...atob(String(code).replace(/-/g, '+').replace(/_/g, '/'))].map((ch) => ch.charCodeAt(0)); } catch { return null; }
  if (bytes.length !== LENGTH + 3) return null;
  const [salt, ...mixed] = bytes, plain = mixed.map((b, i) => (b - shift(salt, i)) & 255), check = plain.pop();
  const lang = Object.keys(ALPHABET)[plain[0]], letters = plain.slice(1);
  if (!lang || check !== (plain.reduce((sum, b) => sum + b, 7) & 255) || letters.some((b) => b >= ALPHABET[lang].length)) return null;
  return { lang, word: letters.map((b) => ALPHABET[lang][b]).join('') };
}

// ---------------------------------------------------------------- the game on the page
// Russian letters by the place of their key, so the Russian game can be typed with any layout switched on.
const RU_KEYS = {
  KeyQ: 'й', KeyW: 'ц', KeyE: 'у', KeyR: 'к', KeyT: 'е', KeyY: 'н', KeyU: 'г', KeyI: 'ш', KeyO: 'щ', KeyP: 'з', BracketLeft: 'х', BracketRight: 'ъ',
  KeyA: 'ф', KeyS: 'ы', KeyD: 'в', KeyF: 'а', KeyG: 'п', KeyH: 'р', KeyJ: 'о', KeyK: 'л', KeyL: 'д', Semicolon: 'ж', Quote: 'э',
  KeyZ: 'я', KeyX: 'ч', KeyC: 'с', KeyV: 'м', KeyB: 'и', KeyN: 'т', KeyM: 'ь', Comma: 'б', Period: 'ю', Backquote: 'е',
};
// The letter a key press stands for in the given language, or null.
export function letterOf(e, lang) {
  const ch = (e.char || '').toLowerCase();
  if (lang === 'ru') {
    if (/^[а-яё]$/.test(ch)) return ch === 'ё' ? 'е' : ch; // the word lists spell ё as е
    return RU_KEYS[e.code] || null;
  }
  if (/^[a-z]$/.test(ch)) return ch;
  return /^Key[A-Z]$/.test(e.code || '') ? e.code.slice(3).toLowerCase() : null;
}

let words = null; // the word lists arrive when the game is first opened: they are too big to make every visitor wait for them
const loadWords = () => (words ||= import('../data/hellword.js').then((m) => m.HELLWORDS).catch((err) => { words = null; throw err; }));

const saved = {
  get(key) { try { return localStorage.getItem('arcade:hellword:' + key); } catch { return null; } },
  set(key, v) { try { if (v === null) localStorage.removeItem('arcade:hellword:' + key); else localStorage.setItem('arcade:hellword:' + key, v); } catch { /* private mode */ } },
};
const FLIP = 150, FLIP_LAST = 450; // a letter turns over this long after the one before it; how long one turn takes

export default {
  id: 'hellword', name: 'Hellword', icon: 'spell-check', color: '#22c55e', tag: 'Words', since: '1.1',
  desc: 'Guess the hidden five-letter word in six tries. In English and in Russian.',
  help: 'Type a word and press Enter · green: right place · yellow: wrong place · grey: not in the word · Restart gives up · the link button sends a word of your own',
  scoreLabel: 'Streak',
  variants: { en: LANGS.en.name, ru: LANGS.ru.name },
  defaultVariant: () => ((navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'),
  create(stage, api) {
    stage.innerHTML = `
      <div class="hw" id="hw">
        <div class="mn-top">
          <div class="seg" id="hw-lang">${Object.entries(LANGS).map(([id, l]) => `<button data-l="${id}" lang="${id}">${l.name}</button>`).join('')}</div>
          <button class="btn-icon" id="hw-make" title="Send a word of your own" aria-label="Send a word of your own" aria-expanded="false"><i data-lucide="link"></i></button>
        </div>
        <div class="hw-board" id="hw-board">${`<div class="hw-row">${'<div class="hw-tile"></div>'.repeat(LENGTH)}</div>`.repeat(TRIES)}<p class="hw-note" id="hw-note" role="status"></p></div>
        <div class="hw-keys" id="hw-keys"></div>
        <form class="hw-own" id="hw-own" autocomplete="off">
          <h3>A word of your own</h3>
          <p>Type five letters and send the link to a friend, who gets six tries to guess them.</p>
          <input id="hw-own-in" maxlength="${LENGTH}" inputmode="text" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Your word">
          <div class="hw-own-go"><button class="btn-primary" id="hw-own-copy"><i data-lucide="copy"></i>Copy link</button><button type="button" class="bt-tool" id="hw-own-share"><i data-lucide="share-2"></i><span>Share</span></button></div>
          <p class="hw-own-msg" id="hw-own-msg" role="status"></p>
          <output class="hw-own-link" id="hw-own-link"></output>
          <button type="button" class="hw-own-back" id="hw-own-back">Back to the game</button>
        </form>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const rowsEl = [...stage.querySelectorAll('.hw-row')], note = $('hw-note'), keysEl = $('hw-keys');
    const langBtns = [...stage.querySelectorAll('#hw-lang button')];
    let lang, lists = null, round = null, busy = false, alive = true, noteTimer = null, timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    // A link with a word in it (#hellword?w=…) opens a round with that word. It leaves the streak alone.
    const code = api.query.w || '', friend = code ? unpackWord(code) : null;
    const leave = () => { location.hash = 'hellword'; }; // back to the words of the game
    if (code && !friend) { delete api.query.w; history.replaceState(null, '', '#hellword'); } // a broken link is mentioned once and then forgotten

    const streak = () => Number(saved.get('streak:' + lang)) || 0;
    function say(text, hold = 1600) {
      clearTimeout(noteTimer);
      note.textContent = text;
      if (text && hold) noteTimer = setTimeout(() => { note.textContent = ''; }, hold);
    }
    function drawKeys() {
      const [top, mid, low] = LANGS[lang].rows;
      const key = (ch) => `<button data-k="${ch}" class="${round?.keys[ch] || ''}">${ch}</button>`;
      keysEl.innerHTML = `<div>${[...top].map(key).join('')}</div><div>${[...mid].map(key).join('')}</div>
        <div><button data-k="Enter" class="wide" aria-label="Enter">Enter</button>${[...low].map(key).join('')}<button data-k="Backspace" class="wide" aria-label="Delete"><i data-lucide="delete"></i></button></div>`;
      keysEl.lang = lang;
      drawIcons();
    }
    const paintKeys = () => keysEl.querySelectorAll('button[data-k]').forEach((b) => { if (round.keys[b.dataset.k]) b.className = round.keys[b.dataset.k]; });
    // Shows the row that is being typed.
    function drawTyped() {
      const row = rowsEl[round.guesses.length];
      if (!row) return;
      [...row.children].forEach((tile, i) => {
        const ch = round.typed[i] || '';
        if (tile.textContent !== ch) { tile.textContent = ch; tile.className = 'hw-tile' + (ch ? ' filled' : ''); }
      });
    }
    // Shows a guess that has been judged: at once, or with the letters turning over one after another.
    function drawGuess(n, turn) {
      const { word, marks } = round.guesses[n];
      [...rowsEl[n].children].forEach((tile, i) => {
        tile.textContent = word[i];
        tile.className = `hw-tile ${marks[i]} ${turn ? 'turn' : 'shown'}`;
        tile.style.setProperty('--i', i);
      });
    }
    const status = () => api.status(round.over ? '' : `${friend ? 'A friend’s word · ' : 'Guess '}${round.guesses.length + 1} of ${TRIES}`);
    const keep = () => {
      const guesses = round.guesses.map((g) => g.word);
      if (friend) saved.set('friend', round.over ? null : JSON.stringify({ code, guesses }));
      else saved.set('round:' + lang, round.over ? null : JSON.stringify({ answer: round.answer, guesses }));
    };

    function newRound(resume = true) {
      const { answers, guesses } = lists[lang], known = new Set(guesses);
      let answer = null, earlier = [], accepts = (w) => known.has(w);
      if (friend) {
        // A friend's word may be a name or a word the game has never heard of. Then any five letters may be tried.
        answer = friend.word;
        if (!known.has(answer)) accepts = () => true;
        try { const was = JSON.parse(saved.get('friend') || 'null'); if (was && was.code === code && Array.isArray(was.guesses)) earlier = was.guesses.filter((w) => ownWord(w, lang) && accepts(w)); } catch { /* start from the first try */ }
      } else {
        try { // a round that was left unfinished carries on
          const was = resume && JSON.parse(saved.get('round:' + lang) || 'null');
          if (was && answers.includes(was.answer) && Array.isArray(was.guesses)) { answer = was.answer; earlier = was.guesses.filter((w) => known.has(w)); }
        } catch { /* the saved round is unreadable: a new word, then */ }
        if (!answer) {
          const last = saved.get('last:' + lang); // a new round never brings the word of the round before
          do answer = answers[Math.floor(Math.random() * answers.length)]; while (answer === last && answers.length > 1);
        }
        saved.set('last:' + lang, answer);
      }
      round = createRound(answer, accepts, earlier);
      rowsEl.forEach((row) => [...row.children].forEach((tile) => { tile.textContent = ''; tile.className = 'hw-tile'; }));
      round.guesses.forEach((_, n) => drawGuess(n, false));
      drawKeys(); status(); keep();
      say(friend && !round.guesses.length ? (known.has(answer) ? 'A friend sent you this word' : 'A friend’s word: it may be a name, so any letters go') : code && !friend ? 'That link is broken. Here is a word of the game instead.' : '', 3200);
      api.score(streak());
      busy = false;
    }
    function end() {
      const word = round.answer.toUpperCase();
      if (friend) { // somebody's own word: the streak stays as it is, and the next round is one of the game's
        const n = round.guesses.length;
        api.overlay(round.won
          ? { title: 'Got it!', text: `${word} in ${n} ${n === 1 ? 'try' : 'tries'}. Your friend’s word is solved.`, icon: 'trophy', button: 'Play on', onClick: leave, wait: 650 }
          : { title: 'The word was ' + word, text: 'Out of tries. Send a word back?', icon: 'flag', button: 'Play on', onClick: leave, wait: 650 });
        return;
      }
      if (round.won) {
        const now = streak() + 1, n = round.guesses.length;
        saved.set('streak:' + lang, String(now)); api.score(now);
        const praise = ['Unbelievable!', 'Brilliant!', 'Great!', 'Well done', 'Got it', 'Phew, that was close'][n - 1];
        api.finish(now, { title: praise, text: `${word} in ${n} ${n === 1 ? 'try' : 'tries'} · ${now} in a row`, icon: 'trophy' });
      } else {
        saved.set('streak:' + lang, '0'); api.score(0);
        api.finish(0, { title: 'The word was ' + word, text: 'Out of tries. The streak starts again.', icon: 'flag' });
      }
    }
    function submit() {
      const result = round.submit();
      if (result === 'short' || result === 'unknown') {
        say(result === 'short' ? 'Not enough letters' : 'Not in the word list');
        const row = rowsEl[round.guesses.length];
        row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
        return;
      }
      if (result !== 'ok') return;
      busy = true; keep(); say('');
      drawGuess(round.guesses.length - 1, true);
      later(() => {
        paintKeys(); status();
        if (round.over) later(end, 250); else busy = false;
      }, FLIP * (LENGTH - 1) + FLIP_LAST);
    }
    function press(k) {
      if (!round || busy || round.over) return;
      if (k === 'Enter') submit();
      else if (k === 'Backspace') { round.erase(); drawTyped(); }
      else { round.type(k); drawTyped(); }
    }
    function setLang(id) {
      lang = LANGS[id] ? id : 'en';
      api.variant(lang);
      langBtns.forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
      timers.forEach(clearTimeout); timers = [];
      ownShow();
      if (lists) newRound();
    }

    // ---- the page where a word of one's own is turned into a link
    const own = $('hw-own'), ownIn = $('hw-own-in'), ownMsg = $('hw-own-msg'), ownLink = $('hw-own-link'), makeBtn = $('hw-make');
    $('hw-own-share').hidden = !navigator.share; // phones have a sheet for sending things; elsewhere the link is copied
    function ownShow() { ownIn.placeholder = lang === 'ru' ? 'СЛОВО' : 'WORD'; ownIn.lang = lang; ownMsg.textContent = ''; ownLink.textContent = ''; }
    function ownOpen(open) {
      $('hw').classList.toggle('own', open);
      makeBtn.setAttribute('aria-expanded', String(open)); makeBtn.classList.toggle('on', open);
      if (open) { ownShow(); ownIn.value = ''; ownIn.focus({ preventScroll: true }); }
    }
    // The link for what is in the box, or null with a word about what is wrong.
    function ownAddress() {
      const word = ownWord(ownIn.value, lang);
      if (!word) { ownMsg.textContent = `It takes exactly five ${lang === 'ru' ? 'Russian' : 'English'} letters.`; ownLink.textContent = ''; return null; }
      const address = `${location.href.split('#')[0]}#hellword?w=${packWord(word, lang)}`;
      ownLink.textContent = address;
      return { word, address, known: !lists || lists[lang].guesses.includes(word) };
    }
    async function ownCopy() {
      const made = ownAddress();
      if (!made) return;
      const tail = made.known ? '' : ' The game does not know this word, so your friend may try any letters.';
      ownMsg.textContent = (await copyText(made.address) ? 'Link copied. Send it to a friend.' : 'Copy the link below and send it to a friend.') + tail;
    }
    own.addEventListener('submit', (e) => { e.preventDefault(); ownCopy(); });
    $('hw-own-share').addEventListener('click', () => {
      const made = ownAddress();
      if (made) navigator.share({ title: 'Hellword', text: 'Can you guess my word?', url: made.address }).catch(() => { /* the sheet was closed */ });
    });
    ownIn.addEventListener('input', () => { ownMsg.textContent = ''; ownLink.textContent = ''; });
    makeBtn.addEventListener('click', () => { makeBtn.blur(); ownOpen(!$('hw').classList.contains('own')); });
    $('hw-own-back').addEventListener('click', () => ownOpen(false));

    keysEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) { b.blur(); press(b.dataset.k); } });
    $('hw-lang').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur();
      if (b.dataset.l === lang || busy) return;
      if (friend) { api.variant(b.dataset.l); leave(); } // the friend's word belongs to its language: the other one is a game of its own
      else setLang(b.dataset.l);
    });

    setLang(friend ? friend.lang : api.variant());
    drawKeys();
    say('Loading the words…', 0);
    loadWords().then((all) => { if (alive) { lists = all; newRound(); } })
      .catch(() => { if (alive) say('The words could not be loaded. Check the connection and press Restart.', 0); });

    return {
      key(e) {
        if ($('hw').classList.contains('own')) return; // the keys belong to the box for one's own word
        if (e.key === 'Enter' || e.key === 'Backspace') { if (e.key === 'Backspace' || !e.repeat) press(e.key); return true; }
        const ch = letterOf(e, lang);
        if (!ch) return;
        if (!e.repeat) press(ch);
        return true;
      },
      // Restart gives the round up: the word is shown and the streak is lost, as after six wrong tries.
      restart() {
        if (!lists) { say('Loading the words…', 0); loadWords().then((all) => { if (alive) { lists = all; newRound(); } }).catch(() => { if (alive) say('The words could not be loaded. Check the connection and press Restart.', 0); }); return; }
        if (busy) return;
        ownOpen(false);
        if (friend) { // giving a friend's word up shows it; with nothing tried yet, Restart simply leaves it
          if (round.over || !round.guesses.length) { leave(); return; }
          round.over = true; saved.set('friend', null);
          api.overlay({ title: 'The word was ' + round.answer.toUpperCase(), text: 'You gave up on your friend’s word.', icon: 'flag', button: 'Play on', onClick: leave, wait: 650 });
          return;
        }
        if (!round.over && round.guesses.length) {
          const word = round.answer.toUpperCase();
          saved.set('streak:' + lang, '0'); saved.set('round:' + lang, null); api.score(0);
          round.over = true;
          api.finish(0, { title: 'The word was ' + word, text: 'You gave up. The streak starts again.', icon: 'flag' });
          return;
        }
        newRound(false);
      },
      destroy() { alive = false; clearTimeout(noteTimer); timers.forEach(clearTimeout); },
    };
  },
};
