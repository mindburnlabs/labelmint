'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Zap, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
            <Zap className="w-10 h-10 text-primary" />
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Ready to Transform Your
            <span className="gradient-text ml-2">Data Labeling?</span>
          </h2>

          {/* Description */}
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of companies that have already switched to LabelMint for their data labeling needs.
            Get started in minutes and see the quality difference immediately.
          </p>

          {/* Benefits List */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto">
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <span className="font-medium">No Credit Card Required</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <span className="font-medium">14-Day Free Trial</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
              <span className="font-medium">Cancel Anytime</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="text-lg px-8 py-4 h-auto">
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-4 h-auto">
              Schedule Demo
            </Button>
          </div>

          {/* Trust Indicator */}
          <p className="text-sm text-muted-foreground">
            Join 500+ companies already using LabelMint • No setup fee • Instant access
          </p>
        </motion.div>
      </div>
    </section>
  )
}