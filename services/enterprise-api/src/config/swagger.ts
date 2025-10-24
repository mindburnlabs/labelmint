import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LabelMint API',
      version: '1.0.0',
      description: 'LabelMint - Telegram Data Labeling Platform API',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://api.labelmint.com'
          : `http://localhost:${process.env.API_GATEWAY_PORT || 3104}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // paths to files containing OpenAPI definitions
};

export const specs = swaggerJsdoc(options);