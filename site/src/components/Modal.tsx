import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  showCloseButton = true,
}) => {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-gray-800 text-white rounded-lg w-full ${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto`}
      >
        <div className="sticky top-0 bg-gray-800 p-6 border-b border-gray-700 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
