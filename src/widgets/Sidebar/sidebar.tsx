import React from "react";
import { useSelector } from 'react-redux';
import Avatar from "@/entities/User/ui/Avatar/avatar";
import Profile from "@/entities/User/ui/Profile/profile";
import Logout from "@/entities/User/ui/Logout/logout";
import SipStatus from "@/entities/WebRtc/ui/SipStatus/sip-status";
import cls from "./sidebar.module.css";
import { RootState } from "@/app/store";

const Sidebar = () => {
  const host = useSelector((state: RootState) => state.sip.serverUrl);
  const enabled = !!host;
  return (
    <div className={cls.sidebar}>
      <div className={cls.left}>
        <Avatar />
      </div>
      <div className={cls.right}>
        <Profile />
        {enabled && <SipStatus host={host} />}
        <Logout />
      </div>
    </div>
  );
};

export default Sidebar;
