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
  <strong>Approach:</strong> To read current and voltage values for each GCD cycle, we connect our analog outputs and PWM inputs through the <strong>SM12B-GHS-TB</strong>, a 12-pin connector. It is powered by 3.3V and 5VA. Since neither rail has a dedicated power output pin on the connector, we implement PWR_FLAG symbols to satisfy the ERC. In case something on the experiment card faults or shorts, a fuse on each power input protects the microcontroller and the wiring between boards. IN0 and IN1 are the voltage and current monitoring pins, received as inputs from the experiment card. RX_MISO_D0 and TX_MOSI_D1 are the PWM control pins driven from the microcontroller. Rather than sharing a single PWM pin for charge and discharge, using separate pins with a slight delay between them eliminates the risk of both paths being active simultaneously, preventing cross-conduction and clock-edge shorting. In the high-impedance state, RX_MISO_D0 is pulled high by a resistor, keeping the charge circuit inactive, and TX_MOSI_D1 is pulled low, keeping the discharge circuit inactive.
  <br><br>
  The schematic also includes decoupling capacitors at the power inputs to every chip. These filter transient voltage fluctuations and ultimately reduce noise on the supply lines to our components.
</div>
<figure style="margin:16px 0; text-align:center;">
  <img src="/images/supercap-mcu-connector.png" alt="SM12B-GHS-TB MCU connector schematic" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">MCU connector schematic</figcaption>
</figure>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-decoupling-caps.png" alt="Decoupling capacitors" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Decoupling capacitors</figcaption>
</figure>
</details>

<details>
<summary>Routing, Footprints, Design and Electric Rule Checks</summary>
<div class="code-description">
  <strong>Approach:</strong> Before routing, we run the Electrical Rules Check (ERC) to verify the schematic is correct: pins routed to the right power rails, no floating inputs, no duplicate references, and all footprints assigned. Passing ERC with 0 violations is a prerequisite before moving to PCB layout.
  <br><br>
  All components have footprints either pulled from the KiCad library or created manually. Our supercapacitor holder is an example of a custom footprint, built by a team member from the physical dimensions of the in-house fabricated device.
  <br><br>
  PCB routing connects all power nets to their respective supply pins and GND pins. Decoupling capacitors are placed as close as possible to each chip's supply pin to minimize noise. Once routing is complete, a Design Rules Check (DRC) verifies that all connections are made and no layout violations exist.
</div>
<figure style="margin:16px 0; text-align:center;">
  <img src="/images/supercap-erc.png" alt="ERC showing 0 violations" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">ERC — 0 violations</figcaption>
</figure>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-footprint-assignments.png" alt="Symbol to footprint assignments" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Symbol:Footprint assignments</figcaption>
</figure>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-holder-footprint.png" alt="Custom supercapacitor holder footprint" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Custom supercapacitor holder footprint</figcaption>
</figure>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-pcb-routed.png" alt="Routed PCB layout" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Routed PCB layout</figcaption>
</figure>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-drc.png" alt="DRC showing 0 violations" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">DRC 0 violationss</figcaption>
</figure>
</details>

<details>
<summary>Future Work</summary>
<div class="code-description">
  <strong>Approach:</strong> My role has been designing and integrating all subcircuits into a single schematic and walking teammates through the design decisions. Experiment card V1 has been fabricated and is ready for component population and testing. With the semester ending, hardware assembly will be handled by team members remaining at Georgia Tech over the summer. In the meantime, I am shifting focus to STM32 firmware, primarily the PWM control logic for charge and discharge cycling. In July, the team will integrate the finalized boards and supercapacitor onto the HASP payload, which will take flight in August.
  <br><br>
  Since this project is run through Dr. Ready's lab at the Georgia Tech Research Institute, our team had the opportunity to present our research and findings to an audience of United States Space Force personnel, including Chief Master Sergeant John F. Bentivegna and other active-duty members. Presenting work that may one day be used in space applications to the people who operate in that domain was an experience unlike any other.
</div>
<figure style="margin:16px 0; text-align:center;">
  <img src="/images/supercap-fabricated-board.jpg" alt="Fabricated experiment board V1" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Fabricated experiment card V1</figcaption>
</figure>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-vip-presentation.jpg" alt="VIP team presenting to US Space Force at GTRI" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">VIP team presenting to US Space Force personnel at Georgia Tech Research Institute</figcaption>
</figure>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-full-schematic.png" alt="Full IC schematic" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Current IC Schematic</figcaption>
</figure>
</details>

</div>

## Outcome

[Results will be added following the NASA balloon flight in August 2026.]
