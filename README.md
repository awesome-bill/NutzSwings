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

## Importing scores

On **Rounds**, tap **Import scores** and paste one round per line:

```
date, course, tees, holes, score, par, differential
2026-09-20, Pine Hollow GC, White, 18, 88, 72, 14.2
9/13/2026, Riverbend Municipal, Blue, 9, 44, 36,
```

Dates can be `YYYY-MM-DD` or `M/D/YYYY`. Tees, par and differential can be blank. Rounds already in the app (same date, course and score) are skipped, so pasting the same list twice is safe.
