# Fire T-Rex enhanced combat clips

Runtime SE replacements from the completed PixelLab revisions:

| Stage | Clip | Named revision | Frames |
| --- | --- | --- | --- |
| Juvenile | attack | attack-fire-enhanced | 16 |
| Juvenile | defend | defend-fire-enhanced | 16 |
| Adult | attack | attack-fire-enhanced | 16 |
| Adult | defend | defend-fire-enhanced | 16 |
| Adult | ultimate | ultimate-fire-enhanced | 24 |

Baby animations and optional NE clips remain available. Juveniles do not gain an
ultimate. Walks retain 12 generated frames, excluding the prepended reference
pose found in the legacy export. The full canvas and ground pivot are preserved.
Updated clips overwrite the runtime atlas filenames so no duplicate revision
PNGs are needed in public/.

Sylvaraa's completed 40-frame ultimate is also imported into
`boss_nature_adult`. All four animated arena bosses now have seven clips.

Reimport command:

```powershell
python scripts/import-pixellab-archive.py trex_fire path/to/trex.zip --stage juvenile --stage adult --state juvenile=Idle --state adult=adult --prefer juvenile.attack=attack-fire-enhanced --prefer juvenile.defend=defend-fire-enhanced --prefer adult.attack=attack-fire-enhanced --prefer adult.defend=defend-fire-enhanced --prefer adult.ultimate=ultimate-fire-enhanced
```

The archive importer exports SE clips; preserve optional NE manifest entries
when refreshing this previously imported family. Sources and archives stay
locally under ignored art/. Runtime tests assert clip coverage and frame counts.
`node scripts/review-animation-updates.mjs` checks all six changed clips through
the actual React sprite player, including final-pose retention.
