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
<pre><code>// Paste your initialize variables code here
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
