import { EntityManager } from './entityManager';
import { TerrainManager } from './terrainManager';
import { AssetLoader } from './assets';
import { saveSceneState as dbSave, loadSceneState as dbLoad } from './db';
import { Item, ItemType, getItemConfig } from './item';
import { PlaceableObjectType, PLACEABLE_OBJECT_CONFIG } from './ui/creativeModeSelector';
import { Tree } from './tree';
import { House } from './house';
import { TerrainType } from './terrain'; // Import TerrainType
import { DroppedItem } from './droppedItem'; // Import directly
import { DoorExit } from './doorExit'; // Import DoorExit

// --- Interfaces for Saved State (Copied and refined from scene.ts) ---
interface SavedObjectState {
    type: PlaceableObjectType;
    x: number;
    y: number;
    id?: string; // For Houses
    targetSceneId?: string; // For DoorExit
    targetPosition?: { x: number; y: number }; // For DoorExit
    currentHealth?: number; // Optional for Trees
}

interface SavedDroppedItemState {
    itemId: string;
    x: number;
    y: number;
    quantity: number;
}

interface SavedSceneState {
    objects: SavedObjectState[];
    droppedItems: SavedDroppedItemState[];
    terrainGrid: TerrainType[][];
    // Add adjacent scene references
    northSceneId?: string | null;
    eastSceneId?: string | null;
    southSceneId?: string | null;
    westSceneId?: string | null;
}
// --- End Interfaces ---

export class SceneStateManager {
    constructor(
        private entityManager: EntityManager,
        private terrainManager: TerrainManager,
        private assetLoader: AssetLoader, // Needed to load assets for loaded objects/items
        private gameScene: any // Reference to the GameScene for accessing adjacent scene IDs
    ) {}

    async saveState(sceneId: string): Promise<void> {
        try {
            // Get all static objects (like trees, houses)
            const objects = this.entityManager.staticObjects.map(obj => {
                // Convert to serializable structure
                const savedObject: SavedObjectState = {
                    type: obj.constructor.name as PlaceableObjectType,
                    x: obj.x,
                    y: obj.y
                };
                // Conditionally add health for Tree objects
                if (obj instanceof Tree) {
                    const tree = obj as Tree;
                    // Only save health if the tree is damaged but not felled
                    if (tree.state === 'STANDING' && tree.currentHealth < tree.maxHealth) {
                        savedObject.currentHealth = tree.currentHealth;
                    }
                }
                // Save House ID
                else if (obj instanceof House) {
                    savedObject.id = (obj as House).id;
                }
                // Save DoorExit target information
                else if (obj instanceof DoorExit) {
                    const doorExit = obj as DoorExit;
                    if (doorExit.targetSceneId && doorExit.targetPosition) {
                        savedObject.targetSceneId = doorExit.targetSceneId;
                        savedObject.targetPosition = doorExit.targetPosition;
                    }
                }
                return savedObject;
            });

            // Get terrain grid
            const terrainGrid = this.terrainManager.getGrid().map(row => [...row]);

            // Get references to adjacent scenes
            const northSceneId = this.gameScene.northSceneId;
            const eastSceneId = this.gameScene.eastSceneId;
            const southSceneId = this.gameScene.southSceneId;
            const westSceneId = this.gameScene.westSceneId;

            // Get all DroppedItems
            const droppedItems = this.entityManager.droppedItems.map(item => {
                return {
                    itemId: item.itemConfig.id,
                    x: item.x,
                    y: item.y,
                    quantity: item.quantity
                };
            });

            // Create the full saved state object
            const savedState: SavedSceneState = {
                objects: objects,
                terrainGrid: terrainGrid,
                droppedItems: droppedItems,
                northSceneId,
                eastSceneId,
                southSceneId,
                westSceneId
            };

            // Save to database
            await dbSave(sceneId, savedState);
        } catch (error) {
            console.error(`Error saving state for scene [${sceneId}]:`, error);
            throw error; // Re-throw to allow caller to handle
        }
    }

    // Returns true if load was successful, false otherwise
    async loadState(sceneId: string): Promise<boolean> {
        try {
            // Attempt to load from database
            const savedState = await dbLoad(sceneId) as SavedSceneState | null;
            
            if (!savedState) {
                return false;
            }
            
            // Clear current entities
            this.entityManager.clearAll();
            
            // Restore adjacent scene references
            if (savedState.northSceneId !== undefined) {
                this.gameScene.northSceneId = savedState.northSceneId;
            }
            if (savedState.eastSceneId !== undefined) {
                this.gameScene.eastSceneId = savedState.eastSceneId;
            }
            if (savedState.southSceneId !== undefined) {
                this.gameScene.southSceneId = savedState.southSceneId;
            }
            if (savedState.westSceneId !== undefined) {
                this.gameScene.westSceneId = savedState.westSceneId;
            }
            
            // --- Pre-load assets ---
            const requiredAssets = new Set<string>();
            savedState.objects.forEach(objState => {
                const objectTypeKey = objState.type as PlaceableObjectType;
                const config = PLACEABLE_OBJECT_CONFIG[objectTypeKey];
                if (config) requiredAssets.add(config.assetPath);
                else console.warn(`Config not found for saved object type: ${objState.type}`);
            });
            savedState.droppedItems.forEach(itemState => {
                const config = getItemConfig(itemState.itemId);
                if (config) requiredAssets.add(config.assetPath);
            });
            // Note: Terrain assets are loaded separately, typically during initial scene load.

            await this.assetLoader.loadImages(Array.from(requiredAssets));
            console.log('Required assets for saved state loaded.');

            // --- Load Static Objects ---
            console.log(`Loading ${savedState.objects.length} objects...`);
            for (const savedObj of savedState.objects) {
                 const objectTypeKey = savedObj.type as PlaceableObjectType;
                 const config = PLACEABLE_OBJECT_CONFIG[objectTypeKey];
                if (!config) {
                    console.warn(`Config not found for saved object type: ${savedObj.type}`);
                    continue;
                }
                const objImg = this.assetLoader.getImage(config.assetPath);
                 if (!objImg) {
                     console.warn(`Asset not loaded for saved object type: ${savedObj.type}`);
                     continue; // Should not happen if pre-load worked
                 }
                const objWidth = objImg.naturalWidth;
                const objHeight = objImg.naturalHeight;
                let shouldAddObject = true; // Flag to control adding the object
                let objectInstance: Tree | House | DoorExit | null = null;

                if (savedObj.type === 'Tree') {
                     const initialHealth = savedObj.currentHealth;
                     objectInstance = new Tree(savedObj.x, savedObj.y, objWidth, objHeight, undefined, initialHealth);
                     // Type guard: Check health only if it IS a Tree
                     if (objectInstance instanceof Tree && objectInstance.currentHealth <= 0) {
                         console.log(`Skipping loaded tree with 0 health at (${objectInstance.x.toFixed(0)}, ${objectInstance.y.toFixed(0)})`);
                         shouldAddObject = false; // Don't add it
                     }
                 } else if (savedObj.type === 'House') {
                     objectInstance = new House(savedObj.x, savedObj.y, objWidth, objHeight, savedObj.id);
                 } else if (savedObj.type === 'DoorExit') {
                    objectInstance = new DoorExit(savedObj.x, savedObj.y, objWidth, objHeight);
                    // Restore target info if it exists in save data
                    if (savedObj.targetSceneId && savedObj.targetPosition) {
                        objectInstance.setTarget(savedObj.targetSceneId, savedObj.targetPosition);
                        console.log(`  Restored DoorExit target: Scene=${objectInstance.targetSceneId}, Pos=(${objectInstance.targetPosition?.x.toFixed(0)}, ${objectInstance.targetPosition?.y.toFixed(0)})`);
                    }
                 }

                 // Add the object instance if it was created and should be added
                 if (objectInstance && shouldAddObject) {
                     this.entityManager.addStaticObject(objectInstance);
                 }
            }

            // --- Load Dropped Items ---
            console.log(`Loading ${savedState.droppedItems.length} dropped items...`);
             for (const itemData of savedState.droppedItems) {
                 const itemConfig = getItemConfig(itemData.itemId);
                 if (itemConfig) {
                     const loadedDrop: DroppedItem = { // Use direct import now
                         itemConfig: itemConfig,
                         x: itemData.x,
                         y: itemData.y,
                         quantity: itemData.quantity
                     };
                     this.entityManager.droppedItems.push(loadedDrop); // Add directly for now, or use a method if complex logic needed
                 } else {
                     console.warn(`Item config not found for saved dropped item ID: ${itemData.itemId}. Skipping drop.`);
                 }
             }

            // --- Load Terrain Grid ---
            console.log(`Loading terrain grid (${savedState.terrainGrid.length}x${savedState.terrainGrid[0]?.length ?? 0}) from saved state...`);
            this.terrainManager.setGrid(savedState.terrainGrid); // Let TerrainManager handle validation

            console.log(`SceneStateManager: Successfully loaded state for scene [${sceneId}]`);
            return true;
        } catch (error) {
            console.error(`SceneStateManager: Error loading state for scene [${sceneId}]:`, error);
            return false;
        }
    }
} 