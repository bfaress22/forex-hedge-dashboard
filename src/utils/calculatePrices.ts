// --- GARMAN-KOHLHAGEN Pricing for FX Options ---
import { garmanKohlhagen, cnd, calculateCall, calculatePut } from './garmanKohlhagen';

/**
 * Calculates the price of a vanilla FX option using the selected pricing model.
 * This function respects the global vanilla pricing model setting (Garman-Kohlhagen or Monte Carlo).
 * 
 * @param type 'call' or 'put'
 * @param S Spot FX rate
 * @param K Strike price
 * @param r_d Domestic interest rate (as decimal, e.g., 0.05 for 5%)
 * @param r_f Foreign interest rate (as decimal)
 * @param T Time to maturity in years
 * @param sigma Volatility (as decimal)
 * @returns Option price
 */
export const calculateOptionPrice_GarmanKohlhagen = (
  type: string,
  S: number,
  K: number,
  r_d: number,
  r_f: number,
  T: number,
  sigma: number
): number => {
  // Utiliser les fonctions qui respectent le modèle de pricing sélectionné
  if (type.toLowerCase() === "c" || type.toLowerCase().includes("call")) {
    return calculateCall(S, K, T, r_d, r_f, sigma);
  } else if (type.toLowerCase() === "p" || type.toLowerCase().includes("put")) {
    return calculatePut(S, K, T, r_d, r_f, sigma);
  } else {
    console.error('Unknown option type:', type);
    return 0;
  }
};
  
// La fonction cumulativeNormalDistribution n'est plus nécessaire car nous utilisons cnd de garmanKohlhagen.ts
// Nous la gardons pour maintenir la compatibilité avec le code existant
function cumulativeNormalDistribution(x: number): number {
  return cnd(x);
} 