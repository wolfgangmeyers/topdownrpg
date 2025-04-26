// Handles rendering to the canvas
console.log("Renderer module loaded."); 

export class Renderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public cameraX: number = 0;
    public cameraY: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2D rendering context');
        }
        this.ctx = context;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    private resizeCanvas(): void {
        // Set canvas logical size to match its display size
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
    }

    public clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Optionally fill background if needed
        // this.ctx.fillStyle = '#222'; // Dark grey background
        // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Updated drawBackground: Assumes camera transform is already applied.
    // Draws the pattern covering the entire specified world dimensions.
    // Removed: drawBackground
    // public drawBackground(pattern: CanvasPattern | null, worldWidth: number, worldHeight: number): void { ... }

    // --- New: Draw Tile --- 
    /**
     * Draws a single tile image at a specific screen location.
     * Assumes the image asset is already loaded.
     * Assumes camera transform is ALREADY applied if drawing relative to world.
     * @param image The HTMLImageElement for the tile.
     * @param x The top-left screen x-coordinate to draw the tile at.
     * @param y The top-left screen y-coordinate to draw the tile at.
     * @param tileSize The width and height of the tile.
     */
    public drawTile(image: HTMLImageElement, x: number, y: number, tileSize: number): void {
        // Simple drawing at the specified location and size
        // Draw slightly larger (e.g., by 1 pixel) to cover potential gaps
        const overlap = 1;
        this.ctx.drawImage(image, x, y, tileSize + overlap, tileSize + overlap);
    }
    // --- End: Draw Tile ---

    // Example draw method (will be expanded)
    public drawPlaceholder(x: number, y: number, color: string = 'red'): void {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x - 25, y - 25, 50, 50); // Draw a 50x50 square
    }

    // Method to draw loaded SVGs, now with rotation
    public drawImage(image: CanvasImageSource, x: number, y: number, width: number, height: number, rotation: number = 0): void {
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        this.ctx.save(); // Save the current context state
        this.ctx.translate(x, y); // Translate the context origin to the image center
        this.ctx.rotate(rotation); // Rotate the context
        
        // Draw the image centered on the new origin
        this.ctx.drawImage(image, -halfWidth, -halfHeight, width, height);
        
        this.ctx.restore(); // Restore the context state
    }
    
    // --- Creative Mode Draw Helpers ---

    public drawGhostImage(image: CanvasImageSource, x: number, y: number, width: number, height: number): void {
        this.ctx.save();
        this.ctx.globalAlpha = 0.5; // Make it semi-transparent
        // Draw without rotation for simplicity, centered on cursor
        this.ctx.drawImage(image, x - width / 2, y - height / 2, width, height); 
        this.ctx.restore();
    }

    public drawHighlight(x: number, y: number, width: number, height: number, color: string = 'rgba(255, 255, 0, 0.5)'): void {
        this.ctx.save();
        this.ctx.fillStyle = color; // Semi-transparent yellow
        // Draw centered rectangle
        this.ctx.fillRect(x - width / 2, y - height / 2, width, height);
        this.ctx.restore();
    }

    public drawText(text: string, x: number, y: number, color: string = 'white', font: string = '16px Arial'): void {
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.font = font;
        this.ctx.textAlign = 'left'; // Default alignment
        this.ctx.textBaseline = 'top'; // Default baseline
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }

    // Method to update camera position (can be called from Scene)
    public updateCamera(x: number, y: number): void {
        this.cameraX = x;
        this.cameraY = y;
    }

    // --- End Creative Mode Draw Helpers ---

    public getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    public getWidth(): number {
        return this.canvas.width;
    }

    public getHeight(): number {
        return this.canvas.height;
    }

    // --- Draw Pickup Prompt --- 
    /**
     * Draws text styled as a pickup prompt above a world location.
     */
    public drawPickupPrompt(text: string, x: number, y: number, width: number, height: number): void {
        this.ctx.save();
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom'; // Position text above the item
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent black background
        const textMetrics = this.ctx.measureText(text);
        const padding = 4;
        const boxWidth = textMetrics.width + padding * 2;
        const boxHeight = 12 + padding * 2; // Approx height based on font size
        const boxX = x - boxWidth / 2;
        const boxY = y - height / 2 - boxHeight - 5; // Position above item bounds + small gap

        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        this.ctx.fillStyle = 'white'; // White text
        this.ctx.fillText(text, x, boxY + boxHeight - padding);
        
        this.ctx.restore();
    }
    // --- End Draw Pickup Prompt ---

    // --- Draw Health Bar --- 
    public drawHealthBar(x: number, y: number, width: number, currentHealth: number, maxHealth: number): void {
        if (currentHealth < 0) currentHealth = 0;
        if (currentHealth > maxHealth) currentHealth = maxHealth;

        const barWidth = Math.max(40, width * 0.6); // Bar width relative to object width, min 40px
        const barHeight = 8;
        const barX = x - barWidth / 2;
        const barY = y - (width / 2) - barHeight - 5; // Position above the object (using width for offset feels okay for tree)

        const healthPercent = currentHealth / maxHealth;

        this.ctx.save();
        // Background
        this.ctx.fillStyle = '#555'; // Dark grey background
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health Fill
        this.ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : (healthPercent > 0.2 ? '#FFC107' : '#F44336'); // Green -> Yellow -> Red
        this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // Border (optional)
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        this.ctx.restore();
    }
    // --- End Draw Health Bar ---

    // --- Draw Inventory UI ---
    public drawInventoryUI(inventory: Map<string, { item: import('./item').Item, quantity: number }>, 
                           equippedItemId: string | null,
                           assetLoader: import('./assets').AssetLoader): void {

        const slotSize = 50; // Size of each inventory slot square
        const padding = 10; // Padding around slots and screen edge
        const maxSlots = 10; // Max slots to display in a row
        const inventoryWidth = maxSlots * (slotSize + padding) - padding;
        const startX = (this.getWidth() - inventoryWidth) / 2; // Center the inventory bar
        const startY = this.getHeight() - slotSize - padding; // Position at the bottom

        // Draw background panel for the inventory bar
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(startX - padding, startY - padding, inventoryWidth + padding * 2, slotSize + padding * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX - padding, startY - padding, inventoryWidth + padding * 2, slotSize + padding * 2);
        
        // Iterate through inventory items (up to maxSlots)
        let slotIndex = 0;
        for (const [itemId, slotData] of inventory.entries()) {
            if (slotIndex >= maxSlots) break;

            const slotX = startX + slotIndex * (slotSize + padding);
            const slotY = startY;

            // Draw slot background
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.fillRect(slotX, slotY, slotSize, slotSize);
            
            // Draw item image
            const itemImg = assetLoader.getImage(slotData.item.assetPath);
            if (itemImg) {
                const itemPadding = 5;
                const imgSize = slotSize - itemPadding * 2;
                // Draw image centered in the slot
                 this.ctx.drawImage(itemImg, slotX + itemPadding, slotY + itemPadding, imgSize, imgSize);
            } else {
                // Draw placeholder text if image not loaded
                this.ctx.fillStyle = '#555';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('ERR', slotX + slotSize / 2, slotY + slotSize / 2);
            }

            // Draw quantity text if stackable and quantity > 1
            if (slotData.item.stackable && slotData.quantity > 1) {
                this.ctx.font = 'bold 12px Arial';
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Black background for text
                const text = slotData.quantity.toString();
                const textMetrics = this.ctx.measureText(text);
                const textX = slotX + slotSize - padding / 2;
                const textY = slotY + slotSize - padding / 2;
                this.ctx.fillRect(textX - textMetrics.width - 2, textY - 12, textMetrics.width + 4, 14);
                this.ctx.fillStyle = 'white';
                this.ctx.textAlign = 'right';
                this.ctx.textBaseline = 'bottom';
                this.ctx.fillText(text, textX, textY);
            }

            // Highlight equipped item
            if (itemId === equippedItemId) {
                this.ctx.strokeStyle = 'yellow';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(slotX, slotY, slotSize, slotSize);
            }

            slotIndex++;
        }

        // Draw empty slots
        for (let i = slotIndex; i < maxSlots; i++) {
            const slotX = startX + i * (slotSize + padding);
            const slotY = startY;
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            this.ctx.fillRect(slotX, slotY, slotSize, slotSize);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(slotX, slotY, slotSize, slotSize); 
        }
        
        this.ctx.restore();
    }
    // --- End Draw Inventory UI ---

    // --- REMOVED drawCreativePanel --- 
    // Logic moved to ui/creativeModeSelector.ts
    // public drawCreativePanel(...) { ... }

    // --- New Method: Draw Debug Rectangle Outline (World Coords) ---
    /**
     * Draws a rectangle outline for debugging purposes at world coordinates.
     * Assumes the input box uses center coordinates.
     */
    drawDebugRect(box: { x: number, y: number, width: number, height: number }, color: string): void {
        if (!this.ctx) return;

        const halfWidth = box.width / 2;
        const halfHeight = box.height / 2;
        
        // Calculate top-left corner in world coordinates
        const worldX = box.x - halfWidth;
        const worldY = box.y - halfHeight;

        // Convert top-left corner to screen coordinates using the camera
        // REMOVED: The context is already translated by the caller (SceneRenderer)
        // const screenX = worldX - this.cameraX;
        // const screenY = worldY - this.cameraY;

        // Set drawing style
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]); // Dashed line for debug

        // Draw the rectangle outline at world coordinates (context is translated)
        this.ctx.strokeRect(worldX, worldY, box.width, box.height);

        // Reset line dash
        this.ctx.setLineDash([]); 
    }
    // --- End New Method ---
} 