# Zevoltus and the animated teleporter

Zevoltus replaces the lightning arena champion in tier 3. His adult-only
South-East atlas includes idle (8 frames), walk (12), attack (20), defend (20),
hurt (8), death (24), and ultimate (40). Source character:
`b9aaf8ad-7342-43ba-a698-7e828f46b909`. Downloaded source frames stay in ignored art/.

The world and building menus use the same portal renderer and building image.
The vortex, torch flames, glints and particles animate; reduced motion freezes
the effect. The building menus no longer use the old utility sprite sheet.

Validation: npm test, npm run build, node scripts/review-animation-updates.mjs,
and node scripts/review-arena-bosses.mjs.
