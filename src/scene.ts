import { Renderer } from './renderer';
import { InputHandler } from './input';
import { AssetLoader } from './assets';
import { Player } from './player';
import { Tree } from './tree';
import { House } from './house';
import { PlaceableObjectType, PLACEABLE_OBJECT_CONFIG } from './ui/creativeModeSelector';
import { saveSceneState, loadSceneState } from './db';
import { Item, ItemType, getItemConfig } from './item'; // Import Item types and getter
import { AudioPlayer } from './audio'; // Import AudioPlayer
import { TerrainType, TERRAIN_CONFIG, getTerrainConfig, TerrainConfig } from './terrain'; // Import terrain types and config
import { SceneRenderer } from './sceneRenderer';
import { Game } from './game'; // Import Game
import { DoorExit } from './doorExit'; // Import DoorExit
import { BiomeManager, BiomeType } from './biomes'; // Import BiomeManager

// --- Dropped Item Structure ---
export interface DroppedItem {
    itemConfig: Item; // Reference to the item config
    x: number;
    y: number;
    quantity: number; // Usually 1 for non-stackable on ground, but allows potential stacking
}
// --- End Dropped Item Structure ---

// Define structure for saved objects
interface SavedObjectState {
    type: PlaceableObjectType;
    x: number;
    y: number;
    currentHealth?: number; // Optional health
}

// This interface should match the structure used in db.ts save/load helpers
// It doesn't need the 'id' property itself, that's handled by the keyPath/key
interface SavedSceneState {
    objects: SavedObjectState[];
    droppedItems?: Array<{itemId: string, x: number, y: number, quantity: number}>;
    terrainGrid?: TerrainType[][]; // Add terrain grid to save state
    // Adjacent scene references
    northSceneId?: string | null;
    eastSceneId?: string | null;
    southSceneId?: string | null;
    westSceneId?: string | null;
    // Could add other scene-specific data here later (e.g., background type)
}

// --- Import New Modules ---
import { EntityManager } from './entityManager';
import { TerrainManager } from './terrainManager';
import { SceneStateManager } from './sceneStateManager';
import { GameplayController } from './gameplayController';
import { CreativeController, PlacementPreviewInfo, HighlightInfo } from './creativeController'; // Import interfaces too

// Define BoundingBox interface locally if not imported globally
// Must match the structure used in Renderer/SceneRenderer
interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
interface DebugBound {
    box: BoundingBox;
    color: string;
}

export abstract class Scene {
    protected game: Game; // Add reference to Game instance
    protected renderer: Renderer;
    protected inputHandler: InputHandler;
    protected assetLoader: AssetLoader;
    protected player: Player;
    protected audioPlayer: AudioPlayer;
    protected readonly sceneId: string;
    
    // Maybe add generic game object list later
    // protected gameObjects: any[] = [];

    constructor(sceneId: string, game: Game, renderer: Renderer, inputHandler: InputHandler, assetLoader: AssetLoader, player: Player, audioPlayer: AudioPlayer) {
        this.sceneId = sceneId;
        this.game = game; // Store Game instance
        this.renderer = renderer;
        this.inputHandler = inputHandler;
        this.assetLoader = assetLoader;
        this.player = player;
        this.audioPlayer = audioPlayer;
    }

    public getId(): string {
        return this.sceneId;
    }

    abstract load(): Promise<void>;
    abstract update(deltaTime: number, creativeModeEnabled: boolean, selectedObjectType: PlaceableObjectType | null, selectedTerrainType: TerrainType | null, selectedItemId: string | null): void;
    abstract draw(creativeModeEnabled: boolean, selectedObjectType: PlaceableObjectType | null, selectedTerrainType: TerrainType | null, selectedItemId: string | null): void;
    abstract save(): Promise<void>; // Add save method requirement
    abstract getWorldDimensions(): { width: number; height: number }; // Add requirement for dimensions
    abstract getTileSize(): number; // Add requirement for tile size
}

export class GameScene extends Scene {
    private staticObjects: (Tree | House)[] = [];
    private droppedItems: DroppedItem[] = []; // List of items on the ground
    private readonly worldWidth: number = 1500; // Example world width - Should be multiple of tileSize
    private readonly worldHeight: number = 1500; // Example world height - Should be multiple of tileSize
    public readonly tileSize: number = 64; // Define tile size
    private terrainGrid: TerrainType[][] = []; // 2D array for terrain types

    // --- Adjacent Scene References ---
    public northSceneId: string | null = null;
    public eastSceneId: string | null = null;
    public southSceneId: string | null = null;
    public westSceneId: string | null = null;
    // --- End Adjacent Scene References ---

    // --- Interaction Properties --- 
    private closestPickupItem: DroppedItem | null = null;
    private readonly pickupRange: number = 50; // Max distance to show pickup prompt
    // --- End Interaction Properties ---

    // --- Action Cooldown --- 
    private lastActionTime: number = 0;
    private readonly actionCooldown: number = 500; // Milliseconds between actions (e.g., axe swings)
    // --- End Action Cooldown ---

    // --- Managers and Controllers ---
    private entityManager: EntityManager;
    private terrainManager: TerrainManager;
    private stateManager: SceneStateManager;
    private gameplayController: GameplayController;
    private creativeController: CreativeController;
    private sceneRenderer: SceneRenderer;
    private biomeManager: BiomeManager;
    // --- End Managers ---
    private contextData: any; // Store context passed during scene change

    constructor(
        sceneId: string, 
        game: Game, 
        renderer: Renderer, 
        inputHandler: InputHandler, 
        assetLoader: AssetLoader, 
        player: Player, 
        audioPlayer: AudioPlayer,
        contextData?: any // Add optional contextData parameter
    ) {
        super(sceneId, game, renderer, inputHandler, assetLoader, player, audioPlayer);
        this.contextData = contextData; // Store the context

        // Instantiate Managers/Controllers
        this.entityManager = new EntityManager(assetLoader, audioPlayer);
        this.terrainManager = new TerrainManager(this.worldWidth, this.worldHeight, this.tileSize);
        this.stateManager = new SceneStateManager(this.entityManager, this.terrainManager, assetLoader, this);
        
        // Create the biome manager
        this.biomeManager = new BiomeManager(
            this.terrainManager,
            this.entityManager,
            this.worldWidth,
            this.worldHeight,
            this.tileSize
        );
        
        // Create the controllers
        this.gameplayController = new GameplayController(
            game, 
            inputHandler, 
            player, 
            this.entityManager, 
            this.terrainManager, 
            audioPlayer, 
            this.worldWidth, 
            this.worldHeight, 
            this.tileSize
        );
        
        this.creativeController = new CreativeController(
            inputHandler, 
            this.entityManager, 
            this.terrainManager, 
            assetLoader, 
            this.tileSize
        );
        
        this.sceneRenderer = new SceneRenderer(
            renderer, 
            assetLoader, 
            this.entityManager, 
            this.terrainManager, 
            player, 
            this.worldWidth, 
            this.worldHeight, 
            this.tileSize
        );
    }

    // --- Get World Dimensions --- 
    public getWorldDimensions(): { width: number; height: number } {
        // Return dimensions based on the current state of TerrainManager
        const dims = this.terrainManager.getGridDimensions();
        return {
            width: dims.cols * this.tileSize,
            height: dims.rows * this.tileSize
        };
    }
    // --- End Get World Dimensions ---

    // --- Get Tile Size --- 
    public getTileSize(): number {
        return this.tileSize;
    }
    // --- End Get Tile Size ---

    async load(): Promise<void> {
        try {
            console.log(`GameScene [${this.sceneId}]: Loading common assets...`);
            const terrainAssetPaths = Object.values(TERRAIN_CONFIG).map((config: TerrainConfig) => config.assetPath);
            await this.assetLoader.loadImages(terrainAssetPaths);
            console.log(`Loaded terrain tile assets for [${this.sceneId}]:`, terrainAssetPaths);

            // Attempt to load saved state
            const loadedSuccessfully = await this.stateManager.loadState(this.sceneId);

            if (!loadedSuccessfully) {
                console.log(`GameScene [${this.sceneId}]: No saved state found. Generating default layout...`);
                this.generateDefaultLayout(); // Call helper method
            } else {
                console.log(`GameScene [${this.sceneId}] loaded from saved state.`);
            }

            // Fallback: Ensure default terrain exists even if state load fails partially
            if (this.terrainManager.getGrid().length === 0) {
                 console.warn(`GameScene [${this.sceneId}]: Forcing terrain grid initialization after load error.`);
                 this.terrainManager.initializeTerrainGrid();
            }
        } catch (error) {
            console.error(`Failed to load GameScene [${this.sceneId}] assets or state:`, error);
            if (this.terrainManager.getGrid().length === 0) {
                 console.warn(`GameScene [${this.sceneId}]: Forcing terrain grid initialization after load error.`);
                 this.terrainManager.initializeTerrainGrid();
            }
        }
        
        // --- Update SceneRenderer with potentially new dimensions --- 
        const currentDimensions = this.getWorldDimensions();
        this.sceneRenderer.updateWorldDimensions(currentDimensions.width, currentDimensions.height);
        // --- End Update --- 
    }
    
    // --- Helper for Default Layout Generation --- 
    private generateDefaultLayout(): void {
        this.entityManager.clearAll();
        
        if (this.sceneId.startsWith('interior-')) {
            console.log(`Generating default interior layout for ${this.sceneId}...`);
            const interiorRows = 10;
            const interiorCols = 10;
            
            this.terrainManager.resizeGrid(interiorRows, interiorCols);
            this.terrainManager.fillGridWith(TerrainType.WOOD_FLOOR);

            const exitX = (interiorCols / 2) * this.tileSize; 
            const exitY = (interiorRows - 1) * this.tileSize + this.tileSize / 2; 
            
            const doorConfig = PLACEABLE_OBJECT_CONFIG['DoorExit'];
            console.log(`DoorExit config:`, doorConfig);
            
            if (doorConfig) {
                // Ensure the asset is loaded
                this.assetLoader.loadImage(doorConfig.assetPath)
                    .then(doorImg => {
                        console.log(`DoorExit asset loaded: ${doorConfig.assetPath}, dimensions: ${doorImg.naturalWidth}x${doorImg.naturalHeight}`);
                        
                        const doorWidth = doorImg.naturalWidth;
                        const doorHeight = doorImg.naturalHeight;
                        const exitDoor = new DoorExit(exitX, exitY, doorWidth, doorHeight);
                        
                        // Set the exit target using contextData passed during scene change
                        if (this.contextData && this.contextData.originSceneId && this.contextData.exitTargetPosition) {
                            exitDoor.setTarget(this.contextData.originSceneId, this.contextData.exitTargetPosition);
                            console.log(`Set DoorExit target to scene: ${this.contextData.originSceneId}, position: (${this.contextData.exitTargetPosition.x.toFixed(0)}, ${this.contextData.exitTargetPosition.y.toFixed(0)})`);
                        } else {
                            console.warn(`Missing contextData for DoorExit in ${this.sceneId}:`, this.contextData);
                        }

                        this.entityManager.addStaticObject(exitDoor);
                        console.log(`Added DoorExit to entityManager at (${exitX.toFixed(0)}, ${exitY.toFixed(0)})`);
                    })
                    .catch(err => {
                        console.error(`Failed to load DoorExit asset: ${doorConfig.assetPath}`, err);
                    });
            } else {
                console.error(`Missing DoorExit configuration in PLACEABLE_OBJECT_CONFIG`);
            }
        } else if (this.sceneId.startsWith('world-')) {
            // World grid scene - use BiomeManager to generate a sparse forest biome
            console.log(`Generating biome layout for world scene: ${this.sceneId}`);
            
            // Generate the sparse forest biome using BiomeManager, passing a callback for scene linking
            this.biomeManager.generateBiome(
                BiomeType.SPARSE_FOREST, 
                this.contextData,
                (direction, linkedSceneId) => this.setAdjacentSceneId(direction, linkedSceneId)
            );
        } else {
            // Handle any other scene types (legacy support) - also use sparse forest biome
            console.log(`Generating biome layout for legacy scene: ${this.sceneId}`);
            
            // Use the same biome manager for legacy scenes
            this.biomeManager.generateBiome(
                BiomeType.SPARSE_FOREST, 
                this.contextData,
                (direction, linkedSceneId) => this.setAdjacentSceneId(direction, linkedSceneId)
            );
        }
    }
    // --- End Default Layout ---

    update(deltaTime: number, creativeModeEnabled: boolean, selectedObjectType: PlaceableObjectType | null, selectedTerrainType: TerrainType | null, selectedItemId: string | null): void {
        // Delegate based on mode
        if (creativeModeEnabled) {
            this.creativeController.update(selectedObjectType, selectedTerrainType, selectedItemId);
        } else {
            this.gameplayController.update(deltaTime);
        }

        // Always update player (rotation, animation state)
        this.player.update(deltaTime, this.inputHandler.mousePosition); // Assumes player update is independent of mode controllers

        // Update camera position (handled by SceneRenderer now)
        this.sceneRenderer.updateCamera();
    }

    draw(creativeModeEnabled: boolean, selectedObjectType: PlaceableObjectType | null, selectedTerrainType: TerrainType | null, selectedItemId: string | null): void {
        // Get necessary state for drawing
        const closestPickupItem = creativeModeEnabled ? null : this.gameplayController.getClosestPickupItem();
        const placementPreview = creativeModeEnabled ? this.creativeController.getPlacementPreviewInfo(selectedObjectType, selectedTerrainType, selectedItemId) : null;
        const highlightObject = creativeModeEnabled ? this.creativeController.getHighlightObjectInfo() : null;
        
        let debugBoundsToShow: DebugBound[] = []; // Initialize empty array

        // Calculate debug bounds ONLY if in creative mode
        if (creativeModeEnabled) {
             // Iterate through static objects managed by EntityManager
             this.entityManager.staticObjects.forEach(obj => {
                 if (obj instanceof House) {
                     const house = obj;
                     // 1. Calculate Orange Collision Bounds (Shorter)
                     const collisionHeight = house.height - 10;
                     const orangeBounds: BoundingBox = {
                         x: house.x,
                         y: house.y - 5, // Adjusted center
                         width: house.width,
                         height: collisionHeight
                     };
                     debugBoundsToShow.push({ box: orangeBounds, color: 'orange' });

                     // 2. Calculate Cyan Door Trigger Bounds (Extended)
                     const doorWidth = house.width / 4;
                     const doorTopMargin = 15;
                     const doorBottomMargin = 60;
                     const houseBottomY = house.y + house.height / 2;
                     const doorTopY = houseBottomY - doorTopMargin;
                     const doorBottomY = houseBottomY + doorBottomMargin;
                     const doorHeight = doorBottomY - doorTopY;
                     const doorX = house.x - doorWidth / 2 + 20;
                     const cyanBounds: BoundingBox = { x: doorX, y: doorTopY, width: doorWidth, height: doorHeight };
                     debugBoundsToShow.push({ box: cyanBounds, color: 'cyan' });
                 }
             });
        }

        // Delegate drawing to SceneRenderer
        this.sceneRenderer.drawScene(
            creativeModeEnabled,
            closestPickupItem,
            placementPreview,
            highlightObject,
            debugBoundsToShow // Pass the calculated or empty bounds
        );

        // Note: Core renderer (for inventory UI) is drawn separately in Game.ts
    }

    // Implement the required save method
    async save(): Promise<void> {
        await this.stateManager.saveState(this.sceneId);
    }

    // --- Public method to facilitate dropping items from inventory UI (called by Game.ts) ---
     public spawnDroppedItemNearPlayer(itemId: string, quantity: number): void {
         // Spawn item slightly in front of the player
         const dropDistance = 30;
         const angle = this.player.rotation - Math.PI / 2; // Adjust rotation
         const dropX = this.player.x + Math.cos(angle) * dropDistance;
         const dropY = this.player.y + Math.sin(angle) * dropDistance;
         this.entityManager.spawnDroppedItem(itemId, dropX, dropY, quantity);
     }
    // --- End Public Method ---

    // --- Adjacent Scene Methods ---
    public getAdjacentSceneId(direction: 'north' | 'east' | 'south' | 'west'): string | null {
        let result: string | null = null;
        switch (direction) {
            case 'north': result = this.northSceneId; break;
            case 'east': result = this.eastSceneId; break;
            case 'south': result = this.southSceneId; break;
            case 'west': result = this.westSceneId; break;
        }
        return result;
    }

    public setAdjacentSceneId(direction: 'north' | 'east' | 'south' | 'west', sceneId: string | null): void {
        switch (direction) {
            case 'north': this.northSceneId = sceneId; break;
            case 'east': this.eastSceneId = sceneId; break;
            case 'south': this.southSceneId = sceneId; break;
            case 'west': this.westSceneId = sceneId; break;
        }
    }
    // --- End Adjacent Scene Methods ---

    // --- REMOVED METHODS (moved to other classes) ---
    // All private methods related to drawing, input handling, state management, etc., are now removed.
} 