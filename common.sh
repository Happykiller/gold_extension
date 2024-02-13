#!/bin/bash
exec 2>&1

fileName="sentinel_$(date '+%Y-%m-%d_%H-%M-%S')"

# print
function print_c() {
  message=$1
  echo "[[$(date +%Y-%m-%dT%H:%M:%S)]][[$message]]"
}

# statistic
function statistic_c() {
  header_c "statistic"
  duration=$1
  print "$(($duration / 60)) minutes and $(($duration % 60)) seconds elapsed."
}

function separator_c() {
  print "=================================================="
}

function start_c() {
  header_c "start"
}

function end_c() {
  header_c "end"
}

function header_c() {
  header=$1
  long=${#header}
  if [ $((long%2)) -eq 1 ]
  then
    header="$header "
  fi
  trim=`expr 44 - $long`
  trim=`expr $trim / 2`
  line=$(printf "%*s%s" $trim '' "$header")
  end="$(printf '%*s' $trim)"
  print "==>$line$end<=="
}

# print
function print() {
  print_c "$1"
}

# print_cmd
function print_cmd() {
  if [ -n "$1" ]
  then
    IN="$1"
  else
    read IN # This reads a string from stdin and stores it in a variable called IN
  fi

  while IFS= read -r line
  do
    print "$line"
  done <<< "$IN"
}

function init() {
  header_c "init"

  for f in $rootDir/.env*; do source $f; done

  echo POPUP_BRANCH:${POPUP_BRANCH}
  echo POPUP_CONF:${POPUP_CONF}
}

function copy_popup() {
  cd $rootDir
  header_c "copy_popup"
  cp -a "$rootDir/temp/gold_extension_popup/dist/." "$rootDir/build/popup/"
  sed -i 's#="/#="./#g' "$rootDir/build/popup/index.html"
}

function copy_public() {
  cd $rootDir
  header_c "copy_public"
  cp -a "$rootDir/public/." "$rootDir/build/"
}

function generate_popup() {
  cd $rootDir/temp/
  header_c "generate_popup"
  print_cmd "$(git clone --single-branch --branch $POPUP_BRANCH git@github.com:Happykiller/gold_extension_popup.git 2>&1)"
  FILE="$rootDir/config/popup/$POPUP_CONF"
  if [[ ! -f "$FILE" ]]; then
    echo "No Such File config popup => $POPUP_CONF" && exit
  fi
  cp -R "$rootDir/config/popup/$POPUP_CONF" "$rootDir/temp/gold_extension_popup/$POPUP_CONF"
  cd ./gold_extension_popup
  npm install --force
  npm run build
}

function package() {
  header_c "package"
  cd $rootDir/build/
  #tar -zcvf archives/$fileName.tar.gz build --transform s/build/sentinel/
  zip -r $rootDir/archives/$fileName.zip medias/* popup/* manifest.json
}

function buildInfo() {
  header_c "buildInfo"
  cd $rootDir

  popup_conf_default=`cat temp/gold_extension_popup/.env`
  popup_conf=`cat config/popup/.env.local`
  popup_verion=`sed 's/.*"version": "\(.*\)".*/\1/;t;d' temp/gold_extension_popup/package.json`

  cat >> archives/$fileName.md <<EOF 

# POPUP 

## Branch
* \`$POPUP_BRANCH\`

## Version
* \`$popup_verion\`

## Default config: 
\`\`\`
$popup_conf_default
\`\`\`

## Sentinel config: 
\`\`\`
$popup_conf
\`\`\`

EOF
}