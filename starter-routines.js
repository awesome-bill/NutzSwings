/* Fairway Notebook: starter routines.
   Loaded into your account the first time you tap "Load starter routines". After that they live in
   your database, and you change them in the app (Edit on any routine). Editing this file only
   changes what a fresh account starts with.

   Weekly rhythm: 3 practice sessions + 3 workouts.
     Mon  Workout A: Strength (lower body + pull)
     Tue  Practice 1: Short game + putting
     Wed  Workout B: Speed & power
     Thu  Practice 2: Driver + putting
     Fri  Workout C: Strength (upper body + rotation)
     Sat  Practice 3: Scoring games (or play a round)

   Practice drills have a score so you can see them improve:
     score 'made'    → result is how many out of `outOf` (higher is better), `target` is the goal
     score 'strokes' → result is strokes taken (lower is better), `target` is the goal
     score 'none'    → just tick it off
   Cable exercises only use the overhead (high) pulley. */
window.STARTER_ROUTINES = [
  // ---------------- Practice ----------------
  {
    kind: 'practice', sort: 1, day: 'Tue', name: 'Short game + putting',
    notes: 'Most strokes saved live inside 100 yards. Full pre-shot routine on every scored ball.',
    items: [
      { name: 'Landing-spot warm-up', area: 'Chipping', minutes: 10, score: 'none',
        how: 'One club (PW or 9-iron). Land balls on a towel at 3 distances before letting them run out.' },
      { name: 'Up-and-down circle', area: 'Chipping', minutes: 20, score: 'made', outOf: 10, target: 6,
        how: '10 balls around the green, all different lies. Chip, then putt out. Count up-and-downs.' },
      { name: 'Wedge ladder 30 / 50 / 70 yd', area: 'Wedges', minutes: 15, score: 'made', outOf: 9, target: 5,
        how: '3 balls to each distance. Count balls finishing inside 10 feet.' },
      { name: 'Bunker: out and close', area: 'Bunker', minutes: 10, score: 'made', outOf: 10, target: 6,
        how: 'Draw a line in the sand and enter just behind it. Count shots that finish on the green inside 10 feet.' },
      { name: '3-6-9 ft ladder', area: 'Putting', minutes: 20, score: 'made', outOf: 15, target: 11,
        how: '5 balls each from 3, 6 and 9 feet on a slight break. Count makes.' },
    ],
  },
  {
    kind: 'practice', sort: 2, day: 'Thu', name: 'Driver + putting',
    notes: 'Goal is more fairways at the same speed. Pick a real target on every swing.',
    items: [
      { name: 'Warm-up: wedge to 7-iron', area: 'Irons', minutes: 15, score: 'none',
        how: 'Half swings building to full. 3–4 balls per club.' },
      { name: 'Start-line gate', area: 'Driver & woods', minutes: 10, score: 'made', outOf: 10, target: 7,
        how: 'Two alignment sticks about 10 feet ahead, a little wider than the ball. Count drives that start through the gate.' },
      { name: 'Fairway finder', area: 'Driver & woods', minutes: 20, score: 'made', outOf: 14, target: 9,
        how: 'Pick two targets about 30 yards apart as a fairway. 14 drives, full routine each. Count fairways.' },
      { name: 'Call your shape', area: 'Driver & woods', minutes: 10, score: 'made', outOf: 10, target: 6,
        how: 'Call fade or draw before each swing, 5 of each. Count the ones that curve the way you called.' },
      { name: 'Lag ladder 20 / 30 / 40 ft', area: 'Putting', minutes: 15, score: 'made', outOf: 9, target: 7,
        how: '3 balls from each distance. Count putts finishing within 3 feet.' },
      { name: '4-foot finisher', area: 'Putting', minutes: 10, score: 'made', outOf: 10, target: 9,
        how: '10 putts from 4 feet around the hole. Count makes.' },
    ],
  },
  {
    kind: 'practice', sort: 3, day: 'Sat', name: 'Scoring games',
    notes: 'Pressure practice. One ball, no do-overs. Play a round instead if you can.',
    items: [
      { name: 'Warm-up: chips and putts', area: 'Chipping', minutes: 10, score: 'none',
        how: 'Easy chips and a few lag putts to get feel.' },
      { name: 'Par-18 short game course', area: 'Chipping', minutes: 25, score: 'strokes', outOf: null, target: 20,
        how: '9 spots around the green (chips, pitches, one bunker). Hole out from each. Par is 2 per spot, 18 total.' },
      { name: 'Clock drill 3 ft', area: 'Putting', minutes: 10, score: 'made', outOf: 12, target: 12,
        how: '12 balls around the hole at 3 feet like a clock face. Count makes; goal is all 12.' },
      { name: 'Pressure 7 (driver)', area: 'Driver & woods', minutes: 10, score: 'made', outOf: 7, target: 5,
        how: '7 drives at a 30-yard fairway, each to a different target line. Count fairways.' },
      { name: 'Random wedges 40–100 yd', area: 'Wedges', minutes: 10, score: 'made', outOf: 10, target: 5,
        how: 'Change the distance every ball. Count balls finishing inside 15 feet.' },
      { name: 'Lag and finish', area: 'Putting', minutes: 10, score: 'made', outOf: 10, target: 9,
        how: '10 putts from 25–35 feet, holing out each. Count two-putts or better.' },
    ],
  },

  // ---------------- Workouts ----------------
  {
    kind: 'workout', sort: 1, day: 'Mon', name: 'A: Strength (lower + pull)', focus: 'Strength',
    notes: 'Leave 1–2 reps in the tank on every set. Add a little weight when all sets feel solid.',
    items: [
      { name: '90/90 hip switch', sets: 2, reps: '8', load: 'Warm-up' },
      { name: 'Open books', sets: 2, reps: '8/side', load: 'Warm-up' },
      { name: 'Trap bar deadlift', sets: 4, reps: '5', load: '' },
      { name: 'Rear-foot elevated split squat', sets: 3, reps: '8/side', load: '' },
      { name: 'Lat pulldown (high cable)', sets: 3, reps: '10', load: '' },
      { name: 'Single-arm row', sets: 3, reps: '10/side', load: '' },
      { name: 'Half-kneeling high-to-low cable chop', sets: 3, reps: '10/side', load: '' },
      { name: 'Farmer carry', sets: 3, reps: '40 yd', load: '' },
    ],
  },
  {
    kind: 'workout', sort: 2, day: 'Wed', name: 'B: Speed & power', focus: 'Speed',
    notes: 'Every rep at full intent, full rest between sets (60–90 s). Stop when speed drops.',
    items: [
      { name: "World's greatest stretch", sets: 2, reps: '5/side', load: 'Warm-up' },
      { name: 'Thoracic rotation', sets: 2, reps: '8/side', load: 'Warm-up' },
      { name: 'Med ball rotational throw', sets: 4, reps: '5/side', load: '' },
      { name: 'Med ball slam', sets: 3, reps: '6', load: '' },
      { name: 'Countermovement jump', sets: 3, reps: '5', load: 'Bodyweight' },
      { name: 'Lateral bound', sets: 3, reps: '5/side', load: 'Bodyweight' },
      { name: 'Overspeed swings', sets: 3, reps: '5 each side', load: 'Light / normal' },
      { name: 'Dead bug', sets: 2, reps: '8/side', load: '' },
    ],
  },
  {
    kind: 'workout', sort: 3, day: 'Fri', name: 'C: Strength (upper + rotation)', focus: 'Strength',
    notes: 'Control the lowering on every rep. Rotation work is smooth, not max effort.',
    items: [
      { name: 'Thread the needle', sets: 2, reps: '6/side', load: 'Warm-up' },
      { name: 'Deep squat hold', sets: 2, reps: '30 s', load: 'Warm-up' },
      { name: 'Goblet squat', sets: 3, reps: '8', load: '' },
      { name: 'Dumbbell bench press', sets: 3, reps: '8', load: '' },
      { name: 'Romanian deadlift', sets: 3, reps: '8', load: '' },
      { name: 'Face pull (high cable)', sets: 3, reps: '12', load: '' },
      { name: 'Landmine rotation', sets: 3, reps: '8/side', load: '' },
      { name: 'Side plank', sets: 3, reps: '30 s/side', load: '' },
    ],
  },
];
