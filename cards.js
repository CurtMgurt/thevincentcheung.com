(() => {
  const zone = document.querySelector('.card-zone');
  const deck = document.querySelector('.card-deck');
  const shuffleButton = document.querySelector('.deck-shuffle');
  const expandButton = document.querySelector('#deck-expand');
  const showingCount = document.querySelector('#cards-showing');
  const status = document.querySelector('.deck-status');

  if (!zone || !deck || !shuffleButton || !showingCount || !status) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileLayout = window.matchMedia('(max-width: 540px)');
  const sparkColors = ['#e5b748', '#55bdb8', '#e66f5c', '#6baa70', '#535fa2', '#efb1a1'];
  const featuredCount = 3;
  let expanded = false;
  let dealTimer;
  let pendingDeal = false;

  function chirp(start, end) {
    window.dispatchEvent(new CustomEvent('vincent:chirp', { detail: { start, end } }));
  }

  function cards() {
    return [...deck.querySelectorAll('.fact-card')];
  }

  function updateVisibility() {
    const allCards = cards();
    const collapsed = expandButton && mobileLayout.matches && !expanded;

    if (expandButton) {
      const showControl = mobileLayout.matches && allCards.length > featuredCount;
      expandButton.setAttribute('aria-expanded', String(!collapsed));
      expandButton.textContent = expanded ? 'Show fewer cards' : `See all ${allCards.length} cards`;

      const focusedIndex = allCards.findIndex((card) => card.contains(document.activeElement));
      if (collapsed && focusedIndex >= featuredCount) {
        expandButton.hidden = false;
        expandButton.focus({ preventScroll: true });
      } else if (!showControl && document.activeElement === expandButton) {
        allCards[0]?.focus({ preventScroll: true });
      }
      expandButton.hidden = !showControl;
    }

    allCards.forEach((card, index) => {
      card.hidden = Boolean(collapsed && index >= featuredCount);
    });
  }

  function updateStatus() {
    const allCards = cards();
    const count = allCards.filter((card) => card.classList.contains('is-flipped')).length;
    const total = allCards.length;
    showingCount.textContent = String(count);

    if (count === total) {
      status.lastChild.textContent = ` / ${total} revealed!`;
      zone.classList.add('is-complete');
      celebrateDeck();
    } else {
      status.lastChild.textContent = ` / ${total} revealed`;
      zone.classList.remove('is-complete');
    }
  }

  function celebrateDeck() {
    if (zone.dataset.celebrated === 'true') return;
    zone.dataset.celebrated = 'true';

    chirp(440, 760);
    window.setTimeout(() => chirp(590, 940), 120);

    if (motionPreference.matches) return;

    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18;
      const distance = 90 + (index % 4) * 25;
      const spark = document.createElement('i');
      spark.className = 'deck-spark';
      spark.setAttribute('aria-hidden', 'true');
      spark.style.setProperty('--spark-x', `${Math.cos(angle) * distance}px`);
      spark.style.setProperty('--spark-y', `${Math.sin(angle) * distance}px`);
      spark.style.setProperty('--spark-color', sparkColors[index % sparkColors.length]);
      spark.style.animationDelay = `${(index % 3) * 35}ms`;
      zone.append(spark);
      window.setTimeout(() => spark.remove(), 1100);
    }
  }

  function setCardState(card, flipped) {
    const name = card.dataset.cardName;
    const memory = card.dataset.memoryLabel || 'memory';
    const front = card.querySelector('.card-front');
    const back = card.querySelector('.card-back');
    const fact = back?.querySelector('strong')?.textContent.trim() || '';
    const factNumber = back?.querySelector('.fact-number')?.textContent.trim() || 'Vincent fact';
    card.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
    front?.setAttribute('aria-hidden', String(flipped));
    back?.setAttribute('aria-hidden', String(!flipped));
    card.setAttribute(
      'aria-label',
      flipped
        ? `${name} card. ${factNumber}: ${fact} Illustrated ${memory}. Tap to flip back.`
        : `${name} card. Flip to reveal an illustrated ${memory} and Vincent fact.`,
    );
  }

  deck.addEventListener('click', (event) => {
    const card = event.target.closest('.fact-card');
    if (!card || card.hidden || !deck.contains(card) || shuffleButton.getAttribute('aria-busy') === 'true') return;

    const flipped = !card.classList.contains('is-flipped');
    setCardState(card, flipped);

    const cardIndex = cards().indexOf(card);
    chirp(flipped ? 250 + cardIndex * 18 : 340, flipped ? 610 + cardIndex * 18 : 230);

    if (!flipped) zone.dataset.celebrated = 'false';
    updateStatus();
  });

  function finishShuffle() {
    deck.classList.remove('is-dealing');
    shuffleButton.setAttribute('aria-busy', 'false');
    chirp(270, 520);
  }

  function dealCards() {
    pendingDeal = false;
    const shuffled = cards();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }

    shuffled.forEach((card, index) => {
      card.style.setProperty('--deal-index', index);
      deck.append(card);
    });
    updateVisibility();

    if (motionPreference.matches) {
      finishShuffle();
      return;
    }

    void deck.offsetWidth;
    deck.classList.add('is-dealing');
    dealTimer = window.setTimeout(finishShuffle, 850);
  }

  shuffleButton.addEventListener('click', () => {
    if (shuffleButton.getAttribute('aria-busy') === 'true') return;

    window.clearTimeout(dealTimer);
    shuffleButton.setAttribute('aria-busy', 'true');
    zone.dataset.celebrated = 'false';
    zone.classList.remove('is-complete');
    deck.classList.remove('is-dealing');
    cards().forEach((card) => setCardState(card, false));
    updateStatus();
    chirp(380, 210);

    pendingDeal = true;
    if (motionPreference.matches) {
      dealCards();
    } else {
      dealTimer = window.setTimeout(dealCards, 260);
    }
  });

  expandButton?.addEventListener('click', () => {
    expanded = !expanded;
    updateVisibility();

    // The control follows the deck, so keyboard users need a way into new cards.
    if (expanded) cards()[featuredCount]?.focus();
    else expandButton.focus();
  });

  mobileLayout.addEventListener('change', () => {
    // Keep a card in use visible when a desktop window becomes narrow.
    if (mobileLayout.matches && cards().slice(featuredCount).some((card) => card.contains(document.activeElement))) {
      expanded = true;
    }
    updateVisibility();
  });

  motionPreference.addEventListener('change', () => {
    if (!motionPreference.matches) return;
    window.clearTimeout(dealTimer);
    deck.classList.remove('is-dealing');
    zone.querySelectorAll('.deck-spark').forEach((spark) => spark.remove());
    if (shuffleButton.getAttribute('aria-busy') === 'true') {
      if (pendingDeal) dealCards();
      else finishShuffle();
    }
  });

  cards().forEach((card, index) => {
    card.style.setProperty('--deal-index', index);
    setCardState(card, card.classList.contains('is-flipped'));
  });
  updateVisibility();
  if (motionPreference.matches) deck.classList.remove('is-dealing');
  else dealTimer = window.setTimeout(() => deck.classList.remove('is-dealing'), 1050);
  updateStatus();
})();
