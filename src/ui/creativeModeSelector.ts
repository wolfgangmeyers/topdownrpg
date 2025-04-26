import { Renderer } from '../renderer';
import { InputHandler } from '../input';
import { AssetLoader } from '../assets';
import { TerrainType, TERRAIN_CONFIG } from '../terrain'; // Import terrain types and config

// Define placeable object types (Moved from game.ts)
export type PlaceableObjectType = 'Tree' | 'House';
export const PLACEABLE_OBJECT_CONFIG: Record<PlaceableObjectType, { assetPath: string }> = {
    'Tree': { assetPath: '/assets/svg/tree.svg' },
    'House': { assetPath: '/assets/svg/house.svg' },
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

    public items: CreativeModeItem[] = [];
    public selectedObjectType: PlaceableObjectType | null = 'Tree'; // Default selection
    public selectedTerrainType: TerrainType | null = null;
    public selectedItemId: string | null = null; // Add state for selected item

    // Layout constants (previously duplicated in Game and Renderer)
    private readonly panelPadding = 10;
    private readonly panelSlotSize = 50;
    private readonly itemsPerRow = 5; 
    private readonly panelStartX = this.panelPadding;
    private readonly panelStartY = this.panelPadding;

    constructor(
        renderer: Renderer, 
        input: InputHandler, 
        assetLoader: AssetLoader, 
        itemConfig: Record<string, import('../item').Item> // Pass ITEM_CONFIG directly
    ) {
        this.renderer = renderer;
        this.input = input;
        this.assetLoader = assetLoader;
        this.itemConfig = itemConfig; // Assign passed config
        this.initializeItems(); // Initialize items immediately
    }

    // Moved from Game.initializeCreativeModeItems
    private initializeItems(): void {
        this.items = [];

        // Add Placeable Objects
        for (const key in PLACEABLE_OBJECT_CONFIG) {
            if (Object.prototype.hasOwnProperty.call(PLACEABLE_OBJECT_CONFIG, key)) {
                const type = key as PlaceableObjectType;
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
                if (config.isPlaceable) { // Only add placeable terrain types
                    this.items.push({
                        type: 'terrain',
                        id: type,
                        name: config.name,
                        assetPath: config.assetPath,
                    });
                }
            }
        }

        // Add specific Items (e.g., Axe)
        const axeId = 'axe';
        const axeConfig = this.itemConfig[axeId];
        if (axeConfig) {
            this.items.push({
                type: 'item',
                id: axeId,
                name: axeConfig.name,
                assetPath: axeConfig.assetPath,
            });
        }
        // Add more items here if needed

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

    // Moved from Game.handleCreativeModeUIClick
    public update(isCreativeModeEnabled: boolean): void {
        if (!isCreativeModeEnabled || (!this.input.uiMouseClicked && !this.input.uiDropActionClicked)) {
            // Only process clicks if creative mode is on and a relevant click occurred
            // We ignore drop clicks (Shift+Click) on the creative panel for now.
            return; 
        }

        // Use only uiMouseClicked for selection
        if (!this.input.uiMouseClicked) return; 

        const clickX = this.input.mouseScreenPosition.x;
        const clickY = this.input.mouseScreenPosition.y;

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

    // Moved from Renderer.drawCreativePanel
    public draw(isCreativeModeEnabled: boolean): void {
        if (!isCreativeModeEnabled) return;

        const ctx = this.renderer.getContext();
        
        // Calculate panel dimensions needed
        const actualNumRows = Math.ceil(this.items.length / this.itemsPerRow);
        const numRowsToDraw = Math.max(2, actualNumRows); // Ensure at least 2 rows are drawn
        const panelWidth = this.itemsPerRow * (this.panelSlotSize + this.panelPadding) - this.panelPadding;
        // Use numRowsToDraw for height calculation
        const panelHeight = numRowsToDraw * (this.panelSlotSize + this.panelPadding) - this.panelPadding;

        ctx.save();

        // Draw background panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(this.panelStartX - this.panelPadding, this.panelStartY - this.panelPadding, panelWidth + this.panelPadding * 2, panelHeight + this.panelPadding * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.panelStartX - this.panelPadding, this.panelStartY - this.panelPadding, panelWidth + this.panelPadding * 2, panelHeight + this.panelPadding * 2);

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

        ctx.restore();
    }
} 