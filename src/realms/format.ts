/** Roman numerals for chapters and levels (index = number); covers every story chapter. */
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'] as const;
export const roman = (n: number) => ROMAN[n] ?? String(n);
