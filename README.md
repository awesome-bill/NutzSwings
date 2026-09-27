# Fairway Notebook

A personal golf app for tracking the three things that make a better golfer:

- **Rounds**: hole-by-hole scorecard with putts and fairways. Greens in regulation are worked out automatically.
- **Practice**: range and short-game sessions by area, with minutes, balls hit, the drill, and how it went.
- **Workouts**: golf fitness sessions with exercises, sets, reps, and load.
- **Dashboard**: scoring average, putts per round, GIR %, fairways %, a scoring trend chart, and practice minutes by area.

## How it works

It's a plain web page: `index.html` (structure), `styles.css` (look), and `app.js` (behavior). No build step, no frameworks.

Data is saved in your browser's local storage on the device you use. Use **Copy backup** on the dashboard to keep a copy, and **Restore from backup** to move your data to another device.

## Run it

Open `index.html` in a browser, or view the live version on GitHub Pages once it's turned on.

## Changelog

- **v1**: Dashboard, rounds, practice, and workouts, with example data and backup/restore.
- **v1.1**: Total-only rounds (date, course, tees, score, optional par and differential) and **Import scores** on the Rounds page for pasting in history such as GHIN. Scoring average and trend use every round; putts, greens and fairways use hole-by-hole rounds only.
- **v1.2**: Import reads the GHIN export directly (choose the file or paste it) and keeps score type, course rating, slope, PCC, differential and Used in Handicap. Re-importing updates existing rounds.

## Importing from GHIN

On **Rounds**, tap **Import from GHIN**, then choose your GHIN score history export (.csv) or paste its contents, header row included.

The app reads GHIN's columns by name: Date, Score, Holes, Score Type, Course, Tees, Course Rating, Slope, PCC, Differential, Used in Handicap. Each round shows its score type, rating/slope, PCC, differential, and an **In index** tag when GHIN is using it for your handicap index.

Re-importing is safe. New rounds are added, and rounds already in the app (same date, course, holes and score) get GHIN's latest details. "Used in Handicap" changes as you post new scores, so re-import after each export.
