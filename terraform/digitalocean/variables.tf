variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "ssh_public_key_path" {
  description = "Path to your local SSH public key"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "ssh_private_key_path" {
  description = "Path to your local SSH private key used for provisioners"
  type        = string
  default     = "~/.ssh/id_rsa"
}

variable "droplet_name" {
  description = "Droplet name"
  type        = string
  default     = "notesaides-k3s"
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "fra1"
}

variable "size" {
  description = "Droplet size"
  type        = string
  default     = "s-1vcpu-2gb"
}

variable "image" {
  description = "Droplet OS image"
  type        = string
  default     = "ubuntu-24-04-x64"
}

variable "letsencrypt_email" {
  description = "Email used by cert-manager ACME issuer"
  type        = string
}

variable "root_domain" {
  description = "Frontend domain"
  type        = string
  default     = "notesaides.app"
}

variable "api_domain" {
  description = "Backend/API domain"
  type        = string
  default     = "api.notesaides.app"
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "my-app-project"
}

variable "postgres_password" {
  description = "Postgres password for db-secret"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret for db-secret"
  type        = string
  sensitive   = true
}

variable "backend_image" {
  description = "Backend container image"
  type        = string
  default     = "barry303/cluster-api:prod-v3"
}

variable "frontend_image" {
  description = "Frontend container image"
  type        = string
  default     = "barry303/cluster-front:prod-v1"
}
