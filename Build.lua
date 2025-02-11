-- premake5.lua
workspace "clover"
   architecture "x64"
   configurations { "Debug", "Release" }
   startproject "Sandbox"

   -- Workspace-wide options for MSVC
   filter "system:windows"
      systemversion "latest"
      buildoptions { "/EHsc", "/Zc:preprocessor", "/Zc:__cplusplus", "/Ot", "/bigobj" }
      flags { "MultiProcessorCompile" }
      defines { "PLATFORM_WINDOWS" }
      includedirs
      {
          "C:\\Program Files\\OpenSSL-Win64\\include"
      }
      links
      {
          "libssl.lib",
          "libcrypto.lib"
      }

   filter { "system:windows", "configurations:Debug" }
      libdirs
      {
          "C:\\Program Files\\OpenSSL-Win64\\lib\\VC\\x64\\MDd"
      }

   filter { "system:windows", "configurations:Release" }
      libdirs
      {
          "C:\\Program Files\\OpenSSL-Win64\\lib\\VC\\x64\\MD"
      }

   -- Workspace-wide options for Linux
   filter "system:linux"
      systemversion "latest"
      -- see here for build option explanations: https://stackoverflow.com/questions/3375697/what-are-the-useful-gcc-flags-for-c
      buildoptions { "-pthread", "-Wextra", "-Wall", "-Wfloat-equal", "-Wundef", "-Wshadow",
                     "-Wpointer-arith", "-Wcast-align", "-Wwrite-strings",
                     "-Waggregate-return", "-Wcast-qual", "-Wconversion", "-Wunreachable-code" }
      defines { "PLATFORM_LINUX" }
      links
      {
          "ssl",
          "crypto"
      }

   filter "configurations:Debug"
      defines { "DEBUG" }
      runtime "Debug"
      symbols "On"

   filter "configurations:Release"
      defines { "RELEASE" }
      runtime "Release"
      optimize "Speed"
      symbols "Off"

   -- This is required so the next stuff doesn't get applied to any filters
   filter {}

   includedirs
   {
      "/dev/boost_1_87_0",
      "Vendor/json/include",
      "Vendor/inja/include"
   }



OutputDir = "%{cfg.system}-%{cfg.architecture}/%{cfg.buildcfg}"


include "Clover/Build-Clover.lua"
include "Sandbox/Build-Sandbox.lua"