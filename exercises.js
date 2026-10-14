// ============================================================
// EXERCISE LIBRARY — equipment-free home workouts
// Each exercise: muscle group(s) + type, for dual browsing
// ============================================================

const EXERCISE_LIBRARY = [
  // ---------- CHEST ----------
  {
    id: 'pushup-standard',
    name: 'Push-up',
    muscle: 'chest',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '10 reps',
    guidelines: [
      'Hands shoulder-width apart, body in a straight line from head to heels.',
      'Lower until chest nearly touches the floor, elbows at roughly 45° from your body.',
      'Push back up without locking elbows harshly.',
      'Keep your core tight — don\'t let your hips sag or pike up.'
    ]
  },
  {
    id: 'pushup-incline',
    name: 'Incline Push-up',
    muscle: 'chest',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '12 reps',
    guidelines: [
      'Hands on a raised surface (bed, sofa, stairs) — higher surface = easier.',
      'Same form as a standard push-up: straight body line, controlled descent.',
      'Good starting point if standard push-ups are too difficult yet.'
    ]
  },
  {
    id: 'pushup-diamond',
    name: 'Diamond Push-up',
    muscle: 'chest',
    type: 'strength',
    difficulty: 'experienced',
    defaultTarget: '8 reps',
    guidelines: [
      'Hands together under your chest, forming a diamond shape with thumbs and index fingers.',
      'Targets triceps and inner chest more than standard push-ups.',
      'Keep elbows closer to your body throughout the movement.'
    ]
  },
  {
    id: 'pushup-decline',
    name: 'Decline Push-up',
    muscle: 'chest',
    type: 'strength',
    difficulty: 'experienced',
    defaultTarget: '10 reps',
    guidelines: [
      'Feet raised on a chair or sofa, hands on the floor.',
      'Shifts more load to upper chest and shoulders.',
      'Keep core braced — this variation is harder to stabilize.'
    ]
  },

  // ---------- BACK ----------
  {
    id: 'superman',
    name: 'Superman Hold',
    muscle: 'back',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '3 x 20 sec hold',
    guidelines: [
      'Lie face down, arms extended forward.',
      'Simultaneously lift arms, chest, and legs off the floor.',
      'Hold briefly, keeping neck neutral — don\'t crane your head up.',
      'Lower with control, don\'t just drop.'
    ]
  },
  {
    id: 'reverse-snow-angel',
    name: 'Reverse Snow Angel',
    muscle: 'back',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '15 reps',
    guidelines: [
      'Lie face down, arms at your sides.',
      'Sweep arms up and out in an arc, squeezing shoulder blades together.',
      'Keep chest lifted slightly off the ground throughout.'
    ]
  },
  {
    id: 'doorframe-row',
    name: 'Doorframe Row',
    muscle: 'back',
    type: 'strength',
    difficulty: 'some',
    defaultTarget: '12 reps',
    guidelines: [
      'Hold a sturdy doorframe or pole, lean back with arms extended, feet planted.',
      'Pull your chest toward the frame, squeezing your shoulder blades.',
      'Control the return — don\'t let momentum do the work.',
      'The further back you lean, the harder the pull.'
    ]
  },

  // ---------- LEGS ----------
  {
    id: 'squat-bodyweight',
    name: 'Bodyweight Squat',
    muscle: 'legs',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '15 reps',
    guidelines: [
      'Feet shoulder-width apart, toes slightly out.',
      'Push hips back and bend knees, keeping chest up and weight in your heels.',
      'Go as low as comfortable — ideally thighs parallel to the floor.',
      'Drive through your heels to stand back up.'
    ]
  },
  {
    id: 'lunge',
    name: 'Forward Lunge',
    muscle: 'legs',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '10 reps per leg',
    guidelines: [
      'Step forward, lowering your back knee toward the floor.',
      'Front knee should stay roughly above your front ankle, not past your toes.',
      'Push off your front foot to return to standing.',
      'Keep your torso upright throughout.'
    ]
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    muscle: 'legs',
    type: 'strength',
    difficulty: 'experienced',
    defaultTarget: '10 reps per leg',
    guidelines: [
      'Rear foot elevated on a chair or bed, front foot planted well ahead.',
      'Lower your back knee toward the floor, front knee tracking over the ankle.',
      'This is intense on balance and quads — go slow at first.'
    ]
  },
  {
    id: 'calf-raise',
    name: 'Calf Raise',
    muscle: 'legs',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '20 reps',
    guidelines: [
      'Stand tall, rise up onto your toes as high as possible.',
      'Hold briefly at the top, then lower slowly.',
      'Use a wall or chair nearby for balance if needed.'
    ]
  },
  {
    id: 'wall-sit',
    name: 'Wall Sit',
    muscle: 'legs',
    type: 'strength',
    difficulty: 'some',
    defaultTarget: '3 x 30 sec hold',
    guidelines: [
      'Back flat against a wall, slide down until thighs are parallel to the floor.',
      'Knees should be at roughly 90°, directly above ankles.',
      'Keep your core engaged and breathe steadily through the hold.'
    ]
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    muscle: 'legs',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '15 reps',
    guidelines: [
      'Lie on your back, knees bent, feet flat on the floor.',
      'Push through your heels to lift your hips until your body forms a straight line knee-to-shoulder.',
      'Squeeze glutes at the top, then lower with control.'
    ]
  },

  // ---------- CORE ----------
  {
    id: 'situp-standard',
    name: 'Sit-up',
    muscle: 'core',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '15 reps',
    guidelines: [
      'Lie on your back, knees bent, feet flat (anchored under something if needed).',
      'Curl your torso up until your chest nears your knees.',
      'Lower with control — don\'t let momentum carry you back down.',
      'Avoid pulling on your neck with your hands.'
    ]
  },
  {
    id: 'plank',
    name: 'Plank',
    muscle: 'core',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '3 x 30 sec hold',
    guidelines: [
      'Forearms and toes on the floor, body in a straight line head to heels.',
      'Keep hips level — don\'t let them sag or pike up.',
      'Engage your core and glutes throughout, breathe normally.'
    ]
  },
  {
    id: 'bicycle-crunch',
    name: 'Bicycle Crunch',
    muscle: 'core',
    type: 'strength',
    difficulty: 'some',
    defaultTarget: '20 reps (both sides)',
    guidelines: [
      'Lie on your back, hands behind your head, knees bent.',
      'Bring opposite elbow to opposite knee in a pedaling motion.',
      'Keep your lower back pressed toward the floor throughout.',
      'Move with control, not speed — the twist matters more than pace.'
    ]
  },
  {
    id: 'leg-raise',
    name: 'Lying Leg Raise',
    muscle: 'core',
    type: 'strength',
    difficulty: 'some',
    defaultTarget: '15 reps',
    guidelines: [
      'Lie on your back, legs straight, hands at your sides or under your lower back for support.',
      'Raise legs to vertical, keeping them straight, then lower slowly without touching the floor.',
      'Keep lower back pressed down — if it arches, raise legs less far.'
    ]
  },
  {
    id: 'mountain-climber',
    name: 'Mountain Climbers',
    muscle: 'core',
    type: 'cardio',
    difficulty: 'some',
    defaultTarget: '30 sec x 3',
    guidelines: [
      'Start in a plank position, hands under shoulders.',
      'Drive knees toward your chest alternately, at a quick pace.',
      'Keep hips low and core tight — don\'t let your hips bounce up.'
    ]
  },
  {
    id: 'hollow-hold',
    name: 'Hollow Body Hold',
    muscle: 'core',
    type: 'strength',
    difficulty: 'experienced',
    defaultTarget: '3 x 20 sec',
    guidelines: [
      'Lie on your back, press your lower back into the floor.',
      'Lift shoulders and legs slightly off the ground, arms extended overhead.',
      'Hold this curved, tense position — it\'s intense even at short durations.'
    ]
  },

  // ---------- CARDIO / FULL BODY ----------
  {
    id: 'jumping-jacks',
    name: 'Jumping Jacks',
    muscle: 'fullbody',
    type: 'cardio',
    difficulty: 'beginner',
    defaultTarget: '40 reps',
    guidelines: [
      'Jump feet out while raising arms overhead, then jump back to start.',
      'Keep a steady rhythm — good warm-up or cardio filler between sets.'
    ]
  },
  {
    id: 'burpee',
    name: 'Burpee',
    muscle: 'fullbody',
    type: 'cardio',
    difficulty: 'experienced',
    defaultTarget: '10 reps',
    guidelines: [
      'Drop into a squat, place hands down, kick feet back into a plank.',
      'Do a push-up (optional for beginners), jump feet back to hands, then explosively jump up.',
      'Full-body, high intensity — pace yourself and prioritize form over speed.'
    ]
  },
  {
    id: 'high-knees',
    name: 'High Knees',
    muscle: 'fullbody',
    type: 'cardio',
    difficulty: 'beginner',
    defaultTarget: '30 sec x 3',
    guidelines: [
      'Jog in place, driving knees up toward your chest as high as possible.',
      'Pump arms naturally, stay on the balls of your feet.'
    ]
  },
  {
    id: 'squat-jump',
    name: 'Jump Squat',
    muscle: 'legs',
    type: 'cardio',
    difficulty: 'some',
    defaultTarget: '12 reps',
    guidelines: [
      'Perform a bodyweight squat, then explode upward into a jump.',
      'Land softly, bending knees to absorb impact, and go straight into the next rep.',
      'Hard on the knees — skip if you have joint issues, sub with regular squats.'
    ]
  },
  {
    id: 'skater-jump',
    name: 'Skater Jumps',
    muscle: 'legs',
    type: 'cardio',
    difficulty: 'some',
    defaultTarget: '20 reps (both sides)',
    guidelines: [
      'Jump laterally from one foot to the other, like a speed skater.',
      'Land softly on the outside foot, let the trailing leg swing behind.',
      'Great for lateral power and balance.'
    ]
  },

  // ---------- SHOULDERS / ARMS ----------
  {
    id: 'pike-pushup',
    name: 'Pike Push-up',
    muscle: 'shoulders',
    type: 'strength',
    difficulty: 'experienced',
    defaultTarget: '10 reps',
    guidelines: [
      'Start in a downward-dog-like position, hips high, hands and feet on the floor.',
      'Bend elbows to lower your head toward the floor, then push back up.',
      'Targets shoulders more directly than a standard push-up.'
    ]
  },
  {
    id: 'tricep-dip',
    name: 'Chair Tricep Dip',
    muscle: 'arms',
    type: 'strength',
    difficulty: 'some',
    defaultTarget: '12 reps',
    guidelines: [
      'Hands on the edge of a sturdy chair or sofa, legs extended in front.',
      'Lower your body by bending elbows to about 90°, then press back up.',
      'Keep elbows pointed backward, not flared out to the sides.'
    ]
  },
  {
    id: 'arm-circles',
    name: 'Arm Circles',
    muscle: 'shoulders',
    type: 'strength',
    difficulty: 'beginner',
    defaultTarget: '30 sec each direction',
    guidelines: [
      'Extend arms out to the sides at shoulder height.',
      'Make small, controlled circles, gradually increasing size.',
      'Great as a warm-up or shoulder endurance finisher.'
    ]
  },

  // ---------- FLEXIBILITY / MOBILITY ----------
  {
    id: 'cat-cow',
    name: 'Cat-Cow Stretch',
    muscle: 'back',
    type: 'flexibility',
    difficulty: 'beginner',
    defaultTarget: '10 reps',
    guidelines: [
      'On hands and knees, alternate between arching your back (cow) and rounding it (cat).',
      'Move slowly with your breath — inhale on cow, exhale on cat.',
      'Great for spinal mobility, especially after sitting a lot.'
    ]
  },
  {
    id: 'standing-hamstring-stretch',
    name: 'Standing Hamstring Stretch',
    muscle: 'legs',
    type: 'flexibility',
    difficulty: 'beginner',
    defaultTarget: '30 sec per leg',
    guidelines: [
      'Hinge forward at the hips, reaching toward your toes, knees slightly soft.',
      'Don\'t bounce — hold steady and let the stretch ease in gradually.'
    ]
  },
  {
    id: 'hip-flexor-stretch',
    name: 'Kneeling Hip Flexor Stretch',
    muscle: 'legs',
    type: 'flexibility',
    difficulty: 'beginner',
    defaultTarget: '30 sec per side',
    guidelines: [
      'Kneel on one knee, other foot planted in front, knee at 90°.',
      'Gently push your hips forward until you feel a stretch at the front of the rear hip.',
      'Keep your torso upright — avoid leaning forward.'
    ]
  }
];

const MUSCLE_LABELS = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  core: 'Core',
  shoulders: 'Shoulders',
  arms: 'Arms',
  fullbody: 'Full Body'
};

const TYPE_LABELS = {
  strength: 'Strength',
  cardio: 'Cardio',
  flexibility: 'Flexibility'
};

const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  some: 'Intermediate',
  experienced: 'Advanced'
};
