# Fresh VPS Deployment Guide (k3s)

This guide documents the validated deployment flow for a fresh VPS.

## Key rules

- Docker is not required on VPS to run Kubernetes workloads.
- k3s uses containerd, so kubectl apply is enough for runtime.
- Docker is required only on the machine that builds images (laptop or CI).
- Kubernetes Job templates are immutable. Delete and recreate migration job when it changes.

## Option A: Manual deployment (validated path)

### 1) Build and push images from your local machine

API:

cd api
docker build -t barry303/cluster-api:prod-v3 .
docker push barry303/cluster-api:prod-v3
cd ..

Frontend:

docker build -f front/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.notesaides.app --build-arg NEXT_PUBLIC_WS_URL=wss://api.notesaides.app/ws -t barry303/cluster-front:prod-v1 .
docker push barry303/cluster-front:prod-v1

### 2) Prepare DNS

Point A records to VPS IP:

- notesaides.app
- api.notesaides.app

### 3) Install k3s + cert-manager on VPS

ssh root@<VPS_IP>
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.3/cert-manager.yaml
kubectl -n cert-manager rollout status deploy/cert-manager --timeout=300s
kubectl -n cert-manager rollout status deploy/cert-manager-cainjector --timeout=300s
kubectl -n cert-manager rollout status deploy/cert-manager-webhook --timeout=300s

### 4) Copy manifests and deploy

From local machine:

scp -r C:/Users/barry/Documents/study/Cluster/k3s root@<VPS_IP>:/root/notesaides/

On VPS:

cd /root/notesaides
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl apply -f k3s/00-namespace.yaml
kubectl apply -f k3s/01-security.yaml
kubectl apply -f k3s/02-database.yaml
kubectl apply -f k3s/03-backend.yaml
kubectl apply -f k3s/04-frontend.yaml
kubectl apply -f k3s/06-issuer.yaml
kubectl apply -f k3s/05-ingress.yaml

### 5) Run migration job (delete then create)

kubectl -n my-app-project rollout status deploy/postgres --timeout=300s
kubectl -n my-app-project delete job api-db-migrate --ignore-not-found
kubectl apply -f /root/notesaides/k3s/07-migrate-job.yaml
kubectl -n my-app-project wait --for=condition=complete job/api-db-migrate --timeout=600s
kubectl -n my-app-project logs job/api-db-migrate --tail=200

### 6) Validate

kubectl -n my-app-project get pods -o wide
kubectl get certificate -A
curl -i https://api.notesaides.app/
curl -i -X POST https://api.notesaides.app/auth/register -H "Content-Type: application/json" -d '{"email":"check@example.com","password":"duongpro123"}'

## Option B: Terraform automation for DigitalOcean

Use files in terraform/digitalocean to automate droplet + k3s + deployment.

What Terraform automates:

- Create droplet (default: s-1vcpu-2gb)
- Configure firewall (22, 80, 443)
- Install k3s
- Install cert-manager
- Upload k3s manifests from this repo
- Apply Kubernetes resources
- Run migration job and wait for completion

What Terraform does not automate:

- Building/pushing docker images
- DNS setup at your registrar

Quick start:

cd terraform/digitalocean
cp terraform.tfvars.example terraform.tfvars

Edit terraform.tfvars values:

- do_token
- letsencrypt_email
- postgres_password
- jwt_secret
- backend_image
- frontend_image

Run:

terraform init
terraform apply

## Troubleshooting checklist

Run these first on VPS:

kubectl -n my-app-project get pods -o wide
kubectl -n my-app-project logs deploy/backend-hono --tail=200
kubectl -n my-app-project logs job/api-db-migrate --tail=200
kubectl -n my-app-project exec deploy/postgres -- psql -U postgres -d my_database -c "\\dt"

If migration job apply fails with immutable field:

kubectl -n my-app-project delete job api-db-migrate --ignore-not-found
kubectl apply -f /root/notesaides/k3s/07-migrate-job.yaml

## Current known-good profile

- Backend image: barry303/cluster-api:prod-v3
- Frontend image: barry303/cluster-front:prod-v1
- Backend replicas: 1
- Frontend replicas: 1
- Uploads persisted via backend-uploads-pvc
