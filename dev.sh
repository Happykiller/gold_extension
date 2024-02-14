#!/bin/bash
SECONDS=0
rootDir=$(pwd -P)

exec 2>&1

# import common
source "$rootDir/common.sh"

function setup() {
  cd $rootDir
  header_c "setup"
  rm -rf build/
  mkdir build/
  mkdir build/popup/
  mkdir build/content/
  mkdir build/background/
}

separator_c
start_c

init
setup
copy_popup
copy_content
copy_background
copy_public
package
buildInfo

statistic_c $SECONDS
end_c