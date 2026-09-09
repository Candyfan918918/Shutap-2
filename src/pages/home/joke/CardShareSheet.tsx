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
  preview,
  mobile,
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
  /** the rendered card, so what is about to travel is in view */
  preview: string | null
  /** a phone hands the picture to the app itself; a computer cannot */
  mobile: boolean
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
      {/* The picture itself, beside the title: what is about to travel is the
          first thing in the sheet, not a guess. 9:16, at thumbnail width. */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div
          aria-hidden={!preview}
          style={{
            flex: 'none', width: 96, aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden',
            background: '#100c14', border: '1px solid rgba(11,8,15,.1)',
            boxShadow: '0 12px 28px -16px rgba(11,8,15,.55)',
          }}
        >
          {preview ? (
            <img src={preview} alt={`the card: ${card.text}`} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 20, letterSpacing: '-.03em', color: INK }}>
            send it somewhere
          </div>
          <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 14.5, lineHeight: 1.45, color: MUTED }}>
            {!ready
              ? 'getting the picture ready…'
              : mobile
                ? 'one tap puts the picture and the caption straight into the app.'
                : 'on a computer, X, Instagram and TikTok cannot take a picture from a website — so the picture is saved and the caption copied for you to attach. on your phone it goes straight in.'}
          </div>
        </div>
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
        the picture, the caption below, and a way back here.
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
