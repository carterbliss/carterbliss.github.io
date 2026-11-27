---
date: 2026-09-20
title: Lapped Timer Peripheral
subtitle: ECE 2031: Digital Design Lab – VHDL & FPGA
image: '/images/project-2.jpg'
---

## Overview

For ECE 2031: Digital Design Lab, I designed a memory-mapped lap-timer peripheral in VHDL for the Simple Computer (SCOMP), a teaching CPU architecture, targeting a Cyclone V FPGA. The goal was to give SCOMP programs a hardware timer that could start, stop, record individual lap times, and report them back over the shared I/O bus, all without the CPU burning cycles polling a software timer.

## Technical Details

The peripheral exposes a 6-register memory-mapped I/O interface so SCOMP instructions can control and read the timer like any other device on the bus. A control finite state machine (FSM) manages the timer's start, stop, lap-capture, and reset behavior, and a tri-state bus output lets the peripheral drive the shared SCOMP data bus only when addressed, so it coexists with the system's other I/O devices. Because the timer runs on its own clock domain separate from SCOMP's, every command crossing from the CPU into the timer had to be handled carefully to avoid metastability.

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
<summary>Register Map</summary>
<div class="code-description">
  <strong>Approach:</strong> SCOMP communicates with peripherals through a shared I/O bus, so the timer needed to look like a normal addressable device rather than a special case. I designed a 6-register interface covering control (start/stop/reset), the current running time, and stored lap times, so SCOMP assembly could read and write the timer using the same IN/OUT instructions it uses for any other I/O device. Keeping the register map small and predictable made the peripheral straightforward to drive from assembly without extra glue logic on the CPU side.
</div>
</details>

<details>
<summary>Stress Testing</summary>
<div class="code-description">
  <strong>Approach:</strong> Rather than relying on simulation alone, I verified the peripheral directly on the Cyclone V FPGA using an 8-case assembly test suite covering start/stop behavior, single and multiple lap captures, and reset behavior. The most important cases targeted the clock domain crossing logic directly: issuing commands back-to-back and in rapid succession from SCOMP to see whether the toggle synchronizers could keep up without dropping or duplicating a command. All 8 cases passed on hardware, confirming the synchronizer and FSM design held up under timing pressure that simulation alone wouldn't have fully captured.
</div>
</details>

<details>
<summary>VHDL Design</summary>
<div class="code-description">
  <strong>Approach:</strong> The peripheral's behavior is governed by a finite state machine in VHDL: idle, running, lap-capture, and stopped states, with transitions driven by command writes from SCOMP. Capturing a lap had to happen without disturbing the running count, so the FSM latches the current time into a separate lap register on a capture command instead of resetting or pausing the main counter, letting the timer count continuously through multiple laps while still giving SCOMP a clean snapshot of each one.
  <br><br>
  SCOMP and the timer run on independent clocks, so commands crossing into the timer's domain risked metastability if sampled directly. I implemented toggle synchronizers paired with edge detection: a command toggles a signal in the SCOMP domain, that toggle passes through synchronizer flip-flops in the timer domain, and an edge detector converts the synchronized toggle back into a single-cycle pulse the FSM can act on, letting SCOMP issue commands asynchronously without risking corrupted or dropped commands.
</div>
</details>

<details>
<summary>Assembly Code Application</summary>
<div class="code-description">
  <strong>Approach:</strong> From SCOMP's side, the timer looks like any other memory-mapped device: assembly programs drive it entirely through IN and OUT instructions addressed to its registers, with no special-cased hardware support needed in the CPU. A typical lap-timing routine writes a start command to the control register, periodically issues a lap-capture command to snapshot the current time, and reads back stored lap values through the time and lap registers once the run is stopped. Each of the 8 hardware test cases was written as its own short SCOMP assembly program exercising a specific sequence of these commands, which doubled as both the verification suite and a working example of how a real program would use the peripheral.
</div>
</details>

</div>

## Outcome

The peripheral runs correctly on hardware, passing all 8 assembly test cases including the back-to-back command cases designed to stress the clock domain crossing logic. [Demo video and FPGA board photos to be added.]
