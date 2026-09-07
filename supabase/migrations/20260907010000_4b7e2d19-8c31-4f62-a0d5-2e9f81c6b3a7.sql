-- joke_deal_slots: one row per card written, claimed before the model is called.
--
-- The deal used to be a single call that charged the day's counter and wrote
-- all three cards together, so "charged" and "written" could not drift apart.
-- The surface now reports honest per-card progress, which means the three
-- cards are written by three separate calls (writeJokeCard) after one call
-- has charged the set (openJokeDeal).
--
-- That split needs something to stop a charged set from being written more
-- than three times: without it, a client could call writeJokeCard at one
-- position forever and spend a model call every time, all of it off the
-- counter. Claiming the (set_id, position) row is the first thing a write
-- does, so the primary key is what enforces "three cards per charged set,
-- ever" — and it settles a race between two concurrent writes at the same
-- position without a lock.
--
-- It deliberately stores NO card text. A free alias keeps only the card it
-- turns over; the two it leaves face-down are still never on file, and this
-- table records only that their slot was spent.
CREATE TABLE IF NOT EXISTS public.joke_deal_slots (
  set_id uuid NOT NULL REFERENCES public.joke_sets(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0 AND position <= 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, "position")
);

-- Server-side only, like joke_flips: nothing here is ever read by a browser,
-- and there is no owner policy because there is nothing in a row to own.
GRANT ALL ON public.joke_deal_slots TO service_role;
ALTER TABLE public.joke_deal_slots ENABLE ROW LEVEL SECURITY;
