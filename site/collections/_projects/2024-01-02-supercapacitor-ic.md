---
date: 2024-01-02
title: Supercapacitor IC
subtitle: Circuit Design – Power Electronics
image: '/images/supercap-cover.png'
---

## Overview

As a systems design member of the Chip Scale Power & Energy Vertically Integrated Projects (VIP) team at Georgia Tech, I work on the integrated circuit for a supercapacitor characterization system. The supercapacitors being tested are fabricated in-house and target space-based energy storage applications. Our circuit charges and discharges the supercapacitor at a constant 10µA current while reading voltage and current to calculate capacitance. Switching is handled by MOSFETs driven by a pulse wave monitor, comparators, and a microcontroller. In summer 2026, the fabricated IC will fly aboard a NASA balloon into the stratosphere — meaning every component must survive temperatures down to -60°C. This is an ongoing project and will be updated as work progresses.

## Technical Details

The core requirement is constant-current charge and discharge at 10µA. For charging, this means selecting a dedicated constant-current chip. For discharging, it means designing a custom subunit using automotive-to-milspec grade components that can hold the current steady as the supercapacitor voltage drops.

As discharge circuit lead, I used my prior PCB experience from HyTech Racing to guide teammates through circuit design fundamentals while building out the discharge section in KiCad.

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
<summary>Discharge Circuit</summary>
<div class="code-description">
  <strong>Approach:</strong> The discharge circuit is built around an op-amp feedback system that forces a constant 10µA from the supercapacitor regardless of how its voltage changes over time. The key insight is that a constant current discharge causes voltage to drop linearly, which is exactly the behavior needed to calculate capacitance from C = I × Δt / ΔV.
  <br><br>
  The current is set by <strong>R1 (9kΩ)</strong> - the sense resistor. With a 0.1V reference (V5), the target voltage across R1 is 0.1V, giving I = 0.1V / 9kΩ ≈ 11µA ≈ 10µA. <strong>U3</strong> (op-amp) continuously compares this 0.1V reference against the actual voltage developing across R1 and drives the gate of <strong>Q1 (NMOS)</strong> to correct deviation: if current rises, Q1 is turned down; if it falls, Q1 is turned up. This feedback loop is what maintains the constant current.
  <br><br>
  <strong>Q2 (NMOS, Vsense)</strong> acts as the high-side current sense element, isolating the sense path from the main discharge path through <strong>C1 (1.6µF)</strong>. <strong>U1</strong> provides a second comparator stage in the loop for additional stability. <strong>R6 and R7 (both 250kΩ)</strong> form the voltage divider which feeds into the op-amp, and <strong>R2 and R3 (both 4.7kΩ)</strong> set the op-amp feedback gain. <strong>V2 (3.3V)</strong> powers the control circuitry.
</div>
<img src="/images/supercap-circuit.png" alt="Discharge circuit schematic" style="width:100%; display:block; margin:16px 0; border-radius:6px; border:1px solid #30363d;">
<p style="font-size:14px; line-height:1.6; color:#8b949e; margin:0 0 8px;">The transient simulation confirms the circuit behaves as designed. <strong style="color:#c9d1d9;">I(R1) holds at 9.99µA</strong> throughout each discharge phase, validating the feedback loop. The voltage (blue trace) decreases linearly during discharge — the expected signature of a constant-current load, and exactly what's needed to calculate capacitance. When the voltage jumps sharply back up, that represents the capacitor being fully charged again before the next discharge cycle begins. The green trace shows the control switching signal driving this charge/discharge cycling.</p>
<figure style="margin:8px 0 16px; text-align:center;">
  <img src="/images/supercap-sim.png" alt="Transient simulation showing constant current discharge" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">TRAN simulation — I(R1) = 9.99µA, linear voltage discharge with voltage jumping back on full charge</figcaption>
</figure>
</details>

<details>
<summary>Switches</summary>
<div class="code-description">
  <strong>Approach:</strong> The switching system controls when the supercapacitor charges and discharges. The timing is driven by <strong>V3 (VPULSE)</strong>, a pulse wave monitor (PWM) configured as PULSE(0 3.3 0 1u 1u 650m 1300m): meaning it switches between 0V and 3.3V with a 650ms on-time and a 1300ms period. This pulse signal drives <strong>Q3 (NMOS)</strong>, which acts as the discharge switch, connecting the discharge path to the discharging circuit when the pulse is high. <strong>Q4 (PMOS)</strong> is the complementary switch that handles the charge path, turning on when Q3 is off. <strong>R5 (9kΩ)</strong> sits in the gate drive path to limit current during switching transitions. Currently the PWM is a spice directive from a modified voltage source, for our fabricated PCB this will be driven by our microcontroller coded with rust. 
  <br><br>
  The second part of the switching system essentially prevents the supercapacitor from over charging. During simulation, a repetitive error occured that simulation breaks with constant current charge because it causes the voltage of the capacitor to exceed 3.3V. This <strong>LM193 comparator (U6)</strong> compares the voltage between capacitor and a reference of 3V. Once the capacitor reading in the non-inverting terminal exceeds that of the inverting terminal, it will output a float, which is connected in a node with a pull-up resistor that powers the p-mosfet to open and therefore stop charging. Although theoretically if we source the constant current chip with 3.3V, the cap cannot exceed that value, this comparator just serves a back-up switch mechanism to prevent any possible supercapacitor capacitance interference.
.</div>
<div style="display:flex; gap:16px; margin:16px 0;">
  <figure style="margin:0; width:50%; text-align:center;">
    <img src="/images/supercap-switch1.png" alt="Pulse switch circuit" style="width:100%; border-radius:6px; border:1px solid #30363d;">
    <figcaption style="font-size:12px; color:#8b949e; margin-top:6px;">VPULSE driver with NMOS/PMOS switches</figcaption>
  </figure>
  <figure style="margin:0; width:50%; text-align:center;">
    <img src="/images/supercap-switch2.png" alt="Comparator charge control" style="width:100%; border-radius:6px; border:1px solid #30363d;">
    <figcaption style="font-size:12px; color:#8b949e; margin-top:6px;">LM193 comparator controlling charge cutoff</figcaption>
  </figure>
</div>
</details>

<details>
<summary>Future Work</summary>
<div class="code-description">
  <strong>Approach:</strong> [Add your future work description here]
</div>
</details>

</div>

## Outcome

[Coming soon — results will be added following the NASA balloon flight in summer 2026.]
