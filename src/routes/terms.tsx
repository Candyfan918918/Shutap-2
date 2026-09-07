import { createFileRoute } from '@tanstack/react-router'
import { ogImageMeta } from "@/lib/seo/meta";
import { DocLayout } from '@/components/site/DocLayout'
import { SITE_URL } from '@/lib/site'

const URL = `${SITE_URL}/terms`
const TITLE = 'Terms of Service — Shutap'
const DESCRIPTION =
  'Terms for using Shutap, a pseudonymous entertainment service that writes joke cards from what you type — what Shutap is and isn\u2019t, daily limits, what a membership buys, your content, AI use, and liability.'

export const Route = createFileRoute('/terms')({
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
  component: TermsPage,
})

function TermsPage() {
  return (
    <DocLayout
      active="/terms"
      title="Terms of Service"
      subline="Effective: September 6, 2026 · Operator: Shutap"
    >
      <h3>1. What Shutap is — and is not.</h3>
      <p>
        Shutap is a pseudonymous entertainment service. You type a situation, identifying details
        are removed, and an AI writes you a set of three humorous &ldquo;joke cards&rdquo; about
        that situation. Signed-in users may keep the cards they turn over, share them, post them to
        rooms, and (as members) have a private record of them read back by the
        &ldquo;Mirror.&rdquo;{' '}
        <b>Shutap is not a healthcare, medical, mental-health, crisis, or legal service.</b> Using
        Shutap does not create a therapist–patient, physician–patient, attorney–client, or any
        other professional relationship. Nothing on Shutap — including anything our AI companion or
        the &ldquo;Mirror&rdquo; says — is medical, psychological, or legal advice, diagnosis, or
        treatment. Do not use Shutap as a substitute for professional care.
      </p>

      <h3>2. Emergencies.</h3>
      <p>
        Shutap is not for emergencies. If you or someone else may be in danger or crisis, contact
        emergency services (in the US, call or text <b>988</b> or call <b>911</b>) or the resources
        at findahelpline.com. Our companion will route you to these resources, but it cannot and
        does not provide crisis intervention.
      </p>

      <h3>3. Eligibility.</h3>
      <p>
        You must be <b>18 or older</b> to use Shutap. By using it you represent that you are 18+.
      </p>

      <h3>4. Your account and pseudonym.</h3>
      <p>
        You use Shutap under a pseudonym; your real name is not displayed. We do not guarantee
        anonymity against lawful legal process (e.g., a valid subpoena) and may disclose information
        where legally required (see Privacy Policy). You are responsible for activity under your
        account.
      </p>

      <h3>5. Your content, and the cards.</h3>
      <p>
        You own what you write. By submitting a situation, you grant us a non-exclusive, worldwide,
        royalty-free license to host, store, de-identify, display (where you choose to make content
        public), and use de-identified content to operate and improve the service, including
        aggregated, de-identified insights. The cards are generated for you from your situation;
        you may keep, save, share and post the cards you turn over for personal, non-commercial
        use, with or without the shutap mark according to your plan (Section 9). Cards you leave
        face down are not stored and are not yours to claim later. You represent that your content is yours to share and does not
        violate anyone&rsquo;s rights.{' '}
        <b>
          Do not post other people&rsquo;s private or identifying information; do not post unlawful,
          infringing, harassing, or harmful content
        </b>{' '}
        (see Community Guidelines).
      </p>

      <h3>6. AI-generated content.</h3>
      <p>
        Shutap&rsquo;s cards, companion and Mirror are powered by artificial intelligence. Cards
        and responses are generated automatically,{' '}
        <b>may be inaccurate, incomplete, or inappropriate, and must not be relied upon</b> for any
        decision. They are for reflection and support only, are provided &ldquo;as is,&rdquo; and
        are not the advice of any professional. You use AI features at your own discretion and risk.
      </p>

      <h3>7. Acceptable use.</h3>
      <p>
        You agree not to: post others&rsquo; personal/identifying information; harass, threaten, or
        abuse; post illegal content (including any sexual content involving minors); impersonate;
        spam; scrape or misuse the service or its AI; attempt to de-anonymize other users; or use
        Shutap to provide professional services to others. We may remove content and suspend
        accounts that violate these terms.
      </p>

      <h3>8. Reporting and takedown.</h3>
      <p>
        You can report content via the in-product report tools. We review reports and remove content
        that violates these terms or the law, and we maintain a path for individuals to request
        removal of content about them.
      </p>

      <h3 id="plans">9. Free use, daily limits, and what a membership buys.</h3>
      <p>
        <b>Free, always:</b> typing one situation a day. A guest turns over one of its three cards;
        the other two stay face down until an alias is chosen. A signed-in free alias turns over all
        three cards of its situation, keeps them in its set list and the Mirror&rsquo;s record, and may
        save them (1080&times;1920, with a small shutap mark), share them, and post them to a room.
        Guests keep nothing until they choose an alias, at which point the card they had turned over
        comes with them.
      </p>
      <p>
        <b>Membership:</b> a paid subscription adds three situations a day instead of one; exports
        with no mark at 2160&times;3840; the whole set saved in one tap; and the Mirror&rsquo;s
        patterns across everything kept. A membership buys room and pixels. It does not buy advice,
        diagnosis, treatment, or relief, and it does not change what the jokes are.
      </p>
      <p>
        <b>Limits:</b> daily allowances reset once a day in the timezone stored on your account
        (UTC for guests). When a day&rsquo;s allowance is spent, no set is written and nothing is
        charged against it. Allowances are a cost control, not a promise: we may change, reduce, or
        suspend them, including per-network rate limits, to keep the service running, and we may
        refuse to write a set for any situation that our safety systems flag. A card that was
        generated is not refunded to the allowance if you choose not to turn it over.
      </p>

      <h3 id="refunds">10. Subscriptions, billing &amp; refunds.</h3>
      <p>
        Membership features (Section 9, including the &ldquo;Mirror&rdquo;) require a paid
        subscription: <b>US$7.99 per month or US$49.99 per year</b>, plus any applicable taxes.{' '}
        <b>There is no free trial; the first period is charged when you subscribe.</b>{' '}
        Subscriptions renew automatically each billing period at the price shown at checkout (plus
        any applicable taxes) until cancelled. We email a receipt for every charge. You can cancel anytime from your profile or the
        billing portal; cancellation takes effect at the end of the current billing period, and you
        keep access until then. <b>Payments already made — for the current or past periods — are
        not refunded</b>, except where a refund is required by applicable law. Cancelling returns
        you to the free allowance (one situation a day, one card) at the end of the period; the
        cards you kept stay in your set list. Typing one situation a day and turning over one card
        remain free.
      </p>

      <h3>11. Assumption of risk.</h3>
      <p>
        Shutap involves user-generated emotional content and AI-generated jokes and responses. You
        understand and accept that such content may be upsetting, inaccurate, unfunny, or unhelpful,
        that a joke about your situation is still a joke about your situation, and you use the
        service at your own risk.
      </p>

      <h3>12. Disclaimers.</h3>
      <p>
        The service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
        warranties of any kind, express or implied, including fitness for a particular purpose and
        any warranty that the service or AI output is accurate, reliable, or suitable for your
        needs.
      </p>

      <h3>13. Limitation of liability.</h3>
      <p>
        To the maximum extent permitted by law, Shutap and its operators will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or for any reliance on
        AI output or user content; and our total liability will not exceed the greater of the
        amounts you paid us in the past 12 months or <b>US$100</b>.
      </p>

      <h3>14. Indemnification.</h3>
      <p>
        You agree to indemnify Shutap against claims arising from your content or your violation of
        these terms.
      </p>

      <h3>15. Termination.</h3>
      <p>You may delete your account anytime. We may suspend or terminate access for violations.</p>

      <h3>16. Dispute resolution &amp; governing law.</h3>
      <p>
        Before filing any claim, you agree to first contact us at legal@shutap.com and try to
        resolve it informally for at least 30 days. Any dispute that cannot be resolved that way
        will be settled by <b>binding individual arbitration</b>, not in court — except that either
        party may bring an individual claim in small-claims court. You and Shutap{' '}
        <b>waive any right to a jury trial and to participate in a class action</b> or class-wide
        arbitration. These terms are governed by the laws of the State of Delaware, USA, without
        regard to its conflict-of-laws rules; the exclusive venue for any matter not subject to
        arbitration is the state or federal courts located in Delaware.
      </p>

      <h3>17. Changes.</h3>
      <p>
        We may update these terms; material changes will be notified and re-accepted, with a new
        version stamp.
      </p>

      <h3>18. Contact.</h3>
      <p>legal@shutap.com.</p>

    </DocLayout>
  )
}
