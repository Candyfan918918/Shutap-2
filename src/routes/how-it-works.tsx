import { createFileRoute } from "@tanstack/react-router";
import { ogImageMeta } from "@/lib/seo/meta";
import { ContentPage } from "@/components/seo/ContentPage";
import { SITE_URL } from "@/lib/site";
import { breadcrumbScript } from "@/lib/seo/breadcrumbs";

const PATH = "/how-it-works";
const TITLE = "How Shutap works — you type it, shutap writes the set";
const DESCRIPTION =
  "how a set gets written: you type what happened, identifying details are stripped, and shutap writes three joke cards at the situation — never at you. one situation a day is free; members get three, and all three cards.";
const CAPSULE =
  "every comedian you like does this on purpose: take the worst thing that happened and work it into a routine. you already have the material. shutap does the writing part.";
const SECTIONS = [
  {
    heading: "you type what happened",
    body: "One open box. No category to pick, no bar to clear. If it's still in your head at midnight, it's material. Press enter, or tap \u201cwrite my set\u201d.",
  },
  {
    heading: "identifying details come out first",
    body: "Before anything is stored, names, addresses, workplaces, phone numbers and emails are stripped. Only the scrubbed version is kept, and you write under a pseudonym.",
  },
  {
    heading: "shutap writes three cards, face down",
    body: "The take (what actually happened here), the clapback (what you wish you'd said) and the roast (the joke). They land face down, in a shuffled order, so the label is the only thing you choose by. You turn over one.",
  },
  {
    heading: "one situation a day is free \u2014 and one card of it",
    body: "Guests and free aliases get one situation a day and turn over one of its three cards. The other two stay face down; they are never written anywhere. The deck resets every day in your own timezone. When the day is spent, the box tells you so before it sends anything.",
  },
  {
    heading: "an alias keeps the card you turned over",
    body: "A fake name, thirty seconds, no password: an alias is what lets a card be saved, shared or posted, and it keeps the card you turned over in your set list. Free saves are 1080\u00d71920 with a small shutap mark in the corner.",
  },
  {
    heading: "members get three a day, and all three cards",
    body: "A membership buys room and pixels: three situations a day, all three cards of every set turned over, exports with no mark at 2160\u00d73840, the whole set saved in one tap, and the Mirror. It never buys advice, and it never buys relief.",
  },
  {
    heading: "the joke goes at the situation",
    body: "Never at you. Shutap doesn't make fun of your pain, doesn't diagnose you, and doesn't tell you what to do. If something is genuinely heavy, it stops joking and points you at real help.",
  },
  {
    heading: "and then it starts noticing",
    body: "Every card you keep goes into a private record. Keep enough and the same person, the same week of the month, the same move keeps showing up. That's the Mirror \u2014 the paid part that reads your own record back to you. It observes; it never diagnoses.",
  },
];
const OTHERS = [
  { href: "/subscribe", label: "What members get" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms#plans", label: "Plans & limits (terms)" },
  { href: "/about", label: "About" },
  { href: "/trust", label: "Trust & privacy" },
];

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}${PATH}` },
      ...ogImageMeta(),
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}${PATH}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "How Shutap works",
          description: DESCRIPTION,
          url: `${SITE_URL}${PATH}`,
        }),
      },
      breadcrumbScript([{ name: "How it works", path: PATH }]),
    ],
  }),
  component: () => (
    <ContentPage
      breadcrumbs={[{ name: "How it works", path: PATH }]}
      h1="how Shutap works"
      capsule={CAPSULE}
      sections={SECTIONS}
      others={OTHERS}
    />
  ),
});
