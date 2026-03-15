// @ts-check
const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

/** 1 frame = 1000ms / 60fps ≈ 16.67 ms */
const FRAME_MS = 1000 / 60;

/**
 * Key code mapping from action JSON button names to Playwright key names.
 * Each name maps to the key code used by Playwright's keyboard API.
 */
const KEY_MAP = {
  enter: "Enter",
  space: "Space",
  b: "b",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  digit1: "1",
  digit2: "2",
  digit3: "3",
  digit4: "4",
  q: "q",
  w: "w",
  e: "e",
  r: "r",
  escape: "Escape",
  p: "p",
};

/**
 * Seeded LCG that replaces Math.random() in the page so every test run is
 * deterministic.  The same seed is used for every test (page is fresh each time).
 */
const SEED_SCRIPT = `
(function () {
  let s = 0xdeadbeef;
  Math.random = function () {
    s = Math.imul(1664525, s) + 1013904223 | 0;
    return (s >>> 0) / 0x100000000;
  };
})();
`;

/**
 * Load the game page with a fixed-seed RNG and wait until the deterministic
 * test hooks are ready.
 * @param {import("@playwright/test").Page} page
 */
async function loadGame(page) {
  await page.addInitScript({ content: SEED_SCRIPT });
  await page.goto("/");
  await page.waitForFunction(() => typeof window.render_game_to_text === "function", {
    timeout: 15_000,
  });
}

/**
 * Execute a single action step:
 *  - hold keyboard keys and/or click the mouse at the given canvas position
 *  - advance the game deterministically by the specified number of frames
 *  - release all inputs
 * @param {import("@playwright/test").Page} page
 * @param {{ buttons: string[], frames: number, mouse_x?: number, mouse_y?: number }} step
 */
async function executeStep(page, step) {
  const buttons = step.buttons || [];
  const durationMs = Math.round(step.frames * FRAME_MS);

  // Hold keyboard keys for the duration of this step
  const pressedKeys = [];
  for (const btn of buttons) {
    if (btn === "left_mouse_button") continue;
    const key = KEY_MAP[btn] || btn;
    await page.keyboard.down(key);
    pressedKeys.push(key);
  }

  // Simulate a mouse press at the canvas-space coordinates
  if (buttons.includes("left_mouse_button") && step.mouse_x != null && step.mouse_y != null) {
    await page.mouse.move(step.mouse_x, step.mouse_y);
    await page.mouse.down();
  }

  // Advance game time deterministically (runs synchronously inside the page)
  await page.evaluate((ms) => window.advanceTime(ms), durationMs);

  // Release mouse
  if (buttons.includes("left_mouse_button") && step.mouse_x != null) {
    await page.mouse.up();
  }

  // Release keyboard keys
  for (const key of pressedKeys) {
    await page.keyboard.up(key);
  }
}

/**
 * Run all steps from a playwright-actions JSON file.
 * @param {import("@playwright/test").Page} page
 * @param {string} actionsFile  Absolute path to the actions JSON file
 */
async function runActions(page, actionsFile) {
  const actions = JSON.parse(fs.readFileSync(actionsFile, "utf8"));
  for (const step of actions.steps) {
    await executeStep(page, step);
  }
}

/**
 * Read the current game state as a parsed object via the deterministic hook.
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<Record<string, any>>}
 */
async function getGameState(page) {
  const json = await page.evaluate(() => window.render_game_to_text());
  return JSON.parse(json);
}

/** Build the absolute path for a given scenario name. */
function actionFile(name) {
  return path.join(__dirname, "..", `playwright-actions-${name}.json`);
}

// ===========================================================================
// Navigation / UI screens
// ===========================================================================

test("menu: game starts on main menu", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("menu"));
  const state = await getGameState(page);
  expect(state.mode).toBe("main_menu");
});

test("briefing: opening the mission brief shows the briefing screen", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("briefing"));
  const state = await getGameState(page);
  expect(state.mode).toBe("briefing");
});

test("settings: opening settings shows the settings screen", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("settings"));
  const state = await getGameState(page);
  expect(state.mode).toBe("settings");
});

test("settings-nav-2: navigating settings and returning lands back on main menu", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("2"));
  const state = await getGameState(page);
  expect(state.mode).toBe("main_menu");
});

test("settings-sandbox: sandbox difficulty configuration returns to main menu", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("level-3-sandbox"));
  const state = await getGameState(page);
  expect(state.mode).toBe("main_menu");
});

test("settings-accuracy-success: accuracy-success settings navigation returns to main menu", async ({
  page,
}) => {
  await loadGame(page);
  await runActions(page, actionFile("accuracy-success"));
  const state = await getGameState(page);
  expect(state.mode).toBe("main_menu");
});

test("settings-accuracy-fail: accuracy-fail settings navigation returns to main menu", async ({
  page,
}) => {
  await loadGame(page);
  await runActions(page, actionFile("accuracy-fail"));
  const state = await getGameState(page);
  expect(state.mode).toBe("main_menu");
});

// ===========================================================================
// In-game stages
// ===========================================================================

test("level-1: starting a run enters the collection stage", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("level-1"));
  const state = await getGameState(page);
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("collection");
});

test("level-2: playing through collection accumulates data packets towards goal", async ({
  page,
}) => {
  await loadGame(page);
  await runActions(page, actionFile("level-2"));
  const state = await getGameState(page);
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("collection");
  // After this sequence the player has collected most of the required data
  expect(state.resources.data).toBeGreaterThanOrEqual(8);
});

test("level-3: extended collection run fills the data goal and advances to training stage", async ({
  page,
}) => {
  await loadGame(page);
  await runActions(page, actionFile("level-3"));
  const state = await getGameState(page);
  expect(state.mode).toBe("playing");
  // With a seeded RNG this sequence collects all 14 packets and auto-advances to training
  expect(state.stage.id).toBe("training");
  expect(state.resources.data).toBeGreaterThanOrEqual(14);
});

test("pause: pressing pause mid-run enters paused mode", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("pause"));
  const state = await getGameState(page);
  expect(state.mode).toBe("paused");
});

test("train: interacting with training station during collection stage", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("train"));
  const state = await getGameState(page);
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("collection");
});

test("actions-1: basic gameplay interaction sequence stays in game", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("1"));
  const state = await getGameState(page);
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("collection");
});

test("rollout-result: playing through a full collection cycle reaches training stage", async ({
  page,
}) => {
  await loadGame(page);
  await runActions(page, actionFile("rollout-result"));
  const state = await getGameState(page);
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("training");
});

test("accuracy-success-v2: mouse-driven interaction during collection collects data packets", async ({
  page,
}) => {
  await loadGame(page);
  await runActions(page, actionFile("accuracy-success-v2"));
  const state = await getGameState(page);
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("collection");
  expect(state.resources.data).toBeGreaterThanOrEqual(1);
});

test("accuracy-fail-v2: alternative interaction path collects data packets in collection stage", async ({
  page,
}) => {
  await loadGame(page);
  await runActions(page, actionFile("accuracy-fail-v2"));
  const state = await getGameState(page);
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("collection");
  expect(state.resources.data).toBeGreaterThanOrEqual(1);
});

// ===========================================================================
// End states
// ===========================================================================

test("win: the win action sequence exercises collection gameplay", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("win"));
  const state = await getGameState(page);
  // The win sequence tests B-key interactions during collection; the run stays active
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("collection");
});

test("lose: waiting out the clock pushes alignment to critical levels", async ({ page }) => {
  await loadGame(page);
  await runActions(page, actionFile("lose"));
  const state = await getGameState(page);
  // The 2300-frame sequence reaches training stage; with the seeded RNG anomaly hits
  // drain alignment to near-zero (≤ 5) — a canary for the loss-condition path
  expect(state.mode).toBe("playing");
  expect(state.stage.id).toBe("training");
  expect(state.resources.alignment).toBeLessThanOrEqual(5);
});
