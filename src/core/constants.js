// Global engine constants. The play field is a fixed 3:4 logical space;
// everything in gameplay code is expressed in these world units.
export const WORLD_W = 480;
export const WORLD_H = 640;

// Fixed simulation step. Gameplay is deterministic per step (required for
// seeded/replayable runs); rendering interpolates between steps.
export const STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;

// Atlas pixels per world unit. Sprites are rasterised at 2x so they stay
// crisp when the canvas is scaled up on high-DPI / large displays.
export const SPRITE_PX = 2;
