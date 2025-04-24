export class House {
    x: number;
    y: number;
    width: number;
    height: number;
    svgPath: string;

    constructor(x: number, y: number, width: number, height: number, svgPath: string = '/assets/svg/house.svg') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.svgPath = svgPath;
    }

    // Houses are static for now
    // update(deltaTime: number): void { ... }
} 