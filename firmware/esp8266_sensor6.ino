/*
 * ============================================================================
 * ESP8266 Wi-Fi Fire Detection Node -> Dynamic Evacuation System
 * Mapped to: Sensor 6 (S6 - Central Hallway)
 *
 * Microcontroller: ESP8266 (NodeMCU 1.0, Wemos D1, ESP-12E)
 * Web Server: Port 80 (/status endpoint with CORS headers)
 *
 * Hardware Wiring:
 *   - Flame Sensor Digital Output (D0) -> ESP8266 Pin D1 (GPIO 5)
 *   - Flame Sensor VCC                 -> 3.3V or 5V (depending on module)
 *   - Flame Sensor GND                 -> GND
 *   - Active Buzzer (+)                -> ESP8266 Pin D2 (GPIO 4)
 *   - Active Buzzer (-)                -> GND
 * ============================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

// Enter your local 2.4GHz Wi-Fi credentials here:
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

#define PIN_FLAME       D1    // Flame Sensor DO connected to Pin D1 (GPIO 5)
#define PIN_BUZZER      D2    // Piezo / Active Buzzer connected to Pin D2 (GPIO 4)
#define ALARM_FREQ      2500  // Siren oscillation frequency in Hz

ESP8266WebServer server(80);

bool flameDetected = false;
unsigned long lastPrintTime = 0;
unsigned long lastBeepTime = 0;
bool buzzerState = false;

/**
 * HTTP GET /status endpoint
 * Provides CORS headers so the local browser web application
 * can query the sensor status directly via fetch().
 */
void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  String json = "{";
  json += "\"fire\":" + String(flameDetected ? "true" : "false") + ",";
  json += "\"room\":\"Room_1\"";
  json += "}";
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_FLAME, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  noTone(PIN_BUZZER);
  digitalWrite(PIN_BUZZER, LOW);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.println();
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  server.on("/status", HTTP_GET, handleStatus);
  server.begin();

  Serial.println("=========================================");
  Serial.println(" ESP8266 Fire Detection Active (D-Pins) ");
  Serial.print(" API URL: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/status");
  Serial.println("=========================================");
}

void loop() {
  server.handleClient();

  // Read optical flame sensor digital pin (Active LOW: LOW = Flame, HIGH = Clear)
  int flameVal = digitalRead(PIN_FLAME);
  flameDetected = (flameVal == LOW);

  unsigned long currentMillis = millis();

  // Periodic serial log output
  if (currentMillis - lastPrintTime >= 400) {
    lastPrintTime = currentMillis;
    Serial.print("Flame DO [D1]: ");
    Serial.println(flameDetected ? "🔥 [FIRE DETECTED]" : "✅ [CLEAR]");
  }

  // Local buzzer alert sound pattern
  if (flameDetected) {
    unsigned long interval = buzzerState ? 150 : 100;
    if (currentMillis - lastBeepTime >= interval) {
      lastBeepTime = currentMillis;
      buzzerState = !buzzerState;
      if (buzzerState) {
        tone(PIN_BUZZER, ALARM_FREQ);
        digitalWrite(PIN_BUZZER, HIGH);
      } else {
        noTone(PIN_BUZZER);
        digitalWrite(PIN_BUZZER, LOW);
      }
    }
  } else {
    if (buzzerState) {
      buzzerState = false;
      noTone(PIN_BUZZER);
      digitalWrite(PIN_BUZZER, LOW);
    }
  }
}
