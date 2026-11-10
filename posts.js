
'use strict';

const POSTS_KEY = 'kivolink_posts';
const CATEGORIES = { progress: 'Avance', question: 'Pregunta', research: 'Investigación', story: 'Experiencia' };


const SEED_POSTS = [
  { id: 'seed_1', authorId: 'seed', author: 'Equipo KivoLink', role: 'Equipo', category: 'progress',
    text: 'Mejoramos cómo el guante lee los dedos: ahora se ve más estable al mover la mano rápido. ¡Cuéntennos cómo les va con el ajuste!',
    createdAt: Date.now() - 1000 * 60 * 60 * 5, likes: ['seed_a', 'seed_b'], comments: [
      { id: 'c1', author: 'Lucía', text: 'Con el ajuste nuevo, el dedo índice responde mucho mejor.', createdAt: Date.now() - 1000 * 60 * 60 * 3 }] },
  { id: 'seed_2', authorId: 'seed', author: 'Mariana R.', role: 'Familiar', category: 'story',
    text: 'Mi hermano empezó a usar el prototipo en casa. Lo más lindo fue que su primera frase completa salió en menos de una semana de práctica. Gracias por pensar en el costo.',
    createdAt: Date.now() - 1000 * 60 * 60 * 26, likes: ['seed_a'], comments: [] },
  { id: 'seed_3', authorId: 'seed', author: 'Dr. Tomás V.', role: 'Investigación', category: 'research',
    text: '¿Alguien probó que el celular entienda las señas sin usar internet? Quiero comparar qué tan rápido responde.',
    createdAt: Date.now() - 1000 * 60 * 60 * 50, likes: [], comments: [] }
];

const PostsService = {
  _read() {
    try {
      const raw = JSON.parse(localStorage.getItem(POSTS_KEY));
      if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return SEED_POSTS.map((p) => JSON.parse(JSON.stringify(p)));
  },
  _write(posts) { try { localStorage.setItem(POSTS_KEY, JSON.stringify(posts)); } catch (e) {} },
  async list() { return this._read().sort((a, b) => b.createdAt - a.createdAt); },
  async create(user, data) {
    const posts = this._read();
    posts.push({ id: 'p_' + Date.now(), authorId: user.id, author: user.username, role: 'Comunidad',
      category: data.category, text: data.text.trim(), createdAt: Date.now(), likes: [], comments: [] });
    this._write(posts);
  },
  async toggleLike(id, userId) {
    const posts = this._read(); const post = posts.find((p) => p.id === id); if (!post) return;
    const i = post.likes.indexOf(userId);
    if (i === -1) post.likes.push(userId); else post.likes.splice(i, 1);
    this._write(posts);
  },
  async addComment(id, user, text) {
    const posts = this._read(); const post = posts.find((p) => p.id === id); if (!post) return;
    post.comments.push({ id: 'c_' + Date.now(), author: user.username, text: text.trim(), createdAt: Date.now() });
    this._write(posts);
  },
  async remove(id) { this._write(this._read().filter((p) => p.id !== id)); }
};


function timeAgo(timestamp) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'justo ahora';
  if (minutes < 60) return 'hace ' + minutes + ' min';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return 'hace ' + hours + ' h';
  return 'hace ' + Math.floor(hours / 24) + ' d';
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let currentUser = null;
let activeFilter = 'all';


function buildPost(post) {
  const li = el('li', 'post-card');
  li.dataset.id = post.id;

  const head = el('div', 'post-head');
  head.appendChild(el('span', 'avatar-sm', post.author.charAt(0).toUpperCase()));
  const who = el('div');
  who.append(el('p', 'post-author', post.author), el('p', 'post-meta', post.role + ' · ' + timeAgo(post.createdAt)));
  head.append(who, el('span', 'pill pill-accent', CATEGORIES[post.category] || 'Publicación'));

  const body = el('p', 'post-body', post.text);

  const liked = post.likes.includes(currentUser.id);
  const actions = el('div', 'post-actions');
  const likeBtn = el('button', 'btn-soft', (liked ? '♥ ' : '♡ ') + post.likes.length);
  likeBtn.type = 'button'; likeBtn.dataset.action = 'like';
  likeBtn.setAttribute('aria-pressed', String(liked));
  likeBtn.setAttribute('aria-label', 'Me gusta. Total: ' + post.likes.length);
  const commentBtn = el('button', 'btn-soft', '💬 ' + post.comments.length);
  commentBtn.type = 'button'; commentBtn.dataset.action = 'toggle-comments';
  commentBtn.setAttribute('aria-expanded', 'false');
  commentBtn.setAttribute('aria-label', 'Comentarios: ' + post.comments.length);
  actions.append(likeBtn, commentBtn);
  if (post.authorId === currentUser.id) {
    const del = el('button', 'btn-soft is-danger', 'Eliminar');
    del.type = 'button'; del.dataset.action = 'delete';
    actions.appendChild(del);
  }

 
  const comments = el('div', 'comments'); comments.hidden = true;
  post.comments.forEach((c) => {
    const row = el('div', 'comment');
    row.appendChild(el('span', 'avatar-sm tone-gray', c.author.charAt(0).toUpperCase()));
    const col = el('div');
    col.append(el('p', 'comment-name', c.author), el('p', 'comment-text', c.text));
    row.appendChild(col); comments.appendChild(row);
  });
  const form = el('form', 'comment-form'); form.dataset.action = 'comment';
  form.method = 'POST'; form.setAttribute('action', 'comment.php');           
  const postIdField = document.createElement('input');
  postIdField.type = 'hidden'; postIdField.name = 'post_id'; postIdField.value = post.id;
  const input = document.createElement('input');
  input.type = 'text'; input.name = 'comment_text'; input.required = true; input.maxLength = 300;
  input.placeholder = 'Escribe un comentario…'; input.setAttribute('aria-label', 'Escribe un comentario');
  input.setAttribute('aria-required', 'true'); input.autocomplete = 'off';
  const send = el('button', 'btn-soft', 'Enviar'); send.type = 'submit';
  form.append(postIdField, input, send); comments.appendChild(form);

  li.append(head, body, actions, comments);
  return li;
}

async function renderFeed(announce) {
  const feed = $('feed');
  const posts = (await PostsService.list()).filter((p) => activeFilter === 'all' || p.category === activeFilter);
  feed.replaceChildren();
  if (!posts.length) {
    const empty = el('li', 'empty-state', 'Aún no hay publicaciones en esta categoría. ¡Sé la primera persona en compartir algo!');
    feed.appendChild(empty);
  }
  posts.forEach((post) => feed.appendChild(buildPost(post)));
  if (announce) $('feed-status').textContent = announce;
}

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;

  $('composer-avatar').textContent = currentUser.username.charAt(0).toUpperCase();
  const text = $('post-text'); const count = $('post-count');
  text.addEventListener('input', () => { count.textContent = text.value.length + ' / 500'; });

 
  $('composer-form').addEventListener('submit', async (event) => {
    if (BACKEND_ENABLED) return;
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    await PostsService.create(currentUser, { text: text.value, category: form.elements.post_category.value });
    form.reset(); count.textContent = '0 / 500';
    await renderFeed('Publicación enviada.');
    showToast('Publicación enviada a la comunidad.', 'success');
  });

 
  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      await renderFeed('Mostrando: ' + btn.textContent);
    });
  });

 
  const feed = $('feed');
  feed.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('.post-card'); const id = card.dataset.id;
    if (button.dataset.action === 'like') { await PostsService.toggleLike(id, currentUser.id); await renderFeed(); }
    if (button.dataset.action === 'delete') { await PostsService.remove(id); await renderFeed('Publicación eliminada.'); showToast('Publicación eliminada.', 'success'); }
    if (button.dataset.action === 'toggle-comments') {
      const box = card.querySelector('.comments');
      box.hidden = !box.hidden;
      button.setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden) box.querySelector('input').focus();
    }
  });
  feed.addEventListener('submit', async (event) => {
    if (BACKEND_ENABLED) return;
    event.preventDefault();
    const form = event.target.closest('form[data-action="comment"]'); if (!form) return;
    const value = form.elements.comment_text.value;
    if (!value.trim()) return;
    const id = form.closest('.post-card').dataset.id;
    await PostsService.addComment(id, currentUser, value);
    await renderFeed('Comentario añadido.');
    const again = feed.querySelector('[data-id="' + id + '"]');           
    if (again) { again.querySelector('.comments').hidden = false; again.querySelector('[data-action="toggle-comments"]').setAttribute('aria-expanded', 'true'); }
  });

  await renderFeed();
});
