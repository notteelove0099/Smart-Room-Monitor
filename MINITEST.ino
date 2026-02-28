#include <WiFi.h>
#include <WiFiManager.h>      
#include <HTTPClient.h>       
#include <WiFiClientSecure.h> 
#include <Firebase_ESP_Client.h>
#include "DHT.h"

// =========================================
// ข้อมูล Firebase
// =========================================
#define API_KEY "AIzaSyAzjzRdjIuOnb0U0uOFuxvyptNpu_x3usc"
#define DATABASE_URL "test-mode-f8aca-default-rtdb.asia-southeast1.firebasedatabase.app"

// =========================================
// ข้อมูล Telegram
// =========================================
String BOT_TOKEN = "8223518527:AAEIJ9zHZtKE3z9TZHNYUGK5brxqw5aP4c0"; 
String CHAT_ID = "5501888253";

// =========================================
// กำหนดขาอุปกรณ์
// =========================================
#define DHTPIN 4
#define DHTTYPE DHT22   
#define LED_PIN 18       
#define BUZZER_PIN 5      
#define MANUAL_LED_PIN 15 

int measurePin = 34;     // ขาเซ็นเซอร์ฝุ่น Sharp (ของจริง)
int ledPower = 14;       
int ledBarPins[] = {13, 12, 27, 26, 25, 33, 32};

#define POT_PIN 35       // ขา Potentiometer (สำหรับโหมดจำลอง)

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

// ตัวแปรจับเวลา
unsigned long sensorPrevMillis = 0;
unsigned long readDataPrevMillis = 0;
unsigned long blinkPrevMillis = 0;
unsigned long lastTelegramMillis = 0; 

// ตัวแปรรับคำสั่งจากเว็บ
bool manualLedState = false;
bool manualBuzzerState = false;
bool blinkState = false;
bool useSimulationMode = false; // ตัวแปรเลือกโหมดจำลอง

// -----------------------------------------------------------
// ฟังก์ชันส่งข้อความเข้า Telegram
// -----------------------------------------------------------
void sendTelegram(String message) {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // ข้ามการตรวจ SSL Certificate
    HTTPClient http;
    
    // แปลงข้อความให้ URL เข้าใจ
    message.replace(" ", "%20");
    message.replace("\n", "%0A");

    String url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage?chat_id=" + CHAT_ID + "&text=" + message;
    
    http.begin(client, url);
    int httpResponseCode = http.GET();
    http.end();
    
    if (httpResponseCode == 200) {
      Serial.println("✅ Telegram sent successfully!");
    } else {
      Serial.println("❌ Telegram Error Code: " + String(httpResponseCode));
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(ledPower, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(MANUAL_LED_PIN, OUTPUT);
  
  digitalWrite(ledPower, HIGH); 
  digitalWrite(LED_PIN, HIGH);  
  
  noTone(BUZZER_PIN);           
  digitalWrite(BUZZER_PIN, HIGH); 

  digitalWrite(MANUAL_LED_PIN, HIGH);  

  for (int i = 0; i < 7; i++) {
    pinMode(ledBarPins[i], OUTPUT);
    digitalWrite(ledBarPins[i], HIGH); 
  }

  dht.begin();

  // -----------------------------------------------------------
  // ระบบตั้งค่า Wi-Fi (WiFiManager) 
  // -----------------------------------------------------------
  WiFiManager wm;
  Serial.println("Connecting to WiFi or starting AP...");
  
  bool res = wm.autoConnect("SmartRoom_AP", "12345678"); 
  
  if(!res) {
    Serial.println("Failed to connect, restarting...");
    delay(3000);
    ESP.restart();
  } 
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  // -----------------------------------------------------------
  // อ่านคำสั่งจาก Dashboard
  // -----------------------------------------------------------
  if (Firebase.ready() && (millis() - readDataPrevMillis > 2000 || readDataPrevMillis == 0)) {
    readDataPrevMillis = millis();

    if (Firebase.RTDB.getBool(&fbdo, "room1/manual_led")) {
      manualLedState = fbdo.boolData();
    }
    if (Firebase.RTDB.getBool(&fbdo, "room1/manual_buzzer")) {
      manualBuzzerState = fbdo.boolData();
    }
    if (Firebase.RTDB.getBool(&fbdo, "room1/use_simulation")) {
      useSimulationMode = fbdo.boolData();
    }
  }

  // ลอจิกไฟกระพริบ 
  if (manualLedState) {
    if (millis() - blinkPrevMillis > 500) { 
      blinkPrevMillis = millis();
      blinkState = !blinkState;
      digitalWrite(MANUAL_LED_PIN, blinkState ? LOW : HIGH); 
    }
  } else {
    digitalWrite(MANUAL_LED_PIN, HIGH); 
  }

  // -----------------------------------------------------------
  // อ่านค่าเซ็นเซอร์ และทำงานแบบ Edge Computing
  // -----------------------------------------------------------
  if (millis() - sensorPrevMillis > 5000) {
    sensorPrevMillis = millis();

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    if (isnan(temp) || isnan(hum)) {
      temp = 0.0; hum = 0.0;
    }

    // ---------------------------------------------------------
    // เลือกระบบอ่านค่าฝุ่น (ตามที่สั่งจากเว็บ)
    // ---------------------------------------------------------
    if (useSimulationMode) {
      // โหมดจำลอง: หมุน Potentiometer แปลงค่าเป็นฝุ่น 0 - 200 ug/m3
      int potValue = analogRead(POT_PIN);
      dustDensity = (potValue / 4095.0) * 200.0; 
    } else {
      // โหมดของจริง: อ่านจากเซ็นเซอร์ Sharp GP2Y1010AU0F
      digitalWrite(ledPower, LOW);          
      delayMicroseconds(samplingTime);      
      voMeasured = analogRead(measurePin);  
      delayMicroseconds(deltaTime);         
      digitalWrite(ledPower, HIGH);         
      delayMicroseconds(sleepTime);         

      calcVoltage = voMeasured * (3.3 / 4095.0); 
      dustDensity = 170 * calcVoltage - 0.1;
      if (dustDensity < 0) dustDensity = 0.00;
    }

    // คำนวณไฟ LED Bar 7 ดวง
    int activeLeds = 0;
    if (dustDensity < 20.0) activeLeds = 0; 
    else if (dustDensity < 40.0) activeLeds = 2; 
    else if (dustDensity < 60.0) activeLeds = 3; 
    else if (dustDensity < 80.0) activeLeds = 4; 
    else if (dustDensity < 100.0) activeLeds = 5; 
    else if (dustDensity < 120.0) activeLeds = 6; 
    else activeLeds = 7; 

    for (int i = 0; i < 7; i++) {
      if (i < activeLeds) digitalWrite(ledBarPins[i], LOW); 
      else digitalWrite(ledBarPins[i], HIGH);
    }

    // ประมวลผลแจ้งเตือน (Local)
    bool isAlert = false; 
    if(temp > 40.0 || dustDensity > 50.0) {
      isAlert = true; 
    }

    if(isAlert) {
      digitalWrite(LED_PIN, LOW);   // ไฟแดงดวงใหญ่ติด
    } else {
      digitalWrite(LED_PIN, HIGH);  // ไฟแดงดับ
    }

    // แยกการควบคุม Buzzer ตามสั่งจากเว็บ
    if(manualBuzzerState) {
      tone(BUZZER_PIN, 2000);       
    } else {
      noTone(BUZZER_PIN);           
      digitalWrite(BUZZER_PIN, HIGH); 
    }

    Serial.printf("[%s] Temp: %.2f C, Dust: %.2f, Alert: %s\n", 
                  useSimulationMode ? "SIM MODE" : "REAL MODE", temp, dustDensity, isAlert ? "YES" : "NO");

    // -----------------------------------------------------------
    // ส่ง Telegram Notification
    // -----------------------------------------------------------
    if (isAlert && WiFi.status() == WL_CONNECTED) {
      if (millis() - lastTelegramMillis > 60000) { 
        lastTelegramMillis = millis();
        String msg = "🚨 [แจ้งเตือนอันตราย] 🚨\nอุณหภูมิ: " + String(temp) + " °C\nฝุ่น PM: " + String(dustDensity) + " ug/m3";
        sendTelegram(msg);
      }
    }

    // -----------------------------------------------------------
    // ส่งข้อมูลเข้า Firebase
    // -----------------------------------------------------------
    if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
      Firebase.RTDB.setFloat(&fbdo, "room1/temperature", temp);
      Firebase.RTDB.setFloat(&fbdo, "room1/humidity", hum);
      Firebase.RTDB.setFloat(&fbdo, "room1/dust", dustDensity);
      Firebase.RTDB.setBool(&fbdo, "room1/led_status", isAlert); 
    }
  }
}
