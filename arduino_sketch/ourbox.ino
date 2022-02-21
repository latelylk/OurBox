#include "Adafruit_Thermal.h"
#include "SoftwareSerial.h"

#include "us.h"

#include <ESP8266WiFi.h>
#include <WiFiManager.h>

#include "HTTPSRedirect.h"
#include "DebugMacros.h"

#define STYLE "<style>body { font-family: monospace; background: beige; } button {border: 0; background-color: #000; color: #fff; line-height: 2.4rem; font-size: 1.2rem; width: 100%; font-family: monospace; } </style>"
#define WIFI_NAME "" // name of your WiFi network

#define TX_PIN 5 // Arduino transmit  YELLOW WIRE  labeled RX on printer
#define RX_PIN 4 // Arduino receive   GREEN WIRE   labeled TX on printer

SoftwareSerial printerSerial(RX_PIN, TX_PIN); // Declare SoftwareSerial obj first
Adafruit_Thermal printer(&printerSerial);
WiFiManager wifiManager;

const int httpsPort = 443;
extern const char *host;
extern const char *GScriptId;
String payload_prefix = "{\"command\": \"appendRow\", \"sheet_name\": \"Sheet1\", \"values\": \"";
String payload_suffix = "\"}";
String payload = "";
// Pick a movie
String movieUrl = String("/macros/s/") + GScriptId + "/exec?movie";
String activityUrl = String("/macros/s/") + GScriptId + "/exec?activity";
HTTPSRedirect *client = nullptr;

bool wifiNotFound = false;

int lastButtonState = HIGH;
unsigned long timeSinceReceipt = 0;
unsigned long timeSinceButton = 0; // the last time the output pin was toggled
unsigned long debounceDelay = 50;  // the debounce time; increase if the output flickers

void setup()
{
  pinMode(12, OUTPUT);
  pinMode(13, INPUT_PULLUP);

  digitalWrite(12, HIGH);

  printerSerial.begin(19200); // Initialize SoftwareSerial
  printer.begin();            // Init printer (same regardless of serial type)
  printer.setDefault();       // Restore printer to defaults

  wifiManager.setCustomHeadElement(STYLE);
  wifiManager.setAPCallback(configModeCallback);
  wifiManager.autoConnect(WIFI_NAME);
  if (!wifiNotFound)
  {
    printer.println("Found WiFi network: ");
    printer.println(WiFi.SSID());
  }

  printer.println("IP address:");
  printer.println(WiFi.localIP());
  // Weird space??
  printer.println();

  printer.feed(2);
  printer.sleep();
}

void configModeCallback(WiFiManager *manager)
{
  wifiNotFound = true;
  printer.println("Did not find WiFi\nnetwork! Please\nconfigure it.");
}

void loop()
{
  int reading = digitalRead(13);
  if (reading != lastButtonState)
  {
    timeSinceButton = millis();
  }

  if (millis() - timeSinceButton > 50 && reading == LOW)
  {
    unsigned long interval = 0;
    while (true)
    {
      reading = digitalRead(13);
      interval = millis() - timeSinceButton;
      if (reading != lastButtonState)
      {
        printer.wake();
        if (interval > 1000)
        {
          printUs();
        }
        else
        {
          makeReceipt();
        }
        printer.feed(2);
        printer.sleep();
        break;
      }
      delay(50);
    }
  }

  lastButtonState = reading;
}

void makeReceipt()
{
  // Debounce timer
  unsigned long receiptCalled = millis() - timeSinceReceipt;
  if (receiptCalled < 4000)
  {
    return;
  }
  timeSinceReceipt = receiptCalled;

  // Make the connection its own method?
  // Use HTTPSRedirect class to create a new TLS connection
  client = new HTTPSRedirect(httpsPort);
  client->setInsecure();
  client->setPrintResponseBody(true);
  client->setContentTypeHeader("application/json");

  if (client != nullptr)
  {
    if (!client->connected())
    {
      client->connect(host, httpsPort);
    }
  }

  // Init Objects
  String chosenMovie = getMovie();
  String chosenActivity = getActivity();

  // Justify center for title
  printer.justify('C');

  // Print a title
  printer.println("C + L's Day");

  // Reset justify
  printer.justify('L');

  // Print line sep
  printSep();

  printData("Today's Activity:", chosenActivity);

  // Print Movie
  printData("Today's Movie:", chosenMovie);

  // Seperator before final section
  printSep();

  // Justify center for hearts
  printer.justify('C');

  // Message
  printer.println("Ily!! <3333");

  // Even out the lines
  printer.feed(1);

  printer.setDefault();

  // delete HTTPSRedirect object
  delete client;
  client = nullptr;
}

void printUs()
{
  printer.printBitmap(us_width, us_height, us_data);
}

void printSep()
{
  printer.justify('C');
  printer.println("-----------------------");
  printer.justify('L');
}

String getMovie()
{
  client->GET(movieUrl, host);
  String chosenMovie = client->getResponseBody();
  return chosenMovie;
}

String getActivity()
{
  client->GET(activityUrl, host);
  String chosenActivity = client->getResponseBody();
  return chosenActivity;
}

void printData(String x, String y)
{
  printer.println(x);
  printer.justify('C');
  printer.println(y);
  printer.justify('L');
}