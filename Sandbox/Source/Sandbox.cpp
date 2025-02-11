
#include <Clover.hpp>


using Clover::PlainHTTPSession;
using Clover::SSLHTTPSession;
using Clover::PlainWebsocketSession;
using Clover::SSLWebsocketSession;

class Sandbox : public Clover::Application
{
public:
	Sandbox() : Clover::Application("0.0.0.0", 8080, 1, "/dev/ssl/cert.pem", "/dev/ssl/key.pem", "/dev/ssl/dh.pem")
	{
        // Set the server version string (will be used as the "Server" response header field)
        SetServerVersion("Clover");
        
        // Set the document root
        SetDocumentRoot("Source/front-end/");

        // Inform Clover of the templates for error handling
        SetBadRequestTarget("bad_request.html");
        SetNotFoundTarget("not_found.html");
        SetInternalServerErrorTarget("internal_server_error.html");

        
        // Register Targets
        // Registering a target is entirely optional. The idea here is that when a request comes
        // through, we need to go look up all the necessary data to fulfill that request. However,
        // if no data needs to be looked up, then there is no need to register the target. In short,
        // registering a target simply adds the data gathering step between receiving a request, and
        // generating the html response.
        RegisterGETTarget("/home", [this](json parameters) -> json { return this->GetHomeData(parameters); });

        RegisterPUTTarget("/preferences/update-user-image", [this](json parameters) -> json { return this->UpdateUserImage(parameters); });
    }
    virtual ~Sandbox() override {}

    json GetHomeData(json parameters)
    {
        return parameters;
    }
    json UpdateUserImage(json parameters)
    {
        return parameters;
    }

    /*

    http::message_generator HandleHTTPRequest(HTTPRequestType req) noexcept override
    {
        // Example: ...com/user/home?id=1234&query=some-string
        //      target = "/user/home"
        //      parameters = { "id" = "1234", "query" = "some-string" }
        auto [target, parameters] = ParseTarget(req.target());

        // if the target has either no file extension or the extension is .html, then
        // it will be treated an html request. Otherwise, we will assume the request is
        // for another type of file (.css, .js, .png, etc)
        if (IsHTMLRequest(target))
        {
            // GenerateHTMLResponse will work in 2 steps:
            //  1. It will call GatherRequestData to gather all necessary data to stamp out
            //     the html template. This is also where any functions registered via
            //     RegisterTarget will be called.
            //  2. It will call GenerateHTML to stamp out the html template into a string 
            //     that will then make up the response body
            return GenerateHTMlResponse(target, parameters);
        }

    //    // Gather the data in a json obect that will be used to create the html
    //    json data = GatherRequestData(target, parameters);
    //
    //    // Pass the data to the html template engine
    //    std::string html = GenerateHTML(target, data);

        // Not an html request, so we will assume we are just serving a whole file
        //
        // In this case, it doesn't make sense for there to be any parameters, so let's
        // warn if there are any
        if (HasParameters(parameters))
        {
            LOG_WARN(...);
        }

        // The target will be treated as a file. If it doesn't exist, a 404 response will be returned
        return ServeFile(target);




        std::string_view doc_root = "./Source/front-end/";

        // Returns a bad request response
        auto const bad_request =
            [&req](beast::string_view why)
            {
                http::response<http::string_body> res{ http::status::bad_request, req.version() };
                res.set(http::field::server, BOOST_BEAST_VERSION_STRING);
                res.set(http::field::content_type, "text/html");
                res.keep_alive(req.keep_alive());
                res.body() = std::string(why);
                res.prepare_payload();
                return res;
            };

        // Returns a not found response
        auto const not_found =
            [&req](beast::string_view target)
            {
                http::response<http::string_body> res{ http::status::not_found, req.version() };
                res.set(http::field::server, BOOST_BEAST_VERSION_STRING);
                res.set(http::field::content_type, "text/html");
                res.keep_alive(req.keep_alive());
                res.body() = "The resource '" + std::string(target) + "' was not found.";
                res.prepare_payload();
                return res;
            };

        // Returns a server error response
        auto const server_error =
            [&req](beast::string_view what)
            {
                http::response<http::string_body> res{ http::status::internal_server_error, req.version() };
                res.set(http::field::server, BOOST_BEAST_VERSION_STRING);
                res.set(http::field::content_type, "text/html");
                res.keep_alive(req.keep_alive());
                res.body() = "An error occurred: '" + std::string(what) + "'";
                res.prepare_payload();
                return res;
            };

        // Make sure we can handle the method
        if (req.method() != http::verb::get &&
            req.method() != http::verb::head)
            return bad_request("Unknown HTTP-method");

        // Request path must be absolute and not contain "..".
        if (req.target().empty() ||
            req.target()[0] != '/' ||
            req.target().find("..") != beast::string_view::npos)
            return bad_request("Illegal request-target");

        // Build the path to the requested file
        std::string path = path_cat(doc_root, req.target());
        if (req.target().back() == '/')
            path.append("index.html");

        // Attempt to open the file
        beast::error_code ec;
        http::file_body::value_type body;
        body.open(path.c_str(), beast::file_mode::scan, ec);

        // Handle the case where the file doesn't exist
        if (ec == beast::errc::no_such_file_or_directory)
            return not_found(req.target());

        // Handle an unknown error
        if (ec)
            return server_error(ec.message());

        // Cache the size since we need it after the move
        auto const size = body.size();

        // Respond to HEAD request
        if (req.method() == http::verb::head)
        {
            http::response<http::empty_body> res{ http::status::ok, req.version() };
            res.set(http::field::server, BOOST_BEAST_VERSION_STRING);
            res.set(http::field::content_type, mime_type(path));
            res.content_length(size);
            res.keep_alive(req.keep_alive());
            return res;
        }

        // Respond to GET request
        http::response<http::file_body> res{
            std::piecewise_construct,
            std::make_tuple(std::move(body)),
            std::make_tuple(http::status::ok, req.version()) };
        res.set(http::field::server, BOOST_BEAST_VERSION_STRING);
        res.set(http::field::content_type, mime_type(path));
        res.content_length(size);
        res.keep_alive(req.keep_alive());
        return res;
    }

    */

    void HandleWebsocketData(PlainWebsocketSession* session, std::string&& data) noexcept override
    {
        LOG_INFO("WS: '{0}'", data);
        WS_Send(data);
    }
    void HandleWebsocketData(SSLWebsocketSession* session, std::string&& data) noexcept override
    {
        LOG_WARN("Not currently handling ws_ssl_session string data");
    }
    void HandleWebsocketData(PlainWebsocketSession* session, void* data, size_t bytes) noexcept override
    {
        LOG_INFO("WS: Received {0} bytes", bytes);
    }
    void HandleWebsocketData(SSLWebsocketSession* session, void* data, size_t bytes) noexcept override
    {
        LOG_WARN("Not currently handling ws_ssl_session binary data");
    }
    void WebsocketSessionJoin(PlainWebsocketSession* session) noexcept override
    {
        LOG_INFO("Accepted a new websocket connection");
        std::lock_guard<std::mutex> lock(m_mutex);
        m_wsSessions.insert(session);
    }
    void WebsocketSessionJoin(SSLWebsocketSession* session) noexcept override
    {
        LOG_WARN("Not currently handling ws_ssl_session joins");
    }
    void WebsocketSessionLeave(PlainWebsocketSession* session) noexcept override
    {
        LOG_INFO("Websocket connection disconnected");
        std::lock_guard<std::mutex> lock(m_mutex);
        m_wsSessions.erase(session);
    }
    void WebsocketSessionLeave(SSLWebsocketSession* session) noexcept override
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