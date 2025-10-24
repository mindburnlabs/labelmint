#!/bin/bash

# LabelMint MinIO Configuration Script
# This script configures MinIO with proper settings and creates initial buckets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-labelmint-access-key}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-labelmint-secret-key}"
MINIO_CONSOLE_PORT="9001"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Function to check if MinIO is ready
wait_for_minio() {
    local max_attempts=30
    local attempt=1

    log "Waiting for MinIO to be ready..."

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$MINIO_ENDPOINT/minio/health/live" > /dev/null 2>&1; then
            success "MinIO is ready"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    error "MinIO failed to start after $max_attempts attempts"
    return 1
}

# Function to configure MinIO client
configure_mc() {
    log "Configuring MinIO client..."

    # Check if mc (MinIO Client) is available
    if ! command -v mc &> /dev/null; then
        log "Installing MinIO client..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew install minio/stable/mc
            else
                # Download directly
                curl -o /tmp/mc https://dl.min.io/client/mc/release/darwin-arm64/mc
                chmod +x /tmp/mc
                sudo mv /tmp/mc /usr/local/bin/mc
            fi
        else
            # Linux
            wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
            chmod +x /tmp/mc
            sudo mv /tmp/mc /usr/local/bin/mc
        fi
    fi

    # Configure mc with MinIO server
    mc alias set labelmint "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4

    success "MinIO client configured"
}

# Function to create buckets
create_buckets() {
    log "Creating LabelMint buckets..."

    local buckets=(
        "labelmint-assets"
        "labelmint-uploads"
        "labelmint-backups"
        "labelmint-logs"
        "labelmint-temp"
        "labelmint-user-data"
        "labelmint-export"
        "labelmint-media"
    )

    for bucket in "${buckets[@]}"; do
        log "Creating bucket: $bucket"

        if mc mb "labelmint/$bucket" --ignore-existing 2>/dev/null; then
            success "Created bucket: $bucket"
        else
            warn "Bucket $bucket already exists or failed to create"
        fi
    done
}

# Function to configure bucket policies
configure_bucket_policies() {
    log "Configuring bucket policies..."

    # Public read policy for assets bucket
    cat > /tmp/assets-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {"AWS": ["*"]},
            "Action": ["s3:GetObject"],
            "Resource": ["arn:aws:s3:::labelmint-assets/*"]
        }
    ]
}
EOF

    # Set policy for assets bucket
    if mc admin policy add labelmint assets-read /tmp/assets-policy.json 2>/dev/null; then
        mc admin policy set labelmint assets-read user=labelmint-access-key 2>/dev/null || true
        success "Configured assets bucket policy"
    else
        warn "Failed to configure assets bucket policy"
    fi

    # Private policies for other buckets
    local private_buckets=(
        "labelmint-uploads"
        "labelmint-backups"
        "labelmint-logs"
        "labelmint-temp"
        "labelmint-user-data"
        "labelmint-export"
        "labelmint-media"
    )

    for bucket in "${private_buckets[@]}"; do
        # Create private policy
        cat > "/tmp/${bucket}-policy.json" << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {"AWS": ["arn:aws:iam:::user=labelmint-access-key"]},
            "Action": ["s3:*"],
            "Resource": ["arn:aws:s3:::$bucket", "arn:aws:s3:::$bucket/*"]
        }
    ]
}
EOF

        if mc admin policy add labelmint "$bucket-access" "/tmp/${bucket}-policy.json" 2>/dev/null; then
            mc admin policy set labelmint "$bucket-access" user=labelmint-access-key 2>/dev/null || true
            success "Configured $bucket bucket policy"
        else
            warn "Failed to configure $bucket bucket policy"
        fi

        rm -f "/tmp/${bucket}-policy.json"
    done

    rm -f /tmp/assets-policy.json
}

# Function to configure bucket lifecycle policies
configure_lifecycle_policies() {
    log "Configuring bucket lifecycle policies..."

    # Temporary files - delete after 7 days
    cat > /tmp/temp-lifecycle.json << 'EOF'
{
    "Rules": [
        {
            "ID": "DeleteTempFiles",
            "Status": "Enabled",
            "Expiration": {
                "Days": 7
            },
            "Filter": {
                "Prefix": ""
            }
        }
    ]
}
EOF

    if mc ilm add --expiry-days 7 --id "DeleteTempFiles" labelmint/labelmint-temp 2>/dev/null; then
        success "Configured temp bucket lifecycle policy"
    else
        warn "Failed to configure temp bucket lifecycle policy"
    fi

    # Logs - delete after 30 days
    if mc ilm add --expiry-days 30 --id "DeleteOldLogs" labelmint/labelmint-logs 2>/dev/null; then
        success "Configured logs bucket lifecycle policy"
    else
        warn "Failed to configure logs bucket lifecycle policy"
    fi

    rm -f /tmp/temp-lifecycle.json
}

# Function to test MinIO functionality
test_minio() {
    log "Testing MinIO functionality..."

    # Test upload
    echo "LabelMint Test File $(date)" > /tmp/test-file.txt
    if mc cp /tmp/test-file.txt labelmint/labelmint-temp/; then
        success "File upload test passed"
    else
        error "File upload test failed"
        return 1
    fi

    # Test download
    if mc cp labelmint/labelmint-temp/test-file.txt /tmp/downloaded-test-file.txt; then
        success "File download test passed"
    else
        error "File download test failed"
        return 1
    fi

    # Cleanup test files
    mc rm labelmint/labelmint-temp/test-file.txt 2>/dev/null || true
    rm -f /tmp/test-file.txt /tmp/downloaded-test-file.txt

    # Test bucket listing
    if mc ls labelmint/ > /dev/null 2>&1; then
        success "Bucket listing test passed"
    else
        error "Bucket listing test failed"
        return 1
    fi

    success "All MinIO tests passed"
}

# Function to display MinIO information
display_info() {
    log "MinIO Configuration Complete!"
    echo ""
    echo "📊 MinIO Information:"
    echo "  Console URL: http://localhost:$MINIO_CONSOLE_PORT"
    echo "  API Endpoint: $MINIO_ENDPOINT"
    echo "  Access Key: $MINIO_ACCESS_KEY"
    echo "  Secret Key: $MINIO_SECRET_KEY"
    echo ""
    echo "📦 Created Buckets:"

    if mc ls labelmint/ 2>/dev/null; then
        mc ls labelmint/ | while read -r line; do
            bucket_name=$(echo "$line" | awk '{print $NF}')
            echo "  ✅ $bucket_name"
        done
    else
        echo "  No buckets found"
    fi

    echo ""
    echo "🔧 Next Steps:"
    echo "  1. Access MinIO Console: http://localhost:$MINIO_CONSOLE_PORT"
    echo "  2. Login with the credentials above"
    echo "  3. Verify buckets are created"
    echo "  4. Configure your applications to use these endpoints"
    echo ""
    echo "📝 Environment Variables for Applications:"
    echo "  MINIO_ENDPOINT=$MINIO_ENDPOINT"
    echo "  MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY"
    echo "  MINIO_SECRET_KEY=$MINIO_SECRET_KEY"
    echo "  MINIO_USE_SSL=false"
}

# Main function
main() {
    log "Starting MinIO configuration for LabelMint..."

    # Load environment variables
    if [[ -f ".env" ]]; then
        log "Loading environment variables from .env"
        set -a
        source .env
        set +a
    fi

    # Wait for MinIO to be ready
    wait_for_minio

    # Configure MinIO client
    configure_mc

    # Create buckets
    create_buckets

    # Configure bucket policies
    configure_bucket_policies

    # Configure lifecycle policies
    configure_lifecycle_policies

    # Test MinIO functionality
    test_minio

    # Display information
    display_info

    success "MinIO configuration completed successfully!"
}

# Run main function
main "$@"