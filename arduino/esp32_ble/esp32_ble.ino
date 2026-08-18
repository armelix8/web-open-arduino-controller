/*
 * ESP32 BLE UART (Nordic UART Service compatible)
 * Connect from the PWA using Web Bluetooth (BLE transport).
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;
String inputBuffer = "";
const int LED_PIN = 2;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) { deviceConnected = true; }
  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    pServer->startAdvertising();
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String rx = pCharacteristic->getValue();
    if (rx.length() == 0) return;
    for (size_t i = 0; i < rx.length(); i++) {
      char c = rx[i];
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
};

void notify(const String &msg) {
  if (!deviceConnected || !pTxCharacteristic) return;
  String line = msg + "\n";
  pTxCharacteristic->setValue((uint8_t *)line.c_str(), line.length());
  pTxCharacteristic->notify();
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd == "LED_ON") {
    digitalWrite(LED_PIN, HIGH);
    notify("OK");
  } else if (cmd == "LED_OFF") {
    digitalWrite(LED_PIN, LOW);
    notify("OK");
  } else if (cmd.startsWith("SERVO:")) {
    notify("OK");
  } else if (cmd.startsWith("RGB:")) {
    notify("OK");
  } else if (cmd == "TEMP?") {
    notify("TEMP:26.4,HUM:60");
  } else if (cmd == "STATUS?") {
    notify("STATUS:OK");
  } else if (cmd == "STOP") {
    digitalWrite(LED_PIN, LOW);
    notify("OK");
  } else {
    notify("ERROR");
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  BLEDevice::init("ESP32_BLE_Arduino");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pTxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_TX,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_RX,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new RxCallbacks());
  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();
  Serial.println("ESP32 BLE UART advertising");
}

void loop() {
  delay(20);
}
