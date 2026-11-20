import { useMemo } from 'react'
import { pieceLabel, type Position } from '../xiangqi/board'
import type { Move, Square } from '../xiangqi/types'
import { FILES, RANKS } from '../xiangqi/types'

interface Props {
  position: Position
  selected: Square | null
  legalTargets: Move[]
  lastMove: Move | null
  onSquareClick: (sq: Square) => void
}

function isTarget(targets: Move[], file: number, rank: number): boolean {
  return targets.some((m) => m.to.file === file && m.to.rank === rank)
}

function isSelected(sel: Square | null, file: number, rank: number): boolean {
  return !!sel && sel.file === file && sel.rank === rank
}

function isLast(
  last: Move | null,
  file: number,
  rank: number,
): boolean {
  if (!last) return false
  return (
    (last.from.file === file && last.from.rank === rank) ||
    (last.to.file === file && last.to.rank === rank)
  )
}

/** Traditional 9×10 point board with river + palace diagonals. */
export function Board({
  position,
  selected,
  legalTargets,
  lastMove,
  onSquareClick,
}: Props) {
  const points = useMemo(() => {
    const list: Array<{ file: number; rank: number }> = []
    for (let rank = 0; rank < RANKS; rank++) {
      for (let file = 0; file < FILES; file++) {
        list.push({ file, rank })
      }
    }
    return list
  }, [])

  // SVG viewBox: pad around the grid of points
  const pad = 28
  const cell = 48
  const width = pad * 2 + cell * (FILES - 1)
  const height = pad * 2 + cell * (RANKS - 1)

  const x = (file: number) => pad + file * cell
  const y = (rank: number) => pad + (RANKS - 1 - rank) * cell

  return (
    <div className="board-shell">
      <svg
        className="board-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Xiangqi board"
      >
        <defs>
          <linearGradient id="boardWood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c9954a" />
            <stop offset="45%" stopColor="#b07835" />
            <stop offset="100%" stopColor="#8f5a22" />
          </linearGradient>
          <pattern
            id="woodGrain"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <rect width="6" height="6" fill="url(#boardWood)" />
            <path
              d="M0 3 H6"
              stroke="rgba(80,40,10,0.08)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx="10"
          fill="url(#woodGrain)"
        />
        <rect
          x={pad - 10}
          y={pad - 10}
          width={cell * (FILES - 1) + 20}
          height={cell * (RANKS - 1) + 20}
          fill="#d4a35a"
          stroke="#5c3214"
          strokeWidth="2.5"
          rx="4"
        />

        {/* Grid lines */}
        {Array.from({ length: RANKS }, (_, rank) => (
          <line
            key={`h-${rank}`}
            x1={x(0)}
            y1={y(rank)}
            x2={x(FILES - 1)}
            y2={y(rank)}
            className="board-line"
          />
        ))}
        {/* Verticals — broken at river except edges */}
        {Array.from({ length: FILES }, (_, file) => {
          if (file === 0 || file === FILES - 1) {
            return (
              <line
                key={`v-${file}`}
                x1={x(file)}
                y1={y(0)}
                x2={x(file)}
                y2={y(RANKS - 1)}
                className="board-line"
              />
            )
          }
          return (
            <g key={`v-${file}`}>
              <line
                x1={x(file)}
                y1={y(0)}
                x2={x(file)}
                y2={y(4)}
                className="board-line"
              />
              <line
                x1={x(file)}
                y1={y(5)}
                x2={x(file)}
                y2={y(RANKS - 1)}
                className="board-line"
              />
            </g>
          )
        })}

        {/* Palace diagonals */}
        <line x1={x(3)} y1={y(0)} x2={x(5)} y2={y(2)} className="board-line" />
        <line x1={x(5)} y1={y(0)} x2={x(3)} y2={y(2)} className="board-line" />
        <line x1={x(3)} y1={y(7)} x2={x(5)} y2={y(9)} className="board-line" />
        <line x1={x(5)} y1={y(7)} x2={x(3)} y2={y(9)} className="board-line" />

        {/* River label */}
        <text
          x={(x(0) + x(FILES - 1)) / 2}
          y={(y(4) + y(5)) / 2 + 5}
          textAnchor="middle"
          className="river-text"
        >
          楚 河　　　　漢 界
        </text>

        {/* Interaction + highlight circles under pieces */}
        {points.map(({ file, rank }) => {
          const cx = x(file)
          const cy = y(rank)
          const selectedHere = isSelected(selected, file, rank)
          const targetHere = isTarget(legalTargets, file, rank)
          const lastHere = isLast(lastMove, file, rank)
          const piece = position.board[rank][file]
          return (
            <g
              key={`${file}-${rank}`}
              className="point"
              onClick={() => onSquareClick({ file, rank })}
              style={{ cursor: 'pointer' }}
            >
              {(selectedHere || lastHere) && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={22}
                  className={selectedHere ? 'hl-selected' : 'hl-last'}
                />
              )}
              {targetHere && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={piece ? 20 : 7}
                  className={piece ? 'hl-capture' : 'hl-move'}
                />
              )}
              {/* Invisible hit area */}
              <circle cx={cx} cy={cy} r={22} fill="transparent" />
              {piece && (
                <g className={`piece piece-${piece.side}`}>
                  <circle cx={cx} cy={cy} r={19} className="piece-disc" />
                  <circle cx={cx} cy={cy} r={16.5} className="piece-ring" />
                  <text
                    x={cx}
                    y={cy + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="piece-glyph"
                  >
                    {pieceLabel(piece)}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
