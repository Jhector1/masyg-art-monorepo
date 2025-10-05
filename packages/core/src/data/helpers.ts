export const navLinks = [
  { label: "Home", href: "/" },
  { label: "Store", href: "/store" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];




  export const allMaterials = [
    { label: 'Matte Paper', multiplier: 1, thumbnail: '/images/textures/matte.png' },
    { label: 'Glossy Paper', multiplier: 1, thumbnail: '/images/textures/glossy.png' },
    { label: 'Canvas', multiplier: 1.5, thumbnail: '/images/textures/canvas.png' },
  ]

  export const allLicenses = [
    { type: 'personal',  name: 'Personal Use',  price: 0,   description: 'For personal projects and non-commercial use.' },
    { type: 'commercial', name: 'Commercial Use', price: 50,  description: 'For business use: websites, client work, etc.' },
    { type: 'extended',  name: 'Extended License', price: 200, description: 'For resale or merchandise with unlimited copies.' },
  ];

  export const allFrames =[
    { label: 'Black Wood',   border: '8px solid #111', multiplier: 1.5 },
    { label: 'Natural Wood', border: '8px solid #a35', multiplier: 1.5  },
    { label: 'White',        border: '8px solid #fff', multiplier: 1.5 },
  ];

  export const allSizes = [
    { label: '8x10 in',  multiplier: 1 },
    { label: '11x14 in', multiplier: 1.25 },
    { label: '16x20 in', multiplier: 1.5 },
    { label: '18x24 in', multiplier: 2 },
    { label: 'Custom',   multiplier: 0 },
  ];
