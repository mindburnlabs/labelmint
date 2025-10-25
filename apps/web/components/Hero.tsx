'use client'

import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Star, Zap, TrendingUp, Users, Shield, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const trustBadges = [
  { icon: Star, text: '4.9/5 Rating', subtext: '500+ reviews' },
  { icon: Users, text: '500K+ Workers', subtext: 'Global talent pool' },
  { icon: Shield, text: 'SOC 2 Type II', subtext: 'Enterprise security' },
  { icon: TrendingUp, text: '99.5% Accuracy', subtext: 'Industry leading' }
]

const comparison = [
  { name: 'Scale AI', price: '$0.25 - $7.50', badge: 'Expensive', color: 'destructive' },
  { name: 'LabelMint', price: '$0.02 - $0.75', badge: 'Best Value', color: 'default' }
]

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Enhanced Background */}
      <div className="absolute inset-0">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDYwIEwgNjAgMCBNIC02IDYgIEwgNiAtNiBNIDU0IDY2IEwgNjYgNTQiIHN0cm9rZT0iIzFmMjkzNyIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />

        {/* Animated gradient orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center">
            {/* Top trust banner */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-12"
            >
              <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-full text-cyan-300 text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-2" />
                Trusted by 1000+ AI companies • 99.5% accuracy guarantee
              </div>
            </motion.div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold mb-8 leading-tight"
            >
              <span className="block text-white mb-4">Enterprise AI Data</span>
              <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                at Startup Speed
              </span>
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl sm:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed font-light"
            >
              Access <span className="text-cyan-400 font-semibold">500K+ expert annotators</span> across 150+ countries.
              Get <span className="text-purple-400 font-semibold">99.5% accuracy</span> with{' '}
              <span className="text-blue-400 font-semibold">&lt;1 hour delivery</span> at 90% less cost than Scale AI.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center mb-16"
            >
              <Button
                size="lg"
                className="text-lg px-10 py-6 h-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 border-0 shadow-2xl group transition-all duration-300 transform hover:scale-105"
              >
                <Zap className="w-5 h-5 mr-2" />
                Start Your Project
                <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-10 py-6 h-auto bg-white/5 text-white border-white/20 hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
                <Star className="w-5 h-5 mr-2" />
                Book a Demo
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-20"
            >
              {trustBadges.map((badge, index) => (
                <motion.div
                  key={badge.text}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.9 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/30">
                      <badge.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                  </div>
                  <div className="text-white font-bold text-lg mb-1">{badge.text}</div>
                  <div className="text-gray-400 text-sm">{badge.subtext}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Comparison cards */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto"
            >
              {/* Scale AI card */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-slate-900/50 backdrop-blur-sm border border-red-500/20 rounded-2xl p-8 hover:border-red-500/40 transition-all duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Scale AI</h3>
                      <p className="text-gray-400 text-sm">Enterprise pricing, complex contracts</p>
                    </div>
                    <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30">
                      Expensive
                    </Badge>
                  </div>
                  <div className="text-3xl font-bold text-red-400 mb-4">$0.25 - $7.50</div>
                  <div className="text-gray-400 text-sm">per task</div>
                </div>
              </div>

              {/* LabelMint card */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-slate-900/50 backdrop-blur-sm border border-green-500/20 rounded-2xl p-8 hover:border-green-500/40 transition-all duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">LabelMint</h3>
                      <p className="text-gray-400 text-sm">Transparent pricing, no contracts</p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                      Best Value
                    </Badge>
                  </div>
                  <div className="text-3xl font-bold text-green-400 mb-4">$0.02 - $0.75</div>
                  <div className="text-gray-400 text-sm mb-4">per task</div>
                  <div className="flex items-center text-green-400 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save up to 90%
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="mt-20"
            >
              <div className="text-center mb-8">
                <p className="text-gray-400 text-sm font-medium mb-6">TRUSTED BY LEADING AI COMPANIES</p>
                <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
                  {['OpenAI', 'Anthropic', 'Google', 'Microsoft', 'Meta', 'Amazon'].map((company) => (
                    <div key={company} className="text-gray-500 text-lg font-semibold hover:text-gray-300 transition-colors cursor-pointer">
                      {company}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
    </section>
  )
}