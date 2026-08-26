(() => {
  const zone = document.querySelector('.card-zone');
  const deck = document.querySelector('.card-deck');
  const shuffleButton = document.querySelector('.deck-shuffle');
  const showingCount = document.querySelector('#cards-showing');
  const status = document.querySelector('.deck-status');

  if (!zone || !deck || !shuffleButton || !showingCount || !status) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sparkColors = ['#e5b748', '#55bdb8', '#e66f5c', '#6baa70', '#535fa2', '#efb1a1'];

  function chirp(start, end) {
    window.dispatchEvent(new CustomEvent('vincent:chirp', { detail: { start, end } }));
  }

  function cards() {
    return [...deck.querySelectorAll('.fact-card')];
  }

  function updateStatus() {
    const allCards = cards();
    const count = allCards.filter((card) => card.classList.contains('is-flipped')).length;
    const total = allCards.length;
    showingCount.textContent = String(count);

    if (count === total) {
      status.lastChild.textContent = ` / ${total} found!`;
      zone.classList.add('is-complete');
      celebrateDeck();
    } else {
      status.lastChild.textContent = ` / ${total} showing`;
      zone.classList.remove('is-complete');
    }
  }

  function celebrateDeck() {
    if (zone.dataset.celebrated === 'true') return;
    zone.dataset.celebrated = 'true';

    chirp(440, 760);
    window.setTimeout(() => chirp(590, 940), 120);

    if (reducedMotion) return;

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
    card.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
    card.setAttribute(
      'aria-label',
      flipped
        ? `Hide the illustrated ${memory} and Vincent fact behind ${name}`
        : `Flip ${name} card to reveal an illustrated ${memory} and Vincent fact`,
    );
  }

  deck.addEventListener('click', (event) => {
    const card = event.target.closest('.fact-card');
    if (!card || !deck.contains(card) || shuffleButton.getAttribute('aria-busy') === 'true') return;

    const flipped = !card.classList.contains('is-flipped');
    setCardState(card, flipped);

    const cardIndex = cards().indexOf(card);
    chirp(flipped ? 250 + cardIndex * 18 : 340, flipped ? 610 + cardIndex * 18 : 230);

    if (!flipped) zone.dataset.celebrated = 'false';
    updateStatus();
  });

  shuffleButton.addEventListener('click', () => {
    if (shuffleButton.getAttribute('aria-busy') === 'true') return;

    shuffleButton.setAttribute('aria-busy', 'true');
    zone.dataset.celebrated = 'false';
    zone.classList.remove('is-complete');
    deck.classList.remove('is-dealing');
    cards().forEach((card) => setCardState(card, false));
    updateStatus();
    chirp(380, 210);

    window.setTimeout(() => {
      const shuffled = cards();
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const other = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
      }

      shuffled.forEach((card, index) => {
        card.style.setProperty('--deal-index', index);
        deck.append(card);
      });

      void deck.offsetWidth;
      deck.classList.add('is-dealing');
      window.setTimeout(() => {
        deck.classList.remove('is-dealing');
        shuffleButton.setAttribute('aria-busy', 'false');
        chirp(270, 520);
      }, reducedMotion ? 40 : 850);
    }, reducedMotion ? 20 : 260);
  });

  window.setTimeout(() => deck.classList.remove('is-dealing'), reducedMotion ? 40 : 1050);
  updateStatus();
})();
