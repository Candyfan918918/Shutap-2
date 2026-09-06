import { createFileRoute } from '@tanstack/react-router'
import { ogImageMeta } from "@/lib/seo/meta";
import { HomePage } from '@/pages/home/HomePage'
import { HOME_FAQ } from '@/pages/home/HomeFAQ'
import { SITE_URL } from '@/lib/site'
import { countOpenRooms } from '@/lib/rooms-count.functions'
import { listNewestRooms } from '@/lib/newest-rooms.functions'

const HOME_TITLE = "Shutap — Joke Cards from Whatever Just Happened"
const HOME_DESCRIPTION =
  "Type what just happened — work, exes, family, strangers. Shutap turns it into a set of joke cards, every comedic angle. pseudonymous."
const HOME_OG_DESCRIPTION =
  "Type what just happened — work, exes, family, strangers. Shutap turns it into a set of joke cards, every comedic angle. pseudonymous."

const HOME_URL = `${SITE_URL}/`

export const Route = createFileRoute('/')({
  headers: () => ({
    'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
  }),
  loader: async () => {
    const [openRooms, newestRooms] = await Promise.all([
      countOpenRooms().catch(() => 0),
      listNewestRooms().catch(() => []),
    ])
    return { openRooms, newestRooms }
  },
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_OG_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: HOME_URL },
      ...ogImageMeta(),
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESCRIPTION },
    ],
    links: [
      { rel: "canonical", href: HOME_URL },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: HOME_FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),

  component: HomeRouteComponent,
})

function HomeRouteComponent() {
  const { openRooms, newestRooms } = Route.useLoaderData()
  return <HomePage openRoomsCount={openRooms} newestRooms={newestRooms} />
}
