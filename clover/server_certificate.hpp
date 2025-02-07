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
        "MIIDlzCCAn+gAwIBAgIUA6fdfsEtHsWAduPLpCxI1iRYPi8wDQYJKoZIhvcNAQEL\n"
        "BQAwWjELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRQwEgYDVQQHDAtMb3MgQW5n\n"
        "ZWxlczEOMAwGA1UECgwFQmVhc3QxGDAWBgNVBAMMD3d3dy5leGFtcGxlLmNvbTAg\n"
        "Fw0yNTAyMDcxNjU0MTdaGA8yMDUyMDYyNTE2NTQxN1owWjELMAkGA1UEBhMCVVMx\n"
        "CzAJBgNVBAgMAkNBMRQwEgYDVQQHDAtMb3MgQW5nZWxlczEOMAwGA1UECgwFQmVh\n"
        "c3QxGDAWBgNVBAMMD3d3dy5leGFtcGxlLmNvbTCCASIwDQYJKoZIhvcNAQEBBQAD\n"
        "ggEPADCCAQoCggEBAM0uFWikG8oC5o/DwIwsyOWvPJ16Mym0Ehjc5WpxSO6UVkim\n"
        "cXPHU2/N5RSKth7UwXJrk5Kyxq0lsmy9LKVt4qWfqsux/gpzSnUwGPyKgkncDxqq\n"
        "URaQ30nfdM5UT52QzikdtBgrBLfVNxinwAISh8gw+cG6GnlgLXraLBnSc10kk1N2\n"
        "DwVtXiFsc+LrNFjmpkpjDVORiI/MKph/IF3eyaAB7a5rbVLthQkob+gf0F/coXbe\n"
        "yHS0pGVGgVvpusTnnQOqGj++QNJL3mTXFLc9BwTjooROgGnuBTf8BkYc09N3LDXX\n"
        "9PSoB0WaPpXwcLq+MxXpQCR00AcXj3byKsqlvDUCAwEAAaNTMFEwHQYDVR0OBBYE\n"
        "FKYyymmPspDFZPRU/PerZm3DjbAYMB8GA1UdIwQYMBaAFKYyymmPspDFZPRU/Per\n"
        "Zm3DjbAYMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAC6S0Nrh\n"
        "UgdVOoIDyKqsB/d6Me0FV9CjKcip7hy+BZlc1CnZznnL21++hkaDcVlTAsa1BV4N\n"
        "u6ac2w7V0hWqHU6hu0oOyI+hW4PtIHb5P4VdqIVAHdn3gijSmjUwkYSJoTqkqztW\n"
        "A3oQb/WtO40qGGgaVRuh8aNz4+spqfhPQrM/fGHw482Gb/7Txj54WSzAlTDiBva5\n"
        "PjoBC+KqaZ6Pj9HHsKMS6YfrSWai/cPMmRcoT3WWM5XIRm5M2tRfSpHnlTe77+8v\n"
        "J2PSSKdK/GOHCd4i8lA7vEXpmw2SBeibawLmVOajUhL93D4rUWi36KLFAe+xrSYE\n"
        "je4lbp5kRjO2zjo=\n"
        "-----END CERTIFICATE-----\n";

    std::string const key =
        "-----BEGIN PRIVATE KEY-----\n"
        "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDNLhVopBvKAuaP\n"
        "w8CMLMjlrzydejMptBIY3OVqcUjulFZIpnFzx1NvzeUUirYe1MFya5OSssatJbJs\n"
        "vSylbeKln6rLsf4Kc0p1MBj8ioJJ3A8aqlEWkN9J33TOVE+dkM4pHbQYKwS31TcY\n"
        "p8ACEofIMPnBuhp5YC162iwZ0nNdJJNTdg8FbV4hbHPi6zRY5qZKYw1TkYiPzCqY\n"
        "fyBd3smgAe2ua21S7YUJKG/oH9Bf3KF23sh0tKRlRoFb6brE550Dqho/vkDSS95k\n"
        "1xS3PQcE46KEToBp7gU3/AZGHNPTdyw11/T0qAdFmj6V8HC6vjMV6UAkdNAHF492\n"
        "8irKpbw1AgMBAAECggEAENwx6NYIwozXzVsp6LA1bJ+oZ3hcg+zGypbm8zGOlgGd\n"
        "JX3SjM+wTNuqcLRaoCXzeieE34/Olk58CZtx88DCgxb1E0/zrtV9JNa9oY2a2d7k\n"
        "uYLiruwGAoKuN9Y4b0YwQAivfTJBF6oZoO5dRM5TrLZO5QXEmdIMFVr1jMRSXoY2\n"
        "j87Wy8OUDL1cD8bL9qm8OhahGTG6lNjPcrH37jfUNVwg6vyWqiIPHRTZWz+nf2J/\n"
        "EjU0hHnV2FTyqQkJotgp0USsC6IzaRxghHrJPlUH6ZUjFFM/cx1kWKSJG7eryWva\n"
        "cZfpiFBtjxY5fmQsPT5UjX9jAUi8PjofOqgozd1G8QKBgQDlpLucEV5mVdSw65ac\n"
        "fHjl2LJOFDbDjZ1Dmpo+X3yaPOoeHjwdTI2s1wlvllR4ehDN91+dPadaT96lZE2d\n"
        "S0965zv5sXaO/G8IJkVC9U9Lf4ZBHrsoHFk82xxMJVu0vZUEV0biPHbRvqU5OWd+\n"
        "ZFULAZ1HPr2iWbQP+jz43OKWWwKBgQDkupPaNKidZbv6XxPke+Fpzyt+Sg75ru2a\n"
        "1IBsme84tgtHlmNViVnDkvh50XYHASVU5AHsUtQCKzP/TbJs5fSTfzATvPL/kxFu\n"
        "EShlguHWNRK/k4st6ji21gS46WKEAEmJyguyDRglxKNbd+Zv1Htzs8TRYOEQkiYT\n"
        "MZDW4R0crwKBgF3ob4/yyleu4bs3m++CNy5G3yNuwLZXQuhSYKEBC0NHhbWrR4nz\n"
        "tDvp88HeB8z8ncKcVk1G2RjlcHbR/atFEMuBo9UH7SOrtvvuKoSnLDYDgDNBDefp\n"
        "L9TjBT9eR5IxtK6BwkrhzvUWsRolj1zwSpaloltwHLw3Upr2Cdj6+u3hAoGAPfvR\n"
        "1XAvwXewWUkquuBXVbUutCqdpEwjV7H+m2+bxGKQ6/V1Ndji2n0ZmOmKcpt84mRn\n"
        "oQNRMMVEcgs8LwaiINZ20OKDd38DWjCMIfY1/TakvgXd0bOHawTUgse8SslJJG38\n"
        "fWPPB20iV8dGS0fprJEq5RK76yGv78Oe3Jxkp0ECgYAZGvK69XYZyaOQW0OF22tK\n"
        "46wAP8kwKXBMGmAEn5BpHi8/U2Y9ke/uyDCqOlS47NumjajoEd6FEIKuIvnri1ln\n"
        "5BDLvFDtL5jMn9yHVx+hEp1gN1aIPvVf7mBQwgk3cviZrtVfqoMer8SzH/iBtSu8\n"
        "SqXA0tz1/IxAZLNYxUtqxw==\n"
        "-----END PRIVATE KEY-----\n";

    std::string const dh =
        "-----BEGIN DH PARAMETERS-----\n"
        "MIIBCAKCAQEAtFyu79FZzzWt+tYTUim3LHuEOz34S7QPCa2Gz4PqNZkEu9eT1WBb\n"
        "PZs+kffT+VGBLXcFgeOYQAGCK0KMxY40TjJmmgSoOH54ZbP5GpIpR0sw3MwxpXOs\n"
        "Vu5zVOAFZEgl/Zo8dEUw9TgXKR6PlRMcl9AA63Zjk19bANIRbR9XUtw74P7bWOJS\n"
        "Fqn5BiC/NW4zE5HSgB5NruBmLCKrU9NUvOhO98Ph/7p7ZktXCttpgFuGc2zpncyK\n"
        "pLVITL5ZztZLyO9T+0D6ZbHKbKvMq1znGO7Y7P7ac2QanIhyTdCOLj4QLHKQbaPI\n"
        "NHaFuabk3fujbLpDzgE96k32iLLY1Nrw7wIBAg==\n"
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