#pragma once

#if PROFILING_ENABLED

#include <algorithm>
#include <chrono>
#include <fstream>
#include <source_location>
#include <thread>

#define TOKENPASTE(x, y) x ## y
#define TOKENPASTE2(x, y) TOKENPASTE(x, y)

#define PROFILE_BEGIN_SESSION(name, filepath) ::Clover::Profiler::Get().BeginSession(name, filepath)
#define PROFILE_END_SESSION() ::Clover::Profiler::Get().EndSession()
#define PROFILE_SCOPE(name) ::Clover::ProfilerTimer TOKENPASTE2(timer, __LINE__)(name)
// Commenting this out for now because I couldn't get it working the way I wanted it to
//#define PROFILE_FUNCTION() PROFILE_SCOPE(std::source_location::current().function_name())

#else
#define PROFILE_BEGIN_SESSION(name, filepath)
#define PROFILE_END_SESSION()
#define PROFILE_SCOPE(name)
#define PROFILE_FUNCTION()
#endif

#if PROFILING_ENABLED
namespace Clover
{
struct ProfileResult
{
	std::string name;
	long long start;
	long long end;
	size_t threadID;
};

class Profiler
{
public:
	void BeginSession(std::string_view name, const std::string& outputFilename = "results.json");

	void EndSession();

	void WriteProfile(const ProfileResult& result);

	void WriteHeader();

	void WriteFooter();

	[[nodiscard]] inline static Profiler& Get() noexcept
	{
		static Profiler profiler;
		return profiler;
	}

private:
	std::string m_sessionName{};
	std::ofstream m_outputStream{};
	int m_profileCount{ 0 };
};

class ProfilerTimer
{
public:
	ProfilerTimer(std::string_view name);
	~ProfilerTimer();

	void Stop();

private:
	std::string m_name;
	bool m_stopped;
	std::chrono::time_point<std::chrono::high_resolution_clock> m_startTimePoint;
};


}
#endif