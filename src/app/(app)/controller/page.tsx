"use client";



import { ControllerDashboard } from "@/components/controller/dashboard";

import { CustomCommands } from "@/components/controller/custom-commands";

import { SerialTerminal } from "@/components/bluetooth/serial-terminal";



export default function ControllerPage() {

  return (

    <div className="space-y-6">

      <div>

        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/80">

          Control Surface

        </p>

        <h1 className="page-title mt-2 text-3xl text-white md:text-4xl">

          Controller

        </h1>

        <p className="mt-2 text-slate-400">

          Buttons, switches, sliders, joystick, RGB, servo, keypad, D-pad, and

          voice.

        </p>

      </div>

      <ControllerDashboard />

      <CustomCommands />

      <SerialTerminal />

    </div>

  );

}


