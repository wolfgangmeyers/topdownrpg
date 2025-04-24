import { Renderer } from './renderer';
import { Player } from './player';
import { InputHandler } from './input';
import { AssetLoader } from './assets';
import { Scene, GameScene } from './scene'; // Import Scene classes
import { Tree } from './tree'; // Import Tree for type info if needed elsewhere
import { House } from './house'; // Import House
import { AudioPlayer } from './audio'; // Import AudioPlayer
// Import items
import { ITEM_CONFIG } from './item'; 
// Import NPC later when needed
// import { NPC } from './npc';

// Define placeable object types
export type PlaceableObjectType = 'Tree' | 'House';
export const PLACEABLE_OBJECT_CONFIG: Record<PlaceableObjectType, { assetPath: string }> = {
    'Tree': { assetPath: '/assets/svg/tree.svg' },
    'House': { assetPath: '/assets/svg/house.svg' },
};

// --- Player Save Data --- 
const PLAYER_SAVE_KEY = 'topdown_playerSave';

interface PlayerPosition {
    x: number;
    y: number;
}

interface PlayerSaveData {
    currentSceneId: string;
    position: PlayerPosition;
    inventory?: Array<{ id: string; quantity: number }>; // Make optional for backward compatibility
    equippedItemId?: string | null; // Make optional
}
// --- End Player Save Data ---

export class Game {
    private renderer: Renderer;
    private inputHandler: InputHandler;
    private assetLoader: AssetLoader;
    private player: Player | null = null; // Keep player reference if needed globally
    private currentScene: Scene | null = null;
    private audioPlayer: AudioPlayer; // Add AudioPlayer instance
    private isLoading: boolean = true; // Flag to check if initial loading is done
    public creativeModeEnabled: boolean = false; // Add creative mode flag
    public selectedObjectType: PlaceableObjectType = 'Tree'; // Track selected object
    // private npcs: NPC[] = []; // Keep track of NPCs later
    private lastTimestamp: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.renderer = new Renderer(canvas);
        this.inputHandler = new InputHandler();
        this.assetLoader = new AssetLoader();
        this.audioPlayer = new AudioPlayer(); // Instantiate AudioPlayer
        this.inputHandler.initialize(canvas, this.renderer);
        // --- Resume Audio Context on User Interaction ---
        // Add a listener to resume audio context on the first click/keypress
        const resumeAudio = () => {
            this.audioPlayer.resumeContext();
            // Remove the listener after the first interaction
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('keydown', resumeAudio);
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('keydown', resumeAudio);
        // --- End Resume Audio Context ---
        this.init();
    }

    private async init(): Promise<void> {
        this.isLoading = true;
        console.log("Initializing game systems...");
        try {
            // --- Load Sounds ---
            console.log("Loading sounds...");
            // Using Promise.all to load sounds concurrently
            await Promise.all([
                this.audioPlayer.loadSound('axe-hit', '/assets/axe-swing.mp3'),
                this.audioPlayer.loadSound('axe-miss', '/assets/axe-swing-miss.mp3'),
                this.audioPlayer.loadSound('tree-fall', '/assets/tree-fall.mp3') // Add tree fall sound
                // Add other sounds here
            ]);
            console.log("Sounds loaded.");
            // --- End Load Sounds ---

            // --- Load Player Data (from localStorage) ---
            const savedPlayerData = this.loadPlayerData();
            let initialPlayerPos = { x: this.renderer.getWidth() / 2, y: this.renderer.getHeight() / 2 };
            let initialSceneId = 'defaultForest'; // Default scene ID

            if (savedPlayerData) {
                initialPlayerPos = savedPlayerData.position;
                initialSceneId = savedPlayerData.currentSceneId;
                console.log(`Player save data found: Starting in scene [${initialSceneId}] at (${initialPlayerPos.x.toFixed(0)}, ${initialPlayerPos.y.toFixed(0)})`);
            } else {
                 console.log(`No player save data found. Starting in default scene: ${initialSceneId}`);
            }
            // --- End Load Player Data ---

            // Load common assets (like player) first
            const playerSvgPath = '/assets/svg/player.svg';
            await this.assetLoader.loadImages([playerSvgPath]);

            const playerImg = this.assetLoader.getImage(playerSvgPath);
            const playerWidth = playerImg ? playerImg.naturalWidth : 50;
            const playerHeight = playerImg ? playerImg.naturalHeight : 50;
            
            // Create player instance (position will be set *after* creation)
            this.player = new Player(
                initialPlayerPos.x, // Use loaded/default position
                initialPlayerPos.y,
                playerWidth,
                playerHeight,
                playerSvgPath
            );

            // --- Restore Player Inventory & Equipment from Save Data ---
            if (this.player && savedPlayerData) {
                const player = this.player; // Assign to local const
                console.log("Restoring player inventory and equipment...");
                let assetsToLoad = new Set<string>();

                // Clear default inventory/equipment before loading
                player.inventory.clear();
                player.equippedItemId = null;

                // Restore inventory
                if (savedPlayerData.inventory && Array.isArray(savedPlayerData.inventory)) {
                    savedPlayerData.inventory.forEach(savedSlot => {
                        const itemConfig = ITEM_CONFIG[savedSlot.id];
                        if (itemConfig) {
                            player.addItem(savedSlot.id, savedSlot.quantity);
                            // Add asset path to set for loading
                            assetsToLoad.add(itemConfig.assetPath);
                        } else {
                            console.warn(`Item config for saved item '${savedSlot.id}' not found. Skipping.`);
                        }
                    });
                }

                // Restore equipped item (only if it exists in restored inventory)
                if (savedPlayerData.equippedItemId && player.inventory.has(savedPlayerData.equippedItemId)) {
                    player.equipItem(savedPlayerData.equippedItemId);
                    // Asset should already be in assetsToLoad from inventory loop
                } else if (savedPlayerData.equippedItemId) {
                    console.warn(`Saved equipped item '${savedPlayerData.equippedItemId}' not found in restored inventory. Unequipping.`);
                }

                // Load assets for all restored items
                if (assetsToLoad.size > 0) {
                    console.log("Loading assets for restored items...");
                    await this.assetLoader.loadImages(Array.from(assetsToLoad));
                }
                 console.log('Restored Inventory:', player.inventory);
                 console.log('Restored Equipped Item ID:', player.equippedItemId);

            } else if (this.player && !savedPlayerData) {
                // Use local const here too for consistency, though maybe not strictly needed
                const player = this.player;
                // --- Give Starting Items (Only if NO save data) --- 
                console.log("No save data found, giving default starting items...");
                const axeId = 'axe';
                if (ITEM_CONFIG[axeId]) {
                    // Ensure asset is loaded
                    await this.assetLoader.loadImages([ITEM_CONFIG[axeId].assetPath]);
                    player.addItem(axeId, 1);
                    player.equipItem(axeId);
                } else {
                    console.warn(`Item config for starting item '${axeId}' not found.`);
                }
                 console.log('Default Inventory:', player.inventory);
            }
            // --- End Item Handling ---

            // --- Final Check: Ensure Player has Axe for Testing ---
            if (this.player && !this.player.inventory.has('axe')) {
                 console.warn("Player didn't have axe after load/init. Giving one for testing.");
                 const axeId = 'axe';
                 if (ITEM_CONFIG[axeId]) {
                     // Ensure asset is loaded (might be redundant, but safe)
                     await this.assetLoader.loadImages([ITEM_CONFIG[axeId].assetPath]);
                     this.player.addItem(axeId, 1);
                     // Equip it if nothing else is equipped
                     if (!this.player.equippedItemId) {
                         this.player.equipItem(axeId);
                     }
                 } else {
                     console.error(`Item config for required testing item '${axeId}' not found!`);
                 }
            }
            // --- End Final Check ---

            // Load the initial scene using the determined ID
            // For now, we only have GameScene, use the ID
            this.currentScene = new GameScene(initialSceneId, this.renderer, this.inputHandler, this.assetLoader, this.player, this.audioPlayer);
            await this.currentScene.load(); // Load scene-specific assets and populate

            // Ensure player position is correctly set from save data *after* scene potentially repositioning
            // Although in current setup, scene doesn't move player on load.
            // If scene load logic *did* reset player pos, we'd re-apply here:
            // if (savedPlayerData) { 
            //    this.player.x = initialPlayerPos.x;
            //    this.player.y = initialPlayerPos.y;
            // }

            this.isLoading = false;
            console.log('Game initialized and initial scene loaded.');

            // Initialize NPCs later
            // this.npcs.push(new NPC('npc1', 100, 100, '/assets/svg/npc.svg', ['Hello there!']));
            // await this.assetLoader.loadImages(this.npcs.map(npc => npc.svgPath)); // Load NPC assets too

        } catch (error) {
            console.error("Failed to initialize game:", error);
            // Display error to user?
        }
    }

    // --- Player State Save/Load ---
    private savePlayerData(): void {
        if (!this.player || !this.currentScene) {
            console.warn('Cannot save player data: Player or Scene not available.');
            return;
        }
        try {
            // Convert Map to a serializable format (e.g., array of [key, value])
            const inventoryData = Array.from(this.player.inventory.entries()).map(([key, slot]) => {
                return { id: key, quantity: slot.quantity }; // Only save ID and quantity
            });

            const saveData: PlayerSaveData = {
                currentSceneId: this.currentScene.getId(),
                position: { x: this.player.x, y: this.player.y },
                inventory: inventoryData, // Add inventory data
                equippedItemId: this.player.equippedItemId, // Add equipped item ID
            };
            localStorage.setItem(PLAYER_SAVE_KEY, JSON.stringify(saveData));
            console.log('Player data saved.', saveData);
        } catch (error) {
            console.error('Failed to save player data:', error);
        }
    }

    private loadPlayerData(): PlayerSaveData | null {
        try {
            const savedData = localStorage.getItem(PLAYER_SAVE_KEY);
            if (!savedData) {
                return null;
            }
            const parsedData: PlayerSaveData = JSON.parse(savedData);
            // Add more validation later if needed (e.g., check schema)
            if (parsedData && parsedData.currentSceneId && parsedData.position) {
                 console.log('Player data loaded from localStorage.', parsedData);
                 // Data is now returned and restoration happens in init()
                return parsedData;
            }
             console.warn('Loaded player data invalid format.');
             localStorage.removeItem(PLAYER_SAVE_KEY); // Clear invalid data
             return null;
        } catch (error) {
            console.error('Failed to load player data:', error);
            localStorage.removeItem(PLAYER_SAVE_KEY); // Clear potentially corrupt data
            return null;
        }
    }
    // --- End Player State Save/Load ---

    public update(timestamp: number): void {
        if (this.isLoading || !this.currentScene) return; // Don't update until ready

        const deltaTime = (timestamp - (this.lastTimestamp || timestamp)) / 1000; // Delta time in seconds
        this.lastTimestamp = timestamp;

        // Delegate update to the current scene
        this.currentScene.update(deltaTime, this.creativeModeEnabled, this.selectedObjectType);

        // Check for creative mode toggle
        if (this.inputHandler.toggleCreativeModePressed) {
            this.creativeModeEnabled = !this.creativeModeEnabled;
            console.log(`Creative Mode: ${this.creativeModeEnabled ? 'Enabled' : 'Disabled'}`);
        }

        // Check for placeable object selection change (only if creative mode is on)
        if (this.creativeModeEnabled && this.inputHandler.placeableSelectionKeyPressed) {
            const key = this.inputHandler.placeableSelectionKeyPressed;
            if (key === '1') {
                this.selectedObjectType = 'Tree';
                console.log('Selected: Tree');
            } else if (key === '2') {
                this.selectedObjectType = 'House';
                console.log('Selected: House');
            }
            // Add more else if blocks for keys '3', '4', etc. later
        }

        // Check for Save action
        if (this.inputHandler.saveKeyPressed && this.currentScene) {
            // Save Scene to IndexedDB
            (this.currentScene as GameScene).saveState(); 
            // Save Player Data to LocalStorage
            this.savePlayerData();
        }

        // Load action (F9) removed previously
        /*
        if (this.inputHandler.loadKeyPressed && this.currentScene) {
            // ... load logic removed ...
        }
        */

        // --- Handle UI Interactions --- 
        if (this.inputHandler.uiMouseClicked && this.player) {
            this.handleInventoryClick();
        }
        // --- End UI Interactions ---

        // Reset input handler flags for next frame
        this.inputHandler.resetFrameState();
    }

    // --- Handle Inventory Click --- 
    private handleInventoryClick(): void {
        if (!this.player) return;

        const clickX = this.inputHandler.mouseScreenPosition.x;
        const clickY = this.inputHandler.mouseScreenPosition.y;

        // Replicate inventory layout calculations from Renderer.drawInventoryUI
        const slotSize = 50;
        const padding = 10;
        const maxSlots = 10;
        const inventoryWidth = maxSlots * (slotSize + padding) - padding;
        const startX = (this.renderer.getWidth() - inventoryWidth) / 2;
        const startY = this.renderer.getHeight() - slotSize - padding;
        const endX = startX + inventoryWidth;
        const endY = startY + slotSize;

        // Check if click is within the inventory bar bounds
        if (clickX >= startX && clickX <= endX && clickY >= startY && clickY <= endY) {
            // Calculate which slot index was clicked (0 to maxSlots - 1)
            const clickedSlotIndex = Math.floor((clickX - startX) / (slotSize + padding));

            // Map the clicked slot index to the item ID in the inventory Map
            let itemToEquipId: string | null = null;
            let currentSlotIndex = 0;
            for (const itemId of this.player.inventory.keys()) {
                if (currentSlotIndex === clickedSlotIndex) {
                    itemToEquipId = itemId;
                    break;
                }
                currentSlotIndex++;
                if (currentSlotIndex >= maxSlots) break; // Don't check beyond visible slots
            }

            // If an item exists in that slot, attempt to equip it
            if (itemToEquipId) {
                console.log(`Inventory slot ${clickedSlotIndex} clicked, attempting to equip item: ${itemToEquipId}`);
                this.player.equipItem(itemToEquipId);
            } else {
                console.log(`Inventory slot ${clickedSlotIndex} clicked, but it's empty.`);
                // Optionally unequip if clicking an empty slot?
                // this.player.unequipItem(); 
            }
        }
    }
    // --- End Handle Inventory Click ---

    public draw(): void {
        if (this.isLoading || !this.currentScene) {
            // Optional: Draw loading state
            this.renderer.clear();
            const ctx = this.renderer.getContext();
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.renderer.getWidth() / 2, this.renderer.getHeight() / 2);
            return;
        } 

        // Delegate draw to the current scene
        this.currentScene.draw(this.creativeModeEnabled, this.selectedObjectType);

        // --- Draw Inventory UI --- 
        // Always draw if player exists
        if (this.player) {
            this.renderer.drawInventoryUI(this.player.inventory, this.player.equippedItemId, this.assetLoader);
        }
        // --- End Draw Inventory UI ---
    }
    
    // Boundary check logic is now moved to the scene
} 