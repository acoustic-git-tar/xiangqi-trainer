import { allLegalMoves } from '../src/xiangqi/moves'
import {
  createTree,
  currentPosition,
  flattenMainline,
  goToNode,
  playMoveOnTree,
  promoteNode,
} from '../src/xiangqi/gameTree'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

let tree = createTree()
const start = currentPosition(tree)
const moves = allLegalMoves(start)
assert(moves.length === 44, 'start moves')

const m1 = moves.find((m) => m.from.file === 4 && m.from.rank === 3)!
assert(m1, 'center pawn')
tree = playMoveOnTree(tree, m1)
const after1 = tree.currentId

// Continue mainline with a black move
const blackMoves = allLegalMoves(currentPosition(tree))
const b1 = blackMoves.find((m) => m.from.file === 4 && m.from.rank === 6)!
tree = playMoveOnTree(tree, b1)

// Go back to start and play a different red move → variation
tree = goToNode(tree, tree.rootId)
const m2 = moves.find((m) => m.from.file === 0 && m.from.rank === 3)!
assert(m2 && !(m2.from.file === m1.from.file && m2.to.file === m1.to.file), 'alt move')
tree = playMoveOnTree(tree, m2, { promote: false })
assert(tree.nodes[tree.rootId].childIds.length === 2, 'two branches from root')
assert(tree.nodes[tree.rootId].childIds[0] === after1, 'mainline preserved without promote')

// Promote the variation
tree = promoteNode(tree, tree.currentId)
assert(tree.nodes[tree.rootId].childIds[0] === tree.currentId, 'promoted to mainline')

// Overwrite mode from root
tree = goToNode(tree, tree.rootId)
const m3 = moves.find((m) => m.from.file === 8 && m.from.rank === 3)!
tree = playMoveOnTree(tree, m3, { promote: true })
assert(tree.nodes[tree.rootId].childIds[0] === tree.currentId, 'overwrite promotes')

const flat = flattenMainline(tree)
assert(flat.length >= 1, 'flatten has rows')
assert(flat[0].variations.length >= 1, 'variations nested in flatten')

console.log('tree smoke ok', {
  children: tree.nodes[tree.rootId].childIds.length,
  rows: flat.length,
  variations: flat[0].variations.length,
})
