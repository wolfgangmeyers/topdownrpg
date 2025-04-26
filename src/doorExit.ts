// Basic structure for the DoorExit static object

export class DoorExit {
    // Target scene and position for when the player uses this exit
    public targetSceneId: string | null = null;
    public targetPosition: { x: number; y: number } | null = null;

    // We might not need specific state for DoorExit initially,
    // but having the class allows it to be managed by EntityManager
    // and potentially have logic added later.

    constructor(
        public x: number, 
        public y: number, 
        public width: number, 
        public height: number
    ) {}

    // Method to set the target destination
    setTarget(sceneId: string, position: { x: number; y: number }): void {
        this.targetSceneId = sceneId;
        this.targetPosition = position;
    }

    // No specific methods needed yet, but could be added
    // e.g., getTriggerBounds() if needed for exit logic
} 