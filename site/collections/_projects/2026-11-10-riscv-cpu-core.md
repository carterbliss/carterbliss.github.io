---
date: 2026-11-10
title: RISC-V CPU Core
subtitle: Silicon Jackets – RTL Design & Physical Design
image: '/images/project-1.jpg'
---

## Overview

As a Physical Design Engineer with Silicon Jackets, Georgia Tech's student-run silicon design team, I took a RISC-V CPU core through the full RTL-to-GDS flow: writing and verifying the core in SystemVerilog, synthesizing and closing timing in Synopsys Design Compiler, and completing place-and-route sign-off in Cadence Innovus and Pegasus. The goal was to build a core that could realistically tape out, not just simulate correctly, so every stage after RTL was judged against the same bar the team uses for our actual tapeout pipeline.

## Technical Details

The core implements the RISC-V base ISA datapath, with all R-type instructions and a subset of I-type and B-type instructions passing verification so far. Correctness was validated with a UVM-style testbench of 30+ constrained-random, functional, and assertion-based tests run in Cadence Xcelium and debugged in SimVision. Once functionally verified, the design moved into the physical design flow: synthesis in Synopsys Design Compiler with clock gating inserted via custom Tcl scripts, multi-corner static timing analysis across SS, TT, and FF libraries, and manual critical-path optimization that improved worst negative slack (WNS) by ~18% and total negative slack (TNS) by ~2%.

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
<summary>RTL Design</summary>
<div class="code-description">
  <strong>Approach:</strong> The CPU core was written in SystemVerilog, implementing the RISC-V datapath and control logic needed to execute R-type, I-type, and B-type instructions. The datapath covers instruction fetch, register file access, ALU operations, and the control signals that route data between them for each instruction class. Writing the control logic class-by-class, rather than attempting the full instruction set at once, kept each stage of the datapath verifiable in isolation before integrating the next instruction type.
</div>
</details>

<details>
<summary>UVM Design + Testbench</summary>
<div class="code-description">
  <strong>Approach:</strong> Rather than hand-checking waveforms instruction by instruction, I built a UVM-style testbench with 30+ constrained-random, directed-functional, and assertion-based tests, run in Cadence Xcelium and debugged in SimVision. Constrained-random tests exercised the datapath with randomized instruction sequences and operands to surface edge cases a hand-written test plan would miss, directed-functional tests targeted specific instruction behaviors, and assertions caught protocol and control-logic violations as soon as they occurred rather than only showing up as a wrong final result. The core currently passes all R-type tests and a subset of I-type and B-type tests, with remaining instruction coverage in progress.
</div>
</details>

<details>
<summary>Physical Design</summary>
<div class="code-description">
  <strong>Approach:</strong> Once RTL was functionally verified, I synthesized the design in Synopsys Design Compiler and inserted clock gating through custom Tcl scripts to reduce dynamic power without hand-editing RTL for every clocked register. I ran multi-corner static timing analysis across the SS (slow-slow), TT (typical-typical), and FF (fast-fast) process corners to make sure the design would meet timing across worst-case, nominal, and best-case silicon, then optimized the dominant critical paths, improving worst negative slack (WNS) by ~18% and total negative slack (TNS) by ~2%.
  <br><br>
  Place-and-route was completed in Cadence Innovus. SRAM macros were placed manually with halos (keepout margins) rather than left to the auto-placer, since macro placement has an outsized effect on routing congestion and timing at this utilization. The core was targeted at 50% utilization to leave enough routing headroom around the macros, and I built the power rings to distribute VDD/VSS before clock tree synthesis (CTS). After CTS, I ran final signoff checks in Cadence Pegasus, closing the design with zero DRC and zero LVS violations.
</div>
</details>

</div>

## Outcome

[Writeup in progress — final RTL coverage (full I-type/B-type instruction set), waveform captures, and post-PnR layout screenshots will be added as the design matures toward a Silicon Jackets tapeout.]
