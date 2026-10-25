import './ui-kit.css';

export type PagerProps = {
  /** Pagina curentă, de la 0 (ca în `usePager`). */
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
  /** 0 = română (implicit), 1 = engleză — pentru etichetele accesibile. */
  lang?: number;
  /** Se ascunde când e o singură pagină (implicit da). */
  hideSingle?: boolean;
  className?: string;
};

/** Control compact „‹ 1/3 ›”. Se leagă direct de `usePager`: `<Pager page={p.page} pages={p.pages} onPrev={p.prev} onNext={p.next} />`. */
export function Pager({ page, pages, onPrev, onNext, lang = 0, hideSingle = true, className = '' }: PagerProps) {
  if (hideSingle && pages <= 1) return null;
  const tr = (ro: string, en: string) => (lang ? en : ro);
  return (
    <nav className={`ui-pager ${className}`} aria-label={tr('Pagini', 'Pages')}>
      <button type="button" className="ui-pager-step" onClick={onPrev} disabled={page <= 0} aria-label={tr('Pagina anterioară', 'Previous page')}>
        ‹
      </button>
      <span className="ui-pager-count" aria-live="polite">
        {page + 1}/{pages}
      </span>
      <button type="button" className="ui-pager-step" onClick={onNext} disabled={page >= pages - 1} aria-label={tr('Pagina următoare', 'Next page')}>
        ›
      </button>
    </nav>
  );
}
