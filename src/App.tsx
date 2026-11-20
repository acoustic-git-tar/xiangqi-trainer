import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './components/Board'
import { EvalBar } from './components/EvalBar'
import { MoveTree } from './components/MoveTree'
import {
  checkWasmThreadsSupport,
  fairyEngine,
  type EngineEval,
} from './engine/fairyStockfish'
import { evaluateInterim } from './engine/interimEval'
import { parseFen, toFen } from './xiangqi/board'
import {
  createTree,
  currentPosition,
  goBack,
  goForward,
  goToNode,
  lastMoveToCurrent,
  playMoveOnTree,
  promoteNode,
  type GameTree,
  type NodeId,
} from './xiangqi/gameTree'
import {
  allLegalMoves,
  inCheck,
  isCheckmate,
  isStalemate,
  legalMovesFrom,
} from './xiangqi/moves'
import type { Move, Square } from './xiangqi/types'

export default function App() {
  const [tree, setTree] = useState<GameTree>(() => createTree())
  const [selected, setSelected] = useState<Square | null>(null)
  const [evaluation, setEvaluation] = useState<EngineEval | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [engineLabel, setEngineLabel] = useState('starting…')
  const [engineReadyTick, setEngineReadyTick] = useState(0)
  /** When true, a new move from a branched position becomes the mainline. */
  const [promoteOnPlay, setPromoteOnPlay] = useState(false)
  const evalGen = useRef(0)

  const position = useMemo(() => currentPosition(tree), [tree])
  const lastMove = useMemo(() => lastMoveToCurrent(tree), [tree])

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

  const runEval = useCallback(async (fen: string) => {
    const gen = ++evalGen.current
    setAnalyzing(true)
    const pos = parseFen(fen)

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
        if (gen === evalGen.current) setEvaluation(result)
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
    void runEval(tree.nodes[tree.currentId].fen)
  }, [tree.currentId, tree.nodes, runEval, engineReadyTick])

  const playMove = (move: Move) => {
    setTree((t) => playMoveOnTree(t, move, { promote: promoteOnPlay }))
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
      if (piece && piece.side === position.sideToMove) {
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
    setTree(createTree())
    setSelected(null)
  }

  const undo = () => {
    setTree((t) => goBack(t))
    setSelected(null)
  }

  const selectNode = (id: NodeId) => {
    setTree((t) => goToNode(t, id))
    setSelected(null)
  }

  const onPromote = (id: NodeId) => {
    setTree((t) => promoteNode(t, id))
  }

  const fen = tree.nodes[tree.currentId].fen
  const canForward = tree.nodes[tree.currentId].childIds.length > 0
  const canBack = tree.nodes[tree.currentId].parentId != null

  // Scaffold for future arrows / multi-PV
  const analysisHooks = useMemo(
    () => ({
      bestMove: evaluation?.bestMove,
      multipv: evaluation?.multipv ?? [],
      legalMoveCount: allLegalMoves(position).length,
      fen: toFen(position),
      nodeId: tree.currentId,
    }),
    [evaluation, position, tree.currentId],
  )

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />
      <header className="top">
        <div className="brand">
          <span className="brand-mark">象棋</span>
          <div className="brand-text">
            <h1>Xiangqi Trainer</h1>
            <p>Play · explore variations · watch the eval</p>
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
              <button type="button" onClick={undo} disabled={!canBack}>
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setTree((t) => goForward(t))
                  setSelected(null)
                }}
                disabled={!canForward}
              >
                Forward
              </button>
            </div>
            <label className="promote-toggle">
              <input
                type="checkbox"
                checked={promoteOnPlay}
                onChange={(e) => setPromoteOnPlay(e.target.checked)}
              />
              New lines overwrite mainline
            </label>
          </div>

          <MoveTree
            tree={tree}
            onSelect={selectNode}
            onPromote={onPromote}
          />

          <div className="side-block">
            <h2>Engine</h2>
            <p className="muted">{engineLabel}</p>
            <p className="fen" title={analysisHooks.fen}>
              {fen}
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
