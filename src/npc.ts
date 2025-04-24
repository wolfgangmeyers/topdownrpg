export class NPC {
    id: string;
    x: number;
    y: number;
    svgPath: string;
    dialogue: string[];

    constructor(id: string, x: number, y: number, svgPath: string, dialogue: string[]) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.svgPath = svgPath;
        this.dialogue = dialogue;
    }

    // Future methods for interaction, movement, etc. can go here
} 