/*
 * HC-05 / HC-06 Bluetooth Classic via SoftwareSerial (or hardware Serial)
 * Pair phone/PC with module, then use USB-TTL + Web Serial in the PWA,
 * or a classic Bluetooth SPP bridge.
 *
 * Wiring (SoftwareSerial):
 *   HC-05 TX -> Arduino D10
 *   HC-05 RX -> Arduino D11 (voltage divider recommended)
 *   VCC 3.3/5V, GND
 */

#include <SoftwareSerial.h>

SoftwareSerial BT(10, 11); // RX, TX
const int LED_PIN = 13;

String inputBuffer = "";

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  BT.begin(9600);
  BT.println("OK READY");
  Serial.println("HC-05 bridge ready");
}

void loop() {
  while (BT.available()) {
    char c = BT.read();
    Serial.write(c);
    if (c == '\n' || c == '\r') {
      if (inputBuffer.length() > 0) {
        handleCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }

  // Optional USB passthrough for Web Serial testing
  while (Serial.available()) {
    char c = Serial.read();
    BT.write(c);
  }
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd == "LED_ON") {
    digitalWrite(LED_PIN, HIGH);
    BT.println("OK");
  } else if (cmd == "LED_OFF") {
    digitalWrite(LED_PIN, LOW);
    BT.println("OK");
  } else if (cmd == "STATUS?") {
    BT.println("STATUS:OK");
  } else if (cmd == "TEMP?") {
    BT.println("TEMP:28.5");
  } else {
    BT.println("ERROR");
  }
}
