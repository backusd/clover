#!/usr/bin/sh

function print_help()
{
    echo "Usage: build-front.sh (--all|{DIR}) [debug|release|clean]"
}

TARGET=""
MODE="debug"
ROOT_DIR="front-end"

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


if [[ "${TARGET}" == "--all" ]]; then
    
    for DIR in $(find ${ROOT_DIR} -mindepth 1 -maxdepth 1 -type d); do
        if [[ -f "${DIR}/build.sh" ]]; then
            echo "Running ${DIR}/build.sh ${MODE}"
            cd ${DIR}
            ./build.sh ${MODE}
            cd ../..
        else
            echo "Skipping ${DIR} - does not contain build.sh script"
        fi
    done

else
    if [[ ! -f "${ROOT_DIR}/${TARGET}/build.sh" ]]; then
        echo "ERROR: No build script for TARGET '${TARGET}': '${ROOT_DIR}/${TARGET}/build.sh'"
        exit 1
    fi

    cd ${ROOT_DIR}/${TARGET}
    ./build.sh ${MODE}
    exit $?
fi