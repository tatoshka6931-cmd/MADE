const statusEl = document.getElementById('presentation-status');
const presentationEl = document.getElementById('presentation');
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
  const details = document.createElement('p');
  details.className = 'presentation-details';
  details.textContent = `${project.photos.length} selected work${project.photos.length === 1 ? '' : 's'}${project.status ? ` · ${project.status}` : ''}`;
  hero.append(eyebrow, title, details);
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

function showError(message) {
  statusEl.textContent = message;
  statusEl.classList.add('is-error');
}

loadProject();
