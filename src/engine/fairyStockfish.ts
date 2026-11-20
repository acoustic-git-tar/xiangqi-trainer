import { toFen, type Position } from '../xiangqi/board'

export type EngineSource = 'fairy-stockfish' | 'interim'

export interface EngineEval {
  /** Red-positive centipawns. */
  cp: number
  mate: number | null
  depth: number
  source: EngineSource
  bestMove?: string
  /** Scaffold for multi-PV UI later. */
  multipv?: string[]
}

type LineHandler = (line: string) => void

interface StockfishInstance {
  postMessage: (cmd: string) => void
  addMessageListener: (cb: LineHandler) => void
}

declare global {
  interface Window {
    Stockfish?: (opts?: {
      locateFile?: (path: string) => string
    }) => Promise<StockfishInstance>
  }
}

export type WasmSupport =
  | { ok: true }
  | { ok: false; reason: string }

export function checkWasmThreadsSupport(): WasmSupport {
  try {
    if (typeof WebAssembly !== 'object') {
      return { ok: false, reason: 'WebAssembly unavailable' }
    }
    if (typeof SharedArrayBuffer !== 'function') {
      return {
        ok: false,
        reason: 'SharedArrayBuffer unavailable (serve with COOP/COEP)',
      }
    }
    if (typeof Atomics !== 'object') {
      return { ok: false, reason: 'Atomics unavailable' }
    }
    const memory = new WebAssembly.Memory({
      shared: true,
      initial: 1,
      maximum: 2,
    })
    if (!(memory.buffer instanceof SharedArrayBuffer)) {
      return { ok: false, reason: 'SharedArrayBuffer not usable' }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'WASM threads blocked',
    }
  }
}

function wasmThreadsSupported(): boolean {
  return checkWasmThreadsSupport().ok
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Stockfish) {
      resolve()
      return
    }
    const existing = document.querySelector(
      `script[data-fsf-src="${src}"]`,
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Fairy-Stockfish')),
        { once: true },
      )
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.fsfSrc = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Fairy-Stockfish'))
    document.head.appendChild(script)
  })
}

function parseInfo(line: string): Partial<EngineEval> | null {
  if (!line.startsWith('info ')) return null
  const multipvMatch = line.match(/\bmultipv (\d+)/)
  const multipv = multipvMatch ? Number(multipvMatch[1]) : 1
  if (multipv !== 1) return null

  const depthMatch = line.match(/\bdepth (\d+)/)
  const mateMatch = line.match(/\bscore mate (-?\d+)/)
  const cpMatch = line.match(/\bscore cp (-?\d+)/)
  const pvMatch = line.match(/\bpv (.+)$/)
  if (!mateMatch && !cpMatch) return null

  const depth = depthMatch ? Number(depthMatch[1]) : 0
  let cp = 0
  let mate: number | null = null
  if (mateMatch) {
    mate = Number(mateMatch[1])
    cp = mate > 0 ? 100000 - mate * 100 : -100000 - mate * 100
  } else if (cpMatch) {
    cp = Number(cpMatch[1])
  }

  return {
    cp,
    mate,
    depth,
    bestMove: pvMatch?.[1]?.trim().split(/\s+/)[0],
    multipv: pvMatch ? [pvMatch[1]] : [],
  }
}

function toRedPositive(
  score: EngineEval,
  sideToMove: 'red' | 'black',
): EngineEval {
  if (sideToMove === 'red') return score
  return {
    ...score,
    cp: -score.cp,
    mate: score.mate == null ? null : -score.mate,
  }
}

export class FairyStockfishEngine {
  private engine: StockfishInstance | null = null
  private ready = false
  private wired = false
  private handlers = new Set<LineHandler>()
  private chain: Promise<unknown> = Promise.resolve()

  get available(): boolean {
    return this.ready
  }

  private dispatch = (line: string) => {
    for (const h of [...this.handlers]) h(line)
  }

  async init(): Promise<boolean> {
    if (this.ready) return true
    if (!wasmThreadsSupported()) return false

    try {
      await loadScript('/engine/stockfish.js')
      if (typeof window.Stockfish !== 'function') return false

      this.engine = await window.Stockfish({
        locateFile: (path) => `/engine/${path}`,
      })
      if (!this.wired) {
        this.engine.addMessageListener(this.dispatch)
        this.wired = true
      }

      await this.waitFor('uci', (l) => l === 'uciok', 10000)
      this.engine.postMessage('setoption name UCI_Variant value xiangqi')
      await this.waitFor('isready', (l) => l === 'readyok', 10000)
      this.ready = true
      return true
    } catch {
      this.engine = null
      this.ready = false
      return false
    }
  }

  private waitFor(
    command: string,
    pred: (line: string) => boolean,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.engine) {
        reject(new Error('Engine missing'))
        return
      }
      const timer = window.setTimeout(() => {
        this.handlers.delete(handler)
        reject(new Error(`Timeout waiting after ${command}`))
      }, timeoutMs)
      const handler: LineHandler = (line) => {
        if (pred(line)) {
          clearTimeout(timer)
          this.handlers.delete(handler)
          resolve()
        }
      }
      this.handlers.add(handler)
      this.engine.postMessage(command)
    })
  }

  analyze(pos: Position, movetime = 450): Promise<EngineEval> {
    const run = async (): Promise<EngineEval> => {
      if (!this.engine || !this.ready) throw new Error('Engine not ready')

      let latest: EngineEval = {
        cp: 0,
        mate: null,
        depth: 0,
        source: 'fairy-stockfish',
      }

      return await new Promise<EngineEval>((resolve) => {
        const timer = window.setTimeout(() => {
          this.engine?.postMessage('stop')
          this.handlers.delete(handler)
          resolve(toRedPositive(latest, pos.sideToMove))
        }, movetime + 2000)

        const handler: LineHandler = (line) => {
          const parsed = parseInfo(line)
          if (parsed && (parsed.depth ?? 0) >= latest.depth) {
            latest = {
              cp: parsed.cp ?? 0,
              mate: parsed.mate ?? null,
              depth: parsed.depth ?? 0,
              source: 'fairy-stockfish',
              bestMove: parsed.bestMove,
              multipv: parsed.multipv,
            }
          }
          if (line.startsWith('bestmove')) {
            clearTimeout(timer)
            this.handlers.delete(handler)
            resolve(toRedPositive(latest, pos.sideToMove))
          }
        }

        this.handlers.add(handler)
        this.engine!.postMessage('stop')
        this.engine!.postMessage(`position fen ${toFen(pos)}`)
        this.engine!.postMessage(`go movetime ${movetime}`)
      })
    }

    const result: Promise<EngineEval> = this.chain.then(run, run)
    this.chain = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  stop() {
    this.engine?.postMessage('stop')
  }
}

export const fairyEngine = new FairyStockfishEngine()
