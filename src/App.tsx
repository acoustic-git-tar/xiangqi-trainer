import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './components/Board'
import { EvalBar } from './components/EvalBar'
import {
  checkWasmThreadsSupport,
  fairyEngine,
  type EngineEval,
} from './engine/fairyStockfish'
import {
  evaluateInterim,
} from './engine/interimEval'
import {
  applyMove,
  parseFen,
  toFen,
  type Position,
} from './xiangqi/board'
import {
  allLegalMoves,
  inCheck,
  isCheckmate,
  isStalemate,
  legalMovesFrom,
} from './xiangqi/moves'
import { START_FEN, type Move, type Square } from './xiangqi/types'

export default function App() {
  const [position, setPosition] = useState<Position>(() => parseFen(START_FEN))
  const [selected, setSelected] = useState<Square | null>(null)
  const [lastMove, setLastMove] = useState<Move | null>(null)
  const [evaluation, setEvaluation] = useState<EngineEval | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [engineLabel, setEngineLabel] = useState('starting…')
  const [engineReadyTick, setEngineReadyTick] = useState(0)
  const [history, setHistory] = useState<Position[]>([])
  const evalGen = useRef(0)

  const legalTargets = useMemo(() => {
    if (!selected) return []
    return legalMovesFrom(position, selected)
  }, [position, selected])

  const status = useMemo(() => {
    if (isCheckmate(position)) {
      return position.sideToMove === 'red' ? '黑方勝 — 將死' : '紅方勝 — 將死'
    }
    if (isStalemate(position)) return '和棋 — 困毙'
    if (inCheck(position, position.sideToMove)) {
      return position.sideToMove === 'red' ? '紅方行棋 — 將軍' : '黑方行棋 — 將軍'
    }
    return position.sideToMove === 'red' ? '紅方行棋' : '黑方行棋'
  }, [position])

  const runEval = useCallback(async (pos: Position) => {
    const gen = ++evalGen.current
    setAnalyzing(true)

    const interim: EngineEval = {
      cp: evaluateInterim(pos),
      mate: null,
      depth: 0,
      source: 'interim',
    }
    setEvaluation(interim)

    if (fairyEngine.available) {
      try {
        const result = await fairyEngine.analyze(pos, 500)
        if (gen === evalGen.current) {
          setEvaluation(result)
        }
      } catch {
        // keep interim
      }
    }

    if (gen === evalGen.current) setAnalyzing(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const support = checkWasmThreadsSupport()
      const ok = support.ok ? await fairyEngine.init() : false
      if (cancelled) return
      setEngineLabel(
        ok
          ? 'Fairy-Stockfish WASM'
          : `Interim evaluator — ${support.ok ? 'WASM init failed' : support.reason}`,
      )
      setEngineReadyTick((n) => n + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void runEval(position)
  }, [position, runEval, engineReadyTick])

  const playMove = (move: Move) => {
    setHistory((h) => [...h, position])
    const next = applyMove(position, move)
    setPosition(next)
    setLastMove(move)
    setSelected(null)
  }

  const onSquareClick = (sq: Square) => {
    const piece = position.board[sq.rank][sq.file]

    if (selected) {
      const match = legalTargets.find(
        (m) => m.to.file === sq.file && m.to.rank === sq.rank,
      )
      if (match) {
        playMove(match)
        return
      }
      if (
        piece &&
        piece.side === position.sideToMove &&
        (piece !== position.board[selected.rank][selected.file] ||
          sq.file !== selected.file ||
          sq.rank !== selected.rank)
      ) {
        setSelected(sq)
        return
      }
      setSelected(null)
      return
    }

    if (piece && piece.side === position.sideToMove) {
      setSelected(sq)
    }
  }

  const reset = () => {
    setPosition(parseFen(START_FEN))
    setSelected(null)
    setLastMove(null)
    setHistory([])
  }

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setPosition(prev)
      setSelected(null)
      setLastMove(null)
      return h.slice(0, -1)
    })
  }

  // Scaffold hook for future arrows / multi-PV UI
  const analysisHooks = useMemo(
    () => ({
      bestMove: evaluation?.bestMove,
      multipv: evaluation?.multipv ?? [],
      legalMoveCount: allLegalMoves(position).length,
      fen: toFen(position),
    }),
    [evaluation, position],
  )

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />
      <header className="top">
        <div className="brand">
          <span className="brand-mark">象棋</span>
          <div className="brand-text">
            <h1>Xiangqi Trainer</h1>
            <p>Play · see the evaluation breathe</p>
          </div>
        </div>
        <p className="turn" data-side={position.sideToMove}>
          {status}
        </p>
      </header>

      <main className="stage">
        <EvalBar evaluation={evaluation} analyzing={analyzing} />
        <Board
          position={position}
          selected={selected}
          legalTargets={legalTargets}
          lastMove={lastMove}
          onSquareClick={onSquareClick}
        />
        <aside className="side">
          <div className="side-block">
            <h2>Session</h2>
            <div className="actions">
              <button type="button" onClick={reset}>
                New game
              </button>
              <button type="button" onClick={undo} disabled={history.length === 0}>
                Undo
              </button>
            </div>
          </div>
          <div className="side-block">
            <h2>Engine</h2>
            <p className="muted">{engineLabel}</p>
            <p className="fen" title={analysisHooks.fen}>
              {analysisHooks.fen}
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
