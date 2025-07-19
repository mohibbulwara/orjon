
import type { Timestamp } from 'firebase/firestore';

export type DeliveryZone = 'inside-rangpur-city' | 'rangpur-division' | 'outside-rangpur';

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  productId: string;
  rating: number;
  comment: string;
  createdAt: Date | Timestamp;
}

export interface Product {
  id:string;
  name: string;
  images: string[]; // Changed from 'image' to 'images'
  description: string;
  category: 'Burger' | 'Pizza' | 'Drinks' | 'Dessert' | 'Biryani' | 'Kebab' | 'Set Menu' | 'Pasta' | 'Soup' | 'Salad';
  rating: number;
  price: number;
  originalPrice?: number;
  tags?: ('Best Value' | 'Spicy' | 'New')[];
  sellerId: string;
  deliveryTime: string;
  commissionPercentage: 5 | 7 | 10;
  isAvailable?: boolean;
  createdAt?: Date | Timestamp | string;
}

export type SellerPlan = 'free' | 'pro';

export type SellerStatus = 'Top Seller' | 'Rising Star' | 'Customer Favorite' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'buyer' | 'seller' | 'admin' | 'moderator';
  avatar: string;
  shopName?: string;
  shopAddress?: string;
  createdAt?: Date | Timestamp | string;
  zone?: DeliveryZone;
  planType?: SellerPlan;
  productUploadCount?: number;
  status?: SellerStatus;
  isSuspended?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id?: string;
  buyerId: string;
  sellerIds: string[];
  items: CartItem[];
  total: number;
  status: 'Pending' | 'Preparing' | 'Delivered' | 'Cancelled';
  createdAt: Date | Timestamp;
  address: string;
  contact: string;
  shippingCost?: number;
  deliveryZone?: DeliveryZone;
  platformFee?: number;
  sellerReceives?: number;
}

export type NotificationType = 'new-order' | 'order-status' | 'new-product';

export interface Notification {
    id: string;
    userId: string; // Can be buyer or seller
    type: NotificationType;
    message: string;
    isRead: boolean;
    createdAt: Timestamp;
    orderId?: string; // Link to order
    productId?: string; // Link to product
}

export interface SearchParams {
  [key: string]: string | string[] | undefined;
}
