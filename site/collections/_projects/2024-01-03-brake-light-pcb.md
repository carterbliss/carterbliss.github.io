---
date: 2024-01-03
title: Brake-Light PCB
subtitle: HyTech Racing – PCB Design
image: '/images/brakelight-pcb.png'
---

## Overview

Designed a custom brake-light printed circuit board system which flashed LEDs when plugged into USB C port. This project required starting each process of PCB creation from scratch: schematic symbol creation, RLC circuit layout, routing, and soldering. 

## Technical Details

To create the PCB I had to understand components that would execute the tasks: 
--LED's on the altium library that were approved for brake-lights in FSAE 
--A power source to provide power to LED's
--Resistors and capacitors to alter voltage and current to match datasheet values
--Timer to sequence the lighting process

LED's were laid out by team leads as APT1608, with schematic symbol and footprint provided.

Resistor and capacitor models were also provided on the Altium Library.

Power source was chosen to be USB-C port, which can supply a broad range of voltages & currents, which will be modified in the RC layout. 

Timer was chosen to be LM555, requiring me to research the datasheet, create an associating schematic symbol and 8 short outlined integrated circuit(8-SOIC) footprint. 

## Design Process

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">

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
<summary>Schematic Symbol – LM555 Timer</summary>
<div class="code-description">
  <strong>Approach:</strong> For this project, I had to create the LM555 timer component from scratch. My first step was to study the <a href="https://www.ti.com/lit/ds/symlink/lm555.pdf" target="_blank" style="color:#58a6ff;">LM555 datasheet</a> and note each pin's electrical role and current requirements, since those determined how pins should be grouped on the symbol. The goal wasn't to mirror the datasheet's example layout — it was to arrange pins in a way that makes the schematic easy to read and minimizes the passive components needed around it, while following HyTech's electrical style guide for consistency across the library.
  <br><br>
  Pin placement was driven by function. <strong>VCC and RESET</strong> are grouped together on the top right because neither cares about a precise voltage reading — they just need a logic high to be active, so keeping them adjacent makes it easy to tie RESET high without long traces. <strong>THRESHOLD and TRIGGER</strong> are placed next to each other on the left because they operate on the same current thresholds (2/3 and 1/3 of VCC respectively) and work as a pair to set and reset the internal flip-flop — grouping them together reflects how they're used in the timing circuit. <strong>DISCHARGE</strong> sits just above them rather than alongside, because although it's related to the timing cycle, it sources a slightly different current path through the external RC network and needs its own clearance to route cleanly. <strong>OUTPUT</strong> and <strong>CONTROL VOLTAGE</strong> are placed on the right, with output prominent since it's the primary signal we care about, and control voltage available for fine-tuning the timing threshold if needed. <strong>GND</strong> anchors the bottom left as a stable reference point for the whole symbol. Additionally, each pin follows the type outlined on the datasheet. VCC and GND are both power pins, while <strong>DISCHARGE, THRESHOLD, TRIGGER, CONTROL V, and RESET</strong> are inputs while<strong> OUTPUT</strong> is an output. 
</div>
<img src="/images/lm555-symbol.png" alt="LM555 schematic symbol" style="width:100%; max-width:420px; display:block; margin:16px 20px; border-radius:6px; border:1px solid #30363d;">
</details>

<details>
<summary>8-SOIC Footprint</summary>
<div class="code-description">
  <strong>Approach:</strong> The LM555 comes in a single characterized package(8-SOIC) so the footprint was straightforward to recreate from the datasheet dimensions. I set the grid to 100 mils and placed eight rectangular top-layer pads with matching spacing and sizing. Following HyTech's electrical style guide, I added a mechanical layer 13 outline inside the pad area to mark the IC body boundary, and a mechanical layer 15 outline around the full footprint to indicate the keepout and center cross. A orientation dot was added to the top left corner to assist alignment when soldering. The final step was sourcing a 3D model from Mouser and attaching it to the footprint, giving a visual reference for the assembled board. With the footprint complete, all the components needed to begin the RC circuit layout were in place.
</div>
<div style="display:flex; gap:16px; margin:16px 20px;">
  <img src="/images/soic-footprint.png" alt="8-SOIC footprint layout" style="width:50%; border-radius:6px; border:1px solid #30363d; object-fit:cover;">
  <img src="/images/soic-footprint-3d.png" alt="8-SOIC 3D model" style="width:50%; border-radius:6px; border:1px solid #30363d; object-fit:cover;">
</div>
</details>

<details>
<summary>Resistor & Capacitor Circuit Layout</summary>
<div class="code-description">
  <strong>Approach:</strong> With all components in the library, the next step was wiring the full circuit. The LM555 is configured to continuously oscillate to flash the LEDs rather than requiring an external trigger. The timing is set by <strong>R1 (43kΩ)</strong> and <strong>R2 (332kΩ)</strong> feeding into <strong>C1 (1µF)</strong> — these values were calculated using fundamental formulae such as <strong> Voltage = Resistance * Current and Capacitace = Charge stored / Voltage. </strong> R1 connects between VCC and DISCHARGE, while R2 bridges DISCHARGE down to THRESHOLD and TRIGGER, which are shorted together. C1 then completes the timing network to GND.
  <br><br>
  The OUTPUT pin drives six <strong>0603 LEDs</strong> through a <strong>50Ω current-limiting resistor (RL1)</strong>, sized to keep each LED within its rated forward current at 5V. VCC and RESET are both tied directly to the +5V rail — RESET is held high so the timer runs freely without any interrupt.
  <br><br>
  <strong>C2 (0.01µF)</strong> decouples the CONTROL VOLTAGE pin, and <strong>C4 (1µF)</strong> decouples the +5V rail — both suppress noise that could otherwise affect timing stability.
  <br><br>
  The power source is a <strong>USB4110GFA USB-C connector (J1)</strong>. VBUS is wired directly to the +5V rail, and all GND and shield pins are tied to ground. The data lines (DP, DN, SBU) are left unconnected since only power is needed. <strong>R3 and R4 (both 5.1kΩ)</strong> are pull-down resistors on the CC1 and CC2 pins — this is the standard USB-C configuration for a power sink, signaling to the host that the device wants to draw up to 900mA at 5V. <strong>C3 (0.1µF)</strong> decouples the VBUS line at the connector to filter any noise coming in from the cable.
</div>
<img src="/images/brakelight-schematic.png" alt="Brake light RC circuit schematic" style="width:100%; display:block; margin:16px 0; border-radius:6px; border:1px solid #30363d;">
<img src="/images/brakelight-usbc.png" alt="USB-C power circuit schematic" style="width:100%; display:block; margin:16px 0; border-radius:6px; border:1px solid #30363d;">
</details>

<details>
<summary>Routing</summary>
<div class="code-description">
  <strong>Approach:</strong> The routing goal is straightforward — connect every component to the correct net: power to power, GND to GND. My approach was to orient all GND pads toward the outside of the board first, then perform a GND copper pour across the entire board. The pour floods all outer copper area and ties every GND pad together automatically, giving current a continuous return path without manually routing each one.
  <br><br>
  Trace width was set to 5 mil rather than the typical 10 mil — the board is small and the components are simple enough that this was sufficient without risking current capacity issues. The LEDs are placed on the top layer for a clean appearance, so vias were used to bring power up from the bottom layer to the top-layer LED pads.
  <br><br>
  Getting to zero DRC errors required iteration. My first mistake was placing components without a routing plan, which led to conflicts that were hard to untangle. Once I shifted to a systematic approach — orient GND pads, pour GND, then route power traces inward — the process became much cleaner. A common error I hit was silk-to-solder-mask violations, where a component's reference label on the bottom overlay was overlapping a pad. These were resolved by simply relocating the labels. After working through all violations, the board passed the FSAE & HyTech DRC with 0 errors.
</div>
<div style="display:flex; gap:12px; margin:16px 0;">
  <figure style="margin:0; width:33%; text-align:center;">
    <img src="/images/routing-top.png" alt="Top copper layer" style="width:100%; border-radius:6px; border:1px solid #30363d;">
    <figcaption style="font-size:12px; color:#8b949e; margin-top:6px;">Top Layer</figcaption>
  </figure>
  <figure style="margin:0; width:33%; text-align:center;">
    <img src="/images/routing-bottom.png" alt="Bottom copper layer" style="width:100%; border-radius:6px; border:1px solid #30363d;">
    <figcaption style="font-size:12px; color:#8b949e; margin-top:6px;">Bottom Layer</figcaption>
  </figure>
  <figure style="margin:0; width:33%; text-align:center;">
    <img src="/images/routing-overlay.png" alt="Bottom overlay layer" style="width:100%; border-radius:6px; border:1px solid #30363d;">
    <figcaption style="font-size:12px; color:#8b949e; margin-top:6px;">Bottom Overlay</figcaption>
  </figure>
</div>
</details>

</div>

<figure style="margin:24px 0 0; text-align:center;">
  <img src="/images/drc-report.png" alt="Altium DRC report" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Design Rule Check — The single rule violation flagged is a board outline trace width of 8.835 mils, which falls below the 10 mil minimum. This is a known exception: the board outline is not a functional trace and carries no current, so this violation is tolerated and has no impact on the board's performance.</figcaption>
</figure>
<figure style="margin:16px 0 0; text-align:center;">
  <img src="/images/drc-violations.png" alt="DRC violation breakdown" style="width:100%; border-radius:6px; border:1px solid #30363d;">
  <figcaption style="font-size:13px; color:#8b949e; margin-top:8px;">Board Clearance Constraint violation — 8.835 mils, below the 10 mil rule but tolerated for the board outline.</figcaption>
</figure>

## Outcome

[Video coming soon]
