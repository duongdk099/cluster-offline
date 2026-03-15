# Terraform Deployment for DigitalOcean (k3s)

This folder provisions a DigitalOcean droplet and deploys the app to k3s automatically.

What it automates:
- Create droplet (default size: s-1vcpu-2gb)
- Open firewall ports 22, 80, 443
- Install k3s
- Install cert-manager
- Upload k3s manifests from this repository
- Create/refresh Kubernetes Secret and ConfigMap
- Apply app manifests
- Run DB migration job and wait for completion

What it does not automate:
- Building and pushing container images
- Creating DNS records at your domain registrar

## Prerequisites

1. Build and push your images before running Terraform.
2. Point DNS A records to the new droplet IP after creation:
   - notesaides.app
   - api.notesaides.app
3. Terraform CLI installed locally.

## Quick Start

1. Copy variables example:

cp terraform.tfvars.example terraform.tfvars

2. Edit terraform.tfvars with your values.

3. Run Terraform:

terraform init
terraform apply

4. After apply, check outputs:

terraform output

## Update Deployment

When you push new images, update terraform.tfvars image tags and run:

terraform apply

## Destroy

terraform destroy

## Notes

- Job resources are immutable in Kubernetes. This automation deletes and recreates the migration job on each apply.
- If provisioning fails due to temporary network issues, just run terraform apply again.
