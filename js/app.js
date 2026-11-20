import { drawIcons } from './util.js';
import aim from './games/aim.js';
import mania from './games/mania.js';
import helltype from './games/helltype.js';
import helltris from './games/helltris.js';
import hellman from './games/hellman.js';
import hellybird from './games/hellybird.js';
import lines from './games/lines.js';
import sudoku from './games/sudoku.js';
import draw from './games/draw.js';
import snake from './games/snake.js';
import g2048 from './games/2048.js';
import mines from './games/mines.js';
import memory from './games/memory.js';
import reaction from './games/reaction.js';
import whack from './games/whack.js';
import hellword from './games/hellword.js';
import pong from './games/pong.js';
import slots from './games/slots.js';
import dice from './games/dice.js';
import soulmines from './games/soulmines.js';
import beats from './games/beats.js';
import sand from './games/sand.js';
import mahjong from './games/mahjong.js';
import names from './games/names.js';
import circles from './games/circles.js';
import catcher from './games/catcher.js';
import sens from './games/sens.js';
import stroop from './games/stroop.js';
import odd from './games/odd.js';
import rps from './games/rps.js';
import run from './games/run.js';
import rain from './games/rain.js';
import maze from './games/maze.js';
import pipes from './games/pipes.js';
import untangle from './games/untangle.js';
import gems from './games/gems.js';
import blackjack from './games/blackjack.js';
import chess from './games/chess.js';
import durak from './games/durak.js';
import lasthit from './games/lasthit.js';
import peek from './games/peek.js';

const SITE = 'hellgames by hellkai';
const VERSION = '1.1.0';
// The games appear on the home page in this order. The filter buttons above them are the tags of the
// games, in the order in which the tags first turn up in this list.
const games = [
  aim, mania, circles, catcher, helltype, hellword, helltris, hellman, hellybird, run, chess, durak, pong, snake, rain,
  slots, blackjack, dice, soulmines, beats, sand, draw, gems, mahjong, pipes, maze, untangle, lines, sudoku, g2048, mines, memory,
  peek, lasthit, stroop, odd, reaction, whack, rps, sens, names,
];
// A game is marked "New" on the home page while its `since` is the current version without the last number.
const SERIES = VERSION.split('.').slice(0, 2).join('.');
const $ = (id) => document.getElementById(id);

// Everything is saved on this device only. The "arcade:" prefix is the original one, kept so saved scores survive.
const store = {
  get(k) { try { return localStorage.getItem('arcade:' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('arcade:' + k, String(v)); } catch {} },
  remove(k) { try { localStorage.removeItem('arcade:' + k); } catch {} },
};
// A game with modes (g.variants = { id: 'Label', ... }) keeps a separate best score for each mode.
const bestKey = (g, v) => 'best:' + g.id + (v ? ':' + v : '');
const best = {
  get(g, v) { const s = store.get(bestKey(g, v)); return s === null ? null : Number(s); },
  set(g, v, n) { store.set(bestKey(g, v), n); },
};
// Three games got new names in version 1.0. Scores saved under the old names move over once,
// and links to the old addresses (#tetris and so on) still open the right game.
const RENAMED = { tetris: 'helltris', pacman: 'hellman', flappy: 'hellybird' };
for (const [from, to] of Object.entries(RENAMED)) {
  const old = store.get('best:' + from);
  if (old === null) continue;
  if (store.get('best:' + to) === null) store.set('best:' + to, old);
  store.remove('best:' + from);
}
// The mode played last time. A new player gets the game's own suggestion (g.defaultVariant), or the first mode.
const savedVariant = (g) => {
  if (!g.variants) return null;
  const v = store.get('variant:' + g.id);
  if (v && g.variants[v]) return v;
  const suggested = g.defaultVariant ? g.defaultVariant() : null;
  return suggested && g.variants[suggested] ? suggested : Object.keys(g.variants)[0];
};

const fmt = (g, v) => (v == null || typeof v !== 'number') ? (v ?? '–') : (g.format ? g.format(v) : String(v));

let current = null;
let variant = null;
let inst = null;
let ovAction = null;
let ovReadyAt = 0;

let category = 'All'; // the filter chosen on the home page; lasts until the page is reloaded

function renderHome() {
  const tags = [...new Set(games.map((g) => g.tag))];
  if (category !== 'All' && !tags.includes(category)) category = 'All';
  const count = (tag) => (tag === 'All' ? games.length : games.filter((g) => g.tag === tag).length);
  $('cats').innerHTML = ['All', ...tags].map((tag) =>
    `<button class="chip${tag === category ? ' on' : ''}" data-cat="${tag}" aria-pressed="${tag === category}">${tag} <span>${count(tag)}</span></button>`).join('');
  $('grid').innerHTML = games.filter((g) => category === 'All' || g.tag === category).map((g) => {
    const v = savedVariant(g);
    const bestLine = g.noScore ? '' : `<div class="best"><i data-lucide="trophy" style="width:13px;height:13px"></i> ${g.bestLabel || 'Best'} <b>${fmt(g, best.get(g, v))}</b>${v ? `<span>· ${g.variants[v]}</span>` : ''}</div>`;
    return `
    <a href="#${g.id}" class="card" style="--c:${g.color}">
      <div class="card-icon"><i data-lucide="${g.icon}"></i></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2"><h3>${g.name}${g.since === SERIES ? ' <span class="new">New</span>' : ''}</h3><span class="tag">${g.tag}</span></div>
        <p>${g.desc}</p>
        ${bestLine}
      </div>
    </a>`;
  }).join('');
  drawIcons();
}
$('cats').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-cat]');
  if (!chip) return;
  category = chip.dataset.cat;
  renderHome();
});

function showOverlay({ title, text = '', button = 'Start', icon = 'play', onClick, wait = 300 }) {
  $('ov-title').textContent = title;
  $('ov-text').textContent = text;
  $('ov-btn').textContent = button;
  $('ov-icon').innerHTML = `<i data-lucide="${icon}"></i>`;
  ovAction = onClick;
  ovReadyAt = performance.now() + wait;
  $('overlay').classList.remove('hidden');
  drawIcons();
  setTimeout(() => $('ov-btn').focus({ preventScroll: true }), 50);
}
function hideOverlay() { $('overlay').classList.add('hidden'); ovAction = null; }
const overlayOpen = () => !$('overlay').classList.contains('hidden');
const showBest = () => { $('g-best').textContent = fmt(current, best.get(current, variant)); };

const api = {
  // What follows a question mark in the address, as in #hellword?w=…: a game can be opened with something to do.
  query: {},
  score(v) { $('g-score').textContent = fmt(current, v); },
  status(t) { $('g-status').textContent = t || ''; },
  overlay: showOverlay,
  hideOverlay,
  // Current mode of a game that has g.variants. Pass a mode id to switch to it (the Best box follows).
  variant(v) {
    if (v !== undefined && v !== variant && current.variants && current.variants[v]) {
      variant = v; store.set('variant:' + current.id, v); showBest();
    }
    return variant;
  },
  // Saves a score as the best one if it beats the best so far, without ending the round. Says whether it did.
  record(v) {
    if (typeof v !== 'number' || current.noScore) return false;
    const b = best.get(current, variant);
    const better = current.lowerBetter ? (b == null || v < b) : (v > 0 && (b == null || v > b));
    if (better) { best.set(current, variant, v); showBest(); }
    return better;
  },
  finish(v, opts = {}) {
    const record = api.record(v);
    showOverlay({
      title: opts.title || (record ? 'New best!' : opts.endTitle || 'Game over'),
      text: opts.text ?? (typeof v === 'number' ? `${current.scoreLabel || 'Score'}: ${fmt(current, v)}` : ''),
      icon: opts.icon || (record ? 'trophy' : 'flag'),
      button: 'Play again',
      onClick: start,
      wait: opts.wait ?? 650,
    });
  },
};

// A long name gets smaller letters on a narrow screen rather than being cut short.
function fitTitle() {
  const title = $('g-title');
  title.style.fontSize = '';
  for (let size = parseFloat(getComputedStyle(title).fontSize); title.scrollWidth > title.clientWidth && size > 11;) title.style.fontSize = `${--size}px`;
}
window.addEventListener('resize', () => { if (current) fitTitle(); });

function start() {
  if (inst && inst.destroy) inst.destroy();
  hideOverlay();
  const stage = $('stage');
  stage.innerHTML = '';
  api.status('');
  api.score(current.initialScore ?? 0);
  inst = current.create(stage, api) || {};
  drawIcons();
}

function route() {
  if (inst && inst.destroy) inst.destroy();
  inst = null;
  hideOverlay();
  const [id, query = ''] = location.hash.slice(1).split('?');
  if (RENAMED[id]) { location.replace('#' + RENAMED[id]); return; }
  const g = games.find((x) => x.id === id);
  api.query = Object.fromEntries(new URLSearchParams(query));
  current = g || null;
  variant = g ? savedVariant(g) : null;
  $('home').classList.toggle('hidden', !!g);
  $('play').classList.toggle('hidden', !g);
  window.scrollTo(0, 0);
  if (!g) {
    document.title = SITE;
    $('stage').innerHTML = '';
    renderHome();
    return;
  }
  document.title = `${g.name} — ${SITE}`;
  $('g-title').textContent = g.name;
  $('g-help').textContent = g.help || '';
  $('g-score-label').textContent = g.scoreLabel || 'Score';
  $('g-best-label').textContent = g.bestLabel || 'Best';
  $('play').classList.toggle('no-score', !!g.noScore);
  $('g-restart').classList.toggle('hidden', !!g.noRestart); // a game with nothing to start over does without the button
  showBest();
  fitTitle();
  start();
}

// An overlay that has only just appeared ignores clicks and key presses for a moment (`wait`, longer for
// the result of a round), so that mashing Space or the mouse at the end doesn't skip the result screen.
$('ov-btn').addEventListener('click', () => {
  if (performance.now() < ovReadyAt) return;
  const fn = ovAction; hideOverlay(); fn && fn();
});
// A game may handle the Restart button itself (inst.restart) instead of being rebuilt from scratch.
$('g-restart').addEventListener('click', (e) => {
  e.currentTarget.blur();
  if (!current) return;
  if (inst && inst.restart) inst.restart(); else start();
});

// Games get a simplified key event. Letters and digits are taken from the physical key, so controls
// like WASD keep working whatever keyboard layout is active (Russian, for example). A game that wants
// the letter the player really typed, as a word game does, finds it in `char`.
function gameKey(e) {
  const c = e.code || '';
  let key = e.key;
  if (/^Key[A-Z]$/.test(c)) key = c.slice(3).toLowerCase();
  else if (/^Digit\d$/.test(c)) key = c.slice(5);
  return { key, char: e.key, code: c, repeat: e.repeat, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey, altKey: e.altKey };
}
const isTextField = (el) => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|number|email|url|password|tel)$/.test(el.type)));

document.addEventListener('keydown', (e) => {
  if (!current || typeof e.key !== 'string') return;
  if (e.key === 'Escape') { location.hash = ''; return; }
  if (overlayOpen()) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) $('ov-btn').click(); }
    return;
  }
  if (!inst || isTextField(e.target)) return;
  // Combinations with Ctrl / Cmd / Alt belong to the browser, unless a game asks for them (inst.shortcut).
  if (e.ctrlKey || e.metaKey || e.altKey) {
    if (inst.shortcut && inst.shortcut(gameKey(e))) e.preventDefault();
    return;
  }
  if (inst.key && inst.key(gameKey(e))) e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  if (inst && inst.keyup && typeof e.key === 'string') inst.keyup(gameKey(e));
});

// Swipe support
let sx = 0, sy = 0, tracking = false;
const wrap = $('stage-wrap');
wrap.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
}, { passive: true });
wrap.addEventListener('touchmove', (e) => {
  if (tracking && current && current.swipe) e.preventDefault();
}, { passive: false });
wrap.addEventListener('touchend', (e) => {
  if (!tracking || !inst || !inst.swipe || overlayOpen()) { tracking = false; return; }
  tracking = false;
  const t = e.changedTouches[0];
  const dx = t.clientX - sx, dy = t.clientY - sy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  inst.swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

// There are no accounts and no servers. Whoever wants the scores on another device, or safe from a
// cleared browser, saves everything the site remembers to a file and loads that file where it is wanted.
function saveFile() {
  const data = {};
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((key) => key.startsWith('arcade:')).sort();
    for (const key of keys) data[key] = localStorage.getItem(key);
  } catch { /* nothing can be read: there is nothing to save then */ }
  const count = Object.keys(data).length;
  if (!count) { $('bk-msg').textContent = 'Nothing has been saved yet: play something first.'; return; }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'hellgames', version: VERSION, saved: new Date().toISOString(), data }, null, 1)], { type: 'application/json' }));
  link.download = `hellgames-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  $('bk-msg').textContent = `Saved ${count} ${count === 1 ? 'entry' : 'entries'} to ${link.download}.`;
}
async function loadFile(file) {
  let count = 0;
  try {
    const { app, data } = JSON.parse(await file.text());
    const entries = Object.entries(data);
    if (app !== 'hellgames' || entries.length > 5000 || !entries.every(([key, value]) => key.startsWith('arcade:') && typeof value === 'string' && value.length < 500000)) throw new Error('not a file of this site');
    for (const [key, value] of entries) { localStorage.setItem(key, value); count++; }
  } catch {
    $('bk-msg').textContent = count ? 'The browser would not take all of it: some entries are missing.' : 'That is not a file saved from hellgames. Nothing was changed.';
    return;
  }
  $('bk-msg').textContent = `Loaded ${count} ${count === 1 ? 'entry' : 'entries'}. The scores below are the ones from the file.`;
  if (!current) renderHome();
}
$('bk-save').addEventListener('click', saveFile);
$('bk-load').addEventListener('click', () => $('bk-file').click());
$('bk-file').addEventListener('change', (e) => { const [file] = e.target.files; e.target.value = ''; if (file) loadFile(file); });

window.addEventListener('hashchange', route);
$('version').textContent = 'v' + VERSION;
route();
drawIcons();

// After the first visit the site also opens without a connection (see sw.js). The worker is handed the
// list of files this page has just loaded, so that all of them are available offline straight away,
// and the files that a game fetches only when it is opened: without them that game would need a
// connection the first time.
const LOADED_LATER = ['js/data/hellword.js'];
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
    const urls = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin));
    const page = location.href.split('#')[0];
    reg.active.postMessage({ keep: [page, ...urls, ...LOADED_LATER.map((file) => new URL(file, page).href)] });
  }).catch(() => { /* no offline mode in this browser: the site works as usual */ });
}
