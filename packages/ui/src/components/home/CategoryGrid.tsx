'use client';


import { motion } from 'framer-motion';
import CategoryCard from './CategoryCard';
import { HomeCategory } from '@acme/core/types';

export interface CategoryGridProps {
  categories: HomeCategory[];
}

export default function CategoryGrid({
  categories,
}: CategoryGridProps) {
  return (
    <motion.div
      className="mb-20 grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.6 }}
    >
      {categories.map((cat) => (
        <CategoryCard key={cat.slug} {...cat} />
      ))}
    </motion.div>
  );
}
