/** Spine atlas page names are unindented; accept both Windows and Unix line endings. */
export function atlasPageNames(atlasText: string): string[] {
  return atlasText.split(/\r?\n/).filter((line) => /^[^\s].*\.(webp|png)$/.test(line));
}
