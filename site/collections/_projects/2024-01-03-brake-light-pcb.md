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
  Pin placement was driven by function. <strong>VCC and RESET</strong> are grouped together on the top right because neither cares about a precise voltage reading — they just need a logic high to be active, so keeping them adjacent makes it easy to tie RESET high without long traces. <strong>THRESHOLD and TRIGGER</strong> are placed next to each other on the left because they operate on the same current thresholds (2/3 and 1/3 of VCC respectively) and work as a pair to set and reset the internal flip-flop — grouping them together reflects how they're used in the timing circuit. <strong>DISCHARGE</strong> sits just above them rather than alongside, because although it's related to the timing cycle, it sources a slightly different current path through the external RC network and needs its own clearance to route cleanly. <strong>OUTPUT</strong> and <strong>CONTROL VOLTAGE</strong> are placed on the right, with output prominent since it's the primary signal we care about, and control voltage available for fine-tuning the timing threshold if needed. <strong>GND</strong> anchors the bottom left as a stable reference point for the whole symbol.
</div>
<img src="/images/lm555-symbol.png" alt="LM555 schematic symbol" style="width:100%; max-width:420px; display:block; margin:16px 20px; border-radius:6px; border:1px solid #30363d;">
</details>

<details>
<summary>8-SOIC Footprint</summary>
<div class="code-description">
  <strong>Approach:</strong> [Add your description here — e.g. how you derived pad dimensions from the SOIC-8 package spec, courtyard clearances, silkscreen placement]
</div>
</details>

<details>
<summary>Resistor & Capacitor Circuit Layout</summary>
<div class="code-description">
  <strong>Approach:</strong> [Add your description here — e.g. how you sized R and C values from the LM555 timing formula, voltage/current considerations for the LEDs]
</div>
</details>

<details>
<summary>Routing</summary>
<div class="code-description">
  <strong>Approach:</strong> [Add your description here — e.g. trace width choices, keeping power traces away from signal lines, design rule checks]
</div>
</details>

</div>

## Outcome

[Video coming soon]
