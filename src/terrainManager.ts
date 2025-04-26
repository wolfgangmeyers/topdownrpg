import { TerrainType, TERRAIN_CONFIG, getTerrainConfig, TerrainConfig } from './terrain';

export class TerrainManager {
    public terrainGrid: TerrainType[][] = [];
    private worldWidth: number;
    private worldHeight: number;
    private tileSize: number;
    private rows: number;
    private cols: number;

    constructor(worldWidth: number, worldHeight: number, tileSize: number) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.tileSize = tileSize;
        this.rows = Math.ceil(this.worldHeight / this.tileSize);
        this.cols = Math.ceil(this.worldWidth / this.tileSize);
        this.initializeTerrainGrid();
    }

    initializeTerrainGrid(): void {
        this.terrainGrid = [];
        for (let y = 0; y < this.rows; y++) {
            this.terrainGrid[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.terrainGrid[y][x] = TerrainType.GRASS;
            }
        }
        console.log(`Initialized ${this.rows}x${this.cols} terrain grid with 'grass'.`);
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
            rows: this.rows,
            cols: this.cols
        };
    }

    // Getter for the grid itself for saving/rendering
    public getGrid(): Readonly<TerrainType[][]> {
        return this.terrainGrid;
    }

    // Setter for loading
    public setGrid(newGrid: TerrainType[][]): void {
        // Validate the incoming grid structure minimally
        if (!Array.isArray(newGrid) || newGrid.length === 0 || !Array.isArray(newGrid[0])) {
            console.error("Failed to set terrain grid: Invalid grid format provided.");
            // Fallback to default dimensions and initialize
            this.rows = Math.ceil(this.worldHeight / this.tileSize); // Use original default dims
            this.cols = Math.ceil(this.worldWidth / this.tileSize);
            this.initializeTerrainGrid();
            return;
        }
        
        // Update internal dimensions based on the loaded grid
        const newRows = newGrid.length;
        const newCols = newGrid[0].length;
        this.rows = newRows;
        this.cols = newCols;
        
        // Assign the loaded grid
        this.terrainGrid = newGrid;
        console.log(`Terrain grid set from loaded data. New dimensions: ${this.rows}x${this.cols}`);
    }

    // Method to resize the grid and re-initialize (used for specific scenes like interiors)
    public resizeGrid(newRows: number, newCols: number): void {
        console.log(`Resizing terrain grid to ${newRows}x${newCols}`);
        // Update stored dimensions
        this.rows = newRows;
        this.cols = newCols;
        // Re-initialize the grid array with new dimensions (defaults to grass)
        this.initializeTerrainGrid(); 
    }

    // Method to fill the entire grid with a specific terrain type
    public fillGridWith(terrainType: TerrainType): void {
        console.log(`Filling terrain grid with ${terrainType}`);
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.terrainGrid[y][x] = terrainType;
            }
        }
    }
} 