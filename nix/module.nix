{ config, lib, pkgs, ... }:

let
  cfg = config.services.openspatial;
  openspatial = pkgs.callPackage ./package.nix { };
in
{
  options.services.openspatial = {
    enable = lib.mkEnableOption "OpenSpatial spatial video chat";

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port to listen on";
    };

    https = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = "Enable HTTPS with self-signed certificate (disable with false when using reverse proxy)";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Open firewall port";
    };

    dataDir = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/openspatial";
      description = "Directory for SQLite database and persistent data";
    };

    spaces = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [];
      example = [ "demo" "team" "friends" ];
      description = "List of space IDs to ensure exist on startup";
    };

    domain = lib.mkOption {
      type = lib.types.str;
      example = "spatial.example.com";
      description = "Public domain for the service (used for TURN realm and notification links)";
    };

    turn = {
      enable = lib.mkEnableOption "bundled coturn TURN server for NAT traversal";



      port = lib.mkOption {
        type = lib.types.port;
        default = 3478;
        description = "TURN server listening port";
      };

      secretFile = lib.mkOption {
        type = lib.types.path;
        description = "Path to file containing shared secret for TURN authentication";
      };

      minPort = lib.mkOption {
        type = lib.types.port;
        default = 49152;
        description = "Minimum port for TURN relay";
      };

      maxPort = lib.mkOption {
        type = lib.types.port;
        default = 65535;
        description = "Maximum port for TURN relay";
      };

      externalIP = lib.mkOption {
        type = lib.types.str;
        description = "External/public IP address for TURN server NAT traversal";
      };
    };

    notifications = {
      slack = {
        enable = lib.mkEnableOption "Slack notifications when spaces become active/empty";

        webhookUrlFile = lib.mkOption {
          type = lib.types.path;
          description = "Path to file containing default Slack webhook URL (keep secret)";
        };



        cooldownSeconds = lib.mkOption {
          type = lib.types.int;
          default = 600;
          description = "Minimum seconds between notifications for the same space (default: 10 minutes)";
        };

        spaces = lib.mkOption {
          type = lib.types.listOf lib.types.str;
          default = [];
          example = [ "jusnix" "team" ];
          description = "List of space IDs to notify for. Empty list means notify for all spaces.";
        };
      };
    };
  };

  config = lib.mkIf cfg.enable (lib.mkMerge [
    # Base openspatial service
    {
      systemd.services.openspatial = {
        description = "OpenSpatial Spatial Video Chat";
        wantedBy = [ "multi-user.target" ];
        after = [ "network.target" ] ++ lib.optional cfg.turn.enable "coturn.service";

        # Include bash in PATH for npm/npx subprocesses
        path = [ pkgs.bash ];

        environment = {
          PORT = toString cfg.port;
          HTTPS = if cfg.https then "1" else "0";
          DATA_DIR = cfg.dataDir;
        } // lib.optionalAttrs cfg.turn.enable {
          TURN_HOST = cfg.turn.externalIP;  # Use IP directly since domain may be behind Cloudflare
          TURN_PORT = toString cfg.turn.port;
        } // lib.optionalAttrs cfg.notifications.slack.enable {
          SLACK_BASE_URL = "${if cfg.https then "https" else "http"}://${cfg.domain}";
          SLACK_COOLDOWN_MS = toString (cfg.notifications.slack.cooldownSeconds * 1000);
        } // lib.optionalAttrs (cfg.notifications.slack.enable && cfg.notifications.slack.spaces != []) {
          SLACK_SPACES = lib.concatStringsSep "," cfg.notifications.slack.spaces;
        };

        serviceConfig = let
          # Build wrapper script when secrets need to be loaded from files
          needsWrapper = cfg.turn.enable || cfg.notifications.slack.enable;
          wrapperScript = pkgs.writeShellApplication {
            name = "openspatial-start";
            text = ''
              ${lib.optionalString cfg.turn.enable ''
                TURN_SECRET="$(cat ${cfg.turn.secretFile})"
                export TURN_SECRET
              ''}
              ${lib.optionalString cfg.notifications.slack.enable ''
                SLACK_WEBHOOK_URL="$(cat ${cfg.notifications.slack.webhookUrlFile})"
                export SLACK_WEBHOOK_URL
              ''}
              exec ${openspatial}/bin/openspatial
            '';
          };
        in {
          Type = "simple";
          Restart = "on-failure";
          DynamicUser = true;
          StateDirectory = "openspatial";
          StateDirectoryMode = "0750";
          # Create configured spaces before starting
          ExecStartPre = lib.mkIf (cfg.spaces != []) (lib.getExe (pkgs.writeShellApplication {
            name = "openspatial-init-spaces";
            text = ''
              export DATA_DIR="${cfg.dataDir}"
              ${openspatial}/bin/openspatial-cli create ${lib.concatStringsSep " " cfg.spaces}
            '';
          }));
          ExecStart = if needsWrapper
            then lib.getExe wrapperScript
            else "${openspatial}/bin/openspatial";
        };
      };

      networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];

      # Make openspatial-cli available for SSH management
      environment.systemPackages = [ openspatial ];
    }

    # Coturn service when turn.enable is true
    (lib.mkIf cfg.turn.enable {
      # Create log directory for coturn
      systemd.tmpfiles.rules = [
        "d /var/log/coturn 0755 turnserver turnserver -"
      ];

      services.coturn = {
        enable = true;
        realm = cfg.domain;
        listening-port = cfg.turn.port;
        min-port = cfg.turn.minPort;
        max-port = cfg.turn.maxPort;
        use-auth-secret = true;
        static-auth-secret-file = cfg.turn.secretFile;
        no-cli = true;
        no-tls = true;  # Nginx handles TLS termination
        no-dtls = true;
        extraConfig = ''
          fingerprint
          lt-cred-mech
          relay-ip=${cfg.turn.externalIP}
          external-ip=${cfg.turn.externalIP}
          verbose
          syslog
        '';
      };

      # Auto-open firewall for TURN
      networking.firewall = {
        allowedTCPPorts = [ cfg.turn.port ];
        allowedUDPPorts = [ cfg.turn.port ];
        allowedUDPPortRanges = [{
          from = cfg.turn.minPort;
          to = cfg.turn.maxPort;
        }];
      };
    })
  ]);
}
