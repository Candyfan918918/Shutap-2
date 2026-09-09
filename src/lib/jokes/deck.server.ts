// Server-only joke-card vocabulary: the authored fallback pools, the
// archetype matcher and the three-slot deal.
//
// The writing itself — premises → ten candidates → a judge on another model
// family → the floor — lives in pipeline.server.ts, with its prompts in
// prompts.server.ts and its voices and hall of fame in voices.server.ts.
//
// The never-blank law: a card can never resolve empty. If the gateway is
// down or every candidate fails the hard rules twice, the authored pool for
// that slot carries the card — so the three cards a person is offered are
// three cards they actually get.
import { ANGLES, SLOTS, SLOT_KEYS, type SlotKey } from './deck'

/* authored fallback pools — one per slot (plus the legacy angles),
   archetype-agnostic. */
export const FALLBACKS: Record<string, string[]> = {
  target_the_behavior: [
    'she did the thing. on purpose. with her whole chest.',
    'a normal person would simply not have done that. she is not on that plan.',
    'she treated your boundary like a suggestion box she was legally allowed to shake.',
    'she walked in and started editing. the house was not asking for notes.',
  ],
  target_the_guilt_trip: [
    'she sighed at a volume specifically engineered to be heard from another room.',
    'somehow you owe her an apology for the thing she did to you. incredible accounting.',
    'the martyrdom was rehearsed. the delivery was flawless. the crime was hers.',
    'she brought up the sacrifice of 1998 again, unprompted, load-bearing.',
  ],
  target_the_double_standard: [
    'the rulebook has one reader and she does not count herself in the audience.',
    'when she does it it is love. when you do it it is an attitude.',
    'the standard is a standard the way a wet paper towel is a wall.',
    'the rule applies to everyone present except the person who wrote it.',
  ],
  target_the_timing: [
    'she waited for the exact worst second like she had been training for it.',
    'the timing was not bad luck. the timing was the whole joke.',
    'she had all week. she picked the moment you were happy.',
    'she saved it for an audience, which is how you know it was a bit.',
  ],
  absurdist_escalation: [
    'at this rate she will be commenting on your funeral catering.',
    'give it a year and she is petitioning for co-ownership of your groceries.',
    'next she rearranges your furniture as a hostage negotiation tactic.',
    'by christmas she will have opinions about the inside of your fridge door.',
  ],
  deadpan_understatement: [
    'unusual choice.',
    'so that happened, and everyone decided to be normal about it.',
    'a small thing. by weight only.',
    'bold of her, structurally.',
  ],
  the_take: [
    'that is not a chore chart. that is an org chart, and you are the whole org.',
    'she did the thing, on purpose, with her whole chest, and then filed it as normal.',
    'the arrangement is fifty-fifty the way a seesaw with one person on it is balanced.',
    'so the system is fair, and you are the only one inside it. neat.',
  ],
  the_clapback: [
    '"weird thing to laminate."',
    '"say the second half out loud too."',
    '"i have added a column. it is called you."',
    '"that was a choice, and you made it."',
  ],
  the_roast: [
    'somewhere a laminator is being used for evil and nobody is stopping it.',
    'the chart has the confidence of a document nobody asked for.',
    'that rule was written by a committee of one and ratified by nobody.',
    'imagine printing that out. imagine sealing it in plastic. imagine.',
  ],
  the_comeback: [
    '"weird thing to say out loud."',
    '"you can go home now."',
    '"say more, i am taking notes."',
    '"that was a choice, and you made it."',
  ],
}

export function classifyArchetype(clean: string): string {
  const s = clean.toLowerCase()
  if (/\b(key|let herself|letting herself|rearrang|unannounced|without asking|dropped by|showed up)\b/.test(s)) return 'uninvited_visitor'
  if (/\b(grandchild|grandbaby|grandkid|when are you|baby|pregnan)\b/.test(s)) return 'grandbaby_countdown_clock'
  if (/\b(silent treatment|not speaking|stopped talking|silence|ignoring me|days of silence)\b/.test(s)) return 'silent_treatment_strategist'
  if (/\b(golden child|favorite|favourite|his sister|her other son|compared)\b/.test(s)) return 'favoritism_broadcaster'
  if (/\b(in front of|everyone|party|laughed|joke about me|cookbook|compliment)\b/.test(s)) return 'backhanded_grandma'
  if (/\b(boundary|boundaries|told her not to|asked her not to|said no|overstep)\b/.test(s)) return 'boundary_bulldozer'
  if (/\b(guilt|sigh|after everything|ungrateful|dramatic|sacrific)\b/.test(s)) return 'backhanded_grandma'
  return 'general'
}

/** The deck deals the same three slots, in the same order, to everyone.
 *  There is no draw and no shuffle: three cards, always — the take, the
 *  clapback, the roast. */
export function dealSlots(): SlotKey[] {
  return [...SLOT_KEYS]
}

/** The brief the model writes to, for a current slot or a legacy angle. */
export function briefFor(angle: string): string {
  const slot = SLOTS.find((s) => s.key === angle)
  if (slot) return slot.brief
  return ANGLES.find((a) => a[0] === angle)?.[2] ?? 'roast the behaviour'
}
