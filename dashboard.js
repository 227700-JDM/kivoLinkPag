
'use strict';

let currentUser = null;      
let modalAction = null;      
let lastFocused = null;      


function paintProfile() {
  const form = $('profile-form');
  form.elements.full_name.value = currentUser.username || '';
  form.elements.user_email.value = currentUser.email || '';
  form.elements.phone.value = currentUser.phone || '';
  form.elements.gender.value = currentUser.gender || '';
  form.elements.birth_date.value = currentUser.birthDate || '';
  form.elements.province.value = currentUser.province || '';

  $('profile-name').textContent = currentUser.username;
  $('profile-email').textContent = currentUser.email;
 
  $('profile-name').classList.remove('skeleton');
  $('profile-email').classList.remove('skeleton');

  const preview = $('avatar-preview');
  if (currentUser.avatar && String(currentUser.avatar).startsWith('data:image/')) {
    preview.style.backgroundImage = 'url("' + currentUser.avatar + '")';
    preview.textContent = '';
  } else {
    preview.style.backgroundImage = 'none';
    preview.textContent = (currentUser.username || 'U').charAt(0).toUpperCase();
  }
}


async function handleProfileSubmit(event) {
  if (BACKEND_ENABLED) return;
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const result = await AuthService.updateUser({
    username: form.elements.full_name.value.trim(),
    email: form.elements.user_email.value,
    phone: form.elements.phone.value.trim(),
    gender: form.elements.gender.value,
    birthDate: form.elements.birth_date.value,
    province: form.elements.province.value
  });
  if (!result.ok) { showToast(result.error, 'error'); return; }

  currentUser = result.user;
  paintProfile();
  renderNavbarUser();
  showToast('Perfil actualizado correctamente.', 'success');
}


function handleAvatarChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Elige un archivo de imagen.', 'error'); return; }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = async () => {
      const size = 256;
      const side = Math.min(image.width, image.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(
        image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size
      );
      const result = await AuthService.updateUser({ avatar: canvas.toDataURL('image/jpeg', 0.8) });
      if (!result.ok) { showToast(result.error, 'error'); return; }
      currentUser = result.user;
      paintProfile();
      renderNavbarUser();
      showToast('Foto de perfil actualizada.', 'success');
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}


function openModal(options) {
  lastFocused = document.activeElement;
  $('modal-icon').textContent = options.icon;
  $('modal-title').textContent = options.title;
  $('modal-description').textContent = options.description;
  $('modal-confirm').textContent = options.confirmLabel;
  modalAction = options.onConfirm;
  $('confirm-modal').classList.add('active');
  $('modal-cancel').focus();                    
}

function closeModal() {
  $('confirm-modal').classList.remove('active');
  modalAction = null;
  if (lastFocused) lastFocused.focus();
}

function handleModalKeys(event) {
  const modal = $('confirm-modal');
  if (!modal.classList.contains('active')) return;
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key !== 'Tab') return;
 
  const focusable = modal.querySelectorAll('button');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}


function requestLogout() {
  openModal({
    icon: '🚪',
    title: '¿Cerrar sesión?',
    description: 'Saldrás de tu cuenta en este navegador. Tus datos guardados permanecerán seguros.',
    confirmLabel: 'Cerrar sesión',
    onConfirm: async () => {
      await AuthService.logout();
      showToast('Sesión cerrada correctamente.', 'success');
      setTimeout(() => { navigateTo('index.html'); }, 800);
    }
  });
}

function requestDeleteAccount() {
  openModal({
    icon: '⚠️',
    title: '¿Eliminar cuenta?',
    description: 'Se borrarán todos tus datos de usuario de forma permanente. Esta acción no se puede deshacer.',
    confirmLabel: 'Sí, eliminar',
    onConfirm: async () => {
      const result = await AuthService.deleteAccount();
      if (!result.ok) { showToast(result.error, 'error'); return; }
      showToast('Cuenta eliminada del sistema.', 'success');
      setTimeout(() => { navigateTo('index.html'); }, 900);
    }
  });
}


const DEMO_TELEMETRY = { battery: '94%', latency: '12 ms', sensors: 'Óptimo', firmware: 'v2.4.1' };

function loadTelemetry() {
  const box = $('telemetry-box');
  const cells = box.querySelectorAll('[data-telemetry]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay = reduceMotion ? 150 : 900;           

  box.setAttribute('aria-busy', 'true');
  cells.forEach((cell) => cell.classList.add('skeleton'));

  setTimeout(() => {
    cells.forEach((cell) => {
      cell.textContent = DEMO_TELEMETRY[cell.dataset.telemetry];
      cell.classList.remove('skeleton');
      if (cell.dataset.telemetry === 'sensors') cell.classList.add('ok');
    });
    box.setAttribute('aria-busy', 'false');
  }, delay);
}


document.addEventListener('DOMContentLoaded', async () => {
 
  currentUser = await AuthService.getCurrentUser();
  if (!currentUser) { window.location.replace('login.html'); return; }

  $('profile-form').elements.birth_date.max = new Date().toISOString().split('T')[0];
  paintProfile();
  loadTelemetry();

  $('profile-form').addEventListener('submit', handleProfileSubmit);
  $('avatar-input').addEventListener('change', handleAvatarChange);
  $('btn-logout').addEventListener('click', requestLogout);
  $('btn-delete').addEventListener('click', requestDeleteAccount);

  $('modal-cancel').addEventListener('click', closeModal);
  $('modal-confirm').addEventListener('click', () => {
    const action = modalAction;
    closeModal();
    if (action) action();
  });
  $('confirm-modal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();   
  });
  document.addEventListener('keydown', handleModalKeys);
});
