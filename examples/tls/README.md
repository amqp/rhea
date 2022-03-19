In order to run the TLS example certificates need to be created for
the client and the server. This example uses a dummy CA.

First we create the private key and self-signed certificate for the CA:

````
  openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -keyout ca-key.pem -out ca-cert.pem -subj "/CN=TestCA"
````

Then we create private keys and certificates, signed by the CA this
time, for the client:

````
  openssl req -newkey rsa:4096 -keyout client-key.pem -out client-csr.pem -subj "/CN=TestClient"

  openssl x509 -req -in client-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out client-cert.pem -days 365
````

and the server:

````
  openssl req -newkey rsa:4096 -keyout server-key.pem -out server-csr.pem -subj "/CN=localhost"

  openssl x509 -req -in server-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -out server-cert.pem -days 365
````
