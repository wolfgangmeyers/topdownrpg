/**
 * Defines the structure for an ingredient required in a crafting recipe.
 */
export interface CraftingIngredient {
    itemId: string;    // Unique identifier of the item (e.g., 'stick', 'stone_triangular')
    quantity: number;  // Number of this item required
}

/**
 * Defines the structure for a crafting recipe.
 */
export interface CraftingRecipe {
    id: string;                // Unique identifier for the recipe (e.g., 'knife_from_stone')
    outputItemId: string;      // Item ID of the crafted item (e.g., 'knife')
    outputQuantity: number;    // How many items are produced by this recipe
    ingredients: CraftingIngredient[]; // List of ingredients
    durationMs: number;        // Time in milliseconds to complete the craft
    requiredToolId?: string;   // Optional: Item ID of a tool that must be equipped
    requiredStationId?: string;// Optional: ID of a static object (crafting station) the player must be interacting with
    name: string;              // Display name for the recipe in the UI (e.g., "Craft Knife")
    description?: string;      // Optional: Short description for the UI
}

/**
 * Configuration object holding definitions for all known crafting recipes.
 */
export const CRAFTING_RECIPES: Record<string, CraftingRecipe> = {
    'knife_from_resources': {
        id: 'knife_from_resources',
        outputItemId: 'knife',
        outputQuantity: 1,
        name: 'Knife',
        description: 'Craft a basic knife from a stick and a sharp stone.',
        ingredients: [
            { itemId: 'stick', quantity: 1 },
            { itemId: 'stone_triangular', quantity: 1 }
        ],
        durationMs: 2000, // 2 seconds
        // requiredToolId: undefined, // No specific tool needed, just hands
        // requiredStationId: undefined, // No specific station needed
    },
    // Add more recipes here later (e.g., axe, pickaxe, workbench)
};

// Helper function to get a recipe by its ID
export function getCraftingRecipe(recipeId: string): CraftingRecipe | undefined {
    return CRAFTING_RECIPES[recipeId];
} 