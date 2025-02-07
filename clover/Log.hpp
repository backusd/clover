#pragma once
#include "pch.hpp"

namespace Log
{
	template <typename... Args>
	void _Log(const char* color, std::string_view msg, Args&&... args) noexcept
	{
		std::cout << color << '[' << std::format("{:%T}", std::chrono::system_clock::now()) << "] ";
		//std::cout << color << '[' << std::chrono::system_clock::now() << "] ";

		if constexpr (sizeof...(Args) == 0)
			std::cout << msg << '\n';
		else
		{
			//std::vprint_nonunicode(std::cout, msg, std::make_format_args(args...));
			std::cout << std::vformat(msg, std::make_format_args(args...)) << '\n';
		}
	}

	template <typename... Args>
	void Trace(std::string_view msg, Args&&... args) noexcept
	{
		_Log("\x1B[37m", msg, args...);
	}
	template <typename... Args>
	void Info(std::string_view msg, Args&&... args) noexcept
	{
		_Log("\x1B[32m", msg, args...);
	}
	template <typename... Args>
	void Warn(std::string_view msg, Args&&... args) noexcept
	{
		_Log("\x1B[33m", msg, args...);
	}
	template <typename... Args>
	void Error(std::string_view msg, Args&&... args) noexcept
	{
		_Log("\x1B[31m", msg, args...);
	}
}


#define LOG_TRACE(...) ::Log::Trace(__VA_ARGS__)
#define LOG_INFO(...) ::Log::Info(__VA_ARGS__)
#define LOG_WARN(...) ::Log::Warn(__VA_ARGS__)
#define LOG_ERROR(...) ::Log::Error(__VA_ARGS__)