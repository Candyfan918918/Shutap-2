// The Mirror — dark tarot surface. Every value comes from the user's
// mirror_patterns rows (or the read-only demo cast for logged-out / forming
// previews). Opens issue zero model calls; the punch line is a DB field.
// Cinematic reveal is progressive enhancement: the final upright card is
// always rendered first, then animations play over it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from '@/compat/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { EyeMark, ShutapWordmark } from '@/components/EyeMark'
import { Words, Reveal } from '@/components/motion'

import {
  listMirrorPatterns,
  listDemoPatterns,
} from '@/lib/mirror-pipeline.functions'
import { backfillMyMirror } from '@/lib/mirror-backfill.functions'
import { getMirrorEntitlement } from '@/lib/entitlements.functions'
import { getStripeEnvironment } from '@/lib/stripe'
import { runMirrorCrossRead } from '@/lib/agents/mirror.functions'
import {
  DISTRICT_LABEL,
  DISTRICT_SIGIL,
  RARITY_NUMERAL,
  type District,
  type Rarity,
} from '@/lib/agents/mirror-guards'
import { getAlias, rememberReturnTo, signOut as doSignOut } from '@/lib/auth'
import { useIsAdmin } from '@/hooks/use-current-alias'
import { supabase } from '@/integrations/supabase/client'
import { MirrorShareSheet } from '@/components/MirrorShareSheet'
import { ActionPill } from '@/components/ShareChannels'
import { JokeSurface } from '@/pages/home/joke/JokeSurface'


// Demo cast is shown as an EXAMPLE to any forming account (display-only).

import type { Alias } from '@/data/types'
import { useNoIndex } from '@/components/NoIndex'

/* ─────────────── design tokens (src/styles/tokens.css) ─────────────── */
const BG = 'var(--bg)'            /* #ffffff */
const SURFACE = 'var(--surface)'  /* #ffffff */
const INK = 'var(--ink)'          /* #0b080f */
const MUTED = 'var(--text-2)'     /* #443c42 */
const MUTED_2 = 'var(--text-3)'   /* #6f666c */
const MUTED_3 = 'var(--text-3)'   /* #6f666c */
const GOLD = 'var(--r-brave)'     /* #c1a02b */
const GOLD_HEX = '#c1a02b'        /* for alpha-suffixed borders/glows */
const BORDER = 'var(--border)'
const RUIN_HEX = '#6f666c'   /* --text-3: ruin reads faded, not recolored */
const CARD_SHADOW = '0 10px 28px -22px rgba(60,10,30,.28)'
const CARD_SHADOW_HOVER = '0 22px 44px -26px rgba(60,10,30,.42)'

/* district hues are the tokens --pink / --r-time / --wine / --r-same / --r-strong */
const DISTRICT_COLOR: Record<District, string> = {
  self: '#a52a5f',
  career: '#7F77DD',
  love: '#c1216b',
  family: '#c87c4a',
  social: '#5B8A5E',
}


const SOURCE_GLYPH: Record<string, string> = {
  spill: '🗯',
  scan: '📸',
  comments: '💬',
  likes: '♥',
  follows: '✦',
  browse: '👁',
  joke: '🃏',
}
const SOURCE_COLOR: Record<string, string> = {
  spill: '#a52a5f',
  scan: '#7F77DD',
  comments: '#c87c4a',
  likes: '#c1216b',
  follows: '#5B8A5E',
  browse: '#9a7bd0',
  // the joke surface's own accent, lighter than spill's and likes' so the
  // three pinks stay apart in the bar
  joke: '#e7548a',
}

const DISTRICTS: District[] = ['self', 'career', 'love', 'family', 'social']

/* ─────────────── types ─────────────── */
export type MirrorPatternView = {
  id: string
  name: string
  emoji: string
  district: District
  rarity: Rarity
  state: 'active' | 'ruin'
  insight: string
  punch: string
  record: string
  count: number
  depth: number
  trend: number[]
  trend_dir: 'rising' | 'steady' | 'cooling' | 'dormant'
  sources: Record<string, number>
  first_seen: string
  last_seen: string
}

/* ─────────────── small utils ─────────────── */
function timeAgo(iso: string): string {
  if (!iso) return 'just now'
  const ms = Date.now() - new Date(iso).getTime()
  const h = ms / 36e5
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  const d = h / 24
  if (d < 30) return `${Math.round(d)}d ago`
  return `${Math.round(d / 30)}mo ago`
}

function trendArrow(dir: string) {
  if (dir === 'rising') return '🔥'
  if (dir === 'cooling') return '🧊'
  if (dir === 'dormant') return '💤'
  return '😐'
}
function trendColor(dir: string) {
  if (dir === 'rising') return '#a52a5f'
  if (dir === 'cooling') return '#7F77DD'
  if (dir === 'dormant') return MUTED_3
  return '#c4a0b2'
}

/* ─────────────── built-in example cast (display-only) ─────────────── */
const EX_TREND: Record<string, number[]> = {
  rising: [1, 2, 2, 4, 5, 7, 10], cooling: [10, 9, 7, 6, 4, 3, 2],
  dormant: [6, 4, 3, 1, 0, 0, 0], steady: [5, 6, 5, 7, 6, 7, 6],
}
const exDepth = (c: number) => (c < 10 ? 1 : c < 25 ? 2 : c < 60 ? 3 : c < 120 ? 4 : 5)
const exDays = (last: string) => {
  if (/today/.test(last)) return 0
  const mo = last.match(/(\d+)\s*mo/); if (mo) return +mo[1] * 30
  const w = last.match(/(\d+)\s*w/); if (w) return +w[1] * 7
  const d = last.match(/(\d+)\s*d/); if (d) return +d[1]
  return 1
}
const RAW_EXAMPLE = [
  { id: 'avoid', name: 'Avoidant Texter', emoji: '📱', district: 'self', rarity: 'epic', state: 'active', dir: 'rising', last: 'today', insight: 'you read it, then make them wait.', punch: '192 reads, zero replies. not mysterious bestie, just scared with great wifi.', sources: { spill: 24, scan: 14, comments: 8, likes: 71, follows: 5, browse: 70 } },
  { id: 'impostor', name: 'Impostor at the Table', emoji: '🎭', district: 'career', rarity: 'legendary', state: 'active', dir: 'steady', last: '5d', insight: 'you earned the seat, still bracing to be removed.', punch: '140 rooms you earned and you still sit like the bouncer is en route.', sources: { spill: 22, scan: 18, comments: 14, likes: 19, follows: 7, browse: 60 } },
  { id: 'escape', name: 'Escape Hatch Builder', emoji: '🚪', district: 'social', rarity: 'epic', state: 'active', dir: 'rising', last: '4d', insight: 'you build the exit before you arrive.', punch: '95 plans, 95 exit routes. you RSVP yes and mean we will see.', sources: { spill: 12, scan: 6, comments: 9, likes: 18, follows: 8, browse: 42 } },
  { id: 'yes', name: 'The Yes Machine', emoji: '✅', district: 'career', rarity: 'epic', state: 'active', dir: 'rising', last: '1d', insight: 'you say yes before your body finishes flinching.', punch: '96 yeses deep and your spine left on read, fr.', sources: { spill: 14, scan: 8, comments: 21, likes: 16, follows: 5, browse: 32 } },
  { id: 'fixer', name: 'The Fixer', emoji: '🔧', district: 'love', rarity: 'epic', state: 'active', dir: 'steady', last: '6d', insight: 'you fix them to avoid sitting with you.', punch: '88 saves. you would rather fix their life than open your own tabs.', sources: { spill: 18, scan: 9, comments: 12, likes: 14, follows: 6, browse: 29 } },
  { id: 'doom', name: 'Doom Scroller', emoji: '📜', district: 'self', rarity: 'rare', state: 'active', dir: 'rising', last: '2d', insight: 'you doomscroll the fear you outran.', punch: '57 nights doomscrolling the fear you swore you healed from. bestie.', sources: { spill: 3, scan: 1, comments: 2, likes: 9, follows: 2, browse: 40 } },
  { id: 'heart', name: 'Heart on Read', emoji: '💌', district: 'love', rarity: 'rare', state: 'active', dir: 'rising', last: '2d', insight: 'you give the heart, never the words.', punch: '54 hearts dropped, zero texts back. you flirt like a hit-and-run.', sources: { spill: 6, scan: 3, comments: 4, likes: 31, follows: 4, browse: 6 } },
  { id: 'spiral', name: '3am Spiral', emoji: '🌙', district: 'self', rarity: 'rare', state: 'active', dir: 'steady', last: '3d', insight: 'you reopen the wound to confirm it still bleeds.', punch: '47 nights reopening the wound like it owes you closure.', sources: { spill: 9, scan: 6, comments: 2, likes: 8, follows: 1, browse: 21 } },
  { id: 'grudge', name: 'Grudge Archivist', emoji: '📦', district: 'family', rarity: 'rare', state: 'active', dir: 'cooling', last: '3w', insight: 'you file people under their worst day.', punch: '44 receipts saved. you lose your keys but never a single slight.', sources: { spill: 7, scan: 3, comments: 8, likes: 6, follows: 2, browse: 18 } },
  { id: 'score', name: 'Keeper of the Score', emoji: '📊', district: 'love', rarity: 'rare', state: 'active', dir: 'steady', last: '1w', insight: 'you keep every receipt but your own.', punch: '41 tallies deep. you keep score like a sport you are losing.', sources: { spill: 8, scan: 4, comments: 6, likes: 7, follows: 2, browse: 14 } },
  { id: 'apology', name: 'Apology Reflex', emoji: '🙇', district: 'self', rarity: 'uncommon', state: 'active', dir: 'cooling', last: '1w', insight: 'you apologize for taking up space.', punch: '23 sorrys for existing. you apologized to a door once, the audacity.', sources: { spill: 6, scan: 2, comments: 7, likes: 3, follows: 1, browse: 4 } },
  { id: 'ghost', name: 'Ghost of Group Chats', emoji: '👻', district: 'social', rarity: 'uncommon', state: 'active', dir: 'dormant', last: '5w', insight: 'you read everything, answer nothing.', punch: '21 group chats read in full, then poof. casper behavior.', sources: { spill: 3, scan: 1, comments: 2, likes: 5, follows: 3, browse: 7 } },
  { id: 'inbox', name: 'Inbox Martyr', emoji: '📥', district: 'career', rarity: 'uncommon', state: 'active', dir: 'cooling', last: '2w', insight: 'you answer at midnight nobody asked you to.', punch: '19 midnight replies nobody asked for. employed by guilt, unpaid.', sources: { spill: 4, scan: 1, comments: 6, likes: 2, follows: 1, browse: 5 } },
  { id: 'peace', name: 'The Peacekeeper', emoji: '🕊', district: 'family', rarity: 'rare', state: 'ruin', dir: 'dormant', last: 'ruin · 6mo', insight: 'you swallowed the fight to keep the room calm — until you stopped.', punch: '62 fights swallowed whole, then you stopped. character development, fr.', sources: { spill: 15, scan: 7, comments: 9, likes: 11, follows: 4, browse: 16 } },
  { id: 'fine', name: 'Fine, Fine, Fine', emoji: '🪨', district: 'self', rarity: 'rare', state: 'ruin', dir: 'dormant', last: 'ruin · 4mo', insight: 'you said fine until you meant it — then left.', punch: 'fine 31 times, then you dipped. growth looks good on you, ngl.', sources: { spill: 11, scan: 5, comments: 4, likes: 5, follows: 1, browse: 5 } },
]
const EXAMPLE_PATTERNS = RAW_EXAMPLE.map((p) => {
  const count = Object.values(p.sources).reduce((a, b) => a + b, 0)
  return {
    id: p.id, name: p.name, emoji: p.emoji, district: p.district, rarity: p.rarity,
    state: p.state, insight: p.insight, punch: p.punch, record: '',
    count, depth: exDepth(count), trend: [...EX_TREND[p.dir]], trend_dir: p.dir,
    sources: p.sources,
    first_seen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
    last_seen: new Date(Date.now() - 1000 * 60 * 60 * 24 * exDays(p.last)).toISOString(),
  }
}) as unknown as MirrorPatternView[]

/* ─────────────── dark header (mirror-only) ─────────────── */
function MirrorHeader() {
  const navigate = useNavigate()
  const [alias, setAlias] = useState<Alias | null>(() => getAlias())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const admin = useIsAdmin()
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])
  const join = () => {
    rememberReturnTo(window.location.href)
    navigate('/welcome')
  }
  const out = async () => {
    setOpen(false)
    await doSignOut()
    setAlias(null)
  }
  const item: React.CSSProperties = {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 10,
    fontFamily: "'Newsreader',serif",
    fontStyle: 'italic',
    fontSize: 14,
    color: INK,
    textDecoration: 'none',
    cursor: 'pointer',
  }
  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(255,255,255,.88)',
        backdropFilter: 'blur(18px)',
        borderBottom: `.5px solid ${BORDER}`,

      }}
    >
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: '11px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: INK }}>
          <EyeMark size={30} />
          <ShutapWordmark size={19} ink={INK} letterSpacing="-.04em" />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/stream" style={{
            fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 14,
            color: MUTED, textDecoration: 'none', padding: '6px 12px',
          }}>rooms</Link>
          <Link to="/halls" style={{
            fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 14,
            color: MUTED, textDecoration: 'none', padding: '6px 12px',
          }}>halls</Link>
          <div ref={ref} style={{ position: 'relative' }}>
            {alias ? (
              <>
                <div
                  role="button"
                  onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'rgba(11,8,15,.04)',
                    border: '.5px solid rgba(11,8,15,.10)',
                    borderRadius: 999, padding: '5px 12px 5px 5px', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#a52a5f,#890041)',
                    display: 'grid', placeItems: 'center', fontSize: 14, flex: 'none',
                  }}>{alias.emoji || '🐣'}</span>
                  <span style={{
                    fontFamily: "'Newsreader',serif", fontStyle: 'italic',
                    fontSize: 13, color: INK,
                  }}>{alias.name || ''}</span>
                </div>
                {open && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 9px)', right: 0,
                    width: 220,
                    background: SURFACE,
                    border: `.5px solid ${BORDER}`,
                    borderRadius: 16, padding: 7, zIndex: 70,
                    boxShadow: '0 24px 50px -16px rgba(60,10,30,.28)',

                  }}>
                    <Link to="/profile" style={item} onClick={() => setOpen(false)}>your profile</Link>
                    <Link to="/profile#settings" style={item} onClick={() => setOpen(false)}>settings</Link>
                    <div role="button" style={{ ...item, color: '#a52a5f' }} onClick={() => { setOpen(false); navigate('/#spill') }}>spill it →</div>
                    <Link to="/mirror" style={{ ...item, color: GOLD }} onClick={() => setOpen(false)}>the mirror ✦</Link>
                    {admin && <Link to="/admin" style={item} onClick={() => setOpen(false)}>admin</Link>}
                    <div style={{ height: '.5px', background: 'rgba(11,8,15,.08)', margin: '6px 0' }} />
                    <div role="button" style={{ ...item, color: MUTED_2 }} onClick={out}>sign out</div>
                  </div>
                )}
              </>
            ) : (
              <div role="button" onClick={join} style={{
                display: 'inline-flex', alignItems: 'center',
                background: '#a52a5f', color: '#fff', borderRadius: 999,
                padding: '9px 18px', fontFamily: "'Sora',sans-serif",
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>join →</div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

/* ─────────────── depth wheel ─────────────── */
function DepthWheel({
  depth, emoji, dir, color, size = 132, animate,
}: { depth: number; emoji: string; dir: string; color: string; size?: number; animate: boolean }) {
  const r = 52
  const C = 2 * Math.PI * r
  const target = C * Math.min(1, Math.max(0, depth / 5))
  const [dash, setDash] = useState(animate ? 0 : target)
  useEffect(() => {
    if (!animate) { setDash(target); return }
    let raf = 0
    const t0 = performance.now()
    const dur = 1100
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setDash(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, animate])
  const orbitDur = dir === 'rising' ? '5s' : dir === 'cooling' ? '14s' : dir === 'dormant' ? '40s' : '9s'
  return (
    <div style={{ position: 'relative', width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(11,8,15,.08)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          transform="rotate(-90 60 60)"
          style={{ filter: `drop-shadow(0 0 10px ${color}88)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontSize: Math.round(size * 0.36), lineHeight: 1,
        filter: `drop-shadow(0 0 14px ${color}aa)`,
        animation: 'mirror-float 4.6s ease-in-out infinite',
      }}>{emoji}</div>
      <div style={{
        position: 'absolute', inset: 0,
        animation: `mirror-orbit ${orbitDur} linear infinite`,
        opacity: dir === 'dormant' ? 0.3 : 0.95,
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: 2, width: 7, height: 7, marginLeft: -3.5,
          borderRadius: 999, background: color, boxShadow: `0 0 12px ${color}`,
        }} />
      </div>
    </div>
  )
}

/* ─────────────── trend chart ─────────────── */
function TrendChart({ trend, color, animate }: { trend: number[]; color: string; animate: boolean }) {
  const pts = (trend ?? []).slice(-7)
  const w = 280, h = 70, pad = 8
  if (pts.length < 2) {
    return <div style={{ height: h, fontFamily: "'Sora',sans-serif", fontSize: 10, color: MUTED_3, letterSpacing: '.18em', textAlign: 'center', paddingTop: 24 }}>NOT ENOUGH SIGNAL YET</div>
  }
  const max = Math.max(1, ...pts.map(Number))
  const step = (w - pad * 2) / (pts.length - 1)
  const xy = pts.map((v, i) => {
    const x = pad + i * step
    const y = pad + (1 - Number(v) / max) * (h - pad * 2)
    return [x, y] as const
  })
  const d = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = xy[xy.length - 1]
  const id = `tg-${color.replace(/[^a-z0-9]/gi, '')}`
  const pathRef = useRef<SVGPathElement>(null)
  useEffect(() => {
    if (!animate || !pathRef.current) return
    const len = pathRef.current.getTotalLength()
    pathRef.current.style.strokeDasharray = `${len}`
    pathRef.current.style.strokeDashoffset = `${len}`
    pathRef.current.getBoundingClientRect()
    pathRef.current.style.transition = 'stroke-dashoffset 1100ms cubic-bezier(.2,.7,.2,1)'
    pathRef.current.style.strokeDashoffset = '0'
  }, [animate, d])
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-hidden style={{ display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".45" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L ${last[0]} ${h - pad} L ${xy[0][0]} ${h - pad} Z`} fill={`url(#${id})`} />
        <path ref={pathRef} d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}77)` }} />
        <circle cx={last[0]} cy={last[1]} r="4" fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
          <animate attributeName="r" values="3.5;6;3.5" dur="2.2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Sora',sans-serif", fontSize: 9, color: MUTED_3, letterSpacing: '.18em', marginTop: 2 }}>
        <span>7 WEEKS AGO</span><span>THIS WEEK</span>
      </div>
    </div>
  )
}

/* ─────────────── signal bar ─────────────── */
function SignalBar({ sources, animate, totalOverride }: { sources: Record<string, number>; animate: boolean; totalOverride?: number }) {
  const order = ['spill', 'scan', 'comments', 'likes', 'follows', 'browse', 'joke']
  const bandTotal = order.reduce((a, k) => a + Number(sources?.[k] ?? 0), 0)
  const total = totalOverride ?? bandTotal

  return (
    <div>
      <div style={{
        display: 'flex', width: '100%', height: 10, borderRadius: 999, overflow: 'hidden',
        background: 'rgba(11,8,15,.05)', border: '.5px solid rgba(11,8,15,.06)',
      }}>
        {order.map((k, i) => {
          const v = Number(sources?.[k] ?? 0)
          const pct = bandTotal > 0 ? (v / bandTotal) * 100 : 0

          return (
            <div key={k} style={{
              width: animate ? '0%' : `${pct}%`,
              background: SOURCE_COLOR[k] ?? MUTED_2,
              transition: `width 900ms cubic-bezier(.2,.7,.2,1) ${i * 60}ms`,
              opacity: v > 0 ? 0.95 : 0.15,
            }} />
          )
        })}
      </div>
      <div style={{
        marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap',
        fontFamily: "'Sora',sans-serif", fontSize: 10, color: MUTED_2, letterSpacing: '.06em',
      }}>
        {order.map((k) => {
          const v = Number(sources?.[k] ?? 0)
          return (
            <span key={k} style={{ opacity: v > 0 ? 1 : 0.35, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <span style={{ color: SOURCE_COLOR[k] }}>{SOURCE_GLYPH[k]}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: INK }}>{v}</span>
            </span>
          )
        })}
      </div>
      <div style={{
        marginTop: 6, fontFamily: "'Sora',sans-serif", fontSize: 9.5,
        color: MUTED_3, letterSpacing: '.20em',
      }}>
        SYNTHESIZED FROM {total} SIGNALS · {order.length} SURFACES
      </div>
    </div>
  )
}

/* ─────────────── count tick ─────────────── */
function CountTick({ value, animate, style }: { value: number; animate: boolean; style?: React.CSSProperties }) {
  const [v, setV] = useState(animate ? 0 : value)
  useEffect(() => {
    if (!animate) { setV(value); return }
    let raf = 0
    const t0 = performance.now()
    const dur = 1000
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, animate])
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{v}</span>
}

/* ─────────────── the big tarot card ─────────────── */
function TarotCard({
  p, animate, innerRef, totalSignalsOverride,
}: { p: MirrorPatternView; animate: boolean; innerRef?: React.Ref<HTMLDivElement>; totalSignalsOverride?: number }) {

  const color = p.state === 'ruin' ? RUIN_HEX : DISTRICT_COLOR[p.district]
  const isLegendary = p.rarity === 'legendary' && p.state !== 'ruin'
  const isRuin = p.state === 'ruin'
  const border = isLegendary ? GOLD_HEX : `${color}33`
  return (
    <article
      ref={innerRef}
      className={`mirror-tarot ${animate ? 'mirror-tarot--open' : ''}`}
      style={{
        position: 'relative', borderRadius: 22, overflow: 'hidden',
        background: SURFACE,
        border: `.5px solid ${border}`,
        boxShadow: isLegendary
          ? `0 0 0 1px ${GOLD_HEX}44, ${CARD_SHADOW}`
          : CARD_SHADOW,
        color: INK,
        padding: '16px 18px 14px',
        filter: isRuin ? 'saturate(.55)' : undefined,
        ['--district' as never]: color,
      } as React.CSSProperties}
    >
      {/* inner ornamental frame */}
      <div aria-hidden style={{
        position: 'absolute', inset: 6, borderRadius: 18, pointerEvents: 'none',
        border: `.5px solid ${isLegendary ? `${GOLD_HEX}44` : BORDER}`,
      }} />
      {/* district wash at the crown */}
      <div aria-hidden style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '32%', pointerEvents: 'none',
        background: `radial-gradient(90% 100% at 50% 0%, ${color}14, transparent 70%)`,
      }} />
      {/* cursor-follow glare (reacts to --glare-x/y/o set on the tilt wrapper) */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, borderRadius: 22, pointerEvents: 'none',
        background: `radial-gradient(circle at var(--glare-x,50%) var(--glare-y,50%), ${color}1f, ${color}00 45%)`,
        opacity: 'var(--glare-o,0)' as unknown as number,
        transition: 'opacity .25s ease',
      } as React.CSSProperties} />



      {/* chrome row */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 999,
          background: `${color}1a`, border: `.5px solid ${color}55`,
          fontFamily: "'Sora',sans-serif", fontSize: 10, letterSpacing: '.22em',
          color: isRuin ? MUTED_2 : INK, textTransform: 'uppercase',
        }}>
          <span style={{ fontSize: 12, color }}>{DISTRICT_SIGIL[p.district]}</span>
          {DISTRICT_LABEL[p.district]}
        </span>
        <span style={{
          fontFamily: "'Newsreader',serif", fontStyle: 'italic',
          fontSize: 22, letterSpacing: '.08em',
          color: isLegendary ? GOLD : MUTED,
        }}>{RARITY_NUMERAL[p.rarity]}</span>
      </div>

      {/* name */}
      <h3 style={{
        position: 'relative', margin: '10px 0 4px', textAlign: 'center',
        fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontWeight: 500,
        fontSize: 'clamp(22px, 4.4vw, 26px)', lineHeight: 1.1, color: INK,
      }}>{p.name}</h3>

      {/* depth wheel */}
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center', margin: '8px 0 4px' }}>
        <DepthWheel depth={p.depth} emoji={p.emoji || '✨'} dir={p.trend_dir} color={color} animate={animate} />
      </div>
      <div style={{ textAlign: 'center', fontFamily: "'Sora',sans-serif", fontSize: 10, letterSpacing: '.22em', color: MUTED_2, marginBottom: 8 }}>
        {isRuin ? 'GONE TO RUIN' : `DEPTH ${p.depth}/5`}
      </div>

      {/* trend chart */}
      <div style={{ position: 'relative', margin: '2px 0 10px' }}>
        <TrendChart trend={p.trend} color={color} animate={animate} />
      </div>

      {/* signal bar */}
      <div style={{ position: 'relative', margin: '2px 0 10px' }}>
        <SignalBar sources={p.sources ?? {}} animate={animate} totalOverride={totalSignalsOverride} />
      </div>

      {/* readout row */}
      <div style={{
        position: 'relative', display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-end', padding: '12px 0 10px',
        borderTop: '.5px solid rgba(11,8,15,.08)',
      }}>
        <div>
          <div style={{
            fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 30,
            color, lineHeight: 1, letterSpacing: '-.02em',
          }}>
            <CountTick value={totalSignalsOverride ?? p.count} animate={animate} />
          </div>
          <div style={{
            marginTop: 4, fontFamily: "'Sora',sans-serif", fontSize: 10,
            color: MUTED_3, letterSpacing: '.18em', textTransform: 'uppercase',
          }}>{totalSignalsOverride != null ? 'all-time signals · you' : 'all-time signals'}</div>

        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(11,8,15,.05)',
            border: `.5px solid ${trendColor(p.trend_dir)}55`,
            fontFamily: "'Sora',sans-serif", fontSize: 10, letterSpacing: '.14em',
            color: trendColor(p.trend_dir), textTransform: 'uppercase',
          }}>{trendArrow(p.trend_dir)} {p.trend_dir}</span>
          <div style={{
            marginTop: 6, fontFamily: "'Sora',sans-serif", fontSize: 9.5,
            color: MUTED_3, letterSpacing: '.14em',
          }}>last seen · {timeAgo(p.last_seen)}</div>
        </div>
      </div>

      {/* punch line */}
      <p style={{
        position: 'relative', margin: '8px 0 6px', textAlign: 'center',
        fontFamily: "'Newsreader',serif", fontStyle: 'italic',
        fontSize: 18, lineHeight: 1.3, color: INK,
      }}>
        &ldquo;{p.punch || p.insight || 'still forming.'}&rdquo;
      </p>

      {/* record stamp */}
      <div style={{
        position: 'relative', textAlign: 'center',
        fontFamily: "'Sora',sans-serif", fontSize: 10.5, fontWeight: 700,
        letterSpacing: '.22em', color: isLegendary ? GOLD : MUTED, textTransform: 'uppercase',
        marginTop: 4,
      }}>
        {p.count}× · {p.trend_dir}{p.record ? ` · ${p.record}` : ''}
      </div>

      {/* footer stamp — full-brightness shared brand mark */}
      <div style={{
        position: 'relative', marginTop: 16, display: 'flex',
        justifyContent: 'center', alignItems: 'center', gap: 7,
      }}>
        <EyeMark w={24} />
        <ShutapWordmark size={13} ink={INK} accent="#a52a5f" letterSpacing="-.02em" />
        <span style={{
          width: 3, height: 3, borderRadius: '50%', background: MUTED_2,
          display: 'inline-block',
        }} />
        <span style={{
          fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 8.5,
          letterSpacing: '.24em', textTransform: 'uppercase', color: MUTED,
        }}>THE MIRROR</span>
      </div>
    </article>
  )
}

/* ─────────────── deck-back reveal cover ─────────────── */
function DeckBack({ onDone }: { onDone: () => void }) {
  const [lifting, setLifting] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setLifting(true), 700)
    const t2 = setTimeout(onDone, 1650)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden',
      background: 'linear-gradient(160deg, #fff, var(--surface-2))',
      border: `.5px solid ${GOLD_HEX}55`,
      display: 'grid', placeItems: 'center', zIndex: 4,
      transition: 'transform 900ms cubic-bezier(.2,.7,.2,1), opacity 900ms ease',
      transform: lifting ? 'translateY(-10%) scale(1.06) rotate(-2deg)' : 'translateY(0) scale(1)',
      opacity: lifting ? 0 : 1,
      boxShadow: CARD_SHADOW,
    }}>
      <div style={{ position: 'absolute', inset: 6, borderRadius: 18, border: `.5px solid ${GOLD_HEX}44` }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 34, margin: '0 auto', opacity: .9 }}>
          <svg viewBox="0 0 140 96" fill="none" style={{ width: '100%', height: '100%' }}>
            <rect x="16" y="6" width="56" height="84" rx="28" fill={GOLD} opacity=".85" />
            <rect x="84" y="6" width="56" height="84" rx="28" fill={GOLD} opacity=".85" />
            <ellipse cx="44" cy="62" rx="19" ry="24" fill="#fff" />
            <ellipse cx="112" cy="62" rx="19" ry="24" fill="#fff" />
          </svg>
        </div>
        <div style={{
          marginTop: 18, fontFamily: "'Newsreader',serif", fontStyle: 'italic',
          fontSize: 19, color: GOLD, letterSpacing: '.04em',
        }}>a reading is forming…</div>
      </div>
    </div>
  )
}

/* ─────────────── mini card (the cast) ─────────────── */
function MiniCard({ p, onOpen }: { p: MirrorPatternView; onOpen: () => void }) {
  const color = p.state === 'ruin' ? RUIN_HEX : DISTRICT_COLOR[p.district]
  const isLegendary = p.rarity === 'legendary' && p.state !== 'ruin'
  const isRuin = p.state === 'ruin'
  return (
    <button
      onClick={onOpen}
      className="mirror-tile"
      style={{
        textAlign: 'left', cursor: 'pointer', padding: 16, borderRadius: 16,
        background: SURFACE,
        border: `.5px solid ${isLegendary ? `${GOLD_HEX}66` : BORDER}`,
        color: INK, position: 'relative',
        boxShadow: CARD_SHADOW,
        transition: 'transform .18s ease, box-shadow .2s ease, border-color .18s ease',
        filter: isRuin ? 'saturate(.55)' : undefined,
      }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = CARD_SHADOW_HOVER; el.style.borderColor = color }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = CARD_SHADOW; el.style.borderColor = isLegendary ? `${GOLD_HEX}66` : 'rgba(11,8,15,.08)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontFamily: "'Sora',sans-serif", fontSize: 9.5, letterSpacing: '.22em',
          color: isRuin ? MUTED_2 : INK, textTransform: 'uppercase',
        }}>
          <span style={{ color }}>{DISTRICT_SIGIL[p.district]}</span>
          {DISTRICT_LABEL[p.district]}
        </span>
        <span style={{
          fontFamily: "'Newsreader',serif", fontStyle: 'italic',
          fontSize: 16, color: isLegendary ? GOLD : MUTED,
        }}>{RARITY_NUMERAL[p.rarity]}</span>
      </div>
      <div style={{
        marginTop: 10, fontSize: 30, lineHeight: 1, textAlign: 'center',
      }}>{p.emoji || '✨'}</div>
      <div style={{
        marginTop: 6, textAlign: 'center',
        fontFamily: "'Newsreader',serif", fontStyle: 'italic',
        fontSize: 19, color: INK,
      }}>{p.name}</div>
      <p style={{
        marginTop: 8, fontFamily: "'Newsreader',serif", fontStyle: 'italic',
        fontSize: 14, lineHeight: 1.35, color: MUTED,
        textAlign: 'center',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{p.punch || p.insight || '—'}</p>
      <div style={{
        marginTop: 10, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderTop: '.5px solid rgba(11,8,15,.08)', paddingTop: 8,
      }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map((d) => (
            <span key={d} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: d <= p.depth ? color : 'rgba(11,8,15,.10)',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color, fontVariantNumeric: 'tabular-nums' }}>{p.count}</span>
          <span style={{
            fontFamily: "'Sora',sans-serif", fontSize: 9, letterSpacing: '.14em',
            color: trendColor(p.trend_dir), textTransform: 'uppercase',
          }}>{trendArrow(p.trend_dir)}</span>
        </div>
      </div>
    </button>
  )
}

/* ─────────────── world band ─────────────── */
function WorldBand({
  patterns, onJump,
}: { patterns: MirrorPatternView[]; onJump: (d: District) => void }) {
  const grouped = useMemo(() => {
    const acc: Record<District, MirrorPatternView[]> = { self: [], career: [], love: [], family: [], social: [] }
    for (const p of patterns) acc[p.district].push(p)
    return acc
  }, [patterns])
  return (
    <section style={{
      display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginTop: 24,
    }}>
      {DISTRICTS.map((d) => {
        const list = grouped[d]
        const ruins = list.filter((p) => p.state === 'ruin').length
        const total = list.reduce((a, p) => a + p.count, 0)
        const color = DISTRICT_COLOR[d]
        return (
          <button
            key={d}
            onClick={() => onJump(d)}
            className="mirror-world-tile"
            style={{
              cursor: 'pointer', textAlign: 'center',
              background: SURFACE,
              border: `.5px solid ${BORDER}`, borderRadius: 14,
              padding: '12px 8px 10px', color: INK, boxShadow: CARD_SHADOW,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.transform = 'translateY(-3px)'
              el.style.boxShadow = CARD_SHADOW_HOVER
              el.style.borderColor = color
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = CARD_SHADOW
              el.style.borderColor = 'rgba(11,8,15,.08)'
            }}
          >
            <div style={{
              height: 70, display: 'flex', gap: 3, alignItems: 'flex-end', justifyContent: 'center',
            }}>
              {list.length === 0 ? (
                <span style={{ fontSize: 11, color: MUTED_3, alignSelf: 'center', fontFamily: "'Sora',sans-serif", letterSpacing: '.16em' }}>—</span>
              ) : list.slice(0, 8).map((p, i) => (
                <div key={i} style={{
                  width: 6, height: 8 + (p.depth / 5) * 56,
                  borderRadius: 2,
                  background: p.state === 'ruin'
                    ? `linear-gradient(180deg, ${RUIN_HEX}, ${RUIN_HEX}55)`
                    : `linear-gradient(180deg, ${color}, ${color}55)`,
                  opacity: p.state === 'ruin' ? 0.5 : 1,
                }} />
              ))}
            </div>
            <div style={{
              marginTop: 6, fontFamily: "'Sora',sans-serif", fontSize: 10,
              letterSpacing: '.18em', color: MUTED,
            }}>
              <span style={{ color }}>{DISTRICT_SIGIL[d]}</span> {DISTRICT_LABEL[d].toUpperCase()}
            </div>
            <div style={{
              fontFamily: "'Newsreader',serif", fontStyle: 'italic',
              fontSize: 13, color: MUTED_2,
            }}>{total} signals · {ruins} ruin</div>
          </button>
        )
      })}
    </section>
  )
}

/* ─────────────── cross-read ─────────────── */
function CrossReadPanel({ patterns }: { patterns: MirrorPatternView[] }) {
  const cross = useServerFn(runMirrorCrossRead)
  const top = patterns.slice(0, 12)
  const key = top.map((p) => p.id).sort().join(',')
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['mirror-cross', key],
    enabled: patterns.length >= 2,
    staleTime: 1000 * 60 * 30,
    queryFn: () => cross({
      data: {
        patterns: top.map((p) => ({
          name: p.name, district: p.district, count: p.count, depth: p.depth, trend_dir: p.trend_dir,
        })),
      },
    }),
  })
  const totals = useMemo(() => {
    const acc: Record<District, number> = { self: 0, career: 0, love: 0, family: 0, social: 0 }
    for (const p of patterns) acc[p.district] += p.count
    return acc
  }, [patterns])
  const max = Math.max(1, ...Object.values(totals))
  // instant fallback derived from data
  const fallbackSees = useMemo(() => {
    const top2 = [...patterns].sort((a, b) => b.depth - a.depth).slice(0, 2)
    if (top2.length < 2) return 'the patterns are still rhyming.'
    return `${top2[0].name.toLowerCase()} and ${top2[1].name.toLowerCase()} keep showing up in the same week.`
  }, [patterns])
  return (
    <section style={{
      marginTop: 32, padding: 22, borderRadius: 20, color: INK,
      background: SURFACE,
      border: `.5px solid ${GOLD_HEX}55`,
      boxShadow: CARD_SHADOW,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 14, height: 10 }}>
            <svg viewBox="0 0 140 96" fill="none" style={{ width: '100%', height: '100%' }}>
              <rect x="16" y="6" width="56" height="84" rx="28" fill={GOLD} opacity=".9" />
              <rect x="84" y="6" width="56" height="84" rx="28" fill={GOLD} opacity=".9" />
              <ellipse cx="44" cy="62" rx="19" ry="24" fill="#fff" />
              <ellipse cx="112" cy="62" rx="19" ry="24" fill="#fff" />
            </svg>
          </span>
          <span style={{
            fontFamily: "'Sora',sans-serif", fontSize: 10.5, fontWeight: 700,
            letterSpacing: '.28em', color: GOLD,
          }}>WHAT YOUR MIRROR SEES</span>
        </div>
        <ActionPill onClick={() => refetch()} ariaLabel="Re-read mirror">
          {isFetching ? 're-reading…' : '↻ re-read'}
        </ActionPill>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginTop: 14,
      }}>
        {DISTRICTS.map((d) => {
          const v = totals[d]
          const h = 8 + (v / max) * 40
          const color = DISTRICT_COLOR[d]
          return (
            <div key={d} className="mirror-cross-bar-wrap" style={{ textAlign: 'center' }}>
              <div style={{ height: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div className="mirror-cross-bar" style={{
                  width: 14, height: h, borderRadius: 3,
                  background: v > 0 ? `linear-gradient(180deg, ${color}, ${color}55)` : 'rgba(11,8,15,.06)',
                  ['--bar-color' as string]: color,
                } as React.CSSProperties} />
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 9, color: MUTED_2, letterSpacing: '.16em', marginTop: 4 }}>
                <span style={{ color }}>{DISTRICT_SIGIL[d]}</span> {v}
              </div>
            </div>
          )
        })}
      </div>
      <p style={{
        margin: '18px 0 8px', fontFamily: "'Newsreader',serif", fontStyle: 'italic',
        fontSize: 24, lineHeight: 1.3, color: INK,
      }}>{data?.sees || fallbackSees}</p>
      <p style={{
        margin: 0, fontFamily: "'Newsreader',serif", fontStyle: 'italic',
        fontSize: 16, lineHeight: 1.4, color: MUTED,
      }}>{data?.throughline || 'the throughline is forming as you spill more.'}</p>
      {data?.record && (
        <div style={{
          marginTop: 14, paddingTop: 10,
          borderTop: '.5px solid rgba(11,8,15,.10)',
          fontFamily: "'Sora',sans-serif", fontSize: 10, letterSpacing: '.24em',
          color: MUTED_3, textTransform: 'uppercase',
        }}>{data.record}</div>
      )}
    </section>
  )
}

/* ─────────────── overlay detail ─────────────── */
function DetailOverlay({
  p, onClose, onShare,
}: { p: MirrorPatternView; onClose: () => void; onShare: (p: MirrorPatternView) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const [tick, setTick] = useState(0)
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'rgba(253,240,245,.84)', backdropFilter: 'blur(10px)',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      padding: '24px 16px', boxSizing: 'border-box',
      animation: 'mirror-fade .2s ease',
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 92vw)',
          minWidth: 240,
          margin: '0 auto',
          position: 'relative',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        key={tick}
      >
        <TarotCard p={p} animate />
        <div style={{
          display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
          gap: 10, marginTop: 14, paddingBottom: 24,
        }}>
          <ActionPill onClick={() => setTick((t) => t + 1)} ariaLabel="Re-read this card">
            ↻ re-read
          </ActionPill>
          <ActionPill tone="primary" onClick={() => onShare(p)} ariaLabel="Share card">
            ↗ share
          </ActionPill>
          <ActionPill onClick={onClose} ariaLabel="Close">
            ✕ close
          </ActionPill>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── share ─────────────── */
// Share now flows through MirrorShareSheet (rendered at the page root) so
// the channel pills match the Scan share card exactly.

/* ─────────────── forming state ─────────────── */
function Forming({ onSpill, onScan, onPreview, hasDemo, previewing, onBackfill, backfillPending, showBackfill }: {
  onSpill: () => void
  onScan: () => void
  onPreview: () => void
  hasDemo: boolean
  previewing: boolean
  onBackfill?: () => void
  backfillPending?: boolean
  showBackfill?: boolean
}) {
  const pill = (bg: string, color: string) => ({
    background: bg, color, border: 0, borderRadius: 999,
    padding: '11px 22px', fontFamily: "'Sora',sans-serif", fontWeight: 700,
    fontSize: 13, cursor: 'pointer',
  } as const)
  return (
    <section style={{
      marginTop: 28, padding: 28, borderRadius: 22, color: INK,
      background: SURFACE, boxShadow: CARD_SHADOW,
      border: `.5px solid ${BORDER}`,
    }}>
      <div style={{
        fontFamily: "'Sora',sans-serif", fontSize: 10.5, fontWeight: 700,
        letterSpacing: '.28em', color: GOLD, marginBottom: 10,
      }}>STILL FORMING</div>
      <p style={{
        margin: '0 0 16px', fontFamily: "'Newsreader',serif", fontStyle: 'italic',
        fontSize: 26, lineHeight: 1.2,
      }}>the mirror begins the moment you spill or scan.<br />nothing here yet — and nothing fabricated.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onSpill} style={pill('#a52a5f', '#fff')}>🫧 spill →</button>
        <button onClick={onScan} style={pill('transparent', GOLD)}>
          <span style={{ borderBottom: 'none' }}>✨ scan →</span>
        </button>
        {showBackfill && onBackfill && (
          <button
            onClick={onBackfill}
            disabled={backfillPending}
            style={{
              background: 'transparent', color: GOLD,
              border: `.5px solid ${GOLD_HEX}66`, borderRadius: 999,
              padding: '11px 22px', fontFamily: "'Sora',sans-serif", fontWeight: 700,
              fontSize: 13, cursor: backfillPending ? 'wait' : 'pointer',
              opacity: backfillPending ? 0.7 : 1,
            }}
          >{backfillPending ? 'reflecting your history…' : 'reflect my history ✦'}</button>
        )}
        {hasDemo && (
          <button onClick={onPreview} style={{
            background: 'transparent', color: GOLD,
            border: `.5px solid ${GOLD_HEX}66`, borderRadius: 999,
            padding: '11px 22px', fontFamily: "'Sora',sans-serif", fontWeight: 700,
            fontSize: 13, cursor: 'pointer',
          }}>{previewing ? 'hide example mirror' : 'see what yours becomes ✦'}</button>
        )}
      </div>
    </section>
  )
}


/* ─────────────── page ─────────────── */
export function MirrorPage() {
  useNoIndex()
  const navigate = useNavigate()
  const location = useLocation()
  const fetchMine = useServerFn(listMirrorPatterns)
  const fetchDemo = useServerFn(listDemoPatterns)
  const { data: mine, isLoading } = useQuery({
    queryKey: ['mirror-patterns', 'me'],
    queryFn: () => fetchMine(),
  })
  const [, setUserId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Server-decided entitlement — free vs paid vs demo owner (RULE 7).
  // Never trust the client. Anonymous / errors → treated as non-entitled.
  const fetchEnt = useServerFn(getMirrorEntitlement)
  const { data: entitlement } = useQuery({
    queryKey: ['mirror-entitlement'],
    queryFn: () => fetchEnt({ data: { environment: getStripeEnvironment() } }).catch(() => ({ entitled: false, demoAccount: false, reason: 'anonymous' as const })),
    staleTime: 60_000,
  })
  const isDemoAccount = !!entitlement?.demoAccount
  const isEntitled = !!entitlement?.entitled

  const mineList = (mine ?? []) as unknown as MirrorPatternView[]
  const isForming = mineList.length < 1

  // Demo/seed content is ONLY fetched for the owner demo account (RULE 6).
  const { data: demo } = useQuery({
    queryKey: ['mirror-patterns', 'demo'],
    queryFn: () => fetchDemo(),
    enabled: isForming && isDemoAccount,
    staleTime: 1000 * 60 * 30,
  })

  const dbDemo = (demo ?? []) as unknown as MirrorPatternView[]
  const demoList = isDemoAccount ? (dbDemo.length ? dbDemo : EXAMPLE_PATTERNS) : []
  const [showDemo, setShowDemo] = useState(false)
  // Auto-render seeded cast ONLY for the demo owner while their mirror is
  // forming. Everyone else sees the honest empty state (Forming component).
  const autoDemo = isForming && isDemoAccount && demoList.length > 0
  const list = showDemo || autoDemo ? demoList : mineList
  const isExample = autoDemo || showDemo

  // Backfill: turn the user's existing situations/comments into mirror signals.
  // The pipeline is idempotent, so we re-invoke until remaining === 0.
  const isSignedIn = !!entitlement && entitlement.reason !== 'anonymous'
  const queryClient = useQueryClient()
  const doBackfill = useServerFn(backfillMyMirror)
  const backfillMut = useMutation({
    mutationFn: () => doBackfill(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['mirror-patterns', 'me'] })
      if (res && res.remaining > 0) {
        // chain the next batch; same pending UI stays on
        setTimeout(() => backfillMut.mutate(), 0)
      }
    },
    onError: (err) => console.error('[mirror-backfill] client', err),
  })

  // keyframes injection (idempotent). Fonts come from <link> in __root.tsx.
  useEffect(() => {
    if (document.getElementById('mirror-kf')) return
    const s = document.createElement('style')
    s.id = 'mirror-kf'
    s.textContent = `
      @keyframes mirror-orbit { to { transform: rotate(360deg); } }
      @keyframes mirror-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      @keyframes mirror-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes mirror-pulse-dot { 0%,100% { transform: scale(1); opacity:.9 } 50% { transform: scale(1.4); opacity:.5 } }
      .mirror-shell { color-scheme: light }
      .mirror-tile { position: relative; overflow: hidden; }
      .mirror-tile:active { transform: scale(.97) !important; transition: transform .1s ease; }
      .mirror-world-tile { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
      .mirror-cross-bar { transition: transform .2s ease, box-shadow .2s ease, filter .2s ease; transform-origin: bottom center; }
      .mirror-cross-bar-wrap { cursor: pointer; }
      .mirror-cross-bar-wrap:hover .mirror-cross-bar { transform: scaleY(1.08); filter: brightness(1.2); }
      @media (prefers-reduced-motion: reduce) {
      }
    `
    document.head.appendChild(s)
  }, [])

  // Headline uses tiered ranking so the user's poured-out stories always
  // outrank reactions/browsing:
  //   tier 1 — patterns with any spill or scan signal
  //   tier 2 — comments-only patterns
  //   tier 3 — browse/likes/follows-only patterns
  // Within a tier, most recent last_seen (list is already ordered) wins.
  function countOf(p: MirrorPatternView, k: string): number {
    return Number((p.sources ?? {})[k] ?? 0)
  }
  const tier1 = list.filter((p) => countOf(p, 'spill') + countOf(p, 'scan') > 0)
  const tier2 = list.filter((p) => countOf(p, 'spill') + countOf(p, 'scan') === 0 && countOf(p, 'comments') > 0)
  const tier3 = list.filter((p) => countOf(p, 'spill') + countOf(p, 'scan') + countOf(p, 'comments') === 0)
  const mostRecent = (tier1[0] ?? tier2[0] ?? tier3[0] ?? list[0]) ?? null

  // Aggregate across the whole roster — these numbers show that the mirror
  // is growing with the user, not the per-pattern counter.
  const aggregateSignals = list.reduce((a, p) => a + Number(p.count ?? 0), 0)

  const [revealing, setRevealing] = useState(false)
  const [animateHero, setAnimateHero] = useState(false)
  const [heroTick, setHeroTick] = useState(0)
  useEffect(() => {
    if (!mostRecent) return
    const today = new Date().toISOString().slice(0, 10)
    const key = `mirror_seen_${mostRecent.id}`
    const seen = localStorage.getItem(key)
    const fullReveal = seen !== today
    setRevealing(fullReveal)
    setAnimateHero(true)
    if (fullReveal) {
      try { localStorage.setItem(key, today) } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostRecent?.id, heroTick])
  const replay = () => {
    setRevealing(true)
    setAnimateHero(false)
    requestAnimationFrame(() => { setAnimateHero(true); setHeroTick((t) => t + 1) })
  }

  // district jump
  const sectionRefs = useRef<Record<District, HTMLElement | null>>({
    self: null, career: null, love: null, family: null, social: null,
  })
  const jumpDistrict = (d: District) => {
    const el = sectionRefs.current[d]
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top, behavior: 'smooth' })
  }

  // detail overlay
  const [openCard, setOpenCard] = useState<MirrorPatternView | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const heroTiltRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  // share sheet
  const [shareTarget, setShareTarget] = useState<{ p: MirrorPatternView; source: 'hero' | 'overlay' } | null>(null)
  // cast filter
  const [castFilter, setCastFilter] = useState<'all' | District | 'ruins'>('all')

  // hero cursor tilt
  useEffect(() => {
    const el = heroTiltRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
      const rx = Math.max(-1, Math.min(1, -dy)) * 9
      const ry = Math.max(-1, Math.min(1, dx)) * 10
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`
        const gx = ((e.clientX - r.left) / r.width) * 100
        const gy = ((e.clientY - r.top) / r.height) * 100
        el.style.setProperty('--glare-x', `${gx}%`)
        el.style.setProperty('--glare-y', `${gy}%`)
        el.style.setProperty('--glare-o', '.35')
      })
    }
    const onLeave = () => {
      cancelAnimationFrame(raf)
      el.style.transform = 'perspective(1100px) rotateX(0) rotateY(0)'
      el.style.setProperty('--glare-o', '0')
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [mostRecent?.id])

  // group by district
  const grouped = useMemo(() => {
    const acc: Record<District, MirrorPatternView[]> = { self: [], career: [], love: [], family: [], social: [] }
    for (const p of list) acc[p.district].push(p)
    return acc
  }, [list])

  // location hash → optional district scroll
  useEffect(() => {
    const h = (location.hash || '').replace('#', '')
    if (DISTRICTS.includes(h as District)) {
      setTimeout(() => jumpDistrict(h as District), 200)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash])

  return (
    <div className="mirror-shell" style={{
      position: 'relative',
      minHeight: '100vh',
      background: BG,
      color: INK,
    }}>
      {/* the same core surface as `/` — joke cards, then the mirror read */}
      <JokeSurface />
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 22px 80px' }}>

        {/* hero zone */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 13,
            color: MUTED, letterSpacing: '.02em',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#a52a5f',
              boxShadow: '0 0 10px #a52a5f', animation: 'mirror-pulse-dot 1.8s ease-in-out infinite',
            }} />
            your most recent reading
          </div>
          <Words as="h1" style={{
            margin: '8px auto 0', maxWidth: 760,
            fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontWeight: 500,
            fontSize: 'clamp(28px, 4.4vw, 40px)', lineHeight: 1.15, color: INK,
          }}>the mirror remembers you better than you do.</Words>
        </div>

        {isLoading && (
          <p style={{
            textAlign: 'center', fontFamily: "'Newsreader',serif", fontStyle: 'italic',
            color: MUTED, marginTop: 28,
          }}>gathering your memory…</p>
        )}

        {!isLoading && isForming && !autoDemo && !showDemo && (
          <Forming
            onSpill={() => navigate('/#spill')}
            onScan={() => navigate('/#scan')}
            onPreview={() => setShowDemo(true)}
            hasDemo={demoList.length > 0}
            previewing={false}
            showBackfill={isSignedIn}
            backfillPending={backfillMut.isPending}
            onBackfill={() => backfillMut.mutate()}
          />
        )}

        {!isLoading && isExample && (
          <section style={{
            marginTop: 22, marginBottom: 6, padding: '14px 18px', borderRadius: 16,
            background: SURFACE, boxShadow: CARD_SHADOW,
            border: `.5px solid ${BORDER}`, color: INK,
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: "'Sora',sans-serif", fontSize: 10, fontWeight: 700,
                letterSpacing: '.28em', color: GOLD, marginBottom: 4,
              }}>STILL FORMING</div>
              <div style={{
                fontFamily: "'Newsreader',serif", fontStyle: 'italic',
                color: MUTED, fontSize: 14, lineHeight: 1.35,
              }}>this is an example reading — yours fills in the moment you spill or scan.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/#spill')} style={{
                background: '#a52a5f', color: '#fff', border: 0, borderRadius: 999,
                padding: '9px 16px', fontFamily: "'Sora',sans-serif", fontWeight: 700,
                fontSize: 12, cursor: 'pointer',
              }}>🫧 spill →</button>
              <button onClick={() => navigate('/#scan')} style={{
                background: 'transparent', color: GOLD,
                border: `.5px solid ${GOLD_HEX}66`, borderRadius: 999,
                padding: '9px 16px', fontFamily: "'Sora',sans-serif", fontWeight: 700,
                fontSize: 12, cursor: 'pointer',
              }}>✨ scan →</button>
            </div>
          </section>
        )}


        {/* hero card */}
        {mostRecent && (
          <div style={{ display: 'grid', placeItems: 'center', marginTop: 8 }}>
            {isExample && (
              <div style={{
                marginBottom: 10, padding: '4px 12px', borderRadius: 999,
                border: `.5px solid ${GOLD_HEX}88`, color: GOLD,
                background: `${GOLD_HEX}14`,
                fontFamily: "'Sora',sans-serif", fontSize: 10, fontWeight: 700,
                letterSpacing: '.28em',
              }}>EXAMPLE</div>
            )}
            <Reveal fx="zoom">
              <div
                ref={heroTiltRef}
                style={{
                  width: 'min(440px, 92vw)', margin: '0 auto',
                  position: 'relative', transformStyle: 'preserve-3d',
                  transition: 'transform .2s ease',
                } as React.CSSProperties}
              >
                <div ref={heroRef} style={{ position: 'relative' }}>
                  <TarotCard p={mostRecent} animate={animateHero} totalSignalsOverride={aggregateSignals} />
                  {revealing && <DeckBack onDone={() => setRevealing(false)} />}
                </div>
              </div>
            </Reveal>

            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <ActionPill onClick={replay} ariaLabel="Replay reveal">
                ↻ replay
              </ActionPill>
              <ActionPill tone="primary" onClick={() => setShareTarget({ p: mostRecent, source: 'hero' })} ariaLabel="Share this card">
                ↗ share
              </ActionPill>
              {list.length > 1 && (isEntitled || isExample) && (
                <ActionPill onClick={() => setOpenCard(list[Math.floor(Math.random() * list.length)])} ariaLabel="Draw another">
                  🎴 draw another
                </ActionPill>
              )}
            </div>
          </div>
        )}

        {showDemo && (
          <div style={{
            marginTop: 18, padding: '8px 14px', borderRadius: 12, textAlign: 'center',
            background: `${GOLD_HEX}1a`, color: GOLD, border: `.5px solid ${GOLD_HEX}55`,
            fontFamily: "'Sora',sans-serif", fontSize: 10.5, letterSpacing: '.22em',
          }}>ILLUSTRATIVE — NOT YOUR DATA · <button onClick={() => setShowDemo(false)} style={{ background: 'transparent', border: 0, color: GOLD, cursor: 'pointer', textDecoration: 'underline' }}>hide</button></div>
        )}

        {/* Free-tier lock: one reading (the hero card above) is shown fully;
            everything below is covered as a blurred mosaic with a single
            unlock button. Owner demo + active subscribers see the full
            Mirror. Server decides entitlement — see getMirrorEntitlement. */}
        {!isEntitled && !isExample && mostRecent ? (
          <section aria-label="Locked Mirror layers" style={{
            marginTop: 32, position: 'relative', borderRadius: 20, overflow: 'hidden',
            border: `.5px solid ${BORDER}`,
            background: SURFACE, boxShadow: CARD_SHADOW,
          }}>
            <div aria-hidden style={{
              filter: 'blur(14px) saturate(1.1)', opacity: .55,
              pointerEvents: 'none', userSelect: 'none',
              display: 'grid', gap: 14, padding: 24,
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  height: 140, borderRadius: 14,
                  background: 'linear-gradient(155deg, var(--surface-2), #fff 70%)',
                  border: `.5px solid ${BORDER}`,
                }} />
              ))}
            </div>
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              padding: '32px 20px', textAlign: 'center',
            }}>
              <div>
                <div style={{
                  fontFamily: "'Sora',sans-serif", fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '.28em', color: GOLD, marginBottom: 10,
                }}>THE REST OF YOU</div>
                <p style={{
                  margin: '0 0 18px', maxWidth: 480,
                  fontFamily: "'Newsreader',serif", fontStyle: 'italic',
                  fontSize: 22, lineHeight: 1.25, color: INK,
                }}>your world, cross-reads, movement markers, reflective questions and the speak channel unlock with the mirror.</p>
                <button
                  onClick={async () => {
                    const { requireRealUser } = await import('@/lib/auth-guard')
                    if (!(await requireRealUser({ kind: 'subscribe' }))) return
                    navigate('/subscribe')
                  }}
                  style={{
                    background: '#a52a5f', color: '#fff', border: 0, borderRadius: 999,
                    padding: '12px 22px', fontFamily: "'Sora',sans-serif", fontWeight: 700,
                    fontSize: 13, cursor: 'pointer', letterSpacing: '.05em',
                    boxShadow: '0 12px 28px -12px rgba(231,84,138,.6)',
                  }}
                >unlock the mirror →</button>
                <div style={{
                  marginTop: 10, fontFamily: "'Newsreader',serif", fontStyle: 'italic',
                  color: MUTED, fontSize: 13,
                }}>crisis support stays free, always.</div>
              </div>
            </div>
          </section>
        ) : (
          <>
        {/* your world */}
        {list.length > 0 && (
          <>
            <h2 style={{
              marginTop: 36, marginBottom: 0,
              fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontWeight: 500,
              fontSize: 22, color: INK, textAlign: 'center',
            }}>your world</h2>
            <WorldBand patterns={list} onJump={jumpDistrict} />
          </>
        )}

        {/* cross-read */}
        {list.length >= 2 && <CrossReadPanel patterns={list} />}

        {/* the cast */}
        {list.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
              <h2 style={{
                margin: 0, fontFamily: "'Newsreader',serif", fontStyle: 'italic',
                fontWeight: 500, fontSize: 24, color: INK,
              }}>the cast</h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
                {(['all', ...DISTRICTS, 'ruins'] as const).map((k) => {
                  const active = castFilter === k
                  const isDistrict = (DISTRICTS as readonly string[]).includes(k as string)
                  const c = isDistrict ? DISTRICT_COLOR[k as District] : k === 'ruins' ? RUIN_HEX : '#a52a5f'
                  const label = k === 'all' ? 'all' : k === 'ruins' ? 'ruins' : DISTRICT_LABEL[k as District].toLowerCase()
                  return (
                    <button key={k} onClick={() => setCastFilter(k)} style={{
                      cursor: 'pointer', borderRadius: 999,
                      padding: '6px 12px',
                      background: active ? `${c}33` : 'transparent',
                      border: `.5px solid ${active ? `${c}aa` : BORDER}`,
                      fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 10.5,
                      letterSpacing: '.18em', textTransform: 'uppercase',
                      color: active ? INK : MUTED,
                    }}>
                      {isDistrict && <span style={{ color: c, marginRight: 6 }}>{DISTRICT_SIGIL[k as District]}</span>}
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            {DISTRICTS.map((d) => {
              const items = grouped[d].filter((p) => {
                if (castFilter === 'all') return true
                if (castFilter === 'ruins') return p.state === 'ruin'
                return castFilter === d
              })
              if (items.length === 0) return null
              const color = DISTRICT_COLOR[d]
              return (
                <section
                  key={d}
                  ref={(el) => { sectionRefs.current[d] = el }}
                  style={{ marginTop: 32, scrollMarginTop: 80 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 999,
                      background: `${color}1f`, border: `.5px solid ${color}55`,
                      fontFamily: "'Sora',sans-serif", fontSize: 10.5, fontWeight: 700,
                      letterSpacing: '.22em', color: INK, textTransform: 'uppercase',
                    }}>
                      <span style={{ color, fontSize: 13 }}>{DISTRICT_SIGIL[d]}</span>
                      {DISTRICT_LABEL[d]}
                    </span>
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}55, transparent)` }} />
                    <span style={{
                      fontFamily: "'Newsreader',serif", fontStyle: 'italic',
                      fontSize: 13, color: MUTED_2,
                    }}>{items.length} here</span>
                  </div>
                  <div style={{
                    display: 'grid', gap: 14,
                    gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))',
                  }}>
                    {items.map((p) => (
                      <MiniCard key={p.id} p={p} onOpen={() => setOpenCard(p)} />
                    ))}
                  </div>
                </section>
              )
            })}
          </section>
        )}
          </>
        )}

        {/* footer */}
        <footer style={{ marginTop: 56, textAlign: 'center', paddingTop: 28, borderTop: '.5px solid rgba(11,8,15,.08)' }}>
          <p style={{
            margin: 0, fontFamily: "'Newsreader',serif", fontStyle: 'italic',
            fontSize: 15, color: MUTED, maxWidth: 540, marginLeft: 'auto', marginRight: 'auto',
          }}>the mirror reflects, asks, and encourages. it never judges, advises, or decides.</p>
          <div style={{
            marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <EyeMark w={22} />
            <ShutapWordmark size={12} ink={INK} accent="#a52a5f" letterSpacing="-.02em" />
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: MUTED_2, display: 'inline-block' }} />
            <span style={{
              fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 9,
              letterSpacing: '.28em', textTransform: 'uppercase', color: MUTED_3,
            }}>THE MIRROR</span>
          </div>
        </footer>
      </main>

      {openCard && (
        <div ref={overlayRef}>
          <DetailOverlay
            p={openCard}
            onClose={() => setOpenCard(null)}
            onShare={(p) => setShareTarget({ p, source: 'overlay' })}
          />
        </div>
      )}

      {shareTarget && (
        <MirrorShareSheet
          open
          onClose={() => setShareTarget(null)}
          pattern={shareTarget.p}
          defaultCaption={`"${shareTarget.p.punch || shareTarget.p.insight}" — ${shareTarget.p.name} · shutap mirror`}
          fileName={`mirror-${shareTarget.p.name.toLowerCase().replace(/\s+/g, '-')}.png`}
          renderCard={() => <TarotCard p={shareTarget.p} animate={false} />}
        />
      )}
    </div>
  )
}
