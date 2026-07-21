const statusEl = document.getElementById('presentation-status');
const presentationEl = document.getElementById('presentation');
const copyLinkBtn = document.getElementById('copy-presentation-link');
const savePdfBtn = document.getElementById('save-presentation-pdf');
const params = new URLSearchParams(window.location.search);
const email = params.get('email');
const projectId = params.get('project');
let loadedProject;
let loadedStudentName;

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
    renderProject(project, project.studentName || data.name);
  } catch (error) {
    showError(error.message || 'Unable to load this project.');
  }
}

function renderProject(project, studentName) {
  loadedProject = project;
  loadedStudentName = studentName;
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
  const projectDescription = getProjectDescription(project);
  const description = document.createElement('p');
  description.className = 'presentation-description';
  description.textContent = projectDescription;
  const dateRange = document.createElement('p');
  dateRange.className = 'presentation-date-range';
  dateRange.textContent = getProjectDateRange(project);
  const details = document.createElement('p');
  details.className = 'presentation-details';
  details.textContent = `${project.photos.length} selected work${project.photos.length === 1 ? '' : 's'}${project.status ? ` · ${project.status}` : ''}`;
  hero.append(eyebrow, title);
  if (projectDescription) hero.appendChild(description);
  hero.append(dateRange, details);
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

function getProjectDescription(project) {
  return typeof project.description === 'string' ? project.description.trim() : '';
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

savePdfBtn.addEventListener('click', downloadProjectPdf);

async function downloadProjectPdf() {
  if (!loadedProject || !window.jspdf) return;

  const originalLabel = savePdfBtn.textContent;
  savePdfBtn.disabled = true;
  savePdfBtn.textContent = 'Preparing PDF…';

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = 22;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(25);
    const titleLines = pdf.splitTextToSize(loadedProject.name, contentWidth);
    pdf.text(titleLines, margin, cursorY);
    cursorY += titleLines.length * 10 + 4;

    const projectDescription = getProjectDescription(loadedProject);
    if (projectDescription) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(50);
      const descriptionLines = pdf.splitTextToSize(projectDescription, contentWidth);
      pdf.text(descriptionLines, margin, cursorY);
      cursorY += descriptionLines.length * 5 + 6;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(90);
    pdf.text(`${loadedStudentName}  |  ${getProjectDateRange(loadedProject)}`, margin, cursorY);
    cursorY += 12;

    // A compact two-column gallery uses the page efficiently while keeping
    // every photo and caption together in a clean, consistent tile.
    const images = await Promise.all(loadedProject.photos.map((photo) => loadPdfImage(photo.url)));
    const columnGap = 7;
    const tileWidth = (contentWidth - columnGap) / 2;
    const maxImageHeight = 92;

    for (let rowStart = 0; rowStart < loadedProject.photos.length; rowStart += 2) {
      const row = loadedProject.photos.slice(rowStart, rowStart + 2).map((photo, offset) => {
        const image = images[rowStart + offset];
        const ratio = image.naturalWidth / image.naturalHeight;
        let imageWidth = tileWidth;
        let imageHeight = imageWidth / ratio;
        if (imageHeight > maxImageHeight) {
          imageHeight = maxImageHeight;
          imageWidth = imageHeight * ratio;
        }
        const caption = photo.caption || formatDate(photo.uploadedAt);
        const captionLines = pdf.splitTextToSize(`${String(rowStart + offset + 1).padStart(2, '0')}  ${caption}`, tileWidth);
        return { photo, image, imageWidth, imageHeight, captionLines, height: imageHeight + 6 + captionLines.length * 4 + 7 };
      });
      const rowHeight = Math.max(...row.map((tile) => tile.height));

      if (cursorY + rowHeight > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }

      row.forEach((tile, column) => {
        const tileX = margin + column * (tileWidth + columnGap);
        const imageX = tileX + (tileWidth - tile.imageWidth) / 2;
        pdf.addImage(tile.image, tile.photo.contentType === 'image/png' ? 'PNG' : 'JPEG', imageX, cursorY, tile.imageWidth, tile.imageHeight);
        pdf.setFontSize(9);
        pdf.setTextColor(65);
        pdf.text(tile.captionLines, tileX, cursorY + tile.imageHeight + 5);
      });
      cursorY += rowHeight + 4;
    }

    const filename = `${safeFilename(loadedStudentName)}-${safeFilename(loadedProject.name)}-portfolio.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error(error);
    savePdfBtn.disabled = false;
    savePdfBtn.textContent = 'Download failed';
    setTimeout(() => { savePdfBtn.textContent = originalLabel; }, 2000);
    return;
  }

  savePdfBtn.disabled = false;
  savePdfBtn.textContent = originalLabel;
}

function loadPdfImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('One of the project images could not be added to the PDF.'));
    image.src = url;
  });
}

function safeFilename(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
}

loadProject();
