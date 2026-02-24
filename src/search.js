/**
 * Search and rank tracks by text similarity and/or audio-feature distance.
 */

const FEATURE_KEYS = ['Danceability', 'Energy', 'Valence', 'tempoNorm', 'Acousticness'];

/**
 * Run a combined search over the track library.
 * @param {Array} tracks - Full track library
 * @param {Object} params - { query: string, sliders: { Danceability, Energy, Valence, Tempo, Acousticness } }
 * @param {number} limit - Number of results to return
 * @returns {Array<{ track, score, reasons }>}
 */
export function search(tracks, params, limit = 5) {
    const { query = '', sliders = null } = params;
    const hasQuery = query.trim().length > 0;
    const hasSliders = sliders && Object.values(sliders).some(v => v !== null);

    if (!hasQuery && !hasSliders) return [];

    // Normalize slider tempo to 0–1 (sliders give 40–220)
    const normalizedSliders = hasSliders ? {
        Danceability: sliders.Danceability,
        Energy: sliders.Energy,
        Valence: sliders.Valence,
        tempoNorm: Math.max(0, Math.min(1, (sliders.Tempo - 40) / 180)),
        Acousticness: sliders.Acousticness,
    } : null;

    const scored = tracks.map(track => {
        let textScore = 0;
        let featureScore = 0;
        const reasons = [];

        // TEXT SCORING
        if (hasQuery) {
            textScore = computeTextScore(track, query.trim().toLowerCase());
        }

        // FEATURE SCORING (lower distance = better, convert to 0–1 score where 1 is best)
        if (normalizedSliders) {
            const dist = euclideanDistance(track, normalizedSliders);
            featureScore = 1 - dist; // dist is max √5 ≈ 2.24, so normalize
            const maxDist = Math.sqrt(FEATURE_KEYS.length); // max possible distance
            featureScore = 1 - (dist / maxDist);
        }

        // COMBINED SCORE
        let score;
        if (hasQuery && hasSliders) {
            score = textScore * 0.55 + featureScore * 0.45;
        } else if (hasQuery) {
            score = textScore;
        } else {
            score = featureScore;
        }

        // Build reason
        if (hasQuery && textScore > 0) {
            reasons.push(buildTextReason(track, query.trim()));
        }
        if (hasSliders) {
            reasons.push(buildSliderReason(track, normalizedSliders, sliders));
        }

        return { track, score, reasons };
    });

    // Filter out zero-score text-only searches
    const filtered = hasQuery
        ? scored.filter(s => s.score > 0)
        : scored;

    // Sort descending by score
    filtered.sort((a, b) => b.score - a.score);

    return filtered.slice(0, limit);
}

function computeTextScore(track, queryLower) {
    const name = (track['Track Name'] || '').toLowerCase();
    const artist = (track['Artist Name(s)'] || '').toLowerCase();
    const album = (track['Album Name'] || '').toLowerCase();

    let score = 0;

    // Exact match bonuses
    if (name === queryLower) score += 1.0;
    else if (name.startsWith(queryLower)) score += 0.8;
    else if (name.includes(queryLower)) score += 0.6;

    if (artist === queryLower) score += 0.9;
    else if (artist.includes(queryLower)) score += 0.5;

    if (album.includes(queryLower)) score += 0.2;

    // Fuzzy: check individual words
    const words = queryLower.split(/\s+/);
    if (words.length > 1) {
        const matchedWords = words.filter(w => name.includes(w) || artist.includes(w));
        score += (matchedWords.length / words.length) * 0.3;
    }

    return Math.min(score, 1);
}

function euclideanDistance(track, target) {
    let sum = 0;
    for (const key of FEATURE_KEYS) {
        const diff = (track[key] || 0) - (target[key] || 0);
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

function buildTextReason(track, query) {
    const name = track['Track Name'] || '';
    const artist = track['Artist Name(s)'] || '';
    if (name.toLowerCase().includes(query.toLowerCase())) {
        return `Matched your search "${query}" in the track name`;
    }
    if (artist.toLowerCase().includes(query.toLowerCase())) {
        return `Found "${query}" among the artists`;
    }
    return `Partial match for "${query}"`;
}

function buildSliderReason(track, normalizedSliders, rawSliders) {
    // Find the closest-matching and farthest features
    const diffs = FEATURE_KEYS.map(key => ({
        key,
        diff: Math.abs((track[key] || 0) - (normalizedSliders[key] || 0)),
        trackVal: track[key] || 0,
        targetVal: normalizedSliders[key] || 0,
    }));

    diffs.sort((a, b) => a.diff - b.diff);

    const best = diffs[0];
    const displayName = best.key === 'tempoNorm' ? 'Tempo' : best.key;
    const trackDisplay = best.key === 'tempoNorm'
        ? `${Math.round(track.Tempo)} BPM`
        : `${(best.trackVal * 100).toFixed(0)}%`;

    return `Closest on ${displayName} (${trackDisplay}) — strong alignment with your slider settings`;
}

/**
 * Generate a full explanation string for a result.
 */
export function buildExplanation(result, params) {
    const parts = result.reasons || [];
    const scorePercent = (result.score * 100).toFixed(0);
    const intro = `Match confidence: ${scorePercent}%. `;
    return intro + parts.join('. ') + '.';
}
