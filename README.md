# Fairway Notebook

A personal golf app for tracking the three things that make a better golfer:

- **Rounds**: hole-by-hole scorecard with putts and fairways. Greens in regulation are worked out automatically.
- **Practice**: range and short-game sessions by area, with minutes, balls hit, the drill, and how it went.
- **Workouts**: golf fitness sessions with exercises, sets, reps, and load.
- **Dashboard**: scoring average, putts per round, GIR %, fairways %, a scoring trend chart, and practice minutes by area.

## How it works

It's a plain web page: `index.html` (structure), `styles.css` (look), and `app.js` (behavior). No build step, no frameworks. It's hosted on GitHub Pages.

Your data lives in your own **Supabase** database (a hosted Postgres database with built-in sign-in). You sign in with your email and password, and the same data shows up on any device.

- `config.js` holds the database address and its public key.
- `supabase/setup.sql` creates the tables: `rounds`, `practice_sessions`, `workouts`. Row level security means each row can only be read or changed by the account that owns it, so the public key on its own can't reach anything.

**Copy backup** on the dashboard still gives you a full copy as text. **Restore from backup** adds back anything that's missing.

## Setting up your database (one time)

1. **Create a Supabase project.** Sign up at supabase.com (signing in with GitHub is easiest). Click **New project**, name it `fairway-notebook`, and pick a region near you. Save the database password it asks for somewhere safe. You won't need it day to day.
2. **Create the tables.** In the project, open **SQL Editor**, then **New query**. Paste in all of `supabase/setup.sql` and click **Run**. You should see "Success. No rows returned".
3. **Create your login.** Open **Authentication**, then **Users**, then **Add user** and **Create new user**. Enter your email and a password, and tick **Auto Confirm User**.
4. **Close the door behind you.** In the Authentication settings (**Sign In / Providers**), turn off **Allow new users to sign up**. Now nobody else can create an account.
5. **Set the site address** so password-reset emails link back to the app. In **Authentication**, then **URL Configuration**, set **Site URL** to `https://awesome-bill.github.io/NutzSwings/`.
6. **Connect the app.** Click **Connect** at the top of the project and copy the **Project URL** and the **publishable** (or "anon public") key into `config.js`. Never use the secret / service_role key.
7. Open the app, sign in, and use **Move them to my account** on the dashboard to bring over anything saved in that browser from before.

Free Supabase projects pause after about a week without any use. If the app says it can't load your data, open the Supabase dashboard and click **Restore project**.

## Run it

Use the live version at https://awesome-bill.github.io/NutzSwings/. To try changes on your computer, run a local web server in the folder (for example `python -m http.server`) and open http://localhost:8000. It signs in to the same database.

## Releasing a change

`index.html` loads `styles.css`, `config.js` and `app.js` with a version on the end (for example `app.js?v=2.0.1`). When any of those files change, bump that number in all three places. Browsers then download the new files instead of reusing old copies, which can otherwise mix old and new code and leave a blank page.

## Changelog

- **v1**: Dashboard, rounds, practice, and workouts, with example data and backup/restore.
- **v1.1**: Total-only rounds (date, course, tees, score, optional par and differential) and **Import scores** on the Rounds page for pasting in history such as GHIN. Scoring average and trend use every round; putts, greens and fairways use hole-by-hole rounds only.
- **v1.2**: Import reads the GHIN export directly (choose the file or paste it) and keeps score type, course rating, slope, PCC, differential and Used in Handicap. Re-importing updates existing rounds.
- **v2.0**: Data moves to a Supabase database with email/password sign-in, so it's the same on every device. One-tap move of data saved in the browser by earlier versions. Example data removed.
- **v2.0.1**: Versioned file links so browsers always load matching files after an update.
- **v2.1**: Practice and workout routines with a starter weekly plan, scored drills with last/best/target, last-used weights in workouts, routine editor, and a This week plan on the dashboard.

## Routines

Practice and Workouts each have **Routines**: saved sessions you run again and again. Tap **Load starter routines** to get a weekly plan (3 practice sessions + 3 workouts), or **Build my own**.

- **Practice routines** are a list of drills, each with an area, minutes, instructions, and a score: *made out of N* (higher is better) or *strokes* (lower is better). Tap **Start**, tick the drills you did, enter your scores, and save. Each drill then shows your last result, your best, and the target.
- **Workout routines** fill in the workout form with the exercises, sets and reps, and the weight you used last time for each exercise.
- **This week** on the dashboard shows workouts and practice done against your plan (Monday to Sunday), with a tick next to each routine you've completed.
- Edit any routine to rename it, change drills or exercises, reorder them, or delete it. Deleting a routine keeps your past sessions.

The starter plan lives in `starter-routines.js`:

| Day | Session |
|-----|---------|
| Mon | Workout A: Strength (lower + pull) |
| Tue | Practice: Short game + putting |
| Wed | Workout B: Speed & power |
| Thu | Practice: Driver + putting |
| Fri | Workout C: Strength (upper + rotation) |
| Sat | Practice: Scoring games (or play) |

**Updating from v2.0:** run the whole of `supabase/setup.sql` again in the Supabase SQL Editor. It only adds the new `routines` table and columns, and leaves your data alone.

## Importing from GHIN

On **Rounds**, tap **Import from GHIN**, then choose your GHIN score history export (.csv) or paste its contents, header row included.

The app reads GHIN's columns by name: Date, Score, Holes, Score Type, Course, Tees, Course Rating, Slope, PCC, Differential, Used in Handicap. Each round shows its score type, rating/slope, PCC, differential, and an **In index** tag when GHIN is using it for your handicap index.

Re-importing is safe. New rounds are added, and rounds already in the app (same date, course, holes and score) get GHIN's latest details. "Used in Handicap" changes as you post new scores, so re-import after each export.
