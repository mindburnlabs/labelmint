'use client'

import { motion } from 'framer-motion'
import {
  ArrowRight,
  Clock,
  CreditCard,
  Zap,
  CheckCircle2,
  Shield,
  Users,
  Rocket,
  Star,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const benefits = [
  {
    icon: Clock,
    title: "5-Minute Setup",
    description: "Get started immediately with our streamlined onboarding process"
  },
  {
    icon: CreditCard,
    title: "No Credit Card",
    description: "Start your free trial with no commitment or payment required"
  },
  {
    icon: Zap,
    title: "Instant Access",
    description: "Access 500K+ expert annotators and start your first project right away"
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SOC 2 Type II certified with end-to-end encryption"
  }
]

const stats = [
  { value: "90%", label: "Cost Savings" },
  { value: "<1hr", label: "First Results" },
  { value: "500K+", label: "Expert Annotators" },
  { value: "99.5%", label: "Accuracy Rate" }
]

export default function CTA() {
  return (
    <section className="py-24 lg:py-32 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Enhanced Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-6 max-w-7xl">
        {/* Main CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border-green-500/30 rounded-full text-sm font-medium mb-8">
            <Rocket className="w-5 h-5 mr-2" />
            Ready to Transform Your AI Pipeline?
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="block text-white mb-4">Get Started in Minutes,</span>
            <span className="block bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              Not Weeks
            </span>
          </h2>

          <p className="text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto mb-12">
            Join thousands of ML teams who are saving up to 90% on data labeling costs
            while getting enterprise-grade quality. Start your free trial today.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
            <Button
              size="lg"
              className="text-lg px-12 py-6 h-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 border-0 shadow-2xl group transition-all duration-300 transform hover:scale-105"
            >
              <Zap className="w-5 h-5 mr-2" />
              Start Your Free Trial
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-12 py-6 h-auto bg-white/5 text-white border-white/20 hover:bg-white/10 hover:border-white/30 transition-all duration-300"
            >
              <Users className="w-5 h-5 mr-2" />
              Book a Demo
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-20"
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className="group"
            >
              <Card className="h-full border-0 shadow-xl bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all duration-500 hover:shadow-2xl hover:scale-105">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6 mx-auto border border-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <benefit.icon className="w-8 h-8 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-3 text-white group-hover:text-cyan-400 transition-colors duration-300">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{benefit.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-r from-green-900/30 via-emerald-900/20 to-cyan-900/30 backdrop-blur-sm">
            <CardContent className="p-16">
              {/* Background Effects */}
              <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
              <div className="absolute top-0 left-0 w-32 h-32 bg-green-500/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl"></div>

              <div className="relative z-10 text-center">
                <div className="flex items-center justify-center mb-6">
                  <div className="flex items-center space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-6 h-6 text-amber-400 fill-current" />
                    ))}
                  </div>
                  <span className="ml-4 text-xl font-bold text-white">4.9/5 Rating</span>
                  <span className="ml-2 text-gray-400">(500+ reviews)</span>
                </div>

                <h3 className="text-2xl font-bold mb-4 text-white">
                  Trusted by 1,000+ AI Companies Worldwide
                </h3>
                <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
                  From startups to Fortune 500 companies, teams rely on LabelMint for
                  mission-critical AI training data.
                </p>

                <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-400">
                  <div className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mr-2" />
                    No setup fees
                  </div>
                  <div className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mr-2" />
                    14-day free trial
                  </div>
                  <div className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mr-2" />
                    Cancel anytime
                  </div>
                  <div className="flex items-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mr-2" />
                    24/7 support
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}