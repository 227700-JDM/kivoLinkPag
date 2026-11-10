
'use strict';

(function () {
  const KEY = 'welcome_screen_viewed';
  const html = document.documentElement;
  const splash = document.getElementById('splash');
  if (!splash) return;
  clearTimeout(window.__splashFallback);              

 
  function announceLeaving() {
    html.classList.remove('splash-hold');
    document.dispatchEvent(new Event('splash:leaving'));
  }

 
  let alreadySeen = html.classList.contains('curtain-cover');
  try { alreadySeen = alreadySeen || sessionStorage.getItem(KEY) === 'true'; } catch (e) {}

  if (alreadySeen) {
    splash.style.display = 'none';                    
    html.classList.remove('splash-lock');
    html.classList.add('splash-seen');
    announceLeaving();
    try { sessionStorage.setItem(KEY, 'true'); } catch (e) {}
    return;
  }

 
  const sparks = document.getElementById('splash-sparks');
  const total = navigator.maxTouchPoints > 0 ? 16 : 28;
  for (let i = 0; i < total; i++) {
    const spark = document.createElement('i');
    spark.className = 'splash-spark';
    spark.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
    spark.style.setProperty('--s', (2 + Math.random() * 4).toFixed(1) + 'px');
    spark.style.setProperty('--d', (3 + Math.random() * 3).toFixed(1) + 's');
    spark.style.setProperty('--delay', (Math.random() * 2.5).toFixed(1) + 's');
    spark.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(0) + 'px');
    sparks.appendChild(spark);
  }

 
  const enter = document.getElementById('splash-enter');
  enter.focus({ preventScroll: true });
  document.addEventListener('keydown', () => splash.classList.add('kbd'), { once: true });   

  let leaving = false;
  function leave() {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem(KEY, 'true'); } catch (e) {}      
    splash.classList.add('is-leaving');                           
    announceLeaving();
    setTimeout(function () {                                       
      splash.style.display = 'none';
      html.classList.remove('splash-lock');
      html.classList.add('splash-seen');
      const main = document.getElementById('main-content');
      if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
    }, 1100);
  }
  enter.addEventListener('click', leave);
})();
