export class StepSoundGenerator {
    private ctx: AudioContext | null = null;
    private lastTime = 0;
    private minInterval: number;

    constructor(intervalMs = 280) {
        this.minInterval = intervalMs;
    }

    private ensureCtx() {
        if (!this.ctx) {
            this.ctx = new AudioContext();
        }
        return this.ctx;
    }

    play(volume = 0.3) {
        const now = performance.now();
        if (now - this.lastTime < this.minInterval) return;
        this.lastTime = now;

        const ctx = this.ensureCtx();

        const duration = 0.06 + Math.random() * 0.03;

        // Noise buffer
        const bufLen = Math.floor(ctx.sampleRate * duration);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.8;
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;

        // Low-pass for soft sole sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800 + Math.random() * 400;

        // Envelope
        const gain = ctx.createGain();
        const t = ctx.currentTime;
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(t);
        src.stop(t + duration);
    }

    destroy() {
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }
}
