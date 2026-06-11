{
  description = "Changes";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      lib = nixpkgs.lib;
      pkgs = nixpkgs.legacyPackages.${system};

      # App source (cleaned: VCS dropped; the local node_modules is removed in
      # the installPhase so the build assembles a fresh one).
      src = lib.cleanSource ./.;

      # adwaita-gpuix is a source-only repo (there is no npm tarball for it):
      # fetch the source tree and copy it into node_modules as-is.
      adwaitaSrc = pkgs.fetchFromGitHub {
        owner = "knoopx";
        repo = "adwaita-gpuix";
        rev = "c047de78c8cd2cf5261eb9cbafdb68de578d5162";
        hash = "sha256-omuX4BE9r+YcfI8PvuRdM+JctDnoDbfG14moeb/ignk=";
      };

      # Every npm (registry) dependency — direct and transitive (react-reconciler
      # / scheduler / zod / eventsource-parser / lucide-static are pulled in by
      # @gpuix/react, @gpuix/native and adwaita-gpuix) — prefetched as a
      # content-addressed tarball (substitutable FOD); the app build untars
      # them offline.
      npmDeps = {
        react = pkgs.fetchurl {
          url = "https://registry.npmjs.org/react/-/react-19.3.1.tgz";
          hash = "sha256-VpNpE5GNzx96b+WHhOed9UsYIAqIZVzoCc9enE74cao=";
        };
        gpuixNative = pkgs.fetchurl {
          url = "https://registry.npmjs.org/@gpuix/native/-/native-0.10.0.tgz";
          hash = "sha256-BPnE4AHcOKJYhqIdcp7q+KSAJ2BNz3LOFFEixkZxRqc=";
        };
        gpuixReact = pkgs.fetchurl {
          url = "https://registry.npmjs.org/@gpuix/react/-/react-0.10.0.tgz";
          hash = "sha256-qbcLb4DriWlWVHez7uT5whJdJCdDl+3nWdqiVMVVC8I=";
        };
        gpuixNativeLinux = pkgs.fetchurl {
          url = "https://registry.npmjs.org/@gpuix/native-linux-x64-gnu/-/native-linux-x64-gnu-0.10.0.tgz";
          hash = "sha256-ilVYHnqCHyeqcvLJITIQIP1KjF4OFvqtZ7jBZdbj74k=";
        };
        lucideStatic = pkgs.fetchurl {
          url = "https://registry.npmjs.org/lucide-static/-/lucide-static-1.57.0.tgz";
          hash = "sha256-r8hgLFIxzmTuInKG+Tdy0EOO3dO5R7ZFvBS/0eSdpRg=";
        };
        reactReconciler = pkgs.fetchurl {
          url = "https://registry.npmjs.org/react-reconciler/-/react-reconciler-0.31.0.tgz";
          hash = "sha256-n0GsUyE/9s+ri+YM6iUTVyiToVsOl2xj9CVxqXtJQyM=";
        };
        scheduler = pkgs.fetchurl {
          url = "https://registry.npmjs.org/scheduler/-/scheduler-0.25.0.tgz";
          hash = "sha256-iqwtpt7LCcHaz4wQb2LS+0RU+7H98vb+bU7xpXt8aRQ=";
        };
        zod = pkgs.fetchurl {
          url = "https://registry.npmjs.org/zod/-/zod-4.6.7.tgz";
          hash = "sha256-hO/RVb7ZMnAobnk/yVG+JwtTbL1bDusRHw+jlnIB1pg=";
        };
        eventsourceParser = pkgs.fetchurl {
          url = "https://registry.npmjs.org/eventsource-parser/-/eventsource-parser-4.1.2.tgz";
          hash = "sha256-2ILcUCLgrDmEpvt0fZiTpzFnWgp9neAd424KrQJgyGw=";
        };
      };
    in
    {
      packages.${system}.default =
        pkgs.stdenvNoCC.mkDerivation {
          pname = "changes";
          version = "0.1.0";

          inherit src;

          nativeBuildInputs = [ pkgs.bun pkgs.makeBinaryWrapper ];

          # Runtime shared-library deps of the embedded @gpuix/native .node.
          propagatedBuildInputs = [
            pkgs.libxkbcommon
            pkgs.wayland
            pkgs.mesa
            pkgs.vulkan-loader
          ];

          dontBuild = true;

          installPhase = ''
            mkdir -p $out/bin $out/lib

            # Drop the source's local node_modules; assemble a fresh one.
            rm -rf node_modules
            mkdir -p node_modules

            # adwaita-gpuix: source-only, copied in as-is.
            cp -r ${adwaitaSrc} node_modules/adwaita-gpuix

            # npm deps (direct + transitive): untar the prefetched tarballs.
            mkdir -p node_modules/react && tar xzf ${npmDeps.react} -C node_modules/react --strip-components=1
            mkdir -p node_modules/@gpuix/native && tar xzf ${npmDeps.gpuixNative} -C node_modules/@gpuix/native --strip-components=1
            mkdir -p node_modules/@gpuix/react && tar xzf ${npmDeps.gpuixReact} -C node_modules/@gpuix/react --strip-components=1
            mkdir -p node_modules/@gpuix/native-linux-x64-gnu && tar xzf ${npmDeps.gpuixNativeLinux} -C node_modules/@gpuix/native-linux-x64-gnu --strip-components=1
            mkdir -p node_modules/lucide-static && tar xzf ${npmDeps.lucideStatic} -C node_modules/lucide-static --strip-components=1
            mkdir -p node_modules/react-reconciler && tar xzf ${npmDeps.reactReconciler} -C node_modules/react-reconciler --strip-components=1
            mkdir -p node_modules/scheduler && tar xzf ${npmDeps.scheduler} -C node_modules/scheduler --strip-components=1
            mkdir -p node_modules/zod && tar xzf ${npmDeps.zod} -C node_modules/zod --strip-components=1
            mkdir -p node_modules/eventsource-parser && tar xzf ${npmDeps.eventsourceParser} -C node_modules/eventsource-parser --strip-components=1

            bun build --compile src/main.tsx --outfile $out/lib/changes

            # A bun --compile binary cannot resolve the NAPI-RS platform
            # package from disk, so ship the .node beside the binary and point
            # the loader at it.
            mkdir -p $out/lib/changes-native
            cp node_modules/@gpuix/native-linux-x64-gnu/gpuix-native.linux-x64-gnu.node \
              $out/lib/changes-native/

            # bun --compile emits a raw ELF; wrap it with the runtime library
            # path (libxkbcommon + the dlopened wayland/EGL/Vulkan libraries)
            # and the native binding path.
            makeWrapper $out/lib/changes $out/bin/changes \
              --set LD_LIBRARY_PATH "${pkgs.lib.makeLibraryPath [ pkgs.libxkbcommon pkgs.wayland pkgs.mesa pkgs.vulkan-loader ]}" \
              --set NAPI_RS_NATIVE_LIBRARY_PATH "$out/lib/changes-native/gpuix-native.linux-x64-gnu.node"
          '';
        };

      apps.${system}.default = {
        type = "app";
        program = "${self.packages.${system}.default}/bin/changes";
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.bun ];
      };
    };
}
