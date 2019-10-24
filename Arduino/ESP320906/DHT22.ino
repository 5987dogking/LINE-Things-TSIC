void DHT22Get() {
  humidity = dht.readHumidity();
  temperature = dht.readTemperature();
  float f = dht.readTemperature(true);
  heatIndex = dht.computeHeatIndex(temperature, humidity, false);
  if (isnan(humidity) || isnan(temperature) || isnan(f)) {
    //    humidity = 0;
    //    temperature = 0;
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  Serial.println("Humidity: " + String(humidity) + " %\t");
  Serial.println("Temperature: " + String(temperature) + " *C ");
  Serial.println("Heat index: " + String(heatIndex) + " *C ");
}
