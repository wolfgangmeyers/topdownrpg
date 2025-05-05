import { Renderer } from './renderer';
import { AssetLoader } from './assets';
import { Player } from './player';
import { EntityManager } from './entityManager'; // Import EntityManager
import { DroppedItem } from './droppedItem'; // Import DroppedItem
import { TerrainManager } from './terrainManager';
import { Tree } from './tree'; // For instanceof check
import { House } from './house'; // For instanceof check
import { DoorExit } from './doorExit'; // Import DoorExit
import { PLACEABLE_OBJECT_CONFIG } from './ui/creativeModeSelector'; // Import object config
import { ItemType } from './item'; // For checking equipped item type
// Import the interfaces from CreativeController or a shared file
import { PlacementPreviewInfo, HighlightInfo } from './creativeController';
import { InputHandler } from './input'; // Import InputHandler

// --- Define structure for GameplayController debug bounds ---
// Must match the structure used in GameplayController
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
// --- End Debug Bounds structure ---

export class SceneRenderer {
    constructor(
        private coreRenderer: Renderer, // The low-level canvas renderer
        private assetLoader: AssetLoader,
        private entityManager: EntityManager,
        private terrainManager: TerrainManager,
        private player: Player,
        private worldWidth: number,
        private worldHeight: number,
        private tileSize: number,
        private inputHandler: InputHandler // Add input handler
    ) {}

    // Method to update the renderer's knowledge of world dimensions
    public updateWorldDimensions(newWidth: number, newHeight: number): void {
        console.log(`SceneRenderer updating world dimensions to: ${newWidth}x${newHeight}`);
        this.worldWidth = newWidth;
        this.worldHeight = newHeight;
        // Re-calculate initial camera position based on new dimensions?
        // Or let the regular updateCamera handle it? Let updateCamera handle it.
    }

    updateCamera(): void {
         const viewportWidth = this.coreRenderer.getWidth();
         const viewportHeight = this.coreRenderer.getHeight();

         const targetCameraX = this.player.x - viewportWidth / 2;
         const targetCameraY = this.player.y - viewportHeight / 2;

         let finalCameraX: number;
         let finalCameraY: number;

         if (viewportWidth >= this.worldWidth) {
             finalCameraX = (this.worldWidth - viewportWidth) / 2;
         } else {
             finalCameraX = Math.max(0, Math.min(targetCameraX, this.worldWidth - viewportWidth));
         }

         if (viewportHeight >= this.worldHeight) {
             finalCameraY = (this.worldHeight - viewportHeight) / 2;
         } else {
             finalCameraY = Math.max(0, Math.min(targetCameraY, this.worldHeight - viewportHeight));
         }

         this.coreRenderer.updateCamera(finalCameraX, finalCameraY);
    }

    drawScene(
        isCreativeModeEnabled: boolean, 
        closestPickupItem: any = null, 
        placementPreview: PlacementPreviewInfo | null = null, 
        highlightObject: HighlightInfo | null = null,
        debugBounds: DebugBound[] = [],
        deleteMode: boolean = false
    ): void {
        this.coreRenderer.clear();
        const ctx = this.coreRenderer.getContext();

        // --- Apply Camera Transform ---
        ctx.save();
        ctx.translate(-this.coreRenderer.cameraX, -this.coreRenderer.cameraY);

        // --- Draw World Elements ---
        this.drawTerrain();
        this.drawStaticObjects(isCreativeModeEnabled);
        this.drawDroppedItems();
        this.drawEdgeIndicators();
        this.drawPlayer();
        this.drawEquippedItem(isCreativeModeEnabled); // Pass flag

        // Draw pickup prompt if needed and not in creative mode
        if (!isCreativeModeEnabled && closestPickupItem) {
            this.drawPickupPrompt(closestPickupItem);
        }

        // Draw creative mode overlays if in creative mode
        if (isCreativeModeEnabled) {
            // Draw placement preview only if not in delete mode
            if (placementPreview && !deleteMode) {
                this.drawPlacementPreview(placementPreview);
            }

            // Draw object highlight (works in both normal and delete mode)
            if (highlightObject) {
                const highlightColor = deleteMode ? 'rgba(255, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.3)';
                this.coreRenderer.drawHighlight(
                    highlightObject.x, 
                    highlightObject.y, 
                    highlightObject.width, 
                    highlightObject.height,
                    highlightColor
                );
            }
            
            // Draw debug bounds
            if (debugBounds.length > 0) {
                this.drawDebugBounds(debugBounds);
            }
        }

        // --- Restore Transform ---
        ctx.restore();

        // --- Draw Screen-Space UI (inventory is still handled by coreRenderer/Game) ---
        // Draw cursor in delete mode (in screen space, after context is restored)
        if (isCreativeModeEnabled && deleteMode) {
            const mouseX = this.inputHandler.mouseScreenPosition.x;
            const mouseY = this.inputHandler.mouseScreenPosition.y;
            
            ctx.save();
            
            // Draw a small red X at cursor position
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.lineWidth = 2;
            const cursorSize = 12;
            
            ctx.beginPath();
            ctx.moveTo(mouseX - cursorSize/2, mouseY - cursorSize/2);
            ctx.lineTo(mouseX + cursorSize/2, mouseY + cursorSize/2);
            ctx.moveTo(mouseX + cursorSize/2, mouseY - cursorSize/2);
            ctx.lineTo(mouseX - cursorSize/2, mouseY + cursorSize/2);
            ctx.stroke();
            ctx.restore();
        }
    }

    private drawTerrain(): void {
        const startCol = Math.floor(this.coreRenderer.cameraX / this.tileSize);
        const endCol = Math.ceil((this.coreRenderer.cameraX + this.coreRenderer.getWidth()) / this.tileSize);
        const startRow = Math.floor(this.coreRenderer.cameraY / this.tileSize);
        const endRow = Math.ceil((this.coreRenderer.cameraY + this.coreRenderer.getHeight()) / this.tileSize);

        const { rows: numGridRows, cols: numGridCols } = this.terrainManager.getGridDimensions();

        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                // Check bounds using TerrainManager helper
                const tileConfig = this.terrainManager.getTileConfig(x, y); // Checks bounds internally
                if (tileConfig) {
                    const tileImage = this.assetLoader.getImage(tileConfig.assetPath);
                    if (tileImage) {
                        const tileWorldX = x * this.tileSize;
                        const tileWorldY = y * this.tileSize;
                        // Renderer.drawTile expects 4 args: image, x, y, tileSize
                        this.coreRenderer.drawTile(tileImage, tileWorldX, tileWorldY, this.tileSize);
                    } else {
                        const tileWorldX = x * this.tileSize + this.tileSize / 2;
                        const tileWorldY = y * this.tileSize + this.tileSize / 2;
                        this.coreRenderer.drawPlaceholder(tileWorldX, tileWorldY, 'grey');
                    }
                } else if (y >= 0 && y < numGridRows && x >= 0 && x < numGridCols) {
                     // Draw placeholder for unknown/missing tile type within bounds
                     const tileWorldX = x * this.tileSize + this.tileSize / 2;
                     const tileWorldY = y * this.tileSize + this.tileSize / 2;
                     this.coreRenderer.drawPlaceholder(tileWorldX, tileWorldY, 'magenta');
                }
                 // No drawing needed for tiles outside grid bounds
            }
        }
    }

    private drawStaticObjects(creativeModeEnabled: boolean): void {
        this.entityManager.staticObjects.forEach(obj => {
            let assetPath: string | undefined = undefined;

            if (obj instanceof Tree || obj instanceof House) {
                assetPath = obj.svgPath; // Existing logic for Tree/House
            } else if (obj instanceof DoorExit) {
                const config = PLACEABLE_OBJECT_CONFIG['DoorExit'];
                if (config) {
                    assetPath = config.assetPath;
                }
            }

            if (assetPath) {
                const objImg = this.assetLoader.getImage(assetPath);
                if (objImg) {
                    // Renderer.drawImage expects 6 args: image, x, y, w, h, rotation
                    this.coreRenderer.drawImage(objImg, obj.x, obj.y, obj.width, obj.height, 0);
                } else {
                    // Draw placeholder if asset not found/loaded
                     this.coreRenderer.drawPlaceholder(obj.x, obj.y, 'red'); 
                }
            } else {
                // Draw placeholder if asset path couldn't be determined
                this.coreRenderer.drawPlaceholder(obj.x, obj.y, 'purple'); 
            }

            // Draw Tree Health Bar
            if (obj instanceof Tree && obj.state === 'STANDING' && obj.currentHealth < obj.maxHealth) {
                // Renderer.drawHealthBar expects 6 args: x, y, w, current, max
                this.coreRenderer.drawHealthBar(obj.x, obj.y, obj.width, obj.currentHealth, obj.maxHealth);
            }
        });
    }

    private drawDroppedItems(): void {
        this.entityManager.droppedItems.forEach(itemDrop => {
            const itemImg = this.assetLoader.getImage(itemDrop.itemConfig.assetPath);
            if (itemImg) {
                 const dropWidth = itemImg.naturalWidth * 0.8;
                 const dropHeight = itemImg.naturalHeight * 0.8;
                 // Renderer.drawImage expects 6 args: image, x, y, w, h, rotation
                 this.coreRenderer.drawImage(itemImg, itemDrop.x, itemDrop.y, dropWidth, dropHeight, 0);
            } else {
                this.coreRenderer.drawPlaceholder(itemDrop.x, itemDrop.y, 'orange');
            }
        });
    }

    private drawPickupPrompt(closestItem: DroppedItem | null): void {
        if (!closestItem) return;

        const item = closestItem;
        const itemImg = this.assetLoader.getImage(item.itemConfig.assetPath);
        if (itemImg) {
             // Use calculated dropped size for consistency? Or item's base size?
             const dropWidth = itemImg.naturalWidth * 0.8;
             const dropHeight = itemImg.naturalHeight * 0.8;
             const promptText = `E - Pick up ${item.itemConfig.name}`;
             // Renderer.drawPickupPrompt expects 5 args: text, x, y, w, h
             this.coreRenderer.drawPickupPrompt(promptText, item.x, item.y, dropWidth, dropHeight);
        }
    }

    private drawPlayer(): void {
        const playerImg = this.assetLoader.getImage(this.player.svgPath);
        if (playerImg) {
             // Renderer.drawImage expects 6 args: image, x, y, w, h, rotation
             this.coreRenderer.drawImage(playerImg, this.player.x, this.player.y, this.player.width, this.player.height, this.player.rotation);
        } else {
            this.coreRenderer.drawPlaceholder(this.player.x, this.player.y, 'lime');
        }
    }

    private drawEquippedItem(creativeModeEnabled: boolean): void {
        const equippedItem = this.player.getEquippedItem();
        // Only draw if equipped AND not in creative mode
        if (!equippedItem || creativeModeEnabled) return;

        const itemImg = this.assetLoader.getImage(equippedItem.assetPath);
        if (!itemImg) return;

        let itemRotation = this.player.rotation;
        const holdOffsetAngle = Math.PI / 4;
        const holdOffsetX = 22;
        const holdOffsetY = -15;

        // Apply swing animation ONLY if it's a tool
        if (equippedItem.itemType === ItemType.TOOL && this.player.isSwinging) {
            itemRotation += this.player.getSwingAngleOffset();
        } else {
            itemRotation += holdOffsetAngle; // Apply basic holding angle otherwise
        }

        // Calculate position relative to player center and rotation
        const playerRotationRad = this.player.rotation;
        const rotatedOffsetX = Math.cos(playerRotationRad) * holdOffsetX - Math.sin(playerRotationRad) * holdOffsetY;
        const rotatedOffsetY = Math.sin(playerRotationRad) * holdOffsetX + Math.cos(playerRotationRad) * holdOffsetY;

        const itemX = this.player.x + rotatedOffsetX;
        const itemY = this.player.y + rotatedOffsetY;

        const itemWidth = itemImg.naturalWidth * 0.8;
        const itemHeight = itemImg.naturalHeight * 0.8;

        // Renderer.drawImage expects 6 args: image, x, y, w, h, rotation
        this.coreRenderer.drawImage(itemImg, itemX, itemY, itemWidth, itemHeight, itemRotation);
    }

    private drawPlacementPreview(placementPreview: PlacementPreviewInfo | null): void {
        if (placementPreview) {
            const ghostImg = this.assetLoader.getImage(placementPreview.path);
            if (ghostImg) {
                 // Renderer.drawGhostImage expects 5 args: image, x, y, w, h
                 this.coreRenderer.drawGhostImage(ghostImg, placementPreview.x, placementPreview.y, placementPreview.width, placementPreview.height);
            }
        }
    }

    private drawDebugBounds(bounds: DebugBound[]): void {
        // Draw bounds passed from GameplayController
        bounds.forEach(bound => {
            this.coreRenderer.drawDebugRect(bound.box, bound.color);
        });
    }

    // New method to draw edge indicators
    private drawEdgeIndicators(): void {
        // Get world dimensions
        const worldWidth = this.worldWidth;
        const worldHeight = this.worldHeight;
        
        // Get player position from the reference
        const playerX = this.player.x;
        const playerY = this.player.y;
        
        // Define the edge threshold - how close to the edge before showing indicator
        const edgeThreshold = 100;
        
        // Check each edge and draw indicator if player is near
        if (playerX < edgeThreshold) {
            // Near left/west edge
            const rect = { x: 0, y: 0, width: 10, height: this.worldHeight };
            this.coreRenderer.drawDebugRect(rect, 'rgba(255, 0, 0, 0.5)');
        }
        
        if (playerX > worldWidth - edgeThreshold) {
            // Near right/east edge
            const rect = { x: worldWidth - 10, y: 0, width: 10, height: this.worldHeight };
            this.coreRenderer.drawDebugRect(rect, 'rgba(255, 0, 0, 0.5)');
        }
        
        if (playerY < edgeThreshold) {
            // Near top/north edge
            const rect = { x: 0, y: 0, width: this.worldWidth, height: 10 };
            this.coreRenderer.drawDebugRect(rect, 'rgba(255, 0, 0, 0.5)');
        }
        
        if (playerY > worldHeight - edgeThreshold) {
            // Near bottom/south edge
            const rect = { x: 0, y: worldHeight - 10, width: this.worldWidth, height: 10 };
            this.coreRenderer.drawDebugRect(rect, 'rgba(255, 0, 0, 0.5)');
        }
    }
} 