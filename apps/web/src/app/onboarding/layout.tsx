import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16">{children}</div>
      <Footer />
    </>
  );
}
