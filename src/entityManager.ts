import { AssetLoader } from './assets';
import { AudioPlayer } from './audio';
import { Item, ItemType, getItemConfig } from './item';
import { PlaceableObjectType, PLACEABLE_OBJECT_CONFIG } from './ui/creativeModeSelector';
import { Tree } from './tree';
import { House } from './house';
import { DroppedItem } from './droppedItem'; // Assuming DroppedItem interface is moved here or imported

// Define BoundingBox locally or import if moved to a utility file
interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class EntityManager {
    public staticObjects: (Tree | House)[] = [];
    public droppedItems: DroppedItem[] = [];

    constructor(private assetLoader: AssetLoader, private audioPlayer: AudioPlayer) {}

    addStaticObject(obj: Tree | House): void {
        this.staticObjects.push(obj);
    }

    removeStaticObject(objToRemove: Tree | House): void {
        this.staticObjects = this.staticObjects.filter(obj => obj !== objToRemove);
        console.log(`Removed object at (${objToRemove.x.toFixed(0)}, ${objToRemove.y.toFixed(0)})`);
    }

     removeDroppedItem(itemToRemove: DroppedItem): void {
        this.droppedItems = this.droppedItems.filter(item => item !== itemToRemove);
    }


    spawnDroppedItem(itemId: string, x: number, y: number, quantity: number): void {
        const itemConfig = getItemConfig(itemId);
        if (itemConfig) {
            const droppedItem: DroppedItem = {
                itemConfig: itemConfig,
                x: x,
                y: y,
                quantity: quantity
            };
            // Ensure asset is loaded before adding (might already be)
            this.assetLoader.loadImages([itemConfig.assetPath]).then(() => {
                 this.droppedItems.push(droppedItem);
                 console.log(`Spawned ${quantity} ${itemConfig.name}(s) at (${x.toFixed(1)}, ${y.toFixed(1)})`);
                 this.audioPlayer.play('item-drop');
            }).catch(err => {
                console.error(`Failed to load asset for dropped item ${itemId}:`, err);
            });

        } else {
            console.error(`Could not find config for dropped item ID: ${itemId}`);
        }
    }

    destroyTreeAndSpawnLogs(treeToDestroy: Tree): void {
        console.log(`Destroying fallen tree at (${treeToDestroy.x.toFixed(0)}, ${treeToDestroy.y.toFixed(0)})`);
        const destroyedTreeX = treeToDestroy.x;
        const destroyedTreeY = treeToDestroy.y;

        // Remove the tree
        this.removeStaticObject(treeToDestroy); // Use the helper method
        console.log("Fallen tree removed from scene.");

        // Spawn WoodLog Item
        this.spawnDroppedItem('wood_log', destroyedTreeX, destroyedTreeY, 1); // Use the helper method
    }

    // Helper to find the first static object whose bounding box contains the point (x, y)
    getObjectAt(x: number, y: number): Tree | House | null {
        for (const obj of this.staticObjects) {
            const halfWidth = obj.width / 2;
            const halfHeight = obj.height / 2;
            const isInside = (
                x >= obj.x - halfWidth && x <= obj.x + halfWidth &&
                y >= obj.y - halfHeight && y <= obj.y + halfHeight
            );
            if (isInside) {
                return obj;
            }
        }
        return null;
    }

     // Helper for simple collision check (moved from GameplayController for potential reuse)
    static checkCollision(rect1: BoundingBox, rect2: BoundingBox): boolean {
        const halfWidth1 = rect1.width / 2;
        const halfHeight1 = rect1.height / 2;
        const halfWidth2 = rect2.width / 2;
        const halfHeight2 = rect2.height / 2;

        const collisionX = (rect1.x - halfWidth1 < rect2.x + halfWidth2) && (rect1.x + halfWidth1 > rect2.x - halfWidth2);
        const collisionY = (rect1.y - halfHeight1 < rect2.y + halfHeight2) && (rect1.y + halfHeight1 > rect2.y - halfHeight2);

        return collisionX && collisionY;
    }

    // --- Initialization/Reset ---
     populateTrees(count: number, worldWidth: number, worldHeight: number): void {
         const treeConfig = PLACEABLE_OBJECT_CONFIG['Tree'];
         if (!treeConfig) return;
         const treeAssetPath = treeConfig.assetPath;

         // Load the specific image needed
         this.assetLoader.loadImage(treeAssetPath).then(treeImg => {
             if (!treeImg) { // Check if loading actually succeeded
                 console.error("Failed to load tree image for population.");
                 return;
             }

             const treeWidth = treeImg.naturalWidth;
             const treeHeight = treeImg.naturalHeight;
             const spawnWidth = worldWidth;
             const spawnHeight = worldHeight;
             const padding = 50;

             for (let i = 0; i < count; i++) {
                 let x, y, validPosition;
                 let attempts = 0; // Prevent infinite loops
                 do {
                     validPosition = true;
                     x = Math.random() * (spawnWidth - treeWidth - padding * 2) + padding + treeWidth / 2;
                     y = Math.random() * (spawnHeight - treeHeight - padding * 2) + padding + treeHeight / 2;

                     // Check distance from center
                     const distToCenterSq = Math.pow(x - spawnWidth / 2, 2) + Math.pow(y - spawnHeight / 2, 2);
                     if (distToCenterSq < Math.pow(padding * 3, 2)) {
                         validPosition = false;
                         continue;
                     }

                     // Check collision with existing trees
                     const treeBounds = { x, y, width: treeWidth, height: treeHeight };
                     for(const existingTree of this.staticObjects) {
                         if (existingTree instanceof Tree) {
                             const existingBounds = {x: existingTree.x, y: existingTree.y, width: existingTree.width, height: existingTree.height};
                             if (EntityManager.checkCollision(treeBounds, existingBounds)) {
                                 validPosition = false;
                                 break;
                             }
                         }
                     }
                     attempts++;

                 } while (!validPosition && attempts < 100); // Limit attempts

                 if (validPosition) {
                    this.addStaticObject(new Tree(x, y, treeWidth, treeHeight));
                 } else {
                     console.warn("Could not find valid position for tree after 100 attempts.");
                 }
             }
             console.log(`Populated scene with up to ${count} trees.`);
         }).catch(err => {
              console.error("Error loading tree asset during population:", err);
         });

    }

    clearAll(): void {
        this.staticObjects = [];
        this.droppedItems = [];
        console.log("Cleared entities.");
    }
} 