import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ogImageMeta } from "@/lib/seo/meta";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles/global.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { GlobalHeader } from "@/components/GlobalHeader";

import { CompanionBubble } from "@/components/CompanionBubble";
import { useNavigate } from "@/compat/router";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Shutap — joke about it. your life, as a comedy set." },
      {
        name: "description",
        content:
          "type whatever just happened to you — family, work, exes, strangers. shutap writes it into a set of joke cards, every angle on the same mess. pseudonymous.",
      },
      { name: "author", content: "Shutap" },
      { property: "og:site_name", content: "Shutap" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://shutap.com" },
      { property: "og:title", content: "SHUTAP. Joke about it." },
      {
        property: "og:description",
        content:
          "type the thing that's living in your head. shutap turns it into a set. pseudonymous.",
      },
      ...ogImageMeta(),
      { name: "twitter:title", content: "SHUTAP. Joke about it." },
      {
        name: "twitter:description",
        content: "life's a bitch. so make fun of it.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon-48.png" },
      { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "@id": "https://shutap.com/#app",
          name: "Shutap",
          alternateName: "SHUTAP. Joke about it.",
          applicationCategory: "EntertainmentApplication",
          operatingSystem: "Web",
          url: "https://shutap.com",
          image: "https://shutap.com/og/shutap-og.png",
          description:
            "Shutap turns a personal story — a family comment that landed wrong, a partner who took someone else's side, a manager who made it weird, a friend who keeps doing the thing — into a set of joke cards, each taking a different comedic angle on the same situation, the way a comedian works one bad night into a routine. Pseudonymous. Identifying details are stripped before storage. Shutap makes jokes about situations, never about the person telling the story, and it does not give advice.",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            description:
              "Free to use. The Mirror subscription is $7.99/month or $49.99/year.",
          },
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === '/';

  useEffect(() => {
    // Kick off PostHog import ASAP so bouncy visitors still get page_view
    // + Pageleave. Non-blocking; idempotent via memoized promise.
    void import("@/lib/posthog").then((m) => m.initPostHog());
    let mounted = true
    const run = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { initPostHog } = await import("@/lib/posthog");
      const { recordVisitOnce, syncProfileFromSession, trackEvent } = await import("@/lib/tracking");
      let lastUserId: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          await supabase.auth.signInAnonymously();
          const { data: after } = await supabase.auth.getSession();
          lastUserId = after.session?.user?.id ?? null;
        } else {
          lastUserId = data.session.user?.id ?? null;
        }
        const u = (await supabase.auth.getSession()).data.session?.user;
        // Fire tracking after the session settles so profile ties to the
        // real user id when they're already signed in.
        void initPostHog();
        void recordVisitOnce(window.location.pathname);
        void syncProfileFromSession(u as never);
        void trackEvent("page_view", { path: window.location.pathname });
      } catch (e) {
        console.warn("[auth] anonymous bootstrap failed", e);
      }
      if (!mounted) return;
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        const nextId = session?.user?.id ?? null;
        if (nextId === lastUserId) return;
        lastUserId = nextId;
        const u = session?.user as { is_anonymous?: boolean } | undefined;
        if (event === "SIGNED_IN" && u && !u.is_anonymous) {
          void syncProfileFromSession(session?.user as never, { login: true });
          const provider = (session?.user?.app_metadata as { provider?: string } | undefined)?.provider ?? "email";
          void trackEvent("sign_in", { provider });
        }
        queueMicrotask(() => {
          if (!mounted) return;
          router.invalidate();
          if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
        });
      });
      (RootComponent as unknown as { _unsub?: () => void })._unsub = () => sub.subscription.unsubscribe();
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const handle: number = ric
      ? ric(() => { void run(); }, { timeout: 1500 })
      : (window.setTimeout(() => { void run(); }, 0) as unknown as number);
    // Fire page_view on every route change (initial page_view fires from run() above).
    let lastPath = window.location.pathname;
    const unsubNav = router.subscribe('onResolved', () => {
      const p = window.location.pathname;
      if (p === lastPath) return;
      lastPath = p;
      void import('@/lib/tracking').then(({ trackEvent }) => trackEvent('page_view', { path: p }));
    });
    return () => {
      mounted = false;
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(handle); else window.clearTimeout(handle);
      unsubNav();
      (RootComponent as unknown as { _unsub?: () => void })._unsub?.();
    };
  }, [router, queryClient]);


  return (
    <QueryClientProvider client={queryClient}>
      
      <GlobalHeader />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <CompanionBubble onOpen={() => {
        if (window.location.pathname === '/') {
          const trigger = document.querySelector('[data-comp-action="open"]') as HTMLElement | null
          if (trigger) {
            trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          } else {
            window.location.hash = 'ask'
          }
        } else {
          navigate('/#ask')
        }
      }} />

    </QueryClientProvider>
  );
}
