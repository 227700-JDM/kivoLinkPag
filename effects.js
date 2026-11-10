'use strict';

let EFFECT_PREFS = loadPrefs();

const IS_TOUCH = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;


const PARTICLE_SPEEDS = { slow: 0.5, normal: 1, fast: 1.8 };
function refreshEffectPrefs() { EFFECT_PREFS = loadPrefs(); }

const AudioPulse = {
  context: null, source: null, analyser: null, data: null, linked: false,
  average: 0, smooth: 0, kick: 0, value: 0,

  setup(audio) {
    if (this.analyser) return true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (location.protocol === 'file:') return false;
    try {
      this.context = new AudioContextClass();
      this.source = this.context.createMediaElementSource(audio);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;                    
      this.analyser.smoothingTimeConstant = 0.6;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.source.connect(this.context.destination);      
      return true;
    } catch (error) { this.analyser = null; return false; }
  },


  link(on) {
    if (!this.analyser) return;
    if (on && !this.linked) { this.source.connect(this.analyser); this.linked = true; }
    if (!on && this.linked) { try { this.source.disconnect(this.analyser); } catch (e) {} this.linked = false; }
    if (!on) { this.value = 0; this.smooth = 0; this.kick = 0; }        
  },

 
  read() {
    if (!this.linked) { this.value *= 0.9; this.kick = 0; return this.value; }     
    this.analyser.getByteFrequencyData(this.data);
    const hzPerBar = this.context.sampleRate / this.analyser.fftSize;             
    const first = Math.max(1, Math.round(20 / hzPerBar));                           
    const last = Math.round(150 / hzPerBar);                                        
    let sum = 0, weight = 0;
    for (let i = first; i <= last; i++) {
      const w = i * hzPerBar < 60 ? 1 : 0.7;                                         
      sum += this.data[i] * w; weight += w;
    }
    const level = sum / weight / 255;                                             
    this.average += (level - this.average) * 0.03;                                  
    if (level > this.average * 1.3 && level > 0.45) this.kick = 1;                  
    this.kick *= 0.88;                                                              
    const body = Math.max(0, (level - 0.35) / 0.65);
    this.smooth += (body - this.smooth) * (body > this.smooth ? 0.5 : 0.1);         
    this.value = Math.min(1, Math.max(this.smooth, this.kick * 0.9));
    return this.value;
  }
};

const Particles = {
  canvas: null, ctx: null, list: [], frame: null, lastTime: 0,
  width: 0, height: 0, mouse: { x: -999, y: -999, active: false },
  color: { soft: 'rgba(169,200,255,0.6)', strong: 'rgba(225,255,0,0.8)' },

  start() {
    this.canvas = document.getElementById('particles');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.active = true; }, { passive: true });
    document.addEventListener('pointerleave', () => { this.mouse.active = false; });
    document.addEventListener('visibilitychange', () => { document.hidden ? this.stop() : this.run(); });   
    new MutationObserver(() => this.readColors()).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-accent'] });   
    this.readColors();
    this.apply();
  },

  readColors() {
    const style = getComputedStyle(document.documentElement);
    const dark = document.documentElement.classList.contains('dark-mode');
    const rgb = style.getPropertyValue('--primary-rgb').trim() || '225, 255, 0';  
    const ink = style.getPropertyValue('--color-accent-ink').trim() || '#a9c8ff'; 
    const n = parseInt(ink.replace('#', ''), 16);
    const inkRgb = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
    this.color.soft = 'rgba(' + inkRgb + ',' + (dark ? 0.6 : 0.5) + ')';
    this.color.strong = dark ? 'rgba(' + rgb + ',0.85)' : 'rgba(' + inkRgb + ',0.85)';
  },

  create() {
   
    const amount = IS_TOUCH ? Math.max(12, Math.min(20, Math.round(this.width / 26))) : Math.max(14, Math.min(44, Math.round(this.width / 32)));
    this.list = Array.from({ length: amount }, () => this.makeOne(true));
  },
  makeOne(anywhere) {
    const depth = 0.4 + Math.random() * 0.9;                       
    const dir = EFFECT_PREFS.particlesDir === 'left' ? -1 : 1;
    return {
      x: anywhere ? Math.random() * this.width : (dir === 1 ? -30 : this.width + 30),
      y: Math.random() * this.height,
      size: 3.2 + depth * 4.5,                                     
      speed: 1.5 + depth * 2.6,                                 
      wave: Math.random() * 6.28, waveSpeed: 0.01 + Math.random() * 0.02,
      shape: ['dot', 'dot', 'ring', 'plus', 'triangle', 'star'][Math.floor(Math.random() * 6)],
      strong: Math.random() < 0.15, spin: Math.random() * 6.28, turn: (Math.random() - 0.5) * 0.02
    };
  },

  resize() {
    if (!this.canvas) return;
    const ratio = IS_TOUCH ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);   
    this.width = window.innerWidth; this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * ratio); this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.create();
  },

  draw(p, grow) {
    const c = this.ctx, s = p.size * grow;
    c.save(); c.translate(p.x, p.y); c.rotate(p.spin);
    c.strokeStyle = c.fillStyle = p.strong ? this.color.strong : this.color.soft;
    c.lineWidth = 1.4;
    c.beginPath();
    if (p.shape === 'dot') { c.arc(0, 0, s * 0.55, 0, 6.283); c.fill(); }
    else if (p.shape === 'ring') { c.arc(0, 0, s, 0, 6.283); c.stroke(); }
    else if (p.shape === 'plus') { c.moveTo(-s, 0); c.lineTo(s, 0); c.moveTo(0, -s); c.lineTo(0, s); c.stroke(); }
    else if (p.shape === 'triangle') { c.moveTo(0, -s); c.lineTo(s, s); c.lineTo(-s, s); c.closePath(); c.stroke(); }
    else { c.moveTo(0, -s * 1.2); c.lineTo(s * 0.3, -s * 0.3); c.lineTo(s * 1.2, 0); c.lineTo(s * 0.3, s * 0.3); c.lineTo(0, s * 1.2); c.lineTo(-s * 0.3, s * 0.3); c.lineTo(-s * 1.2, 0); c.lineTo(-s * 0.3, -s * 0.3); c.closePath(); c.fill(); }
    c.restore();
  },

 
  step(now) {
    const dt = Math.min(3, (now - (this.lastTime || now)) / 16.67);  
    this.lastTime = now;
    const dir = EFFECT_PREFS.particlesDir === 'left' ? -1 : 1;
    const pulse = Music.on ? AudioPulse.read() : 0;
    const speedBoost = (1 + pulse * 2.2) * (PARTICLE_SPEEDS[EFFECT_PREFS.particlesSpeed] || 1);  
    const grow = 1 + pulse * 1.3;                                     

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.globalAlpha = 0.65 + pulse * 0.35;                       
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.x += dir * p.speed * speedBoost * dt;                        
      p.wave += p.waveSpeed * dt;
      p.y += Math.sin(p.wave) * 0.35 * dt + (pulse > 0.2 ? (Math.random() - 0.5) * pulse * 3 : 0);   
      p.spin += p.turn * dt;
     
      if (this.mouse.active) {
        const dx = p.x - this.mouse.x, dy = p.y - this.mouse.y;
        const near = dx * dx + dy * dy;
        if (near < 16900 && near > 0) {                                
          const dist = Math.sqrt(near), push = (130 - dist) / 130 * 2.5 * dt;
          p.x += (dx / dist) * push; p.y += (dy / dist) * push;
        }
      }
     
      if (dir === 1 && p.x > this.width + 30) { p.x = -30; p.y = Math.random() * this.height; }
      if (dir === -1 && p.x < -30) { p.x = this.width + 30; p.y = Math.random() * this.height; }
      if (p.y < -30) p.y = this.height + 30;
      if (p.y > this.height + 30) p.y = -30;
      this.draw(p, grow);
    }
    this.ctx.globalAlpha = 1;
    this.frame = requestAnimationFrame((t) => this.step(t));
  },

  run() { if (!this.frame && EFFECT_PREFS.particles && this.ctx && !document.hidden && !isReducedMotion()) { this.lastTime = 0; this.frame = requestAnimationFrame((t) => this.step(t)); } },
  stop() { cancelAnimationFrame(this.frame); this.frame = null; },

 
  apply() {
    if (!this.ctx) return;
    if (EFFECT_PREFS.particles && !isReducedMotion()) { this.canvas.style.display = ''; this.run(); }
    else { this.stop(); this.ctx.clearRect(0, 0, this.width, this.height); this.canvas.style.display = 'none'; }
    Music.syncAnalysis();
  }
};


const CustomCursor = {
  dot: null, ring: null, x: 0, y: 0, ringX: 0, ringY: 0, frame: null, shown: false, kind: '',

 
  available() { return !IS_TOUCH && window.matchMedia('(hover: hover) and (pointer: fine)').matches; },

  start() {
    this.dot = document.querySelector('.cursor-dot'); this.ring = document.querySelector('.cursor-ring');
    if (!this.dot || !this.ring || !this.available()) return;
    this.hideBoth(true);
   
    document.addEventListener('pointermove', (e) => {
      this.x = e.clientX; this.y = e.clientY;
      if (!this.shown) { this.shown = true; this.ringX = this.x; this.ringY = this.y; this.hideBoth(this.kind === 'text'); }
      this.wake();
    }, { passive: true });
   
    document.addEventListener('pointerover', (e) => {
      const target = e.target;
      let kind = '';
      if (target.closest) {
        if (target.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea')) kind = 'text';
        else if (target.closest('a, button, select, summary, label[for], [role="switch"]')) kind = 'button';
      }
      if (kind === this.kind) return;
      this.kind = kind;
      this.ring.classList.toggle('is-active', kind === 'button');
      if (this.shown) this.hideBoth(kind === 'text');
    }, { passive: true });
    document.addEventListener('pointerdown', () => this.ring.classList.add('is-down'), { passive: true });
    document.addEventListener('pointerup', () => this.ring.classList.remove('is-down'), { passive: true });
    document.addEventListener('pointerleave', () => this.hideBoth(true));
    this.apply();
  },

  hideBoth(hidden) { this.dot.classList.toggle('is-hidden', hidden); this.ring.classList.toggle('is-hidden', hidden); },

 
  wake() { if (!this.frame) this.frame = requestAnimationFrame(() => this.tick()); },

 
  tick() {
    this.frame = null;
    this.ringX += (this.x - this.ringX) * 0.2; this.ringY += (this.y - this.ringY) * 0.2;
    this.dot.style.transform = 'translate3d(' + this.x + 'px,' + this.y + 'px,0)';
    this.ring.style.transform = 'translate3d(' + this.ringX.toFixed(1) + 'px,' + this.ringY.toFixed(1) + 'px,0)';
   
    if (Math.abs(this.x - this.ringX) + Math.abs(this.y - this.ringY) > 0.3) this.wake();
  },

  apply() {
    if (!this.dot || !this.available()) return;
    document.documentElement.classList.toggle('has-custom-cursor', EFFECT_PREFS.cursor);
  }
};


const Music = {
  audio: null, button: null, on: false,

  start() {
    this.audio = document.getElementById('bg-music'); this.button = document.getElementById('music-toggle');
    if (!this.audio || !this.button) return;
    this.audio.volume = 0.35;
    this.button.addEventListener('click', () => {
      if (this.on) this.pause();
      else this.play(true, true).catch(() => {});                   
    });
    window.addEventListener('pagehide', () => { try { sessionStorage.setItem('music_time', String(this.audio.currentTime)); } catch (e) {} });
   
    let wasOn = false;
    try { wasOn = sessionStorage.getItem('music_on') === 'true'; } catch (e) {}
    if (wasOn) {
      try { this.audio.currentTime = Number(sessionStorage.getItem('music_time')) || 0; } catch (e) {}
      this.play(false, false).catch(() => {
        const resume = () => { this.play(false, true).catch(() => {}); document.removeEventListener('pointerdown', resume); };
        document.addEventListener('pointerdown', resume);           
      });
    }
  },

  paint() {
    this.button.setAttribute('aria-pressed', String(this.on));
    this.button.setAttribute('aria-label', this.on ? 'Apagar la música de fondo' : 'Encender la música de fondo');
    try { sessionStorage.setItem('music_on', String(this.on)); } catch (e) {}
  },

 
  async play(showErrors, byTouch) {
    try {
      await this.audio.play();
      this.on = true; this.paint();
      if (byTouch && AudioPulse.setup(this.audio)) { try { await AudioPulse.context.resume(); } catch (e) {} }
     
      if (!byTouch && !AudioPulse.analyser) {
        document.addEventListener('pointerdown', async () => {
          if (this.on && AudioPulse.setup(this.audio)) { try { await AudioPulse.context.resume(); } catch (e) {} this.syncAnalysis(); }
        }, { once: true });
      }
      this.syncAnalysis();
    } catch (error) {
      this.on = false; this.paint(); this.syncAnalysis();
      if (showErrors) showToast('No se pudo reproducir la música. Revisa que exista el archivo assets/audio/roxbury.mp3.', 'error');
      throw error;
    }
  },

  pause() { this.audio.pause(); this.on = false; this.paint(); this.syncAnalysis(); },

 
  syncAnalysis() {
    const wanted = this.on && EFFECT_PREFS.particles;
    AudioPulse.link(wanted);
    if (AudioPulse.context) {
      if (wanted) AudioPulse.context.resume().catch(() => {});
      else AudioPulse.context.suspend().catch(() => {});             
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Particles.start();
  CustomCursor.start();
  Music.start();
});
