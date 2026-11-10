
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
 
  if (await AuthService.getCurrentUser()) {
    window.location.replace('index.html');
    return;
  }

  const form = $('login-form');
  const submitButton = $('login-submit');

  form.addEventListener('submit', async (event) => {
    if (BACKEND_ENABLED) return;                  
    event.preventDefault();                       
    if (!form.checkValidity()) { form.reportValidity(); return; }

    submitButton.disabled = true;                 
    form.setAttribute('aria-busy', 'true');
    setFormMessage('login-message', '', 'error');

    const result = await AuthService.login(form.elements.user_email.value, form.elements.user_password.value);

    form.removeAttribute('aria-busy');
    if (!result.ok) {
      submitButton.disabled = false;
      setFormMessage('login-message', result.error, 'error');
      showToast(result.error, 'error');
      form.elements.user_password.focus();
      return;
    }
    showToast('¡Bienvenido de nuevo, ' + result.user.username + '!', 'success');
    setTimeout(() => { navigateTo('index.html'); }, 900);
  });
});
