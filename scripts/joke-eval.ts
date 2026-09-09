// Run the joke-card ladder over the frozen eval set and print what it wrote.
//
//   LOVABLE_API_KEY=… bun run scripts/joke-eval.ts            all twelve, all three cards
//   LOVABLE_API_KEY=… bun run scripts/joke-eval.ts fridge late   a subset, by id
//   JOKE_EVAL_SLOTS=the_roast bun run scripts/joke-eval.ts     one slot only
//
// No database: voices and the hall of fame come from the seed in
// voices.server.ts and premises are made fresh each run. Change one thing,
// re-run, compare. The output is JSON lines so runs can be diffed.
import { EVAL_SET } from '@/lib/jokes/eval-set'
import { SLOT_KEYS, type SlotKey } from '@/lib/jokes/deck'
import { PROMPT_VERSION } from '@/lib/jokes/prompts.server'
import {
  classifyRoastTarget,
  generateFromInputs,
  judgeModel,
  runPremisePass,
  usedPremises,
  writerModel,
} from '@/lib/jokes/pipeline.server'
import { loadExamples, loadVoices, pickVoice } from '@/lib/jokes/voices.server'

async function main() {
  const wanted = process.argv.slice(2)
  const items = wanted.length ? EVAL_SET.filter((e) => wanted.includes(e.id)) : EVAL_SET
  const slots = (process.env['JOKE_EVAL_SLOTS']?.split(',').filter(Boolean) as SlotKey[] | undefined) ?? SLOT_KEYS
  if (!process.env['LOVABLE_API_KEY']) {
    console.error('LOVABLE_API_KEY is not set; the gateway will refuse every call and every card will be a fallback.')
  }
  console.error(`prompt ${PROMPT_VERSION} · writer ${writerModel()} · judge ${judgeModel()} · ${items.length} situations · ${slots.join(', ')}`)

  const voices = await loadVoices(null)
  for (const item of items) {
    const premises = await runPremisePass(item.situation)
    const voice = pickVoice(voices, item.id)
    const roastTarget = classifyRoastTarget(item.situation)
    console.log(JSON.stringify({ id: item.id, stage: 'premises', voice: voice.key, roast_target: roastTarget, premises }))
    for (const slot of slots) {
      const examples = await loadExamples(null, { slot, voiceKey: voice.key, archetype: item.archetype })
      const card = await generateFromInputs({
        situation: item.situation,
        slot,
        voice,
        premises: usedPremises(premises),
        examples,
        roastTarget,
      })
      console.log(
        JSON.stringify({
          id: item.id,
          stage: 'card',
          slot,
          text: card.text,
          used_fallback: card.used_fallback,
          judge_score: card.judge_score,
          judge_why: card.judge_why,
          candidates: card.candidates,
        }),
      )
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
