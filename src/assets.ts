// Handles loading and managing assets (SVGs, sounds, etc.)
console.log("Assets module loaded.");

export class AssetLoader {
    private imageCache: Map<string, HTMLImageElement>;
    private loadingPromises: Map<string, Promise<HTMLImageElement>>;

    constructor() {
        this.imageCache = new Map();
        this.loadingPromises = new Map();
    }

    public loadImage(path: string): Promise<HTMLImageElement> {
        // Return cached image if already loaded
        if (this.imageCache.has(path)) {
            return Promise.resolve(this.imageCache.get(path)!);
        }

        // Return existing promise if already loading
        if (this.loadingPromises.has(path)) {
            return this.loadingPromises.get(path)!;
        }

        // Load the image
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(path, img);
                this.loadingPromises.delete(path); // Remove promise once loaded
                resolve(img);
            };
            img.onerror = (err) => {
                console.error(`Failed to load image: ${path}`, err);
                this.loadingPromises.delete(path); // Remove promise on error
                reject(new Error(`Failed to load image: ${path}`));
            };
            // Vite handles asset serving, use the path directly
            img.src = path;
        });

        this.loadingPromises.set(path, promise);
        return promise;
    }

    public async loadImages(paths: string[]): Promise<void> {
        const promises = paths.map(path => this.loadImage(path));
        await Promise.all(promises);
        console.log('All requested assets loaded.');
    }

    public getImage(path: string): HTMLImageElement | undefined {
        return this.imageCache.get(path);
    }
} 