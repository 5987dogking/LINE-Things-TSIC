
#include <BLEServer.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "WiFi.h"
#include "ArduinoJson.h"

// Device Name: Maximum 30 bytes
#define DEVICE_NAME "LINE@百葉箱"

// User service UUID: Change this to your generated service UUID
#define USER_SERVICE_UUID "8daef707-60d5-4506-b0e2-5a6a2429aa68" //LINE＠百葉箱 海略
//#define USER_SERVICE_UUID "9cfc60ec-4b8d-48aa-b089-4a56ca7ccab3" // 百兆鍶
// User service characteristics
#define WRITE_CHARACTERISTIC_UUID "E9062E71-9E62-4BC6-B0D3-35CDCD9B027B"
#define NOTIFY_CHARACTERISTIC_UUID "62FBD229-6EDD-4D1A-B554-5C4E1BB29169"

// PSDI Service UUID: Fixed value for Developer Trial
#define PSDI_SERVICE_UUID "e625601e-9e55-4597-a598-76018a0d293d"
#define PSDI_CHARACTERISTIC_UUID "26e2b12b-85f0-4f3f-9fdd-91d114270e6e"

#define BUTTON 0
#define LED1 2

BLEServer* thingsServer;
BLESecurity *thingsSecurity;
BLEService* userService;
BLEService* psdiService;
BLECharacteristic* psdiCharacteristic;
BLECharacteristic* writeCharacteristic;
BLECharacteristic* notifyCharacteristic;

bool deviceConnected = false;
bool oldDeviceConnected = false;
String model = "MK4563";

volatile int btnAction = 0;

void actionWIFIGet();
void actionGetModel();
void actionSetWifi(String, String);

class serverCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

class writeCallback: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *bleWriteCharacteristic) {
      std::string value = bleWriteCharacteristic->getValue();
      Serial.print(F("value -> "));
      Serial.println(value.c_str());
      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, value.c_str());
      String Mode_str = doc["mode"];
      if (Mode_str == "setWifi") {
        actionSetWifi(doc["SSID"], doc["password"]);
      }

      if (Mode_str == "refreshWifi") {
        actionWIFIGet();
      }

      if (Mode_str == "getModel") {
        actionGetModel();
      }
    }
};


#include "DHT.h"
#define DHTPIN 25     // what digital pin we're connected to
#define DHTTYPE DHT22   // DHT 22  (AM2302), AM2321
DHT dht(DHTPIN, DHTTYPE);
int measurePin = 34;  // 黑線
int ledPower = 12;  // 白線

float voMeasured = 0;
float calcVoltage = 0;
float dustDensity = 0;

float humidity = 0;
float temperature = 0;
float heatIndex = 0;

void setup() {
  pinMode(ledPower, OUTPUT);
  dht.begin();
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  pinMode(LED1, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  attachInterrupt(BUTTON, buttonAction, CHANGE);

  BLEDevice::init("");
  BLEDevice::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT_NO_MITM);

  // Security Settings
  BLESecurity *thingsSecurity = new BLESecurity();
  thingsSecurity->setAuthenticationMode(ESP_LE_AUTH_REQ_SC_ONLY);
  thingsSecurity->setCapability(ESP_IO_CAP_NONE);
  thingsSecurity->setInitEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);

  setupServices();
  startAdvertising();
  Serial.println("Ready to Connect");
}

void loop() {
  //  DHT22Get();
  //  PM25Get();
  //  sendJsonData();
  //  Serial.println();
  uint8_t btnValue;

  while (btnAction > 0 && deviceConnected)
  {
    btnValue = !digitalRead(BUTTON);
    btnAction = 0;
    actionWIFIGet();
    delay(300);
  }
  // Disconnection
  if (!deviceConnected && oldDeviceConnected)
  {
    delay(500);                       // Wait for BLE Stack to be ready
    thingsServer->startAdvertising(); // Restart advertising
    oldDeviceConnected = deviceConnected;
  }
  // Connection
  if (deviceConnected && !oldDeviceConnected)
  {
    oldDeviceConnected = deviceConnected;
  }
  delay(2000);
}

void setupServices(void) {
  // Create BLE Server
  thingsServer = BLEDevice::createServer();
  thingsServer->setCallbacks(new serverCallbacks());

  // Setup User Service
  userService = thingsServer->createService(USER_SERVICE_UUID);
  // Create Characteristics for User Service
  writeCharacteristic = userService->createCharacteristic(WRITE_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_WRITE);
  writeCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
  writeCharacteristic->setCallbacks(new writeCallback());

  notifyCharacteristic = userService->createCharacteristic(NOTIFY_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  notifyCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
  BLE2902* ble9202 = new BLE2902();
  ble9202->setNotifications(true);
  ble9202->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
  notifyCharacteristic->addDescriptor(ble9202);

  // Setup PSDI Service
  psdiService = thingsServer->createService(PSDI_SERVICE_UUID);
  psdiCharacteristic = psdiService->createCharacteristic(PSDI_CHARACTERISTIC_UUID, BLECharacteristic::PROPERTY_READ);
  psdiCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);

  // Set PSDI (Product Specific Device ID) value
  uint64_t macAddress = ESP.getEfuseMac();
  psdiCharacteristic->setValue((uint8_t*) &macAddress, sizeof(macAddress));

  // Start BLE Services
  userService->start();
  psdiService->start();
}

void startAdvertising(void) {
  // Start Advertising
  BLEAdvertisementData scanResponseData = BLEAdvertisementData();
  scanResponseData.setFlags(0x06); // GENERAL_DISC_MODE 0x02 | BR_EDR_NOT_SUPPORTED 0x04
  scanResponseData.setName(DEVICE_NAME);

  thingsServer->getAdvertising()->addServiceUUID(userService->getUUID());
  thingsServer->getAdvertising()->setScanResponseData(scanResponseData);
  thingsServer->getAdvertising()->start();
}

void buttonAction() {
  btnAction++;
}

void actionWIFIGet() {
  Serial.println("scan start");
  String wifiArr = "";
  wifiArr += "{\"data\":[";
  // WiFi.scanNetworks will return the number of networks found
  int n = WiFi.scanNetworks();
  Serial.println("scan done");
  if (n == 0)
  {
    Serial.println("no networks found");
  }
  else
  {
    Serial.print(n);
    Serial.println(" networks found");
    //    n = (n > 3) ? 3 : n;
    for (int i = 0; i < n; ++i)
    {
      // Print SSID and RSSI for each network found
      Serial.print(i + 1 + ": " + WiFi.SSID(i) + " (" + WiFi.RSSI(i) + ")");
      Serial.println((WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? " " : "*");
      wifiArr += "{\"SSID\":";
      wifiArr += "\"" + WiFi.SSID(i) + "\"}";
      if ((i + 1) != n)
      {
        wifiArr += ",";
      }
    }
  }
  Serial.println("");
  wifiArr += "]}";
  Serial.println(wifiArr);
  sendData(wifiArr);
}

void actionGetModel() {
  Serial.println("actionGetModel");
  String modelData = "{\"model\":\"" + model + "\"}";
  sendData(modelData);
}

void sendData(const String& stringDatas)
{
  String stringData = "";
  String packNumber = "";
  String stringEnd = "GGGendGGG";
  int i = 0;
  notifyCharacteristic->setValue("");
  notifyCharacteristic->notify();
  delay(20);
  notifyCharacteristic->notify();
  for (i = 0; i < (stringDatas.length() / 18) + 1; i++)
  {
    /* code */
    notifyCharacteristic->setValue("");
    notifyCharacteristic->notify();
    delay(10);
    packNumber = "" + String(i);
    if (i < 10) {
      packNumber = "0" + String(i);
    }
    stringData = packNumber + stringDatas.substring(i * 18, (i + 1) * 18);
    notifyCharacteristic->setValue(stringData.c_str());
    notifyCharacteristic->notify();
    delay(30);
    stringData = packNumber + stringDatas.substring(i * 18, (i + 1) * 18);
    notifyCharacteristic->setValue(stringData.c_str());
    notifyCharacteristic->notify();
    Serial.println(stringData);
    delay(10);
  }
  delay(200);
  notifyCharacteristic->setValue("BTLend");
  notifyCharacteristic->notify();
  Serial.println("GGGendGGG");
}

void sendJsonData()
{
  DynamicJsonDocument doc(2048);
  Serial.println("scan start");
  int n = WiFi.scanNetworks();
  Serial.println("scan done");
  if (n == 0) {
    Serial.println("no networks found");
    StaticJsonDocument<4> arr;
    doc["data"] = arr.to<JsonArray>();
  } else {
    Serial.print(n);
    Serial.println(" networks found");
    for (int i = 0; i < n; ++i)
    {
      // Print SSID and RSSI for each network found
      Serial.print(i + 1 + ": " + WiFi.SSID(i) + " (" + WiFi.RSSI(i) + ")");
      Serial.println((WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? " " : "*");
      StaticJsonDocument<128> wifi;
      wifi["SSID"] = WiFi.SSID(i);
      doc["data"].add(wifi);
    }
  }
  doc["environment"]["humidity"] = String(humidity) + " %\t";
  doc["environment"]["temperature"] = String(temperature) + " *C ";
  doc["environment"]["heatIndex"] = String(heatIndex) + " *C ";
  doc["environment"]["voMeasured"] = voMeasured;
  char json_string[2048];
  serializeJson(doc, json_string);
  Serial.println("mk123123");
  Serial.println(json_string);
  notifyCharacteristic->setValue((uint8_t*)json_string, strlen(json_string));
  notifyCharacteristic->notify();
  Serial.println("GGGendGGG");
}
//void actionSetWifi(StaticJsonDocument<256> json) {
void actionSetWifi(String SSID_str, String password_str) {
  Serial.println("actionSetWifi=>");
  Serial.println(SSID_str);
  Serial.println(password_str);
  //  Serial.println(json);
  //  String SSID_str = json["SSID"];
  //  String password_str = json["password"];
  const char* SSID = (const char*)SSID_str.c_str();
  char* password;
  int connectCount = 0;
  int status = WL_IDLE_STATUS;
  Serial.println(SSID);
  WiFi.begin((const char*)SSID_str.c_str(), (const char*)password_str.c_str());
  while (WiFi.status() != WL_CONNECTED) {
    delay(100);
    Serial.print(".");
    connectCount++;
    if (connectCount >= 80) {
      break;
    }
  }
  //  status ＝ WiFi.begin(SSID, password);
  if ( WiFi.status() != WL_CONNECTED) {
    Serial.println("Couldn't get a wifi connection");
  } else {
    Serial.println("");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
  }
  String statusData = "{\"status\":\"" + String(WiFi.status()) + "\",\"SSID\":\"" + SSID_str + "\"}";
  sendData(statusData);
}
