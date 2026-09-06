import { createFileRoute } from '@tanstack/react-router'
import { ogImageMeta } from "@/lib/seo/meta";
import { DocLayout } from '@/components/site/DocLayout'
import { SITE_URL } from '@/lib/site'

const URL = `${SITE_URL}/privacy`
const TITLE = 'Privacy Policy — Shutap'
const DESCRIPTION =
  'How Shutap protects your privacy: pseudonymous by design, identifiers scrubbed before storage, AI via the Lovable AI Gateway, no training on your content.'

export const Route = createFileRoute('/privacy')({
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
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <DocLayout
      active="/privacy"
      title="Privacy Policy"
      subline="Effective: September 6, 2026 · Controller: Shutap"
    >
      <h3>1. Our approach.</h3>
      <p>
        Shutap is built to be pseudonymous and privacy-protective. You write under a pseudonym, and
        our Scrubber automatically removes personal identifiers (names, addresses, specific
        locations, phone numbers, emails) from what you write <b>before it is stored</b> — we keep
        only the scrubbed version.
      </p>

      <h3>2. What we collect.</h3>
      <ul>
        <li>
          <b>Account:</b> a pseudonym, your email (for sign-in and check-ins), timezone,
          notification preferences, consent records.
        </li>
        <li>
          <b>Content:</b> the situations you type, the cards you turn over, your stories and
          check-in responses — stored <b>only in scrubbed (de-identified) form</b>. Cards you leave
          face down are never stored. As a guest, your cards are not stored at all until you choose
          an alias.
        </li>
        <li>
          <b>Daily allowance counters:</b> how many sets and cards were written today, keyed to your
          account or, for guests, to a random browser session id we store in your browser, plus a
          non-reversible hash of your network address for coarse rate limiting. Counters are
          per-day and hold no content.
        </li>
        <li>
          <b>Usage:</b> analytics about how you use the app (via PostHog), tied to a pseudonymous
          ID, not your name.
        </li>
        <li>
          <b>Device/technical:</b> standard log/device data.
        </li>
      </ul>

      <h3>3. How we use it.</h3>
      <p>
        To write your cards and run the community and companion; to deliver check-ins; to enforce
        daily allowances and rate limits; to provide the Mirror (for subscribers: a private record
        built from the cards you turn over while signed in, and the patterns across them); to
        produce <b>aggregated, de-identified</b> insights
        (&ldquo;what usually happens when…&rdquo;); to keep the service safe; and to comply with
        law. <b>We do not sell your personal information.</b>
      </p>

      <h3>4. AI processing.</h3>
      <p>
        Your situations and messages are processed by AI models (Google&rsquo;s Gemini, accessed
        through the Lovable AI Gateway) to scrub identifying details, to check for crisis content,
        to write the cards, and to generate companion and Mirror responses. These are generated
        automatically and are for entertainment, support and reflection only.{' '}
        <b>We do not use your content to train AI models</b>, and we send it to these providers
        solely to generate your response.
      </p>

      <h3>5. Service providers (subprocessors).</h3>
      <p>
        Lovable / Supabase (hosting and database), Resend (transactional email), PostHog (product
        analytics), and Google (Gemini, via the Lovable AI Gateway, for AI responses). Each
        processes data only to provide its service.
      </p>

      <h3>6. Legal/safety disclosure.</h3>
      <p>
        We may disclose information where required by law (e.g., valid legal process) or to prevent
        imminent harm. Crisis-flagged content is kept private, excluded from public display and
        from our aggregated corpus, and is never sold or monetized.
      </p>

      <h3>7. Retention.</h3>
      <p>
        We keep your data while your account is active and as needed for the purposes above; you
        can delete your content or account at any time (Section 9). Daily allowance counters are
        kept per day and are not tied to content. A guest&rsquo;s scrubbed situation is kept only
        so the set can be written and, if the guest later chooses an alias, claimed.
      </p>

      <h3>8. Security.</h3>
      <p>
        We use reasonable technical and organizational measures to protect your data. No system is
        perfectly secure. In the event of a breach affecting your personal data, we will notify you
        and authorities as required by applicable law.
      </p>

      <h3>9. Your rights.</h3>
      <p>
        Depending on where you live (including under <b>GDPR</b> and{' '}
        <b>California&rsquo;s CCPA/CPRA</b>), you may have the right to access, correct, delete,
        export (port), object to, or restrict processing of your personal data, and to withdraw
        consent.{' '}
        <b>
          You can delete your stories and your account, and request a data export, from Account
          &amp; Data settings
        </b>
        , or by emailing privacy@shutap.com. We do not sell personal information, so there is
        nothing to opt out of in that respect. We will not discriminate against you for exercising
        these rights.
      </p>

      <h3>10. Children.</h3>
      <p>
        Shutap is for adults <b>18+</b>. We do not knowingly collect data from anyone under 18; if
        we learn we have, we delete it.
      </p>

      <h3>11. International transfers.</h3>
      <p>
        If you access Shutap from outside the United States, your data may be processed in the U.S.
        and other countries where our providers operate. Where required, we rely on Standard
        Contractual Clauses and equivalent safeguards for transfers of personal data out of the
        EEA, UK, and Switzerland.
      </p>

      <h3>12. Cookies.</h3>
      <p>
        We use essential cookies needed to sign you in and keep the service secure, plus
        privacy-preserving analytics (via PostHog) to understand how the app is used. Where
        required (e.g., in the EU/UK), we show a consent banner and load non-essential cookies only
        after you agree.
      </p>

      <h3>13. Changes &amp; contact.</h3>
      <p>
        We&rsquo;ll post updates with a new effective date, and notify you in-app of material
        changes. Questions or requests: privacy@shutap.com.
      </p>
    </DocLayout>
  )
}
