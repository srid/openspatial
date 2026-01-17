{
  description = "OpenSpatial - Spatial Video Chat";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    disko = {
      url = "github:nix-community/disko";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixos-anywhere = {
      url = "github:nix-community/nixos-anywhere";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs@{ flake-parts, nixpkgs, disko, nixos-anywhere, self, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];

      perSystem = { pkgs, system, lib, ... }: let
        nixosAnywhereExe = lib.getExe' nixos-anywhere.packages.${system}.default "nixos-anywhere";
      in {
        packages = rec {
          default = openspatial;
          openspatial = pkgs.callPackage ./nix/package.nix { };
          
          deploy = pkgs.writeShellApplication {
            name = "deploy-openspatial";
            text = ''
              if [ $# -lt 1 ]; then
                echo "Usage: nix run .#deploy -- <user@host>"
                echo "Example: nix run .#deploy -- root@203.0.113.1"
                exit 1
              fi
              
              TARGET_HOST="$1"
              
              echo "🚀 Deploying OpenSpatial to $TARGET_HOST..."
              echo ""
              echo "This will:"
              echo "  1. Partition and format the disk (ALL DATA WILL BE LOST)"
              echo "  2. Install NixOS with OpenSpatial configuration"
              echo ""
              
              ${nixosAnywhereExe} \
                --flake "${self}#openspatial-server" \
                --target-host "$TARGET_HOST" \
                --build-on-remote
              
              echo ""
              echo "✅ Deployment complete!"
              echo ""
              echo "Next steps:"
              echo "  1. Point DNS for spatial.srid.ca to the server IP"
              echo "  2. SSH to server: ssh $TARGET_HOST"
              echo "  3. Create TURN secret: openssl rand -hex 32 > /etc/openspatial/turn-secret"
              echo "  4. Restart service: systemctl restart openspatial"
            '';
          };
          
          redeploy = pkgs.writeShellApplication {
            name = "redeploy-openspatial";
            runtimeInputs = [ pkgs.nixos-rebuild ];
            text = ''
              if [ $# -lt 1 ]; then
                echo "Usage: nix run .#redeploy -- <user@host>"
                echo "Example: nix run .#redeploy -- root@46.62.227.127"
                exit 1
              fi
              
              TARGET_HOST="$1"
              
              echo "🔄 Updating OpenSpatial on $TARGET_HOST..."
              
              nixos-rebuild switch \
                --flake "${self}#openspatial-server" \
                --target-host "$TARGET_HOST" \
                --build-host "$TARGET_HOST"
              
              echo ""
              echo "✅ Update complete!"
            '';
          };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            just
          ];

          shellHook = ''
            echo "🚀 OpenSpatial - run 'just dev' to start"
          '';
        };
      };

      flake = {
        nixosModules.default = import ./nix/module.nix;
        
        # NixOS configuration for Hetzner deployment
        nixosConfigurations.openspatial-server = nixpkgs.lib.nixosSystem {
          system = "x86_64-linux";
          modules = [
            disko.nixosModules.disko
            self.nixosModules.default
            ./deploy/nixos/hardware-configuration.nix
            ./deploy/nixos/disko-config.nix
            ./deploy/nixos/configuration.nix
          ];
        };
      };
    };
}
