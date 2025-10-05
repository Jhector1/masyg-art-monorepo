
'use client';

import { motion } from 'framer-motion';

export default function Testimonial() {
  return (
    <motion.div
      className="bg-white border-l-4 border-pink-500 p-6 my-16 shadow-md rounded-md max-w-3xl mx-auto"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <p className="text-lg italic text-gray-700">
        “The colors, the culture, the depth — each print brings Haiti’s soul into my home. Truly unique.”
      </p>
      <p className="mt-4 text-sm text-right text-gray-500">— Marie, Collector from NYC</p>
    </motion.div>
  );
}
