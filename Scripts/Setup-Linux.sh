#!/bin/bash

pushd ..
Vendor/bin/Premake/Linux/premake5 --cc=clang --file=Build.lua gmake2
popd