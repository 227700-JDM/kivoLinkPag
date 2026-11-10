
'use strict';


function initFeatureAccordion() {
  const cards = document.querySelectorAll('.feature-card');

  function setOpen(card, open) {
    card.classList.toggle('expanded', open);
    card.querySelector('.feature-header').setAttribute('aria-expanded', String(open));
  }

  cards.forEach((card) => {
    setOpen(card, false);                                   
    card.querySelector('.feature-header').addEventListener('click', () => {
      const willOpen = !card.classList.contains('expanded');
      cards.forEach((other) => setOpen(other, false));      
      if (willOpen) setOpen(card, true);                    
    });
  });
}


function initGloveTilt() {
  const stage = document.querySelector('.glove-stage');
  const glove = $('glove-model');
  if (!stage || !glove) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  if (reduceMotion || noHover) return;

  let frame = null;
  stage.addEventListener('mousemove', (event) => {
    if (frame) return;                       
    frame = requestAnimationFrame(() => {
      const rect = stage.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      glove.style.transform = 'rotateX(' + (-y / 10 + 15) + 'deg) rotateY(' + (x / 10 - 20) + 'deg)';
      frame = null;
    });
  });
  stage.addEventListener('mouseleave', () => {
    glove.style.transform = 'rotateX(15deg) rotateY(-20deg)';
  });
}


async function updateHeroButton() {
  const cta = $('hero-cta');
  if (!cta) return;
  const user = await AuthService.getCurrentUser();
  if (user) {
    cta.href = 'dashboard.html';
    cta.textContent = 'Ir a mi Perfil';
  }
}


function initPipeline() {
  const steps = document.querySelectorAll('.ai-step');
  const section = $('ai');
  if (!steps.length || !section || isReducedMotion() || !('IntersectionObserver' in window)) return;
  let index = 0; let timer = null;
  const show = () => { steps.forEach((s, i) => s.classList.toggle('is-active', i === index)); index = (index + 1) % steps.length; };
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { if (!timer) { show(); timer = setInterval(show, 1800); } }
    else { clearInterval(timer); timer = null; }
  }, { threshold: 0.3 }).observe(section);
}

document.addEventListener('DOMContentLoaded', () => {
  initFeatureAccordion();
  initGloveTilt();
  updateHeroButton();
  initPipeline();
});
