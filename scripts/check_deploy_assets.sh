#!/usr/bin/env bash
set -euo pipefail

index=dist/index.html
[[ -s "$index" ]]

assets=()
while IFS= read -r asset; do
  assets[${#assets[@]}]="$asset"
done < <(
  grep -oE '(src|href)="\./assets/[^"]+"' "$index" |
    sed -E 's/^(src|href)="\.\///; s/"$//'
)

((${#assets[@]} >= 2))

for asset in "${assets[@]}"; do
  [[ "$asset" =~ ^assets/[A-Za-z0-9._-]+$ ]]
  [[ -s "dist/$asset" ]]
  [[ "https://catechism.kylelynch.us/$asset" == https://catechism.kylelynch.us/assets/* ]]
done

first_asset="$({
  grep -oE '(src|href)="\./assets/[^"]+"' "$index" || true
} | sed -E -n '1{s/^(src|href)="\.\///; s/"$//; p;}')"

[[ "$first_asset" =~ ^assets/[A-Za-z0-9._-]+$ ]]
[[ -s "dist/$first_asset" ]]

printf 'Validated %s deploy asset references; first curl path is /%s\n' "${#assets[@]}" "$first_asset"
