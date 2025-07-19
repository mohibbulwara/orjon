
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Product, User } from '@/types';
import ProductCard from '@/components/product-card';
import { AnimatePresence, motion } from 'framer-motion';
import SellerCard from './seller-card';

interface ProductListProps {
  initialProducts: Product[];
  allSellers: User[];
}

export default function ProductList({ initialProducts, allSellers }: ProductListProps) {
    const [products, setProducts] = useState(initialProducts);
    const searchParams = useSearchParams();

    // This effect re-filters the products on the client side when URL params change.
    useEffect(() => {
        let filtered = [...initialProducts];
        
        const searchTerm = searchParams.get('search');
        const minRating = Number(searchParams.get('rating'));

        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (minRating > 0) {
            filtered = filtered.filter(p => p.rating >= minRating);
        }

        setProducts(filtered);
    }, [searchParams, initialProducts]);

    const categorySellers = useMemo(() => {
        const category = searchParams.get('category');
        if (!category || category === 'All') {
          return [];
        }
        const sellerIdsInCategory = new Set(
          initialProducts
            .filter(p => p.category === category)
            .map(p => p.sellerId)
        );
        return allSellers.filter(seller => sellerIdsInCategory.has(seller.id));
      }, [searchParams, initialProducts, allSellers]);

    return (
        <div className="space-y-8">
            <AnimatePresence>
                {categorySellers.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="mb-8">
                            <h2 className="font-headline text-2xl font-bold mb-4 text-primary">
                                Sellers for {searchParams.get('category')}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {categorySellers.map(seller => (
                                    <SellerCard key={seller.id} seller={seller} />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {products.length > 0 ? (
                    <motion.div
                        layout
                        className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
                    >
                    {products.map((product, index) => (
                        <motion.div
                            key={product.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }}
                            transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            <ProductCard product={product} />
                        </motion.div>
                    ))}
                    </motion.div>
                ) : (
                    <div className="py-20 text-center">
                        <p className="text-lg text-muted-foreground">No products found. Try adjusting your filters.</p>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
