#!/bin/bash

set -e
set +x

./wrapper -i "/usr/games/supertuxkart --server-config=$(pwd)/server_config.xml" -player-tracking="$ENABLE_PLAYER_TRACKING"