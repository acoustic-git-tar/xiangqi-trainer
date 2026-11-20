import { getPiece, type Position } from './board'
import { moveToUci } from './moves'
import type { Move } from './types'
import { PIECE_CHAR } from './types'

const FILES = '九八七六五四三二一'
const FILES_BLACK = '１２３４５６７８９'
const RANKS_RED = '一二三四五六七八九十'
const RANKS_BLACK = '１２３４５６７８９１０'

function fileLabel(side: 'red' | 'black', file: number): string {
  // Red files numbered from right (file 8 = 一 … file 0 = 九)
  if (side === 'red') return FILES[file] ?? String(file)
  return FILES_BLACK[file] ?? String(file)
}

/** Compact Chinese-ish move label for the tree (with UCI fallback). */
export function formatMoveSan(posBefore: Position, move: Move): string {
  const piece = getPiece(posBefore, move.from)
  if (!piece) return moveToUci(move)
  const char = PIECE_CHAR[piece.side][piece.kind]
  const fromFile = fileLabel(piece.side, move.from.file)
  const toFile = fileLabel(piece.side, move.to.file)

  const forward = piece.side === 'red' ? 1 : -1
  const rankDelta = (move.to.rank - move.from.rank) * forward

  if (rankDelta === 0) {
    return `${char}${fromFile}平${toFile}`
  }
  if (move.from.file === move.to.file) {
    const table = piece.side === 'red' ? RANKS_RED : RANKS_BLACK
    const steps = Math.abs(move.to.rank - move.from.rank)
    const amount = table[steps - 1] ?? String(steps)
    return `${char}${fromFile}${rankDelta > 0 ? '进' : '退'}${amount}`
  }
  // Horse / elephant / advisor diagonal-ish
  return `${char}${fromFile}${rankDelta > 0 ? '进' : '退'}${toFile}`
}

export function movesEqual(a: Move, b: Move): boolean {
  return (
    a.from.file === b.from.file &&
    a.from.rank === b.from.rank &&
    a.to.file === b.to.file &&
    a.to.rank === b.to.rank
  )
}
