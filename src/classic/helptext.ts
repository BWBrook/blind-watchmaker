/** Help written for this recreation (paraphrasing the topics of the original's help, not its wording). */
export const HELP: Record<string, { title: string; body: string[] }> = {
  breeding: {
    title: 'BREEDING HELP',
    body: [
      'The biomorph in the middle box is the parent. Around it are its offspring, each a copy of the parent with a few random mutations to its genes.',
      'Click the offspring you like best. It becomes the new parent and a new litter is born around it. Click the parent itself for a fresh litter.',
      'You are the selective agent; the mutations are random. Each choice builds on the last: cumulative selection.',
      'The strip at the top shows the 16 genes of the biomorph under the pointer.',
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
  misc: {
    title: 'MISCELLANEOUS HELP',
    body: [
      'View > More/Fewer Rows and Columns change the size of the breeding grid.',
      'The Mutations menu controls which kinds of gene may mutate. An unchecked kind is frozen at its present value.',
      "Uncheck Segmentation, Gradient, Asymmetry and Radial Sym to get the nine-gene biomorphs of Dawkins' 1986 book.",
    ],
  },
};
