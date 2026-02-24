import Papa from 'papaparse';

/**
 * Load and parse the CSV file, normalizing numeric audio features.
 * @param {string} url - Path to CSV file
 * @returns {Promise<Array>} Parsed track objects
 */
export async function loadCSV(url) {
    const response = await fetch(url);
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete(results) {
                const tracks = results.data.map(normalizeTracks).filter(Boolean);
                resolve(tracks);
            },
            error(err) {
                reject(err);
            },
        });
    });
}

const NUMERIC_FIELDS = [
    'Danceability', 'Energy', 'Valence', 'Tempo', 'Acousticness',
    'Loudness', 'Speechiness', 'Instrumentalness', 'Liveness',
    'Popularity', 'Duration (ms)', 'Key', 'Mode', 'Time Signature',
];

function normalizeTracks(row) {
    if (!row['Track Name'] || !row['Track URI']) return null;

    const track = { ...row };

    // Cast numeric fields
    for (const field of NUMERIC_FIELDS) {
        track[field] = parseFloat(track[field]) || 0;
    }

    // Extract Spotify track ID from URI (spotify:track:XXXX)
    const parts = (track['Track URI'] || '').split(':');
    track.spotifyId = parts.length === 3 ? parts[2] : null;

    // Normalize tempo to 0–1 (typical range 40–220 BPM)
    track.tempoNorm = Math.max(0, Math.min(1, (track.Tempo - 40) / 180));

    // Normalize loudness to 0–1 (typical range -60 to 0 dB)
    track.loudnessNorm = Math.max(0, Math.min(1, (track.Loudness + 60) / 60));

    return track;
}
