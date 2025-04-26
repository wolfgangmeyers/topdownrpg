import { TerrainType, TERRAIN_CONFIG, getTerrainConfig, TerrainConfig } from './terrain';

export class TerrainManager {
    public terrainGrid: TerrainType[][] = [];
    private worldWidth: number;
    private worldHeight: number;
    private tileSize: number;

    constructor(worldWidth: number, worldHeight: number, tileSize: number) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.tileSize = tileSize;
        this.initializeTerrainGrid();
    }

    initializeTerrainGrid(): void {
        const numCols = Math.ceil(this.worldWidth / this.tileSize);
        const numRows = Math.ceil(this.worldHeight / this.tileSize);
        console.log(`Initializing ${numRows}x${numCols} terrain grid with 'grass'.`);
        this.terrainGrid = [];
        for (let y = 0; y < numRows; y++) {
            this.terrainGrid[y] = [];
            for (let x = 0; x < numCols; x++) {
                this.terrainGrid[y][x] = 'grass'; // Default to grass
            }
        }
    }

    getTileType(gridX: number, gridY: number): TerrainType | null {
         if (gridY >= 0 && gridY < this.terrainGrid.length &&
             gridX >= 0 && gridX < (this.terrainGrid[0]?.length ?? 0)) {
             return this.terrainGrid[gridY][gridX];
         }
         return null; // Outside bounds
    }

     getTileConfig(gridX: number, gridY: number): TerrainConfig | null {
        const type = this.getTileType(gridX, gridY);
        // Ensure getTerrainConfig result is handled, return null if undefined
        return type ? (getTerrainConfig(type) ?? null) : null;
    }


    isWalkable(gridX: number, gridY: number): boolean {
         const config = this.getTileConfig(gridX, gridY);
         // Treat outside bounds or missing config as non-walkable
         return config ? config.isWalkable : false;
    }

    placeTerrainAt(worldX: number, worldY: number, terrainType: TerrainType): void {
        const gridX = Math.floor(worldX / this.tileSize);
        const gridY = Math.floor(worldY / this.tileSize);

        const numCols = this.terrainGrid[0]?.length ?? 0;
        const numRows = this.terrainGrid.length;
        if (gridY >= 0 && gridY < numRows && gridX >= 0 && gridX < numCols) {
            if (this.terrainGrid[gridY][gridX] !== terrainType) {
                this.terrainGrid[gridY][gridX] = terrainType;
                console.log(`Placed ${terrainType} terrain at grid (${gridX}, ${gridY})`);
                // TODO: Play placement sound?
            }
        } else {
            console.warn(`Attempted to place terrain outside grid bounds at (${gridX}, ${gridY})`);
        }
    }

    // Method to get grid dimensions if needed
    getGridDimensions(): { rows: number; cols: number } {
        return {
            rows: this.terrainGrid.length,
            cols: this.terrainGrid[0]?.length ?? 0
        };
    }

    // Getter for the grid itself for saving/rendering
    getGrid(): TerrainType[][] {
        return this.terrainGrid;
    }

    // Setter for loading
    setGrid(grid: TerrainType[][]): void {
        // Basic validation
        const expectedCols = Math.ceil(this.worldWidth / this.tileSize);
        const expectedRows = Math.ceil(this.worldHeight / this.tileSize);
        if (grid.length !== expectedRows || (grid[0]?.length ?? 0) !== expectedCols) {
             console.warn(`Loaded terrain grid dimensions (${grid.length}x${grid[0]?.length ?? 0}) mismatch expected (${expectedRows}x${expectedCols}). Resetting to default.`);
             this.initializeTerrainGrid();
        } else {
            this.terrainGrid = grid;
        }
    }
} 