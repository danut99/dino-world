import { dinosaurCrop, loadDinosaurArt, SPECIES_NAMES, type Species } from './dinosaurs';
import type { RealmId, Stage } from './game';
import { useEffect, useId, useState } from 'react';

export function DinosaurArt({ species, element, stage, className = '' }: {
  species: Species; element: RealmId; stage: Stage; className?: string;
}) {
  const crop = dinosaurCrop(element, species, stage);
  const clip = useId().replaceAll(':', '');
  const [ready, setReady] = useState<RealmId | null>(null);
  useEffect(() => {
    let active = true;
    loadDinosaurArt(element).then(() => { if (active) setReady(element); });
    return () => { active = false; };
  }, [element]);
  return <svg className={`realm-hero dinosaur-art ${stage} ${className}`}
    viewBox={`${crop.x - 4} ${crop.y - 4} ${crop.width + 8} ${crop.height + 8}`} role="img"
    aria-label={`${element} ${SPECIES_NAMES[species]} ${stage}`} data-art-ready={ready === element}>
    <defs><clipPath id={clip}>{crop.path ? <path d={crop.path} /> : <rect x={crop.x} y={crop.y} width={crop.width} height={crop.height} />}</clipPath></defs>
    {ready === element && <image clipPath={`url(#${clip})`} href={`/realms/dinosaurs/${element}.webp`} width={crop.sheetWidth} height={crop.sheetHeight} />}
  </svg>;
}
