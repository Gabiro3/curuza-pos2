"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import type { DashboardStats, SalesByPeriod } from "@/types"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Package, CreditCard, TrendingUp, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, ShoppingCart, ArrowUpCircle, ArrowDownCircle } from "lucide-react"

export default function Dashboard() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    total_sales: 0,
    total_profit: 0,
    total_products: 0,
    low_stock_count: 0,
  })
  const [chartData, setChartData] = useState<SalesByPeriod[]>([])
  const [period, setPeriod] = useState<"week" | "month">("week")
  const [loading, setLoading] = useState(true)
  const [dailyStats, setDailyStats] = useState<
    Array<{
      date: string
      purchases: number
      sales: number
      profit: number
      transactions: Array<{
        id: string
        type: "purchase" | "sale"
        product_name: string
        amount: number
        quantity: number
        profit: number
        created_at: string
      }>
    }>
  >([])

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        // Fetch total products
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("count")
          .eq("created_by", user?.id)

        if (productsError) throw productsError

        // Fetch low stock products (less than 10)
        const { data: lowStockData, error: lowStockError } = await supabase
          .from("products")
          .select("count")
          .eq("created_by", user?.id)
          .lt("current_stock", 10)

        if (lowStockError) throw lowStockError

        // Fetch sales data
        const { data: salesData, error: salesError } = await supabase
          .from("sales")
          .select("total_amount")
          .eq("created_by", user?.id)

        if (salesError) throw salesError

        // Calculate total sales amount
        const totalSalesAmount = salesData?.reduce((sum, item) => sum + Number.parseFloat(item.total_amount), 0) || 0

        // Calculate estimated profit (assuming 30% profit margin for demo purposes)
        const estimatedProfit = totalSalesAmount * 0.3

        setStats({
          total_sales: totalSalesAmount,
          total_profit: estimatedProfit,
          total_products: productsData[0]?.count || 0,
          low_stock_count: lowStockData[0]?.count || 0,
        })

        // Fetch sales by period data
        await fetchSalesByPeriod(period)
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch dashboard data. Please try again.",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [toast])

  const fetchSalesByPeriod = async (selectedPeriod: "week" | "month") => {
    try {
      const days = selectedPeriod === "week" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch sales data with sale items, including the profit for each sale item
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(`
        id,
        sale_date,
        total_amount,
        sale_items (
          quantity,
          price,
          profit,
          products (
            name
          )
        )
      `)
        .gte("sale_date", startDate.toISOString())
        .eq("created_by", user?.id);

      if (salesError) throw salesError;

      // Fetch purchase data
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("purchases")
        .select(`
        id,
        purchase_date,
        total_amount,
        purchase_items (
          quantity,
          unit_price,
          products (
            name
          )
        )
      `)
        .gte("purchase_date", startDate.toISOString())
        .eq("created_by", user?.id);

      if (purchasesError) throw purchasesError;

      // Initialize salesByDay and dailyStatsMap
      const salesByDay: Record<string, { total: number; profit: number }> = {};
      const dailyStatsMap: Record<
        string,
        {
          date: string;
          purchases: number;
          sales: number;
          profit: number;
          transactions: Array<{
            id: string;
            type: "purchase" | "sale";
            product_name: string;
            amount: number;
            quantity: number;
            profit: number; // Added the profit field here for each item
            created_at: string;
          }>;
        }
      > = {};

      // Initialize all days in the range with zero values
      for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        const formattedDate = date.toISOString().split("T")[0];
        salesByDay[formattedDate] = { total: 0, profit: 0 };
        dailyStatsMap[formattedDate] = {
          date: formattedDate,
          purchases: 0,
          sales: 0,
          profit: 0,
          transactions: [],
        };
      }

      // Process sales data
      salesData?.forEach((sale) => {
        const date = new Date(sale.sale_date).toISOString().split("T")[0];
        if (salesByDay[date]) {
          const saleAmount = Number.parseFloat(sale.total_amount);
          let totalProfitForSale = 0;

          // Sum up the profits for each sale item and push the items with profit into the transactions array
          sale.sale_items?.forEach((item) => {
            totalProfitForSale += item.profit || 0; // Sum the profit of each item
            dailyStatsMap[date].transactions.push({
              id: sale.id,
              type: "sale",
              product_name: item.products['name'] || "Unknown Product",
              amount: item.price * item.quantity,
              quantity: item.quantity,
              profit: item.profit || 0, // Include item profit
              created_at: sale.sale_date,
            });
          });

          // Add the total profit of the sale to the day
          salesByDay[date].total += saleAmount;
          salesByDay[date].profit += totalProfitForSale;

          dailyStatsMap[date].sales += saleAmount;
          dailyStatsMap[date].profit += totalProfitForSale;
        }
      });

      // Process purchases data
      purchasesData?.forEach((purchase) => {
        const date = new Date(purchase.purchase_date).toISOString().split("T")[0];
        if (dailyStatsMap[date]) {
          const purchaseAmount = Number.parseFloat(purchase.total_amount);
          dailyStatsMap[date].purchases += purchaseAmount;

          // Add purchase transactions
          purchase.purchase_items?.forEach((item) => {
            dailyStatsMap[date].transactions.push({
              id: purchase.id,
              type: "purchase",
              product_name: item.products['name'] || "Unknown Product",
              amount: item.unit_price * item.quantity,
              quantity: item.quantity,
              profit: 0, // Purchases have no profit, set to 0
              created_at: purchase.purchase_date,
            });
          });
        }
      });

      // Convert to array format for chart
      const chartData = Object.entries(salesByDay).map(([date, values]) => ({
        date,
        total: values.total,
        profit: values.profit,
      }));

      // Convert daily stats to array and sort by date
      const dailyStatsArray = Object.values(dailyStatsMap).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setChartData(chartData);
      setDailyStats(dailyStatsArray);
      setPeriod(selectedPeriod);
    } catch (error) {
      console.error("Error fetching sales by period:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch sales chart data.",
      });
    }
  };



  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "RWF",
    }).format(value)
  }

  const DailyStatsCard = ({ dayData }: { dayData: (typeof dailyStats)[0] }) => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        weekday: "short",
      })
    }

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Card className="min-w-[280px] cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(dayData.date)}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Purchases</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(dayData.purchases)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Sales</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(dayData.sales)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Profit</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(dayData.profit)}</span>
              </div>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Transactions for {formatDate(dayData.date)}</DialogTitle>
            <DialogDescription>Detailed view of all purchases and sales for this day</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] w-full">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Purchases</p>
                        <p className="text-lg font-semibold">{formatCurrency(dayData.purchases)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Sales</p>
                        <p className="text-lg font-semibold">{formatCurrency(dayData.sales)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Profit</p>
                        <p className="text-lg font-semibold">{formatCurrency(dayData.profit)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {dayData.transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayData.transactions.map((transaction, index) => (
                      <TableRow key={`${transaction.id}-${index}`}>
                        <TableCell>
                          <Badge
                            variant={transaction.type === "sale" ? "default" : "secondary"}
                            className="flex items-center gap-1 w-fit"
                          >
                            {transaction.type === "sale" ? (
                              <ShoppingCart className="h-3 w-3" />
                            ) : (
                              <ArrowDownCircle className="h-3 w-3" />
                            )}
                            {transaction.type === "sale" ? "Sale" : "Purchase"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{transaction.product_name}</TableCell>
                        <TableCell>{transaction.quantity}</TableCell>
                        <TableCell>
                          {formatCurrency(transaction.profit)}
                        </TableCell>
                        <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                        <TableCell>
                          {new Date(transaction.created_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No transactions found for this day</div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your business performance and key metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Sales Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-36" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.total_sales)}</div>
            )}
            <p className="text-xs text-muted-foreground pt-1">Lifetime sales amount</p>
          </CardContent>
        </Card>

        {/* Total Profit Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-36" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.total_profit)}</div>
            )}
            <p className="text-xs text-muted-foreground pt-1">Estimated profit</p>
          </CardContent>
        </Card>

        {/* Total Products Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.total_products}</div>
            )}
            <p className="text-xs text-muted-foreground pt-1">Products in inventory</p>
          </CardContent>
        </Card>

        {/* Low Stock Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alert</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.low_stock_count}</div>
            )}
            <p className="text-xs text-muted-foreground pt-1">Products with low stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Stats Scrollable Component */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Daily Performance</h3>
          <p className="text-sm text-muted-foreground">Click on any card to view detailed transactions</p>
        </div>

        {/* Set a fixed width to the container and enable horizontal scrolling */}
        <div className="w-[1000px] overflow-x-auto">  {/* Fixed width and scrollable */}
          <div className="flex gap-4 pb-4 whitespace-nowrap">  {/* Prevent wrapping */}
            {loading
              ? // Loading skeletons
              Array.from({ length: 7 }).map((_, i) => (
                <Card key={i} className="min-w-[280px]">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))
              : dailyStats.map((dayData) => <DailyStatsCard key={dayData.date} dayData={dayData} />)}
          </div>
        </div>
      </div>



      <Tabs defaultValue="week" onValueChange={(v) => fetchSalesByPeriod(v as "week" | "month")}>
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
              <CardDescription>Sales and profit over the last 7 days</CardDescription>
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
                        const d = new Date(date)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value)]}
                      labelFormatter={(label) => {
                        const d = new Date(label)
                        return d.toLocaleDateString()
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
              <CardDescription>Sales and profit over the last 30 days</CardDescription>
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
                        const d = new Date(date)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                      interval={5}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value)]}
                      labelFormatter={(label) => {
                        const d = new Date(label)
                        return d.toLocaleDateString()
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
  )
}
