import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const CHART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#0ea5e9', '#dc2626'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesPeriod, setSalesPeriod] = useState('week');
  const [inventoryPeriod, setInventoryPeriod] = useState('all');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [productPerformance, setProductPerformance] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSalesData();
      fetchTopProducts();
    } else if (activeTab === 'inventory') {
      fetchProductPerformance();
      fetchLowStockProducts();
    }
  }, [activeTab, salesPeriod, inventoryPeriod]);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      let days;
      switch (salesPeriod) {
        case 'week':
          days = 7;
          break;
        case 'month':
          days = 30;
          break;
        case 'quarter':
          days = 90;
          break;
        case 'year':
          days = 365;
          break;
        default:
          days = 7;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch sales data grouped by date
      const { data, error } = await supabase
        .from('sales')
        .select('sale_date, total_amount, payment_method, payment_status')
        .eq('created_by', user?.id)
        .gte('sale_date', startDate.toISOString())
        .order('sale_date');

      if (error) throw error;

      // Process data for chart
      const salesByDay: Record<string, { date: string, sales: number, profit: number }> = {};

      // Initialize all days in the range with zero values
      for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        const formattedDate = date.toISOString().split('T')[0];
        salesByDay[formattedDate] = {
          date: formattedDate,
          sales: 0,
          profit: 0
        };
      }

      // Fill in actual values
      data?.forEach(sale => {
        const date = new Date(sale.sale_date).toISOString().split('T')[0];
        if (salesByDay[date]) {
          salesByDay[date].sales += parseFloat(sale.total_amount);
          // Assuming 30% profit margin for demo
          salesByDay[date].profit += parseFloat(sale.total_amount) * 0.3;
        }
      });

      // Convert to array format for chart
      const chartData = Object.values(salesByDay);

      setSalesData(chartData);
    } catch (error) {
      console.error('Error fetching sales data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch sales data.',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTopProducts = async () => {
    try {
      let days;
      switch (salesPeriod) {
        case 'week':
          days = 7;
          break;
        case 'month':
          days = 30;
          break;
        case 'quarter':
          days = 90;
          break;
        case 'year':
          days = 365;
          break;
        default:
          days = 7;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch top selling products
      const { data, error } = await supabase.rpc('get_top_selling_products', {
        start_date: startDate.toISOString(),
        user_id: user?.id
      });

      if (error) throw error;

      setTopProducts(data || []);
    } catch (error) {
      console.error('Error fetching top products:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch top products data.',
      });
    }
  };

  const fetchProductPerformance = async () => {
    setLoading(true);
    try {
      // Fetch all products with their stock levels
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('created_by', user?.id);

      if (productsError) throw productsError;

      // Calculate performance metrics
      const performance = products?.map(product => {
        const stockValue = product.current_stock * product.purchase_price;
        const potentialSale = product.current_stock * product.sale_price;
        const potentialProfit = potentialSale - stockValue;

        return {
          id: product.id,
          name: product.name,
          currentStock: product.current_stock,
          stockValue: stockValue,
          potentialProfit: potentialProfit,
          turnoverRate: product.current_stock > 0 ? 'Active' : 'Out of Stock'
        };
      }) || [];

      setProductPerformance(performance);
    } catch (error) {
      console.error('Error fetching product performance:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch inventory data.',
      });
    } finally {
      setLoading(false);
    }
  };

  const chartData = topProducts.slice(0, 5).map(p => ({
    name: p.product_name,
    quantity: p.total_quantity_sold
  }));

  const fetchLowStockProducts = async () => {
    try {
      // Fetch products with low stock (less than 10)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('created_by', user?.id)
        .lt('current_stock', 10)
        .order('current_stock');

      if (error) throw error;

      setLowStockProducts(data || []);
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch low stock products data.',
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'RWF',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const calculateTotalSales = () => {
    return salesData.reduce((sum, item) => sum + item.sales, 0);
  };

  const calculateTotalProfit = () => {
    return salesData.reduce((sum, item) => sum + item.profit, 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">
          Analytics and insights for your business
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sales">Sales Reports</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="flex justify-end">
            <Select value={salesPeriod} onValueChange={setSalesPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="quarter">Last 90 days</SelectItem>
                <SelectItem value="year">Last 365 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Total Sales</CardTitle>
                <CardDescription>
                  Sales overview for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-full w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value)]}
                        labelFormatter={(label) => {
                          return new Date(label).toLocaleDateString();
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke="#2563eb"
                        strokeWidth={2}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        name="Profit"
                        dataKey="profit"
                        stroke="#16a34a"
                        strokeWidth={2}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
                <CardDescription>
                  Best performing products by units sold
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-full w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <Bar dataKey="quantity" name="Units Sold" fill="#2563eb" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [value]}
                        labelFormatter={(name) => `Product: ${name}`}
                      />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sales Summary</CardTitle>
              <CardDescription>
                Financial overview for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <Skeleton className="h-8 w-28" />
                    ) : (
                      formatCurrency(calculateTotalSales())
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Profit</p>
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <Skeleton className="h-8 w-28" />
                    ) : (
                      formatCurrency(calculateTotalProfit())
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Profit Margin</p>
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      `${(calculateTotalSales() > 0
                        ? (calculateTotalProfit() / calculateTotalSales()) * 100
                        : 0).toFixed(2)}%`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Alert</CardTitle>
                <CardDescription>
                  Products that need restocking
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {Array(5).fill(null).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Current Stock</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowStockProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                              No low stock products found
                            </TableCell>
                          </TableRow>
                        ) : (
                          lowStockProducts.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell className="text-right">{product.current_stock}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={product.current_stock === 0 ? 'destructive' : 'outline'}>
                                  {product.current_stock === 0 ? 'Out of Stock' : 'Low Stock'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Value</CardTitle>
                <CardDescription>
                  Current inventory value breakdown
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-full w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productPerformance.slice(0, 6).map(product => ({
                          name: product.name,
                          value: product.stockValue
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {productPerformance.slice(0, 6).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatCurrency(value), 'Value']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
              <CardDescription>
                Detailed view of product metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array(5).fill(null).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Current Stock</TableHead>
                        <TableHead className="text-right">Stock Value</TableHead>
                        <TableHead className="text-right">Potential Profit</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productPerformance.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            No product data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        productPerformance.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="text-right">{product.currentStock}</TableCell>
                            <TableCell className="text-right">{formatCurrency(product.stockValue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(product.potentialProfit)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={product.currentStock > 0 ? 'default' : 'destructive'}>
                                {product.turnoverRate}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}