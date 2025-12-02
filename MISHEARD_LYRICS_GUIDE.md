# Misheard Lyrics Comedic Music Video Generator

This project has been modified to create comedic "misheard lyrics" music videos featuring simple animations that literally depict misheard song lyrics.

## What's Changed

The cinematic video framework has been adapted to produce comedy music videos where:
1. Song lyrics are transcribed (or provided by user)
2. Misheard versions of lyrics are generated (or provided by user)
3. Simple 2D animations literally depict the misheard lyrics
4. Misheard lyrics are displayed as text overlays on screen

## Example Output

**Original lyric:** "won't lose my will to stay"
**Misheard lyric:** "woman lose my wilbur steak"
**Animation:** Simple 2D cartoon of a frustrated waitress in a diner uniform holding up a large steak with "WILBUR" written on it, looking around frantically. Large white text at bottom reads: "WOMAN LOSE MY WILBUR STEAK"

**Original lyric:** "Excuse me while I kiss the sky"
**Misheard lyric:** "Excuse me while I kiss this guy"
**Animation:** Simple 2D animation of two guys leaning in for an awkward kiss, both with exaggerated surprised expressions. Text overlay: "EXCUSE ME WHILE I KISS THIS GUY"

## How to Use

### Basic Usage

```bash
# With audio file
npm start -- --audio path/to/song.mp3 --prompt "Create a funny misheard lyrics video"

# With specific video ID
npm start -- --id video_123 --audio path/to/song.mp3
```

### Providing Custom Misheard Lyrics

You can provide your own misheard lyrics in the creative prompt:

```bash
npm start -- --audio song.mp3 --prompt "Create a misheard lyrics video. For the lyric 'won't lose my will to stay', use the misheard lyric 'woman lose my wilbur steak' showing a waitress frantically searching for a steak."
```

### Key Features

1. **Automatic Misheard Lyrics Generation**: If you don't provide specific misheard lyrics, the AI will generate phonetically similar, funny alternatives.

2. **Simple Animation Style**: Videos use intentionally simple 2D cartoon aesthetics with:
   - Flat colors and bold outlines
   - Exaggerated expressions
   - Clear, easy-to-understand visual gags

3. **Text Overlays**: Misheard lyrics appear as large, readable text on screen:
   - White text with black outline
   - Positioned at bottom-center
   - Synced with the music

4. **Literal Interpretation**: The humor comes from literally showing what the misheard lyric says, not what the original lyric meant.

## Technical Changes

### Schema Updates

**AudioSegment schema** now includes:
- `lyrics`: Original correct lyrics
- `misheardLyrics`: The comedic misheard version
- `animationStyle`: Visual style (2d_cartoon, simple_animation, etc.)
- `comedyNotes`: Notes on comedic timing

### Modified Agents

1. **Audio Processing Agent**: Generates misheard lyrics and comedic visual concepts
2. **Compositional Agent**: Focuses on comedy and simplicity rather than cinematic quality
3. **Continuity Manager**: Emphasizes text overlays and literal visual interpretations
4. **Scene Generator**: Creates simple animations with text overlays

### Prompts Updated

All system prompts have been updated to:
- Focus on comedy over cinematography
- Emphasize simple, amateurish visual style
- Require text overlays for misheard lyrics
- Guide literal interpretation of misheard phrases

## Visual Style Guidelines

### DO:
- Use simple 2D cartoon style
- Use flat colors with bold outlines
- Exaggerate expressions and reactions
- Keep visuals clear and easy to understand
- Display misheard lyrics as text on screen
- Show LITERAL interpretation of misheard lyrics

### DON'T:
- Try to be cinematic or photorealistic
- Use complex camera movements
- Overcomplicate the visuals
- Skip the text overlay
- Be subtle with the humor

## Example Creative Prompts

```
"Create a funny misheard lyrics video with simple cartoon animations showing literal interpretations of the misheard lyrics."

"Make a comedic music video where the misheard lyrics are shown literally, like a waitress losing a steak named Wilbur."

"Create a YouTube-style comedy video with simple animations and text overlays showing funny misheard lyrics."
```

## Notes

- Each scene is self-contained with its own joke
- Continuity between scenes is loose (unlike cinematic videos)
- Focus is on humor and clarity, not technical perfection
- All humor is family-friendly
- Text overlays are mandatory for the jokes to land
