export type OrderStatus = 'PENDING' | 'COOKING' | 'DONE' | 'CANCELLED';
export type ProductCategory = 'DOUGH' | 'TOPPING';
export type PaymentMethod = 'CASH' | 'QR';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  price: number;
  unitCost: number; // cost of one unit (e.g. a bag of flour)
  crepesPerUnit: number; // how many crepes one unit makes
  costPrice: number; // derived per-crepe cost = unitCost / crepesPerUnit
  stockQuantity: number;
  alertThreshold: number;
  deductionAmount: number;
  alertSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemTopping {
  id: number;
  orderItemId: number;
  productId: number;
  product: Product;
}

export interface OrderItem {
  id: number;
  orderId: number;
  baseDoughId: number;
  baseDough: Product;
  toppings: OrderItemTopping[];
}

export interface Order {
  id: number;
  queueNumber: number;
  totalPrice: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  branchId: number | null;
  pushEndpoint: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
