/**
 * SFaucet — Entry Point
 */

import { loadCSV } from './data.js';
import { Visualizer } from './visualizer.js';
import { UI } from './ui.js';

async function main() {
    const loader = document.getElementById('loader');

    try {
        const tracks = await loadCSV('/allsongs.csv');
        console.log(`Loaded ${tracks.length} tracks`);

        const vizCanvas = document.getElementById('viz-canvas');
        const visualizer = new Visualizer(vizCanvas);

        new UI(tracks, visualizer);

        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 300);
    } catch (err) {
        console.error('Failed to load:', err);
        loader.textContent = 'Failed to load data.';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
