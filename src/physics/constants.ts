/** Fixed physics step in seconds (120 Hz). */
export const STEP = 1 / 120;
/** Ball radius in tiles. */
export const BALL_R = 0.06;
/** Ball speed at 100% power, tiles/s. */
export const MAX_PUTT_SPEED = 6;
/** Acceleration per unit of slope gradient, tiles/s². */
export const SLOPE_ACCEL = 4;
/** Vertical gravity while airborne, tiles/s². */
export const GRAVITY = 6;
/** Rolling deceleration per surface, tiles/s². */
export const FRICTION = { G: 1.2, R: 4, S: 9 } as const;
/** Share of speed kept after hitting a wall or prop. */
export const WALL_KEEP = 0.7;
/** A wall/prop hit only reports a 'wall' event above this normal impact speed, tiles/s (bounce physics is unaffected). */
export const MIN_WALL_EVENT_SPEED = 0.2;
/** Share of ground speed kept on landing from a hop. */
export const LAND_KEEP = 0.85;
/** How much faster the ground must fall away than the ball (tiles/s) to launch a hop. */
export const LAUNCH_DROP = 1.0;
/** Cup capture radius, tiles. */
export const CUP_R = 0.18;
/** Ball must cross the cup slower than this to drop in, tiles/s. */
export const CAPTURE_SPEED = 2.2;
/** Lip-out deflection angle, radians, and speed kept. */
export const LIP_DEFLECT = 0.3;
export const LIP_KEEP = 0.85;
/** Below this speed on ground where friction beats the slope, the ball stops. */
export const STOP_SPEED = 0.05;
/** A shot that is still rolling after this long is stopped. */
export const MAX_SIM_SECONDS = 20;
/** Slower than this into a wall (normal speed, tiles/s) is resting contact: the push is cancelled but the slide keeps its speed. */
export const RESTING_CONTACT_SPEED = 0.2;
