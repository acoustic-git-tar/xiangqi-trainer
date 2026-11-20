import {
  FILES,
  FEN_LETTER,
  RANKS,
  START_FEN,
  type File,
  type Move,
  type Piece,
  type PieceKind,
  type Rank,
  type Side,
  type Square,
} from './types'

export type BoardGrid = (Piece | null)[][]

export interface Position {
  board: BoardGrid
  sideToMove: Side
  halfmove: number
  fullmove: number
}

const LETTER_TO_PIECE: Record<string, Piece> = {
  K: { side: 'red', kind: 'king' },
  A: { side: 'red', kind: 'advisor' },
  B: { side: 'red', kind: 'elephant' },
  N: { side: 'red', kind: 'horse' },
  R: { side: 'red', kind: 'rook' },
  C: { side: 'red', kind: 'cannon' },
  P: { side: 'red', kind: 'pawn' },
  k: { side: 'black', kind: 'king' },
  a: { side: 'black', kind: 'advisor' },
  b: { side: 'black', kind: 'elephant' },
  n: { side: 'black', kind: 'horse' },
  r: { side: 'black', kind: 'rook' },
  c: { side: 'black', kind: 'cannon' },
  p: { side: 'black', kind: 'pawn' },
}

export function emptyBoard(): BoardGrid {
  return Array.from({ length: RANKS }, () =>
    Array.from({ length: FILES }, () => null),
  )
}

export function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map((row) => row.slice())
}

export function sqKey(s: Square): string {
  return `${s.file},${s.rank}`
}

export function inBounds(file: File, rank: Rank): boolean {
  return file >= 0 && file < FILES && rank >= 0 && rank < RANKS
}

export function getPiece(pos: Position, sq: Square): Piece | null {
  if (!inBounds(sq.file, sq.rank)) return null
  return pos.board[sq.rank][sq.file]
}

export function opposite(side: Side): Side {
  return side === 'red' ? 'black' : 'red'
}

export function parseFen(fen: string = START_FEN): Position {
  const parts = fen.trim().split(/\s+/)
  const rows = parts[0].split('/')
  if (rows.length !== RANKS) {
    throw new Error(`Invalid FEN: expected ${RANKS} ranks`)
  }

  const board = emptyBoard()
  // FEN lists black's side first (rank 9 → rank 0)
  for (let fenRank = 0; fenRank < RANKS; fenRank++) {
    const rank = RANKS - 1 - fenRank
    let file = 0
    for (const ch of rows[fenRank]) {
      if (ch >= '1' && ch <= '9') {
        file += Number(ch)
      } else {
        const piece = LETTER_TO_PIECE[ch]
        if (!piece) throw new Error(`Invalid FEN piece: ${ch}`)
        if (file >= FILES) throw new Error('Invalid FEN: file overflow')
        board[rank][file] = { ...piece }
        file += 1
      }
    }
    if (file !== FILES) throw new Error('Invalid FEN: incomplete rank')
  }

  const sideToMove: Side = parts[1] === 'b' ? 'black' : 'red'
  const halfmove = parts[4] ? Number(parts[4]) : 0
  const fullmove = parts[5] ? Number(parts[5]) : 1

  return { board, sideToMove, halfmove, fullmove }
}

export function toFen(pos: Position): string {
  const rows: string[] = []
  for (let fenRank = 0; fenRank < RANKS; fenRank++) {
    const rank = RANKS - 1 - fenRank
    let empty = 0
    let row = ''
    for (let file = 0; file < FILES; file++) {
      const piece = pos.board[rank][file]
      if (!piece) {
        empty += 1
      } else {
        if (empty) {
          row += String(empty)
          empty = 0
        }
        row += FEN_LETTER[piece.side][piece.kind]
      }
    }
    if (empty) row += String(empty)
    rows.push(row)
  }
  const stm = pos.sideToMove === 'red' ? 'w' : 'b'
  return `${rows.join('/')} ${stm} - - ${pos.halfmove} ${pos.fullmove}`
}

export function applyMove(pos: Position, move: Move): Position {
  const board = cloneBoard(pos.board)
  const piece = board[move.from.rank][move.from.file]
  if (!piece) throw new Error('No piece on from-square')
  board[move.to.rank][move.to.file] = piece
  board[move.from.rank][move.from.file] = null

  const captured = pos.board[move.to.rank][move.to.file]
  const halfmove = captured || piece.kind === 'pawn' ? 0 : pos.halfmove + 1
  const fullmove =
    pos.sideToMove === 'black' ? pos.fullmove + 1 : pos.fullmove

  return {
    board,
    sideToMove: opposite(pos.sideToMove),
    halfmove,
    fullmove,
  }
}

export function findKing(pos: Position, side: Side): Square | null {
  for (let rank = 0; rank < RANKS; rank++) {
    for (let file = 0; file < FILES; file++) {
      const p = pos.board[rank][file]
      if (p && p.side === side && p.kind === 'king') {
        return { file, rank }
      }
    }
  }
  return null
}

export function squareEquals(a: Square, b: Square): boolean {
  return a.file === b.file && a.rank === b.rank
}

export function pieceLabel(piece: Piece): string {
  const map: Record<Side, Record<PieceKind, string>> = {
    red: {
      king: '帥',
      advisor: '仕',
      elephant: '相',
      horse: '傌',
      rook: '俥',
      cannon: '炮',
      pawn: '兵',
    },
    black: {
      king: '將',
      advisor: '士',
      elephant: '象',
      horse: '馬',
      rook: '車',
      cannon: '包',
      pawn: '卒',
    },
  }
  return map[piece.side][piece.kind]
}
