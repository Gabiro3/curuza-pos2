"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import type { Product } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Loader2, Search, Eye, Edit, Trash2, RotateCcw, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductHistory } from "@/components/products/product-history"
import { Separator } from "@/components/ui/separator"

const additionalCostSchema = z.object({
  title: z.string().min(1, { message: "Cost title is required" }),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Price must be a non-negative number",
  }),
})

const productSchema = z.object({
  name: z.string().min(2, { message: "Product name must be at least 2 characters" }),
  purchase_price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Purchase price must be a positive number",
  }),
  sale_price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Sale price must be a positive number",
  }),
  current_stock: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Stock quantity must be a non-negative number",
  }),
  additional_costs: z.array(additionalCostSchema).optional(),
})

const refillStockSchema = z.object({
  quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Quantity must be a positive number",
  }),
  notes: z.string().optional(),
})

type ProductFormValues = z.infer<typeof productSchema>
type RefillStockFormValues = z.infer<typeof refillStockSchema>

interface InventoryTransaction {
  id: string
  product_id: string
  quantity: number
  transaction_type: "in" | "out"
  transaction_date: string
  notes: string
  created_by: string
  users: {
    email: string
  }
}

interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  price: number
  created_at: string
  sales: {
    id: string
    customer_name: string
    sale_date: string
    total_amount: number
    payment_method: string
  }
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [viewProductId, setViewProductId] = useState<string | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [refillDialogOpen, setRefillDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [refillProduct, setRefillProduct] = useState<Product | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  const { toast } = useToast()
  const { user } = useAuth()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      purchase_price: "",
      sale_price: "",
      current_stock: "0",
      additional_costs: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "additional_costs",
  })

  const editForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      purchase_price: "",
      sale_price: "",
      current_stock: "0",
      additional_costs: [],
    },
  })

  const {
    fields: editFields,
    append: editAppend,
    remove: editRemove,
  } = useFieldArray({
    control: editForm.control,
    name: "additional_costs",
  })

  const refillForm = useForm<RefillStockFormValues>({
    resolver: zodResolver(refillStockSchema),
    defaultValues: {
      quantity: "",
      notes: "",
    },
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (editingProduct) {
      editForm.reset({
        name: editingProduct.name,
        purchase_price: editingProduct.purchase_price.toString(),
        sale_price: editingProduct.sale_price.toString(),
        current_stock: editingProduct.current_stock.toString(),
        additional_costs: editingProduct.additional_costs
          ? editingProduct.additional_costs.map(cost => ({
            title: cost.title,
            price: cost.price !== undefined ? cost.price.toString() : "",
          }))
          : [],
      })
    }
  }, [editingProduct, editForm])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from("products").select("*").eq('created_by', user?.id).order("name")

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error("Error fetching products:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch products. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: ProductFormValues) => {
    try {
      const additionalCosts =
        data.additional_costs?.map((cost) => ({
          title: cost.title,
          price: Number.parseFloat(cost.price),
        })) || []

      const newProduct = {
        name: data.name,
        purchase_price: Number.parseFloat(data.purchase_price),
        sale_price: Number.parseFloat(data.sale_price),
        current_stock: Number.parseInt(data.current_stock),
        additional_costs: additionalCosts,
        created_by: user?.id,
      }

      const { error } = await supabase.from("products").insert([newProduct])

      if (error) throw error

      // Create an inventory transaction for the initial stock if greater than 0
      if (Number.parseInt(data.current_stock) > 0) {
        const { data: productData } = await supabase.from("products").select("id").eq("name", data.name).single()

        const { error: transactionError } = await supabase.from("inventory_transactions").insert([
          {
            product_id: productData.id,
            quantity: Number.parseInt(data.current_stock),
            transaction_type: "in",
            transaction_date: new Date().toISOString(),
            notes: "Initial stock",
            created_by: user?.id,
          },
        ])

        if (transactionError) throw transactionError
      }

      toast({
        title: "Success",
        description: "Product added successfully",
      })

      form.reset()
      setDialogOpen(false)
      fetchProducts()
    } catch (error) {
      console.error("Error adding product:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add product. Please try again.",
      })
    }
  }

  const onEditSubmit = async (data: ProductFormValues) => {
    if (!editingProduct) return

    try {
      const additionalCosts =
        data.additional_costs?.map((cost) => ({
          title: cost.title,
          price: Number.parseFloat(cost.price),
        })) || []

      const updatedProduct = {
        name: data.name,
        purchase_price: Number.parseFloat(data.purchase_price),
        sale_price: Number.parseFloat(data.sale_price),
        current_stock: Number.parseInt(data.current_stock),
        additional_costs: additionalCosts,
      }

      // If stock has been adjusted during edit, create an inventory transaction
      const stockDifference = Number.parseInt(data.current_stock) - editingProduct.current_stock

      const { error } = await supabase.from("products").update(updatedProduct).eq("id", editingProduct.id)

      if (error) throw error

      // Record stock adjustment if needed
      if (stockDifference !== 0) {
        const transactionType = stockDifference > 0 ? "in" : "out"
        const { error: transactionError } = await supabase.from("inventory_transactions").insert([
          {
            product_id: editingProduct.id,
            quantity: Math.abs(stockDifference),
            transaction_type: transactionType,
            transaction_date: new Date().toISOString(),
            notes: "Stock adjustment during product edit",
            created_by: user?.id,
          },
        ])

        if (transactionError) throw transactionError
      }

      toast({
        title: "Success",
        description: "Product updated successfully",
      })

      setEditDialogOpen(false)
      fetchProducts()
    } catch (error) {
      console.error("Error updating product:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update product. Please try again.",
      })
    }
  }

  const onRefillSubmit = async (data: RefillStockFormValues) => {
    if (!refillProduct) return

    try {
      const quantity = Number.parseInt(data.quantity)

      // Update the product stock
      const { error: updateError } = await supabase
        .from("products")
        .update({
          current_stock: refillProduct.current_stock + quantity,
        })
        .eq("id", refillProduct.id)

      if (updateError) throw updateError

      // Create an inventory transaction
      const { error: transactionError } = await supabase.from("inventory_transactions").insert([
        {
          product_id: refillProduct.id,
          quantity: quantity,
          transaction_type: "in",
          transaction_date: new Date().toISOString(),
          notes: data.notes || "Stock refill",
          created_by: user?.id,
        },
      ])

      if (transactionError) throw transactionError

      toast({
        title: "Success",
        description: `Added ${quantity} units to ${refillProduct.name}`,
      })

      refillForm.reset()
      setRefillDialogOpen(false)
      fetchProducts()
    } catch (error) {
      console.error("Error refilling stock:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refill stock. Please try again.",
      })
    }
  }

  const onDeleteProduct = async () => {
    if (!productToDelete) return

    try {
      // First check if this product has any sales or inventory transactions
      const { count: saleCount, error: saleError } = await supabase
        .from("sale_items")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productToDelete.id)

      if (saleError) throw saleError

      if (saleCount && saleCount > 0) {
        toast({
          variant: "destructive",
          title: "Cannot Delete",
          description: "This product has sales records and cannot be deleted.",
        })
        setDeleteDialogOpen(false)
        return
      }

      // Delete inventory transactions first
      const { error: transactionError } = await supabase
        .from("inventory_transactions")
        .delete()
        .eq("product_id", productToDelete.id)

      if (transactionError) throw transactionError

      // Then delete the product
      const { error } = await supabase.from("products").delete().eq("id", productToDelete.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Product deleted successfully",
      })

      setDeleteDialogOpen(false)
      fetchProducts()
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete product. Please try again.",
      })
    }
  }

  const filteredProducts = searchTerm
    ? products.filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : products

  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "RWF",
    }).format(value)
  }

  const calculateTotalAdditionalCosts = (additionalCosts: any[]) => {
    if (!additionalCosts || additionalCosts.length === 0) return 0
    return additionalCosts.reduce((sum, cost) => sum + (cost.price || 0), 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">Manage your inventory and product catalog</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="sm:w-auto w-full">
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>Enter the product details below to add a new product to inventory.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter product name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchase_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sale_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="current_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Additional Costs</h4>
                      <p className="text-sm text-muted-foreground">
                        Add any additional costs associated with this product
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ title: "", price: "" })}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Cost
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-end">
                      <FormField
                        control={form.control}
                        name={`additional_costs.${index}.title`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Cost Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Shipping, Tax, etc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`additional_costs.${index}.price`}
                        render={({ field }) => (
                          <FormItem className="w-32">
                            <FormLabel>Price</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => remove(index)} className="mb-2">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Product
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array(5)
                .fill(null)
                .map((_, index) => (
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
                      <TableHead>Product Name</TableHead>
                      <TableHead className="hidden md:table-cell">Purchase Price</TableHead>
                      <TableHead>Sale Price</TableHead>
                      <TableHead className="hidden lg:table-cell">Additional Costs</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          {searchTerm
                            ? "No products found matching your search."
                            : "No products found. Add your first product!"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {formatCurrency(product.purchase_price)}
                          </TableCell>
                          <TableCell>{formatCurrency(product.sale_price)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {product.additional_costs && product.additional_costs.length > 0 ? (
                              <div className="space-y-1">
                                {product.additional_costs.slice(0, 2).map((cost: any, index: number) => (
                                  <div key={index} className="text-xs">
                                    {cost.title}: {formatCurrency(cost.price)}
                                  </div>
                                ))}
                                {product.additional_costs.length > 2 && (
                                  <div className="text-xs text-muted-foreground">
                                    +{product.additional_costs.length - 2} more
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {product.current_stock <= 10 ? (
                              <Badge variant="destructive">{product.current_stock}</Badge>
                            ) : (
                              product.current_stock
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setViewProductId(product.id)
                                    setTransactionDialogOpen(true)
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" /> View History
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRefillProduct(product)
                                    setRefillDialogOpen(true)
                                  }}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" /> Refill Stock
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingProduct(product)
                                    setEditDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" /> Edit Product
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setProductToDelete(product)
                                    setDeleteDialogOpen(true)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete Product
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                            if (currentPage > 1) {
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                          }}
                          aria-disabled={currentPage === 1}
                          tabIndex={currentPage === 1 ? -1 : 0}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>

                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber: number
                        if (totalPages <= 5) {
                          pageNumber = i + 1
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i
                        } else {
                          pageNumber = currentPage - 2 + i
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
                          )
                        }
                        return null
                      })}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => {
                            if (currentPage < totalPages) {
                              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                            }
                          }}
                          aria-disabled={currentPage === totalPages}
                          tabIndex={currentPage === totalPages ? -1 : 0}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
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

      {/* Product History Dialog */}
      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product History</DialogTitle>
            <DialogDescription>View inventory transactions and sales history for this product</DialogDescription>
          </DialogHeader>
          <ProductHistory productId={viewProductId} />
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the product details below.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="purchase_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="current_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Additional Costs</h4>
                    <p className="text-sm text-muted-foreground">
                      Add any additional costs associated with this product
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editAppend({ title: "", price: "" })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Cost
                  </Button>
                </div>

                {editFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-end">
                    <FormField
                      control={editForm.control}
                      name={`additional_costs.${index}.title`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Cost Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Shipping, Tax, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name={`additional_costs.${index}.price`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editRemove(index)}
                      className="mb-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Product
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Refill Stock Dialog */}
      <Dialog open={refillDialogOpen} onOpenChange={setRefillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refill Stock</DialogTitle>
            <DialogDescription>
              {refillProduct ? `Add stock to ${refillProduct.name}` : "Add stock to product"}
            </DialogDescription>
          </DialogHeader>
          <Form {...refillForm}>
            <form onSubmit={refillForm.handleSubmit(onRefillSubmit)} className="space-y-4">
              <FormField
                control={refillForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Add</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={refillForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter notes about this restocking" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRefillDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {refillForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Refill Stock
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {productToDelete
                ? `This will permanently delete ${productToDelete.name} from your inventory. This action cannot be undone.`
                : "This will permanently delete this product from your inventory. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
