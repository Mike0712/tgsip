// src/shared/components/MenuItem.tsx
import React, { useState } from 'react';
import { Menu } from '@headlessui/react';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/solid';
import cls from './menu-item.module.css';

const MenuItem = ({ children, title }: { children: React.ReactNode, title: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Menu as="div" className={cls.menuItem}>
      <Menu.Button className={cls.menuButton} onClick={() => setIsOpen(!isOpen)}>
        {title}
        {isOpen ? (
          <ChevronDownIcon className={cls.icon} />
        ) : (
          <ChevronRightIcon className={cls.icon} />
        )}
      </Menu.Button>
      {isOpen && (
        <Menu.Items static className={cls.menuItems}>
          {children}
        </Menu.Items>
      )}
    </Menu>
  );
};

export default MenuItem;
