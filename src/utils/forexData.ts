// Forex pair data with trading information
export const FOREX_PAIRS = {
    // Majors
    "EUR/USD": { name: "Euro/US Dollar", spot: 1.08, vol: 0.10, defaultStrike: 1.14 },
    "GBP/USD": { name: "British Pound/US Dollar", spot: 1.26, vol: 0.11, defaultStrike: 1.32 },
    "USD/JPY": { name: "US Dollar/Japanese Yen", spot: 148.5, vol: 0.12, defaultStrike: 155.0 },
    "USD/CHF": { name: "US Dollar/Swiss Franc", spot: 0.89, vol: 0.11, defaultStrike: 0.94 },
    "AUD/USD": { name: "Australian Dollar/US Dollar", spot: 0.65, vol: 0.13, defaultStrike: 0.69 },
    "USD/CAD": { name: "US Dollar/Canadian Dollar", spot: 1.35, vol: 0.09, defaultStrike: 1.40 },
    "NZD/USD": { name: "New Zealand Dollar/US Dollar", spot: 0.61, vol: 0.14, defaultStrike: 0.64 },

    // Cross rates
    "EUR/GBP": { name: "Euro/British Pound", spot: 0.86, vol: 0.10, defaultStrike: 0.89 },
    "EUR/JPY": { name: "Euro/Japanese Yen", spot: 160.5, vol: 0.13, defaultStrike: 167.0 },
    "GBP/JPY": { name: "British Pound/Japanese Yen", spot: 187.2, vol: 0.14, defaultStrike: 195.0 },
    "EUR/CHF": { name: "Euro/Swiss Franc", spot: 0.96, vol: 0.08, defaultStrike: 1.00 },
    "EUR/AUD": { name: "Euro/Australian Dollar", spot: 1.66, vol: 0.12, defaultStrike: 1.72 },
    "GBP/CHF": { name: "British Pound/Swiss Franc", spot: 1.12, vol: 0.11, defaultStrike: 1.17 },

    // Other currencies
    "USD/TRY": { name: "Turkish Lira", spot: 31.20, vol: 0.25, defaultStrike: 33.50 },
    "USD/SGD": { name: "Singapore Dollar", spot: 1.34, vol: 0.07, defaultStrike: 1.38 },
    "USD/THB": { name: "Thai Baht", spot: 35.50, vol: 0.08, defaultStrike: 36.80 },
    "USD/IDR": { name: "Indonesian Rupiah", spot: 15650, vol: 0.09, defaultStrike: 16000 },
    "USD/KRW": { name: "Korean Won", spot: 1320, vol: 0.09, defaultStrike: 1350 },
    "USD/PLN": { name: "Polish Zloty", spot: 4.02, vol: 0.12, defaultStrike: 4.15 },
    "USD/KWD": { name: "Kuwaiti Dinar", spot: 0.31, vol: 0.04, defaultStrike: 0.32 },
    "USD/PHP": { name: "Philippine Peso", spot: 55.80, vol: 0.08, defaultStrike: 57.00 },
    "USD/MYR": { name: "Malaysian Ringgit", spot: 4.72, vol: 0.07, defaultStrike: 4.85 },
    "USD/INR": { name: "Indian Rupee", spot: 83.20, vol: 0.07, defaultStrike: 84.50 },
    "USD/TWD": { name: "Taiwan Dollar", spot: 31.20, vol: 0.06, defaultStrike: 31.80 },
    "USD/SAR": { name: "Saudi Riyal", spot: 3.75, vol: 0.02, defaultStrike: 3.76 },
    "USD/AED": { name: "UAE Dirham", spot: 3.67, vol: 0.02, defaultStrike: 3.68 },
    "USD/MAD": { name: "Moroccan Dirham", spot: 10.05, vol: 0.06, defaultStrike: 10.35 },
    "USD/RUB": { name: "Russian Ruble", spot: 92.50, vol: 0.20, defaultStrike: 95.00 },
    "USD/ILS": { name: "Israeli Shekel", spot: 3.68, vol: 0.09, defaultStrike: 3.80 },
    "USD/MXN": { name: "Mexican Peso", spot: 17.05, vol: 0.15, defaultStrike: 17.80 },
    "USD/BRL": { name: "Brazilian Real", spot: 4.95, vol: 0.16, defaultStrike: 5.20 },
    "USD/ZAR": { name: "South African Rand", spot: 18.80, vol: 0.18, defaultStrike: 19.70 }
};

// Available hedging strategies
export const STRATEGIES = {
    "custom": {
        name: "Custom Strategy",
        description: "Build your own strategy by adding options",
        needsStrikes: false,
        isCustom: true
    },
    "collarPut": {
        name: "Zero Cost Collar (Put Fixed)",
        description: "Protection against downside with fixed put strike. Call strike adjusts automatically to achieve zero cost.",
    },
    "collarCall": {
        name: "Zero Cost Collar (Call Fixed)",
        description: "Protection against upside with fixed call strike. Put strike adjusts automatically to achieve zero cost.",
    },
    "forward": { 
        name: "Forward Contract",
        description: "Fixing the exchange rate at a future date",
        needsStrikes: false
    },
    "strangle": { 
        name: "Strangle",
        description: "Protection against extreme movements in both directions",
        needsStrikes: true
    },
    "straddle": { 
        name: "Straddle",
        description: "Protection against volatility, without predicting direction",
        needsStrikes: true
    },
    "seagull": { 
        name: "Seagull",
        description: "Asymmetric protection with partial funding",
        needsStrikes: true
    },
    "put": { 
        name: "Simple Put",
        description: "Simple protection against downside, with premium payment",
        needsStrikes: true
    },
    "call": { 
        name: "Simple Call",
        description: "Simple protection against upside, with premium payment",
        needsStrikes: true
    },
    "callKO": {
        name: "Call with KO Barrier",
        description: "Protection against upside with deactivating barrier (Knock-Out)",
        needsStrikes: true,
        needsBarrier: true
    },
    "putKI": {
        name: "Put with KI Barrier",
        description: "Protection against downside with activating barrier (Knock-In)",
        needsStrikes: true,
        needsBarrier: true
    },
    "callPutKI_KO": {
        name: "Call KO + Put KI",
        description: "Combines a Call KO and a Put KI to benefit from a downside to a barrier",
        needsStrikes: true,
        needsBarrier: true
    }
};

// Group forex pairs by category for better organization in the UI
export const FOREX_PAIR_CATEGORIES = {
    "Majors": ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD"],
    "Cross Rates": ["EUR/GBP", "EUR/JPY", "GBP/JPY", "EUR/CHF", "EUR/AUD", "GBP/CHF"],
    "Other Currencies": Object.keys(FOREX_PAIRS).filter(pair => 
        !["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD", 
        "EUR/GBP", "EUR/JPY", "GBP/JPY", "EUR/CHF", "EUR/AUD", "GBP/CHF"].includes(pair)
    )
};

// Option types for custom strategy
export const OPTION_TYPES = {
    "call": "Vanilla Call",
    "put": "Vanilla Put",
    "callKO": "Call Knock-Out",
    "callRKO": "Call Reverse Knock-Out",
    "callDKO": "Call Double Knock-Out",
    "putKO": "Put Knock-Out",
    "putRKO": "Put Reverse Knock-Out",
    "putDKO": "Put Double Knock-Out",
    "callKI": "Call Knock-In",
    "callRKI": "Call Reverse Knock-In",
    "callDKI": "Call Double Knock-In",
    "putKI": "Put Knock-In",
    "putRKI": "Put Reverse Knock-In",
    "putDKI": "Put Double Knock-In"
};

// Strike types for custom strategy
export const STRIKE_TYPES = [
    { value: "percent", label: "Percentage of spot" },
    { value: "absolute", label: "Absolute value" }
];

// Barrier types for options with barrier
export const BARRIER_TYPES = {
    "KO": "Knock-Out (deactivating)",
    "RKO": "Reverse Knock-Out (inverse deactivating)",
    "DKO": "Double Knock-Out (double barrier)",
    "KI": "Knock-In (activating)",
    "RKI": "Reverse Knock-In (inverse activating)",
    "DKI": "Double Knock-In (double barrier)"
};
