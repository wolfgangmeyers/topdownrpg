import { InputHandler } from './input';
import { EntityManager } from './entityManager';
import { TerrainManager } from './terrainManager';
import { AssetLoader } from './assets';
import { PlaceableObjectType, PLACEABLE_OBJECT_CONFIG } from './ui/creativeModeSelector';
import { TerrainType, getTerrainConfig } from './terrain';
import { getItemConfig } from './item'; // For item preview
import { Tree } from './tree'; // For type checking
import { House } from './house'; // For type checking
import { DoorExit } from './doorExit'; // Import DoorExit
import { deleteSceneState } from './db'; // Import scene delete function
// Removed Renderer import

// Data structure for placement preview info
// (Could be defined globally or passed around)
export interface PlacementPreviewInfo {
    type: 'object' | 'terrain' | 'item';
    path: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

// Data structure for highlight info
export interface HighlightInfo {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class CreativeController {
    constructor(
        private inputHandler: InputHandler,
        private entityManager: EntityManager,
        private terrainManager: TerrainManager,
        private assetLoader: AssetLoader, // May need for object dimensions
        private tileSize: number
    ) {}

    update(selectedObjectType: PlaceableObjectType | null, selectedTerrainType: TerrainType | null, selectedItemId: string | null): void {
        const mouseWorldX = this.inputHandler.mousePosition.x;
        const mouseWorldY = this.inputHandler.mousePosition.y;

        // --- Handle Deletion ---
        if (this.inputHandler.deletePressed) {
             const objectToRemove = this.entityManager.getObjectAt(mouseWorldX, mouseWorldY);
             if (objectToRemove) {
                 // Check if it's a House before removing
                 if (objectToRemove instanceof House) {
                     const house = objectToRemove;
                     const interiorSceneId = `interior-${house.id}`;
                     console.log(`Deleting House ID: ${house.id}. Attempting to delete associated scene: ${interiorSceneId}`);
                     // Asynchronously delete the scene state, don't necessarily wait
                     deleteSceneState(interiorSceneId).catch(err => {
                         console.error(`Failed to delete interior scene [${interiorSceneId}] for deleted house:`, err);
                     });
                 }
                 // Remove the object itself from the current scene
                 this.entityManager.removeStaticObject(objectToRemove);
             }
             // Reset flag immediately after processing to prevent multi-delete
             // (Though resetFrameState also handles this later)
             // this.inputHandler.deletePressed = false; // Already handled by resetFrameState
        }

        // --- Handle Placement ---
        if (this.inputHandler.mouseClicked) { // InputHandler already handles consumed clicks
             // Check if clicking on an existing object (prevents placing *on*)
             const clickedExistingObject = !!this.entityManager.getObjectAt(mouseWorldX, mouseWorldY);

             if (!clickedExistingObject) {
                 // Prioritize placing selected object
                 if (selectedObjectType) {
                     this.placeObjectAt(mouseWorldX, mouseWorldY, selectedObjectType);
                 }
                 // Otherwise, place terrain
                 else if (selectedTerrainType) {
                     this.terrainManager.placeTerrainAt(mouseWorldX, mouseWorldY, selectedTerrainType);
                 }
                 // Otherwise, spawn item
                 else if (selectedItemId) {
                     this.entityManager.spawnDroppedItem(selectedItemId, mouseWorldX, mouseWorldY, 1);
                 }
             }
        }
    }


    private placeObjectAt(x: number, y: number, objectType: PlaceableObjectType): void {
        const config = PLACEABLE_OBJECT_CONFIG[objectType];
        if (!config) {
            console.warn('Unknown object config type:', objectType);
            return;
        }

        const objImg = this.assetLoader.getImage(config.assetPath);
        if (!objImg) {
            console.warn('Asset not loaded for placing object:', objectType);
            return; // Ensure asset is loaded
        }

        // Use the natural SVG dimensions for placement
        const objWidth = objImg.naturalWidth;
        const objHeight = objImg.naturalHeight;

        let newObject: Tree | House | DoorExit | null = null; // Add DoorExit to type
        if (objectType === 'Tree') {
            newObject = new Tree(x, y, objWidth, objHeight);
        } else if (objectType === 'House') {
            newObject = new House(x, y, objWidth, objHeight);
        } else if (objectType === 'DoorExit') { // Handle DoorExit placement
            newObject = new DoorExit(x, y, objWidth, objHeight);
        }

        if (newObject) {
             // Check collision before adding (using EntityManager helper)
             let collisionDetected = false;
             const newObjectBounds: BoundingBox = { x: newObject.x, y: newObject.y, width: newObject.width, height: newObject.height };
             for (const existingObj of this.entityManager.staticObjects) {
                 const existingObjBounds: BoundingBox = { x: existingObj.x, y: existingObj.y, width: existingObj.width, height: existingObj.height };
                 if (EntityManager.checkCollision(newObjectBounds, existingObjBounds)) {
                     collisionDetected = true;
                     break;
                 }
             }

             if (!collisionDetected) {
                this.entityManager.addStaticObject(newObject); // Use method in EntityManager
                console.log(`Placed ${objectType} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
             } else {
                console.log(`Placement blocked for ${objectType} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
                // Optional: Play a 'cannot place' sound or show visual feedback
             }
        } else {
             console.warn('Failed to create object instance for:', objectType);
        }
    }

    // --- Getters for Preview Info (used by SceneRenderer) ---

    getPlacementPreviewInfo(selectedObjectType: PlaceableObjectType | null, selectedTerrainType: TerrainType | null, selectedItemId: string | null): PlacementPreviewInfo | null {
        const mouseX = this.inputHandler.mousePosition.x;
        const mouseY = this.inputHandler.mousePosition.y;

        if (selectedObjectType) {
            const config = PLACEABLE_OBJECT_CONFIG[selectedObjectType];
            if (config && config.assetPath) {
                const img = this.assetLoader.getImage(config.assetPath);
                if (img) return { type: 'object', path: config.assetPath, x: mouseX, y: mouseY, width: img.naturalWidth, height: img.naturalHeight };
            }
        } else if (selectedTerrainType) {
            const config = getTerrainConfig(selectedTerrainType);
            if (config && config.assetPath) {
                const img = this.assetLoader.getImage(config.assetPath);
                if (img) {
                    const gridX = Math.floor(mouseX / this.tileSize);
                    const gridY = Math.floor(mouseY / this.tileSize);
                    const previewX = gridX * this.tileSize + this.tileSize / 2;
                    const previewY = gridY * this.tileSize + this.tileSize / 2;
                    return { type: 'terrain', path: config.assetPath, x: previewX, y: previewY, width: this.tileSize, height: this.tileSize };
                }
            }
        } else if (selectedItemId) {
            const config = getItemConfig(selectedItemId);
            if (config && config.assetPath) {
                const img = this.assetLoader.getImage(config.assetPath);
                if (img) {
                    const itemWidth = img.naturalWidth * 0.8;
                    const itemHeight = img.naturalHeight * 0.8;
                    return { type: 'item', path: config.assetPath, x: mouseX, y: mouseY, width: itemWidth, height: itemHeight };
                }
            }
        }
        return null;
    }

    getHighlightObjectInfo(): HighlightInfo | null {
        const mouseX = this.inputHandler.mousePosition.x;
        const mouseY = this.inputHandler.mousePosition.y;
        const obj = this.entityManager.getObjectAt(mouseX, mouseY);
        if (obj) {
            return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
        }
        return null;
    }

}

// (Define BoundingBox interface if not imported/global)
// TODO: Move BoundingBox to a shared location (e.g., utils.ts)
interface BoundingBox { 
    x: number; 
    y: number; 
    width: number; 
    height: number; 
} 