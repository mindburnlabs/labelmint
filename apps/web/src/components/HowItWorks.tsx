'use client'

import { motion } from 'framer-motion'
import {
  Upload,
  Users,
  CheckCircle,
  Coins,
  ArrowRight,
  FileImage,
  MessageSquare,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const steps = [
  {
    id: 1,
    title: 'Upload Your Data',
    description: 'Simply upload your images, text, or any data that needs labeling through our intuitive interface.',
    icon: Upload,
    features: ['Drag & drop interface', 'Multiple format support', 'Bulk upload capabilities'],
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20'
  },
  {
    id: 2,
    title: 'Configure Tasks',
    description: 'Define your labeling requirements with our flexible task configuration system.',
    icon: MessageSquare,
    features: ['Custom labeling guidelines', 'Quality requirements', 'Pricing per task'],
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20'
  },
  {
    id: 3,
    title: 'Workers Label',
    description: 'Our network of 500K+ Telegram workers starts labeling your data immediately.',
    icon: Users,
    features: ['500K+ vetted workers', '24/7 availability', 'Multi-language support'],
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20'
  },
  {
    id: 4,
    title: 'Quality Control',
    description: 'Multiple workers review each task with AI-powered quality assurance.',
    icon: CheckCircle,
    features: ['98.5% accuracy guarantee', 'Consensus validation', 'Automated QA'],
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20'
  },
  {
    id: 5,
    title: 'Review Results',
    description: 'Monitor progress in real-time and review completed labels through our dashboard.',
    icon: BarChart3,
    features: ['Real-time analytics', 'Progress tracking', 'Detailed reporting'],
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/20'
  },
  {
    id: 6,
    title: 'Pay Workers',
    description: 'Automated TON/USDT payments distribute earnings instantly to workers.',
    icon: Coins,
    features: ['Instant blockchain payments', 'Transparent transactions', 'Fair worker compensation'],
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20'
  }
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-secondary/50">
      <div className="container">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            How LabelMint
            <span className="gradient-text ml-2">Works</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From data upload to labeled results in six simple steps. Get high-quality training data
            with the speed and transparency of blockchain technology.
          </p>
        </motion.div>

        {/* Steps Timeline */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* Step Number */}
                <div className="flex items-start mb-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg mr-4 flex-shrink-0">
                    {step.id}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground mb-4">{step.description}</p>
                  </div>
                </div>

                {/* Step Card */}
                <Card className="ml-16 hover-lift">
                  <CardHeader>
                    <div className={`w-16 h-16 rounded-xl ${step.bgColor} flex items-center justify-center mb-4`}>
                      <step.icon className={`w-8 h-8 ${step.color}`} />
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {step.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary mr-3 flex-shrink-0"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Arrow Connector */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-24 right-0 transform translate-x-1/2">
                    <ArrowRight className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Interactive Demo Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/10">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileImage className="w-10 h-10 text-primary" />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-4">
                Try Our Interactive Demo
              </h3>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Experience the power of LabelMint with our hands-on demo. Upload sample data,
                configure tasks, and see real-time labeling in action.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-lg px-8 py-4">
                  <FileImage className="w-5 h-5 mr-2" />
                  Launch Demo
                </Button>
                <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                  Watch Video Tutorial
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}