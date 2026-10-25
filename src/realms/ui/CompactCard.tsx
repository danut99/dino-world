import type { ReactNode } from 'react';
import './ui-kit.css';

export type CompactCardProps = {
  /** Slotul din stânga: iconiță, portret, sprite (≈40 px). */
  art?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Valoare scurtă în dreapta (preț, nivel, timer) — font pixel. */
  value?: ReactNode;
  /** Acțiune în dreapta (de ex. un `.realm-button`). Dacă există, cardul nu mai e el însuși buton. */
  action?: ReactNode;
  /** Face tot cardul clicabil (randat ca `<button>` când nu are `action`). */
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Ton de accent pentru bordura din stânga. */
  tone?: 'default' | 'good' | 'warn' | 'rare' | 'locked';
  className?: string;
  /** Tooltip / etichetă accesibilă suplimentară. */
  hint?: string;
};

/** Card dens pe un rând: [art] titlu/subtitlu [valoare][acțiune]. Bun pentru liste paginate cu `usePager`. */
export function CompactCard({ art, title, subtitle, value, action, onClick, active, disabled, tone = 'default', className = '', hint }: CompactCardProps) {
  const classes = `ui-card${active ? ' active' : ''}${disabled ? ' disabled' : ''}${tone !== 'default' ? ` tone-${tone}` : ''} ${className}`;
  const body = (
    <>
      {art !== undefined && <span className="ui-card-art">{art}</span>}
      <span className="ui-card-text">
        <strong className="ui-card-title">{title}</strong>
        {subtitle !== undefined && <small className="ui-card-subtitle">{subtitle}</small>}
      </span>
      {(value !== undefined || action !== undefined) && (
        <span className="ui-card-side">
          {value !== undefined && <span className="ui-card-value">{value}</span>}
          {action}
        </span>
      )}
    </>
  );
  if (onClick && action === undefined) {
    return (
      <button type="button" className={classes} onClick={onClick} disabled={disabled} aria-pressed={active} title={hint}>
        {body}
      </button>
    );
  }
  return (
    <div className={classes} title={hint} aria-disabled={disabled || undefined}>
      {body}
    </div>
  );
}
