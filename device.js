
'use strict';


const BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_SENSORS_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const FINGERS = ['Pulgar', 'Índice', 'Medio', 'Anular', 'Meñique'];
const DEVICE_KEY = 'kivolink_device';

const state = {
  status: 'disconnected',     
  transport: null,            
  rssi: 0, battery: 94, latency: 0,
  raw: [0, 0, 0, 0, 0],       
  calibration: loadCalibration(),
  pose: 'free',               
  timer: null, bleDevice: null
};

function loadCalibration() {
  try { return JSON.parse(localStorage.getItem(DEVICE_KEY)) || { min: [null, null, null, null, null], max: [null, null, null, null, null] }; }
  catch (e) { return { min: [null, null, null, null, null], max: [null, null, null, null, null] }; }
}
function saveCalibration() { try { localStorage.setItem(DEVICE_KEY, JSON.stringify(state.calibration)); } catch (e) {} }


const STATUS_TEXT = {
  disconnected: ['Desconectado', 'Enciende tu guante y pulsa "Emparejar por Bluetooth".'],
  scanning: ['Buscando dispositivos…', 'Selecciona "KivoLink-ESP32" en la ventana del navegador.'],
  connecting: ['Conectando…', 'Conectando con el guante.'],
  connected: ['Conectado', 'Recibiendo datos del guante en tiempo real.']
};
function setStatus(status, transport) {
  state.status = status;
  if (transport !== undefined) state.transport = transport;
  const [label, detail] = STATUS_TEXT[status];
  $('status-hero').dataset.state = status;
  $('status-label').textContent = label;                       
  $('status-detail').textContent = status === 'connected' && state.transport === 'demo'
    ? 'Modo demostración: son datos de prueba.' : detail;
  const connected = status === 'connected';
  $('btn-ble').disabled = status === 'scanning' || status === 'connecting' || connected;
  $('btn-demo').disabled = status === 'scanning' || status === 'connecting' || connected;
  $('btn-disconnect').hidden = !connected;
  $('btn-capture-open').disabled = !connected;
  $('btn-capture-fist').disabled = !connected;
  $('btn-wifi-send').disabled = !connected;
  if (!connected) paintMetrics(true);
}

function paintMetrics(clear) {
 
  $('metric-rssi').textContent = clear ? '—' : (state.rssi > -55 ? 'Muy buena' : 'Buena');
  $('metric-battery').textContent = clear ? '—' : Math.round(state.battery) + '%';
  $('metric-latency').textContent = clear ? '—' : (state.latency < 13 ? 'Muy rápida' : 'Rápida');
  $('metric-firmware').textContent = clear ? '—' : 'v2.4.1';
  if (clear) paintSensors([0, 0, 0, 0, 0]);
  else {
    $('history-battery').textContent = Math.round(state.battery);
    $('battery-ring').setAttribute('stroke-dasharray', Math.round(state.battery) + ' 100');
  }
}


function normalize(i, value) {
  const min = state.calibration.min[i]; const max = state.calibration.max[i];
  if (min === null || max === null || max <= min) return value;       
  return Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));
}
function paintSensors(values) {
  values.forEach((v, i) => {
    $('sensor-fill-' + i).style.transform = 'scaleX(' + (v / 100) + ')';
    $('sensor-value-' + i).textContent = v + '%';
    $('sensor-bar-' + i).setAttribute('aria-valuenow', String(v));
  });
}

function handleSensorData(values) {
  state.raw = values;
  paintSensors(values.map((v, i) => normalize(i, v)));
}
function paintCalibrationTable() {
  const body = $('calib-body'); body.replaceChildren();
  FINGERS.forEach((name, i) => {
    const row = document.createElement('tr');
    [name, state.calibration.min[i], state.calibration.max[i]].forEach((cell) => {
      const td = document.createElement('td'); td.textContent = cell === null ? '—' : cell; row.appendChild(td);
    });
    body.appendChild(row);
  });
  const done = state.calibration.min.every((v) => v !== null) && state.calibration.max.every((v) => v !== null);
  $('calib-state').textContent = done ? 'Ajustado ✓' : 'Sin ajustar';
}


function simulateTick() {
  state.rssi = -48 - Math.floor(Math.random() * 14);
  state.latency = 10 + Math.floor(Math.random() * 6);
  state.battery = Math.max(5, state.battery - 0.02);
  paintMetrics(false);
}
function simulateSensors() {
  const target = state.pose === 'open' ? 6 : state.pose === 'fist' ? 92 : null;
  const next = state.raw.map((v, i) => {
    const goal = target === null ? 20 + 45 * (0.5 + 0.5 * Math.sin(Date.now() / 900 + i)) : target + (i % 2) * 3;
    return Math.round(v + (goal - v) * 0.25 + (Math.random() - 0.5) * 3);
  }).map((v) => Math.max(0, Math.min(100, v)));
  handleSensorData(next);
}
function startLive(transport) {
  setStatus('connected', transport);
  paintMetrics(false);
  clearInterval(state.timer);
  state.timer = setInterval(simulateTick, 1000);
  if (transport === 'demo') state.sensorTimer = setInterval(simulateSensors, 120);
}
function stopLive() {
  clearInterval(state.timer); clearInterval(state.sensorTimer);
  if (state.bleDevice && state.bleDevice.gatt && state.bleDevice.gatt.connected) state.bleDevice.gatt.disconnect();
  state.bleDevice = null; state.transport = null;
  setStatus('disconnected');
}


async function pairBluetooth() {
  if (!('bluetooth' in navigator)) {
    showToast('Este navegador no puede usar Bluetooth. Prueba con Chrome o Edge, o usa el Modo demostración.', 'error');
    return;
  }
  try {
    setStatus('scanning');
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'KivoLink' }], optionalServices: [BLE_SERVICE_UUID]
    });
    setStatus('connecting');
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(BLE_SENSORS_UUID);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const view = event.target.value;                          
      handleSensorData(Array.from({ length: 5 }, (_, i) => view.getUint8(i)));
    });
    device.addEventListener('gattserverdisconnected', () => { clearInterval(state.timer); setStatus('disconnected'); showToast('El guante se desconectó.', 'error'); });
    state.bleDevice = device;
    startLive('ble');
    showToast('Guante emparejado por Bluetooth.', 'success');
  } catch (error) {
    setStatus('disconnected');
    showToast('No se pudo emparejar (' + (error.name === 'NotFoundError' ? 'sin selección' : error.message) + '). Prueba el modo demostración.', 'error');
  }
}
function startDemo() {
  setStatus('connecting');
  setTimeout(() => { startLive('demo'); showToast('Modo demostración activo.', 'success'); }, isReducedMotion() ? 200 : 1200);
}



const HISTORY_KEY = 'kivolink_calib_history';
const HISTORY_SEED = [
  { when: 'Hace 2 días', quality: 'good' },
  { when: 'Hace 1 semana', quality: 'great' },
  { when: 'Hace 3 semanas', quality: 'ok' }
];
const QUALITY_TEXT = { great: 'Muy buena', good: 'Buena', ok: 'Regular' };

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || HISTORY_SEED; } catch (e) { return HISTORY_SEED; }
}
function renderHistory() {
  const list = $('calib-history'); list.replaceChildren();
  loadHistory().slice(0, 5).forEach((entry) => {
    const item = document.createElement('li'); item.className = 'history-item';
    const when = document.createElement('span'); when.className = 'history-when';
    when.textContent = entry.when;
    const small = document.createElement('small'); small.textContent = 'Ajuste de los 5 dedos'; when.appendChild(small);
    const quality = document.createElement('span'); quality.className = 'quality quality-' + entry.quality;
    quality.textContent = QUALITY_TEXT[entry.quality];
    item.append(when, quality); list.appendChild(item);
  });
}

function maybeAddHistory() {
  const c = state.calibration;
  if (!c.min.every((v) => v !== null) || !c.max.every((v) => v !== null)) return;
  const spread = c.max.reduce((sum, v, i) => sum + (v - c.min[i]), 0) / 5;      
  const quality = spread > 70 ? 'great' : spread > 45 ? 'good' : 'ok';
  const now = new Date();
  const entry = { when: 'Hoy, ' + now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }), quality: quality };
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([entry].concat(loadHistory()).slice(0, 8))); } catch (e) {}
  renderHistory();
}


function capture(kind) {
  const button = kind === 'open' ? $('btn-capture-open') : $('btn-capture-fist');
  state.pose = kind;
  button.disabled = true;
  let seconds = 3;
  const original = button.textContent;
  button.textContent = 'Mantén la mano así… ' + seconds;
  const countdown = setInterval(() => {
    seconds--;
    if (seconds > 0) { button.textContent = 'Mantén la mano así… ' + seconds; return; }
    clearInterval(countdown);
    const key = kind === 'open' ? 'min' : 'max';
    state.calibration[key] = state.raw.slice();
    saveCalibration(); paintCalibrationTable(); maybeAddHistory();
    state.pose = 'free';
    button.textContent = original; button.disabled = state.status !== 'connected';
    showToast(kind === 'open' ? 'Mano abierta guardada.' : 'Puño guardado.', 'success');
  }, 1000);
}


function provisionWifi(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const steps = Array.from($('provision-list').children);
  steps.forEach((s) => s.className = '');
  $('btn-wifi-send').disabled = true;
  let i = 0;
  (function next() {
    if (i > 0) steps[i - 1].className = 'is-done';
    if (i === steps.length) { $('btn-wifi-send').disabled = false; showToast('El guante quedó conectado al Wi-Fi ' + form.elements.wifi_ssid.value + '.', 'success'); return; }
    steps[i].className = 'is-active'; i++;
    setTimeout(next, isReducedMotion() ? 200 : 900);
  })();
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  $('btn-ble').addEventListener('click', pairBluetooth);
  $('btn-demo').addEventListener('click', startDemo);
  $('btn-disconnect').addEventListener('click', () => { stopLive(); showToast('Dispositivo desconectado.', 'success'); });
  $('btn-capture-open').addEventListener('click', () => capture('open'));
  $('btn-capture-fist').addEventListener('click', () => capture('fist'));
  $('btn-calib-reset').addEventListener('click', () => {
    state.calibration = { min: [null, null, null, null, null], max: [null, null, null, null, null] };
    saveCalibration(); paintCalibrationTable(); showToast('Ajuste borrado.', 'success');
  });
  $('wifi-form').addEventListener('submit', provisionWifi);
 
  $('wifi-security').addEventListener('change', (e) => {
    const open = e.target.value === 'open';
    $('wifi-password').required = !open; $('wifi-password').disabled = open;
    $('wifi-password').setAttribute('aria-required', String(!open));
  });
 
  $('btn-copy-code').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('firmware-code').textContent); showToast('Código copiado.', 'success'); }
    catch (e) { showToast('No se pudo copiar automáticamente.', 'error'); }
  });

  paintCalibrationTable();
  renderHistory();
  setStatus('disconnected');
});
