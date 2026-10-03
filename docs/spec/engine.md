# Blind Watchmaker (monochrome biomorphs): engine specification

Scope: genome, development and drawing, mutation, reproduction, Hopeful Monster, Engineering edits, Triangle, Drift, file formats. The user interface is out of scope except where it fixes engine behaviour (geometry, clipping, flags).

## 0. Sources and conventions

Authoritative source: `Aronnax9000/WatchmakerSuite`, `docs/Dawkins/Monochrome WatchMaker/` (HEAD `c458ee6`, 2018-11-03). Header of `Globals` says v1.1, Sept 1993 (Think Pascal, 68k Mac). Citations below are `Unit:Procedure`.

Cross-checks (original wins; differences are listed in section 9):
- Canon's cleaned version, `docs/pascal2ndEd/Monochrome/` (a token-level diff against the original shows no change to engine logic).
- MIT JS port `Aronnax9000/blind-watchmaker-js` (HEAD `e45ec01`).
- For the Mutations-menu labels only: `docs/pascalCarbonUPI/.../InitializeMorphMenusDef.pas` (the original menu resource is not in the repo; `BW.rsrc` is empty).

`(I)` marks anything inferred rather than read directly from the original source.

Conventions:
- QuickDraw coordinates: origin top-left, x right, y DOWN. "North" is negative y.
- Pascal `Integer` is signed 16-bit (I: Think Pascal on 68k; the 40-byte record in section 7 confirms 2-byte Integers).
- `DIV` truncates toward zero (standard Pascal, 68k DIVS). `*` and `DIV` have equal precedence, left to right, so `lgth * dx[dir] DIV trickle` means `(lgth*dx[dir]) DIV trickle`.
- `ROUND` on reals: nearest, ties away from zero (I: standard Pascal). JS `Math.round` differs on negative ties.
- Pascal arrays are 1-based. In this spec's pseudocode `gene[1..9]` and `dgene[1..10]` are 1-based. In every JSON file the arrays are 0-based: `gene[i-1]` is Gene i, and `dgene[9]` (last) is the segment-distance gradient dGene[10].

## 1. Genome record (`Globals:person`)

The type is `person`. The runtime wrapper `Full` (pedigree links, rects) and `Pic`/`Lin` (line list) are not genome.

| Pascal field | Type | Bytes | File offset | Meaning | Constraints and where enforced | Default (`Biomorphs:MakeGenes`) |
|---|---|---|---|---|---|---|
| `gene[1..8]` | Integer | 2 each | 0..15 | Direction vector components (section 3.1) | No clamp anywhere. Edited and mutated in steps of the genome's own `mutsizegene`. | per genotype |
| `gene[9]` | Integer | 2 | 16 | Recursion depth ("order") | `>= 1` (clamped in Reproduce, Develop, Manipulation, Concoct). `SegNo * 2^gene[9] <= 4095` (WorryMax). Manipulation skips redrawing when `> 12`. Value 0 is the "empty album slot" marker (section 7), never a valid biomorph. | per genotype |
| `dgene[1..10]` | `SwellType = (Swell, Same, Shrink)` | 1 each | 18..27 | Gradient per segment. 1..8 act on gene 1..8; 9 is line-thickness taper; 10 is segment-distance gradient | 3 values; ordinals Swell=0, Same=1, Shrink=2 | all Same |
| `SegNoGene` | Integer | 2 | 28 | Number of segments | `>= 1`; `SegNo * 2^gene[9] <= 4095` | 1 |
| `SegDistGene` | Integer | 2 | 30 | Vertical gap between segment roots, in 1/trickle pixel | No clamp (negative allowed) | 150 |
| `CompletenessGene` | `(Single, Double)` | 1 | 32 | Single = no mirror copy; Double = bilateral mirror | Single=0, Double=1 | Double |
| `SpokesGene` | `(NorthOnly, NSouth, Radial)` | 1 | 33 | NorthOnly / north-south / radial replication | 0, 1, 2 | NorthOnly |
| `tricklegene` | Integer | 2 | 34 | Scale divisor, and gradient step | `>= 1` (Reproduce, Manipulation, and clamped on use in Develop). Not clamped in Concoct. | `Trickle` = 10 |
| `mutsizegene` | Integer | 2 | 36 | Step size for gene 1..8 mutation and Engineering edits | `>= 1` (Reproduce, Manipulation). Not clamped in Concoct. | `Trickle DIV 2` = 5 |
| `mutprobgene` | Integer | 2 | 38 | Mutation probability, percent-like | Manipulation and Concoct clamp to 1..100. Reproduce can leave it negative (section 4.3). | 10 |

Total 40 bytes (18+10+2+2+1+1+2+2+2), no padding (derived from the file sizes and the clean decode, section 7). Constants (`Globals`): `Trickle=10`, `WorryMax=4095`, `PicSizeMax=4095`, `MaxGene9=12` (declared; only the literal 12 in Manipulation is used), `MaxBoxes=100`, `MaxAlbum=100`, `GenesHeight=20`, `MutTypeNo=9`.

`TwoToThe(n)` (`Miscellaneous`) returns 2^n for n = 0..12 and 8192 for any other n, including negative n.

Meaning of the scale: a gene value is in 1/trickle pixel per unit of branch length. A gradient step adds `trickle` to the gene, so one segment later the displacement per unit length has grown by exactly 1 pixel.

JSON schema used for genomes in this project (named genotypes below, and `zoos.json`):

```text
{"gene":[9 ints],"dgene":[10 of "swell"|"same"|"shrink"],"segNo":int,"segDist":int,
 "completeness":"single"|"double","spokes":"northOnly"|"nSouth"|"radial",
 "trickle":int,"mutSize":int,"mutProb":int}
```

## 2. Named starting genotypes (`Biomorphs:MakeGenes`, `Chess`, `BasicTree`, `Insect`)

They live in `Biomorphs`, not `Initialize` (which only sets flags and grid size).

`MakeGenes(a..i)` template: dgene all Same, SegNo 1, SegDist 150, Double, NorthOnly, trickle 10, mutSize 5, mutProb 10, then `gene[1..9] = a..i`.

```json
{"BasicTree":{"gene":[-10,-20,-20,-15,-15,0,15,15,7],"dgene":["same","same","same","shrink","shrink","shrink","same","same","shrink","same"],"segNo":2,"segDist":150,"completeness":"single","spokes":"northOnly","trickle":9,"mutSize":5,"mutProb":10},
 "Insect":{"gene":[10,10,-40,10,-10,-20,80,-40,6],"dgene":["same","same","same","same","same","same","same","same","same","same"],"segNo":1,"segDist":150,"completeness":"double","spokes":"northOnly","trickle":10,"mutSize":5,"mutProb":10},
 "Chess":{"gene":[-10,30,-30,-30,10,-20,60,-50,7],"dgene":["same","same","same","same","same","same","same","same","same","same"],"segNo":1,"segDist":150,"completeness":"double","spokes":"northOnly","trickle":10,"mutSize":5,"mutProb":10}}
```

BasicTree = MakeGenes(-10,-20,-20,-15,-15,0,15,15,7) then SegNo=2, SegDist=150, Single, dgene[4], [5], [6], [9] = Shrink, trickle=9. Chess = MakeGenes(-T, 3T, -3T, -3T, T, -2T, 6T, -5T, 7), Insect = MakeGenes(T, T, -4T, T, -T, -2T, 8T, -4T, 6), with T = 10.

Use at startup (`Main`): the first screen is BasicTree in the middle box (`BasicTree(Child[Special])`, then `DoBreed`). Triangle corners default to Top=BasicTree, Left=Insect, Right=Chess. `Insect(target)` feeds the unreachable TargetEvolve. `CopiedAnimal` starts as BasicTree with gene[9] set to 0 (the "clipboard empty" marker).

## 3. Development and drawing (`Biomorphs:Develop`, `Tree`, `PlugIn`, `DrawPic`, `PicLine`, `Delayvelop`)

### 3.1 Direction tables (`PlugIn`)

Eight directions, indices 0..7. Components in 1/trickle units; y is down, so a negative `dy` points up.

| dir | dx | dy |
|---|---|---|
| 0 | -gene2 | gene6 |
| 1 | -gene1 | gene5 |
| 2 | 0 | gene4 |
| 3 | gene1 | gene5 |
| 4 | gene2 | gene6 |
| 5 | gene3 | gene7 |
| 6 | 0 | gene8 |
| 7 | -gene3 | gene7 |

`order = gene9`. Reading a negative x-gene as "leftward", the layout is 0=E, 1=NE, 2=N, 3=NW, 4=W, 5=SW, 6=S, 7=SE (counter-clockwise from east; Canon's comment). The picture is therefore always built mirror-symmetric in direction; "Single" vs "Double" only decides whether the mirror copy is drawn.

`PlugIn` is called with the current "running" gene array every segment (3.2), so gradients change `dx/dy` and `order` per segment.

### 3.2 `develop(g, here)` (pseudocode, verified; see section 10)

Mutates `g` (normalisation side effects below). Produces a list of lines `(x0,y0,x1,y1,thick)` in the coordinate system where the root is `here`, plus a bounding box `margin`.

```
margin = {left=here.h, right=here.h, top=here.v, bottom=here.v}     // ZeroMargin = TRUE
centre = here;  pic.origin = here;  pic.lines = []
plugIn(g.gene)                       // sets dx[], dy[], order = g.gene[9]
g.segNo = max(g.segNo, 1)
extra = (dgene[10]==Swell) ? +trickle : (dgene[10]==Shrink) ? -trickle : 0
running = copy(g.gene);  inc = 0
for seg = 1 .. g.segNo:
    oddOne = (seg is odd)
    if seg > 1:
        old = here
        here.v += div(g.segDist + inc, g.trickle)        // truncating division
        inc    += extra
        thick   = (dgene[9]==Shrink) ? g.gene[9] : 1
        picLine(old.h, old.v, here.h, here.v, thick)     // NOT multiplied by penSize
        for j in 1..8:
            if dgene[j]==Swell:  running[j] += g.trickle
            if dgene[j]==Shrink: running[j] -= g.trickle
        running[9] = max(running[9], 1)
        plugIn(running)                                  // also resets order = running[9]
    if g.segNo * 2^g.gene[9] > 4095: g.gene[9] -= 1      // see 3.8
    g.gene[9] = max(g.gene[9], 1)
    tree(here.h, here.v, order, 2)                       // dir 2 = north
finalise margin (3.5)
```

Notes:
- When `ZeroMargin` is FALSE (Drift, album and fossil playback) the old `margin` is not reset first; this affects only the bounding rectangle, never the drawn pixels.
- Segment k (k >= 1) uses gene value `gene[j] + (k-1)*trickle*grad(j)`, where grad is +1 Swell, -1 Shrink, 0 Same. No clamp on running[1..8]; only `running[9] >= 1`.
- Segment k's root is lower than segment k-1's root by `div(segDist + inc_k, trickle)`, where `inc_2 = 0` and `inc_{k+1} = inc_k + extra` (the increment is applied after use). `Here.h` never changes, so segments stack vertically at the root x.
- Gradient flags `dgene[1..8]` and `dgene[10]` take effect only for segments after the first, so they are inert when `segNo = 1`.
- `order` is captured by `plugIn` before the cap check. The cap check changes the stored `g.gene[9]` only; the lines drawn in this pass keep the original order (3.8).
- `dgene[9]` never touches `running`; it controls line thickness only ("tapering twigs").

### 3.3 `tree(x, y, len, dir)`

```
dir = (dir < 0) ? dir + 8 : dir;  dir = (dir >= 8) ? dir - 8 : dir
if g.trickle < 1: g.trickle = 1
xn = x + div(len * dx[dir], g.trickle)          // product first, then truncating DIV
yn = y + div(len * dy[dir], g.trickle)
margin.left = min(margin.left, x, xn);  margin.right  = max(margin.right,  x, xn)
margin.top  = min(margin.top,  y, yn);  margin.bottom = max(margin.bottom, y, yn)
thick = (dgene[9]==Shrink) ? len : (dgene[9]==Swell) ? 1 + g.gene[9] - len : 1
picLine(x, y, xn, yn, thick * penSize)          // picLine caps thickness at 8
if len > 1:
    if oddOne:  tree(xn, yn, len-1, dir+1);  if len < order: tree(xn, yn, len-1, dir-1)
    else:       tree(xn, yn, len-1, dir-1);  if len < order: tree(xn, yn, len-1, dir+1)
```

- Because `len < order` is false for the first call, the stem has exactly one child (`dir+1` on odd segments, `dir-1` on even ones, so the stem tilts opposite ways on alternate segments). Every deeper node has two children.
- Lines per segment: `2^(order-1)`. Total lines `= segNo*2^(gene9-1) + (segNo-1)`, the second term being the segment connectors. Verified against all 60 Exhibition zoo genomes.
- Zero-length lines (integer truncation gives `xn=x, yn=y`) are still emitted, counted, and drawn as a dot (the guard that would skip them is commented out in the source).
- Width gradient: Shrink gives `thick = len`, so the stem (`len = order`) is thickest and the twigs (`len = 1`) are 1 px; Swell gives `1 + gene9 - len`, thin stem and thick twigs; Same gives 1. `penSize` (global, default 1, raised only in Engineering mode by Box menu "Thicker Pen") multiplies tree lines only. `picLine` caps `thick` at 8 after multiplication.
- Draw order does not matter for pixels (black on white, pen mode PatCopy).

### 3.4 `picLine` and the size cap

`PicLine` appends to a fixed buffer of `PicSizeMax = 4095` records (`Lin` = two Points plus Thickness, 10 bytes). If `PicSize >= 4095` it shows "Biomorph too large, or other problem" and calls `ExitToShell`: the whole program quits. A port must not copy this; treat it as "reject / refuse to render".

### 3.5 Bounding box finalisation (end of `develop`)

`margin` is the unmirrored extent of all line endpoints in picture coordinates (no pen-width allowance). Then, always:

```
if centre.h - margin.left > margin.right - centre.h:  margin.right = centre.h + (centre.h - margin.left)
else:                                                  margin.left  = centre.h - (margin.right - centre.h)
up = centre.v - margin.top;  down = margin.bottom - centre.v
if spokes in (NSouth, Radial) or mode == Engineering:
    if up > down: margin.bottom = centre.v + up  else: margin.top = centre.v - down
if spokes == Radial:
    wid = right-left;  ht = bottom-top
    if wid > ht: top = centre.v - wid DIV 2 - 1;  bottom = centre.v + wid DIV 2 + 1
    else:        left = centre.h - ht DIV 2 - 1;  right  = centre.h + ht DIV 2 + 1
```

Consequences:
- The box is always horizontally symmetric about the root x, even for Single (asymmetric) biomorphs, so the root x, not the visible shape, defines horizontal centring.
- It is vertically symmetric about the root y only for NSouth, Radial, or while in Engineering mode.
- `centre` is the original root (`here` before any segment shifts).

### 3.6 `drawPic(pic, Place, g)`: symmetry styles

The style comes from the genome passed to DrawPic, not from the Pic:

| Completeness | NorthOnly | NSouth | Radial |
|---|---|---|---|
| Single | LF | LUD | LUD (+ EW pass RUD) |
| Double | FF | FUD | FUD (+ EW pass FUD) |

Let `(a, b) = (x - origin.h, y - origin.v)` be a stored point relative to the pic origin; the drawn point is at `Place + (a, b)`. `Mid2 = 2*Place.h`, `belly2 = 2*Place.v`. Relative to `Place`, each style draws every line at these offsets:

| Style | Copies of (a,b) |
|---|---|
| LF | (a, b) |
| FF | (a, b), (-a, b) |
| LUD | (a, b), (-a, -b) (a 180 degree rotation, not a vertical flip) |
| RUD | (-a, b), (a, -b) |
| FUD | (a, b), (-a, b), (a, -b), (-a, -b) |

The EW pass (Radial only) first transposes the stored offset, `(a, b) -> (b, a)`, then applies RUD (Single) or FUD (Double). Net result: NorthOnly Single has 1 copy; NorthOnly Double 2; NSouth Single 2; NSouth Double 4; Radial Single 4 (90 degree rotations: (a,b), (-a,-b), (-b,a), (b,-a)); Radial Double 8 (all sign/transpose combinations).

Mirrored copies are mirrored by integer endpoint arithmetic (`Mid2 - x`), and the pen is then anchored the same way as for the unmirrored line (3.9), so a mirrored thick line is shifted by `thick-1` px relative to a true reflection. Reproduce this exactly for pixel fidelity.

### 3.7 Placement in the display box (`Delayvelop`, `Snapshot`, callers)

Two placement modes are used.

A. Vertically re-centred (`Delayvelop`). Used by breeding boxes, album pages, sweep boxes, Engineering entry (`DoEngineer`), pedigree root, clipboard copy.
```
develop(g, here = boxCentre)            // margin as above
margcentre = margin.top + (margin.bottom - margin.top) DIV 2
offset     = margcentre - here.v
Place      = (here.h, here.v - offset)  // whole picture translated by (0, -offset)
drawPic(pic, Place, g)                  // clipped to the box
```
The vertical midpoint of the bounding box lands on the box centre (integer DIV); the root x lands on the box centre x. For NSouth/Radial/Engineering the box is symmetric about the root so `offset = 0`.

B. Root at the centre, no re-centring. Used by: Drift (non-sweep), Hopeful Monster (`DoSaltation`, drawn at `centre[MidBox]` with the whole window erased), fossil playback, pedigree spawned children (drawn at the drag point), and Engineering redraws (`SnapDevelop`; the symmetric margin makes it equal to mode A).

Box centre: `centre[j] = (box[j].left + boxwidth DIV 2, box[j].top + height DIV 2)`.

### 3.8 Size caps and what happens when something is too big

- Cap `SegNo * 2^gene9 <= 4095` is enforced as follows. Reproduce: after gene9 mutation (decrement once if over) and after SegNo increases (decrement SegNo once if over). Manipulation: after gene9++ (gene9--) and SegNo++ (SegNo--). Concoct: gene9-- once. Develop: `gene[9]--` on each segment iteration while over, but this never changes the `order` used for the lines drawn in that pass. A genome that violates the cap (hand-edited file, extrapolated Triangle point) therefore either draws at full size or hits the 4095-line fatal error. A port should normalise to the cap before developing.
- The cap guarantees lines <= 4093, so the `PicSizeMax` failure cannot occur for compliant genomes.
- Effective maximum gene9 is 11 when SegNo = 1 (2^12 = 4096 > 4095), 10 for SegNo 2, and so on. The literal 12 in Manipulation only decides whether to skip a redraw.
- Pictures larger than the display area are clipped, never scaled or rejected: `ClipRect(Box[j])` in breeding, album and sweep; `ClipRect(businessPart)` (the union of all boxes, excluding the 20 px gene bar) inside `Snapshot`, so Engineering, Drift and Triangle are clipped to the grid area or window.

### 3.9 Rasterisation (QuickDraw, I)

Not specified in the source; standard QuickDraw behaviour:
- `PenSize(t,t)`; `MoveTo/LineTo`. Pen is a t x t square whose top-left corner sits on the path pixel, so a thick line extends right and down of the integer path.
- Bresenham-style path from start to end inclusive. A zero-length line stamps one pen square.
- Pen mode PatCopy, black (`PenPat` black) on white. XOR and InvertRect are UI feedback only.
- Stamp the pen square at each path pixel rather than using a canvas stroke if pixel fidelity matters.

### 3.10 Pixel and box constants

- Window content `PRect` = screen bounds with `left+2, top+20, right-2, bottom-2`, then converted to local coordinates (origin 0,0). Box grid (`SetUpBoxes`): `boxwidth = (right-left) DIV ncols`; `height = (bottom - top - GenesHeight) DIV nrows`; box (row, col) top-left = `(left + boxwidth*(col-1), top + GenesHeight + height*(row-1))`. `GenesHeight = 20`.
- Defaults 3 rows x 5 cols = 15 boxes; `MidBox = NBoxes DIV 2 + 1` (= 8). So box size depends on the screen: 512x342 gives 101x100 px; 640x480 gives 127x146; 1024x768 gives 204x242. Dawkins' biomorph pixel scale is 1 px per displacement unit (no zoom), so the box size only changes how much is clipped.
- Grid changes: rows/cols change by 2 (kept odd so a centre box exists), `NRows*NCols <= MaxBoxes = 100`, minimum 1.
- Pen: 1 px, black. Mid box in breeding is framed with `PenSize(3,3)`, others 1 px. `MyPenSize` default 1.
- Album: 4 pages max (`MaxPages`, memory dependent; 4 default), `MaxAlbum = 100` biomorphs; page grid = album rows x cols (15 per page by default, which is why the 60-genome Exhibition zoo exactly fills 4 pages).

## 4. Mutation (`Biomorphs:Reproduce`, `Miscellaneous:RandInt`, `RandSwell`)

### 4.1 Random source

`RandInt(n) = 1 + (abs(random) MOD n)` where `random` is the Think Pascal / Toolbox QuickDraw `Random` (signed 16-bit result). Quote: `randint := 1 + (abs(random) MOD max)`. The seed is not set from the clock (the `GetDateTime(RandSeed)` call is commented out); `Initialize` merely spins `random` for 50 ticks, so runs are not reproducible. Any uniform integer generator is adequate (the modulo bias is negligible); no bit-exact replay is required. (I: QuickDraw Random is the 16807 Lehmer generator.)

Helpers (each use draws a fresh random number):
```
sign()      = (RandInt(2) == 2) ? +1 : -1
step(child) = (RandInt(2) == 2) ? +child.mutSize : -child.mutSize
randSwell(s): Shrink -> Same;  Swell -> Same;  Same -> (RandInt(2)==1 ? Shrink : Swell)
hit(n)      = RandInt(100) < n          // P = (n-1)/100 for 1 <= n <= 101; 0 for n <= 1
```
Because `RandInt >= 1`, a stated probability of n percent is really `(n-1)%`: the default `mutProb = 10` gives 9%; the half-rate tests use `mutProb DIV 2` (default 5, so 4%). A genome with mutProb 1 (or half-rate with mutProb <= 3) can never mutate that field.

### 4.2 Flags (`Globals:Mut[1..9]`, set in `Initialize`; toggled in `User Interface:DoMutationMenuCommands`)

Global to the session; not stored in genome files.

| Mut | Menu label (I, from the Carbon port) | Default | Governs |
|---|---|---|---|
| 1 | Segmentation | on | SegNo and SegDist mutation; Hopeful Monster SegNo/SegDist |
| 2 | Gradient | on | dgene[1..8] and dgene[10] mutation (only when SegNo > 1); Hopeful Monster gradients. Forced off, and its menu item greyed, whenever Mut[1] is off (it is not turned back on automatically) |
| 3 | Asymmetry | on | Completeness toggle |
| 4 | Radial Sym | on | Spokes mutation |
| 5 | Scaling Factor | on | trickle mutation |
| 6 | Mutation Size | off | mutSize mutation |
| 7 | Mutation Rate | off | mutProb mutation |
| 8 | Tapering Twigs | on | dgene[9] mutation (needs Mut[9] too) |
| 9 | (no menu label in the Carbon port) | on | ANDed with Mut[8]; effectively always on |

Genes 1..9 themselves have no flag and cannot be switched off.

### 4.3 `reproduce(parent) -> child`, order of operations

```
child = copy(parent)
1. if Mut[7]: if hit(child.mutProb):
        repeat child.mutProb += sign() until |child.mutProb| <= 100 and child.mutProb != 0   // sign redrawn each pass
2. for j in 1..8: if hit(child.mutProb): child.gene[j] += step(child)            // fresh sign each j; uses the CURRENT mutSize
3. if hit(child.mutProb): child.gene[9] += sign()
   child.gene[9] = max(child.gene[9], 1)
   if child.segNo * 2^child.gene[9] > 4095: child.gene[9] -= 1
4. if Mut[1]: if hit(child.mutProb):
        d = sign();  child.segNo += d
        if d > 0 and child.segNo * 2^child.gene[9] > 4095: child.segNo -= 1
   child.segNo = max(child.segNo, 1)
5. if Mut[2] and child.segNo > 1:
        for j in 1..8: if hit(child.mutProb DIV 2): child.dgene[j] = randSwell(child.dgene[j])
        if hit(child.mutProb DIV 2): child.dgene[10] = randSwell(child.dgene[10])
6. if Mut[8] and Mut[9]: if hit(child.mutProb): child.dgene[9] = randSwell(child.dgene[9])
7. if Mut[1] and child.segNo > 1: if hit(child.mutProb): child.segDist += sign()    // +-1, not +-trickle
8. if Mut[3]: if hit(child.mutProb DIV 2): toggle completeness
9. if Mut[4]: if hit(child.mutProb DIV 2):
        NorthOnly -> NSouth;  Radial -> NSouth;  NSouth -> (sign()==+1 ? Radial : NorthOnly)
10. if Mut[5]: if hit(|child.mutProb|): child.trickle += sign(); child.trickle = max(child.trickle, 1)
11. if Mut[6]: if hit(|child.mutProb|): child.mutSize += sign(); child.mutSize = max(child.mutSize, 1)
```

Details that matter:
- Each gene 1..8 is tested independently at the full `mutProb` and moves by `+-mutSize` (fresh coin per gene). Gene 9 and SegNo, SegDist, trickle, mutSize move by +-1.
- Step 1 can drive `mutProb` negative: from 1, `-1` gives 0, so the loop repeats and may land on -1, which satisfies the exit test. Once negative, nothing tested with plain `hit(mutProb)` mutates again; trickle and mutSize (steps 10-11, which use `abs`) still can. This is only reachable with Mut[7] on (off by default). The Carbon port's comment says it "formally disallows" negatives, so treating mutProb as `>= 1` is a safe port choice (I).
- Mutating `mutSize` happens last, so the gene steps of the same reproduction use the parent's mutSize.
- `mutProb` is not clamped back to 1..100 beyond the exit test, and Reproduce does not clamp trickle/mutSize upward.
- No gene 1..8 or SegDist clamp: values drift unboundedly. Rendering at overflow of 16-bit arithmetic is undefined in the source (I: ints wrap); clamp or use wider integers in a port.

## 5. Reproduction and selection

- Every offspring is a single independent `reproduce(parent)` call with the parent's own mutProb/mutSize; there is no crossover. Callers: `Biomorphs:Evolve` and `TargetEvolve` (the latter unreachable: `DoKeypress` only sets a variable), `Main:DoDrift`, `DoSweep`, and `Pedigree:SpawnOne`.
- No rejection or retry anywhere: a child may equal its parent, be oversized, or look identical to a sibling. Cap enforcement is limited to the clamps in Reproduce (section 4.3).
- Breeding generation (`Evolve`, entered via `DoBreed`):
  ```
  click box j  ->  special = j   (a click outside every box does nothing)
  child[MidBox] = child[j]       // the chosen box becomes the parent in the centre box (the picture slides there)
  for k in 1..NBoxes, k != MidBox: child[k] = reproduce(child[MidBox])   // order 1..MidBox-1 then MidBox+1..NBoxes
  develop each with mode A (3.7), clipped to its own box
  if recording fossils: append the 40-byte record of child[MidBox] to the fossil file
  ```
  Default 3x5 grid: 14 offspring plus the parent. Clicking the centre box re-breeds from the same parent (14 new mutants). The parent is not mutated and is not re-developed.
- Develop normalises the stored genomes (SegNo >= 1, trickle >= 1, gene9 cap), so what is stored in `child[]` is the post-Develop genome.
- Drift (`Main:DoDrift`, non-sweep): each pass of the event loop while the mouse is in the window: develop `child[special]` with mode B at the window centre, clipped to the grid area, then `child[special] = reproduce(child[special])` in place. The shown biomorph is the pre-mutation one. A single lineage random walk with no selection. (I: the loop runs about every 20 ticks, i.e. roughly 3 per second when idle, from the `WaitNextEvent` sleep of 20; sweep mode uses 2.)
- Drift Sweep (`DoSweep`, Box menu "Drift Sweep" toggles `SweepOn`): cycles `DriftOne` over the boxes; each step erases box `DriftOne`, copies `child[special]` into `child[DriftOne]`, develops the old `child[special]` there with mode A, then sets `special = DriftOne` and mutates that slot in place. The stored `child[DriftOne]` is therefore the next (mutated) genome, not the one displayed in that box.
- Pedigree "draw out" (`SpawnOne`): one `reproduce` per spawned child. The number of children is `Rays` = 1 (No Mirrors), 2 (Single Mirror) or 4 (Double Mirror), at points `From + d`, `From - d`, `From + (-dy, dx)`, `From + (dy, -dx)` for the drag vector `d = (dx, dy)`, spawned from `Rays` down to 1. Each child is developed with mode B at its drop point (box = bounding box widened by 3 and snapped to multiples of 8 horizontally, then shifted inside the window).

## 6. Hopeful Monster, Engineering, Triangle, Drift

### 6.1 Hopeful Monster (`Engineering:DoSaltation`)

Overwrites `child[MidBox]` (it starts from the existing genome and only the fields below change; `mutProb` is never touched).

```
if Mut[1]: segNo = RandInt(6); segDist = RandInt(20)  else: segNo = 1; segDist = 1
completeness = Double
if Mut[3]: r = RandInt(100); completeness = (r < 50) ? Single : Double
spokes = NorthOnly
if Mut[4]: r = RandInt(100); spokes = (r < 33) ? Radial : (r < 66) ? NSouth : NorthOnly
if Mut[5]: trickle = 1 + RandInt(100) DIV 10          // 1..11, P(1)=9%, P(2..10)=10% each, P(11)=1%
           if trickle > 1: mutSize = trickle DIV 2    // else mutSize unchanged
for j in 1..8: repeat
        gene[j] = mutSize * (RandInt(19) - 10)                       // -9..9 times mutSize
        dgene[j] = Mut[2] ? randSwell(dgene[j]) : Same               // applied to the previous value; re-applied on every retry
        factor   = (dgene[j] == Same) ? 0 : 1
   until |gene[j] * segNo * factor| <= 9 * trickle
repeat
        dgene[9]  = Mut[8] ? randSwell(dgene[9]) : Same
        dgene[10] = Mut[2] ? randSwell(dgene[9]) : Same               // note: the argument is the NEW dgene[9]
        factor    = (dgene[?] == Same) ? 0 : 1
   until |segDist * segNo * factor| <= 100
repeat gene[9] = RandInt(6) until gene[9] > 1                         // 2..6
```
Displayed with mode B at `centre[MidBox]` after erasing the window; the mode becomes `Randoming`, and every further click in the window calls `DoSaltation` again.

Ambiguity in the second loop: its `factor` is read through `dGene[j]` using the FOR variable `j` left over from the first loop, whose value Pascal leaves undefined (I: likely 8, possibly 9). Both readings can hang. With `j = 8`, `dgene[8]` is fixed inside the loop, so a Shrink or Swell there with `|segDist*segNo| > 100` (possible: for example 6 x 17..20) never exits. With the evidently intended `dgene[10]` reading, Mut[8] off and Mut[2] on forces dgene[10] to Shrink or Swell on every pass, and the loop also never exits when `|segDist*segNo| > 100`. A port should use `dgene[10]` and either cap the retries or resample segNo and segDist.

### 6.2 Engineering edits (`Engineering:Manipulation`, `LeftRightPos`, `Rung`)

The 16 gene boxes sit in a bar `GenesHeight = 20` high at the top, each `(PRect width) DIV 16` wide: 1..9 = gene1..9 (and dgene1..9), 10 = segNo, 11 = segDist (and dgene10), 12 = completeness, 13 = spokes, 14 = trickle, 15 = mutSize, 16 = mutProb. A click is classified by horizontal third (`h < left + w DIV 3` left; `h > right - w DIV 3` right; else middle) and for the middle by vertical third of the 20 px bar (`v < top + 20 DIV 3` top; `v > bottom - 20 DIV 3` bottom; else middle). Edits ignore all Mut flags and operate on `child[MidBox]`.

| Box | Left third | Right third | Middle third |
|---|---|---|---|
| 1..8 | `gene -= mutSize` | `gene += mutSize` | top rung: dgene = Swell; mid: Same; bottom: Shrink |
| 9 | `gene9 -= 1` | `gene9 += 1`, then if `segNo*2^gene9 > 4095` then `gene9 -= 1` | same rungs for dgene[9] |
| 10 | `segNo -= 1` | `segNo += 1`, then if `segNo*2^gene9 > 4095` then `segNo -= 1` | none |
| 11 | `segDist -= trickle` | `segDist += trickle` | same rungs for dgene[10] |
| 12 | Single | Double | none |
| 13 | NorthOnly | Radial | NSouth |
| 14 | `trickle -= 1`, min 1 | `trickle += 1` | none |
| 15 | `mutSize -= 1`, min 1 | `mutSize += 1` | none |
| 16 | `mutProb -= 1`, min 1 | `mutProb += 1`, max 100 | none |

After the edit: `refrain = (gene9 > 12) or (gene9 < 1) or (segNo < 1) or (box >= 15)`; then `gene9 = max(gene9,1)` and `segNo = max(segNo,1)`; if not `refrain` the biomorph is redeveloped (mode B) and the gene box redrawn (boxes 15 and 16 never trigger a redraw because they do not affect the picture). The `refrain` test runs before the clamps, so going to gene9 = 0 clamps it to 1 without redrawing. A click outside the gene bar shows the "Syringe" help message and changes nothing. Edit auto-repeat while the mouse is held (first repeat delayed by the double-click time) is UI. In Engineering mode "Thicker/Thinner Pen" changes `MyPenSize` by 1 (Thinner enabled only when > 1; no upper bound apart from the 8 px line cap) and redevelops; `MyPenSize` stays in force in every other mode.

`SnapDevelop` erases `union(oldMargin, newMargin)` grown by `MyPenSize` on each side, so no remnants remain.

### 6.3 Triangle (`Triangle:Triangle`, `Concoct`, `MainTriangle`, `PlotTriangle`)

Weights for a mouse point `m`, with `b` = left corner (origin) and `H` = screen height in pixels (original hardware):
```
k = round(200 * H / 340)
x = m.h - b.h;   y = b.v - m.v          // y is "up" distance from b
r1 = y / k;   r3 = (x - y/2) / k;   r2 = (k - x - y/2) / k       // r1 + r2 + r3 = 1
```
`r1` weights the Top genome, `r2` the Left, `r3` the Right (in that order in the `Concoct` call). The weight is affine barycentric for a triangle with vertices `b=(0,0)`, `c=(k,0)`, `a=(k/2,k)`: height = base = k, not equilateral. The original corner placement (`MainTriangle`) scales with the screen: `a = (round(234*W/512), round(51*H/342))`, `b = (round(134*W/512), round(250*H/342))`, `c = (round(333*W/512), round(250*H/342))`; on 512x342 the corner spacing is 199 against `k = 201`, so at corners `a` and `c` the weight is about 0.99 (not exactly 1) and `b` is exact. A port wanting exact corners should use the actual corner spacing for `k` (I). Weights are not restricted to the triangle: any point on the screen extrapolates (weights can be negative or exceed 1).

`Concoct` builds a whole new genome (all fields assigned) from `A=Top`, `B=Left`, `C=Right`:
```
w(f) = r1*A.f + r2*B.f + r3*C.f
segNo        = max(1, round(w(segNo)))
segDist      = round(w(segDist))
completeness = clamp(round(w(ord completeness)), 0, 1)      // Single 0, Double 1
spokes       = clamp(round(w(ord spokes)), 0, 2)            // NorthOnly 0, NSouth 1, Radial 2
gene[1..9]   = round(w(gene[j]))
if segNo * 2^gene[9] > 4095: gene[9] -= 1                   // once only
gene[9] = max(gene[9], 1)
trickle = round(w(trickle));  mutSize = round(w(mutSize))   // NOT clamped here
mutProb = clamp(round(w(mutProb)), 1, 100)
dgene[1..10] = clamp(round(w(ord dgene[j])), 0, 2)          // Swell 0, Same 1, Shrink 2 (so Swell+Shrink averages to Same)
```
Consequences: extrapolated points can leave trickle or mutSize at 0 or negative (Develop clamps trickle to 1 on use, but `mutSize` stays as is), and the single `gene9--` can leave `segNo*2^gene9 > 4095`, which would reach the 4095-line failure. A port should apply the normalisation of 3.8 afterwards.

`MainTriangle` draws the triangle outline and plots the three corner genomes via `PlotTriangle` at `a, b, c`. `PlotTriangle(mouse)`: concoct into `child[special]`, develop with mode A at the mouse point, frame the grown box. The three corner genomes are set from the current biomorph by Box-menu items "Triangle Top/Left/Right". `FlickerTriangle` (live cursor preview) additionally caps `gene9 <= 6` and `segNo <= 2` when not in triangle mode; that cap is for the 16x16 cursor only.

### 6.4 Drift

See section 5. The Operation menu's Drift sets mode `Drifting`, erases the window, and leaves `child[special]` as the lineage head.

## 7. File formats

### 7.1 Record layout (`Globals:person`, `Album:SaveAnimals`, `ReadAnimals`; `SizeOfPerson = SizeOf(person)`)

Raw big-endian (68k) records, no header, trailer, count, padding or per-record separator. `SizeOfPerson` is stored in `Initialize` and every file operation writes and reads `SizeOfPerson` bytes per record, which is 40.

| Offset | Size | Type | Field |
|---|---|---|---|
| 0 | 18 | int16 BE x 9 | gene[1..9] (offset 2*(i-1)) |
| 18 | 10 | uint8 x 10 | dgene[1..10]: 0 Swell, 1 Same, 2 Shrink |
| 28 | 2 | int16 BE | segNo |
| 30 | 2 | int16 BE | segDist |
| 32 | 1 | uint8 | completeness: 0 Single, 1 Double |
| 33 | 1 | uint8 | spokes: 0 NorthOnly, 1 NSouth, 2 Radial |
| 34 | 2 | int16 BE | trickle |
| 36 | 2 | int16 BE | mutSize |
| 38 | 2 | int16 BE | mutProb |

File-level rules:
- N = number of whole 40-byte records; a trailing partial record is ignored (`IsEOF(file, 40)` is true when fewer than 40 bytes remain). At most `MaxAlbum = 100` records are read.
- Save Biomorph writes one record (Finder type `BIOM`); Save Album writes all album members in album order (type `COLL`); fossil record files (type `FOSS`) are the same record repeated, oldest first, one per breeding step when recording (the chosen parent each generation). Creator is `DAWK` for all. Type/creator live in the Finder info of the resource-less file, so the data fork alone carries no type: tell single/multi by length.
- Album write skips any member with `gene[9] = 0` (that is how "vacant/deleted slot" is represented in memory). A valid genome therefore always has `gene[9] >= 1`.
- Colour Watchmaker files share the creator but use a different format; not handled here.
- The program does no validation on load.

Decoding (verified): all 87 records in the five data files decode with every field inside its valid range.

### 7.2 Decoded data files

Written to `src/engine/zoos.json`: an array of `{source, index, genome}`, `index` 0-based within the file, in file order, genome in the schema of section 1. Counts: Alphabet zoo 24 (960/40), Exhibition zoo 60 (2400/40), Chinese character 1, Stunted 1, Handkerchief with bows 1 (87 in all).

Validation: all `dgene` bytes in {0,1,2}; completeness in {0,1}; spokes in {0,1,2}; `gene9` 2..7 (all within the cap); `segNo >= 1` and `segNo*2^gene9 <= 4095` for all; trickle 2..12; mutSize in {1,2,5,10}; mutProb in {5,10}; segNo 1..22; segDist -10..200; gene 1..8 in -510..360; max 194 lines per biomorph. Independent check: rendering all 24 Alphabet zoo records with the algorithm of section 3 gives recognisable letterforms (for example A, I, J, L, M, N, T, U, V, W, X, Y, Z, H), the Exhibition zoo gives the classic insect/tree/cross forms, Stunted a thick-trunk tree (its dgene[9] = Shrink is byte 2) and Handkerchief with bows a four-fold radial figure. This confirms the layout, the enum order Swell/Same/Shrink (bytes 0/1/2), and the development algorithm.

Spot values (Pascal-order fields):

| Source | gene[1..9] | dgene (1..10) | segNo, segDist | completeness, spokes | trickle, mutSize, mutProb |
|---|---|---|---|---|---|
| Chinese character | -16,-16,18,-8,6,-8,18,16,3 | Same,Same,Same,Swell,Swell,Swell,Same,Same,Swell,Same | 5, 5 | Single, NorthOnly | 5, 2, 5 |
| Stunted | -10,-20,-25,-15,-15,-5,15,15,6 | Same x4, Shrink, Shrink, Same, Same, Shrink, Same | 2, 149 | Single, NorthOnly | 8, 5, 10 |
| Handkerchief with bows | 18,-18,-12,6,10,-12,-18,-4,4 | Same x4, Shrink, Same, Same, Swell, Shrink, Same | 4, 6 | Double, Radial | 2, 2, 5 |

Stunted looks like a descendant of BasicTree (same signs and magnitudes, dgene[5], [6], [9] still Shrink, SegDist 149 against 150, trickle 8 against 9), which independently fixes Shrink = byte 2.

## 8. Behaviour not specified by the source (decisions for the port)

- RNG: any uniform generator (4.1). Mutation rate `(n-1)%` and the half-rate `(mutProb DIV 2 - 1)%` should be copied exactly.
- Integer width: use 32-bit and clamp gene values to a sane range if overflow of the original 16-bit arithmetic matters. Normal biomorphs never overflow (`len <= 11`, typical |gene| <= 600).
- Normalise genomes (`segNo >= 1`, `trickle >= 1`, `gene9 >= 1`, cap `segNo*2^gene9 <= 4095` by repeated decrement) before developing, and when loading files or after Triangle extrapolation.
- Replace the fatal `PicSizeMax` error with a refusal.
- Hopeful Monster: cap loop iterations (6.1).
- Box size: the original is screen-dependent; fix a size (101x100 matches the 512x342 original) and clip.

## 9. Discrepancies between the original and the other versions

Original vs Canon (`pascal2ndEd`): no change in engine logic. Structural differences only: `Develop` takes a `ZeroMargin` parameter and never draws (the `DelayedDrawing` global is gone; callers call `DrawPic`); `Tree` receives the biomorph by value, so its `trickle < 1` clamp no longer persists to the caller; `Direction` takes the child as a parameter; `DoSaltation` calls `Develop` then `DrawPic` explicitly (same placement, mode B).

Original vs JS port (read, not executed):
1. `develop`: JS skips the horizontal bounding-box symmetrisation for NorthOnly + Single and centres on the actual bbox centre in x as well as y; the original always symmetrises, so asymmetric biomorphs (for example the "J" and "L" in the Alphabet zoo) sit with their root x on the box centre in the original but are bbox-centred in JS. Also JS centres with a non-truncated `/2`.
2. `SwellType`: JS uses Swell=1, Shrink=2, Same=3 and `readFromArrayBuffer` does `byte + 1`, so file byte 1 (Same) becomes JS Shrink and byte 2 (Shrink) becomes JS Same. `writeToArrayBuffer` is the inverse, so JS-written files do not match the original format (Same would be written as byte 2). Also Triangle's ordinal interpolation uses that order, so a Swell/Shrink blend gives Shrink instead of Same. Probable bug.
3. `makeGenes`: JS sets Single when the Asymmetry gene is shown, so Chess and Insect are Single in JS; the original template sets Double (only BasicTree sets Single).
4. `doSaltation`: JS `trickle = RandInt(10)` (original `1 + RandInt(100) DIV 10`, 1..11); JS `gene9 = RandInt(6)` without the `> 1` retry (original 2..6); the retry-loop `j` ambiguity is resolved in JS as dgene[9] (1-based).
5. `Manipulation`: JS gates edits by Mut/"Genes" flags, adds a "Gene 9 can be Zero" option (min 0), tests the cap before incrementing and drops the original's `refrain` rule. The original ignores Mut flags in Engineering and never allows gene9 = 0.
6. `reproduce`: JS requires only Mut[8] (Tapering Twigs) for dgene[9] mutation (original: Mut[8] and Mut[9]); JS reinterprets Mut[9] as "gene9 may be 0" (original: no such meaning); JS also gates by the "Genes" menu.
7. `triangle`: JS `k = round(200.5 * H / 340)` where H is the triangle pane height (original `200 * screen height / 340`); JS `Math.round` rounds negative ties differently from Pascal ROUND.
8. `RandInt`: JS `floor(random()*n)+1` (uniform) against Pascal `1 + abs(random) MOD n`.

Constants worth re-checking if numbers look off: the original uses 340 in `Triangle` but 342 in `MainTriangle`.

## 10. Verification performed

A reference implementation of sections 3.1 to 3.7 (Python, kept outside the repo) renders the Alphabet and Exhibition zoos as described in 7.2. Implementation-derived test vectors (I), root at (0,0), mode A before translation, margin after finalisation as `[left, top, right, bottom]`:

| Genotype | Lines | margin | Mode-A shift (translate y by) |
|---|---|---|---|
| BasicTree | 129 | [-37, -56, 37, 16] | +20 (margcentre = -20) |
| Insect | 32 | [-15, -15, 15, 21] | -3 (margcentre = 3) |
| Chess | 64 | [-15, -36, 15, 5] | +16 (margcentre = -16) |

Worked start of BasicTree (trickle 9, order 7, seg 1 odd): line 1 is (0,0)-(0,-11) thick 7 (`7*-15 DIV 9 = -11`); line 2 is (0,-11)-(-6,-21) thick 6; line 3 (-6,-21)-(-17,-21) thick 5. The segment-2 connector is (0,0)-(0,16) thick 7 (`150 DIV 9 = 16`), and the whole biomorph has 129 lines (2 x 64 + 1).

## 11. Gaps and follow-ups

- The menu resource text (Mutations menu, Help strings) is not in the repo; labels in 4.2 come from the Carbon port.
- Exact QuickDraw line rasterisation tie-breaking and the Toolbox `Random` sequence were not verified.
- The post-FOR value of `j` in `DoSaltation` is compiler-dependent (6.1).
- Pedigree box snapping (`AtLeast`, multiples of 8) is described only briefly; the UI owner should read `Pedigree:SpawnOne` for exact geometry.
