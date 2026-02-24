/**
 * UI rendering and interaction logic.
 */

import { search, buildExplanation } from './search.js';

const SLIDERS_CONFIG = [
    { key: 'Danceability', label: 'Danceability', min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: 'Energy', label: 'Energy', min: 0, max: 1, step: 0.01, default: 0.70 },
    { key: 'Valence', label: 'Valence', min: 0, max: 1, step: 0.01, default: 0.50 },
    { key: 'Tempo', label: 'Tempo (BPM)', min: 40, max: 220, step: 1, default: 128 },
    { key: 'Acousticness', label: 'Acousticness', min: 0, max: 1, step: 0.01, default: 0.15 },
];

const FEATURE_DISPLAY = [
    { key: 'Danceability', label: 'Danceability' },
    { key: 'Energy', label: 'Energy' },
    { key: 'Valence', label: 'Valence' },
    { key: 'Acousticness', label: 'Acousticness' },
    { key: 'Speechiness', label: 'Speechiness' },
    { key: 'Instrumentalness', label: 'Instrumental' },
    { key: 'Liveness', label: 'Liveness' },
    { key: 'loudnessNorm', label: 'Loudness' },
];

export class UI {
    constructor(tracks, visualizer) {
        this.tracks = tracks;
        this.visualizer = visualizer;
        this.selectedResult = null;
        this.sliderValues = {};

        this.els = {
            searchInput: document.getElementById('search-input'),
            searchBtn: document.getElementById('search-btn'),
            slidersGrid: document.getElementById('sliders-grid'),
            resultsSection: document.getElementById('results-section'),
            resultsUl: document.getElementById('results-ul'),
            trackInfo: document.getElementById('track-info'),
            spotifyEmbed: document.getElementById('spotify-embed'),
            embedWrapper: document.getElementById('embed-wrapper'),
            explanationText: document.getElementById('explanation-text'),
            featureBars: document.getElementById('feature-bars'),
            trackCount: document.getElementById('track-count'),
        };

        this.init();
    }

    init() {
        this.renderSliders();
        this.bindEvents();
        this.els.trackCount.textContent = this.tracks.length;
    }

    renderSliders() {
        const grid = this.els.slidersGrid;
        grid.innerHTML = '';

        for (const config of SLIDERS_CONFIG) {
            this.sliderValues[config.key] = config.default;

            const group = document.createElement('div');
            group.className = 'slider-group';

            const displayValue = config.key === 'Tempo'
                ? `${config.default} BPM`
                : `${(config.default * 100).toFixed(0)}%`;

            group.innerHTML = `
        <div class="slider-label-row">
          <span class="slider-label">${config.label}</span>
          <span class="slider-value" id="slider-val-${config.key}">${displayValue}</span>
        </div>
        <input type="range"
          id="slider-${config.key}"
          min="${config.min}"
          max="${config.max}"
          step="${config.step}"
          value="${config.default}"
        />
      `;

            grid.appendChild(group);

            const slider = group.querySelector('input[type="range"]');
            const valueEl = group.querySelector('.slider-value');



            slider.addEventListener('input', () => {
                const val = parseFloat(slider.value);
                this.sliderValues[config.key] = val;

                if (config.key === 'Tempo') {
                    valueEl.textContent = `${Math.round(val)} BPM`;
                } else {
                    valueEl.textContent = `${(val * 100).toFixed(0)}%`;
                }


            });
        }
    }



    bindEvents() {
        this.els.searchBtn.addEventListener('click', () => this.performSearch());

        this.els.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
    }

    performSearch() {
        const query = this.els.searchInput.value;
        const params = {
            query,
            sliders: { ...this.sliderValues },
        };

        const results = search(this.tracks, params, 5);

        if (results.length === 0) {
            this.els.resultsUl.innerHTML = '<li class="result-item" style="opacity:1"><span class="result-item-name">No matches found</span><span class="result-item-artist">Try a different search or adjust sliders</span></li>';
            this.els.resultsSection.classList.remove('hidden');
            return;
        }

        this.renderResults(results, params);
    }

    renderResults(results, params) {
        const section = this.els.resultsSection;
        section.classList.remove('hidden');

        // Render list
        const ul = this.els.resultsUl;
        ul.innerHTML = '';

        results.forEach((result, i) => {
            const li = document.createElement('li');
            li.className = 'result-item';
            li.innerHTML = `
        <span class="result-item-name">${this.escapeHtml(result.track['Track Name'])}</span>
        <span class="result-item-artist">${this.escapeHtml(result.track['Artist Name(s)'])}</span>
        <span class="result-item-score">${(result.score * 100).toFixed(0)}% match</span>
      `;

            li.addEventListener('click', () => {
                this.selectResult(result, params);
                // Toggle active
                ul.querySelectorAll('.result-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
            });

            ul.appendChild(li);
        });

        // Auto-select first result
        this.selectResult(results[0], params);
        ul.querySelector('.result-item').classList.add('active');

        // Scroll to results
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    selectResult(result, params) {
        this.selectedResult = result;
        const track = result.track;

        // Update visualizer
        this.visualizer.setTrack(track);

        // Update track info
        this.els.trackInfo.innerHTML = `
      <div class="track-info-name">${this.escapeHtml(track['Track Name'])}</div>
      <div class="track-info-artist">${this.escapeHtml(track['Artist Name(s)'])}</div>
      <div class="track-info-album">${this.escapeHtml(track['Album Name'])}</div>
    `;

        // Update Spotify embed
        if (track.spotifyId) {
            this.els.spotifyEmbed.src = `https://open.spotify.com/embed/track/${track.spotifyId}?utm_source=generator&theme=0`;
            this.els.embedWrapper.style.display = 'block';
        } else {
            this.els.embedWrapper.style.display = 'none';
        }

        // Update explanation
        this.els.explanationText.textContent = buildExplanation(result, params);

        // Update feature bars
        this.renderFeatureBars(track);
    }

    renderFeatureBars(track) {
        const container = this.els.featureBars;
        container.innerHTML = '';

        for (const feat of FEATURE_DISPLAY) {
            const val = track[feat.key] || 0;
            const pct = (val * 100).toFixed(0);

            const group = document.createElement('div');
            group.className = 'feature-bar-group';
            group.innerHTML = `
        <div class="feature-bar-label">
          <span>${feat.label}</span>
          <span>${pct}%</span>
        </div>
        <div class="feature-bar-track">
          <div class="feature-bar-fill" style="width: 0%"></div>
        </div>
      `;
            container.appendChild(group);

            // Animate bar fill
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    group.querySelector('.feature-bar-fill').style.width = `${pct}%`;
                });
            });
        }
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
}
