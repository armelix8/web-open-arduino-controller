# Arduino Communication Protocol

All commands are plain text, terminated by `\n`.

## Commands (TX)

| Command | Meaning |
|---------|---------|
| `LED_ON` / `LED_OFF` | Digital LED |
| `MOTOR_START` / `MOTOR_STOP` | Motor |
| `FORWARD` `BACKWARD` `LEFT` `RIGHT` `STOP` | Motion / E-stop |
| `SERVO:90` | Servo degrees 0–180 |
| `PWM:120` | PWM 0–255 |
| `RELAY1:ON` / `RELAY1:OFF` | Relay channel |
| `RGB:255,120,50` | RGB LED |
| `JOY:150,90` | Joystick X,Y 0–255 |
| `KEYPAD:1234` | Keypad entry |
| `TEMP?` `STATUS?` `DIST?` | Queries |

## Responses (RX)

| Response | Meaning |
|----------|---------|
| `OK` | Success |
| `ERROR` | Unknown / failed |
| `TEMP:27.5` | Temperature °C |
| `HUM:65` | Humidity % |
| `DIST:120` | Distance cm |
| `VOLT:3.3` `CURR:0.5` `BAT:88` | Power |
| `MOTION:ON` | Motion flag |
| `TEMP:27.5,HUM:65` | Multi-value (comma-separated) |

The PWA parser accepts `KEY:value` tokens and updates the sensor dashboard + automation engine.
