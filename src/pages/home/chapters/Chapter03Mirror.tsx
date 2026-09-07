// Chapter 03 — "THE MIRROR · DEMO" (labeled). Cycles through 3 static demo
// patterns from mirrorCast.ts. Contains ZERO links — the whole card is inert
// (the lock banner CTA below the card is the only link out).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@/compat/router'
import { useOnScreen, usePrefersReducedMotion } from '../hero/Mascot'
import { useReactiveCard, useMagnetic } from '@/components/motion'
import { DEMO_DISTRICTS, DEMO_MIRROR_CAST, type DemoPattern } from '../mirrorCast'

const SORA = "'Sora',system-ui,sans-serif"
const NEWS = "'Newsreader',Georgia,serif"

const CYCLE_MS = 5200

export function Chapter03Mirror() {
  const ref = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(ref, 0.15)
  const reduce = usePrefersReducedMotion()
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const magneticCta = useMagnetic<HTMLButtonElement>()
  useEffect(() => {
    if (reduce || !onScreen) return
    const iv = window.setInterval(() => setIdx((i) => (i + 1) % DEMO_MIRROR_CAST.length), CYCLE_MS)
    return () => window.clearInterval(iv)
  }, [reduce, onScreen])

  const p = DEMO_MIRROR_CAST[idx]

  return (
    <section
      ref={ref}
      className="home-chapter"
      style={{ position: 'relative', background: '#100c14', minHeight: '96vh', display: 'flex', alignItems: 'center', overflow: 'hidden', color: '#fdfbf9' }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 'auto 0 -20% 0', height: '60vh', background: 'radial-gradient(ellipse at 50% 100%, rgba(231,84,138,.12), transparent 65%)', pointerEvents: 'none' }} />
      <div className="home-grid-2" style={{ maxWidth: 1280, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 'clamp(34px,6vw,90px)', padding: 'clamp(90px,12vh,150px) clamp(20px,4vw,32px)', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 12, letterSpacing: '.24em', textTransform: 'uppercase', color: '#c1a02b', marginBottom: 22 }}>
            chapter 03 — the mirror ✦
          </div>
          <h2 style={{ fontFamily: SORA, fontWeight: 800, fontSize: 'clamp(30px,3.8vw,54px)', lineHeight: 1.08, letterSpacing: '-.04em', margin: '0 0 24px', color: '#fdfbf9' }}>
            your patterns, <em style={{ fontFamily: NEWS, fontStyle: 'italic', color: '#f7b8d4', fontWeight: 400 }}>read as cards.</em>
          </h2>
          <p style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 'clamp(16px,1.4vw,20px)', lineHeight: 1.6, color: '#645b61', maxWidth: '44ch', margin: '0 0 32px' }}>
            the mirror reads across your rooms and deals what keeps coming back — how deep it runs, which way it's moving, and how far you've already come.
          </p>
          <button
            type="button"
            ref={magneticCta}
            onClick={() => navigate('/subscribe')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: '#c1a02b',
              color: '#100c14',
              border: 0,
              padding: '16px 30px',
              borderRadius: 999,
              fontFamily: SORA,
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            open the mirror reading ✦
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <MirrorDemoCard pattern={p} idx={idx} />
          <LockBanner onUnlock={() => navigate('/subscribe')} />
        </div>
      </div>
    </section>
  )
}

function MirrorDemoCard({ pattern, idx }: { pattern: DemoPattern; idx: number }) {
  const reduce = usePrefersReducedMotion()
  const [depthProgress, setDepthProgress] = useState(reduce ? 1 : 0)
  const [signalCount, setSignalCount] = useState(reduce ? pattern.signals : 0)
  const [trendProgress, setTrendProgress] = useState(reduce ? 1 : 0)
  const card = useReactiveCard({ glow: 'rgba(233,192,106,.6)' })

  useEffect(() => {
    if (reduce) return
    setDepthProgress(0); setSignalCount(0); setTrendProgress(0)
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = now - start
      const dp = Math.min(1, t / 1300)
      const sp = Math.min(1, t / 1200)
      const tp = Math.min(1, t / 1500)
      setDepthProgress(1 - Math.pow(1 - dp, 3))
      setSignalCount(Math.round(sp * pattern.signals))
      setTrendProgress(1 - Math.pow(1 - tp, 3))
      if (t < 1600) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [idx, pattern, reduce])

  const depthOfMax = pattern.depth / 5
  const size = 60
  const r = 24
  const c = 2 * Math.PI * r
  const dash = c * depthOfMax * depthProgress

  // Build sparkline path for weekly array
  const w = 260, h = 40
  const maxW = Math.max(...pattern.weekly)
  const points = pattern.weekly.map((v, i) => {
    const x = (i / (pattern.weekly.length - 1)) * w
    const y = h - (v / maxW) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const pathLen = 400 // approx; used for dash offset

  return (
    <div
      ref={card.ref}
      style={{
        display: 'block',
        width: 'min(380px,92vw)',
        background: 'radial-gradient(125% 80% at 50% 0%, rgba(127,119,221,.18), #100c14 58%, #100c14)',
        border: '1px solid rgba(233,192,106,.85)',
        borderRadius: 22,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 40px 90px -34px rgba(0,0,0,.85), 0 0 0 1px rgba(233,192,106,.33), 0 0 38px -6px rgba(233,192,106,.4)',
      }}
    >
      {/* top glass sheen */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: 'linear-gradient(180deg, rgba(255,255,255,.13), rgba(255,255,255,.03) 18%, transparent 38%)', pointerEvents: 'none', zIndex: 2 }} />
      {/* thin multicolor top line */}
      <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: 1.5, background: 'linear-gradient(90deg, transparent, #7F77DD, #a52a5f, #5B8A5E, transparent)', opacity: .4, pointerEvents: 'none', zIndex: 3 }} />
      {/* inner hairline inset border */}
      <div style={{ position: 'absolute', inset: 6, border: '.5px solid rgba(233,192,106,.5)', borderRadius: 16, pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 3 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#c1a02b' }}>
          ✦ THE MIRROR — FULL READ
        </span>
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {DEMO_MIRROR_CAST.map((_, i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === idx % DEMO_MIRROR_CAST.length ? '#c1a02b' : 'rgba(255,255,255,.15)' }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <span style={{ fontSize: 34 }}>{pattern.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 17, letterSpacing: '-.01em', color: '#fdfbf9' }}>{pattern.name}</div>
          <div style={{ fontFamily: SORA, fontWeight: 600, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: pattern.districtColor, marginTop: 2 }}>
            {pattern.districtLabel} {pattern.districtSymbol} · rarity {pattern.rarity}
          </div>
        </div>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={5} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={pattern.districtColor} strokeWidth={5} strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text x="50%" y="55%" textAnchor="middle" fontFamily="Sora" fontWeight={700} fontSize={11} fill="#fdfbf9">
            {pattern.depth}/5
          </text>
        </svg>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 12, color: '#fdfbf9' }}>{signalCount}</span>
        <span style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 12, color: '#c4a0b2' }}>signals</span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: SORA, fontWeight: 600, fontSize: 10,
          padding: '3px 9px', borderRadius: 999,
          background: 'rgba(255,255,255,.05)',
          border: '.5px solid rgba(255,255,255,.1)',
          color: pattern.trendColor, letterSpacing: '.08em', textTransform: 'uppercase',
        }}>
          {pattern.trendLabel}
        </span>
      </div>

      <div style={{ fontFamily: NEWS, fontStyle: 'italic', fontSize: 13.5, color: '#fdfbf9', lineHeight: 1.5, marginBottom: 16 }}>
        {pattern.punch}
      </div>

      {/* trend line */}
      <div style={{ marginBottom: 14 }}>
        <svg width={w} height={h + 16} viewBox={`0 0 ${w} ${h + 16}`} style={{ display: 'block', maxWidth: '100%' }}>
          <polyline
            points={points}
            fill="none"
            stroke={pattern.districtColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLen}
            strokeDashoffset={pathLen * (1 - trendProgress)}
            style={{ transition: 'stroke-dashoffset .1s linear' }}
          />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SORA, fontWeight: 700, fontSize: 8.5, letterSpacing: '.2em', color: 'rgba(255,255,255,.35)' }}>
          <span>7 WEEKS AGO</span>
          <span>THIS WEEK</span>
        </div>
      </div>

      {/* Where it shows up */}
      <div style={{ paddingTop: 12, borderTop: '.5px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 9, letterSpacing: '.22em', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
          WHERE IT SHOWS UP
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, fontFamily: SORA, fontWeight: 600, fontSize: 11, color: '#fdfbf9' }}>
          <SrcCell icon="🗯" color="#a52a5f" n={pattern.sources.spill} />
          <SrcCell icon="📸" color="#7F77DD" n={pattern.sources.scan} />
          <SrcCell icon="💬" color="#c87c4a" n={pattern.sources.comments} />
          <SrcCell icon="♥" color="#c1216b" n={pattern.sources.likes} />
          <SrcCell icon="✦" color="#5B8A5E" n={pattern.sources.follows} />
          <SrcCell icon="👁" color="#9a7bd0" n={pattern.sources.browse} />
        </div>
      </div>

      {/* Mini world */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '.5px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 9, letterSpacing: '.22em', color: 'rgba(255,255,255,.5)', marginBottom: 10 }}>
          THE MIRROR WORLD · 5 DISTRICTS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {DEMO_DISTRICTS.map((d) => (
            <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: d.color }}>
                {d.symbol} {d.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32 }}>
                {d.patterns.map((pp, i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      height: 6 + pp.depth * 5,
                      background: pp.ruined ? '#6f7a5e' : d.color,
                      borderRadius: 2,
                      opacity: pp.ruined ? .55 : .9,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, fontFamily: SORA, fontWeight: 700, fontSize: 9, letterSpacing: '.24em', color: 'rgba(255,255,255,.28)', textAlign: 'center', position: 'relative', zIndex: 3 }}>
        SHUTAP · THE MIRROR · DEMO
      </div>
      </div>
      {card.decor}
    </div>
  )
}

function SrcCell({ icon, color, n }: { icon: string; color: string; n: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: '.5px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '6px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ color, fontSize: 13, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 10.5, color: '#fdfbf9' }}>{n}</span>
    </div>
  )
}

function LockBanner({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div
      style={{
        width: 'min(380px,92vw)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'linear-gradient(140deg, rgba(233,192,106,.14), rgba(233,192,106,.04))',
        border: '.5px solid rgba(233,192,106,.4)',
        borderRadius: 16,
        padding: '10px 14px',
      }}
    >
      <span style={{ fontSize: 18 }}>🔒</span>
      <span style={{ flex: 1, fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 13, color: '#c1a02b' }}>
        subscription required for full mirror access
      </span>
      <button
        type="button"
        onClick={onUnlock}
        style={{
          background: 'linear-gradient(135deg,#c1a02b,#c69a3d)',
          color: '#1a0d16',
          border: 0,
          borderRadius: 999,
          padding: '7px 14px',
          fontFamily: 'Sora,sans-serif',
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        open the mirror reading →
      </button>
    </div>
  )
}
