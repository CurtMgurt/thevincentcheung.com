const planet = document.querySelector('.planet');
const toast = document.querySelector('.toast');
const soundToggle = document.querySelector('.sound-toggle');
const note = document.querySelector('#future-note');
const shuffle = document.querySelector('.shuffle-note');

const messages = ['BOOP!', 'WHEEE!', 'HI, VINCENT!', 'TO THE MOON!', '★ +1 STAR ★'];
const notes = [
  '“Stay curious. Be kind. Call your parents.”',
  '“You never have to be the coolest person in the room.”',
  '“Make weird things. Ask excellent questions.”',
  '“There is always room for one more adventure.”',
  '“The people who love you are your superpower.”'
];
let audioContext;
let soundOn = false;
let noteIndex = 0;

function chirp() {
  if (!soundOn) return;
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(330, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + .12);
  gain.gain.setValueAtTime(.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .22);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + .23);
}

planet.addEventListener('click', () => {
  planet.classList.remove('boop');
  void planet.offsetWidth;
  planet.classList.add('boop');
  toast.textContent = messages[Math.floor(Math.random() * messages.length)];
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  chirp();
});

soundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  soundToggle.textContent = `sound: ${soundOn ? 'on' : 'off'}`;
  soundToggle.setAttribute('aria-pressed', String(soundOn));
  chirp();
});

shuffle.addEventListener('click', () => {
  noteIndex = (noteIndex + 1) % notes.length;
  note.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320 });
  note.textContent = notes[noteIndex];
  chirp();
});

document.querySelector('#year').textContent = new Date().getFullYear();
