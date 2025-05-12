/**
 * Defines the types of items available in the game.
 */
export enum ItemType {
    TOOL = 'TOOL',
    RESOURCE = 'RESOURCE',
    WEAPON = 'WEAPON',
    PLACEABLE = 'PLACEABLE',
    // Add other types like CONSUMABLE, ARMOR etc. later
}

/**
 * Interface defining the basic properties of any item.
 */
export interface Item {
    id: string;          // Unique identifier (e.g., 'axe', 'wood_log')
    name: string;        // Display name (e.g., 'Axe', 'Wood Log')
    description?: string; // Optional description
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
        description: 'A sturdy axe for chopping wood.',
        assetPath: '/assets/svg/axe.svg',
        itemType: ItemType.TOOL,
        stackable: false,
        equipable: true,
    },
    'log': {
        id: 'log',
        name: 'Log',
        description: 'A piece of wood.',
        assetPath: '/assets/svg/log.svg',
        itemType: ItemType.RESOURCE,
        stackable: true,
        maxStackSize: 50,
        equipable: false,
    },
    'stone_round': {
        id: 'stone_round',
        name: 'Round Stone',
        description: 'A smooth, round stone.',
        assetPath: '/assets/svg/stone_round.svg',
        itemType: ItemType.RESOURCE,
        stackable: true,
        maxStackSize: 50,
        equipable: false,
    },
    'stone_triangular': {
        id: 'stone_triangular',
        name: 'Sharp Stone',
        description: 'A stone with a sharp edge.',
        assetPath: '/assets/svg/stone_triangular.svg',
        itemType: ItemType.RESOURCE,
        stackable: true,
        maxStackSize: 50,
        equipable: false,
    },
    // Add more items here as needed
};

// Helper function to get item config by ID
export function getItemConfig(itemId: string): Item | undefined {
    return ITEM_CONFIG[itemId];
} 