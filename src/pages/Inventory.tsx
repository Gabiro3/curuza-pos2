import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerWithRange } from '@/components/date-range-picker';
import { CalendarIcon, Search, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { DateRange } from 'react-day-picker';

interface InventoryTransaction {
    id: string;
    product_id: string;
    quantity: number;
    transaction_type: 'in' | 'out';
    transaction_date: string;
    notes: string;
    created_by: string;
    product: {
        name: string;
        purchase_price: number;
        sale_price: number;
        current_stock: number;
    };
    users: {
        email: string;
    };
}

export default function InventoryPage() {
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<InventoryTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [transactionType, setTransactionType] = useState<string | undefined>(undefined);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<string>('transaction_date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const itemsPerPage = 15;

    const navigate = useNavigate();

    useEffect(() => {
        fetchInventoryTransactions();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchTerm, transactionType, dateRange, transactions, sortField, sortDirection]);

    const fetchInventoryTransactions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory_transactions')
                .select(`
          *,
          product:product_id (
            name,
            purchase_price,
            sale_price,
            current_stock
          ),
          users:created_by (email)
        `)
                .eq('created_by', user?.id)
                .order('transaction_date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (error) {
            console.error('Error fetching inventory transactions:', error);
            toast.error('Failed to fetch inventory transactions. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...transactions];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(
                (transaction) =>
                    transaction.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    transaction.notes.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply transaction type filter
        if (transactionType) {
            filtered = filtered.filter(
                (transaction) => transaction.transaction_type === transactionType
            );
        }

        // Apply date range filter
        if (dateRange?.from && dateRange?.to) {
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);

            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);

            filtered = filtered.filter((transaction) => {
                const transactionDate = new Date(transaction.transaction_date);
                return transactionDate >= fromDate && transactionDate <= toDate;
            });
        }

        // Apply sorting
        filtered = filtered.sort((a, b) => {
            let aValue, bValue;

            if (sortField === 'product_name') {
                aValue = a.product?.name || '';
                bValue = b.product?.name || '';
            } else if (sortField === 'transaction_date') {
                aValue = new Date(a.transaction_date).getTime();
                bValue = new Date(b.transaction_date).getTime();
            } else if (sortField === 'quantity') {
                aValue = a.quantity;
                bValue = b.quantity;
            } else {
                aValue = a[sortField as keyof InventoryTransaction];
                bValue = b[sortField as keyof InventoryTransaction];
            }

            if (typeof aValue === 'string') {
                if (sortDirection === 'asc') {
                    return aValue.localeCompare(bValue as string);
                } else {
                    return (bValue as string).localeCompare(aValue);
                }
            } else {
                if (sortDirection === 'asc') {
                    return (aValue as number) - (bValue as number);
                } else {
                    return (bValue as number) - (aValue as number);
                }
            }
        });

        setFilteredTransactions(filtered);
        setCurrentPage(1); // Reset to first page when filters change
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleProductClick = (productId: string) => {
        navigate(`/product-metrics/${productId}`);
    };

    const resetFilters = () => {
        setSearchTerm('');
        setTransactionType(undefined);
        setDateRange(undefined);
        setSortField('transaction_date');
        setSortDirection('desc');
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

    // Pagination logic
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const paginatedTransactions = filteredTransactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const SortableHeader = ({ field, label }: { field: string, label: string }) => {
        const isCurrent = sortField === field;
        return (
            <TableHead className="cursor-pointer" onClick={() => handleSort(field)}>
                <div className="flex items-center">
                    {label}
                    <ArrowUpDown className={`ml-1 h-4 w-4 ${isCurrent ? 'opacity-100' : 'opacity-50'}`} />
                </div>
            </TableHead>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Inventory History</h2>
                <p className="text-muted-foreground">
                    Track all inventory movements for your products
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Filter inventory transactions by various criteria</CardDescription>
                    <div className="grid gap-4 md:grid-cols-4 mt-4">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by product name or notes"
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={transactionType} onValueChange={setTransactionType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Transaction Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Transaction Type</SelectLabel>
                                    <SelectItem value="in">Stock In</SelectItem>
                                    <SelectItem value="out">Stock Out</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <DatePickerWithRange
                            date={dateRange}
                            onDateChange={setDateRange}
                            className="w-full"
                        />
                        <div className="flex space-x-2">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={resetFilters}
                            >
                                Reset Filters
                            </Button>
                        </div>
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
                                            <SortableHeader field="transaction_date" label="Date" />
                                            <SortableHeader field="product_name" label="Product" />
                                            <SortableHeader field="transaction_type" label="Type" />
                                            <SortableHeader field="quantity" label="Quantity" />
                                            <TableHead className="hidden md:table-cell">Notes</TableHead>
                                            <TableHead className="hidden lg:table-cell">Recorded By</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedTransactions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                                    No transactions found matching your filters.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedTransactions.map((transaction) => (
                                                <TableRow key={transaction.id}>
                                                    <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="link"
                                                            className="p-0 h-auto font-medium text-left"
                                                            onClick={() => handleProductClick(transaction.product_id)}
                                                        >
                                                            {transaction.product?.name || 'Unknown Product'}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={transaction.transaction_type === 'in' ? 'default' : 'secondary'}>
                                                            {transaction.transaction_type === 'in' ? 'Stock In' : 'Stock Out'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{transaction.quantity}</TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        {transaction.notes || '-'}
                                                    </TableCell>
                                                    <TableCell className="hidden lg:table-cell">
                                                        {transaction.users?.email || '-'}
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
        </div>
    );
}