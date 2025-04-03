// Calculations for barrier options

// Models for barrier option pricing
export const BARRIER_PRICING_MODELS = {
  MONTE_CARLO: "monte_carlo"
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
  upperBarrier: number | undefined,
  lowerBarrier: number | undefined,
  maturity: number,
  r1: number,
  r2: number,
  vol: number,
  quantity: number = 1,
  model: string = currentPricingModel
) => {
  // Extract the base option type and barrier type
  const isCall = type.includes("call");
  const isPut = type.includes("put");
  const isKO = type.includes("KO");
  const isKI = type.includes("KI");
  const isReverse = type.includes("R");
  const isDouble = type.includes("D");
  
  // Validate inputs
  if (maturity <= 0 || vol <= 0) {
    return 0; // Cannot calculate with invalid inputs
  }
  
  // Using only Monte Carlo for all barrier options
    return calculateMonteCarloPrice(
      isCall, isPut, isKO, isKI, isReverse, isDouble,
      spot, strike, upperBarrier, lowerBarrier, 
      maturity, r1, r2, vol, quantity
    );
};

// Monte Carlo simulation for barrier options
const calculateMonteCarloPrice = (
  isCall: boolean, isPut: boolean, isKO: boolean, isKI: boolean, 
  isReverse: boolean, isDouble: boolean,
  spot: number, strike: number, upperBarrier: number | undefined, 
  lowerBarrier: number | undefined, maturity: number, r1: number, 
  r2: number, vol: number, quantity: number
) => {
  // Monte Carlo parameters
  const numSimulations = 10000; // Number of price paths to simulate
  const numSteps = 252;         // Number of time steps (trading days in a year)
  const dt = maturity / numSteps;
  const drift = (r1 - r2 - 0.5 * vol * vol) * dt;
  const diffusion = vol * Math.sqrt(dt);
  
  let sumPayoffs = 0;
  
  for (let i = 0; i < numSimulations; i++) {
    let currentSpot = spot;
    let barrierHit = false;
    
    // Simulate price path
    for (let j = 0; j < numSteps; j++) {
      // Generate random normal variable
      const z = boxMullerTransform();
      
      // Update spot price using geometric Brownian motion
      currentSpot = currentSpot * Math.exp(drift + diffusion * z);
      
      // Check if barriers have been hit
      if (isDouble && upperBarrier && lowerBarrier) {
        if (currentSpot >= upperBarrier || currentSpot <= lowerBarrier) {
          barrierHit = true;
        }
      } else if (upperBarrier) {
        if (isReverse) {
          if ((isCall && currentSpot <= upperBarrier) || (!isCall && currentSpot >= upperBarrier)) {
            barrierHit = true;
          }
        } else {
          if ((isCall && currentSpot >= upperBarrier) || (!isCall && currentSpot <= upperBarrier)) {
            barrierHit = true;
          }
        }
      }
    }
    
    // Calculate payoff
    let payoff = 0;
    
    if (isKO) {
      // Knock-Out: payoff if barrier not hit
      if (!barrierHit) {
        if (isCall) {
          payoff = Math.max(0, currentSpot - strike);
        } else {
          payoff = Math.max(0, strike - currentSpot);
        }
      }
    } else if (isKI) {
      // Knock-In: payoff if barrier hit
      if (barrierHit) {
        if (isCall) {
          payoff = Math.max(0, currentSpot - strike);
        } else {
          payoff = Math.max(0, strike - currentSpot);
        }
      }
    }
    
    sumPayoffs += payoff;
  }
  
  // Average payoff discounted to present value
  const price = Math.exp(-r1 * maturity) * sumPayoffs / numSimulations;
  
  // Adjust for quantity
  return price * (quantity / 100);
};

// Box-Muller transform to generate standard normal random variables
const boxMullerTransform = () => {
  const u1 = Math.random();
  const u2 = Math.random();
  
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z;
};

// Helper function to check if a single barrier is active
const isBarrierSingleActive = (spot: number, barrier: number, isCall: boolean, isReverse: boolean) => {
  if (isCall) {
    return isReverse 
      ? spot < barrier ? 1.0 : 0.0  // Reverse: active if spot < barrier
      : spot > barrier ? 1.0 : 0.0;  // Normal: active if spot > barrier
  } else {
    return isReverse 
      ? spot > barrier ? 1.0 : 0.0  // Reverse: active if spot > barrier
      : spot < barrier ? 1.0 : 0.0;  // Normal: active if spot < barrier
  }
};

// Helper function to check if a double barrier is active
const isBarrierActive = (spot: number, upperBarrier: number, lowerBarrier: number, isReverse: boolean) => {
  if (isReverse) {
    // Reverse: active if outside the barriers
    return (spot < lowerBarrier || spot > upperBarrier) ? 1.0 : 0.0;
  } else {
    // Normal: active if between the barriers
    return (spot >= lowerBarrier && spot <= upperBarrier) ? 1.0 : 0.0;
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
    let optionPayoff = 0;
    const isCall = type.includes("call");
    
    // Special handling for vanilla calls
    if (type === "call") {
      // For a forex call, the effect on the rate is:
      // - if spot > strike, we are protected at the strike level
      // - if spot <= strike, the option has no effect
      if (spotPrice > actualStrike) {
        // The protection limits the rate at the strike
        // We calculate the necessary adjustment
        const adjustment = (spotPrice - actualStrike) * quantityFactor;
        totalPayoff -= adjustment; // Subtract the excess above the strike
      }
    } 
    // Other option types remain unchanged
    else if (type === "put") {
      optionPayoff = Math.max(0, actualStrike - spotPrice);
      totalPayoff += optionPayoff * (-1) * quantityFactor;
    }
    // Rest of the code for barrier options
    else if (type.includes("KO") && !type.includes("DKO")) {
      const isReverse = type.includes("Reverse");
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
          // For a call, same logic as for vanilla call
          if (spotPrice > actualStrike) {
            const adjustment = (spotPrice - actualStrike) * quantityFactor;
            totalPayoff -= adjustment;
          }
        } else {
          // For a put, standard behavior
          optionPayoff = Math.max(0, actualStrike - spotPrice);
          totalPayoff += optionPayoff * (-1) * quantityFactor;
        }
      }
    } 
    // Knock-In simple
    else if (type.includes("KI") && !type.includes("DKI")) {
      const isReverse = type.includes("Reverse");
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
          // For a call, same logic as for vanilla call
          if (spotPrice > actualStrike) {
            const adjustment = (spotPrice - actualStrike) * quantityFactor;
            totalPayoff -= adjustment;
          }
        } else {
          // For a put, standard behavior
          optionPayoff = Math.max(0, actualStrike - spotPrice);
          totalPayoff += optionPayoff * (-1) * quantityFactor;
        }
      }
    } 
    // Double KO
    else if (type.includes("DKO")) {
      const upperBarrier = actualUpperBarrier;
      const lowerBarrier = actualLowerBarrier;
      
      // KO if spot is outside the barriers
      const isKnockOut = spotPrice >= upperBarrier || spotPrice <= lowerBarrier;
      
      if (!isKnockOut) {
        if (isCall) {
          // For a call, same logic as for vanilla call
          if (spotPrice > actualStrike) {
            const adjustment = (spotPrice - actualStrike) * quantityFactor;
            totalPayoff -= adjustment;
          }
        } else {
          // For a put, standard behavior
          optionPayoff = Math.max(0, actualStrike - spotPrice);
          totalPayoff += optionPayoff * (-1) * quantityFactor;
        }
      }
    } 
    // Double KI
    else if (type.includes("DKI")) {
      const upperBarrier = actualUpperBarrier;
      const lowerBarrier = actualLowerBarrier;
      
      // KI if spot is outside the barriers
      const isKnockIn = spotPrice >= upperBarrier || spotPrice <= lowerBarrier;
      
      if (isKnockIn) {
        if (isCall) {
          // For a call, same logic as for vanilla call
          if (spotPrice > actualStrike) {
            const adjustment = (spotPrice - actualStrike) * quantityFactor;
            totalPayoff -= adjustment;
          }
        } else {
          // For a put, standard behavior
          optionPayoff = Math.max(0, actualStrike - spotPrice);
          totalPayoff += optionPayoff * (-1) * quantityFactor;
        }
      }
    }
  });
  
  return totalPayoff;
};
