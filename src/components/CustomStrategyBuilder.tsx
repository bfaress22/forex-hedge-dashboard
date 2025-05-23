import React, { useState, useEffect } from "react";
import CustomStrategyOption, { OptionComponent } from "./CustomStrategyOption";
import { Plus } from "lucide-react";
import { GlassContainer } from "@/components/ui/layout";
import { BARRIER_PRICING_MODELS, setPricingModel } from "@/utils/barrierOptionCalculations";
import { VANILLA_PRICING_MODELS, setVanillaPricingModel } from "@/utils/garmanKohlhagen";

interface CustomStrategyBuilderProps {
  spot: number;
  onStrategyChange: (options: OptionComponent[], globalParams: any) => void;
  baseCurrency?: string;
  quoteCurrency?: string;
  // Receive forex parameters from parent
  maturity?: number;
  domesticRate?: number;
  foreignRate?: number;
  notional?: number;
  notionalQuote?: number;
}

const CustomStrategyBuilder: React.FC<CustomStrategyBuilderProps> = ({ 
  spot, 
  onStrategyChange, 
  baseCurrency = "Base", 
  quoteCurrency = "Quote",
  maturity = 1,
  domesticRate = 2,
  foreignRate = 3,
  notional = 1000000,
  notionalQuote = 1000000 * spot
}) => {
  const [options, setOptions] = useState<OptionComponent[]>([
    {
      type: "call",
      strike: 105,
      strikeType: "percent",
      volatility: 20,
      quantity: 100,
    },
  ]);
  
  // Barrier option pricing model
  const [barrierPricingModel, setBarrierPricingModelState] = useState(BARRIER_PRICING_MODELS.MONTE_CARLO);
  
  // Vanilla option pricing model
  const [vanillaPricingModel, setVanillaPricingModelState] = useState(VANILLA_PRICING_MODELS.CLOSED_FORM);
  
  const handleAddOption = () => {
    const newOption: OptionComponent = {
      type: "put",
      strike: 95,
      strikeType: "percent",
      volatility: 20,
      quantity: 100,
    };
    const updatedOptions = [...options, newOption];
    setOptions(updatedOptions);
    onStrategyChange(updatedOptions, getGlobalParams());
  };

  const handleUpdateOption = (index: number, data: Partial<OptionComponent>) => {
    const updatedOptions = [...options];
    updatedOptions[index] = { ...updatedOptions[index], ...data };
    setOptions(updatedOptions);
    onStrategyChange(updatedOptions, getGlobalParams());
  };

  const handleDeleteOption = (index: number) => {
    const updatedOptions = [...options];
    updatedOptions.splice(index, 1);
    setOptions(updatedOptions);
    onStrategyChange(updatedOptions, getGlobalParams());
  };

  const handleBarrierModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setPricingModel(model); // Set the model globally
    setBarrierPricingModelState(model);
    onStrategyChange(options, getGlobalParams(model, vanillaPricingModel));
  };

  const handleVanillaModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setVanillaPricingModel(model); // Set the model globally
    setVanillaPricingModelState(model);
    onStrategyChange(options, getGlobalParams(barrierPricingModel, model));
  };

  // Helper function to get current global params
  const getGlobalParams = (barrierModel = barrierPricingModel, vanillaModel = vanillaPricingModel) => {
    return {
      maturity,
      r1: domesticRate / 100, // Convert from percentage to decimal
      r2: foreignRate / 100,  // Convert from percentage to decimal
      notional,
      notionalQuote,
      barrierPricingModel: barrierModel,
      vanillaPricingModel: vanillaModel
    };
  };

  useEffect(() => {
    // Set the pricing model globally when component mounts or when parameters change
    setPricingModel(barrierPricingModel);
    setVanillaPricingModel(vanillaPricingModel);
    onStrategyChange(options, getGlobalParams());
  }, [maturity, domesticRate, foreignRate, notional, notionalQuote]);

  return (
    <>
      <GlassContainer className="mb-8">
        <h3 className="font-bold text-xl mb-4">Option Pricing Models</h3>
        <div className="grid grid-cols-1 gap-6">
          {/* Vanilla Option Pricing */}
          <div className="border-b pb-4">
            <label className="block text-sm font-medium mb-1">
              Vanilla Option Pricing Model
              <select
                value={vanillaPricingModel}
                onChange={handleVanillaModelChange}
                className="input-field mt-1 w-full"
              >
                <option value={VANILLA_PRICING_MODELS.CLOSED_FORM}>Garman-Kohlhagen (Closed-Form)</option>
                <option value={VANILLA_PRICING_MODELS.MONTE_CARLO}>Monte Carlo Simulation</option>
                <span className="text-xs text-muted-foreground mt-1 block">
                  Garman-Kohlhagen est plus rapide, Monte Carlo permet de vérifier les résultats
                </span>
              </select>
            </label>
          </div>

          {/* Barrier Option Pricing */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Barrier Option Pricing Model
              <select
                value={barrierPricingModel}
                onChange={handleBarrierModelChange}
                className="input-field mt-1 w-full"
              >
                <option value={BARRIER_PRICING_MODELS.MONTE_CARLO}>Monte Carlo Simulation</option>
                <option value={BARRIER_PRICING_MODELS.CLOSED_FORM}>Closed-Form Analytical</option>
              </select>
              <span className="text-xs text-muted-foreground mt-1 block">
                Closed-Form is faster but only supports single barriers
              </span>
            </label>
          </div>
          
          <div className="bg-muted/20 p-3 rounded-lg text-sm mt-2">
            <p>Using parameters defined in the main section:</p>
            <ul className="mt-2 text-xs text-muted-foreground space-y-1">
              <li><span className="font-medium">Maturity:</span> {maturity} years ({Math.round(maturity * 12)} months)</li>
              <li><span className="font-medium">Domestic Rate:</span> {domesticRate}%</li>
              <li><span className="font-medium">Foreign Rate:</span> {foreignRate}%</li>
              <li><span className="font-medium">{baseCurrency} Notional:</span> {notional.toLocaleString()}</li>
              <li><span className="font-medium">{quoteCurrency} Notional:</span> {notionalQuote.toLocaleString()}</li>
            </ul>
          </div>
        </div>
      </GlassContainer>

      <div className="mt-6 p-4 bg-background/50 rounded-lg border border-border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-xl">Strategy Components</h3>
          <button
            onClick={handleAddOption}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} className="mr-2" /> Add Option
          </button>
        </div>

        {options.map((option, index) => (
          <CustomStrategyOption
            key={index}
            index={index}
            optionData={option}
            spot={spot}
            onUpdate={handleUpdateOption}
            onDelete={handleDeleteOption}
          />
        ))}

        {options.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            No options added. Click "Add Option" to start building your strategy.
          </div>
        )}
      </div>
    </>
  );
};

// Re-export the OptionComponent type so it can be imported from this file
export type { OptionComponent };
export default CustomStrategyBuilder;
