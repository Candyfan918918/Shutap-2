// Template registry. Each template pins its sender identity, subject,
// and full email-safe HTML design (loaded verbatim from src/lib/email/designs/
// via Vite `?raw`). Plain-text fallbacks live per template. All check-in
// beats share the spill-followup design shell and inject a one-line beat.

import welcomeHtml from './designs/welcome.html?raw'
import spillFollowupHtml from './designs/spill-followup.html?raw'
import scanFollowupHtml from './designs/scan-followup.html?raw'
import reengagementHtml from './designs/re-engagement.html?raw'
import magicLinkHtml from './designs/magic-link.html?raw'
import newReplyHtml from './designs/new-reply.html?raw'
import digestHtml from './designs/digest.html?raw'
import milestoneHtml from './designs/milestone.html?raw'
import popularTodayHtml from './designs/popular-today.html?raw'
import hallUpdatesHtml from './designs/hall-updates.html?raw'
import mirrorReceiptHtml from './designs/mirror-receipt.html?raw'
import mirrorCancelledHtml from './designs/mirror-cancelled.html?raw'
import mirrorTrialEndingHtml from './designs/mirror-trial-ending.html?raw'

import type { EmailClass, IdentityId } from './identities'

export type TemplateId =
  | 'welcome'
  | 'checkin_day1'
  | 'checkin_day2'
  | 'checkin_day3'
  | 'checkin_day7'
  | 'checkin_day14'
  | 'checkin_day30'
  | 'reengagement'
  | 'scan_followup'
  | 'magic_link'
  | 'new_reply'
  | 'digest'
  | 'milestone'
  | 'popular_today'
  | 'hall_updates'
  | 'mirror_receipt'
  | 'mirror_cancelled'
  | 'mirror_trial_ending'

export type TemplateVars = {
  alias?: string
  situation_hint?: string
  deep_link?: string
  unsubscribe_url?: string
  [key: string]: string | undefined
}

export type TemplateEntry = {
  id: TemplateId
  identity: IdentityId
  emailClass: EmailClass
  subject: (v: TemplateVars) => string
  preview: (v: TemplateVars) => string
  cta: string
  /** Full HTML document loaded from src/lib/email/designs/. */
  htmlDesign: string
  /**
   * For check-in variants: the one-line beat copy that replaces the
   * spill-followup shell's day-1 paragraph text.
   */
  beatLine?: string
  buildBodyText: (v: TemplateVars) => string
}

// Salutation for text fallbacks.
const g = (v: TemplateVars) => (v.alias ? `hey ${v.alias.toLowerCase()},` : 'hey,')

// Text-fallback builder for check-in beats — mirrors the previous copy.
const checkinText = (line: (v: TemplateVars) => string) => (v: TemplateVars) =>
  `${g(v)}\n\n${line(v)}\n\nopen the check-in: ${v.deep_link ?? ''}`

export const TEMPLATES: Record<TemplateId, TemplateEntry> = {
  welcome: {
    id: 'welcome',
    identity: 'hello',
    emailClass: 'transactional',
    subject: () => "you're in — finally, somewhere to not shut up",
    preview: () => "your space to say the thing you can't say anywhere else.",
    cta: 'start your first vent',
    htmlDesign: welcomeHtml,
    buildBodyText: (v) => `${g(v)}

you're in. no real names here — pseudonymous, a safe space. just a room full of people who've been where you are, and lived to tell what happened next.

start your first vent: ${v.deep_link ?? v.cta_url ?? 'https://shutap.com'}`,
  },

  checkin_day1: {
    id: 'checkin_day1',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => "how'd you sleep on it?",
    preview: () => 'been thinking about what you spilled.',
    cta: 'go back to your room',
    htmlDesign: spillFollowupHtml,
    beatLine: (`been thinking about {{situation_hint}}. how'd you sleep on it?`),
    buildBodyText: checkinText((v) => `been thinking about ${v.situation_hint || 'what you spilled'}. how'd you sleep on it?`),
  },
  checkin_day2: {
    id: 'checkin_day2',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => 'you good today?',
    preview: () => 'no pressure, just checking.',
    cta: 'go back to your room',
    htmlDesign: spillFollowupHtml,
    beatLine: `no pressure, just checking — you good today?`,
    buildBodyText: checkinText(() => `no pressure, just checking — you good today?`),
  },
  checkin_day3: {
    id: 'checkin_day3',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => 'ok be honest',
    preview: () => 'did you do anything or still stewing.',
    cta: 'go back to your room',
    htmlDesign: spillFollowupHtml,
    beatLine: `ok be honest — did you do anything or still stewing 😤`,
    buildBodyText: checkinText(() => `ok be honest — did you do anything or still stewing 😤`),
  },
  checkin_day7: {
    id: 'checkin_day7',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => 'where are things now?',
    preview: () => 'a week in.',
    cta: 'go back to your room',
    htmlDesign: spillFollowupHtml,
    beatLine: `a week in. where are things now?`,
    buildBodyText: checkinText(() => `a week in. where are things now?`),
  },
  checkin_day14: {
    id: 'checkin_day14',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => 'looking back — what happened?',
    preview: () => 'two weeks on.',
    cta: 'go back to your room',
    htmlDesign: spillFollowupHtml,
    beatLine: `two weeks on. looking back — what happened?`,
    buildBodyText: checkinText(() => `two weeks on. looking back — what happened?`),
  },
  checkin_day30: {
    id: 'checkin_day30',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => "still going? where's it at now?",
    preview: () => 'a month later.',
    cta: 'go back to your room',
    htmlDesign: spillFollowupHtml,
    beatLine: `a month later. still going? where's it at now?`,
    buildBodyText: checkinText(() => `a month later. still going? where's it at now?`),
  },

  reengagement: {
    id: 'reengagement',
    identity: 'hello',
    emailClass: 'nontransactional',
    subject: () => "the room's been quiet without you",
    preview: () => "no pressure. the door's still open.",
    cta: 'come back in',
    htmlDesign: reengagementHtml,
    buildBodyText: (v) => `${g(v)}

the room's been quiet without you. no pressure — whatever made you step away is welcome here too. but people showed up this week carrying stories that rhyme with yours.

come back in: ${v.deep_link ?? v.cta_url ?? 'https://shutap.com'}`,
  },

  scan_followup: {
    id: 'scan_followup',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => 'your scan, a day later — anything shift?',
    preview: () => 'a scan is a snapshot, not a sentence.',
    cta: 'scan it again',
    htmlDesign: scanFollowupHtml,
    buildBodyText: (v) => `${g(v)}

yesterday you scanned ${v.scan_topic || 'a situation'}. a day later — has anything shifted? a scan is a snapshot, not a sentence.

scan it again: ${v.rescan_url ?? v.deep_link ?? ''}
or spill it to the room: ${v.spill_url ?? ''}`,
  },

  magic_link: {
    id: 'magic_link',
    identity: 'hello',
    emailClass: 'transactional',
    subject: () => 'your sign-in link for shutap',
    preview: () => 'one-time link. works once, expires in 10 minutes.',
    cta: 'sign in to shutap',
    htmlDesign: magicLinkHtml,
    buildBodyText: (v) => `${g(v)}

tap the link below to sign in to shutap. it works once and expires in 10 minutes.

${v.magic_link ?? ''}

or use this code: ${v.code ?? ''}

didn't ask to sign in? you can ignore this — no one gets in without this link.`,
  },

  new_reply: {
    id: 'new_reply',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => "you're not the only one — someone related to your story",
    preview: () => "someone left their side of it.",
    cta: 'read what they said',
    htmlDesign: newReplyHtml,
    buildBodyText: (v) => `${g(v)}

your story in ${v.room_title || 'the room'} is finding people. ${v.replier_alias || 'someone'} left this: "${v.reply_snippet || ''}"

read what they said: ${v.cta_url ?? v.deep_link ?? ''}`,
  },

  digest: {
    id: 'digest',
    identity: 'hello',
    emailClass: 'nontransactional',
    subject: () => 'rooms that resonated this week',
    preview: () => 'the companion pulled a few rooms that sound like yours.',
    cta: 'open the stream',
    htmlDesign: digestHtml,
    buildBodyText: (v) => `${g(v)}

the companion pulled a few rooms this week that sound like they might be yours.

open the stream: ${v.cta_url ?? v.deep_link ?? 'https://shutap.com'}`,
  },

  milestone: {
    id: 'milestone',
    identity: 'hello',
    emailClass: 'engagement',
    subject: () => 'your story made the hall',
    preview: () => 'enough people found their omg same to land it in the hall of fame.',
    cta: 'see it in the hall',
    htmlDesign: milestoneHtml,
    buildBodyText: (v) => `${g(v)}

you were brave enough to say it out loud — and it landed. ${v.room_title || 'your story'} resonated with more people than almost anything shared this month. ${v.resonance_count || ''} people found their omg same in the ${v.hall_name || ''} hall.

see it in the hall: ${v.cta_url ?? v.deep_link ?? ''}`,
  },

  popular_today: {
    id: 'popular_today',
    identity: 'hello',
    emailClass: 'nontransactional',
    subject: () => "the room everyone's in today",
    preview: () => "one story is resonating harder than anything else right now.",
    cta: 'step into the room',
    htmlDesign: popularTodayHtml,
    buildBodyText: (v) => `${g(v)}

one story is resonating harder than anything else right now — ${v.room_title || 'the top room today'}.

step into the room: ${v.cta_url ?? v.deep_link ?? ''}`,
  },

  mirror_receipt: {
    id: 'mirror_receipt',
    identity: 'hello',
    emailClass: 'transactional',
    subject: (v) => `your mirror receipt — ${v.amount ?? ''}`.trim(),
    preview: () => 'payment received. the mirror stays open.',
    cta: 'view invoice',
    htmlDesign: mirrorReceiptHtml,
    buildBodyText: (v) => `${g(v)}

payment received — ${v.amount ?? ''} for the mirror (${v.plan_interval ?? ''}), covering ${v.period_range ?? ''}. tax included where it applies.

view your invoice: ${v.invoice_url ?? ''}`,
  },

  mirror_cancelled: {
    id: 'mirror_cancelled',
    identity: 'hello',
    emailClass: 'transactional',
    subject: (v) => `cancelled — the mirror stays open until ${v.access_until ?? 'the end of your period'}`,
    preview: () => 'no further charges. your scans are always yours.',
    cta: 'resume subscription',
    htmlDesign: mirrorCancelledHtml,
    buildBodyText: (v) => `${g(v)}

your cancellation went through. the mirror stays open until ${v.access_until ?? 'the end of your billing period'}, and there are no further charges after that. your scans are always yours. venting, scan & being heard stay free, always.

changed your mind? resume anytime: ${v.resume_url ?? 'https://shutap.com/subscribe'}`,
  },

  mirror_trial_ending: {
    id: 'mirror_trial_ending',
    identity: 'hello',
    emailClass: 'transactional',
    subject: (v) => `your trial ends ${v.trial_end ?? 'soon'} — no surprises`,
    preview: () => 'two days left. keep it or cancel — no surprises either way.',
    cta: 'open the mirror',
    htmlDesign: mirrorTrialEndingHtml,
    buildBodyText: (v) => `${g(v)}

we promised to tell you before anything is charged — this is that email. your free trial ends ${v.trial_end ?? 'soon'}. if the mirror's been useful, do nothing — your ${v.plan_interval ?? ''} plan (${v.amount ?? ''} + tax where it applies) starts then. not for you? cancel from your profile before then and you won't be charged a cent.

open the mirror: ${v.deep_link ?? 'https://shutap.com/mirror'}
manage or cancel: ${v.manage_url ?? 'https://shutap.com/profile'}`,
  },



  hall_updates: {
    id: 'hall_updates',
    identity: 'hello',
    emailClass: 'nontransactional',
    subject: () => 'new in the halls this week',
    preview: () => 'the stories that resonated most across shutap this week.',
    cta: 'wander the halls',
    htmlDesign: hallUpdatesHtml,
    buildBodyText: (v) => `${g(v)}

these stories resonated with more people than any others this week — the ones that made a room full of strangers feel a little less alone.

wander the halls: ${v.cta_url ?? v.deep_link ?? 'https://shutap.com/halls'}`,
  },
}
