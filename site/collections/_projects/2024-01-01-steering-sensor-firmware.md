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
  
  <strong>Approach:</strong> To run plausability, range, and calibration functions, we need to establish two structures that will be used throughout the system. Our first struct is steering parameters, which essentially sets all relevant extremeties and important data points, such as the midpoint analog to digital conversion(adc) value. Our system data struct is used for real time sensor value input. These are the raw adc values we take from our steering sensor to input into our system's functions. 
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

  <strong>Approach:</strong> For our steering system, we only recalibrate the digital sensor, since its sensor readings  come from a magnet which can rattle when the car is active. Therefore, for this function we intake the digital raw values, as well as a button on the steering wheel which triggers a recalibration. Our function then constantly reupdates relative extremeties, and once the button releases it will write those values to EEPROM (Later seen in vehicle control front tasks). Additionally, in this function we set our steering parameters according to the minimum and maximum values we read. 
</div>
<pre><code class="language-cpp">void SteeringSystem::recalibrate_steering_digital(const uint32_t analog_raw, const uint32_t digital_raw, bool calibration_is_on) {
    //get current raw angles
    const uint32_t curr_digital_raw = static_cast&lt;uint32_t&gt;(digital_raw); //NOLINT will eventually be uint32
    
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
        _steeringParams.analog_tol_deg = static_cast&lt;float&gt;(_steeringParams.span_signal_analog) * _steeringParams.analog_tol * _steeringParams.deg_per_count_analog;
        _steeringParams.digital_midpoint = static_cast&lt;int32_t&gt;((_steeringParams.max_steering_signal_digital + _steeringParams.min_steering_signal_digital) / 2); //NOLINT
        _steeringParams.analog_midpoint = static_cast&lt;int32_t&gt;((_steeringParams.max_steering_signal_analog + _steeringParams.min_steering_signal_analog) / 2); //NOLINT
        const int32_t analog_margin_counts = static_cast&lt;int32_t&gt;(_steeringParams.analog_tol * static_cast&lt;float&gt;(_steeringParams.span_signal_analog)); //NOLINT
        const int32_t digital_margin_counts = static_cast&lt;int32_t&gt;(_steeringParams.digital_tol_deg /_steeringParams.deg_per_count_digital); //NOLINT
        _steeringParams.analog_min_with_margins = static_cast&lt;int32_t&gt;(_steeringParams.min_steering_signal_analog) - analog_margin_counts;
        _steeringParams.analog_max_with_margins = static_cast&lt;int32_t&gt;(_steeringParams.max_steering_signal_analog) + analog_margin_counts;
        _steeringParams.digital_min_with_margins = static_cast&lt;int32_t&gt;(_steeringParams.min_steering_signal_digital) - digital_margin_counts;
        _steeringParams.digital_max_with_margins = static_cast&lt;int32_t&gt;(_steeringParams.max_steering_signal_digital) + digital_margin_counts;
        _steeringParams.error_between_sensors_tolerance = _steeringParams.analog_tol_deg + _steeringParams.digital_tol_deg;
    } 
}
</code></pre>
</details>

<details>
<summary>Converting Values</summary>
<div class="code-description">
  <strong>Approach:</strong> To convert from adc to a steering angle between -90 and 90, we simply subtract the midpoint adc value from whatever raw value we currently read, then multiply it by the degrees per count of adc (which is determined in recalibrate steering).
</div>
<pre><code class="language-cpp">float SteeringSystem::_convert_digital_sensor(const uint32_t digital_raw) {
    // Same logic for digital
    const int32_t offset = static_cast&lt;int32_t&gt;(digital_raw) - _steeringParams.digital_midpoint; //NOLINT
    return static_cast&lt;float&gt;(offset) * _steeringParams.deg_per_count_digital;
}

float SteeringSystem::_convert_analog_sensor(const uint32_t analog_raw) {
    // Get the raw value
    const int32_t offset = static_cast&lt;int32_t&gt;(analog_raw) - _steeringParams.analog_midpoint; //NOLINT
    return static_cast&lt;float&gt;(offset) * _steeringParams.deg_per_count_analog;
}
</code></pre>
</details>

<details>
<summary>Evaluating Out of Range</summary>
<div class="code-description">
  <strong>Approach:</strong> The out of range function determines if we are having an issue with either sensor, which then determines our output in evaluate steering. For this function, we check whether the recorded values are within the bounds we calibrated.
</div>
<pre><code class="language-cpp">bool SteeringSystem::_evaluate_steering_oor_analog(const uint32_t steering_analog_raw) { // RAW
    return (static_cast&lt;int32_t&gt;(steering_analog_raw) &lt; _steeringParams.analog_min_with_margins || static_cast&lt;int32_t&gt;(steering_analog_raw) &gt; _steeringParams.analog_max_with_margins);
}

bool SteeringSystem::_evaluate_steering_oor_digital(const uint32_t steering_digital_raw) {// RAW
    return (static_cast&lt;int32_t&gt;(steering_digital_raw) &lt; _steeringParams.digital_min_with_margins || static_cast&lt;int32_t&gt;(steering_digital_raw) &gt; _steeringParams.digital_max_with_margins);
}
</code></pre>
</details>

<details>
<summary>Evaluating Steering Speed</summary>
<div class="code-description">
  <strong>Approach:</strong> Evaluating if the steering angle changed too quickly is another means of possible sensor error. For this function we check whether or not the change in angle is greater than the value in steering parameters. 
</div>
<pre><code class="language-cpp">bool SteeringSystem::_evaluate_steering_dtheta_exceeded(float dtheta){
    return (fabs(dtheta) &gt; _steeringParams.max_dtheta_threshold);
}
</code></pre>
</details>

<details>
<summary>Evaluate Steering</summary>
<div class="code-description">
  <strong>Approach:</strong> The evaluate steering function essentially runs all of our system's function code by taking in the raw data, running it through the conversion functions, checking the values for plausability, and creating an output struct called system data that will output to the car's vehicle control front. This function also takes in the steering interface errors (orbis sensor) that also determine the output angle onto the front dashboard. You can think of this function as the glue that brings all the functions together and allows it to output the value we are seeking. 
</div>
<pre><code class="language-cpp">// void SteeringSystem::evaluate_steering(const uint32_t analog_raw, const SteeringEncoderConversion_s digital_data, const uint32_t current_millis) {
    // Reset flags
    _steeringSystemData.digital_oor_implausibility = false;
    _steeringSystemData.analog_oor_implausibility = false;
    _steeringSystemData.sensor_disagreement_implausibility = false;
    _steeringSystemData.dtheta_exceeded_analog = false;
    _steeringSystemData.dtheta_exceeded_digital = false;
    _steeringSystemData.both_sensors_fail = false;

    const uint32_t digital_raw = digital_data.raw;

    SteeringEncoderStatus_e digital_status = digital_data.status;
    bool digital_fault = (digital_status == SteeringEncoderStatus_e::STEERING_ENCODER_ERROR);
    _steeringSystemData.digital_raw = digital_fault ? 0U : digital_raw;


    _steeringSystemData.analog_raw = analog_raw;

    //Conversion from raw ADC to degrees
    _steeringSystemData.analog_steering_angle = _convert_analog_sensor(analog_raw);
    _steeringSystemData.digital_steering_angle = digital_fault ? 0.0f : _convert_digital_sensor(digital_raw);
    
    uint32_t dt = current_millis - _prev_timestamp; //current_millis is seperate data input

    _steeringSystemData.digital_raw = digital_fault ? 0U : digital_raw;
//     //Conversion from raw ADC to degrees
//     _steeringSystemData.analog_steering_angle = _convert_analog_sensor(analog_raw);
//     _steeringSystemData.digital_steering_angle = digital_fault ? 0.0f : _convert_digital_sensor(digital_raw);    
//     uint32_t dt = current_millis - _prev_timestamp; //current_millis is seperate data input

    if (!_first_run && dt > 0) { //check that we not on the first run which would mean no previous data
        float dtheta_analog = _steeringSystemData.analog_steering_angle - _prev_analog_angle; //prev_angle established in last run
        float dtheta_digital = _steeringSystemData.digital_steering_angle - _prev_digital_angle;
        _steeringSystemData.analog_steering_velocity_deg_s = (dtheta_analog / dt) * 1000.0f; //NOLINT ms to s
        _steeringSystemData.digital_steering_velocity_deg_s = (dtheta_digital / dt) * 1000.0f; //NOLINT ms to s

        //Check if either sensor moved too much in one tick
        _steeringSystemData.dtheta_exceeded_analog = _evaluate_steering_dtheta_exceeded(dtheta_analog);
        _steeringSystemData.dtheta_exceeded_digital = _evaluate_steering_dtheta_exceeded(dtheta_digital);

        //Check if either sensor is out of range (pass in raw)
        _steeringSystemData.analog_oor_implausibility = _evaluate_steering_oor_analog(static_cast&lt;uint32_t&gt;(analog_raw));
        _steeringSystemData.digital_oor_implausibility = _evaluate_steering_oor_digital(static_cast&lt;uint32_t&gt;(digital_raw)) || digital_fault;

        //Check if there is too much of a difference between sensor values
        float sensor_difference = std::fabs(_steeringSystemData.analog_steering_angle - _steeringSystemData.digital_steering_angle);
        bool sensors_agree = (sensor_difference <= _steeringParams.error_between_sensors_tolerance); //steeringParams.error
        _steeringSystemData.sensor_disagreement_implausibility = !sensors_agree;

        //create an algorithm/ checklist to determine which sensor we trust more,
        //or, if we should have an algorithm to have a weighted calculation based on both values
        bool analog_valid = !_steeringSystemData.analog_oor_implausibility && !_steeringSystemData.dtheta_exceeded_analog;
        bool digital_valid = !_steeringSystemData.digital_oor_implausibility && !_steeringSystemData.dtheta_exceeded_digital && !digital_fault;

        if (analog_valid && digital_valid) {
            //if sensors have acceptable difference, use digital as steering angle
            if (sensors_agree) {
                _steeringSystemData.output_steering_angle = _steeringSystemData.digital_steering_angle;
            } else {
                _steeringSystemData.output_steering_angle = _steeringSystemData.digital_steering_angle; //default to original, but we need to consider what we really want to put here
            }
        } else if (analog_valid) {
            _steeringSystemData.output_steering_angle = _steeringSystemData.analog_steering_angle;
        } else if (digital_valid) {
            _steeringSystemData.output_steering_angle = _steeringSystemData.digital_steering_angle;
        } else { // if both sensors fail
            _steeringSystemData.output_steering_angle = _prev_digital_angle;
            _steeringSystemData.both_sensors_fail = true;
        }
    }
    //Update states
    _prev_analog_angle = _steeringSystemData.analog_steering_angle;
    _prev_digital_angle = _steeringSystemData.digital_steering_angle;
    _prev_timestamp = current_millis;
    _first_run = false;
}
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
