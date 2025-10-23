import React from 'react';
import Image from 'next/image';
import cls from './avatar.module.css';

const Avatar = () => (
  <div className={cls.avatarContainer}>
    <Image
      src="/logo.png"
      alt="Logo"
      width={50}
      height={50}
      className={cls.avatarImage}
    />
  </div>
);

export default Avatar;
