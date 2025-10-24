'use client'

import { motion } from 'framer-motion'
import {
  Zap,
  Shield,
  Users,
  TrendingUp,
  Globe,
  Clock,
  BarChart3,
  Bot,
  Coins
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Get your data labeled in minutes, not days. Our distributed workforce ensures rapid turnaround times.',
    badge: 'Avg. < 1 hour',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20'
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Enterprise-grade security with end-to-end encryption. Your data is always protected and confidential.',
    badge: 'SOC 2 Compliant',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20'
  },
  {
    icon: Users,
    title: '500K+ Workers',
    description: 'Access to a massive, vetted workforce of Telegram users ready to label your data 24/7.',
    badge: 'Global Coverage',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20'
  },
  {
    icon: Coins,
    title: 'Transparent Pricing',
    description: 'Pay exactly what the workers earn. No hidden fees, no contracts, just fair transparent pricing.',
    badge: 'Save up to 90%',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20'
  },
  {
    icon: BarChart3,
    title: 'Quality Assurance',
    description: 'Multiple worker consensus, honeypot tasks, and AI-powered quality control ensure 98.5% accuracy.',
    badge: '98.5% Accuracy',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20'
  },
  {
    icon: Bot,
    title: 'AI-Powered',
    description: 'Smart task distribution, automated quality checks, and intelligent worker matching algorithms.',
    badge: 'ML Optimized',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/20'
  },
  {
    icon: Globe,
    title: 'Blockchain Payments',
    description: 'Instant TON/USDT micropayments with full transparency and audit trails on the blockchain.',
    badge: 'TON Blockchain',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/20'
  },
  {
    icon: Clock,
    title: '24/7 Availability',
    description: 'Our global workforce operates around the clock. Submit tasks anytime, get results fast.',
    badge: 'Always Online',
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/20'
  },
  {
    icon: TrendingUp,
    title: 'Scalable Solution',
    description: 'From small projects to enterprise-scale operations. Our platform grows with your needs.',
    badge: 'Infinite Scale',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/20'
  }
]

export default function Features() {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            Platform Features
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need for
            <span className="gradient-text ml-2">Data Labeling</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Built for modern teams who need high-quality training data without the enterprise complexity
            and pricing of traditional solutions.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full hover-lift group cursor-pointer border-0 shadow-medium">
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 mx-auto rounded-2xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className={`w-8 h-8 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                  <Badge variant="secondary" className="w-fit mx-auto">
                    {feature.badge}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="inline-flex flex-col sm:flex-row gap-4 p-8 bg-primary/5 rounded-2xl border border-primary/10">
            <div>
              <h3 className="text-2xl font-bold mb-2">Ready to get started?</h3>
              <p className="text-muted-foreground">
                Join thousands of companies using LabelMint for their data needs
              </p>
            </div>
            <div className="flex items-center">
              <button className="btn-primary">
                Start Free Trial
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}