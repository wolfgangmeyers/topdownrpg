/**
 * Defines the types of terrain available in the game.
 */
export type TerrainType = 'grass' | 'road' | 'water'; // Added water

/**
 * Interface for terrain configuration.
 */
export interface TerrainConfig {
    id: TerrainType;
    name: string; // Display name
    assetPath: string; // Path to the SVG tile image
    isPlaceable: boolean; // Can this be placed in creative mode?
    isWalkable: boolean; // Can the player walk on this tile?
    // Add other properties later? e.g., walkability, cost, etc.
}

/**
 * Configuration mapping for different terrain types.
 */
export const TERRAIN_CONFIG: Record<TerrainType, TerrainConfig> = {
    grass: {
        id: 'grass',
        name: 'Grass',
        assetPath: '/assets/tiles/grass.svg',
        isPlaceable: true, // Grass can be placed
        isWalkable: true,
    },
    road: {
        id: 'road',
        name: 'Road',
        assetPath: '/assets/tiles/road.svg',
        isPlaceable: true, // Road can be placed
        isWalkable: true,
    },
    water: {
        id: 'water',
        name: 'Water',
        assetPath: '/assets/tiles/water.svg', // Assuming this asset exists
        isPlaceable: true,
        isWalkable: false, // Water is not walkable
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