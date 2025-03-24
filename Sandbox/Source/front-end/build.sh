#!/usr/bin/sh

function print_help()
{
    echo "Usage: build.sh (--all|{DIR}) [debug|release|clean]"
}

TARGET=""
MODE="debug"    # default mode is 'debug'
TSCONFIG=""
OUT_DIR="$(pwd)/../../front-end"
ROOT_DIR="$(pwd)"

if [[ $# -eq 1 ]]; then

    TARGET="${1}"

    if [[ "${TARGET}" != "--all" ]]; then
        if [[ ! -d "${ROOT_DIR}/${TARGET}" ]]; then
            echo "Invalid TARGET '${TARGET}': Could not find directory '${ROOT_DIR}/${TARGET}'"
            print_help
            exit 1
        fi
    fi
elif [[ $# -eq 2 ]]; then

    TARGET="${1}"
    MODE="${2}"

    if [[ "${TARGET}" != "--all" ]]; then
        if [[ ! -d "${ROOT_DIR}/${TARGET}" ]]; then
            echo "Invalid TARGET '${TARGET}': Could not find directory '${ROOT_DIR}/${TARGET}'"
            print_help
            exit 1
        fi
    fi

    if [[ "${MODE}" != "debug" && "${MODE}" != "release" && "${MODE}" != "clean" ]]; then
        echo "Invalid MODE '${MODE}' - must either be 'debug', 'release', or 'clean'"
        print_help
        exit 1
    fi
else
    echo "Invalid number of parameters"
    print_help
    exit 1
fi

function clean()
{
    local target=$1

    if [[ ! -d ${OUT_DIR}/${target} ]]; then
        echo "Could not clean directory '${OUT_DIR}/${target}'. Directory does not exist"
        exit 1
    fi

    # remove all .ts/.js/.js.map files currently in the output directory
    find ${OUT_DIR}/${target} -name "*.ts" -type f -delete
    find ${OUT_DIR}/${target} -name "*.js" -type f -delete
    find ${OUT_DIR}/${target} -name "*.js.map" -type f -delete

    # We assume that the contents of common/ will always be copied over
    # so we delete them here as well
    find ${OUT_DIR}/common -name "*.ts" -type f -delete
    find ${OUT_DIR}/common -name "*.js" -type f -delete
    find ${OUT_DIR}/common -name "*.js.map" -type f -delete
}

if [[ ! -d ${OUT_DIR} ]]; then
    mkdir ${OUT_DIR}
fi

if [[ "${TARGET}" == "--all" ]]; then
    TARGET="."
fi

if [[ "${MODE}" == "debug" ]]; then
    TSCONFIG="tsconfig.json"
elif [[ "${MODE}" == "release" ]]; then
    TSCONFIG="tsconfig.release.json"
elif [[ "${MODE}" == "clean" ]]; then
    clean ${TARGET}
    exit $?
fi

function build_target()
{
    # If the directory has a tsconfig.json (or tsconfig.release.json), run tsc
    # Then recursively traverse all directories and do the same
    local target=$1
    local original_dir="$(pwd)"

    cd ${target}
    
    if [[ -f ${TSCONFIG} ]]; then
        echo "[$(pwd)] tsc --project ${TSCONFIG}"
        tsc --project ${TSCONFIG}
    fi

    for dir in $(find * -maxdepth 0 -type d); do
        if [[ "${dir}" == "node_modules" ]]; then
            continue
        fi
        build_target ${dir}
    done

    cd ${original_dir}
}

clean ${TARGET}
build_target "${TARGET}"

# In debug mode, .js.map files are produced that link back to a .ts file.
# Therefore, for debug purposes, we need to manually copy over all .ts files
# to the output directory
if [[ "${MODE}" == "debug" ]]; then

    # Switch the target to '*'. It gives better output when running 'find' so that
    # each line doesn't begin with './'
    if [[ "${TARGET}" == "." ]]; then
        TARGET="*"
    else
        # We need to make sure that if any .ts files in common/ were updated, then
        # they need to be copied to the output directory. However, when the target is
        # '--all', this is done automatically in the for-loop below. So doing this
        # manually copy step is only necessary when the target is NOT '--all'.
        # IMPROVEMENT: You could use a marker file to track timestamps and only copy
        #              common/ files when they've changed, but given that there are very
        #              few common/ files right now, it wouldn't get us much
        for file in $(find common -name "*.ts" | grep -v node_modules); do
            dir="$(dirname ${file})"
            mkdir -p ${OUT_DIR}/${dir}
            echo "cp ${file} ${OUT_DIR}/${dir}/"
            cp ${file} ${OUT_DIR}/${dir}/
        done
    fi

    for file in $(find ${TARGET} -name "*.ts" | grep -v node_modules); do
        dir="$(dirname ${file})"
        mkdir -p ${OUT_DIR}/${dir}
        echo "cp ${file} ${OUT_DIR}/${dir}/"
        cp ${file} ${OUT_DIR}/${dir}/
    done
fi