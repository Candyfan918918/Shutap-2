-- The joke-card generator, stage by stage, gets a home in the schema.
--
-- The writer is now three model calls and a floor: a premise pass once per
-- set, ten candidates per card, and a judge on a different model family.
-- Everything it needs to read and everything it should remember is here:
--
--   joke_sets         · the cached premises (keyed on the prompt version that
--                       made them), the voice the set speaks in, and the
--                       roast card's target
--   joke_cards        · the prompt version, the voice, both models, every
--                       candidate with its fate, and the judge's one clause —
--                       without which a change in quality cannot be traced
--                       to a cause
--   joke_voices       · the voices the candidate pass writes in
--   joke_hall_of_fame · situation→line pairs the candidate pass is shown,
--                       never a line alone
--
-- Both new tables are read by the server with the service role only. They
-- carry RLS with no policies, so no client role can read a prompt or a
-- curated example.

ALTER TABLE public.joke_sets
  ADD COLUMN IF NOT EXISTS premises jsonb,
  ADD COLUMN IF NOT EXISTS premises_version text,
  ADD COLUMN IF NOT EXISTS voice_key text,
  ADD COLUMN IF NOT EXISTS roast_target text;

ALTER TABLE public.joke_cards
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS voice_key text,
  ADD COLUMN IF NOT EXISTS writer_model text,
  ADD COLUMN IF NOT EXISTS judge_model text,
  ADD COLUMN IF NOT EXISTS judge_why text,
  ADD COLUMN IF NOT EXISTS candidates jsonb;

-- joke_voices
CREATE TABLE IF NOT EXISTS public.joke_voices (
  key text NOT NULL PRIMARY KEY,
  label text NOT NULL,
  persona_prompt text NOT NULL,
  register_notes text NOT NULL,
  banned_moves text NOT NULL,
  weight integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.joke_voices TO service_role;
ALTER TABLE public.joke_voices ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS joke_voices_touch_updated_at ON public.joke_voices;
CREATE TRIGGER joke_voices_touch_updated_at BEFORE UPDATE ON public.joke_voices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- joke_hall_of_fame
CREATE TABLE IF NOT EXISTS public.joke_hall_of_fame (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot text NOT NULL CHECK (slot IN ('the_take', 'the_clapback', 'the_roast')),
  voice_key text REFERENCES public.joke_voices(key) ON DELETE SET NULL,
  archetype text,
  situation_clean text NOT NULL,
  joke_text text NOT NULL,
  source text NOT NULL DEFAULT 'authored',
  card_id uuid REFERENCES public.joke_cards(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS joke_hall_of_fame_lookup_idx
  ON public.joke_hall_of_fame (slot, voice_key, archetype) WHERE is_active;

GRANT ALL ON public.joke_hall_of_fame TO service_role;
ALTER TABLE public.joke_hall_of_fame ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS joke_hall_of_fame_touch_updated_at ON public.joke_hall_of_fame;
CREATE TRIGGER joke_hall_of_fame_touch_updated_at BEFORE UPDATE ON public.joke_hall_of_fame
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.joke_sets
  DROP CONSTRAINT IF EXISTS joke_sets_voice_key_fkey;
ALTER TABLE public.joke_sets
  ADD CONSTRAINT joke_sets_voice_key_fkey
  FOREIGN KEY (voice_key) REFERENCES public.joke_voices(key) ON DELETE SET NULL;

-- ── the voices ──
-- The same four are the code-level floor in src/lib/jokes/voices.server.ts;
-- edit them here to tune without a deploy, there to change the floor.
INSERT INTO public.joke_voices (key, label, persona_prompt, register_notes, banned_moves, weight) VALUES
  (
    'petty_historian',
    'the petty historian',
    'You keep the record. You remember what was said in march and what was said in june, and you set them next to each other without comment. You do not get angry; you get accurate. Your comedy is the footnote — the one small verifiable detail that makes the whole story fall over. You never raise your voice, because the dates do it for you.',
    'Flat declaratives. Past tense. Counts, dates and quantities wherever the situation supplies them, and never one it did not. No exclamation marks. A rhetorical question only in the clapback.',
    'sarcastic "oh" or "wow" openers, "imagine", "literally", invented numbers, any sentence over twenty words, any sentence that ends by explaining the joke',
    3
  ),
  (
    'deadpan_friend',
    'the friend who has heard this before',
    'You are the friend across the table who has heard every version of this and stopped being surprised years ago. You are on their side without ever saying so — the loyalty shows in how little needs explaining. You say the thing everyone was tiptoeing around the way you would say it is raining.',
    'Lowercase, spoken, short. One idea per line. Concrete nouns from the situation, word for word. Commas over conjunctions. A full stop where a lesser writer would put a wink.',
    'exclamation marks, questions in the take or the roast, "honestly", "literally", "girl", "babe", anything shaped like a hashtag, listing three things',
    3
  ),
  (
    'court_stenographer',
    'the court stenographer',
    'You transcribe. You treat the situation as a proceeding in which the other person is the witness, and you read their own testimony back to them. Everything funny is already in the record; your only job is to enter it. You never comment on character — you note the exhibit, the timestamp, the contradiction, and you keep typing.',
    'Procedural nouns (the record, the exhibit, the statement, the motion, the minutes) applied to domestic facts. Present tense for what is on file, past tense for what was claimed. Dry to the point of clerical.',
    'legal jargon beyond plain nouns (no "heretofore", no latin), a verdict on the user, "objection", the word "court" itself, anything a stenographer would not be allowed to say out loud',
    2
  ),
  (
    'group_chat',
    'the group chat',
    'You are the reply that lands in the group chat forty seconds after the screenshot and collects four crying-laughing reactions. You are fast, fond and merciless about the other person, and you only ever need one line. You have the timing of someone typing with one thumb while walking.',
    'Lowercase. No trailing full stop unless there are two sentences. Short. Reuse the exact word from the screenshot everyone is staring at. A fragment is allowed if it lands.',
    'emoji, "lol", "omg", "not X", "the way that", "i can''t", "screaming", "this you?", quoting the whole situation back, more than one comma',
    2
  )
ON CONFLICT (key) DO NOTHING;

-- ── the hall of fame ──
-- Situation and line together, always. voice_key NULL = any voice;
-- archetype NULL = any archetype. Guarded so a re-run does not double them.
INSERT INTO public.joke_hall_of_fame (slot, voice_key, archetype, situation_clean, joke_text)
SELECT v.slot, NULL, v.archetype, v.situation_clean, v.joke_text
FROM (VALUES
  ('the_take', NULL, 'My manager said there''s no budget for training this year. He said it in the boardroom they finished refurbishing last month.', 'the budget exists. it''s the room.'),
  ('the_take', NULL, 'My boss reposted my exact job on LinkedIn at fifteen thousand more than I make, and told me I was welcome to apply.', 'the job was priced correctly the moment it was hypothetically vacant.'),
  ('the_take', 'uninvited_visitor', 'My mother-in-law reorganised my kitchen while I was at work and left a note on the counter saying ''now you''ll be able to find things''.', 'she didn''t tidy a kitchen. she filed a complaint in cupboards.'),
  ('the_take', NULL, 'He turned up two hours late and spent the first twenty minutes explaining why.', 'he built twenty minutes of infrastructure to explain two hours.'),
  ('the_take', NULL, 'My husband says we split the chores fifty-fifty. He counts ''reminding me'' as a chore.', 'the split is fifty-fifty the way a seesaw with one person on it is level.'),
  ('the_take', NULL, 'My flatmate put her name on every item of her food in the fridge. She still eats mine.', 'she didn''t label her food. she labelled the exception.'),

  ('the_clapback', NULL, 'My mum keeps describing my brother''s girlfriend as ''sort of between places''. She has been staying at my mum''s for eleven nights.', '"eleven nights. at what point do i start introducing her?"'),
  ('the_clapback', NULL, 'My flatmate put her name on every item of her food in the fridge. She still eats mine.', '"you''ve got a system for your food. what''s the system for mine?"'),
  ('the_clapback', NULL, 'My flatmate put her name on every item of her food in the fridge. She still eats mine.', '"label mine too. same pen. let''s see if it works both ways."'),
  ('the_clapback', NULL, 'My manager said there''s no budget for training this year. He said it in the boardroom they finished refurbishing last month.', '"understood. i''ll do the course in the new room, then."'),
  ('the_clapback', NULL, 'He turned up two hours late and spent the first twenty minutes explaining why.', '"you had two hours to think of that. which part took the longest?"'),
  ('the_clapback', 'backhanded_grandma', 'My mother-in-law said me in my yoga pants looks like a clown, at the table, in front of the kids.', '"noted. is that one going in the christmas letter, or just the group chat?"'),

  ('the_roast', NULL, 'He turned up two hours late and spent the first twenty minutes explaining why.', 'he arrived with exhibits.'),
  ('the_roast', 'uninvited_visitor', 'My mother-in-law reorganised my kitchen while I was at work and left a note on the counter saying ''now you''ll be able to find things''.', 'she broke in, ran an audit, and left the findings in the cutlery drawer.'),
  ('the_roast', NULL, 'My boss reposted my exact job on LinkedIn at fifteen thousand more than I make, and told me I was welcome to apply.', 'he''s headhunting for the role of you, and you didn''t make the shortlist.'),
  ('the_roast', NULL, 'My mum keeps describing my brother''s girlfriend as ''sort of between places''. She has been staying at my mum''s for eleven nights.', 'eleven nights isn''t between places. that''s a tenancy with a nicer name.'),
  ('the_roast', NULL, 'My husband says we split the chores fifty-fifty. He counts ''reminding me'' as a chore.', 'he does half the chores the way a foreman does half the building.'),
  ('the_roast', NULL, 'My flatmate put her name on every item of her food in the fridge. She still eats mine.', 'she labelled her food so she''d know which half of the fridge was the buffet.')
) AS v(slot, archetype, situation_clean, joke_text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.joke_hall_of_fame h WHERE h.slot = v.slot AND h.joke_text = v.joke_text
);
