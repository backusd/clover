@echo off

SET PATH=%PATH%;c:\Windows\System32

pushd ..
xcopy Renderer\Renderer\*.js Sandbox\Source\front-end\ /f /Y
xcopy Renderer\Renderer\*.js.map Sandbox\Source\front-end\ /f /Y
popd
pause