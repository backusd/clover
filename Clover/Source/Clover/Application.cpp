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
            this->m_application->HandleFailure(FAILURE_REASON::SSL_HTTP_SESSION_HANDSHAKE_FAILURE, ec);
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
            LOG_ERROR("[CORE] Received SSLHTTPSession::OnShutdown error: '{0}'", ec.what());
            this->m_application->HandleFailure(FAILURE_REASON::SSL_HTTP_SESSION_SHUTDOWN_FAILURE, ec);
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
            m_application->HandleFailure(FAILURE_REASON::SSL_DETECTION_FAILURE, ec);
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
            m_application->HandleFailure(FAILURE_REASON::LISTENER_ACCEPTOR_OPEN_FAILURE, ec);
            return;
        }

        // Allow address reuse
        m_acceptor.set_option(net::socket_base::reuse_address(true), ec);
        if (ec)
        {
            LOG_ERROR("[CORE] Received Listener acceptor set_option error: '{0}'", ec.what());
            m_application->HandleFailure(FAILURE_REASON::LISTENER_ACCEPTOR_SET_OPTION_FAILURE, ec);
            return;
        }

        // Bind to the server address
        m_acceptor.bind(endpoint, ec);
        if (ec)
        {
            LOG_ERROR("[CORE] Received Listener acceptor bind error: '{0}'", ec.what());
            m_application->HandleFailure(FAILURE_REASON::LISTENER_ACCEPTOR_BIND_FAILURE, ec);
            return;
        }

        // Start listening for connections
        m_acceptor.listen(net::socket_base::max_listen_connections, ec);
        if (ec)
        {
            LOG_ERROR("[CORE] Received Listener acceptor listen error: '{0}'", ec.what());
            m_application->HandleFailure(FAILURE_REASON::LISTENER_ACCEPTOR_LISTEN_FAILURE, ec);
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
            m_application->HandleFailure(FAILURE_REASON::LISTENER_ON_ACCEPT_FAILURE, ec);
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