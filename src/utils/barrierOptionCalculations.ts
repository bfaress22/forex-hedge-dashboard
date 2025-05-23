// Calculations for barrier options
import { cnd } from './garmanKohlhagen';

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

/**
 * Calcule le prix d'une option à barrière simple selon le modèle analytique
 * Implémentation de la formule "Standard Barrier" de Haug (1997)
 * 
 * @param typeFlag Type d'option: "cdi", "cui", "pdi", "pui", "cdo", "cuo", "pdo", "puo"
 *                 c/p = call/put, d/u = down/up, i/o = in/out
 * @param S Spot price (prix actuel)
 * @param X Strike price (prix d'exercice)
 * @param H Barrier price (niveau de barrière)
 * @param T Time to maturity (temps jusqu'à échéance en années)
 * @param r Domestic interest rate (taux d'intérêt domestique)
 * @param b Cost of carry (b = r - rf pour les options sur devise)
 * @param v Volatility (volatilité)
 * @param K Rebate (remboursement si la barrière est touchée pour les KO, ou non touchée pour les KI)
 * @returns Prix de l'option à barrière
 */
export function standardBarrier(
  typeFlag: string,
  S: number,
  X: number,
  H: number,
  T: number,
  r: number,
  rf: number,
  v: number,
  K: number = 0
): number {
  // Validation des entrées
  if (S <= 0 || X <= 0 || H <= 0 || T <= 0 || v <= 0) {
    console.error('Invalid inputs for barrier option pricing:', { S, X, H, T, v });
    return 0;
  }

  // b est le cost of carry (b = r - rf pour les options sur devise)
  const b = r - rf;

  // Prévenir les problèmes numériques avec des valeurs trop petites
  const minValue = 1e-10;
  T = Math.max(T, minValue);
  v = Math.max(v, minValue);

  // Calcul des termes du modèle
  const mu = (b - v * v / 2) / (v * v);
  const lambda = Math.sqrt(mu * mu + 2 * r / (v * v));
  const X1 = Math.log(S / X) / (v * Math.sqrt(T)) + (1 + mu) * v * Math.sqrt(T);
  const X2 = Math.log(S / H) / (v * Math.sqrt(T)) + (1 + mu) * v * Math.sqrt(T);
  const y1 = Math.log(H * H / (S * X)) / (v * Math.sqrt(T)) + (1 + mu) * v * Math.sqrt(T);
  const y2 = Math.log(H / S) / (v * Math.sqrt(T)) + (1 + mu) * v * Math.sqrt(T);
  const Z = Math.log(H / S) / (v * Math.sqrt(T)) + lambda * v * Math.sqrt(T);

  // Déterminer les paramètres eta et phi en fonction du type d'option
  let eta = 0;
  let phi = 0;

  if (typeFlag === "cdi" || typeFlag === "cdo") {
    eta = 1;
    phi = 1;
  } else if (typeFlag === "cui" || typeFlag === "cuo") {
    eta = -1;
    phi = 1;
  } else if (typeFlag === "pdi" || typeFlag === "pdo") {
    eta = 1;
    phi = -1;
  } else if (typeFlag === "pui" || typeFlag === "puo") {
    eta = -1;
    phi = -1;
  } else {
    console.error('Unknown barrier option type:', typeFlag);
    return 0;
  }

  // Calcul des termes de la formule
  const f1 = phi * S * Math.exp((b - r) * T) * cnd(phi * X1) - phi * X * Math.exp(-r * T) * cnd(phi * X1 - phi * v * Math.sqrt(T));
  const f2 = phi * S * Math.exp((b - r) * T) * cnd(phi * X2) - phi * X * Math.exp(-r * T) * cnd(phi * X2 - phi * v * Math.sqrt(T));
  const f3 = phi * S * Math.exp((b - r) * T) * Math.pow(H / S, 2 * (mu + 1)) * cnd(eta * y1) - phi * X * Math.exp(-r * T) * Math.pow(H / S, 2 * mu) * cnd(eta * y1 - eta * v * Math.sqrt(T));
  const f4 = phi * S * Math.exp((b - r) * T) * Math.pow(H / S, 2 * (mu + 1)) * cnd(eta * y2) - phi * X * Math.exp(-r * T) * Math.pow(H / S, 2 * mu) * cnd(eta * y2 - eta * v * Math.sqrt(T));
  const f5 = K * Math.exp(-r * T) * (cnd(eta * X2 - eta * v * Math.sqrt(T)) - Math.pow(H / S, 2 * mu) * cnd(eta * y2 - eta * v * Math.sqrt(T)));
  const f6 = K * (Math.pow(H / S, mu + lambda) * cnd(eta * Z) + Math.pow(H / S, mu - lambda) * cnd(eta * Z - 2 * eta * lambda * v * Math.sqrt(T)));

  // Calcul du prix en fonction du type d'option et des relations entre strike et barrière
  let price = 0;

  if (X > H) {
    switch (typeFlag) {
      case "cdi": price = f3 + f5; break;
      case "cui": price = f1 + f5; break;
      case "pdi": price = f2 - f3 + f4 + f5; break;
      case "pui": price = f1 - f2 + f4 + f5; break;
      case "cdo": price = f1 - f3 + f6; break;
      case "cuo": price = f6; break;
      case "pdo": price = f1 - f2 + f3 - f4 + f6; break;
      case "puo": price = f2 - f4 + f6; break;
    }
  } else { // X <= H
    switch (typeFlag) {
      case "cdi": price = f1 - f2 + f4 + f5; break;
      case "cui": price = f2 - f3 + f4 + f5; break;
      case "pdi": price = f1 + f5; break;
      case "pui": price = f3 + f5; break;
      case "cdo": price = f2 + f6 - f4; break;
      case "cuo": price = f1 - f2 + f3 - f4 + f6; break;
      case "pdo": price = f6; break;
      case "puo": price = f1 - f3 + f6; break;
    }
  }

  return Math.max(0, price);
}

/**
 * Calcule le prix d'une option à double barrière
 * Implémentation de la formule de double barrière de Haug (1997)
 * 
 * @param typeFlag Type d'option: "co", "ci", "po", "pi" (c/p = call/put, i/o = in/out)
 * @param S Spot price (prix actuel)
 * @param X Strike price (prix d'exercice)
 * @param L Lower barrier (barrière inférieure)
 * @param U Upper barrier (barrière supérieure)
 * @param T Time to maturity (temps jusqu'à échéance en années)
 * @param r Domestic interest rate (taux d'intérêt domestique)
 * @param rf Foreign interest rate (taux d'intérêt étranger)
 * @param v Volatility (volatilité)
 * @param delta1 Dividend rate for upper barrier (généralement 0 pour les options FX)
 * @param delta2 Dividend rate for lower barrier (généralement 0 pour les options FX)
 * @returns Prix de l'option à double barrière
 */
export function doubleBarrier(
  typeFlag: string,
  S: number,
  X: number,
  L: number,
  U: number,
  T: number,
  r: number,
  rf: number,
  v: number,
  delta1: number = 0,
  delta2: number = 0
): number {
  // Validation des entrées
  if (S <= 0 || X <= 0 || L <= 0 || U <= 0 || L >= U || T <= 0 || v <= 0) {
    console.error('Invalid inputs for double barrier option pricing:', { S, X, L, U, T, v });
    return 0;
  }
  
  // b est le cost of carry (b = r - rf pour les options sur devise)
  const b = r - rf;

  // Prévenir les problèmes numériques avec des valeurs trop petites
  const minValue = 1e-10;
  T = Math.max(T, minValue);
  v = Math.max(v, minValue);

  const F = U * Math.exp(delta1 * T);
  const E = L * Math.exp(delta1 * T);
  
  // Nombre de termes à calculer dans la somme (n de -5 à 5 dans le code VBA)
  const numTerms = 5;
  
  let sum1 = 0;
  let sum2 = 0;
  
  if (typeFlag === "co" || typeFlag === "ci") {
    for (let n = -numTerms; n <= numTerms; n++) {
      const d1 = (Math.log(S * Math.pow(U, 2 * n) / (X * Math.pow(L, 2 * n))) + (b + v * v / 2) * T) / (v * Math.sqrt(T));
      const d2 = (Math.log(S * Math.pow(U, 2 * n) / (F * Math.pow(L, 2 * n))) + (b + v * v / 2) * T) / (v * Math.sqrt(T));
      const d3 = (Math.log(Math.pow(L, 2 * n + 2) / (X * S * Math.pow(U, 2 * n))) + (b + v * v / 2) * T) / (v * Math.sqrt(T));
      const d4 = (Math.log(Math.pow(L, 2 * n + 2) / (F * S * Math.pow(U, 2 * n))) + (b + v * v / 2) * T) / (v * Math.sqrt(T));
      
      const mu1 = 2 * (b - delta2 - n * (delta1 - delta2)) / (v * v) + 1;
      const mu2 = 2 * n * (delta1 - delta2) / (v * v);
      const mu3 = 2 * (b - delta2 + n * (delta1 - delta2)) / (v * v) + 1;
      
      sum1 += Math.pow(U / L, n * mu1) * Math.pow(L / S, mu2) * (cnd(d1) - cnd(d2)) - 
              Math.pow(L / (U * S), n * mu3) * (cnd(d3) - cnd(d4));
              
      sum2 += Math.pow(U / L, n * (mu1 - 2)) * Math.pow(L / S, mu2) * (cnd(d1 - v * Math.sqrt(T)) - cnd(d2 - v * Math.sqrt(T))) - 
              Math.pow(L / (U * S), n * (mu3 - 2)) * (cnd(d3 - v * Math.sqrt(T)) - cnd(d4 - v * Math.sqrt(T)));
    }
  } else if (typeFlag === "po" || typeFlag === "pi") {
    for (let n = -numTerms; n <= numTerms; n++) {
      const d1 = (Math.log(S * Math.pow(U, 2 * n) / (E * Math.pow(L, 2 * n))) + (b + v * v / 2) * T) / (v * Math.sqrt(T));
      const d2 = (Math.log(S * Math.pow(U, 2 * n) / (X * Math.pow(L, 2 * n))) + (b + v * v / 2) * T) / (v * Math.sqrt(T));
      const d3 = (Math.log(Math.pow(L, 2 * n + 2) / (E * S * Math.pow(U, 2 * n))) + (b + v * v / 2) * T) / (v * Math.sqrt(T));
      const d4 = (Math.log(Math.pow(L, 2 * n + 2) / (X * S * Math.pow(U, 2 * n))) + (b + v * v / 2) * T) / (v * Math.sqrt(T));
      
      const mu1 = 2 * (b - delta2 - n * (delta1 - delta2)) / (v * v) + 1;
      const mu2 = 2 * n * (delta1 - delta2) / (v * v);
      const mu3 = 2 * (b - delta2 + n * (delta1 - delta2)) / (v * v) + 1;
      
      sum1 += Math.pow(U / L, n * mu1) * Math.pow(L / S, mu2) * (cnd(d1) - cnd(d2)) - 
              Math.pow(L / (U * S), n * mu3) * (cnd(d3) - cnd(d4));
              
      sum2 += Math.pow(U / L, n * (mu1 - 2)) * Math.pow(L / S, mu2) * (cnd(d1 - v * Math.sqrt(T)) - cnd(d2 - v * Math.sqrt(T))) - 
              Math.pow(L / (U * S), n * (mu3 - 2)) * (cnd(d3 - v * Math.sqrt(T)) - cnd(d4 - v * Math.sqrt(T)));
    }
  } else {
    console.error('Unknown double barrier option type:', typeFlag);
    return 0;
  }
  
  const outValue = typeFlag === "co" || typeFlag === "po" ? 
    S * Math.exp((b - r) * T) * sum1 - X * Math.exp(-r * T) * sum2 :
    X * Math.exp(-r * T) * sum2 - S * Math.exp((b - r) * T) * sum1;
  
  // Pour les options "in", on soustrait le prix "out" de l'option vanille
  if (typeFlag === "co" || typeFlag === "po") {
    return Math.max(0, outValue);
  } else if (typeFlag === "ci") {
    // Prix d'un call vanille - prix d'un call "out"
    const vanillaCall = S * Math.exp(-rf * T) * cnd(d1(S, X, T, r, rf, v)) - 
                        X * Math.exp(-r * T) * cnd(d2(S, X, T, r, rf, v));
    return Math.max(0, vanillaCall - outValue);
  } else if (typeFlag === "pi") {
    // Prix d'un put vanille - prix d'un put "out"
    const vanillaPut = X * Math.exp(-r * T) * cnd(-d2(S, X, T, r, rf, v)) - 
                       S * Math.exp(-rf * T) * cnd(-d1(S, X, T, r, rf, v));
    return Math.max(0, vanillaPut - outValue);
  }
  
  return 0;
}

// Fonctions auxiliaires pour le calcul des d1 et d2 (formule Black-Scholes standard)
function d1(S: number, X: number, T: number, r: number, rf: number, v: number): number {
  return (Math.log(S / X) + (r - rf + v * v / 2) * T) / (v * Math.sqrt(T));
}

function d2(S: number, X: number, T: number, r: number, rf: number, v: number): number {
  return d1(S, X, T, r, rf, v) - v * Math.sqrt(T);
}

// Intègre les nouvelles fonctions dans l'API existante
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
  const isDouble = upperBarrier !== undefined && lowerBarrier !== undefined;
  
  // Vanilla options calculated using closed-form solution
  if (!isKO && !isKI) {
    if (isCall) {
      return callPrice(spot, strike, t, domesticRate, foreignRate, volatility) * (quantity / 100);
    } else if (isPut) {
      return putPrice(spot, strike, t, domesticRate, foreignRate, volatility) * (quantity / 100);
    }
  }
  
  // Use advanced pricing models when available and applicable
  if (currentPricingModel === BARRIER_PRICING_MODELS.CLOSED_FORM) {
    // Handle single barrier options
    if (!isDouble && upperBarrier) {
      const typeFlag = getBarrierTypeFlag(isCall, isPut, isKO, isKI, upperBarrier > spot);
      return standardBarrier(
        typeFlag,
        spot,
        strike,
        upperBarrier,
        t,
        domesticRate,
        foreignRate,
        volatility
      ) * (quantity / 100);
    }
    // Handle double barrier options
    else if (isDouble && upperBarrier && lowerBarrier) {
      const typeFlag = getDoubleBarrierTypeFlag(isCall, isPut, isKO, isKI);
      return doubleBarrier(
        typeFlag,
        spot,
        strike,
        lowerBarrier,
        upperBarrier,
        t,
        domesticRate,
        foreignRate,
        volatility
      ) * (quantity / 100);
    }
  }
  
  // Fallback to Monte Carlo for complex cases
    return calculateMonteCarloPrice(
    isCall, isPut, isKO, isKI, false, isDouble,
    spot, strike, upperBarrier, lowerBarrier, t,
    domesticRate, foreignRate, volatility, quantity
  );
};

// Converts option parameters to the typeFlag used in the analytical formulas
function getBarrierTypeFlag(
  isCall: boolean,
  isPut: boolean,
  isKO: boolean,
  isKI: boolean,
  isUpperBarrier: boolean
): string {
  if (isCall) {
    if (isKI) {
      return isUpperBarrier ? "cui" : "cdi";
    } else { // isKO
      return isUpperBarrier ? "cuo" : "cdo";
    }
  } else { // isPut
    if (isKI) {
      return isUpperBarrier ? "pui" : "pdi";
    } else { // isKO
      return isUpperBarrier ? "puo" : "pdo";
    }
  }
}

// Converts option parameters to the typeFlag used in double barrier formulas
function getDoubleBarrierTypeFlag(
  isCall: boolean,
  isPut: boolean,
  isKO: boolean,
  isKI: boolean
): string {
  if (isCall) {
    return isKO ? "co" : "ci";
  } else { // isPut
    return isKO ? "po" : "pi";
  }
}

// Simplified Black-Scholes for calls
function callPrice(spot: number, strike: number, maturity: number, r1: number, r2: number, vol: number): number {
  const d1Value = d1(spot, strike, maturity, r1, r2, vol);
  const d2Value = d2(spot, strike, maturity, r1, r2, vol);
  return spot * Math.exp(-r2 * maturity) * cnd(d1Value) - strike * Math.exp(-r1 * maturity) * cnd(d2Value);
}

// Simplified Black-Scholes for puts
function putPrice(spot: number, strike: number, maturity: number, r1: number, r2: number, vol: number): number {
  const d1Value = d1(spot, strike, maturity, r1, r2, vol);
  const d2Value = d2(spot, strike, maturity, r1, r2, vol);
  return strike * Math.exp(-r1 * maturity) * cnd(-d2Value) - spot * Math.exp(-r2 * maturity) * cnd(-d1Value);
}

// Closed-form analytical solution for barrier options (single barrier only)
const calculateClosedFormBarrierOptionPrice = (
  isCall: boolean, isPut: boolean, isKO: boolean, isKI: boolean, 
  isReverse: boolean, spot: number, strike: number, barrier: number, 
  maturity: number, r1: number, r2: number, vol: number, quantity: number
) => {
  // Utiliser la nouvelle implémentation standardBarrier pour les calculs
  let typeFlag = "";
  
  if (isCall) {
    if (isKI) {
      typeFlag = isReverse ? "cdi" : "cui"; // down/up and in
    } else { // isKO
      typeFlag = isReverse ? "cdo" : "cuo"; // down/up and out
    }
  } else { // isPut
    if (isKI) {
      typeFlag = isReverse ? "pui" : "pdi"; // up/down and in
    } else { // isKO
      typeFlag = isReverse ? "puo" : "pdo"; // up/down and out
    }
  }
  
  return standardBarrier(
    typeFlag,
    spot,
    strike,
    barrier,
    maturity,
    r1,
    r2,
    vol,
    0 // Pas de rebate (K=0)
  ) * (quantity / 100);
};

// Monte Carlo simulation for barrier options
// Export this function to be used from garmanKohlhagen.ts for vanilla options
export const calculateMonteCarloPrice = (
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
