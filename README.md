# OAuthv2.0 Token Dispensing Proxy - Client Credentials and JWT

This is an example proxy that illustrates how to use Apigee to dispense tokens,
for the client_credentials grant_type.

Depending on the set of policies Apigee executes, Apigee can return an opaque token, or a JWT.


## Preparing to Use the Proxy

1. Import the proxy into any Apigee organization. The name will be 'oauth2-cc-and-jwt'.

2. Create an API product. The API product normally wraps API proxies with metadata.
   You should add _this proxy_ to the API Product.

3. Create a Developer within Apigee

4. Create a Developer App within Apigee, associated to the new Developer, and with
   authorization to use the API product.

5. View and copy the client_id and client_secret.
   You may want to set shell variables.


## Automate the above

If you don't mind using nodejs-based command line tools, you can automate the
above steps using the provisioning tool. Pre-requisites: `npm` and `node`
installed on your workstation.

```
cd tools
npm install
node ./provision.js -v -o $ORG -e $ENV
```

It should prompt you for your Apigee username and password. It will then perform
all of the steps described above.

NB: If you use Multi-factor authentication, check the help to see how to pass in a code.



## Invoking the Proxy

The Proxy has two "endpoints" - each will respond to requests sent to a different basepath.

| endpoint name                                    | basepath                      | purpose                             |
| ------------------------------------------------ | ----------------------------- | ----------------------------------- |
| [dispensary](./apiproxy/proxies/dispensary.xml)  | /oauth2-cc-and-jwt/dispensary | dispenses OAuth2 tokens per RFC6749 |
| [service](./apiproxy/proxies/service.xml)        | /oauth2-cc-and-jwt/service    | validates and verifies tokens obtained from the dispensary. |


The dispensary issues tokens ONLY via the client_credentials grant type.

To obtain a token, send in a POST request, as described in [RFC 6749 Section 4.4.2](https://tools.ietf.org/html/rfc6749#section-4.4.2]).

There are 4 distinct "flows" on [the
dispensary](./apiproxy/proxies/dispensary.xml). Each accepts the same kind of
input request; each validates the inbound client credentials. And each behaves
a little differently with its response.

| flow name | description                                                                |
| --------- | -------------------------------------------------------------------------- |
| token1a   | Issues opaque OAuth tokens; response is automatically generated by the Apigee OAuthV2 GenerateAccessToken policy. |
| token1b   | Issues opaque OAuth tokens; the proxy "manually" forms the response.       |
| token2    | Issues a JWT signed with RS256. The proxy "manually" forms the response.   |
| token3    | Issues a JWT signed with HS256. The proxy "manually" forms the response.   |


Here's an example request for flow `token1a`:
```
ORG=myorg
ENV=test
client_id=q298klsababkjdkjldkld
client_secret=5f62435782a48a33f66477d8
curl -i -X POST \
  -H 'content-type: application/x-www-form-urlencoded' \
  -u ${client_id}:${client_secret} \
  https://$ORG-$ENV.apigee.net/oauth2-cc-and-jwt/dispensary/token1a \
  -d 'grant_type=client_credentials'
```

You will see a response to the above, but without the user-specific
information in the response payload. It will look like this:
```json
{
  "issued_at": 1599168711253,
  "client_id": "FbqTatIjiSCqhC3zGrdqSGFGiHlE8MKY",
  "access_token": "Vp4u5Rmp22OnXshf5EA6gRGbNH2i",
  "grant_type": "client_credentials",
  "expires_in": 1799,
  "issued": "2020-09-03T21:31:51.253Z",
  "expires_at": 1599170510253,
  "expires": "2020-09-03T22:01:50.253Z"
}
```

You can try modifying the request path to use `/token1b`, `/token2`, and
`/token3` to see the other responses.

If you send in an invalid client id/secret pair, in all cases the proxy will
reject the request.


## Teardown

If you used the nodejs provision.js tool to set up the pieces, you can also use
that tool to "reset" your organization and delete all the example assets. Like this:

```
cd tools
node ./provision.js -v -o $ORG -e $ENV -R
```


## Commentary

This API proxy dispenses opaque OAuth tokens and JWT. Both can be used as Bearer
tokens. The OAuth specification does not prescribe the format of the returned
bearer token. Either opaque tokens or JWT is fine, or some other form of
(perhaps non-standard) token would also comply with the OAuth specification.
While OAuth does not describe how the tokens should be formed, it does describe
the messages that flow between client application and token dispensary, and
between client application and service endpoint. And it is easy to send either
an opaque token or a JWT within an Authorization header as a bearer token.

While the opaque token and JWT can both be used as OAuth bearer tokens, there
are tradeoffs.

- Validating an opaque OAuth token will require a lookup in a table. For large
  scale systems, that implies an I/O read. This will incur some latency. A
  well-designed system will cache the token for subsequent use, thereby
  amortizing the the cost of the I/O over many multiple calls. The expected
  pattern of usage is: an app obtains a token once, then uses it many
  times. Perhaps thousands, or tens of thousands of times. Only the first use
  requires I/O; the rest of those calls can be memory lookups. (It's not _just_ a
  lookup; it's a lookup plus a check of the token expiry time, and checks on
  other attributes on the token. But the lookup is the expensive part.)  In
  contrast, Validating a JWT requires checking a digital signature. This
  requires no I/O, but it does imply that all of the information associated to
  the token must be embedded within the token itself. The OAuth token may be 30
  bytes, while the JWT might be 600 bytes. This can result in inefficiencies
  when the request payloads are small. A token that large may easily cause the
  request to require multiple TCP packets. This can have a negative impact on
  performance at high scale.

- Because an opaque token requires a database lookup to obtain the metadata,
  only a party that has access to the token store can validate such a token. The
  service endpoint must be either the same as the token dispensary endpoint, or
  it must contact the token dispensary endpoint with each authorized request in
  order to validate that token. In contrast, the JWT can be validated by any
  part that has access to the verification key. This can be a public key in the
  case of algorithms like RS256 or PS256, or it can be a secret key in the case
  of signing algorithms like HS256. Validating JWT can be done without I/O from
  a token store, but Key management is a factor. If you use JWT, you must
  consider how to manage the signing keys. This includes key rotation, as well
  as publishing a list of public keys if you use RS/PS algorithms.
