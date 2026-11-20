import type { Position } from '../xiangqi/board'
import { allLegalMoves, inCheck } from '../xiangqi/moves'
import type { PieceKind, Side } from '../xiangqi/types'
import { FILES, RANKS } from '../xiangqi/types'

/** Centipawn-ish material values (red-positive). */
const MATERIAL: Record<PieceKind, number> = {
  king: 10000,
  rook: 900,
  cannon: 450,
  horse: 400,
  elephant: 200,
  advisor: 200,
  pawn: 100,
}

/** Rough piece-square bonuses for red; flip for black. */
const PST: Record<PieceKind, number[][]> = {
  king: [
    [0, 0, 0, 8, 10, 8, 0, 0, 0],
    [0, 0, 0, 6, 8, 6, 0, 0, 0],
    [0, 0, 0, 4, 6, 4, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  advisor: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 6, 0, 0, 0, 0],
    [0, 0, 0, 4, 0, 4, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  elephant: [
    [0, 0, 4, 0, 0, 0, 4, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 0, 0, 0, 8, 0, 0, 0, 2],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 4, 0, 0, 0, 4, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  horse: [
    [-4, -2, 0, 2, 2, 2, 0, -2, -4],
    [-2, 2, 6, 8, 8, 8, 6, 2, -2],
    [0, 6, 10, 12, 14, 12, 10, 6, 0],
    [2, 8, 12, 14, 16, 14, 12, 8, 2],
    [4, 10, 14, 16, 18, 16, 14, 10, 4],
    [4, 10, 14, 16, 18, 16, 14, 10, 4],
    [2, 8, 12, 14, 16, 14, 12, 8, 2],
    [0, 6, 10, 12, 14, 12, 10, 6, 0],
    [-2, 2, 6, 8, 8, 8, 6, 2, -2],
    [-4, -2, 0, 2, 2, 2, 0, -2, -4],
  ],
  rook: [
    [4, 6, 8, 10, 12, 10, 8, 6, 4],
    [6, 8, 10, 12, 14, 12, 10, 8, 6],
    [8, 10, 12, 14, 16, 14, 12, 10, 8],
    [10, 12, 14, 16, 18, 16, 14, 12, 10],
    [12, 14, 16, 18, 20, 18, 16, 14, 12],
    [12, 14, 16, 18, 20, 18, 16, 14, 12],
    [10, 12, 14, 16, 18, 16, 14, 12, 10],
    [8, 10, 12, 14, 16, 14, 12, 10, 8],
    [6, 8, 10, 12, 14, 12, 10, 8, 6],
    [4, 6, 8, 10, 12, 10, 8, 6, 4],
  ],
  cannon: [
    [2, 4, 6, 8, 10, 8, 6, 4, 2],
    [4, 6, 8, 10, 12, 10, 8, 6, 4],
    [6, 8, 10, 12, 14, 12, 10, 8, 6],
    [8, 10, 12, 14, 16, 14, 12, 10, 8],
    [10, 12, 14, 16, 18, 16, 14, 12, 10],
    [10, 12, 14, 16, 18, 16, 14, 12, 10],
    [8, 10, 12, 14, 16, 14, 12, 10, 8],
    [6, 8, 10, 12, 14, 12, 10, 8, 6],
    [4, 6, 8, 10, 12, 10, 8, 6, 4],
    [2, 4, 6, 8, 10, 8, 6, 4, 2],
  ],
  pawn: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 0, 4, 0, 6, 0, 4, 0, 2],
    [6, 8, 10, 12, 14, 12, 10, 8, 6],
    [10, 12, 14, 16, 20, 16, 14, 12, 10],
    [14, 16, 18, 20, 24, 20, 18, 16, 14],
    [16, 18, 20, 22, 26, 22, 20, 18, 16],
    [18, 20, 22, 24, 28, 24, 22, 20, 18],
    [20, 22, 24, 26, 30, 26, 24, 22, 20],
  ],
}

function pstBonus(kind: PieceKind, side: Side, file: number, rank: number): number {
  const table = PST[kind]
  const r = side === 'red' ? rank : RANKS - 1 - rank
  return table[r][file]
}

/**
 * Fast interim static evaluator (red-positive centipawns).
 * Used when Fairy-Stockfish WASM threads are unavailable.
 */
export function evaluateInterim(pos: Position): number {
  let score = 0
  for (let rank = 0; rank < RANKS; rank++) {
    for (let file = 0; file < FILES; file++) {
      const piece = pos.board[rank][file]
      if (!piece) continue
      const sign = piece.side === 'red' ? 1 : -1
      score +=
        sign *
        (MATERIAL[piece.kind] + pstBonus(piece.kind, piece.side, file, rank))
    }
  }

  // Mobility for the side to move, offset so equal positions stay near 0
  // (raw move-count would otherwise flip with every ply).
  const moves = allLegalMoves(pos)
  const mobilityDelta = (moves.length - 44) * 1.5
  score += pos.sideToMove === 'red' ? mobilityDelta : -mobilityDelta

  if (inCheck(pos, 'red')) score -= 40
  if (inCheck(pos, 'black')) score += 40

  return Math.round(score)
}

export function formatScore(cp: number, mate?: number | null): string {
  if (mate != null && mate !== 0) {
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`
  }
  const pawns = cp / 100
  const abs = Math.abs(pawns)
  const body = abs >= 10 ? abs.toFixed(1) : abs.toFixed(2)
  if (pawns > 0) return `+${body}`
  if (pawns < 0) return `-${body}`
  return '0.00'
}

/** Map centipawns to 0–1 for the advantage bar (0.5 = equal). */
export function scoreToBar(cp: number): number {
  // Smooth logistic so large advantages saturate near the edges
  const x = cp / 400
  return 1 / (1 + Math.exp(-x))
}
