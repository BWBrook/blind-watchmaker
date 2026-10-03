/** Help written for this recreation (paraphrasing the topics of the original's help, not its wording). */
export const HELP: Record<string, { title: string; body: string[] }> = {
  breeding: {
    title: 'BREEDING HELP',
    body: [
      'The biomorph in the middle box is the parent. Around it are its offspring, each a copy of the parent with a few random mutations to its genes.',
      'Click the offspring you like best. It becomes the new parent and a new litter is born around it. Click the parent itself for a fresh litter.',
      'You are the selective agent; the mutations are random. Each choice builds on the last: cumulative selection.',
      'The strip at the top shows the 16 genes of the biomorph under the pointer.',
      'To keep a record of your choices, choose Operation > Initialize Fossil Record before you start; Play Back Fossils shows it.',
    ],
  },
  playingBack: {
    title: 'PLAYING BACK FOSSILS HELP',
    body: [
      'The fossil record holds the parent you chose at every generation while recording was on: the newest at the top of the scroll bar, the oldest at the bottom.',
      'Click the arrows or drag the scroll box to sink down through the strata to older ancestors, or rise back towards the present.',
      'Exit > Breed from Current Fossil starts breeding again from the fossil on show. Close Window returns to the breeding screen.',
    ],
  },
  highlighting: {
    title: 'HIGHLIGHTING HELP',
    body: [
      'Click any biomorph to blacken it. It becomes the active biomorph, which the next command (Breed, Engineering, Drift) works on.',
    ],
  },
  engineering: {
    title: 'ENGINEERING HELP',
    body: [
      'Here you change genes directly, as a genetic engineer would, instead of breeding.',
      'Move the pointer up into the gene strip (the chromosome). In the left third of a gene box the pointer becomes a left arrowhead: click to lower the value. The right third raises it. Hold the button down to repeat.',
      'In gene boxes 1 to 9 and 11, the middle third sets a gradient along the segments: top = increasing, middle = none, bottom = decreasing.',
      'View > Thicker Pen and Thinner Pen change the line width.',
    ],
  },
  randoming: {
    title: 'HOPEFUL MONSTER HELP',
    body: [
      'A random biomorph, as if made by one enormous mutation. Click anywhere for another.',
      'Most are unremarkable, which is the point: a single random leap almost never produces anything well designed. Choose Breed to breed from the last one.',
    ],
  },
  drifting: {
    title: 'DRIFT HELP',
    body: [
      'Evolution without selection: the biomorph mutates at random, step after step, with nobody choosing.',
      'Drift runs while the pointer is inside the window. Move the pointer up to the menu bar to pause it, and choose another operation to stop.',
      'View > Drift Sweep shows the drifting lineage spread across the boxes instead of one picture at a time.',
    ],
  },
  preliminary: {
    title: 'ROWS AND COLUMNS',
    body: ['The grid has changed size. Choose Breed from the Operation menu to start breeding in it.'],
  },
  albuming: {
    title: 'ALBUM HELP',
    body: [
      'The album holds up to four pages of fifteen biomorphs. Edit > Add Biomorph to Album puts the active biomorph on the current page; Edit > Show Album shows the pages (all four in miniature if there is more than one: click a page to see it).',
      'Click a biomorph to select it: it becomes the active biomorph, ready to Breed, Engineer or Drift. Clear empties the selected slot; Paste fills an empty slot with the last biomorph you copied.',
      "File > Load to Album adds biomorphs from a file. Dawkins' own Alphabet zoo and Exhibition zoo are on the disk.",
    ],
  },
  copy: {
    title: 'COPY HELP',
    body: [
      'Copy put a picture of the active biomorph on the clipboard, ready to paste into a document or drawing program.',
      'It also remembers the biomorph itself, so you can paste it into an empty album slot (select a cleared slot, then choose Paste).',
    ],
  },
  misc: {
    title: 'MISCELLANEOUS HELP',
    body: [
      'View > More/Fewer Rows and Columns change the size of the breeding grid.',
      'The Mutations menu controls which kinds of gene may mutate. An unchecked kind is frozen at its present value.',
      "Uncheck Segmentation, Gradient, Asymmetry and Radial Sym to get the nine-gene biomorphs of Dawkins' 1986 book.",
    ],
  },
};
