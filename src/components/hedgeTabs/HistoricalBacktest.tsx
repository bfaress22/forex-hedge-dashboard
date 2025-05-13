import React, { useState, useRef } from 'react';
import { HistoricalDataPoint, MonthlyStats, ForexResult } from '@/pages/Index'; // Import interfaces
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Download, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ValueDisplay } from '@/components/ui/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define Props interface
interface Props {
  historicalData: HistoricalDataPoint[];
  setHistoricalData: React.Dispatch<React.SetStateAction<HistoricalDataPoint[]>>;
  monthlyStats: MonthlyStats[];
  setMonthlyStats: React.Dispatch<React.SetStateAction<MonthlyStats[]>>;
  calculateResults: () => void;
  results?: ForexResult[]; // Résultats de la stratégie
  baseCurrency?: string; // Devise de base
  quoteCurrency?: string; // Devise cotée
  totalSummaryStats?: any; // Statistiques totales
  yearlySummaryStats?: Record<string, any>; // Statistiques annuelles
}

const HistoricalBacktest: React.FC<Props> = ({
  historicalData,
  setHistoricalData,
  monthlyStats,
  setMonthlyStats,
  calculateResults,
  results = [],
  baseCurrency = "Base",
  quoteCurrency = "Quote",
  totalSummaryStats = {},
  yearlySummaryStats = {}
}) => {
  const [error, setError] = useState<string | null>(null);
  const [showHistoricalData, setShowHistoricalData] = useState<boolean>(true);
  const [showMonthlyStatistics, setShowMonthlyStatistics] = useState<boolean>(true);
  const [numberFormat, setNumberFormat] = useState<string>("English (Point .)");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<string>("data");

  // Fonction pour nettoyer les lignes CSV
  const cleanCSVLine = (line: string) => {
    return line.replace(/['"]/g, '').trim();
  };

  // Importer des données historiques à partir d'un fichier CSV
  const importHistoricalData = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Gérer le changement de fichier
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      const data: HistoricalDataPoint[] = [];
      
      // Ignorer l'en-tête et traiter les lignes
      for (let i = 1; i < lines.length; i++) {
        const line = cleanCSVLine(lines[i]);
        if (!line) continue;
        
        // Utiliser la bonne méthode de parsing selon le format de nombre
        const parts = line.split(',');
        if (parts.length < 2) continue;
        
        const date = parts[0].trim();
        let priceStr = parts[1].trim();
        
        // Convertir le format français si nécessaire
        if (numberFormat.includes("French")) {
          priceStr = priceStr.replace(',', '.');
        }

        const price = parseFloat(priceStr);
        
        if (date && !isNaN(price)) {
          data.push({ date, price });
        }
      }
      
      if (data.length > 0) {
        // Trier par date
        data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Mettre à jour les données historiques
        setHistoricalData(data);
        
        // Calculer les statistiques mensuelles
        const stats = calculateMonthlyStats(data);
        setMonthlyStats(stats);
        
        setError(null);
      } else {
        setError("Aucune donnée valide n'a pu être importée");
      }
    };
    reader.readAsText(file);
  };

  // Calcul des statistiques mensuelles à partir des données historiques
  const calculateMonthlyStats = (data: HistoricalDataPoint[]): MonthlyStats[] => {
    const monthlyData: { [key: string]: number[] } = {};
    
    // Regrouper les prix par mois
    data.forEach(point => {
      const date = new Date(point.date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = [];
      }
      monthlyData[monthKey].push(point.price);
    });
    
    // Calculer les statistiques pour chaque mois
    const stats: MonthlyStats[] = [];
    for (const month in monthlyData) {
      const prices = monthlyData[month];
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      
      // Calculer la volatilité (écart-type des rendements journaliers)
      let volatility = null;
      if (prices.length > 1) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
          returns.push(Math.log(prices[i] / prices[i - 1]));
        }
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const sqDiff = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0);
        volatility = Math.sqrt(sqDiff / (returns.length - 1)) * Math.sqrt(252); // Annualiser
      }
      
      stats.push({
        month,
        avgPrice,
        volatility: volatility
      });
    }
    
    // Trier par date
    stats.sort((a, b) => a.month.localeCompare(b.month));
    
    return stats;
  };

  // Ajouter une ligne de données manuellement
  const addDataRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setHistoricalData([...historicalData, { date: today, price: 0 }]);
  };

  // Supprimer une ligne de données
  const removeDataRow = (index: number) => {
    const newData = [...historicalData];
    newData.splice(index, 1);
    setHistoricalData(newData);
  };

  // Mettre à jour une ligne de données
  const updateDataRow = (index: number, field: 'date' | 'price', value: string) => {
    const newData = [...historicalData];
    if (field === 'date') {
      newData[index].date = value;
    } else {
      newData[index].price = parseFloat(value);
    }
    setHistoricalData(newData);
  };

  // Effacer toutes les données
  const clearData = () => {
      setHistoricalData([]);
      setMonthlyStats([]);
    setError(null);
  };

  // Sauvegarder le backtest (intégrer avec la fonction saveScenario plus tard)
  const saveBacktest = () => {
    alert("Fonction de sauvegarde à implémenter avec le mécanisme de sauvegarde des scénarios");
  };

  // Appliquer les statistiques mensuelles pour le backtest
  const applyForBacktest = () => {
    if (monthlyStats.length === 0) {
      setError("Veuillez d'abord traiter des données historiques");
        return;
    }
    
    // Calculer les statistiques si nécessaire
    if (historicalData.length > 0 && monthlyStats.length === 0) {
      const stats = calculateMonthlyStats(historicalData);
      setMonthlyStats(stats);
    }
    
    // Lancer le calcul des résultats
    calculateResults(); 
    
    // Passer à l'onglet des résultats après le calcul
    setActiveTab("results");
  };

  // Afficher les statistiques calculées
  const displayCalculatedStats = () => {
    if (historicalData.length > 0 && monthlyStats.length === 0) {
      const stats = calculateMonthlyStats(historicalData);
      setMonthlyStats(stats);
    }
  };

  // Exporter les résultats en CSV
  const exportResultsToCsv = () => {
    if (results.length === 0) {
      alert("Aucun résultat à exporter. Veuillez d'abord calculer les résultats.");
      return;
    }

    const headers = [
      "Date", "TimeToMaturity", "ForwardRate", "RealRate",
      "MonthlyVolume", "PremiumPaid", "PayoffFromHedge",
      "HedgedRevenue", "UnhedgedRevenue", "PnLVsUnhedged", "EffectiveRate"
    ];

    const rows = results.map(row => {
      return [
        row.date,
        row.timeToMaturity.toFixed(4),
        row.forwardRate.toFixed(4),
        row.realRate.toFixed(4),
        row.monthlyVolume.toFixed(2),
        row.premiumPaid.toFixed(2),
        row.payoffFromHedge.toFixed(2),
        row.hedgedRevenue.toFixed(2),
        row.unhedgedRevenue.toFixed(2),
        row.pnlVsUnhedged.toFixed(2),
        row.effectiveRate.toFixed(4)
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `historical_backtest_results_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="data">Historical Data</TabsTrigger>
          <TabsTrigger value="results">Backtest Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="data" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={showHistoricalData ? "default" : "outline"} 
              onClick={() => setShowHistoricalData(!showHistoricalData)}
            >
              {showHistoricalData ? "Hide Historical Data" : "Show Historical Data"}
            </Button>
            
            <Button 
              variant={showMonthlyStatistics ? "default" : "outline"}
              onClick={() => setShowMonthlyStatistics(!showMonthlyStatistics)}
            >
              {showMonthlyStatistics ? "Hide Monthly Statistics" : "Show Monthly Statistics"}
            </Button>
            
            <div className="ml-auto">
              <Select 
                value={numberFormat} 
                onValueChange={setNumberFormat}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Number Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English (Point .)">English (Point .)</SelectItem>
                  <SelectItem value="French (Comma ,)">French (Comma ,)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Actions buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={importHistoricalData}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept=".csv,.txt"
              />
              Import Historical Data
            </Button>
            <Button onClick={addDataRow}>
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
            <Button variant="destructive" onClick={clearData}>
              Clear Data
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {/* Historical Data Table */}
          {showHistoricalData && (
      <Card>
        <CardHeader>
                <CardTitle>Historical Data</CardTitle>
                <CardDescription>Enter or import historical exchange rate data</CardDescription>
        </CardHeader>
              <CardContent>
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicalData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                            No data available. Import data or add rows manually.
                          </TableCell>
                        </TableRow>
                      ) : (
                        historicalData.map((point, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input 
                                type="date"
                                value={point.date} 
                                onChange={(e) => updateDataRow(idx, 'date', e.target.value)} 
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                type="number" 
                                value={point.price} 
                                onChange={(e) => updateDataRow(idx, 'price', e.target.value)} 
                                step="0.0001"
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDataRow(idx)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Monthly Statistics */}
          {showMonthlyStatistics && (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Statistics</CardTitle>
                <CardDescription>Calculated from historical data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Average Price</TableHead>
                        <TableHead>Historical Volatility</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyStats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                            No statistics available. Process historical data first.
                          </TableCell>
                        </TableRow>
                      ) : (
                        monthlyStats.map((stat, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{stat.month}</TableCell>
                            <TableCell>{stat.avgPrice.toFixed(4)}</TableCell>
                            <TableCell>{stat.volatility !== null ? `${(stat.volatility * 100).toFixed(2)}%` : 'N/A'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {historicalData.length > 0 && monthlyStats.length === 0 && (
                  <Button 
                    onClick={displayCalculatedStats} 
                    className="mt-4"
                  >
                    Calculate Statistics
                  </Button>
                )}
                
                {monthlyStats.some(stat => stat.volatility !== null) && (
                  <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm">
                    <p>
                      <strong>Note:</strong> Activez l'option "Use Implied Volatility" dans la page Strategy Parameters 
                      pour utiliser automatiquement ces volatilités historiques dans vos calculs de couverture.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Bottom Action Buttons */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button 
                onClick={applyForBacktest} 
                disabled={monthlyStats.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Apply for Backtest
              </Button>
              <Button onClick={saveBacktest} disabled={monthlyStats.length === 0} variant="outline">
                <Save className="mr-2 h-4 w-4" />
                Save Backtest
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="results" className="space-y-6">
          {results.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center p-12 text-muted-foreground">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Aucun résultat disponible</h3>
                  <p>Importez des données historiques et lancez le backtest pour voir les résultats.</p>
                </div>
        </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Statistics Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Résultats du Backtest avec Données Historiques</CardTitle>
                  <CardDescription>
                    Résultats calculés à partir des données réelles historiques
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ValueDisplay 
                      label={`Total Volume Couvert (${baseCurrency})`}
                      value={totalSummaryStats.totalVolume ? 
                        totalSummaryStats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : "N/A"} 
                  />
                  <ValueDisplay 
                      label="Taux Effectif Moyen" 
                      value={totalSummaryStats.averageEffectiveRate ? 
                        totalSummaryStats.averageEffectiveRate.toFixed(4)
                        : "N/A"} 
                  />
                  <ValueDisplay 
                      label={`Prime Totale Payée (${quoteCurrency})`}
                      value={totalSummaryStats.totalPremiumPaid ? 
                        totalSummaryStats.totalPremiumPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : "N/A"} 
                  />
                  <ValueDisplay 
                      label={`P&L Total vs Non-couvert (${quoteCurrency})`}
                      value={totalSummaryStats.totalPnlVsUnhedged ? 
                        totalSummaryStats.totalPnlVsUnhedged.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : "N/A"} 
                  />
                </CardContent>
                <CardFooter className="border-t pt-4 flex justify-end">
                  <Button variant="outline" onClick={exportResultsToCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Results to CSV
                  </Button>
                </CardFooter>
      </Card>

              {/* Yearly Summary Table */}
        <Card>
          <CardHeader>
                  <CardTitle>Statistiques par Année</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                        <TableHead>Année</TableHead>
                        <TableHead className="text-right">Coût avec Couverture ({quoteCurrency})</TableHead>
                        <TableHead className="text-right">Coût sans Couverture ({quoteCurrency})</TableHead>
                        <TableHead className="text-right">P&L Total ({quoteCurrency})</TableHead>
                        <TableHead className="text-right">Prime de Stratégie ({quoteCurrency})</TableHead>
                        <TableHead className="text-right">Réduction du Coût (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.keys(yearlySummaryStats).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                            Aucune donnée annuelle disponible
                          </TableCell>
                        </TableRow>
                      ) : (
                        Object.entries(yearlySummaryStats)
                          .sort(([yearA], [yearB]) => yearA.localeCompare(yearB))
                          .map(([year, summary]) => (
                            <TableRow key={year}>
                              <TableCell className="font-medium">{year}</TableCell>
                              <TableCell className="text-right">
                                {summary.totalHedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right">
                                {summary.totalUnhedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className={`text-right ${summary.totalPnlVsUnhedged >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {summary.totalPnlVsUnhedged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right">
                                {summary.totalPremiumPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right">
                                {summary.costReductionPercent.toFixed(2)}%
                              </TableCell>
                            </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              {/* Detailed Monthly Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Résultats Mensuels Détaillés</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Forward Rate</TableHead>
                        <TableHead className="bg-blue-50 font-medium">Real Rate</TableHead>
                        <TableHead className="text-right">Monthly Vol</TableHead>
                        <TableHead className="text-right">Premium Paid</TableHead>
                        <TableHead className="text-right">Hedge Payoff</TableHead>
                        <TableHead className="text-right">Hedged Rev</TableHead>
                        <TableHead className="text-right">P&L vs Unhedged</TableHead>
                        <TableHead className="text-right">Effective Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                      {results.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.forwardRate.toFixed(4)}</TableCell>
                          <TableCell className="bg-blue-50 font-medium">{row.realRate.toFixed(4)}</TableCell>
                          <TableCell className="text-right">{row.monthlyVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-right">{row.premiumPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{row.payoffFromHedge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{row.hedgedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className={`text-right ${row.pnlVsUnhedged >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                           {row.pnlVsUnhedged.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-medium">{row.effectiveRate.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HistoricalBacktest; 