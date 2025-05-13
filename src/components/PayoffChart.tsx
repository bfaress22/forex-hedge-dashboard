import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { GlassContainer } from "@/components/ui/layout";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

interface PayoffChartProps {
  data: any[];
  selectedStrategy: string;
  spot: number;
  includePremium: boolean;
  showNotional?: boolean;
  notional?: number;
  notionalQuote?: number;
  baseCurrency?: string;
  quoteCurrency?: string;
}

// Custom tooltip component for better styling
const CustomTooltip = ({ 
  active, 
  payload, 
  label, 
  showNotional, 
  notional, 
  baseCurrency, 
  quoteCurrency 
}: any) => {
  const { isBloomberg } = useTheme();
  
  if (active && payload && payload.length) {
    return (
      <div className={cn(
        "p-3 rounded-lg shadow-lg",
        !isBloomberg && "bg-background border border-border",
        isBloomberg && "bg-black border border-[#444444] text-[#ff9e00]"
      )}>
        <p className={cn(
          "font-semibold",
          isBloomberg && "text-[#cccccc]"
        )}>
          Spot Rate: {Number(label).toFixed(4)}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} style={{ color: isBloomberg ? entry.name.includes("Unhedged") ? "#ff9e00" : entry.name.includes("without") ? "#8B5CF6" : "#3B82F6" : entry.color }}>
            {entry.name}: {Number(entry.value).toFixed(4)}
          </p>
        ))}
        {showNotional && (
          <>
            <hr className={cn(
              "my-2",
              !isBloomberg && "border-border",
              isBloomberg && "border-[#444444]"
            )} />
            <p>
              <span className="font-medium">{baseCurrency} Amount:</span>{" "}
              {notional?.toLocaleString()}
            </p>
            <p>
              <span className="font-medium">{quoteCurrency} Amount:</span>{" "}
              {(label * notional).toLocaleString()}
            </p>
          </>
        )}
      </div>
    );
  }

  return null;
};

const PayoffChart: React.FC<PayoffChartProps> = ({ 
  data, selectedStrategy, spot, includePremium, 
  showNotional, notional, notionalQuote, baseCurrency, quoteCurrency 
}) => {
  const { isBloomberg } = useTheme();
  
  // Reverse the logic to fix the behavior
  const shouldIncludePremium = !includePremium;
  
  // Configure lines based on strategy
  const getChartConfig = () => {
    // Base lines that are shown for all strategies
    const lines = [
      <Line
        key="hedged"
        type="monotone"
        dataKey="Hedged Rate"
        stroke={isBloomberg ? "#3B82F6" : "#3B82F6"}
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 6 }}
        name={shouldIncludePremium ? "Hedged Rate (with premium)" : "Hedged Rate (without premium)"}
      />,
      <Line
        key="unhedged"
        type="monotone"
        dataKey="Unhedged Rate"
        stroke={isBloomberg ? "#ff9e00" : "#9CA3AF"}
        strokeWidth={2}
        strokeDasharray="4 4"
        dot={false}
        activeDot={{ r: 6 }}
      />,
    ];

    // Add comparison line (with/without premium)
    if (shouldIncludePremium && data.length > 0 && data[0]['Hedged Rate (No Premium)']) {
      lines.push(
        <Line
          key="hedged-no-premium"
          type="monotone"
          dataKey="Hedged Rate (No Premium)"
          stroke={isBloomberg ? "#8B5CF6" : "#8B5CF6"} // Purple
          strokeWidth={2}
          strokeDasharray="3 3"
          dot={false}
          activeDot={{ r: 4 }}
          name="Hedged Rate (without premium)"
        />
      );
    } else if (!shouldIncludePremium && data.length > 0 && data[0]['Hedged Rate with Premium']) {
      lines.push(
        <Line
          key="hedged-with-premium"
          type="monotone"
          dataKey="Hedged Rate with Premium"
          stroke={isBloomberg ? "#EC4899" : "#EC4899"} // Pink
          strokeWidth={2}
          strokeDasharray="3 3"
          dot={false}
          activeDot={{ r: 4 }}
          name="Hedged Rate (with premium)"
        />
      );
    }

    // Add reference lines based on strategy
    let referenceLines = [
      <ReferenceLine
        key="spot"
        x={spot}
        stroke={isBloomberg ? "#6B7280" : "#6B7280"}
        strokeWidth={1}
        label={{
          value: "Current Spot",
          position: "top",
          fill: isBloomberg ? "#cccccc" : "#6B7280",
          fontSize: 12,
        }}
      />,
    ];

    // Add strategy-specific lines
    if (selectedStrategy === "custom" && data.length > 0) {
      // Find all strike and barrier keys
      const firstDataPoint = data[0];
      const keys = Object.keys(firstDataPoint);
      
      // Collect all strike and barrier keys
      const optionKeys = keys.filter(key => 
        key.includes('Strike') || 
        key.includes('Upper Barrier') || 
        key.includes('Lower Barrier')
      );
      
      // Sort the keys to show strikes first, then barriers
      optionKeys.sort((a, b) => {
        // Put strikes first
        if (a.includes('Strike') && !b.includes('Strike')) return -1;
        if (!a.includes('Strike') && b.includes('Strike')) return 1;
        return a.localeCompare(b);
      });
      
      // Add reference lines for each option component
      optionKeys.forEach(key => {
        if (firstDataPoint[key]) {
          let color = isBloomberg ? "#00ba3f" : "#047857"; // Default green for strikes
          let dashArray = "3 3";
          const position = key.includes('Upper Barrier') ? 'top' : 
                           key.includes('Lower Barrier') ? 'bottom' : 'top';
          
          if (key.includes('Upper Barrier')) {
            color = isBloomberg ? "#ff3d3d" : "#EF4444"; // Red for upper barriers
            dashArray = "5 5";
          } else if (key.includes('Lower Barrier')) {
            color = isBloomberg ? "#00ba3f" : "#10B981"; // Green for lower barriers
            dashArray = "5 5";
          }
          
          referenceLines.push(
            <ReferenceLine
              key={key}
              x={firstDataPoint[key]}
              stroke={color}
              strokeWidth={1}
              strokeDasharray={dashArray}
              label={{
                value: key,
                position: position as 'top' | 'bottom' | 'left' | 'right' | 'insideTop' | 'insideBottom' | 'insideLeft' | 'insideRight' | 'insideTopLeft' | 'insideTopRight' | 'insideBottomLeft' | 'insideBottomRight' | 'center',
                fill: color,
                fontSize: 12,
              }}
            />
          );
        }
      });
    } else if (selectedStrategy === "callKO" && data.length > 0) {
      // Add KO barrier line
      if (data[0]["KO Barrier"]) {
        referenceLines.push(
          <ReferenceLine
            key="ko-barrier"
            x={data[0]["KO Barrier"]}
            stroke={isBloomberg ? "#ff3d3d" : "#EF4444"}
            strokeWidth={1}
            strokeDasharray="5 5"
            label={{
              value: "KO Barrier",
              position: "top",
              fill: isBloomberg ? "#ff3d3d" : "#EF4444",
              fontSize: 12,
            }}
          />
        );
      }
    } else if (selectedStrategy === "putKI" && data.length > 0) {
      // Add KI barrier line
      if (data[0]["KI Barrier"]) {
        referenceLines.push(
          <ReferenceLine
            key="ki-barrier"
            x={data[0]["KI Barrier"]}
            stroke={isBloomberg ? "#00ba3f" : "#10B981"}
            strokeWidth={1}
            strokeDasharray="5 5"
            label={{
              value: "KI Barrier",
              position: "top",
              fill: isBloomberg ? "#00ba3f" : "#10B981",
              fontSize: 12,
            }}
          />
        );
      }
    } else if (selectedStrategy === "callPutKI_KO" && data.length > 0) {
      // Add Upper and Lower barrier lines
      if (data[0]["Upper Barrier (KO)"]) {
        referenceLines.push(
          <ReferenceLine
            key="upper-barrier"
            x={data[0]["Upper Barrier (KO)"]}
            stroke={isBloomberg ? "#ff3d3d" : "#EF4444"}
            strokeWidth={1}
            strokeDasharray="5 5"
            label={{
              value: "Upper KO",
              position: "top",
              fill: isBloomberg ? "#ff3d3d" : "#EF4444",
              fontSize: 12,
            }}
          />
        );
      }
      
      if (data[0]["Lower Barrier (KI)"]) {
        referenceLines.push(
          <ReferenceLine
            key="lower-barrier"
            x={data[0]["Lower Barrier (KI)"]}
            stroke={isBloomberg ? "#00ba3f" : "#10B981"}
            strokeWidth={1}
            strokeDasharray="5 5"
            label={{
              value: "Lower KI",
              position: "bottom",
              fill: isBloomberg ? "#00ba3f" : "#10B981",
              fontSize: 12,
            }}
          />
        );
      }
    }

    return { lines, referenceLines };
  };

  const { lines, referenceLines } = getChartConfig();

  const chartData = data?.length > 0 ? data : [];

  // Simplifier l'affichage des nominaux dans le graphe
  const renderNotionalReferences = () => {
    if (!showNotional || !notional || !notionalQuote) return null;

    return (
      <>
        <ReferenceLine
          y={spot}
          stroke={isBloomberg ? "#00ba3f" : "#82ca9d"}
          strokeDasharray="3 3"
          label={{
            value: `Notional: ${notional.toLocaleString()} ${baseCurrency} / ${notionalQuote.toLocaleString()} ${quoteCurrency}`,
            position: 'insideTopRight',
            fill: isBloomberg ? "#00ba3f" : "#82ca9d"
          }}
        />
      </>
    );
  };

  return (
    <GlassContainer className={cn(
      "p-0 overflow-hidden mt-6",
      isBloomberg && "border border-[#444444] rounded-none"
    )}>
      <div className={cn(
        "p-4 border-b", 
        !isBloomberg && "border-border",
        isBloomberg && "border-[#444444] bg-[#222222]"
      )}>
        <h3 className={cn(
          "text-lg font-medium",
          isBloomberg && "text-[#ff9e00]"
        )}>
          Payoff Profile
        </h3>
        <p className={cn(
          "text-sm",
          !isBloomberg && "text-muted-foreground",
          isBloomberg && "text-[#cccccc]"
        )}>
          Visualize how the {selectedStrategy} strategy performs across different exchange rates
          {shouldIncludePremium ? " (with premium included)" : " (without premium)"}
        </p>
      </div>
      <div className="p-4" style={{ height: "400px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              opacity={0.2} 
              stroke={isBloomberg ? "#444444" : undefined}
            />
            <XAxis
              dataKey="spot"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) => value.toFixed(2)}
              label={{
                value: "Exchange Rate",
                position: "insideBottom",
                offset: -5,
                fill: isBloomberg ? "#cccccc" : undefined
              }}
              stroke={isBloomberg ? "#cccccc" : undefined}
            />
            <YAxis
              tickFormatter={(value) => value.toFixed(2)}
              domain={["dataMin - 0.05", "dataMax + 0.05"]}
              stroke={isBloomberg ? "#cccccc" : undefined}
            />
            <Tooltip content={
              <CustomTooltip 
              showNotional={showNotional}
              notional={notional}
              baseCurrency={baseCurrency}
              quoteCurrency={quoteCurrency}
              />
            } />
            <Legend 
              verticalAlign="top" 
              height={36} 
              wrapperStyle={{ color: isBloomberg ? "#cccccc" : undefined }}
            />
            {lines}
            {referenceLines}
            {showNotional && renderNotionalReferences()}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlassContainer>
  );
};

export default PayoffChart;
