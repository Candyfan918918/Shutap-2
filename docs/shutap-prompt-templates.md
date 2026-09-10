# Shutap — Prompt Templates

Three prompts, one per pipeline stage. Kept in `src/lib/jokes/prompts.server.ts` as template literals (this app runs TanStack Start server functions, not Supabase edge functions). `{{VARS}}` are interpolated at call time.

Not training. These are prompts. Fine-tuning is a later option once share-rate data exists to build a preference set from.

---

## Variables

| var | source | example |
|---|---|---|
| `{{SITUATION}}` | `joke_sets.situation_clean`, post-scrub | "my mother-in-law reorganised my kitchen while I was at work…" |
| `{{PREMISES}}` | `joke_sets.premises`, the 4 marked `used` | numbered list |
| `{{SLOT}}` | `slot_order[position]` | `roast` |
| `{{SLOT_RULE}}` | constant, §4 below | the roast block |
| `{{VOICE_NAME}}` | `joke_voices.label` | the petty historian |
| `{{VOICE_PERSONA}}` | `joke_voices.persona_prompt` | paragraph |
| `{{VOICE_REGISTER}}` | `joke_voices.register_notes` | sentence rules |
| `{{VOICE_BANNED}}` | `joke_voices.banned_moves` | per-voice bans |
| `{{TARGET}}` | `roast_target`, roast slot only | `the_double_standard` |
| `{{EXAMPLES}}` | `joke_hall_of_fame` filtered by (slot, voice) | 5 situation→line pairs |
| `{{CANDIDATES}}` | stage 2 output | numbered list |

---

## 1 — Premise pass

Runs once per set on first flip. Cache to `joke_sets.premises`. Temperature 1.0. No voice, no slot — observations belong to the situation, not the card.

```
You read a situation someone described and find what is absurd, hypocritical,
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
- NO SECOND PARTY. Some situations have no other adult in them — the user
  describing their own week, a toddler, a broken object, an accumulation of
  small tasks. Do NOT fall back to observing the user. Aim everything at the
  MECHANISM: what the circumstance structurally is, what work it silently
  creates, what the physical act actually does. The engines still apply —
  a toddler is described as eating while relocating the food (engine 2);
  the floor has quietly become a second diner (engine 5).
  If the user has said something critical about themselves, that sentence is
  off limits entirely. Never confirm it, never soften it, never joke near it.
- One sentence each. Shorter is better. The best observations are under
  twelve words.

Then mark the 4 that are least obvious and most specific to this situation.

Return only JSON:
{"premises":[{"t":"...","used":true},{"t":"...","used":false}, ...]}
Exactly 12 items. Exactly 4 with used:true.
```

---

## 2 — Candidate pass

Once per flip. Ten candidates in **one** call — the model sees its own prior attempts and self-diversifies, which produces more spread than ten independent calls and costs less. Temperature 1.0.

```
You write one line of comedy about something that happened to someone.

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
  "that's not X, that's Y"  — banned as a RESTATEMENT device, which is what
      it almost always is. Permitted only when the second half is a genuine
      reframe that could stand alone as an observation, never when it merely
      renames the first half.
        Banned:    "That's not cleaning, that's inspecting the dirt."
        Permitted: "He's not eating, he's testing the coverage."
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
Exactly 10 strings.
```

---

## 3 — Judge

**Different model family than stage 2.** Models rate their own output higher than another model's — same-model judging measures self-preference and throws away most of the value of the selection step. Temperature 0.

```
You choose which of these lines is funniest. You are not the writer and you
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
- REGISTER FOLLOWS TARGET. Which shape ranks higher depends on what the line
  is aimed at.
    Aimed at a PERSON: prefer the two-clause build that makes the reasoning
    visible. There is a case to be made and the reader wants to watch it get
    made. "He built twenty minutes of infrastructure to explain two hours."
    Aimed at a CIRCUMSTANCE: prefer the compressed reframe. Nobody is guilty,
    so there is no case to build — only a thing to see differently.
    "Children eat the way water finds a level — outward."
  Length itself is never the criterion. Cut words that carry nothing, never
  cut the reasoning.
- Does it land on the surprising word, or does it explain itself at the end?
- Is the premise one someone would actually have missed, or the first thing
  anyone would say?
- Read it aloud in your head. Does it have a rhythm, or is it just accurate?

Rank all 10. Return only JSON:
{"winner": <index 0-9>,
 "why": "<one clause on what made it win>",
 "ranking": [<indices, best first>],
 "rejected": [{"i": <index>, "rule": "<which hard rule it broke>"}]}

If every candidate fails a hard rule, return {"winner": null}.
```

---

## 4 — Slot rules

Constants. Interpolated as `{{SLOT_RULE}}` into both stage 2 and stage 3.

```ts
export const SLOT_RULES = {
  take: `Name what actually happened, in words the situation did not provide.

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

  clapback: `The line they wish they'd said in the moment. First person.
Past tense or conditional — this is a fantasy of what could have been said,
never an instruction for what to say next.
NEVER: imperative mood. Never "say this", "tell her", "next time". Never
references a future conversation. If it reads as advice, it has failed.
Turn their own words back on them where possible — their excuse is usually
the charge.

ADDRESSEE. Usually the other adult in the situation. When there is no other
adult, address whatever is causing it — the toddler, the object, the process.
It does not need to be able to reply. Never address the user.

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

  roast: `The joke. Ridicule aimed at {{TARGET}}.
This card carries the funny. It does not need to be fair or accurate — it
needs to land. Escalate, reframe, or take the situation somewhere it did not
expect to go.
NOT A LOUDER RETELLING. The most common failure is narrating the situation
back with one clever word inserted. That is a restatement with decoration,
and it ranks below a plain observation. The roast must arrive somewhere the
retelling could not reach.
REGISTER FOLLOWS TARGET. When the line is aimed at a person, the two-clause
build usually wins — the reader wants to watch the case get made: "he built
twenty minutes of infrastructure to explain two hours." When it is aimed at a
circumstance rather than a person, the compressed reframe wins instead —
there is no case to build, only a thing to see differently: "children eat the
way water finds a level — outward." Cut dead words, never the reasoning.
NEVER: the person it happened to. The target is the other person's behaviour
and the situation, always.`
}
```

---

## 5 — Few-shot format

`{{EXAMPLES}}` is 5 pairs from `joke_hall_of_fame` filtered by (slot, voice). Interpolate as:

```
SITUATION: {situation_clean}
LINE: {joke_text}

SITUATION: {situation_clean}
LINE: {joke_text}
```

**Situation and line together, always.** A joke line alone teaches vocabulary, not the mapping — the model has to see what the line was written *against* or it learns to sound like the examples rather than to do what they did.

Selection order: `(slot, voice, archetype)` → `(slot, voice)` → `(slot, any voice)` → none. Never block on empty; proceed with no few-shot rather than failing the flip.

---

## 6 — Where the five engines came from

The engines in the premise pass are not theoretical. They were found by running forty real situations by hand and noticing which observations produced funny cards and which produced accurate ones. Premeditation dominates in-law and family situations; claim-versus-act dominates partner situations; sentiment-as-pretext is specific to exes; process-language-as-laundering is almost entirely a workplace phenomenon.

Expect the list to grow. When a new category is added, run ten situations by hand before writing a prompt rule — the engine is discovered from output, not designed in advance.

---

## 7 — Notes on tuning these

Version every prompt. `prompt_version` on `joke_cards`, bumped on any edit. Without it you cannot attribute a quality change to a cause.

Change one thing at a time and re-run the frozen eval set. The temptation is to rewrite three sections at once because they all seem improvable; then the number moves and you learn nothing.

The banned list is the only part that should grow continuously. Every time a construction repeats across production cards, add it. This list is the accumulated record of how the model tries to be lazy, and it is worth more after six months than it is today.

Nothing here fixes bad examples. If `{{EXAMPLES}}` is thin or AI-written, the prompt quality stops mattering — output regresses toward the few-shot no matter how the instructions are worded.
