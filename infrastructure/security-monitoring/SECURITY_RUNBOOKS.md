# Security Operations Runbooks

**Version**: 1.0
**Last Updated**: 2024-10-24
**Maintained by**: Security Team

---

## 🚨 Table of Contents

1. [Incident Response Runbooks](#incident-response-runbooks)
2. [Monitoring Runbooks](#monitoring-runbooks)
3. [Investigation Procedures](#investigation-procedures)
4. [Recovery Procedures](#recovery-procedures)
5. [Post-Incident Activities](#post-incident-activities)

---

## Incident Response Runbooks

### 🚨 CRITICAL: Active Security Incident

#### Trigger Conditions:
- Malicious code detected in production
- Data breach confirmed
- Unauthorized access to production systems
- Ransomware detected
- Critical vulnerability actively being exploited

#### Immediate Actions (First 15 Minutes):
1. **Incident Declaration**
   ```bash
   # Use GitHub Actions to declare incident
   gh workflow run security-incident.yml \
     -f incident_type=data_breach \
     -f severity=critical \
     -f description="Critical security incident requiring immediate response" \
     -f immediate_action=isolate_affected_systems
   ```

2. **System Isolation**
   - Disconnect affected systems from network
   - Block traffic to vulnerable endpoints
   - Enable maintenance mode for affected services
   - Preserve all logs and evidence

3. **Assemble Response Team**
   - Notify all team members via Slack and email
   - Assign roles: Incident Commander, Technical Lead, Communications Lead
   - Establish secure communication channel

4. **Initial Assessment**
   - Determine scope and impact
   - Identify affected data and systems
   - Document initial timeline

#### Investigation Phase (First 4 Hours):
1. **Evidence Collection**
   - Collect logs from all affected systems
   - Create system snapshots
   - Document running processes and network connections
   - Interview relevant personnel

2. **Root Cause Analysis**
   - Analyze logs for attack vectors
   - Review system configurations
   - Examine code changes and deployments
   - Identify exploit chain

3. **Impact Assessment**
   - Determine data exposure scope
   - Assess system damage
   - Identify affected users and customers
   - Estimate business impact

#### Containment Phase (First 24 Hours):
1. **Short-term Containment**
   - Deploy patches for known vulnerabilities
   - Reset all compromised credentials
   - Implement additional security controls
   - Monitor for continued malicious activity

2. **Communication**
   - Notify management and legal teams
   - Prepare customer notifications (if required)
   - Coordinate with external security teams
   - Update status page and documentation

### ⚠️ HIGH: Security Vulnerability Detected

#### Trigger Conditions:
- Critical CVSS score (>9.0) vulnerability found
- Proof-of-concept exploit available
- Vulnerability in production dependencies

#### Response Actions:
1. **Vulnerability Assessment**
   - Validate vulnerability existence
   - Determine exploitability in production
   - Assess potential impact
   - Identify affected systems

2. **Remediation Planning**
   - Develop patch strategy
   - Plan temporary mitigations
   - Prepare rollback procedures
   - Schedule maintenance window

3. **Implementation**
   - Apply patches or configuration changes
   - Deploy mitigating controls
   - Test fixes thoroughly
   - Monitor for issues

### 📋 MEDIUM: Suspicious Activity

#### Trigger Conditions:
- Unusual login patterns detected
- Multiple failed authentication attempts
- Anomalous API usage patterns

#### Response Actions:
1. **Activity Analysis**
   - Review logs for suspicious patterns
   - Check IP reputation and geolocation
   - Analyze user behavior patterns
   - Correlate with other security events

2. **Investigation**
   - Verify account ownership
   - Check for compromise indicators
   - Contact affected users if necessary
   - Document findings

3. **Response Actions**
   - Block malicious IP addresses
   - Implement additional rate limiting
   - Require password resets for affected accounts
   - Enhance monitoring for similar patterns

---

## Monitoring Runbooks

### 🔒 SSL Certificate Management

#### Daily Monitoring:
```bash
# Check SSL certificate expiration
#!/bin/bash

domains=(
  "labelmint.it"
  "api.labelmint.it"
  "app.labelmint.it"
  "enterprise-api.labelmint.it"
)

critical_threshold=30
warning_threshold=60

for domain in "${domains[@]}"; do
  expiry_date=$(echo | openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | openssl x509 -noout -dates | grep "notAfter" | cut -d= -f2)
  expiry_epoch=$(date -d "$expiry_date" +%s)
  current_epoch=$(date +%s)
  days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))

  if [ $days_until_expiry -le $critical_threshold ]; then
    echo "🚨 CRITICAL: $domain expires in $days_until_expiry days ($expiry_date)"
    # Send critical alert
    curl -X POST "$SECURITY_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"alert_type\":\"ssl_expiration\",\"severity\":\"critical\",\"domain\":\"$domain\",\"days_remaining\":$days_until_expiry}"
  elif [ $days_until_expiry -le $warning_threshold ]; then
    echo "⚠️ WARNING: $domain expires in $days_until_expiry days ($expiry_date)"
    # Send warning alert
    curl -X POST "$SECURITY_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"alert_type\":\"ssl_expiration\",\"severity\":\"warning\",\"domain\":\"$domain\",\"days_remaining\":$days_until_expiry}"
  else
    echo "✅ OK: $domain expires in $days_until_expiry days ($expiry_date)"
  fi
done
```

### 🔍 Security Header Monitoring

#### Monitoring Script:
```bash
#!/bin/bash

endpoints=(
  "https://labelmint.it"
  "https://api.labelmint.it"
  "https://app.labelmint.it"
  "https://enterprise-api.labelmint.it"
)

required_headers=(
  "strict-transport-security"
  "x-frame-options"
  "x-xss-protection"
  "x-content-type-options"
  "content-security-policy"
  "referrer-policy"
)

issues_found=false

for endpoint in "${endpoints[@]}"; do
  echo "Checking $endpoint..."
  headers=$(curl -s -I "$endpoint" | tr -d '\r')

  missing_headers=()

  for header in "${required_headers[@]}"; do
    if ! echo "$headers" | grep -qi "^${header//_/-}:"; then
      missing_headers+=("$header")
      issues_found=true
    fi
  done

  if [ ${#missing_headers[@]} -gt 0 ]; then
    echo "❌ Missing security headers for $endpoint: ${missing_headers[*]}"
  else
    echo "✅ All security headers present for $endpoint"
  fi
done

if [ "$issues_found" = true ]; then
  # Send alert
  curl -X POST "$SECURITY_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"alert_type\":\"security_headers_missing\",\"severity\":\"medium\"}"
fi
```

### 🚦 Rate Limiting Monitor

#### Rate Limit Test Script:
```bash
#!/bin/bash

# Test rate limiting functionality
endpoint="https://api.labelmint.it/api/test"
concurrent_requests=10
test_duration=60

echo "Testing rate limiting on $endpoint..."

# Create concurrent requests to test rate limiting
requests=()
for i in $(seq 1 $concurrent_requests); do
  requests+=(
    curl -s -w "%{http_code}|%{time_total}" \
      -H "X-Test-ID: rate-limit-test-$i" \
      "$endpoint" \
      2>/dev/null
  )
done

# Analyze results
rate_limited=0
successful=0
errors=0

for result in "${requests[@]}"; do
  IFS='|' read -r status_code response_time <<< "$result"

  if [ "$status_code" = "429" ]; then
    rate_limited=$((rate_limited + 1))
  elif [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
    successful=$((successful + 1))
  else
    errors=$((errors + 1))
  fi
done

echo "Results:"
echo "- Rate Limited: $rate_limited"
echo "- Successful: $successful"
echo "- Errors: $errors"
echo "- Total Requests: $concurrent_requests"

# Alert if rate limiting isn't working
if [ $rate_limited -eq 0 ] && [ $successful -gt 0 ]; then
  echo "⚠️ WARNING: Rate limiting may not be working correctly"
  curl -X POST "$SECURITY_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"alert_type\":\"rate_limiting_issue\",\"severity\":\"medium\"}"
fi
```

---

## Investigation Procedures

### 🕵 Forensic Evidence Collection

#### System Information Collection:
```bash
#!/bin/bash

# Create evidence collection directory
evidence_dir="forensic-evidence-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$evidence_dir"

# System information
echo "Collecting system information..."

# Process list
ps aux > "$evidence_dir/processes.txt"

# Network connections
netstat -tuln > "$evidence_dir/network_connections.txt"

# Active users
who > "$evidence_dir/active_users.txt"

# Last logins
last -n 100 > "$evidence_dir/last_logins.txt"

# Running services
systemctl list-units --type=service --state=running > "$evidence_dir/running_services.txt"

# Disk usage
df -h > "$evidence_dir/disk_usage.txt"

# Memory usage
free -h > "$evidence_dir/memory_usage.txt"

# Application logs (last 1000 lines)
tail -n 1000 /var/log/application.log > "$evidence_dir/application_logs.txt"

# System logs (last 1000 lines)
journalctl -n 1000 > "$evidence_dir/system_logs.txt"

# Hash all collected files
find "$evidence_dir" -type f -exec sha256sum {} + > "$evidence_dir/file_hashes.txt"

echo "Evidence collection complete: $evidence_dir"
```

#### Log Analysis Commands:
```bash
# Find failed authentication attempts
grep "authentication.*failed" /var/log/application.log | tail -100

# Find suspicious IP addresses
grep -o "r=[0-9.]\+\.[0-9]\+\.[0-9]\+\.[0-9]\+" /var/log/access.log | sort | uniq -c | sort -nr

# Find SQL injection attempts
grep -i "union\|select\|drop\|insert\|update" /var/log/access.log | tail -50

# Find XSS attempts
grep -i "<script\|javascript:" /var/log/application.log | tail -50

# Find unusual user agents
grep -E "curl|wget|python|perl" /var/log/access.log | tail -100
```

### 🔐 Credential Compromise Investigation

#### Investigation Checklist:
1. **Account Analysis**
   - Review user account creation dates
   - Check login patterns and geolocations
   - Verify recent password changes
   - Review privilege levels

2. **System Access Logs**
   - Examine SSH login logs
   - Review application authentication logs
   - Check VPN access logs
   - Analyze API access patterns

3. **Credential Usage**
   - Check for credential reuse
   - Verify API key usage patterns
   - Review authentication token usage
   - Check for privilege escalation

---

## Recovery Procedures

### 🔄 System Recovery After Incident

#### Recovery Checklist:
1. **Verification of Clean State**
   - [ ] All malware removed
   - [ ] Vulnerabilities patched
   - [ ] Backups verified as clean
   - [ ] Systems reimaged if necessary

2. **Credential Reset**
   - [ ] All user passwords reset
   - [ ] API keys regenerated
   - [ ] Service accounts updated
   - [ ] SSH keys regenerated

3. **Service Restoration**
   - [ ] Services brought back online
   - [ ] Configuration verified
   - [ ] Monitoring enabled
   - [ ] Functionality tested

4. **Communication**
   - [ ] Team notified of recovery
   - [ ] Management updated
   - [ ] Users informed (if applicable)
   - [ ] Status page updated

### 📦 Backup and Restore Procedures

#### Backup Verification:
```bash
#!/bin/bash

# Verify backup integrity
backup_date="2024-10-24"
backup_location="/backups/security"

echo "Verifying backup integrity for $backup_date..."

# Check file existence
for backup_file in "$backup_location"/*-"$backup_date"*; do
  if [ -f "$backup_file" ]; then
    # Verify checksum
    checksum_file="${backup_file}.checksum"
    if [ -f "$checksum_file" ]; then
      expected_checksum=$(cat "$checksum_file")
      actual_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)

      if [ "$expected_checksum" = "$actual_checksum" ]; then
        echo "✅ $backup_file: Checksum verified"
      else
        echo "❌ $backup_file: Checksum mismatch!"
      fi
    else
      echo "⚠️ $backup_file: No checksum file found"
    fi
  fi
done
```

---

## Post-Incident Activities

### 📊 Incident Review Process

#### Review Timeline:
1. **Initial Response** (0-24 hours)
   - Incident detection and declaration time
   - Response team assembly time
   - Initial containment actions
   - Communication timeline

2. **Investigation** (24-72 hours)
   - Root cause identification
   - Impact assessment completion
   - Evidence collection completeness
   - Technical analysis results

3. **Resolution** (72+ hours)
   - Full recovery time
   - Remediation effectiveness
   - System hardening measures
   - Monitoring improvements

#### Lessons Learned Template:
```markdown
# Post-Incident Review: [INCIDENT_ID]

## Executive Summary
- Incident Type:
- Severity Level:
- Business Impact:
- Resolution Time:

## Timeline
- Detection:
- Response:
- Investigation:
- Resolution:
- Recovery:

## Root Cause Analysis
- Primary Cause:
- Contributing Factors:
- Prevention Opportunities:

## Impact Assessment
- Affected Systems:
- Data Exposure:
- User Impact:
- Business Disruption:

## Response Effectiveness
- What Worked Well:
- Challenges Faced:
- Areas for Improvement:

## Recommendations
- Technical Improvements:
- Process Improvements:
- Training Needs:
- Tool Enhancements:
```

### 🎯 Continuous Improvement

#### Security Posture Enhancement:
1. **Weekly Reviews**
   - Security alert trends analysis
   - Vulnerability patching status
   - Monitoring effectiveness assessment
   - Team capability evaluation

2. **Monthly Assessments**
   - Security metrics dashboard review
   - Incident response drill execution
   - Security policy updates
   - Tool effectiveness review

3. **Quarterly Audits**
   - Full security posture assessment
   - Penetration testing results review
   - Compliance verification
   - Budget and resource planning

---

## 📞 Emergency Contacts

### Security Team:
- **Security Lead**: security-lead@labelmint.it
- **Incident Commander**: incident@labelmint.it
- **Technical Lead**: tech-lead@labelmint.it

### Management:
- **CTO**: cto@labelmint.it
- **VP Engineering**: vp-engineering@labelmint.it
- **Legal Counsel**: legal@labelmint.it

### External:
- **Incident Response Firm**: external@security-firm.it
- **Forensics Partner**: forensics@partner.it
- **Law Enforcement**: local-authorities@example.com

### Communication Channels:
- **Primary**: Slack #security-incident
- **Secondary**: Email distribution lists
- **Emergency**: Phone tree (contact security lead)
- **Status Updates**: https://status.labelmint.it

---

**Last Updated**: 2024-10-24
**Next Review**: 2025-01-24
**Approved by**: Security Team Lead