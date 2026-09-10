import React from 'react';

interface EarthBackgroundProps {
  scale: number;
  y: number;
}

export const EarthBackground: React.FC<EarthBackgroundProps> = ({ scale, y }) => {
  return (
    <>
      <video
        className="page-background-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        style={
          {
            '--earth-scale': scale,
            '--earth-y': `${y}px`,
          } as React.CSSProperties
        }
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260215_121759_424f8e9c-d8bd-4974-9567-52709dfb6842.mp4"
          type="video/mp4"
        />
      </video>
      <div className="earth-side-mask" aria-hidden="true" />
    </>
  );
};
