import { CLAUDE_CONFIG, ClaudeConfig, ClaudeClassificationRequest, ClaudeValidationRequest, ClaudeExampleGenerationRequest, ClaudeResponse } from '../config/claude';

class ClaudeService {
  private config: ClaudeConfig;

  constructor(config?: Partial<ClaudeConfig>) {
    this.config = { ...CLAUDE_CONFIG, ...config };
  }

  private async makeRequest(messages: Array<{ role: string; content: string }>): Promise<any> {
    if (!this.config.apiKey) {
      throw new Error('Claude API key not configured');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages,
          system: messages.find(m => m.role === 'system')?.content || ''
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Claude API error: ${response.status} - ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Claude API request timeout');
      }
      throw error;
    }
  }

  async classifyText(request: ClaudeClassificationRequest): Promise<ClaudeResponse> {
    try {
      const { text, categories, instructions, examples } = request;

      let promptText = `Classify the following text into one of these categories: ${categories.join(', ')}.\n\n`;
      promptText += `Text: "${text}"\n\n`;

      if (instructions) {
        promptText += `Instructions: ${instructions}\n\n`;
      }

      if (examples && examples.length > 0) {
        promptText += `Examples:\n`;
        examples.forEach((example, index) => {
          promptText += `${index + 1}. "${example.input}" → ${example.output}\n`;
        });
        promptText += '\n';
      }

      promptText += `Respond with a JSON object containing:
- prediction: the selected category
- confidence: number between 0 and 1
- reasoning: brief explanation (max 100 words)`;

      const messages = [
        {
          role: 'user',
          content: promptText
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.content[0]?.text || '';

      try {
        const parsed = JSON.parse(content);
        return {
          success: true,
          prediction: parsed.prediction,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning
        };
      } catch (parseError) {
        // Fallback: extract prediction from text
        const match = content.match(/prediction["\s:]+["']?(\w+)["']?/i);
        return {
          success: true,
          prediction: match?.[1] || categories[0],
          confidence: 0.5,
          reasoning: 'Parsing error occurred'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateLabel(request: ClaudeValidationRequest): Promise<ClaudeResponse> {
    try {
      const { taskData, workerLabel, otherLabels, taskType, categories } = request;

      let promptText = `You are a quality assurance specialist validating worker labels.\n\n`;
      promptText += `Task Details:\n`;
      promptText += `- Type: ${taskType}\n`;
      promptText += `- Title: ${taskData.title || 'N/A'}\n`;

      if (categories && categories.length > 0) {
        promptText += `- Categories: ${categories.join(', ')}\n`;
      }

      if (taskData.data) {
        promptText += `- Content: ${JSON.stringify(taskData.data)}\n`;
      }

      promptText += `\nWorker's Label: "${workerLabel}"\n`;

      if (otherLabels && otherLabels.length > 0) {
        promptText += `Other Worker Labels: ${otherLabels.join(', ')}\n`;
      }

      promptText += `\nEvaluate this submission. Check for:
1. Correctness (does the label match the content?)
2. Consistency (does it align with other workers?)
3. Suspicious patterns (spam, random clicking, automated responses)
4. Quality indicators (time spent, pattern analysis)

Respond with JSON:
{
  "validation": {
    "isValid": true/false,
    "confidence": 0.00-1.00,
    "suspicious": true/false,
    "issues": ["array of any issues found"],
    "suggestedLabel": "correct label if different"
  }
}`;

      const messages = [
        {
          role: 'system',
          content: 'You are an expert at quality assurance for crowdsourced labeling tasks. Be thorough but fair. Workers make honest mistakes - only flag truly suspicious behavior.'
        },
        {
          role: 'user',
          content: promptText
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.content[0]?.text || '';

      try {
        const parsed = JSON.parse(content);
        return {
          success: true,
          validation: parsed.validation
        };
      } catch (parseError) {
        return {
          success: true,
          validation: {
            isValid: true,
            confidence: 0.5,
            suspicious: false,
            issues: ['Validation parsing error'],
            suggestedLabel: null
          }
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateExamples(request: ClaudeExampleGenerationRequest): Promise<ClaudeResponse> {
    try {
      const { taskType, categories, instructions, count = 3 } = request;

      const promptText = `Generate clear examples for a ${taskType} task.

Categories: ${categories.join(', ')}
Instructions: ${instructions}

Generate ${count} diverse examples for each category. Examples should:
- Be unambiguous and clearly demonstrate the category
- Cover different contexts and variations
- Be safe for all audiences
- Help workers avoid common mistakes

Respond with JSON:
{
  "examples": [
    {
      "category": "category_name",
      "items": [
        {
          "input": "Example text/image description",
          "output": "category_name",
          "explanation": "Why this is a good example"
        }
      ]
    }
  ]
}`;

      const messages = [
        {
          role: 'system',
          content: 'You are an expert at creating educational examples for crowdsourcing tasks. Make examples clear, diverse, and helpful.'
        },
        {
          role: 'user',
          content: promptText
        }
      ];

      const response = await this.makeRequest(messages);
      const content = response.content[0]?.text || '';

      try {
        const parsed = JSON.parse(content);
        return {
          success: true,
          examples: parsed.examples || []
        };
      } catch (parseError) {
        return {
          success: false,
          error: 'Failed to parse generated examples'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async detectSuspiciousPattern(workerId: number, recentLabels: Array<{ taskId: number; label: string; timeSpent: number; timestamp: Date }>): Promise<{
    isSuspicious: boolean;
    confidence: number;
    reasons: string[];
    patternType?: string;
  }> {
    if (recentLabels.length < 5) {
      return { isSuspicious: false, confidence: 0, reasons: [] };
    }

    // Analyze patterns
    const reasons: string[] = [];
    let confidence = 0;

    // Check for rapid submissions (possible bot)
    const avgTimeSpent = recentLabels.reduce((sum, l) => sum + (l.timeSpent || 0), 0) / recentLabels.length;
    if (avgTimeSpent < 3) {
      reasons.push('Extremely fast submission times');
      confidence += 0.3;
    }

    // Check for same label repeatedly
    const uniqueLabels = new Set(recentLabels.map(l => l.label)).size;
    if (uniqueLabels === 1 && recentLabels.length >= 5) {
      reasons.push('Always selecting the same option');
      confidence += 0.4;
    }

    // Check for patterned clicking (A, B, A, B, A, B)
    const labelSequence = recentLabels.map(l => l.label).join('-');
    if (/(.+)-\1-\1/.test(labelSequence)) {
      reasons.push('Repetitive pattern detected');
      confidence += 0.3;
    }

    // Check for random distribution (possible random clicking)
    const labelCounts: Record<string, number> = {};
    recentLabels.forEach(l => {
      labelCounts[l.label] = (labelCounts[l.label] || 0) + 1;
    });
    const expectedCount = recentLabels.length / (Object.keys(labelCounts).length || 1);
    const variance = Object.values(labelCounts).reduce((sum, count) => {
      return sum + Math.pow(count - expectedCount, 2);
    }, 0) / (Object.keys(labelCounts).length || 1);

    if (variance < 0.5 && recentLabels.length >= 10) {
      reasons.push('Suspiciously uniform distribution');
      confidence += 0.2;
    }

    // Use Claude for complex pattern detection
    if (confidence > 0.3 || reasons.length > 0) {
      const patternText = recentLabels.map(l =>
        `Task ${l.taskId}: "${l.label}" (${l.timeSpent}s)`
      ).join('\n');

      const claudeResponse = await this.makeRequest([
        {
          role: 'system',
          content: 'You are detecting bot or spam behavior in task labeling. Look for patterns that indicate automated or careless work.'
        },
        {
          role: 'user',
          content: `Analyze these recent submissions for suspicious patterns:\n${patternText}\n\nRespond with JSON: {"suspicious": true/false, "pattern": "pattern_type", "confidence": 0.00-1.00}`
        }
      ]);

      try {
        const parsed = JSON.parse(claudeResponse.content[0]?.text || '{}');
        if (parsed.suspicious) {
          confidence = Math.max(confidence, parsed.confidence);
          if (parsed.pattern && !reasons.includes(parsed.pattern)) {
            reasons.push(`Pattern: ${parsed.pattern}`);
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return {
      isSuspicious: confidence > 0.6,
      confidence: Math.min(confidence, 1.0),
      reasons,
      patternType: confidence > 0.6 ? 'automated' : 'none'
    };
  }

  async batchClassify(requests: ClaudeClassificationRequest[]): Promise<ClaudeResponse[]> {
    const batchSize = 5; // Process in batches to avoid rate limits
    const results: ClaudeResponse[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(req => this.classifyText(req));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}

export default ClaudeService;