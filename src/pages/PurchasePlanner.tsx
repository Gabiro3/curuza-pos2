"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Product } from "@/types"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, CalendarIcon, Check, Plus, Edit, Trash } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format, addDays } from "date-fns"

interface PurchasePlan {
    id: string
    name: string
    created_at: string
    planned_date: string
    status: "draft" | "scheduled" | "completed" | "cancelled"
    notes: string
    created_by: string
    total_cost: number
}

interface PurchasePlanItem {
    id: string
    purchase_plan_id: string
    product_id?: string
    prod_name: string
    quantity: number
    unit_price: number
    product?: Product
}

const planSchema = z.object({
    name: z.string().min(3, { message: "Plan name must be at least 3 characters" }),
    planned_date: z.date({
        required_error: "Please select a date",
    }),
    notes: z.string().optional(),
})

const planItemSchema = z.object({
    product_id: z.string().optional(),
    prod_name: z.string().min(1, { message: "Product name is required" }),
    quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Quantity must be a positive number",
    }),
    unit_price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Purchase Price must be a positive number",
    }),
})

type PlanFormValues = z.infer<typeof planSchema>
type PlanItemFormValues = z.infer<typeof planItemSchema>

export default function PurchasePlannerPage() {
    const [plans, setPlans] = useState<PurchasePlan[]>([])
    const [currentPlan, setCurrentPlan] = useState<PurchasePlan | null>(null)
    const [planItems, setPlanItems] = useState<PurchasePlanItem[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isPlanFormDialogOpen, setIsPlanFormDialogOpen] = useState(false)
    const [isEditingPlan, setIsEditingPlan] = useState(false)

    const { toast } = useToast()
    const { user } = useAuth()

    const form = useForm<PlanFormValues>({
        resolver: zodResolver(planSchema),
        defaultValues: {
            name: "",
            notes: "",
        },
    })

    const itemForm = useForm<PlanItemFormValues>({
        resolver: zodResolver(planItemSchema),
        defaultValues: {
            product_id: "",
            prod_name: "",
            quantity: "",
            unit_price: "",
        },
    })

    useEffect(() => {
        fetchPlans()
        fetchProducts()
    }, [])

    const fetchPlans = async () => {
        try {
            const { data, error } = await supabase
                .from("purchase_plans")
                .select("*")
                .eq("created_by", user.id)
                .order("created_at", { ascending: false })

            if (error) throw error
            setPlans(data || [])
        } catch (error) {
            console.error("Error fetching plans:", error)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch purchase plans.",
            })
        } finally {
            setLoading(false)
        }
    }

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase.from("products").select("*").eq("created_by", user.id).order("name")

            if (error) throw error
            setProducts(data || [])
        } catch (error) {
            console.error("Error fetching products:", error)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch products.",
            })
        }
    }

    const fetchPlanItems = async (planId: string) => {
        try {
            const { data, error } = await supabase
                .from("purchase_plan_items")
                .select(`
                *,
                product:product_id(id, name) 
            `)
                .eq("purchase_plan_id", planId)

            if (error) throw error

            // If product_id is null, use prod_name from the product relationship
            const modifiedData = data?.map(item => ({
                ...item,
                prod_name: item.product_id ? item.product.name : item.prod_name // Fallback if product_id is null
            }));

            setPlanItems(modifiedData || [])
        } catch (error) {
            console.error("Error fetching plan items:", error)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch purchase plan items.",
            })
        }
    }


    const handlePlanSubmit = async (data: PlanFormValues) => {
        try {
            const newPlan = {
                name: data.name,
                planned_date: data.planned_date.toISOString(),
                status: "draft" as const,
                notes: data.notes || "",
                created_by: user?.id,
                total_cost: 0,
            }

            let result
            if (isEditingPlan && currentPlan) {
                const { data: updatedPlan, error } = await supabase
                    .from("purchase_plans")
                    .update({
                        name: newPlan.name,
                        planned_date: newPlan.planned_date,
                        notes: newPlan.notes,
                    })
                    .eq("id", currentPlan.id)
                    .select()
                    .single()

                if (error) throw error
                result = updatedPlan
                toast({
                    title: "Success",
                    description: "Purchase plan updated successfully",
                })
            } else {
                const { data: createdPlan, error } = await supabase.from("purchase_plans").insert([newPlan]).select().single()

                if (error) throw error
                result = createdPlan
                toast({
                    title: "Success",
                    description: "Purchase plan created successfully",
                })
            }

            setIsPlanFormDialogOpen(false)
            fetchPlans()
            setCurrentPlan(result)
            fetchPlanItems(result.id)
        } catch (error) {
            console.error("Error saving plan:", error)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save purchase plan.",
            })
        }
    }

    const handlePlanItemSubmit = async (data: PlanItemFormValues) => {
        if (!currentPlan) return

        try {
            const newItem = {
                purchase_plan_id: currentPlan.id,
                product_id: data.product_id || null,
                prod_name: data.prod_name,
                quantity: Number.parseInt(data.quantity),
                unit_price: Number.parseFloat(data.unit_price),
                created_by: user.id,
            }

            const { error } = await supabase.from("purchase_plan_items").insert([newItem])

            if (error) throw error

            // Update the plan's total cost
            const totalCost =
                planItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) +
                Number.parseInt(data.quantity) * Number.parseFloat(data.unit_price)

            await supabase.from("purchase_plans").update({ total_cost: totalCost }).eq("id", currentPlan.id)

            // Re-fetch the updated plan
            const { data: updatedPlan } = await supabase.from("purchase_plans").select("*").eq("id", currentPlan.id).single()

            if (updatedPlan) {
                setCurrentPlan(updatedPlan)
            }

            toast({
                title: "Success",
                description: "Item added to purchase plan",
            })

            itemForm.reset()
            setIsDialogOpen(false)
            fetchPlanItems(currentPlan.id)
            fetchPlans()
        } catch (error) {
            console.error("Error adding plan item:", error)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to add item to purchase plan.",
            })
        }
    }

    const handleDeleteItem = async (itemId: string) => {
        if (!currentPlan) return

        try {
            const itemToDelete = planItems.find((item) => item.id === itemId)
            if (!itemToDelete) return

            const { error } = await supabase.from("purchase_plan_items").delete().eq("id", itemId)

            if (error) throw error

            // Update the plan's total cost
            const newTotalCost = planItems.reduce(
                (sum, item) => (item.id === itemId ? sum : sum + item.quantity * item.unit_price),
                0,
            )

            await supabase.from("purchase_plans").update({ total_cost: newTotalCost }).eq("id", currentPlan.id)

            toast({
                title: "Success",
                description: "Item removed from purchase plan",
            })

            fetchPlanItems(currentPlan.id)
            fetchPlans()
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete item from purchase plan.",
            })
        }
    }

    const updatePlanStatus = async (status: "draft" | "scheduled" | "completed" | "cancelled") => {
        if (!currentPlan) return

        try {
            const { error } = await supabase.from("purchase_plans").update({ status }).eq("id", currentPlan.id)

            if (error) throw error

            toast({
                title: "Success",
                description: `Purchase plan marked as ${status}`,
            })

            fetchPlans()

            // If completing a plan, update inventory
            if (status === "completed") {
                for (const item of planItems) {
                    // Update product stock
                    await supabase
                        .from("products")
                        .update({
                            current_stock: item.product.current_stock + item.quantity,
                        })
                        .eq("id", item.product_id)

                    // Create inventory transaction
                    await supabase.from("inventory_transactions").insert([
                        {
                            product_id: item.product_id,
                            quantity: item.quantity,
                            transaction_type: "in",
                            transaction_date: new Date().toISOString(),
                            notes: `Purchase from plan: ${currentPlan.name}`,
                            created_by: user?.id,
                        },
                    ])
                }
            }

            // Refresh the current plan
            const { data: updatedPlan } = await supabase.from("purchase_plans").select().eq("id", currentPlan.id).single()

            setCurrentPlan(updatedPlan)
        } catch (error) {
            console.error("Error updating plan status:", error)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update purchase plan status.",
            })
        }
    }

    const handleCreatePlan = () => {
        setIsEditingPlan(false)
        form.reset({
            name: "",
            planned_date: addDays(new Date(), 7),
            notes: "",
        })
        setIsPlanFormDialogOpen(true)
    }

    const handleEditPlan = () => {
        if (!currentPlan) return

        setIsEditingPlan(true)
        form.reset({
            name: currentPlan.name,
            planned_date: new Date(currentPlan.planned_date),
            notes: currentPlan.notes,
        })
        setIsPlanFormDialogOpen(true)
    }

    const handleAddItem = () => {
        itemForm.reset({
            product_id: "",
            prod_name: "",
            quantity: "",
            unit_price: "",
        })
        setIsDialogOpen(true)
    }
    const handleDeletePlan = async () => {
        if (!currentPlan) return

        try {
            const { error } = await supabase.from("purchase_plans").delete().eq("id", currentPlan.id)

            if (error) throw error

            toast({
                title: "Deleted",
                description: "Purchase plan deleted successfully",
            })

            setCurrentPlan(null)
            fetchPlans()
            setShowDeleteDialog(false)
        } catch (error) {
            console.error("Failed to delete purchase plan:", error)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete the plan. Please try again.",
            })
        }
    }

    const handleProductSelection = (productId: string) => {
        const product = products.find((p) => p.id === productId)
        if (product) {
            itemForm.setValue("unit_price", product.purchase_price.toString())
            itemForm.setValue("prod_name", product.name)
        }
    }

    const handleSelectPlan = (plan: PurchasePlan) => {
        setCurrentPlan(plan)
        fetchPlanItems(plan.id)
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "RWF",
        }).format(value)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "draft":
                return (
                    <Badge variant="outline" className="ml-2 text-blue">
                        Draft
                    </Badge>
                )
            case "scheduled":
                return (
                    <Badge variant="secondary" className="ml-2">
                        Scheduled
                    </Badge>
                )
            case "completed":
                return (
                    <Badge variant="default" className="ml-2">
                        Completed
                    </Badge>
                )
            case "cancelled":
                return (
                    <Badge variant="destructive" className="ml-2">
                        Cancelled
                    </Badge>
                )
            default:
                return <Badge className="ml-2">{status}</Badge>
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Purchase Planner</h2>
                    <p className="text-muted-foreground">Create and manage purchase plans for your inventory</p>
                </div>
                <Button onClick={handleCreatePlan}>
                    <Plus className="mr-2 h-4 w-4" /> Create New Plan
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Purchase Plans</CardTitle>
                        <CardDescription>Select a plan to view or edit its details</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-2">
                                {Array(3)
                                    .fill(null)
                                    .map((_, i) => (
                                        <Button
                                            key={i}
                                            variant="outline"
                                            className="w-full justify-start text-left h-16 bg-transparent"
                                            disabled
                                        >
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                        </Button>
                                    ))}
                            </div>
                        ) : plans.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                                <p>No purchase plans found.</p>
                                <p className="text-sm">Create your first plan to get started.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {plans.map((plan) => (
                                    <Button
                                        key={plan.id}
                                        variant={currentPlan?.id === plan.id ? "default" : "outline"}
                                        className="w-full justify-start text-left h-auto py-3 px-4"
                                        onClick={() => handleSelectPlan(plan)}
                                    >
                                        <div className="flex flex-col items-start">
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-medium">{plan.name}</span>
                                                {getStatusBadge(plan.status)}
                                            </div>
                                            <span className="text-xs text-muted-foreground mt-1">{formatDate(plan.planned_date)}</span>
                                            <span className="text-xs font-medium mt-1">{formatCurrency(plan.total_cost)}</span>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div>
                    {currentPlan ? (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <CardTitle>{currentPlan.name}</CardTitle>
                                            {getStatusBadge(currentPlan.status)}
                                        </div>
                                        <CardDescription>Planned for {formatDate(currentPlan.planned_date)}</CardDescription>
                                    </div>
                                    {currentPlan.status === "draft" && (
                                        <div className="flex items-center space-x-2">
                                            <Button variant="outline" size="sm" onClick={handleEditPlan}>
                                                <Edit className="h-4 w-4 mr-2" /> Edit Plan
                                            </Button>
                                            <Button variant="default" size="sm" onClick={() => updatePlanStatus("scheduled")}>
                                                <CalendarIcon className="h-4 w-4 mr-2" /> Schedule
                                            </Button>
                                        </div>
                                    )}
                                    {currentPlan.status === "scheduled" && (
                                        <div className="flex items-center space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => updatePlanStatus("draft")}>
                                                Move to Draft
                                            </Button>
                                            <Button variant="default" size="sm" onClick={() => updatePlanStatus("completed")}>
                                                <Check className="h-4 w-4 mr-2" /> Mark as Completed
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => updatePlanStatus("cancelled")}>
                                                Cancel
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)}>
                                    <Trash className="h-5 w-5 text-destructive" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {currentPlan.notes && (
                                    <div className="mb-6">
                                        <h3 className="text-sm font-medium mb-2">Notes:</h3>
                                        <p className="text-sm text-muted-foreground">{currentPlan.notes}</p>
                                    </div>
                                )}

                                <h3 className="text-lg font-medium mb-4">Items to Purchase</h3>

                                {planItems.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground border rounded-md">
                                        <p>No items added to this purchase plan yet.</p>
                                        {currentPlan.status === "draft" && (
                                            <Button variant="link" onClick={handleAddItem}>
                                                Add your first item
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Product</TableHead>
                                                    <TableHead>Quantity</TableHead>
                                                    <TableHead>Allocated Budget</TableHead>
                                                    <TableHead>Total</TableHead>
                                                    {currentPlan.status === "draft" && <TableHead className="w-[100px]">Actions</TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {planItems.map((item) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="font-medium">
                                                            {item.prod_name || item.product?.name || "Unknown Product"}
                                                        </TableCell>
                                                        <TableCell>{item.quantity}</TableCell>
                                                        <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                                                        <TableCell>{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                                                        {currentPlan.status === "draft" && (
                                                            <TableCell>
                                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}>
                                                                    <Trash className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                ))}
                                                <TableRow>
                                                    <TableCell colSpan={2}></TableCell>
                                                    <TableCell className="font-medium">Total</TableCell>
                                                    <TableCell className="font-bold">{formatCurrency(currentPlan.total_cost)}</TableCell>
                                                    {currentPlan.status === "draft" && <TableCell></TableCell>}
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}

                                {currentPlan.status === "draft" && (
                                    <Button className="mt-4" onClick={handleAddItem}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Item
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="flex items-center justify-center min-h-[400px]">
                                <div className="text-center">
                                    <h3 className="font-medium text-lg">No Purchase Plan Selected</h3>
                                    <p className="text-muted-foreground">Select an existing plan from the sidebar or create a new one</p>
                                    <Button className="mt-4" onClick={handleCreatePlan}>
                                        <Plus className="mr-2 h-4 w-4" /> Create New Plan
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Create/Edit Plan Dialog */}
            <Dialog open={isPlanFormDialogOpen} onOpenChange={setIsPlanFormDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditingPlan ? "Edit Purchase Plan" : "Create Purchase Plan"}</DialogTitle>
                        <DialogDescription>
                            {isEditingPlan
                                ? "Update the details for this purchase plan"
                                : "Enter the details to create a new purchase plan"}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handlePlanSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Plan Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Monthly Restock" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="planned_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Planned Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                                    >
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date < new Date()}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Any additional information about this purchase plan" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="submit">
                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isEditingPlan ? "Update Plan" : "Create Plan"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Add Item Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Item to Purchase Plan</DialogTitle>
                        <DialogDescription>Select a product and specify quantity to add to the plan</DialogDescription>
                    </DialogHeader>
                    <Form {...itemForm}>
                        <form onSubmit={itemForm.handleSubmit(handlePlanItemSubmit)} className="space-y-4">
                            <FormField
                                control={itemForm.control}
                                name="product_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Select Existing Product (Optional)</FormLabel>
                                        <Select
                                            onValueChange={(value) => {
                                                field.onChange(value)
                                                handleProductSelection(value)
                                            }}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a product or leave empty to enter manually" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {products.map((product) => (
                                                    <SelectItem key={product.id} value={product.id}>
                                                        {product.name} (Current Stock: {product.current_stock})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Select an existing product to auto-fill details, or leave empty to enter manually
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={itemForm.control}
                                name="prod_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Product Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter product name" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            This will be automatically filled if you select an existing product above
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={itemForm.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="10" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={itemForm.control}
                                name="unit_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Allocated Budget</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Default value is the current purchase price if you selected an existing product
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="submit">
                                    {itemForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Item
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete this purchase plan?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. All items within this plan will be permanently removed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button className="bg-destructive hover:bg-destructive/90" onClick={handleDeletePlan}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
