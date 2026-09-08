// "send it somewhere" — the share sheet.
//
// What travels is the PICTURE. No caption, no link, no text of any kind: the
// card is the joke, and it lands in the other person's thread as an image.
//
// No channel is ever gated: the tier decides what the FILE looks like, never
// where it is allowed to go.
import { ShareChannels, type ShareChannelKey } from '@/components/ShareChannels'
import type { JokeCard, JokeTier } from '@/lib/jokes/deck'
import { exportSpec } from '@/lib/jokes/deck'
import { Button, Sheet, SORA, INK, MUTED, FAINT } from './ui'

/** Four places a card goes, in this order. Same four at every tier. */
const CHANNELS: ShareChannelKey[] = ['x', 'instagram', 'tiktok', 'sms']
const LABELS: Partial<Record<ShareChannelKey, string>> = { sms: 'text' }

export function CardShareSheet({
  open,
  card,
  tier,
  saving,
  flipped,
  onClose,
  onShare,
  onSave,
  onSaveAll,
}: {
  open: boolean
  card: JokeCard | null
  tier: JokeTier
  saving: boolean
  /** how many cards of this situation are turned over and exportable */
  flipped: number
  onClose: () => void
  onShare: (channel: string, all: boolean) => void
  onSave: () => void
  onSaveAll: () => void
}) {
  if (!card) return null
  const spec = exportSpec(tier)
  const many = flipped > 1

  return (
    <Sheet open={open} onClose={onClose} width={520}>
      <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 20, letterSpacing: '-.03em', color: INK }}>
        send it somewhere
      </div>

      <ShareChannels
        channels={CHANNELS}
        labels={LABELS}
        onPick={(channel) => onShare(channel, false)}
        surface="light"
        style={{ padding: '2px 0 4px' }}
      />

      <div style={{ fontFamily: SORA, fontSize: 12.5, color: FAINT }}>
        the picture goes over, nothing else.
      </div>

      {many ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" disabled={saving} onClick={() => onShare('all', true)}>
            share all {flipped}
          </Button>
          <Button variant="secondary" size="sm" disabled={saving} onClick={onSaveAll}>
            save all {flipped}
          </Button>
        </div>
      ) : null}

      <Button onClick={onSave} disabled={saving} full>
        {saving ? 'rendering…' : '↓ save image'}
      </Button>
      <div style={{ fontFamily: SORA, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>
        {tier === 'paying' ? 'no mark · print-size · no watermark on any export' : spec.note}
      </div>
    </Sheet>
  )
}
