import React, { useState } from 'react';
import { HistoricalDataPoint, MonthlyStats } from '@/pages/Index'; // Import interfaces
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Define Props interface
interface Props {
  historicalData: HistoricalDataPoint[];
  setHistoricalData: React.Dispatch<React.SetStateAction<HistoricalDataPoint[]>>;
  monthlyStats: MonthlyStats[];
  setMonthlyStats: React.Dispatch<React.SetStateAction<MonthlyStats[]>>;
  calculateResults: () => void;
}

const HistoricalBacktest: React.FC<Props> = ({ // Update component to use props
  historicalData,
  setHistoricalData,
  monthlyStats,
  setMonthlyStats,
  calculateResults
}) => {
  const [pastedData, setPastedData] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const processHistoricalData = () => {
    setError(null);
    const lines = pastedData.trim().split('\n');
    const processedData: HistoricalDataPoint[] = [];
    const monthlyAgg: Record<string, { sum: number; count: number }> = {};

    try {
      lines.forEach((line, index) => {
        const [dateStr, priceStr] = line.split(',').map(s => s.trim());
        if (!dateStr || !priceStr) {
          throw new Error(`Invalid format on line ${index + 1}: Expected 'YYYY-MM-DD,Rate'`);
        }

        // Basic date validation (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          throw new Error(`Invalid date format on line ${index + 1}: ${dateStr}. Expected YYYY-MM-DD.`);
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
           throw new Error(`Invalid date value on line ${index + 1}: ${dateStr}`);
        }

        const price = parseFloat(priceStr);
        if (isNaN(price)) {
          throw new Error(`Invalid price on line ${index + 1}: ${priceStr}`);
        }

        processedData.push({ date: dateStr, price });

        // Aggregate monthly stats
        const monthKey = dateStr.substring(0, 7); // YYYY-MM
        if (!monthlyAgg[monthKey]) {
          monthlyAgg[monthKey] = { sum: 0, count: 0 };
        }
        monthlyAgg[monthKey].sum += price;
        monthlyAgg[monthKey].count++;
      });

      // Sort data by date
      processedData.sort((a, b) => a.date.localeCompare(b.date));
      setHistoricalData(processedData);

      // Calculate monthly averages
      const calculatedMonthlyStats: MonthlyStats[] = Object.entries(monthlyAgg)
        .map(([month, { sum, count }]) => ({
          month,
          avgPrice: sum / count
        }))
        .sort((a, b) => a.month.localeCompare(b.month)); // Sort stats by month
      
      setMonthlyStats(calculatedMonthlyStats);
      console.log("Historical data processed and monthly stats calculated.");

    } catch (err: any) {
      setError(err.message || "Failed to process data.");
      setHistoricalData([]);
      setMonthlyStats([]);
    }
  };

  const handleRunBacktest = () => {
    if (monthlyStats.length === 0) {
        setError("Please process historical data before running the backtest.");
        return;
    }
    // We need to ensure the parent knows we are on the backtest tab.
    // The parent already handles this check in calculateResults based on activeTab state.
    console.log("Triggering backtest calculation using historical monthly stats...");
    calculateResults(); 
  };

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Historical Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="historical-data-paste">Paste Historical Data (Format: YYYY-MM-DD,Rate - one per line)</Label>
            <Textarea 
              id="historical-data-paste"
              placeholder="e.g.,\n2023-01-01,1.1020\n2023-01-02,1.1055\n..."
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={processHistoricalData}>Process Data</Button>
          {error && <p className="text-destructive text-sm mt-2">Error: {error}</p>}
        </CardContent>
      </Card>

      {monthlyStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Calculated Monthly Average Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month (YYYY-MM)</TableHead>
                  <TableHead className="text-right">Average Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyStats.map((stat) => (
                  <TableRow key={stat.month}>
                    <TableCell>{stat.month}</TableCell>
                    <TableCell className="text-right">{stat.avgPrice.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleRunBacktest} disabled={monthlyStats.length === 0} className="w-full">
        Run Backtest with Historical Data
      </Button>
      
      {/* We can add a chart for historicalData later if needed */}

    </div>
  );
};

export default HistoricalBacktest; 