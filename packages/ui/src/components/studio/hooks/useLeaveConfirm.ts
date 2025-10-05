import { useEffect } from "react";
import { useRouter } from "next/navigation";

function isModifiedClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}
function findAnchor(el: EventTarget | null): HTMLAnchorElement | null {
  let node = el as HTMLElement | null;
  while (node && node !== document.body) {
    if (node instanceof HTMLAnchorElement) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Intercepts:
 *  - Anchor / <Link> clicks (same-origin)
 *  - Browser back/forward (popstate)
 * Also keeps the native beforeunload guard for hard reload/close.
 */
export function useLeaveConfirm(enabled: boolean, message = "You have unsaved changes. Leave this page?") {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const onClick = (e: MouseEvent) => {
      if (!enabled || e.defaultPrevented || isModifiedClick(e)) return;
      const a = findAnchor(e.target);
      if (!a || !a.href) return;

      // ignore new tab/window
      if (a.target && a.target !== "_self") return;

      // Same origin = in-app navigation
      const url = new URL(a.href);
      const sameOrigin = url.origin === location.origin;
      if (!sameOrigin) return; // let external links go; they’ll trigger beforeunload anyway

      // If navigating to the same URL (hash change), skip
      if (url.pathname + url.search === location.pathname + location.search && url.hash !== location.hash) {
        return;
      }

      e.preventDefault();
      const ok = window.confirm(message);
      if (ok) {
        // proceed programmatically
        router.push(url.pathname + url.search + url.hash);
      }
    };

    const onPopState = (e: PopStateEvent) => {
      if (!enabled) return;
      const ok = window.confirm(message);
      if (!ok) {
        // cancel the back/forward by pushing the current URL again
        history.pushState(null, "", location.href);
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.returnValue = ""; // required for Chrome
    };

    document.addEventListener("click", onClick, true); // capture phase to beat Next's Link
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, message, router]);
}
