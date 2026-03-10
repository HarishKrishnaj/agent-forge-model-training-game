# Agent Forge: Model Training Operations

Playable educational web game about AI model operations.

## What You Learn
- Model families used in modern AI ecosystems (Llama, Qwen, Mistral)
- Data vs compute vs alignment tradeoffs
- Why larger model capacity often costs more compute

## Run Locally

```bash
python3 -m http.server 4173 --directory .
```

Open: http://127.0.0.1:4173

## Controls
- Move: Arrow keys / WASD
- Shoot: Space / Click
- Interact: E / B
- Pause: Esc / P / Enter (in run)
- Fullscreen: F (Esc exits fullscreen)

## Tech
- Vanilla HTML/CSS/JavaScript
- Single canvas renderer
- Deterministic test hooks: `window.render_game_to_text`, `window.advanceTime(ms)`
