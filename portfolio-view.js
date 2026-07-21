const statusEl = document.getElementById('presentation-status');
const presentationEl = document.getElementById('presentation');
const copyLinkBtn = document.getElementById('copy-presentation-link');
const savePdfBtn = document.getElementById('save-presentation-pdf');
const params = new URLSearchParams(window.location.search);
const email = params.get('email');
const projectId = params.get('project');

async function loadProject() {
  if (!email || !projectId) {
    showError('This project link is incomplete. Return to your project list and try again.');
    return;
  }

  try {
    const res = await fetch(`/api/student?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to load this project.');
    const project = data.projects?.find((item) => item.id === projectId);
    if (!project) throw new Error('This project could not be found.');
    renderProject(project, data.name);
  } catch (error) {
    showError(error.message || 'Unable to load this project.');
  }
}

function renderProject(project, studentName) {
  document.title = `${project.name} — ${studentName}`;
  statusEl.hidden = true;
  presentationEl.hidden = false;

  const hero = document.createElement('section');
  hero.className = 'presentation-hero';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'presentation-eyebrow';
  eyebrow.textContent = studentName;
  const title = document.createElement('h1');
  title.textContent = project.name;
  const dateRange = document.createElement('p');
  dateRange.className = 'presentation-date-range';
  dateRange.textContent = getProjectDateRange(project);
  const details = document.createElement('p');
  details.className = 'presentation-details';
  details.textContent = `${project.photos.length} selected work${project.photos.length === 1 ? '' : 's'}${project.status ? ` · ${project.status}` : ''}`;
  hero.append(eyebrow, title, dateRange, details);
  presentationEl.appendChild(hero);

  if (!project.photos.length) {
    const empty = document.createElement('p');
    empty.className = 'presentation-empty';
    empty.textContent = 'Images for this project will appear here soon.';
    presentationEl.appendChild(empty);
    return;
  }

  const gallery = document.createElement('section');
  gallery.className = 'presentation-gallery';
  project.photos.forEach((photo, index) => {
    const figure = document.createElement('figure');
    figure.className = 'presentation-piece';
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.caption || `${project.name}, work ${index + 1}`;
    img.loading = index === 0 ? 'eager' : 'lazy';
    const caption = document.createElement('figcaption');
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    const text = document.createElement('span');
    text.textContent = photo.caption || formatDate(photo.uploadedAt);
    caption.append(number, text);
    figure.append(img, caption);
    gallery.appendChild(figure);
  });
  presentationEl.appendChild(gallery);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Project image' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

function getProjectDateRange(project) {
  const dates = project.photos
    .map((photo) => new Date(photo.uploadedAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);
  if (!dates.length) return '';
  const firstUpload = formatShortDate(dates[0]);
  const isInProgress = project.status.trim().toLowerCase() === 'in progress';
  return `${firstUpload} — ${isInProgress ? 'Present' : formatShortDate(dates[dates.length - 1])}`;
}

function showError(message) {
  statusEl.textContent = message;
  statusEl.classList.add('is-error');
}

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => { copyLinkBtn.textContent = 'Copy link'; }, 1600);
  } catch {
    copyLinkBtn.textContent = 'Copy unavailable';
  }
});

savePdfBtn.addEventListener('click', () => window.print());

loadProject();
