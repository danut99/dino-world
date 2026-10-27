import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import './ui-kit.css';

export type TabItem<Id extends string = string> = {
  id: Id;
  label: ReactNode;
  /** Număr sau text scurt afișat ca insignă (ex. joburi gata). `0`/gol nu se afișează. */
  badge?: ReactNode;
  /** `busy`: ceva e în lucru acolo (tab portocaliu cu clepsidră); `ready`: ceva e gata de colectat (verde). */
  state?: 'busy' | 'ready';
  disabled?: boolean;
};

export type TabsProps<Id extends string = string> = {
  tabs: readonly TabItem<Id>[];
  active: Id;
  onChange: (id: Id) => void;
  /** Eticheta accesibilă a listei de taburi (ex. „Secțiuni incubator”). */
  label?: string;
  /** Prefix pentru id-uri; panoul asociat folosește `tabPanelId(idBase, id)`. Implicit, un id generat. */
  idBase?: string;
  className?: string;
};

export const tabButtonId = (idBase: string, id: string) => `${idBase}-tab-${id}`;
export const tabPanelId = (idBase: string, id: string) => `${idBase}-panel-${id}`;

/**
 * Bară de taburi accesibilă (WAI-ARIA tabs, activare automată): ←/→ (și ↑/↓) mută selecția, Home/End
 * sar la capete; doar tabul activ e în ordinea Tab.
 */
export function Tabs<Id extends string>({ tabs, active, onChange, label, idBase, className = '' }: TabsProps<Id>) {
  const generated = useId();
  const base = idBase ?? `tabs${generated.replace(/[^\w-]/g, '')}`;
  const listRef = useRef<HTMLDivElement>(null);

  const move = (from: number, step: number) => {
    const enabled = tabs.filter((t) => !t.disabled);
    if (!enabled.length) return;
    const current = tabs[from];
    const at = Math.max(0, enabled.indexOf(current));
    const next =
      step === Infinity
        ? enabled[enabled.length - 1]
        : step === -Infinity
          ? enabled[0]
          : enabled[(at + step + enabled.length) % enabled.length];
    onChange(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabButtonId(base, next.id))}`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      Home: -Infinity,
      End: Infinity,
    };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    move(index, step);
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} className={`ui-tabs ${className}`}>
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        const showBadge =
          tab.badge !== undefined && tab.badge !== null && tab.badge !== false && tab.badge !== 0 && tab.badge !== '';
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabButtonId(base, tab.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(base, tab.id)}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            className="ui-tab"
            data-state={tab.state}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.state === 'busy' && (
              <span className="ui-tab-hourglass" aria-hidden="true">
                ⏳
              </span>
            )}
            <span className="ui-tab-label">{tab.label}</span>
            {showBadge && <span className="ui-tab-badge">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Panoul unui tab; folosește același `idBase` ca `<Tabs>`. */
export function TabPanel({
  idBase,
  id,
  children,
  className = '',
}: {
  idBase: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(idBase, id)}
      aria-labelledby={tabButtonId(idBase, id)}
      className={`ui-tabpanel ${className}`}
    >
      {children}
    </div>
  );
}
