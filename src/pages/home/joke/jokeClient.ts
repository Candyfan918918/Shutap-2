// Browser-side plumbing for the joke-card surface. Holds no authority: the
// tier, the card text and the export size all come from the server. What
// happens here is only rasterising, packaging and handing the file over.
import { phCapture } from '@/lib/posthog'
import type { JokeTier } from '@/lib/jokes/deck'

const ANON_KEY = 'shutap_anon_id'

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function anonSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const cur = localStorage.getItem(ANON_KEY)
    if (cur) return cur
    const next = uuid()
    localStorage.setItem(ANON_KEY, next)
    return next
  } catch {
    return uuid()
  }
}

export function clearAnonSessionId(): void {
  try { localStorage.removeItem(ANON_KEY) } catch { /* noop */ }
}

/** Every joke event carries the tier. Situation text never rides along. */
export function jokeTrack(name: string, tier: JokeTier, props: Record<string, unknown> = {}): void {
  void phCapture(name, { ...props, tier })
}

/** The public link for a card. Kept for link previews; a share hands over the
 *  picture itself, never this URL. */
export function cardImageUrl(cardId: string): string {
  return `/api/public/joke-card?id=${encodeURIComponent(cardId)}`
}

// ───────────────────────── rasterising ─────────────────────────

/** Draw a server-authored SVG document into a PNG blob at its own size. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
      img.src = blobUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ───────────────────── handing the picture over ─────────────────────
//
// More than one card is more than one PNG — never an archive. A phone gets the
// files through the OS sheet (where "save image" and every app live); anything
// else gets ordinary downloads.

export type NamedBlob = { name: string; blob: Blob }

export function pngFile({ name, blob }: NamedBlob): File {
  return new File([blob], name, { type: 'image/png' })
}

/** True when this browser can hand actual files to the OS share sheet. */
export function canShareFiles(files: File[]): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false
  try {
    return navigator.canShare({ files })
  } catch {
    return false
  }
}

/** A finger, not a mouse — the case where an anchor download misses Photos. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window
}

/** The user closing the OS sheet is not a failure. */
export function isShareAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || /abort|cancel/i.test(e.message))
}

/** Saves each file as its own download, with a gap so browsers keep all of
 *  them instead of swallowing every click after the first. */
export async function saveEach(files: NamedBlob[]): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 300))
    saveBlob(files[i]!.blob, files[i]!.name)
  }
}

/** Last resort on a phone with no file sharing: the picture itself, in a tab,
 *  where a long press reaches the camera roll. */
export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ────────────── the deck a guest left behind at the sign-in gate ──────────────
//
// Signing in is a full-page round trip through /welcome, so the cards they had
// turned over and the thing they were reaching for are written down first and
// picked back up on return.

const PENDING_KEY = 'shutap_joke_pending'
const PENDING_TTL = 24 * 60 * 60 * 1000

export type PendingHeld = {
  set_id: string
  position: number
  angle: string
  text: string
  used_fallback?: boolean
  judge_score?: number | null
}

export type JokePending = {
  set: { id: string; situation: string; archetype: string }
  held: PendingHeld[]
  revealed: string[]
  action: { type: string; position?: number }
  at: number
}

export function writeJokePending(p: Omit<JokePending, 'at'>): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, at: Date.now() }))
  } catch { /* noop */ }
}

export function readJokePending(): JokePending | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as JokePending
    if (!p?.set?.id || !Array.isArray(p.held)) return null
    if (!Number.isFinite(p.at) || Date.now() - p.at > PENDING_TTL) {
      clearJokePending()
      return null
    }
    return p
  } catch {
    return null
  }
}

export function clearJokePending(): void {
  try { localStorage.removeItem(PENDING_KEY) } catch { /* noop */ }
}
