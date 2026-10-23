"use client";
import { useMemo, type ComponentProps } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

// All workspace sections use the same authenticated client shell and loaded data.
// Next's native History integration updates pathname/search hooks without an RSC trip.
function navigateWorkspace(href: string, replace = false, scroll = true) {
  const current = new URL(window.location.href);
  const next = new URL(href, current);
  const base = current.pathname.match(/^\/(demo|workspace)(?:\/|$)/)?.[1];
  if (
    !base ||
    next.origin !== current.origin ||
    !(next.pathname === `/${base}` || next.pathname.startsWith(`/${base}/`))
  )
    return false;
  if (!window.dispatchEvent(new Event("lifehq:navigate", { cancelable: true })))
    return true;
  window.history[replace ? "replaceState" : "pushState"](
    null,
    "",
    next.pathname + next.search + next.hash,
  );
  if (scroll && current.pathname !== next.pathname) window.scrollTo(0, 0);
  return true;
}

export function useWorkspaceRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push(href: string, options?: Parameters<typeof router.push>[1]) {
        if (!navigateWorkspace(href, false, options?.scroll !== false))
          router.push(href, options);
      },
      replace(href: string, options?: Parameters<typeof router.replace>[1]) {
        if (!navigateWorkspace(href, true, options?.scroll !== false))
          router.replace(href, options);
      },
    }),
    [router],
  );
}

export function WorkspaceLink({
  href,
  ...props
}: Omit<ComponentProps<typeof NextLink>, "onNavigate">) {
  return (
    <NextLink
      {...props}
      href={href}
      prefetch={false}
      onNavigate={(event) => {
        if (
          typeof href === "string" &&
          navigateWorkspace(href, false, props.scroll !== false)
        )
          event.preventDefault();
      }}
    />
  );
}
