/**
 * Generative audio-feature-driven particle visualizer.
 * Maps track features to visual properties.
 */

export class Visualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.features = null;
        this.targetFeatures = null;
        this.animId = null;
        this.time = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Transition to a new track's audio features.
     */
    setTrack(track) {
        this.targetFeatures = {
            valence: track.Valence || 0,
            energy: track.Energy || 0,
            danceability: track.Danceability || 0,
            tempo: track.tempoNorm || 0,
            loudness: track.loudnessNorm || 0,
            acousticness: track.Acousticness || 0,
            liveness: track.Liveness || 0,
            instrumentalness: track.Instrumentalness || 0,
        };

        if (!this.features) {
            this.features = { ...this.targetFeatures };
        }

        // Reinitialize particles
        this.initParticles();

        if (!this.animId) {
            this.animate();
        }
    }

    initParticles() {
        const count = Math.floor(80 + (this.targetFeatures.danceability || 0) * 180);
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle() {
        const f = this.targetFeatures || this.features || {};
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: 1.5 + Math.random() * 3 * (0.5 + (f.loudness || 0.5)),
            life: Math.random(),
            phase: Math.random() * Math.PI * 2,
            organic: Math.random() < (f.acousticness || 0.3),
        };
    }

    /**
     * Smoothly interpolate features toward target.
     */
    lerpFeatures() {
        if (!this.targetFeatures || !this.features) return;
        const rate = 0.03;
        for (const key of Object.keys(this.targetFeatures)) {
            this.features[key] += (this.targetFeatures[key] - this.features[key]) * rate;
        }
    }

    /**
     * Map valence to hue. Low valence → cool blues/purples, high → warm oranges/pinks.
     */
    getHue() {
        const v = this.features.valence;
        // 0 → 240 (blue), 0.5 → 300 (purple/pink), 1 → 30 (warm orange)
        return 240 - v * 210;
    }

    animate() {
        this.animId = requestAnimationFrame(() => this.animate());
        this.time += 0.016;
        this.lerpFeatures();

        const ctx = this.ctx;
        const f = this.features;
        if (!f) return;

        const w = this.width;
        const h = this.height;

        // Background with trail effect (energy controls trail length)
        const trail = 0.08 + (1 - f.energy) * 0.15;
        ctx.fillStyle = `rgba(10, 10, 26, ${trail})`;
        ctx.fillRect(0, 0, w, h);

        const baseHue = this.getHue();
        const speed = 0.3 + f.energy * 3;
        const pulseFreq = 0.5 + f.tempo * 4;
        const pulse = Math.sin(this.time * pulseFreq) * 0.5 + 0.5;
        const jitter = f.liveness * 3;

        for (const p of this.particles) {
            // Movement
            const dx = Math.cos(p.phase + this.time * pulseFreq * 0.3) * speed;
            const dy = Math.sin(p.phase + this.time * pulseFreq * 0.2) * speed;
            p.x += p.vx * speed + dx * 0.3 + (Math.random() - 0.5) * jitter;
            p.y += p.vy * speed + dy * 0.3 + (Math.random() - 0.5) * jitter;

            // Wrap around edges
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
            if (p.y < -10) p.y = h + 10;
            if (p.y > h + 10) p.y = -10;

            // Color
            const hueOffset = (p.life * 60) - 30;
            const hue = (baseHue + hueOffset + 360) % 360;
            const saturation = 60 + f.energy * 30;
            const lightness = 45 + pulse * 15 + f.loudness * 15;
            const alpha = 0.3 + pulse * 0.4 * f.energy;

            ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;

            // Draw shape: organic (circle) vs geometric (rect/diamond)
            const size = p.size * (0.8 + pulse * 0.4 * f.danceability);

            if (p.organic) {
                // Organic: softly deformed circle
                ctx.beginPath();
                const r = size;
                const wobble = Math.sin(this.time * 2 + p.phase) * size * 0.2 * f.acousticness;
                ctx.ellipse(p.x, p.y, r + wobble, r - wobble * 0.5, p.phase, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Geometric
                if (f.instrumentalness > 0.3) {
                    // Diamond
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(this.time * 0.5 + p.phase);
                    ctx.beginPath();
                    ctx.moveTo(0, -size);
                    ctx.lineTo(size, 0);
                    ctx.lineTo(0, size);
                    ctx.lineTo(-size, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                } else {
                    // Rounded rect
                    const half = size;
                    ctx.beginPath();
                    ctx.roundRect(p.x - half, p.y - half, half * 2, half * 2, size * 0.3);
                    ctx.fill();
                }
            }

            // Glow for high energy
            if (f.energy > 0.6) {
                ctx.save();
                ctx.globalAlpha = alpha * 0.3;
                ctx.shadowBlur = size * 4;
                ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.6)`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                ctx.shadowBlur = 0;
            }
        }

        // Draw connecting lines for danceable tracks
        if (f.danceability > 0.5) {
            ctx.strokeStyle = `hsla(${baseHue}, 50%, 60%, ${0.03 + f.danceability * 0.05})`;
            ctx.lineWidth = 0.5;
            const connectDist = 60 + f.danceability * 40;
            for (let i = 0; i < this.particles.length; i += 3) {
                for (let j = i + 3; j < this.particles.length; j += 3) {
                    const pi = this.particles[i];
                    const pj = this.particles[j];
                    const dx = pi.x - pj.x;
                    const dy = pi.y - pj.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < connectDist) {
                        ctx.beginPath();
                        ctx.moveTo(pi.x, pi.y);
                        ctx.lineTo(pj.x, pj.y);
                        ctx.stroke();
                    }
                }
            }
        }
    }

    destroy() {
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    }
}

/**
 * Ambient background visualizer (subtle floating orbs).
 */
export class BackgroundVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.orbs = [];
        this.time = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initOrbs();
        this.animate();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
    }

    initOrbs() {
        for (let i = 0; i < 5; i++) {
            this.orbs.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                r: 100 + Math.random() * 200,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                hue: 240 + Math.random() * 80,
            });
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.time += 0.005;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        for (const orb of this.orbs) {
            orb.x += orb.vx + Math.sin(this.time + orb.hue) * 0.2;
            orb.y += orb.vy + Math.cos(this.time + orb.hue) * 0.2;

            // Wrap
            if (orb.x < -orb.r) orb.x = this.width + orb.r;
            if (orb.x > this.width + orb.r) orb.x = -orb.r;
            if (orb.y < -orb.r) orb.y = this.height + orb.r;
            if (orb.y > this.height + orb.r) orb.y = -orb.r;

            const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
            grad.addColorStop(0, `hsla(${orb.hue}, 70%, 40%, 0.08)`);
            grad.addColorStop(1, `hsla(${orb.hue}, 70%, 20%, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
