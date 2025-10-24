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

// Common validation schemas
export const schemas = {
  tonAddress: Joi.string().required().pattern(/^[0-9a-zA-Z_-]+$/),
  tonAmount: Joi.number().positive().max(1000000).required(),
  uuid: Joi.string().uuid().required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0)
  })
};