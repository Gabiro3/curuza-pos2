import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Product } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface InventoryTransaction {
    id: string;
    product_id: string;
    quantity: number;
    transaction_type: 'in' | 'out';
    transaction_date: string;
    notes: string;
    created_by: string;
    users: {
        email: string;
    };
}

interface SaleItem {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    price: number;
    created_at: string;
    sales: {
        id: string;
        customer_name: string;
        sale_date: string;
        total_amount: number;
        payment_method: string;
    };
}

export function ProductHistory({ productId }: { productId: string | null }) {
    const [product, setProduct] = useState<Product | null>(null);
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [sales, setSales] = useState<SaleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (!productId) return;

        const fetchProductHistory = async () => {
            setLoading(true);
            try {
                // Fetch product details
                const { data: productData, error: productError } = await supabase
                    .from('products')
                    .select('*')
                    .eq('id', productId)
                    .single();

                if (productError) throw productError;
                setProduct(productData);

                // Fetch inventory transactions
                const { data: transactionsData, error: transactionsError } = await supabase
                    .from('inventory_transactions')
                    .select(`*`)
                    .eq('product_id', productId)
                    .order('transaction_date', { ascending: false });

                if (transactionsError) throw transactionsError;
                setTransactions(transactionsData || []);

                // Fetch sales containing this product
                const { data: salesData, error: salesError } = await supabase
                    .from('sale_items')
                    .select(`
            *,
            sales:sale_id (id, customer_name, sale_date, total_amount, payment_method)
          `)
                    .eq('product_id', productId)
                    .order('created_at', { ascending: false });

                if (salesError) throw salesError;
                setSales(salesData || []);

            } catch (error) {
                console.error('Error fetching product history:', error);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Failed to load product history.',
                });
            } finally {
                setLoading(false);
            }
        };

        fetchProductHistory();
    }, [productId, toast]);

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

    if (!product) {
        return <div>Product not found</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">{product.name}</h3>
                <div className="mt-2 grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Purchase Price</p>
                        <p className="font-medium">{formatCurrency(product.purchase_price)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Sale Price</p>
                        <p className="font-medium">{formatCurrency(product.sale_price)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Current Stock</p>
                        <p className="font-medium">{product.current_stock}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <h4 className="font-medium">Inventory Transactions</h4>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead className="hidden md:table-cell">Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4">
                                        No inventory transactions found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((transaction) => (
                                    <TableRow key={transaction.id}>
                                        <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                                        <TableCell>
                                            <Badge variant={transaction.transaction_type === 'in' ? 'default' : 'secondary'}>
                                                {transaction.transaction_type === 'in' ? 'Stock In' : 'Stock Out'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{transaction.quantity}</TableCell>
                                        <TableCell className="hidden md:table-cell">{transaction.notes}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="space-y-2">
                <h4 className="font-medium">Sales History</h4>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Sale Price</TableHead>
                                <TableHead>Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sales.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4">
                                        No sales history found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sales.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell>{formatDate(sale.sales.sale_date)}</TableCell>
                                        <TableCell>{sale.sales.customer_name}</TableCell>
                                        <TableCell>{sale.quantity}</TableCell>
                                        <TableCell>{formatCurrency(sale.price)}</TableCell>
                                        <TableCell>{formatCurrency(sale.quantity * sale.price)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}