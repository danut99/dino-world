import { useCallback, useEffect, useMemo, useState } from 'react';

export type PagerOptions = {
  /** Minimum de elemente pe pagină, chiar dacă nu încap (implicit 1). */
  min?: number;
  /** Maximum de elemente pe pagină (ex. roster de 8), chiar dacă ar încăpea mai multe. */
  max?: number;
  /** Selectorul elementului măsurat în container; implicit primul copil. */
  itemSelector?: string;
  /** Câte elemente se arată până la prima măsurare (implicit `max` sau 12). */
  initial?: number;
};

export type Pager<T, E extends HTMLElement = HTMLDivElement> = {
  /** Ref-callback pentru containerul cu înălțime fixă (de ex. `.ui-paged` într-un `.fit-panel`). */
  ref: (node: E | null) => void;
  /** Pagina curentă, de la 0. */
  page: number;
  pages: number;
  perPage: number;
  pageItems: T[];
  next: () => void;
  prev: () => void;
  setPage: (page: number) => void;
};

const px = (value: string) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Câte elemente încap în container: măsoară primul element (lățime/înălțime) și spațiul liber al containerului
 * (fără padding, cu `gap`-ul din CSS) și împarte. Se recalculează la redimensionare (ResizeObserver).
 *
 * Containerul trebuie să aibă înălțime impusă din afară (grid/flex cu `min-height: 0`, `overflow: hidden`),
 * altfel înălțimea lui ar depinde de numărul de elemente și calculul ar oscila.
 */
export function usePager<T, E extends HTMLElement = HTMLDivElement>(items: readonly T[], options: PagerOptions = {}): Pager<T, E> {
  const { min = 1, max, itemSelector, initial } = options;
  const [node, setNode] = useState<E | null>(null);
  const [fit, setFit] = useState(() => initial ?? max ?? 12);
  const [page, setPageState] = useState(0);

  const hasItems = items.length > 0;
  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const item = (itemSelector ? node.querySelector<HTMLElement>(itemSelector) : (node.firstElementChild as HTMLElement | null)) ?? null;
      if (!item) return;
      const style = getComputedStyle(node);
      const width = node.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
      const height = node.clientHeight - px(style.paddingTop) - px(style.paddingBottom);
      const colGap = px(style.columnGap);
      const rowGap = px(style.rowGap);
      const box = item.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || width <= 0 || height <= 0) return;
      // Pentru flex pe rând (o singură linie) contează doar lățimea; pentru coloană doar înălțimea.
      const flexRow = style.display.includes('flex') && !style.flexDirection.startsWith('column') && style.flexWrap === 'nowrap';
      const flexCol = style.display.includes('flex') && style.flexDirection.startsWith('column') && style.flexWrap === 'nowrap';
      const cols = flexCol ? 1 : Math.max(1, Math.floor((width + colGap + 0.5) / (box.width + colGap)));
      const rows = flexRow ? 1 : Math.max(1, Math.floor((height + rowGap + 0.5) / (box.height + rowGap)));
      let count = Math.max(min, cols * rows);
      if (max !== undefined) count = Math.min(count, Math.max(min, max));
      setFit((prev) => (prev === count ? prev : count));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const first = itemSelector ? node.querySelector(itemSelector) : node.firstElementChild;
    if (first) observer.observe(first);
    return () => observer.disconnect();
  }, [node, itemSelector, min, max, hasItems]);

  const perPage = Math.max(1, fit);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, pages - 1);

  useEffect(() => {
    if (page !== current) setPageState(current);
  }, [page, current]);

  const setPage = useCallback((value: number) => setPageState(() => Math.max(0, Math.min(pages - 1, Math.floor(value)))), [pages]);
  const next = useCallback(() => setPageState((p) => Math.min(pages - 1, p + 1)), [pages]);
  const prev = useCallback(() => setPageState((p) => Math.max(0, Math.min(p, pages - 1) - 1)), [pages]);
  const pageItems = useMemo(() => items.slice(current * perPage, current * perPage + perPage), [items, current, perPage]);

  return { ref: setNode, page: current, pages, perPage, pageItems, next, prev, setPage };
}
