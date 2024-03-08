#!/bin/bash
exec 2>&1

fileName="gold_$(date '+%Y-%m-%d_%H-%M-%S')"

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
  echo BACKGROUND_CONF:${BACKGROUND_CONF}
  echo BACKGROUND_BRANCH:${BACKGROUND_BRANCH}
  echo CONTENT_BRANCH:${CONTENT_BRANCH}
  echo CONTENT_CONF:${CONTENT_CONF}
}

function copy_popup() {
  cd $rootDir
  header_c "copy_popup"
  cp -a "$rootDir/temp/gold_extension_popup/dist/." "$rootDir/build/popup/"
  sed -i 's#="/#="./#g' "$rootDir/build/popup/index.html"
}

function copy_background() {
  cd $rootDir
  header_c "copy_background"
  cp "$rootDir/temp/gold_extension_background/build/background.js" "$rootDir/build/background/"
}

function copy_content() {
  cd $rootDir
  header_c "copy_content"
  cp $(find $rootDir/temp/gold_extension_content/build/static/js -name 'main.*.js') "$rootDir/build/content/content.js"
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

function generate_background() {
  cd $rootDir/temp/
  header_c "generate_background"
  print_cmd "$(git clone --single-branch --branch $BACKGROUND_BRANCH git@github.com:Happykiller/gold_extension_background.git 2>&1)"
  if [[ ! -f "$FILE" ]]; then
    echo "No Such File config background => $BACKGROUND_CONF" && exit
  fi
  cp -R "$rootDir/config/background/$BACKGROUND_CONF" "$rootDir/temp/gold_extension_background/src/config/$BACKGROUND_CONF"
  cd ./gold_extension_background
  npm install
  npm run build
}

function generate_content() {
  cd $rootDir/temp/
  header_c "generate_content"
  print_cmd "$(git clone --single-branch --branch $CONTENT_BRANCH git@github.com:Happykiller/gold_extension_content.git 2>&1)"
  if [[ ! -f "$FILE" ]]; then
    echo "No Such File config content => $CONTENT_CONF" && exit
  fi
  cp -R "$rootDir/config/content/$CONTENT_CONF" "$rootDir/temp/gold_extension_content/$CONTENT_CONF"
  cd ./gold_extension_content
  npm install
  npm run build
}

function package() {
  header_c "package"
  cd $rootDir/build/
  zip -r $rootDir/archives/$fileName.zip content/* medias/* background/* popup/* manifest.json
}

function buildInfo() {
  header_c "buildInfo"
  cd $rootDir

  bg_conf_default=`cat temp/gold_extension_background/src/config/defaults.ts`
  bg_conf=`cat config/background/$BACKGROUND_CONF`
  bg_verion=`sed 's/.*"version": "\(.*\)".*/\1/;t;d' temp/gold_extension_background/package.json`

  popup_conf_default=`cat temp/gold_extension_popup/.env`
  popup_conf=`cat config/popup/.env.local`
  popup_verion=`sed 's/.*"version": "\(.*\)".*/\1/;t;d' temp/gold_extension_popup/package.json`

  content_conf_default=`cat temp/gold_extension_content/.env`
  content_conf=`cat config/content/.env.local`
  content_verion=`sed 's/.*"version": "\(.*\)".*/\1/;t;d' temp/gold_extension_content/package.json`

  cat >> archives/$fileName.md <<EOF 

# BACKGROUND

## Branch
* \`$BACKGROUND_BRANCH\`

## Version
* \`$bg_verion\`

## Default config: 
\`\`\`
$bg_conf_default
\`\`\`

## Main config: 
\`\`\`
$bg_conf
\`\`\`

# POPUP 

## Branch
* \`$POPUP_BRANCH\`

## Version
* \`$popup_verion\`

## Default config: 
\`\`\`
$popup_conf_default
\`\`\`

## Main config: 
\`\`\`
$popup_conf
\`\`\`

# CONTENT 

## Branch
* \`$CONTENT_BRANCH\`

## Version
* \`$content_verion\`

## Default config: 
\`\`\`
$content_conf_default
\`\`\`

## Main config: 
\`\`\`
$content_conf
\`\`\`

EOF
}