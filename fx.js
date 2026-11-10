
'use strict';

const FX_REDUCED = isReducedMotion();   
const FX_CURTAIN_KEY = 'kv_curtain';


const SCRAMBLE_CHARS = '!<>-_\\/[]{}=+*^?#%&01';
const randomChar = () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];


function prepareScramble(el) {
  if (el._fx && el.contains(el._fx.visual)) return el._fx;
  const finalText = el.textContent.replace(/\s+/g, ' ').trim();
  const reader = document.createElement('span');
  reader.className = 'visually-hidden';
  reader.textContent = finalText;
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  visual.textContent = finalText;
  el.replaceChildren(reader, visual);
  el._fx = { finalText: finalText, visual: visual };
  return el._fx;
}

function runScramble(el, mode, duration) {
  const fx = prepareScramble(el);
  const text = fx.finalText;
  const length = text.length;
  if (el._fxRunning) return Promise.resolve();
  el._fxRunning = true;

 
  el.style.minHeight = el.offsetHeight + 'px';
  const frames = Math.max(10, Math.round(duration / 16));
  const plan = Array.from(text, (ch) => {
    const start = Math.floor(Math.random() * frames * 0.4);
    return { ch: ch, end: start + Math.floor(frames * 0.25 + Math.random() * frames * 0.4), cur: randomChar() };
  });

  return new Promise((resolve) => {
    const startTime = performance.now();
    let frame = 0;
    (function tick() {
     
      frame = Math.floor((performance.now() - startTime) / 16);
      let output = '';
      if (mode === 'type') {
       
        const reveal = Math.floor((frame / frames) * length);
        output = text.slice(0, reveal);
        for (let i = reveal; i < Math.min(length, reveal + 3); i++) output += text[i] === ' ' ? ' ' : randomChar();
      } else {
        plan.forEach((p) => {
          if (p.ch === ' ') { output += ' '; return; }
          if (frame >= p.end) { output += p.ch; return; }
          if (Math.random() < 0.3) p.cur = randomChar();
          output += p.cur;
        });
      }
      fx.visual.textContent = output;
      if (frame <= frames + 6) { requestAnimationFrame(tick); return; }
      fx.visual.textContent = text;                 
      el.style.minHeight = '';
      el._fxRunning = false;
      resolve();
    })();
  });
}

function initScramble() {
  if (FX_REDUCED) return;

 
  const targets = document.querySelectorAll('[data-scramble]');
  if (targets.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const el = entry.target;
        const type = el.dataset.scramble === 'type';
        const length = el.textContent.trim().length;
        runScramble(el, type ? 'type' : 'scramble', type ? Math.min(1800, length * 12) : 900);
      });
    }, { threshold: 0.2 });
    targets.forEach((el) => observer.observe(el));
  }
}


function initCardFx() {
  if (!window.matchMedia('(hover: hover)').matches) return;
  const selector = '.feature-card, .spec-card, .step-card, .stat-card, .case-card, .impact-card, .post-card';
  let card = null, rect = null, dirty = false, frame = null, mx = 0, my = 0;

 
  document.addEventListener('pointerover', (event) => {
    const found = event.target.closest && event.target.closest(selector);
    if (found === card) return;
    card = found;
    rect = card ? card.getBoundingClientRect() : null;
  }, { passive: true });
 
  window.addEventListener('scroll', () => { dirty = true; }, { passive: true });

 
  document.addEventListener('pointermove', (event) => {
    if (!card) return;
    mx = event.clientX; my = event.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!card) return;
      if (dirty) { rect = card.getBoundingClientRect(); dirty = false; }
      card.style.setProperty('--mx', (mx - rect.left) + 'px');
      card.style.setProperty('--my', (my - rect.top) + 'px');
    });
  }, { passive: true });
}


function initSvgDraw() {
  const svgs = document.querySelectorAll('[data-draw]');
  svgs.forEach((svg) => svg.querySelectorAll('path').forEach((p, i) => p.style.setProperty('--i', i)));
  if (!('IntersectionObserver' in window)) { svgs.forEach((s) => s.classList.add('is-drawn')); return; }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-drawn');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.2 });
  svgs.forEach((svg) => observer.observe(svg));
}


function transitionTo(url) {
  const curtain = document.querySelector('.curtain');
  if (FX_REDUCED || !curtain) { window.location.href = url; return; }
  try { sessionStorage.setItem(FX_CURTAIN_KEY, '1'); } catch (e) {}
  curtain.classList.remove('is-opening');
  curtain.classList.add('is-closing');
  setTimeout(() => { window.location.href = url; }, 780);   
}

function openCurtain() {
  const curtain = document.querySelector('.curtain');
  try { sessionStorage.removeItem(FX_CURTAIN_KEY); } catch (e) {}
  if (!curtain || FX_REDUCED) { document.documentElement.classList.remove('curtain-cover'); return; }
  if (document.documentElement.classList.contains('curtain-cover')) {
    curtain.classList.add('is-opening');
    requestAnimationFrame(() => document.documentElement.classList.remove('curtain-cover'));
    setTimeout(() => curtain.classList.remove('is-opening'), 1400);
  }
}

function initPageTransitions() {
  openCurtain();

 
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    const curtain = document.querySelector('.curtain');
    if (curtain) curtain.classList.remove('is-closing', 'is-opening');
  });

 
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest && event.target.closest('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const url = new URL(link.href, window.location.href);
    if (url.protocol !== window.location.protocol || url.host !== window.location.host) return;
    if (url.pathname === window.location.pathname) return;       
    event.preventDefault();
    transitionTo(url.href);
  });
}


async function initLottie() {
  const slots = document.querySelectorAll('[data-lottie]');
  if (!slots.length || FX_REDUCED) return;
  try {
    await Promise.race([
      customElements.whenDefined('lottie-player'),
      new Promise((_, reject) => setTimeout(reject, 4000))      
    ]);
  } catch (e) { return; }

  slots.forEach(async (slot) => {
    const src = slot.dataset.lottie;
    try { const res = await fetch(src, { method: 'HEAD' }); if (!res.ok) return; } catch (e) { return; }
    const player = document.createElement('lottie-player');
    player.setAttribute('src', src);
    player.setAttribute('background', 'transparent');
    player.setAttribute('renderer', 'svg');
    player.setAttribute('loop', '');
    player.setAttribute('autoplay', '');
    player.setAttribute('aria-hidden', 'true');
    slot.replaceChildren(player);                                
  });
}


window.KivoFx = { transitionTo: transitionTo };

document.addEventListener('DOMContentLoaded', () => {
 
  if (document.documentElement.classList.contains('splash-hold')) document.addEventListener('splash:leaving', initScramble, { once: true });
  else initScramble();
  initCardFx();
  initSvgDraw();
  initPageTransitions();
  initLottie();
});
