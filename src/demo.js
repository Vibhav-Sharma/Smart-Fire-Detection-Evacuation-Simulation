/**
 * Automated Viva Presentation Demo Scenario
 * Executes the exact 13-second scripted demonstration sequence:
 *   0s: Standby normal telemetry
 *   2s: S3 registers abnormal temp rise (48°C)
 *   3s: Smoke spikes (420 ppm)
 *   4s: Flame confirmed! Fire alarm engaged
 *   5s: Danger perimeter expands across eastern wing
 *   6-9s: A* algorithm dynamically explores safe detours
 *   10s: Safest route to Exit B established (avoiding compromised Exit A)
 *   11s+: Occupant evacuates along safe route
 *   13s: Evacuation confirmed safe
 */

export class PresentationDemoRunner {
  constructor(appController) {
    this.app = appController;
    this.isRunning = false;
    this.timeouts = [];
    this.onProgressCallback = null;
  }

  onProgress(callback) {
    this.onProgressCallback = callback;
  }

  notify(second, title, description) {
    if (this.onProgressCallback) {
      this.onProgressCallback({ second, title, description });
    }
  }

  start() {
    if (this.isRunning) {
      this.stop();
    }

    this.isRunning = true;
    this.app.resetSimulation();

    const schedule = (sec, fn) => {
      const id = setTimeout(() => {
        if (this.isRunning) fn();
      }, sec * 1000);
      this.timeouts.push(id);
    };

    // 0s: Normal Baseline
    this.notify(0, 'Phase 1: Baseline Monitoring', 'Building environment normal. ESP8266 sensor telemetry within safe limits.');

    // 2s: Temperature spike at S3 (Server Room)
    schedule(2, () => {
      this.notify(2, 'Phase 2: Thermal Anomaly', 'Sensor S3 (Server Room) registers abnormal temperature rise (48.5°C). Pre-alarm state.');
      this.app.telemetry.handleSensorEvent('S3', 45, 48.5, false, 'SIMULATION');
      this.app.updateSystem();
    });

    // 3s: Smoke spike at S3
    schedule(3.2, () => {
      this.notify(3, 'Phase 3: Smoke Accumulation', 'MQ-2 sensor S3 detects rising particulate smoke (420 ppm). Analyzing combustion risk.');
      this.app.telemetry.handleSensorEvent('S3', 420, 56.0, false, 'SIMULATION');
      this.app.updateSystem();
    });

    // 4s: Flame Detected -> FIRE!
    schedule(4.5, () => {
      this.notify(4, 'Phase 4: FIRE DETECTED!', 'Optical flame sensor tripped at S3! System initiates emergency lockdown protocol.');
      this.app.telemetry.triggerFire('S3', 'SIMULATION');
      this.app.audio.startAlarm();
      this.app.updateSystem();
    });

    // 5s: Danger perimeter expands
    schedule(5.8, () => {
      this.notify(5, 'Phase 5: Danger Perimeter Formed', 'Toxic gas & thermal danger zones propagated around Server Room corridor.');
      this.app.updateSystem();
    });

    // 6s: A* search begins
    schedule(6.8, () => {
      this.notify(6, 'Phase 6: A* Path Optimization', 'Evaluating available emergency exits using safety-weighted cost function.');
      this.app.triggerAStarVisualization();
    });

    // 10s: Safest route locked in
    schedule(10.2, () => {
      this.notify(10, 'Phase 7: Safest Route Established', 'Exit B selected! Shortest route to Exit A rejected due to proximity to fire hazard.');
      this.app.audio.playRouteSuccessChime();
      this.app.lockInSafestRoute();
    });

    // 11.5s: Occupant evacuation
    schedule(11.5, () => {
      this.notify(11, 'Phase 8: Occupant Guided to Safety', 'Occupant P1 evacuating via clear, safety-optimized pathway.');
      this.app.animateEvacuation();
    });

    // 14s: Done
    schedule(14.5, () => {
      this.notify(14, 'Demo Complete', 'Emergency evacuation executed successfully. All occupants cleared hazard zone.');
      this.isRunning = false;
    });
  }

  stop() {
    this.isRunning = false;
    for (const t of this.timeouts) {
      clearTimeout(t);
    }
    this.timeouts = [];
  }
}
