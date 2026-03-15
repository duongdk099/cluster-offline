provider "digitalocean" {
  token = var.do_token
}

locals {
  kubeconfig_path = "/etc/rancher/k3s/k3s.yaml"
  repo_root       = abspath("${path.module}/../..")
}

resource "digitalocean_ssh_key" "deployer" {
  name       = "${var.droplet_name}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "digitalocean_droplet" "k3s" {
  name     = var.droplet_name
  region   = var.region
  size     = var.size
  image    = var.image
  ssh_keys = [digitalocean_ssh_key.deployer.fingerprint]

  tags = ["notesaides", "k3s"]
}

resource "digitalocean_firewall" "k3s" {
  name = "${var.droplet_name}-fw"

  droplet_ids = [digitalocean_droplet.k3s.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "null_resource" "bootstrap_and_deploy" {
  depends_on = [digitalocean_droplet.k3s, digitalocean_firewall.k3s]

  triggers = {
    droplet_id       = tostring(digitalocean_droplet.k3s.id)
    backend_image    = var.backend_image
    frontend_image   = var.frontend_image
    namespace        = var.namespace
    api_domain       = var.api_domain
    root_domain      = var.root_domain
    issuer_email     = var.letsencrypt_email
    k3s_hash         = sha256(join("", [for f in fileset(local.repo_root, "k3s/*.yaml") : filesha256("${local.repo_root}/${f}")]))
    this_file_hash   = filesha256("${path.module}/main.tf")
  }

  connection {
    type        = "ssh"
    user        = "root"
    host        = digitalocean_droplet.k3s.ipv4_address
    private_key = file(pathexpand(var.ssh_private_key_path))
    timeout     = "5m"
  }

  provisioner "remote-exec" {
    inline = [
      "set -euxo pipefail",
      "apt-get update -y",
      "apt-get install -y curl ca-certificates",
      "curl -sfL https://get.k3s.io | sh -",
      "export KUBECONFIG=${local.kubeconfig_path}",
      "kubectl wait --for=condition=Ready node --all --timeout=300s",
      "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.3/cert-manager.yaml",
      "kubectl -n cert-manager rollout status deploy/cert-manager --timeout=300s",
      "kubectl -n cert-manager rollout status deploy/cert-manager-cainjector --timeout=300s",
      "kubectl -n cert-manager rollout status deploy/cert-manager-webhook --timeout=300s",
      "mkdir -p /root/notesaides"
    ]
  }

  provisioner "file" {
    source      = "${local.repo_root}/k3s"
    destination = "/root/notesaides"
  }

  provisioner "remote-exec" {
    inline = [
      "set -euxo pipefail",
      "export KUBECONFIG=${local.kubeconfig_path}",
      "cd /root/notesaides/k3s",
      "sed -i 's|barry303/cluster-api:[^\"[:space:]]*|${var.backend_image}|g' 03-backend.yaml 07-migrate-job.yaml",
      "sed -i 's|barry303/cluster-front:[^\"[:space:]]*|${var.frontend_image}|g' 04-frontend.yaml",
      "sed -i 's|duongdk69@gmail.com|${var.letsencrypt_email}|g' 06-issuer.yaml",
      "sed -i 's|https://api.notesaides.app|https://${var.api_domain}|g' 04-frontend.yaml",
      "sed -i 's|wss://api.notesaides.app/ws|wss://${var.api_domain}/ws|g' 04-frontend.yaml",
      "sed -i 's|notesaides.app|${var.root_domain}|g' 05-ingress.yaml",
      "sed -i 's|api.notesaides.app|${var.api_domain}|g' 05-ingress.yaml",
      "kubectl apply -f 00-namespace.yaml",
      "kubectl -n ${var.namespace} create secret generic db-secret --from-literal=POSTGRES_PASSWORD=\"$(echo '${base64encode(var.postgres_password)}' | base64 -d)\" --from-literal=JWT_SECRET=\"$(echo '${base64encode(var.jwt_secret)}' | base64 -d)\" --dry-run=client -o yaml | kubectl apply -f -",
      "kubectl -n ${var.namespace} create configmap app-config --from-literal=DB_HOST=postgres-service --from-literal=POSTGRES_USER=postgres --from-literal=DB_NAME=my_database --from-literal=API_URL=https://${var.api_domain} --from-literal=API_INTERNAL_URL=http://backend-service --from-literal=PORT=3000 --dry-run=client -o yaml | kubectl apply -f -",
      "kubectl apply -f 02-database.yaml",
      "kubectl -n ${var.namespace} rollout status deploy/postgres --timeout=300s",
      "kubectl apply -f 03-backend.yaml",
      "kubectl apply -f 04-frontend.yaml",
      "kubectl apply -f 06-issuer.yaml",
      "kubectl apply -f 05-ingress.yaml",
      "kubectl -n ${var.namespace} rollout status deploy/backend-hono --timeout=300s",
      "kubectl -n ${var.namespace} rollout status deploy/frontend-nextjs --timeout=300s",
      "kubectl -n ${var.namespace} delete job api-db-migrate --ignore-not-found",
      "kubectl apply -f 07-migrate-job.yaml",
      "kubectl -n ${var.namespace} wait --for=condition=complete job/api-db-migrate --timeout=600s"
    ]
  }
}
