#!/bin/zsh
# Rebuild landmark models end to end (Blender build, export, pack): model/scripts/rebuild_landmarks.sh [slug ...]
# With no slugs, every landmark in model/landmarks.json. Stops at the first failure.
set -e -o pipefail
cd "$(dirname "$0")/../.."
B=/Applications/Blender.app/Contents/MacOS/Blender
slugs=("$@")
(( ${#slugs} )) || slugs=($(python3 -c "import json; print(' '.join(json.load(open('model/landmarks.json'))))"))
for slug in $slugs; do
  script=model/blender/landmarks/${slug//-/_}.py
  [[ -f $script ]] || script=model/blender/landmarks/district.py    # district models (district_osm.py) share one script
  $B -b model/data/blend/baguio.blend --python $script -- $slug > model/data/out/lm-build.log 2>&1 || { tail -30 model/data/out/lm-build.log; echo "BUILD FAILED $slug"; exit 1; }
  grep -q "Traceback" model/data/out/lm-build.log && { grep -A20 Traceback model/data/out/lm-build.log | head -30; echo "BUILD FAILED $slug"; exit 1; }
  grep -E "^REPORT|^DISTRICT" model/data/out/lm-build.log | tr "\n" " "; echo
  $B -b model/data/blend/baguio.blend --python model/blender/export_landmark.py -- $slug 2>&1 | grep -E "^EXPORT|Error" | cut -c1-160
  uv run model/scripts/pack_landmark.py $slug 2>&1 | grep -E "^PACK|Assertion|Error"
done
