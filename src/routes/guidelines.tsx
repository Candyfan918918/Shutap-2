import { createFileRoute } from '@tanstack/react-router'
import { ogImageMeta } from "@/lib/seo/meta";
import { DocLayout } from '@/components/site/DocLayout'
import { SITE_URL } from '@/lib/site'

const URL = `${SITE_URL}/guidelines`
const TITLE = 'house rules — Shutap'
const DESCRIPTION =
  'the joke goes at the situation, not at a person. what\u2019s allowed here and what gets removed.'

export const Route = createFileRoute('/guidelines')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: URL },
      ...ogImageMeta(),
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
  component: GuidelinesPage,
})

function GuidelinesPage() {
  return (
    <DocLayout
      active="/guidelines"
      title="Community Guidelines"
      subline="the short version, in our own voice"
    >
      <div
        style={{
          background: '#fff',
          border: '.5px solid rgba(11,8,15,.08)',
          borderRadius: 18,
          padding: '22px 24px',
          marginTop: 18,
        }}
      >
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>this is a place to be heard. be real, be kind to each other.</li>
          <li>
            <b>don&rsquo;t post other people&rsquo;s private info</b> — names, addresses, anything
            that could identify someone. (we scrub a lot of this automatically, but don&rsquo;t
            try.)
          </li>
          <li>no harassment, threats, hate, or cruelty aimed at people.</li>
          <li>
            <b>the joke goes at the situation, never at a person.</b> a card you share carries your
            scrubbed situation with it — don&rsquo;t put the names back in the caption, and
            don&rsquo;t aim a card at someone who can be identified.
          </li>
          <li>
            one situation a day is the free deal (members get three). don&rsquo;t mint sessions or
            accounts to get around it — the deck is a cost, not a score.
          </li>
          <li>nothing illegal — and absolutely nothing sexual involving minors.</li>
          <li>don&rsquo;t impersonate, spam, or scrape.</li>
          <li>don&rsquo;t use shutap to sell services or give professional advice to others.</li>
          <li>
            see something that breaks this? <b>report it</b> — there&rsquo;s a button on every
            post.
          </li>
        </ul>
      </div>
      <p style={{ marginTop: 16 }}>We remove content and accounts that break these rules.</p>
    </DocLayout>
  )
}
