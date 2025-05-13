import React, { useState } from 'react';
import { ForexStressTestScenario, ForexResult } from '@/pages/Index'; // Import the interface
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils"; // Import cn for conditional classes
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ValueDisplay } from '@/components/ui/layout';
import PayoffChart from '@/components/PayoffChart';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ReferenceLine, ResponsiveContainer 
} from 'recharts';
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme-provider";

// Define the Props interface
interface Props {
  scenarios: Record<string, ForexStressTestScenario>;
  customScenario: ForexStressTestScenario;
  updateScenario: (key: string, field: keyof ForexStressTestScenario, value: any) => void;
  applyScenario: (key: string) => void;
  activeScenarioKey: string | null; // Allow null
  
  // For displaying results
  results: ForexResult[];
  yearlySummaryStats?: Record<string, any>;
  totalSummaryStats?: any;
  payoffData?: Array<{ rate: number; payoff: number }>;
  baseCurrency?: string;
  quoteCurrency?: string;
  selectedStrategy?: string;
  initialSpotRate?: number;
  includePremium?: boolean;
  realRateParams?: any;
  useImpliedVolatility?: boolean;
  usePremiumOverride?: boolean;
  handleRateChange?: (index: number, field: 'forwardRate' | 'realRate' | 'impliedVolatility' | 'strategyPrice', value: string) => void;
  monteCarloPaths?: number[][];
  showNotional?: boolean;
  baseNotional?: number;
  quoteNotional?: number;
}

// Tooltip Help Content
const tooltipContent = {
  volatility: "Volatility measures the magnitude of exchange rate price variations. Higher volatility indicates larger price movements in both directions.",
  rateShock: "Rate shock represents a sudden and significant movement in the exchange rate. A positive shock means appreciation, negative means depreciation.",
  rateDifferential: "Rate differential shock represents a change in the gap between domestic and foreign interest rates. Affects forward rates and option prices via interest rate parity.",
  forwardPointsShock: "Forward points shock directly affects forward rates without changing the spot rate."
};

const StressTesting: React.FC<Props> = ({ // Update component to use props
    scenarios,
    customScenario,
    updateScenario,
    applyScenario,
    activeScenarioKey,
    results = [],
    yearlySummaryStats = {},
    totalSummaryStats = {},
    payoffData = [],
    baseCurrency = "Base",
    quoteCurrency = "Quote",
    selectedStrategy = "",
    initialSpotRate = 0,
    includePremium = true,
    realRateParams = { useSimulation: false },
    useImpliedVolatility = false,
    usePremiumOverride = false,
    handleRateChange = () => {},
    monteCarloPaths = [],
    showNotional = false,
    baseNotional = 0,
    quoteNotional = 0
}) => {
  const { isBloomberg } = useTheme();

  // Combine default scenarios and the custom one for mapping
  const allScenarios = {
    ...scenarios,
    custom: customScenario
  };

  // Track which scenario is expanded in the UI
  const [expandedScenario, setExpandedScenario] = useState<string | null>(activeScenarioKey);
  
  // Financial validation
  const validateScenarioParams = (scenario: ForexStressTestScenario) => {
    // Volatility should typically be between 1% and 100%
    if (scenario.volatility < 0 || scenario.volatility > 1) {
      return "Volatility should be between 0 and 1 (0-100%)";
    }
    
    // Rate shocks are typically within -30% to +30% in extreme cases
    if (Math.abs(scenario.rateShock) > 0.3) {
      return "Rate shock might be extreme (>30%)";
    }
    
    // Rate differential shocks are typically within -500bps to +500bps
    if (scenario.rateDifferentialShock && Math.abs(scenario.rateDifferentialShock) > 0.05) {
      return "Rate differential shock might be extreme (>500bps)";
    }
    
    return null;
  };
  
  // Toggle expanded state for a scenario
  const toggleExpand = (key: string) => {
    setExpandedScenario(expandedScenario === key ? null : key);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-2">Stress Test Scenarios</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(allScenarios).map(([key, scenario]) => {
          const isActive = activeScenarioKey === key;
          const isExpanded = expandedScenario === key;
          const isEditable = scenario.isEditable || scenario.isCustom;
          const validationWarning = validateScenarioParams(scenario);

          // Helper function for input change
          const handleInputChange = (field: keyof ForexStressTestScenario, value: string) => {
            let parsedValue = parseFloat(value);
            
            // Convert percentages to decimal
            if (field === 'volatility') {
              parsedValue = parsedValue / 100;
            } else if (field === 'rateShock') {
              parsedValue = parsedValue / 100;
            } else if (field === 'rateDifferentialShock') {
              parsedValue = parsedValue / 10000; // Convert from basis points to decimal
            }
            
            updateScenario(key, field, parsedValue.toString());
          };

          return (
            <Card 
              key={key} 
              className={cn(
                "flex flex-col transition-all", 
                isActive ? "border-primary shadow-lg" : "",
                isExpanded ? "bg-muted/10" : "",
                isBloomberg && "rounded-none border-[#444444] bg-black"
              )}
            >
              <div 
                className={cn(
                  "flex items-center justify-between px-4 py-3 cursor-pointer",
                  isBloomberg && "bg-[#222222]"
                )}
                onClick={() => toggleExpand(key)}
              >
                <span className={cn(
                  "font-medium",
                  isBloomberg && "text-[#ff9e00]"
                )}>{scenario.name}</span>
                {isExpanded ? <ChevronUp size={16} className={isBloomberg ? "text-[#cccccc]" : ""} /> : <ChevronDown size={16} className={isBloomberg ? "text-[#cccccc]" : ""} />}
              </div>
              
              {isExpanded && (
                <>
                  <CardContent className={cn(
                    "pt-0 px-4 pb-2 space-y-3",
                    isBloomberg && "text-[#ff9e00]"
                  )}>
                    {scenario.description && (
                      <p className={cn(
                        "text-xs",
                        !isBloomberg && "text-muted-foreground",
                        isBloomberg && "text-[#cccccc]"
                      )}>{scenario.description}</p>
                    )}
                    
                    <p className={cn(
                      "text-xs",
                      !isBloomberg && "text-blue-600",
                      isBloomberg && "text-[#0072ff]"
                    )}>
                      Note: Les chocs de taux et différentiels seront appliqués progressivement au fil du temps, atteignant 
                      leur plein effet à partir du 6ème mois pour simuler un scénario réaliste.
                    </p>
                    
                    {validationWarning && (
                      <p className={cn(
                        "text-xs",
                        !isBloomberg && "text-amber-500",
                        isBloomberg && "text-[#f59e0b]"
                      )}>Note: {validationWarning}</p>
                    )}
                    
                    {isEditable ? (
                      <>
                        <div>
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`${key}-vol`} className="text-xs">Volatility (%)</Label>
                            <TooltipProvider>
                              <TooltipUI>
                                <TooltipTrigger>
                                  <HelpCircle size={14} className={isBloomberg ? "text-[#cccccc]" : "text-muted-foreground"} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">{tooltipContent.volatility}</p>
                                </TooltipContent>
                              </TooltipUI>
                            </TooltipProvider>
                          </div>
                          <Input 
                            id={`${key}-vol`}
                            type="number"
                            value={scenario.volatility * 100}
                            onChange={(e) => handleInputChange('volatility', e.target.value)}
                            step="0.1"
                            className={cn(
                              "h-8 text-sm mt-1",
                              isBloomberg && "bg-[#111111] border-[#444444] text-[#ff9e00]"
                            )}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`${key}-rateShock`} className="text-xs">Rate Shock (%)</Label>
                            <TooltipProvider>
                              <TooltipUI>
                                <TooltipTrigger>
                                  <HelpCircle size={14} className={isBloomberg ? "text-[#cccccc]" : "text-muted-foreground"} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">{tooltipContent.rateShock}</p>
                                </TooltipContent>
                              </TooltipUI>
                            </TooltipProvider>
                          </div>
                          <Input 
                            id={`${key}-rateShock`}
                            type="number" 
                            value={scenario.rateShock * 100}
                            onChange={(e) => handleInputChange('rateShock', e.target.value)}
                            step="0.1"
                            className={cn(
                              "h-8 text-sm mt-1",
                              isBloomberg && "bg-[#111111] border-[#444444] text-[#ff9e00]"
                            )}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`${key}-diffShock`} className="text-xs">Rate Differential Shock (bps)</Label>
                            <TooltipProvider>
                              <TooltipUI>
                                <TooltipTrigger>
                                  <HelpCircle size={14} className={isBloomberg ? "text-[#cccccc]" : "text-muted-foreground"} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">{tooltipContent.rateDifferential}</p>
                                </TooltipContent>
                              </TooltipUI>
                            </TooltipProvider>
                          </div>
                          <Input 
                            id={`${key}-diffShock`}
                            type="number" 
                            value={(scenario.rateDifferentialShock ?? 0) * 10000}
                            onChange={(e) => handleInputChange('rateDifferentialShock', e.target.value)}
                            step="1"
                            className={cn(
                              "h-8 text-sm mt-1",
                              isBloomberg && "bg-[#111111] border-[#444444] text-[#ff9e00]"
                            )}
                          />
                        </div>
                        {/* Points Forward Shock (optional) */}
                        <div>
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`${key}-fwdPointsShock`} className="text-xs">Forward Points Shock (bps)</Label>
                            <TooltipProvider>
                              <TooltipUI>
                                <TooltipTrigger>
                                  <HelpCircle size={14} className={isBloomberg ? "text-[#cccccc]" : "text-muted-foreground"} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">{tooltipContent.forwardPointsShock}</p>
                                </TooltipContent>
                              </TooltipUI>
                            </TooltipProvider>
                          </div>
                          <Input 
                            id={`${key}-fwdPointsShock`}
                            type="number" 
                            value={(scenario.forwardPointsShock ?? 0) * 10000}
                            onChange={(e) => handleInputChange('forwardPointsShock', e.target.value)}
                            step="1"
                            className={cn(
                              "h-8 text-sm mt-1",
                              isBloomberg && "bg-[#111111] border-[#444444] text-[#ff9e00]"
                            )}
                          />
                        </div>
                      </>
                    ) : (
                      <div className={cn(
                        "text-xs space-y-1 pt-1",
                        !isBloomberg && "text-muted-foreground",
                        isBloomberg && "text-[#cccccc]"
                      )}>
                        <p>Volatility: {(scenario.volatility * 100).toFixed(1)}%</p>
                        <p>Rate Shock: {(scenario.rateShock * 100).toFixed(1)}%</p>
                        <p>Rate Differential Shock: {((scenario.rateDifferentialShock ?? 0) * 10000).toFixed(0)} bps</p>
                        {scenario.forwardPointsShock !== undefined && (
                          <p>Forward Points Shock: {(scenario.forwardPointsShock * 10000).toFixed(0)} bps</p>
                        )}
                      </div>
                    )}
                    
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        applyScenario(key);
                      }} 
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "w-full mt-2",
                        isBloomberg && "bg-[#ff9e00] text-black hover:bg-[#ffb340] rounded-none"
                      )}
                    >
                      {isActive ? "Run Scenario" : "Apply Scenario"}
                    </Button>
                  </CardContent>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Display Results Section (similar to main page) */}
      {results.length > 0 && (
        <div className="results-section space-y-6">
          {/* === Summary Statistics by Year Table === */}
          <Card className={cn(
            "mt-6",
            isBloomberg && "bg-black border-[#444444] rounded-none"
          )}>
            <CardHeader className={isBloomberg ? "bg-[#222222] border-b border-[#444444]" : ""}>
              <CardTitle className={isBloomberg ? "text-[#ff9e00]" : ""}>Summary Statistics by Year</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className={isBloomberg ? "bloomberg-table" : ""}>
                <TableHeader>
                  <TableRow className={isBloomberg ? "bloomberg-row" : ""}>
                    <TableHead className={isBloomberg ? "bloomberg-header" : ""}>Year</TableHead>
                    <TableHead className={cn("text-right", isBloomberg ? "bloomberg-header" : "")}>Total Cost with Hedging ({quoteCurrency})</TableHead>
                    <TableHead className={cn("text-right", isBloomberg ? "bloomberg-header" : "")}>Total Cost without Hedging ({quoteCurrency})</TableHead>
                    <TableHead className={cn("text-right", isBloomberg ? "bloomberg-header" : "")}>Total P&L ({quoteCurrency})</TableHead>
                    <TableHead className={cn("text-right", isBloomberg ? "bloomberg-header" : "")}>Total Strategy Premium ({quoteCurrency})</TableHead>
                    <TableHead className={cn("text-right", isBloomberg ? "bloomberg-header" : "")}>Cost Reduction (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(yearlySummaryStats).sort(([yearA], [yearB]) => yearA.localeCompare(yearB)).map(([year, summary]: [string, any]) => (
                    <TableRow key={year} className={isBloomberg ? "bloomberg-row" : ""}>
                      <TableCell className={cn("font-medium", isBloomberg ? "bloomberg-cell" : "")}>{year}</TableCell>
                      <TableCell className={cn("text-right", isBloomberg ? "bloomberg-cell" : "")}>{summary.totalHedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={cn("text-right", isBloomberg ? "bloomberg-cell" : "")}>{summary.totalUnhedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={cn(
                        "text-right",
                        !isBloomberg && (summary.totalPnlVsUnhedged >= 0 ? 'text-green-600' : 'text-red-600'),
                        isBloomberg && (summary.totalPnlVsUnhedged >= 0 ? 'bloomberg-up' : 'bloomberg-down'),
                        isBloomberg && "bloomberg-cell"
                      )}>
                        {summary.totalPnlVsUnhedged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={cn("text-right", isBloomberg ? "bloomberg-cell" : "")}>{summary.totalPremiumPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={cn("text-right", isBloomberg ? "bloomberg-cell" : "")}>{summary.costReductionPercent.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* === Detailed Monthly Results Table === */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Monthly Results</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time (yr)</TableHead>
                    <TableHead>Forward Rate</TableHead>
                    <TableHead className={realRateParams?.useSimulation ? "bg-blue-50 font-bold" : ""}>
                      {realRateParams?.useSimulation ? "Simulated Rate" : "Real Rate"}
                    </TableHead>
                    {useImpliedVolatility && (
                      <TableHead className="bg-green-50 font-bold">
                        Implied Vol (%)
                      </TableHead>
                    )}
                    <TableHead className={usePremiumOverride ? "bg-orange-50 font-bold text-right" : "text-right"}>
                      Premium/Unit
                    </TableHead>
                    <TableHead className="text-right">Payoff/Unit</TableHead>
                    <TableHead className="text-right">Monthly Vol</TableHead>
                    <TableHead className="text-right">Premium Paid</TableHead>
                    <TableHead className="text-right">Hedge Payoff</TableHead>
                    <TableHead className="text-right">Unhedged Rev</TableHead>
                    <TableHead className="text-right">Hedged Rev</TableHead>
                    <TableHead className="text-right">P&L vs Unhedged</TableHead>
                    <TableHead className="text-right">Effective Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.timeToMaturity.toFixed(3)}</TableCell>
                      <TableCell>{row.forwardRate.toFixed(4)}</TableCell>
                      <TableCell className={realRateParams?.useSimulation ? "bg-blue-50 font-medium" : ""}>
                        {row.realRate.toFixed(4)}
                      </TableCell>
                      {useImpliedVolatility && (
                        <TableCell className="bg-green-50 font-medium">
                          {(row.impliedVolatility !== undefined ? row.impliedVolatility : (realRateParams?.volatility || 15)).toFixed(1)}
                        </TableCell>
                      )}
                      <TableCell className={`text-right ${usePremiumOverride ? "bg-orange-50" : ""}`}>
                        {row.strategyPrice.toFixed(5)}
                      </TableCell>
                      <TableCell className="text-right">{row.totalPayoff.toFixed(5)}</TableCell>
                      <TableCell className="text-right">{row.monthlyVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right">{row.premiumPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{row.payoffFromHedge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{row.unhedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{row.hedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`text-right ${row.pnlVsUnhedged >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {row.pnlVsUnhedged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium">{row.effectiveRate.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payoff Chart */}
          {payoffData.length > 0 && initialSpotRate > 0 && (
            <PayoffChart 
              data={payoffData}
              selectedStrategy={selectedStrategy || ""}
              spot={initialSpotRate}
              includePremium={includePremium}
              baseCurrency={baseCurrency}
              quoteCurrency={quoteCurrency}
              showNotional={showNotional}
              notional={baseNotional}
              notionalQuote={quoteNotional}
            />
          )}

          {/* Total Summary Statistics Card */}
          {Object.keys(totalSummaryStats).length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Total Summary Statistics</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ValueDisplay 
                  label="Total Volume Hedged" 
                  value={`${totalSummaryStats.totalVolume?.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${baseCurrency}`} 
                />
                <ValueDisplay 
                  label="Average Realized Rate" 
                  value={totalSummaryStats.averageEffectiveRate?.toFixed(4)} 
                />
                <ValueDisplay 
                  label="Total Premium Paid" 
                  value={totalSummaryStats.totalPremiumPaid?.toLocaleString(undefined, { style: 'currency', currency: quoteCurrency, maximumFractionDigits: 2 })} 
                />
                <ValueDisplay 
                  label="Total Payoff from Hedge" 
                  value={totalSummaryStats.totalPayoffFromHedge?.toLocaleString(undefined, { style: 'currency', currency: quoteCurrency, maximumFractionDigits: 2 })} 
                />
                <ValueDisplay 
                  label="Average P&L vs Unhedged / Unit" 
                  value={totalSummaryStats.averagePnlVsUnhedgedPerUnit?.toFixed(5)} 
                />
                <ValueDisplay 
                  label="Average Effective Rate" 
                  value={totalSummaryStats.averageEffectiveRate?.toFixed(4)} 
                />
                <ValueDisplay 
                  label="Total Hedged Revenue" 
                  value={totalSummaryStats.totalHedgedRevenue?.toLocaleString(undefined, { style: 'currency', currency: quoteCurrency, maximumFractionDigits: 2 })} 
                />
                <ValueDisplay 
                  label="Total Unhedged Revenue" 
                  value={totalSummaryStats.totalUnhedgedRevenue?.toLocaleString(undefined, { style: 'currency', currency: quoteCurrency, maximumFractionDigits: 2 })} 
                />
              </CardContent>
            </Card>
          )}

          {/* Monte Carlo Simulation Paths (if applicable) */}
          {realRateParams?.useSimulation && monteCarloPaths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Monte Carlo Simulation Paths</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Displaying {Math.min(monteCarloPaths.length, 20)} of {monteCarloPaths.length} simulated future exchange rate paths.
                </p>
              </CardHeader>
              <CardContent style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                    <XAxis
                      dataKey="month"
                      type="category"
                      allowDuplicatedCategory={false}
                      ticks={results?.map(r => r.date.substring(0,7)) ?? []} // Show YYYY-MM
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => value.toFixed(3)}
                      width={70}
                    />
                    <Tooltip formatter={(value: number) => value.toFixed(4)}/>
                    <ReferenceLine y={initialSpotRate} label={{ value: `Current Spot (${initialSpotRate.toFixed(4)})`, position: "insideTopRight", fill: "#8884d8", fontSize: 12 }} stroke="#8884d8" strokeDasharray="3 3" />
                    {monteCarloPaths.slice(0, 20).map((path, index) => {
                      // Ensure data format matches expected structure
                      const chartData = path.map((price, stepIndex) => ({
                        month: results?.[stepIndex]?.date.substring(0,7) || `M${stepIndex + 1}`, // Use YYYY-MM from results as key
                        price: price
                      }));
                      return (
                        <Line
                          key={`path-${index}`}
                          data={chartData}
                          type="monotone"
                          dataKey="price"
                          stroke="#8884d8"
                          strokeOpacity={0.4}
                          dot={false}
                          isAnimationActive={false}
                          name={`Sim ${index + 1}`}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {results.length === 0 && (
        <div className={cn(
          "p-6 border border-dashed rounded-lg text-center min-h-[200px] flex items-center justify-center mt-4",
          !isBloomberg && "border-border text-muted-foreground",
          isBloomberg && "border-[#444444] text-[#cccccc]"
        )}>
          <p>Apply a stress test scenario and click "Calculate Hedging Results" to see results here.</p>
        </div>
      )}
    </div>
  );
};

export default StressTesting; 