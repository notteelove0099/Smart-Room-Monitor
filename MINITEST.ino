#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "DHT.h"

// =========================================
// 1. กำหนดข้อมูล Wi-Fi
// =========================================
const char* ssid = "....";
const char* password = "....";

// =========================================
// 2. ข้อมูล Firebase
// =========================================
#define API_KEY "......"
#define DATABASE_URL "........."

// =========================================
// 3. กำหนดขาอุปกรณ์ต่างๆ
// =========================================
#define DHTPIN 4
#define DHTTYPE DHT22   
#define LED_PIN 18       // ไฟ LED แจ้งเตือนดวงใหญ่ (Active Low)

// กำหนดขาเซ็นเซอร์ฝุ่น
int measurePin = 34;     
int ledPower = 14;       

// กำหนดขาโมดูล LED 8 ดวง (D0 - D7)
int ledBarPins[] = {13, 12, 27, 26, 25, 33, 32, 15};

// =========================================
// 4. ตัวแปรสำหรับคำนวณค่าฝุ่น
// =========================================
int samplingTime = 280;
int deltaTime = 40;
int sleepTime = 9680;

float voMeasured = 0;
float calcVoltage = 0;
float dustDensity = 0;

DHT dht(DHTPIN, DHTTYPE);
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long sendDataPrevMillis = 0;

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(ledPower, OUTPUT);
  
  digitalWrite(ledPower, HIGH); 
  digitalWrite(LED_PIN, HIGH);  

  // *** แก้ไขจุดที่ 1: สั่ง HIGH เพื่อปิดไฟ 8 ดวงตอนเริ่มระบบ ***
  for (int i = 0; i < 8; i++) {
    pinMode(ledBarPins[i], OUTPUT);
    digitalWrite(ledBarPins[i], HIGH); 
  }

  dht.begin();

  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\nConnected to Wi-Fi!");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (Firebase.ready() && (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    if (isnan(temp) || isnan(hum)) {
      Serial.println("Failed to read from DHT sensor!");
      temp = 0.0;
      hum = 0.0;
    }

    digitalWrite(ledPower, LOW);          
    delayMicroseconds(samplingTime);      
    voMeasured = analogRead(measurePin);  
    delayMicroseconds(deltaTime);         
    digitalWrite(ledPower, HIGH);         
    delayMicroseconds(sleepTime);         

    calcVoltage = voMeasured * (3.3 / 900.0);
    dustDensity = 170 * calcVoltage - 0.1;
    if (dustDensity < 0) dustDensity = 0.00;

    int activeLeds = 0;
    
    if (dustDensity < 20.0) {
      activeLeds = 0; 
    } else if (dustDensity < 40.0) {
      activeLeds = 2; 
    } else if (dustDensity < 60.0) {
      activeLeds = 3; 
    } else if (dustDensity < 80.0) {
      activeLeds = 4; 
    } else if (dustDensity < 120.0) {
      activeLeds = 6; 
    } else {
      activeLeds = 8; 
    }

    // *** แก้ไขจุดที่ 2: สลับลอจิกเปิด-ปิดไฟให้ตรงกับโมดูล Active-Low ***
    for (int i = 0; i < 8; i++) {
      if (i < activeLeds) {
        digitalWrite(ledBarPins[i], LOW);  // เปิดไฟ
      } else {
        digitalWrite(ledBarPins[i], HIGH); // ปิดไฟ
      }
    }

    bool isAlert = false; 
    if(temp > 40.0 || dustDensity > 50.0) {
      isAlert = true; 
    }

    if(isAlert) {
      digitalWrite(LED_PIN, LOW);   
    } else {
      digitalWrite(LED_PIN, HIGH);  
    }

    Serial.printf("Temp: %.2f C, Hum: %.2f %%, Dust: %.2f ug/m3, Alert: %s, LED Bar: %d/8\n", temp, hum, dustDensity, isAlert ? "YES" : "NO", activeLeds);
    
    Firebase.RTDB.setFloat(&fbdo, "room1/temperature", temp);
    Firebase.RTDB.setFloat(&fbdo, "room1/humidity", hum);
    Firebase.RTDB.setFloat(&fbdo, "room1/dust", dustDensity);
    Firebase.RTDB.setBool(&fbdo, "room1/led_status", isAlert); 
  }
}
