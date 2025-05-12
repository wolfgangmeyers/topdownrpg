import { TerrainManager } from './terrainManager';
import { EntityManager } from './entityManager';
import { TerrainType } from './terrain';
import { Direction } from './sceneTransitionSystem';

// Enum for different biome types
export enum BiomeType {
    SPARSE_FOREST = 'sparse-forest',
    // Future biomes will be added here as:
    // DENSE_FOREST = 'dense-forest',
    // PLAINS = 'plains',
    // DESERT = 'desert',
    // SWAMP = 'swamp',
    // MOUNTAINS = 'mountains',
    // etc.
}

// Interface for biome configuration
export interface BiomeConfig {
    // Base terrain type that fills most of the biome
    baseTerrain: TerrainType;
    
    // The number of trees to generate in this biome
    treeDensity: number;
    
    // Minimum distance between trees (for sparser or denser forests)
    treeSpacing: number;
    
    // Center padding (empty space around the center)
    centerPadding: number;
    
    // Densities for other resources
    roundStoneDensity?: number; // Number of round stones to generate
    triangularStoneDensity?: number; // Number of triangular stones to generate
    stickDensity?: number; // Number of sticks to generate
    
    // Secondary terrain features
    secondaryTerrainType?: TerrainType; // Type of secondary terrain (water, road, etc.)
    secondaryTerrainChance?: number; // Chance (0-1) of a tile being secondary terrain
    secondaryTerrainClumping?: number; // How much secondary terrain clumps (0-1, higher = more clumping)
    
    // Future biome properties can include:
    // houseChance?: number; // Chance of random houses
    // rockDensity?: number; // Density of rocks
    // enemyTypes?: string[]; // Types of enemies that spawn here
    // enemyDensity?: number; // Density of enemies
    // weatherEffect?: string; // Special weather effects
    // musicTrack?: string; // Background music
}

// Configuration map for different biome types
export const BIOME_CONFIG: Record<BiomeType, BiomeConfig> = {
    [BiomeType.SPARSE_FOREST]: {
        baseTerrain: TerrainType.GRASS,
        treeDensity: 15,
        treeSpacing: 50,
        centerPadding: 150,
        // No secondary terrain in basic sparse forest
        roundStoneDensity: 1, // Fewer round stones
        triangularStoneDensity: 1, // Fewer sharp stones
        stickDensity: 1, // Add some sticks
    },
    /* 
    // Example of future biome types:
    [BiomeType.DENSE_FOREST]: {
        baseTerrain: TerrainType.GRASS,
        treeDensity: 30,
        treeSpacing: 30,
        centerPadding: 100,
        secondaryTerrainType: TerrainType.WATER,
        secondaryTerrainChance: 0.05,
        secondaryTerrainClumping: 0.7,
    },
    [BiomeType.PLAINS]: {
        baseTerrain: TerrainType.GRASS,
        treeDensity: 5,
        treeSpacing: 100,
        centerPadding: 200,
    },
    [BiomeType.DESERT]: {
        baseTerrain: TerrainType.SAND, // Would need to add SAND to TerrainType
        treeDensity: 3,
        treeSpacing: 120,
        centerPadding: 150,
    },
    */
};

// Define type for the scene link callback
export type SceneLinkCallback = (direction: Direction, linkedSceneId: string) => void;

/**
 * The BiomeManager class handles generating and managing biomes.
 * It provides methods to create terrain layouts and populate entities
 * based on biome type.
 */
export class BiomeManager {
    constructor(
        private terrainManager: TerrainManager,
        private entityManager: EntityManager,
        private worldWidth: number,
        private worldHeight: number,
        private tileSize: number
    ) {}

    /**
     * Generates a complete biome with terrain and entities
     * @param biomeType Type of biome to generate
     * @param contextData Optional context data for scene links
     * @param sceneLinkCallback Optional callback for setting up scene links
     */
    generateBiome(
        biomeType: BiomeType, 
        contextData?: any,
        sceneLinkCallback?: SceneLinkCallback
    ): void {
        console.log(`Generating biome of type: ${biomeType}`);
        
        // Clear any existing entities
        this.entityManager.clearAll();
        
        // Resize the terrain grid to match world dimensions
        this.terrainManager.resizeGrid(
            Math.ceil(this.worldHeight / this.tileSize),
            Math.ceil(this.worldWidth / this.tileSize)
        );
        
        // Apply terrain based on biome type
        this.applyBiomeTerrain(biomeType);
        
        // Populate entities based on biome type
        this.populateBiomeEntities(biomeType);
        
        // Set up bidirectional links if provided in context data
        if (contextData && contextData.isNewScene && 
            contextData.linkedDirection && contextData.linkedSceneId) {
            
            if (sceneLinkCallback) {
                sceneLinkCallback(contextData.linkedDirection, contextData.linkedSceneId);
                console.log(`Set up link from ${contextData.linkedDirection} to ${contextData.linkedSceneId} via callback`);
            } else {
                console.warn('Scene link data provided but no callback available');
            }
        }
    }
    
    /**
     * Applies terrain patterns based on the biome type
     * @param biomeType The type of biome to generate terrain for
     */
    private applyBiomeTerrain(biomeType: BiomeType): void {
        const config = BIOME_CONFIG[biomeType];
        
        // Apply the base terrain (this will initialize the grid with the base terrain type)
        this.terrainManager.fillGridWith(config.baseTerrain);
        
        // Apply secondary terrain if configured
        if (config.secondaryTerrainType && config.secondaryTerrainChance && config.secondaryTerrainChance > 0) {
            this.applySecondaryTerrain(config);
        }
    }
    
    /**
     * Applies secondary terrain features like water, roads, etc.
     * @param config The biome configuration
     */
    private applySecondaryTerrain(config: BiomeConfig): void {
        // Skip if no secondary terrain is defined
        if (!config.secondaryTerrainType || !config.secondaryTerrainChance) return;
        
        const { rows, cols } = this.terrainManager.getGridDimensions();
        const secondaryType = config.secondaryTerrainType;
        const chance = config.secondaryTerrainChance;
        const clumping = config.secondaryTerrainClumping || 0;
        
        console.log(`Applying secondary terrain ${secondaryType} with chance ${chance} and clumping ${clumping}`);
        
        // Simple algorithm for now: just randomly place secondary terrain based on chance
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (Math.random() < chance) {
                    // Convert world coordinates from grid
                    const worldX = x * this.tileSize + this.tileSize / 2;
                    const worldY = y * this.tileSize + this.tileSize / 2;
                    this.terrainManager.placeTerrainAt(worldX, worldY, secondaryType);
                    
                    // If clumping is enabled, potentially expand to adjacent tiles
                    if (clumping > 0) {
                        this.expandSecondaryTerrain(x, y, secondaryType, clumping);
                    }
                }
            }
        }
    }
    
    /**
     * Recursively expands secondary terrain around a starting point based on clumping factor
     * @param startX Starting X coordinate (grid)
     * @param startY Starting Y coordinate (grid)
     * @param terrainType The terrain type to place
     * @param clumpingFactor How likely terrain is to expand (0-1)
     * @param depth Current recursion depth (default 0)
     * @param maxDepth Maximum recursion depth (default 3)
     */
    private expandSecondaryTerrain(
        startX: number, 
        startY: number, 
        terrainType: TerrainType, 
        clumpingFactor: number,
        depth: number = 0,
        maxDepth: number = 3
    ): void {
        // Stop if we've gone too deep in recursion
        if (depth >= maxDepth) return;
        
        // Try to expand in each of the 4 directions
        const directions = [
            { dx: 1, dy: 0 },  // right
            { dx: -1, dy: 0 }, // left
            { dx: 0, dy: 1 },  // down
            { dx: 0, dy: -1 }  // up
        ];
        
        for (const dir of directions) {
            const newX = startX + dir.dx;
            const newY = startY + dir.dy;
            
            // Skip if out of bounds
            if (newX < 0 || newY < 0) continue;
            
            // Check if we should expand based on clumping factor
            if (Math.random() < clumpingFactor) {
                // Convert to world coordinates
                const worldX = newX * this.tileSize + this.tileSize / 2;
                const worldY = newY * this.tileSize + this.tileSize / 2;
                
                // Place the terrain
                this.terrainManager.placeTerrainAt(worldX, worldY, terrainType);
                
                // Recursively continue expanding with reduced probability
                this.expandSecondaryTerrain(
                    newX, 
                    newY, 
                    terrainType, 
                    clumpingFactor * 0.7, // Reduce clumping as we expand outward
                    depth + 1,
                    maxDepth
                );
            }
        }
    }
    
    /**
     * Populates entities (trees, etc.) based on the biome type
     * @param biomeType The type of biome to populate entities for
     */
    private populateBiomeEntities(biomeType: BiomeType): void {
        const config = BIOME_CONFIG[biomeType];

        // Populate Trees
        this.entityManager.populateTrees(
            config.treeDensity,
            this.worldWidth,
            this.worldHeight
        );

        // Populate Round Stones
        const roundStoneCount = config.roundStoneDensity || 0;
        for (let i = 0; i < roundStoneCount; i++) {
            this.spawnRandomItem('stone_round', 1);
        }

        // Populate Triangular Stones
        const triangularStoneCount = config.triangularStoneDensity || 0;
        for (let i = 0; i < triangularStoneCount; i++) {
            this.spawnRandomItem('stone_triangular', 1);
        }

        // Populate Sticks
        const stickCount = config.stickDensity || 0;
        for (let i = 0; i < stickCount; i++) {
            this.spawnRandomItem('stick', 1);
        }

        // Future: Add more complex entity population logic
        // For example:
        // if (config.rockDensity) { // Note: This was for static rocks, now handled above as items
        //     this.populateRocks(config.rockDensity);
        // }
        // if (config.houseChance && Math.random() < config.houseChance) {
        //     this.placeRandomHouse();
        // }
    }

    /**
     * Helper method to spawn a specific item at a random walkable location.
     * @param itemId The ID of the item to spawn.
     * @param quantity The quantity of the item to spawn.
     */
    private spawnRandomItem(itemId: string, quantity: number): void {
        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loops if no space is found

        while (attempts < maxAttempts) {
            const x = Math.random() * this.worldWidth;
            const y = Math.random() * this.worldHeight;

            // Convert to grid coordinates for walkability check
            const gridX = Math.floor(x / this.tileSize);
            const gridY = Math.floor(y / this.tileSize);

            // Check if the location is walkable
            if (this.terrainManager.isWalkable(gridX, gridY)) {
                // Check if the location is reasonably clear of existing static objects
                // (Optional: Add a small radius check against entityManager.getObjectAt if needed)
                if (!this.entityManager.getObjectAt(x, y)) { // Check only the exact point
                    this.entityManager.spawnDroppedItem(itemId, x, y, quantity);
                    return; // Successfully spawned
                }
            }
            attempts++;
        }
        console.warn(`Could not find a suitable location for item ${itemId} after ${maxAttempts} attempts.`);
    }

    /**
     * How to add a new biome type:
     * 1. Add a new entry to the BiomeType enum
     * 2. Add a corresponding configuration in BIOME_CONFIG
     * 3. If the biome requires new entity types or special terrain patterns,
     *    implement those in dedicated methods and call them from applyBiomeTerrain
     *    or populateBiomeEntities
     * 4. If you're adding a new terrain type, make sure to add it to the TerrainType
     *    enum in terrain.ts and provide appropriate configuration
     */
} 