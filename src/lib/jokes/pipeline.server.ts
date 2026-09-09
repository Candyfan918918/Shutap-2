// The joke-card generator: three model stages and a floor.
//
//   1 · PREMISE PASS   once per set, cached on joke_sets.premises. Twelve
//                      observations about the situation, four marked used.
//   2 · CANDIDATE PASS once per flip. Ten lines in one call, in the set's
//                      voice, for this card's slot, written from the premises.
//   3 · JUDGE          a DIFFERENT MODEL FAMILY ranks the survivors of the
//                      deterministic hard-rule filter and names a winner.
//   floor              the authored pool for the slot. A card never resolves
//                      empty: if the gateway is down or every candidate fails,
//                      the pool carries the card and used_fallback says so.
//
// Every stage's prompt lives in prompts.server.ts and nowhere else; the
// PROMPT_VERSION there is stamped on every card so a quality change can be
// attributed to a cause.
import { callAgent, modelFamily, tryParseJson, DEFAULT_MODEL } from '@/lib/agents/gateway'
import type { SlotKey } from './deck'
import { SLOT_KEYS } from './deck'
import { FALLBACKS } from './deck.server'
import {
  CANDIDATE_PROMPT,
  JUDGE_PROMPT,
  PREMISE_PROMPT,
  PROMPT_VERSION,
  SLOT_NAMES,
  SLOT_RULES,
  fill,
  formatCandidates,
  formatExamples,
  formatPremises,
} from './prompts.server'
import {
  loadExamples,
  loadVoices,
  pickVoice,
  voiceByKey,
  type JokeVoice,
} from './voices.server'

/* ───────────────────────────── models ─────────────────────────────
   The writer and the judge must be different families — same-model judging
   measures self-preference. Both are env-tunable; the defaults are the two
   families the Lovable gateway serves. */
export function writerModel(): string {
  return process.env['JOKE_WRITER_MODEL'] || process.env['LOVABLE_AI_MODEL'] || DEFAULT_MODEL
}
export function judgeModel(): string {
  const wanted = process.env['JOKE_JUDGE_MODEL'] || 'openai/gpt-5-mini'
  if (modelFamily(wanted) === modelFamily(writerModel())) {
    console.warn('[joke-judge] judge shares the writer\'s model family; self-preference will leak', {
      writer: writerModel(),
      judge: wanted,
    })
  }
  return wanted
}

/* ───────────────────────────── shapes ───────────────────────────── */

export type Premise = { t: string; used: boolean }

export type CandidateRecord = {
  text: string
  /** the hard rule the deterministic filter or the judge threw it out on */
  rejected?: string
  /** 0 = the judge's winner */
  rank?: number
}

export type GeneratedCard = {
  text: string
  used_fallback: boolean
  judge_score: number | null
  judge_why: string | null
  prompt_version: string
  voice_key: string | null
  writer_model: string | null
  judge_model: string | null
  candidates: CandidateRecord[]
}

/* ───────────────────────── roast targets ─────────────────────────
   {{TARGET}} on the roast card. Chosen once per set from the situation's
   own wording, cheaply and deterministically; the label is what the prompt
   reads. The order is the order the engines tend to fire in. */
export const ROAST_TARGETS: { key: string; label: string; re: RegExp }[] = [
  { key: 'the_process_language', label: 'the process language — the administrative phrasing doing the laundering', re: /\b(welcome to apply|no budget|budget|policy|hr|going forward|circle back|quick(ly)? look|no bandwidth|per my|headcount|restructur\w*|at this time|feedback|performance review)\b/i },
  { key: 'the_self_appointment', label: 'the self-appointment — what they have quietly made themselves into', re: /\b(reorgani[sz]\w*|rearrang\w*|took it upon|without asking|in charge|correct(ed|ing|s) me|inspect\w*|rules? for my|let (her|him|them)self in|decided for|reorder\w*|tidied my|sorted my)\b/i },
  { key: 'the_double_standard', label: 'the double standard — the rule with one reader', re: /\b(but when (she|he|they)|when (she|he|they) do(es)?|except (her|him|them)|allowed to|rules? (don'?t|doesn'?t) apply|fine when|for (her|him|them)self|double standard|still eats? mine|but (she|he|they) can)\b/i },
  { key: 'the_guilt_trip', label: 'the guilt trip — the sacrifice invoiced', re: /\b(guilt\w*|sigh\w*|after everything|ungrateful|sacrific\w*|how could you|disappoint\w*|hurt (her|his|their) feelings|selfish|for you)\b/i },
  { key: 'the_timing', label: 'the timing — when they chose to do it', re: /\b(in front of|at (the )?(dinner|table|wedding|party|funeral|christmas)|right (before|after|when)|the moment|just as|11 ?pm|midnight|on my birthday|anniversary)\b/i },
  { key: 'the_excuse', label: 'the excuse — the alibi and its construction', re: /\b(late|excuse\w*|explain\w*|reason\w*|because|forgot|busy|traffic|meant to|was going to)\b/i },
]
export const DEFAULT_ROAST_TARGET = { key: 'the_behaviour', label: "the behaviour itself — the move they made, not who they are" }

export function classifyRoastTarget(situation: string): string {
  for (const t of ROAST_TARGETS) if (t.re.test(situation)) return t.key
  return DEFAULT_ROAST_TARGET.key
}

export function roastTargetLabel(key: string | null | undefined): string {
  return ROAST_TARGETS.find((t) => t.key === key)?.label ?? DEFAULT_ROAST_TARGET.label
}

/* ───────────────────────── hard rules, in code ─────────────────────────
   The judge applies the hard rules too, but the deterministic ones are
   applied here first so a banned construction never reaches it, and so a
   card is still safe when the judge is down. These are the rules from the
   writer's brief that a regex can catch. The list should only ever grow. */
export const MAX_CHARS = 170 // what card-art can set in five lines at its smallest size
export const MAX_WORDS = 32

const ADVICE = /\b(you should|you could|you need to|you have to|you deserve|try to|try a|try telling|consider|i'?d recommend|i would recommend|next time|going forward|from now on|you'?re not crazy|you are not crazy|you'?re not wrong|it'?s okay to|it'?s ok to)\b/i
const CLINICAL = /\b(boundar(y|ies)|toxic|gaslight\w*|narcissis\w*|therap\w*|trauma\w*|trigger(ed|ing)?|heal(ing|ed)?|self[- ]care|red flags?|emotional (labou?r|abuse)|manipulat\w*|abus(e|ive|er)|diagnos\w*|disorder|anxiety|depress\w*|codependen\w*|enabl(er|ing)|validat\w*|closure|safe space|inner child|love[- ]bomb\w*)\b/i
const BANNED: { rule: string; re: RegExp }[] = [
  { rule: 'welcome to X, population: you', re: /welcome to [^,.]{1,40},? population:? you/i },
  { rule: "congratulations, you've unlocked", re: /congratulations,? you'?ve unlocked/i },
  { rule: "that's not X, that's Y", re: /\b(that|this|it)(?:'s| is)(?:n'?t| not) (?:a |an |the )?[^,.;]{1,40}[,;—–-]+ ?(?:that|this|it)(?:'s| is) /i },
  { rule: "and somehow I'm the villain", re: /and somehow i'?m the villain/i },
  { rule: 'plot twist:', re: /\bplot twist\b/i },
  { rule: 'main character energy', re: /main character (energy|moment|syndrome|behaviou?r)/i },
  { rule: 'starts "Ah, yes,"', re: /^\s*["“'‘]?ah,? yes\b/i },
]

/** Words of the situation the naming test compares against. */
function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9'\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3),
  )
}

/** The reason a line fails a hard rule, or null when it passes. */
export function hardRuleFailure(line: string, situation: string): string | null {
  const t = line.trim()
  if (!t) return 'empty'
  const words = t.split(/\s+/).length
  if (words < 2) return 'too short'
  if (t.length > MAX_CHARS || words > MAX_WORDS) return 'over length'
  if (ADVICE.test(t)) return 'advice'
  if (CLINICAL.test(t)) return 'clinical vocabulary'
  for (const b of BANNED) if (b.re.test(t)) return `banned construction: ${b.rule}`
  // The naming test, conservatively: a line whose EVERY content word was
  // typed by the user is a rearrangement. One new word passes it here; the
  // judge holds the higher bar.
  const own = Array.from(contentWords(t))
  if (own.length >= 4) {
    const given = contentWords(situation)
    if (own.every((w) => given.has(w))) return 'restatement'
  }
  return null
}

export function passesGuardrails(line: string, situation = ''): boolean {
  return hardRuleFailure(line, situation) === null
}

/* ───────────────────────── cleaning a line ───────────────────────── */

function isSpokenLine(slot: SlotKey): boolean {
  return slot === 'the_clapback'
}

/** House register: lowercase, one paragraph, straight quotes only on the
 *  spoken card. Two sentences survive — the brief allows them. */
export function cleanLine(raw: string, slot: SlotKey): string {
  let t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\d+[.)]\s*/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^["']+|["']+$/g, '')
    .trim()
    .toLowerCase()
  if (!t) return ''
  if (isSpokenLine(slot)) t = `"${t}"`
  return t
}

/* ───────────────────────── stage 1 · premises ───────────────────────── */

export async function runPremisePass(situation: string): Promise<Premise[]> {
  const res = await callAgent({
    model: writerModel(),
    temperature: 1.0,
    maxTokens: 2000,
    messages: [{ role: 'user', content: fill(PREMISE_PROMPT, { SITUATION: situation.slice(0, 1500) }) }],
  })
  if (res.error) {
    console.error('[joke-premises] gateway error', res.error)
    return []
  }
  const parsed = tryParseJson<{ premises?: unknown }>(res.text)
  const list = Array.isArray(parsed?.premises) ? parsed!.premises : []
  const premises: Premise[] = []
  const seen = new Set<string>()
  for (const p of list as any[]) {
    const t = String(p?.t ?? p?.text ?? '').replace(/\s+/g, ' ').trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    premises.push({ t, used: p?.used === true })
  }
  // Exactly four are meant to be marked. Fewer: promote from the top until
  // there are four. More: keep the first four marked. Either way the writer
  // gets four, never none.
  const used = premises.filter((p) => p.used)
  if (used.length > 4) {
    let kept = 0
    for (const p of premises) if (p.used) p.used = kept++ < 4
  } else if (used.length < 4) {
    let need = 4 - used.length
    for (const p of premises) {
      if (need <= 0) break
      if (!p.used) { p.used = true; need-- }
    }
  }
  return premises.slice(0, 12)
}

export function usedPremises(premises: Premise[] | null | undefined): string[] {
  const list = Array.isArray(premises) ? premises : []
  const used = list.filter((p) => p && p.used && p.t).map((p) => p.t)
  return (used.length ? used : list.filter((p) => p && p.t).map((p) => p.t)).slice(0, 4)
}

/* ───────────────────────── stage 2 · candidates ───────────────────────── */

export type CandidateInput = {
  situation: string
  slot: SlotKey
  voice: JokeVoice
  premises: string[]
  examples: { situation: string; line: string }[]
  roastTarget: string
}

function slotRule(slot: SlotKey, roastTarget: string): string {
  return fill(SLOT_RULES[slot], { TARGET: roastTargetLabel(roastTarget) })
}

export async function runCandidatePass(
  input: CandidateInput,
): Promise<{ candidates: string[]; model: string; error?: string }> {
  const prompt = fill(CANDIDATE_PROMPT, {
    VOICE_NAME: input.voice.label,
    VOICE_PERSONA: input.voice.persona_prompt,
    VOICE_REGISTER: input.voice.register_notes,
    VOICE_BANNED: input.voice.banned_moves,
    SLOT: SLOT_NAMES[input.slot],
    SLOT_RULE: slotRule(input.slot, input.roastTarget),
    SITUATION: input.situation.slice(0, 1500),
    PREMISES: formatPremises(input.premises),
    EXAMPLES: formatExamples(input.examples),
  })
  const res = await callAgent({
    model: writerModel(),
    temperature: 1.0,
    maxTokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  })
  if (res.error) return { candidates: [], model: res.model, error: res.error }
  const parsed = tryParseJson<{ candidates?: unknown }>(res.text)
  const list = Array.isArray(parsed?.candidates) ? parsed!.candidates : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of list as unknown[]) {
    const line = cleanLine(typeof c === 'string' ? c : String((c as any)?.text ?? ''), input.slot)
    if (!line || seen.has(line)) continue
    seen.add(line)
    out.push(line)
  }
  return { candidates: out.slice(0, 10), model: res.model }
}

/* ───────────────────────── stage 3 · judge ───────────────────────── */

export type Verdict = {
  winner: number | null
  why: string | null
  ranking: number[]
  rejected: { i: number; rule: string }[]
  model: string
  error?: string
}

export async function runJudge(args: {
  situation: string
  slot: SlotKey
  roastTarget: string
  candidates: string[]
}): Promise<Verdict> {
  const model = judgeModel()
  const n = args.candidates.length
  const prompt = fill(JUDGE_PROMPT, {
    SITUATION: args.situation.slice(0, 1500),
    SLOT: SLOT_NAMES[args.slot],
    SLOT_RULE: slotRule(args.slot, args.roastTarget),
    CANDIDATES: formatCandidates(args.candidates),
  })
  const res = await callAgent({
    model,
    temperature: 0,
    maxTokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })
  const empty: Verdict = { winner: null, why: null, ranking: [], rejected: [], model }
  if (res.error) return { ...empty, error: res.error }
  const parsed = tryParseJson<{
    winner?: unknown
    why?: unknown
    ranking?: unknown
    rejected?: unknown
  }>(res.text)
  if (!parsed) return { ...empty, error: 'unparseable verdict' }
  const inRange = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < n
  const rejected = (Array.isArray(parsed.rejected) ? parsed.rejected : [])
    .map((r: any) => ({ i: Number(r?.i), rule: String(r?.rule ?? 'hard rule') }))
    .filter((r) => inRange(r.i))
  const rejectedSet = new Set(rejected.map((r) => r.i))
  const ranking = (Array.isArray(parsed.ranking) ? parsed.ranking : []).filter(inRange) as number[]
  let winner: number | null = inRange(parsed.winner) ? parsed.winner : null
  // A winner the judge also rejected is a contradiction; trust the rejection
  // and take the best-ranked survivor instead.
  if (winner !== null && rejectedSet.has(winner)) {
    winner = ranking.find((i) => !rejectedSet.has(i)) ?? null
  }
  return {
    winner,
    why: typeof parsed.why === 'string' ? parsed.why.trim().slice(0, 300) : null,
    ranking,
    rejected,
    model,
  }
}

/* ───────────────────────── the floor ───────────────────────── */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function fallbackCard(slot: SlotKey, voiceKey: string | null, avoid: string[] = []): GeneratedCard {
  const pool = FALLBACKS[slot] ?? FALLBACKS['deadpan_understatement']!
  const fresh = pool.filter((t) => !avoid.includes(t))
  return {
    text: pick(fresh.length ? fresh : pool),
    used_fallback: true,
    judge_score: null,
    judge_why: null,
    prompt_version: PROMPT_VERSION,
    voice_key: voiceKey,
    writer_model: null,
    judge_model: null,
    candidates: [],
  }
}

/* ───────────────────────── the whole ladder ─────────────────────────
   candidates → hard rules → judge → (no survivors? one more candidate
   pass) → floor. Pure of the database: the caller supplies premises,
   voice and examples so the eval script can run the identical ladder. */
export async function generateFromInputs(
  input: CandidateInput & { avoid?: string[] },
): Promise<GeneratedCard> {
  const avoid = new Set((input.avoid ?? []).map((t) => t.toLowerCase()))
  let writer: string | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const pass = await runCandidatePass(input)
    writer = pass.model
    if (pass.error) {
      console.error('[joke-candidates] gateway error', { slot: input.slot, attempt, error: pass.error })
      // The gateway itself is down: a second attempt would only be a second
      // timeout. Straight to the floor.
      break
    }

    const records: CandidateRecord[] = pass.candidates.map((text) => ({ text }))
    const survivors: { text: string; at: number }[] = []
    records.forEach((r, at) => {
      const fail = hardRuleFailure(r.text, input.situation) ?? (avoid.has(r.text.toLowerCase()) ? 'repeat of the last card' : null)
      if (fail) r.rejected = fail
      else survivors.push({ text: r.text, at })
    })
    if (survivors.length === 0) {
      console.warn('[joke-candidates] no survivors', { slot: input.slot, attempt, rejected: records.map((r) => r.rejected) })
      continue
    }

    const verdict = await runJudge({
      situation: input.situation,
      slot: input.slot,
      roastTarget: input.roastTarget,
      candidates: survivors.map((s) => s.text),
    })
    for (const r of verdict.rejected) {
      const rec = records[survivors[r.i]!.at]!
      rec.rejected = `judge: ${r.rule}`
    }
    verdict.ranking.forEach((i, rank) => {
      const rec = records[survivors[i]!.at]!
      if (rec.rank === undefined) rec.rank = rank
    })

    const base = {
      prompt_version: PROMPT_VERSION,
      voice_key: input.voice.key,
      writer_model: writer,
      judge_model: verdict.model,
      candidates: records,
    }

    if (verdict.winner !== null) {
      const win = survivors[verdict.winner]!
      records[win.at]!.rank = 0
      return {
        ...base,
        text: win.text,
        used_fallback: false,
        judge_score: attempt === 0 ? 0.9 : 0.8,
        judge_why: verdict.why,
      }
    }

    if (verdict.error) {
      // The judge is down, not the candidates. The first line the hard rules
      // let through is a real card — a judged one was only going to be
      // better, not the difference between a card and none.
      console.error('[joke-judge] gateway error', { slot: input.slot, error: verdict.error })
      const first = survivors[0]!
      records[first.at]!.rank = 0
      return {
        ...base,
        text: first.text,
        used_fallback: false,
        judge_score: 0.6,
        judge_why: 'unjudged: ' + verdict.error,
      }
    }
    // The judge read them all and threw them all out. Once more, from the top.
  }

  return fallbackCard(input.slot, input.voice.key, input.avoid)
}

/* ───────────────────────── with the database ─────────────────────────
   The set carries what stage 1 produced and what was chosen for it:
   premises, voice, roast target. `prepareSet` fills whatever is missing —
   it is run once at the deal, and again by any card that finds the set
   still bare, so a deal that failed half-way never leaves the cards
   without their observations. */

type Admin = { from: (table: string) => any }

export type SetRow = {
  id: string
  clean_text: string
  archetype: string | null
}

type StoredPrep = {
  premises: Premise[] | null
  premises_version: string | null
  voice_key: string | null
  roast_target: string | null
}

export type PreparedSet = {
  premises: Premise[]
  voice: JokeVoice
  roastTarget: string
}

/** What the set already carries. Read in its own query, and an error here
 *  is a bare set, not a failed deal: before the generator's migration has
 *  landed these columns do not exist, and the cards must still write. */
async function readStoredPrep(admin: Admin, setId: string): Promise<StoredPrep> {
  const bare: StoredPrep = { premises: null, premises_version: null, voice_key: null, roast_target: null }
  try {
    const { data, error } = await admin
      .from('joke_sets')
      .select('premises, premises_version, voice_key, roast_target')
      .eq('id', setId)
      .maybeSingle()
    if (error || !data) return bare
    return {
      premises: Array.isArray(data.premises) ? (data.premises as Premise[]) : null,
      premises_version: (data.premises_version as string | null) ?? null,
      voice_key: (data.voice_key as string | null) ?? null,
      roast_target: (data.roast_target as string | null) ?? null,
    }
  } catch {
    return bare
  }
}

export async function prepareSet(admin: Admin, set: SetRow): Promise<PreparedSet> {
  const situation = String(set.clean_text ?? '')
  const stored = await readStoredPrep(admin, set.id)
  const patch: Record<string, unknown> = {}

  const voices = await loadVoices(admin)
  let voice = voiceByKey(voices, stored.voice_key)
  if (!voice) {
    // Seeded off the set id, so three cards preparing at once — or a set
    // whose columns cannot be written yet — still agree on the voice.
    voice = pickVoice(voices, set.id)
    patch['voice_key'] = voice.key
  }

  let roastTarget = stored.roast_target
  if (!roastTarget) {
    roastTarget = classifyRoastTarget(situation)
    patch['roast_target'] = roastTarget
  }

  // The cache is keyed on the prompt version: observations an older premise
  // prompt made are not the observations this one would make.
  let premises = stored.premises_version === PROMPT_VERSION && stored.premises ? stored.premises : null
  if (!premises) {
    premises = await runPremisePass(situation)
    // An empty pass is not cached: the gateway may have been down, and the
    // next card should get to try. A real answer is stored once.
    if (premises.length) {
      patch['premises'] = premises
      patch['premises_version'] = PROMPT_VERSION
    }
  }

  if (Object.keys(patch).length) {
    try {
      const { error } = await admin.from('joke_sets').update(patch as never).eq('id', set.id)
      if (error) console.error('[joke-set] could not store the prepared set', { set_id: set.id, error: error.message })
    } catch (err) {
      console.error('[joke-set] could not store the prepared set', { set_id: set.id, err })
    }
  }
  return { premises, voice, roastTarget }
}

/** One card, end to end, for a set the caller has already loaded. */
export async function generateCard(
  admin: Admin,
  set: SetRow,
  args: { slot: string; avoid?: string[] },
): Promise<GeneratedCard> {
  const slot = (SLOT_KEYS as string[]).includes(args.slot) ? (args.slot as SlotKey) : 'the_roast'
  const situation = String(set.clean_text ?? '')
  let prepared: PreparedSet
  try {
    prepared = await prepareSet(admin, set)
  } catch (err) {
    console.error('[joke-set] prepare failed; writing from the situation alone', { set_id: set.id, err })
    const voices = await loadVoices(null)
    prepared = { premises: [], voice: pickVoice(voices, set.id), roastTarget: classifyRoastTarget(situation) }
  }
  const examples = await loadExamples(admin, {
    slot,
    voiceKey: prepared.voice.key,
    archetype: String(set.archetype ?? 'general'),
  })
  return generateFromInputs({
    situation,
    slot,
    voice: prepared.voice,
    premises: usedPremises(prepared.premises),
    examples,
    roastTarget: prepared.roastTarget,
    avoid: args.avoid,
  })
}
