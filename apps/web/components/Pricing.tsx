'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  X,
  ArrowRight,
  Star,
  Zap,
  Crown,
  Sparkles,
  TrendingUp,
  Users,
  Shield,
  Award,
  HeadphonesIcon,
  Rocket,
  CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small projects and startups',
    price: 0.02,
    unit: 'per task',
    originalPrice: 0.05,
    icon: Sparkles,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/5 to-cyan-500/5',
    borderColor: 'border-blue-500/30',
    features: [
      'Basic image & text classification',
      'Standard quality assurance',
      '24-48 hour turnaround',
      'Email support',
      'API access',
      'Basic analytics'
    ],
    limitations: [
      'No priority processing',
      'Standard accuracy (95%)',
      'Limited customization'
    ],
    popular: false
  },
  {
    name: 'Professional',
    description: 'Ideal for growing teams and ML projects',
    price: 0.15,
    unit: 'per task',
    originalPrice: 0.35,
    icon: Zap,
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/5 to-pink-500/5',
    borderColor: 'border-purple-500/30',
    features: [
      'Advanced annotation tools',
      'Enhanced quality assurance',
      '2-4 hour turnaround',
      'Priority email & chat support',
      'Advanced API with webhooks',
      'Detailed analytics & insights',
      'Custom quality metrics',
      'Team collaboration tools'
    ],
    limitations: [
      'No dedicated account manager',
      'Standard SLA'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    description: 'For large-scale mission-critical applications',
    price: 'Custom',
    unit: 'contact us',
    originalPrice: null,
    icon: Crown,
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-500/5 to-orange-500/5',
    borderColor: 'border-amber-500/30',
    features: [
      'Everything in Professional',
      'Unlimited task types',
      'White-glove service',
      'Dedicated account manager',
      'Custom integrations',
      'On-premise deployment option',
      'Advanced security features',
      'Custom SLA guarantees',
      'Priority processing'
    ],
    limitations: [],
    popular: false
  }
]

const comparisonData = [
  { feature: 'Base Price per Task', starter: '$0.02', professional: '$0.15', enterprise: 'Custom' },
  { feature: 'Accuracy Guarantee', starter: '95%', professional: '98%', enterprise: '99.5%+' },
  { feature: 'Turnaround Time', starter: '24-48 hours', professional: '2-4 hours', enterprise: '<1 hour' },
  { feature: 'Support Level', starter: 'Email', professional: 'Priority Email & Chat', enterprise: '24/7 Dedicated' },
  { feature: 'API Access', starter: 'Basic', professional: 'Advanced + Webhooks', enterprise: 'Custom Integrations' },
  { feature: 'Quality Assurance', starter: 'Standard', professional: 'Enhanced', enterprise: 'White-glove' },
  { feature: 'Custom Workflows', starter: false, professional: true, enterprise: true },
  { feature: 'Enterprise SLA', starter: false, professional: false, enterprise: true }
]

const testimonials = [
  { company: 'AI Startup Inc.', quote: 'LabelMint saved us 85% on data labeling costs while improving accuracy.', author: 'CTO' },
  { company: 'TechCorp', quote: 'The fastest turnaround time we\'ve seen in the industry.', author: 'Head of AI' },
  { company: 'DataLab', quote: 'Exceptional quality and support. Truly enterprise-grade.', author: 'ML Engineer' }
]

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <section className="py-24 lg:py-32 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
      <div className="container mx-auto px-6 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto mb-20"
        >
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-500/30 rounded-full text-sm font-medium mb-8">
            <TrendingUp className="w-5 h-5 mr-2" />
            Save up to 90% vs traditional platforms
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            <span className="block text-white mb-4">Transparent Pricing for</span>
            <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              Every Scale
            </span>
          </h2>

          <p className="text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto mb-12">
            Simple, predictable pricing with no hidden fees. Pay only for the tasks you need,
            with enterprise-grade quality and support.
          </p>

          {/* Competitor Comparison */}
          <Card className="max-w-3xl mx-auto border-0 shadow-2xl bg-gradient-to-r from-red-900/20 to-green-900/20 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mr-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </div>
                    <span className="text-xl font-bold text-white">Industry Comparison</span>
                  </div>
                  <p className="text-gray-300">
                    Scale AI: $0.25-$7.50 • LabelMint: $0.02-$0.75
                  </p>
                </div>
                <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-6 py-3 text-base font-semibold">
                  90% Savings
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className={`relative ${plan.popular ? 'lg:-mt-8' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 text-base font-semibold shadow-lg">
                    Most Popular
                  </Badge>
                </div>
              )}

              <Card className={`relative h-full border-0 shadow-2xl bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all duration-500 hover:shadow-3xl hover:scale-105 overflow-hidden group`}>
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${plan.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                {/* Popular badge glow */}
                {plan.popular && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                )}

                <CardContent className="relative p-8">
                  {/* Icon */}
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${plan.gradient} flex items-center justify-center mb-6 mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <plan.icon className="w-10 h-10 text-white" />
                  </div>

                  {/* Name */}
                  <CardTitle className="text-2xl font-bold mb-3 text-center text-white group-hover:text-cyan-400 transition-colors duration-300">
                    {plan.name}
                  </CardTitle>
                  <p className="text-gray-400 text-center mb-6">{plan.description}</p>

                  {/* Price */}
                  <div className="text-center mb-8">
                    {plan.price === 'Custom' ? (
                      <div className="text-4xl font-bold text-white mb-2">Custom</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-center">
                          <span className="text-5xl font-bold text-white">${plan.price}</span>
                          <span className="text-gray-400 ml-2">{plan.unit}</span>
                        </div>
                        {plan.originalPrice && (
                          <div className="text-sm text-gray-400">
                            <span className="line-through">${plan.originalPrice}</span>
                            <span className="text-green-400 ml-2 font-medium">
                              Save {Math.round((1 - plan.price / plan.originalPrice) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start">
                        <Check className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </div>
                    ))}

                    {plan.limitations.map((limitation) => (
                      <div key={limitation} className="flex items-start opacity-60">
                        <X className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-500 text-sm">{limitation}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Button
                    className={`w-full h-14 font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
                      plan.popular
                        ? `bg-gradient-to-r ${plan.gradient} hover:from-purple-600 hover:to-pink-600 border-0 shadow-lg hover:shadow-xl`
                        : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Detailed Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mb-20"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4 text-white">
              Detailed Feature Comparison
            </h3>
            <p className="text-xl text-gray-300">
              See exactly what you get with each plan
            </p>
          </div>

          <Card className="border-0 shadow-2xl bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left p-6 font-semibold text-white">Feature</th>
                    <th className="text-center p-6 font-semibold text-white">
                      <div className="flex flex-col items-center">
                        <Sparkles className="w-6 h-6 mb-2 text-blue-400" />
                        Starter
                      </div>
                    </th>
                    <th className="text-center p-6 font-semibold text-purple-400 bg-purple-500/10">
                      <div className="flex flex-col items-center">
                        <Zap className="w-6 h-6 mb-2 text-purple-400" />
                        Professional
                      </div>
                    </th>
                    <th className="text-center p-6 font-semibold text-white">
                      <div className="flex flex-col items-center">
                        <Crown className="w-6 h-6 mb-2 text-amber-400" />
                        Enterprise
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, index) => (
                    <tr key={row.feature} className={`border-b border-white/10 ${index % 2 === 0 ? 'bg-white/5' : ''} hover:bg-white/10 transition-colors`}>
                      <td className="p-6 font-medium text-white">{row.feature}</td>
                      <td className="p-6 text-center text-gray-300">{row.starter}</td>
                      <td className={`p-6 text-center ${row.feature === 'Base Price per Task' ? 'font-bold text-purple-400' : 'bg-purple-500/5 text-gray-300'}`}>
                        {row.professional}
                      </td>
                      <td className="p-6 text-center text-gray-300">{row.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mb-20"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4 text-white">
              Trusted by Industry Leaders
            </h3>
            <p className="text-xl text-gray-300">
              See what our customers are saying
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.company}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              >
                <Card className="border-0 shadow-xl bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all duration-300">
                  <CardContent className="p-8">
                    <div className="flex items-center mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                      ))}
                    </div>
                    <p className="text-gray-300 mb-6 italic">"{testimonial.quote}"</p>
                    <div>
                      <div className="font-bold text-white">{testimonial.company}</div>
                      <div className="text-sm text-gray-400">{testimonial.author}</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Trust Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-gray-300">
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-green-400 mr-3" />
              30-day money-back guarantee
            </div>
            <div className="flex items-center">
              <HeadphonesIcon className="w-5 h-5 text-blue-400 mr-3" />
              24/7 customer support
            </div>
            <div className="flex items-center">
              <Rocket className="w-5 h-5 text-purple-400 mr-3" />
              Cancel anytime
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}