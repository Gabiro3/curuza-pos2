import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  profit: number; // Assuming profit is part of the item
  discount: number;
  products: {
    name: string;
    purchase_price: number;
  };
}

interface SaleDetails {
  id: string;
  customer_name: string;
  total_amount: number;
  discount_amount: number;
  payment_method: string;
  payment_status: string;
  notes: string;
  sale_date: string;
  users: {
    email: string;
  };
  items: SaleItem[];
}

interface SaleDetailsProps {
  saleId: string | null;
}

export function SaleDetails({ saleId }: SaleDetailsProps) {
  const [sale, setSale] = useState<SaleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!saleId) return;

    const fetchSaleDetails = async () => {
      setLoading(true);
      try {
        // Fetch sale details
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .select(`
            *,
            users:created_by (email)
          `)
          .eq('id', saleId)
          .single();

        if (saleError) throw saleError;

        // Fetch sale items with product details
        const { data: itemsData, error: itemsError } = await supabase
          .from('sale_items')
          .select(`
            *,
            products:product_id (name, purchase_price)
          `)
          .eq('sale_id', saleId);

        if (itemsError) throw itemsError;

        // Combine the data
        setSale({
          ...saleData as any,
          items: itemsData as SaleItem[] || [],
        });
      } catch (error) {
        console.error('Error fetching sale details:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load sale details.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSaleDetails();
  }, [saleId, toast]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'RWF',
    }).format(value);
  };

  const calculateItemTotal = (price: number, quantity: number, discount: number) => {
    return (price * quantity) - discount;
  };

  const calculateProfit = (salePrice: number, purchasePrice: number, quantity: number) => {
    return (salePrice - purchasePrice) * quantity;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <div className="space-y-2">
          {Array(5).fill(null).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!sale) {
    return <div>Sale not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Sale Date</p>
          <p>{formatDate(sale.sale_date)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Customer</p>
          <p>{sale.customer_name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
          <p className="capitalize">{sale.payment_method}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
          <Badge variant={
            sale.payment_status === 'paid' ? 'default' :
              sale.payment_status === 'partial' ? 'outline' : 'secondary'
          }>
            {sale.payment_status}
          </Badge>
        </div>
      </div>

      {sale.notes && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Notes</p>
          <p className="text-sm">{sale.notes}</p>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium mb-2">Sale Items</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.products.name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.profit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.discount)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(calculateItemTotal(item.price, item.quantity, item.discount))}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3}></TableCell>
                <TableCell className="text-right font-medium">Subtotal</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(sale.total_amount + sale.discount_amount)}
                </TableCell>
              </TableRow>
              {sale.discount_amount > 0 && (
                <TableRow>
                  <TableCell colSpan={3}></TableCell>
                  <TableCell className="text-right font-medium">Discount</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(sale.discount_amount)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={3}></TableCell>
                <TableCell className="text-right font-medium text-lg">Total</TableCell>
                <TableCell className="text-right font-medium text-lg">
                  {formatCurrency(sale.total_amount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Profit information - only show to admin users */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between">
          <p className="text-sm text-muted-foreground">Recorded by: {sale.users?.email || 'Unknown'}</p>
          <p className="text-sm text-muted-foreground">Receipt ID: #{sale.id.substring(0, 8).toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
}