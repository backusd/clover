@echo off

pushd ..
Vendor\bin\Premake\Windows\premake5.exe --file=Build.lua vs2022
popd
pause