import { Item, getItemConfig } from './item'; // Import Item definition

// Define a structure for items in the inventory
export interface InventorySlot {
    item: Item;
    quantity: number;
}

export class Player {
    x: number;
    y: number;
    width: number;
    height: number;
    svgPath: string;
    speed: number;
    rotation: number;

    // --- Inventory & Equipment --- 
    // Using a Map for easier lookup by item ID
    inventory: Map<string, InventorySlot> = new Map();
    equippedItemId: string | null = null; // ID of the equipped item, or null

    // --- Animation State --- 
    isSwinging: boolean = false;
    private swingTimer: number = 0;
    private readonly swingDuration: number = 0.3; // Duration of the swing animation in seconds
    private readonly swingMaxAngle: number = Math.PI / 12; // Reduced swing angle (15 degrees)
    // --- End Animation State ---

    constructor(x: number, y: number, width: number, height: number, svgPath: string, speed: number = 5) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.svgPath = svgPath;
        this.speed = speed;
        this.rotation = 0;
    }

    // Basic movement method (will be driven by input)
    move(dx: number, dy: number): void {
        this.x += dx * this.speed;
        this.y += dy * this.speed;
    }

    // Placeholder for update logic (e.g., animations, state changes)
    update(deltaTime: number, mousePosition: { x: number; y: number }): void {
        const dx = mousePosition.x - this.x;
        const dy = mousePosition.y - this.y;
        // Only update rotation if mouse moves (prevents snapping on load)
        // We might need a threshold check later
        if (dx !== 0 || dy !== 0) { 
            this.rotation = Math.atan2(dy, dx) + Math.PI / 2;
        }

        // --- Update Swing Animation --- 
        if (this.isSwinging) {
            this.swingTimer += deltaTime;
            if (this.swingTimer >= this.swingDuration) {
                this.isSwinging = false;
                this.swingTimer = 0;
            }
        }
        // --- End Update Swing Animation ---
    }

    // --- Inventory Methods --- 

    /**
     * Adds an item to the player's inventory.
     * Handles stacking if the item is stackable and already exists.
     * Returns true if the item was added successfully, false otherwise.
     */
    addItem(itemId: string, quantity: number = 1): boolean {
        const itemConfig = getItemConfig(itemId);
        if (!itemConfig) {
            console.warn(`Attempted to add unknown item: ${itemId}`);
            return false;
        }

        const existingSlot = this.inventory.get(itemId);

        if (existingSlot) {
            // Item exists, check if stackable
            if (itemConfig.stackable && itemConfig.maxStackSize) {
                const canAdd = itemConfig.maxStackSize - existingSlot.quantity;
                const amountToAdd = Math.min(quantity, canAdd);
                if (amountToAdd > 0) {
                    existingSlot.quantity += amountToAdd;
                    console.log(`Added ${amountToAdd} ${itemConfig.name}(s) to stack. Total: ${existingSlot.quantity}`);
                    // TODO: Handle leftover quantity if stack is full?
                    return true; 
                } else {
                    console.log(`Cannot add ${itemConfig.name}, stack is full.`);
                    return false; // Stack full
                }
            } else {
                // Item exists but isn't stackable (or no max size defined), cannot add more
                console.log(`Cannot add another ${itemConfig.name}, item is not stackable or has no max size.`);
                return false; 
            }
        } else {
            // New item, check if stackable and quantity within limits
            if (itemConfig.stackable && itemConfig.maxStackSize && quantity > itemConfig.maxStackSize) {
                console.warn(`Cannot add ${quantity} ${itemConfig.name}, exceeds max stack size of ${itemConfig.maxStackSize}. Adding max possible.`);
                quantity = itemConfig.maxStackSize;
            } else if (!itemConfig.stackable && quantity > 1) {
                console.warn(`Cannot add ${quantity} ${itemConfig.name}, item is not stackable. Adding 1.`);
                quantity = 1;
            }

            this.inventory.set(itemId, { item: itemConfig, quantity: quantity });
            console.log(`Added ${quantity} ${itemConfig.name}(s) to inventory.`);
            return true;
        }
    }

    /**
     * Removes an item from the player's inventory.
     * Returns true if the item was removed successfully, false otherwise.
     */
    removeItem(itemId: string, quantity: number = 1): boolean {
        const existingSlot = this.inventory.get(itemId);

        if (!existingSlot) {
            console.warn(`Attempted to remove item not in inventory: ${itemId}`);
            return false;
        }

        if (existingSlot.quantity > quantity) {
            // Remove partial quantity
            existingSlot.quantity -= quantity;
            console.log(`Removed ${quantity} ${existingSlot.item.name}(s). Remaining: ${existingSlot.quantity}`);
            return true;
        } else if (existingSlot.quantity === quantity) {
            // Remove the entire stack/item
            this.inventory.delete(itemId);
            // Unequip if this was the equipped item
            if (this.equippedItemId === itemId) {
                this.unequipItem();
            }
            console.log(`Removed all ${existingSlot.item.name}(s) from inventory.`);
            return true;
        } else {
            // Not enough to remove
            console.warn(`Cannot remove ${quantity} ${existingSlot.item.name}(s), only have ${existingSlot.quantity}.`);
            return false;
        }
    }

    /**
     * Equips an item from the inventory.
     * Returns true if successful, false otherwise.
     */
    equipItem(itemId: string): boolean {
        const inventorySlot = this.inventory.get(itemId);
        if (!inventorySlot) {
            console.warn(`Cannot equip ${itemId}, not in inventory.`);
            return false;
        }
        if (!inventorySlot.item.equipable) {
            console.warn(`Cannot equip ${itemId}, item is not equipable.`);
            return false;
        }

        // Unequip current item first if any
        if (this.equippedItemId) {
            this.unequipItem(); // Simple unequip for now
        }

        this.equippedItemId = itemId;
        console.log(`Equipped ${inventorySlot.item.name}.`);
        // TODO: Apply item effects/stats if applicable
        return true;
    }

    /**
     * Unequips the currently equipped item.
     */
    unequipItem(): void {
        if (this.equippedItemId) {
            const item = getItemConfig(this.equippedItemId);
            console.log(`Unequipped ${item ? item.name : 'item'}.`);
            this.equippedItemId = null;
            // TODO: Remove item effects/stats if applicable
        }
    }

    /**
     * Gets the Item object for the currently equipped item.
     */
    getEquippedItem(): Item | null {
        if (!this.equippedItemId) return null;
        const slot = this.inventory.get(this.equippedItemId);
        return slot ? slot.item : null;
    }

    // --- Animation Control Methods --- 
    startSwing(): void {
        if (!this.isSwinging) { // Prevent restarting swing if already swinging
            this.isSwinging = true;
            this.swingTimer = 0;
        }
    }

    // Calculate the current angle offset for the swing animation
    getSwingAngleOffset(): number {
        if (!this.isSwinging) {
            return 0;
        }
        // Simple ease-in-out curve using sine for the angle
        const progress = this.swingTimer / this.swingDuration;
        // Swing out and back: angle goes from 0 -> maxAngle -> 0
        const angleOffset = Math.sin(progress * Math.PI) * this.swingMaxAngle;
        // Negate the offset to swing in the opposite direction
        return -angleOffset;
    }
    // --- End Animation Control Methods ---

    // Placeholder for drawing logic (will likely be handled by Renderer + AssetLoader)
    // draw(ctx: CanvasRenderingContext2D): void { ... }
} 