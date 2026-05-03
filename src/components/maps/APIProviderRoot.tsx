'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import type { ReactNode } from 'react';

interface APIProviderRootProps {
  children: ReactNode;
  onMapsError?: (err: unknown) => void;
}

export function APIProviderRoot({ children, onMapsError }: APIProviderRootProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return <>{children}</>;
  return (
    <APIProvider
      apiKey={apiKey}
      libraries={['places', 'marker']}
      onError={onMapsError}
    >
      {children}
    </APIProvider>
  );
}
