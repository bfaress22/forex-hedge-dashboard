import React, { useEffect } from "react";
import { OPTION_TYPES, STRIKE_TYPES } from "@/utils/forexData";
import { Trash } from "lucide-react";

interface CustomStrategyOptionProps {
  index: number;
  optionData: OptionComponent;
  spot: number;
  onUpdate: (index: number, data: Partial<OptionComponent>) => void;
  onDelete: (index: number) => void;
}

export interface OptionComponent {
  type: string;
  strike: number;
  strikeType: "percent" | "absolute";
  upperBarrier?: number;
  upperBarrierType?: "percent" | "absolute";
  lowerBarrier?: number;
  lowerBarrierType?: "percent" | "absolute";
  volatility: number;
  quantity: number;
}

const CustomStrategyOption: React.FC<CustomStrategyOptionProps> = ({
  index,
  optionData,
  spot,
  onUpdate,
  onDelete,
}) => {
  const needsBarrier = optionData.type.includes("KO") || optionData.type.includes("KI");
  const needsDoubleBarrier = optionData.type.includes("DKO") || optionData.type.includes("DKI");

  // Helper function to calculate actual strike based on type
  const calculateActualValue = (value: number, type: "percent" | "absolute") => {
    if (type === "percent") {
      return spot * (value / 100);
    }
    return value;
  };

  // Helper to get display value
  const getDisplayValue = (value: number, type: "percent" | "absolute") => {
    if (type === "percent") {
      return `${value}% (${(spot * value / 100).toFixed(4)})`;
    }
    return value.toString();
  };

  // Initialize barriers when option type changes
  useEffect(() => {
    const updates: Partial<OptionComponent> = {};
    
    // If this option needs a barrier but doesn't have one, add it
    if (needsBarrier && !optionData.upperBarrier) {
      const isCall = optionData.type.includes("call");
      updates.upperBarrier = isCall ? 110 : 90;
      updates.upperBarrierType = "percent";
    }
    
    // If this option needs two barriers but doesn't have the lower one, add it
    if (needsDoubleBarrier && !optionData.lowerBarrier) {
      const isCall = optionData.type.includes("call");
      updates.lowerBarrier = isCall ? 90 : 110;
      updates.lowerBarrierType = "percent";
    }
    
    // If this option no longer needs barriers, remove them
    if (!needsBarrier && optionData.upperBarrier !== undefined) {
      updates.upperBarrier = undefined;
      updates.upperBarrierType = undefined;
    }
    
    if (!needsDoubleBarrier && optionData.lowerBarrier !== undefined) {
      updates.lowerBarrier = undefined;
      updates.lowerBarrierType = undefined;
    }
    
    // Apply updates if needed
    if (Object.keys(updates).length > 0) {
      onUpdate(index, updates);
    }
  }, [optionData.type, needsBarrier, needsDoubleBarrier]);

  return (
    <div className="bg-muted/30 p-4 rounded-lg mb-4">
      <div className="grid grid-cols-5 gap-4">
        {/* Option Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            className="input-field w-full"
            value={optionData.type}
            onChange={(e) => onUpdate(index, { type: e.target.value })}
          >
            {Object.entries(OPTION_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Strike */}
        <div>
          <label className="block text-sm font-medium mb-1">Strike</label>
          <div className="flex space-x-2">
            <input
              type="number"
              className="input-field w-2/3"
              value={optionData.strike}
              onChange={(e) => onUpdate(index, { strike: parseFloat(e.target.value) })}
              step="0.01"
            />
            <select
              className="input-field w-1/3"
              value={optionData.strikeType}
              onChange={(e) => onUpdate(index, { strikeType: e.target.value as "percent" | "absolute" })}
            >
              {STRIKE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.value === "percent" ? "%" : "#"}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Actual value: {calculateActualValue(optionData.strike, optionData.strikeType).toFixed(4)}
          </div>
        </div>

        {/* Upper Barrier (for KO, KI, etc.) */}
        {needsBarrier && (
          <div>
            <label className="block text-sm font-medium mb-1">
              {needsDoubleBarrier ? "Upper Barrier" : "Barrier"}
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                className="input-field w-2/3"
                value={optionData.upperBarrier || (optionData.type.includes("call") ? 110 : 90)}
                onChange={(e) => onUpdate(index, { upperBarrier: parseFloat(e.target.value) })}
                step="0.01"
              />
              <select
                className="input-field w-1/3"
                value={optionData.upperBarrierType || "percent"}
                onChange={(e) =>
                  onUpdate(index, { upperBarrierType: e.target.value as "percent" | "absolute" })
                }
              >
                {STRIKE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.value === "percent" ? "%" : "#"}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Actual value: {calculateActualValue(
                optionData.upperBarrier || (optionData.type.includes("call") ? 110 : 90),
                optionData.upperBarrierType || "percent"
              ).toFixed(4)}
            </div>
          </div>
        )}

        {/* Lower Barrier (for DKO, DKI) */}
        {needsDoubleBarrier && (
          <div>
            <label className="block text-sm font-medium mb-1">Lower Barrier</label>
            <div className="flex space-x-2">
              <input
                type="number"
                className="input-field w-2/3"
                value={optionData.lowerBarrier || (optionData.type.includes("call") ? 90 : 110)}
                onChange={(e) => onUpdate(index, { lowerBarrier: parseFloat(e.target.value) })}
                step="0.01"
              />
              <select
                className="input-field w-1/3"
                value={optionData.lowerBarrierType || "percent"}
                onChange={(e) =>
                  onUpdate(index, { lowerBarrierType: e.target.value as "percent" | "absolute" })
                }
              >
                {STRIKE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.value === "percent" ? "%" : "#"}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Actual value: {calculateActualValue(
                optionData.lowerBarrier || (optionData.type.includes("call") ? 90 : 110),
                optionData.lowerBarrierType || "percent"
              ).toFixed(4)}
            </div>
          </div>
        )}

        {/* Volatility */}
        <div>
          <label className="block text-sm font-medium mb-1">Volatility (%)</label>
          <input
            type="number"
            className="input-field w-full"
            value={optionData.volatility}
            onChange={(e) => onUpdate(index, { volatility: parseFloat(e.target.value) })}
            step="0.1"
            min="0"
            max="100"
          />
        </div>

        {/* Quantity */}
        <div className="relative">
          <label className="block text-sm font-medium mb-1">Quantity (%)</label>
          <div className="flex items-center">
            <input
              type="number"
              className="input-field w-full"
              value={optionData.quantity}
              onChange={(e) => onUpdate(index, { quantity: parseFloat(e.target.value) })}
              step="1"
              min="0"
              max="100"
            />
            <button
              onClick={() => onDelete(index)}
              className="absolute right-0 top-8 p-2 text-destructive hover:text-destructive/80 transition-colors"
              title="Delete this option"
            >
              <Trash size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomStrategyOption;
