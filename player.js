const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const catalogue = [
  { id: 603, type: 'movie', title: 'The Matrix', year: 1999 },
  { id: 157336, type: 'movie', title: 'Interstellar', year: 2014 },
  { id: 329865, type: 'movie', title: 'Arrival', year: 2016 },
  { id: 62, type: 'movie', title: '2001: A Space Odyssey', year: 1968 },
  { id: 686, type: 'movie', title: 'Contact', year: 1997 },
  { id: 27205, type: 'movie', title: 'Inception', year: 2010 },
  { id: 1418, type: 'tv', title: 'The Big Bang Theory', year: 2007 },
  { id: 23004, type: 'tv', title: 'Captain Future', year: 1978 },
  { id: 70523, type: 'tv', title: 'Dark', year: 2017 },
  { id: 63639, type: 'tv', title: 'The Expanse', year: 2015 },
  { id: 95396, type: 'tv', title: 'Severance', year: 2022 },
  { id: 93740, type: 'tv', title: 'Foundation', year: 2021 }
];

const defaults = { baseUrl: 'https://vidrock.ru', type: 'movie', recent: [] };
const readState = () => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('glassCinemaV5') || '{}') }; }
  catch { return { ...defaults }; }
};
const saveState = (patch) => localStorage.setItem('glassCinemaV5', JSON.stringify({ ...readState(), ...patch }));

let mediaType = readState().type;
let selected = null;

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch { return null; }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function routeFor(id) {
  const state = readState();
  const base = validHttpsUrl(state.baseUrl);
  if (!base || !/^\d+$/.test(String(id))) return null;
  const clean = base.href.replace(/\/$/, '');
  if (mediaType === 'movie') return `${clean}/movie/${encodeURIComponent(id)}`;
  const season = Math.max(1, Number($('#season').value) || 1);
  const episode = Math.max(1, Number($('#episode').value) || 1);
  return `${clean}/tv/${encodeURIComponent(id)}/${season}/${episode}`;
}

function setType(type) {
  mediaType = type;
  saveState({ type });
  $$('.segment').forEach((button) => button.classList.toggle('active', button.dataset.type === type));
  $('#episodeRow').hidden = type !== 'tv';
  selected = null;
  $('#selectionPill').textContent = type === 'movie' ? 'Movie mode' : 'Series mode';
  renderResults($('#titleSearch').value);
}

function choose(item) {
  selected = item;
  if (item.type !== mediaType) setType(item.type);
  selected = item;
  $('#idInput').value = String(item.id);
  $('#selectionPill').textContent = `${item.title} · ${item.id}`;
  showToast(`${item.title} selected`);
}

function renderResults(query = '') {
  const root = $('#results');
  root.replaceChildren();
  const q = query.trim().toLowerCase();
  if (!q) return;
  const matches = catalogue.filter((item) => item.type === mediaType && (item.title.toLowerCase().includes(q) || String(item.id).includes(q))).slice(0, 7);
  if (!matches.length) {
    const note = document.createElement('div');
    note.className = 'result';
    note.textContent = 'Not in the local list — enter its TMDB number above.';
    root.append(note);
    return;
  }
  for (const item of matches) {
    const button = document.createElement('button');
    button.className = 'result';
    button.innerHTML = `<span>${item.title}</span><small>${item.year} · ${item.id}</small>`;
    button.addEventListener('click', () => choose(item));
    root.append(button);
  }
}

function addRecent(item) {
  const state = readState();
  const recent = [{ ...item, playedAt: Date.now() }, ...state.recent.filter((entry) => !(entry.id === item.id && entry.type === item.type))].slice(0, 8);
  saveState({ recent });
  renderRecent();
}

function renderRecent() {
  const root = $('#recentList');
  root.replaceChildren();
  const recent = readState().recent || [];
  if (!recent.length) {
    const p = document.createElement('p');
    p.textContent = 'No recent titles yet.';
    root.append(p);
    return;
  }
  for (const item of recent) {
    const button = document.createElement('button');
    button.className = 'recent-chip';
    button.textContent = item.title || `${item.type === 'tv' ? 'Series' : 'Movie'} ${item.id}`;
    button.addEventListener('click', () => choose(item));
    root.append(button);
  }
}

function playOriginal() {
  const id = $('#idInput').value.trim();
  if (!/^\d+$/.test(id)) {
    showToast('Enter a numeric TMDB number first.');
    $('#idInput').focus();
    return;
  }
  const route = routeFor(id);
  if (!route) {
    showToast('The player address must be a valid HTTPS address.');
    return;
  }
  const item = selected?.id === Number(id) ? selected : { id: Number(id), type: mediaType, title: `${mediaType === 'tv' ? 'Series' : 'Movie'} ${id}` };
  addRecent(item);
  // Direct same-window navigation avoids third-party iframe refusal.
  window.location.assign(route);
}

async function playEnhanced() {
  const input = $('#directUrl').value.trim();
  const url = validHttpsUrl(input);
  if (!url) {
    showToast('Enter a direct HTTPS video address.');
    return;
  }
  if (!/\.(mp4|webm|m4v)(?:$|\?)/i.test(url.href)) {
    showToast('Use a direct MP4, WebM, or M4V link—not a webpage.');
    return;
  }
  const video = $('#video');
  video.src = url.href;
  video.className = '';
  $('#emptyState').hidden = true;
  $('#nativePlayer').hidden = false;
  try { await video.play(); }
  catch { showToast('Tap Play in the video controls to begin.'); }
}

function closeNativePlayer() {
  const video = $('#video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  $('#nativePlayer').hidden = true;
  $('#emptyState').hidden = false;
}

async function requestFullscreen() {
  const target = $('#nativePlayer');
  try {
    if ($('#video').webkitEnterFullscreen) $('#video').webkitEnterFullscreen();
    else if (target.requestFullscreen) await target.requestFullscreen();
    else showToast('Use the full-screen icon in the video controls.');
  } catch { showToast('Use the full-screen icon in the video controls.'); }
}

$$('.segment').forEach((button) => button.addEventListener('click', () => setType(button.dataset.type)));
$('#titleSearch').addEventListener('input', (event) => renderResults(event.target.value));
$('#idInput').addEventListener('input', () => { selected = null; $('#selectionPill').textContent = $('#idInput').value ? `TMDB ${$('#idInput').value}` : 'Nothing selected'; });
$('#idInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') playOriginal(); });
$('#playOriginal').addEventListener('click', playOriginal);
$('#playEnhanced').addEventListener('click', playEnhanced);
$('#closePlayer').addEventListener('click', closeNativePlayer);
$('#fullscreenBtn').addEventListener('click', requestFullscreen);
$('#clearRecent').addEventListener('click', () => { saveState({ recent: [] }); renderRecent(); });

$('.modes').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  $$('.mode').forEach((item) => item.classList.toggle('active', item === button));
  const video = $('#video');
  video.classList.remove('video-clear', 'video-cinema');
  if (button.dataset.filter === 'clear') video.classList.add('video-clear');
  if (button.dataset.filter === 'cinema') video.classList.add('video-cinema');
});

$('#settingsBtn').addEventListener('click', () => {
  $('#baseUrl').value = readState().baseUrl;
  $('#settingsDialog').showModal();
});
$('#saveSettings').addEventListener('click', (event) => {
  const url = validHttpsUrl($('#baseUrl').value.trim());
  if (!url) {
    event.preventDefault();
    showToast('Enter a valid HTTPS player address.');
    return;
  }
  saveState({ baseUrl: url.href.replace(/\/$/, '') });
  showToast('Settings saved');
});

$('#video').addEventListener('error', () => showToast('This direct video could not be decoded by Safari.'));

(function init() {
  setType(mediaType);
  renderRecent();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
