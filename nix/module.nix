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

    turn = {
      enable = lib.mkEnableOption "bundled coturn TURN server for NAT traversal";

      domain = lib.mkOption {
        type = lib.types.str;
        description = "Public domain/hostname for TURN server (clients connect to this)";
      };

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
          TURN_HOST = cfg.turn.domain;
          TURN_PORT = toString cfg.turn.port;
        };

        serviceConfig = {
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
              ${lib.concatMapStringsSep "\n" (space: "${openspatial}/bin/openspatial-cli create ${space}") cfg.spaces}
            '';
          }));
        } // (if cfg.turn.enable then {
          # Wrapper script that loads TURN_SECRET from file before starting
          ExecStart = lib.getExe (pkgs.writeShellApplication {
            name = "openspatial-start";
            text = ''
              TURN_SECRET="$(cat ${cfg.turn.secretFile})"
              export TURN_SECRET
              exec ${openspatial}/bin/openspatial
            '';
          });
        } else {
          ExecStart = "${openspatial}/bin/openspatial";
        });
      };

      networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];

      # Make openspatial-cli available for SSH management
      environment.systemPackages = [ openspatial ];
    }

    # Coturn service when turn.enable is true
    (lib.mkIf cfg.turn.enable {
      services.coturn = {
        enable = true;
        realm = cfg.turn.domain;
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
