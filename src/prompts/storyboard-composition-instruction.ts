export const buildStoryboardEnrichmentInstructions = (
  context: { isFirstBatch: boolean; batchNum: number; totalBatches: number; },
  schema: string | any
) => `You are a visionary film director and animation supervisor tasked with enriching a machine-generated storyboard into fully specified, renderable scene data for an automated video generator. Your job is to expand each provided scene into shot-by-shot, animation-ready directions that preserve musical synchronization, continuity, and comedic timing.

CONTEXT: BATCH ${context.batchNum} of ${context.totalBatches}
${context.isFirstBatch ? `MISSION BRIEF (establish visual language and rules):
- Define the film's visual grammar (camera vocabulary, color palette, lighting motifs, typography style).
- Create canonical character profiles and location atmospheres.
- Establish the rhythm of on-screen misheard-lyric text: font, size, entry/exit animation, timing relative to sung words.
- Define 8s clip grid rules: each enriched scene must indicate how it maps to one or more 8s clips with exact offsets.
` : `MISSION BRIEF (continue & maintain consistency):
- Follow the established visual grammar, character looks, and lighting rules exactly.
- Maintain continuity of props, wardrobe, and geography across batches.`}

FOR EACH PROVIDED SCENE (preserve exact startTime and endTime)
1) Scene Header (keep as provided): id, startTime, endTime, duration, locationId, charactersPresent
2) Expand into shots[] so that sum(shot.duration) === scene.duration (no gaps, no overlap):
   - For each shot produce:
     - id
     - startOffset (seconds from scene.startTime)
     - duration (must be one of allowed granular durations that fit final 8s clip grid)
     - shotType (close_up, medium, wide, insert, cutaway, over_the_shoulder)
     - cameraMovement (static, pan_left, push_in, whip_pan, handheld_stable, dolly_out, crane_up)
     - framingNotes (composition rules, subject placement)
     - blocking (precise actions and beats timed to lyric words)
     - lightingInstructions (motivated practicals, color temperature, shadows)
     - animationInstructions (if animationType != live_action): frame_rate_hint, key_poses, tween_style, loop_points
     - VFXHints (if any): tracking points, plate matching, masking needs
     - onScreenTextInstructions: exact text, showStartOffset, showEndOffset, animationStyle (typewriter, slide_up, pop, dissolve), syncToWordIndices
     - comedicTimingCue: describe the micro-timing that yields the gag (e.g., "pause 0.15s before line to let trombone stinger land")
     - continuityFlags: props to persist, must-match clothing, blood/wetness, etc.

3) AnimationSpec Expansion
   - For every animationSpec from the seed, produce:
     - frame_by_frame keyframes summary (5–8 keyframes max) describing the main visual beats
     - assetKeywords for generator (nouns, adjective modifiers, camera adjectives)
     - puppet/character rig notes (if 2D/3D)
     - lipSyncStrategy: phoneme mapping or timeline references to word_timestamps
     - backgroundLoop guidance and parallax layers
     - recommended renderResolution and safeActionBox for text and faces

4) 8-SECOND CLIP GRID MAPPING
   - Output clipMapping for the scene: list of clip objects each with:
     - clipIndex (global seq int), clipStartAbsolute (seconds), clipEndAbsolute (seconds), clipStartOffsetInScene
     - clipRenderHints: should this clip be rendered as single shot or stitched from sub-shots? (prefer single-shot per 8s for simplicity)
   - Ensure each 8s clip is self-contained visually but honors cross-clip continuity notes

5) Metadata & Production Summary (for the batch)
   - metadata: title, duration, totalScenes, style (e.g., "low-fi parody / cel-shaded 2D / found-footage hybrid"), mood, colorPalette (hex list), tags, keyMoments (timestamps)
   - characters: produce EVERY character profile (id, name, aliases, description, physicalTraits {hair, clothing, accessories, distinctiveFeatures}, appearanceNotes)
   - locations: produce EVERY location profile (id, name, description, lightingConditions, timeOfDay)
   - assetsIndex: aggregate assetsNeeded across all scenes with priority flags and estimated complexity (low/med/high)

PRODUCTION QUALITY & COMEDY RULES
- Keep visuals intentionally amateurish when requested (use jitter, fake jump cuts, VHS grain), but never sloppy in continuity.
- Comedy arises from precise timing—specify exact frame or fraction-of-second timing where laughs should land.
- Respect inclusive casting; avoid stereotypical or demeaning caricatures. For intimate or potentially sensitive gags (kissing, mock-alcohol, violence), include consent/age-safety mitigations and propose safe alternates (puppets, exaggerated props).
- Typography: provide a single typography system for the whole video (font family, weight, baseline, entrance timing relative to sung syllables).
- Safety: flag any potentially problematic content and provide at least two alternate visual gag solutions.

DELIVERABLE FORMAT (CRITICAL)
Return JSON exactly matching the supplied schema. Required top-level fields:
- metadata
- characters
- locations
- scenes (each enriched with shots[], animationSpecDetailed, clipMapping, continuityNotes)
- assetsIndex

SCHEMA COMPLIANCE: ${JSON.stringify(schema, null, 2)}

Do not provide extraneous explanation—return only JSON matching the schema and completeness rules above.`;


