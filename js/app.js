import { drawIcons } from './util.js';
import aim from './games/aim.js';
import mania from './games/mania.js';
import tetris from './games/tetris.js';
import pacman from './games/pacman.js';
import flappy from './games/flappy.js';
import lines from './games/lines.js';
import sudoku from './games/sudoku.js';
import draw from './games/draw.js';
import snake from './games/snake.js';
import g2048 from './games/2048.js';
import mines from './games/mines.js';
import memory from './games/memory.js';
import reaction from './games/reaction.js';
import whack from './games/whack.js';

const SITE = 'hellgames by hellkai';
// The games appear on the home page in this order.
const games = [aim, mania, tetris, pacman, flappy, lines, sudoku, draw, snake, g2048, mines, memory, reaction, whack];
const $ = (id) => document.getElementById(id);

// Everything is saved on this device only. The "arcade:" prefix is the original one, kept so saved scores survive.
const store = {
  get(k) { try { return localStorage.getItem('arcade:' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('arcade:' + k, String(v)); } catch {} },
};
// A game with modes (g.variants = { id: 'Label', ... }) keeps a separate best score for each mode.
const bestKey = (g, v) => 'best:' + g.id + (v ? ':' + v : '');
const best = {
  get(g, v) { const s = store.get(bestKey(g, v)); return s === null ? null : Number(s); },
  set(g, v, n) { store.set(bestKey(g, v), n); },
};
const savedVariant = (g) => {
  if (!g.variants) return null;
  const v = store.get('variant:' + g.id);
  return v && g.variants[v] ? v : Object.keys(g.variants)[0];
};

const fmt = (g, v) => (v == null || typeof v !== 'number') ? (v ?? '–') : (g.format ? g.format(v) : String(v));

let current = null;
let variant = null;
let inst = null;
let ovAction = null;
let ovReadyAt = 0;

function renderHome() {
  $('grid').innerHTML = games.map((g) => {
    const v = savedVariant(g);
    const bestLine = g.noScore ? '' : `<div class="best"><i data-lucide="trophy" style="width:13px;height:13px"></i> Best <b>${fmt(g, best.get(g, v))}</b>${v ? `<span>· ${g.variants[v]}</span>` : ''}</div>`;
    return `
    <a href="#${g.id}" class="card" style="--c:${g.color}">
      <div class="card-icon"><i data-lucide="${g.icon}"></i></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2"><h3>${g.name}</h3><span class="tag">${g.tag}</span></div>
        <p>${g.desc}</p>
        ${bestLine}
      </div>
    </a>`;
  }).join('');
  drawIcons();
}

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
  finish(v, opts = {}) {
    let record = false;
    if (typeof v === 'number') {
      const b = best.get(current, variant);
      const better = current.lowerBetter ? (b == null || v < b) : (v > 0 && (b == null || v > b));
      if (better) { best.set(current, variant, v); record = true; showBest(); }
    }
    showOverlay({
      title: opts.title || (record ? 'New best!' : opts.endTitle || 'Game over'),
      text: opts.text ?? (typeof v === 'number' ? `${current.scoreLabel || 'Score'}: ${fmt(current, v)}` : ''),
      icon: opts.icon || (record ? 'trophy' : 'flag'),
      button: 'Play again',
      onClick: start,
      wait: 650,
    });
  },
};

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
  const g = games.find((x) => x.id === location.hash.slice(1));
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
  $('play').classList.toggle('no-score', !!g.noScore);
  showBest();
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
// like WASD keep working whatever keyboard layout is active (Russian, for example).
function gameKey(e) {
  const c = e.code || '';
  let key = e.key;
  if (/^Key[A-Z]$/.test(c)) key = c.slice(3).toLowerCase();
  else if (/^Digit\d$/.test(c)) key = c.slice(5);
  return { key, code: c, repeat: e.repeat, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey, altKey: e.altKey };
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

window.addEventListener('hashchange', route);
route();
drawIcons();
