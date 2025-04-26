export class House {
    public readonly svgPath: string = '/assets/svg/house.svg';
    public id: string; // Unique identifier for this house instance

    constructor(
        public x: number, 
        public y: number, 
        public width: number, 
        public height: number,
        id?: string // Optional ID for loading
    ) {
        // Generate a new UUID if no ID is provided (e.g., when placed in creative mode)
        this.id = id || crypto.randomUUID();
    }

    // Houses are static for now
    // update(deltaTime: number): void { ... }
} 