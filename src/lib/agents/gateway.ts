// Shared AI Gateway helper for agent server functions.
// Uses Lovable AI Gateway by default; honors ANTHROPIC_API_KEY override.
import { generateText } from 'ai'
import { createLovableAiGatewayProvider } from '@/lib/ai-gateway.server'

export type AgentMessage = { role: 'user' | 'assistant'; content: string }

/** Default model for every agent that does not name its own. */
export const DEFAULT_MODEL = 'google/gemini-2.5-flash'

/** Reasoning-first models reject a sampling temperature outright; sending one
 *  fails the whole call rather than being ignored. */
function acceptsTemperature(modelId: string): boolean {
  return !/^openai\/(gpt-5|o[1-9])/i.test(modelId)
}

/** The provider family a model id belongs to — `google`, `openai`, … The
 *  joke judge must sit in a different family from the joke writer. */
export function modelFamily(modelId: string): string {
  return modelId.split('/')[0]?.toLowerCase() ?? modelId
}

export async function callAgent(opts: {
  system?: string
  messages: AgentMessage[]
  maxTokens?: number
  jsonMode?: boolean
  /** Per-call model override, e.g. the joke judge runs on a different family
   *  from the joke writer. Falls back to LOVABLE_AI_MODEL, then the default. */
  model?: string
  /** Sampling temperature. Omitted → the model's own default. */
  temperature?: number
  /** Reasoning models only (gpt-5 family): how long they may think before
   *  answering. 'low' is the difference between a judge that answers inside
   *  a flip and one that answers after the reader has left. */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
  /** Hard wall-clock budget for the call. Past it the call is abandoned and
   *  reported as an error, so a caller with a floor can use the floor
   *  instead of holding a card on its edge forever. */
  timeoutMs?: number
}): Promise<{ text: string; error?: string; model: string }> {
  const maxTokens = Math.min(Math.max(opts.maxTokens ?? 1500, 64), 4096)
  // Default to Flash: 2.5-Pro spends hidden reasoning tokens against
  // maxOutputTokens and truncates our small structured JSON responses,
  // which sent every Mirror reading/punch call into the fallback path.
  const modelId = opts.model || process.env.LOVABLE_AI_MODEL || DEFAULT_MODEL
  const lovableKey = process.env.LOVABLE_API_KEY
  if (!lovableKey) return { text: '', error: 'no AI key', model: modelId }
  const controller = opts.timeoutMs ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), opts.timeoutMs) : null
  try {
    const gateway = createLovableAiGatewayProvider(lovableKey)
    const result = await generateText({
      model: gateway(modelId),
      system: opts.system,
      messages: opts.messages,
      maxOutputTokens: maxTokens,
      ...(opts.temperature !== undefined && acceptsTemperature(modelId)
        ? { temperature: opts.temperature }
        : {}),
      ...(opts.reasoningEffort && !acceptsTemperature(modelId)
        ? { providerOptions: { lovable: { reasoningEffort: opts.reasoningEffort } } }
        : {}),
      ...(controller ? { abortSignal: controller.signal } : {}),
    })
    return { text: result.text, model: modelId }
  } catch (err) {
    const aborted = controller?.signal.aborted
    const message = aborted
      ? `timed out after ${opts.timeoutMs}ms`
      : err instanceof Error
        ? err.message
        : 'gateway error'
    return { text: '', error: message, model: modelId }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function tryParseJson<T>(text: string): T | null {
  if (!text) return null
  // strip ```json fences if present
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // try to find first { ... } block
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) as T } catch { return null }
    }
    return null
  }
}
