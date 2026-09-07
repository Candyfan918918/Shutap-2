/* Real React Profile page. Lists the user's own situations plus lets them
 * edit their pseudonymous alias (one row per user in public.aliases). */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@/compat/router'
import { useServerFn } from '@tanstack/react-start'

import { useToast } from '../components/Toast'
import {
  listMySituations,
  updateSituation,
  deleteSituation,
} from '../lib/situations.functions'
import { getMyAlias, upsertMyAlias, rerollMyAlias } from '@/lib/alias.functions'
import { getMyBillingStatus, type BillingStatus } from '@/lib/billing.functions'
import { createMirrorPortal } from '@/lib/payments.functions'
import { deleteMyAccount } from '@/lib/account.functions'
import { getStripeEnvironment } from '@/lib/stripe'
import { signOut as unifiedSignOut } from '@/lib/auth'
import { supabase } from '@/integrations/supabase/client'
import { useNoIndex } from '@/components/NoIndex'
import { listMyJokeCards, exportJokeCards } from '@/lib/jokes.functions'
import type { JokeCard, JokeTier } from '@/lib/jokes/deck'
import { SetList, type SetGroup } from './home/joke/SetList'
import { Eyes } from './home/joke/ui'
import { anonSessionId, svgToPng, saveBlob } from './home/joke/jokeClient'

type Tab = 'all' | 'rooms' | 'journals' | 'scans' | 'cards'


interface Situation {
  id: string
  pillar: string | null
  clean_text: string | null
  title: string | null
  body: string | null
  kind: 'scan' | 'spill' | null
  initial_scan: number | null
  scan_band: string | null
  tags: string[] | null
  is_public: boolean
  room_id: string | null
  status: string
  edited: boolean
  created_at: string
  updated_at: string
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

export function ProfilePage() {
  useNoIndex()
  const navigate = useNavigate()
  const { toast, ToastHost } = useToast()
  const list = useServerFn(listMySituations)
  const update = useServerFn(updateSituation)
  const remove = useServerFn(deleteSituation)
  const readAlias = useServerFn(getMyAlias)
  const saveAlias = useServerFn(upsertMyAlias)
  const rerollAlias = useServerFn(rerollMyAlias)
  const fetchBilling = useServerFn(getMyBillingStatus)
  const openPortalFn = useServerFn(createMirrorPortal)
  const deleteAccountFn = useServerFn(deleteMyAccount)
  const [rows, setRows] = useState<Situation[] | null>(null)
  const [email, setEmail] = useState<string>('')
  const [tab, setTab] = useState<Tab>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [alias, setAlias] = useState<{ emotion: string; nation: string; creature: string; emoji: string; display_name: string } | null>(null)
  const [editAlias, setEditAlias] = useState(false)
  const [aliasBusy, setAliasBusy] = useState(false)
  const [billing, setBilling] = useState<BillingStatus | undefined>(undefined)
  const [portalBusy, setPortalBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  // ── 🃏 the cards tab ──
  const listJokeCards = useServerFn(listMyJokeCards)
  const exportCards = useServerFn(exportJokeCards)
  const [cards, setCards] = useState<JokeCard[] | null>(null)
  const [jokeTier, setJokeTier] = useState<JokeTier>('guest')
  const [cardBusy, setCardBusy] = useState(false)

  async function refreshCards() {
    try {
      const res = await listJokeCards({ data: { anon_session_id: anonSessionId() } })
      setJokeTier(res.tier)
      setCards(res.cards)
    } catch {
      // Signed out, or the call failed — either way the tab shows the guest
      // state rather than an error, because for a guest that IS the answer.
      setCards([])
    }
  }

  /** The same export the deck offers, from the card you kept. */
  async function downloadCard(card: JokeCard) {
    if (!card.id || cardBusy) return
    setCardBusy(true)
    try {
      const res = await exportCards({ data: { card_id: card.id, anon_session_id: anonSessionId() } })
      const image = res.images[0]
      if (!image) throw new Error('no image')
      saveBlob(await svgToPng(image.svg, res.width, res.height), image.filename)
      toast(`saved at ${res.width}×${res.height}${res.mark ? ' · with the shutap mark' : ' · clean'}`)
    } catch {
      toast('the image did not render. try once more?')
    } finally {
      setCardBusy(false)
    }
  }

  async function shareCard(card: JokeCard) {
    const text = `${card.text}\n\n— said it on shutap.com`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      toast('copied. paste it wherever it lands best.')
    } catch {
      // A dismissed share sheet lands here too, which is not worth a message.
    }
  }

  /** Newest first, grouped by the situation each card was written for. */
  const cardGroups = useMemo<SetGroup[]>(() => {
    const out: SetGroup[] = []
    const seen = new Map<string, SetGroup>()
    for (const c of cards ?? []) {
      const key = c.set_id ?? c.day ?? 'unknown'
      let g = seen.get(key)
      if (!g) {
        g = { id: key, situation: c.situation ?? '', cards: [] }
        seen.set(key, g)
        out.push(g)
      }
      g.cards.push(c)
    }
    return out
  }, [cards])

  async function refresh() {
    try {
      const data = (await list()) as Situation[]
      setRows(data)
    } catch {
      toast('couldn\'t load your stories.')
      setRows([])
    }
  }

  async function refreshAlias() {
    try {
      const a = await readAlias()
      if (a) {
        const row = a as { emotion: string; nation: string; creature: string; emoji: string; display_name: string }
        setAlias(row)
        try { localStorage.setItem('shutap_alias', JSON.stringify({ name: row.display_name, emoji: row.emoji })) } catch {}
      }
    } catch { /* not signed in */ }
  }

  async function refreshBilling() {
    try {
      const b = await fetchBilling({ data: { environment: getStripeEnvironment() } })
      setBilling(b)
    } catch { setBilling(null) }
  }

  useEffect(() => {
    refresh()
    refreshAlias()
    refreshBilling()
    refreshCards()
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openPortal() {
    setPortalBusy(true)
    try {
      const result = await openPortalFn({
        data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/profile` },
      })
      if ('error' in result) throw new Error(result.error)
      window.location.href = result.url
    } catch (e) {
      toast(e instanceof Error ? e.message : 'couldn\'t open billing portal.')
      setPortalBusy(false)
    }
  }

  async function onDeleteAccount() {
    if (deleteConfirm !== 'delete my account') {
      toast('type "delete my account" to confirm.')
      return
    }
    setDeleteBusy(true)
    try {
      const result = await deleteAccountFn({
        data: { environment: getStripeEnvironment(), confirm: deleteConfirm },
      })
      if ('error' in result) throw new Error(result.error)
      try { localStorage.clear() } catch { /* noop */ }
      await supabase.auth.signOut()
      toast('account deleted.')
      navigate('/welcome')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'couldn\'t delete account.')
      setDeleteBusy(false)
    }
  }

  const counts = useMemo(() => {
    if (!rows) return { rooms: 0, journals: 0, scans: 0 }
    return {
      rooms: rows.filter((r) => r.is_public && r.kind !== 'scan').length,
      journals: rows.filter((r) => !r.is_public).length,
      scans: rows.filter((r) => r.kind === 'scan').length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    if (!rows) return []
    if (tab === 'all') return rows
    if (tab === 'rooms') return rows.filter((r) => r.is_public && r.kind !== 'scan')
    if (tab === 'journals') return rows.filter((r) => !r.is_public)
    return rows.filter((r) => r.kind === 'scan')
  }, [rows, tab])

  async function togglePrivacy(s: Situation) {
    setBusy(s.id)
    try {
      const next = !s.is_public
      await update({ data: { id: s.id, is_public: next } })
      toast(next ? 'posted to the stream.' : 'moved to private journal.')
      await refresh()
    } catch {
      toast('couldn\'t update.')
    } finally {
      setBusy(null)
    }
  }

  async function onDelete(s: Situation) {
    if (!window.confirm('delete this for good?')) return
    setBusy(s.id)
    try {
      await remove({ data: { id: s.id } })
      toast('deleted.')
      await refresh()
    } catch {
      toast('couldn\'t delete.')
    } finally {
      setBusy(null)
    }
  }

  async function signOut() {
    await unifiedSignOut()
    navigate('/welcome')
  }

  function cacheAlias(row: { emoji: string; display_name: string }) {
    try { localStorage.setItem('shutap_alias', JSON.stringify({ name: row.display_name, emoji: row.emoji })) } catch {}
    // Also rewrite the user's own historic room tiles so the feed reflects
    // the current alias (item 6: no stale denormalized display).
    try {
      const raw = localStorage.getItem('shutap_user_situations')
      if (raw) {
        const arr = JSON.parse(raw) as Array<{ alias?: string; emoji?: string }>
        for (const r of arr) { r.alias = row.display_name; r.emoji = row.emoji }
        localStorage.setItem('shutap_user_situations', JSON.stringify(arr))
      }
    } catch { /* noop */ }
    window.dispatchEvent(new Event('shutap:alias-changed'))
  }

  async function onReroll() {
    setAliasBusy(true)
    try {
      const a = await rerollAlias()
      if (a) {
        const row = a as { emotion: string; nation: string; creature: string; emoji: string; display_name: string }
        setAlias(row)
        cacheAlias(row)
        toast('new alias.')
      }
    } catch { toast('couldn\'t re-roll.') }
    finally { setAliasBusy(false) }
  }

  async function onSaveAlias(patch: Partial<{ emotion: string; nation: string; creature: string; emoji: string }>) {
    setAliasBusy(true)
    try {
      const a = await saveAlias({ data: patch })
      if (a) {
        const row = a as { emotion: string; nation: string; creature: string; emoji: string; display_name: string }
        setAlias(row)
        cacheAlias(row)
        toast('alias saved.')
        setEditAlias(false)
      }
    } catch { toast('couldn\'t save.') }
    finally { setAliasBusy(false) }
  }

  const maskedEmail = maskEmail(email)

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '26px 22px 90px' }}>
        {/* identity hero */}
        {alias && (
          <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#100c14,#100c14)', borderRadius: 22, padding: '22px 22px 18px', marginBottom: 18 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 0%, rgba(255,126,179,.22), transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ width: 68, height: 68, borderRadius: '50%', background: 'linear-gradient(135deg,#ff7eb3,#890041)', display: 'grid', placeItems: 'center', fontSize: 30, color: '#fff', boxShadow: '0 8px 22px -8px rgba(0,0,0,.5)' }}>{alias.emoji}</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', color: '#fdfbf9' }}>{alias.display_name}</div>
                <div style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 13.5, color: '#c4a0b2', marginTop: 2 }}>{maskedEmail || 'anonymous'}</div>
              </div>
              <button disabled={aliasBusy} onClick={() => setEditAlias((v) => !v)} style={btn('#ff7eb3')}>{editAlias ? 'close' : 'edit alias'}</button>
              <button disabled={aliasBusy} onClick={onReroll} style={btn('#ff7eb3')}>re-roll</button>
            </div>

            {editAlias && (
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 14 }}>
                {(['emotion', 'nation', 'creature'] as const).map((k) => (
                  <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#c4a0b2' }}>{k}</span>
                    <input
                      defaultValue={alias[k]}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== alias[k]) onSaveAlias({ [k]: v })
                      }}
                      style={{ border: '.5px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '8px 10px', fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 14, background: 'rgba(255,255,255,.06)', color: '#fdfbf9' }}
                    />
                  </label>
                ))}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#c4a0b2' }}>emoji</span>
                  <input
                    defaultValue={alias.emoji}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== alias.emoji) onSaveAlias({ emoji: v })
                    }}
                    maxLength={4}
                    style={{ border: '.5px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '8px 10px', fontFamily: 'Sora,sans-serif', fontSize: 16, background: 'rgba(255,255,255,.06)', color: '#fdfbf9' }}
                  />
                </label>
              </div>
            )}

            {/* stats inside the hero */}
            <div style={{ position: 'relative', display: 'flex', gap: 26, flexWrap: 'wrap', marginTop: 18, paddingTop: 16, borderTop: '.5px solid rgba(255,255,255,.10)' }}>
              {[
                { n: counts.rooms, label: 'rooms open' },
                { n: counts.journals, label: 'private journals' },
                { n: counts.scans, label: 'scans' },
                // An em dash rather than 0: a guest has not kept none, a guest
                // cannot keep. Zero would read as a score.
                { n: jokeTier === 'guest' ? '—' : String(cards?.length ?? 0), label: 'cards kept' },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: 21, color: '#fff', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{s.n}</div>
                  <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a99fa8', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* tabs (underline) */}
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 22, borderBottom: '.5px solid rgba(11,8,15,.08)' }}>
          {(['all', 'rooms', 'journals', 'scans', 'cards'] as Tab[]).map((f) => {
            const active = tab === f
            return (
              <button
                key={f}
                onClick={() => setTab(f)}
                style={{
                  padding: '10px 2px',
                  border: 'none',
                  background: 'transparent',
                  color: active ? '#c1216b' : '#6f666c',
                  fontFamily: 'Sora,sans-serif',
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  borderBottom: '2px solid ' + (active ? '#c1216b' : 'transparent'),
                  marginBottom: -1,
                }}
              >
                {f === 'all' ? 'all'
                  : f === 'rooms' ? 'rooms'
                    : f === 'journals' ? 'journals'
                      : f === 'scans' ? 'scans ✦'
                        : 'cards 🃏'}
              </button>
            )
          })}
        </div>

        {/* ── 🃏 cards ──
            Its own tab rather than rows in "all": a kept card is an artifact
            with a picture, and it does not queue behind rooms and journals in
            a list built for titles and sublines. */}
        {tab === 'cards' ? (
          <CardsTab
            tier={jokeTier}
            cards={cards}
            groups={cardGroups}
            onShare={shareCard}
            onDownload={downloadCard}
            navigate={navigate}
          />
        ) : rows === null ? (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Newsreader,serif', fontStyle: 'italic', color: '#6f666c' }}>loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0', fontFamily: 'Newsreader,serif', fontStyle: 'italic', color: '#6f666c' }}>
            nothing here yet.{' '}
            <span style={{ color: '#c1216b', cursor: 'pointer' }} onClick={() => navigate('/')}>start a spill →</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map((s) => {
              const isScan = s.kind === 'scan' && typeof s.initial_scan === 'number'
              const band = (s.scan_band || 'sitting')
              const emoji = isScan ? '✦' : s.is_public ? '🗯' : '📓'
              const title = s.title || (s.clean_text || s.body || '').slice(0, 80) || 'untitled'
              const subline = [
                s.pillar || null,
                isScan ? 'scan' : s.is_public ? 'room' : 'journal',
                s.edited ? 'edited' : null,
                timeAgo(s.created_at),
              ].filter(Boolean).join(' · ')
              return (
                <ListItem
                  key={s.id}
                  emoji={emoji}
                  title={title}
                  subline={subline}
                  scan={isScan ? { n: s.initial_scan as number, band } : null}
                  actions={
                    <>
                      {s.is_public && s.room_id && (
                        <button onClick={() => navigate('/room?id=' + s.room_id)} style={btn('#c1216b')}>open room →</button>
                      )}
                      <button disabled={busy === s.id} onClick={() => togglePrivacy(s)} style={btn('#890041')}>
                        {s.is_public ? 'make private' : 'post to stream'}
                      </button>
                      <button disabled={busy === s.id} onClick={() => onDelete(s)} style={btn('#b3261e')}>delete</button>
                    </>
                  }
                />
              )
            })}
          </div>
        )}

        {/* billing card */}
        <div style={{ marginTop: 36, paddingTop: 22, borderTop: '.5px solid rgba(11,8,15,.08)' }}>
          <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#6f666c', marginBottom: 10 }}>
            billing
          </div>
          <BillingCard billing={billing} onOpenPortal={openPortal} portalBusy={portalBusy} navigate={navigate} />
        </div>

        <div style={{ marginTop: 24 }}>
          <button onClick={signOut} style={wineLink}>sign out →</button>
        </div>

        {/* danger zone */}
        <div style={{ marginTop: 30, paddingTop: 22, borderTop: '.5px solid rgba(179,38,30,.16)' }}>
          <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#b3261e', marginBottom: 10 }}>
            danger zone
          </div>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} style={{ ...btn('#b3261e'), background: 'transparent' }}>delete account</button>
          ) : (
            <div style={{ background: '#fff5f5', border: '.5px solid rgba(179,38,30,.24)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 15, color: '#0b080f', lineHeight: 1.5 }}>
                this permanently deletes your account, alias, stories, scans, and cancels any active subscription. it cannot be undone.
              </div>
              <div style={{ fontFamily: 'Sora,sans-serif', fontSize: 11, color: '#443c42' }}>
                type <strong>delete my account</strong> to confirm.
              </div>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="delete my account"
                style={{ border: '.5px solid rgba(179,38,30,.32)', borderRadius: 10, padding: '9px 12px', fontFamily: 'Sora,sans-serif', fontSize: 14, background: '#fff' }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  disabled={deleteBusy || deleteConfirm !== 'delete my account'}
                  onClick={onDeleteAccount}
                  style={{ ...btn('#b3261e'), opacity: (deleteBusy || deleteConfirm !== 'delete my account') ? 0.5 : 1 }}
                >{deleteBusy ? 'deleting…' : 'delete permanently'}</button>
                <button
                  disabled={deleteBusy}
                  onClick={() => { setShowDelete(false); setDeleteConfirm('') }}
                  style={btn('#890041')}
                >cancel</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {ToastHost}
    </div>
  )
}

function maskEmail(e: string): string {
  if (!e) return ''
  const [u, d] = e.split('@')
  if (!d) return e
  return u.slice(0, 1) + '•••@' + d
}

function ListItem({ emoji, title, subline, scan, actions }: {
  emoji: string
  title: string
  subline: string
  scan: { n: number; band: string } | null
  actions: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: '.5px solid ' + (hover ? '#a52a5f' : 'rgba(11,8,15,.08)'),
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color .18s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: '#fdfbf9', display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 14, color: '#0b080f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 11.5, color: '#6f666c', marginTop: 2 }}>{subline}</div>
        </div>
        {scan && (
          <div style={{ textAlign: 'right', marginRight: 6 }}>
            <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6f666c' }}>intensity</div>
            <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: 18, color: '#c1216b', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{scan.n}</div>
          </div>
        )}
        <span style={{ fontFamily: 'Sora,sans-serif', fontSize: 20, color: '#6f666c' }} aria-hidden>›</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>
    </article>
  )
}

const wineLink: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: '#890041',
  fontFamily: "'Newsreader',serif",
  fontStyle: 'italic',
  fontSize: 14,
  cursor: 'pointer',
  textDecoration: 'none',
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 999,
    border: '.5px solid ' + color + '40',
    background: color + '10',
    color,
    fontFamily: 'Sora,sans-serif',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: '.02em',
    cursor: 'pointer',
  }
}

function planLabelFor(priceId: string | null): string {
  if (priceId === 'mirror_monthly') return 'monthly · $7.99/mo'
  if (priceId === 'mirror_annual') return 'annual · $49.99/yr'
  return priceId ?? 'unknown plan'
}

function BillingCard({
  billing,
  onOpenPortal,
  portalBusy,
  navigate,
}: {
  billing: BillingStatus | undefined
  onOpenPortal: () => void
  portalBusy: boolean
  navigate: (path: string) => void
}) {
  if (billing === undefined) {
    return <div style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', color: '#6f666c' }}>loading…</div>
  }
  if (billing === null) {
    return (
      <div style={{ background: '#fff', border: '.5px solid rgba(11,8,15,.08)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 15, color: '#0b080f' }}>
          you're on the free tier.
        </div>
        <div>
          <button onClick={() => navigate('/subscribe?plan=annual')} style={btn('#c1216b')}>open the full mirror →</button>
        </div>
      </div>
    )
  }
  const end = billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd) : null
  const endStr = end ? end.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null
  const statusLabel =
    billing.status === 'trialing' ? 'trialing'
    : billing.status === 'active' && billing.cancelAtPeriodEnd ? 'canceling'
    : billing.status === 'active' ? 'active'
    : billing.status === 'past_due' ? 'payment failed'
    : billing.status === 'canceled' && billing.isActive ? 'canceled (grace period)'
    : billing.status
  const statusColor =
    billing.status === 'past_due' ? '#b3261e'
    : billing.cancelAtPeriodEnd || billing.status === 'canceled' ? '#6f666c'
    : '#c1216b'
  return (
    <div style={{ background: '#fff', border: '.5px solid rgba(11,8,15,.08)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: statusColor, background: statusColor + '18', padding: '3px 8px', borderRadius: 999 }}>
          {statusLabel}
        </span>
        <span style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 15, color: '#0b080f' }}>
          {planLabelFor(billing.priceId)}
        </span>
      </div>
      {endStr && (
        <div style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 13.5, color: '#443c42' }}>
          {billing.status === 'trialing' ? `trial ends ${endStr}`
            : billing.cancelAtPeriodEnd || billing.status === 'canceled' ? `access ends ${endStr}`
            : billing.status === 'past_due' ? `payment retrying · access until ${endStr}`
            : `renews ${endStr}`}
        </div>
      )}
      <div>
        {billing.hasCustomer && (
          <button onClick={onOpenPortal} disabled={portalBusy} style={wineLink}>
            {portalBusy ? 'opening…' : 'manage →'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── the cards tab ──
 *
 * Three states, and they are genuinely different answers rather than degrees
 * of the same one:
 *   · a guest has no cards because a guest deck writes nothing down. That is
 *     the rule, not a failure, so it is stated plainly and the alias is
 *     offered — never as a wall in front of cards that exist.
 *   · an alias with nothing kept yet is pointed back at the composer.
 *   · anything kept is rendered by SetList, the same component and the same
 *     card the joke surface uses, so the two cannot drift apart.
 */
function CardsTab({
  tier,
  cards,
  groups,
  onShare,
  onDownload,
  navigate,
}: {
  tier: JokeTier
  cards: JokeCard[] | null
  groups: SetGroup[]
  onShare: (card: JokeCard) => void
  onDownload: (card: JokeCard) => void
  navigate: (to: string) => void
}) {
  const total = cards?.length ?? 0
  const guest = tier === 'guest'
  const keepRule = tier === 'paying'
    ? 'every card you turn over is kept'
    : tier === 'free' ? 'the card you turn over is kept' : 'guests keep nothing'
  const meter = guest
    ? 'reading is free, forever'
    : `${total} kept across ${groups.length} situation${groups.length === 1 ? '' : 's'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#6f666c' }}>
          {keepRule}
        </span>
        <span style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 13.5, color: '#6f666c' }}>
          {meter}
        </span>
      </div>

      {cards === null ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Newsreader,serif', fontStyle: 'italic', color: '#6f666c' }}>
          loading…
        </div>
      ) : guest ? (
        <div style={{ textAlign: 'center', padding: '44px 0 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Eyes size={30} />
          <p style={{ margin: 0, maxWidth: '38ch', fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 17, lineHeight: 1.55, color: '#2e1a26', textWrap: 'pretty' }}>
            you read the whole set and kept none of it — a guest deck writes nothing down. reading
            stays free; an alias is only needed to keep one.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              height: 44, padding: '0 22px', border: 'none', borderRadius: 999, cursor: 'pointer',
              fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 14.5, letterSpacing: '-.01em',
              color: '#fff', background: 'linear-gradient(155deg,#e7548a,#c1216b 55%,#890041)',
              boxShadow: '0 14px 30px -18px rgba(137,0,65,.75)',
            }}
          >
            pick an alias · free
          </button>
        </div>
      ) : total === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0', fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 15, color: '#6f666c' }}>
          nothing kept yet.{' '}
          <span style={{ color: '#c1216b', cursor: 'pointer' }} onClick={() => navigate('/')}>write a set →</span>
        </div>
      ) : (
        <>
          <SetList
            groups={groups}
            mark={tier !== 'paying'}
            onShare={onShare}
            onDownload={onDownload}
          />
          <MirrorMemory tier={tier} cards={cards} total={total} navigate={navigate} />
        </>
      )}
    </div>
  )
}

/* What the kept cards have told the mirror. The numbers are read off the same
   cards above rather than fetched: this is a readout of what is on screen, and
   a second source could disagree with it. The one thing a member sees that a
   free alias does not is the behaviour name — blurred rather than hidden, so
   the shape of what is being withheld is honest. */
function MirrorMemory({
  tier,
  cards,
  total,
  navigate,
}: {
  tier: JokeTier
  cards: JokeCard[]
  total: number
  navigate: (to: string) => void
}) {
  const favourite = useMemo(() => {
    const n: Record<string, number> = {}
    for (const c of cards) n[c.angle] = (n[c.angle] ?? 0) + 1
    const top = Object.keys(n).sort((a, b) => (n[b] ?? 0) - (n[a] ?? 0))[0]
    if (!top) return '—'
    const label = cards.find((c) => c.angle === top)?.angleLabel ?? top
    return label.replace(/^the /, '')
  }, [cards])

  const paying = tier === 'paying'
  const stats = [
    { n: String(total), label: 'joke signals', blur: 'none' },
    { n: paying ? 'boundary' : '—', label: 'behaviour on repeat', blur: paying ? 'none' : 'blur(4px)' },
    { n: favourite, label: 'your angle', blur: 'none' },
  ]

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: '#100c14', borderRadius: 22, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ position: 'absolute', width: '56%', height: '130%', right: '-14%', top: '-30%', background: 'radial-gradient(circle,rgba(231,84,138,.28),transparent 64%)', filter: 'blur(14px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9 }}>
        <Eyes size={18} />
        <span style={{ fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#9e7a8c' }}>
          mirror memory · 🃏 joke
        </span>
      </div>
      <p style={{ margin: 0, position: 'relative', fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 17, lineHeight: 1.55, color: '#f7e8f0', textWrap: 'pretty', maxWidth: '46ch' }}>
        {paying
          ? 'every card you keep feeds the mirror as its own 🃏 joke signal — three angles per situation is enough to see which behaviour keeps coming back, and how your jokes changed as you did.'
          : 'each card you keep enters the mirror as a 🃏 joke signal. one per situation shows it what landed; all three would show it what you chose not to say.'}
      </p>
      <div style={{ position: 'relative', display: 'flex', gap: 26, flexWrap: 'wrap', paddingTop: 14, borderTop: '.5px solid rgba(255,255,255,.10)' }}>
        {stats.map((s) => (
          <div key={s.label}>
            <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 800, fontSize: 21, color: '#fff', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', filter: s.blur }}>
              {s.n}
            </div>
            <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a99fa8', marginTop: 2, whiteSpace: 'nowrap' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => navigate('/mirror')}
          style={{ padding: '6px 12px', borderRadius: 999, border: '.5px solid #ff7eb340', background: '#ff7eb310', color: '#ff7eb3', fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 12, letterSpacing: '.02em', cursor: 'pointer' }}
        >
          open the full mirror →
        </button>
      </div>
    </div>
  )
}
