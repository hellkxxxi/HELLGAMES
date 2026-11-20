// Hellword and its word lists, and Name Forge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HELLWORDS } from '../../js/data/hellword.js';
import { WORDS } from '../../js/data/words.js';
import { LANGS, LENGTH, TRIES, createRound, judge, letterOf, ownWord, packWord, unpackWord } from '../../js/games/hellword.js';
import { fantasyName, invent, learn, nickname } from '../../js/games/names.js';
import { seeded } from './seeded.mjs';

// ---------------------------------------------------------------- Hellword
test('Hellword: the word lists are clean', () => {
  assert.deepEqual(Object.keys(HELLWORDS).sort(), Object.keys(LANGS).sort(), 'every language has a keyboard and word lists');
  for (const [lang, { answers, guesses }] of Object.entries(HELLWORDS)) {
    const keys = new Set(LANGS[lang].rows.join('')), known = new Set(guesses);
    assert.ok(answers.length >= 500, `${lang}: enough answers for more than a year of daily play`);
    assert.ok(guesses.length >= answers.length * 3, `${lang}: far more words are accepted than can be the answer`);
    assert.equal(new Set(answers).size, answers.length, `${lang}: no answer twice`);
    assert.equal(known.size, guesses.length, `${lang}: no accepted word twice`);
    assert.deepEqual(answers.filter((w) => !known.has(w)), [], `${lang}: every answer is itself an accepted word`);
    assert.deepEqual(guesses.filter((w) => [...w].length !== LENGTH), [], `${lang}: every word has ${LENGTH} letters`);
    assert.deepEqual(guesses.filter((w) => [...w].some((ch) => !keys.has(ch))), [], `${lang}: every word can be typed on the keyboard of the game`);
  }
  assert.ok(!LANGS.ru.rows.join('').includes('ё'), 'the Russian keyboard has no ё: the lists spell it е');
});

test('Hellword: how a guess is marked', () => {
  assert.deepEqual(judge('crane', 'crane'), ['hit', 'hit', 'hit', 'hit', 'hit']);
  assert.deepEqual(judge('sound', 'crate'), ['miss', 'miss', 'miss', 'miss', 'miss']);
  assert.deepEqual(judge('paper', 'apple'), ['near', 'near', 'hit', 'near', 'miss']);
  assert.deepEqual(judge('eerie', 'crane'), ['miss', 'miss', 'near', 'miss', 'hit'], 'a letter the word has once is marked once, and a hit comes first');
  assert.deepEqual(judge('allow', 'level'), ['miss', 'near', 'near', 'miss', 'miss'], 'two in the guess, two in the word, both in other places');
  assert.deepEqual(judge('нитка', 'книга'), ['near', 'near', 'miss', 'near', 'hit']);
});

test('Hellword: a round', () => {
  const known = new Set(['crane', 'pilot', 'sound', 'apple', 'paper', 'eerie', 'level']);
  const type = (round, word) => { for (const ch of word) round.type(ch); return round.submit(); };
  const r = createRound('apple', (w) => known.has(w));
  r.type('a'); r.type('p');
  assert.equal(r.submit(), 'short');
  assert.equal(r.typed, 'ap', 'what was typed stays');
  r.erase(); r.erase(); r.erase();
  assert.equal(r.typed, '');
  assert.equal(type(r, 'zzzzzzz'), 'unknown', 'a word that is not in the list is not taken');
  assert.equal(r.typed, 'zzzzz', 'a sixth letter does not fit');
  assert.equal(r.guesses.length, 0, 'and the try is not used up');
  for (let i = 0; i < LENGTH; i++) r.erase();
  assert.equal(type(r, 'paper'), 'ok');
  assert.deepEqual(r.guesses[0].marks, ['near', 'near', 'hit', 'near', 'miss']);
  assert.deepEqual([r.keys.p, r.keys.a, r.keys.e, r.keys.r, r.keys.z], ['hit', 'near', 'near', 'miss', undefined], 'a key shows the best that is known about its letter');
  assert.equal(type(r, 'apple'), 'ok');
  assert.deepEqual([r.won, r.over, r.keys.a], [true, true, 'hit']);
  assert.equal(type(r, 'crane'), 'over');
  assert.equal(r.guesses.length, 2);

  const lost = createRound('apple', (w) => known.has(w));
  for (let i = 0; i < TRIES; i++) { assert.equal(lost.over, false); type(lost, 'sound'); }
  assert.deepEqual([lost.won, lost.over, lost.guesses.length], [false, true, TRIES]);

  const resumed = createRound('apple', (w) => known.has(w), ['crane', 'pilot']);
  assert.deepEqual([resumed.guesses.length, resumed.over, resumed.keys.p], [2, false, 'near'], 'a round that was left carries on where it stopped');
});

test('Hellword: which letter a key stands for', () => {
  assert.equal(letterOf({ char: 'A', code: 'KeyA' }, 'en'), 'a');
  assert.equal(letterOf({ char: 'ф', code: 'KeyA' }, 'en'), 'a', 'English can be typed with the Russian layout switched on');
  assert.equal(letterOf({ char: 'f', code: 'KeyF' }, 'ru'), 'а', 'and Russian with the English one');
  assert.equal(letterOf({ char: 'Ж', code: 'Semicolon' }, 'ru'), 'ж');
  assert.equal(letterOf({ char: 'ё', code: 'Backquote' }, 'ru'), 'е', 'ё is typed as е');
  assert.equal(letterOf({ char: '1', code: 'Digit1' }, 'en'), null);
  assert.equal(letterOf({ char: '1', code: 'Digit1' }, 'ru'), null);
  assert.equal(letterOf({ char: 'Enter', code: 'Enter' }, 'ru'), null);
  for (const row of LANGS.ru.rows) for (const ch of row) assert.equal(letterOf({ char: ch, code: '' }, 'ru'), ch);
});

test('Hellword: a word of one\'s own travels in a link', () => {
  assert.deepEqual([ownWord(' Crane ', 'en'), ownWord('ЁЛОЧК', 'ru')], ['crane', 'елочк'], 'tidied up: lower case, no spaces around it, ё spelled е');
  assert.deepEqual([ownWord('cran', 'en'), ownWord('cranes', 'en'), ownWord('cr4ne', 'en'), ownWord('слово', 'en'), ownWord('crane', 'ru'), ownWord('', 'ru')], [null, null, null, null, null, null], 'exactly five letters of the language, or nothing');
  const seen = new Set();
  for (let salt = 0; salt < 256; salt++) {
    for (const [word, lang] of [['crane', 'en'], ['aaaaa', 'en'], ['zzzzz', 'en'], ['слово', 'ru'], ['яяяяя', 'ru']]) {
      const code = packWord(word, lang, salt);
      assert.match(code, /^[A-Za-z0-9_-]{11}$/, 'eleven characters that are safe in an address');
      assert.deepEqual(unpackWord(code), { lang, word }, `${word} with chance ${salt} comes back as it went in`);
      if (word === 'crane') seen.add(code);
    }
  }
  assert.equal(seen.size, 256, 'the same word looks different from one link to the next');
  assert.ok(![...seen].some((code) => /crane/i.test(code) || /crane/i.test(atob(code.replace(/-/g, '+').replace(/_/g, '/')))), 'and cannot be read in it');
  assert.deepEqual(unpackWord(packWord('crane', 'en')), { lang: 'en', word: 'crane' }, 'chance of its own when none is given');
  const code = packWord('crane', 'en', 77);
  const flipped = (i) => code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
  for (const bad of ['', 'abc', '!!!!!!!!!!!', 'x'.repeat(11), code.slice(0, -1), code + 'A', code.slice(2), flipped(3), flipped(6), flipped(9)]) assert.equal(unpackWord(bad), null, `"${bad}" is not a word`);
});

// ---------------------------------------------------------------- Name Forge
test('Name Forge: made-up words look like the language and are not in its word list', () => {
  for (const [lang, letters] of [['en', /^[a-z]+$/], ['ru', /^[а-я]+$/]]) {
    const list = [...new Set([...WORDS[lang], ...HELLWORDS[lang].guesses])], known = new Set(list);
    const model = learn(list), rnd = seeded(lang === 'en' ? 1 : 2), made = new Set();
    for (let n = 0; n < 400; n++) {
      const word = invent(model, rnd);
      assert.ok(word && letters.test(word) && word.length >= 5 && word.length <= 9, `${lang}: "${word}"`);
      assert.ok(!known.has(word), `${lang}: "${word}" is a real word`);
      made.add(word);
    }
    assert.ok(made.size > 300, `${lang}: the words do not repeat much (${made.size} different ones of 400)`);
  }
  assert.ok(invent(learn(WORDS.en), seeded(3)), 'the short list that comes with the page is enough to start with');
  assert.equal(invent(learn(['ab']), seeded(4)), null, 'no word of the right length: none, rather than an endless loop');
});

test('Name Forge: nicknames and fantasy names', () => {
  const rnd = seeded(5), model = learn(HELLWORDS.en.guesses), nicks = new Set(), names = new Set();
  for (let n = 0; n < 500; n++) {
    const nick = nickname(rnd, () => invent(model, rnd, 5, 7));
    assert.ok(/^[A-Za-z0-9_]{3,16}$/.test(nick), `nickname "${nick}" fits where nicknames are typed`);
    nicks.add(nick);
    const name = fantasyName(rnd);
    assert.ok(/^[A-Z][a-z]{3,9}$/.test(name), `fantasy name "${name}"`);
    assert.ok(!/[aeiouy]{3}|[^aeiouy]{4}|(.)\1/.test(name.toLowerCase()), `"${name}" can be said aloud`);
    names.add(name);
  }
  assert.ok(nicks.size > 400 && names.size > 400, 'plenty of different ones');
  assert.ok(/^[A-Za-z0-9_]{3,16}$/.test(nickname(seeded(6))), 'works without made-up words too');
});
