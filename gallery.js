(() => {
  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
  const secret = document.querySelector('.secret-play');
  const pinball = document.querySelector('#pinball');
  function revealPinball() {
    if (!pinball || !secret) return;
    pinball.hidden = false;
    secret.setAttribute('aria-expanded', 'true');
    pinball.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  secret?.addEventListener('click', () => {
    if (pinball.hidden) revealPinball();
    else {
      pinball.hidden = true;
      secret.setAttribute('aria-expanded', 'false');
    }
  });
  if (location.hash === '#pinball') revealPinball();
  window.addEventListener('hashchange', () => {
    if (location.hash === '#pinball') revealPinball();
  });
  const pieces = [...document.querySelectorAll('.art-piece')];
  const dialog = document.querySelector('.art-lightbox');
  const image = dialog?.querySelector('img');
  const close = dialog?.querySelector('.art-close');
  const title = dialog?.querySelector('#art-lightbox-title');

  if (!pieces.length || !dialog || !image || !close) return;

  let lastTrigger = null;

  function closeArtwork() {
    if (dialog.open) dialog.close();
  }

  pieces.forEach((piece) => {
    piece.addEventListener('click', () => {
      const preview = piece.querySelector('img');
      lastTrigger = piece;
      image.src = piece.dataset.artSrc || preview?.src || '';
      image.alt = preview?.alt || '';
      if (title) title.textContent = 'Artwork close-up';
      if (preview?.width && preview?.height) {
        image.width = Number(preview.getAttribute('width')) || preview.naturalWidth;
        image.height = Number(preview.getAttribute('height')) || preview.naturalHeight;
      }
      dialog.showModal();
    });
  });

  close.addEventListener('click', closeArtwork);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeArtwork();
  });

  dialog.addEventListener('close', () => {
    image.removeAttribute('src');
    lastTrigger?.focus({ preventScroll: true });
  });
})();
