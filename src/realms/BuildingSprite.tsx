import { AnimatedWorkshopSprite } from './AnimatedWorkshopSprite';
import type { UtilityKind } from './content';
import type { Save } from './game';
import { tierArt } from './buildingTiers';
import { AnimatedFarmSprite } from './AnimatedFarmSprite';
import { isAnimatedFarm } from './animatedFarm';
import { AnimatedPortalSprite } from './AnimatedPortalSprite';

export function BuildingSprite({ kind, save }: { kind: UtilityKind; save?: Save }) {
  if (kind === 'portal') return <AnimatedPortalSprite />;
  // Clădirile PixelLab au prioritate; animațiile vechi rămân doar pentru ce nu are încă sprite nou.
  const upgraded = tierArt(save ?? ({} as Save), kind);
  if (kind === 'farm' && upgraded && isAnimatedFarm(upgraded)) {
    return <AnimatedFarmSprite art={upgraded} />;
  }
  if (upgraded) return (
    <svg className="utility-sprite pixel" viewBox="0 0 1 1" aria-hidden="true">
      <image href={upgraded} width="1" height="1" style={{ imageRendering: 'pixelated' }} />
    </svg>
  );
  if (kind === 'workshop') return <AnimatedWorkshopSprite />;
  if (kind === 'farm') return <AnimatedFarmSprite />;
  if (kind === 'market') return (
    <svg className="utility-sprite" viewBox="0 0 1 1" aria-hidden="true">
      <image href="/realms/gameplay/market-building-pixel.webp" width="1" height="1" />
    </svg>
  );
  return kind === 'hatchery' ? (
    <svg className="utility-sprite" viewBox="0 0 724 724" aria-hidden="true">
      <image href="/realms/building-concepts.webp" width="2172" height="724" />
    </svg>
  ) : (
    <svg
      className="utility-sprite"
      viewBox="2 0 1 1"
      aria-hidden="true"
    >
      <image href="/realms/gameplay/utility-buildings-pixel.webp" width="3" height="1" preserveAspectRatio="none" />
    </svg>
  );
}
