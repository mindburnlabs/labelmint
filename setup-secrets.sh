#!/bin/bash

echo "🔐 Setting up GitHub Secrets for LabelMint CI/CD Pipeline"
echo "=========================================================="
echo ""
echo "You will be prompted to enter each secret value."
echo "Press Enter to skip any secret you don't have ready."
echo ""

# Core CI/CD Secrets
echo "📋 Core CI/CD Secrets"
echo "---------------------"

read -p "Enter CODECOV_TOKEN (or press Enter to skip): " CODECOV_TOKEN
if [[ -n "$CODECOV_TOKEN" ]]; then
    gh secret set CODECOV_TOKEN --body "$CODECOV_TOKEN"
    echo "✅ CODECOV_TOKEN set"
fi

read -p "Enter SLACK_WEBHOOK_URL (or press Enter to skip): " SLACK_WEBHOOK_URL
if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
    gh secret set SLACK_WEBHOOK_URL --body "$SLACK_WEBHOOK_URL"
    echo "✅ SLACK_WEBHOOK_URL set"
fi

read -p "Enter LHCI_GITHUB_APP_TOKEN (or press Enter to skip): " LHCI_GITHUB_APP_TOKEN
if [[ -n "$LHCI_GITHUB_APP_TOKEN" ]]; then
    gh secret set LHCI_GITHUB_APP_TOKEN --body "$LHCI_GITHUB_APP_TOKEN"
    echo "✅ LHCI_GITHUB_APP_TOKEN set"
fi

echo ""
echo "☁️ AWS Infrastructure Secrets"
echo "----------------------------"

read -p "Enter AWS_ACCESS_KEY_ID (or press Enter to skip): " AWS_ACCESS_KEY_ID
if [[ -n "$AWS_ACCESS_KEY_ID" ]]; then
    gh secret set AWS_ACCESS_KEY_ID --body "$AWS_ACCESS_KEY_ID"
    echo "✅ AWS_ACCESS_KEY_ID set"
fi

read -p "Enter AWS_SECRET_ACCESS_KEY (or press Enter to skip): " AWS_SECRET_ACCESS_KEY
if [[ -n "$AWS_SECRET_ACCESS_KEY" ]]; then
    gh secret set AWS_SECRET_ACCESS_KEY --body "$AWS_SECRET_ACCESS_KEY"
    echo "✅ AWS_SECRET_ACCESS_KEY set"
fi

read -p "Enter AWS_ROLE_ARN (or press Enter to skip): " AWS_ROLE_ARN
if [[ -n "$AWS_ROLE_ARN" ]]; then
    gh secret set AWS_ROLE_ARN --body "$AWS_ROLE_ARN"
    echo "✅ AWS_ROLE_ARN set"
fi

read -p "Enter AWS_PROD_ACCESS_KEY_ID (or press Enter to skip): " AWS_PROD_ACCESS_KEY_ID
if [[ -n "$AWS_PROD_ACCESS_KEY_ID" ]]; then
    gh secret set AWS_PROD_ACCESS_KEY_ID --body "$AWS_PROD_ACCESS_KEY_ID"
    echo "✅ AWS_PROD_ACCESS_KEY_ID set"
fi

read -p "Enter AWS_PROD_SECRET_ACCESS_KEY (or press Enter to skip): " AWS_PROD_SECRET_ACCESS_KEY
if [[ -n "$AWS_PROD_SECRET_ACCESS_KEY" ]]; then
    gh secret set AWS_PROD_SECRET_ACCESS_KEY --body "$AWS_PROD_SECRET_ACCESS_KEY"
    echo "✅ AWS_PROD_SECRET_ACCESS_KEY set"
fi

echo ""
echo "🔒 Security Scanning Secrets"
echo "---------------------------"

read -p "Enter SNYK_TOKEN (or press Enter to skip): " SNYK_TOKEN
if [[ -n "$SNYK_TOKEN" ]]; then
    gh secret set SNYK_TOKEN --body "$SNYK_TOKEN"
    echo "✅ SNYK_TOKEN set"
fi

read -p "Enter SEMGREP_APP_TOKEN (or press Enter to skip): " SEMGREP_APP_TOKEN
if [[ -n "$SEMGREP_APP_TOKEN" ]]; then
    gh secret set SEMGREP_APP_TOKEN --body "$SEMGREP_APP_TOKEN"
    echo "✅ SEMGREP_APP_TOKEN set"
fi

echo ""
echo "🔍 Verifying configured secrets..."
echo "--------------------------------"

# List all configured secrets
echo "Currently configured secrets:"
gh secret list --repo mindburnlabs/labelmint

echo ""
echo "✅ Secrets setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure branch protection rules"
echo "2. Test the unified CI/CD workflow"
echo "3. Deploy to staging environment"