#pragma once
#include "pch.hpp"
#include "Log.hpp"
#include "Profiling.hpp"

#include <boost/exception/diagnostic_information.hpp>
#include <boost/exception_ptr.hpp>

namespace Clover
{
    class PlainWebsocketSession;
    class SSLWebsocketSession;

    class Application
    {
    public:
        using ParametersMap = std::unordered_map<std::string_view, std::string_view>;
        using DataGatherFn = std::function<json(const ParametersMap&)>;
        

        Application(std::string_view address, unsigned short port, unsigned int threads = std::thread::hardware_concurrency(),
                    const std::string& cert = "", const std::string& key = "", const std::string& dh = "") noexcept;
        virtual ~Application() {}

        void Run() noexcept;

        using HTTPRequestType = http::request<http::string_body, http::basic_fields<std::allocator<char>>>;
        ND http::message_generator HandleHTTPRequest(HTTPRequestType req) noexcept;

        virtual void HandleWebsocketData(PlainWebsocketSession* session, std::string&& data) noexcept = 0;
        virtual void HandleWebsocketData(SSLWebsocketSession* session, std::string&& data) noexcept = 0;
        virtual void HandleWebsocketData(PlainWebsocketSession* session, void* data, size_t bytes) noexcept = 0;
        virtual void HandleWebsocketData(SSLWebsocketSession* session, void* data, size_t bytes) noexcept = 0;
        virtual void WebsocketSessionJoin(PlainWebsocketSession* session) noexcept = 0;
        virtual void WebsocketSessionJoin(SSLWebsocketSession* session) noexcept = 0;
        virtual void WebsocketSessionLeave(PlainWebsocketSession* session) noexcept = 0;
        virtual void WebsocketSessionLeave(SSLWebsocketSession* session) noexcept = 0;

    protected:
        inline void SetServerVersion(std::string_view version) noexcept { m_serverVersion = version; }
        inline void SetDocumentRoot(std::string_view docRoot) noexcept 
        { 
            m_docRoot = docRoot; 
            if (!m_docRoot.ends_with('/'))
                m_docRoot += '/';
        }
        inline void SetBadRequestTarget(std::string_view target) noexcept 
        { 
            if (target.ends_with('/'))
                LOG_ERROR("[CORE] SetBadRequestTarget failed. Bad Request target cannot end in '/': '{0}'", target);
            else
                m_badRequestTarget = target;
        }
        inline void SetNotFoundTarget(std::string_view target) noexcept 
        {
            if (target.ends_with('/'))
                LOG_ERROR("[CORE] SetNotFoundTarget failed. Not Found target cannot end in '/': '{0}'", target);
            else
                m_notFoundTarget = target;
        }
        inline void SetInternalServerErrorTarget(std::string_view target) noexcept 
        { 
            if (target.ends_with('/'))
                LOG_ERROR("[CORE] SetInternalServerErrorTarget failed. Internal Server Error target cannot end in '/': '{0}'", target);
            else
                m_internalServerErrorTarget = target;
        }

        void RegisterGETTarget(const std::string& target, DataGatherFn dataGatherFn) noexcept;
        void RegisterPUTTarget(const std::string& target, DataGatherFn dataGatherFn) noexcept;
        void RegisterPOSTTarget(const std::string& target, DataGatherFn dataGatherFn) noexcept;

    private:
        void LoadServerCertificate(const std::string& cert, const std::string& key, const std::string& dh);
        ND std::pair<std::string_view, ParametersMap> ParseTarget(std::string_view target) const noexcept;
        ND json GatherRequestData(std::string_view target, const ParametersMap& urlParams) const;
        ND http::message_generator GenerateHTMLResponse(std::string_view target, const ParametersMap& urlParams, HTTPRequestType& req);
        ND http::message_generator ServeFile(std::string_view target, HTTPRequestType& req);

        ND http::message_generator HandleHTTPGETRequest(HTTPRequestType& req);
        ND http::message_generator HandleHTTPPUTRequest(HTTPRequestType& req);
        ND http::message_generator HandleHTTPPOSTRequest(HTTPRequestType& req);

        ND http::message_generator BadRequest(std::string_view reason, HTTPRequestType& req);
        ND http::message_generator FileNotFound(std::string_view target, HTTPRequestType& req);
        ND http::message_generator InternalServerError(std::string_view reason, HTTPRequestType& req);

        ND constexpr bool IsTargetHTML(std::string_view target) const noexcept
        {
            // If the last character is '/', then the request was for a directory, which
            // we will default to assuming this is a valid HTML target
            if (target.ends_with('/'))
                return true;

            // Create a string_view for the whole target
            std::string_view file = target;

            // Get a substring that contains all of the characters after the last '/'
            size_t pos = target.rfind('/');
            if (pos != std::string::npos)
                file = target.substr(pos + 1);

            // Look for the extension and return true if it matches ".html"
            pos = file.rfind('.');
            return pos == std::string::npos ? true : file.substr(pos).compare(".html") == 0;
        }
        ND constexpr std::string_view MimeType(std::string_view path) const noexcept
        {
            if (path.ends_with(".htm"))  return "text/html";
            if (path.ends_with(".html")) return "text/html";
            if (path.ends_with(".php"))  return "text/html";
            if (path.ends_with(".css"))  return "text/css";
            if (path.ends_with(".txt"))  return "text/plain";
            if (path.ends_with(".js"))   return "application/javascript";
            if (path.ends_with(".json")) return "application/json";
            if (path.ends_with(".xml"))  return "application/xml";
            if (path.ends_with(".swf"))  return "application/x-shockwave-flash";
            if (path.ends_with(".flv"))  return "video/x-flv";
            if (path.ends_with(".png"))  return "image/png";
            if (path.ends_with(".jpe"))  return "image/jpeg";
            if (path.ends_with(".jpeg")) return "image/jpeg";
            if (path.ends_with(".jpg"))  return "image/jpeg";
            if (path.ends_with(".gif"))  return "image/gif";
            if (path.ends_with(".bmp"))  return "image/bmp";
            if (path.ends_with(".ico"))  return "image/vnd.microsoft.icon";
            if (path.ends_with(".tiff")) return "image/tiff";
            if (path.ends_with(".tif"))  return "image/tiff";
            if (path.ends_with(".svg"))  return "image/svg+xml";
            if (path.ends_with(".svgz")) return "image/svg+xml";
            return "application/text";
        }

        net::io_context m_ioc;
        unsigned int m_threads;
        ssl::context m_ctx;
        inja::Environment m_injaEnv;
        

        std::string m_serverVersion = "Clover";
        std::string m_docRoot = "Source/front-end";
        std::string m_badRequestTarget = "";
        std::string m_notFoundTarget = "";
        std::string m_internalServerErrorTarget = "";

        // string_hash is used that that we can do a lookup using a string_view even though
        // the keys are strings. See: https://www.cppstories.com/2021/heterogeneous-access-cpp20/
        struct string_hash {
            using is_transparent = void;
            [[nodiscard]] size_t operator()(const char* txt) const {
                return std::hash<std::string_view>{}(txt);
            }
            [[nodiscard]] size_t operator()(std::string_view txt) const {
                return std::hash<std::string_view>{}(txt);
            }
            [[nodiscard]] size_t operator()(const std::string& txt) const {
                return std::hash<std::string>{}(txt);
            }
        };

        std::unordered_map<std::string, DataGatherFn, string_hash, std::equal_to<>> m_GETTargets;
        std::unordered_map<std::string, DataGatherFn, string_hash, std::equal_to<>> m_PUTTargets;
        std::unordered_map<std::string, DataGatherFn, string_hash, std::equal_to<>> m_POSTTargets;
    };

    // To be defined in client
    Application* CreateApplication();

    // Handles WebSocket messages.
    // This uses the Curiously Recurring Template Pattern so that
    // the same code works with both SSL streams and regular sockets.
    template<class Derived>
    class WebsocketSession
    {
    public:
        WebsocketSession(Application* application) noexcept :
            m_application(application)
        {}

        // Start the asynchronous operation
        template<class Body, class Allocator>
        void Run(http::request<Body, http::basic_fields<Allocator>> req)
        {
            // Accept the WebSocket upgrade request
            DoAccept(std::move(req));
        }

        void Send(std::shared_ptr<std::string const> const& ss) noexcept
        {
            // Need a try-catch here so an exception doesn't escape and cause a crash
            try
            {
                // Post our work to the strand, this ensures that the members of `this` will not be accessed concurrently.
                net::post(
                    GetDerived().WS().get_executor(),
                    beast::bind_front_handler(
                        &WebsocketSession::OnSend,
                        GetDerived().shared_from_this(),
                        ss));
            }
            catch (const boost::exception& e)
            {
                LOG_ERROR("[CORE] WebsocketSession::Send failure. Caught boost::exception: \n'{0}'",
                    boost::diagnostic_information(e));
            }
            catch (const std::exception& e)
            {
                LOG_ERROR("[CORE] WebsocketSession::Send failure. Caught std::exception: \n'{0}'", e.what());
            }
            catch (...)
            {
                LOG_ERROR("[CORE] WebsocketSession::Send failure. Caught unknown exception.");
            }
        }

    private:
        Derived& GetDerived() { return static_cast<Derived&>(*this); }

        // Start the asynchronous operation
        template<class Body, class Allocator>
        void DoAccept(http::request<Body, http::basic_fields<Allocator>> req)
        {
            // Set suggested timeout settings for the websocket
            GetDerived().WS().set_option(
                websocket::stream_base::timeout::suggested(beast::role_type::server));

            // Set a decorator to change the Server of the handshake
            GetDerived().WS().set_option(
                websocket::stream_base::decorator(
                    [](websocket::response_type& res)
                    {
                        res.set(http::field::server,
                            std::string(BOOST_BEAST_VERSION_STRING) +
                            " advanced-server-flex");
                    }));

            // Accept the websocket handshake
            GetDerived().WS().async_accept(
                req,
                beast::bind_front_handler(
                    &WebsocketSession::OnAccept,
                    GetDerived().shared_from_this()));
        }

        void OnAccept(beast::error_code ec)
        {
            if (ec)
            {
                LOG_ERROR("[CORE] Received WebsocketSession::OnAccept error: '{0}'", ec.what());
                return;
            }

            // Inform the application that this session exists
            GetDerived().WebsocketSessionJoin();

            // Read a message
            DoRead();
        }

        void DoRead()
        {
            // Read a message into our buffer
            GetDerived().WS().async_read(
                m_buffer,
                beast::bind_front_handler(
                    &WebsocketSession::OnRead,
                    GetDerived().shared_from_this()));
        }

        void OnRead(beast::error_code ec, std::size_t bytes_transferred)
        {
            // Need a try-catch here so an exception doesn't escape and cause a crash
            try
            {
                boost::ignore_unused(bytes_transferred);

                if (ec)
                {
                    // This indicates that the WebsocketSession was closed
                    if (ec == websocket::error::closed)
                        return;

                    // If the webpage forgets to gracefully shutdown the websocket connection, we will get one of these two error codes
                    int val = ec.value();
                    if (val == 10053 || val == 10054)
                    {
                        LOG_WARN("[CORE] Received WebsocketSession::OnRead error: '{0}'", ec.what());
                        LOG_WARN("[CORE] This error occurs when the websocket was not correctly closed, likely due to closing the webpage");
                        LOG_WARN("[CORE] Please be sure to include the following javascript in the webpage:\n\twindow.addEventListener('beforeunload', () =>\n\t{\n\t\tif (ws.readyState === WebSocket.OPEN)\n\t\t{\n\t\t\tws.close();\n\t\t}\n\t});");
                        return;
                    }

                    LOG_ERROR("[CORE] Received WebsocketSession::OnRead error: '{0}'", ec.what());
                    return;
                }

                // Send the data to the application as either string or binary data depending on what was sent
                if (GetDerived().WS().got_text())
                {
                    // Incoming data was a string, so convert the buffer to a string and send that to the application
                    GetDerived().HandleWebsocketData(beast::buffers_to_string(m_buffer.data()));
                }
                else
                {
                    // Incoming data was binary data, so send a void* and size to the application which must interpret it
                    auto buf = m_buffer.data();
                    GetDerived().HandleWebsocketData(buf.data(), buf.size());
                }                
            }
            catch (const boost::exception& e)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnRead failure. Caught boost::exception: \n'{0}'",
                    boost::diagnostic_information(e));
            }
            catch (const std::exception& e)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnRead failure. Caught std::exception: \n'{0}'", e.what());
            }
            catch (...)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnRead failure. Caught unknown exception.");
            }

            // Clear the buffer
            m_buffer.consume(m_buffer.size());

            // Continue the loop by trying to read another message
            DoRead();
        }

        void OnSend(std::shared_ptr<std::string const> const& ss)
        {
            // Need a try-catch here so an exception doesn't escape and cause a crash
            try
            {
                // Always add to queue
                m_queue.push_back(ss);

                // Are we already writing?
                if (m_queue.size() > 1)
                    return;

                // We are not currently writing, so send this immediately
                GetDerived().WS().async_write(
                    net::buffer(*m_queue.front()),
                    beast::bind_front_handler(
                        &WebsocketSession::OnWrite,
                        GetDerived().shared_from_this()));
            }
            catch (const boost::exception& e)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnSend failure. Caught boost::exception: \n'{0}'",
                    boost::diagnostic_information(e));
            }
            catch (const std::exception& e)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnSend failure. Caught std::exception: \n'{0}'", e.what());
            }
            catch (...)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnSend failure. Caught unknown exception.");
            }
        }

        void OnWrite(beast::error_code ec, std::size_t)
        {
            // Need a try-catch here so an exception doesn't escape and cause a crash
            try
            {
                // Handle the error, if any
                if (ec)
                {
                    LOG_ERROR("[CORE] Received WebsocketSession::OnWrite error: '{0}'", ec.what());
                    return;
                }

                // Remove the string from the queue
                m_queue.erase(m_queue.begin());

                // Send the next message if any
                if (!m_queue.empty())
                    GetDerived().WS().async_write(
                        net::buffer(*m_queue.front()),
                        beast::bind_front_handler(
                            &WebsocketSession::OnWrite,
                            GetDerived().shared_from_this()));
            }
            catch (const boost::exception& e)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnWrite failure. Caught boost::exception: \n'{0}'",
                    boost::diagnostic_information(e));
            }
            catch (const std::exception& e)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnWrite failure. Caught std::exception: \n'{0}'", e.what());
            }
            catch (...)
            {
                LOG_ERROR("[CORE] WebsocketSession::OnWrite failure. Caught unknown exception.");
            }
        }


    protected:
        beast::flat_buffer m_buffer;
        Application* m_application;
        std::vector<std::shared_ptr<std::string const>> m_queue;
    };

    // Handles a plain WebSocket connection
    class PlainWebsocketSession : public WebsocketSession<PlainWebsocketSession>, public std::enable_shared_from_this<PlainWebsocketSession>
    {
    public:
        // Create the session
        explicit PlainWebsocketSession(beast::tcp_stream&& stream, Application* application) :
            WebsocketSession<PlainWebsocketSession>(application),
            m_ws(std::move(stream))
        {}
        inline ~PlainWebsocketSession()
        {
            // Remove this session from the list of active sessions
            m_application->WebsocketSessionLeave(this);
        }
        inline void WebsocketSessionJoin()
        {
            m_application->WebsocketSessionJoin(this);
        }
        inline void HandleWebsocketData(std::string&& data)
        {
            m_application->HandleWebsocketData(this, std::move(data));
        }
        inline void HandleWebsocketData(void* data, size_t bytes)
        {
            m_application->HandleWebsocketData(this, data, bytes);
        }

        // Called by the base class
        websocket::stream<beast::tcp_stream>& WS()
        {
            return m_ws;
        }

    private:
        websocket::stream<beast::tcp_stream> m_ws;
    };

    // Handles an SSL WebSocket connection
    class SSLWebsocketSession : public WebsocketSession<SSLWebsocketSession>, public std::enable_shared_from_this<SSLWebsocketSession>
    {
    public:
        // Create the SSLWebsocketSession
        explicit SSLWebsocketSession(ssl::stream<beast::tcp_stream>&& stream, Application* application) :
            WebsocketSession<SSLWebsocketSession>(application),
            m_ws(std::move(stream))
        {}
        ~SSLWebsocketSession()
        {
            // Remove this session from the list of active sessions
            m_application->WebsocketSessionLeave(this);
        }
        void WebsocketSessionJoin()
        {
            m_application->WebsocketSessionJoin(this);
        }
        void HandleWebsocketData(std::string&& data)
        {
            m_application->HandleWebsocketData(this, std::move(data));
        }
        void HandleWebsocketData(void* data, size_t bytes)
        {
            m_application->HandleWebsocketData(this, data, bytes);
        }

        // Called by the base class
        websocket::stream<ssl::stream<beast::tcp_stream>>& WS()
        {
            return m_ws;
        }

    private:
        websocket::stream<ssl::stream<beast::tcp_stream>> m_ws;
    };

    template<class Body, class Allocator>
    void MakeWebsocketSession(beast::tcp_stream stream, http::request<Body, http::basic_fields<Allocator>> req, Application* application)
    {
        std::make_shared<PlainWebsocketSession>(std::move(stream), application)->Run(std::move(req));
    }
    template<class Body, class Allocator>
    void MakeWebsocketSession(ssl::stream<beast::tcp_stream> stream, http::request<Body, http::basic_fields<Allocator>> req, Application* application)
    {
        std::make_shared<SSLWebsocketSession>(std::move(stream), application)->Run(std::move(req));
    }

    // Handles an HTTP server connection.
    // This uses the Curiously Recurring Template Pattern so that
    // the same code works with both SSL streams and regular sockets.
    template<class Derived>
    class HTTPSession
    {
    public:
        // Construct the session
        HTTPSession(beast::flat_buffer buffer, Application* application) noexcept :
            m_application(application),
            m_buffer(std::move(buffer)),
            m_port(0)
        {
            assert(m_application != nullptr);
        }

        void DoRead()
        {
            // Keep track of the address and port. This must be done here and not in the constructor because
            // the stream is not initialized until the constructor in the derived class completes
            auto remote_endpoint = beast::get_lowest_layer(GetDerived().Stream()).socket().remote_endpoint();
            m_address = remote_endpoint.address().to_string();
            m_port = remote_endpoint.port();

            // Construct a new parser for each message
            m_parser.emplace();

            // Apply a reasonable limit to the allowed size
            // of the body in bytes to prevent abuse.
            m_parser->body_limit(10000);

            // Set the timeout.
            beast::get_lowest_layer(GetDerived().Stream()).expires_after(std::chrono::seconds(30));

            // Read a request using the parser-oriented interface
            http::async_read(
                GetDerived().Stream(),
                m_buffer,
                *m_parser,
                beast::bind_front_handler(
                    &HTTPSession::OnRead,
                    GetDerived().shared_from_this()));
        }

        void OnRead(beast::error_code ec, std::size_t bytes_transferred) noexcept
        {
            PROFILE_BEGIN_SESSION(
                std::format("session={0}:{1}:{2}", m_address, m_port, (std::string)m_parser->get().target()),
                std::format("../Profile-Results/{0}_{1}_{2}.json", (std::string)m_parser->get().target(), m_address, m_port)
            );

#ifdef TRACE_LOGGING
            auto timePointStart = std::chrono::high_resolution_clock::now();
#endif // TRACE_LOGGING            

            std::string target;

            {
                PROFILE_SCOPE("HTTPSession::OnRead");

                // Need a try-catch here so an exception doesn't escape and cause a crash
                try
                {
                    boost::ignore_unused(bytes_transferred);

                    if (ec)
                    {
                        // This means they closed the connection
                        if (ec == http::error::end_of_stream)
                            return GetDerived().DoEOF();

                        // Because at the end of each read, we attempt to make another read, we will always find ourselves
                        // waiting. However, if there is no more data, then eventually we will hit the socket timeout, in which 
                        // case we can just be done.
                        // NOTE: Do NOT call do_eof() because that will call shutdown() on the socket, which is not valid because
                        //       we have already reached a timeout
                        if (ec == beast::error::timeout)
                            return;

                        LOG_ERROR("[CORE] Received HTTPSession::OnRead error: '{0}'", ec.what());
                        return;
                    }

                    // See if it is a WebSocket Upgrade
                    if (websocket::is_upgrade(m_parser->get()))
                    {
                        // Disable the timeout.
                        // The websocket::stream uses its own timeout settings.
                        beast::get_lowest_layer(GetDerived().Stream()).expires_never();

                        // Create a websocket session, transferring ownership
                        // of both the socket and the HTTP request.
                        return MakeWebsocketSession(
                            GetDerived().ReleaseStream(),
                            m_parser->release(),
                            m_application);
                    }

                    target = (std::string)m_parser->get().target();
                    LOG_INFO("[CORE] Received http request from {0}:{1} -> {2} {3}", m_address, m_port, (std::string)m_parser->get().method_string(), target);
                    //    LOG_TRACE("\tVerb      : {0}", (std::string)m_parser->get().method_string());
                    //    LOG_TRACE("\tTarget    : {0}", (std::string)m_parser->get().target());
                    //    LOG_TRACE("\tKeep Alive: {0}", m_parser->get().keep_alive() ? "true" : "false");
                    //    for (auto itr = m_parser->get().base().cbegin(); itr != m_parser->get().base().cend(); itr = itr->next_)
                    //        LOG_TRACE("\t{0}: {1}", (std::string)itr->name_string(), (std::string)itr->value());
                    //    LOG_TRACE("\tBody      : {0}\n", (std::string)m_parser->get().body());

                    // Send the response
                    QueueWrite(m_application->HandleHTTPRequest(m_parser->release()));
                }
                catch (const boost::exception& e)
                {
                    LOG_ERROR("[CORE] HTTPSession::OnRead failure. Caught boost::exception: \n'{0}'",
                        boost::diagnostic_information(e));
                }
                catch (const std::exception& e)
                {
                    LOG_ERROR("[CORE] HTTPSession::OnRead failure. Caught std::exception: \n'{0}'", e.what());
                }
                catch (...)
                {
                    LOG_ERROR("[CORE] HTTPSession::OnRead failure. Caught unknown exception.");
                }

                // If we aren't at the queue limit, try to pipeline another request
                if (m_response_queue.size() < m_queue_limit)
                    DoRead();
            }

#ifdef TRACE_LOGGING
            std::chrono::duration<double, std::milli> fp_ms = std::chrono::high_resolution_clock::now() - timePointStart;
            LOG_TRACE("[CORE] Request from {0}:{1} for target '{2}' took {3}ms", m_address, m_port, target, fp_ms.count());
#endif

            PROFILE_END_SESSION();
        }

        void QueueWrite(http::message_generator response)
        {
            // Allocate and store the work
            m_response_queue.push(std::move(response));

            // If there was no previous work, start the write loop
            if (m_response_queue.size() == 1)
                DoWrite();
        }

        // Called to start/continue the write-loop. Should not be called when
        // write_loop is already active.
        void DoWrite()
        {
            if (!m_response_queue.empty())
            {
                bool keep_alive = m_response_queue.front().keep_alive();

                beast::async_write(
                    GetDerived().Stream(),
                    std::move(m_response_queue.front()),
                    beast::bind_front_handler(
                        &HTTPSession::OnWrite,
                        GetDerived().shared_from_this(),
                        keep_alive));
            }
        }

        void OnWrite(bool keep_alive, beast::error_code ec, std::size_t bytes_transferred) noexcept
        {
            // Need a try-catch here so an exception doesn't escape and cause a crash
            try
            {
                boost::ignore_unused(bytes_transferred);

                if (ec)
                {
                    LOG_ERROR("[CORE] Received HTTPSession::OnWrite error: '{0}'", ec.what());
                    return;
                }

                if (!keep_alive)
                {
                    // This means we should close the connection, usually because
                    // the response indicated the "Connection: close" semantic.
                    return GetDerived().DoEOF();
                }

                // Resume the read if it has been paused
                if (m_response_queue.size() == m_queue_limit)
                    DoRead();

                m_response_queue.pop();                
            }
            catch (const boost::exception& e)
            {
                LOG_ERROR("[CORE] HTTPSession::OnWrite failure. Caught boost::exception: \n'{0}'",
                    boost::diagnostic_information(e));
            }
            catch (const std::exception& e)
            {
                LOG_ERROR("[CORE] HTTPSession::OnWrite failure. Caught std::exception: \n'{0}'", e.what());
            }
            catch (...)
            {
                LOG_ERROR("[CORE] HTTPSession::OnWrite failure. Caught unknown exception.");
            }

            DoWrite();
        }

    protected:
        ND Derived& GetDerived() noexcept { return static_cast<Derived&>(*this); }

        Application* m_application;

        static constexpr std::size_t m_queue_limit = 8; // max responses
        std::queue<http::message_generator> m_response_queue;

        // The parser is stored in an optional container so we can
        // construct it from scratch it at the beginning of each new message.
        boost::optional<http::request_parser<http::string_body>> m_parser;

        beast::flat_buffer m_buffer;

        std::string m_address;
        boost::asio::ip::port_type m_port;
    };

    // Handles a plain HTTP connection
    class PlainHTTPSession : public HTTPSession<PlainHTTPSession>, public std::enable_shared_from_this<PlainHTTPSession>
    {
    public:
        // Create the session
        PlainHTTPSession(beast::tcp_stream&& stream, beast::flat_buffer&& buffer, Application* application) noexcept :
            HTTPSession<PlainHTTPSession>(std::move(buffer), application),
            m_stream(std::move(stream))
        {}

        void Run() { DoRead(); }
        ND beast::tcp_stream& Stream() noexcept { return m_stream; }
        ND beast::tcp_stream ReleaseStream() noexcept { return std::move(m_stream); }
        void DoEOF();

    private:
        beast::tcp_stream m_stream;
    };

    // Handles an SSL HTTP connection
    class SSLHTTPSession : public HTTPSession<SSLHTTPSession>, public std::enable_shared_from_this<SSLHTTPSession>
    {
    public:
        // Create the http_session
        SSLHTTPSession(beast::tcp_stream&& stream, ssl::context& ctx, beast::flat_buffer&& buffer, Application* application) :
            HTTPSession<SSLHTTPSession>(std::move(buffer), application),
            m_stream(std::move(stream), ctx)
        {}

        // Start the session
        void Run();
        ND ssl::stream<beast::tcp_stream>& Stream() noexcept { return m_stream; }
        ND ssl::stream<beast::tcp_stream> ReleaseStream() noexcept { return std::move(m_stream); }
        void DoEOF();

    private:
        void OnHandshake(beast::error_code ec, std::size_t bytes_used);
        void OnShutdown(beast::error_code ec);

        ssl::stream<beast::tcp_stream> m_stream;
    };

    // Detects SSL handshakes
    class DetectSession : public std::enable_shared_from_this<DetectSession>
    {
    public:
        explicit DetectSession(tcp::socket&& socket, ssl::context& ctx, Application* application);

        void Run();
        void OnRun() noexcept;
        void OnDetect(beast::error_code ec, bool result) noexcept;

    private:
        beast::tcp_stream m_stream;
        ssl::context& m_ctx;
        Application* m_application;
        beast::flat_buffer m_buffer;

        std::string m_address;
        boost::asio::ip::port_type m_port;
    };

    // Accepts incoming connections and launches the sessions
    class Listener : public std::enable_shared_from_this<Listener>
    {
    public:
        Listener(net::io_context& ioc, ssl::context& ctx, tcp::endpoint endpoint, Application* application);

        void Run();

    private:
        void DoAccept() noexcept;
        void OnAccept(beast::error_code ec, tcp::socket socket) noexcept;

        net::io_context& m_ioc;
        ssl::context& m_ctx;
        tcp::acceptor m_acceptor;
        Application* m_application;
    };

}


template <>
struct std::formatter<http::verb> {
    constexpr auto parse(std::format_parse_context& ctx) const { return ctx.begin(); }

    template <typename FormatContext>
    auto format(const http::verb& v, FormatContext& ctx) const
    {
        switch (v)
        {
        case http::verb::unknown: return std::format_to(ctx.out(), "unknown");
        case http::verb::delete_: return std::format_to(ctx.out(), "delete");
        case http::verb::get: return std::format_to(ctx.out(), "get");
        case http::verb::head: return std::format_to(ctx.out(), "head");
        case http::verb::post: return std::format_to(ctx.out(), "post");
        case http::verb::put: return std::format_to(ctx.out(), "put");
        case http::verb::connect: return std::format_to(ctx.out(), "connect");
        case http::verb::options: return std::format_to(ctx.out(), "options");
        case http::verb::trace: return std::format_to(ctx.out(), "trace");
        case http::verb::copy: return std::format_to(ctx.out(), "copy");
        case http::verb::lock: return std::format_to(ctx.out(), "lock");
        case http::verb::mkcol: return std::format_to(ctx.out(), "mkcol");
        case http::verb::move: return std::format_to(ctx.out(), "move");
        case http::verb::propfind: return std::format_to(ctx.out(), "propfind");
        case http::verb::proppatch: return std::format_to(ctx.out(), "proppatch");
        case http::verb::search: return std::format_to(ctx.out(), "search");
        case http::verb::unlock: return std::format_to(ctx.out(), "unlock");
        case http::verb::bind: return std::format_to(ctx.out(), "bind");
        case http::verb::rebind: return std::format_to(ctx.out(), "rebind");
        case http::verb::unbind: return std::format_to(ctx.out(), "unbind");
        case http::verb::acl: return std::format_to(ctx.out(), "acl");
        case http::verb::report: return std::format_to(ctx.out(), "report");
        case http::verb::mkactivity: return std::format_to(ctx.out(), "mkactivity");
        case http::verb::checkout: return std::format_to(ctx.out(), "checkout");
        case http::verb::merge: return std::format_to(ctx.out(), "merge");
        case http::verb::msearch: return std::format_to(ctx.out(), "msearch");
        case http::verb::notify: return std::format_to(ctx.out(), "notify");
        case http::verb::subscribe: return std::format_to(ctx.out(), "subscribe");
        case http::verb::unsubscribe: return std::format_to(ctx.out(), "unsubscribe");
        case http::verb::patch: return std::format_to(ctx.out(), "patch");
        case http::verb::purge: return std::format_to(ctx.out(), "purge");
        case http::verb::mkcalendar: return std::format_to(ctx.out(), "mkcalendar");
        case http::verb::link: return std::format_to(ctx.out(), "link");
        case http::verb::unlink: return std::format_to(ctx.out(), "unlink");
        }
        return std::format_to(ctx.out(), "unknown");
    }
};