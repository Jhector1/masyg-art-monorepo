
'use client';

import { HomeCategory } from '@acme/core/types';
import Link from 'next/link';

export default function CategoryCard({ slug, title, image, gradient }:HomeCategory) {
  return (
    <Link key={slug} href={`/store`}>
      <div className={`rounded-xl p-6 cursor-pointer bg-gradient-to-r ${gradient} text-white shadow-lg hover:scale-105 transition-transform duration-300 flex flex-col items-center justify-center`}>
        <img src={image} alt={title} className="w-24 h-24 mb-4 bg-white rounded-full p-2" />
        <h2 className="text-2xl font-bold text-center">{title}</h2>
      </div>
    </Link>
  );
}
