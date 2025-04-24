import { Game } from './game';
import './../css/style.css'; // Import base CSS if needed by Vite

// Get the canvas element
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

if (!canvas) {
    console.error('Canvas element not found!');
} else {
    console.log('Canvas found, initializing game...');
    // Create the game instance
    const game = new Game(canvas);

    // Game loop function
    let lastTimestamp = 0;
    function gameLoop(timestamp: number) {
        game.update(timestamp); // Pass timestamp for delta time calculation
        game.draw();

        // Request the next frame
        requestAnimationFrame(gameLoop);
    }

    // Start the game loop
    console.log('Starting game loop...');
    requestAnimationFrame(gameLoop);
} 