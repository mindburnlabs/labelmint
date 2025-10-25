'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Github,
  Twitter,
  Linkedin,
  Zap,
  Mail,
  Shield,
  Globe,
  Users,
  Award,
  BookOpen,
  HelpCircle,
  FileText,
  Code,
  MessageSquare,
  ChevronRight
} from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800">
      <div className="container mx-auto px-6 max-w-7xl py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-2"
          >
            <Link href="/" className="flex items-center space-x-3 mb-6 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white group-hover:text-cyan-400 transition-colors duration-300">LabelMint</span>
            </Link>
            <p className="text-gray-400 mb-8 max-w-md leading-relaxed">
              Enterprise-grade data labeling platform powered by 500K+ expert annotators worldwide.
              Get 99.5% accuracy with sub-hour turnaround at 90% less cost than traditional platforms.
            </p>

            {/* Social Links */}
            <div className="flex space-x-4 mb-8">
              <a href="#" className="w-10 h-10 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300 hover:scale-110">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300 hover:scale-110">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300 hover:scale-110">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300 hover:scale-110">
                <Mail className="w-5 h-5" />
              </a>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center px-3 py-1 bg-slate-800/50 border border-slate-700 rounded-full text-xs text-gray-400">
                <Shield className="w-3 h-3 mr-1" />
                SOC 2 Type II
              </div>
              <div className="flex items-center px-3 py-1 bg-slate-800/50 border border-slate-700 rounded-full text-xs text-gray-400">
                <Globe className="w-3 h-3 mr-1" />
                GDPR Compliant
              </div>
              <div className="flex items-center px-3 py-1 bg-slate-800/50 border border-slate-700 rounded-full text-xs text-gray-400">
                <Award className="w-3 h-3 mr-1" />
                Enterprise Ready
              </div>
            </div>
          </motion.div>

          {/* Product */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h4 className="font-semibold mb-6 text-white">Product</h4>
            <ul className="space-y-4">
              <li>
                <Link href="#features" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <ChevronRight className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Features
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <ChevronRight className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <ChevronRight className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/api" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <ChevronRight className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  API Documentation
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <ChevronRight className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Integrations
                </Link>
              </li>
            </ul>
          </motion.div>

          {/* Resources */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h4 className="font-semibold mb-6 text-white">Resources</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/blog" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <BookOpen className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/guides" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <FileText className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Guides
                </Link>
              </li>
              <li>
                <Link href="/case-studies" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <Award className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Case Studies
                </Link>
              </li>
              <li>
                <Link href="/support" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <HelpCircle className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Support Center
                </Link>
              </li>
              <li>
                <Link href="/api-docs" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <Code className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  API Docs
                </Link>
              </li>
            </ul>
          </motion.div>

          {/* Company */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h4 className="font-semibold mb-6 text-white">Company</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/about" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <Users className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/careers" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <Award className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/contact" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <MessageSquare className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <Shield className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="flex items-center text-gray-400 hover:text-cyan-400 transition-colors text-sm group">
                  <FileText className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  Terms of Service
                </Link>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Bottom Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="border-t border-slate-800 mt-16 pt-8"
        >
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-6 lg:space-y-0">
            <div className="text-center lg:text-left">
              <p className="text-gray-400 text-sm mb-2">
                © 2024 LabelMint. All rights reserved. Built with ❤️ for the AI community.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start items-center gap-6 text-xs text-gray-500">
                <span className="flex items-center">
                  <Shield className="w-3 h-3 mr-1" />
                  Enterprise Security
                </span>
                <span className="flex items-center">
                  <Globe className="w-3 h-3 mr-1" />
                  Global Scale
                </span>
                <span className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  Expert Workforce
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-8">
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>All Systems Operational</span>
              </div>
              <div className="flex items-center space-x-6 text-xs text-gray-500">
                <span>USDT Payments</span>
                <span>•</span>
                <span>TON Blockchain</span>
                <span>•</span>
                <span>24/7 Support</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}