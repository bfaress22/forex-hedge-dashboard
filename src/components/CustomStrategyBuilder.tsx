import React, { useState, useEffect } from "react";
import CustomStrategyOption, { OptionComponent } from "./CustomStrategyOption";
import { Plus, Info } from "lucide-react";
import { GlassContainer } from "@/components/ui/layout";
import { BARRIER_PRICING_MODELS, setPricingModel } from "@/utils/barrierOptionCalculations";

interface CustomStrategyBuilderProps {
  spot: number;
  onStrategyChange: (options: OptionComponent[], globalParams: any) => void;
  baseCurrency?: string;
  quoteCurrency?: string;
  notional?: number;
  notionalQuote?: number;
}

const CustomStrategyBuilder: React.FC<CustomStrategyBuilderProps> = ({ 
  spot, 
  onStrategyChange, 
  baseCurrency = "Base", 
  quoteCurrency = "Quote",
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
  const [globalParams, setGlobalParams] = useState({
    maturity: 1,
    r1: 0.02,
    r2: 0.03,
    notional: notional,
    notionalQuote: notionalQuote,
    pricingModel: BARRIER_PRICING_MODELS.MONTE_CARLO
  });
  const [showModelInfo, setShowModelInfo] = useState(false);

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
    onStrategyChange(updatedOptions, globalParams);
  };

  const handleUpdateOption = (index: number, data: Partial<OptionComponent>) => {
    const updatedOptions = [...options];
    updatedOptions[index] = { ...updatedOptions[index], ...data };
    setOptions(updatedOptions);
    onStrategyChange(updatedOptions, globalParams);
  };

  const handleDeleteOption = (index: number) => {
    const updatedOptions = [...options];
    updatedOptions.splice(index, 1);
    setOptions(updatedOptions);
    onStrategyChange(updatedOptions, globalParams);
  };

  const handleGlobalParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = name === 'notional' ? parseInt(value) : parseFloat(value);
    const updatedParams = {
      ...globalParams,
      [name]: parsedValue
    };
    setGlobalParams(updatedParams);
    onStrategyChange(options, updatedParams);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setPricingModel(model); // Set the model globally
    const updatedParams = {
      ...globalParams,
      pricingModel: model
    };
    setGlobalParams(updatedParams);
    onStrategyChange(options, updatedParams);
  };

  const handleBaseNotionalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBaseNotional = parseFloat(e.target.value);
    const newQuoteNotional = newBaseNotional * spot;
    setGlobalParams(prev => {
      const updated = {
        ...prev,
        notional: newBaseNotional,
        notionalQuote: newQuoteNotional
      };
      onStrategyChange(options, updated);
      return updated;
    });
  };

  const handleQuoteNotionalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuoteNotional = parseFloat(e.target.value);
    const newBaseNotional = newQuoteNotional / spot;
    setGlobalParams(prev => {
      const updated = {
        ...prev,
        notional: newBaseNotional,
        notionalQuote: newQuoteNotional
      };
      onStrategyChange(options, updated);
      return updated;
    });
  };

  useEffect(() => {
    // Set the pricing model globally when component mounts
    setPricingModel(globalParams.pricingModel);
    onStrategyChange(options, globalParams);
  }, []);

  return (
    <>
      <GlassContainer className="mb-8">
        <h3 className="font-bold text-xl mb-4">Global Parameters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Maturity (years)
              <input
                type="number"
                name="maturity"
                value={globalParams.maturity}
                onChange={handleGlobalParamChange}
                step="0.25"
                className="input-field mt-1 w-full"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Rate Currency 1 (%)
              <input
                type="number"
                name="r1"
                value={globalParams.r1 * 100}
                onChange={(e) => {
                  const updatedParams = {
                    ...globalParams,
                    r1: parseFloat(e.target.value) / 100
                  };
                  setGlobalParams(updatedParams);
                  onStrategyChange(options, updatedParams);
                }}
                step="0.1"
                className="input-field mt-1 w-full"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Rate Currency 2 (%)
              <input
                type="number"
                name="r2"
                value={globalParams.r2 * 100}
                onChange={(e) => {
                  const updatedParams = {
                    ...globalParams,
                    r2: parseFloat(e.target.value) / 100
                  };
                  setGlobalParams(updatedParams);
                  onStrategyChange(options, updatedParams);
                }}
                step="0.1"
                className="input-field mt-1 w-full"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Notional Amount
              <input
                type="number"
                name="notional"
                value={globalParams.notional}
                onChange={handleGlobalParamChange}
                step="100000"
                className="input-field mt-1 w-full"
              />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {baseCurrency} Notional
              <input
                type="number"
                value={globalParams.notional.toFixed(0)}
                onChange={handleBaseNotionalChange}
                step="100000"
                className="input-field mt-1"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {quoteCurrency} Notional
              <input
                type="number"
                value={globalParams.notionalQuote.toFixed(0)}
                onChange={handleQuoteNotionalChange}
                step="100000"
                className="input-field mt-1"
              />
            </label>
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
