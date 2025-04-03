import React, { useState } from 'react';
import {
    PriceRange, 
    StrategyComponent, 
    RiskMatrixResult, 
    ForexParams 
} from '@/pages/Index'; // Import necessary types
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Define Props interface
interface Props {
  priceRanges: PriceRange[];
  setPriceRanges: React.Dispatch<React.SetStateAction<PriceRange[]>>;
  matrixStrategies: { components: StrategyComponent[]; coverageRatio: number; name: string }[];
  setMatrixStrategies: React.Dispatch<React.SetStateAction<{ components: StrategyComponent[]; coverageRatio: number; name: string }[]>>;
  riskMatrixResults: RiskMatrixResult[];
  setRiskMatrixResults: React.Dispatch<React.SetStateAction<RiskMatrixResult[]>>;
  params: ForexParams;
  mainStrategy: StrategyComponent[];
  calculateOptionPrice: (
    type: 'call' | 'put',
    S: number, K: number, r_d: number, r_f: number, t: number, sigma: number
  ) => number;
  calculateBarrierPayoff: (
    instrument: StrategyComponent,
    realRate: number,
    basePayoff: number,
    initialSpotRate: number
  ) => number;
  initialSpotRate: number;
}

const RiskMatrixGenerator: React.FC<Props> = ({
    priceRanges,
    setPriceRanges,
    matrixStrategies,
    setMatrixStrategies,
    riskMatrixResults,
    setRiskMatrixResults,
    params,
    mainStrategy,
    calculateOptionPrice,
    calculateBarrierPayoff,
    initialSpotRate
}) => {
  const [probabilityError, setProbabilityError] = useState<string | null>(null);

  // --- Price Range Handlers ---
  const handlePriceRangeChange = (index: number, field: keyof PriceRange, value: string) => {
    const newValue = Number(value);
    const updatedRanges = priceRanges.map((range, i) =>
      i === index ? { ...range, [field]: newValue } : range
    );
    setPriceRanges(updatedRanges);
    validateProbabilities(updatedRanges);
  };

  const addPriceRange = () => {
    const newRanges = [...priceRanges, { min: 0, max: 0, probability: 0 }];
    setPriceRanges(newRanges);
    validateProbabilities(newRanges);
  };

  const removePriceRange = (index: number) => {
    const newRanges = priceRanges.filter((_, i) => i !== index);
    setPriceRanges(newRanges);
    validateProbabilities(newRanges);
  };

  const validateProbabilities = (ranges: PriceRange[]) => {
    const totalProbability = ranges.reduce((sum, range) => sum + (range.probability || 0), 0);
    if (Math.abs(totalProbability - 100) > 0.01 && ranges.length > 0) { // Allow for small float inaccuracies
      setProbabilityError(`Probabilities sum to ${totalProbability.toFixed(2)}%, must sum to 100%.`);
    } else {
      setProbabilityError(null);
    }
  };

  // --- Matrix Strategy Handlers ---
   const addMatrixStrategy = () => {
       // Add the current strategy from the main tab as a new entry
       setMatrixStrategies(prev => [
           ...prev,
           {
               components: JSON.parse(JSON.stringify(mainStrategy)), // Deep copy
               coverageRatio: 100, // Default coverage
               name: `Strategy ${prev.length + 1}` // Default name
           }
       ]);
   };

   const removeMatrixStrategy = (index: number) => {
       setMatrixStrategies(prev => prev.filter((_, i) => i !== index));
   };

   const updateMatrixStrategyName = (index: number, name: string) => {
       setMatrixStrategies(prev => prev.map((strat, i) =>
           i === index ? { ...strat, name } : strat
       ));
   };

   const updateMatrixStrategyCoverage = (index: number, coverage: string) => {
       setMatrixStrategies(prev => prev.map((strat, i) =>
           i === index ? { ...strat, coverageRatio: Number(coverage) } : strat
       ));
   };


  // --- Calculation ---
  const generateMatrixResults = () => {
    console.log("Generating Risk Matrix...");
    console.log("Price Ranges:", priceRanges);
    console.log("Matrix Strategies:", matrixStrategies);

    if (probabilityError) {
        alert("Please fix probability errors before generating the matrix.");
        return;
    }
    if(matrixStrategies.length === 0) {
         alert("Please add at least one strategy to compare.");
        return;
    }
     if(priceRanges.length === 0) {
         alert("Please define at least one price range.");
        return;
    }

    // --- Start Calculation Logic ---
    const results: RiskMatrixResult[] = [];
    const t = params.monthsToHedge > 0 ? params.monthsToHedge / 12 : 1 / 12; // Time to maturity in years (default 1 month if 0)
    const r_d = params.domesticRate / 100;
    const r_f = params.foreignRate / 100;
    const S = initialSpotRate; // Use the initial spot rate for premium calculation

    matrixStrategies.forEach((strategy, stratIndex) => {
        let totalPremiumPerUnitVolume = 0;
        const hedgeCoverageFactor = strategy.coverageRatio / 100;

        // 1. Calculate Total Premium for the strategy (per unit of total volume)
        strategy.components.forEach(component => {
            const strikeRate = component.strikeType === 'percent'
                ? S * (component.strike / 100)
                : component.strike;
            let componentPremium = 0;

            if (component.type === 'call' || component.type === 'put') {
                 // Using Garman-Kohlhagen for simplicity in the matrix
                 componentPremium = calculateOptionPrice(
                    component.type,
                    S,
                    strikeRate,
                    r_d,
                    r_f,
                    t,
                    component.volatility / 100
                );
            } else if (component.type.includes('knock')) {
                 // Approximation: Use plain vanilla price for cost estimate in matrix.
                 // Accurate barrier pricing might require MC simulation per scenario, potentially slow.
                 componentPremium = calculateOptionPrice(
                    component.type.includes('call') ? 'call' : 'put',
                    S,
                    strikeRate,
                    r_d,
                    r_f,
                    t,
                    component.volatility / 100
                );
            }
            // component.quantity is the % of the HEDGED amount this component covers
            // totalPremiumPerUnitVolume needs to be scaled by hedgeCoverageFactor later
            totalPremiumPerUnitVolume += (isNaN(componentPremium) ? 0 : componentPremium) * (component.quantity / 100);
        });

        // Scale premium by the overall hedge coverage ratio to get cost per unit of TOTAL volume
        totalPremiumPerUnitVolume *= hedgeCoverageFactor;

        const rangeResults: { [rangeKey: string]: number } = {}; // Store Effective Rate per range
        let expectedPnlVsUnhedged = 0;
        let expectedEffectiveRate = 0;

        // 2. Calculate Payoff and P&L for each Price Range
        priceRanges.forEach((range, rangeIndex) => {
            const realizedRate = (range.min + range.max) / 2; // Use midpoint as representative rate
            const probability = range.probability / 100;
            let totalPayoffPerUnitVolume = 0;

            strategy.components.forEach(component => {
                const strikeRate = component.strikeType === 'percent'
                    ? S * (component.strike / 100) // Use initial spot for strike calc
                    : component.strike;

                let payoffAtRate = 0;
                if (component.type === 'forward') {
                    payoffAtRate = strikeRate - realizedRate;
                } else if (component.type === 'call') {
                    payoffAtRate = Math.max(0, realizedRate - strikeRate);
                } else if (component.type === 'put') {
                    payoffAtRate = Math.max(0, strikeRate - realizedRate);
                } else if (component.type.includes('knock')) {
                    const isCall = component.type.includes('call');
                    const basePayoff = isCall ? Math.max(0, realizedRate - strikeRate) : Math.max(0, strikeRate - realizedRate);
                    // Use calculateBarrierPayoff for knock-in/out evaluation at the realized rate
                    payoffAtRate = calculateBarrierPayoff(component, realizedRate, basePayoff, S);
                }
                 // Scale by component quantity and add to total payoff (per unit of HEDGED volume)
                 totalPayoffPerUnitVolume += (isNaN(payoffAtRate) ? 0 : payoffAtRate) * (component.quantity / 100);
            });

            // Scale payoff by the overall hedge coverage ratio (per unit of TOTAL volume)
            totalPayoffPerUnitVolume *= hedgeCoverageFactor;

            // Calculate P&L vs Unhedged (per unit of TOTAL volume)
            const pnlVsUnhedgedPerUnit = totalPayoffPerUnitVolume - totalPremiumPerUnitVolume;

            // Calculate Effective Rate
            // Hedged Revenue = Unhedged Revenue + Payoff - Premium
            // Hedged Revenue = (Total Volume * Realized Rate) + (Total Volume * Payoff/Unit) - (Total Volume * Premium/Unit)
            // Effective Rate = Hedged Revenue / Total Volume
            // Effective Rate = Realized Rate + Payoff/Unit - Premium/Unit = Realized Rate + pnlVsUnhedgedPerUnit
            const effectiveRate = realizedRate + pnlVsUnhedgedPerUnit;

            const rangeKey = `range_${rangeIndex}`; // Use index as key
            rangeResults[rangeKey] = effectiveRate;

            // Accumulate expected values
            expectedPnlVsUnhedged += pnlVsUnhedgedPerUnit * probability;
            expectedEffectiveRate += effectiveRate * probability;
        });

        // 3. Store results for this strategy
        results.push({
            name: strategy.name,
            coverageRatio: strategy.coverageRatio,
            hedgingCost: expectedPnlVsUnhedged, // Storing Expected P&L vs Unhedged here
            costs: { totalPremium: totalPremiumPerUnitVolume }, // Store premium per unit volume
            differences: rangeResults, // Store effective rate for each range
            strategy: strategy.components // Add the strategy components
        });
    });

    // --- End Calculation Logic ---

    console.log("Calculated Risk Matrix Results:", results);
    setRiskMatrixResults(results);
    // alert("Risk Matrix generation logic needs to be implemented."); // Remove alert
  };

  return (
    <div className="space-y-6 p-4">
      {/* Price Range Configuration */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Price Range Scenarios</CardTitle>
            <Button onClick={addPriceRange} size="sm" variant="outline" className="flex items-center gap-1">
              <Plus size={16} /> Add Range
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {priceRanges.map((range, index) => (
            <div key={index} className="grid grid-cols-7 gap-3 items-center">
              <Label className="col-span-1 text-sm text-right">Range {index + 1}</Label>
              <div className="col-span-2">
                <Label htmlFor={`range-${index}-min`} className="text-xs">Min Rate</Label>
                <Input
                  id={`range-${index}-min`}
                  type="number"
                  value={range.min}
                  onChange={(e) => handlePriceRangeChange(index, 'min', e.target.value)}
                  step="0.0001"
                  className="text-sm h-8"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor={`range-${index}-max`} className="text-xs">Max Rate</Label>
                <Input
                  id={`range-${index}-max`}
                  type="number"
                  value={range.max}
                  onChange={(e) => handlePriceRangeChange(index, 'max', e.target.value)}
                  step="0.0001"
                  className="text-sm h-8"
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor={`range-${index}-prob`} className="text-xs">Probability (%)</Label>
                <Input
                  id={`range-${index}-prob`}
                  type="number"
                  value={range.probability}
                  onChange={(e) => handlePriceRangeChange(index, 'probability', e.target.value)}
                  step="0.1"
                  className="text-sm h-8"
                />
              </div>
              <div className="col-span-1 flex justify-end items-end h-full">
                <Button variant="ghost" size="icon" onClick={() => removePriceRange(index)} className="h-8 w-8 text-destructive hover:text-destructive/80">
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
          {probabilityError && <p className="text-sm text-destructive mt-2">{probabilityError}</p>}
        </CardContent>
      </Card>

      {/* Strategy Comparison Configuration */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Strategies to Compare</CardTitle>
            <Button onClick={addMatrixStrategy} size="sm" variant="outline" className="flex items-center gap-1">
              <Plus size={16} /> Add Current Strategy
            </Button>
          </div>
           <p className="text-sm text-muted-foreground">Add variations of your main strategy (or different strategies) to compare their performance across scenarios.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {matrixStrategies.length === 0 && <p className="text-sm text-muted-foreground">No strategies added for comparison yet.</p>}
          {matrixStrategies.map((strat, index) => (
            <div key={index} className="grid grid-cols-7 gap-3 items-center border p-3 rounded">
              <div className="col-span-3">
                  <Label htmlFor={`strat-${index}-name`} className="text-xs">Strategy Name</Label>
                  <Input
                      id={`strat-${index}-name`}
                      type="text"
                      value={strat.name}
                      onChange={(e) => updateMatrixStrategyName(index, e.target.value)}
                      className="text-sm h-8"
                  />
              </div>
               <div className="col-span-2">
                  <Label htmlFor={`strat-${index}-coverage`} className="text-xs">Coverage Ratio (%)</Label>
                  <Input
                      id={`strat-${index}-coverage`}
                      type="number"
                      value={strat.coverageRatio}
                      onChange={(e) => updateMatrixStrategyCoverage(index, e.target.value)}
                      min="0"
                      max="100" // Or higher if over-hedging is allowed
                      step="1"
                      className="text-sm h-8"
                  />
              </div>
               <div className="col-span-1">
                    <p className="text-xs text-muted-foreground">Components</p>
                    <p className="text-sm font-medium">{strat.components.length}</p>
               </div>
              <div className="col-span-1 flex justify-end items-center h-full">
                <Button variant="ghost" size="icon" onClick={() => removeMatrixStrategy(index)} className="h-8 w-8 text-destructive hover:text-destructive/80">
                  <Trash2 size={16} />
                </Button>
              </div>
               {/* TODO: Add button/modal to view/edit components for this strategy? */}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Button onClick={generateMatrixResults} className="w-full" disabled={!!probabilityError || matrixStrategies.length === 0 || priceRanges.length === 0}>
        Generate Risk Matrix
      </Button>

      {/* Results Display Area */}
      {riskMatrixResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Matrix Results</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto"> {/* Allow horizontal scroll on small screens */}
             <Table className="min-w-full"> {/* Ensure table takes minimum full width */}
              <TableHeader>
                 <TableRow>
                   <TableHead>Strategy Name</TableHead>
                   <TableHead className="text-right">Coverage (%)</TableHead>
                   <TableHead className="text-right">Premium / Unit</TableHead>
                   <TableHead className="text-right">Expected P&L / Unit</TableHead>
                   {priceRanges.map((range, index) => (
                     <TableHead key={`head-range-${index}`} className="text-right whitespace-nowrap">
                       Range {index + 1} <br/> ({range.min.toFixed(4)} - {range.max.toFixed(4)}) <br/> Eff. Rate
                     </TableHead>
                   ))}
                 </TableRow>
              </TableHeader>
              <TableBody>
                {riskMatrixResults.map((result, stratIndex) => (
                  <TableRow key={`result-strat-${stratIndex}`}>
                    <TableCell className="font-medium">{result.name}</TableCell>
                    <TableCell className="text-right">{result.coverageRatio.toFixed(0)}%</TableCell>
                    <TableCell className="text-right">{result.costs.totalPremium?.toFixed(5) ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">{result.hedgingCost?.toFixed(5) ?? 'N/A'}</TableCell>
                    {priceRanges.map((_, rangeIndex) => (
                       <TableCell key={`result-strat-${stratIndex}-range-${rangeIndex}`} className="text-right">
                         {result.differences[`range_${rangeIndex}`]?.toFixed(4) ?? 'N/A'}
                       </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
       {/* Add fallback content if no results */}
        {riskMatrixResults.length === 0 && (
             <div className="p-4 border border-dashed border-border rounded-lg text-center text-muted-foreground min-h-[100px] flex items-center justify-center">
                <p>Generate the matrix to see results.</p>
             </div>
        )}
    </div>
  );
};

export default RiskMatrixGenerator; 