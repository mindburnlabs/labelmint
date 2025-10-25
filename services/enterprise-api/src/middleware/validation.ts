import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) errors.push(...error.details.map(d => d.message));
    }

    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) errors.push(...error.details.map(d => d.message));
    }

    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) errors.push(...error.details.map(d => d.message));
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
      return;
    }

    next();
  };
};

// Alias for compatibility with existing code
export const validateRequest = validate;

// Common validation schemas
export const schemas = {
  uuid: Joi.string().uuid().required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0)
  }),
  organization: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional(),
    website: Joi.string().uri().optional(),
    industry: Joi.string().max(100).optional(),
    size: Joi.string().valid('startup', 'small', 'medium', 'large', 'enterprise').optional()
  }),
  workflow: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional(),
    template_id: Joi.string().uuid().required(),
    config: Joi.object().optional()
  }),
  templateReview: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(1000).optional(),
    pros: Joi.string().max(500).optional(),
    cons: Joi.string().max(500).optional()
  })
};