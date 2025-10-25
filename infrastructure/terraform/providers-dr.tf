# AWS Providers for Multi-Region Disaster Recovery

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "labelmintit-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# Primary Region Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "LabelMint"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Role        = "primary"
    }
  }
}

# DR Region Provider
provider "aws" {
  alias  = "dr_region"
  region = var.dr_region

  default_tags {
    tags = {
      Project     = "LabelMint"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Role        = "disaster-recovery"
    }
  }
}

# Configure DR Region provider data sources
data "aws_caller_identity" "dr_current" {
  provider = aws.dr_region
}

data "aws_region" "dr_current" {
  provider = aws.dr_region
}