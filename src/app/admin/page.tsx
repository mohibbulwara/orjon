
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import type { Order, User, Product } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, ShoppingCart, Users, Package, BarChart, PieChart as PieChartIcon, Star, CheckCircle, Clock, XCircle, MoreHorizontal, Trash2, Eye, MessageSquare, PlayCircle, ShieldAlert, Search } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { BarChart as RechartsBarChart, PieChart, Pie, Cell, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { getAdminStats, getAllUsersForAdmin, getAllOrdersForAdmin, getAllProductsForAdmin } from '@/lib/services/admin-service';
import { deleteUser, activateSeller, deleteProductByAdmin } from '@/lib/services/admin-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  salesByMonth: { month: string; sales: number }[];
  topSellers: (User & { totalRevenue: number })[];
  categoryDistribution: { name: string; value: number }[];
}

const chartConfig: ChartConfig = {
    sales: { label: 'Sales (BDT)', color: 'hsl(var(--primary))' },
};

const categoryChartConfig = {
    value: { label: 'Products' },
    Burger: { label: 'Burger', color: "hsl(var(--chart-1))" },
    Pizza: { label: 'Pizza', color: "hsl(var(--chart-2))" },
    Drinks: { label: 'Drinks', color: "hsl(var(--chart-3))" },
    Dessert: { label: 'Dessert', color: "hsl(var(--chart-4))" },
    Biryani: { label: 'Biryani', color: "hsl(var(--chart-5))" },
    Kebab: { label: 'Kebab', color: "hsl(var(--chart-1))" },
    'Set Menu': { label: 'Set Menu', color: "hsl(var(--chart-2))" },
    Pasta: { label: 'Pasta', color: "hsl(var(--chart-3))" },
    Soup: { label: 'Soup', color: "hsl(var(--chart-4))" },
    Salad: { label: 'Salad', color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const AdminPageSkeleton = () => (
    <div className="container mx-auto py-8 space-y-8">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader><Skeleton className="h-5 w-3/5" /></CardHeader><CardContent><Skeleton className="h-8 w-4/5" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-5 w-3/5" /></CardHeader><CardContent><Skeleton className="h-8 w-4/5" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-5 w-3/5" /></CardHeader><CardContent><Skeleton className="h-8 w-4/5" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-5 w-3/5" /></CardHeader><CardContent><Skeleton className="h-8 w-4/5" /></CardContent></Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <Card className="lg:col-span-3"><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
            <Card className="lg:col-span-2"><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
        </div>
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
    </div>
)

const getStatusVariant = (status: Order['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Delivered': return 'default';
      case 'Preparing': return 'secondary';
      case 'Pending': return 'outline';
      case 'Cancelled': return 'destructive';
      default: return 'default';
    }
  };

const OrderStatusIcon = ({ status }: { status: Order['status'] }) => {
    switch (status) {
        case 'Pending': return <Clock className="h-4 w-4 text-yellow-500" />;
        case 'Preparing': return <Package className="h-4 w-4 text-blue-500" />;
        case 'Delivered': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'Cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
        default: return null;
    }
};

export default function AdminPage() {
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [usersPage, setUsersPage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const [productsPage, setProductsPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated || !user || !['admin', 'moderator'].includes(user.role)) {
                router.push('/');
            }
        }
    }, [user, isAuthenticated, authLoading, router]);

    const fetchData = async () => {
         Promise.all([
            getAdminStats(),
            getAllUsersForAdmin(),
            getAllOrdersForAdmin(),
            getAllProductsForAdmin(),
        ]).then(([statsData, usersData, ordersData, productsData]) => {
            setStats(statsData);
            setAllUsers(usersData);
            setAllOrders(ordersData);
            setAllProducts(productsData);
        }).catch(console.error)
        .finally(() => setLoading(false));
    }

    useEffect(() => {
        if (user && ['admin', 'moderator'].includes(user.role)) {
           fetchData();
        }
    }, [user]);

    const handleDeleteUser = async (userIdToDelete: string) => {
        const result = await deleteUser(userIdToDelete);
        if (result.success) {
            toast({ title: 'User Deleted', description: 'The user and their data have been removed.' });
            setAllUsers(prev => prev.filter(u => u.id !== userIdToDelete));
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };
    
    const handleDeleteProduct = async (productIdToDelete: string) => {
        const result = await deleteProductByAdmin(productIdToDelete);
        if (result.success) {
            toast({ title: 'Product Deleted', description: 'The product has been removed.' });
            setAllProducts(prev => prev.filter(p => p.id !== productIdToDelete));
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const handleActivateSeller = async (sellerId: string) => {
        const result = await activateSeller(sellerId);
        if (result.success) {
            toast({ title: 'Seller Activated', description: 'The seller account has been re-activated.' });
            fetchData(); // Refresh all data to reflect the change
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const filteredUsers = allUsers.filter(u => {
        if (!userSearchTerm) return true;
        const searchTerm = userSearchTerm.toLowerCase();
        const nameMatch = u.name.toLowerCase().includes(searchTerm);
        const emailMatch = u.email.toLowerCase().includes(searchTerm);
        const shopNameMatch = u.shopName?.toLowerCase().includes(searchTerm) || false;
        return nameMatch || emailMatch || shopNameMatch;
    });

    const filteredProducts = allProducts.filter(p => {
        if (!productSearchTerm) return true;
        const searchTerm = productSearchTerm.toLowerCase();
        return p.name.toLowerCase().includes(searchTerm);
    });

    // Paginated data
    const paginatedUsers = filteredUsers.slice((usersPage - 1) * itemsPerPage, usersPage * itemsPerPage);
    const totalUserPages = Math.ceil(filteredUsers.length / itemsPerPage);
    
    const paginatedOrders = allOrders.slice((ordersPage - 1) * itemsPerPage, ordersPage * itemsPerPage);
    const totalOrderPages = Math.ceil(allOrders.length / itemsPerPage);

    const paginatedProducts = filteredProducts.slice((productsPage - 1) * itemsPerPage, productsPage * itemsPerPage);
    const totalProductPages = Math.ceil(filteredProducts.length / itemsPerPage);

    if (authLoading || loading || !stats) {
        return <AdminPageSkeleton />;
    }

    const { totalRevenue, totalOrders, totalProducts, totalUsers, salesByMonth, topSellers, categoryDistribution } = stats;

    return (
        <div className="container mx-auto py-8 space-y-8">
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Admin Dashboard</h1>
            
            <Tabs defaultValue="overview">
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="users">Users ({totalUsers})</TabsTrigger>
                    <TabsTrigger value="products">Products ({totalProducts})</TabsTrigger>
                    <TabsTrigger value="orders">Orders ({totalOrders})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-8">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="text-2xl font-bold">৳{totalRevenue.toFixed(2)}</div></CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="text-2xl font-bold">+{totalOrders}</div></CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="text-2xl font-bold">{totalProducts}</div></CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="text-2xl font-bold">{totalUsers}</div></CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                        <Card className="lg:col-span-3">
                            <CardHeader>
                                <CardTitle>Sales Overview</CardTitle>
                                <CardDescription>Platform sales performance over the last few months.</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                    <RechartsBarChart data={salesByMonth} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                        <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                        <RechartsTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                        <Bar dataKey="sales" fill="var(--color-sales)" radius={4} />
                                    </RechartsBarChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Category Distribution</CardTitle>
                                <CardDescription>Product distribution by category.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center">
                                <ChartContainer config={categoryChartConfig} className="h-[300px] w-full">
                                    <PieChart>
                                        <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                        <Pie data={categoryDistribution} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                            {categoryDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={categoryChartConfig[entry.name]?.color || '#8884d8'} />
                                            ))}
                                        </Pie>
                                        <Legend content={<ChartTooltipContent />} />
                                    </PieChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Sellers Leaderboard</CardTitle>
                            <CardDescription>Sellers ranked by total revenue generated from delivered orders.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Seller</TableHead><TableHead className="text-right">Total Revenue</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {topSellers.map((seller, index) => (
                                        <TableRow key={seller.id}>
                                            <TableCell className="font-bold">#{index + 1}</TableCell>
                                            <TableCell>
                                                <Link href={`/seller/${seller.id}`} className="flex items-center gap-3 group">
                                                    <Avatar className="h-10 w-10"><AvatarImage src={seller.avatar} alt={seller.shopName || seller.name} /><AvatarFallback>{(seller.shopName || seller.name).charAt(0)}</AvatarFallback></Avatar>
                                                    <div>
                                                        <p className="font-semibold group-hover:text-primary">{seller.shopName || seller.name}</p>
                                                        <p className="text-sm text-muted-foreground">{seller.email}</p>
                                                    </div>
                                                    {seller.planType === 'pro' && <Star className="h-4 w-4 text-yellow-500" />}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">৳{seller.totalRevenue.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="users">
                    <Card>
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>A list of all users on the platform.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 max-w-sm">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name, email, shop..."
                                        value={userSearchTerm}
                                        onChange={(e) => setUserSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Role / Status</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedUsers.map((u) => {
                                        const defaultMessage = `Hello ${u.name},\n\nThis is a message from the Chefs' BD admin team regarding your account.\n\n\nBest regards,\nChefs' BD Team`;
                                        const mailtoLink = `mailto:${u.email}?subject=Message from Chefs' BD Admin&body=${encodeURIComponent(defaultMessage)}`;
                                        const isTargetAdmin = u.role === 'admin';
                                        const canDelete = user?.role === 'admin' && !isTargetAdmin;

                                        return (
                                            <TableRow key={u.id}>
                                                <TableCell>
                                                    <div className="font-medium">{u.name}</div>
                                                    <div className="text-sm text-muted-foreground">{u.email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant={u.role === 'seller' ? 'secondary' : u.role === 'admin' ? 'default' : u.role === 'moderator' ? 'outline' : 'outline'} className="capitalize w-fit">{u.role}</Badge>
                                                        {u.role === 'seller' && u.isSuspended && (
                                                            <Badge variant="destructive" className="w-fit">Suspended</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{u.createdAt ? format(new Date(u.createdAt as string), 'PP') : 'N/A'}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {u.role === 'seller' && (
                                                                <>
                                                                    <DropdownMenuItem asChild>
                                                                        <Link href={`/admin/seller-orders/${u.id}`} className="flex items-center gap-2"><Eye /> View Orders</Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem asChild>
                                                                        <a href={mailtoLink} className="flex items-center gap-2">
                                                                            <MessageSquare className="h-4 w-4" /> Message Seller
                                                                        </a>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                </>
                                                            )}
                                                            {u.role === 'seller' && u.isSuspended && user?.role === 'admin' && (
                                                                <DropdownMenuItem onClick={() => handleActivateSeller(u.id)} className="flex items-center gap-2 text-green-600 focus:text-green-600">
                                                                    <PlayCircle className="h-4 w-4" /> Activate Seller
                                                                </DropdownMenuItem>
                                                            )}
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild disabled={!canDelete}>
                                                                    <Button variant="ghost" className="w-full justify-start p-2 h-auto font-normal text-destructive hover:text-destructive flex items-center gap-2" disabled={!canDelete}>
                                                                        <Trash2 className="h-4 w-4" /> Delete User
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the user and all their associated data (products, orders, etc).</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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
                            <div className="flex items-center justify-between pt-4">
                                <span className="text-sm text-muted-foreground">Page {usersPage} of {totalUserPages}</span>
                                <div className="flex items-center space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => setUsersPage(p => p - 1)} disabled={usersPage === 1}>Previous</Button>
                                    <Button variant="outline" size="sm" onClick={() => setUsersPage(p => p + 1)} disabled={usersPage === totalUserPages}>Next</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="products">
                    <Card>
                        <CardHeader>
                            <CardTitle>Product Management</CardTitle>
                            <CardDescription>A list of all products on the platform.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 max-w-sm">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by product name..."
                                        value={productSearchTerm}
                                        onChange={(e) => setProductSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="hidden w-[80px] sm:table-cell">Image</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedProducts.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="hidden sm:table-cell">
                                                <Image
                                                    alt={p.name}
                                                    className="aspect-square rounded-md object-cover"
                                                    height="64"
                                                    src={p.images?.[0] || 'https://placehold.co/64x64.png'}
                                                    width="64"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Link href={`/product/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{p.category}</Badge>
                                            </TableCell>
                                            <TableCell>৳{p.price.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" disabled={user?.role !== 'admin'}>Delete</Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the product.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteProduct(p.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                  </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                             <div className="flex items-center justify-between pt-4">
                                <span className="text-sm text-muted-foreground">Page {productsPage} of {totalProductPages}</span>
                                <div className="flex items-center space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => setProductsPage(p => p - 1)} disabled={productsPage === 1}>Previous</Button>
                                    <Button variant="outline" size="sm" onClick={() => setProductsPage(p => p + 1)} disabled={productsPage === totalProductPages}>Next</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="orders">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Management</CardTitle>
                            <CardDescription>A list of all orders on the platform.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {paginatedOrders.map(order => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium">#{order.id?.substring(0, 6)}</TableCell>
                                            <TableCell>{order.createdAt ? format(new Date(order.createdAt as string), 'PPpp') : 'N/A'}</TableCell>
                                            <TableCell>৳{order.total.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(order.status)} className="capitalize flex items-center gap-1 w-fit">
                                                    <OrderStatusIcon status={order.status} />
                                                    {order.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                             </Table>
                             <div className="flex items-center justify-between pt-4">
                                <span className="text-sm text-muted-foreground">Page {ordersPage} of {totalOrderPages}</span>
                                <div className="flex items-center space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => setOrdersPage(p => p - 1)} disabled={ordersPage === 1}>Previous</Button>
                                    <Button variant="outline" size="sm" onClick={() => setOrdersPage(p => p + 1)} disabled={ordersPage === totalOrderPages}>Next</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
}
