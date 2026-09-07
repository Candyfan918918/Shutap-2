import { createFileRoute } from "@tanstack/react-router";
import { ogImageMeta } from "@/lib/seo/meta";
import { DocLayout } from "@/components/site/DocLayout";
import { SITE_URL } from "@/lib/site";

const URL = `${SITE_URL}/legal`;
const TITLE = "Legal & policies — Shutap";
const DESCRIPTION =
  "Hub for Shutap's legal and policy documents: how it works, FAQ, terms (with plans and daily limits), privacy, community guidelines, safety, AI disclosure, and the medical / legal disclaimer.";

type Item = { href: string; label: string; sub: string };

const ITEMS: Item[] = [
  {
    href: "/how-it-works",
    label: "How it works",
    sub: "you type it, shutap writes three cards, you turn over one. what\u2019s free, what a membership buys, and how the daily deck works.",
  },
  {
    href: "/faq",
    label: "FAQ",
    sub: "how many a day, what gets kept when you sign in, what the mirror is, how to delete everything.",
  },
  {
    href: "/terms",
    label: "Terms of Service",
    sub: "what shutap is and isn\u2019t, daily limits and what a membership buys, your content and the cards, AI use, billing, eligibility (18+).",
  },
  {
    href: "/privacy",
    label: "Privacy Policy",
    sub: "pseudonymous by design, identifiers scrubbed before storage, no sale of your data.",
  },
  {
    href: "/guidelines",
    label: "Community Guidelines",
    sub: "how to keep shutap a safe place to be honest \u2014 the short version, in our voice.",
  },
  {
    href: "/safety",
    label: "Crisis & Safety",
    sub: "we\u2019re not a crisis service. real, human help \u2014 right now.",
  },
  {
    href: "/contact",
    label: "Contact",
    sub: "a real person reads every message \u2014 hello, privacy, safety, or legal.",
  },
  {
    href: "/ai-disclosure",
    label: "AI Disclosure",
    sub: "what the ai is, that it can be wrong, and which models power it.",
  },
  {
    href: "/disclaimer",
    label: "Medical / Legal Disclaimer",
    sub: "formal and in-voice: shutap doesn\u2019t provide medical, mental-health, or legal advice.",
  },
];

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      ...ogImageMeta(),
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESCRIPTION,
          url: URL,
        }),
      },
    ],
  }),
  component: LegalHub,
});

function LegalHub() {
  return (
    <DocLayout
      active="/legal"
      title="Legal & policies"
      subline="everything you need to know about how shutap works, in one place."
    >
      <p>
        shutap is 18+, pseudonymous, and not a medical or legal service. these documents lay out
        the ground rules and how we protect you. pick the one you need — or read them all.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "20px 0 4px" }}>
        {ITEMS.map((c) => (
          <a
            key={c.href}
            href={c.href}
            style={{
              textDecoration: "none",
              background: "#fff",
              border: ".5px solid rgba(11,8,15,.1)",
              borderRadius: 14,
              padding: "15px 17px",
              display: "block",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "Sora,sans-serif",
                  fontWeight: 700,
                  fontSize: 14.5,
                  color: "#0b080f",
                }}
              >
                {c.label}
              </div>
              <div
                style={{
                  fontFamily: "Sora,sans-serif",
                  fontSize: 13,
                  color: "#c1216b",
                  whiteSpace: "nowrap",
                }}
              >
                read →
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: "#443c42",
                marginTop: 4,
              }}
            >
              {c.sub}
            </div>
          </a>
        ))}
      </div>
    </DocLayout>
  );
}
