/** Roman numerals for chapters and levels (index = number); covers every story chapter. */
export const ROMAN = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
] as const;
export const roman = (n: number) => ROMAN[n] ?? String(n);
/** Short amounts for tight spots: 950, 1.2k, 12k, 125k, 1.2M. */
export function compact(n: number) {
  const v = Math.floor(n);
  if (v < 1000) return String(v);
  const [unit, size] = v < 1e6 ? ['k', 1e3] : ['M', 1e6];
  const x = v / size;
  return `${x < 10 ? Math.floor(x * 10) / 10 : Math.floor(x)}${unit}`;
}
