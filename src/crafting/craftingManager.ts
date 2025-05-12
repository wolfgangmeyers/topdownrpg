import { Player } from '../player';
import { EntityManager } from '../entityManager';
import { CRAFTING_RECIPES, CraftingRecipe, getCraftingRecipe } from './recipes';
import { CraftingTask } from './craftingTask';
import { getItemConfig } from '../item';
import { Game } from '../game'; // For notifying game about crafting state

export class CraftingManager {
    private player: Player;
    private entityManager: EntityManager;
    private game: Game; // Reference to the main game class
    private currentTask: CraftingTask | null = null;

    constructor(player: Player, entityManager: EntityManager, game: Game) {
        this.player = player;
        this.entityManager = entityManager;
        this.game = game;
    }

    /**
     * Checks if the player has the necessary ingredients and tools for a given recipe.
     * @param recipeId The ID of the recipe to check.
     * @returns True if the recipe can be crafted, false otherwise.
     */
    public canCraft(recipeId: string): boolean {
        const recipe = getCraftingRecipe(recipeId);
        if (!recipe) {
            console.warn(`[CraftingManager] Recipe not found: ${recipeId}`);
            return false;
        }

        // Check ingredients
        for (const ingredient of recipe.ingredients) {
            if (!this.player.hasItem(ingredient.itemId, ingredient.quantity)) {
                // console.log(`[CraftingManager] Missing ingredient: ${ingredient.itemId} x${ingredient.quantity}`);
                return false;
            }
        }

        // Check equipped tool (if required)
        if (recipe.requiredToolId && this.player.equippedItemId !== recipe.requiredToolId) {
            // console.log(`[CraftingManager] Required tool not equipped: ${recipe.requiredToolId}`);
            return false;
        }

        // Check crafting station (TODO: Implement later when stations are added)
        if (recipe.requiredStationId) {
            // console.log("[CraftingManager] Crafting station check not yet implemented.");
            // For now, assume if a station is required, it's not met unless we add station logic
            return false; 
        }

        return true;
    }

    /**
     * Starts a crafting task if all conditions are met.
     * @param recipeId The ID of the recipe to craft.
     * @returns True if crafting started, false otherwise.
     */
    public startCrafting(recipeId: string): boolean {
        if (this.currentTask) {
            console.log("[CraftingManager] Another crafting task is already in progress.");
            return false;
        }

        if (!this.canCraft(recipeId)) {
            console.log(`[CraftingManager] Cannot craft ${recipeId}, requirements not met.`);
            return false;
        }

        const recipe = getCraftingRecipe(recipeId)!; // We know it exists from canCraft

        // Consume ingredients
        for (const ingredient of recipe.ingredients) {
            if (!this.player.removeItem(ingredient.itemId, ingredient.quantity)) {
                console.error(`[CraftingManager] Failed to remove ingredient: ${ingredient.itemId} x${ingredient.quantity}. This should not happen if canCraft passed.`);
                // Attempt to roll back any previously removed ingredients (tricky without transactionality)
                // For now, log error and cancel craft.
                this.reimburseConsumedIngredients(recipe, ingredient.itemId);
                return false;
            }
        }

        this.currentTask = new CraftingTask(recipe);
        this.game.setPlayerCraftingState(true); // Notify the game
        console.log(`[CraftingManager] Started crafting: ${recipe.name}`);
        return true;
    }

    /**
     * Helper to reimburse ingredients if something went wrong during consumption.
     */
    private reimburseConsumedIngredients(recipe: CraftingRecipe, failedIngredientId: string): void {
        for (const ingredient of recipe.ingredients) {
            if (ingredient.itemId === failedIngredientId) break; // Stop at the one that failed
            this.player.addItem(ingredient.itemId, ingredient.quantity);
            console.log(`[CraftingManager] Reimbursed: ${ingredient.itemId} x${ingredient.quantity}`);
        }
    }

    /**
     * Cancels the current crafting task and reimburses ingredients.
     */
    public cancelCurrentTask(): void {
        if (this.currentTask) {
            const recipe = this.currentTask.recipe;
            console.log(`[CraftingManager] Crafting cancelled: ${recipe.name}`);
            // Reimburse all ingredients
            for (const ingredient of recipe.ingredients) {
                this.player.addItem(ingredient.itemId, ingredient.quantity);
            }
            this.currentTask = null;
            this.game.setPlayerCraftingState(false); // Notify the game
        }
    }

    /**
     * Updates the current crafting task. Should be called every game frame.
     * @param deltaMs Time elapsed since the last update in milliseconds.
     */
    public update(deltaMs: number): void {
        if (!this.currentTask) return;

        this.currentTask.update(deltaMs);

        if (this.currentTask.isComplete()) {
            const recipe = this.currentTask.recipe;
            console.log(`[CraftingManager] Crafting complete: ${recipe.name}`);

            // Add crafted item to player inventory
            const itemAdded = this.player.addItem(recipe.outputItemId, recipe.outputQuantity);

            if (!itemAdded) {
                console.log('[CraftingManager] Inventory full. Spawning item on ground.');
                // EntityManager might not be directly available here in the same way as in GameScene
                // Game class will need a way to facilitate this, or entityManager needs to be passed differently.
                // For now, assuming Game has a method to do this.
                this.game.spawnItemNearPlayer(recipe.outputItemId, recipe.outputQuantity);
            }
            
            this.currentTask = null;
            this.game.setPlayerCraftingState(false); // Notify the game
        }
    }

    public isCrafting(): boolean {
        return this.currentTask !== null;
    }

    public getActiveCraftingProgress(): number | null {
        return this.currentTask ? this.currentTask.getProgress() : null;
    }

    public getCurrentRecipeName(): string | null {
        return this.currentTask ? this.currentTask.recipe.name : null;
    }

    /**
     * Gets a list of all defined crafting recipes.
     * @returns An array of all CraftingRecipe objects.
     */
    public getAvailableRecipes(): CraftingRecipe[] {
        return Object.values(CRAFTING_RECIPES);
    }
} 