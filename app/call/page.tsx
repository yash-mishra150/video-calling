"use client";

import { FC } from 'react';
import CallPage from '../../components/CallPage';

const CallRoute: FC = () => {
  const handleEndCall = () => {
    console.log('Call ended');
    // Redirect back to home
    window.location.href = '/';
  };

  return <CallPage callerName="Mahesh Mishra" onEndCall={handleEndCall} />;
};

export default CallRoute;
