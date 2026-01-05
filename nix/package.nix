{ lib
, stdenv
, buildNpmPackage
, nodejs_22
}:

buildNpmPackage {
  pname = "openspatial";
  version = "1.0.0";

  src = ./..;

  npmDepsHash = "sha256-ffYZp5/tJ+FD/TNIxcRDz5CufVcf/D3HJCv75pUO89M=";

  nodejs = nodejs_22;

  buildPhase = ''
    npm run build
  '';

  installPhase = ''
    mkdir -p $out/{bin,lib/openspatial}
    cp -r dist $out/lib/openspatial/
    cp -r server $out/lib/openspatial/
    cp -r lib $out/lib/openspatial/
    cp -r node_modules $out/lib/openspatial/
    cp package.json $out/lib/openspatial/

    cat > $out/bin/openspatial <<EOF
#!/usr/bin/env bash
cd $out/lib/openspatial
exec ${nodejs_22}/bin/npx tsx $out/lib/openspatial/server/standalone.ts "\$@"
EOF
    chmod +x $out/bin/openspatial
  '';

  meta = with lib; {
    description = "OpenSpatial - Spatial Video Chat";
    license = licenses.mit;
    mainProgram = "openspatial";
  };
}
