// The frozen eval set. Change one thing in a prompt, re-run scripts/joke-eval.ts
// over these, read the cards. Do not edit a situation once it is here: the
// point of the set is that the same input meets every prompt version.
//
// One or two per engine, across the four rooms. Archetype is what
// classifyArchetype would answer, pinned so a matcher change is not mistaken
// for a prompt change.
export const EVAL_SET: { id: string; archetype: string; situation: string }[] = [
  { id: 'kitchen', archetype: 'uninvited_visitor', situation: "My mother-in-law reorganised my kitchen while I was at work and left a note on the counter saying 'now you'll be able to find things'." },
  { id: 'budget', archetype: 'general', situation: "My manager said there's no budget for training this year. He said it in the boardroom they finished refurbishing last month." },
  { id: 'repost', archetype: 'general', situation: 'My boss reposted my exact job on LinkedIn at fifteen thousand more than I make, and told me I was welcome to apply.' },
  { id: 'late', archetype: 'general', situation: 'He turned up two hours late to my birthday dinner and spent the first twenty minutes explaining why.' },
  { id: 'chores', archetype: 'general', situation: "My husband says we split the chores fifty-fifty. He counts 'reminding me' as a chore." },
  { id: 'fridge', archetype: 'general', situation: 'My flatmate put her name on every item of her food in the fridge. She still eats mine.' },
  { id: 'nights', archetype: 'general', situation: "My mum keeps describing my brother's girlfriend as 'sort of between places'. She has been staying at my mum's for eleven nights." },
  { id: 'yoga', archetype: 'backhanded_grandma', situation: 'My mother-in-law said me in my yoga pants looks like a clown, at the table, in front of the kids.' },
  { id: 'ex', archetype: 'general', situation: "My ex texted 'I've been thinking about you' at 11pm. The next message asked if I still had his PlayStation." },
  { id: 'grandbaby', archetype: 'grandbaby_countdown_clock', situation: 'My mother-in-law brought a knitted baby blanket to our anniversary dinner and said it was just in case.' },
  { id: 'silent', archetype: 'silent_treatment_strategist', situation: "My dad hasn't spoken to me for nine days because I didn't come to a barbecue. He told my sister to tell me he's fine." },
  { id: 'review', archetype: 'general', situation: "My team lead asked me to 'quickly look over' a forty-page deck at 6pm on friday. She'd had it since tuesday." },
]
