#pragma once

#include <boost/asio/buffer.hpp>
#include <boost/asio/ssl/context.hpp>
#include <boost/beast.hpp>
#include <cstddef>
#include <memory>

#include "Log.hpp"

/*  Load a signed certificate into the ssl context, and configure
    the context for use with a server.

    For this to work with the browser or operating system, it is
    necessary to import the "Beast Test CA" certificate into
    the local certificate store, browser, or operating system
    depending on your environment Please see the documentation
    accompanying the Beast certificate for more details.
*/
inline void load_server_certificate(boost::asio::ssl::context& ctx)
{
    /*
        See here for helpful video on installing openssl on Windows: https://cloudzy.com/blog/install-openssl-on-windows/
        The certificate was generated from openssl on Windows (OpenSSL 3.4.0) using:

        openssl dhparam -out dh.pem 2048
        openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 10000 -out cert.pem

        $ openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 10000 -out cert.pem
        ...
        -----
        You are about to be asked to enter information that will be incorporated
        into your certificate request.
        What you are about to enter is what is called a Distinguished Name or a DN.
        There are quite a few fields but you can leave some blank
        For some fields there will be a default value,
        If you enter '.', the field will be left blank.
        -----
        Country Name (2 letter code) [AU]:US
        State or Province Name (full name) [Some-State]:OR
        Locality Name (eg, city) []:Portland
        Organization Name (eg, company) [Internet Widgits Pty Ltd]:
        Organizational Unit Name (eg, section) []:
        Common Name (e.g. server FQDN or YOUR name) []:
        Email Address []:
    */

    ctx.set_password_callback(
        [](std::size_t, boost::asio::ssl::context_base::password_purpose)
        {
            return "test";
        });

    ctx.set_options(
        boost::asio::ssl::context::default_workarounds |
        boost::asio::ssl::context::no_sslv2 |
        boost::asio::ssl::context::single_dh_use);

    std::string cert("/dev/ssl/cert.pem");
    std::string key("/dev/ssl/key.pem");
    std::string dh("/dev/ssl/dh.pem");

    boost::beast::error_code ec;

    ctx.use_certificate_chain_file(cert, ec);
    if (ec)
    {
        LOG_ERROR("[CORE] Failed to load ssl cert file '{0}': '{1}'", cert, ec.what());
        return;
    }

    ctx.use_private_key_file(key, boost::asio::ssl::context::file_format::pem, ec);
    if (ec)
    {
        LOG_ERROR("[CORE] Failed to load ssl private key file '{0}': '{1}'", key, ec.what());
        return;
    }

    ctx.use_tmp_dh_file(dh, ec);
    if (ec)
    {
        LOG_ERROR("[CORE] Failed to load ssl dh file '{0}': '{1}'", dh, ec.what());
        return;
    }
}