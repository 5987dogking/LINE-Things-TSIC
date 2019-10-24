int samplingTime = 280;
int deltaTime = 40;
int sleepTime = 9680;

void PM25Get() {
  digitalWrite(ledPower, LOW); // power on the LED
  delayMicroseconds(samplingTime);
  voMeasured = analogRead(measurePin); // read the dust value
  delayMicroseconds(deltaTime);
  digitalWrite(ledPower, HIGH); // turn the LED off
  delayMicroseconds(sleepTime);
  calcVoltage = voMeasured * (3.3 / 1024);
  dustDensity = 0.17 * calcVoltage - 0.1;
  Serial.println("Raw Signal Value (0-1023): " + String(voMeasured));
  Serial.println(" - Voltage: " + String(calcVoltage));
  Serial.println(" - Dust Density: " + String(dustDensity));
}
