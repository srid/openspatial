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
      default = false;
      description = "Enable HTTPS with self-signed certificate (for testing without reverse proxy)";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Open firewall port";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.openspatial = {
      description = "OpenSpatial Spatial Video Chat";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment = {
        PORT = toString cfg.port;
        HTTPS = if cfg.https then "1" else "0";
      };

      serviceConfig = {
        Type = "simple";
        ExecStart = "${openspatial}/bin/openspatial";
        Restart = "on-failure";
        DynamicUser = true;
      };
    };

    networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];
  };
}
