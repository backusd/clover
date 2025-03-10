#!/usr/bin/sh

function print_help()
{
    echo "Usage: build.sh [debug|release|help]"
}

if [[ $# -ne 1 ]]; then
    print_help
    exit 1
fi

if [[ "${1}" == "help" ]]; then
    print_help
    exit 0;
fi

tsconfig=""
outDir=""
mode=""

if [[ "${1}" == "debug" ]]; then
    tsconfig="tsconfig.debug.json"
    outDir="out/debug"
    mode="debug"
elif [[ "${1}" == "release" ]]; then
    tsconfig="tsconfig.release.json"
    outDir="out/release"
    mode="release"
else
    echo "Invalid parameter: ${1}"
    print_help
    exit 1
fi

echo "Removing all files in ${outDir}/"
rm -rf ${outDir}/*

echo "Output directory: ${outDir}"
echo "Running: tsc --project ${tsconfig}"
tsc --project ${tsconfig}

if [[ $? -ne 0 ]]; then
    exit $?
fi

echo "Removing all files in ../Sandbox/Source/front-end/renderer/${mode}/"
rm -rf ../Sandbox/Source/front-end/renderer/${mode}/*

if [[ "${mode}" == "debug" ]]; then
    echo "Removing all ts files in ../Sandbox/Source/front-end/renderer/"
    rm ../Sandbox/Source/front-end/renderer/*.ts
fi

echo "Copying all output files to ../Sandbox/Source/front-end/renderer/${mode}/"
cp ${outDir}/* ../Sandbox/Source/front-end/renderer/${mode}/

if [[ "${mode}" == "debug" ]]; then
    echo "Copying all ts files to ../Sandbox/Source/front-end/renderer/"
    cp *.ts ../Sandbox/Source/front-end/renderer/
fi