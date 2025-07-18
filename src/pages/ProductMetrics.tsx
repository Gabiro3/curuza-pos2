import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, DollarSign, Package, Clock } from 'lucide-react';
import { ProductHistory } from '@/components/products/product-history';

interface ProductMetric {
    totalSales: number;
    totalUnits: number;
    totalRevenue: number;
    totalProfit: number;
    averageSalePrice: number;
    profitMargin: number;
    stockTurnoverRate: number;
    daysWithoutStock: number;
    averageTimeToSell: number;
    lastStockIn: string | null;
    lastStockOut: string | null;
    highestSaleDay: {
        date: string | null;
        units: number;
        revenue: number;
    };
    monthlyBreakdown: {
        month: string;
        units: number;
        revenue: number;
    }[];
}

export default function ProductMetricsPage() {
    const { productId } = useParams<{ productId: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [metrics, setMetrics] = useState<ProductMetric | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        if (!productId) return;
        fetchProductAndMetrics(productId);
    }, [productId]);

    const fetchProductAndMetrics = async (id: string) => {
        setLoading(true);
        try {
            // Fetch product details
            const { data: productData, error: productError } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();

            if (productError) throw productError;
            setProduct(productData);

            // Fetch sales data for metrics
            const { data: salesData, error: salesError } = await supabase
                .from('sale_items')
                .select(`
          *,
          sales:sale_id (id, customer_name, sale_date, total_amount, payment_method)
        `)
                .eq('product_id', id)
                .order('created_at', { ascending: false });

            if (salesError) throw salesError;

            // Fetch inventory transactions
            const { data: transactionsData, error: transactionsError } = await supabase
                .from('inventory_transactions')
                .select('*')
                .eq('product_id', id)
                .order('transaction_date', { ascending: false });

            if (transactionsError) throw transactionsError;

            // Calculate metrics
            const calculatedMetrics = calculateMetrics(productData, salesData || [], transactionsData || []);
            setMetrics(calculatedMetrics);
        } catch (error) {
            console.error('Error fetching product metrics:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load product metrics.',
            });
        } finally {
            setLoading(false);
        }
    };

    const calculateMetrics = (product: Product, sales: any[], transactions: any[]): ProductMetric => {
        // Basic metrics
        const totalUnits = sales.reduce((sum, item) => sum + item.quantity, 0);
        const totalRevenue = sales.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalCost = sales.reduce((sum, item) => sum + (product.purchase_price * item.quantity), 0);
        const totalProfit = totalRevenue - totalCost;

        // Sales metrics
        const averageSalePrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        // Stock metrics
        const stockIns = transactions.filter(t => t.transaction_type === 'in');
        const stockOuts = transactions.filter(t => t.transaction_type === 'out');
        const totalStockIn = stockIns.reduce((sum, t) => sum + t.quantity, 0);

        // Stock turnover rate (approximate - total units sold / average inventory)
        const stockTurnoverRate = totalStockIn > 0 ? totalUnits / ((totalStockIn + product.current_stock) / 2) : 0;

        // Last stock movements
        const lastStockIn = stockIns.length > 0 ? stockIns[0].transaction_date : null;
        const lastStockOut = stockOuts.length > 0 ? stockOuts[0].transaction_date : null;

        // Days without stock - would need more detailed historical data
        const daysWithoutStock = 0; // Placeholder

        // Average time to sell - would need more detailed historical data
        const averageTimeToSell = 0; // Placeholder

        // Highest sale day
        let highestSaleDay = {
            date: null,
            units: 0,
            revenue: 0
        };

        const salesByDate = sales.reduce((acc: Record<string, { units: number, revenue: number }>, sale) => {
            const date = sale.sales.sale_date.split('T')[0];
            if (!acc[date]) {
                acc[date] = { units: 0, revenue: 0 };
            }
            acc[date].units += sale.quantity;
            acc[date].revenue += sale.price * sale.quantity;
            return acc;
        }, {});

        Object.entries(salesByDate).forEach(([date, data]) => {
            const dayData = data as { units: number; revenue: number };
            if (!highestSaleDay.date || (dayData as { revenue: number }).revenue > highestSaleDay.revenue) {
                highestSaleDay = {
                    date,
                    units: (dayData as { units: number }).units,
                    revenue: (dayData as { revenue: number }).revenue
                };
            }
        });

        // Monthly breakdown
        const monthlyData = sales.reduce((acc: Record<string, { units: number, revenue: number }>, sale) => {
            const date = new Date(sale.sales.sale_date);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!acc[monthYear]) {
                acc[monthYear] = { units: 0, revenue: 0 };
            }

            acc[monthYear].units += sale.quantity;
            acc[monthYear].revenue += sale.price * sale.quantity;

            return acc;
        }, {});

        const monthlyBreakdown = Object.entries(monthlyData)
            .map(([month, data]: [string, { units: number; revenue: number }]) => ({
                month,
                units: data.units,
                revenue: data.revenue
            }))
            .sort((a, b) => a.month.localeCompare(b.month));

        return {
            totalSales: sales.length,
            totalUnits,
            totalRevenue,
            totalProfit,
            averageSalePrice,
            profitMargin,
            stockTurnoverRate,
            daysWithoutStock,
            averageTimeToSell,
            lastStockIn,
            lastStockOut,
            highestSaleDay,
            monthlyBreakdown
        };
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'RWF',
        }).format(value);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatMonth = (monthYear: string) => {
        const [year, month] = monthYear.split('-');
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', {
            month: 'long',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center">
                    <Button variant="ghost" className="mr-4" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <Skeleton className="h-8 w-1/3" />
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-28 w-full" />
                    ))}
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!product || !metrics) {
        return (
            <div className="space-y-6">
                <div className="flex items-center">
                    <Button variant="ghost" className="mr-4" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <h2 className="text-3xl font-bold tracking-tight">Product Not Found</h2>
                </div>
                <p>The product you're looking for doesn't exist or has been removed.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <Button variant="ghost" className="mr-4" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">{product.name}</h2>
                        <p className="text-muted-foreground">Product performance metrics and analytics</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Revenue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold">
                                {formatCurrency(metrics.totalRevenue)}
                            </div>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            From {metrics.totalUnits} units sold
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Profit
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold">
                                {formatCurrency(metrics.totalProfit)}
                            </div>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Margin: {metrics.profitMargin.toFixed(2)}%
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Current Stock
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold">
                                {product.current_stock}
                            </div>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Value: {formatCurrency(product.current_stock * product.purchase_price)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Stock Turnover
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold">
                                {metrics.stockTurnoverRate.toFixed(2)}
                            </div>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Last restock: {formatDate(metrics.lastStockIn)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="history">Product History</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly Analysis</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Product Details</CardTitle>
                                <CardDescription>Current pricing and profit information</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Purchase Price</p>
                                            <p className="text-lg font-medium">{formatCurrency(product.purchase_price)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Sale Price</p>
                                            <p className="text-lg font-medium">{formatCurrency(product.sale_price)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Profit per Unit</p>
                                            <p className="text-lg font-medium">
                                                {formatCurrency(product.sale_price - product.purchase_price)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Profit Margin</p>
                                            <p className="text-lg font-medium">
                                                {(((product.sale_price - product.purchase_price) / product.sale_price) * 100).toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Sales Performance</CardTitle>
                                <CardDescription>Key sales metrics for this product</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Total Sales</p>
                                            <p className="text-lg font-medium">{metrics.totalSales}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Units Sold</p>
                                            <p className="text-lg font-medium">{metrics.totalUnits}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Average Sale Price</p>
                                            <p className="text-lg font-medium">
                                                {formatCurrency(metrics.averageSalePrice)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Best Sales Day</p>
                                            <p className="text-lg font-medium">
                                                {metrics.highestSaleDay.date ? formatDate(metrics.highestSaleDay.date) : 'N/A'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {metrics.highestSaleDay.units} units, {formatCurrency(metrics.highestSaleDay.revenue)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Product History</CardTitle>
                            <CardDescription>Inventory transactions and sales history</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ProductHistory productId={product.id} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="monthly">
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Sales Analysis</CardTitle>
                            <CardDescription>Breakdown of sales by month</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {metrics.monthlyBreakdown.length === 0 ? (
                                <p className="text-muted-foreground py-4">No monthly sales data available.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Month</TableHead>
                                            <TableHead>Units Sold</TableHead>
                                            <TableHead>Revenue</TableHead>
                                            <TableHead>Estimated Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {metrics.monthlyBreakdown.map((month, index) => {
                                            const profit = month.units * (product.sale_price - product.purchase_price);
                                            return (
                                                <TableRow key={index}>
                                                    <TableCell>{formatMonth(month.month)}</TableCell>
                                                    <TableCell>{month.units}</TableCell>
                                                    <TableCell>{formatCurrency(month.revenue)}</TableCell>
                                                    <TableCell>{formatCurrency(profit)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}