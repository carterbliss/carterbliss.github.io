---
date: 2024-01-01
title: Steering Sensor Firmware Design
subtitle: HyTech Racing – Embedded Systems
image: '/images/project-1.jpg'
---

## Overview

As part of Georgia Tech's HyTech Racing team, I designed and implemented the firmware for the steering angle sensor system used on the formula-style electric race car. The steering sensor provides real-time angle data critical for vehicle dynamics, traction control, and telemetry.

## Technical Details

The firmware was written in C/C++ targeting an STM32 microcontroller, interfacing with a rotary encoder via SPI. Key responsibilities included:

- Configuring SPI communication between the MCU and the steering angle sensor
- Implementing interrupt-driven data acquisition for low-latency readings
- Filtering and calibrating raw sensor output into meaningful angle values
- Integrating the sensor data into the car's CAN bus network for consumption by other systems

## Challenges

One of the main challenges was ensuring the sensor readings remained accurate and noise-free under the electromagnetic interference present in a high-voltage EV environment. This required both hardware-level shielding considerations and software-side filtering algorithms.

## Outcome

The firmware was successfully integrated into the car's sensor suite and validated through both bench testing and on-track data collection, contributing to improved vehicle control and telemetry accuracy.
