# ShopSync Helm Chart

Enterprise Shopify-to-PostgreSQL data pipeline with sync, scheduling, and analytics.

## Prerequisites

- Kubernetes 1.23+
- Helm 3.8+
- PV provisioner support (for persistence)

## Installation

### Add the Helm Repository

```bash
helm repo add shopsync https://implyfree.github.io/shopsync/
helm repo update
```

### Quick Install

```bash
helm install shopsync shopsync/shopsync -n shopsync --create-namespace \
  --set env.DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

### Install with Bundled PostgreSQL

```bash
helm install shopsync shopsync/shopsync -n shopsync --create-namespace \
  --set postgresql.enabled=true \
  --set postgresql.auth.password=secure-password
```

### Install with Ingress

```bash
helm install shopsync shopsync/shopsync -n shopsync --create-namespace \
  --set env.DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=shopsync.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

## Access the Application

```bash
# Port forward
kubectl -n shopsync port-forward svc/shopsync 3000:80

# Open http://localhost:3000
```

## Configuration

### Application

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `env.DATABASE_URL` | PostgreSQL connection string | `""` |
| `env.PORT` | Application port | `"3000"` |
| `env.NODE_ENV` | Node environment | `"production"` |

### Image

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image.repository` | Image repository | `shyamkrishna21/shopsync` |
| `image.tag` | Image tag | `latest` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |

### Existing Secret

| Parameter | Description | Default |
|-----------|-------------|---------|
| `existingSecret.enabled` | Use existing secret for DATABASE_URL | `false` |
| `existingSecret.name` | Name of the existing secret | `""` |
| `existingSecret.databaseUrlKey` | Key in the secret for DATABASE_URL | `"DATABASE_URL"` |

### Service

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | Service port | `80` |
| `service.targetPort` | Container port | `3000` |

### Ingress

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.hosts` | Ingress hosts | See values.yaml |
| `ingress.tls` | TLS configuration | `[]` |

### Resources

| Parameter | Description | Default |
|-----------|-------------|---------|
| `resources.requests.cpu` | CPU request | `100m` |
| `resources.requests.memory` | Memory request | `256Mi` |
| `resources.limits.cpu` | CPU limit | `500m` |
| `resources.limits.memory` | Memory limit | `512Mi` |

### Autoscaling

| Parameter | Description | Default |
|-----------|-------------|---------|
| `autoscaling.enabled` | Enable HPA | `false` |
| `autoscaling.minReplicas` | Minimum replicas | `1` |
| `autoscaling.maxReplicas` | Maximum replicas | `5` |
| `autoscaling.targetCPUUtilizationPercentage` | CPU threshold | `80` |

### Persistence

| Parameter | Description | Default |
|-----------|-------------|---------|
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.size` | PVC size | `100Mi` |
| `persistence.storageClass` | Storage class | `""` |
| `persistence.accessModes` | Access modes | `[ReadWriteOnce]` |

### Migration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `migration.enabled` | Enable DB migration job | `true` |
| `migration.backoffLimit` | Job retry limit | `3` |

### PostgreSQL (Bitnami Subchart)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Deploy PostgreSQL | `false` |
| `postgresql.auth.username` | Database username | `shopsync` |
| `postgresql.auth.password` | Database password | `shopsync-db-password` |
| `postgresql.auth.database` | Database name | `shopsync` |
| `postgresql.primary.persistence.size` | PVC size | `5Gi` |

### Security

| Parameter | Description | Default |
|-----------|-------------|---------|
| `podSecurityContext.runAsNonRoot` | Run as non-root | `true` |
| `podSecurityContext.runAsUser` | User ID | `1000` |
| `podSecurityContext.fsGroup` | FS group | `1000` |
| `securityContext.allowPrivilegeEscalation` | Allow privilege escalation | `false` |

## Upgrading

```bash
helm repo update
helm upgrade shopsync shopsync/shopsync -n shopsync
```

## Uninstalling

```bash
helm uninstall shopsync -n shopsync
```

**Note:** This will not delete PVCs. To fully clean up:

```bash
kubectl delete pvc -n shopsync -l app.kubernetes.io/instance=shopsync
kubectl delete namespace shopsync
```

## Using External PostgreSQL

```bash
helm install shopsync shopsync/shopsync -n shopsync --create-namespace \
  --set postgresql.enabled=false \
  --set env.DATABASE_URL="postgresql://user:password@your-postgres-host:5432/dbname"
```

Or use an existing Kubernetes secret:

```bash
helm install shopsync shopsync/shopsync -n shopsync --create-namespace \
  --set postgresql.enabled=false \
  --set existingSecret.enabled=true \
  --set existingSecret.name=my-db-secret \
  --set existingSecret.databaseUrlKey=DATABASE_URL
```

## Production Checklist

- [ ] Set a strong PostgreSQL password
- [ ] Configure Shopify credentials via the UI after deployment
- [ ] Enable Ingress with TLS
- [ ] Set appropriate resource limits
- [ ] Enable autoscaling for production workloads
- [ ] Configure backup for PostgreSQL PVC
- [ ] Consider managed PostgreSQL (Cloud SQL, RDS, Azure Database) for HA
