(() => {
  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
  const secret = document.querySelector('.secret-play');
  const pinball = document.querySelector('#pinball');
  const gameStatus = document.querySelector('#pinball-status');
  let pinballLoader = null;
  function loadPinball() {
    if (pinballLoader) return pinballLoader;
    secret?.setAttribute('aria-busy', 'true');
    if (gameStatus) gameStatus.textContent = 'Loading Brickball…';
    pinballLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'pinball.js?v=20261003-gallery-v23';
      script.async = true;
      script.onload = () => {
        secret?.setAttribute('aria-busy', 'false');
        if (gameStatus?.textContent === 'Loading Brickball…') gameStatus.textContent = 'ready';
        resolve();
      };
      script.onerror = () => {
        script.remove();
        pinballLoader = null;
        secret?.setAttribute('aria-busy', 'false');
        if (gameStatus) gameStatus.textContent = 'Could not load Brickball. Close and reopen to retry.';
        reject(new Error('Brickball could not load'));
      };
      document.body.append(script);
    });
    return pinballLoader;
  }
  function revealPinball() {
    if (!pinball || !secret) return;
    const wasHidden = pinball.hidden;
    pinball.hidden = false;
    secret.setAttribute('aria-expanded', 'true');
    secret.setAttribute('aria-label', 'Close pinball');
    if (wasHidden) pinball.scrollIntoView({ block: 'start', behavior: 'auto' });
    loadPinball().catch(() => {});
  }
  secret?.addEventListener('click', () => {
    if (!pinball) return;
    if (pinball.hidden) revealPinball();
    else {
      pinball.hidden = true;
      secret.setAttribute('aria-expanded', 'false');
      secret.setAttribute('aria-label', 'Open pinball');
    }
  });

  const pieces = [...document.querySelectorAll('.art-piece')];
  const dialog = document.querySelector('.art-lightbox');
  const image = dialog?.querySelector('.art-lightbox-image');
  const close = dialog?.querySelector('.art-close');
  const title = dialog?.querySelector('#art-lightbox-title');
  const position = dialog?.querySelector('.art-position');
  const stage = dialog?.querySelector('.art-viewer-stage');
  const loading = dialog?.querySelector('.art-loading');
  const error = dialog?.querySelector('.art-error');
  const retry = dialog?.querySelector('.art-retry');
  const previous = dialog?.querySelector('.art-prev');
  const next = dialog?.querySelector('.art-next');
  const zoom = dialog?.querySelector('.art-zoom');
  const original = dialog?.querySelector('.art-original');
  const share = dialog?.querySelector('.art-share');
  const shareStatus = dialog?.querySelector('.art-share-status');
  const baseTitle = document.title;
  const hasViewer = Boolean(pieces.length && dialog && image && close && stage);
  let currentIndex = -1;
  let lastTrigger = null;
  let ownsHistoryEntry = false;
  let closingForHistory = false;
  let loadVersion = 0;
  let touchStart = null;

  function indexFromHash() {
    try {
      const id = decodeURIComponent(location.hash.slice(1));
      return pieces.findIndex(piece => piece.id === id);
    } catch {
      return -1;
    }
  }
  function artworkUrl(index = currentIndex) {
    const url = new URL(location.href);
    url.hash = pieces[index].id;
    return url.href;
  }
  function resetZoom() {
    dialog.classList.remove('is-zoomed');
    zoom?.setAttribute('aria-pressed', 'false');
    if (zoom) zoom.textContent = 'Zoom';
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    touchStart = null;
  }
  function loadArtwork() {
    const version = ++loadVersion;
    const piece = pieces[currentIndex];
    const preview = piece.querySelector('img');
    resetZoom();
    image.hidden = true;
    if (loading) loading.hidden = false;
    if (error) error.hidden = true;
    if (zoom) zoom.disabled = true;
    stage.setAttribute('aria-busy', 'true');
    image.alt = preview?.alt || piece.dataset.artName;
    image.width = Number(preview?.getAttribute('width')) || preview?.naturalWidth || 1;
    image.height = Number(preview?.getAttribute('height')) || preview?.naturalHeight || 1;
    image.onload = () => {
      if (version !== loadVersion || !dialog.open) return;
      image.width = image.naturalWidth;
      image.height = image.naturalHeight;
      image.hidden = false;
      if (loading) loading.hidden = true;
      if (error) error.hidden = true;
      if (zoom) zoom.disabled = false;
      stage.setAttribute('aria-busy', 'false');
    };
    image.onerror = () => {
      if (version !== loadVersion || !dialog.open) return;
      image.hidden = true;
      if (loading) loading.hidden = true;
      if (error) error.hidden = false;
      if (zoom) zoom.disabled = true;
      stage.setAttribute('aria-busy', 'false');
    };
    const source = piece.dataset.artSrc || preview?.src || '';
    if (original) original.href = source;
    image.src = source;
    if (image.complete && image.naturalWidth) image.onload();
  }
  function openArtwork(index, historyMode = 'none') {
    if (!hasViewer || index < 0 || index >= pieces.length) return;
    if (dialog.open && currentIndex === index) return;
    currentIndex = index;
    lastTrigger = pieces[index];
    const name = pieces[index].dataset.artName || pieces[index].querySelector('img')?.alt || 'Artwork';
    if (title) title.textContent = name;
    if (position) position.textContent = (index + 1) + ' / ' + pieces.length;
    document.title = name + ' · ' + baseTitle;
    if (previous) previous.disabled = index === 0;
    if (next) next.disabled = index === pieces.length - 1;
    if (shareStatus) shareStatus.textContent = '';
    if (historyMode !== 'none') {
      const state = { ...history.state, vincentArtwork: true };
      history[historyMode === 'push' ? 'pushState' : 'replaceState'](state, '', artworkUrl(index));
      ownsHistoryEntry = true;
    }
    if (!dialog.open) dialog.showModal();
    loadArtwork();
  }
  function clearArtworkHash() {
    if (indexFromHash() < 0) return;
    const url = new URL(location.href);
    url.hash = '';
    const state = { ...history.state };
    delete state.vincentArtwork;
    history.replaceState(state, '', url.href);
  }
  function closeArtwork() {
    if (!dialog?.open) return;
    if (ownsHistoryEntry && indexFromHash() >= 0) {
      ownsHistoryEntry = false;
      history.back();
    } else {
      clearArtworkHash();
      closingForHistory = true;
      dialog.close();
    }
  }
  function syncLocation() {
    if (location.hash === '#pinball') revealPinball();
    if (!hasViewer) return;
    const index = indexFromHash();
    if (index >= 0) {
      ownsHistoryEntry = history.state?.vincentArtwork === true;
      openArtwork(index);
    } else if (dialog.open) {
      closingForHistory = true;
      dialog.close();
    }
  }
  function moveArtwork(direction) {
    if (!dialog.open) return;
    const index = currentIndex + direction;
    if (index < 0 || index >= pieces.length) return;
    // Keep a directly opened link in its existing history entry.
    const state = { ...history.state };
    const owned = ownsHistoryEntry;
    openArtwork(index);
    history.replaceState(state, '', artworkUrl(index));
    ownsHistoryEntry = owned;
  }

  if (hasViewer) {
    pieces.forEach((piece, index) => piece.addEventListener('click', () => {
      openArtwork(index, dialog.open ? 'replace' : 'push');
    }));
    close.addEventListener('click', closeArtwork);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeArtwork();
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) closeArtwork();
    });
    dialog.addEventListener('close', () => {
      // A queued close event can arrive after a new artwork has already opened.
      if (dialog.open) {
        closingForHistory = false;
        return;
      }
      if (!closingForHistory) {
        if (ownsHistoryEntry && indexFromHash() >= 0) history.back();
        else clearArtworkHash();
      }
      closingForHistory = false;
      ++loadVersion;
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
      resetZoom();
      document.title = baseTitle;
      currentIndex = -1;
      ownsHistoryEntry = false;
      lastTrigger?.focus({ preventScroll: true });
    });
    previous?.addEventListener('click', () => moveArtwork(-1));
    next?.addEventListener('click', () => moveArtwork(1));
    dialog.addEventListener('keydown', event => {
      if (!dialog.open || dialog.classList.contains('is-zoomed') || event.defaultPrevented) return;
      if (event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveArtwork(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    function toggleZoom() {
      if (!dialog.open || image.hidden || zoom?.disabled) return;
      const zoomed = dialog.classList.toggle('is-zoomed');
      zoom?.setAttribute('aria-pressed', String(zoomed));
      if (zoom) zoom.textContent = zoomed ? 'Fit' : 'Zoom';
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
      touchStart = null;
      if (zoomed) stage.focus({ preventScroll: true });
    }
    zoom?.addEventListener('click', toggleZoom);
    image.addEventListener('click', toggleZoom);
    retry?.addEventListener('click', () => {
      if (!dialog.open) return;
      image.removeAttribute('src');
      loadArtwork();
    });
    stage.addEventListener('touchstart', event => {
      if (dialog.classList.contains('is-zoomed') || event.touches.length !== 1) {
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
    }, { passive: true });
    stage.addEventListener('touchmove', event => {
      if (event.touches.length !== 1) touchStart = null;
    }, { passive: true });
    stage.addEventListener('touchend', event => {
      const start = touchStart;
      touchStart = null;
      if (!start || event.touches.length || event.changedTouches.length !== 1 || dialog.classList.contains('is-zoomed')) return;
      const touch = event.changedTouches[0];
      if (touch.identifier !== start.id) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5) moveArtwork(dx < 0 ? 1 : -1);
    }, { passive: true });
    ['touchcancel', 'pointercancel'].forEach(type => stage.addEventListener(type, () => { touchStart = null; }, { passive: true }));
    share?.addEventListener('click', async () => {
      if (!dialog.open) return;
      const index = currentIndex;
      const name = pieces[index].dataset.artName;
      const url = artworkUrl(index);
      const status = message => {
        if (dialog.open && currentIndex === index && shareStatus) shareStatus.textContent = message;
      };
      if (navigator.share) {
        try {
          await navigator.share({ title: name + ' · ' + baseTitle, text: name, url });
          status('Shared.');
          return;
        } catch (failure) {
          if (failure.name === 'AbortError') return;
        }
      }
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(url);
        status('Link copied.');
      } catch {
        status('Copy this link: ' + url);
      }
    });
  }
  window.addEventListener('hashchange', syncLocation);
  window.addEventListener('popstate', syncLocation);
  syncLocation();
})();
