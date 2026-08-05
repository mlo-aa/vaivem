"use client"

import { Check } from "lucide-react"
import { cn } from "./utils"

export function ProcessSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="vv-steps">
      {steps.map((label, i) => {
        const step = i + 1
        const done = current > step
        const active = current === step
        return (
          <li key={label} className="vv-step">
            <span
              className={cn(
                "vv-step-dot",
                done && "vv-step-dot--done",
                active && "vv-step-dot--active",
              )}
            >
              {done ? <Check className="vv-icon-sm" /> : active ? "…" : step}
            </span>
            <span className={cn("vv-step-label", (done || active) && "vv-step-label--hot")}>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
