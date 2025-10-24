import { Scenes, InlineKeyboard } from 'grammy';
import { AuthContext } from '../middleware/auth.js';
import { apiService } from '../services/apiService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

interface NewProjectSceneData {
  title?: string;
  type?: 'IMG_CLS' | 'TXT_CLS' | 'RLHF_PAIR' | 'BBOX';
  classes?: string[];
  datasetUrl?: string;
  budget?: number;
  pricePerLabel?: number;
  taskId?: string;
}

export const newProjectScene = new Scenes.Scene<AuthContext>('newProject');

newProjectScene.initial = async (ctx) => {
  await ctx.reply(
    '📝 Let\'s create a new project!\n\n' +
    'First, what\'s the title of your project?\n\n' +
    'Example: "Cat vs Dog Classification"',
  );
  await ctx.scene.resume();
};

// Wait for project title
newProjectScene.wait('title').on('message:text', async (ctx) => {
  const title = ctx.message.text.trim();

  if (title.length < 3 || title.length > 100) {
    await ctx.reply(
      '❌ Title must be between 3 and 100 characters.\n' +
      'Please try again:',
    );
    return;
  }

  ctx.scene.session.title = title;

  await ctx.reply(
    `✅ Project title: ${title}\n\n` +
    `Now, select the task type:`,
    {
      reply_markup: new InlineKeyboard()
        .text('🖼️ Image Classification', 'type_IMG_CLS')
        .text('📝 Text Classification', 'type_TXT_CLS')
        .row()
        .text('🔄 RLHF Comparison', 'type_RLHF_PAIR')
        .text('📦 Bounding Box', 'type_BBOX'),
    },
  );

  await ctx.scene.wait('type');
});

// Handle task type selection
newProjectScene.wait('type').callbackQuery(/type_(.+)/, async (ctx) => {
  const type = ctx.match![1] as 'IMG_CLS' | 'TXT_CLS' | 'RLHF_PAIR' | 'BBOX';
  ctx.scene.session.type = type;

  const typeNames = {
    IMG_CLS: 'Image Classification',
    TXT_CLS: 'Text Classification',
    RLHF_PAIR: 'RLHF Comparison',
    BBOX: 'Bounding Box',
  };

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `✅ Task type: ${typeNames[type]}\n\n` +
    `Now, let's define the labels/classes for your project.\n\n` +
    `Please enter the labels separated by commas.\n` +
    `Example: "Cat, Dog, Bird, Other"\n\n` +
    `Minimum 2 labels, maximum 20.`,
  );

  await ctx.scene.wait('classes');
});

// Wait for labels/classes
newProjectScene.wait('classes').on('message:text', async (ctx) => {
  const labelsInput = ctx.message.text.trim();
  const classes = labelsInput.split(',').map(c => c.trim()).filter(c => c);

  if (classes.length < 2 || classes.length > 20) {
    await ctx.reply(
      '❌ Please provide between 2 and 20 labels.\n' +
      'Example: "Cat, Dog, Bird, Other"\n\n' +
      'Try again:',
    );
    return;
  }

  // Check for duplicates
  const uniqueClasses = [...new Set(classes)];
  if (uniqueClasses.length !== classes.length) {
    await ctx.reply(
      '❌ Duplicate labels detected.\n' +
      'Please ensure all labels are unique:\n\n' +
      'Try again:',
    );
    return;
  }

  ctx.scene.session.classes = uniqueClasses;

  await ctx.reply(
    `✅ Labels: ${uniqueClasses.join(', ')}\n\n` +
    `Now, let's upload your dataset.\n\n` +
    `Choose how you want to provide your data:`,
    {
      reply_markup: new InlineKeyboard()
        .text('📁 Upload File', 'upload_file')
        .text('🔗 Provide URL', 'provide_url')
        .row()
        .text('📋 CSV of URLs', 'csv_urls')
        .text('☁️ Google Drive', 'google_drive'),
    },
  );

  await ctx.scene.wait('dataset');
});

// Handle dataset option
newProjectScene.wait('dataset').callbackQuery(/(upload_file|provide_url|csv_urls|google_drive)/, async (ctx) => {
  const option = ctx.match![1];
  await ctx.answerCallbackQuery();

  switch (option) {
    case 'upload_file':
      if (!config.ENABLE_DATASET_UPLOAD) {
        await ctx.reply(
          '⚠️ File upload is temporarily disabled.\n' +
          'Please choose another option.',
        );
        await ctx.scene.wait('dataset');
        return;
      }
      await ctx.reply(
        '📁 Please upload your dataset file.\n\n' +
        `Supported formats: ${config.ALLOWED_DATASET_TYPES.join(', ')}\n` +
        `Maximum size: ${config.MAX_DATASET_SIZE_MB}MB\n\n` +
        'You can upload:\n' +
        '• ZIP file with images\n' +
        '• CSV file with URLs\n' +
        '• JSON file with data',
      );
      await ctx.scene.wait('file_upload');
      break;

    case 'provide_url':
      await ctx.reply(
        '🔗 Please provide the URL to your dataset.\n\n' +
        'Supported:\n' +
        '• Direct file URL\n' +
        '• Google Drive shareable link\n' +
        '• Dropbox link\n\n' +
        'Send the URL:',
      );
      await ctx.scene.wait('url');
      break;

    case 'csv_urls':
      await ctx.reply(
        '📋 Please paste your CSV content with URLs.\n\n' +
        'Format:\n' +
        'url,label\n' +
        'https://example.com/image1.jpg,cat\n' +
        'https://example.com/image2.jpg,dog\n\n' +
        'Send the CSV content:',
      );
      await ctx.scene.wait('csv');
      break;

    case 'google_drive':
      await ctx.reply(
        '☁️ Google Drive integration coming soon!\n\n' +
        'For now, please use:\n' +
        '• Upload file\n' +
        '• Provide URL\n\n' +
        'Choose an option:',
        {
          reply_markup: new InlineKeyboard()
            .text('📁 Upload File', 'upload_file')
            .text('🔗 Provide URL', 'provide_url'),
        },
      );
      await ctx.scene.wait('dataset');
      break;
  }
});

// Handle file upload
newProjectScene.wait('file_upload').on(['message:document', 'message:photo'], async (ctx) => {
  let fileId: string;
  let fileName: string;
  let fileSize: number;

  if (ctx.message.document) {
    fileId = ctx.message.document.file_id;
    fileName = ctx.message.document.file_name || 'unknown';
    fileSize = ctx.message.document.file_size;
  } else if (ctx.message.photo) {
    // Get the largest photo
    const photos = ctx.message.photo;
    fileId = photos[photos.length - 1].file_id;
    fileName = `photo_${Date.now()}.jpg`;
    fileSize = photos[photos.length - 1].file_size || 0;
  } else {
    await ctx.reply('❌ Unsupported file type. Please try again.');
    return;
  }

  // Check file size
  const maxSizeBytes = config.MAX_DATASET_SIZE_MB * 1024 * 1024;
  if (fileSize > maxSizeBytes) {
    await ctx.reply(
      `❌ File too large.\n` +
      `Maximum size: ${config.MAX_DATASET_SIZE_MB}MB\n` +
      `Your file: ${(fileSize / 1024 / 1024).toFixed(2)}MB\n\n` +
      'Please compress your file or split it into smaller parts.',
    );
    return;
  }

  // Download file
  try {
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.me.token}/${file.file_path}`;

    // Upload to our storage
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    ctx.scene.session.datasetUrl = await apiService.uploadDataset(buffer, fileName);

    await ctx.reply('✅ File uploaded successfully!\n\nProceeding to project settings...');
    await proceedToPricing(ctx);

  } catch (error) {
    logger.error('File upload error:', error);
    await ctx.reply(
      '❌ Failed to upload file.\n' +
      'Please try again or contact support.',
    );
  }
});

// Handle URL input
newProjectScene.wait('url').on('message:text', async (ctx) => {
  const url = ctx.message.text.trim();

  try {
    new URL(url); // Validate URL
    ctx.scene.session.datasetUrl = url;
    await ctx.reply('✅ URL received!\n\nProceeding to project settings...');
    await proceedToPricing(ctx);
  } catch {
    await ctx.reply(
      '❌ Invalid URL format.\n' +
      'Please provide a valid URL:',
    );
  }
});

// Handle CSV input
newProjectScene.wait('csv').on('message:text', async (ctx) => {
  const csvContent = ctx.message.text.trim();

  if (!csvContent.includes(',')) {
    await ctx.reply(
      '❌ Invalid CSV format.\n' +
      'Please use the format: url,label\n\n' +
      'Try again:',
    );
    return;
  }

  // Process CSV (simplified)
  const lines = csvContent.split('\n').filter(line => line.trim());
  const items = lines.slice(1).map(line => {
    const [url, label] = line.split(',').map(s => s.trim());
    return { url, label };
  }).filter(item => item.url && item.label);

  if (items.length < 10) {
    await ctx.reply(
      '❌ Dataset too small.\n' +
      'Minimum 10 items required.\n\n' +
      `You provided ${items.length} valid items.\n\n` +
      'Please add more data:',
    );
    return;
  }

  // Store CSV data (in real implementation, save to file)
  ctx.scene.session.datasetUrl = `csv_data_${Date.now()}`;

  await ctx.reply(
    `✅ CSV processed!\n\n` +
    `Found ${items.length} items.\n\n` +
    `Proceeding to project settings...`
  );

  await proceedToPricing(ctx);
});

// Helper function to proceed to pricing
async function proceedToPricing(ctx: AuthContext) {
  const data = ctx.scene.session as NewProjectSceneData;

  // Calculate estimated cost based on task type and number of labels
  const basePrices = {
    IMG_CLS: 0.06, // $0.06 per judgment
    TXT_CLS: 0.05,
    RLHF_PAIR: 0.06,
    BBOX: 0.12,
  };

  const basePrice = basePrices[data.type!];
  const numLabels = data.classes!.length;
  const estimatedPricePerTask = basePrice * 3; // 3 judgments default

  await ctx.reply(
    `💰 Project Pricing\n\n` +
    `📊 Project Details:\n` +
    `• Title: ${data.title}\n` +
    `• Type: ${data.type}\n` +
    `• Labels: ${numLabels} (${data.classes!.join(', ')})\n\n` +
    `💸 Pricing:\n` +
    `• Price per judgment: $${basePrice.toFixed(3)}\n` +
    `• Judgments per item: 3 (consensus)\n` +
    `• Price per item: $${estimatedPricePerTask.toFixed(3)}\n\n` +
    `⚙️ Enter your budget in USD:\n` +
    `Minimum budget: $${(estimatedPricePerTask * 100).toFixed(2)} (100 items)\n\n` +
    `Example: 50.00`,
  );

  await ctx.scene.wait('budget');
}

// Handle budget input
newProjectScene.wait('budget').on('message:text', async (ctx) => {
  const budgetText = ctx.message.text.trim();
  const budget = parseFloat(budgetText);

  if (isNaN(budget) || budget < 1) {
    await ctx.reply(
      '❌ Invalid budget amount.\n\n' +
      'Please enter a number (minimum $1.00):\n' +
      'Example: 50.00',
    );
    return;
  }

  ctx.scene.session.budget = budget;

  // Create the project
  try {
    await ctx.reply('⏳ Creating your project...');

    const project = await apiService.createProject(ctx.user!.id, {
      title: ctx.scene.session.title!,
      type: ctx.scene.session.type!,
      classes: ctx.scene.session.classes!,
      datasetUrl: ctx.scene.session.datasetUrl!,
      budget: budget,
      pricePerLabel: 0.06, // Will be calculated based on type
    });

    await ctx.reply(
      `🎉 Project created successfully!\n\n` +
      `📋 Project Details:\n` +
      `• ID: ${project.id}\n` +
      `• Title: ${project.title}\n` +
      `• Status: ${project.status}\n` +
      `• Budget: $${budget.toFixed(2)}\n\n` +
      `📊 Your project is now ready!\n\n` +
      `Use /status ${project.id} to track progress.\n` +
      `Use /results ${project.id} to download results when ready.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 View Status', callback_data: `status_${project.id}` },
              { text: '💰 Add Funds', callback_data: 'add_funds' },
            ],
          ],
        },
      },
    );

    logger.info(`Project ${project.id} created by user ${ctx.user!.id}`);

  } catch (error) {
    logger.error('Failed to create project:', error);
    await ctx.reply(
      '❌ Failed to create project.\n' +
      'Please try again or contact support.',
    );
  }

  await ctx.scene.exit();
});

// Handle cancel
newProjectScene.command('cancel', async (ctx) => {
  await ctx.reply('❌ Project creation cancelled.');
  await ctx.scene.exit();
});

newProjectScene.callbackQuery('cancel', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('❌ Project creation cancelled.');
  await ctx.scene.exit();
});