/* The backstage band — what the companion is doing while you wait.
 *
 * It mounts the instant "write my set" is pressed and fills the gap that used
 * to be silent: the spill goes off to be scrubbed, read for crisis and stored,
 * and only then are three cards written. That is a long time to show nothing.
 *
 * Two rules make it a band rather than a spinner:
 *
 *   · every number on it is true. The stage label, the meter and the ✓ on a
 *     mini card are read off the cards that have actually landed — which is
 *     why the deal is written one slot at a time (see writeJokeCard). If the
 *     writer is slow, the band says so; it never fakes a march to 100%.
 *   · it narrates, it does not apologise. The copy escalates with the wait —
 *     past 22s it admits it is taking a while, past 42s it admits that is
 *     embarrassing — because a wait someone is being talked through is a
 *     different wait from a wait they are being ignored during.
 *
 * The deck below stays tappable throughout: a back can be turned over before
 * its card is written and it waits on its edge (see useDeck). This band is the
 * readout, never the gate. */
import { useMemo } from 'react'
import { SLOTS, type SlotKey } from '@/lib/jokes/deck'
import {
  CARD_EDGE,
  CARD_GROUND,
  Eyes,
  FAINT,
  MUTED,
  NEWS,
  PROSE,
  SORA,
  lift,
} from './ui'

/* ── the companion's copy, rotating every 3s ──
   Four pools, chosen by what is actually happening and how long it has taken.
   Kept here rather than in deck.ts: it is voice, not vocabulary, and nothing
   else on the site says any of it. */

const READING = [
  'reading it. …okay, reading it again, because wow.',
  "counting how many times she said 'just'. it's a lot.",
  'underlining the part that made you type all this at 11pm.',
  "checking this is the kind of thing we're allowed to laugh at. it is.",
]

const DEALING = [
  'shuffling. i do this part with my whole chest.',
  'wrote a punchline, deleted it — it was mean about you, not about her.',
  "sharpening the clapback until it's rude but legally fine.",
  'the roast is currently being roasted.',
  "i had one about the sigh. i'm keeping that one.",
  'double-checking no card accidentally gives advice. gross.',
]

const LATE = [
  'still here. good jokes take longer than bad ones, apparently.',
  'four versions written, two of them turned into therapy. deleted.',
  'taking a minute because i refuse to hand you a mid card.',
]

const VERY_LATE = [
  'this is embarrassing for me, not for you. nearly there.',
  "i'm not stalling, i'm editing. mostly editing.",
  'one line is fighting me. i will win.',
]

/** The aside in the footer, rotating every 5s — the standing promise, not
 *  progress. Slower than the line above it so the two never move together. */
const FOOT = [
  'no verdicts. just angles.',
  "i don't do mid.",
  'mean about the behaviour, warm about you.',
  'you can turn one over the second it lands.',
]

function clock(seconds: number): string {
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return `${mm}:${ss < 10 ? '0' : ''}${ss}`
}

export function WipBand({
  /** 'reading' while the spill is scrubbed and classified, 'dealing' while
   *  the three cards are written. */
  phase,
  /** Which slots have their text. The meter and every ✓ are read off this. */
  written,
  /** The deck's shuffled order, so the mini cards sit where the real ones do. */
  order,
  /** Seconds since the send. Ticks in JokeSurface, which owns the clock. */
  elapsed,
  bandRef,
}: {
  phase: 'reading' | 'dealing'
  written: ReadonlySet<string>
  order: { key: SlotKey; label: string }[]
  elapsed: number
  bandRef?: (el: HTMLDivElement | null) => void
}) {
  const writtenN = useMemo(
    () => SLOTS.filter((s) => written.has(s.key)).length,
    [written],
  )

  /* The one still being waited on. With the three writes running in parallel
     this is the first unwritten slot rather than a strict queue position —
     honest about how many are done, approximate about which is in the air. */
  const activeKey = phase === 'dealing'
    ? (SLOTS.find((s) => !written.has(s.key))?.key ?? null)
    : null

  const pool = phase === 'reading'
    ? READING
    : elapsed > 42
      ? VERY_LATE
      : elapsed > 22
        ? LATE
        : DEALING

  const accentOf = (key: SlotKey) => SLOTS.find((s) => s.key === key)?.accent ?? '#e7548a'

  return (
    <section style={{ background: '#fff', padding: '0 clamp(16px,4vw,28px) clamp(28px,5vh,56px)' }}>
      <WipBandStyles />
      <div
        ref={bandRef}
        style={{
          maxWidth: 620, margin: '0 auto', position: 'relative', overflow: 'hidden',
          background: '#fff', border: '1px solid rgba(11,8,15,.08)', borderRadius: 22,
          padding: 'clamp(18px,2.6vw,24px)',
          boxShadow: '0 26px 60px -40px rgba(80,10,45,.45)',
          display: 'flex', flexDirection: 'column', gap: 15,
          animation: 'shutapWipRise .4s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div
          className="shutap-wip-anim"
          style={{
            position: 'absolute', width: '130%', height: '80%', left: '-15%', top: '-34%',
            background: 'radial-gradient(circle,rgba(231,84,138,.18),transparent 64%)',
            filter: 'blur(8px)', pointerEvents: 'none',
            animation: 'shutapWipBreathe 6.5s ease-in-out infinite',
          }}
        />

        {/* the companion, saying what it is doing */}
        <div style={{ position: 'relative', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <span
            className="shutap-wip-anim"
            style={{
              paddingTop: 3, display: 'inline-flex', flex: 'none',
              animation: 'shutapWipBreathe 3.6s ease-in-out infinite',
            }}
          >
            <Eyes size={26} />
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span
              aria-live="polite"
              style={{
                fontFamily: SORA, fontWeight: 800, fontSize: 11, letterSpacing: '.24em',
                textTransform: 'uppercase', color: FAINT,
              }}
            >
              {phase === 'reading'
                ? 'reading the situation'
                : `writing card ${Math.min(SLOTS.length, writtenN + 1)} of ${SLOTS.length}`}
            </span>
            {/* A fixed three-line well, so a shorter line does not make the
                whole band jump every three seconds. */}
            <div
              style={{
                fontFamily: NEWS, fontStyle: 'italic', fontSize: 17, lineHeight: 1.5,
                color: PROSE, textWrap: 'pretty', minHeight: '3em',
              }}
            >
              {pool[Math.floor(elapsed / 3) % pool.length]}
            </div>
          </div>
        </div>

        {/* Reading has no card count to report, so it holds a token 8% rather
            than pretending to measure something. */}
        <div
          style={{
            position: 'relative', height: 5, borderRadius: 999,
            background: 'rgba(11,8,15,.07)', overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg,#e7548a,#c1216b)',
              width: phase === 'reading'
                ? '8%'
                : `${Math.max(14, Math.round((writtenN / SLOTS.length) * 100))}%`,
              transition: 'width .7s cubic-bezier(.2,.8,.2,1)',
            }}
          />
        </div>

        {/* three cards, riffling — each pops to ✓ when its own card lands */}
        <div
          style={{
            position: 'relative', display: 'grid',
            gridTemplateColumns: `repeat(${SLOTS.length},minmax(0,1fr))`, gap: 12,
          }}
        >
          {order.map((slot, i) => {
            const done = written.has(slot.key)
            const active = slot.key === activeKey
            return (
              <div
                key={slot.key}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 8, textAlign: 'center', minWidth: 0,
                }}
              >
                <div
                  /* Only while it riffles. A landed card drops the class so
                     its ✓ still pops under reduced motion — that pop is the
                     card reporting itself written, not decoration. */
                  className={done ? undefined : 'shutap-wip-anim'}
                  style={{
                    position: 'relative', width: '100%', maxWidth: 62, aspectRatio: '9/16',
                    borderRadius: 9, overflow: 'hidden', background: CARD_GROUND,
                    border: done ? '.5px solid rgba(231,84,138,.85)' : CARD_EDGE,
                    boxShadow: '0 14px 26px -16px rgba(80,10,45,.7)',
                    display: 'grid', placeItems: 'center',
                    animation: done
                      ? 'shutapWipPop .5s cubic-bezier(.2,.8,.2,1) both'
                      : `shutapWipRiffle 2.4s ease-in-out infinite ${(i * 0.22).toFixed(2)}s`,
                  }}
                >
                  <div
                    className={done ? undefined : 'shutap-wip-anim'}
                    style={{
                      position: 'absolute', inset: 0,
                      backgroundImage:
                        'linear-gradient(105deg,transparent 32%,rgba(255,255,255,.24),transparent 68%)',
                      backgroundSize: '240% 100%',
                      animation: done
                        ? 'none'
                        : `shutapWipSweep 1.9s linear infinite ${(i * 0.3).toFixed(2)}s`,
                    }}
                  />
                  <span
                    style={{
                      position: 'relative', fontFamily: SORA, fontWeight: 800, fontSize: 14,
                      letterSpacing: '.08em',
                      color: done ? lift(accentOf(slot.key), 0.34) : 'rgba(247,232,240,.5)',
                    }}
                  >
                    {done ? '✓' : active ? '···' : ''}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: SORA, fontWeight: 800, fontSize: 10.5, letterSpacing: '.14em',
                    textTransform: 'uppercase', color: MUTED,
                  }}
                >
                  {slot.label}
                </span>
                <span
                  style={{
                    fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.35,
                    color: done ? '#8e1c4c' : active ? MUTED : FAINT,
                  }}
                >
                  {done ? 'written' : active ? 'writing…' : phase === 'reading' ? 'shuffling' : 'face down'}
                </span>
              </div>
            )
          })}
        </div>

        <div
          style={{
            position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            justifyContent: 'space-between', gap: 8, paddingTop: 12,
            borderTop: '1px solid rgba(11,8,15,.08)',
          }}
        >
          <span style={{ fontFamily: SORA, fontSize: 12, color: FAINT }}>
            {clock(elapsed)} · {writtenN} of {SLOTS.length} written
          </span>
          <span style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, color: '#8a7a84' }}>
            {FOOT[Math.floor(elapsed / 5) % FOOT.length]}
          </span>
        </div>
      </div>
    </section>
  )
}

/* Namespaced rather than reusing the global `breathe`: that name is defined
   three times across global.css, home.css and landing.native.css with
   different curves, so which one a band on the home page gets depends on
   stylesheet order. These are the band's own, and cannot be won by a cascade.
   Reduced motion keeps the ✓ pop — it is information, not decoration — and
   stops everything that only loops. */
function WipBandStyles() {
  return (
    <style>{`
      @keyframes shutapWipBreathe{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
      @keyframes shutapWipRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes shutapWipRiffle{0%,100%{transform:translateY(0) rotate(-1.6deg)}50%{transform:translateY(-6px) rotate(1.6deg)}}
      @keyframes shutapWipSweep{from{background-position:220% 0}to{background-position:-40% 0}}
      @keyframes shutapWipPop{0%{transform:scale(.86)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
      @media (prefers-reduced-motion: reduce){
        .shutap-wip-anim{animation:none!important;opacity:.8}
      }
    `}</style>
  )
}
