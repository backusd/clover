/*

#include "Application.hpp"


class Clover : public Application<Clover>
{
    using ws_session = Application<Clover>::plain_websocket_session;
    using ws_ssl_session = Application<Clover>::ssl_websocket_session;

public:
    Clover(std::string_view address, unsigned short port, unsigned int threads = std::thread::hardware_concurrency()) :
        Application<Clover>(address, port, threads)
    {}

    void HandleFailure(FAILURE_REASON reason, const beast::error_code& ec)
    {
        // ssl::error::stream_truncated, also known as an SSL "short read",
        // indicates the peer closed the connection without performing the
        // required closing handshake (for example, Google does this to
        // improve performance). Generally this can be a security issue,
        // but if your communication protocol is self-terminated (as
        // it is with both HTTP and WebSocket) then you may simply
        // ignore the lack of close_notify.
        //
        // https://github.com/boostorg/beast/issues/38
        //
        // https://security.stackexchange.com/questions/91435/how-to-handle-a-malicious-ssl-tls-shutdown
        //
        // When a short read would cut off the end of an HTTP message,
        // Beast returns the error beast::http::error::partial_message.
        // Therefore, if we see a short read here, it has occurred
        // after the message has been completed, so it is safe to ignore it.

        if (ec == net::ssl::error::stream_truncated)
            return;

        LOG_WARN("Clover: Not performing any specific failure handling of {0}: {1}", ToString(reason), ec.what());
    }

    // Return a response for the given request.
    // The concrete type of the response message (which depends on the request), is type-erased in message_generator.
    template<class Body, class Allocator>
    http::message_generator HandleRequest(http::request<Body, http::basic_fields<Allocator>>&& req)
    {
        std::string_view doc_root = ".";

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

    void HandleWebsocketData(ws_session* session, std::string&& data)
    {
        LOG_INFO("WS: '{0}'", data);
        ws_send(data);
    }
    void HandleWebsocketData(ws_ssl_session* session, std::string&& data)
    {
        LOG_WARN("Not currently handling ws_ssl_session string data");
    }
    void HandleWebsocketData(ws_session* session, void* data, size_t bytes)
    {
        LOG_INFO("WS: Received {0} bytes", bytes);
    }
    void HandleWebsocketData(ws_ssl_session* session, void* data, size_t bytes)
    {
        LOG_WARN("Not currently handling ws_ssl_session binary data");
    }
    void WebsocketSessionJoin(ws_session* session)
    {
        LOG_INFO("Accepted a new websocket connection");
        std::lock_guard<std::mutex> lock(m_mutex);
        m_wsSessions.insert(session);
    }
    void WebsocketSessionJoin(ws_ssl_session* session)
    {
        LOG_WARN("Not currently handling ws_ssl_session joins");
    }
    void WebsocketSessionLeave(ws_session* session)
    {
        LOG_INFO("Websocket connection disconnected");
        std::lock_guard<std::mutex> lock(m_mutex);
        m_wsSessions.erase(session);
    }
    void WebsocketSessionLeave(ws_ssl_session* session)
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

private:
    // This mutex synchronizes all access to sessions_
    std::mutex m_mutex;
    std::unordered_set<ws_session*> m_wsSessions;

    void ws_send(std::string message)
    {
        // Put the message in a shared pointer so we can re-use it for each client
        auto const ss = std::make_shared<std::string const>(std::move(message));

        // Make a local list of all the weak pointers representing
        // the sessions, so we can do the actual sending without
        // holding the mutex:
        std::vector<std::weak_ptr<ws_session>> v;
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
                sp->send(ss);
    }
};

int main(int argc, char* argv[])
{
    std::cout << "PATH: " << std::filesystem::current_path() << '\n';

    Clover app("0.0.0.0", 8080, 1);
    app.Run();

    return EXIT_SUCCESS;
}

*/