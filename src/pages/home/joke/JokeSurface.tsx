/* The joke-card surface.
 *
 * The flow, in the order a person meets it:
 *   spill → the companion OFFERS three cards → three cards → read them
 *   → save / share → (guest) the alias gate → (free) the clean-cards upsell
 *   → (member) clean exports and the offer to post it in a room.
 *
 * Three rules hold the shape, and every branch below obeys them:
 *   · reading is free at every tier, guests included. Nothing gates a card.
 *   · the companion offers the cards at a positive peak. There is no
 *     standalone share button anywhere on this surface.
 *   · crisis outranks all of it: no cards, no gate, no paywall.
 *
 * The tier, the card text and the export size are all resolved on the server.
 * This component only draws what it is handed. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { supabase } from '@/integrations/supabase/client'
import {
  submitJokeEntry,
  openJokeDeal,
  writeJokeCard,
  claimJokeSession,
  keepJokeCard,
  listMyJokeCards,
  postJokeCardToRoom,
  exportJokeCards,
} from '@/lib/jokes.functions'
import {
  ALIAS_OFFER,
  ARCHETYPE_LABEL,
  angleLabel,
  MEMBER_OFFER,
  exportSpec,
  usageBlock,
  usageIsCurrent,
  type JokeCard,
  type JokeTier,
  type JokeUsage,
  type SlotKey,
} from '@/lib/jokes/deck'
import { PLAN_TO_PRICE, usd } from '@/lib/pricing'
import {
  anonSessionId,
  canShareFiles,
  clearAnonSessionId,
  clearJokePending,
  isIOS,
  isShareAbort,
  jokeTrack,
  openBlob,
  pngFile,
  readJokePending,
  saveEach,
  svgToPng,
  writeJokePending,
  type JokePending,
  type NamedBlob,
} from './jokeClient'
import { CardFace } from './CardFace'
import { CardBack, CardBackStyles } from './CardBack'
import { FlipCard } from './FlipCard'
import { CardActions } from './CardActions'
import { PaywallBlock, PAYWALL_ID } from './PaywallBlock'
import { SetList, type SetGroup } from './SetList'
import { useDeck } from './useDeck'

import { AliasCeremony, type CeremonyAlias } from './AliasCeremony'
import { CardShareSheet } from './CardShareSheet'
import { UpgradeSheet } from './UpgradeSheet'
import { LimitSheet, type LimitSheetReason } from './LimitSheet'
import { WipBand } from './WipBand'
import { Button, CompanionLine, Eyebrow, SORA, NEWS, INK, MUTED, FAINT, ACCENT } from './ui'

/** What the reader asked for when the alias gate went up, resumed afterwards.
 *  The card rides along by position: the gate can be answered minutes later,
 *  and by then the set has been re-read from the server with real ids. */
type Pending =
  | { type: 'save'; position: number }
  | { type: 'share'; position: number }
  | { type: 'post'; position: number }
  | { type: 'saveSet' }
  | { type: 'checkout' }
  /** A guest tapped one of the two cards behind the wall. Nothing to resume
   *  but the deck itself, which unlocks the moment the tier changes. */
  | { type: 'flip' }
  /** the limit sheet sent a guest to get an alias; the members' offer follows */
  | { type: 'upgrade' }

type SetState = { id: string; situation: string; archetype: string }

/** The price line the upgrade sheet quotes: annual first, monthly as the
 *  alternative — the same order the subscribe page leads with. */
/** Where a saved picture is meant to end up, for the browsers that cannot hand
 *  files to an app themselves. Opened after the file is on disk. */
const SHARE_DEST: Record<string, string> = {
  x: 'https://twitter.com/compose/post',
  instagram: 'https://instagram.com',
  tiktok: 'https://tiktok.com',
  sms: 'sms:',
  all: '',
}

const PRICE = `${usd(PLAN_TO_PRICE.annual.amount)} / year (${usd(PLAN_TO_PRICE.annual.amount / 12)}/mo) · or ${usd(PLAN_TO_PRICE.monthly.amount)} monthly`

export function JokeSurface() {
  const navigate = useNavigate()
  const submit = useServerFn(submitJokeEntry)
  const openDeal = useServerFn(openJokeDeal)
  const writeCard = useServerFn(writeJokeCard)
  const claim = useServerFn(claimJokeSession)
  const keep = useServerFn(keepJokeCard)
  const listCards = useServerFn(listMyJokeCards)
  const postCard = useServerFn(postJokeCardToRoom)
  const exportCards = useServerFn(exportJokeCards)

  // ── composer ──
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [howOpen, setHowOpen] = useState(false)

  // ── identity ──
  const [tier, setTier] = useState<JokeTier>('guest')
  const [alias, setAlias] = useState<CeremonyAlias | null>(null)
  const [ceremonyOpen, setCeremonyOpen] = useState(false)

  // ── the set ──
  const [crisis, setCrisis] = useState(false)
  const [set, setSet] = useState<SetState | null>(null)
  const [cards, setCards] = useState<JokeCard[]>([])
  // 'reading' while the spill is scrubbed and read, 'dealing' while the three
  // cards are written. One uninterrupted move from the composer to the deck.
  const [phase, setPhase] = useState<'idle' | 'reading' | 'dealing'>('idle')
  const [dealFailed, setDealFailed] = useState(false)
  /** Some of the three writes came back, some did not. The deck keeps what
   *  landed; the slots that never will must stop being waited on. */
  const [dealPartial, setDealPartial] = useState(false)
  /** Seconds since the send, for the WIP band's clock and its copy ladder. */
  const [elapsed, setElapsed] = useState(0)
  const [refusal, setRefusal] = useState<string | null>(null)
  /** Today's counter, as the server last reported it. Consulted before a
   *  spill is sent, so a spent day is answered from here without a round
   *  trip — the server still has the final say. */
  const [usage, setUsage] = useState<JokeUsage | null>(null)
  const [limit, setLimit] = useState<{ open: boolean; reason: LimitSheetReason }>({ open: false, reason: 'daily_sets' })
  /** The card an action was last aimed at. The deck has no single "current"
   *  card any more, so the share sheet and the after-save panel both need to
   *  be told which one they are talking about. */
  const [focus, setFocus] = useState<JokeCard | null>(null)

  // ── the after-save moment ──
  const [shareOpen, setShareOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [postedAlias, setPostedAlias] = useState<string | null>(null)

  // ── the rest ──
  const [list, setList] = useState<JokeCard[]>([])
  
  const [toast, setToast] = useState<string | null>(null)
  const [resumeAt, setResumeAt] = useState(0)
  /** Slots a guest had turned over before the sign-in round trip. Set before
   *  the restored set, so the deck comes back open on exactly those cards. */
  const [restored, setRestored] = useState<ReadonlySet<string> | null>(null)
  const pending = useRef<Pending | null>(null)
  /** One claim per return, whichever path notices the session first. */
  const claimRan = useRef(false)
  const bootRan = useRef(false)
  const deckRef = useRef<HTMLDivElement | null>(null)
  /** The band is the first thing to appear after the send, so the send scrolls
   *  to it once — before the deck exists to scroll to. */
  const wantWipScroll = useRef(false)

  const signedIn = tier !== 'guest'
  const spec = exportSpec(tier)

  /** Slot → the card written for it, once the deal lands. The backs are up
   *  before this has anything in it. */
  const bySlot = useMemo(() => {
    const map = new Map<string, JokeCard>()
    for (const c of cards) map.set(c.angle, c)
    return map
  }, [cards])
  const written = useMemo(() => new Set(bySlot.keys()), [bySlot])


  const ctx = useCallback(
    // No timezone is sent: the server derives the day from stored state only.
    () => ({ anon_session_id: anonSessionId() }),
    [],
  )

  const say = useCallback((m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const deck = useDeck({
    // Seeded off the set so the shuffle is stable for this situation and the
    // position reported with first_flip_slot is the one they actually saw.
    seed: set?.id ?? 'empty',
    tier,
    written,
    preRevealed: restored ?? undefined,
    // A refused deal releases a card turned over early just as a jammed one
    // does — otherwise it stays parked on its edge, and the deck reads as two
    // cards with a hole where the third should be. A partial deal releases it
    // for the same reason: the writes have all settled, so a slot still
    // missing its card is never going to get one.
    failed: dealFailed || dealPartial || refusal !== null,
    onFirstFlip: (slot, position) => jokeTrack('first_flip_slot', tier, { slot, position }),
    onReveal: (slot, position) => {
      const c = bySlot.get(slot)
      jokeTrack('card_revealed', tier, {
        slot, position, used_fallback: c?.used_fallback ?? null,
      })
      // Signed in, the card you turned over is kept the moment it lands —
      // written to your set list and handed to the mirror. The two still
      // face-down are not: they were never yours to read.
      if (c && signedIn && !c.id) void ensureKept(c)
    },
    onSpentTap: (slot) => {
      jokeTrack('spent_card_tapped', tier, { slot })
      document.getElementById(PAYWALL_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  })

  const revealedSlotKeys = useMemo(
    () => new Set(deck.revealedSlots.map((sl) => sl.key as string)),
    [deck.revealedSlots],
  )

  /** The cards of the open situation that are turned over AND on file — the
   *  ones "all N" means for anyone signed in. */
  const exportableIds = useMemo(
    () => cards.filter((c) => c.id && revealedSlotKeys.has(c.angle)).map((c) => c.id as string),
    [cards, revealedSlotKeys],
  )

  /** A guest's cards have no ids — nothing of theirs is stored — so what is
   *  exportable for them is simply what they turned over. */
  const guestExportable = useMemo(
    () => cards.filter((c) => revealedSlotKeys.has(c.angle)),
    [cards, revealedSlotKeys],
  )

  /** How many cards of the open situation an "all N" action would carry. */
  const exportableCount = signedIn ? exportableIds.length : guestExportable.length

  /** Whether the card an action is aimed at belongs to the open situation. A
   *  card reached from the set list is on its own. */
  const focusInSet = useMemo(
    () => (signedIn
      ? !!focus?.id && exportableIds.includes(focus.id)
      : !!focus && revealedSlotKeys.has(focus.angle)),
    [focus, exportableIds, revealedSlotKeys, signedIn],
  )

  const refresh = useCallback(async () => {
    try {
      const res = await listCards({ data: ctx() })
      setTier(res.tier)
      setList(res.cards)
      setUsage(res.usage)
      if (res.alias) setAlias(res.alias)
    } catch { /* stay guest */ }
  }, [listCards, ctx])

  useEffect(() => { void refresh() }, [refresh])

  /* The band's clock. It starts when the send does and runs until the last
     card lands — deliberately keyed off "is anything happening" rather than
     off `phase` itself, so the reading → dealing handover does not reset it
     halfway through the one wait the reader is actually sitting through. */
  const working = phase !== 'idle'
  useEffect(() => {
    if (!working) return
    setElapsed(0)
    const t = window.setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [working])

  // ─────────────────────── the alias gate, resumed ───────────────────────

  // Resuming runs from an EFFECT rather than from inside the claim callback:
  // the claim writes the freshly persisted cards into state, and the action it
  // resumes needs their new ids. Bumping this counter defers the action to the
  // commit that carries them.
  useEffect(() => {
    if (!resumeAt) return
    const p = pending.current
    pending.current = null
    if (!p) return
    if (p.type === 'save') void doSave(at(p.position))
    else if (p.type === 'saveSet') void doSaveSet()
    else if (p.type === 'share') void openShare(at(p.position))
    else if (p.type === 'post') void doPost(at(p.position))
    else if (p.type === 'checkout') void navigate({ to: '/subscribe', search: { plan: 'annual' } as never })
    else if (p.type === 'upgrade') { jokeTrack('upgrade_shown', tier, { after: 'limit' }); setUpgradeOpen(true) }
    else if (p.type === 'flip') say('the other two are yours now — flip them.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeAt])

  /** Sign-in lands back on this page — same tab, or a full round trip through
   *  /welcome. Either way: wait for a REAL session, claim the guest set with
   *  the cards they were holding, put the deck back, then resume what they
   *  were reaching for. Runs at most once per return. */
  const claimAndResume = useCallback(async (stored?: JokePending | null) => {
    if (claimRan.current) return
    // Whatever they had turned over as a guest rides along, so the gate costs
    // them none of it. Only what was turned over: the two still face-down are
    // written when they turn them — which, with an alias, they now can.
    const revealed = new Set(deck.revealedSlots.map((s) => s.key as string))
    const held = stored
      ? stored.held
      : set
        ? cards
            .filter((c) => !c.id && revealed.has(c.angle))
            .map((c) => ({
              set_id: set.id,
              position: c.position,
              angle: c.angle,
              text: c.text,
              used_fallback: c.used_fallback,
              judge_score: c.judge_score,
            }))
        : []
    try {
      // The app also has a background anonymous auth session. Wait for an
      // actual authenticated user, not merely any access token.
      let realSession = false
      for (let i = 0; i < 12 && !realSession; i++) {
        const session = (await supabase.auth.getSession()).data.session
        realSession = !!session?.access_token && session.user.is_anonymous !== true
        if (!realSession) await new Promise((r) => setTimeout(r, 250))
      }
      // No session: they came back without signing in. Leave the note where
      // it is, say nothing, and let them read on.
      if (!realSession) return
      claimRan.current = true
      const res = await claim({ data: { ...ctx(), hold: held } })
      // The anonymous bootstrap session can still reach here; the server
      // refuses it in kind rather than throwing, and there is nothing to claim.
      if (!res.ok) { claimRan.current = false; return }
      setTier(res.tier)
      clearAnonSessionId()
      if (res.alias) setAlias(res.alias)
      if (res.claimed.length) {
        jokeTrack('guest_cards_claimed', res.tier, { n: res.claimed.length })
      }
      jokeTrack('signin_completed', res.tier, { alias_is_new: res.alias_is_new })

      if (stored) {
        // Came back from /welcome: the page is fresh, so the situation, the
        // cards they had read and the pending action all come from the note.
        clearJokePending()
        setRestored(new Set(stored.revealed))
        setCrisis(false)
        setSet(stored.set)
        // The deck is RESTORED, never re-dealt: the set's three slots were
        // already claimed by the guest deal. The claimed rows carry the ids of
        // the cards they had turned over; the other two come back id-less and
        // are written when they turn them, through ensureKept.
        setCards(
          stored.cards.map((c) => {
            const kept = res.claimed.find((k) => k.position === c.position)
            if (kept) return kept
            return {
              id: null,
              position: c.position,
              angle: c.angle,
              angleLabel: angleLabel(c.angle),
              text: c.text,
              used_fallback: c.used_fallback ?? false,
              judge_score: c.judge_score ?? null,
              saved: false,
            } satisfies JokeCard
          }),
        )
        setSaved(null)
        setPostedAlias(null)
        // They came back for the cards, not the hero: bring the deck into view
        // once it has rendered, with share and download under the open card.
        requestAnimationFrame(() => {
          const el = deckRef.current
          if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72), behavior: 'smooth' })
        })
        pending.current = (stored.action.type === 'save' || stored.action.type === 'share' || stored.action.type === 'post')
          ? { type: stored.action.type, position: stored.action.position ?? 0 } as Pending
          : ({ type: stored.action.type } as Pending)
      } else if (res.claimed.length) {
        setCards((prev) =>
          prev.map((c) => res.claimed.find((k) => k.position === c.position) ?? c),
        )
      }
      await refresh()

      // A brand-new alias gets its ceremony; a returning one goes straight
      // back to whatever they were doing. Anyone who came through /welcome
      // already picked a name there, so this is normally skipped.
      if (res.alias_is_new) setCeremonyOpen(true)
      else setResumeAt((n) => n + 1)
    } catch { /* leave them signed in without a claim */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim, ctx, cards, set, refresh, deck.revealedSlots])

  /* A guest who signed in through /welcome lands here on a cold page. The note
     they left is picked up once, after the first read of their identity. */
  useEffect(() => {
    if (bootRan.current) return
    bootRan.current = true
    void (async () => {
      const note = readJokePending()
      if (!note) return
      await claimAndResume(note)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Anonymous bootstrap also emits SIGNED_IN. Only a real account may
      // claim guest sets/cards or resume a blocked action.
      if (event === 'SIGNED_IN' && session?.user.is_anonymous !== true) {
        void claimAndResume(readJokePending())
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [claimAndResume])

  /** Write the open set down before any full-page round trip — sign-in or
   *  checkout — so the deck comes back exactly as it was left: the same three
   *  cards, the same ones turned over, and the thing they were reaching for. */
  function notePending(p: Pending, returnTo: string) {
    if (!set) return
      const revealed = deck.revealedSlots.map((s) => s.key as string)
      const asHeld = (c: JokeCard) => ({
        set_id: set.id,
        position: c.position,
        angle: c.angle,
        text: c.text,
        used_fallback: c.used_fallback,
        judge_score: c.judge_score,
      })
      writeJokePending({
        set: set,
        cards: cards.map(asHeld),
        held: cards.filter((c) => !c.id && revealed.includes(c.angle)).map(asHeld),
        revealed,
        action: 'position' in p ? { type: p.type, position: p.position } : { type: p.type },
        returnTo,
      })
  }

  function raiseGate(trigger: string, p: Pending) {
    pending.current = p
    // Sign-in is a full-page round trip, so the deck and the thing they were
    // reaching for are written down before the handoff to /welcome, which
    // honours this on its last step and sends them back here — true for every
    // gate, including the ones that fire with no set open.
    try { sessionStorage.setItem('shutap_returnTo', '/') } catch { /* noop */ }
    notePending(p, '/')
    jokeTrack('alias_gate_shown', tier, { trigger })
    // No in-page sheet: the gate is /welcome itself, reached by a full page
    // load so the note and returnTo above are committed before the handoff.
    window.location.assign('/welcome')
  }

  /** The limit, instead of a deck. Nothing is written for a spent day. */
  function openLimit(reason: LimitSheetReason) {
    setLimit({ open: true, reason })
    jokeTrack('limit_shown', tier, { reason, sets_used: usage?.sets_used ?? null, sets_cap: usage?.sets_cap ?? null })
  }

  function closeCeremony() {
    setCeremonyOpen(false)
    jokeTrack('alias_ceremony_done', tier)
    say(alias ? `you're in. ${alias.emoji} ${alias.display_name}` : "you're in.")
    setResumeAt((n) => n + 1)
  }

  // ─────────────────────────── the spill ───────────────────────────

  /** Saying it is the whole gesture: one send, and the cards are being written.
   *  There is no second button between the spill and the deck. */
  async function onSubmit() {
    const raw = text.trim()
    if (raw.length < 12) { say('give me a few more words and i will find the funny in it.'); return }
    if (phase !== 'idle') return
    // A spent day is answered here, on enter, from the counter the server
    // last handed over — the spill never leaves the composer, and no model
    // is asked to write a set the deal would only refuse.
    if (usageIsCurrent(usage)) {
      const blocked = usageBlock(usage)
      if (blocked) { openLimit(blocked); return }
    }
    setBusy(true)
    setRefusal(null)
    setDealFailed(false)
    setDealPartial(false)
    setPhase('reading')
    wantWipScroll.current = true
    let opened: { id: string; tier: JokeTier } | null = null
    try {
      const res = await submit({ data: { raw, ...ctx() } })
      jokeTrack('entry_submitted', tier, { chars: raw.length })
      if (res.crisis) {
        // No cards, no gate, no paywall. Pain is never the thing being sold.
        setSet(null); setCards([]); setCrisis(true)
        jokeTrack('crisis_route_shown', tier)
        return
      }
      if (res.limited) {
        // The server read the counter before anything else ran: no set was
        // opened, nothing was scrubbed or written. The words stay in the box.
        setTier(res.tier)
        setUsage(res.usage)
        openLimit(res.reason)
        return
      }
      setCrisis(false)
      setTier(res.tier)
      setSet({ id: res.set_id, situation: res.clean_text, archetype: res.archetype })
      setCards([])
      setSaved(null)
      setPostedAlias(null)
      opened = { id: res.set_id, tier: res.tier }
      requestAnimationFrame(() => {
        const el = deckRef.current
        if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72), behavior: 'smooth' })
      })
    } catch {
      say('that did not go through. try again?')
    } finally {
      setBusy(false)
      if (!opened) setPhase('idle')
    }
    // Outside the try so a failed deal reports as a failed deal, not as a
    // spill that never landed — the set is open either way.
    if (opened) await dealCards(opened.id)
  }

  // ─────────────────────── the three cards ───────────────────────

  /** Opens the deal, then writes all three. Takes the id rather than reading
   *  `set`, because the deal follows the spill inside one turn, before that
   *  state has committed.
   *
   *  The three writes run concurrently — the same concurrency the bundled deal
   *  had — but each lands in state on its own, which is what lets the WIP band
   *  report a real count instead of a guess. */
  async function dealCards(setId: string) {
    setPhase('dealing')
    setRefusal(null)
    setDealFailed(false)
    setDealPartial(false)
    try {
      const res = await openDeal({ data: { set_id: setId, ...ctx() } })
      if (!res.ok) {
        jokeTrack('deal_refused', res.tier, { reason: res.reason })
        setTier(res.tier)
        if (res.usage) setUsage(res.usage)
        if (res.reason === 'daily_sets' || res.reason === 'daily_cards') {
          // The budget ran out between the spill and the deal (a second tab,
          // a day that rolled over). No deck for a set that will not be
          // written: the limit sheet, same as on enter.
          setSet(null); setCards([])
          openLimit(res.reason)
          return
        }
        setRefusal(refusalCopy(res.reason))
        return
      }
      setTier(res.tier)
      setUsage(res.usage)

      // A member's set that was already written comes back whole; there is
      // nothing left to write and nothing to report progress on.
      if (res.cards) {
        setCards(res.cards)
        jokeTrack('cards_dealt', res.tier, {
          fallbacks: res.cards.filter((c) => c.used_fallback).length,
        })
        if (res.tier !== 'guest') void refresh()
        return
      }

      const settled = await Promise.all(
        res.angles.map((_angle, position) =>
          writeCard({ data: { set_id: setId, position, ...ctx() } })
            .then((r) => {
              // Each card joins the deck the moment it lands, in slot order,
              // so a back turned over early stops holding as soon as its own
              // card exists rather than when the slowest of the three does.
              // Merged by position rather than appended, so a re-deal of the
              // same set replaces a slot instead of doubling it.
              if (r.ok) {
                setCards((prev) =>
                  [...prev.filter((c) => c.position !== r.card.position), r.card]
                    .sort((a, b) => a.position - b.position),
                )
              } else {
                // A card that refuses to be written leaves a hole in the deck.
                // Say which one and why, or the only evidence is three backs
                // that never turn over.
                jokeTrack('card_write_failed', res.tier, { position, reason: r.reason })
              }
              return r
            })
            .catch(() => null),
        ),
      )

      const landed = settled.flatMap((r) => (r && r.ok ? [r.card] : []))
      if (landed.length === 0) {
        setDealFailed(true)
        say('the deck jammed on that one. one more go?')
        return
      }
      // Some of the three made it. The deck keeps them; the rest are released
      // rather than left turning forever.
      if (landed.length < res.angles.length) setDealPartial(true)
      jokeTrack('cards_dealt', res.tier, {
        fallbacks: landed.filter((c) => c.used_fallback).length,
        written: landed.length,
      })
      if (res.tier !== 'guest') void refresh()
    } catch {
      setDealFailed(true)
      say('the deck jammed on that one. one more go?')
    } finally {
      setPhase('idle')
    }
  }

  // ─────────────────────── save · share · post ───────────────────────

  /** Resolve a pending action's card after the gate, when ids finally exist. */
  function at(position: number): JokeCard | null {
    return cards.find((c) => c.position === position) ?? null
  }

  /** A signed-in reader's card, on file. A signed-in deal stores all three,
   *  so this only ever writes for a set dealt as a guest and carried through
   *  the alias gate: the first save, share or post of one of those cards — or
   *  its reveal, whichever comes first — is what writes it. Idempotent: a card
   *  that already has an id is handed straight back. */
  async function ensureKept(target: JokeCard): Promise<JokeCard> {
    if (target.id || !signedIn || !set) return target
    try {
      const res = await keep({
        data: {
          card: {
            set_id: set.id,
            position: target.position,
            angle: target.angle,
            text: target.text,
            used_fallback: target.used_fallback,
            judge_score: target.judge_score,
          },
          ...ctx(),
        },
      })
      if (!res.ok) return target
      const kept = { ...target, ...res.card, saved: true }
      setCards((prev) => prev.map((c) => (c.position === kept.position ? kept : c)))
      jokeTrack('card_kept', res.tier, { slot: kept.angle })
      void refresh()
      return kept
    } catch {
      return target
    }
  }

  /** Rasterise what the server hands back, at the caller's own tier spec. */
  async function renderPngs(query: { card_id?: string; set_id?: string }) {
    const res = await exportCards({ data: { ...query, ...ctx() } })
    // A set comes back whole; only the cards actually turned over travel.
    const wanted = new Set(exportableIds)
    const images = query.set_id && wanted.size > 0
      ? (res.images.filter((i) => wanted.has(i.card_id)).length > 0
          ? res.images.filter((i) => wanted.has(i.card_id))
          : res.images)
      : res.images
    const blobs: NamedBlob[] = await Promise.all(
      images.map(async (image) => ({
        name: image.filename,
        blob: await svgToPng(image.svg, res.width, res.height),
      })),
    )
    return { res, blobs }
  }

  /** Getting the picture onto the device. An anchor download is right on a
   *  desktop and on Android, where it lands in Downloads. Only on iOS does it
   *  miss the camera roll, so there the OS sheet does it — "save image". */
  async function deliver(blobs: NamedBlob[]): Promise<boolean> {
    const files = blobs.map(pngFile)
    if (isIOS()) {
      if (canShareFiles(files)) {
        try {
          await navigator.share({ files })
          return true
        } catch (e) {
          if (isShareAbort(e)) return false
          openBlob(blobs[0]!.blob)
          return true
        }
      }
      openBlob(blobs[0]!.blob)
      return true
    }
    await saveEach(blobs)
    return true
  }

  async function doSave(target: JokeCard | null) {
    if (!target) return
    if (!signedIn) { raiseGate('save', { type: 'save', position: target.position }); return }
    target = await ensureKept(target)
    if (!target.id) { raiseGate('save', { type: 'save', position: target.position }); return }
    setFocus(target)
    setSaving(true)
    try {
      const { res, blobs } = await renderPngs({ card_id: target.id })
      if (blobs.length === 0) throw new Error('no image')
      const done = await deliver([blobs[0]!])
      if (!done) return
      setSaved(`${res.width}×${res.height}`)
      jokeTrack('card_downloaded', res.tier, { slot: target.angle, mark: res.mark })
    } catch {
      say('the image did not render. try once more?')
    } finally {
      setSaving(false)
    }
  }

  /** Save every card of this situation that has been turned over — one PNG
   *  each, never an archive. */
  async function doSaveSet() {
    if (!set) return
    if (!signedIn) { raiseGate('save', { type: 'saveSet' }); return }
    setSaving(true)
    try {
      const { res, blobs } = await renderPngs({ set_id: set.id })
      if (blobs.length === 0) throw new Error('no image')
      if (blobs.length === 1) { await doSave(focus ?? cards[0] ?? null); return }
      const done = await deliver(blobs)
      if (!done) return
      setSaved(`saved ${blobs.length} images · ${res.width}×${res.height}`)
      jokeTrack('save_set_completed', res.tier, { n: blobs.length })
    } catch {
      say('the set did not render. try once more?')
    } finally {
      setSaving(false)
    }
  }

  /** Sharing hands over the picture and nothing else — no caption, no link.
   *  On a phone that is the OS sheet, where X, Instagram, TikTok and Messages
   *  all live; anywhere else the file saves and the destination opens. */
  async function doShare(channel: string, all: boolean) {
    const target = focus
    if (!signedIn) { raiseGate('share', { type: 'share', position: target?.position ?? 0 }); return }
    if (!all && !target?.id) return
    setSaving(true)
    try {
      const { res, blobs } = all && set
        ? await renderPngs({ set_id: set.id })
        : await renderPngs({ card_id: target!.id! })
      if (blobs.length === 0) throw new Error('no image')
      const files = blobs.map(pngFile)
      if (canShareFiles(files)) {
        try {
          await navigator.share({ files })
        } catch (e) {
          if (isShareAbort(e)) return
          throw e
        }
      } else {
        await saveEach(blobs)
        const dest = SHARE_DEST[channel] ?? SHARE_DEST.all
        if (dest) window.open(dest, '_blank')
        say('image saved — attach it there.')
      }
      jokeTrack('share_completed', res.tier, { channel, n_files: files.length })
    } catch (e) {
      jokeTrack('share_failed', tier, { channel, reason: e instanceof Error ? e.message : 'unknown' })
      say('that did not go through. try again?')
    } finally {
      setSaving(false)
    }
  }

  async function openShare(target: JokeCard | null) {
    if (!target) return
    // Never hidden, never disabled, never asterisked — a guest gets the sheet
    // at the moment they reach for it, and keeps the card either way.
    if (!signedIn) { raiseGate('share', { type: 'share', position: target.position }); return }
    target = await ensureKept(target)
    if (!target.id) { raiseGate('share', { type: 'share', position: target.position }); return }
    jokeTrack('card_shared', tier, { slot: target.angle })
    setFocus(target)
    setShareOpen(true)
  }

  async function doPost(target: JokeCard | null) {
    if (!target) return
    if (!signedIn) { raiseGate('post', { type: 'post', position: target.position }); return }
    target = await ensureKept(target)
    if (!target.id) { raiseGate('post', { type: 'post', position: target.position }); return }
    setFocus(target)
    try {
      const res = await postCard({ data: { card_id: target.id, ...ctx() } })
      setPostedAlias(res.alias ?? alias?.display_name ?? 'you')
      jokeTrack('card_posted_to_room', tier, { slot: target.angle })
      void refresh()
    } catch { say('could not open the room. try again?') }
  }

  function startCheckout() {
    setUpgradeOpen(false)
    // Annual is the plan checkout opens on; monthly is a tap away on the page.
    jokeTrack('checkout_started', tier, { lookup_key: 'mirror_annual', guest: !signedIn })
    if (!signedIn) {
      // A guest goes to the paywall itself, not to the alias gate: /subscribe
      // says what a membership buys and takes the sign-in on the way to
      // paying. The deck is written down first so it is waiting here, cards
      // and all, when they come back — signed in, paid, or neither.
      notePending({ type: 'flip' }, '/subscribe?plan=annual')
    }
    void navigate({ to: '/subscribe', search: { plan: 'annual' } as never })
  }

  // ─────────────────────────── derived copy ───────────────────────────

  const days = useMemo(() => new Set(list.map((c) => c.day).filter(Boolean)).size, [list])

  /** The set list, newest first, each situation with the cards under it.
   *  The open set shows only what has actually been turned over — the two
   *  still face-down are not in the list, because as far as the reader is
   *  concerned they have not been written. Older sets come back as stored —
   *  all three for anyone signed in, or just the card a guest turned over
   *  before the alias gate (keepJokeCard). */
  const groups = useMemo<SetGroup[]>(() => {
    const out: SetGroup[] = []
    const seen = new Map<string, SetGroup>()
    const revealed = new Set(deck.revealedSlots.map((s) => s.key))
    for (const c of list) {
      const key = c.set_id ?? c.day ?? 'unknown'
      if (set && c.set_id === set.id && !revealed.has(c.angle as SlotKey)) continue
      let g = seen.get(key)
      if (!g) {
        g = { id: key, situation: c.situation ?? '', cards: [] }
        seen.set(key, g)
        out.push(g)
      }
      g.cards.push(c)
    }
    return out.filter((g) => g.cards.length > 0)
  }, [list, set, deck.revealedSlots])

  const hint = text.trim().length === 0
    ? ''
    : text.trim().length < 30
      ? 'keep going — the specifics are what make it funny.'
      : 'that will do it.'

  return (
    <>
      {/* ══ 1 · hero + the composer ══ */}
      <section id="joke" style={{ position: 'relative', overflow: 'hidden', background: '#fff', padding: 'clamp(92px,12vh,132px) clamp(16px,4vw,28px) clamp(24px,4vh,44px)' }}>
        <div style={{ position: 'absolute', inset: '-40% -20% auto', height: '80vh', background: 'radial-gradient(ellipse at 50% 35%,rgba(127,119,221,.13),transparent 64%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(13px,2.2vh,20px)' }}>
          <Eyebrow style={{ display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: '.24em' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT }} />
            pseudonymous · no advice · different perspectives
          </Eyebrow>
          <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: 'clamp(38px,8.4vw,86px)', lineHeight: 1.02, letterSpacing: '-.05em', textAlign: 'center', margin: 0 }}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              shut<span style={{ color: '#e7548a' }}>ap</span>.
              <span
                aria-hidden
                style={{
                  position: 'absolute', top: '-.16em', right: '.06em',
                  width: '.3em', height: '.3em', borderRadius: '50%',
                  border: '1px solid rgba(231,84,138,.55)',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <span style={{ width: '.055em', height: '.055em', borderRadius: '50%', background: ACCENT }} />
              </span>
            </span>
            <br />
            <span style={{ fontFamily: NEWS, fontStyle: 'italic', fontWeight: 400, letterSpacing: '-.02em', color: '#8e1c4c' }}>joke about it.</span>
          </h1>
          <p style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 'clamp(17px,2vw,22px)', lineHeight: 1.45, color: '#443c42', textAlign: 'center', maxWidth: '34ch', margin: 0 }}>
            life&apos;s a bitch. so make fun of it.
          </p>
          <p style={{ fontFamily: SORA, fontSize: 13.5, color: FAINT, textAlign: 'center', margin: 0 }}>
            type the thing that&apos;s living in your head. shutap writes the set.
          </p>



          <div style={{ width: '100%', position: 'relative', background: '#fff', border: '2px solid rgba(231,84,138,.55)', borderRadius: 26, padding: 'clamp(16px,2.4vw,22px)', boxShadow: '0 28px 60px -38px rgba(35,26,32,.28)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, shift+enter breaks the line. isComposing keeps
                // an IME's own enter (picking a candidate) from sending.
                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                e.preventDefault()
                void onSubmit()
              }}
              enterKeyHint="send"
              placeholder="whatever it is. the comment, the meeting, the text at 11pm, the thing they did again."
              disabled={phase !== 'idle'}
              style={{ width: '100%', resize: 'vertical', minHeight: 116, border: 'none', outline: 'none', background: 'transparent', fontFamily: NEWS, fontStyle: 'italic', fontSize: 17, lineHeight: 1.55, color: '#2b2429', opacity: phase === 'idle' ? 1 : 0.6 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: SORA, fontSize: 12, color: FAINT }}>
                enter sends · shift + enter for a new line
              </span>
              <Button onClick={() => void onSubmit()} disabled={phase !== 'idle'}>
                {phase === 'reading' ? 'reading it…' : phase === 'dealing' ? 'writing your set…' : 'write my set'}
              </Button>
            </div>
          </div>

          {/* footnote row + hover-expand explainer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: SORA, fontSize: 12.5, color: '#8a7a84' }}>
              <span>{signedIn ? 'names scrubbed before anything saves' : 'no account · names scrubbed'}</span>
              <span aria-hidden>·</span>
              <span onMouseEnter={() => setHowOpen(true)} onMouseLeave={() => setHowOpen(false)} style={{ display: 'inline-flex' }}>
                <button
                  type="button"
                  aria-expanded={howOpen}
                  onClick={() => setHowOpen((v) => !v)}
                  onFocus={() => setHowOpen(true)}
                  onBlur={() => setHowOpen(false)}
                  style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: SORA, fontSize: 12.5, color: MUTED, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  how it works
                </button>
              </span>
            </div>
            <div
              onMouseEnter={() => setHowOpen(true)}
              onMouseLeave={() => setHowOpen(false)}
              style={{
                maxWidth: 460, overflow: 'hidden',
                maxHeight: howOpen ? 300 : 0,
                opacity: howOpen ? 1 : 0,
                transform: howOpen ? 'none' : 'translateY(-4px)',
                transition: 'max-height .38s cubic-bezier(.2,.8,.2,1), opacity .28s, transform .28s',
              }}
            >
              <ol style={{ margin: 0, padding: '12px 18px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, background: 'rgba(127,119,221,.06)', border: '1px solid rgba(11,8,15,.07)', borderRadius: 18, fontFamily: NEWS, fontStyle: 'italic', fontSize: 14.5, lineHeight: 1.5, color: '#443c42', textAlign: 'left' }}>
                <li><span style={{ color: '#8e1c4c' }}>i.</span> type what happened — names get scrubbed before anything saves.</li>
                <li><span style={{ color: '#8e1c4c' }}>ii.</span> i write you a set of three, face-down: a take, a clapback, a roast. you turn over one.</li>
                <li><span style={{ color: '#8e1c4c' }}>iii.</span> one situation a day is free. a guest flips one card; an alias flips all three and keeps them. members get three situations a day, and the mirror reading.</li>
                <li style={{ fontFamily: SORA, fontStyle: 'normal', fontSize: 12.5 }}>
                  <a href="/how-it-works" target="_blank" rel="noreferrer" style={{ color: '#8e1c4c', textDecoration: 'underline', textUnderlineOffset: 3 }}>the full explanation →</a>
                </li>
              </ol>
            </div>
          </div>

          {hint ? <div style={{ fontFamily: SORA, fontSize: 12.5, color: '#8a7a84' }}>{hint}</div> : null}

          {set && set.archetype !== 'general' ? (
            <div style={{ fontFamily: SORA, fontSize: 13, color: MUTED }}>
              ✦ reading this as <strong style={{ color: '#8e1c4c', fontWeight: 600 }}>{ARCHETYPE_LABEL[set.archetype] ?? set.archetype}</strong>
            </div>
          ) : null}
        </div>
      </section>

      {/* ══ 2 · backstage — what the companion is doing while you wait ══
          Mounts on the send and stays until the last card lands. It sits above
          the deck rather than inside it because it starts before there is a
          set to put it in: the spill is still being read at that point. */}
      {phase !== 'idle' ? (
        <WipBand
          phase={phase}
          written={written}
          order={deck.order}
          elapsed={elapsed}
          bandRef={(el) => {
            if (!el || !wantWipScroll.current) return
            wantWipScroll.current = false
            requestAnimationFrame(() =>
              window.scrollTo({
                top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 88),
                behavior: 'smooth',
              }),
            )
          }}
        />
      ) : null}

      {/* ══ 3 · crisis — support register only, and nothing else ══ */}
      {crisis ? (
        <section style={{ background: '#fff', padding: '0 clamp(16px,4vw,28px) clamp(40px,7vh,80px)' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', border: '1px solid rgba(137,0,65,.35)', borderRadius: 22, padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 19, color: '#890041' }}>no jokes for this one.</div>
            <p style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 17, lineHeight: 1.6, color: '#383136' }}>
              what you just wrote is heavier than a card can hold, and i&apos;m not going to make a punchline out of it. talking to a person helps more than i can right now.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <a href="#support" style={{ textDecoration: 'none' }}><Button variant="secondary" size="sm">support lines →</Button></a>
              <a href="#spill" style={{ textDecoration: 'none' }}><Button variant="ghost" size="sm">say the long version instead</Button></a>
            </div>
          </div>
        </section>
      ) : null}

      {/* ══ 4 · the offer, then the three cards ══ */}
      {set && !crisis ? (
        <section ref={deckRef} style={{ background: 'linear-gradient(180deg,#fff,rgba(16,12,20,.04))', padding: 'clamp(16px,3vh,36px) clamp(16px,4vw,28px) clamp(36px,6vh,72px)' }}>
          <CardBackStyles />
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* The deck is the response to what they just typed, so there is no
                header between the composer and it. The companion's line while
                the writer works lives in the band above — it used to be here
                too, and saying it twice on one screen read as a stutter. */}

            {/* the set is open, so a jam is retried as a deal, never as a respill */}
            {dealFailed && phase === 'idle' && cards.length === 0 && set ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 15.5, color: MUTED, textAlign: 'center' }}>
                  that one jammed on the way out. your words are still here.
                </div>
                <Button variant="secondary" size="sm" onClick={() => void dealCards(set.id)}>
                  ↻ try the cards again
                </Button>
              </div>
            ) : null}

            {/* ── the deck ──
                Backs go up as soon as the set opens, before a word is written:
                a back is label and subtitle only, so it needs nothing from the
                writer. Turn one over early and it waits on its mid-flip edge.
                Stacked on mobile, three across on desktop — a carousel would
                hide two of the three labelled choices, which is the one thing
                the labelled back exists to prevent. */}
            {!dealFailed ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18, alignItems: 'start' }}>
                {deck.order.map((slot) => {
                  const dealt = bySlot.get(slot.key) ?? null
                  const phaseOf = deck.phaseOf(slot.key)
                  const revealed = phaseOf === 'edge' || phaseOf === 'in'
                  return (
                    <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 340, width: '100%', margin: '0 auto' }}>
                      <FlipCard
                        phase={phaseOf === 'hold' ? 'out' : phaseOf}
                        onTap={() => deck.tap(slot.key)}
                        label={slot.label}
                        hint={revealed && dealt ? dealt.text : slot.subtitle}
                        spent={deck.isSpent(slot.key)}
                        describedBy={PAYWALL_ID}
                      >
                        {revealed && dealt ? (
                          <div aria-live="polite">
                            <CardFace
                              card={dealt}
                              situation={set.situation}
                              mark={tier !== 'paying'}
                              loading={false}
                            />
                          </div>
                        ) : (
                          <CardBack
                            label={slot.label}
                            subtitle={slot.subtitle}
                            situation={set.situation}
                            holding={phaseOf === 'hold'}
                          />
                        )}
                      </FlipCard>

                      {revealed && dealt ? (
                        <CardActions
                          label={slot.label}
                          canPost={signedIn}
                          onPost={() => void doPost(dealt)}
                          onShare={() => void openShare(dealt)}
                          onDownload={() => void doSave(dealt)}
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {/* ── the sign-up wall, in the one place ──
                A guest turns over one card; the other two stay face-down,
                labelled, untouched — and this block under them is the only
                thing that says why. A tap on either of them points here. It
                asks for an alias, not money: anyone with a name turns over
                all three, so there is no flip paywall for a free alias. */}
            {deck.revealedSlots.length > 0 && tier === 'guest' ? (
              <PaywallBlock
                pulsing={deck.pulsing}
                line={`you flipped one. the other two are written and waiting — ${ALIAS_OFFER.line}`}
                cta={ALIAS_OFFER.cta}
                onCta={() => raiseGate('flip', { type: 'flip' })}
              />
            ) : null}

            {deck.revealedSlots.length > 0 ? (
              <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 14, color: FAINT }}>
                {tier === 'guest'
                  ? 'reading is free, forever. an alias is a fake name — 30 seconds, no password.'
                  : tier === 'paying'
                    ? `clean · ${spec.width}×${spec.height} · no mark on any of them.`
                    : `saves at ${spec.width}×${spec.height}, with the little shutap mark.`}
              </div>
            ) : null}

            {/* the moment after the save — a win first, an offer second */}
            {saved ? (
                  <div style={{ background: '#fff', border: '1px solid rgba(11,8,15,.08)', borderRadius: 22, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                    <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 14, color: '#1D9E75' }}>
                      ✓ saved{tier === 'paying' ? ' clean' : ''} · {saved}
                    </div>
                    {tier === 'paying' ? (
                      <>
                        <CompanionLine>
                          no mark, nothing of mine on it. post the roast in your room too? the owl who&apos;s been sitting in will lose it.
                        </CompanionLine>
                        {postedAlias ? (
                          <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 15, color: MUTED }}>
                            ◎ it&apos;s a room now — {postedAlias} is on it. no one owes you a reply.
                          </div>
                        ) : (
                          <>
                            <Button variant="secondary" onClick={() => void doPost(focus)} full>post it in my room</Button>
                            <Button variant="ghost" size="sm" onClick={() => setSaved(null)} full>done</Button>
                            <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, color: FAINT, textAlign: 'center' }}>
                              keeping it private is the default. it&apos;s just yours.
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <CompanionLine>
                          it&apos;s yours. members get {MEMBER_OFFER.line}
                        </CompanionLine>
                        <Button onClick={() => { jokeTrack('upgrade_shown', tier, { after: 'save' }); setUpgradeOpen(true) }} full>
                          {MEMBER_OFFER.cta}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSaved(null)} full>this one&apos;s fine</Button>
                      </>
                    )}
              </div>
            ) : null}

            {refusal ? (
              <div style={{ background: '#fff', border: '1px dashed rgba(142,28,76,.32)', borderRadius: 18, padding: '16px 20px' }}>
                <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 15, color: INK }}>{refusal}</div>
                <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 14.5, color: MUTED, marginTop: 4 }}>
                  the cards you already have stay right here, and stay free.
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ══ 5 · the set list, and the one place the plan is mentioned unprompted ══ */}
      {signedIn && list.length > 0 ? (
        <section style={{ background: 'rgba(16,12,20,.04)', padding: '0 clamp(16px,4vw,28px) clamp(36px,6vh,72px)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', paddingTop: 'clamp(24px,4vh,48px)' }}>
              <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 'clamp(20px,2.6vw,26px)', letterSpacing: '-.03em' }}>your set list</span>
              <span style={{ fontFamily: SORA, fontSize: 13, color: '#8a7a84' }}>
                🃏 {list.length} kept · {days <= 1 ? 'day one' : `${days} days of it`}
              </span>
            </div>
            {/* The same card and the same two actions the deck offers, so a
                card you kept reads identically here and in the profile. */}
            <SetList
              groups={groups}
              mark={tier !== 'paying'}
              onShare={(card) => void openShare(card)}
              onDownload={(card) => void doSave(card)}
            />

            <div style={{ marginTop: 6, background: 'radial-gradient(120% 120% at 10% 0%,rgba(127,119,221,.06),#fff 65%)', border: '1px solid rgba(11,8,15,.08)', borderRadius: 22, padding: 'clamp(20px,3vw,30px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
              <div style={{ maxWidth: '52ch' }}>
                <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 'clamp(20px,2.6vw,26px)', letterSpacing: '-.03em', color: INK }}>
                  {tier === 'paying' ? 'the mirror is reading all of it.' : 'there is a pattern across these you cannot see yet.'}
                </div>
                <p style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 17, lineHeight: 1.55, color: '#4a3040', marginTop: 6 }}>
                  {tier === 'paying'
                    ? `cross-read, districts, depth, trend and signal mix — now with 🃏 joke in the mix, across ${list.length} ${list.length === 1 ? 'card' : 'cards'}.`
                    : `members get three situations a day, every set kept clean, and the mirror reading your whole set list at once — which behaviour keeps showing up, and how the jokes changed as you did.`}
                </p>
              </div>
              <Button
                onClick={() => (tier === 'paying'
                  ? document.getElementById('mirror')?.scrollIntoView({ behavior: 'smooth' })
                  : (jokeTrack('upgrade_shown', tier, { after: 'set_list' }), setUpgradeOpen(true)))}
              >
                {tier === 'paying' ? `${MEMBER_OFFER.cta} ✦` : MEMBER_OFFER.cta}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      

      <AliasCeremony
        open={ceremonyOpen}
        alias={alias}
        onAliasChange={setAlias}
        onDone={closeCeremony}
      />

      <CardShareSheet
        open={shareOpen}
        card={focus}
        tier={tier}
        saving={saving}
        flipped={focusInSet ? exportableIds.length : 1}
        onClose={() => setShareOpen(false)}
        onShare={(channel, all) => void doShare(channel, all)}
        onSave={() => void doSave(focus)}
        onSaveAll={() => void doSaveSet()}
      />

      <LimitSheet
        open={limit.open}
        tier={tier}
        reason={limit.reason}
        usage={usage}
        onClose={() => setLimit((l) => ({ ...l, open: false }))}
        onAlias={() => {
          // The alias is the whole ask here: the other two of today's set
          // unlock behind it, and nothing is sold on the way back.
          setLimit((l) => ({ ...l, open: false }))
          raiseGate('limit', { type: 'flip' })
        }}
        onMore={() => {
          // Straight to the paywall — what they ran out of is jokes, and the
          // sheet has already said what a membership buys. A guest signs in
          // on the paywall itself, not at the alias gate.
          setLimit((l) => ({ ...l, open: false }))
          jokeTrack('checkout_from_limit', tier)
          startCheckout()
        }}
      />

      <UpgradeSheet
        open={upgradeOpen}
        price={PRICE}
        tier={tier}
        onClose={() => setUpgradeOpen(false)}
        onCheckout={startCheckout}
      />

      {toast ? (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 99, background: '#1b0f16', color: '#fff', fontFamily: SORA, fontSize: 13, padding: '11px 18px', borderRadius: 999, maxWidth: 'calc(100vw - 32px)', textAlign: 'center' }}>
          {toast}
        </div>
      ) : null}
    </>
  )
}

/** Refusals are cost guards, not paywalls: they never point at checkout.
 *  The daily budget is not one of these any more — it gets the limit sheet. */
function refusalCopy(reason: 'rate_limited' | 'not_found'): string {
  if (reason === 'rate_limited') return "easy — you've been flipping fast. back in a minute."
  return 'i lost track of that set. say it again and i will start over.'
}
