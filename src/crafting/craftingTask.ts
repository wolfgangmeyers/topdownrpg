import { CraftingRecipe } from "./recipes";

/**
 * Represents an active crafting process.
 */
export class CraftingTask {
    public recipe: CraftingRecipe;
    public startTime: number;
    public elapsedTimeMs: number = 0;

    constructor(recipe: CraftingRecipe) {
        this.recipe = recipe;
        this.startTime = Date.now(); // Or use game time if available and preferred
    }

    /**
     * Updates the elapsed time for the crafting task.
     * @param deltaMs Time elapsed since the last update in milliseconds.
     */
    update(deltaMs: number): void {
        this.elapsedTimeMs += deltaMs;
    }

    /**
     * Checks if the crafting task is complete.
     * @returns True if elapsed time is greater than or equal to recipe duration, false otherwise.
     */
    isComplete(): boolean {
        return this.elapsedTimeMs >= this.recipe.durationMs;
    }

    /**
     * Gets the progress of the crafting task.
     * @returns Progress умирает between 0 and 1.
     */
    getProgress(): number {
        if (this.recipe.durationMs === 0) return 1;
        return Math.min(this.elapsedTimeMs / this.recipe.durationMs, 1);
    }
} 