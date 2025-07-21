export interface Product {
  id: string;
  name: string;
  purchase_price: number;
  sale_price: number;
  current_stock: number;
  additional_costs?: AdditionalCost[];
  created_at: string;
  updated_at: string;
}

export interface AdditionalCost {
  title: string;
  price: number;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  transaction_type: "in" | "out";
  transaction_date: string;
  notes: string;
  created_by: string;
}

export interface Customer {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  price: number;
  discount: number;
}

export interface Sale {
  id: string;
  customer_id: string;
  customer?: Customer;
  customer_name: string;
  sale_date: string;
  total_amount: number;
  discount_amount: number;
  payment_method: "cash" | "card" | "transfer" | "other";
  payment_status: "paid" | "pending" | "partial";
  notes: string;
  created_by: string;
  created_at: string;
  items: SaleItem[];
}

export interface DashboardStats {
  total_sales: number;
  total_profit: number;
  total_products: number;
  low_stock_count: number;
}

export interface ReportPeriod {
  start_date: string;
  end_date: string;
}

export interface SalesByPeriod {
  date: string;
  total: number;
  profit: number;
}
