'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'ML Lead at TechCorp',
    avatar: 'SC',
    content: 'Deligate.it saved us $45,000 in our last quarter. The quality is exceptional and the turnaround time is incredible. We labeled 50,000 images in under 2 hours.',
    rating: 5,
    company: 'TechCorp',
    savings: '$45,000'
  },
  {
    name: 'Michael Rodriguez',
    role: 'CTO at StartupAI',
    avatar: 'MR',
    content: 'We tried Scale AI and other providers, but Deligate.it offers the best value. The Telegram integration is brilliant - our team can monitor progress in real-time.',
    rating: 5,
    company: 'StartupAI',
    savings: '$120,000'
  },
  {
    name: 'Emily Johnson',
    role: 'Data Science Manager',
    avatar: 'EJ',
    content: 'The platform is intuitive and the labeling quality is consistently above 98%. We use it for all our annotation needs now. Highly recommended!',
    rating: 5,
    company: 'FinanceTech',
    savings: '$78,000'
  },
  {
    name: 'David Kim',
    role: 'AI Research Lead',
    avatar: 'DK',
    content: 'As a research lab, we need high-quality annotations on a tight budget. Deligate.it delivers both. The expert labelers handle our complex NLP tasks perfectly.',
    rating: 5,
    company: 'ResearchLab',
    savings: '$35,000'
  },
  {
    name: 'Lisa Thompson',
    role: 'Product Manager',
    avatar: 'LT',
    content: 'Switched to Deligate.it 3 months ago and haven\'t looked back. Customer support is responsive and the platform just works. Saved us 60% on labeling costs.',
    rating: 5,
    company: 'E-commerce Pro',
    savings: '$92,000'
  },
  {
    name: 'Alex Wong',
    role: 'Founder at ML Startup',
    avatar: 'AW',
    content: 'Perfect for startups that need quality data without the enterprise price tag. We went from prototype to production in record time thanks to their fast labeling.',
    rating: 5,
    company: 'ML Startup',
    savings: '$15,000'
  }
]

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-20 bg-white">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Trusted by ML Teams Worldwide
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See what our customers have to say about their experience
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-xl p-6 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-semibold mr-3">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                  <p className="text-xs text-primary-600 font-medium">{testimonial.company}</p>
                </div>
              </div>

              <div className="flex items-center mb-3">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              <div className="relative">
                <Quote className="absolute -top-2 -left-2 w-8 h-8 text-primary-200" />
                <p className="text-gray-700 relative z-10 pl-6">
                  {testimonial.content}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-green-600">
                  Saved {testimonial.savings} in labeling costs
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="bg-primary-50 rounded-2xl p-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-3xl font-bold text-primary-600">500K+</p>
                <p className="text-sm text-gray-600">Active Labelers</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-600">10M+</p>
                <p className="text-sm text-gray-600">Tasks Completed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-600">98.5%</p>
                <p className="text-sm text-gray-600">Accuracy Rate</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary-600">90%</p>
                <p className="text-sm text-gray-600">Cost Savings</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}