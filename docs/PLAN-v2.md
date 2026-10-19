# Fantasy Zone v2: the plan

---

# PART A: FOR YOU

## The new layout, in one paragraph

Right now everything sits on one long page, so you scroll forever to find things. In the new app, the top of the screen stays put and only the list under the tabs scrolls. The top always shows:
- your score against your opponent's, plus your win chance;
- pause, speed and the replay clock, one tap each, plus **Find**, which searches for any player or game;
- a row of game chips that you slide sideways to see every live game.

Under that are tabs: **Zone, Matchup, Games**, and later **League**. Tap a tab, or swipe left or right anywhere below the tabs. Each tab remembers how far down you scrolled. Tapping a game, a play or a player opens it on top, and Back closes it. Nothing switches or re-sorts by itself. When something big happens you get a small banner or a dot on a tab, and you decide whether to look. A computer screen has more room, so there the tabs sit side by side as columns (see the sketch below).

> **Why this layout?** I compared five sports apps.
> - **Real** keeps a row of live games across the top and puts things side by side on big screens. We copied both: the game chips, and columns on a computer.
> - **Yahoo Fantasy** lets you swipe anywhere to change tabs. We copied that too, below the tabs.
> - **ESPN** keeps the score pinned while you move around. Our score bar never leaves the screen.
> - **Apple Sports** has no clutter. We use short cards and never more than 4 buttons in a row.
> - **Sleeper** users complain when a swipe only works in one direction. Ours work both ways, and every swipe also has a button you can tap instead.
>
> What I turned down, and why:
> - **Tabs at the bottom (for the web app).** On an iPhone, Safari's own bar sits at the bottom and gets in their way. Bottom tabs are also made for tapping, not swiping.
> - **A sideways row of games inside a tab page.** It would sit right on top of the tab swipe, so your finger would move the wrong thing.
> - **Lists that re-sort themselves.** Real users complained that games jump around just as they tap them. Ours re-sort only when you tap ↻ or come back to the tab.

## Where did my old stuff go?

| Old | New |
|---|---|
| "All games ›" button | the **Games** tab |
| Replay bar (pause, speeds, jump buttons) | top bar: `||` pauses and `5x` changes speed. Tap the clock for the jump buttons |
| The "Replay, not live" sentence | a banner the first time you open the app. It's also in the clock menu |
| Matchup card | the score bar at the top, plus the **Matchup** tab |
| "Hot right now" strip | the game chip row |
| My matchup / All plays / Big plays buttons | pinned at the top of **Zone** |
| Game screen sections (field, who's playing, momentum, plays) | the game's own tabs: **Plays, My guys, Momentum** |
| Side-by-side view on a computer | columns: Zone, Matchup, Games |

## The tabs

- **Zone**: the live play feed (My matchup / All / Big), plus which of your guys is on the field right now.
- **Matchup**: your 10 starters next to your opponent's 10, with your win chance and what you need.
- **Games**: every game in a grid (Live / Up next / Final).
- **League** (step 6): all 5 matchups in your league, standings, and trades.

## Swiping and tapping

- **The game chip row** at the top: slide it to see every live game, then tap one to open it.
- **The tabs**: swipe anywhere below the tabs to move between Zone, Matchup and Games.
- **Inside a game**: swipe between Plays, My guys and Momentum.
- **Sunday Story doesn't swipe sideways.** Tap the right side for the next card and the left side to go back, like Instagram stories.

The game chips and the tab pages both slide sideways, but the tab bar sits between them like a fence. A swipe that starts on the chips moves only the chips. A swipe that starts below the tabs moves only the pages. Nothing inside a tab page slides sideways; those pages use grids instead.

**On a computer**, a mouse can't drag the pages. Click the tabs instead. On a laptop trackpad you can also swipe sideways with two fingers, or hold Shift and roll the mouse wheel. In a big window you won't need any of that, because the tabs sit side by side. To try real finger swiping on a computer, use Chrome's phone preview (devtools device mode), which turns the mouse into a finger. Opening the link on your phone is even better.

## Sketches

The sketches show the finished app. A step number means that part arrives in that build step. Each sketch is a real moment from the Week 6 replay, so the numbers inside one sketch match each other. Different sketches show different moments.

**What the symbols mean**
- Top bar: `||` is pause, `5x` is speed (tap to change it), `1:40P` is the replay clock (tap it to jump to 9:30 AM, 1 PM, 4 PM or the night game), `Find` searches for a player or game, and `:` is settings.
- `Y` is yellow (your player) and `P` is purple (your opponent's). On a play card it's a colored bar down the left edge.
- On a game chip, each `Y` or `P` is a dot for one of your starters or one of theirs in that game. "End Q1" means the first quarter just ended. If a chip says `RZ`, that team is in the red zone: inside the 20-yard line, close to scoring.
- `2nd & 6 at IND 34` is the down and distance, like on TV.

**Zone at 1:40 PM** (the first screen, no scrolling needed)
```
+--------------------------------------------+
| YOU 24.4  43%  16.9 OPP  || 5x 1:40P Find :|
|[TEN 0-0 IND   PP][BAL 10-0 CLE   Y][NYJ 3-7|
|[Q2 14:34  Taylor][End Q1   Flowers][End Q1 |
|     ZONE         MATCHUP         GAMES     |
|     ====                                   |
| (My matchup) (All) (Big)     When: All day |
| On the field: Y Swift Y Flowers P Taylor +2|
|P TEN 0-0 IND . Q2 14:34 . 2nd & 6 at IND 34|
|P Jonathan Taylor  38-yd catch              |
|P D.Jones pass short right to J.Taylor p... |
|P +4.8 opp RB            Win 49% -> 43%     |
|                                            |
|Y CHI 14-0 ATL . Q2 12:42 . 2nd & 9 ATL 47  |
|Y D'Andre Swift  loss of 1                  |
|Y D.Swift right tackle to ATL 48 for -1 ... |
|Y -0.1 your RB                              |
|                                            |
|P TEN 0-0 IND . Q2 14:49 . 1st & 10 IND 30  |
|P Jonathan Taylor  4-yd rush                |
|    ...scroll down for more                 |
+--------------------------------------------+
```
The newest card is on top. Taylor's catch dropped your win chance from 49% to 43%, which is why the top bar says 43%. Each card shows four things in order: the score, quarter, clock and down & distance; the play; one line of the play's description; and the points and win-chance change. "On the field" (step 3) lists the players whose team has the ball right now, and "+2" means two more. `When` (step 2) narrows the list to the 9:30 AM game, the 1 PM games, the 4 PM games or the night game.

**Matchup at 3:42 PM**, right after Taylor's TD
```
+--------------------------------------------+
| YOU 48.6  48%  44.6 OPP  || 5x 3:42P Find :|
| [game chips slide sideways ...]            |
|     ZONE         MATCHUP         GAMES     |
|                  =======                   |
| 48.6        WIN 48%  FULL SWEAT       44.6 |
| You need 99.0 more. Your 9 players still   |
| to play should score about 97.2.           |
| [Lineup] [Swings] [What-if]    [Story >]   |
| QB Daniels     0.0 ○ | ○  0.0 Allen        |
| RB Swift      22.7 ◉ | ○  0.0 K. Williams  |
| RB Marks      10.1 ✓ | ◉ 21.1 Taylor       |
| WR Golden      0.0 ○ | ✓  6.4 Waddle       |
| WR Flowers    12.7 ◉ | ◉  8.4 G. Wilson    |
|  ...10 rows: yours on the left, theirs on  |
|  the right                                 |
+--------------------------------------------+
```
- `○` means he hasn't played yet; before kickoff the row also says when he plays (for example MON for Monday night). `●` means he's playing now, `◉` means his team has the ball, and `✓` means his game is over.
- K. Williams is Kyren Williams (theirs). Your J. Williams is Javonte, a different player.
- Full sweat means the game is close and lots of points are still to come. "You need 99.0 more" is your opponent's score plus what his players should still get, minus your score. Your 9 players still to play should get about 97.2, so it's close to a coin flip (48%).
- `Story >` opens Sunday Story.
- **Step 1 shows only Lineup.** Swings arrives in step 3, Story in step 5 and What-if in step 9. Until then those buttons aren't there, so nothing is missing.

**A game** (opened from a chip, a tile or a banner)
```
+--------------------------------------------+
| YOU 24.4  43%  16.9 OPP  || 5x 1:40P Find :|
| [game chips: tap one to switch games]      |
| <-  CHI 14 @ ATL 0   Q2 12:08  Pin  [<][>] |
| [field: CHI ball, 4th & 10 at ATL 48 ]     |
|     PLAYS       MY GUYS       MOMENTUM     |
|     =====     (swipe between these)        |
|Y CHI 14-0 ATL . Q2 12:42 . 2nd & 9 ATL 47  |
|Y D'Andre Swift  loss of 1                  |
|Y -0.1 your RB                              |
|    ...the rest of this game's plays        |
+--------------------------------------------+
```
`<-` goes back. `[<]` and `[>]` jump to the previous or next live game. `Pin` (step 2) keeps this game's score on screen while you use the other tabs.

**Games at 3:42 PM**
```
+--------------------------------------------+
| (score bar, game chips, tabs)              |
| (All 14) (Live 7) (Next 5) (Final 2)       |
| Sort: [Matters to me] [Kickoff]       ↻    |
| +--------------------+ +------------------+|
| | TEN 20  IND 20     | | PIT 13  TB 16    ||
| | Q4 5:32       HOT  | | Q4 8:08          ||
| | PPPPPPPPPPPPPPPP   | | YYYYYYYYYYYYYYYY ||
| | Taylor, Downs      | | Freiermuth       ||
| +--------------------+ +------------------+|
+--------------------------------------------+
```
- **All 14** counts every game this week: 7 live, 5 coming up (including Monday's WAS@SF) and 2 final (Thursday's SEA@DEN and the 9:30 AM London game).
- **HOT** means a close game with a team near the goal line right now.
- The **YYY/PPP bar** shows whose players are in the game. TEN@IND is all purple because only their Taylor and Downs play in it. PIT@TB is all yellow because the only starter in it is your Freiermuth.
- **Matters to me** puts first the games that can change your matchup most. TEN@IND is first because it's tied 20-20 and Taylor is near the goal line. **Kickoff** sorts by start time instead.
- `↻` appears when the order is out of date. Tap it to re-sort. The grid never re-sorts while you're looking at it.

**On a computer** (at 3:42 PM)
```
+-----------------------------------------------------------------------------------------------+
|YOU 48.6   WIN 48%   44.6 OPP     ||  [1x][2x][5x][20x]   3:42P v   [Find a player or game]   :|
|<  [TEN 20-20 IND  PP]  [PIT 13-16 TB  Y]  [more live games ...]                              >|
+-------------------------------+-------------------------------+-------------------------------+
|ZONE                           |MATCHUP     League             |GAMES                          |
|(My matchup) (All) (Big)       |48.6     WIN 48%     44.6      |(All 14) (Live 7) (Next 5) ... |
|                               |FULL SWEAT                     |                               |
|P Jonathan Taylor 4-yd rush TD |You need 99.0 more             |+-------------++-------------+ |
|P TEN 20-20 IND . Q4 5:32      |[Lineup] [Swings]   [Story >]  ||TEN 20 IND 20||PIT 13  TB 16| |
|P +6.4 opp RB  Win 56% -> 48%  |QB Daniels 0.0 | Allen      0.0||Q4 5:32   HOT||Q4 8:08      | |
|                               |RB Swift  22.7 | K.Williams 0.0||PPPPPPPPPPPPP||YYYYYYYYYYYYY| |
|Y D'Andre Swift  loss of 2     |RB Marks  10.1 | Taylor    21.1|+-------------++-------------+ |
|Y CHI 31-7 ATL . Q4 13:04      |WR Golden  0.0 | Waddle     6.4|                               |
|Y -0.2 your RB                 |...10 rows                     |Click a game and it opens      |
|                               |                               |here, in this column.          |
|...older plays below           |                               |x goes back to the grid.       |
+-------------------------------+-------------------------------+-------------------------------+
```
You see three columns at once: Zone, Matchup (or League) and Games. Click a game and it opens in the Games column; `x` goes back to the grid. A smaller window gets two columns, and the second one has Matchup / Games / League buttons on top.

## Features, by tab (the number is the build step)

**Top of every screen**
- Score bar: you against them, plus your win chance. Tap it to open Matchup. (1)
- Pause, speed and the clock are one tap each. The clock opens the jump buttons and explains what the replay is. (1)
- Game chips: every live game, most important first, with yellow and purple dots for whose players are in it. You can hide the row in Settings. (1)
- **Find**: type "swi" and pick D'Andre Swift, or type "ind" for TEN@IND. It opens that player's page or that game. (2)
- **Pin a game**: on a phone, one pinned game shows as a thin score strip at the top of every tab. On a computer, up to 3 games stay open as tabs in the Games column. (2)
- Banners and tab dots for big moments (touchdowns, turnovers, big win-chance swings). They never change the screen for you. (4)
- Settings: fantasy on/off, banners on/off, shapes for colorblind players, hide the game chips. (4)

**Zone**
- The My matchup / All / Big filters stay pinned at the top. (1)
- Shorter play cards, so 3 or 4 fit on the first screen. The long play description is cut to one line (tap the card to read all of it). Every card still shows the score, quarter, clock, down & distance and its yellow or purple bar. (1)
- **When**: show only the 9:30 AM, 1 PM, 4 PM or night games, so you don't scroll through all 2,399 plays. (2)
- "On the field now": which of your guys (or theirs) has the ball right now. (3)
- Free Picks: questions like "Will this drive end in a TD?" or "Will Swift score more or less than 15.5 points?" that earn points and streaks. No money, ever. (7)

**Matchup**
- Your 10 starters next to theirs, live. (1)
- Sweat meter (Chill / Sweaty / Full sweat) and "You need X more". (3)
- Your win chance across the whole day. Tap a big swing to see the play that caused it. (3)
- **Biggest swing**: the player whose next plays can change your win chance the most. For example, at the end of Sunday Kittle still has his whole Monday game left, so a big night from him could flip your matchup. (3)
- Sunday Story: tap through cards about your day, then save a picture for trash talk. (5)
- What-if buttons, like "+TD for Kittle", that show what your win chance would become. (9)

**Games**
- A grid of every game, sorted by "matters to me" or by kickoff. (1)
- The yellow/purple bar on each game. (3)

**Inside a game**
- The score and a mini field stay on top. Swipe between Plays, My guys and Momentum. (2)
- Tap a play to see why you got the points and how your win chance moved. (2)
- Drives, box score and game info: stadium, who's expected to win, and expected total points. (8)

**Players**
- Tap any player's name to see his stats today and every play he was in. (3)

**League** (step 6)
- All 5 matchups live, standings, trades and waiver moves, your record against this opponent, and a button that opens Sleeper chat. (6)

**Not doing:** chat inside the app, anything with money or prizes, betting words, videos, NFL logos or player photos.

## Build order

Each step gets published, so you can try it on your phone right away.

0. **Fix two data bugs and tidy the code.** Nothing looks different.
   - Bug 1: when the first quarter of ARI@LAR ended, the app thought it was halftime and showed your win chance jumping from 59% to 74% for 4 seconds. That fake jump goes away.
   - Bug 2: the code behind the jump-to-kickoff buttons exists twice, and one copy was never finished. We keep the working copy in one place.
1. **The new layout**: the top stays put, tabs, swiping, game chips, the Matchup lineup, and columns on a computer. It's built in 7 small pieces.
2. **The game screen**: swipe between its tabs, and tap a play for details. Also Find, When and Pin.
3. **Your matchup explained**: sweat meter, what you need, the win chart, biggest swing, on the field now, player pages.
4. **Banners, tab dots and Settings.** If you want it (Question 6), also a TV-delay slider. It holds plays back a few seconds so the app doesn't spoil something your TV hasn't shown yet.
5. **Sunday Story and share pictures.** Inside the claude.ai preview, the Share button might not be allowed. If so, the picture opens on screen, and you press and hold it (or right-click it) to save it.
6. **League tab.** You'll need to run one command on a computer at home first.
7. **Free Picks.**
8. **Game extras**: drives, box score, game info.
9. **What-if buttons.**

Later: more leagues, replaying any week, and a real phone app made with **Expo**, a free tool for turning this into an app you install on your phone.

## Questions for you (my pick is in brackets)

1. **When you said "tabs to open other things", what did you mean?**
   - (a) Section tabs, with games and players opening on top (the plan above).
   - (b) Browser-style tabs, so several games stay open and you flip between them.
   - (c) Both.

   [Both. Step 2 adds Pin: one pinned game on a phone, and up to 3 open games as tabs on a computer. If you want 4 games on screen at once, say so and it becomes a later step.]
2. **Tabs at the top or at the bottom?** Top tabs let you swipe between them. On an iPhone, Safari's own bar sits at the bottom, where it gets in the way of bottom tabs. Bottom tabs are easier to reach with your thumb, but you tap them instead of swiping. Some Yahoo users complain that tabs at the top are a stretch to reach. [Top for the web app. We decide again for the phone app, where Safari's bar isn't in the way.]
3. **Is the tab order Zone, Matchup, Games right?** [Yes. The game chips already open any game in one tap, so Matchup gets the spot next to Zone.]
4. **When you tap a play card, what should open?** A details card (why you got the points, with an "Open game" button), or the game itself, like now? [The details card on a phone. On a computer, the game opens in its column.]
5. **After the new layout, what comes first?** (a) Matchup explained, (b) Sunday Story and share pictures, (c) League tab, (d) Free Picks. [a, b, c, d]
6. **Do you watch the games on TV while using the app?** If yes, we add the TV-delay slider so the app doesn't spoil plays. Also, should big moments pop up as banners, or only show up as dots on the tabs? [Banners for TDs, turnovers and big swings. Red-zone banners off.]

---

# PART B: FOR THE BUILDER

## B0. Decisions and checked facts

**Scope.** This document is the whole plan: rules R1–R8, the architecture (B1), features (B2), milestones M0–M9 with done-when checks (B3), test moments (B4) and traps (B8). No other draft is needed. Part A's "Why this layout" box is the design rationale. It binds the build through R4 (no sideways scroller inside a page), R5 (no automatic re-sort) and top tabs on the web.

**Layout rules**
- **R1 First screen.** At 390×660 (no pinned game), Zone shows the score, win %, at least 2 full rail chips, the filter chips and at least 3 full play cards without scrolling. The first card's top is at 240px or less (today it is about 612px). On a 375×548 screen at least 2 full cards show (today 0).
- **R2 Two-tap rule.**
  - 1 tap: pause, speed, the clock menu, any live game (rail), the pinned game, full lineups (Matchup tab or the scorebug), filters, Back.
  - 2 taps: jump, any game in the Games grid, and Find plus typing to reach any player or game.
- **R3 Vertical scroll is only for one list of one kind** (feed, grid, lineup, standings). Never stack different features down a page. This is why Matchup uses segmented chips.
- **R4 One horizontal gesture per strip of screen.** No sideways scroller inside a pager page. The rail sits outside the pager, with the tab bar between them.
- **R5 Nothing moves by itself.**
  - No automatic tab, sub-tab, game, column or scroll changes. Live data only changes contents, badges and banners.
  - **Lists never re-order while they are visible.** The rail and the Games grid keep their order and show a "↻" chip when the order is out of date (B1.4).
  - A game opens in a column only when the user clicks one. Today's auto-pick of the top game on wide screens is removed.
- **R6 Tabs are places.** Games, plays, players, search, settings, replay and story open as layers or sheets, and Back closes them.
- **R7 Every tab and every sub-chip ships with real content.**
  - Matchup's sub-chips arrive with their milestones: Lineup in M1, Swings in M3, Story › in M5, What-if in M9.
  - League appears in M6, and only when league data exists.
  - Part A tells the user this.
- **R8 Wide screens show more at once than today.**
  - At a window width of 900px or more, the tab pages become side-by-side columns: 2 columns at 900–1199px, 3 at 1200px and up.
  - At 1280×800, the Zone feed, the Matchup lineup and the Games grid are all on screen at once, and the document never scrolls.

**Checked by running the current code on 2026-10-19 against `/home/user/fantasy-zone/app/replay.json`**
- 2,453 plays and 14 games. The full feed is 2,399 cards: 173 My matchup and 192 Big.
- Kickoffs:
  - SEA@DEN, Thursday 8:15 PM;
  - HOU@JAX, 9:30 AM;
  - seven 1 PM games;
  - ARI@LAR, 4:05 PM;
  - LAC@KC and BUF@LV, 4:25 PM;
  - DAL@GB, 8:20 PM;
  - WAS@SF, Monday 8:15 PM.
- The saved plays end at 10:54 PM ET, partway through DAL@GB. The tracker score is **you 123.5, opponent 83.5**. Still to play:
  - yours: Daniels (WAS@SF, Monday, no plays saved), Pineiro (same), plus Golden and J. Williams mid-game;
  - theirs: Kittle (WAS@SF) and Aubrey (mid-game).
- Sleeper's saved points (`fixtures/week6/sleeper-points.json`) for the two lineups total 120.4 against 83.5. The only difference is Golden: ours is 20.2 at 10:54 PM and Sleeper's is 17.1. His game was in progress and the snapshot moments differ. Which number is right is UNVERIFIED.
- Starters in **finished** games match Sleeper exactly: you 90.8 = 90.8, opponent 82.5 = 82.5.
- **Quarter-marker bug.** ARI@LAR play `401873004888` has type "End of Half", period 2, text "END QUARTER 1". It produces a feed card at 4:37 PM showing win **59%→74%**, which drops back on the next marker 4 seconds later.
  - Cause: the tracker sets `g.period=2, clock 0:00`, so `fractionLeft` thinks it's halftime.
  - The card counts as a big play, because its win-chance swing is 5 points or more.
  - All other markers are tagged correctly: 13 End Period P1, 13 End of Half P2, 13 End Period P3.
- **`windows()` stub.** In `src/replay.js` line 52, `windows()` filters with `|| true`, so it is a stub. The real logic is `kickoffWindows()` at app.js line 412. It yields 4 windows: 9:30 AM, 1 PM, 4:05 PM and 8:20 PM. 4:25 merges into 4:05, Thursday is excluded and WAS@SF has no plays.
- **Card situation.** Cards carry `situation: play.start?.downText` (tracker.js line 177), for example "2nd & 6 at IND 34". Today `cardHTML` shows it in `.pmeta` next to the score and clock (app.js line 222). The owner bar is `.play.me` / `.play.opponent` `border-left` (index.html lines 112–113). The card body is `.pmeta`, `.phead`, optional `.pfrom`, `.ptext` (the full play-by-play sentence) and `.pchips`.
- `rankGames()` returns `{game, watch, fantasy, gameScore, gameWhy, flipPower, live, involved[{...p, owner, stake, roleWhy}], reason}`.
- The league fixture has `roster_positions` = QB, RB, RB, WR, WR, TE, FLEX, FLEX, K, DEF, plus 6 BN, and `playoff_week_start` = 14. There is no `previous_league_id`.
- Saved `rosters.json` rows have only `roster_id` and `owner_id`. Saved `matchups_6.json` has 2 rows (points, starters, starters_points) and no `players`.
- `fixtures/week6/raw-summary-401873007.json` (DAL@GB, mid-game) has:
  - `drives.previous`: 11 drives (PUNT, TD, PUNT, INT, INT, FG, INT, TD, END OF HALF, PUNT, TD), plus `drives.current`;
  - `injuries` (5 per team);
  - `gameInfo.venue`.
- **Safe areas, three places today:**
  - `server.js` line 17: the `page()` wrapper injects `:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}`;
  - `app/index.html` line 36: `body::before{position:fixed;…;height:env(safe-area-inset-top)}`;
  - line 34: `html, body{min-height:100%}`.

  `index.html` has no `box-sizing` rule. With `.shell{height:100dvh; padding-top:env(...)}` plus the `:root` padding, a notched phone on `npm start` gets a document taller than the screen and a doubled top inset. M1 step 1 fixes all three and adds `box-sizing:border-box`.
- `server.js` serves any path from `app/`, so `/ui/x.js` maps to `app/ui/x.js`. Its TYPES map only knows .js, .json and .html. Add .css, .svg, .png and .webmanifest if those are ever used.
- The `[hidden]{display:none!important}` rule is injected by server.js only, so the published page needs it in index.html.
- Window-scroll code in app.js to move to page scrollers:
  - line 96 (`go`);
  - lines 168–169 (`update`);
  - line 479 (new-pill click);
  - lines 482–484 (scroll listener);
  - lines 485–491 (resize).
- `update()` rebuilds `#matchup` and `#hot` via innerHTML on every tick (lines 161–162). `matchupHTML` mutates `ui.lastWp` (line 233).
- **Sketch moments used in Part A**, from the tracker:
  - **1:40 PM**, after Taylor's 38-yd catch: you 24.4, opponent 16.9, win 43%. The top My-matchup cards are:
    - Taylor 38-yd catch (2nd & 6 at IND 34, +4.8, 49→43);
    - Swift loss of 1 (2nd & 9 at ATL 47, −0.1);
    - Taylor 4-yd rush (1st & 10 at IND 30, +0.4).
  - **3:42 PM**, after Taylor's 4-yd TD:
    - score 48.6–44.6, win 47.6% (shown as 48%);
    - sweat score 95 (Full sweat); need 99.0; your 9 players left are expected to get 97.2;
    - games: 7 live, 5 upcoming, 2 final;
    - `rankGames` top 2: TEN@IND 20-20 Q4 5:32 (Taylor and Downs, opponent's only) and PIT@TB 13-16 Q4 8:08 (Freiermuth, yours only).

## B1. Architecture

### B1.1 Shell DOM (replaces `header.top`, `#replaybar`, `#root` and `#newpill` in app/index.html)

```html
<div class="shell" id="shell">
  <header class="appbar" id="appbar">
    <button class="score" id="scorebug" type="button" aria-label="Your matchup">…</button>
    <div class="transport" id="transport"></div>  <!-- replay: [❚❚] [5×] [1:40P ▾] · live: [● LIVE 4s] -->
    <button class="iconbtn" type="button" data-sheet="find" aria-label="Find a player or game"><svg …/></button>  <!-- wired in M2 -->
    <button class="iconbtn" type="button" data-sheet="settings" aria-label="Settings">⋮</button>
    <div class="winbar" aria-hidden="true"><span></span></div>   <!-- 3px yellow/purple -->
  </header>
  <div class="pinbar" id="pinbar" hidden>                        <!-- M2, phones only -->
    <button type="button" class="pin-open" data-game="…">…</button><button type="button" class="pin-x" aria-label="Unpin">×</button>
  </div>
  <nav class="rail" id="rail" aria-label="Live games"><ul></ul></nav>
  <nav class="tabbar" id="tabbar" role="tablist" aria-label="Sections"><!-- tabs from visible TABS --><span class="ink" aria-hidden="true"></span></nav>
  <main class="main" id="main">
    <div class="pager" id="pager"><!-- <section class="page" id="page-zone" role="tabpanel" aria-labelledby="tab-zone"> … --></div>
  </main>
  <section class="layer" id="layer" role="region" aria-labelledby="layer-title" hidden><!-- game / player; story uses .layer.full --></section>
  <div class="alert" id="alert" hidden></div>
  <div class="backdrop" id="backdrop" hidden></div>
  <section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" hidden></section>
  <div class="sr-only" aria-live="polite" id="announce"></div>
</div>
```

**App bar at 390px.** The width budget is about 342 of 358px:
- scorebug about 130px (below 400px wide the YOU/OPP words drop, the numbers keep their colours, and `aria-label` keeps the words);
- ❚❚ 40, 5× 40, clock pill 56, Find 40, ⋮ 36.

At 320px the clock pill collapses to an icon.

**`TABS` is a config array.** The same list later becomes the Expo `<Tab.Screen>` list.

```js
const TABS = [
  { id: 'zone',    label: 'Zone',    view: zoneView },
  { id: 'matchup', label: 'Matchup', view: matchupView, fantasy: true },
  { id: 'games',   label: 'Games',   view: gamesView },
  { id: 'league',  label: 'League',  view: leagueView, fantasy: true, needs: (d) => !!d.leagues[0]?.teams },   // M6
];
// each view: { mount(el, ctx), update(ctx, fresh), reset() }
const visibleTabs = (d) => TABS.filter((t) => (!t.fantasy || ui.fantasyOn) && t.needs?.(d) !== false);
```

**When the tab set changes**, call `buildTabs()`. That happens at boot, on the fantasy switch (M4) and when league data first arrives (M6).
1. Compute `ids = visibleTabs(data).map((t) => t.id)`. Return if it is unchanged.
2. Save every page's `scrollTop` into `ui.scroll[id]`.
3. Rebuild the tab buttons (`id="tab-<id>"`, `aria-controls="page-<id>"`) and append the page sections in `ids` order. Pages of hidden tabs are detached but kept in `ui.pages[id]`, so their DOM survives. Restore `scrollTop` after re-attaching.
4. Call `mainPager?.destroy()`, then `mainPager = createPager({ tabbar, pager, tabs, pages, … })`. The pager sets `--ntabs` (B1.3).
5. Keep the current tab if it is still visible. Otherwise select Zone and `H.replace('#zone')`.
6. Run `layoutColumns()` (B1.8).

**Index math.** `ui.tabIds` (visible ids, in order) is the only index space:
- `onSettle(i)` maps to `ui.tabIds[i]`;
- keys 1–4 map to `ui.tabIds[n-1]`;
- `flush()` loops over `ui.tabIds`.

Never index `TABS` by pager position.

**Deep links to a hidden tab.**
- `#matchup` while fantasy is off lands on Zone (`H.replace('#zone')`) with a one-line note in Zone's head: "Matchup is hidden because fantasy is off · [Turn on]".
- `#league` without league data shows the note "League isn't set up yet".
- `#game/<id>` for an unknown id shows "That game isn't in this replay".

### B1.2 CSS rules (app/index.html)

```css
*,*::before,*::after{box-sizing:border-box}   /* none today; without it .shell padding overflows 100dvh and each .page is 100%+32px wide, which breaks snap math */
[hidden]{display:none!important}
html{height:100%;background:var(--turf)}
body{margin:0;height:100%;background:var(--turf)}  /* never overflow:hidden on body (iOS 26 Safari viewport bugs, per research) */
.shell{position:relative;height:100vh;height:100dvh;overflow:hidden;display:grid;
  grid-template-columns:minmax(0,1fr);
  grid-template-rows:auto auto auto auto minmax(0,1fr);
  grid-template-areas:"bar" "pin" "rail" "tabs" "main";
  padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)}   /* the ONLY safe-area padding */
.appbar{grid-area:bar} .pinbar{grid-area:pin;height:36px} .rail{grid-area:rail} .tabbar{grid-area:tabs}
.main{grid-area:main;min-height:0;position:relative}
.layer{grid-row:tabs-start/main-end;grid-column:1;z-index:8;min-height:0;background:var(--turf);
  display:grid;grid-template-rows:auto auto auto minmax(0,1fr)}       /* head · field · subtabs · subpager */
.layer.full{grid-row:bar-start/main-end;z-index:10}                   /* Story covers everything */
.alert{grid-row:tabs-start/main-end;grid-column:1;align-self:start;justify-self:center;
  width:min(100% - 32px,480px);margin-top:6px;position:relative;z-index:9}
  /* spans the 1fr row, so it never grows the tab row; no --chrome-h variable needed */
.rail ul{display:flex;gap:8px;margin:0;padding:6px 16px;list-style:none;overflow-x:auto;
  overscroll-behavior-x:contain;scrollbar-width:none;
  mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}
.tabbar{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr}
.tabbar [role=tab]{min-height:44px;background:none;border:0;font:600 14px/1 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.tabbar .is-current{color:var(--chalk)}
.ink{position:absolute;left:0;bottom:-1px;height:3px;width:calc(100% / var(--ntabs));background:var(--you);will-change:transform}
  /* --ntabs is set by createPager on .tabbar; the M1 test checks ink width = one tab */
.pager{height:100%;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;
  overscroll-behavior-x:contain;scrollbar-width:none}
.pager::-webkit-scrollbar,.rail ul::-webkit-scrollbar{display:none}
.page{flex:0 0 100%;min-width:0;height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;
  scroll-snap-align:start;scroll-snap-stop:always;container-type:inline-size;
  padding:0 16px calc(32px + env(safe-area-inset-bottom))}
.page > *{max-width:680px;margin-inline:auto}
.page-head{position:sticky;top:0;z-index:2;background:var(--turf)}
.newpill{position:sticky;top:48px;z-index:3;margin-inline:auto}
.play{content-visibility:auto;contain-intrinsic-size:auto 92px}   /* keep .play.me/.play.opponent border-left (owner bar) */
.play .ptext{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
  /* only .ptext is clamped; .pmeta (score · Q clock · down & distance) and .phead stay */
.chip > *, .tile > *{pointer-events:none}    /* the <button> stays the tap target while its insides refresh */
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:11;max-height:85%;overflow-y:auto;overscroll-behavior-y:contain}
.backdrop{position:absolute;inset:0;z-index:10}
.tiles{display:grid;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr))}
@container (min-width:560px){.tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container (min-width:760px){.tiles{grid-template-columns:repeat(4,minmax(0,1fr))}}
/* wide "dashboard" (R8): the class is set by JS from matchMedia (B1.8) */
.shell.dash .tabbar,.shell.dash .pinbar{display:none}
.shell.dash .pager{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));overflow:hidden;scroll-snap-type:none}
.shell.dash .page{display:none;scroll-snap-align:none;border-left:1px solid var(--line)}
.shell.dash .page[data-col]{display:block;grid-row:1}
.shell.dash .page[data-col="1"]{grid-column:1;border-left:0}
.shell.dash .page[data-col="2"]{grid-column:2}
.shell.dash .page[data-col="3"]{grid-column:3}
.shell.dash .layer{grid-row:main;justify-self:end;width:calc(100% / var(--cols));border-left:1px solid var(--line)}  /* covers the last column only */
@media (prefers-reduced-motion:no-preference){.layer.opening{animation:slidein .22s ease-out}}
```

**Delete these rules**, which assume the whole document scrolls or pad the safe area a second time:
- `header.top{position:sticky}`;
- `.zone.split` and `.zone.split .deskpanel`;
- `.newpill{position:fixed}`;
- `.strip`;
- `body::before{position:fixed…}` (line 36);
- `html, body{min-height:100%}` (line 34);
- the `.wrap` safe-area side padding (line 39) for anything inside the shell.

**Also in `server.js` line 17:** delete `:root{padding-top:…;padding-bottom:…}` from `page()`. Keep `body{margin:0}`, `img{max-width:100%}` and `[hidden]`.

Nothing is `position:fixed`. Keep all colour tokens (yellow is you, purple is the opponent, red is hot or big) and the Barlow fonts.

**Height budget at 390px wide**

| Area | Height |
|---|---|
| App bar | 48 + 3 |
| Pin bar, only when a game is pinned | 36 |
| Rail | 60 (52px chips) |
| Tab bar | 44 |
| Zone sticky chips | 40, so the feed starts at about 195 |
| "On the field" line, when shown | 32, so the feed starts at 227 or less (263 with a pinned game) |
| Card: meta, head, 1-line text, chips | 88–92 |
| Game layer: head 44 + field 36 + sub-tabs 40 | plays start at about 231 |

### B1.3 Pager, `app/ui/pager.js` (one instance for the main tabs and one per game layer)

```js
export function createPager({ tabbar, pager, tabs, pages, onSettle, onReselect }) {
  const ink = tabbar.querySelector('.ink'), reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const ac = new AbortController(), on = (el, ev, fn, o) => el.addEventListener(ev, fn, { ...o, signal: ac.signal });
  let w = 1, active = -1, target = null, frame = 0, timer = 0, enabled = true;
  const state = { swiping: false };
  tabbar.style.setProperty('--ntabs', String(tabs.length));       // .ink is exactly one tab wide
  const pos = () => pager.scrollLeft / w;                           // fractional while moving (LTR)
  const clamp = (i) => Math.max(0, Math.min(pages.length - 1, i));
  function paint() {                                                 // at most once per frame
    frame = 0; const p = pos();
    ink.style.transform = `translateX(${p * 100}%)`;
    const cur = target ?? Math.round(p);
    tabs.forEach((t, k) => t.classList.toggle('is-current', k === cur));
  }
  function activate(i) {
    active = i;
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    pages.forEach((pg, k) => { pg.inert = enabled && k !== i; });
    onSettle(i);
  }
  function settle() {                                                // safe to call any number of times
    clearTimeout(timer);
    if (!enabled) return;
    const i = clamp(Math.round(pos()));
    if (target != null && i !== target) return;                      // our smooth jump is still travelling
    target = null; state.swiping = false; paint();
    if (i !== active) activate(i);
  }
  function go(i, smooth = true) {
    i = clamp(i);
    if (!enabled) { if (i !== active) activate(i); return; }         // dashboard: columns, nothing scrolls
    target = i;
    if (Math.abs(pager.scrollLeft - i * w) < 1) return settle();     // no scroll => no scrollend
    pager.scrollTo({ left: i * w, behavior: smooth && !reduce.matches ? 'smooth' : 'auto' });
  }
  on(pager, 'scroll', () => {
    if (!enabled) return;
    state.swiping = true; frame ||= requestAnimationFrame(paint);
    clearTimeout(timer); timer = setTimeout(settle, 150);            // fallback where scrollend is missing
  }, { passive: true });
  on(pager, 'scrollend', settle);
  for (const ev of ['pointerdown', 'wheel']) on(pager, ev, () => { target = null; }, { passive: true });
  on(tabbar, 'click', (e) => {
    const k = tabs.indexOf(e.target.closest('[role="tab"]')); if (k < 0) return;
    k === active ? onReselect?.(k) : go(k);
  });
  on(tabbar, 'keydown', (e) => {                                     // WAI-ARIA tabs, automatic activation
    const k = tabs.indexOf(document.activeElement); if (k < 0) return;
    const n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (n == null) return; e.preventDefault();
    const j = (n + tabs.length) % tabs.length; tabs[j].focus(); go(j);
  });
  const ro = new ResizeObserver(() => {
    if (!enabled) return;
    w = pager.clientWidth || 1; if (active >= 0) pager.scrollTo({ left: active * w, behavior: 'auto' }); paint();
  });
  ro.observe(pager);
  return {
    go, state, get active() { return active; },
    start(i) { w = pager.clientWidth || 1; go(i, false); settle(); },
    setEnabled(v) {                                                  // false in dashboard mode (B1.8)
      enabled = v; target = null; state.swiping = false;
      if (!v) { pager.scrollLeft = 0; pages.forEach((pg) => { pg.inert = false; }); return; }
      w = pager.clientWidth || 1; pager.scrollTo({ left: Math.max(active, 0) * w, behavior: 'auto' });
      pages.forEach((pg, k) => { pg.inert = k !== active; }); paint();
    },
    destroy() { ac.abort(); ro.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); },
  };
}
```

How each case is handled:
- **Tapping a tab two pages away.** The target lock stops the middle page from activating. A pointerdown or wheel clears the lock, so a user who interrupts the jump never leaves it stuck.
- **Scrolling to the current position.** That fires no scroll and no scrollend, so the pager calls `settle()` directly.
- **Rotation or resize.** The ResizeObserver re-snaps to the active page. In dashboard mode it does nothing.
- **Tab set changes.** Call `destroy()` and create a new pager (B1.1). Never patch `tabs`/`pages` in place.
- **Off-screen pages.** They are `inert`. Per the research, a touch on an inert neighbour mid-swipe falls through to the pager; verify on device.
- **Never call `scrollIntoView`.** It also scrolls ancestors, including the preview iframe. Use `pager.scrollTo` and `page.scrollTo`.

### B1.4 Game rail, `app/ui/rail.js`

**Chip contents.** Each chip is about 148×52px:
- line 1: `CHI 17-14 ATL` plus yellow/purple dots, one for each of your or your opponent's starters in the game;
- line 2: the clock plus `shortReason(r)`.

`shortReason(r)` is new in `src/model.js`. It returns the top involved player's last name plus `roleWhy` (for example "Swift RZ"), and falls back to `gameWhy` when no one is involved. It is at most 14 characters. The only abbreviation it may use is "RZ", which Part A's legend explains.

Other chip states:
- Hot border when the existing tile "hot" rule fires.
- `aria-current="true"` on the chip of the open game.
- A pre-game chip shows the kickoff time.
- A finished game shows "Final".

**Order**, from `railOrder(ranked)`, which is pure and lives in `src/view-models.js`:
1. Live games by `watch`.
2. Then the next 2 upcoming games by kickoff.
3. If nothing is live: upcoming games, then the 3 most recent finals.
4. Always end with an "All games ›" chip. It selects the Games tab (on wide screens it focuses the Games column, after `closeAll` if a game covers it).

The rail holds at most 10 chips, so its end is 3–4 swipes away.

**Order is frozen while visible (R5).** The rail is always on screen, so it applies a new order only on:
- the first render;
- a replay Jump;
- a Live⇄Replay switch;
- a tap on the "↻" chip.

Between those:
- Chips are keyed by `data-game`. Updates change text, dots and borders in place, and the `<button>` itself is never replaced or moved.
- A game that newly qualifies (for example, kickoff of a game not yet in the rail) is appended just before "All games ›". If that makes 11 chips, the lowest-ranked upcoming or final chip is dropped, never the chip under the user's finger (none within 1.5 s of a pointerdown on it).
- A game that ends stays where it is, marked Final, until the next re-sort.
- When the first 3 ids of `railOrder()` differ from the first 3 shown, a "↻" chip appears at the start (`aria-label="Re-sort games, most important first"`). Tapping it applies the new order with FLIP (200 ms, skipped under reduced motion) and scrolls the rail to the start.

**Taps**
- With no layer open, a tap opens the game layer.
- With a game layer open, a tap switches the game in place with `H.replace('#game/ID')` and keeps the current sub-tab.
- On a fine pointer (mouse), show ‹ › buttons that scroll the rail by one chip-row width.

**Settings and fantasy off.** "Show game chips" off hides the row, and its grid row collapses. With fantasy off, the rail ranks with `DIALS.fantasyOff`.

### B1.5 Layers, sheets, history, `app/ui/layers.js`

**Layers** (game, player, story):
- **Phone, game or player layer.** It covers the tab bar and pager (`tabs-start/main-end`) and keeps the app bar, pin bar and rail usable: a rail tap switches the game in place.
  - It is therefore `role="region"` with `aria-labelledby="layer-title"`, not a modal dialog.
  - The tab bar and `.main` get `inert`, because they are covered.
  - Focus moves to the layer's ‹ button. On close it returns to whatever opened the layer if that is still in the DOM, otherwise to the active tab.
- **Story layer (M5).** It is `.layer.full`, covers everything, and is `role="dialog" aria-modal="true"`, with everything else inert.
- **Wide screens.** The game layer covers the last column only (B1.8), is `role="region"`, makes only the covered column inert, and has a × to close.

**Sheets** (play, player-lite, find, replay/clock, live, settings):
- A bottom sheet with a backdrop: `role="dialog" aria-modal="true"`, with everything else inert.
- Close by dragging the handle down (pointer events), tapping the backdrop, or Esc.
- On wide screens: a centered dialog. The Jump menu uses `<button popovertarget="jumpmenu">` (per research: Safari 17+, Chrome 114+).

**History**

```js
const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
const H = {
  ok: true,                                   // set false if the published-page check shows Back leaving the preview
  push(s, h) { if (!H.ok) return false; try { history.pushState(s, '', h); return true; } catch { return false; } },
  replace(h) { try { history.replaceState(history.state, '', h); } catch {} },
};
// boot: try { history.replaceState({ fz: 1, depth: 0 }, '', '#' + ui.tab); } catch {}
function open(entry, hash) {                  // any layer or sheet
  entry.viaHistory = H.push({ fz: 1, depth: ui.depth + 1 }, hash);
  if (entry.viaHistory) ui.depth++;           // count only entries that really exist
  ui.stack.push(entry); show(entry);
}
function back() {                             // in-app ‹, ×, Esc, backdrop tap
  const top = ui.stack.at(-1); if (!top) return;
  if (top.viaHistory && history.state?.fz && history.state.depth === ui.depth) history.back();
  else { ui.stack.pop(); hide(top); }         // never history.back() without our own entry on top: it would leave the page
}
addEventListener('popstate', (e) => {
  const d = e.state?.fz ? e.state.depth : 0;
  if (d > ui.depth) return route(location.hash);           // Forward button: reopen from the hash
  // history.go(-n) fires ONE popstate, so close every layer/sheet above the new depth here
  while (ui.stack.length && (ui.depth > d || !ui.stack.at(-1).viaHistory)) {
    const top = ui.stack.pop(); hide(top); if (top.viaHistory) ui.depth--;
  }
  const then = ui.afterPop; ui.afterPop = null; then?.();
});
function closeAll(then) {
  if (ui.depth > 0) { ui.afterPop = then; history.go(-ui.depth); }   // one popstate closes everything
  else { while (ui.stack.length) hide(ui.stack.pop()); then?.(); }    // never history.go(0): it reloads the page
}
```

- Tabs use `H.replace('#zone')`, so Back doesn't step through tabs. While a layer is open, a tab change (the dashboard column picker) updates `ui.tab` only and leaves the layer's hash alone.
- Use `closeAll` when the scorebug (opens Matchup) or the "All games ›" chip (opens Games) is tapped while a layer or sheet is open.
- **Find.** Picking a result swaps the Find sheet for the target inside the same history entry (`H.replace(targetHash)`, same `ui.stack` slot), so one Back closes it.
- **Deep links:** `#zone`, `#matchup`, `#games`, `#league`, `#game/<id>`, `#game/<id>/plays|guys|momentum`, `#player/<id>`. On load: `replaceState({fz:1,depth:0}, '#'+tab)`, then `open()` the layer, so Back lands on the tab. Hidden or unknown targets are handled as in B1.1.
- **Optional app entry.** Try it in M1 step 7 and keep it only if it behaves on iPhone Safari and Android Chrome. Push one `{fz:1, depth:0, app:true}` entry when the user first leaves Zone. When popstate reaches the base entry with `ui.tab !== 'zone'`, select Zone. The next Back then leaves the app. This softens the iOS left-edge back swipe on pages 1 and up.

### B1.6 Nested-swipe rules

1. **Horizontal strips.**
   - Rail: free scroll.
   - Main pager: snap, and off entirely in dashboard mode.
   - Game sub-pager: lives inside the layer, which makes the main pager inert, so the two never compete.
   - Story: tap zones only (right half for next, left half for back); swipe down closes it. There is no sideways swipe.
2. **No horizontal scroller inside any pager page.** Use grids and short wrapping chip rows: at most 4 chips, with "On the field" wrapping to at most 2 lines and then "+N".
3. **The tab bar sits between the rail and the pager**, as a physical buffer. Part A explains this as the "fence".
4. **`overscroll-behavior-x: contain`** on the rail and both pagers. This also stops Chrome's Mac trackpad Back; Safari on Mac ignores it, which is acceptable.
5. **Edges.** Use 16px gutters, and nothing draggable starts within about 20px of a screen edge. The iOS left-edge back swipe can't be blocked on pages 1 and up: accept it, or use the optional app entry from B1.5.
6. **The score band in the game layer does NOT swipe at first.** Games switch with the ‹ › buttons and the rail chips. Add a band swipe only if device testing shows no mis-swipes against the sub-pager directly below it.
7. **A future draggable chart** needs `touch-action: pan-y` and its own pointer handlers.
8. **Mouse.** There is no drag-to-swipe emulation. Clicks, keys, trackpad two-finger scroll and Shift+wheel move the pager natively. Part A tells the user this.

### B1.7 Vertical scroll per page

Each `.page`, and each of the layer's sub-pages, is its own scroller. Each keeps its own `scrollTop`, and switching tabs never re-renders. Save and restore `scrollTop` around anything that sets `display:none` or detaches a page: tab-set rebuilds and dashboard mode switches.

Costs, accepted:
- Safari's toolbar doesn't auto-collapse.
- Tapping the status bar doesn't scroll to top. Tapping the active tab or sub-tab does (`onReselect` calls `page.scrollTo({top:0})`).
- Pull-to-refresh is gone, which is good, since it would restart the replay. Keep `overscroll-behavior-y: contain` (not `none`), so the iOS bounce stays.

### B1.8 Wide screens: the dashboard (R8)

**Mode.**
- `mq2 = matchMedia('(min-width:900px)')` and `mq3 = matchMedia('(min-width:1200px)')`. Media queries see the iframe's own viewport in the preview, which is what we want.
- `layoutColumns()` runs on their `change` events, on `buildTabs()`, and when the column-2 picker changes:

```js
function layoutColumns() {
  const want = mq3.matches ? 3 : mq2.matches ? 2 : 1;
  const prev = ui.cols; savePageScroll();
  ui.cols = want > 1 ? columnsFor(want, ui.tabIds, ui.pick) : null;   // pure, src/view-models.js
  shell.classList.toggle('dash', !!ui.cols);
  shell.style.setProperty('--cols', String(ui.cols?.length ?? 1));
  for (const id of ui.tabIds) { const pg = ui.pages[id], c = ui.cols?.indexOf(id) ?? -1;
    if (c >= 0) pg.dataset.col = String(c + 1); else delete pg.dataset.col;
    pg.setAttribute('role', ui.cols ? 'region' : 'tabpanel'); }
  mainPager.setEnabled(!ui.cols);
  if (!ui.cols && prev) mainPager.go(ui.tabIds.indexOf(ui.tab), false);
  restorePageScroll(); placeLayer();                   // the open game keeps its id, sub-tab and scroll
}
```

**`columnsFor(cols, tabIds, pick)`** (pure, with unit tests):
- `cols` is capped at `tabIds.length`.
- **2 columns:** `['zone', pick]`, where `pick` is any non-Zone visible tab (default Matchup, or Games when fantasy is off).
- **3 columns:** `['zone', pick, 'games']`, where `pick` is Matchup or League (default Matchup). If no such tab is visible (fantasy off), fall back to 2 columns `['zone','games']`.
- Tests:
  - `(3,[zone,matchup,games],'matchup')` gives `[zone,matchup,games]`;
  - `(3,[zone,matchup,games,league],'league')` gives `[zone,league,games]`;
  - `(3,[zone,games],*)` gives `[zone,games]`;
  - `(2,[zone,matchup,games],'games')` gives `[zone,games]`;
  - `(2,[zone,matchup,games],'zone')` gives `[zone,matchup]`.

**Column heads.** Each column's `.page-head` shows its title. Column 2's head holds a small segmented picker (`role="group"`, `aria-pressed` buttons) for the tabs that can go there: Matchup / League, plus Games when there are 2 columns. Choosing one sets `ui.pick` (kept in localStorage as a per-viewer convenience).

**Games in the dashboard.**
- Clicking a game (rail chip, tile, play card) opens the game layer over the **last** column only: column 3 at 3 columns, column 2 at 2 columns. The covered page is inert.
- × or Esc closes it, and the grid is back at its old scroll spot.
- From M2, the layer head holds up to 3 open games as browser-style tabs (`[CHI@ATL ×][TEN@IND ×]`). Opening a 4th replaces the oldest. Switching uses `H.replace('#game/ID')`. Closing the last game tab closes the layer.
- No game opens on load unless the hash names one (R5).

**Gestures.** In dashboard mode there is no pager swipe at all, so rail/pager adjacency doesn't arise. Each column scrolls vertically. Touch devices at 900px and up (iPad landscape) get columns too. iPad portrait (820px) keeps the pager.

**App bar, one row.** Full names and projections, inline speed buttons [1×][2×][5×][20×], the Jump popover, Find as a text field, the mode pill and ⋮.

**Rail** spans the full width, with ‹ › buttons on a fine pointer.

**Keyboard**
- 1–4: select a tab, when not typing. In the dashboard this focuses that column's head, or puts the tab in column 2.
- ← →: move between tabs or sub-tabs (WAI-ARIA).
- [ and ]: previous or next game.
- `/` or Ctrl/⌘+K: open Find.
- Esc: close the top sheet or layer.

### B1.9 Accessibility

- **Tabs.** WAI-ARIA tabs: `role=tablist/tab/tabpanel`, `aria-selected` and roving `tabIndex` on one tab, automatic activation, and `inert` on off-screen pages. In the dashboard, pages become `role=region` labelled by their column heads.
- **Rail.** A `<nav>` with a `<ul>` of `<button>`s. Each button has a full `aria-label`, for example "Chicago 17, Atlanta 14, 3rd quarter 4:12, your player D'Andre Swift". The open game's chip has `aria-current`. The ↻ chip has its own label.
- **Layers and sheets.** Game and player layers are `role=region` (the app bar and rail stay reachable by design). Story and all sheets are modal dialogs. Find's input has a visible label and announces its result count politely.
- **Announcements.** One `aria-live="polite"` region. It announces only:
  - tab changes that came from a swipe;
  - your own big plays, at most one every 10 s.

  The feed is never a live region.
- **Targets and gestures.** Tap targets are at least 44px. Every swipe has a tap or keyboard equivalent.
- **Reduced motion.** `prefers-reduced-motion` plus a Settings switch: instant pager jumps, no FLIP, no slide-in.
- **Colorblind setting.** ▲ for yours and ◆ for theirs, next to the yellow and purple.
- **Contrast.** Light and dark themes both pass contrast.

### B1.10 Live-update pipeline (fixes lost taps and jank)

In `src/tracker.js`, add `let version = 0`, bump it whenever a play is applied or `updateGame` runs, and expose `version()`.

```js
function tick(cards) {                       // replay: every 250 ms · live: every 10 s poll
  renderTransport();                         // textContent only, every tick
  const v = tracker.version();
  if (v === ui.seen) return;                 // most 1× ticks end here
  ui.seen = v;
  const fresh = cards.filter((c) => !c.silent && c.kind !== 'marker');
  trackWp(); bumpBadges(fresh); queueAlerts(fresh);   // ui.lastWp / ui.wpDelta live here now, not in matchupHTML
  ui.pending.push(...fresh);
  if (mainPager.state.swiping || subPager?.state.swiping || document.hidden) return;
  flush();
}
function flush() {
  const ctx = lazyCtx();                     // snapshot() and rankGames() computed once, only if a view asks
  appbar.update(ctx); rail.update(ctx); pinbar.update(ctx);
  const near = ui.cols ? new Set(ui.cols) : new Set(ui.tabIds.filter((_, k) => Math.abs(k - mainPager.active) <= 1));
  for (const id of ui.tabIds) near.has(id) ? view(id).update(ctx, ui.pending) : (ui.missed[id] ??= []).push(...ui.pending);
  if (ui.layer) LAYER.update(ctx, ui.pending);
  ui.pending = [];
}
// onSettle / layoutColumns: pages that come into reach get update(ctx, ui.missed[id]) (feeds buffer behind the pill,
// so scroll is kept); remount only if the backlog exceeds 40 cards. visibilitychange(visible) → flush()
```

Rules every view follows:
- **(a) Change things in place**, keyed by `data-game` / `data-id`: `textContent`, `style.width` (keeps the `.wpbar` 0.5 s transition), or `if (el._h !== html) el.innerHTML = el._h = html` on inner nodes only.
- **(b) Order is frozen while visible** (R5). Games-grid tiles follow the rail's rule (B1.4). They re-sort only when the Games tab becomes active (onSettle, or when it enters a dashboard column), on Jump, on Live⇄Replay, or on a tap of the grid's ↻ chip. Contents still update in place.
- **(c) One feed component**, `app/ui/feed.js` `createFeedList(el, {filter, limit})`, used by Zone, the game's Plays page and the player sheet:
  - Insert new cards at the top only while the top sentinel is visible (IntersectionObserver with root = the page).
  - Otherwise buffer them behind the sticky "↑ N new plays" pill. Tapping the pill inserts the cards and scrolls to top. Never insert above the reader: per the research, iOS 26 has no scroll anchoring. Buffer regardless of version.
  - Load older cards from `tracker.feed()` when the bottom sentinel shows.
  - Trim the DOM tail past `limit`.
  - A batch of more than 40 cards (20×, or returning from a background tab) remounts instead.
  - `setFilter(fn)` remounts for the filter chips and the When filter.

### B1.11 Files

| File | Status | Contents |
|---|---|---|
| `app/index.html` | Change | Shell and CSS above; delete lines 34 and 36 and the shell-side `.wrap` padding |
| `server.js` | Change | Remove the `:root` safe-area padding from `page()` (line 17). Add TYPES entries only if non-.js/.json/.html files are served |
| `app/app.js` | Change | Shrinks to boot, `startReplay`/`startLive` (unchanged), router (`buildTabs`, `layoutColumns`, layers, hash, popstate), tick, and one delegated click handler. `ui.screen` becomes `ui.tab` + `ui.tabIds` + `ui.cols` + `ui.stack` + `ui.depth`. `go()` splits into `selectTab()` / `openGame()` |
| `app/ui/pager.js`, `rail.js`, `layers.js`, `feed.js`, `alerts.js` | New | Generic widgets. `alerts.js` holds the banner queue and display |
| `app/views/cards.js` | New | `cardHTML`, `tileHTML`, `esc`, `pct`, `n1`, moved from app.js |
| `app/views/charts.js` | New | `fieldSvg`, `momentumSvg`, sparkline |
| `app/views/appbar.js` (also the pin bar), `zone.js`, `matchup.js`, `games.js`, `game.js`, `sheets.js`, `find.js`, `settings.js`; later `story.js`, `league.js` | New | One file per screen |
| `src/view-models.js` | New, pure, no DOM | `cardVM`, `tileVM` (adds `mineStake`/`theirStake`), `chipVM`, `railOrder`, `columnsFor`, `matchupVM`, `lineupVM`, `onFieldVM` |
| `src/insights.js` | New, pure | `statText`, `sweat`, `needs`, `breakeven`, `swings`, `breakdown`, `whatIf` |
| `src/search.js` | New, pure | `buildIndex`, `search` (M2) |
| `src/alerts.js`, `src/story.js`, `src/gamecenter.js` (`drives`, `boxScore`, `info`), `src/picks.js`, `src/league.js`, `src/delay.js` | New, pure | One topic per file, each with `test/<name>.test.js` |
| `tools/moments.js` | New | Prints the B4 test-moment tables from the tracker. Done-when numbers come from this script, not from typing |
| `tools/save-league.js`, `tools/check-board.js` | New | M6 |
| `src/tracker.js`, `src/replay.js`, `src/model.js`, `src/plays.js`, `src/live.js`, `src/sync.js`, `src/sleeper.js`, `tools/make-replay.js` | Change | Per feature, see B2 |

Publishing: every new file must go into the artifact's `files` map.

## B2. Features

Size: S = one session, M = 2–4 sessions.

**Data-source status, as supported by the research**

| Source | Status |
|---|---|
| Sleeper documented API: `/v1/league/<id>`, `/rosters`, `/users`, `/matchups/<week>` (rows include `players`, `starters`, `points`), `/transactions/<week>`, `/state/nfl`, `/players/nfl` (5MB, at most daily), `/players/nfl/trending/add` | Free, read-only, non-commercial use only, under 1000 calls/min |
| Sleeper `/projections/` and `/stats/` | Already used. **Undocumented**, may change |
| ESPN scoreboard and summary | **Unofficial**. Research reports some 403s since Aug 2026, with `site.web.api.espn.com` as a reported fallback host (UNVERIFIED). The replay is always the backup |
| Other ESPN endpoints (injuries, news, standings, gamelog) | Community docs; treat as UNVERIFIED until tried |
| nflverse | CC-BY 4.0, credit "Data: nflverse". About a day behind |
| Images | No ESPN headshots or NFL logos. Use team-colour badges with abbreviations. Sleeper avatars are fine |

| Feature | M | Where | Data | Files | Size | Tests |
|---|---|---|---|---|---|---|
| Shell, tabs, pager, per-page scroll, `buildTabs()`, `--ntabs`, single safe-area padding | 1 | all | none | index.html, server.js, app.js, ui/pager.js | M | M1 checklist |
| Wide dashboard: 2 or 3 columns, column-2 picker, game covers the last column | 1 | all | none | app.js `layoutColumns`, view-models `columnsFor` | S | `columnsFor` unit tests; M1 (h) |
| App bar: scorebug + `❚❚` + speed pill (cycles 1→2→5→20) + clock pill opening the replay sheet (Jump, Live/Replay, explanation) + Find button; live: `● LIVE Ns`, red "Offline" after 30 s | 1 | all | `snapshot().matchups`, `replay.advance/jump`, `windows()` | views/appbar.js, views/sheets.js | S | 1-tap speed; clock updates text only |
| First-run "Replay, not live" banner (`store.set('replayNoteSeen')`); the same text also lives in the clock sheet | 1 | Zone | localStorage | views/zone.js | S | stays dismissed after reload; app still works if storage throws |
| Game rail, order frozen while visible, ↻ chip | 1 | all | `rankGames()`, new `shortReason()`, `railOrder()` | ui/rail.js, model.js, view-models | S–M | 10/10 taps at 20×; order unchanged for 10 min except appends; ↻ re-sorts |
| Zone feeds (My matchup / All / Big as sticky chips). Cards keep `.pmeta` (score · Q clock · `card.situation` down & distance), `.phead` and the owner bar; only `.ptext` is clamped to 1 line | 1 | Zone | `tracker.feed()` | ui/feed.js, views/zone.js | S | pill buffers when scrolled; scroll position kept; 1:40 PM Taylor card shows "2nd & 6 at IND 34" and a purple bar |
| Lineup face-off: 10 rows, 36–40px, status ○ yet / ● live / ◉ has ball / ✓ final, points, expected left, stat line. Only the `[Lineup]` sub-chip exists in M1 | 1 | Matchup | `matchupViews()` mine/theirs (slot order); `roster_positions` (copy into replay.json in make-replay and into live.js leagues; fall back to `pos`); new `tracker.statLine(id)` | views/matchup.js, `lineupVM`, `statText` | S | 10 rows with labels QB…DEF; K "2/2 FG, 3 XP"; DEF "2 sacks, 1 INT, 17 pts allowed" |
| Games grid: chips All/Live/Up next/Final; 2 columns (3–4 via container queries); sort toggle "Matters to me / Kickoff"; order frozen while visible, ↻ chip | 1 | Games | `rankGames()` | views/games.js, `tileVM` | S | at 3:42 PM: All 14 = Live 7 + Next 5 + Final 2; no tile moves while the tab is visible |
| Game layer v1 (today's panel parts inside a layer; Back; covers the last column on wide screens) | 1 | layer | existing `panelTopHTML`, `fieldSvg` | views/game.js, ui/layers.js | S–M | Back, Esc, `#game/ID` |
| Game sub-tabs Plays / My guys / Momentum; Plays chips All / Scoring (`card.scored`) / My players; ‹ › in rail order frozen at open | 2 | layer | feed filtered by `gameId`; `momentum(id)`; stakes from `rankGames().involved` | views/game.js (second `createPager`) | S–M | ‹ › visits every live game |
| Play sheet + points breakdown | 2 | sheet | card; new `card.lines`; new `gameWpBefore/After` (computed in addPlays today, not stored) | tracker.js, insights `breakdown`, views/sheets.js | S–M | sum test below |
| Find: search players and games | 2 | sheet from the app bar | lineups, players named in `tracker.feed()` cards, games + a small `TEAM_NAMES` map | src/search.js, views/find.js | S | below |
| When filter (time window) in Zone | 2 | Zone sticky head | `windows()` (M0), card `gameId` → kickoff | views/zone.js, ui/feed.js `setFilter` | S | below |
| Pin a game (phone pin bar) and up to 3 game tabs (wide) | 2 | app-wide | `store.get/set('pin')` | views/appbar.js, views/game.js | S | below |
| Win chance over the day + swing markers (adds the `[Swings]` sub-chip) | 3 | Matchup › Swings | new `tracker.history(leagueId)`: push `{t, wp, cardId}` when a league's wp moves 0.005 or more, skipping marker cards | tracker.js, views/charts.js | S | biggest marker = Walker 33-yd TD |
| Sweat meter + Who you need (hero line) | 3 | Matchup hero | `winProb`, `remaining` | insights.js | S | fixtures below |
| Biggest swing (leverage), Matchup › Swings and per game in My guys | 3 | Matchup, layer | `remaining`, `remainingSpread`, `winChance` | insights `swings` | S | zero-spread and mirror tests |
| On the field now | 3 | Zone (sticky-head line, hidden when empty, can be turned off) | `snapshot().games` + starters: `p.game.state==='in' && p.game.offense===p.nflTeam`, QB/RB/WR/TE only; red-zone glow on `isRedZone` | `onFieldVM` | S | Swift chip appears on CHI drives and leaves when ATL has the ball |
| Stake bar (yours vs theirs) on Games tiles | 3 | Games | `involved[].stake` summed by owner | `tileVM` | S | bar shares add up to 100%; at 3:42 PM TEN@IND is 100% theirs, PIT@TB 100% yours |
| Player sheet: name, team, slot, owner colour, stat line, points vs projection bar, boom rate (`profile`), every play he was in (`card.lines` has his id) | 3 | sheet, from any name or Find | tracker + replay `profile` | views/sheets.js | S–M | Swift lists 2 TDs; impacts add up to 23.0 |
| Alerts + tab badges | 4 | app-wide | cards, `isRedZone` transitions | src/alerts.js (pure rules), app/ui/alerts.js (queue) | S–M | rules below |
| Settings: fantasy on/off (calls `buildTabs`), show game chips, show On the field, alert switches, colorblind shapes, reduce motion, default speed, card text short/full, Sleeper user, Live⇄Replay | 4 | sheet | `store` (try/catch already) | views/settings.js | S | survives reload (npm start); defaults if storage is empty in the preview |
| TV delay 0–60 s, live only, optional | 4 | live sheet | ESPN `wallclock` | src/delay.js; `live.js poll()` feeds the queue | S–M | unit test on replay plays |
| Sunday Story + share picture (adds `[Story ›]`) | 5 | full layer | `history`, feed, view | src/story.js, views/story.js | S–M | below |
| League: Scores / Standings / Activity / Rivals + Sleeper chat link | 6 | League | Sleeper documented (see M6) | tools/save-league.js, make-replay.js, src/league.js, src/sleeper.js `transactions()`, tracker `board()` | M | below |
| Free Picks phase A | 7 | Zone cards + Picks sub-tab | drive results, projections | src/picks.js | M | below |
| Drives / Box / Info | 8 | layer | tracker plays; replay `favorite/spread/overUnder`; live `gameInfo`, `injuries` (parse in `plays.js parseSummary`) | src/gamecenter.js | M | below |
| What-if (adds `[What-if]`) | 9 | Matchup › What-if | scoring + `winChance` | insights `whatIf` | S–M | below |

**Notes on the tricky features**

**Find (M2)**
- `buildIndex({players, games, feed})`. Players are both lineups first, with their owner, then every distinct player named in today's cards. Games are matched by abbreviations and by team names from a small `TEAM_NAMES` map ("colts", "indianapolis").
- `search(index, q, limit = 8)` normalizes text (lowercase, strip accents, apostrophes and periods) and matches word prefixes. Lineup players rank first, then others, then games.
- **Opening results.**
  - A lineup player opens the player sheet. Until M3 that is a player-lite sheet: name, team, owner colour, and his plays through `createFeedList` filtered by impact id.
  - Any other player opens the same sheet filtered by `card.name`.
  - A game opens the game layer.
- **Tests** (on the replay):
  - "swi" returns D'Andre Swift first;
  - "dandre" finds D'Andre Swift;
  - "ind" returns TEN@IND;
  - "colts" returns TEN@IND;
  - "kc" returns LAC@KC and KC D/ST;
  - "" returns nothing.

**When filter (M2)**
- `When: All day ▾` in Zone's sticky head offers the `windows()` labels: 9:30 AM game, 1 PM games, 4 PM games, Night game.
- It filters cards by the kickoff window of the card's game, not by the card's own time, and it combines with My matchup / All / Big. The choice is a per-viewer convenience in localStorage.
- This, Find and the Games tab (each game's Plays sub-tab is the per-game grouping) replace scrolling through the 2,399-card All feed.
- **Test:** "1 PM games" + All shows only cards from the seven 1 PM games, and their count equals the sum of those games' feed cards.

**Pin (M2)**
- **Phone.** `Pin` in the game layer head stores one game id. `#pinbar` (36px, under the app bar) shows "Pinned · CHI 14-0 ATL · Q2 12:08 · Swift ●", updated in place.
  - Tapping it opens the game; × unpins.
  - It is hidden while that game's layer is open and in dashboard mode.
  - It never opens anything by itself.
- **Wide screens.** There is no Pin button. Opening games adds game tabs to the layer head, up to 3 (B1.8).
- **Tests:**
  - pinning CHI@ATL shows the bar on every tab, and its score matches the rail chip on every tick;
  - unpin removes it;
  - the pin survives a reload (npm start).

**Breakdown (M2)**
- In `addPlays`, for each involved starter with an impact, store `card.lines.push({id, before, delta})`, where `before` is the stat line before the play and `delta` is this play's resolved `a.stats`. For DEF, store the `defenseLine` before and after.
- `breakdown(line, pos, scoring)` takes each key of `withBonuses(before + delta)` minus `withBonuses(before)` and multiplies the difference by `scoring[key]`. Keep the nonzero rows and label keys with a small map (`rush_td` → "Rush TD", `bonus_fd_rb` → "First-down bonus", `bonus_rec_rb` → "RB catch bonus", …).
- DEF changes are shown as "points-allowed tier".
- **Test:** for every card with impacts in the replay, the breakdown rows add up to each impact's `delta` within 0.05. This is meaningful because the rows are computed independently of `delta`. Spot check: Swift at 1:27 PM shows Rush TD +6.0 and 4 rush yds +0.4, total +6.4.

**Sweat (M3)**
- closeness c = 1 − |2p − 1|.
- volume v = min(1, (myRemaining + oppRemaining) / 40).
- score = round(100 × c × (0.4 + 0.6 × v)).
- Labels: under 35 Chill, under 70 Sweaty, otherwise Full sweat. Label it "estimate", with a one-line "how it works".
- **Tests:**
  - at 1:40 PM after Taylor's 38-yd catch (43%) the label is Full sweat;
  - at 3:42 PM after Taylor's TD the score is 95, Full sweat;
  - at the end of saved plays (100%) the label is Chill.

**Who you need (M3)**
- `need = max(0, oppNow + oppRemaining − myNow)`, shown as "You need X more · your players left are expected to get Y".
- `breakeven(m, id)` for your player is `remaining_i − (myFinal − oppFinal)`. For an opponent's player the text is "you're favored if he gets under `remaining_j + (myFinal − oppFinal)`".
- Show it only when the value is between 0 and remaining + 2·spread.
- **Tests on hand-built fixtures** (not on the formula restating itself):
  - myNow 50, oppNow 60, oppRemaining 10, myRemaining 25: need = 20.
  - Nobody left, myNow 70, oppNow 60: need = 0.
  - Nobody left, myNow 55, oppNow 60: need = 5.
- **Replay spot check:** at 3:42 PM, need is 99.0 and your remaining is 97.2.

**Biggest swing (M3)**
- Inputs: M = myFinal − oppFinal, S = total spread, s_i = the player's `remainingSpread`, S′ = √max(0, S² − s_i²), sign = +1 for yours and −1 for theirs.
- boom = `winChance(M + sign·s_i, S′)`; bust = `winChance(M − sign·min(s_i, remaining_i), S′)`.
- Rank by |boom − bust|. Show the top 1, with "more" to expand. `winChance` already handles S′ < 0.01 as a step function.
- The UI line is plain: "Biggest swing: Kittle — his whole game is still to come".
- **Tests:**
  - s_i = 0 gives swing 0.
  - With M = 0 and s_i ≤ remaining_i, boom − 0.5 = 0.5 − bust within 0.001.
  - Results are sorted.
  - At the end of saved plays, Kittle ranks above Aubrey.

**Alerts (M4)**
- **Triggers:** a TD by either side's starter; a turnover with an impact; a win-chance move of 5 points or more on one play; a lead change; a red-zone entry for a team with your starter (off by default).
- **Rules:**
  - Never alert for the game currently open in the layer, or for the pinned game while its bar is on screen.
  - Skip marker cards.
  - Lead-change alerts ignore kickoff cards. In this replay the lead "flips" at 4:05 PM and 4:25 PM only because LAR D/ST and KC D/ST start with points-allowed bonuses.
  - One banner at a time, about 6 s, then it becomes a tab badge. Swipe up to dismiss.
  - At 20×, show the biggest alert plus "+N more".
  - A tap opens the game. Alerts never navigate by themselves.
- **Badges:**
  - Zone shows a count of new My-matchup cards that arrived while you were away.
  - Matchup shows a dot for a win move of 5 points or more since your last visit, or for a lead change.
  - Badges clear when you open the tab, or when the column is on screen in the dashboard.
- Injury alerts are live-only. The replay summaries have no injuries, except the DAL@GB raw summary used as a parse fixture.

**Story (M5)**
- 6 cards built from templates (no paid AI):
  1. score and result, or "so far";
  2. low point;
  3. biggest swing;
  4. MVP and bust (current − projected);
  5. top 5 plays by win move;
  6. closest call, then "Monday: …".
- It never auto-advances. Tap the right half for next and the left half for back; swipe down to close. There is no sideways swipe.
- **Share.** Draw a 1080×1350 `<canvas>` with team abbreviations and colours only. Then try, in order:
  1. if `navigator.canShare?.({files})`, call `navigator.share({files})`;
  2. an `<a download>` click;
  3. always shown when framed, or after either attempt fails: a sheet with the PNG as `<img src="data:image/png…">` and "Press and hold to save" (touch) or "Right-click → Save image" (mouse).
- **Share in the published preview is UNVERIFIED.** It runs in a sandboxed iframe, where Web Share needs `allow="web-share"` and downloads need `allow-downloads`. A blocked download can fail silently, so when `framed` is true, always show route 3 alongside the attempt.
- If the artifact runtime's "give the viewer a file to save" capability is enabled for this artifact, it can replace route 2. Load the `artifact-capabilities` skill before writing that code.

**League (M6)**
- **Step 1, one time:** run `tools/save-league.js` on a computer with internet. It fetches league, rosters, users, `matchups/1..6` (with `players` for benches), `transactions/1..6` and `/v1/state/nfl`, and writes `savedAt`. That is about 20 calls.
- **Replay file:** `make-replay.js` adds `league.teams` (name, avatar id, Week 6 starters via the existing `starter()`), the 5 pairings, and the week 1–5 results.
- **Tracker:** `board(leagueId)` is computed only while League is visible, at most once per tick. Your matchup keeps its fast path. Replace `players.find` in `pointsById` with an id→pos Map.
- **Standings and all-play** come **only from weeks 1–5 matchups plus the live Week 6 board**. Never show roster `settings`: they include Week 6 once Sleeper has processed it, which would spoil the replay and count Week 6 twice.
- **Rivals:** this season's head-to-head only (there is no `previous_league_id`).
- **Activity:** hide transactions whose `created` is later than the replay clock.
- **Playoff odds:** deferred until it's verified that future pairings exist. When shown, use a range.
- **Live mode:** every 60 s, compare our board to Sleeper `matchups/<week>` points and show a badge if they differ by more than 1 point.
- **Chat:** Sleeper has no chat endpoint, so the tab only links out to Sleeper (check the deep-link format).
- `buildTabs()` runs when league data first appears, so League joins the tab bar or the column-2 picker without a reload.

**Picks (M7)**
- **Generators:**
  - "How does this drive end? TD / FG / Punt / Turnover", offered when a drive involving either lineup reaches the red zone, and locked at the next snap.
  - "Will Swift score more or less than 15.5 points?", using the starter's projection rounded to 0.5, offered before his kickoff.
  - "Who wins your matchup?"
- Graded from the plays.
- Zone points and streaks are stored per replay run in `store`, per viewer. In the preview they may not persist (see the published-page check).
- Offered only at 5× or slower.
- **No gambling language anywhere in the UI.** A test scans every user-facing string (templates, Picks text, Info text) for `/\b(money|odds|prizes?|bets?|betting|wager|over\/under|spread|parlay|sportsbook|favorite)\b/i`. Internal field names like `spread` and `overUnder` are fine. No purchasable points, no sportsbook names.

**Drives, Box, Info (M8)**
- **Drives:** group consecutive plays by the team on offense. A new drive starts after a kickoff, a score, a change of possession or the start of a half. The result comes from the last play's type. Summary text: "8 plays · 75 yds · 4:12".
- **Box:** built from the tracker's stats up to the replay clock, labelled "live, unofficial". Never use ESPN's final box score in the replay.
- **Info in the replay:** "BAL expected to win by 3 · expected total points 40.5" for BAL@CLE, from `favorite/spread/overUnder`. Weather and stadium are live-only.

**What-if (M9)**
- Buttons on each player who hasn't finished: +TD (the league value), +20 yds, +catch (plus the position bonus), and "0 from here" (sets remaining and spread to 0).
- Pure: it never touches the tracker. Reset clears everything.

## B3. Milestones and definitions of done

**Every milestone must also:**
- pass `npm test`;
- be republished with every new file in the `files` map;
- wrap history calls in try/catch;
- keep light and dark themes working;
- show no sideways page scroll at 320px;
- pass the published-page check below.

**How to measure**
- **Sizes.** Use headless Chrome if the helper has it. Otherwise use Chrome devtools device mode at 390×660 (iPhone visible area), 375×548 (SE), 1000×800 (2 columns) and 1280×800 (3 columns). Run `document.querySelector('#page-zone .play').getBoundingClientRect().top` in the console.
- **Swiping on a computer.** Use devtools device mode (touch emulation makes the mouse act as a finger), or a trackpad two-finger swipe or Shift+wheel in a window narrower than 900px. A plain mouse drag does not move the pager, and that is expected, not a bug.
- **Real phone through npm start.** Run `npm start`, then open `http://<computer-ip>:3000` on the same Wi-Fi. On a notched iPhone, check that `document.scrollingElement.scrollHeight <= innerHeight` and that the gap above the app bar equals the notch exactly once.

**Published-page check** (every milestone, on the claude.ai link, on a real phone and a laptop)
1. The page opens with no console errors on iPhone Safari (and Android Chrome if one is available) and on a laptop browser.
2. From M1: swiping between tabs works inside the preview frame, and the outer claude.ai page neither scrolls nor navigates. How the iframe handles horizontal pans is UNVERIFIED.
3. **Deep link.** Open the artifact URL with `#games` appended. If the hash doesn't reach the page (UNVERIFIED), the app must still open on Zone (or the last tab from localStorage) without errors. Deep links then count as an npm-start-only feature, and that is acceptable.
4. **Back.** Open a game, then press Back (browser button, Android back, iOS edge swipe). Expected: the game closes and you stay in the preview. If Back leaves the preview instead, set `H.ok = !framed` and rely on the in-app ‹, × and Esc.
5. **Storage.** Change a setting (M4) or build a streak (M7), then reload. If storage is empty or throws in the preview, the app must run with defaults. Note it in the step's report; it is not a bug.
6. **Share** (M5): see M5.

**M0: Groundwork and data fixes (S, no visible change)**
- **Markers:** marker plays never set `period` or `clock`, except End of Game, which sets `post`. If the text matches `/END QUARTER (\d)/`, trust the text. Marker cards are `kind:'marker'`, are never `big`, and are skipped by history, swings, alerts and Story.
- **Kickoff windows:** move `kickoffWindows` into `src/replay.js` as `windows(data, {from})`, replacing the `|| true` stub.
- **Code:** add `[hidden]` to index.html, `tracker.version()`, `gameWpBefore/After` on cards, the id→pos Map in `pointsById`, `src/view-models.js` with tests, `tools/moments.js`, and templates moved to `app/views/cards.js`.
- **Done when:**
  - No card between 4:36 and 4:40 PM ET has a win move of 0.02 or more.
  - ARI@LAR's period is 1 after play `401873004888`.
  - `windows()` returns 4 windows labelled 9:30 AM, 1 PM, 4:05 PM and 8:20 PM.
  - The app looks the same.
  - New tests pass in `test/replay.test.js` and `test/view-models.test.js`.

**M1: No more endless page (M, 7 steps, each published)**

Steps:
1. Shell, app bar and clock sheet, plus the first-run banner. In the same step: remove the server.js `:root` padding (line 17), the index.html `body::before` cover (line 36) and `html, body{min-height:100%}` (line 34), and add `box-sizing:border-box`.
2. Pager and tabs (Zone, Matchup, Games) with the hash, `buildTabs()` and `--ntabs`. Dashboard columns on wide screens (`layoutColumns`, `columnsFor`), so computer viewers get columns from this step on.
3. Zone feeds (1-line `.ptext`; `.pmeta` and the owner bar unchanged).
4. Rail (frozen order, ↻).
5. Games grid (frozen order, ↻).
6. Matchup lineup (only the `[Lineup]` sub-chip).
7. Game as a layer with Back; on wide screens it covers the last column.

Done when:
- **(a) First screen.** After Jump to 1 PM, at 390×660 the first card's top is at 240px or less, with at least 3 full cards and at least 2 full rail chips. At 375×548, at least 2 full cards show.
- **(b) Taps.** One tap each: pause, speed, any live game, lineups, filters, Back. Two taps: jump.
- **(c) Swiping** (on a phone or in device mode):
  - A slow drag moves the underline with the finger.
  - A fling moves exactly one tab, in both directions.
  - Tapping a tab two pages away doesn't flash the middle one.
  - Each tab keeps its scroll position.
  - Tapping the active tab scrolls to top.
  - The underline is exactly one tab wide (`ink.offsetWidth` within 1px of a tab's `offsetWidth`).
- **(d) Deep links and Back** (npm start):
  - Reloading `#games` or `#matchup` restores it.
  - `#game/401873007` opens DAL@GB.
  - Browser Back, Esc and the in-app ‹ all close it.
  - With a game open, tapping the scorebug closes it, shows Matchup and leaves `history.state.depth === 0`.
  - With `H.ok = false` set in the console, ‹ still closes the game and the page stays.
- **(e) Busy replay.** 2 minutes at 20× while swiping and tapping: no visible stutter, and rail and tile taps open the tapped game 10 times out of 10.
- **(f) Nothing moves by itself.** 10 minutes at 5× untouched: tab, game, column and scroll never change. Logging rail and tile `data-game` order every 10 s shows only appends. ↻ appears when the order is stale, and re-sorts when tapped. While scrolled down, new plays wait behind the pill.
- **(g) Lineup.** At the end of saved plays, Matchup shows 10 vs 10 with FLEX labels. Daniels, Pineiro and Kittle show "MON 8:15 PM · yet to play". The totals read 123.5 vs 83.5. Only the `[Lineup]` chip is present.
- **(h) Wide screens.**
  - At 1280×800: three columns, Zone | Matchup | Games, all with content, and the document never scrolls. Nothing is open on load. Clicking a game covers only the Games column; × returns to the grid at its old scroll spot.
  - At 1000×800: two columns, and the column-2 picker switches between Matchup and Games.
  - Resizing 1280 → 1000 → 390 → 1280 keeps the open game and each page's scroll position.
- **(i) Tab-set rebuild.** In the console, `ui.fantasyOn = false; buildTabs()`. The tab bar shows Zone | Games, a fling goes only between them, and `#matchup` lands on Zone with the note. Turning it back on restores Matchup at its old scroll position.
- **(j) Cards.** After Jump to 1 PM and running to 1:40 PM, the Taylor 38-yd catch card shows "TEN 0-0 IND · Q2 14:34 · 2nd & 6 at IND 34" and a purple left bar.
- **(k) Safe area.** On a notched iPhone via npm start, the document does not scroll and the top inset is applied once.
- **(l)** The published-page check passes items 1–4.

**M2: Game screen goes sideways, plus Find, When and Pin (S–M)**

Done when:
- Jump to 1 PM and run at 5× to 1:27 PM. Opening CHI@ATL from the rail shows Swift's 4-yd TD on Plays, and Plays starts at 240px or less (today about 730).
- My guys is 1 swipe away and shows Swift with the same points as the Matchup tab.
- The play sheet for that TD shows a breakdown adding up to +6.4 and win 41%→48%, matching the card chip.
- ‹ › visits every live game in the order frozen at open.
- Back returns to the same Zone scroll spot.
- With a game layer and a play sheet open, tapping the scorebug closes both in one step and shows Matchup, with `history.state.depth === 0`.
- The Find tests pass. Picking "Swift" from Find and pressing Back once returns to where you were.
- The When test passes.
- The Pin tests pass. On wide screens, opening 4 games keeps 3 game tabs.

**M3: Your matchup explained (S)**

Done when:
- The `[Swings]` chip appears.
- After running from 1 PM to the end at 20×, the Swings chart's biggest marker is Walker's 33-yd TD (LAC@KC, 4:41 PM, 61%→74%). Tapping it opens that play.
- The sweat tests pass (1:40 PM Full sweat, 3:42 PM score 95, end Chill), and the need, breakeven and swings unit tests pass.
- The On-the-field chip for Swift shows during CHI possessions only.
- Swift's player sheet lists both TDs (1:27 and 2:20 PM), and his impacts add up to 23.0.
- On the Games tiles at 3:42 PM, TEN@IND's bar is all purple and PIT@TB's all yellow.

**M4: Heads-up without taking over (S–M)**

Done when:
- From 1 PM at 5×, with another tab open:
  - a yellow banner at 1:27 PM reads "Swift 4-yd rush TD · Win 41%→48%", and Matchup gets a dot;
  - a purple banner at 1:40 PM reads "Taylor 38-yd catch · Win 49%→43%".
- No banner for Swift's TD while CHI@ATL is open.
- No lead-change banner at 4:05 or 4:25 PM (those are kickoff D/ST bonuses).
- At most one banner is on screen at a time, and no tab ever switches.
- Badges clear when you open the tab.
- Settings survive a reload on npm start. In the published preview, the app runs with defaults if storage is unavailable.
- **Fantasy off:**
  - hides Matchup, League and the score;
  - rebuilds the tab bar to Zone | Games with a one-tab-wide underline;
  - makes `#matchup` land on Zone with the "Turn on" note;
  - makes the rail rank by drama;
  - turns the Zone chips into All / Big / Close games.

  Turning fantasy on restores Matchup at its old scroll position, and the dashboard returns to 3 columns.
- If TV delay is built: a unit test shows that a 30 s delay releases cards and scoreboard fields together.

**M5: Sunday Story and share (S–M)**

Done when, at the end of saved plays:
- `[Story ›]` appears in Matchup.
- "Story so far" has 6 cards.
- The low point is 37% at 1:03 PM (Derrick Henry 11-yd rush, BAL@CLE).
- The biggest swing is Walker's 33-yd TD.
- It ends with "Monday: Daniels + Pineiro vs Kittle".
- On npm start, Share produces a PNG through Web Share or a download.
- In the published preview on a real phone, the user ends up with the picture saved by at least one route; the `<img>` press-and-hold sheet always appears when framed. Which routes work in the preview is UNVERIFIED until this check.
- A unit test confirms "biggest swing" is the non-marker card with the largest win move.

**M6: League tab (M, plus the one-time save at home)**

Done when:
- All 5 matchups update play by play.
- League appears in the tab bar (or the column-2 picker) as soon as league data loads.
- `tools/check-board.js` passes: for every team, starters in games that are final in the replay are within 0.5 of Sleeper's saved `starters_points`. Today's data gives 90.8 = 90.8 and 82.5 = 82.5. In-progress DAL@GB and WAS@SF players are excluded.
- **Standings** come only from weeks 1–5 plus the live board. A cross-check test (never shown in the UI) reads `g = wins + losses + ties` from each roster's saved `settings`:
  - if every team has g = 5, Sleeper hadn't processed Week 6 when `save-league.js` ran (for example a save on Monday before WAS@SF), so compare with weeks 1–5 only;
  - if every team has g = 6, compare with weeks 1–5 plus the Week 6 result from saved `matchups_6` points;
  - anything else fails with a message naming the team and `savedAt`.

  When Sleeper processes a week is UNVERIFIED.
- Activity shows the real moves, none later than the replay clock.

**M7: Free Picks (M)**

Done when:
- From 1 PM at 5×, every red-zone drive involving either lineup gets a pick card, graded correctly (unit tests on the replay).
- The streak survives a reload on npm start. In the preview, the published-page check records whether it persists.
- Picks are not offered above 5×.
- The gambling-language scan finds nothing.

**M8: Game Center extras (M)**

Done when:
- Running `drives()` on the plays in `fixtures/week6/raw-summary-401873007.json` (flattened from `drives.previous[*].plays`, ignoring their boundaries) reproduces ESPN's 11 drives and results (PUNT, TD, PUNT, INT, INT, FG, INT, TD, END OF HALF, PUNT, TD).
- Box yards for your players match their stat lines, with nothing from after the replay clock.
- `parseSummary` reads `injuries` and `gameInfo.venue` from the same fixture.
- BAL@CLE Info reads "BAL expected to win by 3 · expected total points 40.5".

**M9: What-if (S–M)**

Done when:
- The `[What-if]` chip appears.
- At 1:40 PM, "+TD" on Kittle lowers your win chance by exactly what `winChance` gives in a unit test.
- Reset restores the original value exactly.

## B4. Replay test moments (from the current tracker, 2026-10-19; regenerate with `tools/moments.js` if the model changes)

| ET | Game | Play | Points | Your win |
|---|---|---|---|---|
| 1:03 PM | BAL@CLE | Derrick Henry 11-yd rush | — | low point 37% |
| 1:27 PM | CHI@ATL | Swift 4-yd rush TD (3rd & Goal at ATL 4) | +6.4 you | 41%→48% |
| 1:40 PM | TEN@IND | Jonathan Taylor 38-yd catch (2nd & 6 at IND 34) | +4.8 opp | 49%→43% |
| 2:20 PM | CHI@ATL | Swift 2-yd rush TD | +6.2 you | 51%→59% |
| 3:03 PM | BAL@CLE | Zay Flowers 31-yd catch | +4.1 you | 67%→71% |
| 3:42 PM | TEN@IND | Taylor 4-yd rush TD (2nd & Goal at TEN 4) | +6.4 opp | 56%→48% |
| 4:05 / 4:25 PM | ARI@LAR / LAC@KC | Kickoffs (D/ST starting bonuses) | lead flips | not alerts |
| 4:09 PM | ARI@LAR | Brissett interception | +2.0 opp LAR D/ST | 50%→48% |
| 4:37 PM | ARI@LAR | Mis-tagged "END QUARTER 1" | — | fake 59%→74% (M0 removes it) |
| 4:41 PM | LAC@KC | Kenneth Walker 33-yd rush TD | +9.3 you | 61%→74% (biggest real swing) |
| 5:36 PM | LAC@KC | Walker 2-yd rush TD | +6.2 you | 80%→87% |
| 10:54 PM | — | End of saved plays | 123.5–83.5 | 100% |

**Sketch moments (Part A)**

| Moment | Score | Win | Other values |
|---|---|---|---|
| 1:40 PM, after Taylor's 38-yd catch | 24.4–16.9 | 43% | Top My-matchup cards: Taylor 38-yd catch, Swift loss of 1 (−0.1), Taylor 4-yd rush (+0.4). On field: Swift, Flowers, Taylor, Wilson, Downs |
| 3:42 PM, after Taylor's 4-yd TD | 48.6–44.6 | 47.6% (shown 48%) | Sweat 95; need 99.0; your 9 left expected 97.2; games 7 live / 5 next / 2 final; top tiles TEN@IND 20-20 Q4 5:32 and PIT@TB 13-16 Q4 8:08 |

## B5. Risks and mitigations

1. **Gesture conflicts.** Handled by the rules in B1.6. If testers mis-swipe between the rail and the pager, move the rail into the game layer head and put a 3-across Hot grid in Zone. That is a view and CSS change only.
2. **Browser support.**
   - The research says `scrollend` arrived in Safari 26.2 and scroll anchoring in Safari 27 (UNVERIFIED here). Keep the 150 ms fallback and the new-plays buffer regardless.
   - `content-visibility` needs Safari 18+ (per research). Without it, rendering is only slower.
   - Popover needs Safari 17+.
   - Container queries need Safari 16+. Without them, tiles stay 2 across.
3. **Per-page scrolling costs:** no toolbar collapse and no status-bar tap to top (B1.7). Accepted.
4. **Lost or wrong taps:** handled by in-place keyed updates, the version skip, frozen order while visible, and `pointer-events:none` on children.
5. **Speed on a full Sunday (2,399 cards):** trim the DOM, use `content-visibility`, remount for batches over 40, skip unchanged ticks, write nothing mid-swipe, and compute the League board only when it is visible. The dashboard updates at most 3 pages per flush.
6. **Replay data gaps.**
   - WAS@SF has 0 plays, which is a useful "yet to play" test.
   - Only 2 of 10 lineups are saved, there are no benches, and rosters have no settings. M6 needs the one-time save.
   - No injuries or game info, except the DAL@GB raw summary used as a fixture.
7. **Spoilers.** Box, drives and standings are built from plays up to the replay clock, or from weeks 1–5 only. Recap shows "so far" until the end.
8. **Data feeds can change.** ESPN is unofficial and Sleeper's projections and stats are undocumented, so the replay always works as a fallback. Respect Sleeper's non-commercial terms: no ads and no charging without a licence.
9. **Mobile Safari bars.** The tabs sit at the top on the web, nothing is fixed, the html background is set, and safe-area padding is applied once. Test both iOS 26 toolbar layouts.
10. **"Too busy".**
    - 3–4 tabs and at most 4 chips per row.
    - At most 10 rail chips, and the rail can be hidden.
    - One accent per card, with red only for big plays.
    - Alerts limited to plays that matter, by default.
    - 680px reading width in single-column mode.
11. **Kid-safe and legal.** No money, prizes or purchasable points; no gambling words (scan in M7); no sportsbook names or links; no logos or headshots; no embedded video; no chat or accounts without a parent (COPPA).
12. **Code size for a kid and an AI helper.** One file per screen or topic, pure logic with tests, few files per step, and `npm test` green every step.
13. **Publishing.** New files go in the `files` map, and `[hidden]` lives in index.html. Add types to `server.js` TYPES before serving anything other than .js, .json or .html.
14. **Replay file size** grows in M6 (estimated under 1.6MB, UNVERIFIED). Measure it after `npm run replay`.
15. **The preview iframe** may drop the hash, route Back outside the app, block storage, Web Share or downloads, or capture swipes (all UNVERIFIED). The published-page check catches each case, and every one has a fallback: Zone or the last tab, `H.ok = false`, defaults, the `<img>` save sheet, and tab taps.

## B6. Deferred, and why

- **Multi-league UI** (score-bar cells, an "All" view, hedge stripes, exposure board): the user has one league. `sync.js` already supports more, and the league weight setting can come later.
- **Score-band swipe in the game layer:** it would sit right above the sub-pager. Revisit after device testing.
- **4 games on screen at once (Quad view), beyond the 3 game tabs:** depends on Question 1. Medium work.
- **Replay any week, waiver radar, start/sit:** medium work. Sleeper's API is read-only (link out to claim or swap), and the players DB is 5MB and needs slimming.
- **nflverse usage and luck stats:** needs a prep script and the "Data: nflverse" credit, and the data is a day behind.
- **HTTPS for Home Screen install:**
  - A Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:3000`) reportedly needs no account but gives a new random URL each run (UNVERIFIED).
  - A stable named tunnel needs an account.
  - Either way it means installing software, so a parent should set it up.
- **Delta server endpoint** (gzip, send only new plays): needed for phones on cellular and for Expo. It must run on the home server.
- **Push notifications.**
  - Web push on iPhone needs HTTPS, a service worker, Home Screen install (iOS 16.4+) and an always-on server to send pushes. It does not appear to need the paid Apple account (UNVERIFIED).
  - Expo/APNs push and Live Activities do need the $99/yr Apple account.
  - Android Expo push needs a development build plus FCM.
- **Shared picks leaderboard and live reactions:** need a backend (Supabase or Firebase free tiers), parent-owned accounts, moderation and COPPA compliance.
- **Never:** in-app league chat (no Sleeper chat API; link out instead), buyable currency or card packs, sportsbook names or links, embedded video, ESPN private-league cookies, Yahoo (needs a signed agreement).

## B7. Expo mapping (later, after M4 settles the layout)

| Web | Expo |
|---|---|
| Top tabs + pager | `@react-navigation/material-top-tabs` (react-native-pager-view); with Expo Router, `withLayoutContext` |
| `onSettle` | `onPageSelected` |
| `state.swiping` | `onPageScrollStateChanged` |
| `go(i)` | `setPage(i)` |
| `buildTabs()` | re-render the navigator from the filtered `TABS` |
| Rail | horizontal FlatList |
| Pin bar | a small persistent bar above the navigator |
| Each page | FlashList, with `stickyHeaderIndices` for the page head |
| Dashboard columns | tablet layout: side-by-side screens at 900dp and up |
| Game layer | stack screen `app/game/[id].tsx` |
| Player layer | `app/player/[id].tsx` |
| Find | a search screen or modal |
| Sheets | formSheet or a bottom-sheet component |
| Deep links | `#game/ID` becomes `/game/ID` |
| Store | `useSyncExternalStore(subscribe, tracker.version)`, with screens subscribing only while focused |

- If Question 2 is answered "bottom", use NativeTabs, and the swipeable tabs move inside Zone. `TABS` is config-driven, so this is a small change.
- `src/*.js` and `view-models.js` run unchanged. Native apps have no CORS, so the server.js proxy isn't needed.
- Free path: Expo Go on the user's own phone. The store fees ($99/yr Apple, $25 Google) can wait.

## B8. Traps (each was a real mistake caught in review)

- **Numbers.** The end of saved plays is 123.5–83.5 (tracker). Sleeper's saved points are 120.4–83.5, and starters in finished games are 90.8 / 82.5 on both sides. Every number in a test comes from `tools/moments.js`, never from memory.
- **Standings** never come from roster `settings`. Those are only used in the M6 cross-check, which first works out which weeks they cover.
- **Marker cards** are never big, and never appear in history, swings, alerts or Story.
- **Matchup** never stacks hero, chart, need and lineup down one column. It uses segmented chips, each shipping with its milestone (R7).
- **Speed** is 1 tap.
- **Lead-change alerts** ignore kickoff D/ST bonuses.
- **Nothing re-sorts while visible**, whether the rail or the Games grid. Use the ↻ chip or tab activation.
- **History.** `history.go(-n)` fires one popstate, so the handler closes everything above the new depth. `history.go(0)` reloads the page. `ui.depth` counts only pushes that succeeded. The in-app back calls `history.back()` only when our own entry is on top.
- **Safe areas** are padded exactly once (`.shell`), with `box-sizing:border-box`. server.js `:root` padding and `body::before` are gone.
- **CSS variables.** `--ntabs` is set by `createPager`. The alert is placed with grid lines, not an undefined `--chrome-h`.
- **The phone game layer** is a region, not a modal, because the app bar and rail stay usable.
- **The tab set can change.** All index math uses `ui.tabIds`, and hidden-tab deep links land on Zone with a note.
- **Swiping on a computer** needs touch emulation or a trackpad. A mouse drag never moves the pager.
- **Kid-facing text** never uses betting terms ("more or less than", "expected to win by", "expected total points").
- **Web push and Cloudflare tunnel** requirements are marked UNVERIFIED.

Files:
- /home/user/fantasy-zone/app/index.html
- /home/user/fantasy-zone/app/app.js
- /home/user/fantasy-zone/src/tracker.js
- /home/user/fantasy-zone/src/replay.js
- /home/user/fantasy-zone/src/model.js
- /home/user/fantasy-zone/src/plays.js
- /home/user/fantasy-zone/src/live.js
- /home/user/fantasy-zone/src/sync.js
- /home/user/fantasy-zone/src/sleeper.js
- /home/user/fantasy-zone/tools/make-replay.js
- /home/user/fantasy-zone/server.js
- /home/user/fantasy-zone/fixtures/week6/raw-summary-401873007.json
- /home/user/fantasy-zone/fixtures/week6/sleeper-points.json

Scripts used to check the numbers:
- /tmp/claude-0/-home-user/2e2976d0-1b83-5624-bca5-adc359de7029/scratchpad/moments.mjs
- /tmp/claude-0/-home-user/2e2976d0-1b83-5624-bca5-adc359de7029/scratchpad/m2.mjs
- /tmp/claude-0/-home-user/2e2976d0-1b83-5624-bca5-adc359de7029/scratchpad/m3.mjs
- /tmp/claude-0/-home-user/2e2976d0-1b83-5624-bca5-adc359de7029/scratchpad/snap2.mjs
- /tmp/claude-0/-home-user/2e2976d0-1b83-5624-bca5-adc359de7029/scratchpad/snap3.mjs
- /tmp/claude-0/-home-user/2e2976d0-1b83-5624-bca5-adc359de7029/scratchpad/feed140.mjs
- /tmp/claude-0/-home-user/2e2976d0-1b83-5624-bca5-adc359de7029/scratchpad/feed342.mjs