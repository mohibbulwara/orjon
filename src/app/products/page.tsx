
import { Suspense } from 'react';
import ProductList from '@/components/product-list';
import { Skeleton } from '@/components/ui/skeleton';
import { getProducts } from '@/lib/services/product-service';
import { getAllSellers } from '@/lib/services/user-service';
import type { Product, SearchParams, User } from '@/types';
import ProductFilters from '@/components/product-filters';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal } from 'lucide-react';

async function filterAndSortProducts(searchParams: SearchParams): Promise<Product[]> {
  let products = await getProducts({
    category: searchParams.category,
  });

  // Client-side-like filtering and sorting on the server
  if (searchParams.search) {
    const searchTerm = searchParams.search.toLowerCase();
    products = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm)
    );
  }

  if (searchParams.rating) {
    const minRating = Number(searchParams.rating);
    if (minRating > 0) {
      products = products.filter(product => product.rating >= minRating);
    }
  }

  if (searchParams.sortBy) {
    const [field, direction] = searchParams.sortBy.split('-');
    products.sort((a, b) => {
      const aValue = a[field as keyof Product] as number;
      const bValue = b[field as keyof Product] as number;
      if (direction === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });
  } else {
    // Default sort by rating if not specified
    products.sort((a, b) => b.rating - a.rating);
  }

  return products;
}


export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  // Fetch all sellers once, as this list is needed for the filter sidebar.
  const allSellers = await getAllSellers();
  
  // We can still pre-filter products on the server for the initial load.
  // The client-side filters will handle subsequent dynamic filtering.
  const products = await filterAndSortProducts(searchParams);

  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="font-headline text-4xl font-bold text-primary">
          All Products
        </h1>
        <p className="text-muted-foreground mt-2">Find your next favorite meal from our curated collection.</p>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Desktop Filters */}
        <aside className="hidden md:block md:col-span-1">
          <div className="sticky top-24">
            <ProductFilters />
          </div>
        </aside>

        {/* Mobile Filters Trigger */}
        <div className="md:hidden flex items-center justify-between col-span-1 mb-4">
          <span className="text-sm text-muted-foreground">{products.length} results</span>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="py-8">
                 <ProductFilters />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Main content */}
        <main className="md:col-span-3">
           <Suspense fallback={<ProductListSkeleton />}>
              <ProductList initialProducts={products} allSellers={allSellers} />
           </Suspense>
        </main>
      </div>
    </div>
  );
}

const ProductListSkeleton = () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {[...Array(9)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-3">
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            </div>
        ))}
    </div>
);
