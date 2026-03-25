---
date: 2024-01-02
title: Supercapacitor IC
subtitle: Circuit Design – Power Electronics
image: '/images/project-2.jpg'
---

## Overview

Designed and built a custom integrated circuit for managing supercapacitor charge and discharge cycles. Supercapacitors offer extremely high power density and rapid charge/discharge rates, making them ideal for applications requiring short bursts of energy.

## Technical Details

The circuit design focused on:

- **Charge balancing**: Implementing passive and active balancing techniques to equalize voltage across cells in a supercapacitor bank
- **Overvoltage protection**: Comparator-based protection circuits to prevent cell damage from overcharging
- **Controlled discharge**: MOSFET-based switching network for regulated energy delivery to the load
- **Current sensing**: Inline shunt resistor with op-amp amplification for real-time current monitoring

## Design Process

Schematic capture and simulation were performed in LTspice to validate circuit behavior before moving to PCB layout. Component selection prioritized low ESR and high ripple current ratings suitable for the supercapacitor's fast charge cycles.

## Outcome

The completed circuit successfully demonstrated stable charge balancing and reliable protection behavior, serving as a foundation for further integration into energy storage applications.
