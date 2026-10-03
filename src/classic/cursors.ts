/** 1-bit pointers drawn for this recreation ('#' = black); each gets an automatic 1 px white outline. */
interface CursorDef {
  rows: string[];
  hot: [number, number];
}

const DEFS = {
  arrow: {
    hot: [1, 1],
    rows: [
      '',
      ' #',
      ' ##',
      ' ###',
      ' ####',
      ' #####',
      ' ######',
      ' #######',
      ' ########',
      ' #####',
      ' ## ##',
      ' #   ##',
      '     ##',
      '      ##',
      '      ##',
    ],
  },
  cross: {
    hot: [7, 7],
    rows: Array.from({ length: 15 }, (_, y) => (y === 7 ? '###############' : '       #')),
  },
  left: {
    hot: [3, 7],
    rows: ['', '', '      #', '     ##', '    ###', '   ####', '  #####', ' ######', '  #####', '   ####', '    ###', '     ##', '      #'],
  },
  right: {
    hot: [8, 7],
    rows: ['', '', '  #', '  ##', '  ###', '  ####', '  #####', '  ######', '  #####', '  ####', '  ###', '  ##', '  #'],
  },
  up: {
    hot: [7, 4],
    rows: ['', '', '', '       #', '      ###', '     #####', '    #######', '   #########', '  ###########'],
  },
  down: {
    hot: [7, 10],
    rows: ['', '', '', '', '', '', '', '  ###########', '   #########', '    #######', '     #####', '      ###', '       #'],
  },
  equals: {
    hot: [7, 7],
    rows: ['', '', '', '', '', '   #########', '   #########', '', '', '   #########', '   #########'],
  },
  syringe: {
    hot: [7, 7],
    rows: ['', '', '', '', '', '#', '# ##########', '####  #  #  ######', '# ##########', '#'],
  },
  block: {
    hot: [8, 8],
    rows: ['', '', '', '', '', '    ########', '    ########', '    ########', '    ########', '    ########', '    ########', '    ########', '    ########', '    ########', '    ########', '    ########'],
  },
  lens: {
    hot: [6, 6],
    rows: [
      '',
      '    #####',
      '   #     #',
      '  #       #',
      '  #       #',
      '  #       #',
      '  #       #',
      '  #       #',
      '   #     ##',
      '    ##### ##',
      '           ##',
      '            ##',
      '             ##',
    ],
  },
  die: {
    hot: [8, 8],
    rows: [
      '',
      ' ##############',
      ' #            #',
      ' # ##      ## #',
      ' # ##      ## #',
      ' #            #',
      ' #     ##     #',
      ' #     ##     #',
      ' #            #',
      ' # ##      ## #',
      ' # ##      ## #',
      ' #            #',
      ' ##############',
    ],
  },
} satisfies Record<string, CursorDef>;

export type CursorName = keyof typeof DEFS | 'none';

const cache = new Map<string, string>();

/** CSS `cursor` value for a pointer at the given integer screen scale. */
export function cursorCss(name: CursorName, scale: number): string {
  if (name === 'none') return 'none';
  const key = `${name}@${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def: CursorDef = DEFS[name];
  const size = 18;
  const black = (x: number, y: number) => def.rows[y]?.[x] === '#';
  const c = document.createElement('canvas');
  c.width = c.height = size * scale;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let colour: string | undefined;
      if (black(x, y)) colour = '#000';
      else if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => black(x + dx, y + dy)))) colour = '#fff';
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  const css = `url(${c.toDataURL()}) ${def.hot[0] * scale} ${def.hot[1] * scale}, crosshair`;
  cache.set(key, css);
  return css;
}
