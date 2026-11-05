import { useEffect, useRef } from 'react';

export function useSplitScroll(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!enabled || !container) return;
    let frame = 0;
    let source: HTMLElement | null = null;
    const expected = new WeakMap<HTMLElement, number>();
    function onScroll(event: Event) {
      const element = event.target;
      if (!(element instanceof HTMLElement)) return;
      if (!element.matches('.cm-scroller, .local-preview')) return;
      const targetPosition = expected.get(element);
      expected.delete(element);
      // Ignore the event caused by our own scroll assignment, not real input.
      if (
        targetPosition !== undefined &&
        Math.abs(element.scrollTop - targetPosition) < 1
      )
        return;
      source = element;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!source) return;
        const target = container!.querySelector<HTMLElement>(
          source.matches('.cm-scroller')
            ? '.note-preview-pane .local-preview'
            : '.note-source-pane .cm-scroller',
        );
        if (!target || !source.clientHeight || !target.clientHeight) return;
        const range = source.scrollHeight - source.clientHeight;
        if (range <= 0) return;
        const progress = Math.max(0, Math.min(1, source.scrollTop / range));
        const top =
          progress * Math.max(0, target.scrollHeight - target.clientHeight);
        if (Math.abs(target.scrollTop - top) < 1) return;
        target.scrollTop = top;
        expected.set(target, target.scrollTop);
      });
    }
    container.addEventListener('scroll', onScroll, true);
    return () => {
      container.removeEventListener('scroll', onScroll, true);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return root;
}
