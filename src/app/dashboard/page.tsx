
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import type { Product, Order, Notification, User } from '@/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { MoreHorizontal, DollarSign, ShoppingCart, BarChart, PlusCircle, CheckCircle, Package, XCircle, Clock, Star, Zap, Trash2, Edit, MessageSquare } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, serverTimestamp, deleteDoc, getDocs, runTransaction } from 'firebase/firestore';
import { getUserById } from '@/lib/services/user-service';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { updateProduct } from '@/lib/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type EnrichedOrder = Order & { buyer?: User | null };

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [sellerOrders, setSellerOrders] = useState<EnrichedOrder[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || user?.role !== 'seller') {
      router.push('/login');
      return;
    }

    if(user.isSuspended) {
        // Handled by the component's return statement, but good practice
        return;
    }

    // Fetch Products
    const productsQuery = query(collection(db, 'products'), where('sellerId', '==', user.id));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setSellerProducts(productsData);
    });

    // Fetch Orders related to this seller
    const ordersQuery = query(collection(db, 'orders'), where('sellerIds', 'array-contains', user.id));
     const unsubscribeOrders = onSnapshot(ordersQuery, async (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
       // Filter items to only show those belonging to the current seller for display
      const relevantOrders = ordersData.map(order => ({
        ...order,
        items: order.items.filter(item => item.sellerId === user.id)
      })).filter(order => order.items.length > 0);
      
      // Enrich orders with buyer information
      const enrichedOrders = await Promise.all(
        relevantOrders.map(async (order) => {
            const buyer = await getUserById(order.buyerId);
            return { ...order, buyer };
        })
      );
      setSellerOrders(enrichedOrders);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
    };
  }, [user, isAuthenticated, loading, router]);

  const deliveredOrders = sellerOrders.filter(order => order.status === 'Delivered');

  const totalRevenue = deliveredOrders.reduce((acc, order) => {
    const sellerItemsTotal = order.items.reduce((itemAcc, item) => {
        const itemTotal = item.price * item.quantity;
        const commission = item.commissionPercentage || 5;
        return itemAcc + (itemTotal - (itemTotal * (commission / 100)));
    }, 0);
    return acc + sellerItemsTotal;
  }, 0);

  const totalOrders = sellerOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  const salesData = deliveredOrders.reduce((acc, order) => {
    if (!order.createdAt) return acc;
    const orderDate = (order.createdAt as any).toDate(); // Convert Firestore Timestamp
    const month = format(orderDate, 'MMM yyyy');
    const sellerItemsTotal = order.items.reduce((itemAcc, item) => itemAcc + item.price * item.quantity, 0);

    const existingMonth = acc.find(d => d.month === month);
    if (existingMonth) {
      existingMonth.sales += sellerItemsTotal;
    } else {
      acc.push({ month, sales: sellerItemsTotal });
    }
    return acc;
  }, [] as { month: string; sales: number }[]).reverse();


  const chartConfig = {
    sales: {
      label: 'Sales (BDT)',
      color: 'hsl(var(--primary))',
    },
  } satisfies ChartConfig;

  const handleStatusChange = async (orderId: string, status: Order['status'], buyerId: string) => {
    if (!user) return;
    const orderRef = doc(db, 'orders', orderId);

    try {
        await runTransaction(db, async (transaction) => {
            transaction.update(orderRef, { status });

            const buyerNotificationRef = doc(collection(db, 'notifications'));
            transaction.set(buyerNotificationRef, {
                userId: buyerId,
                orderId: orderId,
                message: `Your order #${orderId.substring(0, 6)} is now ${status}.`,
                type: 'order-status',
                createdAt: serverTimestamp(),
                isRead: false,
            });

            // If the order is delivered, check if the seller should be suspended
            if (status === 'Delivered') {
                const sellerDeliveredOrdersQuery = query(
                    collection(db, 'orders'),
                    where('sellerIds', 'array-contains', user.id),
                    where('status', '==', 'Delivered')
                );
                
                // Get docs within transaction for consistency
                const deliveredSnapshot = await getDocs(sellerDeliveredOrdersQuery);
                const deliveredCount = deliveredSnapshot.size; // This will include the current order once committed

                if (deliveredCount >= 100) {
                    const sellerRef = doc(db, 'users', user.id);
                    transaction.update(sellerRef, { isSuspended: true });

                    const sellerNotificationRef = doc(collection(db, 'notifications'));
                    transaction.set(sellerNotificationRef, {
                        userId: user.id,
                        message: "Your account has been suspended after reaching 100 delivered orders. Please pay the monthly fee of 500 taka to re-activate.",
                        type: 'order-status', // Using a generic type for now
                        createdAt: serverTimestamp(),
                        isRead: false,
                    });
                }
            }
        });
        
        toast({ title: 'Order Updated', description: `Order status changed to ${status}.` });

    } catch (error) {
        console.error("Error updating status:", error);
        toast({ title: 'Error', description: 'Failed to update order status.', variant: 'destructive' });
    }
  };
  
  const handleDelete = async (productId: string) => {
    try {
        await deleteDoc(doc(db, "products", productId));
        toast({ title: "Product Deleted", description: "The product has been removed." });
    } catch (error) {
        console.error("Error deleting product:", error);
        toast({ title: 'Error', description: 'Failed to delete product.', variant: 'destructive' });
    }
  };

  const handleUpgrade = async () => {
    if (!user) return;
    try {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, { planType: 'pro' });
        toast({ title: 'Upgrade Successful!', description: "You are now a Pro Seller!" });
    } catch (error) {
        console.error("Error upgrading account:", error);
        toast({ title: 'Error', description: 'Failed to upgrade account.', variant: 'destructive' });
    }
  };

  const handleAvailabilityChange = async (productId: string, isAvailable: boolean) => {
    try {
      const result = await updateProduct(productId, { isAvailable });
      if (result.error) {
        throw new Error(result.error);
      }
      toast({ title: 'Stock Updated', description: `Product is now ${isAvailable ? 'available' : 'unavailable'}.` });
    } catch (error: any) {
      console.error("Error updating availability:", error);
      toast({ title: 'Error', description: error.message || 'Failed to update stock status.', variant: 'destructive' });
    }
  };

  const getStatusVariant = (status: Order['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Delivered': return 'default';
      case 'Preparing': return 'secondary';
      case 'Pending': return 'outline';
      case 'Cancelled': return 'destructive';
      default: return 'default';
    }
  };
  
  if (loading || !user || user.role !== 'seller') {
      return <div className="container py-12 text-center">Loading or redirecting...</div>;
  }

  if (user.isSuspended) {
      return (
        <div className="container mx-auto py-12">
            <Card className="max-w-2xl mx-auto text-center border-destructive">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl text-destructive">Account Suspended</CardTitle>
                    <CardDescription>Your account has been temporarily suspended.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">You have successfully completed 100 orders. To continue selling on our platform, a monthly fee of 500 taka is required. Please contact admin to make the payment and re-activate your account.</p>
                     <Button asChild variant="outline">
                        <Link href="/contact">Contact Admin</Link>
                     </Button>
                </CardContent>
            </Card>
        </div>
      )
  }

  const OrderStatusIcon = ({ status }: { status: Order['status'] }) => {
    switch (status) {
        case 'Pending': return <Clock className="h-4 w-4 text-yellow-500" />;
        case 'Preparing': return <Package className="h-4 w-4 text-blue-500" />;
        case 'Delivered': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'Cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
        default: return null;
    }
  };

  return (
    <div className="container mx-auto py-8">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
                Seller Dashboard
            </h1>
            <Button asChild>
                <Link href="/dashboard/add-product">
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Add New Product
                </Link>
            </Button>
       </div>
       
        <Tabs defaultValue="overview">
            <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
                {user.planType === 'free' && (
                    <Card className="mb-8 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                                <Zap className="h-6 w-6"/> You are on the Free Plan!
                            </CardTitle>
                             <CardDescription className="text-blue-700 dark:text-blue-400">
                                You can add up to 5 products. Upgrade to Pro for unlimited products and more features.
                             </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Button onClick={handleUpgrade} className="bg-blue-600 hover:bg-blue-700">
                                <Star className="mr-2 h-4 w-4"/>
                                Upgrade to Pro
                             </Button>
                        </CardContent>
                    </Card>
                )}
                {user.planType === 'pro' && (
                     <Card className="mb-8 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
                                <Star className="h-6 w-6"/> You are a Pro Seller!
                            </CardTitle>
                             <CardDescription className="text-green-700 dark:text-green-400">
                                You have access to all features, including unlimited product uploads and detailed analytics.
                             </CardDescription>
                        </CardHeader>
                    </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                    <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">৳{totalRevenue.toFixed(2)}</div>
                    </CardContent>
                    </Card>
                    <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{totalOrders}</div>
                    </CardContent>
                    </Card>
                    <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">৳{averageOrderValue.toFixed(2)}</div>
                    </CardContent>
                    </Card>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Sales Overview</CardTitle>
                        <CardDescription>Your sales performance over the last few months.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <RechartsBarChart data={salesData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                                />
                            <Bar dataKey="sales" fill="var(--color-sales)" radius={4} />
                        </RechartsBarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="products">
                <Card>
                    <CardHeader>
                        <CardTitle>My Products</CardTitle>
                        <CardDescription>Manage your products here. You have added {sellerProducts.length} product(s).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="hidden w-[80px] sm:table-cell">Image</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead className="hidden md:table-cell">Price</TableHead>
                                    <TableHead className="hidden md:table-cell">Commission</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sellerProducts.map(product => {
                                    const isAvailable = product.isAvailable ?? true;
                                    return (
                                    <TableRow key={product.id}>
                                        <TableCell className="hidden sm:table-cell">
                                            <Image
                                                alt={product.name}
                                                className="aspect-square rounded-md object-cover"
                                                height="64"
                                                src={product.images[0]}
                                                width="64"
                                                data-ai-hint={product.category}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {product.name}
                                            <div className="md:hidden text-muted-foreground">৳{product.price.toFixed(2)}</div>
                                            <div className="md:hidden text-muted-foreground text-xs">Commission: {product.commissionPercentage}%</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id={`stock-${product.id}`}
                                                    checked={isAvailable}
                                                    onCheckedChange={(checked) => handleAvailabilityChange(product.id, checked)}
                                                />
                                                <Label htmlFor={`stock-${product.id}`} className={isAvailable ? 'text-green-600' : 'text-red-600'}>
                                                   {isAvailable ? 'In Stock' : 'Out of Stock'}
                                                </Label>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">৳{product.price.toFixed(2)}</TableCell>
                                        <TableCell className="hidden md:table-cell">{product.commissionPercentage}%</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                      <Link href={`/dashboard/edit-product/${product.id}`} className="flex items-center gap-2">
                                                        <Edit className="h-4 w-4" />
                                                        <span>Edit</span>
                                                      </Link>
                                                    </DropdownMenuItem>
                                                    <AlertDialog>
                                                      <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" className="w-full justify-start p-2 h-auto font-normal text-destructive hover:text-destructive flex items-center gap-2">
                                                            <Trash2 className="h-4 w-4" />
                                                            <span>Delete</span>
                                                        </Button>
                                                      </AlertDialogTrigger>
                                                      <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This action cannot be undone. This will permanently delete the product.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(product.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                      </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                        {sellerProducts.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">You have not added any products yet.</div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="orders">
                 <Card>
                    <CardHeader>
                        <CardTitle>Incoming Orders</CardTitle>
                        <CardDescription>Manage your incoming orders here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead>Buyer</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>You Receive</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sellerOrders.map(order => {
                                    const sellerItems = order.items.filter(item => item.sellerId === user.id);
                                    const subtotal = sellerItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
                                    const platformFee = sellerItems.reduce((acc, item) => {
                                        const itemTotal = item.price * item.quantity;
                                        const commission = item.commissionPercentage || 5;
                                        return acc + (itemTotal * (commission / 100));
                                    }, 0);
                                    const sellerReceives = subtotal - platformFee;
                                    const isActionable = order.status !== 'Delivered' && order.status !== 'Cancelled';

                                    return (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium">#{order.id?.substring(0,6)}</TableCell>
                                            <TableCell>{order.buyer?.name || 'N/A'}</TableCell>
                                            <TableCell>
                                            {sellerItems.map(item => (
                                                <div key={item.id}>{item.name} x {item.quantity}</div>
                                            ))}
                                            </TableCell>
                                            <TableCell>৳{sellerReceives.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(order.status)} className="capitalize flex items-center gap-1 w-fit">
                                                    <OrderStatusIcon status={order.status} />
                                                    {order.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                          <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        {isActionable && (
                                                          <>
                                                            <DropdownMenuItem 
                                                                onClick={() => handleStatusChange(order.id!, 'Preparing', order.buyerId)}
                                                            >
                                                                Mark as Preparing
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem 
                                                                onClick={() => handleStatusChange(order.id!, 'Delivered', order.buyerId)}
                                                            >
                                                                Mark as Delivered
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem 
                                                                onClick={() => handleStatusChange(order.id!, 'Cancelled', order.buyerId)} 
                                                                className="text-destructive"
                                                            >
                                                                Cancel Order
                                                            </DropdownMenuItem>
                                                          </>
                                                        )}
                                                         {order.buyer?.email && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem asChild>
                                                                    <a href={`mailto:${order.buyer.email}`} className="flex items-center gap-2">
                                                                        <MessageSquare className="h-4 w-4"/>
                                                                        Message Buyer
                                                                    </a>
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                         {sellerOrders.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">You have no orders yet.</div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
