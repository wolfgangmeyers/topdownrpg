import { Renderer } from '../renderer';
import { InputHandler } from '../input';
import { AssetLoader } from '../assets';
import { TerrainType, TERRAIN_CONFIG } from '../terrain'; // Import terrain types and config
import { ItemType, ITEM_CONFIG } from '../item';
import { deleteAllScenesExcept, getAllSceneIds } from '../db'; // Import deleteAllScenesExcept and getAllSceneIds functions

// Define placeable object types (Moved from game.ts)
export type PlaceableObjectType = 'Tree' | 'House' | 'DoorExit'; // Restored DoorExit
export const PLACEABLE_OBJECT_CONFIG: Record<PlaceableObjectType, { assetPath: string }> = {
    'Tree': { assetPath: '/assets/svg/tree.svg' },
    'House': { assetPath: '/assets/svg/house.svg' },
    'DoorExit': { assetPath: '/assets/svg/door-exit.svg' }, // Restored DoorExit config
};

// Combined type for items shown in the selector panel
export type CreativeModeItem = { 
    type: 'object' | 'terrain' | 'item';
    id: string; 
    name: string; 
    assetPath: string; 
};

export class CreativeModeSelector {
    // Type definition for ITEM_CONFIG structure
    private itemConfig: Record<string, import('../item').Item>;
    private renderer: Renderer;
    private input: InputHandler;
    private assetLoader: AssetLoader;
    private currentSceneId: string = ''; // Track current scene ID

    public items: CreativeModeItem[] = [];
    public selectedObjectType: PlaceableObjectType | null = 'Tree'; // Default selection
    public selectedTerrainType: TerrainType | null = null;
    public selectedItemId: string | null = null; // Add state for selected item
    public deleteMode: boolean = false; // Track if delete mode is active

    // Layout constants (previously duplicated in Game and Renderer)
    private readonly panelPadding = 10;
    private readonly panelSlotSize = 50;
    private readonly itemsPerRow = 5; 
    private readonly panelStartX = this.panelPadding;
    private readonly panelStartY = this.panelPadding;
    
    // UI state for delete button
    private isConfirmingDelete = false;
    private isDeletingScenes = false;
    private deletionResult: string | null = null;
    private resultTimeoutId: number | null = null;

    // Add biome regenerate button state
    private isConfirmingRegenerate = false;
    private isRegenerating = false;
    private regenerationResult: string | null = null;
    private regenerationTimeoutId: number | null = null;
    
    // Add signal for game to regenerate the current scene
    public regenerateCurrentScene = false;

    constructor(
        renderer: Renderer, 
        input: InputHandler, 
        assetLoader: AssetLoader,
        itemConfig: Record<string, import('../item').Item>,
        currentSceneId: string // Pass current scene ID to constructor
    ) {
        this.renderer = renderer;
        this.input = input;
        this.assetLoader = assetLoader;
        this.itemConfig = itemConfig; // Assign passed config
        this.currentSceneId = currentSceneId;
        this.initializeItems(); // Initialize items immediately
    }

    // Moved from Game.initializeCreativeModeItems
    private initializeItems(): void {
        this.items = [];

        // Add Placeable Objects
        for (const key in PLACEABLE_OBJECT_CONFIG) {
            if (Object.prototype.hasOwnProperty.call(PLACEABLE_OBJECT_CONFIG, key)) {
                const type = key as PlaceableObjectType;
                if (type === 'DoorExit') {
                    continue; // Don't add DoorExit to the selectable items
                }
                const config = PLACEABLE_OBJECT_CONFIG[type];
                this.items.push({
                    type: 'object',
                    id: type,
                    name: type, // Simple name for now
                    assetPath: config.assetPath,
                });
            }
        }

        // Add Terrain Types
        for (const key in TERRAIN_CONFIG) {
            if (Object.prototype.hasOwnProperty.call(TERRAIN_CONFIG, key)) {
                const type = key as TerrainType;
                const config = TERRAIN_CONFIG[type];
                // Removed if (config.isPlaceable) check
                // Generate simple name from ID
                const name = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
                this.items.push({
                    type: 'terrain',
                    id: type,
                    name: name, // Use generated name
                    assetPath: config.assetPath,
                });
            }
        }

        // Add specific Items (e.g., Axe, Log)
        const itemIdsToAdd = ['axe', 'log']; // Removed 'door-exit'
        for (const itemId of itemIdsToAdd) {
            const itemConfig = this.itemConfig[itemId];
            if (itemConfig) {
                this.items.push({
                    type: 'item',
                    id: itemId,
                    name: itemConfig.name,
                    assetPath: itemConfig.assetPath,
                });
            }
        }
        
        console.log("Creative Mode Selector Initialized Items:", this.items);
    }

    /**
     * Loads assets required for the selector panel items.
     * Should be called after construction, typically during game initialization.
     */
    public async loadAssets(): Promise<void> {
        const assetPaths = this.items.map(item => item.assetPath);
        if (assetPaths.length > 0) {
            console.log("CreativeModeSelector: Loading assets...");
            await this.assetLoader.loadImages(assetPaths);
            console.log("CreativeModeSelector: Assets loaded.");
        }
    }

    /**
     * Updates the current scene ID
     * @param sceneId The ID of the current scene
     */
    public updateCurrentSceneId(sceneId: string): void {
        this.currentSceneId = sceneId;
    }

    // Moved from Game.handleCreativeModeUIClick
    public update(isCreativeModeEnabled: boolean): void {
        // Check for escape key to exit delete mode
        if (this.input.escapePressed && this.deleteMode) {
            this.deleteMode = false;
            return;
        }

        if (!isCreativeModeEnabled || (!this.input.uiMouseClicked && !this.input.uiDropActionClicked)) {
            // Only process clicks if creative mode is on and a relevant click occurred
            // We ignore drop clicks (Shift+Click) on the creative panel for now.
            return; 
        }

        // Use only uiMouseClicked for selection
        if (!this.input.uiMouseClicked) return; 

        const clickX = this.input.mouseScreenPosition.x;
        const clickY = this.input.mouseScreenPosition.y;

        // Check if delete mode button was clicked
        const deleteModeButtonBounds = this.getDeleteModeButtonBounds();
        if (clickX >= deleteModeButtonBounds.x && clickX <= deleteModeButtonBounds.x + deleteModeButtonBounds.width &&
            clickY >= deleteModeButtonBounds.y && clickY <= deleteModeButtonBounds.y + deleteModeButtonBounds.height) {
            
            // Toggle delete mode
            this.deleteMode = !this.deleteMode;
            
            // Clear other selection states when entering delete mode
            if (this.deleteMode) {
                this.selectedObjectType = null;
                this.selectedTerrainType = null;
                this.selectedItemId = null;
            }
            
            // Prevent this click from also triggering a world click
            this.input.consumeClick();
            return;
        }

        // Check if delete button was clicked
        const deleteButtonBounds = this.getDeleteButtonBounds();
        if (clickX >= deleteButtonBounds.x && clickX <= deleteButtonBounds.x + deleteButtonBounds.width &&
            clickY >= deleteButtonBounds.y && clickY <= deleteButtonBounds.y + deleteButtonBounds.height) {
            
            // If we're not already in confirmation mode, show confirmation prompt
            if (!this.isConfirmingDelete) {
                this.isConfirmingDelete = true;
                // Prevent this click from also triggering a world click
                this.input.consumeClick();
                return;
            }
            
            // If we are in confirmation mode, proceed with deletion
            this.isConfirmingDelete = false;
            this.isDeletingScenes = true;
            
            // Execute the delete operation asynchronously
            this.executeDeleteAllScenes()
                .then(() => {
                    // Success - handling happens in executeDeleteAllScenes
                })
                .catch(error => {
                    console.error("Error during scene deletion:", error);
                    this.deletionResult = "Error deleting scenes";
                })
                .then(() => {
                    // This will run regardless of success or failure (like finally)
                    this.isDeletingScenes = false;
                    
                    // Clear any existing timeout
                    if (this.resultTimeoutId !== null) {
                        window.clearTimeout(this.resultTimeoutId);
                    }
                    
                    // Set a timeout to clear the result message after 5 seconds
                    this.resultTimeoutId = window.setTimeout(() => {
                        this.deletionResult = null;
                        this.resultTimeoutId = null;
                    }, 5000);
                });
            
            // Prevent this click from also triggering a world click
            this.input.consumeClick();
            return;
        } else if (this.isConfirmingDelete) {
            // If we clicked anywhere else while in confirmation mode, cancel it
            this.isConfirmingDelete = false;
            this.input.consumeClick();
            return;
        }

        // Check if regenerate button was clicked
        const regenerateButtonBounds = this.getRegenerateButtonBounds();
        if (clickX >= regenerateButtonBounds.x && clickX <= regenerateButtonBounds.x + regenerateButtonBounds.width &&
            clickY >= regenerateButtonBounds.y && clickY <= regenerateButtonBounds.y + regenerateButtonBounds.height) {
            
            // If we're not already in confirmation mode, show confirmation prompt
            if (!this.isConfirmingRegenerate) {
                this.isConfirmingRegenerate = true;
                // Prevent this click from also triggering a world click
                this.input.consumeClick();
                return;
            }
            
            // If we are in confirmation mode, proceed with regeneration
            this.isConfirmingRegenerate = false;
            this.isRegenerating = true;
            
            // Set the flag for Game to handle the regeneration
            this.regenerateCurrentScene = true;
            
            // Clear any existing timeout
            if (this.regenerationTimeoutId !== null) {
                window.clearTimeout(this.regenerationTimeoutId);
            }
            
            // Set a timeout to clear the result message after 5 seconds
            this.regenerationTimeoutId = window.setTimeout(() => {
                this.regenerationResult = null;
                this.regenerationTimeoutId = null;
            }, 5000);
            
            // Prevent this click from also triggering a world click
            this.input.consumeClick();
            return;
        } else if (this.isConfirmingRegenerate) {
            // If we clicked anywhere else while in confirmation mode, cancel it
            this.isConfirmingRegenerate = false;
            this.input.consumeClick();
            return;
        }

        // Handle regular item selection (existing code)
        let clickedItem: CreativeModeItem | null = null;
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const col = i % this.itemsPerRow;
            const row = Math.floor(i / this.itemsPerRow);
            
            const itemX = this.panelStartX + col * (this.panelSlotSize + this.panelPadding);
            const itemY = this.panelStartY + row * (this.panelSlotSize + this.panelPadding);

            // Check if click is within this item's bounds
            if (clickX >= itemX && clickX <= itemX + this.panelSlotSize &&
                clickY >= itemY && clickY <= itemY + this.panelSlotSize) {
                clickedItem = item;
                break;
            }
        }

        if (clickedItem) {
            console.log(`Creative panel clicked: ${clickedItem.name} (Type: ${clickedItem.type})`);
            if (clickedItem.type === 'object') {
                this.selectedObjectType = clickedItem.id as PlaceableObjectType;
                this.selectedTerrainType = null; // Deselect terrain
                this.selectedItemId = null; // Deselect item
                console.log(`Selected Object: ${this.selectedObjectType}`);
            } else if (clickedItem.type === 'terrain') {
                this.selectedTerrainType = clickedItem.id as TerrainType;
                this.selectedObjectType = null; // Deselect object
                this.selectedItemId = null; // Deselect item
                console.log(`Selected Terrain: ${this.selectedTerrainType}`);
            } else if (clickedItem.type === 'item') {
                this.selectedItemId = clickedItem.id;
                this.selectedObjectType = null; // Deselect object
                this.selectedTerrainType = null; // Deselect terrain
                console.log(`Selected Item: ${this.selectedItemId}`);
            }
            // Consume the click so it doesn't trigger world placement
            this.input.consumeClick(); 
        } else {
            // Click was likely on the panel background or outside, do nothing
            // console.log("Creative panel click missed items.");
        }
    }

    /**
     * Executes the deletion of all scenes except the current one and linked interior scenes
     * @returns Promise<void>
     */
    private async executeDeleteAllScenes(): Promise<void> {
        if (!this.currentSceneId) {
            this.deletionResult = "Error: No current scene ID";
            return;
        }
        
        try {
            // Get all scene IDs to know the total count
            const allSceneIds = await getAllSceneIds();
            const totalSceneCount = allSceneIds.length;
            
            const deletedScenes = await deleteAllScenesExcept(this.currentSceneId);
            const preservedCount = totalSceneCount - deletedScenes.length;
            
            if (deletedScenes.length === 0) {
                this.deletionResult = `No scenes deleted (${preservedCount} preserved)`;
            } else {
                this.deletionResult = `Deleted ${deletedScenes.length} scenes (${preservedCount} preserved)`;
            }
        } catch (error) {
            console.error("Failed to delete scenes:", error);
            this.deletionResult = "Failed to delete scenes";
            throw error;
        }
    }

    /**
     * Gets the position and size of the delete mode button
     */
    private getDeleteModeButtonBounds() {
        // Position below the regenerate button
        const regenerateButton = this.getRegenerateButtonBounds();
        const buttonY = regenerateButton.y + regenerateButton.height + 10;
        
        // Center the button in the panel
        const panelWidth = this.itemsPerRow * (this.panelSlotSize + this.panelPadding) - this.panelPadding;
        const buttonWidth = 150;
        const buttonX = this.panelStartX + (panelWidth - buttonWidth) / 2;
        
        return {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: 40
        };
    }

    private getDeleteButtonBounds() {
        // Calculate panel dimensions needed for item slots
        const actualNumRows = Math.ceil(this.items.length / this.itemsPerRow);
        const numRowsToDraw = Math.max(2, actualNumRows); // Ensure at least 2 rows are drawn
        
        // Position the delete button below the item grid and delete mode button
        const itemGridHeight = numRowsToDraw * (this.panelSlotSize + this.panelPadding) - this.panelPadding;
        const deleteModeButton = this.getDeleteModeButtonBounds();
        const buttonY = deleteModeButton.y + deleteModeButton.height + 10;
        
        // Center the button in the panel
        const panelWidth = this.itemsPerRow * (this.panelSlotSize + this.panelPadding) - this.panelPadding;
        const buttonWidth = 200;
        const buttonX = this.panelStartX + (panelWidth - buttonWidth) / 2;
        
        return {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: 40
        };
    }

    /**
     * Gets the position and size of the regenerate button
     */
    private getRegenerateButtonBounds() {
        // Position the regenerate button below the creative panel
        const itemGridHeight = Math.ceil(this.items.length / this.itemsPerRow) * (this.panelSlotSize + this.panelPadding) - this.panelPadding;
        const buttonY = this.panelStartY + itemGridHeight + 10;
        
        // Center the button in the panel
        const panelWidth = this.itemsPerRow * (this.panelSlotSize + this.panelPadding) - this.panelPadding;
        const buttonWidth = 200;
        const buttonX = this.panelStartX + (panelWidth - buttonWidth) / 2;
        
        return {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: 40
        };
    }

    // Moved from Renderer.drawCreativePanel
    public draw(isCreativeModeEnabled: boolean): void {
        if (!isCreativeModeEnabled) return;

        const ctx = this.renderer.getContext();
        
        // Calculate panel dimensions needed for item slots
        const actualNumRows = Math.ceil(this.items.length / this.itemsPerRow);
        const numRowsToDraw = Math.max(2, actualNumRows); // Ensure at least 2 rows are drawn
        const panelWidth = this.itemsPerRow * (this.panelSlotSize + this.panelPadding) - this.panelPadding;
        
        // Add extra height for all three buttons
        const deleteButtonHeight = 40;
        const deleteModeButtonHeight = 40;
        const regenerateButtonHeight = 40;
        const buttonMargin = 10; // Space between elements
        const totalExtraHeight = (deleteButtonHeight + deleteModeButtonHeight + regenerateButtonHeight + buttonMargin * 4);
        
        const panelHeight = numRowsToDraw * (this.panelSlotSize + this.panelPadding) - this.panelPadding + totalExtraHeight;

        ctx.save();

        // Draw background panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(this.panelStartX - this.panelPadding, this.panelStartY - this.panelPadding, 
                    panelWidth + this.panelPadding * 2, panelHeight + this.panelPadding * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.panelStartX - this.panelPadding, this.panelStartY - this.panelPadding, 
                      panelWidth + this.panelPadding * 2, panelHeight + this.panelPadding * 2);

        // Draw each item slot
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const col = i % this.itemsPerRow;
            const row = Math.floor(i / this.itemsPerRow);
            
            const itemX = this.panelStartX + col * (this.panelSlotSize + this.panelPadding);
            const itemY = this.panelStartY + row * (this.panelSlotSize + this.panelPadding);

            // Determine if this item is selected
            const isSelected = (item.type === 'object' && item.id === this.selectedObjectType) || 
                             (item.type === 'terrain' && item.id === this.selectedTerrainType) ||
                             (item.type === 'item' && item.id === this.selectedItemId);

            // Draw slot background
            ctx.fillStyle = isSelected ? 'rgba(255, 255, 100, 0.3)' : 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(itemX, itemY, this.panelSlotSize, this.panelSlotSize);

            // Draw item image
            const itemImg = this.assetLoader.getImage(item.assetPath);
            if (itemImg) {
                const imgPadding = 5;
                const imgSize = this.panelSlotSize - imgPadding * 2;
                // Use basic drawImage, no rotation needed for UI icons
                ctx.drawImage(itemImg, itemX + imgPadding, itemY + imgPadding, imgSize, imgSize);
            } else {
                // Draw placeholder text if image not loaded
                ctx.fillStyle = '#555';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle'; // Center vertically
                ctx.fillText('ERR', itemX + this.panelSlotSize / 2, itemY + this.panelSlotSize / 2);
            }

            // Draw border (thicker if selected)
            ctx.strokeStyle = isSelected ? 'yellow' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeRect(itemX, itemY, this.panelSlotSize, this.panelSlotSize); 
        }

        // Draw the delete mode button
        const deleteModeButtonBounds = this.getDeleteModeButtonBounds();
        
        // Button background - highlighted when active
        ctx.fillStyle = this.deleteMode ? 'rgba(50, 120, 255, 0.7)' : 'rgba(70, 70, 200, 0.4)';
        ctx.fillRect(deleteModeButtonBounds.x, deleteModeButtonBounds.y, deleteModeButtonBounds.width, deleteModeButtonBounds.height);
        
        // Button border
        ctx.strokeStyle = this.deleteMode ? 'rgba(150, 150, 255, 0.9)' : 'rgba(100, 100, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(deleteModeButtonBounds.x, deleteModeButtonBounds.y, deleteModeButtonBounds.width, deleteModeButtonBounds.height);
        
        // Button text
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const deleteModeText = this.deleteMode ? 'Deleting Objects' : 'Delete Objects';
        ctx.fillText(deleteModeText, 
            deleteModeButtonBounds.x + deleteModeButtonBounds.width / 2, 
            deleteModeButtonBounds.y + deleteModeButtonBounds.height / 2);

        // Draw the delete button
        const deleteButtonBounds = this.getDeleteButtonBounds();
        
        // Button background
        ctx.fillStyle = this.isConfirmingDelete ? 'rgba(255, 50, 50, 0.6)' : 'rgba(220, 50, 50, 0.4)';
        if (this.isDeletingScenes) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.6)'; // Disabled/processing appearance
        }
        ctx.fillRect(deleteButtonBounds.x, deleteButtonBounds.y, deleteButtonBounds.width, deleteButtonBounds.height);
        
        // Button border
        ctx.strokeStyle = this.isConfirmingDelete ? 'rgba(255, 150, 150, 0.8)' : 'rgba(255, 100, 100, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(deleteButtonBounds.x, deleteButtonBounds.y, deleteButtonBounds.width, deleteButtonBounds.height);
        
        // Button text
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (this.isDeletingScenes) {
            ctx.fillText('Deleting scenes...', 
                deleteButtonBounds.x + deleteButtonBounds.width / 2, 
                deleteButtonBounds.y + deleteButtonBounds.height / 2);
        } else if (this.isConfirmingDelete) {
            ctx.fillText('Confirm: Delete other scenes?', 
                deleteButtonBounds.x + deleteButtonBounds.width / 2, 
                deleteButtonBounds.y + deleteButtonBounds.height / 2);
        } else if (this.deletionResult) {
            ctx.fillText(this.deletionResult, 
                deleteButtonBounds.x + deleteButtonBounds.width / 2, 
                deleteButtonBounds.y + deleteButtonBounds.height / 2);
        } else {
            ctx.fillText('Delete Other Scenes', 
                deleteButtonBounds.x + deleteButtonBounds.width / 2, 
                deleteButtonBounds.y + deleteButtonBounds.height / 2);
        }

        // Draw the regenerate button
        const regenerateButtonBounds = this.getRegenerateButtonBounds();
        
        // Button background
        ctx.fillStyle = this.isConfirmingRegenerate ? 'rgba(50, 200, 50, 0.6)' : 'rgba(50, 150, 50, 0.4)';
        if (this.isRegenerating) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.6)'; // Disabled/processing appearance
        }
        ctx.fillRect(regenerateButtonBounds.x, regenerateButtonBounds.y, regenerateButtonBounds.width, regenerateButtonBounds.height);
        
        // Button border
        ctx.strokeStyle = this.isConfirmingRegenerate ? 'rgba(100, 255, 100, 0.8)' : 'rgba(100, 200, 100, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(regenerateButtonBounds.x, regenerateButtonBounds.y, regenerateButtonBounds.width, regenerateButtonBounds.height);
        
        // Button text
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (this.isRegenerating) {
            ctx.fillText('Regenerating scene...', 
                regenerateButtonBounds.x + regenerateButtonBounds.width / 2, 
                regenerateButtonBounds.y + regenerateButtonBounds.height / 2);
        } else if (this.isConfirmingRegenerate) {
            ctx.fillText('Confirm: Regenerate Scene?', 
                regenerateButtonBounds.x + regenerateButtonBounds.width / 2, 
                regenerateButtonBounds.y + regenerateButtonBounds.height / 2);
        } else if (this.regenerationResult) {
            ctx.fillText(this.regenerationResult, 
                regenerateButtonBounds.x + regenerateButtonBounds.width / 2, 
                regenerateButtonBounds.y + regenerateButtonBounds.height / 2);
        } else {
            ctx.fillText('Regenerate Current Scene', 
                regenerateButtonBounds.x + regenerateButtonBounds.width / 2, 
                regenerateButtonBounds.y + regenerateButtonBounds.height / 2);
        }

        ctx.restore();
    }

    /**
     * Resets the regeneration state and sets the result message
     */
    public setRegenerationComplete(success: boolean, message: string): void {
        this.isRegenerating = false;
        this.regenerateCurrentScene = false;
        this.regenerationResult = message;
        
        // Clear any existing timeout
        if (this.regenerationTimeoutId !== null) {
            window.clearTimeout(this.regenerationTimeoutId);
        }
        
        // Set a timeout to clear the result message after 5 seconds
        this.regenerationTimeoutId = window.setTimeout(() => {
            this.regenerationResult = null;
            this.regenerationTimeoutId = null;
        }, 5000);
    }
} 