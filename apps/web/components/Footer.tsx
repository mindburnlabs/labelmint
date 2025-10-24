import Link from 'next/link'
import { Github, Twitter, Linkedin, Zap, Mail } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">LabelMint</span>
            </Link>
            <p className="text-muted-foreground mb-6 max-w-md">
              Professional data labeling marketplace powered by Telegram workers and TON blockchain.
              Get high-quality training data with transparent micropayments.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/api" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  API Documentation
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Integrations
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/guides" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Guides
                </Link>
              </li>
              <li>
                <Link href="/case-studies" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Case Studies
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Support Center
                </Link>
              </li>
              <li>
                <Link href="/status" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  System Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/security" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                  Security
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm mb-4 md:mb-0">
              © 2024 LabelMint. All rights reserved. Built with ❤️ for the AI community.
            </p>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <span>Powered by TON Blockchain</span>
              <span>•</span>
              <span>Telegram Workers</span>
              <span>•</span>
              <span>USDT Payments</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}