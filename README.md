# OurBox

OurBox is a hardware project/gift built with NodeMCU and Google Sheets.

OurBox randomly chooses a movie/activity from a shared Google Sheet and prints it onto a receipt.

## Project Images

The box:

The sheet:

## Features

On button press:

- Movie: Chooses a movie from the list
- Activity: Chooses an activity from the list

On button hold:

- Prints out a picture of us

## How it works

Inside the box is a NodeMCU esp8266 board with a WiFi connection. By itself it doesn't do much, however, when the button is pressed:

1. The board asks the google app's (NodeSheetAPI) api for a movie and an activity.
2. The board generates a cute receipt to inform us of today's chosen movie and activity.

That's it.

The board also uses [WifiManager](https://github.com/tzapu/WiFiManager) to connect to new wifi networks and [HTTPSRedirect](https://github.com/electronicsguy/HTTPSRedirect) to query the api.

## Hardware + Wiring

This project uses this printer: https://www.adafruit.com/product/597 and a 19mm glowing button, as well as a NodeMCU ESP-8266 board.

A wiring diagram will be [here soon]().

## Sheets Integration

Details about the spreadsheet and integration will be added here.
