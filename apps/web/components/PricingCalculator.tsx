'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator, TrendingDown } from 'lucide-react'

export default function PricingCalculator() {
  const [tasks, setTasks] = useState(10000)
  const [complexity, setComplexity] = useState('medium')
  const [turnaround, setTurnaround] = useState('standard')

  const complexityRates = {
    simple: 0.02,
    medium: 0.05,
    complex: 0.15,
    expert: 0.75
  }

  const turnaroundMultipliers = {
    standard: 1,
    priority: 1.5,
    urgent: 2.5
  }

  const rate = complexityRates[complexity as keyof typeof complexityRates]
  const multiplier = turnaroundMultipliers[turnaround as keyof typeof turnaroundMultipliers]
  const basePrice = tasks * rate
  const totalPrice = basePrice * multiplier
  const scaleAiPrice = tasks * 0.25 * multiplier
  const savings = scaleAiPrice - totalPrice

  // Calculate savings percentage, guard against division by zero
  const savingsPercentage = scaleAiPrice > 0 ? Math.round((savings / scaleAiPrice) * 100) : 0

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center bg-white px-4 py-2 rounded-full shadow-sm mb-4">
            <Calculator className="w-4 h-4 mr-2 text-primary-600" />
            <span className="text-sm font-semibold">Pricing Calculator</span>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            See How Much You'll Save
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Compare our prices with Scale AI and see the savings instantly
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Tasks
                </label>
                <input
                  type="number"
                  value={tasks}
                  onChange={(e) => setTasks(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  min="1"
                />
                <input
                  type="range"
                  value={tasks}
                  onChange={(e) => setTasks(parseInt(e.target.value))}
                  className="w-full mt-2"
                  min="100"
                  max="100000"
                  step="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Complexity
                </label>
                <select
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="simple">Simple ($0.02/task)</option>
                  <option value="medium">Medium ($0.05/task)</option>
                  <option value="complex">Complex ($0.15/task)</option>
                  <option value="expert">Expert ($0.75/task)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Turnaround Time
                </label>
                <select
                  value={turnaround}
                  onChange={(e) => setTurnaround(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="standard">Standard (24h)</option>
                  <option value="priority">Priority (6h)</option>
                  <option value="urgent">Urgent (1h)</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Scale AI Price</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${scaleAiPrice.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                  <p className="text-sm text-gray-600 mb-1">Deligate.it Price</p>
                  <p className="text-3xl font-bold text-primary-600">
                    ${totalPrice.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 mr-1 text-green-600" />
                    Your Savings
                  </p>
                  <p className="text-3xl font-bold text-green-600">
                    ${savings.toLocaleString()}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    ({savingsPercentage}% off)
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button className="btn-primary text-lg px-8 py-3">
                Start Your Project
              </button>
              <p className="text-sm text-gray-500 mt-3">
                No credit card required • Setup in 5 minutes
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}