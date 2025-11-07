import React from "react";
import { useSelector } from 'react-redux';
import Handset from '@/shared/ui/Handset/handset';
import { RootState } from "@/app/store";
import { useBridgeDialer } from '@/features/BridgeDialer/model/useBridgeDialer';

const Dialer = () => {
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const invite = useSelector((state: RootState) => state.sip.invite);
  const { startBridge } = useBridgeDialer();
  const onCall = (dialingNumber: string) => {
    startBridge({
      target: dialingNumber,
      metadata: {
        source: 'manual-dialer',
        initiated_at: new Date().toISOString(),
      },
    });
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
