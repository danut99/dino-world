import sheet from './icons.json';

export type IconName = keyof typeof sheet.icons;

/** Iconiță pixel din public/realms/ui/icons.png, la scară întreagă (1 px de artă = `scale` px CSS). */
export function Icon({ name, scale = 2, className = '' }: { name: IconName; scale?: 1 | 2 | 3 | 4; className?: string }) {
  const [x, y] = sheet.icons[name];
  const c = sheet.cell * scale;
  return (
    <span
      aria-hidden
      className={`px-icon ${className}`}
      style={{
        width: c,
        height: c,
        backgroundSize: `${sheet.cols * c}px ${sheet.rows * c}px`,
        backgroundPosition: `${-x * c}px ${-y * c}px`,
      }}
    />
  );
}

/** Iconița fiecărui element, în locul simbolurilor Unicode din catalog. */
export const elementIcon = (id: string) => `el-${id}` as IconName;
