/**
 * Emergency Alarm & Sound System
 * Uses the Web Audio API to produce an authentic dual-tone emergency evacuation siren
 * and UI notification pings without external audio asset dependencies.
 */

export class AlarmAudioSystem {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.isPlaying = false;
    this.oscillator = null;
    this.gainNode = null;
    this.intervalId = null;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.isMuted && this.isPlaying) {
      this.stopAlarm();
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  startAlarm() {
    if (this.isMuted || this.isPlaying) return;
    this.initContext();

    this.isPlaying = true;
    let highTone = false;

    const playTone = () => {
      if (!this.isPlaying || this.isMuted) return;

      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // Dual frequency oscillating siren (880 Hz / 1050 Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(highTone ? 1050 : 880, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.38);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.4);

        highTone = !highTone;
      } catch (e) {
        console.warn('AudioContext error:', e);
      }
    };

    playTone();
    this.intervalId = setInterval(playTone, 450);
  }

  stopAlarm() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Positive chime when safest evacuation route is locked in
   */
  playRouteSuccessChime() {
    if (this.isMuted) return;
    this.initContext();

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }
}
