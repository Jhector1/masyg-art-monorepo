
'use client';

import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <motion.div
      className="text-center my-16"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h1 className="text-4xl inline-block sm:text-5xl font-extrabold mb-4 bg-gradient-to-r from-blue-500 via-red-500 to-yellow-500 text-transparent bg-clip-text">
        <span className='texnt-blue-500'>Zile</span>Digital
      </h1>
      <p className="text-lg text-gray-700 max-w-2xl mx-auto">
        Explore a vibrant collection of veve symbols, historical, and cultural icons inspired by Haitian heritage.
      </p>
    </motion.div>
  );
}
