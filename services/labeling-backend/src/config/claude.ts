export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export interface ClaudeClassificationRequest {
  text: string;
  categories: string[];
  instructions?: string;
  examples?: Array<{ input: string; output: string }>;
}

export interface ClaudeValidationRequest {
  taskData: any;
  workerLabel: string;
  otherLabels?: string[];
  taskType: string;
  categories?: string[];
}

export interface ClaudeExampleGenerationRequest {
  taskType: string;
  categories: string[];
  instructions: string;
  count?: number;
}

export interface ClaudeResponse {
  success: boolean;
  prediction?: string;
  confidence?: number;
  reasoning?: string;
  examples?: Array<{ input: string; output: string; explanation?: string }>;
  validation?: {
    isValid: boolean;
    confidence: number;
    suspicious: boolean;
    issues?: string[];
    suggestedLabel?: string;
  };
  error?: string;
}

export const CLAUDE_CONFIG: ClaudeConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
  maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '1000'),
  temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.1'),
  timeout: parseInt(process.env.CLAUDE_TIMEOUT || '10000')
};

export const CLASSIFICATION_PROMPTS = {
  text_classification: {
    system: "You are an expert text classification assistant. Analyze the given text and classify it into one of the provided categories. Respond with a JSON object containing: prediction (the category), confidence (0-1), and reasoning (brief explanation).",
    user: (categories: string[], text: string) => `
Classify the following text into one of these categories: ${categories.join(', ')}.

Text: "${text}"

Respond with JSON:
{
  "prediction": "category_name",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this category fits"
}
`
  },
  sentiment_analysis: {
    system: "You are a sentiment analysis expert. Classify text sentiment as positive, negative, or neutral. Consider context, sarcasm, and subtle emotional cues.",
    user: (text: string) => `
Analyze sentiment: "${text}"

Respond with JSON:
{
  "prediction": "positive|negative|neutral",
  "confidence": 0.95,
  "reasoning": "Explanation of sentiment analysis"
}
`
  },
  content_moderation: {
    system: "You are a content moderation specialist. Identify potentially harmful content including hate speech, harassment, violence, or inappropriate material.",
    user: (text: string) => `
Moderate this content: "${text}"

Respond with JSON:
{
  "prediction": "safe|hate_speech|harassment|violence|inappropriate|spam",
  "confidence": 0.95,
  "reasoning": "Explanation of moderation decision"
}
`
  }
};

export const VALIDATION_PROMPTS = {
  text_classification: {
    system: "You are a quality assurance specialist for text labeling. Verify worker submissions against the ground truth. Flag suspicious patterns, spam, or incorrect labels.",
    user: (taskData: any, workerLabel: string, otherLabels: string[]) => `
Task: ${taskData.title}
Categories: ${taskData.options?.join(', ') || 'N/A'}
Text to classify: "${taskData.data?.text || taskData.data}"

Worker's label: "${workerLabel}"
${otherLabels?.length ? `Other worker labels: ${otherLabels.join(', ')}` : ''}

Evaluate this submission. Consider:
1. Does the label match the text content?
2. Is it consistent with other worker submissions?
3. Could this be spam or random clicking?
4. Is the worker showing a pattern of incorrect labels?

Respond with JSON:
{
  "validation": {
    "isValid": true|false,
    "confidence": 0.95,
    "suspicious": true|false,
    "issues": ["List of any issues found"],
    "suggestedLabel": "Correct label if different"
  }
}
`
  },
  image_classification: {
    system: "You are analyzing image classification labels. Workers describe images based on given categories. Verify if the descriptions match typical images for these categories.",
    user: (taskData: any, workerLabel: string) => `
Image Task: ${taskData.title}
Categories: ${taskData.options?.join(', ') || 'N/A'}
Image description/URL provided to worker

Worker's classification: "${workerLabel}"

Evaluate if this is a reasonable classification. Workers make mistakes but flag clearly incorrect or random responses.

Respond with JSON:
{
  "validation": {
    "isValid": true|false,
    "confidence": 0.95,
    "suspicious": true|false,
    "issues": ["Any concerns about this label"],
    "suggestedLabel": "More appropriate category if needed"
  }
}
`
  }
};

export const EXAMPLE_GENERATION_PROMPTS = {
  text_classification: {
    system: "You are generating clear examples to help workers understand text classification tasks. Create diverse, unambiguous examples that clearly demonstrate each category.",
    user: (taskType: string, categories: string[], instructions: string, count: number = 5) => `
Generate ${count} examples for each category to help workers understand this task.

Task Type: ${taskType}
Categories: ${categories.join(', ')}
Instructions: ${instructions}

For each category, provide examples that:
- Clearly represent the category
- Are diverse in content and style
- Help avoid common mistakes
- Are safe for work

Respond with JSON:
{
  "examples": [
    {
      "category": "category_name",
      "examples": [
        {
          "input": "Example text",
          "output": "category_name",
          "explanation": "Why this fits the category"
        }
      ]
    }
  ]
}
`
  }
};