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

  const TRAINING_METHOD_OPTIONS = [
    {
      id: "sft",
      label: "Supervised Fine-Tuning",
      lesson: "Best when you have labeled input-output examples for the target task.",
    },
    {
      id: "instruction",
      label: "Instruction Tuning",
      lesson: "Best when the model must follow task prompts and produce helpful responses.",
    },
    {
      id: "distillation",
      label: "Distillation",
      lesson: "Best when an expert model or policy already exists and you want a smaller replica.",
    },
    {
      id: "preference",
      label: "Preference Optimization",
      lesson: "Best when human rankings or preference pairs define quality better than exact labels.",
    },
  ];

  const TASK_PROFILES = [
    {
      id: "sensor_classifier",
      label: "Sensor Drift Classifier",
      requirement: "You have labeled clean-vs-drift packet examples and need fast tabular decisions.",
      clue: "Look for the activation that keeps only the useful positive signals alive.",
      methodClue: "Use the method that learns directly from labeled examples.",
      recommendedActivation: "relu",
      recommendedMethod: "sft",
      scores: { relu: 22, gelu: 10, silu: 6, tanh: -6 },
      methodScores: { sft: 22, instruction: 4, distillation: 8, preference: -5 },
    },
    {
      id: "coding_assistant",
      label: "Coding Copilot Fine-Tune",
      requirement: "You have prompt-response examples and need strong instruction following for code help.",
      clue: "Language and code generally prefer smooth activations over hard clipping.",
      methodClue: "Use the method designed for prompt-following datasets rather than plain labels.",
      recommendedActivation: "gelu",
      recommendedMethod: "instruction",
      scores: { relu: 4, gelu: 22, silu: 12, tanh: -4 },
      methodScores: { sft: 10, instruction: 22, distillation: 9, preference: 4 },
    },
    {
      id: "tool_router",
      label: "Agent Tool Router",
      requirement: "An expert router already exists and you want a smaller model to copy its decisions.",
      clue: "A gated activation helps when the network must softly decide where traffic should go.",
      methodClue: "Use the method that transfers behavior from a stronger teacher or policy.",
      recommendedActivation: "silu",
      recommendedMethod: "distillation",
      scores: { relu: 7, gelu: 12, silu: 22, tanh: -3 },
      methodScores: { sft: 8, instruction: 6, distillation: 22, preference: 9 },
    },
    {
      id: "alignment_assistant",
      label: "Safety Preference Assistant",
      requirement: "You have ranked human preference pairs and need safer response behavior.",
      clue: "Choose the activation that stays smooth while preserving useful negative feedback.",
      methodClue: "Use the method that learns from preference rankings instead of exact answers.",
      recommendedActivation: "tanh",
      recommendedMethod: "preference",
      scores: { relu: -8, gelu: 8, silu: 5, tanh: 22 },
      methodScores: { sft: 4, instruction: 8, distillation: 7, preference: 22 },
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

  const ACHIEVEMENTS = [
    {
      id: "clean_collector",
      label: "Clean Collector",
      desc: "Complete Level 1 with zero corrupted packets caught.",
    },
    {
      id: "recipe_expert",
      label: "Recipe Expert",
      desc: "Choose the optimal activation and method for the given task.",
    },
    {
      id: "top_deployer",
      label: "Top Deployer",
      desc: "Deploy a model reaching 80% accuracy or higher.",
    },
    {
      id: "task_scholar",
      label: "Task Scholar",
      desc: "Complete all four training task profiles successfully.",
    },
    {
      id: "speed_deploy",
      label: "Speed Deployer",
      desc: "Win a run with 60 or more seconds left on the clock.",
    },
    {
      id: "high_scorer",
      label: "High Scorer",
      desc: "Finish a run with a score of 500 or higher.",
    },
    {
      id: "model_tester",
      label: "Model Tester",
      desc: "Run a simulation with all three model families.",
    },
  ];

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
    achievements: [],
    achievementsThisRun: [],
    codex: {
      tasksCompleted: [],
      modelsUsed: [],
      activationsCorrect: [],
      methodsCorrect: [],
    },
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

  function getSelectedMethod() {
    if (!state.run || !state.run.selectedMethod) {
      return null;
    }
    return (
      TRAINING_METHOD_OPTIONS.find((option) => option.id === state.run.selectedMethod) || null
    );
  }

  function getStageNodes() {
    const stage = getStageId();
    if (stage === "collection") {
      return {
        source: { x: 640, y: 120, r: 66, name: "Source Stream" },
        sorter: { x: 1066, y: 574, r: 72, name: "Quality Meter" },
      };
    }
    if (stage === "training") {
      return {
        upload: { x: 270, y: 556, r: 70, name: "Upload Port" },
        core: { x: 708, y: 364, r: 96, name: "Training Core" },
        activation: { x: 1068, y: 278, r: 72, name: "Activation Rack" },
        method: { x: 1068, y: 498, r: 72, name: "Training Method Rack" },
      };
    }
    return {
      console: { x: 252, y: 548, r: 70, name: "Rollout Console" },
      gate: { x: 1008, y: 378, r: 96, name: "Serve Gateway" },
    };
  }

  function getActivationButtons() {
    const x = 948;
    const y = 166;
    const w = 264;
    const h = 48;
    const gap = 10;
    return ACTIVATION_OPTIONS.map((option, idx) => ({
      ...option,
      label: `${idx + 1}. ${option.label}`,
      rect: { x, y: y + idx * (h + gap), w, h },
      id: `activation_${option.id}`,
    }));
  }

  function getMethodButtons() {
    const x = 948;
    const y = 426;
    const w = 264;
    const h = 44;
    const gap = 10;
    const hotkeys = ["Q", "W", "E", "R"];
    return TRAINING_METHOD_OPTIONS.map((option, idx) => ({
      ...option,
      label: `${hotkeys[idx]}. ${option.label}`,
      rect: { x, y: y + idx * (h + gap), w, h },
      id: `method_${option.id}`,
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

  function getMethodScore() {
    const run = state.run;
    if (!run || !run.trainingTask) {
      return 0;
    }
    if (!run.selectedMethod) {
      return -14;
    }
    return run.trainingTask.methodScores[run.selectedMethod] ?? -10;
  }

  function getMethodHudLabel(methodId) {
    switch (methodId) {
      case "sft":
        return "SFT";
      case "instruction":
        return "Instr";
      case "distillation":
        return "Distill";
      case "preference":
        return "Pref";
      default:
        return "Unset";
    }
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
    const noisePenalty = (run.noisyPacketsCaught || 0) * 3.2;
    return clamp(
      base +
        dataScore +
        defenseScore +
        modelScore +
        getActivationScore() +
        getMethodScore() -
        difficultyPenalty -
        threatPenalty -
        noisePenalty,
      8,
      96
    );
  }

  function getObjectiveText() {
    const resources = state.resources;
    const run = state.run;
    if (!resources || !run) {
      return "Collect clean data, choose the right training recipe, and ship the model.";
    }

    if (state.mode === "result") {
      return state.result && state.result.victory
        ? "Run complete: deployment successful"
        : "Run complete: iterate on data quality, activation choice, and defense.";
    }

    if (run.stage === "collection") {
      return `Catch at least ${run.collectionGoal} quality packets. Training opens automatically when the bag is full enough.`;
    }
    if (run.stage === "training") {
      if (!run.selectedActivation || !run.selectedMethod) {
        return "Read the task card, choose both the activation and the training method, then upload the dataset.";
      }
      return `Upload remaining packets into the core. Current recipe: ${getSelectedMethod().label} + ${getSelectedActivation().label}.`;
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
      return "Three levels teach how clean data, method choice, activation choice, and rollout defense shape model quality.";
    }
    if (state.mode === "result" && state.result && state.result.lesson) {
      return state.result.lesson;
    }
    if (run.stage === "collection") {
      return "Level 1: collect the clean packets and avoid the corrupted noisy ones. Better data quality makes better training possible.";
    }
    if (run.stage === "training") {
      if (!run.selectedActivation || !run.selectedMethod) {
        return `Task card: ${run.trainingTask.requirement} Pick the training method and activation that best match the clues.`;
      }
      const selected = getSelectedActivation();
      const selectedMethod = getSelectedMethod();
      const isBestActivation = selected && selected.id === run.trainingTask.recommendedActivation;
      const isBestMethod = selectedMethod && selectedMethod.id === run.trainingTask.recommendedMethod;
      if (isBestActivation && isBestMethod) {
        return `${selectedMethod.label} + ${selected.label} fits this task well. Uploading now should maximize accuracy if you protect the core.`;
      }
      return `${selectedMethod.label} + ${selected.label} is a risky recipe for this task. Read the clues again before committing the run.`;
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

  function loadPersistentData() {
    try {
      const raw = localStorage.getItem("agentForgeData");
      if (!raw) return;
      const data = JSON.parse(raw);
      state.achievements = Array.isArray(data.achievements) ? data.achievements : [];
      state.codex.tasksCompleted = Array.isArray(data.tasksCompleted) ? data.tasksCompleted : [];
      state.codex.modelsUsed = Array.isArray(data.modelsUsed) ? data.modelsUsed : [];
      state.codex.activationsCorrect = Array.isArray(data.activationsCorrect)
        ? data.activationsCorrect
        : [];
      state.codex.methodsCorrect = Array.isArray(data.methodsCorrect) ? data.methodsCorrect : [];
    } catch (e) {
      console.warn("[AgentForge] Failed to load persistent data:", e);
    }
  }

  function savePersistentData() {
    try {
      localStorage.setItem(
        "agentForgeData",
        JSON.stringify({
          achievements: state.achievements,
          tasksCompleted: state.codex.tasksCompleted,
          modelsUsed: state.codex.modelsUsed,
          activationsCorrect: state.codex.activationsCorrect,
          methodsCorrect: state.codex.methodsCorrect,
        })
      );
    } catch (e) {
      console.warn("[AgentForge] Failed to save persistent data:", e);
    }
  }

  function unlockAchievement(id) {
    if (state.achievements.includes(id)) {
      return false;
    }
    state.achievements.push(id);
    state.achievementsThisRun.push(id);
    savePersistentData();
    return true;
  }

  function checkRunAchievements(victory) {
    const run = state.run;
    const resources = state.resources;
    const model = getModel();

    if (!state.codex.modelsUsed.includes(model.label)) {
      state.codex.modelsUsed.push(model.label);
      savePersistentData();
    }

    if (MODEL_OPTIONS.every((m) => state.codex.modelsUsed.includes(m.label))) {
      unlockAchievement("model_tester");
    }

    if (!victory) return;

    if (run.noisyPacketsCaught === 0) {
      unlockAchievement("clean_collector");
    }

    const selected = getSelectedActivation();
    const selectedMethod = getSelectedMethod();
    const task = run.trainingTask;
    if (selected && selectedMethod && task) {
      const activationCorrect = selected.id === task.recommendedActivation;
      const methodCorrect = selectedMethod.id === task.recommendedMethod;
      if (activationCorrect && methodCorrect) {
        unlockAchievement("recipe_expert");
        if (!state.codex.activationsCorrect.includes(selected.id)) {
          state.codex.activationsCorrect.push(selected.id);
        }
        if (!state.codex.methodsCorrect.includes(selectedMethod.id)) {
          state.codex.methodsCorrect.push(selectedMethod.id);
        }
        savePersistentData();
      }
    }

    if (resources.accuracy >= 80) {
      unlockAchievement("top_deployer");
    }

    if (task && !state.codex.tasksCompleted.includes(task.id)) {
      state.codex.tasksCompleted.push(task.id);
      savePersistentData();
    }
    if (state.codex.tasksCompleted.length >= TASK_PROFILES.length) {
      unlockAchievement("task_scholar");
    }

    if (resources.timeLeft >= 60) {
      unlockAchievement("speed_deploy");
    }

    if (resources.score >= 500) {
      unlockAchievement("high_scorer");
    }
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
      const task = state.run.trainingTask;
      const isMatch = task && option.id === task.recommendedActivation;
      playSound(isMatch ? "train" : "pickup");
      setNotice(
        isMatch
          ? `${option.label} looks like the right fit. ${option.lesson}`
          : `${option.label} selected. ${option.lesson}`,
        2.2
      );
    }
  }

  function selectMethod(id, silent = false) {
    if (!state.run || state.run.stage !== "training") {
      return;
    }
    state.run.selectedMethod = id;
    if (!silent) {
      const option = getSelectedMethod();
      const task = state.run.trainingTask;
      const isMatch = task && option.id === task.recommendedMethod;
      playSound(isMatch ? "train" : "pickup");
      setNotice(
        isMatch
          ? `${option.label} looks like the right approach. ${option.lesson}`
          : `${option.label} selected. ${option.lesson}`,
        2.2
      );
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
      run.noisyPacketsCaught = 0;
      run.autoStageTimer = 0;
      run.collectionGoal = difficulty.collectionGoal;
      setNotice(`Level 1: catch ${run.collectionGoal}+ clean packets and avoid noisy packets.`, 2.6);
      return;
    }

    if (stage === "training") {
      state.player = createPlayer(312, 560);
      run.trainingDataBudget = Math.max(run.collectionGoal, state.resources.data);
      run.uploadedPackets = 0;
      run.trainingHits = 0;
      run.selectedMethod = null;
      state.resources.training = 0;
      state.resources.accuracy = 0;
      state.spawnTimer = difficulty.trainingThreatInterval;
      state.shardTimer = 99;
      setNotice(
        `Level 2: choose the method and activation for ${run.trainingTask.label}, then upload ${run.trainingDataBudget} packets.`,
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
      noisyPacketsCaught: 0,
      autoStageTimer: 0,
      trainingTask: pickTaskProfile(),
      selectedActivation: null,
      selectedMethod: null,
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
      clean: Math.random() > 0.25,
    });
  }

  function spawnAnomaly() {
    const difficulty = getDifficulty();
    const stage = getStageId();
    if (stage === "collection") {
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
      playSound("warning");
      setNotice("Just keep collecting the clean packets. Training opens automatically when the quality target is reached.", 1.6);
      return;
    }

    if (run.stage === "training") {
      if (nearStation(nodes.activation, 34)) {
        const currentIndex = Math.max(0, ACTIVATION_OPTIONS.findIndex((option) => option.id === run.selectedActivation));
        const next = ACTIVATION_OPTIONS[(currentIndex + 1) % ACTIVATION_OPTIONS.length];
        selectActivation(next.id);
        return;
      }
      if (nearStation(nodes.method, 34)) {
        const currentIndex = Math.max(
          0,
          TRAINING_METHOD_OPTIONS.findIndex((option) => option.id === run.selectedMethod)
        );
        const next = TRAINING_METHOD_OPTIONS[(currentIndex + 1) % TRAINING_METHOD_OPTIONS.length];
        selectMethod(next.id);
        return;
      }

      if (nearStation(nodes.upload, 40)) {
        if (!run.selectedActivation || !run.selectedMethod) {
          playSound("warning");
          setNotice("Choose both a training method and an activation before uploading the dataset.", 1.8);
          return;
        }
        if (resources.data <= 0) {
          playSound("warning");
          setNotice("No buffered packets remain. Wait for the module to finalize training.", 1.6);
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
      setNotice("Use the method rack, activation rack, and upload port to build the right training recipe.", 1.8);
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

    const selected = getSelectedActivation();
    const selectedMethod = getSelectedMethod();
    const task = state.run ? state.run.trainingTask : null;
    let recipeBonus = 0;
    let recipeVerdict = null;
    if (selected && selectedMethod && task) {
      const activationCorrect = selected.id === task.recommendedActivation;
      const methodCorrect = selectedMethod.id === task.recommendedMethod;
      if (activationCorrect) recipeBonus += 75;
      if (methodCorrect) recipeBonus += 75;
      if (activationCorrect && methodCorrect) recipeBonus += 50;
      state.resources.score += recipeBonus;
      const idealActivation = ACTIVATION_OPTIONS.find((a) => a.id === task.recommendedActivation);
      const idealMethod = TRAINING_METHOD_OPTIONS.find((m) => m.id === task.recommendedMethod);
      recipeVerdict = {
        correct: activationCorrect && methodCorrect,
        text:
          activationCorrect && methodCorrect
            ? `Optimal recipe: ${selectedMethod.label} + ${selected.label} was the best fit for ${task.label}.`
            : `Suboptimal recipe for ${task.label}: the ideal was ${idealMethod ? idealMethod.label : "?"} + ${idealActivation ? idealActivation.label : "?"}.`,
      };
    }

    state.achievementsThisRun = [];
    checkRunAchievements(victory);

    state.result = {
      victory,
      reason,
      score: state.resources.score,
      training: state.resources.training,
      accuracy: state.resources.accuracy,
      remainingTime: Math.max(0, state.resources.timeLeft),
      lesson,
      recipeBonus,
      recipeVerdict,
      achievementsEarned: [...state.achievementsThisRun],
    };
    state.ui.resultIndex = 0;
  }

  function getMainMenuButtons() {
    const x = BASE_WIDTH / 2 - 180;
    const y = 300;
    const w = 360;
    const h = 54;
    const gap = 12;
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
      {
        id: "codex",
        label: `Knowledge Codex  [${state.achievements.length}/${ACHIEVEMENTS.length}]`,
        rect: { x, y: y + 3 * (h + gap), w, h },
        action: () => {
          state.mode = "codex";
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

  function getCodexButtons() {
    return [
      {
        id: "codex_back",
        label: "Back",
        rect: { x: BASE_WIDTH / 2 - 120, y: 648, w: 240, h: 50 },
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

  function updateCodex() {
    const buttons = getCodexButtons();
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

  function handleTrainingSelectionHotkeys() {
    if (!state.run || state.run.stage !== "training") {
      return;
    }
    const activationBindings = ["Digit1", "Digit2", "Digit3", "Digit4"];
    for (let i = 0; i < activationBindings.length; i++) {
      if (consumePress(activationBindings[i])) {
        selectActivation(ACTIVATION_OPTIONS[i].id);
        return;
      }
    }
    const methodBindings = ["KeyQ", "KeyW", "KeyE", "KeyR"];
    for (let i = 0; i < methodBindings.length; i++) {
      if (consumePress(methodBindings[i])) {
        selectMethod(TRAINING_METHOD_OPTIONS[i].id);
        return;
      }
    }
  }

  function handleTrainingSelectionClick(click) {
    if (!click || !state.run || state.run.stage !== "training") {
      return false;
    }
    const buttons = [...getActivationButtons(), ...getMethodButtons()];
    state.ui.activeButtons = buttons;
    resolveHover(buttons);
    for (const button of buttons) {
      if (isPointInRect(click, button.rect)) {
        if (button.id.startsWith("activation_")) {
          selectActivation(button.id.replace("activation_", ""));
        } else {
          selectMethod(button.id.replace("method_", ""));
        }
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
        if (shard.clean) {
          resources.data += 1;
          run.collectionCaptured += 1;
          resources.score += 6;
          emitParticles(shard.x, shard.y, "133,243,183", 12, 40, 160, 0.42, 5);
          emitRing(shard.x, shard.y, "133,243,183", 10, 60, 0.35);
          playSound("pickup");
        } else {
          run.noisyPacketsCaught += 1;
          resources.score = Math.max(0, resources.score - 4);
          emitParticles(shard.x, shard.y, "255,120,140", 12, 40, 160, 0.42, 5);
          emitRing(shard.x, shard.y, "255,120,140", 10, 60, 0.35);
          playSound("warning");
          setNotice("Corrupted packet caught. Keep the noisy data out of the bag.", 1.2);
        }
        state.shards.splice(i, 1);
        continue;
      }
      if (shard.y > BASE_HEIGHT - 72) {
        state.shards.splice(i, 1);
      }
    }

    if (resources.data >= run.collectionGoal) {
      if (run.autoStageTimer <= 0) {
        run.autoStageTimer = 1.0;
        emitRing(nodes.sorter.x, nodes.sorter.y, "107,214,255", 28, 120, 0.55);
        emitParticles(nodes.sorter.x, nodes.sorter.y, "107,214,255", 18, 44, 180, 0.55, 5);
        playSound("train");
        setNotice("Enough quality data collected. Opening the training module...", 1.1);
      }
      run.autoStageTimer -= dt;
      if (run.autoStageTimer <= 0) {
        resources.stageIndex = 1;
        beginStage("training");
      }
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

    if (run.selectedActivation && run.selectedMethod && resources.training < 100 && nearStation(nodes.upload, 54)) {
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
        const selectedMethod = getSelectedMethod();
        const recommended = ACTIVATION_OPTIONS.find(
          (option) => option.id === run.trainingTask.recommendedActivation
        );
        const recommendedMethod = TRAINING_METHOD_OPTIONS.find(
          (option) => option.id === run.trainingTask.recommendedMethod
        );
        if (resources.accuracy < 50) {
          finishRun(
            false,
            `Deployment failed: accuracy ${Math.round(resources.accuracy)}% is below 50%.`,
            selected && selectedMethod
              ? `${run.trainingTask.label} wanted ${recommendedMethod.label} + ${recommended.label}, but the run used ${selectedMethod.label} + ${selected.label}. The rollout defended well, but the training recipe was still wrong.`
              : `The training recipe was incomplete for ${run.trainingTask.label}, so the model never reached deployment quality.`
          );
        } else {
          finishRun(
            true,
            `Agent deployed with ${Math.round(resources.accuracy)}% accuracy.`,
            selected && selectedMethod && selected.id === recommended.id && selectedMethod.id === recommendedMethod.id
              ? `The ${selectedMethod.label} + ${selected.label} recipe matched the task well enough to survive rollout pressure and ship the model.`
              : `${selectedMethod ? selectedMethod.label : "Your method"} + ${selected ? selected.label : "your activation"} was not ideal for ${run.trainingTask.label}, but strong data quality and rollout defense still carried the model over the deployment threshold.`
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
      const buttons = [...getActivationButtons(), ...getMethodButtons()];
      state.ui.activeButtons = buttons;
      resolveHover(buttons);
      handleTrainingSelectionHotkeys();
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
    if (state.run.stage === "collection") {
      player.vx = horizontal * speed;
      player.vy = 0;
    } else {
      player.vx = moveX * speed;
      player.vy = moveY * speed;
    }

    if (horizontal !== 0 || (vertical !== 0 && state.run.stage !== "collection")) {
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      if (state.run.stage === "collection") {
        player.facingX = horizontal === 0 ? player.facingX : Math.sign(horizontal);
        player.facingY = 0;
      } else {
        player.facingX = moveX;
        player.facingY = moveY;
      }
    } else {
      player.vx = 0;
      player.vy = 0;
    }

    player.x = clamp(player.x, player.r + 24, BASE_WIDTH - player.r - 24);
    if (state.run.stage === "collection") {
      player.y = 592;
    } else {
      player.y = clamp(player.y, player.r + 94, BASE_HEIGHT - player.r - 24);
    }

    resources.compute = clamp(resources.compute + (5.2 + squad * 0.9) * dt, 0, 100);
    resources.timeLeft = Math.max(0, resources.timeLeft - dt);
    player.cooldown = Math.max(0, player.cooldown - dt);

    if (state.run.stage !== "collection" && consumePress("Space")) {
      emitProjectile(player.x + player.facingX * 10, player.y + player.facingY * 10);
    }

    const click = consumePointerClick();
    if (click && !handleTrainingSelectionClick(click) && state.run.stage !== "collection") {
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
    if (state.mode === "codex") {
      updateCodex();
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

  function drawStation(station, color, subtitle, emphasized = false, showText = true) {
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

    if (showText) {
      ctx.fillStyle = "#eaf9ff";
      ctx.font = "700 18px Space Grotesk";
      ctx.textAlign = "center";
      ctx.fillText(station.name, 0, station.r + 34);

      ctx.fillStyle = "#b4d8e7";
      ctx.font = "500 13px Space Grotesk";
      drawWrappedText(subtitle, 0, station.r + 54, 170, 15, "center");
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    if (!p) {
      return;
    }

    if (state.run && state.run.stage === "collection") {
      const groundY = 626;
      ctx.save();
      ctx.translate(p.x, groundY - 32);
      const direction = p.facingX >= 0 ? 1 : -1;
      const walk = Math.sin(state.timeElapsed * 10 + p.x * 0.02) * Math.min(1, Math.abs(p.vx) / 120);
      ctx.scale(direction, 1);

      ctx.fillStyle = "#6f5134";
      ctx.fillRect(-14, 26, 10, 4);
      ctx.fillRect(2, 26, 10, 4);
      ctx.strokeStyle = "#d2f6ff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-2, -4);
      ctx.lineTo(-8, 14 + walk * 6);
      ctx.moveTo(6, -4);
      ctx.lineTo(12, 14 - walk * 6);
      ctx.moveTo(-2, 22);
      ctx.lineTo(-10, 34 - walk * 4);
      ctx.moveTo(8, 22);
      ctx.lineTo(14, 34 + walk * 4);
      ctx.stroke();

      ctx.fillStyle = "#92dfff";
      ctx.beginPath();
      ctx.arc(2, -18, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0fbff";
      ctx.fillRect(-9, -6, 22, 30);

      drawPanel(-22, -2, 20, 18, "rgba(181,255,214,0.9)", "rgba(238,255,245,0.9)", 5, 2);
      ctx.fillStyle = "#123b37";
      ctx.fillRect(-16, 3, 10, 2);
      ctx.fillRect(-16, 8, 8, 2);

      ctx.strokeStyle = "rgba(255,220,120,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.lineTo(28, -6);
      ctx.moveTo(14, 6);
      ctx.lineTo(28, 12);
      ctx.stroke();
      ctx.restore();
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
        drawPanel(
          -13,
          -15,
          26,
          30,
          shard.clean ? "rgba(135,243,183,0.88)" : "rgba(255,145,166,0.88)",
          shard.clean ? "rgba(228,255,240,0.94)" : "rgba(255,235,238,0.92)",
          7,
          2
        );
        ctx.fillStyle = shard.clean ? "rgba(11,57,55,0.82)" : "rgba(74,14,25,0.88)";
        ctx.fillRect(-6, -7, 12, 2.2);
        ctx.fillRect(-6, -1, 10, 2.2);
        ctx.fillRect(-6, 5, 8, 2.2);
        ctx.strokeStyle = shard.clean ? "rgba(187,255,220,0.5)" : "rgba(255,193,206,0.6)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(0, -30 - Math.sin(shard.pulse) * 4);
        ctx.stroke();
        if (!shard.clean) {
          ctx.strokeStyle = "rgba(255,246,248,0.8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-5, -5);
          ctx.lineTo(5, 5);
          ctx.moveTo(5, -5);
          ctx.lineTo(-5, 5);
          ctx.stroke();
        }
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
      nodes.sorter,
      "#9fe6ff",
      resources.data >= run.collectionGoal
        ? "Enough quality data. Switching to training..."
        : `Need ${run.collectionGoal} quality packets.`,
      false
    );

    ctx.strokeStyle = "rgba(153,231,255,0.42)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(96, 626);
    ctx.lineTo(1188, 626);
    ctx.stroke();

    drawPanel(102, 180, 320, 96, "rgba(12,43,64,0.64)", "rgba(126,214,255,0.36)", 18, 2);
    ctx.fillStyle = "#e5faff";
    ctx.font = "700 16px Space Grotesk";
    ctx.fillText("Collection Rule", 124, 210);
    ctx.fillStyle = "#a9d7ea";
    ctx.font = "500 13px Space Grotesk";
    drawWrappedText("Walk under the clean packets and catch them in the bag. Let the corrupted noisy packets fall past you.", 124, 234, 270, 16, "left");

    drawPanel(914, 180, 236, 110, "rgba(11,39,58,0.72)", "rgba(129,213,255,0.34)", 18, 2);
    ctx.fillStyle = "#e8fbff";
    ctx.font = "700 15px Space Grotesk";
    ctx.fillText("Quality Meter", 936, 208);
    ctx.fillStyle = "#9fd8ea";
    ctx.font = "500 13px Space Grotesk";
    ctx.fillText(`Clean packets: ${run.collectionCaptured}`, 936, 234);
    ctx.fillText(`Noisy packets caught: ${run.noisyPacketsCaught}`, 936, 256);
    ctx.fillText(`Goal: ${run.collectionGoal}`, 936, 278);

    drawPanel(934, 296, 196, 18, "rgba(16,56,77,0.82)", "rgba(161,236,255,0.34)", 10, 1.5);
    drawPanel(
      936,
      298,
      clamp((196 * resources.data) / Math.max(1, run.collectionGoal), 0, 196),
      14,
      "rgba(159,255,214,0.85)",
      null,
      8,
      0
    );
  }

  function drawTrainingInterface() {
    const nodes = getStageNodes();
    const run = state.run;
    const projected = Math.round(computeProjectedAccuracy());

    drawPanel(78, 138, 1140, 484, "rgba(6,24,40,0.34)", "rgba(157,225,246,0.18)", 24, 2);
    drawPanel(84, 166, 312, 248, "rgba(11,39,58,0.78)", "rgba(129,213,255,0.34)", 18, 2);
    ctx.fillStyle = "#e7fbff";
    ctx.font = "700 17px Space Grotesk";
    ctx.fillText("Task Requirement", 108, 198);
    ctx.fillStyle = "#d3eff8";
    ctx.font = "700 20px Space Grotesk";
    drawWrappedText(run.trainingTask.label, 108, 228, 254, 22, "left");
    ctx.fillStyle = "#a8d7e7";
    ctx.font = "500 13px Space Grotesk";
    drawWrappedText(run.trainingTask.requirement, 108, 286, 254, 16, "left");
    ctx.fillStyle = "#8cd0e6";
    drawWrappedText(`Activation hint: ${run.trainingTask.clue}`, 108, 348, 254, 16, "left");
    drawWrappedText(`Method hint: ${run.trainingTask.methodClue}`, 108, 394, 254, 16, "left");

    drawStation(nodes.upload, "#77e0ff", "Press E/B to upload the next training batch.", nearStation(nodes.upload, 34));
    drawStation(
      nodes.core,
      "#8cffb0",
      `Projected final accuracy: ${projected}%`,
      nearStation(nodes.core, 34)
    );
    drawStation(nodes.activation, "#ffd37e", "", nearStation(nodes.activation, 34), false);
    drawStation(nodes.method, "#9fd6ff", "", nearStation(nodes.method, 34), false);

    drawPanel(936, 136, 286, 24, "rgba(10,37,57,0.8)", "rgba(255,219,148,0.44)", 10, 1.5);
    ctx.fillStyle = "#f5fbff";
    ctx.font = "700 14px Space Grotesk";
    ctx.fillText("Activation Rack  |  1-4 or click", 954, 152);

    drawPanel(936, 396, 286, 24, "rgba(10,37,57,0.8)", "rgba(173,226,255,0.42)", 10, 1.5);
    ctx.fillStyle = "#f5fbff";
    ctx.font = "700 14px Space Grotesk";
    ctx.fillText("Training Method Rack  |  Q/W/E/R", 954, 412);

    ctx.strokeStyle = "rgba(145, 226, 255, 0.38)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(nodes.upload.x + 70, nodes.upload.y - 28);
    ctx.lineTo(nodes.core.x - 90, nodes.core.y + 24);
    ctx.lineTo(nodes.activation.x - 74, nodes.activation.y - 16);
    ctx.stroke();
    ctx.setLineDash([]);

    const buttons = [...getActivationButtons(), ...getMethodButtons()];
    state.ui.activeButtons = buttons;
    for (const button of buttons) {
      const active = button.id.startsWith("activation_")
        ? state.run.selectedActivation === button.id.replace("activation_", "")
        : state.run.selectedMethod === button.id.replace("method_", "");
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
          ? button.id.startsWith("activation_")
            ? "rgba(255,243,211,0.92)"
            : "rgba(210,240,255,0.92)"
          : hovered
            ? "rgba(182,253,229,0.82)"
            : "rgba(121,190,220,0.52)",
        14,
        active ? 3 : 2
      );
      ctx.fillStyle = "#effbff";
      ctx.font = "700 15px Space Grotesk";
      ctx.fillText(button.label, button.rect.x + 16, button.rect.y + 22);
      ctx.fillStyle = "#a5d8ea";
      ctx.font = "500 11px Space Grotesk";
      drawWrappedText(button.lesson, button.rect.x + 16, button.rect.y + 38, button.rect.w - 28, 13, "left");
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

    let stageChip = `Goal ${getCollectionGoal()} quality packets`;
    if (run.stage === "training") {
      if (run.selectedMethod && run.selectedActivation) {
        stageChip = `${getMethodHudLabel(run.selectedMethod)} + ${getSelectedActivation().label}`;
      } else {
        stageChip = "Recipe pending";
      }
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

    const controlLine = run.stage === "collection"
      ? "Move: Left/Right or A/D  Catch clean packets  Avoid noisy packets  Pause: Esc/P  Fullscreen: F"
      : run.stage === "training"
        ? "Move: Arrows/WASD  Fire: Space/Click  Interact: E/B  Activation: 1-4 or click  Method: Q/W/E/R or click"
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
    ctx.font = "800 62px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Agent Forge", BASE_WIDTH / 2, 182);

    ctx.fillStyle = "#95d9f3";
    ctx.font = "600 24px Space Grotesk";
    ctx.fillText("Model Training Operations", BASE_WIDTH / 2, 220);

    ctx.fillStyle = "#caebf8";
    ctx.font = "500 17px Space Grotesk";
    ctx.fillText(
      "Run a three-level AI pipeline: collect data, configure training, and survive deployment.",
      BASE_WIDTH / 2,
      256
    );

    ctx.fillStyle = "#9cd5ea";
    ctx.font = "500 14px Space Grotesk";
    ctx.fillText(
      "Learn model tradeoffs, activation functions, and rollout defense. Earn badges as you master each concept.",
      BASE_WIDTH / 2,
      278
    );

    const buttons = getMainMenuButtons();
    state.ui.activeButtons = buttons;
    for (let i = 0; i < buttons.length; i++) {
      drawButton(buttons[i], state.ui.mainMenuIndex === i);
    }

    const earned = state.achievements.length;
    const total = ACHIEVEMENTS.length;
    drawPanel(BASE_WIDTH / 2 - 200, 580, 400, 42, "rgba(80,168,204,0.22)", "rgba(156,221,246,0.34)", 12, 1.5);
    ctx.fillStyle = "#e4f9ff";
    ctx.font = "600 15px Space Grotesk";
    ctx.fillText(
      `Achievements: ${earned}/${total}  |  ${getModel().label}  |  ${getDifficulty().label}`,
      BASE_WIDTH / 2,
      606
    );

    ctx.fillStyle = "rgba(188, 228, 246, 0.85)";
    ctx.font = "500 13px Space Grotesk";
    ctx.fillText("Arrow keys + Enter or click. F = fullscreen.", BASE_WIDTH / 2, 636);
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
      "1. Level 1: clean and corrupted packets fall from the source stream.",
      "2. Walk under the clean packets with your data bag and avoid catching the noisy ones.",
      "3. Once enough quality data is collected, the game automatically opens the training page.",
      "4. Level 2: read the scenario card, then choose the right training method and activation.",
      "5. The right recipe depends on the task clues: labels, instructions, teacher outputs, or preferences.",
      "6. Upload the curated data into the training core and watch the projected accuracy change.",
      "7. Level 3: start rollout at the serve gateway and defend deployment quality in production.",
      "",
      "Concept tie-in:",
      "- Data quality gates the whole pipeline. Noisy packets weaken what the model can learn.",
      "- Training methods matter: supervised, instruction, distillation, and preference training fit different data.",
      "- Activation functions matter too: the right non-linearity depends on what the task needs internally.",
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

  function drawCodex() {
    drawBackground();

    drawPanel(28, 52, 1224, 654, "rgba(8,26,38,0.82)", "rgba(169,232,255,0.5)", 24, 2);

    ctx.fillStyle = "#ddfbff";
    ctx.font = "800 46px Syne";
    ctx.textAlign = "center";
    ctx.fillText("Knowledge Codex", BASE_WIDTH / 2, 128);

    ctx.fillStyle = "#9cd5ea";
    ctx.font = "500 16px Space Grotesk";
    ctx.fillText(
      `Your AI learning progress  —  ${state.achievements.length}/${ACHIEVEMENTS.length} achievements earned`,
      BASE_WIDTH / 2,
      158
    );

    ctx.textAlign = "left";

    const leftX = 54;
    const rightX = 668;
    const colW = 566;
    let ly = 190;
    let ry = 190;

    function sectionHeader(x, y, title) {
      ctx.fillStyle = "#7fe8ff";
      ctx.font = "700 15px Space Grotesk";
      ctx.fillText(title, x, y);
      ctx.strokeStyle = "rgba(127,232,255,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x + colW, y + 6);
      ctx.stroke();
      return y + 22;
    }

    function conceptRow(x, y, label, lesson, mastered) {
      const icon = mastered ? "✓" : "·";
      const iconColor = mastered ? "#7bffb0" : "rgba(180,210,230,0.5)";
      ctx.fillStyle = iconColor;
      ctx.font = "700 15px Space Grotesk";
      ctx.fillText(icon, x, y + 14);
      ctx.fillStyle = mastered ? "#e8fbff" : "#8ab8ce";
      ctx.font = "600 14px Space Grotesk";
      ctx.fillText(label, x + 18, y + 14);
      ctx.fillStyle = mastered ? "#9fd5e8" : "rgba(155,195,215,0.6)";
      ctx.font = "500 12px Space Grotesk";
      drawWrappedText(lesson, x + 18, y + 28, colW - 28, 14, "left");
      return y + 46;
    }

    function simpleRow(x, y, label, done) {
      const icon = done ? "✓" : "·";
      ctx.fillStyle = done ? "#7bffb0" : "rgba(180,210,230,0.5)";
      ctx.font = "700 14px Space Grotesk";
      ctx.fillText(icon, x, y + 13);
      ctx.fillStyle = done ? "#e4f9ff" : "#7aa8be";
      ctx.font = "500 13px Space Grotesk";
      ctx.fillText(label, x + 18, y + 13);
      return y + 24;
    }

    ly = sectionHeader(leftX, ly, "Activation Functions");
    for (const opt of ACTIVATION_OPTIONS) {
      ly = conceptRow(
        leftX,
        ly,
        opt.label,
        opt.lesson,
        state.codex.activationsCorrect.includes(opt.id)
      );
    }
    ly += 8;
    ly = sectionHeader(leftX, ly, "Training Methods");
    for (const opt of TRAINING_METHOD_OPTIONS) {
      ly = conceptRow(
        leftX,
        ly,
        opt.label,
        opt.lesson,
        state.codex.methodsCorrect.includes(opt.id)
      );
    }

    ry = sectionHeader(rightX, ry, "Model Families Used");
    for (const m of MODEL_OPTIONS) {
      ry = simpleRow(rightX, ry, `${m.label} (${m.org})`, state.codex.modelsUsed.includes(m.label));
    }
    ry += 10;
    ry = sectionHeader(rightX, ry, "Task Profiles Completed");
    for (const t of TASK_PROFILES) {
      ry = simpleRow(rightX, ry, t.label, state.codex.tasksCompleted.includes(t.id));
    }
    ry += 10;
    ry = sectionHeader(rightX, ry, "Achievements");
    for (const ach of ACHIEVEMENTS) {
      const earned = state.achievements.includes(ach.id);
      const icon = earned ? "✓" : "·";
      ctx.fillStyle = earned ? "#7bffb0" : "rgba(180,210,230,0.5)";
      ctx.font = "700 14px Space Grotesk";
      ctx.fillText(icon, rightX, ry + 13);
      ctx.fillStyle = earned ? "#e4f9ff" : "#6a98ae";
      ctx.font = "600 13px Space Grotesk";
      ctx.fillText(ach.label, rightX + 18, ry + 13);
      ctx.fillStyle = earned ? "#8fcde2" : "rgba(130,175,200,0.5)";
      ctx.font = "500 11px Space Grotesk";
      drawWrappedText(ach.desc, rightX + 18, ry + 26, colW - 28, 13, "left");
      ry += 42;
    }

    const buttons = getCodexButtons();
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
      recipeBonus: 0,
      recipeVerdict: null,
      achievementsEarned: [],
    };

    ctx.fillStyle = "rgba(6, 17, 27, 0.74)";
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    drawPanel(
      262,
      88,
      756,
      564,
      "rgba(10,33,48,0.95)",
      result.victory ? "rgba(174,251,205,0.9)" : "rgba(255,195,196,0.9)",
      24,
      3
    );

    ctx.fillStyle = result.victory ? "#dbffe8" : "#ffe7e7";
    ctx.font = "800 42px Syne";
    ctx.textAlign = "center";
    ctx.fillText(result.victory ? "Deployment Success" : "Run Failed", BASE_WIDTH / 2, 162);

    ctx.fillStyle = "#d6eff9";
    ctx.font = "600 21px Space Grotesk";
    const reasonLineCount = drawWrappedText(result.reason, BASE_WIDTH / 2, 206, 580, 26, "center");

    ctx.fillStyle = "#bfe3f5";
    ctx.font = "500 19px Space Grotesk";
    const metricsStartY = 206 + reasonLineCount * 26 + 18;
    const metricLineHeight = 30;
    ctx.fillText(`Score: ${Math.round(result.score)}${result.recipeBonus > 0 ? ` (+${result.recipeBonus} recipe bonus)` : ""}`, BASE_WIDTH / 2, metricsStartY);
    ctx.fillText(`Accuracy: ${Math.round(result.accuracy)}%`, BASE_WIDTH / 2, metricsStartY + metricLineHeight);
    ctx.fillText(`Training: ${Math.round(result.training)}%`, BASE_WIDTH / 2, metricsStartY + metricLineHeight * 2);
    ctx.fillText(
      `Time Remaining: ${Math.ceil(result.remainingTime)}s`,
      BASE_WIDTH / 2,
      metricsStartY + metricLineHeight * 3
    );

    let cursorY = metricsStartY + metricLineHeight * 3 + 18;

    if (result.recipeVerdict) {
      const verdictColor = result.recipeVerdict.correct
        ? "rgba(19,68,50,0.75)"
        : "rgba(68,19,19,0.75)";
      const verdictBorder = result.recipeVerdict.correct
        ? "rgba(134,255,190,0.7)"
        : "rgba(255,160,160,0.7)";
      drawPanel(BASE_WIDTH / 2 - 270, cursorY, 540, 44, verdictColor, verdictBorder, 12, 2);
      ctx.fillStyle = result.recipeVerdict.correct ? "#b8ffda" : "#ffcfcf";
      ctx.font = "600 13px Space Grotesk";
      const lines = drawWrappedText(
        result.recipeVerdict.correct ? `✓ ${result.recipeVerdict.text}` : `✗ ${result.recipeVerdict.text}`,
        BASE_WIDTH / 2,
        cursorY + 16,
        490,
        16,
        "center"
      );
      cursorY += lines * 16 + 38;
    }

    const lessonText = result.lesson
      ? `Lesson: ${result.lesson}`
      : result.victory
        ? "Lesson: clean data, correct recipe, and defended rollout produced a deployable model."
        : "Lesson: rushed or noisy training left the model below deployment quality.";
    drawPanel(BASE_WIDTH / 2 - 270, cursorY, 540, 48, "rgba(19,58,78,0.72)", null, 14, 0);
    ctx.fillStyle = "#a9dcf0";
    ctx.font = "500 13px Space Grotesk";
    const lessonLineCount = drawWrappedText(lessonText, BASE_WIDTH / 2, cursorY + 14, 500, 16, "center");
    cursorY += lessonLineCount * 16 + 38;

    if (result.achievementsEarned && result.achievementsEarned.length > 0) {
      const achLabels = result.achievementsEarned
        .map((id) => {
          const ach = ACHIEVEMENTS.find((a) => a.id === id);
          return ach ? ach.label : id;
        })
        .join("  ·  ");
      drawPanel(BASE_WIDTH / 2 - 270, cursorY - 4, 540, 36, "rgba(30,80,50,0.72)", "rgba(134,255,190,0.6)", 12, 1.5);
      ctx.fillStyle = "#7bffb0";
      ctx.font = "700 13px Space Grotesk";
      ctx.fillText(`🏆 Unlocked: ${achLabels}`, BASE_WIDTH / 2, cursorY + 14);
      cursorY += 46;
    }

    const buttonStartY = cursorY + 6;
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
    } else if (state.mode === "codex") {
      drawCodex();
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
      noisyPacketsCaught: 0,
      trainingTask: pickTaskProfile(),
      selectedActivation: null,
      selectedMethod: null,
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
        noisy_packets_caught: run.noisyPacketsCaught || 0,
        uploaded_packets: run.uploadedPackets || 0,
        training_budget: run.trainingDataBudget || 0,
        deploy_progress: Math.round(run.deployProgress || 0),
      },
      task_profile: {
        name: run.trainingTask ? run.trainingTask.label : null,
        requirement: run.trainingTask ? run.trainingTask.requirement : null,
        clue: run.trainingTask ? run.trainingTask.clue : null,
        selected_activation: run.selectedActivation,
        selected_method: run.selectedMethod,
        activation_options: ACTIVATION_OPTIONS.map((option) => option.label),
        method_options: TRAINING_METHOD_OPTIONS.map((option) => option.label),
      },
      stage_nodes: Object.fromEntries(
        Object.entries(nodes).map(([key, value]) => [key, { x: Math.round(value.x), y: Math.round(value.y) }])
      ),
      entities: {
        shards: state.shards.slice(0, 8).map((s) => ({
          x: Math.round(s.x),
          y: Math.round(s.y),
          quality: s.clean === false ? "corrupted" : "clean",
        })),
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

  loadPersistentData();

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
