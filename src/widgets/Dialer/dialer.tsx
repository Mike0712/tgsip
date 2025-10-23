import React from "react";
import { useSelector } from 'react-redux';
import Handset from '@/shared/ui/Handset/handset';
import { setManualCall } from '@/entities/WebRtc/model/slice';
import store, { RootState } from "@/app/store";

const Dialer = () => {
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const invite = useSelector((state: RootState) => state.sip.invite);
  const onCall = (dialingNumber: string) => {
    store.dispatch(setManualCall(dialingNumber));
  };

  return (
    <div>
        <Handset 
            onCall={onCall}
            sessionState={sessionState}
            invite={invite}
        />
    </div>
  );
};

export default Dialer;
