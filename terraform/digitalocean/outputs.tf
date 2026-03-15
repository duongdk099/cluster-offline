output "droplet_ip" {
  description = "Public IPv4 of the created droplet"
  value       = digitalocean_droplet.k3s.ipv4_address
}

output "ssh_command" {
  description = "SSH command for the droplet"
  value       = "ssh root@${digitalocean_droplet.k3s.ipv4_address}"
}

output "frontend_url" {
  description = "Frontend URL"
  value       = "https://${var.root_domain}"
}

output "api_url" {
  description = "API URL"
  value       = "https://${var.api_domain}"
}
