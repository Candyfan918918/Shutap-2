// The three prompts of the joke-card pipeline, one per stage, plus the slot
// rules they share. The source of truth is docs/shutap-prompt-templates.md —
// the text here is that document's templates, verbatim, as template literals.
// `{{VARS}}` are interpolated at call time by `fill` below.
//
// Not training. These are prompts. Fine-tuning is a later option once
// share-rate data exists to build a preference set from.
//
// Every card records PROMPT_VERSION. Bump it on ANY edit to any template or
// slot rule below — without it a quality change cannot be attributed to a
// cause. The premise cache on joke_sets is keyed on it too, so a changed
// premise pass re-runs instead of serving observations an older prompt made.
import type { SlotKey } from './deck'

export const PROMPT_VERSION = '2.0.0'

/* ───────────────────────── 1 — premise pass ─────────────────────────
   Runs once per set on first flip. Cached to joke_sets.premises.
   Temperature 1.0. No voice, no slot — observations belong to the situation,
   not the card. */
export const PREMISE_PROMPT = `You read a situation someone described and find what is absurd, hypocritical,
or quietly revealing in it. You do not write jokes. You notice things.

SITUATION:
{{SITUATION}}

Write 12 observations.

THE FIVE ENGINES. Most situations run on one of these. Search them in order
and stop looking for more once one clearly fires:

1. PREMEDITATION — the decision was made before the event, and then the
   person performed spontaneity on top of it. Look for what was packed,
   written, arranged or scheduled in advance. The funniest moment is
   usually one step EARLIER in the timeline than the event described:
   not the dinner, the hallway that morning.

2. CLAIM VERSUS ACT — they used a word for what they did that the act
   does not support. "Handled it." "Cleaned it." "Split it." The gap
   between the verb and the behaviour is the whole observation.

3. SENTIMENT AS PRETEXT — the feeling was the delivery mechanism for a
   request. Warmth arrived because something was needed.

4. PROCESS LANGUAGE AS LAUNDERING — administrative phrasing used to make
   an indefensible thing sound procedural. "Welcome to apply."
   "Quickly look over." "No budget." The phrasing is the tell.

5. SELF-APPOINTMENT — the person has quietly become an institution:
   an auditor, a committee, a compliance function, a press office. Name
   what they have turned themselves into, not what they did.

Rules:
- An observation states something true about what happened. It is not a
  punchline and it is not a judgement of anyone's character.
- THE NAMING TEST — this is the hard one. An observation must say the thing
  underneath in words the situation did not provide. If the sentence could
  be assembled by rearranging the words the user typed, it is a restatement
  and it is dead. Rearranging is not observing.
    Restatement: "She reposted the job you are doing, at more money."
    Observation: "The job was priced correctly the moment it was
                  hypothetically vacant."
  Same facts. The second one names the mechanism. Only the second counts.
- Go past the obvious. The first three things anyone would notice are the
  three least useful. Keep going until you find the thing that is only
  true of THIS situation.
- Never observe anything about the person this happened to. Only about the
  other person's behaviour and the situation itself.
- One sentence each. Shorter is better. The best observations are under
  twelve words.

Then mark the 4 that are least obvious and most specific to this situation.

Return only JSON:
{"premises":[{"t":"...","used":true},{"t":"...","used":false}, ...]}
Exactly 12 items. Exactly 4 with used:true.`

/* ───────────────────────── 2 — candidate pass ─────────────────────────
   Once per flip. Ten candidates in ONE call — the model sees its own prior
   attempts and self-diversifies, which produces more spread than ten
   independent calls and costs less. Temperature 1.0. */
export const CANDIDATE_PROMPT = `You write one line of comedy about something that happened to someone.

VOICE — {{VOICE_NAME}}
{{VOICE_PERSONA}}

Register: {{VOICE_REGISTER}}
This voice never: {{VOICE_BANNED}}

CARD — {{SLOT}}
{{SLOT_RULE}}

SITUATION:
{{SITUATION}}

WHAT'S ACTUALLY GOING ON HERE:
{{PREMISES}}

Write from these observations. Do not go back to the obvious reading of the
situation — that ground is already covered and it is not funny.

CRAFT — every line, no exceptions:
- THE NAMING TEST. Could this line have been assembled by rearranging the
  words the user typed? If yes, it is a restatement and it is dead — no
  matter which card it is for. A restatement reads as accurate, which is
  why it survives when nobody is checking.
    Restating: "Two hours late and the first twenty minutes went to the alibi."
    Naming:    "He arrived with exhibits."
  Both describe the same behaviour. Only the second one tells the user
  something they had not already worked out. ONE new word smuggled into a
  retelling is still a retelling.
- Reuse at least one concrete noun from the situation, word for word.
- The surprising word goes last. Never trail off into a clause that explains.
- One sentence. Two only if the second is shorter than the first.
- Aim at the other person's behaviour. Never at the person it happened to.
- Never advise, prescribe, diagnose, or reframe.
- THE SWAP TEST: if the line would land just as well on a different person's
  situation, it has failed. Specificity is the requirement, not a bonus.

NEVER WRITE:
  "welcome to X, population: you"
  "congratulations, you've unlocked"
  "that's not X, that's Y"
  "and somehow I'm the villain"
  "plot twist:"
  "main character energy"
  any sentence starting "Ah, yes,"
  rule-of-three escalating lists
  puns
  therapy words used ironically (boundaries, toxic, gaslighting, narcissist)

HOW THESE HAVE BEEN WRITTEN BEFORE:
{{EXAMPLES}}

Write 10 candidates. Make them genuinely different from each other — different
observations, different constructions, different lengths. Do not write ten
versions of one joke. Numbers 8, 9 and 10 should be the ones you would not
normally risk.

Return only JSON:
{"candidates":["...","...", ...]}
Exactly 10 strings.`

/* ───────────────────────────── 3 — judge ─────────────────────────────
   DIFFERENT MODEL FAMILY THAN STAGE 2. Models rate their own output higher
   than another model's — same-model judging measures self-preference and
   throws away most of the value of the selection step. Temperature 0. */
export const JUDGE_PROMPT = `You choose which of these lines is funniest. You are not the writer and you
have no stake in any of them.

SITUATION:
{{SITUATION}}

CARD — {{SLOT}}
{{SLOT_RULE}}

CANDIDATES:
{{CANDIDATES}}

Judge in this order. A line that fails any hard rule is out regardless of how
funny it is.

HARD RULES:
1. SWAP TEST — would this land equally well on a completely different person's
   situation? If yes, out.
2. No advice. No "you should", "try", "consider", "next time". Out.
3. No therapy or clinical vocabulary. No statement about what the person is
   or feels. Out.
4. No banned construction (see the list in the writer's brief). Out.
5. Aimed at the other person's behaviour, not at the person it happened to.

THEN, among what survives:
- Does it use something specific from this situation that only this situation
  has? The more specific, the better.
- THE NAMING TEST: could this line have been assembled by rearranging the
  words the user typed? If yes, it is a restatement and ranks below anything
  that names the mechanism in new words. This is the most common failure and
  it is easy to miss, because a restatement reads as accurate. Applies to all
  three cards, not just the take. A roast that retells the situation with one
  clever word added has failed it.
- Length is NOT a ranking criterion. Do not prefer a compressed verdict over
  a line that builds its argument across two clauses. The second kind is
  usually funnier here, because the reader watches the comparison get made
  rather than being handed the conclusion. Cut only words that carry nothing
  — never cut the reasoning itself.
- Does it land on the surprising word, or does it explain itself at the end?
- Is the premise one someone would actually have missed, or the first thing
  anyone would say?
- Read it aloud in your head. Does it have a rhythm, or is it just accurate?

Rank all 10. Return only JSON:
{"winner": <index 0-9>,
 "why": "<one clause on what made it win>",
 "ranking": [<indices, best first>],
 "rejected": [{"i": <index>, "rule": "<which hard rule it broke>"}]}

If every candidate fails a hard rule, return {"winner": null}.`

/* ───────────────────────────── 4 — slot rules ─────────────────────────────
   Constants. Interpolated as {{SLOT_RULE}} into both stage 2 and stage 3.
   Keyed by the deck's slot keys; `{{SLOT}}` itself is the short name. */
export const SLOT_NAMES: Record<SlotKey, string> = {
  the_take: 'take',
  the_clapback: 'clapback',
  the_roast: 'roast',
}

export const SLOT_RULES: Record<SlotKey, string> = {
  the_take: `Name what actually happened, in words the situation did not provide.

THIS IS NOT A SUMMARY. Do not restate the situation with the verbs rearranged
— the user just typed it and will read their own words back. The take earns
its place by identifying the mechanism underneath: what the behaviour IS, not
what it was.
  Restating:  "There is no budget for training. He said it in the room you
               just refurbished."
  Naming:     "The budget exists. It's the room."
Both are true. Only the second one tells the user something.

Do not editorialise — the sentence should convict them without a single
opinion in it. The accuracy is the payoff, and accuracy means precision about
the mechanism, not fidelity to the retelling.
NEVER: a statement about the user. Not what they are, not what they feel, not
what they deserve. No reassurance. No "you're not crazy". No clinical labels.
The verdict is on the behaviour, never on the person reading it.`,

  the_clapback: `The line they wish they'd said in the moment. First person.
Past tense or conditional — this is a fantasy of what could have been said,
never an instruction for what to say next.
NEVER: imperative mood. Never "say this", "tell her", "next time". Never
references a future conversation. If it reads as advice, it has failed.
Turn their own words back on them where possible — their excuse is usually
the charge.

THE ANSWERABILITY TEST. A clapback ends where they have to answer. If they
could nod, agree, and move on, it was an observation and it has failed. There
should be no reply available that does not make it worse for them.
  Failed:  "When does the friend stop being between and start being at?"
  Works:   "Eleven nights. At what point do I start introducing him?"

THE TWO-BEAT SHAPE. The strongest clapbacks set a trap in the first clause
and spring it in the second, using their own logic as the mechanism.
  "You've got a system for your food. What's the system for mine?"
  "Label mine too. Same pen. Let's see if it works both ways."
  "You didn't label your food so I'd leave it. You labelled it so you'd know."
Give them their premise, then extend it one step past where they stopped.

Not a shrug. A raised eyebrow is not a clapback. It must cost them
something.`,

  the_roast: `The joke. Ridicule aimed at {{TARGET}}.
This card carries the funny. It does not need to be fair or accurate — it
needs to land. Escalate, reframe, or take the situation somewhere it did not
expect to go.
NOT A LOUDER RETELLING. The most common failure is narrating the situation
back with one clever word inserted. That is a restatement with decoration,
and it ranks below a plain observation. The roast must arrive somewhere the
retelling could not reach.
Length is not a virtue either way. A two-clause line that makes the
comparison visible usually beats a compressed verdict — "he built twenty
minutes of infrastructure to explain two hours" over "he arrived with
exhibits." Cut dead words, never the reasoning.
NEVER: the person it happened to. The target is the other person's behaviour
and the situation, always.`,
}

/* ───────────────────────── 5 — few-shot format ─────────────────────────
   Situation and line together, always. A joke line alone teaches
   vocabulary, not the mapping — the model has to see what the line was
   written AGAINST or it learns to sound like the examples rather than to
   do what they did. */
export function formatExamples(pairs: { situation: string; line: string }[]): string {
  if (pairs.length === 0) return '(none on file for this card yet — write from the brief alone)'
  return pairs.map((p) => `SITUATION: ${p.situation}\nLINE: ${p.line}`).join('\n\n')
}

/** A numbered list, 1-based, for the premises the writer works from. */
export function formatPremises(premises: string[]): string {
  if (premises.length === 0) return '(no observations available — read the situation yourself, past the obvious)'
  return premises.map((p, i) => `${i + 1}. ${p}`).join('\n')
}

/** A numbered list, 0-based, because the judge answers with indices 0-9. */
export function formatCandidates(candidates: string[]): string {
  return candidates.map((c, i) => `${i}. ${c}`).join('\n')
}

/** Interpolate `{{VARS}}`. A variable with no value is left readable rather
 *  than thrown on — a missing few-shot must never fail a flip. */
export function fill(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => vars[key] ?? `(no ${key.toLowerCase()})`)
}
