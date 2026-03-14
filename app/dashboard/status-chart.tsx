"use client"

import { RadialBarChart, RadialBar, PolarRadiusAxis, Label } from 'recharts'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const STATUS_COLORS: Record<string, string> = {
  PENDING_COY: "#eab308",
  PENDING_S4: "#f97316",
  REPORTED_IFM: "#3b82f6",
  COMPLETED: "#22c55e",
  REJECTED: "#ef4444",
  MERGED: "#a855f7",
  DEFAULT: "#64748b",
}

export function StatusChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) return (
    <div className="text-sm text-muted-foreground text-center py-4">No data available</div>
  )

  const total = data.reduce((sum, d) => sum + d.value, 0)

  const chartData = [
    data.reduce((acc, d) => ({ ...acc, [d.name]: d.value }), {} as Record<string, number>)
  ]

  // const chartConfig = data.reduce<ChartConfig>((acc, d) => ({
  //   ...acc,
  //   [d.name]: {
  //     label: d.name.replace(/_/g, ' '),
  //     color: STATUS_COLORS[d.name] ?? STATUS_COLORS.DEFAULT,
  //   }
  // }), {})

  const chartConfig = {
    PENDING_COY: { label: "PENDING COY", color: "var(--color-pending-coy)" },
    PENDING_S4:  { label: "PENDING S4",  color: "var(--color-pending-s4)" },
    REPORTED_IFM:{ label: "REPORTED IFM",color: "var(--color-reported-ifm)" },
    COMPLETED:   { label: "COMPLETED",   color: "var(--color-completed)" },
    REJECTED:    { label: "REJECTED",    color: "var(--color-rejected)" },
    MERGED:      { label: "MERGED",      color: "var(--color-merged)" },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square w-full max-w-[200px] mb-[-220px]"
    >
      <RadialBarChart
        data={chartData}
        endAngle={180}
        innerRadius={80}
        outerRadius={130}
      >
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) - 16}
                      className="fill-foreground text-2xl font-bold"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 4}
                      className="text-xs"
                      fill="#ffffff"
                    >
                      Reports
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </PolarRadiusAxis>

        {data.map((entry) => (
          <RadialBar
            key={entry.name}
            dataKey={entry.name}
            stackId="a"
            cornerRadius={4}
            fill={`var(--color-${entry.name})`}
            className="stroke-transparent stroke-2"
          />
        ))}
      </RadialBarChart>
    </ChartContainer>
  )
}