#!/bin/bash

echo "🔒 Setting up Branch Protection Rules for Solo Developer"
echo "======================================================="
echo ""

REPO="mindburnlabs/labelmint"

echo "📋 Setting up main branch protection..."
echo "--------------------------------------"

# Main branch protection
gh api repos/$REPO/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["labelmint-ci-cd.yml / code-quality","labelmint-ci-cd.yml / test-matrix (Unit Tests)","labelmint-ci-cd.yml / test-matrix (Integration Tests)","labelmint-ci-cd.yml / test-matrix (E2E Tests)","labelmint-ci-cd.yml / test-matrix (Smart Contract Tests)","labelmint-ci-cd.yml / security-scan","labelmint-ci-cd.yml / build-and-push (web)","labelmint-ci-cd.yml / build-and-push (api)","labelmint-ci-cd.yml / build-and-push (labeling-backend)","labelmint-ci-cd.yml / build-and-push (payment-backend)","labelmint-ci-cd.yml / build-and-push (telegram-mini-app)"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":false,"require_code_owner_reviews":false}' \
  --field restrictions='{"users":["mindburnlabs"],"teams":[]}'

if [[ $? -eq 0 ]]; then
    echo "✅ Main branch protection configured"
else
    echo "❌ Failed to configure main branch protection"
fi

echo ""
echo "📋 Setting up develop branch protection..."
echo "----------------------------------------"

# Develop branch protection
gh api repos/$REPO/branches/develop/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["labelmint-ci-cd.yml / code-quality","labelmint-ci-cd.yml / test-matrix (Unit Tests)","labelmint-ci-cd.yml / test-matrix (Integration Tests)","labelmint-ci-cd.yml / test-matrix (E2E Tests)","labelmint-ci-cd.yml / test-matrix (Smart Contract Tests)","labelmint-ci-cd.yml / security-scan","labelmint-ci-cd.yml / build-and-push (web)","labelmint-ci-cd.yml / build-and-push (api)"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":false,"require_code_owner_reviews":false}' \
  --field restrictions='{"users":["mindburnlabs"],"teams":[]}'

if [[ $? -eq 0 ]]; then
    echo "✅ Develop branch protection configured"
else
    echo "❌ Failed to configure develop branch protection"
fi

echo ""
echo "📋 Setting up staging branch protection..."
echo "---------------------------------------"

# Staging branch protection
gh api repos/$REPO/branches/staging/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["labelmint-ci-cd.yml / code-quality","labelmint-ci-cd.yml / test-matrix (Unit Tests)","labelmint-ci-cd.yml / build-and-push (web)","labelmint-ci-cd.yml / build-and-push (api)"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":false,"require_code_owner_reviews":false}' \
  --field restrictions='{"users":["mindburnlabs"],"teams":[]}'

if [[ $? -eq 0 ]]; then
    echo "✅ Staging branch protection configured"
else
    echo "⚠️  Staging branch might not exist yet (will be created when first pushed)"
fi

echo ""
echo "🔍 Verifying branch protection rules..."
echo "-------------------------------------"

echo "Main branch protection:"
gh api repos/$REPO/branches/main/protection 2>/dev/null || echo "Not configured"

echo "Develop branch protection:"
gh api repos/$REPO/branches/develop/protection 2>/dev/null || echo "Not configured"

echo "Staging branch protection:"
gh api repos/$REPO/branches/staging/protection 2>/dev/null || echo "Not configured (branch doesn't exist yet)"

echo ""
echo "✅ Branch protection setup complete!"
echo ""
echo "Configuration summary:"
echo "- Main branch: Full status checks, no PR reviews required (solo developer)"
echo "- Develop branch: Core status checks, no PR reviews required"
echo "- Staging branch: Basic status checks, no PR reviews required"
echo "- Push restrictions: Only mindburnlabs (repository owner) can push"
echo ""
echo "Next steps:"
echo "1. Run ./setup-secrets.sh to configure GitHub secrets"
echo "2. Test the workflow by pushing to develop branch"
echo "3. Verify automated staging deployment"