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
}
// --- End Interfaces ---

export class SceneStateManager {
    constructor(
        private entityManager: EntityManager,
        private terrainManager: TerrainManager,
        private assetLoader: AssetLoader // Needed to load assets for loaded objects/items
    ) {}

    async saveState(sceneId: string): Promise<void> {
        console.log(`Attempting to save scene [${sceneId}]...`);
        try {
            // Serialize Static Objects
            const savedObjects: SavedObjectState[] = this.entityManager.staticObjects.map(obj => {
                let type: PlaceableObjectType;
                let state: Partial<SavedObjectState> = { x: obj.x, y: obj.y };

                if (obj instanceof Tree) {
                    type = 'Tree';
                    state.currentHealth = obj.currentHealth; // Safe: obj is Tree here
                } else if (obj instanceof House) {
                    type = 'House';
                    state.id = obj.id; // Save the House ID
                } else if (obj instanceof DoorExit) {
                    type = 'DoorExit';
                    // Save target info if it exists
                    if (obj.targetSceneId) state.targetSceneId = obj.targetSceneId;
                    if (obj.targetPosition) state.targetPosition = obj.targetPosition;
                } else {
                    console.warn('Unknown object type during save:', obj);
                    return null; // Skip
                }
                state.type = type;
                return state as SavedObjectState;
            }).filter(obj => obj !== null) as SavedObjectState[];

            // Serialize Dropped Items
            const savedDroppedItems: SavedDroppedItemState[] = this.entityManager.droppedItems.map(drop => ({
                itemId: drop.itemConfig.id,
                x: drop.x,
                y: drop.y,
                quantity: drop.quantity
            }));

            // Get Terrain Grid
            const terrainGrid = this.terrainManager.getGrid();

            const sceneState: SavedSceneState = {
                objects: savedObjects,
                droppedItems: savedDroppedItems,
                terrainGrid: terrainGrid.map(row => [...row]) 
            };

            await dbSave(sceneId, sceneState);
             // Success log is in dbSave

        } catch (error) {
            console.error(`Failed to save scene state for [${sceneId}]:`, error);
        }
    }

    // Returns true if load was successful, false otherwise
    async loadState(sceneId: string): Promise<boolean> {
        console.log(`Attempting to load scene [${sceneId}] from DB...`);
        try {
            const loadedState = await dbLoad(sceneId) as SavedSceneState | null;

            if (!loadedState) {
                console.log(`No saved state found for scene [${sceneId}].`);
                return false; // Indicate defaults should be used
            }

            // Basic validation
            if (!loadedState || !Array.isArray(loadedState.objects) || !Array.isArray(loadedState.droppedItems) || !Array.isArray(loadedState.terrainGrid)) {
                console.error(`Invalid saved scene state format for [${sceneId}].`);
                // TODO: Consider deleting invalid data?
                return false;
            }

            // --- Clear existing state before loading ---
            this.entityManager.clearAll(); // Use clearAll method
            // Terrain grid handled by TerrainManager.setGrid below

            // --- Pre-load assets ---
            const requiredAssets = new Set<string>();
            loadedState.objects.forEach(objState => {
                const objectTypeKey = objState.type as PlaceableObjectType;
                const config = PLACEABLE_OBJECT_CONFIG[objectTypeKey];
                if (config) requiredAssets.add(config.assetPath);
                else console.warn(`Config not found for saved object type: ${objState.type}`);
            });
            loadedState.droppedItems.forEach(itemState => {
                const config = getItemConfig(itemState.itemId);
                if (config) requiredAssets.add(config.assetPath);
            });
            // Note: Terrain assets are loaded separately, typically during initial scene load.

            await this.assetLoader.loadImages(Array.from(requiredAssets));
            console.log('Required assets for saved state loaded.');

            // --- Load Static Objects ---
            console.log(`Loading ${loadedState.objects.length} objects...`);
            for (const savedObj of loadedState.objects) {
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
            console.log(`Loading ${loadedState.droppedItems.length} dropped items...`);
             for (const itemData of loadedState.droppedItems) {
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
            console.log(`Loading terrain grid (${loadedState.terrainGrid.length}x${loadedState.terrainGrid[0]?.length ?? 0}) from saved state...`);
            this.terrainManager.setGrid(loadedState.terrainGrid); // Let TerrainManager handle validation

            console.log(`Scene [${sceneId}] loaded successfully from state.`);
            return true; // Load successful

        } catch (error) {
            console.error(`Failed to load scene state for [${sceneId}]:`, error);
            return false; // Load failed
        }
    }
} 