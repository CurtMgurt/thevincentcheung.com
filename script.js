const planet = document.querySelector('.planet');
const toast = document.querySelector('.toast');
const soundToggle = document.querySelector('.sound-toggle');
const hero = document.querySelector('.hero');
const webButton = document.querySelector('.web-button');
const miniPlanets = document.querySelectorAll('.mini-planet');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const soundPreferenceKey = 'vincent:sound';

const popColors = ['#fbf8ef', '#55bdb8', '#e5b748', '#6baa70', '#e66f5c', '#535fa2'];
const webTargets = [
  { x: .04, y: .16 },
  { x: .32, y: .03 },
  { x: .03, y: .5 },
  { x: .08, y: .88 },
  { x: .42, y: .97 },
  { x: .78, y: .97 },
  { x: .96, y: .72 }
];
const voiceVersion = '20260823-ana-neural-v1';
let audioContext;
let webTimer;
let toastTimer;
let nextLaughAt = 0;
let soundOn = true;
try {
  soundOn = window.localStorage.getItem(soundPreferenceKey) !== 'off';
} catch {
  // Browsing and play still work when device storage is unavailable.
}

function updateSoundToggle() {
  soundToggle.setAttribute('title', `Sound ${soundOn ? 'on' : 'off'}`);
  soundToggle.setAttribute('aria-pressed', String(soundOn));
}
updateSoundToggle();

miniPlanets.forEach((miniPlanet) => {
  const slug = miniPlanet.dataset.planet.toLowerCase();
  const voiceClip = new Audio(`assets/planet-voices/${slug}.mp3?v=${voiceVersion}`);
  voiceClip.preload = 'none';
  voiceClip.className = 'planet-voice';
  voiceClip.dataset.planet = miniPlanet.dataset.planet;
  voiceClip.setAttribute('aria-hidden', 'true');
  voiceClip.volume = .92;
  document.body.append(voiceClip);
  miniPlanet.planetVoice = voiceClip;
});

function chirp(start = 330, end = 660) {
  if (!soundOn) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(start, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(end, audioContext.currentTime + .12);
  gain.gain.setValueAtTime(.065, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .22);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + .23);
}

window.addEventListener('vincent:chirp', (event) => {
  const { start = 330, end = 660 } = event.detail || {};
  chirp(start, end);
});

function stopPlanetVoices() {
  miniPlanets.forEach((miniPlanet) => {
    miniPlanet.planetVoice.pause();
    miniPlanet.planetVoice.currentTime = 0;
  });
}

function sayPlanet(name, note, miniPlanet) {
  if (!soundOn) return;
  stopPlanetVoices();
  miniPlanet.planetVoice.play().catch(() => chirp(note, note * 1.18));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove('show');
  const inset = 20;
  const halfWidth = toast.offsetWidth / 2;
  const halfHeight = toast.offsetHeight / 2;
  const heroRect = hero.getBoundingClientRect();
  const minX = inset + halfWidth;
  const maxX = Math.max(minX, hero.clientWidth - inset - halfWidth);
  // Keep the laugh inside the visible part of the hero, even on a scrolled phone.
  const minY = Math.max(inset, -heroRect.top + inset) + halfHeight;
  const maxY = Math.max(minY, Math.min(hero.clientHeight, window.innerHeight - heroRect.top) - inset - halfHeight);
  toast.style.left = `${minX + Math.random() * (maxX - minX)}px`;
  toast.style.top = `${minY + Math.random() * (maxY - minY)}px`;
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
    toast.textContent = '';
  }, 1250);
}

function popPicture() {
  if (motionPreference.matches) return;
  const heroRect = hero.getBoundingClientRect();
  const photoRect = planet.getBoundingClientRect();
  const burst = document.createElement('span');
  burst.className = 'photo-pop';
  burst.style.left = `${photoRect.left - heroRect.left + photoRect.width / 2}px`;
  burst.style.top = `${photoRect.top - heroRect.top + photoRect.height / 2}px`;

  for (let index = 0; index < 12; index += 1) {
    const piece = document.createElement('span');
    piece.style.setProperty('--angle', `${index * 30}deg`);
    piece.style.setProperty('--distance', `${72 + Math.random() * 62}px`);
    piece.style.setProperty('--piece-color', popColors[index % popColors.length]);
    piece.style.setProperty('--shape', index % 3 === 0 ? '50%' : '4px');
    burst.append(piece);
  }

  hero.append(burst);
  window.setTimeout(() => burst.remove(), 900);
}

function shootWeb() {
  if (motionPreference.matches) {
    showToast('thwip!');
    return;
  }
  if (webButton.getAttribute('aria-busy') === 'true') return;

  const heroRect = hero.getBoundingClientRect();
  const spider = webButton.querySelector('.button-spider');
  const spiderRect = spider.getBoundingClientRect();
  const startX = spiderRect.left - heroRect.left + spiderRect.width / 2;
  const startY = spiderRect.top - heroRect.top + spiderRect.height / 2;
  const targets = [...webTargets].sort(() => Math.random() - .5).slice(0, 1);
  const webPieces = [];

  targets.forEach((target, index) => {
    const jitterX = (Math.random() - .5) * .025;
    const jitterY = (Math.random() - .5) * .025;
    const endX = heroRect.width * (target.x + jitterX);
    const endY = heroRect.height * (target.y + jitterY);
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.hypot(deltaX, deltaY);
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

    const shot = document.createElement('span');
    shot.className = 'web-shot';
    shot.style.setProperty('--start-x', `${startX}px`);
    shot.style.setProperty('--start-y', `${startY}px`);
    shot.style.setProperty('--length', `${distance}px`);
    shot.style.setProperty('--angle', `${angle}deg`);
    shot.style.setProperty('--shot-delay', `${index * 55}ms`);

    const splat = document.createElement('span');
    splat.className = 'web-splat';
    splat.style.left = `${endX}px`;
    splat.style.top = `${endY}px`;
    splat.style.setProperty('--splat-delay', `${170 + index * 55}ms`);

    webPieces.push(shot, splat);
  });

  hero.append(...webPieces);
  webButton.setAttribute('aria-busy', 'true');
  webButton.classList.remove('is-thwipping');
  void webButton.offsetWidth;
  webButton.classList.add('is-thwipping');
  hero.classList.remove('web-active');
  void hero.offsetWidth;
  hero.classList.add('web-active');
  window.clearTimeout(webTimer);
  webTimer = window.setTimeout(() => {
    hero.classList.remove('web-active');
    webButton.classList.remove('is-thwipping');
    webButton.setAttribute('aria-busy', 'false');
  }, 760);
  window.setTimeout(() => {
    webPieces.forEach((piece) => piece.remove());
  }, 820);
}

planet.addEventListener('click', () => {
  planet.classList.remove('boop');
  void planet.offsetWidth;
  planet.classList.add('boop');
  popPicture();
  if (Date.now() >= nextLaughAt && Math.random() < .35) {
    showToast('hehehe');
    nextLaughAt = Date.now() + 2200;
  }
  chirp(310, 680);
});

webButton.addEventListener('click', () => {
  shootWeb();
  chirp(250, 980);
});

miniPlanets.forEach((miniPlanet) => {
  miniPlanet.addEventListener('click', () => {
    const name = miniPlanet.dataset.planet;
    const note = Number(miniPlanet.dataset.note);
    miniPlanet.classList.remove('sing');
    void miniPlanet.offsetWidth;
    miniPlanet.classList.add('sing');
    window.clearTimeout(miniPlanet.orbitTimer);
    miniPlanet.orbitTimer = window.setTimeout(() => miniPlanet.classList.remove('sing'), 1100);
    sayPlanet(name, note, miniPlanet);
  });
});

soundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  updateSoundToggle();
  try {
    window.localStorage.setItem(soundPreferenceKey, soundOn ? 'on' : 'off');
  } catch {
    // The current choice still works for this visit.
  }
  if (soundOn) {
    chirp();
  } else {
    stopPlanetVoices();
  }
});

document.querySelector('#year').textContent = new Date().getFullYear();

// Keep the planet names playful, with an optional five-world finding game.
(() => {
  const consolePanel = document.querySelector('.space-console');
  const fact = document.querySelector('#planet-fact');
  const missionStatus = document.querySelector('#mission-status');
  const start = document.querySelector('.mission-start');
  const stop = document.querySelector('.mission-stop');
  if (!consolePanel || !fact || !missionStatus || !start || !stop) return;

  const worlds = [...miniPlanets];
  let mission = [];
  let found = 0;
  let waitingForNext = false;

  function clearFound() {
    worlds.forEach((world) => world.classList.remove('is-found'));
  }

  function prompt() {
    waitingForNext = false;
    start.disabled = true;
    start.textContent = 'Mission in progress';
    missionStatus.textContent = `${found} / ${mission.length} found. Find ${mission[found].dataset.planet}.`;
  }

  start.addEventListener('click', (event) => {
    if (waitingForNext && found < mission.length) {
      prompt();
      if (event.detail === 0) worlds[0].focus();
      return;
    }
    const shuffled = [...worlds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    mission = shuffled.slice(0, 5);
    found = 0;
    consolePanel.closest('.planet-band').classList.add('has-mission');
    clearFound();
    stop.hidden = false;
    fact.textContent = 'Five worlds to find. Take your time, space explorer.';
    prompt();
    if (event.detail === 0) worlds[0].focus();
  });

  stop.addEventListener('click', () => {
    mission = [];
    consolePanel.closest('.planet-band').classList.remove('has-mission');
    found = 0;
    waitingForNext = false;
    clearFound();
    start.disabled = false;
    start.textContent = 'Start a mission';
    start.focus({ preventScroll: true });
    stop.hidden = true;
    missionStatus.textContent = 'Free to explore. Tap any world.';
  });

  worlds.forEach((world) => {
    const name = world.dataset.planet;
    const description = world.getAttribute('aria-label').replace(/^Hear .*? say its name\.\s*/, '');
    world.addEventListener('click', (event) => {
      fact.textContent = `${name} — ${description}`;
      if (!mission.length || waitingForNext || found >= mission.length) return;
      if (world !== mission[found]) {
        missionStatus.textContent = `That's ${name}. Keep exploring — find ${mission[found].dataset.planet}.`;
        return;
      }
      world.classList.add('is-found');
      found += 1;
      waitingForNext = true;
      start.disabled = false;
      if (found === mission.length) {
        missionStatus.textContent = '5 / 5 found. Mission complete! You know your way around space.';
        start.textContent = 'Play again';
      } else {
        missionStatus.textContent = `${found} / ${mission.length} found. You found ${name}! Ready for the next world?`;
        start.textContent = 'Next world';
      }
      if (event.detail === 0) start.focus();
    });
  });
  consolePanel.hidden = false;
})();

// Decorative orbits can rest while another part of the page is in view.
if ('IntersectionObserver' in window) {
  const orbitObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle('is-offscreen', !entry.isIntersecting));
  });
  const solarSection = document.querySelector('.planet-band');
  if (solarSection) orbitObserver.observe(solarSection);
}
