#!/usr/bin/sh

function print_help()
{
    echo "Usage: build.sh (debug|release|help)"
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
    tsconfig="tsconfig.json"    # NOTE: We do NOT call this file 'tsconfig.debug.json' because Intellisense needs a 'tsconfig.json' file to know the webgpu types
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

# If we are running in release mode, then create a tmp directory where
# we process each file and remove DEBUG only sections
if [[ "${mode}" == "release" ]]; then

    if [ -d tmp ]; then
        echo "Cleaning out the tmp directory"
        rm -rf tmp/*
    else
        echo "Creating tmp directory"
        mkdir tmp
    fi
    
    echo "Removing DEBUG only sections from files"
    for file in $(find . -maxdepth 1 -type f -name '*.ts' -printf '%f\n'); do
        echo "Processing file: ${file}"
        ./remove-debug-only.sh ${file} tmp/${file}
        if [ $? -ne 0 ]; then   
            echo "ERROR: Removing debug sections failed for file: ${file}"
            exit 1
        fi
    done

    cp ${tsconfig} tmp/
    cd tmp

    echo "Running in tmp directory: tsc --project ${tsconfig}"
    tsc --project ${tsconfig}

    mv ${outDir}/* ../${outDir}/
    cd ..
    rm -rf tmp

else
    echo "Running: tsc --project ${tsconfig}"
    tsc --project ${tsconfig}

    if [[ $? -ne 0 ]]; then
        exit $?
    fi
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