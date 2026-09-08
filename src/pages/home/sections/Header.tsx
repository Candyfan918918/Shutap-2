/* Section: HomeHeader — byte-for-byte port of /tmp/bundle/template.html.
 * Every data-* hook preserved verbatim so mountImmersive drives interactivity.
 * The right-side CTA is auth-aware: signed-in users see their profile chip,
 * everyone else sees the "join →" pill. */
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentAlias } from '@/hooks/use-current-alias'

function HomeHeaderCta() {
  const { alias } = useCurrentAlias()
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const u = data.session?.user
      const anon = Boolean((u as { is_anonymous?: boolean } | undefined)?.is_anonymous)
      setSignedIn(Boolean(u && !anon))
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return
      const u = session?.user
      const anon = Boolean((u as { is_anonymous?: boolean } | undefined)?.is_anonymous)
      setSignedIn(Boolean(u && !anon))
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  if (!ready) {
    return <span aria-hidden style={{ display: 'inline-block', width: 88, height: 34 }} />
  }

  if (signedIn) {
    return (
      <Link
        to="/profile"
        data-link="/profile"
        data-hover=""
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#fff',
          border: '.5px solid rgba(11,8,15,.12)',
          borderRadius: 999,
          padding: '5px 12px 5px 5px',
          color: '#0b080f',
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#a52a5f,#890041)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 14,
            flex: 'none',
          }}
        >
          {alias?.emoji || '🐣'}
        </span>
        <span style={{ fontFamily: 'Newsreader,serif', fontStyle: 'italic', fontSize: 13, color: '#0b080f' }}>
          {alias?.name || 'you'}
        </span>
      </Link>
    )
  }

  return (
    <a
      href="/welcome"
      data-link="/welcome"
      data-hover=""
      data-mag=""
      style={{
        display: 'inline-block',
        fontFamily: "'Sora',sans-serif",
        fontWeight: '700',
        fontSize: '13px',
        color: '#fff',
        background: '#0b080f',
        borderRadius: '999px',
        padding: '11px 22px',
        transition: 'background .3s',
      }}
    >
      join →
    </a>
  )
}

export function HomeHeader() {
  return (
    <>
            {/* ══ HEADER ══ */}
            <header data-hdr="" style={{ position: 'fixed', top: '0', left: '0', right: '0', zIndex: '50', transition: 'background .35s,box-shadow .35s' }}>
              {' '}
              <div style={{ maxWidth: '1560px', margin: '0 auto', padding: '20px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                {' '}
                <a href="/" data-link="/" data-hover="" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'inherit' }}>
                  {' '}
                  <span style={{ width: '34px', height: '24px', display: 'block', animation: 'eblink 3.4s infinite', transformOrigin: 'center' }}>
                    {' '}
                    <svg viewBox="0 0 140 96" fill="none" style={{ display: 'block', width: '100%', height: '100%' }}>
                      {' '}
                      <rect x="16" y="6" width="56" height="84" rx="28" fill="url(#eyeG2)" />
                      {' '}
                      <rect x="84" y="6" width="56" height="84" rx="28" fill="url(#eyeG2)" />
                      {' '}
                      <ellipse cx="44" cy="62" rx="19" ry="24" fill="url(#pupG2)" />
                      {' '}
                      <ellipse cx="112" cy="62" rx="19" ry="24" fill="url(#pupG2)" />
                      {' '}
                    </svg>
                    {' '}
                  </span>
                  {' '}
                  <span data-brandword="" style={{ fontFamily: '\'Sora\',sans-serif', fontWeight: '800', fontSize: '20px', letterSpacing: '-.04em', color: '#0b080f', transition: 'color .4s' }}>
                    shut
                    <span style={{ color: '#a52a5f' }}>
                      ap
                    </span>
                  </span>
                  {' '}
                </a>
                {' '}
                <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {' '}
                  {/* Primary hierarchy links, crawlable from the homepage so the
                      pillars sit one hop from the root. Hidden under 1080px so
                      the immersive mobile header keeps its original shape. */}
                  <style>{`@media (max-width: 1080px){[data-home-nav-wide]{display:none !important}}`}</style>
                  <span data-home-nav-wide="" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {[
                      { href: '/relationships', label: 'relationships' },
                      { href: '/marriage', label: 'marriage' },
                      { href: '/family', label: 'family' },
                      { href: '/career', label: 'career' },
                      { href: '/how-it-works', label: 'how it works' },
                    ].map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        data-link={l.href}
                        data-hover=""
                        data-navlink=""
                        style={{ fontFamily: '\'Newsreader\',serif', fontStyle: 'italic', fontSize: '15px', color: '#443c42', padding: '8px 10px', transition: 'color .4s' }}
                      >
                        {l.label}
                      </a>
                    ))}
                  </span>
                  {' '}
                  <a href="/stream" data-link="/stream" data-hover="" data-navlink="" style={{ fontFamily: '\'Newsreader\',serif', fontStyle: 'italic', fontSize: '15px', color: '#443c42', padding: '8px 14px', transition: 'color .4s' }}>
                    rooms
                  </a>
                  {' '}
                  <a href="/halls" data-link="/halls" data-hover="" data-navlink="" style={{ fontFamily: '\'Newsreader\',serif', fontStyle: 'italic', fontSize: '15px', color: '#443c42', padding: '8px 14px', transition: 'color .4s' }}>
                    halls
                  </a>
                  {' '}
                  <HomeHeaderCta />
                  {' '}
                </nav>
                {' '}
              </div>
            </header>
    </>
  )
}
