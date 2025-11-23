import React from 'react';

// Иконка трубки в стиле WhatsApp/Teams
const PhoneHandsetIcon: React.FC<{ size?: number, color?: string, className?: string }> = ({ size = 28, color = 'currentColor', className }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M6.62 10.79a15.464 15.464 0 0 0 6.59 6.59l1.81-1.81a1.004 1.004 0 0 1 1.03-.24c1.12.37 2.33.57 3.55.57.55 0 1 .45 1 1v2.99c0 .55-.45 1-1 1C11.39 22 2 12.61 2 3.99c0-.55.45-1 1-1h2.99c.55 0 1 .45 1 1 0 1.22.2 2.43.57 3.55.09.3.03.63-.24 1.03l-1.7 1.7Z"/>
  </svg>
);

export default PhoneHandsetIcon;
