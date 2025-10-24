'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Clock, CreditCard, Zap } from 'lucide-react'

export default function CTA() {
  return (
    <section className="py-20 bg-primary-600">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl font-bold text-white mb-4">
            Start in 5 Minutes
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join hundreds of ML teams saving up to 90% on data labeling costs
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center mb-12">
            <button className="bg-white text-primary-600 hover:bg-gray-100 font-semibold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg text-lg flex items-center justify-center">
              Get Started Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
            <button className="bg-primary-700 hover:bg-primary-800 text-white font-semibold py-4 px-8 rounded-lg transition-all duration-200 text-lg">
              Schedule Demo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-2 text-primary-100">
              <Clock className="w-5 h-5" />
              <span>5 min setup</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-primary-100">
              <CreditCard className="w-5 h-5" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-primary-100">
              <Zap className="w-5 h-5" />
              <span>Instant access</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}