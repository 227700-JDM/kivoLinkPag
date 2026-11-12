
'use strict';


const BACKEND_ENABLED = false;


const STORAGE_KEYS = {
  users: 'kivolink_users',
  session: 'kivolink_active_session',
  theme: 'kivolink_theme',
  prefs: 'kivolink_prefs'
};


function navigateTo(url) {
  if (window.KivoFx) window.KivoFx.transitionTo(url);
  else window.location.href = url;
}


const DEFAULT_PREFS = {
  largeText: false, highContrast: false, calm: false,
  notifyPosts: true, notifyChat: true,
  particles: true, particlesDir: 'right', particlesSpeed: 'normal', cursor: true,
  accent: 'neon'                       
};
function loadPrefs() {
  try { return Object.assign({}, DEFAULT_PREFS, JSON.parse(localStorage.getItem(STORAGE_KEYS.prefs))); }
  catch (e) { return Object.assign({}, DEFAULT_PREFS); }
}
function savePrefs(prefs) { try { localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs)); } catch (e) {} }

function applyPrefs(prefs) {
  const html = document.documentElement;
  html.classList.toggle('pref-large-text', prefs.largeText);
  html.classList.toggle('pref-contrast', prefs.highContrast);
  html.classList.toggle('pref-calm', prefs.calm);
 
  if (prefs.accent && prefs.accent !== 'neon') html.setAttribute('data-accent', prefs.accent);
  else html.removeAttribute('data-accent');
}


function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
         document.documentElement.classList.contains('pref-calm');
}


const $ = (id) => document.getElementById(id);


const AuthService = {
 
  _readUsers() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.users)) || []; }
    catch (e) { return []; }
  },
  _writeUsers(users) {
    try { localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users)); return true; }
    catch (e) { return false; } 
  },
  _normalizeEmail(email) { return String(email || '').trim().toLowerCase(); },

 
  async register(data) {
    const users = this._readUsers();
    const email = this._normalizeEmail(data.email);
    if (users.some((u) => u.email === email)) {
      return { ok: false, error: 'Este correo ya está registrado. Inicia sesión.' };
    }
    users.push({
      id: 'usr_' + Date.now(),
      username: data.username.trim(),
      gender: data.gender,
      email: email,
      password: data.password,          
      birthDate: data.birthDate,
      province: data.province,
      phone: '',
      avatar: null
    });
    return this._writeUsers(users)
      ? { ok: true }
      : { ok: false, error: 'No se pudo guardar la cuenta en este dispositivo.' };
  },

 
  async login(email, password) {
    const user = this._readUsers().find(
      (u) => u.email === this._normalizeEmail(email) && u.password === password
    );
    if (!user) return { ok: false, error: 'Correo o contraseña incorrectos.' };
    try { localStorage.setItem(STORAGE_KEYS.session, user.id); } catch (e) {}
    return { ok: true, user: user };
  },

 
  async logout() {
    try { localStorage.removeItem(STORAGE_KEYS.session); } catch (e) {}
    return { ok: true };
  },

 
  async getCurrentUser() {
    let id = null;
    try { id = localStorage.getItem(STORAGE_KEYS.session); } catch (e) {}
    if (!id) return null;
    return this._readUsers().find((u) => u.id === id) || null;
  },

 
  async updateUser(changes) {
    const current = await this.getCurrentUser();
    if (!current) return { ok: false, error: 'No hay sesión activa.' };
    const users = this._readUsers();
    if (changes.email) {
      changes.email = this._normalizeEmail(changes.email);
      if (users.some((u) => u.id !== current.id && u.email === changes.email)) {
        return { ok: false, error: 'Ese correo ya está en uso por otra cuenta.' };
      }
    }
    const index = users.findIndex((u) => u.id === current.id);
    Object.assign(users[index], changes);
    return this._writeUsers(users)
      ? { ok: true, user: users[index] }
      : { ok: false, error: 'No se pudo guardar (almacenamiento lleno).' };
  },

 
  async changePassword(currentPassword, newPassword) {
    const current = await this.getCurrentUser();
    if (!current) return { ok: false, error: 'No hay sesión activa.' };
    if (current.password !== currentPassword) return { ok: false, error: 'La contraseña actual no es correcta.' };
    return this.updateUser({ password: newPassword });
  },

 
  async deleteAccount() {
    const current = await this.getCurrentUser();
    if (!current) return { ok: false, error: 'No hay sesión activa.' };
    this._writeUsers(this._readUsers().filter((u) => u.id !== current.id));
    await this.logout();
    return { ok: true };
  }
};


function getSavedTheme() {
  try { return localStorage.getItem(STORAGE_KEYS.theme); } catch (e) { return null; }
}


function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark-mode', isDark);
  const button = $('theme-toggle');
  if (button) {
    button.textContent = isDark ? '☀️' : '🌙';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
}

function initTheme() {
  applyTheme(document.documentElement.classList.contains('dark-mode'));

  const button = $('theme-toggle');
  if (button) {
    button.addEventListener('click', () => {
      const isDark = !document.documentElement.classList.contains('dark-mode');
      applyTheme(isDark);
      try { localStorage.setItem(STORAGE_KEYS.theme, isDark ? 'dark' : 'light'); } catch (e) {}
    });
  }

 
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEYS.theme) applyTheme(event.newValue === 'dark');
  });
}


let toastTimer = null;

function showToast(message, type = 'success') {
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}


async function renderNavbarUser() {
  const slot = $('nav-user-slot');
  if (!slot) return;
  const user = await AuthService.getCurrentUser();
  slot.replaceChildren();

  if (user) {
    const link = document.createElement('a');
    link.className = 'btn-nav-avatar';
    link.href = 'dashboard.html';
    link.setAttribute('aria-label', 'Mi perfil: ' + user.username);

    const circle = document.createElement('span');
    circle.className = 'nav-avatar-circle';
    circle.setAttribute('aria-hidden', 'true');
    if (user.avatar && String(user.avatar).startsWith('data:image/')) {
      circle.style.backgroundImage = 'url("' + user.avatar + '")';
    } else {
      circle.textContent = (user.username || 'U').charAt(0).toUpperCase();
    }

    const label = document.createElement('span');
    label.textContent = 'Mi Perfil';
    link.append(circle, label);
    slot.appendChild(link);
  } else {
    const link = document.createElement('a');
    link.className = 'btn-nav-login';
    link.href = 'login.html';
    link.textContent = 'Iniciar Sesión';
    slot.appendChild(link);
  }
}


async function initSidebar() {
  const sidebar = $('sidebar');
  const toggle = $('menu-toggle');
  const backdrop = $('sidebar-backdrop');
  if (!sidebar || !toggle) return;

  const user = await AuthService.getCurrentUser();

 
  const profile = sidebar.querySelector('.sidebar-profile');
  const avatar = $('sidebar-avatar-box');
  if (user) {
    profile.classList.add('is-online');
    $('sidebar-name').textContent = user.username;
    $('sidebar-status').textContent = 'Conectado';
    if (user.avatar && String(user.avatar).startsWith('data:image/')) {
      avatar.style.backgroundImage = 'url("' + user.avatar + '")';
      $('sidebar-avatar').textContent = '';
    } else {
      $('sidebar-avatar').textContent = (user.username || 'U').charAt(0).toUpperCase();
    }
    $('sidebar-logout').hidden = false;
    $('sidebar-guest').hidden = true;
  } else {
    $('sidebar-guest').hidden = false;
   
    sidebar.querySelectorAll('[data-requires-auth]').forEach((link) => { link.setAttribute('href', 'login.html'); });
  }

 
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  sidebar.querySelectorAll('a.sidebar-link').forEach((link) => {
    const target = link.dataset.page || '';
    if (target && target === currentFile) link.setAttribute('aria-current', 'page');
  });

 
  const html = document.documentElement;
  function focusables() { return sidebar.querySelectorAll('a[href], button:not([hidden])'); }
  function openSidebar() {
    html.classList.add('sidebar-open');
    sidebar.removeAttribute('inert');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Cerrar menú lateral');
    setTimeout(() => { const first = focusables()[0]; if (first) first.focus(); }, 60);
  }
  function closeSidebar(returnFocus = true) {
    html.classList.remove('sidebar-open');
    sidebar.setAttribute('inert', '');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú lateral');
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => { html.classList.contains('sidebar-open') ? closeSidebar() : openSidebar(); });
  $('sidebar-close').addEventListener('click', () => closeSidebar());
  backdrop.addEventListener('click', () => closeSidebar());
  document.addEventListener('keydown', (event) => {
    if (!html.classList.contains('sidebar-open')) return;
    if (event.key === 'Escape') { closeSidebar(); return; }
    if (event.key !== 'Tab') return;
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
 
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) closeSidebar(false);
  });

 
  $('sidebar-logout').addEventListener('click', async () => {
    closeSidebar(false);
    await AuthService.logout();
    showToast('Sesión cerrada correctamente.', 'success');
    setTimeout(() => navigateTo('index.html'), 700);
  });
}


async function requireAuth() {
  const user = await AuthService.getCurrentUser();
  if (!user) { window.location.replace('login.html'); return null; }
  return user;
}


function initPlaceholderLinks() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('[data-soon]');
    if (!link) return;
    event.preventDefault();
    showToast(link.dataset.soon + ': documento disponible próximamente.', 'success');
  });
}


function setFormMessage(id, text, type) {
  const box = $(id);
  if (!box) return;
  box.textContent = text;
  box.className = 'form-message' + (type === 'success' ? ' success' : '');
}


function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const reduceMotion = isReducedMotion();
 
  if (!('IntersectionObserver' in window) || reduceMotion) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

 
  items.forEach((el) => {
    const siblings = el.parentElement.querySelectorAll(':scope > .reveal');
    const position = Array.prototype.indexOf.call(siblings, el);
    el.style.setProperty('--reveal-delay', (Math.min(position, 4) * 0.08) + 's');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-visible');
      observer.unobserve(el);                       
     
      setTimeout(() => {
        el.classList.remove('reveal', 'is-visible');
        el.style.removeProperty('--reveal-delay');
      }, 1200);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  items.forEach((el) => observer.observe(el));
}


function initCountUp() {
  const numbers = document.querySelectorAll('[data-count]');
  if (!numbers.length) return;
  const finalValue = (el) => Number(el.dataset.count);
  if (!('IntersectionObserver' in window) || isReducedMotion()) {
    numbers.forEach((el) => { el.firstChild.textContent = finalValue(el).toLocaleString('es'); });
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el = entry.target; const end = finalValue(el); const start = performance.now(); const duration = 1400;
      (function tick(now) {
        const progress = Math.min(1, (now - start) / duration);
        el.firstChild.textContent = Math.round(end * (1 - Math.pow(1 - progress, 3))).toLocaleString('es');   
        if (progress < 1) requestAnimationFrame(tick);
      })(start);
    });
  }, { threshold: 0.4 });
  numbers.forEach((el) => observer.observe(el));
}


document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
  initPlaceholderLinks();
  renderNavbarUser();
  initScrollReveal();
  initCountUp();
});

// Cargar el mini robot de Botpress v5.0 en toda la web
(function() {
  // 1. Inyectar el motor principal de Botpress
  const script1 = document.createElement('script');
  script1.src = 'https://botpress.cloud';
  document.body.appendChild(script1);

  // 2. Inyectar la configuración específica de tu bot kivoLinkPag
  script1.onload = function() {
    const script2 = document.createElement('script');
    script2.src = 'https://bpcontent.cloud';
    script2.defer = true;
    document.body.appendChild(script2);

    // 3. Avisar al robot qué página y título está viendo el usuario
    script2.onload = function() {
      if (window.botpress) {
        window.botpress.on('webchat:ready', () => {
          window.botpress.updateUser({
            data: {
              paginaActual: window.location.pathname,
              tituloPagina: document.title
            }
          });
        });
      }
    };
  };
})();
