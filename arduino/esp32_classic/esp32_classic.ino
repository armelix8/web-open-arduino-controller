/*
 * ESP32 Bluetooth Classic (SPP) sketch
 * Device name: ESP32_BT_Arduino
 *
 * Note: Web Bluetooth cannot open classic SPP. Use:
 *  - ESP32 BLE UART firmware for the PWA BLE transport, or
 *  - USB Serial / local bridge for Classic.
 */

#include "BluetoothSerial.h"

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled! Please run `make menuconfig` and enable it
#endif

BluetoothSerial SerialBT;
const int LED_PIN = 2;
const int RELAY1_PIN = 4;

String inputBuffer = "";

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(RELAY1_PIN, OUTPUT);
  Serial.begin(115200);
  SerialBT.begin("ESP32_BT_Arduino");
  Serial.println("ESP32 Classic BT started");
  SerialBT.println("OK READY");
}

void loop() {
  while (SerialBT.available()) {
    char c = SerialBT.read();
    if (c == '\n' || c == '\r') {
      if (inputBuffer.length() > 0) {
        handleCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd == "LED_ON") {
    digitalWrite(LED_PIN, HIGH);
    SerialBT.println("OK");
  } else if (cmd == "LED_OFF") {
    digitalWrite(LED_PIN, LOW);
    SerialBT.println("OK");
  } else if (cmd.startsWith("RELAY1:")) {
    digitalWrite(RELAY1_PIN, cmd.endsWith("ON") ? HIGH : LOW);
    SerialBT.println("OK");
  } else if (cmd.startsWith("PWM:")) {
    analogWrite(LED_PIN, constrain(cmd.substring(4).toInt(), 0, 255));
    SerialBT.println("OK");
  } else if (cmd == "TEMP?") {
    SerialBT.println("TEMP:29.1,HUM:55,VOLT:3.3");
  } else if (cmd == "STATUS?") {
    SerialBT.println("STATUS:OK");
  } else if (cmd == "STOP") {
    digitalWrite(LED_PIN, LOW);
    digitalWrite(RELAY1_PIN, LOW);
    SerialBT.println("OK");
  } else {
    SerialBT.println("ERROR");
  }
}
