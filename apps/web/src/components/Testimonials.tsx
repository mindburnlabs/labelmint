'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'CTO at AI Startup',
    company: 'NeuralTech Inc.',
    content: 'LabelMint transformed how we approach data labeling. The quality is exceptional, and the pricing is unbeatable. We reduced our labeling costs by 85% while improving accuracy.',
    rating: 5,
    avatar: 'SC'
  },
  {
    name: 'Michael Rodriguez',
    role: 'ML Engineer',
    company: 'DataCorp',
    content: 'The API integration was seamless, and the real-time dashboard gives us complete visibility into our projects. What used to take weeks now takes hours.',
    rating: 5,
    avatar: 'MR'
  },
  {
    name: 'Emily Watson',
    role: 'Product Manager',
    company: 'VisionAI',
    content: 'We\'ve tried multiple labeling platforms, but LabelMint is by far the best. The Telegram worker network is incredibly efficient, and the blockchain payments provide full transparency.',
    rating: 5,
    avatar: 'EW'
  }
]

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-secondary/30">
      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Trusted by
            <span className="gradient-text ml-2">Industry Leaders</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            See what our customers have to say about their experience with LabelMint
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full hover-lift">
                <CardContent className="p-6">
                  <Quote className="w-8 h-8 text-primary/20 mb-4" />

                  {/* Rating */}
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>

                  {/* Content */}
                  <blockquote className="text-muted-foreground mb-6 leading-relaxed">
                    "{testimonial.content}"
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                      <span className="text-sm font-bold text-primary">
                        {testimonial.avatar}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {testimonial.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">10M+</div>
              <div className="text-sm text-muted-foreground">Tasks Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-success mb-2">98.5%</div>
              <div className="text-sm text-muted-foreground">Customer Satisfaction</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-info mb-2">500+</div>
              <div className="text-sm text-muted-foreground">Companies Trust Us</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-warning mb-2">24/7</div>
              <div className="text-sm text-muted-foreground">Support Available</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}