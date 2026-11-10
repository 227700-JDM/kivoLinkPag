
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = $('register-form');
  const submitButton = $('register-submit');

 
  form.elements.birth_date.max = new Date().toISOString().split('T')[0];

  form.addEventListener('submit', async (event) => {
    if (BACKEND_ENABLED) return;                  
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    submitButton.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setFormMessage('register-message', '', 'error');

    const result = await AuthService.register({
      username: form.elements.full_name.value,
      gender: form.elements.gender.value,
      email: form.elements.user_email.value,
      password: form.elements.user_password.value,
      birthDate: form.elements.birth_date.value,
      province: form.elements.province.value
    });

    form.removeAttribute('aria-busy');
    if (!result.ok) {
      submitButton.disabled = false;
      setFormMessage('register-message', result.error, 'error');
      showToast(result.error, 'error');
      return;
    }

   
    setFormMessage('register-message', '¡Registro exitoso! Redirigiendo a Iniciar Sesión…', 'success');
    showToast('¡Registro exitoso! Ahora inicia sesión.', 'success');
    form.reset();
    setTimeout(() => { navigateTo('login.html'); }, 1200);
  });
});
