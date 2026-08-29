import { SoftwareApplicationJsonLd } from '@/components/marketing/JsonLd';
import { CTABanner } from '@/components/marketing/CTABanner';
import { AllAppsShowcase } from '@/components/marketing/home/AllAppsShowcase';
import { ElevatorPitch } from '@/components/marketing/home/ElevatorPitch';
import { FeatureMatrix } from '@/components/marketing/home/FeatureMatrix';
import { HomeHeroCarousel } from '@/components/marketing/home/HomeHeroCarousel';
import { HomePricingSection } from '@/components/marketing/home/HomePricingSection';
import { HowItWorks } from '@/components/marketing/home/HowItWorks';
import { IndiaDifferentiators } from '@/components/marketing/home/IndiaDifferentiators';
import { ReviewsSection } from '@/components/marketing/home/ReviewsSection';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({});

export default function HomePage() {
  return (
    <>
      <SoftwareApplicationJsonLd />
      <HomeHeroCarousel />
      <ElevatorPitch />
      <HowItWorks />
      <AllAppsShowcase />
      <FeatureMatrix />
      <IndiaDifferentiators />
      <HomePricingSection />
      <ReviewsSection />
      <CTABanner />
    </>
  );
}
