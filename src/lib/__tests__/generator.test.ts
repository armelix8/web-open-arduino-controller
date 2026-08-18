import { describe, expect, it } from "vitest";
import { generateArduinoSketch } from "@/lib/arduino-generator";

describe("arduino generator", () => {
  it("includes selected components", () => {
    const sketch = generateArduinoSketch({
      module: "esp32",
      components: ["led", "dht", "relay"],
    });
    expect(sketch).toContain("LED_PIN");
    expect(sketch).toContain("DHT");
    expect(sketch).toContain("RELAY1_PIN");
    expect(sketch).toContain("SerialBT");
  });

  it("uses Serial for HC-05", () => {
    const sketch = generateArduinoSketch({
      module: "hc05",
      components: ["led"],
    });
    expect(sketch).toContain("Serial.begin(9600)");
    expect(sketch).toContain("LED_ON");
  });
});
