import React, { useState } from "react";
import { HoverCard, Heading, ValueDisplay } from "@/components/ui/layout";
import { STRATEGIES, OPTION_TYPES } from "@/utils/forexData";
import { BARRIER_PRICING_MODELS } from "@/utils/barrierOptionCalculations";
import { VANILLA_PRICING_MODELS } from "@/utils/garmanKohlhagen";
import { Info, X } from "lucide-react";

interface StrategyInfoProps {
  selectedStrategy: string;
  results: any;
  params: any;
  name: string;
  description: string;
}

const StrategyInfo = ({ selectedStrategy, results, params, name, description }: StrategyInfoProps) => {
  const [showPricingFormulas, setShowPricingFormulas] = useState(false);

  if (!results) return null;

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null || isNaN(num)) return "N/A";
    return num.toFixed(4);
  };

  const formatPercentage = (num: number | undefined) => {
    if (num === undefined || num === null || isNaN(num)) return "N/A";
    return (num * 100).toFixed(2) + "%";
  };

  // Shows a dialog with detailed formulas information
  const FormulaInfoDialog = () => {
    if (!showPricingFormulas) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
        <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Option Pricing Formulas</h2>
            <button 
              onClick={() => setShowPricingFormulas(false)}
              className="p-1 hover:bg-muted rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Garman-Kohlhagen Formulas (1983)</h3>
              <div className="bg-muted/30 p-3 rounded-lg font-mono text-sm">
                <p>Call Price = S·e<sup>-r₂T</sup>·N(d₁) - K·e<sup>-r₁T</sup>·N(d₂)</p>
                <p>Put Price = K·e<sup>-r₁T</sup>·N(-d₂) - S·e<sup>-r₂T</sup>·N(-d₁)</p>
                <p className="mt-2">Where:</p>
                <p>d₁ = [ln(S/K) + (r₁-r₂+σ²/2)·T] / (σ·√T)</p>
                <p>d₂ = d₁ - σ·√T</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                S = spot price, K = strike price, T = maturity, r₁ = domestic interest rate, 
                r₂ = foreign interest rate, σ = volatility, N() = cumulative normal distribution
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Rubinstein-Reiner Barrier Option Formulas</h3>
              <div className="bg-muted/30 p-3 rounded-lg font-mono text-sm">
                <p className="font-bold">Down-and-Out Call (DOC):</p>
                <p>DOC = C(S,K,T,r,σ) - (S/H)<sup>2λ</sup>·C(H²/S,K,T,r,σ)</p>
                
                <p className="font-bold mt-3">Up-and-Out Call (UOC):</p>
                <p>UOC = C(S,K,T,r,σ) - S·(H/S)<sup>2λ-2</sup>·N(d₁') + K·e<sup>-rT</sup>·(H/S)<sup>2λ</sup>·N(d₂')</p>
                
                <p className="font-bold mt-3">Down-and-In Call (DIC):</p>
                <p>DIC = (S/H)<sup>2λ</sup>·C(H²/S,K,T,r,σ)</p>
                
                <p className="font-bold mt-3">Up-and-In Call (UIC):</p>
                <p>UIC = S·(H/S)<sup>2λ-2</sup>·N(d₁') - K·e<sup>-rT</sup>·(H/S)<sup>2λ</sup>·N(d₂')</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                H = barrier level, λ = (r₁-r₂+σ²/2)/σ², C() = Black-Scholes call price
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Monte Carlo Simulation</h3>
              <div className="bg-muted/30 p-3 rounded-lg text-sm">
                <p>1. Simulate price paths using geometric Brownian motion:</p>
                <p className="font-mono mt-1">S(t+Δt) = S(t)·exp[(r₁-r₂-σ²/2)·Δt + σ·√Δt·Z]</p>
                
                <div className="mt-3">
                  <p className="font-bold">For vanilla options:</p>
                  <p className="ml-4">• Simulate {10000} paths to expiration date</p>
                  <p className="ml-4">• Calculate payoff at expiration for each path</p>
                  <p className="ml-4">• Average the payoffs and discount to present value</p>
                  <p className="ml-4 mt-1 text-xs text-muted-foreground">Same Monte Carlo implementation is used for both vanilla and barrier options</p>
                </div>
                
                <div className="mt-3">
                  <p className="font-bold">For barrier options:</p> 
                  <p className="ml-4">• Simulate with smaller time steps to capture barrier events</p>
                  <p className="ml-4">• For each path, check if barrier conditions are met</p>
                  <p className="ml-4">• Calculate conditional payoffs based on barrier events</p>
                  <p className="ml-4">• Average the payoffs and discount to present value</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Z = standard normal random variable, Δt = time step
              </p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button 
              onClick={() => setShowPricingFormulas(false)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomStrategyDetails = () => {
    if (!results.options || results.options.length === 0) {
      return (
        <div className="text-muted-foreground">
          No options added to the custom strategy.
        </div>
      );
    }

    // Determine if we have any barrier options to show model info
    const hasBarrierOptions = results.options.some((option: any) => 
      option.type.includes("KO") || option.type.includes("KI")
    );

    // Determine if we have any vanilla options
    const hasVanillaOptions = results.options.some((option: any) => 
      option.type === "call" || option.type === "put"
    );

    // Get model name for display
    const getPricingModelName = (modelCode: string) => {
      switch(modelCode) {
        case BARRIER_PRICING_MODELS.MONTE_CARLO:
        case VANILLA_PRICING_MODELS.MONTE_CARLO:
          return "Monte Carlo";
        case BARRIER_PRICING_MODELS.CLOSED_FORM:
          return "Closed-Form Analytical";
        case VANILLA_PRICING_MODELS.CLOSED_FORM:
          return "Garman-Kohlhagen";
        default:
          return "Standard";
      }
    };

    const barrierPricingModel = results.globalParams?.barrierPricingModel || 
                         BARRIER_PRICING_MODELS.MONTE_CARLO;
                         
    const vanillaPricingModel = results.globalParams?.vanillaPricingModel || 
                         VANILLA_PRICING_MODELS.CLOSED_FORM;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <ValueDisplay
            label="Total Premium"
            value={formatNumber(results.totalPremium)}
            suffix="% of notional"
            highlight
          />
          <ValueDisplay
            label="Number of Options"
            value={results.options.length.toString()}
          />
        </div>

        {hasVanillaOptions && (
          <div className="bg-primary/10 border border-primary/30 p-3 rounded-lg text-sm flex justify-between items-center">
            <div>
              <span className="font-medium">Vanilla Option Pricing Model: </span>
              <span className="text-primary">{getPricingModelName(vanillaPricingModel)}</span>
              <p className="text-xs text-muted-foreground mt-1">
                This affects the calculation of premium for standard calls and puts.
              </p>
            </div>
            <button
              onClick={() => setShowPricingFormulas(true)}
              className="flex items-center text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Info size={14} className="mr-1" />
              View Formulas
            </button>
          </div>
        )}

        {hasBarrierOptions && (
          <div className="bg-primary/10 border border-primary/30 p-3 rounded-lg text-sm flex justify-between items-center mt-3">
            <div>
              <span className="font-medium">Barrier Option Pricing Model: </span>
              <span className="text-primary">{getPricingModelName(barrierPricingModel)}</span>
              <p className="text-xs text-muted-foreground mt-1">
                This affects the calculation of premium for barrier options.
              </p>
            </div>
            <button
              onClick={() => setShowPricingFormulas(true)}
              className="flex items-center text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Info size={14} className="mr-1" />
              View Formulas
            </button>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
          <p>
            This custom strategy includes {results.options.length} option(s) with a total premium of{" "}
            <strong>{formatNumber(results.totalPremium)}</strong>.
          </p>
        </div>

        <div className="mt-4">
          <h4 className="font-medium mb-2">Option Details:</h4>
          {results.options.map((option: any, index: number) => {
            const optionType = OPTION_TYPES[option.type as keyof typeof OPTION_TYPES] || option.type;
            const strikeValue = option.strikeType === "percentage" 
              ? `${option.strike}% (${formatNumber(params.spot * option.strike / 100)})` 
              : formatNumber(option.strike);
              
            const needsBarrier = option.type.includes("KO") || option.type.includes("KI");
            const needsDoubleBarrier = option.type.includes("DKO") || option.type.includes("DKI");
            
            const upperBarrierValue = needsBarrier && option.upperBarrier 
              ? (option.upperBarrierType === "percentage" 
                ? `${option.upperBarrier}% (${formatNumber(params.spot * option.upperBarrier / 100)})` 
                : formatNumber(option.upperBarrier)) 
              : null;
              
            const lowerBarrierValue = needsDoubleBarrier && option.lowerBarrier 
              ? (option.lowerBarrierType === "percentage" 
                ? `${option.lowerBarrier}% (${formatNumber(params.spot * option.lowerBarrier / 100)})` 
                : formatNumber(option.lowerBarrier)) 
              : null;

            return (
              <div key={index} className="mb-2 p-2 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Type:</span> {optionType}
                  </div>
                  <div>
                    <span className="font-medium">Strike:</span> {strikeValue}
                  </div>
                  
                  {upperBarrierValue && (
                    <div>
                      <span className="font-medium">
                        {needsDoubleBarrier ? "Upper Barrier:" : "Barrier:"}
                      </span> {upperBarrierValue}
                    </div>
                  )}
                  
                  {lowerBarrierValue && (
                    <div>
                      <span className="font-medium">Lower Barrier:</span> {lowerBarrierValue}
                    </div>
                  )}
                  
                  <div>
                    <span className="font-medium">Volatility:</span> {option.volatility}%
                  </div>
                  <div>
                    <span className="font-medium">Quantity:</span> {option.quantity}%
                  </div>
                  <div>
                    <span className="font-medium">Premium:</span> {formatNumber(option.premium)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStrategyDetails = () => {
    if (selectedStrategy === "custom") {
      return renderCustomStrategyDetails();
    }
    
    switch (selectedStrategy) {
      case "collarPut":
      case "collarCall":
        const isFixedPut = selectedStrategy === "collarPut";
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label={isFixedPut ? "Put Strike (Fixed)" : "Put Strike (Adjusted)"}
                value={formatNumber(results.putStrike)}
                highlight={isFixedPut}
              />
              <ValueDisplay
                label={isFixedPut ? "Call Strike (Adjusted)" : "Call Strike (Fixed)"}
                value={formatNumber(results.callStrike)}
                highlight={!isFixedPut}
              />
              <ValueDisplay
                label="Put Premium"
                value={formatNumber(results.putPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Call Premium"
                value={formatNumber(results.callPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Net Premium"
                value={formatNumber(results.totalPremium)}
                suffix="% of notional"
                className="col-span-2"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This zero-cost collar with {isFixedPut ? "fixed put strike" : "fixed call strike"} protects against rates below{" "}
                <strong>{formatNumber(results.putStrike)}</strong> while
                capping gains above{" "}
                <strong>{formatNumber(results.callStrike)}</strong>.
                {Math.abs(results.totalPremium) > 0.0001 && 
                  ` Net premium is ${formatNumber(results.totalPremium)}.`}
              </p>
            </div>
          </>
        );

      case "forward":
        return (
          <>
            <div className="mb-4">
              <ValueDisplay
                label="Forward Rate"
                value={formatNumber(results.forwardRate)}
                highlight
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                The forward contract locks in the exchange rate at{" "}
                <strong>{formatNumber(results.forwardRate)}</strong> for the specified maturity,
                removing all uncertainty but also potential upside.
              </p>
            </div>
          </>
        );

      case "strangle":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label="Put Strike"
                value={formatNumber(results.putStrike)}
                highlight
              />
              <ValueDisplay
                label="Call Strike"
                value={formatNumber(results.callStrike)}
                highlight
              />
              <ValueDisplay
                label="Put Premium"
                value={formatNumber(results.putPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Call Premium"
                value={formatNumber(results.callPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Total Premium"
                value={formatNumber(results.totalPremium)}
                suffix="% of notional"
                className="col-span-2"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This strangle provides protection against rates outside the range
                of <strong>{formatNumber(results.putStrike)}</strong> to{" "}
                <strong>{formatNumber(results.callStrike)}</strong> with a premium
                cost of <strong>{formatNumber(results.totalPremium)}</strong>.
              </p>
            </div>
          </>
        );

      case "straddle":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label="Strike"
                value={formatNumber(results.strike)}
                highlight
              />
              <ValueDisplay
                label="Total Premium"
                value={formatNumber(results.totalPremium)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Put Premium"
                value={formatNumber(results.putPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Call Premium"
                value={formatNumber(results.callPrice)}
                suffix="% of notional"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This straddle protects against volatility in either direction
                from the at-the-money strike of{" "}
                <strong>{formatNumber(results.strike)}</strong> with a premium
                cost of <strong>{formatNumber(results.totalPremium)}</strong>.
              </p>
            </div>
          </>
        );

      case "put":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label="Put Strike"
                value={formatNumber(results.putStrike)}
                highlight
              />
              <ValueDisplay
                label="Option Quantity"
                value={`${results.optionQuantity}%`}
                highlight
              />
              <ValueDisplay
                label="Put Premium"
                value={formatNumber(results.putPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Adjusted Premium"
                value={formatNumber(results.adjustedPutPrice)}
                suffix="% of notional"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This put option provides {results.optionQuantity}% protection below{" "}
                <strong>{formatNumber(results.putStrike)}</strong> with a premium
                cost of <strong>{formatNumber(results.adjustedPutPrice)}</strong>.
              </p>
            </div>
          </>
        );

      case "call":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label="Call Strike"
                value={formatNumber(results.callStrike)}
                highlight
              />
              <ValueDisplay
                label="Option Quantity"
                value={`${results.optionQuantity}%`}
                highlight
              />
              <ValueDisplay
                label="Call Premium"
                value={formatNumber(results.callPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Adjusted Premium"
                value={formatNumber(results.adjustedCallPrice)}
                suffix="% of notional"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This call option provides {results.optionQuantity}% protection above{" "}
                <strong>{formatNumber(results.callStrike)}</strong> with a premium
                cost of <strong>{formatNumber(results.adjustedCallPrice)}</strong>.
              </p>
            </div>
          </>
        );

      case "seagull":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label="Put Sell Strike (Low)"
                value={formatNumber(results.putSellStrike)}
              />
              <ValueDisplay
                label="Put Buy Strike (Mid)"
                value={formatNumber(results.putBuyStrike)}
                highlight
              />
              <ValueDisplay
                label="Call Sell Strike (High)"
                value={formatNumber(results.callSellStrike)}
              />
              <ValueDisplay
                label="Net Premium"
                value={formatNumber(results.netPremium)}
                suffix="% of notional"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This seagull strategy provides protection between{" "}
                <strong>{formatNumber(results.putBuyStrike)}</strong> and{" "}
                <strong>{formatNumber(results.callSellStrike)}</strong> with limited
                protection below{" "}
                <strong>{formatNumber(results.putSellStrike)}</strong>. Net premium is{" "}
                <strong>{formatNumber(results.netPremium)}</strong>.
              </p>
            </div>
          </>
        );

      case "callKO":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label="Call Strike"
                value={formatNumber(results.callStrike)}
                highlight
              />
              <ValueDisplay
                label="KO Barrier"
                value={formatNumber(results.barrier)}
                highlight
              />
              <ValueDisplay
                label="Call Premium"
                value={formatNumber(results.callPrice)}
                suffix="% of notional"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This Knock-Out Call option provides protection above{" "}
                <strong>{formatNumber(results.callStrike)}</strong> as long as the rate
                doesn't exceed the barrier at{" "}
                <strong>{formatNumber(results.barrier)}</strong>. The premium
                is <strong>{formatNumber(results.callPrice)}</strong>.
              </p>
            </div>
          </>
        );

      case "putKI":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label="Put Strike"
                value={formatNumber(results.putStrike)}
                highlight
              />
              <ValueDisplay
                label="KI Barrier"
                value={formatNumber(results.barrier)}
                highlight
              />
              <ValueDisplay
                label="Put Premium"
                value={formatNumber(results.putPrice)}
                suffix="% of notional"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This Knock-In Put option provides protection below{" "}
                <strong>{formatNumber(results.putStrike)}</strong> only if the rate
                reaches the barrier at{" "}
                <strong>{formatNumber(results.barrier)}</strong>. The premium
                is <strong>{formatNumber(results.putPrice)}</strong>.
              </p>
            </div>
          </>
        );

      case "callPutKI_KO":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ValueDisplay
                label="Call Strike"
                value={formatNumber(results.callStrike)}
              />
              <ValueDisplay
                label="Upper Barrier (KO)"
                value={formatNumber(results.barrierUpper)}
                highlight
              />
              <ValueDisplay
                label="Put Strike"
                value={formatNumber(results.putStrike)}
              />
              <ValueDisplay
                label="Lower Barrier (KI)"
                value={formatNumber(results.barrierLower)}
                highlight
              />
              <ValueDisplay
                label="Call Premium"
                value={formatNumber(results.callPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Put Premium"
                value={formatNumber(results.putPrice)}
                suffix="% of notional"
              />
              <ValueDisplay
                label="Total Premium"
                value={formatNumber(results.totalPremium)}
                suffix="% of notional"
                className="col-span-2"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This combined strategy uses a Knock-Out Call with barrier at{" "}
                <strong>{formatNumber(results.barrierUpper)}</strong> and a Knock-In Put 
                with barrier at{" "}
                <strong>{formatNumber(results.barrierLower)}</strong>. It's designed to
                benefit from a downward move to the lower barrier. Total premium
                is <strong>{formatNumber(results.totalPremium)}</strong>.
              </p>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <HoverCard>
        <Heading level={3}>
          {STRATEGIES[selectedStrategy as keyof typeof STRATEGIES]?.name || "Strategy"} - Results
        </Heading>
        {renderStrategyDetails()}
      </HoverCard>
      
      {showPricingFormulas && <FormulaInfoDialog />}
    </>
  );
};

export default StrategyInfo;
