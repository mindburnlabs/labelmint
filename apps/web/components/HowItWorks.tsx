'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Upload,
  Cpu,
  Users,
  CheckCircle,
  Play,
  Clock,
  Zap,
  BarChart3,
  Shield,
  Globe,
  Code,
  FileText,
  Image,
  Video,
  Mic,
  HeadphonesIcon,
  MessageSquare,
  Bot
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const steps = [
  {
    number: '1',
    title: 'Upload Your Data',
    description: 'Easily upload images, text, audio, or video files through our intuitive interface or API.',
    icon: Upload,
    color: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/5 to-cyan-500/5',
    details: [
      'Support for 50+ file formats',
      'Bulk upload via drag & drop',
      'API integration for automated workflows',
      'Secure cloud storage with encryption'
    ]
  },
  {
    number: '2',
    title: 'Configure Requirements',
    description: 'Define your annotation needs, quality standards, and specific instructions.',
    icon: Cpu,
    color: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/5 to-pink-500/5',
    details: [
      'Custom annotation interfaces',
      'Detailed instruction templates',
      'Quality thresholds and guidelines',
      'Custom labeling schemas'
    ]
  },
  {
    number: '3',
    title: 'Expert Processing',
    description: 'Our curated workforce performs annotations with real-time quality monitoring.',
    icon: Users,
    color: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-500/5 to-emerald-500/5',
    details: [
      '500K+ trained annotators',
      'AI-powered task matching',
      'Real-time quality assurance',
      'Multi-level verification process'
    ]
  },
  {
    number: '4',
    title: 'Receive Results',
    description: 'Get high-quality labeled data with comprehensive analytics and insights.',
    icon: CheckCircle,
    color: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-500/5 to-orange-500/5',
    details: [
      'Export in multiple formats',
      'Detailed quality metrics',
      'Performance analytics',
      'Iterative feedback system'
    ]
  }
]

const dataTypes = [
  {
    icon: Image,
    name: 'Images',
    description: 'Classification, detection, segmentation',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: FileText,
    name: 'Text',
    description: 'Classification, NER, sentiment analysis',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Video,
    name: 'Video',
    description: 'Object tracking, action recognition',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: Mic,
    name: 'Audio',
    description: 'Transcription, sentiment analysis',
    color: 'from-amber-500 to-orange-500'
  }
]

const qualityMetrics = [
  { label: 'Accuracy Rate', value: '99.5%', color: 'text-green-400' },
  { label: 'Avg. Turnaround', value: '< 1 hour', color: 'text-cyan-400' },
  { label: 'Active Annotators', value: '500K+', color: 'text-purple-400' },
  { label: 'Daily Capacity', value: '1M+ tasks', color: 'text-amber-400' }
]

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0)

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
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-cyan-300 border-blue-500/30 rounded-full text-sm font-medium mb-8">
            <Zap className="w-5 h-5 mr-2" />
            Simple 4-Step Process
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="block text-white mb-4">From Raw Data to</span>
            <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              AI-Ready Labels
            </span>
          </h2>

          <p className="text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
            Our streamlined process makes it easy to get high-quality training data for your AI models.
            From upload to delivery in as little as one hour.
          </p>
        </motion.div>

        {/* Main Steps */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative"
              >
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary/20 to-transparent" />
                )}

                <Card
                  className={`relative h-full border-0 shadow-2xl bg-slate-900/50 backdrop-blur-sm hover:bg-slate-900/70 transition-all duration-500 hover:shadow-3xl hover:scale-105 cursor-pointer overflow-hidden group ${
                    activeStep === index
                      ? 'ring-2 ring-cyan-500/50 bg-slate-900/70'
                      : ''
                  }`}
                  onClick={() => setActiveStep(index)}
                >
                  {/* Gradient background overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardContent className="relative p-6">
                    {/* Step Number */}
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      {step.number}
                    </div>

                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${step.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <step.icon className="w-8 h-8 text-white" />
                    </div>

                    {/* Content */}
                    <h3 className="text-2xl font-bold mb-3 text-white group-hover:text-cyan-400 transition-colors duration-300">{step.title}</h3>
                    <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                      {step.description}
                    </p>

                    {/* Expand/Collapse Indicator */}
                    <div className="flex items-center text-cyan-400 text-sm font-medium">
                      {activeStep === index ? 'Show less' : 'Learn more'}
                      <ArrowRight className={`w-4 h-4 ml-2 transition-transform ${
                        activeStep === index ? 'rotate-90' : ''
                      }`} />
                    </div>

                    {/* Expanded Details */}
                    {activeStep === index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-6 pt-6 border-t border-border/50"
                      >
                        <ul className="space-y-3">
                          {step.details.map((detail) => (
                            <li key={detail} className="flex items-start text-sm">
                              <CheckCircle className="w-4 h-4 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Interactive Demo */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20"
        >
          {/* Left Side - Demo Interface */}
          <div>
            <h3 className="text-3xl font-bold mb-6">
              Try Our Interactive Demo
            </h3>
            <p className="text-xl text-muted-foreground mb-8">
              Experience the simplicity of our platform with a live demonstration.
            </p>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="p-8">
                <div className="space-y-6">
                  {/* Demo Steps */}
                  <div className="flex items-center justify-between">
                    {steps.map((step, index) => (
                      <div key={index} className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                          activeStep === index
                            ? 'bg-primary text-primary-foreground'
                            : index < activeStep
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {index < activeStep ? <Check className="w-5 h-5" /> : step.number}
                        </div>
                        {index < steps.length - 1 && (
                          <div className={`w-16 h-0.5 mx-2 transition-colors ${
                            index < activeStep ? 'bg-green-500' : 'bg-muted'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Demo Content */}
                  <div className="bg-background rounded-lg p-6 border">
                    <div className="text-center">
                      <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${steps[activeStep].color} text-white mb-4`}>
                        {React.createElement(steps[activeStep].icon, { className: "w-8 h-8" })}
                      </div>
                      <h4 className="text-xl font-bold mb-2">{steps[activeStep].title}</h4>
                      <p className="text-muted-foreground">{steps[activeStep].description}</p>
                    </div>
                  </div>

                  {/* Demo Controls */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                      disabled={activeStep === 0}
                    >
                      Previous
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Step {activeStep + 1} of {steps.length}
                    </div>
                    <Button
                      onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
                      disabled={activeStep === steps.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Data Types */}
          <div>
            <h3 className="text-3xl font-bold mb-6">
              Supported Data Types
            </h3>
            <p className="text-xl text-muted-foreground mb-8">
              We support all major data formats for comprehensive AI training.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {dataTypes.map((type) => (
                <motion.div
                  key={type.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="group"
                >
                  <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-muted/30 to-muted/10">
                    <CardContent className="p-6">
                      <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-r ${type.color} text-white mb-4`}>
                        <type.icon className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-bold mb-2">{type.name}</h4>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Quality Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
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
                    Unmatched Quality & Speed
                  </h3>
                  <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                    Industry-leading metrics you can count on
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {qualityMetrics.map((metric, index) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      className="text-center"
                    >
                      <div className={`text-4xl lg:text-5xl font-bold bg-gradient-to-r ${metric.color} bg-clip-text text-transparent mb-2`}>
                        {metric.value}
                      </div>
                      <div className="text-lg font-semibold text-white mb-1">{metric.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* CTA */}
                <div className="text-center mt-16">
                  <Button
                    size="lg"
                    className="text-lg px-12 py-6 h-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 border-0 shadow-2xl group transition-all duration-300 transform hover:scale-105"
                  >
                    Start Your First Project
                    <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <p className="text-sm text-gray-400 mt-4">
                    No credit card required • Setup in minutes
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