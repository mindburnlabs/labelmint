'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@labelmint/ui';
import { apiClient } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import {
  ArrowLeft,
  Upload,
  Link as LinkIcon,
  FileText,
  Image,
  MessageSquare,
  GitCompare,
  Box,
  X,
  Plus,
  DollarSign,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Progress } from '@labelmint/ui';

const TASK_TYPES = [
  { value: 'IMG_CLS', label: 'Image Classification', icon: Image, desc: 'Classify images into categories' },
  { value: 'TXT_CLS', label: 'Text Classification', icon: MessageSquare, desc: 'Categorize text content' },
  { value: 'RLHF_PAIR', label: 'RLHF Comparison', icon: GitCompare, desc: 'Compare AI responses' },
  { value: 'BBOX', label: 'Bounding Box', icon: Box, desc: 'Draw boxes around objects' },
];

const PRICING = {
  IMG_CLS: 0.06,
  TXT_CLS: 0.05,
  RLHF_PAIR: 0.06,
  BBOX: 0.12,
};

export default function CreateProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'IMG_CLS' as typeof TASK_TYPES[number]['value'],
    classes: [''] as string[],
    datasetUrl: '',
    budget: 50,
  });

  const totalSteps = 4;

  // Add class
  const addClass = () => {
    setFormData(prev => ({
      ...prev,
      classes: [...prev.classes, ''],
    }));
  };

  // Update class
  const updateClass = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      classes: prev.classes.map((c, i) => i === index ? value : c),
    }));
  };

  // Remove class
  const removeClass = (index: number) => {
    setFormData(prev => ({
      ...prev,
      classes: prev.classes.filter((_, i) => i !== index),
    }));
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setUploadProgress(0);

    try {
      // Create upload progress simulation
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const result = await apiClient.uploadDataset(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setFormData(prev => ({ ...prev, datasetUrl: result.url }));
      setUploadedFile(file);

      toast.success('File uploaded successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setIsLoading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate form
      const validClasses = formData.classes.filter(c => c.trim());
      if (validClasses.length < 2) {
        toast.error('Please add at least 2 labels');
        return;
      }

      if (!formData.datasetUrl) {
        toast.error('Please upload a dataset or provide a URL');
        return;
      }

      // Get user
      const user = await authClient.getCurrentUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Create project
      const project = await apiClient.createProject({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        classes: validClasses,
        datasetUrl: formData.datasetUrl,
        budget: formData.budget,
        pricePerLabel: PRICING[formData.type],
      });

      toast.success('Project created successfully!');
      router.push(`/dashboard/projects/${project.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate estimated cost
  const estimatedCost = PRICING[formData.type] * 3; // 3 judgments per item
  const maxItems = Math.floor(formData.budget / estimatedCost);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-primary">
                LabelMint
              </Link>
              <span className="ml-4 text-sm text-gray-500">Create Project</span>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Step {currentStep} of {totalSteps}
            </h2>
            <span className="text-sm text-gray-500">{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <Progress value={(currentStep / totalSteps) * 100} className="h-2" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Basic Info */}
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <h3 className="text-xl font-semibold mb-6">Project Information</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Project Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      placeholder="e.g., Cat vs Dog Classification"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      placeholder="Describe your project goals and requirements..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Budget (USD) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={formData.budget}
                        onChange={(e) => setFormData(prev => ({ ...prev, budget: Number(e.target.value) }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                        min="10"
                        step="0.01"
                        required
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Estimated items you can label: {maxItems.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <Button type="button" onClick={() => setCurrentStep(2)}>
                    Next Step
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 2: Task Type */}
          <AnimatePresence mode="wait">
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <h3 className="text-xl font-semibold mb-6">Select Task Type</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TASK_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          formData.type === type.value
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-8 w-8 mb-2 text-primary" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">{type.label}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{type.desc}</p>
                        <p className="text-xs text-primary mt-2">${PRICING[type.value]} per judgment</p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between mt-6">
                  <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                    Previous
                  </Button>
                  <Button type="button" onClick={() => setCurrentStep(3)}>
                    Next Step
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3: Labels */}
          <AnimatePresence mode="wait">
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <h3 className="text-xl font-semibold mb-6">Define Labels</h3>

                <div className="space-y-3">
                  {formData.classes.map((className, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={className}
                        onChange={(e) => updateClass(index, e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                        placeholder={`Label ${index + 1}`}
                      />
                      {formData.classes.length > 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeClass(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addClass}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Label
                </Button>

                <div className="flex justify-between mt-6">
                  <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                    Previous
                  </Button>
                  <Button type="button" onClick={() => setCurrentStep(4)}>
                    Next Step
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 4: Dataset */}
          <AnimatePresence mode="wait">
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <h3 className="text-xl font-semibold mb-6">Upload Dataset</h3>

                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  {uploadedFile ? (
                    <div>
                      <FileText className="mx-auto h-12 w-12 text-green-500" />
                      <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <Progress value={uploadProgress} className="mt-2" />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUploadedFile(null);
                          setFormData(prev => ({ ...prev, datasetUrl: '' }));
                        }}
                        className="mt-3"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-lg font-medium text-gray-900 dark:text-white">
                        Drop your dataset here or click to browse
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Supports ZIP, CSV, JSON up to 500MB
                      </p>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        className="hidden"
                        id="file-upload"
                        accept=".zip,.csv,.json"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={isLoading}
                        className="mt-4"
                      >
                        {isLoading ? 'Uploading...' : 'Choose File'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* URL Input */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Or provide dataset URL
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="url"
                      value={formData.datasetUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, datasetUrl: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700"
                      placeholder="https://example.com/dataset.zip"
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <Button type="button" variant="outline" onClick={() => setCurrentStep(3)}>
                    Previous
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Project'}
                    <Zap className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </main>
    </div>
  );
}