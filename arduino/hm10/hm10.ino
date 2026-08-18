/*
 * HM-10 BLE UART sketch (AT firmware in peripheral mode)
 * Use Web Bluetooth in Chrome with Nordic UART-compatible service
 * if your HM-10 firmware exposes a custom UART UUID — adjust UUIDs as needed.
 *
 * Many HM-10 modules bridge BLE <-> Serial transparently:
 * phone BLE app writes to characteristic → data appears on Arduino Serial.
 */

#include <SoftwareSerial.h>

SoftwareSerial BLE(10, 11); // RX, TX to HM-10
const int LED_PIN = 13;
const int SERVO_PIN = 9;

#include <Servo.h>
Servo servo;

String inputBuffer = "";

void setup() {
  pinMode(LED_PIN, OUTPUT);
  servo.attach(SERVO_PIN);
  Serial.begin(9600);
  BLE.begin(9600);
  BLE.println("OK READY");
}

void loop() {
  while (BLE.available()) {
    char c = BLE.read();
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
    BLE.println("OK");
  } else if (cmd == "LED_OFF") {
    digitalWrite(LED_PIN, LOW);
    BLE.println("OK");
  } else if (cmd.startsWith("SERVO:")) {
    int deg = constrain(cmd.substring(6).toInt(), 0, 180);
    servo.write(deg);
    BLE.println("OK");
  } else if (cmd.startsWith("PWM:")) {
    analogWrite(LED_PIN, constrain(cmd.substring(4).toInt(), 0, 255));
    BLE.println("OK");
  } else if (cmd == "TEMP?") {
    BLE.println("TEMP:27.5,HUM:65");
  } else if (cmd == "STATUS?") {
    BLE.println("STATUS:OK");
  } else {
    BLE.println("ERROR");
  }
}
