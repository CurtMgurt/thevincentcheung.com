(() => {
  const pieces = [...document.querySelectorAll('.art-piece')];
  const dialog = document.querySelector('.art-lightbox');
  const image = dialog?.querySelector('img');
  const close = dialog?.querySelector('.art-close');

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
