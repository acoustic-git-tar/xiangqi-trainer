import { formatScore, scoreToBar } from '../engine/interimEval'
import type { EngineEval } from '../engine/fairyStockfish'

interface Props {
  evaluation: EngineEval | null
  analyzing: boolean
}

export function EvalBar({ evaluation, analyzing }: Props) {
  const cp = evaluation?.cp ?? 0
  const mate = evaluation?.mate ?? null
  const fill = scoreToBar(cp)
  const label = evaluation ? formatScore(cp, mate) : '—'

  return (
    <div className="eval-panel" aria-live="polite">
      <div className="eval-score">
        <span className="eval-score-value">{label}</span>
        <span className="eval-score-meta">
          {analyzing
            ? 'analyzing…'
            : evaluation
              ? evaluation.source === 'fairy-stockfish'
                ? `d${evaluation.depth} · Fairy-Stockfish`
                : 'interim eval'
              : 'idle'}
        </span>
      </div>
      <div
        className="eval-bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
        aria-label="Position advantage for Red"
      >
        <div className="eval-bar-track">
          <div
            className="eval-bar-fill"
            style={{ height: `${fill * 100}%` }}
          />
        </div>
        <div className="eval-bar-labels">
          <span>紅</span>
          <span>黑</span>
        </div>
      </div>
    </div>
  )
}
