/**
 * Sensor Telemetry & ESP8266 Wi-Fi Hardware Bridge
 * Maintains real-time state for all 8 sensors (MQ-2, DHT22, Flame).
 * Provides clean hooks for simulation and live ESP8266 Wi-Fi HTTP status feed.
 */

import { SENSORS } from './mapData.js';

export class SensorTelemetryManager {
  constructor(onStateChange) {
    this.onStateChange = onStateChange || (() => {});
    this.sensorStates = new Map();
    this.initSensors();
    this.startAmbientJitter();
  }

  initSensors() {
    for (const s of SENSORS) {
      this.sensorStates.set(s.id, {
        id: s.id,
        name: s.name,
        room: s.room,
        x: s.x,
        y: s.y,
        isHardware: Boolean(s.isHardware),
        smoke: 12 + Math.floor(Math.random() * 8), // Normal 12-20 ppm
        temp: 25.0 + +(Math.random() * 2.5).toFixed(1), // Normal 25-27.5 °C
        humidity: 50 + Math.floor(Math.random() * 10), // DHT22 %RH
        flame: false,
        status: 'NORMAL', // 'NORMAL' | 'PRE_ALARM' | 'FIRE'
        lastUpdated: new Date().toLocaleTimeString(),
        source: s.isHardware ? 'ESP8266_HARDWARE_READY' : 'SIMULATION'
      });
    }
  }

  /**
   * Standardized Event Handler for Fire/Telemetry Events
   * Can be called by Simulation buttons, Demo scripts, or live ESP8266 Wi-Fi feed.
   */
  handleSensorEvent(sensorId, smoke, temp, flame, source = 'SIMULATION') {
    const sensor = this.sensorStates.get(sensorId);
    if (!sensor) return null;

    sensor.smoke = Number(smoke);
    sensor.temp = Number(temp);
    sensor.flame = Boolean(flame);
    sensor.source = source;
    sensor.lastUpdated = new Date().toLocaleTimeString();

    // Fire detection threshold logic (ESP8266 firmware equivalent)
    if (flame || smoke > 350 || temp > 55.0) {
      sensor.status = 'FIRE';
    } else if (smoke > 120 || temp > 40.0) {
      sensor.status = 'PRE_ALARM';
    } else {
      sensor.status = 'NORMAL';
    }

    this.onStateChange(this.getAllSensors());
    return sensor;
  }

  triggerFire(sensorId, source = 'SIMULATION') {
    return this.handleSensorEvent(
      sensorId,
      750 + Math.floor(Math.random() * 200), // Smoke 750-950 ppm
      68.0 + +(Math.random() * 18.0).toFixed(1), // Temp 68-86 °C
      true, // Flame Detected
      source
    );
  }

  clearSensor(sensorId) {
    const sensor = this.sensorStates.get(sensorId);
    if (!sensor) return;

    return this.handleSensorEvent(
      sensorId,
      14 + Math.floor(Math.random() * 6),
      25.5 + +(Math.random() * 1.5).toFixed(1),
      false,
      sensor.isHardware ? 'ESP8266_HARDWARE' : 'SIMULATION'
    );
  }

  clearAllFires() {
    for (const [id] of this.sensorStates) {
      this.clearSensor(id);
    }
  }

  getActiveFires() {
    const fires = [];
    for (const [id, s] of this.sensorStates) {
      if (s.status === 'FIRE') {
        fires.push(s);
      }
    }
    return fires;
  }

  getAllSensors() {
    return Array.from(this.sensorStates.values());
  }

  getSensor(id) {
    return this.sensorStates.get(id);
  }

  /**
   * Subtle ambient telemetry fluctuations to simulate active ADC readings
   * Skips physical ESP8266 hardware sensor to preserve real sensor values.
   */
  startAmbientJitter() {
    setInterval(() => {
      let changed = false;
      for (const [id, s] of this.sensorStates) {
        // If active hardware sensor is feeding live data, don't overwrite with mock jitter
        if (s.source === 'ESP8266_HARDWARE') continue;

        if (s.status === 'NORMAL') {
          // slight jitter ±0.3°C, ±1 ppm
          const dTemp = (Math.random() - 0.5) * 0.4;
          const dSmoke = Math.floor((Math.random() - 0.5) * 2);
          s.temp = +(Math.max(22, Math.min(30, s.temp + dTemp))).toFixed(1);
          s.smoke = Math.max(8, Math.min(30, s.smoke + dSmoke));
          changed = true;
        }
      }
      if (changed) {
        this.onStateChange(this.getAllSensors());
      }
    }, 3000);
  }

  /**
   * Directly sets the hardware state of Sensor 6 according to ESP8266 status packet:
   * e.g., { fire: true/false, room: "Room_1" }
   */
  applyHardwareFireState(isFire, room = 'Room_1') {
    if (isFire) {
      return this.handleSensorEvent(
        'S6',
        820 + Math.floor(Math.random() * 80),
        68.4 + +(Math.random() * 4.0).toFixed(1),
        true,
        'ESP8266_HARDWARE'
      );
    } else {
      return this.handleSensorEvent(
        'S6',
        14 + Math.floor(Math.random() * 4),
        25.2 + +(Math.random() * 1.0).toFixed(1),
        false,
        'ESP8266_HARDWARE'
      );
    }
  }

  /**
   * Parse raw incoming packet from ESP8266 Wi-Fi HTTP /status, WebSocket, or test input.
   * Seamlessly maps to Sensor 6 (Central Hallway).
   */
  parseExternalPacket(rawString) {
    if (!rawString || typeof rawString !== 'string') return null;
    const clean = rawString.trim();
    if (!clean) return null;

    // 1. Try JSON parsing (ESP8266 sends {"fire": true, "room": "Room_1"})
    try {
      const data = JSON.parse(clean);
      const isFire = Boolean(data.fire !== undefined ? data.fire : (data.flame !== undefined ? Number(data.flame) : false));
      const targetSensor = (data.sensor || data.id || 'S6').toUpperCase();

      if (targetSensor === 'S6') {
        return this.applyHardwareFireState(isFire, data.room || 'Room_1');
      }

      const smoke = data.smoke !== undefined ? Number(data.smoke) : (isFire ? 820 : 18);
      const temp = data.temp !== undefined ? Number(data.temp) : (isFire ? 65.0 : 25.0);

      return this.handleSensorEvent(
        targetSensor,
        smoke,
        temp,
        isFire,
        'ESP8266_HARDWARE'
      );
    } catch (e) {
      // Not JSON, continue to string/token parsing
    }

    // 2. Keyword trigger formats (e.g. "FIRE", "FLAME:1", "NORMAL", "SAFE")
    const upper = clean.toUpperCase();
    if (upper === 'FIRE' || upper === 'FLAME' || upper === 'FLAME:1' || upper === 'FIRE:1' || upper.includes('FIRE DETECTED')) {
      return this.applyHardwareFireState(true);
    }
    if (upper === 'NORMAL' || upper === 'SAFE' || upper === 'CLEAR' || upper === 'FLAME:0' || upper === 'FIRE:0' || upper === 'EXTINGUISH') {
      return this.applyHardwareFireState(false);
    }

    return null;
  }
}
