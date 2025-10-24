# CloudFlare CDN and Performance Optimization
terraform {
  required_version = ">= 1.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# CloudFlare Zone
data "cloudflare_zone" "labelmint" {
  name = var.cloudflare_zone_name
}

# CDN Settings
resource "cloudflare_zone_settings_override" "labelmint_cdn" {
  zone_id = data.cloudflare_zone.labelmint.id

  settings {
    # Enable Brotli compression
    brotli {
      value = "on"
    }

    # Enable gzip compression
    gzip {
      value = "on"
    }

    # Enable HTTP/2
    http2 {
      value = "on"
    }

    # Enable HTTP/3 (QUIC)
    http3 {
      value = "on"
    }

    # Enable 0-RTT Connection Resumption
    0_rtt {
      value = "on"
    }

    # TLS settings
    tls_1_3 {
      value = "on"
    }

    min_tls_version {
      value = "1.2"
    }

    # SSL/TLS mode
    ssl {
      value = "full"
    }

    # Automatic HTTPS rewrites
    automatic_https_rewrites {
      value = "on"
    }

    # Opportunistic encryption
    opportunistic_encryption {
      value = "on"
    }

    # Always use HTTPS
    always_use_https {
      value = "on"
    }

    # HSTS
    strict_transport_security {
      value = {
        enabled = true
        max_age = 31536000
        include_subdomains = true
        preload = true
      }
    }

    # Browser cache TTL
    browser_cache_ttl {
      value = 31536000
    }

    # Edge cache TTL
    edge_cache_ttl {
      value = 86400
    }

    # Development mode
    development_mode {
      value = "off"
    }

    # IP geolocation
    ip_geolocation {
      value = "on"
    }

    # WebSockets
    websockets {
      value = "on"
    }

    # Onion routing
    onion_routing {
      value = "off"
    }

    # Pseudo IPv4
    pseudo_ipv4 {
      value = "off"
    }

    # Response buffering
    response_buffering {
      value = "on"
    }

    # Security level
    security_level {
      value = "high"
    }

    # Challenge passage
    challenge_ttl {
      value = 1800
    }

    # Bot fight mode
    bot_fight_mode {
      value = "on"
    }

    # Email obfuscation
    email_obfuscation {
      value = "on"
    }

    # Server side exclude
    server_side_exclude {
      value = "on"
    }

    # Hotlink protection
    hotlink_protection {
      value = "off"
    }

    # Maximum upload size
    max_upload {
      value = 100
    }
  }
}

# Page Rules for Caching
resource "cloudflare_page_rule" "static_assets" {
  zone_id = data.cloudflare_zone.labelmint.id
  target   = "labelmint.it/assets/*"

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 31536000
    browser_cache_ttl = 31536000
    cache_key_fields {
      cookie = "none"
      headers = ["none"]
      query_string = "none"
    }
    origin_cache_control = false
    respect_strong_etag = false
  }
}

resource "cloudflare_page_rule" "api_cache" {
  zone_id = data.cloudflare_zone.labelmint.id
  target   = "labelmint.it/api/public/*"

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 300
    browser_cache_ttl = 0
    cache_key_fields {
      cookie = "none"
      headers = ["Authorization", "Accept-Language"]
      query_string = "ignore"
    }
    origin_cache_control = false
  }
}

resource "cloudflare_page_rule" "images" {
  zone_id = data.cloudflare_zone.labelmint.id
  target   = "labelmint.it/*.{jpg,jpeg,png,gif,webp,avif,svg}"

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 31536000
    browser_cache_ttl = 31536000
    cache_key_fields {
      cookie = "none"
      headers = ["none"]
      query_string = "ignore"
    }
    origin_cache_control = false
  }
}

# Cache Rules (newer than page rules)
resource "cloudflare_ruleset" "cache_rules" {
  zone_id = data.cloudflare_zone.labelmint.id
  name    = "labelmint-cache-rules"
  kind    = "zone"
  phase   = "http_request_settings"

  rules {
    name      = "cache-static-assets"
    enabled   = true
    action    = "set_cache_settings"
    priority  = 1

    expression = "(http.request.uri.path matches \"/assets/*\") or (http.request.uri.path matches \"/static/*\") or (http.request.uri.path matches \"/_nuxt/*\")"

    action_parameters {
      cache {
        cache_key {
          ignore_query_string_order = false
          cache_by_device_type       = false
        }
        edge_ttl {
          default = 31536000
          status_code {
            value_range {
              from = 200
              to   = 299
            }
          }
        }
        browser_ttl {
          default = 31536000
          respect_headers = false
        }
        serve_stale_while_revalidate {
          disable_stale_while_revalidate = false
        }
        skip_origin = false
      }
    }
  }

  rules {
    name      = "cache-api-responses"
    enabled   = true
    action    = "set_cache_settings"
    priority  = 2

    expression = "(http.request.uri.path matches \"/api/public/*\") and (http.request.method eq \"GET\")"

    action_parameters {
      cache {
        cache_key {
          ignore_query_string_order = true
          cache_by_device_type       = false
          custom_key {
            query_parameters {
              include = ["version", "v"]
            }
            headers {
              include = ["Accept-Language"]
            }
          }
        }
        edge_ttl {
          default = 300
          status_code {
            value_range {
              from = 200
              to   = 299
            }
          }
        }
        browser_ttl {
          default = 0
          respect_headers = true
        }
        serve_stale_while_revalidate {
          disable_stale_while_revalidate = false
        }
        skip_origin = false
      }
    }
  }
}

# Transform Rules for Headers
resource "cloudflare_ruleset" "transform_rules" {
  zone_id = data.cloudflare_zone.labelmint.id
  name    = "labelmint-transform-rules"
  kind    = "zone"
  phase   = "http_response_transform"

  rules {
    name      = "add-security-headers"
    enabled   = true
    action    = "rewrite"
    priority  = 1

    action_parameters {
      headers {
        name      = "X-Content-Type-Options"
        operation = "set"
        value     = "nosniff"
      }
      headers {
        name      = "X-Frame-Options"
        operation = "set"
        value     = "DENY"
      }
      headers {
        name      = "X-XSS-Protection"
        operation = "set"
        value     = "1; mode=block"
      }
      headers {
        name      = "Referrer-Policy"
        operation = "set"
        value     = "strict-origin-when-cross-origin"
      }
      headers {
        name      = "Permissions-Policy"
        operation = "set"
        value     = "camera=(), microphone=(), geolocation=()"
      }
    }
  }

  rules {
    name      = "add-performance-headers"
    enabled   = true
    action    = "rewrite"
    priority  = 2

    expression = "(http.request.uri.path matches \"/*.{js,css}\")"

    action_parameters {
      headers {
        name      = "Cache-Control"
        operation = "set"
        value     = "public, max-age=31536000, immutable"
      }
    }
  }
}

# Origin Certificate
resource "cloudflare_origin_ca_certificate" "labelmint_cert" {
  hostname    = "*.labelmint.it"
  validity    = 365
  request_type = "origin-rsa"
  csr         = <<EOF
-----BEGIN CERTIFICATE REQUEST-----
MIICVjCCAb4CAQAwgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlh
MRUwEwYDVQQHDAxTYW4gRnJhbmNpc2NvMRcwFQYDVQQKDA5DbG91ZEZsYXJlLCBJ
bmMuMRMwEQYDVQQLDApPcmlnaW4gU3NsMRswGQYDVQQDDBIqLmRlbGlnYXRlLml0
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuKVMZ1K2qL8ZgGvB5b9f
G6gFJZjK7JN8+VQ8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8
-----END CERTIFICATE REQUEST-----
EOF
}

# Workers KV for Edge Storage
resource "cloudflare_workers_kv_namespace" "labelmint_cache" {
  title = "labelmint-edge-cache"
}

# Workers for Edge Computing
resource "cloudflare_worker_script" "labelmint_edge" {
  name    = "labelmint-edge-worker"
  content = file("../workers/edge-worker.js")

  kv_namespace_binding {
    name         = "CACHE_KV"
    namespace_id = cloudflare_workers_kv_namespace.labelmint_cache.id
  }
}

# Worker Route
resource "cloudflare_worker_route" "labelmint_edge_route" {
  zone_id     = data.cloudflare_zone.labelmint.id
  pattern     = "labelmint.it/*"
  script_name = cloudflare_worker_script.labelmint_edge.name
}

# D1 Database for Edge Analytics
resource "cloudflare_d1_database" "labelmint_analytics" {
  name    = "labelmint-analytics"
  wrangler_config = file("../wrangler.toml")
}

# Analytics Engine
resource "cloudflare_analytics_account" "labelmint" {
  account_id = var.cloudflare_account_id
  enabled    = true
}

# Web Application Firewall (WAF)
resource "cloudflare_waf_group" "labelmint_waf" {
  zone_id     = data.cloudflare_zone.labelmint.id
  name        = "labelmint-waf-rules"
  description = "Custom WAF rules for Deligate"
  rules       = [
    "SQL Injection",
    "Cross-Site Scripting",
    "Server-Side Request Forgery",
    "Remote File Inclusion",
    "Local File Inclusion",
    "Command Injection"
  ]
}

# Rate Limiting
resource "cloudflare_rate_limit" "api_rate_limit" {
  zone_id     = data.cloudflare_zone.labelmint.id
  threshold   = 1000
  period      = 60
  match {
    request {
      url_pattern = "labelmint.it/api/*"
      schemes     = ["HTTPS"]
      methods     = ["GET", "POST", "PUT", "DELETE"]
    }
    response {
      statuses = [200, 201, 202, 204]
      headers  = {}
      origin_traffic = false
    }
  }
  action {
    mode = "simulate"
    timeout = 3600
    response {
      content_type = "application/json"
      body         = jsonencode({ error: "Rate limit exceeded" })
    }
  }
  description = "API rate limiting"
  enabled     = true
}

# Argo Smart Routing
resource "cloudflare_argo" "labelmint_argo" {
  zone_id         = data.cloudflare_zone.labelmint.id
  smart_routing   = "on"
  tiered_caching  = "on"
}

# Image Resizing
resource "cloudflare_image_transformations" "labelmint_images" {
  zone_id = data.cloudflare_zone.labelmint.id
  enabled = true

  # Default transformations
  transformations = {
    "thumbnail" = {
      width = 200
      height = 200
      fit = "cover"
    }
    "medium" = {
      width = 800
      height = 600
      fit = "scale-down"
    }
    "large" = {
      width = 1920
      height = 1080
      fit = "scale-down"
    }
  }
}

# Bot Management
resource "cloudflare_bot_management" "labelmint_bots" {
  zone_id                       = data.cloudflare_zone.labelmint.id
  fight_mode                    = "on"
  enable_js_detection           = "on"
  session_protection            = "on"
  session_protection_timeout    = 1800
  optimize_wordpress           = "on"
}

# Load Balancing (if using multiple origins)
resource "cloudflare_load_balancer" "labelmint_lb" {
  zone_id = data.cloudflare_zone.labelmint.id
  name    = "labelmint-load-balancer"
  fallback_pool_id = cloudflare_load_balancer_pool.primary.id
  default_pool_ids = [cloudflare_load_balancer_pool.primary.id]
  proxied = true

  session_affinity = "cookie"
  session_affinity_ttl = 3600
  session_affinity_attributes {
    samesite = "Auto"
    secure   = "Auto"
    http_only = true
  }

  pop_pools {
    pop = "LAX"
    pool_ids = [cloudflare_load_balancer_pool.west_us.id]
  }

  pop_pools {
    pop = "SFO"
    pool_ids = [cloudflare_load_balancer_pool.west_us.id]
  }

  pop_pools {
    pop = "JFK"
    pool_ids = [cloudflare_load_balancer_pool.east_us.id]
  }
}

# Load Balancer Pools
resource "cloudflare_load_balancer_pool" "primary" {
  name = "labelmint-primary-pool"
  origins {
    name    = "primary-origin"
        address = "api.labelmint.it"
    weight  = 1
    enabled = true
    health  = "/api/health"
    health_check_port = 443
    health_check_protocol = "https"
  }

  check_regions = ["WNAM", "ENAM", "WEU", "EEU"]
  description = "Primary server pool"
  enabled     = true
  minimum_origins = 1
  type        = "origin"
}

resource "cloudflare_load_balancer_pool" "west_us" {
  name = "labelmint-west-us-pool"
  origins {
    name    = "west-us-origin"
    address = "us-west.api.labelmint.it"
    weight  = 1
    enabled = true
  }

  check_regions = ["WNAM"]
  description   = "West US server pool"
  enabled       = true
  minimum_origins = 1
  type          = "origin"
}

resource "cloudflare_load_balancer_pool" "east_us" {
  name = "labelmint-east-us-pool"
  origins {
    name    = "east-us-origin"
    address = "us-east.api.labelmint.it"
    weight  = 1
    enabled = true
  }

  check_regions = ["ENAM"]
  description   = "East US server pool"
  enabled       = true
  minimum_origins = 1
  type          = "origin"
}

# DNS Records
resource "cloudflare_record" "www" {
  zone_id = data.cloudflare_zone.labelmint.id
  name    = "www"
  value   = "labelmint.it"
  type    = "CNAME"
  ttl     = 300
  proxied = true
}

resource "cloudflare_record" "api" {
  zone_id = data.cloudflare_zone.labelmint.id
  name    = "api"
  value   = var.api_origin_ip
  type    = "A"
  ttl     = 300
  proxied = true
}

resource "cloudflare_record" "cdn" {
  zone_id = data.cloudflare_zone.labelmint.id
  name    = "cdn"
  value   = var.cdn_origin_ip
  type    = "A"
  ttl     = 300
  proxied = true
}

# Network Firewall Rules
resource "cloudflare_firewall_rule" "block_bad_bots" {
  zone_id     = data.cloudflare_zone.labelmint.id
  description = "Block known bad bots"
  action      = "block"
  filter {
    expression = "(cf.bot_management.score lt 30) and (http.request.method in {\"GET\" \"POST\" \"PUT\" \"DELETE\"})"
  }
  enabled = true
}

resource "cloudflare_firewall_rule" "rate_limit_abuse" {
  zone_id     = data.cloudflare_zone.labelmint.id
  description = "Rate limit abusive requests"
  action      = "block"
  filter {
    expression = "(http.request.uri.path matches \"/api/*\") and (cf.threat_score gt 50)"
  }
  enabled = true
}

# Cloudflare Functions (serverless functions)
resource "cloudflare_worker_script" "auth_function" {
  name    = "auth-edge-function"
  content = file("../workers/auth-worker.js")
}

resource "cloudflare_worker_route" "auth_route" {
  zone_id     = data.cloudflare_zone.labelmint.id
  pattern     = "labelmint.it/api/auth/*"
  script_name = cloudflare_worker_script.auth_function.name
}

# Outputs
output "cloudflare_zone_id" {
  description = "CloudFlare Zone ID"
  value       = data.cloudflare_zone.labelmint.id
}

output "nameservers" {
  description = "Nameservers for the domain"
  value       = data.cloudflare_zone.labelmint.name_servers
}

output "worker_kv_namespace_id" {
  description = "Worker KV Namespace ID"
  value       = cloudflare_workers_kv_namespace.labelmint_cache.id
}

output "d1_database_id" {
  description = "D1 Database ID"
  value       = cloudflare_d1_database.labelmint_analytics.id
}