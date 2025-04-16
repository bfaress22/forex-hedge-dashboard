// --- GARMAN-KOHLHAGEN Pricing for FX Options ---
/**
 * Calculates the price of a vanilla FX option using the Garman-Kohlhagen model.
 * This is an implementation of the Black-Scholes model adapted for FX options.
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
  // Validation des données d'entrée
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
    console.error('Invalid inputs for option pricing:', { S, K, T, sigma });
    return 0;
  }

  // Prévenir les problèmes numériques avec des valeurs trop petites
  const minValue = 1e-10;
  if (T < minValue) T = minValue;
  if (sigma < minValue) sigma = minValue;
  
  // Calcul des termes du modèle BS-Garman-Kohlhagen
  const d1 = (Math.log(S / K) + (r_d - r_f + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  // Calcul de N(d1) et N(d2)
  const Nd1 = cumulativeNormalDistribution(d1);
  const Nd2 = cumulativeNormalDistribution(d2);
  const Nmind1 = cumulativeNormalDistribution(-d1);
  const Nmind2 = cumulativeNormalDistribution(-d2);
  
  // Prix selon le type d'option
  let price = 0;
  if (type.includes('call')) {
    price = S * Math.exp(-r_f * T) * Nd1 - K * Math.exp(-r_d * T) * Nd2;
  } else if (type.includes('put')) {
    price = K * Math.exp(-r_d * T) * Nmind2 - S * Math.exp(-r_f * T) * Nmind1;
  }
  
  // Journalisation détaillée pour débogage
  console.debug(`Option ${type} pricing: S=${S.toFixed(4)}, K=${K.toFixed(4)}, T=${T.toFixed(4)}, σ=${sigma.toFixed(4)}, r_d=${r_d.toFixed(4)}, r_f=${r_f.toFixed(4)}`);
  console.debug(`d1=${d1.toFixed(6)}, d2=${d2.toFixed(6)}, N(d1)=${Nd1.toFixed(6)}, N(d2)=${Nd2.toFixed(6)}, price=${price.toFixed(6)}`);
  
  return Math.max(0, price);
};

/**
 * Approximation de la fonction de répartition de la loi normale centrée réduite.
 * Cette fonction permet de calculer N(x) plus rapidement que l'approche standard.
 */
function cumulativeNormalDistribution(x: number): number {
  // Constantes pour l'approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  // On prend la valeur absolue de x
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  
  // Forme du terme
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  
  // Résultat final
  return 0.5 * (1.0 + sign * y);
} 