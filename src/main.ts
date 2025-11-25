// ============================================================================
// MAIN EXECUTION
// ============================================================================

import { configDotenv } from "dotenv";
configDotenv();

import { CinematicVideoWorkflow } from "./graph";

async function main() {
    const projectId = process.env.GCP_PROJECT_ID || "your-project-id";
    const bucketName = process.env.GCP_BUCKET_NAME || "your-bucket-name";

    const workflow = new CinematicVideoWorkflow(projectId, bucketName);

    const initialPrompt = `
Create a full-length music video featuring cinematic shots interlaced with a live musical performance. 
Dynamically switch between cinematic shots and band performance shots.

Musical Performance:
Progressive metal band performing in a large stone room. Cinematic studio grade lighting changes 
from white to violet to red depending on the tone of the music. Sunlight rays enter from gaps in 
the stone walls.

List of Scenes:
<video_scenes>
Desert scene
2X speed fly-over
A group of exeditioners with a caravan of camels
Crossing the Egyptian deserts
To arrive at the tomb of the ancient Egyptian king
They enter the tomb cautiously,
A man a woman and two other men
They quickly realize the tomb is laid with traps
They’re forced to move deeper into the tomb,
 Becoming trapped
They enter the hall of the king
This is what they have been looking for
The man and the woman approach the sarcophagus
They expect to find treasure here
But they are cautious
They trigger a trap
Activating ancient deeath machines
The hall becomes a tomb for the expeditioners
One man dies
The other three run to avoid the death machines
They run through a labyrinth deep inside the inner tomb
Death machines pursue them relentlessly
They encounter a chasm
The woman swings across on a vine
Below them is a pit of death, filled with rattlesnakes and sharp spires
Falling is certain death
They are forced to cross
The man pulls the vine
He swings across
The other man falls to his death
The couple race deeper into the tomb
Its pitch black
They feel water in the room
The death machines will be coming soon
They descend into the water
The current is strong, they are pulled away
The water swallows them as they are pulled under
They can see a light
The current takes them through an opening
An outlet flows into the mouth of the river
They are freed from the tomb
They live to tell the tale
But at what cost?
The man and the woman come to the riverbank
They lay and breathe
The man has retrieved the treasure they claimed
The woman has plans of her own
They draws a pistol
The man has a pained expression
Why have you done this?
I serve the highest king she says
She shows a tattoo of an ancient insignia
[camera closeup on his eyes, betrayed expression]
He looks into her eyes
Her irises shift, she is not human
She shoots him
Recovers the treasure
And walks away from the scene
In the desert, She comes to a parked horse
Mounts and rides into the dunes.
END just as the song finishes.
`;

    try {
        const result = await workflow.execute(initialPrompt);
        console.log("\n" + "=".repeat(60));
        console.log("✅ Workflow completed successfully!");
        console.log(`   Generated ${result.generatedScenes.length} scenes`);
    } catch (error) {
        console.error("\n❌ Workflow failed:", error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
