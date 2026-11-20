# Xiangqi Trainer

Chinese Chess (Xiangqi) analysis MVP — traditional board, legal moves, live evaluation.

## Run locally

```bash
npm install
npm run dev      # http://127.0.0.1:5173 (COOP/COEP headers for Fairy-Stockfish)
npm run build && npm run preview
npm run smoke    # rules smoke test
```

## Engine

1. **Fairy-Stockfish WASM** (`fairy-stockfish-nnue.wasm`) when the page is cross-origin isolated (`SharedArrayBuffer` via COOP/COEP). Classical UCI eval for Xiangqi; NNUE net load is scaffolded for later.
2. **Interim evaluator** (material + PST + mobility) when WASM threads are unavailable — always works, updates instantly.

## License

App code GPL-3.0-or-later (bundles Fairy-Stockfish WASM, GPL-3.0).
