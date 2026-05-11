---
date: 2026-03-26
title: Supercapacitor IC
subtitle: Circuit Design – Power Electronics
image: '/images/hasp-balloon.jpg'
---

## Overview

As a systems design subteam engineer of the Chip Scale Power & Energy Vertically Integrated Projects (VIP) team at Georgia Tech, I work on the integrated circuit for a supercapacitor characterization experiment system. The supercapacitors being tested are fabricated in-house and target space-based energy storage applications. Our fabricated supercapacitors and experimental cards will take flight on a NASA balloon in Fall 2026 inside a payload through the High Altitude Student Platform. Our circuit targets Galvanostatic Charge Discharge cycling in order to determine supercapacitor capacitance stability and resistance over time. Because our experiment will take place in the stratosphere, we must meticulously select components rated down to -60°C. 

## Technical Details

The core requirement is constant-current charge and discharge at 10µA. For charging, this means selecting a dedicated constant-current chip and ensuring safeguarding mechanisms for overcharging. For discharging, it means designing a custom subunit using automotive-to-milspec grade components that can hold the current steady as the supercapacitor voltage drops.

As experiment card circuit lead, I used my prior PCB experience from HyTech Racing to guide teammates through circuit design fundamentals while building out the discharge section in KiCad.

## Design Process

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
  background: #161b22;
}
.code-accordion .code-description strong {
  color: #c9d1d9;
}
</style>

<div class="code-accordion">

<details>
<summary>Constant Current Charge</summary>
<div class="code-description">
  <strong>Approach:</strong> The charging path is initially enabled by a pin coming from our microcontroller: <strong> RX_MISO_D0 </strong>. Which is a pulse wave monitor coded to alternate between high and low, (0 to 3.3V). We code the output to operate at a frequency that allows enough time for the supercapacitor to fully charge, which plugs into the PMOS2 in series with the path. Once the PWM outputs a low, the path is enabled. For charging, rather than building a custom feedback circuit, we use the <strong>LM134H</strong>: a dedicated constant current source chip. The chip is driven by <strong>5VA</strong> and delivers a fixed current directly into the supercapacitor. The output current is set entirely by a single external resistor: I = 67.7mV / R_SET. With <strong>R1 at 6.67kΩ</strong>, this gives <strong>I = 67.7mV / 6670Ω ≈ 10µA.</strong>
  <br><br>
  What makes this chip well-suited for the task is that it internally adjusts its output to compensate for whatever resistance the supercapacitor presents as its voltage rises during charging. It samples the voltage and uses internal feedback to maintain a constant current regardless of deviations in path resistance.
  <br><br>
  However, this behavior introduces a risk: once the supercapacitor is fully charged, the LM134H has no awareness of that state and will continue trying to source current, which can drive the supercapacitor voltage above its rated limit. To prevent this, the <strong>LM193</strong> comparator monitors the supercapacitor voltage against a 3V reference(max the supercapacitor can take). If the capacitor voltage exceeds 3V, the comparator output floats, which is pulled up to 3.3V by a pull-up resistor, opening the gate of the PMOS1 in series with the charge path and cutting off current. Below 3V, the output is pulled low, keeping the PMOS conducting.
  <br><br>
  Since the LM134H relies on an external component model that KiCad's SPICE engine cannot simulate directly, running a transient analysis on the schematic produces no result. To validate the behavior, the LM134H is swapped out for an <strong>IDC</strong> set to output 10µA. This is purely a simulation stand-in and lets us confirm that a 10µA source will behave correctly with the rest of the circuit before committing to the real chip.
</div>
<img src="/images/supercap-cc-schematic.png" alt="LM134H constant current charging circuit" style="width:100%; display:block; margin:16px 0; border-radius:6px; border:1px solid #30363d;">
<p style="font-size:14px; line-height:1.6; color:#8b949e; margin:0 0 8px;">The simulation confirms <strong style="color:#c9d1d9;">I(R1) holds flat at exactly 10µA</strong> across the entire run, showing that the IDC delivers perfectly constant current into the capacitor regardless of how the capacitor voltage changes over time.</p>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-idc-sim.png" alt="IDC constant current simulation" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">TRAN simulation with IDC: I(R1) = 10µA flat, validating constant current through the capacitor</figcaption>
</figure>
</details>

<details>
<summary>Constant Current Discharge</summary>
<div class="code-description">
  <strong>Approach:</strong> The discharge circuit is built around an op-amp feedback system that forces a constant 10µA from the supercapacitor regardless of how its voltage changes over time. The key insight is that a constant current discharge causes voltage to drop linearly, which is exactly the behavior needed to calculate capacitance from C = I × Δt / ΔV.
  <br><br>
  <strong>NMOS1</strong> connects directly to the microcontroller through a connector pin TX_MOSL_D1, which is coded as a pulse wave monitor that enables the discharge path when high. The current is set by <strong>R7 (9kΩ)</strong>. With a 0.1V reference, the target voltage across R7 is 0.1V, giving I = 0.1V / 9kΩ ≈ 11µA ≈ 10µA (with NMOS propagation delay). <strong>U3</strong> is an op-amp that compares this 0.1V reference against the actual voltage developing across R7 and drives the gate of <strong>NMOS2</strong> to correct any deviation: if current rises, NMOS2 is turned down; if it falls, NMOS2 is turned up. This feedback loop is what maintains constant current and ultimately produces a linear voltage decrease.
</div>
<img src="/images/supercap-discharge-schematic.png" alt="Discharge circuit schematic" style="width:100%; display:block; margin:16px 0; border-radius:6px; border:1px solid #30363d;">
<p style="font-size:14px; line-height:1.6; color:#8b949e; margin:0 0 8px;">The transient simulation confirms the circuit behaves as designed. Note: the simulation was run on an earlier version of the schematic — <strong style="color:#c9d1d9;">R1 in the simulation corresponds to R7 in the current schematic</strong>. <strong style="color:#c9d1d9;">I(R1) holds at 9.99µA</strong> throughout each discharge phase, validating the feedback loop. The voltage (blue trace) decreases linearly during discharge: the expected signature of a constant-current load, and exactly what's needed to measure stability and resistance. When the voltage jumps sharply back up, that represents the capacitor being fully charged again before the next discharge cycle begins. The green trace shows the control switching signal driving this charge/discharge cycling.</p>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-sim.png" alt="Transient simulation showing constant current discharge" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">TRAN simulation — I(R1) = 9.99µA (R1 = R7 in current schematic), linear voltage discharge</figcaption>
</figure>
</details>

<details>
<summary>Monitor Current & Monitor Voltage</summary>
<div class="code-description">
  <strong>Approach:</strong> To determine how the supercapacitor retains capacitance and resistance in stratospheric conditions, we must record the voltage and current through the path during each cycle and report these values back to our microcontroller (STM32). These analog signals are stored to flash to log all experimental data.
  <br><br>
  <strong>Current monitoring:</strong> For current monitoring, we use the <strong>INA190</strong> bidirectional current sense amplifier. It introduces minimal voltage drop into the path and outputs an analog voltage proportional to current, which the STM32 converts to a digital reading.
  <br><br>
  <strong>R3 (6kΩ)</strong> is the shunt resistor, sized by the expected voltage drop: V = I × R, so 60mV = 10µA × 6kΩ. The INA190 reads the differential voltage across IN+ and IN-, multiplies it by a gain, and adds it to a reference voltage. The 1.65V reference is generated by a TSZ901ILT3 op-amp buffer configured with equal resistors (R5/R6 = 10kΩ each), centering the output at half of 3.3V. This midpoint reference is necessary because the INA190 is bidirectional: positive current produces a reading above 1.65V and negative current produces a reading below. Without it, negative current would collapse to 0V and produce unusable data.
  <br><br>
  The output equation for <strong>IN1</strong> is: Vout = Vref + (Gain × Vsense)
     = 1.65 + (25 × 60mV)
     = 1.65 + 1.5V = 3.15V  (at +10µA)
     = 1.65 - 1.5V = 0.15V  (at -10µA).
  We selected the INA190A1 variant for a gain of 25.
  <br><br>
  A DNP (Do Not Populate) low-pass filter is included on the output to suppress noise if needed after testing. Because the output reaches 3.15V and the STM32 ADC accepts up to 3V, we step it down with a voltage divider: V_IN1 = Vout_INA × (10k / 11k) = Vout_INA × 0.909.
  <br><br>
  <strong>Voltage monitoring:</strong> For voltage monitoring, we use the <strong>OPA333</strong> precision op-amp in unity-gain configuration. It buffers the supercapacitor voltage and presents it as a stable, low-impedance signal to the STM32 on <strong>IN0</strong>. As with current monitoring, a DNP low-pass filter is included if fluctuations appear during testing, and a voltage divider steps the signal down to stay within the 3V ADC limit.
  <br><br>
  Since neither chip is in the KiCad library, both symbols and footprints were created manually from their datasheets. Simulation is not possible without a KiCad SPICE model, so measured values will be validated during post-fabrication thermal testing.
</div>
<figure style="margin:16px 0; text-align:center;">
  <img src="/images/supercap-monitor-current.png" alt="INA190 current monitoring circuit" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Current monitoring circuit</figcaption>
</figure>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-monitor-voltage.png" alt="OPA333 voltage monitoring circuit" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Voltage monitoring circuit</figcaption>
</figure>
</details>

<details>
<summary>MCU Connector</summary>
<div class="code-description">
  <strong>Approach:</strong> In order to read the current and voltage values for each cycle of our GCD testing, we must connect our analog outputs, and PWM inputs through a connector piece called the <strong> SM12B-GHS-TB </strong>. This 12 pin connector component is powered by 3V and a 5VA power source, however since there is not a power output pin, we implement PWR_Flag for the ERC. In case of the scenario something on our experiment card bugs/shorts, we have a fuse on each of the power inputs to ensure we do not damage our microcontroller and stop all wiring between boards. IN0 and IN1 are our respective monitoring voltage and current pins, both as inputs on the connector board. RX_MISO_D0 and TX_MOSI_D1 are our PWM pins we code from the microcontroller. Instead of using the same PWM pin for both charge and discharge paths, by enabling a slight delay between PWM's we prevent the risk of split-second shorting of the circuit, and clock-edge shorting. In the case of high-impedance, the RX is pulled by resistors to output a high, therefore ensuring only our charge circuit is inactive and TX is pulled down to ensure our discharge circuit is inactive. 

  <br><br>
  Additionally on our schematic we must also include decoupling capacitors at each of the power inputs to all chips. These serve as a filter to ease oscillation around voltage values, and ultamitely limit the noise of voltage inputs to our components. 
</div>
</details>

<details>
<summary>Routing</summary>
<div class="code-description">
  <strong>Approach:</strong> [Coming soon]
</div>
</details>

<details>
<summary>Future Work</summary>
<div class="code-description">
  <strong>Approach:</strong> My current role has been integrating all subcircuits into a single schematic and walking other team members through the design decisions. Parts and footprints have been assigned to every symbol, and PCB routing has begun. We are waiting to receive components before soldering and assembling the full IC interface and connecting it to the microcontroller. This project will continue to be updated as progress is made throughout the semester.
</div>
<figure style="margin:16px 0; text-align:center;">
  <img src="/images/supercap-full-schematic.png" alt="Full IC schematic" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Current IC Schematic</figcaption>
</figure>
</details>

</div>

## Outcome

[Coming soon — results will be added following the NASA balloon flight in summer 2026.]
