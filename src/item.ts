/**
 * Defines the types of items available in the game.
 */
export enum ItemType {
    TOOL = 'TOOL',
    RESOURCE = 'RESOURCE',
    WEAPON = 'WEAPON',
    // Add other types like CONSUMABLE, ARMOR etc. later
}

/**
 * Interface defining the basic properties of any item.
 */
export interface Item {
    id: string;          // Unique identifier (e.g., 'axe', 'wood_log')
    name: string;        // Display name (e.g., 'Axe', 'Wood Log')
    assetPath: string;   // Path to the SVG asset for rendering
    stackable: boolean;  // Can multiple instances exist in one inventory slot?
    maxStackSize?: number; // How many can stack (if stackable)
    equipable: boolean;  // Can this item be equipped by the player?
    itemType: ItemType;  // The category of the item
    // Add item-specific properties later (e.g., damage for weapons/tools, effect for consumables)
}

/**
 * Configuration object holding definitions for all known items.
 * Similar pattern to PLACEABLE_OBJECT_CONFIG in game.ts.
 */
export const ITEM_CONFIG: { [key: string]: Item } = {
    'axe': {
        id: 'axe',
        name: 'Axe',
        assetPath: '/assets/svg/axe.svg', // Needs to be created
        stackable: false,
        equipable: true,
        itemType: ItemType.TOOL,
        // Add axe-specific properties like damage, range later
    },
    'wood_log': {
        id: 'wood_log',
        name: 'Wood Log',
        assetPath: '/assets/svg/log.svg', // Will be created next
        stackable: true,
        maxStackSize: 50, // Example stack size
        equipable: false,
        itemType: ItemType.RESOURCE,
    }
    // Add more items here as needed
};

// Helper function to get item config by ID
export function getItemConfig(itemId: string): Item | undefined {
    return ITEM_CONFIG[itemId];
} 