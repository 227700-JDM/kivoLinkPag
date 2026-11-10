
'use strict';

const CHANNELS = [
  { id: 'general', name: 'General', topic: 'Conversación abierta para toda la comunidad' },
  { id: 'families', name: 'Familias', topic: 'Experiencias y apoyo entre familiares y personas usuarias' },
  { id: 'devs', name: 'Equipo y desarrollo', topic: 'Ideas y dudas sobre cómo se arma el guante' },
  { id: 'support', name: 'Apoyo mutuo', topic: 'Un espacio respetuoso para compartir y acompañarnos' }
];
const MEMBERS = [
  { name: 'Equipo KivoLink', away: false }, { name: 'Mariana R.', away: false },
  { name: 'Dr. Tomás V.', away: true }, { name: 'Lucía', away: false }, { name: 'Francoxd (equipo)', away: false }
];

const BOT_REPLIES = {
  general: ['¡Bienvenido/a a la comunidad! 👋', 'Qué bueno leerte, cuéntanos más.', 'Gracias por compartir, nos ayuda mucho.'],
  families: ['A nosotros nos ayudó practicar 10 minutos por día.', 'Gracias por contarlo, es muy valioso para otras familias.', 'Mucho ánimo, cada avance cuenta 💛'],
  devs: ['Prueba revisar que todos los cables estén bien conectados.', '¿Probaste apagar y prender el guante? A veces ayuda.', 'Si quieres, cuéntanos qué ves en la pantalla y lo revisamos juntos.'],
  support: ['Estamos para apoyarte. Gracias por escribir.', 'No estás solo/a en esto 💙', 'Gracias por tu confianza, aquí te leemos.']
};

const ChatService = {
  key: (channel) => 'kivolink_chat_' + channel,
  list(channel) { try { return JSON.parse(localStorage.getItem(this.key(channel))) || []; } catch (e) { return []; } },
  send(channel, message) {
    const all = this.list(channel); all.push(message);
    try { localStorage.setItem(this.key(channel), JSON.stringify(all.slice(-100))); } catch (e) {}
  }
};

let me = null;
let activeChannel = 'general';

function node(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}
function clock(ts) { return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }); }

function buildMessage(msg) {
  const own = msg.authorId === me.id;
  const item = node('div', 'msg' + (own ? ' is-own' : ''));
  item.appendChild(node('span', 'avatar-sm ' + (own ? '' : 'tone-blue'), msg.author.charAt(0).toUpperCase()));
  const bubble = node('div', 'msg-bubble');
  bubble.append(node('p', 'msg-author', msg.author), node('p', 'msg-text', msg.text), node('p', 'msg-time', clock(msg.createdAt)));
  item.appendChild(bubble);
  return item;
}

function renderLog(scrollToEnd = true) {
  const log = $('chat-log');
  log.replaceChildren();
  const messages = ChatService.list(activeChannel);
  if (!messages.length) log.appendChild(node('p', 'empty-state', 'Todavía no hay mensajes en este canal. ¡Escribe el primero!'));
  messages.forEach((m) => log.appendChild(buildMessage(m)));
  if (scrollToEnd) log.scrollTop = log.scrollHeight;
}

function selectChannel(id) {
  activeChannel = id;
  if ($('chat-channel')) $('chat-channel').value = id;      
  const channel = CHANNELS.find((c) => c.id === id);
  $('chat-title').textContent = '# ' + channel.name;
  $('chat-topic').textContent = channel.topic;
  document.querySelectorAll('.channel-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.channel === id)));
  renderLog();
}


function simulateReply() {
  const replies = BOT_REPLIES[activeChannel];
  const member = MEMBERS.filter((m) => !m.away)[Math.floor(Math.random() * 4)];
  const channelAtSend = activeChannel;
  const log = $('chat-log');
  const typing = node('p', 'typing');
  typing.append(document.createTextNode(member.name + ' está escribiendo '));
  const dots = node('span', 'typing-dots'); dots.append(node('span'), node('span'), node('span'));
  typing.appendChild(dots);
  log.appendChild(typing); log.scrollTop = log.scrollHeight;
  setTimeout(() => {
    typing.remove();
    ChatService.send(channelAtSend, { id: 'm_' + Date.now(), authorId: 'bot', author: member.name,
      text: replies[Math.floor(Math.random() * replies.length)], createdAt: Date.now() });
    if (channelAtSend === activeChannel) renderLog();
  }, isReducedMotion() ? 600 : 1500 + Math.random() * 1200);
}

document.addEventListener('DOMContentLoaded', async () => {
  me = await requireAuth();
  if (!me) return;

 
  const list = $('channel-list');
  CHANNELS.forEach((c) => {
    const li = node('li'); const btn = node('button', 'channel-btn');
    btn.type = 'button'; btn.dataset.channel = c.id; btn.setAttribute('aria-pressed', 'false');
    btn.append(node('span', 'channel-hash', '#'), document.createTextNode(c.name));
    btn.addEventListener('click', () => selectChannel(c.id));
    li.appendChild(btn); list.appendChild(li);
  });

 
  const members = $('member-list');
  [{ name: me.username + ' (tú)', away: false }].concat(MEMBERS).forEach((m) => {
    const li = node('li', 'member'); li.appendChild(node('span', 'avatar-sm tone-gray', m.name.charAt(0).toUpperCase()));
    li.appendChild(node('span', '', m.name));
    const dot = node('span', 'member-status' + (m.away ? ' is-away' : '')); dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', m.away ? 'Ausente' : 'En línea'); li.appendChild(dot); members.appendChild(li);
  });

 
  const form = $('chat-form'); const input = $('chat-input');
  form.addEventListener('submit', (event) => {
    if (BACKEND_ENABLED) return;
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    ChatService.send(activeChannel, { id: 'm_' + Date.now(), authorId: me.id, author: me.username, text: text, createdAt: Date.now() });
    input.value = ''; renderLog();
    simulateReply();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
  });

 
  window.addEventListener('storage', (event) => {
    if (event.key === ChatService.key(activeChannel)) renderLog();
  });

  selectChannel('general');
});
