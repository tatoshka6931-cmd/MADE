const form = document.getElementById('lookup-form');
const emailInput = document.getElementById('email-input');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const shareBar = document.getElementById('share-bar');
const copyLinkBtn = document.getElementById('copy-link');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!email) return;
  const url = new URL(window.location);
  url.searchParams.set('email', email);
  window.history.replaceState({}, '', url);
  loadPortfolio(email);
});

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => { copyLinkBtn.textContent = 'Copy link'; }, 1500);
  } catch {
    setStatus('Could not copy automatically — copy the address bar link instead.', true);
  }
});

async function loadPortfolio(email) {
  setStatus('Loading your portfolio…');
  resultsEl.innerHTML = '';
  shareBar.hidden = true;

  try {
    const res = await fetch(`/api/student?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || 'Something went wrong.', true);
      return;
    }
    setStatus('');
    renderPortfolio(data);
    shareBar.hidden = false;
  } catch (err) {
    console.error(err);
    setStatus('Could not reach the server. Check your connection and try again.', true);
  }
}

function renderPortfolio(data) {
  if (!data.projects || data.projects.length === 0) {
    resultsEl.innerHTML = `<div class="empty-frame" style="margin-top: 32px;">No projects logged yet for ${escapeHtml(data.name)}. Head to the photobox to submit your first one.</div>`;
    return;
  }
  const heading = document.createElement('h2');
  heading.style.marginTop = '32px';
  heading.style.fontSize = '20px';
  heading.style.color = 'var(--ash)';
  heading.textContent = `${data.projects.length} project${data.projects.length === 1 ? '' : 's'} — ${data.name}`;
  resultsEl.appendChild(heading);
  data.projects.forEach((project, i) => resultsEl.appendChild(renderRoll(project, data.projects.length - i)));
}

function renderRoll(project, rollNumber) {
  const roll = document.createElement('section');
  roll.className = 'roll';
  const label = document.createElement('span');
  label.className = 'roll-label';
  label.textContent = `Roll ${String(rollNumber).padStart(2, '0')}`;
  roll.appendChild(label);
  const title = document.createElement('h2');
  title.textContent = project.name;
  roll.appendChild(title);
  const meta = document.createElement('div');
  meta.className = 'roll-meta mono';
  meta.textContent = `${project.photos.length} photo${project.photos.length === 1 ? '' : 's'}${project.status ? ' · ' + project.status : ''}`;
  roll.appendChild(meta);
  const sheet = document.createElement('div');
  sheet.className = 'frame-sheet';
  const sprockets = document.createElement('div');
  sprockets.className = 'sprockets';
  sheet.appendChild(sprockets);
  if (project.photos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-frame';
    empty.textContent = 'No photos on this roll yet.';
    sheet.appendChild(empty);
  } else {
    const frames = document.createElement('div');
    frames.className = 'frames';
    project.photos.forEach((photo) => frames.appendChild(renderFrame(photo)));
    sheet.appendChild(frames);
  }
  roll.appendChild(sheet);
  return roll;
}

function renderFrame(photo) {
  const frame = document.createElement('div');
  frame.className = 'frame';
  const img = document.createElement('img');
  img.src = photo.url;
  img.alt = photo.caption || 'Project photo';
  img.loading = 'lazy';
  frame.appendChild(img);
  if (photo.caption) {
    const caption = document.createElement('div');
    caption.className = 'frame-caption';
    caption.textContent = photo.caption;
    frame.appendChild(caption);
  }
  const date = document.createElement('div');
  date.className = 'frame-meta mono';
  date.textContent = formatDate(photo.uploadedAt);
  frame.appendChild(date);
  return frame;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

(function init() {
  const email = new URLSearchParams(window.location.search).get('email');
  if (email) {
    emailInput.value = email;
    loadPortfolio(email);
  }
})();
