-- ============================================================================
-- SEED DATA FOR LABELMINT PLATFORM
-- ============================================================================
-- Seed script for development and testing environment
-- Created: 2024-01-01

-- Insert sample users
INSERT INTO users (id, telegram_id, first_name, last_name, username, email, role, status, rating, is_verified, verification_level) VALUES
-- Admin user
('550e8400-e29b-41d4-a716-446655440001', 123456789, 'Admin', 'User', 'admin', 'admin@labelmint.org', 'admin', 'active', 5.0, true, 3),

-- Project managers
('550e8400-e29b-41d4-a716-446655440002', 123456790, 'Alice', 'Johnson', 'alice_pm', 'alice@labelmint.org', 'project_manager', 'active', 4.8, true, 2),
('550e8400-e29b-41d4-a716-446655440003', 123456791, 'Bob', 'Wilson', 'bob_pm', 'bob@labelmint.org', 'project_manager', 'active', 4.6, true, 2),

-- Quality controllers
('550e8400-e29b-41d4-a716-446655440004', 123456792, 'Carol', 'Davis', 'carol_qc', 'carol@labelmint.org', 'quality_controller', 'active', 4.9, true, 2),
('550e8400-e29b-41d4-a716-446655440005', 123456793, 'David', 'Brown', 'david_qc', 'david@labelmint.org', 'quality_controller', 'active', 4.7, true, 2),

-- Labelers
('550e8400-e29b-41d4-a716-446655440006', 123456794, 'Emma', 'Miller', 'emma_labeler', 'emma@labelmint.org', 'labeler', 'active', 4.5, true, 1),
('550e8400-e29b-41d4-a716-446655440007', 123456795, 'Frank', 'Garcia', 'frank_labeler', 'frank@labelmint.org', 'labeler', 'active', 4.3, true, 1),
('550e8400-e29b-41d4-a716-446655440008', 123456796, 'Grace', 'Martinez', 'grace_labeler', 'grace@labelmint.org', 'labeler', 'active', 4.6, true, 1),
('550e8400-e29b-41d4-a716-446655440009', 123456797, 'Henry', 'Anderson', 'henry_labeler', 'henry@labelmint.org', 'labeler', 'active', 4.2, true, 1),
('550e8400-e29b-41d4-a716-446655440010', 123456798, 'Iris', 'Taylor', 'iris_labeler', 'iris@labelmint.org', 'labeler', 'active', 4.4, false, 0),

-- Clients
('550e8400-e29b-41d4-a716-446655440011', 123456799, 'Jack', 'Thomas', 'jack_client', 'jack@company.com', 'client', 'active', 0.0, true, 1),
('550e8400-e29b-41d4-a716-446655440012', 123456800, 'Kate', 'Jackson', 'kate_client', 'kate@enterprise.com', 'client', 'active', 0.0, true, 1);

-- Insert sample wallets for users
INSERT INTO user_wallets (user_id, address, currency, balance, is_primary, is_active) VALUES
-- Admin wallets
('550e8400-e29b-41d4-a716-446655440001', 'EQD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890', 'TON', 1000.50, true, true),
('550e8400-e29b-41d4-a716-446655440001', '0x1234567890ABCDEF1234567890ABCDEF12345678', 'USDT', 5000.00, false, true),

-- Project manager wallets
('550e8400-e29b-41d4-a716-446655440002', 'EQD2345678901ABCDEF1234567890ABCDEF1234567890ABCDEF1234567891', 'TON', 500.25, true, true),
('550e8400-e29b-41d4-a716-446655440003', 'EQD3456789012ABCDEF1234567890ABCDEF1234567890ABCDEF1234567892', 'TON', 750.75, true, true),

-- Labeler wallets
('550e8400-e29b-41d4-a716-446655440006', 'EQD4567890123ABCDEF1234567890ABCDEF1234567890ABCDEF1234567893', 'TON', 150.00, true, true),
('550e8400-e29b-41d4-a716-446655440007', 'EQD5678901234ABCDEF1234567890ABCDEF1234567890ABCDEF1234567894', 'TON', 200.50, true, true),
('550e8400-e29b-41d4-a716-446655440008', 'EQD6789012345ABCDEF1234567890ABCDEF1234567890ABCDEF1234567895', 'TON', 125.75, true, true),
('550e8400-e29b-41d4-a716-446655440009', 'EQD7890123456ABCDEF1234567890ABCDEF1234567890ABCDEF1234567896', 'TON', 300.25, true, true);

-- Insert sample projects
INSERT INTO projects (id, name, description, owner_id, status, visibility, task_types, budget, timeline, requirements, settings) VALUES
-- Image classification project
('660e8400-e29b-41d4-a716-446655440001', 'Product Image Classification', 'Classify product images into categories for e-commerce platform', '550e8400-e29b-41d4-a716-446655440002', 'active', 'private',
 ARRAY['image_classification'],
 '{"total_budget": 5000, "currency": "USDT", "per_task_reward": 0.50, "allocated_budget": 1000, "spent_budget": 250}'::jsonb,
 '{"start_date": "2024-01-01T00:00:00Z", "end_date": "2024-03-01T00:00:00Z"}'::jsonb,
 '{"min_labelers": 5, "max_labelers": 20, "required_skills": ARRAY["image_classification"], "min_rating": 4.0, "verification_required": true}'::jsonb,
 '{"auto_assignment": false, "consensus_enabled": true, "honeypot_percentage": 5, "review_required": true, "review_percentage": 20}'::jsonb),

-- Text annotation project
('660e8400-e29b-41d4-a716-446655440002', 'Sentiment Analysis for Customer Reviews', 'Analyze customer review sentiment for a retail company', '550e8400-e29b-41d4-a716-446655440003', 'active', 'private',
 ARRAY['sentiment_analysis', 'text_classification'],
 '{"total_budget": 3000, "currency": "TON", "per_task_reward": 0.30, "allocated_budget": 600, "spent_budget": 120}'::jsonb,
 '{"start_date": "2024-01-15T00:00:00Z", "end_date": "2024-02-15T00:00:00Z"}'::jsonb,
 '{"min_labelers": 3, "max_labelers": 15, "required_skills": ARRAY["sentiment_analysis", "text_classification"], "min_rating": 3.5, "verification_required": true}'::jsonb,
 '{"auto_assignment": true, "consensus_enabled": true, "honeypot_percentage": 3, "review_required": false, "review_percentage": 10}'::jsonb,

-- Bounding box annotation project
('660e8400-e29b-41d4-a716-446655440003', 'Object Detection for Autonomous Vehicles', 'Create bounding boxes for vehicles, pedestrians, and traffic signs', '550e8400-e29b-41d4-a716-446655440011', 'active', 'private',
 ARRAY['bounding_box'],
 '{"total_budget": 10000, "currency": "USDT", "per_task_reward": 1.00, "allocated_budget": 2000, "spent_budget": 500}'::jsonb,
 '{"start_date": "2024-01-01T00:00:00Z", "end_date": "2024-06-01T00:00:00Z"}'::jsonb,
 '{"min_labelers": 10, "max_labelers": 50, "required_skills": ARRAY["bounding_box", "object_detection"], "min_rating": 4.5, "verification_required": true}'::jsonb,
 '{"auto_assignment": false, "consensus_enabled": true, "honeypot_percentage": 8, "review_required": true, "review_percentage": 30}'::jsonb,

-- Named entity recognition project
('660e8400-e29b-41d4-a716-446655440004', 'Medical Record Entity Extraction', 'Extract named entities from medical records for research', '550e8400-e29b-41d4-a716-446655440012', 'draft', 'private',
 ARRAY['named_entity_recognition'],
 '{"total_budget": 8000, "currency": "TON", "per_task_reward": 0.80, "allocated_budget": 0, "spent_budget": 0}'::jsonb,
 '{"start_date": "2024-02-01T00:00:00Z", "end_date": "2024-05-01T00:00:00Z"}'::jsonb,
 '{"min_labelers": 5, "max_labelers": 25, "required_skills": ARRAY["named_entity_recognition", "medical_terms"], "min_rating": 4.2, "verification_required": true}'::jsonb,
 '{"auto_assignment": false, "consensus_enabled": true, "honeypot_percentage": 6, "review_required": true, "review_percentage": 25}'::jsonb;

-- Insert project members
INSERT INTO project_members (project_id, user_id, role, permissions, invited_by) VALUES
-- Image classification project members
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'owner', ARRAY["manage_project", "manage_tasks", "manage_members", "view_analytics"], '550e8400-e29b-41d4-a716-446655440002'),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'reviewer', ARRAY["review_labels", "manage_consensus"], '550e8400-e29b-41d4-a716-446655440002'),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 'labeler', ARRAY["view_tasks", "submit_labels"], '550e8400-e29b-41d4-a716-446655440002'),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 'labeler', ARRAY["view_tasks", "submit_labels"], '550e8400-e29b-41d4-a716-446655440002'),
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 'labeler', ARRAY["view_tasks", "submit_labels"], '550e8400-e29b-41d4-a716-446655440002'),

-- Sentiment analysis project members
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'owner', ARRAY["manage_project", "manage_tasks", "manage_members", "view_analytics"], '550e8400-e29b-41d4-a716-446655440003'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', 'reviewer', ARRAY["review_labels", "manage_consensus"], '550e8400-e29b-41d4-a716-446655440003'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 'labeler', ARRAY["view_tasks", "submit_labels"], '550e8400-e29b-41d4-a716-446655440003'),

-- Object detection project members
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440011', 'owner', ARRAY["manage_project", "manage_tasks", "manage_members", "view_analytics"], '550e8400-e29b-41d4-a716-446655440011'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'manager', ARRAY["manage_tasks", "manage_members", "view_analytics"], '550e8400-e29b-41d4-a716-446655440011'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 'reviewer', ARRAY["review_labels", "manage_consensus"], '550e8400-e29b-41d4-a716-446655440002');

-- Insert sample task batches
INSERT INTO task_batches (id, project_id, name, description, task_count, task_type, status, created_by) VALUES
-- Image classification batches
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Electronics Products Batch 1', 'Classify electronic product images', 100, 'image_classification', 'in_progress', '550e8400-e29b-41d4-a716-446655440002'),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Clothing Products Batch 1', 'Classify clothing product images', 150, 'image_classification', 'ready', '550e8400-e29b-41d4-a716-446655440002'),

-- Sentiment analysis batches
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002', 'Restaurant Reviews Batch 1', 'Analyze restaurant review sentiment', 200, 'sentiment_analysis', 'in_progress', '550e8400-e29b-41d4-a716-446655440003'),

-- Object detection batches
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440003', 'Urban Street Scenes Batch 1', 'Create bounding boxes for urban traffic objects', 50, 'bounding_box', 'in_progress', '550e8400-e29b-41d4-a716-446655440002');

-- Insert sample tasks
INSERT INTO tasks (id, project_id, batch_id, title, description, type, status, priority, assigned_to, data, instructions, due_at) VALUES
-- Image classification tasks
('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Classify smartphone image', 'Classify this smartphone image into the correct category', 'image_classification', 'completed', 2, '550e8400-e29b-41d4-a716-446655440006',
 '{"image_url": "https://example.com/images/smartphone1.jpg", "image_data": {"width": 640, "height": 480, "format": "jpeg"}, "categories": ["electronics", "smartphone", "mobile_phone", "iphone", "android"]}'::jsonb,
 'Select the most appropriate category for this smartphone image. Consider the brand, model, and type of device.',
 NOW() + INTERVAL '7 days'),

('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Classify laptop image', 'Classify this laptop image into the correct category', 'image_classification', 'in_progress', 2, '550e8400-e29b-41d4-a716-446655440007',
 '{"image_url": "https://example.com/images/laptop1.jpg", "image_data": {"width": 800, "height": 600, "format": "jpeg"}, "categories": ["electronics", "computer", "laptop", "notebook", "ultrabook"]}'::jsonb,
 'Select the most appropriate category for this laptop image. Consider the brand, model, and type of computer.',
 NOW() + INTERVAL '7 days'),

-- Sentiment analysis tasks
('880e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440003', 'Analyze restaurant review sentiment', 'Determine the sentiment of this restaurant review', 'sentiment_analysis', 'completed', 2, '550e8400-e29b-41d4-a716-446655440009',
 '{"text": "The food was absolutely amazing! Great service and wonderful atmosphere. Will definitely come back!", "text_data": {"language": "en", "word_count": 18, "character_count": 105}, "sentiment_options": ["positive", "negative", "neutral"]}'::jsonb,
 'Determine if this restaurant review expresses positive, negative, or neutral sentiment. Consider the overall tone and specific words used.',
 NOW() + INTERVAL '5 days'),

-- Object detection tasks
('880e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440004', 'Create bounding boxes for vehicles', 'Draw bounding boxes around all vehicles in this image', 'bounding_box', 'pending', 3, NULL,
 '{"image_url": "https://example.com/images/street_scene1.jpg", "image_data": {"width": 1920, "height": 1080, "format": "jpeg"}, "object_classes": ["car", "truck", "bus", "motorcycle", "bicycle"]}'::jsonb,
 'Draw bounding boxes around all vehicles in this street scene. Include cars, trucks, buses, motorcycles, and bicycles. Be as accurate as possible.',
 NOW() + INTERVAL '10 days');

-- Insert sample labels
INSERT INTO labels (id, task_id, user_id, type, data, confidence, time_spent, review_status, quality_score) VALUES
-- Image classification labels
('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 'image_classification',
 '{"classification": "smartphone", "confidence": 0.95, "alternative_labels": ["mobile_phone", "iphone"], "metadata": {"reasoning": "Clear image of modern smartphone with visible home button"}}'::jsonb,
 0.95, 45, 'approved', 4.8),

-- Sentiment analysis labels
('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440009', 'sentiment_analysis',
 '{"sentiment": "positive", "confidence": 0.98, "polarity": 0.85, "intensity": 0.9, "metadata": {"positive_words": ["amazing", "great", "wonderful"], "negative_words": []}}'::jsonb,
 0.98, 30, 'approved', 5.0);

-- Insert sample transactions
INSERT INTO transactions (id, user_id, type, amount, currency, status, description, related_entity_type, related_entity_id, processed_at) VALUES
-- Task rewards
('aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 'task_reward', 0.50, 'USDT', 'completed', 'Reward for completing smartphone classification task', 'task', '880e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '1 hour'),
('aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 'task_reward', 0.30, 'TON', 'completed', 'Reward for completing sentiment analysis task', 'task', '880e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '2 hours'),

-- Bonuses
('aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440006', 'bonus_payment', 0.10, 'USDT', 'completed', 'Quality bonus for excellent work', 'task', '880e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '1 hour'),

-- Withdrawals
('aa0e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440006', 'withdrawal', 10.00, 'USDT', 'pending', 'Withdrawal request', 'withdrawal_request', 'bb0e8400-e29b-41d4-a716-446655440001', NULL);

-- Insert sample withdrawal requests
INSERT INTO withdrawal_requests (id, user_id, wallet_id, amount, currency, to_address, status, notes) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440006', 10.00, 'USDT', '0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890', 'pending', 'Monthly withdrawal request');

-- Insert audit logs for tracking
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'create_project', 'project', '660e8400-e29b-41d4-a716-446655440001', NULL, '{"name": "Product Image Classification", "status": "active"}'::jsonb),
('550e8400-e29b-41d4-a716-446655440006', 'submit_label', 'label', '990e8400-e29b-41d4-a716-446655440001', NULL, '{"task_id": "880e8400-e29b-41d4-a716-446655440001", "classification": "smartphone"}'::jsonb),
('550e8400-e29b-41d4-a716-446655440006', 'request_withdrawal', 'withdrawal_request', 'bb0e8400-e29b-41d4-a716-446655440001', NULL, '{"amount": 10.00, "currency": "USDT"}'::jsonb);

-- Update user statistics
UPDATE users SET
  completed_tasks = CASE
    WHEN id = '550e8400-e29b-41d4-a716-446655440006' THEN 1
    WHEN id = '550e8400-e29b-41d4-a716-446655440009' THEN 1
    ELSE completed_tasks
  END,
  total_earnings = CASE
    WHEN id = '550e8400-e29b-41d4-a716-446655440006' THEN 0.60
    WHEN id = '550e8400-e29b-41d4-a716-446655440009' THEN 0.30
    ELSE total_earnings
  END;

-- Update project statistics
UPDATE projects SET
  (budget->>'spent_budget')::decimal = (budget->>'spent_budget')::decimal + CASE
    WHEN id = '660e8400-e29b-41d4-a716-446655440001' THEN 0.60
    WHEN id = '660e8400-e29b-41d4-a716-446655440002' THEN 0.30
    ELSE 0
  END;

-- Set last login times for users
UPDATE users SET last_login_at = NOW() - INTERVAL '1 day' WHERE role IN ('admin', 'project_manager', 'quality_controller');
UPDATE users SET last_login_at = NOW() - INTERVAL '2 hours' WHERE role = 'labeler';
UPDATE users SET last_login_at = NOW() - INTERVAL '3 days' WHERE role = 'client';

-- Add sample user preferences
UPDATE users SET preferences = jsonb_build_object(
  'language', 'en',
  'timezone', 'UTC',
  'notifications', jsonb_build_object(
    'email', true,
    'telegram', true,
    'push', false
  ),
  'theme', 'light',
  'auto_assign_tasks', true,
  'task_categories', ARRAY['image_classification', 'sentiment_analysis']
) WHERE role = 'labeler';

UPDATE users SET preferences = jsonb_build_object(
  'language', 'en',
  'timezone', 'UTC',
  'notifications', jsonb_build_object(
    'email', true,
    'telegram', true,
    'push', true
  ),
  'theme', 'dark',
  'auto_assign_tasks', false
) WHERE role IN ('admin', 'project_manager', 'quality_controller');