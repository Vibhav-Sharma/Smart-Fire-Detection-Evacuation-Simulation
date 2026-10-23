/**
 * ============================================================================
 * 🌐 CENTRAL SYSTEM CONFIGURATION
 * ============================================================================
 *
 * ⚡ TO CHANGE YOUR ESP8266 IP ADDRESS, JUST CHANGE THIS SINGLE LINE:
 */
export const ESP8266_IP = '192.168.137.46';

/**
 * Full HTTP endpoint URL automatically derived from ESP8266_IP.
 * (No need to touch anything below this line)
 */
export const ESP8266_STATUS_URL = `http://${ESP8266_IP}/status`;

export default {
  ESP8266_IP,
  ESP8266_STATUS_URL
};
