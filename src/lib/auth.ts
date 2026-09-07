import type { Alias } from '../data/types'

/* Cached alias display info. The source of truth lives in public.aliases;
 * this cache is only used for instant paint on cold loads before the DB
 * fetch resolves. Always overwrite from the DB when a session exists. */
const ALIAS_KEY = 'shutap_alias'
const ROLE_KEY = 'shutap_role'
const RETURN_KEY = 'shutap_returnTo'

export function getAlias(): Alias | null {
  try {
    const r = localStorage.getItem(ALIAS_KEY)
    return r ? (JSON.parse(r) as Alias) : null
  } catch {
    return null
  }
}

export function setAlias(alias: Alias): void {
  try {
    localStorage.setItem(ALIAS_KEY, JSON.stringify(alias))
  } catch { /* noop */ }
}

/** Unified sign-out: kills the real Supabase session AND clears every
 *  local cache key we set. Safe to call from any page. */
export async function signOut(): Promise<void> {
  try {
    const { supabase } = await import('@/integrations/supabase/client')
    await supabase.auth.signOut()
  } catch { /* noop */ }
  try {
    localStorage.removeItem(ALIAS_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem('shutap_terms')
    localStorage.removeItem('shutap_user_situations')
    sessionStorage.removeItem('shutap_authed')
    sessionStorage.removeItem('shutap_pending_save')
    sessionStorage.removeItem('shutap_pending_comment')
    sessionStorage.removeItem('shutap_pending_intent')
    sessionStorage.removeItem(RETURN_KEY)
  } catch { /* noop */ }
}

/** Rememeber where to bounce back after the join ceremony. */
export function rememberReturnTo(href: string): void {
  try { sessionStorage.setItem(RETURN_KEY, href) } catch { /* noop */ }
}
