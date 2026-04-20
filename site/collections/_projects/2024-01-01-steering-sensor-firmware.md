---
date: 2026-03-24
title: Steering Sensor Firmware Design
subtitle: HyTech Racing – Embedded Firmware
image: '/images/ht09.png'
---

## Overview

For HyTech's 2026 FSAE Vehicle: HTX, the electrical subteam needed a steering sensor system to intake values from both an analog and digital steering sensor and run real-time angle critical data for vehicle dynamics, traction control, and telemetry. To accomplish this, I designed and implemented the steering system onto the HTX Vehicle Control Front. System outputs steering angle conversions to the front dashboard, run plausibility checks for our sensor & interface, recalibrates through analyzing vehicle state from Vehicle Control Rear, and sends these values to drivebrain via CAN & Ethernet. 


## Technical Details

The firmware was written in C++ targeting an teensy 4.1 microcontroller, which also interfaces with an Orbis digital sensor and a Phoenix America analog sensor. Microcontroller intakes analog voltage from analog sensor and raw reading from digital digital, then runs our steering system to conduct necessary functions. 

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
/* Accordion group */
.code-accordion details.accordion-group {
  border-color: #21262d;
  background: #0d1117;
  margin-bottom: 16px;
}
.code-accordion details.accordion-group > summary {
  font-size: 17px;
  color: #58a6ff;
}
.code-accordion details.accordion-group[open] > summary {
  border-bottom-color: #21262d;
}
.accordion-group-body {
  padding: 10px 12px;
  background: #0d1117;
}
.accordion-group-body details:last-child {
  margin-bottom: 0;
}
</style>

<div class="code-accordion">


<details class="accordion-group">
<summary>Steering System Design</summary>
<div class="accordion-group-body">

<details>
<summary>Initialize Variables</summary>
<div class="code-description">
  
  <strong>Approach:</strong> To run plausibility, range, and calibration functions, we need to establish two structures that will be used throughout the system. Our first struct is steering parameters, which essentially sets all relevant extremities and important data points, such as the midpoint analog to digital conversion(adc) value. Our system data struct is used for real time sensor value input. These are the raw adc values we take from our steering sensor to input into our system's functions. 
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
    bool analog_clipped;
    bool digital_clipped;
};</code></pre>
</details>


<details>
<summary>Recalibrate</summary>
<div class="code-description">

  <strong>Approach:</strong> For our steering system, we recalibrate the digital and anlog sensor to account for physical sensor altercations (rattling, shifting, etc). Our system constantly reads observed relative extremeties through asnyc tasks, then once recalibration is trigged we write the new values to our steering params. We also run checks to observe if a min/max is at the physical sensor max: indicating a sensor clip. When the sensor clips it insinuates a full rotation and value reset, but our system would then cling to this min/max as it misinterprets the actual steering angle min/max. We also check if the span is marginally greater than the possible steering angle span allows, in which case the sensor has moved and is clinging to improbable adc/raw values. 
</div>
<pre><code class="language-cpp">void SteeringSystem::recalibrate_steering_digital() {
    if (min_observed_analog == 0)
    {
        min_observed_analog = UINT32_MAX; // clipping if it is at 0, it is likely sensor is clipping or clipped in past and reading is holding the 0 value. 
    }
    if (max_observed_analog > 3685) 
    {
        max_observed_analog = 0; // clipping
    }
    if (min_observed_digital == 0)
    {
        min_observed_digital = UINT32_MAX; // clipping on prior run. 
    }
    if (max_observed_digital == 16384) 
    {
        max_observed_digital = 0; // clipping
    }

    _steeringParams.min_steering_signal_analog = min_observed_analog;
    _steeringParams.max_steering_signal_analog = max_observed_analog;
    _steeringParams.min_steering_signal_digital = min_observed_digital;
    _steeringParams.max_steering_signal_digital = max_observed_digital;
    // swaps  min & max in the params if sensor is flipped
    if (_steeringParams.min_steering_signal_digital > _steeringParams.max_steering_signal_digital) {
        std::swap(_steeringParams.min_steering_signal_digital, _steeringParams.max_steering_signal_digital);
    }
    if (_steeringParams.min_steering_signal_analog > _steeringParams.max_steering_signal_analog) {
        std::swap(_steeringParams.min_steering_signal_analog, _steeringParams.max_steering_signal_analog);
    }
    _steeringParams.span_signal_digital = _steeringParams.max_steering_signal_digital-_steeringParams.min_steering_signal_digital;
    _steeringParams.analog_tol_deg = static_cast&lt;float&gt;(_steeringParams.span_signal_analog) * _steeringParams.analog_tolerance * _steeringParams.deg_per_count_analog;
    _steeringParams.digital_tol_deg = static_cast&lt;float&gt;(_steeringParams.span_signal_digital) *_steeringParams.digital_tolerance * _steeringParams.deg_per_count_digital;
    _steeringParams.digital_midpoint = static_cast&lt;int32_t&gt;((_steeringParams.max_steering_signal_digital + _steeringParams.min_steering_signal_digital) / 2); //NOLINT
    _steeringParams.analog_midpoint = static_cast&lt;int32_t&gt;((_steeringParams.max_steering_signal_analog + _steeringParams.min_steering_signal_analog) / 2); //NOLINT
    _steeringParams.analog_min_with_margins = static_cast&lt;int32_t&gt;(_steeringParams.min_steering_signal_analog) - _steeringParams.analog_tol_deg;
    _steeringParams.analog_max_with_margins = static_cast&lt;int32_t&gt;(_steeringParams.max_steering_signal_analog) + _steeringParams.analog_tol_deg;
    _steeringParams.digital_min_with_margins = static_cast&lt;int32_t&gt;(_steeringParams.min_steering_signal_digital) - _steeringParams.digital_tol_deg;
    _steeringParams.digital_max_with_margins = static_cast&lt;int32_t&gt;(_steeringParams.max_steering_signal_digital) + _steeringParams.digital_tol_deg;

    if ( _steeringParams.span_signal_analog > 2000)
    {
        min_observed_analog = UINT32_MAX; // after calculating params, if the range is marginally greater than half the steering wheel adc, likely the min and max are clinging to a prior run that is not applicable, meaning we will need to reset the boundaries. 
        max_observed_analog = 0;
    }
    if (_steeringParams.span_signal_digital > 9000)
    {
        min_observed_digital = UINT32_MAX; 
        max_observed_digital = 0;
    }
}

void SteeringSystem::update_observed_steering_limits(const uint32_t analog_raw, const uint32_t digital_raw) {
    min_observed_analog = std::min(min_observed_analog, static_cast&lt;uint32_t&gt;(analog_raw));
    max_observed_analog = std::max(max_observed_analog, static_cast&lt;uint32_t&gt;(analog_raw));
    min_observed_digital = std::min(min_observed_digital, static_cast&lt;uint32_t&gt;(digital_raw)); //NOLINT should both be uint32_t
    max_observed_digital = std::max(max_observed_digital, static_cast&lt;uint32_t&gt;(digital_raw)); //NOLINT ^
}
</code></pre>
</details>


<details>
<summary>Converting Values</summary>
<div class="code-description">
  <strong>Approach:</strong> To convert from adc to a steering angle between -90 and 90, we simply subtract the midpoint adc value from whatever raw value we currently read, then multiply it by the degrees per count of adc (which is determined in recalibrate steering). Digital reads positively when moving left to right, so for consistency the convert digital sensor is flipped. 
</div>
<pre><code class="language-cpp">float SteeringSystem::_convert_digital_sensor(const uint32_t digital_raw) {
    // Same logic for digital
    const int32_t offset =  _steeringParams.digital_midpoint - static_cast&lt;int32_t&gt;(digital_raw); //NOLINT
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
  <strong>Approach:</strong> The evaluate steering function essentially runs all of our system's function code by taking in the raw data, running it through the conversion functions, checking the values for plausibility, and creating an output struct called system data that will output to the car's vehicle control front. This function also takes in the steering interface errors (orbis sensor) that also determine the output angle onto the front dashboard. You can think of this function as the glue that brings all the functions together and allows it to output the value we are seeking. 
</div>
<pre><code class="language-cpp">void SteeringSystem::evaluate_steering(const uint32_t analog_raw, const SteeringEncoderReading_s digital_data, const uint32_t current_millis) {
    // Reset flags
    _steeringSystemData.digital_oor_implausibility = false;
    _steeringSystemData.analog_oor_implausibility = false;
    _steeringSystemData.sensor_disagreement_implausibility = false;
    _steeringSystemData.dtheta_exceeded_analog = false;
    _steeringSystemData.dtheta_exceeded_digital = false;
    _steeringSystemData.both_sensors_fail = false;
    _steeringSystemData.analog_clipped = (min_observed_analog == 0 || max_observed_analog > 3685); // assuming 12-bit ADC with 10% dropoff
    _steeringSystemData.digital_clipped = (min_observed_digital == 0 || max_observed_digital > 16380); // assuming 14-bit ADC with minimal dropoff

    const uint32_t digital_raw = digital_data.rawValue;

    SteeringEncoderStatus_e digital_status = digital_data.status;
    bool digital_fault = (digital_status == SteeringEncoderStatus_e::ERROR);
    _steeringSystemData.interface_sensor_error = digital_fault;
    _steeringSystemData.digital_raw = digital_raw;

    _steeringSystemData.analog_raw = analog_raw;

    //Conversion from raw ADC to degrees
    _steeringSystemData.analog_steering_angle = _convert_analog_sensor(analog_raw);
    _steeringSystemData.digital_steering_angle = _convert_digital_sensor(digital_raw);
    
    uint32_t dt = current_millis - _prev_timestamp; //current_millis is seperate data input  

    if (!_first_run && dt > 0) { //check that we not on the first run which would mean no previous data
        float dtheta_analog = _steeringSystemData.analog_steering_angle - _prev_analog_angle; //prev_angle established in last run
        if (dtheta_analog < 2)//make constant in VCF constants 
        {
            _steeringSystemData.analog_steering_velocity_deg_s = 0; //NOLINT ms to s
        }
        else
        {
            _steeringSystemData.analog_steering_velocity_deg_s = (dtheta_analog / dt) * 1000.0f; //NOLINT ms to s
        }
        
        float dtheta_digital = _steeringSystemData.digital_steering_angle - _prev_digital_angle;
        _steeringSystemData.digital_steering_velocity_deg_s = (dtheta_digital / dt) * 1000.0f; //NOLINT ms to s

        //Check if either sensor moved too much in one tick
        _steeringSystemData.dtheta_exceeded_analog = _evaluate_steering_dtheta_exceeded(_steeringSystemData.analog_steering_velocity_deg_s);
        _steeringSystemData.dtheta_exceeded_digital = _evaluate_steering_dtheta_exceeded(_steeringSystemData.digital_steering_velocity_deg_s); // use digital velocity for dtheta check since it's more precise and we are concerned about large changes in angle that could be caused by noise in the analog sensor

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
<summary>Unit Tests</summary>
<div class="code-description">
  <strong>Approach:</strong> Unit tests are our first line of verification before any hardware is involved. We used Google Test on PlatformIO with a hand-coded parameter struct that stands in for real calibration data. Each test targets a specific function and asserts an expected outcome: <code>true</code>, <code>false</code>, <code>EXPECT_EQ</code>, or <code>EXPECT_NEAR</code> within a thousandth of a degree to catch floating-point drift. The tests not shown here follow the same pattern: feed a modified input into the steering system and confirm the output changes as expected.
</div>
<pre><code class="language-cpp">#define STEERING_SYSTEM_TEST
#include &lt;gtest/gtest.h&gt;
#include &lt;string&gt;
#include "SteeringSystem.h"
#include "SharedFirmwareTypes.h"
#include &lt;array&gt;
#include &lt;iostream&gt;

SteeringParams_s gen_default_params(){
    SteeringParams_s params{};
    //hard code the parmas for sensors
    params.min_steering_signal_analog = 1024;
    params.max_steering_signal_analog = 3071;//actual hard coded

    params.min_steering_signal_digital = 25;
    params.max_steering_signal_digital = 8000; //testing values

    params.span_signal_analog = 4095;
    params.span_signal_digital = 8000;

    params.min_observed_digital = 2000;
    params.max_observed_digital = 6000;

    params.deg_per_count_analog = 0.087890625f;
    params.deg_per_count_digital = 0.02197265625f;

    params.analog_tol = 0.005f;
    params.analog_tol_deg = 0.11377778f;
    params.digital_tol_deg = 0.2f;

    params.max_dtheta_threshold = 5.0f;//change
    params.error_between_sensors_tolerance = 0.31377778f;

    params.digital_midpoint = (params.min_steering_signal_digital + params.max_steering_signal_digital) / 2;
    params.analog_midpoint = (params.min_steering_signal_analog + params.max_steering_signal_analog) / 2;

    const int32_t analog_margin_counts = static_cast&lt;int32_t&gt;(params.analog_tol * static_cast&lt;float&gt;(params.span_signal_analog));
    const int32_t digital_margin_counts = static_cast&lt;int32_t&gt;(params.digital_tol_deg / params.deg_per_count_digital);

    params.analog_min_with_margins = static_cast&lt;int32_t&gt;(params.min_steering_signal_analog) - analog_margin_counts;
    params.analog_max_with_margins = static_cast&lt;int32_t&gt;(params.max_steering_signal_analog) + analog_margin_counts;
    params.digital_min_with_margins = static_cast&lt;int32_t&gt;(params.min_steering_signal_digital) - digital_margin_counts;
    params.digital_max_with_margins = static_cast&lt;int32_t&gt;(params.max_steering_signal_digital) + digital_margin_counts;
    return params;
}

void debug_print_steering(const SteeringSystemData_s& data){
    std::cout &lt;&lt; "analog_steering_angle: "  &lt;&lt; data.analog_steering_angle &lt;&lt; " deg\n";
    std::cout &lt;&lt; "digital_steering_angle: " &lt;&lt; data.digital_steering_angle &lt;&lt; " deg\n";
    std::cout &lt;&lt; "output_steering_angle: "  &lt;&lt; data.output_steering_angle &lt;&lt; " deg\n";
    std::cout &lt;&lt; "analog_oor_implausibility: "          &lt;&lt; data.analog_oor_implausibility &lt;&lt; "\n";
    std::cout &lt;&lt; "digital_oor_implausibility: "         &lt;&lt; data.digital_oor_implausibility &lt;&lt; "\n";
    std::cout &lt;&lt; "sensor_disagreement_implausibility: " &lt;&lt; data.sensor_disagreement_implausibility &lt;&lt; "\n";
    std::cout &lt;&lt; "dtheta_exceeded_analog: "  &lt;&lt; data.dtheta_exceeded_analog &lt;&lt; "\n";
    std::cout &lt;&lt; "dtheta_exceeded_digital: " &lt;&lt; data.dtheta_exceeded_digital &lt;&lt; "\n";
}

TEST(SteeringSystemTesting, test_adc_to_degree_conversion)
{
    auto params = gen_default_params();
    SteeringSystem steering(params);

    uint32_t analog_mid = (params.min_steering_signal_analog + params.max_steering_signal_analog) / 2;
    uint32_t digital_mid = (params.min_steering_signal_digital + params.max_steering_signal_digital) / 2;

    //midpoints
    SteeringSensorData_s midpoint{};
    midpoint.analog_steering_degrees = analog_mid;
    midpoint.digital_steering_analog = digital_mid;
    steering.evaluate_steering(midpoint, 1000);
    auto data = steering.get_steering_system_data();
    EXPECT_NEAR(data.analog_steering_angle, 0.0f, 0.001f);
    EXPECT_NEAR(data.digital_steering_angle, 0.0f, 0.001f);

    //min values
    SteeringSensorData_s min_val{};
    min_val.analog_steering_degrees = params.min_steering_signal_analog;
    min_val.digital_steering_analog = params.min_steering_signal_digital;
    steering.evaluate_steering(min_val, 1010);
    data = steering.get_steering_system_data();

    float expected_analog_min = (static_cast&lt;int32_t&gt;(params.min_steering_signal_analog) - static_cast&lt;int32_t&gt;(analog_mid)) * params.deg_per_count_analog;
    float expected_digital_min = (static_cast&lt;int32_t&gt;(params.min_steering_signal_digital) - static_cast&lt;int32_t&gt;(digital_mid)) * params.deg_per_count_digital;
    EXPECT_NEAR(data.analog_steering_angle, expected_analog_min, 0.001f);
    EXPECT_NEAR(data.digital_steering_angle, expected_digital_min, 0.001f);

    //max values
    SteeringSensorData_s max_val{};
    max_val.analog_steering_degrees = params.max_steering_signal_analog;
    max_val.digital_steering_analog = params.max_steering_signal_digital;
    steering.evaluate_steering(max_val, 1020);
    data = steering.get_steering_system_data();

    float expected_analog_max = (static_cast&lt;int32_t&gt;(params.max_steering_signal_analog) - static_cast&lt;int32_t&gt;(analog_mid)) * params.deg_per_count_analog;
    float expected_digital_max = (static_cast&lt;int32_t&gt;(params.max_steering_signal_digital) - static_cast&lt;int32_t&gt;(digital_mid)) * params.deg_per_count_digital;
    EXPECT_NEAR(data.analog_steering_angle, expected_analog_max, 0.001f);
    EXPECT_NEAR(data.digital_steering_angle, expected_digital_max, 0.001f);
}

TEST(SteeringSystemTesting, test_sensor_output_logic){
    auto params = gen_default_params();

    uint32_t analog_mid = (params.min_steering_signal_analog + params.max_steering_signal_analog) / 2;
    uint32_t digital_mid = (params.min_steering_signal_digital + params.max_steering_signal_digital) / 2;

{
    //When both valid and agreeing, we default to digital
    SteeringSystem steering(params);
    SteeringSensorData_s both_valid {};
    both_valid.analog_steering_degrees = analog_mid;
    both_valid.digital_steering_analog = digital_mid;
    steering.evaluate_steering(both_valid, 1000);
    steering.evaluate_steering(both_valid, 1100);
    auto data = steering.get_steering_system_data();
    EXPECT_NEAR(data.output_steering_angle, data.digital_steering_angle, 0.001f);
    EXPECT_FALSE(data.both_sensors_fail);
    EXPECT_FALSE(data.sensor_disagreement_implausibility);
}
{
    //When both valid but disagreeing, we default to digital
    SteeringSystem steering(params);
    SteeringSensorData_s both_valid_disagree {};
    both_valid_disagree.analog_steering_degrees = analog_mid;
    both_valid_disagree.digital_steering_analog = digital_mid+3000; //large offset from analog
    steering.evaluate_steering(both_valid_disagree, 1000);
    steering.evaluate_steering(both_valid_disagree, 1100);
    auto data = steering.get_steering_system_data();
    EXPECT_TRUE(data.sensor_disagreement_implausibility);
    EXPECT_FALSE(data.analog_oor_implausibility);
    EXPECT_FALSE(data.digital_oor_implausibility);
    EXPECT_NEAR(data.output_steering_angle, data.digital_steering_angle, 0.001f);
}
{
    //When analog is good but digital is bad, we put analog
    SteeringSystem steering(params);
    SteeringSensorData_s digital_bad {};
    digital_bad.analog_steering_degrees = analog_mid;
    digital_bad.digital_steering_analog = params.max_steering_signal_digital + 1000; //bad digital
    steering.evaluate_steering(digital_bad, 1000);
    steering.evaluate_steering(digital_bad, 1100);
    auto data = steering.get_steering_system_data();
    EXPECT_TRUE(data.digital_oor_implausibility);
    EXPECT_FALSE(data.analog_oor_implausibility);
    EXPECT_NEAR(data.output_steering_angle, data.analog_steering_angle, 0.001f);
}
{
    //When digital is good but analog is bad, we put digital
    SteeringSystem steering(params);
    SteeringSensorData_s analog_bad {};
    analog_bad.analog_steering_degrees = params.max_steering_signal_analog + 1000;
    analog_bad.digital_steering_analog = digital_mid;
    steering.evaluate_steering(analog_bad, 1000);
    steering.evaluate_steering(analog_bad, 1005);
    auto data = steering.get_steering_system_data();
    EXPECT_TRUE(data.analog_oor_implausibility);
    EXPECT_FALSE(data.digital_oor_implausibility);
    EXPECT_NEAR(data.output_steering_angle, data.digital_steering_angle, 0.001f);
}
{
    //When both bad, we flag that error
    SteeringSystem steering(params);
    SteeringSensorData_s both_bad {};
    both_bad.analog_steering_degrees = params.max_steering_signal_analog + 1000;
    both_bad.digital_steering_analog = params.max_steering_signal_digital + 1000;
    steering.evaluate_steering(both_bad, 1000);
    steering.evaluate_steering(both_bad, 1005);
    auto data = steering.get_steering_system_data();
    EXPECT_TRUE(data.analog_oor_implausibility);
    EXPECT_TRUE(data.digital_oor_implausibility);
    EXPECT_TRUE(data.both_sensors_fail);
}
</code></pre>
</details>

</div>
</details>


<details class="accordion-group">
<summary>VCF System Design</summary>
<div class="accordion-group-body">

<details>
<summary>Setup All Interfaces</summary>
<div class="code-description">
  <strong>Approach:</strong> Before any tasks run, the vehicle's hardware peripherals need to be initialized and the steering system needs to be seeded with calibration data. Since the analog sensor is never recalibrated, its parameters are hard-coded constants. The digital sensor's limits, however, were written to EEPROM during the prior calibration run, so we read those back here to restore the steering system to the last known good state without requiring the driver to recalibrate on every power cycle.
</div>
<pre><code class="language-cpp">void setup_all_interfaces() {
    SPI.begin();
    Serial.begin(VCFTaskConstants::SERIAL_BAUDRATE); // NOLINT
    ADCInterfaceInstance::create(
    // Initialize all singletons
    ADCChannels_s {
        VCFInterfaceConstants::STEERING_1_CHANNEL,
        VCFInterfaceConstants::STEERING_2_CHANNEL,
    },
    ADCScales_s {
        VCFInterfaceConstants::STEERING_1_SCALE,
        VCFInterfaceConstants::STEERING_2_SCALE,
    },
    ADCOffsets_s {
        VCFInterfaceConstants::STEERING_1_OFFSET,
        VCFInterfaceConstants::STEERING_2_OFFSET,
    });
    EthernetIPDefsInstance::create();

    SteeringParams_s steering_params = {
        .min_steering_signal_analog = VCFSystemConstants::MIN_STEERING_SIGNAL_ANALOG,
        .max_steering_signal_analog = VCFSystemConstants::MAX_STEERING_SIGNAL_ANALOG,
        .min_steering_signal_digital = EEPROMUtilities::read_eeprom_32bit(VCFSystemConstants::MIN_STEERING_SIGNAL_DIGITAL_ADDR),
        .max_steering_signal_digital = EEPROMUtilities::read_eeprom_32bit(VCFSystemConstants::MAX_STEERING_SIGNAL_DIGITAL_ADDR),
        .analog_min_with_margins = EEPROMUtilities::read_eeprom_32bit(VCFSystemConstants::ANALOG_MIN_WITH_MARGINS_ADDR),
        .analog_max_with_margins = EEPROMUtilities::read_eeprom_32bit(VCFSystemConstants::ANALOG_MAX_WITH_MARGINS_ADDR),
        .digital_min_with_margins = EEPROMUtilities::read_eeprom_32bit(VCFSystemConstants::DIGITAL_MIN_WITH_MARGINS_ADDR),
        .digital_max_with_margins = EEPROMUtilities::read_eeprom_32bit(VCFSystemConstants::DIGITAL_MAX_WITH_MARGINS_ADDR),
        .span_signal_analog = VCFSystemConstants::SPAN_SIGNAL_ANALOG,
        .analog_midpoint = VCFSystemConstants::ANALOG_MIDPOINT,
        .deg_per_count_analog = VCFSystemConstants::DEG_PER_COUNT_ANALOG,
        .deg_per_count_digital = VCFSystemConstants::DEG_PER_COUNT_DIGITAL,
        .analog_tol = VCFSystemConstants::ANALOG_TOL,
        .digital_tol_deg = VCFSystemConstants::DIGITAL_TOL_DEG,
        .max_dtheta_threshold = VCFSystemConstants::MAX_DTHETA_THRESHOLD,
    };
    steering_params.span_signal_digital = steering_params.max_steering_signal_digital - steering_params.min_steering_signal_digital;
    steering_params.digital_midpoint = (steering_params.min_steering_signal_digital + steering_params.max_steering_signal_digital) / 2;
    steering_params.analog_tol_deg = static_cast&lt;float&gt;(steering_params.span_signal_analog) * steering_params.analog_tol * steering_params.deg_per_count_analog;
    steering_params.error_between_sensors_tolerance = steering_params.analog_tol_deg + steering_params.digital_tol_deg;

    SteeringSystemInstance::create(steering_params);

    // Create Digital Steering Sensor singleton
    OrbisBRInstance::create(&Serial2);
}
</code></pre>
</details>


<details>
<summary>Async Main Task</summary>
<div class="code-description">
  <strong>Approach:</strong> This task runs as fast as the scheduler allows and is responsible for keeping sensor data fresh. On each tick it samples the Orbis digital encoder, reads the analog ADC channel, then calls <code>evaluate_steering</code> with both raw values so the steering system can compute the latest plausibility-checked output angle. Pedal evaluation is also triggered here since it shares the same high-frequency update requirement.
</div>
<pre><code class="language-cpp">namespace async_tasks
{
    void handle_async_CAN_receive() //NOLINT caps for CAN
    {
        VCFCANInterfaceObjects& vcf_interface_objects = VCFCANInterfaceImpl::VCFCANInterfaceObjectsInstance::instance();
        CANInterfaces& vcf_can_interfaces = VCFCANInterfaceImpl::CANInterfacesInstance::instance();
        process_ring_buffer(vcf_interface_objects.main_can_rx_buffer, vcf_can_interfaces, sys_time::hal_millis(), vcf_interface_objects.can_recv_switch, CANInterfaceType_e::TELEM);
    }
    void handle_async_recvs()
    {
        // ethernet, etc...
        handle_async_CAN_receive();
    }
    HT_TASK::TaskResponse handle_async_main(const unsigned long& sys_micros, const HT_TASK::TaskInfo& task_info)
    {
        handle_async_recvs();
        OrbisBRInstance::instance().sample();
        const uint32_t analog_raw = static_cast&lt;uint32_t&gt;(ADCInterfaceInstance::instance().steering_degrees_cw().raw);
        const SteeringEncoderConversion_s digital_data = OrbisBRInstance::instance().convert();
        SteeringSystemInstance::instance().evaluate_steering(
            analog_raw,
            digital_data,
            sys_time::hal_millis()
        );

        PedalsSystemInstance::instance().evaluate_pedals(
            PedalsSystemInstance::instance().get_pedals_sensor_data(),
            sys_time::hal_millis()
        );
        return HT_TASK::TaskResponse::YIELD;
    }
};
</code></pre>
</details>


<details>
<summary>Update Steering Calibration Task</summary>
<div class="code-description">
  <strong>Approach:</strong> This scheduled task continuously tracks the observed steering extremes so a calibration can be committed at any moment. When the calibration trigger fires, it calls <code>recalibrate_steering_digital</code> and then writes every updated limit to EEPROM..
</div>
<pre><code class="language-cpp">HT_TASK::TaskResponse update_steering_calibration_task(const unsigned long& sysMicros, const HT_TASK::TaskInfo& taskInfo) {
    const uint32_t analog_raw = SteeringSystemInstance::instance().get_steering_system_data().analog_raw;
    const uint32_t digital_raw = SteeringSystemInstance::instance().get_steering_system_data().digital_raw;

    SteeringSystemInstance::instance().update_observed_steering_limits(analog_raw, digital_raw);
    if (false /* TODO: IMPORTANT ADD SOMETHING FOR TRIGGERING CALIBRATION*/) {
        SteeringSystemInstance::instance().recalibrate_steering_digital(analog_raw, digital_raw, false /* TODO: calibration trigger or something*/);
        EEPROMUtilities::write_eeprom_32bit(VCFSystemConstants::MIN_STEERING_SIGNAL_DIGITAL_ADDR, SteeringSystemInstance::instance().get_steering_params().min_steering_signal_digital);
        EEPROMUtilities::write_eeprom_32bit(VCFSystemConstants::MAX_STEERING_SIGNAL_DIGITAL_ADDR, SteeringSystemInstance::instance().get_steering_params().max_steering_signal_digital);
        EEPROMUtilities::write_eeprom_32bit(VCFSystemConstants::ANALOG_MIN_WITH_MARGINS_ADDR, SteeringSystemInstance::instance().get_steering_params().analog_min_with_margins);
        EEPROMUtilities::write_eeprom_32bit(VCFSystemConstants::ANALOG_MAX_WITH_MARGINS_ADDR, SteeringSystemInstance::instance().get_steering_params().analog_max_with_margins);
        EEPROMUtilities::write_eeprom_32bit(VCFSystemConstants::DIGITAL_MIN_WITH_MARGINS_ADDR, SteeringSystemInstance::instance().get_steering_params().digital_min_with_margins);
        EEPROMUtilities::write_eeprom_32bit(VCFSystemConstants::DIGITAL_MAX_WITH_MARGINS_ADDR, SteeringSystemInstance::instance().get_steering_params().digital_max_with_margins);
    }

    return HT_TASK::TaskResponse::YIELD;
}
</code></pre>
</details>


<details>
<summary>Enqueue Steering Data</summary>
<div class="code-description">
  <strong>Approach:</strong> Once the steering system has validated its output angle, this task packages it into a CAN message and pushes it onto the transmit ring buffer. By separating the enqueue step from the evaluation step, the two can run at different rates: evaluation runs as fast as possible in the async task, while this task fires on a fixed CAN broadcast interval to avoid flooding the bus.
</div>
<pre><code class="language-cpp">HT_TASK::TaskResponse enqueue_steering_data(const unsigned long& sysMicros, const HT_TASK::TaskInfo& taskInfo)
{
    STEERING_DATA_t msg_out;
    SteeringSystemData_s steering_system_data = SteeringSystemInstance::instance().get_steering_system_data();
    /* TODO: Change steering_*_raw to new values we have to add to CAN library. Also add other msg_out variables for implausibilities*/
    msg_out.steering_analog_raw = steering_system_data.analog_steering_angle;
    msg_out.steering_digital_raw = steering_system_data.digital_steering_angle; //NOLINT

    CAN_util::enqueue_msg(&msg_out, &Pack_STEERING_DATA_hytech, VCFCANInterfaceImpl::VCFCANInterfaceObjectsInstance::instance().main_can_tx_buffer);
    return HT_TASK::TaskResponse::YIELD;
}
</code></pre>
</details>


<details>
<summary>Constants</summary>
<div class="code-description">
  <strong>Approach:</strong> On the VCF firmware, we have a global project file designated for setting addresses that will be referenced in VCF_Tasks. To ensure every variable is available when the system runs, we define all corresponding constants in our VCF_constants file. The steering system variables are assigned as EEPROM addresses, so the values themselves are not the actual physical values they represent: they are just memory locations. In the VCFTaskConstants namespace, the variables define the sample rate of each component, determining how many times per second each task runs.
</div>
<pre><code class="language-cpp">constexpr int BTN_PRESET_READ = 28; // recal button (brightness control on schematic)
constexpr float STEERING_1_OFFSET = 0;

namespace VCFSystemConstants {

    // Steering System Constants
    constexpr uint32_t MIN_STEERING_SIGNAL_ANALOG_ADDR = 56; //Raw ADC value from analog sensor at minimum (left) steering angle (calibration) TODO: test and find real values for min&max
    constexpr uint32_t MAX_STEERING_SIGNAL_ANALOG_ADDR = 60; //Raw ADC value from analog sensor at maximum (right) steering angle
    constexpr uint32_t MIN_STEERING_SIGNAL_DIGITAL_ADDR = 32; //Raw ADC value from digital sensor at minimum (left) steering angle
    constexpr uint32_t MAX_STEERING_SIGNAL_DIGITAL_ADDR = 36; //Raw ADC value from digital sensor at maximum (right) steering angle

    constexpr int32_t ANALOG_MIN_WITH_MARGINS_ADDR = 40;
    constexpr int32_t ANALOG_MAX_WITH_MARGINS_ADDR = 44;
    constexpr int32_t DIGITAL_MIN_WITH_MARGINS_ADDR = 48;
    constexpr int32_t DIGITAL_MAX_WITH_MARGINS_ADDR = 52;

    // implausibility values
    constexpr float ANALOG_TOL = 0.005f; //+- 0.5% error (analog sensor tolerance according to datasheet)
    constexpr float DIGITAL_TOL_DEG = 0.2f; // +- 0.2 degrees error

    // rate of angle change
    constexpr float MAX_DTHETA_THRESHOLD = 5.0f; //maximum change in angle since last reading to consider the reading valid

    // degrees per bit
    constexpr float DEG_PER_COUNT_DIGITAL = 360.0f / 16384.0f;
    constexpr float DEG_PER_COUNT_ANALOG = 360.0f / 4096.0f;
}

namespace VCFTaskConstants {
    constexpr unsigned long CAN_SEND_PRIORITY = 10;
    constexpr unsigned long CAN_SEND_PERIOD = 2000;               // 2 000 us = 500 Hz
    constexpr unsigned long DASH_SEND_PERIOD = 100000;            // 100 000 us = 10 Hz
    constexpr unsigned long DASH_SEND_PRIORITY = 7;
    constexpr unsigned long DEBUG_PRIORITY = 100;
    constexpr unsigned long DEBUG_PERIOD = 10000;                 // 10 000 us = 100 Hz
    constexpr unsigned long STEERING_SEND_PERIOD = 4000;          // 4 000 us = 250 Hz
    constexpr unsigned long STEERING_SEND_PRIORITY = 25;
    constexpr unsigned long STEERING_SAMPLE_PERIOD = 1000;        // 1 000 us = 1000 Hz
    constexpr unsigned long STEERING_SAMPLE_PRIORITY = 10;
    constexpr unsigned long ETHERNET_SEND_PERIOD = 100000;        // 100 000 us = 10 Hz
    constexpr unsigned long ETHERNET_SEND_PRIORITY = 20;
    constexpr unsigned long STEERING_RECALIBRATION_PRIORITY = 150; // TODO: Determine real values for these
    constexpr unsigned long STEERING_RECALIBRATION_PERIOD = 100000;
}
</code></pre>
</details>


<details>
<summary>Debug Prints</summary>
<div class="code-description">
  <strong>Approach:</strong> Our debug prints function on VCF_tasks simply allows us to hardware test the values generated from our system after flashing the teensy41 microcontroller. It prints in serial and samples at the rate listed in VCF_constants. You can see the output of these prints in the outcome video of us testing the system. 
</div>
<pre><code class="language-cpp">// HT_TASK::TaskResponse debug_print(const unsigned long& sysMicros, const HT_TASK::TaskInfo& taskInfo)
{    Serial.println("--------------------------------------------------");

    Serial.println("Steering Sensor Data: ");
    Serial.print("analog: ");
    Serial.print(SteeringSystemInstance::instance().get_steering_system_data().analog_raw);
    Serial.print("|");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().analog_steering_angle);
    Serial.print("digital: ");
    Serial.print(SteeringSystemInstance::instance().get_steering_system_data().digital_raw);
    Serial.print("|");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().digital_steering_angle);

    Serial.print("analog_steering_angle: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().analog_steering_angle);
    Serial.print("digital_steering_angle: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().digital_steering_angle);

    Serial.print("output_steering_angle: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().output_steering_angle);

    Serial.print("analog_steering_velocity_deg_s: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().analog_steering_velocity_deg_s);
    Serial.print("digital_steering_velocity_deg_s: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().digital_steering_velocity_deg_s);

    Serial.print("digital_oor_implausibility: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().digital_oor_implausibility);
    Serial.print("analog_oor_implausibility: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().analog_oor_implausibility);
    Serial.print("sensor_disagreement_implausibility: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().sensor_disagreement_implausibility);
    Serial.print("dtheta_exceeded_analog: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().dtheta_exceeded_analog);
    Serial.print("dtheta_exceeded_digital: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().dtheta_exceeded_digital);
    Serial.print("both_sensors_fail: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().both_sensors_fail);
    Serial.print("interface_sensor_error: ");
    Serial.println(SteeringSystemInstance::instance().get_steering_system_data().interface_sensor_error);

    return HT_TASK::TaskResponse::YIELD;
}
</code></pre>
</details>

<details>
<summary>CAN Send</summary>
<div class="code-description">
  <strong>Approach:</strong> Once the steering system has evaluated all data, this task packages the important system values into a CAN message and pushes it onto the transmit ring buffer. By separating the enqueue step from the evaluation step, the two can run at different rates: evaluation runs as fast as possible in the async task, while this task fires on a fixed CAN broadcast interval to avoid flooding the bus. Additionally, to run our recalibration function, we must send data from the front dashboard which holds all controller button values: this is handled in a separate enqueue function. The output steering angle is passed through a conversion function that rewrites it from a 32-bit float to a signed 8-bit integer, reducing message size and improving throughput. Some variables are omitted from the output message to ensure the full message fits within 32 bits. Lastly, the send function flushes all messages queued by the enqueue functions out onto the CAN bus.
</div>
<pre><code class="language-cpp">HT_TASK::TaskResponse enqueue_steering_data(const unsigned long& sysMicros, const HT_TASK::TaskInfo& taskInfo)
{
    STEERING_DATA_t msg_out;
    SteeringSystemData_s steering_system_data = SteeringSystemInstance::instance().get_steering_system_data();
    msg_out.steering_analog_oor = steering_system_data.analog_oor_implausibility;
    msg_out.steering_both_sensors_fail = steering_system_data.both_sensors_fail;
    msg_out.steering_digital_oor = steering_system_data.digital_oor_implausibility;
    msg_out.steering_dtheta_exceeded_analog = steering_system_data.dtheta_exceeded_analog;
    msg_out.steering_dtheta_exceeded_digital = steering_system_data.dtheta_exceeded_digital;
    msg_out.steering_interface_sensor_error = steering_system_data.interface_sensor_error;
    msg_out.steering_output_steering_angle_ro = HYTECH_steering_output_steering_angle_ro_toS(steering_system_data.output_steering_angle);
    msg_out.steering_sensor_disagreement = steering_system_data.sensor_disagreement_implausibility;
    msg_out.steering_analog_raw = steering_system_data.analog_steering_angle;
    msg_out.steering_digital_raw = steering_system_data.digital_steering_angle;

    CAN_util::enqueue_msg(&msg_out, &Pack_STEERING_DATA_hytech, VCFCANInterfaceImpl::VCFCANInterfaceObjectsInstance::instance().main_can_tx_buffer);
    return HT_TASK::TaskResponse::YIELD;
}

HT_TASK::TaskResponse send_dash_data(const unsigned long& sysMicros, const HT_TASK::TaskInfo& taskInfo)
{
    CANInterfaces can_interfaces = VCFCANInterfaceImpl::CANInterfacesInstance::instance();
    DashInputState_s dash_outputs = can_interfaces.dash_interface.get_dashboard_outputs();

    DASH_INPUT_t msg_out;
    //for this, add a message for the new button when its here, for now, steering system linked to dim_button.
    msg_out.dim_button = dash_outputs.btn_dim_read_is_pressed;
    msg_out.preset_button = dash_outputs.preset_btn_is_pressed;
    msg_out.mode_button = 0; // dont exist but i dont wanna bother changing can msgs
    msg_out.motor_controller_cycle_button = dash_outputs.mc_reset_btn_is_pressed;
    msg_out.start_button = dash_outputs.start_btn_is_pressed;
    msg_out.data_button_is_pressed = dash_outputs.data_btn_is_pressed;
    msg_out.left_shifter_button = 0;
    msg_out.right_shifter_button = dash_outputs.BUTTON_2;
    msg_out.led_dimmer_button = dash_outputs.brightness_ctrl_btn_is_pressed;
    msg_out.dash_dial_mode = static_cast&lt;int&gt;(DashboardInterfaceInstance::instance().get_dashboard_outputs().dial_state);

//    Serial.printf("%d %d %d %d %d %d %d %d\n", msg_out.preset_button, msg_out.motor_controller_cycle_button, msg_out.mode_button, msg_out.start_button, msg_out.data_button_is_pressed, msg_out.left_shifter_button, msg_out.right_shifter_button, msg_out.led_dimmer_button);

    CAN_util::enqueue_msg(&msg_out, &Pack_DASH_INPUT_hytech, VCFCANInterfaceImpl::VCFCANInterfaceObjectsInstance::instance().main_can_tx_buffer);
    return HT_TASK::TaskResponse::YIELD;
}

namespace VCFCANInterfaceImpl {

    void send_all_CAN_msgs(CANTXBufferType &buffer, FlexCAN_T4_Base *can_interface)
    {
        CAN_message_t msg;
        while (buffer.available()) {
            CAN_message_t msg;
            uint8_t buf[sizeof(CAN_message_t)];
            buffer.pop_front(buf, sizeof(CAN_message_t));
            memmove(&msg, buf, sizeof(msg)); // NOLINT (memory operations are fine)
            can_interface->write(msg);
        }
    }

}
</code></pre>
</details>



<details>
<summary>CAN Receive</summary>
<div class="code-description">
  <strong>Approach:</strong> The VCR CAN receive function unpacks the DASHBOARD_BUZZER_CONTROL message from VCF. It handles buzzer activation and sets the calibration state flags that the VCR state machine reads to determine whether a steering recalibration has been triggered.
</div>
<pre><code class="language-cpp">void VCRInterface::receive_dash_control_data(const CAN_message_t &can_msg)
{
    DASHBOARD_BUZZER_CONTROL_t unpacked_msg;
    Unpack_DASHBOARD_BUZZER_CONTROL_hytech(&unpacked_msg, can_msg.buf, can_msg.len);    //NOLINT

    if (unpacked_msg.dash_buzzer_flag) {
        BuzzerController::getInstance().activate(millis());
    }

    _is_in_pedals_calibration_state = unpacked_msg.in_pedal_calibration_state;
    _is_in_steering_calibration_state = unpacked_msg.in_steering_calibration_state;

    if (unpacked_msg.torque_limit_enum_value &lt; ((int) TorqueLimit_e::TCMUX_NUM_TORQUE_LIMITS)) // check for validity
    {
        _torque_limit = (TorqueLimit_e) unpacked_msg.torque_limit_enum_value;
    }
}
</code></pre>
</details>

</div>
</details>


<details class="accordion-group">
<summary>VCR System Design</summary>
<div class="accordion-group-body">

<details>
<summary>CAN Receive</summary>
<div class="code-description">
  <strong>Approach:</strong> The VCF CAN receive function follows the standard layout: initialize the message from CAN, then call an unpack function to decode it. It unpacks the DASH_INPUT message from the dashboard and assigns each button and dial field to a struct called curr_data, which tracks the live status of each input.
</div>
<pre><code class="language-cpp">void VCFInterface::receive_dashboard_message(const CAN_message_t &msg, unsigned long curr_millis)
{
    DASH_INPUT_t dash_msg;
    Unpack_DASH_INPUT_hytech(&dash_msg, &msg.buf[0], msg.len);
    _curr_data.dash_input_state.btn_dim_read_is_pressed = dash_msg.dim_button;
    _curr_data.dash_input_state.preset_btn_is_pressed = dash_msg.preset_button; // pedal recalibration button
    _curr_data.dash_input_state.mc_reset_btn_is_pressed = dash_msg.motor_controller_cycle_button;
    _curr_data.dash_input_state.start_btn_is_pressed = dash_msg.start_button;
    _curr_data.dash_input_state.data_btn_is_pressed = dash_msg.data_button_is_pressed;
    // _curr_data.dash_input_state.left_paddle_is_pressed = dash_msg.left_shifter_button;
    // _curr_data.dash_input_state.right_paddle_is_pressed = dash_msg.right_shifter_button;
    // _curr_data.dash_input_state.mode_btn_is_pressed = dash_msg.mode_button; // change torque limit
    _curr_data.dash_input_state.dial_state = static_cast&lt;ControllerMode_e&gt;(dash_msg.dash_dial_mode);
}
</code></pre>
</details>


<details>
<summary>State Machine</summary>
<div class="code-description">
  <strong>Approach:</strong> To recalibrate steering, we create a state machine on VCR that tracks the current vehicle state and determines when the car is ready for recalibration. There are two relevant states. <strong>WANTING_RECALIBRATE_STEERING</strong> is entered when the calibrate steering button is pressed (determined in CAN receive). If the button is released, the state falls back to <strong>TRACTIVE_SYSTEM_NOT_ACTIVE</strong>, the default state when high voltage is off. If the button stays pressed for over 3 seconds, the state transitions to <strong>RECALIBRATING_STEERING</strong>. In that state, as long as the button remains held, it continuously calls the send steering recalibration message function. The helper functions handle the entry and exit logic for each state: recording a timestamp when a state is entered, and resetting it on exit.
</div>
<pre><code class="language-cpp">VehicleState_e VehicleStateMachine::tick_state_machine(unsigned long current_millis)
{
    switch (_current_state)
    {
        case VehicleState_e::WANTING_RECALIBRATE_STEERING:
        {
            _command_drivetrain(false, false);

            if (!_is_calibrate_steering_button_pressed())
            {
                _set_state(VehicleState_e::TRACTIVE_SYSTEM_NOT_ACTIVE, current_millis);
            }

            if (_is_calibrate_steering_button_pressed() && (current_millis - _last_entered_steering_waiting_state_ms > 3000))
            {
                _set_state(VehicleState_e::RECALIBRATING_STEERING, current_millis);
            }

            break;
        }
        case VehicleState_e::RECALIBRATING_STEERING:
        {
            _command_drivetrain(false, false);

            if (!_is_calibrate_steering_button_pressed())
            {
                _set_state(VehicleState_e::TRACTIVE_SYSTEM_NOT_ACTIVE, current_millis);
            }

            if (_is_calibrate_steering_button_pressed())
            {
                _send_recalibrate_steering_message();
            }

            break;
        }
    }
    return _current_state;
}

void VehicleStateMachine::_set_state(VehicleState_e new_state, unsigned long curr_millis)
{
    _handle_exit_logic(_current_state, curr_millis);
    _current_state = new_state;
    _handle_entry_logic(_current_state, curr_millis);
}

void VehicleStateMachine::_handle_exit_logic(VehicleState_e prev_state, unsigned long curr_millis)
{
    switch (prev_state)
    {
        case VehicleState_e::WANTING_RECALIBRATE_STEERING:
            _last_entered_steering_waiting_state_ms = 0;
            break;
        case VehicleState_e::RECALIBRATING_STEERING:
            _last_entered_steering_waiting_state_ms = 0;
            break;
        default:
            break;
    }
}

void VehicleStateMachine::_handle_entry_logic(VehicleState_e new_state, unsigned long curr_millis)
{
    switch (new_state)
    {
        case VehicleState_e::WANTING_RECALIBRATE_STEERING:
            _last_entered_steering_waiting_state_ms = curr_millis;
            break;
        case VehicleState_e::RECALIBRATING_STEERING:
            break;
        default:
            break;
    }
}
</code></pre>
</details>


<details>
<summary>CAN Send</summary>
<div class="code-description">
  <strong>Approach:</strong> In terms of firmware, CAN send from VCR has the same logistics as VCF, it just matters what values we are sending. Since for this system we want VCR to validate our steering recalibration based on the vehicle state machine, outputting the steering calibration state in one message, and the state of the vehicle in another. Once this is unpacked in in the CAN Recieve section, you can see how this initializes the recalibration function in VCF tasks. Full circle moment!
</div>
<pre><code class="language-cpp">void VCFInterface::send_buzzer_start_message()
{
    DASHBOARD_BUZZER_CONTROL_t ctrl = {};
    ctrl.dash_buzzer_flag = true;
    ctrl.in_pedal_calibration_state = false;
    ctrl.in_steering_calibration_state = false;
    ctrl.torque_limit_enum_value = 0xFF; // MAX_VALUE indicates "ignore this value" //NOLINT
    CAN_util::enqueue_msg(&ctrl, &Pack_DASHBOARD_BUZZER_CONTROL_hytech, VCRCANInterfaceImpl::telem_can_tx_buffer);
    Serial.println("BUZZER START MESSAGE SENT");
}
void VCFInterface::send_recalibrate_steering_message()
{
    DASHBOARD_BUZZER_CONTROL_t ctrl = {};
    ctrl.dash_buzzer_flag = false;
    ctrl.in_pedal_calibration_state = false;
    ctrl.in_steering_calibration_state = true;
    ctrl.torque_limit_enum_value = 0xFF; // MAX_VALUE indicates "ignore this value" //NOLINT
    CAN_util::enqueue_msg(&ctrl, &Pack_DASHBOARD_BUZZER_CONTROL_hytech, VCRCANInterfaceImpl::telem_can_tx_buffer);
}
void VCFInterface::enqueue_vehicle_state_message(VehicleState_e vehicle_state, DrivetrainState_e drivetrain_state, bool db_is_in_ctrl)
{
    CAR_STATES_t state = {};
    state.vehicle_state = static_cast&lt;uint8_t&gt;(vehicle_state);
    state.drivetrain_state = static_cast&lt;uint8_t&gt;(drivetrain_state);
    state.drivebrain_in_control = db_is_in_ctrl;
    CAN_util::enqueue_msg(&state, &Pack_CAR_STATES_hytech, VCRCANInterfaceImpl::telem_can_tx_buffer);
}
</code></pre>
</details>

</div>
</details>


<details class="accordion-group">
<summary>Car Messaging System</summary>
<div class="accordion-group-body">

<details>
<summary>PCAN Library</summary>
<div class="code-description">
  <strong>Approach:</strong> For CAN messaging, we implement all message definitions in the HT-Proto repository using the PCAN Symbol Editor. This defines the structure of every message sent on the bus and feeds into Foxglove, allowing us to virtually read live values from the car while it's running: including steering sensor data, calibration states, and vehicle states. The three messages relevant to the steering system are shown below, each with their symbol properties, signal definitions, and bit layout.
</div>

<style>
.pcan-group { margin: 20px 0 28px; }
.pcan-group-title {
  font-size: 14px;
  font-weight: 700;
  color: #58a6ff;
  letter-spacing: 0.03em;
  padding: 0 20px 10px;
  border-bottom: 1px solid #21262d;
  margin-bottom: 14px;
}
.pcan-group-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #8b949e;
  margin-left: 8px;
}
.pcan-row { display: flex; gap: 14px; padding: 0 20px 14px; flex-wrap: wrap; }
.pcan-row figure { margin: 0; flex: 1; min-width: 260px; text-align: center; }
.pcan-row figure.full { flex: 0 0 100%; }
.pcan-row img { width: 100%; border-radius: 6px; border: 1px solid #30363d; }
.pcan-row figcaption { font-size: 12px; color: #8b949e; margin-top: 6px; }
</style>

<div class="pcan-group">
  <div class="pcan-group-title">STEERING_DATA <span class="pcan-group-subtitle">CAN ID: 0x41F · 7 bytes · VCF → broadcast</span></div>
  <div class="pcan-row">
    <figure>
      <img src="/images/pcan-steering-data-symbol.png" alt="STEERING_DATA symbol properties">
      <figcaption>Symbol properties: CAN ID, data length, direction</figcaption>
    </figure>
    <figure>
      <img src="/images/pcan-steering-data-signals.png" alt="STEERING_DATA signal definitions">
      <figcaption>Signal definitions: bit position, length, and type for each field</figcaption>
    </figure>
  </div>
  <div class="pcan-row">
    <figure class="full">
      <img src="/images/pcan-steering-data-layout.png" alt="STEERING_DATA bit layout">
      <figcaption>Bit layout: 10 signals packed across 7 bytes</figcaption>
    </figure>
  </div>
</div>

<div class="pcan-group">
  <div class="pcan-group-title">DASHBOARD_BUZZER_CONTROL <span class="pcan-group-subtitle">CAN ID: 0x7F1 · 2 bytes · VCF → VCR</span></div>
  <div class="pcan-row">
    <figure>
      <img src="/images/pcan-dashboard-buzzer-symbol.png" alt="DASHBOARD_BUZZER_CONTROL symbol properties">
      <figcaption>Symbol properties: CAN ID, data length, direction</figcaption>
    </figure>
    <figure>
      <img src="/images/pcan-dashboard-buzzer-signals.png" alt="DASHBOARD_BUZZER_CONTROL signal definitions">
      <figcaption>Signal definitions: calibration state flags and buzzer control</figcaption>
    </figure>
  </div>
  <div class="pcan-row">
    <figure class="full">
      <img src="/images/pcan-dashboard-buzzer-layout.png" alt="DASHBOARD_BUZZER_CONTROL bit layout">
      <figcaption>Bit layout: 4 signals packed into 2 bytes</figcaption>
    </figure>
  </div>
</div>

<div class="pcan-group">
  <div class="pcan-group-title">DASH_INPUT <span class="pcan-group-subtitle">CAN ID: 0x300 · 3 bytes · Dashboard → VCF</span></div>
  <div class="pcan-row">
    <figure>
      <img src="/images/pcan-dash-input-symbol.png" alt="DASH_INPUT symbol properties">
      <figcaption>Symbol properties: CAN ID, data length, direction</figcaption>
    </figure>
    <figure>
      <img src="/images/pcan-dash-input-signals.png" alt="DASH_INPUT signal definitions">
      <figcaption>Signal definitions: all dashboard button states and dial mode</figcaption>
    </figure>
  </div>
  <div class="pcan-row">
    <figure class="full">
      <img src="/images/pcan-dash-input-layout.png" alt="DASH_INPUT bit layout">
      <figcaption>Bit layout: 10 button and dial signals packed into 3 bytes</figcaption>
    </figure>
  </div>
</div>

<div class="pcan-group">
  <div class="pcan-group-title">vehicle_stateE <span class="pcan-group-subtitle">Enum: vehicle state machine values</span></div>
  <div class="pcan-row">
    <figure class="full">
      <img src="/images/pcan-vehicle-state-enum.png" alt="vehicle_stateE enum definition">
      <figcaption>Enum definition: values 0–7 mapping to vehicle states, including the two steering recalibration states used by the VCR state machine</figcaption>
    </figure>
  </div>
</div>

</details>

<details>
<summary>Ethernet Messaging</summary>
<div class="code-description">
  <strong>Approach:</strong> Unlike CAN, which sends each message type separately on its own ID, Ethernet bundles all system data into one large Protobuf message and transmits it in a single packet. On VCF, <code>make_vcf_data_msg</code> pulls every field from the steering system data struct and packs them into a <code>hytech_msgs_VCFData_s</code> message, which is then sent over UDP to drivebrain. VCF also receives a VCR data message over Ethernet to get shared state like buzzer status. The message schema itself lives in the HT-Proto repository and is defined in <code>.proto</code> files, which are compiled into C structs used on both ends.
</div>
<pre><code class="language-cpp">// VCF Ethernet Interface — packing steering data into outbound Ethernet message
hytech_msgs_VCFData_s VCFEthernetInterface::make_vcf_data_msg(ADCInterface &ADCInterfaceInstance, DashboardInterface &dashInstance, PedalsSystem &pedalsInstance, SteeringSystem &steeringInstance)
{
    out.steering_system_data.analog_raw = steeringInstance.get_steering_system_data().analog_raw;
    out.steering_system_data.digital_raw = steeringInstance.get_steering_system_data().digital_raw;
    out.steering_system_data.analog_steering_angle = steeringInstance.get_steering_system_data().analog_steering_angle;
    out.steering_system_data.digital_steering_angle = steeringInstance.get_steering_system_data().digital_steering_angle;
    out.steering_system_data.output_steering_angle = steeringInstance.get_steering_system_data().output_steering_angle;
    out.steering_system_data.analog_steering_velocity_deg_s = steeringInstance.get_steering_system_data().analog_steering_velocity_deg_s;
    out.steering_system_data.digital_steering_velocity_deg_s = steeringInstance.get_steering_system_data().digital_steering_velocity_deg_s;
    out.steering_system_data.digital_oor_implausibility = steeringInstance.get_steering_system_data().digital_oor_implausibility;
    out.steering_system_data.analog_oor_implausibility = steeringInstance.get_steering_system_data().analog_oor_implausibility;
    out.steering_system_data.sensor_disagreement_implausibility = steeringInstance.get_steering_system_data().sensor_disagreement_implausibility;
    out.steering_system_data.dtheta_exceeded_analog = steeringInstance.get_steering_system_data().dtheta_exceeded_analog;
    out.steering_system_data.dtheta_exceeded_digital = steeringInstance.get_steering_system_data().dtheta_exceeded_digital;
    out.steering_system_data.both_sensors_fail = steeringInstance.get_steering_system_data().both_sensors_fail;
    out.steering_system_data.interface_sensor_error = steeringInstance.get_steering_system_data().interface_sensor_error;
    out.steering_system_data.analog_clipped = steeringInstance.get_steering_system_data().analog_clipped;
    out.steering_system_data.digital_clipped = steeringInstance.get_steering_system_data().digital_clipped;
}

// VCF receiving VCR data over Ethernet
void VCFEthernetInterface::receive_pb_msg_vcr(const hytech_msgs_VCRData_s &msg_in, VCFData_s &shared_state, unsigned long curr_millis) {
    shared_state.system_data.buzzer_is_active = msg_in.buzzer_is_active;
}</code></pre>
<pre><code class="language-protobuf">// HT-Proto repository — Protobuf schema defining the SteeringSystemData message
syntax = "proto3";
package hytech_msgs;

message SteeringSystemData_s
{
    uint32 analog_raw = 1;
    uint32 digital_raw = 2;

    float analog_steering_angle = 3;
    float digital_steering_angle = 4;
    float output_steering_angle = 5;

    float analog_steering_velocity_deg_s = 6;
    float digital_steering_velocity_deg_s = 7;

    bool digital_oor_implausibility = 8;
    bool analog_oor_implausibility = 9;
    bool sensor_disagreement_implausibility = 10;
    bool dtheta_exceeded_analog = 11;
    bool dtheta_exceeded_digital = 12;
    bool both_sensors_fail = 13;
    bool interface_sensor_error = 14;
    bool analog_clipped = 15;
    bool digital_clipped = 16;
}</code></pre>
</details>

</div>
</details>


</div>

<script>document.addEventListener('DOMContentLoaded', function() { hljs.highlightAll(); });</script>


## Outcome

Steering system correctly outputted converted angle values, plausibility checks, and ran recalibration through checking vehicle state machine. With the outputted values sent to drivebrain through CAN & Ethernet messaging, we were able to implement "mode 4", which intakes steering values, tire load cells, pedals data, and outputs a calculated torque to each wheel. Because of the steering system enabling "mode 4", HyTech's vehicle HTX was able to decrease 0.2 seconds on average in the skid pad event at Formula South on April 11th, 2026.

<figure style="margin:16px 0; text-align:center;">
  <video muted controls style="width:100%; border-radius:8px; border:1px solid #30363d;">
    <source src="/assets/steering-car-driving.mov" type="video/mp4">
  </video>
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">HTX driving with the steering sensor system active during skid pad at Formula South 2026</figcaption>
</figure>

<figure style="margin:16px 0; text-align:center;">
  <video muted controls style="width:100%; border-radius:8px; border:1px solid #30363d;">
    <source src="/assets/steering-serial-debug.mov" type="video/mp4">
  </video>
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Serial debug output confirming the steering system functioning correctly post recalibration</figcaption>
</figure>
