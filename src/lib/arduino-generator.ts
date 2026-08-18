export function generateArduinoSketch(options: {
  module: "hc05" | "hc06" | "hm10" | "esp32";
  components: Array<
    "led" | "servo" | "relay" | "motor" | "dht" | "ultrasonic" | "rgb"
  >;
}): string {
  const { module, components } = options;
  const isEsp32 = module === "esp32";
  const isBle = module === "hm10" || module === "esp32";

  const includes: string[] = [];
  if (components.includes("servo")) includes.push("#include <Servo.h>");
  if (components.includes("dht")) includes.push("#include <DHT.h>");
  if (isEsp32 && isBle) {
    includes.push('#include "BluetoothSerial.h"');
    includes.push("// For BLE UART, prefer ESP32 BLE Arduino / NimBLE libraries.");
  }

  const pins: string[] = [];
  if (components.includes("led")) pins.push("const int LED_PIN = 13;");
  if (components.includes("servo")) pins.push("const int SERVO_PIN = 9;");
  if (components.includes("relay")) pins.push("const int RELAY1_PIN = 7;");
  if (components.includes("motor")) {
    pins.push("const int MOTOR_IN1 = 5;");
    pins.push("const int MOTOR_IN2 = 6;");
  }
  if (components.includes("rgb")) {
    pins.push("const int RGB_R = 3;");
    pins.push("const int RGB_G = 10;");
    pins.push("const int RGB_B = 11;");
  }
  if (components.includes("ultrasonic")) {
    pins.push("const int TRIG_PIN = 8;");
    pins.push("const int ECHO_PIN = 12;");
  }
  if (components.includes("dht")) {
    pins.push("#define DHTPIN 4");
    pins.push("#define DHTTYPE DHT22");
  }

  const globals: string[] = [];
  if (components.includes("servo")) globals.push("Servo servo;");
  if (components.includes("dht")) globals.push("DHT dht(DHTPIN, DHTTYPE);");
  if (isEsp32) globals.push("BluetoothSerial SerialBT;");

  const setupLines: string[] = [];
  if (isEsp32) {
    setupLines.push('  SerialBT.begin("ESP32_BT_Arduino");');
    setupLines.push("  Serial.begin(115200);");
  } else {
    setupLines.push("  Serial.begin(9600);");
  }
  if (components.includes("led")) setupLines.push("  pinMode(LED_PIN, OUTPUT);");
  if (components.includes("relay")) setupLines.push("  pinMode(RELAY1_PIN, OUTPUT);");
  if (components.includes("motor")) {
    setupLines.push("  pinMode(MOTOR_IN1, OUTPUT);");
    setupLines.push("  pinMode(MOTOR_IN2, OUTPUT);");
  }
  if (components.includes("rgb")) {
    setupLines.push("  pinMode(RGB_R, OUTPUT);");
    setupLines.push("  pinMode(RGB_G, OUTPUT);");
    setupLines.push("  pinMode(RGB_B, OUTPUT);");
  }
  if (components.includes("ultrasonic")) {
    setupLines.push("  pinMode(TRIG_PIN, OUTPUT);");
    setupLines.push("  pinMode(ECHO_PIN, INPUT);");
  }
  if (components.includes("servo")) setupLines.push("  servo.attach(SERVO_PIN);");
  if (components.includes("dht")) setupLines.push("  dht.begin();");

  const stream = isEsp32 ? "SerialBT" : "Serial";

  return `/*
 * Auto-generated sketch for ${module.toUpperCase()}
 * Protocol: text commands ending with newline
 * Compatible with Web Open Arduino Controller PWA
 */
${includes.join("\n")}

${pins.join("\n")}

${globals.join("\n")}

String inputBuffer = "";

void setup() {
${setupLines.join("\n")}
  ${stream}.println("OK READY");
}

void loop() {
  while (${stream}.available()) {
    char c = ${stream}.read();
    if (c == '\\n' || c == '\\r') {
      if (inputBuffer.length() > 0) {
        handleCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }

${components.includes("dht") ? `  static unsigned long lastSensor = 0;
  if (millis() - lastSensor > 2000) {
    lastSensor = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      ${stream}.print("TEMP:");
      ${stream}.print(t);
      ${stream}.print(",HUM:");
      ${stream}.println(h);
    }
  }` : ""}
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "LED_ON") {
${components.includes("led") ? "    digitalWrite(LED_PIN, HIGH);" : "    // LED not enabled"}
    ${stream}.println("OK");
  } else if (cmd == "LED_OFF") {
${components.includes("led") ? "    digitalWrite(LED_PIN, LOW);" : ""}
    ${stream}.println("OK");
  } else if (cmd.startsWith("SERVO:")) {
${components.includes("servo") ? "    int deg = cmd.substring(6).toInt();\n    servo.write(constrain(deg, 0, 180));" : ""}
    ${stream}.println("OK");
  } else if (cmd.startsWith("PWM:")) {
    int v = constrain(cmd.substring(4).toInt(), 0, 255);
${components.includes("led") ? "    analogWrite(LED_PIN, v);" : ""}
    ${stream}.println("OK");
  } else if (cmd.startsWith("RELAY1:")) {
${components.includes("relay") ? '    digitalWrite(RELAY1_PIN, cmd.endsWith("ON") ? HIGH : LOW);' : ""}
    ${stream}.println("OK");
  } else if (cmd.startsWith("RGB:")) {
${components.includes("rgb") ? `    int c1 = cmd.indexOf(',');
    int c2 = cmd.indexOf(',', c1 + 1);
    int r = cmd.substring(4, c1).toInt();
    int g = cmd.substring(c1 + 1, c2).toInt();
    int b = cmd.substring(c2 + 1).toInt();
    analogWrite(RGB_R, constrain(r, 0, 255));
    analogWrite(RGB_G, constrain(g, 0, 255));
    analogWrite(RGB_B, constrain(b, 0, 255));` : ""}
    ${stream}.println("OK");
  } else if (cmd == "FORWARD" || cmd == "MOTOR_START") {
${components.includes("motor") ? "    digitalWrite(MOTOR_IN1, HIGH);\n    digitalWrite(MOTOR_IN2, LOW);" : ""}
    ${stream}.println("OK");
  } else if (cmd == "BACKWARD") {
${components.includes("motor") ? "    digitalWrite(MOTOR_IN1, LOW);\n    digitalWrite(MOTOR_IN2, HIGH);" : ""}
    ${stream}.println("OK");
  } else if (cmd == "STOP" || cmd == "MOTOR_STOP") {
${components.includes("motor") ? "    digitalWrite(MOTOR_IN1, LOW);\n    digitalWrite(MOTOR_IN2, LOW);" : ""}
    ${stream}.println("OK");
  } else if (cmd == "TEMP?") {
${components.includes("dht") ? `    ${stream}.print("TEMP:");
    ${stream}.println(dht.readTemperature());` : `    ${stream}.println("TEMP:0");`}
  } else if (cmd == "STATUS?") {
    ${stream}.println("STATUS:OK");
  } else if (cmd == "DIST?") {
${components.includes("ultrasonic") ? `    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    long duration = pulseIn(ECHO_PIN, HIGH);
    float dist = duration * 0.034 / 2.0;
    ${stream}.print("DIST:");
    ${stream}.println(dist);` : `    ${stream}.println("DIST:0");`}
  } else {
    ${stream}.println("ERROR");
  }
}
`;
}
