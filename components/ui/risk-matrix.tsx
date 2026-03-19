'use client'

import React from 'react'

// Sample risk data: [probability (1-5), impact (1-5), count, label]
const risks = [
  { x: 1, y: 1, count: 2, label: 'Low/Low' },
  { x: 2, y: 1, count: 3, label: 'Med/Low' },
  { x: 3, y: 2, count: 5, label: 'Med/Med' },
  { x: 4, y: 3, count: 6, label: 'High/Med' },
  { x: 5, y: 4, count: 4, label: 'Very High' },
  { x: 4, y: 4, count: 3, label: 'Critical' },
]

export function RiskMatrix() {
  const cellSize = 60
  const padding = 60
  const gridSize = 5

  const getRiskColor = (probability: number, impact: number): string => {
    const severity = probability * impact
    if (severity >= 16) return '#dc2626' // Critical (red)
    if (severity >= 12) return '#f59e0b' // High (amber)
    if (severity >= 8) return '#eab308' // Medium (yellow)
    return '#10b981' // Low (green)
  }

  const getRiskLabel = (probability: number, impact: number): string => {
    const severity = probability * impact
    if (severity >= 16) return 'Critical'
    if (severity >= 12) return 'High'
    if (severity >= 8) return 'Medium'
    return 'Low'
  }

  return (
    <div className="flex flex-col gap-4">
      <svg width="100%" height={padding * 2 + cellSize * gridSize} viewBox={`0 0 ${padding * 2 + cellSize * gridSize} ${padding * 2 + cellSize * gridSize}`} className="bg-card">
        {/* Axes Labels */}
        <text x={padding / 2} y={padding / 2 + 5} textAnchor="middle" className="text-xs fill-muted-foreground" fontSize="12">
          Impact
        </text>
        <text x={padding / 2 + 30} y={padding / 2 + 20} textAnchor="start" className="text-xs fill-muted-foreground" fontSize="12">
          ↑
        </text>

        <text x={padding - 10} y={padding * 2 + cellSize * gridSize - 10} textAnchor="end" className="text-xs fill-muted-foreground" fontSize="12">
          Probability →
        </text>

        {/* Grid Lines and Labels */}
        {Array.from({ length: gridSize + 1 }).map((_, i) => {
          const x = padding + i * cellSize
          const y = padding + i * cellSize

          return (
            <g key={i}>
              {/* Vertical lines */}
              <line
                x1={x}
                y1={padding}
                x2={x}
                y2={padding + cellSize * gridSize}
                stroke="#334155"
                strokeWidth="1"
              />
              {/* Horizontal lines */}
              <line
                x1={padding}
                y1={y}
                x2={padding + cellSize * gridSize}
                y2={y}
                stroke="#334155"
                strokeWidth="1"
              />

              {/* X-axis labels (Probability) */}
              {i < gridSize && (
                <text
                  x={padding + (i + 0.5) * cellSize}
                  y={padding + cellSize * gridSize + 20}
                  textAnchor="middle"
                  className="text-xs fill-muted-foreground"
                  fontSize="11"
                >
                  {i + 1}
                </text>
              )}

              {/* Y-axis labels (Impact) */}
              {i < gridSize && (
                <text
                  x={padding - 15}
                  y={padding + (gridSize - i - 0.5) * cellSize + 4}
                  textAnchor="end"
                  className="text-xs fill-muted-foreground"
                  fontSize="11"
                >
                  {i + 1}
                </text>
              )}
            </g>
          )
        })}

        {/* Risk Cells */}
        {Array.from({ length: gridSize }).map((_, probIdx) =>
          Array.from({ length: gridSize }).map((_, impactIdx) => {
            const prob = probIdx + 1
            const impact = gridSize - impactIdx
            const x = padding + probIdx * cellSize
            const y = padding + impactIdx * cellSize
            const color = getRiskColor(prob, impact)
            const label = getRiskLabel(prob, impact)

            return (
              <g key={`${prob}-${impact}`}>
                {/* Cell background */}
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill={color}
                  fillOpacity="0.1"
                  stroke={color}
                  strokeWidth="1"
                />

                {/* Cell label */}
                <text
                  x={x + cellSize / 2}
                  y={y + cellSize / 2 + 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-medium fill-foreground pointer-events-none"
                  fontSize="10"
                >
                  {label}
                </text>
              </g>
            )
          })
        )}
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-4 gap-3 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }} />
          <span className="text-xs text-muted-foreground">Low Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#eab308' }} />
          <span className="text-xs text-muted-foreground">Medium Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
          <span className="text-xs text-muted-foreground">High Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#dc2626' }} />
          <span className="text-xs text-muted-foreground">Critical</span>
        </div>
      </div>
    </div>
  )
}
