'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/solid';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

export default function ImageModal({
  image,
  title,
  isOpen,
  onClose,
}: {
  image: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative max-w-4xl w-full"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Zoom>
              <img
                src={image}
                alt={title}
                className="w-full max-h-[80vh] rounded-lg object-contain bg-white p-2 shadow-lg"
              />
            </Zoom>

            <button
              onClick={onClose}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1 rounded-full shadow"
            >
              <XMarkIcon className="w-6 h-6 text-black" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
