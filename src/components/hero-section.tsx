'use client';

import { useLanguage } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="relative w-full bg-background overflow-hidden">
      <div className="container mx-auto grid grid-cols-1 items-center py-20 md:py-32 text-center">
        <motion.div 
          className="relative z-10"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="font-headline text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-shadow bg-gradient-to-r from-primary to-blue-400 text-transparent bg-clip-text pb-2">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-[600px] text-muted-foreground md:text-xl">
            {t('heroSubtitle')}
          </p>
          <motion.div 
            className="mt-10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button asChild size="lg" className="rounded-full shadow-lg hover:shadow-primary/30 transition-shadow duration-300 px-10 py-6 text-lg font-bold">
              <Link href="/products">{t('browseProducts')}</Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
