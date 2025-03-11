#!/usr/bin/sh

function print_help()
{
    echo "Usage: remove-debug-only.sh (input-file) (output-file)"
}

if [[ $# -ne 2 ]]; then
    print_help
    exit 1
fi

input="${1}"
output="${2}"

if [[ "${input}" == "" ]]; then
    echo "Input file cannot be empty"
    print_help
    exit 1
fi

if [[ "${output}" == "" ]]; then
    echo "Output file cannot be empty"
    print_help
    exit 1
fi

if [[ "${input}" == "${output}" ]]; then
    echo "Input file and output file cannot be the same file"
    print_help
    exit 1
fi

if [ -f ${output} ]; then
    echo "Output file must not already exist - we do not allow you to overwrite an existing file"
    print_help
    exit 1
fi

ignoring="false"

while IFS= read -r line || [ -n "${line}" ]
do
    if [[ "${ignoring}" == "false" ]]; then
        if [[ "${line}" == *"START_DEBUG_ONLY"* ]]; then
            echo "STARTING DEBUG: ${line}"
            ignoring="true"
        else
            echo "${line}" >> ${output}
        fi
    else
        if [[ "${line}" == *"END_DEBUG_ONLY"* ]]; then
            echo "STOPPING DEBUG: ${line}"
            ignoring="false"
        else
            echo "IGNORED: ${line}"
        fi
    fi

done < "${input}"

if [[ "${ignoring}" == "true" ]]; then 
    echo "ERROR: Found end of file while still ignoring debug section for file: ${input}. Did you forget to add END_DEBUG_ONLY?"
    exit 1
fi

exit 0