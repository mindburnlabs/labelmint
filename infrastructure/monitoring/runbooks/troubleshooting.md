# LabelMint Infrastructure Troubleshooting Runbook

**Purpose**: This runbook provides step-by-step procedures for troubleshooting common LabelMint infrastructure issues.

**Last Updated**: 2025-10-24
**Severity**: Standard Operating Procedure

---

## 🔍 Quick Diagnosis Checklist

Before diving into specific troubleshooting, always run this quick diagnosis:

```bash
# 1. Check all container statuses
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Check resource usage
docker stats --no-stream

# 3. Check disk space
df -h

# 4. Check system logs for errors
docker-compose -f docker-compose.unified.yml logs --tail=50 | grep -i error

# 5. Test core service health
curl -sf http://localhost:3001/api/health && echo "Grafana OK" || echo "Grafana DOWN"
curl -sf http://localhost:9090/-/healthy && echo "Prometheus OK" || echo "Prometheus DOWN"
curl -sf http://localhost:9000/minio/health/live && echo "MinIO OK" || echo "MinIO DOWN"
```

---

## 🚨 Service-Specific Troubleshooting

### PostgreSQL Issues

#### Symptom: PostgreSQL container not starting or unhealthy

**Diagnosis:**
```bash
# Check container status
docker inspect --format='{{.State.Status}} {{.State.Health.Status}}' labelmint-postgres

# Check logs
docker logs labelmint-postgres --tail=50

# Check if port is available
netstat -tulpn | grep :5432
```

**Common Causes & Solutions:**

1. **Port Conflict:**
   ```bash
   # Find what's using port 5432
   lsof -i :5432

   # Stop conflicting service or change port
   ```

2. **Data Volume Corruption:**
   ```bash
   # Backup existing data
   docker exec labelmint-postgres pg_dump -U labelmint labelmint > emergency-backup.sql

   # Recreate volume
   docker-compose -f docker-compose.unified.yml down
   docker volume rm labelmint_postgres_data
   docker-compose -f docker-compose.unified.yml up -d postgres

   # Restore data if needed
   docker exec -i labelmint-postgres psql -U labelmint labelmint < emergency-backup.sql
   ```

3. **Permission Issues:**
   ```bash
   # Check volume permissions
   docker exec labelmint-postgres ls -la /var/lib/postgresql/data

   # Fix permissions if needed
   docker exec -u root labelmint-postgres chown -R postgres:postgres /var/lib/postgresql/data
   ```

4. **Memory Insufficient:**
   ```bash
   # Check system memory
   free -h

   # Increase memory limits in docker-compose.unified.yml
   ```

#### Symptom: Cannot connect to PostgreSQL

**Diagnosis:**
```bash
# Test connection from inside container
docker exec labelmint-postgres pg_isready -U labelmint -d labelmint

# Test connection from host
pg_isready -h localhost -p 5432 -d labelmint -U labelmint

# Check network connectivity
docker network inspect labelmint_labelmint-data
```

**Solutions:**
1. **Restart PostgreSQL:**
   ```bash
   docker-compose -f docker-compose.unified.yml restart postgres
   ```

2. **Check Environment Variables:**
   ```bash
   docker exec labelmint-postgres env | grep POSTGRES
   ```

3. **Reset Password:**
   ```bash
   docker exec -it labelmint-postgres psql -U labelmint
   ALTER USER labelmint WITH PASSWORD 'new-password';
   ```

---

### Redis Issues

#### Symptom: Redis authentication failures

**Diagnosis:**
```bash
# Check Redis logs
docker logs labelmint-redis --tail=20

# Test connection with password
redis-cli -h localhost -p 6379 -a redis123secure ping

# Check configuration
docker exec labelmint-redis redis-cli -a redis123secure CONFIG GET requirepass
```

**Solutions:**
1. **Verify Password:**
   ```bash
   # Check .env file
   grep REDIS_PASSWORD .env

   # Update if needed
   docker-compose -f docker-compose.unified.yml restart redis
   ```

2. **Reset Redis:**
   ```bash
   # Warning: This will clear all data
   docker-compose -f docker-compose.unified.yml down
   docker volume rm labelmint_redis_data
   docker-compose -f docker-compose.unified.yml up -d redis
   ```

#### Symptom: Redis memory issues

**Diagnosis:**
```bash
# Check Redis memory usage
docker exec labelmint-redis redis-cli -a redis123secure info memory | grep used_memory

# Check Redis info
docker exec labelmint-redis redis-cli -a redis123secure info server
```

**Solutions:**
1. **Clear Cache:**
   ```bash
   docker exec labelmint-redis redis-cli -a redis123secure FLUSHDB
   ```

2. **Configure Memory Limits:**
   ```bash
   # Edit redis configuration
   docker exec labelmint-redis redis-cli -a redis123secure CONFIG SET maxmemory 1gb
   docker exec labelmint-redis redis-cli -a redis123secure CONFIG SET maxmemory-policy allkeys-lru
   ```

---

### MinIO Issues

#### Symptom: MinIO unhealthy or inaccessible

**Diagnosis:**
```bash
# Check container status
docker inspect --format='{{.State.Status}} {{.State.Health.Status}}' labelmint-minio

# Check logs
docker logs labelmint-minio --tail=50

# Test health endpoint
curl -sf http://localhost:9000/minio/health/live

# Test console access
curl -sf http://localhost:9001
```

**Common Causes & Solutions:**

1. **Wrong Credentials:**
   ```bash
   # Check actual credentials
   docker exec labelmint-minio env | grep MINIO

   # Update .env if needed
   docker-compose -f docker-compose.unified.yml restart minio
   ```

2. **Volume Issues:**
   ```bash
   # Check data directory
   docker exec labelmint-minio ls -la /data

   # Fix permissions
   docker exec -u root labelmint-minio chown -R minio:minio /data
   ```

3. **Port Conflicts:**
   ```bash
   # Check port usage
   lsof -i :9000
   lsof -i :9001
   ```

#### Symptom: Cannot access MinIO buckets

**Diagnosis:**
```bash
# Test with mc client
mc ls labelmint/

# Check bucket policies
mc admin policy list labelmint
```

**Solutions:**
1. **Reconfigure MinIO Client:**
   ```bash
   mc alias set labelmint http://localhost:9000 labelmintadmin labelmintadmin123 --api S3v4
   ```

2. **Create Missing Buckets:**
   ```bash
   mc mb labelmint/labelmint-assets
   mc mb labelmint/labelmint-uploads
   ```

---

### Grafana Issues

#### Symptom: Grafana not accessible

**Diagnosis:**
```bash
# Check container status
docker inspect --format='{{.State.Status}} {{.State.Health.Status}}' labelmint-grafana

# Check logs
docker logs labelmint-grafana --tail=50

# Test API health
curl -sf http://localhost:3001/api/health

# Check if port is available
netstat -tulpn | grep :3001
```

**Solutions:**
1. **Restart Grafana:**
   ```bash
   docker-compose -f docker-compose.unified.yml restart grafana
   ```

2. **Check Database Connection:**
   ```bash
   # Grafana uses its own SQLite database by default
   # Check if database file is accessible
   docker exec labelmint-grafana ls -la /var/lib/grafana
   ```

3. **Reset Admin Password:**
   ```bash
   docker exec -it labelmint-grafana grafana-cli admin reset-admin-password
   ```

#### Symptom: Datasources not working

**Diagnosis:**
```bash
# Test Prometheus connectivity from Grafana container
docker exec labelmint-grafana curl -sf http://labelmint-prometheus:9090/-/healthy

# Check datasource configuration via API
curl -u admin:labelmint123secure http://localhost:3001/api/datasources
```

**Solutions:**
1. **Recreate Datasource:**
   ```bash
   # Use the setup-monitoring.sh script
   ./scripts/setup-monitoring.sh
   ```

2. **Check Network Connectivity:**
   ```bash
   # Test network connection between containers
   docker exec labelmint-grafana ping labelmint-prometheus
   ```

---

### Prometheus Issues

#### Symptom: Prometheus not collecting metrics

**Diagnosis:**
```bash
# Check container status
docker inspect --format='{{.State.Status}} {{.State.Health.Status}}' labelmint-prometheus

# Check logs
docker logs labelmint-prometheus --tail=50

# Check targets
curl http://localhost:9090/api/v1/targets

# Test health
curl -sf http://localhost:9090/-/healthy
```

**Common Causes & Solutions:**

1. **Configuration Errors:**
   ```bash
   # Validate configuration
   docker exec labelmint-prometheus promtool check config /etc/prometheus/prometheus.yml

   # Reload configuration
   curl -X POST http://localhost:9090/-/reload
   ```

2. **Target Unreachable:**
   ```bash
   # Check specific target
   curl -sf http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="postgres")'

   # Test connectivity to target
   docker exec labelmint-prometheus ping labelmint-postgres
   ```

3. **Memory Issues:**
   ```bash
   # Check Prometheus memory usage
   docker stats --no-stream | grep prometheus

   # Check WAL size
   docker exec labelmint-prometheus du -sh /prometheus
   ```

---

## 🌐 Network Issues

### Symptom: Containers cannot communicate

**Diagnosis:**
```bash
# List networks
docker network ls | grep labelmint

# Check network details
docker network inspect labelmint_labelmint-data

# Test connectivity between containers
docker exec labelmint-postgres ping labelmint-redis
docker exec labelmint-redis ping labelmint-postgres
```

**Solutions:**
1. **Recreate Networks:**
   ```bash
   docker-compose -f docker-compose.unified.yml down
   docker network prune
   docker-compose -f docker-compose.unified.yml up -d
   ```

2. **Check Container Network Assignment:**
   ```bash
   # Verify containers are on correct networks
   docker inspect labelmint-postgres | jq '.[] | .NetworkSettings.Networks'
   ```

---

## 💾 Storage Issues

### Symptom: High disk usage

**Diagnosis:**
```bash
# Check overall disk usage
df -h

# Check Docker space usage
docker system df

# Check container log sizes
docker exec labelmint-postgres du -sh /var/log/postgresql
docker exec labelmint-redis du -sh /var/log/redis
```

**Solutions:**
1. **Clean Docker Resources:**
   ```bash
   # Remove unused images, containers, networks
   docker system prune -a

   # Remove specific large items
   docker image prune -a
   docker volume prune
   ```

2. **Rotate Logs:**
   ```bash
   # Configure log rotation in docker-compose.unified.yml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

3. **Database Maintenance:**
   ```bash
   # Vacuum PostgreSQL
   docker exec -it labelmint-postgres psql -U labelmint -d labelmint -c "VACUUM ANALYZE;"

   # Clean old Redis data
   docker exec labelmint-redis redis-cli -a redis123secure FLUSHDB
   ```

---

## 🔧 Performance Issues

### Symptom: Slow response times

**Diagnosis:**
```bash
# Check resource usage
docker stats --no-stream

# Check system load
uptime
top -p $(docker inspect --format '{{.State.Pid}}' labelmint-postgres)

# Check database queries
docker exec labelmint-postgres psql -U labelmint -d labelmint -c "
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;"
```

**Solutions:**
1. **Optimize Database:**
   ```bash
   # Reindex PostgreSQL
   docker exec labelmint-postgres psql -U labelmint -d labelmint -c "REINDEX DATABASE labelmint;"

   # Update statistics
   docker exec labelmint-postgres psql -U labelmint -d labelmint -c "ANALYZE;"
   ```

2. **Scale Services:**
   ```bash
   # Add more replicas if using load balancer
   docker-compose -f docker-compose.unified.yml up -d --scale worker-bot=2
   ```

3. **Resource Allocation:**
   ```bash
   # Increase memory/CPU limits in docker-compose.unified.yml
   deploy:
     resources:
       limits:
         memory: 2G
         cpus: '1'
   ```

---

## 🚨 Emergency Procedures

### Complete System Recovery

```bash
# 1. Stop all services
docker-compose -f docker-compose.unified.yml down

# 2. Backup current state (optional)
tar -czf emergency-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  infrastructure/ \
  .env \
  docker-compose.unified.yml

# 3. Clean up
docker system prune -a
docker volume prune

# 4. Restore from backup (if available)
./scripts/restore-infrastructure.sh --backup-file latest-backup.tar.gz

# 5. Start services
docker-compose -f docker-compose.unified.yml up -d

# 6. Verify all services
./scripts/integration-tests.sh
```

### Partial Service Recovery

```bash
# Recover specific service (e.g., PostgreSQL)
docker-compose -f docker-compose.unified.yml stop postgres
docker-compose -f docker-compose.unified.yml rm -f postgres
docker-compose -f docker-compose.unified.yml up -d postgres

# Wait for service to be healthy
sleep 30

# Verify
docker exec labelmint-postgres pg_isready -U labelmint
```

---

## 📞 Escalation Procedures

### When to Escalate

- **Immediate**: Complete system outage, data loss, security breach
- **Within 1 hour**: Critical services down, performance degradation >50%
- **Within 4 hours**: Non-critical services down, minor performance issues
- **Within 24 hours**: Monitoring alerts, configuration issues

### Escalation Contacts

1. **Level 1**: On-call engineer (Slack: @oncall-infrastructure)
2. **Level 2**: Infrastructure lead (email: infrastructure@labelmint.com)
3. **Level 3**: CTO (phone: +1-555-LABELMINT)

### Information to Include in Escalation

- Service(s) affected
- Time of issue onset
- Steps already taken
- Error messages/logs
- Impact assessment
- Urgency level

---

## 📝 Post-Incident Procedures

### After Resolving Issue

1. **Document Root Cause**
   ```bash
   # Create incident report
   mkdir -p incidents/$(date +%Y%m%d)
   echo "Incident $(date +%Y%m%d)-$(date +%H%M)" > incidents/$(date +%Y%m%d)/report.md
   ```

2. **Update Monitoring**
   - Add alerting for the issue
   - Create dashboard panels
   - Update runbooks

3. **Preventive Measures**
   - Implement automated recovery
   - Add health checks
   - Update documentation

4. **Team Review**
   - Schedule post-mortem meeting
   - Share lessons learned
   - Update procedures

---

## 🧪 Testing After Repairs

Always run these tests after troubleshooting:

```bash
# 1. Basic health checks
./scripts/integration-tests.sh

# 2. Service-specific tests
curl -sf http://localhost:3001/api/health
curl -sf http://localhost:9090/-/healthy
curl -sf http://localhost:9000/minio/health/live

# 3. Database connectivity
docker exec labelmint-postgres pg_isready -U labelmint
docker exec labelmint-redis redis-cli -a redis123secure ping

# 4. Monitoring verification
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health=="up") | .labels.job'

# 5. Application functionality (if deployed)
# Add application-specific tests here
```

---

**Runbook Version**: 1.0
**Last Updated**: 2025-10-24
**Next Review**: 2025-11-24

For updates or corrections, submit a pull request or contact the infrastructure team.