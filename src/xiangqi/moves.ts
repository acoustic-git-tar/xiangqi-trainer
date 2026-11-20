import {
  applyMove,
  findKing,
  getPiece,
  inBounds,
  opposite,
  type Position,
} from './board'
import type { Move, Piece, Side, Square } from './types'
import { FILES, RANKS } from './types'

function palace(side: Side, file: number, rank: number): boolean {
  if (file < 3 || file > 5) return false
  return side === 'red' ? rank >= 0 && rank <= 2 : rank >= 7 && rank <= 9
}

function crossedRiver(side: Side, rank: number): boolean {
  return side === 'red' ? rank >= 5 : rank <= 4
}

function sameSide(a: Piece | null, side: Side): boolean {
  return !!a && a.side === side
}

function addIfEmptyOrEnemy(
  pos: Position,
  side: Side,
  from: Square,
  file: number,
  rank: number,
  out: Move[],
): boolean {
  if (!inBounds(file, rank)) return false
  const target = pos.board[rank][file]
  if (sameSide(target, side)) return false
  out.push({ from, to: { file, rank } })
  return !target
}

function generatePseudo(pos: Position, from: Square, piece: Piece): Move[] {
  const out: Move[] = []
  const { side, kind } = piece
  const { file, rank } = from

  if (kind === 'king') {
    for (const [df, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nf = file + df
      const nr = rank + dr
      if (!palace(side, nf, nr)) continue
      addIfEmptyOrEnemy(pos, side, from, nf, nr, out)
    }
    return out
  }

  if (kind === 'advisor') {
    for (const [df, dr] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const nf = file + df
      const nr = rank + dr
      if (!palace(side, nf, nr)) continue
      addIfEmptyOrEnemy(pos, side, from, nf, nr, out)
    }
    return out
  }

  if (kind === 'elephant') {
    for (const [df, dr] of [
      [2, 2],
      [2, -2],
      [-2, 2],
      [-2, -2],
    ] as const) {
      const nf = file + df
      const nr = rank + dr
      if (!inBounds(nf, nr)) continue
      // Cannot cross river
      if (side === 'red' && nr > 4) continue
      if (side === 'black' && nr < 5) continue
      const eyeF = file + df / 2
      const eyeR = rank + dr / 2
      if (pos.board[eyeR][eyeF]) continue
      addIfEmptyOrEnemy(pos, side, from, nf, nr, out)
    }
    return out
  }

  if (kind === 'horse') {
    const legs: Array<{
      block: [number, number]
      land: [number, number][]
    }> = [
      {
        block: [0, 1],
        land: [
          [1, 2],
          [-1, 2],
        ],
      },
      {
        block: [0, -1],
        land: [
          [1, -2],
          [-1, -2],
        ],
      },
      {
        block: [1, 0],
        land: [
          [2, 1],
          [2, -1],
        ],
      },
      {
        block: [-1, 0],
        land: [
          [-2, 1],
          [-2, -1],
        ],
      },
    ]
    for (const { block, land } of legs) {
      const bf = file + block[0]
      const br = rank + block[1]
      if (!inBounds(bf, br) || pos.board[br][bf]) continue
      for (const [df, dr] of land) {
        addIfEmptyOrEnemy(pos, side, from, file + df, rank + dr, out)
      }
    }
    return out
  }

  if (kind === 'rook') {
    for (const [df, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      let nf = file + df
      let nr = rank + dr
      while (inBounds(nf, nr)) {
        const cont = addIfEmptyOrEnemy(pos, side, from, nf, nr, out)
        if (!cont) break
        if (pos.board[nr][nf]) break
        nf += df
        nr += dr
      }
    }
    return out
  }

  if (kind === 'cannon') {
    for (const [df, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      let nf = file + df
      let nr = rank + dr
      let jumped = false
      while (inBounds(nf, nr)) {
        const target = pos.board[nr][nf]
        if (!jumped) {
          if (!target) {
            out.push({ from, to: { file: nf, rank: nr } })
          } else {
            jumped = true
          }
        } else if (target) {
          if (target.side !== side) {
            out.push({ from, to: { file: nf, rank: nr } })
          }
          break
        }
        nf += df
        nr += dr
      }
    }
    return out
  }

  if (kind === 'pawn') {
    const forward = side === 'red' ? 1 : -1
    addIfEmptyOrEnemy(pos, side, from, file, rank + forward, out)
    if (crossedRiver(side, rank)) {
      addIfEmptyOrEnemy(pos, side, from, file + 1, rank, out)
      addIfEmptyOrEnemy(pos, side, from, file - 1, rank, out)
    }
    return out
  }

  return out
}

/** Kings facing each other on an open file is illegal for the side that just moved. */
export function flyingGenerals(pos: Position): boolean {
  const red = findKing(pos, 'red')
  const black = findKing(pos, 'black')
  if (!red || !black) return false
  if (red.file !== black.file) return false
  const lo = Math.min(red.rank, black.rank)
  const hi = Math.max(red.rank, black.rank)
  for (let r = lo + 1; r < hi; r++) {
    if (pos.board[r][red.file]) return false
  }
  return true
}

export function isAttackedBy(pos: Position, sq: Square, by: Side): boolean {
  for (let rank = 0; rank < RANKS; rank++) {
    for (let file = 0; file < FILES; file++) {
      const piece = pos.board[rank][file]
      if (!piece || piece.side !== by) continue
      const from = { file, rank }
      const moves = generatePseudo(pos, from, piece)
      if (moves.some((m) => m.to.file === sq.file && m.to.rank === sq.rank)) {
        return true
      }
    }
  }
  // Flying general: opposing king attacks through empty file
  const enemyKing = findKing(pos, by)
  const ourKingSide = opposite(by)
  const ourKing = findKing(pos, ourKingSide)
  if (
    enemyKing &&
    ourKing &&
    enemyKing.file === ourKing.file &&
    sq.file === ourKing.file &&
    sq.rank === ourKing.rank
  ) {
    return flyingGenerals(pos)
  }
  return false
}

export function inCheck(pos: Position, side: Side): boolean {
  const king = findKing(pos, side)
  if (!king) return true
  if (flyingGenerals(pos)) return true
  return isAttackedBy(pos, king, opposite(side))
}

export function legalMovesFrom(pos: Position, from: Square): Move[] {
  const piece = getPiece(pos, from)
  if (!piece || piece.side !== pos.sideToMove) return []
  const pseudo = generatePseudo(pos, from, piece)
  return pseudo.filter((move) => {
    const next = applyMove(pos, move)
    return !inCheck(next, piece.side)
  })
}

export function allLegalMoves(pos: Position): Move[] {
  const moves: Move[] = []
  for (let rank = 0; rank < RANKS; rank++) {
    for (let file = 0; file < FILES; file++) {
      const piece = pos.board[rank][file]
      if (!piece || piece.side !== pos.sideToMove) continue
      moves.push(...legalMovesFrom(pos, { file, rank }))
    }
  }
  return moves
}

export function isCheckmate(pos: Position): boolean {
  return inCheck(pos, pos.sideToMove) && allLegalMoves(pos).length === 0
}

export function isStalemate(pos: Position): boolean {
  return !inCheck(pos, pos.sideToMove) && allLegalMoves(pos).length === 0
}

export function moveToUci(move: Move): string {
  const files = 'abcdefghi'
  return `${files[move.from.file]}${move.from.rank + 1}${files[move.to.file]}${move.to.rank + 1}`
}
