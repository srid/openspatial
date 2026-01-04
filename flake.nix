{
  description = "OpenSpatial - Spatial Video Chat";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];

      perSystem = { pkgs, system, ... }: {
        packages = rec {
          default = openspatial;
          openspatial = pkgs.callPackage ./nix/package.nix { };
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
      };
    };
}
