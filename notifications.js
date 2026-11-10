
'use strict';

const NOTIFICATIONS = [
  { id: 'n1', icon: '⬆️', title: 'Actualización del guante disponible', text: 'Hay una versión nueva lista para instalar.', time: 'Hace 5 min', href: 'device.html' },
  { id: 'n2', icon: '💬', title: 'Nuevo mensaje en el chat comunitario', text: 'Mariana R. te escribió en el canal General.', time: 'Hace 20 min', href: 'chat.html' },
  { id: 'n3', icon: '✅', title: 'Tu duda en el centro de ayuda fue respondida', text: 'Ya puedes ver la respuesta de nuestro equipo.', time: 'Hace 2 horas', href: 'help.html' }
];
const READ_KEY = 'kivolink_notif_read';

function readIds() { try { return JSON.parse(localStorage.getItem(READ_KEY)) || []; } catch (e) { return []; } }
function saveIds(ids) { try { localStorage.setItem(READ_KEY, JSON.stringify(ids)); } catch (e) {} }

document.addEventListener('DOMContentLoaded', async () => {
  const wrap = $('notif-wrap');
  if (!wrap) return;
  const user = await AuthService.getCurrentUser();
  if (!user) return;                                  
  wrap.hidden = false;
  const sideButton = $('sidebar-notif'), sideCount = $('sidebar-notif-count');
  if (sideButton) sideButton.hidden = false;                

  const button = $('notif-btn'), panel = $('notif-panel'), badge = $('notif-badge'), list = $('notif-list');

 
  function render() {
    const read = readIds();
    list.replaceChildren();
    let unread = 0;
    NOTIFICATIONS.forEach((n) => {
      const isRead = read.includes(n.id);
      if (!isRead) unread++;
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'notif-item' + (isRead ? '' : ' is-unread');
      link.href = n.href; link.dataset.id = n.id;
      const icon = document.createElement('span'); icon.className = 'notif-icon'; icon.textContent = n.icon; icon.setAttribute('aria-hidden', 'true');
      const body = document.createElement('div');
      const title = document.createElement('p'); title.className = 'notif-title'; title.textContent = n.title;
      const text = document.createElement('p'); text.className = 'notif-text'; text.textContent = n.text;
      const time = document.createElement('p'); time.className = 'notif-time'; time.textContent = n.time + (isRead ? '' : ' · Sin leer');
      body.append(title, text, time); link.append(icon, body); li.appendChild(link); list.appendChild(li);
    });
    badge.hidden = unread === 0; badge.textContent = String(unread);
    if (sideCount) { sideCount.hidden = unread === 0; sideCount.textContent = String(unread); }
    button.setAttribute('aria-label', unread ? 'Notificaciones: ' + unread + ' sin leer' : 'Notificaciones: no hay nuevas');
    $('notif-empty').hidden = unread !== 0;
  }

  function open() { panel.hidden = false; button.setAttribute('aria-expanded', 'true'); }
  function close(returnFocus) { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); if (returnFocus) button.focus(); }

  button.addEventListener('click', () => (panel.hidden ? open() : close(false)));
  document.addEventListener('click', (event) => { if (!panel.hidden && !wrap.contains(event.target)) close(false); });   
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) close(true); });
 
  list.addEventListener('click', (event) => {
    const item = event.target.closest('.notif-item'); if (!item) return;
    const ids = readIds(); if (!ids.includes(item.dataset.id)) { ids.push(item.dataset.id); saveIds(ids); }
  });
 
  if (sideButton) sideButton.addEventListener('click', (event) => {
    event.stopPropagation();                               
    const closeMenu = $('sidebar-close'); if (closeMenu) closeMenu.click();
    setTimeout(open, 200);
  });
  $('notif-readall').addEventListener('click', () => { saveIds(NOTIFICATIONS.map((n) => n.id)); render(); });

  render();
});
