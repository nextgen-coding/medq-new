'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ActivityPoint { 
  date: string; 
  questions: number;
}

interface DailyLearningChartProps {
  data?: ActivityPoint[];
  isLoading?: boolean;
  streak?: number;
}

const DAY_WINDOWS = [7, 14, 30];

export function DailyLearningChart({ data, isLoading: extLoading = false, streak }: DailyLearningChartProps) {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const [days, setDays] = useState<number>(7);
  const [localData, setLocalData] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch real data from API
  useEffect(() => {
    if (!isClient) return;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const url = `/api/dashboard/daily-activity?days=${days}${debug ? '&debug=1' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Handle both array and object responses
        if (Array.isArray(result)) {
          setLocalData(result);
        } else if (result.dailyData) {
          setLocalData(result.dailyData);
          if (debug) {
            console.log('Daily Activity Debug:', result);
          }
        } else {
          setLocalData([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLocalData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days, debug, isClient]);

  // Use external data if provided, otherwise use local data
  const chartData = data && data.length > 0 ? data : localData;
  const isLoading = extLoading || loading;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'short',
      day: 'numeric'
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-muted/95 border border-border/50 rounded-xl p-3 shadow-lg backdrop-blur-sm">
          <p className="font-medium text-foreground">{formatDate(label)}</p>
          <p className="text-sm text-muted-foreground">
            Questions: <span className="font-medium text-blue-600 dark:text-blue-400">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <div className="h-6 w-48 bg-muted/60 rounded-lg animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-muted/60 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const totalQuestions = chartData.reduce((sum, item) => sum + item.questions, 0);

  return (
    <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
          <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Activité quotidienne
          {typeof streak === 'number' && streak > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-600/10 dark:bg-blue-400/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 border border-blue-600/20 dark:border-blue-400/20">
              <span>🔥</span>
              {streak}j
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-1 mt-2">
          {DAY_WINDOWS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${days === d ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-transparent dark:text-slate-300 border-border/40 hover:bg-blue-500/10'}`}
              disabled={loading}
            >
              {d}j
            </button>
          ))}
          <button
            onClick={() => setDebug(v => !v)}
            className={`ml-1 px-2 py-0.5 rounded text-[11px] font-medium border border-border/40 ${debug ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'text-slate-400 hover:bg-amber-500/10'}`}
            title="Mode debug"
          >
            {debug ? 'dbg' : 'bug'}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[280px]">
          {error && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
              <span>Erreur: {error}</span>
              <a 
                href={`/api/dashboard/daily-activity?days=${days}&debug=1`} 
                target="_blank" 
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
              >
                Débugger l'API
              </a>
            </div>
          )}
          
          {!error && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12, fill: 'currentColor' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'currentColor' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="questions"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  minPointSize={3}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.questions === 0 ? 'rgba(59,130,246,0.3)' : '#3b82f6'} 
                    />
                  ))}
                  <LabelList 
                    dataKey="questions" 
                    position="top" 
                    className="fill-current" 
                    fontSize={11}
                    formatter={(value: number) => value > 0 ? value : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {!error && chartData.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Aucune donnée disponible</span>
              <a 
                href={`/api/dashboard/daily-activity?days=${days}&debug=1`} 
                target="_blank" 
                className="text-blue-600 hover:underline text-xs"
              >
                Vérifier l'API
              </a>
            </div>
          )}
          
          {/* Info overlay */}
          <div className="absolute bottom-2 left-2 text-xs text-slate-400 bg-black/20 px-2 py-1 rounded">
            {chartData.length} jours • Total: {totalQuestions} questions
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
