import { useEffect } from 'react';

/** Publish how much of the layout viewport the software keyboard covers.
 *
 * iOS Safari does not shrink the layout viewport when the keyboard opens — it
 * scrolls the page instead — so a composer pinned to the bottom of a `100dvh`
 * shell ends up behind the keyboard. `visualViewport` is the only thing that
 * reports the real visible area, so the overlap is measured from it and
 * written to the `--keyboard-inset` custom property, which `.keyboard-aware`
 * consumes.
 *
 * No-ops on browsers without `visualViewport`, and on desktop, where the value
 * stays at zero. */
export function useVisualViewport(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    if (!viewport) return;

    let frame: number | null = null;

    const sync = () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        // Distance between the bottom of the visible area and the bottom of
        // the layout viewport. `offsetTop` covers the case where the page has
        // been scrolled up to keep the focused field in view.
        const covered =
          window.innerHeight - viewport.height - viewport.offsetTop;
        // Ignore sub-pixel noise and the address-bar shrink, which is small
        // and shouldn't shift the composer.
        const inset = covered > 24 ? Math.round(covered) : 0;
        root.style.setProperty('--keyboard-inset', `${inset}px`);
      });
    };

    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
