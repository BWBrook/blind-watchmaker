# Blind Watchmaker

Browser recreations of Richard Dawkins' *Blind Watchmaker* biomorph program, for teaching cumulative selection.

- **Classic** (`classic/`): the original monochrome Macintosh program, recreated pixel for pixel on a simulated 512 × 342 Mac screen. Breed, Highlight, Engineering, Hopeful Monster, Drift (cinematic and sweep), the Mutations menu, rows and columns, the Album (pages, zoom, Clear, Copy, Paste), the Fossil record (recording, and playback in a draggable, resizable window with a scroll bar), the Pedigree (draw out offspring with 0, 1 or 2 mirrors, Move, Detach, Kill), loading and saving through System 6 Standard File dialogs, Help and About work. Triangle is still to come.

The simulated disk ("Blind Watchmaker") holds Dawkins' own Alphabet zoo, Exhibition zoo and three single biomorphs; files a user saves are kept in their browser. The Drive button switches to the user's real computer (upload and download, in the original 40-byte format).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine tests
npm run build    # static site in dist/
```

## Layout

- `src/engine/`: genome, development (Dawkins' recursive tree), mutation, Engineering edits, Triangle blending, the original 40-byte file format, and Dawkins' saved biomorphs (`zoos.json`). No DOM.
- `src/classic/`: the 1-bit Mac screen, Toolbox-style event loop, menu bar, dialogs and the program's modes.
- `docs/spec/`: the engine and interface specifications the recreation is built from.

## Provenance

The recreation is a reimplementation, not a port. Its behaviour follows Dawkins' own Think Pascal source (version 1.1, 1993), as published in [Aronnax9000/WatchmakerSuite](https://github.com/Aronnax9000/WatchmakerSuite), but no code is copied from it. `docs/spec/` records which source routine each behaviour comes from. The surviving source is the 1993 maintenance release, which already includes the extended genome from Dawkins' "The Evolution of Evolvability" (in Langton, ed., *Artificial Life*, 1989). Unchecking Segmentation, Gradient, Asymmetry and Radial Sym in the Mutations menu gives the nine-gene biomorphs of the 1986 book.

`src/engine/zoos.json` holds the genomes from Dawkins' "Alphabet zoo", "Exhibition zoo" and three single-biomorph files in the same repository, decoded from the original binary format.

## Licence

The code is MIT-licensed (see `LICENSE`). The biomorph genomes in `src/engine/zoos.json` are Richard Dawkins' work, included with credit for teaching. The fonts are CC BY, as below.

## Credits

- Original program and biomorphs: Richard Dawkins. See *The Blind Watchmaker* (1986).
- Chicago (ChiKareGo2) and Geneva (FindersKeepers) pixel fonts by Giles Booth, CC BY.

This is an independent educational project, not affiliated with Richard Dawkins or his publishers.
