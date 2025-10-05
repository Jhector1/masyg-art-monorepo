'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { HomeCategory } from '@acme/core/types';

export interface CategoryGridProps {
  categories: HomeCategory[];
}

export default function CategoryGrid({
  categories,
}: CategoryGridProps) {
  const [index, setIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoSlide = () => {
    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % categories.length);
    }, 3000);
  };

  const stopAutoSlide = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    startAutoSlide();
    return () => stopAutoSlide();
  }, []);

  return (
    <motion.div
      onMouseEnter={stopAutoSlide}
      onMouseLeave={startAutoSlide}
      className="relative w-full max-w-4xl mx-auto overflow-hidden mb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.6 }}
    >
      <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${index * 100}%)` }}>
        {categories.map((cat) => (
          <Link  href={`/store`} key={cat.slug} className="min-w-full flex-shrink-0">
            <div className={`h-72 flex flex-col justify-center items-center text-white bg-gradient-to-r ${cat.gradient} p-8 rounded-xl mx-2`}>
              <img src={cat.image} alt={cat.title} className="w-24 h-24 mb-4 bg-white rounded-full p-2" />
              <h2 className="text-2xl font-bold text-center">{cat.title}</h2>
            </div>
          </Link>
        ))}
      </div>
      <button
        onClick={() => setIndex((prev) => (prev - 1 + categories.length) % categories.length)}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-black rounded-full p-2 shadow"
      >
        ◀
      </button>
      <button
        onClick={() => setIndex((prev) => (prev + 1) % categories.length)}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-black rounded-full p-2 shadow"
      >
        ▶
      </button>
    </motion.div>
  );
}
