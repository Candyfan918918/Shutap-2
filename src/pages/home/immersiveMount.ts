/* Reference-parity motion / demo loops mounted onto the immersive homepage
 * HTML. Adapted verbatim from the canonical design file (Shutap_Landing_v2). */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ImmersiveHooks {
  onCta: (kind: 'spill' | 'scan') => void
  onNav: (to: string) => void
  motion?: 'full' | 'calm'
  showPreloader?: boolean
}

export function mountImmersive(root: HTMLElement, hooks: ImmersiveHooks): () => void {
  const D = root
  const motion = hooks.motion ?? 'full'
  const showPre = hooks.showPreloader ?? false
  const cleanup: Array<() => void> = []
  const timers: Array<ReturnType<typeof setTimeout>> = []
  const intervals: Array<ReturnType<typeof setInterval>> = []
  const rafs: number[] = []
  const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, ev: K | string, fn: any, o?: any) => {
    t.addEventListener(ev as string, fn, o); cleanup.push(() => t.removeEventListener(ev as string, fn, o))
  }
  const sched = (fn: () => void, d: number) => { const id = setTimeout(fn, d); timers.push(id); return id }
  const q = <T extends Element = HTMLElement>(sel: string) => D.querySelector(sel) as T | null
  const qa = <T extends Element = HTMLElement>(sel: string) => Array.from(D.querySelectorAll(sel)) as T[]
  // Defer non-essential ambient loops (mascot rAF, demo intervals) until the
  // browser is idle, so hydration/first-paint aren't fighting them for CPU.
  const idle = (fn: () => void) => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(fn, { timeout: 2000 })
      cleanup.push(() => { try { w.cancelIdleCallback?.(id) } catch { /* noop */ } })
    } else {
      const id = setTimeout(fn, 200)
      timers.push(id)
    }
  }

  /* ── link + CTA delegation ── */
  on(D, 'click', (e: MouseEvent) => {
    const t = e.target as HTMLElement | null
    if (!t) return
    const cta = t.closest?.('[data-cta]') as HTMLElement | null
    if (cta) {
      e.preventDefault(); e.stopPropagation()
      const kind = cta.getAttribute('data-cta') as 'spill' | 'scan'
      hooks.onCta(kind); return
    }
    const lnk = t.closest?.('[data-link]') as HTMLElement | null
    if (lnk) {
      const href = lnk.getAttribute('data-link') || '/'
      if (href.startsWith('/')) { e.preventDefault(); hooks.onNav(href) }
    }
  })

  /* ── preloader ── */
  const pre = q('[data-pre]')
  const revealHero = () => { qa('[data-wr]').forEach((w) => { (w as HTMLElement).style.transform = 'translateY(0)' }) }
  const finishPre = () => {
    if (pre) { pre.style.opacity = '0'; pre.style.visibility = 'hidden'; sched(() => pre.remove(), 800) }
    revealHero()
  }
  if (pre && showPre && motion !== 'calm') {
    sched(finishPre, 1300)
  } else if (pre) {
    requestAnimationFrame(() => requestAnimationFrame(finishPre))
  } else {
    requestAnimationFrame(() => requestAnimationFrame(revealHero))
  }

  /* ── hero word initial hidden setup ── */
  const words = qa('[data-wr]')
  words.forEach((w, i) => {
    w.style.transform = 'translateY(115%)'
    w.style.transition = 'transform .9s cubic-bezier(.34,1.56,.64,1) ' + (i * 0.08) + 's'
  })

  /* ── mascot + parallax rAF ── */
  const pups = qa<SVGEllipseElement>('[data-pup]')
  const eyes = q('[data-heroeyes]')
  let mx = window.innerWidth / 2, my = window.innerHeight / 2, cx = mx, cy = my
  on(document, 'mousemove', (e: MouseEvent) => { mx = e.clientX; my = e.clientY })
  const demoCards = qa('[data-democard]').map((c) => c.firstElementChild as HTMLElement).filter(Boolean)
  demoCards.forEach((c) => { c.style.willChange = 'transform' })
  let sRX = 0, sRY = 0, vRX = 0, vRY = 0
  let eT = 0
  let raf = 0
  const loop = () => {
    cx += (mx - cx) * 0.14; cy += (my - cy) * 0.14
    if (eyes && pups.length && motion !== 'calm') {
      const r = eyes.getBoundingClientRect()
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2
      const dx = Math.max(-1, Math.min(1, (cx - ex) / (window.innerWidth / 2)))
      const dy = Math.max(-1, Math.min(1, (cy - ey) / (window.innerHeight / 2)))
      pups.forEach((p) => { (p as unknown as HTMLElement).style.transform = 'translate(' + (dx * 9) + 'px,' + (dy * 7) + 'px)' })
      const tRX = -dy * 12, tRY = dx * 16
      vRX += (tRX - sRX) * 0.06; vRY += (tRY - sRY) * 0.06
      vRX *= 0.86; vRY *= 0.86; sRX += vRX; sRY += vRY
      eT += 0.016
      const breathe = 1 + 0.035 * Math.sin(eT * 1.1)
      const lunge = Math.pow(Math.max(0, Math.sin(eT * 0.30)), 8) * 0.06
      const spin = Math.abs(vRX) + Math.abs(vRY)
      eyes.style.transform = 'perspective(650px) rotateX(' + sRX.toFixed(2) + 'deg) rotateY(' + sRY.toFixed(2) + 'deg) translateZ(' + ((spin * 14) + lunge * 130).toFixed(1) + 'px) scale(' + (breathe + lunge).toFixed(3) + ')'
      eyes.style.filter = 'drop-shadow(0 ' + (18 + lunge * 70).toFixed(0) + 'px ' + (34 + lunge * 60).toFixed(0) + 'px rgba(193,33,107,' + (0.30 + lunge * 0.35).toFixed(2) + '))'
    }
    if (motion !== 'calm') {
      demoCards.forEach((c) => {
        const r = c.getBoundingClientRect()
        if (r.bottom < -60 || r.top > window.innerHeight + 60) return
        const off = (r.top + r.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2)
        const k = Math.max(0, 1 - Math.abs(off))
        ;(c.style as any).scale = String((0.93 + k * 0.07).toFixed(3))
      })
    }
    raf = requestAnimationFrame(loop)
    rafs[0] = raf
  }
  idle(() => { raf = requestAnimationFrame(loop); rafs[0] = raf })


  /* ── word-level reveals ── */
  const splitWords = (el: Element) => {
    const walk = (node: Node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment()
          ;(ch.textContent || '').split(/(\s+)/).forEach((part) => {
            if (!part) return
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return }
            const s = document.createElement('span'); s.setAttribute('data-w', ''); s.style.display = 'inline-block'; s.textContent = part; frag.appendChild(s)
          })
          node.replaceChild(frag, ch)
        } else if (ch.nodeType === 1) walk(ch)
      })
    }
    walk(el)
    return Array.from(el.querySelectorAll('[data-w]')) as HTMLElement[]
  }
  qa('[data-words]').forEach((el) => {
    const ws = splitWords(el)
    const hide = () => ws.forEach((w) => { w.style.opacity = '0'; w.style.transform = 'translateY(.55em) scale(.9)' })
    ws.forEach((w, i) => { w.style.transition = 'opacity .45s ease ' + (i * 0.045) + 's, transform .7s cubic-bezier(.34,1.56,.64,1) ' + (i * 0.045) + 's' })
    hide()
    const iow = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) ws.forEach((w) => { w.style.opacity = '1'; w.style.transform = 'none' }); else hide() })
    }, { threshold: 0.35 })
    iow.observe(el); cleanup.push(() => iow.disconnect())
  })

  /* ── scroll reveals ── */
  const FX: Record<string, { from: string; ease: string; dur: string }> = {
    'swipe-l': { from: 'translateX(-44px)', ease: 'cubic-bezier(.34,1.56,.64,1)', dur: '.85s' },
    'swipe-r': { from: 'translateX(44px)',  ease: 'cubic-bezier(.34,1.56,.64,1)', dur: '.85s' },
    'zoom':    { from: 'scale(.9)',         ease: 'cubic-bezier(.34,1.56,.64,1)', dur: '.85s' },
    'pop':     { from: 'scale(.82) rotate(1.5deg)', ease: 'cubic-bezier(.34,1.56,.64,1)', dur: '.9s' },
    'default': { from: 'translateY(30px)',  ease: 'cubic-bezier(.34,1.56,.64,1)', dur: '.8s' },
  }
  const rvs = qa('[data-rv]')
  rvs.forEach((el) => {
    const fx = FX[el.getAttribute('data-rv') || ''] || FX['default']
    el.style.opacity = '0'; el.style.transform = fx.from
    el.style.transition = 'opacity ' + fx.dur + ' ' + fx.ease + ', transform ' + fx.dur + ' ' + fx.ease
  })
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      const el = en.target as HTMLElement
      if (en.isIntersecting) { el.style.opacity = '1'; el.style.transform = 'none' }
      else { const fx = FX[el.getAttribute('data-rv') || ''] || FX['default']; el.style.opacity = '0'; el.style.transform = fx.from }
    })
  }, { threshold: 0.18 })
  rvs.forEach((el) => io.observe(el)); cleanup.push(() => io.disconnect())

  /* ── demos: on-screen visibility helper ── */
  // Defaults to RUNNING and falls back to geometry: an unmeasurable viewport
  // counts as visible, so a demo never stalls off-screen forever.
  const vis = (el: Element | null) => {
    const s: { v: boolean } = { v: true }
    if (el) {
      try {
        const iov = new IntersectionObserver((en) => {
          const e = en[0]
          const r = e.boundingClientRect
          const unmeasurable = !r || (r.width === 0 && r.height === 0)
          s.v = unmeasurable ? true : e.isIntersecting
        }, { threshold: 0.15 })
        iov.observe(el)
        cleanup.push(() => iov.disconnect())
      } catch { s.v = true }
    }
    return s
  }


  /* ── 01 spill interview loop ── */
  const spSteps = qa('[data-sp]')
  if (spSteps.length) {
    const spVis = vis(spSteps[0].closest('section'))
    const runSpill = () => {
      if (!spVis.v) { sched(runSpill, 1000); return }
      spSteps.forEach((el) => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; const ty = el.querySelector('[data-type]') as HTMLElement | null; if (ty) ty.textContent = '' })
      let t = 700
      spSteps.forEach((el) => {
        const ty = el.querySelector('[data-type]') as HTMLElement | null
        sched(() => {
          el.style.opacity = '1'; el.style.transform = 'none'
          if (ty) {
            const full = ty.getAttribute('data-type') || ''; let i = 0
            const iv = setInterval(() => { i++; ty.textContent = full.slice(0, i); if (i >= full.length) clearInterval(iv) }, 26)
            intervals.push(iv)
          }
        }, t)
        t += ty ? 600 + (ty.getAttribute('data-type') || '').length * 26 + 650 : 1250
      })
      sched(runSpill, t + 3400)
    }
    idle(runSpill)
  }

  /* ── 02 scan flow ── */
  const arc = q<SVGCircleElement>('[data-arc]') as any
  const scanNum = q('[data-scannum]')
  const phs = qa('[data-scph]')
  if (phs.length) {
    const scVis = vis(phs[0].closest('section'))
    const picks = qa('[data-scpick]')
    const show = (i: number) => phs.forEach((p, j) => { p.style.opacity = j === i ? '1' : '0' })
    const pick = (c?: HTMLElement) => { if (c) { c.style.background = 'rgba(127,119,221,.25)'; c.style.borderColor = '#aaa3e8'; c.style.transform = 'scale(1.03)' } }
    const runScan = () => {
      if (!scVis.v) { sched(runScan, 1000); return }
      picks.forEach((c) => { c.style.background = 'rgba(255,255,255,.05)'; c.style.borderColor = 'rgba(255,255,255,.14)'; c.style.transform = 'none' })
      if (arc) { arc.style.transition = 'none'; arc.style.strokeDashoffset = '527.8' }
      const mark = q('[data-mark]') as HTMLElement | null
      if (mark) { mark.style.transition = 'none'; mark.style.left = '0%' }
      if (scanNum) scanNum.textContent = '0'
      show(0)
      sched(() => pick(picks[0]), 1300)
      sched(() => show(1), 2300)
      sched(() => pick(picks[1]), 3600)
      sched(() => show(2), 4600)
      sched(() => {
        show(3)
        if (arc) { arc.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1)'; requestAnimationFrame(() => { arc.style.strokeDashoffset = String(527.8 * (1 - 740 / 999)) }) }
        if (mark) { mark.style.transition = 'left 1.6s cubic-bezier(.16,1,.3,1)'; requestAnimationFrame(() => { mark.style.left = '74%' }) }
        const t0 = performance.now()
        const tick = (t: number) => { const p = Math.min(1, (t - t0) / 1500); if (scanNum) scanNum.textContent = String(Math.round(740 * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick) }
        requestAnimationFrame(tick)
      }, 6500)
      sched(runScan, 12200)
    }
    idle(runScan)
  }

  /* ── 03 mirror ── */
  const mcs = qa('[data-mc]')
  const mdots = qa('[data-mdot]')
  if (mcs.length) {
    let mi = 0
    const activate = (i: number) => {
      mcs.forEach((c, j) => {
        const on2 = j === i
        c.style.opacity = on2 ? '1' : '0'
        c.style.zIndex = on2 ? '2' : '1'
        const ring = c.querySelector('[data-mring]') as any
        const cnt = c.querySelector('[data-mcount]') as HTMLElement | null
        const spark = c.querySelector('[data-mspark]') as any
        // Never reset a displayed count to 0 — a background tab or a
        // non-compositing container must not leave a figure reading 0.
        if (cnt) cnt.textContent = cnt.getAttribute('data-n') || cnt.textContent || ''
        if (!on2) {
          if (ring) { ring.style.transition = 'none'; ring.style.strokeDashoffset = '289' }
          if (spark) { spark.style.transition = 'none'; spark.style.strokeDashoffset = '600' }
          return
        }
        // Commit the reset with a forced reflow rather than waiting on rAF,
        // so the transition still runs when rAF is paused.
        if (ring) {
          void ring.getBoundingClientRect()
          ring.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(.16,1,.3,1)'
          ring.style.strokeDashoffset = ring.getAttribute('data-off')
        }
        if (spark) {
          void spark.getBoundingClientRect()
          spark.style.transition = 'stroke-dashoffset 1.5s ease'
          spark.style.strokeDashoffset = '0'
        }
        if (cnt) {
          const target = +(cnt.getAttribute('data-n') || '0')
          if (target > 0) {
            const t0 = performance.now()
            const tick = (t: number) => {
              const p = Math.min(1, (t - t0) / 1200)
              cnt!.textContent = String(Math.max(1, Math.round(target * (1 - Math.pow(1 - p, 3)))))
              if (p < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }
        }

      })
      mdots.forEach((d, j) => { d.style.background = j === i ? '#c1a02b' : 'rgba(233,192,106,.28)' })
    }
    activate(0)
    const mVis = vis(mcs[0].closest('section'))
    idle(() => {
      const iv = setInterval(() => { if (!mVis.v) return; mi = (mi + 1) % mcs.length; activate(mi) }, 5200)
      intervals.push(iv)
    })
  }

  /* ── card tilt ── */
  const tilt = q('[data-tilt]')
  if (tilt && motion !== 'calm') {
    const sec = tilt.closest('section')
    if (sec) {
      on(sec, 'mousemove', (e: MouseEvent) => {
        const r = tilt.getBoundingClientRect()
        const x = (e.clientX - r.left - r.width / 2) / r.width
        const y = (e.clientY - r.top - r.height / 2) / r.height
        tilt.style.transform = 'perspective(900px) rotateY(' + (x * 4) + 'deg) rotateX(' + (-y * 4) + 'deg)'
        tilt.style.transition = 'transform .15s'
      })
      on(sec, 'mouseleave', () => { tilt.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)'; tilt.style.transform = 'perspective(900px) rotateY(0) rotateX(0)' })
    }
  }

  /* ── header ink over dark sections (geometry-based) ── */
  const brand = document.querySelector('[data-brandword]') as HTMLElement | null
  const navlinks = Array.from(document.querySelectorAll('[data-navlink]')) as HTMLElement[]
  const hdr = document.querySelector('[data-hdr]') as HTMLElement | null
  if (hdr) hdr.style.transition = 'background-color .3s ease, box-shadow .3s ease, color .3s ease'

  const HEADER_LINE = 44
  const darkSections = () => Array.from(document.querySelectorAll('[data-theme="dark"]')) as HTMLElement[]
  const isDarkBehind = (): boolean => {
    for (const s of darkSections()) {
      const r = s.getBoundingClientRect()
      if (r.top <= HEADER_LINE && r.bottom > HEADER_LINE) return true
    }
    return false
  }
  const onScroll = () => {
    const dark = isDarkBehind()
    if (brand) brand.style.color = dark ? '#fdfbf9' : '#0b080f'
    navlinks.forEach((a) => { a.style.color = dark ? '#f7b8d4' : '#443c42' })
    if (hdr) {
      // No backdrop-filter on purpose: a blurred fixed bar over the root
      // scroller flashes white and ghosts a second header on Windows/Chrome
      // during smooth scrolls. Near-opaque tint instead (same call as GlobalHeader).
      if (window.scrollY > 24) {
        hdr.style.background = dark ? 'rgba(16,12,20,.94)' : 'rgba(253,240,245,.96)'
        hdr.style.boxShadow = dark ? '0 1px 0 rgba(255,255,255,.08)' : '0 1px 0 rgba(11,8,15,.07)'
      } else {
        hdr.style.background = 'transparent'
        hdr.style.boxShadow = 'none'
      }

    }
  }
  on(document, 'scroll', onScroll, { passive: true })
  on(window, 'resize', onScroll)
  onScroll()


  /* ── drag-scroll rooms strip ── */
  const strip = q('[data-strip]') as HTMLElement | null
  if (strip) {
    let down = false, sx = 0, sl = 0, moved = false, vel = 0, lastX = 0, lastT = 0, momRaf = 0
    const cards = () => Array.from(strip.children) as HTMLElement[]
    const skew = (v: number) => { const s = Math.max(-6, Math.min(6, -v * 0.35)); cards().forEach((c) => { c.style.transform = 'skewX(' + s.toFixed(2) + 'deg)'; c.style.transition = 'transform .12s' }) }
    const unskew = () => { cards().forEach((c) => { c.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)'; c.style.transform = '' }) }
    on(strip, 'pointerdown', (e: PointerEvent) => { down = true; moved = false; sx = e.clientX; sl = strip.scrollLeft; lastX = e.clientX; lastT = performance.now(); vel = 0; cancelAnimationFrame(momRaf); strip.style.cursor = 'grabbing' })
    on(document, 'pointermove', (e: PointerEvent) => {
      if (!down) return
      const d = e.clientX - sx; if (Math.abs(d) > 4) moved = true
      strip.scrollLeft = sl - d
      const now = performance.now(), dt = Math.max(1, now - lastT)
      vel = (e.clientX - lastX) / dt * 16; lastX = e.clientX; lastT = now
      if (motion !== 'calm') skew(vel)
    })
    on(document, 'pointerup', () => {
      if (!down) return; down = false; strip.style.cursor = 'grab'; unskew()
      const glide = () => { if (Math.abs(vel) < 0.4) return; strip.scrollLeft -= vel; vel *= 0.94; momRaf = requestAnimationFrame(glide) }
      momRaf = requestAnimationFrame(glide)
    })
    on(strip, 'click', (e: MouseEvent) => { if (moved) { e.preventDefault(); e.stopPropagation() } }, true)
    cleanup.push(() => cancelAnimationFrame(momRaf))
    let auto = motion !== 'calm', autoRaf = 0
    on(strip, 'mouseenter', () => { auto = false; unskew() })
    on(strip, 'mouseleave', () => { auto = motion !== 'calm' })
    const autoTick = () => {
      const half = strip.scrollWidth / 2
      if (half > 0) { if (auto && !down) { strip.scrollLeft += 0.9; if (motion !== 'calm') skew(-1.4) }; if (strip.scrollLeft >= half) strip.scrollLeft -= half }
      autoRaf = requestAnimationFrame(autoTick)
    }
    autoRaf = requestAnimationFrame(autoTick)
    cleanup.push(() => cancelAnimationFrame(autoRaf))
  }

  /* live counter: real count is rendered server-side in Hero.tsx from the
   * route loader. No client-side random drift — the number is real or hidden. */

  /* ── companion sheet (bubble → sheet, canned reply) ── */
  const cRoot = q('[data-comp="root"]') as HTMLElement | null
  const cBack = q('[data-comp="back"]') as HTMLElement | null
  const cSheet = q('[data-comp="sheet"]') as HTMLElement | null
  const cLog = q('[data-comp="log"]') as HTMLElement | null
  const cInput = q('[data-comp="input"]') as HTMLTextAreaElement | null
  const compBubble = (text: string, mine: boolean) => {
    if (!cLog) return null
    const d = document.createElement('div')
    d.style.cssText = 'max-width:86%;padding:10px 14px;border-radius:16px;font-family:Newsreader,serif;font-style:italic;font-size:15px;line-height:1.55;' + (mine ? 'align-self:flex-end;background:#a52a5f;color:#fff;border-bottom-right-radius:5px' : 'align-self:flex-start;background:rgba(255,255,255,.07);color:#e9e4f6;border-bottom-left-radius:5px')
    d.textContent = text; cLog.appendChild(d); cLog.scrollTop = cLog.scrollHeight; return d
  }
  const openComp = () => {
    if (!cRoot) return
    cRoot.style.display = 'flex'
    requestAnimationFrame(() => { if (cBack) cBack.style.opacity = '1'; if (cSheet) { cSheet.style.transform = 'none'; cSheet.style.opacity = '1' } })
    if (cLog && !cLog.children.length) compBubble("i'm the companion. tell me what's going on — i can find you a room, help you spill, or just listen.", false)
    sched(() => { if (cInput) cInput.focus() }, 350)
  }
  const closeComp = () => {
    if (cBack) cBack.style.opacity = '0'
    if (cSheet) { cSheet.style.transform = 'translateY(30px)'; cSheet.style.opacity = '0' }
    sched(() => { if (cRoot) cRoot.style.display = 'none' }, 300)
  }
  const sendComp = () => {
    const v = (cInput?.value || '').trim(); if (!v || !cInput) return
    cInput.value = ''; compBubble(v, true)
    const hold = compBubble('…', false)
    sched(() => { if (hold) hold.textContent = "i hear you. that sounds like it's been sitting on you for a while. want me to find you a room for this, or would spilling it feel better?" }, 900)
  }
  on(D, 'click', (e: MouseEvent) => {
    const t = (e.target as HTMLElement | null)?.closest?.('[data-comp-action]') as HTMLElement | null
    if (!t) return
    const a = t.getAttribute('data-comp-action')
    if (a === 'open') openComp(); else if (a === 'close') closeComp(); else if (a === 'send') sendComp()
  })
  if (cBack) on(cBack, 'click', closeComp)

  return () => {
    rafs.forEach((r) => cancelAnimationFrame(r))
    timers.forEach((t) => clearTimeout(t)); intervals.forEach((i) => clearInterval(i))
    cleanup.forEach((f) => { try { f() } catch { /* noop */ } })
  }
}

