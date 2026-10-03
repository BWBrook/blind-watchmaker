/** Small 1-bit glyphs missing from the pixel fonts. '#' = black. Drawn with their bottom row on the baseline. */
export type Glyph = string[];

export const COMMAND: Glyph = [
  '.##...##.',
  '#..#.#..#',
  '#..#.#..#',
  '.#######.',
  '...#.#...',
  '.#######.',
  '#..#.#..#',
  '#..#.#..#',
  '.##...##.',
];

export const CHECK: Glyph = [
  '.......##',
  '......##.',
  '.....##..',
  '#...##...',
  '##.##....',
  '.###.....',
  '..#......',
];

export const BULLET: Glyph = ['.##.', '####', '####', '.##.'];
