---
date: 2024-01-02
title: Supercapacitor IC
subtitle: Circuit Design – Power Electronics
image: '/images/supercap-cover.png'
---

## Overview

As a systems design member of the Chip Scale Power & Energy Vertically Integrated Projects (VIP) team at Georgia Tech, I work on the integrated circuit for a supercapacitor characterization system. The supercapacitors being tested are fabricated in-house and target space-based energy storage applications. Our circuit charges and discharges the supercapacitor at a constant 10µA current while reading voltage and current to calculate capacitance. Switching is handled by MOSFETs driven by a pulse wave monitor, comparators, and a microcontroller. In summer 2026, the fabricated IC will fly aboard a NASA balloon into the stratosphere — meaning every component must survive temperatures down to -60°C. This is an ongoing project and will be updated as work progresses.

## Technical Details

The core requirement is constant-current charge and discharge at 10µA. For charging, this means selecting a dedicated constant-current IC. For discharging, it means designing a custom subunit using automotive-to-milspec grade components that can hold the current steady as the supercapacitor voltage drops.

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
  <strong>Approach:</strong> [Add your discharge circuit description here]
</div>
</details>

<details>
<summary>Switches</summary>
<div class="code-description">
  <strong>Approach:</strong> [Add your switches description here]
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

This is an ongoing project. Results and conclusions will be added following the NASA balloon flight in summer 2026.
