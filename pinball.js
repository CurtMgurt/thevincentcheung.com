(() => {
  'use strict';

  const canvas = document.querySelector('#pinball-canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return;
  if (canvas.dataset.pinballReady === 'true') return;

  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.dataset.pinballReady = 'true';
  canvas.width = 480;
  canvas.height = 640;
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';
  canvas.style.aspectRatio = '3 / 4';
  canvas.style.touchAction = 'manipulation';
  canvas.tabIndex = canvas.tabIndex < 0 ? 0 : canvas.tabIndex;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute(
    'aria-label',
    'Brickball game with two flippers and a moving goalie.'
  );

  const WIDTH = 480;
  const HEIGHT = 640;
  const STEP = 1 / 120;
  const BALL_RADIUS = 9;
  const GRAVITY = 570;
  const MAX_BALL_SPEED = 1120;
  const rootStyles = getComputedStyle(document.documentElement);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAUNCH_RELEASE_MS = reducedMotion ? 45 : 175;
  const LAUNCH_SPRING_MS = reducedMotion ? 90 : 520;

  const color = (name, fallback) => rootStyles.getPropertyValue(name).trim() || fallback;
  const palette = {
    red: color('--red', '#e66f5c'),
    redDeep: color('--red-deep', '#b74f45'),
    berry: color('--berry', '#535fa2'),
    ink: color('--ink', '#313638'),
    cream: color('--cream', '#fbf8ef'),
    butter: color('--butter', '#e5b748'),
    sky: color('--sky', '#55bdb8'),
    sage: color('--sage', '#6baa70'),
    peach: color('--peach', '#e88f69'),
    blush: color('--blush', '#efb1a1'),
    surface: color('--surface', '#eadbc9')
  };

  // Lovevery-inspired toy-brick colors: the construction language comes from
  // the block geometry and studs, while the hues stay harmonious with the site.
  const brickColor = {
    red: palette.red,
    blue: palette.berry,
    aqua: palette.sky,
    yellow: palette.butter,
    green: palette.sage,
    orange: palette.peach,
    white: palette.cream,
    surface: palette.surface,
    black: palette.ink
  };

  const goalieLooks = [
    {
      label: 'Bluey',
      kind: 'blue-pup',
      body: brickColor.aqua,
      legs: brickColor.blue,
      accent: brickColor.yellow
    },
    {
      label: 'Donald',
      kind: 'duck',
      body: brickColor.blue,
      legs: brickColor.orange,
      accent: brickColor.red,
      hands: brickColor.white
    },
    {
      label: 'Mickey',
      kind: 'mouse',
      body: brickColor.black,
      legs: brickColor.red,
      accent: brickColor.yellow,
      hands: brickColor.white
    },
    {
      label: 'Spider-Man',
      kind: 'spider-hero',
      body: brickColor.red,
      legs: brickColor.blue,
      accent: brickColor.blue,
      hands: brickColor.red
    },
    {
      label: 'Chip & Dale',
      kind: 'chip-duo',
      body: '#9b6848',
      legs: '#76503d',
      accent: '#f3d0a4',
      hands: '#9b6848'
    },
    {
      label: 'Elmo',
      kind: 'elmo',
      body: brickColor.red,
      legs: brickColor.red,
      accent: brickColor.orange,
      hands: brickColor.red
    }
  ];

  const scoreDisplay = document.querySelector('#pinball-score');
  const statusDisplay = document.querySelector('#pinball-status');
  const scoreboard = document.querySelector('.pinball-scoreboard');
  const launchButtons = [...document.querySelectorAll('.pinball-launch')];
  const resetButtons = [...document.querySelectorAll('.pinball-reset')];
  const leftButtons = [...document.querySelectorAll('.pinball-left')];
  const rightButtons = [...document.querySelectorAll('.pinball-right')];

  const input = {
    leftKey: false,
    rightKey: false,
    leftPointers: new Set(),
    rightPointers: new Set()
  };

  const game = {
    score: 0,
    lives: 3,
    state: 'ready',
    respawnAt: 0,
    goalArmed: true,
    goalRewardStartedAt: 0,
    goalRewardUntil: 0,
    flipperHits: 0,
    goals: 0,
    goalieTheme: -1,
    launchStartedAt: 0,
    launchGateClosed: false,
    status: '',
    shownScore: -1,
    particles: [],
    floaters: []
  };

  const ball = {
    x: 429,
    y: 514,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
    active: false
  };

  const walls = [
    { ax: 60, ay: 36, bx: 420, by: 36 },
    { ax: 28, ay: 76, bx: 60, by: 36 },
    { ax: 28, ay: 76, bx: 28, by: 535 },
    { ax: 28, ay: 535, bx: 125, by: 610 },
    { ax: 125, ay: 610, bx: 180, by: 610 },
    { ax: 300, ay: 610, bx: 355, by: 610 },
    { ax: 355, ay: 610, bx: 452, by: 535 },
    { ax: 452, ay: 535, bx: 452, by: 76 },
    { ax: 420, ay: 36, bx: 452, by: 76 },
    { ax: 405, ay: 270, bx: 405, by: 547 },
    { ax: 63, ay: 452, bx: 148, by: 524 },
    { ax: 392, ay: 466, bx: 332, by: 524 }
  ];

  // These close only after the launched ball clears the shooter lane. The
  // angled upper gate returns a descending ball to the playfield, while the
  // lower guard stops a loose ball from sneaking in around the lane's throat.
  const launchGates = [
    { ax: 405, ay: 270, bx: 449, by: 250 },
    { ax: 405, ay: 542, bx: 443, by: 557 }
  ];

  const slings = [
    { ax: 94, ay: 452, bx: 151, by: 510, lastHit: -1000, side: 'left' },
    { ax: 386, ay: 452, bx: 329, by: 510, lastHit: -1000, side: 'right' }
  ];

  const bumpers = [
    { x: 139, y: 178, radius: 31, color: brickColor.aqua, points: 100, label: '+100', lastHit: -1000 },
    { x: 319, y: 195, radius: 34, color: brickColor.yellow, points: 100, label: '+100', lastHit: -1000 }
  ];

  const blockTargets = [
    { x: 69, y: 288, width: 27, height: 36, color: brickColor.yellow, lastHit: -1000 },
    { x: 97, y: 306, width: 27, height: 36, color: brickColor.aqua, lastHit: -1000 },
    { x: 356, y: 303, width: 27, height: 36, color: brickColor.red, lastHit: -1000 },
    { x: 384, y: 283, width: 21, height: 36, color: brickColor.green, lastHit: -1000 }
  ];

  const goal = {
    left: 92,
    right: 388,
    lineY: 98,
    keeperY: 124,
    keeperHalfWidth: 19,
    keeperRadius: 7,
    keeperX: 240,
    lastHit: -1000
  };

  const flippers = [
    {
      side: 'left',
      x: 158,
      y: 552,
      length: 64,
      radius: 11.25,
      restAngle: 0.27,
      activeAngle: -0.43,
      angle: 0.27,
      omega: 0
    },
    {
      side: 'right',
      x: 322,
      y: 552,
      length: 64,
      radius: 11.25,
      restAngle: Math.PI - 0.27,
      activeAngle: Math.PI + 0.43,
      angle: Math.PI - 0.27,
      omega: 0
    }
  ];

  function leftDown() {
    return input.leftKey || input.leftPointers.size > 0;
  }

  function rightDown() {
    return input.rightKey || input.rightPointers.size > 0;
  }

  function setStatus(message) {
    if (game.status === message) return;
    game.status = message;
    if (statusDisplay) statusDisplay.textContent = message;
  }

  function pinballSound(start, end) {
    window.dispatchEvent(new CustomEvent('vincent:chirp', { detail: { start, end } }));
  }

  function updateHud() {
    if (scoreDisplay && game.shownScore !== game.score) {
      game.shownScore = game.score;
      scoreDisplay.textContent = game.score.toLocaleString();
    }
  }

  function updatePrimaryControls() {
    let label = 'launch';
    let ariaLabel = 'Launch ball';
    let disabled = false;

    if (game.state === 'playing') {
      label = 'ball in play';
      ariaLabel = 'Ball in play. Use the left and right flippers.';
      disabled = true;
    } else if (game.state === 'between') {
      label = 'next ball...';
      ariaLabel = 'Waiting for the next ball';
      disabled = true;
    } else if (game.state === 'launching') {
      label = 'launching...';
      ariaLabel = 'Launcher spring is releasing the ball';
      disabled = true;
    } else if (game.state === 'gameover') {
      label = 'play again';
      ariaLabel = 'Start a new game';
    }

    launchButtons.forEach((button) => {
      button.textContent = label;
      button.setAttribute('aria-label', ariaLabel);
      button.disabled = disabled;
    });
    canvas.style.cursor = game.state === 'ready' || game.state === 'gameover' ? 'pointer' : 'default';
  }

  function setReadyStatus() {
    updatePrimaryControls();
    setStatus('ready');
  }

  function parkBall() {
    ball.x = 429;
    ball.y = 514;
    ball.vx = 0;
    ball.vy = 0;
    ball.active = false;
    game.launchStartedAt = 0;
    game.launchGateClosed = false;
  }

  function resetGame() {
    game.goalieTheme = (game.goalieTheme + 1) % goalieLooks.length;
    if (scoreboard) scoreboard.classList.remove('goal-pop');
    game.score = 0;
    game.lives = 3;
    game.state = 'ready';
    game.respawnAt = 0;
    game.particles.length = 0;
    game.floaters.length = 0;
    bumpers.forEach((bumper) => { bumper.lastHit = -1000; });
    blockTargets.forEach((target) => { target.lastHit = -1000; });
    slings.forEach((sling) => { sling.lastHit = -1000; });
    goal.lastHit = -1000;
    goal.keeperX = 240;
    game.goalArmed = true;
    game.goalRewardStartedAt = 0;
    game.goalRewardUntil = 0;
    game.flipperHits = 0;
    game.goals = 0;
    parkBall();
    updateHud();
    setReadyStatus();
    const goalieLabel = goalieLooks[game.goalieTheme].label;
    resetButtons.forEach((button) => {
      button.title = `Goalie: ${goalieLabel}. Start a new game to change goalie.`;
    });
    canvas.setAttribute('aria-label', `Brickball game with two flippers and a ${goalieLabel} goalie.`);
  }

  function launchBall() {
    if (game.state === 'gameover') resetGame();
    if (game.state === 'between') {
      game.state = 'ready';
      parkBall();
    }
    if (game.state !== 'ready') return;

    parkBall();
    game.launchStartedAt = performance.now();
    game.launchGateClosed = false;
    // The opening orbit should not score by itself; the goal arms after the
    // ball returns to the lower playfield and is available to the flippers.
    game.goalArmed = false;
    game.state = 'launching';
    setStatus('pull...');
    updatePrimaryControls();
    pinballSound(145, 230);
    canvas.focus({ preventScroll: true });
  }

  function releaseBall(now) {
    if (game.state !== 'launching') return;
    ball.active = true;
    ball.vx = 0;
    ball.vy = -930;
    game.state = 'playing';
    game.goalArmed = false;
    setStatus('play!');
    updatePrimaryControls();
    pinballSound(190, 520);
    burst(ball.x, ball.y, palette.butter, 8, 115);
  }

  function primaryAction() {
    if (game.state === 'ready' || game.state === 'gameover') launchBall();
  }

  function loseBall(now) {
    if (!ball.active) return;
    ball.active = false;
    game.lives -= 1;

    if (game.lives <= 0) {
      game.state = 'gameover';
      updatePrimaryControls();
      setStatus('game over');
      return;
    }

    game.state = 'between';
    game.respawnAt = now + 900;
    setStatus(`${game.lives} left`);
    updatePrimaryControls();
  }

  function addScore(points, x, y, label, burstColor) {
    game.score += points;
    updateHud();
    game.floaters.push({
      x,
      y,
      text: label || `+${points}`,
      color: burstColor || palette.cream,
      life: 1,
      maxLife: 1
    });
    burst(x, y, burstColor || palette.cream, reducedMotion ? 4 : 10, 165);
    pinballSound(points >= 100 ? 390 : 290, points >= 100 ? 760 : 540);
  }

  function burst(x, y, burstColor, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
      const velocity = speed * (0.58 + Math.random() * 0.58);
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color: index % 3 === 0 ? palette.cream : burstColor,
        radius: 2.2 + Math.random() * 3.2,
        life: 0.55 + Math.random() * 0.3,
        maxLife: 0.85
      });
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSquared = abx * abx + aby * aby;
    const amount = lengthSquared === 0
      ? 0
      : clamp(((px - ax) * abx + (py - ay) * aby) / lengthSquared, 0, 1);
    return { x: ax + abx * amount, y: ay + aby * amount };
  }

  function collideSegment(segment, radius = 4, restitution = 0.78, extraKick = 0) {
    const nearest = closestPointOnSegment(ball.x, ball.y, segment.ax, segment.ay, segment.bx, segment.by);
    let dx = ball.x - nearest.x;
    let dy = ball.y - nearest.y;
    const minimum = ball.radius + radius;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimum * minimum) return false;

    let distance = Math.sqrt(distanceSquared);
    if (distance < 0.0001) {
      const sx = segment.bx - segment.ax;
      const sy = segment.by - segment.ay;
      const length = Math.hypot(sx, sy) || 1;
      dx = -sy / length;
      dy = sx / length;
      distance = 1;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minimum - distance;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const incoming = ball.vx * nx + ball.vy * ny;
    if (incoming < 0) {
      const impulse = -(1 + restitution) * incoming + extraKick;
      ball.vx += nx * impulse;
      ball.vy += ny * impulse;
    }
    return true;
  }

  function collideBumper(bumper, now) {
    let dx = ball.x - bumper.x;
    let dy = ball.y - bumper.y;
    const minimum = ball.radius + bumper.radius;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimum * minimum) return;

    let distance = Math.sqrt(distanceSquared);
    if (distance < 0.0001) {
      dx = 0;
      dy = -1;
      distance = 1;
    }
    const nx = dx / distance;
    const ny = dy / distance;
    ball.x = bumper.x + nx * minimum;
    ball.y = bumper.y + ny * minimum;

    const normalSpeed = ball.vx * nx + ball.vy * ny;
    const tangentX = ball.vx - normalSpeed * nx;
    const tangentY = ball.vy - normalSpeed * ny;
    const outwardSpeed = Math.max(390, -normalSpeed * 0.9 + 175);
    ball.vx = tangentX * 0.92 + nx * outwardSpeed;
    ball.vy = tangentY * 0.92 + ny * outwardSpeed;

    if (now - bumper.lastHit > 130) {
      bumper.lastHit = now;
      addScore(bumper.points, bumper.x, bumper.y - bumper.radius, bumper.label, bumper.color);
    }
  }

  function collideTarget(target, now) {
    const left = target.x;
    const right = target.x + target.width;
    const top = target.y;
    const bottom = target.y + target.height;
    let nearestX = clamp(ball.x, left, right);
    let nearestY = clamp(ball.y, top, bottom);
    let dx = ball.x - nearestX;
    let dy = ball.y - nearestY;
    let distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= ball.radius * ball.radius) return;

    if (distanceSquared < 0.0001) {
      const distances = [
        { value: Math.abs(ball.x - left), nx: -1, ny: 0, x: left, y: ball.y },
        { value: Math.abs(right - ball.x), nx: 1, ny: 0, x: right, y: ball.y },
        { value: Math.abs(ball.y - top), nx: 0, ny: -1, x: ball.x, y: top },
        { value: Math.abs(bottom - ball.y), nx: 0, ny: 1, x: ball.x, y: bottom }
      ].sort((a, b) => a.value - b.value);
      const edge = distances[0];
      dx = edge.nx;
      dy = edge.ny;
      nearestX = edge.x;
      nearestY = edge.y;
      distanceSquared = 1;
    }

    const distance = Math.sqrt(distanceSquared);
    const nx = dx / distance;
    const ny = dy / distance;
    ball.x = nearestX + nx * ball.radius;
    ball.y = nearestY + ny * ball.radius;
    const incoming = ball.vx * nx + ball.vy * ny;
    if (incoming < 0) {
      const impulse = -(1.84 * incoming) + 55;
      ball.vx += nx * impulse;
      ball.vy += ny * impulse;
    }

    if (now - target.lastHit > 160) {
      target.lastHit = now;
      addScore(50, target.x + target.width / 2, target.y, '+50', target.color);
    }
  }

  function studConfetti(x, y) {
    const colors = [
      brickColor.red,
      brickColor.aqua,
      brickColor.yellow,
      brickColor.green,
      brickColor.blue,
      brickColor.orange,
      brickColor.white
    ];
    const count = reducedMotion ? 14 : 38;
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI + Math.random() * Math.PI;
      const velocity = 145 + Math.random() * 260;
      game.particles.push({
        kind: index % 3 === 0 ? 'stud' : 'brick',
        x: x + (Math.random() - 0.5) * 112,
        y: y + 12 + Math.random() * 16,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 120,
        color: colors[index % colors.length],
        radius: 3.5 + Math.random() * 2.5,
        width: 8 + Math.random() * 8,
        height: 5 + Math.random() * 5,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 11,
        life: 1.2 + Math.random() * 0.5,
        maxLife: 1.7
      });
    }
  }

  function startGoalReward(x, now) {
    game.goalRewardStartedAt = now;
    game.goalRewardUntil = now + 1500;
    studConfetti(x, goal.lineY);
    if (scoreboard) {
      scoreboard.classList.remove('goal-pop');
      void scoreboard.offsetWidth;
      scoreboard.classList.add('goal-pop');
      window.setTimeout(() => scoreboard.classList.remove('goal-pop'), 1280);
    }
    pinballSound(280, 760);
    window.setTimeout(() => pinballSound(390, 930), 120);
    window.setTimeout(() => pinballSound(520, 1120), 255);
    window.setTimeout(() => pinballSound(680, 1260), 420);
  }

  function keeperPosition(now) {
    return 240 + Math.sin(now / 950) * 22;
  }

  function collideGoalie(now) {
    goal.keeperX = keeperPosition(now);
    const nearest = closestPointOnSegment(
      ball.x,
      ball.y,
      goal.keeperX - goal.keeperHalfWidth,
      goal.keeperY,
      goal.keeperX + goal.keeperHalfWidth,
      goal.keeperY
    );
    let dx = ball.x - nearest.x;
    let dy = ball.y - nearest.y;
    const minimum = ball.radius + goal.keeperRadius;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimum * minimum) return false;

    let distance = Math.sqrt(distanceSquared);
    if (distance < 0.0001) {
      dx = 0;
      dy = 1;
      distance = 1;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minimum - distance;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const incoming = ball.vx * nx + ball.vy * ny;
    if (incoming < 0) {
      const impulse = -(1.92 * incoming) + 80;
      ball.vx += nx * impulse;
      ball.vy += ny * impulse;
    }

    game.goalArmed = false;
    if (now - goal.lastHit > 220) {
      goal.lastHit = now;
      addScore(25, goal.keeperX, goal.keeperY - 18, 'SAVE! +25', palette.sky);
      setStatus('keeper save! +25');
    }
    return true;
  }

  function checkGoal(previousY, now) {
    if (!game.goalArmed && ball.y > 175 && ball.vy > 0) game.goalArmed = true;

    const crossedLine = previousY >= goal.lineY && ball.y < goal.lineY && ball.vy < 0;
    const insidePosts = ball.x > goal.left + ball.radius && ball.x < goal.right - ball.radius;
    if (!game.goalArmed || !crossedLine || !insidePosts) return;

    game.goalArmed = false;
    game.goals += 1;
    addScore(500, ball.x, goal.lineY, 'GOAL! +500', palette.butter);
    setStatus('GOAL! +500');
    startGoalReward(ball.x, now);
  }

  function collideFlipper(flipper, pressed) {
    const endX = flipper.x + Math.cos(flipper.angle) * flipper.length;
    const endY = flipper.y + Math.sin(flipper.angle) * flipper.length;
    const nearest = closestPointOnSegment(ball.x, ball.y, flipper.x, flipper.y, endX, endY);
    let dx = ball.x - nearest.x;
    let dy = ball.y - nearest.y;
    const minimum = ball.radius + flipper.radius;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minimum * minimum) return;

    let distance = Math.sqrt(distanceSquared);
    if (distance < 0.0001) {
      dx = -Math.sin(flipper.angle);
      dy = Math.cos(flipper.angle);
      distance = 1;
    }
    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minimum - distance;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const rx = nearest.x - flipper.x;
    const ry = nearest.y - flipper.y;
    const surfaceVelocityX = -flipper.omega * ry;
    const surfaceVelocityY = flipper.omega * rx;
    const relativeX = ball.vx - surfaceVelocityX;
    const relativeY = ball.vy - surfaceVelocityY;
    const incoming = relativeX * nx + relativeY * ny;

    if (incoming < 0) {
      // A stationary raised flipper behaves like a real pinball trap: it has
      // very little rebound and enough surface friction for a slow ball to
      // settle near the hinge. Rotation—not a hidden catch—creates the shot.
      const flipperMoving = pressed && Math.abs(flipper.omega) > 0.8;
      const heldTrap = pressed && !flipperMoving;
      const restitution = flipperMoving ? 0.92 : heldTrap ? 0.06 : 0.58;
      const impulse = -((1 + restitution) * incoming) + (flipperMoving ? 46 : 0);
      ball.vx += nx * impulse;
      ball.vy += ny * impulse;

      if (heldTrap) {
        const tangentX = -ny;
        const tangentY = nx;
        const tangentSpeed = ball.vx * tangentX + ball.vy * tangentY;
        const friction = Math.abs(tangentSpeed) < 280 ? 0.52 : 0.3;
        ball.vx -= tangentX * tangentSpeed * friction;
        ball.vy -= tangentY * tangentSpeed * friction;
      }
      if (pressed) game.flipperHits += 1;
    }
  }

  function capBallSpeed() {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed <= MAX_BALL_SPEED) return;
    const scale = MAX_BALL_SPEED / speed;
    ball.vx *= scale;
    ball.vy *= scale;
  }

  function syncDebugState(now = performance.now()) {
    const rewardActive = now < game.goalRewardUntil;
    canvas.dataset.ballX = ball.x.toFixed(1);
    canvas.dataset.ballY = ball.y.toFixed(1);
    canvas.dataset.ballVx = ball.vx.toFixed(1);
    canvas.dataset.ballVy = ball.vy.toFixed(1);
    canvas.dataset.ballActive = String(ball.active);
    canvas.dataset.gameState = game.state;
    canvas.dataset.goalieX = goal.keeperX.toFixed(1);
    canvas.dataset.goalArmed = String(game.goalArmed);
    canvas.dataset.flipperHits = String(game.flipperHits);
    canvas.dataset.goals = String(game.goals);
    canvas.dataset.goalieTheme = String(game.goalieTheme);
    canvas.dataset.launchGateClosed = String(game.launchGateClosed);
    canvas.dataset.launchPhase = game.state === 'launching'
      ? clamp((now - game.launchStartedAt) / LAUNCH_RELEASE_MS, 0, 1).toFixed(3)
      : '0.000';
    const leftTipX = flippers[0].x + Math.cos(flippers[0].angle) * flippers[0].length;
    const rightTipX = flippers[1].x + Math.cos(flippers[1].angle) * flippers[1].length;
    canvas.dataset.flipperGap = Math.max(0, rightTipX - leftTipX - flippers[0].radius - flippers[1].radius).toFixed(1);
    canvas.dataset.leftFlipperOmega = flippers[0].omega.toFixed(2);
    canvas.dataset.rightFlipperOmega = flippers[1].omega.toFixed(2);
    canvas.dataset.goalReward = String(rewardActive);
    canvas.dataset.rewardProgress = rewardActive && game.goalRewardUntil > game.goalRewardStartedAt
      ? clamp((now - game.goalRewardStartedAt) / (game.goalRewardUntil - game.goalRewardStartedAt), 0, 1).toFixed(3)
      : '0.000';
  }

  function updateFlippers(dt) {
    flippers.forEach((flipper) => {
      const pressed = flipper.side === 'left' ? leftDown() : rightDown();
      const target = pressed ? flipper.activeAngle : flipper.restAngle;
      const oldAngle = flipper.angle;
      const response = pressed ? 38 : 22;
      flipper.angle += (target - flipper.angle) * Math.min(1, response * dt);
      flipper.omega = (flipper.angle - oldAngle) / dt;
    });
  }

  function updateEffects(dt) {
    game.particles.forEach((particle) => {
      particle.life -= dt;
      particle.vy += 210 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (typeof particle.rotation === 'number') particle.rotation += (particle.spin || 0) * dt;
    });
    game.particles = game.particles.filter((particle) => particle.life > 0);

    game.floaters.forEach((floater) => {
      floater.life -= dt;
      floater.y -= 36 * dt;
    });
    game.floaters = game.floaters.filter((floater) => floater.life > 0);
  }

  function update(dt, now) {
    updateFlippers(dt);
    updateEffects(dt);

    if (game.state === 'between' && now >= game.respawnAt) {
      game.state = 'ready';
      parkBall();
      setReadyStatus();
    }

    if (game.state === 'launching' && now - game.launchStartedAt >= LAUNCH_RELEASE_MS) {
      releaseBall(now);
    }

    if (!ball.active) return;

    const previousY = ball.y;
    const drag = Math.pow(0.9984, dt * 60);
    ball.vx *= drag;
    ball.vy = ball.vy * drag + GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (!game.launchGateClosed && ball.y < 235) game.launchGateClosed = true;

    for (let pass = 0; pass < 2; pass += 1) {
      walls.forEach((wall) => collideSegment(wall));
      if (game.launchGateClosed) {
        launchGates.forEach((gate) => collideSegment(gate, 5, 0.84, 36));
      }

      slings.forEach((sling) => {
        if (!collideSegment(sling, 6, 0.9, 78)) return;
        if (now - sling.lastHit > 180) {
          sling.lastHit = now;
          const x = (sling.ax + sling.bx) / 2;
          const y = (sling.ay + sling.by) / 2;
          addScore(25, x, y, '+25', palette.peach);
        }
      });

      bumpers.forEach((bumper) => collideBumper(bumper, now));
      blockTargets.forEach((target) => collideTarget(target, now));
      collideGoalie(now);
      collideFlipper(flippers[0], leftDown());
      collideFlipper(flippers[1], rightDown());
    }

    checkGoal(previousY, now);
    capBallSpeed();
    if (ball.y - ball.radius > HEIGHT + 20) loseBall(now);
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawStud(ctx, x, y, radius, fill, outline = palette.ink) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y + Math.max(1.5, radius * 0.24), radius * 1.04, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(49,54,56,.24)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.7, radius * 0.3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.65, Math.PI * 0.08, Math.PI * 1.08);
    ctx.strokeStyle = 'rgba(255,255,255,.24)';
    ctx.lineWidth = Math.max(1, radius * 0.16);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - radius * 0.26, y - radius * 0.32, radius * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.48)';
    ctx.fill();
    ctx.restore();
  }

  function drawBrick(x, y, width, height, fill, studs = 2, radius = 5) {
    context.save();
    context.shadowColor = 'rgba(49,54,56,.24)';
    context.shadowBlur = 0;
    context.shadowOffsetY = 6;
    roundedRectPath(context, x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = palette.ink;
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.28)';
    roundedRectPath(context, x + 4, y + 4, Math.max(2, width - 8), Math.max(4, height * 0.18), 2);
    context.fill();
    context.fillStyle = 'rgba(49,54,56,.13)';
    roundedRectPath(context, x + 3, y + height - Math.max(5, height * 0.2), Math.max(2, width - 6), Math.max(3, height * 0.18), 2);
    context.fill();

    const spacing = width / studs;
    for (let index = 0; index < studs; index += 1) {
      drawStud(context, x + spacing * (index + 0.5), y + 1, Math.min(6.6, spacing * 0.25), fill);
    }
    context.restore();
  }

  function drawBrickBeam(segment, fill, thickness = 20) {
    const dx = segment.bx - segment.ax;
    const dy = segment.by - segment.ay;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const brickCount = Math.max(1, Math.round(length / 30));
    const brickLength = length / brickCount;

    context.save();
    context.translate(segment.ax, segment.ay);
    context.rotate(angle);
    context.shadowColor = 'rgba(49,54,56,.18)';
    context.shadowOffsetY = 4;
    roundedRectPath(context, 0, -thickness / 2, length, thickness, 5);
    context.fillStyle = fill;
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = palette.ink;
    context.lineWidth = 4;
    context.stroke();

    context.fillStyle = 'rgba(255,255,255,.25)';
    roundedRectPath(context, 4, -thickness / 2 + 3, Math.max(2, length - 8), 4, 2);
    context.fill();
    context.fillStyle = 'rgba(49,54,56,.12)';
    roundedRectPath(context, 3, thickness / 2 - 5, Math.max(2, length - 6), 4, 2);
    context.fill();

    for (let index = 1; index < brickCount; index += 1) {
      const seamX = brickLength * index;
      context.strokeStyle = 'rgba(49,54,56,.58)';
      context.lineWidth = 2.2;
      context.beginPath();
      context.moveTo(seamX, -thickness / 2 + 1);
      context.lineTo(seamX, thickness / 2 - 1);
      context.stroke();
    }
    for (let index = 0; index < brickCount; index += 1) {
      drawStud(context, brickLength * (index + 0.5), -thickness / 2 + 1, 4.8, fill);
    }
    context.restore();
  }

  function drawToyFigure(x, y, scale, options = {}) {
    const bodyColor = options.body || brickColor.aqua;
    const legColor = options.legs || brickColor.blue;
    const accentColor = options.accent || brickColor.red;
    const kind = options.kind || 'person';
    const headColors = {
      'blue-pup': brickColor.aqua,
      duck: brickColor.white,
      mouse: brickColor.black,
      'spider-hero': brickColor.red,
      chipmunk: '#9b6848',
      elmo: brickColor.red
    };
    const headColor = options.head || headColors[kind] || brickColor.yellow;
    const handColor = options.hands || (kind === 'person' ? brickColor.yellow : headColor);
    const armsUp = Boolean(options.armsUp);
    const flip = options.flip ? -1 : 1;

    context.save();
    context.translate(x, y);
    context.scale(scale * flip, scale);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Legs and hip block.
    drawBrick(-11, 4, 22, 8, legColor, 2, 2);
    drawBrick(-11, 11, 9, 21, legColor, 1, 2);
    drawBrick(2, 11, 9, 21, legColor, 1, 2);
    if (kind === 'duck' || kind === 'mouse') {
      const shoeColor = kind === 'duck' ? brickColor.orange : brickColor.yellow;
      drawBrick(-13, 27, 12, 7, shoeColor, 1, 3);
      drawBrick(1, 27, 12, 7, shoeColor, 1, 3);
    }

    // Tapered torso with a simple shirt badge.
    context.beginPath();
    context.moveTo(-13, -20);
    context.lineTo(13, -20);
    context.lineTo(10, 5);
    context.lineTo(-10, 5);
    context.closePath();
    context.fillStyle = bodyColor;
    context.fill();
    context.strokeStyle = palette.ink;
    context.lineWidth = 3.5;
    context.stroke();
    if (kind === 'mouse') {
      drawStud(context, -4, -6, 2.2, brickColor.yellow, palette.ink);
      drawStud(context, 4, -6, 2.2, brickColor.yellow, palette.ink);
    } else if (kind === 'duck') {
      context.strokeStyle = brickColor.white;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-8, -17);
      context.lineTo(0, -9);
      context.lineTo(8, -17);
      context.stroke();
      context.fillStyle = brickColor.red;
      context.beginPath();
      context.moveTo(-6, -9);
      context.lineTo(0, -5);
      context.lineTo(6, -9);
      context.lineTo(0, -12);
      context.closePath();
      context.fill();
    } else if (kind === 'spider-hero') {
      context.strokeStyle = palette.ink;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(0, -15);
      context.lineTo(0, -4);
      context.moveTo(-5, -12);
      context.lineTo(5, -7);
      context.moveTo(5, -12);
      context.lineTo(-5, -7);
      context.stroke();
    } else if (kind === 'chipmunk') {
      context.fillStyle = accentColor;
      roundedRectPath(context, -6, -17, 12, 20, 6);
      context.fill();
    } else if (kind !== 'elmo') {
      context.fillStyle = accentColor;
      roundedRectPath(context, -5, -12, 10, 9, 2);
      context.fill();
    }

    // Hinged arms and round hands.
    const armY = armsUp ? -30 : -7;
    context.strokeStyle = palette.ink;
    context.lineWidth = 10;
    context.beginPath();
    context.moveTo(-11, -16);
    context.lineTo(-23, armY);
    context.moveTo(11, -16);
    context.lineTo(23, armY);
    context.stroke();
    context.strokeStyle = bodyColor;
    context.lineWidth = 6;
    context.stroke();
    drawStud(context, -24, armY, 5.3, handColor);
    drawStud(context, 24, armY, 5.3, handColor);

    // Strong silhouettes make the tiny block characters readable at a glance.
    if (kind === 'blue-pup') {
      context.fillStyle = brickColor.blue;
      context.strokeStyle = palette.ink;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-12, -41);
      context.lineTo(-15, -58);
      context.lineTo(-3, -47);
      context.lineTo(3, -47);
      context.lineTo(15, -58);
      context.lineTo(12, -41);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (kind === 'mouse') {
      drawStud(context, -13, -49, 10, brickColor.black, palette.ink);
      drawStud(context, 13, -49, 10, brickColor.black, palette.ink);
    } else if (kind === 'chipmunk') {
      drawStud(context, -10, -47, 7, headColor, palette.ink);
      drawStud(context, 10, -47, 7, headColor, palette.ink);
      drawStud(context, -10, -47, 3, '#f3d0a4', palette.ink);
      drawStud(context, 10, -47, 3, '#f3d0a4', palette.ink);
    } else if (kind === 'elmo') {
      context.fillStyle = brickColor.red;
      context.strokeStyle = palette.ink;
      context.lineWidth = 2.5;
      [-12, -7, 0, 7, 12].forEach((fuzzX, index) => {
        context.beginPath();
        context.arc(fuzzX, index % 2 ? -42 : -45, 6.8, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });
    }

    if (kind === 'duck') {
      context.fillStyle = brickColor.white;
      context.strokeStyle = palette.ink;
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(0, -35, 14.5, 14, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else if (kind === 'mouse') {
      context.fillStyle = brickColor.black;
      context.strokeStyle = palette.ink;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, -35, 15, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else {
      drawBrick(-13, -46, 26, 26, headColor, 1, 7);
    }

    if (kind === 'blue-pup') {
      context.fillStyle = brickColor.blue;
      context.beginPath();
      context.arc(-6, -39, 6.2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = brickColor.white;
      context.beginPath();
      context.ellipse(-4.5, -37, 3.3, 4.5, 0, 0, Math.PI * 2);
      context.ellipse(4.5, -37, 3.3, 4.5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(-4, -36, 1.35, 0, Math.PI * 2);
      context.arc(5, -36, 1.35, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette.surface;
      roundedRectPath(context, -7, -32, 14, 8, 4);
      context.fill();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(0, -29.5, 2, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'duck') {
      // Puffy white head, sailor cap, and an unmistakably broad orange bill.
      context.fillStyle = brickColor.white;
      context.beginPath();
      context.ellipse(-4.5, -39, 4.2, 6.5, -0.08, 0, Math.PI * 2);
      context.ellipse(4.5, -39, 4.2, 6.5, 0.08, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.ellipse(-4, -38, 1.35, 2.2, 0, 0, Math.PI * 2);
      context.ellipse(5, -38, 1.35, 2.2, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = brickColor.orange;
      context.beginPath();
      context.moveTo(-12, -33);
      context.quadraticCurveTo(0, -38, 13, -32);
      context.quadraticCurveTo(12, -23, 0, -24);
      context.quadraticCurveTo(-12, -24, -12, -33);
      context.closePath();
      context.fill();
      context.strokeStyle = palette.ink;
      context.lineWidth = 2.5;
      context.stroke();
      context.beginPath();
      context.moveTo(-9, -29);
      context.quadraticCurveTo(0, -27, 10, -29);
      context.stroke();
      context.fillStyle = brickColor.blue;
      context.beginPath();
      context.moveTo(-11, -47);
      context.quadraticCurveTo(0, -56, 11, -47);
      context.lineTo(10, -43);
      context.lineTo(-10, -43);
      context.closePath();
      context.fill();
      context.stroke();
      drawBrick(-13, -45, 27, 5, brickColor.blue, 2, 2);
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(-4, -52, 1.2, 0, Math.PI * 2);
      context.arc(0, -54, 1.2, 0, Math.PI * 2);
      context.arc(4, -52, 1.2, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'mouse') {
      // Round ears, peach widow's-peak face, red shorts, gloves, and shoes.
      context.fillStyle = '#e7ad82';
      context.beginPath();
      context.moveTo(0, -46);
      context.bezierCurveTo(-2, -42, -4, -43, -6, -40);
      context.bezierCurveTo(-14, -35, -10, -23, 0, -23);
      context.bezierCurveTo(10, -23, 14, -35, 6, -40);
      context.bezierCurveTo(4, -43, 2, -42, 0, -46);
      context.closePath();
      context.fill();
      context.fillStyle = brickColor.white;
      context.beginPath();
      context.ellipse(-3.1, -37.5, 2.7, 5.3, 0, 0, Math.PI * 2);
      context.ellipse(3.1, -37.5, 2.7, 5.3, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.ellipse(-2.8, -36.5, 1, 1.8, 0, 0, Math.PI * 2);
      context.ellipse(3.4, -36.5, 1, 1.8, 0, 0, Math.PI * 2);
      context.ellipse(0, -29.5, 4.8, 3.5, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = palette.ink;
      context.lineWidth = 1.7;
      context.beginPath();
      context.arc(0, -27.5, 5.8, 0.08 * Math.PI, 0.92 * Math.PI);
      context.stroke();
    } else if (kind === 'spider-hero') {
      context.fillStyle = brickColor.white;
      context.strokeStyle = palette.ink;
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(-10, -40);
      context.quadraticCurveTo(-5, -43, -2, -31);
      context.quadraticCurveTo(-7, -31, -10, -40);
      context.moveTo(10, -40);
      context.quadraticCurveTo(5, -43, 2, -31);
      context.quadraticCurveTo(7, -31, 10, -40);
      context.fill();
      context.stroke();
      context.strokeStyle = palette.ink;
      context.lineWidth = 1.1;
      context.globalAlpha = 0.78;
      context.beginPath();
      context.moveTo(0, -46);
      context.lineTo(0, -21);
      context.moveTo(-12, -34);
      context.lineTo(12, -34);
      context.moveTo(-9, -43);
      context.lineTo(9, -25);
      context.moveTo(9, -43);
      context.lineTo(-9, -25);
      context.stroke();
      context.globalAlpha = 1;
    } else if (kind === 'chipmunk') {
      context.fillStyle = '#f3d0a4';
      context.beginPath();
      context.ellipse(0, -34, 9, 10, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = brickColor.white;
      context.beginPath();
      context.ellipse(-4.2, -38, 3, 4, 0, 0, Math.PI * 2);
      context.ellipse(4.2, -38, 3, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(-4, -37, 1.15, 0, Math.PI * 2);
      context.arc(4.5, -37, 1.15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = options.variant === 'dale' ? brickColor.red : palette.ink;
      context.beginPath();
      context.ellipse(0, -31, options.variant === 'dale' ? 3.1 : 2.2, 2.4, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = brickColor.white;
      context.fillRect(-2.6, -28.5, 2.1, 3.7);
      context.fillRect(0.5, -28.5, 2.1, 3.7);
    } else if (kind === 'elmo') {
      context.fillStyle = brickColor.white;
      context.strokeStyle = palette.ink;
      context.lineWidth = 2.4;
      context.beginPath();
      context.arc(-5, -47, 5.5, 0, Math.PI * 2);
      context.arc(5, -47, 5.5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(-4.4, -46.5, 1.5, 0, Math.PI * 2);
      context.arc(5.5, -46.5, 1.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = brickColor.orange;
      context.beginPath();
      context.arc(0, -36, 5.2, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(0, -29, 6.5, 0.05 * Math.PI, 0.95 * Math.PI);
      context.lineTo(-5, -28);
      context.closePath();
      context.fill();
    } else {
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(-3.5, -36, 1.5, 0, Math.PI * 2);
      context.arc(3.5, -36, 1.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = palette.ink;
      context.lineWidth = 1.6;
      context.beginPath();
      context.arc(0, -32.5, 4, 0.12 * Math.PI, 0.88 * Math.PI);
      context.stroke();
      if (options.hat) drawBrick(-14, -51, 28, 7, options.hat, 2, 2);
    }
    context.restore();
  }

  function drawPlayfield() {
    const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, '#fbf8ef');
    gradient.addColorStop(0.55, '#f4eee5');
    gradient.addColorStop(1, '#eadbc9');
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.save();
    context.globalAlpha = 0.48;
    for (let y = 22; y < HEIGHT; y += 24) {
      for (let x = 18; x < WIDTH; x += 24) {
        drawStud(context, x, y, 5.2, '#e3d7ca', 'rgba(49,54,56,.16)');
      }
    }
    context.restore();

    drawBrick(46, 50, 213, 38, brickColor.aqua, 9, 5);
    drawBrick(46, 88, 54, 18, brickColor.red, 2, 3);
    drawBrick(100, 88, 54, 18, brickColor.yellow, 2, 3);
    drawBrick(154, 88, 54, 18, brickColor.green, 2, 3);
    drawBrick(208, 88, 51, 18, brickColor.red, 2, 3);
    for (let index = 0; index < 3; index += 1) {
      drawStud(
        context,
        285 + index * 24,
        68,
        8,
        index < game.lives ? brickColor.yellow : '#d8ccbf',
        index < game.lives ? brickColor.black : 'rgba(34,40,49,.28)'
      );
    }

    // Stacked primary-color blocks make the toy construction language visible
    // even before the ball reaches a target.
    drawBrick(35, 384, 34, 25, brickColor.red, 2, 3);
    drawBrick(35, 409, 52, 25, brickColor.aqua, 3, 3);
    drawBrick(411, 374, 34, 25, brickColor.yellow, 2, 3);
    drawBrick(393, 399, 52, 25, brickColor.green, 3, 3);
  }

  function drawGoal(now) {
    goal.keeperX = keeperPosition(now);
    const netTop = 88;
    const rewardActive = now < game.goalRewardUntil;
    const rewardAge = Math.max(0, now - game.goalRewardStartedAt);
    const netKick = rewardActive && !reducedMotion
      ? Math.max(0, 23 * (1 - rewardAge / 1150)) * Math.abs(Math.sin(rewardAge / 48))
      : 0;
    const netBottom = 151 + netKick;

    context.save();
    roundedRectPath(context, goal.left, netTop, goal.right - goal.left, netBottom - netTop, 7);
    context.fillStyle = rewardActive ? 'rgba(255,255,255,.84)' : 'rgba(255,255,255,.62)';
    context.fill();

    context.strokeStyle = 'rgba(34,40,49,.34)';
    context.lineWidth = 1.4;
    for (let x = goal.left + 14; x < goal.right; x += 16) {
      context.beginPath();
      context.moveTo(x, netTop + 5);
      context.lineTo(x, netBottom - 2);
      context.stroke();
    }
    for (let y = netTop + 12; y < netBottom; y += 13) {
      context.beginPath();
      context.moveTo(goal.left + 3, y);
      context.lineTo(goal.right - 3, y);
      context.stroke();
    }

    const postColors = [brickColor.red, brickColor.yellow, brickColor.aqua, brickColor.green];
    for (let index = 0; index < 4; index += 1) {
      const postY = netTop + index * 16;
      drawBrick(goal.left - 7, postY, 14, 18, postColors[index], 1, 3);
      drawBrick(goal.right - 7, postY, 14, 18, postColors[3 - index], 1, 3);
    }
    for (let x = goal.left; x < goal.right - 10; x += 26) {
      drawBrick(x - 1, netTop - 7, Math.min(28, goal.right - x + 1), 14, postColors[Math.floor((x - goal.left) / 26) % postColors.length], 1, 3);
    }

    context.save();
    context.setLineDash([5, 6]);
    context.strokeStyle = brickColor.red;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(goal.left + 8, goal.lineY);
    context.lineTo(goal.right - 8, goal.lineY);
    context.stroke();
    context.restore();

    if (rewardActive) {
      const flash = reducedMotion ? 0.7 : 0.58 + Math.sin(rewardAge / 58) * 0.22;
      const lampColors = [brickColor.yellow, brickColor.red, brickColor.aqua, brickColor.green];
      for (let index = 0; index < 9; index += 1) {
        context.save();
        context.globalAlpha = Math.max(0.32, flash);
        const lampX = goal.left + 18 + index * ((goal.right - goal.left - 36) / 8);
        drawStud(context, lampX, netTop - 16, 5.7, lampColors[index % lampColors.length], palette.ink);
        context.restore();
      }
    }

    const cheerBounce = rewardActive && !reducedMotion ? Math.sin(rewardAge / 52) * 5 : 0;
    drawToyFigure(57, 188 + cheerBounce, 0.62, {
      body: brickColor.red,
      legs: brickColor.blue,
      accent: brickColor.yellow,
      armsUp: rewardActive,
      hat: brickColor.blue
    });
    drawToyFigure(423, 188 - cheerBounce, 0.62, {
      body: brickColor.aqua,
      legs: brickColor.green,
      accent: brickColor.red,
      armsUp: rewardActive,
      flip: true,
      hat: brickColor.red
    });

    // New Game cycles six deliberately readable block-character tributes.
    const goalieLook = goalieLooks[game.goalieTheme];
    if (goalieLook.kind === 'chip-duo') {
      drawToyFigure(goal.keeperX - 14, goal.keeperY + 13, 0.78, {
        ...goalieLook,
        kind: 'chipmunk',
        variant: 'chip',
        armsUp: false
      });
      drawToyFigure(goal.keeperX + 14, goal.keeperY + 13, 0.78, {
        ...goalieLook,
        kind: 'chipmunk',
        variant: 'dale',
        armsUp: false,
        flip: true
      });
    } else {
      drawToyFigure(goal.keeperX, goal.keeperY + 10, goalieLook.kind === 'duck' ? 1.18 : 1.14, {
        ...goalieLook,
        armsUp: false
      });
    }
    context.restore();
  }

  function drawWalls() {
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const railColors = [
      brickColor.red,
      brickColor.yellow,
      brickColor.aqua,
      brickColor.green,
      brickColor.blue,
      brickColor.orange
    ];
    walls.forEach((wall, index) => {
      const railColor = railColors[index % railColors.length];
      drawBrickBeam(wall, railColor, 20);
    });

    slings.forEach((sling) => {
      const hot = performance.now() - sling.lastHit < 150;
      drawBrickBeam(sling, hot ? brickColor.yellow : brickColor.orange, hot ? 23 : 20);
    });

    if (game.launchGateClosed) {
      launchGates.forEach((gate, index) => {
        drawBrickBeam(gate, index === 0 ? brickColor.aqua : brickColor.yellow, 17);
      });
    }
    context.restore();
  }

  function drawTargets(now) {
    blockTargets.forEach((target, index) => {
      const hot = now - target.lastHit < 170;
      context.save();
      context.translate(target.x + target.width / 2, target.y + target.height / 2);
      if (hot && !reducedMotion) context.scale(1.12, 0.9);
      drawBrick(
        -target.width / 2,
        -target.height / 2,
        target.width,
        target.height,
        hot ? palette.cream : target.color,
        target.width > 22 ? 2 : 1,
        5
      );
      context.fillStyle = palette.ink;
      context.font = '700 9px "DM Mono", monospace';
      context.textAlign = 'center';
      context.fillText(`+${(index + 1) * 10}`, 0, 7);
      context.restore();
    });
  }

  function drawBumpers(now, elapsed) {
    bumpers.forEach((bumper, index) => {
      const hot = now - bumper.lastHit < 150;
      const pulse = hot && !reducedMotion ? 1.09 : 1;
      context.save();
      context.translate(bumper.x, bumper.y);
      context.scale(pulse, pulse);

      context.beginPath();
      context.arc(0, 0, bumper.radius + 7, 0, Math.PI * 2);
      context.fillStyle = palette.ink;
      context.fill();
      context.beginPath();
      context.arc(0, 0, bumper.radius + 2, 0, Math.PI * 2);
      context.fillStyle = hot ? palette.cream : bumper.color;
      context.fill();
      drawStud(
        context,
        0,
        0,
        bumper.radius * 0.5,
        index === 1 ? brickColor.red : index === 2 ? brickColor.blue : brickColor.yellow
      );
      const orbit = reducedMotion ? 0 : elapsed * (index % 2 ? -0.35 : 0.35);
      drawStud(
        context,
        Math.cos(orbit) * (bumper.radius - 7),
        Math.sin(orbit) * (bumper.radius - 7),
        4,
        brickColor.white
      );
      context.restore();
    });
  }

  function drawFlipper(flipper, pressed) {
    context.save();
    context.translate(flipper.x, flipper.y);
    context.rotate(flipper.angle);
    const flipperColor = pressed
      ? brickColor.yellow
      : flipper.side === 'left' ? brickColor.red : brickColor.aqua;
    drawBrick(-4, -flipper.radius - 4, flipper.length + 8, flipper.radius * 2 + 8, flipperColor, 4, 7);
    drawStud(context, 0, 0, 8, brickColor.yellow);
    context.restore();
  }

  function drawBall() {
    if (!ball.active && game.state !== 'ready' && game.state !== 'launching') return;
    context.save();
    context.shadowColor = 'rgba(20,25,43,.4)';
    context.shadowBlur = 9;
    context.shadowOffsetY = 4;
    const gradient = context.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, ball.radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.46, palette.cream);
    gradient.addColorStop(1, palette.sky);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = palette.ink;
    context.lineWidth = 2;
    context.stroke();
    context.restore();
  }

  function drawEffects() {
    game.particles.forEach((particle) => {
      context.save();
      context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      if (particle.kind === 'brick') {
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation || 0);
        roundedRectPath(context, -particle.width / 2, -particle.height / 2, particle.width, particle.height, 2);
        context.fillStyle = particle.color;
        context.fill();
        context.strokeStyle = brickColor.black;
        context.lineWidth = 1.2;
        context.stroke();
        drawStud(context, 0, -particle.height / 2, Math.min(3, particle.height * 0.34), particle.color, brickColor.black);
      } else if (particle.kind === 'stud') {
        drawStud(context, particle.x, particle.y, particle.radius, particle.color, brickColor.black);
      } else {
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    });

    game.floaters.forEach((floater) => {
      context.save();
      context.globalAlpha = clamp(floater.life / floater.maxLife, 0, 1);
      context.fillStyle = floater.color;
      context.strokeStyle = palette.ink;
      context.lineWidth = 4;
      context.font = '700 16px Fredoka, system-ui, sans-serif';
      context.textAlign = 'center';
      context.strokeText(floater.text, floater.x, floater.y);
      context.fillText(floater.text, floater.x, floater.y);
      context.restore();
    });
  }

  function launchSpringTop(now) {
    const restingTop = 542;
    if (!game.launchStartedAt) return restingTop;
    const elapsed = now - game.launchStartedAt;
    if (game.state === 'launching') {
      if (elapsed < 110) {
        const progress = clamp(elapsed / 110, 0, 1);
        return restingTop + 28 * (1 - Math.pow(1 - progress, 3));
      }
      const progress = clamp((elapsed - 110) / Math.max(1, LAUNCH_RELEASE_MS - 110), 0, 1);
      return 570 - 46 * (1 - Math.pow(1 - progress, 3));
    }
    if (game.state === 'playing' && elapsed < LAUNCH_SPRING_MS) {
      const progress = clamp((elapsed - LAUNCH_RELEASE_MS) / Math.max(1, LAUNCH_SPRING_MS - LAUNCH_RELEASE_MS), 0, 1);
      const settle = reducedMotion ? progress : 1 - Math.exp(-5 * progress) * Math.cos(progress * Math.PI * 4);
      return 524 + (restingTop - 524) * settle;
    }
    return restingTop;
  }

  function drawLauncher(now) {
    const springTop = launchSpringTop(now);
    const springBottom = 606;
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.strokeStyle = palette.ink;
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(430, springTop + 8);
    const turns = 12;
    for (let index = 1; index < turns; index += 1) {
      const amount = index / turns;
      context.lineTo(index % 2 ? 420 : 440, springTop + 8 + (springBottom - springTop - 16) * amount);
    }
    context.lineTo(430, springBottom - 8);
    context.stroke();
    context.strokeStyle = brickColor.aqua;
    context.lineWidth = 3.5;
    context.stroke();

    drawBrick(413, springTop, 34, 11, brickColor.yellow, 2, 3);
    drawBrick(414, springBottom - 7, 32, 13, brickColor.red, 2, 3);

    if (game.state === 'ready') {
      context.translate(430, 505);
      context.fillStyle = palette.butter;
      context.beginPath();
      context.moveTo(0, -10);
      context.lineTo(-7, 2);
      context.lineTo(-2, 2);
      context.lineTo(-2, 15);
      context.lineTo(2, 15);
      context.lineTo(2, 2);
      context.lineTo(7, 2);
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  function drawGameOver() {
    if (game.state !== 'gameover') return;
    context.save();
    context.fillStyle = 'rgba(251,248,239,.95)';
    roundedRectPath(context, 100, 246, 280, 132, 24);
    context.fill();
    context.strokeStyle = palette.ink;
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = palette.ink;
    context.textAlign = 'center';
    context.font = '700 28px Fredoka, system-ui, sans-serif';
    context.fillText('GREAT GAME!', WIDTH / 2, 296);
    context.fillStyle = palette.berry;
    context.font = '600 15px "DM Mono", monospace';
    context.fillText(`${game.score.toLocaleString()} POINTS`, WIDTH / 2, 328);
    context.fillStyle = palette.ink;
    context.font = '600 12px "DM Mono", monospace';
    context.fillText('PRESS R OR LAUNCH', WIDTH / 2, 353);
    context.restore();
  }

  function draw(now) {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    drawPlayfield();
    drawGoal(now);
    drawTargets(now);
    drawBumpers(now, now / 1000);
    drawWalls();
    drawFlipper(flippers[0], leftDown());
    drawFlipper(flippers[1], rightDown());
    drawLauncher(now);
    drawBall();
    drawEffects();
    drawGameOver();
    syncDebugState(now);
  }

  function setButtonState(buttons, pressed) {
    buttons.forEach((button) => {
      button.classList.toggle('is-pressed', pressed);
      button.setAttribute('aria-pressed', String(pressed));
    });
  }

  function refreshControlStates() {
    setButtonState(leftButtons, leftDown());
    setButtonState(rightButtons, rightDown());
  }

  function bindHoldButtons(buttons, side) {
    const pointers = side === 'left' ? input.leftPointers : input.rightPointers;

    buttons.forEach((button) => {
      button.style.touchAction = 'none';
      button.setAttribute('aria-pressed', 'false');

      if ('PointerEvent' in window) {
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          pointers.add(event.pointerId);
          if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
          refreshControlStates();
        });

        const release = (event) => {
          pointers.delete(event.pointerId);
          refreshControlStates();
        };
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
      } else {
        button.addEventListener('mousedown', (event) => {
          event.preventDefault();
          pointers.add('mouse');
          refreshControlStates();
        });
        button.addEventListener('mouseup', () => {
          pointers.delete('mouse');
          refreshControlStates();
        });
        button.addEventListener('mouseleave', () => {
          pointers.delete('mouse');
          refreshControlStates();
        });
        button.addEventListener('touchstart', (event) => {
          event.preventDefault();
          [...event.changedTouches].forEach((touch) => pointers.add(touch.identifier));
          refreshControlStates();
        }, { passive: false });
        const touchRelease = (event) => {
          [...event.changedTouches].forEach((touch) => pointers.delete(touch.identifier));
          refreshControlStates();
        };
        button.addEventListener('touchend', touchRelease);
        button.addEventListener('touchcancel', touchRelease);
      }
    });
  }

  function isTypingTarget(target) {
    return target instanceof HTMLElement && (
      target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    );
  }

  bindHoldButtons(leftButtons, 'left');
  bindHoldButtons(rightButtons, 'right');

  launchButtons.forEach((button) => button.addEventListener('click', primaryAction));
  resetButtons.forEach((button) => button.addEventListener('click', () => {
    resetGame();
    canvas.focus({ preventScroll: true });
  }));

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    primaryAction();
  });

  window.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      input.leftKey = true;
      refreshControlStates();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      input.rightKey = true;
      refreshControlStates();
    } else if (event.code === 'Space' || event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) primaryAction();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      if (!event.repeat) resetGame();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft') {
      input.leftKey = false;
      refreshControlStates();
    } else if (event.key === 'ArrowRight') {
      input.rightKey = false;
      refreshControlStates();
    }
  });

  window.addEventListener('blur', () => {
    input.leftKey = false;
    input.rightKey = false;
    input.leftPointers.clear();
    input.rightPointers.clear();
    refreshControlStates();
  });

  let previousTime = performance.now();
  let accumulator = 0;

  function frame(now) {
    const elapsed = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    accumulator += elapsed;

    while (accumulator >= STEP) {
      update(STEP, now);
      accumulator -= STEP;
    }

    draw(now);
    window.requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      previousTime = performance.now();
      accumulator = 0;
    }
  });

  resetGame();
  window.requestAnimationFrame(frame);
})();
