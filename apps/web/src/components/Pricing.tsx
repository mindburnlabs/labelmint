'use client'

import { motion } from 'framer-motion'
import {
  Check,
  X,
  Zap,
  Crown,
  Building,
  ArrowRight,
  HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small projects and testing',
    price: 'Pay as you go',
    originalPrice: null,
    icon: Zap,
    features: [
      { name: '$0.02 - $0.75 per task', included: true },
      { name: 'Up to 1,000 tasks/month', included: true },
      { name: 'Basic quality control', included: true },
      { name: 'Email support', included: true },
      { name: 'API access', included: false },
      { name: 'Custom labeling guidelines', included: false },
      { name: 'Priority support', included: false },
      { name: 'Dedicated account manager', included: false },
    ],
    color: 'from-blue-500 to-blue-600',
    badge: null,
    popular: false
  },
  {
    name: 'Professional',
    description: 'Ideal for growing businesses and teams',
    price: 'Custom pricing',
    originalPrice: null,
    icon: Crown,
    features: [
      { name: '$0.02 - $0.75 per task', included: true },
      { name: 'Up to 10,000 tasks/month', included: true },
      { name: 'Advanced quality control', included: true },
      { name: 'Priority email & chat support', included: true },
      { name: 'Full API access', included: true },
      { name: 'Custom labeling guidelines', included: true },
      { name: 'Analytics dashboard', included: true },
      { name: 'Dedicated account manager', included: false },
    ],
    color: 'from-purple-500 to-purple-600',
    badge: 'Most Popular',
    popular: true
  },
  {
    name: 'Enterprise',
    description: 'For large-scale operations and custom needs',
    price: 'Contact sales',
    originalPrice: null,
    icon: Building,
    features: [
      { name: 'Custom pricing per task', included: true },
      { name: 'Unlimited tasks', included: true },
      { name: 'Enterprise quality control', included: true },
      { name: '24/7 dedicated support', included: true },
      { name: 'Advanced API & webhooks', included: true },
      { name: 'Custom workflows & integrations', included: true },
      { name: 'Advanced analytics & reporting', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'SLA guarantees', included: true },
      { name: 'On-premise deployment option', included: true },
    ],
    color: 'from-orange-500 to-orange-600',
    badge: 'Custom Solutions',
    popular: false
  }
]

const taskTypes = [
  { type: 'Image Classification', price: '$0.02 - $0.10' },
  { type: 'Text Classification', price: '$0.02 - $0.08' },
  { type: 'Bounding Boxes', price: '$0.10 - $0.75' },
  { type: 'Segmentation', price: '$0.15 - $1.50' },
  { type: 'Transcription', price: '$0.05 - $0.25' },
  { type: 'Translation', price: '$0.03 - $0.15' },
]

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-background">
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
            Transparent Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Simple, Fair
            <span className="gradient-text ml-2">Pricing</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            No hidden fees, no long-term contracts. Pay only for what you use with transparent
            pricing that's up to 90% cheaper than traditional solutions.
          </p>
        </motion.div>

        {/* Task Pricing Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <Card className="p-8">
            <CardHeader className="text-center mb-8">
              <CardTitle className="text-2xl mb-2">Task Pricing</CardTitle>
              <CardDescription>
                Pricing varies by task complexity and quality requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {taskTypes.map((task, index) => (
                  <div
                    key={task.type}
                    className="flex justify-between items-center p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">{task.type}</span>
                    <Badge variant="secondary">{task.price}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  <HelpCircle className="inline w-4 h-4 mr-1" />
                  Need a custom task type?{' '}
                  <Button variant="link" className="p-0 h-auto text-primary">
                    Contact us
                  </Button>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={cn(
                'relative',
                plan.popular && 'lg:scale-105'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <Card className={cn(
                'h-full hover-lift',
                plan.popular && 'border-primary shadow-lg'
              )}>
                <CardHeader className="text-center pb-6">
                  <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r ${plan.color} flex items-center justify-center mb-4`}>
                    <plan.icon className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-base mb-4">
                    {plan.description}
                  </CardDescription>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.originalPrice && (
                      <span className="text-lg text-muted-foreground line-through ml-2">
                        {plan.originalPrice}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        {feature.included ? (
                          <Check className="w-5 h-5 text-success mr-3 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={cn(
                          'text-sm',
                          !feature.included && 'text-muted-foreground'
                        )}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn(
                      'w-full mt-6',
                      plan.popular && 'bg-primary hover:bg-primary/90'
                    )}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-8 p-8 bg-muted/50 rounded-2xl">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">500K+</div>
              <div className="text-sm text-muted-foreground">Active Workers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">98.5%</div>
              <div className="text-sm text-muted-foreground">Accuracy Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-info">&lt;1hr</div>
              <div className="text-sm text-muted-foreground">Avg. Turnaround</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">24/7</div>
              <div className="text-sm text-muted-foreground">Support</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}