graph TD
    A[START] --> B{Resume?};
    B -- No --> C[expand_creative_prompt];
    B -- Yes --> D[process_scene];
    C --> E{Has Audio?};
    E -- Yes --> F[create_scenes_from_audio];
    F --> G[enrich_storyboard_and_scenes];
    E -- No --> H[generate_storyboard_exclusively_from_prompt];
    G --> I[generate_character_assets];
    H --> I[generate_character_assets];
    I --> J[generate_location_assets];
    J --> D;
    D --> K{All Scenes Processed?};
    K -- No --> D;
    K -- Yes --> L[render_video];
    L --> M[finalize];
    M --> N[END];
