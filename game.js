(() => {
  const shell = document.getElementById("app-shell");
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;

  const MODEL_OPTIONS = [
    {
      label: "Llama 3.1 8B",
      flavor: "Meta open-weight generalist",
      org: "Meta",
      params: "8B",
      lesson: "Open weights are easier to adapt for domain fine-tunes.",
      microLesson: "Llama 3.1: open weights, easier custom tuning.",
      trainingGain: 20,
      dataCost: 2,
      computeCost: 12,
      playerSpeed: 210,
      projectileSpeed: 600,
    },
    {
      label: "Qwen2.5 14B",
      flavor: "Alibaba multilingual reasoner",
      org: "Alibaba",
      params: "14B",
      lesson: "Qwen models are known for strong multilingual and coding tasks.",
      microLesson: "Qwen2.5: multilingual + coding-friendly behavior.",
      trainingGain: 24,
      dataCost: 2,
      computeCost: 16,
      playerSpeed: 192,
      projectileSpeed: 560,
    },
    {
      label: "Mistral Small 24B",
      flavor: "Mistral higher-capacity model",
      org: "Mistral AI",
      params: "24B",
      lesson: "Larger parameter counts can improve quality but raise compute needs.",
      microLesson: "Mistral Small: higher quality, higher compute cost.",
      trainingGain: 30,
      dataCost: 3,
      computeCost: 22,
      playerSpeed: 178,
      projectileSpeed: 530,
    },
  ];

  const DIFFICULTY_OPTIONS = [
    {
      label: "Sandbox",
      spawnInterval: 3.4,
      anomalySpeed: 70,
      alignmentHit: 12,
      timeLimit: 230,
      shardTarget: 8,
    },
    {
      label: "Standard",
      spawnInterval: 2.5,
      anomalySpeed: 88,
      alignmentHit: 18,
      timeLimit: 180,
      shardTarget: 6,
    },
    {
      label: "Research Ops",
      spawnInterval: 1.8,
      anomalySpeed: 106,
      alignmentHit: 24,
      timeLimit: 145,
      shardTarget: 5,
    },
  ];

  const SQUAD_OPTIONS = [2, 3, 4, 5];

  const state = {
    mode: "main_menu",
    manualAdvance: false,
    world: {
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      scaleX: 1,
      scaleY: 1,
      viewportWidth: BASE_WIDTH,
      viewportHeight: BASE_HEIGHT,
    },
    ui: {
      mainMenuIndex: 0,
      settingsIndex: 0,
      pausedIndex: 0,
      resultIndex: 0,
      hoverButtonId: null,
      activeButtons: [],
      notice: "",
      noticeTimer: 0,
    },
    settings: {
      modelIndex: 1,
      difficultyIndex: 1,
      squadIndex: 1,
    },
    player: null,
    resources: null,
    stations: {
      data: { x: 220, y: 390, r: 64, name: "Data Lake" },
      cluster: { x: 640, y: 390, r: 82, name: "Training Cluster" },
      gate: { x: 1060, y: 390, r: 72, name: "Deployment Gate" },
    },
    shards: [],
    anomalies: [],
    projectiles: [],
    spawnTimer: 0,
    shardTimer: 0,
    result: null,
    timeElapsed: 0,
    input: {
      keysDown: new Set(),
      keyPressed: new Set(),
      pointerX: BASE_WIDTH / 2,
      pointerY: BASE_HEIGHT / 2,
      pointerClicked: false,
      pointerClickX: BASE_WIDTH / 2,
      pointerClickY: BASE_HEIGHT / 2,
    },
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function length(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function dist(a, b) {
    return length(a.x - b.x, a.y - b.y);
  }

  function getModel() {
    return MODEL_OPTIONS[state.settings.modelIndex];
  }

  function getDifficulty() {
    return DIFFICULTY_OPTIONS[state.settings.difficultyIndex];
  }

  function getSquadSize() {
    return SQUAD_OPTIONS[state.settings.squadIndex];
  }

  function isKeyDown(...codes) {
    for (const code of codes) {
      if (state.input.keysDown.has(code)) {
        return true;
      }
    }
    return false;
  }

  function consumePress(...codes) {
    for (const code of codes) {
      if (state.input.keyPressed.has(code)) {
        state.input.keyPressed.delete(code);
        return true;
      }
    }
    return false;
  }

  function consumePointerClick() {
    if (!state.input.pointerClicked) {
      return null;
    }
    state.input.pointerClicked = false;
    return {
      x: state.input.pointerClickX,
      y: state.input.pointerClickY,
    };
  }

  function setNotice(text, duration = 1.8) {
    state.ui.notice = text;
    state.ui.noticeTimer = duration;
  }

  function toWorldPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const relX = (clientX - rect.left) / Math.max(1, rect.width);
    const relY = (clientY - rect.top) / Math.max(1, rect.height);
    return {
      x: clamp(relX * BASE_WIDTH, 0, BASE_WIDTH),
      y: clamp(relY * BASE_HEIGHT, 0, BASE_HEIGHT),
    };
  }

  function resizeCanvas() {
    const rect = shell.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    state.world.viewportWidth = rect.width;
    state.world.viewportHeight = rect.height;
    state.world.scaleX = rect.width / BASE_WIDTH;
    state.world.scaleY = rect.height / BASE_HEIGHT;
  }

  function createPlayer() {
    return {
      x: 120,
      y: 390,
      vx: 0,
      vy: 0,
      r: 17,
      facingX: 1,
      facingY: 0,
      cooldown: 0,
    };
  }

  function resetRun() {
    const difficulty = getDifficulty();
    state.player = createPlayer();
    state.resources = {
      data: 2,
      compute: 62,
      alignment: 100,
      training: 0,
      score: 0,
      timeLeft: difficulty.timeLimit,
      deployed: false,
    };
    state.shards = [];
    state.anomalies = [];
    state.projectiles = [];
    state.spawnTimer = difficulty.spawnInterval * 0.65;
    state.shardTimer = 1.2;
    state.timeElapsed = 0;
    state.ui.notice = "Collect data and train your model.";
    state.ui.noticeTimer = 2.4;
    state.result = null;

    for (let i = 0; i < 6; i++) {
      spawnShard();
    }
  }

  function startRun() {
    resetRun();
    state.mode = "playing";
  }

  function spawnShard() {
    state.shards.push({
      x: rand(150, BASE_WIDTH - 140),
      y: rand(150, BASE_HEIGHT - 120),
      r: 10,
      pulse: rand(0, Math.PI * 2),
    });
  }

  function spawnAnomaly() {
    const difficulty = getDifficulty();
    const spawnTop = Math.random() < 0.5;
    state.anomalies.push({
      x: spawnTop ? rand(180, BASE_WIDTH - 120) : BASE_WIDTH - 80,
      y: spawnTop ? 90 : rand(120, BASE_HEIGHT - 100),
      r: 16,
      hp: 1,
      speed: difficulty.anomalySpeed * rand(0.85, 1.15),
      wobble: rand(0, Math.PI * 2),
    });
  }

  function emitProjectile(targetX, targetY) {
    const model = getModel();
    const squad = getSquadSize();
    const player = state.player;
    if (!player || player.cooldown > 0) {
      return;
    }

    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const len = length(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    state.projectiles.push({
      x: player.x + nx * (player.r + 8),
      y: player.y + ny * (player.r + 8),
      vx: nx * model.projectileSpeed,
      vy: ny * model.projectileSpeed,
      r: 5,
      ttl: 1.2,
    });

    player.facingX = nx;
    player.facingY = ny;
    player.cooldown = Math.max(0.09, 0.29 - squad * 0.035);
  }

  function nearStation(station, range = 26) {
    return dist(state.player, station) <= station.r + range;
  }

  function executeInteraction() {
    const model = getModel();
    const resources = state.resources;
    const dataStation = state.stations.data;
    const cluster = state.stations.cluster;
    const gate = state.stations.gate;

    if (nearStation(dataStation, 34)) {
      if (resources.compute >= 9) {
        resources.compute = clamp(resources.compute - 9, 0, 100);
        resources.data += 2;
        resources.score += 6;
        setNotice("Synthetic data batch +2 generated.", 1.4);
      } else {
        setNotice("Need 9 compute to mint data.", 1.4);
      }
      return;
    }

    if (nearStation(cluster, 36)) {
      if (resources.training >= 100) {
        setNotice("Training complete. Move to deployment gate.", 1.5);
        return;
      }
      if (resources.data < model.dataCost) {
        setNotice(`Need ${model.dataCost} data packets for next cycle.`, 1.5);
        return;
      }
      if (resources.compute < model.computeCost) {
        setNotice(`Need ${model.computeCost} compute for training cycle.`, 1.5);
        return;
      }

      resources.data -= model.dataCost;
      resources.compute = clamp(resources.compute - model.computeCost, 0, 100);
      const gain = model.trainingGain + getSquadSize();
      resources.training = clamp(resources.training + gain, 0, 100);
      resources.score += 14 + gain;
      setNotice(`Training +${Math.round(gain)}%. ${model.label} updated.`, 1.6);
      return;
    }

    if (nearStation(gate, 34)) {
      if (resources.training >= 100) {
        resources.deployed = true;
        finishRun(true, "Agent successfully deployed to production.");
      } else {
        setNotice("Deployment locked. Reach 100% training first.", 1.5);
      }
      return;
    }

    setNotice("No station in range. Move closer.", 1.2);
  }

  function finishRun(victory, reason) {
    state.mode = "result";
    state.ui.notice = "";
    state.ui.noticeTimer = 0;
    state.result = {
      victory,
      reason,
      score: state.resources.score,
      training: state.resources.training,
      remainingTime: Math.max(0, state.resources.timeLeft),
    };
    state.ui.resultIndex = 0;
  }

  function getMainMenuButtons() {
    const x = BASE_WIDTH / 2 - 180;
    const y = 318;
    const w = 360;
    const h = 58;
    const gap = 16;
    return [
      {
        id: "start",
        label: "Start Simulation",
        rect: { x, y, w, h },
        action: () => {
          startRun();
        },
      },
      {
        id: "settings",
        label: "Open Settings",
        rect: { x, y: y + (h + gap), w, h },
        action: () => {
          state.mode = "settings";
          state.ui.settingsIndex = 0;
        },
      },
      {
        id: "briefing",
        label: "Mission Brief",
        rect: { x, y: y + 2 * (h + gap), w, h },
        action: () => {
          state.mode = "briefing";
        },
      },
    ];
  }

  function getPausedButtons() {
    const x = BASE_WIDTH / 2 - 170;
    const y = 330;
    const w = 340;
    const h = 56;
    const gap = 14;
    return [
      {
        id: "resume",
        label: "Resume Run",
        rect: { x, y, w, h },
        action: () => {
          state.mode = "playing";
        },
      },
      {
        id: "restart",
        label: "Restart Run",
        rect: { x, y: y + (h + gap), w, h },
        action: () => {
          startRun();
        },
      },
      {
        id: "main_menu",
        label: "Exit To Main Menu",
        rect: { x, y: y + 2 * (h + gap), w, h },
        action: () => {
          state.mode = "main_menu";
          state.ui.mainMenuIndex = 0;
        },
      },
    ];
  }

  function getResultButtons() {
    const x = BASE_WIDTH / 2 - 170;
    const y = 426;
    const w = 340;
    const h = 56;
    const gap = 14;
    return [
      {
        id: "retry",
        label: "Run Again",
        rect: { x, y, w, h },
        action: () => {
          startRun();
        },
      },
      {
        id: "main_menu",
        label: "Back To Main Menu",
        rect: { x, y: y + h + gap, w, h },
        action: () => {
          state.mode = "main_menu";
          state.ui.mainMenuIndex = 0;
        },
      },
    ];
  }

  function getBriefingButtons() {
    return [
      {
        id: "briefing_back",
        label: "Back",
        rect: { x: BASE_WIDTH / 2 - 120, y: 608, w: 240, h: 54 },
        action: () => {
          state.mode = "main_menu";
        },
      },
    ];
  }

  function isPointInRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function resolveHover(buttons) {
    const p = { x: state.input.pointerX, y: state.input.pointerY };
    state.ui.hoverButtonId = null;
    for (const button of buttons) {
      if (isPointInRect(p, button.rect)) {
        state.ui.hoverButtonId = button.id;
        return;
      }
    }
  }

  function maybeHandleButtonClick(buttons) {
    const click = consumePointerClick();
    if (!click) {
      return false;
    }
    for (const button of buttons) {
      if (isPointInRect(click, button.rect)) {
        button.action();
        return true;
      }
    }
    return false;
  }

  function moveMenuIndex(dir, count, field) {
    state.ui[field] = (state.ui[field] + dir + count) % count;
  }

  function updateMainMenu() {
    const buttons = getMainMenuButtons();
    state.ui.activeButtons = buttons;
    resolveHover(buttons);

    if (consumePress("ArrowUp")) {
      moveMenuIndex(-1, buttons.length, "mainMenuIndex");
    }
    if (consumePress("ArrowDown")) {
      moveMenuIndex(1, buttons.length, "mainMenuIndex");
    }
    if (consumePress("Enter", "Space")) {
      buttons[state.ui.mainMenuIndex].action();
      return;
    }
    if (maybeHandleButtonClick(buttons)) {
      return;
    }
  }

  function cycleOption(name, dir) {
    if (name === "model") {
      state.settings.modelIndex =
        (state.settings.modelIndex + dir + MODEL_OPTIONS.length) % MODEL_OPTIONS.length;
      return;
    }
    if (name === "difficulty") {
      state.settings.difficultyIndex =
        (state.settings.difficultyIndex + dir + DIFFICULTY_OPTIONS.length) % DIFFICULTY_OPTIONS.length;
      return;
    }
    if (name === "squad") {
      state.settings.squadIndex =
        (state.settings.squadIndex + dir + SQUAD_OPTIONS.length) % SQUAD_OPTIONS.length;
    }
  }

  function settingsRows() {
    const model = getModel();
    return [
      {
        id: "model",
        label: "Model Family",
        value: `${model.label} | ${model.params} by ${model.org}`,
      },
      {
        id: "difficulty",
        label: "Challenge",
        value: getDifficulty().label,
      },
      {
        id: "squad",
        label: "Agent Squad",
        value: `${getSquadSize()} operators`,
      },
      {
        id: "back",
        label: "Back To Main Menu",
        value: "",
      },
    ];
  }

  function settingsRowRects() {
    const x = BASE_WIDTH / 2 - 370;
    const y = 240;
    const h = 80;
    const gap = 14;
    const w = 740;
    const rows = settingsRows();
    return rows.map((row, idx) => ({
      ...row,
      rect: { x, y: y + idx * (h + gap), w, h },
    }));
  }

  function updateSettings() {
    const rows = settingsRowRects();
    state.ui.activeButtons = rows;
    resolveHover(rows);

    if (consumePress("ArrowUp")) {
      moveMenuIndex(-1, rows.length, "settingsIndex");
    }
    if (consumePress("ArrowDown")) {
      moveMenuIndex(1, rows.length, "settingsIndex");
    }

    const activeRow = rows[state.ui.settingsIndex];
    const left = consumePress("ArrowLeft");
    const right = consumePress("ArrowRight");

    if (activeRow.id !== "back" && (left || right || consumePress("Enter", "Space"))) {
      cycleOption(activeRow.id, left ? -1 : 1);
      setNotice(`${activeRow.label} updated.`, 1.0);
      return;
    }

    if (activeRow.id === "back" && consumePress("Enter", "Space", "KeyB", "Escape")) {
      state.mode = "main_menu";
      return;
    }

    if (consumePress("KeyB", "Escape")) {
      state.mode = "main_menu";
      return;
    }

    const click = consumePointerClick();
    if (!click) {
      return;
    }
    for (const row of rows) {
      if (!isPointInRect(click, row.rect)) {
        continue;
      }
      if (row.id === "back") {
        state.mode = "main_menu";
      } else {
        cycleOption(row.id, 1);
        setNotice(`${row.label} updated.`, 1.0);
      }
      return;
    }
  }

  function updateBriefing() {
    const buttons = getBriefingButtons();
    state.ui.activeButtons = buttons;
    resolveHover(buttons);

    if (consumePress("Enter", "Space", "Escape", "KeyB")) {
      state.mode = "main_menu";
      return;
    }

    maybeHandleButtonClick(buttons);
  }

  function updatePaused() {
    const buttons = getPausedButtons();
    state.ui.activeButtons = buttons;
    resolveHover(buttons);

    if (consumePress("ArrowUp")) {
      moveMenuIndex(-1, buttons.length, "pausedIndex");
    }
    if (consumePress("ArrowDown")) {
      moveMenuIndex(1, buttons.length, "pausedIndex");
    }
    if (consumePress("Enter", "Space")) {
      buttons[state.ui.pausedIndex].action();
      return;
    }
    maybeHandleButtonClick(buttons);
  }

  function updateResult() {
    const buttons = getResultButtons();
    state.ui.activeButtons = buttons;
    resolveHover(buttons);

    if (consumePress("ArrowUp")) {
      moveMenuIndex(-1, buttons.length, "resultIndex");
    }
    if (consumePress("ArrowDown")) {
      moveMenuIndex(1, buttons.length, "resultIndex");
    }
    if (consumePress("Enter", "Space")) {
      buttons[state.ui.resultIndex].action();
      return;
    }
    maybeHandleButtonClick(buttons);
  }

  function updatePlaying(dt) {
    const difficulty = getDifficulty();
    const model = getModel();
    const squad = getSquadSize();
    const resources = state.resources;
    const player = state.player;

    state.timeElapsed += dt;

    const horizontal =
      (isKeyDown("ArrowRight", "KeyD") ? 1 : 0) -
      (isKeyDown("ArrowLeft", "KeyA") ? 1 : 0);
    const vertical =
      (isKeyDown("ArrowDown", "KeyS") ? 1 : 0) -
      (isKeyDown("ArrowUp", "KeyW") ? 1 : 0);

    const moveLen = length(horizontal, vertical) || 1;
    const moveX = horizontal / moveLen;
    const moveY = vertical / moveLen;

    const speed = model.playerSpeed + squad * 6;
    player.vx = moveX * speed;
    player.vy = moveY * speed;

    if (horizontal !== 0 || vertical !== 0) {
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.facingX = moveX;
      player.facingY = moveY;
    } else {
      player.vx = 0;
      player.vy = 0;
    }

    player.x = clamp(player.x, player.r + 24, BASE_WIDTH - player.r - 24);
    player.y = clamp(player.y, player.r + 94, BASE_HEIGHT - player.r - 24);

    resources.compute = clamp(resources.compute + (6.2 + squad * 1.05) * dt, 0, 100);
    resources.timeLeft = Math.max(0, resources.timeLeft - dt);
    player.cooldown = Math.max(0, player.cooldown - dt);

    if (consumePress("Space")) {
      emitProjectile(player.x + player.facingX * 10, player.y + player.facingY * 10);
    }

    const click = consumePointerClick();
    if (click) {
      emitProjectile(click.x, click.y);
    }

    if (consumePress("KeyE", "KeyB")) {
      executeInteraction();
      if (state.mode !== "playing") {
        return;
      }
    }

    if (consumePress("Enter", "Escape", "KeyP")) {
      state.mode = "paused";
      state.ui.pausedIndex = 0;
      return;
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnAnomaly();
      state.spawnTimer = difficulty.spawnInterval * rand(0.85, 1.15);
    }

    state.shardTimer -= dt;
    if (state.shardTimer <= 0 && state.shards.length < difficulty.shardTarget) {
      spawnShard();
      state.shardTimer = rand(1.4, 2.8);
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.ttl -= dt;
      if (
        projectile.ttl <= 0 ||
        projectile.x < -20 ||
        projectile.x > BASE_WIDTH + 20 ||
        projectile.y < -20 ||
        projectile.y > BASE_HEIGHT + 20
      ) {
        state.projectiles.splice(i, 1);
      }
    }

    for (let i = state.shards.length - 1; i >= 0; i--) {
      const shard = state.shards[i];
      shard.pulse += dt * 3.6;
      if (dist(player, shard) <= player.r + shard.r + 4) {
        state.resources.data += 1;
        state.resources.score += 6;
        state.shards.splice(i, 1);
      }
    }

    for (let i = state.anomalies.length - 1; i >= 0; i--) {
      const anomaly = state.anomalies[i];
      const toClusterX = state.stations.cluster.x - anomaly.x;
      const toClusterY = state.stations.cluster.y - anomaly.y;
      const d = length(toClusterX, toClusterY) || 1;
      anomaly.x += (toClusterX / d) * anomaly.speed * dt;
      anomaly.y += (toClusterY / d) * anomaly.speed * dt;
      anomaly.wobble += dt * 5;

      if (d <= state.stations.cluster.r * 0.66) {
        state.resources.alignment = clamp(
          state.resources.alignment - difficulty.alignmentHit,
          0,
          100
        );
        setNotice("Anomaly hit cluster integrity.", 1.2);
        state.anomalies.splice(i, 1);
        continue;
      }

      if (dist(player, anomaly) <= player.r + anomaly.r + 2) {
        state.resources.alignment = clamp(state.resources.alignment - difficulty.alignmentHit * 0.45, 0, 100);
        state.anomalies.splice(i, 1);
        setNotice("Direct drift contact. Alignment reduced.", 1.2);
        continue;
      }
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      let hit = false;
      for (let j = state.anomalies.length - 1; j >= 0; j--) {
        const anomaly = state.anomalies[j];
        if (dist(projectile, anomaly) <= projectile.r + anomaly.r + 1) {
          state.resources.score += 12;
          state.resources.compute = clamp(state.resources.compute + 4, 0, 100);
          state.anomalies.splice(j, 1);
          hit = true;
          break;
        }
      }
      if (hit) {
        state.projectiles.splice(i, 1);
      }
    }

    if (state.resources.training >= 100 && nearStation(state.stations.gate, 52)) {
      setNotice("Press E or B to deploy your trained agent.", 0.9);
    }

    if (state.resources.timeLeft <= 0) {
      finishRun(false, "Funding window closed before deployment.");
      return;
    }

    if (state.resources.alignment <= 0) {
      finishRun(false, "Alignment collapsed due to unmanaged drift.");
    }
  }

  function update(dt) {
    if (state.ui.noticeTimer > 0) {
      state.ui.noticeTimer = Math.max(0, state.ui.noticeTimer - dt);
      if (state.ui.noticeTimer === 0) {
        state.ui.notice = "";
      }
    }

    state.ui.activeButtons = [];
    state.ui.hoverButtonId = null;

    if (state.mode === "main_menu") {
      updateMainMenu();
      return;
    }
    if (state.mode === "settings") {
      updateSettings();
      return;
    }
    if (state.mode === "briefing") {
      updateBriefing();
      return;
    }
    if (state.mode === "playing") {
      updatePlaying(dt);
      return;
    }
    if (state.mode === "paused") {
      updatePaused();
      return;
    }
    if (state.mode === "result") {
      updateResult();
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, BASE_WIDTH, BASE_HEIGHT);
    grad.addColorStop(0, "#04212f");
    grad.addColorStop(0.5, "#0c3450");
    grad.addColorStop(1, "#11384c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    for (let i = 0; i < 24; i++) {
      const y = 80 + i * 28;
      const pulse = Math.sin(state.timeElapsed * 0.6 + i * 0.4) * 0.12 + 0.16;
      ctx.strokeStyle = `rgba(140, 220, 255, ${pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(BASE_WIDTH, y);
      ctx.stroke();
    }

    const nodes = [
      { x: 170, y: 120, c: "rgba(104, 198, 255, 0.3)" },
      { x: 420, y: 86, c: "rgba(139, 238, 189, 0.28)" },
      { x: 920, y: 94, c: "rgba(255, 198, 124, 0.24)" },
      { x: 1140, y: 150, c: "rgba(144, 239, 214, 0.2)" },
      { x: 1030, y: 620, c: "rgba(119, 186, 255, 0.25)" },
    ];

    for (const node of nodes) {
      ctx.fillStyle = node.c;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 90, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStation(station, color, subtitle, emphasized = false) {
    ctx.save();
    ctx.translate(station.x, station.y);

    ctx.fillStyle = `${color}22`;
    ctx.beginPath();
    ctx.arc(0, 0, station.r + 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${color}cc`;
    ctx.lineWidth = emphasized ? 5 : 3;
    ctx.beginPath();
    ctx.arc(0, 0, station.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `${color}44`;
    ctx.beginPath();
    ctx.arc(0, 0, station.r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#eaf9ff";
    ctx.font = "700 18px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillText(station.name, 0, station.r + 34);

    ctx.fillStyle = "#b4d8e7";
    ctx.font = "500 14px Space Grotesk";
    ctx.fillText(subtitle, 0, station.r + 55);
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    if (!p) {
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    const angle = Math.atan2(p.facingY, p.facingX);
    ctx.rotate(angle);

    ctx.fillStyle = "#f5f8ff";
    ctx.strokeStyle = "#57c6ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, 13);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-12, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (p.cooldown > 0.02) {
      ctx.strokeStyle = "rgba(255, 210, 96, 0.92)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.cooldown / 0.29));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShards() {
    for (const shard of state.shards) {
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.pulse * 0.8);
      const shimmer = 0.72 + Math.sin(shard.pulse) * 0.18;
      ctx.fillStyle = `rgba(133, 243, 183, ${shimmer})`;
      ctx.strokeStyle = "rgba(219, 255, 236, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAnomalies() {
    for (const anomaly of state.anomalies) {
      ctx.save();
      ctx.translate(anomaly.x, anomaly.y);
      ctx.rotate(anomaly.wobble * 0.4);

      ctx.fillStyle = "rgba(255, 110, 130, 0.88)";
      ctx.strokeStyle = "rgba(255, 222, 229, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7;
        const radius = i % 2 === 0 ? 18 : 10;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (const projectile of state.projectiles) {
      ctx.fillStyle = "rgba(255, 230, 150, 0.95)";
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud() {
    const resources = state.resources;
    const model = getModel();
    const difficulty = getDifficulty();

    ctx.fillStyle = "rgba(4, 18, 28, 0.62)";
    ctx.fillRect(22, 18, BASE_WIDTH - 44, 96);

    ctx.strokeStyle = "rgba(138, 210, 236, 0.46)";
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 18, BASE_WIDTH - 44, 96);

    ctx.fillStyle = "#ebfbff";
    ctx.font = "700 17px Space Grotesk";
    ctx.fillText(`Model: ${model.label}`, 42, 47);

    ctx.fillStyle = "#bfe9ff";
    ctx.font = "600 14px Space Grotesk";
    ctx.fillText(`Difficulty: ${difficulty.label}`, 42, 70);

    ctx.fillStyle = "#9ed3e6";
    ctx.font = "500 12px Space Grotesk";
    ctx.fillText(`Learn: ${model.microLesson}`, 42, 90);

    const chips = [
      `Data ${resources.data}`,
      `Compute ${Math.round(resources.compute)}`,
      `Alignment ${Math.round(resources.alignment)}`,
      `Training ${Math.round(resources.training)}%`,
      `Time ${Math.ceil(resources.timeLeft)}s`,
      `Score ${Math.round(resources.score)}`,
    ];

    let chipX = 350;
    for (const chip of chips) {
      const w = ctx.measureText(chip).width + 28;
      ctx.fillStyle = "rgba(76, 173, 212, 0.28)";
      ctx.fillRect(chipX, 33, w, 34);
      ctx.strokeStyle = "rgba(188, 237, 255, 0.4)";
      ctx.strokeRect(chipX, 33, w, 34);
      ctx.fillStyle = "#f0f9ff";
      ctx.font = "600 14px Space Grotesk";
      ctx.fillText(chip, chipX + 14, 55);
      chipX += w + 10;
    }

    if (state.ui.notice) {
      ctx.fillStyle = "rgba(255, 248, 204, 0.95)";
      ctx.fillRect(BASE_WIDTH / 2 - 250, BASE_HEIGHT - 72, 500, 44);
      ctx.strokeStyle = "rgba(91, 142, 165, 0.7)";
      ctx.strokeRect(BASE_WIDTH / 2 - 250, BASE_HEIGHT - 72, 500, 44);
      ctx.fillStyle = "#10394d";
      ctx.font = "600 16px Space Grotesk";
      ctx.textAlign = "center";
      ctx.fillText(state.ui.notice, BASE_WIDTH / 2, BASE_HEIGHT - 44);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "rgba(208, 240, 255, 0.82)";
    ctx.font = "500 13px Space Grotesk";
    ctx.fillText("Move: Arrows/WASD  Shoot: Space/Click  Interact: E/B  Pause: Esc/P  Fullscreen: F", 34, BASE_HEIGHT - 14);
  }

  function drawGameplay() {
    drawBackground();

    drawStation(state.stations.data, "#6bd6ff", "Synthesize data (E/B)", nearStation(state.stations.data, 34));
    drawStation(state.stations.cluster, "#8cffb0", "Run training cycle (E/B)", nearStation(state.stations.cluster, 36));
    drawStation(
      state.stations.gate,
      "#ffd17e",
      state.resources.training >= 100 ? "Deploy now (E/B)" : "Locked until training is complete",
      nearStation(state.stations.gate, 36)
    );

    ctx.strokeStyle = "rgba(190, 230, 246, 0.42)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(state.stations.data.x + 60, state.stations.data.y - 70);
    ctx.lineTo(state.stations.cluster.x - 90, state.stations.cluster.y - 76);
    ctx.lineTo(state.stations.gate.x - 72, state.stations.gate.y - 68);
    ctx.stroke();
    ctx.setLineDash([]);

    drawShards();
    drawProjectiles();
    drawAnomalies();
    drawPlayer();
    drawHud();
  }

  function drawButton(button, active) {
    const hovered = state.ui.hoverButtonId === button.id;
    const r = button.rect;

    ctx.fillStyle = active
      ? "rgba(113, 215, 255, 0.45)"
      : hovered
        ? "rgba(114, 230, 186, 0.33)"
        : "rgba(17, 54, 77, 0.72)";
    ctx.fillRect(r.x, r.y, r.w, r.h);

    ctx.strokeStyle = active
      ? "rgba(208, 249, 255, 0.95)"
      : hovered
        ? "rgba(177, 255, 225, 0.85)"
        : "rgba(117, 186, 217, 0.56)";
    ctx.lineWidth = active ? 3 : 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = "#edfbff";
    ctx.font = "700 22px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillText(button.label, r.x + r.w / 2, r.y + 37);
    ctx.textAlign = "left";
  }

  function drawMainMenu() {
    drawBackground();

    ctx.fillStyle = "rgba(6, 24, 40, 0.68)";
    ctx.fillRect(180, 88, 920, 548);
    ctx.strokeStyle = "rgba(164, 229, 255, 0.56)";
    ctx.lineWidth = 2;
    ctx.strokeRect(180, 88, 920, 548);

    ctx.fillStyle = "#d2f7ff";
    ctx.font = "800 66px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Agent Forge", BASE_WIDTH / 2, 194);

    ctx.fillStyle = "#95d9f3";
    ctx.font = "600 25px Space Grotesk";
    ctx.fillText("Model Training Operations", BASE_WIDTH / 2, 236);

    ctx.fillStyle = "#caebf8";
    ctx.font = "500 18px Space Grotesk";
    ctx.fillText(
      "Design your AI stack, collect data, train a model, defend against drift, and deploy before time runs out.",
      BASE_WIDTH / 2,
      276
    );

    ctx.fillStyle = "#9cd5ea";
    ctx.font = "500 15px Space Grotesk";
    ctx.fillText("Learn real model families while you play: Llama, Qwen, and Mistral.", BASE_WIDTH / 2, 302);

    const model = getModel();
    const difficulty = getDifficulty();
    const squad = getSquadSize();
    ctx.fillStyle = "rgba(80, 168, 204, 0.31)";
    ctx.fillRect(250, 536, 780, 84);
    ctx.strokeStyle = "rgba(156, 221, 246, 0.4)";
    ctx.strokeRect(250, 536, 780, 84);
    ctx.fillStyle = "#e4f9ff";
    ctx.font = "600 16px Space Grotesk";
    ctx.fillText(
      `Current Build: ${model.label} | ${difficulty.label} | Squad ${squad}`,
      BASE_WIDTH / 2,
      564
    );

    ctx.fillStyle = "#bde7f7";
    ctx.font = "500 14px Space Grotesk";
    ctx.fillText(`Model Spotlight: ${model.lesson}`, BASE_WIDTH / 2, 590);

    const buttons = getMainMenuButtons();
    state.ui.activeButtons = buttons;
    for (let i = 0; i < buttons.length; i++) {
      drawButton(buttons[i], state.ui.mainMenuIndex === i);
    }

    ctx.fillStyle = "rgba(188, 228, 246, 0.85)";
    ctx.font = "500 14px Space Grotesk";
    ctx.fillText("Use Arrow keys + Enter or click. Press F for fullscreen.", BASE_WIDTH / 2, 628);
    ctx.textAlign = "left";
  }

  function drawSettings() {
    drawBackground();

    ctx.fillStyle = "rgba(8, 26, 38, 0.76)";
    ctx.fillRect(160, 72, 960, 578);
    ctx.strokeStyle = "rgba(166, 231, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(160, 72, 960, 578);

    ctx.fillStyle = "#daf9ff";
    ctx.font = "800 54px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Simulation Settings", BASE_WIDTH / 2, 150);

    ctx.fillStyle = "#a0dff8";
    ctx.font = "500 18px Space Grotesk";
    ctx.fillText("Tune real model families, challenge pressure, and operator count.", BASE_WIDTH / 2, 186);

    const rows = settingsRowRects();
    state.ui.activeButtons = rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const active = i === state.ui.settingsIndex;
      const hovered = state.ui.hoverButtonId === row.id;
      const rect = row.rect;

      ctx.fillStyle = active
        ? "rgba(112, 208, 255, 0.4)"
        : hovered
          ? "rgba(126, 236, 197, 0.33)"
          : "rgba(16, 56, 77, 0.68)";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

      ctx.strokeStyle = active
        ? "rgba(212, 250, 255, 0.95)"
        : hovered
          ? "rgba(182, 253, 229, 0.86)"
          : "rgba(121, 190, 220, 0.58)";
      ctx.lineWidth = active ? 3 : 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      ctx.fillStyle = "#e8fbff";
      ctx.font = "700 23px Space Grotesk";
      ctx.textAlign = "left";
      ctx.fillText(row.label, rect.x + 24, rect.y + 34);

      if (row.value) {
        ctx.fillStyle = "#bde7f7";
        ctx.font = "500 18px Space Grotesk";
        ctx.textAlign = "right";
        ctx.fillText(row.value, rect.x + rect.w - 24, rect.y + 52);
      }
    }

    ctx.fillStyle = "#d7f4ff";
    ctx.font = "500 15px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillText("Navigate with Up/Down. Change values with Left/Right or Enter. Esc/B to return.", BASE_WIDTH / 2, 620);
    ctx.textAlign = "left";
  }

  function drawBriefing() {
    drawBackground();

    ctx.fillStyle = "rgba(8, 26, 38, 0.78)";
    ctx.fillRect(154, 70, 972, 580);
    ctx.strokeStyle = "rgba(169, 232, 255, 0.54)";
    ctx.lineWidth = 2;
    ctx.strokeRect(154, 70, 972, 580);

    ctx.fillStyle = "#ddfbff";
    ctx.font = "800 52px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Mission Brief", BASE_WIDTH / 2, 152);

    const lines = [
      "You run Agent Forge, an AI operations lab under a strict launch window.",
      "",
      "Flow:",
      "1. Collect floating data shards in the arena.",
      "2. Visit the Data Lake station to synthesize extra data from compute.",
      "3. Train at the central cluster to raise model quality to 100%.",
      "4. Eliminate drift anomalies before they damage alignment.",
      "5. Reach the Deployment Gate and launch before the timer expires.",
      "",
      "Concept tie-in:",
      "- Data, compute, and alignment tradeoffs mirror real ML production pressure.",
      "- Model family changes training efficiency and mobility.",
      "- Difficulty controls drift frequency, impact, and available runway.",
      "",
      "Real model references:",
      "- Llama 3.1 8B (Meta): open weights and efficient adaptation.",
      "- Qwen2.5 14B (Alibaba): multilingual and coding strengths.",
      "- Mistral Small 24B (Mistral AI): higher capacity, higher compute cost.",
    ];

    ctx.fillStyle = "#c8e8f7";
    ctx.font = "500 16px Space Grotesk";
    ctx.textAlign = "left";
    let y = 212;
    for (const line of lines) {
      if (line === "") {
        y += 10;
        continue;
      }
      ctx.fillText(line, 214, y);
      y += 24;
    }

    const buttons = getBriefingButtons();
    state.ui.activeButtons = buttons;
    drawButton(buttons[0], true);
    ctx.textAlign = "left";
  }

  function drawPausedOverlay() {
    ctx.fillStyle = "rgba(5, 16, 24, 0.7)";
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    ctx.fillStyle = "rgba(10, 33, 48, 0.92)";
    ctx.fillRect(350, 184, 580, 384);
    ctx.strokeStyle = "rgba(176, 234, 255, 0.68)";
    ctx.lineWidth = 2;
    ctx.strokeRect(350, 184, 580, 384);

    ctx.fillStyle = "#e5fbff";
    ctx.font = "800 46px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Simulation Paused", BASE_WIDTH / 2, 258);

    ctx.fillStyle = "#bde4f3";
    ctx.font = "500 18px Space Grotesk";
    ctx.fillText("Review your plan and continue when ready.", BASE_WIDTH / 2, 296);

    const buttons = getPausedButtons();
    state.ui.activeButtons = buttons;
    for (let i = 0; i < buttons.length; i++) {
      drawButton(buttons[i], state.ui.pausedIndex === i);
    }

    ctx.textAlign = "left";
  }

  function drawResultOverlay() {
    const result = state.result || {
      victory: false,
      reason: "Run complete.",
      score: 0,
      training: 0,
      remainingTime: 0,
    };

    ctx.fillStyle = "rgba(6, 17, 27, 0.74)";
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    ctx.fillStyle = "rgba(10, 33, 48, 0.95)";
    ctx.fillRect(292, 128, 696, 470);
    ctx.strokeStyle = result.victory
      ? "rgba(174, 251, 205, 0.9)"
      : "rgba(255, 195, 196, 0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(292, 128, 696, 470);

    ctx.fillStyle = result.victory ? "#dbffe8" : "#ffe7e7";
    ctx.font = "800 56px Syne";
    ctx.textAlign = "center";
    ctx.fillText(result.victory ? "Deployment Success" : "Run Failed", BASE_WIDTH / 2, 206);

    ctx.fillStyle = "#d6eff9";
    ctx.font = "600 24px Space Grotesk";
    ctx.fillText(result.reason, BASE_WIDTH / 2, 250);

    ctx.fillStyle = "#bfe3f5";
    ctx.font = "500 21px Space Grotesk";
    ctx.fillText(`Score: ${Math.round(result.score)}`, BASE_WIDTH / 2, 304);
    ctx.fillText(`Training: ${Math.round(result.training)}%`, BASE_WIDTH / 2, 338);
    ctx.fillText(`Time Remaining: ${Math.ceil(result.remainingTime)}s`, BASE_WIDTH / 2, 372);

    const buttons = getResultButtons();
    state.ui.activeButtons = buttons;
    for (let i = 0; i < buttons.length; i++) {
      drawButton(buttons[i], state.ui.resultIndex === i);
    }

    ctx.textAlign = "left";
  }

  function render() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, state.world.viewportWidth, state.world.viewportHeight);
    ctx.save();
    ctx.scale(state.world.scaleX, state.world.scaleY);

    if (state.mode === "playing") {
      drawGameplay();
    } else if (state.mode === "main_menu") {
      drawMainMenu();
    } else if (state.mode === "settings") {
      drawSettings();
    } else if (state.mode === "briefing") {
      drawBriefing();
    } else if (state.mode === "paused") {
      drawGameplay();
      drawPausedOverlay();
    } else if (state.mode === "result") {
      drawGameplay();
      drawResultOverlay();
    }

    ctx.restore();
  }

  function clearTransientInput() {
    state.input.keyPressed.clear();
  }

  function runStep(dt) {
    update(dt);
    clearTransientInput();
  }

  function renderGameToText() {
    const resources = state.resources || {
      data: 0,
      compute: 0,
      alignment: 0,
      training: 0,
      score: 0,
      timeLeft: 0,
      deployed: false,
    };

    let objective = "Collect data, train at cluster, defend against anomalies";
    if (resources.training >= 100) {
      objective = "Move to Deployment Gate and press E/B";
    }
    if (state.mode === "result") {
      objective = state.result && state.result.victory
        ? "Run complete: deployment successful"
        : "Run complete: retry with better alignment/data strategy";
    }

    const payload = {
      coordinate_system: "origin=(0,0) top-left, +x right, +y down, world=1280x720",
      mode: state.mode,
      settings: {
        model: getModel().label,
        difficulty: getDifficulty().label,
        squad: getSquadSize(),
      },
      model_profile: {
        organization: getModel().org,
        parameter_scale: getModel().params,
        educational_note: getModel().lesson,
      },
      objective,
      player: state.player
        ? {
            x: Math.round(state.player.x),
            y: Math.round(state.player.y),
            vx: Math.round(state.player.vx),
            vy: Math.round(state.player.vy),
            facing: [
              Number(state.player.facingX.toFixed(2)),
              Number(state.player.facingY.toFixed(2)),
            ],
            cooldown: Number(state.player.cooldown.toFixed(2)),
          }
        : null,
      resources: {
        data: resources.data,
        compute: Math.round(resources.compute),
        alignment: Math.round(resources.alignment),
        training: Math.round(resources.training),
        score: Math.round(resources.score),
        time_left_seconds: Number(resources.timeLeft.toFixed(1)),
      },
      stations: {
        data_lake: { x: 220, y: 390 },
        training_cluster: { x: 640, y: 390 },
        deployment_gate: { x: 1060, y: 390 },
      },
      entities: {
        shards: state.shards.slice(0, 8).map((s) => ({ x: Math.round(s.x), y: Math.round(s.y) })),
        anomalies: state.anomalies.slice(0, 8).map((a) => ({ x: Math.round(a.x), y: Math.round(a.y) })),
        projectiles: state.projectiles.slice(0, 8).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      },
      menu: {
        selected_index:
          state.mode === "main_menu"
            ? state.ui.mainMenuIndex
            : state.mode === "settings"
              ? state.ui.settingsIndex
              : state.mode === "paused"
                ? state.ui.pausedIndex
                : state.mode === "result"
                  ? state.ui.resultIndex
                  : 0,
        hover_button: state.ui.hoverButtonId,
      },
      notice: state.ui.notice,
      fullscreen: Boolean(document.fullscreenElement),
    };

    return JSON.stringify(payload, null, 2);
  }

  async function advanceTime(ms) {
    state.manualAdvance = true;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) {
      runStep(1 / 60);
    }
    render();
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (shell.requestFullscreen) {
      await shell.requestFullscreen();
    }
  }

  function onKeyDown(event) {
    if (event.repeat) {
      return;
    }

    if (event.code === "KeyF") {
      event.preventDefault();
      toggleFullscreen();
      return;
    }

    if (event.code === "Escape" && document.fullscreenElement) {
      event.preventDefault();
      document.exitFullscreen();
      return;
    }

    state.input.keysDown.add(event.code);
    state.input.keyPressed.add(event.code);
  }

  function onKeyUp(event) {
    state.input.keysDown.delete(event.code);
  }

  function onPointerMove(event) {
    const p = toWorldPoint(event.clientX, event.clientY);
    state.input.pointerX = p.x;
    state.input.pointerY = p.y;
  }

  function onPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    const p = toWorldPoint(event.clientX, event.clientY);
    state.input.pointerX = p.x;
    state.input.pointerY = p.y;
    state.input.pointerClicked = true;
    state.input.pointerClickX = p.x;
    state.input.pointerClickY = p.y;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      state.input.keysDown.clear();
      state.input.keyPressed.clear();
    }
  }

  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("fullscreenchange", resizeCanvas);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("visibilitychange", onVisibilityChange);

  resizeCanvas();

  let lastTs = performance.now();
  function loop(ts) {
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
    lastTs = ts;
    if (!state.manualAdvance) {
      runStep(dt);
    }
    render();
    requestAnimationFrame(loop);
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = advanceTime;

  render();
  requestAnimationFrame(loop);
})();
