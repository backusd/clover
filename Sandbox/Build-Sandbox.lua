project "Sandbox"
   kind "ConsoleApp"
   language "C++"
   cppdialect "C++latest"
   targetdir "Binaries/%{cfg.buildcfg}"
   staticruntime "off"

   files { "Source/**.hpp", "Source/**.cpp" }

   includedirs
   {
      "Source",
      "/dev/boost_1_87_0",

	  -- Include Clover
	  "../Clover/Source"
   }

   links
   {
      "Clover"
   }

   targetdir ("../Binaries/" .. OutputDir .. "/%{prj.name}")
   objdir ("../Binaries/Intermediates/" .. OutputDir .. "/%{prj.name}")

   filter "system:windows"
       systemversion "latest"
       defines { "PLATFORM_WINDOWS" }
       includedirs
       {
           "C:\\Program Files\\OpenSSL-Win64\\include"
       }
       libdirs
       {
           "C:\\Program Files\\OpenSSL-Win64\\lib\\VC\\x64\\MDd"
       }
       links
       {
           "libssl.lib",
           "libcrypto.lib"
       }

   filter "system:linux"
       systemversion "latest"
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