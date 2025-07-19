
'use client';

import SellerCard from './seller-card';
import { ChefHat } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { User } from '@/types';
import { Skeleton } from './ui/skeleton';
import { motion } from 'framer-motion';

interface FeaturedSellersProps {
  initialSellers: User[];
}

export default function FeaturedSellers({ initialSellers }: FeaturedSellersProps) {
  const [featuredSellers, setFeaturedSellers] = useState<User[]>(initialSellers);
  const [loading, setLoading] = useState(initialSellers.length === 0);

  useEffect(() => {
    setFeaturedSellers(initialSellers);
    if(initialSellers.length > 0) {
        setLoading(false);
    }
  }, [initialSellers]);

  const SellerSkeleton = () => (
    <div className="flex flex-col space-y-3">
        <Skeleton className="h-[120px] w-full rounded-xl" />
        <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
        </div>
    </div>
  );

  return (
    <motion.section 
      className="bg-secondary/30 py-16 md:py-24"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="container mx-auto">
        <div className="text-center mb-12">
            <div className="inline-block relative">
              <h2 className="font-headline text-3xl font-extrabold md:text-5xl text-shadow-lg text-foreground pb-2">
                <ChefHat className="h-6 w-6 md:h-8 md:w-8 text-primary inline-block mr-4 mb-2" />
                  Our Top Kitchens
                <ChefHat className="h-6 w-6 md:h-8 md:w-8 text-primary inline-block ml-4 mb-2" />
              </h2>
            </div>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Discover the amazing chefs behind your favorite meals.</p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [...Array(3)].map((_, i) => <SellerSkeleton key={i} />)
          ) : (
            featuredSellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))
          )}
        </div>
      </div>
    </motion.section>
  );
}
