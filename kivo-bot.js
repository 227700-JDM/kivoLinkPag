/* ==========================================================================
   kivo-bot.js — Kivo, el robot guía de KivoLink (con cerebro Gemini).
   Qué hace:
   1) Dibuja el robot en la esquina y le cambia el gesto: idle, thinking, talking, happy, pointing.
   2) Abre un chat. Las preguntas viajan a TU Worker (worker/worker-gemini.js), que guarda la
      clave de Gemini en secreto. La clave NUNCA está en este archivo.
   3) Gemini responde un JSON: {"respuesta": "texto", "accion": "ID_DE_SECCION"}.
      Si la acción es válida, Kivo señala la sección, baja hasta ella y la ilumina 3 segundos.
   ========================================================================== */
(function () {
  'use strict';
 
  /* ----- 1) CONFIGURACIÓN (cambia solo WORKER_URL) ----- */
  const CONFIG = Object.assign({
    WORKER_URL: '',            // ejemplo: 'https://kivo.tu-usuario.workers.dev'  (vacío = modo sin Gemini)
    HIGHLIGHT_MS: 3000,        // cuánto dura el borde brillante
    MAX_HISTORY: 8,            // cuántos mensajes anteriores se envían a Gemini
    TIMEOUT_MS: 20000          // espera máxima por la respuesta
  }, window.KIVO_CONFIG || {});
 
  /* ----- 2) ACCIONES PERMITIDAS: ID → dónde está y qué iluminar -----
     page: página donde está (si no estás ahí, Kivo te lleva).  sel: lo que se ilumina.
     login: true si hay que iniciar sesión para entrar.  desc: explicación para Gemini. */
  const ACTIONS = {
    inicio:                 { page: 'index.html',    sel: '#home',            desc: 'portada con la presentación del guante' },
    caracteristicas:        { page: 'index.html',    sel: '#features',        desc: 'tarjetas de características' },
    metas_guante:           { page: 'index.html',    sel: '#technology',      desc: 'metas de diseño del guante (batería, conexión, rapidez)' },
    impacto:                { page: 'index.html',    sel: '#impact',          desc: 'impacto social y bajo costo' },
    inteligencia_artificial:{ page: 'index.html',    sel: '#ai',              desc: 'cómo el guante entiende las señas' },
    como_funciona:          { page: 'index.html',    sel: '#how-it-works',    desc: 'cómo funciona en 3 pasos' },
    casos:                  { page: 'index.html',    sel: '#cases',           desc: 'historias de ejemplo de la comunidad' },
    redes_sociales:         { page: null,            sel: '.footer-social',   desc: 'Instagram del proyecto y del equipo (contacto por redes)' },
    contacto:               { page: 'help.html',     sel: '#support-form',    desc: 'formulario del Centro de Ayuda para contactar al equipo' },
    crear_cuenta:           { page: 'register.html', sel: '#register-form',   desc: 'crear una cuenta' },
    iniciar_sesion:         { page: 'login.html',    sel: '#login-form',      desc: 'iniciar sesión' },
    publicaciones:          { page: 'posts.html',    sel: '#composer-form',   desc: 'foro de publicaciones', login: true },
    mi_dispositivo:         { page: 'device.html',   sel: '#status-hero',     desc: 'simulador del guante (Mi Dispositivo)', login: true },
    chat:                   { page: 'chat.html',     sel: '.chat-shell',      desc: 'chat comunitario', login: true },
    configuracion:          { page: 'settings.html', sel: '#settings-form',   desc: 'configuración: colores, fondo, cursor', login: true },
    mi_perfil:              { page: 'dashboard.html',sel: '.profile-card',    desc: 'perfil de la persona', login: true },
    menu:                   { page: null,            sel: '#menu-toggle',     desc: 'botón de tres líneas que abre el menú' },
    tema:                   { page: null,            sel: '#theme-toggle',    desc: 'botón sol/luna para modo claro u oscuro' },
    musica:                 { page: null,            sel: '#music-toggle',    desc: 'botón de música de fondo' }
  };
 
  /* ----- 3) SYSTEM PROMPT: la personalidad y las reglas de Kivo ----- */
  const SYSTEM_PROMPT = [
    'Eres "Kivo", el robot guía oficial de KivoLink. KivoLink es un proyecto de tecnología inclusiva: un guante inteligente de bajo costo que busca convertir el lenguaje de señas en voz y texto.',
    'Hablas SIEMPRE en español simple, amable y breve: máximo 2 frases cortas. Sin palabras técnicas.',
    'REGLAS DE VERDAD: el guante físico está EN DESARROLLO y NO está a la venta. La batería de 18 horas, la conexión inalámbrica y la traducción rápida son METAS, no hechos. "Mi Dispositivo" es un simulador. Las publicaciones, el chat, los casos y las notificaciones son de ejemplo.',
    'KivoLink es un proyecto PRIVADO con todos los derechos reservados. NUNCA digas que es de código abierto, open source ni un repositorio público.',
    'No inventes precios, fechas, apps descargables, certificaciones médicas ni qué lengua de señas reconoce. No pidas contraseñas ni datos privados. No des consejos médicos ni legales. Si no sabes algo, sugiere el Centro de Ayuda.',
    'ACCIONES: si la persona pide ir a un lugar, ver algo o contactarlos, elige UNA acción de esta lista:',
    Object.keys(ACTIONS).map(function (id) { return '- ' + id + ': ' + ACTIONS[id].desc; }).join('\n'),
    'Ejemplos: "llévame al chat" → accion "chat". "quiero contactarlos" → accion "contacto". "cómo funciona" → accion "como_funciona".',
    'FORMATO: responde SOLO un JSON válido: {"respuesta": "texto para la persona", "accion": "ID_DE_SECCION"}. Si no hace falta ninguna acción, usa "accion": null. No uses ningún ID fuera de la lista.'
  ].join('\n');
 
  const PAGE = (location.pathname.split('/').pop() || 'index.html');
  const STATES = ['idle', 'thinking', 'talking', 'happy', 'pointing'];
  const reduceMotion = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('pref-calm'); };
 
  /* ----- 4) DIBUJO DEL ROBOT Y VENTANA ----- */
  const ROBOT_SVG = '<svg class="kivo-svg" viewBox="0 0 120 140" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="kivoMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c3cde3"/></linearGradient></defs>' +
    '<ellipse class="kivo-shadow" cx="60" cy="134" rx="26" ry="4"/>' +
    '<g class="kivo-float"><g class="kivo-lean">' +
      '<g class="kivo-antenna"><line x1="60" y1="24" x2="60" y2="10"/><circle class="kivo-bulb" cx="60" cy="8" r="5"/></g>' +
      '<g class="kivo-thought"><circle cx="90" cy="16" r="2.5"/><circle cx="98" cy="9" r="3.5"/><circle cx="108" cy="3" r="4.5"/></g>' +
      '<g class="kivo-waves"><path d="M14 50 q-7 8 0 16"/><path d="M8 46 q-11 12 0 24"/><path d="M106 50 q7 8 0 16"/><path d="M112 46 q11 12 0 24"/></g>' +
      '<rect class="kivo-ear" x="14" y="46" width="9" height="22" rx="4.5"/><rect class="kivo-ear" x="97" y="46" width="9" height="22" rx="4.5"/>' +
      '<rect class="kivo-head" x="20" y="24" width="80" height="62" rx="26"/>' +
      '<rect class="kivo-screen" x="28" y="33" width="64" height="44" rx="19"/>' +
      '<g class="kivo-eyes"><ellipse class="kivo-eye" cx="46" cy="53" rx="6.5" ry="8.5"/><ellipse class="kivo-eye" cx="74" cy="53" rx="6.5" ry="8.5"/></g>' +
      '<g class="kivo-eyes-happy"><path d="M39 57 q7 -12 14 0"/><path d="M67 57 q7 -12 14 0"/></g>' +
      '<path class="kivo-mouth" d="M52 66 q8 6 16 0"/>' +
      '<circle class="kivo-cheek" cx="36" cy="66" r="4.5"/><circle class="kivo-cheek" cx="84" cy="66" r="4.5"/>' +
      '<rect class="kivo-body" x="36" y="88" width="48" height="34" rx="15"/><circle class="kivo-core" cx="60" cy="105" r="5.5"/>' +
      '<rect class="kivo-arm kivo-arm-rest-left" x="24" y="94" width="11" height="22" rx="5.5"/>' +
      '<rect class="kivo-arm" x="85" y="94" width="11" height="22" rx="5.5"/>' +
      '<g class="kivo-arm-point"><line x1="38" y1="97" x2="9" y2="79"/><circle class="kivo-arm" cx="6" cy="77" r="7.5"/></g>' +
    '</g></g></svg>';
 
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
 
  const bot = el('div', 'kivo-bot idle'); bot.id = 'kivo-bot';
  bot.innerHTML =
    '<section class="kivo-window" id="kivo-window" role="dialog" aria-label="Chat con Kivo, el robot guía" hidden>' +
      '<header class="kivo-header"><span class="kivo-avatar" aria-hidden="true">🤖</span><div><strong>Kivo</strong><span id="kivo-status">En línea</span></div>' +
      '<button type="button" class="kivo-close" id="kivo-close" aria-label="Cerrar el chat">✕</button></header>' +
      '<div class="kivo-messages" id="kivo-messages" role="log" aria-live="polite" aria-label="Mensajes con Kivo"></div>' +
      '<div class="kivo-suggestions" id="kivo-suggestions"></div>' +
      '<div class="kivo-composer"><label class="visually-hidden" for="kivo-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Escribe tu mensaje</label>' +
      '<input class="kivo-input" id="kivo-input" type="text" maxlength="400" placeholder="Pregúntame o pídeme que te lleve…" autocomplete="off">' +
      '<button type="button" class="kivo-send" id="kivo-send" aria-label="Enviar mensaje">➤</button></div>' +
    '</section>' +
    '<div class="kivo-hello" id="kivo-hello" role="status" hidden></div>' +
    '<button type="button" class="kivo-toggle" id="kivo-toggle" aria-expanded="false" aria-controls="kivo-window" aria-label="Abrir el chat con Kivo, tu guía">' +
      ROBOT_SVG + '<span class="kivo-dot" aria-hidden="true"></span></button>';
 
  const $ = function (id) { return bot.querySelector('#' + id); };
  let stateTimer = null, busy = false, history = [], user = undefined;
 
  /* ----- 5) GESTOS ----- */
  function setState(name, ms) {
    clearTimeout(stateTimer);
    STATES.forEach(function (s) { bot.classList.remove(s); });
    bot.classList.add(name);
    if (ms) stateTimer = setTimeout(function () { setState('idle'); }, ms);
  }
 
  /* ----- 6) CHAT ----- */
  function addMsg(text, mine) {
    const m = el('div', 'kivo-msg' + (mine ? ' is-me' : '')); $('kivo-messages').appendChild(m);
    const box = $('kivo-messages');
    if (mine || reduceMotion()) { m.textContent = text; box.scrollTop = box.scrollHeight; return Promise.resolve(); }
    /* La respuesta se "escribe" poco a poco mientras el robot habla */
    setState('talking');
    return new Promise(function (done) {
      let i = 0;
      const t = setInterval(function () {
        i += 2; m.textContent = text.slice(0, i); box.scrollTop = box.scrollHeight;
        if (i >= text.length) { clearInterval(t); done(); }
      }, 22);
    });
  }
  function showDots(on) {
    let d = $('kivo-messages').querySelector('.kivo-dots');
    if (on && !d) { d = el('div', 'kivo-dots'); d.innerHTML = '<i></i><i></i><i></i>'; $('kivo-messages').appendChild(d); }
    if (!on && d) d.remove();
    $('kivo-status').textContent = on ? 'Pensando…' : 'En línea';
  }
  function openChat(open) {
    $('kivo-window').hidden = !open;
    $('kivo-toggle').setAttribute('aria-expanded', String(open));
    $('kivo-hello').hidden = true;
    bot.classList.add('is-opened');
    if (open) { if (!$('kivo-messages').children.length) welcome(); setTimeout(function () { $('kivo-input').focus(); }, 80); }
  }
  function welcome() {
    addMsg('¡Hola! Soy Kivo 🤖, tu guía en KivoLink. Puedo explicarte cosas o llevarte a cualquier parte de la página. ¿Qué buscas?').then(function () { setState('idle'); });
    const chips = ['¿Qué es KivoLink?', 'Llévame al chat', 'Quiero contactarlos', '¿Cómo funciona?'];
    chips.forEach(function (c) {
      const b = el('button', 'kivo-chip', c); b.type = 'button';
      b.addEventListener('click', function () { send(c); });
      $('kivo-suggestions').appendChild(b);
    });
  }
 
  /* ----- 7) CEREBRO: Gemini (vía Worker) o respuestas básicas si no hay Worker ----- */
  async function askGemini(text) {
    const ctl = new AbortController(); const timer = setTimeout(function () { ctl.abort(); }, CONFIG.TIMEOUT_MS);
    try {
      const res = await fetch(CONFIG.WORKER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ message: text, history: history.slice(-CONFIG.MAX_HISTORY), page: PAGE, systemPrompt: SYSTEM_PROMPT })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();                             // {respuesta, accion}
    } finally { clearTimeout(timer); }
  }
  const LOCAL = [
    [/chat|conversar|hablar con/, 'chat'], [/contact|ayuda|soporte|escrib/, 'contacto'], [/funciona|pasos/, 'como_funciona'],
    [/impacto|social|costo/, 'impacto'], [/guante|meta|bater|inal/, 'metas_guante'], [/inteligencia|\bia\b|entiende/, 'inteligencia_artificial'],
    [/public|foro/, 'publicaciones'], [/dispositiv|esp32/, 'mi_dispositivo'], [/config|color|fondo/, 'configuracion'], [/perfil/, 'mi_perfil'],
    [/crear cuenta|registr/, 'crear_cuenta'], [/sesi[oó]n|login|entrar/, 'iniciar_sesion'], [/instagram|redes/, 'redes_sociales'], [/m[uú]sica/, 'musica'], [/tema|oscuro|claro/, 'tema']
  ];
  function localBrain(text) {
    const t = text.toLowerCase();
    for (let i = 0; i < LOCAL.length; i++) if (LOCAL[i][0].test(t)) return { respuesta: 'Claro, te lo muestro.', accion: LOCAL[i][1] };
    if (/qu[eé] es|kivolink/.test(t)) return { respuesta: 'KivoLink es un proyecto de tecnología inclusiva: un guante inteligente, todavía en desarrollo, para convertir señas en voz y texto.', accion: null };
    return { respuesta: 'Todavía no estoy conectado a mi cerebro de Gemini, pero puedo llevarte a las secciones. Prueba: "llévame al chat".', accion: null };
  }
 
  async function send(text) {
    text = (text || $('kivo-input').value).trim();
    if (!text || busy) return;
    busy = true; $('kivo-send').disabled = true; $('kivo-input').value = ''; $('kivo-suggestions').hidden = true;
    addMsg(text, true); history.push({ role: 'user', text: text });
    setState('thinking'); showDots(true);
    let data;
    try { data = CONFIG.WORKER_URL ? await askGemini(text) : localBrain(text); }
    catch (e) { data = { respuesta: 'Ups, no pude conectarme. Inténtalo de nuevo en un momento.', accion: null }; }
    showDots(false);
    const reply = String((data && data.respuesta) || 'Aquí estoy para ayudarte.');
    history.push({ role: 'model', text: reply });
    await addMsg(reply);
    setState('idle');
    if (data && data.accion) await runAction(String(data.accion));
    busy = false; $('kivo-send').disabled = false;
  }
 
  /* ----- 8) ACCIONES SOBRE LA PÁGINA ----- */
  async function isLogged() {
    if (user === undefined) { /* AuthService viene de core.js */
    try { user = (typeof AuthService !== 'undefined') ? await AuthService.getCurrentUser() : null; } catch (e) { user = null; } }
    return !!user;
  }
  function pickTarget(node) { return node.closest('.panel, .chat-shell, .profile-card, .form-panel, .hero-card, section') || node; }
  function highlight(id) {
    const a = ACTIONS[id];
    let target = document.querySelector(a.sel);
    if (!target || !target.getClientRects().length) target = document.querySelector('#menu-toggle');   // si no se ve, se señala el menú
    if (!target) return;
    if (!/^#(menu|theme|music)-toggle$/.test(a.sel) && a.sel !== '.footer-social') target = pickTarget(target);
    setState('pointing');
    target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    target.classList.add('kivo-highlight');
    setTimeout(function () { target.classList.remove('kivo-highlight'); }, CONFIG.HIGHLIGHT_MS);
    setTimeout(function () { setState('happy', 1900); }, 1500);
    if (window.matchMedia('(max-width: 600px)').matches) openChat(false);                // en celular se cierra el chat para ver la página
  }
  async function runAction(id) {
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, id)) return false;               // solo acciones de la lista
    let a = ACTIONS[id];
    if (a.login && !(await isLogged())) {
      await addMsg('Para entrar ahí primero tienes que iniciar sesión. Te llevo.');
      id = 'iniciar_sesion'; a = ACTIONS[id];
    }
    if (a.page && a.page !== PAGE) {                                                     // otra página: guardamos la acción y vamos
      setState('pointing');
      try { sessionStorage.setItem('kivo_pending', id); } catch (e) {}
      setTimeout(function () { (window.navigateTo || function (u) { location.href = u; })(a.page); }, 500);
      return true;
    }
    highlight(id);
    return true;
  }
 
  /* ----- 9) ARRANQUE ----- */
  function start() {
    document.body.appendChild(bot);
    const root = document.documentElement;
    root.classList.add('kivo-active', 'kivo-themed');
    if (PAGE === 'chat.html') root.classList.add('kivo-chat-page');
 
    $('kivo-toggle').addEventListener('click', function () { openChat($('kivo-window').hidden); });
    $('kivo-close').addEventListener('click', function () { openChat(false); $('kivo-toggle').focus(); });
    $('kivo-send').addEventListener('click', function () { send(); });
    $('kivo-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('kivo-window').hidden) { openChat(false); $('kivo-toggle').focus(); } });
 
    /* ¿Venimos de otra página por una acción de Kivo? Entonces señalamos la sección */
    let pending = null;
    try { pending = sessionStorage.getItem('kivo_pending'); sessionStorage.removeItem('kivo_pending'); } catch (e) {}
    if (pending && ACTIONS[pending]) { setTimeout(function () { highlight(pending); }, 1300); return; }
 
    /* Saludo con globo (una vez por visita) */
    let greeted = false;
    try { greeted = sessionStorage.getItem('kivo_greeted') === '1'; } catch (e) {}
    if (!greeted) setTimeout(function () {
      if (!$('kivo-window').hidden) return;
      const h = $('kivo-hello'); h.textContent = '¡Hola! Soy Kivo 👋 Puedo llevarte a cualquier parte de la página. ¿Qué buscas?'; h.hidden = false;
      setState('talking', 2200);
      try { sessionStorage.setItem('kivo_greeted', '1'); } catch (e) {}
      setTimeout(function () { h.hidden = true; }, 9000);
    }, 3500);
    window.KivoBot = { setState: setState, runAction: runAction, open: openChat };       // para probar desde la consola
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
