import { Renderer } from './renderer';
import { Player } from './player';
import { InputHandler } from './input';
import { AssetLoader } from './assets';
import { Scene, GameScene } from './scene'; // Import Scene classes
import { AudioPlayer } from './audio'; // Import AudioPlayer
// Import items
import { ITEM_CONFIG, Item } from './item'; 
// Import Terrain types for Scene/Player state, but not config
import { TerrainType } from './terrain';
// Import the new selector and its types
import { CreativeModeSelector, PlaceableObjectType } from './ui/creativeModeSelector'; 
// Import database functions for scene regeneration
import { loadSceneState, saveSceneState, deleteSceneState } from './db';

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
    private currentSceneId: string = 'world-0-0'; // Track current scene ID, default is now world-0-0 instead of defaultForest
    private audioPlayer: AudioPlayer; // Add AudioPlayer instance
    private creativeModeSelector: CreativeModeSelector; // Add the selector instance
    private isLoading: boolean = true; // Flag to check if initial loading is done
    public creativeModeEnabled: boolean = false; // Keep this global flag

    // private npcs: NPC[] = []; // Keep track of NPCs later
    private lastTimestamp: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.renderer = new Renderer(canvas);
        this.inputHandler = new InputHandler();
        this.assetLoader = new AssetLoader();
        this.audioPlayer = new AudioPlayer(); // Instantiate AudioPlayer
        // Instantiate the CreativeModeSelector, passing dependencies
        this.creativeModeSelector = new CreativeModeSelector(
            this.renderer, 
            this.inputHandler, 
            this.assetLoader, 
            ITEM_CONFIG,
            this.currentSceneId // Pass current scene ID
        );
        this.inputHandler.initialize(canvas, this.renderer);
        // --- Resume Audio Context on User Interaction ---
        // Add a listener to resume audio context on the first click/keypress
        const resumeAudio = async () => {
            await this.audioPlayer.resumeContext();
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('keydown', resumeAudio);
            console.log("AudioContext Resumed");
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('keydown', resumeAudio);
        // --- End Resume Audio Context ---
        this.init();
    }

    private async init(): Promise<void> {
        try {
            this.isLoading = true;
            console.log("Game Initializing...");

            // --- Load Sounds ---
            await this.loadSounds(); // Wait for sounds to load
            // --- End Load Sounds ---
            
            // Load creative mode selector assets
            await this.creativeModeSelector.loadAssets();

            // --- Load Player Data ---
            const savedPlayerData = this.loadPlayerData(); // Get currentSceneId from saved data
            if (savedPlayerData) {
                this.currentSceneId = savedPlayerData.currentSceneId;
            }
            // --- End Load Player Data ---

            console.log(`Starting with scene: ${this.currentSceneId}`);
            
            // Create player with loaded data if exists
            const playerSvgPath = '/assets/svg/player.svg';
            await this.assetLoader.loadImages([playerSvgPath]);
            const playerImg = this.assetLoader.getImage(playerSvgPath);
            const playerWidth = playerImg ? playerImg.naturalWidth : 50;
            const playerHeight = playerImg ? playerImg.naturalHeight : 50;
            
            this.player = new Player(0, 0, playerWidth, playerHeight, playerSvgPath);
            
            // Restore save data if it exists
            await this.restorePlayerState();
            
            // Create initial scene, using the loaded scene ID
            this.currentScene = new GameScene(this.currentSceneId, this, this.renderer, this.inputHandler, this.assetLoader, this.player, this.audioPlayer);
            
            // Load the scene async (asset loading, state retrieval, etc)
            await this.currentScene.load();
            
            // Set player to scene center initially
            // (better to set explicitly than trust the save data, as scene could have changed)
            const dimensions = this.currentScene.getWorldDimensions();
            this.player.x = dimensions.width / 2;
            this.player.y = dimensions.height / 2;
            
            // Start game loop once initialization is complete
            this.lastTimestamp = performance.now();
            requestAnimationFrame(this.update.bind(this));
            this.isLoading = false;
            console.log("Game Initialized");
        } catch (error) {
            console.error("Error initializing game:", error);
            // Possibly show error to user
        }
    }

    // --- Player Data Persistence (kept in Game for now) ---
    private savePlayerData(): void {
        if (!this.player) return;
        const data: PlayerSaveData = {
            currentSceneId: this.currentSceneId,
            position: { x: this.player.x, y: this.player.y },
            // Corrected inventory mapping to use slot.item.id
            inventory: Array.from(this.player.inventory.values()).map(slot => ({ id: slot.item.id, quantity: slot.quantity })),
            equippedItemId: this.player.equippedItemId
        };
        try {
            localStorage.setItem(PLAYER_SAVE_KEY, JSON.stringify(data));
            console.log("Player data saved.");
        } catch (error) {
            console.error("Error saving player data to localStorage:", error);
        }
    }

    private loadPlayerData(): PlayerSaveData | null {
        try {
            const saved = localStorage.getItem(PLAYER_SAVE_KEY);
            if (saved) {
                const data = JSON.parse(saved) as PlayerSaveData;
                // Basic validation
                if (data && typeof data.currentSceneId === 'string' && data.position && typeof data.position.x === 'number') {
                    return data;
                }
            }
        } catch (error) {
            console.error("Error loading player data from localStorage:", error);
        }
        return null;
    }
    // --- End Player Data --- 

    public update(timestamp: number): void {
        if (this.isLoading) {
             this.renderer.clear(); // Call clear with no arguments
             // Use correct font string format
             this.renderer.drawText('Loading...', this.renderer.getWidth() / 2 - 50, this.renderer.getHeight() / 2, 'white', '24px Arial'); 
             requestAnimationFrame(this.update.bind(this)); 
             return; 
        }
        if (!this.currentScene || !this.player) return; // Add player check

        const deltaTime = (timestamp - (this.lastTimestamp || timestamp)) / 1000; // Delta time in seconds
        this.lastTimestamp = timestamp;

        // Update the creative mode selector first (handles its own input)
        this.creativeModeSelector.update(this.creativeModeEnabled);
        
        // Handle scene regeneration if requested
        if (this.creativeModeSelector.regenerateCurrentScene && this.currentScene instanceof GameScene) {
            console.log("Game: Handling scene regeneration request");
            this.handleSceneRegeneration();
            return; // Exit update cycle to prevent further processing during regeneration
        }

        // Delegate update to the current scene - pass selection state from the selector
        this.currentScene.update(
            deltaTime, 
            this.creativeModeEnabled, 
            this.creativeModeSelector.selectedObjectType, 
            this.creativeModeSelector.selectedTerrainType,
            this.creativeModeSelector.selectedItemId,
            this.creativeModeSelector.deleteMode
        );

        // Check for creative mode toggle
        if (this.inputHandler.toggleCreativeModePressed) {
            this.creativeModeEnabled = !this.creativeModeEnabled;
            console.log(`Creative Mode: ${this.creativeModeEnabled ? 'Enabled' : 'Disabled'}`);
            
            // If exiting creative mode, also exit delete mode
            if (!this.creativeModeEnabled && this.creativeModeSelector.deleteMode) {
                this.creativeModeSelector.deleteMode = false;
            }
            
            // Optional: Reset selection when toggling mode?
            // this.creativeModeSelector.selectedObjectType = 'Tree'; // Or keep last selection
            // this.creativeModeSelector.selectedTerrainType = null;
        }

        // Check for Save action (Manual F5)
        if (this.inputHandler.saveKeyPressed) {
            this.saveGame(); // Call the unified save method
        }

        // TEMP: Check for Debug Teleport
        if (this.inputHandler.teleportDebugPressed) {
            // Save current scene state BEFORE changing
            this.currentScene.save().then(() => {
                this.changeScene('world-0-0');
            }).catch(err => {
                console.error("Error saving scene before teleport:", err);
                this.changeScene('world-0-0');
            });
            // Exit update early to prevent further processing while async save/change happens
            return; 
        }

        // --- Handle UI Interactions --- 
        // Only need to handle inventory clicks here now
        if (this.inputHandler.uiMouseClicked || this.inputHandler.uiDropActionClicked) {
            // handleInventoryClick returns true if it handled the click
            if (!this.handleInventoryClick()) {
                // If not inventory, the creative selector handled its own click in its update method
                // No further action needed here for creative panel clicks.
            }
        }
        // --- End UI Interactions ---

        // Reset input handler flags for next frame (moved after teleport check)
        // This ensures the teleport flag itself gets reset eventually if teleport doesn't exit early
        // However, the return above makes this redundant for the teleport case.
        // It's still needed for other flags.
        this.inputHandler.resetFrameState();
    }

    // --- Handle Inventory Click --- 
    /**
     * Attempts to handle a click within the inventory bar boundaries.
     * Returns true if the click was handled (i.e., within the inventory bar), false otherwise.
     */
    private handleInventoryClick(): boolean {
        // Check if player exists first
        if (!this.player) return false;
        // Only proceed if the current scene is a GameScene
        if (!(this.currentScene instanceof GameScene)) return false;
        const scene = this.currentScene; // Already type-checked

        const clickX = this.inputHandler.mouseScreenPosition.x;
        const clickY = this.inputHandler.mouseScreenPosition.y;

        // Replicate inventory layout calculations from Renderer.drawInventoryUI
        // TODO: Refactor UI layout constants/calculations to avoid duplication (maybe UI manager class later)
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
            let itemIdInSlot: string | null = null;
            let currentSlotIndex = 0;
            // Ensure player inventory exists before iterating
            if (this.player.inventory) {
                for (const itemId of this.player.inventory.keys()) {
                    if (currentSlotIndex === clickedSlotIndex) {
                        itemIdInSlot = itemId;
                        break;
                    }
                    currentSlotIndex++;
                    if (currentSlotIndex >= maxSlots) break; // Don't check beyond visible slots
                }
            }

            // If an item exists in that slot...
            if (itemIdInSlot) {
                // Check if it was a drop action (Shift+Click)
                if (this.inputHandler.uiDropActionClicked) {
                    console.log(`Inventory slot ${clickedSlotIndex} Shift+Clicked, attempting to drop item: ${itemIdInSlot}`);
                    // Attempt to remove 1 item from inventory
                    const dropSuccess = this.player.dropItemById(itemIdInSlot, 1);
                    if (dropSuccess) {
                        // Spawn the item in the world near the player
                        const dropDistance = 30; // Distance in front
                        const angle = this.player.rotation - Math.PI / 2; // Adjust rotation
                        const dropX = this.player.x + Math.cos(angle) * dropDistance;
                        const dropY = this.player.y + Math.sin(angle) * dropDistance;
                        scene.spawnDroppedItemNearPlayer(itemIdInSlot, 1);
                    } else {
                        // Log already handled in player.removeItem/dropItemById
                    }
                } else { // Regular click (Equip action)
                    console.log(`Inventory slot ${clickedSlotIndex} clicked, attempting to equip item: ${itemIdInSlot}`);
                    this.player.equipItem(itemIdInSlot);
                }
            } else {
                console.log(`Inventory slot ${clickedSlotIndex} clicked, but it's empty.`);
                // Optionally unequip if clicking an empty slot with a regular click?
                // if (!this.inputHandler.uiDropActionClicked) {
                //     this.player.unequipItem(); 
                // }
            }
            
            // Consume the click regardless of whether an item was equipped/dropped,
            // as long as the click was within the inventory bounds.
            this.inputHandler.consumeClick();
            return true; // Click was handled by inventory
        } // End if click within inventory bounds
        // Return false if the click was outside the calculated inventory bounds
        return false; 
    }
    // --- End Handle Inventory Click ---

    public draw(): void {
        if (this.isLoading) return; // Don't draw game world while loading
        if (!this.currentScene) {
            // Optional: Draw loading state
            this.renderer.clear();
            const ctx = this.renderer.getContext();
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.renderer.getWidth() / 2, this.renderer.getHeight() / 2);
            return;
        } 

        // Delegate draw to the current scene - pass selection state from selector
        this.currentScene.draw(
            this.creativeModeEnabled, 
            this.creativeModeSelector.selectedObjectType, 
            this.creativeModeSelector.selectedTerrainType,
            this.creativeModeSelector.selectedItemId,
            this.creativeModeSelector.deleteMode
        );

        // --- Draw Inventory UI --- 
        // Always draw if player exists
        if (this.player) {
            this.renderer.drawInventoryUI(this.player.inventory, this.player.equippedItemId, this.assetLoader);
        }
        // --- End Draw Inventory UI ---

        // --- Draw Creative Mode Panel --- 
        // Call the selector's draw method directly
        this.creativeModeSelector.draw(this.creativeModeEnabled);
        // --- End Draw Creative Mode Panel ---
    }
    
    // Boundary check logic is now moved to the scene

    // Save Game delegates to Scene and Player Data
    private async saveGame(): Promise<void> {
         console.log("Saving game...");
         try {
             // 1. Save Player Data (localStorage)
             this.savePlayerData(); // Calls method that uses this.player and this.currentScene

             // 2. Save Scene State (IndexedDB)
             if (this.currentScene) { // Add null check for scene
                await this.currentScene.save();
             } else {
                 console.error("Cannot save scene state: Current scene is null.");
             }

             console.log("Game saved successfully.");
         } catch (error) {
             console.error("Failed to save game:", error);
         }
     }

    // --- Scene Transition Method ---
    public async changeScene(newSceneId: string, contextData?: any): Promise<void> {
        if (!this.player || !this.currentScene) return;
        const oldSceneId = this.currentSceneId;

        this.isLoading = true; 

        // 1. Save the *outgoing* scene state
        try {
            await this.currentScene.save(); 
        } catch (error) {
            console.error(`Error saving outgoing scene [${oldSceneId}]:`, error);
        }

        // 2. Update player state to reflect the *new* scene ID
        this.currentSceneId = newSceneId; 
        // Update the CreativeModeSelector with the new scene ID
        this.creativeModeSelector.updateCurrentSceneId(newSceneId);
        this.savePlayerData(); 

        // 3. Create and load the new scene instance
        // Pass contextData to the GameScene constructor
        this.currentScene = new GameScene(newSceneId, this, this.renderer, this.inputHandler, this.assetLoader, this.player, this.audioPlayer, contextData);
        await this.currentScene.load();

        // 4. Reset player position in the new scene
        // Check if we are entering a house interior
        if (newSceneId.startsWith('interior-')) {
             // Position player near the exit door (bottom center)
             // Assuming 10x10 grid and 64 tileSize for interiors
             const interiorCols = 10;
             const interiorRows = 10;
             const tileSize = this.currentScene.getTileSize(); // Get tileSize from scene
             
             const targetPlayerX = (interiorCols / 2) * tileSize;
             // Place player one tile row above the exit door row (row 9 -> row 8)
             const targetPlayerY = (interiorRows - 2) * tileSize + tileSize / 2; 
             
             this.player.x = targetPlayerX;
             this.player.y = targetPlayerY;
        }
        // Check for targetPosition passed via context (e.g., exiting a house)
        else if (contextData && contextData.targetPosition && 
            typeof contextData.targetPosition.x === 'number' && 
            typeof contextData.targetPosition.y === 'number') 
        {
            this.player.x = contextData.targetPosition.x;
            this.player.y = contextData.targetPosition.y;
        } else {
            // Fallback to center for other scenes
            const dimensions = this.currentScene.getWorldDimensions(); 
            this.player.x = dimensions.width / 2;
            this.player.y = dimensions.height / 2;
        }

        // 5. Reset input state
        this.inputHandler.resetFrameState(); 
        this.inputHandler.resetMovement(); 

        this.isLoading = false;
    }
    // --- End Scene Transition ---

    // Add getter for current scene ID
    public getCurrentSceneId(): string {
        return this.currentSceneId;
    }

    // Add getter for current scene instance
    public getCurrentScene(): any {
        return this.currentScene;
    }

    // Add the loadSounds method
    private async loadSounds(): Promise<void> {
        console.log("Loading sounds...");
        // Using Promise.all to load sounds concurrently
        await Promise.all([
            this.audioPlayer.loadSound('axe-hit', '/assets/audio/axe-hit.mp3'),
            this.audioPlayer.loadSound('axe-miss', '/assets/audio/axe-miss.mp3'),
            this.audioPlayer.loadSound('tree-fall', '/assets/audio/tree-fall.mp3'),
            this.audioPlayer.loadSound('pickup', '/assets/audio/pickup.mp3'),
            this.audioPlayer.loadSound('item-drop', '/assets/audio/drop.mp3')
            // Add other sounds here
        ]);
        console.log("Sounds loaded.");
    }

    // Add the restorePlayerState method
    private async restorePlayerState(): Promise<void> {
        if (!this.player) return;
        
        const savedPlayerData = this.loadPlayerData();
        
        if (savedPlayerData) {
            console.log("Restoring player inventory and equipment...");
            let assetsToLoad = new Set<string>();
            
            // Clear default inventory/equipment before loading
            this.player.inventory.clear();
            this.player.equippedItemId = null;

            // Restore inventory
            if (savedPlayerData.inventory && Array.isArray(savedPlayerData.inventory)) {
                savedPlayerData.inventory.forEach(savedSlot => {
                    const itemConfig = ITEM_CONFIG[savedSlot.id];
                    if (itemConfig) {
                        this.player!.addItem(savedSlot.id, savedSlot.quantity);
                        // Add asset path to set for loading
                        assetsToLoad.add(itemConfig.assetPath);
                    } else {
                        console.warn(`Item config for saved item '${savedSlot.id}' not found. Skipping.`);
                    }
                });
            }

            // Restore equipped item (only if it exists in restored inventory)
            if (savedPlayerData.equippedItemId && this.player.inventory.has(savedPlayerData.equippedItemId)) {
                this.player.equipItem(savedPlayerData.equippedItemId);
            } else if (savedPlayerData.equippedItemId) {
                console.warn(`Saved equipped item '${savedPlayerData.equippedItemId}' not found in restored inventory. Unequipping.`);
            }

            // Load assets for all restored items
            if (assetsToLoad.size > 0) {
                console.log("Loading assets for restored items...");
                await this.assetLoader.loadImages(Array.from(assetsToLoad));
            }
        } else {
            // Give starting items if no save data
            console.log("No save data found, giving default starting items...");
            const axeId = 'axe';
            if (ITEM_CONFIG[axeId]) {
                // Ensure asset is loaded
                await this.assetLoader.loadImages([ITEM_CONFIG[axeId].assetPath]);
                this.player.addItem(axeId, 1);
                this.player.equipItem(axeId);
            }
        }
        
        // Ensure player has axe for testing
        if (this.player && !this.player.inventory.has('axe')) {
            console.warn("Player didn't have axe after load/init. Giving one for testing.");
            const axeId = 'axe';
            if (ITEM_CONFIG[axeId]) {
                await this.assetLoader.loadImages([ITEM_CONFIG[axeId].assetPath]);
                this.player.addItem(axeId, 1);
                if (!this.player.equippedItemId) {
                    this.player.equipItem(axeId);
                }
            }
        }
    }

    /**
     * Handles the regeneration of the current scene.
     * This includes cleaning up any existing scene data, regenerating the scene,
     * and handling associated interior scenes for any houses.
     */
    private async handleSceneRegeneration(): Promise<void> {
        if (!this.currentScene || !(this.currentScene instanceof GameScene)) {
            this.creativeModeSelector.setRegenerationComplete(false, "Error: No valid scene to regenerate");
            return;
        }
        
        // Set loading state to prevent UI interactions
        this.isLoading = true;
        
        try {
            // 1. Load the current scene state to identify houses
            const sceneState = await loadSceneState(this.currentSceneId);
            const linkedInteriors: string[] = [];
            
            // 2. Identify interior scenes linked to houses in this scene
            if (sceneState && sceneState.objects) {
                sceneState.objects.forEach((obj: { type: string; id?: string }) => {
                    if (obj.type === 'House' && obj.id) {
                        const interiorSceneId = `interior-${obj.id}`;
                        linkedInteriors.push(interiorSceneId);
                        console.log(`Found linked interior: ${interiorSceneId}`);
                    }
                });
            }
            
            // 3. Delete all linked interior scenes
            for (const interiorId of linkedInteriors) {
                try {
                    // First clean the interior (remove all objects)
                    const interiorState = await loadSceneState(interiorId);
                    if (interiorState) {
                        const cleanedState = {
                            ...interiorState,
                            objects: [],
                            droppedItems: []
                        };
                        await saveSceneState(interiorId, cleanedState);
                    }
                    
                    // Then delete it
                    await deleteSceneState(interiorId);
                    console.log(`Deleted interior scene: ${interiorId}`);
                } catch (error) {
                    console.error(`Error deleting interior scene ${interiorId}:`, error);
                }
            }
            
            // 4. Regenerate the current scene
            const success = await this.currentScene.regenerateScene();
            
            // 5. Save the regenerated scene
            await this.currentScene.save();
            
            // 6. Reset player position to scene center
            if (this.player) {
                const dimensions = this.currentScene.getWorldDimensions();
                this.player.x = dimensions.width / 2;
                this.player.y = dimensions.height / 2;
            }
            
            // 7. Complete regeneration
            const message = success 
                ? `Scene regenerated (${linkedInteriors.length} interiors removed)`
                : "Error during scene regeneration";
            
            this.creativeModeSelector.setRegenerationComplete(success, message);
        } catch (error) {
            console.error("Error during scene regeneration:", error);
            this.creativeModeSelector.setRegenerationComplete(false, "Error during regeneration");
        } finally {
            // Reset loading state
            this.isLoading = false;
        }
    }
} 