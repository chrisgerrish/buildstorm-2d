const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const shell = document.querySelector(".shell");
const hero = document.querySelector(".hero");
const gameLayout = document.querySelector(".game-layout");

const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayBody = document.querySelector("#overlayBody");

const healthFill = document.querySelector("#healthFill");
const healthValue = document.querySelector("#healthValue");
const shieldFill = document.querySelector("#shieldFill");
const shieldValue = document.querySelector("#shieldValue");
const staminaFill = document.querySelector("#staminaFill");
const staminaValue = document.querySelector("#staminaValue");
const ammoText = document.querySelector("#ammoText");
const reloadText = document.querySelector("#reloadText");
const weaponName = document.querySelector("#weaponName");
const weaponRarity = document.querySelector("#weaponRarity");
const materialsText = document.querySelector("#materialsText");
const aliveText = document.querySelector("#aliveText");
const stormText = document.querySelector("#stormText");
const feed = document.querySelector("#feed");
const params = new URLSearchParams(window.location.search);
const debugLayout = params.get("debuglayout") === "1";

const WORLD = { width: 2800, height: 1900 };
const MAX_FEED_ITEMS = 6;

const RARITY_COLORS = {
  Common: "#d7dee7",
  Rare: "#5ab5ff",
  Epic: "#f175ff",
  Legendary: "#ffbf4f",
};

const weaponTemplates = [
  {
    id: "ranger",
    name: "Ranger Rifle",
    rarity: "Common",
    damage: 14,
    fireDelay: 0.16,
    magSize: 24,
    reserveAmmo: 96,
    reloadTime: 1.15,
    bulletSpeed: 950,
    spread: 0.05,
    pellets: 1,
    range: 900,
    color: "#93ff85",
  },
  {
    id: "smg",
    name: "Twin SMG",
    rarity: "Rare",
    damage: 10,
    fireDelay: 0.08,
    magSize: 30,
    reserveAmmo: 150,
    reloadTime: 1.35,
    bulletSpeed: 920,
    spread: 0.11,
    pellets: 1,
    range: 720,
    color: "#5ab5ff",
  },
  {
    id: "shotgun",
    name: "Thunder Shotgun",
    rarity: "Epic",
    damage: 11,
    fireDelay: 0.72,
    magSize: 8,
    reserveAmmo: 40,
    reloadTime: 1.55,
    bulletSpeed: 760,
    spread: 0.34,
    pellets: 6,
    range: 430,
    color: "#f175ff",
  },
  {
    id: "pulse",
    name: "Pulse Blaster",
    rarity: "Legendary",
    damage: 12,
    fireDelay: 0.1,
    magSize: 28,
    reserveAmmo: 140,
    reloadTime: 1.2,
    bulletSpeed: 980,
    spread: 0.07,
    pellets: 2,
    range: 840,
    color: "#ffbf4f",
  },
];

const state = {
  mode: "menu",
  viewport: { width: 0, height: 0, dpr: 1 },
  camera: { x: 0, y: 0 },
  input: {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    shoot: false,
    reloadQueued: false,
    buildQueued: false,
    mouseX: 0,
    mouseY: 0,
  },
  elapsed: 0,
  matchTime: 0,
  player: null,
  bots: [],
  obstacles: [],
  loot: [],
  bullets: [],
  particles: [],
  floaters: [],
  feed: [],
  storm: null,
  hitMarker: 0,
  nextSupplyDropIn: 16,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function magnitude(x, y) {
  return Math.hypot(x, y);
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function pointInRect(x, y, rect) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.w &&
    y >= rect.y &&
    y <= rect.y + rect.h
  );
}

function getLootColor(item) {
  return item.type === "ammo"
    ? "#f8f57a"
    : item.type === "shield"
      ? "#62d8ff"
      : item.type === "med"
        ? "#ff8f91"
        : item.type === "mats"
          ? "#ffcb6d"
          : item.weaponTemplate?.color ?? "#ffffff";
}

function getLootLabel(item) {
  if (item.type === "ammo") return "Ammo";
  if (item.type === "shield") return "Shield";
  if (item.type === "med") return "Med Mist";
  if (item.type === "mats") return "Materials";
  return item.weaponTemplate?.name ?? "Loot";
}

function addFloater(x, y, text, color, size = 20) {
  state.floaters.push({
    x,
    y,
    text,
    color,
    size,
    life: 0.75,
    vx: rand(-16, 16),
    vy: rand(-72, -52),
  });
}

function makeWeapon(template) {
  return {
    ...template,
    ammoInMag: template.magSize,
    reserveAmmo: template.reserveAmmo,
    cooldown: 0,
    reloadTimer: 0,
  };
}

function createActor(kind, x, y, name) {
  const template =
    kind === "player" ? weaponTemplates[0] : choose(weaponTemplates.slice(0, 3));
  return {
    id: `${kind}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name,
    x,
    y,
    radius: kind === "player" ? 18 : 17,
    speed: kind === "player" ? 250 : rand(170, 208),
    angle: -Math.PI / 2,
    health: 100,
    shield: kind === "player" ? 50 : 25,
    materials: kind === "player" ? 30 : rand(8, 24),
    weapon: makeWeapon(template),
    alive: true,
    kills: 0,
    hitFlash: 0,
    buildCooldown: 0,
    sprintEnergy: 100,
    sprinting: false,
    ai: {
      roamX: x,
      roamY: y,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      retargetIn: rand(0.15, 0.6),
    },
  };
}

function addFeed(message) {
  state.feed.unshift({ id: crypto.randomUUID(), message, ttl: 7.5 });
  state.feed = state.feed.slice(0, MAX_FEED_ITEMS);
  renderFeed();
}

function renderFeed() {
  feed.innerHTML = state.feed
    .map((item) => `<div class="feed-item">${item.message}</div>`)
    .join("");
}

function generateObstacle(x, y, w, h, color) {
  return {
    id: `obs-${Math.random().toString(36).slice(2, 8)}`,
    x,
    y,
    w,
    h,
    color,
    kind: "terrain",
    destructible: false,
    hp: Infinity,
    ttl: Infinity,
  };
}

function generateWorld() {
  const obstacles = [
    generateObstacle(340, 360, 150, 210, "#4f5a41"),
    generateObstacle(1350, 260, 300, 120, "#5f4e42"),
    generateObstacle(2080, 430, 210, 190, "#46545f"),
    generateObstacle(730, 1080, 260, 180, "#60483d"),
    generateObstacle(1520, 920, 150, 290, "#405d4a"),
    generateObstacle(2180, 1180, 240, 160, "#654654"),
    generateObstacle(430, 1480, 310, 150, "#48485d"),
    generateObstacle(1180, 1450, 220, 220, "#596645"),
    generateObstacle(1780, 1480, 280, 170, "#5d573d"),
  ];

  for (let i = 0; i < 11; i += 1) {
    const w = rand(110, 220);
    const h = rand(90, 180);
    const x = rand(120, WORLD.width - w - 120);
    const y = rand(120, WORLD.height - h - 120);
    const rect = generateObstacle(
      x,
      y,
      w,
      h,
      choose(["#4d5d4e", "#6b5842", "#3b5368", "#61506e"])
    );
    if (obstacles.every((existing) => !rectsOverlap(rect, existing))) {
      obstacles.push(rect);
    }
  }

  const loot = [];
  const lootTypes = [
    "ammo",
    "ammo",
    "shield",
    "shield",
    "med",
    "mats",
    "mats",
    "weapon",
  ];

  for (let i = 0; i < 28; i += 1) {
    let x = rand(100, WORLD.width - 100);
    let y = rand(100, WORLD.height - 100);
    let attempts = 0;

    while (
      attempts < 40 &&
      obstacles.some((rect) => pointInRect(x, y, rect))
    ) {
      x = rand(100, WORLD.width - 100);
      y = rand(100, WORLD.height - 100);
      attempts += 1;
    }

    const type = choose(lootTypes);
    loot.push({
      id: `loot-${i}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      x,
      y,
      radius: 15,
      value: type === "ammo" ? 26 : type === "shield" ? 28 : type === "med" ? 32 : 20,
      weaponTemplate:
        type === "weapon"
          ? choose(weaponTemplates.slice(1))
          : null,
      bob: rand(0, Math.PI * 2),
    });
  }

  return { obstacles, loot };
}

function generateStorm() {
  const radii = [1160, 920, 720, 540, 360, 210, 125];
  const durations = [22, 20, 18, 16, 15, 13, 11];
  const damages = [3, 4, 5, 7, 9, 12, 15];

  const phases = [];
  let startX = WORLD.width / 2;
  let startY = WORLD.height / 2;
  let startRadius = radii[0];

  for (let i = 1; i < radii.length; i += 1) {
    const targetRadius = radii[i];
    const availableShift = Math.max(0, startRadius - targetRadius - 100);
    const angle = rand(0, Math.PI * 2);
    const distanceShift = rand(0, availableShift * 0.52);
    const targetX = clamp(
      startX + Math.cos(angle) * distanceShift,
      targetRadius + 120,
      WORLD.width - targetRadius - 120
    );
    const targetY = clamp(
      startY + Math.sin(angle) * distanceShift,
      targetRadius + 120,
      WORLD.height - targetRadius - 120
    );

    phases.push({
      startX,
      startY,
      startRadius,
      targetX,
      targetY,
      targetRadius,
      duration: durations[i - 1],
      damage: damages[i - 1],
    });

    startX = targetX;
    startY = targetY;
    startRadius = targetRadius;
  }

  return {
    phases,
    phaseIndex: 0,
    phaseElapsed: 0,
    x: phases[0].startX,
    y: phases[0].startY,
    radius: phases[0].startRadius,
    damage: phases[0].damage,
  };
}

function randomSpawn(obstacles) {
  let x = rand(200, WORLD.width - 200);
  let y = rand(200, WORLD.height - 200);
  let attempts = 0;

  while (
    attempts < 60 &&
    obstacles.some(
      (rect) =>
        x > rect.x - 60 &&
        x < rect.x + rect.w + 60 &&
        y > rect.y - 60 &&
        y < rect.y + rect.h + 60
    )
  ) {
    x = rand(200, WORLD.width - 200);
    y = rand(200, WORLD.height - 200);
    attempts += 1;
  }

  return { x, y };
}

function resetGame() {
  const { obstacles, loot } = generateWorld();
  const spawn = randomSpawn(obstacles);

  state.mode = "playing";
  state.elapsed = 0;
  state.matchTime = 0;
  state.obstacles = obstacles;
  state.loot = loot;
  state.bullets = [];
  state.particles = [];
  state.floaters = [];
  state.feed = [];
  state.player = createActor("player", spawn.x, spawn.y, "You");
  state.bots = [];
  state.storm = generateStorm();
  state.hitMarker = 0;
  state.nextSupplyDropIn = 16;

  const botNames = [
    "Pixel Fox",
    "Storm Rat",
    "Wall Wizard",
    "Scope Kid",
    "Bush Camper",
    "Drift Echo",
    "Blue Zone",
    "Brick Baron",
    "Dust Loop",
    "Turbo Pine",
    "Loot Ghost",
  ];

  for (let i = 0; i < 11; i += 1) {
    const botSpawn = randomSpawn(obstacles);
    state.bots.push(createActor("bot", botSpawn.x, botSpawn.y, botNames[i]));
  }

  addFeed("Match started. Loot fast and build when pressured.");
  setOverlay(
    "Drop In",
    "Land shots, throw up walls with F, and stay ahead of the storm."
  );
  overlay.classList.add("hidden");
  updateHud();
}

function livingActors() {
  return [state.player, ...state.bots].filter(Boolean).filter((actor) => actor.alive);
}

function setOverlay(title, body) {
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
}

function updateHud() {
  const player = state.player;
  if (!player) {
    return;
  }

  const healthPct = clamp(player.health, 0, 100);
  const shieldPct = clamp(player.shield, 0, 100);
  const staminaPct = clamp(player.sprintEnergy, 0, 100);
  const alive = livingActors().length;

  healthFill.style.width = `${healthPct}%`;
  shieldFill.style.width = `${shieldPct}%`;
  staminaFill.style.width = `${staminaPct}%`;
  healthValue.textContent = `${Math.ceil(player.health)}`;
  shieldValue.textContent = `${Math.ceil(player.shield)}`;
  staminaValue.textContent = `${Math.ceil(player.sprintEnergy)}`;
  materialsText.textContent = `${player.materials}`;
  aliveText.textContent = `${alive}`;
  ammoText.textContent = `${player.weapon.ammoInMag} / ${player.weapon.reserveAmmo}`;
  reloadText.textContent =
    player.weapon.reloadTimer > 0
      ? `Reloading ${player.weapon.reloadTimer.toFixed(1)}s`
      : player.weapon.ammoInMag === 0
        ? "Empty"
        : "Ready";
  weaponName.textContent = player.weapon.name;
  weaponRarity.textContent = player.weapon.rarity;
  weaponRarity.style.color = RARITY_COLORS[player.weapon.rarity];

  const phase = state.storm.phases[state.storm.phaseIndex];
  if (!phase) {
    stormText.textContent = "Final storm";
  } else {
    const remaining = Math.max(0, phase.duration - state.storm.phaseElapsed);
    stormText.textContent = `Storm ${remaining.toFixed(0)}s`;
  }
}

function circleTouchesRect(actor, rect) {
  const closestX = clamp(actor.x, rect.x, rect.x + rect.w);
  const closestY = clamp(actor.y, rect.y, rect.y + rect.h);
  const dx = actor.x - closestX;
  const dy = actor.y - closestY;
  return dx * dx + dy * dy <= actor.radius * actor.radius;
}

function moveActor(actor, dx, dy) {
  const solids = state.obstacles.filter((rect) => rect.hp > 0);

  actor.x += dx;
  actor.x = clamp(actor.x, actor.radius, WORLD.width - actor.radius);
  for (const rect of solids) {
    if (circleTouchesRect(actor, rect)) {
      if (dx > 0) {
        actor.x = rect.x - actor.radius;
      } else if (dx < 0) {
        actor.x = rect.x + rect.w + actor.radius;
      }
    }
  }

  actor.y += dy;
  actor.y = clamp(actor.y, actor.radius, WORLD.height - actor.radius);
  for (const rect of solids) {
    if (circleTouchesRect(actor, rect)) {
      if (dy > 0) {
        actor.y = rect.y - actor.radius;
      } else if (dy < 0) {
        actor.y = rect.y + rect.h + actor.radius;
      }
    }
  }
}

function startReload(actor) {
  if (
    actor.weapon.reloadTimer > 0 ||
    actor.weapon.ammoInMag === actor.weapon.magSize ||
    actor.weapon.reserveAmmo <= 0
  ) {
    return;
  }

  actor.weapon.reloadTimer = actor.weapon.reloadTime;
}

function finishReload(actor) {
  const need = actor.weapon.magSize - actor.weapon.ammoInMag;
  const amount = Math.min(need, actor.weapon.reserveAmmo);
  actor.weapon.ammoInMag += amount;
  actor.weapon.reserveAmmo -= amount;
  actor.weapon.reloadTimer = 0;
}

function emitParticles(x, y, color, amount, speed = 160) {
  for (let i = 0; i < amount; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const velocity = rand(speed * 0.35, speed);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      color,
      life: rand(0.18, 0.45),
      size: rand(1.5, 4),
    });
  }
}

function shoot(actor, forcedAngle = actor.angle) {
  if (!actor.alive) {
    return;
  }

  if (actor.weapon.reloadTimer > 0) {
    return;
  }

  if (actor.weapon.ammoInMag <= 0) {
    startReload(actor);
    return;
  }

  if (actor.weapon.cooldown > 0) {
    return;
  }

  actor.weapon.cooldown = actor.weapon.fireDelay;
  actor.weapon.ammoInMag -= 1;
  emitParticles(
    actor.x + Math.cos(forcedAngle) * actor.radius,
    actor.y + Math.sin(forcedAngle) * actor.radius,
    actor.weapon.color,
    7,
    220
  );

  for (let i = 0; i < actor.weapon.pellets; i += 1) {
    const pelletSpread =
      actor.weapon.pellets === 1
        ? rand(-actor.weapon.spread, actor.weapon.spread)
        : rand(-actor.weapon.spread, actor.weapon.spread);
    const angle = forcedAngle + pelletSpread;
    state.bullets.push({
      x: actor.x + Math.cos(angle) * (actor.radius + 8),
      y: actor.y + Math.sin(angle) * (actor.radius + 8),
      vx: Math.cos(angle) * actor.weapon.bulletSpeed,
      vy: Math.sin(angle) * actor.weapon.bulletSpeed,
      ownerId: actor.id,
      damage: actor.weapon.damage,
      color: actor.weapon.color,
      life: actor.weapon.range / actor.weapon.bulletSpeed,
    });
  }
}

function damageActor(actor, amount, source) {
  if (!actor.alive) {
    return;
  }

  actor.hitFlash = 0.15;
  let remaining = amount;

  if (actor.shield > 0) {
    const shieldHit = Math.min(actor.shield, remaining);
    actor.shield -= shieldHit;
    remaining -= shieldHit;
  }

  if (remaining > 0) {
    actor.health -= remaining;
  }

  const owner =
    source === "storm"
      ? null
      : [state.player, ...state.bots].find((entry) => entry.id === source);
  const floaterColor = actor.shield > 0 && remaining === 0 ? "#62d8ff" : "#ffdf8b";
  addFloater(actor.x, actor.y - actor.radius - 6, `${Math.ceil(amount)}`, floaterColor, 18);
  if (owner?.kind === "player" && actor.kind !== "player") {
    state.hitMarker = 0.12;
  }

  emitParticles(actor.x, actor.y, actor.kind === "player" ? "#ff9988" : "#ffe27a", 8, 120);

  if (actor.health <= 0) {
    actor.alive = false;
    actor.health = 0;
    onActorEliminated(actor, source);
  }
}

function onActorEliminated(actor, source) {
  const owner =
    livingActors().find((entry) => entry.id === source) ||
    [state.player, ...state.bots].find((entry) => entry.id === source);

  if (owner) {
    owner.kills += 1;
    if (source !== "storm" && owner.alive) {
      owner.health = clamp(owner.health + 20, 0, 100);
      owner.shield = clamp(owner.shield + 20, 0, 100);
      if (owner.kind === "player") {
        addFeed("Elim siphon: +20 health and +20 shield.");
        addFloater(owner.x, owner.y - 34, "SIPHON", "#8dff7a", 18);
      }
    }
  }

  spawnLootDrop(actor);

  if (actor.kind === "player") {
    state.mode = "defeat";
    setOverlay(
      "Eliminated",
      `You placed #${livingActors().length + 1}. Press R or Enter to redeploy.`
    );
    overlay.classList.remove("hidden");
    addFeed("You were eliminated. Press R or Enter to restart.");
  } else {
    addFeed(`${actor.name} was eliminated${owner ? ` by ${owner.name}` : ""}.`);
    if (livingActors().length === 1 && state.player.alive) {
      state.mode = "victory";
      setOverlay(
        "Victory Royale",
        `You survived with ${state.player.kills} eliminations. Press Enter to run it again.`
      );
      overlay.classList.remove("hidden");
      addFeed("Victory Royale. You wiped the lobby.");
    }
  }
}

function spawnLootDrop(actor) {
  const types = ["ammo", "shield", "mats"];
  if (Math.random() > 0.45) {
    types.push("med");
  }
  if (Math.random() > 0.65) {
    types.push("weapon");
  }

  for (let i = 0; i < 2; i += 1) {
    const type = choose(types);
    state.loot.push({
      id: `drop-${Math.random().toString(36).slice(2, 8)}`,
      type,
      x: actor.x + rand(-18, 18),
      y: actor.y + rand(-18, 18),
      radius: 15,
      value: type === "ammo" ? 30 : type === "shield" ? 24 : type === "med" ? 26 : 18,
      weaponTemplate: type === "weapon" ? choose(weaponTemplates.slice(1)) : null,
      bob: rand(0, Math.PI * 2),
    });
  }
}

function applyLoot(actor, item) {
  if (item.type === "ammo") {
    actor.weapon.reserveAmmo += item.value;
    addFloater(item.x, item.y - 10, `+${item.value} ammo`, "#f8f57a", 16);
    if (actor.kind === "player") {
      addFeed(`+${item.value} ammo`);
    }
  } else if (item.type === "shield") {
    actor.shield = clamp(actor.shield + item.value, 0, 100);
    addFloater(item.x, item.y - 10, `+${item.value} shield`, "#62d8ff", 16);
    if (actor.kind === "player") {
      addFeed(`Shield boosted by ${item.value}`);
    }
  } else if (item.type === "med") {
    actor.health = clamp(actor.health + item.value, 0, 100);
    addFloater(item.x, item.y - 10, `+${item.value} health`, "#ff8f91", 16);
    if (actor.kind === "player") {
      addFeed(`Healed ${item.value}`);
    }
  } else if (item.type === "mats") {
    actor.materials += item.value;
    addFloater(item.x, item.y - 10, `+${item.value} mats`, "#ffcb6d", 16);
    if (actor.kind === "player") {
      addFeed(`+${item.value} materials`);
    }
  } else if (item.type === "weapon" && item.weaponTemplate) {
    const incoming = item.weaponTemplate;
    const current = actor.weapon;
    const better =
      weaponTemplates.findIndex((entry) => entry.id === incoming.id) >
      weaponTemplates.findIndex((entry) => entry.id === current.id);

    if (better || actor.kind === "player") {
      actor.weapon = makeWeapon(incoming);
      addFloater(item.x, item.y - 10, incoming.name, incoming.color, 16);
      if (actor.kind === "player") {
        addFeed(`Picked up ${incoming.rarity} ${incoming.name}`);
      }
    } else {
      actor.weapon.reserveAmmo += 16;
    }
  }
}

function tryCollectLoot(actor) {
  state.loot = state.loot.filter((item) => {
    if (!actor.alive) {
      return true;
    }
    if (Math.hypot(item.x - actor.x, item.y - actor.y) < actor.radius + item.radius + 10) {
      applyLoot(actor, item);
      emitParticles(item.x, item.y, "#ffffff", 9, 100);
      return false;
    }
    return true;
  });
}

function getBuildPlacement(actor) {
  const facingX = Math.cos(actor.angle);
  const facingY = Math.sin(actor.angle);
  const centerX = actor.x + facingX * 72;
  const centerY = actor.y + facingY * 72;
  const horizontal = Math.abs(facingY) > Math.abs(facingX);
  const wall = {
    id: `wall-${Math.random().toString(36).slice(2, 8)}`,
    x: horizontal ? centerX - 44 : centerX - 10,
    y: horizontal ? centerY - 10 : centerY - 44,
    w: horizontal ? 88 : 20,
    h: horizontal ? 20 : 88,
    color: actor.kind === "player" ? "#71f0be" : "#ffcb6d",
    kind: "wall",
    destructible: true,
    hp: 130,
    ttl: 18,
  };

  const blocked =
    wall.x < 20 ||
    wall.y < 20 ||
    wall.x + wall.w > WORLD.width - 20 ||
    wall.y + wall.h > WORLD.height - 20 ||
    state.obstacles.some((rect) => rect.hp > 0 && rectsOverlap(rect, wall)) ||
    livingActors().some((other) => circleTouchesRect(other, wall));

  return { wall, blocked };
}

function buildWall(actor) {
  if (!actor.alive || actor.materials < 10 || actor.buildCooldown > 0) {
    return;
  }

  const { wall, blocked } = getBuildPlacement(actor);

  if (blocked) {
    if (actor.kind === "player") {
      addFeed("No room to build here.");
    }
    return;
  }

  actor.materials -= 10;
  actor.buildCooldown = 0.45;
  state.obstacles.push(wall);
  emitParticles(wall.x + wall.w / 2, wall.y + wall.h / 2, wall.color, 10, 90);

  if (actor.kind === "player") {
    addFeed("Wall built.");
  }
}

function updatePlayer(dt) {
  const player = state.player;
  if (!player.alive) {
    return;
  }

  let moveX = 0;
  let moveY = 0;
  if (state.input.up) moveY -= 1;
  if (state.input.down) moveY += 1;
  if (state.input.left) moveX -= 1;
  if (state.input.right) moveX += 1;

  const length = magnitude(moveX, moveY) || 1;
  moveX /= length;
  moveY /= length;

  const moving = magnitude(moveX, moveY) > 0;
  const canSprint = state.input.sprint && moving && player.sprintEnergy > 6;
  const sprintMultiplier = canSprint ? 1.58 : 1;
  player.sprinting = canSprint;
  if (canSprint) {
    player.sprintEnergy = Math.max(0, player.sprintEnergy - 54 * dt);
    emitParticles(player.x, player.y, "#ffe27a", 1, 35);
  } else {
    const regen = moving ? 18 : 34;
    player.sprintEnergy = Math.min(100, player.sprintEnergy + regen * dt);
  }

  moveActor(
    player,
    moveX * player.speed * sprintMultiplier * dt,
    moveY * player.speed * sprintMultiplier * dt
  );
  player.angle = Math.atan2(
    state.input.mouseY - state.viewport.height / 2,
    state.input.mouseX - state.viewport.width / 2
  );

  if (state.input.reloadQueued) {
    startReload(player);
  }

  if (state.input.buildQueued) {
    buildWall(player);
  }

  if (state.input.shoot) {
    shoot(player);
  }
}

function nearestTarget(actor) {
  let closest = null;
  let closestDistance = Infinity;

  for (const other of livingActors()) {
    if (other.id === actor.id) {
      continue;
    }
    const dist = distance(actor, other);
    if (dist < closestDistance) {
      closest = other;
      closestDistance = dist;
    }
  }

  return closest;
}

function updateBot(bot, dt) {
  if (!bot.alive) {
    return;
  }

  bot.ai.retargetIn -= dt;
  const target = nearestTarget(bot);
  let moveX = 0;
  let moveY = 0;

  if (target) {
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const dist = Math.hypot(dx, dy);
    const safeDist = dist || 1;
    const angle = Math.atan2(dy, dx);
    bot.angle = angle;

    const outsideStorm =
      Math.hypot(bot.x - state.storm.x, bot.y - state.storm.y) > state.storm.radius - 60;
    const preferredRange = bot.weapon.id === "shotgun" ? 170 : 280;

    if (outsideStorm) {
      const stormDx = state.storm.x - bot.x;
      const stormDy = state.storm.y - bot.y;
      const stormDist = Math.hypot(stormDx, stormDy) || 1;
      moveX += stormDx / stormDist;
      moveY += stormDy / stormDist;
    } else if (dist > preferredRange + 40) {
      moveX += dx / safeDist;
      moveY += dy / safeDist;
    } else if (dist < preferredRange - 30) {
      moveX -= dx / safeDist;
      moveY -= dy / safeDist;
    }

    const strafe = bot.ai.strafeDir * 0.65;
    moveX += Math.cos(angle + Math.PI / 2) * strafe;
    moveY += Math.sin(angle + Math.PI / 2) * strafe;

    if (dist < bot.weapon.range * 0.9 && Math.random() > 0.15) {
      shoot(bot, angle + rand(-0.06, 0.06));
      if (Math.random() > 0.985 && bot.materials >= 10 && dist < 280) {
        buildWall(bot);
      }
    }
  } else {
    const dx = bot.ai.roamX - bot.x;
    const dy = bot.ai.roamY - bot.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 40 || bot.ai.retargetIn <= 0) {
      bot.ai.roamX = rand(120, WORLD.width - 120);
      bot.ai.roamY = rand(120, WORLD.height - 120);
      bot.ai.retargetIn = rand(0.75, 1.8);
      bot.ai.strafeDir *= -1;
    }

    moveX += dx / (dist || 1);
    moveY += dy / (dist || 1);
    bot.angle = Math.atan2(moveY, moveX);
  }

  const outsideStorm =
    Math.hypot(bot.x - state.storm.x, bot.y - state.storm.y) > state.storm.radius - 40;
  if (outsideStorm) {
    const dx = state.storm.x - bot.x;
    const dy = state.storm.y - bot.y;
    const dist = Math.hypot(dx, dy) || 1;
    moveX += (dx / dist) * 0.8;
    moveY += (dy / dist) * 0.8;
  }

  const moveLength = magnitude(moveX, moveY) || 1;
  moveActor(
    bot,
    (moveX / moveLength) * bot.speed * dt,
    (moveY / moveLength) * bot.speed * dt
  );

  tryCollectLoot(bot);
}

function updateActors(dt) {
  const actors = [state.player, ...state.bots];

  for (const actor of actors) {
    if (!actor.alive) {
      continue;
    }

    actor.hitFlash = Math.max(0, actor.hitFlash - dt);
    actor.weapon.cooldown = Math.max(0, actor.weapon.cooldown - dt);
    actor.buildCooldown = Math.max(0, actor.buildCooldown - dt);

    if (actor.weapon.reloadTimer > 0) {
      actor.weapon.reloadTimer = Math.max(0, actor.weapon.reloadTimer - dt);
      if (actor.weapon.reloadTimer === 0) {
        finishReload(actor);
      }
    } else if (actor.weapon.ammoInMag === 0) {
      startReload(actor);
    }
  }

  updatePlayer(dt);
  for (const bot of state.bots) {
    updateBot(bot, dt);
  }
  tryCollectLoot(state.player);
}

function updateBullets(dt) {
  const actors = [state.player, ...state.bots];
  const activeObstacles = state.obstacles.filter((rect) => rect.hp > 0);

  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < -20 ||
      bullet.y < -20 ||
      bullet.x > WORLD.width + 20 ||
      bullet.y > WORLD.height + 20
    ) {
      return false;
    }

    for (const rect of activeObstacles) {
      if (pointInRect(bullet.x, bullet.y, rect)) {
        if (rect.destructible) {
          rect.hp -= bullet.damage * 1.35;
          emitParticles(bullet.x, bullet.y, rect.color, 5, 70);
        }
        return false;
      }
    }

    for (const actor of actors) {
      if (!actor.alive || actor.id === bullet.ownerId) {
        continue;
      }

      if (Math.hypot(bullet.x - actor.x, bullet.y - actor.y) <= actor.radius + 2) {
        damageActor(actor, bullet.damage, bullet.ownerId);
        return false;
      }
    }

    return true;
  });
}

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    return particle.life > 0;
  });
}

function updateLoot(dt) {
  for (const item of state.loot) {
    item.bob += dt * 2.3;
  }
}

function spawnSupplyCache() {
  const phase = state.storm.phases[state.storm.phaseIndex];
  const centerX = phase ? state.storm.x : WORLD.width / 2;
  const centerY = phase ? state.storm.y : WORLD.height / 2;
  const spawnRadius = Math.max(180, state.storm.radius * 0.55);
  const angle = rand(0, Math.PI * 2);
  const distanceFromCenter = rand(90, spawnRadius);
  const x = clamp(
    centerX + Math.cos(angle) * distanceFromCenter,
    120,
    WORLD.width - 120
  );
  const y = clamp(
    centerY + Math.sin(angle) * distanceFromCenter,
    120,
    WORLD.height - 120
  );
  const weaponTemplate = choose(weaponTemplates.slice(1));

  state.loot.push(
    {
      id: `cache-weapon-${Math.random().toString(36).slice(2, 7)}`,
      type: "weapon",
      x,
      y,
      radius: 19,
      value: 0,
      weaponTemplate,
      bob: rand(0, Math.PI * 2),
    },
    {
      id: `cache-shield-${Math.random().toString(36).slice(2, 7)}`,
      type: "shield",
      x: x + rand(-20, 20),
      y: y + rand(-20, 20),
      radius: 16,
      value: 34,
      bob: rand(0, Math.PI * 2),
    },
    {
      id: `cache-mats-${Math.random().toString(36).slice(2, 7)}`,
      type: "mats",
      x: x + rand(-20, 20),
      y: y + rand(-20, 20),
      radius: 16,
      value: 28,
      bob: rand(0, Math.PI * 2),
    }
  );

  emitParticles(x, y, weaponTemplate.color, 28, 120);
  addFeed(`Supply cache dropped near the safe zone.`);
  addFloater(x, y - 18, "CACHE", weaponTemplate.color, 22);
}

function updateMatchEvents(dt) {
  state.nextSupplyDropIn -= dt;
  if (state.nextSupplyDropIn <= 0) {
    spawnSupplyCache();
    state.nextSupplyDropIn = rand(18, 24);
  }
}

function updateFloaters(dt) {
  state.floaters = state.floaters.filter((floater) => {
    floater.x += floater.vx * dt;
    floater.y += floater.vy * dt;
    floater.life -= dt;
    return floater.life > 0;
  });
}

function updateFeed(dt) {
  state.feed = state.feed.filter((item) => {
    item.ttl -= dt;
    return item.ttl > 0;
  });
  renderFeed();
}

function updateStorm(dt) {
  const storm = state.storm;
  const phase = storm.phases[storm.phaseIndex];

  if (phase) {
    storm.phaseElapsed += dt;
    const progress = clamp(storm.phaseElapsed / phase.duration, 0, 1);
    storm.x = lerp(phase.startX, phase.targetX, progress);
    storm.y = lerp(phase.startY, phase.targetY, progress);
    storm.radius = lerp(phase.startRadius, phase.targetRadius, progress);
    storm.damage = phase.damage;

    if (storm.phaseElapsed >= phase.duration) {
      storm.phaseIndex += 1;
      storm.phaseElapsed = 0;
      const next = storm.phases[storm.phaseIndex];
      if (!next) {
        storm.damage = 16;
      }
    }
  }

  for (const actor of livingActors()) {
    const dist = Math.hypot(actor.x - storm.x, actor.y - storm.y);
    if (dist > storm.radius) {
      damageActor(actor, storm.damage * dt, "storm");
    }
  }
}

function cleanupWorld(dt) {
  state.obstacles = state.obstacles.filter((rect) => {
    if (rect.kind === "wall") {
      rect.ttl -= dt;
      return rect.hp > 0 && rect.ttl > 0;
    }
    return true;
  });
}

function updateCamera() {
  state.camera.x = clamp(
    state.player.x - state.viewport.width / 2,
    0,
    WORLD.width - state.viewport.width
  );
  state.camera.y = clamp(
    state.player.y - state.viewport.height / 2,
    0,
    WORLD.height - state.viewport.height
  );
}

function drawGround() {
  const { width, height } = state.viewport;
  const startX = Math.floor(state.camera.x / 80) * 80;
  const endX = state.camera.x + width + 80;
  const startY = Math.floor(state.camera.y / 80) * 80;
  const endY = state.camera.y + height + 80;

  ctx.fillStyle = "#273627";
  ctx.fillRect(0, 0, width, height);

  for (let x = startX; x < endX; x += 80) {
    for (let y = startY; y < endY; y += 80) {
      const sx = x - state.camera.x;
      const sy = y - state.camera.y;
      ctx.fillStyle =
        (Math.floor(x / 80) + Math.floor(y / 80)) % 2 === 0
          ? "rgba(255,255,255,0.018)"
          : "rgba(0,0,0,0.04)";
      ctx.fillRect(sx, sy, 80, 80);
    }
  }

  for (let i = 0; i < 32; i += 1) {
    const patchX = ((i * 197) % WORLD.width) - state.camera.x;
    const patchY = ((i * 281) % WORLD.height) - state.camera.y;
    ctx.fillStyle = i % 2 === 0 ? "rgba(133, 191, 94, 0.12)" : "rgba(77, 110, 63, 0.12)";
    ctx.beginPath();
    ctx.ellipse(patchX, patchY, 70, 42, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawObstacles() {
  for (const rect of state.obstacles) {
    if (rect.hp <= 0) {
      continue;
    }
    const sx = rect.x - state.camera.x;
    const sy = rect.y - state.camera.y;

    ctx.fillStyle = rect.color;
    ctx.fillRect(sx, sy, rect.w, rect.h);
    ctx.strokeStyle = rect.kind === "wall" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, rect.w, rect.h);

    if (rect.kind === "wall") {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(sx + 4, sy + 4, rect.w - 8, rect.h - 8);
    }
  }
}

function drawLoot() {
  for (const item of state.loot) {
    const sx = item.x - state.camera.x;
    const sy = item.y - state.camera.y + Math.sin(item.bob) * 4;
    const color = getLootColor(item);

    ctx.fillStyle = `${color}22`;
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, item.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.beginPath();
    ctx.arc(sx - 4, sy - 4, 4, 0, Math.PI * 2);
    ctx.fill();

    if (
      state.player?.alive &&
      Math.hypot(state.player.x - item.x, state.player.y - item.y) < 140
    ) {
      ctx.fillStyle = "rgba(7, 10, 18, 0.74)";
      ctx.fillRect(sx - 42, sy - 32, 84, 18);
      ctx.fillStyle = color;
      ctx.font = '12px "Trebuchet MS", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(getLootLabel(item), sx, sy - 19);
    }
  }
}

function drawBuildPreview() {
  if (!state.player?.alive || state.mode !== "playing") {
    return;
  }

  const { wall, blocked } = getBuildPlacement(state.player);
  const sx = wall.x - state.camera.x;
  const sy = wall.y - state.camera.y;

  ctx.save();
  ctx.fillStyle = blocked ? "rgba(255, 107, 107, 0.24)" : "rgba(113, 240, 190, 0.26)";
  ctx.strokeStyle = blocked ? "rgba(255, 107, 107, 0.8)" : "rgba(113, 240, 190, 0.92)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.fillRect(sx, sy, wall.w, wall.h);
  ctx.strokeRect(sx, sy, wall.w, wall.h);
  ctx.restore();
}

function drawBullets() {
  for (const bullet of state.bullets) {
    const sx = bullet.x - state.camera.x;
    const sy = bullet.y - state.camera.y;
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawActor(actor) {
  if (!actor || !actor.alive) {
    return;
  }

  const sx = actor.x - state.camera.x;
  const sy = actor.y - state.camera.y;
  const bodyColor =
    actor.kind === "player"
      ? actor.hitFlash > 0
        ? "#ffd0cb"
        : "#f7fff2"
      : actor.hitFlash > 0
        ? "#ffe8ac"
        : "#f0b463";

  ctx.save();
  ctx.translate(sx, sy);

  ctx.fillStyle = actor.kind === "player" ? "rgba(82, 199, 255, 0.22)" : "rgba(255, 191, 79, 0.14)";
  ctx.beginPath();
  ctx.arc(0, 0, actor.radius + 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(actor.angle);
  ctx.fillStyle = actor.weapon.color;
  ctx.fillRect(actor.radius - 2, -4, 22, 8);
  ctx.restore();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(sx, sy, actor.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = actor.kind === "player" ? "#52c7ff" : "#402d10";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(sx - 22, sy - actor.radius - 18, 44, 6);
  ctx.fillStyle = "#73ff7c";
  ctx.fillRect(
    sx - 22,
    sy - actor.radius - 18,
    44 * clamp(actor.health / 100, 0, 1),
    6
  );

  ctx.fillStyle = "#dfe6f2";
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(actor.name, sx, sy + actor.radius + 18);
}

function drawParticles() {
  for (const particle of state.particles) {
    const sx = particle.x - state.camera.x;
    const sy = particle.y - state.camera.y;
    ctx.globalAlpha = clamp(particle.life * 2.6, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(sx, sy, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters() {
  ctx.save();
  ctx.textAlign = "center";
  for (const floater of state.floaters) {
    const sx = floater.x - state.camera.x;
    const sy = floater.y - state.camera.y;
    ctx.globalAlpha = clamp(floater.life * 1.5, 0, 1);
    ctx.fillStyle = floater.color;
    ctx.font = `700 ${floater.size}px "Trebuchet MS", sans-serif`;
    ctx.fillText(floater.text, sx, sy);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawStorm() {
  const sx = state.storm.x - state.camera.x;
  const sy = state.storm.y - state.camera.y;

  ctx.save();
  ctx.fillStyle = "rgba(107, 33, 168, 0.33)";
  ctx.beginPath();
  ctx.rect(0, 0, state.viewport.width, state.viewport.height);
  ctx.arc(sx, sy, state.storm.radius, 0, Math.PI * 2, true);
  ctx.fill("evenodd");

  ctx.strokeStyle = "rgba(121, 220, 255, 0.92)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(sx, sy, state.storm.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMinimap() {
  const mapWidth = 180;
  const mapHeight = 122;
  const x = state.viewport.width - mapWidth - 20;
  const y = 20;

  ctx.save();
  ctx.fillStyle = "rgba(10, 14, 24, 0.72)";
  ctx.fillRect(x, y, mapWidth, mapHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, mapWidth, mapHeight);

  const scaleX = mapWidth / WORLD.width;
  const scaleY = mapHeight / WORLD.height;

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (const rect of state.obstacles) {
    if (rect.hp <= 0) continue;
    ctx.fillRect(
      x + rect.x * scaleX,
      y + rect.y * scaleY,
      rect.w * scaleX,
      rect.h * scaleY
    );
  }

  ctx.strokeStyle = "#79dcff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(
    x + state.storm.x * scaleX,
    y + state.storm.y * scaleY,
    state.storm.radius * scaleX,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  for (const bot of state.bots) {
    if (!bot.alive) continue;
    ctx.fillStyle = "#ffc04b";
    ctx.beginPath();
    ctx.arc(x + bot.x * scaleX, y + bot.y * scaleY, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.player.alive) {
    ctx.fillStyle = "#7dff8d";
    ctx.beginPath();
    ctx.arc(
      x + state.player.x * scaleX,
      y + state.player.y * scaleY,
      3.2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawCrosshair() {
  const x = state.input.mouseX;
  const y = state.input.mouseY;
  const hitExpand = state.hitMarker > 0 ? 6 : 0;

  ctx.save();
  ctx.strokeStyle = state.hitMarker > 0 ? "#8dff7a" : "rgba(255,255,255,0.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 9 - hitExpand, y);
  ctx.lineTo(x + 9 + hitExpand, y);
  ctx.moveTo(x, y - 9 - hitExpand);
  ctx.lineTo(x, y + 9 + hitExpand);
  if (state.hitMarker > 0) {
    ctx.moveTo(x - 8, y - 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.moveTo(x - 8, y + 8);
    ctx.lineTo(x + 8, y - 8);
  }
  ctx.stroke();
  ctx.restore();
}

function drawStormPointer() {
  if (!state.player?.alive) {
    return;
  }

  const distFromCenter = Math.hypot(
    state.player.x - state.storm.x,
    state.player.y - state.storm.y
  );
  if (distFromCenter <= state.storm.radius) {
    return;
  }

  const angle = Math.atan2(state.storm.y - state.player.y, state.storm.x - state.player.x);
  const x = state.viewport.width / 2 + Math.cos(angle) * 82;
  const y = state.viewport.height / 2 + Math.sin(angle) * 82;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#79dcff";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(10, 14, 24, 0.72)";
  ctx.fillRect(state.viewport.width / 2 - 88, 18, 176, 34);
  ctx.fillStyle = "#79dcff";
  ctx.font = '700 14px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("MOVE TO THE SAFE ZONE", state.viewport.width / 2, 40);
}

function drawHudText() {
  ctx.save();
  ctx.fillStyle = "rgba(10, 14, 24, 0.7)";
  ctx.fillRect(18, 18, 220, 102);
  ctx.fillStyle = "#eef2f6";
  ctx.font = '16px "Trebuchet MS", sans-serif';
  ctx.fillText(`Elims ${state.player.kills}`, 34, 46);
  ctx.fillText(`Time ${state.matchTime.toFixed(0)}s`, 34, 70);
  ctx.fillText(`Walls ${Math.floor(state.player.materials / 10)}`, 34, 94);
  ctx.fillStyle = state.nextSupplyDropIn < 7 ? "#ffbf4f" : "#9ea8bc";
  ctx.fillText(`Cache ${Math.ceil(state.nextSupplyDropIn)}s`, 34, 118);
  ctx.restore();
}

function render() {
  if (!state.player || !state.storm) {
    ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
    ctx.fillStyle = "#182235";
    ctx.fillRect(0, 0, state.viewport.width, state.viewport.height);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let x = 0; x < state.viewport.width; x += 64) {
      ctx.fillRect(x, 0, 1, state.viewport.height);
    }
    for (let y = 0; y < state.viewport.height; y += 64) {
      ctx.fillRect(0, y, state.viewport.width, 1);
    }
    return;
  }

  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  drawGround();
  drawLoot();
  drawObstacles();
  drawBuildPreview();
  drawBullets();
  drawActor(state.player);
  for (const bot of state.bots) {
    drawActor(bot);
  }
  drawParticles();
  drawFloaters();
  drawStorm();
  drawStormPointer();
  drawMinimap();
  drawHudText();
  if (state.mode === "playing") {
    drawCrosshair();
  }
}

function update(dt) {
  if (state.mode !== "playing") {
    updateParticles(dt);
    updateFloaters(dt);
    updateFeed(dt);
    return;
  }

  state.matchTime += dt;
  updateActors(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateFloaters(dt);
  updateLoot(dt);
  updateStorm(dt);
  updateMatchEvents(dt);
  cleanupWorld(dt);
  updateFeed(dt);
  updateCamera();
  updateHud();
  state.hitMarker = Math.max(0, state.hitMarker - dt);
}

function loop(timestamp) {
  if (!state.lastFrame) {
    state.lastFrame = timestamp;
  }

  const dt = Math.min((timestamp - state.lastFrame) / 1000, 0.033);
  state.lastFrame = timestamp;
  update(dt);
  render();
  state.input.reloadQueued = false;
  state.input.buildQueued = false;
  requestAnimationFrame(loop);
}

function resize() {
  syncViewportLayout();
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.viewport.width = rect.width;
  state.viewport.height = rect.height;
  state.viewport.dpr = dpr;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  reportLayoutMetrics();
}

function syncViewportLayout() {
  const desktopLayout = window.innerWidth > 1100;
  if (!desktopLayout) {
    shell.style.height = "";
    gameLayout.style.height = "";
    return;
  }

  const shellStyles = window.getComputedStyle(shell);
  const shellPadding =
    parseFloat(shellStyles.paddingTop) + parseFloat(shellStyles.paddingBottom);
  const shellGap = parseFloat(shellStyles.rowGap || shellStyles.gap) || 0;
  const viewportHeight = window.innerHeight;
  const heroHeight = hero.getBoundingClientRect().height;
  const availableHeight = Math.max(
    280,
    Math.floor(viewportHeight - shellPadding - shellGap - heroHeight)
  );

  shell.style.height = `${viewportHeight}px`;
  gameLayout.style.height = `${availableHeight}px`;
}

function reportLayoutMetrics() {
  if (!debugLayout) {
    return;
  }

  const metrics = {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    body: Math.round(document.body.getBoundingClientRect().height),
    shell: Math.round(shell.getBoundingClientRect().height),
    hero: Math.round(hero.getBoundingClientRect().height),
    gameLayout: Math.round(gameLayout.getBoundingClientRect().height),
    arena: Math.round(canvas.parentElement.getBoundingClientRect().height),
    canvas: Math.round(canvas.getBoundingClientRect().height),
  };

  let node = document.querySelector("#layoutDebug");
  if (!node) {
    node = document.createElement("pre");
    node.id = "layoutDebug";
    node.style.position = "fixed";
    node.style.right = "8px";
    node.style.bottom = "8px";
    node.style.zIndex = "9999";
    node.style.margin = "0";
    node.style.padding = "8px 10px";
    node.style.font = "12px monospace";
    node.style.color = "#fff";
    node.style.background = "rgba(0, 0, 0, 0.75)";
    node.style.borderRadius = "10px";
    document.body.append(node);
  }

  node.textContent = JSON.stringify(metrics, null, 2);
}

function onKeyChange(event, pressed) {
  const key = event.key.toLowerCase();
  if (key === "w") state.input.up = pressed;
  if (key === "s") state.input.down = pressed;
  if (key === "a") state.input.left = pressed;
  if (key === "d") state.input.right = pressed;
  if (key === "shift") state.input.sprint = pressed;

  if (pressed && key === "r" && state.mode === "playing") {
    state.input.reloadQueued = true;
  }

  if (pressed && key === "f" && state.mode === "playing") {
    state.input.buildQueued = true;
  }

  if (pressed && key === "enter") {
    resetGame();
  }

  if (pressed && key === "r" && (state.mode === "defeat" || state.mode === "victory")) {
    resetGame();
  }
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.input.mouseX = event.clientX - rect.left;
  state.input.mouseY = event.clientY - rect.top;
});

canvas.addEventListener("mousedown", () => {
  state.input.shoot = true;
});

window.addEventListener("mouseup", () => {
  state.input.shoot = false;
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("keydown", (event) => onKeyChange(event, true));
window.addEventListener("keyup", (event) => onKeyChange(event, false));
window.addEventListener("resize", resize);

setOverlay(
  "Press Enter To Drop",
  "This is a keyboard-and-mouse prototype. WASD moves, click fires, R reloads, F builds cover."
);
renderFeed();
resize();
if (params.get("autostart") === "1") {
  resetGame();
}

requestAnimationFrame(loop);
