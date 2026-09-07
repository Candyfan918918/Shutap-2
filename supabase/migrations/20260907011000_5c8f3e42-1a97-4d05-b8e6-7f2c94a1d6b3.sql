-- 🃏 joke becomes a real mirror source.
--
-- mirror_signals.source has carried a CHECK constraint listing the six
-- surfaces since the table was created, and 'joke' was never added to it. So
-- every joke card the mirror was told about was rejected by the database on
-- insert: enqueueMirrorSignal logged the error, re-selected, found nothing and
-- returned a null signal id, which the caller discards. The mirror has never
-- received a single joke signal — not an empty one, none at all — even though
-- the member copy has been promising "now with 🃏 joke in the mix".
--
-- Widening the constraint is what actually turns that path on. The client-side
-- half of the same bug (the payload named its text field `text` where the
-- pipeline reads `raw_text`) is fixed in jokes.functions.ts; without this
-- migration that fix alone would still be rejected here.
DO $$
DECLARE
  check_name text;
BEGIN
  SELECT conname INTO check_name
  FROM pg_constraint
  WHERE conrelid = 'public.mirror_signals'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%source%';

  IF check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.mirror_signals DROP CONSTRAINT %I', check_name);
  END IF;
END $$;

ALTER TABLE public.mirror_signals
  ADD CONSTRAINT mirror_signals_source_check
  CHECK (source IN ('spill', 'scan', 'comments', 'likes', 'follows', 'browse', 'joke'));
