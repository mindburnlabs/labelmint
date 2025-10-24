# Security Incident Response Runbook

## Overview

This runbook outlines procedures for responding to security incidents including data breaches, unauthorized access, DDoS attacks, and other security threats.

## Security Team Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| Security Lead | | security-lead@labelmint.it | 24/7 |
| On-call Security | | security-oncall@labelmint.it | 24/7 |
| CTO | | cto@labelmint.it | 24/7 for critical |
| Legal Counsel | | legal@labelmint.it | Business hours |
| PR Manager | | pr@labelmint.it | Business hours |

## Incident Classification

### Severity Levels

| Severity | Description | Examples | Response Time |
|----------|-------------|----------|---------------|
| **SEV-0 (Critical)** | Active breach, data loss, service disruption | Database compromised, ransomware, large-scale data exfiltration | 15 minutes |
| **SEV-1 (High)** | Security control bypass, suspicious activity | Unauthorized API access, credential stuffing, successful phishing | 1 hour |
| **SEV-2 (Medium)** | Potential compromise, policy violation | Suspicious login patterns, malware detection, minor data exposure | 4 hours |
| **SEV-3 (Low)** | Informational, policy question | Vulnerability disclosure, security question | 24 hours |

## Initial Response

### Immediate Actions (First 15 Minutes)

```bash
#!/bin/bash
# security-initial-response.sh

echo "=== SECURITY INCIDENT RESPONSE INITIATED ==="

# 1. Create incident channel
SLACK_CHANNEL="#security-incident-$(date +%Y%m%d-%H%M%S)"
echo "Created Slack channel: $SLACK_CHANNEL"

# 2. Assemble response team
curl -X POST https://hooks.slack.com/services/xxx/yyy/zzz \
  -H 'Content-type: application/json' \
  --data "{\"text\":\"🚨 SECURITY INCIDENT DECLARED\\nChannel: $SLACK_CHANNEL\\nSeverity: SEV-0\\nTeam: @security-lead @oncall-security @cto\"}"

# 3. Secure perimeter
echo "Securing perimeter..."

# Block suspicious IPs
cat /tmp/suspicious_ips.txt | while read ip; do
    iptables -A INPUT -s $ip -j DROP
    echo "Blocked IP: $ip"
done

# Enable additional logging
docker-compose exec backend npm run security:enable-audit-log
docker-compose exec postgres psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all'; SELECT pg_reload_conf();"

# 4. Preserve evidence
echo "Preserving evidence..."
mkdir -p "/evidence/$(date +%Y%m%d_%H%M%S)"

# Capture system state
ps aux > "/evidence/$(date +%Y%m%d_%H%M%S)/processes.txt"
netstat -tulpn > "/evidence/$(date +%Y%m%d_%H%M%S)/network.txt"
docker-compose logs --tail=1000 > "/evidence/$(date +%Y%m%d_%H%M%S)/docker_logs.txt"

# 5. Initial assessment
echo "Running initial security assessment..."
./scripts/security-scan.sh > "/evidence/$(date +%Y%m%d_%H%M%S)/security_scan.txt"

echo "=== INITIAL RESPONSE COMPLETE ==="
```

## Specific Incident Types

### 1. Data Breach / Unauthorized Access

#### Symptoms
- Suspicious API key usage
- Unusual data access patterns
- Reports of missing data
- Alerts from monitoring systems

#### Triage Steps

1. **Verify Breach**
   ```bash
   # Check for unusual API usage
   docker-compose exec postgres psql -U labeling_user -c "
     SELECT api_key_id, COUNT(*) as requests, ip_address, user_agent
     FROM api_usage_logs
     WHERE created_at > NOW() - INTERVAL '1 hour'
     GROUP BY api_key_id, ip_address, user_agent
     HAVING COUNT(*) > 1000
     ORDER BY requests DESC;
   "

   # Check for data access anomalies
   docker-compose exec postgres psql -U labeling_user -c "
     SELECT user_id, COUNT(*) as records_accessed
     FROM data_access_log
     WHERE created_at > NOW() - INTERVAL '1 hour'
     GROUP BY user_id
     HAVING COUNT(*) > AVG(records_accessed) * 10;
   "
   ```

2. **Identify Affected Data**
   ```sql
   -- Find accessed tables
   SELECT table_name, COUNT(*) as access_count
   FROM audit_log
   WHERE action = 'SELECT'
     AND created_at > NOW() - INTERVAL '24 hours'
   GROUP BY table_name
   ORDER BY access_count DESC;

   -- Identify affected users
   SELECT DISTINCT user_id
   FROM task_results
   WHERE created_at BETWEEN 'start_time' AND 'end_time';
   ```

3. **Containment**
   ```bash
   # Revoke all API keys
   docker-compose exec postgres psql -U labeling_user -c "UPDATE api_keys SET is_active = false;"

   # Force password reset for all users
   docker-compose exec postgres psql -U labeling_user -c "UPDATE users SET password_reset_required = true;"

   # Block suspicious IPs
   for ip in $(cat /tmp/breach_ips.txt); do
       aws ec2 revoke-security-group-ingress \
         --group-id sg-xxx \
         --protocol tcp \
         --port 443 \
         --cidr $ip/32
   done
   ```

### 2. DDoS Attack

#### Symptoms
- Massive traffic spike
- Service degradation
- High error rates
- Nginx 502/504 errors

#### Response Procedures

1. **Detection**
   ```bash
   # Check traffic patterns
   tail -f /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -20

   # Check for attack patterns
   grep "POST /api/v1/tasks" /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -20
   ```

2. **Mitigation**
   ```bash
   # Enable rate limiting
   cat > /etc/nginx/conf.d/rate-limit.conf << EOF
   limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
   limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

   server {
       location /api/ {
           limit_req zone=api burst=20 nodelay;
       }

       location /api/auth {
           limit_req zone=auth burst=10 nodelay;
       }
   }
   EOF

   nginx -s reload

   # Activate CloudFlare DDoS protection
   curl -X POST "https://api.cloudflare.com/client/v4/zones/zone_id/firewall/rules" \
     -H "Authorization: Bearer $CF_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{
       "action": "challenge",
       "filter": {
         "expression": "(http.request.method eq \"POST\" and ip.geoip.country ne \"US\")"
       }
     }'

   # Enable caching for static content
   cat > /etc/nginx/conf.d/cache.conf << EOF
   location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   EOF
   ```

3. **Scale Resources**
   ```bash
   # Auto-scale during attack
   docker-compose up -d --scale backend=10
   docker-compose up -d --scale nginx=5

   # Activate AWS Auto Scaling
   aws autoscaling set-desired-capacity \
     --auto-scaling-group-name labelmint-asg \
     --desired-capacity 20 \
     --honor-cooldown
   ```

### 3. Ransomware / Malware

#### Symptoms
- Files encrypted or renamed
- Ransom notes
- Unusual file extensions
- System slowdown

#### Response

1. **Isolation**
   ```bash
   # Disconnect from network
   ip link set eth0 down

   # Stop all services
   docker-compose down

   # Do NOT restart systems
   echo "CRITICAL: Do not restart any systems. Preserve state for forensic analysis."
   ```

2. **Assessment**
   ```bash
   # Check for encrypted files
   find /app/uploads -name "*.encrypted" -type f | wc -l
   find /app/uploads -name "*.locked" -type f | wc -l

   # Check for ransom notes
   find / -name "READ_ME.txt" -o -name "RECOVER-FILES.txt" 2>/dev/null
   ```

3. **Recovery**
   ```bash
   # Restore from clean backup
   ./scripts/emergency-restore.sh $(date --date="2 days ago" +%Y%m%d_%H%M%S)

   # Scan all restored files
   clamscan -r /app/uploads --move=/quarantine

   # Update all passwords and keys
   ./scripts/rotate-all-credentials.sh
   ```

### 4. Insider Threat

#### Detection

```sql
-- Check for unusual data access
SELECT
  user_id,
  COUNT(*) as records_accessed,
  COUNT(DISTINCT table_name) as tables_accessed
FROM data_access_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 10000 OR COUNT(DISTINCT table_name) > 20;

-- Check for export activities
SELECT *
FROM export_log
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND record_count > 1000;
```

## Forensic Procedures

### Evidence Collection

```bash
#!/bin/bash
# collect-forensics.sh

INCIDENT_ID=$1
EVIDENCE_DIR="/evidence/$INCIDENT_ID"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$EVIDENCE_DIR"

echo "Collecting forensic evidence for incident: $INCIDENT_ID"

# 1. Memory dump
echo "Capturing memory dumps..."
for container in $(docker ps -q); do
    docker export $container > "$EVIDENCE_DIR/container_$container_$TIMESTAMP.tar"
done

# 2. Disk images
echo "Capturing disk images..."
dd if=/dev/vda1 of="$EVIDENCE_DIR/disk_image_$TIMESTAMP.img" bs=4M

# 3. Network capture
echo "Starting network capture..."
tcpdump -i any -w "$EVIDENCE_DIR/network_capture_$TIMESTAMP.pcap" -G 3600 -W $EVIDENCE_DIR/network &
CAPTURE_PID=$!

# 4. System logs
echo "Collecting system logs..."
journalctl > "$EVIDENCE_DIR/journalctl_$TIMESTAMP.log"
dmesg > "$EVIDENCE_DIR/dmesg_$TIMESTAMP.log"
last > "$EVIDENCE_DIR/last_$TIMESTAMP.log"

# 5. Database logs
echo "Collecting database logs..."
docker-compose exec postgres cat /var/log/postgresql/postgresql-16-main.log \
  > "$EVIDENCE_DIR/postgres_$TIMESTAMP.log"

# 6. Container logs
echo "Collecting container logs..."
docker-compose logs > "$EVIDENCE_DIR/docker_logs_$TIMESTAMP.log"

# 7. Hash everything
echo "Calculating hashes..."
find "$EVIDENCE_DIR" -type f -exec sha256sum {} \; > "$EVIDENCE_DIR/hashes_$TIMESTAMP.txt"

# 8. Chain of custody
cat > "$EVIDENCE_DIR/custody_$TIMESTAMP.txt" << EOF
Incident ID: $INCIDENT_ID
Collection Time: $(date)
Collected By: $(whoami)
System Hostname: $(hostname)
IP Address: $(hostname -I)
EOF

echo "Evidence collection complete: $EVIDENCE_DIR"
echo "Network capture PID: $CAPTURE_PID (remember to stop when done)"
```

### Log Analysis

```bash
#!/bin/bash
# analyze-security-logs.sh

LOG_DIR="/evidence/incident_001"
ANALYSIS_DIR="$LOG_DIR/analysis"
mkdir -p "$ANALYSIS_DIR"

# Analyze authentication attempts
echo "Analyzing authentication attempts..."
grep "POST /api/auth" "$LOG_DIR/nginx_access.log" \
  | awk '{print $1, $7, $9}' \
  | sort | uniq -c | sort -nr \
  > "$ANALYSIS_DIR/auth_attempts.txt"

# Find failed logins
grep "401" "$LOG_DIR/nginx_access.log" \
  | awk '{print $1}' \
  | sort | uniq -c | sort -nr \
  > "$ANALYSIS_DIR/failed_ips.txt"

# Analyze API usage patterns
echo "Analyzing API usage..."
awk '{
  if ($7 ~ /\/api\//) {
    print $1, $7, $NF
  }
}' "$LOG_DIR/nginx_access.log" \
  | sort | uniq -c | sort -nr \
  > "$ANALYSIS_DIR/api_usage.txt"

# Check for data exfiltration
echo "Checking for data exfiltration..."
awk '{
  if ($NF > 1000000) {  # Responses > 1MB
    print $0
  }
}' "$LOG_DIR/nginx_access.log" \
  > "$ANALYSIS_DIR/large_responses.txt"

# Timeline reconstruction
echo "Creating timeline..."
grep -E "(ERROR|CRITICAL|ALERT)" "$LOG_DIR/docker_logs.txt" \
  | awk '{print $1, $2, $3}' \
  > "$ANALYSIS_DIR/timeline.txt"
```

## Post-Incident Actions

### 1. Security Patching

```bash
#!/bin/bash
# security-hardening.sh

echo "Applying security patches..."

# Update all packages
apt update && apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Security hardening
# Disable unused services
systemctl disable telnet
systemctl disable rsh
systemctl disable rlogin

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 443/tcp
ufw enable

# Configure intrusion detection
./scripts/setup-suricata.sh

# Enable file integrity monitoring
./scripts/setup-aide.sh

echo "Security hardening complete"
```

### 2. Password and Credential Rotation

```bash
#!/bin/bash
# rotate-all-credentials.sh

echo "Rotating all credentials..."

# Generate new secrets
NEW_DB_PASS=$(openssl rand -base64 32)
NEW_JWT_SECRET=$(openssl rand -base64 64)
NEW_API_SECRET=$(openssl rand -base64 64)

# Update database password
docker-compose exec postgres psql -U postgres -c "
  ALTER USER labeling_user WITH PASSWORD '$NEW_DB_PASS';
"

# Update .env file
sed -i "s/DATABASE_PASSWORD=.*/DATABASE_PASSWORD=$NEW_DB_PASS/" .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env
sed -i "s/API_SECRET=.*/API_SECRET=$NEW_API_SECRET/" .env

# Regenerate all API keys
docker-compose exec postgres psql -U labeling_user -c "
  UPDATE api_keys
  SET key = gen_random_uuid()::text,
      is_active = false
  WHERE is_active = true;
"

# Force all users to reset passwords
docker-compose exec postgres psql -U labeling_user -c "
  UPDATE users
  SET password_reset_required = true,
      reset_token = gen_random_uuid()::text,
      reset_expires = NOW() + INTERVAL '24 hours';
"

# Notify all users
curl -X POST https://api.labelmint.it/admin/notify-all \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{
    "message": "Security incident detected. All passwords have been reset. Please check your email for reset instructions.",
    "channel": "email"
  }'

echo "Credential rotation complete"
```

### 3. Post-Incident Report Template

```markdown
# Security Incident Report

## Executive Summary
- Incident Type: [Type of security incident]
- Severity: [SEV-0/1/2/3]
- Duration: [Start time to resolution]
- Impact: [Business impact description]

## Timeline
- [Date/Time]: Incident detected
- [Date/Time]: Response initiated
- [Date/Time]: Incident contained
- [Date/Time]: Incident resolved

## Root Cause Analysis
[Detailed analysis of what happened]

## Impact Assessment
- Data affected: [What data was compromised]
- Users affected: [Number of users]
- Systems affected: [Which systems]
- Financial impact: [Costs incurred]

## Containment Actions
[Actions taken to stop the incident]

## Remediation Actions
[Actions taken to fix vulnerabilities]

## Lessons Learned
- What went well
- What could be improved
- Preventive measures

## Action Items
- [ ] [Action item 1] - Owner - Due date
- [ ] [Action item 2] - Owner - Due date
```

## Compliance and Reporting

### GDPR Data Breach Notification (72 hours)

```bash
#!/bin/bash
# gdpr-breach-notification.sh

# Check if personal data was affected
AFFECTED_USERS=$(docker-compose exec postgres psql -U labeling_user -t -c "
  SELECT COUNT(DISTINCT user_id)
  FROM data_access_log
  WHERE created_at > '$INCIDENT_START'
    AND table_name IN ('users', 'task_results', 'payments');
" | tr -d ' ')

if [ "$AFFECTED_USERS" -gt 0 ]; then
    echo "GDPR notification required: $AFFECTED_USERS users affected"

    # Generate notification report
    cat > /reports/gdpr-notification.md << EOF
# GDPR Data Breach Notification

Date of breach: $INCIDENT_START
Date of detection: $INCIDENT_DETECTED
Date of notification: $(date)

Description: [Description of breach]

Data categories affected:
- Personal identifiers
- Task completion data
- Payment information

Number of affected persons: $AFFECTED_USERS

Likely consequences: [Assessment of risk]

Measures taken: [Response and mitigation actions]

Contact point: dpo@labelmint.it
EOF

    # Send to supervisory authority
    curl -X POST https://ico.org.uk/api/breach-notification \
      -H "Authorization: Bearer $ICO_TOKEN" \
      -F "file=@/reports/gdpr-notification.md"
fi
```

## Security Tools Integration

### SIEM Configuration

```yaml
# siem-config.yml
rules:
  - name: "Multiple Failed Logins"
    condition: "failed_logins > 10 within 5m"
    severity: "high"
    action: "alert"

  - name: "Unusual Data Export"
    condition: "export_size > 1GB within 1h"
    severity: "critical"
    action: "block_ip"

  - name: "Admin Access Outside Hours"
    condition: "admin_login AND time not in 09:00-17:00"
    severity: "medium"
    action: "alert"

integrations:
  - type: "slack"
    webhook: "https://hooks.slack.com/services/xxx"
  - type: "email"
    smtp: "smtp.labelmint.it"
  - type: "pagerduty"
    service_key: "xxx"
```

## Related Runbooks

- [Incident Response](./incident-response.md)
- [Backup Restoration](./backup-restoration.md)
- [Database Maintenance](./database-maintenance.md)