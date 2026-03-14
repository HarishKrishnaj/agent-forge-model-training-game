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
      accuracyBias: 2,
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
      accuracyBias: 3,
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
      accuracyBias: 4,
      dataCost: 3,
      computeCost: 22,
      playerSpeed: 178,
      projectileSpeed: 530,
    },
  ];

  const ACTIVATION_OPTIONS = [
    {
      id: "relu",
      label: "ReLU",
      lesson: "Fast and sparse. Best for clean classification-style feature stacks.",
    },
    {
      id: "gelu",
      label: "GELU",
      lesson: "Smooth transformer-friendly activations. Strong for language and coding tasks.",
    },
    {
      id: "silu",
      label: "SiLU",
      lesson: "Self-gated smooth behavior. Useful for routing-heavy agent systems.",
    },
    {
      id: "tanh",
      label: "Tanh",
      lesson: "Bounded positive and negative range. Safer for stable control or regression heads.",
    },
  ];

  const TASK_PROFILES = [
    {
      id: "sensor_classifier",
      label: "Sensor Drift Classifier",
      requirement: "The model needs sparse feature activation and fast tabular decisions.",
      clue: "Look for the activation that keeps only the useful positive signals alive.",
      recommendedActivation: "relu",
      scores: { relu: 22, gelu: 10, silu: 6, tanh: -6 },
    },
    {
      id: "coding_assistant",
      label: "Coding Copilot Fine-Tune",
      requirement: "The task needs smooth token transitions and transformer-friendly gradients.",
      clue: "Language and code generally prefer smooth activations over hard clipping.",
      recommendedActivation: "gelu",
      scores: { relu: 4, gelu: 22, silu: 12, tanh: -4 },
    },
    {
      id: "tool_router",
      label: "Agent Tool Router",
      requirement: "The policy needs self-gated behavior to route requests across tools efficiently.",
      clue: "A gated activation helps when the network must softly decide where traffic should go.",
      recommendedActivation: "silu",
      scores: { relu: 7, gelu: 12, silu: 22, tanh: -3 },
    },
    {
      id: "risk_regressor",
      label: "Risk Control Head",
      requirement: "Outputs must stay bounded above and below zero for stable scoring.",
      clue: "Choose the activation that naturally keeps values within a signed range.",
      recommendedActivation: "tanh",
      scores: { relu: -8, gelu: 6, silu: 4, tanh: 22 },
    },
  ];

  const STAGE_ORDER = ["collection", "training", "deployment"];
  const STAGE_LABELS = {
    collection: "Level 1: Data Collection",
    training: "Level 2: Training Configuration",
    deployment: "Level 3: Deployment Rollout",
  };

  const DIFFICULTY_OPTIONS = [
    {
      label: "Sandbox",
      spawnInterval: 3.4,
      anomalySpeed: 70,
      alignmentHit: 12,
      timeLimit: 230,
      collectionGoal: 12,
      dropInterval: 0.72,
      trainingThreatInterval: 2.35,
      deploymentThreatInterval: 1.95,
    },
    {
      label: "Standard",
      spawnInterval: 2.5,
      anomalySpeed: 88,
      alignmentHit: 18,
      timeLimit: 180,
      collectionGoal: 14,
      dropInterval: 0.62,
      trainingThreatInterval: 1.8,
      deploymentThreatInterval: 1.45,
    },
    {
      label: "Research Ops",
      spawnInterval: 1.8,
      anomalySpeed: 106,
      alignmentHit: 24,
      timeLimit: 145,
      collectionGoal: 20,
      dropInterval: 0.54,
      trainingThreatInterval: 1.3,
      deploymentThreatInterval: 1.08,
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
      soundEnabled: true,
    },
    run: null,
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
    effects: [],
    spawnTimer: 0,
    shardTimer: 0,
    result: null,
    timeElapsed: 0,
    audio: {
      context: null,
      unlocked: false,
    },
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

  function lerp(a, b, t) {
    return a + (b - a) * t;
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

  function pickTaskProfile() {
    return TASK_PROFILES[Math.floor(Math.random() * TASK_PROFILES.length)];
  }

  function getStageId() {
    return state.run ? state.run.stage : "collection";
  }

  function getStageLabel() {
    return STAGE_LABELS[getStageId()] || STAGE_LABELS.collection;
  }

  function getSelectedActivation() {
    if (!state.run || !state.run.selectedActivation) {
      return null;
    }
    return ACTIVATION_OPTIONS.find((option) => option.id === state.run.selectedActivation) || null;
  }

  function getStageNodes() {
    const stage = getStageId();
    if (stage === "collection") {
      return {
        source: { x: 640, y: 120, r: 66, name: "Source Stream" },
        relay: { x: 1080, y: 556, r: 72, name: "Collection Relay" },
      };
    }
    if (stage === "training") {
      return {
        upload: { x: 258, y: 548, r: 70, name: "Upload Port" },
        core: { x: 708, y: 364, r: 96, name: "Training Core" },
        console: { x: 1068, y: 358, r: 72, name: "Activation Rack" },
      };
    }
    return {
      console: { x: 252, y: 548, r: 70, name: "Rollout Console" },
      gate: { x: 1008, y: 378, r: 96, name: "Serve Gateway" },
    };
  }

  function getActivationButtons() {
    const x = 948;
    const y = 224;
    const w = 264;
    const h = 64;
    const gap = 16;
    return ACTIVATION_OPTIONS.map((option, idx) => ({
      ...option,
      label: `${idx + 1}. ${option.label}`,
      rect: { x, y: y + idx * (h + gap), w, h },
      id: `activation_${option.id}`,
    }));
  }

  function getCollectionGoal() {
    if (state.run && state.run.collectionGoal) {
      return state.run.collectionGoal;
    }
    return getDifficulty().collectionGoal;
  }

  function getTrainingBatchSize() {
    return 4 + getSquadSize();
  }

  function getActivationScore() {
    const run = state.run;
    if (!run || !run.trainingTask) {
      return 0;
    }
    if (!run.selectedActivation) {
      return -14;
    }
    return run.trainingTask.scores[run.selectedActivation] ?? -10;
  }

  function computeProjectedAccuracy() {
    if (!state.run) {
      return 0;
    }
    const run = state.run;
    const resources = state.resources;
    const model = getModel();
    const base = 12;
    const dataScore = Math.min(28, (run.trainingDataBudget || 0) * 0.9);
    const defenseScore = clamp((resources.alignment - 35) * 0.25, 0, 16);
    const modelScore = model.accuracyBias * 4;
    const difficultyPenalty = state.settings.difficultyIndex * 4;
    const threatPenalty = (run.trainingHits || 0) * 3;
    return clamp(
      base + dataScore + defenseScore + modelScore + getActivationScore() - difficultyPenalty - threatPenalty,
      8,
      96
    );
  }

  function getObjectiveText() {
    const resources = state.resources;
    const run = state.run;
    if (!resources || !run) {
      return "Collect clean data, configure training, and defend deployment.";
    }

    if (state.mode === "result") {
      return state.result && state.result.victory
        ? "Run complete: deployment successful"
        : "Run complete: iterate on data quality, activation choice, and defense.";
    }

    if (run.stage === "collection") {
      return `Catch at least ${run.collectionGoal} clean packets, then relay them to training.`;
    }
    if (run.stage === "training") {
      if (!run.selectedActivation) {
        return "Read the task card, choose an activation function, and upload the dataset.";
      }
      return `Upload remaining packets into the core. Current activation: ${getSelectedActivation().label}.`;
    }
    if (!run.deploymentActive) {
      return resources.accuracy < 50
        ? `Accuracy ${Math.round(resources.accuracy)}% is below the 50% launch threshold.`
        : "Start rollout at the serve gateway and defend against deployment attacks.";
    }
    return `Hold the gateway until rollout reaches 100%.`;
  }

  function getLearningPrompt() {
    const resources = state.resources;
    const run = state.run;
    if (!resources || !run) {
      return "Three levels teach how clean data, activation choices, and deployment defense shape model quality.";
    }
    if (state.mode === "result" && state.result && state.result.lesson) {
      return state.result.lesson;
    }
    if (run.stage === "collection") {
      return "Level 1: clean packets fall from the source. Scrambler attacks corrupt samples before they become training data.";
    }
    if (run.stage === "training") {
      if (!run.selectedActivation) {
        return `Task card: ${run.trainingTask.requirement} Choose the activation that best matches that requirement.`;
      }
      const selected = getSelectedActivation();
      const isBest = selected && selected.id === run.trainingTask.recommendedActivation;
      return isBest
        ? `${selected.label} matches the task well. Uploading now should maximize accuracy if you protect the core.`
        : `${selected.label} is risky for this task. You can still upload, but final accuracy will likely suffer.`;
    }
    if (!run.deploymentActive) {
      return resources.accuracy < 50
        ? "The model is underfit. Even a defended rollout will fail below 50% accuracy."
        : "Deployment converts training quality into production value. Protect the serve gateway from injection waves.";
    }
    return "Prompt-injection and latency spikes can ruin deployment even after good training. Hold the line until rollout finishes.";
  }

  function ensureAudioContext() {
    if (!state.settings.soundEnabled) {
      return null;
    }
    if (!state.audio.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        state.audio.unlocked = true;
        return null;
      }
      state.audio.context = new AudioCtor();
    }
    return state.audio.context;
  }

  function unlockAudio() {
    const audio = ensureAudioContext();
    if (!audio) {
      return;
    }
    if (audio.state === "suspended") {
      audio.resume().catch(() => {});
    }
    state.audio.unlocked = true;
  }

  function playSound(name) {
    if (!state.settings.soundEnabled) {
      return;
    }

    const audio = ensureAudioContext();
    if (!audio || !state.audio.unlocked) {
      return;
    }

    const now = audio.currentTime + 0.01;
    const master = audio.createGain();
    master.gain.value = 0.05;
    master.connect(audio.destination);

    const sequence = [];
    if (name === "shoot") {
      sequence.push([690, 0.04, "square"], [420, 0.06, "triangle"]);
    } else if (name === "pickup") {
      sequence.push([620, 0.05, "triangle"], [840, 0.08, "sine"]);
    } else if (name === "train") {
      sequence.push([320, 0.08, "triangle"], [440, 0.08, "triangle"], [560, 0.1, "sine"]);
    } else if (name === "hit") {
      sequence.push([240, 0.05, "sawtooth"], [180, 0.08, "square"]);
    } else if (name === "damage") {
      sequence.push([180, 0.1, "sawtooth"], [130, 0.12, "triangle"]);
    } else if (name === "fail") {
      sequence.push([220, 0.11, "sawtooth"], [170, 0.11, "sawtooth"], [110, 0.15, "triangle"]);
    } else if (name === "deploy") {
      sequence.push([420, 0.08, "triangle"], [620, 0.08, "triangle"], [920, 0.16, "sine"]);
    } else if (name === "warning") {
      sequence.push([520, 0.06, "square"], [520, 0.06, "square"]);
    } else {
      sequence.push([480, 0.08, "sine"]);
    }

    let cursor = now;
    for (const [freq, duration, type] of sequence) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, cursor);
      gain.gain.setValueAtTime(0.0001, cursor);
      gain.gain.exponentialRampToValueAtTime(0.4, cursor + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(cursor);
      osc.stop(cursor + duration + 0.02);
      cursor += duration * 0.8;
    }

    master.gain.setValueAtTime(0.06, now);
    master.gain.exponentialRampToValueAtTime(0.0001, cursor + 0.1);
  }

  function emitParticles(x, y, color, count, speedMin, speedMax, life, size) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(speedMin, speedMax);
      state.effects.push({
        kind: "particle",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: rand(size * 0.6, size * 1.3),
        color,
      });
    }
  }

  function emitRing(x, y, color, startRadius, endRadius, life) {
    state.effects.push({
      kind: "ring",
      x,
      y,
      startRadius,
      endRadius,
      radius: startRadius,
      life,
      maxLife: life,
      color,
    });
  }

  function updateEffects(dt) {
    for (let i = state.effects.length - 1; i >= 0; i--) {
      const effect = state.effects[i];
      effect.life -= dt;
      if (effect.life <= 0) {
        state.effects.splice(i, 1);
        continue;
      }
      if (effect.kind === "particle") {
        effect.x += effect.vx * dt;
        effect.y += effect.vy * dt;
        effect.vx *= 0.98;
        effect.vy *= 0.98;
      } else if (effect.kind === "ring") {
        const progress = 1 - effect.life / effect.maxLife;
        effect.radius = lerp(effect.startRadius, effect.endRadius, progress);
      }
    }
  }

  function roundedRectPath(x, y, w, h, r) {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawPanel(x, y, w, h, fillStyle, strokeStyle, radius = 20, lineWidth = 2) {
    ctx.save();
    roundedRectPath(x, y, w, h, radius);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWrappedText(text, x, y, maxWidth, lineHeight, align = "left") {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) {
      lines.push(current);
    }

    ctx.textAlign = align;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
    return lines.length;
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

  function createPlayer(x = 120, y = 390) {
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      r: 17,
      facingX: 1,
      facingY: 0,
      cooldown: 0,
    };
  }

  function selectActivation(id, silent = false) {
    if (!state.run || state.run.stage !== "training") {
      return;
    }
    state.run.selectedActivation = id;
    if (!silent) {
      const option = getSelectedActivation();
      playSound("pickup");
      setNotice(`${option.label} selected. ${option.lesson}`, 2.2);
    }
  }

  function beginStage(stage) {
    const difficulty = getDifficulty();
    const run = state.run;
    run.stage = stage;

    state.shards = [];
    state.anomalies = [];
    state.projectiles = [];
    state.effects = [];
    state.spawnTimer = difficulty.spawnInterval;
    state.shardTimer = difficulty.dropInterval;

    if (stage === "collection") {
      state.player = createPlayer(640, 588);
      run.collectionCaptured = 0;
      run.collectionCorrupted = 0;
      run.collectionGoal = difficulty.collectionGoal;
      setNotice(`Level 1: catch ${run.collectionGoal}+ clean packets, then move to the relay.`, 2.6);
      return;
    }

    if (stage === "training") {
      state.player = createPlayer(312, 560);
      run.trainingDataBudget = Math.max(run.collectionGoal, state.resources.data);
      run.uploadedPackets = 0;
      run.trainingHits = 0;
      state.resources.training = 0;
      state.resources.accuracy = 0;
      state.spawnTimer = difficulty.trainingThreatInterval;
      state.shardTimer = 99;
      setNotice(
        `Level 2: choose an activation for ${run.trainingTask.label}, then upload ${run.trainingDataBudget} packets.`,
        2.8
      );
      return;
    }

    state.player = createPlayer(920, 380);
    run.deploymentActive = false;
    run.deployHits = 0;
    run.deployProgress = 0;
    state.spawnTimer = difficulty.deploymentThreatInterval;
    state.shardTimer = 99;
    setNotice("Level 3: start rollout at the gateway and defend deployment traffic.", 2.6);
  }

  function resetRun() {
    const difficulty = getDifficulty();
    state.resources = {
      data: 0,
      compute: 72,
      alignment: 100,
      training: 0,
      accuracy: 0,
      score: 0,
      timeLeft: difficulty.timeLimit,
      deployed: false,
      stageIndex: 0,
    };
    state.timeElapsed = 0;
    state.result = null;
    state.run = {
      stage: "collection",
      collectionGoal: difficulty.collectionGoal,
      collectionCaptured: 0,
      collectionCorrupted: 0,
      trainingTask: pickTaskProfile(),
      selectedActivation: null,
      trainingDataBudget: 0,
      uploadedPackets: 0,
      trainingHits: 0,
      deployProgress: 0,
      deploymentActive: false,
      deployHits: 0,
    };
    beginStage("collection");
  }

  function startRun() {
    resetRun();
    state.mode = "playing";
  }

  function spawnShard() {
    const stage = getStageId();
    if (stage !== "collection") {
      return;
    }
    const nodes = getStageNodes();
    state.shards.push({
      type: "drop",
      x: clamp(state.player.x + rand(-42, 42), nodes.source.x - 170, nodes.source.x + 170),
      y: nodes.source.y + 24,
      vx: rand(-22, 22),
      vy: rand(118, 156),
      r: 12,
      pulse: rand(0, Math.PI * 2),
      tilt: rand(-0.3, 0.3),
      clean: true,
    });
  }

  function spawnAnomaly() {
    const difficulty = getDifficulty();
    const stage = getStageId();
    if (stage === "collection") {
      const fromLeft = Math.random() < 0.5;
      state.anomalies.push({
        type: "scrambler",
        x: fromLeft ? 92 : BASE_WIDTH - 92,
        y: rand(180, 470),
        r: 17,
        hp: 1,
        speed: difficulty.anomalySpeed * rand(0.88, 1.12),
        wobble: rand(0, Math.PI * 2),
        hue: rand(0, 1),
      });
      return;
    }
    if (stage === "training") {
      state.anomalies.push({
        type: "gradient_spike",
        x: rand(220, BASE_WIDTH - 140),
        y: 112,
        r: 18,
        hp: 1,
        speed: difficulty.anomalySpeed * rand(0.9, 1.16),
        wobble: rand(0, Math.PI * 2),
        hue: rand(0, 1),
      });
      return;
    }
    state.anomalies.push({
      type: "injection_wave",
      x: rand(160, 420),
      y: rand(140, BASE_HEIGHT - 120),
      r: 18,
      hp: 1,
      speed: difficulty.anomalySpeed * rand(0.95, 1.2),
      wobble: rand(0, Math.PI * 2),
      hue: rand(0, 1),
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
      trail: [],
      spin: rand(-1, 1),
    });

    player.facingX = nx;
    player.facingY = ny;
    player.cooldown = Math.max(0.09, 0.29 - squad * 0.035);
    emitParticles(player.x + nx * 18, player.y + ny * 18, "255,220,120", 5, 40, 120, 0.26, 4);
    playSound("shoot");
  }

  function nearStation(station, range = 26) {
    return dist(state.player, station) <= station.r + range;
  }

  function executeInteraction() {
    const run = state.run;
    const resources = state.resources;
    const nodes = getStageNodes();

    if (run.stage === "collection") {
      if (nearStation(nodes.relay, 34)) {
        if (resources.data >= run.collectionGoal) {
          resources.score += 25;
          emitRing(nodes.relay.x, nodes.relay.y, "107,214,255", 26, 110, 0.5);
          emitParticles(nodes.relay.x, nodes.relay.y, "107,214,255", 18, 40, 180, 0.55, 5);
          playSound("train");
          resources.stageIndex = 1;
          beginStage("training");
        } else {
          playSound("warning");
          setNotice(`Need ${run.collectionGoal - resources.data} more clean packets before relay upload.`, 1.8);
        }
        return;
      }
      playSound("warning");
      setNotice("Catch packets from the source stream and move to the relay when the dataset is large enough.", 1.8);
      return;
    }

    if (run.stage === "training") {
      if (nearStation(nodes.console, 34)) {
        const currentIndex = Math.max(
          0,
          ACTIVATION_OPTIONS.findIndex((option) => option.id === run.selectedActivation)
        );
        const next = ACTIVATION_OPTIONS[(currentIndex + 1) % ACTIVATION_OPTIONS.length];
        selectActivation(next.id);
        return;
      }

      if (nearStation(nodes.upload, 40)) {
        if (!run.selectedActivation) {
          playSound("warning");
          setNotice("Choose an activation function before uploading the dataset.", 1.8);
          return;
        }
        if (resources.data <= 0) {
          playSound("warning");
          setNotice("No buffered packets remain. Protect the core until the module finalizes.", 1.6);
          return;
        }
        const uploadCost = Math.max(8, getModel().computeCost - 6);
        if (resources.compute < uploadCost) {
          playSound("warning");
          setNotice(`Need ${uploadCost} compute to upload the next training batch.`, 1.6);
          return;
        }

        const batch = Math.min(getTrainingBatchSize(), resources.data);
        resources.data -= batch;
        resources.compute = clamp(resources.compute - uploadCost, 0, 100);
        run.uploadedPackets += batch;
        resources.training = clamp((run.uploadedPackets / Math.max(1, run.trainingDataBudget)) * 100, 0, 100);
        const projectedAccuracy = computeProjectedAccuracy();
        resources.accuracy = Math.round(projectedAccuracy * (resources.training / 100));
        resources.score += 10 + batch;

        emitRing(nodes.core.x, nodes.core.y, "140,255,176", 24, 118, 0.48);
        emitParticles(nodes.core.x, nodes.core.y, "160,255,210", 18, 44, 180, 0.55, 5);
        playSound("train");

        if (resources.training >= 100) {
          resources.accuracy = Math.round(projectedAccuracy);
          resources.stageIndex = 2;
          beginStage("deployment");
        } else {
          setNotice(
            `Uploaded ${batch} packets. Progress ${Math.round(resources.training)}%. Projected accuracy ${Math.round(projectedAccuracy)}%.`,
            2.2
          );
        }
        return;
      }

      playSound("warning");
      setNotice("Move to the upload port to feed the core, or use the activation rack to change functions.", 1.8);
      return;
    }

    if (nearStation(nodes.gate, 36)) {
      if (!run.deploymentActive) {
        run.deploymentActive = true;
        emitRing(nodes.gate.x, nodes.gate.y, "170,255,205", 30, 140, 0.5);
        playSound("deploy");
        setNotice("Rollout started. Hold the gateway until deployment reaches 100%.", 1.8);
        return;
      }
      setNotice("Rollout already active. Keep defending the serve gateway until the bar completes.", 1.4);
      return;
    }

    playSound("warning");
    setNotice("No interface node in range. Reposition and try again.", 1.2);
  }

  function finishRun(victory, reason, lesson) {
    state.mode = "result";
    state.ui.notice = "";
    state.ui.noticeTimer = 0;
    state.result = {
      victory,
      reason,
      score: state.resources.score,
      training: state.resources.training,
      accuracy: state.resources.accuracy,
      remainingTime: Math.max(0, state.resources.timeLeft),
      lesson,
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

  function getResultButtons(startY = 426) {
    const x = BASE_WIDTH / 2 - 170;
    const y = startY;
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
      return;
    }
    if (name === "sound") {
      state.settings.soundEnabled = !state.settings.soundEnabled;
      if (state.settings.soundEnabled) {
        unlockAudio();
        playSound("pickup");
      }
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
        id: "sound",
        label: "Soundscape",
        value: state.settings.soundEnabled ? "Enabled" : "Muted",
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
    const y = 220;
    const h = 66;
    const gap = 12;
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

  function handleTrainingActivationHotkeys() {
    if (!state.run || state.run.stage !== "training") {
      return;
    }
    const bindings = ["Digit1", "Digit2", "Digit3", "Digit4"];
    for (let i = 0; i < bindings.length; i++) {
      if (consumePress(bindings[i])) {
        selectActivation(ACTIVATION_OPTIONS[i].id);
        return;
      }
    }
  }

  function handleTrainingActivationClick(click) {
    if (!click || !state.run || state.run.stage !== "training") {
      return false;
    }
    const buttons = getActivationButtons();
    state.ui.activeButtons = buttons;
    resolveHover(buttons);
    for (const button of buttons) {
      if (isPointInRect(click, button.rect)) {
        selectActivation(button.id.replace("activation_", ""));
        return true;
      }
    }
    return false;
  }

  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      projectile.trail.unshift({ x: projectile.x, y: projectile.y });
      projectile.trail = projectile.trail.slice(0, 7);
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
  }

  function resolveProjectileHits() {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      let hit = false;
      for (let j = state.anomalies.length - 1; j >= 0; j--) {
        const anomaly = state.anomalies[j];
        if (dist(projectile, anomaly) <= projectile.r + anomaly.r + 1) {
          state.resources.score += 12;
          state.resources.compute = clamp(state.resources.compute + 3.5, 0, 100);
          emitParticles(anomaly.x, anomaly.y, "255,200,120", 16, 40, 180, 0.45, 4);
          emitRing(anomaly.x, anomaly.y, "255,200,120", 12, 72, 0.3);
          playSound("hit");
          state.anomalies.splice(j, 1);
          hit = true;
          break;
        }
      }
      if (hit) {
        state.projectiles.splice(i, 1);
      }
    }
  }

  function updateCollectionStage(dt, difficulty) {
    const run = state.run;
    const resources = state.resources;
    const player = state.player;
    const nodes = getStageNodes();

    state.shardTimer -= dt;
    if (state.shardTimer <= 0) {
      spawnShard();
      state.shardTimer = difficulty.dropInterval * rand(0.85, 1.18);
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnAnomaly();
      state.spawnTimer = difficulty.spawnInterval * rand(0.72, 1.02);
    }

    for (let i = state.shards.length - 1; i >= 0; i--) {
      const shard = state.shards[i];
      shard.pulse += dt * 3.6;
      const magnetDx = player.x - shard.x;
      const magnetDy = player.y - shard.y;
      const magnetDistance = length(magnetDx, magnetDy) || 1;
      if (magnetDistance < 110) {
        shard.vx += (magnetDx / magnetDistance) * 150 * dt;
        shard.vy += (magnetDy / magnetDistance) * 180 * dt;
      }
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.vx *= 0.998;
      if (dist(player, shard) <= player.r + shard.r + 4) {
        resources.data += 1;
        run.collectionCaptured += 1;
        resources.score += 6;
        emitParticles(shard.x, shard.y, "133,243,183", 12, 40, 160, 0.42, 5);
        emitRing(shard.x, shard.y, "133,243,183", 10, 60, 0.35);
        playSound("pickup");
        state.shards.splice(i, 1);
        continue;
      }
      if (shard.y > BASE_HEIGHT - 72) {
        run.collectionCorrupted += 1;
        state.shards.splice(i, 1);
      }
    }

    for (let i = state.anomalies.length - 1; i >= 0; i--) {
      const anomaly = state.anomalies[i];
      anomaly.wobble += dt * 5.6;

      let target = nodes.relay;
      let bestDistance = Infinity;
      for (const shard of state.shards) {
        const d = dist(anomaly, shard);
        if (d < bestDistance) {
          bestDistance = d;
          target = shard;
        }
      }

      const dx = target.x - anomaly.x;
      const dy = target.y - anomaly.y;
      const d = length(dx, dy) || 1;
      anomaly.x += (dx / d) * anomaly.speed * dt;
      anomaly.y += (dy / d) * anomaly.speed * dt;

      for (let j = state.shards.length - 1; j >= 0; j--) {
        const shard = state.shards[j];
        if (dist(anomaly, shard) <= anomaly.r + shard.r + 2) {
          run.collectionCorrupted += 1;
          resources.alignment = clamp(resources.alignment - difficulty.alignmentHit * 0.25, 0, 100);
          emitParticles(shard.x, shard.y, "255,120,140", 14, 36, 150, 0.5, 4);
          emitRing(shard.x, shard.y, "255,120,140", 12, 64, 0.3);
          playSound("damage");
          state.shards.splice(j, 1);
          state.anomalies.splice(i, 1);
          setNotice("A scrambler corrupted a falling packet.", 1.2);
          break;
        }
      }
      if (!state.anomalies[i]) {
        continue;
      }

      if (dist(player, anomaly) <= player.r + anomaly.r + 2) {
        resources.alignment = clamp(resources.alignment - difficulty.alignmentHit * 0.35, 0, 100);
        emitParticles(player.x, player.y, "255,140,155", 14, 40, 130, 0.4, 4);
        playSound("damage");
        state.anomalies.splice(i, 1);
        setNotice("A scrambler reached the guardian. Integrity reduced.", 1.2);
      }
    }

    if (resources.data >= run.collectionGoal && nearStation(nodes.relay, 54)) {
      setNotice("Dataset is large enough. Press E or B at the relay to enter training.", 1.1);
    }
  }

  function updateTrainingStage(dt, difficulty) {
    const run = state.run;
    const resources = state.resources;
    const player = state.player;
    const nodes = getStageNodes();

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnAnomaly();
      state.spawnTimer = difficulty.trainingThreatInterval * rand(0.8, 1.08);
    }

    for (let i = state.anomalies.length - 1; i >= 0; i--) {
      const anomaly = state.anomalies[i];
      anomaly.wobble += dt * 6.4;
      const dx = nodes.core.x - anomaly.x;
      const dy = nodes.core.y - anomaly.y;
      const d = length(dx, dy) || 1;
      anomaly.x += (dx / d) * anomaly.speed * dt;
      anomaly.y += (dy / d) * anomaly.speed * dt;

      if (d <= nodes.core.r * 0.72) {
        run.trainingHits += 1;
        resources.alignment = clamp(resources.alignment - difficulty.alignmentHit * 0.6, 0, 100);
        const progressRatio = resources.training / 100;
        resources.accuracy = Math.round(computeProjectedAccuracy() * progressRatio);
        emitParticles(anomaly.x, anomaly.y, "255,120,140", 18, 40, 160, 0.55, 5);
        emitRing(nodes.core.x, nodes.core.y, "255,120,140", 18, 124, 0.45);
        playSound("damage");
        state.anomalies.splice(i, 1);
        setNotice("Gradient spike hit the core. Accuracy projection dropped.", 1.4);
        continue;
      }

      if (dist(player, anomaly) <= player.r + anomaly.r + 2) {
        resources.alignment = clamp(resources.alignment - difficulty.alignmentHit * 0.35, 0, 100);
        emitParticles(player.x, player.y, "255,140,155", 14, 40, 130, 0.4, 4);
        playSound("damage");
        state.anomalies.splice(i, 1);
        setNotice("Gradient spike clipped the guardian. Integrity reduced.", 1.2);
      }
    }

    if (run.selectedActivation && resources.training < 100 && nearStation(nodes.upload, 54)) {
      setNotice("Press E or B at the upload port to feed the training batches.", 0.9);
    }
  }

  function updateDeploymentStage(dt, difficulty) {
    const run = state.run;
    const resources = state.resources;
    const player = state.player;
    const nodes = getStageNodes();

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnAnomaly();
      state.spawnTimer = difficulty.deploymentThreatInterval * rand(0.8, 1.06);
    }

    if (run.deploymentActive) {
      const rolloutRate = resources.accuracy >= 50 ? 23 : 16;
      run.deployProgress = clamp(run.deployProgress + rolloutRate * dt, 0, 100);
      if (run.deployProgress >= 100) {
        resources.deployed = true;
        const selected = getSelectedActivation();
        const recommended = ACTIVATION_OPTIONS.find(
          (option) => option.id === run.trainingTask.recommendedActivation
        );
        if (resources.accuracy < 50) {
          finishRun(
            false,
            `Deployment failed: accuracy ${Math.round(resources.accuracy)}% is below 50%.`,
            selected
              ? `${run.trainingTask.label} wanted ${recommended.label}, but ${selected.label} was chosen. The rollout defended well, but the training config was still wrong.`
              : `No activation was set for ${run.trainingTask.label}, so the model never reached deployment quality.`
          );
        } else {
          finishRun(
            true,
            `Agent deployed with ${Math.round(resources.accuracy)}% accuracy.`,
            selected && selected.id === recommended.id
              ? `The ${selected.label} choice matched the task well enough to survive rollout pressure and ship the model.`
              : `${selected ? selected.label : "Your activation"} was not ideal for ${run.trainingTask.label}, but strong data quality and rollout defense still carried the model over the deployment threshold.`
          );
        }
        return;
      }
    }

    for (let i = state.anomalies.length - 1; i >= 0; i--) {
      const anomaly = state.anomalies[i];
      anomaly.wobble += dt * 6.8;
      const dx = nodes.gate.x - anomaly.x;
      const dy = nodes.gate.y - anomaly.y;
      const d = length(dx, dy) || 1;
      anomaly.x += (dx / d) * anomaly.speed * dt;
      anomaly.y += (dy / d) * anomaly.speed * dt;

      if (d <= nodes.gate.r * 0.76) {
        run.deployHits += 1;
        run.deployProgress = clamp(run.deployProgress - 12, 0, 100);
        resources.alignment = clamp(resources.alignment - difficulty.alignmentHit * 0.7, 0, 100);
        emitParticles(anomaly.x, anomaly.y, "255,120,140", 18, 40, 160, 0.55, 5);
        emitRing(nodes.gate.x, nodes.gate.y, "255,120,140", 18, 128, 0.45);
        playSound("damage");
        state.anomalies.splice(i, 1);
        setNotice("Injection wave hit the serve gateway. Rollout lost progress.", 1.4);
        continue;
      }

      if (dist(player, anomaly) <= player.r + anomaly.r + 2) {
        resources.alignment = clamp(resources.alignment - difficulty.alignmentHit * 0.35, 0, 100);
        emitParticles(player.x, player.y, "255,140,155", 14, 40, 130, 0.4, 4);
        playSound("damage");
        state.anomalies.splice(i, 1);
        setNotice("An injection wave reached the guardian. Integrity reduced.", 1.2);
      }
    }

    if (!run.deploymentActive && nearStation(nodes.gate, 54)) {
      setNotice("Press E or B at the gateway to start the deployment rollout.", 0.95);
    }
  }

  function updatePlaying(dt) {
    const difficulty = getDifficulty();
    const model = getModel();
    const squad = getSquadSize();
    const resources = state.resources;
    const player = state.player;

    state.timeElapsed += dt;
    updateEffects(dt);

    if (state.run.stage === "training") {
      const buttons = getActivationButtons();
      state.ui.activeButtons = buttons;
      resolveHover(buttons);
      handleTrainingActivationHotkeys();
    }

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

    resources.compute = clamp(resources.compute + (5.2 + squad * 0.9) * dt, 0, 100);
    resources.timeLeft = Math.max(0, resources.timeLeft - dt);
    player.cooldown = Math.max(0, player.cooldown - dt);

    if (consumePress("Space")) {
      emitProjectile(player.x + player.facingX * 10, player.y + player.facingY * 10);
    }

    const click = consumePointerClick();
    if (click && !handleTrainingActivationClick(click)) {
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

    updateProjectiles(dt);
    resolveProjectileHits();

    if (state.run.stage === "collection") {
      updateCollectionStage(dt, difficulty);
    } else if (state.run.stage === "training") {
      updateTrainingStage(dt, difficulty);
    } else {
      updateDeploymentStage(dt, difficulty);
      if (state.mode !== "playing") {
        return;
      }
    }

    if (resources.timeLeft <= 0) {
      finishRun(
        false,
        "Funding window closed before the three-level pipeline finished.",
        "Data quality, training configuration, and rollout defense all consume time. Real ML programs fail when runway disappears."
      );
      return;
    }

    if (resources.alignment <= 0) {
      finishRun(
        false,
        "System integrity collapsed under repeated attacks.",
        "Each level had a different failure mode. Clean data, stable training, and defended deployment all matter."
      );
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
    grad.addColorStop(0, "#061b2f");
    grad.addColorStop(0.42, "#0e3958");
    grad.addColorStop(1, "#11293c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    const haze = [
      { x: 176, y: 118, r: 132, c: "rgba(94, 182, 255, 0.18)" },
      { x: 460, y: 92, r: 110, c: "rgba(140, 242, 189, 0.16)" },
      { x: 1034, y: 118, r: 138, c: "rgba(255, 188, 126, 0.12)" },
      { x: 1126, y: 596, r: 172, c: "rgba(116, 174, 255, 0.13)" },
    ];
    for (const orb of haze) {
      ctx.fillStyle = orb.c;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 25; i++) {
      const y = 88 + i * 24;
      const pulse = Math.sin(state.timeElapsed * 0.65 + i * 0.45) * 0.08 + 0.13;
      ctx.strokeStyle = `rgba(140, 220, 255, ${pulse})`;
      ctx.lineWidth = i % 4 === 0 ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(BASE_WIDTH, y);
      ctx.stroke();
    }

    for (let i = 0; i < 8; i++) {
      const x = 80 + i * 160;
      ctx.strokeStyle = `rgba(104, 198, 255, ${0.04 + (i % 2) * 0.03})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 70);
      ctx.lineTo(x, BASE_HEIGHT - 40);
      ctx.stroke();
    }

    for (let i = 0; i < 4; i++) {
      const baseY = 150 + i * 116;
      ctx.strokeStyle = `rgba(159, 221, 246, ${0.08 + i * 0.02})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= BASE_WIDTH; x += 24) {
        const y = baseY + Math.sin(state.timeElapsed * 0.8 + x * 0.012 + i) * (8 + i * 3);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  function drawStation(station, color, subtitle, emphasized = false) {
    ctx.save();
    ctx.translate(station.x, station.y);

    ctx.fillStyle = `${color}12`;
    ctx.beginPath();
    ctx.arc(0, 0, station.r + 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${color}cc`;
    ctx.lineWidth = emphasized ? 5 : 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, station.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `${color}30`;
    ctx.beginPath();
    ctx.arc(0, 0, station.r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${color}55`;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, station.r + 14 + Math.sin(state.timeElapsed * 2) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#eaf9ff";
    ctx.font = "700 18px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillText(station.name, 0, station.r + 34);

    ctx.fillStyle = "#b4d8e7";
    ctx.font = "500 13px Space Grotesk";
    drawWrappedText(subtitle, 0, station.r + 54, 170, 15, "center");
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

    const idlePulse = Math.sin(state.timeElapsed * 6) * 0.06 + 1;
    const guardGrad = ctx.createLinearGradient(-18, -16, 24, 18);
    guardGrad.addColorStop(0, "#f1fbff");
    guardGrad.addColorStop(0.55, "#9ddfff");
    guardGrad.addColorStop(1, "#5bc7ff");

    ctx.strokeStyle = "rgba(108, 220, 255, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 29 * idlePulse, -Math.PI * 0.65, Math.PI * 0.65);
    ctx.stroke();

    ctx.fillStyle = guardGrad;
    ctx.strokeStyle = "#d8f7ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-10, 18);
    ctx.lineTo(-2, 6);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-2, -6);
    ctx.lineTo(-10, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f2f43";
    ctx.beginPath();
    ctx.arc(-2, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#9af6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(3, 0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 220, 120, 0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-28, -8);
    ctx.moveTo(-13, 0);
    ctx.lineTo(-28, 8);
    ctx.stroke();

    if (p.cooldown > 0.02) {
      ctx.strokeStyle = "rgba(255, 210, 96, 0.95)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.cooldown / 0.29));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShards() {
    for (const shard of state.shards) {
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.tilt + shard.pulse * 0.15);
      if (shard.type === "drop") {
        drawPanel(-13, -15, 26, 30, "rgba(135,243,183,0.88)", "rgba(228,255,240,0.94)", 7, 2);
        ctx.fillStyle = "rgba(11,57,55,0.82)";
        ctx.fillRect(-6, -7, 12, 2.2);
        ctx.fillRect(-6, -1, 10, 2.2);
        ctx.fillRect(-6, 5, 8, 2.2);
        ctx.strokeStyle = "rgba(187,255,220,0.5)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(0, -30 - Math.sin(shard.pulse) * 4);
        ctx.stroke();
      } else {
        drawPanel(-12, -14, 24, 28, "rgba(135,243,183,0.84)", "rgba(228,255,240,0.94)", 7, 2);
      }
      ctx.restore();
    }
  }

  function drawAnomalies() {
    for (const anomaly of state.anomalies) {
      ctx.save();
      ctx.translate(anomaly.x, anomaly.y);
      ctx.rotate(anomaly.wobble * 0.28);

      if (anomaly.type === "scrambler") {
        const outer = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
        outer.addColorStop(0, "rgba(255,145,166,0.96)");
        outer.addColorStop(1, "rgba(255,88,118,0.16)");
        ctx.fillStyle = outer;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,110,130,0.9)";
        ctx.strokeStyle = "rgba(255,230,235,0.8)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
          const angle = (Math.PI * 2 * i) / 9;
          const radius = i % 2 === 0 ? 18 : 8;
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

        ctx.rotate(-anomaly.wobble * 0.56);
        ctx.fillStyle = "#fff4f6";
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillRect(-2, -8, 4, 16);
      } else if (anomaly.type === "gradient_spike") {
        ctx.fillStyle = "rgba(255,174,110,0.16)";
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,215,164,0.92)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-12, -18);
        ctx.lineTo(2, -2);
        ctx.lineTo(-4, -2);
        ctx.lineTo(12, 18);
        ctx.lineTo(0, 2);
        ctx.lineTo(6, 2);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,112,176,0.16)";
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,170,221,0.88)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(16, -6);
        ctx.lineTo(10, 18);
        ctx.lineTo(-10, 18);
        ctx.lineTo(-16, -6);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,220,240,0.72)";
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawEffects() {
    for (const effect of state.effects) {
      const alpha = effect.life / effect.maxLife;
      if (effect.kind === "particle") {
        ctx.fillStyle = `rgba(${effect.color}, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.kind === "ring") {
        ctx.strokeStyle = `rgba(${effect.color}, ${alpha * 0.8})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawProjectiles() {
    for (const projectile of state.projectiles) {
      for (let i = 0; i < projectile.trail.length; i++) {
        const trail = projectile.trail[i];
        const alpha = 1 - i / Math.max(1, projectile.trail.length);
        ctx.fillStyle = `rgba(255, 210, 120, ${alpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, projectile.r * alpha, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(Math.atan2(projectile.vy, projectile.vx) + projectile.spin);
      ctx.fillStyle = "rgba(255, 232, 170, 0.98)";
      ctx.strokeStyle = "rgba(255, 248, 220, 0.95)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-3, 4.5);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-3, -4.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCollectionInterface() {
    const nodes = getStageNodes();
    const run = state.run;
    const resources = state.resources;
    drawPanel(84, 140, 1112, 476, "rgba(6,24,40,0.34)", "rgba(157,225,246,0.18)", 24, 2);

    ctx.strokeStyle = "rgba(132,220,255,0.32)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(nodes.source.x - 180, nodes.source.y + 22);
    ctx.lineTo(nodes.source.x - 180, 608);
    ctx.moveTo(nodes.source.x + 180, nodes.source.y + 22);
    ctx.lineTo(nodes.source.x + 180, 608);
    ctx.stroke();
    ctx.setLineDash([]);

    drawStation(nodes.source, "#6bd6ff", "Packets drop continuously from the upstream source.", false);
    drawStation(
      nodes.relay,
      "#9fe6ff",
      resources.data >= run.collectionGoal ? "Dataset ready. Press E/B to relay into training." : `Need ${run.collectionGoal} clean packets.`,
      nearStation(nodes.relay, 34)
    );

    drawPanel(102, 180, 290, 88, "rgba(12,43,64,0.64)", "rgba(126,214,255,0.36)", 18, 2);
    ctx.fillStyle = "#e5faff";
    ctx.font = "700 16px Space Grotesk";
    ctx.fillText("Source Rule", 124, 210);
    ctx.fillStyle = "#a9d7ea";
    ctx.font = "500 13px Space Grotesk";
    drawWrappedText("Catch falling clean packets before scramblers corrupt them. More clean data gives better training headroom.", 124, 234, 244, 16, "left");
  }

  function drawTrainingInterface() {
    const nodes = getStageNodes();
    const run = state.run;
    const projected = Math.round(computeProjectedAccuracy());

    drawPanel(78, 138, 1140, 484, "rgba(6,24,40,0.34)", "rgba(157,225,246,0.18)", 24, 2);
    drawPanel(84, 166, 296, 224, "rgba(11,39,58,0.78)", "rgba(129,213,255,0.34)", 18, 2);
    ctx.fillStyle = "#e7fbff";
    ctx.font = "700 17px Space Grotesk";
    ctx.fillText("Task Requirement", 108, 198);
    ctx.fillStyle = "#d3eff8";
    ctx.font = "700 20px Space Grotesk";
    drawWrappedText(run.trainingTask.label, 108, 228, 240, 22, "left");
    ctx.fillStyle = "#a8d7e7";
    ctx.font = "500 13px Space Grotesk";
    drawWrappedText(run.trainingTask.requirement, 108, 286, 240, 16, "left");
    ctx.fillStyle = "#8cd0e6";
    drawWrappedText(`Hint: ${run.trainingTask.clue}`, 108, 350, 240, 16, "left");

    drawStation(nodes.upload, "#77e0ff", "Press E/B to upload a training batch.", nearStation(nodes.upload, 34));
    drawStation(
      nodes.core,
      "#8cffb0",
      `Projected final accuracy: ${projected}%`,
      nearStation(nodes.core, 34)
    );
    drawStation(nodes.console, "#ffd37e", "Choose the right activation using click or 1-4.", nearStation(nodes.console, 34));

    ctx.strokeStyle = "rgba(145, 226, 255, 0.38)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(nodes.upload.x + 70, nodes.upload.y - 28);
    ctx.lineTo(nodes.core.x - 90, nodes.core.y + 24);
    ctx.lineTo(nodes.console.x - 74, nodes.console.y - 16);
    ctx.stroke();
    ctx.setLineDash([]);

    const buttons = getActivationButtons();
    state.ui.activeButtons = buttons;
    for (const button of buttons) {
      const active = state.run.selectedActivation === button.id.replace("activation_", "");
      const hovered = state.ui.hoverButtonId === button.id;
      drawPanel(
        button.rect.x,
        button.rect.y,
        button.rect.w,
        button.rect.h,
        active
          ? "rgba(255,208,118,0.28)"
          : hovered
            ? "rgba(123,235,196,0.26)"
            : "rgba(16,56,77,0.66)",
        active
          ? "rgba(255,243,211,0.92)"
          : hovered
            ? "rgba(182,253,229,0.82)"
            : "rgba(121,190,220,0.52)",
        14,
        active ? 3 : 2
      );
      ctx.fillStyle = "#effbff";
      ctx.font = "700 18px Space Grotesk";
      ctx.fillText(button.label, button.rect.x + 18, button.rect.y + 26);
      ctx.fillStyle = "#a5d8ea";
      ctx.font = "500 12px Space Grotesk";
      drawWrappedText(button.lesson, button.rect.x + 18, button.rect.y + 44, button.rect.w - 30, 14, "left");
    }
  }

  function drawDeploymentInterface() {
    const nodes = getStageNodes();
    const run = state.run;

    drawPanel(86, 144, 1110, 470, "rgba(6,24,40,0.34)", "rgba(157,225,246,0.18)", 24, 2);
    drawPanel(92, 182, 292, 188, "rgba(11,39,58,0.76)", "rgba(129,213,255,0.34)", 18, 2);
    ctx.fillStyle = "#e8fbff";
    ctx.font = "700 17px Space Grotesk";
    ctx.fillText("Rollout Rule", 114, 214);
    ctx.fillStyle = "#a6d6e8";
    ctx.font = "500 13px Space Grotesk";
    drawWrappedText(
      run.deploymentActive
        ? "The gateway is live. Injection waves now reduce rollout progress and integrity if they land."
        : "Start the serve gateway only after you trust the training accuracy. Below 50% still fails deployment.",
      114,
      242,
      244,
      16,
      "left"
    );

    drawStation(nodes.console, "#7ddcff", "Optional anchor console for rollout telemetry.", nearStation(nodes.console, 34));
    drawStation(
      nodes.gate,
      "#9fffd3",
      run.deploymentActive ? `Rollout ${Math.round(run.deployProgress)}%` : "Press E/B to start rollout.",
      nearStation(nodes.gate, 36)
    );

    ctx.strokeStyle = "rgba(170,255,211,0.36)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(nodes.gate.x, nodes.gate.y, 128 + Math.sin(state.timeElapsed * 2.1) * 8, 0, Math.PI * 2);
    ctx.stroke();

    drawPanel(546, 534, 384, 22, "rgba(17,60,77,0.86)", "rgba(161,236,255,0.34)", 12, 1.5);
    drawPanel(548, 536, 380 * (run.deployProgress / 100), 18, "rgba(159,255,214,0.82)", null, 10, 0);
  }

  function drawHud() {
    const resources = state.resources;
    const model = getModel();
    const difficulty = getDifficulty();
    const run = state.run;
    const topY = 18;
    drawPanel(20, topY, 360, 114, "rgba(4,18,28,0.72)", "rgba(144,221,246,0.46)", 18, 2);
    drawPanel(396, topY, 864, 114, "rgba(4,18,28,0.7)", "rgba(144,221,246,0.42)", 18, 2);

    ctx.fillStyle = "#ebfbff";
    ctx.font = "700 17px Space Grotesk";
    ctx.fillText(`Guardian: ${model.label}`, 42, 48);

    ctx.fillStyle = "#bfe9ff";
    ctx.font = "600 14px Space Grotesk";
    ctx.fillText(`${getStageLabel()} | ${difficulty.label}`, 42, 72);

    ctx.fillStyle = "#9ed3e6";
    ctx.font = "500 12px Space Grotesk";
    ctx.fillText(`Learn: ${model.microLesson}`, 42, 96);

    let stageChip = `Goal ${getCollectionGoal()} packets`;
    if (run.stage === "training") {
      stageChip = run.selectedActivation
        ? `Act ${getSelectedActivation().label} | Upload ${run.uploadedPackets}/${run.trainingDataBudget}`
        : `Activation unset | Upload ${run.uploadedPackets}/${run.trainingDataBudget}`;
    } else if (run.stage === "deployment") {
      stageChip = run.deploymentActive
        ? `Rollout ${Math.round(run.deployProgress)}%`
        : `Gateway standby`;
    }

    const chips = [
      `Data ${resources.data}`,
      `Compute ${Math.round(resources.compute)}`,
      `Integrity ${Math.round(resources.alignment)}`,
      `Train ${Math.round(resources.training)}% | Acc ${Math.round(resources.accuracy)}%`,
      stageChip,
      `Time ${Math.ceil(resources.timeLeft)}s`,
      `Score ${Math.round(resources.score)}`,
    ];

    const chipPositions = [
      { x: 414, y: 32, w: 150 },
      { x: 576, y: 32, w: 156 },
      { x: 744, y: 32, w: 166 },
      { x: 922, y: 32, w: 208 },
      { x: 1142, y: 32, w: 102 },
      { x: 414, y: 72, w: 198 },
      { x: 624, y: 72, w: 154 },
    ];

    ctx.font = "600 13px Space Grotesk";
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      const pos = chipPositions[i];
      drawPanel(pos.x, pos.y, pos.w, 28, "rgba(76,173,212,0.18)", "rgba(188,237,255,0.3)", 10, 1.6);
      ctx.fillStyle = "#f0f9ff";
      ctx.fillText(chip, pos.x + 12, pos.y + 18);
    }

    if (state.ui.notice) {
      drawPanel(BASE_WIDTH / 2 - 292, BASE_HEIGHT - 82, 584, 54, "rgba(255,248,204,0.95)", "rgba(91,142,165,0.7)", 14, 2);
      ctx.fillStyle = "#10394d";
      ctx.font = "600 16px Space Grotesk";
      ctx.textAlign = "center";
      drawWrappedText(state.ui.notice, BASE_WIDTH / 2, BASE_HEIGHT - 52, 520, 17, "center");
      ctx.textAlign = "left";
    }

    drawPanel(22, BASE_HEIGHT - 160, 412, 80, "rgba(7,24,39,0.76)", "rgba(120,186,216,0.34)", 16, 2);
    ctx.fillStyle = "#dff7ff";
    ctx.font = "700 15px Space Grotesk";
    ctx.fillText("Learning Feed", 42, BASE_HEIGHT - 128);
    ctx.fillStyle = "#acd7e9";
    ctx.font = "500 13px Space Grotesk";
    drawWrappedText(getLearningPrompt(), 42, BASE_HEIGHT - 106, 372, 16, "left");

    const controlLine = run.stage === "training"
      ? "Move: Arrows/WASD  Fire: Space/Click  Interact: E/B  Set Activation: 1-4 or click  Pause: Esc/P"
      : "Move: Arrows/WASD  Fire Epoch Burst: Space/Click  Interact: E/B  Pause: Esc/P  Fullscreen: F";
    ctx.fillStyle = "rgba(208, 240, 255, 0.82)";
    ctx.font = "500 13px Space Grotesk";
    ctx.fillText(controlLine, 32, BASE_HEIGHT - 12);
  }

  function drawGameplay() {
    drawBackground();

    if (state.run.stage === "collection") {
      drawCollectionInterface();
    } else if (state.run.stage === "training") {
      drawTrainingInterface();
    } else {
      drawDeploymentInterface();
    }

    drawEffects();
    drawShards();
    drawProjectiles();
    drawAnomalies();
    drawPlayer();
    drawHud();
  }

  function drawButton(button, active) {
    const hovered = state.ui.hoverButtonId === button.id;
    const r = button.rect;

    drawPanel(
      r.x,
      r.y,
      r.w,
      r.h,
      active
        ? "rgba(113, 215, 255, 0.45)"
        : hovered
          ? "rgba(114, 230, 186, 0.33)"
          : "rgba(17, 54, 77, 0.72)",
      active
        ? "rgba(208, 249, 255, 0.95)"
        : hovered
          ? "rgba(177, 255, 225, 0.85)"
          : "rgba(117, 186, 217, 0.56)",
      12,
      active ? 3 : 2
    );

    ctx.fillStyle = "#edfbff";
    ctx.font = "700 22px Space Grotesk";
    ctx.textAlign = "center";
    ctx.fillText(button.label, r.x + r.w / 2, r.y + 37);
    ctx.textAlign = "left";
  }

  function drawMainMenu() {
    drawBackground();

    drawPanel(170, 74, 940, 572, "rgba(6,24,40,0.72)", "rgba(164,229,255,0.5)", 24, 2);

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
      "Run a three-level AI pipeline: collect data, configure training, and survive deployment.",
      BASE_WIDTH / 2,
      276
    );

    ctx.fillStyle = "#9cd5ea";
    ctx.font = "500 15px Space Grotesk";
    ctx.fillText("Learn model tradeoffs, activation functions, and rollout defense while firing epoch bursts.", BASE_WIDTH / 2, 302);

    const model = getModel();
    const difficulty = getDifficulty();
    const squad = getSquadSize();
    drawPanel(250, 536, 780, 84, "rgba(80,168,204,0.26)", "rgba(156,221,246,0.36)", 18, 2);
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

    drawPanel(150, 62, 980, 598, "rgba(8,26,38,0.78)", "rgba(166,231,255,0.5)", 24, 2);

    ctx.fillStyle = "#daf9ff";
    ctx.font = "800 54px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Simulation Settings", BASE_WIDTH / 2, 150);

    ctx.fillStyle = "#a0dff8";
    ctx.font = "500 18px Space Grotesk";
    ctx.fillText("Tune real model families, challenge pressure, operator count, and sound cues.", BASE_WIDTH / 2, 186);

    const rows = settingsRowRects();
    state.ui.activeButtons = rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const active = i === state.ui.settingsIndex;
      const hovered = state.ui.hoverButtonId === row.id;
      const rect = row.rect;

      drawPanel(
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        active
          ? "rgba(112, 208, 255, 0.4)"
          : hovered
            ? "rgba(126, 236, 197, 0.33)"
            : "rgba(16, 56, 77, 0.68)",
        active
          ? "rgba(212, 250, 255, 0.95)"
          : hovered
            ? "rgba(182, 253, 229, 0.86)"
            : "rgba(121, 190, 220, 0.58)",
        14,
        active ? 3 : 2
      );

      ctx.fillStyle = "#e8fbff";
      ctx.font = "700 21px Space Grotesk";
      ctx.textAlign = "left";
      ctx.fillText(row.label, rect.x + 24, rect.y + 29);

      if (row.value) {
        ctx.fillStyle = "#bde7f7";
        ctx.font = "500 17px Space Grotesk";
        ctx.textAlign = "right";
        ctx.fillText(row.value, rect.x + rect.w - 24, rect.y + 42);
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

    drawPanel(144, 60, 992, 600, "rgba(8,26,38,0.8)", "rgba(169,232,255,0.5)", 24, 2);

    ctx.fillStyle = "#ddfbff";
    ctx.font = "800 52px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Mission Brief", BASE_WIDTH / 2, 152);

    const lines = [
      "You run Agent Forge, an AI operations lab under a strict launch window.",
      "",
      "Flow:",
      "1. Level 1: clean packets drop from the source stream. Catch them before scramblers corrupt the dataset.",
      "2. Move to the collection relay once you have enough clean packets to build a training set.",
      "3. Level 2: read the random task brief and choose an activation function that fits it.",
      "4. Upload packets into the training core while defending against gradient spikes.",
      "5. The better your activation choice, the higher the final training accuracy.",
      "6. Level 3: start rollout at the serve gateway and defend against deployment attacks.",
      "7. Accuracy below 50% still fails deployment even if you survive the last defense phase.",
      "",
      "Concept tie-in:",
      "- Data quality gates the whole pipeline. Bad or missing packets reduce what training can learn.",
      "- Activation functions matter: the right non-linearity depends on the task requirement.",
      "- Deployment is its own discipline. Good models can still fail when rollout defenses collapse.",
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

    drawPanel(350, 184, 580, 384, "rgba(10,33,48,0.92)", "rgba(176,234,255,0.68)", 22, 2);

    ctx.fillStyle = "#e5fbff";
    ctx.font = "800 42px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Simulation Paused", BASE_WIDTH / 2, 252);

    ctx.fillStyle = "#bde4f3";
    ctx.font = "500 18px Space Grotesk";
    ctx.fillText("Review your plan and continue when ready.", BASE_WIDTH / 2, 292);

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
      accuracy: 0,
      remainingTime: 0,
    };

    ctx.fillStyle = "rgba(6, 17, 27, 0.74)";
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    drawPanel(
      292,
      116,
      696,
      492,
      "rgba(10,33,48,0.95)",
      result.victory ? "rgba(174,251,205,0.9)" : "rgba(255,195,196,0.9)",
      24,
      3
    );

    ctx.fillStyle = result.victory ? "#dbffe8" : "#ffe7e7";
    ctx.font = "800 44px Syne";
    ctx.textAlign = "center";
    ctx.fillText(result.victory ? "Deployment Success" : "Run Failed", BASE_WIDTH / 2, 188);

    ctx.fillStyle = "#d6eff9";
    ctx.font = "600 22px Space Grotesk";
    const reasonLineCount = drawWrappedText(result.reason, BASE_WIDTH / 2, 236, 560, 28, "center");

    ctx.fillStyle = "#bfe3f5";
    ctx.font = "500 21px Space Grotesk";
    const metricsStartY = 236 + reasonLineCount * 28 + 22;
    const metricLineHeight = 34;
    ctx.fillText(`Score: ${Math.round(result.score)}`, BASE_WIDTH / 2, metricsStartY);
    ctx.fillText(`Accuracy: ${Math.round(result.accuracy)}%`, BASE_WIDTH / 2, metricsStartY + metricLineHeight);
    ctx.fillText(`Training: ${Math.round(result.training)}%`, BASE_WIDTH / 2, metricsStartY + metricLineHeight * 2);
    ctx.fillText(
      `Time Remaining: ${Math.ceil(result.remainingTime)}s`,
      BASE_WIDTH / 2,
      metricsStartY + metricLineHeight * 3
    );

    const lessonY = metricsStartY + metricLineHeight * 3 + 24;
    drawPanel(BASE_WIDTH / 2 - 230, lessonY - 18, 460, 52, "rgba(19,58,78,0.72)", null, 16, 0);

    ctx.fillStyle = "#a9dcf0";
    ctx.font = "500 15px Space Grotesk";
    const lessonLineCount = drawWrappedText(
      result.lesson
        ? `Lesson: ${result.lesson}`
        : result.victory
          ? "Lesson: better packet coverage created a deployable model."
          : "Lesson: rushed or noisy training left the model below deployment quality.",
      BASE_WIDTH / 2,
      lessonY,
      420,
      19,
      "center"
    );

    const buttonStartY = lessonY + lessonLineCount * 19 + 22;
    const buttons = getResultButtons(buttonStartY);
    state.ui.activeButtons = buttons;
    for (let i = 0; i < buttons.length; i++) {
      drawButton(buttons[i], state.ui.resultIndex === i);
    }

    ctx.textAlign = "left";
  }

  function render() {
    canvas.style.cursor = state.mode === "playing" ? "none" : "crosshair";
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
      accuracy: 0,
      score: 0,
      timeLeft: 0,
      deployed: false,
      stageIndex: 0,
    };
    const run = state.run || {
      stage: "collection",
      collectionGoal: getDifficulty().collectionGoal,
      trainingTask: pickTaskProfile(),
      selectedActivation: null,
      trainingDataBudget: 0,
      uploadedPackets: 0,
      deployProgress: 0,
      deploymentActive: false,
    };
    const nodes = getStageNodes();
    const objective = getObjectiveText();

    const payload = {
      coordinate_system: "origin=(0,0) top-left, +x right, +y down, world=1280x720",
      mode: state.mode,
      stage: {
        id: run.stage,
        label: getStageLabel(),
        index: STAGE_ORDER.indexOf(run.stage) + 1,
      },
      settings: {
        model: getModel().label,
        difficulty: getDifficulty().label,
        squad: getSquadSize(),
        sound_enabled: state.settings.soundEnabled,
      },
      model_profile: {
        organization: getModel().org,
        parameter_scale: getModel().params,
        educational_note: getModel().lesson,
      },
      deploy_accuracy_threshold: 50,
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
        accuracy: Math.round(resources.accuracy),
        score: Math.round(resources.score),
        time_left_seconds: Number(resources.timeLeft.toFixed(1)),
        collection_goal: run.collectionGoal || 0,
        uploaded_packets: run.uploadedPackets || 0,
        training_budget: run.trainingDataBudget || 0,
        deploy_progress: Math.round(run.deployProgress || 0),
      },
      task_profile: {
        name: run.trainingTask ? run.trainingTask.label : null,
        requirement: run.trainingTask ? run.trainingTask.requirement : null,
        clue: run.trainingTask ? run.trainingTask.clue : null,
        selected_activation: run.selectedActivation,
        activation_options: ACTIVATION_OPTIONS.map((option) => option.label),
      },
      stage_nodes: Object.fromEntries(
        Object.entries(nodes).map(([key, value]) => [key, { x: Math.round(value.x), y: Math.round(value.y) }])
      ),
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
      learning_prompt: getLearningPrompt(),
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

    unlockAudio();

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
    unlockAudio();
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
