# Blind Watchmaker (monochrome): user-interface and behaviour specification

Scope: everything the user sees and does. The genome, development, line geometry, mutation rules and file records are in `engine.md` (other author) and are only cross-referenced here.

Baseline: the Think Pascal source of v1.1 (September 1993 maintenance release of Dawkins' program; the About box says "Version 1.1" and the `vers` resource says v1.1). All facts below describe v1.1 unless stated. The manual (Appendix I of the book; its competition closing date of 31 December 1990 puts it around 1989-90, I) describes an older build; differences are listed in section 11.

## 0. Sources, tags, confidence

Tags used on every fact:

| Tag | Source |
|---|---|
| `[UI]` `[Main]` `[Init]` `[Glob]` `[Eng]` `[Bio]` `[Ped]` `[Tri]` `[Alb]` `[Fos]` `[Misc]` `[Err]` | Original Pascal files "User Interface", Main, Initialize, Globals, Engineering, Biomorphs, Pedigree, Triangle, Album, Fossils, Miscellaneous, ErrorUnit.p in `docs/Dawkins/Monochrome WatchMaker/`. A procedure name follows after a colon, e.g. `[Bio:Evolve]`. |
| `[R:type id]` | Resource fork contents. The real fork (`BW.rsrc`) is not readable in the repo; I decoded Canon's Rez dump `docs/pascalCarbonUPI/Source code/Monochrome WatchMaker/Mono/BW.r` (same-size copies in `Colour/` and `Arth/`). It contains MENU, ALRT, DLOG, DITL, STR#, STR, CURS, PICT, vers, but no WIND (the windows are built in code). Its menus agree with the code's menu constants and with Canon's JS cheat sheet, so I treat it as the 1993 fork (I). |
| `[Man]` | Dawkins' manual, `docs/pascalCarbonUPI/docs/MonochromeWatchmakerManual.txt` (older build than v1.1). |
| `[Carb]` | Canon's Carbon port (post-2015, not original). |
| `[JS]` | Canon's JS port `blind-watchmaker-js` (not original; has extra features, see section 11). |
| `(I)` | My inference or recommendation, not stated in a source. |

Where the original and a secondary source disagree, the original wins. Tick = 1/60.15 s (Mac `TickCount`).

## 1. Screen, windows, menu bar

### 1.1 Target screen

- All geometry is computed from the screen bounds (`ScreenBits.Bounds`); nothing in the window layout is fixed in pixels `[Init:Initialize]`. Only Triangle hard-codes proportions of a 512 x 342 screen `[Tri:MainTriangle]`. An error string mentions "A3" large screens `[R:STR# 128 #6]`.
- Display is 1-bit black and white QuickDraw: white paper, black ink, no greys, no anti-aliasing. "Erase" = fill white; "highlight" = invert the rectangle (`InvertRect`) `[Bio:DoHighlight]`, `[Alb:Emphasize]`.
- Baseline for the recreation (I): logical screen 512 x 342 (Mac Plus/SE), integer-scaled. The same formulas give larger grids on bigger screens (engine.md section 3.10 lists 640x480 and 1024x768).

### 1.2 Windows

| Window | Title | Style | Rect (512 x 342 screen) | Source |
|---|---|---|---|---|
| Main ("breeding window") | none | `plainDBox`: no title bar, no close, zoom or grow box, visible, always the whole screen below the menu bar | global (2,20)-(510,340), content 508 x 320; local origin (0,0). 2 px margin left, right, bottom; top abuts the 20 px menu bar | `[Init:Initialize]` (`Left+2, Top+20, Right-2, Bottom-2`) |
| Fossils (playback) | "Fossils" | `DocumentProc` (title bar, close box, grow box, no zoom), created hidden, shown only during playback | content (52,90)-(460,290) = 408 x 200, title bar above it. Resizable between 50 x 20 and (screen-5) x (screen-10); draggable within (20,20)-(507,332) | `[Init:Initialize]`, `[Alb:StartPlayBack]` |

- Desk pattern shows in the 2 px margins; the plain window has a 1 px black border (I).
- The main window is never moved, resized or closed. There is no title text, no status line, no mode label and no counter anywhere on screen. The only text drawn by the program in the main window is the gene strip (section 3) and "Album Page N" on album pages `[Bio]`, `[Alb:StickInAlbum]`. The window is created with an empty title `[Init:Initialize]`, and no code draws a mode name, so the current mode is shown only by the pointer shape and by which menu items are enabled (I). The Carbon port later added mode titles ("Breeding", "Engineering", "Pedigree (Move biomorph)", "Triangle", "Hopeful Monster", "Drifting", "Album", "Highlighting") `[Carb:ModeDefs]`; these are optional extras, not original.
- Fossils window contents: a vertical scroll bar on the right edge (16 px wide, from y = -1 to height-14, i.e. the bottom-right 15 x 15 is the grow icon), the fossil biomorph drawn at the centre of the area left of and above the scroll bar (mid-point = half of width-17 by half of height-17) `[Init:Initialize]`, `[Alb:StartPlayBack]`. No gene strip, no number, no frame.

### 1.3 Menu bar

- Standard 20 px Mac menu bar `[Init]` (window top = 20; dialogs avoid y < `GetMBarHeight + 7`, `[Misc:PositionDialog]`).
- Normal bar, left to right: Apple, File, Edit, Operation, View, Mutations, Pedigree, Help `[Misc:LargeMenus]`, `[Glob]` (menu IDs 1000, 1001, 1002, 1004, 1005, 1006, 1007, 3238), titles `[R:MENU]`. There is no Window or Album menu.
- During Fossil playback the bar shrinks to three menus: Apple, Exit, Help `[Misc:SmallMenus]`, `[Alb:StartPlayBack]`; it returns to the eight-menu bar when the playback window closes `[Alb:ClosePlayBack]`.
- A menu title stays inverted while its command runs and is un-highlighted only when the command returns (`HiliteMenu(0)` after the `CASE`) `[UI:HandleMenu]`. So during a Breed animation the "Operation" title remains black. A command-key shortcut also flashes its menu title `[UI:KeyDownEvents]` (`MenuKey`).
- Non-command keystrokes do nothing (the handler only sets an unused variable; the evolve-toward-target hook is commented out) `[UI:DoKeypress]`.

## 2. Breeding-window geometry

Local window coordinates (origin top-left of content). `PRect` = (0,0)-(W,H) with W = 508, H = 320 on the baseline screen `[Init]`.

- Gene strip: top `GenesHeight = 20` px `[Glob]`, section 3.
- Grid below the strip: `boxwidth = W DIV NCols`; `boxheight = (H - 20) DIV NRows`; box k at row r, col c (1-based, row-major) has top-left `(boxwidth*(c-1), 20 + boxheight*(r-1))` and size boxwidth x boxheight `[Bio:SetUpBoxes]`. Leftover pixels at the right and bottom are blank.
- Defaults: 3 rows x 5 columns = 15 boxes, 101 x 100 px each; box 8 (row 2, col 3) is the centre `MidBox = NBoxes DIV 2 + 1` `[Init]`, `[Bio:SetUpBoxes]`. Box centre = `(left + boxwidth DIV 2, top + boxheight DIV 2)`; for box 8 that is (252,170).
- Rows and columns are always odd (start at 3 and 5, change by 2, minimum 1) so a centre box always exists. `NRows * NCols <= MaxBoxes = 100` `[Bio:DoRowMore]`, `[Glob]`.

| Rows x cols | Boxes | Centre | Box size (px) on 512 x 342 |
|---|---|---|---|
| 1 x 1 | 1 | 1 | 508 x 300 |
| 1 x 5 | 5 | 3 | 101 x 300 |
| 3 x 3 | 9 | 5 | 169 x 100 |
| **3 x 5 (default)** | 15 | 8 | 101 x 100 |
| 5 x 5 | 25 | 13 | 101 x 60 |
| 3 x 7 | 21 | 11 | 72 x 100 |
| 5 x 7 | 35 | 18 | 72 x 60 |
| 7 x 9 | 63 | 32 | 56 x 42 |
| 9 x 11 | 99 | 50 | 46 x 33 |

- Frames: in breeding mode every box except the centre gets a 1 px black frame; the centre box gets a 3 px frame `[Bio:SetUpBoxes]` (`PenSize(3,3)`). QuickDraw frames lie inside the rectangle, so adjacent box frames form a 2 px dividing line (I, from QuickDraw semantics; consistent with the Carbon screenshot `docs/pascalCarbonUPI/docs/img/Breeding.png`).
- Box contents: each biomorph is clipped to its own box and never scaled `[Bio:Evolve]`, `[Bio:GrowChild]` (`ClipRect(Box[j])`). Placement inside a box: engine.md section 3.7 (vertically re-centred on its bounding box, root x on the box centre).
- Album pages use the same 3 x 5 geometry but no frames at all `[Alb:StickInAlbum]`, `[Bio:SetUpBoxes]` (frames only drawn when mode = breeding); screenshot `AlbumPage1.png` confirms.
- The "Preliminary" layout (after changing rows/columns): every box including the centre is framed 1 px, only the centre holds a biomorph, no gene strip `[Bio:DoShowBoxes]`, `[Misc:BoxesOnly]`.

## 3. Gene strip ("chromosome")

### 3.1 Layout `[Bio:GeneBoxTemplate]`, `[Bio:ShowGeneBox]`

- 16 boxes side by side across the top 20 px of the window, each framed 1 px, `genewidth = W DIV 16` wide (31 px on the baseline; 16 x 31 = 496, so the rightmost 12 px of the strip are empty and are not a gene box). Box j spans x from `31*(j-1)` to `31*j`, y 0 to 20.
- Text is drawn at the port's default font (no `TextFont` call anywhere) at 9 pt `[Init]`, baseline y = 14 (box top + 14). Font family is the system font unless set elsewhere (I; Chicago scaled to 9 pt on real hardware, which looked blocky; Geneva 9 or a similar bitmap font is the practical match). Numbers must fit 31 px.
- The strip is drawn in full when Breeding starts, when Engineering starts, when Hopeful Monster is drawn, and when Highlight is chosen `[Bio:DoBreed]`, `[Eng:DoEngineer]`, `[Eng:DoSaltation]`, `[Bio:DoHighlight]`. It is not drawn in Drift, Triangle, Album, Pedigree, Fossil playback.

### 3.2 What each box shows

| Box | Gene | Display | Source |
|---|---|---|---|
| 1-9 | `gene[1..9]` | Plain integer (no plus sign), horizontally centred in the box using the measured string width | `[Bio:ShowGeneBox]` |
| 10 | `SegNoGene` (number of segments) | Signed integer with a "+" or "-" prefix, starting at x = left + 7 | `[Bio:ShowGeneBox]`, `[Misc:DrawInt]` |
| 11 | `SegDistGene` (distance between segments) | Signed integer as above | same |
| 12 | `CompletenessGene` | Text " Asym" (single-sided) or "  Bilat" (double); leading spaces are part of the string, drawn from x = left + 2 | `[Bio:ShowGeneBox]`, `[R:STR# 12947 #1-2]` |
| 13 | `SpokesGene` | " Single" (north only), "  UpDn" (north-south), " Radial" | `[R:STR# 12947 #3-5]` |
| 14 | `TrickleGene` (scaling factor) | Signed integer | `[Bio:ShowGeneBox]` |
| 15 | `MutSizeGene` | Signed integer | same |
| 16 | `MutProbGene` | Signed integer (normally positive; the mutator step can carry it below zero, shown "-n") | same |

- Gene functions in Dawkins' manual (callouts of its diagram): genes 1-3 horizontal extent, 4-8 vertical extent, 9 number of branches, 10 number of segments, 11 distance between segments, 12 two- or one-sided, 13 up-down and radial symmetry, 14 scaling factor, 15 mutation size, 16 mutation rate `[Man]`.
- Gradient markers: a solid black bullet (Mac Roman character 165) in the box. "Increasing" gradient (`Swell`): bullet at the top-left (x = left + 2, baseline top + 7). "Decreasing" (`Shrink`): bullet at the bottom-left (baseline top + 21, so it hugs the bottom edge). No bullet = no gradient. Boxes 1-9 use `dGene[1..9]`; box 11 uses `dGene[10]`. No other boxes carry a marker `[Bio:ShowGeneBox]`. Screenshot `Breeding.png` shows the bottom-left dots `[Carb]`.
- Each box is erased inside its 1 px frame (`EraseInnerRect`) and redrawn on update `[Bio:ShowGeneBox]`.

### 3.3 Live behaviour while breeding or highlighting `[Main]` (main loop), `[Bio:ShowChangedGene]`

- On every pass of the event loop, if the mode is Breeding or Highlighting and the main window is in front, the box under the pointer is found. If it differs from the previously hovered box (`OldBox`), only the gene boxes whose values differ between the two biomorphs are redrawn with the values of the hovered one. The strip therefore always shows the genes of the biomorph the pointer is over; moving onto the strip or outside the boxes leaves the last values in place.
- Quirk: after a new litter appears, the strip is not refreshed; the next hover compares the new child in the old slot against the new hovered child, so a gene whose value happens to match keeps a stale number from the previous litter (I, from reading the diff logic). A recreation should simply show the hovered biomorph's 16 values.
- In Engineering the strip is static; it changes only when a gene is clicked (section 6.4).

## 4. Menus (exact titles and order)

Titles, items, separators and key equivalents from `[R:MENU]` (Cmd = Command key). Enable and check rules from `[UI:MenuGreyAdjust]` (run on every event-loop pass) unless noted. "Special > 0" means an active biomorph exists, which is always true after start-up in practice.

### 4.1 Apple (title is the Apple glyph, ID 1000)

| Item | Key | Rule |
|---|---|---|
| About Blind Watchmaker | | always; opens About dialog (section 8.2) |
| (separator) | | |
| (installed desk accessories, appended by the system) | | not applicable to a web version |

### 4.2 File (ID 1001)

| # | Item | Key | Enabled when | Action |
|---|---|---|---|---|
| 1 | Load to Album... | L | album not full (fewer than 100 members and not "page 4 full") | file chooser; appends biomorphs to the album (6.7) |
| 2 | Load as Fossils... | O | always | file chooser; replaces the fossil record and opens playback (6.8) |
| 3 | Save Biomorph... | | Special > 0 | file chooser; saves the active biomorph |
| 4 | Save Fossils... | F | fossil file not empty | saves the fossil record |
| 5 | Save Album... | S | album has at least one non-cleared member | saves the whole album |
| 6 | Close Album | W | album non-empty and mode = Albuming | discards the album (6.7) |
| 7 | Quit | Q | always | quit with save prompts (section 9) |

No separators. Save dialogs use the prompts "Save Biomorph", "Save Fossils", "Save Album" and remember the last file name typed `[R:STR 3866, 9520, 10281]`, `[Alb:SaveAnimals]`. Load dialogs list only Dawkins biomorph and collection files `[Alb:ReadAnimals]`, `[Misc:DawkFilter]`.

### 4.3 Edit (ID 1002)

| # | Item | Key | Enabled when | Action |
|---|---|---|---|---|
| 1 | Undo | Z | never in this program (exists only for desk accessories) | none; `[Misc:OwnEditMenu]`, `[Man]` |
| 2 | (separator) | | | |
| 3 | Cut | X | never | none |
| 4 | Copy | C | Special > 0 | put the active biomorph on the clipboard as a picture; also remembered for Paste (6.13) |
| 5 | Paste | V | only while Albuming, a biomorph has been copied, and the selected album slot is a cleared slot | pastes the copied biomorph into that slot |
| 6 | Clear | | mode = Albuming and Special > 0 | blanks the selected album slot (6.7) |
| 7 | (separator) | | | |
| 8 | Highlight Biomorph | | mode = Breeding or Highlighting | 6.2 |
| 9 | Add Biomorph to Album | A | mode in {Highlighting, Engineering, Triangling, Phyloging, Moving, Detaching, Breeding, Randoming} and album not full | 6.7 |
| 10 | Show Album | | album non-empty | 6.7 |

Items 9 and 10 first save the breeding screen (unless already Albuming), switch the grid to album geometry (`NRows, NCols := AlbumNRows, AlbumNCols`) and set mode Albuming; the breeding row and column counts are restored afterwards `[UI:DoEditMenuCommands]`. Highlight and Add act on the active biomorph, which is the parent in Breeding and the clicked one in Highlighting (6.2).

### 4.4 Operation (ID 1004)

| # | Item | Key | Enabled when | Check | Action |
|---|---|---|---|---|---|
| 1 | Breed | B | Special > 0 | | 6.1 |
| 2 | Drift | D | Special > 0 | | 6.3 |
| 3 | Engineering | E | Special > 0 | | 6.4 |
| 4 | Hopeful Monster | M | always | | 6.5 |
| 5 | Initialize Fossil Record | I | always | | text becomes "Reinitialize Fossil Record" once any fossil exists `[UI:MenuGreyAdjust]`; 6.8 |
| 6 | Play Back Fossils | | fossils exist and mode = Breeding | | 6.8 |
| 7 | Recording Fossils | R | fossils exist (greyed until the first fossil is written) | check = recording on | toggles recording |
| 8 | Triangle | T | always | | 6.6 |

Note the check mark can show on a greyed "Recording Fossils" straight after Initialize Fossil Record, because the check follows the recording flag and the enable follows the file `[UI:MenuGreyAdjust]` (I on how it looks).

### 4.5 View (ID 1005; the code calls it the Boxes menu)

| # | Item | Enabled when | Check | Action |
|---|---|---|---|---|
| 1 | More Rows | mode in {Breeding, Highlighting, Preliminary, Drifting} and fewer than 100 boxes (a step that would exceed 100 is silently refused) | | rows + 2 |
| 2 | Fewer Rows | same modes and rows >= 3 | | rows - 2 |
| 3 | More Columns | as item 1 | | columns + 2 |
| 4 | Fewer Columns | same modes and columns >= 3 | | columns - 2 |
| 5 | Thicker Pen | mode = Engineering | | pen size + 1, redraw |
| 6 | Thinner Pen | mode = Engineering and pen size > 1 | | pen size - 1, redraw |
| 7 | Drift Sweep | always | check = sweep view on | toggle; restarts the sweep at box 1 |
| 8 | Make top of triangle | always | | 6.6 |
| 9 | Make left of triangle | always | | 6.6 |
| 10 | Make right of triangle | always | | 6.6 |

No separators. A "hide windows in background" item (index 12) exists in the code but not in the resource, so it is not in the menu `[Glob]`, `[UI:DoBoxMenuCommands]` vs `[R:MENU 1005]`. Every View command also records the grid size as the breeding grid `[UI:DoBoxMenuCommands]`.

### 4.6 Mutations (ID 1006; all items check-able, one flag each)

| # | Item | Default | Notes |
|---|---|---|---|
| 1 | Segmentation | checked | |
| 2 | Gradient | checked | greyed whenever Segmentation is unchecked; unchecking Segmentation also unchecks Gradient, and re-checking Segmentation does not re-check Gradient `[UI:DoMutationMenuCommands]` |
| 3 | Asymmetry | checked | |
| 4 | Radial Sym | checked | |
| 5 | Scaling Factor | checked | |
| 6 | Mutation Size | unchecked | |
| 7 | Mutation Rate | unchecked | the manual also says gene 16 mutation is off by default `[Man]` |
| 8 | Tapering twigs | checked | |

Defaults `[Init:Initialize]` (flags 1-5 on, 6-7 off, 8 on). The code also has a ninth flag, on by default, with no menu item `[Glob]` (`MutTypeNo = 9`), `[R:MENU 1006]`; see engine.md 4.2. Item-to-gene mapping in engine.md 4.2. Help text: a category left unchecked freezes evolution of that feature; the book's original 9-gene program is a subset reproduced by unchecking the first four categories `[R:STR# 21128]` (but note the starting tree is single-sided with two segments, so a recreation of the book's behaviour also needs the genes set accordingly, I).

### 4.7 Pedigree (ID 1007)

| # | Item | Key | Enabled when | Check |
|---|---|---|---|---|
| 1 | Display pedigree | 1 | Special > 0 | |
| 2 | (separator) | | | |
| 3 | Draw Out Offspring | 2 | mode in {Moving, Detaching, Phyloging, Killing} | not checked |
| 4 | No Mirrors | 3 | mode = Phyloging | radio, default |
| 5 | Single Mirror | 4 | mode = Phyloging | radio |
| 6 | Double Mirrors | 5 | mode = Phyloging | radio |
| 7 | (separator) | | | |
| 8 | Move | 6 | same four modes as item 3 | not checked |
| 9 | Detach | 7 | same | not checked |
| 10 | Kill | 8 | same | not checked |

The four mode items never get a check mark in the code (only the mirror radio is maintained) `[UI:DoPedigreeMenuCommands]`; the mode is shown by the pointer only. Item 6's title is the plural "Double Mirrors" in the resource (the JS port says "Mirror"). Mirror radio = 1, 2 or 4 rays (6.9). The JS port shows pedigree mode items as checkboxes; not original.

### 4.8 Help (ID 3238)

| # | Item | Key | Action |
|---|---|---|---|
| 1 | Help with current operation | H | help dialog for the current mode (8.3) |
| 2 | Miscellaneous Help | | miscellaneous help dialog |

Both always enabled `[UI:MenuGreyAdjust]`.

### 4.9 Exit (ID 21537; shown only during Fossil playback, instead of the full bar)

| # | Item | Key | Action |
|---|---|---|---|
| 1 | Close Window | W | close playback, back to the previous screen |
| 2 | Breed from Current Fossil | B | breed from the fossil on display (6.8) |
| 3 | Quit | Q | quit |

### 4.10 Keyboard

Only Command-key shortcuts exist, dispatched through the menu table `[UI:KeyDownEvents]`. Shortcut letters above are from `[R:MENU]`. Whether the Menu Manager ignores disabled items for key equivalents is standard Mac behaviour and is assumed (I). Browser note (I): Cmd-W, Cmd-Q, Cmd-T, Cmd-N, Cmd-1..8 cannot be reliably captured by a web page; plan remapped or additional shortcuts (and a visible menu bar with the same titles).

## 5. Pointer, modes, event loop

### 5.1 Modes `[Glob]`

Fourteen modes: Preliminary, Breeding, Albuming, Phyloging (Pedigree draw-out), Killing, Moving, Detaching, Randoming (Hopeful Monster), Engineering, Drifting, Highlighting, PlayingBack, Triangling, Sweeping. "Sweeping" is declared but never assigned; sweep drift is Drifting with the Drift Sweep check on `[UI:DoSweep]`, `[Main]`. Start-up mode is Preliminary, then Breeding after the first `DoBreed` `[Init]`, `[Main]`.

### 5.2 Pointer by mode `[Main:CursorAdjust]`

Applies only over the main window while it is in front; outside it the pointer is the standard arrow.

| Mode / place | Pointer | Hotspot (row, col) `[R:CURS]` |
|---|---|---|
| Preliminary | system "plus" cursor (fat cross) | system |
| Breeding | "breed" cursor (id 145): 16 x 16 reverse-video (white on black) glyph | (6,9) |
| Highlighting, Albuming | solid black block (id 142), about 8 x 11 | (8,8) |
| Randoming | "random" cursor (id 144): a die in perspective | (7,8) |
| Phyloging (draw out) | "draw-out" cursor (id 147): a hand pulling a line | (7,7) |
| Moving | pointing hand (id 146), fingertip at top-left | (0,1) |
| Detaching | scissors (id 148) | (2,2) |
| Killing | gun (id 149), points left | (7,0) |
| Triangling | live biomorph thumbnail (below) | (8,8) |
| Engineering, over the strip, left third of a gene box | left-pointing solid arrowhead (id 135), about 6 x 13 | (7,14) |
| right third | right-pointing arrowhead (id 136) | (7,14) |
| middle third, genes 1-9 and 11, top third of the box | up arrowhead (id 137) | (1,7) |
| middle third, same genes, middle third of the box | equals sign (id 139): two 9 px bars, 2 rows apart | (4,7) |
| middle third, same genes, bottom third | down arrowhead (id 138) | (1,7) |
| middle third of genes 10, 12, 13, 14, 15, 16 | equals sign | (4,7) |
| Engineering, anywhere not on a gene box | hypodermic needle (id 140), horizontal, plunger on the left | (7,7) |
| Drifting and any mode not listed above | thin cross (system cross) | system |
| Fossils window in front | standard arrow (the pointer routine runs only while the main window is in front) (I) | |
| Album Zoom, over a page quadrant | lens (id 150) | (6,8) |
| Album Zoom, above the top 15 px | arrow | |
| Pedigree, button held inside a box | 16 x 16 shrunken copy of that box (or the thin cross if the box is 16 px or smaller) | (8,8) |
| Pedigree, while births are drawn | a single-dot cursor, then the draw-out hand again | |
| During `DoUpdate`, `DoLoad`, `SaveAnimals`, `DoBreed`, `Evolve` | watch (system cursor 4) | |
| About box | cross | |

Unused cursor resources: "Q" (141), "box" (143), "blank" (151, used once for the first triangle frame). Bitmaps are in `[R:CURS 135..151]` of `BW.r` for anyone who wants to consult them; they are not reproduced here.

### 5.3 Pointer hiding `[Bio:Slide]`, `[Bio:Evolve]`, `[Main:DoDrift]`, `[Main:DoSweep]`, `[Ped:FollowMouse]`

`ObscureCursor` is called at the start of the glide, of each drift or sweep step, and of the Move drag (`HideCursor`). The pointer vanishes until the mouse next moves. During breeding the user therefore sees no pointer until they touch the mouse again. The watch pointer is set at the start of breeding and during loads, saves and window updates, but with the pointer hidden it is rarely visible while a litter is drawn (I).

### 5.4 Event handling facts relevant to a port

- Single-threaded: a Breed animation runs to completion; clicks made meanwhile stay in the event queue and run afterwards (the code does not flush the queue after Evolve) `[Bio:Evolve]` (I on queue behaviour).
- Idle sleep passed to `WaitNextEvent`: 2 ticks in sweep drift, 20 ticks in all other modes; without `WaitNextEvent` (System 6) the loop is unthrottled `[Main:GetAnEvent]` (see 7.3).

## 6. Operations in detail

### 6.1 Breed

Entry points: Operation > Breed (Cmd-B); program start (with the Standard Tree); Exit > Breed from Current Fossil `[UI:DoOperationMenuCommands]`, `[Main]`.

Start of breeding `[Bio:DoBreed]`:
1. Pointer = watch. Grid is reset to the saved breeding grid (default 3 x 5) `[UI:DoOperationMenuCommands]`.
2. Whole window erased, then the 14 outer boxes framed 1 px and the centre box framed 3 px.
3. Gene strip drawn for the parent (all 16 boxes).
4. Parent drawn in the centre box.
5. A first litter is grown exactly as if the parent had been clicked (below).
6. If recording fossils, the parent is appended to the fossil record.

Clicking in box j `[UI:HandleClick]`, `[Bio:Evolve]`:
- Hit test is on the box rectangles only. A click on the gene strip, on the blank margin or between boxes does nothing visible (no beep) (I; but if recording, the parent is written again, an original quirk).
- Sequence (all in this order, no user input accepted):
  1. Pointer watch, then hidden.
  2. Every other box is erased at once (picture and frame); the chosen box's own frame is wiped. The screen shows only the chosen biomorph.
  3. Glide: the chosen biomorph slides from its box to the centre box. Each step waits for the next tick, then moves by half the remaining distance (or the whole remainder once it is 20 px or less), independently in x and y. Typical distances take 4 or 5 ticks, about 70-85 ms in total; no step if the centre box was clicked.
  4. All frames reappear at once (3 px centre frame).
  5. The 14 offspring are produced in row-major order, skipping the centre: for each, a 1 px XOR line is drawn from the centre-box centre to the child's box centre, held for 2 ticks (about 33 ms), and XOR-erased; the child is mutated from the parent and drawn into its box (clipped to the box). The line therefore flashes like an umbilical cord just before each child appears.
  6. If recording fossils, the new parent is appended.
  7. Pointer returns when the mouse moves; shape = breed cursor.
- Clicking the centre box (the parent) regrows a fresh litter from the same parent.
- The previous generation vanishes instantly (step 2); there is no fade and no history on screen.

### 6.2 Highlight Biomorph (Edit menu)

`[Bio:DoHighlight]`, `[Alb:Emphasize]`, `[UI:HandleClick]`.
- Choosing it inverts the active biomorph's whole box (white lines on black), sets mode Highlighting, and redraws the strip for it.
- While in Highlighting, a click on any box moves the inversion to that box (previous box un-inverted) and makes it the active biomorph; nothing breeds; the strip keeps tracking the hovered biomorph. Clicks off the boxes do nothing.
- The highlighted biomorph is then what Save Biomorph, Add Biomorph to Album, Copy, Engineering, Drift, Display pedigree and Breed act on. Breed leaves Highlighting and starts a new breeding screen with it as parent `[UI:DoOperationMenuCommands]`.
- Choosing Highlight when already Highlighting does nothing. Not available from Drift despite code that handles it (menu item is disabled).
- The manual calls this the "Active Biomorph" concept and says Highlight is in an "Album" menu `[Man]`; in v1.1 it is in Edit.

### 6.3 Drift (Operation > Drift, Cmd-D)

`[UI:DoOperationMenuCommands]`, `[Main:DoDrift]`, `[Main:DoSweep]`, `[Man]`, `[R:STR# 8947]`.
- Entry: window erased, mode Drifting, counters reset. Nothing is drawn until the pointer is inside the window.
- Drift runs only while the pointer is inside the window area (not in the menu bar, not in the 2 px margin) `[Main]`. Moving the pointer up into the menu bar pauses it after the current picture; moving back in resumes. To stop, choose another operation. Dawkins notes it otherwise continues indefinitely, ending only in a size error `[Man]`.
- No selection and no clicks. Each step mutates the single biomorph once (same mutation rules as breeding) and shows the result.
- Cinematic view (Drift Sweep unchecked, default): each step draws the new biomorph off screen, then replaces the whole grid area of the window with it in one blit: root at the window centre (254,160 on the baseline), no box, no frame, no gene strip (the strip stays blank because the window was erased on entry), clipped to the grid area below the strip. Flicker-free, no progressive drawing `[Main:DoDrift]`, `[Bio:Snapshot]`, `[Init]` (`MidScreen`).
- Sweep view (Drift Sweep checked): steps cycle through the boxes of the current grid in row-major order and wrap around. For each step the previous box's frame is wiped (3 px white pen), the new box is erased, framed 1 px, and the biomorph is drawn in it progressively (vertically re-centred, clipped) `[Main:DoSweep]`. Old pictures stay until the sweep overwrites them, so the screen fills with a trail of unframed biomorphs and one framed "current" box. There is no mutation selection; it is the same lineage in order.
- Quirk (I): the stored active biomorph is advanced one mutation beyond the picture last shown, so after leaving Drift the active biomorph is not exactly what is on screen.
- Termination: the manual says drift can end in a "Biomorph Too Large" error `[Man]`; the original shows that alert and quits when a picture would need more than 4,095 lines (section 8.1). The size cap in the code (engine.md 3.8) makes this unlikely for compliant genomes, but drift can still produce very large biomorphs, which the help text warns about `[R:STR# 8947]`.
- Pacing is in 7.3.

### 6.4 Engineering (Operation > Engineering, Cmd-E)

`[Eng:DoEngineer]`, `[Eng:Manipulation]`, `[UI:HandleClick]`, `[Main:CursorAdjust]`.
- Entry: window erased, the active biomorph is copied into the centre slot and drawn there (centred; progressively), 16-box strip drawn. Pointer = hypodermic everywhere except over a gene box.
- Gene boxes accept clicks; the click zone inside a box is by thirds, left to right and top to bottom `[Eng:LeftRightPos]`, `[Eng:Rung]`:

| Gene box | Left third | Middle third | Right third |
|---|---|---|---|
| 1-8 | value minus the biomorph's own mutation size (gene 15) | by vertical third: top = increasing-gradient bullet, middle = no gradient, bottom = decreasing-gradient bullet | value plus gene 15 |
| 9 | minus 1 (minimum 1) | gradient by vertical third as above | plus 1 (undone if segments x 2^gene9 > 4095) |
| 10 (segments) | minus 1 (minimum 1) | nothing | plus 1 (undone if over the size cap) |
| 11 (segment distance) | minus gene 14 (the scaling factor) | gradient on segment distance by vertical third, bullet shown in this box (the only box with a marker besides 1-9) | plus gene 14 |
| 12 | set Asym | nothing | set Bilat |
| 13 | set Single | set UpDn | set Radial |
| 14 (scaling) | minus 1 (minimum 1) | nothing | plus 1 |
| 15 (mutation size) | minus 1 (minimum 1) | nothing | plus 1 |
| 16 (mutation rate) | minus 1 (minimum 1) | nothing | plus 1 (maximum 100) |

- Redraw: genes 15 and 16 do not redraw the biomorph (they do not affect its shape) but their number updates; all other changes redraw the biomorph and update the clicked gene box. The biomorph is redrawn off screen over the union of the old and new bounding boxes and blitted, so it appears all at once with no flicker `[Eng:SnapDevelop]`, `[Bio:Snapshot]`.
- Auto-repeat: pressing and holding repeats the edit. The first click is followed by a pause equal to the system double-click time before repeating starts; after that the program re-posts a mouse-down while the button is still down, so the edit repeats as fast as the redraw allows, at whatever gene box the pointer is then over (I). Releasing the button resets the delay `[UI:HandleClick]`, `[UI:HandleEvent]` (mouseUp).
- A click outside every gene box (including the 12 px dead zone to the right of box 16 and the whole biomorph area) shows the "hypodermic is just for show" alert (8.1). The alert's stage setting (`0x5651`) suggests the first occurrence may only beep (I; by the Dialog Manager stage layout).
- View menu Thicker/Thinner Pen: change the pen size for all lines and redraw `[UI:DoBoxMenuCommands]`; enabled only in Engineering.
- Leaving: choose another operation. The engineered biomorph is the active biomorph; Breed starts from it. Add to Album while engineering returns to the engineering screen afterwards `[Alb:AddToAlbum]`.
- No Undo, no reset; Dawkins suggests experimenting `[Man]`.

### 6.5 Hopeful Monster (Operation > Hopeful Monster, Cmd-M)

`[Eng:DoSaltation]`, `[UI:HandleClick]`, `[R:STR# 26732]`, `[Man]`.
- Entry: window erased; a random genome is generated from the active biomorph, honouring the Mutations menu (with Segmentation off: 1 segment; with Asymmetry off: always bilateral; with Radial Sym off: north-only; with Scaling Factor on: random scale; with Gradient off: no gradients; with Tapering off: none), and drawn progressively with its root at the centre-box centre (not re-centred on its bounding box, so tall figures sit above centre) `[Eng:DoSaltation]`, engine.md 6.1. Strip drawn after it.
- Mode Randoming; pointer = die. Every click anywhere in the window replaces it with a new random biomorph (no box, no frame). Choosing any other operation uses the last one as the active biomorph. Detail of the random values: engine.md section 6.1.
- Edit > Add to Album, Save Biomorph, Copy, Engineering, Drift, Display pedigree are available.

### 6.6 Triangle ("Biomorph Land", Operation > Triangle, Cmd-T)

`[Tri:MainTriangle]`, `[Tri:FlickerTriangle]`, `[Tri:PlotTriangle]`, `[UI:DoBoxMenuCommands]`, `[R:STR 14234]`, `[R:STR# 17751]`, `[Man]`.
- Entry: window erased; a triangle outline (three 1 px lines) is drawn; the three anchor biomorphs (defaults: standard tree at the top, insect at lower left, chess piece at lower right) are drawn at the corners, each inside a snug frame (its bounding box + 2 px, erased then framed). Vertices on the baseline screen: top (234,51), left (134,250), right (333,250); all scale with screen width and height as x*W/512, y*H/342 `[Tri:MainTriangle]`. The triangle is left of centre (its centre x is about 234 of 508). Entering Triangle does not change the active biomorph (it is saved and restored).
- Pointer: a live 16 x 16 thumbnail of the biomorph that a click at the pointer position would produce. The genome is a weighted mix of the three anchors (barycentric weights from the pointer position; outside the triangle the weights extrapolate, engine.md 6.3); the thumbnail is the full-size picture shrunk to 16 x 16, opaque white square, hotspot centre. It updates continuously as the mouse moves, every pass of the event loop `[Main]`, `[Tri:CursSnap]`, `[Tri:OwnCursor]`. The first-ever entry in a session shows a blank pointer for one frame.
- Click: the sampled biomorph is drawn at full size, centred vertically on the click point, inside a frame (bounding box + 2 px, erased first, so it overpaints what is below). It becomes the active biomorph. Any number of samples can be stamped; earlier ones stay until overpainted. No gene strip.
- View > Make top / left / right of triangle: set that corner from the active biomorph. If Triangle is showing, an alert appears first (8.1: anchors will be redrawn and the present triangle is erased) with "Change" and "Cancel"; on Change the triangle is redrawn with the new anchor. If Triangle is not showing, the anchor is set silently `[UI:DoBoxMenuCommands]`.
- Leave by choosing another operation; Breed uses the last sampled biomorph.
- The manual says detached pedigree biomorphs ("Adams") become the anchors; v1.1 does not do this (anchors come only from the View items) `[Man]` vs `[Tri]`, `[Ped]`.

Confirmed from a direct reading of `Triangle` and `Main` (2026-10-04): weights come from the left corner with k = round(200 * screen height / 340) = 201 on a 342-pixel screen, so the top and right corners sample about 99% of their anchors (the drawn corner biomorphs are near, not exact, copies). PlotTriangle concocts the blend at the click, re-centres it vertically on the click point, erases and frames its margin grown by 2 px (unclamped, so boxes can run off the window) and draws it progressively; it becomes the active biomorph. MainTriangle draws the outline, then plots the three corners, then restores the previously active biomorph. FlickerTriangle runs on every pass of the event loop: the blend under the pointer is drawn off screen centred in a square "nice box" (MakeNiceBox: square of the larger margin side, AtLeast, right + 1) and OwnCursor samples that box (inset 2) into the 16 x 16 pointer, even for small biomorphs in this mode. Make top/left/right of triangle while triangling asks (Change, Cancel) and redraws with the active biomorph (the last one stamped) as the anchor.

### 6.7 Albums

Album capacity and layout `[Alb]`, `[Glob]`, `[Init]`:
- Up to 4 pages (fewer if memory ran out), 15 biomorphs per page (3 x 5, 101 x 100 px, no frames), so 60 in practice (`MaxAlbum = 100`, the 100 quoted in the manual `[Man]` cannot be reached with 4 pages of 15).
- Each page has the text "Album Page N" at (200,15) in 12 pt, then biomorphs below (I: the text sits in the strip, the biomorphs in the 3 x 5 grid, as for breeding).
- Pages are stored as bitmaps, so switching pages is a fast copy.

Edit > Add Biomorph to Album (Cmd-A) `[Alb:AddToAlbum]`, `[Alb:DoLoad]`:
- The breeding screen (picture, active biomorph and children) is saved. If there is already an album page, it is revealed with the curtain effect (next bullet), then the biomorph is drawn progressively into the next free slot of the current page (a new page starts when a page fills; a new page is cleared and titled), and the breeding screen is restored. Dawkins describes the biomorph flashing up briefly on the album page before the breeding screen returns `[Man]`; the code has no deliberate delay.
- If the fourth page is full a system beep sounds, and the item is disabled beforehand.
- Curtain reveal: the page appears from the centre outward in 8 px wide strips, one strip to the left and one to the right per step, about 31 steps across the baseline width, with no inserted delay (speed set by blitting) `[Alb:UnCurtainPage]`.

Edit > Show Album `[UI:DoEditMenuCommands]`, `[Alb:Zoom]`:
- One page: shows that page with the curtain effect and inverts the last biomorph on the page as the selection (the slot counter ends at the page's last entry).
- More than one page: Zoom view. Window erased; the pages are shown scaled down into four quadrants (2 x 2; the top row starts 15 px from the top, leaving a strip). Pointer = lens over the quadrants, arrow in the top 15 px. The quadrant under the pointer (for pages that exist) gets a 3 px XOR frame that follows the pointer. Click on a quadrant: the page is shown full size and the biomorph at the clicked position is highlighted. Click outside any page quadrant: undefined in the source (I, likely a bug; ignore).
- There is no command that returns to the previous breeding screen after Show Album (only Add Biomorph to Album restores it): choose Breed or another operation to continue; the highlighted slot is the active biomorph `[Alb:RestoreBreedingScreen]`.

In Albuming `[UI:HandleClick]`, `[Alb:Emphasize]`:
- Click on a slot: its box is inverted, the previously selected slot restored; it becomes the active biomorph. Clicks off the occupied slots do nothing.
- Clear: the selected slot's picture is erased and the slot left empty (not compacted); cleared slots disappear when the album is saved and reloaded `[Man]`. The cleared biomorph remains the active biomorph until something else is selected, so Breed, Engineering or Add to Album still act on it ("Clear" is therefore recoverable by Breed, then Add to Album) `[Man]`.
- Paste: only into a cleared slot; draws the pasted biomorph there.

File > Load to Album... `[Alb:ReadAnimals]`, `[Alb:DoLoad]`, `[UI:DoFileMenuCommands]`: file chooser (BIOM and COLL files), watch pointer; biomorphs are appended; the last page is shown. File > Save Album... saves all non-cleared members. File > Close Album: if there are unsaved changes, alert "Save changes to Album before Closing?" (Save, Don't Save, Cancel); then page counters reset, window erased, mode Preliminary (blank screen). Breed continues from the last active biomorph.

Corrections from a direct reading of `Album` and `User Interface` (2026-10-03), which supersede the bullets above where they differ:
- Loading (DoLoad + StickInAlbum) curtains in the current page if the album is non-empty, then draws every new biomorph progressively into the next slot, erasing and titling a new page whenever one fills. The last biomorph ends up selected (TakeCare + InvertRect). Add Biomorph to Album is the same routine with one biomorph, followed by RestoreBreedingScreen (and DoEngineer again if engineering). Extra biomorphs beyond 4 pages are dropped with a beep. Events are flushed afterwards.
- UnCurtainPage copies 8 px strips from the centre out while the left strip's left edge is > 0, then *erases* the last strip at each edge rather than copying it. No delay.
- Show Album: one page = UnCurtainPage + TakeCare + invert the page's last biomorph. Several pages = Zoom.
- Zoom quadrants: top pair from y = 15 to half the window height, bottom pair from half to the bottom (so the top pair is shorter). CopyBits srcCopy shrinks each page (thin lines can vanish). Zoom is modal until any click; the 3 px XOR frame stays on the last page pointed at. The click shows that page instantly (no curtain), then maps the point by exactly 2x and passes it to Emphasize, which applies GlobalToLocal to an already-local point (so the pick lands 20 px higher on the page).
- Clear erases the slot and drops the highlight (OldSpecial := 0); the slot stays the selection, so Paste can fill it. Paste draws progressively, then inverts the slot.
- Close Album with unsaved changes: the original closes even if the subsequent Save dialog is cancelled; this recreation keeps the album in that case.

### 6.8 Fossil record

`[Bio:Evolve]`, `[UI:DoOperationMenuCommands]`, `[Alb:StartPlayBack]`, `[Alb:DoPlayBack]`, `[Alb:MyAction]`, `[Alb:ClosePlayBack]`, `[UI:DoSpecMenuCommands]`, `[R:STR# 11238]`, `[Man]`.
- Initialize Fossil Record: if a record exists, alert "Save changes to Fossils before Resetting?" (Save, Don't Save, Cancel; Cancel changes nothing); then the record is emptied and recording turned on. Each subsequent generation of Breed appends the new parent. Only parents chosen in Breed are recorded; not Drift, Engineering, Pedigree, Triangle, Hopeful Monster. The record lives in a temp file and is lost at quit unless saved (prompt at quit, section 9).
- Recording Fossils (Cmd-R): toggles recording (check mark).
- Play Back Fossils (only while Breeding): the Fossils window appears over the breeding window, showing the most recent fossil, with the scroll bar thumb at the top (= newest); the menu bar changes to Apple, Exit, Help.
  - Scroll bar: dragging the thumb or clicking its arrows or page areas moves through the record: up = towards newer, down = towards older. Each arrow click and each page-area click steps exactly one fossil and repeats while the mouse is held (page areas do not jump by a page). The picture updates continuously for arrow and page clicks and only after release when dragging the thumb. The picture is drawn off screen and blitted whole, centred in the window.
  - Close via the close box or Exit > Close Window (Cmd-W). The active biomorph reverts to the one that was active when playback started `[UI:DoDeactivate]`.
  - Exit > Breed from Current Fossil (Cmd-B): closes the window, turns recording off, and starts breeding from the displayed fossil.
- File > Save Fossils... saves the record as a collection file; File > Load as Fossils... replaces the record with a file (same file type as albums, so album files load as fossils and vice versa `[Man]`), turns recording off, and opens playback at the newest fossil. Help text notes the manual's description (breeding screen with progeny) is outdated: the Fossils window appears `[R:STR# 11238]`.
- Source oddity (I): the enable logic uses the file read position, so after Play Back or after Load as Fossils the Play Back and Recording items can grey out and further recording can overwrite from the start. A recreation should instead enable Play Back and Recording whenever at least one fossil exists, and always append.

Corrections from a direct reading of `Album` (StartPlayBack, MyAction, DoPlayBack, ClosePlayBack), `Biomorphs` (Evolve, Snapshot), `User Interface` and `Initialize` (2026-10-03), superseding the bullets above where they differ:
- Recording is off at start-up (`Fossilizing := FALSE`). Initialize Fossil Record asks to save whenever fossils exist (not only when unsaved), then empties the record and turns recording on. Evolve appends the new parent after every litter, including the first litter of Breed, and also when a click misses every box.
- The Fossils window's content is (52,90)-(460,290) at creation; the scroll bar sits in the right 16 px overlapping the frame, and the bottom 16 px hold an empty horizontal scroll-bar strip drawn by DrawGrowIcon. The picture area is the content less 17 px on the right and bottom, and each fossil is drawn whole with its root at that area's midpoint (no re-centring).
- Snapshot clips to the main window's `businessPart` while the Fossils window is the port, so the top 20 px of the picture area are never drawn into.
- Scroll value 0 is the newest fossil (thumb at the top). Arrows and page areas step one fossil per action call; thumb drags update the picture on release. In the original, the down arrow at the oldest fossil jumps to the newest (FossilCounter can reach NumberInFile); this recreation stops at the oldest.
- Closing by either route (close box or Exit > Close Window) deactivates the Fossils window, and DoActivate then sets the active biomorph back to FirstBiomorph, the newest fossil. Exit > Breed from Current Fossil first sets FirstBiomorph to the fossil on show, so it survives; then it closes, turns recording off and breeds from it. (Corrected by the 2026-10-04 audit.)
- Load as Fossils asks to save an existing record, empties it, turns recording off, reads up to 100 records from any Dawkins file and opens playback (from any mode).

### 6.9 Pedigree

`[Ped]`, `[UI:HandleClick]`, `[UI:DoPedigreeMenuCommands]`, `[R:STR# 12587, 4241, 16204, 11150]`, `[Man]`.

Display pedigree (Cmd-1): the window is erased and the active biomorph is drawn with its root at (256,171) in window coordinates (half the screen width and height, slightly right of and below the window centre), inside a box (its bounding box + 3 px, widened to a multiple of 8 px on the left and right) drawn with an extra inner frame (double border = "Adam", a biomorph with no parent). A bitmap snapshot of each box is kept so it can be redrawn when overlapped. Mode = Draw Out; pointer = draw-out hand. Earlier pedigrees on screen remain (the new Adam is drawn on top, centre) `[Ped:PhylogNew]`, `[Man]`.

Draw Out Offspring (Cmd-2, default mode):
- Mouse-down inside a pedigree box brings it to the front (boxes stack like windows) and makes it the active biomorph; pointer becomes a 16 x 16 thumbnail of the box.
- Dragging out of the box rubber-bands XOR lines from the box centre to the pointer ("umbilical cords"), one ray with No Mirrors, two rays (pointer and its point reflection through the box centre) with Single Mirror, four rays (plus the two perpendicular points, a rotation of +-90 degrees) with Double Mirrors. The lines are redrawn with one tick waits per move.
- Release outside the box: for each ray, in the order 4, 3, 2, 1 (the ray toward the pointer is born last), a new box is born at the ray end: the child genome is a mutation of the parent; its picture is drawn progressively in a fresh opaque, framed box (bounding box + 3 px; clamped to stay on the window), a bitmap snapshot is stored, and a permanent 1 px line connects the child's box centre to its parent's. The pointer is a dot while births happen. Release inside the box: no birth.
- Lines are straight centre-to-centre but hidden behind boxes (boxes are opaque; lines are clipped out of every box), so only the part between boxes shows `[Ped:Protect]`, `[Ped:LocalLines]`; screenshot `Pedigree.png` `[Carb]`. Each box is sized by its own biomorph, so boxes differ in size.
- The newest box is on top and is the active biomorph.

Move (Cmd-6): pointer = hand. Press in a box, drag: the box (its snapshot) follows the mouse and its lines follow it (pointer hidden during the drag; box comes to the front; the area it uncovered is repaired from other boxes). Release leaves it there. Boxes can stack to any depth and re-emerge when moved.

Detach (Cmd-7): pointer = scissors. Click a box: its line to its parent is erased and it becomes a new root with the inner frame; its descendants stay attached to it. Clicking a box that is already a root beeps `[UI:HandleClick]`.

Kill (Cmd-8): pointer = gun. Click a box: it and all its descendants are removed and the window redraws all remaining boxes and lines. No undo (the help text warns of this `[R:STR# 11150]`). Killing the last root returns to the blank Preliminary state (I: the code tests a god-counter of 3, probably off by one) `[Ped:Shoot]`.

Leaving: choose another operation; the last-touched pedigree biomorph is the active biomorph `[Man]`. Display pedigree again later shows the old pedigree with the new active biomorph on top `[Man]`.

Corrections from a direct reading of `Pedigree`, `Triangle` (AtLeast, OwnCursor) and `User Interface` (2026-10-04), superseding the bullets above where they differ:
- Display pedigree (PhylogNew) erases the window, draws the active biomorph progressively with Delayvelop at the *screen* centre (256,171) used as a window-local point, boxes it with AtLeast (grow 3 px, then widen both sides to multiples of 8), frames it twice (Adam), snapshots it, then redraws every existing box and line with the new Adam in front. The Adam's box is not clamped to the window.
- Draw Out: pressing in a box brings it to the front (redrawn first if covered); the pointer becomes the box shrunk to 16 x 16 (the cross if the box is 16 px or less); once the pointer leaves the box, XOR cords (clipped out of every box) follow it, with a one-tick wait before each erase and redraw, and are hidden while the pointer is back inside the box. On release outside the box, children are born for rays Rays..1, so the one at the pointer is born last, ends up in front and is the active biomorph. Each child box is the margin grown by AtLeast, clamped inside the window (horizontally to an even byte width), erased, framed 1 px and drawn progressively (clipped to the window, not the box, so thick lines can poke out) with the picture re-centred horizontally and shifted by the vertical clamp. Then lines from the parent to its parent and children are drawn.
- Lines join box centres and are clipped out of every box; Adams get FrameInnerRect (a second 1 px frame inset by 1).
- Move (FollowMouse): the box comes to the front, its lines are erased in white, its area erased; the box snapshot and XOR lines follow the pointer (frozen while the pointer is outside the window; an extra tick's wait below y = 100 to reduce flicker); on release everything damaged is repaired and all lines redrawn. This recreation redraws everything on release, which looks the same.
- Detach: an Adam beeps. Otherwise the line to the parent is erased with a white pen that spares only the two boxes involved (so it scratches any third box lying across it, as in the original); the box becomes an Adam (inner frame).
- Kill (Shoot): the box and all descendants go and the window is redrawn. Killing the last Adam leaves no active biomorph (Special = 0), so Breed, Drift, Engineering, Display pedigree, Save Biomorph and Copy are disabled until Hopeful Monster or an album pick supplies one. (The GodCounter = 3 test is correct: RootGod is a dummy.)
- Deviation: releasing inside the box after the cords had left it made the original XOR a stray set of cords onto the screen; this recreation erases only cords actually shown.

### 6.10 Rows, columns, pen

- More/Fewer Rows/Columns act only in Breeding, Highlighting, Preliminary, Drifting. The window is erased, the grid redrawn with every box (including the centre) framed 1 px, and only the active biomorph is drawn in the centre box; mode becomes Preliminary; no strip; no litter. Choose Breed to resume `[Bio:DoRowMore]`, `[Bio:DoShowBoxes]`, `[Man]`.
- The new grid size becomes the breeding grid for later Breeds `[UI:DoBoxMenuCommands]`.

### 6.11 Mutations menu

Click an item: toggles its check mark and flag; no redraw `[UI:DoMutationMenuCommands]`. Takes effect for the next reproduction or Hopeful Monster. Gradient/Segmentation interaction as in 4.6.

### 6.12 Help and About

See section 8.

### 6.13 Copy and Paste

Copy puts the active biomorph on the system clipboard as a vector picture (drawn at the centre-box position) and remembers it for pasting into the album. If the picture is empty or over 32,000 bytes a two-line error appears (problem creating the picture; perhaps the biomorph was too large) `[Bio:SendToClipBoard]`, `[R:STR 131, 132]`. After a Copy the Help command shows the Copy help `[UI:DoHelpMenuCommands]`. A browser version can copy an image (I).

### 6.14 Starting biomorphs and "Initialize" options

- There is no new-game, reset or choose-start-biomorph command. "Initialize" in the menus means only "Initialize Fossil Record" (6.8) `[R:MENU 1004]`.
- A session starts from the Standard Tree (section 9). Insect and Chess-piece genotypes exist only as the default left and right Triangle anchors (6.6). Any other starting point is reached by loading a biomorph or album file (File > Load to Album, then Breed from a selected slot), by Hopeful Monster, or by double-clicking a file in the Finder `[Main]`, `[Bio:Insect]`, `[Bio:Chess]`. The program disk shipped single-biomorph files such as "Moth" and album files such as the zoos `[Man]`; decoded zoo contents are in `zoos.json` and engine.md section 7.2.
- The JS port's Animal menu (Basic Tree, Chess, Insect, Hopeful Monster) is an addition `[JS]`.
- Dormant code: a hidden evolve-toward-a-target routine (target = Insect) whose key-press hook is commented out; unreachable in v1.1 and not part of the experience `[UI:DoKeypress]`, `[Bio:TargetEvolve]`, `[Main]`.

## 7. Drawing order and pacing

### 7.1 Three drawing styles `[Bio]`, `[Main]`

| Style | Used for | Visible result |
|---|---|---|
| Direct, line by line to the screen, from a precomputed line list | Parent at breed start, each child, album slots, sweep boxes, Hopeful Monster, pedigree births, Engineering entry, clipboard | Lines appear one after another while drawing runs; no XOR, no erasing, no intermediate bounding box |
| Off-screen then one blit | Cinematic drift, Engineering edits, fossil playback, triangle cursor thumbnail | Picture changes in one instant |
| Bitmap copies | Album pages and zoom, pedigree boxes, curtain | Instant or strip-wise |

- Direct drawing order: the line list is computed first (`Delayvelop`: compute the pic, then draw it), then replayed in list order `[Bio:Delayvelop]`, `[Bio:DrawPic]`. List order = segment by segment; within a segment a depth-first walk of the branching tree: the trunk line, then the whole subtree of the first branch, then the second branch (which branch is first alternates by segment parity) `[Bio:Tree]` (details in engine.md 3.3). With symmetry the mirrored line (and up-down or radial partners) is drawn immediately after each line, so a biomorph grows outward from its root, one limb tip at a time, with its mirror image growing in step.
- On the original hardware the build-up was visible for large biomorphs and nearly instant for small ones (I; speed was set by the CPU, there is no delay code).

### 7.2 Erase and XOR use

- Erase = fill white (`EraseRect`); frames removed with a white pen (`PenPat(white)`). XOR only for: the 2-tick umbilical line in Breed; the quadrant frames in Zoom; pedigree rubber-bands and moving lines `[Bio:GrowChild]`, `[Alb:Zoom]`, `[Ped]`.
- Each box is cleared before its new child is drawn; there is no cross-fade.

### 7.3 Timing facts (ticks = 1/60.15 s)

| Event | Timing | Source |
|---|---|---|
| Umbilical line in Breed | held 2 ticks per child, then erased | `[Bio:GrowChild]` |
| Glide of the chosen child | 1 tick minimum per step; 4-5 steps for typical grids (at most about 85 ms) | `[Bio:Slide]` |
| Drawing a child | hardware-bound, no inserted delay | `[Bio]` |
| Engineering repeat | first repeat after the double-click time (default about 32 ticks, 0.5 s), then as fast as redraw | `[UI:HandleClick]` |
| Cinematic drift | one step per event-loop pass; sleep argument 20 ticks (the v1.1 header says non-sweep modes give plenty of time to background tasks), so under `WaitNextEvent` the ceiling is about 3 steps/s when no events arrive (I); unthrottled without `WaitNextEvent` (System 6) | `[Main:GetAnEvent]`, `[Main]` header |
| Sweep drift | sleep 2 ticks per pass (ceiling about 30 steps/s, I) | `[Main:GetAnEvent]` |
| Pedigree rubber-band | 1 tick wait before each XOR erase and redraw | `[Ped:DrawOutFrom]` |
| Curtain page reveal | about 31 steps, no delay | `[Alb:UnCurtainPage]` |
| Start-up pause | about 50 ticks (random-number seeding) | `[Init:Initialize]` |

The original has no timing, speed or generation-counter option at all (the JS port's "Timing" dialog and offspring counter are additions) `[Main]`, `[Glob]`, `[JS]`.

Recommendation (I): make draw speed a setting; default so that a full 15-child generation completes in about 1-2 s on a modern machine (original speed was machine-bound and noticeably slower for large biomorphs). Keep the two exact waits (2-tick cord, ~5-step glide) at original values. Cinematic drift default of about 4-8 steps per second with a slider.

## 8. Dialogs, alerts, sounds

Dialogs and alerts are black-and-white standard Mac boxes. System 6 centres them in the upper third of the screen; System 7 uses the resource positions `[Misc:PositionDialog]`.

### 8.1 Alerts

| Name | Shown when | Content (paraphrased; short labels exact) | Buttons | Size (px) | Source |
|---|---|---|---|---|---|
| Save changes | closing the album, quitting (album, then fossils), resetting the fossil record | "Save changes to {Album, Biomorph or Fossils} before {Closing, Quitting or Resetting}?" | Save, Don't Save, Cancel (a twin alert with Cancel disabled is used only when the program must abort, e.g. out of memory) | 369 x 100, caution icon | `[R:ALRT 151, 152]`, `[R:STR# 128 #7-12]`, `[Misc:DireMessage]`, `[Alb:GracefulDeath]` |
| Triangle anchor | View > Make ... of triangle while Triangle is showing | Going ahead erases the present triangle; do you still want to change an anchor? | Change, Cancel | 400 x 140 | `[R:ALRT 17089]`, `[R:STR 14234]` |
| Hypodermic | Engineering, click outside the genes | The hypodermic is only for show; move up into the chromosome for a usable pointer; use "Help with current operation" if in doubt; shows an enlarged hypodermic picture | Okay | 382 x 114 | `[R:ALRT 30130]`, `[R:DITL 30130]` |
| Biomorph too large | a picture would need more than 4,095 lines (rare given the size cap, engine.md 3.8) | error number -147 with a "biomorph too large or other problem" message and a stop icon; the program then quits | Ok | 472 x 109 | `[Bio:PicLine]`, `[Err]`, `[R:ALRT 999]` |
| File and disk errors | save or load failure | "Error n: description" plus a "Check disk and try again" line | Ok | 472 x 109 | `[Alb:SaveAnimals]`, `[Err:IOError]` |
| Memory warnings | low memory, fewer than 4 album pages possible, pedigree out of memory | various | OK | various | `[R:ALRT 27291, 27295]`, `[R:STR# 128]`; peripheral |

Not needed for a web version: temp-file folder alerts, Get Info memory hints.

### 8.2 About (Apple > About Blind Watchmaker)

A 462 x 294 plain modal box containing one picture (463 x 287); a click on the picture dismisses it (I: the picture is the only dialog item and is enabled). Pointer = cross while open `[UI:DoAbout]`, `[R:DLOG 11271]`, `[R:DITL 11271]`. Content (paraphrase, read from the image copy of the original PICT 26817 in `[JS]` `docs/img/AboutBlindWatchmaker_PICT_26817_459x287.png`): a framed centre panel reading Blind Watchmaker, by Richard Dawkins, Department of Zoology, University of Oxford, with thanks to Alan Grafen and Alun ap Rhisiart, a pointer to the book The Blind Watchmaker (1986, Norton, Penguin); below it, publisher credits (W W Norton, New York; Software Production Associates, Tewkesbury, Gloucestershire) and "Version 1.1" at lower right; four small biomorph drawings down each side (eight in all).

### 8.3 Help dialogs

A tall modal box (430 x 310; nearly the full screen height) of black text on white and a small picture button (100 x 57, labelled OK) at the bottom centre that closes it `[R:DLOG 2000]`, `[R:DITL 19916]`, `[Misc:HelpMessage]`. Text is one title line (capitals, e.g. "BREEDING HELP") then two or three short paragraphs. Which text appears (Help with current operation) `[UI:DoHelpMenuCommands]`:

| Mode | Topic | Gist (paraphrase) |
|---|---|---|
| Breeding | Breeding Help | parent in the middle, mutant offspring around it; click to breed; Save, Add to Album, fossil record pointers |
| Albuming | Album Help | up to 4 pages; Show Album then Zoom; Add to Album; load, save, Clear, Copy, Paste into cleared slot |
| Phyloging | Pedigree Help | draw out umbilical cords; mirrors give 2 or 4 offspring; birth bias; Kill, Move, Detach |
| Moving | Moving Help | rearrange without changing biology; stack biomorphs; they behave like small windows |
| Detaching | Detaching Help | scissors cut a biomorph and its descendants from the rest |
| Killing | Killing Help | gun removes biomorph and descendants; no undo |
| Randoming | Hopeful Monster Help | click for new random biomorph; last one becomes the active biomorph |
| Engineering | Engineering Help | hypodermic over the chromosome; arrowhead direction = decrease or increase; vertical zones for gradients; Thicker/Thinner Pen |
| Drifting, Sweeping | Drift Help | drift without selection; stop by moving into the menu bar; sweep vs cinematic via the View menu |
| Highlighting | Highlighting Help | a click blackens a biomorph so it can be used by later commands |
| PlayingBack | Playing Back Fossils Help | slider sinks through strata; few menus; Breed from fossil or close |
| Triangling | Triangle Help | sampling genetic space; three anchors; click to draw; the pointer shows the biomorph |
| after Copy | Copy Help | paste into a drawing program or an album's cleared slot |
| Preliminary | (none: the Help command does nothing) | `[UI:DoHelpMenuCommands]` has no case for it |
| Miscellaneous Help item | Miscellaneous Help | rows and columns (View), Mutations menu meaning, book subset = first four categories off |

All help strings: `[R:STR# 2630, 11506, 12587, 4241, 16204, 11150, 26732, 8597, 8947, 19866, 11238, 17751, 21128, 7699]`. They refer to an "Album Menu" for Highlight and Add to Album, which is Edit in v1.1.

### 8.4 Sounds

Only the system beep (`SysBeep(1)`): album full on add; Detach on a root; unmatched menu ID (cannot occur); clipboard failure; alert stage sounds `[Alb:StickInAlbum]`, `[UI:HandleClick]`, `[UI:HandleMenu]`, `[Bio:PictureToScrap]`, `[R:ALRT]`. The hidden evolve-to-target feature would beep when finished (unreachable) `[Bio:TargetEvolve]`. No music, no other sounds. (The JS port adds many sounds; not original.)

## 9. Start-up, shut-down, state

- Start-up `[Init:Initialize]`, `[Main]`: pointer = watch; temp "Fossil History" file created (not user-visible); window and strip prepared; menus installed; defaults set (3 x 5 grid, mutation flags per 4.6, mirrors = No Mirrors, Drift Sweep off, pen size 1); about 0.8 s idle to seed the random number generator. If launched by double-clicking one or more biomorph or album files, they are loaded into the album (its pages are built during loading) and breeding starts from the last loaded biomorph; otherwise breeding starts from the Standard Tree (genes -10 -20 -20 -15 -15 0 15 15 7, 2 segments, single-sided, decreasing gradients on genes 4, 5, 6 and 9) `[Main]`, `[Bio:BasicTree]`. Screenshot of the start state: `Breeding.png` `[Carb]`.
- The three triangle anchors start as Standard Tree (top), Insect (left), Chess piece (right) `[Main]`, `[Bio:Insect]`, `[Bio:Chess]`.
- Quit (Cmd-Q) `[Main]`: if the album has unsaved changes the "Save changes to Album before Closing?" alert appears; then, if fossils are unsaved, "Save changes to Fossils before Quitting?". Cancel on the fossils prompt cancels the quit. The fossil temp file is deleted at exit `[Misc:CleanUp]`.
- Persistent state kept between operations: active biomorph, album (4 page bitmaps), fossil record, pedigree boxes (old pedigrees come back with Display pedigree), mutation flags, grid size, pen size, triangle anchors.

## 10. Things that would surprise someone working from the book alone

1. The window is borderless and fills the screen; there is no title, no counter of generations, no on-screen labels, no speed control. The only text is the 16-box strip and "Album Page N".
2. The strip has 16 genes, not the book's 9, and its values follow the pointer from box to box (3.3). Bullets, not arrows, mark gradients.
3. Breeding is a visible sequence: everything but the winner vanishes, the winner glides to the centre, then cords flash and children appear one at a time, drawn limb by limb. Clicking the parent re-rolls the litter.
4. Rows and columns are always odd and changing them leaves just one biomorph; you must choose Breed again.
5. Pointer shape is the mode display; the pointer vanishes during animations; the menu title stays inverted while a command runs.
6. Drift pauses when the pointer is in the menu bar; cinematic drift shows one centred biomorph, replaced whole each step; sweep drift cycles through the boxes.
7. Engineering uses click zones (thirds) inside each gene box; one click changes a gene by the biomorph's own mutation-size gene (genes 1-8) and holding repeats.
8. Highlighting blackens a box instead of breeding; selecting a biomorph in an album does the same.
9. Pedigree boxes are opaque bitmaps that stack and move like windows; lines pass behind them; roots have a double border; Kill has no undo.
10. Triangle's pointer is a tiny live picture of the biomorph under it; clicks stamp framed full-size copies.
11. Hopeful Monster draws a bare biomorph with its root at the centre, not framed or re-centred.
12. The album is four fixed pages of fifteen, unframed, revealed with a centre-out wipe; Show Album with several pages shows four miniatures.
13. Fossils record only the parents chosen in Breed; they live in a temporary file; playback is in a separate small window with a scroll bar and a reduced menu bar.
14. Only the system beep; no other sound; no dialog boxes other than save prompts, the hypodermic alert, About, Help and errors.
15. The only drawing is 1-bit black lines; pen thickness comes from the gradient on gene 9 and the View pen setting (engine.md).
16. If a picture ever exceeds 4,095 lines the original shows an error alert and quits (rare, engine.md 3.8). A port should recover instead (I).

## 11. Differences between sources

| Topic | Manual `[Man]` (older build) | v1.1 original (this spec) | JS port `[JS]` (not original) |
|---|---|---|---|
| Menu holding Highlight and Add to Album | an "Album" menu with Show Latest, Previous, Next, Roll and Zoom Album | Edit menu with a single "Show Album" (Zoom view when there is more than one page) | Edit menu; Highlight is a checkbox |
| Make Icon (Operation menu) | present (icons made on Save) | absent | absent |
| After Load as Fossils | breeding screen with progeny, recording on | Fossils window opens (in-app help `[R:STR# 11238]`); the code turns recording off `[UI:DoFileMenuCommands]` | simplified |
| Triangle anchors | first three pedigree "Adams" | View menu items only | View items plus a "New Random Start" operation and an Animal menu |
| Mutation defaults | gene 16 mutation off | flags 1-5 and 8 on, 6 and 7 off | same, plus a ninth menu item "Gene 9 can be Zero" and a Genes menu (not in the original) |
| Window | ordinary Mac window | borderless, full screen, no title | HTML tab with dialogs, an auto-breeding "Timing" dialog, "explosive breeding" |
| Breeding animation | "glide" then litter | glide, flashing cords, progressive drawing | children fly out from the centre (jQuery easing) |
| Sounds | not described | system beep only | many sounds added |
| Generation counter | none | none | offspring counter added |
| Mode names in window title | none | none | Carbon port only (`[Carb:ModeDefs]`) |

I did not check the Carbon port beyond its mode titles and menu-ID plumbing `[Carb]`.

The `Fossils` source file in the original folder still contains an older Pascal-file version of the playback code; the live v1.1 code is in `Album`.

## 12. Gaps and unresolved items

1. Resource fork unreadable; all resource facts rely on Canon's `BW.r` dump. No WIND resource, so window geometry is derived from code (formulas above). Alert box positions under System 7 come from the dump but are not significant.
2. Fonts: the code never sets a font, so I assume the system font at 9 pt (strip) and 12 pt (album title); not verified (I).
3. The ninth mutation flag has no menu item in the dump; effect in engine.md.
4. Alert stage word `0x5651` meaning (I); the hypodermic alert may beep before showing.
5. Pointer bitmap details are in `BW.r` CURS 135-151 only; I describe them in words. Contents of resources PICT 9453 (Help OK button), 21689 and 7320 (empty) not decoded.
6. Behaviour not defined in source: Zoom click outside a quadrant, drift stop after size error, Cmd-key on disabled items.
7. The old (pre-1993) build is not documented beyond the manual.
8. Hardware speed: the original's real draw rate is unknown; section 7.3 gives only the explicit waits.

## 13. Priority for authenticity

Essential
1. 1-bit monochrome look; borderless full-window layout; 3 x 5 grid with 3 px centre frame; 16-box strip with hover-tracked genes, signed numbers, Asym/Bilat/Single/UpDn/Radial text and bullet gradients.
2. Breed loop: instant clearing, ~5-step glide, 2-tick cord flashes, one-at-a-time progressive drawing; click-parent re-roll; hidden pointer during animation.
3. Menu bar with exact titles and items (section 4), enable rules, key equivalents (with a browser-safe mapping), inverted title while commands run.
4. Engineering with thirds-based click zones, repeat, and pointer shape changes.
5. Mutations menu, Highlight, Add to Album, album pages with curtain and zoom.
6. Fossil record with playback window.
7. Hopeful Monster, Drift (cinematic and sweep), rows/columns changes leading to Preliminary.
8. Pedigree (draw out, mirrors, move, detach, kill, stacking boxes, double-bordered roots).
9. Triangle with live miniature pointer.
10. Pointer-by-mode, system beep, Help dialogs, About picture text.

Important but secondary
- Save changes alerts and quit prompts; file save and load of biomorph, album, fossil files; pen thickness; Copy.

Peripheral (safe to omit or modernise)
- Desk accessories, memory and temp-file alerts, MultiFinder suspend and resume, double-click launching, icon making, the exact alert stage beeps, 4-page memory limit as such, hidden evolve-to-target code, Carbon-style window titles.

## 14. Audit (2026-10-04) and deliberate deviations

Four independent read-only audits compared the recreation with the Pascal routine by routine (core operations; menus, event loop and alerts; Album, Fossils and files; Pedigree and Triangle). Confirmed discrepancies were fixed, among them: Add Biomorph to Album now restores the breeding screen's children and makes the centre box Special (it had discarded the litter); the first rows/columns change from Breeding keeps the 3 px centre frame (SetUpBoxes runs before BoxesOnly); Drift Sweep frames each new box with the 3 px pen after its first step, and toggling it no longer erases; drift steps hide the pointer and Hopeful Monster does not (it also starts from the centre box's biomorph); Move hides the pointer for the whole drag; the glide slides the chosen box's pixels; cinematic drift is clipped to businessPart; the pen items redo DoEngineer, which draws the biomorph before the strip; the hypodermic's first stray click only beeps (ALRT stage 1), later ones show the alert, and dragging off the chromosome while holding meets it; Load to Album curtains the current page into album mode before the dialog; Close/Show Album follow AlbumEmpty; More Rows/Columns stay enabled below 100 boxes and refuse an over-limit step; Save Album does nothing in Move mode; one shared default save name, initially empty; save-changes alerts lay out Don't Save, Cancel, Save; the triangle-anchor alert has the caution icon; Preliminary has the plus pointer and no help; after Copy both Help items show the Copy help until an Edit, Operation, View or Mutations command or any drawing; menu items use three periods and "About Blind Watchmaker" has none. Corrections to earlier statements in this spec: 6.10 (the first change from Breeding keeps the 3 px centre frame), 6.3 (sweep frames are 3 px after the first step) and the Fossils close behaviour above.

Original behaviour deliberately not reproduced (bugs or browser constraints):
1. `DoTheSave` is never set TRUE in the source, so Save at "Save changes to Fossils before Resetting?" never resets the record, and saving an album never clears its changed flag (later prompts repeat). Here, saving resets or clears as the prompts imply.
2. Quit: the original runs Close Album first and shows the fossils prompt even after Cancel. Here Cancel stops quitting, and Close Album keeps the album if its Save dialog is cancelled.
3. `FossilsExist` tests the file position, so Play Back and Recording grey out after playback and recording then overwrites from the start. Here they follow whether fossils exist, and recording always appends. The down arrow at the oldest fossil no longer jumps to the newest.
4. Pedigree: no stray cords after releasing inside the box; FollowMouse's partial Repair (which could misorder overlapping boxes) is a full redraw; WipeOut's dangling Prec pointer has no equivalent.
5. SnapDevelop's partial erase (which can leave stray pixels of thick lines) is a full redraw of the grid area.
6. Make top/left/right of triangle are disabled when there is no active biomorph (the original indexes child[0] and can crash).
7. DoBreed passes a local point to Evolve, which converts it again; with 15 or more rows the box above the centre would become the parent. Not reproduced.
8. 16-bit integer arithmetic is not emulated (e.g. SizeWorry wrapping), and genomes are normalised before development (segNo, trickle, mutSize >= 1; gene 9 within the size cap); mutation rate cannot go negative; Hopeful Monster's retry loop is capped.
9. Smaller file and album edges: an overflowing load leaves 60 records, not 61; Clear is disabled on an already-cleared slot; selecting a cleared slot keeps the active biomorph; Load as Fossils does not mark the album changed; the Fossils scroll box is accepted wherever it is released; clicks on the main window during playback are ignored; GrowWindow sizes to the pointer.
10. Browser and copyright adaptations: our own pointer bitmaps (no breed or watch pointer), help, About and hypodermic wording (no syringe picture); the biomorph icon in the Apple-menu position; pixel-font recreations of Chicago and Geneva, with gene boxes 12 and 13 centred because the font's space is wider; plain letter keys as key equivalents (except Q), Quit returning to the landing page; Standard File dialogs over a simulated disk with real upload and download through Drive, and an invisible HTML text field behind the name box; Copy produces a PNG; drawing speed is a chosen rate.

## 15. Gold (classic-v1.0, 2026-10-04)

The classic recreation was declared Gold after the audit fixes above. Two choices were made explicitly by the project owner: the pointers stay as this recreation's own redrawn designs (the original CURS bitmaps were not copied, and Breeding uses the thin cross), and the Help, About and alert wording stays as this recreation's own, written for students. Behavioural changes to the classic version after this point should be fixes that move it closer to the source, recorded here.
