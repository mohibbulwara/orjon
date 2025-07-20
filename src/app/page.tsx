// app/page.tsx বা app/(your-folder)/page.tsx

import dynamic from 'next/dynamic';

// Client Component কে dynamically import করো এবং ssr বন্ধ করো
const HeroSection = dynamic(() => import('@/components/hero-section'), { ssr: false });

import CategoryShowcase from '@/components/category-showcase';
import FeaturedProducts from '@/components/featured-products';
import FeaturedSellers from '@/components/featured-sellers';
import SubscriptionSection from '@/components/subscription-section';
import Testimonials from '@/components/testimonials';
import TodaysSpecial from '@/components/todays-special';
import { getProducts } from '@/lib/services/product-service';
import { getAllSellers } from '@/lib/services/user-service';
import { categories } from '@/lib/data';
import type { Product, User } from '@/types';

export default async function HomePage() {
  const allProducts = await getProducts({ limit: 8 });
  const allSellers = await getAllSellers();

  const featuredProducts = allProducts
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 4);

  const featuredSellers = allSellers
    .sort((a, b) => {
      if (a.planType === 'pro' && b.planType !== 'pro') return -1;
      if (a.planType !== 'pro' && b.planType === 'pro') return 1;
      return (b.productUploadCount || 0) - (a.productUploadCount || 0);
    })
    .slice(0, 3);

  return (
    <div className="flex flex-col">
      <HeroSection /> {/* এখন এটা কোনো ভুল দিবে না */}
      <CategoryShowcase categories={categories} />
      <FeaturedProducts initialProducts={featuredProducts} />
      <FeaturedSellers initialSellers={featuredSellers} />
      <Testimonials />
      <TodaysSpecial />
      <SubscriptionSection />
    </div>
  );
}
