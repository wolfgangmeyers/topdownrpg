import { Renderer } from './renderer'; // Add import

// Handles user input (keyboard/mouse)
console.log("Input module loaded."); 

export class InputHandler {
    private keys: Set<string>;
    public mousePosition: { x: number; y: number }; // World coordinates
    public mouseScreenPosition: { x: number; y: number }; // Screen coordinates (relative to canvas)
    private canvas: HTMLCanvasElement | null = null; // Keep track of the canvas
    public mouseClicked: boolean = false; // For world interactions
    public uiMouseClicked: boolean = false; // For UI interactions
    public toggleCreativeModePressed: boolean = false;
    public deletePressed: boolean = false;
    public saveKeyPressed: boolean = false;
    public loadKeyPressed: boolean = false;
    public useToolPressed: boolean = false; // Flag for tool usage (left click in gameplay)
    public interactPressed: boolean = false; // Flag for interaction key (E)
    public dropItemPressed: boolean = false; // Flag for dropping item (G)
    public uiDropActionClicked: boolean = false; // Flag for Shift+Click on UI
    public teleportDebugPressed: boolean = false; // TEMP: Flag for debug teleport
    public escapePressed: boolean = false; // Flag for escape key
    public craftingActionPressed: boolean = false; // Flag for crafting action key (B)
    
    private renderer: Renderer | null = null; // Add renderer reference

    constructor() {
        this.keys = new Set();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseScreenPosition = { x: 0, y: 0 }; // Initialize screen coords
        // We'll add listeners after the canvas is known
    }

    // Accept Renderer instance
    public initialize(canvas: HTMLCanvasElement, renderer: Renderer): void {
        this.canvas = canvas;
        this.renderer = renderer; // Store renderer
        this.addEventListeners();
    }

    private addEventListeners(): void {
        if (!this.canvas || !this.renderer) return; // Check renderer too
        const canvas = this.canvas;
        const renderer = this.renderer; // Alias for listener scope

        window.addEventListener('keydown', (e) => {
            // Convert to lowercase for case-insensitive tracking
            const lowerCaseKey = e.key.toLowerCase();
            this.keys.add(lowerCaseKey);

            // Prevent default scrolling for arrow keys and space
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(lowerCaseKey)) {
                e.preventDefault();
            }
            // Check for delete key press (using original key for non-alpha)
            if (e.key === 'Delete') {
                this.deletePressed = true;
            }
            // Check for escape key press
            if (e.key === 'Escape') {
                this.escapePressed = true;
            }
            // Check for creative mode toggle press (using lowercase)
            if (lowerCaseKey === 'c') {
                this.toggleCreativeModePressed = true;
            }
            // Check for Save/Load keys (using original key for F-keys)
            if (e.key === 'F5') {
                e.preventDefault(); // Prevent browser save action
                this.saveKeyPressed = true;
            }
            if (e.key === 'F9') {
                e.preventDefault(); // Prevent browser search action (less common)
                this.loadKeyPressed = true;
            }
            // Check for Interaction key (using lowercase)
            if (lowerCaseKey === 'e') {
                this.interactPressed = true;
            }
            // Check for Drop Item key (using lowercase)
            if (lowerCaseKey === 'g') {
                this.dropItemPressed = true;
            }
            // TEMP: Check for debug teleport key
            if (lowerCaseKey === 't') {
                this.teleportDebugPressed = true;
            }
            if (lowerCaseKey === 'b') { // Added for crafting
                this.craftingActionPressed = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            const lowerCaseKey = e.key.toLowerCase();
            this.keys.delete(lowerCaseKey);
            // Reset delete key flag on keyup (using original key)
            if (e.key === 'Delete') {
                this.deletePressed = false;
            }
            // Reset escape key flag on keyup
            if (e.key === 'Escape') {
                this.escapePressed = false;
            }
            this.saveKeyPressed = false; // Reset save key flag
            this.loadKeyPressed = false; // Reset load key flag
            this.useToolPressed = false; // Reset tool usage flag
            this.interactPressed = false; // Reset interact flag
            this.dropItemPressed = false; // Reset drop item flag
            this.uiDropActionClicked = false; // Reset UI drop action flag
            this.teleportDebugPressed = false; // Reset debug flag
            if (lowerCaseKey === 'c') this.toggleCreativeModePressed = false;
            if (e.key === 'F5') this.saveKeyPressed = false;
            if (e.key === 'F9') this.loadKeyPressed = false;
            if (lowerCaseKey === 'e') this.interactPressed = false;
            if (lowerCaseKey === 'g') this.dropItemPressed = false;
            if (lowerCaseKey === 't') this.teleportDebugPressed = false;
            if (lowerCaseKey === 'b') this.craftingActionPressed = false; // Added for crafting
            // Note: deletePressed is reset on keyup, might need adjustment based on usage
        });

        // Optional: Clear keys if window loses focus
        window.addEventListener('blur', () => {
            this.keys.clear();
        });

        // Add mousemove listener
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            // Update screen coordinates
            this.mouseScreenPosition.x = screenX;
            this.mouseScreenPosition.y = screenY;
            // Convert screen coords to world coords
            this.mousePosition.x = screenX + renderer.cameraX;
            this.mousePosition.y = screenY + renderer.cameraY;
        });

        // Add mousedown listener for placing/selecting
        canvas.addEventListener('mousedown', (e) => {
            // Check for left click (button 0)
            if (e.button === 0) {
                // Check if shift key is also pressed for UI drop action
                if (e.shiftKey) {
                    this.uiDropActionClicked = true; 
                    // Ensure other click flags are not set for shift+click
                    this.uiMouseClicked = false; 
                    this.mouseClicked = false; 
                    this.useToolPressed = false;
                } else {
                    // Set flags for potential world AND UI interaction
                    this.mouseClicked = true; 
                    this.uiMouseClicked = true; 
                    this.useToolPressed = true; 
                }
            }
            // Prevent default browser behavior if needed
            // e.preventDefault(); 
        });

        // Optional: Add mouseup listener if needed later
        /*
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                // Could be used for drag-release logic
            }
        });
        */
    }

    /**
     * Consumes the world click flag for this frame. Call this after a UI element
     * successfully handles a click to prevent world interaction.
     */
    public consumeClick(): void {
        // console.log("Click consumed by UI."); // Debugging log
        this.mouseClicked = false;
        this.useToolPressed = false; // Also consume tool usage if UI was clicked
    }

    // Call this at the end of each update loop to reset single-frame flags
    public resetFrameState(): void {
        this.mouseClicked = false;
        this.uiMouseClicked = false; // Reset UI click flag
        this.toggleCreativeModePressed = false;
        this.saveKeyPressed = false; // Reset save key flag
        this.loadKeyPressed = false; // Reset load key flag
        this.useToolPressed = false; // Reset tool usage flag
        this.interactPressed = false; // Reset interact flag
        this.dropItemPressed = false; // Reset drop item flag
        this.uiDropActionClicked = false; // Reset UI drop action flag
        this.teleportDebugPressed = false; // Reset debug flag
        this.escapePressed = false; // Reset escape flag
        this.craftingActionPressed = false; // Reset crafting action flag
        // Note: deletePressed is reset on keyup, might need adjustment based on usage
    }

    public isKeyPressed(key: string): boolean {
        // Ensure check is also lowercase
        return this.keys.has(key.toLowerCase());
    }

    // Get movement direction based on arrow keys
    public getMovementDirection(): { dx: number; dy: number } {
        let dx = 0;
        let dy = 0;

        if (this.isKeyPressed('arrowleft') || this.isKeyPressed('a')) {
            dx -= 1;
        }
        if (this.isKeyPressed('arrowright') || this.isKeyPressed('d')) {
            dx += 1;
        }
        if (this.isKeyPressed('arrowup') || this.isKeyPressed('w')) {
            dy -= 1;
        }
        if (this.isKeyPressed('arrowdown') || this.isKeyPressed('s')) {
            dy += 1;
        }

        // Normalize diagonal movement (optional, prevents faster diagonal speed)
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        return { dx, dy };
    }

    // Add method to reset movement state (clears held keys)
    public resetMovement(): void {
        this.keys.clear(); 
        console.log("InputHandler movement state reset (keys cleared).");
    }

    // Check for interaction key (example)
    // --- Keep isKeyPressed for continuous check if needed later ---
    // public isInteractKeyPressed(): boolean {
    //     // Using 'e' or 'E'
    //     return this.isKeyPressed('e') || this.isKeyPressed('E');
    // }
    // --- Use interactPressed flag for single frame action ---
} 