// File: components/UserMenu.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

type MenuItem = {
  label: string;
  href: string;
  disable: boolean;
};

interface UserMenuProps {
  userName: string;
  userImage: string;
  userEmail: string;
  userRole: string;
  menuItems: MenuItem[];
  onSignOut: () => void;
}

export default function UserMenu({
  userName,
  userImage,
  userEmail,
  userRole,
  menuItems,
  onSignOut,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center text-sm pe-1 font-medium text-gray-900 rounded-full hover:text-blue-600 dark:hover:text-blue-500 md:me-0 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:text-white"
        aria-expanded={open}
        aria-label="Open user menu"
      >
        <span className="sr-only">Open user menu</span>
        <Image
          src={userImage}
          alt={`${userName} photo`}
          width={32}
          height={32}
          className="w-8 h-8 me-2 rounded-full"
        />
        {userName}
        <svg
          className="w-2.5 h-2.5 ms-3"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 10 6"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m1 1 4 4 4-4"
          />
        </svg>
      </button>

      {open && (
        <div className="z-10 absolute right-0 mt-2 w-44 bg-white divide-y divide-gray-100 rounded-lg shadow-sm dark:bg-gray-700 dark:divide-gray-600">
          <div className="px-4 py-3 text-sm text-gray-900 dark:text-white">
            <div className="font-medium">{userRole}</div>
            <div className="truncate">{userEmail}</div>
          </div>
          <ul className="py-2 text-sm text-gray-700 dark:text-gray-200">
            {menuItems.map((item) => (
              <li key={item.label}>
                <a
                
                  href={!item.disable?item.href: '#'}
                  className={`${!item.disable?'block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white': ' px-4 py-2 block pointer-events-none text-gray-400 cursor-not-allowed'}`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="py-2">
            <button
              onClick={onSignOut}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-200 dark:hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
