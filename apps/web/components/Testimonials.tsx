'use client'

import { motion } from 'framer-motion'
import {
  Star,
  Quote,
  TrendingUp,
  Users,
  Award,
  Globe,
  CheckCircle2,
  Building2,
  Zap,
  Shield
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const testimonials = [
  {
    id: 1,
    content: "LabelMint transformed our AI development pipeline. We reduced data labeling costs by 85% while improving accuracy from 92% to 99.5%. The turnaround time is incredible - what used to take weeks now takes hours.",
    author: "Sarah Chen",
    role: "CTO",
    company: "NeuralTech AI",
    companyType: "Enterprise",
    avatar: "SC",
    rating: 5,
    metrics: {
      savings: "85%",
      accuracy: "99.5%",
      timeSaved: "3 weeks"
    },
    logo: "🤖"
  },
  {
    id: 2,
    content: "The quality and speed are unmatched. We've processed over 2 million tasks with LabelMint, and the consistency has been exceptional. Their expert workforce understands complex computer vision requirements better than any other platform we've tried.",
    author: "Michael Rodriguez",
    role: "Head of Machine Learning",
    company: "Visionary Labs",
    companyType: "Startup",
    avatar: "MR",
    rating: 5,
    metrics: {
      tasksProcessed: "2M+",
      consistency: "99.8%",
      satisfaction: "100%"
    },
    logo: "👁️"
  },
  {
    id: 3,
    content: "As a rapidly growing startup, we needed a scalable solution that could grow with us. LabelMint delivered exactly that. The platform handles everything from simple classification to complex 3D point cloud annotation with equal expertise.",
    author: "Emily Watson",
    role: "AI Research Lead",
    company: "DataMind Solutions",
    companyType: "Scale-up",
    avatar: "EW",
    rating: 5,
    metrics: {
      scalability: "10x",
      annotationTypes: "15+",
      support: "24/7"
    },
    logo: "🧠"
  },
  {
    id: 4,
    content: "The enterprise-grade security and compliance features were crucial for our healthcare AI applications. LabelMint's SOC 2 Type II certification and GDPR compliance gave us the confidence to move forward. The quality is outstanding.",
    author: "Dr. James Park",
    role: "Director of AI",
    company: "MediTech Innovations",
    companyType: "Healthcare",
    avatar: "JP",
    rating: 5,
    metrics: {
      compliance: "SOC 2",
      security: "Enterprise",
      dataPrivacy: "GDPR"
    },
    logo: "🏥"
  },
  {
    id: 5,
    content: "We compared LabelMint against Scale AI, Amazon SageMaker, and Labelbox. LabelMint offered the best combination of quality, speed, and price. The API integration was seamless, and their support team is incredibly responsive.",
    author: "Alex Thompson",
    role: "VP of Engineering",
    company: "CloudScale Systems",
    companyType: "Enterprise",
    avatar: "AT",
    rating: 5,
    metrics: {
      vsCompetitors: "90% cheaper",
      integration: "1 day",
      support: "<1hr response"
    },
    logo: "☁️"
  },
  {
    id: 6,
    content: "The multilingual capabilities and global workforce were game-changers for our international projects. LabelMint helped us annotate data in 12 different languages with consistent quality across all regions.",
    author: "Priya Sharma",
    role: "Global Product Manager",
    company: "WorldWide AI",
    companyType: "Global",
    avatar: "PS",
    rating: 5,
    metrics: {
      languages: "12",
      countries: "25",
      quality: "Uniform"
    },
    logo: "🌍"
  }
]

const companyStats = [
  { icon: Building2, value: "1,000+", label: "Companies Trust LabelMint" },
  { icon: Users, value: "500K+", label: "Expert Annotators" },
  { icon: Globe, value: "150+", label: "Countries Served" },
  { icon: Award, value: "99.5%", label: "Customer Satisfaction" }
]

const trustBadges = [
  "SOC 2 Type II Certified",
  "GDPR Compliant",
  "Enterprise Security",
  "24/7 Support",
  "ISO 27001",
  "HIPAA Compliant"
]

export default function Testimonials() {
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
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30 rounded-full text-sm font-medium mb-8">
            <Star className="w-5 h-5 mr-2" />
            Trusted by Industry Leaders
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="block text-white mb-4">What Our Customers</span>
            <span className="block bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              Say About Us
            </span>
          </h2>

          <p className="text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
            Don't just take our word for it. Hear from the AI leaders who have transformed
            their data labeling workflows with LabelMint.
          </p>
        </motion.div>

        {/* Company Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mb-20"
        >
          <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-r from-blue-900/30 via-purple-900/20 to-cyan-900/30 backdrop-blur-sm">
            <CardContent className="p-12">
              {/* Background Effects */}
              <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>

              <div className="relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {companyStats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      className="text-center"
                    >
                      <div className="flex items-center justify-center mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/30">
                          <stat.icon className="w-6 h-6 text-cyan-400" />
                        </div>
                      </div>
                      <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-1">
                        {stat.value}
                      </div>
                      <div className="text-sm text-gray-400">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Testimonials Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20"
        >
          {testimonials.map((testimonial) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: testimonial.id * 0.1 }}
              className="group"
            >
              <Card className="relative h-full border-0 shadow-2xl bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all duration-500 hover:shadow-3xl hover:scale-105 overflow-hidden">
                {/* Gradient background overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <CardContent className="relative p-8">
                  {/* Quote icon */}
                  <div className="absolute top-6 right-6">
                    <Quote className="w-8 h-8 text-blue-500/20" />
                  </div>

                  {/* Company logo and type */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className="text-2xl mr-3">{testimonial.logo}</div>
                      <div>
                        <div className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors duration-300">
                          {testimonial.company}
                        </div>
                        <Badge variant="secondary" className="text-xs bg-slate-800 text-gray-400">
                          {testimonial.companyType}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center mb-6">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                    ))}
                  </div>

                  {/* Content */}
                  <p className="text-gray-300 leading-relaxed mb-8 italic">
                    "{testimonial.content}"
                  </p>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {Object.entries(testimonial.metrics).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="text-lg font-bold text-cyan-400">{value}</div>
                        <div className="text-xs text-gray-500 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Author */}
                  <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold mr-4">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="font-bold text-white">{testimonial.author}</div>
                        <div className="text-sm text-gray-400">{testimonial.role}</div>
                      </div>
                    </div>
                    <div className="text-green-400">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <div className="flex flex-wrap justify-center items-center gap-8">
            {trustBadges.map((badge) => (
              <div
                key={badge}
                className="flex items-center px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-full text-sm text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300"
              >
                <Shield className="w-4 h-4 mr-2" />
                {badge}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}