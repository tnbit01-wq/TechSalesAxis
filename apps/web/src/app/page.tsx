'use client';

import { LandingPageTemplate } from '@/components/landing';
import { defaultLandingPageConfig } from '@/config';

export default function Home() {
  return (
    <LandingPageTemplate 
      config={defaultLandingPageConfig}
      brandName="TechSalesAxis"
      brandMark="T"
    />
  );
}