# Security Incident Response Playbook
# ==================================

## Overview
This playbook provides step-by-step instructions for responding to security incidents in the LabelMint production environment.

## Alert Categories

### 1. Authentication & Authorization Incidents

#### Brute Force Attack Detected
**Alert**: `BruteForceAttackDetected`

**Severity**: Critical
**Team**: Security

**Immediate Actions**:
1. **Acknowledge the alert** in AlertManager
2. **Identify the source IP** from the alert details
3. **Block the IP address** at the firewall/WAF level
4. **Check for account compromises** related to the attack
5. **Review authentication logs** for the last 24 hours

**Investigation Steps**:
```bash
# Check recent authentication failures
grep "authentication failure" /var/log/auth.log | tail -100

# Check for successful logins from the attacking IP
grep "accepted password" /var/log/auth.log | grep <ATTACKING_IP>

# Review web application logs for related activity
grep <ATTACKING_IP> /var/log/nginx/access.log | tail -50
```

**Containment Actions**:
1. Block IP address in AWS WAF:
   ```bash
   aws wafv2 update-ip-set --scope CLOUDFRONT --id <IP_SET_ID> --addresses <ATTACKING_IP>/32 --action INSERT
   ```

2. Enable enhanced monitoring:
   ```bash
   # Increase auth logging level
   # Enable additional monitoring
   ```

**Recovery Actions**:
1. Monitor for continued attacks
2. Review and update authentication policies
3. Consider implementing rate limiting
4. Update security monitoring rules

#### Privilege Escalation Attempt
**Alert**: `PrivilegeEscalationAttempt`

**Severity**: Critical
**Team**: Security

**Immediate Actions**:
1. **Isolate affected systems** if possible
2. **Identify the user account** involved
3. **Disable compromised accounts**
4. **Preserve forensic evidence**

**Investigation Steps**:
```bash
# Check sudo logs for privilege escalation attempts
grep "sudo:.* COMMAND" /var/log/auth.log | tail -50

# Review user activity logs
last <USERNAME>
lastlog | grep <USERNAME>

# Check for suspicious file modifications
find / -user <USERNAME> -mtime -1 -ls 2>/dev/null
```

**Containment Actions**:
1. Disable compromised account:
   ```bash
   usermod --lock <USERNAME>
   passwd --lock <USERNAME>
   ```

2. Force password reset for affected users
3. Revoke active sessions

**Recovery Actions**:
1. Conduct full security audit
2. Update privileged access policies
3. Implement additional monitoring
4. Provide security awareness training

### 2. API Security Incidents

#### API Abuse / DDoS Attack
**Alert**: `APIAbuseDetected`, `PotentialDDoSAttack`

**Severity**: Critical/Warning
**Team**: Security, Backend

**Immediate Actions**:
1. **Check API Gateway metrics** for attack patterns
2. **Enable rate limiting** if not already active
3. **Identify attacking IPs** and user agents
4. **Consider enabling CloudFlare DDoS protection**

**Investigation Steps**:
```bash
# Check Nginx access logs for patterns
tail -f /var/log/nginx/access.log | grep -E "POST|PUT"

# Analyze request patterns
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -20

# Check for specific endpoint targeting
grep "/api/v1/" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -nr
```

**Containment Actions**:
1. Update AWS WAF rules:
   ```bash
   aws wafv2 update-web-acl --rules file://waf-rules.json --scope CLOUDFRONT --id <WEB_ACL_ID>
   ```

2. Enable API rate limiting
3. Block malicious IPs
4. Enable CloudFlare under attack mode

**Recovery Actions**:
1. Monitor traffic patterns
2. Update API security policies
3. Implement additional authentication
4. Consider API gateway hardening

#### Data Exfiltration Attempt
**Alert**: `PotentialDataExfiltration`

**Severity**: Critical
**Team**: Security, Compliance

**Immediate Actions**:
1. **Identify the source IP** and user account
2. **Block the IP address** immediately
3. **Disable compromised accounts**
4. **Preserve all logs** for forensic analysis

**Investigation Steps**:
```bash
# Check for large data transfers
grep "200" /var/log/nginx/access.log | awk '{print $10}' | sort -nr | head -10

# Review API access logs
grep "data-export" /var/log/application.log | tail -100

# Check database query logs for unusual activity
grep "SELECT.*FROM.*users" /var/log/postgresql/postgresql.log | tail -50
```

**Containment Actions**:
1. Restrict API access
2. Enable additional authentication requirements
3. Monitor all data export activities
4. Notify compliance team

**Recovery Actions**:
1. Conduct full data access audit
2. Update data loss prevention policies
3. Implement stricter access controls
4. Report to compliance/regulatory authorities if required

### 3. Infrastructure Security Incidents

#### SSL Certificate Issues
**Alert**: `SSLCertificateExpiry`, `SSLCertificateExpired`

**Severity**: Warning/Critical
**Team**: DevOps, Security

**Immediate Actions**:
1. **Check certificate details** and expiry date
2. **Identify affected services** and domains
3. **Prepare certificate renewal** if expiring soon
4. **Create emergency certificate** if expired

**Investigation Steps**:
```bash
# Check certificate details
openssl x509 -in /path/to/cert.pem -text -noout

# Check expiry dates for all services
find /etc/ssl -name "*.pem" -exec openssl x509 -in {} -enddate -noout \;

# Check certificate chain
openssl s_client -connect labelmint.it:443 -showcerts
```

**Containment Actions**:
1. Renew certificate immediately if expired
2. Update load balancer configurations
3. Restart affected services
4. Update monitoring systems

**Recovery Actions**:
1. Implement automated certificate renewal
2. Set up expiry reminders (30, 14, 7 days)
3. Document certificate management process
4. Review certificate policies

#### Port Scan / Reconnaissance
**Alert**: `PortScanDetected`

**Severity**: Warning
**Team**: Security

**Immediate Actions**:
1. **Identify scanning IP address**
2. **Check for successful intrusions**
3. **Block scanning IP** at firewall level
4. **Review security group rules**

**Investigation Steps**:
```bash
# Check firewall logs for blocked connections
grep "DROP" /var/log/iptables.log | tail -50

# Check for successful connections from scanning IP
grep <SCANNING_IP> /var/log/auth.log

# Review network connections
netstat -tuln | grep LISTEN
```

**Containment Actions**:
1. Block IP address in security groups
2. Update WAF rules
3. Enable additional logging
4. Review open ports and services

**Recovery Actions**:
1. Implement port knocking for sensitive services
2. Update intrusion detection rules
3. Conduct security assessment
4. Document and review security posture

## Escalation Procedures

### Level 1 Escalation (On-call Engineer)
- **Response Time**: 15 minutes
- **Actions**: Initial assessment, basic containment
- **Escalation**: If unresolved after 30 minutes

### Level 2 Escalation (Security Team Lead)
- **Response Time**: 30 minutes
- **Actions**: Deep investigation, advanced containment
- **Escalation**: If critical systems affected

### Level 3 Escalation (CISO/CTO)
- **Response Time**: 1 hour
- **Actions**: Strategic response, external communications
- **Escalation**: Regulatory reporting required

## Communication Procedures

### Internal Communication
1. **Slack Channel**: `#security-incidents`
2. **Email**: Security team and relevant stakeholders
3. **Status Updates**: Every 30 minutes during critical incidents

### External Communication
1. **Customer Notification**: If data or services affected
2. **Regulatory Reporting**: If required by law
3. **Public Statement**: For major security incidents

## Post-Incident Procedures

### Incident Documentation
1. **Create incident report** with timeline
2. **Document all actions taken**
3. **Identify root causes**
4. **Create improvement plan**

### Security Improvements
1. **Update monitoring rules**
2. **Implement additional controls**
3. **Update security policies**
4. **Conduct security training**

### Lessons Learned
1. **Schedule post-mortem meeting**
2. **Review response effectiveness**
3. **Update playbooks**
4. **Share findings with relevant teams**

## Contact Information

### Security Team
- **Security Lead**: security-lead@labelmint.it
- **On-call Security**: security-oncall@labelmint.it
- **Slack Channel**: #security-incidents

### Escalation Contacts
- **CTO**: cto@labelmint.it
- **CISO**: ciso@labelmint.it
- **Legal**: legal@labelmint.it

### External Contacts
- **AWS Security**: aws-security@labelmint.it
- **Incident Response Firm**: security-firm@labelmint.it
- **Legal Counsel**: legal-counsel@labelmint.it

## Tools and Resources

### Monitoring Tools
- **Grafana**: https://grafana.labelmint.it
- **AlertManager**: https://alertmanager.labelmint.it
- **Security Dashboard**: https://security.labelmint.it

### Investigation Tools
- **AWS CloudTrail**: Security logs
- **AWS GuardDuty**: Threat detection
- **Security Information and Event Management (SIEM)**

### Documentation
- **Security Policies**: https://docs.labelmint.it/security
- **Incident Response Templates**: https://docs.labelmint.it/incidents
- **Runbooks**: https://runbooks.labelmint.it

## Testing and Drills

### Regular Testing
- **Monthly**: Alert validation
- **Quarterly**: Tabletop exercises
- **Annually**: Full incident simulation

### Drill Scenarios
1. **DDoS Attack Response**
2. **Data Breach Response**
3. **Ransomware Incident**
4. **Insider Threat Response**

## Compliance Requirements

### Regulatory Requirements
- **GDPR**: Data breach notification within 72 hours
- **PCI DSS**: Payment security incident response
- **SOC 2**: Security incident documentation

### Audit Requirements
- **Incident Logs**: Retain for 2 years
- **Investigation Reports**: Maintain for audit
- **Compliance Reporting**: Quarterly reviews