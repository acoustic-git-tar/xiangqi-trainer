import { applyMove, parseFen, toFen, type Position } from './board'
import { formatMoveSan, movesEqual } from './notation'
import { START_FEN, type Move } from './types'

export type NodeId = string

export interface TreeNode {
  id: NodeId
  /** Move that led here from the parent; null for root. */
  move: Move | null
  /** Display label for the move that led here. */
  san: string | null
  fen: string
  parentId: NodeId | null
  /** Children[0] is the mainline continuation. */
  childIds: NodeId[]
}

export interface GameTree {
  nodes: Record<NodeId, TreeNode>
  rootId: NodeId
  currentId: NodeId
}

let seq = 0
function nextId(): NodeId {
  seq += 1
  return `n${seq}`
}

export function createTree(startFen: string = START_FEN): GameTree {
  const id = nextId()
  const root: TreeNode = {
    id,
    move: null,
    san: null,
    fen: startFen,
    parentId: null,
    childIds: [],
  }
  return { nodes: { [id]: root }, rootId: id, currentId: id }
}

export function nodePosition(tree: GameTree, id: NodeId = tree.currentId): Position {
  return parseFen(tree.nodes[id].fen)
}

export function currentPosition(tree: GameTree): Position {
  return nodePosition(tree, tree.currentId)
}

export function lastMoveToCurrent(tree: GameTree): Move | null {
  return tree.nodes[tree.currentId].move
}

function cloneTree(tree: GameTree): GameTree {
  const nodes: Record<NodeId, TreeNode> = {}
  for (const [id, n] of Object.entries(tree.nodes)) {
    nodes[id] = { ...n, childIds: [...n.childIds], move: n.move ? { ...n.move, from: { ...n.move.from }, to: { ...n.move.to } } : null }
  }
  return { nodes, rootId: tree.rootId, currentId: tree.currentId }
}

/**
 * Play a move from the current node.
 * - Existing child with same move → navigate there.
 * - New move → append as a child. If `promote` and there was already a mainline,
 *   the new move becomes children[0] (Lichess-style promote/overwrite of mainline).
 */
export function playMoveOnTree(
  tree: GameTree,
  move: Move,
  opts: { promote?: boolean } = {},
): GameTree {
  const next = cloneTree(tree)
  const cur = next.nodes[next.currentId]
  const pos = parseFen(cur.fen)

  const existing = cur.childIds.find((cid) => {
    const child = next.nodes[cid]
    return child.move && movesEqual(child.move, move)
  })
  if (existing) {
    next.currentId = existing
    return next
  }

  const after = applyMove(pos, move)
  const id = nextId()
  const node: TreeNode = {
    id,
    move,
    san: formatMoveSan(pos, move),
    fen: toFen(after),
    parentId: cur.id,
    childIds: [],
  }
  next.nodes[id] = node

  if (opts.promote && cur.childIds.length > 0) {
    cur.childIds = [id, ...cur.childIds]
  } else {
    cur.childIds = [...cur.childIds, id]
  }
  next.currentId = id
  return next
}

/** Jump to a node (click in move list). */
export function goToNode(tree: GameTree, id: NodeId): GameTree {
  if (!tree.nodes[id]) return tree
  return { ...tree, currentId: id }
}

/** Step back one ply along parent links. */
export function goBack(tree: GameTree): GameTree {
  const cur = tree.nodes[tree.currentId]
  if (!cur.parentId) return tree
  return { ...tree, currentId: cur.parentId }
}

/** Step forward along the mainline child. */
export function goForward(tree: GameTree): GameTree {
  const cur = tree.nodes[tree.currentId]
  if (cur.childIds.length === 0) return tree
  return { ...tree, currentId: cur.childIds[0] }
}

/** Promote a child variation to mainline at its parent. */
export function promoteNode(tree: GameTree, id: NodeId): GameTree {
  const next = cloneTree(tree)
  const node = next.nodes[id]
  if (!node?.parentId) return tree
  const parent = next.nodes[node.parentId]
  parent.childIds = [id, ...parent.childIds.filter((c) => c !== id)]
  return next
}

export interface FlatMoveRow {
  /** Fullmove number (1-based). */
  moveNumber: number
  /** Node for Red's move this ply pair, if any. */
  redId: NodeId | null
  redSan: string | null
  /** Node for Black's move this ply pair, if any. */
  blackId: NodeId | null
  blackSan: string | null
  /** Nested variation starts attached after this row's mainline moves. */
  variations: VariationBlock[]
}

export interface VariationBlock {
  /** Starting node of the variation (first move off mainline). */
  startId: NodeId
  /** Sequential nodes along this variation's own mainline until it ends or branches further. */
  path: Array<{ id: NodeId; san: string; moveNumber: number; isRed: boolean }>
  /** Nested branches off this variation path. */
  nested: VariationBlock[]
}

/**
 * Build a Lichess-like flattened mainline with variations nested in parentheses.
 */
export function flattenMainline(tree: GameTree): FlatMoveRow[] {
  const rows: FlatMoveRow[] = []
  let id: NodeId | null = tree.rootId
  let ply = 0

  while (id) {
    const node: TreeNode = tree.nodes[id]
    const mainChild: NodeId | undefined = node.childIds[0]
    if (!mainChild) break

    const mainNode: TreeNode = tree.nodes[mainChild]
    const isRed = ply % 2 === 0
    const moveNumber = Math.floor(ply / 2) + 1

    if (isRed) {
      rows.push({
        moveNumber,
        redId: mainChild,
        redSan: mainNode.san,
        blackId: null,
        blackSan: null,
        variations: variationsAt(tree, node, mainChild, ply),
      })
    } else {
      const last = rows[rows.length - 1]
      if (last) {
        last.blackId = mainChild
        last.blackSan = mainNode.san
        last.variations = [
          ...last.variations,
          ...variationsAt(tree, node, mainChild, ply),
        ]
      }
    }

    id = mainChild
    ply += 1
  }

  return rows
}

function variationsAt(
  tree: GameTree,
  parent: TreeNode,
  mainChildId: NodeId,
  plyOfMainChild: number,
): VariationBlock[] {
  return parent.childIds
    .filter((cid) => cid !== mainChildId)
    .map((cid) => buildVariation(tree, cid, plyOfMainChild))
}

function buildVariation(
  tree: GameTree,
  startId: NodeId,
  startPly: number,
): VariationBlock {
  const path: VariationBlock['path'] = []
  const nested: VariationBlock[] = []
  let id: NodeId | null = startId
  let ply = startPly

  while (id) {
    const node: TreeNode = tree.nodes[id]
    path.push({
      id,
      san: node.san ?? '…',
      moveNumber: Math.floor(ply / 2) + 1,
      isRed: ply % 2 === 0,
    })
    // Nested variations off this node (siblings of its mainline child)
    if (node.childIds.length > 1) {
      const main: NodeId = node.childIds[0]
      for (const sid of node.childIds.slice(1)) {
        nested.push(buildVariation(tree, sid, ply + 1))
      }
      id = main
    } else {
      id = node.childIds[0] ?? null
    }
    ply += 1
  }

  return { startId, path, nested }
}

/** Path of node ids from root to current (inclusive). */
export function pathToCurrent(tree: GameTree): NodeId[] {
  const path: NodeId[] = []
  let id: NodeId | null = tree.currentId
  while (id) {
    path.unshift(id)
    id = tree.nodes[id].parentId
  }
  return path
}
