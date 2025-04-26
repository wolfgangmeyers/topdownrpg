/**
 * Defines the types of terrain available in the game.
 */
export const TerrainType = {
    GRASS: 'grass',
    ROAD: 'road',
    WATER: 'water',
    WOOD_FLOOR: 'wood-floor'
} as const;

// Define the type based on the constant values
export type TerrainType = typeof TerrainType[keyof typeof TerrainType];

/**
 * Interface for terrain configuration.
 */
export interface TerrainConfig {
    assetPath: string; // Path to the SVG tile image
    isWalkable: boolean; // Can the player walk on this tile?
    // Add other properties later? e.g., walkability, cost, etc.
}

/**
 * Configuration mapping for different terrain types.
 */
export const TERRAIN_CONFIG: Record<TerrainType, TerrainConfig> = {
    [TerrainType.GRASS]: {
        assetPath: '/assets/tiles/grass.svg',
        isWalkable: true,
    },
    [TerrainType.ROAD]: {
        assetPath: '/assets/tiles/road.svg',
        isWalkable: true,
    },
    [TerrainType.WATER]: {
        assetPath: '/assets/tiles/water.svg',
        isWalkable: false,
    },
    [TerrainType.WOOD_FLOOR]: {
        assetPath: '/assets/tiles/wood-floor.svg',
        isWalkable: true,
    },
};

/**
 * Helper function to safely get terrain configuration.
 * @param type The TerrainType ID.
 * @returns The TerrainConfig or undefined if not found.
 */
export function getTerrainConfig(type: TerrainType): TerrainConfig | undefined {
    return TERRAIN_CONFIG[type];
} 