import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Product, Sale } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Plus,
  Loader2,
  Search,
  Trash2,
  Calendar,
  Eye,
  ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { SaleDetails } from '@/components/sales/sale-details';

// Schema for sale form
const saleItemSchema = z.object({
  product_id: z.string({
    required_error: "Please select a product",
  }),
  price: z.number().positive({
    message: "Price must be a positive number",
  }),
  quantity: z.number().int().positive({
    message: "Quantity must be a positive integer",
  }),
  discount: z.number().min(0, {
    message: "Discount must be a non-negative number",
  }),
});

const saleSchema = z.object({
  customer_name: z.string().min(1, {
    message: "Customer name is required",
  }),
  items: z.array(saleItemSchema).min(1, {
    message: "At least one item is required",
  }),
  payment_method: z.enum(['cash', 'card', 'transfer', 'other'], {
    required_error: "Please select a payment method",
  }),
  payment_status: z.enum(['paid', 'pending', 'partial'], {
    required_error: "Please select a payment status",
  }),
  notes: z.string().optional(),
});

type SaleFormValues = z.infer<typeof saleSchema>;

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);
  const [saleDetailsDialogOpen, setSaleDetailsDialogOpen] = useState(false);
  const itemsPerPage = 10;

  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      customer_name: '',
      items: [{ product_id: '', price: 0, quantity: 1, discount: 0 }],
      payment_method: 'cash',
      payment_status: 'paid',
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    fetchSales();
    fetchProducts();
  }, [filterDate]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('*')
        .eq('created_by', user?.id)
        .order('sale_date', { ascending: false });

      // Apply date filter if set
      if (filterDate) {
        const startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(filterDate);
        endOfDay.setHours(23, 59, 59, 999);

        query = query
          .gte('sale_date', startOfDay.toISOString())
          .lte('sale_date', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch sales. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('created_by', user?.id)
        .order('name')
        .gt('current_stock', 0);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch products. Please try again.',
      });
    }
  };

  const handleProductChange = (index: number, value: string) => {
    const selectedProduct = products.find(p => p.id === value);
    if (selectedProduct) {
      form.setValue(`items.${index}.price`, selectedProduct.sale_price);
    }
  };

  const calculateItemTotal = (price: number, quantity: number, discount: number) => {
    return (price * quantity) - discount;
  };

  const calculateTotal = () => {
    const items = form.getValues('items');
    return items.reduce((total, item) => {
      return total + calculateItemTotal(
        item.price || 0,
        item.quantity || 0,
        item.discount || 0
      );
    }, 0);
  };

  const onSubmit = async (data: SaleFormValues) => {
    try {
      // Calculate total amount
      const totalAmount = data.items.reduce((total, item) => {
        return total + calculateItemTotal(item.price, item.quantity, item.discount);
      }, 0);

      // Calculate total discount
      const discountAmount = data.items.reduce((total, item) => {
        return total + (item.discount || 0);
      }, 0);

      // Create sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          customer_name: data.customer_name,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          payment_method: data.payment_method,
          payment_status: data.payment_status,
          notes: data.notes || '',
          created_by: user?.id,
          sale_date: new Date().toISOString(),
        }])
        .select('id')
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = data.items.map(item => ({
        sale_id: saleData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update product stock
      for (const item of data.items) {
        // Create inventory transaction (stock out)
        const { error: transactionError } = await supabase
          .from('inventory_transactions')
          .insert([{
            product_id: item.product_id,
            quantity: item.quantity,
            transaction_type: 'out',
            notes: `Sale: ${data.customer_name}`,
            created_by: user?.id,
          }]);

        if (transactionError) throw transactionError;

        // Update product stock
        const { error: stockError } = await supabase.rpc('decrease_stock', {
          p_id: item.product_id,
          p_quantity: item.quantity
        });

        if (stockError) throw stockError;
      }

      toast({
        title: 'Success',
        description: 'Sale recorded successfully',
      });

      form.reset({
        customer_name: '',
        items: [{ product_id: '', price: 0, quantity: 1, discount: 0 }],
        payment_method: 'cash',
        payment_status: 'paid',
        notes: '',
      });

      setDialogOpen(false);
      fetchSales();
      fetchProducts();
    } catch (error) {
      console.error('Error recording sale:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to record sale. Please try again.',
      });
    }
  };

  const filteredSales = searchTerm
    ? sales.filter(sale =>
      sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : sales;

  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'RWF',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sales</h2>
          <p className="text-muted-foreground">
            Record and manage your sales transactions
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="sm:w-auto w-full">
              <Plus className="mr-2 h-4 w-4" /> Record Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Sale</DialogTitle>
              <DialogDescription>
                Enter the sale details to record a new transaction.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Sale Items</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({
                        product_id: '',
                        price: 0,
                        quantity: 1,
                        discount: 0,
                      })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-col space-y-3 p-4 border rounded-md">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.product_id`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  handleProductChange(index, value);
                                }}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a product" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.name} (Stock: {product.current_stock})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  {...field}
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit Price</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  {...field}
                                  onChange={e => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.discount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount Amount</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  {...field}
                                  onChange={e => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="text-right text-sm font-medium">
                        Item Total: {formatCurrency(calculateItemTotal(
                          form.watch(`items.${index}.price`) || 0,
                          form.watch(`items.${index}.quantity`) || 0,
                          form.watch(`items.${index}.discount`) || 0
                        ))}
                      </div>
                    </div>
                  ))}
                  {form.formState.errors.items?.root && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.items.root.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="transfer">Bank Transfer</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any additional notes here"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="py-2 border-t">
                  <div className="text-right font-medium text-lg">
                    Total: {formatCurrency(calculateTotal())}
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {form.formState.isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Record Sale
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-start sm:justify-between gap-1">
                  <Calendar className="h-4 w-4" />
                  {filterDate ? format(filterDate, "PPP") : "Filter by date"}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={filterDate}
                  onSelect={setFilterDate}
                  initialFocus
                />
                {filterDate && (
                  <div className="flex items-center justify-center p-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => setFilterDate(undefined)}>
                      Clear filter
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array(5).fill(null).map((_, index) => (
                <div key={index} className="flex items-center space-x-4 py-2">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          {searchTerm || filterDate ? 'No sales found matching your search.' : 'No sales recorded yet.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{formatDate(sale.sale_date)}</TableCell>
                          <TableCell className="font-medium">{sale.customer_name}</TableCell>
                          <TableCell>{formatCurrency(sale.total_amount)}</TableCell>
                          <TableCell className="capitalize">{sale.payment_method}</TableCell>
                          <TableCell>
                            <Badge variant={
                              sale.payment_status === 'paid' ? 'default' :
                                sale.payment_status === 'partial' ? 'outline' : 'secondary'
                            }>
                              {sale.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setViewSaleId(sale.id);
                                setSaleDetailsDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View details</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => {
                            if (currentPage !== totalPages) {
                              setCurrentPage(prev => Math.min(totalPages, prev + 1));
                            }
                          }}
                          aria-disabled={currentPage === totalPages}
                          tabIndex={currentPage === totalPages ? -1 : 0}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber: number;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }

                        if (pageNumber > 0 && pageNumber <= totalPages) {
                          return (
                            <PaginationItem key={pageNumber}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNumber)}
                                isActive={pageNumber === currentPage}
                              >
                                {pageNumber}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => {
                            if (currentPage !== totalPages) {
                              setCurrentPage(prev => Math.min(totalPages, prev + 1));
                            }
                          }}
                          aria-disabled={currentPage === totalPages}
                          tabIndex={currentPage === totalPages ? -1 : 0}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={saleDetailsDialogOpen} onOpenChange={setSaleDetailsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <div className="h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sale Details</DialogTitle>
              <DialogDescription>
                View complete details of this sale transaction
              </DialogDescription>
            </DialogHeader>
            <SaleDetails saleId={viewSaleId} />
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}