import { createIcons, icons } from './vendor/lucide.js';

export const drawIcons = () => createIcons({ icons });

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const randInt = (n) => Math.floor(Math.random() * n);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Keeps a canvas' pixel size in sync with its size on screen (sharp on HiDPI displays).
// Calls onResize(width, height, dpr) after every change; returns a function that stops watching.
export function fitCanvas(cv, onResize) {
  const fit = () => {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    if (onResize) onResize(w, h, dpr);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(cv);
  fit();
  return () => ro.disconnect();
}

// For areas that are swiped or drawn on with a finger. Together with the CSS rule touch-action:none it
// keeps the page from scrolling, and it stops phones from swallowing the tap that follows a quick swipe.
export function noScroll(...elements) {
  for (const el of elements) el.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}

// Animation loop. frame(dt) receives the seconds passed since the previous frame, capped so that
// a slow frame or a background tab never makes a game jump ahead. Returns a function that stops it.
export function loop(frame) {
  let id = 0, last = 0, alive = true;
  const tick = (t) => {
    if (!alive) return;
    const dt = last ? Math.min(0.05, Math.max(0, (t - last) / 1000)) : 0;
    last = t;
    frame(dt);
    if (alive) id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => { alive = false; cancelAnimationFrame(id); };
}
