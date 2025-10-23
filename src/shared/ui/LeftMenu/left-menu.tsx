import React, { useState } from "react";
import MenuItem from "../MenuItem/menu-item";
import cls from "./left-menu.module.css";
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/solid';

const LeftMenu = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleMenu = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`${cls.leftMenu} ${isCollapsed ? cls.collapsed : ""}`}>
      <button className={cls.collapseButton} onClick={toggleMenu}>
        {isCollapsed ? (
          <ChevronRightIcon className={cls.icon} />
        ) : (
          <ChevronLeftIcon className={cls.icon} />
        )}
      </button>
      <div className={cls.menuItems}>
        <MenuItem title="Item 1">
          <div className={cls.subItems}>
            <a href="#" className={cls.subItem}>
              Subitem 1
            </a>
            <a href="#" className={cls.subItem}>
              Subitem 2
            </a>
          </div>
        </MenuItem>
        <MenuItem title="Item 2">
          <div className={cls.subItems}>
            <a href="#" className={cls.subItem}>
              Subitem 3
            </a>
            <a href="#" className={cls.subItem}>
              Subitem 4
            </a>
          </div>
        </MenuItem>
      </div>
    </div>
  );
};

export default LeftMenu;
