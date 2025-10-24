import Hero from '@/components/Hero'
import PricingCalculator from '@/components/PricingCalculator'
import Testimonials from '@/components/Testimonials'
import CTA from '@/components/CTA'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <PricingCalculator />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}