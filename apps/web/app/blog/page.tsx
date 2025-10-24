import Link from 'next/link'
import { Calendar, Clock, ArrowRight } from 'lucide-react'

const blogPosts = [
  {
    slug: 'how-to-label-data-for-machine-learning',
    title: 'How to Label Data for Machine Learning: A Complete Guide',
    excerpt: 'Learn the best practices for data labeling, from preparation to quality assurance. This comprehensive guide covers everything ML teams need to know about creating high-quality training data.',
    date: '2024-01-15',
    readTime: '8 min read',
    category: 'Guide'
  },
  {
    slug: 'data-labeling-pricing-guide',
    title: 'Data Labeling Pricing Guide 2024: What You Should Actually Pay',
    excerpt: 'Compare data labeling prices across providers and understand the true cost of quality annotation. Learn how to save up to 90% on your labeling budget without compromising quality.',
    date: '2024-01-10',
    readTime: '6 min read',
    category: 'Pricing'
  },
  {
    slug: 'scale-ai-alternatives',
    title: 'Top 5 Scale AI Alternatives for Data Labeling in 2024',
    excerpt: 'Looking for Scale AI alternatives? We\'ve compared the top 5 data labeling platforms on price, quality, and features. Find out which option is best for your ML projects.',
    date: '2024-01-05',
    readTime: '10 min read',
    category: 'Comparison'
  },
  {
    slug: 'telegram-data-labeling',
    title: 'Why Telegram is the Future of Data Labeling',
    excerpt: 'Discover how Telegram is revolutionizing data labeling with instant access to 500,000+ labelers. Learn about the benefits of mobile-first annotation platforms.',
    date: '2023-12-28',
    readTime: '5 min read',
    category: 'Innovation'
  },
  {
    slug: 'data-labeling-quality-assurance',
    title: 'Quality Assurance in Data Labeling: Best Practices',
    excerpt: 'Ensure 99%+ accuracy in your labeled data with these proven QA strategies. Learn about consensus mechanisms, review workflows, and quality metrics.',
    date: '2023-12-20',
    readTime: '7 min read',
    category: 'Quality'
  },
  {
    slug: 'ml-data-annotation-types',
    title: 'Types of Data Annotation for Machine Learning Projects',
    excerpt: 'From image classification to NLP annotation, understand all types of data labeling tasks and their specific requirements for ML model training.',
    date: '2023-12-15',
    readTime: '9 min read',
    category: 'Tutorial'
  }
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Deligate.it Blog
            </h1>
            <p className="text-xl text-gray-600">
              Insights, guides, and best practices for data labeling and machine learning
            </p>
          </div>

          <div className="space-y-8">
            {blogPosts.map((post) => (
              <article
                key={post.slug}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-medium">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {new Date(post.date).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {post.readTime}
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-primary-600 transition-colors">
                  <Link href={`/blog/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>

                <p className="text-gray-600 mb-4">
                  {post.excerpt}
                </p>

                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
                >
                  Read more
                  <ArrowRight size={16} className="ml-1" />
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="bg-primary-50 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Need high-quality data labeling?
              </h3>
              <p className="text-gray-600 mb-6">
                Get started with Deligate.it and save up to 90% on data labeling costs
              </p>
              <a href="/" className="btn-primary">
                Get Started in 5 Minutes
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}