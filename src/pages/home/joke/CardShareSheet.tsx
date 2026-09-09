// "send it somewhere" — the share sheet.
//
// What travels is the PICTURE with a caption: the card as an image, the line
// under it, and a way back to shutap. On a phone the OS sheet carries all
// three to X, Instagram, TikTok or Messages in one move; on a desktop the
// picture is saved, the caption goes on the clipboard, and the destination
// opens for the paste.
//
// The picture is rendered the moment the sheet opens, not when a pill is
// tapped: the OS sheet and a fresh tab both refuse to open once an await has
// passed, so a pill has to be able to hand the file over synchronously.
//
// No channel is ever gated: the tier decides what the FILE looks like, never
// where it is allowed to go.
import { ShareChannels, type ShareChannelKey } from '@/components/ShareChannels'
import type { JokeCard, JokeTier } from '@/lib/jokes/deck'
import { exportSpec } from '@/lib/jokes/deck'
import { Button, Sheet, SORA, NEWS, INK, MUTED, FAINT } from './ui'

/** Four places a card goes, in this order. Same four at every tier. */
const CHANNELS: ShareChannelKey[] = ['x', 'instagram', 'tiktok', 'sms']
const LABELS: Partial<Record<ShareChannelKey, string>> = { sms: 'text' }

export function CardShareSheet({
  open,
  card,
  tier,
  saving,
  ready,
  flipped,
  caption,
  onCaption,
  onClose,
  onShare,
  onSave,
  onSaveAll,
}: {
  open: boolean
  card: JokeCard | null
  tier: JokeTier
  saving: boolean
  /** the picture(s) are rendered and a pill can hand them over right now */
  ready: boolean
  /** how many cards of this situation are turned over and exportable */
  flipped: number
  /** what travels with the picture — prefilled, and theirs to edit */
  caption: string
  onCaption: (next: string) => void
  onClose: () => void
  onShare: (channel: string, all: boolean) => void
  onSave: () => void
  onSaveAll: () => void
}) {
  if (!card) return null
  const spec = exportSpec(tier)
  const many = flipped > 1
  const busy = saving || !ready

  return (
    <Sheet open={open} onClose={onClose} width={520}>
      <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 20, letterSpacing: '-.03em', color: INK }}>
        send it somewhere
      </div>

      {/* Dimmed rather than removed while the picture renders, so the row
          never jumps and the tap that lands on it is a real tap. */}
      <div style={{ opacity: ready ? 1 : 0.5, pointerEvents: ready ? 'auto' : 'none', transition: 'opacity .2s' }}>
        <ShareChannels
          channels={CHANNELS}
          labels={LABELS}
          onPick={(channel) => onShare(channel, false)}
          surface="light"
          style={{ padding: '2px 0 4px' }}
        />
      </div>

      <div style={{ fontFamily: SORA, fontSize: 12.5, color: FAINT }}>
        {ready
          ? 'the picture goes over with the caption below — and a way back here.'
          : 'getting the picture ready…'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: FAINT }}>
          caption · yours to edit
        </div>
        <textarea
          rows={3}
          value={caption}
          onChange={(e) => onCaption(e.target.value)}
          style={{
            width: '100%', resize: 'vertical', borderRadius: 14, padding: '12px 14px',
            border: '1px solid rgba(11,8,15,.14)', background: '#fff', color: INK,
            fontFamily: NEWS, fontStyle: 'italic', fontSize: 16, lineHeight: 1.45, outline: 'none',
          }}
        />
      </div>

      {many ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => onShare('all', true)}>
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
        {tier === 'paying' ? 'no mark on any export' : spec.note}
      </div>
    </Sheet>
  )
}
