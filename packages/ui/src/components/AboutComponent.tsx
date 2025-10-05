'use client';

import React from 'react';
import {
  GlobeAltIcon,
  PaintBrushIcon,
  SparklesIcon,
  ArrowRightCircleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export  function AboutComponent() {
  return (
    <div className="py-16">
      <div className="max-w-5xl mx-auto text-center ">
        <h1 className="text-5xl font-extrabold text-gray-800 mb-6">
          Celebrating Haiti’s Spirit Through Digital Art
        </h1>
        <p className="text-xl text-gray-700 mb-12">
          A curated digital art marketplace inspired by Haiti&apos;s vibrant culture,
          mysticism, and everyday life — created to celebrate
          and share the beauty of Haitian themes worldwide.
        </p>

        {/* Core Values */}
        <div className="grid gap-10 md:grid-cols-3 text-left">
          <div className="bg-white p-6 rounded-2xl shadow hover:shadow-xl transition">
            <GlobeAltIcon className="h-10 w-10 text-blue-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Cultural Celebration
            </h3>
            <p className="text-gray-600">
              We showcase digital artworks that echo Haiti’s rich traditions —
              from Veve symbols and folklore to scenes of daily life and community.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow hover:shadow-xl transition">
            <PaintBrushIcon className="h-10 w-10 text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Digital Expression
            </h3>
            <p className="text-gray-600">
              All artworks are original digital pieces, designed with love and
              intention — available in JPG, PNG, PDF, or SVG formats for
              download or high-quality print.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow hover:shadow-xl transition">
            <SparklesIcon className="h-10 w-10 text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Made for You
            </h3>
            <p className="text-gray-600">
              Whether you want spiritual symbols for meditation, vibrant art
              for your space, or beautiful visuals for print, you’ll find
              pieces that speak to you.
            </p>
          </div>
        </div>

        {/* Format & Purchase Info */}
        <div className="mt-24 grid md:grid-cols-3 gap-10 text-left">
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h4 className="font-semibold text-gray-800 text-lg mb-2">
              1. Choose Your Art
            </h4>
            <p className="text-gray-600">
              Browse by category or vibe — spiritual, cultural, symbolic,
              botanical, and more.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h4 className="font-semibold text-gray-800 text-lg mb-2">
              2. Pick Format & Size
            </h4>
            <p className="text-gray-600">
              Select digital formats (JPG, PNG, SVG, PDF) and sizes — pricing
              adjusts automatically.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h4 className="font-semibold text-gray-800 text-lg mb-2">
              3. Instant or Print
            </h4>
            <p className="text-gray-600">
              Download instantly or order a print version — perfect for decor
              or gifting.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24 bg-white p-10 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between">
          <div className="mb-6 md:mb-0 text-left">
            <h3 className="text-2xl font-bold text-gray-800">
              Start Exploring Haitian-Inspired Art
            </h3>
            <p className="text-gray-600">
              Find your next digital treasure or unique wall piece.
            </p>
          </div>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full text-lg font-medium transition"
          >
            Browse Gallery <ArrowRightCircleIcon className="h-6 w-6" />
          </Link>
        </div>
      </div>
    </div>
  );
}
