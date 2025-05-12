import { Renderer } from '../renderer';
import { InputHandler } from '../input';
import { AssetLoader } from '../assets';
import { CraftingManager } from '../crafting/craftingManager';
import { CraftingRecipe } from '../crafting/recipes';
import { Player } from '../player';
import { getItemConfig } from '../item';

export class CraftingUI {
    private isOpen: boolean = false;
    private recipes: CraftingRecipe[] = [];
    private selectedRecipe: CraftingRecipe | null = null;
    private scrollOffset: number = 0; // For scrolling through recipes if needed
    private craftButtonHover: boolean = false;

    // UI Dimensions and Positioning (example values)
    private panelX: number = 0;
    private panelY: number = 0;
    private panelWidth: number = 400;
    private panelHeight: number = 500;
    private recipeListWidth: number = 150;
    private recipeDetailX: number = 0;
    private recipeDetailY: number = 0;
    private recipeDetailWidth: number = 0;
    private recipeDetailHeight: number = 0;
    private recipeItemHeight: number = 30; // Height of each item in the list
    private ingredientIconSize: number = 20;
    private craftButtonX: number = 0;
    private craftButtonY: number = 0;
    private craftButtonWidth: number = 100;
    private craftButtonHeight: number = 30;

    constructor(
        private renderer: Renderer,
        private inputHandler: InputHandler,
        private assetLoader: AssetLoader,
        private craftingManager: CraftingManager,
        private player: Player // Needed to check inventory for ingredient highlighting
    ) {
        // Initial calculation of UI element positions based on panel size
        this.recalculateLayout();
        // Preload assets? Maybe not needed if items are loaded elsewhere
    }

    private recalculateLayout(): void {
        const screenWidth = this.renderer.getWidth();
        const screenHeight = this.renderer.getHeight();
        this.panelX = (screenWidth - this.panelWidth) / 2;
        this.panelY = (screenHeight - this.panelHeight) / 2;
        this.recipeDetailX = this.panelX + this.recipeListWidth + 10; // Add padding
        this.recipeDetailY = this.panelY + 10; // Add padding
        this.recipeDetailWidth = this.panelWidth - this.recipeListWidth - 20; // Account for padding
        this.recipeDetailHeight = this.panelHeight - 20; // Account for padding

        this.craftButtonX = this.recipeDetailX + (this.recipeDetailWidth - this.craftButtonWidth) / 2;
        // Position button near the bottom of the details section
        this.craftButtonY = this.recipeDetailY + this.recipeDetailHeight - this.craftButtonHeight - 50; 
    }

    public toggle(): void {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            console.log("Crafting UI Opened");
            this.recipes = this.craftingManager.getAvailableRecipes();
            this.selectedRecipe = null; // Reset selection when opening
            this.scrollOffset = 0;
            this.recalculateLayout(); // Ensure layout is correct if screen resized while closed
        } else {
            console.log("Crafting UI Closed");
        }
    }

    public getIsOpen(): boolean {
        return this.isOpen;
    }

    public update(): void {
        if (!this.isOpen) return;

        const mouseX = this.inputHandler.mouseScreenPosition.x;
        const mouseY = this.inputHandler.mouseScreenPosition.y;
        let clickConsumed = false;

        // --- Handle Recipe List Clicks ---
        const listStartX = this.panelX + 5;
        const listStartY = this.panelY + 5;
        const listWidth = this.recipeListWidth;
        const listHeight = this.panelHeight - 10;

        if (mouseX >= listStartX && mouseX <= listStartX + listWidth &&
            mouseY >= listStartY && mouseY <= listStartY + listHeight) {
            
            if (this.inputHandler.uiMouseClicked) {
                const clickedIndex = Math.floor((mouseY - listStartY) / this.recipeItemHeight) + this.scrollOffset;
                if (clickedIndex >= 0 && clickedIndex < this.recipes.length) {
                    this.selectedRecipe = this.recipes[clickedIndex];
                    console.log(`Selected recipe: ${this.selectedRecipe.name}`);
                    clickConsumed = true;
                }
            }
        }

        // --- Handle Craft Button Click ---
        this.craftButtonHover = false; // Reset hover state
        if (this.selectedRecipe && this.craftingManager.canCraft(this.selectedRecipe.id)) {
            if (mouseX >= this.craftButtonX && mouseX <= this.craftButtonX + this.craftButtonWidth &&
                mouseY >= this.craftButtonY && mouseY <= this.craftButtonY + this.craftButtonHeight) {
                
                this.craftButtonHover = true;
                if (this.inputHandler.uiMouseClicked) {
                    console.log(`Attempting to craft: ${this.selectedRecipe.name}`);
                    const started = this.craftingManager.startCrafting(this.selectedRecipe.id);
                    if (started) {
                        this.toggle(); // Close UI after starting craft
                    } else {
                        // Optionally show an error message in the UI
                        console.error("Failed to start craft from UI button (should have been possible if button was enabled).");
                    }
                    clickConsumed = true;
                }
            }
        }

        // Consume the click if it was handled by this UI
        if (clickConsumed) {
            this.inputHandler.consumeClick();
        }
    }

    public draw(): void {
        if (!this.isOpen) return;

        const ctx = this.renderer.getContext();

        // --- Draw Panel Background ---
        ctx.save();
        ctx.fillStyle = 'rgba(50, 50, 70, 0.9)'; // Dark bluish panel
        ctx.strokeStyle = 'rgba(200, 200, 220, 1)'; // Light border
        ctx.lineWidth = 2;
        ctx.fillRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight);
        ctx.strokeRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight);

        // --- Draw Recipe List ---
        const listStartX = this.panelX + 5;
        const listStartY = this.panelY + 5;
        const listWidth = this.recipeListWidth;
        const listHeight = this.panelHeight - 10;
        const maxVisibleItems = Math.floor(listHeight / this.recipeItemHeight);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(listStartX, listStartY, listWidth, listHeight);

        for (let i = 0; i < maxVisibleItems; i++) {
            const recipeIndex = i + this.scrollOffset;
            if (recipeIndex >= this.recipes.length) break;

            const recipe = this.recipes[recipeIndex];
            const itemY = listStartY + i * this.recipeItemHeight;
            const canCraft = this.craftingManager.canCraft(recipe.id);

            // Highlight selected recipe
            if (recipe === this.selectedRecipe) {
                ctx.fillStyle = 'rgba(255, 255, 100, 0.3)';
                ctx.fillRect(listStartX, itemY, listWidth, this.recipeItemHeight);
            }
            
            // Gray out if cannot craft
            ctx.fillStyle = canCraft ? 'white' : 'gray';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            this.renderer.drawText(recipe.name, listStartX + 5, itemY + this.recipeItemHeight / 2, ctx.fillStyle);
        }
        // TODO: Add scrollbar if needed

        // --- Draw Recipe Details ---
        if (this.selectedRecipe) {
            const detailX = this.recipeDetailX;
            let currentY = this.recipeDetailY + 10;

            // Recipe Name
            this.renderer.drawText(this.selectedRecipe.name, detailX, currentY, 'white', 'bold 18px Arial');
            currentY += 30;

            // Output Item
            const outputItemConfig = getItemConfig(this.selectedRecipe.outputItemId);
            if (outputItemConfig) {
                const outputIcon = this.assetLoader.getImage(outputItemConfig.assetPath);
                if (outputIcon) {
                    ctx.drawImage(outputIcon, detailX, currentY, this.ingredientIconSize * 1.5, this.ingredientIconSize * 1.5);
                }
                this.renderer.drawText(`-> ${this.selectedRecipe.outputQuantity} x ${outputItemConfig.name}`, detailX + this.ingredientIconSize * 1.5 + 5, currentY + (this.ingredientIconSize * 1.5) / 2, 'white', '16px Arial');
                currentY += this.ingredientIconSize * 1.5 + 10;
            }

            // Ingredients Header
            this.renderer.drawText("Ingredients:", detailX, currentY, 'lightblue', '14px Arial');
            currentY += 20;

            // Ingredient List
            for (const ingredient of this.selectedRecipe.ingredients) {
                const itemConfig = getItemConfig(ingredient.itemId);
                if (itemConfig) {
                    const playerHasEnough = this.player.hasItem(ingredient.itemId, ingredient.quantity);
                    const icon = this.assetLoader.getImage(itemConfig.assetPath);
                    if (icon) {
                        ctx.drawImage(icon, detailX, currentY, this.ingredientIconSize, this.ingredientIconSize);
                    }
                    const text = `${ingredient.quantity} x ${itemConfig.name}`;
                    const color = playerHasEnough ? 'lightgreen' : 'salmon';
                    this.renderer.drawText(text, detailX + this.ingredientIconSize + 5, currentY + this.ingredientIconSize / 2, color, '14px Arial');
                    currentY += this.ingredientIconSize + 5; // Move down for next ingredient
                }
            }
            
            // Required Tool / Station (Optional) - TODO
            currentY += 15;
            if(this.selectedRecipe.requiredToolId){
                 this.renderer.drawText(`Requires Tool: ${getItemConfig(this.selectedRecipe.requiredToolId)?.name || 'Unknown'}`, detailX, currentY, 'orange', '12px Arial');
                 currentY += 15;
            }
             if(this.selectedRecipe.requiredStationId){
                 this.renderer.drawText(`Requires Station: ${this.selectedRecipe.requiredStationId}`, detailX, currentY, 'orange', '12px Arial');
                 currentY += 15;
            }


            // Craft Button
            const canCraft = this.craftingManager.canCraft(this.selectedRecipe.id);
            ctx.fillStyle = canCraft ? (this.craftButtonHover ? '#6f6' : '#4a4') : '#555'; // Green if craftable, gray otherwise
            ctx.fillRect(this.craftButtonX, this.craftButtonY, this.craftButtonWidth, this.craftButtonHeight);
            ctx.strokeStyle = canCraft ? '#cfc' : '#888';
            ctx.strokeRect(this.craftButtonX, this.craftButtonY, this.craftButtonWidth, this.craftButtonHeight);
            this.renderer.drawText("Craft", this.craftButtonX + this.craftButtonWidth / 2, this.craftButtonY + this.craftButtonHeight / 2, canCraft ? 'white' : 'darkgray', 'bold 16px Arial');
            ctx.textAlign = 'center'; // Ensure text is centered
            ctx.textBaseline = 'middle';
        }

        ctx.restore();
    }
} 