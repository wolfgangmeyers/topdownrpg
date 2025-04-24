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
    public placeableSelectionKeyPressed: string | null = null; // e.g., '1', '2'
    public saveKeyPressed: boolean = false;
    public loadKeyPressed: boolean = false;
    public useToolPressed: boolean = false; // Flag for tool usage (left click in gameplay)
    public interactPressed: boolean = false; // Flag for interaction key (E)

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
            this.keys.add(e.key);
            // Prevent default scrolling for arrow keys and space
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
            // Check for delete key press
            if (e.key === 'Delete') {
                this.deletePressed = true;
            }
            // Check for creative mode toggle press
            if (e.key === 'c' || e.key === 'C') {
                // Use a flag that gets reset after processing to avoid rapid toggling
                this.toggleCreativeModePressed = true; 
            }
            // Check for placeable selection keys
            if (e.key === '1' || e.key === '2') { // Extend later for more keys
                this.placeableSelectionKeyPressed = e.key;
            }
            // Check for Save/Load keys (F5/F9)
            if (e.key === 'F5') {
                e.preventDefault(); // Prevent browser save action
                this.saveKeyPressed = true;
            }
            if (e.key === 'F9') {
                e.preventDefault(); // Prevent browser search action (less common)
                this.loadKeyPressed = true;
            }
            // Check for Interaction key
            if (e.key === 'e' || e.key === 'E') {
                this.interactPressed = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key);
            // Reset delete key flag on keyup
            if (e.key === 'Delete') {
                this.deletePressed = false;
            }
            this.saveKeyPressed = false; // Reset save key flag
            this.loadKeyPressed = false; // Reset load key flag
            this.useToolPressed = false; // Reset tool usage flag
            this.interactPressed = false; // Reset interact flag
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
                this.mouseClicked = true; // For world
                this.uiMouseClicked = true; // For UI
                // Set useToolPressed here as well (logic in Game/Scene will check creative mode)
                this.useToolPressed = true; 
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

    // Call this at the end of each update loop to reset single-frame flags
    public resetFrameState(): void {
        this.mouseClicked = false;
        this.uiMouseClicked = false; // Reset UI click flag
        this.toggleCreativeModePressed = false;
        this.placeableSelectionKeyPressed = null; // Reset selection key
        this.saveKeyPressed = false; // Reset save key flag
        this.loadKeyPressed = false; // Reset load key flag
        this.useToolPressed = false; // Reset tool usage flag
        this.interactPressed = false; // Reset interact flag
        // Note: deletePressed is reset on keyup, might need adjustment based on usage
    }

    public isKeyPressed(key: string): boolean {
        return this.keys.has(key);
    }

    // Get movement direction based on arrow keys
    public getMovementDirection(): { dx: number; dy: number } {
        let dx = 0;
        let dy = 0;

        if (this.isKeyPressed('ArrowLeft') || this.isKeyPressed('a')) {
            dx -= 1;
        }
        if (this.isKeyPressed('ArrowRight') || this.isKeyPressed('d')) {
            dx += 1;
        }
        if (this.isKeyPressed('ArrowUp') || this.isKeyPressed('w')) {
            dy -= 1;
        }
        if (this.isKeyPressed('ArrowDown') || this.isKeyPressed('s')) {
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

    // Check for interaction key (example)
    // --- Keep isKeyPressed for continuous check if needed later ---
    // public isInteractKeyPressed(): boolean {
    //     // Using 'e' or 'E'
    //     return this.isKeyPressed('e') || this.isKeyPressed('E');
    // }
    // --- Use interactPressed flag for single frame action ---
} 