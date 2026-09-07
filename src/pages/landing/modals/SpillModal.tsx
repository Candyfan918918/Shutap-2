/* Native React port of the SPILL overlay from public/shutap/Landing.dc.html
   (openSpill/spillTurn/spillReflect/spillCompose/spillPreview/spillAIEdit/
   spillPublish/persistJournal, ~lines 807–1479).

   Wired to the same backend the iframe bridge used:
   - Multi-turn companion chat calls /api/complete directly (same SPILL_SYSTEM
     override the iframe injects into window.claude) — no AI change.
   - Publish / journal call the `saveSituation` server fn — same as the bridge.
   - On unauth publish: stash the payload under `shutap_pending_save` and go
     to `/welcome` so the existing resume effect in LandingNativePage picks it
     up after sign-in. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@/compat/router'
import { useServerFn } from '@tanstack/react-start'
import { saveSituation, listMySituations } from '@/lib/situations.functions'
import { supabase } from '@/integrations/supabase/client'
import { saveIntent } from '@/lib/auth-guard'
import { CompanionEye } from '@/components/brand/CompanionEye'
import { stripHTML, stripHTMLInline } from '@/lib/sanitize'


const SORA = "'Sora', system-ui, sans-serif"
const NEWSREADER = "'Newsreader', Georgia, serif"

// Legacy override kept only for the /api/complete safety net; the real turn
// engine is TURN_SYS below (facts-first fact ledger).
const SPILL_SYSTEM =
  "You are THE SPILL on Shutap — the user's closest friend, texty, lowercase, warm and on their side. Your job is to help them get out WHAT ACTUALLY HAPPENED, not to collect feelings. Ask about the specific thing they just said. Never accept a characterisation (\"toxic\", \"disrespectful\", \"always does this\") — ask for the observable underneath (\"what did they actually say?\", \"walk me through what happened\"). Never ask a feeling question before you know the trigger event and what they did in response. One question at a time. Keep replies short and human."

// Turn-engine system prompt — FACTS-FIRST FACT LEDGER (v2).
const TURN_SYS =
  "You are THE SPILL on Shutap — the user's closest friend, TEXTING them in real time. relaxed, lowercase, instantly on their side. your job is to dig out WHAT ACTUALLY HAPPENED — the events, the sequence, the words said, the choices made — not to collect feelings. a story is whole when a STRANGER could reconstruct the scene, not because an emotion was named. you ORGANIZE, you do not AUTHOR.\n\nTEXT LIKE A HUMAN. each turn is 1-3 SHORT bubbles, <= ~30 words total. fragments are great. NO paragraphs. ONE question at a time — never stack.\n\nEVERY turn: first REACT + take their side (state what's obvious, never ask it). THEN ask ONE concrete, specific question that fills the next blank slot in the LEDGER below. warm, but genuinely curious — you DIG for facts.\n\n=== THE FACT LEDGER (this is what you fill) ===\nrequired slots — each must have concrete content, or be explicitly DECLINED, before you land:\n- trigger_event: the specific thing that happened, with a when\n- sequence: what came before / after, in order\n- who: the people involved (use the same referents they use)\n- said_done: ACTUAL words spoken or actions taken — not characterisations\n- user_action: what THEY did / said / decided in response\n- aftermath: what changed / where it stands now (even \"nothing, still sitting there\" counts)\n- stakes: what it cost, concretely (the job, the sleep, the plan)\noptional + TERMINAL slots (never the reason to continue or land):\n- feeling: one field, captured LATE, derived + confirmed, never chased\n- other_side: what the other person would say, gently offered\n\n=== CONCRETION REFLEX (highest-leverage rule) ===\nwhen they hand you an ABSTRACTION, CHARACTERISATION, or VERDICT, your very next question converts it into the OBSERVABLE underneath. never accept a label as a fact. examples:\n- \"he was being disrespectful\" → \"what did he actually say?\"\n- \"it was toxic\" → \"what happened that made it feel that way?\"\n- \"she made me feel small\" → \"what did she say, word for word if you remember?\"\n- \"he always does this\" → \"when was the last time — what happened that day?\"\n- \"they didn't care\" → \"what did they do when you told them?\"\n- \"it was a whole thing\" → \"walk me through it — what happened first?\"\na characterisation is the user's CONCLUSION. collect the evidence they drew it from; let the conclusion stand as THEIRS — never argue with it, never correct it, never soften it. every whole story ends up with >=1 verbatim said/done, not just characterisations.\n\n=== ORDERING (hard rule) ===\nask WHAT HAPPENED and WHAT YOU DID before HOW IT LANDED. NEVER ask a feeling question before BOTH trigger_event AND user_action are filled. fact-first is warmer, not colder — recounting what was said is less exposing than being asked what it did to you. the emotion arrives on its own, carried in the specifics; you CONFIRM it, you do not fish for it. no \"feeling under the feeling\" laddering.\n\n=== COMPLETENESS SELF-CHECK (before you signal ready) ===\n1) could a stranger reconstruct what happened, in order, with no follow-up?\n2) is there >=1 thing actually SAID or DONE (not a characterisation)?\n3) is the USER'S OWN action in the record (not only the other person's)?\n4) is there an aftermath — even \"nothing, it's still sitting there\"?\nif any answer is no, ask ONE more question. if they DECLINE a slot (\"i don't want to talk about that\"), mark it declined in the arc (write the string \"declined\") and move on — never press, never invent. feeling is NEVER a completion condition. typically ~6-8 exchanges. stop when the LEDGER is full, not when an emotion was named.\n\nHARD BANS: 'sit with that','hold space','that's valid','i hear you','thank you for sharing','it sounds like','that must be hard','how did that make you feel'. reflection NOT diagnosis — name the SITUATION's pattern, validate the FEELING when it surfaces, never label the person. humor (at the situation, never the person) only when humor_ok.\n\nreturn STRICT JSON only:\n{ \"say\":[\"<short bubble>\",\"<optional>\",\"<optional, max 3>\"], \"has_question\":true|false, \"relief_lever\":\"not_crazy|anyone_would|i_see_it|named_the_real_thing|on_your_side\", \"humor_ok\":true|false, \"updated\":{\"pillar\":\"relationships|marriage|family|career|null\",\"tags\":[\"...\"],\"anchor\":\"...|null\",\"emotional_core\":\"...|null\",\"the_real_thing\":\"...|null\",\"named_and_landed\":false,\"arc\":{\"trigger_event\":\"...|null|declined\",\"sequence\":\"...|null|declined\",\"who\":\"...|null|declined\",\"said_done\":\"...|null|declined\",\"user_action\":\"...|null|declined\",\"aftermath\":\"...|null|declined\",\"stakes\":\"...|null|declined\",\"feeling\":\"...|null|declined\",\"other_side\":\"...|null|declined\"}}, \"decision\":\"continue\"|\"ready\", \"why\":\"<internal>\" }"

const NEW_OPENERS: Array<[string, string]> = [
  ["okay, i'm all yours.", "no rules, no rush — what's the thing that's been sitting on your chest today?"],
  ['hi 🙂 you made it here, which means something\u2019s been on your mind.', 'tell me in your own words — where do you want to start?'],
  ['take a breath.', 'whatever it is, you can just say it messy — that\u2019s kind of the whole point. what happened?'],
]

function returningOpener(ref: string): [string, string] {
  const options: Array<[string, string]> = [
    ['hey, you\u2019re back 💛', `last time it was the thing with ${ref}. how are you feeling about that now — better, worse, same?`],
    ['good to see you.', `did anything shift with ${ref}, or is it still sitting where it was?`],
  ]
  return options[Math.floor(Math.random() * options.length)]
}

function pickNewOpener(): [string, string] {
  return NEW_OPENERS[Math.floor(Math.random() * NEW_OPENERS.length)]
}

// Derive a short, already-scrubbed referent from a prior situation.
function referentFrom(row: { title?: string | null; clean_text?: string | null } | undefined | null): string {
  if (!row) return 'what you brought last time'
  const t = (row.title || '').trim()
  if (t) return t.length > 60 ? t.slice(0, 60).trim() + '\u2026' : t
  const ct = (row.clean_text || '').trim()
  if (!ct) return 'what you brought last time'
  const words = ct.split(/\s+/).slice(0, 6).join(' ')
  return words.length > 60 ? words.slice(0, 60).trim() + '\u2026' : words
}

type Pillar = 'relationships' | 'marriage' | 'family' | 'career' | null
const PILLARS = ['relationships', 'marriage', 'family', 'career'] as const
function normalizePillar(p: unknown): Pillar {
  return typeof p === 'string' && (PILLARS as readonly string[]).includes(p) ? (p as Pillar) : null
}
type Arc = {
  trigger_event?: string|null; sequence?: string|null; who?: string|null;
  said_done?: string|null; user_action?: string|null; aftermath?: string|null;
  stakes?: string|null; feeling?: string|null; other_side?: string|null;
}
type Draft = { pillar: Pillar; tags: string[]; anchor: string|null; emotional_core: string|null; the_real_thing: string|null; named_and_landed: boolean; arc?: Arc }
type Msg = { role: 'user'; text: string } | { role: 'companion'; say: string[]; hasQ: boolean }
type Composed = { title: string; body: string; tags: string[]; pillar: Pillar; edit_summary?: string; progress_note?: string | null }
type Phase = 'chat' | 'reflect' | 'support' | 'compose' | 'preview' | 'publishing' | 'saving-journal'

async function callComplete(userText: string, system?: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const res = await fetch('/api/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      messages: [{ role: 'user', content: userText }],
      system: system ?? SPILL_SYSTEM,
      maxTokens: 1500,
    }),
  })
  if (!res.ok) throw new Error(`complete failed: ${res.status}`)
  const j = (await res.json()) as { text?: string; error?: string }
  if (typeof j.text !== 'string') throw new Error(j.error || 'no text')
  return j.text
}

/** Read cached alias display name for the client-side companion calls. */
function getAliasName(): string | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('shutap_alias') : null
    if (!raw) return null
    const a = JSON.parse(raw) as { name?: string }
    const n = (a?.name || '').trim()
    return n || null
  } catch { return null }
}

/** Alias directive to append to the USER message (never to the hash-allowlisted
 *  system prompt) so the model stops emitting "[user_alias]" placeholders. */
function aliasNoteFor(name: string | null): string {
  return name
    ? `\n\nthe user's alias is "${name}". when you address them by name, use this exact alias. NEVER output a placeholder token like [user_alias], [user alias], [alias], or [name].`
    : `\n\nyou do NOT know the user's alias. do not use any name for them, and NEVER output a placeholder token like [user_alias], [user alias], [alias], or [name] — just talk to them directly.`
}

/** Defense in depth — strip any placeholder tokens the model still leaks. */
const PLACEHOLDER_RE = /\[\s*(user[ _-]?alias|user[ _-]?name|alias|name)\s*\]/gi
export function sanitizePlaceholders(text: string, aliasName: string | null): string {
  if (!text) return text
  let out = String(text)
  if (aliasName) {
    out = out.replace(PLACEHOLDER_RE, aliasName)
  } else {
    out = out.replace(PLACEHOLDER_RE, '')
    // clean up orphaned punctuation / whitespace left behind
    out = out.replace(/,\s*([.!?…])/g, '$1')
    out = out.replace(/\s+([,.!?…])/g, '$1')
    out = out.replace(/[ \t]{2,}/g, ' ')
    out = out.replace(/ +\n/g, '\n')
  }
  return out
}

function extractJSON<T>(raw: string): T {
  const cleaned = (raw || '').replace(/```json/gi, '').replace(/```/g, '')
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no json')
  return JSON.parse(m[0]) as T
}

const REFLECT_FALLBACK = "ok so — stripped down, this has been weighing on you for a while, and saying it out loud is the first time it's been outside your own head. that about right?"

function sanitizeReflect(raw: string): string {
  let text = (raw || '').replace(/```json/gi, '').replace(/```/g, '').trim()
  const m = text.match(/\{[\s\S]*\}/)
  if (m) {
    try {
      const obj = JSON.parse(m[0]) as Record<string, unknown>
      if (obj && typeof obj === 'object') {
        const pick = (k: string) => (typeof obj[k] === 'string' ? (obj[k] as string) : '')
        let picked = pick('stripped_down_reflection') || pick('reflection') || pick('read')
        if (!picked) {
          for (const v of Object.values(obj)) {
            if (typeof v === 'string' && v.trim()) { picked = v; break }
          }
        }
        if (picked) text = picked
      }
    } catch { /* not json, keep text */ }
  }
  text = text.trim()
  if (!text) return REFLECT_FALLBACK
  if (text.includes('```') || text.startsWith('{')) return REFLECT_FALLBACK
  return text
}

function mergeDraft(d: Draft, u: Partial<Draft> & { arc?: Arc } | undefined): Draft {
  const base: Draft = d || { pillar: null, tags: [], anchor: null, emotional_core: null, the_real_thing: null, named_and_landed: false }
  const up = u || {}
  { const p = normalizePillar(up.pillar); if (p) base.pillar = p }
  if (up.anchor) base.anchor = up.anchor
  if (up.emotional_core) base.emotional_core = up.emotional_core
  if (up.the_real_thing) base.the_real_thing = up.the_real_thing
  if (up.named_and_landed) base.named_and_landed = true
  if (up.arc) {
    base.arc = base.arc || {}
    ;(Object.keys(up.arc) as Array<keyof Arc>).forEach(k => { if (up.arc![k]) base.arc![k] = up.arc![k]! })
  }
  if (Array.isArray(up.tags)) up.tags.forEach(t => { if (t && base.tags.indexOf(t) < 0) base.tags.push(t) })
  return base
}

// Rule-based fallback — facts-first fact ledger.
type FallbackResult = { say: string[]; hasQ: boolean; updated: Partial<Draft> & { arc?: Arc }; ready: boolean }
function spillFallbackTurn(lastAnswer: string, draft: Draft, turnQ: number, usedFB: string[]): FallbackResult {
  const a = (lastAnswer || '').toLowerCase()
  let pillar: Pillar = draft?.pillar || null
  if (!pillar) {
    if (/\b(partner|boyfriend|girlfriend|husband|wife|ex|dating)\b/.test(a)) pillar = 'relationships'
    else if (/\b(mom|dad|mother|father|sister|brother|family|parent)\b/.test(a)) pillar = 'family'
    else if (/\b(boss|work|job|manager|coworker|office)\b/.test(a)) pillar = 'career'
    else if (/\b(married|marriage|spouse)\b/.test(a)) pillar = 'marriage'
  }
  const reacts = ["ok, that's genuinely not okay.", 'oh, that would get to anyone.', "no — you're not wrong to be upset about that.", "yeah, i'd be rattled too."]
  const reaction = reacts.filter(r => usedFB.indexOf(r) < 0)[0] || reacts[0]
  usedFB.push(reaction)
  // Ledger-driven order: fact before feeling. Feeling is TERMINAL/optional.
  const arcQs: Array<[keyof Arc, string]> = [
    ['trigger_event', 'walk me through what actually happened — when was it?'],
    ['said_done', 'what did they actually say, or actually do? word for word if you remember.'],
    ['user_action', 'and you — what did you do or say in the moment?'],
    ['sequence', 'what came right before that, and right after?'],
    ['who', 'who else was there, or involved in any of this?'],
    ['aftermath', 'where does it stand now — has anything changed since?'],
    ['stakes', 'what has this actually cost you — sleep, plans, the relationship, something else?'],
  ]
  const arc = draft.arc || {}
  const nextSlot = arcQs.find(([k]) => !arc[k])
  const ready = !nextSlot
  const q = nextSlot ? nextSlot[1] : ''
  const say = ready ? [reaction, "ok — i think i've got the shape of it."] : [reaction, q]
  const updatedArc: Arc = {}
  if (nextSlot && turnQ > 0) {
    // Attribute the latest answer to the PREVIOUS slot we asked about.
    const prev = arcQs[Math.max(0, arcQs.findIndex(([k]) => k === nextSlot[0]) - 1)]
    if (prev && !arc[prev[0]] && lastAnswer.trim()) updatedArc[prev[0]] = lastAnswer.trim().slice(0, 400)
  }
  return {
    say,
    hasQ: !ready,
    updated: {
      pillar: pillar || null,
      tags: [],
      anchor: null,
      emotional_core: null,
      the_real_thing: ready ? 'this has been building for a while' : null,
      named_and_landed: ready,
      arc: updatedArc,
    },
    ready,
  }
}

// Minimal PII scrubber — mirrors DCLogic.scrubPII (Landing.dc.html §1c).
function scrubPII(text: string): { clean: string; changes: Array<{ type: string; label: string; count: number }> } {
  let t = text || ''
  const changes: Array<{ type: string; label: string; count: number }> = []
  const bump = (type: string, label: string, n: number) => {
    const e = changes.find(c => c.type === type); if (e) e.count += n; else changes.push({ type, label, count: n })
  }
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, () => { bump('email', 'an email', 1); return '[email]' })
  t = t.replace(/(\+?\d[\d\s().-]{7,}\d)/g, () => { bump('phone', 'a phone number', 1); return '[number]' })
  t = t.replace(/(^|\s)@[A-Za-z0-9_]{3,}/g, (_m, p) => { bump('handle', 'a social handle', 1); return p + '[handle]' })
  return { clean: t.trim(), changes }
}





// Append a just-published room to localStorage['shutap_user_situations'] so
// StreamPage / RoomPage hash lookups can find and open it. De-dupes by id,
// newest first, capped at 50.
export function appendUserRoom(r: {
  id: string
  title: string
  body: string
  support: 'heard' | 'advice'
  pillar: string | null
  alias?: string
  emoji?: string
  kind?: 'spill' | 'scan'
  initial_scan?: number | null
  scan_band?: string | null
  scan_signature?: string | null
}) {
  if (typeof window === 'undefined') return
  try {
    let alias = r.alias
    let emoji = r.emoji
    if (!alias || !emoji) {
      try {
        const cached = localStorage.getItem('shutap_alias')
        if (cached) {
          const a = JSON.parse(cached) as { name?: string; emoji?: string }
          if (!alias && a?.name) alias = a.name
          if (!emoji && a?.emoji) emoji = a.emoji
        }
      } catch { /* noop */ }
    }
    const entry: Record<string, unknown> = {
      id: r.id,
      title: r.title,
      body: r.body,
      support: r.support,
      kind: r.kind ?? 'spill',
      pillar: r.pillar,
      hall: 'healing',
      hours: 'just now',
      relates: 0,
      sitting: 1,
      reactions: { heard: 0, same: 0, strong: 0, time: 0, brave: 0 },
    }
    if (alias) entry.alias = alias
    if (emoji) entry.emoji = emoji
    if (r.initial_scan !== undefined && r.initial_scan !== null) entry.initial_scan = r.initial_scan
    if (r.scan_band !== undefined && r.scan_band !== null) entry.scan_band = r.scan_band
    if (r.scan_signature !== undefined && r.scan_signature !== null) entry.scan_signature = r.scan_signature
    const raw = localStorage.getItem('shutap_user_situations')
    const arr = raw ? (JSON.parse(raw) as Array<{ id?: string }>) : []
    const deduped = Array.isArray(arr) ? arr.filter(x => x && x.id !== r.id) : []
    const next = [entry, ...deduped].slice(0, 50)
    localStorage.setItem('shutap_user_situations', JSON.stringify(next))
  } catch { /* noop */ }
}

function eyeSVG(size = 32) {
  // Shared cursor-reactive companion eye (3D spring + breathe + lunge).
  return (
    <span style={{ display: 'inline-flex', flex: 'none' }}>
      <CompanionEye size={size} />
    </span>
  )
}

function Thinking({ text = 'ok hang on…' }: { text?: string }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#6f666c' }}>
      <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#a52a5f', display: 'block', animation: 'blinkdot 1.2s infinite' }} />
      <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#a52a5f', display: 'block', animation: 'blinkdot 1.2s .2s infinite' }} />
      <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#a52a5f', display: 'block', animation: 'blinkdot 1.2s .4s infinite' }} />
      &nbsp;{text}
    </div>
  )
}

function ChromeBar({ step, total, onClose }: { step: number; total: number; onClose: () => void }) {
  return (
    <div style={{ flex: 'none', padding: '18px 22px 14px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '.5px solid rgba(255,255,255,.06)' }}>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i < step ? '#a52a5f' : 'rgba(255,255,255,.12)', transition: 'background .3s' }} />
        ))}
      </div>
      <div role="button" onClick={onClose} style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13, color: '#6f666c', cursor: 'pointer', flex: 'none' }}>close</div>
    </div>
  )
}

export function SpillModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const save = useServerFn(saveSituation)
  const fetchMySituations = useServerFn(listMySituations)

  // Fallback opener until the async new-vs-returning check resolves.
  const openingFallback: [string, string] = ['okay, i\u2019m all yours.', 'no rush — where do you want to start?']
  const initialMsg: Msg = { role: 'companion', say: openingFallback, hasQ: true }

  const [msgs, setMsgs] = useState<Msg[]>([initialMsg])
  const [draft, setDraft] = useState<Draft>({ pillar: null, tags: [], anchor: null, emotional_core: null, the_real_thing: null, named_and_landed: false })
  const [turn, setTurn] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [phase, setPhase] = useState<Phase>('chat')
  const [reflectSummary, setReflectSummary] = useState<string | null>(null)
  const [supportMode, setSupportMode] = useState<'heard' | 'advice'>('heard')
  const [composed, setComposed] = useState<Composed | null>(null)
  const [editNote, setEditNote] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [editInstruction, setEditInstruction] = useState('')
  const [aiEditing, setAiEditing] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const [priorReferent, setPriorReferent] = useState<string | null>(null)
  const [progressNote, setProgressNote] = useState<string | null>(null)

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const titleElRef = useRef<HTMLDivElement | null>(null)
  const bodyElRef = useRef<HTMLDivElement | null>(null)
  const usedFBRef = useRef<string[]>([])

  // Lock body scroll when open + reset when closing.
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Reset internal state each time the modal is (re-)opened, and pick a
  // dynamic opener based on whether the user is returning (has ≥1 prior
  // situation). Fail-soft: any error → new-user opener.
  useEffect(() => {
    if (!open) return
    const opener = pickNewOpener()
    setMsgs([{ role: 'companion', say: opener, hasQ: true }])
    setDraft({ pillar: null, tags: [], anchor: null, emotional_core: null, the_real_thing: null, named_and_landed: false })
    setTurn(0); setThinking(false); setPhase('chat')
    setReflectSummary(null); setSupportMode('heard'); setComposed(null); setEditNote(null)
    let prefill = ''
    try { prefill = sessionStorage.getItem('shutap_spill_prefill') || ''; if (prefill) sessionStorage.removeItem('shutap_spill_prefill') } catch { /* noop */ }
    setInput(prefill); setEditInstruction(''); setAiEditing(false)
    setIsReturning(false); setPriorReferent(null); setProgressNote(null)
    usedFBRef.current = []

    let cancelled = false
    ;(async () => {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const user = sess.session?.user as { is_anonymous?: boolean } | undefined
        if (!sess.session || user?.is_anonymous) return
        const rows = await fetchMySituations()
        if (cancelled) return
        const list = (rows || []) as Array<{ title?: string | null; clean_text?: string | null; status?: string | null; created_at?: string }>
        const active = list.filter(r => r.status !== 'deleted')
        if (active.length === 0) return
        const ref = referentFrom(active[0])
        const ret = returningOpener(ref)
        setIsReturning(true)
        setPriorReferent(ref)
        setMsgs([{ role: 'companion', say: ret, hasQ: true }])
      } catch {
        /* fail-soft: keep new-user opener */
      }
    })()
    return () => { cancelled = true }
  }, [open, fetchMySituations])

  // Auto-scroll chat body on new bubbles / thinking dots.
  useEffect(() => {
    const el = bodyRef.current; if (!el) return
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }, [msgs, thinking, phase, reflectSummary])

  // ─────────────────────────────── chat turn ───────────────────────────────
  const runTurn = useCallback(async (userText: string) => {
    const scrubbed = scrubPII(userText)
    const nextMsgs: Msg[] = [...msgs, { role: 'user', text: scrubbed.clean }]
    setMsgs(nextMsgs)
    const nextTurn = turn + 1
    setTurn(nextTurn)
    setThinking(true)
    // Returning users: the first user reply is the progress beat — capture
    // it as the progress_note (their words) before continuing with the new
    // spill interview.
    if (isReturning && progressNote === null && turn === 0) {
      setProgressNote(scrubbed.clean)
    }
    try {
      const transcript = nextMsgs.map(m => m.role === 'user' ? 'them: ' + m.text : 'you: ' + m.say.join(' ')).join('\n')
      const requiredBeats: Array<keyof Arc> = ['trigger_event', 'sequence', 'who', 'said_done', 'user_action', 'aftermath', 'stakes']
      const arc = draft.arc || {}
      const blank = requiredBeats.filter(b => !arc[b])
      const hasTrigger = !!arc.trigger_event
      const hasUserAction = !!arc.user_action
      const gate = (!hasTrigger || !hasUserAction)
        ? '\nORDERING GATE: trigger_event or user_action is still blank — do NOT ask about feeling yet.'
        : ''
      const arcNote = blank.length
        ? '\nstill blank in the ledger (ask the next observable, one at a time): ' + blank.join(', ')
        : '\nthe required ledger looks covered — run the self-check: stranger-reconstructable? >=1 said/done? user\u2019s own action? aftermath? if yes, you may be ready.'
      const progressHint = isReturning && progressNote
        ? '\nthis user is RETURNING. their progress on the prior thing (their words): "' + progressNote + '". carry that context but the new spill is a new situation.'
        : ''
      const aliasName = getAliasName()
      const userMsg =
        TURN_SYS +
        '\n\n=== the conversation so far ===\n' + transcript +
        '\n\n=== what you have quietly understood ===\n' + JSON.stringify(draft) +
        arcNote + gate + progressHint +
        '\nthis is turn ' + nextTurn + ' of max 12.\n\nnow output ONLY your JSON move:' +
        aliasNoteFor(aliasName)
      const raw = await callComplete(userMsg)
      const obj = extractJSON<{ say?: string[]; has_question?: boolean; updated?: Partial<Draft>; decision?: string }>(raw)
      const sayRaw = (Array.isArray(obj.say) ? obj.say.filter(Boolean).slice(0, 3) : ['ok — i\u2019m with you. keep going.']) as string[]
      const say = sayRaw.map(s => sanitizePlaceholders(String(s), aliasName))
      const merged = mergeDraft(draft, obj.updated as Draft | undefined)
      setDraft(merged)
      const after: Msg[] = [...nextMsgs, { role: 'companion', say: say.length ? say : ['ok — i\u2019m with you. keep going.'], hasQ: !!obj.has_question }]
      setMsgs(after)
      const ready = obj.decision === 'ready' || nextTurn >= 12
      setThinking(false)
      if (ready) { setPhase('reflect'); void runReflect(after, merged) }
    } catch {
      // Scripted fallback — verbatim behavior from spillFallbackTurn() in iframe.
      const aliasName = getAliasName()
      const fb = spillFallbackTurn(scrubbed.clean, draft, nextTurn, usedFBRef.current)
      const merged = mergeDraft(draft, fb.updated as Draft)
      setDraft(merged)
      const after: Msg[] = [...nextMsgs, { role: 'companion', say: fb.say.map(s => sanitizePlaceholders(s, aliasName)), hasQ: fb.hasQ }]
      setMsgs(after)
      setThinking(false)
      if (fb.ready) { setPhase('reflect'); void runReflect(after, merged) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, turn, draft])

  // ─────────────────────────────── reflect ───────────────────────────────
  const runReflect = useCallback(async (allMsgs: Msg[], mergedDraft: Draft) => {
    setThinking(true)
    let summary = ''
    const aliasName = getAliasName()
    try {
      const convo = allMsgs.filter((m): m is Extract<Msg, { role: 'user' }> => m.role === 'user').map(m => m.text).join(' / ')
      const real = mergedDraft.the_real_thing || ''
      const prompt = 'Say the whole thing back to them, centered on the real thing, in their words, relaxed and warm, lowercase, starting "ok so — stripped down, ". keep it to 1-2 sentences. end with "that about right?" no advice, no diagnosis, no preamble.'
      const reflectSystem = 'You are THE SPILL on Shutap — the user\'s closest friend, lowercase, warm, texty. Reply in PLAIN PROSE ONLY. Never output JSON, code fences, backticks, keys, or braces.'
      const raw = await callComplete('their words: ' + convo + '\nthe real thing underneath: ' + real + '\n\n' + prompt + aliasNoteFor(aliasName), reflectSystem)
      summary = sanitizePlaceholders(sanitizeReflect(raw), aliasName)
    } catch {
      summary = REFLECT_FALLBACK
    }
    setReflectSummary(summary)
    setThinking(false)
    setPhase('support')
  }, [])

  // ─────────────────────────────── compose ───────────────────────────────
  const runCompose = useCallback(async (mode: 'heard' | 'advice') => {
    setSupportMode(mode)
    setPhase('compose')
    // Build the interview skeleton: each companion question paired with the
    // user's next answer, in order. This is the spine the composer threads
    // into a narrative (not a Q&A dump).
    const pairs: Array<{ q: string; a: string }> = []
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]
      if (m.role !== 'companion') continue
      const q = (m.say || []).join(' ').trim()
      const next = msgs[i + 1]
      if (next && next.role === 'user') pairs.push({ q, a: (next.text || '').trim() })
    }
    const convo = pairs.map(p => p.a).filter(Boolean).join('\n')
    const skeleton = pairs
      .map((p, i) => `Q${i + 1} (companion asked): ${p.q}\nA${i + 1} (they answered): ${p.a}`)
      .join('\n\n')
    let c: Composed
    const aliasName = getAliasName()
    try {
      const progressBlock = isReturning && progressNote
        ? '\n\nprogress note (returning user, their words about the PRIOR situation \u2014 do NOT weave into the new story; return it verbatim in progress_note): "' + progressNote + '"'
        : ''
      const prompt =
        'You are THE SPILL on Shutap. Compose the user\u2019s intake into a public-ready post that will open their Room \u2014 a full-sentence NARRATIVE in THEIR voice, NOT a transcript or Q&A dump. Build the story from the FACT LEDGER \u2014 trigger_event \u2192 sequence \u2192 said/done \u2192 user_action \u2192 aftermath \u2192 stakes \u2014 threaded into ONE smooth chronological story with real transitions a stranger can follow. Feeling appears only where the user put it, in their words, never as a substitute for a missing event.\n\n' +
        'THE 80/20 RULE \u2014 LANGUAGE, NOT CONTENT.\n' +
        '~80% stays THEIRS: their account, specifics, quotes, emotional beats, voice, idiom, capitalization, profanity; the meaning is EXACTLY what they said.\n' +
        'Up to ~20% is polish AT THE LANGUAGE LEVEL ONLY: grammar, spelling, smoothing choppy phrasing, connective transitions between beats, cutting filler.\n\n' +
        'HARD LINE: improve HOW it\u2019s said, never WHAT is said. NEVER add a fact, event, person, motive, quote, or feeling they didn\u2019t give. NEVER make it more dramatic than they lived it. NEVER put words in the other party\u2019s mouth. If a smoother sentence would imply something they didn\u2019t say, don\u2019t write it.\n\n' +
        'title = their own hook, tightened to ONE line (lowercase ok). body = 2\u20135 short first-person paragraphs. edit_summary = one plain line naming the kind of polish applied (e.g. "fixed grammar and smoothed the order; no details added"). Do NOT list what you added \u2014 you added nothing.\n\n' +
        'the interview (already anonymized \u2014 keep it that way):\n"""\n' + skeleton + '\n"""\n\n' +
        'the fact ledger (silent, for your reference): ' + JSON.stringify(draft.arc || {}) + '\n' +
        'the thing that mattered most to them: ' + (draft.the_real_thing || draft.emotional_core || '(not stated)') + progressBlock + '\n\n' +
        'OUTPUT FORMAT: return PLAIN TEXT only in the title and body fields \u2014 no HTML tags, no markdown, no <br>; use real newline characters (\\n\\n) between paragraphs.\n\n' +
        'return STRICT JSON only: {"title":"...","body":"...","tags":["short","lowercase","tags"],"edit_summary":"...","progress_note":' + (isReturning ? '"<verbatim their words>"' : 'null') + '}' +
        aliasNoteFor(aliasName)
      const raw = await callComplete(prompt)
      const j = extractJSON<{ title?: string; body?: string; tags?: string[]; edit_summary?: string; progress_note?: string | null }>(raw)
      c = {
        title: sanitizePlaceholders(scrubPII(stripHTMLInline(String(j.title || ''))).clean, aliasName),
        body: sanitizePlaceholders(scrubPII(stripHTML(String(j.body || ''))).clean, aliasName),
        tags: Array.isArray(j.tags) ? j.tags.slice(0, 5) : (draft.tags || []),
        pillar: normalizePillar(draft.pillar),
        edit_summary: typeof j.edit_summary === 'string' ? j.edit_summary.trim() : '',
        progress_note: isReturning
          ? scrubPII(stripHTMLInline(String(j.progress_note || progressNote || ''))).clean || null
          : null,
      }
    } catch {
      const first = msgs.find(m => m.role === 'user') as Extract<Msg, { role: 'user' }> | undefined
      c = {
        title: scrubPII(stripHTMLInline(first?.text || 'my situation')).clean.slice(0, 72) || 'my situation',
        body: scrubPII(stripHTML(convo)).clean,
        tags: (draft.tags || []).slice(0, 5),
        pillar: normalizePillar(draft.pillar),
        edit_summary: '',
        progress_note: isReturning && progressNote ? scrubPII(stripHTMLInline(progressNote)).clean : null,
      }
    }
    setComposed(c)
    setPhase('preview')
  }, [msgs, draft, isReturning, progressNote])


  // pull manual contenteditable edits back into `composed` + re-scrub.
  const syncPreviewDOM = useCallback(() => {
    setComposed(prev => {
      if (!prev) return prev
      const t = titleElRef.current, b = bodyElRef.current
      const title = t ? scrubPII((t.innerText || '').replace(/\n+/g, ' ').trim()).clean : prev.title
      const body = b ? scrubPII((b.innerText || '').trim()).clean : prev.body
      return { ...prev, title, body }
    })
  }, [])

  const runAIEdit = useCallback(async () => {
    const ins = editInstruction.trim(); if (!ins || !composed) return
    syncPreviewDOM()
    setAiEditing(true)
    const aliasName = getAliasName()
    try {
      const prompt =
        'You are editing the user\u2019s OWN Shutap post on their instruction. Their voice and facts are sacred. You may shorten, reorder, tighten, fix typos, or do EXACTLY what they asked \u2014 using ONLY material already in the post. Keep their slang, cadence, caps, profanity, mess. NEVER add an event, name, motive, quote, or detail they didn\u2019t give; never soften or sharpen what happened. If the instruction needs a fact that isn\u2019t there, do NOT invent it \u2014 set needs_input and ask (short) what to add.\n\ncurrent title: ' + JSON.stringify(composed.title) +
        '\ncurrent body:\n"""' + composed.body + '"""\n\ntheir instruction: "' + ins + '"\n\nOUTPUT FORMAT: return PLAIN TEXT only in the title and body fields \u2014 no HTML tags, no markdown, no <br>; use real newline characters (\\n\\n) between paragraphs.\n\nreturn STRICT JSON only: {"title":"...","body":"...","changed":"<one short line on what you changed>","needs_input":false}' +
        aliasNoteFor(aliasName)
      const raw = await callComplete(prompt)
      const j = extractJSON<{ title?: string; body?: string; changed?: string; needs_input?: boolean }>(raw)
      if (j.needs_input) {
        setEditNote('hmm — ' + (j.changed || 'i\u2019d have to make something up for that. what should i add?'))
      } else {
        setComposed(prev => prev && ({
          ...prev,
          title: j.title ? sanitizePlaceholders(scrubPII(stripHTMLInline(String(j.title))).clean, aliasName) : prev.title,
          body: j.body ? sanitizePlaceholders(scrubPII(stripHTML(String(j.body))).clean, aliasName) : prev.body,
        }))
        setEditNote('done — ' + (j.changed || 'tweaked it. take a look.'))
      }

      setEditInstruction('')
    } catch {
      setEditNote('couldn\u2019t make that edit — try saying it another way.')
    }
    setAiEditing(false)
  }, [editInstruction, composed, syncPreviewDOM])

  const publishOrSave = useCallback(async (isPublic: boolean) => {
    if (!composed) return
    syncPreviewDOM()
    const c = composed
    // read the latest edits synchronously from the DOM (state batch may lag).
    const liveTitle = titleElRef.current ? scrubPII((titleElRef.current.innerText || '').replace(/\n+/g, ' ').trim()).clean : c.title
    const liveBody = bodyElRef.current ? scrubPII((bodyElRef.current.innerText || '').trim()).clean : c.body
    // Preview-consistency guard: never publish a title-only / empty post.
    // A degraded AI compose can leave the body blank or identical to the
    // title — hold the user on the preview until they add the story.
    if (!liveBody || liveBody === liveTitle.trim()) {
      setEditNote('your story looks empty — add the story before posting.')
      setPhase('preview')
      return
    }
    const payload = {
      kind: 'spill' as const,
      pillar: (normalizePillar(c.pillar) ?? 'relationships') as 'relationships' | 'marriage' | 'family' | 'career',
      clean_text: liveBody,
      title: liveTitle || 'your situation',
      body: liveBody,
      tags: c.tags,
      is_public: isPublic,
      support_mode: supportMode,
    }
    setPhase(isPublic ? 'publishing' : 'saving-journal')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const isAnon = Boolean((sess.session?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous)
      if (!sess.session || isAnon) {
        sessionStorage.setItem('shutap_pending_save', JSON.stringify(payload))
        saveIntent({ kind: 'spill' })
        navigate('/welcome')
        return
      }
      const res = await save({ data: payload as never })
      try {
        const { trackEvent } = await import('@/lib/tracking')
        const props = { pillar: payload.pillar, is_public: isPublic, has_room: Boolean(res?.room_id) }
        void trackEvent('spill_created', props)
        void trackEvent('spill_submitted', props)
      } catch { /* noop */ }
      if (isPublic && res?.room_id) {
        appendUserRoom({
          id: res.room_id,
          title: liveTitle,
          body: liveBody,
          support: supportMode,
          pillar: payload.pillar,
        })
      }
      setTimeout(() => {
        if (isPublic && res?.room_id) navigate(`/stream#room-${res.room_id}`)
        else navigate('/profile')
      }, 850)
    } catch (e) {
      console.error('[spill save]', e)
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('sign_in_required')) {
        try {
          sessionStorage.setItem('shutap_pending_save', JSON.stringify(payload))
          saveIntent({ kind: 'spill' })
        } catch { /* noop */ }
        navigate('/welcome')
        return
      }
      setEditNote('couldn’t save — ' + msg + '. try again in a sec.')
      setPhase('preview')
    }
  }, [composed, supportMode, save, navigate, syncPreviewDOM])

  if (!open) return null

  // Chrome step index (matches iframe: chat = turn count, compose = 8, publish = 9)
  const step =
    phase === 'chat' ? Math.max(0, Math.min(7, turn)) :
    phase === 'reflect' || phase === 'support' ? 7 :
    phase === 'compose' || phase === 'preview' ? 8 :
    9
  const lastCompanion = [...msgs].reverse().find((m): m is Extract<Msg, { role: 'companion' }> => m.role === 'companion')
  const bubbles = lastCompanion?.say || []
  const hasQ = !!lastCompanion?.hasQ

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#100c14' }}>
      {/* shared eye gradients (matches parent Landing defs). */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <linearGradient id="eyeG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a52a5f" /><stop offset="100%" stopColor="#6d1239" />
          </linearGradient>
          <linearGradient id="pupG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#100c14" /><stop offset="100%" stopColor="#100608" />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ChromeBar step={step} total={9} onClose={onClose} />

        {(phase === 'chat' || phase === 'reflect' || phase === 'support') && (
          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '34px 22px 32px', maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {eyeSVG(30)}
              <div style={{ fontFamily: SORA, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#a52a5f' }}>spill</div>
            </div>

            {bubbles.length > 0 && (() => {
              const reactions = bubbles.slice(0, -1)
              const star = bubbles[bubbles.length - 1]
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {reactions.map((t, i) => (
                    <div key={i} style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.45, color: '#c4a0b2' }}>{t}</div>
                  ))}
                  <div
                    key={'star-' + msgs.length}
                    style={{
                      fontFamily: NEWSREADER, fontStyle: 'italic', fontWeight: 500,
                      fontSize: 'clamp(24px,5.4vw,36px)', lineHeight: 1.22,
                      color: hasQ ? '#f7b8d4' : '#fdfbf9',
                      animation: 'fadeUp .45s ease-out both',
                    }}
                  >{star}</div>
                </div>
              )
            })()}

            {thinking && phase === 'chat' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#6f666c' }}>
                <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#a52a5f', animation: 'blinkdot 1.2s infinite' }} />
                <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#a52a5f', animation: 'blinkdot 1.2s .2s infinite' }} />
                <i style={{ width: 6, height: 6, borderRadius: '50%', background: '#a52a5f', animation: 'blinkdot 1.2s .4s infinite' }} />
                &nbsp;ok hang on…
              </div>
            )}

            {phase === 'chat' && !thinking && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 16, padding: '13px 15px', transition: 'border-color .18s' }}
                onFocusCapture={e => (e.currentTarget.style.borderColor = '#a52a5f')}
                onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.14)')}
              >
                <textarea
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = input.trim(); if (v) { setInput(''); void runTurn(v) } } }}
                  placeholder={hasQ ? 'answer however it comes…' : 'keep going… i\u2019m listening'}
                  autoFocus
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fdfbf9', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 19, resize: 'none', maxHeight: 160, lineHeight: 1.5 }}
                />
                <div role="button" onClick={() => { const v = input.trim(); if (v) { setInput(''); void runTurn(v) } }} style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#a52a5f', cursor: 'pointer', flex: 'none', paddingBottom: 2 }}>send →</div>
              </div>
            )}

            {phase === 'reflect' && thinking && <Thinking />}
            {reflectSummary && (
              <div style={{ background: 'rgba(255,255,255,.04)', borderLeft: '2px solid rgba(231,84,138,.4)', padding: '14px 16px', borderRadius: '0 12px 12px 0', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.55, color: '#fdfbf9' }}>{reflectSummary}</div>
            )}

            {phase === 'support' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 15, color: '#c4a0b2' }}>real quick — you want advice on this, or you just wanna get it out?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div role="button" onClick={() => void runCompose('heard')} style={{ cursor: 'pointer', padding: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, textAlign: 'center', transition: '.15s' }}>
                    <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#f7b8d4', marginBottom: 6 }}>just to be heard</div>
                    <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#fdfbf9' }}>sit with me. you don’t have to fix anything.</div>
                  </div>
                  <div role="button" onClick={() => void runCompose('advice')} style={{ cursor: 'pointer', padding: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, textAlign: 'center', transition: '.15s' }}>
                    <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#a8d4a9', marginBottom: 6 }}>open to advice</div>
                    <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#fdfbf9' }}>the room can share what it’d do.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'compose' && (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '34px 22px', textAlign: 'center' }}>
            <div>
              {eyeSVG(40)}
              <div style={{ marginTop: 16 }}><Thinking text="writing it up in your words…" /></div>
            </div>
          </div>
        )}

        {phase === 'preview' && composed && (
          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '26px 22px 24px', maxWidth: 580, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: SORA, fontWeight: 600, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#a52a5f' }}>preview · in your words</div>
            <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 17, lineHeight: 1.55, color: '#c4a0b2' }}>here’s your story — cleaned up a little, but still yours; did i keep it true? type right over anything to fix it, or tell me what to change below — then pick where it lives.</div>
            {composed.edit_summary && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13, color: '#6f666c' }}>
                {eyeSVG(16)}<span>{composed.edit_summary}</span>
              </div>
            )}
            {editNote && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13.5, color: '#a8d4a9' }}>
                {eyeSVG(18)}<span>{editNote}</span>
              </div>
            )}
            <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: '20px 20px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Sora', fontWeight: 500, fontSize: 12.5, color: '#6f666c', marginBottom: 12 }}>
                {(() => {
                  let alias = 'you', emoji = '🩷'
                  try { const raw = typeof window !== 'undefined' ? localStorage.getItem('shutap_alias') : null
                    if (raw) { const a = JSON.parse(raw) as { name?: string; emoji?: string }
                      if (a?.name) alias = a.name; if (a?.emoji) emoji = a.emoji } } catch { /* noop */ }
                  return <><span>{emoji} {alias}</span><span style={{ opacity: .5 }}>· {normalizePillar(composed.pillar) || 'your story'}</span></>
                })()}
              </div>
              <div
                ref={titleElRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={syncPreviewDOM}
                style={{ outline: 'none', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 23, lineHeight: 1.3, color: '#fdfbf9', borderRadius: 6, transition: 'background .15s' }}
              >{composed.title || 'untitled'}</div>
              <div
                ref={bodyElRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={syncPreviewDOM}
                style={{ outline: 'none', marginTop: 12, fontFamily: NEWSREADER, fontSize: 16, lineHeight: 1.65, color: '#e7dce4', borderRadius: 6, transition: 'background .15s', whiteSpace: 'pre-wrap' }}
              >{composed.body}</div>
              {composed.tags.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {composed.tags.map((t, i) => (
                    <span key={i} style={{ fontFamily: SORA, fontWeight: 600, fontSize: 10.5, letterSpacing: '.02em', color: '#a52a5f', background: 'rgba(231,84,138,.13)', borderRadius: 999, padding: '3px 10px' }}>#{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 12.5, color: '#6f666c' }}>🔒 every edit gets re-checked by the privacy shield before it saves.</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 16, padding: '11px 14px', marginTop: 2 }}>
              <textarea
                rows={1}
                value={editInstruction}
                onChange={e => setEditInstruction(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void runAIEdit() } }}
                placeholder='or tell me: “make it shorter”, “add the part about the rent”…'
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fdfbf9', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 15, resize: 'none', maxHeight: 120, lineHeight: 1.5 }}
              />
              <div role="button" onClick={() => void runAIEdit()} style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#a52a5f', cursor: aiEditing ? 'wait' : 'pointer', flex: 'none', paddingBottom: 2 }}>{aiEditing ? '…' : 'edit →'}</div>
            </div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              <div role="button" onClick={() => void publishOrSave(false)} style={{ cursor: 'pointer', padding: '15px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 15 }}>
                <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f7b8d4' }}>keep as journal</div>
                <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13.5, color: '#c4a0b2', marginTop: 5 }}>private draft. only you. edit &amp; post whenever.</div>
              </div>
              <div role="button" onClick={() => void publishOrSave(true)} style={{ cursor: 'pointer', padding: '15px 14px', background: '#a52a5f', border: '1px solid #a52a5f', borderRadius: 15 }}>
                <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#fff' }}>post to a room →</div>
                <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13.5, color: '#ffe0ee', marginTop: 5 }}>open it up {supportMode === 'advice' ? 'for what the room would do.' : 'so others who lived it can sit with you.'}</div>
              </div>
            </div>
          </div>
        )}

        {(phase === 'publishing' || phase === 'saving-journal') && (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '34px 22px', textAlign: 'center' }}>
            <div>
              {eyeSVG(50)}
              <div style={{ marginTop: 20, fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 26, lineHeight: 1.35, color: '#fdfbf9' }}>
                {phase === 'publishing' ? 'your room is open.' : 'saved to your journal.'}
              </div>
              <div style={{ marginTop: 12 }}><Thinking text={phase === 'publishing' ? 'taking you in' : 'opening your journal'} /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
