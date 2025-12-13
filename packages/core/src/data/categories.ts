import { HomeCategory } from "../types";

const categories: HomeCategory[] = [
  {
    title: 'Digital Art & Print',
    kind: 'ART',
    image: '/icons/veve.webp',
    gradient: 'from-purple-500 via-pink-500 to-red-500',
  },
  {
     title: 'Contemporary',
    // title: 'Mug',
    kind: 'MUG',
    image: '/icons/nature.png',
    gradient: 'from-yellow-400 via-orange-400 to-red-400',
  },
  {
     title: 'Vodou Art',
    // title: 'Stickers',
    kind: 'STICKER',
    image: '/icons/dantor.webp',
    gradient: 'from-blue-500 via-sky-400 to-teal-300',
  },
  {
    title: 'Historical',
    kind: 'historical',
    image: '/icons/historical.png',
    gradient: 'from-green-500 via-lime-400 to-yellow-300',
  },
  {
    title: 'Folk Culture',
    kind: 'culture',
    image: '/icons/culture.png',
    gradient: 'from-orange-500 via-amber-500 to-yellow-400',
  },
  {
    title: 'Mythology & Symbolism',
    kind: 'mythology',
    image: '/icons/figure.webp',
    gradient: 'from-rose-500 via-fuchsia-500 to-purple-500',
  },
];

export default categories;





  const materials =
    [
      {
        label: "Matte Paper",
        multiplier: 1,
        thumbnail: "/images/textures/matte.png",
      },
      {
        label: "Glossy Paper",
        multiplier: 1.2,
        thumbnail: "/images/textures/glossy.png",
      },
      {
        label: "Canvas",
        multiplier: 1.5,
        thumbnail: "/images/textures/canvas.png",
      },
    ];

  const frames =[
      
      { label: "Black Wood", border: "8px solid #111", multiplier: 1.25 },
      { label: "Natural Wood", border: "8px solid #a35" ,  multiplier: 1.5},
      { label: "White", border: "8px solid #fff" ,  multiplier: 1.75},
    ];

  const optionSizes = 
    [
      { label: "8x10 in", multiplier: 1 },
      { label: "11x14 in", multiplier: 1.25 },
      { label: "16x20 in", multiplier: 1.5 },
      { label: "18x24 in", multiplier: 2 },
      { label: "Custom", multiplier: 0 },
    ]
    const KINDS = ['ALL', 'ART'] as const;

// const KINDS = ['ALL', 'ART','STICKER', 'DIGITAL', 'PRINT', 'BOOK', 'MUG', 'BAG', 'HAT', 'OTHER'] as const;

  export {optionSizes, materials, frames,KINDS}