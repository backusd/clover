#pragma once
#include "pch.hpp"
#include "Log.hpp"

#include "server_certificate.hpp"

#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/beast/websocket/ssl.hpp>
#include <boost/beast/version.hpp>
#include <boost/asio/bind_executor.hpp>
#include <boost/asio/dispatch.hpp>
#include <boost/asio/signal_set.hpp>
#include <boost/asio/ssl.hpp>
#include <boost/asio/strand.hpp>
#include <boost/make_unique.hpp>
#include <boost/optional.hpp>

namespace beast = boost::beast;                 // from <boost/beast.hpp>
namespace http = beast::http;                   // from <boost/beast/http.hpp>
namespace websocket = beast::websocket;         // from <boost/beast/websocket.hpp>
namespace net = boost::asio;                    // from <boost/asio.hpp>
namespace ssl = boost::asio::ssl;               // from <boost/asio/ssl.hpp>
using tcp = boost::asio::ip::tcp;               // from <boost/asio/ip/tcp.hpp>

enum class FAILURE_REASON
{
    LISTENER_ACCEPTOR_OPEN_FAILURE,
    LISTENER_ACCEPTOR_SET_OPTION_FAILURE,
    LISTENER_ACCEPTOR_BIND_FAILURE,
    LISTENER_ACCEPTOR_LISTEN_FAILURE,
    LISTENER_ON_ACCEPT_FAILURE,
    HTTP_SESSION_ON_READ_FAILURE,
    HTTP_SESSION_ON_WRITE_FAILURE,
    SSL_DETECTION_FAILURE,
    SSL_HTTP_SESSION_HANDSHAKE_FAILURE,
    SSL_HTTP_SESSION_SHUTDOWN_FAILURE,
    WEBSOCKET_ON_ACCEPT_FAILURE,
    WEBSOCKET_READ_FAILURE,
    WEBSOCKET_WRITE_FAILURE,
};

template<typename Derived>
class Application
{
public:
    // Echoes back all received WebSocket messages.
    // This uses the Curiously Recurring Template Pattern so that
    // the same code works with both SSL streams and regular sockets.
    template<class DerivedSession>
    class websocket_session
    {
    public:
        websocket_session(Application<Derived>* application) :
            m_application(application)
        {
        }

        // Start the asynchronous operation
        template<class Body, class Allocator>
        void run(http::request<Body, http::basic_fields<Allocator>> req)
        {
            // Accept the WebSocket upgrade request
            do_accept(std::move(req));
        }

        void send(std::shared_ptr<std::string const> const& ss)
        {
            // Post our work to the strand, this ensures that the members of `this` will not be accessed concurrently.
            net::post(
                derived().ws().get_executor(),
                beast::bind_front_handler(
                    &websocket_session::on_send,
                    derived().shared_from_this(),
                    ss));
        }

    private:
        DerivedSession& derived()
        {
            return static_cast<DerivedSession&>(*this);
        }

        // Start the asynchronous operation
        template<class Body, class Allocator>
        void do_accept(http::request<Body, http::basic_fields<Allocator>> req)
        {
            // Set suggested timeout settings for the websocket
            derived().ws().set_option(
                websocket::stream_base::timeout::suggested(beast::role_type::server));

            // Set a decorator to change the Server of the handshake
            derived().ws().set_option(
                websocket::stream_base::decorator(
                    [](websocket::response_type& res)
                    {
                        res.set(http::field::server,
                            std::string(BOOST_BEAST_VERSION_STRING) +
                            " advanced-server-flex");
                    }));

            // Accept the websocket handshake
            derived().ws().async_accept(
                req,
                beast::bind_front_handler(
                    &websocket_session::on_accept,
                    derived().shared_from_this()));
        }

        void on_accept(beast::error_code ec)
        {
            if (ec)
            {
                LOG_ERROR("[CORE] Received websocket_session::on_accept error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::WEBSOCKET_ON_ACCEPT_FAILURE, ec);
                return;
            }

            // Inform the application that this session exists
            derived().WebsocketSessionJoin();

            // Read a message
            do_read();
        }

        void do_read()
        {
            // Read a message into our buffer
            derived().ws().async_read(
                m_buffer,
                beast::bind_front_handler(
                    &websocket_session::on_read,
                    derived().shared_from_this()));
        }

        void on_read(beast::error_code ec, std::size_t bytes_transferred)
        {
            boost::ignore_unused(bytes_transferred);

            if (ec)
            {
                // This indicates that the websocket_session was closed
                if (ec == websocket::error::closed)
                    return;

                // If the webpage forgets to gracefully shutdown the websocket connection, we will get one of these two error codes
                int val = ec.value();
                if (val == 10053 || val == 10054)
                {
                    LOG_WARN("[CORE] Received websocket_session::on_read error: '{0}'", ec.what());
                    LOG_WARN("[CORE] This error occurs when the websocket was not correctly closed, likely due to closing the webpage");
                    LOG_WARN("[CORE] Please be sure to include the following javascript in the webpage:\n\twindow.addEventListener('beforeunload', () =>\n\t{\n\t\tif (ws.readyState === WebSocket.OPEN)\n\t\t{\n\t\t\tws.close();\n\t\t}\n\t});");
                    return;
                }

                LOG_ERROR("[CORE] Received websocket_session::on_read error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::WEBSOCKET_READ_FAILURE, ec);
                return;
            }

            // Send the data to the application as either string or binary data depending on what was sent
            if (derived().ws().got_text())
            {
                // Incoming data was a string, so convert the buffer to a string and send that to the application
                derived().HandleWebsocketData(beast::buffers_to_string(m_buffer.data()));
            }
            else
            {
                // Incoming data was binary data, so send a void* and size to the application which must interpret it
                auto buf = m_buffer.data();
                derived().HandleWebsocketData(buf.data(), buf.size());
            }    

            // Clear the buffer
            m_buffer.consume(m_buffer.size());

            // Continue the loop by trying to read another message
            do_read();
        }

        void on_send(std::shared_ptr<std::string const> const& ss)
        {
            // Always add to queue
            m_queue.push_back(ss);

            // Are we already writing?
            if (m_queue.size() > 1)
                return;

            // We are not currently writing, so send this immediately
            derived().ws().async_write(
                net::buffer(*m_queue.front()),
                beast::bind_front_handler(
                    &websocket_session::on_write,
                    derived().shared_from_this()));
        }

        void on_write(beast::error_code ec, std::size_t)
        {
            // Handle the error, if any
            if (ec)
            {
                LOG_ERROR("[CORE] Received websocket_session::on_write error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::WEBSOCKET_WRITE_FAILURE, ec);
                return;
            }

            // Remove the string from the queue
            m_queue.erase(m_queue.begin());

            // Send the next message if any
            if (!m_queue.empty())
                derived().ws().async_write(
                    net::buffer(*m_queue.front()),
                    beast::bind_front_handler(
                        &websocket_session::on_write,
                        derived().shared_from_this()));
        }


    protected:
        beast::flat_buffer m_buffer;
        Application<Derived>* m_application;
        std::vector<std::shared_ptr<std::string const>> m_queue;
    };

    // Handles a plain WebSocket connection
    class plain_websocket_session : public websocket_session<plain_websocket_session>, public std::enable_shared_from_this<plain_websocket_session>
    {
    public:
        // Create the session
        explicit plain_websocket_session(beast::tcp_stream&& stream, Application<Derived>* application) :
            websocket_session<plain_websocket_session>(application),
            m_ws(std::move(stream))
        {}
        ~plain_websocket_session()
        {
            // Remove this session from the list of active sessions
            this->m_application->WebsocketSessionLeave(this);
        }
        void WebsocketSessionJoin()
        {
            this->m_application->WebsocketSessionJoin(this);
        }
        void HandleWebsocketData(std::string&& data)
        {
            this->m_application->HandleWebsocketData(this, std::move(data));
        }
        void HandleWebsocketData(void* data, size_t bytes)
        {
            this->m_application->HandleWebsocketData(this, data, bytes);
        }

        // Called by the base class
        websocket::stream<beast::tcp_stream>& ws()
        {
            return m_ws;
        }

    private:
        websocket::stream<beast::tcp_stream> m_ws;
    };

    // Handles an SSL WebSocket connection
    class ssl_websocket_session : public websocket_session<ssl_websocket_session>, public std::enable_shared_from_this<ssl_websocket_session>
    {
    public:
        // Create the ssl_websocket_session
        explicit ssl_websocket_session(ssl::stream<beast::tcp_stream>&& stream, Application<Derived>* application) :
            websocket_session<ssl_websocket_session>(application),
            m_ws(std::move(stream))
        {
        }
        ~ssl_websocket_session()
        {
            // Remove this session from the list of active sessions
            this->m_application->WebsocketSessionLeave(this);
        }
        void WebsocketSessionJoin()
        {
            this->m_application->WebsocketSessionJoin(this);
        }
        void HandleWebsocketData(std::string&& data)
        {
            this->m_application->HandleWebsocketData(this, std::move(data));
        }
        void HandleWebsocketData(void* data, size_t bytes)
        {
            this->m_application->HandleWebsocketData(this, data, bytes);
        }

        // Called by the base class
        websocket::stream<ssl::stream<beast::tcp_stream>>& ws()
        {
            return m_ws;
        }

    private:
        websocket::stream<ssl::stream<beast::tcp_stream>> m_ws;
    };

private:
    template<class Body, class Allocator>
    void make_websocket_session(beast::tcp_stream stream, http::request<Body, http::basic_fields<Allocator>> req, Application<Derived>* application)
    {
        std::make_shared<plain_websocket_session>(std::move(stream), application)->run(std::move(req));
    }

    template<class Body, class Allocator>
    void make_websocket_session(ssl::stream<beast::tcp_stream> stream, http::request<Body, http::basic_fields<Allocator>> req, Application<Derived>* application)
    {
        std::make_shared<ssl_websocket_session>(std::move(stream), application)->run(std::move(req));
    }

    // Handles an HTTP server connection.
    // This uses the Curiously Recurring Template Pattern so that
    // the same code works with both SSL streams and regular sockets.
    template<class DerivedSession>
    class http_session
    {
    public:
        // Construct the session
        http_session(beast::flat_buffer buffer, Application<Derived>* application) :
            m_application(application),
            m_buffer(std::move(buffer))
        {
            assert(m_application != nullptr);
        }

        void do_read()
        {
            // Keep track of the address and port. This must be done here and not in the constructor because
            // the stream is not initialized until the constructor in the derived class completes
            auto remote_endpoint = beast::get_lowest_layer(derived().stream()).socket().remote_endpoint();
            m_address = remote_endpoint.address().to_string();
            m_port = remote_endpoint.port();

            // Construct a new parser for each message
            m_parser.emplace();

            // Apply a reasonable limit to the allowed size
            // of the body in bytes to prevent abuse.
            m_parser->body_limit(10000);

            // Set the timeout.
            beast::get_lowest_layer(derived().stream()).expires_after(std::chrono::seconds(30));

            // Read a request using the parser-oriented interface
            http::async_read(
                derived().stream(),
                m_buffer,
                *m_parser,
                beast::bind_front_handler(
                    &http_session::on_read,
                    derived().shared_from_this()));
        }

        void on_read(beast::error_code ec, std::size_t bytes_transferred)
        {
            boost::ignore_unused(bytes_transferred);

            if (ec)
            {
                // This means they closed the connection
                if (ec == http::error::end_of_stream)
                    return derived().do_eof();

                // Because at the end of each read, we attempt to make another read, we will always find ourselves
                // waiting. However, if there is no more data, then eventually we will hit the socket timeout, in which 
                // case we can just be done.
                // NOTE: Do NOT call do_eof() because that will call shutdown() on the socket, which is not valid because
                //       we have already reached a timeout
                if (ec == beast::error::timeout)
                    return;
                
                LOG_ERROR("[CORE] Received http_session::on_read error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::HTTP_SESSION_ON_READ_FAILURE, ec);
                return;
            }

            // See if it is a WebSocket Upgrade
            if (websocket::is_upgrade(m_parser->get()))
            {
                // Disable the timeout.
                // The websocket::stream uses its own timeout settings.
                beast::get_lowest_layer(derived().stream()).expires_never();

                // Create a websocket session, transferring ownership
                // of both the socket and the HTTP request.
                return m_application->make_websocket_session(
                    derived().release_stream(),
                    m_parser->release(),
                    m_application);
            }

            LOG_INFO("Received http request from {0}:{1} -> {2} {3}", m_address, m_port, (std::string)m_parser->get().method_string(), (std::string)m_parser->get().target());
            LOG_TRACE("\tVerb      : {0}", (std::string)m_parser->get().method_string()); 
            LOG_TRACE("\tTarget    : {0}", (std::string)m_parser->get().target());
            LOG_TRACE("\tKeep Alive: {0}", m_parser->get().keep_alive() ? "true" : "false");
            for (auto itr = m_parser->get().base().cbegin(); itr != m_parser->get().base().cend(); itr = itr->next_)
                LOG_TRACE("\t{0}: {1}", (std::string)itr->name_string(), (std::string)itr->value());
            LOG_TRACE("\tBody      : {0}\n", (std::string)m_parser->get().body());

            // Send the response
            queue_write(m_application->HandleRequest(m_parser->release()));

            // If we aren't at the queue limit, try to pipeline another request
            if (m_response_queue.size() < m_queue_limit)
                do_read();
        }

        void queue_write(http::message_generator response)
        {
            // Allocate and store the work
            m_response_queue.push(std::move(response));

            // If there was no previous work, start the write loop
            if (m_response_queue.size() == 1)
                do_write();
        }

        // Called to start/continue the write-loop. Should not be called when
        // write_loop is already active.
        void do_write()
        {
            if (!m_response_queue.empty())
            {
                bool keep_alive = m_response_queue.front().keep_alive();

                beast::async_write(
                    derived().stream(),
                    std::move(m_response_queue.front()),
                    beast::bind_front_handler(
                        &http_session::on_write,
                        derived().shared_from_this(),
                        keep_alive));
            }
        }

        void on_write(bool keep_alive, beast::error_code ec, std::size_t bytes_transferred)
        {
            boost::ignore_unused(bytes_transferred);

            if (ec)
            {
                LOG_ERROR("[CORE] Received http_session::on_write error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::HTTP_SESSION_ON_WRITE_FAILURE, ec);
                return;
            }

            if (!keep_alive)
            {
                // This means we should close the connection, usually because
                // the response indicated the "Connection: close" semantic.
                return derived().do_eof();
            }

            // Resume the read if it has been paused
            if (m_response_queue.size() == m_queue_limit)
                do_read();

            m_response_queue.pop();

            do_write();
        }

    protected:
        DerivedSession& derived()
        {
            return static_cast<DerivedSession&>(*this);
        }

        Application<Derived>* m_application;

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
    class plain_http_session : public http_session<plain_http_session>, public std::enable_shared_from_this<plain_http_session>
    {
    public:
        // Create the session
        plain_http_session(beast::tcp_stream&& stream, beast::flat_buffer&& buffer, Application<Derived>* application) :
            http_session<plain_http_session>(std::move(buffer), application),
            m_stream(std::move(stream))
        {
        }

        // Start the session
        void run()
        {
            this->do_read();
        }

        // Called by the base class
        beast::tcp_stream& stream()
        {
            return m_stream;
        }

        // Called by the base class
        beast::tcp_stream release_stream()
        {
            return std::move(m_stream);
        }

        // Called by the base class
        void do_eof()
        {
            // Send a TCP shutdown
            beast::error_code ec;
            m_stream.socket().shutdown(tcp::socket::shutdown_send, ec);

            if (ec)
            {
                LOG_ERROR("plain_http_session socket shutdown for {0}:{1} found error: {2}",
                    this->m_address, this->m_port, ec.what());
            }

            // At this point the connection is closed gracefully
        }

    private:
        beast::tcp_stream m_stream;
    };

    // Handles an SSL HTTP connection
    class ssl_http_session : public http_session<ssl_http_session>, public std::enable_shared_from_this<ssl_http_session>
    {
    public:
        // Create the http_session
        ssl_http_session(beast::tcp_stream&& stream, ssl::context& ctx, beast::flat_buffer&& buffer, Application<Derived>* application) :
            http_session<ssl_http_session>(std::move(buffer), application),
            m_stream(std::move(stream), ctx)
        {
        }

        // Start the session
        void run()
        {
            // Set the timeout.
            beast::get_lowest_layer(m_stream).expires_after(std::chrono::seconds(30));

            // Perform the SSL handshake
            // Note, this is the buffered version of the handshake.
            m_stream.async_handshake(
                ssl::stream_base::server,
                this->m_buffer.data(),
                beast::bind_front_handler(
                    &ssl_http_session::on_handshake,
                    this->shared_from_this()));
        }

        // Called by the base class
        ssl::stream<beast::tcp_stream>& stream()
        {
            return m_stream;
        }

        // Called by the base class
        ssl::stream<beast::tcp_stream> release_stream()
        {
            return std::move(m_stream);
        }

        // Called by the base class
        void do_eof()
        {
            // Set the timeout.
            beast::get_lowest_layer(m_stream).expires_after(std::chrono::seconds(30));

            // Perform the SSL shutdown
            m_stream.async_shutdown(
                beast::bind_front_handler(
                    &ssl_http_session::on_shutdown,
                    this->shared_from_this()));
        }

    private:
        void on_handshake(beast::error_code ec, std::size_t bytes_used)
        {
            if (ec)
            {
                LOG_ERROR("[CORE] Received ssl_http_session::on_handshake error: '{0}'", ec.what());
                this->m_application->HandleFailure(FAILURE_REASON::SSL_HTTP_SESSION_HANDSHAKE_FAILURE, ec);
                return;
            }

            // Consume the portion of the buffer used by the handshake
            this->m_buffer.consume(bytes_used);

            this->do_read();
        }

        void on_shutdown(beast::error_code ec)
        {
            if (ec)
            {
                LOG_ERROR("[CORE] Received ssl_http_session::on_shutdown error: '{0}'", ec.what());
                this->m_application->HandleFailure(FAILURE_REASON::SSL_HTTP_SESSION_SHUTDOWN_FAILURE, ec);
                return;
            }

            // At this point the connection is closed gracefully
        }

        ssl::stream<beast::tcp_stream> m_stream;
    };

    // Detects SSL handshakes
    class detect_session : public std::enable_shared_from_this<detect_session>
    {
    public:
        explicit detect_session(tcp::socket&& socket, ssl::context& ctx, Application<Derived>* application) :
            m_stream(std::move(socket)),
            m_ctx(ctx),
            m_application(application)
        {
            m_address = m_stream.socket().remote_endpoint().address().to_string();
            m_port = m_stream.socket().remote_endpoint().port();
        }

        // Launch the detector
        void run()
        {
            // We need to be executing within a strand to perform async operations
            // on the I/O objects in this session. Although not strictly necessary
            // for single-threaded contexts, this example code is written to be
            // thread-safe by default.
            net::dispatch(
                m_stream.get_executor(),
                beast::bind_front_handler(
                    &detect_session::on_run,
                    this->shared_from_this()));
        }

        void on_run()
        {
            // Set the timeout.
            m_stream.expires_after(std::chrono::seconds(30));

            beast::async_detect_ssl(
                m_stream,
                m_buffer,
                beast::bind_front_handler(
                    &detect_session::on_detect,
                    this->shared_from_this()));
        }

        void on_detect(beast::error_code ec, bool result)
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

                LOG_ERROR("[CORE] Received detect_session::on_detect error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::SSL_DETECTION_FAILURE, ec);
                return;
            }

            if (result)
            {
                LOG_TRACE("Incoming connection is SSL enabled. Attempting to start ssl_http_session...");

                // Launch SSL session
                std::make_shared<ssl_http_session>(
                    std::move(m_stream),
                    m_ctx,
                    std::move(m_buffer),
                    m_application)->run();
                return;
            }

            LOG_TRACE("Incoming connection is not SSL enabled. Attempting to start plain_http_session...");

            // Launch plain session
            std::make_shared<plain_http_session>(
                std::move(m_stream),
                std::move(m_buffer),
                m_application)->run();
        }

    private:
        beast::tcp_stream m_stream;
        ssl::context& m_ctx;
        Application<Derived>* m_application;
        beast::flat_buffer m_buffer;

        std::string m_address;
        boost::asio::ip::port_type m_port;
    };

    // Accepts incoming connections and launches the sessions
    class listener : public std::enable_shared_from_this<listener>
    {
    public:
        listener(net::io_context& ioc, ssl::context& ctx, tcp::endpoint endpoint, Application<Derived>* application) :
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
                LOG_ERROR("[CORE] Received listener acceptor open error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::LISTENER_ACCEPTOR_OPEN_FAILURE, ec);
                return;
            }

            // Allow address reuse
            m_acceptor.set_option(net::socket_base::reuse_address(true), ec);
            if (ec)
            {
                LOG_ERROR("[CORE] Received listener acceptor set_option error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::LISTENER_ACCEPTOR_SET_OPTION_FAILURE, ec);
                return;
            }

            // Bind to the server address
            m_acceptor.bind(endpoint, ec);
            if (ec)
            {
                LOG_ERROR("[CORE] Received listener acceptor bind error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::LISTENER_ACCEPTOR_BIND_FAILURE, ec);
                return;
            }

            // Start listening for connections
            m_acceptor.listen(net::socket_base::max_listen_connections, ec);
            if (ec)
            {
                LOG_ERROR("[CORE] Received listener acceptor listen error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::LISTENER_ACCEPTOR_LISTEN_FAILURE, ec);
                return;
            }

            
        }

        // Start accepting incoming connections
        void run()
        {
            do_accept();
        }

    private:
        void do_accept()
        {
            // The new connection gets its own strand
            m_acceptor.async_accept(
                net::make_strand(m_ioc),
                beast::bind_front_handler(
                    &listener::on_accept,
                    this->shared_from_this()));
        }

        void on_accept(beast::error_code ec, tcp::socket socket)
        {
            if (ec)
            {
                LOG_ERROR("[CORE] Received listener::on_accept error: '{0}'", ec.what());
                m_application->HandleFailure(FAILURE_REASON::LISTENER_ON_ACCEPT_FAILURE, ec);
            }
            else
            {
                LOG_TRACE("Attempting to accept incoming connection from {0}:{1}...", 
                    socket.remote_endpoint().address().to_string(),
                    socket.remote_endpoint().port());

                // Create the detector http_session and run it
                std::make_shared<detect_session>(
                    std::move(socket),
                    m_ctx,
                    m_application)->run();
            }

            // Accept another connection
            do_accept();
        }

        net::io_context& m_ioc;
        ssl::context& m_ctx;
        tcp::acceptor m_acceptor;
        Application<Derived>* m_application;
    };

public:
	Application(std::string_view address, unsigned short port, unsigned int threads = std::thread::hardware_concurrency()) :
		m_ioc(threads),
		m_threads(threads)
	{
        assert(m_threads > 0);

        // The SSL context is required, and holds certificates
        ssl::context ctx{ ssl::context::tlsv12 };

        // This holds the self-signed certificate used by the server
        load_server_certificate(ctx);

        // Create and launch a listening port
        std::make_shared<listener>(
            m_ioc,
            ctx,
            tcp::endpoint{ net::ip::make_address(address), port },
            this)->run();

        LOG_INFO("Started listening on {0}:{1}", address, port);
	}

	void Run()
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

    void HandleFailure(FAILURE_REASON reason, const beast::error_code& ec)
    {
        derived().HandleFailure(reason, ec);
    }

    // Return a response for the given request.
    // The concrete type of the response message (which depends on the request), is type-erased in message_generator.
    template<class Body, class Allocator>
    http::message_generator HandleRequest(http::request<Body, http::basic_fields<Allocator>>&& req)
    {
        return derived().HandleRequest(std::move(req));
    }

    void HandleWebsocketData(Application<Derived>::plain_websocket_session* session, std::string&& data)
    {
        derived().HandleWebsocketData(session, std::move(data));
    }
    void HandleWebsocketData(Application<Derived>::ssl_websocket_session* session, std::string&& data)
    {
        derived().HandleWebsocketData(session, std::move(data));
    }
    void HandleWebsocketData(Application<Derived>::plain_websocket_session* session, void* data, size_t bytes)
    {
        derived().HandleWebsocketData(session, data, bytes);
    }
    void HandleWebsocketData(Application<Derived>::ssl_websocket_session* session, void* data, size_t bytes)
    {
        derived().HandleWebsocketData(session, data, bytes);
    }
    void WebsocketSessionJoin(Application<Derived>::plain_websocket_session* session)
    {
        derived().WebsocketSessionJoin(session);
    }
    void WebsocketSessionJoin(Application<Derived>::ssl_websocket_session* session)
    {
        derived().WebsocketSessionJoin(session);
    }
    void WebsocketSessionLeave(Application<Derived>::plain_websocket_session* session)
    {
        derived().WebsocketSessionLeave(session);
    }
    void WebsocketSessionLeave(Application<Derived>::ssl_websocket_session* session)
    {
        derived().WebsocketSessionLeave(session);
    }


private:
    Derived& derived()
    {
        return static_cast<Derived&>(*this);
    }

	net::io_context m_ioc;
	unsigned int m_threads;
};