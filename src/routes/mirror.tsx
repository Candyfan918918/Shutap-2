import { createFileRoute } from '@tanstack/react-router'
import { MirrorPage } from '@/pages/Mirror'
import { SITE_URL } from '@/lib/site'

const TITLE = 'your mirror reading — Shutap'
const DESCRIPTION =
  "your most recent reading, and what keeps coming back. the mirror records what you've lived and reads it back to you."

export const Route = createFileRoute('/mirror')({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${SITE_URL}/mirror` },
      // Private, per-user surface: intentionally kept out of the index.
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: MirrorPage,
})
