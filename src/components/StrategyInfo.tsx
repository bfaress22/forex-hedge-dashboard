import React from "react";
import { HoverCard, Heading, ValueDisplay } from "@/components/ui/layout";
import { STRATEGIES, OPTION_TYPES } from "@/utils/forexData";

interface StrategyInfoProps {
  selectedStrategy: string;
  results: any;
  params: any;
}

const StrategyInfo = ({ selectedStrategy, results, params }: StrategyInfoProps) => {
  if (!results) return null;

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null || isNaN(num)) return "N/A";
    return num.toFixed(4);
  };

  const formatPercentage = (num: number | undefined) => {
    if (num === undefined || num === null || isNaN(num)) return "N/A";
    return (num * 100).toFixed(2) + "%";
  };

  const renderCustomStrategyDetails = () => {
    if (!results.options || results.options.length === 0) {
      return (
        <div className="text-muted-foreground">
          Aucune option ajoutée à la stratégie personnalisée.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <ValueDisplay
            label="Prime totale"
            value={formatNumber(results.totalPremium)}
            suffix="% of notional"
            highlight
          />
          <ValueDisplay
            label="Nombre d'options"
            value={results.options.length.toString()}
          />
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
          <p>
            Cette stratégie personnalisée comprend {results.options.length} option(s) avec une prime totale de{" "}
            <strong>{formatNumber(results.totalPremium)}</strong>.
          </p>
        </div>

        <div className="mt-4">
          <h4 className="font-medium mb-2">Détails des options:</h4>
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
                        {needsDoubleBarrier ? "Barrière haute:" : "Barrière:"}
                      </span> {upperBarrierValue}
                    </div>
                  )}
                  
                  {lowerBarrierValue && (
                    <div>
                      <span className="font-medium">Barrière basse:</span> {lowerBarrierValue}
                    </div>
                  )}
                  
                  <div>
                    <span className="font-medium">Volatilité:</span> {option.volatility}%
                  </div>
                  <div>
                    <span className="font-medium">Quantité:</span> {option.quantity}%
                  </div>
                  <div>
                    <span className="font-medium">Prime:</span> {formatNumber(option.premium)}
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
      case "collar":
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
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This zero-cost collar protects against rates below{" "}
                <strong>{formatNumber(results.putStrike)}</strong> while
                capping gains above{" "}
                <strong>{formatNumber(results.callStrike)}</strong>.
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
                label="Put Premium"
                value={formatNumber(results.putPrice)}
                suffix="% of notional"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This put option provides downside protection below{" "}
                <strong>{formatNumber(results.putStrike)}</strong> with a premium
                cost of <strong>{formatNumber(results.putPrice)}</strong>.
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
                label="Call Premium"
                value={formatNumber(results.callPrice)}
                suffix="% of notional"
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg text-sm">
              <p>
                This call option provides upside protection above{" "}
                <strong>{formatNumber(results.callStrike)}</strong> with a premium
                cost of <strong>{formatNumber(results.callPrice)}</strong>.
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
    <HoverCard>
      <Heading level={3}>
        {STRATEGIES[selectedStrategy as keyof typeof STRATEGIES]?.name || "Stratégie"} - Results
      </Heading>
      {renderStrategyDetails()}
    </HoverCard>
  );
};

export default StrategyInfo;
