/* One place the provider sign-in is started from, so the welcome page and the
 * joke-card gate cannot drift apart. Both send the browser to /welcome, which
 * is where age, alias and the return trip are handled. */
import { lovable } from '@/integrations/lovable'

export type OAuthProvider = 'google' | 'apple'

function track(name: string, props: Record<string, unknown> = {}): void {
  void import('@/lib/tracking').then((m) => m.trackEvent(name, props)).catch(() => {})
}

/** Starts the provider round trip. Returns an error string to show, or null
 *  when the browser is on its way (or already has a session). */
export async function startOAuth(provider: OAuthProvider): Promise<string | null> {
  track('sign_in_started', { method: provider })
  try {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + '/welcome',
    })
    if (result.error) {
      const text = result.error.message || 'sign-in failed — please try again'
      track('sign_in_failed', { method: provider, reason: text })
      return text
    }
    if (result.redirected) return null
    track('sign_in_provider_ok', { method: provider })
    return null
  } catch (e) {
    const text = e instanceof Error ? e.message : 'sign-in failed — please try again'
    track('sign_in_failed', { method: provider, reason: text })
    return text
  }
}
