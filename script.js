const planet = document.querySelector('.planet');
const toast = document.querySelector('.toast');
const soundToggle = document.querySelector('.sound-toggle');
const hero = document.querySelector('.hero');
const webButton = document.querySelector('.web-button');
const miniPlanets = document.querySelectorAll('.mini-planet');

const messages = [
  'Daddy, I love you!',
  'Mommy, I love you!',
  'Daddy & Mommy, I love you!',
  'HEH HEH HEH',
  'Cutie Bao Bao!'
];
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
let soundOn = true;

miniPlanets.forEach((miniPlanet) => {
  const slug = miniPlanet.dataset.planet.toLowerCase();
  const voiceClip = new Audio(`assets/planet-voices/${slug}.mp3?v=${voiceVersion}`);
  voiceClip.preload = 'auto';
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
  if (audioContext.state === 'suspended') audioContext.resume();

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
  toast.textContent = message;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
}

function popPicture() {
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
  showToast(messages[Math.floor(Math.random() * messages.length)]);
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
  soundToggle.textContent = `sound: ${soundOn ? 'on' : 'off'}`;
  soundToggle.setAttribute('aria-pressed', String(soundOn));
  if (soundOn) {
    chirp();
  } else {
    stopPlanetVoices();
  }
});

document.querySelector('#year').textContent = new Date().getFullYear();
