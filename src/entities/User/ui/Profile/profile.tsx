import React from 'react';
import { UserCircleIcon } from '@heroicons/react/solid';
import Link from 'next/link';
import cls from './profile.module.css';

const Profile = () => (
  <Link href="/profile" legacyBehavior>
    <a className={cls.profileLink}>
      <UserCircleIcon className={cls.icon} />
      Profile
    </a>
  </Link>
);

export default Profile;
