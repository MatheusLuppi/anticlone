// src/pages/DashboardPage.tsx
import { useState, useEffect } from 'react'; // Import useEffect
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error display
import { Terminal } from "lucide-react"; // Icon for alert

// Helper function to get token (replace with context/store later)
const getAuthToken = () => localStorage.getItem('access_token');

// Define types for fetched data (optional but good practice)
interface LogEntry {
  id: number;
  cloned_from_domain: string; // Matches backend model
  timestamp: string;
  action_taken: string; // Matches backend model
}

interface DashboardStats {
  totalDomains: number;
  activeDomains: number;
  blockedAttemptsToday: number;
  totalBlockedAttempts: number;
}

interface ChartDataPoint {
  name: string;
  blocked: number;
}

const DashboardPage = () => {
  // State for data, loading, and errors
  const [stats, setStats] = useState<DashboardStats | null>(null); // Placeholder for stats
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]); // Placeholder for chart
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Placeholder data (will be replaced or removed)
  const placeholderStats: DashboardStats = {
    totalDomains: 5,
    activeDomains: 4,
    blockedAttemptsToday: 12,
    totalBlockedAttempts: 153,
  };
  const placeholderChartData: ChartDataPoint[] = [
    { name: 'Apr 24', blocked: 15 }, { name: 'Apr 25', blocked: 22 }, { name: 'Apr 26', blocked: 18 },
    { name: 'Apr 27', blocked: 25 }, { name: 'Apr 28', blocked: 30 }, { name: 'Apr 29', blocked: 28 },
    { name: 'Apr 30', blocked: placeholderStats.blockedAttemptsToday },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const token = getAuthToken();

      if (!token) {
        setError("Authentication token not found. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        // Fetch recent logs (limit to 5, sort by timestamp descending)
        const logsResponse = await fetch('/api/logs?limit=5&sort=desc', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (!logsResponse.ok) {
          throw new Error(`Failed to fetch logs: ${logsResponse.statusText}`);
        }
        const logsData: LogEntry[] = await logsResponse.json();
        setRecentLogs(logsData);

        // TODO: Fetch stats and chart data from dedicated API endpoints when available
        // For now, use placeholder data for stats and chart
        setStats(placeholderStats);
        setChartData(placeholderChartData);

      } catch (err: any) {
        console.error("Failed to fetch dashboard data:", err);
        setError(err.message || "An error occurred while fetching data.");
        // Keep placeholder data on error?
        setStats(placeholderStats);
        setChartData(placeholderChartData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards - Use fetched or placeholder data */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : (stats?.totalDomains ?? 'N/A')}</div>
            <p className="text-xs text-muted-foreground">({loading ? '...' : (stats?.activeDomains ?? 'N/A')} active)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : (stats?.blockedAttemptsToday ?? 'N/A')}</div>
            <p className="text-xs text-muted-foreground">Unauthorized access attempts</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : (stats?.totalBlockedAttempts ?? 'N/A')}</div>
             <p className="text-xs text-muted-foreground">Since account creation</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart - Use fetched or placeholder data */}
       <Card>
        <CardHeader>
          <CardTitle>Blocked Attempts (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {loading ? (
            <p>Loading chart data...</p>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="blocked" stroke="#ef4444" activeDot={{ r: 8 }} name="Blocked Attempts"/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No chart data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity / Logs - Use fetched data */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Unauthorized Access Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading recent logs...</p>
          ) : recentLogs.length > 0 ? (
            <ul className="space-y-2">
              {recentLogs.map((log) => (
                <li key={log.id} className="text-sm">
                  Detected clone at <span className="font-semibold">{log.cloned_from_domain}</span> on {new Date(log.timestamp).toLocaleString()}. Action: {log.action_taken}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recent unauthorized access detected.</p>
          )}
          {/* TODO: Link to full logs page */} 
        </CardContent>
      </Card>

    </div>
  );
};

export default DashboardPage;

