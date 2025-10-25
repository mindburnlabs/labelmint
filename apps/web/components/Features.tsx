'use client'

import { motion } from 'framer-motion'
import {
  Brain,
  Zap,
  Shield,
  Globe,
  TrendingUp,
  Users,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Cpu,
  Bot,
  Database,
  Network,
  Star,
  Award,
  Clock,
  Target
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const coreFeatures = [
  {
    icon: Brain,
    title: 'AI-Powered Quality',
    description: 'Advanced machine learning algorithms ensure 99.5%+ accuracy with automated quality checks and multi-level human verification.',
    gradient: 'from-blue-500 to-cyan-500',
    stats: { value: '99.5%', label: 'Accuracy Rate' },
    highlights: ['ML algorithms', 'Multi-level verification', 'Automated QA', 'Real-time monitoring']
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Get results in minutes, not days. Our distributed workforce processes 1M+ tasks daily with sub-hour turnaround.',
    gradient: 'from-amber-500 to-orange-500',
    stats: { value: '< 1 hour', label: 'Average Delivery' },
    highlights: ['1M+ tasks daily', 'Sub-hour delivery', 'Real-time processing', 'Global workforce']
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'SOC 2 Type II certified with end-to-end encryption, GDPR compliance, and comprehensive audit trails for maximum data protection.',
    gradient: 'from-green-500 to-emerald-500',
    stats: { value: 'SOC 2', label: 'Type II Certified' },
    highlights: ['End-to-end encryption', 'GDPR compliant', 'Audit trails', 'Data protection']
  },
  {
    icon: Globe,
    title: 'Global Scale',
    description: '500K+ skilled workers across 150+ countries, supporting 50+ languages with 24/7 availability for consistent worldwide coverage.',
    gradient: 'from-purple-500 to-pink-500',
    stats: { value: '500K+', label: 'Active Workers' },
    highlights: ['150+ countries', '50+ languages', '24/7 availability', 'Global coverage']
  },
  {
    icon: TrendingUp,
    title: 'Smart Analytics',
    description: 'Real-time insights, detailed metrics, and predictive analytics to optimize your data pipeline and make informed decisions.',
    gradient: 'from-red-500 to-rose-500',
    stats: { value: 'Real-time', label: 'Analytics' },
    highlights: ['Detailed metrics', 'Predictive analytics', 'Custom dashboards', 'API access']
  },
  {
    icon: Users,
    title: 'Expert Workforce',
    description: 'Curated talent pool with specialized expertise in computer vision, NLP, audio, and complex data annotation.',
    gradient: 'from-indigo-500 to-blue-500',
    stats: { value: 'Expert', label: 'Talent Pool' },
    highlights: ['Specialized expertise', 'Skill verification', 'Performance tracking', 'Quality assurance']
  }
]

const capabilities = [
  {
    icon: Cpu,
    title: 'Computer Vision',
    description: 'Advanced image and video annotation',
    features: ['Image Classification', 'Object Detection', 'Semantic Segmentation', 'Bounding Boxes', 'Keypoint Detection', 'Video Tracking'],
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Bot,
    title: 'Natural Language',
    description: 'Comprehensive text processing and understanding',
    features: ['Text Classification', 'Sentiment Analysis', 'Named Entity Recognition', 'Text Generation', 'Translation', 'Summarization'],
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Database,
    title: 'Data Processing',
    description: 'Professional data cleaning and preparation',
    features: ['Data Cleaning', 'Normalization', 'Validation', 'Annotation', 'Label Verification', 'Quality Control'],
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: Network,
    title: 'Advanced ML',
    description: 'Cutting-edge machine learning support',
    features: ['RLHF', '3D Point Clouds', 'Video Annotation', 'Audio Transcription', 'Sensor Fusion', 'Custom Schemas'],
    color: 'from-amber-500 to-orange-500'
  }
]

const metrics = [
  { value: '99.5%', label: 'Accuracy Rate', description: 'Industry-leading precision' },
  { value: '1M+', label: 'Daily Tasks', description: 'Processing capacity' },
  { value: '< 1hr', label: 'Turnaround', description: 'Average delivery time' },
  { value: '150+', label: 'Countries', description: 'Global workforce reach' }
]

export default function Features() {
  return (
    <section className="py-24 lg:py-32 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-6 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto mb-20"
        >
          <Badge className="mb-6 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-cyan-300 border-blue-500/30">
            <Target className="w-4 h-4 mr-2" />
            Industry-Leading Capabilities
          </Badge>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="block text-white mb-4">Everything You Need for</span>
            <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              Superior AI Training Data
            </span>
          </h2>

          <p className="text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
            Our comprehensive platform combines cutting-edge technology with human intelligence
            to deliver the highest quality training data for your AI applications.
          </p>
        </motion.div>

        {/* Core Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24"
        >
          {coreFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className="group"
            >
              <Card className="relative h-full border-0 shadow-2xl bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all duration-500 hover:shadow-3xl hover:scale-105 overflow-hidden">
                {/* Gradient background overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                <CardContent className="relative p-8">
                  {/* Icon and Stats */}
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                        {feature.stats.value}
                      </div>
                      <div className="text-sm text-gray-400">{feature.stats.label}</div>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-cyan-400 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-gray-300 leading-relaxed mb-6">
                    {feature.description}
                  </p>

                  {/* Highlights */}
                  <div className="space-y-2 mb-6">
                    {feature.highlights.slice(0, 3).map((highlight) => (
                      <div key={highlight} className="flex items-center text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" />
                        <span className="text-gray-300">{highlight}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <Button variant="ghost" className="group/btn text-cyan-400 hover:text-cyan-300 p-0 h-auto font-medium">
                    Learn more
                    <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Capabilities Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mb-24"
        >
          <div className="text-center mb-16">
            <h3 className="text-3xl lg:text-4xl font-bold mb-6">
              <span className="block text-white mb-4">Comprehensive AI Training</span>
              <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                Data Capabilities
              </span>
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              From simple classification to complex 3D annotation, we cover every aspect of AI data preparation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
            {capabilities.map((capability, index) => (
              <motion.div
                key={capability.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.15 }}
                className="group"
              >
                <Card className="h-full border-0 shadow-xl bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all duration-500 hover:shadow-2xl hover:scale-105">
                  <CardContent className="p-8">
                    {/* Icon */}
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${capability.color} flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300`}>
                      <capability.icon className="w-10 h-10 text-white" />
                    </div>

                    {/* Content */}
                    <h4 className="text-xl font-bold mb-3 text-white text-center group-hover:text-cyan-400 transition-colors duration-300">
                      {capability.title}
                    </h4>
                    <p className="text-gray-400 text-sm text-center mb-6">{capability.description}</p>

                    {/* Features */}
                    <div className="space-y-2">
                      {capability.features.slice(0, 4).map((feature) => (
                        <div key={feature} className="flex items-center text-sm">
                          <Star className="w-3 h-3 text-amber-400 mr-2 flex-shrink-0" />
                          <span className="text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Metrics Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-r from-blue-900/30 via-purple-900/20 to-cyan-900/30 backdrop-blur-sm">
            <CardContent className="p-16">
              {/* Background Effects */}
              <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>

              <div className="relative z-10">
                <div className="text-center mb-16">
                  <h3 className="text-3xl font-bold mb-6 text-white">
                    Trusted by Leading AI Companies
                  </h3>
                  <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                    Delivering exceptional results with metrics that speak for themselves
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {metrics.map((metric, index) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      className="text-center"
                    >
                      <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                        {metric.value}
                      </div>
                      <div className="text-lg font-semibold text-white mb-1">{metric.label}</div>
                      <div className="text-sm text-gray-400">{metric.description}</div>
                    </motion.div>
                  ))}
                </div>

                {/* CTA */}
                <div className="text-center mt-16">
                  <Button
                    size="lg"
                    className="text-lg px-12 py-6 h-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 border-0 shadow-2xl group transition-all duration-300 transform hover:scale-105"
                  >
                    <Award className="w-5 h-5 mr-2" />
                    Start Your Free Trial
                    <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <p className="text-sm text-gray-400 mt-4">
                    No credit card required • Setup in minutes • 14-day free trial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}