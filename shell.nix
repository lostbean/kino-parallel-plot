{ pkgs ? import (fetchTarball
  "https://github.com/NixOS/nixpkgs/archive/refs/tags/23.11.tar.gz") { } }:
with pkgs;

let
  frameworks = darwin.apple_sdk.frameworks;
  inherit (lib) optional optionals;
in mkShell {
  nativeBuildInputs = [
    buildPackages.elixir
    buildPackages.elixir_ls
    buildPackages.nodejs
    buildPackages.erlang
    buildPackages.rebar3
  ] ++ optionals stdenv.isDarwin [
    # add macOS headers to build mac_listener and ELXA
    frameworks.CoreServices
    frameworks.CoreFoundation
    frameworks.Foundation
  ];
}
