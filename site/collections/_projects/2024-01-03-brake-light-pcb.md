---
date: 2024-01-03
title: Brake-Light PCB
subtitle: HyTech Racing – PCB Design
image: '/images/project-3.jpg'
---

## Overview

Designed a custom PCB for the brake-light system on HyTech Racing's formula electric race car. The board is required by competition regulations and must reliably indicate braking to following drivers under the harsh conditions of competitive motorsport.

## Technical Details

The PCB handles:

- **Signal input**: Reading the brake pressure sensor or pedal position signal from the car's CAN bus or direct analog line
- **LED driver circuit**: Driving a high-brightness LED array with sufficient current for visibility in outdoor conditions
- **Fault tolerance**: Designed with redundancy considerations so that a single component failure does not result in a complete loss of brake light function
- **Connector and form factor**: Compact layout designed to fit within the car's bodywork constraints, with appropriate connector selection for vibration resistance

## Design Process

The board was designed in KiCad, going through schematic review, DRC checks, and design-for-manufacture validation before fabrication. Trace widths and copper pours were sized to handle the LED driver current without excessive temperature rise.

## Outcome

The brake-light PCB was manufactured, assembled, and installed on the race car, meeting all competition regulations and performing reliably through testing and racing events.
