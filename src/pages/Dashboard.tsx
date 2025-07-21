import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { DashboardStats, SalesByPeriod } from '@/types';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Package, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    total_sales: 0,
    total_profit: 0,
    total_products: 0,
    low_stock_count: 0
  });
  const [chartData, setChartData] = useState<SalesByPeriod[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch total products
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('count')
          .eq('created_by', user?.id);

        if (productsError) throw productsError;

        // Fetch low stock products (less than 10)
        const { data: lowStockData, error: lowStockError } = await supabase
          .from('products')
          .select('count')
          .eq('created_by', user?.id)
          .lt('current_stock', 10);

        if (lowStockError) throw lowStockError;

        // Fetch sales data
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('created_by', user?.id);

        if (salesError) throw salesError;

        // Calculate total sales amount
        const totalSalesAmount = salesData?.reduce((sum, item) => sum + parseFloat(item.total_amount), 0) || 0;

        // Calculate estimated profit (assuming 30% profit margin for demo purposes)
        const estimatedProfit = totalSalesAmount * 0.3;

        setStats({
          total_sales: totalSalesAmount,
          total_profit: estimatedProfit,
          total_products: productsData[0]?.count || 0,
          low_stock_count: lowStockData[0]?.count || 0
        });

        // Fetch sales by period data
        await fetchSalesByPeriod(period);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch dashboard data. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [toast]);

  const fetchSalesByPeriod = async (selectedPeriod: 'week' | 'month') => {
    try {
      const days = selectedPeriod === 'week' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('sales')
        .select('sale_date, total_amount')
        .gte('sale_date', startDate.toISOString())
        .eq('created_by', user?.id);

      if (error) throw error;

      // Process data for chart
      const salesByDay: Record<string, { total: number, profit: number }> = {};

      // Initialize all days in the range with zero values
      for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        const formattedDate = date.toISOString().split('T')[0];
        salesByDay[formattedDate] = { total: 0, profit: 0 };
      }

      // Fill in actual values
      data?.forEach(sale => {
        const date = new Date(sale.sale_date).toISOString().split('T')[0];
        if (salesByDay[date]) {
          salesByDay[date].total += parseFloat(sale.total_amount);
          // Assuming 30% profit margin for demo
          salesByDay[date].profit += parseFloat(sale.total_amount) * 0.3;
        }
      });

      // Convert to array format for chart
      const chartData = Object.entries(salesByDay).map(([date, values]) => ({
        date,
        total: values.total,
        profit: values.profit
      }));

      setChartData(chartData);
      setPeriod(selectedPeriod);
    } catch (error) {
      console.error('Error fetching sales by period:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch sales chart data.',
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'RWF',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your business performance and key metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Sales Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sales
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-36" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.total_sales)}</div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Lifetime sales amount
            </p>
          </CardContent>
        </Card>

        {/* Total Profit Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Profit
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-36" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.total_profit)}</div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Estimated profit
            </p>
          </CardContent>
        </Card>

        {/* Total Products Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.total_products}</div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Products in inventory
            </p>
          </CardContent>
        </Card>

        {/* Low Stock Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Alert
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.low_stock_count}</div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Products with low stock
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="week" onValueChange={(v) => fetchSalesByPeriod(v as 'week' | 'month')}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Sales Overview</h3>
          <TabsList>
            <TabsTrigger value="week">Last 7 days</TabsTrigger>
            <TabsTrigger value="month">Last 30 days</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="week" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales & Profit</CardTitle>
              <CardDescription>
                Sales and profit over the last 7 days
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => {
                        const d = new Date(date);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value)]}
                      labelFormatter={(label) => {
                        const d = new Date(label);
                        return d.toLocaleDateString();
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Sales"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      name="Profit"
                      dataKey="profit"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="month" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales & Profit</CardTitle>
              <CardDescription>
                Sales and profit over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => {
                        const d = new Date(date);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                      interval={5}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value)]}
                      labelFormatter={(label) => {
                        const d = new Date(label);
                        return d.toLocaleDateString();
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Sales"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      name="Profit"
                      dataKey="profit"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}