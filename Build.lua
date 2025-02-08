-- premake5.lua
workspace "clover"
   architecture "x64"
   configurations { "Debug", "Release" }
   startproject "Sandbox"

   -- Workspace-wide build options for MSVC
   filter "system:windows"
      buildoptions { "/EHsc", "/Zc:preprocessor", "/Zc:__cplusplus", "/Ot", "/bigobj" }
      flags { "MultiProcessorCompile" }

   -- Workspace-wide build options for Linux
   filter "system:linux"
      buildoptions { "-pthread" }



OutputDir = "%{cfg.system}-%{cfg.architecture}/%{cfg.buildcfg}"


include "Clover/Build-Clover.lua"
include "Sandbox/Build-Sandbox.lua"