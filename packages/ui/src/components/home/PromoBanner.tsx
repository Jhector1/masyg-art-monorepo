'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function PromoBanner() {
  return (
    <motion.div
      className="bg-yellow-100 border border-yellow-300 text-yellow-900 text-center py-4 px-6 rounded-xl shadow mb-12 flex flex-col md:flex-row items-center justify-center gap-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <span className="font-bold text-lg md:text-xl">
        ✨ Discover Cultural Collectibles
      </span>
      <span className="text-sm md:text-base">
        Limited prints now available!
      </span>
      <Link 
        href="/store" 
        className="bg-yellow-600 text-white px-3 py-1 rounded-lg shadow hover:bg-yellow-700 transition"
      >
        Shop Now
      </Link>
    </motion.div>
  );
}
