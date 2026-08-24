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

  const scoreDisplay = document.querySelector('#pinball-score');
  const statusDisplay = document.querySelector('#pinball-status');
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
    cradleSide: null,
    cradleStartedAt: 0,
    cradleCooldownUntil: 0,
    assistedShot: false,
    goalRewardStartedAt: 0,
    goalRewardUntil: 0,
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

  const slings = [
    { ax: 94, ay: 452, bx: 151, by: 510, lastHit: -1000, side: 'left' },
    { ax: 386, ay: 452, bx: 329, by: 510, lastHit: -1000, side: 'right' }
  ];

  const bumpers = [
    { x: 139, y: 178, radius: 31, color: brickColor.aqua, points: 100, label: '+100', lastHit: -1000 },
    { x: 319, y: 195, radius: 34, color: brickColor.yellow, points: 100, label: '+100', lastHit: -1000 },
    { x: 235, y: 303, radius: 37, color: brickColor.green, points: 150, label: '+150', lastHit: -1000, planet: true }
  ];

  const blockTargets = [
    { x: 69, y: 288, width: 27, height: 36, color: brickColor.yellow, lastHit: -1000 },
    { x: 97, y: 306, width: 27, height: 36, color: brickColor.aqua, lastHit: -1000 },
    { x: 356, y: 303, width: 27, height: 36, color: brickColor.red, lastHit: -1000 },
    { x: 384, y: 283, width: 21, height: 36, color: brickColor.green, lastHit: -1000 }
  ];

  const goal = {
    left: 174,
    right: 306,
    lineY: 98,
    keeperY: 124,
    keeperHalfWidth: 25,
    keeperRadius: 9,
    keeperX: 240,
    lastHit: -1000
  };

  const flippers = [
    {
      side: 'left',
      x: 158,
      y: 552,
      length: 70,
      radius: 11,
      restAngle: 0.27,
      activeAngle: -0.43,
      angle: 0.27,
      omega: 0
    },
    {
      side: 'right',
      x: 322,
      y: 552,
      length: 70,
      radius: 11,
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
    game.cradleSide = null;
    game.assistedShot = false;
  }

  function resetGame() {
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
    game.cradleSide = null;
    game.cradleStartedAt = 0;
    game.cradleCooldownUntil = 0;
    game.assistedShot = false;
    game.goalRewardStartedAt = 0;
    game.goalRewardUntil = 0;
    parkBall();
    updateHud();
    setReadyStatus();
  }

  function launchBall() {
    if (game.state === 'gameover') resetGame();
    if (game.state === 'between') {
      game.state = 'ready';
      parkBall();
    }
    if (game.state !== 'ready') return;

    ball.active = true;
    ball.vx = 0;
    ball.vy = -930;
    game.goalArmed = true;
    game.state = 'playing';
    game.cradleSide = null;
    game.cradleCooldownUntil = performance.now() + 650;
    game.assistedShot = false;
    setStatus('play!');
    updatePrimaryControls();
    pinballSound(190, 520);
    burst(ball.x, ball.y, palette.butter, 8, 115);
    canvas.focus({ preventScroll: true });
  }

  function primaryAction() {
    if (game.state === 'ready' || game.state === 'gameover') launchBall();
  }

  function flipperHeld(side) {
    return side === 'left' ? leftDown() : rightDown();
  }

  function cradlePosition(flipper) {
    const amount = 0.62;
    const angle = flipper.activeAngle;
    const pointX = flipper.x + Math.cos(angle) * flipper.length * amount;
    const pointY = flipper.y + Math.sin(angle) * flipper.length * amount;
    const normalX = flipper.side === 'left' ? Math.sin(angle) : -Math.sin(angle);
    const normalY = -Math.abs(Math.cos(angle));
    const lift = ball.radius + flipper.radius + 2;
    return { x: pointX + normalX * lift, y: pointY + normalY * lift };
  }

  function placeBallOnCradle() {
    const flipper = flippers.find((item) => item.side === game.cradleSide);
    if (!flipper) return;
    const position = cradlePosition(flipper);
    ball.x = position.x;
    ball.y = position.y;
    ball.vx = 0;
    ball.vy = 0;
    ball.active = true;
  }

  function beginCradle(side, now) {
    game.cradleSide = side;
    game.cradleStartedAt = now;
    game.assistedShot = false;
    placeBallOnCradle();
    setStatus('caught!');
    pinballSound(260, 560);
    burst(ball.x, ball.y, brickColor.yellow, reducedMotion ? 4 : 10, 105);
  }

  function tryFlipperCradle(now) {
    if (game.cradleSide || game.assistedShot || now < game.cradleCooldownUntil) return false;
    if (ball.vy < 55 || ball.y < 462 || ball.y > 559) return false;

    let best = null;
    flippers.forEach((flipper) => {
      if (!flipperHeld(flipper.side)) return;
      const inSideLane = flipper.side === 'left'
        ? ball.x > 96 && ball.x < 246
        : ball.x > 234 && ball.x < 384;
      if (!inSideLane) return;

      const endX = flipper.x + Math.cos(flipper.activeAngle) * flipper.length;
      const endY = flipper.y + Math.sin(flipper.activeAngle) * flipper.length;
      const nearest = closestPointOnSegment(ball.x, ball.y, flipper.x, flipper.y, endX, endY);
      const distance = Math.hypot(ball.x - nearest.x, ball.y - nearest.y);
      if (distance > ball.radius + flipper.radius + 31) return;
      if (!best || distance < best.distance) best = { side: flipper.side, distance };
    });

    if (!best) return false;
    beginCradle(best.side, now);
    return true;
  }

  function cradleTargetX(side, now) {
    goal.keeperX = keeperPosition(now);
    const leftCorner = goal.left + 26;
    const rightCorner = goal.right - 26;
    const oppositeCorner = side === 'left' ? rightCorner : leftCorner;
    const otherCorner = side === 'left' ? leftCorner : rightCorner;
    const oppositeClearance = Math.abs(oppositeCorner - goal.keeperX);
    const otherClearance = Math.abs(otherCorner - goal.keeperX);
    return otherClearance > oppositeClearance + 24 ? otherCorner : oppositeCorner;
  }

  function shootFromCradle(side, now) {
    const targetX = cradleTargetX(side, now);
    const targetY = goal.lineY - 8;
    const flightTime = 0.52;
    const dx = targetX - ball.x;
    const dy = targetY - ball.y;

    game.cradleSide = null;
    game.cradleCooldownUntil = now + 1050;
    game.goalArmed = true;
    game.assistedShot = true;
    ball.vx = dx / flightTime;
    ball.vy = (dy - 0.5 * GRAVITY * flightTime * flightTime) / flightTime;
    setStatus('shoot!');
    pinballSound(310, 880);
    burst(ball.x, ball.y, side === 'left' ? brickColor.red : brickColor.aqua, reducedMotion ? 6 : 14, 175);
  }

  function updateCradle(now) {
    if (!game.cradleSide) return false;
    if (flipperHeld(game.cradleSide)) {
      placeBallOnCradle();
      return true;
    }
    shootFromCradle(game.cradleSide, now);
    return false;
  }

  function loseBall(now) {
    if (!ball.active) return;
    ball.active = false;
    game.lives -= 1;

    if (game.lives <= 0) {
      game.state = 'gameover';
      game.cradleSide = null;
      game.assistedShot = false;
      updatePrimaryControls();
      setStatus('game over');
      return;
    }

    game.state = 'between';
    game.cradleSide = null;
    game.assistedShot = false;
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
    const count = reducedMotion ? 18 : 52;
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI + Math.random() * Math.PI;
      const velocity = 150 + Math.random() * 310;
      game.particles.push({
        kind: index % 3 === 0 ? 'stud' : 'brick',
        x: x + (Math.random() - 0.5) * 110,
        y: y + 12 + Math.random() * 16,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 120,
        color: colors[index % colors.length],
        radius: 3.5 + Math.random() * 2.5,
        width: 8 + Math.random() * 8,
        height: 5 + Math.random() * 5,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 11,
        life: 1.45 + Math.random() * 0.55,
        maxLife: 2
      });
    }
  }

  function startGoalReward(x, now) {
    game.goalRewardStartedAt = now;
    game.goalRewardUntil = now + 1850;
    studConfetti(x, goal.lineY);
    pinballSound(280, 760);
    window.setTimeout(() => pinballSound(390, 930), 120);
    window.setTimeout(() => pinballSound(520, 1120), 255);
  }

  function keeperPosition(now) {
    return 240 + Math.sin(now / 620) * 42;
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
    game.assistedShot = false;
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
    game.assistedShot = false;
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
      const impulse = -(1.72 * incoming) + (pressed ? 32 : 0);
      ball.vx += nx * impulse;
      ball.vy += ny * impulse;
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
    canvas.dataset.ballActive = String(ball.active);
    canvas.dataset.gameState = game.state;
    canvas.dataset.goalieX = goal.keeperX.toFixed(1);
    canvas.dataset.goalArmed = String(game.goalArmed);
    canvas.dataset.cradle = game.cradleSide || 'none';
    canvas.dataset.cradleSide = game.cradleSide || 'none';
    canvas.dataset.cradleActive = String(Boolean(game.cradleSide));
    canvas.dataset.cradleHoldMs = game.cradleSide ? Math.max(0, now - game.cradleStartedAt).toFixed(0) : '0';
    canvas.dataset.cradleReady = String(
      game.state === 'playing' && !game.cradleSide && !game.assistedShot && now >= game.cradleCooldownUntil
    );
    canvas.dataset.assistedShot = String(game.assistedShot);
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
      const response = pressed ? 32 : 20;
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

    if (!ball.active) return;
    if (updateCradle(now)) return;

    const previousY = ball.y;
    const drag = Math.pow(0.9984, dt * 60);
    ball.vx *= drag;
    ball.vy = ball.vy * drag + GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (tryFlipperCradle(now)) return;

    for (let pass = 0; pass < 2; pass += 1) {
      const activeWalls = game.assistedShot ? walls.slice(0, 9) : walls;
      activeWalls.forEach((wall) => collideSegment(wall));

      if (!game.assistedShot) {
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
      }
      collideGoalie(now);
      if (!game.assistedShot) {
        collideFlipper(flippers[0], leftDown());
        collideFlipper(flippers[1], rightDown());
      }
    }

    checkGoal(previousY, now);
    if (game.assistedShot && (ball.vy >= 0 || ball.y < 58)) game.assistedShot = false;
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
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.2, radius * 0.25);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x - radius * 0.24, y - radius * 0.3, radius * 0.27, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.34)';
    ctx.fill();
    ctx.restore();
  }

  function drawBrick(x, y, width, height, fill, studs = 2, radius = 5) {
    context.save();
    context.shadowColor = 'rgba(49,54,56,.15)';
    context.shadowBlur = 0;
    context.shadowOffsetY = 3;
    roundedRectPath(context, x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = palette.ink;
    context.lineWidth = 2.5;
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.22)';
    roundedRectPath(context, x + 4, y + 4, width - 8, Math.max(3, height * 0.16), 2);
    context.fill();

    const spacing = width / studs;
    for (let index = 0; index < studs; index += 1) {
      drawStud(context, x + spacing * (index + 0.5), y + 1, Math.min(5, spacing * 0.22), fill);
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

    drawBrick(46, 50, 213, 34, brickColor.aqua, 9, 4);
    drawBrick(46, 84, 54, 15, brickColor.red, 2, 3);
    drawBrick(100, 84, 54, 15, brickColor.yellow, 2, 3);
    drawBrick(154, 84, 54, 15, brickColor.green, 2, 3);
    drawBrick(208, 84, 51, 15, brickColor.red, 2, 3);
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
      ? Math.max(0, 16 * (1 - rewardAge / 900)) * Math.abs(Math.sin(rewardAge / 55))
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

    // A deliberately block-built, minifigure-ish keeper (no logos or marks).
    drawBrick(goal.keeperX - 28, goal.keeperY - 4, 56, 13, brickColor.red, 4, 3);
    drawBrick(goal.keeperX - 14, goal.keeperY + 7, 28, 28, brickColor.blue, 2, 3);
    drawBrick(goal.keeperX - 10, goal.keeperY - 26, 20, 22, brickColor.yellow, 1, 4);
    drawBrick(goal.keeperX - 10, goal.keeperY - 29, 20, 7, brickColor.black, 1, 2);
    drawBrick(goal.keeperX - 13, goal.keeperY + 34, 12, 16, brickColor.blue, 1, 2);
    drawBrick(goal.keeperX + 1, goal.keeperY + 34, 12, 16, brickColor.blue, 1, 2);

    context.fillStyle = palette.ink;
    context.beginPath();
    context.arc(goal.keeperX - 3.5, goal.keeperY - 16, 1.4, 0, Math.PI * 2);
    context.arc(goal.keeperX + 3.5, goal.keeperY - 16, 1.4, 0, Math.PI * 2);
    context.fill();

    drawStud(context, goal.keeperX - goal.keeperHalfWidth, goal.keeperY + 1, 7, brickColor.yellow);
    drawStud(context, goal.keeperX + goal.keeperHalfWidth, goal.keeperY + 1, 7, brickColor.yellow);
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
      context.strokeStyle = palette.ink;
      context.lineWidth = 14;
      context.beginPath();
      context.moveTo(wall.ax, wall.ay);
      context.lineTo(wall.bx, wall.by);
      context.stroke();
      context.strokeStyle = railColor;
      context.lineWidth = 8;
      context.stroke();

      const dx = wall.bx - wall.ax;
      const dy = wall.by - wall.ay;
      const length = Math.hypot(dx, dy);
      const studCount = Math.max(1, Math.floor(length / 28));
      for (let studIndex = 0; studIndex <= studCount; studIndex += 1) {
        const amount = studIndex / studCount;
        drawStud(
          context,
          wall.ax + dx * amount,
          wall.ay + dy * amount,
          3.8,
          railColor,
          palette.ink
        );
      }
    });

    slings.forEach((sling) => {
      const hot = performance.now() - sling.lastHit < 150;
      context.strokeStyle = palette.ink;
      context.lineWidth = hot ? 16 : 13;
      context.beginPath();
      context.moveTo(sling.ax, sling.ay);
      context.lineTo(sling.bx, sling.by);
      context.stroke();
      context.strokeStyle = hot ? brickColor.yellow : brickColor.orange;
      context.lineWidth = hot ? 10 : 7;
      context.stroke();
    });
    context.restore();
  }

  function drawCradleCoach(now) {
    if (game.state !== 'playing' || game.assistedShot) return;
    const held = Boolean(game.cradleSide);

    if (held) {
      const targetX = cradleTargetX(game.cradleSide, now);
      context.save();
      context.setLineDash([8, 9]);
      context.strokeStyle = game.cradleSide === 'left' ? brickColor.red : brickColor.aqua;
      context.globalAlpha = 0.68;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(ball.x, ball.y - ball.radius - 4);
      context.lineTo(targetX, goal.lineY + 4);
      context.stroke();
      context.restore();
    }

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
    const endX = flipper.x + Math.cos(flipper.angle) * flipper.length;
    const endY = flipper.y + Math.sin(flipper.angle) * flipper.length;
    context.save();
    context.lineCap = 'round';
    const cradled = game.cradleSide === flipper.side;
    if (cradled) {
      context.shadowColor = flipper.side === 'left' ? brickColor.red : brickColor.aqua;
      context.shadowBlur = reducedMotion ? 8 : 14 + Math.sin(performance.now() / 90) * 3;
    }
    context.strokeStyle = brickColor.black;
    context.lineWidth = flipper.radius * 2 + 9;
    context.beginPath();
    context.moveTo(flipper.x, flipper.y);
    context.lineTo(endX, endY);
    context.stroke();
    context.strokeStyle = pressed
      ? brickColor.yellow
      : flipper.side === 'left' ? brickColor.red : brickColor.aqua;
    context.lineWidth = flipper.radius * 2;
    context.stroke();
    [0.16, 0.48, 0.8].forEach((amount) => {
      drawStud(
        context,
        flipper.x + (endX - flipper.x) * amount,
        flipper.y + (endY - flipper.y) * amount,
        4.5,
        pressed ? brickColor.yellow : flipper.side === 'left' ? brickColor.red : brickColor.aqua
      );
    });
    drawStud(context, flipper.x, flipper.y, 7, brickColor.yellow);
    context.restore();
  }

  function drawBall() {
    if (!ball.active && game.state !== 'ready') return;
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

  function drawGoalReward(now) {
    if (now >= game.goalRewardUntil) return;
    const duration = game.goalRewardUntil - game.goalRewardStartedAt;
    const progress = clamp((now - game.goalRewardStartedAt) / duration, 0, 1);
    const entrance = clamp(progress / 0.14, 0, 1);
    const exit = clamp((1 - progress) / 0.2, 0, 1);
    const alpha = Math.min(entrance, exit);
    const pulse = reducedMotion ? 1 : 1 + Math.sin(progress * Math.PI * 9) * 0.025;

    context.save();
    context.globalAlpha = alpha * 0.22;
    context.fillStyle = brickColor.yellow;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.restore();

    context.save();
    context.globalAlpha = alpha;
    context.translate(WIDTH / 2, 252);
    context.scale(pulse, pulse);
    drawBrick(-164, -52, 328, 104, brickColor.yellow, 12, 7);
    drawBrick(-164, -52, 48, 22, brickColor.red, 2, 4);
    drawBrick(-116, -52, 48, 22, brickColor.blue, 2, 4);
    drawBrick(68, -52, 48, 22, brickColor.green, 2, 4);
    drawBrick(116, -52, 48, 22, brickColor.red, 2, 4);
    context.fillStyle = brickColor.black;
    context.strokeStyle = brickColor.white;
    context.lineWidth = 8;
    context.textAlign = 'center';
    context.font = '900 48px Fredoka, system-ui, sans-serif';
    context.strokeText('GOAL!', 0, 18);
    context.fillText('GOAL!', 0, 18);
    context.fillStyle = brickColor.blue;
    context.font = '800 14px "DM Mono", monospace';
    context.fillText('+500  SUPER SHOT', 0, 42);
    context.restore();
  }

  function drawLaunchPrompt() {
    if (game.state !== 'ready') return;
    context.save();
    context.translate(430, 508);
    context.fillStyle = palette.butter;
    context.beginPath();
    context.moveTo(0, -12);
    context.lineTo(-7, 1);
    context.lineTo(-2, 1);
    context.lineTo(-2, 16);
    context.lineTo(2, 16);
    context.lineTo(2, 1);
    context.lineTo(7, 1);
    context.closePath();
    context.fill();
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
    drawCradleCoach(now);
    drawFlipper(flippers[0], leftDown());
    drawFlipper(flippers[1], rightDown());
    drawLaunchPrompt();
    drawBall();
    drawEffects();
    drawGoalReward(now);
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
