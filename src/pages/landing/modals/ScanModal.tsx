/* Native React port of the SCAN overlay from public/shutap/Landing.dc.html
   (openScan/scanNextCard/scanAI/scanRenderCard/scan widgets/scanFinish/
   scanShowResult, ~lines 1482–1725).

   Wired to the same backend as the iframe:
   - Card turns POST /api/complete with system=SCAN_SYSTEM (verbatim from
     src/pages/Landing.tsx bridge) and the user message is the exact
     "THE SCAN on Shutap..." prompt the iframe injected. No AI change.
   - The final read is persisted via the `saveSituation` server fn with
     kind:'scan', initial_scan, scan_band. Same as iframe sync in
     src/pages/Landing.tsx.
   - Unauth publish → stash `shutap_pending_save` and route to /welcome so
     the existing resume effect in LandingNativePage completes the save.

   Share overlay reuses <ScanShareCard/>. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@/compat/router'
import { useServerFn } from '@tanstack/react-start'
import { saveSituation } from '@/lib/situations.functions'
import { supabase } from '@/integrations/supabase/client'
import { saveIntent } from '@/lib/auth-guard'
import { ScanShareCard, type ScanRecord } from '@/components/ScanShareCard'
import { CompanionEye } from '@/components/brand/CompanionEye'
import { appendUserRoom } from './SpillModal'
import { stripHTML, stripHTMLInline } from '@/lib/sanitize'

const SORA = "'Sora', system-ui, sans-serif"
const NEWSREADER = "'Newsreader', Georgia, serif"

// THE SCAN system prompt — measures the SITUATION against social norms,
// not felt intensity. See scan-turn.server.ts for the canonical persona.
const SCAN_SYSTEM = "you are THE SCAN on Shutap. you read a SITUATION against social norms and answer ONE question: 'how far outside normal is what happened, and how much should it concern me?' scored 0-999. you are NOT measuring how heavy it FEELS — feelings are ONE input, never the point. warm, plain, lowercase, texty, fully on their side. never say who's right or wrong (no AITA, no verdict, no blame, no diagnosis, never score a person). norms are cultural: 'most people in your context', never objective moral fact.\n\nBEFORE YOU SCORE, FILL THE FACT SPINE. required slots — each filled or explicitly declined before finishing: what_happened (concrete event, their words) · who (scrubbed referents) · said_done (ACTUAL words/actions, not characterisations) · context (what surrounded it) · justification (the reason the other party gave, or 'none' — THE SINGLE MOST IMPORTANT INPUT; ask it in EVERY scan) · frequency (one-off/repeated/ongoing) · stakes (what is concretely at risk) · their_response (what the user did/said/decided). feeling is captured ONCE, LATE, and NEVER the completion condition.\n\nSCORE RISES WITH: norm_distance (primary ↑) × justification (STRONGEST discount ↓) × boundary crossing (personal/bodily/relational/privacy ↑↑) × stakes + reversibility (↑) × pattern (multiplier ↑) × power_consent (↑↑ when absent). a high score REQUIRES unusual AND unjustified. unusual-but-justified stays LOW. anchors: MIL sharing your husband's bed, ongoing, no reason → ~850 · no-tip after genuinely bad service → ~150 · partner reads your phone once after a fight → ~450 · boss texts at 11pm every night → ~600.\n\nPERSONALISATION IS MANDATORY: every card after the opener quotes the user's own specifics back (their nouns, their words). a card that would make sense pasted into a stranger's Scan is not good enough — rewrite it with their nouns. interactivity: vary the input type EVERY step (never repeat the previous type), lean on the tactile widgets (spectrum, rank, rate, multi), always offer an escape hatch ('something else…' / 'let me say it in my own words'). aim ~8-11 cards. HARD RULE: card 1 or 2 MUST be free text asking what actually happened.\n\nBANNED OUTRIGHT: somatic probes ('where do you feel it in your body?', 'in my head vs in my body'), feeling ladders ('the feeling under that feeling', 'the fear at the bottom'), flat generics ('how does that make you feel?', standalone 'how long has this been sitting with you?'), therapy-speak ('hold space', 'sit with that', 'that's valid', 'i hear you', 'it sounds like', 'that must be hard'), advice tokens ('you should', 'try', 'consider', 'recommend'), verdicts ('nta', 'ytah'). NEVER fabricate a human count ('312 people said…') — the corpus is empty for now.\n\nreturn the JSON shapes the rest of the instructions require (a card object or the done/score object); never add prose outside the JSON. OUTPUT FORMAT: return PLAIN TEXT only in every string field — no HTML tags, no markdown, no <br>; never use </br>; use real newline characters if a break is needed."

// ─────────────────────────── types ───────────────────────────
type CardChoice   = { type: 'choice';   options?: string[] }
type CardMulti    = { type: 'multi';    options?: string[]; max?: number }
type CardRate     = { type: 'rate';     min_label?: string; max_label?: string }
type CardSpectrum = { type: 'spectrum'; left?: string; right?: string }
type CardRank     = { type: 'rank';     items?: string[] }
type CardText     = { type: 'text';     placeholder?: string }
type ScanCard = CardChoice | CardMulti | CardRate | CardSpectrum | CardRank | CardText

type Reasoning = {
  norm_distance?: string
  justification?: string
  boundary?: string
  stakes?: string
  pattern?: string
  power_consent?: string
}
type ScanTurn =
  | { done?: false; line?: string; prompt?: string; card?: ScanCard }
  | {
      done: true
      score?: number | string
      band?: string
      signature?: string
      read?: string
      factors?: string[]
      reasoning?: Reasoning
      basis?: string
      corpus_n?: number | null
      cultural_note?: string | null
      pillar?: string
    }

type QA = { prompt: string; answer: string; type?: ScanCard['type'] }
type ScanBandKey = 'within' | 'uncommon' | 'outside' | 'well_outside' | 'far_outside'
type Result = {
  score: number
  label: string
  sub: string
  factors: string[]
  pillar: string | null
  reasoning: Reasoning | null
  cultural_note: string | null
}

const bandFromScore = (n: number): ScanBandKey =>
  n < 200 ? 'within' : n < 400 ? 'uncommon' : n < 600 ? 'outside' : n < 800 ? 'well_outside' : 'far_outside'
const bandPhrase: Record<ScanBandKey, string> = {
  within: 'within normal',
  uncommon: 'uncommon',
  outside: 'outside normal',
  well_outside: 'well outside normal',
  far_outside: 'far outside normal',
}
const dbBand: Record<ScanBandKey, 'quiet' | 'real' | 'hot' | 'heavy' | 'serious'> = {
  within: 'quiet', uncommon: 'real', outside: 'hot', well_outside: 'heavy', far_outside: 'serious',
}
const scoreColor = (score: number): string =>
  score < 200 ? '#6f666c' : score < 400 ? '#7F77DD' : score < 600 ? '#c87c4a' : score < 800 ? '#a52a5f' : '#c1216b'

function pillarFromQA(qa: QA[]): string {
  const t = qa.map(x => x.answer + ' ' + x.prompt).join(' ').toLowerCase()
  if (/partner|husband|wife|boyfriend|girlfriend|marriage|spouse|\bex\b|dating|relationship/.test(t)) return 'relationships'
  if (/mom|mum|dad|father|mother|sister|brother|family|parent|\bson\b|daughter|kids?|child/.test(t)) return 'family'
  if (/boss|\bwork\b|\bjob\b|career|manager|coworker|colleague|office/.test(t)) return 'work'
  if (/friend|friendship/.test(t)) return 'friendship'
  return 'self'
}

function scrubPII(text: string): string {
  let t = text || ''
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
  t = t.replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[number]')
  t = t.replace(/(^|\s)@[A-Za-z0-9_]{3,}/g, (_m, p) => p + '[handle]')
  return t.trim()
}

function sanitizeTurn(t: ScanTurn): ScanTurn {
  if (!t || typeof t !== 'object') return t
  if ((t as { done?: boolean }).done) {
    const d = t as {
      done: true; score?: number | string; band?: string; signature?: string; read?: string;
      factors?: string[]; reasoning?: Reasoning; basis?: string; corpus_n?: number | null;
      cultural_note?: string | null; pillar?: string
    }
    const factors = Array.isArray(d.factors)
      ? d.factors.map(f => stripHTMLInline(String(f || ''))).filter(Boolean)
      : d.factors
    const cleanReasoning: Reasoning | undefined = d.reasoning
      ? Object.fromEntries(
          Object.entries(d.reasoning).map(([k, v]) => [k, v != null ? stripHTMLInline(String(v)) : v]),
        ) as Reasoning
      : d.reasoning
    return {
      ...d,
      band: d.band != null ? stripHTMLInline(String(d.band)) : d.band,
      signature: d.signature != null ? stripHTMLInline(String(d.signature)) : d.signature,
      read: d.read != null ? stripHTML(String(d.read)) : d.read,
      factors,
      reasoning: cleanReasoning,
      cultural_note: d.cultural_note != null ? stripHTMLInline(String(d.cultural_note)) : d.cultural_note,
    }
  }
  const c = t as { done?: false; line?: string; prompt?: string; card?: ScanCard }
  let card = c.card
  if (card) {
    const cleanArr = (arr?: string[]) => Array.isArray(arr)
      ? arr.map(s => stripHTMLInline(String(s || ''))).filter(Boolean)
      : arr
    if (card.type === 'choice') {
      card = { ...card, options: cleanArr(card.options) }
    } else if (card.type === 'multi') {
      card = { ...card, options: cleanArr(card.options) }
    } else if (card.type === 'rate') {
      card = {
        ...card,
        min_label: card.min_label != null ? stripHTMLInline(String(card.min_label)) : card.min_label,
        max_label: card.max_label != null ? stripHTMLInline(String(card.max_label)) : card.max_label,
      }
    } else if (card.type === 'spectrum') {
      card = {
        ...card,
        left: card.left != null ? stripHTMLInline(String(card.left)) : card.left,
        right: card.right != null ? stripHTMLInline(String(card.right)) : card.right,
      }
    } else if (card.type === 'rank') {
      card = { ...card, items: cleanArr(card.items) }
    } else if (card.type === 'text') {
      card = {
        ...card,
        placeholder: card.placeholder != null ? stripHTMLInline(String(card.placeholder)) : card.placeholder,
      }
    }
  }
  return {
    ...c,
    line: c.line != null ? stripHTML(String(c.line)) : c.line,
    prompt: c.prompt != null ? stripHTMLInline(String(c.prompt)) : c.prompt,
    card,
  }
}

async function callScanAI(qa: QA[], aliasName: string | null): Promise<ScanTurn> {
  const transcript = qa.map((x, i) => (i + 1) + '. ' + x.prompt + ' -> ' + x.answer).join('\n') || '(nothing yet)'
  const n = qa.length
  const hasText = qa.some(x => x.type === 'text')
  const finishHint = n >= 11
    ? 'You are deep enough - reflect the core back and finish with the result now.'
    : n >= 7
      ? 'Only finish if you have TRULY reached the emotional core (the fear/need/grief underneath) and it landed for them. If you are still on feelings or facts, go one layer DEEPER instead.'
      : 'Do NOT finish yet - you are still near the surface. dig.'
  // Verbatim from Landing.dc.html openScan() sys builder (line 1526).
  const sysHead = "You are THE SCAN on Shutap — you read a SITUATION against social norms and answer ONE question: 'how far outside normal is what happened, and how much should i be concerned?' scored 0-999. you are NOT measuring how heavy it FEELS — feelings are ONE input, never the point. warm, plain, lowercase, texty, fully on their side. never say who's right or wrong (no AITA, no verdict, no blame, no diagnosis, never score a person). norms are cultural: 'most people in your context', never objective moral fact.\n\nADAPTIVE FLOW: each step you design the NEXT input card, REACTING specifically to what they just said and quoting their own specifics back (their nouns, their words). VARY the input type EVERY step — never repeat the same kind twice in a row, and lean on the tactile widgets (spectrum, rank, rate, multi) more than plain choice. any choice/multi card MUST include an escape hatch ('something else…' / 'let me say it in my own words'). aim ~8-11 cards. HARD RULE: card 1 or card 2 MUST be a free-text card asking what actually happened, in their own words (type 'text', e.g. prompt \"what actually happened — tell me in your own words?\", placeholder \"just say it…\"). you cannot score what you have not heard.\n\nFILL THE FACT SPINE BEFORE YOU SCORE. required slots — each filled or explicitly declined before finishing: what_happened · who · said_done (their ACTUAL words/actions) · context · justification (the reason the other party gave, or 'none' — THE SINGLE MOST IMPORTANT INPUT; ask it in EVERY scan) · frequency (one-off/repeated/ongoing) · stakes · their_response. feeling is captured ONCE, LATE, and never the completion condition.\n\nSCORE RISES WITH: norm_distance (primary ↑) × justification (STRONGEST discount ↓) × boundary crossing (personal/bodily/relational/privacy ↑↑) × stakes + reversibility (↑) × pattern (multiplier ↑) × power_consent (↑↑ when absent). a high score REQUIRES unusual AND unjustified. unusual-but-justified stays LOW. anchors: MIL sharing your husband's bed, ongoing, no reason → ~850 · no-tip after genuinely bad service → ~150 · partner reads your phone once after a fight → ~450 · boss texts at 11pm every night → ~600.\n\nBANNED OUTRIGHT: somatic probes ('where do you feel it in your body?'), feeling ladders ('the feeling under that feeling', 'the fear at the bottom'), flat generics ('how does that make you feel?'), therapy-speak, advice tokens ('you should', 'try', 'consider', 'recommend'), verdicts ('nta', 'ytah'). NEVER fabricate a human count ('312 people said…') — the corpus is empty for now.\n\nCARD TYPES: choice (options:[4-7]) · multi (options:[5-9], max:int) · rate (min_label, max_label) · spectrum (left, right) · rank (items:[4-6]) · text (placeholder).\n\nReturn STRICT JSON, exactly ONE of:\n{\"line\":\"<short warm reaction that quotes their own specifics back>\",\"prompt\":\"<the question, short, specific, personalised>\",\"card\":{\"type\":\"...\", ...fields}}\nOR when the fact spine is full:\n{\"done\":true,\"score\":<int 0-999>,\"band\":\"within normal|uncommon|outside normal|well outside normal|far outside normal\",\"signature\":\"<3-4 word Title Case>\",\"read\":\"<2 sentences naming WHAT makes this unusual and what (if anything) justifies it — observation only, never advice, never a verdict on a person>\",\"reasoning\":{\"norm_distance\":\"<line + 0-100>\",\"justification\":\"<what was offered or 'none' + 0-100 discount>\",\"boundary\":\"<which boundary or 'none'>\",\"stakes\":\"<concrete>\",\"pattern\":\"one_off|repeated|ongoing\",\"power_consent\":\"<could they say no?>\"},\"factors\":[\"<2-4 word driver>\",\"...\"],\"basis\":\"model_prior\",\"corpus_n\":null,\"cultural_note\":\"<null or one line acknowledging norms differ by context>\"}\nNEVER return the done object unless the transcript contains at least one free-text answer describing what happened. if you are about to finish without one, ask a text card first."
  const sys = sysHead
    + "\n\n"
    + (aliasName
        ? "the user goes by \"" + aliasName + "\" — use their name warmly. NEVER output a placeholder token like [user_alias], [user alias], [alias], or [name].\n"
        : "you do NOT know the user's alias. do not use any name for them, and NEVER output a placeholder token like [user_alias], [user alias], [alias], or [name] — just talk to them directly.\n")
    + "\n=== what they have told you ===\n"
    + transcript
    + "\n\n"
    + finishHint
    + (n >= 1 && !hasText ? "\nIMPORTANT: you still have NO free-text answer from them. your next card MUST be type 'text' asking what actually happened." : "")
    + "\nOUTPUT FORMAT: return PLAIN TEXT only in every string field — no HTML tags, no markdown, no <br>; never use </br>; use real newline characters if a break is needed.\noutput ONLY the JSON."

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  const res = await fetch('/api/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      messages: [{ role: 'user', content: sys }],
      system: SCAN_SYSTEM,
      maxTokens: 1500,
    }),
  })
  if (!res.ok) throw new Error('scan http ' + res.status)
  const j = (await res.json()) as { text?: string; error?: string }
  const raw = j.text ?? ''
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '')
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no json')
  const turn = sanitizeTurn(JSON.parse(m[0]) as ScanTurn)
  const ph = /\[\s*(user[ _-]?alias|user[ _-]?name|alias|name)\s*\]/gi
  const strip = (s: string | null | undefined): string | null | undefined => {
    if (s == null) return s
    let out = String(s)
    if (aliasName) out = out.replace(ph, aliasName)
    else out = out.replace(ph, '').replace(/,\s*([.!?…])/g, '$1').replace(/\s+([,.!?…])/g, '$1').replace(/[ \t]{2,}/g, ' ')
    return out
  }
  const t = turn as Record<string, unknown>
  if (typeof t.line === 'string') t.line = strip(t.line as string) as string
  if (typeof t.prompt === 'string') t.prompt = strip(t.prompt as string) as string
  if (typeof t.read === 'string') t.read = strip(t.read as string) as string
  return turn
}


// Fallback deck — norm/situation cards that fill the fact spine. No somatic
// probes, no feeling ladders. Used only if the LLM call fails.
function scanFallback(n: number, hasText: boolean): ScanTurn {
  const seq: ScanTurn[] = [
    { line: "ok, i'm here. we're going to figure out how far outside normal this actually is — fully on your side.", prompt: "what's this mostly about?", card: { type: 'choice', options: ['a partner / spouse', 'a family member', 'a friend', 'a boss or coworker', 'a stranger / situation', 'something else'] } },
    { line: "okay. tell me the shape of it —", prompt: 'what actually happened? a few words in your own words.', card: { type: 'text', placeholder: 'just say it…' } },
    { line: 'got it.', prompt: 'what did they actually say or do — the specifics?', card: { type: 'text', placeholder: 'their words / the actions…' } },
    { line: 'okay — and this next one really matters.', prompt: 'did they give a reason for it?', card: { type: 'choice', options: ['no reason at all', 'a weak/thin reason', 'a reason but it doesn\'t hold up', 'a reason i understand', 'something else…'] } },
    { line: 'noted.', prompt: 'how often does this happen?', card: { type: 'choice', options: ['first time / one-off', 'a handful of times', 'repeated pattern', 'ongoing / constant', 'something else…'] } },
    { line: 'and be honest —', prompt: 'what feels actually at risk here?', card: { type: 'multi', options: ['trust', 'the relationship itself', 'your peace / rest', 'money or work', 'your privacy', 'your safety', 'nothing concrete'], max: 3 } },
    { line: 'okay.', prompt: 'could you have said no or pushed back safely?', card: { type: 'spectrum', left: 'easily', right: 'not really' } },
    { line: 'last thing before i read it —', prompt: 'what did you actually do or say back?', card: { type: 'text', placeholder: 'briefly…' } },
  ]
  if (!hasText && n >= 1 && n < seq.length) return seq[1]
  if (n >= seq.length) return {
    done: true,
    score: 500,
    band: 'outside normal',
    signature: 'Somewhere Outside Normal',
    read: "from what you shared, this sits outside what most people would call ordinary — the reason (or lack of one) is doing a lot of the work here. worth taking seriously.",
    reasoning: { norm_distance: 'moderate', justification: 'weak or none', boundary: 'unclear', stakes: 'real', pattern: 'unclear', power_consent: 'unclear' },
    factors: ['thin reason', 'not just you'],
    basis: 'model_prior',
    corpus_n: null,
    cultural_note: null,
  }
  return seq[n]
}

// ─────────────────────────── tiny UI atoms ───────────────────────────
function CompanionSVG({ size = 34 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', flex: 'none' }}>
      <CompanionEye size={size} />
    </span>
  )
}

function BlinkDots({ colour = '#7F77DD' }: { colour?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      <i style={{ width: 5, height: 5, borderRadius: '50%', background: colour, display: 'block', animation: 'blinkdot 1.2s infinite' }} />
      <i style={{ width: 5, height: 5, borderRadius: '50%', background: colour, display: 'block', animation: 'blinkdot 1.2s .2s infinite' }} />
      <i style={{ width: 5, height: 5, borderRadius: '50%', background: colour, display: 'block', animation: 'blinkdot 1.2s .4s infinite' }} />
    </span>
  )
}

function ScanHeader({ pct, onClose, minimal = false }: { pct: number; onClose: () => void; minimal?: boolean }) {
  return (
    <div style={{ flex: 'none', padding: '20px 22px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 13, letterSpacing: '.3em', color: '#7F77DD' }}>SCAN</div>
      {!minimal && (
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.10)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: pct + '%',
            background: 'linear-gradient(90deg,#5B8A5E,#7F77DD)',
            borderRadius: 3,
            boxShadow: '0 0 10px rgba(127,119,221,.7)',
            transition: 'width .8s cubic-bezier(.16,1,.3,1)',
          }} />
        </div>
      )}
      {minimal && <div style={{ flex: 1 }} />}
      <div role="button" onClick={onClose} style={{ fontFamily: SORA, fontWeight: 600, fontSize: 12, color: '#6f666c', cursor: 'pointer' }}>close</div>
    </div>
  )
}

function NextBtn({ enabled, onClick, label }: { enabled: boolean; onClick: () => void; label?: string }) {
  return (
    <div role="button" onClick={() => enabled && onClick()} style={{
      marginTop: 22, alignSelf: 'flex-start', cursor: enabled ? 'pointer' : 'default',
      background: '#7F77DD', color: '#fff', borderRadius: 999, padding: '12px 26px',
      fontFamily: SORA, fontWeight: 700, fontSize: 14, transition: '.15s',
      opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? 'auto' : 'none',
    }}>{label || 'next →'}</div>
  )
}

// ─────────────────────────── widgets ───────────────────────────
// ─────────────────────────── widgets ───────────────────────────
function ChoiceW({ card, onPick }: { card: CardChoice; onPick: (v: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  const handle = (o: string) => {
    if (picked) return
    setPicked(o)
    window.setTimeout(() => onPick(o), 240)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {(card.options || ['ok']).map((o, i) => {
        const on = picked === o
        return (
          <div key={i} role="button" onClick={() => handle(o)}
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
              padding: '17px 19px',
              border: '1px solid ' + (on ? '#7F77DD' : 'rgba(127,119,221,.22)'),
              background: on ? '#7F77DD' : 'rgba(127,119,221,.06)',
              borderRadius: 16,
              fontFamily: SORA, fontWeight: 600, fontSize: 16.5,
              color: on ? '#fff' : '#ece6f5',
              transition: 'transform .18s, background .18s, border-color .18s, box-shadow .18s',
              transform: on ? 'scale(1.02)' : 'none',
              opacity: 0,
              animation: `slideIn .4s ease-out ${i * 0.07}s forwards`,
            }}
            onMouseOver={e => {
              if (picked) return
              const s = e.currentTarget.style
              s.borderColor = '#7F77DD'
              s.background = 'rgba(127,119,221,.16)'
              s.transform = 'translateX(6px)'
              s.boxShadow = '0 0 22px -8px rgba(127,119,221,.7)'
            }}
            onMouseOut={e => {
              if (picked) return
              const s = e.currentTarget.style
              s.borderColor = 'rgba(127,119,221,.22)'
              s.background = 'rgba(127,119,221,.06)'
              s.transform = 'none'
              s.boxShadow = 'none'
            }}
          >{o}</div>
        )
      })}
    </div>
  )
}

function MultiW({ card, onDone }: { card: CardMulti; onDone: (v: string) => void }) {
  const max = card.max || 99
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [warn, setWarn] = useState<string | null>(null)
  const toggle = (o: string) => {
    setSel(prev => {
      const n = new Set(prev)
      if (n.has(o)) { n.delete(o); return n }
      if (n.size >= max) {
        setWarn(`pick up to ${max}`)
        window.setTimeout(() => setWarn(null), 1600)
        return prev
      }
      n.add(o)
      return n
    })
  }
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 6 }}>
        {(card.options || []).map((o, i) => {
          const on = sel.has(o)
          return (
            <div key={i} role="button" onClick={() => toggle(o)} style={{
              cursor: 'pointer', padding: '11px 15px',
              border: '1px solid ' + (on ? '#7F77DD' : 'rgba(127,119,221,.25)'),
              background: on ? '#7F77DD' : 'rgba(127,119,221,.06)',
              borderRadius: 999, fontFamily: SORA, fontWeight: 600, fontSize: 14,
              color: on ? '#fff' : '#ece6f5', transition: '.12s',
            }}>{o}</div>
          )
        })}
      </div>
      {warn && (
        <div style={{ marginTop: 10, fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13, color: '#f7b8d4' }}>{warn}</div>
      )}
      <NextBtn enabled={sel.size > 0} onClick={() => onDone([...sel].join(', '))} />
    </>
  )
}

function RateW({ card, onDone }: { card: CardRate; onDone: (v: string) => void }) {
  const [val, setVal] = useState(5)
  const col = val >= 8 ? '#a52a5f' : val >= 5 ? '#9a93e8' : '#7F77DD'
  const scale = 1 + val * 0.035
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        fontFamily: SORA, fontWeight: 800, fontSize: 52,
        color: col, textAlign: 'center', marginBottom: 10,
        fontVariantNumeric: 'tabular-nums',
        transform: `scale(${scale})`, transformOrigin: 'center',
        transition: 'transform .18s, color .18s',
      }}>{val}</div>
      <input type="range" min={0} max={10} step={1} value={val} onChange={e => setVal(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#7F77DD', height: 6, cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13, color: '#9b8db5' }}>
        <span>{card.min_label || 'low'}</span><span>{card.max_label || 'high'}</span>
      </div>
      <NextBtn enabled onClick={() => onDone(val + '/10 (toward "' + (card.max_label || 'high') + '")')} />
    </div>
  )
}
function SpectrumW({ card, onDone }: { card: CardSpectrum; onDone: (v: string) => void }) {
  const [pos, setPos] = useState(50)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)
  const setFromX = (x: number) => {
    const t = trackRef.current; if (!t) return
    const r = t.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, Math.round((x - r.left) / r.width * 100))))
  }
  useEffect(() => {
    const mv = (e: PointerEvent) => { if (dragRef.current) setFromX(e.clientX) }
    const up = () => { dragRef.current = false }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }
  }, [])
  return (
    <div style={{ marginTop: 22, userSelect: 'none' }}>
      <div
        ref={trackRef}
        onPointerDown={e => { dragRef.current = true; setFromX(e.clientX); e.preventDefault() }}
        style={{ position: 'relative', height: 10, borderRadius: 5, background: 'linear-gradient(90deg,rgba(127,119,221,.3),rgba(231,84,138,.45))', cursor: 'pointer' }}
      >
        <div style={{ position: 'absolute', top: '50%', left: pos + '%', transform: 'translate(-50%,-50%)', width: 30, height: 30, borderRadius: '50%', background: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,.45)', border: '3px solid #7F77DD', cursor: 'grab' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 16, fontFamily: SORA, fontWeight: 600, fontSize: 13.5, color: '#ccbff0' }}>
        <span style={{ maxWidth: '44%' }}>{card.left || 'this'}</span>
        <span style={{ maxWidth: '44%', textAlign: 'right' }}>{card.right || 'that'}</span>
      </div>
      <NextBtn enabled onClick={() => {
        const ans = pos < 40 ? ('toward "' + (card.left || 'this') + '" (' + pos + '%)')
          : pos > 60 ? ('toward "' + (card.right || 'that') + '" (' + pos + '%)')
          : ('balanced between "' + (card.left || 'this') + '" and "' + (card.right || 'that') + '"')
        onDone(ans)
      }} />
    </div>
  )
}
function RankW({ card, onDone }: { card: CardRank; onDone: (v: string) => void }) {
  const [order, setOrder] = useState<string[]>(() => (card.items || []).slice())
  const dragIdx = useRef<number | null>(null)
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 8 }}>
        {order.map((it, i) => (
          <div key={it + i}
            draggable
            onDragStart={() => { dragIdx.current = i }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const from = dragIdx.current; if (from === null || from === i) return
              const next = order.slice()
              const [mv] = next.splice(from, 1)
              next.splice(i, 0, mv)
              dragIdx.current = null
              setOrder(next)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid rgba(127,119,221,.22)', background: 'rgba(127,119,221,.07)', borderRadius: 12, fontFamily: SORA, fontWeight: 600, fontSize: 14.5, color: '#ece6f5', cursor: 'grab' }}>
            <span style={{ fontFamily: SORA, fontWeight: 800, color: '#7F77DD', flex: 'none' }}>{i + 1}</span>
            <span style={{ flex: 1 }}>{it}</span>
            <span style={{ color: '#6f6790', flex: 'none', letterSpacing: '-2px' }}>::</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 12.5, color: '#8d80ab' }}>drag to order them - heaviest on top</div>
      <NextBtn enabled onClick={() => onDone(order.map((x, i) => (i + 1) + '. ' + x).join('; '))} />
    </div>
  )
}
function TextW({ card, onDone }: { card: CardText; onDone: (v: string) => void }) {
  const [v, setV] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 150) }, [])
  const go = () => { const t = v.trim(); if (!t) return; onDone(scrubPII(t)) }
  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', gap: 10, background: 'rgba(127,119,221,.08)', border: '1px solid rgba(127,119,221,.25)', borderRadius: 15, padding: '13px 15px' }}>
      <textarea
        ref={ref}
        rows={2}
        value={v}
        onChange={e => { setV(e.target.value); const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(120, el.scrollHeight) + 'px' }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }}
        placeholder={card.placeholder || 'in a few words...'}
        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#f3eefb', fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 16, resize: 'none', maxHeight: 120, lineHeight: 1.5 }}
      />
      <div role="button" onClick={go} style={{ fontFamily: SORA, fontWeight: 700, fontSize: 13, color: '#7F77DD', cursor: 'pointer', flex: 'none', paddingBottom: 3 }}>send →</div>
    </div>
  )
}

// ─────────────────────────── ScanModal ───────────────────────────
type Phase = 'loading' | 'card' | 'result' | 'composing' | 'preview' | 'saving'
type Composed = { title: string; body: string; edit_summary: string }

export function ScanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const save = useServerFn(saveSituation)

  const [qa, setQA] = useState<QA[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [current, setCurrent] = useState<{ line: string; prompt: string; card: ScanCard } | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [displayScore, setDisplayScore] = useState(0)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [composed, setComposed] = useState<Composed | null>(null)
  const qaRef = useRef<QA[]>([])
  qaRef.current = qa

  // reset + lock scroll on open
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    setQA([]); setResult(null); setShareOpen(false); setDisplayScore(0); setSaveNote(null); setComposed(null)
    setPhase('loading'); setCurrent(null)
    return () => { document.body.style.overflow = '' }
  }, [open])

  // fetch next card whenever phase transitions to loading
  const fetchNext = useCallback(async () => {
    setPhase('loading')
    const hasText = qaRef.current.some(x => x.type === 'text')
    let res: ScanTurn
    try {
      let aliasName: string | null = null
      try {
        const raw = localStorage.getItem('shutap_alias')
        if (raw) aliasName = (JSON.parse(raw) as { name?: string })?.name || null
      } catch { /* ignore */ }
      res = await callScanAI(qaRef.current, aliasName)
    } catch {
      res = scanFallback(qaRef.current.length, hasText)
    }
    // Guard: never finish before we've heard them in their own words.
    if ('done' in res && res.done && !hasText && qaRef.current.length < 11) {
      res = {
        line: "wait — before i read you, say it in your own words.",
        prompt: "what actually happened?",
        card: { type: 'text', placeholder: 'whatever it is, just say it…' },
      }
    }
    if ('done' in res && res.done) {
      const score = Math.max(0, Math.min(999, parseInt(String(res.score), 10) || 400))
      const factors = Array.isArray(res.factors) ? res.factors.slice(0, 6) : []
      const r: Result = {
        score,
        label: res.signature || "Where You're At",
        sub: res.read || '',
        factors,
        pillar: pillarFromQA(qaRef.current),
        reasoning: (res.reasoning ?? null) as Reasoning | null,
        cultural_note: res.cultural_note ?? null,
      }
      setResult(r)
      setPhase('result')
      // animated count-up (matches iframe scanShowResult ~1717)
      const step = Math.max(1, Math.ceil(score / 38))
      let cur = 0
      const tick = window.setInterval(() => {
        cur = Math.min(cur + step, score)
        setDisplayScore(cur)
        if (cur >= score) window.clearInterval(tick)
      }, 28)
      return
    }
    const c = res.card || { type: 'choice', options: ['ok'] }
    setCurrent({ line: res.line || '', prompt: res.prompt || '', card: c })
    setPhase('card')
  }, [])

  useEffect(() => {
    if (open && phase === 'loading' && !current && !result) void fetchNext()
  }, [open, phase, current, result, fetchNext])

  const submitAnswer = useCallback((answer: string) => {
    if (!current) return
    setQA(prev => [...prev, { prompt: current.prompt, answer, type: current.card.type }])
    setCurrent(null)
    setPhase('loading')
  }, [current])

  // ─────────── compose (public "post to a room" only) ───────────
  const runCompose = useCallback(async () => {
    if (!result) return
    setPhase('composing')
    const freeText = qaRef.current
      .filter(x => x.type === 'text' && String(x.answer || '').trim())
      .map(x => String(x.answer).trim())
    const skeleton = qaRef.current
      .map((x, i) => `Q${i + 1} (${x.type || 'text'}): ${x.prompt}\nA${i + 1}: ${x.answer}`)
      .join('\n\n')
    const fallbackBody = (freeText.length ? freeText.join('\n\n') : qaRef.current.map(x => String(x.answer)).filter(Boolean).join('\n\n')).trim()
    const fallbackTitle = (freeText[0] || result.label).replace(/\s+/g, ' ').trim().slice(0, 72) || result.label

    let c: Composed
    try {
      const prompt =
        'You are THE SCAN on Shutap. Compose the user\u2019s scan conversation into a public-ready post that will open their Room \u2014 a full-sentence first-person NARRATIVE in THEIR voice, NOT a Q&A dump and NOT the scan\u2019s 2-sentence "read". Use the Q/A transcript as the logical spine (what happened \u2192 who / what was said or done \u2192 justification the other party gave \u2192 frequency \u2192 stakes). Free-text answers carry the story; widget answers (choice/multi/rate/spectrum/rank) add texture \u2014 weave them as supporting detail; do NOT quote raw widget strings like "3/10 (toward \u2018years now\u2019)" verbatim.\n\n' +
        'THE 80/20 RULE \u2014 LANGUAGE, NOT CONTENT.\n' +
        '~80% stays THEIRS: their account, specifics, quotes, emotional beats, voice, idiom, capitalization, profanity; the meaning is EXACTLY what they said.\n' +
        'Up to ~20% is polish AT THE LANGUAGE LEVEL ONLY: grammar, spelling, smoothing choppy phrasing, connective transitions between beats, cutting filler.\n\n' +
        'HARD LINE: improve HOW it\u2019s said, never WHAT is said. NEVER add a fact, event, person, motive, quote, or feeling they didn\u2019t give. NEVER make it more dramatic than they lived it. NEVER put words in the other party\u2019s mouth. NEVER paste in the scan\u2019s "read" or "signature". If a smoother sentence would imply something they didn\u2019t say, don\u2019t write it.\n\n' +
        'title = their own hook, tightened to ONE line (lowercase ok). body = 2\u20135 short first-person paragraphs. edit_summary = one plain line naming the kind of polish applied (e.g. "fixed grammar and smoothed the order; no details added"). Do NOT list what you added \u2014 you added nothing.\n\n' +
        'the scan conversation (already anonymized \u2014 keep it that way):\n"""\n' + skeleton + '\n"""\n\n' +
        'OUTPUT FORMAT: return PLAIN TEXT only in the title and body fields \u2014 no HTML tags, no markdown, no <br>; use real newline characters (\\n\\n) between paragraphs.\n\n' +
        'return STRICT JSON only: {"title":"...","body":"...","edit_summary":"..."}'
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], system: SCAN_SYSTEM, maxTokens: 1500 }),
      })
      if (!res.ok) throw new Error('compose http ' + res.status)
      const j = (await res.json()) as { text?: string; error?: string }
      const raw = j.text ?? ''
      const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '')
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('no json')
      const parsed = JSON.parse(m[0]) as { title?: string; body?: string; edit_summary?: string }
      const t = scrubPII(stripHTMLInline(String(parsed.title || ''))).slice(0, 120)
      const b = scrubPII(stripHTML(String(parsed.body || '')))
      if (!t || !b) throw new Error('empty compose')
      c = {
        title: t,
        body: b,
        edit_summary: typeof parsed.edit_summary === 'string' ? parsed.edit_summary.trim().slice(0, 200) : '',
      }
    } catch (e) {
      console.warn('[scan compose] falling back to user words', e)
      c = {
        title: scrubPII(stripHTMLInline(fallbackTitle)),
        body: scrubPII(stripHTML(fallbackBody || result.label)),
        edit_summary: '',
      }
    }
    setComposed(c)
    setPhase('preview')
  }, [result])

  // ─────────── persist ───────────
  const doPersist = useCallback(async (isPublic: boolean) => {
    if (!result) return
    const band = bandFromScore(result.score)
    const pillar = (result.pillar === 'family' ? 'family'
      : result.pillar === 'work' ? 'career'
      : result.pillar === 'friendship' ? 'relationships'
      : result.pillar === 'self' ? 'relationships'
      : 'relationships') as 'relationships' | 'marriage' | 'family' | 'career'
    const title = isPublic && composed ? composed.title : result.label
    const body = isPublic && composed ? composed.body : result.sub
    const payload = {
      kind: 'scan' as const,
      pillar,
      clean_text: body || title,
      title,
      body,
      tags: result.factors,
      initial_scan: result.score,
      scan_band: dbBand[band],
      is_public: isPublic,
      support_mode: 'heard' as const,
      scan_reasoning: result.reasoning
        ? (Object.fromEntries(
            Object.entries(result.reasoning).map(([k, v]) =>
              typeof v === 'string' ? [k, v.slice(0, k === 'pattern' ? 60 : 200)] : [k, v],
            ),
          ) as Reasoning)
        : null,
      scan_basis: 'model_prior' as const,
      scan_corpus_n: null,
      scan_cultural_note: result.cultural_note ?? null,
    }
    setPhase('saving')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const isAnon = Boolean((sess.session?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous)
      if (!sess.session || isAnon) {
        sessionStorage.setItem('shutap_pending_save', JSON.stringify(payload))
        saveIntent({ kind: 'scan' })
        navigate('/welcome')
        return
      }
      const res = await save({ data: payload as never })
      if (isPublic && res?.room_id) {
        appendUserRoom({
          id: res.room_id,
          title,
          body,
          support: 'heard',
          pillar,
          kind: 'scan',
          initial_scan: result.score,
          scan_band: band,
          scan_signature: result.label,
        })
      }
      setTimeout(() => {
        if (isPublic && res?.room_id) navigate(`/stream#room-${res.room_id}`)
        else navigate('/profile')
      }, 550)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[scan save]', e)
      if (msg.includes('sign_in_required')) {
        try {
          sessionStorage.setItem('shutap_pending_save', JSON.stringify(payload))
          saveIntent({ kind: 'scan' })
        } catch { /* noop */ }
        navigate('/welcome')
        return
      }
      setSaveNote("couldn't save — something hiccuped on our side. try again in a sec.")
      setPhase('result')
    }
  }, [result, composed, save, navigate])

  if (!open) return null

  const pct = phase === 'result' ? 100 : Math.min(90, (qa.length + (phase === 'card' ? 1 : 0)) * 8)
  const col = result ? scoreColor(result.score) : '#7F77DD'
  const band: ScanBandKey = result ? bandFromScore(result.score) : 'within'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#100c14', display: 'flex', flexDirection: 'column' }}>
      <ScanHeader pct={pct} onClose={onClose} minimal={phase === 'result' || phase === 'saving'} />

      {phase === 'loading' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center', gap: 22 }}>
          <div style={{ position: 'relative', padding: 18 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, border: '1px solid rgba(127,119,221,.35)', boxShadow: '0 0 26px -8px rgba(127,119,221,.6)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(180deg, rgba(127,119,221,0), rgba(127,119,221,.25), rgba(127,119,221,0))', animation: 'scanbeam 1.4s ease-in-out infinite' }} />
            </div>
            <CompanionSVG size={38} />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 15, color: '#b3a0d0' }}>
            <span>{qa.length ? 'reading that' : 'tuning in'}</span>
            <BlinkDots />
          </div>
        </div>
      )}

      {phase === 'card' && current && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 30px', maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeUp .45s ease-out' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <CompanionSVG size={26} />
            <div style={{ flex: 1, fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14.5, lineHeight: 1.5, color: '#b3a0d0' }}>{current.line}</div>
          </div>
          {current.prompt && (
            <h2 style={{ fontFamily: SORA, fontWeight: 800, fontSize: 'clamp(24px,5vw,34px)', lineHeight: 1.14, letterSpacing: '-.03em', color: '#fdfbf9', margin: '2px 0' }}>{current.prompt}</h2>
          )}
          {current.card.type === 'multi'    && <MultiW    key={qa.length} card={current.card} onDone={submitAnswer} />}
          {current.card.type === 'rate'     && <RateW     key={qa.length} card={current.card} onDone={submitAnswer} />}
          {current.card.type === 'spectrum' && <SpectrumW key={qa.length} card={current.card} onDone={submitAnswer} />}
          {current.card.type === 'rank'     && <RankW     key={qa.length} card={current.card} onDone={submitAnswer} />}
          {current.card.type === 'text'     && <TextW     key={qa.length} card={current.card} onDone={submitAnswer} />}
          {current.card.type === 'choice'   && <ChoiceW   key={qa.length} card={current.card} onPick={submitAnswer} />}
        </div>
      )}

      {phase === 'result' && result && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 36px', maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 'clamp(72px,16vw,108px)', letterSpacing: '-.04em', lineHeight: 1, color: col }}>{displayScore}</div>
            <div style={{ marginTop: 8, fontFamily: SORA, fontWeight: 700, fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', color: col }}>{bandPhrase[band]}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
            {result.pillar && (
              <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: col, background: col + '22', border: '.5px solid ' + col + '55', borderRadius: 999, padding: '4px 12px' }}>{result.pillar}</span>
            )}
            {result.factors.map((f, i) => (
              <span key={i} style={{ fontFamily: SORA, fontWeight: 600, fontSize: 10.5, color: '#b9a9e6', background: 'rgba(127,119,221,.14)', borderRadius: 999, padding: '4px 11px' }}>{f}</span>
            ))}
          </div>
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)', borderRadius: 16, padding: 20 }}>
            <CompanionSVG size={28} />
            <div style={{ marginTop: 12, fontFamily: SORA, fontWeight: 800, fontSize: 20, color: '#fdfbf9', marginBottom: 8 }}>{result.label}</div>
            <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 15.5, color: '#c4a0b2', lineHeight: 1.55 }}>{result.sub}</div>
          </div>
          <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14.5, color: '#6f666c', textAlign: 'center' }}>this is your read. keep it just for you, or let a room hold your number too.</div>
          <div role="button" onClick={() => navigate('/mirror')} style={{ cursor: 'pointer', background: 'rgba(231,84,138,.08)', border: '.5px solid rgba(231,84,138,.22)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <CompanionSVG size={24} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14.5, color: '#fdfbf9', lineHeight: 1.45 }}>this is one moment. i am holding the whole pattern — every scan adds to the picture of you.</div>
              <div style={{ marginTop: 6, fontFamily: SORA, fontWeight: 700, fontSize: 12.5, color: '#f7b8d4' }}>see your mirror →</div>
            </div>
          </div>
          {saveNote && (
            <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13.5, color: '#a8d4a9', textAlign: 'center' }}>{saveNote}</div>
          )}
          <div role="button" onClick={() => setShareOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, background: 'linear-gradient(120deg,#ff7eb3,#c1216b)', borderRadius: 14, cursor: 'pointer' }}>
            <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 14, color: '#fff' }}>share your score</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div role="button" onClick={() => void doPersist(false)} style={{ padding: 18, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)', borderRadius: 14, cursor: 'pointer' }}>
              <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6f666c', marginBottom: 7 }}>keep private</div>
              <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#fdfbf9', lineHeight: 1.4 }}>yours alone. saved to your journal.</div>
            </div>
            <div role="button" onClick={() => void runCompose()} style={{ padding: 18, background: 'rgba(231,84,138,.10)', border: '1.5px solid rgba(231,84,138,.35)', borderRadius: 14, cursor: 'pointer' }}>
              <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f7b8d4', marginBottom: 7 }}>post to a room</div>
              <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#fdfbf9', lineHeight: 1.4 }}>i'll write it up in your words — you check it first.</div>
            </div>
          </div>
        </div>
      )}

      {phase === 'composing' && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '34px 22px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <CompanionSVG size={50} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 15, color: '#b3a0d0' }}>
              <span>writing it up in your words</span>
              <BlinkDots />
            </div>
          </div>
        </div>
      )}

      {phase === 'preview' && composed && result && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 36px', maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#f7b8d4' }}>preview your post</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: col, background: col + '22', border: '.5px solid ' + col + '55', borderRadius: 999, padding: '4px 12px' }}>{result.score} · {bandPhrase[band]}</span>
            <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#b9a9e6', background: 'rgba(127,119,221,.14)', borderRadius: 999, padding: '4px 12px' }}>{result.label}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 20, color: '#fdfbf9', marginBottom: 12, lineHeight: 1.25 }}>{composed.title}</div>
            <div style={{ fontFamily: NEWSREADER, fontSize: 15.5, color: '#e8dcf0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{composed.body}</div>
          </div>
          {composed.edit_summary && (
            <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 13.5, color: '#6f666c', textAlign: 'center' }}>{composed.edit_summary}</div>
          )}
          <div style={{ fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 14, color: '#6f666c', textAlign: 'center' }}>still your words — did i keep it true?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div role="button" onClick={() => { setComposed(null); setPhase('result') }} style={{ padding: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)', borderRadius: 14, cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 13, color: '#fdfbf9' }}>back</div>
            </div>
            <div role="button" onClick={() => void doPersist(true)} style={{ padding: 16, background: 'linear-gradient(120deg,#ff7eb3,#c1216b)', borderRadius: 14, cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 13, color: '#fff' }}>post it →</div>
            </div>
          </div>
        </div>
      )}

      {phase === 'saving' && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '34px 22px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <CompanionSVG size={50} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: NEWSREADER, fontStyle: 'italic', fontSize: 15, color: '#b3a0d0' }}>
              <span>saving your read</span>
              <BlinkDots />
            </div>
          </div>
        </div>
      )}

      {shareOpen && result && (
        <ScanShareCard
          record={{
            score: result.score,
            signature: result.label,
            read: result.sub,
            factors: result.factors,
            pillar: result.pillar || null,
          } satisfies ScanRecord}
          onClose={() => setShareOpen(false)}
          toast={() => { /* no toast surface in native landing yet */ }}
        />
      )}

      <style>{`
        @keyframes scanbeam { 0% { transform: translateY(-120%); } 100% { transform: translateY(320%); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          [style*="scanbeam"], [style*="slideIn"], [style*="fadeUp"] { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  )
}
