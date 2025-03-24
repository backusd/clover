
#include <Clover.hpp>


using Clover::PlainHTTPSession;
using Clover::SSLHTTPSession;
using Clover::PlainWebsocketSession;
using Clover::SSLWebsocketSession;

using Clover::Application;

class Sandbox : public Clover::Application
{
public:
	Sandbox() : Clover::Application("0.0.0.0", 8080, 1, "/dev/ssl/cert.pem", "/dev/ssl/key.pem", "/dev/ssl/dh.pem")
	{
        // Set the server version string (will be used as the "Server" response header field)
        SetServerVersion("Clover");
        
        // Set the document root
        SetDocumentRoot("front-end/");

        // Inform Clover of the templates for error handling
        SetBadRequestTarget("error-handling/bad_request.html");
        SetNotFoundTarget("error-handling/not_found.html");
        SetInternalServerErrorTarget("error-handling/internal_server_error.html");

        
        // Register Targets
        // Registering a target is entirely optional. The idea here is that when a request comes
        // through, we need to go look up all the necessary data to fulfill that request. However,
        // if no data needs to be looked up, then there is no need to register the target. In short,
        // registering a target simply adds the data gathering step between receiving a request, and
        // generating the html response.
        RegisterGETTarget("/home", [this](const Application::ParametersMap& parameters) -> json { return this->GetHomeData(parameters); });

        RegisterPUTTarget("/preferences/update-user-image", [this](const Application::ParametersMap& parameters) -> json { return this->UpdateUserImage(parameters); });
    }
    virtual ~Sandbox() override {}

    json GetHomeData(const Application::ParametersMap& /* parameters */)
    {
        PROFILE_SCOPE("Sandbox::GetHomeData");

        LOG_TRACE("Sandbox: Inside GetHomeData...");

        json d;
        d["home"] = "some data";
        return d;
    }
    json UpdateUserImage(const Application::ParametersMap& /* parameters */)
    {
        PROFILE_SCOPE("Sandbox::UpdateUserImage");

        json d;
        d["update-user-image"] = "some data";
        return d;
    }

    void HandleWebsocketData(PlainWebsocketSession* /* session */, std::string&& data) noexcept override
    {
        LOG_INFO("WS: '{0}'", data);
        WS_Send(data);
    }
    void HandleWebsocketData(SSLWebsocketSession* /* session */, std::string&& /* data */) noexcept override
    {
        LOG_WARN("Not currently handling ws_ssl_session string data");
    }
    void HandleWebsocketData(PlainWebsocketSession* /* session */, void* /* data */, size_t bytes) noexcept override
    {
        LOG_INFO("WS: Received {0} bytes", bytes);
    }
    void HandleWebsocketData(SSLWebsocketSession* /* session */, void* /* session */, size_t /* bytes */) noexcept override
    {
        LOG_WARN("Not currently handling ws_ssl_session binary data");
    }
    void WebsocketSessionJoin(PlainWebsocketSession* session) noexcept override
    {
        LOG_INFO("Accepted a new websocket connection");
        std::lock_guard<std::mutex> lock(m_mutex);
        m_wsSessions.insert(session);
    }
    void WebsocketSessionJoin(SSLWebsocketSession* /* session */) noexcept override
    {
        LOG_WARN("Not currently handling ws_ssl_session joins");
    }
    void WebsocketSessionLeave(PlainWebsocketSession* session) noexcept override
    {
        LOG_INFO("Websocket connection disconnected");
        std::lock_guard<std::mutex> lock(m_mutex);
        m_wsSessions.erase(session);
    }
    void WebsocketSessionLeave(SSLWebsocketSession* /* session */) noexcept override
    {
        LOG_WARN("Not currently handling ws_ssl_session leaves");
    }

private:
    // Return a reasonable mime type based on the extension of a file.
    beast::string_view mime_type(beast::string_view path)
    {
        using beast::iequals;
        auto const ext = [&path]
            {
                auto const pos = path.rfind(".");
                if (pos == beast::string_view::npos)
                    return beast::string_view{};
                return path.substr(pos);
            }();
        if (iequals(ext, ".htm"))  return "text/html";
        if (iequals(ext, ".html")) return "text/html";
        if (iequals(ext, ".php"))  return "text/html";
        if (iequals(ext, ".css"))  return "text/css";
        if (iequals(ext, ".txt"))  return "text/plain";
        if (iequals(ext, ".js"))   return "application/javascript";
        if (iequals(ext, ".json")) return "application/json";
        if (iequals(ext, ".xml"))  return "application/xml";
        if (iequals(ext, ".swf"))  return "application/x-shockwave-flash";
        if (iequals(ext, ".flv"))  return "video/x-flv";
        if (iequals(ext, ".png"))  return "image/png";
        if (iequals(ext, ".jpe"))  return "image/jpeg";
        if (iequals(ext, ".jpeg")) return "image/jpeg";
        if (iequals(ext, ".jpg"))  return "image/jpeg";
        if (iequals(ext, ".gif"))  return "image/gif";
        if (iequals(ext, ".bmp"))  return "image/bmp";
        if (iequals(ext, ".ico"))  return "image/vnd.microsoft.icon";
        if (iequals(ext, ".tiff")) return "image/tiff";
        if (iequals(ext, ".tif"))  return "image/tiff";
        if (iequals(ext, ".svg"))  return "image/svg+xml";
        if (iequals(ext, ".svgz")) return "image/svg+xml";
        return "application/text";
    }

    // Append an HTTP rel-path to a local filesystem path.
    // The returned path is normalized for the platform.
    std::string path_cat(beast::string_view base, beast::string_view path)
    {
        if (base.empty())
            return std::string(path);
        std::string result(base);
#ifdef BOOST_MSVC
        char constexpr path_separator = '\\';
        if (result.back() == path_separator)
            result.resize(result.size() - 1);
        result.append(path.data(), path.size());
        for (auto& c : result)
            if (c == '/')
                c = path_separator;
#else
        char constexpr path_separator = '/';
        if (result.back() == path_separator)
            result.resize(result.size() - 1);
        result.append(path.data(), path.size());
#endif
        return result;
    }

    void WS_Send(std::string message)
    {
        // Put the message in a shared pointer so we can re-use it for each client
        auto const ss = std::make_shared<std::string const>(std::move(message));

        // Make a local list of all the weak pointers representing
        // the sessions, so we can do the actual sending without
        // holding the mutex:
        std::vector<std::weak_ptr<PlainWebsocketSession>> v;
        {
            std::lock_guard<std::mutex> lock(m_mutex);
            v.reserve(m_wsSessions.size());
            for (auto p : m_wsSessions)
                v.emplace_back(p->weak_from_this());
        }

        // For each session in our local list, try to acquire a strong
        // pointer. If successful, then send the message on that session.
        for (auto const& wp : v)
            if (auto sp = wp.lock())
                sp->Send(ss);
    }

    // This mutex synchronizes all access to sessions_
    std::mutex m_mutex;
    std::unordered_set<PlainWebsocketSession*> m_wsSessions;
};


Clover::Application* Clover::CreateApplication()
{
	return new Sandbox();
}