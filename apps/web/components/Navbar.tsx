'use client'

import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
      <div className="container">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-primary-600">Deligate.it</h1>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#pricing" className="text-gray-700 hover:text-primary-600 transition-colors">Pricing</a>
            <a href="#testimonials" className="text-gray-700 hover:text-primary-600 transition-colors">Testimonials</a>
            <a href="/blog" className="text-gray-700 hover:text-primary-600 transition-colors">Blog</a>
            <button className="btn-primary">Get Started</button>
          </div>

          <button
            className="md:hidden text-gray-700"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a href="#pricing" className="block px-3 py-2 text-gray-700 hover:text-primary-600">Pricing</a>
              <a href="#testimonials" className="block px-3 py-2 text-gray-700 hover:text-primary-600">Testimonials</a>
              <a href="/blog" className="block px-3 py-2 text-gray-700 hover:text-primary-600">Blog</a>
              <button className="w-full text-left px-3 py-2 btn-primary">Get Started</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}