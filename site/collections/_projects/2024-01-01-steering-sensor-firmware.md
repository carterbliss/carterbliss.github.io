---
date: 2026-03-24
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
<summary>VCF – Setup All Interfaces</summary>
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
<summary>VCF – Async Main Task</summary>
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
<summary>VCF – Update Steering Calibration Task</summary>
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
<summary>VCF – Enqueue Steering Data</summary>
<div class="code-description">
  <strong>Approach:</strong> Once the steering system its validated output angle, this task packages it into a CAN message and pushes it onto the transmit ring buffer. By separating the enqueue step from the evaluation step, the two can run at different rates — evaluation runs as fast as possible in the async task, while this task fires on a fixed CAN broadcast interval to avoid flooding the bus.
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
<summary>Unit Tests</summary>
<div class="code-description">
  <strong>Approach:</strong> Unit tests are our first line of verification before any hardware is involved. We used Google Test on PlatformIO with a hand-coded parameter struct that stands in for real calibration data. Each test targets a specific function and asserts an expected outcome — <code>true</code>, <code>false</code>, <code>EXPECT_EQ</code>, or <code>EXPECT_NEAR</code> within a thousandth of a degree to catch floating-point drift. The tests not shown here follow the same pattern: feed a modified input into the steering system and confirm the output changes as expected.
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

<script>document.addEventListener('DOMContentLoaded', function() { hljs.highlightAll(); });</script>


## Outcome

[Description coming soon]

[Video coming soon]
