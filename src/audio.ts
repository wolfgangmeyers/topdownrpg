console.log("AudioPlayer module loaded.");

export class AudioPlayer {
    private audioContext: AudioContext;
    private soundBuffers: Map<string, AudioBuffer>;
    private isLoading: Set<string>; // Track sounds currently being loaded

    constructor() {
        // Check for browser compatibility
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
            console.error("Web Audio API is not supported in this browser.");
            // Provide a fallback or disable audio
            this.audioContext = null as any; // Assign null/dummy if not supported
            this.soundBuffers = new Map();
            this.isLoading = new Set();
            return;
        }
        this.audioContext = new AudioContext();
        this.soundBuffers = new Map();
        this.isLoading = new Set();
    }

    /**
     * Loads a sound file from the given path and caches the AudioBuffer.
     * @param id Unique identifier for the sound.
     * @param path Path to the audio file.
     */
    async loadSound(id: string, path: string): Promise<void> {
        if (!this.audioContext) return; // Do nothing if AudioContext is not supported
        if (this.soundBuffers.has(id) || this.isLoading.has(id)) {
            // Already loaded or currently loading
            return;
        }

        console.log(`Loading sound: ${id} from ${path}`);
        this.isLoading.add(id);

        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${path}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.soundBuffers.set(id, audioBuffer);
            console.log(`Sound loaded and decoded: ${id}`);
        } catch (error) {
            console.error(`Failed to load or decode sound ${id} at ${path}:`, error);
            // Optional: remove from loading set on error?
        } finally {
            this.isLoading.delete(id); // Remove from loading set when done (success or fail)
        }
    }

    /**
     * Plays a loaded sound by its ID.
     * @param id The unique identifier of the sound to play.
     * @param volume Optional volume level (0.0 to 1.0). Defaults to 1.0.
     */
    play(id: string, volume: number = 1.0): void {
        if (!this.audioContext) return; // Do nothing if AudioContext is not supported

        const buffer = this.soundBuffers.get(id);
        if (!buffer) {
            console.warn(`Sound not found or not loaded yet: ${id}`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        // Add GainNode for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.audioContext.currentTime);

        // Connect source -> gain -> destination
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(0); // Play immediately
    }

    // Optional: Method to resume AudioContext if needed (e.g., after user interaction)
    resumeContext(): void {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('AudioContext resumed successfully.');
            }).catch(e => console.error('Error resuming AudioContext:', e));
        }
    }
} 