
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getProductById, getProducts } from '@/lib/services/product-service';
import { getUserById } from '@/lib/services/user-service';
import ProductDetailClient from './product-detail-client';
import { Skeleton } from '@/components/ui/skeleton';

const ProductDetailSkeleton = () => (
    <div className="container mx-auto max-w-7xl py-12">
        <div className="grid md:grid-cols-2 gap-12 items-start">
            <Skeleton className="w-full aspect-square rounded-2xl" />
            <div className="flex flex-col gap-6">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-24 w-full" />
                <div className="flex items-baseline gap-4">
                    <Skeleton className="h-12 w-1/2" />
                    <Skeleton className="h-6 w-1/4" />
                </div>
                <Skeleton className="h-16 w-full rounded-lg" />
                <div className="flex gap-4">
                    <Skeleton className="h-14 w-48" />
                    <Skeleton className="h-14 w-48" />
                </div>
            </div>
        </div>
    </div>
);

async function ProductDetails({ productId }: { productId: string }) {
    const product = await getProductById(productId);

    if (!product) {
        notFound();
    }

    const [seller, allProducts] = await Promise.all([
        getUserById(product.sellerId),
        getProducts({ category: product.category, limit: 5 })
    ]);

    const relatedProducts = allProducts
        .filter(p => p.id !== product.id)
        .slice(0, 4);

    return <ProductDetailClient product={product} seller={seller} relatedProducts={relatedProducts} />;
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
    return (
        <Suspense fallback={<ProductDetailSkeleton />}>
            <ProductDetails productId={params.id} />
        </Suspense>
    );
}
