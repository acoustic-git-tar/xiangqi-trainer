import { parseFen, toFen, applyMove } from '../src/xiangqi/board'
import { allLegalMoves, legalMovesFrom, inCheck, isCheckmate } from '../src/xiangqi/moves'
import { START_FEN } from '../src/xiangqi/types'
import { evaluateInterim } from '../src/engine/interimEval'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const start = parseFen(START_FEN)
assert(toFen(start).startsWith('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w'), 'FEN roundtrip prefix')
assert(start.sideToMove === 'red', 'red to move')

const moves = allLegalMoves(start)
// Starting position has 44 legal moves in Xiangqi
assert(moves.length === 44, `expected 44 start moves, got ${moves.length}`)

// Red chariot a0 (file 0 rank 0) — wait, red rook is at file 0 rank 0
const rookMoves = legalMovesFrom(start, { file: 0, rank: 0 })
assert(rookMoves.length === 2, `red left rook should have 2 moves, got ${rookMoves.length}`)

// Move a pawn and ensure eval responds
const pawnMove = moves.find((m) => m.from.file === 0 && m.from.rank === 3 && m.to.rank === 4)
assert(pawnMove, 'expected leftmost red pawn advance')
const next = applyMove(start, pawnMove!)
assert(next.sideToMove === 'black', 'black to move after red')
assert(!inCheck(next, 'red'), 'red should not be in check')
assert(!isCheckmate(next), 'not mate')

const score = evaluateInterim(start)
// Side-to-move mobility tilts slightly; keep it bounded.
assert(Math.abs(score) < 150, `start eval should be near equal, got ${score}`)

console.log('smoke ok', { startMoves: moves.length, startEval: score })
