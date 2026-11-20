/** Files 0–8 (a–i), ranks 0–9 (red bottom → black top). */
export type File = number
export type Rank = number

export type Side = 'red' | 'black'

export type PieceKind =
  | 'king'
  | 'advisor'
  | 'elephant'
  | 'horse'
  | 'rook'
  | 'cannon'
  | 'pawn'

export interface Piece {
  side: Side
  kind: PieceKind
}

export interface Square {
  file: File
  rank: Rank
}

export interface Move {
  from: Square
  to: Square
}

export const FILES = 9
export const RANKS = 10

export const PIECE_CHAR: Record<Side, Record<PieceKind, string>> = {
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

export const FEN_LETTER: Record<Side, Record<PieceKind, string>> = {
  red: {
    king: 'K',
    advisor: 'A',
    elephant: 'B',
    horse: 'N',
    rook: 'R',
    cannon: 'C',
    pawn: 'P',
  },
  black: {
    king: 'k',
    advisor: 'a',
    elephant: 'b',
    horse: 'n',
    rook: 'r',
    cannon: 'c',
    pawn: 'p',
  },
}

export const START_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'
