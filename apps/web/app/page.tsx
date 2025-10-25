import Hero from '@/components/Hero'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
// import Features from '@/components/Features'
// import HowItWorks from '@/components/HowItWorks'
// import Pricing from '@/components/Pricing'
// import Testimonials from '@/components/Testimonials'
// import CTA from '@/components/CTA'

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        {/* <Features />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <CTA /> */}
      </main>
      <Footer />
    </div>
  )
}