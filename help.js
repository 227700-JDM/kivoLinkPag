
'use strict';

const TICKETS_KEY = 'kivolink_tickets';

const SupportService = {
  async submit(data) {
    let tickets = [];
    try { tickets = JSON.parse(localStorage.getItem(TICKETS_KEY)) || []; } catch (e) {}
    const ticket = { id: 'KL-' + String(Date.now()).slice(-6), email: data.email.trim().toLowerCase(),
      topic: data.topic, message: data.message.trim(), createdAt: Date.now() };
    tickets.push(ticket);
    try { localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets)); } catch (e) {}
    return { ok: true, ticket: ticket };
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  const form = $('support-form');
  const message = $('support-message');
  const counter = $('support-count');

 
  const user = await AuthService.getCurrentUser();
  if (user) form.elements.user_email.value = user.email;

  message.addEventListener('input', () => { counter.textContent = message.value.length + ' / 1000'; });

  form.addEventListener('submit', async (event) => {
    if (BACKEND_ENABLED) return;
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); setFormMessage('support-feedback', 'Revisa los campos obligatorios.', 'error'); return; }
    const button = $('support-submit');
    button.disabled = true; form.setAttribute('aria-busy', 'true');
    const result = await SupportService.submit({ email: form.elements.user_email.value, topic: form.elements.support_topic.value, message: message.value });
    form.removeAttribute('aria-busy');
    if (!result.ok) { button.disabled = false; setFormMessage('support-feedback', 'No se pudo enviar. Inténtalo de nuevo.', 'error'); return; }

   
    $('ticket-id').textContent = 'Ticket ' + result.ticket.id;
    form.hidden = true;
    const success = $('support-success');
    success.hidden = false;
    requestAnimationFrame(() => success.classList.add('is-shown'));
    success.focus();                                              
    showToast('Mensaje enviado con éxito.', 'success');
  });

  $('support-again').addEventListener('click', () => {
    form.reset(); if (user) form.elements.user_email.value = user.email;
    counter.textContent = '0 / 1000'; button_reset();
    $('support-success').hidden = true; $('support-success').classList.remove('is-shown');
    form.hidden = false; form.elements.user_email.focus();
  });
  function button_reset() { $('support-submit').disabled = false; setFormMessage('support-feedback', '', 'error'); }
});
