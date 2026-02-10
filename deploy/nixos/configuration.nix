# OpenSpatial server configuration for Hetzner Cloud
{ config, lib, pkgs, ... }:

let
  domain = "spatial.srid.ca";
  email = "srid@srid.ca";
in
{
  # Enable flakes
  nix.settings.experimental-features = [ "nix-command" "flakes" ];

  # Basic system packages
  environment.systemPackages = with pkgs; [
    vim
    git
    htop
    openssl
  ];

  # Create directory for openspatial secrets (readable by turnserver for coturn)
  systemd.tmpfiles.rules = [
    "d /etc/openspatial 0755 root root -"
  ];

  # Timezone
  time.timeZone = "America/Toronto";

  # Locale
  i18n.defaultLocale = "en_US.UTF-8";

  # ============================================
  # OpenSpatial service
  # ============================================
  services.openspatial = {
    enable = true;
    port = 3000;
    https = false;  # nginx handles TLS
    domain = domain;

    # Spaces to create on startup
    spaces = [ "demo" "jusnix" "actualism" "vinoth" ];
    
    turn = {
      enable = true;
      externalIP = "46.62.227.127";
      # Create this file with: openssl rand -hex 32 > /etc/openspatial/turn-secret
      secretFile = "/etc/openspatial/turn-secret";
    };

    notifications.slack = {
      enable = true;
      # See SLACK_SETUP.md for bot token setup
      # Save the token to: /etc/openspatial/slack-bot-token
      botTokenFile = "/etc/openspatial/slack-bot-token";
      channelId = "CMV6W2212";
      # Only notify for these spaces
      spaces = [ "jusnix" ];
    };
  };

  # ============================================
  # Nginx reverse proxy with Let's Encrypt
  # ============================================
  services.nginx = {
    enable = true;
    
    recommendedGzipSettings = true;
    recommendedOptimisation = true;
    recommendedProxySettings = true;
    recommendedTlsSettings = true;

    virtualHosts.${domain} = {
      enableACME = true;
      forceSSL = true;
      
      locations."/" = {
        proxyPass = "http://127.0.0.1:3000";
        proxyWebsockets = true;
      };
    };
  };

  # ACME (Let's Encrypt) configuration
  security.acme = {
    acceptTerms = true;
    defaults.email = email;
  };

  # ============================================
  # SSH access
  # ============================================
  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = "prohibit-password";
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
    };
  };

  users.users.root.openssh.authorizedKeys.keys = [
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHQRxPoqlThDrkR58pKnJgmeWPY9/wleReRbZ2MOZRyd"
  ];

  # ============================================
  # Firewall
  # ============================================
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [
      22    # SSH
      80    # HTTP (ACME challenges)
      443   # HTTPS
    ];
    # TURN ports are auto-opened by openspatial module when turn.enable = true
  };

  # ============================================
  # System state version
  # ============================================
  system.stateVersion = "24.11";
}
