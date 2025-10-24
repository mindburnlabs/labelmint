# Kubernetes Manifests for DeligateIT

This directory contains Kubernetes manifests for deploying the DeligateIT application with full observability, security, and scaling capabilities.

## Directory Structure

```
k8s/
├── base/                      # Base manifests
│   ├── deployment.yaml        # Application deployment (3 replicas)
│   ├── service.yaml          # LoadBalancer and internal services
│   ├── ingress.yaml          # Ingress with SSL termination
│   ├── configmap.yaml        # Environment configuration
│   ├── secrets.yaml          # Secret definitions
│   ├── hpa.yaml            # Horizontal Pod Autoscaling
│   ├── pdb.yaml            # Pod Disruption Budgets
│   └── kustomization.yaml  # Base Kustomize configuration
├── overlays/                # Environment-specific overlays
│   ├── staging/           # Staging environment
│   │   ├── kustomization.yaml
│   │   ├── deployment.yaml
│   │   ├── ingress.yaml
│   │   ├── resources.yaml
│   │   └── secrets.yaml
│   └── production/        # Production environment
│       ├── kustomization.yaml
│       ├── deployment.yaml
│       ├── ingress.yaml
│       ├── hpa.yaml
│       ├── resources.yaml
│       ├── network-policy.yaml
│       └── priority-classes.yaml
└── scripts/               # Helper scripts
    ├── deploy.sh
    ├── rollback.sh
    └── health-check.sh
```

## Prerequisites

1. Kubernetes cluster (EKS, GKE, AKS, or on-prem)
2. kubectl configured to connect to your cluster
3. Kustomize v3.0 or later
4. NGINX Ingress Controller installed
5. Cert-Manager installed (for SSL certificates)
6. Prometheus Stack installed (for monitoring)

## Quick Start

### Deploy to Staging

```bash
kubectl create namespace staging
kubectl apply -k overlays/staging
```

### Deploy to Production

```bash
kubectl create namespace production
kubectl apply -k overlays/production
```

## Configuration

### Environment Variables

Key environment variables are configured in `configmap.yaml`:

- **NODE_ENV**: Environment (staging/production)
- **DATABASE_HOST/PORT**: Database connection details
- **REDIS_HOST/PORT**: Redis connection details
- **JWT_SECRET**: JWT signing secret
- **CORS_ORIGINS**: Allowed CORS origins

### Secrets

Sensitive data is managed through Kubernetes Secrets:

1. Create a secrets file with your values:
```bash
cp k8s/base/secrets.yaml k8s/base/secrets-production.yaml
```

2. Encode your secrets:
```bash
echo -n 'your-secret' | base64
```

3. Apply the secrets:
```bash
kubectl apply -f k8s/base/secrets-production.yaml
```

## Features

### High Availability

- **Minimum Replicas**: 3 replicas base configuration
- **Pod Disruption Budgets**: Ensures minimum pods during maintenance
- **Anti-Affinity Rules**: Spreads pods across nodes and zones
- **Health Checks**: Liveness, readiness, and startup probes

### Auto-scaling

- **Horizontal Pod Autoscaler (HPA)**:
  - CPU-based scaling (70% threshold)
  - Memory-based scaling (80% threshold)
  - Custom metrics support (HTTP requests per second)
- **Vertical Pod Autoscaler (VPA)**: Automatic resource recommendations
- **Cluster Autoscaler**: Automatic node scaling (if enabled)

### Security

- **Network Policies**: Traffic restriction between pods
- **Pod Security Context**: Non-root execution
- **Resource Limits**: CPU and memory constraints
- **TLS Termination**: SSL at the ingress level
- **WAF Rules**: Rate limiting and attack protection

### Monitoring & Observability

- **Prometheus Metrics**: Application metrics on port 9090
- **Health Endpoints**: `/health` and `/ready`
- **Structured Logging**: JSON format logs
- **Distributed Tracing**: Ready for Jaeger/Zipkin

### Load Balancing

- **Internal Service**: ClusterIP for internal communication
- **LoadBalancer Service**: External access (AWS NLB)
- **Headless Service**: For statefulset communication
- **Ingress**: HTTP/HTTPS routing with SSL

## Deployment Strategies

### Rolling Updates

Default deployment strategy with:
- Max unavailable: 25%
- Max surge: 25%
- Graceful termination: 60 seconds

### Canary Deployments (Optional)

To enable canary deployments:

1. Create canary overlay:
```bash
mkdir -p k8s/overlays/canary
```

2. Configure with Argo Rollouts or Flagger
3. Deploy with progressive traffic shifting

## Maintenance

### Updating the Application

```bash
# Update image tag
kubectl set image deployment/deligateit deligateit-app=deligateit/app:v2.0.0 -n production

# Or use Kustomize
cd k8s/overlays/production
kustomize edit set image deligateit/app=deligateit/app:v2.0.0
kubectl apply -k .
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment deligateit --replicas=10 -n production

# Check HPA status
kubectl get hpa -n production
```

### Troubleshooting

```bash
# Check pod status
kubectl get pods -n production -l app=deligateit

# Check logs
kubectl logs -f deployment/deligateit -n production

# Check events
kubectl describe pod <pod-name> -n production

# Check ingress
kubectl get ingress -n production

# Check services
kubectl get svc -n production
```

## Customization

### Adding New Environment

1. Create new overlay directory:
```bash
mkdir -p k8s/overlays/development
```

2. Create kustomization.yaml:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
bases:
  - ../../base
namespace: development
patchesStrategicMerge:
  - deployment.yaml
```

3. Add environment-specific patches

### Custom Metrics

To add custom metrics for HPA:

1. Install Prometheus Adapter
2. Configure custom rules:
```yaml
- seriesQuery: '{__name__="http_requests_total"}'
  resources:
    overrides:
      namespace: {resource: "namespace"}
      pod: {resource: "pod"}
  name:
    matches: "^(.*)_total"
    as: "${1}_per_second"
  metricsQuery: 'rate(<<.Series>>{<<.LabelMatchers>>}[2m])'
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Deploy to Kubernetes
  run: |
    echo "::set-output name=kubectl-version::$(kubectl version --short --client)"
    kubectl apply -k k8s/overlays/${{ env.ENVIRONMENT }}
    kubectl rollout status deployment/deligateit -n ${{ env.ENVIRONMENT }}
```

## Backup and Recovery

### Stateful Components

For stateful components like databases:
- Use operator patterns (Postgres Operator, Redis Operator)
- Configure automated backups
- Document recovery procedures

### Configuration Backup

```bash
# Export all manifests
kubectl get all,configmaps,secrets,pvc -n production -o yaml > backup.yaml
```

## Performance Tuning

### Resource Optimization

1. Monitor resource usage:
```bash
kubectl top pods -n production
```

2. Adjust requests and limits based on VPA recommendations

### Network Optimization

- Enable keep-alive connections
- Use appropriate timeouts
- Configure proper health checks

## Security Best Practices

1. **Regular Updates**: Keep images and dependencies updated
2. **Secret Rotation**: Rotate secrets regularly
3. **Network Policies**: Implement least privilege networking
4. **RBAC**: Use proper role-based access control
5. **Pod Security**: Run as non-root with read-only filesystem
6. **Admission Controllers**: Use OPA/Gatekeeper for policy enforcement

## Monitoring Alerting

### Key Metrics to Monitor

- Pod restart count
- CPU/Memory utilization
- Request latency and error rate
- Database connection pool usage
- Redis memory usage

### Alert Examples

- High error rate (>5%)
- High latency (>500ms P99)
- Pod crashes (>3 in 5 minutes)
- Resource usage (>90%)

## Support

For issues:

1. Check Kubernetes events
2. Review pod logs
3. Validate resources
4. Check network policies
5. Verify RBAC permissions

## Related Documentation

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Cert-Manager](https://cert-manager.io/)
- [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)