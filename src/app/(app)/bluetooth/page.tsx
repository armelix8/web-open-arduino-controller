"use client";



import { ConnectionPanel } from "@/components/bluetooth/connection-panel";

import { SerialTerminal } from "@/components/bluetooth/serial-terminal";



export default function BluetoothPage() {

  return (

    <div className="space-y-6">

      <div>

        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/80">

          Connectivity

        </p>

        <h1 className="page-title mt-2 text-3xl text-white md:text-4xl">

          Bluetooth

        </h1>

        <p className="mt-2 text-slate-400">

          Scan, connect, and exchange serial data with your Arduino.

        </p>

      </div>

      <div className="grid gap-4 xl:grid-cols-2">

        <ConnectionPanel />

        <SerialTerminal />

      </div>

    </div>

  );

}


