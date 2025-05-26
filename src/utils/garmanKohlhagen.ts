/**
 * Calcule le prix d'une option sur devise selon le modèle de Garman-Kohlhagen
 * 
 * @param callPutFlag - 'c' pour call, 'p' pour put
 * @param S - Taux de change spot (prix actuel)
 * @param X - Strike (prix d'exercice)
 * @param T - Temps jusqu'à l'échéance en années
 * @param r - Taux d'intérêt domestique (décimal)
 * @param rf - Taux d'intérêt étranger (décimal)
 * @param v - Volatilité (décimal)
 * @returns Prix de l'option
 */

// Importer la fonction de pricing Monte Carlo de barrierOptionCalculations.ts
import { calculateMonteCarloPrice } from './barrierOptionCalculations';

// Modèles de pricing disponibles pour les options vanille
export const VANILLA_PRICING_MODELS = {
  CLOSED_FORM: "closed_form", // Garman-Kohlhagen
  MONTE_CARLO: "monte_carlo"
};

// Modèle par défaut
let currentVanillaPricingModel = VANILLA_PRICING_MODELS.CLOSED_FORM;

// Fonction pour définir le modèle de pricing
export function setVanillaPricingModel(model: string): boolean {
  if (Object.values(VANILLA_PRICING_MODELS).includes(model as any)) {
    const previousModel = currentVanillaPricingModel;
    currentVanillaPricingModel = model;
    console.log(`[PRICING MODEL] Vanilla pricing model changed from '${previousModel}' to '${model}'`);
    return true;
  }
  console.error(`[PRICING MODEL] Invalid pricing model: '${model}'. Available models:`, Object.values(VANILLA_PRICING_MODELS));
  return false;
}

// Fonction pour obtenir le modèle de pricing actuel
export function getVanillaPricingModel(): string {
  return currentVanillaPricingModel;
}

/**
 * Calcul de d1 pour le modèle Garman-Kohlhagen
 */
export function d1(S: number, X: number, T: number, r: number, rf: number, v: number): number {
  return (Math.log(S / X) + (r - rf + v * v / 2) * T) / (v * Math.sqrt(T));
}

/**
 * Calcul de d2 pour le modèle Garman-Kohlhagen
 */
export function d2(S: number, X: number, T: number, r: number, rf: number, v: number): number {
  return d1(S, X, T, r, rf, v) - v * Math.sqrt(T);
}

/**
 * Calcul du prix d'une option selon le modèle Garman-Kohlhagen
 * @param callPutFlag - Type d'option ('c' pour call, 'p' pour put)
 * @param S - Prix spot de l'actif sous-jacent
 * @param X - Prix d'exercice (strike)
 * @param T - Temps jusqu'à l'échéance (en années)
 * @param r - Taux d'intérêt domestique (sans risque)
 * @param rf - Taux d'intérêt étranger (sans risque)
 * @param v - Volatilité implicite
 * @returns Prix de l'option
 */
export function garmanKohlhagen(
  callPutFlag: string,
  S: number,
  X: number,
  T: number,
  r: number,
  rf: number,
  v: number
): number {
  // Validation des paramètres d'entrée
  const minValue = 1e-10;
  S = Math.max(S, minValue);
  X = Math.max(X, minValue);
  T = Math.max(T, minValue);
  v = Math.max(v, minValue);
  
  // Calcul des termes du modèle Garman-Kohlhagen en utilisant les fonctions exportées
  const d1_val = d1(S, X, T, r, rf, v);
  const d2_val = d2(S, X, T, r, rf, v);
  
  // Calcul du prix selon le type d'option
  if (callPutFlag.toLowerCase() === "c" || callPutFlag.toLowerCase().includes("call")) {
    return S * Math.exp(-rf * T) * cnd(d1_val) - X * Math.exp(-r * T) * cnd(d2_val);
  } else if (callPutFlag.toLowerCase() === "p" || callPutFlag.toLowerCase().includes("put")) {
    return X * Math.exp(-r * T) * cnd(-d2_val) - S * Math.exp(-rf * T) * cnd(-d1_val);
  }
  
  // Type d'option non reconnu
  console.error('Unknown option type:', callPutFlag);
  return 0;
}

/**
 * Calcul du prix d'une option par simulation Monte Carlo en utilisant la fonction 
 * existante dans barrierOptionCalculations.ts
 * 
 * Cette fonction sert uniquement de wrapper pour maintenir la compatibilité.
 */
export function monteCarloPricing(
  callPutFlag: string,
  S: number,
  X: number,
  T: number,
  r: number,
  rf: number,
  v: number,
  numSimulations: number = 10000
): number {
  console.log(`[MONTE CARLO] Starting vanilla option pricing with ${numSimulations} simulations. CallPutFlag: ${callPutFlag}, S=${S}, X=${X}, T=${T}, r=${r}, rf=${rf}, v=${v}`);
  
  // Convertir le type d'option en format booléen comme attendu par calculateMonteCarloPrice
  const isCall = callPutFlag.toLowerCase() === "c" || callPutFlag.toLowerCase().includes("call");
  const isPut = !isCall;
  
  // Appeler la fonction Monte Carlo existante
  // Les paramètres de barrière sont mis à undefined car il s'agit d'options vanille
  const result = calculateMonteCarloPrice(
    isCall, 
    isPut, 
    false, // isKO = false
    false, // isKI = false
    false, // isReverse = false
    false, // isDouble = false
    S, 
    X, 
    undefined, // upperBarrier
    undefined, // lowerBarrier
    T, 
    r,
    rf, 
    v,
    100 // quantity = 100% (standard)
  );
  
  console.log(`[MONTE CARLO] Option price calculated: ${result}`);
  return result;
}

/**
 * Fonction de répartition de la loi normale centrée réduite (CND)
 * Approximation précise de N(x)
 */
export function cnd(x: number): number {
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
}

/**
 * Version simplifiée pour calculer le prix d'un call
 * Utilise soit Garman-Kohlhagen soit Monte Carlo selon le modèle sélectionné
 */
export function calculateCall(S: number, X: number, T: number, r: number, rf: number, v: number): number {
  if (currentVanillaPricingModel === VANILLA_PRICING_MODELS.MONTE_CARLO) {
    console.log(`[PRICING MODEL] Using Monte Carlo for call option pricing. S=${S}, X=${X}, T=${T}`);
    return monteCarloPricing('c', S, X, T, r, rf, v);
  } else {
    console.log(`[PRICING MODEL] Using Garman-Kohlhagen for call option pricing. S=${S}, X=${X}, T=${T}`);
    return garmanKohlhagen('c', S, X, T, r, rf, v);
  }
}

/**
 * Version simplifiée pour calculer le prix d'un put
 * Utilise soit Garman-Kohlhagen soit Monte Carlo selon le modèle sélectionné
 */
export function calculatePut(S: number, X: number, T: number, r: number, rf: number, v: number): number {
  if (currentVanillaPricingModel === VANILLA_PRICING_MODELS.MONTE_CARLO) {
    console.log(`[PRICING MODEL] Using Monte Carlo for put option pricing. S=${S}, X=${X}, T=${T}`);
    return monteCarloPricing('p', S, X, T, r, rf, v);
  } else {
    console.log(`[PRICING MODEL] Using Garman-Kohlhagen for put option pricing. S=${S}, X=${X}, T=${T}`);
    return garmanKohlhagen('p', S, X, T, r, rf, v);
  }
}

/**
 * Calcul du taux forward selon la parité des taux d'intérêt
 */
export function calculateForward(S: number, T: number, r: number, rf: number): number {
  return S * Math.exp((r - rf) * T);
} 