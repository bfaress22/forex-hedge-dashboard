"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import HedgeCalculator from "@/components/HedgeCalculator";
import { STRATEGIES, FOREX_PAIRS, FOREX_PAIR_CATEGORIES, OPTION_TYPES } from "@/utils/forexData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Save, FileDown, FolderOpen, Trash, AlertCircle, HelpCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ValueDisplay } from '@/components/ui/layout';

// Import the new tab components
import StressTesting from '@/components/hedgeTabs/StressTesting';
import HistoricalBacktest from '@/components/hedgeTabs/HistoricalBacktest';
import RiskMatrixGenerator from '@/components/hedgeTabs/RiskMatrixGenerator';

// Import necessary components and functions
import { calculateBarrierOptionPrice, calculateCustomStrategyPayoff } from '@/utils/barrierOptionCalculations';
import PayoffChart from '@/components/PayoffChart';
import StrategyInfo from '@/components/StrategyInfo';
import CustomStrategyBuilder, { OptionComponent as CustomOptionComponent } from '@/components/CustomStrategyBuilder';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';

// --- Interface Updates ---

export interface ForexStressTestScenario {
  name: string;
  description: string;
  volatility: number;
  rateDifferentialShock?: number;
  rateShock: number;
  forwardPointsShock?: number;
  isCustom?: boolean;
  isEditable?: boolean;
  isHistorical?: boolean;
  historicalData?: HistoricalDataPoint[];
}

export interface HistoricalDataPoint {
  date: string;
  price: number;
}

export interface StrategyComponent {
  type: string;
  strike: number;
  strikeType: 'percent' | 'absolute';
  volatility: number;
  quantity: number;
  barrier?: number;
  barrierType?: 'percent' | 'absolute';
  upperBarrier?: number;
  upperBarrierType?: 'percent' | 'absolute';
  lowerBarrier?: number;
  lowerBarrierType?: 'percent' | 'absolute';
}

export interface ForexResult {
  date: string;
  timeToMaturity: number;
  forwardRate: number;
  realRate: number;
  optionPrices: Array<{
    type: string;
    price: number;
    quantity: number;
    strike: number;
    label: string;
  }>;
  strategyPrice: number;
  totalPayoff: number;
  monthlyVolume: number;
  unhedgedRevenue: number;
  premiumPaid: number;
  payoffFromHedge: number;
  hedgedRevenue: number;
  pnlVsUnhedged: number;
  effectiveRate: number;
}

interface SavedForexScenario {
  id: string;
  name: string;
  timestamp: number;
  params: ForexParams;
  strategy: StrategyComponent[];
  results: ForexResult[];
  payoffData: Array<{ rate: number; payoff: number }>;
  stressTest?: ForexStressTestScenario;
}

export interface PriceRange {
  min: number;
  max: number;
  probability: number;
}

export interface ForexParams {
    startDate: string;
    monthsToHedge: number;
    domesticRate: number;
    foreignRate: number;
    totalVolume: number;
    spotRate: number;
    baseNotional: number;
    quoteNotional: number;
    selectedPair: string;
    selectedStrategy: string;
    strikeUpper?: number;
    strikeLower?: number;
    strikeMid?: number;
    barrierUpper?: number;
    barrierLower?: number;
    optionQuantity?: number;
}

interface RealRateParams {
    useSimulation: boolean;
    volatility: number;
    numSimulations: number;
}

export interface RiskMatrixResult {
  strategy: StrategyComponent[];
  coverageRatio: number;
  costs: {[key: string]: number};
  differences: {[key: string]: number};
  hedgingCost: number;
  name: string;
}

interface SavedRiskMatrix {
  id: string;
  name: string;
  timestamp: number;
  priceRanges: PriceRange[];
  strategies: {
    components: StrategyComponent[];
    coverageRatio: number;
    name: string;
  }[];
  results: RiskMatrixResult[];
}

type ImpliedVolatility = Record<string, number>;

export interface MonthlyStats {
  month: string;
  avgPrice: number;
}

// --- Default Stress Scenarios Update ---

const DEFAULT_FOREX_SCENARIOS: Record<string, ForexStressTestScenario> = {
    base: {
        name: "Base Case", description: "Normal market conditions",
        volatility: 0.10, rateDifferentialShock: 0, rateShock: 0, isEditable: true
    },
    highVol: {
        name: "High Volatility", description: "Increased volatility (+5%)",
        volatility: 0.15, rateDifferentialShock: 0, rateShock: 0, isEditable: true
    },
    rateDepreciation: {
        name: "Foreign Currency Weakens (-5%)", description: "Negative shock to spot rate",
        volatility: 0.12, rateShock: -0.05, rateDifferentialShock: 0, isEditable: true
    },
    rateAppreciation: {
        name: "Foreign Currency Strengthens (+5%)", description: "Positive shock to spot rate",
        volatility: 0.12, rateShock: 0.05, rateDifferentialShock: 0, isEditable: true
    },
    diffWidens: {
        name: "Rate Differential Widens (+100 bps)", description: "Shock increasing (r_d - r_f)",
        volatility: 0, rateShock: 0, rateDifferentialShock: 0.01, isEditable: true
    },
    diffNarrows: {
        name: "Rate Differential Narrows (-100 bps)", description: "Shock decreasing (r_d - r_f)",
        volatility: 0, rateShock: 0, rateDifferentialShock: -0.01, isEditable: true
    },
    custom: {
        name: "Custom Case", description: "User-defined scenario",
        volatility: 0.10, rateShock: 0, isCustom: true
    }
};

const Index = () => {
  // --- State Updates ---
  const [activeTab, setActiveTab] = useState<string>("strategy");
  const [selectedPair, setSelectedPair] = useState<string>("EUR/USD");
  const [selectedStrategy, setSelectedStrategy] = useState<string>('forward');
  const [includePremium, setIncludePremium] = useState(true);
  const [showNotional, setShowNotional] = useState(false);
  const [customStrategyComponents, setCustomStrategyComponents] = useState<CustomOptionComponent[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<SavedForexScenario[]>([]);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [loadedScenarioId, setLoadedScenarioId] = useState<string | null>(null);
  const [saveScenarioName, setSaveScenarioName] = useState<string>("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [initialSpotRate, setInitialSpotRate] = useState<number>(FOREX_PAIRS["EUR/USD"].spot);

  const [params, setParams] = useState<ForexParams>(() => {
    const savedState = localStorage.getItem('forexCalculatorState');
    return savedState ? JSON.parse(savedState).params : {
      startDate: new Date().toISOString().split('T')[0],
      monthsToHedge: 12,
      domesticRate: 1.0,
      foreignRate: 0.5,
      totalVolume: 1000000,
      spotRate: 1.10,
      baseNotional: 1000000,
      quoteNotional: (1000000 * 1.10),
      selectedPair: "EUR/USD",
      selectedStrategy: 'forward',
    };
  });

  const [realRateParams, setRealRateParams] = useState<RealRateParams>({
    useSimulation: false,
    volatility: 15.0, // Increased default from lower value
    numSimulations: 1000, // Increased default from lower value
  });

  const [strategy, setStrategy] = useState<StrategyComponent[]>(() => {
    const savedState = localStorage.getItem('forexCalculatorState');
    return savedState ? JSON.parse(savedState).strategy : [];
  });

  const [results, setResults] = useState<ForexResult[]>(() => {
    const savedState = localStorage.getItem('forexCalculatorState');
    return savedState ? JSON.parse(savedState).results : [];
  });

  const [manualForwards, setManualForwards] = useState<Record<string, number>>(() => {
    const savedState = localStorage.getItem('forexCalculatorState');
    return savedState ? JSON.parse(savedState).manualForwards : {};
  });

  const [manualRealRates, setManualRealRates] = useState<Record<string, number>>(() => {
    const savedState = localStorage.getItem('forexCalculatorState');
    return savedState ? JSON.parse(savedState).manualRealRates : {};
  });

  const [payoffData, setPayoffData] = useState<Array<{ rate: number; payoff: number }>>(() => {
    const savedState = localStorage.getItem('forexCalculatorState');
    return savedState ? JSON.parse(savedState).payoffData : [];
  });

  const [stressTestScenarios, setStressTestScenarios] = useState<Record<string, ForexStressTestScenario>>(() => {
    const savedState = localStorage.getItem('forexCalculatorState');
    return savedState ? JSON.parse(savedState).stressTestScenarios : DEFAULT_FOREX_SCENARIOS;
  });

  const [customStressScenario, setCustomStressScenario] = useState<ForexStressTestScenario>(() => {
    const savedState = localStorage.getItem('forexCalculatorState');
    const defaultCustom: ForexStressTestScenario = {
        name: "Custom Case", description: "User-defined scenario",
        volatility: 0.10, rateShock: 0, isCustom: true
    };
    if (savedState) {
        const saved = JSON.parse(savedState).customScenario;
        return (saved && typeof saved.rateShock === 'number') ? saved : defaultCustom;
    }
    return defaultCustom;
  });

  const [activeStressTestKey, setActiveStressTestKey] = useState<string | null>(null);

  const [useImpliedVol, setUseImpliedVol] = useState(false);
  const [impliedVolatilities, setImpliedVolatilities] = useState<ImpliedVolatility>({});

  const [useCustomOptionPrices, setUseCustomOptionPrices] = useState(false);
  const [customOptionPrices, setCustomOptionPrices] = useState<{[key: string]: {[key: string]: number}}>({});

  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [showHistoricalData, setShowHistoricalData] = useState(true);
  const [showMonthlyStats, setShowMonthlyStats] = useState(true);

  const [priceRanges, setPriceRanges] = useState<PriceRange[]>([
    { min: 1.05, max: 1.08, probability: 25 },
    { min: 1.08, max: 1.12, probability: 50 },
    { min: 1.12, max: 1.15, probability: 25 }
  ]);
  const [matrixStrategies, setMatrixStrategies] = useState<{
    components: StrategyComponent[];
    coverageRatio: number;
    name: string;
  }[]>([]);
  const [riskMatrixResults, setRiskMatrixResults] = useState<RiskMatrixResult[]>([]);

  const [savedRiskMatrices, setSavedRiskMatrices] = useState<SavedRiskMatrix[]>(() => {
    const saved = localStorage.getItem('forexRiskMatrices');
    return saved ? JSON.parse(saved) : [];
  });

  const [customVolumes, setCustomVolumes] = useState<Record<string, number>>({});
  const [monteCarloPaths, setMonteCarloPaths] = useState<number[][]>([]);

  // Add state for original parameters during stress testing
  const [originalParams, setOriginalParams] = useState<ForexParams | null>(null);
  const [originalRealRateParams, setOriginalRealRateParams] = useState<RealRateParams | null>(null);

  // --- Calculations for Summary Statistics ---
  const totalSummaryStats = useMemo(() => {
    if (!results || results.length === 0) {
      return {
        totalPremiumPaid: 0,
        totalPayoffFromHedge: 0,
        totalPnlVsUnhedged: 0,
        averageEffectiveRate: 0,
        totalHedgedRevenue: 0,
        totalUnhedgedRevenue: 0,
        totalVolume: 0,
        averagePnlVsUnhedgedPerUnit: 0,
      };
    }

    const totals = results.reduce(
      (acc, row) => {
        acc.totalPremiumPaid += row.premiumPaid;
        acc.totalPayoffFromHedge += row.payoffFromHedge;
        acc.totalPnlVsUnhedged += row.pnlVsUnhedged;
        acc.totalHedgedRevenue += row.hedgedRevenue;
        acc.totalUnhedgedRevenue += row.unhedgedRevenue;
        acc.weightedEffectiveRateSum += row.effectiveRate * row.monthlyVolume;
        acc.totalVolume += row.monthlyVolume;
        return acc;
      },
      {
        totalPremiumPaid: 0,
        totalPayoffFromHedge: 0,
        totalPnlVsUnhedged: 0,
        totalHedgedRevenue: 0,
        totalUnhedgedRevenue: 0,
        weightedEffectiveRateSum: 0,
        totalVolume: 0,
      }
    );

    const averageEffectiveRate = totals.totalVolume > 0 ? totals.weightedEffectiveRateSum / totals.totalVolume : 0;
    const averagePnlVsUnhedgedPerUnit = totals.totalVolume > 0 ? totals.totalPnlVsUnhedged / totals.totalVolume : 0;

    return {
        totalPremiumPaid: totals.totalPremiumPaid,
        totalPayoffFromHedge: totals.totalPayoffFromHedge,
        totalPnlVsUnhedged: totals.totalPnlVsUnhedged,
        averageEffectiveRate: averageEffectiveRate,
        totalHedgedRevenue: totals.totalHedgedRevenue,
        totalUnhedgedRevenue: totals.totalUnhedgedRevenue,
        totalVolume: totals.totalVolume,
        averagePnlVsUnhedgedPerUnit: averagePnlVsUnhedgedPerUnit,
    };
  }, [results]);

  const yearlySummaryStats = useMemo(() => {
      if (!results || results.length === 0) return {};
      
      // Define the type for the yearly summary including the calculated percentage
      type YearlySummary = {
          totalHedgedRevenue: number;
          totalUnhedgedRevenue: number;
          totalPnlVsUnhedged: number;
          totalPremiumPaid: number;
          totalVolume: number;
          costReductionPercent: number; // Add the calculated property here
      };
      
      const summaries = results.reduce((acc, row) => {
          const year = row.date.split('-')[0];
          if (!acc[year]) {
              acc[year] = {
                  totalHedgedRevenue: 0,
                  totalUnhedgedRevenue: 0,
                  totalPnlVsUnhedged: 0,
                  totalPremiumPaid: 0,
                  totalVolume: 0, // Keep track of volume if needed for averages later
                  costReductionPercent: 0, // Initialize cost reduction percentage
              };
          }
          acc[year].totalHedgedRevenue += row.hedgedRevenue;
          acc[year].totalUnhedgedRevenue += row.unhedgedRevenue;
          acc[year].totalPnlVsUnhedged += row.pnlVsUnhedged;
          acc[year].totalPremiumPaid += row.premiumPaid;
          acc[year].totalVolume += row.monthlyVolume;
          return acc;
      }, {} as Record<string, YearlySummary>); // Use the extended YearlySummary type

      // Calculate cost reduction percentage
      Object.values(summaries).forEach(summary => {
          summary.costReductionPercent = summary.totalUnhedgedRevenue !== 0
              ? ((summary.totalUnhedgedRevenue - summary.totalHedgedRevenue) / summary.totalUnhedgedRevenue) * 100
              : 0;
      });

      return summaries;
  }, [results]);

  // --- Placeholder Functions for Forex Calculations ---

  const calculateOptionPrice_GarmanKohlhagen = (
    type: 'call' | 'put',
    S: number, K: number, r_d: number, r_f: number, t: number, sigma: number
  ): number => {
    const d1 = (Math.log(S/K) + (r_d - r_f + sigma**2/2)*t) / (sigma*Math.sqrt(t) || 0.00001);
    const d2 = d1 - sigma*Math.sqrt(t);

    const Nd1 = (1 + erf(d1/Math.sqrt(2)))/2;
    const Nd2 = (1 + erf(d2/Math.sqrt(2)))/2;

    if (type === 'call') {
      return S*Math.exp(-r_f*t)*Nd1 - K*Math.exp(-r_d*t)*Nd2;
    } else {
      const N_minus_d1 = 1 - Nd1;
      const N_minus_d2 = 1 - Nd2;
      return K*Math.exp(-r_d*t)*N_minus_d2 - S*Math.exp(-r_f*t)*N_minus_d1;
    }
  };

  const generatePricePathsForPeriod_Forex = useCallback((
    months: Date[], startDate: Date, spotRate: number, r_d: number, r_f: number,
    volatility: number, numSimulations: number
  ) => {
    console.log(`Generating ${numSimulations} price paths with volatility ${volatility}, starting from spot ${spotRate}`);
    
    // Step 1: Calculate timePoints for each month (in years)
    const timePoints = months.map(date => {
      const timeDiff = date.getTime() - startDate.getTime();
      return timeDiff / (365.25 * 24 * 60 * 60 * 1000); // Time in years
    });
    console.log("Time points for each month (years):", timePoints);
    
    // Step 2: Calculate total number of time steps (minimum 100 for smooth paths)
    const maxTime = Math.max(...timePoints, 0.1); // At least 0.1 years for short periods
    const numSteps = Math.max(100, Math.ceil(100 * maxTime)); // At least 100 steps
    const dt = maxTime / numSteps;
    const drift = r_d - r_f;
    
    console.log(`Monte Carlo simulation parameters: maxTime=${maxTime}, numSteps=${numSteps}, dt=${dt}, drift=${drift}, volatility=${volatility}`);
    
    // Step 3: Initialize paths with initial spot rate
    const paths: number[][] = [];
    for (let i = 0; i < numSimulations; i++) {
      paths.push([spotRate]);
    }
    
    // Step 4: Generate full paths using correct GBM
    for (let i = 0; i < numSimulations; i++) {
      let currentRate = spotRate;
      
      for (let step = 1; step <= numSteps; step++) {
        // Generate standard normal random number using Box-Muller
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        
        // Apply GBM formula correctly: S(t+dt) = S(t) * exp((drift - 0.5*vol^2)*dt + vol*sqrt(dt)*Z)
        currentRate = currentRate * Math.exp(
          (drift - 0.5 * volatility * volatility) * dt + 
          volatility * Math.sqrt(dt) * z
        );
        
        paths[i].push(currentRate);
      }
    }
    
    // Step 5: Calculate the closest index in our paths for each month's time point
    const monthlyIndices: number[] = [];
    for (let i = 0; i < timePoints.length; i++) {
      const timePoint = timePoints[i];
      const exactIndex = Math.round((timePoint / maxTime) * numSteps);
      const validIndex = Math.min(exactIndex, numSteps); // Ensure index is within bounds
      monthlyIndices.push(validIndex);
      console.log(`Month ${i+1}: timePoint=${timePoint.toFixed(4)} years, path index=${validIndex}`);
    }
    
    // Log some debug info
    if (paths.length > 0) {
      console.log("First path: Initial value and final 5 points:", 
                 [paths[0][0], ...paths[0].slice(-5)]);
      
      // Log a few sample end rates to verify volatility is working
      const sampleEndRates = paths.slice(0, 5).map(p => p[p.length-1]);
      console.log("Sample end rates from 5 paths:", sampleEndRates);
      
      // Verify the range of rates to ensure volatility is working correctly
      const allFinalRates = paths.map(p => p[p.length-1]);
      const min = Math.min(...allFinalRates);
      const max = Math.max(...allFinalRates);
      console.log(`Range of final rates: Min=${min.toFixed(4)}, Max=${max.toFixed(4)}, Spread=${(max-min).toFixed(4)}`);
    }
    
    return { paths, monthlyIndices };
  }, []);

  const calculatePricesFromPaths_ForexMC = (
    optionType: string, S: number, K: number, r_d: number, r_f: number, t: number,
    maturityIndex: number, paths: number[][], barrier?: number, secondBarrier?: number
  ): number => {
    let priceSum = 0;
    const numSimulations = paths.length;

    if (!numSimulations || !paths[0] || paths[0].length <= maturityIndex) {
        console.error("Invalid paths or maturityIndex for MC pricing.");
        return 0;
    }

    for (let i = 0; i < numSimulations; i++) {
        const path = paths[i];
        const finalRate = path[maturityIndex];
        let payoff = 0;
        let isActive = true; // Assume active unless knocked-out or not knocked-in

        if ((optionType.includes('knockout') || optionType.includes('knockin')) && barrier !== undefined) {
            let knockedOut = false;
            let knockedIn = false;
            for(let step = 0; step <= maturityIndex; step++) {
                const stepPrice = path[step];
                if (optionType.includes('knockout')) {
                    if (barrier !== undefined && stepPrice >= barrier) { knockedOut = true; break; }
                }
                if (optionType.includes('knockin')) {
                    if (barrier !== undefined && stepPrice <= barrier && (optionType.includes('double') || optionType.includes('DKO'))) { knockedIn = true; break; }
                }
            }
            if (optionType.includes('knockout')) {
                isActive = !knockedOut;
            } else if (optionType.includes('knockin')) {
                isActive = knockedIn;
            }
        }

        if (isActive) {
            if (optionType.includes('call')) {
                payoff = Math.max(0, finalRate - K);
            } else if (optionType.includes('put')) {
                payoff = Math.max(0, K - finalRate);
            }
        }
        priceSum += payoff;
    }

    const averagePayoff = priceSum / numSimulations;
    return averagePayoff * Math.exp(-r_d * t);
  };

  const calculateBarrierPayoff = (
    instrument: StrategyComponent,
    realRate: number,
    basePayoff: number,
    initialSpotRateForStrike: number
  ): number => {
    if (!instrument.type.includes('knockout') && !instrument.type.includes('knockin')) {
        return basePayoff;
    }

    const strikeRate = instrument.strikeType === 'percent'
        ? initialSpotRateForStrike * (instrument.strike / 100)
        : instrument.strike;

    let isActive = true;
    if (instrument.type.includes('knockout')) {
        isActive = true;
        if (strikeRate >= realRate) isActive = false;
    } else if (instrument.type.includes('knockin')) {
        isActive = false;
        if (strikeRate <= realRate) isActive = true;
    }

    return isActive ? basePayoff : 0;
  };

  const erf = (x: number): number => {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    const sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  };

  const handleParamChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const target = e.target as HTMLInputElement;

    setParams(prev => {
        const newValue = isCheckbox ? target.checked : value;
        const updated = { ...prev, [name]: newValue };

        if (name === 'spotRate') {
            setInitialSpotRate(parseFloat(value) || 0);
        }

        if (name === 'baseNotional') {
            updated.quoteNotional = (updated.spotRate || 0) === 0 ? 0 : (parseFloat(value) || 0) / updated.spotRate;
        } else if (name === 'quoteNotional') {
             updated.baseNotional = (updated.spotRate || 0) === 0 ? 0 : (parseFloat(value) || 0) * updated.spotRate;
        }

        return updated;
    });
  };

  const handleSpotRateChange = (newRate: number) => {
    setParams(prev => {
        const updated = { ...prev, spotRate: newRate };
        updated.quoteNotional = (updated.baseNotional || 0) * newRate;
        return updated;
    });
    setInitialSpotRate(newRate);
  };

  const handleRealRateParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const updateObj: Record<string, any> = {};
    
    if (type === 'checkbox') {
      updateObj[name] = checked;
      console.log(`Setting ${name} to ${checked}`);
    } else {
      updateObj[name] = parseFloat(value);
      console.log(`Setting ${name} to ${value}`);
    }
    
    setRealRateParams(prev => {
      const newState = { ...prev, ...updateObj };
      console.log("Updated real rate params:", newState);
      return newState;
    });
  };

  const handleStrategyTypeChange = (value: string) => {
    console.log("(Simplified) Strategy selected:", value);
    setSelectedStrategy(value);
  };

  const handlePairChange = (value: string) => {
    console.log("Pair selected:", value);
    setSelectedPair(value);
    const newPairData = FOREX_PAIRS[value];
    if (newPairData) {
        setParams(prev => ({
            ...prev,
            spotRate: newPairData.spot,
            baseNotional: prev.totalVolume,
            quoteNotional: prev.totalVolume * newPairData.spot
        }));
        setInitialSpotRate(newPairData.spot);
    } else {
         console.warn(`Data not found for pair: ${value}`);
    }
    setResults([]);
    setPayoffData([]);
    setMonteCarloPaths([]);
  };

  const handleCustomStrategyChange = (options: CustomOptionComponent[]) => {
    setCustomStrategyComponents(options);
  };

  const calculateResults = () => {
    console.log("Calculating results with params:", params);
    console.log("Selected Strategy:", selectedStrategy);
    if (selectedStrategy === 'custom') {
       console.log("Custom Strategy Components:", customStrategyComponents);
    }
    console.log("Real Rate Params:", realRateParams);
    console.log("Active Tab:", activeTab);

    if (activeTab === 'historical' && monthlyStats.length === 0) {
        alert("Please process historical data on the 'Historical Backtest' tab before calculating results with it.");
        return;
    }

    const resultsArray: ForexResult[] = [];
    const currentStartDate = new Date(params.startDate);
    const S = params.spotRate; // Spot rate at t=0 for premium calculation
    const initialS = initialSpotRate; // Initial spot rate when page loaded
    const r_d = params.domesticRate / 100;
    const r_f = params.foreignRate / 100;
    const months: Date[] = [];
    for (let i = 0; i < params.monthsToHedge; i++) {
        const monthDate = new Date(currentStartDate);
        monthDate.setMonth(currentStartDate.getMonth() + i);
        months.push(monthDate);
    }

    let realRates: number[] = [];
    let simulatedPaths: number[][] = [];
    const vol = realRateParams.volatility / 100; // Volatility for simulation/pricing

    // --- Determine Real Rates (Spot, Simulation, or Historical) --- START
    if (activeTab === 'historical') {
        console.log("Using Historical Monthly Averages");
        realRates = monthlyStats.map(stat => stat.avgPrice);
        if (realRates.length < params.monthsToHedge) {
            console.warn(`Historical data only available for ${realRates.length} months. Calculation truncated.`);
            months.splice(realRates.length);
        } else {
             realRates = realRates.slice(0, params.monthsToHedge);
        }
    } else if (realRateParams.useSimulation) {
        console.log(`Using Monte Carlo Simulation (${realRateParams.numSimulations} paths, Vol: ${vol})`);
        console.log(`Simulation checkbox is ${realRateParams.useSimulation ? 'CHECKED' : 'NOT CHECKED'}`);
        console.log(`Volatility for simulation: ${vol}`);
        
        const generatedData = generatePricePathsForPeriod_Forex(
            months, 
            currentStartDate, 
            S, 
            r_d, 
            r_f, 
            vol, 
            realRateParams.numSimulations
        );
        simulatedPaths = generatedData.paths;
        setMonteCarloPaths(simulatedPaths);
        console.log(`Generated ${simulatedPaths.length} simulation paths with ${simulatedPaths[0]?.length || 0} steps each`);
        console.log(`Monthly indices for simulation:`, generatedData.monthlyIndices);

        // Ensure we have valid simulation data
        if (simulatedPaths.length > 0) {
            // Calculate average rate for each month across all simulation paths
            realRates = [];
            for (let monthIndex = 0; monthIndex < months.length; monthIndex++) {
                const pathIndex = generatedData.monthlyIndices[monthIndex];
                if (pathIndex !== undefined && pathIndex < simulatedPaths[0].length) {
                    let sum = 0;
                    for (let simIndex = 0; simIndex < simulatedPaths.length; simIndex++) {
                        sum += simulatedPaths[simIndex][pathIndex];
                    }
                    const avgRate = sum / simulatedPaths.length;
                    realRates.push(avgRate);
                    console.log(`Month ${monthIndex+1}: Average simulated rate = ${avgRate.toFixed(6)} (from path index ${pathIndex})`);
                } else {
                    console.warn(`Invalid path index ${pathIndex} for month ${monthIndex+1}, using spot rate`);
                    realRates.push(S);
                }
            }
            console.log("FINAL REAL RATES FROM SIMULATION:", realRates);
        } else {
            console.warn("Simulation failed or insufficient steps. Using current spot.");
            realRates = months.map(() => S);
            setMonteCarloPaths([]);
        }
    } else {
        console.log("Using Current Spot Rate for all periods");
        realRates = months.map(() => S);
    }
    console.log("Final real rates array being used:", realRates);
    // --- Determine Real Rates --- END

    months.forEach((date, index) => {
        const t = (date.getTime() - currentStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) + (1/365.25); // Time to maturity in years
        const realRate = realRates[index];
        const monthlyVolume = params.totalVolume / params.monthsToHedge;
        const forwardRate = S * Math.exp((r_d - r_f) * t); // Theoretical forward rate

        let totalPremiumPerUnit = 0;
        let totalPayoffPerUnit = 0;
        const optionPricesDetails: ForexResult['optionPrices'] = [];

        if (selectedStrategy === 'custom') {
             // --- Custom Strategy Calculation --- START
             customStrategyComponents.forEach(comp => {
                const strikeRate = comp.strikeType === 'percent' ? initialS * (comp.strike / 100) : comp.strike;
                const componentVol = (comp.volatility || vol * 100) / 100; // Use component's vol or default
                const quantityFactor = comp.quantity / 100;
                let premium = 0;
                let payoff = 0;
                let priceLabel = `${comp.type} @ ${strikeRate.toFixed(4)}`;

                // Premium Calculation - Use appropriate model based on option type
                if (comp.type === 'call' || comp.type === 'put') {
                    // Use Garman-Kohlhagen (Black-Scholes for FX) for vanilla options
                    premium = calculateOptionPrice_GarmanKohlhagen(comp.type, S, strikeRate, r_d, r_f, t, componentVol) * quantityFactor;
                } else if (comp.type.includes('KO') || comp.type.includes('KI')) {
                    // Use barrier option pricing model for barrier options
                    const upperBarrier = comp.upperBarrierType === 'percent' 
                        ? initialS * (comp.upperBarrier! / 100) 
                        : comp.upperBarrier;
                    
                    const lowerBarrier = comp.lowerBarrierType === 'percent'
                        ? initialS * (comp.lowerBarrier! / 100)
                        : comp.lowerBarrier;
                    
                    // Utiliser le modèle d'options à barrière
                    premium = calculateBarrierOptionPrice(
                        comp.type,
                        S,
                        strikeRate,
                        upperBarrier,
                        lowerBarrier,
                        t,
                        r_d,
                        r_f,
                        componentVol,
                        comp.quantity
                    );
                    
                    console.log(`Barrier option premium calculated: ${premium.toFixed(6)} for ${comp.type} strike=${strikeRate}, barriers=${upperBarrier},${lowerBarrier}`);
                }

                // Payoff Calculation (using helper)
                const basePayoff = comp.type.includes('call') ? Math.max(0, realRate - strikeRate) : Math.max(0, strikeRate - realRate);
                payoff = calculateBarrierPayoff(comp, realRate, basePayoff, initialS) * quantityFactor;

                 if (!isNaN(premium)) {
                     totalPremiumPerUnit += premium;
                     optionPricesDetails.push({ type: comp.type, price: premium / quantityFactor, quantity: comp.quantity, strike: strikeRate, label: priceLabel });
                 } else { console.warn(`NaN premium calculated for custom component:`, comp); }
                 if (!isNaN(payoff)) {
                     totalPayoffPerUnit += payoff;
                 } else { console.warn(`NaN payoff calculated for custom component:`, comp); }
             });
             // --- Custom Strategy Calculation --- END
        } else {
             // --- Standard Strategy Calculation --- START
             // Use strategy parameters from params object
             const strikeUpper = params.strikeUpper || params.spotRate * 1.05;
             const strikeLower = params.strikeLower || params.spotRate * 0.95;
             const strikeMid = params.strikeMid || params.spotRate;
             const barrierUpper = params.barrierUpper || params.spotRate * 1.10;
             const barrierLower = params.barrierLower || params.spotRate * 0.90;
             const optionQuantity = params.optionQuantity || 100;
             // 1. Calculate Total Premium Per Unit for the strategy
             switch (selectedStrategy) {
                case 'forward':
                    totalPremiumPerUnit = 0;
                    break;
                case 'call':
                    totalPremiumPerUnit = calculateOptionPrice_GarmanKohlhagen('call', S, strikeUpper, r_d, r_f, t, vol) * (optionQuantity / 100);
                    break;
                case 'put':
                    totalPremiumPerUnit = calculateOptionPrice_GarmanKohlhagen('put', S, strikeLower, r_d, r_f, t, vol) * (optionQuantity / 100);
                    break;
                case 'collarPut':
                case 'collarCall':
                    // For zero cost collars, calculate the offset premiums
                    const putCollarPremium = calculateOptionPrice_GarmanKohlhagen('put', S, strikeLower, r_d, r_f, t, vol);
                    const callCollarPremium = calculateOptionPrice_GarmanKohlhagen('call', S, strikeUpper, r_d, r_f, t, vol);
                    totalPremiumPerUnit = putCollarPremium - callCollarPremium; // Should be near zero for zero-cost collar
                    break;
                case 'callKO':
                    // Use factor to approximate barrier option premium being cheaper than vanilla
                    totalPremiumPerUnit = calculateOptionPrice_GarmanKohlhagen('call', S, strikeUpper, r_d, r_f, t, vol) * 0.7;
                    break;
                case 'putKI':
                    // Use factor to approximate barrier option premium being cheaper than vanilla
                    totalPremiumPerUnit = calculateOptionPrice_GarmanKohlhagen('put', S, strikeLower, r_d, r_f, t, vol) * 0.7;
                    break;
                case 'strangle':
                    const stranglePutPremium = calculateOptionPrice_GarmanKohlhagen('put', S, strikeLower, r_d, r_f, t, vol);
                    const strangleCallPremium = calculateOptionPrice_GarmanKohlhagen('call', S, strikeUpper, r_d, r_f, t, vol);
                    totalPremiumPerUnit = stranglePutPremium + strangleCallPremium;
                    break;
                case 'straddle':
                     const straddlePutPremium = calculateOptionPrice_GarmanKohlhagen('put', S, strikeMid, r_d, r_f, t, vol);
                     const straddleCallPremium = calculateOptionPrice_GarmanKohlhagen('call', S, strikeMid, r_d, r_f, t, vol);
                     totalPremiumPerUnit = straddlePutPremium + straddleCallPremium;
                     break;
                case 'seagull':
                     const seagullPutBuyPremium = calculateOptionPrice_GarmanKohlhagen('put', S, strikeMid, r_d, r_f, t, vol);
                     const seagullCallSellPremium = calculateOptionPrice_GarmanKohlhagen('call', S, strikeUpper, r_d, r_f, t, vol);
                     const seagullPutSellPremium = calculateOptionPrice_GarmanKohlhagen('put', S, strikeLower, r_d, r_f, t, vol);
                     totalPremiumPerUnit = seagullPutBuyPremium - seagullCallSellPremium - seagullPutSellPremium;
                     break;
                case 'callPutKI_KO':
                     const callKOPremium = calculateOptionPrice_GarmanKohlhagen('call', S, strikeUpper, r_d, r_f, t, vol) * 0.7;
                     const putKIPremium = calculateOptionPrice_GarmanKohlhagen('put', S, strikeLower, r_d, r_f, t, vol) * 0.7;
                     totalPremiumPerUnit = callKOPremium + putKIPremium;
                     break;
                default:
                    totalPremiumPerUnit = 0;
             }
             // Store a simplified price detail for now
             optionPricesDetails.push({ type: selectedStrategy, price: totalPremiumPerUnit, quantity: 100, strike: 0, label: selectedStrategy });


             // 3. Calculate Total Payoff Per Unit based on realRate
             switch (selectedStrategy) {
                 case 'forward':
                     totalPayoffPerUnit = forwardRate - realRate;
                     break;
                 case 'call':
                     totalPayoffPerUnit = Math.max(0, realRate - strikeUpper) * (optionQuantity / 100);
                     break;
                 case 'put':
                     totalPayoffPerUnit = Math.max(0, strikeLower - realRate) * (optionQuantity / 100);
                     break;
                 case 'collarPut': // Long Put (strikeLower), Short Call (strikeUpper)
                 case 'collarCall': // Assuming strikes are correctly set for zero cost
                      totalPayoffPerUnit = Math.max(0, strikeLower - realRate) - Math.max(0, realRate - strikeUpper);
                      break;
                 case 'callKO': // Payoff = max(0, realRate - strikeUpper) if realRate < barrierUpper, else 0
                     totalPayoffPerUnit = (realRate < barrierUpper) ? Math.max(0, realRate - strikeUpper) : 0;
                     break;
                 case 'putKI': // Payoff = max(0, strikeLower - realRate) if realRate < barrierLower (assuming lower barrier for KI Put), else 0
                     totalPayoffPerUnit = (realRate < barrierLower) ? Math.max(0, strikeLower - realRate) : 0; 
                     break;
                 case 'strangle': // Long Put (strikeLower), Long Call (strikeUpper)
                     totalPayoffPerUnit = Math.max(0, strikeLower - realRate) + Math.max(0, realRate - strikeUpper);
                     break;
                 case 'straddle': // Long Put + Long Call at same strike (ATM)
                      totalPayoffPerUnit = Math.max(0, strikeMid - realRate) + Math.max(0, realRate - strikeMid);
                      break;
                 case 'seagull': // Buy Put(Mid), Sell Call(Upper), Sell Put(Lower)
                      totalPayoffPerUnit = Math.max(0, strikeMid - realRate) - Math.max(0, realRate - strikeUpper) - Math.max(0, strikeLower - realRate);
                      break;
                 case 'callPutKI_KO': // Call KO (Upper Barrier) + Put KI (Lower Barrier)
                      const callKOPayoff = (realRate < barrierUpper) ? Math.max(0, realRate - strikeUpper) : 0;
                      const putKIPayoff = (realRate < barrierLower) ? Math.max(0, strikeLower - realRate) : 0;
                      totalPayoffPerUnit = callKOPayoff + putKIPayoff;
                      break;
                 default:
                     totalPayoffPerUnit = 0; // Default for unhandled strategies
             }
             // --- Standard Strategy Calculation --- END
        }

        // --- Common Result Calculation --- START
        const unhedgedRevenue = monthlyVolume * realRate;
        const premiumPaid = monthlyVolume * totalPremiumPerUnit;
        const payoffFromHedge = monthlyVolume * totalPayoffPerUnit;
        const hedgedRevenue = unhedgedRevenue + payoffFromHedge - premiumPaid;
        const pnlVsUnhedged = payoffFromHedge - premiumPaid;
        const effectiveRate = monthlyVolume === 0 ? realRate : hedgedRevenue / monthlyVolume;

        resultsArray.push({
            date: date.toISOString().split('T')[0],
            timeToMaturity: t,
            forwardRate,
            realRate, // <-- This is the key field that should show the simulated rate!
            optionPrices: optionPricesDetails,
            strategyPrice: totalPremiumPerUnit,
            totalPayoff: totalPayoffPerUnit,
            monthlyVolume,
            unhedgedRevenue,
            premiumPaid,
            payoffFromHedge,
            hedgedRevenue,
            pnlVsUnhedged,
            effectiveRate,
        });
        // --- Common Result Calculation --- END
    });

    setResults(resultsArray);
    console.log("Calculation complete. Results:", resultsArray);

    calculatePayoff(); // Trigger payoff chart update
  };

  const calculatePayoff = () => {
    console.log("Calculating payoff data for chart...");
    const payoffPoints = 50;
    const spot = params.spotRate; // Use current spot for chart center and premium calculation
    const range = spot * 0.30; // Chart range +/- 30%
    const step = (range * 2) / payoffPoints;
    const data = [];

    // Parameters needed for calculation
    const t = params.monthsToHedge > 0 ? params.monthsToHedge / 12 : 1 / 12; // Use average maturity for chart
    const r_d = params.domesticRate / 100;
    const r_f = params.foreignRate / 100;
    const initialS = initialSpotRate; // Spot rate when strategy was initiated (for strikes based on %)
    const vol = realRateParams.volatility / 100;

    // Get strategy parameters from params object
    const strikeUpper = params.strikeUpper || params.spotRate * 1.05;
    const strikeLower = params.strikeLower || params.spotRate * 0.95;
    const strikeMid = params.strikeMid || params.spotRate;
    const barrierUpper = params.barrierUpper || params.spotRate * 1.10;
    const barrierLower = params.barrierLower || params.spotRate * 0.90;
    const optionQuantity = params.optionQuantity || 100;
    const quantityFactor = optionQuantity / 100;
    
    const chartForwardRate = spot * Math.exp((r_d - r_f) * t);

    for (let i = 0; i <= payoffPoints; i++) {
        const currentSpot = spot - range + i * step; // The spot rate for this point on the X-axis
        let premiumCost = 0;
        let payoffAtSpot = 0;
        const optionDetailsForChart: any = {}; // For chart reference lines

        if (selectedStrategy === 'custom') {
            // --- Custom Strategy Payoff for Chart --- START
            customStrategyComponents.forEach((comp, idx) => {
                 const strikeRate = comp.strikeType === 'percent' ? initialS * (comp.strike / 100) : comp.strike;
                 const componentVol = (comp.volatility || vol * 100) / 100;
                 const quantityFactor = comp.quantity / 100;
                 let componentPremium = 0;

                 // Premium (calculated at current 'spot')
                 if (comp.type === 'call' || comp.type === 'put') { componentPremium = calculateOptionPrice_GarmanKohlhagen(comp.type, spot, strikeRate, r_d, r_f, t, componentVol) * quantityFactor; }
                 else if (comp.type.includes('knock')) { componentPremium = calculateOptionPrice_GarmanKohlhagen(comp.type.includes('call') ? 'call' : 'put', spot, strikeRate, r_d, r_f, t, componentVol) * quantityFactor; }
                 premiumCost += isNaN(componentPremium) ? 0 : componentPremium;

                 // Payoff (calculated at 'currentSpot' on the chart's x-axis)
                 const basePayoff = comp.type.includes('call') ? Math.max(0, currentSpot - strikeRate) : Math.max(0, strikeRate - currentSpot);
                 const componentPayoff = calculateBarrierPayoff(comp, currentSpot, basePayoff, initialS) * quantityFactor;
                 payoffAtSpot += isNaN(componentPayoff) ? 0 : componentPayoff;

                // Store details for chart reference lines
                 optionDetailsForChart[`${comp.type}_${idx}_Strike`] = strikeRate;
                 if (comp.upperBarrier) { optionDetailsForChart[`${comp.type}_${idx}_UpperBarrier`] = comp.upperBarrierType === 'percent' ? initialS * (comp.upperBarrier / 100) : comp.upperBarrier; }
                 if (comp.lowerBarrier) { optionDetailsForChart[`${comp.type}_${idx}_LowerBarrier`] = comp.lowerBarrierType === 'percent' ? initialS * (comp.lowerBarrier / 100) : comp.lowerBarrier; }
            });
            // --- Custom Strategy Payoff for Chart --- END
        } else {
            // --- Standard Strategy Payoff for Chart --- START
            // Calculate Premium Cost (at current 'spot')
            switch (selectedStrategy) {
                case 'forward': 
                    premiumCost = 0; 
                    optionDetailsForChart['Forward Rate'] = chartForwardRate; 
                    break;
                case 'call': 
                    premiumCost = calculateOptionPrice_GarmanKohlhagen('call', spot, strikeUpper, r_d, r_f, t, vol) * quantityFactor; 
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    break;
                case 'put': 
                    premiumCost = calculateOptionPrice_GarmanKohlhagen('put', spot, strikeLower, r_d, r_f, t, vol) * quantityFactor; 
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    break;
                case 'collarPut': case 'collarCall': 
                    // For zero cost collars, the premiums should offset each other
                    const putCollarPremium = calculateOptionPrice_GarmanKohlhagen('put', spot, strikeLower, r_d, r_f, t, vol);
                    const callCollarPremium = calculateOptionPrice_GarmanKohlhagen('call', spot, strikeUpper, r_d, r_f, t, vol);
                    premiumCost = putCollarPremium - callCollarPremium; // Should be near zero for properly structured collar
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    break;
                case 'callKO': 
                    // Approximate KO premium using vanilla option price adjusted
                    premiumCost = calculateOptionPrice_GarmanKohlhagen('call', spot, strikeUpper, r_d, r_f, t, vol) * 0.7; // Adjust factor
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    optionDetailsForChart['KO Barrier'] = barrierUpper; 
                    break;
                case 'putKI': 
                    // Approximate KI premium using vanilla option price adjusted
                    premiumCost = calculateOptionPrice_GarmanKohlhagen('put', spot, strikeLower, r_d, r_f, t, vol) * 0.7; // Adjust factor
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    optionDetailsForChart['KI Barrier'] = barrierLower; 
                    break;
                case 'strangle': 
                    premiumCost = calculateOptionPrice_GarmanKohlhagen('put', spot, strikeLower, r_d, r_f, t, vol) 
                                + calculateOptionPrice_GarmanKohlhagen('call', spot, strikeUpper, r_d, r_f, t, vol); 
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    break;
                case 'straddle': 
                    premiumCost = calculateOptionPrice_GarmanKohlhagen('put', spot, strikeMid, r_d, r_f, t, vol) 
                                + calculateOptionPrice_GarmanKohlhagen('call', spot, strikeMid, r_d, r_f, t, vol); 
                    optionDetailsForChart['Strike'] = strikeMid; 
                    break;
                case 'seagull':
                    const buyPutPremium = calculateOptionPrice_GarmanKohlhagen('put', spot, strikeMid, r_d, r_f, t, vol);
                    const sellCallPremium = calculateOptionPrice_GarmanKohlhagen('call', spot, strikeUpper, r_d, r_f, t, vol);
                    const sellPutPremium = calculateOptionPrice_GarmanKohlhagen('put', spot, strikeLower, r_d, r_f, t, vol);
                    premiumCost = buyPutPremium - sellCallPremium - sellPutPremium;
                    optionDetailsForChart['Buy Put Strike'] = strikeMid; 
                    optionDetailsForChart['Sell Call Strike'] = strikeUpper; 
                    optionDetailsForChart['Sell Put Strike'] = strikeLower;
                    break;
                case 'callPutKI_KO': 
                    // Approximating complex barrier structure with adjusted pricing
                    const callKOPremium = calculateOptionPrice_GarmanKohlhagen('call', spot, strikeUpper, r_d, r_f, t, vol) * 0.7;
                    const putKIPremium = calculateOptionPrice_GarmanKohlhagen('put', spot, strikeLower, r_d, r_f, t, vol) * 0.7;
                    premiumCost = callKOPremium + putKIPremium;
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    optionDetailsForChart['Upper Barrier (KO)'] = barrierUpper; 
                    optionDetailsForChart['Lower Barrier (KI)'] = barrierLower;
                    break;
                default: 
                    premiumCost = 0;
             }

             // Calculate Payoff (at 'currentSpot' on the chart's x-axis)
             switch (selectedStrategy) {
                 case 'forward': 
                     payoffAtSpot = chartForwardRate - currentSpot; 
                     break;
                 case 'call': 
                     payoffAtSpot = Math.max(0, currentSpot - strikeUpper) * quantityFactor; 
                     break;
                 case 'put': 
                     payoffAtSpot = Math.max(0, strikeLower - currentSpot) * quantityFactor; 
                     break;
                 case 'collarPut': case 'collarCall': 
                     payoffAtSpot = Math.max(0, strikeLower - currentSpot) - Math.max(0, currentSpot - strikeUpper); 
                     break;
                 case 'callKO': 
                     payoffAtSpot = (currentSpot < barrierUpper) ? Math.max(0, currentSpot - strikeUpper) : 0; 
                     break;
                 case 'putKI': 
                     payoffAtSpot = (currentSpot < barrierLower) ? Math.max(0, strikeLower - currentSpot) : 0; 
                     break;
                 case 'strangle': 
                     payoffAtSpot = Math.max(0, strikeLower - currentSpot) + Math.max(0, currentSpot - strikeUpper); 
                     break;
                 case 'straddle': 
                     payoffAtSpot = Math.max(0, strikeMid - currentSpot) + Math.max(0, currentSpot - strikeMid); 
                     break;
                 case 'seagull': // Buy Put(Mid), Sell Call(Upper), Sell Put(Lower)
                     payoffAtSpot = Math.max(0, strikeMid - currentSpot) 
                                   - Math.max(0, currentSpot - strikeUpper) 
                                   - Math.max(0, strikeLower - currentSpot);
                     break;
                 case 'callPutKI_KO': // Call KO (Upper Barrier) + Put KI (Lower Barrier)
                     const callKOPayoffChart = (currentSpot < barrierUpper) ? Math.max(0, currentSpot - strikeUpper) : 0;
                     const putKIPayoffChart = (currentSpot < barrierLower) ? Math.max(0, strikeLower - currentSpot) : 0;
                     payoffAtSpot = callKOPayoffChart + putKIPayoffChart;
                     break;
                 default: 
                     payoffAtSpot = 0;
             }
            // --- Standard Strategy Payoff for Chart --- END
        }

        // --- Common Payoff Data Point Creation --- START
        const hedgedRate = currentSpot + payoffAtSpot;
        const hedgedRateWithPremium = hedgedRate - premiumCost;
        const dataPoint: any = {
            spot: currentSpot,
            "Unhedged Rate": currentSpot,
            "Hedged Rate": includePremium ? hedgedRateWithPremium : hedgedRate,
            ...(includePremium ? { "Hedged Rate (No Premium)": hedgedRate } : { "Hedged Rate with Premium": hedgedRateWithPremium }),
            ...optionDetailsForChart
        };
        data.push(dataPoint);
        // --- Common Payoff Data Point Creation --- END
    }
    setPayoffData(data);
    console.log("Payoff data calculated:", data);
  };

  const applyStressTest = (key: string) => {
    setActiveStressTestKey(key);
    const scenario = key === 'custom' ? customStressScenario : stressTestScenarios[key];
    if (!scenario) return;

    setOriginalParams(params);
    setOriginalRealRateParams(realRateParams);

    const shockedSpotRate = params.spotRate * (1 + scenario.rateShock);

    const baseDifferential = (params.domesticRate / 100) - (params.foreignRate / 100);
    const shockedDifferential = baseDifferential + (scenario.rateDifferentialShock || 0);

    setParams(prev => ({
        ...prev,
        spotRate: shockedSpotRate,
    }));
    setRealRateParams(prev => ({
        ...prev,
        volatility: scenario.volatility,
    }));

    setTimeout(() => calculateResults(), 0);
  };

  const clearStressTest = () => {
    if (originalParams && originalRealRateParams) {
        setParams(originalParams);
        setRealRateParams(originalRealRateParams);
        setOriginalParams(null);
        setOriginalRealRateParams(null);
        setActiveStressTestKey(null);

        setTimeout(() => calculateResults(), 0);
    } else {
        setActiveStressTestKey(null);
    }
  };

  const updateScenario = (key: string, field: keyof ForexStressTestScenario, value: any) => {
    let numericValue: number | undefined;

    if (field === 'volatility' || field === 'rateShock') {
        numericValue = parseFloat(value) / 100;
    } else if (field === 'rateDifferentialShock') {
        numericValue = parseFloat(value) / 10000;
    } else {
        numericValue = parseFloat(value);
    }

    if (isNaN(numericValue as number)) {
        console.warn(`Invalid numeric value received for ${field}: ${value}`);
        return;
    }

    if (key === 'custom') {
        setCustomStressScenario(prev => ({
            ...prev,
            [field]: numericValue
        }));
    } else {
        setStressTestScenarios(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: numericValue
            }
        }));
    }
  };

  const saveScenario = () => {
    if (!saveScenarioName.trim()) {
        alert("Please enter a name for the scenario.");
        return;
    }

    const newScenario: SavedForexScenario = {
        id: `scenario-${Date.now()}`,
        name: saveScenarioName,
        timestamp: Date.now(),
        params,
        strategy: customStrategyComponents,
        results,
        payoffData,
    };

    const updatedScenarios = [...savedScenarios, newScenario];
    setSavedScenarios(updatedScenarios);
    localStorage.setItem('forexSavedScenarios', JSON.stringify(updatedScenarios));

    console.log("Scenario saved:", newScenario);
    setSaveScenarioName("");
    setShowSaveDialog(false);
    setLoadedScenarioId(newScenario.id);
  };

  const loadScenario = (scenarioId: string) => {
    const scenarioToLoad = savedScenarios.find(s => s.id === scenarioId);
    if (scenarioToLoad) {
        console.log("Loading scenario:", scenarioToLoad.name);
        setParams(scenarioToLoad.params);
        setCustomStrategyComponents(scenarioToLoad.strategy || []);
        setResults(scenarioToLoad.results || []);
        setPayoffData(scenarioToLoad.payoffData || []);
        setSelectedPair(scenarioToLoad.params.selectedPair || "EUR/USD");
        setSelectedStrategy(scenarioToLoad.params.selectedStrategy || 'forward');
        setLoadedScenarioId(scenarioToLoad.id);
        setInitialSpotRate(scenarioToLoad.params.spotRate);
        setShowLoadDialog(false);
    } else {
        console.error("Scenario not found:", scenarioId);
    }
  };

  const deleteScenario = (scenarioId: string) => {
    const updatedScenarios = savedScenarios.filter(s => s.id !== scenarioId);
    setSavedScenarios(updatedScenarios);
    localStorage.setItem('forexSavedScenarios', JSON.stringify(updatedScenarios));

    if (loadedScenarioId === scenarioId) {
        clearLoadedScenario();
    }
    console.log("Scenario deleted:", scenarioId);
  };

  const clearLoadedScenario = () => {
    setParams({
        startDate: new Date().toISOString().split('T')[0],
        monthsToHedge: 12,
        domesticRate: 1.0,
        foreignRate: 0.5,
        totalVolume: 1000000,
        spotRate: 1.10,
        baseNotional: 1000000,
        quoteNotional: (1000000 * 1.10),
        selectedPair: "EUR/USD",
        selectedStrategy: 'forward',
    });
    setInitialSpotRate(1.10);
    setResults([]);
    setPayoffData([]);
    setSelectedPair("EUR/USD");
    setSelectedStrategy('forward');
    setRealRateParams({
        useSimulation: false,
        volatility: 15.0, // Increased default from lower value
        numSimulations: 1000, // Increased default from lower value
    });
    setActiveStressTestKey(null);
    setStressTestScenarios(DEFAULT_FOREX_SCENARIOS);
    setCustomStrategyComponents([]);
    setImpliedVolatilities({});
    setUseImpliedVol(false);
    setCustomOptionPrices({});
    setUseCustomOptionPrices(false);
    setCustomVolumes({});
    setHistoricalData([]);
    setMonthlyStats([]);
    setPriceRanges([
        { min: 1.05, max: 1.08, probability: 25 },
        { min: 1.08, max: 1.12, probability: 50 },
        { min: 1.12, max: 1.15, probability: 25 }
    ]);
    setMatrixStrategies([]);
    setRiskMatrixResults([]);
    setMonteCarloPaths([]);
    setLoadedScenarioId(null);
    console.log("Cleared loaded scenario, reset to defaults.");
    if (originalParams) {
        clearStressTest();
    }
  };

  const exportResultsToCsv = () => {
    if (results.length === 0) {
        alert("No results to export.");
        return;
    }

    const headers = [
        "Date", "TimeToMaturity", "ForwardRate", "RealRate",
        "MonthlyVolume", "PremiumPaid", "PayoffFromHedge",
        "HedgedRevenue", "UnhedgedRevenue", "PnLVsUnhedged", "EffectiveRate",
        "StrategyPremiumPerUnit"
    ];

    const optionPremiumHeaders = new Set<string>();
    results.forEach(result => {
        result.optionPrices.forEach(op => {
            optionPremiumHeaders.add(`Premium_${op.label.replace(/ /g, '_')}`);
        });
    });
    const sortedOptionHeaders = Array.from(optionPremiumHeaders).sort();
    headers.push(...sortedOptionHeaders);

    const rows = results.map(row => {
        const baseData = [
            row.date,
            row.timeToMaturity.toFixed(4),
            row.forwardRate.toFixed(4),
            row.realRate.toFixed(4),
            row.monthlyVolume.toFixed(2),
            row.premiumPaid.toFixed(2),
            row.payoffFromHedge.toFixed(2),
            row.hedgedRevenue.toFixed(2),
            row.unhedgedRevenue.toFixed(2),
            row.pnlVsUnhedged.toFixed(2),
            row.effectiveRate.toFixed(4),
            row.strategyPrice.toFixed(5)
        ];

        const optionPremiums = sortedOptionHeaders.map(header => {
            const label = header.replace('Premium_', '').replace(/_/g, ' ');
            const option = row.optionPrices.find(op => op.label === label);
            return option ? (option.price * (option.quantity / 100)).toFixed(5) : '0.00000';
        });

        return [...baseData, ...optionPremiums].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const scenarioName = loadedScenarioId ? savedScenarios.find(s => s.id === loadedScenarioId)?.name.replace(/[^a-zA-Z0-9]/g, '_') : 'current_params';
    link.setAttribute("download", `forex_hedge_results_${scenarioName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);

    link.click();
    document.body.removeChild(link);
  };

  const currentPairData = FOREX_PAIRS[selectedPair];
  const baseCurrency = selectedPair.split('/')[0];
  const quoteCurrency = selectedPair.split('/')[1];

  return (
    <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Forex Hedging Strategy Dashboard</h1>
            <div className="flex items-center space-x-2">
                 {loadedScenarioId && (
                    <span className="text-sm text-muted-foreground italic mr-2">
                        Loaded: {savedScenarios.find(s => s.id === loadedScenarioId)?.name ?? 'Unknown'}
                    </span>
                 )}
                 <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm"><Save className="mr-2 h-4 w-4" />Save Scenario</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save Current Scenario</DialogTitle>
                            <DialogDescription>Enter a name for the current parameter set and results.</DialogDescription>
                        </DialogHeader>
                        <Input
                             placeholder="Scenario Name"
                             value={saveScenarioName}
                             onChange={(e) => setSaveScenarioName(e.target.value)}
                             className="my-4"
                         />
                        <DialogFooter>
                             <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
                             <Button onClick={saveScenario} disabled={!saveScenarioName.trim()}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                 </Dialog>
                 <Button variant="outline" size="sm" onClick={clearLoadedScenario} title="Clear loaded scenario and reset parameters">
                    <Trash className="mr-2 h-4 w-4" />Reset All
                 </Button>
            </div>
          </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="strategy">Strategy Parameters</TabsTrigger>
          <TabsTrigger value="risk-matrix">Risk Matrix</TabsTrigger>
          <TabsTrigger value="stress-testing">Stress Testing</TabsTrigger>
          <TabsTrigger value="historical">Historical Backtest</TabsTrigger>
        </TabsList>

        <TabsContent value="strategy" className="space-y-6">
           <Card>
               <CardHeader><CardTitle>1. Define Parameters</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="selectedPair">Currency Pair</Label>
                        <select
                          id="selectedPair"
                          name="selectedPair"
                          value={selectedPair}
                          onChange={(e) => handlePairChange(e.target.value)}
                          className="input-field w-full"
                        >
                           <option value="" disabled>-- Select Pair --</option>
                           {Object.entries(FOREX_PAIR_CATEGORIES).map(([category, pairs]) => (
                              <optgroup key={category} label={category}>
                                {pairs.map(pair => (
                                  <option key={pair} value={pair}>
                                    {pair} ({FOREX_PAIRS[pair]?.name})
                                  </option>
                                ))}
                              </optgroup>
                           ))}
                        </select>
        </div>
                    <div>
                         <Label htmlFor="spotRate">Current Spot Rate ({quoteCurrency}/{baseCurrency})</Label>
                         <Input id="spotRate" type="number" name="spotRate" value={params.spotRate} onChange={handleParamChange} step="0.0001" />
          </div>
                    <div>
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input id="startDate" type="date" name="startDate" value={params.startDate} onChange={handleParamChange} />
                    </div>
                    <div>
                        <Label htmlFor="monthsToHedge">Months to Hedge</Label>
                        <Input id="monthsToHedge" type="number" name="monthsToHedge" value={params.monthsToHedge} onChange={handleParamChange} step="1" min="1"/>
                    </div>
                    <div>
                        <Label htmlFor="domesticRate">Domestic Rate ({baseCurrency} %) </Label>
                        <Input id="domesticRate" type="number" name="domesticRate" value={params.domesticRate} onChange={handleParamChange} step="0.01"/>
                         <span className="text-xs text-muted-foreground">Interest rate of the base currency.</span>
                    </div>
                    <div>
                         <Label htmlFor="foreignRate">Foreign Rate ({quoteCurrency} %)</Label>
                        <Input id="foreignRate" type="number" name="foreignRate" value={params.foreignRate} onChange={handleParamChange} step="0.01"/>
                         <span className="text-xs text-muted-foreground">Interest rate of the quote currency.</span>
                    </div>
                    <div>
                        <Label htmlFor="totalVolume">Total Volume ({baseCurrency})</Label>
                        <Input id="totalVolume" type="number" name="totalVolume" value={params.totalVolume} onChange={handleParamChange} step="1000"/>
                         <span className="text-xs text-muted-foreground">Total amount of base currency to hedge.</span>
                    </div>
                    <div>
                         <Label htmlFor="equivalentVolume">Equivalent {quoteCurrency} Volume</Label>
                         <Input id="equivalentVolume" type="number" value={(params.totalVolume * params.spotRate).toFixed(0)} readOnly className="bg-muted"/>
                         <span className="text-xs text-muted-foreground">Approximate based on current spot rate.</span>
                    </div>
               </CardContent>
           </Card>

           <Card>
               <CardHeader><CardTitle>2. Define Hedging Strategy</CardTitle></CardHeader>
               <CardContent className="space-y-4">
                    <div>
                         <Label htmlFor="strategy-select" className="mb-2 block">Strategy Type</Label>
                         <select 
                             id="strategy-select"
                             value={selectedStrategy}
                             onChange={(e) => {
                                 const newValue = e.target.value;
                                 console.log('Standard Strategy select changed:', newValue);
                                 setSelectedStrategy(newValue);
                             }}
                             className="input-field w-full"
                         >
                             {Object.entries(STRATEGIES).map(([key, { name }]) => (
                                 <option key={key} value={key}>
                                     {name}
                                 </option>
                             ))}
                         </select>
            </div>
                     {selectedStrategy && STRATEGIES[selectedStrategy] && (
                        <StrategyInfo
                            name={STRATEGIES[selectedStrategy].name}
                            description={STRATEGIES[selectedStrategy].description}
                            selectedStrategy={selectedStrategy}
                            results={results}
                            params={params}
                        />
                    )}

                    {selectedStrategy === 'custom' && (
                        <CustomStrategyBuilder
                            spot={params.spotRate}
                            onStrategyChange={handleCustomStrategyChange}
                            baseCurrency={baseCurrency}
                            quoteCurrency={quoteCurrency}
                        />
                    )}
                     {selectedStrategy !== 'custom' && selectedStrategy !== 'forward' && (
                         <div className="p-4 border rounded bg-muted/30">
                             <p className="text-sm text-muted-foreground">Inputs for standard strategy '{STRATEGIES[selectedStrategy]?.name}' would go here (e.g., strikes, barriers).</p>
          </div>
                     )}
               </CardContent>
           </Card>

           <Card>
            <CardHeader>
                 <div className="flex items-center justify-between">
                     <CardTitle>3. Define Realized Rate Assumption</CardTitle>
                     <Popover>
                        <PopoverTrigger asChild>
                             <Button variant="ghost" size="sm"><HelpCircle className="h-4 w-4" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="text-sm w-80">
                             Choose how the future 'Real Rate' for each month will be determined for the calculations:
                             <ul className="list-disc pl-4 mt-2 space-y-1">
                                 <li><strong>Use Current Spot:</strong> Assumes the rate stays the same as the current spot rate for all future periods. Simplest assumption.</li>
                                 <li><strong>Use Simulation:</strong> Runs a Monte Carlo simulation (Geometric Brownian Motion) based on the specified volatility to generate possible future rate paths. The average path is used for the table results, and paths are shown in the chart.</li>
                                 <li><strong>Use Historical Data:</strong> Requires uploading data on the 'Historical Backtest' tab. Uses the calculated monthly average rates from the uploaded data.</li>
              </ul>
                        </PopoverContent>
                     </Popover>
          </div>
             </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 mb-4">
                     <Checkbox
                          id="useSimulation"
                          name="useSimulation"
                          checked={realRateParams.useSimulation && activeTab !== 'historical'}
                          disabled={activeTab === 'historical'}
                          onCheckedChange={(checked) => {
                            setRealRateParams(prev => ({ 
                              ...prev, 
                              useSimulation: checked as boolean 
                            }));
                          }}
                      />
                      <label
                          htmlFor="useSimulation"
                          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 
                          ${realRateParams.useSimulation ? 'text-blue-600 font-bold' : ''}`}
                      >
                          Use Simulation (Monte Carlo) {activeTab === 'historical' ? '(unavailable with historical data)' : ''}
                      </label>
        </div>
                  </div>
                  
                  {realRateParams.useSimulation && activeTab !== 'historical' && (
                     <div>
                         <div className="bg-blue-50 p-2 text-sm mb-4 rounded border border-blue-100">
                             <p className="font-medium text-blue-800">
                                 Monte Carlo simulation will be run when you click "Calculate Hedging Results".
                                 Each calculation generates new random rates based on the parameters below.
              </p>
            </div>
                         <div className="grid grid-cols-2 gap-4 pl-6">
                             <div>
                                 <Label htmlFor="volatility">Implied Volatility (%)</Label>
                                 <Input
                                     type="number"
                                     name="volatility"
                                     id="volatility"
                                     value={realRateParams.volatility}
                                     onChange={handleRealRateParamChange}
                                     step="0.1"
                                 />
          </div>
                             <div>
                                 <Label htmlFor="numSimulations">Number of Simulations</Label>
                                 <Input
                                     type="number"
                                     name="numSimulations"
                                     id="numSimulations"
                                     value={realRateParams.numSimulations}
                                     onChange={handleRealRateParamChange}
                                     step="100"
                                     min="100"
                                 />
                             </div>
                         </div>
                     </div>
                 )}

            </CardContent>
          </Card>

           <Button onClick={calculateResults} className="w-full text-lg py-3">
                Calculate Hedging Results
            </Button>

           {results.length > 0 && (
            <>
              {/* === NEW POSITION: Summary Statistics by Year Table === */}
              <Card className="mt-6">
                 <CardHeader>
                     <CardTitle>Summary Statistics by Year</CardTitle>
                 </CardHeader>
                 <CardContent>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Year</TableHead>
                                  <TableHead className="text-right">Total Cost with Hedging ({quoteCurrency})</TableHead>
                                  <TableHead className="text-right">Total Cost without Hedging ({quoteCurrency})</TableHead>
                                  <TableHead className="text-right">Total P&L ({quoteCurrency})</TableHead>
                                  <TableHead className="text-right">Total Strategy Premium ({quoteCurrency})</TableHead>
                                  <TableHead className="text-right">Cost Reduction (%)</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {Object.entries(yearlySummaryStats).sort(([yearA], [yearB]) => yearA.localeCompare(yearB)).map(([year, summary]) => (
                                  <TableRow key={year}>
                                      <TableCell className="font-medium">{year}</TableCell>
                                      <TableCell className="text-right">{summary.totalHedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="text-right">{summary.totalUnhedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                      <TableCell className={`text-right ${summary.totalPnlVsUnhedged >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {summary.totalPnlVsUnhedged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </TableCell>
                                      <TableCell className="text-right">{summary.totalPremiumPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="text-right">{summary.costReductionPercent.toFixed(2)}%</TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                 </CardContent>
              </Card>
              {/* === END Yearly Summary Table === */}

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
                        <TableHead className={realRateParams.useSimulation ? "bg-blue-50 font-bold" : ""}>
                          {realRateParams.useSimulation ? "Simulated Rate" : "Real Rate"}
                        </TableHead>
                        <TableHead className="text-right">Premium/Unit</TableHead>
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
                          <TableCell className={realRateParams.useSimulation ? "bg-blue-50 font-medium" : ""}>
                            {row.realRate.toFixed(6)}
                          </TableCell>
                          <TableCell className="text-right">{row.strategyPrice.toFixed(5)}</TableCell>
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

              <PayoffChart 
                  data={payoffData}
                  selectedStrategy={selectedStrategy}
                  spot={initialSpotRate}
                  includePremium={includePremium}
                  baseCurrency={baseCurrency}
                  quoteCurrency={quoteCurrency}
                  showNotional={showNotional}
                  notional={params.baseNotional}
                  notionalQuote={params.quoteNotional}
              />

              {/* Total Summary Statistics Card */}
              <Card className="mt-6">
                  <CardHeader>
                      <CardTitle>Total Summary Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <ValueDisplay 
                          label="Total Volume Hedged" 
                          value={`${totalSummaryStats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${baseCurrency}`} 
                      />
                      <ValueDisplay 
                          label="Average Realized Rate" 
                          value={totalSummaryStats.averageEffectiveRate.toFixed(4)} 
                      />
                      <ValueDisplay 
                          label="Total Premium Paid" 
                          value={totalSummaryStats.totalPremiumPaid.toLocaleString(undefined, { style: 'currency', currency: quoteCurrency, maximumFractionDigits: 2 })} 
                      />
                      <ValueDisplay 
                          label="Total Payoff from Hedge" 
                          value={totalSummaryStats.totalPayoffFromHedge.toLocaleString(undefined, { style: 'currency', currency: quoteCurrency, maximumFractionDigits: 2 })} 
                      />
                       <ValueDisplay 
                          label="Average P&L vs Unhedged / Unit" 
                          value={totalSummaryStats.averagePnlVsUnhedgedPerUnit.toFixed(5)} 
                      />
                      <ValueDisplay 
                          label="Average Effective Rate" 
                          value={totalSummaryStats.averageEffectiveRate.toFixed(4)} 
                      />
                      <ValueDisplay 
                          label="Total Hedged Revenue" 
                          value={totalSummaryStats.totalHedgedRevenue.toLocaleString(undefined, { style: 'currency', currency: quoteCurrency, maximumFractionDigits: 2 })} 
                      />
                      <ValueDisplay 
                          label="Total Unhedged Revenue" 
                          value={totalSummaryStats.totalUnhedgedRevenue.toLocaleString(undefined, { style: 'currency', currency: quoteCurrency, maximumFractionDigits: 2 })} 
                      />
                  </CardContent>
              </Card>

              {/* Monthly & Yearly P&L Breakdown Card */}
              <Card className="mt-6">
                  <CardHeader>
                      <CardTitle>Monthly & Yearly P&L Breakdown (vs Unhedged, in '000 {quoteCurrency})</CardTitle>
                  </CardHeader>
                  <CardContent>
                       <div className="overflow-x-auto">
                           {results.length > 0 && (() => {
                               // Organise data by year and month
                               const pnlByYearMonth: Record<string, Record<string, number>> = {};
                               const yearTotals: Record<string, number> = {};
                               const monthTotals: Record<string, number> = {};
                               let grandTotal = 0;
                               
                               const years: Set<string> = new Set();
                               const months: string[] = [
                                   'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                               ];
                               
                               // Initialize data structure
                               results.forEach(result => {
                                   const date = new Date(result.date + 'T00:00:00'); // Ensure correct date parsing
                                   const year = date.getFullYear().toString();
                                   const month = date.getMonth();
                                   const monthKey = months[month];
                                   const pnlValue = result.pnlVsUnhedged;
                                   
                                   years.add(year);
                                   
                                   if (!pnlByYearMonth[year]) {
                                       pnlByYearMonth[year] = {};
                                       yearTotals[year] = 0;
                                   }
                                   
                                   // Initialize month total if not present
                                   if (!monthTotals[monthKey]) {
                                       monthTotals[monthKey] = 0;
                                   }

                                   // Initialize year-month if not present
                                   if (!pnlByYearMonth[year][monthKey]) {
                                       pnlByYearMonth[year][monthKey] = 0;
                                   }
                                   
                                   // Add P&L
                                   pnlByYearMonth[year][monthKey] += pnlValue;
                                   
                                   // Update totals
                                   yearTotals[year] += pnlValue;
                                   monthTotals[monthKey] += pnlValue;
                                   grandTotal += pnlValue;
                               });
                               
                               const sortedYears = Array.from(years).sort();
                               
                               const getPnLColor = (value: number) => {
                                   if (value > 0) return 'bg-green-100 text-green-800';
                                   if (value < 0) return 'bg-red-100 text-red-800';
                                   return 'bg-gray-50 text-gray-500'; // Neutral for zero
                               };
                               
                               const formatPnL = (value: number) => {
                                   if (Math.abs(value) < 1) return '0'; // Handle very small P&L as 0
                                   return (value / 1000).toLocaleString(undefined, {
                                       minimumFractionDigits: 1,
                                       maximumFractionDigits: 1 // Show one decimal place for thousands
                                   });
                               };
                               
                               return (
                                   <table className="min-w-full border-collapse text-sm table-fixed">
                                       <colgroup>
                                            <col className="w-20" /> {/* Year column */}
                                             {months.map(m => <col key={m} className="w-20" />)} {/* Monthly columns */}
                                            <col className="w-24" /> {/* Total column */}
                                       </colgroup>
                                       <thead>
                                           <tr className="bg-gray-100">
                                               <th className="border p-2 font-semibold text-left">Year</th>
                                               {months.map(month => (
                                                   <th key={month} className="border p-2 font-semibold text-center">{month}</th>
                                               ))}
                                               <th className="border p-2 font-semibold text-center">Total</th>
                                           </tr>
                                       </thead>
                                       <tbody>
                                           {sortedYears.map(year => (
                                               <tr key={year}>
                                                   <td className="border p-2 font-semibold">{year}</td>
                                                   {months.map(month => {
                                                       const value = pnlByYearMonth[year]?.[month] ?? 0; // Use optional chaining
                                                       return (
                                                           <td 
                                                               key={`${year}-${month}`} 
                                                               className={`border p-2 text-right ${getPnLColor(value)}`}
                                                           >
                                                               {value !== 0 ? formatPnL(value) : '-'}
                                                           </td>
                                                       );
                                                   })}
                                                   <td className={`border p-2 text-right font-semibold ${getPnLColor(yearTotals[year])}`}>
                                                       {formatPnL(yearTotals[year])}
                                                   </td>
                                               </tr>
                                           ))}
                                           <tr className="bg-gray-50">
                                               <td className="border p-2 font-semibold">Total</td>
                                               {months.map(month => (
                                                   <td 
                                                       key={`total-${month}`} 
                                                       className={`border p-2 text-right font-semibold ${getPnLColor(monthTotals[month] || 0)}`}
                                                   >
                                                       {(monthTotals[month] ?? 0) !== 0 ? formatPnL(monthTotals[month] || 0) : '-'}
                                                   </td>
                                               ))}
                                               <td className={`border p-2 text-right font-semibold ${getPnLColor(grandTotal)}`}>
                                                   {formatPnL(grandTotal)}
                                               </td>
                                           </tr>
                                       </tbody>
                                   </table>
                               );
                           })()}
                            {results.length === 0 && <p className="text-center text-muted-foreground py-4">No results to display.</p>} 
            </div>
                  </CardContent>
              </Card>

              {realRateParams.useSimulation && monteCarloPaths && monteCarloPaths.length > 0 && (
                  <Card>
                      <CardHeader>
                          <CardTitle>Monte Carlo Simulation Paths</CardTitle>
          <p className="text-sm text-muted-foreground">
                              Displaying {Math.min(monteCarloPaths.length, 20)} of {monteCarloPaths.length} simulated future exchange rate paths ({params.selectedPair}).
                          </p>
                      </CardHeader>
                      <CardContent style={{ height: '400px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                                  <XAxis
                                      dataKey="month"
                                       // Create ticks based on results dates
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
                                   <ReferenceLine y={params.spotRate} label={{ value: `Current Spot (${params.spotRate.toFixed(4)})`, position: "insideTopRight", fill: "#8884d8", fontSize: 12 }} stroke="#8884d8" strokeDasharray="3 3" />
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
            </>
          )}
           {results.length === 0 && (
                 <div className="p-6 border border-dashed border-border rounded-lg text-center text-muted-foreground min-h-[200px] flex items-center justify-center">
                    <p>Define parameters and strategy, then click "Calculate Hedging Results".</p>
        </div>
            )}

        </TabsContent>

        <TabsContent value="risk-matrix">
          <RiskMatrixGenerator
            priceRanges={priceRanges}
            setPriceRanges={setPriceRanges}
            matrixStrategies={matrixStrategies}
            setMatrixStrategies={setMatrixStrategies}
            riskMatrixResults={riskMatrixResults}
            setRiskMatrixResults={setRiskMatrixResults}
            params={params}
             mainStrategy={selectedStrategy === 'custom' ? customStrategyComponents : []}
            calculateOptionPrice={calculateOptionPrice_GarmanKohlhagen}
            calculateBarrierPayoff={calculateBarrierPayoff}
            initialSpotRate={initialSpotRate}
          />
        </TabsContent>

        <TabsContent value="stress-testing">
           {activeStressTestKey && (
                 <div className="mb-4 flex justify-end">
                     <Button variant="destructive" onClick={clearStressTest}>
                         <AlertCircle className="mr-2 h-4 w-4" /> Clear Applied Stress Test ({activeStressTestKey})
                     </Button>
        </div>
             )}
          <StressTesting
             scenarios={{...stressTestScenarios, custom: customStressScenario}}
             customScenario={customStressScenario}
            updateScenario={updateScenario}
            applyScenario={applyStressTest}
            activeScenarioKey={activeStressTestKey}
          />
        </TabsContent>

        <TabsContent value="historical">
          <HistoricalBacktest
            historicalData={historicalData}
            setHistoricalData={setHistoricalData}
            monthlyStats={monthlyStats}
            setMonthlyStats={setMonthlyStats}
            calculateResults={() => {
                 setActiveTab('strategy');
                 setTimeout(calculateResults, 0);
             }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
