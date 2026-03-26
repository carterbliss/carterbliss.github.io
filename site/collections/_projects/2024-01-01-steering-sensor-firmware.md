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

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/cpp.min.js"></script>

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
  flex-shrink: 0;
}
.code-accordion details[open] summary::before {
  transform: rotate(90deg);
}
.code-accordion details[open] summary {
  border-bottom: 1px solid #30363d;
}
.code-accordion .code-description {
  padding: 14px 20px;
  font-size: 14px;
  line-height: 1.6;
  color: #8b949e;
  border-bottom: 1px solid #30363d;
  background: #161b22;
}
.code-accordion .code-description strong {
  color: #c9d1d9;
}
.code-accordion pre {
  margin: 0 !important;
  border-radius: 0 !important;
  font-size: 13px !important;
  line-height: 1.6 !important;
}
.code-accordion pre code.hljs {
  padding: 20px !important;
}
</style>

<div class="code-accordion">

<details>
<summary>Initialize Variables</summary>
<div class="code-description">
  
  <strong>Approach:</strong> To run plausability functions, range functions, and calibration functions, we need to establish two structs that will be used throughout the system. Our first struct is steering params, which essentially sets all relevant extremeties and important data points, such as the midpoint adc value. Our system data struct is used for real time sensor value input. These are the raw values we take from our steering sensor to input into our system's functions. 
</div>
<pre><code class="language-cpp">struct SteeringParams_s {
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
    uint32_t min_observed_analog;
    uint32_t max_observed_analog;

    // conversion rates
    float deg_per_count_analog;
    float deg_per_count_digital;

    // implausibility values
    float analog_tol;
    float analog_tol_deg;
    float digital_tol_deg;

    // rate of angle change
    float max_dtheta_threshold;

    // difference rating
    float error_between_sensors_tolerance;
};

struct SteeringSystemData_s
{
    uint32_t analog_raw;
    uint32_t digital_raw;

    float analog_steering_angle;
    float digital_steering_angle;
    float output_steering_angle;

    float analog_steering_velocity_deg_s;
    float digital_steering_velocity_deg_s;

    bool digital_oor_implausibility;
    bool analog_oor_implausibility;
    bool sensor_disagreement_implausibility;
    bool dtheta_exceeded_analog;
    bool dtheta_exceeded_digital;
    bool both_sensors_fail;
};</code></pre>
</details>

<details>
<summary>Recalibrate</summary>
<div class="code-description">

  <strong>Approach:</strong> For our steering system, we only recalibrate the digital sensor, since its data analysis means come from a magnet which can shift during motion. Therefore for this function we intake the digitals raw values, as well as a button on the steering wheel which triggers a recalibration. Our function then constantly reupdates relative extremeties, and once the button releases it will write those values to EEPROM (Later seen in vehicle control front tasks).
</div>
<pre><code class="language-cpp">void SteeringSystem::recalibrate_steering_digital(const uint32_t analog_raw, const uint32_t digital_raw, bool calibration_is_on) {
    //get current raw angles
    const uint32_t curr_digital_raw = static_cast<uint32_t>(digital_raw); //NOLINT will eventually be uint32
    
    //button just pressed ->recalibration window
    if (calibration_is_on && !_calibrating){
        _calibrating = true;
        _steeringParams.min_observed_digital = UINT32_MAX; //establishes a big number that will be greater than the readings
        _steeringParams.max_observed_digital = 0;
    }
    
    if (calibration_is_on && _calibrating) {
        update_observed_steering_limits(analog_raw, digital_raw);
    }


    //button released -> commit the values
    if (!calibration_is_on && _calibrating) {
        _calibrating = false;
        _steeringParams.min_steering_signal_digital = _steeringParams.min_observed_digital;
        _steeringParams.max_steering_signal_digital = _steeringParams.max_observed_digital;
        // swaps  min & max in the params if sensor is flipped
        if (_steeringParams.min_steering_signal_digital > _steeringParams.max_steering_signal_digital)
        {
            std::swap(_steeringParams.min_steering_signal_digital,_steeringParams.max_steering_signal_digital);
        }
        _steeringParams.span_signal_digital = _steeringParams.max_steering_signal_digital-_steeringParams.min_steering_signal_digital;
        _steeringParams.analog_tol_deg = static_cast<float>(_steeringParams.span_signal_analog) * _steeringParams.analog_tol * _steeringParams.deg_per_count_analog;
        _steeringParams.digital_midpoint = static_cast<int32_t>((_steeringParams.max_steering_signal_digital + _steeringParams.min_steering_signal_digital) / 2); //NOLINT
        _steeringParams.analog_midpoint = static_cast<int32_t>((_steeringParams.max_steering_signal_analog + _steeringParams.min_steering_signal_analog) / 2); //NOLINT
        const int32_t analog_margin_counts = static_cast<int32_t>(_steeringParams.analog_tol * static_cast<float>(_steeringParams.span_signal_analog)); //NOLINT
        const int32_t digital_margin_counts = static_cast<int32_t>(_steeringParams.digital_tol_deg /_steeringParams.deg_per_count_digital); //NOLINT
        _steeringParams.analog_min_with_margins = static_cast<int32_t>(_steeringParams.min_steering_signal_analog) - analog_margin_counts;
        _steeringParams.analog_max_with_margins = static_cast<int32_t>(_steeringParams.max_steering_signal_analog) + analog_margin_counts;
        _steeringParams.digital_min_with_margins = static_cast<int32_t>(_steeringParams.min_steering_signal_digital) - digital_margin_counts;
        _steeringParams.digital_max_with_margins = static_cast<int32_t>(_steeringParams.max_steering_signal_digital) + digital_margin_counts;
        _steeringParams.error_between_sensors_tolerance = _steeringParams.analog_tol_deg + _steeringParams.digital_tol_deg;
    } 
}
</code></pre>
</details>

<details>
<summary>Converting Values</summary>
<div class="code-description">
  <strong>Approach:</strong> Add a description of how you approached converting values here.
</div>
<pre><code class="language-cpp">// Paste your converting values code here
</code></pre>
</details>

<details>
<summary>Evaluating Out of Range</summary>
<div class="code-description">
  <strong>Approach:</strong> Add a description of how you evaluated out-of-range values here.
</div>
<pre><code class="language-cpp">// Paste your out-of-range evaluation code here
</code></pre>
</details>

<details>
<summary>Evaluating Steering Speed</summary>
<div class="code-description">
  <strong>Approach:</strong> Add a description of how you evaluated steering speed here.
</div>
<pre><code class="language-cpp">// Paste your steering speed evaluation code here
</code></pre>
</details>

<details>
<summary>Evaluate Steering</summary>
<div class="code-description">
  <strong>Approach:</strong> Add a description of the overall steering evaluation logic here.
</div>
<pre><code class="language-cpp">// Paste your evaluate steering code here
</code></pre>
</details>

<details>
<summary>Vehicle Control Front Tasks</summary>
<div class="code-description">
  <strong>Approach:</strong> Add a description of the vehicle control front task integration here.
</div>
<pre><code class="language-cpp">// Paste your vehicle control front tasks code here
</code></pre>
</details>

<details>
<summary>Unit Tests</summary>
<div class="code-description">
  <strong>Approach:</strong> Add a description of your unit testing approach here.
</div>
<pre><code class="language-cpp">// Paste your unit tests code here
</code></pre>
</details>

</div>

<script>document.addEventListener('DOMContentLoaded', function() { hljs.highlightAll(); });</script>

## Challenges

One of the main challenges was ensuring the sensor readings remained accurate and noise-free under the electromagnetic interference present in a high-voltage EV environment. This required both hardware-level shielding considerations and software-side filtering algorithms.

## Outcome

The firmware was successfully integrated into the car's sensor suite and validated through both bench testing and on-track data collection, contributing to improved vehicle control and telemetry accuracy.
