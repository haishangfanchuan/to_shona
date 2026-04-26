export const CONSTANTS = {
    SCREEN_WIDTH: 384,
    SCREEN_HEIGHT: 640,
    SCENE_LENGTH: {
        STREET: 1266,
        CITY_NIGHT: 960
    },
    SPEED: {
        NPC_WALK: 40,
        PLAYER_MAX: 80
    },
    DISTANCE: {
        INIT: 100,
        SYNC_TARGET: 40,
        TOO_FAR: -80,
        TOO_FAST: 60
    },
    TEMPERATURE: {
        MAX: 100,
        INIT: 100,
        SYNC_RECOVERY_RATE: 0.05,
        FAR_DECAY_RATE: 0.075,
        MEMORY_BONUS: 5
    }
} as const;
