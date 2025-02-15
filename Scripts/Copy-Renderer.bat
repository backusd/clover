@echo off

SET PATH=%PATH%;c:\Windows\System32

pushd ..
xcopy Renderer\Renderer\renderer.js Sandbox\Source\front-end\ /f
xcopy Renderer\Renderer\renderer.js.map Sandbox\Source\front-end\ /f
popd
pause