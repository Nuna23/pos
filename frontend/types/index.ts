export type OrderStatus = 'PENDING' | 'COOKING' | 'DONE' | 'CANCELLED';
export type ProductCategory = 'DOUGH' | 'TOPPING';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  price: number;
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
  pushEndpoint: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
