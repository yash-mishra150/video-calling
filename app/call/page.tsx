"use client";

import { FC } from 'react';
import CallPage from '../../components/CallPage';

const CallRoute: FC = () => {
  const handleEndCall = () => {
    console.log('Call ended');
    // Redirect back to home
    window.location.href = '/';
  };

  return <CallPage callId="demo-call-123" username="Mahesh Mishra" isCaller={true} onCallEnd={handleEndCall} />;
};

export default CallRoute;
