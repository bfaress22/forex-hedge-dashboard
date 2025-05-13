import { erf } from 'mathjs';

// Black-Scholes option pricing for Forex
export const calculateD1D2 = (S: number, K: number, T: number, r1: number, r2: number, sigma: number) => {
  const d1 = (Math.log(S/K) + (r1 - r2 + Math.pow(sigma, 2)/2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return [d1, d2];
};

export const calculateCall = (S: number, K: number, T: number, r1: number, r2: number, sigma: number) => {
  const [d1, d2] = calculateD1D2(S, K, T, r1, r2, sigma);
  const nd1 = (1 + erf(d1/Math.sqrt(2)))/2;
  const nd2 = (1 + erf(d2/Math.sqrt(2)))/2;
  return S * Math.exp(-r2*T) * nd1 - K * Math.exp(-r1*T) * nd2;
};

export const calculatePut = (S: number, K: number, T: number, r1: number, r2: number, sigma: number) => {
  const [d1, d2] = calculateD1D2(S, K, T, r1, r2, sigma);
  const nd1 = (1 + erf(-d1/Math.sqrt(2)))/2;
  const nd2 = (1 + erf(-d2/Math.sqrt(2)))/2;
  return K * Math.exp(-r1*T) * nd2 - S * Math.exp(-r2*T) * nd1;
};

// Forward rate calculation
export const calculateForward = (S: number, T: number, r1: number, r2: number) => {
  return S * Math.exp((r1 - r2) * T);
};

// New function to calculate barrier option prices
export const calculateBarrierOption = (type: string, S: number, K: number, B: number, T: number, r1: number, r2: number, sigma: number, isKnockIn: boolean) => {
  // Simplified barrier option pricing
  // In a real application, this would use more complex models
  // This is a simple approximation for demo purposes
  
  const standardPrice = type === 'call' 
    ? calculateCall(S, K, T, r1, r2, sigma) 
    : calculatePut(S, K, T, r1, r2, sigma);
  
  // Barrier adjustment factor
  let barrierFactor;
  
  if (type === 'call') {
    if (isKnockIn) {
      // Call KI - B is typically below spot
      barrierFactor = Math.max(0, Math.min(1, (S - B) / (0.1 * S)));
    } else {
      // Call KO - B is typically above spot
      barrierFactor = Math.max(0, Math.min(1, (B - S) / (0.1 * S)));
    }
  } else {
    if (isKnockIn) {
      // Put KI - B is typically above spot
      barrierFactor = Math.max(0, Math.min(1, (B - S) / (0.1 * S)));
    } else {
      // Put KO - B is typically below spot
      barrierFactor = Math.max(0, Math.min(1, (S - B) / (0.1 * S)));
    }
  }
  
  // Adjust price by barrier factor
  // This is a simplified approach - real pricing would be more complex
  return standardPrice * barrierFactor;
};

// Find equivalent strike for zero-cost collar
export const findCollarEquivalentStrike = (params: {
  spot: number;
  strikeUpper: number | null;
  strikeLower: number | null;
  maturity: number;
  r1: number;
  r2: number;
  vol: number;
}) => {
  const { spot, strikeUpper, strikeLower, maturity, r1, r2, vol } = params;
  
  if (strikeUpper && !strikeLower) {
    // Start with Call to find equivalent Put
    const callPrice = calculateCall(
      spot,
      strikeUpper,
      maturity,
      r1,
      r2,
      vol
    );

    let left = 0.8 * spot;
    let right = strikeUpper;
    let mid;
    const tolerance = 0.0001;

    while (right - left > tolerance) {
      mid = (left + right) / 2;
      const putPrice = calculatePut(
        spot,
        mid,
        maturity,
        r1,
        r2,
        vol
      );

      if (putPrice > callPrice) {
        right = mid;
      } else {
        left = mid;
      }
    }

    return {
      callStrike: strikeUpper,
      putStrike: mid,
      callPrice: callPrice,
      putPrice: callPrice // By design, equal to call price
    };
  } else if (strikeLower) {
    // Start with Put to find equivalent Call
    const putPrice = calculatePut(
      spot,
      strikeLower,
      maturity,
      r1,
      r2,
      vol
    );

    let left = strikeLower;
    let right = 1.2 * spot;
    let mid;
    const tolerance = 0.0001;

    while (right - left > tolerance) {
      mid = (left + right) / 2;
      const callPrice = calculateCall(
        spot,
        mid,
        maturity,
        r1,
        r2,
        vol
      );

      if (callPrice > putPrice) {
        left = mid;
      } else {
        right = mid;
      }
    }

    return {
      putStrike: strikeLower,
      callStrike: mid,
      putPrice: putPrice,
      callPrice: putPrice // By design, equal to put price
    };
  } else {
    // Default case if neither strike is provided
    return {
      putStrike: spot * 0.95,
      callStrike: spot * 1.05,
      putPrice: 0,
      callPrice: 0
    };
  }
};

// Calculate strategy results based on selected strategy
export const calculateStrategyResults = (
  selectedStrategy: string,
  params: {
    spot: number;
    strikeUpper: number;
    strikeLower: number;
    strikeMid: number;
    barrierUpper: number;
    barrierLower: number;
    maturity: number;
    r1: number;
    r2: number;
    vol: number;
    optionQuantity?: number;
  }
) => {
  const { spot, strikeUpper, strikeLower, strikeMid, barrierUpper, barrierLower, maturity, r1, r2, vol } = params;
  
  switch(selectedStrategy) {
    case 'collar':
      return findCollarEquivalentStrike({
        spot, 
        strikeUpper, 
        strikeLower, 
        maturity, 
        r1, 
        r2, 
        vol
      });
    
    case 'forward':
      const forwardRate = calculateForward(spot, maturity, r1, r2);
      return {
        forwardRate,
        details: `Forward rate fixed at ${forwardRate.toFixed(4)}`
      };
    
    case 'strangle':
      const putPrice = calculatePut(spot, strikeLower, maturity, r1, r2, vol);
      const callPrice = calculateCall(spot, strikeUpper, maturity, r1, r2, vol);
      return {
        putStrike: strikeLower,
        callStrike: strikeUpper,
        putPrice,
        callPrice,
        totalPremium: putPrice + callPrice
      };
    
    case 'straddle':
      const atMoneyPut = calculatePut(spot, spot, maturity, r1, r2, vol);
      const atMoneyCall = calculateCall(spot, spot, maturity, r1, r2, vol);
      return {
        strike: spot,
        putPrice: atMoneyPut,
        callPrice: atMoneyCall,
        totalPremium: atMoneyPut + atMoneyCall
      };
    
    case 'put':
      const simplePutPrice = calculatePut(spot, strikeLower, maturity, r1, r2, vol);
      const adjustedPutPrice = simplePutPrice * (params.optionQuantity || 100) / 100;
      return {
        putStrike: strikeLower,
        putPrice: simplePutPrice,
        adjustedPutPrice,
        optionQuantity: params.optionQuantity || 100
      };
    
    case 'call':
      const simpleCallPrice = calculateCall(spot, strikeUpper, maturity, r1, r2, vol);
      const adjustedCallPrice = simpleCallPrice * (params.optionQuantity || 100) / 100;
      return {
        callStrike: strikeUpper,
        callPrice: simpleCallPrice,
        adjustedCallPrice,
        optionQuantity: params.optionQuantity || 100
      };
    
    case 'seagull':
      // Buy a put, sell an OTM call, sell an OTM put
      const seagullPutBuy = calculatePut(spot, strikeMid, maturity, r1, r2, vol);
      const seagullCallSell = calculateCall(spot, strikeUpper, maturity, r1, r2, vol);
      const seagullPutSell = calculatePut(spot, strikeLower, maturity, r1, r2, vol);
      const netPremium = seagullPutBuy - seagullCallSell - seagullPutSell;
      
      return {
        putBuyStrike: strikeMid,
        callSellStrike: strikeUpper,
        putSellStrike: strikeLower,
        putBuyPrice: seagullPutBuy,
        callSellPrice: seagullCallSell,
        putSellPrice: seagullPutSell,
        netPremium
      };
    
    case 'callKO':
      // Call with Knock-Out barrier
      const callKOPrice = calculateBarrierOption('call', spot, strikeUpper, barrierUpper, maturity, r1, r2, vol, false);
      return {
        callStrike: strikeUpper,
        barrier: barrierUpper,
        callPrice: callKOPrice,
        details: "Call KO deactivated if the rate exceeds the barrier"
      };
    
    case 'putKI':
      // Put with Knock-In barrier
      const putKIPrice = calculateBarrierOption('put', spot, strikeLower, barrierUpper, maturity, r1, r2, vol, true);
      return {
        putStrike: strikeLower,
        barrier: barrierUpper,
        putPrice: putKIPrice,
        details: "Put KI activated if the rate exceeds the barrier"
      };
    
    case 'callPutKI_KO':
      // Combination of Call KO and Put KI
      const comboCallKOPrice = calculateBarrierOption('call', spot, strikeUpper, barrierUpper, maturity, r1, r2, vol, false);
      const comboPutKIPrice = calculateBarrierOption('put', spot, strikeLower, barrierLower, maturity, r1, r2, vol, true);
      
      return {
        callStrike: strikeUpper,
        putStrike: strikeLower,
        barrierUpper: barrierUpper,
        barrierLower: barrierLower,
        callPrice: comboCallKOPrice,
        putPrice: comboPutKIPrice,
        totalPremium: comboCallKOPrice + comboPutKIPrice,
        details: "Strategy to benefit from a downside movement to the barrier"
      };
    
    case 'collarPut': {
      // L'utilisateur fixe le put strike, le call strike s'ajuste automatiquement
      const { spot, strikeLower, maturity, r1, r2, vol } = params;
      const putStrike = strikeLower;
      const putPrice = calculatePut(spot, putStrike, maturity, r1, r2, vol);
      
      // Trouver le strike du call qui donne le même prix que le put
      let callStrike = spot * 1.05; // Valeur initiale
      let callPrice = calculateCall(spot, callStrike, maturity, r1, r2, vol);
      
      // Ajuster iterativement le strike du call pour obtenir un coût net proche de zéro
      const precision = 0.0001;
      const maxIterations = 50;
      let iterations = 0;
      
      while (Math.abs(callPrice - putPrice) > precision && iterations < maxIterations) {
        if (callPrice > putPrice) {
          callStrike += spot * 0.01; // Augmenter le strike pour réduire le premium
        } else {
          callStrike -= spot * 0.01; // Réduire le strike pour augmenter le premium
        }
        callPrice = calculateCall(spot, callStrike, maturity, r1, r2, vol);
        iterations++;
      }
      
      return {
        putStrike,
        callStrike,
        putPrice,
        callPrice,
        totalPremium: putPrice - callPrice, // Devrait être proche de zéro
      };
    }
    
    case 'collarCall': {
      // L'utilisateur fixe le call strike, le put strike s'ajuste automatiquement
      const { spot, strikeUpper, maturity, r1, r2, vol } = params;
      const callStrike = strikeUpper;
      const callPrice = calculateCall(spot, callStrike, maturity, r1, r2, vol);
      
      // Trouver le strike du put qui donne le même prix que le call
      let putStrike = spot * 0.95; // Valeur initiale
      let putPrice = calculatePut(spot, putStrike, maturity, r1, r2, vol);
      
      // Ajuster iterativement le strike du put pour obtenir un coût net proche de zéro
      const precision = 0.0001;
      const maxIterations = 50;
      let iterations = 0;
      
      while (Math.abs(putPrice - callPrice) > precision && iterations < maxIterations) {
        if (putPrice > callPrice) {
          putStrike -= spot * 0.01; // Réduire le strike pour réduire le premium
        } else {
          putStrike += spot * 0.01; // Augmenter le strike pour augmenter le premium
        }
        putPrice = calculatePut(spot, putStrike, maturity, r1, r2, vol);
        iterations++;
      }
      
      return {
        putStrike,
        callStrike,
        putPrice,
        callPrice,
        totalPremium: putPrice - callPrice, // Devrait être proche de zéro
      };
    }
    
    default:
      return null;
  }
};

// Calculate payoff data for chart
export const calculatePayoff = (results: any, selectedStrategy: string, params: any, includePremiumInPayoff: boolean = true) => {
  if (!results) return [];
  
  // Reverse the logic of includePremiumInPayoff to fix the behavior
  const shouldIncludePremium = !includePremiumInPayoff;
  
  const spots = [];
  const minSpot = params.spot * 0.7;
  const maxSpot = params.spot * 1.3;
  const step = (maxSpot - minSpot) / 100;

  for (let spot = minSpot; spot <= maxSpot; spot += step) {
    const noHedgePayoff = spot;
    let hedgedPayoff;
    let hedgedPayoffWithPremium;

    switch(selectedStrategy) {
      case 'collar':
      case 'collarPut':
      case 'collarCall':
        hedgedPayoff = Math.min(Math.max(spot, results.putStrike), results.callStrike);
        // Collar is typically zero-cost, but we'll account for any premium difference just in case
        hedgedPayoffWithPremium = hedgedPayoff - (results.callPrice - results.putPrice);
        break;
      
      case 'forward':
        hedgedPayoff = results.forwardRate;
        hedgedPayoffWithPremium = hedgedPayoff;
        break;
      
      case 'strangle':
        if (spot < results.putStrike) {
          hedgedPayoff = results.putStrike; // Put protection
        } else if (spot > results.callStrike) {
          hedgedPayoff = results.callStrike; // Call protection
        } else {
          hedgedPayoff = spot; // Between strikes, no protection
        }
        // Adjust for premium cost
        hedgedPayoffWithPremium = hedgedPayoff - results.totalPremium;
        break;
      
      case 'straddle':
        hedgedPayoff = results.strike; // Protection in both directions
        // Adjust for premium cost
        hedgedPayoffWithPremium = hedgedPayoff - results.totalPremium;
        break;
      
      case 'put':
        // Ajuster le payoff en fonction de la quantité
        const quantity = results.optionQuantity / 100 || 1;
        if (spot < results.putStrike) {
          // Protection partielle selon la quantité
          hedgedPayoff = spot + ((results.putStrike - spot) * quantity);
        } else {
          hedgedPayoff = spot;
        }
        // Ajuster pour le coût de la prime
        hedgedPayoffWithPremium = hedgedPayoff - results.adjustedPutPrice;
        break;
      
      case 'call':
        // Ajuster le payoff en fonction de la quantité
        const callQuantity = results.optionQuantity / 100 || 1;
        if (spot > results.callStrike) {
          // Protection partielle selon la quantité
          hedgedPayoff = spot - ((spot - results.callStrike) * callQuantity);
        } else {
          hedgedPayoff = spot;
        }
        // Ajuster pour le coût de la prime
        hedgedPayoffWithPremium = hedgedPayoff - results.adjustedCallPrice;
        break;
      
      case 'seagull':
        if (spot < results.putSellStrike) {
          // If very low, lose put protection
          hedgedPayoff = spot + (results.putSellStrike - spot);
        } else if (spot < results.putBuyStrike) {
          // Protection from bought put
          hedgedPayoff = results.putBuyStrike;
        } else if (spot > results.callSellStrike) {
          // Limited by sold call
          hedgedPayoff = results.callSellStrike;
        } else {
          // Between put and call, no protection
          hedgedPayoff = spot;
        }
        // Adjust for net premium
        hedgedPayoffWithPremium = hedgedPayoff - results.netPremium;
        break;
      
      case 'callKO':
        if (spot > results.barrier) {
          // Barrier knocked out - no protection
          hedgedPayoff = spot;
        } else if (spot > results.callStrike) {
          // Call protection active
          hedgedPayoff = results.callStrike;
        } else {
          // Below call strike
          hedgedPayoff = spot;
        }
        // Adjust for premium cost
        hedgedPayoffWithPremium = hedgedPayoff - results.callPrice;
        break;
      
      case 'putKI':
        if (spot > results.barrier) {
          // Barrier activated put
          hedgedPayoff = Math.max(spot, results.putStrike);
        } else {
          // Barrier not reached, no protection
          hedgedPayoff = spot;
        }
        // Adjust for premium cost
        hedgedPayoffWithPremium = hedgedPayoff - results.putPrice;
        break;
      
      case 'callPutKI_KO':
        if (spot > results.barrierUpper) {
          // Upper barrier knocked out call, no upper protection
          hedgedPayoff = spot;
        } else if (spot < results.barrierLower) {
          // Lower barrier activated put
          hedgedPayoff = results.putStrike;
        } else if (spot > results.callStrike) {
          // Call protection active
          hedgedPayoff = results.callStrike;
        } else if (spot < results.putStrike) {
          // Between barriers, put not activated
          hedgedPayoff = spot;
        } else {
          // Between strikes
          hedgedPayoff = spot;
        }
        // Adjust for premium cost
        hedgedPayoffWithPremium = hedgedPayoff - results.totalPremium;
        break;
      
      default:
        hedgedPayoff = spot;
        hedgedPayoffWithPremium = spot;
    }
    
    const dataPoint: any = {
      spot: parseFloat(spot.toFixed(4)),
      'Unhedged Rate': parseFloat(noHedgePayoff.toFixed(4)),
      'Initial Spot': parseFloat(params.spot.toFixed(4))
    };
    
    // Add the appropriate hedged rate based on premium inclusion preference
    if (shouldIncludePremium) {
      dataPoint['Hedged Rate'] = parseFloat(hedgedPayoffWithPremium.toFixed(4));
    } else {
      dataPoint['Hedged Rate'] = parseFloat(hedgedPayoff.toFixed(4));
    }
    
    // Also add the alternative rate for comparison
    if (shouldIncludePremium) {
      dataPoint['Hedged Rate (No Premium)'] = parseFloat(hedgedPayoff.toFixed(4));
    } else {
      dataPoint['Hedged Rate with Premium'] = parseFloat(hedgedPayoffWithPremium.toFixed(4));
    }
    
    // Add relevant strikes based on strategy
    if (selectedStrategy === 'collar' || selectedStrategy === 'collarPut' || selectedStrategy === 'collarCall') {
      dataPoint['Put Strike'] = parseFloat(results.putStrike.toFixed(4));
      dataPoint['Call Strike'] = parseFloat(results.callStrike.toFixed(4));
    } else if (selectedStrategy === 'strangle') {
      dataPoint['Put Strike'] = parseFloat(results.putStrike.toFixed(4));
      dataPoint['Call Strike'] = parseFloat(results.callStrike.toFixed(4));
    } else if (selectedStrategy === 'straddle') {
      dataPoint['Strike'] = parseFloat(results.strike.toFixed(4));
    } else if (selectedStrategy === 'put') {
      dataPoint['Put Strike'] = parseFloat(results.putStrike.toFixed(4));
    } else if (selectedStrategy === 'call') {
      dataPoint['Call Strike'] = parseFloat(results.callStrike.toFixed(4));
    } else if (selectedStrategy === 'seagull') {
      dataPoint['Put Sell Strike'] = parseFloat(results.putSellStrike.toFixed(4));
      dataPoint['Put Buy Strike'] = parseFloat(results.putBuyStrike.toFixed(4));
      dataPoint['Call Sell Strike'] = parseFloat(results.callSellStrike.toFixed(4));
    }
    
    if (selectedStrategy === 'callKO') {
      dataPoint['Call Strike'] = parseFloat(results.callStrike.toFixed(4));
      dataPoint['KO Barrier'] = parseFloat(results.barrier.toFixed(4));
    } else if (selectedStrategy === 'putKI') {
      dataPoint['Put Strike'] = parseFloat(results.putStrike.toFixed(4));
      dataPoint['KI Barrier'] = parseFloat(results.barrier.toFixed(4));
    } else if (selectedStrategy === 'callPutKI_KO') {
      dataPoint['Call Strike'] = parseFloat(results.callStrike.toFixed(4));
      dataPoint['Put Strike'] = parseFloat(results.putStrike.toFixed(4));
      dataPoint['Upper Barrier (KO)'] = parseFloat(results.barrierUpper.toFixed(4));
      dataPoint['Lower Barrier (KI)'] = parseFloat(results.barrierLower.toFixed(4));
    }
    
    spots.push(dataPoint);
  }
  
  return spots;
};

// Appliquer les effets d'un scénario de stress test aux résultats
export const applyStressTestToResults = (
  initialResults: any[],
  scenario: {
    volatility: number;
    rateShock: number;
    rateDifferentialShock?: number;
    forwardPointsShock?: number;
  },
  params: {
    domesticRate: number; 
    foreignRate: number;
    monthsToHedge: number;
  },
  recalculateOptions: boolean = true
) => {
  if (!initialResults || initialResults.length === 0) return [];

  // Convertir les taux en décimal
  const r_d = params.domesticRate / 100;
  const r_f = params.foreignRate / 100;
  
  // Appliquer le choc au différentiel de taux si spécifié
  let adjustedDomesticRate = r_d;
  let adjustedForeignRate = r_f;
  
  if (scenario.rateDifferentialShock !== undefined && scenario.rateDifferentialShock !== 0) {
    // Le choc élargit ou réduit l'écart entre les taux
    // Si r_d = 2% et r_f = 1%, le différentiel est de 1%
    // Un shock de +0.5% ferait passer le différentiel à 1.5%
    const currentDiff = r_d - r_f;
    const newDiff = currentDiff + scenario.rateDifferentialShock;
    
    // On distribue le choc également entre les deux taux
    adjustedDomesticRate = r_d + (scenario.rateDifferentialShock / 2);
    adjustedForeignRate = r_f - (scenario.rateDifferentialShock / 2);
  }

  return initialResults.map((result, index) => {
    // Copier le résultat original
    const stressedResult = { ...result };
    
    // Appliquer le choc au taux réel
    stressedResult.realRate = stressedResult.realRate * (1 + scenario.rateShock);
    
    // Calculer le nouveau taux à terme avec le différentiel de taux modifié
    const timeToMaturity = stressedResult.timeToMaturity; // En années
    const spotRate = stressedResult.realRate / (1 + scenario.rateShock); // Taux spot original
    
    // Forward = Spot * e^((r_d - r_f) * T)
    stressedResult.forwardRate = spotRate * Math.exp((adjustedDomesticRate - adjustedForeignRate) * timeToMaturity);
    
    // Appliquer un choc direct aux points forwards si spécifié
    if (scenario.forwardPointsShock !== undefined && scenario.forwardPointsShock !== 0) {
      // Les points forwards sont exprimés en % du taux spot sur la période
      stressedResult.forwardRate += spotRate * scenario.forwardPointsShock;
    }
    
    // Nouvelle volatilité implicite
    if (recalculateOptions && stressedResult.impliedVolatility !== undefined) {
      stressedResult.impliedVolatility = Math.max(scenario.volatility * 100, stressedResult.impliedVolatility);
    } else if (recalculateOptions) {
      stressedResult.impliedVolatility = scenario.volatility * 100;
    }
    
    // TODO: Recalculer les prix des options et payoffs en fonction des nouveaux paramètres
    // Cette partie dépend de la structure exacte de vos données et des calculs d'options
    
    return stressedResult;
  });
};
