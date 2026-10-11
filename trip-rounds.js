/* Fairway Notebook: upcoming trip rounds.
   Booked rounds that show on the Calendar page as hollow green dots ("planned round").
   Tap a day to see the course and tee time. Once you log a round on that date at that course,
   the planned entry drops off and your real round takes its place.

   To add or change a trip, edit this list:
     date   'YYYY-MM-DD'
     tee    tee time as text
     course name shown in the app
     match  words that appear in the course name when you log or import the round (lowercase),
            used to tell which booked round you played
     par / yards / rating / slope   optional course details
   Confirmation numbers and prices are left out on purpose: this repo is public. */
window.TRIP_ROUNDS = [
  // Wed Oct 14: Pawleys Island (the Strantz double)
  { date: '2026-10-14', tee: '7:48 AM', course: 'Caledonia Golf & Fish Club', match: ['caledonia'], par: 70, yards: 6526, rating: 71.8, slope: 138, trip: 'Myrtle Beach' },
  { date: '2026-10-14', tee: '2:00 PM', course: 'True Blue Golf Club', match: ['true blue'], par: 72, yards: 7126, rating: 73.8, slope: 139, trip: 'Myrtle Beach' },
  // Thu Oct 15: Murrells Inlet, then Pawleys Island
  { date: '2026-10-15', tee: '8:00 AM', course: 'TPC Myrtle Beach', match: ['tpc'], par: 72, yards: 6950, rating: 74.0, slope: 145, trip: 'Myrtle Beach' },
  { date: '2026-10-15', tee: '2:02 PM', course: 'Pawleys Plantation Golf & Country Club', match: ['pawleys'], par: 72, yards: 7026, rating: 75.2, slope: 150, trip: 'Myrtle Beach' },
  // Fri Oct 16: central Myrtle Beach
  { date: '2026-10-16', tee: '7:54 AM', course: 'Grande Dunes Resort Club', match: ['grande dunes'], par: 72, yards: 7618, rating: 77.3, slope: 142, trip: 'Myrtle Beach' },
  { date: '2026-10-16', tee: '1:45 PM', course: "King's North at Myrtle Beach National", match: ["king's north", 'kings north', 'myrtle beach national'], par: 72, yards: 6903, rating: 74.4, slope: 154, trip: 'Myrtle Beach' },
  // Sat Oct 17: Myrtle Beach, then North Myrtle Beach
  { date: '2026-10-17', tee: '7:54 AM', course: 'Myrtlewood Golf Club (PineHills)', match: ['myrtlewood'], par: 72, yards: 6640, rating: 72.2, slope: 132, trip: 'Myrtle Beach' },
  { date: '2026-10-17', tee: '12:53 PM', course: 'The Dye Club at Barefoot Resort', match: ['barefoot', 'dye club'], par: 72, yards: 7343, rating: 75.3, slope: 149, trip: 'Myrtle Beach', note: 'Barefoot expects a 4h30 pace. Check in 30 min before tee time.' },
];
