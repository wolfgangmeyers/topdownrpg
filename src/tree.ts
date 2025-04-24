export class Tree {
    x: number;
    y: number;
    width: number;
    height: number;
    svgPath: string;

    // --- Health Properties ---
    maxHealth: number;
    currentHealth: number;
    // --- End Health Properties ---

    // --- State ---
    public state: 'STANDING' | 'FALLING' = 'STANDING';
    // --- End State ---

    constructor(x: number, y: number, width: number, height: number, svgPath: string = '/assets/svg/tree.svg', health: number = 100) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.svgPath = svgPath;
        this.maxHealth = health;
        this.currentHealth = health;
    }

    // --- Damage Method ---
    /**
     * Reduces the tree's health by the specified amount.
     * Returns true if the tree's health reached zero or below, false otherwise.
     * // NOTE: This method no longer directly signals destruction via return value.
     * // Scene logic will check health and state after calling this.
     */
    takeDamage(amount: number): void {
        if (this.state !== 'STANDING') return; // Can only damage standing trees

        this.currentHealth -= amount;
        console.log(`Tree at (${this.x.toFixed(0)}, ${this.y.toFixed(0)}) took ${amount} damage. Health: ${this.currentHealth}/${this.maxHealth}`);
        if (this.currentHealth <= 0) {
            this.currentHealth = 0; // Prevent negative health
            // Don't change state here, let the scene handle it
        }
        // No return value needed now
    }
    // --- End Damage Method ---

    // Trees are static for now, so no update method needed yet
    // update(deltaTime: number): void { ... }
} 