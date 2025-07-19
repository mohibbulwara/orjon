
'use server';

import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Order, Product, User } from '@/types';
import { format } from 'date-fns';

const serialize = (doc: any) => {
    const data = doc.data();
    const id = doc.id;
    const serializedData: { [key: string]: any } = { id, ...data };

    for (const key in data) {
        if (data[key] instanceof Timestamp) {
            serializedData[key] = data[key].toDate().toISOString();
        }
    }
    return serializedData;
};

export async function getAdminStats() {
    // Fetch all necessary data in parallel
    const [ordersSnapshot, productsSnapshot, usersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'orders'), where('status', '==', 'Delivered'))),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'users'))
    ]);

    const deliveredOrders = ordersSnapshot.docs.map(doc => serialize(doc)) as Order[];
    const allProducts = productsSnapshot.docs.map(doc => serialize(doc)) as Product[];
    const allUsers = usersSnapshot.docs.map(doc => serialize(doc)) as User[];

    // --- Calculate Stats ---

    // 1. Total Revenue from delivered orders
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);

    // 2. Total Orders (all statuses)
    const allOrdersSnapshot = await getDocs(collection(db, 'orders'));
    const totalOrders = allOrdersSnapshot.size;

    // 3. Total Products & Users
    const totalProducts = allProducts.length;
    const totalUsers = allUsers.length;

    // 4. Sales by Month
    const salesByMonth = deliveredOrders.reduce((acc, order) => {
        const orderDate = new Date(order.createdAt as string);
        const month = format(orderDate, 'MMM yyyy');
        acc[month] = (acc[month] || 0) + order.total;
        return acc;
    }, {} as Record<string, number>);

    const formattedSalesByMonth = Object.entries(salesByMonth)
        .map(([month, sales]) => ({ month, sales }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    // 5. Top Sellers by Revenue
    const sellerRevenue: Record<string, number> = {};
    deliveredOrders.forEach(order => {
        order.items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            const commission = item.commissionPercentage || 5;
            const sellerReceives = itemTotal - (itemTotal * (commission / 100));
            sellerRevenue[item.sellerId] = (sellerRevenue[item.sellerId] || 0) + sellerReceives;
        });
    });

    const sellers = allUsers.filter(u => u.role === 'seller');
    const topSellers = sellers.map(seller => ({
        ...seller,
        totalRevenue: sellerRevenue[seller.id] || 0,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);


    // 6. Category Distribution
    const categoryCounts = allProducts.reduce((acc, product) => {
        acc[product.category] = (acc[product.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const categoryDistribution = Object.entries(categoryCounts).map(([name, value]) => ({
        name,
        value,
    }));


    return {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalUsers,
        salesByMonth: formattedSalesByMonth,
        topSellers,
        categoryDistribution,
    };
}


export async function getAllUsersForAdmin(): Promise<User[]> {
    const usersSnapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    return usersSnapshot.docs.map(doc => serialize(doc) as User);
}

export async function getAllOrdersForAdmin(): Promise<Order[]> {
    const ordersSnapshot = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    return ordersSnapshot.docs.map(doc => serialize(doc) as Order);
}

export async function getAllProductsForAdmin(): Promise<Product[]> {
    const productsSnapshot = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
    return productsSnapshot.docs.map(doc => serialize(doc) as Product);
}
