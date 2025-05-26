import React, { useState, useEffect } from "react";
import { 
  calculateStrategyResults, 
  calculatePayoff,
  calculateCall,
  calculatePut,
  calculateForward
} from "@/utils/hedgeCalculations";
import { FOREX_PAIRS, STRATEGIES, FOREX_PAIR_CATEGORIES } from "@/utils/forexData";
import PayoffChart from "./PayoffChart";
import StrategyInfo from "./StrategyInfo";
import CustomStrategyBuilder from "./CustomStrategyBuilder";
import type { OptionComponent } from "./CustomStrategyOption";
import { calculateCustomStrategyPayoff } from "@/utils/barrierOptionCalculations";
import { Section, GlassContainer, Grid, Heading } from "@/components/ui/layout";
import { calculateBarrierOptionPrice } from "@/utils/barrierOptionCalculations";

// New component for detailed results table
const DetailedResultsTable = ({ results, params, selectedPair }: { 
  results: any; 
  params: any;
  selectedPair: string;
}) => {
  if (!results || !results.payoffData) return null;

  // Generate maturities based on actual dates
  const generateMaturities = () => {
    // Maturité déjà en mois
    const totalMaturityInMonths = params.maturity;
    
    // Utiliser la date de début choisie
    const startDate = params.startDate ? new Date(params.startDate) : new Date();
    
    // Generate a set of maturity dates
    const maturities = [];
    
    // Créer une entrée pour chaque mois jusqu'à la maturité totale
    for (let month = 1; month <= totalMaturityInMonths; month++) {
      // Create a new date for this maturity
      const maturityDate = new Date(startDate);
      maturityDate.setMonth(maturityDate.getMonth() + month);
      
      // Get end of month date
      const endOfMonth = new Date(maturityDate.getFullYear(), maturityDate.getMonth() + 1, 0);
      
      // Calculate the time to maturity in years (as a decimal) - conversion to years for Black-Scholes
      const timeToMaturity = month / 12;
      
      // Format the date as YYYY-MM-DD
      const formattedDate = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
      
      maturities.push({
        date: formattedDate,
        value: timeToMaturity, // Still need years for the option pricing formulas
        // Format timeToMaturity for display (4 decimal places)
        displayTime: timeToMaturity.toFixed(4)
      });
    }
    
    return maturities;
  };

  const maturities = generateMaturities();

  // Format numbers for display
  const formatNumber = (num: number) => {
    if (Math.abs(num) < 0.0001) return "0.0000";
    return num.toFixed(4);
  };

  // Format numbers with commas for large values
  const formatCurrencyValue = (num: number) => {
    if (Math.abs(num) < 0.0001) return "0.00";
    return new Intl.NumberFormat('en-US', { 
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(num);
  };

  // Plain number format for CSV export
  const plainNumber = (num: number) => {
    if (Math.abs(num) < 0.0001) return "0";
    return num.toFixed(4);
  };

  // Generate detailed results for each maturity
  const detailedResults = maturities.map(maturity => {
    // Calculate forward price for this maturity
    const forward = calculateForward(params.spot, maturity.value, params.r1, params.r2);
    
    // Calculate real price (simulated rate - in real scenario this would be market rate)
    const realPrice = forward + (Math.random() - 0.5) * 0.001; // Small random variation

    // For simplicity, we'll use the same volatility across maturities
    const vol = params.vol;

    // Calculate option prices and payoffs more realistically
    let premiumPerUnit = 0;
    let payoffPerUnit = 0;
    let strategyPrice = 0;
    
    if (results.callPrice !== undefined && results.putPrice !== undefined) {
      // For strategies with calls and puts (collar, strangle)
      const callPrice = calculateCall(params.spot, results.callStrike || params.strikeUpper, maturity.value, params.r1, params.r2, vol);
      const putPrice = calculatePut(params.spot, results.putStrike || params.strikeLower, maturity.value, params.r1, params.r2, vol);
      
      premiumPerUnit = putPrice - callPrice; // Net premium for collar (usually close to zero)
      strategyPrice = Math.abs(callPrice + putPrice);
      
      // Calculate actual payoff based on where the rate ends up
      if (realPrice <= (results.putStrike || params.strikeLower)) {
        payoffPerUnit = (results.putStrike || params.strikeLower) - realPrice;
      } else if (realPrice >= (results.callStrike || params.strikeUpper)) {
        payoffPerUnit = realPrice - (results.callStrike || params.strikeUpper);
      } else {
        payoffPerUnit = 0; // Between strikes
      }
    } else if (results.callPrice !== undefined) {
      // Call only strategies
      const callPrice = calculateCall(params.spot, params.strikeUpper, maturity.value, params.r1, params.r2, vol);
      premiumPerUnit = -callPrice; // Negative because we pay premium
      strategyPrice = callPrice;
      
      // Call payoff
      payoffPerUnit = Math.max(0, realPrice - params.strikeUpper);
    } else if (results.putPrice !== undefined) {
      // Put only strategies
      const putPrice = calculatePut(params.spot, params.strikeLower, maturity.value, params.r1, params.r2, vol);
      premiumPerUnit = -putPrice; // Negative because we pay premium
      strategyPrice = putPrice;
      
      // Put payoff
      payoffPerUnit = Math.max(0, params.strikeLower - realPrice);
    }

    // Calculate volumes and costs more realistically
    const monthlyVolume = params.notional / params.maturity; // Split notional across months
    const volume = params.optionQuantity ? params.optionQuantity / 100 : 1;
    
    const premiumPaid = premiumPerUnit * monthlyVolume * volume;
    const hedgePayoff = payoffPerUnit * monthlyVolume * volume;
    
    // Calculate revenues
    const unhedgedRevenue = realPrice * monthlyVolume;
    const hedgedRevenue = unhedgedRevenue + hedgePayoff;
    const pnlVsUnhedged = hedgedRevenue - unhedgedRevenue;
    
    // Calculate effective rate
    const effectiveRate = hedgedRevenue / monthlyVolume;

    return {
      maturity: maturity.date,
      timeToMaturity: maturity.displayTime,
      forwardRate: forward.toFixed(4),
      simulatedRate: realPrice.toFixed(4),
      premiumPerUnit: formatNumber(premiumPerUnit),
      payoffPerUnit: formatNumber(payoffPerUnit),
      monthlyVolume: monthlyVolume.toFixed(0),
      premiumPaid: formatNumber(premiumPaid),
      hedgePayoff: formatNumber(hedgePayoff),
      unhedgedRevenue: formatNumber(unhedgedRevenue),
      hedgedRevenue: formatNumber(hedgedRevenue),
      pnlVsUnhedged: formatNumber(pnlVsUnhedged),
      effectiveRate: formatNumber(effectiveRate),
      // Raw values for CSV export
      rawPremiumPerUnit: premiumPerUnit,
      rawPayoffPerUnit: payoffPerUnit,
      rawMonthlyVolume: monthlyVolume,
      rawPremiumPaid: premiumPaid,
      rawHedgePayoff: hedgePayoff,
      rawUnhedgedRevenue: unhedgedRevenue,
      rawHedgedRevenue: hedgedRevenue,
      rawPnlVsUnhedged: pnlVsUnhedged,
      rawEffectiveRate: effectiveRate
    };
  });

  const baseCurrency = selectedPair.split('/')[0];
  const quoteCurrency = selectedPair.split('/')[1];

  // Function to export data as CSV
  const exportToCsv = () => {
    // Create CSV header
    const csvHeader = [
      'Date',
      'Time (yr)',
      'Forward Rate',
      'Simulated Rate',
      'Premium/Unit',
      'Payoff/Unit',
      'Monthly Vol',
      'Premium Paid',
      'Hedge Payoff',
      'Unhedged Rev',
      'Hedged Rev',
      'P&L vs Unhedged',
      'Effective Rate'
    ].join(',');
    
    // Create CSV rows
    const csvRows = detailedResults.map(result => {
      return [
        result.maturity,
        result.timeToMaturity,
        result.forwardRate,
        result.simulatedRate,
        plainNumber(result.rawPremiumPerUnit),
        plainNumber(result.rawPayoffPerUnit),
        plainNumber(result.rawMonthlyVolume),
        plainNumber(result.rawPremiumPaid),
        plainNumber(result.rawHedgePayoff),
        plainNumber(result.rawUnhedgedRevenue),
        plainNumber(result.rawHedgedRevenue),
        plainNumber(result.rawPnlVsUnhedged),
        plainNumber(result.rawEffectiveRate)
      ].join(',');
    });
    
    // Combine header and rows
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Create a URL for the blob and set it as the href of the link
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `forex_strategy_results_${selectedPair.replace('/', '_')}.csv`);
    
    // Append the link to the body, click it, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mt-4">
      <div className="flex justify-end mb-4">
        <button
          onClick={exportToCsv}
          className="flex items-center gap-2 py-2 px-4 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export as CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-muted">
        <table className="min-w-full divide-y divide-muted-foreground/20">
          <thead className="bg-muted/30">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Time (yr)</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Forward Rate</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Simulated Rate</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Premium/Unit</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Payoff/Unit</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Monthly Vol</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Premium Paid</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Hedge Payoff</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Unhedged Rev</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Hedged Rev</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">P&L vs Unhedged</th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground/70">Effective Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-foreground/10">
            {detailedResults.map((result, index) => (
              <tr 
                key={index} 
                className={`
                  ${index % 2 === 0 ? "bg-muted/10" : "bg-background"}
                  transition-colors hover:bg-primary/5
                `}
              >
                <td className="px-4 py-3 text-sm font-medium">{result.maturity}</td>
                <td className="px-4 py-3 text-sm">{result.timeToMaturity}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.forwardRate}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.simulatedRate}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.premiumPerUnit}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.payoffPerUnit}</td>
                <td className="px-4 py-3 text-sm">{result.monthlyVolume}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.premiumPaid}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.hedgePayoff}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.unhedgedRevenue}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.hedgedRevenue}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.pnlVsUnhedged}</td>
                <td className="px-4 py-3 text-sm font-mono">{result.effectiveRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm text-muted-foreground">
        <p>* Calculations are based on Black-Scholes model for European options with constant volatility across maturities.</p>
        <p>* Delta P&L estimates the profit/loss based on a small movement in the underlying price.</p>
      </div>
    </div>
  );
};

const HedgeCalculator = () => {
  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [selectedStrategy, setSelectedStrategy] = useState("collar");
  const [results, setResults] = useState<any>(null);
  const [customOptions, setCustomOptions] = useState<OptionComponent[]>([]);
  const [customGlobalParams, setCustomGlobalParams] = useState({
    maturity: 1,
    r1: 0.02,
    r2: 0.03,
    notional: 1000000,
    pricingModel: "monte_carlo"
  });
  const [customPairs, setCustomPairs] = useState<Record<string, typeof FOREX_PAIRS[keyof typeof FOREX_PAIRS]>>({});
  const [showAddPairModal, setShowAddPairModal] = useState(false);
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const [newPairData, setNewPairData] = useState({
    code: "",
    name: "",
    spot: 1.0,
    vol: 0.1,
    defaultStrike: 1.05
  });
  const [includePremiumInPayoff, setIncludePremiumInPayoff] = useState(true);
  const [params, setParams] = useState({
    spot: FOREX_PAIRS["EUR/USD"].spot,
    strikeUpper: FOREX_PAIRS["EUR/USD"].defaultStrike,
    strikeLower: FOREX_PAIRS["EUR/USD"].defaultStrike * 0.95,
    strikeMid: FOREX_PAIRS["EUR/USD"].spot,
    barrierUpper: FOREX_PAIRS["EUR/USD"].defaultStrike * 1.05,
    barrierLower: FOREX_PAIRS["EUR/USD"].defaultStrike * 0.9,
    maturity: 12,
    startDate: new Date().toISOString().split('T')[0],
    r1: 0.02,
    r2: 0.03,
    vol: FOREX_PAIRS["EUR/USD"].vol,
    premium: 0,
    notional: 1000000,
    notionalQuote: 0,
    optionQuantity: 100,
    showNotionalInGraph: false,
  });

  const handleAddPair = () => {
    if (!newPairData.code || !newPairData.name) return;
    
    if (FOREX_PAIRS[newPairData.code as keyof typeof FOREX_PAIRS] || customPairs[newPairData.code]) {
      alert("This currency pair already exists!");
      return;
    }
    
    setCustomPairs(prev => ({
      ...prev,
      [newPairData.code]: {
        name: newPairData.name,
        spot: newPairData.spot,
        vol: newPairData.vol,
        defaultStrike: newPairData.defaultStrike
      }
    }));
    
    setSelectedPair(newPairData.code);
    setParams(prev => ({
      ...prev,
      spot: newPairData.spot,
      strikeUpper: newPairData.defaultStrike,
      strikeLower: newPairData.defaultStrike * 0.95,
      strikeMid: newPairData.spot,
      barrierUpper: newPairData.defaultStrike * 1.05,
      barrierLower: newPairData.defaultStrike * 0.9,
      vol: newPairData.vol
    }));
    
    setNewPairData({
      code: "",
      name: "",
      spot: 1.0,
      vol: 0.1,
      defaultStrike: 1.05
    });
    setShowAddPairModal(false);
  };

  const handlePairChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pair = e.target.value;
    setSelectedPair(pair);
    
    const pairData = customPairs[pair] || FOREX_PAIRS[pair as keyof typeof FOREX_PAIRS];
    
    setParams((prev) => ({
      ...prev,
      spot: pairData.spot,
      strikeUpper: pairData.defaultStrike,
      strikeLower: pairData.defaultStrike * 0.95,
      strikeMid: pairData.spot,
      barrierUpper: pairData.defaultStrike * 1.05,
      barrierLower: pairData.defaultStrike * 0.9,
      vol: pairData.vol,
    }));
  };

  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStrategy = e.target.value;
    setSelectedStrategy(newStrategy);

    if (newStrategy === "seagull" && !params.strikeMid) {
      setParams((prev) => ({ ...prev, strikeMid: params.spot }));
    }
    
    if (newStrategy === "custom" && customOptions.length === 0) {
      setCustomOptions([
        {
          type: "call",
          strike: 105,
          strikeType: "percent",
          volatility: 20,
          quantity: 100,
        }
      ]);
    }
  };

  const handleCustomStrategyChange = (options: OptionComponent[], globalParams: any) => {
    setCustomOptions(options);
    setCustomGlobalParams(globalParams);
    
    const optionsWithPremiums = options.map(option => {
      const actualStrike = option.strikeType === "percent"
        ? params.spot * (option.strike / 100)
        : option.strike;
      
      const needsBarrier = option.type.includes("KO") || option.type.includes("KI");
      const needsDoubleBarrier = option.type.includes("DKO") || option.type.includes("DKI");
      
      const actualUpperBarrier = needsBarrier && option.upperBarrier
        ? (option.upperBarrierType === "percent"
          ? params.spot * (option.upperBarrier / 100)
          : option.upperBarrier)
        : undefined;
      
      const actualLowerBarrier = needsDoubleBarrier && option.lowerBarrier
        ? (option.lowerBarrierType === "percent"
          ? params.spot * (option.lowerBarrier / 100)
          : option.lowerBarrier)
        : undefined;
      
      const vol = option.volatility / 100;
      const quantity = option.quantity / 100;
      let premium = 0;
      
      if (option.type === "call") {
        premium = calculateCall(params.spot, actualStrike, params.maturity, params.r1, params.r2, vol) * quantity;
      } else if (option.type === "put") {
        premium = calculatePut(params.spot, actualStrike, params.maturity, params.r1, params.r2, vol) * quantity;
      } 
      else if (option.type.includes("KO") && !option.type.includes("DKO")) {
        const isCall = option.type.includes("call");
        const isReverse = option.type.includes("Reverse");
        premium = calculateBarrierOptionPrice(
          option.type,
          params.spot,
          actualStrike,
          actualUpperBarrier,
          undefined,
          params.maturity,
          params.r1,
          params.r2,
          vol,
          option.quantity
        );
      } else if (option.type.includes("KI") && !option.type.includes("DKI")) {
        const isCall = option.type.includes("call");
        const isReverse = option.type.includes("Reverse");
        premium = calculateBarrierOptionPrice(
          option.type,
          params.spot,
          actualStrike,
          actualUpperBarrier,
          undefined,
          params.maturity,
          params.r1,
          params.r2,
          vol,
          option.quantity
        );
      } else if (option.type.includes("DKO")) {
        const isCall = option.type.includes("call");
        premium = calculateBarrierOptionPrice(
          option.type,
          params.spot,
          actualStrike,
          actualUpperBarrier,
          actualLowerBarrier,
          params.maturity,
          params.r1,
          params.r2,
          vol,
          option.quantity
        );
      } else if (option.type.includes("DKI")) {
        const isCall = option.type.includes("call");
        premium = calculateBarrierOptionPrice(
          option.type,
          params.spot,
          actualStrike,
          actualUpperBarrier,
          actualLowerBarrier,
          params.maturity,
          params.r1,
          params.r2,
          vol,
          option.quantity
        );
      }
      
      return {
        ...option,
        actualStrike,
        actualUpperBarrier,
        actualLowerBarrier,
        premium
      };
    });
    
    const totalPremium = optionsWithPremiums.reduce((sum, option) => sum + (option.premium || 0), 0);
    
    const payoffData = calculateCustomPayoffData(optionsWithPremiums, params, globalParams);
    
    setResults({
      options: optionsWithPremiums,
      totalPremium,
      payoffData
    });
  };

  const calculateCustomPayoffData = (options: any[], params: any, globalParams: any) => {
    const spots = [];
    const minSpot = params.spot * 0.7;
    const maxSpot = params.spot * 1.3;
    const step = (maxSpot - minSpot) / 100;
    
    for (let spot = minSpot; spot <= maxSpot; spot += step) {
      const unhedgedRate = spot;
      
      const payoff = calculateCustomStrategyPayoff(options, spot, params.spot, globalParams);
      
      const hedgedRate = unhedgedRate + payoff;
      
      const hedgedRateWithoutPremium = hedgedRate;
      
      const totalPremium = options.reduce((sum, option) => sum + (option.premium || 0), 0);
      const hedgedRateWithPremium = hedgedRate - totalPremium;
      
      const dataPoint: any = {
        spot: parseFloat(spot.toFixed(4)),
        'Unhedged Rate': parseFloat(unhedgedRate.toFixed(4)),
        'Hedged Rate': parseFloat(hedgedRateWithoutPremium.toFixed(4)),
        'Hedged Rate with Premium': parseFloat(hedgedRateWithPremium.toFixed(4)),
        'Initial Spot': parseFloat(params.spot.toFixed(4))
      };
      
      if (spots.length === 0) {
        options.forEach((option, index) => {
          if (option.actualStrike) {
            dataPoint[`Option ${index+1} Strike`] = parseFloat(option.actualStrike.toFixed(4));
          }
          
          const needsBarrier = option.type.includes("KO") || option.type.includes("KI");
          const needsDoubleBarrier = option.type.includes("DKO") || option.type.includes("DKI");
          
          if (needsBarrier && option.actualUpperBarrier) {
            let barrierLabel = `Option ${index+1} Upper Barrier`;
            
            if (option.type.includes("KO")) {
              barrierLabel += " (KO)";
            } else if (option.type.includes("KI")) {
              barrierLabel += " (KI)";
            }
            
            dataPoint[barrierLabel] = parseFloat(option.actualUpperBarrier.toFixed(4));
          }
          
          if (needsDoubleBarrier && option.actualLowerBarrier) {
            let barrierLabel = `Option ${index+1} Lower Barrier`;
            
            if (option.type.includes("DKO")) {
              barrierLabel += " (KO)";
            } else if (option.type.includes("DKI")) {
              barrierLabel += " (KI)";
            }
            
            dataPoint[barrierLabel] = parseFloat(option.actualLowerBarrier.toFixed(4));
          }
        });
      }
      
      spots.push(dataPoint);
    }
    
    return spots;
  };

  useEffect(() => {
    if (!selectedStrategy) return;
    
    if (selectedStrategy === "custom") {
      if (customOptions.length > 0) {
        handleCustomStrategyChange(customOptions, customGlobalParams);
      }
      return;
    }
    
    const calculatedResults = calculateStrategyResults(selectedStrategy, params);
    
    if (calculatedResults) {
      const payoffData = calculatePayoff(calculatedResults, selectedStrategy, params, includePremiumInPayoff);
      setResults({
        ...calculatedResults,
        payoffData,
      });
    }
  }, [params, selectedStrategy, customOptions.length === 0, includePremiumInPayoff]);

  useEffect(() => {
    updateQuoteNotional(params.notional, params.spot);
  }, []);

  const updateQuoteNotional = (baseNotional: number, spotRate: number) => {
    const quoteNotional = baseNotional * spotRate;
    setParams(prev => ({
      ...prev,
      notionalQuote: quoteNotional
    }));
  };

  const updateBaseNotional = (quoteNotional: number, spotRate: number) => {
    const baseNotional = quoteNotional / spotRate;
    setParams(prev => ({
      ...prev,
      notional: baseNotional
    }));
  };

  const handleSpotRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpot = parseFloat(e.target.value);
    setParams(prev => {
      const newQuoteNotional = prev.notional * newSpot;
      return {
        ...prev,
        spot: newSpot,
        notionalQuote: newQuoteNotional
      };
    });
  };

  const handleBaseNotionalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBaseNotional = parseFloat(e.target.value);
    const newQuoteNotional = newBaseNotional * params.spot;
    setParams(prev => ({
      ...prev,
      notional: newBaseNotional,
      notionalQuote: newQuoteNotional
    }));
  };

  const handleQuoteNotionalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuoteNotional = parseFloat(e.target.value);
    const newBaseNotional = newQuoteNotional / params.spot;
    setParams(prev => ({
      ...prev,
      notional: newBaseNotional,
      notionalQuote: newQuoteNotional
    }));
  };

  if (!results) return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-8 w-48 bg-muted rounded mb-4"></div>
        <div className="h-4 w-64 bg-muted rounded"></div>
      </div>
    </div>
  );

  const AddPairModal = () => {
    if (!showAddPairModal) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
        <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Add Currency Pair</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Pair Code (e.g.: EUR/USD)
                <input
                  type="text"
                  value={newPairData.code}
                  onChange={(e) => setNewPairData(prev => ({...prev, code: e.target.value}))}
                  className="input-field mt-1 w-full"
                  placeholder="XXX/YYY"
                />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Pair Name
                <input
                  type="text"
                  value={newPairData.name}
                  onChange={(e) => setNewPairData(prev => ({...prev, name: e.target.value}))}
                  className="input-field mt-1 w-full"
                  placeholder="Descriptive Name"
                />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Spot Rate
                <input
                  type="number"
                  value={newPairData.spot}
                  onChange={(e) => setNewPairData(prev => ({...prev, spot: parseFloat(e.target.value)}))}
                  step="0.01"
                  className="input-field mt-1 w-full"
                />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Volatility (between 0 and 1)
                <input
                  type="number"
                  value={newPairData.vol}
                  onChange={(e) => setNewPairData(prev => ({...prev, vol: parseFloat(e.target.value)}))}
                  step="0.01"
                  min="0"
                  max="1"
                  className="input-field mt-1 w-full"
                />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Default Strike
                <input
                  type="number"
                  value={newPairData.defaultStrike}
                  onChange={(e) => setNewPairData(prev => ({...prev, defaultStrike: parseFloat(e.target.value)}))}
                  step="0.01"
                  className="input-field mt-1 w-full"
                />
              </label>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 mt-6">
            <button 
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              onClick={() => setShowAddPairModal(false)}
            >
              Cancel
            </button>
            <button 
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              onClick={handleAddPair}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Section>
      <div className="max-w-6xl mx-auto">
        <Heading level={1} className="font-bold mb-8 text-center">
          Foreign Exchange Hedging Dashboard
        </Heading>
        
        <GlassContainer className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 font-medium">
                Currency Pair
                <div className="flex mt-1">
                <select
                  value={selectedPair}
                  onChange={handlePairChange}
                    className="input-field w-full rounded-r-none"
                >
                  {Object.entries(FOREX_PAIR_CATEGORIES).map(([category, pairs]) => (
                    <optgroup key={category} label={category}>
                      {pairs.map((pair) => (
                        <option key={pair} value={pair}>
                          {pair} - {FOREX_PAIRS[pair as keyof typeof FOREX_PAIRS].name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                    
                    {Object.keys(customPairs).length > 0 && (
                      <optgroup label="Custom Pairs">
                        {Object.entries(customPairs).map(([code, data]) => (
                          <option key={code} value={code}>
                            {code} - {data.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                </select>
                  <button 
                    onClick={() => setShowAddPairModal(true)}
                    className="px-3 bg-primary text-white rounded-r-md hover:bg-primary/90 transition-colors"
                    title="Add custom currency pair"
                  >
                    +
                  </button>
                </div>
              </label>
            </div>
            
            <div>
              <label className="block mb-2 font-medium">
                Hedging Strategy
                <select
                  value={selectedStrategy}
                  onChange={handleStrategyChange}
                  className="input-field mt-1 w-full"
                >
                  {Object.entries(STRATEGIES).map(([key, { name }]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={includePremiumInPayoff}
                onChange={(e) => setIncludePremiumInPayoff(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span>Include premium in payoff calculation</span>
            </label>
          </div>

          {selectedStrategy !== "custom" && (
            <div className="mt-6">
              <Heading level={3}>Parameters</Heading>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Spot Rate
                    <input
                      type="number"
                      value={params.spot}
                      onChange={handleSpotRateChange}
                      step="0.01"
                      className="input-field mt-1"
                    />
                  </label>
                </div>

                {selectedStrategy === "collarPut" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Put Strike (Fixed)
                      <input
                        type="number"
                        value={params.strikeLower}
                        onChange={(e) => setParams((prev) => ({ ...prev, strikeLower: parseFloat(e.target.value) }))}
                        step="0.01"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                )}

                {selectedStrategy === "collarCall" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Call Strike (Fixed)
                      <input
                        type="number"
                        value={params.strikeUpper}
                        onChange={(e) => setParams((prev) => ({ ...prev, strikeUpper: parseFloat(e.target.value) }))}
                        step="0.01"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                )}

                {(selectedStrategy === "strangle" || 
                  selectedStrategy === "call" || selectedStrategy === "seagull" || 
                  selectedStrategy === "callKO" || selectedStrategy === "callPutKI_KO") && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {selectedStrategy === "seagull" ? "Call Sell Strike (High)" : "Call Strike"}
                      <input
                        type="number"
                        value={params.strikeUpper}
                        onChange={(e) => setParams((prev) => ({ ...prev, strikeUpper: parseFloat(e.target.value) }))}
                        step="0.01"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                )}

                {(selectedStrategy === "strangle" || 
                  selectedStrategy === "put" || selectedStrategy === "seagull" || 
                  selectedStrategy === "putKI" || selectedStrategy === "callPutKI_KO") && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {selectedStrategy === "seagull" ? "Put Sell Strike (Low)" : "Put Strike"}
                      <input
                        type="number"
                        value={params.strikeLower}
                        onChange={(e) => setParams((prev) => ({ ...prev, strikeLower: parseFloat(e.target.value) }))}
                        step="0.01"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                )}

                {selectedStrategy === "seagull" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Put Buy Strike (Mid)
                      <input
                        type="number"
                        value={params.strikeMid}
                        onChange={(e) => setParams((prev) => ({ ...prev, strikeMid: parseFloat(e.target.value) }))}
                        step="0.01"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                )}

                {(selectedStrategy === "callKO" || selectedStrategy === "callPutKI_KO") && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Upper Barrier (KO)
                      <input
                        type="number"
                        value={params.barrierUpper}
                        onChange={(e) => setParams((prev) => ({ ...prev, barrierUpper: parseFloat(e.target.value) }))}
                        step="0.01"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                )}

                {(selectedStrategy === "putKI" || selectedStrategy === "callPutKI_KO") && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {selectedStrategy === "callPutKI_KO" ? "Lower Barrier (KI)" : "Barrier (KI)"}
                      <input
                        type="number"
                        value={selectedStrategy === "putKI" ? params.barrierUpper : params.barrierLower}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (selectedStrategy === "putKI") {
                            setParams((prev) => ({ ...prev, barrierUpper: value }));
                          } else {
                            setParams((prev) => ({ ...prev, barrierLower: value }));
                          }
                        }}
                        step="0.01"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Volatility (%)
                    <input
                      type="number"
                      value={params.vol * 100}
                      onChange={(e) => setParams((prev) => ({ ...prev, vol: parseFloat(e.target.value) / 100 }))}
                      step="0.1"
                      className="input-field mt-1"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Maturity (months)
                    <input
                      type="number"
                      value={params.maturity}
                      onChange={(e) => setParams((prev) => ({ ...prev, maturity: parseInt(e.target.value) }))}
                      step="1"
                      min="1"
                      max="60"
                      className="input-field mt-1"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Date
                    <input
                      type="date"
                      value={params.startDate}
                      onChange={(e) => setParams((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="input-field mt-1"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {selectedPair.split("/")[0]} Rate (%)
                    <input
                      type="number"
                      value={params.r1 * 100}
                      onChange={(e) => setParams((prev) => ({ ...prev, r1: parseFloat(e.target.value) / 100 }))}
                      step="0.1"
                      className="input-field mt-1"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {selectedPair.split("/")[1]} Rate (%)
                    <input
                      type="number"
                      value={params.r2 * 100}
                      onChange={(e) => setParams((prev) => ({ ...prev, r2: parseFloat(e.target.value) / 100 }))}
                      step="0.1"
                      className="input-field mt-1"
                    />
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {selectedPair.split("/")[0]} Notional
                      <input
                        type="number"
                        value={params.notional.toFixed(0)}
                        onChange={handleBaseNotionalChange}
                        step="100000"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {selectedPair.split("/")[1]} Notional
                      <input
                        type="number"
                        value={params.notionalQuote.toFixed(0)}
                        onChange={handleQuoteNotionalChange}
                        step="100000"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                </div>

                {(selectedStrategy === "put" || selectedStrategy === "call") && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Option Quantity (%)
                      <input
                        type="number"
                        value={params.optionQuantity}
                        onChange={(e) => setParams((prev) => ({ ...prev, optionQuantity: parseFloat(e.target.value) }))}
                        step="10"
                        min="0"
                        max="200"
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </GlassContainer>

        {selectedStrategy === "custom" && (
          <CustomStrategyBuilder 
            spot={params.spot} 
            onStrategyChange={handleCustomStrategyChange}
            baseCurrency={selectedPair.split("/")[0]}
            quoteCurrency={selectedPair.split("/")[1]}
            notional={params.notional}
            notionalQuote={params.notionalQuote}
          />
        )}

        <Grid cols={1} className="mb-8">
          <StrategyInfo 
            selectedStrategy={selectedStrategy} 
            results={results} 
            params={params}
            name={STRATEGIES[selectedStrategy]?.name ?? ''}
            description={STRATEGIES[selectedStrategy]?.description ?? ''}
          />
        </Grid>

        <GlassContainer className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Strategy Results</h2>
            <button 
              onClick={() => setShowDetailedResults(!showDetailedResults)}
              className="py-2 px-4 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center"
            >
              {showDetailedResults ? 'Hide Detailed Results' : 'Calculate Detailed Results'}
            </button>
          </div>

          {showDetailedResults && results && (
            <>
              {/* Strategy Summary */}
              <div className="mb-6 bg-muted/30 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-3">Forex Hedge Strategy Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-md bg-card p-3 border border-border">
                    <div className="text-sm text-muted-foreground">Current Spot Rate</div>
                    <div className="text-xl font-bold mt-1">{params.spot.toFixed(4)}</div>
                    <div className="text-xs mt-1">{selectedPair}</div>
                  </div>
                  
                  <div className="rounded-md bg-card p-3 border border-border">
                    <div className="text-sm text-muted-foreground">Strategy Type</div>
                    <div className="text-xl font-bold mt-1">
                      {STRATEGIES[selectedStrategy as keyof typeof STRATEGIES]?.name || "Custom"}
                    </div>
                    <div className="text-xs mt-1">Premium: {results.totalPremium ? `${(results.totalPremium * 100).toFixed(2)}%` : (results.premium ? `${(results.premium * 100).toFixed(2)}%` : "N/A")}</div>
                  </div>
                  
                  <div className="rounded-md bg-card p-3 border border-border">
                    <div className="text-sm text-muted-foreground">Notional Amount</div>
                    <div className="text-xl font-bold mt-1">{params.notional.toLocaleString()}</div>
                    <div className="text-xs mt-1">{selectedPair.split('/')[0]}</div>
                  </div>
                </div>
                
                {/* Additional strategy-specific information */}
                <div className="mt-4 text-sm">
                  {(selectedStrategy === "call" || selectedStrategy === "put") && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>Option Coverage:</span>
                      <span className="font-medium text-foreground">{params.optionQuantity}%</span>
                      <span>of notional amount</span>
                    </div>
                  )}
                  
                  {(selectedStrategy === "collar" || selectedStrategy === "collarPut" || selectedStrategy === "collarCall") && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>Call Strike:</span>
                        <span className="font-medium text-foreground">{results.callStrike ? results.callStrike.toFixed(4) : "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>Put Strike:</span>
                        <span className="font-medium text-foreground">{results.putStrike ? results.putStrike.toFixed(4) : "N/A"}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Barrier options info */}
                  {(selectedStrategy === "callKO" || selectedStrategy === "putKI" || selectedStrategy === "callPutKI_KO") && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {(selectedStrategy === "callKO" || selectedStrategy === "callPutKI_KO") && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span>Upper Barrier (KO):</span>
                          <span className="font-medium text-foreground">{params.barrierUpper.toFixed(4)}</span>
                        </div>
                      )}
                      {(selectedStrategy === "putKI" || selectedStrategy === "callPutKI_KO") && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span>{selectedStrategy === "callPutKI_KO" ? "Lower Barrier (KI):" : "Barrier (KI):"}</span>
                          <span className="font-medium text-foreground">
                            {selectedStrategy === "putKI" ? params.barrierUpper.toFixed(4) : params.barrierLower.toFixed(4)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span>Pricing Model:</span>
                        <span className="font-medium text-foreground">Monte Carlo</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Volatility and rates info for all strategies */}
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>Volatility:</span>
                      <span className="font-medium text-foreground">{(params.vol * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>{selectedPair.split('/')[0]} Rate:</span>
                      <span className="font-medium text-foreground">{(params.r1 * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>{selectedPair.split('/')[1]} Rate:</span>
                      <span className="font-medium text-foreground">{(params.r2 * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <DetailedResultsTable 
                results={results} 
                params={params}
                selectedPair={selectedPair}
              />
            </>
          )}
        </GlassContainer>

        <div className="mt-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={params.showNotionalInGraph}
              onChange={(e) => setParams(prev => ({ ...prev, showNotionalInGraph: e.target.checked }))}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span>Show notional in payoff chart</span>
          </label>
        </div>

        {params.showNotionalInGraph && <div className="mt-4">Graph showing notional value.</div>}

        <PayoffChart
          data={results.payoffData}
          selectedStrategy={selectedStrategy}
          spot={params.spot}
          includePremium={includePremiumInPayoff}
          showNotional={params.showNotionalInGraph}
          notional={params.notional}
          notionalQuote={params.notionalQuote}
          baseCurrency={selectedPair.split("/")[0]}
          quoteCurrency={selectedPair.split("/")[1]}
        />
      </div>
      
      <AddPairModal />
    </Section>
  );
};

export default HedgeCalculator;

