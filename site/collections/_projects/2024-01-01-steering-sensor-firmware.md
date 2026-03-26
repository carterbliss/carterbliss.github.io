---
date: 2026-03-25
title: Steering Sensor Firmware Design
subtitle: HyTech Racing – Embedded Firmware
image: '/images/ht09.png'
---

## Overview

For HyTech's 2026 FSAE Vehicle: HTX, we needed a steering sensor system to intake values from both an analog and digital steering sensor and run real-time angle critical data for vehicle dynamics, traction control, and telemetry. To accomplish this, I worked with a team of four to design and implement the steering system onto the HTX vehicle control front. Our system outputs steering angle conversions to the front dashboard, and also run plausability and recalibration functions. 


## Technical Details

The firmware was written in C++ targeting an teensy 4.1 microcontroller, which also interfaces with an orbis digital sensor.

<style>
.code-accordion details {
  border: 1px solid #30363d;
  border-radius: 8px;
  margin-bottom: 10px;
  background: #161b22;
  overflow: hidden;
}
.code-accordion summary {
  padding: 14px 20px;
  font-size: 15px;
  font-weight: 600;
  color: #e6edf3;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}
.code-accordion summary::-webkit-details-marker { display: none; }
.code-accordion summary::before {
  content: '▶';
  font-size: 11px;
  color: #58a6ff;
  transition: transform 0.2s ease;
}
.code-accordion details[open] summary::before {
  transform: rotate(90deg);
}
.code-accordion details[open] summary {
  border-bottom: 1px solid #30363d;
}
.code-accordion pre {
  margin: 0;
  padding: 20px;
  background: #0d1117;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
}
.code-accordion code {
  color: #c9d1d9;
  font-family: 'Courier New', Courier, monospace;
}
</style>

<div class="code-accordion">

<details>
<summary>Initialize Variables</summary>
<pre><code>// struct SteeringParams_s {
    // raw ADC input signals
    uint32_t min_steering_signal_analog; //Raw ADC value from analog sensor at minimum (left) steering angle (calibration)
    uint32_t max_steering_signal_analog; //Raw ADC value from analog sensor at maximum (right) steering angle
    uint32_t min_steering_signal_digital; //Raw ADC value from digital sensor at minimum (left) steering angle
    uint32_t max_steering_signal_digital; //Raw ADC value from digital sensor at maximum (right) steering angle

    int32_t analog_min_with_margins;
    int32_t analog_max_with_margins;
    int32_t digital_min_with_margins;
    int32_t digital_max_with_margins;

    uint32_t span_signal_analog;
    uint32_t span_signal_digital;
    int32_t digital_midpoint;
    int32_t analog_midpoint;

    // calibration limits
    uint32_t min_observed_digital;
    uint32_t max_observed_digital;
    uint32_t min_observed_analog; // do we need to do min/max calibration for analog?
    uint32_t max_observed_analog;

    // conversion rates
    // float deg_per_count_analog = 0.0439f; //hard coded for analog (180)
    float deg_per_count_analog;
    float deg_per_count_digital; //based on digital readings

    // implausibility values
    float analog_tol; //+- 0.5% error
    float analog_tol_deg;
    float digital_tol_deg; // +- 0.2 degrees error
   
    // rate of angle change
    float max_dtheta_threshold; //maximum change in angle since last reading to consider the reading valid

    // difference rating
    float error_between_sensors_tolerance; //maximum difference between digital and analog sensor allowed
};

struct SteeringSystemData_s
{
    uint32_t analog_raw;
    uint32_t digital_raw;

    float analog_steering_angle; //in degrees
    float digital_steering_angle; //in degrees
    float output_steering_angle; // represents the better output of the two sensors or some combination of the values


    float analog_steering_velocity_deg_s; //in degrees per second
    float digital_steering_velocity_deg_s;


    bool digital_oor_implausibility;
    bool analog_oor_implausibility;
    bool sensor_disagreement_implausibility;
    bool dtheta_exceeded_analog;
    bool dtheta_exceeded_digital;
    bool both_sensors_fail;
};
</code></pre>
</details>

<details>
<summary>Recalibrate</summary>
<pre><code>// Paste your recalibrate code here
</code></pre>
</details>

</div>

## Challenges

One of the main challenges was ensuring the sensor readings remained accurate and noise-free under the electromagnetic interference present in a high-voltage EV environment. This required both hardware-level shielding considerations and software-side filtering algorithms.

## Outcome

The firmware was successfully integrated into the car's sensor suite and validated through both bench testing and on-track data collection, contributing to improved vehicle control and telemetry accuracy.
