#!/usr/bin/sh

function print_help()
{
    echo "Usage: build.sh (debug|release|clean)"
}

function clean()
{
    # For all files with a .ts extension, remove all files with a matching name but .js extension
    for file in $(find * -maxdepth 0 -name '*.ts' -print); do
        short="${file%.*}"
        if [[ -f "${short}.js" ]]; then
            rm ${short}.js
        fi
        if [[ -f "${short}.js.map" ]]; then
            rm ${short}.js.map
        fi
    done
}

if [[ $# -ne 1 ]]; then
    echo "Invalid number of arguments"
    print_help
    exit 1
fi

tsconfig=""
outDir=""
mode=""

if [[ "${1}" == "debug" ]]; then
    tsconfig="tsconfig.json"    # NOTE: We do NOT call this file 'tsconfig.debug.json' because Intellisense needs a 'tsconfig.json' file for proper syntax highlighting
    outDir=""
    mode="debug"
elif [[ "${1}" == "release" ]]; then
    tsconfig="tsconfig.release.json"
    outDir=""
    mode="release"
elif [[ "${1}" == "clean" ]]; then
    clean
    exit 0
else
    echo "Invalid parameter: '${1}'"
    print_help
    exit 1
fi

clean

tsc --project ${tsconfig}