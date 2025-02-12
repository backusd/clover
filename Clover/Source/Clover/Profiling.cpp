#include "Profiling.hpp"
#include "Log.hpp"

#if PROFILING_ENABLED

namespace Clover
{
void Profiler::BeginSession(std::string_view name, const std::string& outputFilename)
{
	// This is at least a problem on Windows. Not sure about Linux.
	if (outputFilename.contains(':'))
		LOG_ERROR("[PROFILER] Invalid to have a ':' in the output filename: '{0}", outputFilename);

	m_outputStream.open(outputFilename);
	WriteHeader();
	m_sessionName = name;
}

void Profiler::EndSession()
{
	WriteFooter();
	m_outputStream.close();
	m_profileCount = 0;
}

void Profiler::WriteProfile(const ProfileResult& result)
{
	if (m_profileCount++ > 0)
		m_outputStream << ',';

	std::string name = result.name;
	std::replace(name.begin(), name.end(), '"', '\'');

	m_outputStream << "{";
	m_outputStream << "\"cat\":\"function\",";
	m_outputStream << "\"dur\":" << (result.end - result.start) << ',';
	m_outputStream << "\"name\":\"" << name << "\",";
	m_outputStream << "\"ph\":\"X\",";
	m_outputStream << "\"pid\":0,";
	m_outputStream << "\"tid\":" << result.threadID << ',';
	m_outputStream << "\"ts\":" << result.start;
	m_outputStream << "}";

	m_outputStream.flush();
}

void Profiler::WriteHeader()
{
	m_outputStream << "{\"otherData\": {},\"traceEvents\":[";
	m_outputStream.flush();
}

void Profiler::WriteFooter()
{
	m_outputStream << "]}";
	m_outputStream.flush();
}




ProfilerTimer::ProfilerTimer(std::string_view name) :
	m_name(name),
	m_stopped(false),
	m_startTimePoint(std::chrono::high_resolution_clock::now())
{
}
ProfilerTimer::~ProfilerTimer()
{
	if (!m_stopped)
		Stop();
}

void ProfilerTimer::Stop()
{
	auto endTimePoint = std::chrono::high_resolution_clock::now();
	long long start = std::chrono::time_point_cast<std::chrono::microseconds>(m_startTimePoint).time_since_epoch().count();
	long long end = std::chrono::time_point_cast<std::chrono::microseconds>(endTimePoint).time_since_epoch().count();

	size_t threadID = std::hash<std::thread::id>{}(std::this_thread::get_id());
	Profiler::Get().WriteProfile({ m_name, start, end, threadID });

	m_stopped = true;
}

}

#endif