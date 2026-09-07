// The alias ceremony — the second half of the gate, and its whole reward.
//
// It runs once, right after the magic link lands, and it ends by putting the
// reader back on the card they were holding with save and share live. It is
// never a dead end and never a form: a creature name, a shuffle if they want a
// different one, two ticks, and back to the deck.
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { rerollMyAlias } from '@/lib/alias.functions'
import { recordLegalAcceptance } from '@/lib/legal.functions'
import { Button, Sheet, Eyes, SORA, NEWS, INK, MUTED, FAINT, ACCENT } from './ui'

export type CeremonyAlias = { display_name: string; emoji: string }

export function AliasCeremony({
  open,
  alias,
  onDone,
  onAliasChange,
}: {
  open: boolean
  alias: CeremonyAlias | null
  onDone: () => void
  onAliasChange: (a: CeremonyAlias) => void
}) {
  const reroll = useServerFn(rerollMyAlias)
  const accept = useServerFn(recordLegalAcceptance)
  const [ok18, setOk18] = useState(false)
  const [okGuidelines, setOkGuidelines] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [busy, setBusy] = useState(false)

  async function shuffle() {
    setSpinning(true)
    try {
      const next = (await reroll()) as { display_name?: string; emoji?: string } | null
      if (next?.display_name) {
        onAliasChange({ display_name: next.display_name, emoji: next.emoji ?? '🃏' })
      }
    } catch { /* keep the one they have */ } finally {
      setSpinning(false)
    }
  }

  async function confirm() {
    setBusy(true)
    try {
      await accept({ data: {} }).catch(() => {})
    } finally {
      setBusy(false)
      onDone()
    }
  }

  const ready = ok18 && okGuidelines

  return (
    <Sheet open={open} onClose={onDone}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <Eyes size={44} />
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 12, letterSpacing: '.22em', textTransform: 'uppercase', color: FAINT }}>
          your alias
        </div>
      </div>

      <div
        style={{
          background: 'rgba(231,84,138,.06)',
          border: '1px solid rgba(11,8,15,.07)',
          borderRadius: 20,
          padding: '24px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          key={alias?.display_name ?? 'none'}
          style={{ fontSize: 46, animation: 'shutapAliasIn .35s ease' }}
        >
          {alias?.emoji ?? '🃏'}
        </div>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 22, letterSpacing: '-.03em', color: INK }}>
          {alias?.display_name ?? 'minting…'}
        </div>
        <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 15, color: MUTED }}>
          yours from now on. nobody can trace it back.
        </div>
        <button
          type="button"
          onClick={() => void shuffle()}
          disabled={spinning || !alias}
          style={{
            alignSelf: 'center',
            marginTop: 4,
            background: 'none',
            border: 'none',
            cursor: spinning ? 'default' : 'pointer',
            fontFamily: SORA,
            fontWeight: 700,
            fontSize: 13,
            color: ACCENT,
            padding: 6,
          }}
        >
          {spinning ? '↻ shuffling…' : '↻ shuffle'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Tick checked={ok18} onChange={setOk18}>i&apos;m 18 or older</Tick>
        <Tick checked={okGuidelines} onChange={setOkGuidelines}>
          i&apos;ve read the guidelines — no verdicts, no real names
        </Tick>
      </div>

      <Button onClick={() => void confirm()} disabled={!ready || busy} full>
        {busy ? 'one moment…' : 'this is me — flip all three'}
      </Button>
      <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, color: FAINT, textAlign: 'center' }}>
        lands you back on your cards, save and share live.
      </div>
      <style>{`@keyframes shutapAliasIn{from{transform:scale(.86);opacity:0}to{transform:none;opacity:1}}`}</style>
    </Sheet>
  )
}

function Tick({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: SORA, fontSize: 13.5, color: MUTED, lineHeight: 1.5, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 18, height: 18, accentColor: '#8e1c4c', flex: 'none' }}
      />
      <span>{children}</span>
    </label>
  )
}
