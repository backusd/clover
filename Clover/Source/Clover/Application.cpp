#include "pch.hpp"
#include "Application.hpp"
#include "Log.hpp"

#include "server_certificate.hpp"

namespace Clover
{
    // =====================================================
    // Application
    Application::Application(std::string_view address, unsigned short port, unsigned int threads,
        const std::string& cert, const std::string& key, const std::string& dh) :
        m_ioc(threads),
        m_threads(threads),
        m_ctx{ ssl::context::tlsv12 }
    {
        assert(m_threads > 0);

        std::cout << std::filesystem::current_path() << '\n';

        // This holds the self-signed certificate used by the server
        LoadServerCertificate(cert, key, dh);

        // Create and launch a listening port
        std::make_shared<Listener>(
            m_ioc,
            m_ctx,
            tcp::endpoint{ net::ip::make_address(address), port },
            this)->Run();

        LOG_INFO("Started listening on {0}:{1}", address, port);
    }

    void Application::LoadServerCertificate(const std::string& cert, const std::string& key, const std::string& dh)
    {
        // NOTE FROM BEAST:
        //     Load a signed certificate into the ssl context, and configure
        //     the context for use with a server.
        //     
        //     For this to work with the browser or operating system, it is
        //     necessary to import the "Beast Test CA" certificate into
        //     the local certificate store, browser, or operating system
        //     depending on your environment Please see the documentation
        //     accompanying the Beast certificate for more details.

        // See here for helpful video on installing openssl on Windows: https://cloudzy.com/blog/install-openssl-on-windows/
        // The certificate was generated from openssl on Windows (OpenSSL 3.4.0) using:
        // 
        // openssl dhparam -out dh.pem 2048
        // openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 10000 -out cert.pem
        // 
        // $ openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 10000 -out cert.pem
        // ...
        // -----
        // You are about to be asked to enter information that will be incorporated
        // into your certificate request.
        // What you are about to enter is what is called a Distinguished Name or a DN.
        // There are quite a few fields but you can leave some blank
        // For some fields there will be a default value,
        // If you enter '.', the field will be left blank.
        // -----
        // Country Name (2 letter code) [AU]:US
        // State or Province Name (full name) [Some-State]:OR
        // Locality Name (eg, city) []:Portland
        // Organization Name (eg, company) [Internet Widgits Pty Ltd]:
        // Organizational Unit Name (eg, section) []:
        // Common Name (e.g. server FQDN or YOUR name) []:
        // Email Address []:            

        m_ctx.set_password_callback(
            [](std::size_t, boost::asio::ssl::context_base::password_purpose)
            {
                return "test";
            });

        m_ctx.set_options(
            boost::asio::ssl::context::default_workarounds |
            boost::asio::ssl::context::no_sslv2 |
            boost::asio::ssl::context::single_dh_use);

        boost::beast::error_code ec;

        if (!cert.empty())
        {
            m_ctx.use_certificate_chain_file(cert, ec);
            if (ec)
            {
                LOG_ERROR("[CORE] Failed to load ssl cert file '{0}': '{1}'", cert, ec.what());
                return;
            }
        }

        if (!key.empty())
        {
            m_ctx.use_private_key_file(key, boost::asio::ssl::context::file_format::pem, ec);
            if (ec)
            {
                LOG_ERROR("[CORE] Failed to load ssl private key file '{0}': '{1}'", key, ec.what());
                return;
            }
        }

        if (!dh.empty())
        {
            m_ctx.use_tmp_dh_file(dh, ec);
            if (ec)
            {
                LOG_ERROR("[CORE] Failed to load ssl dh file '{0}': '{1}'", dh, ec.what());
                return;
            }
        }
    }

    void Application::Run()
    {
        // Capture SIGINT and SIGTERM to perform a clean shutdown
        net::signal_set signals(m_ioc, SIGINT, SIGTERM);
        signals.async_wait(
            [&](beast::error_code const&, int)
            {
                LOG_INFO("Captured SIGINT or SIGTERM. Calling stop() on the io_context to kill all worker threads");

                // Stop the `io_context`. This will cause `run()`
                // to return immediately, eventually destroying the
                // `io_context` and all of the sockets in it.
                m_ioc.stop();
            });

        // Run the I/O service on the requested number of threads
        LOG_INFO("Spawning {0} worker threads", m_threads);
        std::vector<std::thread> v;
        v.reserve(m_threads - 1);
        for (auto i = m_threads - 1; i > 0; --i)
            v.emplace_back(
                [&]
                {
                    m_ioc.run();
                });
        m_ioc.run();

        // (If we get here, it means we got a SIGINT or SIGTERM)

        // Block until all the threads exit
        for (auto& t : v)
            t.join();
    }

    void Application::RegisterGETTarget(const std::string& target, DataGatherFn dataGatherFn) noexcept 
    { 
        if (m_GETTargets.find(target) != m_GETTargets.end())
            LOG_ERROR("[CORE] Cannot register GET target '{0}' because it already exists", target);
        else
            m_GETTargets.insert(std::make_pair(target, dataGatherFn)); 
    }
    void Application::RegisterPUTTarget(const std::string& target, DataGatherFn dataGatherFn) noexcept 
    { 
        if (m_PUTTargets.find(target) != m_PUTTargets.end())
            LOG_ERROR("[CORE] Cannot register PUT target '{0}' because it already exists", target);
        else
            m_PUTTargets.insert(std::make_pair(target, dataGatherFn));
    }
    void Application::RegisterPOSTTarget(const std::string& target, DataGatherFn dataGatherFn) noexcept 
    { 
        if (m_POSTTargets.find(target) != m_POSTTargets.end())
            LOG_ERROR("[CORE] Cannot register POST target '{0}' because it already exists", target);
        else
            m_POSTTargets.insert(std::make_pair(target, dataGatherFn));
    }

    http::message_generator Application::HandleHTTPRequest(HTTPRequestType req)
    {
        switch (req.method())
        {
        case http::verb::head:
        case http::verb::get:  return HandleHTTPGETRequest(req);
        case http::verb::put:  return HandleHTTPPUTRequest(req);
        case http::verb::post: return HandleHTTPPOSTRequest(req);
        }

        return BadRequest(std::format("Not currently handling request method: '{0}'", req.method()), req);
    }

    http::message_generator Application::HandleHTTPGETRequest(HTTPRequestType& req)
    {
        // Example: ...com/user/home?id=1234&query=some-string
        //      target = "/user/home"
        //      parameters = { "id" = "1234", "query" = "some-string" }
        auto [target, parameters] = ParseTarget(req.target());

        LOG_TRACE("[CORE] Received GET request for '{0}'", std::string_view(req.target()));
        LOG_TRACE("[CORE] Determined target to be: '{0}'", target);
        LOG_TRACE("[CORE] Determined params  to be:");
        for (const auto& [key, value] : parameters)
            LOG_TRACE("[CORE]     '{0}': '{1}'", key, value);

        // if the target has either no file extension or the extension is .html, then
        // it will be treated an html request. Otherwise, we will assume the request is
        // for another type of file (.css, .js, .png, etc)
        if (IsTargetHTML(target))
        {
            LOG_TRACE("[CORE] Determined target '{0}' IS an HTML request", target);

            // GenerateHTMLResponse will work in 2 steps:
            //  1. It will call GatherRequestData to gather all necessary data to stamp out
            //     the html template. This is also where any functions registered via
            //     RegisterTarget will be called.
            //  2. It will call GenerateHTML to stamp out the html template into a string 
            //     that will then make up the response body
            return GenerateHTMLResponse(target, parameters, req);
        }

        LOG_TRACE("[CORE] Determined target '{0}' IS NOT an HTML request", target);

        // Not an html request, so we will assume we are just serving a whole file
        //
        // In this case, it doesn't make sense for there to be any parameters, so let's
        // warn if there are any
        if (!parameters.empty())
        {
            LOG_WARN("[CORE] A request for '{0}' had parameters, but this is not an html request, so parameters are being ignored", req.target());
        }

        // The target will be treated as a file. If it doesn't exist, a 404 response will be returned
        return ServeFile(target, req);
    }
    http::message_generator Application::HandleHTTPPUTRequest(HTTPRequestType& req)
    {
        http::response<http::string_body> res{ http::status::ok, req.version() };
        res.set(http::field::server, m_serverVersion);
        res.set(http::field::content_type, "text/html"); 
        res.keep_alive(req.keep_alive()); 
        res.body() = "Not currently handling PUT requests";
        res.prepare_payload();
        return res;
    }
    http::message_generator Application::HandleHTTPPOSTRequest(HTTPRequestType& req)
    {
        http::response<http::string_body> res{ http::status::ok, req.version() };
        res.set(http::field::server, m_serverVersion);
        res.set(http::field::content_type, "text/html");
        res.keep_alive(req.keep_alive());
        res.body() = "Not currently handling POST requests";
        res.prepare_payload();
        return res;
    }

    std::pair<std::string_view, Application::ParametersMap> Application::ParseTarget(std::string_view target)
    {
        std::pair<std::string_view, Application::ParametersMap> result;
        
        size_t pos = target.find('?');
        if (pos == std::string::npos) 
        {
            result.first = target;
        }
        else 
        {
            result.first = std::string_view(target.data(), pos); // Return substring up to the delimiter

            // parse the parameters into json
            size_t keyPos = pos + 1;
            size_t equalsPos, ampPos;

            // We are going to progress the key position until we go beyond the string_view
            while (keyPos < target.size())
            {
                equalsPos = target.find('=', keyPos);
                ampPos = target.find('&', keyPos);

                std::string_view key, value;

                // If no '=' was found or it was found after the '&' then this is an error. However, we want to 
                // try to recover as much as possible, so if there is still a '&', we will just continue like normal
                if (equalsPos > ampPos || equalsPos == std::string::npos)
                {
                    // If there are no more '&', then just log an error message and break
                    if (ampPos == std::string::npos)
                    {
                        LOG_WARN("[CORE] Parsing parameters failed because there is no '=' for key '{0}': '{1}", target.substr(keyPos), target);
                        break;
                    }

                    // If there are remaining '&', then log an error, but continue like normal
                    key = target.substr(keyPos, ampPos - keyPos);
                    LOG_WARN("[CORE] Parsing parameters failed because there is no '=' for key '{0}': '{1}", key, target);

                    keyPos = ampPos + 1;
                    continue;
                }

                key = target.substr(keyPos, equalsPos - keyPos);

                // If there are no more '&', then just go to the end of the string_view
                if (ampPos == std::string::npos)
                    value = target.substr(equalsPos + 1);
                else
                    value = target.substr(equalsPos + 1, ampPos - equalsPos - 1);

                // Check if this key was already added
                if (result.second.contains(key))
                    LOG_WARN("[CORE] Parsing parameters failed because this is the second time the key '{0}' was found. Skipping second occurrence. Parameters: {1}", key, target);
                else
                    result.second[key] = value;                

                // If there are no more '&', then we are done
                if (ampPos == std::string::npos)
                    break;

                // Increment the key position to what it would be if it exists
                keyPos = ampPos + 1;
            }
        }

        return result;
    }
    bool Application::IsTargetHTML(std::string_view target)
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
    json Application::GatherRequestData(std::string_view target, const Application::ParametersMap& urlParams)
    {
        // Call user-supplied callbacks
        auto itr = m_GETTargets.find(target);
        if (itr == m_GETTargets.end())
        {
            LOG_TRACE("[CORE] GatherRequestData: No user defined data gathering function for target: '{0}'", target);
            return {};
        }

        LOG_TRACE("[CORE] GatherRequestData: Calling user defined data gathering function for target: '{0}'", target);
        return itr->second(urlParams);
    }
    std::string Application::GenerateHTML(const std::string& file, const json& data)
    {
        // We have already done a check to ensure the file exists
        std::ifstream fileStream(file);

        std::string content{
            std::istreambuf_iterator<char>(fileStream),
            std::istreambuf_iterator<char>() };









        return content;
    }
    http::message_generator Application::GenerateHTMLResponse(std::string_view target, const Application::ParametersMap& urlParams, HTTPRequestType& req)
    {
        // If the target does not already end in ".html", then we want to add it
        std::string file(target);
        if (!file.ends_with(".html"))
            file += ".html";

        // Strip any leading '/' (We already ensure the document root ends with '/')
        if (file.starts_with('/'))
            file = file.erase(0, 1);

        // Prepend the document root path
        file.insert(0, m_docRoot);

        LOG_TRACE("[CORE] GenerateHTMLResponse: Converted target to file: '{0}' -> '{1}'", target, file);

        // If the file does not exist, then return 404
        if (!std::filesystem::exists(file))
        {
            LOG_TRACE("[CORE] GenerateHTMLResponse: File not found: '{0}'", file);
            return FileNotFound(target, req);
        }

        // Gather all data that will be used to fulfill the request to generate the necessary html
        json d = GatherRequestData(target, urlParams);

        LOG_TRACE("[CORE] GenerateHTMLResponse: Received data for target '{0}': \n{1}", target, d.dump(4));

        // Generate the html to be rendered
        std::string html = GenerateHTML(file, d);

        http::response<http::string_body> res{ http::status::ok, req.version() };
        res.set(http::field::server, m_serverVersion);
        res.set(http::field::content_type, "text/html");
        res.keep_alive(req.keep_alive());
        res.body() = html;
        res.prepare_payload();
        return res;
    }
    http::message_generator Application::ServeFile(std::string_view target, HTTPRequestType& req)
    {
        // Attempt to open the file
        beast::error_code ec;
        http::file_body::value_type body;
        body.open(target.data(), beast::file_mode::scan, ec);

        // Handle the case where the file doesn't exist
        if (ec == beast::errc::no_such_file_or_directory)
            return FileNotFound(target, req);

        // Handle an unknown error
        if (ec)
            return InternalServerError(ec.message(), req);

        // Cache the size since we need it after the move
        auto const size = body.size();

        // Respond to HEAD request
        if (req.method() == http::verb::head)
        {
            http::response<http::empty_body> res{ http::status::ok, req.version() };
            res.set(http::field::server, m_serverVersion);
            res.set(http::field::content_type, MimeType(target));
            res.content_length(size);
            res.keep_alive(req.keep_alive());
            return res;
        }

        // Respond to GET request
        http::response<http::file_body> res{
            std::piecewise_construct,
            std::make_tuple(std::move(body)),
            std::make_tuple(http::status::ok, req.version()) };
        res.set(http::field::server, m_serverVersion);
        res.set(http::field::content_type, MimeType(target));
        res.content_length(size);
        res.keep_alive(req.keep_alive());
        return res;
    }
    http::message_generator Application::BadRequest(std::string_view reason, HTTPRequestType& req)
    {
        http::response<http::string_body> res{ http::status::bad_request, req.version() };
        res.set(http::field::server, m_serverVersion);
        res.set(http::field::content_type, "text/html");
        res.keep_alive(req.keep_alive());
        res.body() = reason;
        res.prepare_payload();
        return res;
    }
    http::message_generator Application::FileNotFound(std::string_view target, HTTPRequestType& req)
    {
        http::response<http::string_body> res{ http::status::not_found, req.version() };
        res.set(http::field::server, m_serverVersion);
        res.set(http::field::content_type, "text/html");
        res.keep_alive(req.keep_alive());
        res.body() = "The resource '" + std::string(target) + "' was not found.";
        res.prepare_payload();
        return res;
    }
    http::message_generator Application::InternalServerError(std::string_view reason, HTTPRequestType& req)
    {
        http::response<http::string_body> res{ http::status::internal_server_error, req.version() };
        res.set(http::field::server, m_serverVersion);
        res.set(http::field::content_type, "text/html");
        res.keep_alive(req.keep_alive());
        res.body() = "An error occurred: '" + std::string(reason) + "'";
        res.prepare_payload();
        return res;
    }

    std::string_view Application::MimeType(std::string_view path)
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

    // =====================================================
    // PlainHTTPSession
    void PlainHTTPSession::DoEOF()
    {
        // Send a TCP shutdown
        beast::error_code ec;
        m_stream.socket().shutdown(tcp::socket::shutdown_send, ec);

        if (ec)
        {
            LOG_ERROR("PlainHTTPSession socket shutdown for {0}:{1} found error: {2}",
                this->m_address, this->m_port, ec.what());
        }

        // At this point the connection is closed gracefully
    }

    // =====================================================
    // SSLHTTPSession
    void SSLHTTPSession::Run()
    {
        // Set the timeout.
        beast::get_lowest_layer(m_stream).expires_after(std::chrono::seconds(30));

        // Perform the SSL handshake
        // Note, this is the buffered version of the handshake.
        m_stream.async_handshake(
            ssl::stream_base::server,
            this->m_buffer.data(),
            beast::bind_front_handler(
                &SSLHTTPSession::OnHandshake,
                this->shared_from_this()));
    }

    void SSLHTTPSession::DoEOF()
    {
        // Set the timeout.
        beast::get_lowest_layer(m_stream).expires_after(std::chrono::seconds(30));

        // Perform the SSL shutdown
        m_stream.async_shutdown(
            beast::bind_front_handler(
                &SSLHTTPSession::OnShutdown,
                this->shared_from_this()));
    }

    void SSLHTTPSession::OnHandshake(beast::error_code ec, std::size_t bytes_used)
    {
        if (ec)
        {
            LOG_ERROR("[CORE] Received SSLHTTPSession::OnHandshake error: '{0}'", ec.what());
            return;
        }

        // Consume the portion of the buffer used by the handshake
        this->m_buffer.consume(bytes_used);

        this->DoRead();
    }

    void SSLHTTPSession::OnShutdown(beast::error_code ec)
    {
        if (ec)
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

            LOG_ERROR("[CORE] Received SSLHTTPSession::OnShutdown error: '{0}'", ec.what());
            return;
        }

        // At this point the connection is closed gracefully
    }

    // =====================================================
    // DetectSession
    DetectSession::DetectSession(tcp::socket&& socket, ssl::context& ctx, Application* application) :
        m_stream(std::move(socket)),
        m_ctx(ctx),
        m_application(application)
    {
        m_address = m_stream.socket().remote_endpoint().address().to_string();
        m_port = m_stream.socket().remote_endpoint().port();
    }

    // Launch the detector
    void DetectSession::Run()
    {
        // We need to be executing within a strand to perform async operations
        // on the I/O objects in this session. Although not strictly necessary
        // for single-threaded contexts, this example code is written to be
        // thread-safe by default.
        net::dispatch(
            m_stream.get_executor(),
            beast::bind_front_handler(
                &DetectSession::OnRun,
                this->shared_from_this()));
    }

    void DetectSession::OnRun()
    {
        // Set the timeout.
        m_stream.expires_after(std::chrono::seconds(30));

        beast::async_detect_ssl(
            m_stream,
            m_buffer,
            beast::bind_front_handler(
                &DetectSession::OnDetect,
                this->shared_from_this()));
    }

    void DetectSession::OnDetect(beast::error_code ec, bool result)
    {
        if (ec)
        {
            // I'm not sure if this a Chrome thing, or maybe its all browsers, but if I make a simple GET request via the browser, 
            // 1 or 2 requests will be triggered. The first one makes it all the way to creating an HTTP session and will
            // get a response from the request. The others seem to get stuck in this on_detect section, and I'm guessing its
            // because the browser initiated the connection, but then realized it doesn't need the connection, so it then
            // abandoned sending whatever data it needed to in order to actually complete making the request.
            if (ec == beast::error::timeout)
            {
                LOG_TRACE("Attempting to detect session type for connection from {0}:{1} failed because the socket was closed due to a timeout", m_address, m_port);
                return;
            }

            LOG_ERROR("[CORE] Received DetectSession::OnDetect error: '{0}'", ec.what());
            return;
        }

        if (result)
        {
            LOG_TRACE("Incoming connection is SSL enabled. Attempting to start SSLHTTPSession...");

            // Launch SSL session
            std::make_shared<SSLHTTPSession>(
                std::move(m_stream),
                m_ctx,
                std::move(m_buffer),
                m_application)->Run();
            return;
        }

        LOG_TRACE("Incoming connection is not SSL enabled. Attempting to start HTTPSession...");

        // Launch plain session
        std::make_shared<PlainHTTPSession>(
            std::move(m_stream),
            std::move(m_buffer),
            m_application)->Run();
    }


    // =====================================================
    // Listener

    Listener::Listener(net::io_context& ioc, ssl::context& ctx, tcp::endpoint endpoint, Application* application) :
        m_ioc(ioc),
        m_ctx(ctx),
        m_acceptor(net::make_strand(ioc)),
        m_application(application)
    {
        assert(m_application != nullptr);

        beast::error_code ec;

        // Open the acceptor
        m_acceptor.open(endpoint.protocol(), ec);
        if (ec)
        {
            LOG_ERROR("[CORE] Received Listener acceptor open error: '{0}'", ec.what());
            return;
        }

        // Allow address reuse
        m_acceptor.set_option(net::socket_base::reuse_address(true), ec);
        if (ec)
        {
            LOG_ERROR("[CORE] Received Listener acceptor set_option error: '{0}'", ec.what());
            return;
        }

        // Bind to the server address
        m_acceptor.bind(endpoint, ec);
        if (ec)
        {
            LOG_ERROR("[CORE] Received Listener acceptor bind error: '{0}'", ec.what());
            return;
        }

        // Start listening for connections
        m_acceptor.listen(net::socket_base::max_listen_connections, ec);
        if (ec)
        {
            LOG_ERROR("[CORE] Received Listener acceptor listen error: '{0}'", ec.what());
            return;
        }
    }

    // Start accepting incoming connections
    void Listener::Run()
    {
        DoAccept();
    }

    void Listener::DoAccept()
    {
        // The new connection gets its own strand
        m_acceptor.async_accept(
            net::make_strand(m_ioc),
            beast::bind_front_handler(
                &Listener::OnAccept,
                this->shared_from_this()));
    }

    void Listener::OnAccept(beast::error_code ec, tcp::socket socket)
    {
        if (ec)
        {
            LOG_ERROR("[CORE] Received Listener::on_accept error: '{0}'", ec.what());
        }
        else
        {
            LOG_TRACE("Attempting to accept incoming connection from {0}:{1}...",
                socket.remote_endpoint().address().to_string(),
                socket.remote_endpoint().port());

            // Create the detector http_session and run it
            std::make_shared<DetectSession>(
                std::move(socket),
                m_ctx,
                m_application)->Run();
        }

        // Accept another connection
        DoAccept();
    }
}