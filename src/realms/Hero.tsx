import type { Stage } from './game';
import { DinosaurArt } from './DinosaurArt';
export function Hero({ stage, className = '' }: { stage: Stage; className?: string }) {
  return <DinosaurArt species="trex" element="fire" stage={stage} className={className} />;
}
