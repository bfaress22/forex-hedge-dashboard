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
import { calculateCall, calculatePut, cnd } from '@/utils/garmanKohlhagen';
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
  impliedVolatility?: number; // Optional implied volatility for per-month customization
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
    additionalDrift: number; // Tendance annuelle supplémentaire en %
    ignoreDriftFromRates: boolean; // Ignorer le drift lié aux taux d'intérêt
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
  volatility: number | null;
}

// --- Default Stress Scenarios Update ---

const DEFAULT_FOREX_SCENARIOS: Record<string, ForexStressTestScenario> = {
    base: {
        name: "Base Case", 
        description: "Normal market conditions without particular shock",
        volatility: 0.08, // CORRECTED: 8% instead of 10% for normal FX conditions
        rateDifferentialShock: 0, 
        rateShock: 0, 
        forwardPointsShock: 0,
        isEditable: true
    },
    highVol: {
        name: "High Volatility", 
        description: "Increased volatility (+4%) - periods of uncertainty, elections, crises",
        volatility: 0.12, // CORRECTED: 12% instead of 15% for high volatility FX
        rateDifferentialShock: 0, 
        rateShock: 0, 
        forwardPointsShock: 0,
        isEditable: true
    },
    extremeVol: {
        name: "Extreme Volatility", 
        description: "Unstable market conditions - Covid-19 type or financial crisis",
        volatility: 0.18, // CORRECTED: 18% instead of 25% for extreme FX volatility
        rateDifferentialShock: 0.0025, 
        rateShock: 0, 
        forwardPointsShock: 0,
        isEditable: true
    },
    rateDepreciation: {
        name: "Foreign Currency Depreciation (-5%)", 
        description: "Foreign currency weakening - economic deterioration",
        volatility: 0.10, // CORRECTED: 10% instead of 12% for moderate stress
        rateShock: -0.05, 
        rateDifferentialShock: 0,
        forwardPointsShock: 0,
        isEditable: true
    },
    severeDepreciation: {
        name: "Severe Depreciation (-15%)", 
        description: "Currency crisis or central bank intervention",
        volatility: 0.15, // CORRECTED: 15% instead of 18% for severe stress
        rateShock: -0.15, 
        rateDifferentialShock: 0.005,
        forwardPointsShock: 0,
        isEditable: true
    },
    rateAppreciation: {
        name: "Foreign Currency Appreciation (+5%)", 
        description: "Foreign currency strengthening - economic improvement",
        volatility: 0.10, // CORRECTED: 10% instead of 12% for moderate stress
        rateShock: 0.05, 
        rateDifferentialShock: 0,
        forwardPointsShock: 0,
        isEditable: true
    },
    severeAppreciation: {
        name: "Severe Appreciation (+15%)", 
        description: "Strong demand for foreign currency - safe haven",
        volatility: 0.15, // CORRECTED: 15% instead of 18% for severe stress
        rateShock: 0.15, 
        rateDifferentialShock: -0.005,
        forwardPointsShock: 0,
        isEditable: true
    },
    diffWidens: {
        name: "Widened Rate Differential (+100 bps)", 
        description: "Increased interest rate differential (r_d - r_f)",
        volatility: 0.09, // CORRECTED: 9% instead of 11% for rate differential stress
        rateShock: 0.01, 
        rateDifferentialShock: 0.01,
        forwardPointsShock: 0.01,
        isEditable: true
    },
    diffNarrows: {
        name: "Narrowed Rate Differential (-100 bps)", 
        description: "Decreased interest rate differential (r_d - r_f)",
        volatility: 0.09, // CORRECTED: 9% instead of 11% for rate differential stress
        rateShock: -0.01, 
        rateDifferentialShock: -0.01,
        forwardPointsShock: -0.01,
        isEditable: true
    },
    fwdPointsShock: {
        name: "Forward Points Shock", 
        description: "Forward market distortion without spot rate effect",
        volatility: 0.08, // CORRECTED: Keep at base level since no spot volatility expected
        rateShock: 0, 
        rateDifferentialShock: 0,
        forwardPointsShock: 0.02,
        isEditable: true
    },
    recession: {
        name: "Recession Scenario", 
        description: "Combination of high volatility and rate decreases",
        volatility: 0.16, // CORRECTED: 16% instead of 20% for recession (still high but realistic)
        rateShock: -0.08, 
        rateDifferentialShock: -0.0075,
        forwardPointsShock: -0.005,
        isEditable: true
    },
    custom: {
        name: "Custom Scenario", 
        description: "Define your own stress test parameters",
        volatility: 0.08, // CORRECTED: Start with realistic base volatility
        rateShock: 0, 
        rateDifferentialShock: 0,
        forwardPointsShock: 0,
        isCustom: true
    }
};

const Index = () => {
  // --- State Updates ---
  const [activeTab, setActiveTab] = useState<string>("strategy");
  const [selectedPair, setSelectedPair] = useState<string>("EUR/USD");
  const [selectedStrategy, setSelectedStrategy] = useState<string>('custom');
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
      selectedStrategy: 'custom',
    };
  });

  const [realRateParams, setRealRateParams] = useState<RealRateParams>({
    useSimulation: false,
    volatility: 8.0, // CORRECTED: Realistic FX volatility (8% instead of 15%) - Major currency pairs typically trade at 6-12% annual volatility
    numSimulations: 1000, // Increased default from lower value
    additionalDrift: 0, // Tendance annuelle supplémentaire en %
    ignoreDriftFromRates: false, // Ignorer le drift lié aux taux d'intérêt
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
        volatility: 0.08, rateShock: 0, isCustom: true // CORRECTED: 8% instead of 10% volatility
    };
    if (savedState) {
        const saved = JSON.parse(savedState).customScenario;
        return (saved && typeof saved.rateShock === 'number') ? saved : defaultCustom;
    }
    return defaultCustom;
  });

  const [activeStressTestKey, setActiveStressTestKey] = useState<string | null>(null);
  const [activeStressTestScenario, setActiveStressTestScenario] = useState<ForexStressTestScenario | null>(null);

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
  const [originalCustomStrategyComponents, setOriginalCustomStrategyComponents] = useState<CustomOptionComponent[] | null>(null);

  const [activeScenarioKey, setActiveScenarioKey] = useState<string | null>(null);
  const [useImpliedVolatility, setUseImpliedVolatility] = useState<boolean>(false);
  const [usePremiumOverride, setUsePremiumOverride] = useState<boolean>(false);

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
    
    // Apply additional drift from user input (converted from percentage to decimal)
    const additionalDriftDecimal = realRateParams.additionalDrift / 100;
    
    // MODIFICATION: Simulation véritablement aléatoire quand ignoreDriftFromRates est activé
    const paths: number[][] = [];
    
    if (realRateParams.ignoreDriftFromRates) {
      console.log("Generating PURE RANDOM paths (ignoring standard financial model)");
      
      // Amplifier la volatilité pour des mouvements plus visibles
      const enhancedVolatility = volatility * 2;
      
      for (let i = 0; i < numSimulations; i++) {
        // Initialiser le premier point au taux spot
        const path = [spotRate];
        let currentRate = spotRate;
        
        // Génération d'une marche aléatoire pure
        for (let step = 1; step <= numSteps; step++) {
          // Génération de nombre aléatoire avec distribution plus large
          const u1 = Math.random();
          const u2 = Math.random();
          const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
          
          // Calcul de la variation aléatoire avec tendance additionelle seulement
          // Pas de terme de correction -0.5*vol^2, pas de drift lié aux taux d'intérêt
          const randomChange = additionalDriftDecimal * dt + enhancedVolatility * Math.sqrt(dt) * z;
          
          // Application de la variation directement (mode additif au lieu de multiplicatif)
          // pour augmenter l'impact des mouvements aléatoires
          const percentChange = Math.exp(randomChange) - 1;
          currentRate = currentRate * (1 + percentChange);
          
          // Protection contre les valeurs négatives ou extrêmement élevées
          currentRate = Math.max(currentRate, spotRate * 0.5);
          currentRate = Math.min(currentRate, spotRate * 2.0);
          
          path.push(currentRate);
        }
        paths.push(path);
      }
    } else {
      // Mode standard avec mouvement brownien géométrique
      console.log("Using standard Geometric Brownian Motion with drift from interest rates");
      const drift = (r_d - r_f - 0.5 * volatility * volatility + additionalDriftDecimal) * dt;
      
      // Step 3: Initialize paths with initial spot rate
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
          // Note: drift already includes the -0.5*vol^2 term and dt
          currentRate = currentRate * Math.exp(drift + volatility * Math.sqrt(dt) * z);
          
          paths[i].push(currentRate);
        }
      }
    }
    
    console.log(`Monte Carlo simulation parameters: maxTime=${maxTime}, numSteps=${numSteps}, dt=${dt}, enhancedRandomness=${realRateParams.ignoreDriftFromRates}, additionalDrift=${additionalDriftDecimal}`);
    
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
    
    // Step 5: Calculate the closest index in our paths for each month's time point
    const monthlyIndices: number[] = [];
    for (let i = 0; i < timePoints.length; i++) {
      const timePoint = timePoints[i];
      const exactIndex = Math.round((timePoint / maxTime) * numSteps);
      const validIndex = Math.min(exactIndex, numSteps); // Ensure index is within bounds
      monthlyIndices.push(validIndex);
      console.log(`Month ${i+1}: timePoint=${timePoint.toFixed(4)} years, path index=${validIndex}`);
    }
    
    return { paths, monthlyIndices };
  }, [realRateParams]); // Important: ajout de realRateParams comme dépendance pour useCallback

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
    // Vérifier si c'est une option à barrière
    const isKO = instrument.type.includes('KO');
    const isKI = instrument.type.includes('KI');
    const isReverse = instrument.type.includes('RKO') || instrument.type.includes('RKI');
    const isCall = instrument.type.includes('call');
    
    if (!isKO && !isKI) {
        // Si ce n'est pas une option à barrière, retourner simplement le payoff de base
        return basePayoff;
    }

    // Déterminer les valeurs réelles des barrières
    let barrierHit = false;
    
    if (instrument.upperBarrier !== undefined) {
        const upperBarrierValue = instrument.upperBarrierType === 'percent'
            ? initialSpotRateForStrike * (instrument.upperBarrier / 100)
            : instrument.upperBarrier;
            
        // Vérifier si la barrière est touchée en fonction du type d'option
        if (isCall && !isReverse) {
            // Call standard KO/KI (up): barrière touchée si spot >= barrier
            barrierHit = realRate >= upperBarrierValue;
        } else if (isCall && isReverse) {
            // Call reverse KO/KI (down): barrière touchée si spot <= barrier
            barrierHit = realRate <= upperBarrierValue;
        } else if (!isCall && !isReverse) {
            // Put standard KO/KI (down): barrière touchée si spot <= barrier
            barrierHit = realRate <= upperBarrierValue;
        } else if (!isCall && isReverse) {
            // Put reverse KO/KI (up): barrière touchée si spot >= barrier
            barrierHit = realRate >= upperBarrierValue;
        }
    } 
    else if (instrument.lowerBarrier !== undefined) {
        const lowerBarrierValue = instrument.lowerBarrierType === 'percent'
            ? initialSpotRateForStrike * (instrument.lowerBarrier / 100)
            : instrument.lowerBarrier;
            
        // Barrière inférieure touchée si le prix < barrière inférieure
        barrierHit = realRate <= lowerBarrierValue;
    }
    else {
        // Cas de barrière non spécifiée, on utilise le strike comme proxy de la barrière
        const strikeRate = instrument.strikeType === 'percent'
            ? initialSpotRateForStrike * (instrument.strike / 100)
            : instrument.strike;
            
        // Par défaut pour KO Call: barrière supérieure, KO Put: barrière inférieure
        if (instrument.type.includes('call')) {
            barrierHit = realRate >= strikeRate;
        } else {
            barrierHit = realRate <= strikeRate;
        }
    }

    // Appliquer la logique de la barrière
    if (isKO) {
        // Knock-Out: Si la barrière est touchée, l'option disparaît (payoff = 0)
        return barrierHit ? 0 : basePayoff;
    } else if (isKI) {
        // Knock-In: Si la barrière est touchée, l'option s'active (sinon payoff = 0)
        return barrierHit ? basePayoff : 0;
    }

    // Fallback (ne devrait pas arriver)
    return basePayoff;
  };

  const erf = (x: number): number => {
    // Relation entre erf et la fonction cumulative normale standard (cnd) :
    // erf(x) = 2*cnd(x * Math.sqrt(2)) - 1
    return 2 * cnd(x * Math.sqrt(2)) - 1;
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

  // Helper function to replace calculateOptionPrice
  const calculateOptionPrice = (type: string, S: number, K: number, r_d: number, r_f: number, T: number, sigma: number): number => {
    if (type.toLowerCase() === "c" || type.toLowerCase().includes("call")) {
      return calculateCall(S, K, T, r_d, r_f, sigma);
    } else if (type.toLowerCase() === "p" || type.toLowerCase().includes("put")) {
      return calculatePut(S, K, T, r_d, r_f, sigma);
    } else {
      console.error('Unknown option type:', type);
      return 0;
    }
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
    
    // Appliquer le choc de différentiel de taux si un scénario de stress test est actif
    let adjustedDomesticRate = r_d;
    let adjustedForeignRate = r_f;
    
    if (activeStressTestScenario) {
      console.log("Applying stress test scenario:", activeStressTestScenario);
      if (activeStressTestScenario.rateDifferentialShock !== undefined && activeStressTestScenario.rateDifferentialShock !== 0) {
        // Le choc élargit ou réduit l'écart entre les taux
        // Nous utilisons un choc complet (progressFactor = 1) pour le graphique,
        // car il représente généralement la situation à l'échéance
        adjustedDomesticRate = r_d + (activeStressTestScenario.rateDifferentialShock / 2);
        adjustedForeignRate = r_f - (activeStressTestScenario.rateDifferentialShock / 2);
        console.log(`Adjusted rates: Domestic ${adjustedDomesticRate*100}%, Foreign ${adjustedForeignRate*100}%`);
      }
    }
    
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
        
        // Si "Use Implied Volatility" est activé, nous récupérons les volatilités historiques
        if (useImpliedVolatility) {
            // Créer un tableau temporaire pour stocker les volatilités historiques pour chaque mois
            const historicalVols: Record<string, number> = {};
            
            // Parcourir les statistiques mensuelles et stocker les volatilités
            monthlyStats.forEach(stat => {
                if (stat.volatility !== null) {
                    historicalVols[stat.month] = stat.volatility * 100; // Convertir en pourcentage
                }
            });
            
            console.log("Using historical volatilities for implied vol:", historicalVols);
            setImpliedVolatilities(historicalVols);
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

    // Appliquer le choc du stress test aux taux réels si nécessaire
    if (activeStressTestScenario && activeStressTestScenario.rateShock !== 0) {
      console.log("Applying rate shock to real rates:", activeStressTestScenario.rateShock);
      // Application progressive du choc sur les taux réels
      // Les chocs sont appliqués de manière croissante sur les mois:
      // - Mois 1: ~16% de l'effet total
      // - Mois 2: ~33% de l'effet total
      // - Mois 3: ~50% de l'effet total
      // - Mois 4: ~67% de l'effet total
      // - Mois 5: ~83% de l'effet total
      // - Mois 6 et au-delà: 100% de l'effet total
      // Cette progression simule la transmission graduelle des chocs économiques dans le temps
      realRates = realRates.map((rate, index) => {
        // Calculer un facteur progressif basé sur l'index (mois)
        // Plus le mois est éloigné, plus l'effet du choc est important
        const progressFactor = Math.min(1, (index + 1) / Math.min(6, months.length));
        return rate * (1 + activeStressTestScenario.rateShock * progressFactor);
      });
    }

    months.forEach((date, index) => {
        // Time to maturity in years - calcul correct sans biais
        const t = Math.max(1/365.25, (date.getTime() - currentStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)); 
        const realRate = realRates[index];
        const monthlyVolume = params.totalVolume / params.monthsToHedge;
        
        // Facteur progressif pour les chocs - varie en fonction du temps
        const progressFactor = Math.min(1, (index + 1) / Math.min(6, months.length));
        
        // Calculer le taux forward en utilisant les taux ajustés avec un effet progressif
        let currentDomesticRate = r_d;
        let currentForeignRate = r_f;
        
        if (activeStressTestScenario && activeStressTestScenario.rateDifferentialShock !== undefined) {
          const currentRateDiffShock = activeStressTestScenario.rateDifferentialShock * progressFactor;
          // Application progressive du choc de différentiel de taux
          currentDomesticRate = r_d + (currentRateDiffShock / 2);
          currentForeignRate = r_f - (currentRateDiffShock / 2);
        }
        
        // Forward rate calculation: F = S * exp((r_d - r_f) * T)
        const forwardRate = S * Math.exp((currentDomesticRate - currentForeignRate) * t);
        
        // Appliquer le choc direct aux points forwards si spécifié, avec effet progressif
        let adjustedForwardRate = forwardRate;
        if (activeStressTestScenario && activeStressTestScenario.forwardPointsShock !== undefined && activeStressTestScenario.forwardPointsShock !== 0) {
          // Les points forwards sont exprimés en % du taux spot, avec choc progressif
          const currentFwdPointsShock = activeStressTestScenario.forwardPointsShock * progressFactor;
          adjustedForwardRate += S * currentFwdPointsShock;
        }

        let totalPremiumPerUnit = 0;
        let totalPayoffPerUnit = 0;
        const optionPricesDetails: ForexResult['optionPrices'] = [];

        // Si nous utilisons des volatilités implicites historiques, récupérons la volatilité pour ce mois
        let currentVolatility = vol;
        if (useImpliedVolatility) {
            const monthKey = date.toISOString().split('T')[0].substring(0, 7); // Format YYYY-MM
            if (impliedVolatilities[monthKey] !== undefined) {
                currentVolatility = impliedVolatilities[monthKey] / 100; // Convertir de pourcentage à décimal
                console.log(`Using implied volatility ${currentVolatility * 100}% for month ${monthKey}`);
            }
        }

        if (selectedStrategy === 'custom') {
             // --- Custom Strategy Calculation --- START
             customStrategyComponents.forEach(comp => {
                const strikeRate = comp.strikeType === 'percent' ? initialS * (comp.strike / 100) : comp.strike;
                const componentVol = (comp.volatility || vol * 100) / 100; // Use component's vol or default
                const quantityFactor = comp.quantity / 100;
                const isLongPosition = quantityFactor > 0; // Achat si positif, vente si négatif
                let premium = 0;
                let payoff = 0;
                let priceLabel = `${comp.type} @ ${strikeRate.toFixed(4)}`;

                // Premium Calculation - Use appropriate model based on option type
                if (comp.type === 'call' || comp.type === 'put') {
                    // Use Garman-Kohlhagen (Black-Scholes for FX) for vanilla options
                    premium = calculateOptionPrice(comp.type, S, strikeRate, r_d, r_f, t, componentVol) * Math.abs(quantityFactor);
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
                        Math.abs(comp.quantity)
                    );
                    
                    console.log(`Barrier option premium calculated: ${premium.toFixed(6)} for ${comp.type} strike=${strikeRate}, barriers=${upperBarrier},${lowerBarrier}`);
                }

                // Payoff Calculation (using helper)
                const basePayoff = comp.type.includes('call') ? Math.max(0, realRate - strikeRate) : Math.max(0, strikeRate - realRate);
                const calculatedPayoff = calculateBarrierPayoff(comp, realRate, basePayoff, initialS);
                payoff = calculatedPayoff * Math.abs(quantityFactor);
                
                // Debug log for vanilla options
                if (comp.type === 'call' || comp.type === 'put') {
                    console.log(`Vanilla ${comp.type} payoff debug:`, {
                        type: comp.type,
                        realRate: realRate.toFixed(4),
                        strikeRate: strikeRate.toFixed(4),
                        basePayoff: basePayoff.toFixed(5),
                        calculatedPayoff: calculatedPayoff.toFixed(5),
                        quantityFactor: quantityFactor.toFixed(2),
                        finalPayoff: payoff.toFixed(5)
                    });
                }

                 if (!isNaN(premium)) {
                     // Pour une position longue (achat), premium est un coût
                     // Pour une position courte (vente), premium est un gain
                     totalPremiumPerUnit += isLongPosition ? premium : -premium;
                     optionPricesDetails.push({
                         type: comp.type,
                         price: premium / Math.abs(quantityFactor),
                         quantity: comp.quantity, // Garde le signe pour indiquer achat/vente
                         strike: strikeRate,
                         label: priceLabel
                     });
                 } else { console.warn(`NaN premium calculated for custom component:`, comp); }
                 
                 if (!isNaN(payoff)) {
                     // Pour une position longue (achat), payoff positif est un gain
                     // Pour une position courte (vente), payoff positif est une perte
                     totalPayoffPerUnit += isLongPosition ? payoff : -payoff;
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
                    totalPremiumPerUnit = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, currentVolatility) * (optionQuantity / 100);
                    break;
                case 'put':
                    totalPremiumPerUnit = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, currentVolatility) * (optionQuantity / 100);
                    break;
                case 'collarPut':
                case 'collarCall':
                    // For zero cost collars, calculate the offset premiums
                    const putCollarPremium = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, currentVolatility);
                    const callCollarPremium = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, currentVolatility);
                    totalPremiumPerUnit = putCollarPremium - callCollarPremium; // Should be near zero for zero-cost collar
                    break;
                case 'callKO':
                    // Use factor to approximate barrier option premium being cheaper than vanilla
                    totalPremiumPerUnit = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, currentVolatility) * 0.7;
                    break;
                case 'putKI':
                    // Use factor to approximate barrier option premium being cheaper than vanilla
                    totalPremiumPerUnit = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, currentVolatility) * 0.7;
                    break;
                case 'strangle':
                    const stranglePutPremium = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, currentVolatility);
                    const strangleCallPremium = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, currentVolatility);
                    totalPremiumPerUnit = stranglePutPremium + strangleCallPremium;
                    break;
                case 'straddle':
                     const straddlePutPremium = calculateOptionPrice('put', S, strikeMid, r_d, r_f, t, currentVolatility);
                     const straddleCallPremium = calculateOptionPrice('call', S, strikeMid, r_d, r_f, t, currentVolatility);
                     totalPremiumPerUnit = straddlePutPremium + straddleCallPremium;
                     break;
                case 'seagull':
                     const seagullPutBuyPremium = calculateOptionPrice('put', S, strikeMid, r_d, r_f, t, currentVolatility);
                     const seagullCallSellPremium = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, currentVolatility);
                     const seagullPutSellPremium = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, currentVolatility);
                     totalPremiumPerUnit = seagullPutBuyPremium - seagullCallSellPremium - seagullPutSellPremium;
                     break;
                case 'callPutKI_KO':
                     const callKOPremium = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, currentVolatility) * 0.7;
                     const putKIPremium = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, currentVolatility) * 0.7;
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
                     totalPayoffPerUnit = adjustedForwardRate - realRate;
                     break;
                 case 'call':
                     totalPayoffPerUnit = Math.max(0, realRate - strikeUpper) * (optionQuantity / 100);
                     break;
                 case 'put':
                     totalPayoffPerUnit = Math.max(0, strikeLower - realRate) * (optionQuantity / 100);
                     break;
                 case 'collarPut': // Long Put (strikeLower), Short Call (strikeUpper)
                 case 'collarCall': // Assuming strikes are correctly set for zero cost
                      // Collar payoff: protection en dessous de put strike, limitation au-dessus de call strike
                      if (realRate <= strikeLower) {
                          // Protection du put activée
                          totalPayoffPerUnit = strikeLower - realRate;
                      } else if (realRate >= strikeUpper) {
                          // Limitation du call vendu activée
                          totalPayoffPerUnit = strikeUpper - realRate; // Négatif car obligation de vendre au strike
                      } else {
                          // Entre les deux strikes, pas de payoff
                          totalPayoffPerUnit = 0;
                      }
                      break;
                 case 'callKO': // Payoff = max(0, realRate - strikeUpper) if realRate < barrierUpper, else 0
                     totalPayoffPerUnit = (realRate < barrierUpper) ? Math.max(0, realRate - strikeUpper) : 0;
                     break;
                 case 'putKI': // Put Knock-In: s'active si le taux touche/dépasse la barrière (typiquement au-dessus)
                     totalPayoffPerUnit = (realRate >= barrierUpper) ? Math.max(0, strikeLower - realRate) : 0; 
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
                      const putKIPayoff = (realRate <= barrierLower) ? Math.max(0, strikeLower - realRate) : 0;
                      totalPayoffPerUnit = callKOPayoff + putKIPayoff;
                      break;
                 default:
                     totalPayoffPerUnit = 0; // Default for unhandled strategies
             }
             // --- Standard Strategy Calculation --- END
        }

        // --- Common Result Calculation --- START
        const unhedgedRevenue = monthlyVolume * realRate;
        let premiumPaid = monthlyVolume * totalPremiumPerUnit;
        let payoffFromHedge = monthlyVolume * totalPayoffPerUnit;
        
        // Note: payoffs sont déjà calculés correctement dans les sections précédentes
        
        const hedgedRevenue = unhedgedRevenue + payoffFromHedge - premiumPaid;
        const pnlVsUnhedged = payoffFromHedge - premiumPaid;
        // Effective rate: le taux effectif payé après hedging
        // Si l'entreprise achète avec volume monthlyVolume, quel est le taux effectif ?
        // Effective Rate = (coût total) / volume = (premiumPaid - payoffFromHedge + monthlyVolume * realRate) / monthlyVolume
        // Simplifie à: realRate + (premiumPaid - payoffFromHedge) / monthlyVolume
        const effectiveRate = monthlyVolume === 0 ? realRate : realRate + (premiumPaid - payoffFromHedge) / monthlyVolume;

        resultsArray.push({
            date: date.toISOString().split('T')[0],
            timeToMaturity: t,
            forwardRate: adjustedForwardRate,
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
            impliedVolatility: useImpliedVolatility ? (currentVolatility * 100) : undefined, // Ajouter la volatilité en pourcentage
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

    // Appliquer le choc de différentiel de taux si un scénario de stress test est actif
    let adjustedDomesticRate = r_d;
    let adjustedForeignRate = r_f;
    
    if (activeStressTestScenario) {
      if (activeStressTestScenario.rateDifferentialShock !== undefined && activeStressTestScenario.rateDifferentialShock !== 0) {
        // Le choc élargit ou réduit l'écart entre les taux
        // Nous utilisons un choc complet (progressFactor = 1) pour le graphique,
        // car il représente généralement la situation à l'échéance
        adjustedDomesticRate = r_d + (activeStressTestScenario.rateDifferentialShock / 2);
        adjustedForeignRate = r_f - (activeStressTestScenario.rateDifferentialShock / 2);
      }
    }

    // Get strategy parameters from params object
    const strikeUpper = params.strikeUpper || params.spotRate * 1.05;
    const strikeLower = params.strikeLower || params.spotRate * 0.95;
    const strikeMid = params.strikeMid || params.spotRate;
    const barrierUpper = params.barrierUpper || params.spotRate * 1.10;
    const barrierLower = params.barrierLower || params.spotRate * 0.90;
    const optionQuantity = params.optionQuantity || 100;
    const quantityFactor = optionQuantity / 100;
    
    const chartForwardRate = spot * Math.exp((adjustedDomesticRate - adjustedForeignRate) * t);
    
    // Appliquer le choc direct aux points forwards si spécifié
    let adjustedChartForwardRate = chartForwardRate;
    if (activeStressTestScenario && activeStressTestScenario.forwardPointsShock !== undefined && activeStressTestScenario.forwardPointsShock !== 0) {
      // Les points forwards sont exprimés en % du taux spot
      adjustedChartForwardRate += spot * activeStressTestScenario.forwardPointsShock;
    }

    for (let i = 0; i <= payoffPoints; i++) {
        const currentSpot = spot - range + i * step; // The spot rate for this point on the X-axis
        let premiumCost = 0;
        let payoffAtSpot = 0;
        const optionDetailsForChart = {}; // For chart reference lines

        if (selectedStrategy === 'custom') {
            // --- Custom Strategy Payoff for Chart --- START
            customStrategyComponents.forEach((comp, idx) => {
                const strikeRate = comp.strikeType === 'percent' ? initialS * (comp.strike / 100) : comp.strike;
                const componentVol = (comp.volatility || vol * 100) / 100;
                // Important: Appliquer le signe de la quantité pour identifier achat vs vente
                const quantityFactor = comp.quantity / 100;
                const isLongPosition = quantityFactor > 0; // Achat si positif, vente si négatif
                let componentPremium = 0;

                // Premium (calculated at current 'spot')
                if (comp.type === 'call' || comp.type === 'put') { 
                    componentPremium = calculateOptionPrice(comp.type, spot, strikeRate, r_d, r_f, t, componentVol) * Math.abs(quantityFactor); 
                }
                else if (comp.type.includes('knock')) { 
                    componentPremium = calculateOptionPrice(comp.type.includes('call') ? 'call' : 'put', spot, strikeRate, r_d, r_f, t, componentVol) * Math.abs(quantityFactor); 
                }
                
                // Pour une position longue (achat), le premium est un coût (négatif)
                // Pour une position courte (vente), le premium est un gain (positif)
                premiumCost += isNaN(componentPremium) ? 0 : (isLongPosition ? -componentPremium : componentPremium);

                // Calculate the base payoff for the option
                let basePayoff = 0;
                if (comp.type.includes('call')) {
                    basePayoff = Math.max(0, currentSpot - strikeRate);
                } else if (comp.type.includes('put')) {
                    basePayoff = Math.max(0, strikeRate - currentSpot);
                }
                
                // Apply barrier logic if needed
                const componentPayoff = calculateBarrierPayoff(comp, currentSpot, basePayoff, initialS);
                
                // Apply quantity - maintain the sign to correctly reflect buy/sell
                // Pour un achat (long), le payoff positif est un gain (reste positif)
                // Pour une vente (short), le payoff positif est une perte (devient négatif)
                payoffAtSpot += isNaN(componentPayoff) ? 0 : (componentPayoff * quantityFactor);

                // Store details for chart reference lines
                optionDetailsForChart[`${comp.type}_${idx}_Strike`] = strikeRate;
                if (comp.upperBarrier) { 
                    optionDetailsForChart[`${comp.type}_${idx}_Upper Barrier`] = comp.upperBarrierType === 'percent' 
                        ? initialS * (comp.upperBarrier / 100) 
                        : comp.upperBarrier; 
                }
                if (comp.lowerBarrier) { 
                    optionDetailsForChart[`${comp.type}_${idx}_Lower Barrier`] = comp.lowerBarrierType === 'percent' 
                        ? initialS * (comp.lowerBarrier / 100) 
                        : comp.lowerBarrier; 
                }
            });
            // --- Custom Strategy Payoff for Chart --- END
        } else {
            // --- Standard Strategy Payoff for Chart --- START
            // Calculate Premium Cost (at current 'spot')
            switch (selectedStrategy) {
                case 'forward': 
                    premiumCost = 0; 
                    optionDetailsForChart['Forward Rate'] = adjustedChartForwardRate; 
                    break;
                case 'call': 
                    // For a long call, the premium is negative (cost)
                    premiumCost = -calculateOptionPrice('call', spot, strikeUpper, r_d, r_f, t, vol) * quantityFactor; 
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    break;
                case 'put': 
                    // For a long put, the premium is negative (cost)
                    premiumCost = -calculateOptionPrice('put', spot, strikeLower, r_d, r_f, t, vol) * quantityFactor; 
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    break;
                case 'collarPut':
                    // For zero cost collars, the premiums should offset each other
                    const putCollarPremium = calculateOptionPrice('put', spot, strikeLower, r_d, r_f, t, vol);
                    const callCollarPremium = calculateOptionPrice('call', spot, strikeUpper, r_d, r_f, t, vol);
                    premiumCost = -(putCollarPremium - callCollarPremium); // Should be near zero for properly structured collar
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    break;
                case 'callKO': 
                    // Approximate KO premium using vanilla option price adjusted
                    premiumCost = -calculateOptionPrice('call', spot, strikeUpper, r_d, r_f, t, vol) * 0.7 * quantityFactor; // Adjust factor
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    optionDetailsForChart['KO Barrier'] = barrierUpper; 
                    break;
                case 'putKI': 
                    // Approximate KI premium using vanilla option price adjusted
                    premiumCost = -calculateOptionPrice('put', spot, strikeLower, r_d, r_f, t, vol) * 0.7 * quantityFactor; // Adjust factor
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    optionDetailsForChart['KI Barrier'] = barrierLower; 
                    break;
                case 'strangle': 
                    premiumCost = -(calculateOptionPrice('put', spot, strikeLower, r_d, r_f, t, vol) 
                                + calculateOptionPrice('call', spot, strikeUpper, r_d, r_f, t, vol)) * quantityFactor;
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    break;
                case 'straddle': 
                    premiumCost = -(calculateOptionPrice('put', spot, strikeMid, r_d, r_f, t, vol) 
                                + calculateOptionPrice('call', spot, strikeMid, r_d, r_f, t, vol)) * quantityFactor; 
                    optionDetailsForChart['Strike'] = strikeMid; 
                    break;
                case 'seagull':
                    const buyPutPremium = calculateOptionPrice('put', spot, strikeMid, r_d, r_f, t, vol);
                    const sellCallPremium = calculateOptionPrice('call', spot, strikeUpper, r_d, r_f, t, vol);
                    const sellPutPremium = calculateOptionPrice('put', spot, strikeLower, r_d, r_f, t, vol);
                    premiumCost = -(buyPutPremium - sellCallPremium - sellPutPremium) * quantityFactor;
                    optionDetailsForChart['Buy Put Strike'] = strikeMid; 
                    optionDetailsForChart['Sell Call Strike'] = strikeUpper; 
                    optionDetailsForChart['Sell Put Strike'] = strikeLower;
                    break;
                case 'callPutKI_KO': 
                    // Approximating complex barrier structure with adjusted pricing
                    const callKOPremium = calculateOptionPrice('call', spot, strikeUpper, r_d, r_f, t, vol) * 0.7;
                    const putKIPremium = calculateOptionPrice('put', spot, strikeLower, r_d, r_f, t, vol) * 0.7;
                    premiumCost = -(callKOPremium + putKIPremium) * quantityFactor;
                    optionDetailsForChart['Call Strike'] = strikeUpper; 
                    optionDetailsForChart['Put Strike'] = strikeLower; 
                    optionDetailsForChart['Upper Barrier (KO)'] = barrierUpper; 
                    optionDetailsForChart['Lower Barrier (KI)'] = barrierLower;
                    break;
                default: 
                    premiumCost = 0;
             }

             // Calculate Payoff (at 'currentSpot' on the chart's x-axis)
             // IMPORTANT: We're calculating from the perspective of managing FX risk (buying options)
             switch (selectedStrategy) {
                 case 'forward': 
                     payoffAtSpot = adjustedChartForwardRate - currentSpot; 
                     break;
                 case 'call': 
                     // Long call: we gain when spot > strike (pay strike instead of spot)
                     payoffAtSpot = Math.max(0, currentSpot - strikeUpper) * quantityFactor; 
                     break;
                 case 'put': 
                     // Long put: we gain when spot < strike (pay strike instead of spot)
                     payoffAtSpot = Math.max(0, strikeLower - currentSpot) * quantityFactor; 
                     break;
                 case 'collarPut': case 'collarCall': 
                     // Long put, short call: gain on downside, lose on upside
                     payoffAtSpot = Math.max(0, strikeLower - currentSpot) - Math.max(0, currentSpot - strikeUpper); 
                     break;
                 case 'callKO': 
                     // Call KO (up-and-out): KO if spot >= barrier
                     payoffAtSpot = (currentSpot < barrierUpper) ? Math.max(0, currentSpot - strikeUpper) * quantityFactor : 0; 
                     break;
                 case 'putKI': 
                     // Put KI (down-and-in): KI if spot <= barrier
                     // Corrected to match financial principle: Put KI only activates when spot falls below barrier
                     payoffAtSpot = (currentSpot <= barrierLower) ? Math.max(0, strikeLower - currentSpot) * quantityFactor : 0; 
                     break;
                 case 'strangle': 
                     payoffAtSpot = (Math.max(0, strikeLower - currentSpot) + Math.max(0, currentSpot - strikeUpper)) * quantityFactor; 
                     break;
                 case 'straddle': 
                     payoffAtSpot = (Math.max(0, strikeMid - currentSpot) + Math.max(0, currentSpot - strikeMid)) * quantityFactor; 
                     break;
                 case 'seagull': 
                     payoffAtSpot = (Math.max(0, strikeMid - currentSpot) 
                                   - Math.max(0, currentSpot - strikeUpper) 
                                   - Math.max(0, strikeLower - currentSpot)) * quantityFactor;
                     break;
                 case 'callPutKI_KO': 
                     // Call KO (up-and-out): KO if spot >= upperBarrier
                     const callKOPayoffChart = (currentSpot < barrierUpper) ? Math.max(0, currentSpot - strikeUpper) : 0;
                     // Put KI (down-and-in): KI if spot <= lowerBarrier
                     const putKIPayoffChart = (currentSpot <= barrierLower) ? Math.max(0, strikeLower - currentSpot) : 0;
                     payoffAtSpot = (callKOPayoffChart + putKIPayoffChart) * quantityFactor;
                     break;
                 default: 
                     payoffAtSpot = 0;
             }
            // --- Standard Strategy Payoff for Chart --- END
        }

        // --- Common Payoff Data Point Creation --- START
        // La payoffAtSpot représente le gain/perte sur l'option en terme de prime par unité
        // Pour le taux hedgé, dans un contexte FX, il faut ajouter ce payoff au taux spot pour un importateur
        // et le soustraire pour un exportateur. Par défaut, nous considérons la perspective d'un importateur.
        
        // Par convention, pour un importateur (qui achète la devise étrangère):
        // - Un call protège contre la hausse de taux (si le taux monte, l'option compense)
        // - Un put protège contre la baisse de taux (si le taux baisse, on exerce l'option pour vendre au strike)
        
        // Hedged rate est le taux "effectif" après application des gains/pertes de l'option
        // CORRIGÉ: Pour un acheteur de devise (importateur), le payoff positif RÉDUIT le taux effectif
        const hedgedRateWithoutPremium = currentSpot - payoffAtSpot;
        
        // Hedged rate avec premium inclut le coût de la prime
        // Pour les valeurs négatives de premiumCost (coût), cela augmente le taux effectif
        const hedgedRateWithPremium = hedgedRateWithoutPremium - premiumCost;
        
        // Build the data point object exactly as expected by PayoffChart component
        const dataPoint = {
            spot: currentSpot,
            "Unhedged Rate": currentSpot,
            // Apply includePremium logic - if includePremium is true, show rate with premium cost included
            "Hedged Rate": includePremium ? hedgedRateWithPremium : hedgedRateWithoutPremium,
            // Add comparison line based on includePremium setting (opposite value)
            ...(includePremium 
                ? { "Hedged Rate (No Premium)": hedgedRateWithoutPremium } 
                : { "Hedged Rate with Premium": hedgedRateWithPremium }),
            // Add reference lines for strikes and barriers
            ...optionDetailsForChart
        };
        
        data.push(dataPoint);
        // --- Common Payoff Data Point Creation --- END
    }
    
    setPayoffData(data);
    console.log("Payoff data calculated for chart:", data.length, "points");
  };

  const applyStressTest = (key: string) => {
    setActiveStressTestKey(key);
    const scenario = key === 'custom' ? customStressScenario : stressTestScenarios[key];
    if (!scenario) return;

    // Save original state including custom strategy components
    setOriginalParams(params);
    setOriginalRealRateParams(realRateParams);
    setOriginalCustomStrategyComponents([...customStrategyComponents]); // Save a copy of the custom strategy components

    // Modifications:
    // 1. On n'applique plus le choc directement au taux spot
    // 2. On stocke le scénario actif pour l'appliquer lors du calcul des résultats

    // Mise à jour de la volatilité uniquement
    setRealRateParams(prev => ({
        ...prev,
        volatility: scenario.volatility * 100, // Convertir en pourcentage
    }));
    
    // On conserve le scénario pour l'appliquer lors du calcul
    setActiveStressTestScenario(scenario);

    setTimeout(() => calculateResults(), 0);
  };

  const clearStressTest = () => {
    if (originalParams && originalRealRateParams) {
        setParams(originalParams);
        setRealRateParams(originalRealRateParams);
        
        // Restore custom strategy components if they were saved
        if (originalCustomStrategyComponents) {
            setCustomStrategyComponents([...originalCustomStrategyComponents]);
            setOriginalCustomStrategyComponents(null);
        }
        
        setOriginalParams(null);
        setOriginalRealRateParams(null);
        setActiveStressTestKey(null);
        setActiveStressTestScenario(null);

        setTimeout(() => calculateResults(), 0);
    } else {
        setActiveStressTestKey(null);
        setActiveStressTestScenario(null);
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
        selectedStrategy: 'custom',
    });
    setInitialSpotRate(1.10);
    setResults([]);
    setPayoffData([]);
    setSelectedPair("EUR/USD");
    setSelectedStrategy('custom');
    setRealRateParams({
        useSimulation: false,
        volatility: 8.0, // CORRECTED: Realistic FX volatility (8% instead of 15%) - Major currency pairs typically trade at 6-12% annual volatility
        numSimulations: 1000, // Increased default from lower value
        additionalDrift: 0, // Tendance annuelle supplémentaire en %
        ignoreDriftFromRates: false, // Ignorer le drift lié aux taux d'intérêt
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

  // Modifier la fonction handleRateChange pour prendre en compte les changements de Premium/Unit
  const handleRateChange = (index: number, field: 'forwardRate' | 'realRate' | 'impliedVolatility' | 'strategyPrice', value: string) => {
    // Vérifier que la valeur est un nombre valide
    const newValue = parseFloat(value);
    if (isNaN(newValue) || (field !== 'impliedVolatility' && field !== 'strategyPrice' && newValue <= 0) || (field === 'impliedVolatility' && newValue < 0)) return;

    // Créer une copie de l'array des résultats
    const updatedResults = [...results];
    
    // Mettre à jour le taux spécifié
    if (field === 'impliedVolatility') {
      // Si le champ n'existe pas encore, créons-le
      if (updatedResults[index].impliedVolatility === undefined) {
        updatedResults[index].impliedVolatility = newValue;
      } else {
        updatedResults[index].impliedVolatility = newValue;
      }
    } else if (field === 'strategyPrice') {
      // Mettre à jour directement le prix de la stratégie (prime par unité)
      updatedResults[index].strategyPrice = newValue;
      
      // Recalculer les montants basés sur la nouvelle prime
      const monthlyVolume = updatedResults[index].monthlyVolume;
      const premiumPaid = monthlyVolume * newValue;
      
      // Mettre à jour la prime payée
      updatedResults[index].premiumPaid = premiumPaid;
      
      // Recalculer les revenus couverts et le P&L
      const payoffFromHedge = updatedResults[index].payoffFromHedge;
      updatedResults[index].hedgedRevenue = updatedResults[index].unhedgedRevenue + payoffFromHedge - premiumPaid;
      updatedResults[index].pnlVsUnhedged = payoffFromHedge - premiumPaid;
      
      // Recalculer le taux effectif
      updatedResults[index].effectiveRate = monthlyVolume === 0 ? updatedResults[index].realRate : updatedResults[index].hedgedRevenue / monthlyVolume;
    } else {
      updatedResults[index][field] = newValue;
    }
    
    // Récupérer les données courantes de la ligne
    const row = updatedResults[index];
    const monthlyVolume = row.monthlyVolume;
    const t = row.timeToMaturity;
    const S = params.spotRate; // Spot rate pour le calcul des primes
    const r_d = params.domesticRate / 100;
    const r_f = params.foreignRate / 100;
    
    // Si c'est la volatilité qui a changé, recalculer les primes (sauf si le premium est en override)
    if (field === 'impliedVolatility' && !usePremiumOverride) {
      let totalPremiumPerUnit = 0;
      const vol = newValue / 100; // La volatilité est en pourcentage, la convertir en décimal
      
      if (selectedStrategy === 'custom') {
        // Pour une stratégie personnalisée, recalculer pour chaque composant
        customStrategyComponents.forEach(comp => {
          const strikeRate = comp.strikeType === 'percent' 
            ? initialSpotRate * (comp.strike / 100) 
            : comp.strike;
          const quantityFactor = comp.quantity / 100;
          let premium = 0;
          
          // Recalculer la prime avec la nouvelle volatilité
          if (comp.type === 'call' || comp.type === 'put') {
            premium = calculateOptionPrice(
              comp.type as 'call' | 'put', 
              S, 
              strikeRate, 
              r_d, 
              r_f, 
              t, 
              vol
            ) * quantityFactor;
          } else if (comp.type.includes('KO') || comp.type.includes('KI')) {
            // Pour les options à barrière, on approxime avec un facteur de réduction
            const baseOption = comp.type.includes('call') ? 'call' : 'put';
            premium = calculateOptionPrice(
              baseOption as 'call' | 'put',
              S,
              strikeRate,
              r_d,
              r_f,
              t,
              vol
            ) * 0.7 * quantityFactor; // Facteur de réduction pour les barrières
          }
          
          if (!isNaN(premium)) {
            totalPremiumPerUnit += premium;
          }
        });
      } else {
        // Pour les stratégies standards
        const strikeUpper = params.strikeUpper || params.spotRate * 1.05;
        const strikeLower = params.strikeLower || params.spotRate * 0.95;
        const strikeMid = params.strikeMid || params.spotRate;
        const optionQuantity = params.optionQuantity || 100;
        
        switch (selectedStrategy) {
          case 'forward':
            totalPremiumPerUnit = 0; // Les forwards n'ont pas de prime
            break;
          case 'call':
            totalPremiumPerUnit = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, vol) * (optionQuantity / 100);
            break;
          case 'put':
            totalPremiumPerUnit = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, vol) * (optionQuantity / 100);
            break;
          case 'collarPut':
          case 'collarCall':
            // Zero-cost collar
            const putCollarPremium = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, vol);
            const callCollarPremium = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, vol);
            totalPremiumPerUnit = putCollarPremium - callCollarPremium;
            break;
          case 'callKO':
            totalPremiumPerUnit = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, vol) * 0.7;
            break;
          case 'putKI':
            totalPremiumPerUnit = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, vol) * 0.7;
            break;
          case 'strangle':
            const stranglePutPremium = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, vol);
            const strangleCallPremium = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, vol);
            totalPremiumPerUnit = stranglePutPremium + strangleCallPremium;
            break;
          case 'straddle':
            const straddlePutPremium = calculateOptionPrice('put', S, strikeMid, r_d, r_f, t, vol);
            const straddleCallPremium = calculateOptionPrice('call', S, strikeMid, r_d, r_f, t, vol);
            totalPremiumPerUnit = straddlePutPremium + straddleCallPremium;
            break;
          case 'seagull':
            const seagullPutBuyPremium = calculateOptionPrice('put', S, strikeMid, r_d, r_f, t, vol);
            const seagullCallSellPremium = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, vol);
            const seagullPutSellPremium = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, vol);
            totalPremiumPerUnit = seagullPutBuyPremium - seagullCallSellPremium - seagullPutSellPremium;
            break;
          case 'callPutKI_KO':
            const callKOPremium = calculateOptionPrice('call', S, strikeUpper, r_d, r_f, t, vol) * 0.7;
            const putKIPremium = calculateOptionPrice('put', S, strikeLower, r_d, r_f, t, vol) * 0.7;
            totalPremiumPerUnit = callKOPremium + putKIPremium;
            break;
          default:
            totalPremiumPerUnit = 0;
        }
      }
      
      // Mettre à jour la prime et les valeurs associées
      updatedResults[index].strategyPrice = totalPremiumPerUnit;
      const premiumPaid = monthlyVolume * totalPremiumPerUnit;
      updatedResults[index].premiumPaid = premiumPaid;
      
      // Recalculer les valeurs qui dépendent de la prime
      const payoffFromHedge = updatedResults[index].payoffFromHedge;
      updatedResults[index].hedgedRevenue = updatedResults[index].unhedgedRevenue + payoffFromHedge - premiumPaid;
      updatedResults[index].pnlVsUnhedged = payoffFromHedge - premiumPaid;
      updatedResults[index].effectiveRate = monthlyVolume === 0 ? updatedResults[index].realRate : updatedResults[index].hedgedRevenue / monthlyVolume;
    }
    
    // Recalculer payoff en fonction du nouveau taux réel (si c'est le real rate qui est modifié)
    if (field === 'realRate') {
      let totalPayoffPerUnit = 0;
      
      if (selectedStrategy === 'custom') {
        // Pour une stratégie personnalisée, recalculer pour chaque composant
        totalPayoffPerUnit = 0; // Réinitialiser
        customStrategyComponents.forEach(comp => {
          const strikeRate = comp.strikeType === 'percent' 
            ? initialSpotRate * (comp.strike / 100) 
            : comp.strike;
          const quantityFactor = comp.quantity / 100;
          
          // Calculer le payoff de base en fonction du nouveau taux réel
          const basePayoff = comp.type.includes('call') 
            ? Math.max(0, newValue - strikeRate) 
            : Math.max(0, strikeRate - newValue);
          
          // Appliquer les effets de barrière si nécessaire
          const componentPayoff = calculateBarrierPayoff(comp, newValue, basePayoff, initialSpotRate) * quantityFactor;
          
          if (!isNaN(componentPayoff)) {
            totalPayoffPerUnit += componentPayoff;
          }
        });
      } else {
        // Pour les stratégies standards
        const strikeUpper = params.strikeUpper || params.spotRate * 1.05;
        const strikeLower = params.strikeLower || params.spotRate * 0.95;
        const strikeMid = params.strikeMid || params.spotRate;
        const barrierUpper = params.barrierUpper || params.spotRate * 1.10;
        const barrierLower = params.barrierLower || params.spotRate * 0.90;
        const optionQuantity = params.optionQuantity || 100;
        
        switch (selectedStrategy) {
          case 'forward':
            totalPayoffPerUnit = row.forwardRate - newValue;
            break;
          case 'call':
            totalPayoffPerUnit = Math.max(0, newValue - strikeUpper) * (optionQuantity / 100);
            break;
          case 'put':
            totalPayoffPerUnit = Math.max(0, strikeLower - newValue) * (optionQuantity / 100);
            break;
          case 'collarPut':
          case 'collarCall':
            totalPayoffPerUnit = Math.max(0, strikeLower - newValue) - Math.max(0, newValue - strikeUpper);
            break;
          case 'callKO':
            totalPayoffPerUnit = (newValue < barrierUpper) ? Math.max(0, newValue - strikeUpper) : 0;
            break;
          case 'putKI':
            totalPayoffPerUnit = (newValue < barrierLower) ? Math.max(0, strikeLower - newValue) : 0;
            break;
          case 'strangle':
            totalPayoffPerUnit = Math.max(0, strikeLower - newValue) + Math.max(0, newValue - strikeUpper);
            break;
          case 'straddle':
            totalPayoffPerUnit = Math.max(0, strikeMid - newValue) + Math.max(0, newValue - strikeMid);
            break;
          case 'seagull':
            totalPayoffPerUnit = Math.max(0, strikeMid - newValue) - Math.max(0, newValue - strikeUpper) - Math.max(0, strikeLower - newValue);
            break;
          case 'callPutKI_KO':
            const callKOPayoff = (newValue < barrierUpper) ? Math.max(0, newValue - strikeUpper) : 0;
            const putKIPayoff = (newValue < barrierLower) ? Math.max(0, strikeLower - newValue) : 0;
            totalPayoffPerUnit = callKOPayoff + putKIPayoff;
            break;
          default:
            totalPayoffPerUnit = 0;
        }
      }
      
      // Mettre à jour le nouveau payoff calculé
      updatedResults[index].totalPayoff = totalPayoffPerUnit;
      
      // Recalculer les montants basés sur le nouveau payoff et taux réel
      const unhedgedRevenue = monthlyVolume * newValue;
      const payoffFromHedge = monthlyVolume * totalPayoffPerUnit;
      const premiumPaid = updatedResults[index].premiumPaid; // Premium reste inchangé
      
      updatedResults[index].unhedgedRevenue = unhedgedRevenue;
      updatedResults[index].payoffFromHedge = payoffFromHedge;
      updatedResults[index].hedgedRevenue = unhedgedRevenue + payoffFromHedge - premiumPaid;
      updatedResults[index].pnlVsUnhedged = payoffFromHedge - premiumPaid;
      updatedResults[index].effectiveRate = monthlyVolume === 0 ? newValue : updatedResults[index].hedgedRevenue / monthlyVolume;
    }
    
    // Mettre à jour les résultats
    setResults(updatedResults);
    
    // Recalculer les totaux pour les tableaux récapitulatifs
    let totalHedgedRevenue = 0;
    let totalUnhedgedRevenue = 0;
    let totalPnlVsUnhedged = 0;
    let totalPremiumPaid = 0;
    let totalPayoffFromHedge = 0;
    let totalVolume = 0;
    
    for (const result of updatedResults) {
      totalHedgedRevenue += result.hedgedRevenue;
      totalUnhedgedRevenue += result.unhedgedRevenue;
      totalPnlVsUnhedged += result.pnlVsUnhedged;
      totalPremiumPaid += result.premiumPaid;
      totalPayoffFromHedge += result.payoffFromHedge;
      totalVolume += result.monthlyVolume;
    }
    
    // Nous n'avons pas besoin de mettre à jour totalSummaryStats car il est calculé automatiquement via useMemo
    // Le composant se mettra à jour automatiquement lorsque 'results' change
  };

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
                            maturity={params.monthsToHedge / 12} // Convert months to years
                            domesticRate={params.domesticRate}
                            foreignRate={params.foreignRate}
                            notional={params.baseNotional}
                            notionalQuote={params.quoteNotional}
                            initialOptions={customStrategyComponents}
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

                      <div className="flex items-center space-x-2 mb-4 ml-4">
                        <Checkbox
                          id="useImpliedVolatility"
                          checked={useImpliedVolatility}
                          onCheckedChange={(checked) => {
                            setUseImpliedVolatility(checked as boolean);
                          }}
                        />
                        <label
                          htmlFor="useImpliedVolatility"
                          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 
                          ${useImpliedVolatility ? 'text-green-600 font-bold' : ''}`}
                        >
                          Use Implied Volatility (modifiable in results table)
                        </label>
                      </div>

                      <div className="flex items-center space-x-2 mb-4 ml-4">
                        <Checkbox
                          id="usePremiumOverride"
                          checked={usePremiumOverride}
                          onCheckedChange={(checked) => {
                            setUsePremiumOverride(checked as boolean);
                          }}
                        />
                        <label
                          htmlFor="usePremiumOverride"
                          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 
                          ${usePremiumOverride ? 'text-orange-600 font-bold' : ''}`}
                        >
                          Use Manual Premium/Unit (override calculated values)
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
                                 <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                                     <p className="text-xs text-yellow-800">
                                         <strong>⚠️ Important:</strong> Higher volatility = more expensive options. 
                                         Major FX pairs typically trade at 6-12% volatility. 
                                         If P&L is negative despite favorable payoffs, consider reducing volatility to more realistic levels.
                                     </p>
                                 </div>
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
                              <div className="col-span-2">
                                  <Label htmlFor="additionalDrift">
                                      Additional Drift/Trend (±%/year)
                                      <span className="text-xs text-muted-foreground ml-2">
                                          Positive: upward trend, Negative: downward trend
                                      </span>
                                  </Label>
                                  <Input
                                      type="number"
                                      name="additionalDrift"
                                      id="additionalDrift"
                                      value={realRateParams.additionalDrift}
                                      onChange={handleRealRateParamChange}
                                      step="1"
                                      className="mt-1"
                                  />
                              </div>
                              
                              <div className="col-span-2 mt-2">
                                  <div className="flex items-center space-x-2">
                                      <Checkbox 
                                          id="ignoreDriftFromRates" 
                                          name="ignoreDriftFromRates"
                                          checked={realRateParams.ignoreDriftFromRates}
                                          onCheckedChange={(checked) => {
                                              setRealRateParams(prev => ({
                                                  ...prev,
                                                  ignoreDriftFromRates: checked === true
                                              }));
                                          }}
                                      />
                                      <Label htmlFor="ignoreDriftFromRates" className="font-medium cursor-pointer">
                                          Simulation purement aléatoire
                                          <span className="text-xs text-muted-foreground ml-2 block">
                                              Ignorer le drift lié aux taux d'intérêt pour obtenir un mouvement plus aléatoire
                                          </span>
                                      </Label>
                                  </div>
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
                          <TableCell>
                            <Input
                              type="number"
                              value={row.forwardRate}
                              onChange={(e) => handleRateChange(index, 'forwardRate', e.target.value)}
                              step="0.0001"
                              min="0.0001"
                              className="w-24 text-right p-1 h-8"
                            />
                          </TableCell>
                          <TableCell className={realRateParams.useSimulation ? "bg-blue-50 font-medium" : ""}>
                            <Input
                              type="number"
                              value={row.realRate}
                              onChange={(e) => handleRateChange(index, 'realRate', e.target.value)}
                              step="0.0001"
                              min="0.0001"
                              className={`w-24 text-right p-1 h-8 ${realRateParams.useSimulation ? "bg-blue-50" : ""}`}
                            />
                          </TableCell>
                          {useImpliedVolatility && (
                            <TableCell className="bg-green-50 font-medium">
                              <Input
                                type="number"
                                value={row.impliedVolatility !== undefined ? row.impliedVolatility : (realRateParams.volatility || 15)}
                                onChange={(e) => handleRateChange(index, 'impliedVolatility', e.target.value)}
                                step="0.1"
                                min="0"
                                className="w-24 text-right p-1 h-8 bg-green-50"
                              />
                            </TableCell>
                          )}
                          <TableCell className={`text-right ${usePremiumOverride ? "bg-orange-50" : ""}`}>
                            {usePremiumOverride ? (
                              <Input
                                type="number"
                                value={row.strategyPrice}
                                onChange={(e) => handleRateChange(index, 'strategyPrice', e.target.value)}
                                step="0.00001"
                                min="0"
                                className="w-24 text-right p-1 h-8 bg-orange-50"
                              />
                            ) : (
                              row.strategyPrice.toFixed(5)
                            )}
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
            calculateOptionPrice={calculateOptionPrice}
            calculateBarrierPayoff={calculateBarrierPayoff}
            initialSpotRate={initialSpotRate}
          />
        </TabsContent>

        <TabsContent value="stress-testing">
           {activeStressTestKey && (
                 <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                     <div className="flex items-center justify-between">
                         <div className="flex-1">
                             <p className="text-sm text-blue-800 font-medium">
                                 📊 Stress Test Active: "{activeStressTestKey}"
                             </p>
                             <p className="text-xs text-blue-600 mt-1">
                                 Votre stratégie personnalisée et tous les paramètres sont préservés. 
                                 Utilisez le bouton "Clear" pour revenir à l'état original.
                             </p>
                         </div>
                         <Button variant="destructive" size="sm" onClick={clearStressTest}>
                             <AlertCircle className="mr-2 h-4 w-4" /> Clear Applied Stress Test
                         </Button>
                     </div>
        </div>
             )}
          <StressTesting
             scenarios={{...stressTestScenarios, custom: customStressScenario}}
             customScenario={customStressScenario}
            updateScenario={updateScenario}
            applyScenario={applyStressTest}
            activeScenarioKey={activeStressTestKey}
            results={results}
            yearlySummaryStats={yearlySummaryStats}
            totalSummaryStats={totalSummaryStats}
            payoffData={payoffData}
            baseCurrency={baseCurrency}
            quoteCurrency={quoteCurrency}
            selectedStrategy={selectedStrategy}
            initialSpotRate={initialSpotRate}
            includePremium={includePremium}
            realRateParams={realRateParams}
            useImpliedVolatility={useImpliedVolatility}
            usePremiumOverride={usePremiumOverride}
            handleRateChange={handleRateChange}
            monteCarloPaths={monteCarloPaths}
            showNotional={showNotional}
            baseNotional={params.baseNotional}
            quoteNotional={params.quoteNotional}
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
            results={results}
            baseCurrency={baseCurrency}
            quoteCurrency={quoteCurrency}
            totalSummaryStats={totalSummaryStats}
            yearlySummaryStats={yearlySummaryStats}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
