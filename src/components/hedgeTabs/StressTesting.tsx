import React from 'react';
import { ForexStressTestScenario } from '@/pages/Index'; // Import the interface
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils"; // Import cn for conditional classes

// Define the Props interface
interface Props {
  scenarios: Record<string, ForexStressTestScenario>;
  customScenario: ForexStressTestScenario;
  updateScenario: (key: string, field: keyof ForexStressTestScenario, value: any) => void;
  applyScenario: (key: string) => void;
  activeScenarioKey: string | null; // Allow null
}

const StressTesting: React.FC<Props> = ({ // Update component to use props
    scenarios,
    customScenario,
    updateScenario,
    applyScenario,
    activeScenarioKey
}) => {

  // Combine default scenarios and the custom one for mapping
  const allScenarios = {
    ...scenarios,
    custom: customScenario
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {Object.entries(allScenarios).map(([key, scenario]) => {
        const isActive = activeScenarioKey === key;
        const isEditable = scenario.isEditable || scenario.isCustom;

        // Helper function for input change
        const handleInputChange = (field: keyof ForexStressTestScenario, value: string) => {
          updateScenario(key, field, value);
        };

        return (
          <Card key={key} className={cn("flex flex-col", isActive ? "border-primary shadow-lg" : "")}>
            <CardHeader>
              <CardTitle className="text-lg">{scenario.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{scenario.description}</p>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              {isEditable ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor={`${key}-vol`}>Volatility (%)</Label>
                    <Input 
                      id={`${key}-vol`}
                      type="number"
                      value={scenario.volatility * 100} // Display as percentage
                      onChange={(e) => handleInputChange('volatility', e.target.value)}
                      step="0.1"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${key}-rateShock`}>Rate Shock (%)</Label>
                    <Input 
                      id={`${key}-rateShock`}
                      type="number" 
                      value={scenario.rateShock * 100} // Display as percentage
                      onChange={(e) => handleInputChange('rateShock', e.target.value)}
                      step="0.1"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${key}-diffShock`}>Rate Diff Shock (bps)</Label>
                    <Input 
                      id={`${key}-diffShock`}
                      type="number" 
                      value={(scenario.rateDifferentialShock ?? 0) * 10000} // Display as basis points
                      onChange={(e) => handleInputChange('rateDifferentialShock', e.target.value)}
                      step="1"
                      className="text-sm"
                    />
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground space-y-2">
                    <p>Volatility: {(scenario.volatility * 100).toFixed(1)}%</p>
                    <p>Rate Shock: {(scenario.rateShock * 100).toFixed(1)}%</p>
                    <p>Rate Diff Shock: {((scenario.rateDifferentialShock ?? 0) * 10000).toFixed(0)} bps</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => applyScenario(key)} 
                variant={isActive ? "default" : "outline"}
                className="w-full"
              >
                {isActive ? "Active Scenario" : "Apply Scenario"}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};

export default StressTesting; 