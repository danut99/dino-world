# Raptor and Triceratops runtime assets

The game now loads the managed PixelLab `raptor_earth` and `triceratops_nature`
families for baby, juvenile and adult dinosaurs. Both the island canvas and
`DinosaurArt` use the local atlases through `animation-inventory.json`.
Other elemental variants retain their existing artwork.

Sources: `raptor-192-*-import.txt` and `pixellab-192-triceratops_nature-*.txt`.
The importer preserves the full source canvas, pads to 256 pixels without
resizing, and registers each clip to the shared ground pivot.

Both families have all 15 age-appropriate SE clips: two for babies, six for
juveniles and seven for adults. The raptor adult ultimate comes from completed
job `a27a2bdf-657a-440f-9f1b-0e0bc8c7a715`, using its 20 managed animation frames.

These generated assets retain prototype status pending final art approval.
