# Cinematic Framework

An AI-powered cinematic video generation framework that transforms creative prompts and audio into professional-quality videos or music videos with continuity, character consistency, and cinematic storytelling.

## Overview

Cinematic Framework leverages Google's Vertex AI (Gemini models) and LangGraph to orchestrate a sophisticated multi-agent workflow that:

- **Analyzes audio tracks** to extract musical structure, timing, and emotional beats
- **Generates detailed storyboards** with scenes, characters, locations, and cinematography
- **Maintains visual continuity** across scenes using reference images for scene-to-scene consistency
- **Produces cinematic videos** with proper shot composition, lighting, and camera movements
- **Stitches scenes** into a final rendered video synchronized with audio

## Features

- **Audio-Driven and/or Prompt-Based**: Generate videos from audio files (with automatic scene timing) and/or from creative prompts
- **Multi-Agent Architecture**: Specialized agents for audio analysis, storyboard composition, character/location management, scene generation, and continuity tracking
- **Visual Continuity**: Maintains character appearance and location consistency using reference images and last-frame extraction
- **Cinematic Quality**: Professional shot types, camera movements, lighting, and transitions
- **Resume Capability**: Workflow can resume from checkpoints, avoiding regeneration of existing assets
- **Comprehensive Schemas**: Type-safe data structures using Zod for all workflow stages
- **Automatic Retry Logic**: Handles API failures and safety filter violations with intelligent prompt sanitization

## Architecture

The framework uses a **LangGraph state machine** to orchestrate the following workflow:

```
START
  ↓
Audio? → [Yes] → Process Audio → Enhance Storyboard
  ↓       ↓                           ↓
 [No]     └───────────────────────────┘
  ↓                                   ↓
Expand Creative Prompt → Generate Storyboard
  ↓                                   ↓
  └───────────────────────────────────┘
                ↓
        Generate Character References
                ↓
        Generate Location References
                ↓
        Process Scene (loop for each scene)
                ↓
          Render Video (stitch scenes)
                ↓
            Finalize
                ↓
              END
```

### Key Agents

1. **AudioProcessingAgent**: Analyzes audio files using Gemini's multimodal capabilities to extract musical structure, lyrics, tempo, mood, and generates timed scene templates
2. **CompositionalAgent**: Expands creative prompts and generates comprehensive storyboards with characters, locations, cinematography, and narrative structure
3. **ContinuityManagerAgent**: Manages character and location reference images, tracks continuity context across scenes
4. **SceneGeneratorAgent**: Generates individual video clips using Google's video generation API with continuity constraints
5. **FrameCompositionAgent**: Handles frame extraction and composite image generation for character continuity

## Prerequisites

- **Node.js** (v18 or higher)
- **TypeScript** (v5.9+)
- **FFmpeg** installed (for video processing)
- **Google Cloud Project** with:
  - Vertex AI API enabled
  - Google Cloud Storage bucket created
  - Service account with appropriate permissions (see Security section below)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd cinematicframework

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file in the project root (use `.env.example` as template):

```bash
# Google Cloud Platform Configuration
GCP_PROJECT_ID="your-gcp-project-id"
GCP_BUCKET_NAME="your-gcp-bucket-name"
GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

### Required GCP Permissions

Your service account needs the following IAM roles:
- `storage.objectAdmin` or `storage.objectCreator` + `storage.objectViewer` on the bucket
- `aiplatform.user` for Vertex AI API access

## Usage

### Basic Usage

```bash
# Generate video from audio file and prompt
npm start -- --audio audio/song.mp3 --prompt "A cyberpunk thriller set in Neo Tokyo"

# Generate video from prompt only (no audio)
npm start -- --prompt "An epic space battle between rival factions"

# Resume a previous video generation
npm start -- --id video_1234567890 --audio audio/song.mp3 --prompt "..."
```

### Command Line Arguments

| Argument | Aliases | Type | Description |
|----------|---------|------|-------------|
| `--audio` | `--file`, `--audioPath` | string | Path to local audio file (MP3, WAV) |
| `--prompt` | `--creativePrompt` | string | Creative prompt describing the video concept |
| `--id` | `--resume`, `--videoId` | string | Video ID to resume from or specify |

### Examples

**Example 1: Music video with audio**
```bash
npm start -- \
  --audio audio/metal-track.mp3 \
  --prompt "A dark fantasy tale of a wandering knight battling demons in a cursed realm"
```

**Example 2: Short film without audio**
```bash
npm start -- \
  --prompt "A noir detective story set in 1940s Los Angeles, featuring a hard-boiled detective investigating a murder"
```

**Example 3: Resume interrupted workflow**
```bash
npm start -- \
  --id video_1701234567890 \
  --audio audio/song.mp3 \
  --prompt "Original prompt..."
```

## Project Structure

```
cinematicframework/
├── src/
│   ├── agents/                       # Agent implementations
│   │   ├── audio-processing-agent.ts # Audio analysis agent
│   │   ├── compositional-agent.ts    # Storyboard generation agent
│   │   ├── continuity-manager.ts     # Continuity tracking agent
│   │   ├── frame-composition-agent.ts # Frame composition agent
│   │   └── scene-generator.ts        # Video generation agent
│   ├── llm/                          # LLM provider abstractions
│   │   ├── google/                   # Google-specific implementations
│   │   │   ├── google-provider.ts
│   │   │   └── llm-params.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── lib/                          # Utility libraries
│   │   └── llm-retry.ts             # Retry logic with exponential backoff
│   ├── prompts/                      # System prompts for agents
│   │   ├── audio-processing-instruction.ts
│   │   ├── character-image-instruction.ts
│   │   ├── continuity-instructions.ts
│   │   ├── default-creative-prompt.ts
│   │   ├── location-image-instruction.ts
│   │   ├── prompt-expansion-instruction.ts
│   │   └── storyboard-composition-instruction.ts
│   ├── index.ts                      # Main workflow orchestration
│   ├── storage-manager.ts            # GCS storage utilities
│   ├── types.ts                      # Type definitions and Zod schemas
│   └── utils.ts                      # Helper functions
├── audio/                            # Audio files directory
├── dist/                             # Compiled JavaScript output
├── coverage/                         # Test coverage reports
├── .env                              # Environment configuration (gitignored)
├── .env.example                      # Environment template
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
└── vitest.config.ts                  # Test configuration
```

## Output Structure

All outputs are stored in Google Cloud Storage with the following structure:

```
gs://[bucket-name]/[video-id]/
├── audio/                            # Uploaded audio file
│   └── [audio-filename].mp3
├── scenes/
│   ├── storyboard.json              # Complete storyboard with metadata
│   ├── scene_001.mp4                # Individual scene videos
│   ├── scene_002.mp4
│   └── ...
├── images/
│   ├── characters/                   # Character reference images
│   │   ├── char_1_reference.png
│   │   └── ...
│   ├── locations/                    # Location reference images
│   │   ├── loc_1_reference.png
│   │   └── ...
│   └── frames/                       # Extracted frames for continuity
│       ├── scene_001_lastframe.jpg
│       ├── scene_002_lastframe.jpg
│       └── ...
└── final/
    ├── movie.mp4                     # Final stitched video
    └── final_output.json             # Complete workflow output
```

## Dependencies

### Core Dependencies

- **@google-cloud/storage** (^7.17.3): Google Cloud Storage client
- **@google/genai** (^1.30.0): Google Generative AI SDK (Vertex AI)
- **@langchain/langgraph** (^1.0.2): State graph workflow orchestration
- **fluent-ffmpeg** (^2.1.3): Video processing and stitching
- **zod** (^4.1.13): Runtime type validation and schema generation
- **dotenv** (^17.2.3): Environment variable management
- **yargs** (^18.0.0): Command-line argument parsing

### Development Dependencies

- **typescript** (^5.9.3): TypeScript compiler
- **vitest** (^4.0.14): Testing framework
- **@vitest/coverage-v8** (^4.0.14): Code coverage
- **ts-node** (^10.9.2): TypeScript execution

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run coverage
```

## Workflow Details

### Phase 0: Creative Prompt Expansion (No Audio Mode)
Expands user's creative prompt into a comprehensive cinematic blueprint with narrative structure, character details, and visual style.

### Phase 1: Audio Processing / Storyboard Generation
- **With Audio**: Analyzes audio to extract musical structure, segments, tempo, mood, and generates timed scene templates
- **Without Audio**: Generates complete storyboard from expanded creative prompt with appropriate scene durations

### Phase 1b: Storyboard Enhancement
Enriches scene templates with:
- Character definitions and physical descriptions
- Location descriptions and lighting conditions
- Shot types and camera movements
- Continuity notes and transitions

### Phase 2: Asset Generation
- **Phase 2a**: Generates reference images for all characters
- **Phase 2b**: Generates reference images for all locations

### Phase 3: Scene Processing (Loop)
For each scene:
1. Prepares scene inputs with continuity context
2. Generates enhanced prompt with character/location references
3. Calls video generation API with:
   - Enhanced prompt
   - Previous frame for continuity
   - Character reference images
   - Location reference images
4. Extracts last frame from generated video
5. Updates continuity context
6. Implements rate limit cooldown (30s between scenes)

### Phase 4: Video Rendering
- Downloads all scene videos from GCS
- Stitches scenes using FFmpeg concatenation
- Adds audio track if provided
- Uploads final video to GCS

### Phase 5: Finalization
- Saves complete workflow output to JSON
- Reports statistics and final URLs

## Security: Google Cloud Credentials

### Problem: Service Account Key Exposure

The project requires Google Cloud credentials to access Vertex AI and Cloud Storage APIs. **Never commit service account keys to version control** as they provide full access to your GCP resources.

### Recommended Solutions

#### Option 1: Application Default Credentials (Recommended for Development)

For local development, use ADC (Application Default Credentials):

```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Authenticate with your Google account
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

Then update your `.env`:
```bash
GCP_PROJECT_ID="your-project-id"
GCP_BUCKET_NAME="your-bucket-name"
# Remove or comment out GOOGLE_APPLICATION_CREDENTIALS
```

**Pros**: No key files to manage, uses your personal credentials
**Cons**: Each developer needs to authenticate individually

#### Option 2: Secret Manager (Recommended for Teams)

Store the service account key in Google Secret Manager:

```bash
# Create secret with service account key
gcloud secrets create cinematicframework-sa-key \
  --data-file=./service-account-key.json

# Grant access to specific users
gcloud secrets add-iam-policy-binding cinematicframework-sa-key \
  --member="user:teammate@example.com" \
  --role="roles/secretmanager.secretAccessor"
```

Modify code to fetch credentials from Secret Manager at runtime (see [documentation](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets#secretmanager-access-secret-version-nodejs)).

#### Option 3: Workload Identity (Recommended for Production)

For production deployments on GKE, Cloud Run, or Compute Engine, use Workload Identity to automatically provide credentials without key files.

#### Option 4: Environment-Specific Service Accounts

Create separate service accounts for different environments:
- `cinematicframework-dev@project.iam.gserviceaccount.com` (limited permissions)
- `cinematicframework-prod@project.iam.gserviceaccount.com` (production permissions)

Share keys via secure channels (1Password, LastPass, Vault) and **never commit them**.

### Best Practices

1. **Add service account keys to `.gitignore`** (already configured):
   ```
   *.json
   !package*.json
   !tsconfig.json
   ```

2. **Use principle of least privilege**: Grant only necessary IAM roles
3. **Rotate keys regularly**: Set expiration policies on service accounts
4. **Audit access**: Monitor service account usage in Cloud Logging
5. **Use environment variables**: Never hardcode credentials in source code

## Troubleshooting

### Common Issues

**Issue: "Video generation timed out"**
- Solution: Increase `TIMEOUT_MS` in [scene-generator.ts](src/agents/scene-generator.ts:162)

**Issue: "Safety filter triggered"**
- Solution: The framework automatically sanitizes prompts. Review safety error codes in [scene-generator.ts](src/agents/scene-generator.ts:70-84)

**Issue: "Scene video already exists, skipping"**
- Solution: This is expected behavior for resume functionality. Delete the video in GCS to regenerate

**Issue: "Invalid scene duration"**
- Solution: Ensure all durations are 4, 6, or 8 seconds (API constraint)

**Issue: FFmpeg errors**
- Solution: Verify FFmpeg is installed (`ffmpeg -version`) and accessible in PATH

## Performance Considerations

- **Scene generation**: ~2-5 minutes per scene (API dependent)
- **Rate limiting**: 30-second cooldown between scenes to avoid quota issues
- **Audio processing**: ~30-60 seconds for full track analysis
- **Storyboard generation**: ~1-2 minutes depending on complexity
- **Total workflow time**: For a 3-minute song (~15 scenes), expect 60-90 minutes

## Limitations

- Video durations must be exactly 4, 6, or 8 seconds (Vertex AI constraint)
- Maximum 15-minute timeout per scene generation
- Requires significant GCP quota for video generation API
- Person generation may be restricted based on project allowlist

## Contributing

Contributions are welcome! Please ensure:
- All tests pass (`npm test`)
- Code coverage remains above 90% (`npm run coverage`)
- TypeScript strict mode compliance
- Proper error handling and logging

## License

ISC

## Support

For issues and questions:
- Check [Troubleshooting](#troubleshooting) section
- Review error logs in console output
- Inspect GCS bucket for intermediate outputs
- Check Google Cloud Console for quota limits

## Acknowledgments

Built with:
- Google Vertex AI (Gemini models)
- LangGraph for workflow orchestration
- FFmpeg for video processing
