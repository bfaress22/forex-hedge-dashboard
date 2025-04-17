// Calculations for barrier options

// Models for barrier option pricing
export const BARRIER_PRICING_MODELS = {
  MONTE_CARLO: "monte_carlo",
  CLOSED_FORM: "closed_form"
};

// Default model
let currentPricingModel = BARRIER_PRICING_MODELS.MONTE_CARLO;

// Function to set the pricing model
export const setPricingModel = (model: string) => {
  if (Object.values(BARRIER_PRICING_MODELS).includes(model as any)) {
    currentPricingModel = model;
    return true;
  }
  return false;
};

// Function to calculate the price of a barrier option
export const calculateBarrierOptionPrice = (
  type: string,
  spot: number,
  strike: number,
  upperBarrier?: number,
  lowerBarrier?: number,
  maturity?: number,
  r1?: number,
  r2?: number,
  vol?: number,
  quantity: number = 100
) => {
  // Default values if parameters are undefined
  const t = maturity || 1.0; // Default maturity: 1 year
  const domesticRate = r1 || 0.02; // Default domestic interest rate: 2%
  const foreignRate = r2 || 0.01; // Default foreign interest rate: 1%
  const volatility = vol || 0.15; // Default volatility: 15%
  
  // Parse option type
  const isCall = type.includes('call');
  const isPut = type.includes('put') || (!isCall && !type.includes('forward'));
  const isKO = type.includes('KO');
  const isKI = type.includes('KI');
  const isReverse = type.includes('reverse');
  const isDouble = upperBarrier !== undefined && lowerBarrier !== undefined;
  
  // Validate parameters
  if (spot <= 0 || strike <= 0 || volatility <= 0 || t <= 0) {
    console.error("Invalid parameters for barrier option pricing:", { spot, strike, volatility, t });
    return 0;
  }
  
  if ((isKO || isKI) && upperBarrier === undefined && lowerBarrier === undefined) {
    console.error("Barrier option specified but no barriers provided:", type);
    return 0;
  }
  
  // Vanilla options calculated using closed-form solution
  if (!isKO && !isKI) {
    if (isCall) {
      return calculateCallPrice(spot, strike, t, domesticRate, foreignRate, volatility) * (quantity / 100);
    } else if (isPut) {
      return calculatePutPrice(spot, strike, t, domesticRate, foreignRate, volatility) * (quantity / 100);
    }
  }
  
  // For barrier options, use the selected pricing model
  if (currentPricingModel === BARRIER_PRICING_MODELS.CLOSED_FORM) {
    // Use closed-form solution for barrier options when possible
    // Note: Currently only supports single barrier options, not double barriers
    if (!isDouble) {
      const barrier = upperBarrier || 0;
      return calculateClosedFormBarrierOptionPrice(
        isCall, isPut, isKO, isKI, isReverse,
        spot, strike, barrier, t,
        domesticRate, foreignRate, volatility, quantity
      );
    } else {
      console.warn("Closed-form solution not available for double barrier options. Falling back to Monte Carlo.");
    }
  }
  
  // Use Monte Carlo simulation as a fallback or if specifically selected
    return calculateMonteCarloPrice(
      isCall, isPut, isKO, isKI, isReverse, isDouble,
    spot, strike, upperBarrier, lowerBarrier, t,
    domesticRate, foreignRate, volatility, quantity
  );
};

// Closed-form analytical solution for barrier options (single barrier only)
const calculateClosedFormBarrierOptionPrice = (
  isCall: boolean, isPut: boolean, isKO: boolean, isKI: boolean, 
  isReverse: boolean, spot: number, strike: number, barrier: number, 
  maturity: number, r1: number, r2: number, vol: number, quantity: number
) => {
  // Standard parameters used in multiple calculations
  const sigma = vol;
  const T = maturity;
  const S = spot;
  const K = strike;
  const H = barrier; // The barrier level
  const r_d = r1; // Domestic interest rate
  const r_f = r2; // Foreign interest rate
  
  // Calculate the drift term in the risk-neutral measure
  const mu = r_d - r_f - 0.5 * sigma * sigma;
  
  // Calculate common terms
  const sigma_sqrt_T = sigma * Math.sqrt(T);
  const lambda = (mu + 0.5 * sigma * sigma) / (sigma * sigma);
  const x = Math.log(S / K) / sigma_sqrt_T + lambda * sigma_sqrt_T;
  const y = Math.log(H * H / (S * K)) / sigma_sqrt_T + lambda * sigma_sqrt_T;
  const h = Math.log(H / S) / sigma_sqrt_T + lambda * sigma_sqrt_T;
  const h_minus = h - 2 * lambda * sigma_sqrt_T;

  // Power terms for the barrier formulas
  const two_lambda = 2 * lambda;
  const pow_term = Math.pow(H / S, two_lambda);
  
  let price = 0;
  
  // Calculate price based on option type
  if (isCall) {
    if (isKO) {
      if (!isReverse) {
        // Up-and-Out Call (standard)
        if (H <= K) {
          // Barrier below or at strike: standard call price
          price = calculateCallPrice(S, K, T, r_d, r_f, sigma);
        } else {
          // Barrier above strike: up-and-out call formula
          const vanilla_call = calculateCallPrice(S, K, T, r_d, r_f, sigma);
          const adjustment = S * Math.exp(-r_f * T) * normCDF(x) - 
                            K * Math.exp(-r_d * T) * normCDF(x - sigma_sqrt_T);
          
          const barrier_term = S * Math.exp(-r_f * T) * pow_term * normCDF(y) - 
                              K * Math.exp(-r_d * T) * pow_term * normCDF(y - sigma_sqrt_T);
          
          price = vanilla_call - adjustment + barrier_term;
        }
      } else {
        // Down-and-Out Call (reverse)
        if (H >= K) {
          // Barrier above or at strike: standard call price
          price = calculateCallPrice(S, K, T, r_d, r_f, sigma);
        } else {
          // Barrier below strike: down-and-out call formula
          const vanilla_call = calculateCallPrice(S, K, T, r_d, r_f, sigma);
          const barrier_term = S * Math.exp(-r_f * T) * pow_term * normCDF(-h) - 
                              K * Math.exp(-r_d * T) * pow_term * normCDF(-h + sigma_sqrt_T);
          
          price = vanilla_call - barrier_term;
        }
      }
    } else if (isKI) {
      if (!isReverse) {
        // Up-and-In Call (standard)
        if (H <= K) {
          // Barrier below or at strike: zero (never activated)
          price = 0;
        } else {
          // Barrier above strike: up-and-in call formula
          const vanilla_call = calculateCallPrice(S, K, T, r_d, r_f, sigma);
          const adjustment = S * Math.exp(-r_f * T) * normCDF(x) - 
                            K * Math.exp(-r_d * T) * normCDF(x - sigma_sqrt_T);
          
          const barrier_term = S * Math.exp(-r_f * T) * pow_term * normCDF(y) - 
                              K * Math.exp(-r_d * T) * pow_term * normCDF(y - sigma_sqrt_T);
          
          price = vanilla_call - (vanilla_call - adjustment + barrier_term);
        }
      } else {
        // Down-and-In Call (reverse)
        if (H >= K) {
          // Barrier above or at strike: zero (never activated)
          price = 0;
        } else {
          // Barrier below strike: down-and-in call formula
          const vanilla_call = calculateCallPrice(S, K, T, r_d, r_f, sigma);
          const barrier_term = S * Math.exp(-r_f * T) * pow_term * normCDF(-h) - 
                              K * Math.exp(-r_d * T) * pow_term * normCDF(-h + sigma_sqrt_T);
          
          price = barrier_term;
        }
      }
    }
  } else if (isPut) {
    if (isKO) {
      if (!isReverse) {
        // Down-and-Out Put (standard)
        if (H >= K) {
          // Barrier above or at strike: standard put price
          price = calculatePutPrice(S, K, T, r_d, r_f, sigma);
        } else {
          // Barrier below strike: down-and-out put formula
          const vanilla_put = calculatePutPrice(S, K, T, r_d, r_f, sigma);
          const adjustment = K * Math.exp(-r_d * T) * normCDF(-x + sigma_sqrt_T) - 
                            S * Math.exp(-r_f * T) * normCDF(-x);
          
          const barrier_term = K * Math.exp(-r_d * T) * pow_term * normCDF(-y + sigma_sqrt_T) - 
                              S * Math.exp(-r_f * T) * pow_term * normCDF(-y);
          
          price = vanilla_put - adjustment + barrier_term;
        }
      } else {
        // Up-and-Out Put (reverse)
        if (H <= K) {
          // Barrier below or at strike: standard put price
          price = calculatePutPrice(S, K, T, r_d, r_f, sigma);
        } else {
          // Barrier above strike: up-and-out put formula
          const vanilla_put = calculatePutPrice(S, K, T, r_d, r_f, sigma);
          const barrier_term = K * Math.exp(-r_d * T) * pow_term * normCDF(h - sigma_sqrt_T) - 
                              S * Math.exp(-r_f * T) * pow_term * normCDF(h);
          
          price = vanilla_put - barrier_term;
        }
      }
    } else if (isKI) {
      if (!isReverse) {
        // Down-and-In Put (standard)
        if (H >= K) {
          // Barrier above or at strike: zero (never activated)
          price = 0;
        } else {
          // Barrier below strike: down-and-in put formula
          const vanilla_put = calculatePutPrice(S, K, T, r_d, r_f, sigma);
          const adjustment = K * Math.exp(-r_d * T) * normCDF(-x + sigma_sqrt_T) - 
                            S * Math.exp(-r_f * T) * normCDF(-x);
          
          const barrier_term = K * Math.exp(-r_d * T) * pow_term * normCDF(-y + sigma_sqrt_T) - 
                              S * Math.exp(-r_f * T) * pow_term * normCDF(-y);
          
          price = vanilla_put - (vanilla_put - adjustment + barrier_term);
        }
      } else {
        // Up-and-In Put (reverse)
        if (H <= K) {
          // Barrier below or at strike: zero (never activated)
          price = 0;
        } else {
          // Barrier above strike: up-and-in put formula
          const vanilla_put = calculatePutPrice(S, K, T, r_d, r_f, sigma);
          const barrier_term = K * Math.exp(-r_d * T) * pow_term * normCDF(h - sigma_sqrt_T) - 
                              S * Math.exp(-r_f * T) * pow_term * normCDF(h);
          
          price = barrier_term;
        }
      }
    }
  }
  
  // Adjust for quantity
  return Math.max(0, price) * (quantity / 100);
};

// Monte Carlo simulation for barrier options
const calculateMonteCarloPrice = (
  isCall: boolean, isPut: boolean, isKO: boolean, isKI: boolean, 
  isReverse: boolean, isDouble: boolean,
  spot: number, strike: number, upperBarrier: number | undefined, 
  lowerBarrier: number | undefined, maturity: number, r1: number, 
  r2: number, vol: number, quantity: number
) => {
  // Monte Carlo parameters - Augmenté pour plus de précision
  const numSimulations = 5000; // Augmenté pour améliorer la précision (était 1000)
  const numSteps = 252;        // Nombre de pas de simulation (jours de trading dans une année)
  const dt = maturity / numSteps;
  const drift = (r1 - r2 - 0.5 * vol * vol) * dt;
  const diffusion = vol * Math.sqrt(dt);
  
  let sumPayoffs = 0;
  let pathCount = {
    barrierHit: 0,
    nonZeroPayoff: 0
  };
  
  // Validation des barrières
  if (upperBarrier !== undefined && upperBarrier <= 0) {
    console.error("Invalid upper barrier value:", upperBarrier);
    return 0;
  }
  
  if (lowerBarrier !== undefined && lowerBarrier <= 0) {
    console.error("Invalid lower barrier value:", lowerBarrier);
    return 0;
  }
  
  for (let i = 0; i < numSimulations; i++) {
    let currentSpot = spot;
    let barrierHit = false;
    
    // Simulate price path
    for (let j = 0; j < numSteps; j++) {
      // Generate random normal variable
      const z = boxMullerTransform();
      
      // Update spot price using geometric Brownian motion
      currentSpot = currentSpot * Math.exp(drift + diffusion * z);
      
      // Check if barriers have been hit - Logique améliorée et corrigée
      if (isDouble && upperBarrier && lowerBarrier) {
        // Double barrier logic
        if (isReverse) {
          // Reverse double barrier: hit if outside range
          if (currentSpot <= lowerBarrier || currentSpot >= upperBarrier) {
            barrierHit = true;
            break; // Important: arrêter la simulation une fois la barrière touchée
          }
        } else {
          // Standard double barrier: hit if inside range
          if (currentSpot >= lowerBarrier && currentSpot <= upperBarrier) {
            barrierHit = true;
            break;
          }
        }
      } else if (upperBarrier) {
        // Single barrier logic - Corrigé pour correspondre aux conventions financières
        if (isCall) {
          if (isReverse) {
            // Call Down (reverse): KO/KI if spot <= barrier
            if (currentSpot <= upperBarrier) {
              barrierHit = true;
              break;
            }
          } else {
            // Call Up (standard): KO/KI if spot >= barrier
            if (currentSpot >= upperBarrier) {
              barrierHit = true;
              break;
            }
          }
        } else { // isPut
          if (isReverse) {
            // Put Up (reverse): KO/KI if spot >= barrier
            if (currentSpot >= upperBarrier) {
              barrierHit = true;
              break;
            }
          } else {
            // Put Down (standard): KO/KI if spot <= barrier
            if (currentSpot <= upperBarrier) {
              barrierHit = true;
              break;
            }
          }
        }
      }
    }
    
    // Log barrières touchées pour le débogage
    if (barrierHit) {
      pathCount.barrierHit++;
    }
    
    // Calculate payoff based on option type and barrier events
    let payoff = 0;
    
    // Logique KO/KI améliorée
    if (isKO) {
      // Knock-Out: payoff si la barrière n'a pas été touchée
      if (!barrierHit) {
        if (isCall) {
          payoff = Math.max(0, currentSpot - strike);
        } else {
          payoff = Math.max(0, strike - currentSpot);
        }
      }
      // Si barrière touchée, le payoff reste à 0
    } else if (isKI) {
      // Knock-In: payoff si la barrière a été touchée
      if (barrierHit) {
        if (isCall) {
          payoff = Math.max(0, currentSpot - strike);
        } else {
          payoff = Math.max(0, strike - currentSpot);
        }
      }
      // Si barrière non touchée, le payoff reste à 0
    } else {
      // Cas de base (pas une option à barrière)
      if (isCall) {
        payoff = Math.max(0, currentSpot - strike);
      } else if (isPut) {
        payoff = Math.max(0, strike - currentSpot);
      }
    }
    
    if (payoff > 0) {
      pathCount.nonZeroPayoff++;
    }
    
    sumPayoffs += payoff;
  }
  
  // Calcul du prix: moyenne des payoffs actualisée
  const price = Math.exp(-r1 * maturity) * sumPayoffs / numSimulations;
  
  // Log pour débogage
  console.log(`Barrier option pricing: type=${isCall ? 'call' : 'put'}${isKO ? '-KO' : isKI ? '-KI' : ''}, paths with barrier hit: ${pathCount.barrierHit}/${numSimulations}, paths with payoff: ${pathCount.nonZeroPayoff}/${numSimulations}`);
  
  // Ajuster pour la quantité
  return price * (quantity / 100);
};

// Box-Muller transform to generate standard normal random variables
const boxMullerTransform = () => {
  const u1 = Math.random();
  const u2 = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z;
};

// Function to check if a single barrier is active based on option type
const isBarrierSingleActive = (spot: number, barrier: number, isCall: boolean, isReverse: boolean) => {
  // For standard barriers (non-reverse):
  // - Call KO/KI: Barrier is UP (above strike), active when spot >= barrier
  // - Put KO/KI: Barrier is DOWN (below strike), active when spot <= barrier
  //
  // For reverse barriers:
  // - Call RKO/RKI: Barrier is DOWN (below strike), active when spot <= barrier
  // - Put RKO/RKI: Barrier is UP (above strike), active when spot >= barrier
  
  if (isCall && !isReverse) {
    return spot >= barrier ? 1.0 : 0.0; // Call with up barrier
  } else if (isCall && isReverse) {
    return spot <= barrier ? 1.0 : 0.0; // Call with down barrier (reverse)
  } else if (!isCall && !isReverse) {
    return spot <= barrier ? 1.0 : 0.0; // Put with down barrier
  } else { // Put & reverse
    return spot >= barrier ? 1.0 : 0.0; // Put with up barrier (reverse)
  }
};

// Function to check if a double barrier is active
const isBarrierActive = (spot: number, upperBarrier: number, lowerBarrier: number, isReverse: boolean) => {
  // For standard double barriers:
  // - Active when lowerBarrier <= spot <= upperBarrier
  //
  // For reverse double barriers:
  // - Active when spot <= lowerBarrier OR spot >= upperBarrier
  
  if (!isReverse) {
    return (spot >= lowerBarrier && spot <= upperBarrier) ? 1.0 : 0.0;
  } else {
    return (spot <= lowerBarrier || spot >= upperBarrier) ? 1.0 : 0.0;
  }
};

// Simplified calculation of a call option price
const calculateCallPrice = (spot: number, strike: number, maturity: number, r1: number, r2: number, vol: number) => {
  // Simplified Black-Scholes formula for call options
  const d1 = (Math.log(spot / strike) + (r1 - r2 + vol * vol / 2) * maturity) / (vol * Math.sqrt(maturity));
  const d2 = d1 - vol * Math.sqrt(maturity);
  
  // Standard normal approximation of N(d)
  const nd1 = normCDF(d1);
  const nd2 = normCDF(d2);
  
  return spot * Math.exp(-r2 * maturity) * nd1 - strike * Math.exp(-r1 * maturity) * nd2;
};

// Simplified calculation of a put option price
const calculatePutPrice = (spot: number, strike: number, maturity: number, r1: number, r2: number, vol: number) => {
  // Simplified Black-Scholes formula for put options
  const d1 = (Math.log(spot / strike) + (r1 - r2 + vol * vol / 2) * maturity) / (vol * Math.sqrt(maturity));
  const d2 = d1 - vol * Math.sqrt(maturity);
  
  // Standard normal approximation of N(-d)
  const nd1 = normCDF(-d1);
  const nd2 = normCDF(-d2);
  
  return strike * Math.exp(-r1 * maturity) * nd2 - spot * Math.exp(-r2 * maturity) * nd1;
};

// Approximation of the cumulative normal distribution function
const normCDF = (x: number) => {
  // Approximation of N(x)
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  
  return 0.5 * (1.0 + sign * y);
};

// Function to calculate the payoff of a barrier option at a given spot
export const calculateBarrierOptionPayoff = (
  type: string,
  currentSpot: number,
  initialSpot: number,
  strike: number, 
  upperBarrier: number | undefined, 
  lowerBarrier: number | undefined,
  premium: number,
  quantity: number = 100
) => {
  // Extract the option type and barrier type
  const isCall = type.includes("call");
  const isPut = type.includes("put");
  const isKO = type.includes("KO");
  const isKI = type.includes("KI");
  const isReverse = type.includes("R");
  const isDouble = type.includes("D");
  
  // Check if barriers have been hit at the current spot
  let isBarrierEffect = false;
  
  if (isDouble && upperBarrier && lowerBarrier) {
    // Double barrier
    if (isReverse) {
      isBarrierEffect = currentSpot < lowerBarrier || currentSpot > upperBarrier;
    } else {
      isBarrierEffect = currentSpot >= lowerBarrier && currentSpot <= upperBarrier;
    }
  } else if (upperBarrier) {
    // Single barrier
      if (isReverse) {
      if ((isCall && currentSpot <= upperBarrier) || (!isCall && currentSpot >= upperBarrier)) {
        isBarrierEffect = true;
      }
      } else {
      if ((isCall && currentSpot >= upperBarrier) || (!isCall && currentSpot <= upperBarrier)) {
        isBarrierEffect = true;
      }
    }
  }
  
  // Calculate payoff based on option type and barrier state
  let payoff = 0;
  
  if (isKO) {
    // Knock-Out Option
    if (!isBarrierEffect) {
      // Barrier hasn't been touched, option is active
      if (isCall) {
        payoff = Math.max(0, currentSpot - strike);
      } else {
        payoff = Math.max(0, strike - currentSpot);
      }
    } else {
      // Barrier has been touched, option is deactivated
      payoff = 0;
    }
  } else if (isKI) {
    // Knock-In Option
    if (isBarrierEffect) {
      // Barrier has been touched, option is activated
      if (isCall) {
        payoff = Math.max(0, currentSpot - strike);
      } else {
        payoff = Math.max(0, strike - currentSpot);
      }
    } else {
      // Barrier hasn't been touched, option remains inactive
      payoff = 0;
    }
  }
  
  // Adjust for premium and quantity
  return (payoff - premium) * (quantity / 100);
};

// Function to calculate custom strategy payoff
export const calculateCustomStrategyPayoff = (
  options: any[], 
  spotPrice: number, 
  initialSpot: number,
  globalParams: any
) => {
  let totalPayoff = 0;
  
  // Calculate the impact of each option on the hedged rate
  options.forEach(option => {
    const { type, actualStrike, actualUpperBarrier, actualLowerBarrier, quantity } = option;
    const quantityFactor = quantity / 100;
    const isLong = quantityFactor > 0; // Positive quantity = long position (buying), negative = short (selling)
    let optionPayoff = 0;
    const isCall = type.includes("call");
    
    // Traitement des options vanille
    if (type === "call") {
      // Pour un call vanille:
      // - Si spot > strike: le payoff est (spot - strike)
      // - Si spot <= strike: le payoff est 0
      if (spotPrice > actualStrike) {
        optionPayoff = spotPrice - actualStrike;
        // Pour un achat (quantityFactor > 0): payoff reste positif
        // Pour une vente (quantityFactor < 0): payoff devient négatif
        totalPayoff += optionPayoff * quantityFactor;
      }
    } 
    else if (type === "put") {
      // Pour un put vanille:
      // - Si spot < strike: le payoff est (strike - spot)
      // - Si spot >= strike: le payoff est 0
      if (spotPrice < actualStrike) {
        optionPayoff = actualStrike - spotPrice;
        // Pour un achat (quantityFactor > 0): payoff reste positif
        // Pour une vente (quantityFactor < 0): payoff devient négatif
        totalPayoff += optionPayoff * quantityFactor;
      }
    }
    // Traitement des options à barrière
    else if (type.includes("KO") && !type.includes("DKO")) {
      const isReverse = type.includes("Reverse") || type.includes("RKO");
      const barrier = actualUpperBarrier;
      
      // Check if KO was triggered (barrier crossed)
      let isKnockOut = false;
      
      if (isCall && !isReverse) {
        // Call standard KO (up-and-out): KO if spot >= barrier
        isKnockOut = spotPrice >= barrier;
      } else if (isCall && isReverse) {
        // Call reverse KO (down-and-out): KO if spot <= barrier
        isKnockOut = spotPrice <= barrier;
      } else if (!isCall && !isReverse) {
        // Put standard KO (down-and-out): KO if spot <= barrier
        isKnockOut = spotPrice <= barrier;
      } else if (!isCall && isReverse) {
        // Put reverse KO (up-and-out): KO if spot >= barrier
        isKnockOut = spotPrice >= barrier;
      }
      
      // If not KO, calculate payoff normally
      if (!isKnockOut) {
        if (isCall) {
          // Pour un call
          if (spotPrice > actualStrike) {
            optionPayoff = spotPrice - actualStrike;
            totalPayoff += optionPayoff * quantityFactor; // Applique correctement le signe de la quantité
          }
        } else {
          // Pour un put
          if (spotPrice < actualStrike) {
            optionPayoff = actualStrike - spotPrice;
            totalPayoff += optionPayoff * quantityFactor; // Applique correctement le signe de la quantité
          }
        }
      }
    } 
    // Knock-In simple
    else if (type.includes("KI") && !type.includes("DKI")) {
      const isReverse = type.includes("Reverse") || type.includes("RKI");
      const barrier = actualUpperBarrier;
      
      // Check if KI was triggered (barrier crossed)
      let isKnockIn = false;
      
      if (isCall && !isReverse) {
        // Call standard KI (up-and-in): KI if spot >= barrier
        isKnockIn = spotPrice >= barrier;
      } else if (isCall && isReverse) {
        // Call reverse KI (down-and-in): KI if spot <= barrier
        isKnockIn = spotPrice <= barrier;
      } else if (!isCall && !isReverse) {
        // Put standard KI (down-and-in): KI if spot <= barrier
        isKnockIn = spotPrice <= barrier;
      } else if (!isCall && isReverse) {
        // Put reverse KI (up-and-in): KI if spot >= barrier
        isKnockIn = spotPrice >= barrier;
      }
      
      // If KI activated, calculate payoff
      if (isKnockIn) {
        if (isCall) {
          // Pour un call
          if (spotPrice > actualStrike) {
            optionPayoff = spotPrice - actualStrike;
            totalPayoff += optionPayoff * quantityFactor; // Applique correctement le signe de la quantité
          }
        } else {
          // Pour un put
          if (spotPrice < actualStrike) {
            optionPayoff = actualStrike - spotPrice;
            totalPayoff += optionPayoff * quantityFactor; // Applique correctement le signe de la quantité
          }
        }
      }
    } 
    // Double KO
    else if (type.includes("DKO")) {
      const isReverse = type.includes("Reverse");
      const upperB = actualUpperBarrier;
      const lowerB = actualLowerBarrier;
      
      // Check if DKO was triggered
      let isKnockOut = false;
      
      if (!isReverse) {
        // Standard DKO: KO if spot is outside the barriers
        isKnockOut = spotPrice <= lowerB || spotPrice >= upperB;
      } else {
        // Reverse DKO: KO if spot is inside the barriers
        isKnockOut = spotPrice > lowerB && spotPrice < upperB;
      }
      
      // If not KO, calculate payoff normally
      if (!isKnockOut) {
        if (isCall) {
          if (spotPrice > actualStrike) {
            optionPayoff = spotPrice - actualStrike;
            totalPayoff += optionPayoff * quantityFactor; // Applique correctement le signe de la quantité
          }
        } else {
          if (spotPrice < actualStrike) {
            optionPayoff = actualStrike - spotPrice;
            totalPayoff += optionPayoff * quantityFactor; // Applique correctement le signe de la quantité
          }
        }
      }
    }
    // Double KI
    else if (type.includes("DKI")) {
      const isReverse = type.includes("Reverse");
      const upperB = actualUpperBarrier;
      const lowerB = actualLowerBarrier;
      
      // Check if DKI was triggered
      let isKnockIn = false;
      
      if (!isReverse) {
        // Standard DKI: KI if spot is inside the barriers
        isKnockIn = spotPrice >= lowerB && spotPrice <= upperB;
      } else {
        // Reverse DKI: KI if spot is outside the barriers
        isKnockIn = spotPrice < lowerB || spotPrice > upperB;
      }
      
      // If KI activated, calculate payoff normally
      if (isKnockIn) {
        if (isCall) {
          if (spotPrice > actualStrike) {
            optionPayoff = spotPrice - actualStrike;
            totalPayoff += optionPayoff * quantityFactor; // Applique correctement le signe de la quantité
          }
        } else {
          if (spotPrice < actualStrike) {
            optionPayoff = actualStrike - spotPrice;
            totalPayoff += optionPayoff * quantityFactor; // Applique correctement le signe de la quantité
          }
        }
      }
    }
  });
  
  return totalPayoff;
};

// Helper function to calculate barrier option payoff
export const calculateBarrierPayoff = (
  component: any,
  currentSpot: number,
  basePayoff: number,
  initialSpot: number
) => {
  const isKO = component.type.includes('KO');
  const isKI = component.type.includes('KI');
  const isReverse = component.type.includes('RKO') || component.type.includes('RKI');
  const isCall = component.type.includes('call');
  
  // Pour les options vanilla standard (non-barrière)
  if (!isKO && !isKI) {
    // Important: pour les options call/put classiques, calculer directement le payoff
    if (component.type === 'call') {
      const strikeRate = component.strikeType === 'percent' 
        ? initialSpot * (component.strike / 100) 
        : component.strike;
      return Math.max(0, currentSpot - strikeRate);
    } else if (component.type === 'put') {
      const strikeRate = component.strikeType === 'percent' 
        ? initialSpot * (component.strike / 100) 
        : component.strike;
      return Math.max(0, strikeRate - currentSpot);
    }
    return basePayoff; // Fallback
  }
  
  // Déterminer les valeurs des barrières
  const upperBarrier = component.upperBarrierType === 'percent' 
    ? initialSpot * (component.upperBarrier / 100) 
    : component.upperBarrier;
    
  const lowerBarrier = component.lowerBarrierType === 'percent'
    ? initialSpot * (component.lowerBarrier / 100)
    : component.lowerBarrier;
  
  const isDouble = component.type.includes('DKO') || component.type.includes('DKI');
  
  // Check if barrier is hit (for simulation purposes)
  let barrierActive = 0.0;
  
  if (isDouble && upperBarrier !== undefined && lowerBarrier !== undefined) {
    barrierActive = isBarrierActive(currentSpot, upperBarrier, lowerBarrier, isReverse);
  } else if (upperBarrier !== undefined) {
    // For Put Knock-In, the barrier is below the strike
    barrierActive = isBarrierSingleActive(currentSpot, upperBarrier, isCall, isReverse);
  }
  
  // Le payoff final est calculé en fonction de l'activation ou non de la barrière
  let finalPayoff = 0.0;
  
  if (isKO) {
    // For KO options, payoff is 0 if barrier is hit
    finalPayoff = barrierActive > 0.5 ? 0.0 : basePayoff;
  } else if (isKI) {
    // For KI options, payoff is positive only if barrier is hit
    finalPayoff = barrierActive > 0.5 ? basePayoff : 0.0;
  } else {
    // Fallback (should not reach here)
    finalPayoff = basePayoff;
  }
  
  // Retourner le payoff sans appliquer la quantité ici
  // La quantité sera appliquée dans la fonction appelante
  return finalPayoff;
};
