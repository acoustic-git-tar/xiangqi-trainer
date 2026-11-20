import type { GameTree, NodeId, VariationBlock } from '../xiangqi/gameTree'
import { flattenMainline } from '../xiangqi/gameTree'

interface Props {
  tree: GameTree
  onSelect: (id: NodeId) => void
  onPromote: (id: NodeId) => void
}

function VariationView({
  block,
  currentId,
  onSelect,
  onPromote,
  depth,
}: {
  block: VariationBlock
  currentId: NodeId
  onSelect: (id: NodeId) => void
  onPromote: (id: NodeId) => void
  depth: number
}) {
  return (
    <span className={`variation depth-${Math.min(depth, 3)}`}>
      <span className="variation-paren">(</span>
      {block.path.map((ply, i) => (
        <span key={ply.id} className="variation-ply">
          {ply.isRed || i === 0 ? (
            <span className="move-num">
              {ply.moveNumber}
              {ply.isRed ? '.' : '…'}
            </span>
          ) : null}
          <button
            type="button"
            className={
              ply.id === currentId ? 'move-san current' : 'move-san'
            }
            onClick={() => onSelect(ply.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              onPromote(ply.id)
            }}
            title="Click to jump · right-click to promote"
          >
            {ply.san}
          </button>
        </span>
      ))}
      {block.nested.map((n) => (
        <VariationView
          key={n.startId}
          block={n}
          currentId={currentId}
          onSelect={onSelect}
          onPromote={onPromote}
          depth={depth + 1}
        />
      ))}
      <span className="variation-paren">)</span>
    </span>
  )
}

export function MoveTree({ tree, onSelect, onPromote }: Props) {
  const rows = flattenMainline(tree)
  const empty = rows.length === 0

  return (
    <div className="move-tree" aria-label="Move history">
      <div className="move-tree-head">
        <h2>Moves</h2>
        <p className="move-tree-hint">
          Click a move to jump · new lines branch · right-click promotes
        </p>
      </div>
      {empty ? (
        <p className="muted move-tree-empty">No moves yet — play from the board.</p>
      ) : (
        <div className="move-tree-body">
          {rows.map((row) => (
            <div key={`m-${row.moveNumber}-${row.redId}`} className="move-row">
              <span className="move-num">{row.moveNumber}.</span>
              {row.redId && row.redSan ? (
                <button
                  type="button"
                  className={
                    row.redId === tree.currentId
                      ? 'move-san current'
                      : 'move-san'
                  }
                  onClick={() => onSelect(row.redId!)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onPromote(row.redId!)
                  }}
                >
                  {row.redSan}
                </button>
              ) : (
                <span className="move-san placeholder">…</span>
              )}
              {row.blackId && row.blackSan ? (
                <button
                  type="button"
                  className={
                    row.blackId === tree.currentId
                      ? 'move-san current'
                      : 'move-san'
                  }
                  onClick={() => onSelect(row.blackId!)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onPromote(row.blackId!)
                  }}
                >
                  {row.blackSan}
                </button>
              ) : (
                <span className="move-san placeholder" />
              )}
              {row.variations.map((v) => (
                <VariationView
                  key={v.startId}
                  block={v}
                  currentId={tree.currentId}
                  onSelect={onSelect}
                  onPromote={onPromote}
                  depth={1}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
