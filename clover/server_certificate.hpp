#pragma once

#include <boost/asio/buffer.hpp>
#include <boost/asio/ssl/context.hpp>
#include <cstddef>
#include <memory>

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

    std::string const cert =
        "-----BEGIN CERTIFICATE-----\n"
        "MIIDgzCCAmugAwIBAgIUUtWeYe6OKOE735537NTeRT9OrgQwDQYJKoZIhvcNAQEL\n"
        "BQAwUDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk9SMREwDwYDVQQHDAhQb3J0bGFu\n"
        "ZDEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMCAXDTI1MDIwNTE2\n"
        "MjQzNFoYDzIwNTIwNjIzMTYyNDM0WjBQMQswCQYDVQQGEwJVUzELMAkGA1UECAwC\n"
        "T1IxETAPBgNVBAcMCFBvcnRsYW5kMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRz\n"
        "IFB0eSBMdGQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDiUnm4iuN2\n"
        "VDois9Hz/YVxnlJmDb7HucvY3vYJTosCf8o9YyF0u2wzG0eq/a+FWgha+FOJiigK\n"
        "8wAleGI3QDqjMZkCAX2NErf1LZtdw7ajimzg2NlU/9lNimSnTyDvJ4DzqyPr8Vjm\n"
        "8qqhpi0y/wWXZwHr1lqoTIAklZS4fHl6lnaVsfXM/DMufNwm4f2xN3wRhsRQhckk\n"
        "rKI30+e0sShOzstJwLZhsDIGX4PXDv9P/g3fc3Gex0+kCGolLCud/+vJWYYX+uKJ\n"
        "qDu4cvQF6BK8OVk9s8y0vod1eNDPScEkx5tkBlyB2ow4M3xypmSJmf96pKIvyuEa\n"
        "WStET1f97pmLAgMBAAGjUzBRMB0GA1UdDgQWBBTgVPHa6MgtAImlFS+P9Iy4V47K\n"
        "tTAfBgNVHSMEGDAWgBTgVPHa6MgtAImlFS+P9Iy4V47KtTAPBgNVHRMBAf8EBTAD\n"
        "AQH/MA0GCSqGSIb3DQEBCwUAA4IBAQCRHSXXwup+c3LLG7nNnmcD3bi+TALgAGc3\n"
        "0VSfXwIMQnADaKYidBuX5YsOosvwaMyTBay/sQ98f/noGNTfNJwtuPVWDI7/a7mV\n"
        "gqHNJo7jjVba7R+RcU2q100bWiWmfb7CWZiE0AA8s/kUPvlfBd28RD55xhL07OmT\n"
        "UeAURv/RMvd60ztNuVrIMtT1FWJlJF7+xvzGvoFyQgDJFXhWwNtm0hGPpvTu13A1\n"
        "sLH8uTY5oDmUN3DROPwKvY3DMS0PcJL3IyxfjneudA1qEUGmsdD8tM5oynBmTw6O\n"
        "b/UCR8w51UyNELXG+kjUkwng9axwOZL6DdedJ6TdyDwUQrDTg3cq\n"
        "-----END CERTIFICATE-----\n";

    std::string const key =
        "-----BEGIN PRIVATE KEY-----\n"
        "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDiUnm4iuN2VDoi\n"
        "s9Hz/YVxnlJmDb7HucvY3vYJTosCf8o9YyF0u2wzG0eq/a+FWgha+FOJiigK8wAl\n"
        "eGI3QDqjMZkCAX2NErf1LZtdw7ajimzg2NlU/9lNimSnTyDvJ4DzqyPr8Vjm8qqh\n"
        "pi0y/wWXZwHr1lqoTIAklZS4fHl6lnaVsfXM/DMufNwm4f2xN3wRhsRQhckkrKI3\n"
        "0+e0sShOzstJwLZhsDIGX4PXDv9P/g3fc3Gex0+kCGolLCud/+vJWYYX+uKJqDu4\n"
        "cvQF6BK8OVk9s8y0vod1eNDPScEkx5tkBlyB2ow4M3xypmSJmf96pKIvyuEaWStE\n"
        "T1f97pmLAgMBAAECggEAbsbLyWZB+9MyOXYm1/RJctl5n3Yu4XexrU9Ewj1tkSWX\n"
        "igCRiZ+LUGCT7cAKP41X9Z8C1JmJDALxGWYZPM31ZZeLOw4btAdrf1h5aaW4KchB\n"
        "jrTVe+NXK7sHlVUH28dMOPiVtpEFYNV6a3D5QrLMu9SxfgwHh8UaG84TY1GZ7EP5\n"
        "xbG5f2BZOa+k+WnEhLSwKFussNcRc/plffRoYFf2lukVR0cz8sD3XMtIUCa42vZj\n"
        "wdun++ygAhpxEfd8RZYkFN06J+VtHIbD36xIyZa6td9u4UH3PIVV4cJ2U0gkS+D1\n"
        "Xc7eH8iOWCG6N7QNDlV7JJ/bzG7rqRAgOymLmkO3IQKBgQD2y+AfOXMEHfvSbuS6\n"
        "YqYSgIAxHnSC1WG6xDxHzFdRfIGAVYI59NSixNAem1Y9XSNDFgdzRPc05bfVfn0B\n"
        "x5j+SaCndn1bcD2W8DiAmHQwCYeKi8possFGhZ2PnbC0KxBLEcD0Y63D+TyspvE4\n"
        "vQsBW/PNl1FbiQLJ9ncv7EmaIwKBgQDqwyLQtbW14zcqLNWl5RJOqekN9tZ4vQrT\n"
        "FRZikCnF2Q5bT7KDbrfCB75wnjmu7PBp5qa7TTb5aSy5Adl9h2hFZ5QaZWqGpxqs\n"
        "5yCztDI0B+z4G8ZeOdk569j0oWK49MIT2sjUtkNFN0EbmXnahae0YPgb/LyOvtge\n"
        "FOWfH861eQKBgF56pB0wABEGbX4cx+F2nH8exHSJZS8lAxndv/n4h0EBug3oLkeD\n"
        "q9d4IvhknTo2qqYnC8kcEMsmWh8YIkEJKU/H3gHeAZV8vYdIBUltk6VEMKhgZad5\n"
        "LzaRNkVhp+EBT2Z9sHGeq0oH4ytxaY1ACbOGgSomkJXLOM8aVHx7J54jAoGAZhKo\n"
        "PZT0R/xeDPFnh3T9K8TGtzKe9+pCHZsqm3pRH1wL2PnjBTCLp0qUrASv0fXlZjZK\n"
        "QmAFShZHwr0iImlQlfS+OWflFFztxUXNOzVbKrJTf2EcM/X1FDEOqPbOpNqO0/Ep\n"
        "pwsEXsDyhxyJFdFNJKmQ1yJhnbMu5o1xdWlwCAkCgYEAqH7K5BUfFEDre2hLmNRp\n"
        "AYSqg/A+lVBv36GrItgKdIPo89MIlD0cL2xJvlfjUU488Tnbj7o8p7K+t7/Hisj7\n"
        "RTUmJuhx0k440EM2qb3m0krHxowlG4tcjE/7sx+esnf4ndfmRYxMCxNbgbyhzF0m\n"
        "nWV6bxZAmmC19CGret62wXM=\n"
        "-----END PRIVATE KEY-----\n";

    std::string const dh =
        "-----BEGIN DH PARAMETERS-----\n"
        "MIIBDAKCAQEApMMi+erdKnNN4qv6JwSoFhaZanEtffhiAzSMEJQ6CSUcq/xxTPl+\n"
        "P/y4yMZuKaENMd+hUdiHifzN6muRKrn2Hs6vCDPeDv2oTzaduPn9T7R+huuiT0KH\n"
        "/mzZQZenWCnLN7FyuOs1ggjffuEcvgxRiCVLR3Iay+cn3PhxCD6vCdq1DEjq2gxZ\n"
        "Jk04/wyuowCKIg7n0rnv5akVntVBn0YL2yaeyFURj1VGyqoS9gaGi0hht+GJrJBf\n"
        "0BWJNnPfw1SilUr9E8AOJfEf7t2skD1fw+gs4o45nA/95famkUI5L98pWhor6AdJ\n"
        "g+HWKqkHn3M1cUK8UGQFeYEXgXN6Kz2jlwIBAgICAOE=\n"
        "-----END DH PARAMETERS-----\n";


    ctx.set_password_callback(
        [](std::size_t, boost::asio::ssl::context_base::password_purpose)
        {
            return "test";
        });

    ctx.set_options(
        boost::asio::ssl::context::default_workarounds |
        boost::asio::ssl::context::no_sslv2 |
        boost::asio::ssl::context::single_dh_use);

    ctx.use_certificate_chain(
        boost::asio::buffer(cert.data(), cert.size()));

    ctx.use_private_key(
        boost::asio::buffer(key.data(), key.size()),
        boost::asio::ssl::context::file_format::pem);

    ctx.use_tmp_dh(
        boost::asio::buffer(dh.data(), dh.size()));
}