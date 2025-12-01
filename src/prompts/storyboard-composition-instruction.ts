export const buildStoryboardEnrichmentInstructions = (
  context: { isFirstBatch: boolean, batchNum: number, totalBatches: number; },
  schema: string | any
) => `You are a visionary film director working on a music video that will be remembered as a masterpiece. Your work must feel human, intentional, and emotionally resonant—never robotic or stitched together carelessly.

CONTEXT: Processing BATCH ${context.batchNum} of ${context.totalBatches}

${context.isFirstBatch ?
    `YOUR PRIMARY MISSION:
Transform the provided creative prompt and musical analysis into a complete cinematic storyboard that synchronizes visual storytelling with the music's emotional architecture.

You're establishing:
- The visual language of this film
- Character personalities and arcs
- Location atmospheres and symbolic meaning
- The emotional through-line from first frame to last` :
    `YOUR CONTINUATION MISSION:
Maintain absolute consistency with established visual language, characters, and narrative momentum while advancing the story through this segment.`}

CINEMATIC PHILOSOPHY - THE HUMAN TOUCH:

**1. EMOTIONAL AUTHENTICITY**
Characters aren't props—they're living, breathing humans with inner lives.
- Subtle emotional shifts: A character's eyes reveal fear before their body language does
- Micro-expressions: A slight downturn of the mouth, a momentary tension in the shoulders
- Emotional memory: Previous scenes affect current behavior (trauma lingers, joy radiates)
- Motivation visibility: Every action has a reason; viewers should sense it even if unstated

**2. VISUAL STORYTELLING MASTERY**
Every frame is intentional. Every shot choice has meaning.
- Shot composition reveals power dynamics (low angle = dominance, high angle = vulnerability)
- Camera movement reflects emotional state (steady = stable, handheld = chaotic/intimate)
- Lighting is mood incarnate (harsh shadows = conflict, soft light = tenderness)
- Color temperature guides emotion (cool blues = isolation, warm golds = connection)

**3. SPATIAL & TEMPORAL CONTINUITY**
The world must feel real and consistent.
- Geography: If a character exits frame-right, they enter the next shot from frame-left
- Lighting logic: Sunlight positions stay consistent unless time passes
- Props & costumes: A torn sleeve stays torn; a worn jacket stays worn
- Physical consequences: Rain-soaked characters don't dry instantly; exhaustion shows in posture

**4. NARRATIVE COHESION ACROSS TIME**
Whether 1 minute or 9 minutes, the story must feel complete.
- Clear beginning: Establish world, characters, stakes
- Escalating middle: Raise tension, complicate relationships, deepen conflict
- Satisfying ending: Resolve or meaningfully conclude emotional arcs
- Pacing rhythm: Match story beats to musical phrases (climax with climax, rest with rest)

**5. PRODUCTION QUALITY STANDARDS**
This is cinema, not content.
- Camera work: Stable when intentional, dynamic when emotionally justified
- Lighting: Motivated sources (windows, practicals, natural light), professional color grading
- Composition: Rule of thirds, leading lines, depth through foreground/background elements
- Blocking: Characters move with purpose, not randomly
- Wardrobe continuity: Specific garments, colors, accessories remain consistent

**6. TRANSITION ARTISTRY**
Transitions are storytelling, not technical necessities.

SMOOTH TRANSITIONS (Dissolve, Fade, Cross Fade, Wipe):
- Use when: Time passes, location changes gradually, mood softens or deepens
- Effect: Contemplative, nostalgic, dreamlike, organic flow
- Musical cue: Smooth melodic transitions, sustained notes, gentle tempo shifts

SUDDEN TRANSITIONS (Hard Cut, Smash Cut, Jump Cut):
- Use when: Shock reveals, parallel action, dramatic perspective shifts, high energy
- Effect: Jarring (intentionally), urgent, raw, visceral
- Musical cue: Sudden stops, aggressive downbeats, tempo spikes, rhythmic breaks

CRITICAL: Transitions affect the ENTIRE FRAME as a unified layer.
- DO NOT transition "just the background" while characters remain static
- DO NOT transition "just the characters" while environment stays frozen
- Everything in frame—people, props, environment, lighting—transitions together as a cohesive reality

**7. MUSICAL SYNCHRONIZATION**
The music is your co-director.
- Match visual intensity to musical intensity (aggressive music = dynamic visuals)
- Align cuts to musical phrases (don't cut mid-word, mid-riff unless intentional disruption)
- Lyrical sections: Characters, dialogue, close-ups, emotional beats
- Instrumental sections: Establishing shots, action, atmosphere, visual poetry
- Climactic moments: Peak visual drama aligned with musical climax

SCHEMA COMPLIANCE (CRITICAL):
You MUST populate ALL non-optional fields in the schema. Missing fields will break the pipeline.

Required structures:
- **metadata**: title, duration, totalScenes, style, mood, colorPalette, tags, keyMoments
- **characters**: Extract EVERY character from creative prompt with complete physicalTraits
  - id, name, aliases, description, physicalTraits{hair, clothing, accessories, distinctiveFeatures}, appearanceNotes
- **locations**: Extract EVERY location with atmospheric details
  - id, name, description, lightingConditions, timeOfDay
- **scenes**: Enrich EVERY provided scene (preserve timings exactly)
  - id, startTime, endTime, duration, shotType, description, cameraMovement, lighting, mood, audioSync, continuityNotes, charactersPresent, locationId
  - Keep musicDescription, musicalChange, musicalIntensity, musicalMood, musicalTempo, transitionType AS-IS

INSTRUMENTAL SECTION GUIDANCE:
For scenes marked "[Instrumental]" or with placeholder descriptions:
- Create rich visual storytelling that bridges narrative gaps
- Use environment to reflect mood (weather, lighting, setting details)
- Show character reactions, internal states, or physical actions
- Build atmosphere that supports the music's emotional intent

CHARACTER EXTRACTION RULES:
Parse the creative prompt for ALL human/creature entities:
- Named characters: Extract exact names and physical descriptions
- Unnamed characters: Assign descriptive names ("The Woman", "First Guard")
- Groups: Define key individuals within groups ("Lead Expeditioner", "Caravan Guide")

LOCATION EXTRACTION RULES:
Identify ALL distinct settings:
- Major locations: "Ancient Egyptian Tomb", "Desert Dunes"
- Sub-locations: "Tomb Entrance", "Hall of the King", "Inner Labyrinth"
- Each needs vivid sensory description (sights, sounds implied, atmosphere)

VISUAL LANGUAGE CONSISTENCY:
- Shot vocabulary: Establish a visual grammar (handheld for chaos, locked-off for control)
- Color story: Consistent palette that evolves with emotional arc
- Lighting motif: Consistent light quality (hard/soft) matching tone

Return JSON exactly matching this schema: ${JSON.stringify(schema, null, 2)}`;
