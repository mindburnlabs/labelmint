'use client'

import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, Zap, Sparkles, TrendingUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-secondary/20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full mix-blend-multiply filter blur-xl animate-float"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-secondary/20 rounded-full mix-blend-multiply filter blur-xl animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/10 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow"></div>

      <div className="container relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Announcement Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <Badge variant="secondary" className="px-6 py-2 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Zap className="w-4 h-4 mr-2" />
              Powered by Telegram & TON Blockchain
            </Badge>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6"
          >
            <span className="block">Professional Data</span>
            <span className="block gradient-text">Labeling Platform</span>
            <span className="block text-3xl sm:text-4xl lg:text-5xl xl:text-6xl mt-2 text-muted-foreground font-normal">
              with TON/USDT Micropayments
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed"
          >
            Revolutionary data labeling marketplace powered by Telegram workers and TON blockchain.
            Get high-quality training data with transparent micropayments, 99.9% uptime, and
            exceptional developer experience.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Button size="lg" className="text-lg px-8 py-6 h-auto group">
              Get Started in 5 Minutes
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6 h-auto">
              View Live Demo
            </Button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16"
          >
            <div className="flex items-center justify-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <span className="font-medium">No Contracts Required</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium">Pay Per Task</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-info" />
              </div>
              <span className="font-medium">500K+ Active Workers</span>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto"
          >
            {/* Pricing Comparison */}
            <div className="card p-8 hover-lift">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Competitive Pricing</h3>
                  <p className="text-muted-foreground">Save up to 90% vs traditional platforms</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-medium">Scale AI</span>
                    <p className="text-sm text-muted-foreground">Enterprise solution</p>
                  </div>
                  <span className="text-destructive font-bold">$0.25 - $7.50</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                  <div>
                    <span className="font-medium">LabelMint</span>
                    <p className="text-sm text-muted-foreground">You pay exactly</p>
                  </div>
                  <span className="text-primary font-bold text-lg">$0.02 - $0.75</span>
                </div>
              </div>
            </div>

            {/* Quality Metrics */}
            <div className="card p-8 hover-lift">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mr-4">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Quality Metrics</h3>
                  <p className="text-muted-foreground">Industry-leading accuracy & speed</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Accuracy Rate</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-muted rounded-full h-2 mr-3">
                      <div className="bg-success h-2 rounded-full" style={{ width: '98.5%' }}></div>
                    </div>
                    <span className="font-bold text-success">98.5%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Avg. Turnaround</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-muted rounded-full h-2 mr-3">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '95%' }}></div>
                    </div>
                    <span className="font-bold">&lt; 1 hour</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Active Labelers</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-muted rounded-full h-2 mr-3">
                      <div className="bg-info h-2 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <span className="font-bold text-info">500K+</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
    </section>
  )
}