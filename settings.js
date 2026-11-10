
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  const form = $('settings-form');
  const prefs = loadPrefs();
  const field = (name) => form.elements[name];            

 
  function fill() {
    field('accent_color').value = prefs.accent;
    field('particles_enabled').checked = prefs.particles;
    field('particles_direction').value = prefs.particlesDir;
    field('particles_speed').value = prefs.particlesSpeed;
    field('custom_cursor').checked = prefs.cursor;
    field('large_text').checked = prefs.largeText;
    field('high_contrast').checked = prefs.highContrast;
    field('reduce_motion').checked = prefs.calm;
    field('notify_posts').checked = prefs.notifyPosts;
    field('notify_chat').checked = prefs.notifyChat;
    field('ui_theme').value = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
  }
  fill();

 
  if (!CustomCursor.available()) {
    field('custom_cursor').disabled = true;
    field('custom_cursor').checked = false;               
    $('cursor-hint').hidden = false;
  }

 
  let toastTimer = null;
  form.addEventListener('change', () => {
    prefs.accent = field('accent_color').value;
    prefs.particles = field('particles_enabled').checked;
    prefs.particlesDir = field('particles_direction').value;
    prefs.particlesSpeed = field('particles_speed').value;
    if (!field('custom_cursor').disabled) prefs.cursor = field('custom_cursor').checked;   
    prefs.largeText = field('large_text').checked;
    prefs.highContrast = field('high_contrast').checked;
    prefs.calm = field('reduce_motion').checked;
    prefs.notifyPosts = field('notify_posts').checked;
    prefs.notifyChat = field('notify_chat').checked;
    savePrefs(prefs);

   
    applyPrefs(prefs);                                    
    const wantsDark = field('ui_theme').value === 'dark';
    applyTheme(wantsDark);
    try { localStorage.setItem(STORAGE_KEYS.theme, wantsDark ? 'dark' : 'light'); } catch (e) {}
    refreshEffectPrefs();                                 
    Particles.readColors();
    Particles.apply();
    CustomCursor.apply();

    clearTimeout(toastTimer);                             
    toastTimer = setTimeout(() => showToast('Cambios guardados.', 'success'), 400);
  });

 
  new MutationObserver(() => {
    field('ui_theme').value = document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light';
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

 
  form.addEventListener('submit', (event) => {
    if (BACKEND_ENABLED) return;                          
    event.preventDefault();
    showToast('Tus cambios ya están guardados en este navegador.', 'success');
  });

 
  $('password-form').addEventListener('submit', async (event) => {
    if (BACKEND_ENABLED) return;
    event.preventDefault();
    const passwordForm = event.currentTarget;
    if (!passwordForm.checkValidity()) { passwordForm.reportValidity(); return; }
    if (passwordForm.elements.new_password.value !== passwordForm.elements.confirm_password.value) {
      setFormMessage('password-message', 'Las contraseñas nuevas no coinciden.', 'error'); return;
    }
    const result = await AuthService.changePassword(passwordForm.elements.current_password.value, passwordForm.elements.new_password.value);
    if (!result.ok) { setFormMessage('password-message', result.error, 'error'); showToast(result.error, 'error'); return; }
    passwordForm.reset();
    setFormMessage('password-message', 'Contraseña actualizada correctamente.', 'success');
    showToast('Contraseña actualizada.', 'success');
  });
});
